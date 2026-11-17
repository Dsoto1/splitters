// A deck plate for a built model whose floor the cut left holes in (content/guns.json `plate` on an entry): one flat
// rectangle, facing up, a little under the floor, added to every level of detail. Where the floor is whole it hides
// the plate; where the cut left a hole, you see the plate instead of the hull's underside from inside (culled, so the
// ground showed through). It takes the floor's own colour: every corner gets the colour map's coordinates of the floor
// straight under `uvAt`.
//
// The Dropship (vehicles/hover_carrier.glb, 2026-11-17): its cut deck has long triangular holes between the aisle and
// the benches, 0.2 m deep to the hull's bottom, whose faces point down and out; seen from above, the ground showed
// through them (owner's screenshot). `plate: { y, x: [min, max], z: [min, max], uvAt: [x, z] }`, or a list of them
// (the Dropship's: the deck, and a sliver at each bench's front corner by the hull), in the built model's frame
// (metres, glTF axes: +y up), inside the hull's walls.
//
// prepare-guns.mjs adds it when it builds the entry from the download. Without the download (it is on the owner's
// Drive, not here), this adds it to the built file and updates content/guns.lock.json:
//
//   node tools/content/deck-plate.mjs            every entry with a `plate` whose built file has none yet
//   OUT=<dir> node tools/content/deck-plate.mjs  a trial: the files written to <dir>, the lock left alone

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, quantize } from '@gltf-transform/functions';
import { MESHY_QUANTIZE } from './meshy-mesh.mjs';
import { readLock, writeLock } from './lockfile.mjs';

/** Multiply a column-major 4x4 matrix by a point. */
function apply(m, [x, y, z]) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/** The inverse of an affine column-major 4x4 matrix. */
function invert(m) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const r = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const out = [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1];
  out[12] = -(out[0] * t[0] + out[4] * t[1] + out[8] * t[2]);
  out[13] = -(out[1] * t[0] + out[5] * t[1] + out[9] * t[2]);
  out[14] = -(out[2] * t[0] + out[6] * t[1] + out[10] * t[2]);
  return out;
}

/**
 * The colour map coordinates of the highest face that faces up under (x, z) (model frame), or null: the floor the
 * plate stands in for.
 */
function floorUv(prim, world, [x, z]) {
  const pos = prim.getAttribute('POSITION');
  const uv = prim.getAttribute('TEXCOORD_0');
  const idx = prim.getIndices();
  if (!uv || !idx) return null;
  const P = (i) => apply(world, pos.getElement(i, [0, 0, 0]));
  let best = null;
  for (let t = 0; t < idx.getCount(); t += 3) {
    const ids = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)];
    const [a, b, c] = ids.map(P);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny <= 0) continue;
    const d = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
    const u = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / d;
    const v = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / d;
    if (u < 0 || v < 0 || u + v > 1) continue;
    const y = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
    if (best && best.y >= y) continue;
    const [ua, ub, uc] = ids.map((i) => uv.getElement(i, [0, 0]));
    best = { y, uv: [ua[0] + u * (ub[0] - ua[0]) + v * (uc[0] - ua[0]), ua[1] + u * (ub[1] - ua[1]) + v * (uc[1] - ua[1])] };
  }
  return best?.uv ?? null;
}

/** Append a float attribute's new elements (a fresh accessor, the old one's data plus `extra`). */
function extend(doc, prim, sem, extra) {
  const acc = prim.getAttribute(sem);
  const old = acc.getArray();
  const arr = new Float32Array(old.length + extra.length);
  arr.set(old);
  arr.set(extra, old.length);
  acc.setArray(arr);
}

/**
 * Add the plate (see the file's comment) to every mesh of an unquantized document, in each mesh's own frame. Meshes
 * already carrying one (mesh extras `deckPlate`) are left alone. Returns how many meshes got it.
 */
export function addDeckPlate(doc, plate) {
  const plates = Array.isArray(plate) ? plate : [plate];
  for (const { x: [x0, x1], z: [z0, z1] } of plates) if (!(x1 > x0 && z1 > z0)) throw new Error('plate: x and z are [min, max]');
  let n = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || mesh.getExtras()?.deckPlate) continue;
    const world = node.getWorldMatrix();
    const local = invert(world);
    for (const prim of mesh.listPrimitives()) for (const { y, x: [x0, x1], z: [z0, z1], uvAt } of plates) {
      const pos = prim.getAttribute('POSITION');
      if (pos.getNormalized() || pos.getComponentType() !== 5126) throw new Error('plate: dequantize the document first');
      const uv = floorUv(prim, world, uvAt);
      if (!uv) throw new Error(`plate: no floor facing up under ${uvAt} in ${node.getName()}`);
      const corners = [[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]].map((p) => apply(local, p));
      // Up in the mesh's frame (its normal).
      const o = apply(local, [0, 0, 0]);
      const up = apply(local, [0, 1, 0]).map((v, i) => v - o[i]);
      const len = Math.hypot(...up);
      const normal = up.map((v) => v / len);
      const first = pos.getCount();
      extend(doc, prim, 'POSITION', corners.flat());
      for (const sem of prim.listSemantics()) {
        if (sem === 'POSITION') continue;
        const size = prim.getAttribute(sem).getElementSize();
        if (sem === 'NORMAL') extend(doc, prim, sem, [...normal, ...normal, ...normal, ...normal]);
        else if (sem === 'TEXCOORD_0') extend(doc, prim, sem, [...uv, ...uv, ...uv, ...uv]);
        else if (sem === 'TANGENT') {
          const ax = apply(local, [1, 0, 0]).map((v, i) => v - o[i]);
          const l = Math.hypot(...ax);
          const t = [...ax.map((v) => v / l), 1];
          extend(doc, prim, sem, [...t, ...t, ...t, ...t]);
        } else extend(doc, prim, sem, new Array(size * 4).fill(0));
      }
      // Wound so the face points up (glTF: counter-clockwise from the front).
      const tris = [first, first + 1, first + 2, first, first + 2, first + 3];
      const idx = prim.getIndices();
      const old = idx.getArray();
      const arr = new (first + 4 > 65535 ? Uint32Array : old.constructor)(old.length + 6);
      arr.set(old);
      arr.set(tris, old.length);
      idx.setArray(arr);
    }
    mesh.setExtras({ ...mesh.getExtras(), deckPlate: true });
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- the built files

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

function triangles(doc) {
  let all = 0;
  let lod = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const t = mesh.listPrimitives().reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
    if (node.getExtras()?.lod) lod += t;
    else all += t;
  }
  return { triangles: all, lodTriangles: lod };
}

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const trial = process.env.OUT ? resolve(process.env.OUT) : null;
  const manifest = JSON.parse(readFileSync(join(ROOT, 'content/guns.json'), 'utf8'));
  const lockPath = join(ROOT, 'content/guns.lock.json');
  const lock = readLock(lockPath);
  for (const entry of manifest.models.filter((e) => e.plate)) {
    const file = `models/${entry.out}`;
    const path = join(ROOT, 'packages/client/public', file);
    const doc = await io.read(path);
    if (doc.getRoot().listMeshes().every((m) => m.getExtras()?.deckPlate)) {
      console.log(`kept  ${file} (has its plate)`);
      continue;
    }
    await doc.transform(dequantize());
    const n = addDeckPlate(doc, entry.plate);
    await doc.transform(quantize(MESHY_QUANTIZE));
    const glb = Buffer.from(await io.writeBinary(doc));
    const out = trial ? join(trial, file) : path;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, glb);
    console.log(`plated ${file}: ${n} meshes, ${glb.byteLength} B`);
    if (trial) continue;
    const row = lock.files.find((f) => f.file === file);
    Object.assign(row, triangles(doc), { bytes: glb.byteLength, sha256: sha(glb) });
  }
  if (!trial) writeLock(lockPath, lock);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
