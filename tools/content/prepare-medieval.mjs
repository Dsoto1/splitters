// MapMaker Style Pack 10 Medieval Village (the owner's "Tileset 01" sheet):
// the props we model ourselves, in code, from plain geometry
// (tools/content/pieces.mjs): a stone well, market awning and pavilion, shop
// sign, hay cart, a blacksmith's hearth and workbench, planters, tarpaulined
// crates, chimney stack, wattle and spiked fences, the church bell, a market
// cross, the stocks, an oak post with knee braces, grain sacks, a bay window
// and shuttered windows. No pack and no generative AI service is involved:
// the code is the source. (The forge, hay cart, covered well and tarp tent
// are simple in-house versions; Meshy hero versions wait for the owner.)
//
//   node tools/content/prepare-medieval.mjs
//
// Writes assets-src/tiletrigger-medieval/<id>.glb (licence "Owned", see the
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
const SRC = join(ROOT, 'assets-src/tiletrigger-medieval');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  stone: { color: hex('#a8a296'), rough: 0.9 },
  stoneDark: { color: hex('#7a766c'), rough: 0.9 },
  brick: { color: hex('#9a5038'), rough: 0.85 },
  oak: { color: hex('#6a4a2e'), rough: 0.8 },
  oakDark: { color: hex('#42301e'), rough: 0.8 },
  plank: { color: hex('#9a7a52'), rough: 0.85 },
  iron: { color: hex('#3a3634'), metal: 0.6, rough: 0.5 },
  bronze: { color: hex('#8a6430'), metal: 0.75, rough: 0.35 },
  red: { color: hex('#a82a22'), rough: 0.8 },
  cream: { color: hex('#e8dcc0'), rough: 0.9 },
  blue: { color: hex('#2a4a8a'), rough: 0.8 },
  green: { color: hex('#3a6a2a'), rough: 0.8 },
  canvas: { color: hex('#b8a882'), rough: 0.9 },
  hay: { color: hex('#d8b858'), rough: 0.95 },
  hayDark: { color: hex('#b09040'), rough: 0.95 },
  sack: { color: hex('#c2aa80'), rough: 0.95 },
  leaf: { color: hex('#4a7a2c'), rough: 0.8 },
  flower: { color: hex('#d84a5a'), rough: 0.7 },
  flowerY: { color: hex('#e8c840'), rough: 0.7 },
  tile: { color: hex('#a84a30'), rough: 0.8 },
  glass: { color: hex('#7a98a8'), metal: 0.2, rough: 0.15 },
  water: { color: hex('#3a6a80'), metal: 0.1, rough: 0.1, alpha: 0.85 },
  rope: { color: hex('#a08a5a'), rough: 0.9 },
  coal: { color: hex('#2a1a12'), emissive: glow('#ff5a1a', 0.5) },
  fire: { color: hex('#ff8a2a'), emissive: glow('#ff8a2a') },
};
const piece = (name) => new Piece(name, MATS);

/**
 * A box of `size` centred on `c`, tilted `rx` about x, then `rz` about z,
 * then turned `ry` about y (radians): roof slopes, braces, leaning boards.
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

/** A wooden wheel on an axle along x at (x, y, z): rim, hub and spokes. */
function wheel(p, x, y, z, r) {
  p.ring('oakDark', [x, y, z], r * 0.82, r, -0.05, 0.1, { seg: 16, axis: 'x' });
  p.cylinder('oakDark', [x - 0.08, y, z], 0.08, 0, 0.16, { seg: 8, axis: 'x' });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI;
    obox(p, 'oak', [x, y, z], [0.05, r * 1.7, 0.05], { rx: a });
  }
}

/** A pitched roof of two slopes over x0..x1 (ridge along x at z = 0), eaves at `y` and `w` out, rising `rise`. */
function roof(p, mat, x0, x1, y, w, rise, t = 0.06) {
  const len = Math.hypot(w, rise);
  const a = Math.atan2(rise, w);
  for (const s of [1, -1]) obox(p, mat, [(x0 + x1) / 2, y + rise / 2, (s * w) / 2], [x1 - x0, t, len], { rx: s * a });
}

/** A crate of side `s` at (x, z), standing on `y`: planks and an oak frame. */
function crate(p, x, y, z, s) {
  p.box('plank', [x - s / 2, y, z - s / 2], [x + s / 2, y + s, z + s / 2]);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) p.box('oak', [x + dx * s / 2 - 0.04, y, z + dz * s / 2 - 0.04], [x + dx * s / 2 + 0.04, y + s, z + dz * s / 2 + 0.04]);
}

/** A grain sack lying at (x, y, z), turned `yaw`. */
function sack(p, x, y, z, yaw = 0) {
  p.sphere('sack', [x, y + 0.17, z], 0.32, { rings: 6, seg: 8, squash: 0.55 });
  obox(p, 'rope', [x + Math.cos(yaw) * 0.3, y + 0.2, z - Math.sin(yaw) * 0.3], [0.08, 0.14, 0.14], { ry: yaw });
}

// ---------------------------------------------------------------- props

/** Each is built in metres, standing on y = 0, facing +Z; prepare-props measures and centres it. */
const PROPS = {
  mv_well() {
    // A round stone well with a little tiled roof on two posts, a windlass, rope and bucket.
    const p = piece('mv_well');
    p.ring('stone', [0, 0, 0], 0.62, 0.95, 0, 0.85, { seg: 16 });
    p.ring('stoneDark', [0, 0, 0], 0.6, 1.0, 0.85, 0.1, { seg: 16 });
    p.cylinder('water', [0, 0, 0], 0.62, 0.0, 0.35, { seg: 16 });
    for (const x of [-0.85, 0.85]) p.box('oak', [x - 0.08, 0.6, -0.08], [x + 0.08, 2.3, 0.08]);
    p.cylinder('oak', [-0.85, 1.35, 0], 0.08, 0, 1.7, { seg: 8, axis: 'x' });
    obox(p, 'oak', [1.0, 1.35, 0.12], [0.05, 0.05, 0.3]);
    p.cylinder('rope', [0, 0.75, 0], 0.012, 0, 0.6, { seg: 4 });
    p.cylinder('plank', [0, 0.55, 0], 0.13, 0, 0.22, { seg: 10, r1: 0.16 });
    p.box('oak', [-1.05, 2.25, -0.06], [1.05, 2.35, 0.06]);
    roof(p, 'tile', -1.15, 1.15, 2.05, 0.75, 0.55);
    return p;
  },
  mv_awning() {
    // A market awning: striped cloth sloping down from a back rail to two front poles.
    const p = piece('mv_awning');
    for (const x of [-1.45, 1.45]) {
      p.cylinder('oak', [x, 0, 0.9], 0.04, 0, 2.2, { seg: 6 });
      p.cylinder('oak', [x, 0, -0.9], 0.04, 0, 2.7, { seg: 6 });
    }
    const a = Math.atan2(0.5, 1.8);
    for (let i = 0; i < 6; i++) obox(p, i % 2 ? 'cream' : 'red', [-1.25 + i * 0.5, 2.45, 0], [0.5, 0.03, 1.95], { rx: a });
    for (let i = 0; i < 6; i++) obox(p, i % 2 ? 'cream' : 'red', [-1.25 + i * 0.5, 2.05, 0.99], [0.5, 0.25, 0.02]);
    return p;
  },
  mv_pavilion() {
    // A round market pavilion: a striped cone roof and valance on a centre pole and six side poles, open below.
    const p = piece('mv_pavilion');
    p.cylinder('oak', [0, 0, 0], 0.06, 0, 3.6, { seg: 8 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      p.cylinder('oak', [Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7], 0.04, 0, 2.2, { seg: 6 });
    }
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2;
      const a1 = ((k + 1) / 12) * Math.PI * 2;
      const mat = k % 2 ? 'cream' : 'blue';
      const top = [0, 3.5, 0];
      const e0 = [Math.cos(a0) * 1.85, 2.2, Math.sin(a0) * 1.85];
      const e1 = [Math.cos(a1) * 1.85, 2.2, Math.sin(a1) * 1.85];
      const am = (a0 + a1) / 2;
      const n = [Math.cos(am) * 0.66, 0.75, Math.sin(am) * 0.66];
      p.tri(mat, top, e1, e0, n);
      p.tri(mat, top, e0, e1, n.map((v) => -v));
      const d0 = [e0[0], 1.85, e0[2]];
      const d1 = [e1[0], 1.85, e1[2]];
      p.quad(mat, d0, e0, e1, d1, [Math.cos(am), 0, Math.sin(am)]);
      p.quad(mat, d1, e1, e0, d0, [-Math.cos(am), 0, -Math.sin(am)]);
    }
    p.sphere('bronze', [0, 3.65, 0], 0.08, { rings: 4, seg: 6 });
    obox(p, 'red', [0, 3.95, 0.12], [0.02, 0.2, 0.3]);
    return p;
  },
  mv_tarp_tent() {
    // A tarpaulin tent: canvas over a ridge pole on two posts, guy ropes and pegs, open at both ends.
    const p = piece('mv_tarp_tent');
    for (const x of [-1.4, 1.4]) p.cylinder('oak', [x, 0, 0], 0.045, 0, 1.75, { seg: 6 });
    p.cylinder('oak', [-1.55, 1.75, 0], 0.04, 0, 3.1, { seg: 6, axis: 'x' });
    const a = Math.atan2(1.7, 1.2);
    for (const s of [1, -1]) obox(p, 'canvas', [0, 0.92, s * 0.62], [3.0, 0.03, Math.hypot(1.2, 1.7)], { rx: s * (Math.PI / 2 - a) });
    for (const x of [-1.55, 1.55]) {
      for (const s of [1, -1]) {
        obox(p, 'rope', [x * 1.1, 0.9, s * 0.4], [0.02, 1.95, 0.02], { rx: s * 0.45, rz: -Math.sign(x) * 0.35 });
        p.box('oakDark', [x * 1.3 - 0.03, 0, s * 0.8 - 0.03], [x * 1.3 + 0.03, 0.15, s * 0.8 + 0.03]);
      }
    }
    p.box('plank', [-0.6, 0, -0.5], [0.2, 0.1, 0.3]);
    return p;
  },
  mv_shop_sign() {
    // A hanging shop sign on an iron bracket (stood against a wall, the board hangs out over the street, +Z).
    const p = piece('mv_shop_sign');
    p.box('iron', [-0.04, 2.4, -0.05], [0.04, 2.48, 1.0]);
    obox(p, 'iron', [0, 2.15, 0.25], [0.03, 0.55, 0.03], { rx: 0.6 });
    p.box('iron', [-0.04, 0, -0.05], [0.04, 2.5, 0.05]);
    for (const z of [0.35, 0.9]) p.cylinder('iron', [0, 2.15, z], 0.01, 0, 0.26, { seg: 4 });
    p.box('oak', [-0.03, 1.45, 0.25], [0.03, 2.15, 1.0]);
    p.box('red', [-0.04, 1.55, 0.35], [0.04, 2.05, 0.9]);
    p.cylinder('bronze', [0, 1.8, 0.62], 0.13, -0.05, 0.05, { seg: 10, axis: 'x' });
    return p;
  },
  mv_hay_cart() {
    // A two-wheeled hay cart heaped with hay, its shafts on the ground.
    const p = piece('mv_hay_cart');
    p.box('plank', [-0.8, 0.7, -1.2], [0.8, 0.8, 1.2]);
    for (const x of [-0.8, 0.78]) p.box('plank', [x, 0.8, -1.2], [x + 0.02, 1.2, 1.2]);
    for (const z of [-1.2, 1.18]) p.box('plank', [-0.8, 0.8, z], [0.8, 1.2, z + 0.02]);
    p.cylinder('oakDark', [-1.0, 0.55, 0], 0.05, 0, 2.0, { seg: 6, axis: 'x' });
    wheel(p, -0.95, 0.55, 0, 0.55);
    wheel(p, 0.85, 0.55, 0, 0.55);
    for (const x of [-0.45, 0.45]) obox(p, 'oak', [x, 0.42, 2.0], [0.07, 0.07, 1.8], { rx: -0.3 });
    p.sphere('hay', [0, 1.25, 0], 0.95, { rings: 6, seg: 10, squash: 0.65 });
    p.sphere('hayDark', [0.25, 1.55, -0.4], 0.55, { rings: 5, seg: 8, squash: 0.6 });
    p.sphere('hay', [-0.3, 1.5, 0.5], 0.5, { rings: 5, seg: 8, squash: 0.6 });
    return p;
  },
  mv_forge() {
    // A blacksmith's hearth: a brick forge with a glowing bed of coals, a hood and chimney, bellows beside it.
    const p = piece('mv_forge');
    p.box('brick', [-0.8, 0, -0.6], [0.8, 0.85, 0.6]);
    p.box('stoneDark', [-0.85, 0.85, -0.65], [0.85, 0.95, 0.65]);
    p.box('coal', [-0.55, 0.95, -0.35], [0.55, 1.0, 0.35]);
    obox(p, 'fire', [0, 1.1, 0], [0.4, 0.2, 0.3]);
    p.cylinder('brick', [0, 1.6, -0.25], 0.75, 0, 0.7, { seg: 4, r1: 0.35 });
    p.box('brick', [-0.3, 2.3, -0.55], [0.3, 3.4, 0.05]);
    // Bellows on a stand to the right, a quench bucket to the left.
    p.box('oak', [0.95, 0, -0.25], [1.35, 0.7, 0.25]);
    obox(p, 'oakDark', [1.15, 0.85, 0], [0.45, 0.18, 0.7], { rx: 0.1 });
    p.cylinder('iron', [1.15, 0.85, -0.5], 0.04, 0, 0.3, { seg: 6, axis: 'z' });
    p.cylinder('plank', [-1.15, 0, 0], 0.22, 0, 0.5, { seg: 10, r1: 0.26 });
    p.cylinder('water', [-1.15, 0, 0], 0.22, 0.4, 0.45, { seg: 10 });
    return p;
  },
  mv_workbench() {
    // A carpenter's bench: a thick top on splayed legs, a vice, tools and offcuts.
    const p = piece('mv_workbench');
    p.box('plank', [-1.0, 0.8, -0.35], [1.0, 0.9, 0.35]);
    for (const x of [-0.85, 0.85]) for (const z of [-0.25, 0.25]) p.box('oak', [x - 0.05, 0, z - 0.05], [x + 0.05, 0.8, z + 0.05]);
    p.box('oak', [-0.9, 0.2, -0.05], [0.9, 0.28, 0.05]);
    p.box('oakDark', [-1.05, 0.65, 0.2], [-0.85, 0.9, 0.4]);
    p.box('iron', [-0.4, 0.9, -0.1], [-0.1, 0.93, 0.0]);
    p.box('oak', [-0.1, 0.91, -0.08], [0.15, 0.95, -0.02]);
    p.box('iron', [0.3, 0.9, 0.1], [0.75, 0.92, 0.16]);
    p.box('plank', [0.2, 0.9, -0.3], [0.9, 0.98, -0.18]);
    p.box('plank', [-0.6, 0, -0.3], [0.2, 0.1, 0.3]);
    return p;
  },
  mv_planter() {
    // A window box of flowers (or a planter by a door): a planked trough, leaves and red and yellow blooms.
    const p = piece('mv_planter');
    p.box('plank', [-0.6, 0, -0.18], [0.6, 0.3, 0.18]);
    p.box('oakDark', [-0.62, 0.28, -0.2], [0.62, 0.32, 0.2]);
    for (let i = 0; i < 7; i++) {
      const x = -0.5 + i * 0.165;
      p.sphere('leaf', [x, 0.38, (i % 2) * 0.08 - 0.04], 0.12, { rings: 4, seg: 6, squash: 0.8 });
      p.sphere(i % 3 ? 'flower' : 'flowerY', [x + 0.04, 0.5, (i % 2) * 0.06 - 0.02], 0.05, { rings: 3, seg: 5 });
    }
    return p;
  },
  mv_tarp_crates() {
    // Crates and a barrel under a lashed canvas tarpaulin.
    const p = piece('mv_tarp_crates');
    crate(p, -0.45, 0, 0, 0.8);
    crate(p, 0.45, 0, 0.05, 0.7);
    crate(p, -0.4, 0.8, 0, 0.6);
    p.cylinder('plank', [0.95, 0, -0.45], 0.3, 0, 0.9, { seg: 10 });
    obox(p, 'canvas', [-0.1, 1.42, 0], [1.4, 0.04, 1.0]);
    obox(p, 'canvas', [-0.1, 0.95, 0.5], [1.4, 0.95, 0.04], { rx: 0.08 });
    obox(p, 'canvas', [-0.1, 0.95, -0.5], [1.4, 0.95, 0.04], { rx: -0.08 });
    obox(p, 'canvas', [0.6, 0.95, 0], [0.04, 0.95, 1.0], { rz: -0.35 });
    for (const x of [-0.6, 0.3]) p.box('rope', [x - 0.02, 0.45, -0.53], [x + 0.02, 1.45, 0.53]);
    return p;
  },
  mv_chimney() {
    // A brick chimney stack with a stone cap and two clay pots (stand it on a roof).
    const p = piece('mv_chimney');
    p.box('brick', [-0.45, 0, -0.35], [0.45, 2.4, 0.35]);
    p.box('stone', [-0.52, 2.4, -0.42], [0.52, 2.55, 0.42]);
    for (const x of [-0.2, 0.2]) p.cylinder('tile', [x, 2.55, 0], 0.12, 0, 0.4, { seg: 8, r1: 0.1 });
    return p;
  },
  mv_wattle_fence() {
    // A 2.4 m panel of wattle: stakes with hazel rods woven between them.
    const p = piece('mv_wattle_fence');
    for (let i = 0; i < 7; i++) p.cylinder('oakDark', [-1.2 + i * 0.4, 0, 0], 0.035, 0, 1.25, { seg: 5 });
    for (let k = 0; k < 9; k++) {
      const y = 0.15 + k * 0.12;
      for (let i = 0; i < 6; i++) obox(p, k % 2 ? 'plank' : 'oak', [-1.0 + i * 0.4, y, (i + k) % 2 ? 0.035 : -0.035], [0.42, 0.06, 0.04]);
    }
    return p;
  },
  mv_spiked_fence() {
    // A 2.4 m run of sharpened stakes on two rails, leaning out (+Z).
    const p = piece('mv_spiked_fence');
    for (const y of [0.3, 0.9]) p.box('oakDark', [-1.2, y, -0.05], [1.2, y + 0.1, 0.05]);
    for (let i = 0; i < 9; i++) {
      const x = -1.1 + i * 0.275;
      const h = 1.35 + ((i * 7) % 3) * 0.1;
      p.cylinder('oak', [x, 0, 0.08], 0.055, 0, h, { seg: 6 });
      p.cylinder('plank', [x, h, 0.08], 0.055, 0, 0.3, { seg: 6, r1: 0 });
    }
    return p;
  },
  mv_bell() {
    // A bronze church bell hung from an oak yoke (hang it in the Bell Tower's frame).
    const p = piece('mv_bell');
    p.box('oak', [-0.6, 1.25, -0.1], [0.6, 1.45, 0.1]);
    p.cylinder('bronze', [0, 0.05, 0], 0.58, 0, 0.12, { seg: 18, r1: 0.52 });
    p.cylinder('bronze', [0, 0.12, 0], 0.52, 0, 0.75, { seg: 18, r1: 0.32 });
    p.cylinder('bronze', [0, 0.87, 0], 0.32, 0, 0.18, { seg: 18, r1: 0.16 });
    p.ring('bronze', [0, 1.05, 0], 0.04, 0.1, 0, 0.2, { seg: 8, axis: 'z' });
    p.sphere('iron', [0, 0.08, 0], 0.09, { rings: 4, seg: 6 });
    p.cylinder('iron', [0, 0.1, 0], 0.02, 0, 0.8, { seg: 4 });
    return p;
  },
  mv_market_cross() {
    // A stone market cross: three octagonal steps, a tall shaft and a small cross head.
    const p = piece('mv_market_cross');
    p.cylinder('stoneDark', [0, 0, 0], 1.5, 0, 0.3, { seg: 8 });
    p.cylinder('stone', [0, 0, 0], 1.1, 0.3, 0.6, { seg: 8 });
    p.cylinder('stoneDark', [0, 0, 0], 0.7, 0.6, 0.9, { seg: 8 });
    p.box('stone', [-0.3, 0.9, -0.3], [0.3, 1.4, 0.3]);
    p.cylinder('stone', [0, 1.4, 0], 0.16, 0, 3.0, { seg: 8, r1: 0.12 });
    p.box('stone', [-0.1, 4.3, -0.08], [0.1, 4.95, 0.08]);
    p.box('stone', [-0.35, 4.5, -0.07], [0.35, 4.66, 0.07]);
    return p;
  },
  mv_stocks() {
    // The stocks: two posts and a hinged board with holes for the ankles, a bench behind.
    const p = piece('mv_stocks');
    for (const x of [-0.9, 0.9]) p.box('oak', [x - 0.07, 0, -0.07], [x + 0.07, 0.95, 0.07]);
    p.box('plank', [-0.95, 0.35, -0.06], [0.95, 0.6, 0.06]);
    p.box('plank', [-0.95, 0.6, -0.06], [0.95, 0.85, 0.06]);
    for (const x of [-0.5, -0.15, 0.2, 0.55]) p.cylinder('oakDark', [x, 0.6, -0.07], 0.065, 0, 0.14, { seg: 8, axis: 'z' });
    p.box('iron', [-0.95, 0.83, -0.07], [0.95, 0.86, 0.07]);
    p.box('plank', [-0.8, 0.4, -0.75], [0.8, 0.46, -0.45]);
    for (const x of [-0.7, 0.7]) p.box('oak', [x - 0.04, 0, -0.64], [x + 0.04, 0.4, -0.56]);
    return p;
  },
  mv_timber_post() {
    // A free-standing oak post on a stone pad with knee braces and a beam stub at the top (a market hall or porch post).
    const p = piece('mv_timber_post');
    p.box('stone', [-0.3, 0, -0.3], [0.3, 0.3, 0.3]);
    p.box('oak', [-0.17, 0.3, -0.17], [0.17, 3.6, 0.17]);
    p.box('oak', [-0.9, 3.6, -0.15], [0.9, 3.9, 0.15]);
    for (const s of [-1, 1]) obox(p, 'oakDark', [s * 0.42, 3.3, 0], [0.12, 0.85, 0.12], { rz: -s * 0.75 });
    return p;
  },
  mv_sacks() {
    // A pile of grain sacks.
    const p = piece('mv_sacks');
    sack(p, -0.35, 0, -0.2, 0.2);
    sack(p, 0.35, 0, -0.15, -0.3);
    sack(p, 0, 0, 0.35, 1.4);
    sack(p, 0, 0.3, -0.05, 0.6);
    sack(p, 0.55, 0, 0.45, 1.0);
    return p;
  },
  mv_bay_window() {
    // An oriel (bay) window to hang on an upper storey: a three-sided glazed bay on a carved bracket, a little tiled roof.
    const p = piece('mv_bay_window');
    p.box('oak', [-0.9, 0, 0], [0.9, 0.15, 0.6]);
    obox(p, 'oakDark', [0, -0.3, 0.2], [0.2, 0.6, 0.12], { rx: 0.7 });
    p.box('plank', [-0.9, 0.15, 0], [0.9, 0.55, 0.6]);
    p.box('glass', [-0.6, 0.55, 0.55], [0.6, 1.55, 0.6]);
    for (const s of [-1, 1]) obox(p, 'glass', [s * 0.75, 1.05, 0.3], [0.05, 1.0, 0.6], { ry: s * 0.5 });
    for (const x of [-0.6, -0.2, 0.2, 0.6]) p.box('oak', [x - 0.04, 0.55, 0.56], [x + 0.04, 1.55, 0.62]);
    p.box('oak', [-0.9, 1.55, 0], [0.9, 1.65, 0.62]);
    obox(p, 'tile', [0, 1.85, 0.3], [1.9, 0.06, 0.75], { rx: 0.5 });
    return p;
  },
  mv_shutters() {
    // A window with its plank shutters swung open and a sill (stick it on a plain wall).
    const p = piece('mv_shutters');
    p.box('oakDark', [-0.6, 0, 0], [0.6, 0.1, 0.12]);
    p.box('oakDark', [-0.6, 1.3, 0], [0.6, 1.4, 0.08]);
    for (const s of [-1, 1]) p.box('oakDark', [s * 0.6 - 0.05, 0, 0], [s * 0.6 + 0.05, 1.4, 0.08]);
    p.box('glass', [-0.55, 0.1, 0.0], [0.55, 1.3, 0.02]);
    p.box('oak', [-0.03, 0.1, 0.0], [0.03, 1.3, 0.05]);
    p.box('oak', [-0.55, 0.68, 0.0], [0.55, 0.74, 0.05]);
    for (const [x0, x1] of [[-1.2, -0.65], [0.65, 1.2]]) {
      p.box('green', [x0, 0.05, 0.0], [x1, 1.35, 0.05]);
      for (const y of [0.3, 1.05]) p.box('iron', [x0, y, 0.05], [x1, y + 0.05, 0.07]);
    }
    return p;
  },
};

// ---------------------------------------------------------------- build

for (const [id, make] of Object.entries(PROPS)) {
  const doc = piecesDocument([make()], 'tiletrigger prepare-medieval');
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
}
console.log(`wrote ${Object.keys(PROPS).length} prop sources to assets-src/tiletrigger-medieval`);
