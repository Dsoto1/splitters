// Geometry for the kit-prop generators (docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6; docs/CONTENT_PIPELINE.md, "Kit
// props"): flat-shaded boards and boxes, turned (lathe) shells, and the colour helpers that give a piece its wear.
// Game space: +Y up, +Z forward, metres at scale 1; a piece stands on y = 0 centred on its footprint. Every colour is
// linear RGB. No randomness here: generators pass values drawn from their own seeded stream (env/rng.mjs).

import { Mesh, cross, norm, sub } from '../env/mesh.mjs';

export { Mesh };

/** sRGB hex ('#8a5f3a') → linear RGB. */
export function hex(h) {
  const v = parseInt(h.replace('#', ''), 16);
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [lin((v >> 16) & 255), lin((v >> 8) & 255), lin(v & 255)];
}

export const scale3 = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * One flat quad (a, b, c, d counter-clockwise seen from outside), its own normal, colour per corner (a function of the
 * corner's position, or one colour).
 */
export function quad(m, a, b, c, d, colour) {
  const n = norm(cross(sub(b, a), sub(d, a)));
  const col = typeof colour === 'function' ? colour : () => colour;
  const i = [a, b, c, d].map((p) => m.vertex(p, n, [0, 0], col(p, n)));
  m.quad(i[0], i[1], i[2], i[3]);
}

/** A flat quad facing `want` (a direction): its corners are taken in whichever order faces that way. */
export function quadN(m, a, b, c, d, want, colour) {
  const n = cross(sub(b, a), sub(d, a));
  if (dot3(n, want) < 0) quad(m, d, c, b, a, colour);
  else quad(m, a, b, c, d, colour);
}

/** A flat triangle facing `want`. */
export function triN(m, a, b, c, want, colour) {
  if (dot3(cross(sub(b, a), sub(c, a)), want) < 0) tri(m, a, c, b, colour);
  else tri(m, a, b, c, colour);
}

/** A flat triangle (counter-clockwise from outside). */
export function tri(m, a, b, c, colour) {
  const n = norm(cross(sub(b, a), sub(c, a)));
  const col = typeof colour === 'function' ? colour : () => colour;
  const i = [a, b, c].map((p) => m.vertex(p, n, [0, 0], col(p, n)));
  m.tri(i[0], i[1], i[2]);
}

const FACES = {
  px: (lo, hi) => [[hi[0], lo[1], hi[2]], [hi[0], lo[1], lo[2]], [hi[0], hi[1], lo[2]], [hi[0], hi[1], hi[2]]],
  nx: (lo, hi) => [[lo[0], lo[1], lo[2]], [lo[0], lo[1], hi[2]], [lo[0], hi[1], hi[2]], [lo[0], hi[1], lo[2]]],
  py: (lo, hi) => [[lo[0], hi[1], hi[2]], [hi[0], hi[1], hi[2]], [hi[0], hi[1], lo[2]], [lo[0], hi[1], lo[2]]],
  ny: (lo, hi) => [[lo[0], lo[1], lo[2]], [hi[0], lo[1], lo[2]], [hi[0], lo[1], hi[2]], [lo[0], lo[1], hi[2]]],
  pz: (lo, hi) => [[lo[0], lo[1], hi[2]], [hi[0], lo[1], hi[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]]],
  nz: (lo, hi) => [[hi[0], lo[1], lo[2]], [lo[0], lo[1], lo[2]], [lo[0], hi[1], lo[2]], [hi[0], hi[1], lo[2]]],
};

/**
 * An axis-aligned box from `lo` to `hi`, flat shaded. `skip` names faces left out (hidden against something):
 * 'px', 'nx', 'py', 'ny', 'pz', 'nz'. `colour(p, n)` or one colour.
 */
export function box(m, lo, hi, colour, skip = []) {
  for (const [k, f] of Object.entries(FACES)) {
    if (skip.includes(k)) continue;
    const [a, b, c, d] = f(lo, hi);
    quad(m, a, b, c, d, colour);
  }
}

/**
 * A board from `a` to `b` (its centre line), `w` wide across `side` (a unit vector at right angles to it) and `t`
 * thick along `out` (the third axis, pointing away from the piece). Its back (−out) and, if asked, its ends are left
 * out. Flat shaded. Used for diagonal braces, which no box can be.
 */
export function board(m, a, b, side, out, w, t, colour, { ends = true, back = false } = {}) {
  // (side, along, out) must be right-handed for the faces to face outward: swap the ends if not.
  if (dot3(cross(side, sub(b, a)), out) < 0) [a, b] = [b, a];
  const hw = w / 2;
  const off = (p, s, o) => [p[0] + side[0] * s + out[0] * o, p[1] + side[1] * s + out[1] * o, p[2] + side[2] * s + out[2] * o];
  const a0 = off(a, -hw, 0);
  const a1 = off(a, hw, 0);
  const a2 = off(a, hw, t);
  const a3 = off(a, -hw, t);
  const b0 = off(b, -hw, 0);
  const b1 = off(b, hw, 0);
  const b2 = off(b, hw, t);
  const b3 = off(b, -hw, t);
  // Front (out), the two edges, the ends, the back.
  quad(m, a3, a2, b2, b3, colour);
  quad(m, a2, a1, b1, b2, colour);
  quad(m, a0, a3, b3, b0, colour);
  if (ends) {
    quad(m, a0, a1, a2, a3, colour);
    quad(m, b3, b2, b1, b0, colour);
  }
  if (back) quad(m, b0, b1, a1, a0, colour);
}

/**
 * A turned shell: the profile [[radius, y], …] from bottom to top, swept round the y axis in `seg` sides (smooth
 * round, flat between profile rows when `hard` lists the row indices whose edges are creases). Faces outward.
 * `colour(p, n, row)` gives each vertex its colour.
 */
export function lathe(m, profile, seg, colour, { phase = 0, hard = [] } = {}) {
  const rows = [];
  // A row is split (two vertex rings) where the profile creases, so the faces either side keep their own normals.
  for (let r = 0; r < profile.length - 1; r++) {
    const [r0, y0] = profile[r];
    const [r1, y1] = profile[r + 1];
    const dr = r1 - r0;
    const dy = y1 - y0;
    const L = Math.hypot(dr, dy) || 1;
    // Outward normal of this band in the (radius, y) plane.
    const nr = dy / L;
    const ny = -dr / L;
    const ring = (rad, y) => {
      const ids = [];
      for (let s = 0; s <= seg; s++) {
        const a = phase + (s / seg) * Math.PI * 2;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const p = [c * rad, y, sn * rad];
        const n = norm([c * nr, ny, sn * nr]);
        ids.push(m.vertex(p, n, [0, 0], colour(p, n, r)));
      }
      return ids;
    };
    rows.push([ring(r0, y0), ring(r1, y1)]);
  }
  for (const [lo, hi] of rows) for (let s = 0; s < seg; s++) m.quad(lo[s], hi[s], hi[s + 1], lo[s + 1]);
  // Smooth across rows that are not creases: average the normals of the touching rings.
  for (let r = 0; r + 1 < rows.length; r++) {
    if (hard.includes(r + 1)) continue;
    const top = rows[r][1];
    const bot = rows[r + 1][0];
    for (let s = 0; s <= seg; s++) {
      const a = top[s] * 3;
      const b = bot[s] * 3;
      const n = norm([m.N[a] + m.N[b], m.N[a + 1] + m.N[b + 1], m.N[a + 2] + m.N[b + 2]]);
      for (const v of [a, b]) [m.N[v], m.N[v + 1], m.N[v + 2]] = n;
    }
  }
  return m;
}

/** A flat disc (a polygon of `seg` sides) at height y, radius r, facing up (or down). */
export function disc(m, r, y, seg, colour, { down = false, phase = 0 } = {}) {
  const n = down ? [0, -1, 0] : [0, 1, 0];
  const col = typeof colour === 'function' ? colour : () => colour;
  const c = m.vertex([0, y, 0], n, [0, 0], col([0, y, 0], n));
  const ids = [];
  for (let s = 0; s < seg; s++) {
    const a = phase + (s / seg) * Math.PI * 2;
    const p = [Math.cos(a) * r, y, Math.sin(a) * r];
    ids.push(m.vertex(p, n, [0, 0], col(p, n)));
  }
  for (let s = 0; s < seg; s++) {
    const a = ids[s];
    const b = ids[(s + 1) % seg];
    if (down) m.tri(c, a, b);
    else m.tri(c, b, a);
  }
}

/** Darker towards the ground (dirt and the contact shadow a piece sits in), as a factor for its colour. */
export const groundShade = (y, reach = 0.25, floor = 0.72) => floor + (1 - floor) * clamp01(y / reach);

/** A cheap stand-in box for the farthest level: the bounds, five faces (no bottom), one colour per face direction. */
export function standIn(size, top, sides) {
  const m = new Mesh();
  const [w, h, d] = size;
  box(m, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], (p, n) => (n[1] > 0.5 ? top : scale3(sides, groundShade(p[1], 0.3, 0.8))), ['ny']);
  return m;
}

/**
 * An oval (or many-sided) shell: the profile [[k, y], …] from bottom to top, each row the outline `rx` × `rz` (its
 * half widths) scaled by `k`, swept round (`cx`, `cz`) in `seg` sides. Smooth round the outline when `smooth`, flat
 * sides otherwise (a hexagon's); always creased between profile rows. Faces outward. `colour(p, n, row)`.
 */
export function ovalShell(m, profile, seg, colour, { rx = 1, rz = 1, cx = 0, cz = 0, phase = 0, smooth = true } = {}) {
  const col = typeof colour === 'function' ? colour : () => colour;
  const at = (a, k, y) => [cx + Math.cos(a) * rx * k, y, cz + Math.sin(a) * rz * k];
  for (let r = 0; r < profile.length - 1; r++) {
    const [k0, y0] = profile[r];
    const [k1, y1] = profile[r + 1];
    // The band's slope in (radius, y), taken on the mean half width.
    const dr = ((k1 - k0) * (rx + rz)) / 2;
    const dy = y1 - y0;
    const L = Math.hypot(dr, dy) || 1;
    const nr = dy / L;
    const ny = -dr / L;
    const normal = (a) => {
      const ex = Math.cos(a) / rx;
      const ez = Math.sin(a) / rz;
      const e = Math.hypot(ex, ez) || 1;
      return norm([(ex / e) * nr, ny, (ez / e) * nr]);
    };
    for (let s = 0; s < seg; s++) {
      const a0 = phase + (s / seg) * Math.PI * 2;
      const a1 = phase + ((s + 1) / seg) * Math.PI * 2;
      const n0 = smooth ? normal(a0) : normal((a0 + a1) / 2);
      const n1 = smooth ? normal(a1) : n0;
      const p = [at(a0, k0, y0), at(a0, k1, y1), at(a1, k1, y1), at(a1, k0, y0)];
      const ns = [n0, n0, n1, n1];
      const i = p.map((q, j) => m.vertex(q, ns[j], [0, 0], col(q, ns[j], r)));
      m.quad(i[0], i[1], i[2], i[3]);
    }
  }
  return m;
}

/** A flat oval (or many-sided) face at height y, half widths `rx` × `rz` round (`cx`, `cz`), facing up (or down). */
export function ovalDisc(m, rx, rz, y, seg, colour, { down = false, cx = 0, cz = 0, phase = 0 } = {}) {
  const n = down ? [0, -1, 0] : [0, 1, 0];
  const col = typeof colour === 'function' ? colour : () => colour;
  const c = m.vertex([cx, y, cz], n, [0, 0], col([cx, y, cz], n));
  const ids = [];
  for (let s = 0; s < seg; s++) {
    const a = phase + (s / seg) * Math.PI * 2;
    const p = [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz];
    ids.push(m.vertex(p, n, [0, 0], col(p, n)));
  }
  for (let s = 0; s < seg; s++) {
    const a = ids[s];
    const b = ids[(s + 1) % seg];
    if (down) m.tri(c, a, b);
    else m.tri(c, b, a);
  }
}

/**
 * A cushion or pillow lying flat: the box `lo`–`hi` with its top face drawn in by `inset` on every side (sloped
 * sides, no underside).
 */
export function pad(m, lo, hi, inset, colour) {
  const a = [[lo[0], lo[1], lo[2]], [hi[0], lo[1], lo[2]], [hi[0], lo[1], hi[2]], [lo[0], lo[1], hi[2]]];
  const b = [[lo[0] + inset, hi[1], lo[2] + inset], [hi[0] - inset, hi[1], lo[2] + inset], [hi[0] - inset, hi[1], hi[2] - inset], [lo[0] + inset, hi[1], hi[2] - inset]];
  quadN(m, b[0], b[1], b[2], b[3], [0, 1, 0], colour);
  const out = [[0, 0.3, -1], [1, 0.3, 0], [0, 0.3, 1], [-1, 0.3, 0]];
  for (let k = 0; k < 4; k++) quadN(m, a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k], out[k], colour);
}

// ---------------------------------------------------------------- bars, wire and turned parts along any axis (part 9)

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * A square bar `t` across from `p` to `q` (any direction): its four sides, and its ends when asked. `up` picks how
 * its section is turned (a side faces it as nearly as it can).
 */
export function bar(m, p, q, t, colour, { ends = false, up = [0, 1, 0] } = {}) {
  const dir = norm(sub(q, p));
  let side = cross(up, dir);
  if (Math.hypot(side[0], side[1], side[2]) < 1e-6) side = cross([1, 0, 0], dir);
  side = norm(side);
  const top = norm(cross(dir, side));
  const hh = t / 2;
  const at = (o, s, u) => [o[0] + (side[0] * s + top[0] * u) * hh, o[1] + (side[1] * s + top[1] * u) * hh, o[2] + (side[2] * s + top[2] * u) * hh];
  const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k < 4; k++) {
    const [s0, u0] = ring[k];
    const [s1, u1] = ring[(k + 1) % 4];
    const out = [side[0] * (s0 + s1) + top[0] * (u0 + u1), side[1] * (s0 + s1) + top[1] * (u0 + u1), side[2] * (s0 + s1) + top[2] * (u0 + u1)];
    quadN(m, at(p, s0, u0), at(p, s1, u1), at(q, s1, u1), at(q, s0, u0), out, colour);
  }
  if (ends) {
    quadN(m, at(p, -1, -1), at(p, 1, -1), at(p, 1, 1), at(p, -1, 1), [-dir[0], -dir[1], -dir[2]], colour);
    quadN(m, at(q, -1, -1), at(q, 1, -1), at(q, 1, 1), at(q, -1, 1), dir, colour);
  }
}

/** A flat strip `wd` wide across `side` from `p` to `q`, drawn on both faces (a wire seen from either side). */
export function ribbon(m, p, q, side, wd, colour) {
  const s = [side[0] * wd / 2, side[1] * wd / 2, side[2] * wd / 2];
  const a = [p[0] - s[0], p[1] - s[1], p[2] - s[2]];
  const b = [p[0] + s[0], p[1] + s[1], p[2] + s[2]];
  const c = [q[0] + s[0], q[1] + s[1], q[2] + s[2]];
  const d = [q[0] - s[0], q[1] - s[1], q[2] - s[2]];
  quad(m, a, b, c, d, colour);
  quad(m, d, c, b, a, colour);
}

/**
 * A wire panel between the bottom edge `b0`–`b1` and the top edge `t0`–`t1`: `nu` wires from bottom to top between
 * the ends, `nv` across between the edges, each `wd` wide, seen from both sides.
 */
export function wirePanel(m, b0, b1, t0, t1, nu, nv, wd, colour) {
  const across = norm(sub(b1, b0));
  const upward = norm(sub(t0, b0));
  for (let i = 1; i <= nu; i++) ribbon(m, lerp3(b0, b1, i / (nu + 1)), lerp3(t0, t1, i / (nu + 1)), across, wd, colour);
  for (let j = 1; j <= nv; j++) ribbon(m, lerp3(b0, t0, j / (nv + 1)), lerp3(b1, t1, j / (nv + 1)), upward, wd, colour);
}

/** The two axes across `axis` (0 x, 1 y, 2 z), in the order that keeps (u, v, axis) right-handed. */
const across = (axis) => (axis === 0 ? [1, 2] : axis === 1 ? [2, 0] : [0, 1]);

/**
 * A cylinder along `axis` (0 x, 1 y, 2 z) through (`a`, `b`) on the two other axes (y and z for x; z and x for y; x
 * and y for z), from `t0` to `t1`, radius `r`, in `seg` flat sides. `caps`: '0', '1' or '01' (the ends closed).
 * `inside`: faces inward (a bore). With `seg` a multiple of four it reaches ±r on both axes exactly.
 */
export function cyl(m, axis, a, b, t0, t1, r, seg, colour, { caps = '', inside = false } = {}) {
  const [u, v] = across(axis);
  const P = (ang, t, rad) => {
    const p = [0, 0, 0];
    p[axis] = t;
    p[u] = a + Math.cos(ang) * rad;
    p[v] = b + Math.sin(ang) * rad;
    return p;
  };
  const ax = (s) => {
    const n = [0, 0, 0];
    n[axis] = s;
    return n;
  };
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const out = [0, 0, 0];
    out[u] = Math.cos(mid) * (inside ? -1 : 1);
    out[v] = Math.sin(mid) * (inside ? -1 : 1);
    quadN(m, P(a0, t0, r), P(a1, t0, r), P(a1, t1, r), P(a0, t1, r), out, colour);
    if (caps.includes('0')) triN(m, P(0, t0, 0), P(a0, t0, r), P(a1, t0, r), ax(t0 < t1 ? -1 : 1), colour);
    if (caps.includes('1')) triN(m, P(0, t1, 0), P(a0, t1, r), P(a1, t1, r), ax(t0 < t1 ? 1 : -1), colour);
  }
}

/** A flat ring across `axis` at `t`, from radius `r0` to `r1` round (`a`, `b`), in `seg` sides, facing `dir` (±1) along the axis. */
export function annulus(m, axis, a, b, t, r0, r1, seg, dir, colour) {
  const [u, v] = across(axis);
  const P = (ang, rad) => {
    const p = [0, 0, 0];
    p[axis] = t;
    p[u] = a + Math.cos(ang) * rad;
    p[v] = b + Math.sin(ang) * rad;
    return p;
  };
  const n = [0, 0, 0];
  n[axis] = dir;
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    quadN(m, P(a0, r0), P(a1, r0), P(a1, r1), P(a0, r1), n, colour);
  }
}
