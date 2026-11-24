import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { headingAngles, pointAlong } from '../src/game/arsenalVisuals.ts';

/** Where the node's +Z (the way a bolt's head points) ends up in the world. */
function forward(node: TransformNode): Vector3 {
  return Vector3.TransformNormal(new Vector3(0, 0, 1), node.computeWorldMatrix(true)).normalize();
}

const scene = new Scene(new NullEngine());
const make = () => new TransformNode('t', scene);

describe('pointAlong', () => {
  it('turns +Z along any direction, flat, steep, up and down', () => {
    const node = make();
    const dirs = [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(-3, 1, 2), new Vector3(0.2, 5, 0.1), new Vector3(0.2, -5, -0.1), new Vector3(0, 0, -1), new Vector3(2, -0.5, -7)];
    for (const d of dirs) {
      expect(pointAlong(node, d)).toBe(true);
      const f = forward(node);
      const want = d.normalizeToNew();
      expect(Vector3.Distance(f, want)).toBeLessThan(1e-5);
    }
  });

  it('straight up or down is exact and keeps the last yaw', () => {
    const node = make();
    pointAlong(node, new Vector3(1, 0.5, 0));
    const yaw = node.rotation.y;
    pointAlong(node, new Vector3(0, 10, 0));
    expect(node.rotation.y).toBeCloseTo(yaw, 6);
    expect(Vector3.Distance(forward(node), new Vector3(0, 1, 0))).toBeLessThan(1e-5);
    pointAlong(node, new Vector3(0, -10, 0));
    expect(Vector3.Distance(forward(node), new Vector3(0, -1, 0))).toBeLessThan(1e-5);
  });

  it('a heading of no length leaves the node alone', () => {
    const node = make();
    node.rotation.set(0.3, 0.4, 0);
    expect(pointAlong(node, Vector3.Zero())).toBe(false);
    expect(node.rotation.y).toBe(0.4);
    expect(headingAngles(0, 0, 0, 1.2).yaw).toBe(1.2);
  });
});
