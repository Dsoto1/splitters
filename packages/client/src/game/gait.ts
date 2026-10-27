/**
 * Forward locomotion as one blended gait: the walk, run and sprint loops play
 * together, phase-locked (left foot down at the same moment in all three) and
 * weighted by speed, at the rate that keeps the planted foot still on the
 * ground. Pure maths, no Babylon, so it can be tested on its own.
 *
 * The numbers are measured from the clips in rig.glb (planted-foot speed and
 * where in the loop the left foot lands); test/gait.test.ts measures them
 * again from the file, so a re-exported rig can't silently drift from them.
 */

export type GaitClip = 'walk' | 'run' | 'sprint';
export const GAIT_CLIPS: readonly GaitClip[] = ['walk', 'run', 'sprint'];

/** Per loop: ground speed (m/s at body scale 1) at which the planted foot stays still at speedRatio 1, and the left foot's touchdown as a fraction of the loop. */
export const GAIT: Record<GaitClip, { speed: number; footDown: number }> = {
  walk: { speed: 0.95, footDown: 0.1 },
  run: { speed: 5.9, footDown: 0.05 },
  sprint: { speed: 9.0, footDown: 0.07 },
};

/** Below this speed the gait is all walk, above RUN_FULL all run (linear between, by speed). */
export const WALK_FULL = 1.2;
export const RUN_FULL = 3.6;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Weights of the three loops at a ground speed, with `sprint` (0..1, faded by the caller) taking over from the run. */
export function gaitWeights(speed: number, sprint: number): Record<GaitClip, number> {
  const run = clamp01((speed - WALK_FULL) / (RUN_FULL - WALK_FULL));
  const s = clamp01(sprint);
  return { walk: (1 - run) * (1 - s), run: run * (1 - s), sprint: s };
}

/**
 * Loops per second that keep the feet planted: ground speed over the blended
 * distance one loop covers (`seconds` is each clip's loop length, `scale` the
 * body's size). Every loop plays at this many cycles per second, so they stay
 * in step however they are weighted.
 */
export function gaitCycleRate(speed: number, weights: Record<GaitClip, number>, seconds: Record<GaitClip, number>, scale = 1): number {
  let dist = 0;
  let total = 0;
  for (const c of GAIT_CLIPS) {
    const w = weights[c];
    if (w <= 0 || !seconds[c]) continue;
    dist += w * GAIT[c].speed * seconds[c] * scale;
    total += w;
  }
  if (total <= 0 || dist <= 0) return 0;
  return speed / (dist / total);
}

/** Where (0..1 of its loop) a clip should be to match another at `phase` of its own loop: both left feet down together. */
export function matchPhase(from: GaitClip, phase: number, to: GaitClip): number {
  const p = phase - GAIT[from].footDown + GAIT[to].footDown;
  return p - Math.floor(p);
}
