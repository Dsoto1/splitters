import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { ModelLibrary } from '../src/content/models.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** A library whose static sources (one merged mesh per material, as staticSources makes them) are given. */
function library(parts: (s: Scene) => Mesh[]): { scene: Scene; models: ModelLibrary; sources: Mesh[] } {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const sources = parts(scene);
  for (const m of sources) m.position.y = -10000;
  const models = new ModelLibrary(scene);
  (models as unknown as { staticSources: (path: string) => Promise<Mesh[] | null> }).staticSources = async () => sources;
  return { scene, models, sources };
}

const gun = (s: Scene): Mesh[] =>
  ['metal', 'wood', 'grip'].map((name, i) => {
    const m = CreateBox(`static_gun_${i}`, { width: 0.1, height: 0.1, depth: 0.2 + i * 0.2 }, s);
    m.material = new StandardMaterial(name, s);
    m.bakeTransformIntoVertices(Matrix.Translation(0, 0, i * 0.3));
    return m;
  });

describe('ModelLibrary.instantiateWhole', () => {
  it('copies a model of several materials as one instance of one mesh with a part per material', async () => {
    const { models, sources } = library(gun);
    const a = await models.instantiateWhole('guns/test.glb', 'held_1');
    const b = await models.instantiateWhole('guns/test.glb', 'held_2');
    const [ia] = a.getChildMeshes();
    const [ib] = b.getChildMeshes();
    expect(a.getChildMeshes().length).toBe(1);
    expect(ia).toBeInstanceOf(InstancedMesh);
    // Every copy is an instance of the same merged mesh.
    const src = (ia as InstancedMesh).sourceMesh;
    expect((ib as InstancedMesh).sourceMesh).toBe(src);
    // A part per material, in order, covering each part's own vertices and indices.
    expect(src.material).toBeInstanceOf(MultiMaterial);
    const subs = (src.material as MultiMaterial).subMaterials;
    expect(subs.length).toBe(sources.length);
    subs.forEach((m, k) => expect(m).toBe(sources[k]!.material));
    expect(src.subMeshes.map((s) => [s.materialIndex, s.verticesCount, s.indexCount])).toEqual(sources.map((m, k) => [k, m.getTotalVertices(), m.getTotalIndices()]));
    expect(src.getTotalVertices()).toBe(sources.reduce((n, m) => n + m.getTotalVertices(), 0));
    // At the copy's origin, the model's whole size (the parts as they were placed in it).
    a.computeWorldMatrix(true);
    const { min, max } = a.getHierarchyBoundingVectors(true);
    expect(min.z).toBeCloseTo(-0.1, 4);
    expect(max.z).toBeCloseTo(0.6 + 0.3, 4);
    expect(min.y).toBeCloseTo(-0.05, 4);
  });

  it('a model of one material is an instance of its static source as it is', async () => {
    const { models, sources } = library((s) => gun(s).slice(0, 1));
    const root = await models.instantiateWhole('guns/one.glb', 'held_3');
    const [inst] = root.getChildMeshes();
    expect((inst as InstancedMesh).sourceMesh).toBe(sources[0]);
  });
  it('draws a model whose parts have no index list (the old gun models: they showed only the pickup ring)', async () => {
    // As the glTF loader makes an unindexed primitive: positions only, three vertices per triangle.
    const flat = (s: Scene): Mesh[] =>
      ['metal', 'wood'].map((name, i) => {
        const m = new Mesh(`static_flat_${i}`, s);
        const d = new VertexData();
        d.positions = [0, 0, i, 1, 0, i, 0, 1, i, 1, 0, i, 1, 1, i, 0, 1, i];
        d.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
        d.applyToMesh(m);
        m.isUnIndexed = true;
        m.material = new StandardMaterial(name, s);
        return m;
      });
    const { models } = library(flat);
    const a = await models.instantiateWhole('weapons/flat.glb', 'pickup_1');
    const src = (a.getChildMeshes()[0] as InstancedMesh).sourceMesh;
    expect(src.getTotalIndices()).toBe(12);
    expect(src.subMeshes.map((q) => [q.verticesStart, q.verticesCount, q.indexStart, q.indexCount])).toEqual([
      [0, 6, 0, 6],
      [6, 6, 6, 6],
    ]);
    // The second part's triangles point at its own vertices.
    expect([...src.getIndices()!].slice(6)).toEqual([6, 7, 8, 9, 10, 11]);
  });
});
