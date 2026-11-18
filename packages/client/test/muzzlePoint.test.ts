import { describe, expect, it } from 'vitest';
import { frontCentre } from '../src/game/muzzlePoint.ts';

describe("a gun model's muzzle (muzzlePoint.ts)", () => {
  it('is the middle of the front-most geometry, not the bounds a fifth above the middle', () => {
    // A 0.8 m gun: a tall stock at the back (y up to 0.2), a barrel 2 cm round at y 0.05 out to z 0.4.
    const pts: number[] = [];
    for (let i = 0; i < 40; i++) pts.push((i % 2 ? 0.02 : -0.02), 0.2 * (i / 40), -0.4 + (i / 40) * 0.1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push(Math.cos(a) * 0.01, 0.05 + Math.sin(a) * 0.01, 0.4);
      pts.push(Math.cos(a) * 0.01, 0.05 + Math.sin(a) * 0.01, 0.2);
    }
    const at = frontCentre(pts)!;
    expect(at[2]).toBeCloseTo(0.4);
    expect(at[1]).toBeCloseTo(0.05, 3);
    expect(at[0]).toBeCloseTo(0, 3);
  });

  it('has nothing to say about no geometry', () => {
    expect(frontCentre([])).toBeNull();
  });
});
