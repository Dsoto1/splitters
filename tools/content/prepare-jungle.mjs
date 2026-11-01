// MapMaker Style Pack 06 Jungle Ruins, refreshed from the owner's "Tileset 04
// Jungle Ruins" sheet with "Tileset 07 Ancient Temple" folded in: the new
// props we model ourselves, in code, from plain geometry
// (tools/content/pieces.mjs): a zipline post, a crane with its pulley, a
// wooden platform, temple guardian statues (large and small), an obelisk, a
// temple spire, fire bowl, hanging brazier and wall torch, teal and red temple
// banners, a tree-root arch, a mossy trunk, a plant cluster, a planter,
// pottery, a rubble pile, a collapsed and a broken column, a sarcophagus, a
// spike row, chain and rope rails, a temple altar and an overgrown beam. No
// pack and no generative AI service is involved: the code is the source. (The
// large statue, the crane and the zipline post are simple in-house versions;
// Meshy hero versions wait for the owner.) The pack's first seventeen props
// (jg_*) stay in tools/content/build-style-props.mjs, unchanged.
//
//   node tools/content/prepare-jungle.mjs
//
// Writes assets-src/tiletrigger-jungle/<id>.glb (licence "Owned", see the
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
const SRC = join(ROOT, 'assets-src/tiletrigger-jungle');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  stone: { color: hex('#9c9878'), rough: 0.95 },
  stoneLight: { color: hex('#b8b294'), rough: 0.9 },
  stoneDark: { color: hex('#6a6852'), rough: 0.95 },
  sand: { color: hex('#c8a878'), rough: 0.9 },
  sandDark: { color: hex('#9a7a50'), rough: 0.9 },
  moss: { color: hex('#4a6a22'), rough: 1 },
  mossDark: { color: hex('#34501a'), rough: 1 },
  vine: { color: hex('#2e5a1a'), rough: 0.9 },
  leaf: { color: hex('#3c7a24'), rough: 0.8 },
  leafDark: { color: hex('#24561a'), rough: 0.8 },
  leafLight: { color: hex('#5a9a30'), rough: 0.8 },
  flower: { color: hex('#e05a3a'), rough: 0.7 },
  bark: { color: hex('#5a4630'), rough: 1 },
  barkDark: { color: hex('#3e3020'), rough: 1 },
  plank: { color: hex('#7a6448'), rough: 0.9 },
  plankDark: { color: hex('#54442e'), rough: 0.9 },
  rope: { color: hex('#a8905c'), rough: 1 },
  iron: { color: hex('#2e2c2a'), metal: 0.6, rough: 0.5 },
  steel: { color: hex('#6a6c6e'), metal: 0.7, rough: 0.4 },
  gold: { color: hex('#d0a038'), metal: 0.85, rough: 0.3 },
  teal: { color: hex('#2a7a72'), rough: 0.6 },
  tealDark: { color: hex('#1c5650'), rough: 0.7 },
  red: { color: hex('#9a2a22'), rough: 0.85 },
  clay: { color: hex('#a8643a'), rough: 0.85 },
  clayDark: { color: hex('#7a4426'), rough: 0.85 },
  ink: { color: hex('#1a1612'), rough: 0.8 },
  jade: { color: hex('#3a9a78'), rough: 0.3 },
  fire: { color: hex('#ff8a30'), emissive: glow('#ff7a20') },
  ember: { color: hex('#ffd060'), emissive: glow('#ffc040') },
};
const piece = (name) => new Piece(name, MATS);

// ---------------------------------------------------------------- helpers

/** A box of size `size` (width x, height y, depth z) centred on `c`, turned by `yaw` about Y, then tilted: `pitch` about its own X (+Z end up), `roll` about its own Z. */
function obox(p, mat, c, size, { yaw = 0, pitch = 0, roll = 0 } = {}) {
  const [hx, hy, hz] = size.map((v) => v / 2);
  const rot = ([x, y, z]) => {
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

/** A beam from a to b, `t` thick (and `w` wide). */
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

/** A squashed sphere (moss, foliage, a head). */
const blob = (p, mat, c, r, squash = 1) => p.sphere(mat, c, r, { rings: 6, seg: 10, squash });

/** A flat leaf: a thin slab from the stem at `a` reaching out along yaw/pitch, `len` long, `w` wide. */
function leaf(p, mat, a, len, w, yaw, pitch) {
  const c = [a[0] + Math.sin(yaw) * Math.cos(pitch) * (len / 2), a[1] + Math.sin(pitch) * (len / 2), a[2] + Math.cos(yaw) * Math.cos(pitch) * (len / 2)];
  obox(p, mat, c, [w, 0.03, len], { yaw, pitch });
}

/** A sagging line (rope or chain) from a to b in `n` straight pieces, dipping `sag` in the middle. */
function sagLine(p, mat, a, b, sag, t, n = 8) {
  const at = (k) => {
    const f = k / n;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - sag * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f];
  };
  for (let k = 0; k < n; k++) beam(p, mat, at(k), at(k + 1), t);
}

/** A flame: a few cones over a bed of embers at (x, y, z). */
function flame(p, x, y, z, r = 0.2, h = 0.5) {
  p.sphere('ember', [x, y, z], r, { rings: 4, seg: 8, squash: 0.35 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.cylinder('fire', [x + Math.cos(a) * r * 0.45, y, z + Math.sin(a) * r * 0.45], r * 0.45, 0, h * (0.7 + (i % 2) * 0.35), { seg: 5, r1: 0 });
  }
}

/** A plain human figure in stone (a guardian): legs, a kilt, a torso, arms holding a staff, a headdress; `s` scales it, standing on y0. */
function figure(p, s, y0, mat, dark, { seated = false } = {}) {
  const S = (v) => v * s;
  if (seated) {
    // Seated on a block throne, hands on knees.
    p.box(dark, [S(-0.55), y0, S(-0.45)], [S(0.55), y0 + S(0.75), S(0.35)]);
    for (const x of [-0.22, 0.22]) {
      p.box(mat, [S(x - 0.14), y0 + S(0.75), S(0.0)], [S(x + 0.14), y0 + S(0.95), S(0.55)]);
      p.box(mat, [S(x - 0.12), y0, S(0.4)], [S(x + 0.12), y0 + S(0.8), S(0.62)]);
    }
    p.box(mat, [S(-0.36), y0 + S(0.75), S(-0.3)], [S(0.36), y0 + S(1.55), S(0.15)]);
    for (const x of [-0.45, 0.45]) {
      p.box(mat, [S(x - 0.1), y0 + S(1.0), S(-0.15)], [S(x + 0.1), y0 + S(1.5), S(0.08)]);
      p.box(mat, [S(x - 0.09), y0 + S(0.9), S(0.05)], [S(x + 0.09), y0 + S(1.05), S(0.5)]);
    }
  } else {
    for (const x of [-0.16, 0.16]) p.box(mat, [S(x - 0.11), y0, S(-0.12)], [S(x + 0.11), y0 + S(0.8), S(0.12)]);
    p.box(dark, [S(-0.34), y0 + S(0.7), S(-0.18)], [S(0.34), y0 + S(1.05), S(0.2)]);
    p.box(mat, [S(-0.32), y0 + S(1.05), S(-0.16)], [S(0.32), y0 + S(1.6), S(0.16)]);
    for (const x of [-0.42, 0.42]) p.box(mat, [S(x - 0.09), y0 + S(1.0), S(-0.1)], [S(x + 0.09), y0 + S(1.55), S(0.12)]);
    // A staff in the right hand.
    p.box(dark, [S(0.4), y0, S(0.12)], [S(0.48), y0 + S(2.0), S(0.2)]);
  }
  const hy = y0 + S(seated ? 1.55 : 1.6);
  p.box(mat, [S(-0.08), hy, S(-0.06)], [S(0.08), hy + S(0.08), S(0.08)]);
  p.box(mat, [S(-0.17), hy + S(0.08), S(-0.15)], [S(0.17), hy + S(0.42), S(0.17)]);
  // Headdress: a band, a crest and ear spools; the face's eyes and mouth cut in.
  p.box(dark, [S(-0.22), hy + S(0.36), S(-0.18)], [S(0.22), hy + S(0.48), S(0.2)]);
  p.box(dark, [S(-0.12), hy + S(0.48), S(-0.1)], [S(0.12), hy + S(0.72), S(0.06)]);
  for (const x of [-0.2, 0.2]) p.cylinder(dark, [S(x), hy + S(0.22), S(0)], S(0.06), S(-0.03), S(0.03), { seg: 8, axis: 'x' });
  for (const x of [-0.07, 0.07]) p.box('ink', [S(x - 0.035), hy + S(0.27), S(0.165)], [S(x + 0.035), hy + S(0.3), S(0.18)]);
  p.box('ink', [S(-0.06), hy + S(0.14), S(0.165)], [S(0.06), hy + S(0.16), S(0.18)]);
}

/** A temple banner: a crossbar on a pole, cloth `w` wide and `h` long hanging from `top`, a border and an emblem. */
function banner(p, cloth, trim, top, w, h, emblem) {
  p.cylinder('plankDark', [0, 0, -0.1], 0.05, 0, top + 0.25, { seg: 8 });
  p.cylinder('gold', [0, top + 0.25, -0.1], 0.07, 0, 0.12, { seg: 8 });
  p.box('plankDark', [-w / 2 - 0.1, top - 0.05, -0.05], [w / 2 + 0.1, top + 0.05, 0.05]);
  for (const x of [-w / 2 - 0.1, w / 2 + 0.1]) p.sphere('gold', [x, top, 0], 0.05, { rings: 4, seg: 6 });
  p.box(cloth, [-w / 2, top - h, 0.04], [w / 2, top - 0.05, 0.07]);
  // Border and a pointed foot.
  p.box(trim, [-w / 2, top - h, 0.07], [-w / 2 + 0.06, top - 0.05, 0.08]);
  p.box(trim, [w / 2 - 0.06, top - h, 0.07], [w / 2, top - 0.05, 0.08]);
  p.box(trim, [-w / 2, top - 0.2, 0.07], [w / 2, top - 0.14, 0.08]);
  p.tri(cloth, [-w / 2, top - h, 0.055], [w / 2, top - h, 0.055], [0, top - h - w * 0.4, 0.055], [0, 0, 1]);
  p.tri(cloth, [w / 2, top - h, 0.055], [-w / 2, top - h, 0.055], [0, top - h - w * 0.4, 0.055], [0, 0, -1]);
  emblem(top - 0.2 - (h - 0.2) * 0.42);
}

/** A square column of `h` on a plinth, banded every metre, a capital (a broken top if `broken`). */
function column(p, x, z, h, { broken = false } = {}) {
  p.box('stoneDark', [x - 0.5, 0, z - 0.5], [x + 0.5, 0.35, z + 0.5]);
  p.box('stone', [x - 0.36, 0.35, z - 0.36], [x + 0.36, h, z + 0.36]);
  for (let y = 1.1; y < h - 0.3; y += 1.0) p.box('stoneDark', [x - 0.39, y, z - 0.39], [x + 0.39, y + 0.14, z + 0.39]);
  if (broken) {
    // Jagged top: a few stubs at different heights.
    p.box('stone', [x - 0.36, h, z - 0.36], [x - 0.02, h + 0.35, z - 0.02]);
    p.box('stone', [x + 0.02, h, z - 0.2], [x + 0.36, h + 0.18, z + 0.36]);
  } else {
    p.box('stoneDark', [x - 0.48, h, z - 0.48], [x + 0.48, h + 0.3, z + 0.48]);
  }
}

// ---------------------------------------------------------------- props

/** Each is built in metres, standing on y = 0, facing +Z; prepare-props measures and centres it. */
const PROPS = {
  jt_zipline_post() {
    // A zipline post: two lashed timber posts in an A-frame, a crossbar with an iron pulley at the top, the cable
    // running off toward +Z (a stub: the line itself is the map's), a plank step and a stake-out guy rope behind.
    const p = piece('jt_zipline_post');
    for (const s of [-1, 1]) beam(p, 'bark', [s * 0.75, 0, 0], [s * 0.18, 6.0, 0], 0.22);
    p.box('barkDark', [-0.55, 5.2, -0.12], [0.55, 5.4, 0.12]);
    p.box('bark', [-0.6, 1.2, -0.1], [0.6, 1.35, 0.1]);
    for (const y of [1.25, 5.3]) for (const s of [-1, 1]) p.cylinder('rope', [s * (y < 2 ? 0.6 : 0.3), y - 0.12, 0], 0.14, 0, 0.24, { seg: 8 });
    p.cylinder('iron', [-0.08, 5.65, 0.1], 0.2, 0, 0.16, { seg: 12, axis: 'x' });
    p.cylinder('steel', [-0.1, 5.65, 0.1], 0.06, 0, 0.2, { seg: 8, axis: 'x' });
    beam(p, 'steel', [0, 5.85, 0.1], [0, 4.9, 2.6], 0.035);
    beam(p, 'rope', [0, 5.9, -0.05], [0, 0.05, -2.2], 0.04);
    p.box('stoneDark', [-0.2, 0, -2.35], [0.2, 0.25, -2.05]);
    p.box('plank', [-0.5, 0.0, 0.1], [0.5, 0.35, 0.6]);
    return p;
  },
  jt_crane() {
    // A timber jib crane: a post on a stone footing, a brace, a jib reaching out toward +Z with a pulley, rope, hook and a hanging crate.
    const p = piece('jt_crane');
    p.box('stoneDark', [-0.6, 0, -0.6], [0.6, 0.5, 0.6]);
    p.box('bark', [-0.18, 0.5, -0.18], [0.18, 4.6, 0.18]);
    beam(p, 'bark', [0, 4.4, -0.3], [0, 4.4, 3.2], 0.24, 0.2);
    beam(p, 'barkDark', [0, 2.6, 0.15], [0, 4.3, 1.9], 0.15);
    for (const y of [2.5, 4.35]) p.cylinder('rope', [0, y - 0.1, 0], 0.22, 0, 0.2, { seg: 8 });
    p.cylinder('iron', [-0.08, 4.25, 3.0], 0.16, 0, 0.16, { seg: 12, axis: 'x' });
    p.box('rope', [-0.02, 2.2, 2.98], [0.02, 4.2, 3.02]);
    beam(p, 'rope', [0, 4.25, 2.9], [0, 1.2, 0.2], 0.03);
    p.cylinder('iron', [0, 2.05, 3.0], 0.06, 0, 0.15, { seg: 6 });
    // The crate on the hook.
    p.box('plank', [-0.45, 1.05, 2.55], [0.45, 1.95, 3.45]);
    for (const y of [1.05, 1.88]) p.box('plankDark', [-0.47, y, 2.53], [0.47, y + 0.07, 3.47]);
    p.box('stone', [-0.3, 0, -1.3], [0.3, 0.45, -0.7]);
    return p;
  },
  jt_wooden_platform() {
    // A lashed timber platform 2 m up on four posts, cross braces, a plank deck and a ladder up the front.
    const p = piece('jt_wooden_platform');
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]]) {
      p.box('bark', [x - 0.12, 0, z - 0.12], [x + 0.12, 2.9, z + 0.12]);
      p.cylinder('rope', [x, 1.75, z], 0.15, 0, 0.18, { seg: 8 });
    }
    for (const s of [-1, 1]) {
      beam(p, 'barkDark', [-1.3, 0.3, s * 1.3], [1.3, 1.8, s * 1.3], 0.1);
      beam(p, 'barkDark', [s * 1.3, 0.3, -1.3], [s * 1.3, 1.8, 1.3], 0.1);
    }
    for (let i = 0; i < 8; i++) p.box(i % 2 ? 'plank' : 'plankDark', [-1.5, 1.85, -1.5 + i * 0.375], [1.5, 2.0, -1.5 + (i + 1) * 0.375 - 0.02]);
    for (const s of [-1, 1]) {
      p.box('bark', [-1.45, 2.8, s * 1.4 - 0.05], [1.45, 2.88, s * 1.4 + 0.05]);
      p.box('bark', [s * 1.4 - 0.05, 2.8, -1.45], [s * 1.4 + 0.05, 2.88, 1.45]);
    }
    // Ladder.
    for (const x of [-0.3, 0.3]) beam(p, 'bark', [x, 0, 2.1], [x, 2.0, 1.55], 0.07);
    for (let k = 1; k < 7; k++) {
      const f = k / 7;
      p.box('plankDark', [-0.3, 2.0 * f - 0.03, 2.1 - 0.55 * f - 0.03], [0.3, 2.0 * f + 0.03, 2.1 - 0.55 * f + 0.03]);
    }
    return p;
  },
  jt_statue_large() {
    // A seated temple guardian on a stepped plinth, moss on its shoulders (a stand-in for a Meshy hero piece).
    const p = piece('jt_statue_large');
    p.box('stoneDark', [-1.4, 0, -1.2], [1.4, 0.4, 1.4]);
    p.box('stone', [-1.2, 0.4, -1.0], [1.2, 0.9, 1.2]);
    p.box('gold', [-1.21, 0.6, 1.2], [1.21, 0.7, 1.22]);
    figure(p, 2.4, 0.9, 'stoneLight', 'stone', { seated: true });
    for (const [x, y, z, r] of [[-0.9, 4.6, -0.2, 0.25], [0.8, 4.5, 0.1, 0.22], [-1.1, 1.0, 1.0, 0.3], [0.9, 0.95, -0.9, 0.28]]) blob(p, 'moss', [x, y, z], r, 0.5);
    return p;
  },
  jt_statue_small() {
    // A standing guardian with a staff on a plinth.
    const p = piece('jt_statue_small');
    p.box('stoneDark', [-0.55, 0, -0.5], [0.55, 0.45, 0.5]);
    p.box('gold', [-0.56, 0.3, 0.5], [0.56, 0.36, 0.51]);
    figure(p, 1.0, 0.45, 'stoneLight', 'stone');
    blob(p, 'moss', [-0.4, 0.5, 0.35], 0.18, 0.5);
    return p;
  },
  jt_obelisk() {
    // A tapering stone obelisk on a stepped base, carved bands, a gold pyramidion.
    const p = piece('jt_obelisk');
    p.box('stoneDark', [-0.8, 0, -0.8], [0.8, 0.3, 0.8]);
    p.box('stone', [-0.6, 0.3, -0.6], [0.6, 0.6, 0.6]);
    const H = 4.6;
    for (let i = 0; i < 8; i++) {
      const y0 = 0.6 + (i * (H - 0.6)) / 8;
      const y1 = 0.6 + ((i + 1) * (H - 0.6)) / 8;
      const r = 0.42 - i * 0.025;
      p.box(i % 3 === 1 ? 'stoneDark' : 'stoneLight', [-r, y0, -r], [r, y1, r]);
    }
    p.cylinder('gold', [0, H, 0], 0.24, 0, 0.45, { seg: 4, r1: 0 });
    for (const y of [1.4, 2.6]) p.box('ink', [-0.12, y, 0.38], [0.12, y + 0.4, 0.41]);
    blob(p, 'moss', [0.5, 0.35, 0.5], 0.25, 0.5);
    return p;
  },
  jt_temple_spire() {
    // A stepped temple spire: courses narrowing up to a gilded finial, a niche in front.
    const p = piece('jt_temple_spire');
    for (let i = 0; i < 6; i++) {
      const r = 1.0 - i * 0.14;
      p.box(i % 2 ? 'stone' : 'stoneLight', [-r, i * 0.55, -r], [r, (i + 1) * 0.55, r]);
    }
    p.box('ink', [-0.25, 0.55, 0.86], [0.25, 1.35, 0.88]);
    p.cylinder('gold', [0, 3.3, 0], 0.12, 0, 0.7, { seg: 8, r1: 0.02 });
    p.sphere('gold', [0, 3.35, 0], 0.16, { rings: 4, seg: 8 });
    blob(p, 'moss', [0.7, 0.6, 0.6], 0.25, 0.5);
    return p;
  },
  jt_fire_bowl() {
    // A gilded fire bowl on three bronze legs, burning.
    const p = piece('jt_fire_bowl');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      beam(p, 'gold', [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], [Math.cos(a) * 0.2, 1.05, Math.sin(a) * 0.2], 0.06);
    }
    p.cylinder('gold', [0, 0.95, 0], 0.18, 0, 0.3, { seg: 12, r1: 0.5 });
    p.ring('teal', [0, 1.22, 0], 0.46, 0.52, 0, 0.06, { seg: 16 });
    flame(p, 0, 1.25, 0, 0.32, 0.6);
    return p;
  },
  jt_hanging_brazier() {
    // A brazier on three chains from a ring (hang it from a beam: lift it in MapMaker), burning.
    const p = piece('jt_hanging_brazier');
    p.ring('iron', [0, 2.9, 0], 0.06, 0.1, 0, 0.04, { seg: 10 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      beam(p, 'iron', [0, 2.9, 0], [Math.cos(a) * 0.38, 0.6, Math.sin(a) * 0.38], 0.025);
    }
    p.cylinder('iron', [0, 0.3, 0], 0.12, 0, 0.3, { seg: 12, r1: 0.42 });
    p.ring('gold', [0, 0.57, 0], 0.4, 0.44, 0, 0.04, { seg: 16 });
    p.cylinder('iron', [0, 0.0, 0], 0.03, 0, 0.3, { seg: 6 });
    flame(p, 0, 0.6, 0, 0.26, 0.5);
    return p;
  },
  jt_wall_torch() {
    // A wall torch: an iron bracket fixed to the wall (the back is at z = 0), the torch burning in it.
    const p = piece('jt_wall_torch');
    p.box('iron', [-0.08, 0.0, 0.0], [0.08, 0.35, 0.04]);
    beam(p, 'iron', [0, 0.12, 0.02], [0, 0.32, 0.25], 0.03);
    p.ring('iron', [0, 0.42, 0.27], 0.05, 0.08, 0, 0.05, { seg: 8 });
    beam(p, 'plankDark', [0, 0.2, 0.2], [0, 0.62, 0.3], 0.06);
    p.cylinder('rope', [0, 0.56, 0.29], 0.06, 0, 0.1, { seg: 6 });
    flame(p, 0, 0.66, 0.3, 0.09, 0.28);
    return p;
  },
  jt_banner_teal() {
    // A teal temple banner with a gold border and a gold sun.
    const p = piece('jt_banner_teal');
    banner(p, 'teal', 'gold', 3.4, 1.0, 2.2, (y) => {
      p.cylinder('gold', [0, y, 0.075], 0.2, 0, 0.012, { seg: 12, axis: 'z' });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        obox(p, 'gold', [Math.cos(a) * 0.3, y + Math.sin(a) * 0.3, 0.08], [0.06, 0.14, 0.01], { roll: a + Math.PI / 2 });
      }
      p.box('gold', [-0.3, y - 0.65, 0.075], [0.3, y - 0.6, 0.085]);
    });
    return p;
  },
  jt_banner_red() {
    // A red temple banner with a gold border and a gold serpent emblem.
    const p = piece('jt_banner_red');
    banner(p, 'red', 'gold', 3.4, 1.0, 2.2, (y) => {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 1.6;
        const r = 0.08 + i * 0.03;
        obox(p, 'gold', [Math.cos(a) * r, y + Math.sin(a) * r, 0.08], [0.09, 0.09, 0.01]);
      }
      p.box('gold', [-0.05, y - 0.55, 0.075], [0.05, y - 0.25, 0.085]);
      p.box('gold', [-0.2, y - 0.45, 0.075], [0.2, y - 0.4, 0.085]);
    });
    return p;
  },
  jt_tree_root_arch() {
    // Great roots arching over a way through (4 m wide, 3.5 m high: walk under it), moss and ferns at their feet.
    const p = piece('jt_tree_root_arch');
    for (const [dz, r, w] of [[0, 3.4, 0.6], [-0.45, 3.0, 0.42], [0.5, 3.1, 0.38]]) {
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * Math.PI;
        const a1 = ((i + 1) / 12) * Math.PI;
        const R = 2.4;
        beam(p, i % 3 ? 'bark' : 'barkDark', [-Math.cos(a0) * R, Math.sin(a0) * r, dz + Math.sin(a0 * 3) * 0.15], [-Math.cos(a1) * R, Math.sin(a1) * r, dz + Math.sin(a1 * 3) * 0.15], w * (1 - Math.sin(a0) * 0.35), w);
      }
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) beam(p, 'bark', [s * 2.4, 0.3, (k - 1) * 0.4], [s * (3.0 + k * 0.2), 0.05, (k - 1) * 0.9], 0.25);
      blob(p, 'moss', [s * 2.5, 0.3, 0], 0.5, 0.5);
      for (let i = 0; i < 6; i++) leaf(p, i % 2 ? 'leaf' : 'leafDark', [s * 2.6, 0.1, 0], 1.0, 0.3, (i / 6) * Math.PI * 2, 0.5);
    }
    for (const x of [-1.2, 0.3, 1.4]) for (let k = 0; k < 4; k++) p.box('vine', [x + k * 0.12 - 0.02, 3.0 - k * 0.5 - 0.8, -0.03], [x + k * 0.12 + 0.02, 3.2 - k * 0.2, 0.03]);
    return p;
  },
  jt_tree_trunk() {
    // A great mossy trunk snapped off 6 m up, buttress roots flaring at its foot, a liana hanging from the break.
    const p = piece('jt_tree_trunk');
    p.cylinder('bark', [0, 0, 0], 0.75, 0, 6.0, { seg: 12, r1: 0.6 });
    p.cylinder('barkDark', [0, 6.0, 0], 0.6, 0, 0.35, { seg: 7, r1: 0.25 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      obox(p, 'bark', [Math.cos(a) * 1.0, 0.55, Math.sin(a) * 1.0], [0.25, 1.1, 1.1], { yaw: -a + Math.PI / 2, pitch: 0 });
    }
    for (const [y, a] of [[1.4, 0.3], [2.6, 2.4], [3.9, 4.1], [5.2, 1.1]]) blob(p, 'moss', [Math.cos(a) * 0.7, y, Math.sin(a) * 0.7], 0.35, 0.6);
    let prev = [0.5, 6.0, 0.3];
    for (let i = 1; i < 8; i++) {
      const next = [0.5 + Math.sin(i) * 0.2, 6.0 - i * 0.6, 0.6 + Math.cos(i * 0.8) * 0.15];
      beam(p, 'vine', prev, next, 0.05);
      if (i % 2) leaf(p, 'leaf', next, 0.25, 0.14, i, -0.3);
      prev = next;
    }
    return p;
  },
  jt_plant_cluster() {
    // A cluster of jungle plants: fern fronds, broad leaves and red flowers (walk through it).
    const p = piece('jt_plant_cluster');
    const rnd = rng(7);
    for (let i = 0; i < 9; i++) leaf(p, i % 2 ? 'leaf' : 'leafDark', [-0.3, 0.05, -0.2], 1.1, 0.25, (i / 9) * Math.PI * 2, 0.5 - (i % 3) * 0.15);
    for (let i = 0; i < 6; i++) {
      const yaw = (i / 6) * Math.PI * 2 + 0.4;
      const top = [0.4 + Math.sin(yaw) * 0.35, 0.8 + (i % 3) * 0.2, 0.3 + Math.cos(yaw) * 0.35];
      beam(p, 'leafDark', [0.4, 0, 0.3], top, 0.03);
      leaf(p, 'leafLight', top, 0.7, 0.4, yaw, 0.1 - rnd() * 0.3);
    }
    for (let i = 0; i < 5; i++) p.sphere('flower', [-0.2 + rnd() * 0.8, 0.5 + rnd() * 0.5, -0.1 + rnd() * 0.6], 0.07, { rings: 4, seg: 6 });
    return p;
  },
  jt_planter() {
    // A square carved stone planter with a young palm and ferns.
    const p = piece('jt_planter');
    p.box('stoneDark', [-0.6, 0, -0.6], [0.6, 0.15, 0.6]);
    p.box('stone', [-0.55, 0.15, -0.55], [0.55, 0.75, 0.55]);
    p.box('gold', [-0.56, 0.55, -0.56], [0.56, 0.6, 0.56]);
    p.box('barkDark', [-0.5, 0.7, -0.5], [0.5, 0.74, 0.5]);
    p.cylinder('bark', [0, 0.74, 0], 0.07, 0, 1.4, { seg: 6, r1: 0.05 });
    for (let i = 0; i < 7; i++) leaf(p, i % 2 ? 'leaf' : 'leafLight', [0, 2.1, 0], 1.0, 0.22, (i / 7) * Math.PI * 2, -0.25);
    for (let i = 0; i < 6; i++) leaf(p, 'leafDark', [0, 0.75, 0], 0.55, 0.16, (i / 6) * Math.PI * 2 + 0.3, 0.6);
    return p;
  },
  jt_pottery() {
    // Three clay pots: a tall amphora painted with a teal band, a round jar, a small bowl.
    const p = piece('jt_pottery');
    p.cylinder('clay', [0, 0, 0], 0.12, 0, 0.15, { seg: 12, r1: 0.25 });
    p.cylinder('clay', [0, 0.15, 0], 0.25, 0, 0.45, { seg: 12, r1: 0.28 });
    p.cylinder('teal', [0, 0.6, 0], 0.285, 0, 0.12, { seg: 12, r1: 0.25 });
    p.cylinder('clay', [0, 0.72, 0], 0.25, 0, 0.2, { seg: 12, r1: 0.12 });
    p.cylinder('clayDark', [0, 0.92, 0], 0.12, 0, 0.12, { seg: 12, r1: 0.14 });
    p.sphere('clay', [0.5, 0.25, 0.15], 0.26, { rings: 6, seg: 12, squash: 0.95 });
    p.cylinder('clayDark', [0.5, 0.45, 0.15], 0.12, 0, 0.08, { seg: 10 });
    p.ring('teal', [0.5, 0.2, 0.15], 0.26, 0.27, 0, 0.06, { seg: 12 });
    p.cylinder('clayDark', [-0.4, 0, 0.3], 0.1, 0, 0.14, { seg: 10, r1: 0.2 });
    return p;
  },
  jt_rubble_pile() {
    // A heap of broken masonry: blocks and chips, a carved fragment, moss.
    const p = piece('jt_rubble_pile');
    const rnd = rng(13);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 1.0;
      const s = 0.25 + rnd() * 0.35;
      const y = Math.max(0, 0.55 - r * 0.45) * rnd();
      obox(p, i % 3 ? 'stone' : 'stoneDark', [Math.cos(a) * r, y + s / 2, Math.sin(a) * r], [s * 1.3, s, s], { yaw: rnd() * 3, roll: (rnd() - 0.5) * 0.4 });
    }
    obox(p, 'stoneLight', [0.1, 0.5, 0.1], [0.8, 0.35, 0.5], { yaw: 0.4, roll: 0.15 });
    blob(p, 'moss', [-0.4, 0.35, 0.3], 0.3, 0.5);
    return p;
  },
  jt_collapsed_column() {
    // A column fallen in pieces: three drums lying in a row, the capital tipped over, chips.
    const p = piece('jt_collapsed_column');
    for (const [x, yaw] of [[-1.6, 0.05], [-0.55, -0.08], [0.55, 0.12]]) obox(p, 'stone', [x, 0.36, 0], [1.0, 0.72, 0.72], { yaw });
    obox(p, 'stoneDark', [1.6, 0.25, 0.1], [0.96, 0.5, 0.96], { yaw: 0.5, roll: 0.25 });
    for (const x of [-1.1, 0]) obox(p, 'stoneDark', [x, 0.36, 0], [0.1, 0.76, 0.76]);
    obox(p, 'stone', [0.9, 0.12, 0.8], [0.35, 0.24, 0.3], { yaw: 1 });
    blob(p, 'moss', [-1.4, 0.7, 0.1], 0.25, 0.5);
    return p;
  },
  jt_broken_column() {
    // A standing column snapped 2.6 m up, banded, on its plinth; moss and a vine.
    const p = piece('jt_broken_column');
    column(p, 0, 0, 2.6, { broken: true });
    blob(p, 'moss', [0.3, 0.4, 0.35], 0.25, 0.6);
    for (let k = 0; k < 5; k++) p.box('vine', [-0.4, 2.6 - k * 0.45 - 0.45, 0.37], [-0.36, 2.6 - k * 0.45, 0.39]);
    return p;
  },
  jt_sarcophagus() {
    // A stone sarcophagus on a low base, its lid carved with a figure and inlaid with gold and teal.
    const p = piece('jt_sarcophagus');
    p.box('stoneDark', [-1.25, 0, -0.6], [1.25, 0.2, 0.6]);
    p.box('stone', [-1.1, 0.2, -0.5], [1.1, 0.95, 0.5]);
    for (const x of [-0.7, 0, 0.7]) p.box('stoneLight', [x - 0.25, 0.35, 0.5], [x + 0.25, 0.8, 0.52]);
    p.box('stoneLight', [-1.18, 0.95, -0.56], [1.18, 1.12, 0.56]);
    p.box('stoneLight', [-0.95, 1.12, -0.32], [0.95, 1.22, 0.32]);
    p.box('teal', [-0.6, 1.22, -0.18], [0.6, 1.24, 0.18]);
    p.box('gold', [-0.9, 1.22, -0.05], [-0.65, 1.3, 0.05]);
    p.box('gold', [0.65, 1.22, -0.12], [0.9, 1.32, 0.12]);
    blob(p, 'moss', [1.0, 0.25, 0.45], 0.2, 0.5);
    return p;
  },
  jt_spikes() {
    // A row of iron spikes on a timber beam (2 m), a barrier you don't run into.
    const p = piece('jt_spikes');
    p.box('plankDark', [-1.0, 0, -0.15], [1.0, 0.25, 0.15]);
    for (let i = 0; i < 9; i++) {
      const x = -0.9 + i * 0.225;
      p.cylinder('iron', [x, 0.25, 0], 0.04, 0, 0.75 + (i % 2) * 0.2, { seg: 6, r1: 0.005 });
    }
    for (const x of [-0.7, 0.7]) obox(p, 'plankDark', [x, 0.35, -0.3], [0.1, 0.7, 0.1], { pitch: 0.8 });
    return p;
  },
  jt_chain_rail() {
    // A chain rail: two carved stone posts with gold caps and a sagging iron chain between (2.4 m).
    const p = piece('jt_chain_rail');
    for (const x of [-1.2, 1.2]) {
      p.box('stone', [x - 0.15, 0, -0.15], [x + 0.15, 1.0, 0.15]);
      p.box('gold', [x - 0.18, 1.0, -0.18], [x + 0.18, 1.08, 0.18]);
    }
    for (const y of [0.9, 0.5]) {
      const n = 12;
      for (let k = 0; k < n; k++) {
        const f0 = k / n;
        const f1 = (k + 1) / n;
        const at = (f) => [-1.05 + 2.1 * f, y - 0.25 * 4 * f * (1 - f), 0];
        beam(p, 'iron', at(f0), at(f1), 0.04, k % 2 ? 0.07 : 0.03);
      }
    }
    return p;
  },
  jt_rope_rail() {
    // A rope rail: two lashed timber posts, two sagging ropes (2.4 m).
    const p = piece('jt_rope_rail');
    for (const x of [-1.2, 1.2]) {
      p.cylinder('bark', [x, 0, 0], 0.09, 0, 1.15, { seg: 7, r1: 0.075 });
      for (const y of [0.55, 0.95]) p.cylinder('rope', [x, y - 0.05, 0], 0.11, 0, 0.1, { seg: 7 });
    }
    for (const y of [0.95, 0.55]) sagLine(p, 'rope', [-1.15, y, 0], [1.15, y, 0], 0.18, 0.035);
    return p;
  },
  jt_altar_fire() {
    // A temple altar: a stepped carved block inlaid in teal and gold, a gold bowl burning on top, offerings.
    const p = piece('jt_altar_fire');
    p.box('stoneDark', [-1.2, 0, -0.9], [1.2, 0.25, 0.9]);
    p.box('stone', [-1.0, 0.25, -0.7], [1.0, 1.05, 0.7]);
    p.box('teal', [-0.8, 0.45, 0.7], [0.8, 0.85, 0.72]);
    p.box('gold', [-0.82, 0.43, 0.72], [0.82, 0.47, 0.73]);
    p.box('gold', [-0.82, 0.83, 0.72], [0.82, 0.87, 0.73]);
    for (const x of [-0.5, 0, 0.5]) p.box('gold', [x - 0.08, 0.57, 0.72], [x + 0.08, 0.73, 0.735]);
    p.box('stoneLight', [-1.08, 1.05, -0.78], [1.08, 1.18, 0.78]);
    p.cylinder('gold', [0, 1.18, 0], 0.22, 0, 0.18, { seg: 12, r1: 0.36 });
    flame(p, 0, 1.36, 0, 0.24, 0.45);
    p.sphere('jade', [-0.7, 1.26, 0.3], 0.08, { rings: 4, seg: 6 });
    p.cylinder('clay', [0.7, 1.18, -0.3], 0.1, 0, 0.18, { seg: 8, r1: 0.06 });
    return p;
  },
  jt_overgrown_beam() {
    // An overgrown beam: a mossy timber lintel on two stone corbels (4 m), vines hanging from it (lift it onto walls or columns).
    const p = piece('jt_overgrown_beam');
    for (const x of [-1.8, 1.8]) p.box('stone', [x - 0.3, 0, -0.3], [x + 0.3, 0.45, 0.3]);
    p.box('bark', [-2.1, 0.45, -0.25], [2.1, 0.85, 0.25]);
    for (const [x, r] of [[-1.2, 0.3], [0.2, 0.35], [1.5, 0.25]]) blob(p, 'moss', [x, 0.85, 0], r, 0.45);
    const rnd = rng(19);
    for (let i = 0; i < 10; i++) {
      const x = -1.8 + i * 0.4;
      const len = 0.8 + rnd() * 1.6;
      p.box('vine', [x - 0.025, 0.45 - len, 0.2], [x + 0.025, 0.5, 0.25]);
      for (let y = 0.4 - len + 0.2; y < 0.4; y += 0.4) leaf(p, rnd() < 0.5 ? 'leaf' : 'leafDark', [x, y, 0.23], 0.2, 0.12, rnd() * 6, -0.4);
    }
    return p;
  },
};

// ---------------------------------------------------------------- build

for (const [id, make] of Object.entries(PROPS)) {
  const doc = piecesDocument([make()], 'tiletrigger prepare-jungle');
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
}
console.log(`wrote ${Object.keys(PROPS).length} prop sources to assets-src/tiletrigger-jungle`);
