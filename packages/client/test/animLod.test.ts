import { describe, expect, it } from 'vitest';
import { ANIM_LOD_FAR, ANIM_LOD_FULL, ANIM_LOD_NEAR, ANIM_SHARE_FAR, ANIM_SHARE_FINE, ANIM_SHARE_FULL, ANIM_SHARE_NEAR, ANIM_SHARE_TINY, EVERY_FRAME, StepClock, animStep, animStepByShare, blendAt } from '../src/game/animLod.ts';
import { screenShare } from '../src/game/ragdollBudget.ts';
import { DEFAULT_FOV } from '../src/game/view.ts';

/** Evaluations a second for a character at `dist` m when frames take `frameMs`, over `seconds`. */
function rate(dist: number, frameMs: number, seconds = 10, phase = 0, round2 = true): number {
  const clock = new StepClock();
  const step = animStep(dist, round2);
  let n = 0;
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let f = 0; f < frames; f++) if (clock.due(f * frameMs, f, step, phase)) n++;
  return n / seconds;
}

/** Evaluations a second at a share of the view's height (round 4). */
function rateByShare(share: number, frameMs: number, seconds = 10): number {
  const clock = new StepClock();
  const step = animStepByShare(share);
  let n = 0;
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let f = 0; f < frames; f++) if (clock.due(f * frameMs, f, step, 0)) n++;
  return n / seconds;
}

describe('character animation LOD by size on screen (round 4)', () => {
  const at = (m: number) => screenShare(m, DEFAULT_FOV);

  it('puts the bands at about 8, 20, 40, 80 and 150 m with the usual field of view', () => {
    expect(at(7.5)).toBeGreaterThan(ANIM_SHARE_FINE);
    expect(at(8.5)).toBeLessThan(ANIM_SHARE_FINE);
    expect(at(19)).toBeGreaterThan(ANIM_SHARE_FULL);
    expect(at(21)).toBeLessThan(ANIM_SHARE_FULL);
    expect(at(39)).toBeGreaterThan(ANIM_SHARE_NEAR);
    expect(at(41)).toBeLessThan(ANIM_SHARE_NEAR);
    expect(at(78)).toBeGreaterThan(ANIM_SHARE_FAR);
    expect(at(82)).toBeLessThan(ANIM_SHARE_FAR);
    expect(at(145)).toBeGreaterThan(ANIM_SHARE_TINY);
    expect(at(155)).toBeLessThan(ANIM_SHARE_TINY);
  });

  it('animates every frame to 20 m (the fingers kept past 8 m), then 30, 15, 10 and 5 Hz at 60 fps, every reduced rate smoothed', () => {
    expect(animStepByShare(at(5))).toBe(EVERY_FRAME);
    expect(animStepByShare(at(12)).detail).toBe('cached');
    expect(rateByShare(at(12), 1000 / 60)).toBeCloseTo(60, 0);
    expect(rateByShare(at(30), 1000 / 60)).toBeCloseTo(30, 0);
    expect(rateByShare(at(60), 1000 / 60)).toBeCloseTo(15, 0);
    expect(rateByShare(at(100), 1000 / 60)).toBeCloseTo(10, 0);
    expect(rateByShare(at(200), 1000 / 60)).toBeCloseTo(5, 0);
    for (const m of [30, 60, 100, 200]) expect(animStepByShare(at(m)).smooth).toBe(true);
    expect(animStepByShare(at(12)).smooth).toBe(false);
    expect(animStepByShare(at(30)).detail).toBe('cached');
    expect(animStepByShare(at(60)).detail).toBe('coarse');
  });

  it('gives each distance at least the rate round 2 did', () => {
    for (const m of [5, 10, 16, 25, 34, 36, 50, 69, 71, 100, 140]) expect(rateByShare(at(m), 1000 / 60)).toBeGreaterThanOrEqual(rate(m, 1000 / 60) - 0.5);
  });

  it('brings a far character back to a full rate through a scope (a narrower field of view)', () => {
    const scoped = screenShare(60, DEFAULT_FOV / 4);
    expect(animStepByShare(scoped).ms).toBe(0);
  });

  it('still saves on slow frames: every 2nd, 4th, 6th and 12th frame at 25 fps', () => {
    expect(rateByShare(at(30), 40)).toBeCloseTo(12.5, 0);
    expect(rateByShare(at(60), 40)).toBeCloseTo(6.25, 0);
    expect(rateByShare(at(100), 40)).toBeCloseTo(25 / 6, 0);
    expect(rateByShare(at(200), 40)).toBeCloseTo(25 / 12, 0);
  });
});

describe('pose smoothing between evaluations', () => {
  it('runs one step behind: the pose before at an evaluation, the last one as the next is due', () => {
    // Evaluated at 100 and 133 ms (30 Hz): drawn from the pose of 100 at 133, halfway at 150, the pose of 133 at 166.
    expect(blendAt(133, 100, 133)).toBe(0);
    expect(blendAt(150, 100, 133)).toBeCloseTo(17 / 33, 3);
    expect(blendAt(166, 100, 133)).toBe(1);
    expect(blendAt(180, 100, 133)).toBe(1);
  });

  it('shows the last pose as it is after a long gap (just in a smoothed band, or back in view)', () => {
    expect(blendAt(1000, 0, 900)).toBe(1);
    expect(blendAt(1000, -1e9, 990)).toBe(1);
    expect(blendAt(1000, 990, 990)).toBe(1);
  });
});

describe('character animation LOD', () => {
  it('animates near characters every frame, in full detail', () => {
    expect(animStep(ANIM_LOD_FULL - 1)).toBe(EVERY_FRAME);
    expect(animStep(0).detail).toBe('full');
    expect(rate(5, 1000 / 60)).toBeCloseTo(60, 0);
    expect(rate(5, 40)).toBeCloseTo(25, 0);
  });

  it('steps 20 Hz, 12 Hz and 8 Hz by distance at 60 fps (round 2, `?perfoff=animlod4`)', () => {
    expect(rate(ANIM_LOD_FULL + 5, 1000 / 60)).toBeCloseTo(20, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 1000 / 60)).toBeCloseTo(12, 0);
    expect(rate(ANIM_LOD_FAR + 5, 1000 / 60)).toBeCloseTo(8, 0);
  });

  it("keeps round 1's rates behind the switch: 30 Hz, 15 Hz and 10 Hz", () => {
    expect(rate(ANIM_LOD_FULL + 5, 1000 / 60, 10, 0, false)).toBeCloseTo(30, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 1000 / 60, 10, 0, false)).toBeCloseTo(15, 0);
    expect(rate(ANIM_LOD_FAR + 5, 1000 / 60, 10, 0, false)).toBeCloseTo(10, 0);
  });

  it('still saves on slow frames, where a time step alone was due every frame', () => {
    // 25 fps (a busy fight on a laptop): every 3rd, 4th and 5th frame instead of every frame.
    expect(rate(ANIM_LOD_FULL + 5, 40)).toBeCloseTo(25 / 3, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 40)).toBeCloseTo(6.25, 0);
    expect(rate(ANIM_LOD_FAR + 5, 40)).toBeCloseTo(5, 0);
  });

  it('keeps fingers from the last full close past the full-detail distance, and the coarse detail past the near one', () => {
    expect(animStep(ANIM_LOD_FULL + 1).detail).toBe('cached');
    expect(animStep(ANIM_LOD_NEAR - 1).detail).toBe('cached');
    expect(animStep(ANIM_LOD_NEAR + 1).detail).toBe('coarse');
    expect(animStep(ANIM_LOD_FAR + 50).detail).toBe('coarse');
    expect(animStep(ANIM_LOD_FAR + 50, false).detail).toBe('cached');
  });

  it('spreads a crowd over frames: characters on different phases step on different frames', () => {
    const step = animStep(ANIM_LOD_NEAR + 5);
    const clocks = Array.from({ length: 30 }, () => new StepClock());
    const perFrame: number[] = [];
    for (let f = 0; f < 120; f++) {
      let n = 0;
      clocks.forEach((c, slot) => {
        if (c.due(f * 40, f, step, (slot * 37) % 100)) n++;
      });
      perFrame.push(n);
    }
    // After the first frames (everyone's first step is at once), no frame carries much more than its share.
    const settled = perFrame.slice(8);
    expect(Math.max(...settled)).toBeLessThanOrEqual(Math.ceil(30 / step.frames) + 2);
    expect(Math.min(...settled)).toBeGreaterThan(0);
  });

  it('goes back to every frame at once when a character comes near', () => {
    const clock = new StepClock();
    const far = animStep(ANIM_LOD_FAR + 5);
    expect(clock.due(0, 0, far)).toBe(true);
    expect(clock.due(16, 1, far)).toBe(false);
    expect(clock.due(33, 2, EVERY_FRAME)).toBe(true);
    expect(clock.due(50, 3, EVERY_FRAME)).toBe(true);
  });
});
