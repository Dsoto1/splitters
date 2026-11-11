// Shipping containers (kit-prop family `container`; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6 part 3): a steel box
// of corrugated walls between corner posts and top and bottom rails, corner castings, a ribbed roof, a pair of doors
// with locking bars at one end. It fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2], and runs along its longer
// ground axis; collision is the box (solid cover you can stand on).
//
// Level 1 keeps the frame and the doors' outline on flat walls; level 2 is the box in the paint's colour.

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { Mesh, box, clamp01, groundShade, hex, mix3, quadN, scale3, standIn } from './geom.mjs';

/**
 * Settings `g`: `post` (corner post width, m), `rail` (top and bottom rail height), `pitch` (one corrugation, m),
 * `deep` (how far it folds in), `casting` (corner casting size), `bars` (locking bars a door leaf). `look`: `paint`,
 * `frame` (hex: posts and rails, default a darker paint), `rust` (hex), `rusty` (0–1), `grime`, `band` (hex: a painted
 * band along both sides), `doorPaint` (hex).
 */
export function containerMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const paint = hex(look.paint);
  if (level >= 2) return standIn(size, scale3(paint, 0.85), paint);
  const alongZ = d >= w;
  const L = alongZ ? d : w;
  const T = alongZ ? w : d;
  const P = (u, y, v) => (alongZ ? [v, y, u] : [u, y, v]);
  const D = P;
  const m = new Mesh();
  // Solid: the box (a generator's boxes: tools/content/kitprops.mjs).
  m.boxes = [[-w / 2, 0, -d / 2, w / 2, h, d / 2]];
  const r = rng(seed);
  const n = noise3(seed);
  const rust = hex(look.rust ?? '#6e3f24');
  const rusty = look.rusty ?? 0.2;
  const grime = look.grime ?? 0.3;
  const frame = hex(look.frame ?? look.paint);
  const tone = (c, k = 1) => (p) => {
    // Rust gathers low down, along the bottom rail and in blotches; grime darkens towards the ground.
    const blot = clamp01(n(p[0] * 0.9, p[1] * 0.9, p[2] * 0.9) * 0.5 + 0.5);
    const low = clamp01(1 - p[1] / (h * 0.3));
    const t = clamp01(rusty * (blot * 1.3 - 0.35 + low * 0.5));
    return scale3(mix3(c, rust, t), k * groundShade(p[1], 0.5, 1 - grime * 0.45) * (1 - 0.07 * clamp01(n(p[0] * 6, p[1] * 6, p[2] * 6))));
  };
  const bx = (u0, y0, v0, u1, y1, v1, colour, skip = []) => box(m, P(Math.min(u0, u1), y0, Math.min(v0, v1)), P(Math.max(u0, u1), y1, Math.max(v0, v1)), colour, skip);
  const post = g.post;
  const rail = g.rail;
  const cast = level === 0 ? g.casting : 0;
  const frameTone = tone(scale3(frame, look.frame ? 1 : 0.82));
  // Corner posts and the four long rails, the frame the walls sit in.
  for (const su of [-1, 1])
    for (const sv of [-1, 1]) {
      const u0 = su * (L / 2 - post);
      const v0 = sv * (T / 2 - post);
      bx(u0, cast, v0, (su * L) / 2, h - cast, (sv * T) / 2, frameTone, cast ? ['ny', 'py'] : ['ny']);
      if (cast) {
        // Corner castings: the blocks a crane's twist-locks take, a shade darker.
        const c = tone(scale3(frame, 0.6));
        bx(su * (L / 2 - post * 1.15), 0, sv * (T / 2 - post * 1.15), (su * L) / 2, cast, (sv * T) / 2, c, ['ny']);
        bx(su * (L / 2 - post * 1.15), h - cast, sv * (T / 2 - post * 1.15), (su * L) / 2, h, (sv * T) / 2, c);
      }
    }
  for (const sv of [-1, 1]) {
    bx(-L / 2 + post, 0, sv * (T / 2 - post * 0.8), L / 2 - post, rail, (sv * T) / 2, frameTone, ['ny']);
    bx(-L / 2 + post, h - rail, sv * (T / 2 - post * 0.8), L / 2 - post, h, (sv * T) / 2, frameTone);
  }
  for (const su of [-1, 1]) {
    bx(su * (L / 2 - post * 0.8), 0, -T / 2 + post, (su * L) / 2, rail, T / 2 - post, frameTone, ['ny']);
    bx(su * (L / 2 - post * 0.8), h - rail, -T / 2 + post, (su * L) / 2, h, T / 2 - post, frameTone);
  }
  // The long walls: corrugated (a flat strip out, a slope in, a flat strip in, a slope out) between the rails.
  const deep = level === 0 ? g.deep : 0;
  const y0 = rail;
  const y1 = h - rail;
  const band = look.band ? hex(look.band) : null;
  const wallTone = tone(paint);
  const bandTone = band ? tone(band) : null;
  const span = L - post * 2;
  const folds = level === 0 ? Math.max(4, Math.round(span / g.pitch)) : 1;
  const step = span / folds;
  for (const sv of [-1, 1]) {
    const out = (sv * T) / 2 - sv * 0.004;
    const inn = out - sv * deep;
    const strip = (ua, va, ub, vb, normal) => {
      // Cut at the band's edges, so the band is painted across the folds.
      const cuts = band && level === 0 ? [y0, h * 0.42, h * 0.58, y1] : [y0, y1];
      for (let k = 0; k + 1 < cuts.length; k++) quadN(m, P(ua, cuts[k], va), P(ub, cuts[k], vb), P(ub, cuts[k + 1], vb), P(ua, cuts[k + 1], va), normal, band && cuts.length === 4 && k === 1 ? bandTone : wallTone);
    };
    for (let i = 0; i < folds; i++) {
      const u = -L / 2 + post + step * i;
      if (!deep) {
        strip(u, out, u + step, out, D(0, 0, sv));
        continue;
      }
      const a = step * 0.3;
      const s = step * 0.2;
      strip(u, out, u + a, out, D(0, 0, sv));
      strip(u + a, out, u + a + s, inn, D(0.5, 0, sv));
      strip(u + a + s, inn, u + 2 * a + s, inn, D(0, 0, sv));
      strip(u + 2 * a + s, inn, u + step, out, D(-0.5, 0, sv));
    }
  }
  // The closed end: corrugated the same way across the width (flat from the first lighter level on).
  const endFolds = level === 0 ? Math.max(3, Math.round((T - post * 2) / g.pitch)) : 1;
  const es = (T - post * 2) / endFolds;
  {
    const out = -L / 2 + 0.004;
    const inn = out + deep;
    const q = (va, ua, vb, ub, normal) => quadN(m, P(ua, y0, va), P(ub, y0, vb), P(ub, y1, vb), P(ua, y1, va), normal, wallTone);
    for (let i = 0; i < endFolds; i++) {
      const v = -T / 2 + post + es * i;
      if (!deep) {
        q(v, out, v + es, out, D(-1, 0, 0));
        continue;
      }
      const a = es * 0.3;
      const s = es * 0.2;
      q(v, out, v + a, out, D(-1, 0, 0));
      q(v + a, out, v + a + s, inn, D(-1, 0, 0.5));
      q(v + a + s, inn, v + 2 * a + s, inn, D(-1, 0, 0));
      q(v + 2 * a + s, inn, v + es, out, D(-1, 0, -0.5));
    }
  }
  // The door end: two leaves, a dark seam between them, locking bars with their handles and cams, hinges.
  {
    const face = L / 2 - 0.02;
    const doorPaint = tone(hex(look.doorPaint ?? look.paint), 0.96);
    const half = T / 2 - post;
    quadN(m, P(face, y0, -half), P(face, y0, half), P(face, y1, half), P(face, y1, -half), D(1, 0, 0), doorPaint);
    const dark = scale3(paint, 0.25);
    bx(face, y0, -0.008, face + 0.004, y1, 0.008, dark);
    if (level === 0) {
      const steel = tone(hex(look.steel ?? '#8b8d8f'));
      const bars = Math.max(1, g.bars ?? 2);
      for (const sv of [-1, 1])
        for (let k = 0; k < bars; k++) {
          const v = sv * half * ((k + 0.6) / (bars + 0.4));
          bx(face, y0 + 0.02, v - 0.018, face + 0.018, y1 - 0.02, v + 0.018, steel);
          // The handle, lying across at hand height, and the cams top and bottom.
          bx(face + 0.018, h * 0.42, v - 0.012, face + 0.02, h * 0.42 + 0.03, v + sv * -0.22, steel);
          for (const yy of [y0 + 0.02, y1 - 0.07]) bx(face, yy, v - 0.04, face + 0.02, yy + 0.05, v + 0.04, steel);
        }
      // Hinges down the outer edge of each leaf.
      for (const sv of [-1, 1]) for (let k = 0; k < 4; k++) bx(face, y0 + ((y1 - y0) * (k + 0.5)) / 4 - 0.04, sv * (half - 0.05), face + 0.014, y0 + ((y1 - y0) * (k + 0.5)) / 4 + 0.04, sv * half, steel);
    }
  }
  // The roof: a sheet just under the top rails' tops, with shallow ribs across it; the floor closes the box.
  const roofY = h - 0.012;
  const roofTone = tone(scale3(paint, 0.9));
  quadN(m, P(-L / 2 + post * 0.8, roofY, -T / 2 + post * 0.8), P(L / 2 - post * 0.8, roofY, -T / 2 + post * 0.8), P(L / 2 - post * 0.8, roofY, T / 2 - post * 0.8), P(-L / 2 + post * 0.8, roofY, T / 2 - post * 0.8), D(0, 1, 0), roofTone);
  if (level === 0) {
    const ribs = Math.max(3, Math.round(span / (g.pitch * 3)));
    for (let i = 0; i < ribs; i++) {
      const u = -L / 2 + post + (span * (i + 0.5)) / ribs;
      bx(u - 0.03, roofY, -T / 2 + post * 0.8, u + 0.03, h, T / 2 - post * 0.8, roofTone, ['ny']);
    }
    // A dent or two the seed picks: darker panels just proud of a wall (a knock, repainted).
    const patch = scale3(paint, 0.8);
    for (let i = 0; i < 2; i++) {
      const sv = r.next() < 0.5 ? -1 : 1;
      const u = r.range(-span * 0.35, span * 0.35);
      const y = r.range(h * 0.25, h * 0.7);
      const pw = r.range(0.25, 0.5);
      const pv = sv * (T / 2 - 0.002);
      quadN(m, P(u - pw, y, pv), P(u + pw, y, pv), P(u + pw, y + pw * 0.7, pv), P(u - pw, y + pw * 0.7, pv), D(0, 0, sv), tone(patch));
    }
  }
  quadN(m, P(-L / 2, 0, -T / 2), P(L / 2, 0, -T / 2), P(L / 2, 0, T / 2), P(-L / 2, 0, T / 2), D(0, -1, 0), scale3(paint, 0.3));
  return m;
}
