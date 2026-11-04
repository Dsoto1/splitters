import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { applySurfaces, isSurfaced, loadSurfaces, surfaceRules } from '../surfaces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const lock = JSON.parse(readFileSync(join(ROOT, 'content/props.lock.json'), 'utf8'));

/** A flat-material model: two boxes' worth of faces (here: one quad each), materials named like Kenney's. */
function flatModel(names) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const mesh = doc.createMesh();
  names.forEach((name, i) => {
    const x = i * 2;
    const pos = new Float32Array([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 0, 0, x + 1, 1, 0, x, 1, 0]);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setMaterial(doc.createMaterial(name).setBaseColorFactor([0.5, 0.3, 0.2, 1]));
    mesh.addPrimitive(prim);
  });
  scene.addChild(doc.createNode('prop').setMesh(mesh).setScale([2, 2, 2]));
  return doc;
}

describe('prop surfaces (tools/content/surfaces.mjs)', () => {
  it('reads every mapping file without a problem', () => {
    const { defs, packs } = loadSurfaces();
    expect(defs.has('wood') && defs.has('painted_metal') && defs.has('glass')).toBe(true);
    expect(packs.size).toBeGreaterThan(10);
    // Natural pieces are left to the procedural environment: never surfaced.
    expect(surfaceRules('kenney-survival-kit', 'tree')).toBeNull();
    expect(surfaceRules('kenney-nature-kit', 'oak')).toBeNull();
    // A prop's own rules win over its pack's.
    expect(surfaceRules('kenney-survival-kit', 'tent').default).toBe('fabric');
  });

  it('maps flat materials by name, keeps their colour and adds metre coordinates', async () => {
    const doc = flatModel(['wood', 'carpet', 'plant']);
    const used = await applySurfaces(doc, 'kenney-furniture-kit', 'sofa');
    expect(used).toEqual(['fabric', 'wood']);
    const mats = doc.getRoot().listMaterials();
    const wood = mats.find((m) => m.getExtras()?.surface === 'wood');
    expect(wood.getBaseColorFactor()).toEqual([0.5, 0.3, 0.2, 1]);
    expect(wood.getRoughnessFactor()).toBe(loadSurfaces().defs.get('wood').roughness);
    expect(wood.getExtras().tile).toBeGreaterThan(0);
    // "plant" is "none": left exactly as it was, with no coordinates.
    const prims = doc.getRoot().listMeshes()[0].listPrimitives();
    const plant = prims.find((p) => p.getMaterial().getName() === 'plant');
    expect(plant.getMaterial().getExtras()?.surface).toBeUndefined();
    expect(plant.getAttribute('TEXCOORD_1')).toBeNull();
    // The quad faces +z: projected on x and y, in metres after the node's scale of 2.
    // Whole centimetres (`uv` 0.01 m a unit).
    const uv = prims.find((p) => p.getMaterial() === wood).getAttribute('TEXCOORD_1').getArray();
    expect(wood.getExtras().uv).toBe(0.01);
    expect(Math.max(...uv.filter((_, i) => i % 2 === 0))).toBe(200);
    expect(isSurfaced(doc)).toBe(true);
  });

  it('leaves props of unmapped packs and skipped props alone', async () => {
    const doc = flatModel(['wood']);
    expect(await applySurfaces(doc, 'kenney-nature-kit', 'oak')).toBeNull();
    expect(await applySurfaces(doc, 'kenney-survival-kit', 'rock_large')).toBeNull();
    expect(isSurfaced(doc)).toBe(false);
  });

  it('every surfaced prop in the lock names surfaces that exist', () => {
    const { defs } = loadSurfaces();
    const surfaced = lock.files.filter((f) => f.surfaces);
    for (const f of surfaced) for (const s of f.surfaces) expect(defs.has(s), `${f.file}: ${s}`).toBe(true);
  });
});
