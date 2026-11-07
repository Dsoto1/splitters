import { describe, expect, it } from 'vitest';
import { CappedTimer } from '../src/game/cappedTimer.ts';

// The Roulette spawn card's clock (rouletteHud.ts): 2 s of drawn frames, a hitch counting as one capped step.
describe('CappedTimer', () => {
  it('runs out after its seconds of steady frames', () => {
    const t = new CappedTimer(0.1);
    t.frame(0);
    t.start(2);
    let now = 0;
    let frames = 0;
    while (t.frame((now += 1000 / 60))) frames++;
    expect(frames).toBeGreaterThanOrEqual(118);
    expect(frames).toBeLessThanOrEqual(121);
  });

  it('a hitch right after the start uses only one capped step', () => {
    const t = new CappedTimer(0.1);
    t.frame(0);
    t.start(2);
    // A 3 s frame as the new body is built: the card is still up after it.
    expect(t.frame(3000)).toBe(true);
    expect(t.left).toBeCloseTo(1.9, 5);
  });

  it('on a page drawing a frame a second it lasts 20 frames', () => {
    const t = new CappedTimer(0.1);
    t.frame(0);
    t.start(2);
    let frames = 0;
    while (t.frame((frames + 1) * 1000)) frames++;
    expect(frames).toBe(19);
  });

  it('held, the time does not count', () => {
    const t = new CappedTimer(0.1);
    t.frame(0);
    t.start(1);
    for (let i = 1; i <= 100; i++) t.frame(i * 50, false);
    expect(t.left).toBe(1);
    expect(t.frame(5050)).toBe(true);
  });

  it('a first frame with no earlier one counts nothing', () => {
    const t = new CappedTimer(0.1);
    t.start(0.5);
    expect(t.frame(123456)).toBe(true);
    expect(t.left).toBe(0.5);
  });
});
