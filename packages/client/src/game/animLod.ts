/**
 * Character animation LOD (docs/PERF_96.md, "Market Town on an M1 Pro", "Performance round 4"): how often a character
 * in view is animated (its clips sampled, bones, aim and grip worked out), how much of the after-clip work it gets,
 * and whether the frames between evaluations are smoothed. Pure, so it is tested on its own (client/test/animLod.test.ts).
 *
 * Round 4 judges by **size on screen**, a standing character's height as a share of the view's (ragdollBudget's
 * screenShare: the distance and the field of view, so a scope brings far characters back to a full rate), and smooths
 * every reduced rate: between evaluations the skin is drawn part way from the one before the last evaluated pose to the
 * last (CharacterAnimator's pose blend), so a far character's run is fluid instead of stepping 8-20 times a second. At
 * the usual field of view: every frame to about 15 m (the fingers kept from 8 m), then 30 Hz to 25 m, 20 Hz to 40 m,
 * 15 Hz to 80 m, 10 Hz to 150 m and 5 Hz past it, each smoothed: at every distance to 150 m at least round 2's rate,
 * reduced rates pushed out (20 Hz from 35 to 40 m, 12 Hz from 70 to 80 m, 8 Hz now 10 Hz to 150 m), and none of them
 * stepping. It pays with the coarse after-clip detail from 25 m (round 2: 35 m), where the arm IK and hand turns were
 * most of a crowd's animation time; on the character bench (56 running, 5-60 m) a frame's animation is about a fifth
 * cheaper than round 2's while evaluating a tenth more often.
 *
 * The rate is the slower of two rules: a time step and a frame step (every 2nd, 4th, 6th, 12th frame). On a slow frame
 * (25-40 fps, a busy fight on a laptop) the time step alone was due every frame, so the LOD saved nothing just when it
 * was needed most, and the frame step keeps the saving.
 * Round 2 (docs/PERF_96.md, "Performance round 2") stepped by distance, unsmoothed (20 Hz at 15-35 m, 12 Hz at 35-70 m,
 * 8 Hz beyond; `?perfoff=animlod4` brings it back for measuring against), and round 1 more often still
 * (`?perfoff=animlod2`: 30 / 15 / 10 Hz).
 */

/** Round 2's distance bands (m): nearer than ANIM_LOD_FULL every frame; 12 Hz and the coarse detail past ANIM_LOD_NEAR; 8 Hz past ANIM_LOD_FAR. */
export const ANIM_LOD_FULL = 15;
export const ANIM_LOD_NEAR = 35;
export const ANIM_LOD_FAR = 70;

/**
 * Round 4's bands: the share of the view's height a standing character (1.8 m) fills. With the game's field of view
 * (1.35 rad vertical) a share is 1.125 / distance: 0.14 at 8 m, 0.075 at 15 m, 0.045 at 25 m, 0.028 at 40 m, 0.014 at
 * 80 m, 0.0075 at 150 m. On a 1080p screen a character at 0.028 is about 30 pixels tall.
 */
/** Bigger than this (nearer than about 8 m): every frame with the full after-clip detail. */
export const ANIM_SHARE_FINE = 0.14;
/** Bigger than this (8-15 m): every frame, the fingers kept from their last full close. */
export const ANIM_SHARE_FULL = 0.075;
/** Bigger than this (15-25 m): 30 Hz, smoothed. */
export const ANIM_SHARE_MID = 0.045;
/** Bigger than this (25-40 m): 20 Hz smoothed, and the coarse after-clip detail from here on. */
export const ANIM_SHARE_NEAR = 0.028;
/** Bigger than this (40-80 m): 15 Hz; smaller (80-150 m), 10 Hz. */
export const ANIM_SHARE_FAR = 0.014;
/** Smaller than this (a figure a dozen pixels tall, past 150 m): 5 Hz, smoothed. */
export const ANIM_SHARE_TINY = 0.0075;

export interface AnimStep {
  /** Least time between evaluations (ms); 0 every frame. */
  ms: number;
  /** Least frames between evaluations; 1 every frame. */
  frames: number;
  /**
   * After-clip detail: `full` closes each hand's fingers on the gun afresh every evaluation; `cached` puts back the
   * finger pose of the last full close of the same grip (the fingers barely move on a held gun, and past the full band
   * a finger is a pixel or two), and leaves the clips' finger tracks of a hand so posed unsampled; the aim, arm IK and
   * the gun in the hands are worked out as near. `coarse` (past the near band, where a character is some 30 pixels
   * tall) keeps the aim pitch on the spine but leaves out the refinement: no arm IK or measured hand turns, no stock
   * fitting against the chest or head, no stride warp; the gun rides in the right hand as the last full grip held it,
   * and the fingers keep their last full close.
   */
  detail: 'full' | 'cached' | 'coarse';
  /** Smooth the frames between evaluations: the skin and the held gun drawn between the last two evaluated poses. */
  smooth: boolean;
}

/** Every frame, full detail (near characters, your own body, a death). */
export const EVERY_FRAME: AnimStep = { ms: 0, frames: 1, detail: 'full', smooth: false };
/** Every frame, the fingers kept from their last full close (8-20 m: a finger is a few pixels). */
const NEAR: AnimStep = { ms: 0, frames: 1, detail: 'cached', smooth: false };
const MID: AnimStep = { ms: 1000 / 30, frames: 2, detail: 'cached', smooth: true };
const OUTER: AnimStep = { ms: 1000 / 20, frames: 3, detail: 'coarse', smooth: true };
const FAR: AnimStep = { ms: 1000 / 15, frames: 4, detail: 'coarse', smooth: true };
const FARTHEST: AnimStep = { ms: 100, frames: 6, detail: 'coarse', smooth: true };
const TINY: AnimStep = { ms: 200, frames: 12, detail: 'coarse', smooth: true };
/** Round 2's steps (`?perfoff=animlod4`). */
const MID_2: AnimStep = { ms: 1000 / 20, frames: 3, detail: 'cached', smooth: false };
const FAR_2: AnimStep = { ms: 1000 / 12, frames: 4, detail: 'coarse', smooth: false };
const FARTHEST_2: AnimStep = { ms: 125, frames: 5, detail: 'coarse', smooth: false };
/** Round 1's steps (`?perfoff=animlod2`). */
const MID_1: AnimStep = { ms: 1000 / 30, frames: 2, detail: 'cached', smooth: false };
const FAR_1: AnimStep = { ms: 1000 / 15, frames: 3, detail: 'cached', smooth: false };
const FARTHEST_1: AnimStep = { ms: 100, frames: 4, detail: 'cached', smooth: false };

/** How a character filling `share` of the view's height is animated (round 4). */
export function animStepByShare(share: number): AnimStep {
  if (share >= ANIM_SHARE_FULL) return share >= ANIM_SHARE_FINE ? EVERY_FRAME : NEAR;
  return share >= ANIM_SHARE_MID ? MID : share >= ANIM_SHARE_NEAR ? OUTER : share >= ANIM_SHARE_FAR ? FAR : share >= ANIM_SHARE_TINY ? FARTHEST : TINY;
}

/**
 * How a character in view at `dist` m (from the camera, across the ground) was animated by distance alone: round 2
 * (`round2` true) or round 1. Kept for the switches that measure against them.
 */
export function animStep(dist: number, round2 = true): AnimStep {
  if (!round2) return dist > ANIM_LOD_FAR ? FARTHEST_1 : dist > ANIM_LOD_NEAR ? FAR_1 : dist > ANIM_LOD_FULL ? MID_1 : EVERY_FRAME;
  return dist > ANIM_LOD_FAR ? FARTHEST_2 : dist > ANIM_LOD_NEAR ? FAR_2 : dist > ANIM_LOD_FULL ? MID_2 : EVERY_FRAME;
}

/** Remote shooting overlays (the recoil twitch of a shot) are left out past this (m): a pixel or two of movement. */
export const SHOT_OVERLAY_REACH = ANIM_LOD_NEAR;

/**
 * Where between the last two evaluated poses (0: the one before, 1: the last) a smoothed character is drawn at `now`:
 * as far past the last evaluation as the gap between the two, so the pose it shows runs one step behind the clips and
 * arrives at the last evaluation just as the next one is due. A gap longer than `maxGapMs` (a character just come
 * into a smoothed band, or back in view) shows the last pose as it is.
 */
export function blendAt(now: number, prev: number, last: number, maxGapMs = 400): number {
  const gap = last - prev;
  if (!(gap > 0) || gap > maxGapMs) return 1;
  return Math.max(0, Math.min(1, (now - last) / gap));
}

/**
 * The step gate of one character: due when both its time and its frame step have passed since its last evaluation.
 * `phase` (ms, and as a whole number of frames) spreads a crowd's steps over frames; the first evaluation in a
 * stepped band is at once.
 */
export class StepClock {
  private nextMs = 0;
  private nextFrame = 0;

  /** Whether frame `frame` at `now` (ms) evaluates under `step`; resets to every frame for a 1-frame step. */
  due(now: number, frame: number, step: AnimStep, phase = 0): boolean {
    if (step.ms <= 0 && step.frames <= 1) {
      this.nextMs = 0;
      this.nextFrame = 0;
      return true;
    }
    if (now < this.nextMs || frame < this.nextFrame) return false;
    // On the character's own phase (in time and in frames), so a crowd's evaluations spread over frames.
    // The next point of its time grid after now (a little slack: frame times land on the grid give or take rounding).
    this.nextMs = step.ms > 0 ? phase + (Math.floor((now - phase) / step.ms + 1e-6) + 1) * step.ms - 0.5 : 0;
    const f = Math.max(1, step.frames);
    this.nextFrame = frame + f - ((((frame + Math.round(phase)) % f) + f) % f);
    return true;
  }
}
