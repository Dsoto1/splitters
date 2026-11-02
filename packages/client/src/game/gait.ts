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

/**
 * Authored clip locomotion (a look's clip set, `clips`: tools/content/clip-set.mjs): each loop's natural ground speed
 * (m/s at body scale 1, measured from its planted foot), its length (s) and where its left foot goes down (0..1).
 */
export interface ClipLoop {
  speed: number;
  seconds: number;
  footDown: number;
}

/**
 * The forward clip gait's weights: the walk below its own natural speed, the run from RUN_SHARE_FULL of the run's,
 * linear between (both play at one cycle rate, see clipCycleRate).
 */
export const RUN_SHARE_FULL = 0.8;
export function clipGaitWeights(speed: number, walk: number, run: number): { walk: number; run: number } {
  const full = Math.max(walk + 0.1, run * RUN_SHARE_FULL);
  const r = clamp01((speed - walk) / (full - walk));
  return { walk: 1 - r, run: r };
}

/**
 * The clip set's upper body going forward, from the legs' walk/run split (clipGaitWeights): the shooting walk takes
 * the walk's share and the running shot the run's, in step with the legs; a set with only one of them gives it all.
 */
export function clipUpperWeights(legs: { walk: number; run: number }, has: { fwd: boolean; run: boolean }): { fwd: number; run: number } {
  const all = legs.walk + legs.run;
  if (has.fwd && has.run) return { fwd: legs.walk, run: legs.run };
  return { fwd: has.fwd ? all : 0, run: has.run ? all : 0 };
}

/** Cycles per second that keep the planted foot still at `speed` for loops blended by `weights` (gaitCycleRate for clip loops). */
export function clipCycleRate(speed: number, loops: readonly { loop: ClipLoop; weight: number }[], scale = 1): number {
  let dist = 0;
  let total = 0;
  for (const { loop, weight } of loops) {
    if (weight <= 0 || !loop.seconds) continue;
    dist += weight * loop.speed * loop.seconds * scale;
    total += weight;
  }
  return total > 0 && dist > 0 ? speed / (dist / total) : 0;
}

/** Most a clip's cadence is raised (times its own) before its stride lengthens instead, and the longest stride (times its own). */
export const STRIDE_MAX_RATE = 2;
export const STRIDE_MAX_GAIN = 2.2;

/**
 * Stride warping: a loop authored for `natural` m/s played at `speed`. Up to STRIDE_MAX_RATE times its cadence it
 * simply plays faster (`rate` = its speedRatio, `gain` 1); past that the legs swing further (`gain`: the thighs' and
 * knees' swing about the loop's own middle pose is scaled by it, up to STRIDE_MAX_GAIN) so the steps stay a believable
 * pace: a slow combat backstep at a full backpedal's speed takes longer steps rather than seven a second.
 */
export function strideWarp(speed: number, natural: number, scale = 1, maxRate = STRIDE_MAX_RATE, maxGain = STRIDE_MAX_GAIN): { rate: number; gain: number } {
  const ratio = natural > 0 ? speed / (natural * scale) : 0;
  if (ratio <= maxRate) return { rate: ratio, gain: 1 };
  const gain = Math.min(maxGain, ratio / maxRate);
  return { rate: ratio / gain, gain };
}

/** Where (0..1) a clip loop should start to put its left foot down with another's at `phase` of its loop. */
export function matchClipPhase(from: ClipLoop, phase: number, to: ClipLoop): number {
  const p = phase - from.footDown + to.footDown;
  return p - Math.floor(p);
}
