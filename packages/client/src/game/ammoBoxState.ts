import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AMMO_BOX_HALF, AMMO_BOX_MODEL, AMMO_BOX_REACH, type PhysicsWorld, type Vec3 } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';

interface ClientBox {
  node: TransformNode;
  body: ReturnType<PhysicsWorld['createBox']>;
  pos: Vec3;
  uses: number;
  deployed: boolean;
}

/**
 * Ammo boxes as the client knows them (snapshot `ab`, sim/resupply.ts): the WWII Ammo Crate drawn where each stands,
 * a box in the prediction physics so walking into one predicts as on the server, and which one you stand beside (the
 * Use prompt). A box that vanishes was emptied, destroyed or timed out; its cook-off comes as events.
 */
export class AmmoBoxState {
  private readonly boxes = new Map<number, ClientBox>();

  constructor(
    private readonly scene: Scene,
    private readonly physics: PhysicsWorld,
    private readonly models: ModelLibrary,
  ) {}

  apply(list: readonly number[][] | undefined): void {
    const seen = new Set<number>();
    let changed = false;
    for (const [id, x, y, z, yaw, , uses, deployed] of list ?? []) {
      seen.add(id!);
      const had = this.boxes.get(id!);
      if (had) {
        had.uses = uses!;
        continue;
      }
      const pos = { x: x!, y: y!, z: z! };
      const [hx, hy, hz] = AMMO_BOX_HALF;
      const body = this.physics.createBox({ x: pos.x, y: pos.y + hy, z: pos.z }, { x: hx, y: hy, z: hz }, yaw!);
      this.boxes.set(id!, { node: this.build(id!, pos, yaw!), body, pos, uses: uses!, deployed: deployed === 1 });
      changed = true;
    }
    for (const [id, b] of this.boxes) {
      if (seen.has(id)) continue;
      this.physics.removeCollider(b.body);
      b.node.dispose();
      this.boxes.delete(id);
      changed = true;
    }
    if (changed) this.physics.commit();
  }

  /** The crate model, standing on the ground point, turned to the box's yaw. */
  private build(id: number, pos: Vec3, yaw: number): TransformNode {
    const node = new TransformNode(`ammobox_${id}`, this.scene);
    node.position.set(pos.x, pos.y, pos.z);
    node.rotation.y = yaw;
    void this.models.instantiate(AMMO_BOX_MODEL, `ammobox_${id}_model`).then((m) => {
      if (node.isDisposed()) return m.dispose();
      m.parent = node;
      // Stood on the ground whatever its origin.
      const { min } = m.getHierarchyBoundingVectors(true);
      m.position.y -= min.y - pos.y;
      for (const mesh of m.getChildMeshes()) mesh.isPickable = false;
    });
    return node;
  }

  /** The box with stock whose reach your feet are in (the server's rule: Match.resupplyAtBox), or null. */
  inReach(feet: Vec3): { uses: number; deployed: boolean } | null {
    let best: ClientBox | null = null;
    let bestD = Infinity;
    for (const b of this.boxes.values()) {
      if (b.uses <= 0 || Math.abs(feet.y - b.pos.y) > 1.6) continue;
      const d = Math.hypot(feet.x - b.pos.x, feet.z - b.pos.z);
      if (d <= AMMO_BOX_REACH && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best && { uses: best.uses, deployed: best.deployed };
  }

  dispose(): void {
    for (const b of this.boxes.values()) b.node.dispose();
    this.boxes.clear();
  }
}
