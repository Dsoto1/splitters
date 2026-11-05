/**
 * Character animation LOD (docs/PERF_96.md, "Market Town on an M1 Pro"): how often a character in view is
 * animated (its clips sampled, bones, aim and grip worked out) and how much of the after-clip work it gets, by its
 * distance from the camera. Pure, so it is tested on its own (client/test/animLod.test.ts).
 *
 * The rate is the slower of two rules: a time step (30 Hz at 15-35 m, 15 Hz at 35-70 m, 10 Hz beyond) and a frame
 * step (every 2nd, 3rd, 4th frame). At 60 fps the time step decides, as before; on a slow frame (25-40 fps, a busy
 * fight on a laptop) the time step alone was due every frame, so the LOD saved nothing just when it was needed most,
 * and the frame step keeps the saving.
 */

/** Nearer than this (m): every frame, full detail. */
export const ANIM_LOD_FULL = 15;
/** 15 Hz past this (m). */
export const ANIM_LOD_NEAR = 35;
/** 10 Hz past this (m). */
export const ANIM_LOD_FAR = 70;

export interface AnimStep {
  /** Least time between evaluations (ms); 0 every frame. */
  ms: number;
  /** Least frames between evaluations; 1 every frame. */
  frames: number;
  /**
   * After-clip detail: `full` closes each hand's fingers on the gun afresh every evaluation; `cached` puts back the
   * finger pose of the last full close of the same grip (the fingers barely move on a held gun, and past ANIM_LOD_FULL
   * a finger is a pixel or two). Everything else (aim, arm IK, the gun in the hands) is worked out at every distance.
   */
  detail: 'full' | 'cached';
}

/** Every frame, full detail (near characters, your own body, a death). */
export const EVERY_FRAME: AnimStep = { ms: 0, frames: 1, detail: 'full' };
const MID: AnimStep = { ms: 1000 / 30, frames: 2, detail: 'cached' };
const FAR: AnimStep = { ms: 1000 / 15, frames: 3, detail: 'cached' };
const FARTHEST: AnimStep = { ms: 100, frames: 4, detail: 'cached' };

/** How a character in view at `dist` m (from the camera, across the ground) is animated. */
export function animStep(dist: number): AnimStep {
  return dist > ANIM_LOD_FAR ? FARTHEST : dist > ANIM_LOD_NEAR ? FAR : dist > ANIM_LOD_FULL ? MID : EVERY_FRAME;
}

/** Remote shooting overlays (the recoil twitch of a shot) are left out past this (m): a pixel or two of movement. */
export const SHOT_OVERLAY_REACH = ANIM_LOD_NEAR;

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
