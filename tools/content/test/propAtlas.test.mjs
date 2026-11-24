import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { describe, expect, it } from 'vitest';
import { ATLAS_VERSION, applyAtlas, bakeColours, isAtlased, packColours } from '../prop-atlas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Two parts sharing one vertex list (as the household items' converter writes them), each its own flat colour, and a
 * textured third part.
 */
function model() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh();
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 0, 0, 2, 1, 0])).setBuffer(buffer);
  const white = doc.createMaterial('White').setBaseColorFactor([0.36, 0.36, 0.36, 1]).setRoughnessFactor(0.8).setMetallicFactor(0);
  const blue = doc.createMaterial('Blue 2').setBaseColorFactor([0.0032, 0.0434, 0.0449, 1]).setRoughnessFactor(0.8).setMetallicFactor(0);
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer)).setMaterial(white));
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([1, 4, 5, 1, 5, 2])).setBuffer(buffer)).setMaterial(blue));
  const tex = doc.createTexture('colormap').setImage(new Uint8Array([1, 2, 3, 4])).setMimeType('image/png');
  const pos2 = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 1, 1, 0, 1, 1, 1, 1])).setBuffer(buffer);
  const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array([0, 0, 1, 0, 1, 1])).setBuffer(buffer);
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos2).setAttribute('TEXCOORD_0', uv).setMaterial(doc.createMaterial('colormap').setBaseColorTexture(tex)));
  doc.createScene().addChild(doc.createNode('prop').setMesh(mesh));
  return { doc, white, blue };
}

const colours = (prim) => {
  const a = prim.getAttribute('COLOR_0');
  const out = [];
  const el = [];
  for (let i = 0; i < a.getCount(); i++) out.push(a.getElement(i, el).slice());
  return out;
};

describe('prop material atlas (tools/content/prop-atlas.mjs)', () => {
  it("moves flat colours into the vertices and gives a pack's same-kind materials one key", () => {
    const { doc, white, blue } = model();
    const kinds = applyAtlas(doc, 'pack-a');
    // White and Blue 2 differ only in colour: one kind. The textured part is its own.
    expect(kinds).toBe(2);
    const [pw, pb, pt] = doc.getRoot().listMeshes()[0].listPrimitives();
    expect(white.getExtras().atlas).toBe(blue.getExtras().atlas);
    expect(white.getExtras().atlas).toMatch(/^pack-a\//);
    expect(pt.getMaterial().getExtras().atlas).not.toBe(white.getExtras().atlas);
    // The colour moved: the materials are white (alpha kept), the vertices carry it; the old colour is in the extras.
    expect(white.getBaseColorFactor()).toEqual([1, 1, 1, 1]);
    expect(white.getExtras().atlasColor).toEqual([0.36, 0.36, 0.36]);
    for (const c of colours(pw)) for (const v of c) expect(v).toBeCloseTo(0.36, 2);
    // Near-black: 16 bits (8 would lift 0.0032 by a fifth).
    expect(pb.getAttribute('COLOR_0').getComponentType()).toBe(5123);
    for (const c of colours(pb)) expect(c[0]).toBeCloseTo(0.0032, 4);
    // The shared vertex list was split: the first part got its own copy of the vertices it uses (indices renumbered);
    // the second, then the list's only user, kept it.
    expect(pw.getAttribute('POSITION')).not.toBe(pb.getAttribute('POSITION'));
    expect(pw.getAttribute('POSITION').getCount()).toBe(4);
    expect(Array.from(pw.getIndices().getArray())).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(pw.getAttribute('POSITION').getElement(3, []))).toEqual([0, 1, 0]);
    expect(pb.getAttribute('POSITION').getCount()).toBe(6);
    expect(Array.from(pb.getIndices().getArray())).toEqual([1, 4, 5, 1, 5, 2]);
    // Textured: keyed only (its colours and coordinates untouched).
    expect(pt.getAttribute('COLOR_0')).toBeNull();
    expect(isAtlased(doc)).toBe(true);
  });

  it('is done once: a second pass changes nothing', () => {
    const { doc, white } = model();
    applyAtlas(doc, 'pack-a');
    const key = white.getExtras().atlas;
    const before = colours(doc.getRoot().listMeshes()[0].listPrimitives()[0]);
    expect(applyAtlas(doc, 'pack-a')).toBe(2);
    expect(white.getExtras().atlas).toBe(key);
    expect(colours(doc.getRoot().listMeshes()[0].listPrimitives()[0])).toEqual(before);
    expect(white.getExtras().atlasVersion).toBe(ATLAS_VERSION);
  });

  it('keys by kind: other roughness, alpha or pack is another kind; skipped materials are left alone', () => {
    const a = model();
    const b = model();
    b.blue.setRoughnessFactor(0.4);
    applyAtlas(a.doc, 'pack-a');
    applyAtlas(b.doc, 'pack-a', { skip: ['White'] });
    expect(b.blue.getExtras().atlas).not.toBe(a.blue.getExtras().atlas);
    expect(b.white.getExtras().atlas).toBeUndefined();
    expect(b.white.getBaseColorFactor()).toEqual([0.36, 0.36, 0.36, 1]);
    const c = model();
    applyAtlas(c.doc, 'pack-b');
    expect(c.white.getExtras().atlas).not.toBe(a.white.getExtras().atlas);
    // The same pack and kind in another model: the same key (shared by the game).
    const d = model();
    applyAtlas(d.doc, 'pack-a');
    expect(d.white.getExtras().atlas).toBe(a.white.getExtras().atlas);
  });

  it('multiplies into vertex colours already there and packs to 8 bits only when that shows the same', () => {
    const baked = Array.from(bakeColours(2, [0.5, 1, 0.25], new Float32Array([1, 0.5, 1, 1, 0.2, 0.4, 0.8, 1]), 4));
    [0.5, 0.5, 0.25, 0.1, 0.4, 0.2].forEach((v, i) => expect(baked[i]).toBeCloseTo(v, 6));
    expect(packColours(new Float32Array([0.36, 0.5, 1]))).toBeInstanceOf(Uint8Array);
    expect(packColours(new Float32Array([0.36, 0.0032, 1]))).toBeInstanceOf(Uint16Array);
  });

  it('the built household sink and mirror share one atlas material', async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const keys = async (id) => {
      const doc = await io.readBinary(new Uint8Array(readFileSync(join(ROOT, 'packages/client/public/props', `${id}.glb`))));
      return new Set(doc.getRoot().listMaterials().map((m) => m.getExtras()?.atlas));
    };
    const sink = await keys('hh_cupboard_sink');
    const mirror = await keys('hh_mirror');
    expect(sink.size).toBe(1);
    expect([...mirror]).toEqual([...sink]);
  });
});
