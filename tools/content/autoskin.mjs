// Skin weights for an unrigged mesh from hand-placed bones (prepare-meshy-characters.mjs).
//
// Bone heat, after Baran & Popović's Pinocchio: every vertex is tied to the
// nearest bone it can "see" (the straight line to it stays inside the body, tested
// on a voxel fill of the mesh, so the side of the torso under a hanging arm is not
// the arm's), with a pull of 1/distance², and the weights diffuse over the surface
// from there (a heat equation solved per joint). Thick parts blend over a wider
// band than thin ones, and the result is smooth and sums to one.
//
// Then rules for what heat gets wrong on these bodies:
// - cloth hanging below the hips (aprons, rags, loincloths: surface well away from
//   the leg bones) follows the pelvis, with a little of the nearer thigh towards
//   the hem, so it sways instead of being torn between the legs;
// - the clavicles keep only the top of the shoulder (the chest below and the body
//   inside of the shoulder joint go to the chest joint), and the upper arms keep
//   off the chest, so the chest stays rigid when the arms move;
// then at most four influences per vertex, smoothed over the surface.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Voxel size, in units of the model's height. */
const VOXEL = 1 / 110;
/** Pull of a vertex towards its bone (Pinocchio's c), against diffusion over the surface. */
const HEAT = 1;
/** Influences kept per vertex, and weights below this dropped. */
const MAX_INFLUENCES = 4;
const MIN_WEIGHT = 0.02;
/** Smoothing rounds after the influences are cut to four. */
const SMOOTH_ROUNDS = 2;

/** Which grid cells are inside the mesh: its surface rasterised, then everything the outside can't reach. */
function voxelize(P, tris, H) {
  const size = H * VOXEL;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) [lo[k], hi[k]] = [Math.min(lo[k], P[i + k]), Math.max(hi[k], P[i + k])];
  for (let k = 0; k < 3; k++) lo[k] -= 2 * size;
  const dim = [0, 1, 2].map((k) => Math.ceil((hi[k] + 2 * size - lo[k]) / size));
  const [nx, ny, nz] = dim;
  const grid = new Uint8Array(nx * ny * nz); // 1 surface, 2 outside
  const cell = (x, y, z) => {
    const i = Math.floor((x - lo[0]) / size);
    const j = Math.floor((y - lo[1]) / size);
    const k = Math.floor((z - lo[2]) / size);
    return i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : i + nx * (j + ny * k);
  };
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t] * 3, tris[t + 1] * 3, tris[t + 2] * 3];
    const ab = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
    const ac = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const long = Math.max(Math.hypot(...ab), Math.hypot(...ac), Math.hypot(ab[0] - ac[0], ab[1] - ac[1], ab[2] - ac[2]));
    const steps = Math.max(1, Math.ceil(long / (size * 0.35)));
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; i + j <= steps; j++) {
        const [u, v] = [i / steps, j / steps];
        const g = cell(P[a] + ab[0] * u + ac[0] * v, P[a + 1] + ab[1] * u + ac[1] * v, P[a + 2] + ab[2] * u + ac[2] * v);
        if (g >= 0) grid[g] = 1;
      }
    }
  }
  // Flood the outside in from the grid's faces.
  const stack = [];
  const push = (i, j, k) => {
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
    const g = i + nx * (j + ny * k);
    if (grid[g]) return;
    grid[g] = 2;
    stack.push(g);
  };
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) push(i, j, 0), push(i, j, nz - 1);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) push(i, 0, k), push(i, ny - 1, k);
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) push(0, j, k), push(nx - 1, j, k);
  while (stack.length) {
    const g = stack.pop();
    const i = g % nx;
    const j = Math.floor(g / nx) % ny;
    const k = Math.floor(g / (nx * ny));
    push(i + 1, j, k), push(i - 1, j, k), push(i, j + 1, k), push(i, j - 1, k), push(i, j, k + 1), push(i, j, k - 1);
  }
  let inside = 0;
  for (const g of grid) if (g !== 2) inside++;
  return { inside: (p) => grid[cell(p[0], p[1], p[2])] !== 2 && cell(p[0], p[1], p[2]) >= 0, size, share: inside / grid.length };
}

/** Closest point on segment a→b to p: its parameter and distance. */
function onSegment(p, a, b) {
  const ab = sub(b, a);
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
  return { t, q, d: Math.hypot(...sub(p, q)) };
}

/** A binary min-heap of [key, value] for Dijkstra. */
class Heap {
  a = [];
  push(k, v) {
    const a = this.a;
    a.push([k, v]);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

/** Conjugate gradients with a Jacobi preconditioner for the symmetric positive definite CSR matrix (row, col, val). */
function solve(row, col, val, diag, rhs, x, iterations = 500, tol = 1e-6) {
  const n = rhs.length;
  const mul = (v, out) => {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = row[i]; k < row[i + 1]; k++) s += val[k] * v[col[k]];
      out[i] = s;
    }
  };
  const r = new Float64Array(n);
  const z = new Float64Array(n);
  const p = new Float64Array(n);
  const q = new Float64Array(n);
  mul(x, q);
  let bn = 0;
  for (let i = 0; i < n; i++) {
    r[i] = rhs[i] - q[i];
    z[i] = r[i] / diag[i];
    p[i] = z[i];
    bn += rhs[i] * rhs[i];
  }
  bn = Math.sqrt(bn) || 1;
  let rz = 0;
  for (let i = 0; i < n; i++) rz += r[i] * z[i];
  for (let it = 0; it < iterations; it++) {
    mul(p, q);
    let pq = 0;
    for (let i = 0; i < n; i++) pq += p[i] * q[i];
    const alpha = rz / (pq || 1e-30);
    let rn = 0;
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * q[i];
      rn += r[i] * r[i];
    }
    if (Math.sqrt(rn) / bn < tol) break;
    let rz2 = 0;
    for (let i = 0; i < n; i++) {
      z[i] = r[i] / diag[i];
      rz2 += r[i] * z[i];
    }
    const beta = rz2 / (rz || 1e-30);
    rz = rz2;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
  }
  return x;
}

/**
 * Skin weights for a mesh (positions P, normals N, triangle indices) from its
 * bones: [{ joint, a, b, tail? }] segments in model space, H the model's height,
 * `jointCount` joints. `body` names the joints and landmarks the rules need:
 * { pelvis, chest, neck, head, chestAt, neckAt, center, cloth (whether anything hangs below the hips), sides: [{ clavicle, upperarm, thigh, calf,
 * clavicleAt: [a, b], shoulder, hip, knee }] } (left side first).
 * Returns { joints, weights } (four per vertex) and stats for logging.
 */
export function autoSkin(P, N, indices, bones, H, jointCount, body) {
  const n = P.length / 3;
  // Vertices split by texture seams count as one point on the surface.
  const canon = new Int32Array(n);
  const byPos = new Map();
  const quant = H * 1e-5;
  for (let v = 0; v < n; v++) {
    const key = `${Math.round(P[v * 3] / quant)},${Math.round(P[v * 3 + 1] / quant)},${Math.round(P[v * 3 + 2] / quant)}`;
    const c = byPos.get(key);
    if (c === undefined) byPos.set(key, v);
    canon[v] = c ?? v;
  }
  const pts = [...new Set(canon)];
  const slot = new Int32Array(n).fill(-1);
  pts.forEach((v, i) => (slot[v] = i));
  const m = pts.length;
  const at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
  const tris = [];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [canon[indices[i]], canon[indices[i + 1]], canon[indices[i + 2]]];
    if (a !== b && b !== c && c !== a) tris.push(slot[a], slot[b], slot[c]);
  }
  const X = new Float64Array(m * 3);
  pts.forEach((v, i) => X.set(at(v), i * 3));
  const xi = (i) => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]];

  // Cotangent Laplacian (negative weights clamped: Meshy's meshes are far from Delaunay) and lumped areas.
  const edges = new Map();
  const area = new Float64Array(m);
  const addEdge = (a, b, w) => {
    const key = a < b ? a * m + b : b * m + a;
    edges.set(key, (edges.get(key) ?? 0) + w);
  };
  let edgeSum = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const ids = [tris[t], tris[t + 1], tris[t + 2]];
    const p = ids.map(xi);
    const e1 = sub(p[1], p[0]);
    const e2 = sub(p[2], p[0]);
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const A = Math.hypot(...cr) / 2;
    for (const i of ids) area[i] += A / 3;
    for (let k = 0; k < 3; k++) {
      // The angle at corner k faces edge (k+1, k+2).
      const o = p[k];
      const u = sub(p[(k + 1) % 3], o);
      const v = sub(p[(k + 2) % 3], o);
      const cot = dot(u, v) / (2 * A || 1e-12);
      addEdge(ids[(k + 1) % 3], ids[(k + 2) % 3], Math.max(0.05, Math.min(cot, 20)) / 2);
      edgeSum += Math.hypot(...sub(p[(k + 1) % 3], p[(k + 2) % 3]));
    }
  }
  const meanEdge = edgeSum / Math.max(1, tris.length);
  const minArea = (meanEdge * meanEdge) / 20;
  for (let i = 0; i < m; i++) area[i] = Math.max(area[i], minArea);
  const nbr = Array.from({ length: m }, () => []);
  for (const [key, w] of edges) {
    const a = Math.floor(key / m);
    const b = key % m;
    nbr[a].push(b, w);
    nbr[b].push(a, w);
  }

  // Nearest visible bone per vertex (starting just inside the surface, so a vertex's own cell doesn't count).
  const vox = voxelize(X, tris, H);
  const B = bones.length;
  const visible = (p, q) => {
    const d = Math.hypot(...sub(q, p));
    const steps = Math.ceil(d / (vox.size * 0.5));
    let out = 0;
    for (let s = 1; s < steps; s++) {
      const f = s / steps;
      // The vertex's own voxel and a little round the bone are not tested (bones placed by hand can graze the surface).
      if (f * d < vox.size * 1.5 || (1 - f) * d < Math.max(vox.size * 1.5, 0.02 * H)) continue;
      if (!vox.inside([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f]) && ++out > 1) return false;
    }
    return true;
  };
  // Every bone's straight-line distance to each vertex (three times as far when the surface faces away from it,
  // twice as far again when the line to it leaves the body), and whether it is in sight at all.
  const near = new Int32Array(m);
  const cost = new Float32Array(m * B);
  const dist = new Float32Array(m * B);
  const blind = new Uint8Array(m);
  const along = new Float32Array(m);
  const facing = new Float32Array(m);
  let unseen = 0;
  for (let i = 0; i < m; i++) {
    const p = xi(i);
    const nv = [N[pts[i] * 3], N[pts[i] * 3 + 1], N[pts[i] * 3 + 2]];
    const ds = bones.map((b) => onSegment(p, b.a, b.b));
    const dmin = Math.min(...ds.map((x) => x.d));
    let seen = false;
    let best = Infinity;
    for (let b = 0; b < B; b++) {
      const { d, q, t } = ds[b];
      const off = sub(p, q);
      const f = dot(nv, off) / (d || 1);
      // Only bones near enough to matter get the (costly) sight test.
      const inSight = d < dmin * 3 + 0.08 * H && visible(p, q);
      seen ||= inSight;
      const c = d * (f < 0 ? 3 : 1) * (inSight ? 1 : 2);
      cost[i * B + b] = c;
      dist[i * B + b] = d;
      if (c < best) [best, near[i], along[i], facing[i]] = [c, b, t, f];
    }
    if (!seen) {
      unseen++;
      blind[i] = 1;
    }
  }
  // Each bone's thickness, and its seeds: vertices close to the middle of the bone they are nearest.
  // (Sight is not required where most of a bone's vertices have none: an open, unfillable piece of the mesh.)
  const blindShare = bones.map((_, b) => {
    let [k, all] = [0, 0];
    for (let i = 0; i < m; i++) if (near[i] === b) [k, all] = [k + blind[i], all + 1];
    return k / Math.max(1, all);
  });
  const sighted = (i) => !blind[i] || blindShare[near[i]] > 0.5;
  const radius = bones.map((_, b) => {
    const ds = [];
    for (let i = 0; i < m; i++) if (near[i] === b && along[i] > 0.25 && along[i] < 0.75 && facing[i] > 0.3 && sighted(i)) ds.push(dist[i * B + b]);
    ds.sort((x, y) => x - y);
    return ds.length ? ds[Math.floor(ds.length * 0.25)] : 0.05 * H;
  });
  const seed = (i) => along[i] > 0.1 && along[i] < 0.9 && facing[i] > 0.3 && sighted(i) && dist[i * B + near[i]] <= radius[near[i]] * 1.4;
  // A vertex is tied to the bone with the least distance along the surface from its seeds plus that straight cost
  // (so a hand resting on a thigh still goes with the hand, whatever it touches).
  const nearBone = new Int32Array(m).fill(-1);
  const score = new Float64Array(m).fill(Infinity);
  for (let b = 0; b < B; b++) {
    const geo = new Float64Array(m).fill(Infinity);
    const heap = new Heap();
    for (let i = 0; i < m; i++) if (near[i] === b && seed(i)) heap.push((geo[i] = 0), i);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (d > geo[i]) continue;
      const l = nbr[i];
      for (let e = 0; e < l.length; e += 2) {
        const u = l[e];
        const du = d + Math.hypot(X[i * 3] - X[u * 3], X[i * 3 + 1] - X[u * 3 + 1], X[i * 3 + 2] - X[u * 3 + 2]);
        if (du < geo[u]) heap.push((geo[u] = du), u);
      }
    }
    for (let i = 0; i < m; i++) {
      const sc = geo[i] + cost[i * B + b] * 1.5;
      if (sc < score[i]) [score[i], nearBone[i]] = [sc, b];
    }
  }
  const nearDist = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    if (nearBone[i] < 0) nearBone[i] = near[i];
    nearDist[i] = Math.max(dist[i * B + nearBone[i]], 0.01 * H);
  }

  // Heat: (L + A·H) w_j = A·H·p_j for every joint, L the Laplacian, H = HEAT / d² to the nearest visible bone.
  const rowPtr = new Int32Array(m + 1);
  for (let i = 0; i < m; i++) rowPtr[i + 1] = rowPtr[i] + 1 + nbr[i].length / 2;
  const colIdx = new Int32Array(rowPtr[m]);
  const vals = new Float64Array(rowPtr[m]);
  const diag = new Float64Array(m);
  const pull = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    pull[i] = (area[i] * HEAT) / (nearDist[i] * nearDist[i]);
    let k = rowPtr[i];
    let s = 0;
    for (let e = 0; e < nbr[i].length; e += 2) {
      colIdx[++k] = nbr[i][e];
      vals[k] = -nbr[i][e + 1];
      s += nbr[i][e + 1];
    }
    colIdx[rowPtr[i]] = i;
    vals[rowPtr[i]] = s + pull[i];
    diag[i] = s + pull[i];
  }
  const J = jointCount;
  const w = new Float32Array(m * J);
  const used = [...new Set([...nearBone].map((b) => bones[b].joint))];
  for (const j of used) {
    const rhs = new Float64Array(m);
    const x = new Float64Array(m);
    for (let i = 0; i < m; i++) if (bones[nearBone[i]].joint === j) x[i] = rhs[i] = pull[i];
    for (let i = 0; i < m; i++) if (x[i]) x[i] = 1;
    solve(rowPtr, colIdx, vals, diag, rhs, x);
    for (let i = 0; i < m; i++) w[i * J + j] = Math.max(0, x[i]);
  }
  const normalize = (i) => {
    let s = 0;
    for (let j = 0; j < J; j++) s += w[i * J + j];
    if (s > 0) for (let j = 0; j < J; j++) w[i * J + j] /= s;
    else w[i * J + bones[nearBone[i]].joint] = 1;
  };
  for (let i = 0; i < m; i++) normalize(i);

  const move = (i, from, to, share) => {
    const x = w[i * J + from] * share;
    w[i * J + from] -= x;
    w[i * J + to] += x;
  };
  const stats = { unseen, inside: vox.share, cloth: 0 };
  const clothShare = new Float32Array(m);
  if (body) {
    const { pelvis, chest, sides, center } = body;
    // Cloth below the hips: well away from every leg bone (more than its skin is), between hip and a little below the knee.
    const legBones = bones.map((b, i) => [b, i]).filter(([b]) => sides.some((s) => b.joint === s.thigh || b.joint === s.calf));
    const legRadius = new Map();
    for (const [b, bi] of legBones) {
      const ds = [];
      for (let i = 0; i < m; i++) if (nearBone[i] === bi) {
        const s = onSegment(xi(i), b.a, b.b);
        if (s.t > 0.2 && s.t < 0.8) ds.push(s.d);
      }
      ds.sort((a, b) => a - b);
      legRadius.set(bi, ds.length ? ds[Math.floor(ds.length * 0.35)] : 0.04 * H);
    }
    const hipY = (sides[0].hip[1] + sides[1].hip[1]) / 2;
    const kneeY = (sides[0].knee[1] + sides[1].knee[1]) / 2;
    const halfHip = Math.abs(sides[0].hip[0] - sides[1].hip[0]) / 2;
    // Loose: no bone in sight (a shell hung over air: an apron's inside faces the legs across a gap), or well clear
    // of the legs' skin; spread a little over the surface so a piece of cloth is treated as a whole.
    // Only what hangs from the hips and legs (hands resting by the hips are not cloth).
    const legJoint = new Set([pelvis, ...sides.map((x) => x.thigh)]);
    let loose = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const p = xi(i);
      if (!body.cloth || !legJoint.has(bones[nearBone[i]].joint) || bones[nearBone[i]].tail || p[1] > hipY + 0.03 * H || p[1] < kneeY - 0.15 * H) continue;
      let rel = Infinity;
      for (const [b, bi] of legBones) rel = Math.min(rel, onSegment(p, b.a, b.b).d / legRadius.get(bi));
      // Between the legs below the hips there is only cloth (or the crotch, which goes with the pelvis anyway).
      const between = 1 - smooth(0.6 * halfHip, halfHip, Math.abs(p[0] - center[0]));
      loose[i] = Math.max(blind[i] ? 1 : smooth(1.8, 2.6, rel), between);
      if (process.env.SKIN_DEBUG) (stats.rel ??= []).push(+rel.toFixed(2));
    }
    if (process.env.SKIN_DEBUG && stats.rel) {
      const r = stats.rel.sort((a, b) => a - b);
      console.log('leg radius', [...legRadius.values()].map((x) => (x / H).toFixed(3)).join(' '), 'rel quantiles', [0.1, 0.3, 0.5, 0.7, 0.9].map((q) => r[Math.floor(q * r.length)]).join(' '));
      delete stats.rel;
    }
    for (let r = 0; r < 3; r++) {
      const next = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        let s = loose[i];
        for (let e = 0; e < nbr[i].length; e += 2) s += loose[nbr[i][e]];
        next[i] = s / (1 + nbr[i].length / 2);
      }
      loose = next;
    }
    for (let i = 0; i < m; i++) {
      const p = xi(i);
      if (!legJoint.has(bones[nearBone[i]].joint) || bones[nearBone[i]].tail) continue;
      const c = Math.min(1, loose[i] * 1.5) * smooth(kneeY - 0.15 * H, kneeY - 0.08 * H, p[1]) * (1 - smooth(hipY, hipY + 0.03 * H, p[1]));
      if (c <= 0.01) continue;
      if (c > 0.5) stats.cloth++;
      clothShare[i] = c;
      // Towards the hem a little of the nearer thigh, so legs swinging forward don't poke straight through.
      const toThigh = 0.3 * smooth(hipY, kneeY, p[1]);
      const left = smooth(-halfHip, halfHip, p[0] - center[0]);
      const target = new Float32Array(J);
      target[pelvis] = 1 - toThigh;
      target[sides[0].thigh] += toThigh * left;
      target[sides[1].thigh] += toThigh * (1 - left);
      for (let j = 0; j < J; j++) w[i * J + j] = (1 - c) * w[i * J + j] + c * target[j];
    }
    // A head hung low over the chest (hunched bodies) keeps off it: below the neck joint the head's share goes to
    // the chest, and below the chest joint the neck's.
    if (body.head !== undefined) {
      for (let i = 0; i < m; i++) {
        const y = X[i * 3 + 1];
        move(i, body.head, chest, smooth(body.neckAt[1], body.neckAt[1] - 0.03 * H, y));
        move(i, body.neck, chest, smooth(body.chestAt[1], body.chestAt[1] - 0.03 * H, y));
      }
    }
    // Shoulders: the clavicle keeps the top of the shoulder only; the upper arm keeps off the chest.
    for (const s of sides) {
      const [a, b] = s.clavicleAt;
      const ab = sub(b, a);
      const len2 = dot(ab, ab) || 1;
      const out = Math.abs(s.shoulder[0] - center[0]);
      const armBone = bones.findIndex((x) => x.joint === s.upperarm);
      const arm = bones[armBone];
      const armAxis = sub(arm.b, arm.a);
      const armLen2 = dot(armAxis, armAxis) || 1;
      const armRadius = radius[armBone];
      for (let i = 0; i < m; i++) {
        const p = xi(i);
        const lateral = Math.abs(p[0] - center[0]);
        if (w[i * J + s.upperarm] > 0) {
          // Behind the shoulder joint along the arm (most of it: the top of the shoulder still turns with the arm a
          // little), or well clear of the arm and inside the joint (the chest beside a hanging arm): chest.
          const t = dot(sub(p, arm.a), armAxis) / armLen2;
          const d = onSegment(p, arm.a, arm.b).d;
          const inward = Math.max(0.7 * (1 - smooth(-0.2, 0.05, t)), smooth(1.4 * armRadius, 2.2 * armRadius, d) * (1 - smooth(out - 0.04 * H, out, lateral)));
          if (inward > 0) move(i, s.upperarm, chest, inward);
        }
        if (w[i * J + s.clavicle] > 0) {
          const t = dot(sub(p, a), ab) / len2;
          const lineY = a[1] + ab[1] * Math.min(1, Math.max(0, t));
          const keep = smooth(0.2, 0.75, t) * (t >= 1 ? 1 : 1 - smooth(0.02 * H, 0.06 * H, lineY - p[1]));
          move(i, s.clavicle, chest, 1 - keep);
        }
      }
    }
  }

  // At most four influences, smoothed over the surface (cut, smooth, cut again).
  const cut = () => {
    for (let i = 0; i < m; i++) {
      const row = w.subarray(i * J, i * J + J);
      const top = [...row].map((x, j) => [j, x]).sort((p, q) => q[1] - p[1]);
      const keep = new Set(top.slice(0, MAX_INFLUENCES).filter(([, x]) => x >= MIN_WEIGHT).map(([j]) => j));
      if (!keep.size) keep.add(top[0][0]);
      for (let j = 0; j < J; j++) if (!keep.has(j)) row[j] = 0;
      normalize(i);
    }
  };
  cut();
  for (let r = 0; r < SMOOTH_ROUNDS; r++) {
    const next = new Float32Array(m * J);
    for (let i = 0; i < m; i++) {
      const l = nbr[i];
      let tw = 0;
      for (let e = 0; e < l.length; e += 2) tw += l[e + 1];
      for (let j = 0; j < J; j++) {
        let s = 0;
        for (let e = 0; e < l.length; e += 2) s += w[l[e] * J + j] * l[e + 1];
        next[i * J + j] = 0.5 * w[i * J + j] + (tw ? (0.5 * s) / tw : 0.5 * w[i * J + j]);
      }
    }
    w.set(next);
    cut();
  }

  if (process.env.SKIN_DEBUG) {
    stats.debugColor = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      const i = slot[canon[v]];
      stats.debugColor.set([blind[i] ? 1 : 0.25, clothShare[i], 0.25, 1], v * 4);
    }
  }
  const joints = new Uint16Array(n * 4);
  const weights = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const i = slot[canon[v]];
    const top = [...w.subarray(i * J, i * J + J)].map((x, j) => [j, x]).filter(([, x]) => x > 0).sort((p, q) => q[1] - p[1]).slice(0, MAX_INFLUENCES);
    const sum = top.reduce((s, [, x]) => s + x, 0) || 1;
    top.forEach(([j, x], k) => {
      joints[v * 4 + k] = j;
      weights[v * 4 + k] = x / sum;
    });
  }
  return { joints, weights, stats };
}
