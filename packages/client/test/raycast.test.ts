import { describe, expect, it } from 'vitest';
import { raycastBoxes } from '../src/editor/raycast.ts';

const box = (min: [number, number, number], max: [number, number, number], sourceId = 'b') => ({ min, max, kind: 'wall' as const, sourceId });

describe('raycastBoxes', () => {
  it('returns the nearest face with its outward normal', () => {
    const near = box([0, 0, 5], [1, 1, 6], 'near');
    const far = box([0, 0, 10], [1, 1, 11], 'far');
    const hit = raycastBoxes({ x: 0.5, y: 0.5, z: 0 }, { x: 0, y: 0, z: 1 }, [far, near])!;
    expect(hit.box.sourceId).toBe('near');
    expect(hit.normal).toEqual([0, 0, -1]);
    expect(hit.distance).toBeCloseTo(5);
  });

  it('reports top faces when looking down and ignores boxes behind the ray', () => {
    const floor = box([-4, -0.5, -4], [4, 0, 4]);
    const hit = raycastBoxes({ x: 1, y: 10, z: 1 }, { x: 0, y: -1, z: 0 }, [floor])!;
    expect(hit.normal).toEqual([0, 1, 0]);
    expect(raycastBoxes({ x: 1, y: 10, z: 1 }, { x: 0, y: 1, z: 0 }, [floor])).toBeNull();
  });
});
