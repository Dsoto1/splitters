import { describe, expect, it } from 'vitest';
import { LOW_HEALTH, LOW_HEALTH_LOOK, LowHealthWarning, beatPeriod, lowHealthTarget } from '../src/game/lowHealth.ts';

describe('the low-health warning (lowHealth.ts)', () => {
  it('starts below 35 % and grows as health falls', () => {
    expect(lowHealthTarget(1)).toBe(0);
    expect(lowHealthTarget(LOW_HEALTH.start)).toBe(0);
    const at30 = lowHealthTarget(0.3);
    const at10 = lowHealthTarget(0.1);
    expect(at30).toBeGreaterThanOrEqual(LOW_HEALTH.floor);
    expect(at10).toBeGreaterThan(at30);
    expect(lowHealthTarget(0.02)).toBe(1);
  });

  it('the heartbeat is never faster than once a second', () => {
    for (let l = 0; l <= 1; l += 0.05) expect(beatPeriod(l)).toBeGreaterThanOrEqual(1);
    expect(beatPeriod(1)).toBeLessThan(beatPeriod(0));
  });

  it('only darkens: the edge is near-black, not red', () => {
    const [r, g, b] = LOW_HEALTH_LOOK.color;
    expect(Math.max(r, g, b)).toBeLessThan(20);
    expect(r).toBeLessThanOrEqual(b);
  });

  for (const calm of [true, false]) {
    it(`eases in and out, and pulses at most once a second (Reduce flashing ${calm ? 'on' : 'off'})`, () => {
      const w = new LowHealthWarning();
      let now = 1000;
      let last = 0;
      let biggestStep = 0;
      const beats: number[] = [];
      let pulses = 0;
      let wasUp = false;
      for (let i = 0; i < 60 * 20; i++) {
        now += 1000 / 60;
        const f = w.update(now, i < 60 * 15 ? 0.1 : 0.9, true, calm);
        biggestStep = Math.max(biggestStep, Math.abs(f.edge - last));
        last = f.edge;
        if (f.beat) beats.push(now);
        const up = f.pulse > 0.05;
        if (up && !wasUp) pulses++;
        wasUp = up;
      }
      // No jumps: at most a small step a frame (eased in over 0.6-1.2 s).
      expect(biggestStep).toBeLessThan(0.05);
      for (let i = 1; i < beats.length; i++) expect(beats[i]! - beats[i - 1]!).toBeGreaterThanOrEqual(999);
      // 15 s low: about one beat a second, one pulse a beat; back to 90 %: it fades and the beats stop.
      expect(beats.length).toBeGreaterThan(10);
      expect(beats.length).toBeLessThanOrEqual(16);
      expect(pulses).toBeLessThanOrEqual(beats.length);
      expect(w.level).toBe(0);
    });
  }

  it('is gone at once when you die', () => {
    const w = new LowHealthWarning();
    let now = 0;
    for (let i = 0; i < 120; i++) w.update((now += 16), 0.1, true, true);
    expect(w.level).toBeGreaterThan(0.5);
    expect(w.update((now += 16), 0, false, true).edge).toBe(0);
  });
});
