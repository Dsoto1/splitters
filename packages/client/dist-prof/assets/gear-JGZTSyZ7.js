import { T as TransformNode, e as CreateBox, M as Matrix, V as Vector3, aB as PBRMaterial, a as Color3, h as Mesh, i as VertexData } from "./babylon-PnzH6wcM.js";
import { C as CreateCapsule } from "./capsuleBuilder-D5ktebP4.js";
import { C as CreateCylinder } from "./cylinderBuilder-B3IbC6dA.js";
import { C as CreateTorus } from "./torusBuilder-BTtpdox_.js";
import { aC as BEARD, n as gearInfo } from "./index-BAsW2uYW.js";
import { C as CreateSphere } from "./sphereBuilder.pure-CT5peVwp.js";
import "./vendor-BIr0ad6t.js";
const dirOf = (theta, phi) => [Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => scale(a, 1 / (len(a) || 1));
const v3 = { sub, add, scale, dot, cross, len, norm, lerp: (a, b, t) => add(a, scale(sub(b, a), t)) };
const TAU = Math.PI * 2;
const NT = 48;
const NP = 32;
const PMIN = -1.35;
const PMAX = Math.PI / 2;
const STEP_P = (PMAX - PMIN) / (NP - 1);
class HeadMap {
  r;
  c;
  constructor(c, points, r) {
    this.c = c;
    this.r = r ?? new Float32Array(NT * NP);
    if (points) {
      for (let i = 0; i + 2 < points.length; i += 3) {
        const d = [points[i] - c[0], points[i + 1] - c[1], points[i + 2] - c[2]];
        const l = len(d);
        if (l < 1e-6) continue;
        const phi = Math.asin(Math.max(-1, Math.min(1, d[1] / l)));
        if (phi < PMIN - STEP_P / 2) continue;
        const a = Math.round((Math.atan2(d[0], d[2]) / TAU + 1) % 1 * NT) % NT;
        const b = Math.round((phi - PMIN) / STEP_P);
        const k = b * NT + a;
        if (l > this.r[k]) this.r[k] = l;
      }
      this.fill();
    }
  }
  fill() {
    const r = this.r;
    for (let pass = 0; pass < NT + NP; pass++) {
      let empty = 0;
      const next = Float32Array.from(r);
      for (let b = 0; b < NP; b++)
        for (let a = 0; a < NT; a++) {
          if (r[b * NT + a] > 0) continue;
          let best = 0;
          for (let db = -1; db <= 1; db++) {
            const bb = b + db;
            if (bb < 0 || bb >= NP) continue;
            for (let da = -1; da <= 1; da++) best = Math.max(best, r[bb * NT + (a + da + NT) % NT]);
          }
          if (best > 0) next[b * NT + a] = best;
          else empty++;
        }
      r.set(next);
      if (!empty) return;
    }
  }
  /** Each direction no nearer than `other`'s, nor farther than `other`'s + `extra` (hair over the skin, kept close). */
  over(other, extra) {
    return new HeadMap(
      this.c,
      void 0,
      this.r.map((d, k) => Math.max(other.r[k], Math.min(d, other.r[k] + extra)))
    );
  }
  /** The map as cloth would lie over it: across the dips between bumps (each direction at least its neighbours' average), then smoothed. */
  draped(passes = 2) {
    let r = Float32Array.from(this.r);
    for (let p = 0; p < passes; p++) {
      const next = new Float32Array(r.length);
      for (let b = 0; b < NP; b++)
        for (let a = 0; a < NT; a++) {
          let sum = 0;
          let n = 0;
          for (let db = -1; db <= 1; db++) {
            const bb = Math.max(0, Math.min(NP - 1, b + db));
            for (let da = -1; da <= 1; da++) {
              sum += r[bb * NT + (a + da + NT) % NT];
              n++;
            }
          }
          next[b * NT + a] = Math.max(r[b * NT + a], sum / n);
        }
      r = next;
    }
    return new HeadMap(this.c, void 0, r);
  }
  /** The surface's distance in direction (θ, φ). */
  at(theta, phi) {
    const u = (theta / TAU % 1 + 1) % 1 * NT;
    const v = Math.max(0, Math.min(NP - 1, (phi - PMIN) / STEP_P));
    const a0 = Math.floor(u) % NT;
    const a1 = (a0 + 1) % NT;
    const b0 = Math.min(NP - 2, Math.floor(v));
    const fu = u - Math.floor(u);
    const fv = v - b0;
    const r = this.r;
    const lo = r[b0 * NT + a0] * (1 - fu) + r[b0 * NT + a1] * fu;
    const hi = r[(b0 + 1) * NT + a0] * (1 - fu) + r[(b0 + 1) * NT + a1] * fu;
    return lo * (1 - fv) + hi * fv;
  }
  /** The surface's distance along a direction from the centre. */
  along(d) {
    const l = len(d) || 1;
    return this.at(Math.atan2(d[0], d[2]), Math.asin(Math.max(-1, Math.min(1, d[1] / l))));
  }
  /** The point `pad` out from the surface in direction (θ, φ). */
  point(theta, phi, pad = 0) {
    return add(this.c, scale(dirOf(theta, phi), this.at(theta, phi) + pad));
  }
  /** The elevation at which the surface (padded) reaches height y, round at θ. */
  phiAt(theta, y, pad = 0) {
    let lo = PMIN;
    let hi = PMAX;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (this.point(theta, mid, pad)[1] < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  /** `p` pushed straight out from the centre until it is at least `pad` outside the surface. */
  clear(p, pad) {
    const d = sub(p, this.c);
    const want = this.along(d) + pad;
    const l = len(d);
    return l >= want ? p : add(this.c, scale(d, want / (l || 1)));
  }
}
const ringHeight = (front, side, back) => (theta) => {
  const c = Math.cos(theta);
  return side + (front - back) / 2 * c + ((front + back) / 2 - side) * c * c;
};
class Geo {
  positions = [];
  indices = [];
  vert(p) {
    this.positions.push(p[0], p[1], p[2]);
    return this.positions.length / 3 - 1;
  }
  /** Face normal as Babylon's ComputeNormals takes it: (p1 - p2) × (p3 - p2). */
  faceNormal(a, b, c) {
    const p = this.positions;
    const P = (i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
    return cross(sub(P(a), P(b)), sub(P(c), P(b)));
  }
  /**
   * A surface through rows of points (rows the same length; `closed`: each row wraps round). Its faces turn
   * towards `out` (a direction), or away from a point (`from`), as most of its area does; `flip` turns them the other way.
   */
  grid(rows, closed, out, flip = false) {
    const ids = rows.map((row) => row.map((p) => this.vert(p)));
    const quads = [];
    const cols = rows[0].length;
    for (let j = 0; j + 1 < rows.length; j++)
      for (let i = 0; i < (closed ? cols : cols - 1); i++) {
        const i1 = (i + 1) % cols;
        quads.push([ids[j][i], ids[j][i1], ids[j + 1][i1], ids[j + 1][i]]);
      }
    let vote = 0;
    for (const [a, b, c] of quads) {
      const n = this.faceNormal(a, b, c);
      const p = this.positions;
      const at = [p[b * 3], p[b * 3 + 1], p[b * 3 + 2]];
      vote += dot(n, "dir" in out ? out.dir : sub(at, out.from));
    }
    const turn = vote < 0 !== flip;
    for (const [a, b, c, d] of quads) {
      if (turn) this.indices.push(a, c, b, a, d, c);
      else this.indices.push(a, b, c, a, c, d);
    }
    return ids;
  }
  /**
   * A surface with thickness: the rows are its outer face (turned towards `out`), a copy `thick` inside it its
   * inner face, and strips close the edges between them.
   */
  slab(rows, closed, thick, out) {
    const nr = rows.length;
    const nc = rows[0].length;
    const at = (j, i) => rows[Math.max(0, Math.min(nr - 1, j))][closed ? (i + nc) % nc : Math.max(0, Math.min(nc - 1, i))];
    const normals = rows.map(
      (row, j) => row.map((p, i) => {
        const n = norm(cross(sub(at(j + 1, i), at(j - 1, i)), sub(at(j, i + 1), at(j, i - 1))));
        const ref = "dir" in out ? out.dir : sub(p, out.from);
        return dot(n, ref) < 0 ? scale(n, -1) : n;
      })
    );
    const inner = rows.map((row, j) => row.map((p, i) => sub(p, scale(normals[j][i], thick))));
    this.grid(rows, closed, out);
    this.grid(inner, closed, out, true);
    const strip = (a, b, away) => {
      const mid = a.map((p, k) => scale(add(p, b[k]), 0.5));
      const ids = [a, b].map((r) => r.map((p) => this.vert(p)));
      for (let k = 0; k + 1 < a.length; k++) {
        const o = sub(mid[k], away[k]);
        const q = [ids[0][k], ids[0][k + 1], ids[1][k + 1], ids[1][k]];
        const n = this.faceNormal(q[0], q[1], q[2]);
        if (dot(n, o) >= 0) this.indices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        else this.indices.push(q[0], q[2], q[1], q[0], q[3], q[2]);
      }
    };
    const wrap = (r) => closed ? [...r, r[0]] : r;
    strip(wrap(rows[0]), wrap(inner[0]), wrap(rows[1]));
    strip(wrap(rows[nr - 1]), wrap(inner[nr - 1]), wrap(rows[nr - 2]));
    if (!closed) {
      const col = (rs, i) => rs.map((r) => r[i]);
      strip(col(rows, 0), col(inner, 0), col(rows, 1));
      strip(col(rows, nc - 1), col(inner, nc - 1), col(rows, nc - 2));
    }
  }
  /** A round tube along a path, `radius` thick (`radii`: per point). */
  tube(path, radius, sides = 8) {
    const rings = [];
    let ref = [0, 1, 0];
    for (let k = 0; k < path.length; k++) {
      const t = norm(sub(path[Math.min(path.length - 1, k + 1)], path[Math.max(0, k - 1)]));
      if (Math.abs(dot(t, ref)) > 0.95) ref = [1, 0, 0];
      const u = norm(cross(t, ref));
      const w = cross(u, t);
      const r = typeof radius === "number" ? radius : radius[k];
      rings.push(Array.from({ length: sides }, (_, s) => {
        const a = s / sides * TAU;
        return add(path[k], add(scale(u, Math.cos(a) * r), scale(w, Math.sin(a) * r)));
      }));
    }
    const ids = rings.map((ring) => ring.map((p) => this.vert(p)));
    for (let k = 0; k + 1 < rings.length; k++)
      for (let s = 0; s < sides; s++) {
        const s1 = (s + 1) % sides;
        const q = [ids[k][s], ids[k][s1], ids[k + 1][s1], ids[k + 1][s]];
        const n = this.faceNormal(q[0], q[1], q[2]);
        const o = sub(rings[k][s], path[k]);
        if (dot(n, o) >= 0) this.indices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        else this.indices.push(q[0], q[2], q[1], q[0], q[3], q[2]);
      }
    for (const k of [0, rings.length - 1]) {
      const centre = this.vert(path[k]);
      const o = sub(path[k], path[k === 0 ? 1 : k - 1]);
      for (let s = 0; s < sides; s++) {
        const a = ids[k][s];
        const b = ids[k][(s + 1) % sides];
        if (dot(this.faceNormal(centre, a, b), o) >= 0) this.indices.push(centre, a, b);
        else this.indices.push(centre, b, a);
      }
    }
  }
  /** A flat fan from a centre to a closed ring of points, its face towards `out`. */
  fan(centre, ring, out) {
    const c = this.vert(centre);
    const ids = ring.map((p) => this.vert(p));
    for (let s = 0; s < ids.length; s++) {
      const a = ids[s];
      const b = ids[(s + 1) % ids.length];
      if (dot(this.faceNormal(c, a, b), out) >= 0) this.indices.push(c, a, b);
      else this.indices.push(c, b, a);
    }
  }
}
function outline(centre, ax, ay, half, n, steps = 24, shapeY) {
  return Array.from({ length: steps }, (_, s) => {
    const t = s / steps * TAU;
    const c = Math.cos(t);
    const si = Math.sin(t);
    const x = Math.sign(c) * Math.abs(c) ** (2 / n) * half[0];
    let y = Math.sign(si) * Math.abs(si) ** (2 / n) * half[1];
    if (shapeY) y = shapeY(x / half[0], y / half[1]) * half[1];
    return add(centre, add(scale(ax, x), scale(ay, y)));
  });
}
function fitModel(all, head, rimY, floorY, pad = 5e-3) {
  const c = head.c;
  const stride = Math.max(1, Math.ceil(all.length / 3 / 1200));
  const points = [];
  for (let i = 0; i + 2 < all.length; i += 3 * stride) points.push(all[i], all[i + 1], all[i + 2]);
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    maxY = Math.max(maxY, points[i + 1]);
    minZ = Math.min(minZ, points[i + 2]);
    maxZ = Math.max(maxZ, points[i + 2]);
  }
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const halfW = (maxX - minX) / 2;
  const headHalf = Math.max(head.at(Math.PI / 2, 0.2), head.at(-Math.PI / 2, 0.2)) * Math.cos(0.2);
  const headTop = head.point(0, Math.PI / 2)[1];
  const checked = new Uint8Array(NT * NP);
  for (let b = 0; b < NP; b++) for (let a = 0; a < NT; a++) checked[b * NT + a] = c[1] + Math.sin(PMIN + b * STEP_P) * head.r[b * NT + a] >= floorY ? 1 : 0;
  const n = points.length / 3;
  const world = new Float32Array(points.length);
  const place = (k2, sy, y, dz) => {
    for (let i = 0; i < n; i++) {
      world[i * 3] = c[0] + (points[i * 3] - midX) * k2;
      world[i * 3 + 1] = y + points[i * 3 + 1] * k2 * sy;
      world[i * 3 + 2] = c[2] + dz + (points[i * 3 + 2] - midZ) * k2;
    }
  };
  const r = new Float32Array(NT * NP);
  const clear = (k2, sy, y, dz) => {
    place(k2, sy, y, dz);
    r.fill(Infinity);
    for (let i = 0; i < n; i++) {
      const dx = world[i * 3] - c[0];
      const dy = world[i * 3 + 1] - c[1];
      const dzz = world[i * 3 + 2] - c[2];
      const l = Math.hypot(dx, dy, dzz);
      if (l < 1e-6) continue;
      const b = Math.round((Math.asin(Math.max(-1, Math.min(1, dy / l))) - PMIN) / STEP_P);
      if (b < 0) continue;
      const a = Math.round((Math.atan2(dx, dzz) / TAU + 1) % 1 * NT) % NT;
      const kk = b * NT + a;
      if (l < r[kk]) r[kk] = l;
    }
    for (let kk = 0; kk < r.length; kk++) if (checked[kk] && r[kk] < head.r[kk] + pad) return false;
    return true;
  };
  const rimOverEyes = () => {
    let y = Infinity;
    for (let i = 0; i < n; i++) {
      const ax = Math.abs(world[i * 3] - c[0]);
      if (world[i * 3 + 2] - c[2] > 0.03 && ax > 0.02 && ax < 0.045) y = Math.min(y, world[i * 3 + 1]);
    }
    return y;
  };
  let best = null;
  const k0 = headHalf / halfW;
  for (const sy of [1, 0.88, 0.76]) {
    if (best && best.score < 6e-3) break;
    for (const dz of [-8e-3, 0, 8e-3]) {
      for (let s = 1.05; s <= 1.8; s += 0.075) {
        const k2 = k0 * s;
        let lo = headTop - maxY * k2 * sy - 0.08;
        let hi = headTop - maxY * k2 * sy + 0.07;
        if (!clear(k2, sy, hi, dz)) continue;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (clear(k2, sy, mid, dz)) hi = mid;
          else lo = mid;
        }
        place(k2, sy, hi, dz);
        const rim = rimOverEyes();
        const score = Math.max(0, rim - rimY) * 4 + Math.max(0, rimY - rim) * 2 + (s - 1) * 0.01 + (1 - sy) * 0.04;
        if (!best || score < best.score) best = { k: k2, sy, at: [c[0] - midX * k2, hi, c[2] + dz - midZ * k2], score };
        if (rim < rimY) break;
      }
    }
  }
  if (best) return { k: best.k, sy: best.sy, at: best.at };
  const k = k0 * 1.4;
  return { k, sy: 1, at: [c[0] - midX * k, headTop - maxY * k + 0.03, c[2] - midZ * k] };
}
const seats = /* @__PURE__ */ new Map();
const DEFAULT_CLOTH = "#3e5230";
const DEFAULT_TRIM = "#5a3f2a";
const materials = /* @__PURE__ */ new WeakMap();
function material(scene, hex, finish = "cloth") {
  let cache = materials.get(scene);
  if (!cache) materials.set(scene, cache = /* @__PURE__ */ new Map());
  const key = `${hex}|${finish}`;
  let m = cache.get(key);
  if (!m) {
    m = new PBRMaterial(`gear_${key}`, scene);
    m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    m.metallic = finish === "metal" ? 0.7 : finish === "glass" ? 0.2 : 0;
    m.roughness = finish === "cloth" ? 0.9 : finish === "hard" ? 0.55 : finish === "glass" ? 0.12 : 0.35;
    cache.set(key, m);
  }
  return m;
}
function shade(hex, k) {
  const c = Color3.FromHexString(hex);
  const f = (v) => Math.max(0, Math.min(1, k >= 1 ? v + (1 - v) * (k - 1) : v * k));
  return new Color3(f(c.r), f(c.g), f(c.b)).toHexString();
}
function bounds(meshes, space) {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  let out = null;
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    for (const v of m.getBoundingInfo().boundingBox.vectorsWorld) {
      const p = Vector3.TransformCoordinates(v, inv);
      if (!out) out = { min: p.clone(), max: p.clone() };
      else {
        out.min.minimizeInPlace(p);
        out.max.maximizeInPlace(p);
      }
    }
  }
  return out;
}
function slice(meshes, space, y, band) {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  let out = null;
  const p = new Vector3();
  for (const m of meshes) {
    const pos = m.getVerticesData("position");
    if (!pos) continue;
    const toSpace = m.computeWorldMatrix(true).multiply(inv);
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], toSpace, p);
      if (Math.abs(p.y - y) > band) continue;
      if (!out) out = { min: p.clone(), max: p.clone() };
      else {
        out.min.minimizeInPlace(p);
        out.max.maximizeInPlace(p);
      }
    }
  }
  return out;
}
function surfacePoints(meshes, space) {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  const out = [];
  const p = new Vector3();
  for (const m of meshes) {
    const pos = m.getVerticesData("position");
    if (!pos) continue;
    const toSpace = m.computeWorldMatrix(true).multiply(inv);
    const local = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], toSpace, p);
      local.set([p.x, p.y, p.z], i);
      out.push(p.x, p.y, p.z);
    }
    const idx = m.getIndices();
    if (!idx) continue;
    const P = (i) => [local[i * 3], local[i * 3 + 1], local[i * 3 + 2]];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const [a, b, c] = [P(idx[t]), P(idx[t + 1]), P(idx[t + 2])];
      for (const q of [v3.lerp(a, b, 0.5), v3.lerp(b, c, 0.5), v3.lerp(c, a, 0.5), v3.scale(v3.add(v3.add(a, b), c), 1 / 3)]) out.push(...q);
    }
  }
  return Float32Array.from(out);
}
function within(points, test) {
  const out = [];
  for (let i = 0; i + 2 < points.length; i += 3) if (test(points[i], points[i + 1], points[i + 2])) out.push([points[i], points[i + 1], points[i + 2]]);
  return out;
}
function meshOf(name, scene, g) {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = g.positions;
  data.indices = g.indices;
  const normals = [];
  VertexData.ComputeNormals(g.positions, g.indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}
function trimHair(meshes, space, covered) {
  const inv = Matrix.Invert(space.computeWorldMatrix(true));
  const p = new Vector3();
  for (const m of meshes) {
    if (!(m instanceof Mesh)) continue;
    const pos = m.getVerticesData("position");
    const idx = m.getIndices();
    if (!pos || !idx) continue;
    const toSpace = m.computeWorldMatrix(true).multiply(inv);
    const nv = pos.length / 3;
    const inside = new Uint8Array(nv);
    const parent = Int32Array.from({ length: nv }, (_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    const join = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    const at = /* @__PURE__ */ new Map();
    for (let i = 0; i < nv; i++) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], toSpace, p);
      inside[i] = covered([p.x, p.y, p.z]) ? 1 : 0;
      const key = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
      const same = at.get(key);
      if (same === void 0) at.set(key, i);
      else join(i, same);
    }
    for (let t = 0; t + 2 < idx.length; t += 3) {
      join(idx[t], idx[t + 1]);
      join(idx[t], idx[t + 2]);
    }
    const size = /* @__PURE__ */ new Map();
    const under = /* @__PURE__ */ new Map();
    for (let i = 0; i < nv; i++) {
      const r = find(i);
      size.set(r, (size.get(r) ?? 0) + 1);
      if (inside[i]) under.set(r, (under.get(r) ?? 0) + 1);
    }
    const gone = /* @__PURE__ */ new Set();
    for (const [r, n] of size) if (n < nv * 0.3 && (under.get(r) ?? 0) > n * 0.4) gone.add(r);
    const kept = [];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      if (gone.has(find(a)) || inside[a] && inside[b] && inside[c]) continue;
      kept.push(a, b, c);
    }
    if (kept.length === idx.length) continue;
    m.makeGeometryUnique();
    m.setIndices(kept);
  }
}
function measureHead(t, headBox) {
  const skinMeshes = t.head.filter((m) => !/Hair/.test(m.material?.name ?? ""));
  const brows = t.head.filter((m) => /Hair/.test(m.material?.name ?? ""));
  const skinPts = surfacePoints(skinMeshes.length ? skinMeshes : t.head, t.root);
  const hairPts = surfacePoints(t.hair, t.root);
  const cx = (headBox.max.x + headBox.min.x) / 2;
  const eyeBox = bounds(t.eyes, t.root);
  const eyeY = eyeBox ? (eyeBox.min.y + eyeBox.max.y) / 2 : headBox.min.y + (headBox.max.y - headBox.min.y) * 0.62;
  const eyeHalf = eyeBox ? Math.max(0.02, (eyeBox.max.x - eyeBox.min.x) / 2 - 0.016) : 0.032;
  const eyeZ = eyeBox ? eyeBox.max.z - 0.01 : headBox.max.z - 0.03;
  const eyes = [[cx - eyeHalf, eyeY, eyeZ], [cx + eyeHalf, eyeY, eyeZ]];
  if (t.eyes.length) {
    const ep = surfacePoints(t.eyes, t.root);
    for (const s of [0, 1]) {
      const side = within(ep, (x) => s === 0 ? x < cx : x > cx);
      if (side.length) {
        const lo = side.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.min(a[2], p[2])], [Infinity, Infinity, Infinity]);
        const hi = side.reduce((a, p) => [Math.max(a[0], p[0]), Math.max(a[1], p[1]), Math.max(a[2], p[2])], [-Infinity, -Infinity, -Infinity]);
        eyes[s] = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, hi[2]];
      }
    }
  }
  const browBox = bounds(brows, t.root);
  const browTop = browBox ? browBox.max.y : eyeY + 0.026;
  const cy = eyeY + 0.03;
  const level = within(skinPts, (x, y) => Math.abs(y - cy) < 0.012 && Math.abs(x - cx) < 0.03);
  const cz = level.length ? (Math.max(...level.map((p) => p[2])) + Math.min(...level.map((p) => p[2]))) / 2 : (headBox.max.z + headBox.min.z) / 2;
  const c = [cx, cy, cz];
  const skin = new HeadMap(c, skinPts);
  const hat = (hairPts.length ? new HeadMap(c, hairPts).over(skin, 0.012) : skin).draped(2);
  const crown = hat.point(0, Math.PI / 2)[1];
  const half = Math.max(hat.at(Math.PI / 2, 0.25), hat.at(-Math.PI / 2, 0.25)) * Math.cos(0.25);
  const arm = t.joints.get("upperarm_r");
  let right = 1;
  if (arm) {
    const p = Vector3.TransformCoordinates(arm.getAbsolutePosition(), Matrix.Invert(t.root.computeWorldMatrix(true)));
    right = p.x < cx ? -1 : 1;
  }
  return { skin, hat, skinPts, cx, eyeY, eyes, browTop, crown, half, right };
}
function buildBeard(scene, f, hairColor, shape) {
  const c = f.skin.c;
  const chinPts = within(f.skinPts, (x, _y, z) => Math.abs(x - f.cx) < 0.025 && z > c[2] + 0.04);
  const chin = chinPts.length ? Math.min(...chinPts.map((p) => p[1])) : f.eyeY - 0.12;
  const span = f.eyeY - chin;
  const nose = f.eyeY - 0.4 * span;
  const mouth = f.eyeY - 0.6 * span;
  const lip = f.eyeY - 0.7 * span;
  const face = f.skin.draped(1);
  const hug = (th, y, pad) => face.point(th, face.phiAt(th, y, pad), pad);
  const rag = (k, a) => k % 2 ? a : -a * 0.4;
  const reach = 1.55;
  const n = 31;
  const thetas = Array.from({ length: n }, (_, i) => -reach + 2 * reach * i / (n - 1));
  const topAt = (th, k) => {
    const a = Math.abs(th) / reach;
    const top = a < 0.28 ? lip - 8e-3 : a < 0.85 ? mouth + 4e-3 + (a - 0.28) / 0.57 * (f.eyeY - 0.024 - mouth - 4e-3) : f.eyeY - 0.024 + (a - 0.85) / 0.15 * 0.028;
    return top + rag(k, 3e-3);
  };
  const rows = [];
  const m = 7;
  for (let j = 0; j <= m; j++) {
    const u = j / m;
    rows.push(
      thetas.map((th, k) => {
        const a = Math.abs(th) / reach;
        const top = topAt(th, k);
        const bottom = chin - 0.012 * (1 - a) ** 0.5 + a * a * 0.03 + (j === m ? rag(k, 6e-3) : 0);
        const y = top + (bottom - top) * u;
        const pad = 3e-3 + 9e-3 * u * (1 - a * 0.6);
        return hug(th, y, pad);
      })
    );
  }
  const g = new Geo();
  g.slab(rows, false, 25e-4, { from: c });
  const mr = 0.62;
  const mn = 15;
  const mt = Array.from({ length: mn }, (_, i) => -mr + 2 * mr * i / (mn - 1));
  const moustache = [0, 0.5, 1].map(
    (u) => mt.map((th, k) => {
      const a = Math.abs(th) / mr;
      const top = nose - 2e-3 - a * 4e-3;
      const bottom = mouth + 3e-3 - a * a * (mouth - lip + 4e-3) + rag(k, 2e-3) * u;
      return hug(th, top + (bottom - top) * u, 3e-3 + 4e-3 * Math.sin(u * Math.PI) + 2e-3 * u);
    })
  );
  g.slab(moustache, false, 2e-3, { from: c });
  shape("beard", g, material(scene, shade(hairColor, 1.06)));
}
function buildGear(scene, look, t) {
  const beard = look.hair.includes(BEARD);
  const gear = [...look.gear ?? [], ...beard ? [BEARD] : []];
  if (!gear.length) return [];
  const headBox = bounds(t.head, t.root);
  const headJoint = t.joints.get("Head");
  const chestJoint = t.joints.get("spine_03");
  if (!headBox || !headJoint || !chestJoint) return [];
  const torsoBox = bounds(t.torso, t.root);
  const cloth = look.cloth ?? DEFAULT_CLOTH;
  const trim = look.trim ?? DEFAULT_TRIM;
  const hasHeadGear = beard || gear.some((id) => ["hat", "face"].includes(gearInfo(id)?.slot ?? ""));
  const fit = hasHeadGear ? measureHead(t, headBox) : null;
  const made = [];
  const add2 = (m, parent, mat) => {
    m.material = mat;
    m.parent = t.root;
    m.isPickable = false;
    m.computeWorldMatrix(true);
    m.setParent(parent);
    made.push(m);
    return m;
  };
  const attachNode = (pivot, parent) => {
    pivot.parent = t.root;
    pivot.computeWorldMatrix(true);
    pivot.setParent(parent);
    for (const m of pivot.getChildMeshes()) {
      m.isPickable = false;
      made.push(m);
    }
  };
  const head = (m, mat) => add2(m, headJoint, mat);
  const chest = (m, mat) => add2(m, chestJoint, mat);
  const shape = (name, g, mat) => head(meshOf(name, scene, g), mat);
  const cover = (edge, poke = 0.03) => {
    const f = fit;
    trimHair(t.hairAll ?? t.hair, t.root, (p) => {
      const d = v3.sub(p, f.hat.c);
      const th = Math.atan2(d[0], d[2]);
      return p[1] > edge(th) + 3e-3 && v3.len(d) < f.hat.along(d) + poke;
    });
  };
  for (const id of gear) {
    const model = gearInfo(id)?.model;
    if (model) {
      const container = t.models?.get(model);
      if (!container || !fit) continue;
      const pivot = new TransformNode(`gear_${id}`, scene);
      pivot.parent = t.root;
      const inst = container.instantiateModelsToScene((n) => `${id}_${n}`, false, { doNotInstantiate: true });
      for (const n of inst.rootNodes) n.parent = pivot;
      const meshes = pivot.getChildMeshes().filter((m) => m.getTotalVertices() > 0);
      const key = `${model}|${look.head}|${look.hair.join(",")}`;
      let seat = seats.get(key);
      if (!seat) {
        seat = fitModel(surfacePoints(meshes, pivot), fit.hat, fit.browTop + 0.012, fit.eyeY + 0.012);
        seats.set(key, seat);
      }
      pivot.position.set(...seat.at);
      pivot.scaling.set(seat.k, seat.k * seat.sy, seat.k);
      pivot.computeWorldMatrix(true);
      for (const m of meshes) {
        m.computeWorldMatrix(true);
        m.setParent(headJoint);
        m.isPickable = false;
        made.push(m);
      }
      cover(ringHeight(fit.browTop + 0.012, fit.browTop + 0.012, fit.eyeY), 0.02);
      pivot.dispose();
      continue;
    }
    if (!fit && (id === BEARD || ["hat", "face"].includes(gearInfo(id)?.slot ?? ""))) continue;
    const f = fit;
    if (id === BEARD) {
      buildBeard(scene, f, look.hairColor ?? "#3a2a22", (name, g, mat) => shape(name, g, mat));
      continue;
    }
    const c = fit ? fit.hat.c : [0, 0, 0];
    const TH = 48;
    const around = (n, from = 0, to = Math.PI * 2) => Array.from({ length: n }, (_, i) => from + (to - from) * i / (n - (to - from >= Math.PI * 2 - 1e-6 ? 0 : 1)));
    const full = (n) => around(n);
    const crownRows = (thetas, edge, pad, rows = 12, upTo = Math.PI / 2) => Array.from({ length: rows + 1 }, (_, j) => {
      const u = j / rows;
      return thetas.map((th) => {
        const p0 = f.hat.phiAt(th, edge(th), pad(th, 0));
        const phi = p0 + (upTo - p0) * (1 - (1 - u) ** 1.4);
        return f.hat.point(th, phi, pad(th, u));
      });
    });
    const bandRows = (thetas, lo, hi, pad, rows = 2, map = f.hat) => Array.from(
      { length: rows + 1 },
      (_, j) => thetas.map((th) => {
        const pd = typeof pad === "number" ? pad : pad(th);
        const y = lo(th) + (hi(th) - lo(th)) * j / rows;
        return map.point(th, map.phiAt(th, y, pd), pd);
      })
    );
    switch (gearInfo(id)?.id) {
      case "cap": {
        const edge = ringHeight(f.browTop + 0.012, f.browTop + 0.014, f.eyeY + 6e-3);
        const pad = (th, u) => 2e-3 + 6e-3 * Math.max(0, Math.cos(th)) ** 2 * Math.sin(Math.min(1, u * 1.25) * Math.PI) ** 0.7;
        const thetas = full(TH);
        const rows = crownRows(thetas, edge, pad);
        const crown = new Geo();
        crown.slab(rows, true, 3e-3, { from: c });
        shape("capCrown", crown, material(scene, cloth));
        cover(edge, 0.07);
        const seams = new Geo();
        for (let k = 0; k < 6; k++) {
          const th = k / 6 * Math.PI * 2;
          const p0 = f.hat.phiAt(th, edge(th), pad(th, 0));
          seams.tube(
            Array.from({ length: 10 }, (_, j) => {
              const u = 0.04 + j / 9 * 0.93;
              return f.hat.point(th, p0 + (Math.PI / 2 - p0) * (1 - (1 - u) ** 1.4), pad(th, u) + 12e-4);
            }),
            13e-4,
            5
          );
        }
        const top = f.hat.point(0, Math.PI / 2, pad(0, 1));
        const button = CreateSphere("capButton", { diameter: 0.014, segments: 6 }, scene);
        button.scaling.y = 0.45;
        button.position.set(top[0], top[1] + 2e-3, top[2]);
        head(button, material(scene, shade(cloth, 0.7)));
        shape("capSeams", seams, material(scene, shade(cloth, 0.72)));
        const span = 0.95;
        const peakThetas = around(25, -span, span);
        const base = peakThetas.map((th) => f.hat.point(th, f.hat.phiAt(th, edge(th), 4e-3), 4e-3));
        const peak = [0, 0.5, 1].map(
          (s) => base.map((b, i) => {
            const u = peakThetas[i] / span;
            const outward = v3.norm([b[0] - c[0], 0, b[2] - c[2]]);
            const length = 0.07 * Math.sqrt(Math.max(0, 1 - u * u)) + 3e-3;
            return v3.add(b, [outward[0] * length * s, -(length * s * 0.22 + 0.016 * u * u * s * s), outward[2] * length * s]);
          })
        );
        const visor = new Geo();
        visor.slab(peak, false, 4e-3, { dir: [0, 1, 0] });
        shape("capPeak", visor, material(scene, shade(cloth, 0.85)));
        break;
      }
      case "beanie": {
        const edge = ringHeight(f.browTop + 4e-3, f.eyeY + 0.016, f.eyeY - 0.012);
        const rows = crownRows(full(TH), edge, (_th, u) => 6e-3 + 0.016 * u ** 2);
        const body = new Geo();
        body.slab(rows, true, 4e-3, { from: c });
        shape("beanie", body, material(scene, cloth));
        cover(edge);
        const thetas = full(144);
        const cuffRows = bandRows(thetas, edge, (th) => edge(th) + 0.034, (th) => 0.011 + 16e-4 * Math.cos(th * 36), 3);
        const cuff = new Geo();
        cuff.slab(cuffRows, true, 5e-3, { from: c });
        shape("beanieCuff", cuff, material(scene, shade(cloth, 0.86)));
        break;
      }
      case "beret": {
        const s = f.right;
        const bandLo = ringHeight(f.browTop + 4e-3, f.browTop + 2e-3, f.eyeY + 2e-3);
        const bandHi = (th) => bandLo(th) + 0.012;
        const thetas = full(64);
        const band = new Geo();
        band.slab(bandRows(thetas, bandLo, bandHi, 3e-3, 2), true, 3e-3, { from: c });
        shape("beretBand", band, material(scene, shade(trim, 0.7)));
        const D = [f.cx + s * 0.03, f.crown - 8e-3, c[2] - 4e-3];
        const rxDrape = f.half * 1.5;
        const rxHigh = f.half * 0.98;
        const rz = (f.hat.at(0, 0.3) + f.hat.at(Math.PI, 0.3)) * 0.5 * Math.cos(0.3) * 1.18;
        const N = v3.norm([-s * 0.25, 1, 0.08]);
        const T = v3.add(D, [s * 0.012, 0.02, 0]);
        const quad = (a, q, b, u) => v3.lerp(v3.lerp(a, q, u), v3.lerp(q, b, u), u);
        const rows = [];
        const lower = 7;
        const upper = 7;
        const prof = thetas.map((th) => {
          const p0 = f.hat.point(th, f.hat.phiAt(th, bandHi(th), 4e-3), 4e-3);
          const across = Math.sin(th) * s;
          const drape = Math.max(0, across);
          const rim = [D[0] + Math.sin(th) * (across > 0 ? rxDrape : rxHigh), D[1] - 0.06 * drape ** 1.6 - 8e-3 * Math.cos(th) ** 2 + 6e-3 * Math.max(0, -across), D[2] + Math.cos(th) * rz];
          const out = v3.norm([rim[0] - c[0], 0, rim[2] - c[2]]);
          const q1 = v3.add([rim[0], p0[1] + (rim[1] - p0[1]) * 0.35, rim[2]], v3.scale(out, 8e-3));
          const q2 = v3.add(v3.lerp(rim, T, 0.4), v3.scale(N, 0.014));
          return { p0, rim, q1, q2 };
        });
        for (let j = 0; j <= lower; j++) rows.push(prof.map((p) => quad(p.p0, p.q1, p.rim, j / lower)));
        for (let j = 1; j <= upper; j++) rows.push(prof.map((p) => quad(p.rim, p.q2, T, j / upper)));
        const cleared = rows.map((row) => row.map((p) => f.hat.clear(p, 4e-3)));
        const body = new Geo();
        body.slab(cleared, true, 4e-3, { from: c });
        shape("beret", body, material(scene, cloth));
        cover(bandLo, 0.06);
        const bth = -s * 0.42;
        const bp = f.hat.point(bth, f.hat.phiAt(bth, bandLo(bth) + 9e-3, 7e-3), 7e-3);
        const badge = CreateCylinder("beretBadge", { diameter: 0.018, height: 4e-3, tessellation: 12 }, scene);
        badge.rotation.set(Math.PI / 2, bth, 0);
        badge.position.set(bp[0], bp[1] + 4e-3, bp[2]);
        head(badge, material(scene, "#c9a54a", "metal"));
        break;
      }
      case "brim": {
        const edge = ringHeight(f.browTop + 0.01, f.browTop + 0.022, f.browTop + 4e-3);
        const thetas = full(64);
        const base = thetas.map((th) => f.hat.point(th, f.hat.phiAt(th, edge(th), 6e-3), 6e-3));
        const top = f.crown + 0.05;
        const mid = [c[0], 0, c[2]];
        const ring = (u, k) => base.map((b, i) => {
          const th = thetas[i];
          const h = top - 8e-3 * Math.cos(th);
          const p = [mid[0] + (b[0] - mid[0]) * k, b[1] + (h - b[1]) * u, mid[2] + (b[2] - mid[2]) * k];
          return p;
        });
        const rows = [];
        for (let j = 0; j <= 6; j++) rows.push(ring(j / 6, 1 - 0.12 * (j / 6) ** 1.5));
        for (const k of [0.8, 0.55, 0.3, 0.02]) {
          const r = ring(1, 0.88 * k);
          rows.push(r.map((p) => [p[0], p[1] + 6e-3 * (1 - k) - 0.016 * (1 - k ** 2) * Math.exp(-(((p[0] - c[0]) / 0.03) ** 2)), p[2]]));
        }
        const crown = new Geo();
        crown.slab(
          rows.map((row) => row.map((p) => f.hat.clear(p, 6e-3))),
          true,
          4e-3,
          { from: c }
        );
        const felt = material(scene, trim);
        shape("brimCrown", crown, felt);
        cover(edge, 0.05);
        const band = new Geo();
        band.slab([ring(0.03, 1.02), ring(0.3, 1 - 0.12 * 0.3 ** 1.5 + 0.02)], true, 3e-3, { from: c });
        shape("brimBand", band, material(scene, shade(cloth, 0.55)));
        const brim = [0, 0.5, 1].map(
          (u) => base.map((b, i) => {
            const th = thetas[i];
            const out = v3.norm([b[0] - c[0], 0, b[2] - c[2]]);
            const w = (0.068 + 0.014 * Math.cos(th) ** 2) * u + 2e-3;
            const lift = (0.024 * Math.sin(th) ** 2 - 8e-3 * Math.cos(th) ** 2) * u * u;
            return v3.add(b, [out[0] * w, lift - 2e-3, out[2] * w]);
          })
        );
        const brimGeo = new Geo();
        brimGeo.slab(brim, true, 5e-3, { dir: [0, 1, 0] });
        shape("brimDisc", brimGeo, felt);
        break;
      }
      case "headband": {
        const lo = ringHeight(f.browTop + 9e-3, f.browTop + 0.012, f.browTop + 4e-3);
        const hi = (th) => lo(th) + 0.024;
        const g = new Geo();
        g.slab(bandRows(full(64), lo, hi, 25e-4, 2), true, 25e-4, { from: c });
        const knot = f.hat.point(Math.PI, f.hat.phiAt(Math.PI, lo(Math.PI) + 0.012, 8e-3), 8e-3);
        for (const side of [-1, 1]) {
          const tail = [0, 0.33, 0.66, 1].map((u) => [knot[0] + side * (6e-3 + 0.02 * u), knot[1] - 0.075 * u, knot[2] - 0.012 - 0.02 * u * (1 - u * 0.5)]);
          g.slab(
            [tail.map((p) => [p[0] - 9e-3, p[1], p[2]]), tail.map((p) => [p[0] + 9e-3, p[1], p[2]])],
            false,
            3e-3,
            { dir: [0, 0, -1] }
          );
        }
        shape("headband", g, material(scene, cloth));
        const k = CreateSphere("headbandKnot", { diameter: 0.022, segments: 6 }, scene);
        k.scaling.set(1, 0.8, 0.7);
        k.position.set(knot[0], knot[1], knot[2]);
        head(k, material(scene, shade(cloth, 0.9)));
        break;
      }
      case "shades":
      case "goggles": {
        const goggles = id === "goggles";
        const lensMat = material(scene, goggles ? "#c8a050" : "#14161a", "glass");
        const frameMat = material(scene, goggles ? "#2a2a2a" : "#0e0f12", "hard");
        const half = goggles ? [0.025, 0.019] : [0.022, 0.0155];
        const lenses = new Geo();
        const frames = new Geo();
        const hinges = [];
        const inner = [];
        const ys = f.eyeY + (goggles ? 3e-3 : 2e-3);
        for (const [i, e] of f.eyes.entries()) {
          const side = i === 0 ? -1 : 1;
          const wrap = 0.18 * side;
          const ax = [Math.cos(wrap), 0, -Math.sin(wrap)];
          const tiltX = 0.12;
          const ay = [0, Math.cos(tiltX), Math.sin(tiltX)];
          const nrm = v3.norm(v3.cross(ay, ax));
          const fwd = nrm[2] < 0 ? v3.scale(nrm, -1) : nrm;
          const under = within(f.skinPts, (x, y) => Math.abs(x - e[0]) < half[0] + 4e-3 && Math.abs(y - ys) < half[1] + 3e-3);
          const faceZ = under.length ? Math.max(...under.map((p) => p[2] - (p[0] - e[0]) * Math.tan(-wrap))) : e[2] + 0.01;
          const centre = [e[0], ys, faceZ + (goggles ? 0.012 : 6e-3)];
          const shapeY = goggles ? void 0 : (x, y) => y < 0 ? y * (1 - 0.25 * Math.max(0, -x * side)) : y;
          const ring = outline(centre, ax, ay, half, goggles ? 2.6 : 3.2, 28, shapeY);
          lenses.fan(centre, ring, fwd);
          frames.tube([...ring, ring[0], ring[1]], goggles ? 35e-4 : 22e-4, 6);
          if (goggles) {
            const back = ring.map((p) => {
              const near = within(f.skinPts, (x, y) => Math.abs(x - p[0]) < 6e-3 && Math.abs(y - p[1]) < 6e-3);
              const z = near.length ? Math.max(...near.map((q) => q[2])) + 2e-3 : p[2] - 0.01;
              return [p[0], p[1], Math.min(p[2] - 2e-3, z)];
            });
            frames.slab([[...ring, ring[0]], [...back, back[0]]], false, 2e-3, { from: centre });
          }
          hinges.push(v3.add(centre, v3.add(v3.scale(ax, side * half[0]), v3.scale(ay, half[1] * 0.45))));
          inner.push(v3.add(centre, v3.add(v3.scale(ax, -side * half[0]), v3.scale(ay, half[1] * 0.25))));
        }
        const nose = within(f.skinPts, (x, y) => Math.abs(x - f.cx) < 7e-3 && Math.abs(y - (ys + 2e-3)) < 6e-3);
        const noseZ = nose.length ? Math.max(...nose.map((p) => p[2])) + 3e-3 : (inner[0][2] + inner[1][2]) / 2;
        const bridgeMid = [f.cx, ys + 4e-3, Math.min(noseZ, (inner[0][2] + inner[1][2]) / 2)];
        frames.tube([inner[0], v3.lerp(inner[0], bridgeMid, 0.5), bridgeMid, v3.lerp(inner[1], bridgeMid, 0.5), inner[1]], goggles ? 4e-3 : 24e-4, 6);
        if (goggles) {
          const lo = ringHeight(ys - 9e-3, ys - 7e-3, ys + 8e-3);
          const hi = (th) => lo(th) + 0.018;
          const strap = new Geo();
          const th0 = Math.atan2(hinges[1][0] - c[0], hinges[1][2] - c[2]);
          strap.slab(bandRows(around(40, th0, Math.PI * 2 - th0), lo, hi, 2e-3, 1), false, 25e-4, { from: c });
          shape("gogglesStrap", strap, material(scene, "#3a3028"));
        } else {
          for (const [i, hinge] of hinges.entries()) {
            const side = i === 0 ? -1 : 1;
            const y = hinge[1];
            const sideAt = (z) => {
              const near = within(f.skinPts, (x, py, pz) => (x - f.cx) * side > 0 && Math.abs(py - y) < 8e-3 && Math.abs(pz - z) < 6e-3);
              return near.length ? Math.max(...near.map((p) => (p[0] - f.cx) * side)) : f.half;
            };
            let earZ = c[2];
            let earX = 0;
            for (let z = hinge[2] - 0.02; z > c[2] - 0.06; z -= 4e-3) {
              const w = sideAt(z);
              if (w > earX) {
                earX = w;
                earZ = z;
              }
            }
            const path = [hinge];
            const z0 = hinge[2] - 6e-3;
            for (let k = 0; k <= 6; k++) {
              const z = z0 + (earZ - 0.01 - z0) * k / 6;
              const w = Math.max(sideAt(z), Math.abs(hinge[0] - f.cx) - 4e-3 * k);
              path.push([f.cx + side * (w + 35e-4), y + 15e-4 * k, z]);
            }
            const last = path[path.length - 1];
            path.push([last[0] - side * 4e-3, last[1] - 0.012, last[2] - 0.014]);
            path.push([last[0] - side * 7e-3, last[1] - 0.026, last[2] - 0.016]);
            frames.tube(path, 22e-4, 5);
          }
        }
        shape(goggles ? "gogglesLens" : "shadesLens", lenses, lensMat);
        shape(goggles ? "gogglesFrame" : "shadesFrame", frames, frameMat);
        break;
      }
      case "mask": {
        const top = f.eyeY - 0.022;
        const chinPts = within(f.skinPts, (x, _y, z) => Math.abs(x - f.cx) < 0.03 && z > c[2] + 0.04);
        const chin = chinPts.length ? Math.min(...chinPts.map((p) => p[1])) : top - 0.08;
        const span = 1.9;
        const thetas = around(33, -span, span);
        const face = f.skin.over(f.hat, 0).draped(1);
        const hug = (th, y, pad) => face.point(th, face.phiAt(th, y, pad), pad);
        const rows = [];
        const n = 6;
        for (let j = 0; j <= n; j++) rows.push(thetas.map((th) => hug(th, top - (top - chin - 6e-3) * j / n, 6e-3 + 4e-3 * (j / n))));
        const chinRow = rows[n];
        for (const u of [0.5, 1])
          rows.push(
            chinRow.map((p, i) => {
              const th = thetas[i];
              const drop = (0.012 + 0.05 * Math.max(0, Math.cos(th)) ** 3) * u;
              const out = v3.norm([p[0] - c[0], 0, p[2] - c[2]]);
              return [p[0] + out[0] * 6e-3 * u, p[1] - drop, p[2] + out[2] * 6e-3 * u];
            })
          );
        const g = new Geo();
        g.slab(rows, false, 3e-3, { from: c });
        const lo = ringHeight(top - 0.02, top - 0.02, top - 4e-3);
        g.slab(bandRows(around(20, span - 0.05, Math.PI * 2 - span + 0.05), lo, (th) => lo(th) + 0.016, 3e-3, 1), false, 3e-3, { from: c });
        shape("mask", g, material(scene, cloth));
        const kp = f.hat.point(Math.PI, f.hat.phiAt(Math.PI, lo(Math.PI) + 8e-3, 0.01), 0.01);
        const knot = CreateSphere("maskKnot", { diameter: 0.026, segments: 6 }, scene);
        knot.scaling.set(1, 0.8, 0.7);
        knot.position.set(kp[0], kp[1], kp[2]);
        head(knot, material(scene, cloth));
        break;
      }
      case "vest":
      case "bandolier":
      case "scarf":
      case "pack":
      case "radio":
      case "tank": {
        if (!torsoBox) break;
        const rootY = t.root.getAbsolutePosition().y;
        const chestY = chestJoint.getAbsolutePosition().y - rootY + 0.06;
        const sec = slice(t.torso, t.root, chestY, 0.03) ?? torsoBox;
        const waist = slice(t.torso, t.root, chestY - 0.2, 0.03) ?? sec;
        const w = Math.min((sec.max.x - sec.min.x) / 2, (waist.max.x - waist.min.x) / 2 + 0.02, 0.19);
        const zF = sec.max.z;
        const zB = sec.min.z;
        const zc = (zF + zB) / 2;
        const depth = zF - zB;
        const xc = (sec.max.x + sec.min.x) / 2;
        if (id === "vest") {
          const vest = material(scene, shade(cloth, 0.8), "hard");
          const h = 0.3;
          const body = CreateCylinder("vest", { diameter: 1, height: h, tessellation: 14 }, scene);
          body.scaling.set(w * 2 * 1.08, 1, depth * 1.12);
          body.position.set(xc, chestY - 0.05, zc);
          chest(body, vest);
          const plate = CreateBox("vestPlate", { width: w * 1.15, height: h * 0.72, depth: 0.025 }, scene);
          plate.position.set(xc, chestY - 0.03, zF + depth * 0.06 + 8e-3);
          chest(plate, material(scene, shade(cloth, 0.6), "hard"));
          for (const x of [-1, 0, 1]) {
            const pouch = CreateBox("pouch", { width: w * 0.36, height: 0.075, depth: 0.035 }, scene);
            pouch.position.set(xc + x * w * 0.4, chestY - 0.15, zF + depth * 0.06 + 0.02);
            chest(pouch, material(scene, trim));
          }
        } else if (id === "bandolier") {
          const tilt = 0.62;
          const rx = w * 1.16 / Math.cos(tilt);
          const rz = depth / 2 * 1.22;
          const pivot = new TransformNode("bandolier", scene);
          pivot.position.set(xc, chestY - 0.08, zc);
          pivot.rotation.z = tilt;
          const belt = CreateTorus("bandolierBelt", { diameter: 2, thickness: 0.03, tessellation: 32 }, scene);
          belt.scaling.set(rx, 1, rz);
          belt.parent = pivot;
          belt.material = material(scene, trim);
          for (let i = 0; i < 7; i++) {
            const a = Math.PI / 2 + (i - 3) * 0.16;
            const shell = CreateCylinder("shell", { diameter: 0.016, height: 0.042, tessellation: 6 }, scene);
            shell.position.set(Math.cos(a) * rx, 0, Math.sin(a) * rz + 0.012);
            shell.parent = pivot;
            shell.material = material(scene, "#b08a3a", "metal");
          }
          attachNode(pivot, chestJoint);
        } else if (id === "scarf") {
          const neck = slice(t.head, t.root, headBox.min.y + 0.03, 0.03) ?? headBox;
          const nw = (neck.max.x - neck.min.x) / 2;
          const nd = (neck.max.z - neck.min.z) / 2;
          const neckY = headBox.min.y + 0.02;
          const wrap = CreateTorus("scarf", { diameter: 2, thickness: 0.07, tessellation: 20 }, scene);
          wrap.scaling.set(nw + 0.045, 1, nd + 0.045);
          wrap.position.set((neck.max.x + neck.min.x) / 2, neckY, (neck.max.z + neck.min.z) / 2);
          chest(wrap, material(scene, cloth));
          const tail = CreateBox("scarfTail", { width: 0.075, height: 0.24, depth: 0.022 }, scene);
          tail.position.set(xc + w * 0.35, neckY - 0.15, zF + 0.012);
          tail.rotation.set(-0.12, 0, 0.08);
          chest(tail, material(scene, cloth));
        } else {
          const back = Math.min(zB, waist.min.z);
          if (id === "pack") {
            const bag = CreateCapsule("pack", { radius: 0.075, height: 0.34, tessellation: 12, subdivisions: 1 }, scene);
            bag.scaling.set(1.55, 1, 0.9);
            bag.position.set(xc, chestY - 0.1, back - 0.06);
            chest(bag, material(scene, cloth));
            const flap = CreateBox("packFlap", { width: 0.2, height: 0.12, depth: 0.025 }, scene);
            flap.position.set(xc, chestY - 0.02, back - 0.125);
            chest(flap, material(scene, trim));
            const roll = CreateCylinder("packRoll", { diameter: 0.075, height: 0.28, tessellation: 12 }, scene);
            roll.rotation.z = Math.PI / 2;
            roll.position.set(xc, chestY + 0.1, back - 0.055);
            chest(roll, material(scene, shade(cloth, 1.35)));
            for (const x of [-1, 1]) {
              const strap = CreateBox("packStrap", { width: 0.035, height: 0.3, depth: 0.012 }, scene);
              strap.position.set(xc + x * w * 0.5, chestY - 0.04, zF + 6e-3);
              chest(strap, material(scene, trim));
            }
          } else if (id === "radio") {
            const box = CreateBox("radio", { width: 0.22, height: 0.28, depth: 0.1 }, scene);
            box.position.set(xc, chestY - 0.08, back - 0.05);
            chest(box, material(scene, shade(cloth, 0.7), "hard"));
            const dial = CreateCylinder("radioDial", { diameter: 0.04, height: 0.02, tessellation: 10 }, scene);
            dial.position.set(xc - 0.06, chestY + 0.065, back - 0.05);
            chest(dial, material(scene, "#1a1a1a", "hard"));
            const aerial = CreateCylinder("radioAerial", { diameter: 8e-3, height: 0.46, tessellation: 6 }, scene);
            aerial.position.set(xc + 0.07, chestY + 0.28, back - 0.045);
            aerial.rotation.z = -0.08;
            chest(aerial, material(scene, "#202020", "metal"));
            for (const x of [-1, 1]) {
              const strap = CreateBox("radioStrap", { width: 0.035, height: 0.3, depth: 0.012 }, scene);
              strap.position.set(xc + x * w * 0.5, chestY - 0.04, zF + 6e-3);
              chest(strap, material(scene, "#2a2622"));
            }
          } else {
            const steel = material(scene, shade(trim, 1.25), "metal");
            for (const x of [-1, 1]) {
              const tank = CreateCapsule("tank", { radius: 0.05, height: 0.4, tessellation: 12, subdivisions: 1 }, scene);
              tank.position.set(xc + x * 0.058, chestY - 0.08, back - 0.05);
              chest(tank, steel);
            }
            const band = CreateBox("tankBand", { width: 0.24, height: 0.03, depth: 0.11 }, scene);
            band.position.set(xc, chestY - 0.02, back - 0.05);
            chest(band, material(scene, "#2a2622"));
          }
        }
        break;
      }
    }
  }
  return made;
}
export {
  buildGear
};
