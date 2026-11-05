import { describe, expect, it } from 'vitest';
import { CASCADE_MARGIN, REFRESH_FRAMES, cascadeHolds, refreshDue } from '../src/game/shadowCache.ts';

describe('static shadow cache', () => {
  it('keeps a cascade while its view slice stays inside the grown square', () => {
    const r = 10;
    const cached = { x: 0, y: 0, z: 0, r: r * (1 + CASCADE_MARGIN[1]) };
    expect(cascadeHolds(cached, { x: 0, y: 0, z: 0, r })).toBe(true);
    // Moved by less than the margin: still covered.
    expect(cascadeHolds(cached, { x: r * CASCADE_MARGIN[1] * 0.9, y: 0, z: 0, r })).toBe(true);
    // Past the margin (a turn or a few steps): the cascade moves and its static casters are drawn again.
    expect(cascadeHolds(cached, { x: r * CASCADE_MARGIN[1] * 1.1, y: 0, z: 0, r })).toBe(false);
    // A wider slice (a scope zoomed out again) doesn't fit either.
    expect(cascadeHolds(cached, { x: 0, y: 0, z: 0, r: cached.r + 0.1 })).toBe(false);
  });

  it('redraws each cascade at least every REFRESH_FRAMES or so, staggered by cascade', () => {
    expect(refreshDue(10, 0, 10)).toBe(false);
    expect(refreshDue(10 + REFRESH_FRAMES, 0, 10)).toBe(true);
    const due = [0, 1, 2].map((layer) => {
      let f = 1;
      while (!refreshDue(f, layer, 0)) f++;
      return f;
    });
    expect(new Set(due).size).toBe(3);
    for (const f of due) expect(f).toBeLessThanOrEqual(REFRESH_FRAMES + 11);
    // A frame counter that went back (a new generator) redraws at once.
    expect(refreshDue(3, 1, 50)).toBe(true);
  });
});
