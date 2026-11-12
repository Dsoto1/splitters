import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { insidePart, splitParts } from '../meshy-mesh.mjs';

/** A tire's side wall (a disc of `n` triangles in the YZ plane at `x`, radius `r` about (y, z)) appended to P and I. */
function disc(P, I, x, y, z, r, n = 16) {
  const base = P.length / 3;
  P.push(x, y, z);
  for (let i = 0; i < n; i++) P.push(x, y + r * Math.sin((2 * Math.PI * i) / n), z + r * Math.cos((2 * Math.PI * i) / n));
  for (let i = 0; i < n; i++) I.push(base, base + 1 + i, base + 1 + ((i + 1) % n));
}

/** One small triangle centred on (x, y, z), appended to P and I: a piece of bodywork. */
function patch(P, I, x, y, z) {
  const base = P.length / 3;
  P.push(x, y - 0.02, z - 0.02, x, y + 0.04, z, x, y - 0.02, z + 0.02);
  I.push(base, base + 1, base + 2);
}

/**
 * A body the way the build hands it to splitParts: a holder with a full mesh and a lower level of detail, each a
 * tire side wall (radius 0.5 at the hub (1, 0.5, 2)), a fender patch in the corner of the tire's box (above and ahead
 * of the tire, outside its circle) and a patch of bodywork far from both.
 */
function body() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const material = doc.createMaterial('paint');
  const holder = doc.createNode('holder');
  doc.createScene().addChild(holder);
  for (const lod of [false, true]) {
    const P = [];
    const I = [];
    disc(P, I, 1, 0.5, 2, 0.5);
    patch(P, I, 1, 0.92, 2.42);
    patch(P, I, 0, 1.5, 0);
    const n = P.length / 3;
    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(n * 3).fill(0)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buffer));
    const node = doc.createNode(lod ? 'mesh_lod' : 'mesh').setMesh(doc.createMesh().addPrimitive(prim));
    if (lod) node.setExtras({ lod: { distance: 40 } });
    holder.addChild(node);
  }
  return { doc, holder };
}

const names = (holder) => holder.listChildren().map((n) => n.getName()).sort();
const triangles = (node) => node.getMesh().listPrimitives()[0].getIndices().getCount() / 3;
const find = (holder, name) => holder.listChildren().find((n) => n.getName() === name);
/** The mesh's bounds: [[min], [max]]. */
function bounds(node) {
  const a = node.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3], a[i]);
    hi[i % 3] = Math.max(hi[i % 3], a[i]);
  }
  return [lo, hi];
}

const BOX = [[0.8, 0, 1.5], [1.2, 1, 2.5]];

describe('splitParts', () => {
  it('cuts a boxed part out onto its own pivot node, the fender in the box going with it', () => {
    const { doc, holder } = body();
    splitParts(doc, holder, [{ name: 'wheel_fl', box: BOX, pivot: [1, 0.5, 2] }]);
    expect(names(holder)).toEqual(['hull', 'hull_lod', 'wheel_fl']);
    const wheel = find(holder, 'wheel_fl');
    expect(wheel.getTranslation()).toEqual([1, 0.5, 2]);
    expect(wheel.listChildren().map((n) => n.getName())).toEqual(['wheel_fl_body', 'wheel_fl_body_lod']);
    // The tire's 16 triangles and the fender patch in the box's corner.
    expect(triangles(wheel.listChildren()[0])).toBe(17);
    expect(triangles(find(holder, 'hull'))).toBe(1);
    expect(find(holder, 'hull_lod').getExtras()).toEqual({ lod: { distance: 40 } });
  });

  it('round: only the triangles inside the circle the box holds are the part\'s, so the fender stays on the body', () => {
    const { doc, holder } = body();
    splitParts(doc, holder, [{ name: 'wheel_fl', box: BOX, pivot: [1, 0.5, 2], round: true }]);
    expect(triangles(find(holder, 'wheel_fl').listChildren()[0])).toBe(16);
    expect(triangles(find(holder, 'hull'))).toBe(2);
    // The part's mesh is about its pivot: a wheel of radius 0.5 about its hub.
    const [lo, hi] = bounds(find(holder, 'wheel_fl').listChildren()[0]);
    expect(lo[1]).toBeCloseTo(-0.5, 5);
    expect(hi[1]).toBeCloseTo(0.5, 5);
    expect(lo[2]).toBeCloseTo(-0.5, 5);
    expect(hi[2]).toBeCloseTo(0.5, 5);
  });

  it('drop: the part is cut out of the body, both levels of detail, and nothing is written for it', () => {
    const { doc, holder } = body();
    splitParts(doc, holder, [{ name: 'tire_fl', box: BOX, round: true, drop: true }]);
    expect(names(holder)).toEqual(['hull', 'hull_lod']);
    for (const name of ['hull', 'hull_lod']) {
      const hull = find(holder, name);
      // The fender and the far bodywork stay; nothing of the tire does (it reached down to y 0).
      expect(triangles(hull)).toBe(2);
      expect(bounds(hull)[0][1]).toBeGreaterThan(0.85);
    }
    expect(doc.getRoot().listNodes().some((n) => /tire/.test(n.getName()))).toBe(false);
  });

  it('a kept part needs a pivot, a dropped one takes neither a cap nor children, and an empty box is an error', () => {
    expect(() => splitParts(...Object.values(body()), [{ name: 'wheel_fl', box: BOX }])).toThrow(/needs a pivot/);
    expect(() => splitParts(...Object.values(body()), [{ name: 'tire', box: BOX, drop: true, cap: { y: 0, colour: [0, 0] } }])).toThrow(/dropped/);
    expect(() => splitParts(...Object.values(body()), [{ name: 'tire', box: BOX, drop: true }, { name: 'hub', box: BOX, pivot: [1, 0.5, 2], parent: 'tire' }])).toThrow(/dropped/);
    expect(() => splitParts(...Object.values(body()), [{ name: 'tire', box: [[5, 5, 5], [6, 6, 6]], drop: true }])).toThrow(/no triangles/);
  });
});

describe('insidePart', () => {
  it('a box holds its corners; a round part holds only the ellipse across X', () => {
    const part = { box: [[0, 0, 0], [1, 2, 4]] };
    expect(insidePart(part, [0.5, 1.9, 3.9])).toBe(true);
    expect(insidePart(part, [1.1, 1, 2])).toBe(false);
    const round = { ...part, round: true };
    expect(insidePart(round, [0.5, 1.9, 3.9])).toBe(false);
    expect(insidePart(round, [0.5, 1, 3.9])).toBe(true);
    expect(insidePart(round, [0.5, 1.9, 2])).toBe(true);
    expect(insidePart(round, [1.1, 1, 2])).toBe(false);
  });
});
