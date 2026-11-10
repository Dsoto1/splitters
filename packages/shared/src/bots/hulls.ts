/**
 * Walking round hulls standing still (BOT_AI_PLAN.md Phase C, moving obstacles): parked vehicles, wrecks and turrets
 * aren't on the navmesh (it is built once, without mounts, and vehicles move), so a route can run straight through one.
 * Before, a bot walked into the hull, was judged stuck three times, then stepped 3-5 m aside (planSidestep): six
 * seconds or more against a parked jeep or dropship. Now a bot on foot whose next few metres cross a still hull heads
 * for the corner of the hull that makes the shorter way round, and carries on along its route past it.
 *
 * Pure geometry on the mounts' boxes (pos at the base, `half` extents, turned by `yaw`), with the caller's checks for
 * walls and ground at the corners.
 */
import type { Vec3 } from '../math.ts';
import { PLAYER } from '../sim/constants.ts';
import type { MountView } from './vehicles.ts';

/** A vehicle slower than this (m/s) is walked round as if parked; a faster one will have moved on (watchTraffic dodges). */
export const HULL_STILL = 1;
/** How far ahead (m) along its way a bot looks for a hull in the way. */
export const HULL_LOOK = 7;
/** A body this far off a hull's side touches it: the way is blocked when it comes nearer. */
const TOUCH = PLAYER.radius + 0.1;
/** Corners to go round by, this far off the hull's sides (m). */
const ROUND = PLAYER.radius + 0.55;
/** Keeping to the side chosen for a hull: the other side has to be this much (m) shorter to switch. */
const SIDE_KEEP = 1.5;

/** The way past a hull: the corner to head for, which hull, and which side of the way it is on (+1 left, -1 right). */
export interface HullPass {
  pos: Vec3;
  index: number;
  side: number;
}

/** Whether the hull stands still (and is solid): a turret or sentry, a vehicle slower than HULL_STILL, a wreck. */
export function stillHull(m: MountView): boolean {
  if (!m.half) return false;
  if (!m.alive) return !!m.wreck;
  return m.kind !== 'vehicle' || (m.speed ?? 0) < HULL_STILL;
}

/** Whether `p` is on a still hull's footprint (within a body's radius of it, at its height): no body gets there. `skip`: a mount's index to leave out (the one being boarded). */
export function insideHull(hulls: readonly MountView[], p: Vec3, skip = -1): boolean {
  for (const m of hulls) {
    const half = m.half;
    if (!half || m.index === skip || !stillHull(m)) continue;
    if (p.y > m.pos.y + half[1] * 2 - 0.4 || p.y < m.pos.y - 1.2) continue;
    const dx = p.x - m.pos.x;
    const dz = p.z - m.pos.z;
    if (Math.abs(dx) > half[0] + half[2] + 1 || Math.abs(dz) > half[0] + half[2] + 1) continue;
    const c = Math.cos(m.yaw);
    const s = Math.sin(m.yaw);
    if (Math.abs(dx * c - dz * s) < half[0] + PLAYER.radius && Math.abs(dx * s + dz * c) < half[2] + PLAYER.radius) return true;
  }
  return false;
}

/**
 * Whether the segment (ax, az) → (bx, bz) passes through the open rectangle |x| < ex, |z| < ez (Liang-Barsky);
 * the parameter where it enters, or -1.
 */
export function segmentEntersBox(ax: number, az: number, bx: number, bz: number, ex: number, ez: number): number {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q > 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, ax + ex) || !clip(dx, ex - ax) || !clip(-dz, az + ez) || !clip(dz, ez - az)) return -1;
  return t1 - t0 > 1e-6 ? t0 : -1;
}

/** What hullDetour needs besides the hulls and the way. */
export interface HullWay {
  /** The side chosen last time for a hull, kept unless the other is clearly shorter. */
  keep?: { index: number; side: number } | null;
  /** The caller's check that a body walks from `from` to `to`, a corner round a hull (no wall, ground there). */
  ok: (from: Vec3, to: Vec3) => boolean;
  /** The route's first corner beyond the hull, when `to` (the route's corner) is under one: round it to there. */
  beyond?: Vec3 | null;
  /** The mount it is getting into: not in its way. */
  boarding?: number;
}

/**
 * The way round the nearest still hull that the next HULL_LOOK metres from `me` toward `to` run into: the corner to
 * head for; 'beyond' when `to` is under the hull and the way straight on to `w.beyond` is clear (on past `to`); or
 * null when no hull is in the way (or no way round is clear).
 */
export function hullDetour(hulls: readonly MountView[], me: Vec3, to: Vec3, w: HullWay): HullPass | 'beyond' | null {
  let wx = to.x - me.x;
  let wz = to.z - me.z;
  const len = Math.hypot(wx, wz);
  if (len < 0.3) return null;
  const look = Math.min(len, HULL_LOOK);
  const ex = me.x + (wx / len) * look;
  const ez = me.z + (wz / len) * look;
  wx /= len;
  wz /= len;
  let best: MountView | null = null;
  let bestT = Infinity;
  let under = false;
  for (const m of hulls) {
    const half = m.half;
    if (!half || m.index === w.boarding || !stillHull(m)) continue;
    const reach = Math.max(half[0], half[2]) + TOUCH;
    // (Quick: too far off the segment's middle to touch it.)
    if (Math.hypot((me.x + ex) / 2 - m.pos.x, (me.z + ez) / 2 - m.pos.z) > look / 2 + reach) continue;
    // Standing on it, or under it (a flyer up in the air, a deck over us): not in the way.
    if (me.y > m.pos.y + half[1] * 2 - 0.4 || me.y < m.pos.y - 1.2) continue;
    const c = Math.cos(m.yaw);
    const s = Math.sin(m.yaw);
    const ax = (me.x - m.pos.x) * c - (me.z - m.pos.z) * s;
    const az = (me.x - m.pos.x) * s + (me.z - m.pos.z) * c;
    // Already up against (or in) it: the corners are no help from there; the stuck recovery steps aside.
    if (Math.abs(ax) < half[0] + TOUCH * 0.5 && Math.abs(az) < half[2] + TOUCH * 0.5) continue;
    // Going to something beside it (not under it): it isn't in the way.
    const gx = (to.x - m.pos.x) * c - (to.z - m.pos.z) * s;
    const gz = (to.x - m.pos.x) * s + (to.z - m.pos.z) * c;
    const inside = Math.abs(gx) < half[0] + TOUCH && Math.abs(gz) < half[2] + TOUCH;
    if (!inside && Math.abs(gx) < half[0] + ROUND + 0.3 && Math.abs(gz) < half[2] + ROUND + 0.3) continue;
    // (Under it, and nothing beyond: the goal itself is under a hull, nothing to go round to.)
    if (inside && !w.beyond) continue;
    const bx = (ex - m.pos.x) * c - (ez - m.pos.z) * s;
    const bz = (ex - m.pos.x) * s + (ez - m.pos.z) * c;
    const t = segmentEntersBox(ax, az, bx, bz, half[0] + TOUCH, half[2] + TOUCH);
    if (t >= 0 && t < bestT) {
      bestT = t;
      best = m;
      under = inside;
    }
  }
  if (!best) return null;
  const half = best.half!;
  const c = Math.cos(best.yaw);
  const s = Math.sin(best.yaw);
  const local = (p: Vec3): [number, number] => [(p.x - best.pos.x) * c - (p.z - best.pos.z) * s, (p.x - best.pos.x) * s + (p.z - best.pos.z) * c];
  const world = (x: number, z: number): Vec3 => ({ x: best.pos.x + x * c + z * s, y: me.y, z: best.pos.z - x * s + z * c });
  const blocked = (x0: number, z0: number, x1: number, z1: number) => segmentEntersBox(x0, z0, x1, z1, half[0] + TOUCH, half[2] + TOUCH) >= 0;
  const [ax, az] = local(me);
  // The route's corner under the hull: round it to the first corner beyond; straight there when nothing's in the way.
  const goal = under ? w.beyond! : to;
  const [gx, gz] = local(goal);
  if (under && !blocked(ax, az, gx, gz) && w.ok(me, goal)) return 'beyond';
  const hx = half[0] + ROUND;
  const hz = half[2] + ROUND;
  // Corners in order round the hull: neighbours are k ± 1.
  const cx = [hx, hx, -hx, -hx];
  const cz = [hz, -hz, -hz, hz];
  const ways: { k: number; q: number; cost: number; side: number }[] = [];
  for (let k = 0; k < 4; k++) {
    const kx = cx[k]!;
    const kz = cz[k]!;
    if (blocked(ax, az, kx, kz)) continue;
    const p = world(kx, kz);
    // Left (+1) or right (-1) of the way.
    const side = wx * (p.z - me.z) - wz * (p.x - me.x) > 0 ? 1 : -1;
    const kept = w.keep && w.keep.index === best.index && w.keep.side !== side ? SIDE_KEEP : 0;
    const first = Math.hypot(kx - ax, kz - az) + kept;
    if (!blocked(kx, kz, gx, gz)) ways.push({ k, q: -1, cost: first + Math.hypot(gx - kx, gz - kz), side });
    // Round the next corner on (the hull's far side): along the side, then on.
    for (const q of [(k + 1) % 4, (k + 3) % 4]) {
      const qx = cx[q]!;
      const qz = cz[q]!;
      if (!blocked(qx, qz, gx, gz)) ways.push({ k, q, cost: first + Math.hypot(qx - kx, qz - kz) + Math.hypot(gx - qx, gz - qz), side });
    }
  }
  ways.sort((a, b) => a.cost - b.cost || a.k - b.k || a.q - b.q);
  for (const v of ways) {
    const p = world(cx[v.k]!, cz[v.k]!);
    if (!w.ok(me, p)) continue;
    // (Along the side to the next corner: that leg clear too, a wall the hull is parked against.)
    const q = v.q >= 0 ? world(cx[v.q]!, cz[v.q]!) : null;
    if (q && !w.ok(p, q)) continue;
    // And on from the last corner to where it is going (a wall the hull's end meets: the other way round).
    if (!w.ok(q ?? p, { ...goal, y: me.y })) continue;
    return { pos: p, index: best.index, side: v.side };
  }
  return null;
}
