// MapMaker Style Pack 12 Snow Outpost (the owner's "Tileset 05" sheet): the
// props we model ourselves, in code, from plain geometry
// (tools/content/pieces.mjs): a satellite dish, an antenna mast, a diesel
// heater and a generator, a snowmobile, crates under a snowy tarp, a lamp
// post, a flagpole, chain-link and slatted snow fences, an insulated pipe
// run, oil drums capped with snow, a radio console, a ski rack, a supply sled
// and a snow pile. No pack and no generative AI service is involved: the code
// is the source. (The snowmobile, satellite dish and generator are simple
// in-house stand-ins; Meshy or community hero versions wait for the owner.)
//
//   node tools/content/prepare-snow.mjs
//
// Writes assets-src/tiletrigger-snow/<id>.glb (licence "Owned", see the
// License.txt there); `ONLY=<ids> node tools/content/prepare-props.mjs` then
// normalises them into packages/client/public/props like every other prop, and
// `pnpm content:build` records them in the provenance ledger.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { Piece, piecesDocument } from './pieces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'assets-src/tiletrigger-snow');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  snow: { color: hex('#f2f6fa'), rough: 0.95 },
  snowShade: { color: hex('#d4dee8'), rough: 0.95 },
  steel: { color: hex('#8a9298'), metal: 0.6, rough: 0.45 },
  steelDark: { color: hex('#4a5056'), metal: 0.6, rough: 0.5 },
  white: { color: hex('#e8ecee'), metal: 0.2, rough: 0.5 },
  red: { color: hex('#b8382a'), metal: 0.2, rough: 0.55 },
  orange: { color: hex('#e86a1a'), metal: 0.1, rough: 0.5 },
  yellow: { color: hex('#e8b520'), metal: 0.1, rough: 0.5 },
  olive: { color: hex('#4e5a3a'), metal: 0.2, rough: 0.7 },
  black: { color: hex('#22262a'), rough: 0.7 },
  rubber: { color: hex('#1a1c1e'), rough: 0.9 },
  wood: { color: hex('#8a6a46'), rough: 0.85 },
  woodDark: { color: hex('#5a4430'), rough: 0.85 },
  tarp: { color: hex('#3e5a4a'), rough: 0.9 },
  blue: { color: hex('#2a5a9a'), rough: 0.6 },
  glass: { color: hex('#7a98a8'), metal: 0.2, rough: 0.15 },
  screen: { color: hex('#123a2a'), emissive: glow('#3aff9a', 0.6) },
  lamp: { color: hex('#ffd890'), emissive: glow('#ffc060') },
  heat: { color: hex('#ff6a1a'), emissive: glow('#ff6a1a', 0.9) },
  beacon: { color: hex('#ff3020'), emissive: glow('#ff3020') },
  rope: { color: hex('#c8c0a0'), rough: 0.9 },
};
const piece = (name) => new Piece(name, MATS);

/** Turn [x, y, z] by rx about x, then rz about z, then ry about y (radians). */
function rotate([x, y, z], { rx = 0, ry = 0, rz = 0 }) {
  let [a, b, d] = [x, y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [a, b] = [a * Math.cos(rz) - b * Math.sin(rz), a * Math.sin(rz) + b * Math.cos(rz)];
  [a, d] = [a * Math.cos(ry) + d * Math.sin(ry), -a * Math.sin(ry) + d * Math.cos(ry)];
  return [a, b, d];
}

/** A box of `size` centred on `c`, turned by `r` (see rotate): braces, tilted panels, the dish arm. */
function obox(p, mat, c, size, r = {}) {
  const [hx, hy, hz] = size.map((v) => v / 2);
  const v = (x, y, z) => {
    const [a, b, d] = rotate([x, y, z], r);
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
  for (const [a, b, cc, d, n] of faces) p.quad(mat, v(...a), v(...b), v(...cc), v(...d), rotate(n, r));
}

/** A shallow dish (a paraboloid in `rings` bands) of radius `r` and depth `depth`, its axis local +Y turned by `rot`, centred on `c`: both faces. */
function dish(p, mat, back, c, r, depth, rot, { rings = 4, seg = 16 } = {}) {
  const pt = (k, j) => {
    const rr = (k / rings) * r;
    const a = (j / seg) * Math.PI * 2;
    const [x, y, z] = rotate([Math.cos(a) * rr, depth * (rr / r) ** 2, Math.sin(a) * rr], rot);
    return [x + c[0], y + c[1], z + c[2]];
  };
  const up = rotate([0, 1, 0], rot);
  const down = up.map((v) => -v);
  for (let k = 0; k < rings; k++) {
    for (let j = 0; j < seg; j++) {
      const [a, b, cc, d] = [pt(k, j), pt(k + 1, j), pt(k + 1, j + 1), pt(k, j + 1)];
      p.quad(mat, a, d, cc, b, up);
      p.quad(back, a, b, cc, d, down);
    }
  }
}

/** An oil drum at (x, y, z), its lid capped with snow. */
function drum(p, x, y, z, mat = 'blue') {
  p.cylinder(mat, [x, y, z], 0.29, 0, 0.88, { seg: 12 });
  for (const h of [0.28, 0.6]) p.ring('steelDark', [x, y, z], 0.29, 0.305, h, 0.03, { seg: 12 });
  p.cylinder('snow', [x, y + 0.88, z], 0.27, 0, 0.06, { seg: 12, r1: 0.2 });
}

/** A crate of side `s` standing on y at (x, z): olive planks, a dark frame. */
function crate(p, x, y, z, s, mat = 'olive') {
  p.box(mat, [x - s / 2, y, z - s / 2], [x + s / 2, y + s, z + s / 2]);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) p.box('steelDark', [x + (dx * s) / 2 - 0.04, y, z + (dz * s) / 2 - 0.04], [x + (dx * s) / 2 + 0.04, y + s, z + (dz * s) / 2 + 0.04]);
}

// ---------------------------------------------------------------- props

/** Each is built in metres, standing on y = 0, facing +Z; prepare-props measures and centres it. */
const PROPS = {
  so_satellite_dish() {
    // A ground station dish: a concrete pad, a steel pedestal and yoke, a 3 m dish tilted to the sky, its feed on struts.
    const p = piece('so_satellite_dish');
    p.box('snowShade', [-1.1, 0, -1.1], [1.1, 0.3, 1.1]);
    p.cylinder('steel', [0, 0.3, 0], 0.32, 0, 1.6, { seg: 10, r1: 0.22 });
    p.box('steelDark', [-0.7, 1.8, -0.18], [0.7, 2.0, 0.18]);
    for (const x of [-0.65, 0.65]) p.box('steel', [x - 0.08, 1.9, -0.12], [x + 0.08, 2.5, 0.12]);
    const rot = { rx: -0.75 };
    dish(p, 'white', 'steel', [0, 2.45, 0.1], 1.5, 0.35, rot);
    const feed = rotate([0, 1.25, 0], rot);
    p.sphere('steelDark', [feed[0], 2.45 + feed[1], 0.1 + feed[2]], 0.12, { rings: 4, seg: 6 });
    for (const a of [0, 2.1, 4.2]) {
      const rim = rotate([Math.cos(a) * 1.2, 0.25, Math.sin(a) * 1.2], rot);
      const m = [(rim[0] + feed[0]) / 2, 2.45 + (rim[1] + feed[1]) / 2, 0.1 + (rim[2] + feed[2]) / 2];
      const len = Math.hypot(rim[0] - feed[0], rim[1] - feed[1], rim[2] - feed[2]);
      const ry = Math.atan2(feed[0] - rim[0], feed[2] - rim[2]);
      const rx = -Math.atan2(feed[1] - rim[1], Math.hypot(feed[0] - rim[0], feed[2] - rim[2]));
      obox(p, 'steel', m, [0.04, 0.04, len], { rx, ry });
    }
    p.box('snow', [-1.1, 0.3, -1.1], [1.1, 0.36, 1.1]);
    return p;
  },
  so_antenna_mast() {
    // A 6 m guyed antenna mast on a concrete foot: a lattice of three legs, a yagi and whips at the top, a red light.
    const p = piece('so_antenna_mast');
    p.box('snowShade', [-0.45, 0, -0.45], [0.45, 0.25, 0.45]);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      p.box('red', [Math.cos(a) * 0.2 - 0.03, 0.25, Math.sin(a) * 0.2 - 0.03], [Math.cos(a) * 0.2 + 0.03, 6.0, Math.sin(a) * 0.2 + 0.03]);
    }
    for (let y = 0.8; y < 6; y += 0.9) p.ring(Math.round(y / 0.9) % 2 ? 'white' : 'red', [0, y, 0], 0.17, 0.24, 0, 0.05, { seg: 6 });
    p.box('steel', [-0.02, 5.4, -0.9], [0.02, 5.45, 0.9]);
    for (let i = 0; i < 6; i++) p.box('steel', [-0.35 + i * 0.0, 5.38, -0.8 + i * 0.32], [0.35, 5.47, -0.78 + i * 0.32]);
    for (const x of [-0.15, 0.15]) p.cylinder('steel', [x, 6.0, 0], 0.015, 0, 1.4, { seg: 4 });
    p.sphere('beacon', [0, 6.1, 0], 0.09, { rings: 4, seg: 6 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      const [gx, gz] = [Math.cos(a) * 2.6, Math.sin(a) * 2.6];
      const len = Math.hypot(2.6, 4.2);
      obox(p, 'rope', [gx / 2, 2.15, gz / 2], [0.02, len, 0.02], { rx: Math.atan2(2.6, 4.2) * Math.sin(a) * -1, rz: Math.atan2(2.6, 4.2) * Math.cos(a) });
      p.box('steelDark', [gx - 0.1, 0, gz - 0.1], [gx + 0.1, 0.15, gz + 0.1]);
    }
    return p;
  },
  so_heater() {
    // A diesel space heater: a fuel tank on wheels, the burner drum on top glowing at its mouth, a duct.
    const p = piece('so_heater');
    p.box('yellow', [-0.35, 0.18, -0.55], [0.35, 0.6, 0.55]);
    for (const x of [-0.38, 0.38]) p.cylinder('rubber', [x, 0.16, -0.3], 0.16, -0.05, 0.05, { seg: 10, axis: 'x' });
    p.cylinder('yellow', [0, 0.95, -0.5], 0.3, 0, 1.0, { seg: 12, axis: 'z' });
    p.ring('steelDark', [0, 0.95, 0.5], 0.22, 0.31, 0, 0.06, { seg: 12, axis: 'z' });
    p.cylinder('heat', [0, 0.95, 0.42], 0.22, 0, 0.1, { seg: 12, axis: 'z' });
    p.box('black', [-0.3, 0.6, -0.55], [0.3, 0.68, 0.4]);
    p.box('steelDark', [0.25, 0.9, -0.6], [0.32, 1.1, -0.5]);
    p.cylinder('snowShade', [0, 1.25, -0.4], 0.12, 0, 0.25, { seg: 8 });
    return p;
  },
  so_generator() {
    // A skid-mounted diesel generator: an orange enclosure with louvres, a control panel, an exhaust stack, a fuel tank under it.
    const p = piece('so_generator');
    p.box('steelDark', [-1.3, 0, -0.7], [1.3, 0.25, 0.7]);
    p.box('orange', [-1.2, 0.25, -0.6], [1.2, 1.6, 0.6]);
    for (let i = 0; i < 6; i++) p.box('black', [-1.0 + i * 0.22, 0.6, 0.6], [-0.88 + i * 0.22, 1.35, 0.62]);
    p.box('steel', [0.45, 0.6, 0.6], [1.05, 1.35, 0.64]);
    p.box('screen', [0.55, 1.05, 0.64], [0.85, 1.25, 0.65]);
    for (let i = 0; i < 3; i++) p.box(i ? 'red' : 'beacon', [0.58 + i * 0.12, 0.75, 0.64], [0.66 + i * 0.12, 0.83, 0.66]);
    p.cylinder('steelDark', [-0.8, 1.6, -0.3], 0.08, 0, 0.8, { seg: 8 });
    p.cylinder('black', [-0.8, 2.4, -0.3], 0.1, 0, 0.12, { seg: 8 });
    p.box('snow', [-1.22, 1.6, -0.62], [1.22, 1.68, 0.62]);
    return p;
  },
  so_snowmobile() {
    // A snowmobile (stand-in): a red hull and cowl, windscreen, seat, handlebars, two skis in front and a rubber track.
    const p = piece('so_snowmobile');
    for (const x of [-0.45, 0.45]) {
      p.box('steelDark', [x - 0.07, 0, 0.4], [x + 0.07, 0.04, 1.5]);
      obox(p, 'steelDark', [x, 0.08, 1.55], [0.14, 0.04, 0.2], { rx: -0.6 });
      p.box('steel', [x - 0.03, 0.04, 0.85], [x + 0.03, 0.42, 0.95]);
    }
    p.box('rubber', [-0.32, 0, -1.25], [0.32, 0.35, 0.4]);
    p.box('red', [-0.5, 0.3, -1.2], [0.5, 0.65, 0.95]);
    obox(p, 'red', [0, 0.72, 0.85], [0.95, 0.35, 0.7], { rx: 0.35 });
    obox(p, 'glass', [0, 1.05, 0.55], [0.8, 0.4, 0.03], { rx: -0.45 });
    p.box('black', [-0.3, 0.65, -1.05], [0.3, 0.85, 0.2]);
    p.box('steelDark', [-0.4, 0.95, 0.32], [0.4, 0.99, 0.36]);
    p.box('steelDark', [-0.03, 0.7, 0.3], [0.03, 0.97, 0.38]);
    p.box('white', [-0.5, 0.45, -1.21], [0.5, 0.52, 0.96]);
    p.sphere('lamp', [0, 0.7, 1.2], 0.08, { rings: 4, seg: 6 });
    return p;
  },
  so_tarp_crates() {
    // Supply crates and a drum under a lashed green tarpaulin, snow lying on top.
    const p = piece('so_tarp_crates');
    crate(p, -0.5, 0, 0, 0.9);
    crate(p, 0.45, 0, 0.05, 0.8);
    crate(p, -0.45, 0.9, 0, 0.6);
    obox(p, 'tarp', [-0.05, 1.52, 0], [1.6, 0.04, 1.1]);
    for (const s of [-1, 1]) obox(p, 'tarp', [-0.05, 1.0, s * 0.55], [1.6, 1.0, 0.04], { rx: s * 0.06 });
    obox(p, 'tarp', [0.75, 1.0, 0], [0.04, 1.0, 1.1], { rz: -0.3 });
    for (const x of [-0.6, 0.35]) p.box('rope', [x - 0.02, 0.5, -0.58], [x + 0.02, 1.56, 0.58]);
    p.box('snow', [-0.85, 1.54, -0.5], [0.75, 1.62, 0.5]);
    p.sphere('snow', [0.2, 1.56, 0.1], 0.4, { rings: 4, seg: 8, squash: 0.25 });
    return p;
  },
  so_lamp_post() {
    // An arctic lamp post: a steel pole on a concrete foot, an arm and a sodium lamp, snow on the lamp hood.
    const p = piece('so_lamp_post');
    p.cylinder('snowShade', [0, 0, 0], 0.25, 0, 0.4, { seg: 8 });
    p.cylinder('steel', [0, 0.4, 0], 0.08, 0, 5.6, { seg: 8, r1: 0.06 });
    p.box('steel', [-0.04, 5.85, 0], [0.04, 5.95, 1.0]);
    p.box('steelDark', [-0.22, 5.7, 0.8], [0.22, 5.9, 1.35]);
    p.box('lamp', [-0.18, 5.66, 0.85], [0.18, 5.7, 1.3]);
    p.box('snow', [-0.23, 5.9, 0.78], [0.23, 5.97, 1.37]);
    p.box('steelDark', [-0.12, 1.2, 0.08], [0.12, 1.55, 0.2]);
    return p;
  },
  so_flagpole() {
    // An 8 m flagpole on a stepped base, an orange flag with a white band streaming out (+X).
    const p = piece('so_flagpole');
    p.box('snowShade', [-0.6, 0, -0.6], [0.6, 0.25, 0.6]);
    p.box('snowShade', [-0.4, 0.25, -0.4], [0.4, 0.45, 0.4]);
    p.cylinder('white', [0, 0.45, 0], 0.06, 0, 7.6, { seg: 8, r1: 0.04 });
    p.sphere('steel', [0, 8.1, 0], 0.08, { rings: 4, seg: 6 });
    for (let i = 0; i < 4; i++) {
      const x0 = 0.05 + i * 0.4;
      const zf = (k) => Math.sin(k * 1.6) * 0.12;
      for (const [y0, y1, mat] of [[6.5, 6.95, 'orange'], [6.95, 7.15, 'white'], [7.15, 7.6, 'orange']]) {
        p.quad(mat, [x0, y0, zf(i)], [x0 + 0.4, y0, zf(i + 1)], [x0 + 0.4, y1, zf(i + 1)], [x0, y1, zf(i)], [0, 0, 1]);
        p.quad(mat, [x0, y0, zf(i)], [x0, y1, zf(i)], [x0 + 0.4, y1, zf(i + 1)], [x0 + 0.4, y0, zf(i + 1)], [0, 0, -1]);
      }
    }
    return p;
  },
  so_chainlink_fence() {
    // A 3 m chain-link panel between steel posts, three strands of barbed wire on top, snow banked at its foot.
    const p = piece('so_chainlink_fence');
    for (const x of [-1.5, 1.5]) p.cylinder('steel', [x, 0, 0], 0.045, 0, 2.3, { seg: 8 });
    p.box('steel', [-1.5, 2.0, -0.025], [1.5, 2.04, 0.025]);
    p.box('steel', [-1.5, 0.1, -0.02], [1.5, 0.13, 0.02]);
    for (let i = 0; i < 12; i++) {
      for (const s of [1, -1]) obox(p, 'steelDark', [-1.375 + i * 0.25, 1.05, 0], [0.012, 2.0, 0.012], { rz: s * 0.12 });
    }
    for (const y of [2.15, 2.25, 2.35]) p.box('steelDark', [-1.5, y, -0.01], [1.5, y + 0.012, 0.01]);
    p.box('snow', [-1.5, 0, -0.3], [1.5, 0.12, 0.3]);
    p.box('snow', [-1.5, 0.12, -0.15], [1.5, 0.22, 0.15]);
    return p;
  },
  so_snow_fence() {
    // A 3 m slatted wooden snow fence on stakes, drifted up on its windward side.
    const p = piece('so_snow_fence');
    for (const x of [-1.45, 0, 1.45]) p.box('woodDark', [x - 0.05, 0, -0.05], [x + 0.05, 1.5, 0.05]);
    for (const y of [0.35, 1.15]) p.box('woodDark', [-1.5, y, 0.05], [1.5, y + 0.08, 0.09]);
    for (let i = 0; i < 15; i++) p.box(i % 3 ? 'wood' : 'red', [-1.42 + i * 0.2, 0.1, 0.09], [-1.32 + i * 0.2, 1.4, 0.11]);
    p.box('snow', [-1.5, 0, -0.9], [1.5, 0.2, 0.05]);
    p.box('snow', [-1.5, 0.2, -0.45], [1.5, 0.5, 0.05]);
    return p;
  },
  so_pipe_run() {
    // A 4 m run of two insulated pipes on steel trestles, a valve wheel at one end.
    const p = piece('so_pipe_run');
    for (const x of [-1.6, 1.6]) {
      for (const z of [-0.35, 0.35]) p.box('steel', [x - 0.05, 0, z - 0.05], [x + 0.05, 0.75, z + 0.05]);
      p.box('steel', [x - 0.06, 0.7, -0.45], [x + 0.06, 0.8, 0.45]);
    }
    for (const [z, mat] of [[-0.2, 'white'], [0.2, 'steel']]) p.cylinder(mat, [-2, 0.95, z], 0.15, 0, 4, { seg: 10, axis: 'x' });
    for (const x of [-1.0, 0.0, 1.0]) p.ring('steelDark', [x, 0.95, -0.2], 0.15, 0.17, -0.03, 0.06, { seg: 10, axis: 'x' });
    p.cylinder('steelDark', [1.7, 1.1, 0.2], 0.03, 0, 0.3, { seg: 6 });
    p.ring('red', [1.7, 1.42, 0.2], 0.13, 0.16, 0, 0.03, { seg: 10 });
    p.box('snow', [-2, 1.1, -0.32], [2, 1.15, 0.32]);
    return p;
  },
  so_drums() {
    // Five oil drums in a huddle, snow on their lids, one fallen over.
    const p = piece('so_drums');
    drum(p, -0.35, 0, -0.3);
    drum(p, 0.3, 0, -0.32, 'red');
    drum(p, 0, 0, 0.25);
    drum(p, 0.62, 0, 0.3, 'olive');
    p.cylinder('blue', [-0.95, 0.29, 0.4], 0.29, -0.44, 0.44, { seg: 12, axis: 'x' });
    p.box('snowShade', [-1.3, 0, -0.7], [1.0, 0.04, 0.8]);
    return p;
  },
  so_radio_console() {
    // A radio operator's desk: a steel desk, a rack of sets with glowing dials, a microphone and a lamp.
    const p = piece('so_radio_console');
    p.box('steel', [-1.0, 0.72, -0.4], [1.0, 0.78, 0.4]);
    for (const x of [-0.95, 0.95]) p.box('steelDark', [x - 0.04, 0, -0.38], [x + 0.04, 0.72, 0.38]);
    p.box('olive', [-0.9, 0.78, -0.4], [0.9, 1.5, -0.1]);
    for (let i = 0; i < 3; i++) {
      p.box('screen', [-0.8 + i * 0.58, 1.1, -0.1], [-0.4 + i * 0.58, 1.35, -0.09]);
      for (let k = 0; k < 3; k++) p.cylinder('black', [-0.75 + i * 0.58 + k * 0.13, 0.92, -0.1], 0.035, 0, 0.03, { seg: 6, axis: 'z' });
    }
    p.box('black', [0.2, 0.78, 0.05], [0.4, 0.82, 0.2]);
    p.cylinder('black', [0.3, 0.82, 0.12], 0.012, 0, 0.18, { seg: 4 });
    p.sphere('black', [0.3, 1.02, 0.12], 0.035, { rings: 3, seg: 5 });
    p.cylinder('steelDark', [-0.7, 0.78, 0.15], 0.01, 0, 0.35, { seg: 4 });
    p.box('lamp', [-0.78, 1.1, 0.1], [-0.62, 1.14, 0.22]);
    return p;
  },
  so_ski_rack() {
    // A wooden rack with five pairs of skis and poles leaning in it.
    const p = piece('so_ski_rack');
    for (const x of [-0.9, 0.9]) p.box('woodDark', [x - 0.05, 0, -0.3], [x + 0.05, 1.2, -0.2]);
    p.box('woodDark', [-0.95, 1.1, -0.3], [0.95, 1.18, -0.2]);
    p.box('woodDark', [-0.95, 0.15, 0.15], [0.95, 0.22, 0.3]);
    for (let i = 0; i < 5; i++) {
      for (const s of [-0.04, 0.04]) obox(p, i % 2 ? 'red' : 'blue', [-0.7 + i * 0.35 + s, 0.95, -0.02], [0.06, 1.9, 0.02], { rx: -0.25 });
      obox(p, 'steel', [-0.58 + i * 0.35, 0.7, 0.0], [0.02, 1.35, 0.02], { rx: -0.3 });
    }
    return p;
  },
  so_supply_sled() {
    // A cargo sled (pulk): steel runners, a slatted deck, a lashed crate and fuel cans, a tow bar.
    const p = piece('so_supply_sled');
    for (const x of [-0.6, 0.6]) {
      p.box('steelDark', [x - 0.04, 0, -1.2], [x + 0.04, 0.05, 1.1]);
      obox(p, 'steelDark', [x, 0.12, 1.2], [0.08, 0.05, 0.3], { rx: -0.8 });
      for (const z of [-0.9, 0, 0.8]) p.box('steel', [x - 0.03, 0.05, z - 0.03], [x + 0.03, 0.25, z + 0.03]);
    }
    for (let i = 0; i < 7; i++) p.box('wood', [-0.7, 0.25, -1.15 + i * 0.32], [0.7, 0.3, -0.92 + i * 0.32]);
    crate(p, -0.1, 0.3, -0.4, 0.8);
    for (const x of [0.45, 0.45]) p.box('red', [x - 0.12, 0.3, 0.4], [x + 0.12, 0.75, 0.62]);
    p.box('olive', [-0.55, 0.3, 0.35], [-0.2, 0.7, 0.75]);
    for (const z of [-0.4, 0.5]) p.box('rope', [-0.72, 0.3, z - 0.02], [0.72, 1.12, z + 0.02]);
    obox(p, 'steel', [0, 0.35, 1.7], [0.05, 0.05, 1.0], { rx: 0.3 });
    p.box('snow', [-0.48, 1.1, -0.78], [0.28, 1.15, -0.02]);
    return p;
  },
  so_snow_pile() {
    // A heap of ploughed snow, shoulder high: cover anywhere.
    const p = piece('so_snow_pile');
    p.cylinder('snow', [0, 0, 0], 1.7, 0, 0.7, { seg: 12, r1: 1.3 });
    p.cylinder('snow', [0, 0, 0], 1.3, 0.7, 1.35, { seg: 12, r1: 0.6 });
    p.cylinder('snowShade', [0.8, 0, 0.6], 1.0, 0, 0.9, { seg: 10, r1: 0.4 });
    p.cylinder('snow', [-0.7, 0, -0.5], 1.0, 0, 1.1, { seg: 10, r1: 0.35 });
    return p;
  },
};

// ---------------------------------------------------------------- build

for (const [id, make] of Object.entries(PROPS)) {
  const doc = piecesDocument([make()], 'tiletrigger prepare-snow');
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
}
console.log(`wrote ${Object.keys(PROPS).length} prop sources to assets-src/tiletrigger-snow`);
