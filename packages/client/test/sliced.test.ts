import { describe, expect, it } from 'vitest';
import { sliced } from '../src/game/sliced.ts';

describe('sliced (loading work spread over frames)', () => {
  it('does every item in order, a slice at a time, in at most maxSlices slices', async () => {
    const done: number[] = [];
    const slices: number[][] = [[]];
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      slices.push([]);
    }, 0);
    // Each item "costs" over the budget: a slice ends after its share (40 items / 10 slices = 4).
    const items = Array.from({ length: 40 }, (_, i) => i);
    await sliced(items, (i) => {
      const t = performance.now();
      while (performance.now() - t < 1.2);
      done.push(i);
      slices[slices.length - 1]!.push(i);
    }, 1, () => false, 10);
    clearInterval(timer);
    expect(done).toEqual(items);
    const used = slices.filter((s) => s.length);
    expect(used.length).toBeGreaterThan(1);
    expect(used.length).toBeLessThanOrEqual(10);
    expect(ticks).toBeGreaterThan(0);
  });

  it('stops when told to', async () => {
    const done: number[] = [];
    await sliced([1, 2, 3, 4], (i) => done.push(i), 0, () => done.length >= 2, 4);
    expect(done).toEqual([1, 2]);
  });
});
