import { boxQuat, quatMul, quatRotate, type Rot } from '../map/geometry.ts';
import type { BlockEntity, MapDocument, MoverEntity } from '../map/schema.ts';
import type { Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';

/**
 * Movers (map format v20): groups of free blocks that travel between points
 * and turn about a hinge (lifts, sliding walls, train cars, drawbridges).
 *
 * Where a mover is is a pure function of its current leg (from point, to
 * point, start tick) and the tick, so the server, every predicting client and
 * the renderer agree exactly: the server decides legs (Scenario) and sends
 * them in the scenario snapshot; everyone computes poses from them. Players
 * standing on a carried block are moved by the block's own motion each tick
 * (`carry`), on the server and in client prediction alike.
 */

export interface MoverBlock {
  /** Entity index of the block. */
  i: number;
  e: BlockEntity;
  /** Block centre relative to the mover's hinge (its position), at point 1. */
  local: Vec3;
  /** The block's own turn and tilt. */
  rot: Rot;
  half: Vec3;
}

export interface MoverDef {
  /** Entity index of the mover. */
  i: number;
  e: MoverEntity;
  pivot: Vec3;
  points: Vec3[];
  angles: number[];
  /** Hinge axis (horizontal, square to the facing). */
  axis: Vec3;
  blocks: MoverBlock[];
}

/** A leg from point `from` to point `to` (indices) that began at `start`; from === to: parked there (since `start`). */
export interface MoverLeg {
  from: number;
  to: number;
  start: number;
}

export interface MoverPose {
  offset: Vec3;
  angle: number;
}

const v = (a: readonly [number, number, number]): Vec3 => ({ x: a[0], y: a[1], z: a[2] });

/** The movers of a map, with the blocks they carry (a block carried by two movers goes with the first). */
export function moverDefs(map: MapDocument): MoverDef[] {
  const index = new Map(map.entities.map((e, i) => [e.id, i]));
  const taken = new Set<string>();
  const out: MoverDef[] = [];
  map.entities.forEach((e, i) => {
    if (e.kind !== 'mover') return;
    const pivot = v(e.position);
    const blocks: MoverBlock[] = [];
    for (const id of e.blocks) {
      const bi = index.get(id);
      const b = bi === undefined ? undefined : map.entities[bi];
      if (bi === undefined || b?.kind !== 'block' || taken.has(id)) continue;
      taken.add(id);
      const [w, h, d] = b.size;
      blocks.push({ i: bi, e: b, local: { x: b.position[0] - pivot.x, y: b.position[1] + h / 2 - pivot.y, z: b.position[2] - pivot.z }, rot: boxQuat(b.yaw, b.pitch, b.roll), half: { x: w / 2, y: h / 2, z: d / 2 } });
    }
    out.push({
      i,
      e,
      pivot,
      points: e.points.map(v),
      angles: e.points.map((_, k) => e.angles?.[k] ?? 0),
      axis: { x: Math.cos(e.yaw), y: 0, z: -Math.sin(e.yaw) },
      blocks,
    });
  });
  return out;
}

/** Ticks a leg takes: the slower of travelling at `speed` and turning at `turnSpeed`, at least one tick. */
export function legTicks(def: MoverDef, from: number, to: number): number {
  if (from === to) return 0;
  const a = def.points[from]!;
  const b = def.points[to]!;
  const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const turn = (Math.abs(def.angles[to]! - def.angles[from]!) * 180) / Math.PI;
  return Math.max(1, Math.round(Math.max(dist / def.e.speed, turn / def.e.turnSpeed) * TICK_RATE));
}

/** Eased progress (gentle start and stop), so riders aren't jolted. */
const ease = (u: number): number => u * u * (3 - 2 * u);

/** Where the mover is at `tick` (fractional ticks are fine, for drawing). */
export function moverPose(def: MoverDef, leg: MoverLeg, tick: number): MoverPose {
  const b = def.points[leg.to]!;
  if (leg.from === leg.to) return { offset: { ...b }, angle: def.angles[leg.to]! };
  const n = legTicks(def, leg.from, leg.to);
  const u = ease(Math.max(0, Math.min(1, (tick - leg.start) / n)));
  const a = def.points[leg.from]!;
  const a0 = def.angles[leg.from]!;
  return { offset: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }, angle: a0 + (def.angles[leg.to]! - a0) * u };
}

/** Rotation about the hinge axis by `angle` (positive lifts the side the mover faces). */
function hingeQuat(def: MoverDef, angle: number): Rot {
  // Negated: a standard turn about the axis would lower the facing side.
  const s = Math.sin(-angle / 2);
  return { x: def.axis.x * s, y: def.axis.y * s, z: def.axis.z * s, w: Math.cos(angle / 2) };
}

/** A carried block's centre and rotation at a pose. */
export function carriedTransform(def: MoverDef, block: MoverBlock, pose: MoverPose): { center: Vec3; rot: Rot } {
  const h = hingeQuat(def, pose.angle);
  const [x, y, z] = pose.angle ? quatRotate(h, block.local.x, block.local.y, block.local.z) : [block.local.x, block.local.y, block.local.z];
  return { center: { x: def.pivot.x + pose.offset.x + x, y: def.pivot.y + pose.offset.y + y, z: def.pivot.z + pose.offset.z + z }, rot: pose.angle ? quatMul(h, block.rot) : block.rot };
}

const conj = (q: Rot): Rot => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

/** Standing on top of a block: feet over its top face, within a hand's breadth of it. */
const RIDE_MARGIN = 0.3;

/**
 * Runtime mover state shared by the server's scenario and the client
 * (prediction and drawing): legs, poses, the blocks' colliders and riders.
 */
export class Movers {
  readonly defs: MoverDef[];
  readonly legs: MoverLeg[];
  /** Entity index -> position in `defs`. */
  private readonly byEntity = new Map<number, number>();

  constructor(map: MapDocument) {
    this.defs = moverDefs(map);
    this.legs = this.defs.map(() => ({ from: 0, to: 0, start: 0 }));
    this.defs.forEach((d, k) => this.byEntity.set(d.i, k));
  }

  /** Mover index (in `defs`) of an entity index. */
  of(entity: number): number | undefined {
    return this.byEntity.get(entity);
  }

  reset(tick: number): void {
    for (const l of this.legs) {
      l.from = 0;
      l.to = 0;
      l.start = tick;
    }
  }

  pose(k: number, tick: number): MoverPose {
    return moverPose(this.defs[k]!, this.legs[k]!, tick);
  }

  /** The point a mover is parked at (index), or null while it travels at `tick`. */
  parkedAt(k: number, tick: number): number | null {
    const l = this.legs[k]!;
    if (l.from === l.to) return l.to;
    return tick >= l.start + legTicks(this.defs[k]!, l.from, l.to) ? l.to : null;
  }

  /** Every carried block's centre and rotation at `tick`. */
  *transforms(tick: number): Generator<{ block: MoverBlock; center: Vec3; rot: Rot }> {
    for (let k = 0; k < this.defs.length; k++) {
      const def = this.defs[k]!;
      const pose = this.pose(k, tick);
      for (const block of def.blocks) yield { block, ...carriedTransform(def, block, pose) };
    }
  }

  /** Snapshot encoding of a leg: [entity index, start tick, from * 64 + to]. */
  encode(k: number): [number, number, number] {
    const l = this.legs[k]!;
    return [this.defs[k]!.i, l.start, l.from * 64 + l.to];
  }

  /** Apply a replicated leg (client). */
  decode(entity: number, start: number, packed: number): void {
    const k = this.byEntity.get(entity);
    if (k === undefined) return;
    const def = this.defs[k]!;
    const from = Math.floor(packed / 64) % 64;
    const to = packed % 64;
    if (from >= def.points.length || to >= def.points.length) return;
    this.legs[k] = { from, to, start };
  }

  /**
   * Ride: feet standing on a carried block at `tick - 1` go where that spot
   * of the block is at `tick`. Returns the new feet, or null when not riding
   * anything that moved. `present` says whether a block (entity index) is
   * there (dropped and hidden blocks carry nobody).
   */
  carry(feet: Vec3, tick: number, present: (entity: number) => boolean = () => true): Vec3 | null {
    for (let k = 0; k < this.defs.length; k++) {
      const def = this.defs[k]!;
      const before = this.pose(k, tick - 1);
      const after = this.pose(k, tick);
      if (before.angle === after.angle && before.offset.x === after.offset.x && before.offset.y === after.offset.y && before.offset.z === after.offset.z) continue;
      for (const block of def.blocks) {
        if (!present(block.i)) continue;
        const a = carriedTransform(def, block, before);
        const inv = conj(a.rot);
        const [lx, ly, lz] = quatRotate(inv, feet.x - a.center.x, feet.y - a.center.y, feet.z - a.center.z);
        const h = block.half;
        if (Math.abs(lx) > h.x + RIDE_MARGIN || Math.abs(lz) > h.z + RIDE_MARGIN || ly < h.y - 0.25 || ly > h.y + 0.45) continue;
        const b = carriedTransform(def, block, after);
        // Keep the rider's height above the top face, so a lift never swallows their feet.
        const [wx, wy, wz] = quatRotate(b.rot, lx, Math.max(ly, h.y), lz);
        return { x: b.center.x + wx, y: b.center.y + wy, z: b.center.z + wz };
      }
    }
    return null;
  }
}

/**
 * Navigation links for lifts (bots wait for the lift and ride it): for each
 * mover that runs by itself (loop or pingpong) and mostly goes up and down,
 * a link each way between the top of its first block at the lowest and the
 * highest point.
 */
export function liftLinks(map: MapDocument): { start: Vec3; end: Vec3; mover: string; reach: Vec3 }[] {
  const out: { start: Vec3; end: Vec3; mover: string; reach: Vec3 }[] = [];
  const reach = { x: 2.5, y: 0.6, z: 2.5 };
  for (const def of moverDefs(map)) {
    const block = def.blocks[0];
    if (!block || def.e.mode === 'trigger' || def.angles.some((a) => a !== 0)) continue;
    let lo = 0;
    let hi = 0;
    def.points.forEach((p, k) => {
      if (p.y < def.points[lo]!.y) lo = k;
      if (p.y > def.points[hi]!.y) hi = k;
    });
    const a = def.points[lo]!;
    const b = def.points[hi]!;
    const rise = b.y - a.y;
    if (rise < 1 || Math.hypot(b.x - a.x, b.z - a.z) > rise) continue;
    const top = (p: Vec3): Vec3 => ({ x: def.pivot.x + p.x + block.local.x, y: def.pivot.y + p.y + block.local.y + block.half.y, z: def.pivot.z + p.z + block.local.z });
    out.push({ start: top(a), end: top(b), mover: def.e.id, reach }, { start: top(b), end: top(a), mover: def.e.id, reach });
  }
  return out;
}
