// Rocks and cliffs.
//
// Boulder (env.rock.*): a seeded point cloud → convex hull → 4–7 plane cuts (flat fracture faces) → the hull
// subdivided; then, only ever inward of the hull (so the collision hull, the hull before any of this, is unchanged):
// low-amplitude fBm on the faces the cuts did not make, bedding (strata) as stepped grooves along a tilted bedding
// plane on the weathered sides, and corner chips (small plane cuts that leave crisp flat facets); edges worn only a
// little. Colour per vertex: strata bands, cavities dark and worn convex edges pale (curvature), moss or snow on
// top-facing surfaces away from edges, broad hue patches. The rock picture comes on top in the renderer (tri-planar
// in world space, envMaterials.ts). Levels of detail by meshoptimizer. Collision: the hull (≤ 32 points), stone.
//
// Cliff face (env.cliff.*): a displaced grid panel. Its left and right edge profiles are a function of height only
// (from the family seed), and the panel's own detail fades to nothing at both edges, so any two panels side by side
// meet vertex for vertex (and normal for normal). Ledges are a stepped noise in height shared by the family, so
// they run on across panels. Joint blocks (lighter levels' `detail`): Worley cells wider than tall, each a slightly
// tilted face, with grooves along their edges, cut in (never out) on the near levels only. Colour noise is read on a
// circle round the panel's width, so both edges get the same colour. A skirt goes 1 m below grade; the top lip turns
// back to the panel's depth. Collision: its lightest level (no joint detail) as a triangle mesh (≤ 200 triangles).

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
    const d = ext * r.range(...(g.cutDepth ?? [0.62, 0.86]));
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
function creasedMesh(P, I, colourAt, uvScale, wind, creaseDegrees = 55) {
  const m = new Mesh();
  const fn = [];
  for (let t = 0; t < I.length; t += 3) fn.push(norm(cross(sub(P[I[t + 1]], P[I[t]]), sub(P[I[t + 2]], P[I[t]]))));
  const around = P.map(() => []);
  for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) around[I[t * 3 + k]].push(t);
  const cos = Math.cos((creaseDegrees * Math.PI) / 180);
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
        id = m.vertex(p, n, uv, colourAt(p, n, v), wind);
        keyed.set(key, id);
      }
      ids.push(id);
    }
    m.tri(ids[0], ids[1], ids[2]);
  }
  return m;
}

/**
 * Rock colour (linear rgb), the macro look under the tiled picture:
 * - strata: two band frequencies along a tilted bedding direction, warped, between `rock` and `band`;
 * - broad patches: a warm/cool hue shift over metres (`hue`, default 0.08) and brightness patches;
 * - occlusion low down and in cavities, worn convex edges paler (`curv(v)`: + concave, - convex, about -1..1);
 * - cover (moss or snow) on surfaces facing up, patchy, kept off the sharp edges and heavier in hollows.
 * `space(p)` maps a position to the noise space (the cliff reads its noise on a circle so both edges match).
 */
function rockColour(seed, look, height, opts = {}) {
  const base = toLinear(look.rock);
  const band = toLinear(look.band ?? look.rock);
  const cover = look.cover ? toLinear(look.cover) : null;
  const noise = fbm3(seed + 77, 3);
  const patch = fbm3(seed + 78, 2);
  const tilt = look.strataTilt ?? 0.25;
  const freq = look.strataFreq ?? 5;
  const hue = look.hue ?? 0.08;
  const space = opts.space ?? ((p) => p);
  const curv = opts.curv ?? (() => 0);
  const bedding = opts.bedding ?? ((p, q) => p[1] + q[0] * tilt);
  return (p, n, v) => {
    const q = space(p);
    const s0 = bedding(p, q) + 0.12 * noise(q[0] * 0.6, q[1] * 0.6, q[2] * 0.6);
    // Thick beds and thin laminae.
    const bed = smoothstep(0.5, 0.85, 0.5 + 0.5 * Math.sin(s0 * freq));
    const lam = 0.5 + 0.5 * Math.sin(s0 * freq * 3.7 + 1.3);
    const b = Math.min(1, bed * 0.85 + 0.15 * lam);
    const ao = 0.6 + 0.4 * Math.min(1, Math.max(0, (p[1] + 0.1) / Math.max(0.6, height * 0.5)));
    const k = curv(v);
    // Cavities darker, convex worn edges paler.
    const wear = 1 - 0.28 * Math.max(0, k) + 0.16 * Math.max(0, -k);
    const pa = patch(q[0] * 0.35, q[1] * 0.35, q[2] * 0.35);
    const shade = (1 + 0.14 * noise(q[0] * 2.1, q[1] * 2.1, q[2] * 2.1) + 0.12 * pa) * ao * wear;
    const warm = [1 + hue * pa, 1, 1 - hue * pa];
    let c = base.map((x, i) => (x + (band[i] - x) * b) * shade * warm[i]);
    if (cover) {
      const from = look.coverFrom ?? 0.45;
      const up = n[1] + 0.35 * noise(q[0] * 1.3 + 9, q[1] * 1.3, q[2] * 1.3) + 0.25 * Math.max(0, k) - 0.35 * Math.max(0, -k);
      const m = smoothstep(from, from + 0.3, up) * (look.coverAmount ?? 1);
      // Moss is darker in the hollows and has a little variation of its own; snow stays white.
      const tone = 1 + 0.15 * noise(q[0] * 4 + 3, q[1] * 4, q[2] * 4);
      c = c.map((x, i) => x + (cover[i] * tone - x) * m);
    }
    return c;
  };
}

/** Per-vertex curvature of a triangle mesh: + concave (neighbours above the surface), - convex, scaled to about -1..1. */
function curvature(P, I) {
  const nb = P.map(() => new Set());
  const vn = P.map(() => [0, 0, 0]);
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const f = cross(sub(P[b], P[a]), sub(P[c], P[a]));
    for (const [x, y, z] of [[a, b, c], [b, c, a], [c, a, b]]) {
      vn[x] = add(vn[x], f);
      nb[x].add(y);
      nb[x].add(z);
    }
  }
  return P.map((p, i) => {
    const ns = [...nb[i]];
    if (!ns.length) return 0;
    const avg = ns.reduce((s, j) => add(s, P[j]), [0, 0, 0]).map((x) => x / ns.length);
    const edge = ns.reduce((s, j) => s + len(sub(P[j], p)), 0) / ns.length;
    return Math.max(-1, Math.min(1, (dot(sub(avg, p), norm(vn[i])) / Math.max(1e-6, edge)) * 4));
  });
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

/**
 * The boulder's detailed surface: { P, I, curv }. Subdivided hull, then fBm, bedding grooves and corner chips (the
 * last two only ever cut in), then edges worn a little. `curv`: per-vertex curvature for the colour.
 */
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
  // Bedding: a tilted plane through the rock; each bed's lower edge is undercut (a groove under a ledge) on the
  // weathered sides, faintly across fresh fracture faces.
  const r = rng(seed + 41);
  const st = g.strata ?? null;
  const bedN = st ? norm([Math.cos(r.next() * Math.PI * 2) * st.tilt, 1, Math.sin(r.next() * Math.PI * 2) * st.tilt]) : null;
  const bedWarp = fbm3(seed + 43, 2);
  const P = pts.map((p, i) => {
    const n = norm(vn[i]);
    let d = amp * noise(p[0] * g.freq, p[1] * g.freq, p[2] * g.freq) * (cutOnly[i] ? 0.12 : 1);
    if (st) {
      const s = dot(p, bedN) / st.spacing + 0.35 * bedWarp(p[0] * 0.8, p[1] * 0.8, p[2] * 0.8);
      const f = s - Math.floor(s);
      // Groove at the bottom of each bed, and a slight bevel at its top.
      const groove = 1 - smoothstep(0.0, 0.32, f) + 0.35 * smoothstep(0.82, 1.0, f);
      const side = 1 - Math.abs(dot(n, bedN));
      d -= st.depth * groove * side * (cutOnly[i] ? 0.35 : 1);
    }
    return add(p, mul(n, d));
  });
  // Corner chips: small plane cuts near hull corners, leaving flat facets with crisp edges (inward only).
  if (g.chips) {
    // Not the corners that set the rock's outline (its extremes across, deep and high): the footprint and the
    // collision hull stay the rock's, and a chip never leaves a hull corner standing far out in the air.
    const ext = [0, 1, 2].map((k) => [Math.min(...hull.points.map((p) => p[k])), Math.max(...hull.points.map((p) => p[k]))]);
    const inner = (p) => [0, 1, 2].every((k) => p[k] > ext[k][0] + 0.12 && p[k] < ext[k][1] - 0.12);
    const corners = hull.points.filter((p) => p[1] >= 0.15 && inner(p));
    // The six corners that set the bounds (furthest each way along x, y and z).
    const outline = [0, 1, 2].flatMap((k) => [hull.points.reduce((a, p) => (p[k] < a[k] ? p : a)), hull.points.reduce((a, p) => (p[k] > a[k] ? p : a))]);
    const nChips = corners.length ? r.int(g.chips[0], g.chips[1]) : 0;
    // A corner's own normal (the hull faces round it): the corner is the rock's furthest point that way, so a cut
    // across it takes off that corner only.
    const cornerNormal = (at) => {
      const i = hull.points.indexOf(at);
      let n = [0, 0, 0];
      for (const f of hull.faces) if (f.includes(i)) n = add(n, norm(cross(sub(hull.points[f[1]], hull.points[f[0]]), sub(hull.points[f[2]], hull.points[f[0]]))));
      return norm(n);
    };
    for (let c = 0; c < nChips; c++) {
      const at = corners[r.int(0, corners.length - 1)];
      const base = cornerNormal(at);
      let out = norm(add(base, [r.jitter(0.35), r.jitter(0.25), r.jitter(0.35)]));
      if (hull.points.some((p) => dot(out, sub(p, at)) > 1e-6)) out = base;
      const depth = r.range(g.chipDepth[0], g.chipDepth[1]);
      const d0 = dot(out, at) - depth;
      // Never a corner that sets the outline (the footprint stays the rock's).
      if (outline.some((q) => dot(out, q) > d0)) continue;
      for (let i = 0; i < P.length; i++) {
        const e = dot(out, P[i]) - d0;
        if (e > 0) P[i] = sub(P[i], mul(out, e));
      }
    }
  }
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
      P[i] = add(old[i], mul(sub(avg, old[i]), g.wearAmount ?? 0.5));
    });
  }
  const I = faces.flatMap((f) => f.v);
  return { P, I, curv: curvature(P, I), bedN };
}

/** One level of the boulder: { rock: Mesh }. */
export function boulderMesh(seed, g, surface, target, look) {
  const I = simplify(surface.P, surface.I, target);
  const bedN = surface.bedN;
  const colour = rockColour(seed, look, g.size[1], {
    curv: (v) => surface.curv[v] ?? 0,
    // Colour strata follow the same bedding as the grooves.
    ...(bedN ? { bedding: (p) => dot(p, bedN) } : {}),
  });
  return { rock: creasedMesh(surface.P, I, colour, g.uvScale, [0, 0], g.crease ?? 55) };
}

/** Gameplay shape: the hull before displacement, a little inside it (the worn edges sit inside the hull). */
export function boulderShapes(hull) {
  return [{ kind: 'hull', points: hull.points, blocks: 'all', surface: 'rock' }];
}

// ---------------------------------------------------------------- pebbles

/**
 * A pebble cluster (env.rock.pebbles): `stones` small convex stones, each the hull of a few seeded points on a
 * squashed ellipsoid, the largest near the middle, the rest round it, sunk a quarter of their height into the
 * ground; faces wholly below grade are dropped. Faceted (a low crease angle) and coloured like the boulder (strata,
 * patches, `look`). Decoration only: no collision. { rock: Mesh }.
 */
export function pebblesMesh(seed, g, look) {
  const r = rng(seed);
  const n = r.int(g.stones[0], g.stones[1]);
  const placed = [];
  const P = [];
  const I = [];
  for (let k = 0; k < n; k++) {
    // Sizes fall off from the first (largest) stone.
    const s = g.size[1] - (g.size[1] - g.size[0]) * (k / Math.max(1, n - 1)) * r.range(0.7, 1);
    let c = [0, 0];
    for (let t = 0; t < 24; t++) {
      const a = r.next() * Math.PI * 2;
      const d = k === 0 ? r.range(0, g.radius * 0.2) : r.range(g.radius * 0.25, g.radius);
      c = [Math.cos(a) * d, Math.sin(a) * d];
      if (placed.every(([x, z, q]) => Math.hypot(x - c[0], z - c[1]) > (q + s) * 0.42)) break;
    }
    placed.push([c[0], c[1], s]);
    const flat = r.range(g.flat[0], g.flat[1]);
    const long = r.range(1, 1.45);
    const turn = r.next() * Math.PI;
    const pts = [];
    for (let i = 0; i < g.points; i++) {
      const u = r.unit();
      const x = (u[0] * s * long) / 2;
      const z = (u[2] * s) / 2;
      pts.push([x * Math.cos(turn) - z * Math.sin(turn), (u[1] * s * flat) / 2, x * Math.sin(turn) + z * Math.cos(turn)]);
    }
    const lo = Math.min(...pts.map((p) => p[1]));
    const hi = Math.max(...pts.map((p) => p[1]));
    const lift = -lo - (hi - lo) * 0.25;
    const o = P.length;
    for (const p of pts) P.push([p[0] + c[0], p[1] + lift, p[2] + c[1]]);
    for (const f of convexHull(pts)) if (f.some((i) => P[o + i][1] > 0.004)) I.push(o + f[0], o + f[1], o + f[2]);
  }
  const top = Math.max(...P.map((p) => p[1]));
  const colour = rockColour(seed, look, top);
  return { rock: creasedMesh(P, I, colour, g.uvScale, [0, 0], g.crease ?? 30) };
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
  // Joint blocks (near levels only): Worley cells, wider than tall (bedding), each face a little tilted, grooves
  // along the joints. Depth into the face (+z), never out of it; none at the panel's edges (fade).
  const jr = rng(seed + 9);
  const jw = g.joints?.size ?? [1.4, 0.8];
  const cells = [];
  for (let cy = -1.5; cy < g.height + 2.5; cy += jw[1])
    for (let cx = -half - jw[0]; cx < half + jw[0]; cx += jw[0]) cells.push({ x: cx + jr.range(0, jw[0]), y: cy + jr.range(0, jw[1]), gx: jr.jitter(0.12), gy: jr.jitter(0.1) - 0.04, o: jr.range(0, 0.05) });
  const aspect = jw[0] / jw[1];
  const joint = (x, y) => {
    let f1 = Infinity;
    let f2 = Infinity;
    let near = cells[0];
    for (const c of cells) {
      const d = Math.hypot(x - c.x, (y - c.y) * aspect);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        near = c;
      } else if (d < f2) f2 = d;
    }
    const inside = smoothstep(0, g.joints.groove, (f2 - f1) / 2);
    const tilt = Math.max(0, near.gx * (x - near.x) + near.gy * (y - near.y) + near.o);
    return g.joints.depth * (1 - inside) + tilt * inside;
  };
  const z = (x, y, detail = 0) => {
    const top = smoothstep(g.height - 0.9, g.height, y);
    // Broad bulges, vertical ribs (a ridged noise stretched up the face: jointed rock) and fine roughness.
    const ribs = 1 - Math.abs(panelN(x * 0.45 + 7, y * 0.1, 0.9)) * 2;
    const local = g.relief * (panelN(x * 0.22, y * 0.22, 0.5) + 0.55 * ribs + 0.3 * fineN(x * 0.9, y * 0.9, 0.3));
    const f = fade(x);
    return edge(y) + ledge(y) + f * local + top * 0.6 + (detail && g.joints && f > 0 ? detail * f * joint(x, y) : 0);
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
  // Colour noise read on a circle round the panel's width: both edges (x = ±w/2) land on the same point, so side by
  // side panels match, and nothing is mirrored.
  const R = g.width / (2 * Math.PI);
  const colour = rockColour(seed, look, g.height, { space: (p) => [R * Math.cos((p[0] / g.width) * 2 * Math.PI), p[1], R * Math.sin((p[0] / g.width) * 2 * Math.PI) + 0.5 * p[2]] });
  const detail = lod.detail ?? 0;
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
      const p = [x, y, z(x, y, detail)];
      // Normal from the field (so both edges of every panel agree exactly): the face looks toward -z.
      // At the two edges the panel's own detail has faded out with no slope (smoothstep), so only the shared
      // profile is left: no slope across, which makes both edges' normals the same exactly.
      const dx = i === 0 || i === nx ? 0 : (z(x + e, y, detail) - z(x - e, y, detail)) / (2 * e);
      const dy = (z(x, y + e, detail) - z(x, y - e, detail)) / (2 * e);
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
    const p = [x, yTop(x), z(x, yTop(x), detail)];
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
