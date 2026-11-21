import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { describe, expect, it } from 'vitest';
import { addDeckPlate } from '../deck-plate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function apply(m, [x, y, z]) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/**
 * What a camera straight above sees of a mesh node, cell by cell over [x0, x1] x [z0, z1] (model frame): +1 a face
 * turned up (drawn), -1 a face turned down (culled: what is under it shows through), 0 nothing.
 */
function fromAbove(node, [x0, x1], [z0, z1], cell) {
  const W = Math.ceil((x1 - x0) / cell);
  const H = Math.ceil((z1 - z0) / cell);
  const top = new Float64Array(W * H).fill(-Infinity);
  const face = new Int8Array(W * H);
  const world = node.getWorldMatrix();
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    const P = (i) => apply(world, pos.getElement(i, [0, 0, 0]));
    for (let t = 0; t < idx.getCount(); t += 3) {
      const [a, b, c] = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)].map(P);
      const d = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
      if (Math.abs(d) < 1e-12) continue;
      // The face's up component (glTF: counter-clockwise from the front), - d with x and z as laid out here.
      const up = -d;
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / cell));
      const i1 = Math.min(W - 1, Math.floor((Math.max(a[0], b[0], c[0]) - x0) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - z0) / cell));
      const j1 = Math.min(H - 1, Math.floor((Math.max(a[2], b[2], c[2]) - z0) / cell));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = x0 + (i + 0.5) * cell;
          const z = z0 + (j + 0.5) * cell;
          const u = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / d;
          const v = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / d;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const y = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
          if (y <= top[j * W + i]) continue;
          top[j * W + i] = y;
          face[j * W + i] = up > 0 ? 1 : -1;
        }
    }
  }
  return face;
}

describe('deck plate (tools/content/deck-plate.mjs)', () => {
  it('a plate faces up, takes the floor colour under uvAt, and goes in once', () => {
    const doc = new Document();
    const buf = doc.createBuffer();
    // A floor 4 x 4 m at y 0 with a 1 m hole in the middle (eight triangles round it), uv = (x, z) / 10.
    const pts = [[-2, -2], [2, -2], [2, 2], [-2, 2], [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    const tris = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4];
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setBuffer(buf).setArray(new Float32Array(pts.flatMap(([x, z]) => [x, 0, z]))))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setBuffer(buf).setArray(new Float32Array(pts.flatMap(() => [0, 1, 0]))))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setBuffer(buf).setArray(new Float32Array(pts.flatMap(([x, z]) => [x / 10, z / 10]))))
      .setIndices(doc.createAccessor().setType('SCALAR').setBuffer(buf).setArray(new Uint16Array(tris)));
    const node = doc.createNode('floor').setMesh(doc.createMesh('floor').addPrimitive(prim));
    doc.createScene().addChild(node);
    // The hole shows straight down before.
    expect(fromAbove(node, [-1, 1], [-1, 1], 0.1).filter((f) => f === 0).length).toBeGreaterThan(50);
    expect(addDeckPlate(doc, { y: -0.02, x: [-1.5, 1.5], z: [-1.5, 1.5], uvAt: [1, 1] })).toBe(1);
    const face = fromAbove(node, [-1.9, 1.9], [-1.9, 1.9], 0.1);
    expect(face.every((f) => f === 1)).toBe(true);
    const uv = prim.getAttribute('TEXCOORD_0');
    const n = uv.getCount();
    expect(uv.getElement(n - 1, [0, 0]).map((v) => +v.toFixed(4))).toEqual([0.1, 0.1]);
    expect(prim.getAttribute('NORMAL').getElement(n - 1, [0, 0, 0])).toEqual([0, 1, 0]);
    expect(addDeckPlate(doc, { y: -0.02, x: [-1.5, 1.5], z: [-1.5, 1.5], uvAt: [1, 1] })).toBe(0);
  });

  it("the Dropship's deck shows no ground from above, at every level of detail", async () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'content/guns.json'), 'utf8'));
    const entry = manifest.models.find((e) => e.out === 'vehicles/hover_carrier.glb');
    expect(entry.plate).toBeDefined();
    const doc = await io.read(join(ROOT, 'packages/client/public/models', entry.out));
    const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
    expect(nodes.length).toBe(2);
    for (const node of nodes) {
      // The deck between the hull's sides, from the tailgate to the cockpit's bulkhead (holes were up to 0.6 m wide here).
      const face = fromAbove(node, [-1.6, 1.6], [-4.25, 1.95], 0.05);
      const culled = face.filter((f) => f !== 1).length;
      expect(culled / face.length, node.getName()).toBeLessThan(0.002);
      expect(node.getMesh().getExtras()?.deckPlate, node.getName()).toBe(true);
    }
  });
});
