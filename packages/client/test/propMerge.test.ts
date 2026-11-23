import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/meshLODLevel';
import { mergeItems, shownIndices } from '../src/game/propMerge.ts';
import { MERGE_CELL, MERGE_MODEL_VERTICES, PROP_BATCH_MIN, PropBatches, mergesModel } from '../src/game/propBatches.ts';
import { proxyable } from '../src/game/shadowProxy.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

function placed(s: Scene, name: string, x: number, z: number, yaw = 0, scale = 1): TransformNode {
  const n = new TransformNode(name, s);
  n.position.set(x, 0, z);
  n.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), yaw);
  n.scaling.setAll(scale);
  return n;
}

const tri = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2] };
const identity = Matrix.Identity().m;

describe('merging still props (game/propMerge.ts)', () => {
  it('places each copy by its matrix, turns its normals, flips mirrored faces and keeps each one\'s index range', () => {
    const moved = Matrix.Compose(new Vector3(2, 2, 2), Quaternion.RotationAxis(Vector3.Up(), Math.PI / 2), new Vector3(10, 0, 5)).m;
    const mirrored = Matrix.Scaling(-1, 1, 1).m;
    const m = mergeItems([
      { ...tri, matrix: identity },
      { ...tri, matrix: moved },
      { ...tri, matrix: mirrored },
    ]);
    expect(m.positions.length).toBe(27);
    // Second copy's second vertex: (1, 0, 0) doubled, turned a quarter, moved, as Babylon places it.
    const want = Vector3.TransformCoordinates(new Vector3(1, 0, 0), Matrix.FromArray(moved));
    expect([m.positions[12], m.positions[13], m.positions[14]].map((v) => Math.round(v! * 1e4) / 1e4)).toEqual([want.x, want.y, want.z].map((v) => Math.round(v * 1e4) / 1e4));
    // Its normal (+z) turned with it, still unit length.
    const n = Vector3.TransformNormal(new Vector3(0, 0, 1), Matrix.FromArray(moved)).normalize();
    expect(m.normals![12]).toBeCloseTo(n.x, 5);
    expect(m.normals![14]).toBeCloseTo(n.z, 5);
    expect(Math.hypot(m.normals![12]!, m.normals![13]!, m.normals![14]!)).toBeCloseTo(1, 5);
    // Indices offset per copy; the mirrored copy's winding turned round so it still faces out.
    expect(Array.from(m.indices)).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 7]);
    expect(Array.from(m.ranges)).toEqual([0, 3, 3, 3, 6, 3]);
    expect(m.colors).toBeNull();
  });

  it('carries tints in the vertex colours, fills what some copies lack, and shows only the copies asked for', () => {
    const m = mergeItems([
      { ...tri, matrix: identity, uvs: [0, 0, 1, 0, 0, 1], colors: [0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 1] },
      { ...tri, matrix: identity, tint: [1, 0, 0, 1] },
    ]);
    // The first keeps its own colours; the second, without any, is white times its tint.
    expect(Array.from(m.colors!.slice(0, 4))).toEqual([0.5, 0.5, 0.5, 1]);
    expect(Array.from(m.colors!.slice(12, 16))).toEqual([1, 0, 0, 1]);
    // Coordinates the second lacked: zero.
    expect(Array.from(m.uvs!.slice(6, 12))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(Array.from(shownIndices(m.indices, m.ranges, (i) => i === 1))).toEqual([3, 4, 5]);
    expect(Array.from(shownIndices(m.indices, m.ranges, () => true))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(shownIndices(m.indices, m.ranges, () => false).length).toBe(0);
  });

  it('merges models only while their copies stay light', () => {
    expect(mergesModel(1000, 40)).toBe(true);
    expect(mergesModel(MERGE_MODEL_VERTICES / 4 + 1, 4)).toBe(false);
  });
});

/** A model's merged sources as ModelLibrary.staticSources gives them: parked, one per material. */
function source(s: Scene, name: string, material: StandardMaterial, size = 1, lod = false): Mesh[] {
  const a = CreateBox(`${name}_a`, { size }, s);
  a.material = material;
  a.position.y = -10000;
  if (lod) {
    const low = CreateBox(`${name}_low`, { size: size * 0.9 }, s);
    low.material = material;
    low.position.y = -10000;
    a.addLODLevel(30, low);
  }
  return [a];
}

const merged = (s: Scene) => s.meshes.filter((m) => m.name.startsWith('static_merged_')) as Mesh[];

describe('merged prop batches (PropBatches with `merge`)', () => {
  it('draws different models sharing a material in one square as one mesh (a sink and the mirror above it)', async () => {
    const s = scene();
    const shared = new StandardMaterial('atlas', s);
    const other = new StandardMaterial('other', s);
    const models: Record<string, Mesh[]> = { sink: source(s, 'sink', shared), mirror: source(s, 'mirror', shared, 0.5), crate: source(s, 'crate', other) };
    const batches = new PropBatches(s, async (p) => models[p] ?? null, 15, true, true);
    const sink = placed(s, 'sink1', 4, 4);
    const mirror = placed(s, 'mirror1', 4, 4);
    mirror.position.y = 1.5;
    const crate = placed(s, 'crate1', 8, 4);
    const far = placed(s, 'sink2', MERGE_CELL + 4, 4);
    const ok = await Promise.all([batches.add('sink', sink, false, null, false, false, 2), batches.add('mirror', mirror, false, '#ff0000', false, false, 1), batches.add('crate', crate, false, null, false, false, 1), batches.add('sink', far, false, null, false, false, 2)]);
    expect(ok).toEqual([true, true, true, true]);
    batches.update(new Vector3(0, 2, 0));
    const meshes = merged(s);
    // Square 0: the shared material (sink + mirror) and the crate's; square 1: the other sink.
    expect(meshes.length).toBe(3);
    const both = meshes.find((m) => m.material === shared && m.name.endsWith('_0:0'))!;
    expect(both.getTotalVertices()).toBe(48);
    expect(both.getTotalIndices()).toBe(72);
    // The mirror's tint is in its vertex colours, placed 1.5 m up.
    const colors = both.getVerticesData(VertexBuffer.ColorKind)!;
    expect(Array.from(colors.slice(0, 4))).toEqual([1, 1, 1, 1]);
    expect(Array.from(colors.slice(24 * 4, 24 * 4 + 4))).toEqual([1, 0, 0, 1]);
    const pos = both.getVerticesData(VertexBuffer.PositionKind)!;
    expect(Math.max(...Array.from(pos).filter((_, i) => i % 3 === 1))).toBeCloseTo(1.75, 5);
    expect(batches.copyState(sink)).toMatchObject({ breakable: false, drawn: 2, drawnHere: true });
    expect(batches.stats()).toMatchObject({ merged: 4, mergedMeshes: 3 });
    // They cast nothing themselves: static shadow batches of each model do, merged into the shadow proxies.
    expect(meshes.every((m) => (m.metadata as { castsNoShadow?: boolean }).castsNoShadow)).toBe(true);
    const shadows = s.meshes.filter((m) => m.name.startsWith('static_shadow_')) as Mesh[];
    // One per model and PROP_SECTOR square (MERGE_CELL is as wide: the far sink is in the next one).
    expect(shadows.length).toBe(4);
    expect(shadows.every((m) => m.layerMask === 0 && proxyable(m))).toBe(true);
  });

  it('each copy keeps its own level of detail: one mesh holds every level, a change rebuilds only its index list', async () => {
    const s = scene();
    const shared = new StandardMaterial('atlas', s);
    const batches = new PropBatches(s, async () => source(s, 'tree', shared, 1, true), 15, true, true);
    const a = placed(s, 'near', 5, 0);
    const b = placed(s, 'far', 60, 0);
    await Promise.all([batches.add('tree', a, false, null, false, false, 2), batches.add('tree', b, false, null, false, false, 2)]);
    batches.update(new Vector3(0, 0, 0));
    const meshes = merged(s);
    // One mesh (one material) with both copies at both levels: 4 boxes of 24 vertices; it draws two of them.
    expect(meshes.length).toBe(1);
    const mesh = meshes[0]!;
    expect(mesh.getTotalVertices()).toBe(96);
    expect(mesh.getTotalIndices()).toBe(72);
    const drawnY = () => {
      // The near copy at full detail (size 1: x up to 5.5), the far one at its lighter level (size 0.9: up to 60.45).
      const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
      const xs = new Set(Array.from(mesh.getIndices()!).map((i) => Math.round(pos[i * 3]! * 100) / 100));
      return [...xs].sort((p, q) => p - q);
    };
    expect(drawnY()).toEqual([4.5, 5.5, 59.55, 60.45]);
    batches.update(new Vector3(36, 0, 0));
    // Both near: both at full detail; the vertices were not made again.
    expect(merged(s)).toEqual([mesh]);
    expect(mesh.getTotalVertices()).toBe(96);
    expect(drawnY()).toEqual([4.5, 5.5, 59.5, 60.5]);
    expect(batches.copyState(b)).toMatchObject({ drawn: 2, drawnHere: true });
  });

  it('breakable copies stay in batches; a model too heavy to merge is batched as before', async () => {
    const s = scene();
    const shared = new StandardMaterial('atlas', s);
    const batches = new PropBatches(s, async () => source(s, 'crate', shared), 15, true, true);
    const breakable = placed(s, 'b', 4, 4);
    expect(await batches.add('crate', breakable, false, null, false, true, PROP_BATCH_MIN)).toBe(true);
    batches.update(new Vector3(0, 2, 0));
    expect(merged(s).length).toBe(0);
    expect(batches.copyState(breakable)).toMatchObject({ breakable: true, drawnHere: true });
    // A breakable copy of a model with fewer copies than a batch takes: GPU instances, as before.
    expect(await batches.add('crate', placed(s, 'b2', 4, 8), false, null, false, true, PROP_BATCH_MIN - 1)).toBe(false);
    // So is a model too heavy to merge (its vertices times its copies past the cap) with few copies.
    const heavy = new PropBatches(s, async () => source(s, 'big', shared), 15, true, true);
    expect(await heavy.add('big', placed(s, 'h', 4, 8), false, null, false, false, Math.ceil(MERGE_MODEL_VERTICES / 24) + 1)).toBe(true);
    expect(merged(s).length).toBe(0);
  });
});
