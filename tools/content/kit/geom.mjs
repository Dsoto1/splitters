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
