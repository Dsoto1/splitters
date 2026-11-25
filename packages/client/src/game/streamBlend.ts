import type { Vec3 } from '@tiletrigger/shared';
import { following, type MuzzleAnchor } from './muzzleAnchor.ts';

/**
 * Projectile streams (the flamethrower's flame, goo, bubbles, plasma, oil) and every projectile gun's shot (the Blaster
 * X-42's bolts, arrows, nails, rockets, shards…: shared STREAM_VISUALS) leave the shooter's muzzle as drawn now, then blend into where the host has them.
 *
 * Why (found with the beam fix, 2026-11-16): a projectile is drawn from the snapshots, about 100 ms in the past
 * (interpolation.ts), and the host fires it from the shooter's eye. A stream fires several a second, so while you
 * strafed or turned the whole stream came out of the eye of 100 ms before, a metre to the side at a run, and trailed
 * behind your gun. As the beams do (muzzleAnchor.ts), the start follows the live muzzle; unlike a beam a stream's
 * pieces fly on, so each piece carries the offset from where the host first had it to the muzzle, eased out over its
 * first STREAM_BLEND_MS: on the muzzle when it appears, on the host's path (where it hits) from then on.
 */
export const STREAM_BLEND_MS = 250;

/** How much of the muzzle offset a piece this old carries: 1 when it appears, easing to 0 at STREAM_BLEND_MS. */
export function streamWeight(ageMs: number): number {
  if (ageMs <= 0) return 1;
  if (ageMs >= STREAM_BLEND_MS) return 0;
  const t = ageMs / STREAM_BLEND_MS;
  return 1 - t * t * (3 - 2 * t);
}

/** One stream piece: where the host first had it, the muzzle it left, when it appeared (ms). */
export interface StreamStart {
  from: Vec3;
  muzzle: () => Vec3;
  born: number;
}

/** A stream piece first seen at `from` (its sampled place), leaving `anchor`'s muzzle (null: none to follow). */
export function streamStart(from: Vec3, anchor: MuzzleAnchor | null, born: number): StreamStart {
  return { from: { ...from }, muzzle: following(from, anchor), born };
}

/**
 * Where to draw a stream piece the host has at `at` now: `at` plus the offset from where it first was to the
 * muzzle, by its age's weight. Writes into `out` and returns it.
 */
export function streamPoint(s: StreamStart, at: Vec3, now: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const w = streamWeight(now - s.born);
  if (w <= 0) {
    out.x = at.x;
    out.y = at.y;
    out.z = at.z;
    return out;
  }
  const m = s.muzzle();
  out.x = at.x + (m.x - s.from.x) * w;
  out.y = at.y + (m.y - s.from.y) * w;
  out.z = at.z + (m.z - s.from.z) * w;
  return out;
}
