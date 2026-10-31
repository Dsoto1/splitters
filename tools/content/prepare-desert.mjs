// MapMaker Style Pack 09 Desert City (the owner's "Tileset 02" sheet): the
// props we model ourselves, in code, from plain geometry
// (tools/content/pieces.mjs): a market stall and canopy, banners, a hanging
// brass lantern, a palm in a stone planter, a covered water well, a vase and
// a cluster of jars, a rug, a timber crane, a cloth line, a scaffold, awning,
// lattice and shuttered windows, spice baskets, floor cushions round a brass
// tray, a rug rack, a column and an ornate arch. No pack and no generative AI
// service is involved: the code is the source. (The market stall, well and
// crane are simple in-house versions under stable ids; better hero models can
// take the same ids later.)
//
//   node tools/content/prepare-desert.mjs
//
// Writes assets-src/tiletrigger-desert/<id>.glb (licence "Owned", see the
// License.txt there); `node tools/content/prepare-props.mjs` then normalises
// them into packages/client/public/props like every other prop, and
// `pnpm content:build` records them in the provenance ledger.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { Piece, piecesDocument } from './pieces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'assets-src/tiletrigger-desert');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  sandstone: { color: hex('#d6b688'), rough: 0.9 },
  sandDark: { color: hex('#a88a62'), rough: 0.9 },
  plaster: { color: hex('#ece0c4'), rough: 0.9 },
  cedar: { color: hex('#7a5434'), rough: 0.8 },
  cedarDark: { color: hex('#4a3220'), rough: 0.8 },
  plank: { color: hex('#a8845a'), rough: 0.85 },
  red: { color: hex('#b4322a'), rough: 0.85 },
  redDark: { color: hex('#7a2018'), rough: 0.85 },
  cream: { color: hex('#ead8b0'), rough: 0.9 },
  gold: { color: hex('#d8a83a'), metal: 0.8, rough: 0.35 },
  brass: { color: hex('#b08d3a'), metal: 0.75, rough: 0.35 },
  iron: { color: hex('#3a3634'), metal: 0.6, rough: 0.5 },
  blue: { color: hex('#2a5aa8'), rough: 0.5, metal: 0.1 },
  teal: { color: hex('#3a9a9a'), rough: 0.5 },
  terracotta: { color: hex('#b86a3e'), rough: 0.85 },
  terraDark: { color: hex('#8a4a2a'), rough: 0.85 },
  leaf: { color: hex('#4a7a2c'), rough: 0.8 },
  leafDark: { color: hex('#2e5a1e'), rough: 0.8 },
  trunk: { color: hex('#8a6a48'), rough: 0.9 },
  rope: { color: hex('#b09a6a'), rough: 0.9 },
  sack: { color: hex('#c8b088'), rough: 0.95 },
  saffron: { color: hex('#e0a020'), rough: 0.9 },
  paprika: { color: hex('#b8401c'), rough: 0.9 },
  sumac: { color: hex('#7a2a3a'), rough: 0.9 },
  green: { color: hex('#6a8a3a'), rough: 0.9 },
  glass: { color: hex('#7a98a8'), metal: 0.2, rough: 0.15 },
  water: { color: hex('#3a6a80'), metal: 0.1, rough: 0.1, alpha: 0.85 },
  lamp: { color: hex('#ffcf7a'), emissive: glow('#ffb84a', 0.9) },
  dark: { color: hex('#1a120c'), rough: 0.9 },
};
const piece = (name) => new Piece(name, MATS);

/**
 * A box of `size` centred on `c`, tilted `rx` about x, then `rz` about z,
 * then turned `ry` about y (radians).
 */
function obox(p, mat, c, size, { rx = 0, ry = 0, rz = 0 } = {}) {
  const [hx, hy, hz] = size.map((v) => v / 2);
  const rot = ([x, y, z]) => {
    let [a, b, d] = [x, y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    [a, b] = [a * Math.cos(rz) - b * Math.sin(rz), a * Math.sin(rz) + b * Math.cos(rz)];
    [a, d] = [a * Math.cos(ry) + d * Math.sin(ry), -a * Math.sin(ry) + d * Math.cos(ry)];
    return [a, b, d];
  };
  const v = (x, y, z) => {
    const [a, b, d] = rot([x, y, z]);
    return [a + c[0], b + c[1], d + c[2]];
  };
  const faces = [
    [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz], [1, 0, 0]],
    [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz], [-1, 0, 0]],
    [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [0, 1, 0]],
    [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [0, -1, 0]],
    [[hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [-hx, -hy, hz], [0, 0, 1]],
    [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz], [0, 0, -1]],
  ];
  for (const [a, b, cc, d, n] of faces) p.quad(mat, v(...a), v(...b), v(...cc), v(...d), rot(n));
}

/** A cloth sheet from a back edge at (y0, z0) to a front edge at (y1, z1), x0..x1 wide, with a scalloped valance hanging from the front. */
function canopy(p, mat, x0, x1, y0, z0, y1, z1, valance = 'red') {
  const len = Math.hypot(z1 - z0, y1 - y0);
  const a = Math.atan2(y0 - y1, z1 - z0);
  obox(p, mat, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, 0.03, len], { rx: a });
  const n = Math.max(3, Math.round((x1 - x0) / 0.5));
  for (let i = 0; i < n; i++) {
    const u0 = x0 + ((x1 - x0) * i) / n;
    const u1 = u0 + (x1 - x0) / n;
    p.box(i % 2 ? mat : valance, [u0, y1 - 0.28, z1 - 0.01], [u1, y1, z1 + 0.01]);
    p.tri(i % 2 ? mat : valance, [u0, y1 - 0.28, z1 + 0.012], [u1, y1 - 0.28, z1 + 0.012], [(u0 + u1) / 2, y1 - 0.42, z1 + 0.012], [0, 0, 1]);
  }
}

/** A palm: a leaning ringed trunk and a crown of drooping fronds. */
function palm(p, x, y, z, h) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    p.cylinder('trunk', [x + t0 * t0 * 0.35, y + t0 * h, z], 0.16 - t0 * 0.05, 0, h / n + 0.02, { seg: 7, r1: 0.15 - t0 * 0.05 });
  }
  const top = [x + 0.35, y + h, z];
  for (let k = 0; k < 9; k++) {
    const ang = (k / 9) * Math.PI * 2;
    for (let s = 0; s < 3; s++) {
      const r0 = 0.25 + s * 0.45;
      const cx = top[0] + Math.cos(ang) * r0;
      const cz = top[2] + Math.sin(ang) * r0;
      const cy = top[1] - s * s * 0.14;
      obox(p, s === 2 ? 'leafDark' : 'leaf', [cx, cy, cz], [0.5, 0.03, 0.34 - s * 0.06], { ry: -ang, rz: -0.25 - s * 0.3 });
    }
  }
  p.sphere('trunk', top, 0.2, { rings: 4, seg: 6 });
}

/** A round wicker basket heaped with spice (or grain) at (x, z). */
function basket(p, x, y, z, r, spice) {
  p.ring('rope', [x, y, z], r - 0.03, r, 0, 0.32, { seg: 12 });
  p.cylinder('rope', [x, y, z], r - 0.03, 0, 0.04, { seg: 12 });
  p.cylinder(spice, [x, y + 0.28, z], r - 0.03, 0, 0.12, { seg: 12, r1: 0.05 });
}

/** A terracotta jar: a body, a shoulder and a neck. */
function jar(p, x, z, h, r, mat = 'terracotta') {
  p.cylinder(mat, [x, 0, z], r * 0.55, 0, h * 0.15, { seg: 12, r1: r * 0.9 });
  p.cylinder(mat, [x, h * 0.15, z], r * 0.9, 0, h * 0.5, { seg: 12, r1: r });
  p.cylinder(mat, [x, h * 0.65, z], r, 0, h * 0.2, { seg: 12, r1: r * 0.4 });
  p.cylinder(mat === 'terracotta' ? 'terraDark' : mat, [x, h * 0.85, z], r * 0.3, 0, h * 0.15, { seg: 10, r1: r * 0.38 });
}

/** An eight-point star (two squares, one turned 45°) on a face along x at z, `r` across. */
function star(p, mat, x, y, z, r) {
  for (const a of [0, Math.PI / 4]) obox(p, mat, [x, y, z], [r, r, 0.02], { rz: a });
}

// ---------------------------------------------------------------- props

/** Each is built in metres, standing on y = 0, facing +Z; prepare-props measures and centres it. */
const PROPS = {
  dc_market_stall() {
    // A market stall: a plank counter heaped with spice baskets and pots, a back shelf, a red canopy on four cedar poles.
    const p = piece('dc_market_stall');
    p.box('plank', [-1.2, 0, 0.1], [1.2, 0.9, 0.8]);
    p.box('cedarDark', [-1.25, 0.9, 0.05], [1.25, 0.98, 0.85]);
    basket(p, -0.75, 0.98, 0.45, 0.24, 'saffron');
    basket(p, -0.2, 0.98, 0.45, 0.24, 'paprika');
    basket(p, 0.35, 0.98, 0.45, 0.24, 'sumac');
    jar(p, 0.9, 0.45, 0.4, 0.14);
    p.box('cedar', [-1.2, 0, -0.85], [1.2, 1.6, -0.6]);
    for (const x of [-0.8, 0, 0.8]) jar(p, x, -0.72, 0.35, 0.1, 'blue');
    for (const x of [-1.25, 1.25]) for (const z of [-0.9, 0.95]) p.box('cedar', [x - 0.05, 0, z - 0.05], [x + 0.05, z < 0 ? 2.5 : 2.2, z + 0.05]);
    canopy(p, 'red', -1.4, 1.4, 2.55, -1.05, 2.2, 1.25, 'cream');
    return p;
  },
  dc_canopy() {
    // A free-standing market canopy: red cloth on four cedar poles, a striped valance, ropes.
    const p = piece('dc_canopy');
    for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) p.box('cedar', [x - 0.05, 0, z - 0.05], [x + 0.05, z < 0 ? 2.9 : 2.5, z + 0.05]);
    canopy(p, 'red', -1.65, 1.65, 2.95, -1.65, 2.5, 1.65, 'cream');
    for (const x of [-1.5, 1.5]) obox(p, 'rope', [x, 1.3, -2.0], [0.02, 2.0, 0.02], { rx: 0.25 });
    return p;
  },
  dc_banner() {
    // A tall red banner with a gold star and a fringe, hanging from a crossbar on a bracket (hang it on a wall or a pole).
    const p = piece('dc_banner');
    p.box('cedarDark', [-0.08, 0, -0.08], [0.08, 4.2, 0.08]);
    p.box('cedarDark', [-0.08, 3.9, 0], [0.08, 4.0, 0.9]);
    p.cylinder('brass', [0, 3.92, 0.05], 0.025, 0, 0.9, { seg: 6, axis: 'z' });
    p.box('red', [-0.02, 1.4, 0.1], [0.02, 3.9, 0.85]);
    for (let i = 0; i < 6; i++) p.tri('red', [0, 1.4, 0.1 + i * 0.125], [0, 1.4, 0.225 + i * 0.125], [0, 1.25, 0.1625 + i * 0.125], [1, 0, 0]);
    for (const s of [-1, 1]) {
      for (const a of [0, Math.PI / 4]) obox(p, 'gold', [s * 0.03, 3.0, 0.475], [0.02, 0.36, 0.36], { rx: a });
      p.box('gold', [s * 0.025 - 0.005, 1.45, 0.12], [s * 0.025 + 0.005, 1.5, 0.83]);
      p.box('gold', [s * 0.025 - 0.005, 3.75, 0.12], [s * 0.025 + 0.005, 3.8, 0.83]);
    }
    return p;
  },
  dc_lantern() {
    // A hanging brass lantern on a chain from a wall bracket: a pierced brass cage round a glowing glass, a cap and finial.
    const p = piece('dc_lantern');
    p.box('iron', [-0.04, 1.6, -0.04], [0.04, 1.7, 0.75]);
    p.box('iron', [-0.04, 1.1, -0.04], [0.04, 1.7, 0.04]);
    p.cylinder('iron', [0, 1.1, 0.6], 0.012, 0, 0.5, { seg: 4 });
    p.cylinder('brass', [0, 0.42, 0.6], 0.16, 0, 0.12, { seg: 8, r1: 0.2 });
    p.cylinder('lamp', [0, 0.54, 0.6], 0.15, 0, 0.36, { seg: 8 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.box('brass', [Math.cos(a) * 0.17 - 0.015, 0.54, 0.6 + Math.sin(a) * 0.17 - 0.015], [Math.cos(a) * 0.17 + 0.015, 0.9, 0.6 + Math.sin(a) * 0.17 + 0.015]);
    }
    p.cylinder('brass', [0, 0.9, 0.6], 0.21, 0, 0.14, { seg: 8, r1: 0.04 });
    p.sphere('brass', [0, 1.06, 0.6], 0.04, { rings: 4, seg: 6 });
    p.cylinder('brass', [0, 0.3, 0.6], 0.02, 0, 0.12, { seg: 6, r1: 0.12 });
    return p;
  },
  dc_palm_planter() {
    // A date palm in a square sandstone planter with a moulded rim.
    const p = piece('dc_palm_planter');
    p.box('sandstone', [-0.55, 0, -0.55], [0.55, 0.7, 0.55]);
    p.box('sandDark', [-0.62, 0.62, -0.62], [0.62, 0.78, 0.62]);
    p.box('trunk', [-0.48, 0.6, -0.48], [0.48, 0.74, 0.48]);
    palm(p, 0, 0.7, 0, 3.2);
    return p;
  },
  dc_well() {
    // A covered water well: an octagonal stone curb, four cedar posts under a little blue dome, a windlass, rope and bucket.
    const p = piece('dc_well');
    p.ring('sandstone', [0, 0, 0], 0.62, 0.95, 0, 0.85, { seg: 8 });
    p.ring('sandDark', [0, 0, 0], 0.6, 1.02, 0.85, 0.1, { seg: 8 });
    p.cylinder('water', [0, 0, 0], 0.62, 0.0, 0.35, { seg: 8 });
    for (const x of [-0.8, 0.8]) for (const z of [-0.8, 0.8]) p.box('cedar', [x - 0.07, 0.85, z - 0.07], [x + 0.07, 2.4, z + 0.07]);
    p.box('cedarDark', [-0.95, 2.4, -0.95], [0.95, 2.52, 0.95]);
    for (let i = 0; i < 6; i++) {
      const y = 2.52 + i * 0.13;
      const r = 0.92 * Math.sqrt(1 - (i / 6) ** 2);
      p.cylinder('blue', [0, y, 0], r, 0, 0.13, { seg: 12, r1: 0.92 * Math.sqrt(Math.max(0, 1 - ((i + 1) / 6) ** 2)) });
    }
    p.cylinder('gold', [0, 3.3, 0], 0.03, 0, 0.35, { seg: 6 });
    p.cylinder('cedar', [-0.8, 1.6, 0], 0.07, 0, 1.6, { seg: 8, axis: 'x' });
    p.cylinder('rope', [0, 0.75, 0], 0.012, 0, 0.85, { seg: 4 });
    p.cylinder('plank', [0, 0.55, 0], 0.13, 0, 0.22, { seg: 10, r1: 0.16 });
    return p;
  },
  dc_vase() {
    // A tall terracotta storage vase with blue bands (breaks when shot).
    const p = piece('dc_vase');
    jar(p, 0, 0, 1.1, 0.3);
    p.ring('blue', [0, 0, 0], 0.29, 0.305, 0.55, 0.06, { seg: 12 });
    p.ring('blue', [0, 0, 0], 0.27, 0.285, 0.75, 0.04, { seg: 12 });
    return p;
  },
  dc_jars() {
    // A cluster of water jars and pots on the ground (break when shot).
    const p = piece('dc_jars');
    jar(p, -0.3, -0.1, 0.75, 0.22);
    jar(p, 0.25, -0.2, 0.6, 0.2, 'terraDark');
    jar(p, 0.05, 0.3, 0.45, 0.17);
    jar(p, -0.55, 0.35, 0.35, 0.13, 'blue');
    return p;
  },
  dc_rug() {
    // A woven rug laid flat: a red field, a dark blue border, cream bands and a lozenge medallion, tassels at the ends.
    const p = piece('dc_rug');
    p.box('blue', [-1.0, 0, -1.5], [1.0, 0.012, 1.5]);
    p.box('cream', [-0.88, 0.012, -1.38], [0.88, 0.016, 1.38]);
    p.box('red', [-0.82, 0.016, -1.32], [0.82, 0.02, 1.32]);
    for (const [s, m] of [[0.7, 'cream'], [0.5, 'blue'], [0.3, 'saffron'], [0.12, 'cream']]) obox(p, m, [0, 0.02 + (0.8 - s) * 0.004, 0], [s, 0.004, s * 1.4], { ry: Math.PI / 4 });
    for (let i = 0; i < 9; i++) for (const z of [-1.55, 1.5]) p.box('cream', [-0.9 + i * 0.225, 0, z], [-0.87 + i * 0.225, 0.008, z + 0.05]);
    return p;
  },
  dc_crane() {
    // A timber crane: a post on a stone base, a braced jib, a pulley, rope and a hook with a bale of goods.
    const p = piece('dc_crane');
    p.box('sandstone', [-0.5, 0, -0.5], [0.5, 0.5, 0.5]);
    p.box('cedar', [-0.15, 0.5, -0.15], [0.15, 4.4, 0.15]);
    p.box('cedar', [-0.12, 4.1, -0.3], [0.12, 4.4, 2.6]);
    obox(p, 'cedarDark', [0, 3.3, 0.85], [0.1, 0.1, 1.9], { rx: -0.82 });
    p.cylinder('iron', [-0.12, 4.0, 2.45], 0.1, 0, 0.24, { seg: 10, axis: 'x' });
    p.cylinder('rope', [0, 1.8, 2.45], 0.015, 0, 2.2, { seg: 4 });
    p.box('iron', [-0.04, 1.6, 2.41], [0.04, 1.8, 2.49]);
    p.box('sack', [-0.35, 0.95, 2.1], [0.35, 1.6, 2.8]);
    for (const y of [1.1, 1.45]) p.box('rope', [-0.36, y, 2.09], [0.36, y + 0.04, 2.81]);
    p.cylinder('cedar', [-0.3, 1.2, 0], 0.08, 0, 0.6, { seg: 8, axis: 'x' });
    return p;
  },
  dc_cloth_line() {
    // A cloth line between two poles: dyed cloths and a rug hung over the rope.
    const p = piece('dc_cloth_line');
    for (const x of [-1.8, 1.8]) p.box('cedar', [x - 0.05, 0, -0.05], [x + 0.05, 2.6, 0.05]);
    p.box('rope', [-1.8, 2.42, -0.01], [1.8, 2.44, 0.01]);
    const cloths = [[-1.5, -0.8, 'red', 1.1], [-0.65, -0.1, 'cream', 1.3], [0.05, 0.75, 'blue', 0.9], [0.9, 1.6, 'saffron', 1.2]];
    for (const [x0, x1, m, h] of cloths) p.box(m, [x0, 2.42 - h, -0.01], [x1, 2.42, 0.01]);
    return p;
  },
  dc_scaffold() {
    // A timber scaffold two lifts high against a wall: poles, ledgers, braces and plank decks (stand it against a house).
    const p = piece('dc_scaffold');
    for (const x of [-1.2, 1.2]) for (const z of [-0.5, 0.5]) p.box('cedar', [x - 0.06, 0, z - 0.06], [x + 0.06, 4.2, z + 0.06]);
    for (const y of [1.9, 3.9]) {
      p.box('plank', [-1.3, y, -0.55], [1.3, y + 0.08, 0.55]);
      for (const z of [-0.5, 0.5]) p.box('cedarDark', [-1.3, y - 0.12, z - 0.05], [1.3, y, z + 0.05]);
    }
    for (const z of [-0.5, 0.5]) obox(p, 'cedarDark', [0, 0.95, z], [0.06, 0.06, 2.7], { ry: Math.PI / 2, rz: 0.68 });
    obox(p, 'cedarDark', [0, 2.95, 0.5], [0.06, 0.06, 2.7], { ry: Math.PI / 2, rz: -0.68 });
    return p;
  },
  dc_awning_window() {
    // A window with a cedar frame and a slatted wooden awning over it (stick it on a plain wall).
    const p = piece('dc_awning_window');
    p.box('cedarDark', [-0.7, 0, 0], [0.7, 0.12, 0.15]);
    p.box('cedarDark', [-0.7, 1.3, 0], [0.7, 1.4, 0.08]);
    for (const s of [-1, 1]) p.box('cedarDark', [s * 0.7 - 0.06, 0, 0], [s * 0.7 + 0.06, 1.4, 0.08]);
    p.box('dark', [-0.64, 0.12, 0.0], [0.64, 1.3, 0.02]);
    for (let i = 0; i < 7; i++) obox(p, i % 2 ? 'cedar' : 'plank', [0, 1.55 - i * 0.07, 0.12 + i * 0.09], [1.6, 0.025, 0.12], { rx: 0.5 });
    for (const s of [-1, 1]) obox(p, 'cedarDark', [s * 0.75, 1.35, 0.3], [0.04, 0.04, 0.6], { rx: 0.9 });
    return p;
  },
  dc_lattice_window() {
    // A mashrabiya oriel: a cedar box of lattice screens on carved brackets, a little roof (hang it on an upper storey).
    const p = piece('dc_lattice_window');
    p.box('cedarDark', [-0.8, 0, 0], [0.8, 0.14, 0.7]);
    for (const s of [-1, 1]) obox(p, 'cedarDark', [s * 0.55, -0.3, 0.25], [0.12, 0.6, 0.12], { rx: 0.7 });
    p.box('dark', [-0.72, 0.14, 0.05], [0.72, 1.55, 0.6]);
    // The lattice: diagonal bars over the dark box on the front and sides.
    for (let gx = 0; gx < 8; gx++) {
      for (let gy = 0; gy < 8; gy++) {
        const c = [-0.63 + gx * 0.18, 0.3 + gy * 0.165, 0.62];
        for (const s of [-1, 1]) obox(p, 'cedar', c, [0.03, 0.22, 0.02], { rz: s * 0.785 });
      }
    }
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) p.box('cedar', [s * 0.73 - 0.015, 0.2, 0.1 + i * 0.12], [s * 0.73 + 0.015, 1.5, 0.13 + i * 0.12]);
      for (let i = 0; i < 8; i++) p.box('cedar', [s * 0.73 - 0.015, 0.25 + i * 0.165, 0.05], [s * 0.73 + 0.015, 0.28 + i * 0.165, 0.6]);
    }
    p.box('cedar', [-0.8, 0.14, 0.6], [0.8, 0.22, 0.66]);
    p.box('cedar', [-0.8, 1.5, 0.6], [0.8, 1.58, 0.66]);
    for (const s of [-1, 0, 1]) p.box('cedar', [s * 0.76 - 0.04, 0.14, 0.6], [s * 0.76 + 0.04, 1.58, 0.68]);
    p.box('cedarDark', [-0.88, 1.58, -0.02], [0.88, 1.7, 0.78]);
    obox(p, 'cedar', [0, 1.78, 0.4], [1.85, 0.05, 0.85], { rx: 0.3 });
    return p;
  },
  dc_shutter_window() {
    // A window in a stone frame with blue shutters swung open and a sill.
    const p = piece('dc_shutter_window');
    p.box('sandDark', [-0.7, 0, 0], [0.7, 0.12, 0.16]);
    p.box('sandDark', [-0.7, 1.3, 0], [0.7, 1.42, 0.1]);
    for (const s of [-1, 1]) p.box('sandDark', [s * 0.62 - 0.08, 0, 0], [s * 0.62 + 0.08, 1.42, 0.1]);
    p.box('dark', [-0.54, 0.12, 0.0], [0.54, 1.3, 0.02]);
    for (const [x0, x1] of [[-1.25, -0.72], [0.72, 1.25]]) {
      p.box('blue', [x0, 0.08, 0.0], [x1, 1.34, 0.05]);
      for (let y = 0.2; y < 1.25; y += 0.12) p.box('cedarDark', [x0 + 0.06, y, 0.05], [x1 - 0.06, y + 0.03, 0.065]);
    }
    return p;
  },
  dc_spice_baskets() {
    // Baskets of spice and sacks of grain on the ground, the stock of a market stall (low cover).
    const p = piece('dc_spice_baskets');
    basket(p, -0.55, 0, -0.25, 0.3, 'saffron');
    basket(p, 0.1, 0, -0.3, 0.3, 'paprika');
    basket(p, 0.7, 0, -0.2, 0.28, 'green');
    basket(p, -0.25, 0, 0.35, 0.28, 'sumac');
    p.sphere('sack', [0.45, 0.3, 0.4], 0.32, { rings: 6, seg: 8, squash: 1.1 });
    p.cylinder('rope', [0.45, 0.62, 0.4], 0.08, 0, 0.1, { seg: 6 });
    return p;
  },
  dc_cushions() {
    // A majlis corner: floor cushions round a brass tray table, a teapot and glasses.
    const p = piece('dc_cushions');
    p.box('red', [-1.1, 0, -1.1], [1.1, 0.16, -0.5]);
    p.box('redDark', [-1.1, 0.16, -1.1], [1.1, 0.55, -0.9]);
    p.box('blue', [-1.1, 0, -0.5], [-0.5, 0.16, 1.1]);
    p.box('teal', [-1.1, 0.16, -0.9], [-0.9, 0.55, 1.1]);
    for (const [x, z] of [[-0.6, -0.95], [0.3, -0.95], [-0.95, 0.2]]) p.box('saffron', [x - 0.2, 0.16, z - 0.05], [x + 0.2, 0.5, z + 0.1]);
    p.cylinder('cedarDark', [0.2, 0, 0.2], 0.25, 0, 0.32, { seg: 8, r1: 0.18 });
    p.cylinder('brass', [0.2, 0.32, 0.2], 0.42, 0, 0.03, { seg: 16 });
    p.cylinder('brass', [0.1, 0.35, 0.15], 0.07, 0, 0.12, { seg: 8, r1: 0.04 });
    for (const [x, z] of [[0.35, 0.3], [0.4, 0.05], [0.15, 0.45]]) p.cylinder('glass', [x, 0.35, z], 0.025, 0, 0.07, { seg: 6 });
    return p;
  },
  dc_rug_rack() {
    // A market rack of rugs for sale: a cedar frame with rugs hung over its rails (cover).
    const p = piece('dc_rug_rack');
    for (const x of [-1.2, 1.2]) for (const z of [-0.3, 0.3]) p.box('cedar', [x - 0.05, 0, z - 0.05], [x + 0.05, 2.0, z + 0.05]);
    for (const z of [-0.3, 0.3]) p.box('cedarDark', [-1.25, 1.95, z - 0.04], [1.25, 2.03, z + 0.04]);
    const rugs = [[-0.3, 'red', 'blue'], [0.3, 'blue', 'cream']];
    for (const [z, field, border] of rugs) {
      p.box(border, [-1.1, 0.35, z - 0.03], [1.1, 1.95, z + 0.03]);
      p.box(field, [-0.95, 0.5, z - 0.035], [0.95, 1.85, z + 0.035]);
      for (const s of [-1, 1]) star(p, 'saffron', 0, 1.15, z + s * 0.04, 0.4);
    }
    return p;
  },
  dc_column() {
    // A sandstone column: a square base, a round shaft with a ring, a carved capital and an abacus (an arcade post or a ruin).
    const p = piece('dc_column');
    p.box('sandDark', [-0.4, 0, -0.4], [0.4, 0.3, 0.4]);
    p.cylinder('sandstone', [0, 0.3, 0], 0.28, 0, 0.2, { seg: 12, r1: 0.24 });
    p.cylinder('sandstone', [0, 0.5, 0], 0.22, 0, 2.6, { seg: 12, r1: 0.2 });
    p.ring('gold', [0, 0, 0], 0.15, 0.23, 2.7, 0.06, { seg: 12 });
    p.cylinder('sandstone', [0, 3.1, 0], 0.2, 0, 0.35, { seg: 12, r1: 0.34 });
    p.box('sandDark', [-0.42, 3.45, -0.42], [0.42, 3.62, 0.42]);
    for (const s of [-1, 1]) star(p, 'blue', 0, 3.27, s * 0.3, 0.14);
    return p;
  },
  dc_ornate_arch() {
    // A free-standing ornate arch: two piers, a horseshoe arch of alternating voussoirs, a zellige spandrel band and a cornice.
    const p = piece('dc_ornate_arch');
    for (const s of [-1, 1]) {
      p.box('sandstone', [s * 1.3 - 0.4, 0, -0.35], [s * 1.3 + 0.4, 2.4, 0.35]);
      p.box('sandDark', [s * 1.3 - 0.46, 0, -0.4], [s * 1.3 + 0.46, 0.35, 0.4]);
      p.box('sandDark', [s * 1.3 - 0.46, 2.3, -0.4], [s * 1.3 + 0.46, 2.45, 0.4]);
    }
    // The arch: voussoirs round a horseshoe (a little more than a half circle) from the piers' tops.
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = -0.25 + ((Math.PI + 0.5) * (i + 0.5)) / n;
      const r = 1.05;
      obox(p, i % 2 ? 'sandstone' : 'terracotta', [Math.cos(a) * (r + 0.2), 2.6 + Math.sin(a) * (r + 0.2), 0], [0.38, 0.32, 0.66], { rz: a - Math.PI / 2 });
    }
    // Spandrels and the band above the arch, a cornice.
    for (const s of [-1, 1]) p.box('sandstone', [s * 0.9, 2.45, -0.33], [s * 1.7, 3.85, 0.33]);
    p.box('sandstone', [-1.7, 3.85, -0.33], [1.7, 4.15, 0.33]);
    p.box('blue', [-1.7, 3.95, -0.36], [1.7, 4.1, 0.36]);
    p.box('sandDark', [-1.85, 4.15, -0.42], [1.85, 4.35, 0.42]);
    for (const s of [-1, 1]) star(p, 'teal', s * 1.3, 3.25, 0.34, 0.3), star(p, 'teal', s * 1.3, 3.25, -0.34, 0.3);
    return p;
  },
};

// ---------------------------------------------------------------- build

for (const [id, make] of Object.entries(PROPS)) {
  const pc = make();
  const doc = piecesDocument([pc], 'tiletrigger prepare-desert');
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
  if (process.env.DESERT_SIZES) {
    const all = [...pc.parts.values()].flatMap((q) => q.pos);
    const ax = (k) => all.filter((_, i) => i % 3 === k);
    console.log(id, [0, 1, 2].map((k) => Math.round((Math.max(...ax(k)) - Math.min(...ax(k))) * 1000) / 1000).join(' '), 'minY', Math.round(Math.min(...ax(1)) * 1000) / 1000);
  }
}
console.log(`wrote ${Object.keys(PROPS).length} prop sources to assets-src/tiletrigger-desert`);
