// Style Packs 05 Gothic Estate, 06 Jungle Ruins and 08 Suburban Chaos: the
// props we model ourselves, in code, from simple solids (boxes, cylinders,
// rings, spheres and turned slabs) with the modeller in tools/content/pieces.mjs.
//
//   node tools/content/build-style-props.mjs
//
// Writes one GLB per piece to assets-src/tiletrigger-styleprops/ (flat
// colours, no textures, no third-party file), which
// `node tools/content/prepare-props.mjs` then normalises like any other pack.
// Everything is deterministic: the same code writes the same bytes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune } from '@gltf-transform/functions';
import { Piece, piecesDocument } from './pieces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets-src/tiletrigger-styleprops');
const io = new NodeIO();
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  // Gothic Estate
  walnut: { color: hex('#4a2e1c'), rough: 0.6 },
  walnutDark: { color: hex('#2e1c12'), rough: 0.6 },
  mahogany: { color: hex('#5c2418'), rough: 0.5 },
  brass: { color: hex('#b08d3a'), metal: 0.7, rough: 0.35 },
  gilt: { color: hex('#c9a23a'), metal: 0.8, rough: 0.3 },
  iron: { color: hex('#24262a'), metal: 0.5, rough: 0.5 },
  steel: { color: hex('#8c9298'), metal: 0.7, rough: 0.35 },
  velvet: { color: hex('#6a1020'), rough: 0.9 },
  velvetDark: { color: hex('#40080f'), rough: 0.9 },
  linen: { color: hex('#e6dfd0'), rough: 0.9 },
  stone: { color: hex('#8a8680'), rough: 0.9 },
  stoneDark: { color: hex('#5a5753'), rough: 0.95 },
  marble: { color: hex('#d8d4cc'), rough: 0.4 },
  wax: { color: hex('#efe6cf'), rough: 0.7 },
  flame: { color: hex('#ffc060'), emissive: glow('#ffb040') },
  lamp: { color: hex('#ffe0a0'), emissive: glow('#ffd080', 0.9) },
  paper: { color: hex('#e8dcc0'), rough: 0.8 },
  ink: { color: hex('#1a1612'), rough: 0.8 },
  hedge: { color: hex('#2f4a22'), rough: 0.95 },
  hedgeLight: { color: hex('#3e5c2a'), rough: 0.95 },
  canvas: { color: hex('#3a2c22'), rough: 0.9 },
  skin: { color: hex('#c8a088'), rough: 0.8 },
  bookRed: { color: hex('#7a2020'), rough: 0.8 },
  bookGreen: { color: hex('#24502e'), rough: 0.8 },
  bookBlue: { color: hex('#22305a'), rough: 0.8 },
  bookTan: { color: hex('#9a7a4a'), rough: 0.8 },
  ivory: { color: hex('#f0ead8'), rough: 0.4 },
  black: { color: hex('#121214'), rough: 0.5 },
  // Jungle Ruins
  temple: { color: hex('#8c8a6a'), rough: 0.95 },
  templeDark: { color: hex('#5e5e48'), rough: 0.95 },
  moss: { color: hex('#4a6a22'), rough: 1 },
  vine: { color: hex('#2e5a1a'), rough: 0.9 },
  leaf: { color: hex('#3c7a24'), rough: 0.8 },
  leafDark: { color: hex('#24561a'), rough: 0.8 },
  leafLight: { color: hex('#5a9a30'), rough: 0.8 },
  bark: { color: hex('#5a4630'), rough: 1 },
  bamboo: { color: hex('#8aa040'), rough: 0.6 },
  bambooRing: { color: hex('#5e6e28'), rough: 0.6 },
  rope: { color: hex('#a08a5a'), rough: 1 },
  plank: { color: hex('#7a5a3a'), rough: 0.9 },
  gold: { color: hex('#d8a830'), metal: 0.85, rough: 0.25 },
  jade: { color: hex('#3a9a78'), rough: 0.3 },
  water: { color: hex('#7ac8e0'), metal: 0.1, rough: 0.05, alpha: 0.55 },
  waterDeep: { color: hex('#3a8aa8'), metal: 0.1, rough: 0.05, alpha: 0.7 },
  foam: { color: hex('#eef8fc'), rough: 0.6, alpha: 0.85 },
  fire: { color: hex('#ff8a30'), emissive: glow('#ff7a20') },
  ember: { color: hex('#ffd060'), emissive: glow('#ffc040') },
  // Suburban Chaos
  white: { color: hex('#eeeeea'), rough: 0.5 },
  offwhite: { color: hex('#d8d6cc'), rough: 0.6 },
  silver: { color: hex('#b8bcc0'), metal: 0.6, rough: 0.3 },
  grey: { color: hex('#6e7276'), rough: 0.6 },
  dark: { color: hex('#2a2c30'), rough: 0.5 },
  glass: { color: hex('#2a3a48'), metal: 0.4, rough: 0.1 },
  screen: { color: hex('#10161c'), rough: 0.2 },
  red: { color: hex('#c0302a'), rough: 0.5 },
  blue: { color: hex('#2a5aa8'), rough: 0.5 },
  green: { color: hex('#2a7a3a'), rough: 0.6 },
  yellow: { color: hex('#e8c020'), rough: 0.5 },
  orange: { color: hex('#e86a2a'), rough: 0.5 },
  teal: { color: hex('#2a8a8a'), rough: 0.5 },
  rubber: { color: hex('#1a1a1a'), rough: 0.9 },
  wood: { color: hex('#9a6a3e'), rough: 0.8 },
  cushion: { color: hex('#e0d4b0'), rough: 0.9 },
  grass: { color: hex('#4a8a30'), rough: 1 },
  sand: { color: hex('#d8c08a'), rough: 1 },
  digit: { color: hex('#7aff8a'), emissive: glow('#5aff6a', 0.8) },
  sign: { color: hex('#fff2c0'), emissive: glow('#ffe890', 0.7) },
  chrome: { color: hex('#d8dce0'), metal: 0.9, rough: 0.15 },
  paint: { color: hex('#7a1e22'), metal: 0.3, rough: 0.35 },
  skinPink: { color: hex('#e8b8a0'), rough: 0.8 },
};
const piece = (name) => new Piece(name, MATS);

// ---------------------------------------------------------------- helpers

/** A box of size `size` (width x, height y, depth z) centred on `c`, turned by `yaw` about Y, then tilted: `pitch` about its own X (+Z end up), `roll` about its own Z. */
function obox(p, mat, c, size, { yaw = 0, pitch = 0, roll = 0 } = {}) {
  const [hx, hy, hz] = size.map((v) => v / 2);
  const rot = ([x, y, z]) => {
    // roll about Z, then pitch about X (+Z up), then yaw about Y.
    let [a, b, d] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll), z];
    [b, d] = [b * Math.cos(pitch) + d * Math.sin(pitch), -b * Math.sin(pitch) + d * Math.cos(pitch)];
    [a, d] = [a * Math.cos(yaw) + d * Math.sin(yaw), -a * Math.sin(yaw) + d * Math.cos(yaw)];
    return [a, b, d];
  };
  const v = (x, y, z) => {
    const [a, b, d] = rot([x * hx, y * hy, z * hz]);
    return [c[0] + a, c[1] + b, c[2] + d];
  };
  const faces = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], [1, 0, 0]],
    [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1], [-1, 0, 0]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [0, 1, 0]],
    [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [0, -1, 0]],
    [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1], [0, 0, 1]],
    [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1], [0, 0, -1]],
  ];
  for (const [a, b, cc, d, n] of faces) p.quad(mat, v(...a), v(...b), v(...cc), v(...d), rot(n));
  return p;
}

/** A square-section beam from a to b, `t` thick. */
function beam(p, mat, a, b, t, w = t) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const yaw = Math.atan2(d[0], d[2]);
  const pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
  return obox(p, mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [w, t, len], { yaw, pitch });
}

/** A seeded random sequence (props are the same every build). */
function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A candle with its flame, standing at (x, y, z). */
function candle(p, x, y, z, h = 0.18, r = 0.025) {
  p.cylinder('wax', [x, y, z], r, 0, h, { seg: 8 });
  p.sphere('flame', [x, y + h + 0.035, z], 0.022, { rings: 4, seg: 6, squash: 1.8 });
}

/** A row of books on a shelf from x0 to x1 at height y, against z0 (back) to z1. */
function books(p, x0, x1, y, z0, z1, rnd) {
  const cols = ['bookRed', 'bookGreen', 'bookBlue', 'bookTan', 'walnutDark', 'velvet'];
  let x = x0;
  while (x < x1 - 0.05) {
    const w = 0.035 + rnd() * 0.05;
    const h = 0.22 + rnd() * 0.14;
    if (x + w > x1) break;
    p.box(cols[Math.floor(rnd() * cols.length)], [x, y, z0], [x + w, y + h, z1 - rnd() * 0.04]);
    x += w + (rnd() < 0.08 ? 0.06 : 0.004);
  }
}

/** A leafy blob (a squashed sphere) for hedges and canopies. */
const blob = (p, mat, c, r, squash = 1) => p.sphere(mat, c, r, { rings: 6, seg: 10, squash });

/** A flat leaf: a thin slab from the stem at `a` reaching out along yaw/pitch, `len` long, `w` wide. */
function leaf(p, mat, a, len, w, yaw, pitch) {
  const c = [a[0] + Math.sin(yaw) * Math.cos(pitch) * (len / 2), a[1] + Math.sin(pitch) * (len / 2), a[2] + Math.cos(yaw) * Math.cos(pitch) * (len / 2)];
  obox(p, mat, c, [w, 0.03, len], { yaw, pitch });
}

// ---------------------------------------------------------------- 05 Gothic Estate

const GOTHIC = {
  ge_bookcase_tall() {
    // A tall Victorian bookcase: walnut carcass, a crown, five shelves of books.
    const p = piece('ge_bookcase_tall');
    const rnd = rng(5);
    p.box('walnut', [-1.0, 0, -0.25], [-0.94, 2.85, 0.25]).box('walnut', [0.94, 0, -0.25], [1.0, 2.85, 0.25]);
    p.box('walnutDark', [-0.94, 0, -0.25], [0.94, 2.85, -0.21]);
    p.box('walnut', [-1.0, 0, -0.25], [1.0, 0.22, 0.27]);
    p.box('walnut', [-1.06, 2.85, -0.28], [1.06, 3.0, 0.31]);
    p.box('walnutDark', [-1.03, 2.75, 0.25], [1.03, 2.85, 0.29]);
    for (const y of [0.22, 0.75, 1.28, 1.81, 2.34]) {
      p.box('walnut', [-0.94, y, -0.21], [0.94, y + 0.04, 0.25]);
      if (y < 2.3) books(p, -0.92, 0.92, y + 0.04, -0.2, 0.2, rnd);
    }
    books(p, -0.92, -0.1, 2.38, -0.2, 0.2, rnd);
    p.box('brass', [-0.06, 2.42, 0.12], [0.06, 2.6, 0.2]);
    return p;
  },
  ge_chandelier() {
    // A brass chandelier of candles on two rings, hung on a chain.
    const p = piece('ge_chandelier');
    for (let i = 0; i < 6; i++) p.ring('brass', [0, 1.95 - i * 0.12, 0], 0.025, 0.045, 0, 0.1, { seg: 6, axis: i % 2 ? 'x' : 'z' });
    p.cylinder('brass', [0, 0, 0], 0.05, 0.55, 1.3, { seg: 8 });
    p.sphere('brass', [0, 0.55, 0], 0.12, { rings: 6, seg: 10 });
    p.ring('brass', [0, 0.62, 0], 0.62, 0.68, 0, 0.04, { seg: 24 });
    p.ring('brass', [0, 1.02, 0], 0.34, 0.39, 0, 0.04, { seg: 16 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      beam(p, 'brass', [0, 1.25, 0], [Math.cos(a) * 0.66, 0.64, Math.sin(a) * 0.66], 0.025);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.cylinder('brass', [Math.cos(a) * 0.65, 0.66, Math.sin(a) * 0.65], 0.045, 0, 0.03, { seg: 8 });
      candle(p, Math.cos(a) * 0.65, 0.69, Math.sin(a) * 0.65, 0.16);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      candle(p, Math.cos(a) * 0.36, 1.06, Math.sin(a) * 0.36, 0.14);
    }
    p.sphere('gilt', [0, 0.36, 0], 0.08, { rings: 6, seg: 8, squash: 2 });
    return p;
  },
  ge_candelabra() {
    // A floor candelabra: a turned stem on three feet, five candles.
    const p = piece('ge_candelabra');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      beam(p, 'iron', [0, 0.12, 0], [Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28], 0.04);
    }
    p.cylinder('iron', [0, 0, 0], 0.035, 0.1, 1.35, { seg: 8 });
    for (const y of [0.4, 0.8, 1.2]) p.sphere('iron', [0, y, 0], 0.06, { rings: 5, seg: 8 });
    p.box('iron', [-0.4, 1.35, -0.025], [0.4, 1.39, 0.025]);
    for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) {
      p.cylinder('brass', [x, 1.39, 0], 0.045, 0, 0.04, { seg: 8 });
      candle(p, x, 1.43, 0, x === 0 ? 0.24 : 0.18);
    }
    return p;
  },
  ge_grandfather_clock() {
    // A longcase clock: hood with a white face, waist with a brass pendulum behind glass.
    const p = piece('ge_grandfather_clock');
    p.box('mahogany', [-0.3, 0, -0.2], [0.3, 0.45, 0.2]);
    p.box('mahogany', [-0.24, 0.45, -0.17], [0.24, 1.55, 0.17]);
    p.box('mahogany', [-0.3, 1.55, -0.2], [0.3, 2.1, 0.2]);
    p.box('walnutDark', [-0.33, 2.1, -0.22], [0.33, 2.18, 0.23]);
    p.box('walnutDark', [-0.12, 2.18, -0.1], [0.12, 2.32, 0.12]);
    p.cylinder('ivory', [0, 1.82, 0.2], 0.2, 0, 0.012, { seg: 20, axis: 'z' });
    p.ring('brass', [0, 1.82, 0.2], 0.19, 0.22, 0, 0.02, { seg: 20, axis: 'z' });
    p.box('ink', [-0.008, 1.82, 0.212], [0.008, 1.96, 0.218]).box('ink', [-0.008, 1.76, 0.212], [0.1, 1.83, 0.218]);
    p.box('glass', [-0.15, 0.6, 0.17], [0.15, 1.45, 0.18]);
    p.box('brass', [-0.01, 0.85, 0.12], [0.01, 1.45, 0.14]);
    p.cylinder('brass', [0, 0.85, 0.13], 0.08, -0.01, 0.01, { seg: 14, axis: 'z' });
    return p;
  },
  ge_wingback_chair() {
    // A wingback armchair in red velvet.
    const p = piece('ge_wingback_chair');
    for (const [x, z] of [[-0.36, -0.32], [0.36, -0.32], [-0.36, 0.32], [0.36, 0.32]]) p.box('walnutDark', [x - 0.04, 0, z - 0.04], [x + 0.04, 0.16, z + 0.04]);
    p.box('velvet', [-0.42, 0.16, -0.38], [0.42, 0.45, 0.38]);
    p.box('velvetDark', [-0.34, 0.45, -0.25], [0.34, 0.55, 0.36]);
    p.box('velvet', [-0.42, 0.16, -0.42], [0.42, 1.25, -0.26]);
    for (const s of [-1, 1]) {
      p.box('velvet', [s * 0.42 - 0.1, 0.16, -0.36], [s * 0.42 + 0.1, 0.72, 0.38]);
      p.box('velvet', [s > 0 ? 0.3 : -0.44, 0.72, -0.38], [s > 0 ? 0.44 : -0.3, 1.2, -0.05]);
    }
    return p;
  },
  ge_grand_piano() {
    // A grand piano: a curved black case (stepped), lid propped open, keyboard, three legs.
    const p = piece('ge_grand_piano');
    const top = 1.0;
    // The case: wide at the keyboard (-Z... front +Z is the keyboard), narrowing to the tail.
    for (let i = 0; i < 8; i++) {
      const z0 = -1.0 + i * 0.22;
      const w = 0.75 - 0.45 * ((7 - i) / 7) ** 2;
      p.box('black', [-0.75, 0.62, z0], [-0.75 + w * 2, top - 0.02, z0 + 0.22]);
    }
    p.box('black', [-0.78, 0.6, 0.76], [0.78, 0.86, 1.06]);
    p.box('ivory', [-0.7, 0.86, 0.8], [0.7, 0.89, 1.02]);
    for (let i = 0; i < 20; i++) p.box('black', [-0.68 + i * 0.07, 0.89, 0.86], [-0.65 + i * 0.07, 0.92, 1.0]);
    p.box('black', [-0.75, 0.86, 0.68], [0.75, 1.15, 0.8]);
    obox(p, 'black', [0.0, 1.45, -0.05], [1.5, 0.03, 1.6], { roll: -0.5 });
    beam(p, 'black', [0.6, 1.0, -0.1], [0.62, 1.66, -0.1], 0.025);
    for (const [x, z] of [[-0.65, 0.85], [0.65, 0.85], [0.15, -0.85]]) p.box('black', [x - 0.06, 0, z - 0.06], [x + 0.06, 0.62, z + 0.06]);
    p.box('brass', [-0.25, 0.04, 0.82], [0.25, 0.08, 0.9]);
    return p;
  },
  ge_portrait() {
    // A portrait in a gilt frame (hangs on a wall: no collision).
    const p = piece('ge_portrait');
    p.box('gilt', [-0.55, 0, -0.04], [0.55, 1.35, 0.04]);
    p.box('canvas', [-0.44, 0.11, 0.04], [0.44, 1.24, 0.05]);
    p.box('ink', [-0.3, 0.11, 0.05], [0.3, 0.68, 0.056]);
    p.sphere('skin', [0, 0.86, 0.06], 0.15, { rings: 6, seg: 10, squash: 1.3 });
    p.box('ink', [-0.16, 0.98, 0.055], [0.16, 1.1, 0.07]);
    p.box('linen', [-0.06, 0.62, 0.056], [0.06, 0.7, 0.06]);
    return p;
  },
  ge_suit_of_armour() {
    // A suit of armour on a plinth, a halberd at its side.
    const p = piece('ge_suit_of_armour');
    p.box('stoneDark', [-0.35, 0, -0.3], [0.35, 0.2, 0.3]);
    for (const x of [-0.1, 0.1]) {
      p.cylinder('steel', [x, 0.2, 0], 0.075, 0, 0.75, { seg: 8, r1: 0.085 });
      p.box('steel', [x - 0.07, 0.2, -0.05], [x + 0.07, 0.27, 0.12]);
    }
    p.cylinder('steel', [0, 0.95, 0], 0.17, 0, 0.55, { seg: 10, r1: 0.22 });
    p.cylinder('steel', [0, 0.8, 0], 0.2, 0, 0.18, { seg: 10, r1: 0.17 });
    for (const s of [-1, 1]) {
      p.sphere('steel', [s * 0.27, 1.45, 0], 0.1, { rings: 6, seg: 8 });
      beam(p, 'steel', [s * 0.29, 1.42, 0], [s * 0.32, 0.95, 0.05], 0.09);
    }
    p.cylinder('steel', [0, 1.55, 0], 0.13, 0, 0.3, { seg: 10, r1: 0.11 });
    p.box('black', [-0.08, 1.7, 0.1], [0.08, 1.72, 0.13]);
    p.box('velvet', [-0.015, 1.85, -0.1], [0.015, 2.0, 0.08]);
    p.cylinder('walnutDark', [0.36, 0.2, 0.05], 0.02, 0, 2.0, { seg: 6 });
    p.box('steel', [0.36, 1.95, -0.1], [0.38, 2.25, 0.18]);
    return p;
  },
  ge_four_poster_bed() {
    // A four-poster bed with a canopy, drapes and a red coverlet.
    const p = piece('ge_four_poster_bed');
    for (const [x, z] of [[-0.95, -1.1], [0.95, -1.1], [-0.95, 1.1], [0.95, 1.1]]) p.box('walnut', [x - 0.07, 0, z - 0.07], [x + 0.07, 2.4, z + 0.07]);
    p.box('walnut', [-0.95, 0.25, -1.1], [0.95, 0.45, 1.1]);
    p.box('walnutDark', [-0.95, 0.45, -1.12], [0.95, 1.3, -1.04]);
    p.box('walnutDark', [-0.95, 0.45, 1.04], [0.95, 0.85, 1.12]);
    p.box('linen', [-0.88, 0.45, -1.02], [0.88, 0.65, 1.02]);
    p.box('velvet', [-0.9, 0.62, -0.3], [0.9, 0.7, 1.05]);
    for (const x of [-0.45, 0.45]) p.box('linen', [x - 0.33, 0.65, -0.95], [x + 0.33, 0.8, -0.6]);
    p.box('walnut', [-1.02, 2.3, -1.17], [1.02, 2.45, 1.17]);
    p.box('velvetDark', [-1.0, 2.1, -1.15], [1.0, 2.3, 1.15]);
    for (const [x, z] of [[-0.95, -1.1], [0.95, -1.1], [-0.95, 1.1], [0.95, 1.1]]) p.box('velvetDark', [x - 0.12, 0.9, z - 0.12], [x + 0.12, 2.1, z + 0.12]);
    return p;
  },
  ge_writing_desk() {
    // A writing desk: drawers either side, leather top, inkwell, papers and a candle.
    const p = piece('ge_writing_desk');
    for (const s of [-1, 1]) {
      p.box('mahogany', [s * 0.7 - (s > 0 ? 0.42 : 0), 0, -0.35], [s > 0 ? 0.7 : -0.28, 0.74, 0.35]);
      for (const y of [0.12, 0.36, 0.58]) p.box('brass', [s * 0.49 - 0.04, y, 0.35], [s * 0.49 + 0.04, y + 0.03, 0.37]);
    }
    p.box('mahogany', [-0.74, 0.74, -0.38], [0.74, 0.79, 0.38]);
    p.box('bookGreen', [-0.6, 0.79, -0.28], [0.6, 0.8, 0.3]);
    p.box('paper', [-0.2, 0.8, -0.05], [0.12, 0.805, 0.2], 0.2);
    p.cylinder('ink', [0.35, 0.8, 0.0], 0.04, 0, 0.06, { seg: 8 });
    p.cylinder('brass', [-0.45, 0.8, -0.1], 0.06, 0, 0.02, { seg: 10 });
    candle(p, -0.45, 0.82, -0.1, 0.2);
    p.box('mahogany', [-0.74, 0.79, -0.38], [0.74, 1.05, -0.3]);
    return p;
  },
  ge_sarcophagus() {
    // A stone sarcophagus: a carved chest with a lid bearing a recumbent figure.
    const p = piece('ge_sarcophagus');
    p.box('stoneDark', [-0.55, 0, -1.15], [0.55, 0.12, 1.15]);
    p.box('stone', [-0.5, 0.12, -1.1], [0.5, 0.75, 1.1]);
    for (const z of [-0.7, 0, 0.7]) for (const s of [-1, 1]) p.box('stoneDark', [s * 0.5 - 0.02, 0.25, z - 0.2], [s * 0.5 + 0.02, 0.62, z + 0.2]);
    p.box('stone', [-0.56, 0.75, -1.16], [0.56, 0.86, 1.16]);
    p.box('marble', [-0.22, 0.86, -0.75], [0.22, 1.0, 0.7]);
    p.sphere('marble', [0, 1.02, -0.85], 0.14, { rings: 6, seg: 10 });
    p.box('marble', [-0.08, 1.0, -0.2], [0.08, 1.08, 0.15]);
    p.box('stoneDark', [-0.3, 0.86, 0.75], [0.3, 0.95, 0.95]);
    return p;
  },
  ge_angel_statue() {
    // A weeping angel on a plinth: robed figure, bowed head, folded wings.
    const p = piece('ge_angel_statue');
    p.box('stoneDark', [-0.55, 0, -0.55], [0.55, 0.35, 0.55]);
    p.box('stone', [-0.45, 0.35, -0.45], [0.45, 1.05, 0.45]);
    p.box('stoneDark', [-0.5, 1.05, -0.5], [0.5, 1.15, 0.5]);
    p.cylinder('marble', [0, 1.15, 0], 0.32, 0, 1.0, { seg: 12, r1: 0.18 });
    p.cylinder('marble', [0, 2.15, 0], 0.18, 0, 0.35, { seg: 10, r1: 0.14 });
    p.sphere('marble', [0, 2.62, 0.06], 0.13, { rings: 6, seg: 10 });
    for (const s of [-1, 1]) {
      beam(p, 'marble', [s * 0.15, 2.4, 0.02], [s * 0.05, 2.55, 0.18], 0.08);
      obox(p, 'marble', [s * 0.3, 2.15, -0.2], [0.12, 1.3, 0.5], { yaw: s * 0.35, roll: -s * 0.25 });
    }
    return p;
  },
  ge_headstone_tall() {
    // A tall Victorian headstone with a round-arched top and an urn finial.
    const p = piece('ge_headstone_tall');
    p.box('stoneDark', [-0.45, 0, -0.25], [0.45, 0.2, 0.25]);
    p.box('stone', [-0.36, 0.2, -0.12], [0.36, 1.15, 0.12]);
    p.cylinder('stone', [0, 1.15, 0], 0.36, -0.12, 0.12, { seg: 16, axis: 'z' });
    p.box('stoneDark', [-0.26, 0.55, 0.12], [0.26, 0.58, 0.13]).box('stoneDark', [-0.2, 0.7, 0.12], [0.2, 0.72, 0.13]).box('stoneDark', [-0.22, 0.84, 0.12], [0.22, 0.86, 0.13]);
    p.cylinder('stone', [0, 1.5, 0], 0.08, 0, 0.06, { seg: 8 });
    p.sphere('stone', [0, 1.64, 0], 0.11, { rings: 6, seg: 8, squash: 1.3 });
    p.cylinder('stone', [0, 1.76, 0], 0.05, 0, 0.06, { seg: 8, r1: 0.07 });
    return p;
  },
  ge_iron_fence() {
    // 2.5 m of wrought-iron railing with spear finials on a low stone plinth.
    const p = piece('ge_iron_fence');
    p.box('stone', [-1.25, 0, -0.18], [1.25, 0.4, 0.18]);
    p.box('stoneDark', [-1.27, 0.4, -0.2], [1.27, 0.46, 0.2]);
    for (const y of [0.6, 1.55]) p.box('iron', [-1.25, y, -0.025], [1.25, y + 0.04, 0.025]);
    for (let i = 0; i < 13; i++) {
      const x = -1.2 + i * 0.2;
      p.box('iron', [x - 0.015, 0.46, -0.015], [x + 0.015, 1.75, 0.015]);
      p.cylinder('iron', [x, 1.75, 0], 0.035, 0, 0.12, { seg: 4, r1: 0 });
    }
    for (let i = 0; i < 6; i++) p.ring('iron', [-1.0 + i * 0.4, 0.82, 0], 0.07, 0.09, -0.015, 0.03, { seg: 10, axis: 'z' });
    return p;
  },
  ge_iron_gate() {
    // Wrought-iron gates swung open between two stone piers, a scrolled arch over the 3 m way.
    const p = piece('ge_iron_gate');
    for (const s of [-1, 1]) {
      p.box('stone', [s * 1.7 - 0.3, 0, -0.3], [s * 1.7 + 0.3, 2.6, 0.3]);
      p.box('stoneDark', [s * 1.7 - 0.36, 2.6, -0.36], [s * 1.7 + 0.36, 2.75, 0.36]);
      p.sphere('stone', [s * 1.7, 2.92, 0], 0.18, { rings: 6, seg: 10 });
      // A leaf swung back (inward, toward -Z) on its hinge by the pier.
      const hx = s * 1.4;
      for (let i = 0; i < 7; i++) {
        const u = 0.1 + i * 0.2;
        p.box('iron', [hx - s * 0.03 - 0.015, 0.05, -u - 0.015], [hx - s * 0.03 + 0.015, 2.2, -u + 0.015]);
        p.cylinder('iron', [hx - s * 0.03, 2.2, -u], 0.03, 0, 0.1, { seg: 4, r1: 0 });
      }
      for (const y of [0.15, 1.2, 2.05]) p.box('iron', [hx - s * 0.03 - 0.02, y, -1.45], [hx - s * 0.03 + 0.02, y + 0.04, -0.05]);
    }
    p.box('iron', [-1.45, 3.1, -0.03], [1.45, 3.15, 0.03]);
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (i / 12);
      p.box('iron', [Math.cos(a) * 1.4 - 0.02, 2.75 + Math.sin(a) * 0.55, -0.02], [Math.cos(a) * 1.4 + 0.02, 2.79 + Math.sin(a) * 0.55, 0.02]);
    }
    for (const x of [-0.7, 0, 0.7]) p.ring('iron', [x, 3.05, 0], 0.08, 0.11, -0.015, 0.03, { seg: 10, axis: 'z' });
    return p;
  },
  ge_hedge_wall() {
    // A clipped box hedge, 3 m long and head high.
    const p = piece('ge_hedge_wall');
    p.box('hedge', [-1.5, 0, -0.45], [1.5, 2.2, 0.45]);
    const rnd = rng(9);
    for (let i = 0; i < 14; i++) blob(p, i % 2 ? 'hedgeLight' : 'hedge', [-1.35 + (i % 7) * 0.45, 0.5 + Math.floor(i / 7) * 1.1 + rnd() * 0.3, (i % 2 ? 1 : -1) * 0.4], 0.22 + rnd() * 0.08, 0.8);
    return p;
  },
  ge_hedge_arch() {
    // A topiary arch: two hedge piers joined over a 1.8 m way.
    const p = piece('ge_hedge_arch');
    for (const s of [-1, 1]) p.box('hedge', [s * 1.5 - (s > 0 ? 0.6 : 0), 0, -0.45], [s > 0 ? 1.5 : -0.9, 2.5, 0.45]);
    p.box('hedge', [-1.5, 2.5, -0.45], [1.5, 3.2, 0.45]);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (i / 8);
      blob(p, 'hedgeLight', [Math.cos(a) * 0.95, 2.45 + Math.sin(a) * 0.3, 0], 0.28, 1);
    }
    return p;
  },
  ge_topiary() {
    // A clipped topiary: a cone over two balls in a stone planter.
    const p = piece('ge_topiary');
    p.box('stone', [-0.4, 0, -0.4], [0.4, 0.55, 0.4]);
    p.box('stoneDark', [-0.45, 0.55, -0.45], [0.45, 0.62, 0.45]);
    p.cylinder('bark', [0, 0.6, 0], 0.05, 0, 0.5, { seg: 6 });
    blob(p, 'hedge', [0, 1.2, 0], 0.4);
    blob(p, 'hedgeLight', [0, 1.75, 0], 0.28);
    p.cylinder('hedge', [0, 1.95, 0], 0.22, 0, 0.5, { seg: 10, r1: 0 });
    return p;
  },
  ge_gas_lamp() {
    // A Victorian gas lamp post: a fluted iron column and a glowing lantern.
    const p = piece('ge_gas_lamp');
    p.cylinder('iron', [0, 0, 0], 0.18, 0, 0.35, { seg: 8, r1: 0.12 });
    p.cylinder('iron', [0, 0.35, 0], 0.07, 0, 2.6, { seg: 8, r1: 0.05 });
    for (const y of [0.9, 2.2]) p.ring('iron', [0, y, 0], 0.05, 0.1, 0, 0.05, { seg: 8 });
    p.box('iron', [-0.3, 2.85, -0.02], [0.3, 2.89, 0.02]);
    p.cylinder('iron', [0, 2.95, 0], 0.1, 0, 0.06, { seg: 8, r1: 0.18 });
    p.cylinder('lamp', [0, 3.01, 0], 0.17, 0, 0.4, { seg: 6, r1: 0.22 });
    p.cylinder('iron', [0, 3.41, 0], 0.25, 0, 0.18, { seg: 6, r1: 0.02 });
    p.sphere('iron', [0, 3.62, 0], 0.04, { rings: 4, seg: 6 });
    return p;
  },
};

// ---------------------------------------------------------------- 06 Jungle Ruins

const JUNGLE = {
  jg_stone_idol() {
    // A colossal stone head in a helmet band, half sunk in moss.
    const p = piece('jg_stone_idol');
    p.box('templeDark', [-1.3, 0, -1.1], [1.3, 0.3, 1.1]);
    p.box('temple', [-1.15, 0.3, -1.0], [1.15, 2.6, 0.95]);
    p.box('templeDark', [-1.25, 2.3, -1.05], [1.25, 2.9, 1.02]);
    p.box('temple', [-1.0, 2.9, -0.9], [1.0, 3.1, 0.85]);
    for (const s of [-1, 1]) {
      p.box('templeDark', [s * 0.45 - 0.25, 1.75, 0.95], [s * 0.45 + 0.25, 1.95, 1.02]);
      p.box('ink', [s * 0.45 - 0.12, 1.79, 1.0], [s * 0.45 + 0.12, 1.9, 1.04]);
      p.box('temple', [s * 1.15 - (s > 0 ? 0 : 0.25), 0.9, -0.2], [s > 0 ? 1.4 : -1.15, 1.9, 0.3]);
    }
    p.box('temple', [-0.2, 1.1, 0.95], [0.2, 1.75, 1.25]);
    p.box('templeDark', [-0.55, 0.6, 0.95], [0.55, 0.9, 1.1]);
    p.box('ink', [-0.45, 0.68, 1.09], [0.45, 0.8, 1.12]);
    for (const [x, y, z, r] of [[-1.0, 0.4, 0.9, 0.35], [0.9, 0.35, -0.8, 0.4], [-0.6, 3.05, 0.2, 0.4], [0.7, 2.95, -0.4, 0.35]]) blob(p, 'moss', [x, y, z], r, 0.5);
    return p;
  },
  jg_serpent_statue() {
    // A feathered serpent's head rearing from a stepped plinth, jaws open.
    const p = piece('jg_serpent_statue');
    p.box('templeDark', [-0.8, 0, -0.8], [0.8, 0.35, 0.8]);
    p.box('temple', [-0.65, 0.35, -0.65], [0.65, 0.7, 0.65]);
    for (let i = 0; i < 5; i++) p.box('temple', [-0.35 + i * 0.02, 0.7 + i * 0.3, -0.45 + i * 0.12], [0.35 - i * 0.02, 1.0 + i * 0.3, 0.05 + i * 0.12]);
    p.box('temple', [-0.42, 2.15, -0.1], [0.42, 2.55, 0.95]);
    p.box('templeDark', [-0.38, 1.85, 0.0], [0.38, 2.05, 0.9]);
    for (const s of [-1, 1]) {
      p.box('ivory', [s * 0.3 - 0.04, 1.98, 0.8], [s * 0.3 + 0.04, 2.15, 0.88]);
      p.sphere('jade', [s * 0.3, 2.45, 0.7], 0.07, { rings: 4, seg: 6 });
      obox(p, 'leafLight', [s * 0.5, 2.6, -0.1], [0.08, 0.7, 0.35], { roll: s * 0.4 });
    }
    blob(p, 'moss', [0.5, 0.4, 0.6], 0.3, 0.5);
    return p;
  },
  jg_carved_pillar() {
    // A square temple pillar banded with carved glyphs, moss creeping up it.
    const p = piece('jg_carved_pillar');
    p.box('templeDark', [-0.55, 0, -0.55], [0.55, 0.35, 0.55]);
    p.box('temple', [-0.42, 0.35, -0.42], [0.42, 3.65, 0.42]);
    p.box('templeDark', [-0.55, 3.65, -0.55], [0.55, 4.0, 0.55]);
    for (const y of [1.0, 2.0, 3.0]) {
      p.box('templeDark', [-0.45, y, -0.45], [0.45, y + 0.25, 0.45]);
      for (const x of [-0.25, 0, 0.25]) p.box('temple', [x - 0.07, y + 0.06, 0.44], [x + 0.07, y + 0.19, 0.47]);
    }
    blob(p, 'moss', [0.3, 0.6, 0.35], 0.3, 0.8);
    blob(p, 'moss', [-0.35, 3.9, 0.2], 0.3, 0.5);
    return p;
  },
  jg_altar_stone() {
    // An altar block on a stepped dais, a golden bowl on top.
    const p = piece('jg_altar_stone');
    p.box('templeDark', [-1.3, 0, -0.9], [1.3, 0.25, 0.9]);
    p.box('temple', [-1.0, 0.25, -0.6], [1.0, 1.0, 0.6]);
    p.box('templeDark', [-1.05, 1.0, -0.65], [1.05, 1.1, 0.65]);
    for (const x of [-0.6, 0, 0.6]) p.box('templeDark', [x - 0.15, 0.45, 0.6], [x + 0.15, 0.8, 0.63]);
    p.cylinder('gold', [0, 1.1, 0], 0.25, 0, 0.15, { seg: 12, r1: 0.32 });
    return p;
  },
  jg_stele() {
    // A carved stele: a tall slab of glyph panels.
    const p = piece('jg_stele');
    p.box('templeDark', [-0.75, 0, -0.4], [0.75, 0.3, 0.4]);
    p.box('temple', [-0.6, 0.3, -0.25], [0.6, 3.0, 0.25]);
    p.cylinder('temple', [0, 3.0, 0], 0.6, -0.25, 0.25, { seg: 12, axis: 'z' });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) p.box('templeDark', [-0.48 + c * 0.5, 0.55 + r * 0.6, 0.25], [-0.02 + c * 0.5, 1.0 + r * 0.6, 0.28]);
    blob(p, 'moss', [0.4, 3.2, 0], 0.3, 0.6);
    return p;
  },
  jg_vine_curtain() {
    // A curtain of hanging vines, 3 m wide (walk through it).
    const p = piece('jg_vine_curtain');
    const rnd = rng(17);
    p.box('vine', [-1.6, 3.9, -0.06], [1.6, 4.0, 0.06]);
    for (let i = 0; i < 18; i++) {
      const x = -1.5 + i * (3 / 17);
      const len = 1.6 + rnd() * 2.2;
      p.box('vine', [x - 0.02, 4.0 - len, -0.02], [x + 0.02, 4.0, 0.02]);
      for (let y = 4.0 - len + 0.2; y < 3.9; y += 0.45) leaf(p, rnd() < 0.5 ? 'leaf' : 'leafDark', [x, y, 0], 0.22, 0.12, rnd() * Math.PI * 2, -0.4);
    }
    return p;
  },
  jg_liana() {
    // A long liana hanging from the canopy in loose loops.
    const p = piece('jg_liana');
    let prev = [0, 7, 0];
    for (let i = 1; i <= 14; i++) {
      const y = 7 - i * 0.48;
      const next = [Math.sin(i * 0.9) * 0.25, y, Math.cos(i * 0.7) * 0.2];
      beam(p, 'vine', prev, next, 0.05);
      if (i % 2) leaf(p, 'leaf', next, 0.25, 0.14, i, -0.3);
      prev = next;
    }
    return p;
  },
  jg_bridge_post() {
    // A rope-bridge anchor: two lashed posts with rope rails running off toward +Z.
    const p = piece('jg_bridge_post');
    for (const x of [-1.25, 1.25]) {
      p.cylinder('bark', [x, 0, 0], 0.13, 0, 1.6, { seg: 8, r1: 0.11 });
      for (const y of [0.4, 1.2]) p.ring('rope', [x, y, 0], 0.12, 0.16, 0, 0.08, { seg: 8 });
      beam(p, 'rope', [x, 1.15, 0], [x, 1.0, 1.4], 0.035);
      beam(p, 'rope', [x, 0.15, 0], [x, 0.05, 1.4], 0.035);
    }
    p.box('plank', [-1.25, 0, -0.2], [1.25, 0.08, 0.25]);
    return p;
  },
  jg_waterfall() {
    // A waterfall: layered sheets of falling water over a lip of rock, foam where it lands (walk through it).
    const p = piece('jg_waterfall');
    p.box('templeDark', [-3.2, 7.6, -0.6], [3.2, 8.0, 0.4]);
    const rnd = rng(23);
    for (let i = 0; i < 9; i++) {
      const x0 = -3 + i * 0.67;
      const z = 0.25 + rnd() * 0.25;
      p.box(i % 2 ? 'water' : 'waterDeep', [x0, 0.1, z], [x0 + 0.7, 7.65, z + 0.05]);
    }
    p.box('water', [-3.1, 6.8, 0.2], [3.1, 7.65, 0.6]);
    for (let i = 0; i < 12; i++) blob(p, 'foam', [-2.8 + i * 0.5, 0.2, 0.7 + rnd() * 0.4], 0.35 + rnd() * 0.15, 0.45);
    return p;
  },
  jg_giant_root() {
    // A giant buttress root arching out of the ground (low cover; vault over it).
    const p = piece('jg_giant_root');
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI;
      const a1 = ((i + 1) / 10) * Math.PI;
      beam(p, 'bark', [-Math.cos(a0) * 2, Math.sin(a0) * 1.2, 0], [-Math.cos(a1) * 2, Math.sin(a1) * 1.2, 0], 0.5 - Math.abs(i - 4.5) * 0.03, 0.6);
    }
    blob(p, 'moss', [-0.6, 1.25, 0], 0.3, 0.5);
    return p;
  },
  jg_banana_plant() {
    // A banana plant: a soft trunk and great drooping leaves (walk through it).
    const p = piece('jg_banana_plant');
    p.cylinder('leafDark', [0, 0, 0], 0.16, 0, 1.8, { seg: 8, r1: 0.1 });
    for (let i = 0; i < 7; i++) leaf(p, i % 2 ? 'leaf' : 'leafLight', [0, 1.6 + (i % 3) * 0.15, 0], 1.7, 0.5, (i / 7) * Math.PI * 2, 0.35 - (i % 3) * 0.25);
    p.sphere('yellow', [0.2, 1.4, 0.1], 0.12, { rings: 4, seg: 6, squash: 1.6 });
    return p;
  },
  jg_giant_fern() {
    // A giant fern: a rosette of long fronds (walk through it).
    const p = piece('jg_giant_fern');
    for (let i = 0; i < 10; i++) {
      const yaw = (i / 10) * Math.PI * 2;
      leaf(p, i % 2 ? 'leafDark' : 'leaf', [0, 0.1, 0], 1.6, 0.34, yaw, 0.55 - (i % 3) * 0.2);
    }
    p.sphere('leafDark', [0, 0.1, 0], 0.2, { rings: 4, seg: 8 });
    return p;
  },
  jg_monstera() {
    // A cluster of big round monstera leaves on stems (walk through it).
    const p = piece('jg_monstera');
    for (let i = 0; i < 6; i++) {
      const yaw = (i / 6) * Math.PI * 2 + 0.3;
      const r = 0.5 + (i % 2) * 0.2;
      const top = [Math.sin(yaw) * r, 0.9 + (i % 3) * 0.25, Math.cos(yaw) * r];
      beam(p, 'leafDark', [0, 0, 0], top, 0.04);
      p.cylinder(i % 2 ? 'leaf' : 'leafDark', top, 0.38, -0.02, 0.02, { seg: 10 });
    }
    return p;
  },
  jg_bamboo() {
    // A stand of bamboo: a dozen ringed canes up to 6 m.
    const p = piece('jg_bamboo');
    const rnd = rng(31);
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.45;
      const [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
      const h = 3.5 + rnd() * 2.5;
      p.cylinder('bamboo', [x, 0, z], 0.05, 0, h, { seg: 5, r1: 0.035 });
      for (let y = 0.9; y < h; y += 0.9) p.cylinder('bambooRing', [x, y, z], 0.056, 0, 0.04, { seg: 5, caps: false });
      leaf(p, 'leafLight', [x, h - 0.2, z], 0.5, 0.12, rnd() * 6, 0.1);
    }
    return p;
  },
  jg_brazier() {
    // A stone fire bowl on a carved pedestal, burning.
    const p = piece('jg_brazier');
    p.box('templeDark', [-0.4, 0, -0.4], [0.4, 0.2, 0.4]);
    p.cylinder('temple', [0, 0.2, 0], 0.22, 0, 0.75, { seg: 8, r1: 0.18 });
    p.cylinder('templeDark', [0, 0.95, 0], 0.25, 0, 0.3, { seg: 10, r1: 0.5 });
    p.sphere('ember', [0, 1.22, 0], 0.32, { rings: 4, seg: 8, squash: 0.35 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.cylinder('fire', [Math.cos(a) * 0.15, 1.2, Math.sin(a) * 0.15], 0.1, 0, 0.45 + (i % 2) * 0.2, { seg: 5, r1: 0 });
    }
    return p;
  },
  jg_rubble_blocks() {
    // Tumbled carved blocks from a fallen wall (cover).
    const p = piece('jg_rubble_blocks');
    p.box('temple', [-1.2, 0, -0.5], [-0.1, 0.7, 0.5], 0.2);
    p.box('templeDark', [0.0, 0, -0.6], [1.1, 0.6, 0.3], -0.3);
    p.box('temple', [-0.7, 0.7, -0.4], [0.3, 1.2, 0.35], 0.5);
    p.box('templeDark', [0.6, 0, 0.3], [1.3, 0.4, 0.9], 0.8);
    blob(p, 'moss', [-0.5, 0.75, 0.2], 0.25, 0.5);
    return p;
  },
  jg_gold_idol() {
    // The golden idol on its pedestal (the thing everyone came for).
    const p = piece('jg_gold_idol');
    p.box('templeDark', [-0.4, 0, -0.4], [0.4, 0.9, 0.4]);
    p.box('temple', [-0.45, 0.9, -0.45], [0.45, 1.0, 0.45]);
    p.box('gold', [-0.14, 1.0, -0.1], [0.14, 1.3, 0.1]);
    p.box('gold', [-0.17, 1.3, -0.12], [0.17, 1.55, 0.12]);
    p.box('jade', [-0.1, 1.42, 0.12], [-0.03, 1.47, 0.13]).box('jade', [0.03, 1.42, 0.12], [0.1, 1.47, 0.13]);
    p.box('gold', [-0.2, 1.55, -0.04], [0.2, 1.62, 0.04]);
    return p;
  },
};

// ---------------------------------------------------------------- 08 Suburban Chaos

const SUBURBAN = {
  sb_microwave() {
    // A microwave oven (it goes off with a bang when shot).
    const p = piece('sb_microwave');
    p.box('white', [-0.26, 0, -0.18], [0.26, 0.3, 0.18]);
    p.box('screen', [-0.22, 0.05, 0.18], [0.08, 0.25, 0.19]);
    p.box('dark', [0.1, 0.05, 0.18], [0.23, 0.25, 0.19]);
    p.box('digit', [0.12, 0.2, 0.19], [0.21, 0.23, 0.195]);
    p.box('silver', [0.06, 0.08, 0.19], [0.08, 0.22, 0.21]);
    return p;
  },
  sb_fridge() {
    // A big two-door fridge freezer.
    const p = piece('sb_fridge');
    p.box('silver', [-0.42, 0, -0.35], [0.42, 1.8, 0.33]);
    p.box('chrome', [-0.415, 0.05, 0.33], [-0.005, 1.78, 0.36]).box('chrome', [0.005, 0.05, 0.33], [0.415, 1.78, 0.36]);
    for (const s of [-1, 1]) p.box('dark', [s * 0.04 - 0.012, 0.75, 0.36], [s * 0.04 + 0.012, 1.35, 0.4]);
    p.box('screen', [-0.3, 1.2, 0.36], [-0.12, 1.45, 0.365]);
    p.box('dark', [-0.42, 0, 0.3], [0.42, 0.05, 0.36]);
    return p;
  },
  sb_bbq_grill() {
    // A gas barbecue on a trolley, its propane bottle underneath (explodes when shot).
    const p = piece('sb_bbq_grill');
    for (const [x, z] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]]) p.box('dark', [x - 0.03, 0, z - 0.03], [x + 0.03, 0.85, z + 0.03]);
    p.box('dark', [-0.6, 0.18, -0.3], [0.6, 0.21, 0.3]);
    p.cylinder('white', [-0.25, 0.21, 0], 0.15, 0, 0.45, { seg: 10 });
    p.cylinder('white', [-0.25, 0.66, 0], 0.06, 0, 0.06, { seg: 8 });
    p.box('dark', [-0.62, 0.85, -0.3], [0.62, 0.95, 0.3]);
    p.box('red', [-0.45, 0.95, -0.28], [0.45, 1.05, 0.28]);
    obox(p, 'red', [0, 1.18, -0.06], [0.9, 0.06, 0.6], { pitch: -0.5 });
    p.box('chrome', [-0.3, 1.0, 0.3], [0.3, 1.03, 0.34]);
    for (const x of [-0.35, 0, 0.35]) p.box('chrome', [x - 0.03, 0.9, 0.3], [x + 0.03, 0.95, 0.33]);
    p.box('silver', [0.62, 0.85, -0.25], [0.95, 0.88, 0.25]);
    return p;
  },
  sb_propane_tank() {
    // A big white propane tank on its feet (a big bang when shot).
    const p = piece('sb_propane_tank');
    p.cylinder('white', [0, 0.1, 0], 0.3, 0, 1.0, { seg: 14 });
    p.sphere('white', [0, 1.1, 0], 0.3, { rings: 6, seg: 14, squash: 0.5 });
    p.cylinder('dark', [0, 0, 0], 0.26, 0, 0.12, { seg: 12 });
    p.cylinder('silver', [0, 1.22, 0], 0.05, 0, 0.12, { seg: 8 });
    p.ring('silver', [0, 1.3, 0], 0.08, 0.14, 0, 0.03, { seg: 10 });
    p.box('red', [-0.15, 0.55, 0.29], [0.15, 0.75, 0.31]);
    return p;
  },
  sb_washing_machine() {
    // A front-loading washing machine.
    const p = piece('sb_washing_machine');
    p.box('white', [-0.3, 0, -0.3], [0.3, 0.85, 0.3]);
    p.box('offwhite', [-0.3, 0.72, 0.3], [0.3, 0.85, 0.31]);
    p.ring('silver', [0, 0.38, 0.3], 0.15, 0.2, 0, 0.03, { seg: 18, axis: 'z' });
    p.cylinder('glass', [0, 0.38, 0.3], 0.15, 0, 0.02, { seg: 18, axis: 'z' });
    p.cylinder('grey', [0.18, 0.78, 0.31], 0.04, 0, 0.02, { seg: 10, axis: 'z' });
    return p;
  },
  sb_tv_flat() {
    // A flat-screen TV on a low stand.
    const p = piece('sb_tv_flat');
    p.box('wood', [-0.8, 0, -0.22], [0.8, 0.45, 0.22]);
    p.box('dark', [-0.75, 0.05, 0.22], [0.75, 0.4, 0.23]);
    p.box('dark', [-0.12, 0.45, -0.08], [0.12, 0.5, 0.08]).box('dark', [-0.03, 0.5, -0.03], [0.03, 0.62, 0.03]);
    p.box('black', [-0.62, 0.58, -0.03], [0.62, 1.3, 0.03]);
    p.box('screen', [-0.6, 0.6, 0.03], [0.6, 1.28, 0.035]);
    return p;
  },
  sb_mailbox() {
    // A curbside mailbox on a post, flag up.
    const p = piece('sb_mailbox');
    p.box('wood', [-0.05, 0, -0.05], [0.05, 1.0, 0.05]);
    p.box('blue', [-0.13, 1.0, -0.25], [0.13, 1.18, 0.25]);
    p.cylinder('blue', [0, 1.18, 0], 0.13, -0.25, 0.25, { seg: 10, axis: 'z' });
    p.box('red', [0.13, 1.1, 0.0], [0.15, 1.38, 0.04]).box('red', [0.13, 1.3, 0.04], [0.15, 1.38, 0.16]);
    return p;
  },
  sb_wheelie_bin() {
    // A wheelie bin (green lid).
    const p = piece('sb_wheelie_bin');
    p.box('grey', [-0.3, 0.08, -0.35], [0.3, 1.0, 0.35]);
    p.box('green', [-0.33, 1.0, -0.38], [0.33, 1.06, 0.38]);
    for (const x of [-0.25, 0.25]) p.cylinder('rubber', [x, 0.1, -0.33], 0.1, -0.04, 0.04, { seg: 10, axis: 'x' });
    p.box('dark', [-0.25, 0.95, -0.42], [0.25, 0.99, -0.38]);
    return p;
  },
  sb_lawnmower() {
    // A petrol lawnmower (its fuel tank goes up when shot).
    const p = piece('sb_lawnmower');
    p.box('red', [-0.25, 0.1, -0.3], [0.25, 0.3, 0.3]);
    p.cylinder('dark', [0, 0.3, 0.05], 0.12, 0, 0.18, { seg: 10 });
    p.cylinder('red', [0, 0.48, 0.05], 0.08, 0, 0.04, { seg: 10 });
    for (const [x, z] of [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]]) p.cylinder('rubber', [x, 0.1, z], 0.1, -0.03, 0.03, { seg: 10, axis: 'x' });
    for (const x of [-0.2, 0.2]) beam(p, 'silver', [x, 0.3, -0.3], [x, 0.95, -0.8], 0.025);
    p.box('rubber', [-0.22, 0.92, -0.82], [0.22, 0.98, -0.76]);
    p.box('green', [-0.2, 0.1, -0.75], [0.2, 0.45, -0.3]);
    return p;
  },
  sb_garden_gnome() {
    // A garden gnome.
    const p = piece('sb_garden_gnome');
    p.cylinder('green', [0, 0, 0], 0.13, 0, 0.12, { seg: 10 });
    p.cylinder('blue', [0, 0.12, 0], 0.13, 0, 0.2, { seg: 10, r1: 0.1 });
    p.sphere('linen', [0, 0.36, 0.04], 0.09, { rings: 4, seg: 8, squash: 1.3 });
    p.sphere('skinPink', [0, 0.44, 0.03], 0.07, { rings: 5, seg: 8 });
    p.cylinder('red', [0, 0.48, 0], 0.08, 0, 0.22, { seg: 8, r1: 0 });
    return p;
  },
  sb_picket_fence() {
    // 2.4 m of white picket fence (it splinters when shot).
    const p = piece('sb_picket_fence');
    for (const x of [-1.15, 1.15]) p.box('white', [x - 0.05, 0, -0.05], [x + 0.05, 1.05, 0.05]);
    for (const y of [0.25, 0.75]) p.box('white', [-1.2, y, -0.06], [1.2, y + 0.08, -0.02]);
    for (let i = 0; i < 16; i++) {
      const x = -1.08 + i * 0.144;
      p.box('white', [x - 0.04, 0.03, -0.02], [x + 0.04, 0.95, 0.0]);
      p.cylinder('white', [x, 0.95, -0.01], 0.055, 0, 0.08, { seg: 4, r1: 0 });
    }
    return p;
  },
  sb_swing_set() {
    // A playground swing set: an A-frame with two swings (walk under it).
    const p = piece('sb_swing_set');
    for (const x of [-1.8, 1.8]) {
      beam(p, 'blue', [x, 0, -0.8], [x, 2.4, 0], 0.08);
      beam(p, 'blue', [x, 0, 0.8], [x, 2.4, 0], 0.08);
    }
    p.cylinder('blue', [0, 2.4, 0], 0.06, -1.85, 1.85, { seg: 8, axis: 'x' });
    for (const x of [-0.7, 0.7]) {
      for (const s of [-1, 1]) p.box('silver', [x + s * 0.22 - 0.01, 0.5, -0.01], [x + s * 0.22 + 0.01, 2.4, 0.01]);
      p.box('rubber', [x - 0.25, 0.45, -0.12], [x + 0.25, 0.5, 0.12]);
    }
    return p;
  },
  sb_slide() {
    // A playground slide: a ladder up to a little deck, the chute down toward +Z.
    const p = piece('sb_slide');
    for (const x of [-0.3, 0.3]) {
      p.box('yellow', [x - 0.04, 0, -1.5], [x + 0.04, 2.6, -1.42]);
      p.box('yellow', [x - 0.04, 0, -0.8], [x + 0.04, 2.6, -0.72]);
    }
    p.box('red', [-0.35, 1.6, -1.5], [0.35, 1.68, -0.72]);
    for (let i = 0; i < 5; i++) beam(p, 'silver', [-0.3, 0.3 + i * 0.3, -1.6 - i * 0.02], [0.3, 0.3 + i * 0.3, -1.6 - i * 0.02], 0.04);
    obox(p, 'yellow', [0, 0.85, 0.35], [0.6, 0.06, 2.6], { pitch: -0.62 });
    for (const s of [-1, 1]) obox(p, 'yellow', [s * 0.32, 0.98, 0.35], [0.04, 0.22, 2.6], { pitch: -0.62 });
    p.box('red', [-0.35, 1.68, -1.5], [0.35, 2.3, -1.45]);
    return p;
  },
  sb_trampoline() {
    // A round garden trampoline on legs (pair it with a jump pad).
    const p = piece('sb_trampoline');
    p.cylinder('rubber', [0, 0.78, 0], 1.45, 0, 0.03, { seg: 24 });
    p.ring('blue', [0, 0.78, 0], 1.45, 1.75, 0, 0.08, { seg: 24 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.box('silver', [Math.cos(a) * 1.65 - 0.03, 0, Math.sin(a) * 1.65 - 0.03], [Math.cos(a) * 1.65 + 0.03, 0.8, Math.sin(a) * 1.65 + 0.03]);
    }
    return p;
  },
  sb_basketball_hoop() {
    // A driveway basketball hoop.
    const p = piece('sb_basketball_hoop');
    p.box('dark', [-0.3, 0, -0.3], [0.3, 0.2, 0.3]);
    p.cylinder('grey', [0, 0.2, 0], 0.06, 0, 3.0, { seg: 8 });
    beam(p, 'grey', [0, 2.9, 0], [0, 3.1, 0.55], 0.06);
    p.box('white', [-0.6, 2.75, 0.55], [0.6, 3.5, 0.6]);
    p.box('red', [-0.25, 2.95, 0.6], [0.25, 3.25, 0.61]);
    p.ring('orange', [0, 3.05, 0.85], 0.2, 0.23, 0, 0.02, { seg: 14 });
    return p;
  },
  sb_gas_pump() {
    // A petrol pump on its island (goes up when shot).
    const p = piece('sb_gas_pump');
    p.box('offwhite', [-0.7, 0, -0.45], [0.7, 0.15, 0.45]);
    p.box('white', [-0.4, 0.15, -0.25], [0.4, 1.85, 0.25]);
    p.box('red', [-0.42, 1.55, -0.27], [0.42, 1.95, 0.27]);
    p.box('screen', [-0.25, 1.05, 0.25], [0.25, 1.4, 0.26]);
    p.box('digit', [-0.2, 1.25, 0.26], [0.2, 1.35, 0.265]);
    p.box('dark', [0.4, 0.7, -0.08], [0.48, 0.95, 0.08]);
    beam(p, 'rubber', [0.44, 0.75, 0], [0.5, 0.2, 0.3], 0.03);
    p.box('sign', [-0.38, 1.6, 0.27], [0.38, 1.9, 0.28]);
    return p;
  },
  sb_sedan() {
    // A family saloon car (solid cover; it burns and blows up when shot enough).
    const p = piece('sb_sedan');
    p.box('paint', [-0.88, 0.3, -2.2], [0.88, 0.85, 2.2]);
    p.box('paint', [-0.82, 0.85, -1.0], [0.82, 1.35, 0.9]);
    obox(p, 'glass', [0, 1.1, 1.1], [1.6, 0.04, 0.6], { pitch: -0.85 });
    obox(p, 'glass', [0, 1.1, -1.2], [1.6, 0.04, 0.55], { pitch: 0.95 });
    for (const s of [-1, 1]) p.box('glass', [s * 0.83 - 0.01, 0.9, -0.95], [s * 0.83 + 0.01, 1.3, 0.85]);
    for (const [x, z] of [[-0.82, -1.35], [0.82, -1.35], [-0.82, 1.35], [0.82, 1.35]]) {
      p.cylinder('rubber', [x, 0.33, z], 0.33, -0.12, 0.12, { seg: 12, axis: 'x' });
      p.cylinder('silver', [x + Math.sign(x) * 0.13, 0.33, z], 0.18, -0.005, 0.005, { seg: 10, axis: 'x' });
    }
    p.box('chrome', [-0.85, 0.35, 2.2], [0.85, 0.5, 2.26]).box('chrome', [-0.85, 0.35, -2.26], [0.85, 0.5, -2.2]);
    for (const s of [-1, 1]) {
      p.box('lamp', [s * 0.65 - 0.15, 0.62, 2.2], [s * 0.65 + 0.15, 0.75, 2.22]);
      p.box('red', [s * 0.65 - 0.15, 0.62, -2.22], [s * 0.65 + 0.15, 0.75, -2.2]);
    }
    return p;
  },
  sb_patio_set() {
    // A patio table under a parasol with four chairs (walk between them; the pole is solid).
    const p = piece('sb_patio_set');
    p.cylinder('white', [0, 0.7, 0], 0.55, 0, 0.04, { seg: 16 });
    p.cylinder('white', [0, 0, 0], 0.04, 0, 0.7, { seg: 6 });
    p.cylinder('silver', [0, 0, 0], 0.025, 0, 2.3, { seg: 6 });
    p.cylinder('teal', [0, 2.0, 0], 1.3, 0, 0.35, { seg: 8, r1: 0.05 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const [x, z] = [Math.cos(a) * 0.85, Math.sin(a) * 0.85];
      p.box('white', [x - 0.22, 0.4, z - 0.22], [x + 0.22, 0.45, z + 0.22]);
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) p.box('white', [x + dx - 0.02, 0, z + dz - 0.02], [x + dx + 0.02, 0.4, z + dz + 0.02]);
      const bx = Math.cos(a) * 1.05;
      const bz = Math.sin(a) * 1.05;
      p.box('white', [bx - 0.22, 0.45, bz - 0.03], [bx + 0.22, 0.9, bz + 0.03], Math.PI / 2 - a);
    }
    return p;
  },
  sb_sun_lounger() {
    // A poolside sun lounger.
    const p = piece('sb_sun_lounger');
    for (const [x, z] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) p.box('silver', [x - 0.025, 0, z - 0.025], [x + 0.025, 0.3, z + 0.025]);
    p.box('white', [-0.33, 0.3, -0.9], [0.33, 0.36, 0.5]);
    obox(p, 'white', [0, 0.6, 0.75], [0.66, 0.06, 0.65], { pitch: 0.9 });
    p.box('cushion', [-0.3, 0.36, -0.88], [0.3, 0.4, 0.48]);
    return p;
  },
  sb_fire_hydrant() {
    // A red fire hydrant.
    const p = piece('sb_fire_hydrant');
    p.cylinder('red', [0, 0, 0], 0.16, 0, 0.12, { seg: 10 });
    p.cylinder('red', [0, 0.12, 0], 0.12, 0, 0.55, { seg: 10 });
    p.sphere('red', [0, 0.67, 0], 0.13, { rings: 5, seg: 10, squash: 0.8 });
    p.cylinder('red', [0, 0.32, 0], 0.06, -0.2, 0.2, { seg: 8, axis: 'x' });
    p.cylinder('silver', [0, 0.32, 0.1], 0.06, 0, 0.08, { seg: 8, axis: 'z' });
    return p;
  },
};

// ---------------------------------------------------------------- write

const ALL = { ...GOTHIC, ...JUNGLE, ...SUBURBAN };
for (const [id, make] of Object.entries(ALL)) {
  const doc = piecesDocument([make()], 'tiletrigger build-style-props');
  await doc.transform(dedup(), prune());
  writeFileSync(join(OUT, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
}
console.log(`wrote ${Object.keys(ALL).length} props to assets-src/tiletrigger-styleprops (${Object.keys(GOTHIC).length} gothic, ${Object.keys(JUNGLE).length} jungle, ${Object.keys(SUBURBAN).length} suburban)`);
