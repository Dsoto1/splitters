import { lookAngles, viewDirection, type Vec3 } from '../math.ts';

/**
 * Third-person view on foot: the camera sits over the right shoulder, behind
 * and a little above the eye, and the crosshair is the middle of that view.
 * Rounds still leave from the eye (so cover in front of the body protects it
 * as in first person), but toward what the crosshair is on: the point the
 * camera's centre ray meets (GUNPLAY: "your rounds go where the crosshair
 * points"). Without it, crouched behind low cover the camera saw over the wall
 * while the rounds, sent along the view direction from the lower eye, went
 * into it. The client draws the view with thirdPersonCamera; the host works
 * out the same aim itself (thirdPersonAim) when an input carries
 * BUTTON_THIRD_PERSON: nothing about the aim point is taken from the client.
 */

/** Camera offset from the eye: this far back along the view, to the right and up (m). */
export const TP_BACK = 3;
export const TP_SIDE = 0.6;
export const TP_UP = 0.35;
/** Pulled in this far short of a wall behind the player, never closer than TP_MIN. */
const TP_WALL_GAP = 0.25;
const TP_MIN = 0.3;
/** How far the crosshair ray looks for something to converge on (m); past that, a point this far out. */
export const TP_AIM_REACH = 400;
/** A crosshair point less than this far in front of the eye (along the view) can't be aimed at from it: shoot along the view. */
const TP_AIM_MIN_AHEAD = 0.5;

/** A ray query: distance along a normalised ray to the first thing it meets, or null within maxDist. */
export type RayQuery = (origin: Vec3, dir: Vec3, maxDist: number) => number | null;

/**
 * The third-person camera for an eye and a view (yaw, pitch): its position,
 * and how far it is from the eye (`dist` < TP_BACK-ish when a wall pulled it
 * in). `world` casts against level geometry (PhysicsWorld.raycastWorld).
 */
export function thirdPersonCamera(world: RayQuery, eye: Vec3, yaw: number, pitch: number): { pos: Vec3; dist: number } {
  const fwd = viewDirection(yaw, pitch);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const ox = -fwd.x * TP_BACK + rx * TP_SIDE;
  const oy = -fwd.y * TP_BACK + TP_UP;
  const oz = -fwd.z * TP_BACK + rz * TP_SIDE;
  const len = Math.hypot(ox, oy, oz);
  const dir = { x: ox / len, y: oy / len, z: oz / len };
  const hit = world(eye, dir, len);
  const d = hit === null ? len : Math.max(TP_MIN, hit - TP_WALL_GAP);
  return { pos: { x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d }, dist: d };
}

/**
 * Where a round fired in third person goes: the yaw and pitch from the eye to
 * the point the crosshair (the camera's centre ray) is on. `world` finds
 * level geometry; `bodies`, when given, the players and creatures the
 * shooter could hit (the host passes them as the shooter saw them, lag
 * compensated). A point behind or right in front of the eye: along the view.
 */
export function thirdPersonAim(world: RayQuery, eye: Vec3, yaw: number, pitch: number, bodies?: RayQuery): { yaw: number; pitch: number } {
  const cam = thirdPersonCamera(world, eye, yaw, pitch).pos;
  const fwd = viewDirection(yaw, pitch);
  let t = world(cam, fwd, TP_AIM_REACH) ?? TP_AIM_REACH;
  const b = bodies?.(cam, fwd, t);
  if (b !== null && b !== undefined && b < t) t = b;
  const p = { x: cam.x + fwd.x * t, y: cam.y + fwd.y * t, z: cam.z + fwd.z * t };
  const ahead = (p.x - eye.x) * fwd.x + (p.y - eye.y) * fwd.y + (p.z - eye.z) * fwd.z;
  if (ahead < TP_AIM_MIN_AHEAD) return { yaw, pitch };
  return lookAngles(eye, p);
}
