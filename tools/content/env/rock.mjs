// Rocks and cliffs.
//
// Boulder (env.rock.*): a seeded point cloud → convex hull → 4–7 plane cuts (flat fracture faces) → the hull
// subdivided, low-amplitude fBm on the faces the cuts did not make, edges worn round (smoothing along the hull's
// edges), strata as tilted colour bands, a moss (or snow) mask on top-facing faces. Levels of detail by
// meshoptimizer. Collision: the hull before displacement (≤ 32 points), stone.
//
// Cliff face (env.cliff.*): a displaced grid panel. Its left and right edge profiles are a function of height only
// (from the family seed), and the panel's own detail fades to nothing at both edges, so any two panels side by side
// meet vertex for vertex (and normal for normal). Ledges are a stepped noise in height shared by the family, so
// they run on across panels. A skirt goes 1 m below grade; the top lip turns back to the panel's depth.
// Collision: its lightest level as a triangle mesh (≤ 200 triangles).

import { MeshoptSimplifier } from 'meshoptimizer';
import { rng } from './rng.mjs';
import { fbm3, smoothstep } from './noise.mjs';
import { Mesh, add, cross, dot, len, mul, norm, sub } from './mesh.mjs';
import { toLinear } from './tree.mjs';

await MeshoptSimplifier.ready;

// ---------------------------------------------------------------- convex hull

/** Convex hull of points: triangles [a, b, c] (indices into pts) wound outward. Deterministic for the input order. */
export function convexHull(pts) {
  const n = pts.length;
  const span = Math.max(...[0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]))));
  const eps = 1e-9 * span;
  // Initial tetrahedron: extreme points.
  let i0 = 0;
  for (let i = 1; i < n; i++) if (pts[i][0] < pts[i0][0]) i0 = i;
  let i1 = 0;
  let best = -1;
  for (let i = 0; i < n; i++) {
    const d = len(sub(pts[i], pts[i0]));
    if (d > best) {
      best = d;
      i1 = i;
    }
  }
  let i2 = -1;
  best = -1;
  for (let i = 0; i < n; i++) {
    const d = len(cross(sub(pts[i1], pts[i0]), sub(pts[i], pts[i0])));
    if (d > best) {
      best = d;
      i2 = i;
    }
  }
  const nrm0 = cross(sub(pts[i1], pts[i0]), sub(pts[i2], pts[i0]));
  let i3 = -1;
  best = -1;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(dot(nrm0, sub(pts[i], pts[i0])));
    if (d > best) {
      best = d;
      i3 = i;
    }
  }
  let faces = [];
  const centroid = mul(add(add(pts[i0], pts[i1]), add(pts[i2], pts[i3])), 0.25);
  const addFace = (a, b, c) => {
    const nn = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a]));
    if (dot(nn, sub(pts[a], centroid)) < 0) faces.push([a, c, b]);
    else faces.push([a, b, c]);
  };
  addFace(i0, i1, i2);
  addFace(i0, i1, i3);
  addFace(i0, i2, i3);
  addFace(i1, i2, i3);
  const used = new Set([i0, i1, i2, i3]);
  const normal = (f) => cross(sub(pts[f[1]], pts[f[0]]), sub(pts[f[2]], pts[f[0]]));
  for (let p = 0; p < n; p++) {
    if (used.has(p)) continue;
    const visible = faces.map((f) => dot(norm(normal(f)), sub(pts[p], pts[f[0]])) > eps);
    if (!visible.some(Boolean)) continue;
    const edges = new Set();
    faces.forEach((f, i) => {
      if (!visible[i]) return;
      for (let k = 0; k < 3; k++) edges.add(`${f[k]},${f[(k + 1) % 3]}`);
    });
    const next = faces.filter((_, i) => !visible[i]);
    faces.forEach((f, i) => {
      if (!visible[i]) return;
      for (let k = 0; k < 3; k++) {
        const u = f[k];
        const v = f[(k + 1) % 3];
        if (!edges.has(`${v},${u}`)) next.push([u, v, p]);
      }
    });
    faces = next;
    used.add(p);
  }
  return faces;
}

/** The hull's vertex indices, in order of first use. */
const hullVerts = (faces) => [...new Set(faces.flat())];

// ---------------------------------------------------------------- boulder

/** The boulder's convex shape: { points (hull vertices), cut: Set of plane-cut point indices, faces }. */
export function boulderHull(seed, g) {
  const r = rng(seed);
  const [W, Hh, D] = g.size;
  let pts = [];
  for (let i = 0; i < g.points; i++) {
    const u = r.unit();
    const s = 1 + r.jitter(0.18);
    // Bottom flattened and sunk a little into the ground.
    const y = u[1] < 0 ? u[1] * 0.35 : u[1];
    pts.push([(u[0] * s * W) / 2, ((y + 0.35) / 1.35) * Hh * s - 0.12, (u[2] * s * D) / 2]);
  }
  const planes = [];
  const centre = [0, Hh * 0.45, 0];
  const nc = r.int(g.cuts[0], g.cuts[1]);
  for (let c = 0; c < nc; c++) {
    // Cuts on the sides and top, slanted, each taking off a slice.
    const az = r.next() * Math.PI * 2;
    const el = r.range(-0.15, 0.95);
    const n = norm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]);
    const ext = Math.max(...pts.map((p) => dot(n, sub(p, centre))));
    const d = ext * r.range(0.62, 0.86);
    planes.push({ n, d });
    const faces = convexHull(pts);
    const keep = pts.filter((p) => dot(n, sub(p, centre)) <= d);
    const add2 = [];
    const seen = new Set();
    for (const f of faces)
      for (let k = 0; k < 3; k++) {
        const a = f[k];
        const b = f[(k + 1) % 3];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const da = dot(n, sub(pts[a], centre)) - d;
        const db = dot(n, sub(pts[b], centre)) - d;
        if ((da > 0) === (db > 0)) continue;
        const t = da / (da - db);
        add2.push(add(pts[a], mul(sub(pts[b], pts[a]), t)));
      }
    pts = [...keep, ...add2];
  }
  // Keep the hull's own points only; at most `maxPoints` (closest pairs merged away first).
  let faces = convexHull(pts);
  pts = hullVerts(faces).map((i) => pts[i]);
  while (pts.length > g.maxPoints) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const dd = len(sub(pts[i], pts[j]));
        if (dd < bd) {
          bd = dd;
          bi = j;
        }
      }
    pts.splice(bi, 1);
    faces = convexHull(pts);
    pts = hullVerts(faces).map((i) => pts[i]);
  }
  faces = convexHull(pts);
  const onCut = (p) => planes.some((pl) => Math.abs(dot(pl.n, sub(p, centre)) - pl.d) < 1e-6 * W);
  return { points: pts, faces, cutFace: faces.map((f) => f.every((i) => onCut(pts[i]))), centre };
}

/** Subdivide a triangle mesh `levels` times (shared edges split once, so it stays watertight). */
function subdivide(P, F, levels, tag) {
  let pts = P.map((p) => [...p]);
  let faces = F.map((f, i) => ({ v: f, t: tag[i] }));
  const edgeOf = new Map(); // vertex → set of original hull edges it lies on (for edge wear)
  const onEdge = new Set(P.map((_, i) => i));
  for (let l = 0; l < levels; l++) {
    const mid = new Map();
    const midpoint = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      let m = mid.get(key);
      if (m === undefined) {
        m = pts.length;
        pts.push(mul(add(pts[a], pts[b]), 0.5));
        mid.set(key, m);
        // A midpoint of an edge between two different original faces lies on a hull edge.
        if (onEdge.has(a) && onEdge.has(b) && (l > 0 || true)) edgeOf.set(m, key);
      }
      return m;
    };
    const next = [];
    for (const { v: [a, b, c], t } of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push({ v: [a, ab, ca], t }, { v: [ab, b, bc], t }, { v: [ca, bc, c], t }, { v: [ab, bc, ca], t });
    }
    faces = next;
  }
  return { pts, faces };
}

/** Per-vertex normals with creases kept: corners average only faces within `crease` radians of their own. */
function creasedMesh(P, I, colourAt, uvScale, wind) {
  const m = new Mesh();
  const fn = [];
  for (let t = 0; t < I.length; t += 3) fn.push(norm(cross(sub(P[I[t + 1]], P[I[t]]), sub(P[I[t + 2]], P[I[t]]))));
  const around = P.map(() => []);
  for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) around[I[t * 3 + k]].push(t);
  const cos = Math.cos((55 * Math.PI) / 180);
  const keyed = new Map();
  for (let t = 0; t < I.length / 3; t++) {
    const f = fn[t];
    const ax = Math.abs(f[0]) > Math.abs(f[1]) ? (Math.abs(f[0]) > Math.abs(f[2]) ? 0 : 2) : Math.abs(f[1]) > Math.abs(f[2]) ? 1 : 2;
    const ids = [];
    for (let k = 0; k < 3; k++) {
      const v = I[t * 3 + k];
      let n = [0, 0, 0];
      for (const o of around[v]) if (dot(fn[o], f) > cos) n = add(n, fn[o]);
      n = norm(n);
      const key = `${v},${ax},${Math.round(n[0] * 20)},${Math.round(n[1] * 20)},${Math.round(n[2] * 20)}`;
      let id = keyed.get(key);
      if (id === undefined) {
        const p = P[v];
        // Box-projected uv by the face's main axis (seams fall on the rock's creases).
        const uv = ax === 0 ? [p[2] / uvScale, -p[1] / uvScale] : ax === 1 ? [p[0] / uvScale, p[2] / uvScale] : [p[0] / uvScale, -p[1] / uvScale];
        id = m.vertex(p, n, uv, colourAt(p, n), wind);
        keyed.set(key, id);
      }
      ids.push(id);
    }
    m.tri(ids[0], ids[1], ids[2]);
  }
  return m;
}

/** Rock colour: base × strata bands × AO low down, then moss or snow on top-facing surfaces. */
function rockColour(seed, look, height) {
  const base = toLinear(look.rock);
  const band = toLinear(look.band ?? look.rock);
  const cover = look.cover ? toLinear(look.cover) : null;
  const noise = fbm3(seed + 77, 3);
  const tilt = look.strataTilt ?? 0.25;
  return (p, n) => {
    const s = 0.5 + 0.5 * Math.sin((p[1] + p[0] * tilt) * (look.strataFreq ?? 5) + 2.5 * noise(p[0] * 0.6, p[1] * 0.6, p[2] * 0.6));
    const b = smoothstep(0.55, 0.85, s);
    const ao = 0.62 + 0.38 * Math.min(1, Math.max(0, (p[1] + 0.1) / Math.max(0.6, height * 0.5)));
    let c = base.map((v, i) => (v + (band[i] - v) * b) * ao * (1 + 0.12 * noise(p[0] * 2.1, p[1] * 2.1, p[2] * 2.1)));
    if (cover) {
      const m = smoothstep(look.coverFrom ?? 0.45, (look.coverFrom ?? 0.45) + 0.3, n[1] + 0.35 * noise(p[0] * 1.3 + 9, p[1] * 1.3, p[2] * 1.3));
      c = c.map((v, i) => v + (cover[i] - v) * m * (look.coverAmount ?? 1));
    }
    return c;
  };
}

/** Simplify an indexed mesh to about `target` triangles (meshoptimizer; sloppy if it can't get there). */
function simplify(P, I, target) {
  if (I.length / 3 <= target) return I;
  const pos = new Float32Array(P.flat());
  const idx = new Uint32Array(I);
  let [out] = MeshoptSimplifier.simplify(idx, pos, 3, target * 3, 1, ['LockBorder']);
  if (out.length / 3 > target * 1.08) [out] = MeshoptSimplifier.simplifySloppy(out, pos, 3, null, target * 3, 1);
  return [...out];
}

/** The boulder's detailed surface (subdivided, displaced, edges worn): { P, I }. */
export function boulderSurface(seed, g, hull) {
  const tag = hull.cutFace;
  const { pts, faces } = subdivide(hull.points, hull.faces, g.subdivide, tag);
  // Vertex normals from the hull faces round each vertex; which vertices only touch cut faces.
  const vn = pts.map(() => [0, 0, 0]);
  const cutOnly = pts.map(() => true);
  for (const { v, t } of faces) {
    const f = norm(cross(sub(pts[v[1]], pts[v[0]]), sub(pts[v[2]], pts[v[0]])));
    for (const i of v) {
      vn[i] = add(vn[i], f);
      if (!t) cutOnly[i] = false;
    }
  }
  const noise = fbm3(seed + 31, 4);
  const amp = g.displace * Math.max(...g.size);
  const P = pts.map((p, i) => {
    const n = norm(vn[i]);
    const d = amp * noise(p[0] * g.freq, p[1] * g.freq, p[2] * g.freq) * (cutOnly[i] ? 0.12 : 1);
    return add(p, mul(n, d));
  });
  // Edge wear: vertices where the surface turns sharply move toward their neighbours' average (twice).
  const nb = P.map(() => new Set());
  for (const { v } of faces) for (let k = 0; k < 3; k++) {
    nb[v[k]].add(v[(k + 1) % 3]);
    nb[v[k]].add(v[(k + 2) % 3]);
  }
  for (let pass = 0; pass < g.wear; pass++) {
    const old = P.map((p) => [...p]);
    P.forEach((p, i) => {
      const ns = [...nb[i]];
      // Sharpness: how far apart the neighbours' directions from this vertex's normal spread.
      const n = norm(vn[i]);
      const spreadN = ns.reduce((s, j) => s + Math.abs(dot(norm(vn[j]), n)), 0) / ns.length;
      if (spreadN > 0.93) return;
      const avg = ns.reduce((s, j) => add(s, old[j]), [0, 0, 0]).map((v) => v / ns.length);
      P[i] = add(old[i], mul(sub(avg, old[i]), 0.5));
    });
  }
  return { P, I: faces.flatMap((f) => f.v) };
}

/** One level of the boulder: { rock: Mesh }. */
export function boulderMesh(seed, g, surface, target, look) {
  const I = simplify(surface.P, surface.I, target);
  return { rock: creasedMesh(surface.P, I, rockColour(seed, look, g.size[1]), g.uvScale, [0, 0]) };
}

/** Gameplay shape: the hull before displacement, a little inside it (the worn edges sit inside the hull). */
export function boulderShapes(hull) {
  return [{ kind: 'hull', points: hull.points, blocks: 'all', surface: 'rock' }];
}

// ---------------------------------------------------------------- cliff

/**
 * The cliff's surface depth z(x, y) (game space: the face looks along -z, toward the player; its back at z = depth).
 * Panel spans x in [-w/2, w/2]. Returns { z, nz } (depth, and the face normal there).
 */
export function cliffField(familySeed, seed, g) {
  const edgeN = fbm3(familySeed + 1, 4);
  const ledgeN = fbm3(familySeed + 2, 2);
  const panelN = fbm3(seed + 3, 4);
  const fineN = fbm3(seed + 4, 3);
  const half = g.width / 2;
  // Shared by every panel of the family: a function of height only (and so of nothing a panel chooses).
  const edge = (y) => g.relief * 0.55 * edgeN(0.3, y * 0.35, 0.7) + g.relief * 0.25 * edgeN(1.7, y * 1.1, 0.2);
  // Ledges: a stepped profile in height (strata), the same across the family.
  const ledge = (y) => {
    const s = y / g.strata + 0.5 * ledgeN(0.1, y * 0.2, 0.4);
    const f = s - Math.floor(s);
    return g.ledgeDepth * smoothstep(0.75, 0.95, f);
  };
  const fade = (x) => {
    const t = Math.max(0, Math.min(1, (half - Math.abs(x)) / (half * 0.45)));
    return t * t * (3 - 2 * t);
  };
  const z = (x, y) => {
    const top = smoothstep(g.height - 0.9, g.height, y);
    // Broad bulges, vertical ribs (a ridged noise stretched up the face: jointed rock) and fine roughness.
    const ribs = 1 - Math.abs(panelN(x * 0.45 + 7, y * 0.1, 0.9)) * 2;
    const local = g.relief * (panelN(x * 0.22, y * 0.22, 0.5) + 0.55 * ribs + 0.3 * fineN(x * 0.9, y * 0.9, 0.3));
    return edge(y) + ledge(y) + fade(x) * local + top * 0.6;
  };
  // The top edge rises and falls across the panel (back to the shared height at both edges, so neighbours meet).
  const topN = fbm3(seed + 5, 3);
  const topAt = (x) => g.height + fade(x) * (g.topRelief ?? 0) * (0.5 + 0.5 * topN(x * 0.35, 0.2, 0.6));
  return { z, half, topAt };
}

/** One level of the cliff panel: { rock: Mesh } with a front grid `nx` × `ny`, top lip, sides and back. */
export function cliffMesh(familySeed, seed, g, lod, look) {
  const { z, half, topAt } = cliffField(familySeed, seed, g);
  const m = new Mesh();
  const colour = rockColour(seed, look, g.height);
  const y0 = -g.skirt;
  const y1 = g.height;
  const yTop = (x) => topAt(x);
  const nx = lod.nx;
  const ny = lod.ny;
  const e = 0.01;
  const front = [];
  for (let j = 0; j <= ny; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const x = -half + (2 * half * i) / nx;
      // Each column runs from the skirt to its own top.
      const y = y0 + ((yTop(x) - y0) * j) / ny;
      const p = [x, y, z(x, y)];
      // Normal from the field (so both edges of every panel agree exactly): the face looks toward -z.
      // At the two edges the panel's own detail has faded out with no slope (smoothstep), so only the shared
      // profile is left: no slope across, which makes both edges' normals the same exactly.
      const dx = i === 0 || i === nx ? 0 : (z(x + e, y) - z(x - e, y)) / (2 * e);
      const dy = (z(x, y + e) - z(x, y - e)) / (2 * e);
      const n = norm([dx, dy, -1]);
      // u wraps a whole number of times across the panel, so neighbours continue the picture.
      row.push(m.vertex(p, n, [((x + half) / (2 * half)) * g.uvRepeat, -y / ((2 * half) / g.uvRepeat)], colour(p, n), [0, 0]));
    }
    front.push(row);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) m.quad(front[j][i], front[j + 1][i], front[j + 1][i + 1], front[j][i + 1]);
  // Top: from the lip back to the panel's depth.
  const back = g.depth;
  const topRow = [];
  for (let i = 0; i <= nx; i++) {
    const x = -half + (2 * half * i) / nx;
    const p = [x, yTop(x) + 0.15, back];
    topRow.push(m.vertex(p, [0, 1, 0], [((x + half) / (2 * half)) * g.uvRepeat, back / ((2 * half) / g.uvRepeat)], colour(p, [0, 1, 0]), [0, 0]));
  }
  const lip = [];
  for (let i = 0; i <= nx; i++) {
    const x = -half + (2 * half * i) / nx;
    const p = [x, yTop(x), z(x, yTop(x))];
    lip.push(m.vertex(p, [0, 1, 0], [((x + half) / (2 * half)) * g.uvRepeat, p[2] / ((2 * half) / g.uvRepeat)], colour(p, [0, 1, 0]), [0, 0]));
  }
  for (let i = 0; i < nx; i++) m.quad(lip[i], topRow[i], topRow[i + 1], lip[i + 1]);
  // Sides (they meet a neighbour's back to back) and the back.
  for (const side of [-1, 1]) {
    const x = side * half;
    const ids = [];
    for (let j = 0; j <= ny; j++) {
      const y = y0 + ((y1 - y0) * j) / ny;
      const n = [side, 0, 0];
      ids.push([m.vertex([x, y, z(x, y)], n, [z(x, y) / 4, -y / 4], colour([x, y, 0], n), [0, 0]), m.vertex([x, y, back], n, [back / 4, -y / 4], colour([x, y, back], n), [0, 0])]);
    }
    for (let j = 0; j < ny; j++) {
      if (side < 0) m.quad(ids[j][0], ids[j][1], ids[j + 1][1], ids[j + 1][0]);
      else m.quad(ids[j][0], ids[j + 1][0], ids[j + 1][1], ids[j][1]);
    }
  }
  {
    // The back, up to the top's line (a strip of columns as wide as the lightest level's, so it stays cheap).
    const n = [0, 0, 1];
    const cols = Math.min(nx, 8);
    const ids = [];
    for (let i = 0; i <= cols; i++) {
      const x = -half + (2 * half * i) / cols;
      ids.push([m.vertex([x, y0, back], n, [i / cols, 0], colour([x, 0, back], n), [0, 0]), m.vertex([x, yTop(x) + 0.15, back], n, [i / cols, 1], colour([x, y1, back], n), [0, 0])]);
    }
    for (let i = 0; i < cols; i++) m.quad(ids[i][0], ids[i + 1][0], ids[i + 1][1], ids[i][1]);
  }
  return { rock: m };
}

/** Collision: the lightest level's triangles, positions rounded to a millimetre. */
export function cliffShapes(mesh) {
  const positions = mesh.P.map((v) => Math.round(v * 1000) / 1000);
  return [{ kind: 'mesh', positions, indices: [...mesh.I], blocks: 'all', surface: 'rock' }];
}
