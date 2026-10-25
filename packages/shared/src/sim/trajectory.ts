import { PLAYER, TICK_DT } from './constants.ts';
import { add, normalize, scale, viewDirection, type Vec3 } from '../math.ts';
import type { ProjectileSpec } from './weapons.ts';

/** A static-world ray test: distance to the first surface and its normal, or null. */
export type RaycastFn = (from: Vec3, dir: Vec3, maxDist: number) => { dist: number; normal: Vec3 } | null;

export interface PredictedPath {
  /** Positions every tick from the hand to where it stops. */
  points: Vec3[];
  /** Where it bounced off walls and floors. */
  bounces: Vec3[];
  /** Where it ends: bursts (fuse, impact or bounce limit), sticks or lands as a mine. */
  end: Vec3;
  /** How it ends. */
  ending: 'burst' | 'stick' | 'mine';
}

/**
 * Where a thrown or lobbed projectile will go if nothing moves into its way,
 * stepped exactly like the match steps projectiles (same tick, gravity, drag
 * and bounce rules), against the level only. The aiming arc for grenades.
 */
export function predictThrow(spec: ProjectileSpec, feet: Vec3, yaw: number, pitch: number, lift: number, raycast: RaycastFn, maxSeconds = 4): PredictedPath {
  const eye = { x: feet.x, y: feet.y + PLAYER.eyeHeight, z: feet.z };
  const aim = lift ? normalize(add(viewDirection(yaw, pitch), { x: 0, y: lift, z: 0 })) : viewDirection(yaw, pitch);
  let pos = add(eye, scale(aim, 0.5));
  let vel = scale(aim, spec.speed);
  let ticksLeft = Math.round(Math.min(spec.fuseSeconds, maxSeconds) / TICK_DT);
  let bounceCount = 0;
  const points: Vec3[] = [pos];
  const bounces: Vec3[] = [];
  while (ticksLeft-- > 0) {
    if (spec.drag) vel = scale(vel, Math.max(0, 1 - spec.drag * TICK_DT));
    vel = { x: vel.x, y: vel.y - spec.gravity * TICK_DT, z: vel.z };
    const delta = scale(vel, TICK_DT);
    const len = Math.hypot(delta.x, delta.y, delta.z);
    const dir = scale(delta, 1 / (len || 1));
    const wall = len > 0 ? raycast(pos, dir, len) : null;
    if (wall) {
      const at = add(pos, scale(dir, Math.max(0, wall.dist - 0.05)));
      points.push(at);
      if (spec.sticky) return { points, bounces, end: add(at, scale(wall.normal, 0.06)), ending: 'stick' };
      if (spec.mine) return { points, bounces, end: add(at, scale(wall.normal, 0.06)), ending: 'mine' };
      if (spec.bounce === undefined) return { points, bounces, end: at, ending: 'burst' };
      const n = wall.normal;
      const vn = vel.x * n.x + vel.y * n.y + vel.z * n.z;
      vel = scale({ x: vel.x - 2 * vn * n.x, y: vel.y - 2 * vn * n.y, z: vel.z - 2 * vn * n.z }, spec.bounce);
      pos = add(at, scale(n, 0.05));
      bounces.push(pos);
      bounceCount++;
      if (spec.maxBounces !== undefined && bounceCount > spec.maxBounces) return { points, bounces, end: pos, ending: 'burst' };
      continue;
    }
    pos = add(pos, delta);
    points.push(pos);
  }
  return { points, bounces, end: pos, ending: 'burst' };
}
