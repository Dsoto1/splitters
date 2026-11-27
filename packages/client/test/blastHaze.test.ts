import { describe, expect, it } from 'vitest';
import { BLAST_HAZE, blastHazeDepth } from '../src/game/blastHaze.ts';
import { NEAR_FADE } from '../src/game/godotVfx.ts';

/** Inside a blast (owner, 2026-11-27): its cards fade near the camera, and a calm haze stands in for them. */
describe('a blast seen from inside', () => {
  const blast = { x: 0, y: 1, z: 0, radius: 2.7, born: 1000 };
  it('hazes the view only from inside its smoke, at most BLAST_HAZE.max, thinning away over its last half', () => {
    expect(blastHazeDepth({ x: 0, y: 1, z: 0 }, [blast], 1100)).toBeCloseTo(BLAST_HAZE.max);
    expect(blastHazeDepth({ x: 6, y: 1, z: 0 }, [blast], 1100)).toBe(0);
    const mid = blastHazeDepth({ x: 0, y: 1, z: 0 }, [blast], 1000 + BLAST_HAZE.seconds * 750);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(BLAST_HAZE.max);
    expect(blastHazeDepth({ x: 0, y: 1, z: 0 }, [blast], 1000 + BLAST_HAZE.seconds * 1000)).toBe(0);
    // Never a step at its edge: a little way in, a little haze.
    expect(blastHazeDepth({ x: 2.6, y: 1, z: 0 }, [blast], 1100)).toBeLessThan(0.03);
  });

  it('a light haze (the walls show through) that comes up eased with Reduce flashing on', () => {
    expect(BLAST_HAZE.max).toBeLessThanOrEqual(0.35);
    expect(BLAST_HAZE.calmRise).toBeLessThan(1.5);
  });

  it("a blast's pieces are gone at the camera and whole a few metres off", () => {
    expect(NEAR_FADE[0]).toBeGreaterThan(0.3);
    expect(NEAR_FADE[1]).toBeGreaterThan(NEAR_FADE[0] + 1);
    expect(NEAR_FADE[1]).toBeLessThan(4);
  });
});
