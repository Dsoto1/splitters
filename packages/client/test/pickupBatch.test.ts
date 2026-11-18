import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/instancedMesh';
import { PICKUP_SECTOR, PickupBatch } from '../src/game/pickupBatch.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function setup() {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  // A parked source, as the pickups' shapes and the model library's merged models are.
  const source = CreateBox('ring', { size: 0.5 }, scene);
  source.material = new StandardMaterial('ring', scene);
  source.position.y = -10000;
  source.freezeWorldMatrix();
  /** A pickup: a root at `x` with one instance of the source under it, 0.1 m up. */
  const pickup = (name: string, x: number) => {
    const root = new TransformNode(name, scene);
    root.position.set(x, 1, 0);
    const inst = source.createInstance(`${name}_ring`);
    inst.parent = root;
    inst.position.y = 0.1;
    return root;
  };
  return { scene, source, pickup, batch: new PickupBatch(scene) };
}

const translation = (m: Float32Array, i: number) => [m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]];

describe('PickupBatch', () => {
  it('draws every pickup part as a thin instance of one mesh, where its node is', () => {
    const { scene, source, pickup, batch } = setup();
    const a = pickup('pickup_a', 2);
    const b = pickup('pickup_b', 9);
    batch.adopt(a);
    batch.adopt(b);
    // The instances go at the next update (a model's loader places it first).
    expect(a.getChildMeshes().length).toBe(1);
    batch.update();
    expect(a.getChildMeshes().length).toBe(0);
    expect(b.getChildMeshes().length).toBe(0);
    expect(source.instances.length).toBe(0);
    const meshes = scene.meshes.filter((m) => m.name.startsWith('pickupBatch_'));
    expect(meshes.length).toBe(1);
    const mesh = meshes[0] as Mesh;
    expect(mesh.thinInstanceCount).toBe(2);
    expect(mesh.material).toBe(source.material);
    expect(batch.stats()).toEqual({ meshes: 1, parts: 2 });
    const m = (mesh as unknown as { _thinInstanceDataStorage: { matrixData: Float32Array } })._thinInstanceDataStorage.matrixData;
    expect(translation(m, 0).map((v) => +v!.toFixed(3))).toEqual([2, 1.1, 0]);
    expect(translation(m, 1).map((v) => +v!.toFixed(3))).toEqual([9, 1.1, 0]);
    // The source stays parked and untouched for its other copies.
    expect(source.position.y).toBe(-10000);
    // It follows its root (spin and bob).
    a.position.y = 2;
    a.rotation.y = Math.PI / 2;
    batch.update();
    expect(+translation(m, 0)[1]!.toFixed(3)).toBe(2.1);
    const mat = Matrix.FromArray(m, 0);
    const xAxis = Vector3.TransformNormal(new Vector3(1, 0, 0), mat);
    expect(xAxis.z).toBeCloseTo(-1, 5);
    expect(batch.draws(a, '_ring')).toBe(true);
  });

  it('batches pickups by square, so a square out of view is culled whole', () => {
    const { scene, pickup, batch } = setup();
    for (const [i, x] of [2, 9, 2 + PICKUP_SECTOR, -30].entries()) batch.adopt(pickup(`pickup_${i}`, x));
    batch.update();
    const meshes = scene.meshes.filter((m) => m.name.startsWith('pickupBatch_')) as Mesh[];
    expect(meshes.map((m) => m.thinInstanceCount).sort()).toEqual([1, 1, 2]);
    expect(batch.stats()).toEqual({ meshes: 3, parts: 4 });
  });

  it('draws a switched-off pickup as nothing and lets a disposed one go', () => {
    const { scene, pickup, batch } = setup();
    const a = pickup('pickup_a', 2);
    const b = pickup('pickup_b', 9);
    batch.adopt(a);
    batch.adopt(b);
    batch.update();
    const mesh = scene.meshes.find((m) => m.name.startsWith('pickupBatch_')) as Mesh;
    a.setEnabled(false);
    batch.update();
    const m = (mesh as unknown as { _thinInstanceDataStorage: { matrixData: Float32Array } })._thinInstanceDataStorage.matrixData;
    expect([...m.subarray(0, 16)].every((v) => v === 0)).toBe(true);
    expect(batch.draws(a, '_ring')).toBe(false);
    b.dispose();
    batch.update();
    expect(mesh.thinInstanceCount).toBe(1);
    a.dispose();
    batch.update();
    expect(mesh.thinInstanceCount).toBe(0);
    expect(mesh.isEnabled()).toBe(false);
    batch.dispose();
    expect(mesh.isDisposed()).toBe(true);
  });
});
