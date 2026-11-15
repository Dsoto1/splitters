import { c as StandardMaterial, a as Color3, h as Mesh, i as VertexData, bL as RawTexture2DArray, ap as Constants, G as Texture, bB as RawTexture, bt as MaterialPluginBase, j as VertexBuffer, V as Vector3 } from "./babylon-PnzH6wcM.js";
import { aD as versioned, Z as vertexY, _ as TERRAIN_MATERIALS, aJ as TERRAIN_SURFACES } from "./index-BAsW2uYW.js";
import "./materialPluginBase-Dhlt5oKE.js";
import { B as coreMaterials, D as coreThemes, G as boxQuat, H as quatRotate, g as getProp, I as hungPropLift, J as isEnvModel, K as propTilts, L as buildMapDecor, m as mapGroundBores, M as cutGroundPolygon, N as yawXZ } from "./settle-BDJE4VMF.js";
const FALLBACK_THEME = "core.prototype";
function resolveSurface(doc, tile, slot, materials = coreMaterials, themes = coreThemes) {
  if (slot === "roof" && !tile?.surfaces?.roof) return resolveSurface(doc, tile, "floor", materials, themes);
  if (slot === "roof") {
    const own = tile.surfaces.roof;
    return { material: materials.get(own.material) ?? resolveSurface(doc, tile, "floor", materials, themes).material, tint: own.tint ?? null };
  }
  const theme = themes.get(doc.classicStructure.theme) ?? themes.get(FALLBACK_THEME);
  const override = tile?.surfaces?.[slot];
  const chosen = override ?? theme.slots[slot];
  const material = materials.get(chosen.material) ?? materials.get(theme.slots[slot].material);
  return { material, tint: chosen.tint ?? null };
}
function faceSlot(box, normal) {
  if (box.kind === "trim") return box.paint ?? "trim";
  if (box.kind === "prop") return "solids";
  if (box.kind === "barrier") return "walls";
  if (box.kind === "wall") return "walls";
  if (box.kind === "solid") return "solids";
  return normal[1] > 0.5 ? box.roof ? "roof" : "floor" : "underside";
}
const styleKey = (s) => `${s.material.id}|${s.tint ?? "-"}`;
const EPS = 1e-4;
const SEAM = 5e-4;
const SLIVER = 1e-3;
const QUARTER = Math.PI / 2;
const isDrawnBox = (b) => b.kind !== "prop" && b.kind !== "barrier";
const TOP_RANK = { floor: 4, solid: 3, wall: 2, trim: 1, prop: 0, barrier: 0 };
const SIDE_RANK = { trim: 4, solid: 3, wall: 2, floor: 1, prop: 0, barrier: 0 };
function outranks(boxes, b, a, top) {
  const rank = top ? TOP_RANK : SIDE_RANK;
  const rb = rank[boxes[b].kind];
  const ra = rank[boxes[a].kind];
  if (rb !== ra) return rb > ra;
  const sb = boxes[b].surface ? 1 : 0;
  const sa = boxes[a].surface ? 1 : 0;
  if (sb !== sa) return sb > sa;
  return b > a;
}
function axisFaces(min, max) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  return [
    [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
    [[[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]],
    [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]],
    [[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]],
    [[[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]],
    [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]]
  ];
}
const conj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const rot = (q, p) => quatRotate(q, p[0], p[1], p[2]);
const centre = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const isIdentity = (q) => q.x === 0 && q.y === 0 && q.z === 0;
function frameGroups(boxes, drawn) {
  const groups = /* @__PURE__ */ new Map();
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!drawn(b)) continue;
    let key;
    let q;
    let swap = false;
    if (b.pitch || b.roll) {
      key = `t${Math.round((b.yaw ?? 0) * 1e6)},${Math.round(b.pitch * 1e6 || 0)},${Math.round(b.roll * 1e6 || 0)}`;
      q = boxQuat(b.yaw, b.pitch, b.roll);
    } else {
      const yaw = b.yaw ?? 0;
      let t = (yaw % QUARTER + QUARTER) % QUARTER;
      if (t < 1e-7 || QUARTER - t < 1e-7) t = 0;
      const k = (Math.round((yaw - t) / QUARTER) % 4 + 4) % 4;
      swap = k % 2 === 1;
      key = `y${Math.round(t * 1e6)}`;
      q = boxQuat(t);
    }
    let g = groups.get(key);
    if (!g) groups.set(key, g = { q, members: [] });
    const c = centre(b);
    const fc = isIdentity(g.q) ? c : rot(conj(g.q), c);
    const h = [(b.max[0] - b.min[0]) / 2, (b.max[1] - b.min[1]) / 2, (b.max[2] - b.min[2]) / 2];
    if (swap) [h[0], h[2]] = [h[2], h[0]];
    const exact = !b.yaw && !b.pitch && !b.roll;
    g.members.push({ i, min: exact ? [...b.min] : [fc[0] - h[0], fc[1] - h[1], fc[2] - h[2]], max: exact ? [...b.max] : [fc[0] + h[0], fc[1] + h[1], fc[2] + h[2]] });
  }
  return [...groups.values()];
}
class Grid {
  constructor(members) {
    this.members = members;
    this.seen = new Int32Array(members.length);
    members.forEach((m, j) => {
      const [x0, x1, z0, z1] = this.range(m.min, m.max);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 1024) this.big.push(j);
      else for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.bucket(x, z).push(j);
    });
  }
  members;
  cells = /* @__PURE__ */ new Map();
  big = [];
  seen;
  stamp = 0;
  static SIZE = 8;
  range(min, max) {
    const s = Grid.SIZE;
    return [Math.floor((min[0] - EPS) / s), Math.floor((max[0] + EPS) / s), Math.floor((min[2] - EPS) / s), Math.floor((max[2] + EPS) / s)];
  }
  bucket(x, z) {
    const key = (x + 32768) * 65536 + (z + 32768);
    let list = this.cells.get(key);
    if (!list) this.cells.set(key, list = []);
    return list;
  }
  /** Members whose x/z extent touches the given box's (each once). */
  near(min, max, visit) {
    this.stamp++;
    const [x0, x1, z0, z1] = this.range(min, max);
    const go = (j) => {
      if (this.seen[j] === this.stamp) return;
      this.seen[j] = this.stamp;
      visit(j);
    };
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096) {
      for (let j = 0; j < this.members.length; j++) go(j);
      return;
    }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const j of this.cells.get((x + 32768) * 65536 + (z + 32768)) ?? []) go(j);
    for (const j of this.big) go(j);
  }
}
function subtract(rects, cut) {
  const out = [];
  for (const r of rects) {
    if (cut[0] >= r[2] - EPS || cut[2] <= r[0] + EPS || cut[1] >= r[3] - EPS || cut[3] <= r[1] + EPS) {
      out.push(r);
      continue;
    }
    const v0 = cut[1] - r[1] > EPS ? cut[1] : r[1];
    const v1 = r[3] - cut[3] > EPS ? cut[3] : r[3];
    if (v0 > r[1]) out.push([r[0], r[1], r[2], v0]);
    if (v1 < r[3]) out.push([r[0], v1, r[2], r[3]]);
    if (cut[0] - r[0] > EPS) out.push([r[0], v0, cut[0], v1]);
    if (r[2] - cut[2] > EPS) out.push([cut[2], v0, r[2], v1]);
  }
  return out;
}
function merge(rects) {
  if (rects.length < 2) return rects;
  const same = (a, b) => Math.abs(a - b) <= EPS;
  let joined = true;
  while (joined) {
    joined = false;
    for (let a = 0; a < rects.length && !joined; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        const p = rects[a];
        const q = rects[b];
        let r = null;
        if (same(p[1], q[1]) && same(p[3], q[3]) && (same(p[2], q[0]) || same(q[2], p[0]))) r = [Math.min(p[0], q[0]), p[1], Math.max(p[2], q[2]), p[3]];
        else if (same(p[0], q[0]) && same(p[2], q[2]) && (same(p[3], q[1]) || same(q[3], p[1]))) r = [p[0], Math.min(p[1], q[1]), p[2], Math.max(p[3], q[3])];
        if (r) {
          rects[a] = r;
          rects.splice(b, 1);
          joined = true;
          break;
        }
      }
    }
  }
  return rects;
}
const PLANE_AXES = { 0: [1, 2], 1: [0, 2], 2: [0, 1] };
const solid = (m) => m.max[0] - m.min[0] > EPS && m.max[1] - m.min[1] > EPS && m.max[2] - m.min[2] > EPS;
function containedIn(g, grid) {
  const out = /* @__PURE__ */ new Set();
  const inside = (p, q) => p.min.every((v, k) => v >= q.min[k] - EPS) && p.max.every((v, k) => v <= q.max[k] + EPS);
  g.members.forEach((m, a) => {
    grid.near(m.min, m.max, (b) => {
      if (b <= a) return;
      const o = g.members[b];
      if (inside(o, m) && !out.has(a)) out.add(b);
      else if (inside(m, o) && !out.has(b)) out.add(a);
    });
  });
  return out;
}
function clipGroup(boxes, g, draw) {
  const grid = new Grid(g.members);
  const gone = containedIn(g, grid);
  const out = [];
  g.members.forEach((m, a) => {
    if (gone.has(a) || !draw(m.i)) return;
    for (let face = 0; face < 6; face++) {
      const axis = face >> 1;
      const up = face & 1 ? -1 : 1;
      const plane = up > 0 ? m.max[axis] : m.min[axis];
      const [ua, va] = PLANE_AXES[axis];
      const rect = [m.min[ua], m.min[va], m.max[ua], m.max[va]];
      if (rect[2] - rect[0] <= EPS || rect[3] - rect[1] <= EPS) continue;
      let rects = [rect];
      const lo = [m.min[0], m.min[1], m.min[2]];
      const hi = [m.max[0], m.max[1], m.max[2]];
      lo[axis] = hi[axis] = plane;
      grid.near(lo, hi, (b) => {
        if (b === a || gone.has(b) || !rects.length) return;
        const o = g.members[b];
        if (!solid(o)) return;
        const lo2 = o.min[axis];
        const hi2 = o.max[axis];
        if (plane < lo2 - EPS || plane > hi2 + EPS) return;
        const cut = [Math.max(rect[0], o.min[ua]), Math.max(rect[1], o.min[va]), Math.min(rect[2], o.max[ua]), Math.min(rect[3], o.max[va])];
        if (cut[2] - cut[0] <= EPS || cut[3] - cut[1] <= EPS) return;
        const inside = plane > lo2 + EPS && plane < hi2 - EPS;
        const same = Math.abs(plane - (up > 0 ? hi2 : lo2)) <= EPS;
        if (!(inside || !same || outranks(boxes, o.i, m.i, face === 2))) return;
        if (cut[0] > rect[0] + EPS) cut[0] += SEAM;
        if (cut[1] > rect[1] + EPS) cut[1] += SEAM;
        if (cut[2] < rect[2] - EPS) cut[2] -= SEAM;
        if (cut[3] < rect[3] - EPS) cut[3] -= SEAM;
        if (cut[2] - cut[0] > EPS && cut[3] - cut[1] > EPS) rects = subtract(rects, cut);
      });
      for (const r of merge(rects)) out.push({ m: a, face, plane, rect: r });
    }
  });
  return out;
}
function fragmentBox(m, f) {
  const axis = f.face >> 1;
  const [ua, va] = PLANE_AXES[axis];
  const min = [...m.min];
  const max = [...m.max];
  min[ua] = f.rect[0];
  min[va] = f.rect[1];
  max[ua] = f.rect[2];
  max[va] = f.rect[3];
  return { min, max };
}
const dot$1 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function planeOf(n, p) {
  const d = dot$1(n, p);
  if (Math.abs(n[1]) > 1 - 1e-9) return { n, d, u: [1, 0, 0], v: [0, 0, 1] };
  const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u0 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  const l = Math.hypot(...u0);
  const u = [u0[0] / l, u0[1] / l, u0[2] / l];
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return { n, d, u, v };
}
const to2 = (pl, p) => [dot$1(pl.u, p), dot$1(pl.v, p)];
function to3(pl, q) {
  if (pl.u[0] === 1 && pl.v[2] === 1) return [q[0], pl.d * pl.n[1], q[1]];
  return [0, 1, 2].map((k) => pl.n[k] * pl.d + pl.u[k] * q[0] + pl.v[k] * q[1]);
}
const area2 = (p) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};
function halfPlane(poly, a, b, side) {
  const out = [];
  const f = (p) => side * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = f(p);
    const fq = f(q);
    if (fp >= -1e-12) out.push(p);
    if (fp > 1e-12 && fq < -1e-12 || fp < -1e-12 && fq > 1e-12) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
const ccw = (p) => area2(p) < 0 ? [...p].reverse() : p;
function intersect(a, b) {
  const c = ccw([...b]);
  let out = [...a];
  for (let i = 0; i < c.length && out.length >= 3; i++) out = halfPlane(out, c[i], c[(i + 1) % c.length], 1);
  return out;
}
function subtractConvex(a, b) {
  const c = ccw([...b]);
  const pieces = [];
  let rest = [...a];
  for (let i = 0; i < c.length && rest.length >= 3; i++) {
    const out = halfPlane(rest, c[i], c[(i + 1) % c.length], -1);
    if (out.length >= 3 && Math.abs(area2(out)) > 1e-9) pieces.push(out);
    rest = halfPlane(rest, c[i], c[(i + 1) % c.length], 1);
  }
  return pieces;
}
function shrink(poly, by) {
  const p = ccw([...poly]);
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    return { a: [a[0] + nx * by, a[1] + ny * by], d: [b[0] - a[0], b[1] - a[1]] };
  });
  return lines.map((l1, i) => {
    const l0 = lines[(i + p.length - 1) % p.length];
    const den = l0.d[0] * l1.d[1] - l0.d[1] * l1.d[0];
    if (Math.abs(den) < 1e-12) return l1.a;
    const t = ((l1.a[0] - l0.a[0]) * l1.d[1] - (l1.a[1] - l0.a[1]) * l1.d[0]) / den;
    return [l0.a[0] + l0.d[0] * t, l0.a[1] + l0.d[1] * t];
  });
}
function width(p) {
  let w = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-12) continue;
    let far = 0;
    for (const q of p) far = Math.max(far, Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / l);
    w = Math.min(w, far);
  }
  return w === Infinity ? 0 : w;
}
const bounds2 = (p) => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const q of p) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  return [x0, y0, x1, y1];
};
const planeGeometry = { planeOf, to2, to3, intersect, area2, width };
const planeKey = (n, d) => `${Math.round(n[0] * 1e5)},${Math.round(n[1] * 1e5)},${Math.round(n[2] * 1e5)}:${Math.round(d / EPS)}`;
function wholeFaces(groups) {
  const out = [];
  groups.forEach((g, frame) => {
    const ident = isIdentity(g.q);
    for (const m of g.members) {
      for (const [cs, n] of axisFaces(m.min, m.max)) out.push({ box: m.i, frame, corners: ident ? cs : cs.map((p) => rot(g.q, p)), normal: ident ? n : rot(g.q, n) });
    }
  });
  return out;
}
function flatOf(b, p) {
  if (!b.yaw && !b.pitch && !b.roll) return [p[0], p[1], p[2]];
  const c = centre(b);
  const d = rot(conj(boxQuat(b.yaw, b.pitch, b.roll)), [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
  return [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
}
function clipAcrossFrames(boxes, groups, faces, frameOf) {
  if (groups.length < 2) return faces;
  const byPlane = /* @__PURE__ */ new Map();
  for (const w of wholeFaces(groups)) {
    const key = planeKey(w.normal, dot$1(w.normal, w.corners[0]));
    let list = byPlane.get(key);
    if (!list) byPlane.set(key, list = []);
    list.push(w);
  }
  const shared = /* @__PURE__ */ new Map();
  for (const [key, list] of byPlane) {
    const [nk, dk] = key.split(":");
    const near = [...list, ...byPlane.get(`${nk}:${Number(dk) + 1}`) ?? [], ...byPlane.get(`${nk}:${Number(dk) - 1}`) ?? []];
    if (new Set(near.map((w) => w.frame)).size > 1) shared.set(key, near);
  }
  if (!shared.size) return faces;
  const flat2 = /* @__PURE__ */ new Map();
  for (const [key, list] of shared) {
    const pl = planeOf(list[0].normal, list[0].corners[0]);
    flat2.set(key, {
      pl,
      items: list.map((w) => {
        const poly = w.corners.map((p) => to2(pl, p));
        return { w, poly, bb: bounds2(poly) };
      })
    });
  }
  const out = [];
  for (const f of faces) {
    const plane = flat2.get(planeKey(f.normal, dot$1(f.normal, f.corners[0])));
    if (!plane) {
      out.push(f);
      continue;
    }
    const pl = { ...plane.pl, d: dot$1(plane.pl.n, f.corners[0]) };
    let pieces = [f.corners.map((p) => to2(pl, p))];
    const fb = bounds2(pieces[0]);
    let cut = false;
    const frame = frameOf[f.box];
    const top = f.normal[1] > 0.5;
    for (const { w, poly, bb } of plane.items) {
      if (bb[0] >= fb[2] - EPS || bb[2] <= fb[0] + EPS || bb[1] >= fb[3] - EPS || bb[3] <= fb[1] + EPS) continue;
      if (w.frame === frame || w.box === f.box || Math.abs(dot$1(w.normal, f.normal) - 1) > 1e-6 || Math.abs(dot$1(w.normal, w.corners[0]) - pl.d) > EPS) continue;
      if (!outranks(boxes, w.box, f.box, top)) continue;
      const [x0, y0, x1, y1] = bb;
      const next = [];
      for (const piece of pieces) {
        const [a0, b0, a1, b1] = bounds2(piece);
        if (x0 >= a1 - EPS || x1 <= a0 + EPS || y0 >= b1 - EPS || y1 <= b0 + EPS) {
          next.push(piece);
          continue;
        }
        const hit = intersect(piece, poly);
        if (hit.length < 3 || width(hit) <= EPS) {
          next.push(piece);
          continue;
        }
        cut = true;
        next.push(...subtractConvex(piece, shrink(poly, SEAM)));
      }
      pieces = next;
    }
    if (!cut) {
      out.push(f);
      continue;
    }
    const b = boxes[f.box];
    for (const piece of pieces) {
      if (width(piece) <= EPS) continue;
      const corners = piece.map((q) => to3(pl, q));
      out.push({ box: f.box, corners, normal: f.normal, flat: corners.map((p) => flatOf(b, p)), flatNormal: f.flatNormal });
    }
  }
  return out;
}
function visibleFaces(boxes, draw = () => true) {
  const out = [];
  const groups = frameGroups(boxes, isDrawnBox);
  const frameOf = new Int32Array(boxes.length).fill(-1);
  groups.forEach((g, k) => {
    for (const m of g.members) frameOf[m.i] = k;
  });
  for (const g of groups) {
    const ident = isIdentity(g.q);
    for (const f of clipGroup(boxes, g, draw)) {
      const m = g.members[f.m];
      const b = boxes[m.i];
      const fb = fragmentBox(m, f);
      const [corners, n] = axisFaces(fb.min, fb.max)[f.face];
      if (ident && !b.yaw && !b.pitch && !b.roll) {
        out.push({ box: m.i, corners, normal: n, flat: corners, flatNormal: n });
        continue;
      }
      const world = ident ? corners : corners.map((p) => rot(g.q, p));
      const normal = ident ? n : rot(g.q, n);
      const fn = rot(conj(boxQuat(b.yaw, b.pitch, b.roll)), normal).map((v) => Math.round(v) + 0);
      out.push({ box: m.i, corners: world, normal, flat: world.map((p) => flatOf(b, p)), flatNormal: fn });
    }
  }
  return clipAcrossFrames(boxes, groups, out, frameOf);
}
function coplanarOverlaps(boxes, o = {}) {
  const minArea = o.minArea ?? 1e-6;
  const out = [];
  const list = o.faces ?? wholeFaces(frameGroups(boxes, isDrawnBox));
  const byPlane = /* @__PURE__ */ new Map();
  for (const f of list) {
    const pl = planeOf(f.normal, f.corners[0]);
    const key = planeKey(f.normal, pl.d);
    const poly = f.corners.map((p) => to2(pl, p));
    let l = byPlane.get(key);
    if (!l) byPlane.set(key, l = []);
    l.push({ box: f.box, poly, bb: bounds2(poly), pl });
  }
  const check = (p, q) => {
    if (p.box === q.box || Math.abs(dot$1(p.pl.n, q.pl.n) - 1) > 1e-6 || Math.abs(p.pl.d - q.pl.d) > EPS) return;
    if (p.bb[0] >= q.bb[2] - SLIVER || q.bb[0] >= p.bb[2] - SLIVER || p.bb[1] >= q.bb[3] - SLIVER || q.bb[1] >= p.bb[3] - SLIVER) return;
    const hit = intersect(p.poly, q.poly);
    if (hit.length < 3) return;
    const area = Math.abs(area2(hit));
    if (area < minArea || width(hit) <= SLIVER) return;
    const corners = hit.map((c) => to3(p.pl, c));
    const center = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k], 0) / corners.length);
    out.push({ a: Math.min(p.box, q.box), b: Math.max(p.box, q.box), area, center, corners, normal: p.pl.n });
  };
  for (const [key, items] of byPlane) {
    const sorted = [...items].sort((x, y) => x.bb[0] - y.bb[0]);
    for (let x = 0; x < sorted.length; x++) {
      for (let y = x + 1; y < sorted.length; y++) {
        if (sorted[y].bb[0] >= sorted[x].bb[2] - SLIVER) break;
        check(sorted[x], sorted[y]);
      }
    }
    const [nk, dk] = key.split(":");
    for (const q of byPlane.get(`${nk}:${Number(dk) + 1}`) ?? []) for (const p of items) check(p, q);
  }
  return out;
}
const LEVEL_DEPTH_BIAS = { factor: 1, units: 2 };
const PROP_FLUSH = 2e-3;
const FLUSH_LIFT = 4e-3;
const MIN_AREA = 1e-4;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const seenFrom = (p, n) => p.facing === 0 || dot(p.axis, n) * p.facing > 0.5;
function steadyProps(map) {
  const carried = new Set(map.entities.flatMap((e) => e.kind === "mover" ? e.props ?? [] : []));
  const out = [];
  map.entities.forEach((e, i) => {
    if (e.kind !== "prop" || carried.has(e.id) || isEnvModel(e.model)) return;
    if (map.terrain && propTilts(e.model)) return;
    out.push({ e, i });
  });
  return out;
}
function propPatches(map, table, boxes, lifts = /* @__PURE__ */ new Map()) {
  const out = [];
  for (const { e, i } of steadyProps(map)) {
    const groups = table[e.model];
    if (!groups?.length || !getProp(e.model)) continue;
    const c = Math.cos(e.yaw);
    const s = Math.sin(e.yaw);
    const lift = lifts.get(e.id) ?? [0, 0, 0];
    const pos = [e.position[0] + lift[0], e.position[1] + hungPropLift(boxes, e) + lift[1], e.position[2] + lift[2]];
    const world = (p) => {
      const x = p[0] * e.scale;
      const z = p[2] * e.scale;
      return [pos[0] + x * c + z * s, pos[1] + p[1] * e.scale, pos[2] - x * s + z * c];
    };
    const dir = (k) => k === 1 ? [0, 1, 0] : k === 0 ? [c, 0, -s] : [s, 0, c];
    for (const g of groups) {
      const [k, side, facing, , x0, y0, z0, x1, y1, z1] = g;
      const lo = [x0, y0, z0];
      const hi = [x1, y1, z1];
      const [u, v] = k === 0 ? [1, 2] : k === 1 ? [0, 2] : [0, 1];
      const corner = (a, b, ua, vb) => {
        const p = [...a];
        p[u] = ua ? b[u] : a[u];
        p[v] = vb ? b[v] : a[v];
        return world(p);
      };
      const axis = dir(k);
      out.push({ entity: i, id: e.id, axis, out: [axis[0] * side, axis[1] * side, axis[2] * side], facing, corners: [corner(lo, hi, false, false), corner(lo, hi, true, false), corner(lo, hi, true, true), corner(lo, hi, false, true)] });
    }
  }
  return out;
}
function bucketKey(n, d, shift = 0) {
  const flip = n[0] < -1e-9 || Math.abs(n[0]) <= 1e-9 && (n[1] < -1e-9 || Math.abs(n[1]) <= 1e-9 && n[2] < 0);
  const m = flip ? n.map((x) => -x) : n;
  const dd = flip ? -d : d;
  return `${Math.round(m[0] * 1e4)},${Math.round(m[1] * 1e4)},${Math.round(m[2] * 1e4)}:${Math.round(dd / PROP_FLUSH) + shift}`;
}
const boundsOf = (pts) => {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) {
    b[k] = Math.min(b[k], p[k]);
    b[k + 3] = Math.max(b[k + 3], p[k]);
  }
  return b;
};
const apart = (a, b) => [0, 1, 2].some((k) => a[k] > b[k + 3] + PROP_FLUSH || b[k] > a[k + 3] + PROP_FLUSH);
function overlap(n, at, a, b) {
  const { planeOf: planeOf2, to2: to22, to3: to32, intersect: intersect2, area2: area22, width: width2 } = planeGeometry;
  const pl = planeOf2(n, at);
  const hit = intersect2(a.map((p) => to22(pl, p)), b.map((p) => to22(pl, p)));
  if (hit.length < 3) return null;
  const area = Math.abs(area22(hit));
  if (area < MIN_AREA || width2(hit) <= SLIVER) return null;
  const corners = hit.map((q) => to32(pl, q));
  return { area, center: [0, 1, 2].map((k) => corners.reduce((s, q) => s + q[k], 0) / corners.length) };
}
function propCoplanar(map, table, boxes, faces, lifts = /* @__PURE__ */ new Map()) {
  const patches = propPatches(map, table, boxes, lifts);
  const byPlane = /* @__PURE__ */ new Map();
  for (const p of patches) {
    const it = { poly3: p.corners, n: p.axis, d: dot(p.axis, p.corners[0]), bb: boundsOf(p.corners) };
    const key = bucketKey(p.axis, it.d);
    let l = byPlane.get(key);
    if (!l) byPlane.set(key, l = []);
    l.push({ p, it });
  }
  const near = (n, d) => [-1, 0, 1].flatMap((s) => byPlane.get(bucketKey(n, d, s)) ?? []);
  const level = [];
  for (const f of faces) {
    const n = f.normal;
    const d = dot(n, f.corners[0]);
    const candidates = near(n, d);
    if (!candidates.length) continue;
    const fb = boundsOf(f.corners);
    for (const { p, it } of candidates) {
      if (apart(fb, it.bb)) continue;
      const along = dot(p.axis, n);
      if (Math.abs(Math.abs(along) - 1) > 1e-6 || Math.abs(it.d * Math.sign(along) - d) > PROP_FLUSH || !seenFrom(p, n)) continue;
      const o = overlap(n, f.corners[0], f.corners, p.corners);
      if (o) level.push({ a: p.id, b: f.box, ...o, normal: n });
    }
  }
  const props = [];
  const seen = /* @__PURE__ */ new Set();
  const pair = (x, y) => {
    const [{ p, it }, { p: q, it: jt }] = x.p.entity < y.p.entity ? [x, y] : [y, x];
    if (q.entity === p.entity || apart(it.bb, jt.bb)) return;
    const along = dot(p.axis, q.axis);
    if (Math.abs(Math.abs(along) - 1) > 1e-6 || Math.abs(jt.d * Math.sign(along) - it.d) > PROP_FLUSH) return;
    const n = [p.axis, p.axis.map((v) => -v)].find((m) => seenFrom(p, m) && seenFrom(q, m));
    if (!n) return;
    const o = overlap(n, p.corners[0], p.corners, q.corners);
    if (!o) return;
    const key = `${p.id}|${q.id}|${n.join(",")}|${o.center.map((v) => v.toFixed(3)).join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    props.push({ a: p.id, b: q.id, ...o, normal: n, outs: [p.out, q.out] });
  };
  for (const [key, own] of byPlane) {
    const [nk, dk] = key.split(":");
    const list = [...own, ...byPlane.get(`${nk}:${Number(dk) + 1}`) ?? []].sort((a, b) => a.it.bb[0] - b.it.bb[0]);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[j].it.bb[0] > list[i].it.bb[3] + PROP_FLUSH) break;
        pair(list[i], list[j]);
      }
    }
  }
  return { level, props };
}
function propFlushLifts(map, table, boxes) {
  const lifts = /* @__PURE__ */ new Map();
  const index = new Map(map.entities.map((e, i) => [e.id, i]));
  const off = (id) => lifts.get(id) ?? [0, 0, 0];
  for (let round = 0; round < 3; round++) {
    const { props } = propCoplanar(map, table, boxes, [], lifts);
    if (!props.length) break;
    const pairs = /* @__PURE__ */ new Map();
    for (const o of props) {
      const b = o.b;
      const aFirst = index.get(o.a) < index.get(b);
      const [earlier, later] = aFirst ? [o.a, b] : [b, o.a];
      const away = (aFirst ? o.outs[1] : o.outs[0]).map((x) => -x);
      let l = pairs.get(later);
      if (!l) pairs.set(later, l = []);
      l.push({ earlier, n: o.normal, away });
    }
    for (const later of [...pairs.keys()].sort((x, y) => index.get(x) - index.get(y))) {
      const list = pairs.get(later);
      const dir = list[0].away;
      const along = list.filter((p) => Math.abs(Math.abs(dot(p.n, dir)) - 1) < 1e-6);
      const base = off(later);
      const sep = (k2) => along.every((p) => Math.abs(dot(p.n, [base[0] + dir[0] * k2 * FLUSH_LIFT - off(p.earlier)[0], base[1] + dir[1] * k2 * FLUSH_LIFT - off(p.earlier)[1], base[2] + dir[2] * k2 * FLUSH_LIFT - off(p.earlier)[2]])) > PROP_FLUSH * 1.5);
      const k = [1, 2, 3, 4].find(sep);
      if (k === void 0) continue;
      lifts.set(later, [base[0] + dir[0] * k * FLUSH_LIFT, base[1] + dir[1] * k * FLUSH_LIFT, base[2] + dir[2] * k * FLUSH_LIFT]);
    }
  }
  return lifts;
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fract = (v) => v - Math.floor(v);
function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647 | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function noise(u, v, period, seed = 1) {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (a2) => (a2 % period + period) % period;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(w(xi), w(yi), seed);
  const b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed);
  const d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}
const fbm = (u, v, seed = 1) => noise(u, v, 4, seed) * 0.5 + noise(u, v, 8, seed + 1) * 0.3 + noise(u, v, 16, seed + 2) * 0.2;
const edgeDist = (fu, fv) => Math.min(fu, 1 - fu, fv, 1 - fv);
function glyphPaint(u, v, b, a, painted) {
  const COLS = 6;
  const ROWS = 5;
  const band = fract(v);
  const stone = shade(b, 0.93 + fbm(u, v, 71) * 0.12);
  if (band < 0.035 || band > 0.06 && band < 0.075) return painted ? [178, 72, 40] : shade(a, 0.9);
  const cu = Math.floor(u * COLS);
  const fu = fract(u * COLS);
  if (fu < 0.035) return painted ? shade(a, 0.8) : mix(stone, a, 0.55);
  const vv = (band - 0.075) / 0.925;
  const cv = Math.floor(vv * ROWS);
  const x = fu * 2 - 1;
  const y = fract(vv * ROWS) * 2 - 1;
  const kind = Math.floor(hash(cu, cv, 83) * 10);
  const ring = (cx, cy, r, w) => Math.abs(Math.hypot(x - cx, y - cy) - r) < w;
  const disc = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  const rect = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  let hit = false;
  let fill = 0;
  switch (kind) {
    case 0:
      hit = disc(0, -0.15, 0.45, 0.45) || rect(-0.6, 0.45, 0.6, 0.55);
      fill = 1;
      break;
    case 1:
      hit = ring(0, 0, 0.5, 0.07) && y < 0.15 && Math.abs(x) < 0.55 || disc(0, 0, 0.2, 0.2) || rect(-0.05, 0.2, 0.05, 0.7) && x < 0.1 || rect(0.15, 0.35, 0.55, 0.45);
      break;
    case 2:
      hit = ring(0, -0.5, 0.25, 0.08) || rect(-0.07, -0.25, 0.07, 0.85) || rect(-0.45, -0.2, 0.45, -0.08);
      fill = 2;
      break;
    case 3:
      hit = disc(0.05, 0.05, 0.42, 0.24) || disc(-0.35, -0.3, 0.16, 0.16) || rect(-0.7, -0.33, -0.48, -0.27) || rect(0, 0.25, 0.06, 0.7) || rect(0.2, 0.25, 0.26, 0.7) || y > -0.05 && y < 0.15 && x > 0.4 && x < 0.75;
      fill = 0;
      break;
    case 4:
      for (const r of [-0.4, 0, 0.4]) if (Math.abs(y - r - Math.abs(fract(x * 2.5) - 0.5) * 0.3) < 0.06 && Math.abs(x) < 0.75) hit = true;
      fill = 2;
      break;
    case 5:
      hit = disc(0, -0.1, 0.16, 0.6) || rect(-0.04, 0.4, 0.04, 0.8);
      fill = 2;
      break;
    case 6:
      hit = disc(0, 0.35, 0.55, 0.45) && y < 0.35;
      fill = 1;
      break;
    case 7:
      hit = disc(-0.15, -0.6, 0.17, 0.17) || rect(-0.3, -0.42, 0.05, 0.35) || rect(-0.3, 0.2, 0.45, 0.4) || rect(0.3, 0.2, 0.45, 0.8) || rect(-0.3, 0.6, 0.45, 0.8);
      fill = 0;
      break;
    case 8:
      hit = Math.abs((x / 0.45) ** 2 + (y / 0.85) ** 2 - 1) < 0.25 && Math.abs(x) < 0.5 || rect(-0.5, 0.85, 0.5, 0.95) || disc(0, 0, 0.12, 0.12);
      fill = 1;
      break;
    default:
      hit = Math.abs(y - 0.25 - Math.sin(x * 4) * 0.12) < 0.08 && Math.abs(x) < 0.7 || disc(-0.62, 0.1, 0.12, 0.1) || rect(-0.62, -0.15, -0.56, 0.05);
      fill = 0;
  }
  if (!hit) return stone;
  if (!painted) return mix(shade(a, 0.95), stone, 0.15 + fbm(u, v, 73) * 0.15);
  const palette = [a, [178, 72, 40], [52, 150, 150]];
  return shade(palette[fill], 0.92 + fbm(u, v, 79) * 0.12);
}
function cobblePaint(u, v, b, a) {
  const n = 7;
  const x = u * n;
  const y = v * n;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = Infinity;
  let d2 = Infinity;
  let cell = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const wx = (cx % n + n) % n;
      const wy = (cy % n + n) % n;
      const px = cx + 0.2 + hash(wx, wy, 91) * 0.6;
      const py = cy + 0.2 + hash(wx, wy, 92) * 0.6;
      const d = Math.hypot(x - px, (y - py) * 1.1);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cell = wx * 31 + wy;
      } else if (d < d2) d2 = d;
    }
  }
  const rim = d2 - d1;
  if (rim < 0.09) return shade(a, 0.85 + fbm(u, v, 93) * 0.3);
  const warm = [b[0] * 0.8 + 30, b[1] * 0.8 + 24, b[2] * 0.8 + 18];
  const stone = shade(mix(b, warm, hash(cell, 3, 94)), 0.78 + hash(cell, 1, 95) * 0.34);
  return shade(stone, 0.72 + Math.min(1, rim / 0.45) * 0.3 + fbm(u, v, 96) * 0.08);
}
function pantilePaint(u, v, b, a) {
  const cols = 6;
  const rows = 8;
  const cu = Math.floor(u * cols);
  const fu = fract(u * cols);
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  const crown = Math.sin(fu * Math.PI);
  const lap = fv < 0.14 ? 0.55 + fv * 2.5 : 1;
  const tile = mix(b, a, hash(cu, row, 97) * 0.35 + (fu < 0.06 || fu > 0.94 ? 0.5 : 0));
  return shade(tile, (0.62 + crown * 0.45) * lap * (0.92 + fbm(u, v, 98) * 0.14));
}
function timberPaint(u, v, b, a) {
  const oak = (k) => shade(a, 0.85 + Math.sin((u * 7 + v * 31 + fbm(u, v, 101) * 3) * Math.PI) * 0.08 + k);
  const plaster = shade(b, 0.92 + fbm(u, v, 103) * 0.12);
  const bay = Math.floor(u * 4);
  const fu = fract(u * 4);
  if (v < 0.045 || v > 0.955) return oak(-0.05);
  if (Math.abs(v - 0.27) < 0.022) return oak(0);
  if (fu < 0.07 || fu > 0.93) return oak(0.02);
  if (v > 0.29 && bay % 2 === 0) {
    const t = (v - 0.29) / (0.955 - 0.29);
    const along = bay % 4 === 0 ? t : 1 - t;
    if (Math.abs(fu - along) < 0.075) return oak(-0.02);
  }
  if (v < 0.25 && bay % 2 === 1 && Math.abs(fu - 0.5) < 0.05) return oak(0);
  const edge = Math.min(fu - 0.07, 0.93 - fu);
  return edge < 0.03 ? shade(plaster, 0.9) : plaster;
}
function deckingPaint(u, v, b, a) {
  const n = 6;
  const board = Math.floor(u * n);
  const fu = fract(u * n);
  if (fu < 0.07) return shade(a, 0.35);
  const fv = fract(v * 2 + hash(board, 0, 121) * 0.5);
  if (fv < 8e-3) return shade(a, 0.45);
  const joist = fract(v * 4);
  if ((joist < 0.02 || joist > 0.98) && (Math.abs(fu - 0.3) < 0.05 || Math.abs(fu - 0.75) < 0.05)) return shade(a, 0.4);
  const grain = Math.sin((u * 60 + noise(u, v, 8, board + 3) * 5) * Math.PI) * 0.5 + 0.5;
  const weather = mix(b, a, hash(board, Math.floor(v * 2), 123) * 0.35 + grain * 0.18);
  return shade(weather, 0.86 + fbm(u, v, 125) * 0.22);
}
function ashlarPaint(u, v, b, a) {
  const tall = v < 0.6;
  const row = tall ? 0 : 1;
  const fv = tall ? v / 0.6 : (v - 0.6) / 0.4;
  const cols = tall ? 2 : 3;
  const cu = u * cols + row * 0.37;
  const block = Math.floor(cu);
  const fu = fract(cu);
  if (fu < 0.02 || fu > 0.985 || fv < 0.035 || fv > 0.975) return shade(a, 0.8 + fbm(u, v, 127) * 0.2);
  const stone = shade(mix(b, a, hash(block, row, 129) * 0.3), 0.84 + hash(block, row, 131) * 0.24);
  return shade(stone, (0.88 + fbm(u * 2, v * 2, 133) * 0.2) * (fv < 0.12 ? 0.86 : 1));
}
function pebblePaint(u, v, b, a) {
  const n = 14;
  const x = u * n;
  const y = v * n;
  let d1 = Infinity;
  let d2 = Infinity;
  let cell = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(x) + dx;
      const cy = Math.floor(y) + dy;
      const wx = (cx % n + n) % n;
      const wy = (cy % n + n) % n;
      const d = Math.hypot(x - (cx + 0.15 + hash(wx, wy, 135) * 0.7), (y - (cy + 0.15 + hash(wx, wy, 136) * 0.7)) * 1.3);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cell = wx * 37 + wy;
      } else if (d < d2) d2 = d;
    }
  }
  if (d2 - d1 < 0.12) return shade(a, 0.6 + fbm(u, v, 137) * 0.3);
  const tone = hash(cell, 7, 138);
  const stone = tone < 0.15 ? shade(b, 1.25) : tone > 0.85 ? shade(a, 1.1) : mix(b, a, tone * 0.4);
  return shade(stone, 0.75 + Math.min(1, (d2 - d1) / 0.5) * 0.3);
}
function corrugatedPaint(u, v, b, a) {
  const ridge = Math.sin(fract(u * 10) * Math.PI * 2);
  const sheet = Math.floor(u * 2);
  const rust = clamp01(noise(u * 2, v * 0.5, 8, 139 + sheet) * 1.6 - 0.75 + (fract(v * 2) < 0.06 ? 0.6 : 0));
  const paint = shade(b, 0.82 + ridge * 0.16 + fbm(u, v, 141) * 0.06);
  if (fract(u * 2) < 0.01) return shade(paint, 0.6);
  return mix(paint, a, rust * 0.8);
}
function lapboardPaint(u, v, b, a) {
  const rows = 8;
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  const lap = fv > 0.88 ? 0.55 : 1 - (0.88 - fv) * 0.12;
  const worn = clamp01(noise(u, v * 2, 8, 143 + row) * 1.8 - 1.05);
  return shade(mix(b, a, worn * 0.6), lap * (0.9 + fbm(u * 3, v, 145) * 0.12));
}
function icePaint(u, v, b, a) {
  const n = 5;
  const [x, y] = [u * n, v * n];
  let d1 = Infinity;
  let d2 = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(x) + dx;
      const cy = Math.floor(y) + dy;
      const [wx, wy] = [(cx % n + n) % n, (cy % n + n) % n];
      const d = Math.hypot(x - cx - hash(wx, wy, 131), y - cy - hash(wx, wy, 132));
      if (d < d1) [d2, d1] = [d1, d];
      else if (d < d2) d2 = d;
    }
  }
  const rim = d2 - d1;
  const depth = fbm(u, v, 133);
  let c = shade(mix(b, a, depth * 0.2), 0.82 + depth * 0.32);
  if (rim < 0.035) c = mix(c, a, 0.8 - rim * 12);
  else if (rim < 0.1) c = mix(c, a, 0.12);
  if (hash(Math.floor(u * 64), Math.floor(v * 64), 134) > 0.985) c = mix(c, a, 0.55);
  return c;
}
function sandstoneAshlarPaint(u, v, b, a) {
  const rows = 4;
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  const n = hash(row, 0, 121) < 0.5 ? 2 : 3;
  const su = fract(u + hash(row, 1, 122)) * n;
  const block = Math.floor(su);
  const fu = fract(su);
  if (fv < 0.045 || fu < 0.02) return shade(a, 0.9 + fbm(u, v, 123) * 0.2);
  const rim = Math.min(fu - 0.02, 1 - fu, (fv - 0.045) * 0.6, (1 - fv) * 0.6) * 10;
  const tone = mix(b, [b[0] * 0.92 + 18, b[1] * 0.88 + 10, b[2] * 0.8], hash(block, row, 124));
  const tooled = Math.sin((u * 90 + v * 14 + noise(u, v, 8, 125) * 4) * Math.PI) * 0.025;
  return shade(tone, (0.86 + hash(block, row, 126) * 0.2) * (0.9 + Math.min(1, rim) * 0.1) + tooled + fbm(u, v, 127) * 0.08 - 0.04);
}
function stuccoPaint(u, v, b, a) {
  const plaster = shade(mix(b, a, clamp01(fbm(u, v, 134) - 0.45) * 0.5), 0.94 + fbm(u, v, 135) * 0.1);
  const flake = noise(u, v, 4, 131) * 0.6 + noise(u, v, 16, 132) * 0.4;
  const worn = clamp01((flake - 0.76) / 0.1);
  if (worn <= 0) return plaster;
  const row = Math.floor(v * 16);
  const su = u * 8 + row % 2 * 0.5;
  const joint = fract(su) < 0.08 || fract(v * 16) < 0.12;
  const stone = joint ? shade(a, 0.8) : shade(a, 0.92 + hash(Math.floor(su), row, 133) * 0.14);
  return mix(plaster, stone, worn * 0.5);
}
function scalesPaint(u, v, b, a) {
  const cols = 8;
  const rows = 8;
  const row = Math.floor(v * rows);
  const x = u * cols + row % 2 * 0.5;
  const col = Math.floor(x);
  const fu = fract(x) - 0.5;
  const fv = fract(v * rows);
  const d = Math.hypot(fu, (fv - 0.15) * 0.9);
  if (d > 0.56) return shade(b, 0.62);
  if (d > 0.48) return shade(mix(b, [230, 230, 220], 0.3), 0.55);
  const glaze = hash((col % cols + cols) % cols, row, 141) < 0.12 ? a : b;
  return shade(mix(glaze, [255, 255, 255], Math.max(0, 0.3 - d) * 0.6), 0.75 + (1 - Math.min(1, d * 2)) * 0.35 + hash((col % cols + cols) % cols, row, 142) * 0.1);
}
function zelligePaint(u, v, b, a) {
  const n = 4;
  const x = fract(u * n) - 0.5;
  const y = fract(v * n) - 0.5;
  const sq = Math.max(Math.abs(x), Math.abs(y));
  const dia = (Math.abs(x) + Math.abs(y)) / Math.SQRT2;
  const star = Math.max(sq / 0.3, dia / 0.3);
  const cx = 0.5 - Math.abs(x);
  const cy = 0.5 - Math.abs(y);
  const cross = cx < 0.07 && cy < 0.2 || cy < 0.07 && cx < 0.2;
  const colours = [
    [40, 150, 150],
    [196, 140, 50],
    [50, 120, 70]
  ];
  const second = colours[Math.floor(hash(Math.round(u * n) % n, Math.round(v * n) % n, 151) * 3)];
  const glazed = (c, seed) => shade(c, 0.88 + hash(Math.floor(u * 24), Math.floor(v * 24), seed) * 0.18);
  if (Math.abs(star - 1) < 0.07) return [118, 110, 98];
  if (star < 1) return star < 0.4 ? glazed([236, 228, 210], 152) : glazed(a, 153);
  if (cross) return glazed(second, 154);
  if (fract(u * 24) < 0.08 || fract(v * 24) < 0.08) return shade(b, 0.84);
  return glazed(b, 155);
}
function flagsPaint(u, v, b, a) {
  const heights = [0.3, 0.4, 0.3];
  let row = 0;
  let v0 = 0;
  while (row < 2 && v >= v0 + heights[row]) v0 += heights[row++];
  const h = heights[row];
  const fv = (v - v0) / h;
  const n = 2 + Math.floor(hash(row, 0, 161) * 2);
  const su = fract(u + hash(row, 1, 162)) * n;
  const slab = Math.floor(su);
  const fu = fract(su);
  const jv = 0.02 / h;
  const ju = 0.02 * n;
  if (fv < jv || fu < ju) return shade(a, 0.8 + fbm(u, v, 163) * 0.25);
  const rim = Math.min((fu - ju) / ju, (1 - fu) / ju, (fv - jv) / jv, (1 - fv) / jv);
  const tone = shade(b, 0.84 + hash(slab, row, 164) * 0.22);
  return shade(mix(tone, a, clamp01(noise(u, v, 8, 165 + row) - 0.55) * 0.6), (rim < 1.5 ? 0.92 : 1) * (0.95 + fbm(u, v, 166) * 0.1));
}
function rugPaint(u, v, b, a) {
  const cream = [226, 206, 160];
  const ochre = [200, 140, 60];
  const weave = 0.92 + (fract(u * 96) < 0.5 ? 0.04 : 0) + (fract(v * 96) < 0.5 ? 0.03 : 0) + fbm(u, v, 171) * 0.06;
  const e = Math.min(u, 1 - u, v, 1 - v);
  let c = b;
  if (e < 0.03) c = a;
  else if (e < 0.05) c = cream;
  else if (e < 0.11) {
    const along = Math.min(u, 1 - u) < Math.min(v, 1 - v) ? v : u;
    const z = Math.abs(fract(along * 12) - 0.5) * 0.08 + 0.06;
    c = Math.abs(e - z) < 0.01 ? ochre : a;
  } else if (e < 0.125) c = cream;
  else {
    const d = Math.abs(u - 0.5) + Math.abs(v - 0.5);
    const step = Math.floor(d * 20);
    if (d < 0.3) c = step % 3 === 0 ? cream : step % 3 === 1 ? a : ochre;
    else if (d < 0.32) c = cream;
    else {
      const mu = fract(u * 6) - 0.5;
      const mv = fract(v * 6) - 0.5;
      if (Math.abs(mu) + Math.abs(mv) < 0.12) c = hash(Math.floor(u * 6), Math.floor(v * 6), 172) < 0.5 ? cream : a;
    }
  }
  return shade(c, weave);
}
function latticePaint(u, v, b, a) {
  const n = 8;
  const s = fract((u + v) * n * 0.5);
  const t = fract((u - v) * n * 0.5);
  const ds = Math.abs(s - 0.5);
  const dt = Math.abs(t - 0.5);
  if (Math.min(u, 1 - u, v, 1 - v) < 0.035) return shade(b, 0.85);
  const r = Math.hypot(ds, dt);
  if (r < 0.17) return shade(b, 1.08 - r * 1.4);
  const m = Math.min(ds, dt);
  if (m < 0.075) return shade(b, 0.95 - m * 2.2 + fbm(u, v, 181) * 0.06);
  return shade(a, 0.9 + fbm(u, v, 182) * 0.2);
}
function slabPaint(u, v, b, a) {
  const n = 3;
  const cu = Math.floor(u * n);
  const cv = Math.floor(v * n);
  const fu = fract(u * n);
  const fv = fract(v * n);
  const e = edgeDist(fu, fv);
  const growth = fbm(u, v, 121);
  const corner = Math.min(Math.hypot(fu, fv), Math.hypot(1 - fu, fv), Math.hypot(fu, 1 - fv), Math.hypot(1 - fu, 1 - fv));
  const chipped = corner < 0.08 + hash(cu, cv, 123) * 0.08;
  if (e < 0.025 || chipped) return shade(a, 0.7 + growth * 0.5);
  let stone = shade(b, 0.82 + hash(cu, cv, 125) * 0.22 + fbm(u, v, 127) * 0.12);
  if (e < 0.06) stone = shade(stone, 0.88);
  if (hash(cu, cv, 129) > 0.6 && Math.abs(fv - 0.3 - fu * 0.5 - Math.sin(fu * 9) * 0.03) < 0.012) stone = shade(stone, 0.6);
  const creep = clamp01((growth - 0.55) * 4 - e * 3);
  return mix(stone, shade(a, 0.85 + fbm(u, v, 131) * 0.3), creep);
}
function fretPaint(u, v, b, a) {
  const rows = 4;
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  const blocks = row % 2 === 0 ? 2 : 4;
  const bu = fract(u * blocks + row % 2 * 0.5);
  const block = Math.floor(u * blocks + row % 2 * 0.5);
  if (bu < 0.02 || fv < 0.05) return shade(a, 0.75 + fbm(u, v, 141) * 0.2);
  const stone = shade(b, 0.86 + hash(block, row, 143) * 0.16 + fbm(u, v, 145) * 0.1);
  if (row % 2 === 0) return stone;
  const x = (fract(u * 4 + 0.5) * 2 - 1) * 1.05;
  const y = (fv - 0.05) / 0.95 * 2 - 1;
  const ax = Math.abs(x);
  const s = x < 0 ? -1 : 1;
  const yy = y * s;
  const groove = Math.abs(yy + 0.62) < 0.13 && ax < 0.85 || Math.abs(ax - 0.85) < 0.12 && yy > -0.75 && yy < 0.55 || Math.abs(yy - 0.55) < 0.12 && ax > 0.2 && ax < 0.85 || Math.abs(ax - 0.2) < 0.12 && yy > -0.1 && yy < 0.55 || Math.abs(yy + 0.1) < 0.12 && ax > 0.2 && ax < 0.55;
  if (!groove) return stone;
  return mix(shade(a, 0.9), stone, 0.2 + fbm(u, v, 147) * 0.15);
}
function reliefPaint(u, v, b, a) {
  const cu = Math.floor(u * 2);
  const cv = Math.floor(v * 2);
  const fu = fract(u * 2);
  const fv = fract(v * 2);
  const stone = shade(b, 0.88 + hash(cu, cv, 151) * 0.12 + fbm(u, v, 153) * 0.1);
  const e = edgeDist(fu, fv);
  if (e < 0.02) return shade(a, 0.7);
  if (e < 0.09) return e < 0.05 ? shade(stone, 1.08) : shade(stone, 0.86);
  const x = (fu - 0.5) * 2.4;
  const y = (fv - 0.5) * 2.4;
  const r = Math.hypot(x, y);
  const kind = Math.floor(hash(cu, cv, 155) * 3);
  const h = (px, py) => {
    const pr = Math.hypot(px, py);
    if (kind === 0) {
      if (Math.abs(py - 0.45) < 0.12 && Math.abs(px) < 0.75) return 1;
      if (Math.hypot(Math.abs(px) - 0.35, py - 0.15) < 0.15) return 0.5;
      if (Math.abs(px) < 0.1 && py > -0.25 && py < 0.2) return 1;
      if (Math.abs(py + 0.45) < 0.08 && Math.abs(px) < 0.4) return 1;
      if (Math.hypot(Math.abs(px) - 0.85, py) < 0.18) return 1;
      return Math.abs(px) < 0.7 && py > -0.7 && py < 0.65 ? 0.35 : 0;
    }
    if (kind === 1) {
      if (pr < 0.3) return 1;
      if (Math.abs(pr - 0.45) < 0.06) return 0.8;
      const ang2 = Math.atan2(py, px);
      return pr > 0.55 && pr < 0.95 && Math.abs(fract(ang2 / (Math.PI * 2) * 12) - 0.5) < 0.18 ? 0.7 : 0;
    }
    const ang = Math.atan2(py, px) / (Math.PI * 2) + 0.5;
    const turn = pr / 0.3 - ang;
    if (pr < 0.95 && Math.abs(fract(turn) - 0.5) < 0.22 && pr > 0.08) return 0.8;
    return Math.hypot(px - 0.7, py + 0.65) < 0.2 ? 1 : 0;
  };
  const here = h(x, y);
  if (here <= 0) return shade(stone, r > 1.1 ? 0.9 : 0.94);
  const above = h(x, y + 0.08);
  const below = h(x, y - 0.08);
  const lit = above < here ? 1.18 : below < here ? 0.72 : 1;
  return shade(mix(stone, shade(b, 1.05), here * 0.3), lit);
}
function inlayPaint(u, v, b, a) {
  const n = 2;
  const fu = fract(u * n);
  const fv = fract(v * n);
  const e = edgeDist(fu, fv);
  const wear = 0.9 + fbm(u, v, 161) * 0.18;
  if (e < 0.03) return shade([40, 36, 30], 0.9 + fbm(u, v, 163) * 0.2);
  const gold = shade(a, wear * (1 + Math.sin((u + v) * 40) * 0.05));
  if (e < 0.1) return e > 0.085 ? shade(gold, 0.75) : gold;
  const x = Math.abs(fu - 0.5);
  const y = Math.abs(fv - 0.5);
  const d = x + y;
  if (Math.abs(d - 0.28) < 0.035) return gold;
  if (d < 0.08) return gold;
  if (Math.hypot(x - 0.28, y) < 0.035 || Math.hypot(x, y - 0.28) < 0.035) return gold;
  if (Math.abs(d - 0.18) < 0.012) return shade(b, 0.7);
  return shade(b, wear);
}
function rootPaint(u, v, b, a) {
  const earth = shade(b, 0.8 + fbm(u, v, 171) * 0.35);
  const lu = fract(u * 9);
  const lv = fract(v * 9);
  const [lx, ly] = [Math.floor(u * 9), Math.floor(v * 9)];
  const leafHere = hash(lx, ly, 173) > 0.55 && Math.hypot((lu - 0.5) * 1.6, lv - 0.5) < 0.3;
  let c = leafHere ? hash(lx, ly, 175) > 0.5 ? [86, 98, 44] : [120, 84, 46] : earth;
  for (let k = 0; k < 4; k++) {
    const phase = hash(k, 1, 177) * 6.283;
    const along = k % 2 === 0 ? u : v;
    const across = k % 2 === 0 ? v : u;
    const centre2 = fract(hash(k, 2, 179) + Math.sin(along * 6.283 * (k + 1) + phase) * 0.08 + noise(along, 0.37 * k, 4, 180 + k) * 0.06);
    const width2 = 0.018 + hash(k, 3, 181) * 0.02;
    const dd = Math.abs(fract(across - centre2 + 0.5) - 0.5);
    if (dd < width2) {
      const top = fract(across - centre2 + 1) < 0.5 ? 1.15 : 0.8;
      c = shade(a, (0.85 + fbm(u, v, 183 + k) * 0.25) * top * (1 - dd / width2 * 0.35));
    }
  }
  return c;
}
function thatchPaint(u, v, b, a) {
  const rows = 5;
  const fv = fract(v * rows);
  const row = Math.floor(v * rows);
  const strand = noise(u, 0.5 + row * 0.13, 64, 191 + row);
  const c = mix(b, a, clamp01(strand * 0.9 + (1 - fv) * 0.35));
  const lap = fv < 0.12 ? 0.6 + fv * 3 : 1;
  return shade(c, lap * (0.88 + fbm(u, v, 193) * 0.2));
}
function sandbagPaint(u, v, b, a) {
  const rows = 6;
  const vv = v * rows + (noise(u, v, 8, 223) - 0.5) * 0.22;
  const row = Math.floor(vv);
  const fv = vv - row;
  const cu = u * 3 + row % 2 * 0.5 + (hash(row, 0, 211) - 0.5) * 0.1;
  const bag = Math.floor(cu);
  const fu = fract(cu);
  const fat = 0.92 + hash(bag, row, 225) * 0.12;
  const x = (fu - 0.5) * 2 / (0.97 + hash(bag, row, 227) * 0.05);
  const y = (fv - 0.5) * 2 / fat + (noise(u, v, 16, 229) - 0.5) * 0.18;
  const r = Math.abs(x) ** 5 + Math.abs(y) ** 2.4;
  if (r >= 1) return shade(a, 0.5 + fbm(u, v, 213) * 0.3);
  const crown = Math.sqrt(1 - r);
  const light = 0.6 + crown * 0.44 + (y < 0 ? 0.06 : -0.07) * crown;
  const tie = (hash(bag, row, 215) < 0.5 ? x : -x) > 0.8 ? 0.8 + fbm(u * 3, v * 3, 231) * 0.1 : 1;
  const crease = 1 - Math.max(0, Math.sin((x * 2.3 + y * 0.8 + hash(bag, row, 233) * 6) * Math.PI) - 0.85) * 0.6;
  const weave = 0.96 + Math.sin(u * 900) * Math.sin(v * 900) * 0.04;
  const cloth = mix(b, a, 0.1 + hash(bag, row, 217) * 0.26 + fbm(u * 2, v * 2, 219) * 0.16);
  return shade(cloth, light * tie * crease * weave * (0.9 + fbm(u, v, 221) * 0.16));
}
function parkingPaint(u, v, b, a) {
  const grit = hash(Math.floor(u * 256), Math.floor(v * 256), 301);
  let road = shade(b, 0.86 + grit * 0.2 + fbm(u, v, 303) * 0.12);
  if (grit > 0.965) road = mix(road, a, 0.28);
  road = shade(road, 1 - clamp01(noise(u, v, 4, 305) * 0.6 + noise(u, v, 16, 306) * 0.4 - 0.6) * 0.7);
  const LINE = 0.012;
  const du = Math.min(u, Math.abs(u - 0.5), 1 - u);
  const dv = Math.min(v, 1 - v);
  if (du > LINE && dv > LINE) return road;
  const edge = clamp01((LINE - Math.min(du, dv)) / 4e-3);
  const worn = clamp01((noise(u, v, 16, 307) * 0.6 + noise(u, v, 64, 309) * 0.4 - 0.34) / 0.2);
  return mix(road, shade(a, 0.9 + fbm(u, v, 311) * 0.1), edge * (0.35 + worn * 0.6));
}
function tactilePaint(u, v, b, a) {
  const fu = fract(u * 2);
  const fv = fract(v * 2);
  const slab = hash(Math.floor(u * 2), Math.floor(v * 2), 321);
  if (edgeDist(fu, fv) < 0.018) return shade(a, 0.7 + fbm(u, v, 323) * 0.2);
  const face = shade(b, 0.84 + slab * 0.08 + fbm(u, v, 325) * 0.1);
  const dx = fract(fu * 6) - 0.5;
  const dy = fract(fv * 6) - 0.5;
  const r = Math.hypot(dx, dy) / 0.3;
  if (r < 1) {
    const crown = Math.sqrt(1 - r * r);
    return shade(b, 0.9 + slab * 0.06 + crown * 0.14 + (dy - dx) * 0.22);
  }
  const ring = clamp01(1 - (r - 1) / 0.45);
  return mix(face, a, ring * (0.22 + clamp01((dx - dy) * 1.6) * 0.3));
}
function brickUnder(u, v, brick, mortar, seed) {
  const rows = 16;
  const row = Math.floor(v * rows);
  const cu = u * 8 + row % 2 * 0.5;
  const joint = fract(cu) < 0.045 || fract(v * rows) < 0.13;
  if (joint) return { c: shade(mortar, 0.88 + fbm(u, v, seed) * 0.2), joint, tone: 0.8 };
  const tone = 0.8 + hash(Math.floor(cu) % 8, row, seed + 1) * 0.3 + fbm(u, v, seed + 2) * 0.1;
  return { c: shade(brick, tone), joint, tone };
}
function segDist(px, py, ax, ay, bx, by) {
  const x = ax + (px - ax - Math.round(px - ax));
  const ex = bx - ax;
  const ey = by - ay;
  const t = clamp01(((x - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey));
  return Math.hypot(x - ax - ex * t, py - ay - ey * t);
}
const lineDist = (px, py, pts) => {
  let d = 9;
  for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
};
const blobDist = (px, py, discs) => {
  let d = 9;
  for (const [x, y, r] of discs) d = Math.min(d, Math.hypot(px - x - Math.round(px - x), py - y) - r);
  return d;
};
const SPRAY = { teal: hex("#2fb0a4"), pink: hex("#d9367f"), yellow: hex("#efc21c"), white: hex("#eeeae0"), blue: hex("#3a62c8"), ink: hex("#17171d") };
const G_CLOUD = [[0.17, 0.4, 0.085], [0.26, 0.47, 0.1], [0.36, 0.42, 0.09], [0.3, 0.34, 0.085], [0.21, 0.31, 0.06], [0.42, 0.36, 0.055]];
const G_SHINE = [[0.22, 0.5, 0.018], [0.25, 0.525, 0.012]];
const G_BOLT = [[0.56, 0.6], [0.66, 0.42], [0.62, 0.42], [0.74, 0.24], [0.7, 0.24], [0.79, 0.12]];
const G_WAVE = Array.from({ length: 41 }, (_, i) => [0.5 + i / 40 * 0.44, 0.74 + Math.sin(i / 40 * Math.PI * 5) * 0.035 * (1 - i / 60)]);
const G_SCRAWL = Array.from({ length: 15 }, (_, i) => [0.06 + i / 14 * 0.36, 0.665 + (i % 2 === 0 ? -1 : 1) * 0.04 * (1 - i / 22) + i / 14 * 0.02]);
const G_UNDER = [[0.05, 0.585], [0.2, 0.575], [0.36, 0.59], [0.44, 0.62]];
const G_DOTS = [[0.86, 0.5, 0.034], [0.93, 0.4, 0.022], [0.88, 0.33, 0.014]];
const G_RING = [0.52, 0.27, 0.05];
const G_DRIPS = [[0.2, 0.26, 0.09, "teal"], [0.31, 0.26, 0.15, "teal"], [0.37, 0.33, 0.06, "teal"], [0.72, 0.24, 0.07, "pink"], [0.86, 0.47, 0.11, "yellow"], [0.52, 0.22, 0.05, "blue"]];
function graffitiPaint(u, v, b, a) {
  const wall = brickUnder(u, v, b, a, 341);
  const under = shade(wall.c, 0.9 + clamp01(v * 3) * 0.1);
  let paint = null;
  let cover = 0;
  const lay = (c, k) => {
    if (k <= 0) return;
    paint = paint && k < 1 ? mix(paint, c, k) : c;
    cover = Math.max(cover, k);
  };
  const cloud = blobDist(u, v, G_CLOUD);
  const bolt = lineDist(u, v, G_BOLT);
  lay(SPRAY.teal, clamp01(1 - cloud / 0.05) * 0.3);
  lay(SPRAY.pink, clamp01(1 - (bolt - 0.024) / 0.035) * 0.3);
  for (const [x, top, len, c] of G_DRIPS) {
    const dx = Math.abs(u - x - Math.round(u - x));
    const w = 55e-4 * (0.6 + clamp01((v - (top - len)) / len) * 0.6);
    if (v < top && v > top - len && dx < w) lay(SPRAY[c], 1);
    if (Math.hypot(dx, v - (top - len)) < 8e-3) lay(SPRAY[c], 1);
  }
  if (cloud < 0.012) lay(SPRAY.ink, 1);
  if (cloud < 0) lay(mix(SPRAY.teal, SPRAY.blue, clamp01((0.42 - v) * 4)), 1);
  if (blobDist(u, v, G_SHINE) < 0) lay(SPRAY.white, 1);
  if (bolt < 0.032) lay(SPRAY.ink, 1);
  if (bolt < 0.022) lay(SPRAY.pink, 1);
  const dots = blobDist(u, v, G_DOTS);
  if (dots < 8e-3) lay(SPRAY.ink, 1);
  if (dots < 0) lay(SPRAY.yellow, 1);
  const ring = Math.abs(Math.hypot(u - G_RING[0] - Math.round(u - G_RING[0]), v - G_RING[1]) - G_RING[2]);
  if (ring < 9e-3) lay(SPRAY.blue, 1);
  lay(SPRAY.yellow, clamp01((0.011 - lineDist(u, v, G_WAVE)) / 4e-3));
  lay(SPRAY.white, clamp01((85e-4 - lineDist(u, v, G_SCRAWL)) / 3e-3));
  lay(SPRAY.white, clamp01((7e-3 - lineDist(u, v, G_UNDER)) / 3e-3));
  if (!paint || cover <= 0) return under;
  const flaked = clamp01((noise(u, v, 32, 343) * 0.6 + noise(u, v, 64, 345) * 0.4 - 0.7) / 0.08);
  const on = shade(paint, (wall.joint ? 0.72 : 0.78 + wall.tone * 0.22) * (0.94 + fbm(u, v, 347) * 0.1));
  return mix(under, on, cover * (1 - flaked * 0.85));
}
function spalledPaint(u, v, b, a) {
  const streak = clamp01(noise(u, v * 0.25, 16, 361) - 0.55) * 0.5;
  let plaster = shade(b, 0.92 + fbm(u, v, 363) * 0.1 - streak * 0.18);
  const f = noise(u, v, 4, 365) * 0.55 + noise(u, v, 8, 367) * 0.3 + noise(u, v, 32, 369) * 0.15;
  const crack = Math.abs(noise(u, v, 8, 371) - 0.5);
  if (crack < 7e-3 && f > 0.47) plaster = shade(plaster, 0.8);
  const OPEN = 0.66;
  if (f < OPEN - 0.05) return plaster;
  const grit = hash(Math.floor(u * 256), Math.floor(v * 256), 373);
  const render = shade(mix(b, [128, 124, 116], 0.6), 0.84 + grit * 0.16);
  if (f < OPEN) return mix(plaster, render, clamp01((f - (OPEN - 0.05)) / 0.012));
  const wall = brickUnder(u, v, a, mix(b, [120, 112, 100], 0.65), 375);
  const brick = mix(wall.c, b, 0.1 + fbm(u, v, 379) * 0.14);
  return mix(render, brick, clamp01((f - OPEN) / 0.012));
}
const PAINTERS = {
  sandbags: sandbagPaint,
  parking_bays: parkingPaint,
  tactile: tactilePaint,
  graffiti: graffitiPaint,
  spalled_plaster: spalledPaint,
  grid: (u, v, b, a) => {
    const e = edgeDist(u, v);
    const mid = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5));
    return e < 0.012 ? a : mid < 4e-3 ? mix(b, a, 0.5) : b;
  },
  plain: (u, v, b) => shade(b, 0.97 + fbm(u, v) * 0.06),
  noise: (u, v, b, a) => mix(b, a, clamp01(fbm(u, v) * 1.4 - 0.2)),
  bricks: (u, v, b, a) => {
    const rows = 8;
    const row = Math.floor(v * rows);
    const bu = fract(u * 4 + row % 2 * 0.5);
    const bv = fract(v * rows);
    if (bu < 0.04 || bv < 0.12) return shade(a, 0.9 + fbm(u, v, 3) * 0.2);
    const brick = Math.floor(u * 4 + row % 2 * 0.5);
    return shade(b, 0.82 + hash(brick, row, 5) * 0.28 + fbm(u, v, 7) * 0.1);
  },
  blocks: (u, v, b, a) => {
    const row = Math.floor(v * 3);
    const bu = fract(u * 2 + row % 2 * 0.5);
    const bv = fract(v * 3);
    if (bu < 0.025 || bv < 0.04) return a;
    const block = Math.floor(u * 2 + row % 2 * 0.5);
    return mix(shade(b, 0.88 + hash(block, row, 11) * 0.2), a, fbm(u, v, 13) * 0.35);
  },
  planks: (u, v, b, a) => {
    const plank = Math.floor(u * 5);
    const pu = fract(u * 5);
    if (pu < 0.04) return shade(a, 0.7);
    const end = fract(v + hash(plank, 0, 17) * 0.7);
    if (end < 0.012) return shade(a, 0.75);
    const grain = Math.sin((u * 40 + noise(u, v, 8, plank) * 6) * Math.PI) * 0.5 + 0.5;
    return mix(shade(b, 0.9 + hash(plank, 1, 19) * 0.2), a, grain * 0.35);
  },
  tiles: (u, v, b, a) => edgeDist(fract(u * 4), fract(v * 4)) < 0.05 ? a : shade(b, 0.96 + fbm(u, v, 23) * 0.08),
  checker: (u, v, b, a) => {
    const c = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
    return shade(c ? b : a, 0.95 + fbm(u, v, 29) * 0.1);
  },
  plates: (u, v, b, a) => {
    const fu = fract(u * 2);
    const fv = fract(v * 2);
    if (edgeDist(fu, fv) < 0.012) return shade(b, 0.55);
    const rivet = [0.08, 0.92].some((ru) => [0.08, 0.92].some((rv) => Math.hypot(fu - ru, fv - rv) < 0.025));
    if (rivet) return a;
    return shade(b, 0.92 + fbm(u, v, 31) * 0.12);
  },
  grate: (u, v, b, a) => {
    const fu = fract(u * 8);
    const fv = fract(v * 8);
    return fu > 0.22 && fu < 0.78 && fv > 0.22 && fv < 0.78 ? a : shade(b, 0.9 + fbm(u, v, 37) * 0.15);
  },
  panels: (u, v, b, a) => {
    const fu = fract(u * 2);
    const fv = fract(v);
    const e = edgeDist(fu, fv);
    if (e < 0.012) return shade(b, 0.5);
    if (e < 0.03) return shade(b, 1.12);
    if (Math.abs(fv - 0.75) < 0.01 && fu > 0.2 && fu < 0.8) return a;
    return shade(b, 0.96 + fbm(u, v, 41) * 0.06);
  },
  stripes: (u, v, b, a) => fract((u + v) * 3) < 0.5 ? b : a,
  hex: (u, v, b, a) => {
    const x = u * 4;
    const y = v * 4 * (2 / Math.sqrt(3));
    const r = Math.round(y);
    const q = Math.round(x - r % 2 * 0.5);
    let best = Infinity;
    let second = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dq = -1; dq <= 1; dq++) {
        const rr = r + dr;
        const cx = q + dq + (rr % 2 + 2) % 2 * 0.5;
        const d = Math.hypot(x - cx, (y - rr) * (Math.sqrt(3) / 2));
        if (d < best) {
          second = best;
          best = d;
        } else if (d < second) second = d;
      }
    }
    return second - best < 0.06 ? a : shade(b, 0.95 + fbm(u, v, 43) * 0.1);
  },
  marble: (u, v, b, a) => {
    const t = Math.sin((u * 3 + v * 2 + fbm(u, v, 47) * 3) * Math.PI * 2);
    const vein = Math.pow(1 - Math.abs(t), 6);
    return mix(shade(b, 0.97 + fbm(u, v, 53) * 0.05), a, vein * 0.8);
  },
  glyphs: (u, v, b, a) => glyphPaint(u, v, b, a, false),
  glyphs_painted: (u, v, b, a) => glyphPaint(u, v, b, a, true),
  mosaic: (u, v, b, a) => {
    const n = 32;
    const cu = Math.floor(u * n);
    const cv = Math.floor(v * n);
    const fu = fract(u * n);
    const fv = fract(v * n);
    const grout = fu < 0.1 || fv < 0.1;
    const edge = Math.min(cu, cv, n - 1 - cu, n - 1 - cv);
    let c = b;
    if (edge === 0 || edge === 5) c = a;
    else if (edge >= 1 && edge <= 4) {
      const along = (edge === Math.min(cu, n - 1 - cu) ? cv : cu) % 4;
      const across = edge - 1;
      const key = across === 0 || across === 3 && along !== 3 || along === 0 && across < 3 || across === 2 && along === 2;
      if (key) c = a;
    } else {
      const d = Math.abs(cu - n / 2 + 0.5) + Math.abs(cv - n / 2 + 0.5);
      if (d < 4) c = mix(a, [230, 180, 60], 0.5);
      else if (d < 6) c = a;
      else if (d > 9 && d < 11) c = shade(a, 0.7);
    }
    if (grout) return shade(mix(b, [120, 110, 95], 0.6), 0.8);
    return shade(c, 0.88 + hash(cu, cv, 61) * 0.2);
  },
  cobbles: cobblePaint,
  setts: (u, v, b, a) => {
    const rows = 6;
    const row = Math.floor(v * rows);
    const su = u * 3 + row % 2 * 0.5;
    const stone = Math.floor(su);
    const fu = fract(su);
    const fv = fract(v * rows);
    if (fu < 0.05 || fv < 0.09) return shade(a, 0.85 + fbm(u, v, 107) * 0.3);
    const rim = Math.min(fu - 0.05, 1 - fu, fv - 0.09, 1 - fv) * 4;
    return shade(b, (0.8 + hash(stone, row, 109) * 0.3) * (0.82 + Math.min(1, rim) * 0.18) + fbm(u, v, 111) * 0.08);
  },
  diamonds: (u, v, b, a) => {
    const s = (u + v) * 3;
    const t = (u - v) * 3;
    const fs = fract(s);
    const ft = fract(t);
    if (fs < 0.06 || ft < 0.06) return shade(mix(b, a, 0.5), 0.6);
    const c = ((Math.floor(s) + Math.floor(t)) % 2 + 2) % 2 === 0 ? b : a;
    return shade(c, 0.9 + hash(Math.floor(s), Math.floor(t), 113) * 0.12 + fbm(u, v, 115) * 0.06);
  },
  pantiles: pantilePaint,
  timber: timberPaint,
  // Style Pack 12 Snow Outpost.
  snow: (u, v, b, a) => {
    const ripple = 0.5 + 0.5 * Math.sin((v * 6 + noise(u, v, 4, 123) * 1.5) * Math.PI * 2);
    const c = mix(a, b, clamp01(0.4 + fbm(u, v, 121) * 0.5 + ripple * 0.2));
    return hash(Math.floor(u * 128), Math.floor(v * 128), 125) > 0.992 ? shade(c, 1.1) : c;
  },
  ice: icePaint,
  prefab: (u, v, b, a) => {
    const fu = fract(u * 4);
    const fv = fract(v);
    if (fu < 0.025 || fu > 0.975 || fv < 0.035 || fv > 0.965) return shade(a, 0.9);
    const rib = Math.abs(fu - 0.5) < 0.035 ? 1.08 : Math.abs(fu - 0.5) < 0.05 ? 0.86 : 1;
    const rivet = (Math.abs(fv - 0.08) < 0.012 || Math.abs(fv - 0.92) < 0.012) && Math.abs(fract(fu * 4) - 0.5) < 0.08;
    return shade(b, (rivet ? 0.7 : rib) * (0.94 + fbm(u, v, 141) * 0.1));
  },
  snowcrete: (u, v, b, a) => {
    const patch = clamp01((noise(u, v, 4, 153) - 0.55) * 6);
    const speck = hash(Math.floor(u * 96), Math.floor(v * 96), 155) > 0.9 ? 0.5 : 0;
    return mix(shade(b, 0.85 + fbm(u, v, 151) * 0.3), a, Math.max(patch, speck) * 0.9);
  },
  frostrock: (u, v, b, a) => {
    const w = v * 5 + noise(u, v, 4, 161) * 0.8;
    const layer = (Math.floor(w) % 5 + 5) % 5;
    const c = shade(b, 0.75 + hash(layer, 1, 163) * 0.35 + fbm(u, v, 165) * 0.15);
    const band = fract(w);
    return mix(c, a, (band > 0.82 ? clamp01((band - 0.82) * 8) * 0.85 : 0) + (fbm(u, v, 167) > 0.7 ? 0.25 : 0));
  },
  decking: deckingPaint,
  ashlar: ashlarPaint,
  pebbles: pebblePaint,
  corrugated: corrugatedPaint,
  lapboards: lapboardPaint,
  // Two horizontal bands a repeat (a lighthouse's red and white).
  bands: (u, v, b, a) => shade(fract(v) < 0.5 ? b : a, 0.92 + fbm(u, v, 147) * 0.1),
  sandstone_ashlar: sandstoneAshlarPaint,
  stucco: stuccoPaint,
  scales: scalesPaint,
  zellige: zelligePaint,
  flags: flagsPaint,
  rug: rugPaint,
  lattice: latticePaint,
  slabs: slabPaint,
  fret: fretPaint,
  relief: reliefPaint,
  inlay: inlayPaint,
  roots: rootPaint,
  thatch: thatchPaint,
  weave: (u, v, b, a) => {
    const n = 24;
    const cu = Math.floor(u * n);
    const cv = Math.floor(v * n);
    const over = (cu + cv) % 2 === 0;
    const f = over ? fract(u * n) : fract(v * n);
    return mix(b, a, 0.25 + Math.sin(f * Math.PI) * -0.25 + (over ? 0 : 0.25));
  }
};
const cache = /* @__PURE__ */ new Map();
const FINE_PATTERNS = /* @__PURE__ */ new Set(["glyphs", "glyphs_painted", "mosaic", "cobbles", "timber", "pantiles", "decking", "pebbles", "ice", "prefab", "sandstone_ashlar", "scales", "zellige", "rug", "lattice", "fret", "relief", "inlay", "roots", "slabs", "sandbags", "parking_bays", "tactile", "graffiti", "spalled_plaster"]);
const patternSize = (def) => FINE_PATTERNS.has(def.pattern) ? 256 : 128;
function materialPixels(def, size = 128) {
  const key = `${def.id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const paint = PAINTERS[def.pattern];
  const base = hex(def.base);
  const accent = hex(def.accent);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = paint((x + 0.5) / size, (y + 0.5) / size, base, accent);
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, c[0]));
      data[i + 1] = Math.max(0, Math.min(255, c[1]));
      data[i + 2] = Math.max(0, Math.min(255, c[2]));
      data[i + 3] = 255;
    }
  }
  cache.set(key, data);
  return data;
}
function materialThumbnail(def, tint = null, size = 48) {
  if (def.texture) return versioned(`${"/"}textures/${def.texture}_color.jpg`);
  const px = materialPixels(def, size);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const t = tint ? hex(tint) : null;
  for (let i = 0; i < px.length; i += 4) {
    img.data[i] = t ? px[i] * t[0] / 255 : px[i];
    img.data[i + 1] = t ? px[i + 1] * t[1] / 255 : px[i + 1];
    img.data[i + 2] = t ? px[i + 2] * t[2] / 255 : px[i + 2];
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
function levelMipBias(devicePixelRatio, renderRatio) {
  const shown = devicePixelRatio / Math.max(renderRatio, 0.05);
  return shown <= 1.5 ? 0 : Math.min(1, Math.round(Math.log2(shown / 1.5) * 100) / 100);
}
const MERGE_CHUNK = 128;
class LevelArrayPlugin extends MaterialPluginBase {
  constructor(material, colors, normals, mipBias = 0) {
    super(material, "LevelArray", 200, { LEVELARRAY: false }, true, true);
    this.colors = colors;
    this.normals = normals;
    this.mipBias = mipBias;
  }
  colors;
  normals;
  mipBias;
  getClassName() {
    return "LevelArrayPlugin";
  }
  prepareDefines(defines) {
    defines["LEVELARRAY"] = true;
  }
  getAttributes(attributes) {
    attributes.push("levelA", "levelB");
  }
  getSamplers(samplers) {
    samplers.push("levelColors", "levelNormals");
  }
  bindForSubMesh(uniformBuffer) {
    uniformBuffer.setTexture("levelColors", this.colors);
    uniformBuffer.setTexture("levelNormals", this.normals ?? this.colors);
  }
  getActiveTextures(active) {
    active.push(this.colors);
    if (this.normals) active.push(this.normals);
  }
  hasTexture(texture) {
    return texture === this.colors || texture === this.normals;
  }
  getCustomCode(shaderType) {
    const bias = this.mipBias > 0 ? `,${this.mipBias.toFixed(2)}` : "";
    if (shaderType === "vertex") {
      return {
        CUSTOM_VERTEX_DEFINITIONS: "attribute vec4 levelA;\nattribute vec4 levelB;\nvarying vec4 vLevelA;\nvarying vec4 vLevelB;",
        CUSTOM_VERTEX_MAIN_END: "vLevelA=levelA;\nvLevelB=levelB;"
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: "uniform highp sampler2DArray levelColors;\nuniform highp sampler2DArray levelNormals;\nvarying vec4 vLevelA;\nvarying vec4 vLevelB;",
      // Tint: the per-style material's diffuse colour.
      "!vec3 diffuseColor=vDiffuseColor\\.rgb;": "vec3 diffuseColor=vLevelA.rgb;",
      // Colour texel from the surface's layer.
      "!baseColor=TEXRD\\(diffuseSampler,vDiffuseUV\\+uvOffset\\);": `baseColor=texture(levelColors,vec3(vDiffuseUV+uvOffset,vLevelA.w)${bias});`,
      // Normal-map texel from the surface's layer (a surface without one stays flat). Sampled on every pixel, then
      // chosen: a texture lookup inside a branch that differs between neighbouring pixels picks its mip level from
      // undefined derivatives (GLSL ES 3.0), which some phone GPUs show as sparkling.
      "!normalW=perturbNormal\\(TBN,TEXRD\\(bumpSampler,vBumpUV\\+uvOffset\\)\\.xyz,vBumpInfos\\.y\\);": `normalW=perturbNormal(TBN,mix(texture(levelNormals,vec3(vBumpUV+uvOffset,max(vLevelB.x,0.0))${bias}).xyz,vec3(0.5,0.5,1.0),step(vLevelB.x,-0.5)),vBumpInfos.y);`,
      // Specular colour and power.
      "!float glossiness=vSpecularColor\\.a;vec3 specularColor=vSpecularColor\\.rgb;": "float glossiness=vLevelB.z;vec3 specularColor=vec3(vLevelB.y);"
    };
  }
}
function planLayers(sources) {
  const groups = /* @__PURE__ */ new Map();
  for (const s of sources) {
    let g = groups.get(s.size);
    if (!g) groups.set(s.size, g = { sources: [], colorLayer: /* @__PURE__ */ new Map(), normalLayer: /* @__PURE__ */ new Map() });
    g.sources.push(s);
    if (!g.colorLayer.has(s.key)) g.colorLayer.set(s.key, g.colorLayer.size);
    if (s.normal && !g.normalLayer.has(s.key)) g.normalLayer.set(s.key, g.normalLayer.size);
  }
  return groups;
}
function mergeGeometry(group, read) {
  const chunks = /* @__PURE__ */ new Map();
  for (const s of group.sources) {
    const g = read(s.mesh);
    if (!g) continue;
    const { positions: pos, normals: nrm, uvs, indices: idx } = g;
    const colorLayer = group.colorLayer.get(s.key);
    const normalLayer = s.normal ? group.normalLayer.get(s.key) : -1;
    const remap = /* @__PURE__ */ new Map();
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const i0 = idx[t];
      const i1 = idx[t + 1];
      const i2 = idx[t + 2];
      const cx = (pos[i0 * 3] + pos[i1 * 3] + pos[i2 * 3]) / 3;
      const cz = (pos[i0 * 3 + 2] + pos[i1 * 3 + 2] + pos[i2 * 3 + 2]) / 3;
      const key = `${Math.floor(cx / MERGE_CHUNK)}:${Math.floor(cz / MERGE_CHUNK)}`;
      let c = chunks.get(key);
      if (!c) chunks.set(key, c = { positions: [], normals: [], uvs: [], a: [], b: [], indices: [] });
      let map = remap.get(key);
      if (!map) remap.set(key, map = /* @__PURE__ */ new Map());
      for (const v of [i0, i1, i2]) {
        let at = map.get(v);
        if (at === void 0) {
          at = c.positions.length / 3;
          map.set(v, at);
          c.positions.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
          c.normals.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
          c.uvs.push(uvs[v * 2], uvs[v * 2 + 1]);
          c.a.push(s.tint.r, s.tint.g, s.tint.b, colorLayer);
          c.b.push(normalLayer, s.specular, s.power, 0);
        }
        c.indices.push(at);
      }
    }
  }
  return chunks;
}
function readWorld(m) {
  const p = m.getVerticesData(VertexBuffer.PositionKind);
  const n = m.getVerticesData(VertexBuffer.NormalKind);
  const uv = m.getVerticesData(VertexBuffer.UVKind);
  const idx = m.getIndices();
  if (!p || !n || !uv || !idx) return null;
  const world = m.computeWorldMatrix(true);
  const positions = new Float32Array(p);
  const normals = new Float32Array(n);
  if (!world.isIdentity()) {
    const v = new Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(p[i], p[i + 1], p[i + 2], world, v);
      positions[i] = v.x;
      positions[i + 1] = v.y;
      positions[i + 2] = v.z;
      Vector3.TransformNormalFromFloatsToRef(n[i], n[i + 1], n[i + 2], world, v);
      v.normalize();
      normals[i] = v.x;
      normals[i + 1] = v.y;
      normals[i + 2] = v.z;
    }
  }
  return { positions, normals, uvs: uv, indices: idx };
}
function standIn(scene, name, rgba) {
  const t = RawTexture.CreateRGBATexture(new Uint8Array(rgba), 1, 1, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
  t.name = name;
  return t;
}
function arrayTexture(scene, layers, size, name) {
  const data = new Uint8Array(size * size * 4 * layers.length);
  layers.forEach((l, i) => data.set(l.subarray(0, size * size * 4), i * size * size * 4));
  const t = new RawTexture2DArray(data, size, size, layers.length, Constants.TEXTUREFORMAT_RGBA, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  t.name = name;
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.anisotropicFilteringLevel = 8;
  return t;
}
async function mergeLevel(scene, sources, name = "map", mipBias = 0) {
  if (sources.length < 2) return null;
  const groups = planLayers(sources);
  const out = [];
  const merged = [];
  for (const [size, group] of groups) {
    if (group.sources.length < 2) continue;
    const byKey = new Map(group.sources.map((s) => [s.key, s]));
    const colorKeys = [...group.colorLayer.keys()];
    const normalKeys = [...group.normalLayer.keys()];
    const [colors, normals] = await Promise.all([Promise.all(colorKeys.map((k) => byKey.get(k).color())), Promise.all(normalKeys.map((k) => byKey.get(k).normal()))]);
    if (scene.isDisposed) return null;
    const colorArray = arrayTexture(scene, colors, size, `levelColors_${size}`);
    const normalArray = normals.length ? arrayTexture(scene, normals, size, `levelNormals_${size}`) : null;
    const mat = new StandardMaterial(`mat_level_${size}`, scene);
    mat.diffuseTexture = standIn(scene, "levelColorStandIn", [255, 255, 255, 255]);
    if (normalArray) {
      mat.bumpTexture = standIn(scene, "levelNormalStandIn", [128, 128, 255, 255]);
      mat.invertNormalMapY = true;
    }
    mat.diffuseColor = Color3.White();
    const first = group.sources[0].mesh.material;
    mat.zOffset = first?.zOffset ?? 0;
    mat.zOffsetUnits = first?.zOffsetUnits ?? 0;
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    new LevelArrayPlugin(mat, colorArray, normalArray, mipBias);
    for (const [key, c] of mergeGeometry(group, readWorld)) {
      if (!c.indices.length) continue;
      const mesh = new Mesh(`${name}_merged_${size}_${key}`, scene);
      const vd = new VertexData();
      vd.positions = c.positions;
      vd.normals = c.normals;
      vd.uvs = c.uvs;
      vd.indices = c.positions.length / 3 > 65535 ? new Uint32Array(c.indices) : c.indices;
      vd.applyToMesh(mesh);
      mesh.setVerticesData("levelA", new Float32Array(c.a), false, 4);
      mesh.setVerticesData("levelB", new Float32Array(c.b), false, 4);
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      mesh.metadata = { levelMerged: true };
      out.push(mesh);
    }
    for (const s of group.sources) merged.push(s.mesh);
  }
  return out.length ? { meshes: out, merged } : null;
}
async function jpegPixels(url, size) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.translate(0, size);
  ctx.scale(1, -1);
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return new Uint8Array(ctx.getImageData(0, 0, size, size).data.buffer);
}
function levelDepthBias(mat) {
  mat.zOffset = LEVEL_DEPTH_BIAS.factor;
  mat.zOffsetUnits = LEVEL_DEPTH_BIAS.units;
}
function boxFaces(b) {
  const faces = axisFaces(b.min, b.max);
  if (b.pitch || b.roll) {
    const q = boxQuat(b.yaw, b.pitch, b.roll);
    const cx2 = (b.min[0] + b.max[0]) / 2;
    const cy = (b.min[1] + b.max[1]) / 2;
    const cz2 = (b.min[2] + b.max[2]) / 2;
    const tilt = (p) => {
      const [x, y, z] = quatRotate(q, p[0] - cx2, p[1] - cy, p[2] - cz2);
      return [cx2 + x, cy + y, cz2 + z];
    };
    return faces.map(([c, n]) => [c.map(tilt), quatRotate(q, n[0], n[1], n[2]), c, n]);
  }
  if (!b.yaw) return faces.map(([c, n]) => [c, n, c, n]);
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const turn = (p) => {
    const [x, z] = yawXZ(p[0] - cx, p[2] - cz, b.yaw);
    return [cx + x, p[1], cz + z];
  };
  return faces.map(([c, n]) => {
    const [nx, nz] = yawXZ(n[0], n[2], b.yaw);
    return [c.map(turn), [nx, n[1], nz], c, n];
  });
}
class FaceBuffer {
  positions = [];
  normals = [];
  uvs = [];
  indices = [];
  /** Add one face (a convex polygon) with UVs in world metres divided by the material's repeat size. */
  /** `flat`/`fn`: the face before any turn, whose two axes perpendicular to the normal lay out the texture. */
  add(corners, n, uvScale, flat = corners, fn = n) {
    const base = this.positions.length / 3;
    corners.forEach((c, i) => {
      const f = flat[i];
      this.positions.push(c[0], c[1], c[2]);
      this.normals.push(n[0], n[1], n[2]);
      const u = fn[0] !== 0 ? f[2] : f[0];
      const v = fn[1] !== 0 ? f[2] : f[1];
      this.uvs.push(u * uvScale, v * uvScale);
    });
    for (let k = 1; k < corners.length - 1; k++) this.indices.push(base, base + k + 1, base + k);
  }
  toVertexData() {
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.normals = this.normals;
    vd.uvs = this.uvs;
    vd.indices = this.indices;
    return vd;
  }
}
function boxVertexData(boxes) {
  const buf = new FaceBuffer();
  for (const b of boxes) for (const [corners, n, flat, fn] of boxFaces(b)) buf.add(corners, n, 0.5, flat, fn);
  return buf.toVertexData();
}
function terrainStyle(material) {
  const def = coreMaterials.get(TERRAIN_SURFACES[material]) ?? coreMaterials.get("core.proto_floor");
  return { material: def, tint: material === "gravel" ? "#8f877b" : null };
}
const BLEND_SHARPNESS = 1.5;
const BLEND_CUTS = 3;
const KEEP_SQUARE = 48;
class MapStyler {
  /** `share`: reuse another styler's textures and materials (a second mesh set in the same scene, e.g. MapMaker's ghosted levels). */
  constructor(scene, share) {
    this.scene = scene;
    this.textures = share?.textures ?? /* @__PURE__ */ new Map();
    this.materials = share?.materials ?? /* @__PURE__ */ new Map();
    this.images = share?.images ?? /* @__PURE__ */ new Map();
  }
  scene;
  textures;
  materials;
  images;
  meshes = [];
  terrainMeshes = [];
  /** The surface style each level and terrain mesh is drawn in (for merging, levelMerge.ts). */
  styleOf = /* @__PURE__ */ new Map();
  build(doc, boxes, name = "map") {
    this.buildBoxes(doc, [...boxes, ...buildMapDecor(doc)], name);
    this.buildTerrain(doc, name);
    return this.meshes;
  }
  /**
   * Style exactly these boxes (no trim, no terrain), replacing this styler's previous box meshes.
   * Each face draws only where it can be seen and no other face shares its plane (visibleFaces:
   * the build-time pass that ended the z-fighting flicker). `faces`: those faces, already worked
   * out (MapMaker clips every level against all of them, then draws them in two sets).
   */
  buildBoxes(doc, boxes, name = "map", faces = visibleFaces(boxes), keep = false) {
    const tiles = new Map(doc.classicStructure.tiles.map((t) => [t.id, t]));
    if (keep !== false && this.faceInfoFor !== keep) {
      this.faceInfoFor = keep;
      this.faceInfo = /* @__PURE__ */ new WeakMap();
    }
    const groups = /* @__PURE__ */ new Map();
    for (const f of faces) {
      let info = keep !== false ? this.faceInfo.get(f) : void 0;
      if (!info) {
        const b = boxes[f.box];
        const tile = tiles.get(b.sourceId);
        const own = b.surface ? { material: coreMaterials.get(b.surface.material), tint: b.surface.tint } : null;
        const style = own?.material ? own : resolveSurface(doc, tile, faceSlot(b, f.normal));
        let key = styleKey(style);
        let a = 2166136261;
        let c = 16777619;
        if (keep !== false) {
          key += `@${Math.floor((b.min[0] + b.max[0]) / 2 / KEEP_SQUARE)},${Math.floor((b.min[2] + b.max[2]) / 2 / KEEP_SQUARE)}`;
          const mix2 = (n) => {
            const v = Math.round(n * 1e3) | 0;
            a = Math.imul(a ^ v, 16777619);
            c = Math.imul(c + v, 2246822519) ^ c >>> 13 | 0;
          };
          for (const p of f.corners) mix2(p[0]), mix2(p[1]), mix2(p[2]);
          for (const p of f.flat) mix2(p[0]), mix2(p[1]), mix2(p[2]);
          mix2(f.normal[0]), mix2(f.normal[1]), mix2(f.normal[2]);
          mix2(f.flatNormal[0]), mix2(f.flatNormal[1]), mix2(f.flatNormal[2]);
        }
        info = { key, style, a, c };
        if (keep !== false) this.faceInfo.set(f, info);
      }
      let g = groups.get(info.key);
      if (!g) groups.set(info.key, g = { style: info.style, faces: [], h1: 0, h2: 0 });
      g.faces.push(f);
      g.h1 = g.h1 + info.a | 0;
      g.h2 = g.h2 + info.c | 0;
    }
    const kept = /* @__PURE__ */ new Map();
    const old = this.meshes;
    this.meshes = [...groups.entries()].map(([key, g]) => {
      const sig = `${g.faces.length}:${g.h1}:${g.h2}`;
      const had = keep !== false ? this.boxMeshes.get(key) : void 0;
      if (had && had.sig === sig && !had.mesh.isDisposed()) {
        kept.set(key, had);
        return had.mesh;
      }
      const buf = new FaceBuffer();
      for (const f of g.faces) buf.add(f.corners, f.normal, 1 / g.style.material.scale, f.flat, f.flatNormal);
      const mesh = new Mesh(`${name}_${key}`, this.scene);
      buf.toVertexData().applyToMesh(mesh);
      mesh.material = this.material(g.style);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      this.styleOf.set(mesh, g.style);
      kept.set(key, { mesh, sig });
      return mesh;
    });
    const staying = new Set(this.meshes);
    for (const m of old) if (!staying.has(m)) m.dispose();
    this.boxMeshes = kept;
    return this.meshes;
  }
  /** The box meshes by style (and ground square), and what each was built from (buildBoxes with `keep`). */
  boxMeshes = /* @__PURE__ */ new Map();
  faceInfo = /* @__PURE__ */ new WeakMap();
  faceInfoFor = null;
  /**
   * Terrain: one mesh per ground material holding that material's cells, with
   * normals taken from the height grid so lighting runs smoothly across
   * material borders. Rebuilt on its own while MapMaker brushes are dragged.
   */
  /**
   * Draw a terrain finer than 2 m (map format v32, Change grid) at every `terrainDrawStep`-th vertex: the game sets 2 on
   * Low graphics (phones start there), a quarter of the vertices to draw. Collision and the navmesh always use every
   * vertex; the drawn surface leaves them only between the skipped vertices (on a grid made finer from a coarser one,
   * hardly at all).
   */
  terrainDrawStep = 1;
  /** The drawn cells a buried tunnel cut into (buildTerrain), for the soft paint borders to leave alone. */
  cutCells = /* @__PURE__ */ new Set();
  buildTerrain(doc, name = "map") {
    for (const m of this.terrainMeshes) m.dispose();
    this.terrainMeshes = [];
    const t = doc.terrain;
    if (!t) return;
    const s = t.spacing;
    const cols = t.cols;
    const rows = t.rows;
    const step = s < 2 && this.terrainDrawStep > 1 ? Math.round(this.terrainDrawStep) : 1;
    const take = (n) => {
      const out = [];
      for (let i = 0; i < n - 1; i += step) out.push(i);
      out.push(n - 1);
      return out;
    };
    const ci = take(cols);
    const ri = take(rows);
    const hy = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) hy[r * cols + c] = vertexY(t, c, r);
    const at = (c, r) => hy[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))];
    const nrm = new Float32Array(cols * rows * 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = -(at(c + 1, r) - at(c - 1, r)) / (2 * s);
        const nz = -(at(c, r + 1) - at(c, r - 1)) / (2 * s);
        const l = Math.hypot(nx, 1, nz);
        const i = (r * cols + c) * 3;
        nrm[i] = nx / l;
        nrm[i + 1] = 1 / l;
        nrm[i + 2] = nz / l;
      }
    }
    const byMaterial = /* @__PURE__ */ new Map();
    const dc = ci.length - 1;
    const cutBy = /* @__PURE__ */ new Map();
    const firstPast = (list, v) => {
      let i = 0;
      while (i < list.length - 1 && list[i + 1] <= v) i++;
      return i;
    };
    for (const cut of mapGroundBores(doc).cuts) {
      const fx0 = (cut.min[0] - t.origin[0]) / s;
      const fx1 = (cut.max[0] - t.origin[0]) / s;
      const fz0 = (cut.min[2] - t.origin[1]) / s;
      const fz1 = (cut.max[2] - t.origin[1]) / s;
      if (fx1 <= 0 || fz1 <= 0 || fx0 >= cols - 1 || fz0 >= rows - 1) continue;
      const c1 = Math.min(dc - 1, firstPast(ci, Math.ceil(fx1) - 1));
      const r1 = Math.min(ri.length - 2, firstPast(ri, Math.ceil(fz1) - 1));
      for (let r = firstPast(ri, Math.max(0, Math.floor(fz0))); r <= r1; r++) {
        for (let c = firstPast(ci, Math.max(0, Math.floor(fx0))); c <= c1; c++) {
          const list = cutBy.get(r * dc + c);
          if (list) list.push(cut);
          else cutBy.set(r * dc + c, [cut]);
        }
      }
    }
    this.cutCells.clear();
    for (let r = 0; r < ri.length - 1; r++) {
      for (let c = 0; c < dc; c++) {
        const m = t.materials[ri[r] * (cols - 1) + ci[c]];
        let list = byMaterial.get(m);
        if (!list) byMaterial.set(m, list = []);
        list.push(r * dc + c);
      }
    }
    for (const [m, cells] of byMaterial) {
      const material = TERRAIN_MATERIALS[m] ?? "grass";
      const style = terrainStyle(material);
      const def = style.material;
      const n = cells.length;
      const positions = new Float32Array(n * 12);
      const normals = new Float32Array(n * 12);
      const uvs = new Float32Array(n * 8);
      const indices = new Uint32Array(n * 6);
      const inv = 1 / def.scale;
      let k = 0;
      const cutPos = [];
      const cutNrm = [];
      const cutIdx = [];
      for (const i of cells) {
        const cc = i % dc;
        const rr = (i - cc) / dc;
        const cuts = cutBy.get(i);
        if (cuts) {
          const c0 = ci[cc];
          const c1 = ci[cc + 1];
          const r0 = ri[rr];
          const r1 = ri[rr + 1];
          const x0 = t.origin[0] + c0 * s;
          const z0 = t.origin[1] + r0 * s;
          const x1 = t.origin[0] + c1 * s;
          const z1 = t.origin[1] + r1 * s;
          const p00 = [x0, hy[r0 * cols + c0], z0];
          const p10 = [x1, hy[r0 * cols + c1], z0];
          const p01 = [x0, hy[r1 * cols + c0], z1];
          const p11 = [x1, hy[r1 * cols + c1], z1];
          const ta = [p00, p11, p01];
          const tb = [p00, p10, p11];
          const pa = cutGroundPolygon(ta, cuts);
          const pb = cutGroundPolygon(tb, cuts);
          if (!(pa.length === 1 && pa[0] === ta && pb.length === 1 && pb[0] === tb)) {
            this.cutCells.add(i);
            const n4 = [r0 * cols + c0, r0 * cols + c1, r1 * cols + c0, r1 * cols + c1];
            for (const poly of [...pa, ...pb]) {
              const first = cutPos.length / 3;
              for (const p of poly) {
                cutPos.push(p[0], p[1], p[2]);
                const u = (p[0] - x0) / (x1 - x0);
                const v = (p[2] - z0) / (z1 - z0);
                for (let d = 0; d < 3; d++) cutNrm.push(nrm[n4[0] * 3 + d] * (1 - u) * (1 - v) + nrm[n4[1] * 3 + d] * u * (1 - v) + nrm[n4[2] * 3 + d] * (1 - u) * v + nrm[n4[3] * 3 + d] * u * v);
              }
              for (let j = 1; j < poly.length - 1; j++) cutIdx.push(first, first + j, first + j + 1);
            }
            continue;
          }
        }
        for (let q = 0; q < 4; q++) {
          const vc = ci[cc + (q === 1 || q === 2 ? 1 : 0)];
          const vr = ri[rr + (q >= 2 ? 1 : 0)];
          const vi = vr * cols + vc;
          const x = t.origin[0] + vc * s;
          const z = t.origin[1] + vr * s;
          const p = (k * 4 + q) * 3;
          positions[p] = x;
          positions[p + 1] = hy[vi];
          positions[p + 2] = z;
          normals[p] = nrm[vi * 3];
          normals[p + 1] = nrm[vi * 3 + 1];
          normals[p + 2] = nrm[vi * 3 + 2];
          uvs[(k * 4 + q) * 2] = x * inv;
          uvs[(k * 4 + q) * 2 + 1] = z * inv;
        }
        const base = k * 4;
        indices.set([base, base + 1, base + 2, base, base + 2, base + 3], k * 6);
        k++;
      }
      const vd = new VertexData();
      if (k === n) {
        vd.positions = positions;
        vd.normals = normals;
        vd.uvs = uvs;
        vd.indices = indices;
      } else {
        const whole = k * 4;
        const extra = cutPos.length / 3;
        const pos = new Float32Array((whole + extra) * 3);
        pos.set(positions.subarray(0, whole * 3));
        pos.set(cutPos, whole * 3);
        const nor = new Float32Array((whole + extra) * 3);
        nor.set(normals.subarray(0, whole * 3));
        nor.set(cutNrm, whole * 3);
        const uv = new Float32Array((whole + extra) * 2);
        uv.set(uvs.subarray(0, whole * 2));
        for (let j = 0; j < extra; j++) {
          uv[(whole + j) * 2] = cutPos[j * 3] * inv;
          uv[(whole + j) * 2 + 1] = cutPos[j * 3 + 2] * inv;
        }
        const idx = new Uint32Array(k * 6 + cutIdx.length);
        idx.set(indices.subarray(0, k * 6));
        for (let j = 0; j < cutIdx.length; j++) idx[k * 6 + j] = whole + cutIdx[j];
        if (!idx.length) continue;
        vd.positions = pos;
        vd.normals = nor;
        vd.uvs = uv;
        vd.indices = idx;
      }
      const mesh = new Mesh(`${name}_terrain_${material}`, this.scene);
      vd.applyToMesh(mesh);
      mesh.material = this.material(style);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      this.styleOf.set(mesh, style);
      this.terrainMeshes.push(mesh);
    }
    if (this.terrainBlend && byMaterial.size > 1) this.buildTerrainBlend(t, name, ci, ri, hy, nrm);
  }
  /**
   * Blend the terrain's paint across cell borders (owner, 2026-11-10: painted paths read as chunky squares): the game
   * sets it off on Low graphics. Drawing only; the cells' materials (footsteps, bullets, the plan) are as painted.
   */
  terrainBlend = true;
  /**
   * Soft paint borders: over each cell, every other material painted on a neighbouring cell is drawn again, fading
   * from its share of the cells round each corner (half along a straight border, a quarter or three quarters at a
   * corner) to nothing at the corners it doesn't touch. Both sides of a border fade into each other, so the mix is
   * the same on either side of the cell edge: a path is a band that fades over a cell each way, not a row of squares.
   * One see-through mesh a material, on the very triangles of the ground under it (the same vertices and diagonal).
   */
  buildTerrainBlend(t, name, ci, ri, hy, nrm) {
    const cols = t.cols;
    const dc = ci.length - 1;
    const dr = ri.length - 1;
    const cell = (c, r) => c < 0 || r < 0 || c >= dc || r >= dr ? -1 : t.materials[ri[r] * (cols - 1) + ci[c]];
    const share = (m, vc, vr) => {
      let has = 0;
      let all = 0;
      for (let dz = -1; dz <= 0; dz++) {
        for (let dx = -1; dx <= 0; dx++) {
          const at = cell(vc + dx, vr + dz);
          if (at < 0) continue;
          all++;
          if (at === m) has++;
        }
      }
      return all ? has / all : 0;
    };
    const quads = /* @__PURE__ */ new Map();
    const others = /* @__PURE__ */ new Set();
    for (let r = 0; r < dr; r++) {
      for (let c = 0; c < dc; c++) {
        const own = cell(c, r);
        others.clear();
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) others.add(cell(c + dx, r + dz));
        others.delete(own);
        others.delete(-1);
        if (this.cutCells.has(r * dc + c)) continue;
        for (const m of others) {
          let list = quads.get(m);
          if (!list) quads.set(m, list = []);
          list.push(c, r);
        }
      }
    }
    const N = BLEND_CUTS;
    const side = N + 1;
    const perCell = side * side;
    for (const [m, list] of quads) {
      const material = TERRAIN_MATERIALS[m] ?? "grass";
      const style = terrainStyle(material);
      const inv = 1 / style.material.scale;
      const n = list.length / 2;
      const positions = new Float32Array(n * perCell * 3);
      const normals = new Float32Array(n * perCell * 3);
      const uvs = new Float32Array(n * perCell * 2);
      const colors = new Float32Array(n * perCell * 4);
      const indices = new Uint32Array(n * N * N * 6);
      for (let k = 0; k < n; k++) {
        const cc = list[k * 2];
        const rr = list[k * 2 + 1];
        const v00 = ri[rr] * cols + ci[cc];
        const v10 = ri[rr] * cols + ci[cc + 1];
        const v01 = ri[rr + 1] * cols + ci[cc];
        const v11 = ri[rr + 1] * cols + ci[cc + 1];
        const w00 = share(m, cc, rr);
        const w10 = share(m, cc + 1, rr);
        const w01 = share(m, cc, rr + 1);
        const w11 = share(m, cc + 1, rr + 1);
        const x0 = t.origin[0] + ci[cc] * t.spacing;
        const z0 = t.origin[1] + ri[rr] * t.spacing;
        const dx = (ci[cc + 1] - ci[cc]) * t.spacing;
        const dz = (ri[rr + 1] - ri[rr]) * t.spacing;
        const first = k * perCell;
        for (let b = 0; b <= N; b++) {
          for (let a = 0; a <= N; a++) {
            const u = a / N;
            const v = b / N;
            const at = first + b * side + a;
            const bil = (p00, p10, p01, p11) => p00 * (1 - u) * (1 - v) + p10 * u * (1 - v) + p01 * (1 - u) * v + p11 * u * v;
            const y = u >= v ? hy[v00] + u * (hy[v10] - hy[v00]) + v * (hy[v11] - hy[v10]) : hy[v00] + u * (hy[v11] - hy[v01]) + v * (hy[v01] - hy[v00]);
            positions[at * 3] = x0 + u * dx;
            positions[at * 3 + 1] = y;
            positions[at * 3 + 2] = z0 + v * dz;
            for (let d = 0; d < 3; d++) normals[at * 3 + d] = bil(nrm[v00 * 3 + d], nrm[v10 * 3 + d], nrm[v01 * 3 + d], nrm[v11 * 3 + d]);
            uvs[at * 2] = (x0 + u * dx) * inv;
            uvs[at * 2 + 1] = (z0 + v * dz) * inv;
            colors[at * 4] = colors[at * 4 + 1] = colors[at * 4 + 2] = 1;
            colors[at * 4 + 3] = Math.max(0, Math.min(1, (bil(w00, w10, w01, w11) - 0.5) * BLEND_SHARPNESS + 0.5));
          }
        }
        let o = k * N * N * 6;
        for (let b = 0; b < N; b++) {
          for (let a = 0; a < N; a++) {
            const p = first + b * side + a;
            indices[o++] = p;
            indices[o++] = p + 1;
            indices[o++] = p + side + 1;
            indices[o++] = p;
            indices[o++] = p + side + 1;
            indices[o++] = p + side;
          }
        }
      }
      const vd = new VertexData();
      vd.positions = positions;
      vd.normals = normals;
      vd.uvs = uvs;
      vd.colors = colors;
      vd.indices = indices;
      const mesh = new Mesh(`${name}_terrainblend_${material}`, this.scene);
      vd.applyToMesh(mesh);
      mesh.hasVertexAlpha = true;
      mesh.material = this.blendMaterial(style);
      mesh.alphaIndex = m;
      mesh.isPickable = false;
      mesh.metadata = { castsNoShadow: true };
      mesh.freezeWorldMatrix();
      this.terrainMeshes.push(mesh);
    }
  }
  /** A style's material for the soft paint borders: the same look, drawn just in front of the ground it lies on. */
  blendMaterial(style) {
    const key = `blend:${styleKey(style)}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = this.material(style).clone(`mat_${key}`);
      mat.zOffset = LEVEL_DEPTH_BIAS.factor / 2;
      mat.zOffsetUnits = LEVEL_DEPTH_BIAS.units / 2;
      this.materials.set(key, mat);
    }
    return mat;
  }
  /**
   * Level draw merging (levelMerge.ts, WebGL2): the level's and terrain's per-style meshes of every opaque, non-glowing
   * style become a few meshes over shared array textures, and the per-style meshes, and the materials and textures
   * nothing else uses, go. Resolves with how many draws the level was and is (null: nothing merged, all left as built).
   */
  async merge(name = "map", mipBias = 0) {
    const all = [...this.meshes, ...this.terrainMeshes].filter((m) => !m.isDisposed());
    const sources = this.mergeSources();
    const result = await mergeLevel(this.scene, sources, name, mipBias);
    if (!result || this.scene.isDisposed) return null;
    const names = result.merged.map((m) => m.name);
    for (const m of result.merged) {
      this.styleOf.delete(m);
      m.dispose();
    }
    this.meshes = [...this.meshes.filter((m) => !m.isDisposed()), ...result.meshes];
    this.terrainMeshes = this.terrainMeshes.filter((m) => !m.isDisposed());
    this.dropUnused();
    return { before: all.length, after: this.meshes.length + this.terrainMeshes.length, merged: names };
  }
  /** The level's and terrain's per-style meshes that can merge (opaque, not glowing), with their surfaces' textures. */
  mergeSources() {
    const all = [...this.meshes, ...this.terrainMeshes].filter((m) => !m.isDisposed());
    const sources = [];
    for (const mesh of all) {
      const style = this.styleOf.get(mesh);
      if (!style) continue;
      const def = style.material;
      if (def.emissive) continue;
      const tint = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      const specular = def.shine * 0.6;
      const power = 16 + def.shine * 96;
      if (def.texture) {
        const id = def.texture;
        const url = (map) => versioned(`${"/"}textures/${id}_${map}.jpg`);
        sources.push({ mesh, key: `img:${id}`, size: 512, color: () => jpegPixels(url("color"), 512), normal: () => jpegPixels(url("normal"), 512), tint, specular, power });
      } else {
        const size = patternSize(def);
        sources.push({ mesh, key: `pat:${def.id}`, size, color: async () => materialPixels(def, size), normal: null, tint, specular, power });
      }
    }
    return sources;
  }
  /** Materials and textures of this styler that nothing draws with any more (after a merge): freed, and made again if asked for. */
  dropUnused() {
    const used = /* @__PURE__ */ new Set();
    for (const [key, mat] of this.materials) {
      if (mat.getBindedMeshes().length) {
        for (const t of mat.getActiveTextures()) used.add(t);
        continue;
      }
      mat.dispose(false, false);
      this.materials.delete(key);
    }
    for (const mat of this.scene.materials) for (const t of mat.getActiveTextures()) used.add(t);
    for (const [key, t] of this.images) {
      if (used.has(t)) continue;
      t.dispose();
      this.images.delete(key);
    }
    for (const [key, t] of this.textures) {
      if (used.has(t)) continue;
      t.dispose();
      this.textures.delete(key);
    }
  }
  /** A library material with a tint (null: the theme's solids), for blocks drawn outside the level mesh. */
  surfaceMaterial(doc, material, tint) {
    const def = material ? coreMaterials.get(material) : void 0;
    return this.material(def ? { material: def, tint } : resolveSurface(doc, void 0, "solids"));
  }
  /** The material terrain of this kind is drawn in (the backdrop's ground uses it too). */
  groundMaterial(material) {
    return this.material(terrainStyle(material));
  }
  /** Metres per repeat of that ground's texture. */
  groundScale(material) {
    return terrainStyle(material).material.scale;
  }
  /** Sky colour of the map's theme. */
  static skyColor(doc) {
    return Color3.FromHexString(coreThemes.get(doc.classicStructure.theme)?.sky ?? "#85a0b8");
  }
  texture(def) {
    let tex = this.textures.get(def.id);
    if (!tex) {
      const size = patternSize(def);
      tex = RawTexture.CreateRGBATexture(materialPixels(def, size), size, size, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
      tex.wrapU = Texture.WRAP_ADDRESSMODE;
      tex.wrapV = Texture.WRAP_ADDRESSMODE;
      tex.anisotropicFilteringLevel = 8;
      this.textures.set(def.id, tex);
    }
    return tex;
  }
  /** A scanned texture map (shared JPEG), cached per scene. */
  image(id, map) {
    const key = `${id}_${map}`;
    let tex = this.images.get(key);
    if (!tex) {
      tex = new Texture(versioned(`${"/"}textures/${key}.jpg`), this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
      tex.anisotropicFilteringLevel = 8;
      this.images.set(key, tex);
    }
    return tex;
  }
  material(style) {
    const key = styleKey(style);
    let mat = this.materials.get(key);
    if (!mat) {
      const def = style.material;
      mat = new StandardMaterial(`mat_${key}`, this.scene);
      levelDepthBias(mat);
      if (def.texture) {
        mat.diffuseTexture = this.image(def.texture, "color");
        mat.bumpTexture = this.image(def.texture, "normal");
        mat.invertNormalMapY = true;
      } else mat.diffuseTexture = this.texture(def);
      mat.diffuseColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      mat.specularColor = new Color3(def.shine * 0.6, def.shine * 0.6, def.shine * 0.6);
      mat.specularPower = 16 + def.shine * 96;
      if (def.emissive && def.texture) {
        mat.emissiveTexture = this.image(def.texture, "emission");
        mat.emissiveColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      } else if (def.emissive) {
        mat.emissiveTexture = this.texture(def);
        mat.emissiveColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      }
      this.materials.set(key, mat);
    }
    return mat;
  }
}
const mapMeshes = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  MapStyler,
  boxVertexData,
  levelDepthBias
}, Symbol.toStringTag, { value: "Module" }));
export {
  MapStyler as M,
  mapMeshes as a,
  boxVertexData as b,
  coplanarOverlaps as c,
  faceSlot as f,
  isDrawnBox as i,
  levelMipBias as l,
  materialThumbnail as m,
  propFlushLifts as p,
  resolveSurface as r,
  styleKey as s,
  visibleFaces as v
};
