import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { IceSnapshot, PhysicsWorld, Vec3 } from '@tiletrigger/shared';

/** How long a block takes to melt away (s) when its time is up; one that shatters breaks at once. */
export const ICE_MELT_SECONDS = 0.6;

interface ClientIce {
  node: TransformNode;
  body: ReturnType<PhysicsWorld['createBox']>;
  slot: number;
  pos: Vec3;
  half: { x: number; y: number };
}

/** How much of a melting block is left after `t` seconds (1 → 0, eased): it sinks as it goes. */
export function meltLeft(t: number): number {
  const k = Math.max(0, Math.min(1, t / ICE_MELT_SECONDS));
  return 1 - k * k;
}

/**
 * The Freeze Ray's freeze blasts as the client knows them (snapshot `ic`; sim/match.ts IceBlock): a block of pale,
 * see-through ice round the frozen one (the body inside shows through it), and a force-field box in the prediction
 * physics so walking into one predicts as the server has it (shots pass: it holds movement only). A block that
 * leaves the snapshot melts down (`shatter`: its prisoner died, it breaks into shards at once). Calm by design: no
 * glow, no flash, steady.
 */
export class IceBlocks {
  private readonly blocks = new Map<number, ClientIce>();
  private material: StandardMaterial | null = null;
  /** Blocks that went because their prisoner died (the `ice` event's `x`), by slot, till the snapshot drops them. */
  private readonly shattered = new Set<number>();

  constructor(
    private readonly scene: Scene,
    private readonly physics: PhysicsWorld,
    private readonly shards: (at: Vec3, size: number) => void,
  ) {}

  /** The slots held in ice now (the frozen player's own prediction stands still: LocalPlayer.iced). */
  heldSlots(): Set<number> {
    return new Set([...this.blocks.values()].map((b) => b.slot));
  }

  /** The `ice` event's shatter flag: that slot's block breaks rather than melts when it goes. */
  shatter(slot: number): void {
    this.shattered.add(slot);
  }

  apply(list: readonly IceSnapshot[] | undefined): void {
    const seen = new Set<number>();
    let changed = false;
    for (const [id, slot, x, y, z, hx, hy] of list ?? []) {
      seen.add(id);
      if (this.blocks.has(id)) continue;
      const pos = { x, y, z };
      const body = this.physics.createBox({ x, y: y + hy, z }, { x: hx, y: hy, z: hx }, 0, undefined, true);
      this.blocks.set(id, { node: this.build(id, pos, hx, hy), body, slot, pos, half: { x: hx, y: hy } });
      changed = true;
    }
    for (const [id, b] of this.blocks) {
      if (seen.has(id)) continue;
      this.physics.removeCollider(b.body);
      this.blocks.delete(id);
      changed = true;
      if (this.shattered.delete(b.slot)) {
        b.node.dispose();
        this.shards({ x: b.pos.x, y: b.pos.y + b.half.y, z: b.pos.z }, b.half.x);
      } else this.melt(b.node);
    }
    if (changed) this.physics.commit();
  }

  /** A block of ice: a see-through box with a thinner skin inside (a rim of frost at its edges), filling the body's place. */
  private build(id: number, pos: Vec3, hx: number, hy: number): TransformNode {
    this.material ??= Object.assign(new StandardMaterial('ice_block', this.scene), {
      diffuseColor: Color3.FromHexString('#cdeeff'),
      emissiveColor: Color3.FromHexString('#2a4250'),
      specularColor: new Color3(0.9, 0.95, 1),
      specularPower: 48,
      alpha: 0.42,
    });
    const node = new TransformNode(`ice_${id}`, this.scene);
    node.position.set(pos.x, pos.y, pos.z);
    const outer: Mesh = CreateBox(`ice_${id}_outer`, { width: hx * 2, height: hy * 2, depth: hx * 2 }, this.scene);
    outer.position.y = hy;
    const inner: Mesh = CreateBox(`ice_${id}_inner`, { width: hx * 1.7, height: hy * 1.85, depth: hx * 1.7 }, this.scene);
    inner.position.y = hy;
    // A slight turn of the inner skin: two faces catch the light differently, the block reads as cut ice, not glass.
    inner.rotation.y = 0.12;
    for (const m of [outer, inner]) {
      m.material = this.material;
      m.isPickable = false;
      m.parent = node;
    }
    return node;
  }

  /** Sink and go over ICE_MELT_SECONDS. */
  private melt(node: TransformNode): void {
    const start = performance.now();
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const left = meltLeft((performance.now() - start) / 1000);
      node.scaling.set(1, Math.max(0.01, left), 1);
      if (left > 0) return;
      this.scene.onBeforeRenderObservable.remove(obs);
      node.dispose();
    });
  }

  dispose(): void {
    for (const b of this.blocks.values()) {
      this.physics.removeCollider(b.body);
      b.node.dispose();
    }
    this.blocks.clear();
  }
}
