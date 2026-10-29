/**
 * Disc Arena (Ricochet-style): everyone throws arena discs that bounce off
 * walls and drop where they stop, to be picked up again by whoever gets there
 * first, like ammo. A disc does no damage; it shoves whoever it hits, and
 * a player who falls into the void after a hit is a point for the thrower.
 * Power discs (pickups) change the next few throws.
 *
 * Pure helpers; the match runs the discs as ordinary projectiles with a
 * `disc` spec (see ProjectileSpec.disc).
 */
import type { Vec3 } from '../math.ts';
import { BUTTON_JUMP, type PlayerInput } from './movement.ts';
import type { ProjectileSpec } from './weapons.ts';

export const DISC_POWERS = ['fast', 'triple', 'split', 'freeze'] as const;
export type DiscPower = (typeof DISC_POWERS)[number];

export const DISC_POWER_LABELS: Record<DiscPower, string> = {
  fast: 'Fast Discs',
  triple: 'Triple Discs',
  split: 'Splitting Discs',
  freeze: 'Freeze Discs',
};

/** Throws a power disc pickup is good for. */
export const DISC_POWER_SHOTS = 3;
/** Discs don't shove anyone this soon after they spawn (or the round starts). */
export const DISC_SPAWN_GUARD_SECONDS = 2;
/** A fall into the void this soon after a disc hit scores for the thrower. */
export const DISC_KNOCK_CREDIT_SECONDS = 6;
/** Yaw between the discs of a triple throw (radians). */
export const TRIPLE_SPREAD = 0.2;
/** The weapon everyone holds in Disc Arena. */
export const ARENA_DISC = 'core.arena_disc';

/**
 * The discs one throw makes: the spec of each and its yaw off the aim. The
 * first is the thrown disc (it drops to be picked up); any others are extras
 * that just fly out.
 */
export function discThrows(spec: ProjectileSpec, power: DiscPower | null): { spec: ProjectileSpec; yaw: number }[] {
  const disc = spec.disc ?? { push: 10, lift: 4 };
  switch (power) {
    case 'fast':
      return [{ spec: { ...spec, speed: spec.speed * 1.7, disc: { ...disc, push: disc.push * 1.15 } }, yaw: 0 }];
    case 'triple':
      return [0, -TRIPLE_SPREAD, TRIPLE_SPREAD].map((yaw) => ({ spec, yaw }));
    case 'split':
      return [{ spec: { ...spec, disc: { ...disc, split: true } }, yaw: 0 }];
    case 'freeze':
      // Freezes whoever it hits solid for a moment (a sitting duck for the next disc), with only a nudge.
      return [{ spec: { ...spec, disc: { push: disc.push * 0.35, lift: 1 }, status: { kind: 'chill', seconds: 2, amount: 1 } }, yaw: 0 }];
    default:
      return [{ spec, yaw: 0 }];
  }
}

/** The extra discs a splitting disc becomes at its first bounce: its velocity turned either way. */
export function splitVelocities(vel: Vec3): Vec3[] {
  return [-0.45, 0.45].map((a) => ({ x: vel.x * Math.cos(a) - vel.z * Math.sin(a), y: vel.y, z: vel.x * Math.sin(a) + vel.z * Math.cos(a) }));
}

/**
 * Seconds until a disc passes closest to a point, and how close it gets
 * (straight-line flight), or null when it is flying away.
 */
export function discApproach(pos: Vec3, vel: Vec3, target: Vec3): { t: number; miss: number } | null {
  const rx = target.x - pos.x;
  const ry = target.y - pos.y;
  const rz = target.z - pos.z;
  const v2 = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
  if (v2 < 1e-6) return null;
  const t = (rx * vel.x + ry * vel.y + rz * vel.z) / v2;
  if (t <= 0) return null;
  const dx = pos.x + vel.x * t - target.x;
  const dy = pos.y + vel.y * t - target.y;
  const dz = pos.z + vel.z * t - target.z;
  return { t, miss: Math.hypot(dx, dy, dz) };
}

/**
 * A bot sidesteps (and hops) out of the way of an enemy disc about to hit it,
 * toward whichever side still has floor under it. `floorAt` says whether
 * there is ground a step away at a point. Returns whether it dodged.
 */
export function dodgeDisc(input: PlayerInput, self: { pos: Vec3; yaw: number; grounded: boolean }, discs: readonly { pos: Vec3; vel: Vec3 }[], floorAt: (p: Vec3) => boolean): boolean {
  const chest = { x: self.pos.x, y: self.pos.y + 1, z: self.pos.z };
  let threat: { pos: Vec3; vel: Vec3 } | null = null;
  for (const d of discs) {
    const a = discApproach(d.pos, d.vel, chest);
    if (a && a.t < 0.7 && a.miss < 1.6) {
      threat = d;
      break;
    }
  }
  if (!threat) return false;
  // Sideways across the disc's path: try the side away from where it is heading first.
  const h = Math.hypot(threat.vel.x, threat.vel.z) || 1;
  const side = { x: -threat.vel.z / h, z: threat.vel.x / h };
  const toMe = { x: chest.x - threat.pos.x, z: chest.z - threat.pos.z };
  const pref = side.x * toMe.x + side.z * toMe.z >= 0 ? 1 : -1;
  for (const s of [pref, -pref]) {
    const step = { x: chest.x + side.x * s * 2, y: self.pos.y, z: chest.z + side.z * s * 2 };
    if (!floorAt(step)) continue;
    // Movement input is relative to the bot's facing: right is (cos yaw, -sin yaw).
    const right = side.x * s * Math.cos(self.yaw) - side.z * s * Math.sin(self.yaw);
    const fwd = side.x * s * Math.sin(self.yaw) + side.z * s * Math.cos(self.yaw);
    input.right = Math.max(-1, Math.min(1, right * 1.4));
    input.forward = Math.max(-1, Math.min(1, fwd * 1.4));
    if (self.grounded) input.buttons |= BUTTON_JUMP;
    return true;
  }
  // Nowhere to step: hop and hope it passes under.
  if (self.grounded) input.buttons |= BUTTON_JUMP;
  return true;
}

/**
 * Keep a bot on its deck: if this tick's walking would carry it over an
 * edge (no floor a step ahead), it stops instead. In the air it leaves a jump
 * pad's flight alone, and when knocked out over the void it steers back
 * against the shove, as a player would. Returns whether it changed the input.
 */
export function keepOnDeck(input: PlayerInput, self: { pos: Vec3; grounded: boolean; vx?: number; vz?: number; padFlight?: boolean }, floorAt: (p: Vec3) => boolean): boolean {
  if (!self.grounded && self.padFlight) {
    input.forward = 0;
    input.right = 0;
    return true;
  }
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  const push = Math.hypot(self.vx ?? 0, self.vz ?? 0);
  if (!self.grounded && push > 1 && !floorAt(self.pos)) {
    // Knocked out over the void: run back the way the shove came from.
    const bx = -(self.vx ?? 0) / push;
    const bz = -(self.vz ?? 0) / push;
    input.forward = bx * sin + bz * cos;
    input.right = bx * cos - bz * sin;
    return true;
  }
  if (!input.forward && !input.right) return false;
  const wx = sin * input.forward + cos * input.right;
  const wz = cos * input.forward - sin * input.right;
  const len = Math.hypot(wx, wz);
  if (len < 0.05) return false;
  for (const reach of [0.7, 1.4]) {
    if (!floorAt({ x: self.pos.x + (wx / len) * reach, y: self.pos.y, z: self.pos.z + (wz / len) * reach })) {
      input.forward = 0;
      input.right = 0;
      return true;
    }
  }
  return false;
}
