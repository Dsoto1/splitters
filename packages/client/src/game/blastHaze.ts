/**
 * A blast's smoke seen from inside (owner, 2026-11-27: inside an explosion the room's walls and floor seemed to vanish).
 * The blast's own cards fade near the camera (godotVfx.ts NEAR_FADE) and, instead, the view hazes over a little in a
 * dark grey (view.ts updateSmokeFog, with smoke grenades' haze): eased in and out, never brighter than the smoke, the
 * walls still showing through (docs/LOOK.md, "Reduce flashing").
 */

/**
 * How far round a blast's fireball the haze reaches (times its drawn size), how long it lasts (s), its strongest (of a
 * smoke grenade's full haze), and how fast it comes up with Reduce flashing on (a share a second; 1.5 off, as smoke
 * grenades').
 */
export const BLAST_HAZE = { reach: 1.6, seconds: 1.6, max: 0.3, calmRise: 0.8 } as const;

/** A blast's smoke: its middle, how far it reaches (m) and when it went off (ms). */
export interface BlastSmoke {
  x: number;
  y: number;
  z: number;
  radius: number;
  born: number;
}

/** How deep in blasts' smoke `eye` is at `now` (0..BLAST_HAZE.max): deepest at the middle, thinning over its last half. */
export function blastHazeDepth(eye: { x: number; y: number; z: number }, blasts: readonly BlastSmoke[], now: number): number {
  let deep = 0;
  for (const b of blasts) {
    const life = (now - b.born) / (BLAST_HAZE.seconds * 1000);
    if (life < 0 || life >= 1) continue;
    const thin = life < 0.5 ? 1 : 1 - (life - 0.5) * 2;
    const d = Math.hypot(eye.x - b.x, eye.y - b.y, eye.z - b.z) / b.radius;
    deep = Math.max(deep, Math.max(0, Math.min(1, (1 - d) * 2)) * thin * BLAST_HAZE.max);
  }
  return deep;
}
