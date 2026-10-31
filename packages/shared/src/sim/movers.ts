import { boxQuat, quatMul, quatRotate, type Rot } from '../map/geometry.ts';
import type { BlockEntity, MapDocument, MoverEntity, PropEntity } from '../map/schema.ts';
import type { Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';
import { hypot } from '../math.ts';

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
  /** Farthest feet can be from the block's centre and still ride it (Movers.carry's quick test). */
  reach: number;
}

/** A prop riding a mover (drawn only: carried props never collide). */
export interface MoverProp {
  /** Entity index of the prop. */
  i: number;
  e: PropEntity;
  /** The prop's base relative to the mover's hinge (its position), at point 1. */
  local: Vec3;
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
  props: MoverProp[];
}

/** A leg from point `from` to point `to` (indices) that began at `start`; from === to: parked there (since `start`). */
export interface MoverLeg {
  from: number;
  to: number;
  start: number;
}

/** A memoised pose of one mover at one tick (Movers.entry), and its blocks' transforms once asked for. */
interface MoverMemo {
  tick: number;
  leg: MoverLeg;
  from: number;
  to: number;
  start: number;
  pose: MoverPose;
  blocks: BlockAt[] | null;
}

interface BlockAt {
  center: Vec3;
  rot: Rot;
  inv: Rot;
}

export interface MoverPose {
  offset: Vec3;
  angle: number;
}

const v = (a: readonly [number, number, number]): Vec3 => ({ x: a[0], y: a[1], z: a[2] });

/** Standing on top of a block: feet over its top face, within a hand's breadth of it. */
const RIDE_MARGIN = 0.3;

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
      blocks.push({ i: bi, e: b, local: { x: b.position[0] - pivot.x, y: b.position[1] + h / 2 - pivot.y, z: b.position[2] - pivot.z }, rot: boxQuat(b.yaw, b.pitch, b.roll), half: { x: w / 2, y: h / 2, z: d / 2 }, reach: hypot(w / 2 + RIDE_MARGIN, h / 2 + 0.45, d / 2 + RIDE_MARGIN) + 0.01 });
    }
    const props: MoverProp[] = [];
    for (const id of e.props ?? []) {
      const pi = index.get(id);
      const p = pi === undefined ? undefined : map.entities[pi];
      if (pi === undefined || p?.kind !== 'prop' || taken.has(id)) continue;
      taken.add(id);
      props.push({ i: pi, e: p, local: { x: p.position[0] - pivot.x, y: p.position[1] - pivot.y, z: p.position[2] - pivot.z } });
    }
    out.push({
      i,
      e,
      pivot,
      points: e.points.map(v),
      angles: e.points.map((_, k) => e.angles?.[k] ?? 0),
      axis: { x: Math.cos(e.yaw), y: 0, z: -Math.sin(e.yaw) },
      blocks,
      props,
    });
  });
  return out;
}

/** Ticks a leg takes: the slower of travelling at `speed` and turning at `turnSpeed`, at least one tick. */
export function legTicks(def: MoverDef, from: number, to: number): number {
  if (from === to) return 0;
  const a = def.points[from]!;
  const b = def.points[to]!;
  const dist = hypot(b.x - a.x, b.y - a.y, b.z - a.z);
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

/** A carried prop's base position and rotation at a pose (its own yaw, then the hinge's turn). */
export function carriedPropTransform(def: MoverDef, prop: MoverProp, pose: MoverPose): { position: Vec3; rot: Rot } {
  const yaw = boxQuat(prop.e.yaw);
  if (!pose.angle) return { position: { x: def.pivot.x + pose.offset.x + prop.local.x, y: def.pivot.y + pose.offset.y + prop.local.y, z: def.pivot.z + pose.offset.z + prop.local.z }, rot: yaw };
  const h = hingeQuat(def, pose.angle);
  const [x, y, z] = quatRotate(h, prop.local.x, prop.local.y, prop.local.z);
  return { position: { x: def.pivot.x + pose.offset.x + x, y: def.pivot.y + pose.offset.y + y, z: def.pivot.z + pose.offset.z + z }, rot: quatMul(h, yaw) };
}

/** Movers set to at least this speed (m/s) run over whoever their blocks sweep into (trains, not lifts or mine carts). */
export const MOVER_STRIKE_SPEED = 4;

const conj = (q: Rot): Rot => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });


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

  /**
   * Poses and carried-block transforms, kept for the last two ticks asked of each mover: every player and
   * bot asks carry and strike about the same two ticks each tick (96 of them on a big map), so they are
   * worked out once, not once per body. An entry holds only while the mover's leg is the same.
   */
  private readonly memo: MoverMemo[][] = [];

  private entry(k: number, tick: number): MoverMemo {
    const leg = this.legs[k]!;
    const slots = this.memo[k] ?? (this.memo[k] = []);
    for (const m of slots) if (m.tick === tick && m.leg === leg && m.from === leg.from && m.to === leg.to && m.start === leg.start) return m;
    const m: MoverMemo = { tick, leg, from: leg.from, to: leg.to, start: leg.start, pose: moverPose(this.defs[k]!, leg, tick), blocks: null };
    if (slots.length >= 2) slots.shift();
    slots.push(m);
    return m;
  }

  /** The carried blocks' centres, rotations and inverse rotations at a memoised pose. */
  private blocksAt(k: number, m: MoverMemo): BlockAt[] {
    if (m.blocks) return m.blocks;
    const def = this.defs[k]!;
    return (m.blocks = def.blocks.map((block) => {
      const t = carriedTransform(def, block, m.pose);
      return { center: t.center, rot: t.rot, inv: conj(t.rot) };
    }));
  }

  /** Where mover `k` is at `tick` (shared: don't change it). */
  pose(k: number, tick: number): MoverPose {
    return this.entry(k, tick).pose;
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

  /** Every carried prop's base position and rotation at `tick` (for drawing). */
  *propTransforms(tick: number): Generator<{ prop: MoverProp; position: Vec3; rot: Rot }> {
    for (let k = 0; k < this.defs.length; k++) {
      const def = this.defs[k]!;
      if (!def.props.length) continue;
      const pose = this.pose(k, tick);
      for (const prop of def.props) yield { prop, ...carriedPropTransform(def, prop, pose) };
    }
  }

  /**
   * Run over: a body (feet, radius, height) that a carried block of a mover
   * set to MOVER_STRIKE_SPEED or more sweeps into at `tick` while under way,
   * without standing on it. Returns the block's speed (m/s), or 0.
   */
  strike(feet: Vec3, radius: number, height: number, tick: number, present: (entity: number) => boolean = () => true): number {
    for (let k = 0; k < this.defs.length; k++) {
      const def = this.defs[k]!;
      // Set to run fast (trains): lifts and carts never strike, so their poses aren't even needed.
      if (def.e.speed < MOVER_STRIKE_SPEED) continue;
      const before = this.pose(k, tick - 1);
      const now = this.entry(k, tick);
      const after = now.pose;
      const speed = hypot(after.offset.x - before.offset.x, after.offset.y - before.offset.y, after.offset.z - before.offset.z) * TICK_RATE;
      // Under way (not easing out of or into a stop).
      if (speed < 1) continue;
      const at = this.blocksAt(k, now);
      for (let b = 0; b < def.blocks.length; b++) {
        const block = def.blocks[b]!;
        if (!present(block.i)) continue;
        const t = at[b]!;
        const h = block.half;
        // Too far from the block's centre to be inside it, however it is turned (the usual case).
        const dx = feet.x - t.center.x;
        const dy = feet.y + height / 2 - t.center.y;
        const dz = feet.z - t.center.z;
        if (dx * dx + dy * dy + dz * dz > (h.x + radius) ** 2 + (h.y + height / 2) ** 2 + (h.z + radius) ** 2) continue;
        const [lx, ly, lz] = quatRotate(t.inv, dx, dy, dz);
        // Riding on top is fine; anywhere else inside the swept block is a hit.
        if (feet.y >= t.center.y + h.y - 0.3) continue;
        if (Math.abs(lx) < h.x + radius && Math.abs(lz) < h.z + radius && Math.abs(ly) < h.y + height / 2) return speed;
      }
    }
    return 0;
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
      const was = this.entry(k, tick - 1);
      const now = this.entry(k, tick);
      const before = was.pose;
      const after = now.pose;
      if (before.angle === after.angle && before.offset.x === after.offset.x && before.offset.y === after.offset.y && before.offset.z === after.offset.z) continue;
      const from = this.blocksAt(k, was);
      for (let i = 0; i < def.blocks.length; i++) {
        const block = def.blocks[i]!;
        if (!present(block.i)) continue;
        const a = from[i]!;
        // Nowhere near this block (the usual case): no rotation needed to know it.
        const reach = block.reach;
        const dx = feet.x - a.center.x;
        const dy = feet.y - a.center.y;
        const dz = feet.z - a.center.z;
        if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
        const [lx, ly, lz] = quatRotate(a.inv, dx, dy, dz);
        const h = block.half;
        if (Math.abs(lx) > h.x + RIDE_MARGIN || Math.abs(lz) > h.z + RIDE_MARGIN || ly < h.y - 0.25 || ly > h.y + 0.45) continue;
        const b = this.blocksAt(k, now)[i]!;
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
    if (rise < 1 || hypot(b.x - a.x, b.z - a.z) > rise) continue;
    const top = (p: Vec3): Vec3 => ({ x: def.pivot.x + p.x + block.local.x, y: def.pivot.y + p.y + block.local.y + block.half.y, z: def.pivot.z + p.z + block.local.z });
    out.push({ start: top(a), end: top(b), mover: def.e.id, reach }, { start: top(b), end: top(a), mover: def.e.id, reach });
  }
  return out;
}
