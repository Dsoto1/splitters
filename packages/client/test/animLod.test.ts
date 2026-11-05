import { describe, expect, it } from 'vitest';
import { ANIM_LOD_FAR, ANIM_LOD_FULL, ANIM_LOD_NEAR, EVERY_FRAME, StepClock, animStep } from '../src/game/animLod.ts';

/** Evaluations a second for a character at `dist` m when frames take `frameMs`, over `seconds`. */
function rate(dist: number, frameMs: number, seconds = 10, phase = 0): number {
  const clock = new StepClock();
  const step = animStep(dist);
  let n = 0;
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let f = 0; f < frames; f++) if (clock.due(f * frameMs, f, step, phase)) n++;
  return n / seconds;
}

describe('character animation LOD', () => {
  it('animates near characters every frame, in full detail', () => {
    expect(animStep(ANIM_LOD_FULL - 1)).toBe(EVERY_FRAME);
    expect(animStep(0).detail).toBe('full');
    expect(rate(5, 1000 / 60)).toBeCloseTo(60, 0);
    expect(rate(5, 40)).toBeCloseTo(25, 0);
  });

  it('keeps the 60 fps rates of before: 30 Hz, 15 Hz and 10 Hz by distance', () => {
    expect(rate(ANIM_LOD_FULL + 5, 1000 / 60)).toBeCloseTo(30, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 1000 / 60)).toBeCloseTo(15, 0);
    expect(rate(ANIM_LOD_FAR + 5, 1000 / 60)).toBeCloseTo(10, 0);
  });

  it('still saves on slow frames, where a time step alone was due every frame', () => {
    // 25 fps (a busy fight on a laptop): every 2nd, 3rd and 4th frame instead of every frame.
    expect(rate(ANIM_LOD_FULL + 5, 40)).toBeCloseTo(12.5, 0);
    expect(rate(ANIM_LOD_NEAR + 5, 40)).toBeCloseTo(25 / 3, 0);
    expect(rate(ANIM_LOD_FAR + 5, 40)).toBeCloseTo(6.25, 0);
  });

  it('keeps fingers from the last full close past the full-detail distance', () => {
    expect(animStep(ANIM_LOD_FULL + 1).detail).toBe('cached');
    expect(animStep(ANIM_LOD_FAR + 50).detail).toBe('cached');
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
