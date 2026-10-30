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
 *   follow the navmesh route; when it stops making headway (wedged, or
 *   grinding along a wall) back out for a second, and if it is still stuck
 *   right after, get out and go on foot (and leave that vehicle alone for a
 *   while). Bail out near the destination, when it is about to blow or on
 *   fire, or when the fight is on and the seat has no gun.
 * - Riding along: a teammate (a human first) driving by with a free seat
 *   picks the bot up: it runs over and gets in (the gun if it is free) and
 *   shoots from there; it gets out when the driver does, when the vehicle
 *   is about to blow or on fire, when a bot driver has got it stuck, or
 *   when it has been parked a while with nothing to shoot.
 * - Enemy vehicles: an enemy driving, riding or manning a gun is still a
 *   target, but a hard one. Bots switch to rockets or grenade launchers
 *   (aimed at the hull), lob grenades at a slow one, go and fetch a
 *   launcher close by, take cover from one they can't hurt, and step out of
 *   the path of one bearing down on them.
 */

/** Ticks of next to no movement (under 0.6 m/s) at the wheel before backing out. */
export const STUCK_SLOW_TICKS = 90;
/** Headway check: under STUCK_MIN_PROGRESS metres in STUCK_WINDOW_TICKS (2.5 s) counts as stuck too (grinding on a wall). */
export const STUCK_WINDOW_TICKS = 150;
export const STUCK_MIN_PROGRESS = 2;
/** A back-out: full reverse, steering the other way, for a second. */
export const RECOVER_TICKS = 60;
/** Stuck again within this long (3 s) of a back-out: the back-out didn't work, get out. */
export const RECOVER_GRACE_TICKS = 180;
/** Back-outs in one drive before giving up whatever happens. */
export const MAX_RECOVERIES = 3;
/** Below this share of health (or on fire) everyone gets out: it is about to blow. */
export const BAIL_HEALTH = 0.3;
/** A vehicle a bot gave up on as stuck isn't taken again for this long (s). */
export const STUCK_AVOID_SECONDS = 30;
/** Riders with a bot at the wheel: under RIDER_MIN_PROGRESS m in RIDER_STUCK_TICKS (3 s) and they get out. */
export const RIDER_STUCK_TICKS = 180;
export const RIDER_MIN_PROGRESS = 2;
/** Enemy vehicles: faster than this (m/s) it is a danger to stand in front of; looked ahead this far (s); this wide either side (m). */
export const ROADKILL_SPEED = 4;
export const ROADKILL_LOOKAHEAD = 2.5;
export const ROADKILL_HALF_WIDTH = 3;
/** A weapon with at least this much splash damage hurts vehicles properly (rockets, grenade launchers). */
export const ANTI_VEHICLE_SPLASH = 50;

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
  /** `by`: who sits there (actor ID), when taken; `facing`: where a side gun's arc is centred. */
  seats: readonly { role: SeatRole; free: boolean; by?: number; weapon?: WeaponDefinition; arc?: number; facing?: number }[];
  /** Vehicles: top speed (m/s). */
  maxSpeed?: number;
  /** Vehicles: how fast it is going right now (m/s). */
  speed?: number;
  /** Vehicles placed to ride on water: with no road route (or only a long way round) they head straight across. */
  floats?: boolean;
  /** A human (or anyone friendly) has a claim: a human ally close by. */
  humanNear?: boolean;
  /** Hostile to us (an enemy is in it). */
  hostile?: boolean;
  /** On fire: it blows up in a few seconds. */
  burning?: boolean;
  /** Vehicles: going backwards (`speed` is how fast either way). */
  reversing?: boolean;
}

/** The seat a bot is in. */
export interface SeatView {
  mount: number;
  seat: number;
  role: SeatRole;
  weapon?: WeaponDefinition;
  arc?: number;
  /** Where the arc is centred, from the mount's forward (side door guns). */
  facing?: number;
  heat: number;
  overheated: boolean;
}

/** Is `p` inside a seat's firing arc and range from the mount? */
export function inArc(m: MountView, seat: { arc?: number; facing?: number; weapon?: WeaponDefinition }, p: Vec3): boolean {
  const d = horizontalDistance(m.pos, p);
  if (!seat.weapon || d > Math.min(seat.weapon.range, 70)) return false;
  if (seat.arc === undefined) return true;
  const a = Math.atan2(p.x - m.pos.x, p.z - m.pos.z);
  return Math.abs(angleDelta(m.yaw + (seat.facing ?? 0), a)) <= seat.arc * 0.92;
}

/** A free turret worth manning against an enemy at `enemy`, within walking reach of `from`. */
export function turretFor(mounts: readonly MountView[], from: Vec3, enemy: Vec3, reach: number, skip?: (m: MountView) => boolean): MountView | null {
  let best: MountView | null = null;
  let bestD = reach;
  for (const m of mounts) {
    if (!m.alive || m.kind !== 'turret' || m.health < 0.35 || m.hostile || skip?.(m)) continue;
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

/** A free vehicle to drive toward `goal` (a long trip), close to `from`; `skip`: ones the bot won't take (it got stuck in them). */
export function vehicleFor(mounts: readonly MountView[], from: Vec3, goal: Vec3, reach: number, skip?: (m: MountView) => boolean): MountView | null {
  const trip = horizontalDistance(from, goal);
  if (trip < 55) return null;
  let best: MountView | null = null;
  let bestD = reach;
  for (const m of mounts) {
    if (!m.alive || m.kind !== 'vehicle' || m.health < 0.5 || m.humanNear || m.hostile || m.burning || skip?.(m)) continue;
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

/**
 * Bots ride along with a friendly driver: the nearest vehicle (human drivers
 * first) driven by an ally, with a free gunner or passenger seat, within
 * `reach`, and not tearing past too fast to catch.
 */
export function rideFor(mounts: readonly MountView[], from: Vec3, self: number, allies: readonly { slot: number; human?: boolean }[], reach: number, skip?: (m: MountView) => boolean): MountView | null {
  let best: MountView | null = null;
  let bestScore = Infinity;
  for (const m of mounts) {
    if (!m.alive || m.kind !== 'vehicle' || m.health < 0.35 || m.hostile || m.burning || skip?.(m)) continue;
    const by = m.seats.find((s) => s.role === 'driver')?.by;
    if (by === undefined || by === self) continue;
    const driver = allies.find((a) => a.slot === by);
    if (!driver) continue;
    const free = m.seats.filter((s) => s.free && s.role !== 'driver');
    if (!free.length) continue;
    const d = horizontalDistance(m.pos, from) + Math.abs(m.pos.y - from.y) * 3;
    // Not one tearing past; a bot at the wheel won't wait, so only one that is (nearly) stopped or right here.
    const speed = m.speed ?? 0;
    if (d > reach || (speed > 11 && d > 8) || (!driver.human && speed > 2 && d > 6)) continue;
    // A human's ride first, and one with the gun free.
    const score = d - (driver.human ? 10 : 0) - (free.some((s) => s.role === 'gunner') ? 3 : 0);
    if (score < bestScore) {
      best = m;
      bestScore = score;
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
  /** The headway window: where the vehicle was when it started, and when. */
  anchor: Vec3 | null;
  anchorTick: number;
  /** Still stuck right after backing out (or out of back-outs): time to get out. */
  stuck: boolean;
  /** The tick steer() last did its bookkeeping (an armed pilot calls it twice in a tick). */
  tick: number;
}

export const freshDrive = (): DriveState => ({ slow: 0, reverseUntil: 0, unstick: 0, last: null, anchor: null, anchorTick: 0, stuck: false, tick: -1 });

/**
 * Steering toward the next route point: throttle down for sharp turns and
 * near the end. Stuck (next to no movement for STUCK_SLOW_TICKS, or under
 * STUCK_MIN_PROGRESS m of headway over STUCK_WINDOW_TICKS): back out for
 * RECOVER_TICKS, steering the other way. Stuck again within
 * RECOVER_GRACE_TICKS of that (or MAX_RECOVERIES used up): `st.stuck` is set
 * and it stops trying (the driver gets out).
 */
export function steer(st: DriveState, tick: number, m: MountView, aim: Vec3, distLeft: number): { forward: number; right: number } {
  const pos = m.pos;
  const err = angleDelta(m.yaw, Math.atan2(aim.x - pos.x, aim.z - pos.z));
  if (st.stuck) return { forward: 0, right: 0 };
  if (tick < st.reverseUntil) {
    st.last = { ...pos };
    st.anchor = null;
    return { forward: -1, right: clamp(-err * 2, -1, 1) };
  }
  if (st.tick !== tick) {
    st.tick = tick;
    const moved = st.last ? horizontalDistance(pos, st.last) : 1;
    st.last = { ...pos };
    st.slow = moved < 0.01 ? st.slow + 1 : Math.max(0, st.slow - 2);
    let stuck = st.slow > STUCK_SLOW_TICKS;
    if (!st.anchor) {
      st.anchor = { ...pos };
      st.anchorTick = tick;
    } else if (tick - st.anchorTick >= STUCK_WINDOW_TICKS) {
      if (horizontalDistance(pos, st.anchor) < STUCK_MIN_PROGRESS) stuck = true;
      st.anchor = { ...pos };
      st.anchorTick = tick;
    }
    if (stuck) {
      st.slow = 0;
      st.anchor = null;
      // The last back-out ended at reverseUntil: stuck again this soon, it didn't help.
      if ((st.unstick > 0 && tick - st.reverseUntil < RECOVER_GRACE_TICKS) || st.unstick >= MAX_RECOVERIES) {
        st.stuck = true;
        return { forward: 0, right: 0 };
      }
      st.unstick++;
      st.reverseUntil = tick + RECOVER_TICKS;
      return { forward: -1, right: clamp(-err * 2, -1, 1) };
    }
  }
  const right = clamp(err * 2.2, -1, 1);
  let forward = Math.abs(err) > 1.4 ? 0.35 : Math.abs(err) > 0.7 ? 0.6 : 1;
  if (distLeft < 25) forward = Math.min(forward, 0.5);
  return { forward, right };
}

/** About to blow: badly damaged, or on fire. Everyone aboard gets out. */
export const aboutToBlow = (m: MountView): boolean => m.health < BAIL_HEALTH || !!m.burning;

/** A headway window (riders watching a bot driver): where the vehicle was when it opened, and when. */
export interface Headway {
  pos: Vec3 | null;
  tick: number;
}

/**
 * True when the vehicle at `pos` covered under `min` m over the last
 * `window` ticks. The window restarts each time it closes, so this costs a
 * subtraction a tick and a distance every few seconds.
 */
export function noHeadway(h: Headway, pos: Vec3, tick: number, window: number, min: number): boolean {
  if (!h.pos) {
    h.pos = { ...pos };
    h.tick = tick;
    return false;
  }
  if (tick - h.tick < window) return false;
  const stuck = horizontalDistance(pos, h.pos) < min;
  h.pos = { ...pos };
  h.tick = tick;
  return stuck;
}

/** The mount an actor sits in, and which seat, or null. */
export function mountOf(mounts: readonly MountView[], slot: number): { mount: MountView; seat: number } | null {
  for (const m of mounts) {
    if (!m.alive) continue;
    for (let i = 0; i < m.seats.length; i++) if (m.seats[i]!.by === slot) return { mount: m, seat: i };
  }
  return null;
}

/** A weapon that does real damage to vehicles: big splash (rockets, grenade launchers). */
export const antiVehicle = (def: WeaponDefinition): boolean => (def.projectile?.splashDamage ?? 0) >= ANTI_VEHICLE_SPLASH;

/**
 * A vehicle bearing down on `p`: going faster than ROADKILL_SPEED with `p`
 * ahead of it, within ROADKILL_HALF_WIDTH of its line and ROADKILL_LOOKAHEAD
 * seconds. Returns how soon it gets there, which side of its line `p` is on
 * (+1 right, -1 left, as it travels) and the yaw straight out of its path on
 * that side, or null. Arithmetic only (no rays): cheap enough for every bot
 * at decision rate.
 */
export function inVehiclePath(m: MountView, p: Vec3): { eta: number; side: number; away: number } | null {
  const speed = m.speed ?? 0;
  if (!m.alive || m.kind !== 'vehicle' || speed < ROADKILL_SPEED || Math.abs(p.y - m.pos.y) > 3) return null;
  // Backing up, it comes the other way.
  const dir = m.reversing ? -1 : 1;
  const fx = Math.sin(m.yaw) * dir;
  const fz = Math.cos(m.yaw) * dir;
  const dx = p.x - m.pos.x;
  const dz = p.z - m.pos.z;
  const along = dx * fx + dz * fz;
  if (along < 0 || along > speed * ROADKILL_LOOKAHEAD + 3) return null;
  // Right of the way it is going: (fz, -fx).
  const lateral = dx * fz - dz * fx;
  if (Math.abs(lateral) > ROADKILL_HALF_WIDTH) return null;
  const side = lateral >= 0 ? 1 : -1;
  return { eta: along / speed, side, away: Math.atan2(side * fz, -side * fx) };
}

