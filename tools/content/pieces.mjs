// A tiny solid modeller for pieces we build ourselves (Style Packs): boxes,
// cylinders, rings, spheres and flat quads in metres, grouped by material and
// written as glTF meshes with gltf-transform. Everything here is our own work,
// authored as code, so it can be rebuilt exactly from the repo.
import { Document } from '@gltf-transform/core';

/** Rotations applied to a part before it is placed: turn a Y-axis cylinder to lie along Z (facing out of a wall) or X. */
export const AXIS = {
  y: ([x, y, z]) => [x, y, z],
  z: ([x, y, z]) => [x, -z, y],
  x: ([x, y, z]) => [y, -x, z],
};

export class Piece {
  /** `mats`: name -> { color: [r, g, b], emissive?: [r, g, b], metal?: number, rough?: number, alpha?: number }. */
  constructor(name, mats) {
    this.name = name;
    this.mats = mats;
    this.parts = new Map();
  }

  part(mat) {
    if (!this.mats[mat]) throw new Error(`${this.name}: unknown material ${mat}`);
    let p = this.parts.get(mat);
    if (!p) this.parts.set(mat, (p = { pos: [], nrm: [], idx: [] }));
    return p;
  }

  /** A quad from four corners (counter-clockwise seen from the front) with normal n. */
  quad(mat, a, b, c, d, n) {
    const p = this.part(mat);
    const base = p.pos.length / 3;
    for (const v of [a, b, c, d]) {
      p.pos.push(...v);
      p.nrm.push(...n);
    }
    p.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  /** An axis-aligned box from min to max, optionally turned by `yaw` about its own vertical centre line. */
  box(mat, min, max, yaw = 0) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const t = ([x, y, z]) => (yaw ? [cx + (x - cx) * c + (z - cz) * s, y, cz - (x - cx) * s + (z - cz) * c] : [x, y, z]);
    const n = ([x, y, z]) => (yaw ? [x * c + z * s, y, -x * s + z * c] : [x, y, z]);
    const faces = [
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]],
      [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]],
      [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0]],
      [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [0, 0, 1]],
      [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1]],
    ];
    for (const [a, b, cc, d, nn] of faces) this.quad(mat, t(a), t(b), t(cc), t(d), n(nn));
    return this;
  }

  /** A cylinder (or cone, with r1 ≠ r0) along `axis` through `at`, from `h0` to `h1` along it, `seg` sides, capped. */
  cylinder(mat, at, r0, h0, h1, { seg = 16, r1 = r0, axis = 'y', caps = true } = {}) {
    const rot = AXIS[axis];
    const place = (v) => {
      const [x, y, z] = rot(v);
      return [x + at[0], y + at[1], z + at[2]];
    };
    const p = this.part(mat);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const slope = (r0 - r1) / Math.max(1e-6, h1 - h0);
      const norm = (a) => {
        const l = Math.hypot(1, slope);
        return rot([Math.cos(a) / l, slope / l, Math.sin(a) / l]);
      };
      const base = p.pos.length / 3;
      const verts = [
        [Math.cos(a0) * r0, h0, Math.sin(a0) * r0, a0],
        [Math.cos(a0) * r1, h1, Math.sin(a0) * r1, a0],
        [Math.cos(a1) * r1, h1, Math.sin(a1) * r1, a1],
        [Math.cos(a1) * r0, h0, Math.sin(a1) * r0, a1],
      ];
      for (const [x, y, z, a] of verts) {
        p.pos.push(...place([x, y, z]));
        p.nrm.push(...norm(a));
      }
      p.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      if (caps) {
        if (r1 > 0) this.tri(mat, place([0, h1, 0]), place([Math.cos(a1) * r1, h1, Math.sin(a1) * r1]), place([Math.cos(a0) * r1, h1, Math.sin(a0) * r1]), rot([0, 1, 0]));
        if (r0 > 0) this.tri(mat, place([0, h0, 0]), place([Math.cos(a0) * r0, h0, Math.sin(a0) * r0]), place([Math.cos(a1) * r0, h0, Math.sin(a1) * r0]), rot([0, -1, 0]));
      }
    }
    return this;
  }

  tri(mat, a, b, c, n) {
    const p = this.part(mat);
    const base = p.pos.length / 3;
    for (const v of [a, b, c]) {
      p.pos.push(...v);
      p.nrm.push(...n);
    }
    p.idx.push(base, base + 1, base + 2);
    return this;
  }

  /** A flat ring (washer) round `axis` through `at`: radii r0 (inner) to r1 (outer), `depth` thick along the axis from d0. */
  ring(mat, at, r0, r1, d0, depth, { seg = 24, axis = 'y' } = {}) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const rot = AXIS[axis];
      const place = (v) => {
        const [x, y, z] = rot(v);
        return [x + at[0], y + at[1], z + at[2]];
      };
      const pt = (r, a, h) => place([Math.cos(a) * r, h, Math.sin(a) * r]);
      const up = rot([0, 1, 0]);
      const dn = rot([0, -1, 0]);
      this.quad(mat, pt(r0, a0, d0 + depth), pt(r0, a1, d0 + depth), pt(r1, a1, d0 + depth), pt(r1, a0, d0 + depth), up);
      this.quad(mat, pt(r0, a1, d0), pt(r0, a0, d0), pt(r1, a0, d0), pt(r1, a1, d0), dn);
      const out = (a) => rot([Math.cos(a), 0, Math.sin(a)]);
      const am = (a0 + a1) / 2;
      this.quad(mat, pt(r1, a0, d0), pt(r1, a0, d0 + depth), pt(r1, a1, d0 + depth), pt(r1, a1, d0), out(am));
      const inn = rot([-Math.cos(am), 0, -Math.sin(am)]);
      this.quad(mat, pt(r0, a1, d0), pt(r0, a1, d0 + depth), pt(r0, a0, d0 + depth), pt(r0, a0, d0), inn);
    }
    return this;
  }

  /** A UV sphere. */
  sphere(mat, at, r, { rings = 8, seg = 12, squash = 1 } = {}) {
    const p = this.part(mat);
    const pt = (i, j) => {
      const th = (i / rings) * Math.PI;
      const ph = (j / seg) * Math.PI * 2;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      return [[at[0] + n[0] * r, at[1] + n[1] * r * squash, at[2] + n[2] * r], n];
    };
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const base = p.pos.length / 3;
        for (const [v, n] of [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]) {
          p.pos.push(...v);
          p.nrm.push(...n);
        }
        p.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }
    return this;
  }

  /** Write the piece into `doc` as one mesh (a primitive per material); returns its node. */
  build(doc, buffer, cache = new Map()) {
    const mesh = doc.createMesh(this.name);
    for (const [matName, p] of this.parts) {
      if (!p.idx.length) continue;
      const m = this.mats[matName];
      const key = `${matName}|${JSON.stringify(m)}`;
      let mat = cache.get(key);
      if (!mat) {
        mat = doc
          .createMaterial(matName)
          .setBaseColorFactor([...m.color, m.alpha ?? 1])
          .setMetallicFactor(m.metal ?? 0)
          .setRoughnessFactor(m.rough ?? 0.6);
        if (m.emissive) mat.setEmissiveFactor(m.emissive);
        if ((m.alpha ?? 1) < 1) mat.setAlphaMode('BLEND').setDoubleSided(true);
        cache.set(key, mat);
      }
      const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(p.pos.map((v) => Math.round(v * 10000) / 10000))).setBuffer(buffer);
      const nrm = doc.createAccessor().setType('VEC3').setArray(new Float32Array(p.nrm.map((v) => Math.round(v * 10000) / 10000))).setBuffer(buffer);
      const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(p.idx)).setBuffer(buffer);
      mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('NORMAL', nrm).setIndices(idx).setMaterial(mat));
    }
    return doc.createNode(this.name).setMesh(mesh);
  }
}

/** A document holding the given pieces, each as a node at the origin of one scene. */
export function piecesDocument(pieces, generator) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('pieces');
  const cache = new Map();
  for (const p of pieces) scene.addChild(p.build(doc, buffer, cache));
  doc.getRoot().getAsset().generator = generator;
  return doc;
}
