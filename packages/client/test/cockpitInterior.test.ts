import { describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MOUNT_DEFS } from '@tiletrigger/shared';
import { partitionByBox, type ModelBox } from '../src/game/cockpitInterior.ts';

describe('cockpit interior', () => {
  // Three triangles: one inside the box, one outside, one straddling its face.
  const positions = [0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5, 0.5, 0.5, 0.5, 3, 0.5, 0.5, 0.5, 0.6, 0.5];
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const box: ModelBox = [
    [-1, -1, -1],
    [1, 1, 1],
  ];

  it('puts the triangles wholly inside the box last and keeps every triangle', () => {
    const { indices: out, outside } = partitionByBox(indices, positions, box, (p) => p);
    expect(outside).toBe(6);
    expect([...out.slice(outside)]).toEqual([0, 1, 2]);
    expect([...out].sort()).toEqual([...indices].sort());
  });

  it('tests corners in the box frame', () => {
    // Shifted 5 m: now the far triangle is the one inside.
    const { indices: out, outside } = partitionByBox(indices, positions, box, (p) => p.subtract(new Vector3(5.2, 5.2, 5)));
    expect([...out.slice(outside)]).toEqual([3, 4, 5]);
  });

  it('the buggy names its cockpit model, built beside its body', () => {
    expect(MOUNT_DEFS.buggy.cockpitModel).toBe('vehicles/offroad_buggy_cockpit.glb');
  });
});
