// Plant-room pieces (kit-prop families of part 9; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): a control console
// (`console`: a bank of screens on two cabinets and two skids, a button shelf and a sloped keyboard desk in front of
// it; the operator stands at −z, as at the piece it replaces) and a valve on a large pipe (`valve`: a pipe section
// along x, open through both ends, a flange each end on a foot, a valve body round its middle with a hand wheel at
// −z and a blind boss at +z). Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2].
//
// Both collide as finer boxes (a generator's `boxes`: tools/content/kitprops.mjs), the same for each variant: the
// console's are the nine the retired piece had; the valve's are sixteen for its twenty-five: the pipe as walls
// round its bore (which stays open from end to end, as it was), each flange as four pieces round the bore, the boss.
// The pipe's axis is where the retired piece's was (the middle of the height, 12.5 mm towards +z), so it still meets
// the pipe pieces placed against its ends. The boxes are in metres: a family here has one size, its retired prop's.
//
// Nothing here glows or blinks: a screen is dark paint with a few still shapes, a lamp is a dull painted dot
// (CLAUDE.md, "Accessibility").
//
// Level 1 keeps the outline with far fewer triangles; level 2 is a stand-in of three boxes.

import { rng } from '../env/rng.mjs';
import { Mesh, annulus, bar, box, cyl, groundShade, hex, mix3, quadN, scale3 } from './geom.mjs';

const lerp = (p, q, t) => p + (q - p) * t;
/** Paint on a piece whose front is −z: darker towards the ground, underneath, on the sides and at the back. */
const tone = (c, grime = 0.2, k = 1) => (p, n) => scale3(c, k * groundShade(p[1], 0.25, 1 - grime * 0.5) * (n[1] > 0.5 ? 1.07 : n[1] < -0.5 ? 0.62 : Math.abs(n[0]) > 0.5 ? 0.88 : n[2] > 0.5 ? 0.8 : 1));
/** A flat quad at `z` facing `s` (±z). */
const face = (m, x0, y0, x1, y1, z, s, colour) => quadN(m, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, s], colour);
const flat = (m, x0, x1, z0, z1, y, colour) => quadN(m, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], colour);

// ---------------------------------------------------------------- the control console

const INKS = ['#b8862a', '#4f8a5a', '#5a8a9a', '#9a4a3a'];
const LAMPS = ['#7a2a26', '#8a6a2c', '#3f6a45', '#6a6e72'];

/**
 * A control console, the operator at −z. Settings `g`: `screens` (how many across the bank), `desk` ('keys': a
 * keyboard on the sloped desk; 'sliders': rows of slots and knobs). `look`: `paint` (hex: the cabinets), `desk`
 * (hex), `dark` (hex: the skids, the bezels, the wings), `ink` (hex: the main colour of the shapes on the screens),
 * `grime`.
 */
export function consoleMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const paintC = hex(look.paint);
  const deskC = hex(look.desk ?? look.paint);
  const darkC = hex(look.dark ?? '#1e2124');
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-X, 0.4, -0.05], [X, h, 0.25], scale3(mix3(paintC, darkC, 0.4), 0.9), ['ny']);
    box(m, [-0.6, 0.4, -Z], [0.6, 0.7, -0.05], scale3(deskC, 0.9), ['pz']);
    box(m, [-0.8, 0, -0.05], [0.8, 0.4, Z], scale3(darkC, 1.2), ['ny', 'py']);
    return m;
  }
  // Solid: the two skids, the two cabinets behind the bank, the keyboard desk, the bank of screens, the button
  // shelf, the bank's two wings. Open: under the desk and the shelf, between the cabinets, round the skids.
  m.boxes = [
    [0.484, 0, -0.256, 0.726, 0.3, 0.47],
    [-0.726, 0, -0.256, -0.484, 0.3, 0.47],
    [0.4, 0.3, -0.05, 0.8, 1.5, 0.53],
    [-0.8, 0.3, -0.05, -0.4, 1.5, 0.53],
    [-0.6, 0.4, -0.53, 0.6, 0.7, 0.15],
    [-0.968, 0.4, -0.05, 0.968, h, 0.25],
    [-0.968, 0.5, -0.25, 0.968, 0.7, 0.15],
    [0.8, 0.7, -0.17, 0.968, 1.3, 0.15],
    [-0.968, 0.7, -0.17, -0.8, 1.3, 0.15],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  const paint = (k = 1) => tone(scale3(paintC, k * (1 + r.jitter(0.02))), grime);
  const dark = (k = 1) => tone(scale3(darkC, k), grime * 0.5);
  const desk = tone(deskC, grime * 0.6);
  const glass = scale3(hex('#0b1013'), 1);
  for (const s of [-1, 1]) {
    // A skid, the cabinet on it (slats in its outer side), a wing at the end of the bank with four painted lamps.
    box(m, [s > 0 ? 0.484 : -0.726, 0, -0.256], [s > 0 ? 0.726 : -0.484, 0.3, 0.47], dark(1.1), ['ny']);
    box(m, [s > 0 ? 0.4 : -0.8, 0.3, -0.05], [s > 0 ? 0.8 : -0.4, 1.5, Z], paint(0.92));
    box(m, [s > 0 ? 0.8 : -X, 0.7, -0.17], [s > 0 ? X : -0.8, 1.3, -0.05], dark(1.5), ['pz']);
    if (fine) {
      for (let k = 0; k < 5; k++) quadN(m, [s * 0.802, 1.0 + k * 0.07, 0.3], [s * 0.802, 1.0 + k * 0.07, 0.48], [s * 0.802, 1.03 + k * 0.07, 0.48], [s * 0.802, 1.03 + k * 0.07, 0.3], [s, 0, 0], scale3(paintC, 0.3));
      for (let k = 0; k < 4; k++) face(m, s * 0.884 - 0.03, 0.8 + k * 0.11, s * 0.884 + 0.03, 0.86 + k * 0.11, -0.172, -1, scale3(hex(LAMPS[(k + (s > 0 ? 0 : 2)) % LAMPS.length]), 0.9));
    }
  }
  // The bank: a cabinet the width of the bounds, a panel in its back, a name strip over the screens.
  box(m, [-X, 0.4, -0.05], [X, h, 0.25], paint());
  if (fine) {
    face(m, -0.36, 0.6, 0.36, 1.5, 0.252, 1, paint(0.7));
    face(m, -0.78, 1.53, 0.78, 1.57, -0.052, -1, scale3(mix3(paintC, [1, 1, 1], 0.5), 1));
  }
  // The screens: a bezel, dark paint, a few still shapes each (bars, a stepped trace, a grid of dots).
  const n = Math.max(1, g.screens ?? 3);
  const main = hex(look.ink ?? INKS[0]);
  for (let i = 0; i < n; i++) {
    const x0 = lerp(-0.78, 0.78, i / n) + 0.015;
    const x1 = lerp(-0.78, 0.78, (i + 1) / n) - 0.015;
    const [y0, y1] = [0.8, 1.5];
    face(m, x0, y0, x1, y1, -0.052, -1, dark(0.9));
    face(m, x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, -0.054, -1, glass);
    if (!fine) continue;
    const q = rng(seed * 31 + i * 7);
    const ink = (k) => scale3(k ? hex(INKS[q.int(1, INKS.length - 1)]) : main, 0.75);
    const [a, b, c, e] = [x0 + 0.06, x1 - 0.06, y0 + 0.07, y1 - 0.07];
    const kind = (i + seed) % 3;
    if (kind === 0) {
      for (let k = 0; k < 5; k++) face(m, lerp(a, b, k / 5) + 0.01, c, lerp(a, b, (k + 1) / 5) - 0.01, lerp(c, e, q.range(0.2, 0.95)), -0.056, -1, ink(k === 3));
    } else if (kind === 1) {
      let y = lerp(c, e, 0.5);
      for (let k = 0; k < 6; k++) {
        face(m, lerp(a, b, k / 6), y, lerp(a, b, (k + 1) / 6), y + 0.012, -0.056, -1, ink(0));
        y = lerp(c, e, q.range(0.15, 0.85));
      }
      face(m, a, c, b, c + 0.008, -0.056, -1, ink(1));
    } else {
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) face(m, lerp(a, b, (k + 0.3) / 3), lerp(c, e, (j + 0.3) / 3), lerp(a, b, (k + 0.7) / 3), lerp(c, e, (j + 0.7) / 3), -0.056, -1, ink((k + j) % 3 === 0));
    }
  }
  // The button shelf along the bank's foot: a row of painted buttons on it.
  box(m, [-X, 0.5, -0.25], [X, 0.7, -0.05], desk, ['pz']);
  if (fine) {
    for (let k = 0; k < 14; k++) {
      const x = lerp(-0.9, 0.9, (k + 0.5) / 14);
      flat(m, x - 0.028, x + 0.028, -0.19, -0.13, 0.702, scale3(hex(LAMPS[r.int(0, LAMPS.length - 1)]), 0.9));
    }
  }
  // The keyboard desk: a wedge sloping down to the front of the bounds, a block under the shelf.
  const [zb, zf, yb, yf] = [-0.25, -Z, 0.7, 0.58];
  const S = (x, t, lift = 0) => [x, lerp(yb, yf, t) + lift, lerp(zb, zf, t)];
  quadN(m, S(-0.6, 0), S(0.6, 0), S(0.6, 1), S(-0.6, 1), [0, 1, -0.2], desk);
  face(m, -0.6, 0.4, 0.6, yf, zf, -1, desk);
  quadN(m, [-0.6, 0.4, zf], [0.6, 0.4, zf], [0.6, 0.4, -0.05], [-0.6, 0.4, -0.05], [0, -1, 0], desk);
  for (const s of [-1, 1]) {
    quadN(m, [s * 0.6, 0.4, zb], [s * 0.6, 0.4, zf], [s * 0.6, yf, zf], [s * 0.6, yb, zb], [s, 0, 0], desk);
    quadN(m, [s * 0.6, 0.4, -0.05], [s * 0.6, 0.4, zb], [s * 0.6, 0.5, zb], [s * 0.6, 0.5, -0.05], [s, 0, 0], desk);
  }
  const up = 0.002;
  const onDesk = (xa, xb, ta, tb, colour, k = 1) => quadN(m, S(xa, ta, up * k), S(xb, ta, up * k), S(xb, tb, up * k), S(xa, tb, up * k), [0, 1, -0.2], colour);
  if ((g.desk ?? 'keys') === 'sliders') {
    onDesk(-0.5, 0.5, 0.15, 0.85, scale3(darkC, 1.3));
    if (fine) {
      for (let k = 0; k < 8; k++) {
        const x = lerp(-0.44, 0.44, k / 7);
        onDesk(x - 0.006, x + 0.006, 0.22, 0.78, scale3(hex('#050607'), 1), 2);
        const t = r.range(0.25, 0.7);
        onDesk(x - 0.025, x + 0.025, t, t + 0.08, scale3(hex('#b9bdc0'), 0.9), 3);
      }
    }
  } else {
    onDesk(-0.32, 0.32, 0.2, 0.85, scale3(darkC, 1.2));
    if (fine) {
      for (let k = 0; k < 4; k++) onDesk(-0.3 + (k % 2) * 0.01, 0.3 - (k % 2) * 0.01, 0.25 + k * 0.145, 0.25 + k * 0.145 + 0.1, scale3(hex('#9a9ea2'), 0.9), 2);
      for (let k = 0; k < 3; k++) onDesk(0.4, 0.52, 0.22 + k * 0.22, 0.22 + k * 0.22 + 0.14, scale3(hex(LAMPS[k]), 0.9), 2);
      onDesk(-0.52, -0.4, 0.3, 0.75, scale3(darkC, 1.4), 2);
    }
  }
  return m;
}

// ---------------------------------------------------------------- the valve on a large pipe

/**
 * A valve on a large pipe along x. Settings `g`: `pipe` (the pipe's outer radius, m), `bore` (its bore's radius),
 * `flange` (how far in from each end the flanges reach), `bolts` (bolts a flange), `spokes` (bars across the hand
 * wheel). `look`: `pipe`, `flange`, `body` (hex: the valve body), `wheel` (hex), `bolt` (hex), `grime`.
 */
export function valveMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  // The flanges are as wide as the piece is tall, and reach the bounds at +z; the wheel reaches them at −z.
  const R = h / 2;
  const yc = h / 2;
  const zc = Z - R;
  const rp = g.pipe ?? 0.64;
  const rb = g.bore ?? 0.5;
  const xf = X - (g.flange ?? 0.16);
  const pipeC = hex(look.pipe);
  const flangeC = hex(look.flange ?? look.pipe);
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-xf, yc - rp, zc - rp], [xf, yc + rp, zc + rp], scale3(pipeC, 0.85), ['nx', 'px']);
    for (const s of [-1, 1]) box(m, [s > 0 ? xf : -X, 0, zc - R], [s > 0 ? X : -xf, h, zc + R], scale3(flangeC, 0.8), ['ny']);
    return m;
  }
  // Solid: the pipe's walls round its bore (under, over, behind in two steps, in front in three), each flange's four
  // pieces round the bore (its foot, its top, its front, its back), the boss at +z. Open: the bore, end to end.
  m.boxes = [
    [-X, 0.1, -0.35, X, 0.4, 0.35],
    [-X, 1.2, -0.35, X, 1.5, 0.35],
    [-X, 0.2, -0.55, X, 1.4, -0.35],
    [-X, 0.4, -Z, X, 1.2, -0.55],
    [-X, 0.2, 0.35, X, 0.6, 0.55],
    [-X, 1, 0.35, X, 1.3, 0.55],
    [-X, 0.3, 0.45, X, 1.3, 0.65],
    ...[-1, 1].flatMap((s) => {
      const [x0, x1] = s > 0 ? [0.6, X] : [-X, -0.6];
      return [[x0, 0, -0.25, x1, 0.4, 0.35], [x0, 1.3, -0.45, x1, h, 0.55], [x0, 0.14, 0.35, x1, 1.4, 0.75], [x0, 0.15, -0.75, x1, 1.45, -0.35]];
    }),
    [-0.281, 0.576, 0.65, 0.281, 1.024, 0.743],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.25;
  // Round parts: lit from above, darker below and towards the ground.
  const round = (c, k = 1) => {
    const b = scale3(c, k * (1 + r.jitter(0.03)));
    return (p, n) => scale3(b, (0.84 + 0.22 * n[1]) * groundShade(p[1], 0.3, 1 - grime * 0.5));
  };
  const pipe = round(pipeC);
  const flange = round(flangeC, 0.92);
  const body = round(hex(look.body ?? look.pipe), 1.05);
  const wheel = round(hex(look.wheel ?? '#a8261e'));
  const steel = round(hex(look.bolt ?? '#8b9094'));
  const S = fine ? 16 : 8;
  // The pipe and its bore (dark inside), from end to end.
  cyl(m, 0, yc, zc, -xf, xf, rp, S, pipe);
  cyl(m, 0, yc, zc, -X, X, rb, S, (p) => scale3(pipeC, 0.16 + 0.1 * Math.abs(p[0]) / X), { inside: true });
  for (const s of [-1, 1]) {
    // A flange: its rim, its outer face round the bore, its inner face round the pipe, its bolts' nuts; its foot.
    cyl(m, 0, yc, zc, s > 0 ? xf : -X, s > 0 ? X : -xf, R, S, flange);
    annulus(m, 0, yc, zc, s * X, rb, R, S, s, flange);
    annulus(m, 0, yc, zc, s * xf, rp, R, S, -s, flange);
    box(m, [s > 0 ? 0.62 : -0.78, 0, -0.25], [s > 0 ? 0.78 : -0.62, 0.16, 0.35], scale3(hex('#26282b'), 1), ['ny']);
    if (fine) {
      const nb = Math.max(4, g.bolts ?? 8);
      for (let k = 0; k < nb; k++) {
        const a = ((k + 0.5) / nb) * Math.PI * 2;
        const [by, bz] = [yc + Math.cos(a) * (rp + R) / 2, zc + Math.sin(a) * (rp + R) / 2];
        box(m, [s > 0 ? xf - 0.045 : -xf, by - 0.032, bz - 0.032], [s > 0 ? xf : -xf + 0.045, by + 0.032, bz + 0.032], steel, [s > 0 ? 'px' : 'nx']);
      }
    }
  }
  // The valve body: a band round the pipe's middle.
  const hb = 0.15;
  const rv = 0.73;
  cyl(m, 0, yc, zc, -hb, hb, rv, S, body);
  for (const s of [-1, 1]) annulus(m, 0, yc, zc, s * hb, rp, rv, S, s, body);
  // The hand wheel at −z: a stem out of a bonnet, a rim, bars across it, a hub.
  const zw = -Z + 0.035;
  const [r0, r1] = [0.33, 0.4];
  const W = fine ? 12 : 8;
  cyl(m, 2, 0, yc, -Z + 0.02, zc - rp + 0.03, 0.045, fine ? 8 : 4, steel);
  annulus(m, 2, 0, yc, -Z, r0, r1, W, -1, wheel);
  cyl(m, 2, 0, yc, -Z, zw, r1, W, wheel);
  const spokes = Math.max(1, g.spokes ?? 2);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI;
    bar(m, [-Math.cos(a) * r0, yc - Math.sin(a) * r0, -Z + 0.0175], [Math.cos(a) * r0, yc + Math.sin(a) * r0, -Z + 0.0175], 0.035, wheel, { up: [0, 0, 1] });
  }
  if (fine) {
    annulus(m, 2, 0, yc, zw, r0, r1, W, 1, wheel);
    cyl(m, 2, 0, yc, -Z, zw, r0, W, wheel, { inside: true });
    cyl(m, 2, 0, yc, -Z, -Z + 0.055, 0.07, 8, steel, { caps: '0' });
    cyl(m, 2, 0, yc, -0.72, zc - rp + 0.03, 0.16, 8, body, { caps: '0' });
  }
  // The blind boss at +z.
  cyl(m, 2, 0, yc, zc + rp - 0.03, 0.743, 0.22, fine ? 12 : 8, flange, { caps: '1' });
  if (fine) for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    face(m, Math.cos(a) * 0.16 - 0.02, yc + Math.sin(a) * 0.16 - 0.02, Math.cos(a) * 0.16 + 0.02, yc + Math.sin(a) * 0.16 + 0.02, 0.745, 1, steel);
  }
  return m;
}
