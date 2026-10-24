import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { THROWABLE_DEFS, type CoverSnapshot, type PhysicsWorld, type Vec3 } from '@chronosplit/shared';

interface ClientCover {
  node: TransformNode;
  body: ReturnType<PhysicsWorld['createBox']>;
  pos: Vec3;
}

/**
 * Deployed sandbag walls as the client knows them: a stack of bags to draw
 * and a box in the prediction physics so walking into one predicts the same
 * as on the server. Walls that vanish from the snapshot break into debris.
 */
export class CoverState {
  private readonly covers = new Map<number, ClientCover>();
  private readonly half = THROWABLE_DEFS.sandbag.projectile.cover!.half;
  private material: StandardMaterial | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly physics: PhysicsWorld,
    private readonly broke: (at: Vec3) => void,
  ) {}

  apply(list: readonly CoverSnapshot[] | undefined): void {
    const seen = new Set<number>();
    let changed = false;
    for (const [id, x, y, z, yaw] of list ?? []) {
      seen.add(id);
      if (this.covers.has(id)) continue;
      const pos = { x, y, z };
      const [hx, hy, hz] = this.half;
      const body = this.physics.createBox({ x, y: y + hy, z }, { x: hx, y: hy, z: hz }, yaw);
      this.covers.set(id, { node: this.build(id, pos, yaw), body, pos });
      changed = true;
    }
    for (const [id, c] of this.covers) {
      if (seen.has(id)) continue;
      this.physics.removeCollider(c.body);
      c.node.dispose();
      this.covers.delete(id);
      this.broke({ x: c.pos.x, y: c.pos.y + this.half[1], z: c.pos.z });
      changed = true;
    }
    if (changed) this.physics.commit();
  }

  /** Two staggered rows of bags filling the collision box. */
  private build(id: number, pos: Vec3, yaw: number): TransformNode {
    this.material ??= Object.assign(new StandardMaterial('sandbag', this.scene), { diffuseColor: Color3.FromHexString('#b39b6b'), specularColor: Color3.Black() });
    const node = new TransformNode(`cover_${id}`, this.scene);
    node.position.set(pos.x, pos.y, pos.z);
    node.rotation.y = yaw;
    const [hx, hy, hz] = this.half;
    const rows = 3;
    const h = (hy * 2) / rows;
    for (let r = 0; r < rows; r++) {
      const count = r % 2 ? 3 : 4;
      const w = (hx * 2) / count;
      for (let i = 0; i < count; i++) {
        const bag = CreateCapsule(`bag_${id}`, { radius: h * 0.55, height: w * 1.05, tessellation: 8, subdivisions: 1 }, this.scene);
        bag.rotation.z = Math.PI / 2;
        bag.scaling.set(1, 1, (hz * 2) / (h * 1.1));
        bag.position.set(-hx + w * (i + 0.5), h * (r + 0.5), 0);
        bag.material = this.material;
        bag.parent = node;
      }
    }
    return node;
  }

  dispose(): void {
    for (const c of this.covers.values()) c.node.dispose();
    this.covers.clear();
  }
}
