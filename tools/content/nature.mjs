// Game-ready plants, trees and rocks from dense scanned-style meshes (the
// Meshy community downloads: one textured mesh of 0.1–2.5 M triangles with a
// fragmented UV atlas, so neither the triangles nor the texture survive a
// normal decimation). Each model is:
//
// 1. read from its FBX (tools/content/fbx.mjs), turned, scaled to `height`
//    metres, centred on its footprint and stood on y = 0;
// 2. welded by position alone (the UV seams are what stop the simplifier) and
//    simplified with meshoptimizer to each level of detail's triangle count;
// 3. painted: each simplified face takes the area-weighted average colour of
//    the original faces nearest it, read from the colour map (so trunk, leaves,
//    bark and flowers keep their colours as a low-poly painted look; no image
//    ships, the colours are per face);
// 4. written as one GLB: LOD0 as the prop's mesh, the lighter levels and an
//    optional impostor (a picture of the model on a camera-facing card,
//    rendered here by tools/content/raster.mjs) as extra nodes whose `extras`
//    say `{ lod, distance }` (and `billboard` for the card). The client's
//    ModelLibrary turns them into Babylon LOD levels; everything else sees
//    only LOD0.

import { readFileSync } from 'node:fs';
import { Document } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { fbxToDocument } from './fbx.mjs';
import { dilate, rasterize } from './raster.mjs';

await MeshoptSimplifier.ready;

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** The FBX as a triangle soup: positions and UVs per corner, and its colour map's pixels. */
export async function readSoup(fbxPath, mapPath = null) {
  const { doc } = await fbxToDocument(fbxPath, { keepUv: true });
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const total = prims.reduce((n, p) => n + p.getAttribute('POSITION').getCount(), 0);
  const P = new Float32Array(total * 3);
  const UV = new Float32Array(total * 2);
  let at = 0;
  let image = null;
  for (const p of prims) {
    const pos = p.getAttribute('POSITION').getArray();
    P.set(pos, at * 3);
    const uv = p.getAttribute('TEXCOORD_0')?.getArray();
    if (uv) UV.set(uv, at * 2);
    at += pos.length / 3;
    image ??= p.getMaterial()?.getBaseColorTexture()?.getImage() ?? null;
  }
  if (mapPath) image = readFileSync(mapPath);
  if (!image) throw new Error(`${fbxPath}: no colour map`);
  // Shrunk with a box filter: each texel is the average of a patch, which is what a face's colour should be.
  const tex = 512;
  const { data } = await sharp(Buffer.from(image)).removeAlpha().resize(tex, tex, { kernel: 'cubic' }).raw().toBuffer({ resolveWithObject: true });
  return { P, UV, tex: { data, size: tex } };
}

/** Linear colour of the map at (u, v) (bilinear). */
function sample(tex, u, v) {
  const s = tex.size;
  const x = Math.min(s - 1, Math.max(0, (u - Math.floor(u)) * s - 0.5));
  const y = Math.min(s - 1, Math.max(0, (v - Math.floor(v)) * s - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(s - 1, x0 + 1);
  const y1 = Math.min(s - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const c = (i) => tex.data[i * 3 + k] / 255;
    const top = c(y0 * s + x0) * (1 - fx) + c(y0 * s + x1) * fx;
    const bot = c(y1 * s + x0) * (1 - fx) + c(y1 * s + x1) * fx;
    out[k] = toLinear(top * (1 - fy) + bot * fy);
  }
  return out;
}

/**
 * Turn (degrees about +Y), scale to `height` (or by `scale`) and stand the soup
 * on y = 0, centred on its footprint. Returns the size [w, h, d] in metres.
 */
export function normalise(P, { yaw = 0, height, scale }) {
  const c = Math.cos((yaw * Math.PI) / 180);
  const s = Math.sin((yaw * Math.PI) / 180);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) {
    const x = c * P[i] + s * P[i + 2];
    const z = -s * P[i] + c * P[i + 2];
    P[i] = x;
    P[i + 2] = z;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], P[i + k]);
      max[k] = Math.max(max[k], P[i + k]);
    }
  }
  const f = height ? height / (max[1] - min[1]) : (scale ?? 1);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  for (let i = 0; i < P.length; i += 3) {
    P[i] = (P[i] - cx) * f;
    P[i + 1] = (P[i + 1] - min[1]) * f;
    P[i + 2] = (P[i + 2] - cz) * f;
  }
  return [(max[0] - min[0]) * f, (max[1] - min[1]) * f, (max[2] - min[2]) * f];
}

/** Drop the corners below `y` (a scene's ground plate), whole triangles at a time. */
export function cutBelow(soup, y) {
  const { P, UV } = soup;
  const keep = [];
  for (let t = 0; t < P.length / 9; t++) if (Math.max(P[t * 9 + 1], P[t * 9 + 4], P[t * 9 + 7]) >= y) keep.push(t);
  const P2 = new Float32Array(keep.length * 9);
  const UV2 = new Float32Array(keep.length * 6);
  keep.forEach((t, i) => {
    P2.set(P.subarray(t * 9, t * 9 + 9), i * 9);
    UV2.set(UV.subarray(t * 6, t * 6 + 6), i * 6);
  });
  return { ...soup, P: P2, UV: UV2 };
}

/** Indexed mesh from the soup, vertices merged by position alone (UV seams ignored). */
function weldPositions(P) {
  const n = P.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], P[i * 3 + k]);
      max[k] = Math.max(max[k], P[i * 3 + k]);
    }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const Q = 131071;
  const map = new Map();
  const index = new Uint32Array(n);
  const verts = [];
  for (let i = 0; i < n; i++) {
    const q = [0, 1, 2].map((k) => Math.round(((P[i * 3 + k] - min[k]) / span) * Q));
    const key = (q[0] * 131072 + q[1]) * 131072 + q[2];
    let v = map.get(key);
    if (v === undefined) {
      v = verts.length / 3;
      map.set(key, v);
      verts.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    }
    index[i] = v;
  }
  return { positions: new Float32Array(verts), index };
}

/**
 * The welded mesh simplified to about `target` triangles: meshoptimizer's
 * simplifier first (keeps the shape), its sloppy one where that can't get down
 * far enough (fern fronds and grass blades are many small separate pieces).
 */
function simplifyTo(welded, target, flags = ['Prune']) {
  const { positions, index } = welded;
  if (index.length / 3 <= target) return index;
  let [out] = MeshoptSimplifier.simplify(index, positions, 3, target * 3, 1, flags);
  if (out.length / 3 > target * 1.25) [out] = MeshoptSimplifier.simplifySloppy(out, positions, 3, null, target * 3, 1);
  return out;
}

/**
 * Per-face colours for the simplified mesh: every original face's colour
 * (sampled at its centre and corners) goes, weighted by its area, to the
 * simplified face whose centre is nearest (looked up in a grid).
 */
function paintFaces(soup, positions, index, grade) {
  const { P, UV, tex } = soup;
  const nf = index.length / 3;
  const C = new Float32Array(nf * 3);
  const centre = new Float32Array(nf * 3);
  for (let f = 0; f < nf; f++)
    for (let k = 0; k < 3; k++) centre[f * 3 + k] = (positions[index[f * 3] * 3 + k] + positions[index[f * 3 + 1] * 3 + k] + positions[index[f * 3 + 2] * 3 + k]) / 3;
  // Grid cell about the size of a simplified face.
  let area = 0;
  for (let f = 0; f < nf; f++) area += triArea(positions, index[f * 3], index[f * 3 + 1], index[f * 3 + 2]);
  const cell = Math.max(1e-3, Math.sqrt(area / nf) * 1.5);
  const grid = new Map();
  const K = 4096;
  const key3 = (gx, gy, gz) => ((gx + 2048) * K + (gy + 2048)) * K + (gz + 2048);
  const keyOf = (x, y, z) => key3(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell));
  for (let f = 0; f < nf; f++) {
    const k = keyOf(centre[f * 3], centre[f * 3 + 1], centre[f * 3 + 2]);
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(f);
  }
  const nearest = (x, y, z) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const gz = Math.floor(z / cell);
    for (let r = 1; r <= 6; r++) {
      let best = -1;
      let bd = Infinity;
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (let dz = -r; dz <= r; dz++) {
            if (r > 1 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < r) continue;
            for (const f of grid.get(key3(gx + dx, gy + dy, gz + dz)) ?? []) {
              const d = (centre[f * 3] - x) ** 2 + (centre[f * 3 + 1] - y) ** 2 + (centre[f * 3 + 2] - z) ** 2;
              if (d < bd) [bd, best] = [d, f];
            }
          }
      if (best >= 0) return best;
    }
    return -1;
  };
  const weight = new Float32Array(nf);
  const no = P.length / 9;
  const fallback = [0, 0, 0];
  let fw = 0;
  for (let t = 0; t < no; t++) {
    const a = triAreaSoup(P, t);
    let col = [0, 0, 0];
    const uv = (k) => [UV[t * 6 + k * 2], UV[t * 6 + k * 2 + 1]];
    const pts = [uv(0), uv(1), uv(2), [(UV[t * 6] + UV[t * 6 + 2] + UV[t * 6 + 4]) / 3, (UV[t * 6 + 1] + UV[t * 6 + 3] + UV[t * 6 + 5]) / 3]];
    for (const [u, v] of pts) col = col.map((c, k) => c + sample(tex, u, v)[k] / pts.length);
    const f = nearest((P[t * 9] + P[t * 9 + 3] + P[t * 9 + 6]) / 3, (P[t * 9 + 1] + P[t * 9 + 4] + P[t * 9 + 7]) / 3, (P[t * 9 + 2] + P[t * 9 + 5] + P[t * 9 + 8]) / 3);
    const w = a + 1e-9;
    for (let k = 0; k < 3; k++) fallback[k] += col[k] * w;
    fw += w;
    if (f < 0) continue;
    for (let k = 0; k < 3; k++) C[f * 3 + k] += col[k] * w;
    weight[f] += w;
  }
  for (let f = 0; f < nf; f++)
    for (let k = 0; k < 3; k++) C[f * 3 + k] = grade(weight[f] ? C[f * 3 + k] / weight[f] : fallback[k] / fw, k);
  return C;
}

const triArea = (V, a, b, c) => {
  const e1 = [0, 1, 2].map((k) => V[b * 3 + k] - V[a * 3 + k]);
  const e2 = [0, 1, 2].map((k) => V[c * 3 + k] - V[a * 3 + k]);
  return Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
};
const triAreaSoup = (P, t) => triArea(P, t * 3, t * 3 + 1, t * 3 + 2);

/** Linear rgb floats as normalised rgba bytes (a quarter of the size; colours per face need no more). */
function toBytes(C) {
  const out = new Uint8Array((C.length / 3) * 4);
  for (let i = 0; i < C.length / 3; i++) {
    for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.round(Math.min(1, Math.max(0, C[i * 3 + k])) * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Flat-shaded corners of an indexed mesh with per-face colours: { P, N, C } per corner. */
function flatCorners(positions, index, faceColors) {
  const nf = index.length / 3;
  const P = new Float32Array(nf * 9);
  const N = new Float32Array(nf * 9);
  const C = new Float32Array(nf * 9);
  for (let f = 0; f < nf; f++) {
    for (let k = 0; k < 3; k++) P.set(positions.subarray(index[f * 3 + k] * 3, index[f * 3 + k] * 3 + 3), f * 9 + k * 3);
    const e1 = [0, 1, 2].map((k) => P[f * 9 + 3 + k] - P[f * 9 + k]);
    const e2 = [0, 1, 2].map((k) => P[f * 9 + 6 + k] - P[f * 9 + k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n) || 1;
    for (let k = 0; k < 3; k++) {
      N.set(n.map((v) => v / l), f * 9 + k * 3);
      C.set(faceColors.subarray(f * 3, f * 3 + 3), f * 9 + k * 3);
    }
  }
  return { P, N, C };
}

/**
 * Build the LOD chain (and impostor) of one model into a glTF document.
 * `lods`: [{ triangles, distance }] (the first is LOD0, distance where it gives way to the next);
 * `impostor`: { distance, size } or null; `grade`: (linear value, channel) → linear value;
 * `doubleSided`: thin leaves and blades. Returns { doc, size, triangles: [per level] }.
 */
export async function buildNatureDocument(soup, { lods, impostor = null, grade = (v) => v, doubleSided = false, name = 'model', remesh = 0, shell = false, flags = ['Prune'] }) {
  let welded = weldPositions(soup.P);
  if (remesh) {
    // Clouds of separate leaves and blades (a canopy, a fern) can't be simplified piece by piece: rebuild the
    // surface on a voxel grid first (`remesh` cells along the longest side), which closes them into masses.
    const out = MeshoptSimplifier.remesh(welded.index, welded.positions, 3, remesh, shell ? ['Shell'] : []);
    welded = weldPositions(out);
  }
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  const material = doc.createMaterial(`${name}_painted`).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(doubleSided);
  const triangles = [];
  let lod0 = null;
  for (let i = 0; i < lods.length; i++) {
    const index = simplifyTo(welded, lods[i].triangles, flags);
    const colors = paintFaces(soup, welded.positions, index, grade);
    const { P, N, C } = flatCorners(welded.positions, index, colors);
    if (i === 0) lod0 = { P, C };
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(toBytes(C)).setNormalized(true).setBuffer(buffer))
      .setMaterial(material);
    const node = doc.createNode(i ? `${name}_lod${i}` : name).setMesh(doc.createMesh(i ? `${name}_lod${i}` : name).addPrimitive(prim));
    // Where this level gives way to the next (LOD0's is read from the next level's `distance`).
    if (i) node.setExtras({ lod: i, distance: lods[i - 1].distance });
    scene.addChild(node);
    triangles.push(P.length / 9);
  }
  if (impostor) {
    // The model from the side, cut out, on a card that turns to face the camera about its upright axis.
    const W = impostor.size / 2;
    const H = impostor.size;
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymax = 0;
    for (let i = 0; i < lod0.P.length; i += 3) {
      const r = Math.hypot(lod0.P[i], lod0.P[i + 2]);
      xmin = Math.min(xmin, -r);
      xmax = Math.max(xmax, r);
      ymax = Math.max(ymax, lod0.P[i + 1]);
    }
    const half = Math.max(-xmin, xmax) * 0.82;
    const frame = [-half, 0, half, ymax];
    // Two views averaged: a tree looks the same from every side as far as a card can tell.
    const views = [0, 90].map((yaw) => rasterize(lod0.P, lod0.C, { width: W, height: H, yaw, frame, ambient: 0.55, light: 0.55 }).data);
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const hits = views.filter((v) => v[i * 4 + 3]);
      if (!hits.length) continue;
      for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(hits.reduce((s, v) => s + v[i * 4 + k], 0) / hits.length);
      data[i * 4 + 3] = 255;
    }
    dilate(data, W, H, 6);
    const png = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } }).png({ palette: true, colours: 64 }).toBuffer();
    const cardMat = doc
      .createMaterial(`${name}_impostor`)
      .setBaseColorTexture(doc.createTexture(`${name}_impostor`).setImage(png).setMimeType('image/png'))
      .setAlphaMode('MASK')
      .setAlphaCutoff(0.5)
      .setMetallicFactor(0)
      .setRoughnessFactor(1)
      .setDoubleSided(true);
    // The card's height is the model's; its width the frame's (fitted the same way the picture was).
    const sc = Math.min(W / (2 * half), H / ymax);
    const w = W / sc / 2;
    const h = H / sc;
    const y0 = ymax - h;
    const P = new Float32Array([-w, y0, 0, w, y0, 0, w, y0 + h, 0, -w, y0, 0, w, y0 + h, 0, -w, y0 + h, 0]);
    const N = new Float32Array(18);
    for (let i = 0; i < 6; i++) N[i * 3 + 2] = 1;
    // glTF UV: v down from the image's top.
    const UVs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(UVs).setBuffer(buffer))
      .setMaterial(cardMat);
    const node = doc.createNode(`${name}_impostor`).setMesh(doc.createMesh(`${name}_impostor`).addPrimitive(prim));
    node.setExtras({ lod: lods.length, distance: impostor.distance, billboard: true });
    scene.addChild(node);
    triangles.push(2);
  }
  return { doc, triangles };
}
