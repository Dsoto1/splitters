import type { CockpitDef, CockpitSurface, V3 } from '../content/cockpits.ts';

/**
 * Builds an in-house cockpit (content/cockpits.ts) as plain vertex arrays, one group per surface, with no engine
 * types, so it can be tested and measured anywhere. Positions are in the mount's frame; the steering wheel and the
 * gauge needles come apart (they turn: about `axis` through `origin`, their positions taken relative to `origin`).
 * Triangles wind the engine's way round (Babylon: clockwise seen from the front).
 */

export interface Geometry {
  positions: number[];
  normals: number[];
  uvs: number[];
  /** RGBA, linear. */
  colors: number[];
  indices: number[];
}

export type Groups = Partial<Record<CockpitSurface, Geometry>>;

/** A part that turns about `axis` through `origin` (positions relative to `origin`). */
export interface Turning {
  origin: V3;
  axis: V3;
  groups: Groups;
}

export interface Needle extends Turning {
  drive: 'speed' | 'revs';
  /** Full scale for speed (m/s). */
  max: number;
}

export interface BuiltCockpit {
  groups: Groups;
  wheel: (Turning & { lock: number }) | null;
  needles: Needle[];
}

/** A needle's angle (radians, clockwise from straight up as the driver sees it) at `value` of full scale (0..1). */
export const GAUGE_SWEEP = (Math.PI * 3) / 4;
export function needleAngle(value: number): number {
  return -GAUGE_SWEEP + 2 * GAUGE_SWEEP * Math.min(1, Math.max(0, value));
}

// ---- small vector helpers (tuples) ----
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a);
  return l > 1e-9 ? mul(a, 1 / l) : [0, 1, 0];
};
const mirrorX = (a: V3): V3 => [-a[0], a[1], a[2]];

/** Rotation about X, then Y, then Z (rot[0] > 0 leans +Y toward +Z). Returns the rotated basis vectors. */
function eulerBasis(rot: V3 | undefined): [V3, V3, V3] {
  const [rx, ry, rz] = rot ?? [0, 0, 0];
  const turn = (v: V3): V3 => {
    let [x, y, z] = v;
    // About X: +Y toward +Z.
    [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    // About Y: +Z toward +X.
    [z, x] = [z * Math.cos(ry) - x * Math.sin(ry), z * Math.sin(ry) + x * Math.cos(ry)];
    // About Z: +X toward +Y.
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    return [x, y, z];
  };
  return [turn([1, 0, 0]), turn([0, 1, 0]), turn([0, 0, 1])];
}

/** Two unit vectors across `n` (the first as near to +X as can be, the second toward +Y), so dials sit upright. */
function across(n: V3): [V3, V3] {
  const f = norm(n);
  let right = sub([1, 0, 0], mul(f, f[0]));
  if (len(right) < 1e-3) right = sub([0, 0, 1], mul(f, f[2]));
  right = norm(right);
  let up = norm(cross(f, right));
  if (up[1] < 0) up = mul(up, -1);
  return [right, up];
}

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

class Builder {
  readonly groups: Groups = {};

  private geo(surface: CockpitSurface): Geometry {
    return (this.groups[surface] ??= { positions: [], normals: [], uvs: [], colors: [], indices: [] });
  }

  /** Adds vertices (position, normal, uv) and triangles given counter-clockwise seen from outside; stored the engine's way. */
  mesh(surface: CockpitSurface, color: V3, verts: { p: V3; n: V3; uv: [number, number] }[], tris: number[]): void {
    const g = this.geo(surface);
    const base = g.positions.length / 3;
    const rgb = color.map(srgbToLinear);
    for (const v of verts) {
      g.positions.push(v.p[0], v.p[1], v.p[2]);
      g.normals.push(v.n[0], v.n[1], v.n[2]);
      g.uvs.push(v.uv[0], v.uv[1]);
      g.colors.push(rgb[0]!, rgb[1]!, rgb[2]!, 1);
    }
    for (let i = 0; i + 2 < tris.length; i += 3) g.indices.push(base + tris[i]!, base + tris[i + 2]!, base + tris[i + 1]!);
  }

  /** A round tube along `path`, its corners rounded at `bend`; `closed` joins the end to the start (a rim). */
  tube(surface: CockpitSurface, color: V3, path: V3[], r: number, bend = 0.1, closed = false, sides = 12): void {
    const pts = closed ? path : rounded(path, bend);
    const n = pts.length;
    if (n < 2) return;
    const tangent = (i: number): V3 => {
      const prev = closed ? pts[(i - 1 + n) % n]! : pts[Math.max(0, i - 1)]!;
      const next = closed ? pts[(i + 1) % n]! : pts[Math.min(n - 1, i + 1)]!;
      return norm(sub(next, prev));
    };
    // Parallel transport: each ring's frame is the last one turned onto the new tangent.
    let t = tangent(0);
    let u = across(t)[1];
    const verts: { p: V3; n: V3; uv: [number, number] }[] = [];
    const tris: number[] = [];
    let along = 0;
    const rings = closed ? n + 1 : n;
    for (let i = 0; i < rings; i++) {
      const k = i % n;
      const tk = tangent(k);
      u = norm(sub(u, mul(tk, dot(u, tk))));
      t = tk;
      const v = cross(t, u);
      if (i > 0) along += len(sub(pts[k]!, pts[(i - 1) % n]!));
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const dir = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
        verts.push({ p: add(pts[k]!, mul(dir, r)), n: dir, uv: [along * 4, s / sides] });
      }
      if (i > 0) {
        const a0 = (i - 1) * (sides + 1);
        const a1 = i * (sides + 1);
        for (let s = 0; s < sides; s++) tris.push(a0 + s, a0 + s + 1, a1 + s, a0 + s + 1, a1 + s + 1, a1 + s);
      }
    }
    this.mesh(surface, color, verts, tris);
    if (!closed) {
      this.cap(surface, color, pts[0]!, mul(tangent(0), -1), r, sides);
      this.cap(surface, color, pts[n - 1]!, tangent(n - 1), r, sides);
    }
  }

  /** A flat round end facing `n`. */
  private cap(surface: CockpitSurface, color: V3, c: V3, n: V3, r: number, sides: number): void {
    const [a, b] = across(n);
    const verts = [{ p: c, n, uv: [0.5, 0.5] as [number, number] }];
    const tris: number[] = [];
    for (let s = 0; s <= sides; s++) {
      const t = (s / sides) * Math.PI * 2;
      verts.push({ p: add(c, add(mul(a, Math.cos(t) * r), mul(b, Math.sin(t) * r))), n, uv: [0.5 + Math.cos(t) / 2, 0.5 + Math.sin(t) / 2] });
      if (s > 0) tris.push(0, s, s + 1);
    }
    // a × b = n here when (a, b) come from across(n) with b = n × a: counter-clockwise about n.
    if (dot(cross(a, b), n) < 0) for (let i = 0; i < tris.length; i += 3) [tris[i + 1], tris[i + 2]] = [tris[i + 2]!, tris[i + 1]!];
    this.mesh(surface, color, verts, tris);
  }

  /** A box with rounded edges about `c`, its sides along the basis `ax` (unit vectors), `half` its half sizes. */
  box(surface: CockpitSurface, color: V3, c: V3, half: V3, ax: [V3, V3, V3], round: number, seg = 2): void {
    const r = Math.max(0, Math.min(round, half[0], half[1], half[2]));
    const verts: { p: V3; n: V3; uv: [number, number] }[] = [];
    const tris: number[] = [];
    // Grid stops along one side: dense at the rounded edges.
    const stops = (h: number): number[] => {
      if (r <= 1e-5) return [-h, h];
      const out: number[] = [-h];
      for (let k = 1; k <= seg; k++) out.push(-h + r * (1 - Math.cos((k / seg) * (Math.PI / 2))));
      out.push(h - r);
      for (let k = seg - 1; k >= 0; k--) out.push(h - r * (1 - Math.cos((k / seg) * (Math.PI / 2))));
      return [...new Set(out.map((v) => Math.round(v * 1e6) / 1e6))];
    };
    const sx = stops(half[0]);
    const sy = stops(half[1]);
    const sz = stops(half[2]);
    // Six faces: (axis, sign, u, v) with u × v = sign · axis.
    const faces: [number, number, number, number][] = [
      [0, 1, 1, 2],
      [0, -1, 2, 1],
      [1, 1, 2, 0],
      [1, -1, 0, 2],
      [2, 1, 0, 1],
      [2, -1, 1, 0],
    ];
    const S = [sx, sy, sz];
    for (const [axis, sign, ua, va] of faces) {
      const us = S[ua]!;
      const vs = S[va]!;
      const base = verts.length;
      for (const vv of vs)
        for (const uu of us) {
          const q: V3 = [0, 0, 0];
          q[axis] = sign * half[axis]!;
          q[ua] = uu;
          q[va] = vv;
          const inner: V3 = [Math.max(-half[0] + r, Math.min(half[0] - r, q[0])), Math.max(-half[1] + r, Math.min(half[1] - r, q[1])), Math.max(-half[2] + r, Math.min(half[2] - r, q[2]))];
          let d = sub(q, inner);
          let local: V3;
          if (len(d) < 1e-7) {
            d = [0, 0, 0];
            d[axis] = sign;
            local = q;
          } else {
            d = norm(d);
            local = add(inner, mul(d, r));
          }
          const world = add(c, add(add(mul(ax[0], local[0]), mul(ax[1], local[1])), mul(ax[2], local[2])));
          const nw = norm(add(add(mul(ax[0], d[0]), mul(ax[1], d[1])), mul(ax[2], d[2])));
          verts.push({ p: world, n: nw, uv: [local[ua]! * 2, local[va]! * 2] });
        }
      const w = us.length;
      for (let j = 0; j + 1 < vs.length; j++)
        for (let i = 0; i + 1 < w; i++) {
          const a = base + j * w + i;
          // Each face's (u, v) pair is listed so that u × v points out of it: counter-clockwise seen from outside.
          tris.push(a, a + 1, a + w + 1, a, a + w + 1, a + w);
        }
    }
    this.mesh(surface, color, verts, tris);
  }

  /** A box from Euler angles. */
  eulerBox(surface: CockpitSurface, color: V3, c: V3, size: V3, rot: V3 | undefined, round: number | undefined, seg = 2): void {
    const half = mul(size, 0.5);
    this.box(surface, color, c, half, eulerBasis(rot), round ?? Math.min(0.03, Math.min(...size) / 4), seg);
  }

  /** A flat strap from `a` to `b`, `width` wide across, lying on a surface whose normal is `n`. */
  strap(surface: CockpitSurface, color: V3, a: V3, b: V3, width: number, thick: number, n: V3): void {
    const along = norm(sub(b, a));
    const side = norm(cross(n, along));
    const up = cross(along, side);
    this.box(surface, color, mul(add(a, b), 0.5), [width / 2, thick / 2, len(sub(b, a)) / 2], [side, up, along], 0, 1);
  }

  /** A cylinder whose round face looks along `face`, its front face at `c`. */
  disc(surface: CockpitSurface, color: V3, c: V3, face: V3, r: number, depth: number, sides = 20): void {
    const f = norm(face);
    const back = sub(c, mul(f, depth));
    this.tubeStraight(surface, color, back, c, r, sides);
  }

  private tubeStraight(surface: CockpitSurface, color: V3, a: V3, b: V3, r: number, sides: number): void {
    this.tube(surface, color, [a, b], r, 0, false, sides);
  }
}

/** A path with each inner corner replaced by a curve of radius about `bend` (never more than 45% of either leg). */
export function rounded(path: V3[], bend: number): V3[] {
  if (path.length < 3 || bend <= 0) return path.slice();
  const out: V3[] = [path[0]!];
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i]!;
    const d0 = sub(p, path[i - 1]!);
    const d1 = sub(path[i + 1]!, p);
    const l0 = len(d0);
    const l1 = len(d1);
    const u0 = mul(d0, 1 / l0);
    const u1 = mul(d1, 1 / l1);
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(u0, u1))));
    if (turn < 1e-3) {
      out.push(p);
      continue;
    }
    const cut = Math.min(bend * Math.tan(turn / 2), l0 * 0.45, l1 * 0.45);
    const a = sub(p, mul(u0, cut));
    const b = add(p, mul(u1, cut));
    const steps = Math.max(2, Math.ceil(turn / (Math.PI / 14)));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      // A quadratic curve through the corner's control point: close to a circular arc for these turns.
      out.push(add(add(mul(a, (1 - t) * (1 - t)), mul(p, 2 * (1 - t) * t)), mul(b, t * t)));
    }
  }
  out.push(path[path.length - 1]!);
  // Straight legs get a few rings too, so long bars shade evenly.
  const dense: V3[] = [out[0]!];
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1]!;
    const b = out[i]!;
    const parts = Math.max(1, Math.ceil(len(sub(b, a)) / 0.5));
    for (let k = 1; k <= parts; k++) dense.push(add(a, mul(sub(b, a), k / parts)));
  }
  return dense;
}

const centred = (g: Groups, o: V3): Groups => {
  for (const geo of Object.values(g)) for (let i = 0; i < geo.positions.length; i += 3) for (let k = 0; k < 3; k++) geo.positions[i + k]! -= o[k]!;
  return g;
};

/** Build a cockpit's static parts, its steering wheel and its needles. */
export function buildCockpit(def: CockpitDef): BuiltCockpit {
  const b = new Builder();
  const color = (name: string): V3 => def.palette[name] ?? [1, 0, 1];
  const each = <T extends { mirror?: boolean }>(list: T[], fn: (item: T, m: (v: V3) => V3, flip: boolean) => void): void => {
    for (const item of list) {
      fn(item, (v) => v, false);
      if (item.mirror) fn(item, mirrorX, true);
    }
  };

  each(def.tubes, (t, m) => b.tube(t.surface ?? 'paint', color(t.color), t.path.map(m), t.r, t.bend ?? 0.1));
  each(def.boxes, (x, m, flip) => {
    const rot = x.rot && flip ? ([x.rot[0], -x.rot[1], -x.rot[2]] as V3) : x.rot;
    b.eulerBox(x.surface ?? 'plastic', color(x.color), m(x.at), x.size, rot, x.round);
  });
  each(def.discs, (d, m) => b.disc(d.surface ?? 'plastic', color(d.color), m(d.at), m(d.face), d.r, d.depth));
  each(def.seats, (s, m) => seat(b, color, { ...s, at: m(s.at) }));
  for (const sw of def.switches) {
    const [right, up] = across(sw.face);
    const f = norm(sw.face);
    for (let i = 0; i < sw.count; i++) {
      const at = add(sw.at, mul(right, (i - (sw.count - 1) / 2) * sw.gap));
      b.disc('metal', color('steel'), add(at, mul(f, 0.006)), f, 0.008, 0.006, 10);
      // The lever, flicked up or down.
      const tip = add(add(at, mul(f, 0.03)), mul(up, i % 2 ? 0.012 : -0.012));
      b.tube('metal', color('steel'), [add(at, mul(f, 0.004)), tip], 0.0035, 0, false, 6);
    }
  }

  const needles: Needle[] = [];
  each(def.gauges, (g, m) => {
    const at = m(g.at);
    const f = norm(m(g.face));
    const [right, up] = across(f);
    b.disc('plastic', color('dash'), add(at, mul(f, 0.012)), f, g.r * 1.18, 0.03, 24);
    b.disc('plastic', [0.02, 0.02, 0.022], add(at, mul(f, 0.014)), f, g.r, 0.004, 24);
    // Ticks round the dial, the start and end ones longer.
    const ticks = 10;
    for (let i = 0; i <= ticks; i++) {
      const ang = needleAngle(i / ticks);
      const dir = add(mul(up, Math.cos(ang)), mul(right, Math.sin(ang)));
      const major = i % 5 === 0;
      const a = add(add(at, mul(f, 0.0155)), mul(dir, g.r * (major ? 0.68 : 0.78)));
      const z = add(add(at, mul(f, 0.0155)), mul(dir, g.r * 0.92));
      b.strap('plastic', [0.92, 0.9, 0.84], a, z, major ? 0.005 : 0.003, 0.0015, f);
    }
    if (!g.needle) return;
    const nb = new Builder();
    const front = add(at, mul(f, 0.019));
    nb.strap('plastic', [0.95, 0.38, 0.1], sub(front, mul(up, g.r * 0.18)), add(front, mul(up, g.r * 0.85)), 0.004, 0.002, f);
    nb.disc('metal', color('steel'), add(front, mul(f, 0.003)), f, g.r * 0.12, 0.006, 12);
    needles.push({ origin: at, axis: f, groups: centred(nb.groups, at), drive: g.needle, max: g.max ?? 20 });
  });

  let wheel: BuiltCockpit['wheel'] = null;
  const w = def.wheel;
  if (w) {
    const toward = norm(w.toward);
    const [right, up] = across(toward);
    const wb = new Builder();
    const rim: V3[] = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      rim.push(add(w.at, add(mul(right, Math.cos(a) * w.r), mul(up, Math.sin(a) * w.r))));
    }
    wb.tube('plastic', color('rubber'), rim, w.grip, 0, true, 12);
    // Spokes dished toward the dash at the hub; the hub and its cap.
    const hub = sub(w.at, mul(toward, 0.03));
    for (const a of w.spokes) {
      const dir = add(mul(up, Math.cos(a)), mul(right, Math.sin(a)));
      wb.tube('metal', color('steel'), [add(hub, mul(dir, 0.04)), add(w.at, mul(dir, w.r - w.grip * 0.5))], 0.009, 0, false, 8);
    }
    wb.disc('plastic', color('rubber'), add(hub, mul(toward, 0.025)), toward, 0.05, 0.05, 20);
    wb.disc('metal', color('steel'), add(hub, mul(toward, 0.03)), toward, 0.022, 0.006, 16);
    wheel = { origin: w.at, axis: toward, groups: centred(wb.groups, w.at), lock: w.lock };
    // The column into the dash does not turn.
    b.tube('plastic', color('dash'), [sub(hub, mul(toward, 0.02)), sub(w.at, mul(toward, w.column))], 0.022, 0, false, 12);
  }
  return { groups: b.groups, wheel, needles };
}

/** A bucket seat with side bolsters and a headrest, on a shell, with an optional five-point harness. */
function seat(b: Builder, color: (name: string) => V3, s: { at: V3; recline: number; width?: number; depth?: number; harness?: boolean }): void {
  const w = s.width ?? 0.46;
  const depth = s.depth ?? 0.42;
  const c = s.at;
  // The backrest leans back: its up and its front.
  const bu: V3 = [0, Math.cos(s.recline), -Math.sin(s.recline)];
  const bf: V3 = [0, Math.sin(s.recline), Math.cos(s.recline)];
  const backAxes: [V3, V3, V3] = [[1, 0, 0], bu, bf];
  const flat: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const at = (x: number, upBy: number, fwd: number): V3 => add(c, add(add([x, 0, 0], mul(bu, upBy)), mul(bf, fwd)));
  const seatCol = color('seat');
  const bolster = color('bolster');
  // Cushion and its side bolsters.
  b.box('fabric', seatCol, add(c, [0, -0.035, depth / 2]), [w / 2 - 0.04, 0.045, depth / 2], flat, 0.035);
  for (const x of [-1, 1]) b.box('fabric', bolster, add(c, [x * (w / 2 - 0.04), -0.01, depth / 2 - 0.01]), [0.045, 0.06, depth / 2 - 0.01], flat, 0.035, 1);
  // Backrest, its bolsters, the headrest above with its harness slots.
  b.box('fabric', seatCol, at(0, 0.27, -0.045), [w / 2 - 0.04, 0.27, 0.045], backAxes, 0.035);
  for (const x of [-1, 1]) b.box('fabric', bolster, at(x * (w / 2 - 0.045), 0.23, -0.02), [0.045, 0.23, 0.075], backAxes, 0.035, 1);
  b.box('fabric', seatCol, at(0, 0.62, -0.05), [0.14, 0.1, 0.045], backAxes, 0.04, 1);
  // The shell under the cushion, down to the floor.
  b.box('plastic', color('shell'), add(c, [0, -0.13, depth / 2 - 0.02]), [w / 2 - 0.06, 0.06, depth / 2 - 0.04], flat, 0.02, 1);
  if (!s.harness) return;
  const strapCol = color('strap');
  const buckle = add(c, [0, 0.03, depth * 0.38]);
  for (const x of [-1, 1]) {
    // Over the shoulders from behind the backrest, down its front, to the buckle; the lap belt from the hips.
    const over = at(x * 0.075, 0.54, -0.1);
    const top = at(x * 0.075, 0.54, 0.008);
    const chest = at(x * 0.085, 0.2, 0.02);
    b.strap('fabric', strapCol, over, top, 0.045, 0.006, bu);
    b.strap('fabric', strapCol, top, chest, 0.045, 0.006, bf);
    b.strap('fabric', strapCol, chest, add(buckle, [x * 0.03, 0.01, -0.02]), 0.045, 0.006, norm(add(bf, [0, 0.6, 0])));
    b.strap('fabric', strapCol, add(c, [x * (w / 2 - 0.08), 0.03, 0.05]), add(buckle, [x * 0.035, 0, 0]), 0.045, 0.006, [0, 1, 0]);
  }
  b.strap('fabric', strapCol, add(c, [0, 0.012, depth * 0.85]), buckle, 0.04, 0.006, [0, 1, 0]);
  b.box('metal', color('buckle'), add(buckle, [0, 0.008, 0]), [0.035, 0.008, 0.035], flat, 0.008, 1);
}

/** Triangles in a build (for budgets and tests). */
export function triangleCount(g: Groups): number {
  return Object.values(g).reduce((n, geo) => n + geo.indices.length / 3, 0);
}
