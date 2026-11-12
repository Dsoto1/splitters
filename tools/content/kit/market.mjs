// Shop fittings (kit-prop families of part 9; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): a wire shopping cart
// (`cart`), a bakery stand (`bakery`: a base under an open rack of loaf baskets, a roll bin in front, a back board
// between two end pillars), a checkout (`checkout`: a belt counter and, beside it, a till cabinet under a ledge), a
// chest freezer island (`chestfreezer`), a bottle-return machine (`bottlereturn`) and a produce stand (`produce`: a
// slatted plinth under a tray of fruit, crates round it). Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2].
//
// Every one collides as finer boxes (a generator's `boxes`: tools/content/kitprops.mjs), the same for each variant:
// the boxes of the piece it replaces, tidied (fewer of them), closing what those closed and leaving open what they
// left open: a cart's basket, the space under it and under its handle; the bakery stand's steps; the cashier's
// corner of the checkout; the bottle machine's crate slot; the produce stand's cut corners. The boxes are in metres:
// a family here has one size, its retired prop's.
//
// Nothing here glows or blinks: a screen is dark paint with a few still shapes (CLAUDE.md, "Accessibility").
//
// Level 1 keeps the outline with far fewer triangles; level 2 is a stand-in of a few boxes.

import { rng } from '../env/rng.mjs';
import { Mesh, annulus, bar, box, clamp01, cyl, groundShade, hex, mix3, pad, quadN, ribbon, scale3, standIn, wirePanel } from './geom.mjs';

const lerp = (p, q, t) => p + (q - p) * t;
/** Paint: darker towards the ground, lighter on top, darker underneath and on the sides. */
const tone = (c, grime = 0.2, k = 1) => (p, n) => scale3(c, k * groundShade(p[1], 0.25, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.07 : n[1] < -0.5 ? 0.62 : Math.abs(n[0]) > 0.5 ? 0.88 : n[2] < -0.5 ? 0.8 : 1));
/** A flat quad facing up at `y`. */
const flat = (m, x0, x1, z0, z1, y, colour) => quadN(m, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], colour);
/** A flat quad at `z` facing `s` (±z). */
const face = (m, x0, y0, x1, y1, z, s, colour) => quadN(m, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, s], colour);
/** Horizontal seams (dark lines) on a face at `z`. */
const seams = (m, x0, x1, ys, z, s, colour) => ys.forEach((y) => face(m, x0, y, x1, y + 0.008, z, s, colour));

// ---------------------------------------------------------------- the shopping cart

/**
 * A wire shopping cart, its handle at −z: a tapered wire basket on two uprights, a child seat's flap at its rear, a
 * low tray between the castors. Settings `g`: `seat` ('up' or 'folded'), `tray` ('wire' or 'sheet'), `wires` (wires
 * along a side). `look`: `wire` (hex), `trim` (hex: the grip and the flap), `wheel` (hex), `rust` (0–1), `grime`.
 */
export function cartMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const wireC = hex(look.wire ?? '#b4b8bd');
  const trimC = hex(look.trim ?? '#b3261e');
  const dark = hex(look.wheel ?? '#1d1e20');
  const yF = 0.47;
  const yR = 0.9;
  const zb = -0.36;
  const m = new Mesh();
  if (level >= 2) {
    // The basket (darker: you see through it), the tray and the handle.
    box(m, [-X * 0.92, yF, zb], [X * 0.92, yR, Z], scale3(wireC, 0.5));
    box(m, [-0.2, 0.03, -0.4], [0.2, 0.15, 0.5], scale3(wireC, 0.4), ['ny']);
    box(m, [-X, h - 0.05, -Z], [X, h, -Z + 0.05], trimC, ['ny']);
    return m;
  }
  // Solid: the rear (the gate, the seat and the uprights down to the castors), the front castors, the tray and the
  // basket's floor, the basket's nose and its two sides, the handle. Open: the basket from above, the space under it
  // either side of the tray, under the handle.
  m.boxes = [
    [-X, 0, -0.45, X, 0.965, -0.05],
    [-0.32, 0, 0.15, 0.32, 0.3, 0.503],
    [-0.2, 0.1, -0.411, 0.2, 0.5, 0.55],
    [-X, 0.4, 0.35, X, 0.888, Z],
    [0.2, 0.44, -0.35, X, 0.9, Z],
    [-X, 0.44, -0.35, -0.2, 0.9, Z],
    [-X, 0.8, -Z, X, h, -0.15],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.2;
  const rustC = hex('#6b3a22');
  const rust = look.rust ?? 0.1;
  const wk = 1 + r.jitter(0.04);
  const wire = (p, n) => scale3(mix3(wireC, rustC, rust * clamp01(1.2 - p[1] / 0.6)), wk * (n[1] > 0.5 ? 1.08 : n[1] < -0.5 ? 0.7 : Math.abs(n[0]) > 0.5 ? 0.9 : 1));
  const trim = tone(trimC, grime);
  const t = 0.02;
  const e = t / 2;
  const xn = X * 0.86;
  // The basket: a rim, a floor frame, four wire walls and a wire floor.
  const T = [[-X + e, yR - e, zb], [X - e, yR - e, zb], [xn - e, yR - e, Z - e], [-xn + e, yR - e, Z - e]];
  const B = [[-0.27, yF, zb + 0.02], [0.27, yF, zb + 0.02], [0.22, yF, 0.5], [-0.22, yF, 0.5]];
  const side = Math.max(4, g.wires ?? 11);
  const nu = fine ? [7, side, 6, side] : [3, 4, 2, 4];
  const wd = fine ? 0.008 : 0.016;
  for (let k = 0; k < 4; k++) {
    bar(m, T[k], T[(k + 1) % 4], t, wire, { ends: fine });
    if (fine) bar(m, B[k], B[(k + 1) % 4], t * 0.7, wire);
    wirePanel(m, B[k], B[(k + 1) % 4], T[k], T[(k + 1) % 4], nu[k], fine ? 3 : 1, wd, wire);
  }
  wirePanel(m, B[0], B[1], B[3], B[2], fine ? 6 : 3, fine ? 3 : 0, wd, wire);
  // The child seat: a flap leaning in from the gate and its seat, or folded flat against the gate.
  if ((g.seat ?? 'up') === 'folded') ribbon(m, [0, 0.56, zb + 0.016], [0, 0.86, zb + 0.016], [1, 0, 0], 0.44, trim);
  else {
    ribbon(m, [0, 0.58, zb + 0.03], [0, 0.86, zb + 0.11], [1, 0, 0], 0.44, trim);
    ribbon(m, [0, 0.6, zb + 0.012], [0, 0.6, zb + 0.13], [1, 0, 0], 0.4, tone(trimC, grime, 0.85));
  }
  // The frame: two uprights from the rear castors to the handle's arms, the handle with its grip.
  const yh = h - 0.022;
  const zh = -Z + 0.022;
  for (const s of [-1, 1]) {
    bar(m, [s * 0.33, 0.12, -0.38], [s * 0.34, 0.93, -0.4], 0.024, wire);
    bar(m, [s * 0.34, 0.93, -0.4], [s * 0.34, yh, zh], 0.024, wire);
    bar(m, [s * 0.185, 0.125, 0.3], [s * 0.2, yF, 0.3], 0.02, wire);
    bar(m, [s * 0.185, 0.125, -0.4], [s * 0.185, 0.125, 0.52], 0.024, wire);
  }
  if (fine) {
    cyl(m, 0, yh, zh, -X, -0.26, 0.022, 8, wire, { caps: '0' });
    cyl(m, 0, yh, zh, -0.26, 0.26, 0.022, 8, trim);
    cyl(m, 0, yh, zh, 0.26, X, 0.022, 8, wire, { caps: '1' });
    bar(m, [-0.33, 0.12, -0.38], [0.33, 0.12, -0.38], 0.024, wire);
    bar(m, [-0.185, 0.125, 0.52], [0.185, 0.125, 0.52], 0.024, wire);
    box(m, [-0.3, 0.1, 0.4], [0.3, 0.13, 0.44], wire);
  } else cyl(m, 0, yh, zh, -X, X, 0.022, 4, trim);
  // The tray under the basket: wire, or a plastic sheet.
  if ((g.tray ?? 'wire') === 'sheet') box(m, [-0.175, 0.118, -0.38], [0.175, 0.134, 0.5], tone(hex(look.tray ?? look.trim ?? '#3a3d42'), grime), fine ? [] : ['ny']);
  else if (fine) wirePanel(m, [-0.185, 0.125, -0.4], [0.185, 0.125, -0.4], [-0.185, 0.125, 0.52], [0.185, 0.125, 0.52], 4, 3, wd, wire);
  // Four castors: a fork and a wheel each.
  for (const [x, z] of [[0.27, 0.42], [-0.27, 0.42], [0.31, -0.33], [-0.31, -0.33]]) {
    if (fine) {
      box(m, [x - 0.022, 0.05, z - 0.012], [x + 0.022, 0.115, z + 0.012], wire, ['ny']);
      cyl(m, 0, 0.05, z + 0.02, x - 0.014, x + 0.014, 0.05, 8, dark, { caps: '01' });
    } else box(m, [x - 0.014, 0, z - 0.03], [x + 0.014, 0.1, z + 0.07], dark, ['ny']);
  }
  return m;
}

// ---------------------------------------------------------------- the bakery stand

const LOAVES = ['#b9772f', '#c98a3c', '#a5611f', '#d6a55a', '#8f5a26', '#caa26a'];

/**
 * A bakery stand, its front at +z: a wooden base, an open rack of loaf baskets on it (a slanted shelf in front, a
 * step behind), baskets on the rack's top, a roll bin hung on the front between two baskets of baguettes, a back
 * board with a painted header between two end pillars. Settings `g`: `fill` (0–1: how full the baskets are),
 * `posts` (true: a post in the middle of the rack's front). `look`: `wood`, `panel` (hex: the base and the bin),
 * `header`, `basket` (hex), `grime`.
 */
export function bakeryMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const woodC = hex(look.wood);
  const panelC = hex(look.panel ?? look.wood);
  const headC = hex(look.header ?? '#2f5d3a');
  const wickerC = hex(look.basket ?? '#a07a45');
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-X, 0, -0.4], [X, 0.9, Z], scale3(panelC, 0.9), ['ny']);
    box(m, [-X, 0, -Z], [X, 1.5, 0.5], scale3(woodC, 0.85), ['ny']);
    return m;
  }
  // Solid: the two end pillars, the back board, the base in two steps, the baguette baskets, the roll bin, the rack
  // and the baskets on it. Open: above the steps, the toe space under the bin, between the pillars over the board.
  m.boxes = [
    [-X, 0, -Z, -0.75, h, -0.3],
    [0.75, 0, -Z, X, h, -0.3],
    [-0.75, 0, -0.9, 0.75, 1.5, -0.6],
    [-X, 0, -0.6, X, 1, 0.1],
    [-X, 0, 0.1, X, 0.8, 0.7],
    [-X, 0.3, 0.5, -0.75, 1.075, Z],
    [0.75, 0.3, 0.5, X, 1.075, Z],
    [-0.75, 0.3, 0.6, 0.75, 0.9, 0.9],
    [-X, 0.8, -0.4, X, 1.3, 0.5],
    [-0.85, 1.3, -0.4, 0.85, 1.45, 0.5],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const wood = (k = 1) => tone(scale3(woodC, k * (1 + r.jitter(0.05))), grime);
  const panel = (k = 1) => tone(scale3(panelC, k * (1 + r.jitter(0.03))), grime);
  const wicker = (k = 1) => tone(scale3(wickerC, k * (1 + r.jitter(0.08))), grime * 0.6);
  const dark = scale3(woodC, 0.25);
  const palette = LOAVES.map(hex);
  const fill = g.fill ?? 0.9;
  const loaf = () => tone(scale3(palette[r.int(0, palette.length - 1)], 1 + r.jitter(0.1)), 0);
  /** A basket of `n` loaves side by side: its wicker sides to `yw`, the loaves up to `yt`. */
  const basket = (x0, x1, z0, z1, y0, yw, yt, n) => {
    if (!fine) {
      const wk = wicker();
      box(m, [x0, y0, z0], [x1, lerp(yw, yt, 0.6), z1], (p, nn) => (nn[1] > 0.5 ? scale3(palette[1], 0.9) : wk(p, nn)), ['ny']);
      return;
    }
    box(m, [x0, y0, z0], [x1, yw, z1], wicker(), ['ny', 'py']);
    flat(m, x0, x1, z0, z1, lerp(y0, yw, 0.6), scale3(wickerC, 0.35));
    for (let i = 0; i < n; i++) {
      const c = loaf();
      if (r.next() > fill) continue;
      const a = lerp(x0, x1, i / n) + 0.012;
      const b = lerp(x0, x1, (i + 1) / n) - 0.012;
      pad(m, [a, lerp(y0, yw, 0.6), z0 + 0.02], [b, yt - r.next() * (yt - yw) * 0.35, z1 - 0.02], Math.min(0.035, (b - a) * 0.3), c);
    }
  };
  // The base: a kick, the body, the step behind.
  box(m, [-X + 0.04, 0, -0.56], [X - 0.04, 0.07, 0.66], scale3(panelC, 0.3), ['ny', 'py']);
  box(m, [-X, 0.07, -0.6], [X, 0.8, 0.7], panel());
  box(m, [-X, 0.8, -0.6], [X, 1, 0.1], panel(0.95), ['ny']);
  if (fine) seams(m, -X + 0.02, X - 0.02, [0.25, 0.43], 0.701, 1, scale3(panelC, 0.4));
  // The rack: side panels, a top board, a back, a slanted shelf in front of the step, a rail along its foot.
  const xi = X - 0.04;
  for (const s of [-1, 1]) box(m, [s > 0 ? xi : -X, 0.8, -0.4], [s > 0 ? X : -xi, 1.3, 0.5], wood(), ['ny']);
  box(m, [-xi, 1.26, -0.4], [xi, 1.3, 0.5], wood(1.05), ['nx', 'px']);
  box(m, [-xi, 1, -0.4], [xi, 1.26, -0.37], wood(0.7), ['nx', 'px', 'ny', 'py']);
  quadN(m, [-xi, 0.84, 0.46], [xi, 0.84, 0.46], [xi, 1, 0.1], [-xi, 1, 0.1], [0, 1, 0.4], wood(0.8));
  if (fine) {
    box(m, [-xi, 0.8, 0.46], [xi, 0.86, 0.5], wood(), ['nx', 'px', 'ny']);
    if (g.posts ?? true) box(m, [-0.025, 0.86, 0.45], [0.025, 1.26, 0.5], wood(), ['ny', 'py']);
  }
  // Baskets in the rack, two bays wide: a row on the slanted shelf, a row on the step.
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const x0 = s < 0 ? lerp(-xi + 0.02, -0.04, i / 2) : lerp(0.04, xi - 0.02, i / 2);
    const x1 = x0 + (xi - 0.06) / 2 - 0.02;
    basket(x0, x1, 0.14, 0.44, 0.86, 1, 1.1, 3);
    basket(x0, x1, -0.34, 0.07, 1, 1.07, 1.2, 3);
  }
  // Baskets on the rack's top.
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) basket(lerp(-0.85, 0.85, i / 3) + 0.012, lerp(-0.85, 0.85, (i + 1) / 3) - 0.012, j ? 0.06 : -0.39, j ? 0.49 : 0.03, 1.3, 1.37, 1.45, 3);
  // The back board, a painted header along its top (both faces), between the end pillars with their caps.
  box(m, [-0.75, 0, -0.9], [0.75, 1.5, -0.6], wood(0.9), ['ny', 'nx', 'px']);
  for (const s of [-1, 1]) {
    face(m, -0.72, 1.3, 0.72, 1.48, s > 0 ? -0.598 : -0.902, s, tone(headC, grime));
    if (fine) face(m, -0.66, 1.37, 0.66, 1.41, s > 0 ? -0.596 : -0.904, s, scale3(mix3(headC, [1, 1, 1], 0.7), 1));
    const x0 = s > 0 ? 0.75 : -X;
    const x1 = s > 0 ? X : -0.75;
    box(m, [x0, 0, -Z], [x1, h - 0.06, -0.3], wood(), ['ny', 'py']);
    box(m, [x0, h - 0.06, -Z], [x1, h, -0.3], tone(headC, grime), ['ny']);
    if (fine) face(m, x0 + 0.05, 0.15, x1 - 0.05, 1.42, -0.298, 1, wood(0.78));
    // A basket of baguettes at each end of the front.
    box(m, [x0, 0.3, 0.5], [x1, 0.9, Z], wicker(), ['py']);
    flat(m, x0, x1, 0.5, Z, 0.88, scale3(wickerC, 0.35));
    if (fine) {
      for (let k = 0; k < 5; k++) {
        const bx = lerp(x0 + 0.05, x1 - 0.05, r.next());
        const bz = lerp(0.56, Z - 0.06, r.next());
        box(m, [bx - 0.03, 0.88, bz - 0.03], [bx + 0.03, lerp(0.98, 1.075, r.next()), bz + 0.03], loaf(), ['ny']);
      }
    } else box(m, [x0 + 0.06, 0.88, 0.58], [x1 - 0.06, 1.04, Z - 0.08], scale3(palette[1], 0.9), ['ny']);
  }
  // The roll bin on the front.
  box(m, [-0.75, 0.3, 0.6], [0.75, 0.84, 0.9], panel(1.05), ['py', 'nx', 'px']);
  flat(m, -0.75, 0.75, 0.6, 0.9, fine ? 0.82 : 0.86, fine ? scale3(panelC, 0.35) : scale3(palette[3], 0.85));
  if (fine) {
    for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) {
      const c = loaf();
      if (r.next() > fill) continue;
      pad(m, [lerp(-0.74, 0.74, i / 10) + 0.008, 0.82, 0.61 + j * 0.145], [lerp(-0.74, 0.74, (i + 1) / 10) - 0.008, 0.9 - r.next() * 0.03, 0.745 + j * 0.145], 0.03, c);
    }
  }
  return m;
}

// ---------------------------------------------------------------- the checkout

/**
 * A checkout: a belt counter along z at +x (the belt, a scanner plate, a bagging plate), and at −x in front a till
 * cabinet under a ledge that stands a little over the counter (the divider), a till and a screen on it; the cashier
 * stands in the open corner (−x, −z). Settings `g`: `screen` ('box' or 'flat'). `look`: `body`, `top`, `trim` (hex:
 * the ledge), `belt`, `till` (hex), `grime`.
 */
export function checkoutMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const bodyC = hex(look.body);
  const topC = hex(look.top ?? '#c9c4b8');
  const trimC = hex(look.trim ?? '#3a3d42');
  const tillC = hex(look.till ?? '#26282b');
  const m = new Mesh();
  if (level >= 2) {
    box(m, [0, 0, -Z], [X, 0.6, 0.8], scale3(bodyC, 0.9), ['ny']);
    box(m, [-X, 0, -0.2], [0.2, 0.8, Z], scale3(mix3(bodyC, trimC, 0.4), 0.9), ['ny']);
    box(m, [-0.759, 0.8, 0.2], [-0.3, h, 0.567], tillC, ['ny']);
    return m;
  }
  // Solid: the belt counter, the till cabinet, its ledge, the till, the screen. Open: the cashier's corner.
  m.boxes = [
    [0, 0, -Z, X, 0.6, 0.8],
    [-0.8, 0, -0.1, 0.1, 0.8, 0.8],
    [-X, 0.5, -0.2, 0.2, 0.7, Z],
    [-0.759, 0.7, -0.007, -0.129, 0.9, 0.6],
    [-0.759, 0.7, 0.2, -0.3, h, 0.567],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.2;
  const body = (k = 1) => tone(scale3(bodyC, k * (1 + r.jitter(0.03))), grime);
  const top = tone(topC, grime * 0.5);
  const steel = tone(hex('#9aa0a4'), grime * 0.5);
  const beltC = hex(look.belt ?? '#1b1c1e');
  const kick = scale3(trimC, 0.5);
  // The belt counter.
  box(m, [0.03, 0, -Z + 0.03], [X - 0.03, 0.08, 0.77], kick, ['ny', 'py']);
  box(m, [0, 0.08, -Z], [X, 0.56, 0.8], body(), ['py']);
  box(m, [0, 0.56, -Z], [X, 0.6, 0.8], top, ['ny']);
  flat(m, 0.14, X - 0.07, -Z + 0.05, -0.03, 0.602, (p) => scale3(beltC, 0.85 + 0.3 * clamp01(1 - Math.abs(p[0] - X / 2) * 4)));
  flat(m, 0.2, X - 0.1, 0.03, 0.3, 0.602, scale3(hex('#101214'), 1));
  flat(m, 0.26, X - 0.06, 0.38, 0.76, 0.602, tone(hex('#8b9094'), 0, 0.9));
  if (fine) {
    for (const x of [0.12, X - 0.07]) flat(m, x, x + 0.02, -Z + 0.05, -0.03, 0.603, steel);
    flat(m, 0.17, X - 0.07, 0, 0.33, 0.601, steel);
    // The scanner's cross and a divider bar lying on the belt: paint and plastic.
    flat(m, 0.3, X - 0.2, 0.16, 0.17, 0.603, scale3(hex('#5a2a26'), 1));
    flat(m, (0.2 + X - 0.1) / 2 - 0.005, (0.2 + X - 0.1) / 2 + 0.005, 0.08, 0.25, 0.603, scale3(hex('#5a2a26'), 1));
    const zb = lerp(-Z + 0.2, -0.3, r.next());
    box(m, [0.16, 0.602, zb], [X - 0.09, 0.632, zb + 0.03], tone(hex(look.bar ?? '#c9a227'), 0), ['ny']);
  }
  // The till cabinet, its top, the ledge round it.
  box(m, [-0.77, 0, -0.07], [0, 0.08, 0.77], kick, ['ny', 'py', 'px']);
  box(m, [-0.8, 0.08, -0.1], [0.1, 0.76, 0.8], body(0.96), ['py', 'ny']);
  box(m, [-0.8, 0.76, -0.1], [0.1, 0.8, 0.8], top, ['ny']);
  box(m, [-X, 0.5, -0.2], [0.2, 0.7, Z], tone(trimC, grime));
  // The till: a drawer unit with keys on its top, towards the cashier.
  box(m, [-0.759, 0.8, -0.007], [-0.129, 0.9, 0.6], tone(tillC, 0), ['ny']);
  if (fine) {
    face(m, -0.72, 0.82, -0.17, 0.875, -0.009, -1, tone(hex('#8b9094'), 0, 0.9));
    face(m, -0.5, 0.84, -0.39, 0.855, -0.011, -1, scale3(tillC, 0.6));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) flat(m, -0.7 + i * 0.07, -0.65 + i * 0.07, 0.03 + j * 0.055, 0.07 + j * 0.055, 0.902, scale3(hex(i === 3 ? '#8a6a2c' : '#b9bdc0'), 1));
  }
  // The screen, facing the cashier: dark paint, a few still lines on it.
  const flatScreen = (g.screen ?? 'box') === 'flat';
  const z0 = flatScreen ? 0.3 : 0.21;
  const z1 = flatScreen ? 0.36 : 0.567;
  box(m, [-0.58, 0.9, 0.33], [-0.48, flatScreen ? 1.0 : 0.96, 0.43], scale3(tillC, 0.8), ['ny', 'py']);
  if (flatScreen) box(m, [-0.56, 0.9, 0.2], [-0.5, 0.92, 0.567], scale3(tillC, 0.8), ['ny']);
  box(m, [-0.759, flatScreen ? 0.97 : 0.95, z0], [-0.3, h, z1], tone(tillC, 0, 1.2));
  face(m, -0.735, flatScreen ? 0.995 : 0.975, -0.324, h - 0.025, z0 - 0.002, -1, scale3(hex('#0c1114'), 1));
  if (fine) {
    const ink = scale3(hex(look.ink ?? '#4f8a5a'), 0.8);
    for (let k = 0; k < 4; k++) face(m, -0.7, 1.13 - k * 0.035, -0.7 + 0.12 + r.next() * 0.2, 1.142 - k * 0.035, z0 - 0.004, -1, ink);
    face(m, -0.45, 1.0, -0.35, 1.03, z0 - 0.004, -1, scale3(hex('#8a6a2c'), 0.9));
  }
  return m;
}

// ---------------------------------------------------------------- the chest freezer

const FROZEN = ['#c94a3a', '#3f6d9b', '#e3dccb', '#5f9a4a', '#d9a429', '#7a4a8a', '#d87a2a'];

/**
 * A chest freezer island: an enamelled tub on a recessed plinth, a bumper rail round it out to the bounds, a framed
 * top of sliding lids over the goods (the glass is not drawn). Settings `g`: `lids` (lids along it), `rows` (goods
 * across), `gaps` (0–1). `look`: `paint`, `bumper`, `trim` (hex: the lids' frames), `inside` (hex), `grime`.
 */
export function chestFreezerMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const paintC = hex(look.paint);
  const insideC = hex(look.inside ?? '#c3d0d6');
  if (level >= 2) return standIn(size, scale3(mix3(paintC, insideC, 0.5), 0.9), scale3(paintC, 0.9));
  const m = new Mesh();
  // Solid: the plinth and the top (in from the ends and the sides), the tub with its bumper (the bounds).
  m.boxes = [[-1.05, 0, -0.8, 1.05, h, 0.8], [-X, 0.2, -Z, X, 0.9, Z]];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.2;
  const enamel = tone(scale3(paintC, 1 + r.jitter(0.02)), grime);
  const bumper = tone(hex(look.bumper ?? '#2b2d30'), grime);
  const trim = tone(hex(look.trim ?? '#8b9094'), 0);
  const palette = FROZEN.map(hex);
  const xo = 1.05;
  const zo = 0.8;
  box(m, [-xo, 0, -zo], [xo, 0.2, zo], scale3(hex('#1c1d1f'), 1), ['ny', 'py']);
  const set = fine ? 0.025 : 0;
  box(m, [-X + set, 0.2, -Z + set], [X - set, 0.9, Z - set], enamel);
  if (fine) {
    // The bumper rail, out to the bounds; a strip of the same along the tub's foot.
    for (const [y0, y1] of [[0.44, 0.52], [0.2, 0.24]]) {
      for (const s of [-1, 1]) {
        box(m, [-X, y0, s > 0 ? Z - set : -Z], [X, y1, s > 0 ? Z : -Z + set], bumper, [s > 0 ? 'nz' : 'pz']);
        box(m, [s > 0 ? X - set : -X, y0, -Z + set], [s > 0 ? X : -X + set, y1, Z - set], bumper, [s > 0 ? 'nx' : 'px', 'nz', 'pz']);
      }
    }
  }
  // The top: its sides, a frame, the cavity with goods in it, the lids' frames.
  box(m, [-xo, 0.9, -zo], [xo, h, zo], enamel, ['ny', 'py']);
  const fw = 0.07;
  const xi = xo - fw;
  const zi = zo - fw;
  flat(m, -xo, xo, -zo, -zi, h, trim);
  flat(m, -xo, xo, zi, zo, h, trim);
  flat(m, -xo, -xi, -zi, zi, h, trim);
  flat(m, xi, xo, -zi, zi, h, trim);
  const yc = 0.93;
  const lit = (k = 1) => scale3(insideC, k);
  flat(m, -xi, xi, -zi, zi, yc, lit(0.8));
  const lids = Math.max(2, g.lids ?? 3);
  const rows = Math.max(2, g.rows ?? 3);
  // Goods: packs lying in rows under the lids (their own draw, the same at every level of detail).
  const q = rng(seed * 131 + 5);
  const cols = lids * 2 + 1;
  const packs = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) packs.push({ i, j, c: scale3(palette[q.int(0, palette.length - 1)], 1 + q.jitter(0.1)), top: lerp(0.95, 0.985, q.next()), gone: q.next() < (g.gaps ?? 0.1) });
  if (fine) {
    for (const s of [-1, 1]) {
      quadN(m, [-xi, yc, s * zi], [xi, yc, s * zi], [xi, h, s * zi], [-xi, h, s * zi], [0, 0, -s], lit(0.6));
      quadN(m, [s * xi, yc, -zi], [s * xi, yc, zi], [s * xi, h, zi], [s * xi, h, -zi], [-s, 0, 0], lit(0.55));
    }
    for (const { i, j, c, top, gone } of packs) {
      if (gone) continue;
      box(m, [lerp(-xi, xi, i / cols) + 0.02, yc, lerp(-zi, zi, j / rows) + 0.02], [lerp(-xi, xi, (i + 1) / cols) - 0.02, top, lerp(-zi, zi, (j + 1) / rows) - 0.02], (p, n) => scale3(c, n[1] > 0.5 ? 1 : 0.6), ['ny']);
    }
  } else {
    // One patch under each half of a lid, the mean colour of the packs there.
    for (let i = 0; i < lids; i++) for (let j = 0; j < 2; j++) {
      const under = packs.filter((p) => !p.gone && (p.i + 0.5) / cols >= i / lids && (p.i + 0.5) / cols < (i + 1) / lids && (j ? (p.j + 0.5) / rows >= 0.5 : (p.j + 0.5) / rows <= 0.5));
      if (!under.length) continue;
      const mean = under.reduce((a, p) => [a[0] + p.c[0] / under.length, a[1] + p.c[1] / under.length, a[2] + p.c[2] / under.length], [0, 0, 0]);
      flat(m, lerp(-xi, xi, i / lids) + 0.05, lerp(-xi, xi, (i + 1) / lids) - 0.05, j ? 0.05 : -zi + 0.04, j ? zi - 0.04 : -0.05, yc + 0.03, scale3(mean, 0.9));
    }
  }
  // The lids' frames: a rail down the middle, one between each pair of lids, a pull on each lid.
  flat(m, -xi, xi, -0.025, 0.025, h, trim);
  for (let i = 1; i < lids; i++) flat(m, lerp(-xi, xi, i / lids) - 0.02, lerp(-xi, xi, i / lids) + 0.02, -zi, zi, h, trim);
  if (fine) for (let i = 0; i < lids; i++) for (const s of [-1, 1]) flat(m, lerp(-xi, xi, (i + 0.5) / lids) - 0.08, lerp(-xi, xi, (i + 0.5) / lids) + 0.08, s * 0.06 - 0.012, s * 0.06 + 0.012, h, scale3(hex('#2b2d30'), 1));
  return m;
}

// ---------------------------------------------------------------- the bottle-return machine

/**
 * A bottle-return machine, its front at +z: a cabinet with a crate slot at its foot, a round intake hole, a small
 * screen and a receipt slot in its front, a kick plate; a housing and a sign box on its top, off centre. Settings
 * `g`: `hole` (the intake's radius, m), `vents` (slats on the housing). `look`: `paint`, `accent` (hex: the sign and
 * the band), `plate` (hex: the kick plate), `grime`.
 */
export function bottleReturnMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const paintC = hex(look.paint);
  const accentC = hex(look.accent ?? '#2f7a4a');
  if (level >= 2) {
    const m = new Mesh();
    box(m, [-X, 0, -Z], [X, 1.45, Z], scale3(paintC, 0.9), ['ny']);
    box(m, [-0.285, 1.45, -0.349], [0.333, h, 0.25], scale3(accentC, 0.9), ['ny']);
    return m;
  }
  const m = new Mesh();
  // Solid: the cabinet's foot either side of the crate slot, the sill under the slot and the wall behind it, the
  // body, its cap, the housing and the sign box. Open: the crate slot; round the housing and the sign.
  const zs = 0.44;
  m.boxes = [
    [-X, 0, -zs, -0.15, 0.5, zs],
    [0.15, 0, -zs, X, 0.5, zs],
    [-0.15, 0, -zs, 0.15, 0.2, zs],
    [-0.15, 0.2, -zs, 0.15, 0.5, 0.05],
    [-X, 0.5, -zs, X, 1.4, zs],
    [-0.35, 1.4, -0.35, 0.35, 1.5, zs],
    [-0.15, 1.5, -0.349, 0.333, 1.8, 0.25],
    [-0.285, 1.6, -0.289, 0.15, h, 0.05],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.2;
  const paint = (k = 1) => tone(scale3(paintC, k * (1 + r.jitter(0.02))), grime);
  const accent = tone(accentC, grime * 0.5);
  const dark = scale3(hex('#111315'), 1);
  const steel = tone(hex(look.plate ?? '#8b9094'), grime);
  const zf = Z - 0.012;
  // The foot either side of the crate slot, the sill, the slot's back; the body over them.
  box(m, [-X, 0, -Z], [-0.15, 0.5, zf], paint(), ['ny', 'py']);
  box(m, [0.15, 0, -Z], [X, 0.5, zf], paint(), ['ny', 'py']);
  box(m, [-0.15, 0, -Z], [0.15, 0.2, zf], paint(0.9), ['ny', 'nx', 'px']);
  box(m, [-0.15, 0.2, -Z], [0.15, 0.5, 0.05], scale3(paintC, 0.3), ['ny', 'py', 'nx', 'px']);
  box(m, [-X, 0.5, -Z], [X, 1.4, zf], paint());
  // The kick plate, proud of the front, either side of the slot and under it.
  box(m, [-X + 0.01, 0.02, zf], [X - 0.01, 0.19, Z], steel, ['nz']);
  // The cap, the housing with its slats, the sign box with a bottle painted on it.
  box(m, [-0.35, 1.4, -0.35], [0.35, 1.5, zf], paint(0.92), ['ny']);
  box(m, [-0.15, 1.5, -0.349], [0.333, 1.8, 0.25], paint(0.8), ['ny']);
  box(m, [-0.285, 1.6, -0.289], [0.15, h, 0.05], accent);
  const pale = scale3(hex('#e6e2d6'), 1);
  face(m, -0.115, 1.66, -0.02, 1.86, 0.052, 1, pale);
  face(m, -0.085, 1.86, -0.05, 1.94, 0.052, 1, pale);
  if (fine) {
    const n = Math.max(2, g.vents ?? 4);
    for (let k = 0; k < n; k++) face(m, 0.17, 1.56 + k * 0.05, 0.31, 1.58 + k * 0.05, 0.252, 1, scale3(paintC, 0.3));
    face(m, -0.1, 1.7, -0.035, 1.76, 0.054, 1, accent);
  }
  // The front: a band of the accent paint, the intake's collar and hole, the screen in its bezel, the receipt slot.
  face(m, -X + 0.02, 0.56, X - 0.02, 0.68, zf + 0.002, 1, accent);
  const hole = g.hole ?? 0.13;
  const [hx, hy] = [-0.1, 1.02];
  const seg = fine ? 12 : 8;
  cyl(m, 2, hx, hy, zf + 0.002, zf + 0.004, hole, seg, dark, { caps: '1' });
  if (fine) {
    cyl(m, 2, hx, hy, zf, Z, hole + 0.035, seg, steel);
    annulus(m, 2, hx, hy, Z, hole, hole + 0.035, seg, 1, steel);
    cyl(m, 2, hx, hy, zf + 0.004, Z, hole, seg, scale3(hex('#2a2d30'), 1), { inside: true });
    cyl(m, 2, hx + 0.02, hy - 0.02, zf + 0.005, zf + 0.006, hole * 0.6, 8, scale3(hex('#050607'), 1), { caps: '1' });
  }
  const [sx0, sx1, sy0, sy1] = [0.12, 0.34, 1.12, 1.3];
  if (fine) {
    box(m, [sx0, sy0, zf], [sx1, sy0 + 0.02, Z], dark, ['nz']);
    box(m, [sx0, sy1 - 0.02, zf], [sx1, sy1, Z], dark, ['nz']);
    box(m, [sx0, sy0 + 0.02, zf], [sx0 + 0.02, sy1 - 0.02, Z], dark, ['nz', 'ny', 'py']);
    box(m, [sx1 - 0.02, sy0 + 0.02, zf], [sx1, sy1 - 0.02, Z], dark, ['nz', 'ny', 'py']);
    // The screen: dark paint, an arrow and two bars on it (still paint: nothing lit).
    const ink = scale3(hex(look.ink ?? '#5a9a6a'), 0.8);
    face(m, sx0 + 0.02, sy0 + 0.02, sx1 - 0.02, sy1 - 0.02, zf + 0.002, 1, scale3(hex('#0c1114'), 1));
    face(m, sx0 + 0.04, sy1 - 0.06, sx0 + 0.14, sy1 - 0.045, zf + 0.004, 1, ink);
    face(m, sx0 + 0.04, sy1 - 0.09, sx0 + 0.11, sy1 - 0.075, zf + 0.004, 1, ink);
    face(m, sx1 - 0.07, sy0 + 0.04, sx1 - 0.04, sy0 + 0.1, zf + 0.004, 1, scale3(hex('#8a6a2c'), 0.9));
    // The receipt slot and its lip, a door seam.
    box(m, [0.13, 0.84, zf], [0.33, 0.87, Z - 0.002], steel, ['nz']);
    face(m, 0.15, 0.875, 0.31, 0.887, zf + 0.002, 1, dark);
    face(m, -X + 0.03, 0.72, -X + 0.036, 1.36, zf + 0.002, 1, scale3(paintC, 0.4));
    face(m, -0.02, 0.72, -0.014, 0.86, zf + 0.002, 1, scale3(paintC, 0.4));
  } else face(m, sx0, sy0, sx1, sy1, zf + 0.002, 1, scale3(hex('#0c1114'), 1));
  return m;
}

// ---------------------------------------------------------------- the produce stand

const PRODUCE = {
  fruit: ['#b8322a', '#d87a1f', '#d9b62a', '#7a9a2f', '#8a2f4a', '#c9482f'],
  veg: ['#4f7a2f', '#7a9a3a', '#c2571f', '#5a2f5a', '#b8a06a', '#8a2a22'],
};

/**
 * A produce stand, seen from every side: a slatted plinth under a tray of fruit with a heap in its middle; a crate
 * on a bracket against each of two sides under a price board, a long tray on a panel against the other two.
 * Settings `g`: `goods` ('fruit', 'veg' or 'mixed'), `fill` (0–1). `look`: `wood`, `crate`, `board` (hex: the price
 * boards), `grime`.
 */
export function produceMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const woodC = hex(look.wood);
  const crateC = hex(look.crate ?? look.wood);
  if (level >= 2) {
    const m = new Mesh();
    box(m, [-0.5, 0, -0.5], [0.5, 1.1, 0.5], scale3(woodC, 0.9), ['ny']);
    box(m, [-X, 0.3, -0.3], [X, 0.7, 0.3], scale3(crateC, 0.85));
    box(m, [-0.6, 0.5, -Z], [0.6, 0.7, Z], scale3(crateC, 0.85));
    return m;
  }
  const m = new Mesh();
  // Solid: the plinth and its tray, the side crates with their brackets and boards (along x), the long trays with
  // their panels (along z), the heap. Open: the corners, under the crates and the trays.
  m.boxes = [
    [-0.5, 0, -0.5, 0.5, 1.1, 0.5],
    [-0.6, 0.2, -0.2, 0.6, 1, 0.2],
    [-0.2, 0.2, -0.6, 0.2, 0.8, 0.6],
    [-X, 0.3, -0.3, X, 0.7, 0.3],
    [-0.6, 0.5, -Z, 0.6, 0.7, Z],
    [-0.12, 1.1, -0.1, 0.12, h, 0.14],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const wood = (k = 1) => tone(scale3(woodC, k * (1 + r.jitter(0.05))), grime);
  const crate = (k = 1) => tone(scale3(crateC, k * (1 + r.jitter(0.06))), grime * 0.7);
  const kinds = g.goods === 'veg' ? [PRODUCE.veg] : g.goods === 'fruit' ? [PRODUCE.fruit] : [PRODUCE.fruit, PRODUCE.veg];
  const fill = g.fill ?? 0.92;
  /** A crate of one kind of produce: its sides to `yw`, the produce (`nx` × `nz` of it) up to `yt`. */
  let crates = 0;
  const crateOf = (x0, x1, z0, z1, y0, yw, yt, nx, nz) => {
    // (What a crate holds is its own draw, the same at every level of detail.)
    const q = rng(seed * 131 + 7 * crates++);
    const pal = kinds[q.int(0, kinds.length - 1)];
    const base = hex(pal[q.int(0, pal.length - 1)]);
    if (!fine) {
      const ck = crate();
      box(m, [x0, y0, z0], [x1, lerp(yw, yt, 0.5), z1], (p, n) => (n[1] > 0.5 ? scale3(base, 0.9) : ck(p, n)));
      return;
    }
    box(m, [x0, y0, z0], [x1, yw, z1], crate(), ['py']);
    flat(m, x0, x1, z0, z1, lerp(y0, yw, 0.7), scale3(crateC, 0.3));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const c = scale3(base, 1 + r.jitter(0.14));
      if (r.next() > fill) continue;
      const a = [lerp(x0, x1, i / nx) + 0.008, lerp(y0, yw, 0.7), lerp(z0, z1, j / nz) + 0.008];
      const b = [lerp(x0, x1, (i + 1) / nx) - 0.008, yt - r.next() * (yt - yw) * 0.5, lerp(z0, z1, (j + 1) / nz) - 0.008];
      pad(m, a, b, Math.min(b[0] - a[0], b[2] - a[2]) * 0.3, tone(c, 0));
    }
  };
  // The plinth, slatted; the tray on it and the heap in its middle.
  box(m, [-0.5, 0, -0.5], [0.5, 1, 0.5], wood(), ['ny', 'py']);
  if (fine) for (const s of [-1, 1]) seams(m, -0.5, 0.5, [0.16, 0.34, 0.52, 0.86], s * 0.5 + s * 0.0005, s, scale3(woodC, 0.3));
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) crateOf(i ? 0.004 : -0.5, i ? 0.5 : -0.004, j ? 0.004 : -0.5, j ? 0.5 : -0.004, 1, 1.06, 1.1, 3, 3);
  const heap = hex(kinds[0][rng(seed * 131 + 999).int(0, kinds[0].length - 1)]);
  pad(m, [-0.12, fine ? 1.08 : 1.06, -0.1], [0.12, h, 0.14], 0.05, tone(heap, 0));
  if (fine) pad(m, [-0.05, 1.12, -0.04], [0.05, h, 0.06], 0.02, tone(scale3(heap, 0.6), 0));
  for (const s of [-1, 1]) {
    // Along x: a bracket, a crate out to the bounds, a price board above it.
    const xa = s > 0 ? 0.5 : -0.6;
    const xb = s > 0 ? 0.6 : -0.5;
    box(m, [xa, 0.2, -0.2], [xb, 0.3, 0.2], wood(0.8), ['py']);
    crateOf(s > 0 ? 0.5 : -X, s > 0 ? X : -0.5, -0.3, 0.3, 0.3, 0.64, 0.7, 2, 4);
    box(m, [xa, 0.7, -0.2], [xb, 1, 0.2], tone(hex(look.board ?? '#23262a'), 0), ['ny']);
    if (fine) {
      // Chalk lines on the board (still paint).
      for (let k = 0; k < 3; k++) {
        const z1 = -0.03 + r.next() * 0.15;
        const y = 0.9 - k * 0.07;
        quadN(m, [s * 0.601, y, -0.15], [s * 0.601, y, z1], [s * 0.601, y + 0.02, z1], [s * 0.601, y + 0.02, -0.15], [s, 0, 0], scale3(hex('#d8d2c0'), 0.9));
      }
    }
    // Along z: a panel, a long tray out to the bounds, price tags on its lip.
    const za = s > 0 ? 0.5 : -0.6;
    const zb = s > 0 ? 0.6 : -0.5;
    box(m, [-0.2, 0.2, za], [0.2, 0.8, zb], wood(0.85));
    for (let k = 0; k < 2; k++) crateOf(k ? 0.004 : -0.6, k ? 0.6 : -0.004, s > 0 ? 0.5 : -Z + 0.004, s > 0 ? Z - 0.004 : -0.5, 0.5, 0.65, 0.7, 4, 2);
    if (fine) for (const x of [-0.42, -0.14, 0.2, 0.46]) face(m, x - 0.05, 0.56, x + 0.05, 0.62, s * Z, s, scale3(hex('#e6e2d6'), 0.95));
  }
  return m;
}
