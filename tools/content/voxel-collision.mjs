// 3D collision for placeable props (`collide: "voxel"` in content/props/<pack>.json), and the audit of collision that
// fills a prop's openings (tools/content/prop-openings.mjs, part of `pnpm content:check`). docs/CONTENT_PIPELINE.md,
// "Prop collision".
//
// `shell` collision (prepare-props.mjs shellBoxes) is 2.5D: each cell of a top-down grid stands solid from the ground
// up to the highest geometry over it, so arches, windows, holes, lintels and bridges come out filled, and a plain
// `box` fills everything inside the model's bounds. Voxel collision is 3D:
//   1. the model's triangles are rasterised into a grid of `cell` cubes (VOXEL_CELL, coarser for very big props):
//      a cube a triangle touches is surface;
//   2. the space reachable from outside (from the sides and from above; never up from under the ground, so a wall
//      with no bottom face stays solid inside) through cubes no triangle touches is open; the rest is solid (the
//      surface and every space it closes in);
//   3. the solid cubes are covered exactly by boxes (greedy, the fewest of several sweep orders), then boxes are
//      merged two at a time, cheapest first, while a merge fills at most `air` m³ of open space and fills no cube
//      that a straight line along x, y or z through the whole model passes without touching it (a merge never
//      closes a window, an arch or the gap between two posts);
//   4. each box face with open space all across it is pulled in to the model inside the box, so faces sit on the
//      model (bullet holes on the stone, not a cube in front of it). A box is never thinner than the model inside
//      it, nor than `minThickness` round a single plane of the model (a kit wall with one face).
// Deterministic: the same triangles give the same boxes.

/** Cube size of the voxel grid (metres). */
export const VOXEL_CELL = 0.1;
/** Most cubes a grid may have: very big props get coarser cubes. */
const MAX_CUBES = 3e6;
/** Open space (m³) a merge of two boxes may fill (never in sight: see mergeBoxes): the price of one box fewer. */
export const VOXEL_AIR = 0.05;
/** How close to the model (metres) a merge may fill where a line sees through (smoothing a curve's staircase). */
export const VOXEL_HUG = 0.1;
/** Most boxes a voxel prop's collision may have; `budget: "hero"` props (big landmarks) VOXEL_MAX_BOXES_HERO. */
export const VOXEL_MAX_BOXES = 48;
export const VOXEL_MAX_BOXES_HERO = 160;
/** The box budget of a voxel prop (its content/props/<pack>.json entry): its own `voxelBudget`, or by its budget tier. */
export const voxelBudget = (p) => p.voxelBudget ?? (p.budget === 'hero' ? VOXEL_MAX_BOXES_HERO : VOXEL_MAX_BOXES);
/**
 * The settings `voxelCollision` tries in turn, [cube size, merge air], finest first, until the boxes fit the budget
 * and leave every opening open.
 */
export const VOXEL_LADDER = [
  [0.1, 0.05],
  [0.1, 0.5],
  [0.15, 0.5],
  [0.2, 0.5],
  [0.25, 1],
  [0.3, 1],
  [0.4, 2],
  [0.5, 2],
  [0.75, 4],
];
/** More boxes than this from the exact cover and merging is skipped (too slow, and a coarser cube is due anyway). */
const MAX_MERGE = 1500;
/** A box thinner than this keeps the model's own thickness only if the model is that thick (a table top). */
const MIN_BOX = 0.05;
/** The model inside a box is "a plane" below this thickness: the box gets `minThickness` round it. */
const PLANE = 0.02;

const round = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};

/**
 * Every triangle of a glTF-Transform scene in the scene's frame (world matrices applied), lower levels of detail
 * (nature.mjs `extras.lod`) left out: [[x, y, z] × 3][].
 */
export function sceneTriangles(scene) {
  const tris = [];
  const visit = (node) => {
    // Lower levels of detail (nature.mjs) are not the model's shape.
    if (node.getExtras()?.lod) return;
    const m = node.getWorldMatrix();
    const mesh = node.getMesh();
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        // Element reads, so quantized (normalized) positions come back in model units.
        const acc = prim.getAttribute('POSITION');
        const a = new Float32Array(acc.getCount() * 3);
        for (let i = 0, e = [0, 0, 0]; i < acc.getCount(); i++) a.set(acc.getElement(i, e), i * 3);
        const at = (i) => {
          const [x, y, z] = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
          return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
        };
        const idx = prim.getIndices()?.getArray() ?? Array.from({ length: a.length / 3 }, (_, i) => i);
        for (let i = 0; i + 2 < idx.length; i += 3) tris.push([at(idx[i]), at(idx[i + 1]), at(idx[i + 2])]);
      }
    for (const c of node.listChildren()) visit(c);
  };
  for (const n of scene.listChildren()) visit(n);
  return tris;
}

/**
 * Does triangle (a, b, c) touch the box centred on (cx, cy, cz) with half-sizes (hx, hy, hz)? Separating axes
 * (Akenine-Möller): the box's three axes, the triangle's normal and the nine edge × axis crosses.
 */
export function triBox(cx, cy, cz, hx, hy, hz, a, b, c) {
  const v0x = a[0] - cx, v0y = a[1] - cy, v0z = a[2] - cz;
  const v1x = b[0] - cx, v1y = b[1] - cy, v1z = b[2] - cz;
  const v2x = c[0] - cx, v2y = c[1] - cy, v2z = c[2] - cz;
  if (Math.min(v0x, v1x, v2x) > hx || Math.max(v0x, v1x, v2x) < -hx) return false;
  if (Math.min(v0y, v1y, v2y) > hy || Math.max(v0y, v1y, v2y) < -hy) return false;
  if (Math.min(v0z, v1z, v2z) > hz || Math.max(v0z, v1z, v2z) < -hz) return false;
  const edges = [
    [v1x - v0x, v1y - v0y, v1z - v0z],
    [v2x - v1x, v2y - v1y, v2z - v1z],
    [v0x - v2x, v0y - v2y, v0z - v2z],
  ];
  for (const [ex, ey, ez] of edges) {
    // x × e, y × e, z × e.
    for (const [ax, ay, az] of [
      [0, -ez, ey],
      [ez, 0, -ex],
      [-ey, ex, 0],
    ]) {
      const p0 = ax * v0x + ay * v0y + az * v0z;
      const p1 = ax * v1x + ay * v1y + az * v1z;
      const p2 = ax * v2x + ay * v2y + az * v2z;
      const r = hx * Math.abs(ax) + hy * Math.abs(ay) + hz * Math.abs(az);
      if (Math.min(p0, p1, p2) > r || Math.max(p0, p1, p2) < -r) return false;
    }
  }
  const [e0, e1] = edges;
  const nx = e0[1] * e1[2] - e0[2] * e1[1];
  const ny = e0[2] * e1[0] - e0[0] * e1[2];
  const nz = e0[0] * e1[1] - e0[1] * e1[0];
  return Math.abs(nx * v0x + ny * v0y + nz * v0z) <= hx * Math.abs(nx) + hy * Math.abs(ny) + hz * Math.abs(nz);
}

/** Bounds of a triangle list: [minX, minY, minZ, maxX, maxY, maxZ]. */
function triBounds(tris) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const t of tris)
    for (const p of t)
      for (let k = 0; k < 3; k++) {
        if (p[k] < b[k]) b[k] = p[k];
        if (p[k] > b[k + 3]) b[k + 3] = p[k];
      }
  return b;
}

/** The cube size for a model this big: `cell`, or coarser so the grid stays within MAX_CUBES. */
export function voxelCellFor(tris, cell = VOXEL_CELL) {
  const b = triBounds(tris);
  const vol = Math.max(1e-9, b[3] - b[0]) * Math.max(1e-9, b[4] - b[1]) * Math.max(1e-9, b[5] - b[2]);
  return Math.max(cell, Math.ceil(Math.cbrt(vol / MAX_CUBES) * 100) / 100);
}

/**
 * The model on a grid of `cell` cubes: `surface` (a triangle touches the cube) and `solid` (surface, or closed in by
 * it: not reachable from the sides or from above through cubes no triangle touches). The grid is centred on the
 * model in x and z and starts at its lowest point in y. Index (j * nz + k) * nx + i for cube (i, j, k) along x, y, z.
 */
export function voxelise(tris, cell = VOXEL_CELL) {
  const bounds = triBounds(tris);
  const [bx0, by0, bz0, bx1, by1, bz1] = bounds;
  const count = (lo, hi) => Math.max(1, Math.ceil((hi - lo) / cell - 1e-6));
  const nx = count(bx0, bx1);
  const ny = count(by0, by1);
  const nz = count(bz0, bz1);
  const x0 = (bx0 + bx1) / 2 - (nx * cell) / 2;
  const y0 = by0;
  const z0 = (bz0 + bz1) / 2 - (nz * cell) / 2;
  const at = (i, j, k) => (j * nz + k) * nx + i;
  const surface = new Uint8Array(nx * ny * nz);
  // A hair over half a cube: a face lying exactly on a cube boundary marks the cubes either side.
  const h = cell / 2 + 1e-6;
  const lo = (v, o, n) => Math.min(n - 1, Math.max(0, Math.floor((v - o) / cell - 1e-6)));
  const hi = (v, o, n) => Math.min(n - 1, Math.max(0, Math.floor((v - o) / cell + 1e-6)));
  for (const t of tris) {
    const [a, b, c] = t;
    const i0 = lo(Math.min(a[0], b[0], c[0]), x0, nx), i1 = hi(Math.max(a[0], b[0], c[0]), x0, nx);
    const j0 = lo(Math.min(a[1], b[1], c[1]), y0, ny), j1 = hi(Math.max(a[1], b[1], c[1]), y0, ny);
    const k0 = lo(Math.min(a[2], b[2], c[2]), z0, nz), k1 = hi(Math.max(a[2], b[2], c[2]), z0, nz);
    for (let j = j0; j <= j1; j++)
      for (let k = k0; k <= k1; k++)
        for (let i = i0; i <= i1; i++) {
          const n = at(i, j, k);
          if (!surface[n] && triBox(x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell, z0 + (k + 0.5) * cell, h, h, h, a, b, c)) surface[n] = 1;
        }
  }
  // Flood the open space from a ring of cubes round the sides and a layer over the top (none under the ground).
  const PX = nx + 2;
  const PY = ny + 1;
  const PZ = nz + 2;
  const pat = (i, j, k) => (j * PZ + k) * PX + i;
  const pad = (i, j, k) => i === 0 || k === 0 || i === nx + 1 || k === nz + 1 || j === ny;
  const outside = new Uint8Array(PX * PY * PZ);
  const queue = new Int32Array(PX * PY * PZ);
  let qn = 0;
  for (let j = 0; j < PY; j++)
    for (let k = 0; k < PZ; k++)
      for (let i = 0; i < PX; i++) {
        if (!pad(i, j, k)) continue;
        outside[pat(i, j, k)] = 1;
        queue[qn++] = pat(i, j, k);
      }
  const step = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  for (let q = 0; q < qn; q++) {
    const n = queue[q];
    const i = n % PX;
    const k = Math.floor(n / PX) % PZ;
    const j = Math.floor(n / (PX * PZ));
    for (const [di, dj, dk] of step) {
      const [a, b, c] = [i + di, j + dj, k + dk];
      if (a < 0 || b < 0 || c < 0 || a >= PX || b >= PY || c >= PZ) continue;
      const m = pat(a, b, c);
      if (outside[m] || (!pad(a, b, c) && surface[at(a - 1, b, c - 1)])) continue;
      outside[m] = 1;
      queue[qn++] = m;
    }
  }
  const solid = new Uint8Array(nx * ny * nz);
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if (!outside[pat(i + 1, j, k + 1)]) solid[at(i, j, k)] = 1;
  return { cell, nx, ny, nz, x0, y0, z0, bounds, surface, solid };
}

/** The six sweep orders: the axis a box grows along first, second and third (0 x, 1 y, 2 z). */
const ORDERS = [
  [0, 2, 1],
  [2, 0, 1],
  [0, 1, 2],
  [1, 0, 2],
  [1, 2, 0],
  [2, 1, 0],
];

/**
 * Solid cubes covered exactly by boxes { lo, hi } (cube indices, hi exclusive): from the first unused solid cube in
 * sweep order, grow along the first axis, then the second, then the third while every cube is solid. `overlap` lets
 * a box grow over cubes another already took (fewer, bigger boxes); boxes left with nothing of their own are dropped.
 */
function greedy(g, order, overlap) {
  const dims = [g.nx, g.ny, g.nz];
  const at = (p) => (p[1] * g.nz + p[2]) * g.nx + p[0];
  const used = new Uint8Array(g.solid.length);
  const ok = (n) => g.solid[n] && (overlap || !used[n]);
  const [, B, C] = order;
  const A = order[0];
  const boxes = [];
  const p = [0, 0, 0];
  const q = [0, 0, 0];
  // Every cube of the slab at index `s` along `axis`, within lo..hi on the other two axes, passes `ok`.
  const slab = (lo, hi, axis, s) => {
    const [u, v] = [0, 1, 2].filter((x) => x !== axis);
    q[axis] = s;
    for (q[u] = lo[u]; q[u] < hi[u]; q[u]++) for (q[v] = lo[v]; q[v] < hi[v]; q[v]++) if (!ok(at(q))) return false;
    return true;
  };
  for (p[C] = 0; p[C] < dims[C]; p[C]++)
    for (p[B] = 0; p[B] < dims[B]; p[B]++)
      for (p[A] = 0; p[A] < dims[A]; p[A]++) {
        const s = at(p);
        if (!g.solid[s] || used[s]) continue;
        const lo = [p[0], p[1], p[2]];
        const hi = [p[0] + 1, p[1] + 1, p[2] + 1];
        for (const axis of order) while (hi[axis] < dims[axis] && slab(lo, hi, axis, hi[axis])) hi[axis]++;
        for (q[1] = lo[1]; q[1] < hi[1]; q[1]++) for (q[2] = lo[2]; q[2] < hi[2]; q[2]++) for (q[0] = lo[0]; q[0] < hi[0]; q[0]++) used[at(q)] = 1;
        boxes.push({ lo, hi });
      }
  if (!overlap) return boxes;
  // Drop boxes every cube of which another box covers too (smallest first).
  const cover = new Uint16Array(g.solid.length);
  const each = (b, f) => {
    for (q[1] = b.lo[1]; q[1] < b.hi[1]; q[1]++) for (q[2] = b.lo[2]; q[2] < b.hi[2]; q[2]++) for (q[0] = b.lo[0]; q[0] < b.hi[0]; q[0]++) f(at(q));
  };
  for (const b of boxes) each(b, (n) => cover[n]++);
  const vol = (b) => (b.hi[0] - b.lo[0]) * (b.hi[1] - b.lo[1]) * (b.hi[2] - b.lo[2]);
  const byVol = boxes.map((b, i) => [vol(b), i]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const dropped = new Set();
  for (const [, i] of byVol) {
    let spare = true;
    each(boxes[i], (n) => {
      if (cover[n] < 2) spare = false;
    });
    if (!spare) continue;
    each(boxes[i], (n) => cover[n]--);
    dropped.add(i);
  }
  return boxes.filter((_, i) => !dropped.has(i));
}

/** Summed-volume table of a 0/1 grid: `sum(lo, hi)` counts the ones in the box of cubes [lo, hi). */
function summed(g, one) {
  const X = g.nx + 1;
  const Y = g.ny + 1;
  const Z = g.nz + 1;
  const P = new Int32Array(X * Y * Z);
  const at = (i, j, k) => (j * Z + k) * X + i;
  for (let j = 1; j < Y; j++)
    for (let k = 1; k < Z; k++)
      for (let i = 1; i < X; i++)
        P[at(i, j, k)] = one(i - 1, j - 1, k - 1) + P[at(i - 1, j, k)] + P[at(i, j - 1, k)] + P[at(i, j, k - 1)] - P[at(i - 1, j - 1, k)] - P[at(i - 1, j, k - 1)] - P[at(i, j - 1, k - 1)] + P[at(i - 1, j - 1, k - 1)];
  return (lo, hi) =>
    P[at(hi[0], hi[1], hi[2])] - P[at(lo[0], hi[1], hi[2])] - P[at(hi[0], lo[1], hi[2])] - P[at(hi[0], hi[1], lo[2])] + P[at(lo[0], lo[1], hi[2])] + P[at(lo[0], hi[1], lo[2])] + P[at(hi[0], lo[1], lo[2])] - P[at(lo[0], lo[1], lo[2])];
}

/** A binary heap of [cost, a, b, stamp] (cheapest first; ties by a, then b: deterministic). */
class Heap {
  items = [];
  less(x, y) {
    return x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2])));
  }
  push(x) {
    const h = this.items;
    h.push(x);
    for (let i = h.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  pop() {
    const h = this.items;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l], h[m])) m = l;
        if (r < h.length && this.less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

/**
 * Merge boxes two at a time, cheapest first: the merged box is the pair's bounds, its cost the open cubes it adds.
 * A merge must cost at most `maxAir` cubes and take in no see-through cube. Boxes the merged box contains go too.
 */
function mergeBoxes(g, boxes, maxAir, hug) {
  const at = (i, j, k) => (j * g.nz + k) * g.nx + i;
  const air = summed(g, (i, j, k) => 1 - g.solid[at(i, j, k)]);
  // Cubes in sight: open cubes a straight line from outside reaches along x or z (either way) or down from above,
  // more than `hug` cubes from the model. A merge never fills one, so no round stops in the air you can see (in a
  // window, an arch, a niche, under a canopy) further than that from the model.
  const first = (n, solidAt) => {
    for (let s = 0; s < n; s++) if (solidAt(s)) return s;
    return n;
  };
  const last = (n, solidAt) => {
    for (let s = n - 1; s >= 0; s--) if (solidAt(s)) return s;
    return -1;
  };
  const x0 = new Int32Array(g.ny * g.nz);
  const x1 = new Int32Array(g.ny * g.nz);
  const z0 = new Int32Array(g.ny * g.nx);
  const z1 = new Int32Array(g.ny * g.nx);
  const top = new Int32Array(g.nz * g.nx);
  for (let j = 0; j < g.ny; j++)
    for (let k = 0; k < g.nz; k++) {
      x0[j * g.nz + k] = first(g.nx, (i) => g.solid[at(i, j, k)]);
      x1[j * g.nz + k] = last(g.nx, (i) => g.solid[at(i, j, k)]);
    }
  for (let j = 0; j < g.ny; j++)
    for (let i = 0; i < g.nx; i++) {
      z0[j * g.nx + i] = first(g.nz, (k) => g.solid[at(i, j, k)]);
      z1[j * g.nx + i] = last(g.nz, (k) => g.solid[at(i, j, k)]);
    }
  for (let k = 0; k < g.nz; k++) for (let i = 0; i < g.nx; i++) top[k * g.nx + i] = last(g.ny, (j) => g.solid[at(i, j, k)]);
  const inSight = (i, j, k) => i < x0[j * g.nz + k] || i > x1[j * g.nz + k] || k < z0[j * g.nx + i] || k > z1[j * g.nx + i] || j > top[k * g.nx + i];
  const solid = summed(g, (i, j, k) => g.solid[at(i, j, k)]);
  const near = (i, j, k) => hug > 0 && solid([Math.max(0, i - hug), Math.max(0, j - hug), Math.max(0, k - hug)], [Math.min(g.nx, i + hug + 1), Math.min(g.ny, j + hug + 1), Math.min(g.nz, k + hug + 1)]) > 0;
  const see = summed(g, (i, j, k) => (!g.solid[at(i, j, k)] && inSight(i, j, k) && !near(i, j, k) ? 1 : 0));
  const live = boxes.map((b) => ({ lo: [...b.lo], hi: [...b.hi], stamp: 0, alive: true }));
  const union = (a, b) => ({ lo: [0, 1, 2].map((k) => Math.min(a.lo[k], b.lo[k])), hi: [0, 1, 2].map((k) => Math.max(a.hi[k], b.hi[k])) });
  const inter = (a, b) => {
    const lo = [0, 1, 2].map((k) => Math.max(a.lo[k], b.lo[k]));
    const hi = [0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]));
    return lo.every((v, k) => v < hi[k]) ? { lo, hi } : null;
  };
  const cost = (a, b) => {
    const u = union(a, b);
    if (see(u.lo, u.hi)) return Infinity;
    const both = inter(a, b);
    return air(u.lo, u.hi) - air(a.lo, a.hi) - air(b.lo, b.hi) + (both ? air(both.lo, both.hi) : 0);
  };
  const heap = new Heap();
  const offer = (i, j) => {
    const [a, b] = i < j ? [i, j] : [j, i];
    const c = cost(live[a], live[b]);
    if (c <= maxAir) heap.push([c, a, b, live[a].stamp * 1e6 + live[b].stamp]);
  };
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) offer(i, j);
  while (heap.size) {
    const [, a, b, stamp] = heap.pop();
    if (!live[a].alive || !live[b].alive || stamp !== live[a].stamp * 1e6 + live[b].stamp) continue;
    const u = union(live[a], live[b]);
    live[a].lo = u.lo;
    live[a].hi = u.hi;
    live[a].stamp++;
    live[b].alive = false;
    for (let c = 0; c < live.length; c++) {
      if (c === a || !live[c].alive) continue;
      if (live[c].lo.every((v, k) => v >= u.lo[k]) && live[c].hi.every((v, k) => v <= u.hi[k])) live[c].alive = false;
    }
    for (let c = 0; c < live.length; c++) if (c !== a && live[c].alive) offer(a, c);
  }
  return live.filter((b) => b.alive).map(({ lo, hi }) => ({ lo, hi }));
}

/** Sutherland-Hodgman: the part of polygon `poly` on the side of axis `k` where sign * (p[k] - v) <= 0. */
function clipPlane(poly, k, v, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = sign * (a[k] - v);
    const db = sign * (b[k] - v);
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

/** Bounds of the model's triangles clipped to the box [x0, y0, z0, x1, y1, z1] (null: none of the model is inside). */
function modelInside(tris, triBoxes, box) {
  let ext = null;
  for (let t = 0; t < tris.length; t++) {
    const tb = triBoxes[t];
    if (tb[0] > box[3] || tb[3] < box[0] || tb[1] > box[4] || tb[4] < box[1] || tb[2] > box[5] || tb[5] < box[2]) continue;
    let poly = tris[t];
    for (let k = 0; k < 3 && poly.length; k++) {
      poly = clipPlane(poly, k, box[k], -1);
      if (poly.length) poly = clipPlane(poly, k, box[k + 3], 1);
    }
    for (const p of poly) {
      ext ??= [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let k = 0; k < 3; k++) {
        if (p[k] < ext[k]) ext[k] = p[k];
        if (p[k] > ext[k + 3]) ext[k + 3] = p[k];
      }
    }
  }
  return ext;
}

/**
 * `collide: "voxel"`: collision boxes [minX, minY, minZ, maxX, maxY, maxZ] (metres, the triangles' frame) that follow
 * the model in 3D, so its openings stay open (see the header). `cell`: the finest cube size; `air`: the open space
 * (m³) a merge may fill; `minThickness`: the thickness a single plane of the model gets (kit walls with one face).
 */
export function voxelBoxes(tris, { cell = VOXEL_CELL, air = VOXEL_AIR, hug = VOXEL_HUG, minThickness = 0.2 } = {}) {
  if (!tris.length) return [];
  const g = voxelise(tris, voxelCellFor(tris, cell));
  let best = null;
  for (const overlap of [false, true])
    for (const order of ORDERS) {
      const boxes = greedy(g, order, overlap);
      const vol = boxes.reduce((s, b) => s + (b.hi[0] - b.lo[0]) * (b.hi[1] - b.lo[1]) * (b.hi[2] - b.lo[2]), 0);
      if (!best || boxes.length < best.boxes.length || (boxes.length === best.boxes.length && vol < best.vol)) best = { boxes, vol };
    }
  const merged = best.boxes.length > MAX_MERGE ? best.boxes : mergeBoxes(g, best.boxes, Math.floor(air / g.cell ** 3 + 1e-9), Math.floor(hug / g.cell + 1e-9));
  const dims = [g.nx, g.ny, g.nz];
  const origin = [g.x0, g.y0, g.z0];
  const solidAt = (p) => p[0] >= 0 && p[1] >= 0 && p[2] >= 0 && p[0] < g.nx && p[1] < g.ny && p[2] < g.nz && g.solid[(p[1] * g.nz + p[2]) * g.nx + p[0]] === 1;
  // Nothing solid at all across the face of box b on `axis`, side -1 (its low face) or +1 (its high face).
  const open = (b, axis, side) => {
    const s = side < 0 ? b.lo[axis] - 1 : b.hi[axis];
    if (s < 0 || s >= dims[axis]) return true;
    const [u, v] = [0, 1, 2].filter((x) => x !== axis);
    const p = [0, 0, 0];
    p[axis] = s;
    for (p[u] = b.lo[u]; p[u] < b.hi[u]; p[u]++) for (p[v] = b.lo[v]; p[v] < b.hi[v]; p[v]++) if (solidAt(p)) return false;
    return true;
  };
  const triBoxes = tris.map((t) => triBounds([t]));
  const out = [];
  for (const b of merged) {
    // In metres, inside the model's bounds.
    const box = [0, 1, 2].map((k) => Math.max(origin[k] + b.lo[k] * g.cell, g.bounds[k])).concat([0, 1, 2].map((k) => Math.min(origin[k] + b.hi[k] * g.cell, g.bounds[k + 3])));
    const ext = modelInside(tris, triBoxes, box);
    const was = [...box];
    if (ext)
      for (let k = 0; k < 3; k++) {
        if (open(b, k, -1)) box[k] = Math.max(box[k], ext[k]);
        if (open(b, k, 1)) box[k + 3] = Math.min(box[k + 3], ext[k + 3]);
        // Never thinner than the model inside (or than minThickness round a single plane of it), within the cubes.
        const thick = ext[k + 3] - ext[k] < PLANE ? minThickness : MIN_BOX;
        if (box[k + 3] - box[k] < thick) {
          const want = Math.min(thick, was[k + 3] - was[k]);
          const mid = Math.min(Math.max((ext[k] + ext[k + 3]) / 2, was[k] + want / 2), was[k + 3] - want / 2);
          box[k] = mid - want / 2;
          box[k + 3] = mid + want / 2;
        }
      }
    out.push(box.map(round));
  }
  // A stable order: bottom up, then along z and x.
  return out.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0] || a[4] - b[4] || a[5] - b[5] || a[3] - b[3]);
}

/**
 * `collide: "voxel"` with its budget: voxelBoxes at each VOXEL_LADDER setting in turn (from `cell` up, the prop's
 * `voxelCell`), the first whose boxes number at most `budget` and fill no opening (filledOpenings). Returns
 * { boxes, cell, air, openings } (openings: what the chosen boxes still fill; the fewest boxes if none fits).
 */
export function voxelCollision(tris, { budget = VOXEL_MAX_BOXES, cell = VOXEL_CELL, air = VOXEL_AIR, minThickness = 0.2 } = {}) {
  const rungs = VOXEL_LADDER.filter(([c, a]) => c >= cell - 1e-9 && a >= air - 1e-9);
  if (!rungs.length || rungs[0][0] > cell + 1e-9 || rungs[0][1] > air + 1e-9) rungs.unshift([cell, air]);
  // Leaving openings open counts first, then fewer boxes.
  const better = (x, y) => !y || (!x.openings.length && !!y.openings.length) || (!x.openings.length === !y.openings.length && x.boxes.length < y.boxes.length);
  let best = null;
  for (const [c, a] of rungs) {
    const boxes = voxelBoxes(tris, { cell: c, air: a, minThickness });
    const fit = { boxes, cell: c, air: a, openings: filledOpenings(tris, boxes) };
    if (boxes.length <= budget && !fit.openings.length) return fit;
    if (better(fit, best)) best = fit;
  }
  return best;
}

/** Sutherland-Hodgman in 2D: the part of polygon `poly` ([x, z] points) with sign * (p[k] - v) <= 0. */
function clip2(poly, k, v, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = sign * (a[k] - v);
    const db = sign * (b[k] - v);
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Slice height of `trunkBoxes` (metres). */
const TRUNK_SLICE = 0.25;
/** How far a trunk may lean from one slice to the next (metres): its column follows it. */
const TRUNK_DRIFT = 0.12;
/** A base band wider than this is not a trunk (a bush, a stand): the column stays in the footprint's middle. */
const TRUNK_MAX_BASE = 1.6;
/** How far round the column a trunk's cross-section is looked for (metres): one reaching that far is a crown. */
const TRUNK_SPREAD = 0.6;
/** Slices whose centres keep within this of each other share one box, widened to hold them (metres). */
const TRUNK_RUN = 0.1;

/**
 * `collide: "trunk"` (trees, poles, posts, lamps): the column they collide with, `max` wide at most (0.5 m, as the
 * footprint allows), standing on the model's real trunk instead of the middle of its footprint (a crown or an arm
 * to one side moves that middle off the trunk: rounds stopped in the air beside it and players walked through it).
 * The model is cut into TRUNK_SLICE slices: the trunk is the narrowest slice of the bottom 1.5 m, and the column
 * follows it up while its cross-section stays narrow (leaning as it leans), then on straight up while some of the
 * model is inside the column's square or the model closes round it on all four sides (a pine's tiers hide the trunk
 * inside them), and stops where neither holds (where a broad tree forks, where a pole ends). Returns boxes
 * [minX, minY, minZ, maxX, maxY, maxZ] (the
 * triangles' frame), or null when the model has no trunk near the ground (keep the plain column).
 */
export function trunkBoxes(tris, size, { max = 0.5 } = {}) {
  const [w, h, d] = size;
  const hw = Math.min(max, w) / 2;
  const hd = Math.min(max, d) / 2;
  const n = Math.max(1, Math.ceil(h / TRUNK_SLICE - 1e-6));
  // Each slice: the model's triangles clipped to it, as polygons in x and z.
  const slices = Array.from({ length: n }, () => []);
  for (const t of tris) {
    const ys = t.map((p) => p[1]);
    for (let s = Math.max(0, Math.floor(Math.min(...ys) / TRUNK_SLICE)); s <= Math.min(n - 1, Math.floor(Math.max(...ys) / TRUNK_SLICE)); s++) {
      let poly = clipPlane(t, 1, s * TRUNK_SLICE, -1);
      if (poly.length) poly = clipPlane(poly, 1, (s + 1) * TRUNK_SLICE, 1);
      if (poly.length) slices[s].push(poly.map((p) => [p[0], p[2]]));
    }
  }
  const extent = (polys, win) => {
    let e = null;
    for (let poly of polys) {
      if (win) for (let k = 0; k < 2 && poly.length; k++) poly = clip2(clip2(poly, k, win[k], -1), k, win[k + 2], 1);
      for (const p of poly) e = e ? [Math.min(e[0], p[0]), Math.min(e[1], p[1]), Math.max(e[2], p[0]), Math.max(e[3], p[1])] : [p[0], p[1], p[0], p[1]];
    }
    return e;
  };
  // The base: the narrowest slice in the bottom 1.5 m.
  let base = -1;
  let bw = Infinity;
  for (let s = 0; s < Math.min(n, Math.ceil(1.5 / TRUNK_SLICE)); s++) {
    const e = extent(slices[s]);
    if (e && Math.max(e[2] - e[0], e[3] - e[1]) < bw - 1e-6) {
      bw = Math.max(e[2] - e[0], e[3] - e[1]);
      base = s;
    }
  }
  if (base < 0 || bw > TRUNK_MAX_BASE) return null;
  const clampX = (x) => Math.min(w / 2 - hw, Math.max(-w / 2 + hw, x));
  const clampZ = (z) => Math.min(d / 2 - hd, Math.max(-d / 2 + hd, z));
  const e0 = extent(slices[base]);
  const centre = [clampX((e0[0] + e0[2]) / 2), clampZ((e0[1] + e0[3]) / 2)];
  // The column's centre in each slice it stands in.
  const at = new Array(n).fill(null);
  for (let s = 0; s <= base; s++) at[s] = [...centre];
  let c = [...centre];
  let s = base + 1;
  for (; s < n; s++) {
    // The model in the column's square (and a lean's worth round it): none, and the trunk has ended or forked.
    if (!extent(slices[s], [c[0] - hw - TRUNK_DRIFT, c[1] - hd - TRUNK_DRIFT, c[0] + hw + TRUNK_DRIFT, c[1] + hd + TRUNK_DRIFT])) break;
    // The trunk's whole cross-section: within a wider window, clear of its edges (else it is a crown, a tier, an arm).
    const win = [c[0] - hw - TRUNK_SPREAD, c[1] - hd - TRUNK_SPREAD, c[0] + hw + TRUNK_SPREAD, c[1] + hd + TRUNK_SPREAD];
    const e = extent(slices[s], win);
    if (e[0] <= win[0] + 1e-3 || e[1] <= win[1] + 1e-3 || e[2] >= win[2] - 1e-3 || e[3] >= win[3] - 1e-3) break;
    const m = [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2];
    c = [clampX(c[0] + Math.max(-TRUNK_DRIFT, Math.min(TRUNK_DRIFT, m[0] - c[0]))), clampZ(c[1] + Math.max(-TRUNK_DRIFT, Math.min(TRUNK_DRIFT, m[1] - c[1])))];
    at[s] = [...c];
  }
  // Closed in on all four sides: a ray from the centre along +x, -x, +z and -z meets the model in the slice.
  const meets = (polys, p, dir) => {
    for (const poly of polys)
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        // The ray p + t * dir (t >= 0) against the segment a-b.
        const ex = b[0] - a[0];
        const ez = b[1] - a[1];
        const den = dir[0] * ez - dir[1] * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((a[0] - p[0]) * ez - (a[1] - p[1]) * ex) / den;
        const u = ((a[0] - p[0]) * dir[1] - (a[1] - p[1]) * dir[0]) / den;
        if (t >= 0 && u >= 0 && u <= 1) return true;
      }
    return false;
  };
  for (; s < n; s++) {
    const inside = !!extent(slices[s], [c[0] - hw, c[1] - hd, c[0] + hw, c[1] + hd]);
    if (!inside && ![[1, 0], [-1, 0], [0, 1], [0, -1]].every((dir) => meets(slices[s], c, dir))) break;
    at[s] = [...c];
  }
  // Slices in runs whose centres keep within TRUNK_RUN of each other share a box.
  const boxes = [];
  for (let i = 0; i < n && at[i]; ) {
    let j = i;
    let lo = [...at[i]];
    let hi = [...at[i]];
    while (j + 1 < n && at[j + 1]) {
      const q = at[j + 1];
      const nlo = [Math.min(lo[0], q[0]), Math.min(lo[1], q[1])];
      const nhi = [Math.max(hi[0], q[0]), Math.max(hi[1], q[1])];
      if (nhi[0] - nlo[0] > TRUNK_RUN + 1e-9 || nhi[1] - nlo[1] > TRUNK_RUN + 1e-9) break;
      [lo, hi] = [nlo, nhi];
      j++;
    }
    const top = Math.min(h, (j + 1) * TRUNK_SLICE);
    boxes.push([lo[0] - hw, 0, lo[1] - hd, hi[0] + hw, top, hi[1] + hd].map((v, k) => (k === 1 ? i * TRUNK_SLICE : v)).map(round));
    i = j + 1;
  }
  return boxes;
}

/** Does the triangle's projection on the plane of axes (u, v) touch the pixel square centred on (cu, cv) with half-size h? */
function triPixel(cu, cv, h, a, b, c, u, v) {
  const P = [
    [a[u] - cu, a[v] - cv],
    [b[u] - cu, b[v] - cv],
    [c[u] - cu, c[v] - cv],
  ];
  if (Math.min(P[0][0], P[1][0], P[2][0]) > h || Math.max(P[0][0], P[1][0], P[2][0]) < -h) return false;
  if (Math.min(P[0][1], P[1][1], P[2][1]) > h || Math.max(P[0][1], P[1][1], P[2][1]) < -h) return false;
  for (let e = 0; e < 3; e++) {
    const [p, q] = [P[e], P[(e + 1) % 3]];
    const n = [q[1] - p[1], p[0] - q[0]];
    if (!n[0] && !n[1]) continue;
    const d = P.map((r) => n[0] * r[0] + n[1] * r[1]);
    const r = h * (Math.abs(n[0]) + Math.abs(n[1]));
    if (Math.min(...d) > r || Math.max(...d) < -r) return false;
  }
  return true;
}

/** Pixel size of the openings audit (metres). */
export const AUDIT_PIXEL = 0.05;
/** Openings this wide and tall (a square this size fits in them) are flagged. */
export const MIN_OPENING = 0.5;

/**
 * Openings a prop's collision fills: straight lines through the prop along x or along z that miss every triangle of
 * its model but cross its collision (`boxes`, the same frame), grouped into openings (connected in the plane across
 * the lines). An opening is closed in by the model, or by the model and the ground: a window, a hole, an arch, the
 * space under a table or a bridge; space round the outline (over a car's bonnet, beside a statue's arm, which the
 * lines reach from the sides or from above) is `slack` instead, counted only with `slack: true`. Each: `axis` the
 * lines run along, `size` [across, up] of its bounds and `square` the side of the largest square that fits in it
 * (metres), `at` [across, up] its middle, `area` (m²), and `slack` when it is that. Only those a `min` square fits in.
 */
export function filledOpenings(tris, boxes, { pixel = AUDIT_PIXEL, min = MIN_OPENING, slack = false } = {}) {
  const out = [];
  if (!boxes.length) return out;
  const tb = triBounds(tris);
  for (const axis of [0, 2]) {
    // The plane across the lines: u along the other horizontal axis, v up; the collision's and the model's bounds.
    const u = axis === 0 ? 2 : 0;
    const v = 1;
    const U0 = Math.min(tb[u], ...boxes.map((b) => b[u]));
    const U1 = Math.max(tb[u + 3], ...boxes.map((b) => b[u + 3]));
    const V0 = Math.min(tb[v], ...boxes.map((b) => b[v]));
    const V1 = Math.max(tb[v + 3], ...boxes.map((b) => b[v + 3]));
    const W = Math.max(1, Math.ceil((U1 - U0) / pixel));
    const H = Math.max(1, Math.ceil((V1 - V0) / pixel));
    const mask = new Uint8Array(W * H);
    // Lines that cross the collision (a pixel's middle inside a box's shadow).
    for (const b of boxes)
      for (let y = Math.max(0, Math.floor((b[v] - V0) / pixel)); y < Math.min(H, Math.ceil((b[v + 3] - V0) / pixel)); y++)
        for (let x = Math.max(0, Math.floor((b[u] - U0) / pixel)); x < Math.min(W, Math.ceil((b[u + 3] - U0) / pixel)); x++) {
          const cu = U0 + (x + 0.5) * pixel;
          const cv = V0 + (y + 0.5) * pixel;
          if (cu > b[u] && cu < b[u + 3] && cv > b[v] && cv < b[v + 3]) mask[y * W + x] = 1;
        }
    // ...and miss the model (a pixel any triangle's shadow touches is the model's).
    const model = new Uint8Array(W * H);
    const h = pixel / 2;
    for (const [a, b, c] of tris) {
      const x0 = Math.max(0, Math.floor((Math.min(a[u], b[u], c[u]) - U0) / pixel));
      const x1 = Math.min(W - 1, Math.floor((Math.max(a[u], b[u], c[u]) - U0) / pixel));
      const y0 = Math.max(0, Math.floor((Math.min(a[v], b[v], c[v]) - V0) / pixel));
      const y1 = Math.min(H - 1, Math.floor((Math.max(a[v], b[v], c[v]) - V0) / pixel));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) if (!model[y * W + x] && triPixel(U0 + (x + 0.5) * pixel, V0 + (y + 0.5) * pixel, h, a, b, c, u, v)) model[y * W + x] = 1;
    }
    for (let p = 0; p < W * H; p++) if (model[p]) mask[p] = 0;
    // Slack: what lines from the sides or from above reach without crossing the model (the ground closes the bottom).
    const outer = new Uint8Array(W * H);
    const reach = [];
    for (let p = 0; p < W * H; p++) {
      const x = p % W;
      const y = (p - x) / W;
      if (!model[p] && (x === 0 || x === W - 1 || y === H - 1)) {
        outer[p] = 1;
        reach.push(p);
      }
    }
    while (reach.length) {
      const p = reach.pop();
      const x = p % W;
      for (const q of [x + 1 < W ? p + 1 : -1, x > 0 ? p - 1 : -1, p + W < W * H ? p + W : -1, p - W]) {
        if (q < 0 || outer[q] || model[q]) continue;
        outer[q] = 1;
        reach.push(q);
      }
    }
    // Openings and slack apart (a square never spans both: they don't touch).
    for (let p = 0; p < W * H; p++) if (mask[p] && outer[p]) mask[p] = slack ? 2 : 0;
    // The largest square ending at each pixel.
    const sq = new Uint16Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        sq[y * W + x] = x && y ? 1 + Math.min(sq[(y - 1) * W + x], sq[y * W + x - 1], sq[(y - 1) * W + x - 1]) : 1;
      }
    // Openings: connected pixels (4-neighbours).
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let s = 0; s < W * H; s++) {
      if (!mask[s] || seen[s]) continue;
      seen[s] = 1;
      stack.push(s);
      let [n, best, xa, xb, ya, yb] = [0, 0, W, -1, H, -1];
      while (stack.length) {
        const p = stack.pop();
        const x = p % W;
        const y = (p - x) / W;
        n++;
        best = Math.max(best, sq[p]);
        xa = Math.min(xa, x);
        xb = Math.max(xb, x);
        ya = Math.min(ya, y);
        yb = Math.max(yb, y);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const [qx, qy] = [x + dx, y + dy];
          if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
          const q = qy * W + qx;
          if (mask[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
      if (best * pixel + 1e-9 < min) continue;
      out.push({
        axis: axis === 0 ? 'x' : 'z',
        size: [round((xb - xa + 1) * pixel), round((yb - ya + 1) * pixel)],
        square: round(best * pixel),
        at: [round(U0 + ((xa + xb + 1) / 2) * pixel), round(V0 + ((ya + yb + 1) / 2) * pixel)],
        area: round(n * pixel * pixel),
        ...(mask[s] === 2 ? { slack: true } : {}),
      });
    }
  }
  return out.sort((a, b) => b.area - a.area);
}
