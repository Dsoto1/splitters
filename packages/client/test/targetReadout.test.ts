import { describe, expect, it } from 'vitest';
import { targetReadout } from '../src/game/targetReadout.ts';

describe('the Practice Target readout', () => {
  it('names the zone, distance, damage and hits to down a fresh player', () => {
    expect(targetReadout({ z: 1, n: 96, d: 42 })).toBe('Head · 42 m · 96 · 2 hits to down');
    expect(targetReadout({ z: 0, n: 100, d: 10 })).toBe('Body · 10 m · 100 · 1 hit to down');
    expect(targetReadout({ z: 2, n: 18.4, d: 75 })).toBe('Legs · 75 m · 18 · 6 hits to down');
  });
  it("counts a shotgun's pellets, and a blast has no distance", () => {
    expect(targetReadout({ z: 0, n: 104, d: 8, p: 9 })).toBe('Body · 8 m · 9 pellets · 104 · 1 hit to down');
    expect(targetReadout({ z: 0, n: 60, d: 0 })).toBe('Blast · 60 · 2 hits to down');
  });
});
