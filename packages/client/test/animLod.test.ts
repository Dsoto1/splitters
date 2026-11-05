import { describe, expect, it } from 'vitest';
import { ANIM_LOD_FAR, ANIM_LOD_FULL, ANIM_LOD_NEAR, EVERY_FRAME, StepClock, animStep } from '../src/game/animLod.ts';

/** Evaluations a second for a character at `dist` m when frames take `frameMs`, over `seconds`. */
function rate(dist: number, frameMs: number, seconds = 10, phase = 0, round2 = true): number {
  const clock = new StepClock();
  const step = animStep(dist, round2);
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

  it('steps 20 Hz, 12 Hz and 8 Hz by distance at 60 fps (round 2)', () => {
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
