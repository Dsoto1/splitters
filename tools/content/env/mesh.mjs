// Mesh building for the environment generator, in GAME space (x right, y up, z forward: the space map entities,
// collision shapes and the renderer use), plus the GLB writer that turns it into glTF space so Babylon's importer
// (which mirrors x) puts every vertex back where the shapes say. Front faces wind counter-clockwise seen from
// outside in game space (cross(b - a, c - a) points out).

import { Document, NodeIO } from '@gltf-transform/core';

// ---------------------------------------------------------------- vectors

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Any unit vector perpendicular to `d`. */
export function perp(d) {
  const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return norm(cross(d, a));
}
/** Rotate `v` about unit axis `k` by `t` radians (Rodrigues). */
export function rotate(v, k, t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
}

// ---------------------------------------------------------------- mesh

/**
 * An indexed triangle mesh with per-vertex normal, uv, colour (linear rgb) and wind (x: sway weight, 0 at the
 * ground to 1 at branch tips; y: flutter weight, leaves only).
 */
export class Mesh {
  constructor() {
    this.P = [];
    this.N = [];
    this.UV = [];
    this.C = [];
    this.W = [];
    this.I = [];
  }

  get vertexCount() {
    return this.P.length / 3;
  }

  get triangles() {
    return this.I.length / 3;
  }

  vertex(p, n, uv = [0, 0], c = [1, 1, 1], w = [0, 0]) {
    this.P.push(p[0], p[1], p[2]);
    this.N.push(n[0], n[1], n[2]);
    this.UV.push(uv[0], uv[1]);
    this.C.push(c[0], c[1], c[2]);
    this.W.push(w[0], w[1]);
    return this.P.length / 3 - 1;
  }

  tri(a, b, c) {
    this.I.push(a, b, c);
  }

  quad(a, b, c, d) {
    this.I.push(a, b, c, a, c, d);
  }

  /** Append another mesh. */
  append(m) {
    const o = this.vertexCount;
    this.P.push(...m.P);
    this.N.push(...m.N);
    this.UV.push(...m.UV);
    this.C.push(...m.C);
    this.W.push(...m.W);
    for (const i of m.I) this.I.push(i + o);
    return this;
  }

  /** Axis-aligned bounds [min, max]. */
  bounds() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.P.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], this.P[i + k]);
        max[k] = Math.max(max[k], this.P[i + k]);
      }
    return [min, max];
  }

  /** Recompute smooth normals from the faces (area weighted). */
  smoothNormals() {
    const n = new Float64Array(this.P.length);
    const p = (i) => [this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]];
    for (let t = 0; t < this.I.length; t += 3) {
      const [a, b, c] = [this.I[t], this.I[t + 1], this.I[t + 2]];
      const f = cross(sub(p(b), p(a)), sub(p(c), p(a)));
      for (const v of [a, b, c]) for (let k = 0; k < 3; k++) n[v * 3 + k] += f[k];
    }
    for (let v = 0; v < this.vertexCount; v++) {
      const u = norm([n[v * 3], n[v * 3 + 1], n[v * 3 + 2]]);
      this.N[v * 3] = u[0];
      this.N[v * 3 + 1] = u[1];
      this.N[v * 3 + 2] = u[2];
    }
    return this;
  }
}

// ---------------------------------------------------------------- GLB

const R = (x, q = 1e4) => Math.round(x * q) / q;
const byte = (list) => Uint8Array.from(list, (x) => Math.round(Math.min(1, Math.max(0, x)) * 255));

/**
 * Write a model as GLB. `lods`: [{ distance, parts: [{ material, mesh }], billboard? }] (level 0 first; `distance`
 * is where the level takes over). Materials: { name: { color?, alpha?: 'MASK', cutoff?, doubleSided?, texture?: PNG
 * buffer } }. Level 0 is the plain node `name`; lighter levels carry glTF extras { lod, distance } as
 * tools/content/nature.mjs writes them (client ModelLibrary and environment renderer read the same contract).
 * Returns the GLB bytes.
 */
export async function writeModel(name, lods, materials) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  const mats = new Map();
  const material = (id) => {
    if (mats.has(id)) return mats.get(id);
    const spec = materials[id] ?? {};
    const m = doc
      .createMaterial(id)
      .setBaseColorFactor([...(spec.color ?? [1, 1, 1]), 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(spec.roughness ?? 0.9)
      .setDoubleSided(!!spec.doubleSided);
    if (spec.alpha === 'MASK') m.setAlphaMode('MASK').setAlphaCutoff(spec.cutoff ?? 0.5);
    if (spec.texture) m.setBaseColorTexture(doc.createTexture(`${id}_tex`).setImage(spec.texture).setMimeType('image/png'));
    mats.set(id, m);
    return m;
  };
  lods.forEach((level, i) => {
    const mesh = doc.createMesh(i ? `${name}_lod${i}` : name);
    for (const { material: id, mesh: m } of level.parts) {
      if (!m.triangles) continue;
      // Game space → glTF space: x mirrored (Babylon's importer mirrors it back), so faces turn the other way.
      const P = new Float32Array(m.P.length);
      const N = new Float32Array(m.N.length);
      for (let v = 0; v < m.P.length; v += 3) {
        P[v] = R(-m.P[v]);
        P[v + 1] = R(m.P[v + 1]);
        P[v + 2] = R(m.P[v + 2]);
        const n = norm([-m.N[v], m.N[v + 1], m.N[v + 2]]);
        N[v] = R(n[0]);
        N[v + 1] = R(n[1]);
        N[v + 2] = R(n[2]);
      }
      const I = m.vertexCount > 65535 ? new Uint32Array(m.I.length) : new Uint16Array(m.I.length);
      for (let t = 0; t < m.I.length; t += 3) {
        I[t] = m.I[t];
        I[t + 1] = m.I[t + 2];
        I[t + 2] = m.I[t + 1];
      }
      const prim = doc
        .createPrimitive()
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(I).setBuffer(buffer))
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(m.UV.map((x) => R(x, 1e5)))).setBuffer(buffer))
        // Wind weights and colours as normalised bytes (glTF allows both): a third less per vertex than floats.
        .setAttribute('TEXCOORD_1', doc.createAccessor().setType('VEC2').setArray(byte(m.W)).setNormalized(true).setBuffer(buffer))
        .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(byte(m.C)).setNormalized(true).setBuffer(buffer))
        .setMaterial(material(id));
      mesh.addPrimitive(prim);
    }
    const node = doc.createNode(i ? `${name}_lod${i}` : name).setMesh(mesh);
    if (i) node.setExtras({ lod: i, distance: level.distance, ...(level.billboard ? { crossed: true } : {}) });
    scene.addChild(node);
  });
  return Buffer.from(await new NodeIO().writeBinary(doc));
}
