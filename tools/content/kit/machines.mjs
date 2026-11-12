// Factory machines (kit-prop families of part 10; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): a heavy press
// (`machine`: two housings joined by a bridge over an open working gap), a chamber machine with a port in each end
// (`windowmachine`), a round hopper on a plinth (`hopper`), a tall square hopper on a column (`tallhopper`), a
// hydraulic piston (`piston`), a scanner gate you walk through (`scanner`), a two-lever floor panel (`lever`) and a
// giant cog lying flat (`cog`). Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2].
//
// All collide as finer boxes (a generator's `boxes`: tools/content/kitprops.mjs), the same for each variant, a few
// for the many of the retired piece: what that left open stays open (the press's working gap, under the chamber
// machine's side guards, under the tall hopper's bin, the scanner's gate, the cog's bore); a hopper's bin, which was
// a pit nobody could climb out of, is loaded or lidded to its rim and solid. The boxes are in metres: a family here
// has one size, its retired prop's.
//
// Nothing here glows or blinks: a lens, a port or a lamp is dark paint with a few still shapes (CLAUDE.md,
// "Accessibility").
//
// Level 1 keeps the outline with far fewer triangles; level 2 is a stand-in of two or three boxes.

import { rng } from '../env/rng.mjs';
import { Mesh, bar, box, cyl, disc, groundShade, hex, lathe, mix3, quadN, scale3, triN } from './geom.mjs';

export const lerp = (p, q, t) => p + (q - p) * t;
/** Flat paint: lighter on top, darker underneath, towards the ground and on the sides that face ±z. */
export const tone = (c, grime = 0.25, k = 1) => (p, n) => scale3(c, k * groundShade(p[1], 0.3, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.07 : n[1] < -0.5 ? 0.62 : Math.abs(n[2]) > 0.5 ? 0.86 : 1));
/** Round parts: lit from above, darker below and towards the ground. */
export const round = (c, grime = 0.25, k = 1) => (p, n) => scale3(c, k * (0.84 + 0.22 * n[1]) * groundShade(p[1], 0.3, 1 - grime * 0.5));
/** A box given as a collision box is: [x0, y0, z0, x1, y1, z1]. */
export const solid = (m, b, colour, skip) => box(m, [b[0], b[1], b[2]], [b[3], b[4], b[5]], colour, skip);
/** Paint 2 mm off a face: at `z` facing `s` (±z), at `x` facing `s` (±x), at `y` facing up (or down). */
const E = 0.002;
export const onZ = (m, x0, y0, x1, y1, z, s, colour) => quadN(m, [x0, y0, z + s * E], [x1, y0, z + s * E], [x1, y1, z + s * E], [x0, y1, z + s * E], [0, 0, s], colour);
export const onX = (m, z0, y0, z1, y1, x, s, colour) => quadN(m, [x + s * E, y0, z0], [x + s * E, y0, z1], [x + s * E, y1, z1], [x + s * E, y1, z0], [s, 0, 0], colour);
export const onY = (m, x0, z0, x1, z1, y, colour, s = 1) => quadN(m, [x0, y + s * E, z0], [x1, y + s * E, z0], [x1, y + s * E, z1], [x0, y + s * E, z1], [0, s, 0], colour);
/** `n` bands of two colours in turn from `a` to `b`: `put(t0, t1, colour)` paints one. */
export const bands = (a, b, n, c0, c1, put) => {
  for (let k = 0; k < n; k++) put(lerp(a, b, k / n), lerp(a, b, (k + 1) / n), k % 2 ? c1 : c0);
};
const DARK = '#17191b';
const LAMPS = ['#7a2a26', '#8a6a2c', '#3f6a45', '#6a6e72'];

// ---------------------------------------------------------------- the heavy press

/**
 * A heavy press: a rear housing with a motor boss and a control box (−z), a front housing on a bed with a conduit
 * up its face (+z), a bridge and a top plate across them under a ridge, a guard hanging each side of the open gap
 * between. Settings `g`: `pipes` (0–2 pipes along the top plate), `vents` (slats in the rear housing), `stripes`
 * ('guards', 'bed', 'both', 'none': hazard bands), `panel` ('dials' or 'buttons'). `look`: `paint`, `base` (the
 * steps, the bed), `accent` (hazard bands, the control box), `dark`, `grime`.
 */
export function machineMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const paintC = hex(look.paint);
  const baseC = hex(look.base ?? '#2a2d31');
  const accC = hex(look.accent ?? '#c9a227');
  const darkC = hex(look.dark ?? DARK);
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-X, 0, -1.25, X, 1.9, -0.75], scale3(paintC, 0.85), ['ny']);
    solid(m, [-X, 0, 0.75, X, 1.9, 1.25], scale3(paintC, 0.85), ['ny']);
    solid(m, [-0.9, 1.6, -0.75, 0.9, h, 0.75], scale3(paintC, 0.95), ['nz', 'pz']);
    return m;
  }
  // Solid: the rear housing, its boss, step and control box; the bed, its step, the conduit, the front housing; the
  // bridge, the ridge and the top plate; the two guards. Open: the gap between the housings under the bridge, right
  // across under the guards and between them above.
  m.boxes = [
    [-X, 0, -1.15, X, 1.9, -0.75],
    [-0.4, 0, -Z, 0.4, 1.9, -0.75],
    [-0.9, 0, -1.25, 0.9, 0.4, -0.815],
    [-0.4, 0.9, -1.25, 0.7, 1.6, -0.815],
    [-X, 0, 0.815, X, 0.8, 1.15],
    [-0.815, 0, 1.15, 0.815, 0.4, 1.25],
    [-0.326, 0, 1.15, 0.326, 1.815, Z],
    [-X, 0.8, 0.75, X, 1.9, 1.15],
    [-X, 1.6, -0.75, X, 1.9, 0.75],
    [-0.4, 1.8, -1.25, 0.4, h, 1.25],
    [-0.9, 1.8, -1.05, 0.9, 2, 1.05],
    [0.8, 1, -0.75, 0.9, 1.6, 0.75],
    [-0.9, 1, -0.75, -0.8, 1.6, 0.75],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const paint = (k = 1) => tone(scale3(paintC, k * (1 + r.jitter(0.02))), grime);
  const base = tone(baseC, grime * 0.6);
  const acc = scale3(accC, 0.92);
  const dark = scale3(darkC, 1);
  // The rear housing, its boss, its step, its control box.
  solid(m, [-X, 0, -1.15, X, 1.9, -0.75], paint(), ['ny']);
  solid(m, [-0.4, 0, -Z, 0.4, 1.9, -1.15], paint(0.88), ['ny', 'pz']);
  solid(m, [-0.9, 0, -1.25, 0.9, 0.4, -1.15], base, ['ny', 'pz']);
  solid(m, [0.4, 0.9, -1.25, 0.7, 1.6, -1.15], tone(mix3(paintC, accC, 0.35), grime), ['nx', 'pz']);
  // The bed and its step, the front housing, the conduit up its face.
  solid(m, [-X, 0, 0.815, X, 0.8, 1.15], base, ['ny', 'py']);
  solid(m, [-0.815, 0, 1.15, 0.815, 0.4, 1.25], base, ['ny', 'nz']);
  solid(m, [-X, 0.8, 0.75, X, 1.9, 1.15], paint());
  solid(m, [-0.326, 0, 1.15, 0.326, 1.815, Z], paint(0.8), ['ny', 'nz']);
  // The bridge, the top plate, the ridge.
  solid(m, [-X, 1.6, -0.75, X, 1.9, 0.75], paint(0.96), ['nz', 'pz']);
  solid(m, [-0.9, 1.9, -1.05, 0.9, 2, 1.05], paint(0.9), ['ny']);
  solid(m, [-0.4, 1.9, -1.25, 0.4, h, 1.25], paint(0.82));
  for (const s of [-1, 1]) solid(m, [s > 0 ? 0.8 : -0.9, 1, -0.75, s > 0 ? 0.9 : -0.8, 1.6, 0.75], tone(mix3(paintC, darkC, 0.35), grime), ['py', 'nz', 'pz']);
  if (!fine) return m;
  const stripes = g.stripes ?? 'guards';
  // Slats in the rear housing, the control box's face, a dark panel on each wall of the gap.
  const nv = Math.max(0, g.vents ?? 5);
  for (let k = 0; k < nv; k++) onZ(m, -0.88, lerp(1.0, 1.6, k / nv), -0.5, lerp(1.0, 1.6, k / nv) + 0.05, -1.15, -1, dark);
  onZ(m, 0.43, 0.94, 0.67, 1.56, -1.25, -1, scale3(darkC, 1.6));
  for (let k = 0; k < 4; k++) {
    const y = 1.0 + k * 0.14;
    if ((g.panel ?? 'dials') === 'dials') onZ(m, 0.47, y, 0.56, y + 0.09, -1.252, -1, scale3(hex('#b9bdc0'), 0.8));
    else onZ(m, 0.47, y + 0.02, 0.52, y + 0.07, -1.252, -1, scale3(hex(LAMPS[k % LAMPS.length]), 0.9));
    onZ(m, 0.59, y + 0.02, 0.64, y + 0.07, -1.252, -1, scale3(hex(LAMPS[(k + r.int(0, 3)) % LAMPS.length]), 0.9));
  }
  onZ(m, -0.7, 0.3, 0.7, 1.5, -0.75, 1, scale3(mix3(paintC, darkC, 0.6), 0.9));
  onZ(m, -0.7, 0.9, 0.7, 1.5, 0.75, -1, scale3(mix3(paintC, darkC, 0.6), 0.9));
  // Hazard bands: along the guards' feet, across the bed's face either side of the conduit.
  for (const s of [-1, 1]) {
    if (stripes === 'guards' || stripes === 'both') bands(-0.75, 0.75, 10, acc, dark, (a, b, c) => onX(m, a, 1, b, 1.14, s * 0.9, s, c));
    else onX(m, -0.6, 1.2, 0.6, 1.45, s * 0.9, s, scale3(mix3(paintC, darkC, 0.6), 1));
    if (stripes === 'bed' || stripes === 'both') bands(0.36, 0.95, 4, acc, dark, (a, b, c) => onZ(m, s * a, 0.5, s * b, 0.74, 1.15, 1, c));
    // A plate on the front housing, a hatch in the top plate.
    onZ(m, s * 0.45, 1.05, s * 0.9, 1.6, 1.15, 1, scale3(mix3(paintC, darkC, 0.3), 1));
    onZ(m, s * 0.55, 1.4, s * 0.8, 1.5, 1.152, 1, s > 0 ? acc : scale3(hex('#b9bdc0'), 0.8));
    onY(m, s * 0.48, -0.55, s * 0.84, -0.05, 2, scale3(mix3(paintC, darkC, 0.3), 1));
  }
  // Pipes along the top plate.
  const steel = round(hex(look.pipe ?? '#8b9094'), grime);
  for (let k = 0; k < Math.min(2, g.pipes ?? 1); k++) cyl(m, 2, (k ? -1 : 1) * 0.64, 2.07, -0.98, 0.98, 0.06, 6, steel, { caps: '01' });
  return m;
}

// ---------------------------------------------------------------- the chamber machine

/**
 * A chamber machine: four posts, a block and a framed port at each end under an end wall, a roof with a cap, a
 * guard hanging each side over the open chamber. Settings `g`: `port` ('glass': a dark pane, 'grille': bars,
 * 'door': a panel with a handle), `guard` ('ribs', 'stripes' or 'plain'). `look`: `paint`, `base`, `accent`, `dark`, `glass` (the pane), `grime`.
 */
export function windowMachineMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const paintC = hex(look.paint);
  const baseC = hex(look.base ?? '#2a2d31');
  const accC = hex(look.accent ?? '#c9a227');
  const darkC = hex(look.dark ?? DARK);
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-X, 0, -1.1, X, 1.9, 1.1], scale3(paintC, 0.85), ['ny']);
    solid(m, [-0.775, 1.9, -0.73, 0.775, h, 0.384], scale3(paintC, 0.75), ['ny']);
    return m;
  }
  // Solid: the four posts, the two end blocks, the two end walls, the two port frames, the two guards, the roof,
  // its cap. Open: the chamber, from side to side under the guards (and in through them to its end walls).
  m.boxes = [
    [0.45, 0, -1.1, X, 1.8, -0.7],
    [-X, 0, -1.1, -0.65, 1.8, -0.7],
    [0.45, 0, 0.7, X, 1.8, 1.1],
    [-X, 0, 0.7, -0.65, 1.8, 1.1],
    [-0.85, 0, -Z, 0.85, 0.7, -0.775],
    [-0.85, 0, 0.775, 0.85, 0.7, Z],
    [-X, 0.7, -1, X, 1.8, -0.9],
    [-X, 0.7, 0.9, X, 1.8, 1],
    [-0.65, 0.7, -Z, 0.65, 1.5, -0.775],
    [-0.65, 0.7, 0.775, 0.65, 1.5, Z],
    [0.75, 1, -0.7, X, 1.8, 0.7],
    [-X, 1, -0.7, -0.75, 1.8, 0.7],
    [-X, 1.5, -1.086, X, 1.9, 1.086],
    [-0.775, 1.9, -0.73, 0.775, h, 0.384],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const paint = (k = 1) => tone(scale3(paintC, k * (1 + r.jitter(0.02))), grime);
  const base = tone(baseC, grime * 0.6);
  const acc = scale3(accC, 0.92);
  const dark = scale3(darkC, 1);
  const inside = scale3(mix3(paintC, darkC, 0.7), 0.8);
  const port = g.port ?? 'glass';
  for (const s of [-1, 1]) {
    const z = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    // The posts (wider at +x, where the wiring runs), the end block, the end wall between the posts.
    const [p0, p1] = z(0.7, 1.1);
    solid(m, [0.45, 0, p0, X, 1.5, p1], paint(0.92), ['ny']);
    solid(m, [-X, 0, p0, -0.65, 1.5, p1], paint(0.92), ['ny']);
    const [b0, b1] = z(0.775, Z);
    solid(m, [-0.85, 0, b0, 0.85, 0.7, b1], base, ['ny']);
    const [w0, w1] = z(0.9, 1);
    solid(m, [-0.65, 0.7, w0, 0.45, 1.5, w1], inside, ['nx', 'px', 'py', 'ny']);
    // The port: a frame of four bars round a pane set back in it.
    const [f0, f1] = z(1, Z);
    if (fine) {
      solid(m, [-0.65, 0.7, f0, -0.53, 1.5, f1], paint(1.04), ['ny']);
      solid(m, [0.53, 0.7, f0, 0.65, 1.5, f1], paint(1.04), ['ny']);
      solid(m, [-0.53, 1.38, f0, 0.53, 1.5, f1], paint(1.04), ['nx', 'px']);
      solid(m, [-0.53, 0.7, f0, 0.53, 0.82, f1], paint(1.04), ['nx', 'px', 'ny']);
      const zp = s * (Z - 0.09);
      const pane = port === 'door' ? scale3(mix3(paintC, darkC, 0.25), 1) : port === 'grille' ? dark : scale3(hex(look.glass ?? '#16242c'), 1);
      onZ(m, -0.53, 0.82, 0.53, 1.38, zp, s, pane);
      if (port === 'glass') {
        // A still streak across the pane (paint, not a light).
        quadN(m, [-0.4, 0.9, zp + s * 0.004], [-0.2, 0.9, zp + s * 0.004], [0.15, 1.3, zp + s * 0.004], [-0.05, 1.3, zp + s * 0.004], [0, 0, s], scale3(hex(look.glass ?? '#16242c'), 2.2));
      } else if (port === 'grille') {
        for (let k = 0; k < 5; k++) onZ(m, -0.53, 0.88 + k * 0.1, 0.53, 0.92 + k * 0.1, zp + s * 0.002, s, scale3(mix3(paintC, darkC, 0.4), 1));
      } else {
        onZ(m, 0.34, 1.0, 0.4, 1.2, zp + s * 0.002, s, scale3(hex('#b9bdc0'), 0.8));
        onZ(m, -0.45, 0.9, 0.25, 0.94, zp + s * 0.002, s, acc);
      }
    } else {
      solid(m, [-0.65, 0.7, f0, 0.65, 1.5, f1], paint(1.04), ['ny']);
    }
  }
  // The guards (a little inside the bounds, their ribs out to them), the roof, its cap.
  const guard = g.guard ?? 'ribs';
  for (const s of [-1, 1]) {
    const [x0, x1] = s > 0 ? [0.75, X - 0.03] : [-X + 0.03, -0.75];
    solid(m, [x0, 1, -0.7, x1, 1.5, 0.7], tone(mix3(paintC, darkC, 0.3), grime), ['py', 'nz', 'pz']);
    if (!fine) continue;
    const xo = s * (X - 0.03);
    if (guard === 'ribs') for (let k = 0; k < 3; k++) solid(m, [s > 0 ? xo : -X, 1.06 + k * 0.15, -0.7, s > 0 ? X : xo, 1.12 + k * 0.15, 0.7], paint(1.05), [s > 0 ? 'nx' : 'px', 'nz', 'pz']);
    else if (guard === 'stripes') bands(-0.7, 0.7, 10, acc, dark, (a, b, c) => onX(m, a, 1, b, 1.14, xo, s, c));
    else onX(m, -0.55, 1.1, 0.55, 1.4, xo, s, scale3(mix3(paintC, darkC, 0.55), 1));
  }
  solid(m, [-X, 1.5, -1.086, X, 1.9, 1.086], paint());
  solid(m, [-0.775, 1.9, -0.73, 0.775, h, 0.384], paint(0.82), ['ny']);
  if (fine) {
    onY(m, -0.6, 0.5, 0.6, 0.98, 1.9, scale3(mix3(paintC, darkC, 0.3), 1));
    onY(m, -0.5, 0.7, -0.3, 0.78, 1.902, acc);
  }
  return m;
}

// ---------------------------------------------------------------- the hoppers

/** What closes a hopper's bin, set a little below its rim: a load of ore, a lid with a hatch, a grate. */
function binTop(m, r, top, y, half, look, roundBin, seg) {
  const oreC = hex(look.load ?? '#5a4a3c');
  const lidC = hex(look.lid ?? look.paint);
  if (top === 'ore') {
    const lump = () => scale3(oreC, r.range(0.7, 1.25));
    if (roundBin) lathe(m, [[half, y], [half * 0.5, y + 0.1], [0.02, y + 0.15]], seg, lump, { hard: [1] });
    else {
      const c = [0, y + 0.15, 0];
      const q = [[-half, y, -half], [half, y, -half], [half, y, half], [-half, y, half]];
      for (let k = 0; k < 4; k++) triN(m, q[k], q[(k + 1) % 4], c, [0, 1, 0], lump);
    }
    return;
  }
  const plate = top === 'grate' ? scale3(hex(DARK), 1) : scale3(lidC, 0.95);
  if (roundBin) disc(m, half, y, seg, plate);
  else onY(m, -half, -half, half, half, y - 0.002, plate);
  if (seg < 12) return;
  const a = half * (top === 'grate' ? 0.9 : 0.62);
  if (top === 'grate') {
    const barC = scale3(hex(look.trim ?? '#8b9094'), 0.8);
    for (let k = 0; k < 5; k++) {
      const t = lerp(-a, a, k / 4);
      onY(m, t - 0.03, -a, t + 0.03, a, y, barC);
      onY(m, -a, t - 0.03, a, t + 0.03, y + 0.002, barC);
    }
  } else {
    onY(m, -a * 0.6, -a * 0.6, a * 0.6, a * 0.6, y, scale3(lidC, 0.7));
    onY(m, -0.2, -0.04, 0.2, 0.04, y + 0.002, scale3(hex(look.trim ?? '#8b9094'), 0.9));
  }
}

/**
 * A round hopper: a square plinth, a cone widening up from it, a hooped drum to the rim. Settings `g`: `hoops`
 * (2–4 round the drum), `seams` (upright ribs between them), `top` ('ore', 'lid' or 'grate'). `look`: `paint`,
 * `hoop`, `base`, `load` (the ore), `lid`, `trim`, `grime`.
 */
export function hopperMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const R = w / 2;
  const paintC = hex(look.paint);
  const baseC = hex(look.base ?? '#2a2d31');
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-1, 0, -1, 1, 0.8, 1], scale3(baseC, 1), ['ny', 'py']);
    solid(m, [-1.3, 1.2, -1.3, 1.3, h, 1.3], scale3(paintC, 0.85));
    return m;
  }
  // Solid: the plinth, the cone as an eight-sided step, the drum as an eight-sided block, loaded or lidded to its rim.
  m.boxes = [
    [-1, 0, -1, 1, 0.8, 1],
    [-0.65, 0.8, -1.5, 0.65, 1.2, 1.5],
    [-1.5, 0.8, -0.65, 1.5, 1.2, 0.65],
    [-1.15, 0.8, -1.15, 1.15, 1.2, 1.15],
    [-0.65, 1.2, -R, 0.65, h, R],
    [-R, 1.2, -0.65, R, h, 0.65],
    [-1.3, 1.2, -1.3, 1.3, h, 1.3],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const S = fine ? 16 : 8;
  const Rb = R - 0.06;
  const Ri = R - 0.1;
  const top = g.top ?? 'ore';
  const dep = top === 'ore' ? 0.2 : top === 'lid' ? 0.05 : 0.12;
  solid(m, [-1, 0, -1, 1, 0.8, 1], tone(baseC, grime * 0.6), ['ny']);
  const body = round(scale3(paintC, 1 + r.jitter(0.02)), grime);
  const hoop = round(hex(look.hoop ?? look.paint), grime, 0.8);
  if (!fine) {
    lathe(m, [[1.2, 0.8], [R, 1.3], [R, h]], S, body, { hard: [1] });
    binTop(m, r, top === 'ore' ? 'lid' : top, h, R, { ...look, lid: top === 'ore' ? look.load ?? '#5a4a3c' : look.lid }, true, S);
    return m;
  }
  // One turned outline: the cone, the drum and its hoops, the rim and the wall inside it.
  const n = Math.max(2, Math.min(4, g.hoops ?? 3));
  const prof = [[1.2, 0.8], [Rb, 1.3]];
  const rows = ['body'];
  for (let k = 0; k < n; k++) {
    const y = k === n - 1 ? h - 0.16 : lerp(1.5, h - 0.16, k / (n - 1));
    prof.push([Rb, y], [R, y], [R, k === n - 1 ? h : y + 0.14]);
    rows.push('body', 'hoop', 'hoop');
    if (k < n - 1) {
      prof.push([Rb, y + 0.14]);
      rows.push('hoop');
    }
  }
  prof.push([Ri, h], [Ri, h - dep]);
  rows.push('hoop', 'in');
  lathe(m, prof, S, (p, nn, row) => (rows[row] === 'body' ? body(p, nn) : rows[row] === 'hoop' ? hoop(p, nn) : scale3(paintC, 0.35)), { hard: prof.map((_, i) => i) });
  binTop(m, r, top, h - dep, Ri, look, true, S);
  // Upright ribs on the drum between the cone and the top hoop, a hatch and slats in the plinth.
  const ns = Math.max(0, g.seams ?? 4);
  for (let k = 0; k < ns; k++) {
    const a = ((k + 0.5) / ns) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    bar(m, [c * (Rb + 0.005), 1.3, s * (Rb + 0.005)], [c * (Rb + 0.005), h - 0.16, s * (Rb + 0.005)], 0.05, hoop, { up: [c, 0, s] });
  }
  const dark = scale3(hex(DARK), 1);
  onZ(m, -0.45, 0.12, 0.45, 0.68, -1, -1, scale3(mix3(baseC, [1, 1, 1], 0.12), 1));
  onZ(m, 0.3, 0.36, 0.38, 0.46, -1.002, -1, scale3(hex(look.trim ?? '#8b9094'), 0.9));
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) onX(m, -0.6, 0.2 + k * 0.12, 0.6, 0.26 + k * 0.12, s, s, dark);
  return m;
}

/**
 * A tall square hopper: a panelled column, a funnel widening up from it, a square bin with a ring beam and ribs.
 * Settings `g`: `ribs` (a side, above the beam), `top` ('ore', 'lid' or 'grate'), `door` (a hatch in the column's
 * −z face). `look`: `paint`, `beam`, `base` (the column), `load`, `lid`, `trim`, `grime`.
 */
export function tallHopperMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const X = w / 2;
  const paintC = hex(look.paint);
  const baseC = hex(look.base ?? '#3a3d42');
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-0.7, 0, -0.7, 0.7, 2.2, 0.7], scale3(baseC, 0.95), ['ny', 'py']);
    solid(m, [-1.4, 2.2, -1.4, 1.4, h, 1.4], scale3(paintC, 0.85));
    return m;
  }
  // Solid: the column, the funnel in four steps, the bin (loaded or lidded to its rim), its ring beam. Open: under
  // the funnel and the bin, round the column.
  m.boxes = [
    [-0.7, 0, -0.7, 0.7, 1.6, 0.7],
    [-0.8, 1.4, -0.8, 0.8, 1.7, 0.8],
    [-1, 1.7, -1, 1, 2, 1],
    [-1.2, 2, -1.2, 1.2, 2.5, 1.2],
    [-1.4, 2.5, -1.4, 1.4, h, 1.4],
    [-X, 2.767, -X, X, 3.367, X],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const paint = (k = 1) => tone(scale3(paintC, k * (1 + r.jitter(0.02))), grime);
  const base = tone(baseC, grime * 0.6);
  const beam = tone(hex(look.beam ?? look.paint), grime, 0.8);
  const top = g.top ?? 'ore';
  solid(m, [-0.7, 0, -0.7, 0.7, 1.4, 0.7], base, ['ny', 'py']);
  // The funnel: a collar, then four sloped sides out to the bin.
  const [a, ya, b, yb] = [0.8, fine ? 1.55 : 1.4, 1.4, 2.5];
  if (fine) solid(m, [-a, 1.4, -a, a, ya, a], beam, ['py']);
  const lo = [[-a, ya, -a], [a, ya, -a], [a, ya, a], [-a, ya, a]];
  const hi = [[-b, yb, -b], [b, yb, -b], [b, yb, b], [-b, yb, b]];
  const out = [[0, -0.5, -1], [1, -0.5, 0], [0, -0.5, 1], [-1, -0.5, 0]];
  const slope = paint(0.9);
  for (let k = 0; k < 4; k++) quadN(m, lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k], out[k], (p, nn) => scale3(slope(p, [nn[0], 0, nn[2]]), 0.82));
  solid(m, [-b, yb, -b, b, h, b], paint(), ['ny', 'py']);
  solid(m, [-X, 2.767, -X, X, 3.367, X], beam);
  if (!fine) {
    onY(m, -b, -b, b, b, h - 0.002, top === 'ore' ? scale3(hex(look.load ?? '#5a4a3c'), 0.95) : top === 'grate' ? scale3(hex(DARK), 1) : scale3(hex(look.lid ?? look.paint), 0.95));
    return m;
  }
  // The rim and the wall inside it, what closes the bin.
  const dep = top === 'ore' ? 0.2 : top === 'lid' ? 0.05 : 0.12;
  const i = b - 0.1;
  const rimC = paint(1.05);
  const O = [[-b, h, -b], [b, h, -b], [b, h, b], [-b, h, b]];
  const I = [[-i, h, -i], [i, h, -i], [i, h, i], [-i, h, i]];
  for (let k = 0; k < 4; k++) {
    const j = (k + 1) % 4;
    quadN(m, O[k], O[j], I[j], I[k], [0, 1, 0], rimC);
    quadN(m, I[k], I[j], [I[j][0], h - dep, I[j][2]], [I[k][0], h - dep, I[k][2]], [-out[k][0], 0, -out[k][2]], scale3(paintC, 0.35));
  }
  binTop(m, r, top, h - dep, i, look, false, 16);
  // Ribs up the bin above the beam, a hatch in the column, slats in its other sides.
  const nr = Math.max(0, g.ribs ?? 3);
  for (let k = 0; k < nr; k++) {
    const t = lerp(-1.1, 1.1, nr === 1 ? 0.5 : k / (nr - 1));
    solid(m, [t - 0.04, 3.367, -X + 0.03, t + 0.04, h, -b], beam, ['ny', 'pz']);
    solid(m, [t - 0.04, 3.367, b, t + 0.04, h, X - 0.03], beam, ['ny', 'nz']);
    solid(m, [-X + 0.03, 3.367, t - 0.04, -b, h, t + 0.04], beam, ['ny', 'px']);
    solid(m, [b, 3.367, t - 0.04, X - 0.03, h, t + 0.04], beam, ['ny', 'nx']);
  }
  const dark = scale3(hex(DARK), 1);
  if (g.door ?? true) {
    onZ(m, -0.4, 0.1, 0.4, 1.25, -0.7, -1, scale3(mix3(baseC, [1, 1, 1], 0.14), 1));
    onZ(m, 0.26, 0.6, 0.32, 0.76, -0.702, -1, scale3(hex(look.trim ?? '#8b9094'), 0.9));
  }
  for (let k = 0; k < 4; k++) {
    onZ(m, -0.45, 0.8 + k * 0.1, 0.45, 0.85 + k * 0.1, 0.7, 1, dark);
    for (const s of [-1, 1]) onX(m, -0.45, 0.8 + k * 0.1, 0.45, 0.85 + k * 0.1, s * 0.7, s, dark);
  }
  return m;
}

// ---------------------------------------------------------------- the piston

/**
 * A hydraulic piston standing on end: a flanged cylinder, a bright rod out of its top, a head as wide as the
 * cylinder's flanges. Settings `g`: `rod` (its radius, m), `bolts` (round each flange), `head` ('plate', or 'cap':
 * a chamfered edge). `look`: `paint`, `flange`, `rod`, `head`, `band` (a band round the head's foot), `bolt`,
 * `grime`.
 */
export function pistonMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const R = w / 2;
  const paintC = hex(look.paint);
  const headC = hex(look.head ?? look.paint);
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-0.85, 0, -0.85, 0.85, 1.4, 0.85], scale3(paintC, 0.85), ['ny']);
    solid(m, [-0.85, 1.7, -0.85, 0.85, h, 0.85], scale3(headC, 0.85));
    return m;
  }
  // Solid: the core from the ground to the top, the cylinder and the head as crosses round it. Open: nothing you
  // could pass or shoot through (the groove round the rod is as it was).
  m.boxes = [
    [-0.8, 0, -0.8, 0.8, h, 0.8],
    [-0.45, 0, -R, 0.45, 1.4, R],
    [-R, 0, -0.45, R, 1.4, 0.45],
    [-0.45, 1.7, -R, 0.45, h, R],
    [-R, 1.7, -0.45, R, h, 0.45],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const S = fine ? 16 : 8;
  const rr = g.rod ?? 0.6;
  const cap = (g.head ?? 'plate') === 'cap' ? 0.12 : 0;
  const body = round(scale3(paintC, 1 + r.jitter(0.02)), grime);
  const flange = round(hex(look.flange ?? look.paint), grime, 0.82);
  const rod = round(hex(look.rod ?? '#c4c8cc'), 0, 1.05);
  const head = round(headC, grime * 0.6);
  const band = round(hex(look.band ?? look.head ?? look.paint), grime * 0.6);
  const prof = [[R, 0], [R, 0.14], [1, 0.14], [1, 1.1], [R, 1.1], [R, 1.3], [1, 1.3], [0.97, 1.4], [rr, 1.4], [rr, 1.7], [R, 1.7], [R, 1.86], [R, h - cap], [R - cap, h]];
  const rows = [flange, flange, body, flange, flange, flange, body, body, rod, head, band, head, head];
  if (!cap) {
    prof.pop();
    rows.pop();
  }
  lathe(m, prof, S, (p, n, row) => rows[row](p, n), { hard: prof.map((_, i) => i) });
  disc(m, R - cap, h, S, scale3(headC, 1.05));
  if (!fine) return m;
  const steel = round(hex(look.bolt ?? '#8b9094'), grime);
  const nb = Math.max(4, g.bolts ?? 8);
  for (let k = 0; k < nb; k++) {
    const a = ((k + 0.5) / nb) * Math.PI * 2;
    const [x, z] = [Math.cos(a) * 1.05, Math.sin(a) * 1.05];
    for (const y of [0.14, 1.3]) box(m, [x - 0.035, y, z - 0.035], [x + 0.035, y + 0.045, z + 0.035], steel, ['ny']);
  }
  // Two ports and a line between them up the cylinder's −z side (inside its flanges' reach).
  box(m, [-0.06, 0.3, -1.08], [0.06, 0.42, -0.98], steel, ['pz']);
  box(m, [-0.06, 0.82, -1.08], [0.06, 0.94, -0.98], steel, ['pz']);
  box(m, [-0.025, 0.42, -1.06], [0.025, 0.82, -1.02], scale3(hex(DARK), 1.4), ['ny', 'py']);
  return m;
}

// ---------------------------------------------------------------- the scanner gate

/**
 * A scanner gate, walked through along x: a cabinet foot each end, a post on each, a lintel across, a scanner head
 * hanging each side of the way through. Settings `g`: `strip` ('dots', 'bars' or 'slot': the sensor strip up each
 * post), `sign` ('stripes', 'band' or 'none': on the lintel between the heads). `look`: `paint`, `foot`, `head`,
 * `accent`, `dark`, `lens` (dark paint), `ink` (the still marks on the heads' panels), `grime`.
 */
export function scannerMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const paintC = hex(look.paint);
  const footC = hex(look.foot ?? look.paint);
  const headC = hex(look.head ?? '#2a2d31');
  const accC = hex(look.accent ?? '#c9a227');
  const darkC = hex(look.dark ?? DARK);
  const m = new Mesh();
  if (level >= 2) {
    for (const s of [-1, 1]) solid(m, [-0.45, 0, s > 0 ? 1.3 : -Z, 0.45, 2.6, s > 0 ? Z : -1.3], scale3(paintC, 0.85), ['ny']);
    solid(m, [-0.45, 2.3, -1.3, 0.45, h, 1.3], scale3(headC, 1), ['nz', 'pz']);
    return m;
  }
  // Solid: the two feet, the two posts, the lintel, the two heads. Open: the way through, 2.4 m wide under the heads.
  m.boxes = [
    [-X, 0, -Z, X, 0.8, -1.212],
    [-X, 0, 1.212, X, 0.8, Z],
    [-0.354, 0.8, -1.89, 0.354, 2.7, -1.4],
    [-0.354, 0.8, 1.4, 0.354, 2.7, 1.89],
    [-0.4, 2.3, -1.89, 0.4, 2.9, 1.89],
    [-0.52, 2.2, -1.2, 0.52, h, -0.7],
    [-0.52, 2.2, 0.7, 0.52, h, 1.2],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const paint = (k = 1) => tone(scale3(paintC, k * (1 + r.jitter(0.02))), grime);
  const foot = tone(footC, grime, 0.9);
  const head = tone(headC, grime * 0.5);
  const acc = scale3(accC, 0.92);
  const dark = scale3(darkC, 1);
  const lens = scale3(hex(look.lens ?? '#0b1013'), 1);
  const ink = scale3(hex(look.ink ?? '#5a8a9a'), 0.75);
  for (const s of [-1, 1]) {
    const z = (a, b) => (s > 0 ? [a, b] : [-b, -a]);
    const [f0, f1] = z(1.212, Z);
    solid(m, [-X, 0, f0, X, 0.8, f1], foot, ['ny']);
    const [p0, p1] = z(1.4, 1.89);
    solid(m, [-0.354, 0.8, p0, 0.354, 2.3, p1], paint(), ['ny', 'py']);
    const [h0, h1] = z(0.7, 1.2);
    solid(m, [-0.52, 2.2, h0, 0.52, h, h1], head);
    if (!fine) continue;
    // A hazard band along the foot's inner face, a hatch on its top, the sensor strip up the post's inner face.
    const zi = s * 1.212;
    bands(-X + 0.04, X - 0.04, 6, acc, dark, (a, b, c) => onZ(m, a, 0.06, b, 0.2, zi, -s, c));
    onY(m, -0.4, Math.min(s * 1.93, s * 2.06), 0.4, Math.max(s * 1.93, s * 2.06), 0.8, scale3(mix3(footC, darkC, 0.45), 1));
    const zp = s * 1.4;
    onZ(m, -0.1, 1, 0.1, 2.15, zp, -s, lens);
    const strip = g.strip ?? 'dots';
    if (strip === 'dots') for (let k = 0; k < 8; k++) onZ(m, -0.035, 1.08 + k * 0.135, 0.035, 1.14 + k * 0.135, zp - s * 0.002, -s, ink);
    else if (strip === 'bars') for (let k = 0; k < 4; k++) onZ(m, -0.06, 1.1 + k * 0.27, 0.06, 1.28 + k * 0.27, zp - s * 0.002, -s, ink);
    else onZ(m, -0.02, 1.08, 0.02, 2.07, zp - s * 0.002, -s, ink);
    // The head: a lens underneath, a dark panel with a few still marks on each side.
    onY(m, -0.3, Math.min(s * 0.8, s * 1.1), 0.3, Math.max(s * 0.8, s * 1.1), 2.2, lens, -1);
    onY(m, -0.12, Math.min(s * 0.89, s * 1.01), 0.12, Math.max(s * 0.89, s * 1.01), 2.198, scale3(hex(look.lens ?? '#0b1013'), 3), -1);
    for (const e of [-1, 1]) {
      onX(m, h0 + 0.06, 2.42, h1 - 0.06, 2.86, e * 0.52, e, lens);
      for (let k = 0; k < 3; k++) onX(m, h0 + 0.1, 2.5 + k * 0.11, lerp(h0 + 0.14, h1 - 0.1, r.range(0.3, 1)), 2.54 + k * 0.11, e * 0.522, e, ink);
    }
  }
  solid(m, [-0.4, 2.3, -1.89, 0.4, 2.9, 1.89], paint(0.92));
  if (!fine) return m;
  const sign = g.sign ?? 'stripes';
  for (const e of [-1, 1]) {
    if (sign === 'stripes') bands(-0.62, 0.62, 8, acc, dark, (a, b, c) => onX(m, a, 2.46, b, 2.74, e * 0.4, e, c));
    else if (sign === 'band') onX(m, -0.62, 2.5, 0.62, 2.7, e * 0.4, e, acc);
  }
  return m;
}

// ---------------------------------------------------------------- the lever panel

/**
 * A two-lever floor panel: a floor plate, a pedestal, a quadrant housing for each lever, the two levers side by
 * side (along z) with their grips at the top of the bounds. Settings `g`: `a`, `b` (how far each lever's grip
 * leans along x, m, within ±0.1), `edge` ('stripes' or 'plain': the plate's edge). `look`: `plate`, `paint` (the
 * pedestal), `housing`, `lever`, `grip_a`, `grip_b`, `accent`, `grime`.
 */
export function leverMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const X = w / 2;
  const plateC = hex(look.plate ?? '#3a3d42');
  const paintC = hex(look.paint);
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-X, 0, -X, X, 0.4, X], scale3(plateC, 0.95), ['ny']);
    solid(m, [-0.3, 0.4, -0.48, 0.3, 1, 0.48], scale3(paintC, 0.85), ['ny']);
    return m;
  }
  // Solid: the floor plate, the pedestal, the housings, the levers (one block for the pair, as it was).
  m.boxes = [
    [-X, 0, -X, X, 0.4, X],
    [-0.43, 0.4, -0.48, 0.43, 0.6, 0.48],
    [-0.16, 0.6, -0.48, 0.16, 0.8, 0.48],
    [-0.16, 0.8, -0.4, 0.16, h, 0.4],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const plate = tone(scale3(plateC, 1 + r.jitter(0.02)), grime);
  const paint = tone(paintC, grime * 0.7);
  const housing = tone(hex(look.housing ?? look.paint), grime * 0.5, 0.8);
  const steel = tone(hex(look.lever ?? '#8b9094'), grime * 0.4);
  solid(m, [-X, 0, -X, X, 0.4, X], plate, ['ny']);
  solid(m, [-0.43, 0.4, -0.48, 0.43, 0.6, 0.48], paint, ['ny']);
  const lean = [Math.max(-0.1, Math.min(0.1, g.a ?? 0.08)), Math.max(-0.1, Math.min(0.1, g.b ?? -0.08))];
  [-1, 1].forEach((s, k) => {
    const [z0, z1] = s > 0 ? [0.05, 0.48] : [-0.48, -0.05];
    solid(m, [-0.16, 0.6, z0, 0.16, 0.8, z1], housing, ['ny']);
    const zc = s * 0.24;
    const x = lean[k];
    bar(m, [0, 0.74, zc], [x, h - 0.1, zc], 0.05, steel, { up: [0, 0, 1] });
    const grip = scale3(hex(look[k ? 'grip_b' : 'grip_a'] ?? '#a8261e'), 0.95);
    box(m, [x - 0.045, h - 0.14, zc - 0.045], [x + 0.045, h, zc + 0.045], grip, fine ? [] : ['ny']);
    if (!fine) return;
    // The slot the lever swings in, a dial each side of the pedestal.
    onY(m, -0.12, zc - 0.035, 0.12, zc + 0.035, 0.8, scale3(hex(DARK), 1));
    for (const e of [-1, 1]) onX(m, zc - 0.1, 0.44, zc + 0.1, 0.56, e * 0.43, e, scale3(hex(e > 0 ? '#b9bdc0' : LAMPS[(k + seed) % LAMPS.length]), 0.85));
  });
  if (!fine) return m;
  // The plate's tread and its edge.
  const acc = scale3(hex(look.accent ?? '#c9a227'), 0.92);
  const dark = scale3(hex(DARK), 1);
  onY(m, -0.72, -0.72, 0.72, 0.72, 0.4, scale3(plateC, 0.78));
  const e0 = 0.74;
  const e1 = X - 0.03;
  if ((g.edge ?? 'stripes') === 'stripes') {
    for (const s of [-1, 1]) {
      bands(-e1, e1, 12, acc, dark, (a, b, c) => onY(m, a, Math.min(s * e0, s * e1), b, Math.max(s * e0, s * e1), 0.402, c));
      bands(-e0, e0, 10, dark, acc, (a, b, c) => onY(m, Math.min(s * e0, s * e1), a, Math.max(s * e0, s * e1), b, 0.402, c));
    }
  } else {
    for (const s of [-1, 1]) {
      onY(m, -e1, Math.min(s * e0, s * e1), e1, Math.max(s * e0, s * e1), 0.402, acc);
      onY(m, Math.min(s * e0, s * e1), -e0, Math.max(s * e0, s * e1), e0, 0.402, acc);
    }
  }
  return m;
}

// ---------------------------------------------------------------- the giant cog

/** Stitch two closed loops of points (each in order of its angle round the y axis) with triangles facing `want`. */
function zip(m, A, B, want, colour) {
  const ang = (p) => Math.atan2(p[2], p[0]);
  const turn = (L) => {
    let k = 0;
    for (let i = 1; i < L.length; i++) if (ang(L[i]) < ang(L[k])) k = i;
    return [...L.slice(k), ...L.slice(0, k)];
  };
  const a = turn(A);
  const b = turn(B);
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const na = i < a.length ? ang(a[(i + 1) % a.length]) + (i + 1 === a.length ? Math.PI * 2 : 0) : Infinity;
    const nb = j < b.length ? ang(b[(j + 1) % b.length]) + (j + 1 === b.length ? Math.PI * 2 : 0) : Infinity;
    if (na <= nb) {
      triN(m, a[i % a.length], a[(i + 1) % a.length], b[j % b.length], want, colour);
      i++;
    } else {
      triN(m, b[j % b.length], b[(j + 1) % b.length], a[i % a.length], want, colour);
      j++;
    }
  }
}

/**
 * A giant cog lying flat: eight broad teeth round a rim, a sunk web, a hub round an open bore. Settings `g`:
 * `pockets` (dark pockets painted in the web), `bolts` (round the hub), `web` (how far the web is sunk, m).
 * `look`: `paint`, `worn` (the teeth's faces), `web`, `hub`, `bolt`, `grime`.
 */
export function cogMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const R = w / 2;
  const paintC = hex(look.paint);
  const m = new Mesh();
  const ring = (rad, n, y, phase = 0) => Array.from({ length: n }, (_, k) => [Math.cos(phase + (k / n) * Math.PI * 2) * rad, y, Math.sin(phase + (k / n) * Math.PI * 2) * rad]);
  if (level >= 2) {
    // An eight-sided block, its flats at the root of the teeth.
    const o = ring(3.9 / Math.cos(Math.PI / 8), 8, h, Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const [p, q] = [o[k], o[(k + 1) % 8]];
      quadN(m, [p[0], 0, p[2]], [q[0], 0, q[2]], q, p, [p[0] + q[0], 0, p[2] + q[2]], scale3(paintC, 0.8));
      triN(m, [0, h, 0], p, q, [0, 1, 0], scale3(paintC, 1));
    }
    return m;
  }
  // Solid: the rim and web as four bands round the bore, the four teeth on the axes, the four between as corner
  // blocks. Open: the bore, from top to bottom.
  m.boxes = [
    [-2.7, 0, -3.7, 2.7, h, -1.1],
    [-2.7, 0, 1.1, 2.7, h, 3.7],
    [-3.7, 0, -2.7, -1.1, h, 2.7],
    [1.1, 0, -2.7, 3.7, h, 2.7],
    [-1.1, 0, -R, 1.1, h, -3.7],
    [-1.1, 0, 3.7, 1.1, h, R],
    [-R, 0, -1.1, -3.7, h, 1.1],
    [3.7, 0, -1.1, R, h, 1.1],
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [a > 0 ? 2.7 : -3.25, 0, b > 0 ? 2.7 : -3.25, a > 0 ? 3.25 : -2.7, h, b > 0 ? 3.25 : -2.7]),
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.3;
  const steel = scale3(paintC, 1 + r.jitter(0.02));
  const wornC = hex(look.worn ?? '#9a9ea2');
  const root = 3.75;
  // The outline: per tooth its two root corners and its two tip corners, and (level 0) a point on the root between teeth.
  const outline = (y) => {
    const pts = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      const at = (rad, t) => [rad * c - t * s, y, rad * s + t * c];
      pts.push(at(root, -1.1), at(R, -0.8), at(R, 0.8), at(root, 1.1));
      if (fine) pts.push([Math.cos(a + Math.PI / 8) * root, y, Math.sin(a + Math.PI / 8) * root]);
    }
    return pts;
  };
  const top = outline(h);
  const side = (p, n) => scale3(mix3(steel, wornC, Math.hypot(p[0], p[2]) > root + 0.2 ? 0.55 : 0.1), (0.8 + 0.1 * Math.abs(n[0])) * groundShade(p[1], 0.5, 1 - grime * 0.5));
  for (let k = 0; k < top.length; k++) {
    const [p, q] = [top[k], top[(k + 1) % top.length]];
    const mid = [(p[0] + q[0]) / 2, 0, (p[2] + q[2]) / 2];
    // (Outward: away from the centre, but a tooth's flank faces along the rim.)
    const edge = [q[0] - p[0], 0, q[2] - p[2]];
    let out = [edge[2], 0, -edge[0]];
    if (out[0] * mid[0] + out[2] * mid[2] < 0) out = [-out[0], 0, -out[2]];
    quadN(m, [p[0], 0, p[2]], [q[0], 0, q[2]], q, p, out, side);
  }
  const rh = 1.15;
  const S = fine ? 16 : 8;
  // The bore's wall.
  cyl(m, 1, 0, 0, 0, h, rh, S, (p) => scale3(steel, 0.45 + 0.2 * (p[1] / h)), { inside: true });
  if (!fine) {
    zip(m, top, ring(rh, S, h), [0, 1, 0], scale3(steel, 1));
    return m;
  }
  // The top: the hub, a step down to the sunk web, a step up to the rim and the teeth.
  const dip = Math.max(0, Math.min(0.15, g.web ?? 0.1));
  const [r1, r2] = [1.95, 3.15];
  const hubC = hex(look.hub ?? look.paint);
  const webC = hex(look.web ?? look.paint);
  const quads = (A, B, want, colour) => {
    for (let k = 0; k < A.length; k++) quadN(m, A[k], A[(k + 1) % A.length], B[(k + 1) % A.length], B[k], want, colour);
  };
  const hubY = h - 0.006;
  quads(ring(rh, S, hubY), ring(r1, S, hubY), [0, 1, 0], scale3(hubC, 1.02));
  quads(ring(r1, S, h - dip), ring(r2, S, h - dip), [0, 1, 0], (p) => scale3(webC, 0.82 + 0.05 * Math.sin(Math.atan2(p[2], p[0]) * 5)));
  if (dip > 0) {
    const a = ring(r1, S, hubY);
    const b = ring(r1, S, h - dip);
    for (let k = 0; k < S; k++) quadN(m, a[k], a[(k + 1) % S], b[(k + 1) % S], b[k], [a[k][0] + a[(k + 1) % S][0], 0, a[k][2] + a[(k + 1) % S][2]], scale3(hubC, 0.6));
    const c = ring(r2, S, h);
    const e = ring(r2, S, h - dip);
    for (let k = 0; k < S; k++) quadN(m, c[k], c[(k + 1) % S], e[(k + 1) % S], e[k], [-c[k][0] - c[(k + 1) % S][0], 0, -c[k][2] - c[(k + 1) % S][2]], scale3(steel, 0.6));
  }
  zip(m, top, ring(r2, S, h), [0, 1, 0], (p) => scale3(mix3(steel, wornC, Math.hypot(p[0], p[2]) > root + 0.2 ? 0.4 : 0), 1.02));
  // Dark pockets painted in the web, bolts round the hub.
  const np = Math.max(0, g.pockets ?? 6);
  for (let k = 0; k < np; k++) {
    const a0 = ((k + 0.18) / np) * Math.PI * 2;
    const a1 = ((k + 0.82) / np) * Math.PI * 2;
    const P = (a, rad) => [Math.cos(a) * rad, h - dip + 0.002, Math.sin(a) * rad];
    quadN(m, P(a0, r1 + 0.22), P(a1, r1 + 0.22), P(a1, r2 - 0.22), P(a0, r2 - 0.22), [0, 1, 0], scale3(webC, 0.45));
  }
  const bolt = scale3(hex(look.bolt ?? '#6a6e72'), 1);
  const nb = Math.max(0, g.bolts ?? 8);
  for (let k = 0; k < nb; k++) {
    const a = ((k + 0.5) / nb) * Math.PI * 2;
    const [x, z] = [Math.cos(a) * 1.55, Math.sin(a) * 1.55];
    onY(m, x - 0.09, z - 0.09, x + 0.09, z + 0.09, hubY, bolt);
  }
  return m;
}
