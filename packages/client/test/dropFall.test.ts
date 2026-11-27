import { describe, expect, it } from 'vitest';
import { DROP_GRAVITY, dropFall } from '../src/game/pickupVisuals.ts';

/** A dropped weapon is drawn falling from where its owner died to the ground the server put it on (owner, 2026-11-27). */
describe('a dropped weapon falls to the ground', () => {
  it('from a Hauler seat 1.6 m up: a short fall under gravity, then it lies still', () => {
    const d = { y: 1.6, vy: 0 };
    const heights: number[] = [];
    for (let f = 0; f < 60; f++) {
      dropFall(d, 0, 1 / 60);
      heights.push(d.y);
    }
    // Down all the way, never below the ground, never back up.
    expect(Math.min(...heights)).toBe(0);
    for (let i = 1; i < heights.length; i++) expect(heights[i]!).toBeLessThanOrEqual(heights[i - 1]!);
    // A short fall: half a second or so (sqrt(2h/g)).
    const landed = heights.indexOf(0) / 60;
    expect(landed).toBeGreaterThan(0.3);
    expect(landed).toBeLessThan(Math.sqrt((2 * 1.6) / DROP_GRAVITY) + 0.05);
    expect(d.vy).toBe(0);
  });

  it('one lying on its spot stays there; one whose spot rose (a new place) is put on it', () => {
    const d = { y: 0.2, vy: 0 };
    dropFall(d, 0.2, 1 / 60);
    expect(d).toEqual({ y: 0.2, vy: 0 });
    dropFall(d, 0.5, 1 / 60);
    expect(d.y).toBe(0.5);
  });
});
