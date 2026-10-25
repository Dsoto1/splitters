import { angleDelta, clamp, horizontalDistance, type Vec3 } from '../math.ts';
import type { SeatRole } from '../sim/mounts.ts';
import type { WeaponDefinition } from '../sim/weapons.ts';

/**
 * Turrets and vehicles for bots. Bots get in the same way players do (walk
 * up, press use) and drive with the same forward/right inputs.
 *
 * - Turrets: man a free one when an enemy is inside its arc and range and
 *   the bot isn't in a close fight; get off when nothing comes into the arc
 *   for a while, when it is badly damaged or when flanked.
 * - Vehicles: drive one when the trip is long and the route is open (open
 *   terrain maps), never taking the wheel from a human teammate nearby;
 *   follow the navmesh route, back up when stuck, and bail out near the
 *   destination, when it is about to blow, or when the fight is on and the
 *   seat has no gun.
 */

/** A turret or vehicle as a bot sees it. */
export interface MountView {
  /** Index into the match's mounts. */
  index: number;
  kind: 'turret' | 'sentry' | 'vehicle';
  pos: Vec3;
  yaw: number;
  /** 0..1 */
  health: number;
  alive: boolean;
  enterRadius: number;
  seats: readonly { role: SeatRole; free: boolean; weapon?: WeaponDefinition; arc?: number }[];
  /** Vehicles: top speed (m/s). */
  maxSpeed?: number;
  /** A human (or anyone friendly) has a claim: a human ally close by. */
  humanNear?: boolean;
  /** Hostile to us (an enemy is in it). */
  hostile?: boolean;
}

/** The seat a bot is in. */
export interface SeatView {
  mount: number;
  seat: number;
  role: SeatRole;
  weapon?: WeaponDefinition;
  arc?: number;
  heat: number;
  overheated: boolean;
}

/** Is `p` inside a seat's firing arc and range from the mount? */
export function inArc(m: MountView, seat: { arc?: number; weapon?: WeaponDefinition }, p: Vec3): boolean {
  const d = horizontalDistance(m.pos, p);
  if (!seat.weapon || d > Math.min(seat.weapon.range, 70)) return false;
  if (seat.arc === undefined) return true;
  const a = Math.atan2(p.x - m.pos.x, p.z - m.pos.z);
  return Math.abs(angleDelta(m.yaw, a)) <= seat.arc * 0.92;
}

/** A free turret worth manning against an enemy at `enemy`, within walking reach of `from`. */
export function turretFor(mounts: readonly MountView[], from: Vec3, enemy: Vec3, reach: number): MountView | null {
  let best: MountView | null = null;
  let bestD = reach;
  for (const m of mounts) {
    if (!m.alive || m.kind !== 'turret' || m.health < 0.35 || m.hostile) continue;
    const seat = m.seats.find((s) => s.role === 'gunner' && s.free && s.weapon);
    if (!seat || !inArc(m, seat, enemy)) continue;
    // The turret must be no closer to the enemy than a few metres (don't walk into them).
    if (horizontalDistance(m.pos, enemy) < 10) continue;
    const d = horizontalDistance(m.pos, from) + Math.abs(m.pos.y - from.y) * 3;
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/** A free vehicle to drive toward `goal` (a long trip), close to `from`. */
export function vehicleFor(mounts: readonly MountView[], from: Vec3, goal: Vec3, reach: number): MountView | null {
  const trip = horizontalDistance(from, goal);
  if (trip < 55) return null;
  let best: MountView | null = null;
  let bestD = reach;
  for (const m of mounts) {
    if (!m.alive || m.kind !== 'vehicle' || m.health < 0.5 || m.humanNear || m.hostile) continue;
    const driver = m.seats.find((s) => s.role === 'driver');
    if (!driver?.free || m.seats.some((s) => !s.free)) continue;
    const d = horizontalDistance(m.pos, from) + Math.abs(m.pos.y - from.y) * 3;
    // Worth it only if the vehicle is roughly on the way: getting to it adds little to the trip.
    if (d + horizontalDistance(m.pos, goal) > trip + 15) continue;
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/** Driving state kept by the brain while at the wheel. */
export interface DriveState {
  /** Ticks of little progress, and the tick a reverse manoeuvre ends. */
  slow: number;
  reverseUntil: number;
  /** Times it had to back out. */
  unstick: number;
  last: Vec3 | null;
}

export const freshDrive = (): DriveState => ({ slow: 0, reverseUntil: 0, unstick: 0, last: null });

/**
 * Steering toward the next route point: throttle down for sharp turns and
 * near the end, back up (steering the other way) when stuck against something.
 */
export function steer(st: DriveState, tick: number, m: MountView, aim: Vec3, distLeft: number): { forward: number; right: number } {
  const pos = m.pos;
  const moved = st.last ? horizontalDistance(pos, st.last) : 1;
  st.last = { ...pos };
  const err = angleDelta(m.yaw, Math.atan2(aim.x - pos.x, aim.z - pos.z));
  if (tick < st.reverseUntil) return { forward: -1, right: clamp(-err * 2, -1, 1) };
  // Under 0.6 m/s for a second and a half while trying to go: back out.
  st.slow = moved < 0.01 ? st.slow + 1 : Math.max(0, st.slow - 2);
  if (st.slow > 90) {
    st.slow = 0;
    st.unstick++;
    st.reverseUntil = tick + 60;
    return { forward: -1, right: clamp(-err * 2, -1, 1) };
  }
  const right = clamp(err * 2.2, -1, 1);
  let forward = Math.abs(err) > 1.4 ? 0.35 : Math.abs(err) > 0.7 ? 0.6 : 1;
  if (distLeft < 25) forward = Math.min(forward, 0.5);
  return { forward, right };
}
