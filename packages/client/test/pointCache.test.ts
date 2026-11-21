import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Ray } from '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { dropPointCaches } from '../src/content/pointCache.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

const points = (m: object): unknown[] | null => (m as { _internalAbstractMeshDataInfo: { _positions: unknown[] | null } })._internalAbstractMeshDataInfo._positions;

describe('the bodies’ picking points (Flavius Rule memory, 2026-11-16)', () => {
  it('drops the per-vertex points a bounds refresh leaves on a mesh, bounds kept, and a pick still hits', () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const box = CreateBox('b', { size: 2 }, scene);
    box.refreshBoundingInfo({ applySkeleton: true, applyMorph: false });
    expect(points(box)?.length).toBe(24);
    const before = box.getBoundingInfo().boundingBox.extendSize.clone();
    const pre = scene.pickWithRay(new Ray(new Vector3(0, 0, -10), new Vector3(0, 0, 1), 100), (m) => m === box);
    expect(dropPointCaches([box])).toBe(24);
    expect(points(box)).toBeNull();
    expect(dropPointCaches([box])).toBe(0);
    expect(box.getBoundingInfo().boundingBox.extendSize.equals(before)).toBe(true);
    const hit = scene.pickWithRay(new Ray(new Vector3(0, 0, -10), new Vector3(0, 0, 1), 100), (m) => m === box);
    expect(hit?.hit).toBe(true);
    expect(hit?.distance).toBeCloseTo(pre!.distance, 5);
  });
});

describe('bodies cloned without picking points', () => {
  it('clones a mesh with the same bounds and no point cache inside withoutPointCaches, and as before outside it', async () => {
    const { withoutPointCaches } = await import('../src/content/pointCache.ts');
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const box = CreateBox('src', { width: 1, height: 3, depth: 2 }, scene);
    const plain = box.clone('plain');
    const quiet = withoutPointCaches(() => box.clone('quiet'));
    expect(points(plain)?.length).toBe(24);
    expect(points(quiet)).toBeNull();
    expect(quiet.getBoundingInfo().boundingBox.extendSize.equals(plain.getBoundingInfo().boundingBox.extendSize)).toBe(true);
    // Outside it, and for a call with options, the original behaviour.
    const after = box.clone('after');
    expect(points(after)?.length).toBe(24);
    withoutPointCaches(() => after.refreshBoundingInfo({ applySkeleton: false }));
    expect(points(after)?.length).toBe(24);
  });
});
