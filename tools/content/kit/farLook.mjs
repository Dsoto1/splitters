// A kit prop's lighter levels of detail baked from its own full model (owner, 2026-11-17, "recs": far looks baked from
// the real model). The generators' own lighter levels were hand-made simplifications, and the last one was usually a
// flat block of two colours (geom.mjs standIn): a shop shelf of goods turned into a grey box at 45 m, a chair into a
// cube. A baked level is the full model (level 0) seen through a coarse grid of cells:
//
// 1. **Shape.** Level 0's surface is sampled, area-weighted, into cells (`cells` along its longest side, as near cubes
//    as the bounds allow; the grid spans level 0's own bounds). A cell the surface covers by `cover` of a cell face or
//    more is solid, and so is anything the outside cannot reach (a closed box's inside). So the gaps between a shelf's
//    tiers, under a table and between a chair's legs stay open where they are a cell or wider.
// 2. **Colour: a picture of the model.** Each outward face of the solid cells takes the colour you see looking at it
//    from outside along its normal: rays (a few a face) from the grid's edge onto level 0, the first front face hit,
//    its vertex colour there. Level 0's vertex colours carry its shading and grime, so the baked colours do too.
// 3. **Faces.** The faces' colours are reduced to a small palette (k-means in sRGB, `colours` at most), and
//    neighbouring faces of one palette colour merge into rectangles (greedy meshing), two triangles each; nothing faces
//    down at the ground.
//
// The level must stay within `maxTriangles`: fewer palette colours, then a coarser grid, until it is.
//
// A lighter level a generator made by hand that keeps the shape but lost the colours (a shop shelf's goods as one
// block a tier, a bookcase's books as one board) is **recoloured** instead (`recolourLevel`): its faces are divided
// where level 0's picture varies across them, and every corner takes the colour seen there on level 0, so a tier of
// goods keeps its colours at 20 m.
//
// Everything is deterministic (no randomness, fixed sampling), so a family's files only change with its model.

import { createHash } from 'node:crypto';
import { Mesh } from './geom.mjs';
import { rasterize } from '../raster.mjs';

const DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const toS = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const toL = (s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);

/** Level 0's bounds: [lo, hi]. */
export function meshBounds(m) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < m.P.length; v += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], m.P[v + k]);
      hi[k] = Math.max(hi[k], m.P[v + k]);
    }
  }
  return [lo, hi];
}

/**
 * Sample level 0 into a grid of `n` cells ([nx, ny, nz]) over [lo, hi]: per cell its covered area and, per facing
 * direction (DIRS), the area-weighted colour sum and weight.
 */
function sample(m, lo, n, s) {
  const N = n[0] * n[1] * n[2];
  const area = new Float64Array(N);
  // Per cell × direction: r, g, b, weight.
  const col = new Float64Array(N * 6 * 4);
  // Any facing: r, g, b, weight.
  const any = new Float64Array(N * 4);
  const minS = Math.min(s[0], s[1], s[2]);
  const step = minS / 4;
  const cellOf = (p) => {
    const i = [0, 1, 2].map((k) => Math.min(n[k] - 1, Math.max(0, Math.floor((p[k] - lo[k]) / s[k]))));
    return (i[1] * n[2] + i[2]) * n[0] + i[0];
  };
  const P = m.P;
  const C = m.C;
  for (let t = 0; t < m.I.length; t += 3) {
    const ia = m.I[t];
    const ib = m.I[t + 1];
    const ic = m.I[t + 2];
    const a = [P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]];
    const b = [P[ib * 3], P[ib * 3 + 1], P[ib * 3 + 2]];
    const c = [P[ic * 3], P[ic * 3 + 1], P[ic * 3 + 2]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const A2 = Math.hypot(cr[0], cr[1], cr[2]);
    if (A2 < 1e-12) continue;
    const nrm = [cr[0] / A2, cr[1] / A2, cr[2] / A2];
    const A = A2 / 2;
    // A barycentric lattice of k(k+1)/2 points, k from the longest edge over the step.
    const edge = Math.max(Math.hypot(...e1), Math.hypot(...e2), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]));
    const k = Math.max(1, Math.min(400, Math.ceil(edge / step)));
    const pts = (k * (k + 1)) / 2;
    const w = A / pts;
    const ca = [C[ia * 3], C[ia * 3 + 1], C[ia * 3 + 2]];
    const cb = [C[ib * 3], C[ib * 3 + 1], C[ib * 3 + 2]];
    const cc = [C[ic * 3], C[ic * 3 + 1], C[ic * 3 + 2]];
    const facing = DIRS.map((d) => Math.max(0, d[0] * nrm[0] + d[1] * nrm[1] + d[2] * nrm[2]));
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k - i; j++) {
        const u = (i + 1 / 3) / k;
        const v = (j + 1 / 3) / k;
        const x = 1 - u - v;
        const p = [a[0] * x + b[0] * u + c[0] * v, a[1] * x + b[1] * u + c[1] * v, a[2] * x + b[2] * u + c[2] * v];
        const q = [ca[0] * x + cb[0] * u + cc[0] * v, ca[1] * x + cb[1] * u + cc[1] * v, ca[2] * x + cb[2] * u + cc[2] * v];
        const cell = cellOf(p);
        area[cell] += w;
        any[cell * 4] += q[0] * w;
        any[cell * 4 + 1] += q[1] * w;
        any[cell * 4 + 2] += q[2] * w;
        any[cell * 4 + 3] += w;
        for (let d = 0; d < 6; d++) {
          const f = facing[d];
          if (f < 0.35) continue;
          const o = (cell * 6 + d) * 4;
          const fw = w * f;
          col[o] += q[0] * fw;
          col[o + 1] += q[1] * fw;
          col[o + 2] += q[2] * fw;
          col[o + 3] += fw;
        }
      }
    }
  }
  return { area, col, any };
}

/** The grid for a bake at `cells` along the longest side of [lo, hi]: counts and cell sizes per axis. */
function grid(lo, hi, cells, tall = 1) {
  const ext = [0, 1, 2].map((k) => Math.max(1e-4, hi[k] - lo[k]));
  const c = Math.max(...ext) / cells;
  // `tall`: that many times as many rows (shelves, bookcases: their colours change by the tier).
  const n = ext.map((e, k) => Math.max(1, Math.round(e / c) * (k === 1 ? tall : 1)));
  return { n, s: ext.map((e, k) => e / n[k]) };
}

/** Solid cells (a Uint8Array): covered by `cover` of a cell face or more, or closed in. */
function solids(n, s, area, cover) {
  const [nx, ny, nz] = n;
  const id = (x, y, z) => (y * nz + z) * nx + x;
  const face = (s[0] * s[1] + s[1] * s[2] + s[0] * s[2]) / 3;
  const solid = new Uint8Array(nx * ny * nz);
  for (let i = 0; i < solid.length; i++) solid[i] = area[i] >= cover * face ? 1 : 0;
  // The outside: flood from every empty cell on the grid's sides (the bottom too: things stand on the ground, but a
  // table's underside is open to the room), through empty cells.
  const out = new Uint8Array(solid.length);
  const stack = [];
  for (let y = 0; y < ny; y++)
    for (let z = 0; z < nz; z++)
      for (let x = 0; x < nx; x++) {
        if (x && y && z && x < nx - 1 && y < ny - 1 && z < nz - 1) continue;
        const i = id(x, y, z);
        if (!solid[i] && !out[i]) {
          out[i] = 1;
          stack.push(i);
        }
      }
  while (stack.length) {
    const i = stack.pop();
    const x = i % nx;
    const z = Math.floor(i / nx) % nz;
    const y = Math.floor(i / (nx * nz));
    for (const [dx, dy, dz] of DIRS) {
      const X = x + dx;
      const Y = y + dy;
      const Z = z + dz;
      if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
      const j = id(X, Y, Z);
      if (!solid[j] && !out[j]) {
        out[j] = 1;
        stack.push(j);
      }
    }
  }
  for (let i = 0; i < solid.length; i++) if (!out[i]) solid[i] = 1;
  return solid;
}

// ---------------------------------------------------------------- rays onto level 0

/** Level 0's triangles flattened for ray casts: corners, normals, colours, bounds. */
export function rayTarget(m) {
  const n = m.I.length / 3;
  const V = new Float64Array(n * 9);
  const C = new Float64Array(n * 9);
  const Nn = new Float64Array(n * 3);
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 3; k++) {
      const i = m.I[t * 3 + k];
      for (let q = 0; q < 3; q++) {
        V[t * 9 + k * 3 + q] = m.P[i * 3 + q];
        C[t * 9 + k * 3 + q] = m.C[i * 3 + q];
      }
    }
    const e1 = [V[t * 9 + 3] - V[t * 9], V[t * 9 + 4] - V[t * 9 + 1], V[t * 9 + 5] - V[t * 9 + 2]];
    const e2 = [V[t * 9 + 6] - V[t * 9], V[t * 9 + 7] - V[t * 9 + 1], V[t * 9 + 8] - V[t * 9 + 2]];
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...c) || 1;
    Nn[t * 3] = c[0] / l;
    Nn[t * 3 + 1] = c[1] / l;
    Nn[t * 3 + 2] = c[2] / l;
  }
  // A bounding volume hierarchy over the triangles (median splits on the longest axis), for the casts.
  const order = Int32Array.from({ length: n }, (_, i) => i);
  const cen = new Float64Array(n * 3);
  for (let t = 0; t < n; t++) for (let q = 0; q < 3; q++) cen[t * 3 + q] = (V[t * 9 + q] + V[t * 9 + 3 + q] + V[t * 9 + 6 + q]) / 3;
  const nodes = [];
  const make = (from, to) => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = from; i < to; i++) {
      const t = order[i];
      for (let k = 0; k < 3; k++)
        for (let q = 0; q < 3; q++) {
          lo[q] = Math.min(lo[q], V[t * 9 + k * 3 + q]);
          hi[q] = Math.max(hi[q], V[t * 9 + k * 3 + q]);
        }
    }
    const node = { lo, hi, from, to, a: null, b: null };
    nodes.push(node);
    if (to - from > 4) {
      const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      const ax = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2;
      const part = Array.from(order.subarray(from, to)).sort((x, y) => cen[x * 3 + ax] - cen[y * 3 + ax] || x - y);
      order.set(part, from);
      const mid = (from + to) >> 1;
      node.a = make(from, mid);
      node.b = make(mid, to);
    }
    return node;
  };
  const root = n ? make(0, n) : null;
  return { n, V, C, N: Nn, root, order };
}

/** Whether the ray o + t·d, t in [0, tMax], meets the box [lo, hi]. */
function meets(lo, hi, o, inv, tMax) {
  let t0 = 0;
  let t1 = tMax;
  for (let q = 0; q < 3; q++) {
    let a = (lo[q] - 1e-6 - o[q]) * inv[q];
    let b = (hi[q] + 1e-6 - o[q]) * inv[q];
    if (Number.isNaN(a)) a = -Infinity;
    if (Number.isNaN(b)) b = Infinity;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * The colour level 0 shows along the ray `o` + t·`d` (unit `d`), t in (0, `tMax`]: the nearest triangle facing the ray,
 * its colour at the hit (linear rgb), or null.
 */
export function castColour(tg, o, d, tMax, plane = 0) {
  const { V, C, N } = tg;
  // With `plane`: the hit nearest that distance along the ray (a face of a hand-made level looking for the surface it
  // stands for), those behind the plane preferred; without: the nearest hit.
  const score = (t) => (plane ? (t >= plane ? t - plane : (plane - t) * 1.5) : t);
  let best = plane ? Infinity : tMax;
  let hit = -1;
  let bu = 0;
  let bv = 0;
  const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
  const test = (t) => {
    // Facing the ray only (what a camera there sees).
    if (N[t * 3] * d[0] + N[t * 3 + 1] * d[1] + N[t * 3 + 2] * d[2] > -0.05) return;
    const b = t * 9;
    const e1x = V[b + 3] - V[b];
    const e1y = V[b + 4] - V[b + 1];
    const e1z = V[b + 5] - V[b + 2];
    const e2x = V[b + 6] - V[b];
    const e2y = V[b + 7] - V[b + 1];
    const e2z = V[b + 8] - V[b + 2];
    const px = d[1] * e2z - d[2] * e2y;
    const py = d[2] * e2x - d[0] * e2z;
    const pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return;
    const iv = 1 / det;
    const sx = o[0] - V[b];
    const sy = o[1] - V[b + 1];
    const sz = o[2] - V[b + 2];
    const u = (sx * px + sy * py + sz * pz) * iv;
    if (u < -1e-6 || u > 1 + 1e-6) return;
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * iv;
    if (v < -1e-6 || u + v > 1 + 1e-6) return;
    const tt = (e2x * qx + e2y * qy + e2z * qz) * iv;
    // Ties go to the lower triangle index, so the answer never depends on the walk's order.
    if (tt > 1e-6 && tt <= tMax && (score(tt) < best - 1e-9 || (Math.abs(score(tt) - best) <= 1e-9 && t < hit))) {
      best = score(tt);
      hit = t;
      bu = u;
      bv = v;
    }
  };
  const stack = tg.root ? [tg.root] : [];
  while (stack.length) {
    const node = stack.pop();
    if (!meets(node.lo, node.hi, o, inv, tMax)) continue;
    if (node.a) stack.push(node.a, node.b);
    else for (let i = node.from; i < node.to; i++) test(tg.order[i]);
  }
  if (hit < 0) return null;
  const b = hit * 9;
  const w = 1 - bu - bv;
  return [C[b] * w + C[b + 3] * bu + C[b + 6] * bv, C[b + 1] * w + C[b + 4] * bu + C[b + 7] * bv, C[b + 2] * w + C[b + 5] * bu + C[b + 8] * bv];
}

// ---------------------------------------------------------------- palette

/** Up to `k` colours for `cols` (linear rgb, with weights `ws`): k-means in sRGB from a deterministic start. */
function palette(cols, ws, k) {
  const S = cols.map((c) => c.map((v) => toS(Math.min(1, Math.max(0, v)))));
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // Start: the heaviest colour, then each time the colour farthest from those chosen (weighted).
  let first = 0;
  for (let i = 1; i < S.length; i++) if (ws[i] > ws[first]) first = i;
  const centres = [S[first].slice()];
  while (centres.length < k) {
    let far = -1;
    let fd = 1e-4;
    for (let i = 0; i < S.length; i++) {
      const dd = Math.min(...centres.map((c) => d2(c, S[i])));
      if (dd > fd) {
        fd = dd;
        far = i;
      }
    }
    if (far < 0) break;
    centres.push(S[far].slice());
  }
  const assign = new Int32Array(S.length);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < S.length; i++) {
      let bi = 0;
      let bd = Infinity;
      centres.forEach((c, j) => {
        const dd = d2(c, S[i]);
        if (dd < bd) {
          bd = dd;
          bi = j;
        }
      });
      assign[i] = bi;
    }
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < S.length; i++) {
      const a = sum[assign[i]];
      a[0] += S[i][0] * ws[i];
      a[1] += S[i][1] * ws[i];
      a[2] += S[i][2] * ws[i];
      a[3] += ws[i];
    }
    sum.forEach((a, j) => {
      if (a[3] > 0) centres[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    });
  }
  return { colours: centres.map((c) => c.map(toL)), assign };
}

// ---------------------------------------------------------------- the cell bake

/** The cell bake at one grid: the faces (cell, direction, colour), before the palette. */
function faces(m, tg, lo, hi, n, s, cover, box) {
  const [nx, ny, nz] = n;
  const id = (x, y, z) => (y * nz + z) * nx + x;
  // A picture box: every cell solid, so only the bounds' faces are left, each a grid of the model's picture.
  const solid = box ? new Uint8Array(nx * ny * nz).fill(1) : solids(n, s, sample(m, lo, n, s).area, cover);
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz ? 0 : solid[id(x, y, z)]);
  const out = [];
  out.parts = parts(solid, n);
  const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  for (let y = 0; y < ny; y++)
    for (let z = 0; z < nz; z++)
      for (let x = 0; x < nx; x++) {
        if (!solid[id(x, y, z)]) continue;
        for (let d = 0; d < 6; d++) {
          const [dx, dy, dz] = DIRS[d];
          if (at(x + dx, y + dy, z + dz)) continue;
          if (d === 3 && y === 0) continue;
          // Rays from outside the grid along −d through four points of the face: the first front face they meet
          // from the face's own plane inward (anything in front of the face, in empty cells, is the face's too).
          const axis = dx ? 0 : dy ? 1 : 2;
          const c = [x, y, z];
          let r = 0;
          let g = 0;
          let b = 0;
          let k = 0;
          const u = (axis + 1) % 3;
          const v = (axis + 2) % 3;
          for (const [fu, fv] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
            const o = [0, 0, 0];
            o[u] = lo[u] + (c[u] + fu) * s[u];
            o[v] = lo[v] + (c[v] + fv) * s[v];
            // Start just outside the bounds on the face's side.
            o[axis] = DIRS[d][axis] > 0 ? hi[axis] + 0.01 : lo[axis] - 0.01;
            const dir = [-dx, -dy, -dz];
            const col = castColour(tg, o, dir, ext[axis] + 0.02);
            if (col) {
              r += col[0];
              g += col[1];
              b += col[2];
              k++;
            }
          }
          out.push({ x, y, z, d, colour: k ? [r / k, g / k, b / k] : null, seen: k });
        }
      }
  // Faces no ray saw (inside a hollow, a gap): their neighbours' colour, else the model's mean.
  const seenCols = out.filter((f) => f.colour);
  const mean = seenCols.length ? [0, 1, 2].map((q) => seenCols.reduce((a, f) => a + f.colour[q], 0) / seenCols.length) : [0.5, 0.5, 0.5];
  for (const f of out) if (!f.colour) f.colour = mean;
  return out;
}

/** Separate pieces among the solid cells (face neighbours). */
function parts(solid, [nx, ny, nz]) {
  const seen = new Uint8Array(solid.length);
  let count = 0;
  for (let i = 0; i < solid.length; i++) {
    if (!solid[i] || seen[i]) continue;
    count++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % nx;
      const z = Math.floor(j / nx) % nz;
      const y = Math.floor(j / (nx * nz));
      for (const [dx, dy, dz] of DIRS) {
        const X = x + dx;
        const Y = y + dy;
        const Z = z + dz;
        if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
        const k = (Y * nz + Z) * nx + X;
        if (solid[k] && !seen[k]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
  }
  return count;
}

/** Greedy rectangles of the faces by palette colour; the Mesh. */
function mesh(lo, n, s, list, colours, assign) {
  const out = new Mesh();
  const byDir = DIRS.map(() => new Map());
  list.forEach((f, i) => {
    const axis = DIRS[f.d].findIndex((v) => v !== 0);
    const c = [f.x, f.y, f.z];
    const layer = c[axis];
    let m = byDir[f.d].get(layer);
    if (!m) byDir[f.d].set(layer, (m = new Map()));
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    m.set(c[u] + c[v] * n[u], assign[i] + 1);
  });
  for (let d = 0; d < 6; d++) {
    const dir = DIRS[d];
    const axis = dir.findIndex((v) => v !== 0);
    const sign = dir[axis];
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const nu = n[u];
    const nv = n[v];
    for (const layer of [...byDir[d].keys()].sort((a, b) => a - b)) {
      const cells = byDir[d].get(layer);
      const mask = new Int32Array(nu * nv);
      for (const [i, k] of cells) mask[i] = k;
      for (let b = 0; b < nv; b++)
        for (let a = 0; a < nu; ) {
          const k = mask[a + b * nu];
          if (!k) {
            a++;
            continue;
          }
          let w = 1;
          while (a + w < nu && mask[a + w + b * nu] === k) w++;
          let h = 1;
          grow: while (b + h < nv) {
            for (let q = 0; q < w; q++) if (mask[a + q + (b + h) * nu] !== k) break grow;
            h++;
          }
          for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) mask[a + q + (b + r) * nu] = 0;
          const plane = lo[axis] + (sign > 0 ? layer + 1 : layer) * s[axis];
          const corner = (ua, vb) => {
            const p = [0, 0, 0];
            p[axis] = plane;
            p[u] = lo[u] + ua * s[u];
            p[v] = lo[v] + vb * s[v];
            return p;
          };
          const colour = colours[k - 1];
          const i0 = out.vertex(corner(a, b), dir, [0, 0], colour);
          const i1 = out.vertex(corner(a + w, b), dir, [0, 0], colour);
          const i2 = out.vertex(corner(a + w, b + h), dir, [0, 0], colour);
          const i3 = out.vertex(corner(a, b + h), dir, [0, 0], colour);
          // u × v = +axis: counter-clockwise seen from +axis is 00, 10, 11, 01.
          if (sign > 0) out.quad(i0, i1, i2, i3);
          else out.quad(i0, i3, i2, i1);
          a += w;
        }
    }
  }
  return out;
}

/**
 * Bake a lighter level from level 0 (`m`, a geom.mjs Mesh) as cells: `cells` along its longest side, at most
 * `maxTriangles` (fewer palette colours, then fewer cells, until it fits; never under `minCells`). `cover`: the share
 * of a cell face level 0's surface must cover in a cell to make it solid. `colours`: the palette's size at most.
 * `box`: every cell solid (a picture box: the bounds, their faces in the model's colours). Returns the Mesh, with
 * `bake` = { cells, colours, box? }.
 */
export function bakeFarLook(m, { cells = 8, maxTriangles = 120, cover = 0.3, minCells = 3, colours = 10, box = false, tall = 1, k: only = 0 } = {}) {
  const [lo, hi] = meshBounds(m);
  const tg = rayTarget(m);
  let last = null;
  for (let c = cells; c >= minCells; c--) {
    const { n, s } = grid(lo, hi, c, tall);
    const list = faces(m, tg, lo, hi, n, s, cover, box);
    // Nothing solid at this grid (a court's lines, a thin panel under the cover): no bake here.
    if (!list.length) continue;
    const ws = list.map(() => 1);
    // At least four colours (fewer washed a shop shelf's goods out to its frame's grey): over the cap, fewer cells.
    // `only`: the palette size a kept plan found (no search).
    for (let k = only || colours; k >= 4; k = only ? 0 : k > 6 ? k - 2 : k - 1) {
      const { colours: pal, assign } = palette(list.map((f) => f.colour), ws, Math.min(k, list.length));
      const out = mesh(lo, n, s, list, pal, assign);
      out.bake = { cells: c, colours: pal.length, k, ...(box ? { box: true } : {}), ...(tall > 1 ? { tall } : {}) };
      out.parts = list.parts;
      last = out;
      if (out.triangles <= maxTriangles) return out;
    }
  }
  return last;
}

// ---------------------------------------------------------------- recolouring a hand-made level

/**
 * Recolour a generator's own lighter level (`level`) from level 0 (`m`): each quad (two triangles sharing a diagonal,
 * as geom.mjs writes them) is divided into a grid of about `cell` m where level 0's picture varies across it by more
 * than `tolerance` (sRGB), and every corner takes the colour level 0 shows there, looking at the face from up to
 * `reach` m in front of it. Corners where level 0 shows nothing keep their own colour. Kept within `maxTriangles` by a
 * coarser grid. Returns a new Mesh (with `bake` = { cell }).
 */
export function recolourLevel(level, m, { cell = 0.12, maxTriangles = 400, reach = 0.3, tolerance = 0.1, tries: fixed = null } = {}) {
  const tg = rayTarget(m);
  const P = level.P;
  const at = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const nrm = (i) => [level.N[i * 3], level.N[i * 3 + 1], level.N[i * 3 + 2]];
  const own = (i) => [level.C[i * 3], level.C[i * 3 + 1], level.C[i * 3 + 2]];
  // Quads and lone triangles.
  const parts = [];
  for (let t = 0; t < level.I.length; ) {
    const [a, b, c] = [level.I[t], level.I[t + 1], level.I[t + 2]];
    if (t + 5 < level.I.length && level.I[t + 3] === a && level.I[t + 4] === c) {
      parts.push({ quad: [a, b, c, level.I[t + 5]] });
      t += 6;
    } else {
      parts.push({ tri: [a, b, c] });
      t += 3;
    }
  }
  const look = (p, n, fallback) => {
    const o = [p[0] + n[0] * reach, p[1] + n[1] * reach, p[2] + n[2] * reach];
    return castColour(tg, o, [-n[0], -n[1], -n[2]], reach * 2, reach) ?? fallback;
  };
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const varies = (cols) => {
    const S = cols.map((c) => c.map((v) => toS(Math.min(1, Math.max(0, v)))));
    const mean = [0, 1, 2].map((k) => S.reduce((a, c) => a + c[k], 0) / S.length);
    return S.some((c) => Math.max(...c.map((v, k) => Math.abs(v - mean[k]))) > tolerance);
  };
  // Each quad's grid at a cell size; probes at the finest size decide which quads are divided.
  const plan = parts.map((part) => {
    if (part.tri) return { ...part, k: 1, l: 1 };
    const [a, b, , d] = part.quad;
    const pa = at(a);
    const lu = dist(pa, at(b));
    const lv = dist(pa, at(d));
    const n = nrm(a);
    const probeK = Math.min(8, Math.max(1, Math.round(lu / cell)));
    const probeL = Math.min(8, Math.max(1, Math.round(lv / cell)));
    const cols = [];
    const [p0, p1, p2, p3] = part.quad.map(at);
    for (let i = 0; i <= probeK; i++)
      for (let j = 0; j <= probeL; j++) {
        const p = lerp(lerp(p0, p1, i / probeK), lerp(p3, p2, i / probeK), j / probeL);
        cols.push(look(p, n, own(a)));
      }
    return { ...part, lu, lv, divide: (probeK > 1 || probeL > 1) && varies(cols) };
  });
  // A divided quad's cells are flat colours (the mean of four looks inside each), reduced to one palette for the
  // level and merged into rectangles where neighbours share a colour; an undivided quad keeps a colour per corner.
  const cellsOf = (p, size) => {
    const k = Math.min(10, Math.max(1, Math.round(p.lu / size)));
    const l = Math.min(10, Math.max(1, Math.round(p.lv / size)));
    const [p0, p1, p2, p3] = p.quad.map(at);
    const n = nrm(p.quad[0]);
    const pos = (u, v) => lerp(lerp(p0, p1, u), lerp(p3, p2, u), v);
    const cols = [];
    for (let i = 0; i < k; i++)
      for (let j = 0; j < l; j++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (const [fu, fv] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const c = look(pos((i + fu) / k, (j + fv) / l), n, own(p.quad[0]));
          r += c[0];
          g += c[1];
          b += c[2];
        }
        cols.push([r / 4, g / 4, b / 4]);
      }
    return { k, l, cols, pos, n };
  };
  const emit = (size) => {
    const out = new Mesh();
    const divided = plan.filter((p) => p.divide && size < Infinity).map((p) => [p, cellsOf(p, size)]);
    const all = divided.flatMap(([, c]) => c.cols);
    const pal = all.length ? palette(all, all.map(() => 1), Math.min(12, all.length)) : null;
    let at0 = 0;
    const cellsFor = new Map();
    for (const [p, c] of divided) {
      cellsFor.set(p, { ...c, idx: pal.assign.slice(at0, at0 + c.cols.length) });
      at0 += c.cols.length;
    }
    for (const p of plan) {
      if (p.tri) {
        const ids = p.tri.map((i) => out.vertex(at(i), nrm(i), [0, 0], look(at(i), nrm(i), own(i))));
        out.tri(ids[0], ids[1], ids[2]);
        continue;
      }
      const c = cellsFor.get(p);
      if (!c) {
        const ids = p.quad.map((i) => out.vertex(at(i), nrm(i), [0, 0], look(at(i), nrm(i), own(i))));
        out.quad(ids[0], ids[1], ids[2], ids[3]);
        continue;
      }
      const { k, l, idx, pos, n } = c;
      const mask = Int32Array.from(idx, (v) => v + 1);
      for (let j = 0; j < l; j++)
        for (let i = 0; i < k; ) {
          const key = mask[i * l + j];
          if (!key) {
            i++;
            continue;
          }
          let w = 1;
          while (i + w < k && mask[(i + w) * l + j] === key) w++;
          let h = 1;
          grow: while (j + h < l) {
            for (let q = 0; q < w; q++) if (mask[(i + q) * l + j + h] !== key) break grow;
            h++;
          }
          for (let q = 0; q < w; q++) for (let r = 0; r < h; r++) mask[(i + q) * l + j + r] = 0;
          const colour = pal.colours[key - 1];
          const v0 = out.vertex(pos(i / k, j / l), n, [0, 0], colour);
          const v1 = out.vertex(pos((i + w) / k, j / l), n, [0, 0], colour);
          const v2 = out.vertex(pos((i + w) / k, (j + h) / l), n, [0, 0], colour);
          const v3 = out.vertex(pos(i / k, (j + h) / l), n, [0, 0], colour);
          out.quad(v0, v1, v2, v3);
          i += w;
        }
    }
    return out;
  };
  // `fixed`: the steps a kept plan found (-1: corners only), made once.
  if (fixed !== null) {
    const size = fixed < 0 ? Infinity : cell * 1.35 ** fixed;
    const out = emit(size);
    out.bake = { cell: Math.round(size * 1000) / 1000, tries: fixed };
    return out;
  }
  let size = cell;
  let tries = 0;
  let out = emit(size);
  for (; out.triangles > maxTriangles && tries < 12; tries++) {
    size *= 1.35;
    out = emit(size);
  }
  // Still over (more quads than the budget allows divided at all): the level with its corners recoloured only.
  if (out.triangles > maxTriangles) {
    out = emit(Infinity);
    tries = -1;
  }
  out.bake = { cell: Math.round(size * 1000) / 1000, tries };
  return out;
}

// ---------------------------------------------------------------- choosing by the picture

/** The views a level is compared in: four sides from a little above, and one from high up. */
const VIEWS = [
  [30, 12],
  [120, 12],
  [210, 12],
  [300, 12],
  [45, 55],
];

function flat(m) {
  const P = new Float64Array(m.I.length * 3);
  const C = new Float64Array(m.I.length * 3);
  m.I.forEach((i, k) => {
    for (let q = 0; q < 3; q++) {
      P[k * 3 + q] = m.P[i * 3 + q];
      C[k * 3 + q] = m.C[i * 3 + q];
    }
  });
  return [P, C];
}

/** Level `m` drawn in VIEWS, `px` pixels across (drawn at 4× and averaged down, as a distant copy is filtered). */
export function pictures(m, px, frames = null) {
  const [P, C] = flat(m);
  const S = 4;
  return VIEWS.map(([yaw, pitch], v) => {
    const big = rasterize(P, C, { width: px * S, height: px * S, yaw, pitch, frame: frames?.[v] ?? null });
    const out = new Float32Array(px * px * 4);
    for (let y = 0; y < px; y++)
      for (let x = 0; x < px; x++) {
        const o = (y * px + x) * 4;
        for (let dy = 0; dy < S; dy++)
          for (let dx = 0; dx < S; dx++) {
            const i = ((y * S + dy) * px * S + x * S + dx) * 4;
            const a = big.data[i + 3] / 255;
            out[o] += (big.data[i] / 255) * a;
            out[o + 1] += (big.data[i + 1] / 255) * a;
            out[o + 2] += (big.data[i + 2] / 255) * a;
            out[o + 3] += a;
          }
        for (let k = 0; k < 4; k++) out[o + k] /= S * S;
      }
    return { data: out, frame: big.frame };
  });
}

/**
 * How far level `m` looks from level 0's pictures (`ref`, from `pictures`): the mean difference per pixel over the
 * views, in premultiplied sRGB (0-1: a pixel the model covers and the level does not counts its whole colour), over
 * the pixels either covers.
 */
export function pictureError(ref, m, px) {
  const mine = pictures(m, px, ref.map((r) => r.frame));
  let sum = 0;
  let n = 0;
  ref.forEach((r, v) => {
    const a = r.data;
    const b = mine[v].data;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 0.02 && b[i + 3] < 0.02) continue;
      sum += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
      n++;
    }
  });
  return n ? sum / n : 0;
}

/**
 * A lighter level for level 0 (`m`), given the generator's own level (`own`): whichever of the generator's level as
 * it is, recoloured from level 0, and cell bakes and picture boxes of `cells` (once or twice as many rows) looks most like level 0 at `px` pixels across, within
 * `maxTriangles`. Returns { mesh, how, error, ownError }; `how` is 'own', 'recoloured', 'cells' or 'picture box'.
 */
export function bakeLevel(m, own, { maxTriangles, px = 40, cells = [10, 8, 6, 4], talls = [1, 2] } = {}) {
  const ref = pictures(m, px);
  const candidates = [];
  if (own.triangles <= maxTriangles) candidates.push({ mesh: own, how: 'own' });
  const re = recolourLevel(own, m, { maxTriangles });
  if (re.triangles <= maxTriangles) candidates.push({ mesh: re, how: 'recoloured' });
  // A coarse bake must not break the model into more pieces than it has (a round table's stem lost, its top afloat).
  const pieces = cells.length ? (bakeFarLook(m, { cells: 16, minCells: 16, maxTriangles: Infinity })?.parts ?? 0) : 0;
  for (const c of cells)
    for (const tall of talls)
      for (const box of [false, true]) {
        const b = bakeFarLook(m, { cells: c, maxTriangles, minCells: c, box, tall });
        if (b && b.triangles <= maxTriangles && b.parts <= pieces) candidates.push({ mesh: b, how: box ? 'picture box' : 'cells' });
      }
  for (const c of candidates) c.error = pictureError(ref, c.mesh, px);
  const ownError = candidates.find((c) => c.how === 'own')?.error ?? pictureError(ref, own, px);
  candidates.sort((a, b) => a.error - b.error);
  const best = candidates[0] ?? { mesh: own, how: 'own', error: ownError };
  return { mesh: best.mesh, how: best.how, error: best.error, ownError, tried: candidates.map((c) => [c.how, c.mesh.bake ?? null, c.mesh.triangles, Math.round(c.error * 1000) / 1000]) };
}

// ---------------------------------------------------------------- the pipeline's entry

/** Bumped when a bake changes its output for the same model: every kept plan is searched again. */
export const FAR_VERSION = 2;

/**
 * The triangle cap of a baked level (`level` 1: from 20 m; 2 and on: from 45 m), given level 0's triangles and the
 * generator's own level's: level 1 up to 60 % of level 0; later levels up to a quarter of it, at least 48 and at most
 * 120; always fewer than the level before (`before`). Never under what the generator's own level had.
 */
export function farCap(level, full, own, before = full) {
  const cap = level <= 1 ? Math.round(0.6 * full) : Math.min(120, Math.max(48, Math.round(0.25 * full)));
  return Math.max(own, Math.min(cap, before - 1));
}

/** The pixels across a level is compared at: about its size on screen where it starts. */
const farPx = (level) => (level <= 1 ? 64 : 32);

/** What a plan is for: level 0, the generator's level, the cap and the bake's version. */
export function farKey(full, own, cap) {
  const h = createHash('sha256');
  for (const m of [full, own]) h.update(JSON.stringify([m.P, m.C, m.I]));
  h.update(`${cap}/${FAR_VERSION}`);
  return h.digest('hex').slice(0, 12);
}

function make(full, own, cap, plan) {
  if (plan.how === 'own') return own;
  if (plan.how === 'recoloured') return recolourLevel(own, full, { maxTriangles: cap, ...(plan.tries !== undefined ? { tries: plan.tries } : {}) });
  return bakeFarLook(full, { cells: plan.cells, minCells: plan.cells, tall: plan.tall ?? 1, box: plan.how === 'picture box', maxTriangles: cap, ...(plan.k ? { k: plan.k } : {}) });
}

/** What a made level needs to be made again without searching: the recolouring's steps, the palette's size. */
const exact = (mesh, how) => (how === 'recoloured' ? { tries: mesh.bake.tries } : how === 'own' ? {} : { k: mesh.bake.k });

/**
 * Level `level` of a kit prop, baked from level 0 (`full`) where that looks more like it than the generator's own
 * level (`own`), with fewer triangles than the level before (`before`). `kept`: the plan an earlier build chose ({ key, how, cells?, tall? }, kept in the lock), reused when
 * its key still matches (the search draws every candidate; making the chosen one again is quick). Returns
 * { mesh, plan, error, ownError? }.
 */
export function farLevel(full, own, level, kept = null, before = full.triangles) {
  const cap = farCap(level, full.triangles, own.triangles, before);
  const key = farKey(full, own, cap);
  if (kept?.key === key) {
    const mesh = make(full, own, cap, kept);
    if (mesh.triangles <= cap) return { mesh, plan: { ...kept, ...exact(mesh, kept.how) } };
  }
  // Level 1 (from 20 m) keeps the generator's outline, recoloured or not: a cell bake is too coarse that near.
  const r = bakeLevel(full, own, { maxTriangles: cap, px: farPx(level), ...(level <= 1 ? { cells: [] } : {}) });
  const plan = { key, how: r.how, ...(r.mesh.bake?.cells ? { cells: r.mesh.bake.cells } : {}), ...(r.mesh.bake?.tall ? { tall: r.mesh.bake.tall } : {}), error: Math.round(r.error * 1000) / 1000, ownError: Math.round(r.ownError * 1000) / 1000 };
  const mesh = make(full, own, cap, plan);
  return { mesh, plan: { ...plan, ...exact(mesh, plan.how) } };
}
