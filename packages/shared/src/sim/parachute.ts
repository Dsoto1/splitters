import type { Vec3 } from '../math.ts';
import type { PhysicsWorld } from './physics.ts';

/**
 * Parachutes and gliders. Anyone falling from height (off a flyer, a cliff
 * or out of the transport plane) can open a canopy: hold jump in the air,
 * falling, at least CHUTE.minHeight above the ground. A parachute slows the
 * fall right down and steers gently; a glider (picked up as an item) sinks
 * slower still and flies forward fast, so you can cross the map on it.
 * Crouch cuts it away; it packs itself up when you land, swim or catch a
 * ladder. Jumping out of the plane (or a flyer, high up) arms the automatic
 * opener, which pulls the cord at CHUTE.autoHeight if you haven't; bots
 * always have it armed. Landing under a canopy never hurts.
 *
 * Pure numbers plus one downward ray, run inside stepMovement, so client
 * prediction reproduces it exactly.
 */
export const CHUTE = {
  /** Lowest height above the ground (m) a canopy can be opened at. */
  minHeight: 5,
  /** Falling at least this fast (m/s) before it can open (so a jump held from the ground doesn't). */
  armSpeed: 3,
  /** Parachute: steady sink rate and steering speed (m/s). */
  sink: 4,
  steer: 5.5,
  /** Glider: sink rate, forward speed (W speeds it up, S brakes) and sideways steering (m/s). */
  glideSink: 2.4,
  glideSpeed: 15,
  glideSteer: 4,
  /** How quickly the fall settles to the canopy's sink rate (per second): a canopy bites hard. */
  settle: 7,
  /** Automatic opener: falling faster than autoSpeed with the ground within autoHeight. */
  autoHeight: 28,
  autoSpeed: 9,
} as const;

/** MoveState.chute values. */
export const CHUTE_PARACHUTE = 1;
export const CHUTE_GLIDER = 2;
export type ChuteKind = typeof CHUTE_PARACHUTE | typeof CHUTE_GLIDER;

/** Height of the ground under `feet` (distance down), or null when it is further than `max`. */
export function heightAboveGround(physics: PhysicsWorld, feet: Vec3, max: number): number | null {
  const d = physics.raycastWorld({ x: feet.x, y: feet.y + 0.05, z: feet.z }, { x: 0, y: -1, z: 0 }, max + 0.05);
  return d === null ? null : Math.max(0, d - 0.05);
}

/**
 * Should a canopy open this tick? `pull`: jump held (manual); `auto`: the
 * automatic opener is armed. Only in the air, falling, high enough.
 */
export function wantsChute(physics: PhysicsWorld, feet: Vec3, velY: number, pull: boolean, auto: boolean): boolean {
  if (velY > -CHUTE.armSpeed) return false;
  if (pull) return heightAboveGround(physics, feet, CHUTE.minHeight) === null;
  if (!auto || velY > -CHUTE.autoSpeed) return false;
  const h = heightAboveGround(physics, feet, CHUTE.autoHeight);
  return h !== null && h > CHUTE.minHeight * 0.6;
}

/** Vertical speed after one tick under a canopy (settling toward its sink rate). */
export function chuteVelY(velY: number, kind: ChuteKind, dt: number): number {
  const sink = -(kind === CHUTE_GLIDER ? CHUTE.glideSink : CHUTE.sink);
  return velY + (sink - velY) * Math.min(1, CHUTE.settle * dt);
}

/**
 * Horizontal velocity under a canopy from the player's input (yaw frame as
 * in stepMovement): a parachute drifts where you steer; a glider always
 * flies forward along your view.
 */
export function chuteWish(kind: ChuteKind, yaw: number, forward: number, right: number): { x: number; z: number } {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  if (kind === CHUTE_GLIDER) {
    const speed = CHUTE.glideSpeed * (forward > 0.3 ? 1.2 : forward < -0.3 ? 0.55 : 1);
    return { x: sin * speed + cos * right * CHUTE.glideSteer, z: cos * speed - sin * right * CHUTE.glideSteer };
  }
  let x = sin * forward + cos * right;
  let z = cos * forward - sin * right;
  const l = Math.hypot(x, z);
  if (l > 1) {
    x /= l;
    z /= l;
  }
  return { x: x * CHUTE.steer, z: z * CHUTE.steer };
}
