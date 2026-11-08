import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { PropFlame, Vec3 } from '@tiletrigger/shared';
import type { LastingFx } from './lastingFx.ts';

/** Fire props further than this aren't asked for at all (LastingFx draws none past 70 m). */
const ASK_RANGE = 75;

interface Entry {
  id: string;
  key: string;
  root: TransformNode;
  local: Vector3;
  size: number;
  /** A column of smoke over the flame (a burning wreck), this size; 0: none. */
  smoke: number;
  /** Rides a mover: its flame point is worked out every frame. */
  moving: boolean;
  world: Vec3 | null;
  hide: readonly string[];
  /** The model's own flame meshes (found once the model is in), or null while it loads. */
  plain: AbstractMesh[] | null;
  plainShown: boolean;
}

/**
 * The open flames of fire props (braziers, fire bowls, torches, candles, campfires, burning wrecks: content/props.json `flame`):
 * each asks LastingFx for its Flame FX effect (map.lasting `flame.<fx>`) at its flame point, sized to its flame;
 * where one is drawn the model's own flame (its `hide` materials) gives way, and everywhere else (past 70 m, past
 * the lasting cap, on low graphics, before the pack is in) the model's flame stands as it always did. Flames are
 * decor: every gameplay fire, charge ball or cloud takes its place first.
 */
export class PropFlames {
  private readonly entries: Entry[] = [];

  /** `enabled` false (low graphics): no pack flames, the models' own flames only. */
  constructor(
    private readonly lasting: LastingFx,
    private readonly enabled: boolean,
  ) {}

  add(entityId: string, root: TransformNode, flame: PropFlame, scale: number, moving: boolean): void {
    this.entries.push({
      id: `prop:${entityId}`,
      key: `flame.${flame.fx}`,
      root,
      local: new Vector3(flame.at[0], flame.at[1], flame.at[2]),
      size: flame.size * scale,
      smoke: (flame.smoke ?? 0) * scale,
      moving,
      world: null,
      hide: flame.hide ?? [],
      plain: null,
      plainShown: true,
    });
  }

  get size(): number {
    return this.entries.length;
  }

  /** Ask for the flames near the camera (before LastingFx.update). */
  want(cam: Vec3): void {
    if (!this.enabled) return;
    for (const e of this.entries) {
      // A broken prop (its root switched off) has no flame.
      if (!e.root.isEnabled(false)) continue;
      const at = this.flamePoint(e);
      const dx = at.x - cam.x;
      const dy = at.y - cam.y;
      const dz = at.z - cam.z;
      if (dx * dx + dy * dy + dz * dz > ASK_RANGE * ASK_RANGE) continue;
      this.lasting.want(e.id, e.key, at, { size: e.size });
      // Smoke rises over a burning wreck: the same column a burnt-out vehicle smoulders with (steady, never a flash).
      if (e.smoke) this.lasting.want(`${e.id}:smoke`, 'smoke.wreck', at, { size: e.smoke });
    }
  }

  /** Show each model's own flame where its pack flame isn't drawn (after LastingFx.update). */
  show(): void {
    for (const e of this.entries) {
      if (!e.hide.length) continue;
      const shown = !this.lasting.drawn(e.id);
      if (shown === e.plainShown && e.plain) continue;
      const plain = this.plainOf(e);
      if (!plain) continue;
      for (const m of plain) m.setEnabled(shown);
      e.plainShown = shown;
    }
  }

  private flamePoint(e: Entry): Vec3 {
    if (e.world && !e.moving) return e.world;
    const w = Vector3.TransformCoordinates(e.local, e.root.computeWorldMatrix(true));
    e.world = { x: w.x, y: w.y, z: w.z };
    return e.world;
  }

  /** The model's meshes drawn with one of the `hide` materials (null until the model is in). */
  private plainOf(e: Entry): AbstractMesh[] | null {
    if (e.plain) return e.plain;
    const meshes = e.root.getChildMeshes(false);
    if (!meshes.length) return null;
    // Tinted props draw with their own copies of the materials, named `<material>_<tint>`.
    e.plain = meshes.filter((m) => !!m.material && e.hide.some((h) => m.material!.name === h || m.material!.name.startsWith(`${h}_#`)));
    return e.plain;
  }

  dispose(): void {
    this.entries.length = 0;
  }
}
