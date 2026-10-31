// MapMaker Style Pack 11 Coastal Harbor (the owner's "Tileset 03" sheet): the
// props we model ourselves, in code, from plain geometry
// (tools/content/pieces.mjs): bollards, a capstan, lobster pots, buoys, a net
// rack, a fish stall and fish boxes, a fishing boat, an anchor, rope coils, a
// harbour lamp post, a life ring, a heap of nets, a gull, a tide board, a
// dolphin of piles and tyre fenders. No pack and no generative AI service is
// involved: the code is the source. (The fishing boat is a simple in-house
// version under a stable id; a hero model waits for the owner.)
//
//   node tools/content/prepare-harbor.mjs
//
// Writes assets-src/tiletrigger-harbor/<id>.glb (licence "Owned", see the
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
const SRC = join(ROOT, 'assets-src/tiletrigger-harbor');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  iron: { color: hex('#2a2c30'), metal: 0.6, rough: 0.55 },
  rust: { color: hex('#7a4026'), metal: 0.3, rough: 0.8 },
  steel: { color: hex('#7a7e82'), metal: 0.7, rough: 0.4 },
  wood: { color: hex('#7a6248'), rough: 0.85 },
  woodDark: { color: hex('#4a3a2c'), rough: 0.85 },
  plank: { color: hex('#a8977c'), rough: 0.85 },
  rope: { color: hex('#b09a68'), rough: 0.95 },
  net: { color: hex('#4a6a5a'), rough: 0.95 },
  netOrange: { color: hex('#c86a2a'), rough: 0.9 },
  red: { color: hex('#b8262a'), rough: 0.6 },
  white: { color: hex('#ece8e0'), rough: 0.6 },
  blue: { color: hex('#2e5a7a'), rough: 0.6 },
  green: { color: hex('#2a6a3a'), rough: 0.6 },
  yellow: { color: hex('#d8a020'), rough: 0.6 },
  black: { color: hex('#1e1e20'), rough: 0.8 },
  rubber: { color: hex('#222224'), rough: 0.95 },
  ice: { color: hex('#d8eef2'), metal: 0.1, rough: 0.2 },
  fish: { color: hex('#9aa8b0'), metal: 0.4, rough: 0.35 },
  fishGold: { color: hex('#c09050'), metal: 0.3, rough: 0.4 },
  canvas: { color: hex('#c8c0a8'), rough: 0.9 },
  stone: { color: hex('#8e9090'), rough: 0.9 },
  glass: { color: hex('#6a8898'), metal: 0.2, rough: 0.15 },
  lamp: { color: hex('#ffe2a0'), emissive: glow('#ffd27a') },
  feather: { color: hex('#f2f2ee'), rough: 0.8 },
  wing: { color: hex('#8a9098'), rough: 0.8 },
  beak: { color: hex('#e8b020'), rough: 0.6 },
};
const piece = (name) => new Piece(name, MATS);

/** A box of `size` centred on `c`, tilted `rx` about x, then `rz` about z, then turned `ry` about y (radians). */
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

/** A coil of rope lying flat at (x, y, z): stacked rings. */
function coil(p, x, y, z, r = 0.32, turns = 3) {
  for (let i = 0; i < turns; i++) p.ring('rope', [x, y + i * 0.05, z], r * 0.45, r - i * 0.02, 0, 0.05, { seg: 14 });
}

/** A lobster pot (creel) at (x, y, z): a netted half-barrel on a flat base. */
function creel(p, x, y, z, yaw = 0) {
  const w = 0.62;
  const d = 0.42;
  p.box('woodDark', [x - w / 2, y, z - d / 2], [x + w / 2, y + 0.05, z + d / 2], yaw);
  for (const k of [-0.24, 0, 0.24]) {
    const c = [x + Math.cos(yaw) * k, y + 0.05, z - Math.sin(yaw) * k];
    p.ring('wood', c, 0.18, 0.2, 0, 0.03, { seg: 10, axis: 'x' });
  }
  obox(p, 'net', [x, y + 0.17, z], [w - 0.04, 0.3, d - 0.06], { ry: yaw });
}

/** A fish box (plastic) of fish at (x, y, z). */
function fishBox(p, x, y, z, mat = 'blue') {
  p.box(mat, [x - 0.4, y, z - 0.28], [x + 0.4, y + 0.24, z + 0.28]);
  p.box('ice', [x - 0.36, y + 0.18, z - 0.24], [x + 0.36, y + 0.23, z + 0.24]);
  for (let i = 0; i < 4; i++) obox(p, i % 2 ? 'fishGold' : 'fish', [x - 0.24 + i * 0.16, y + 0.25, z + (i % 2) * 0.05], [0.09, 0.05, 0.36], { ry: 0.2 * (i - 1.5) });
}

// ---------------------------------------------------------------- props

/** Each is built in metres, standing on y = 0, facing +Z; prepare-props measures and centres it. */
const PROPS = {
  hb_bollard() {
    // A cast-iron mooring bollard: a squat post with a flared head and a rope's turn round it.
    const p = piece('hb_bollard');
    p.cylinder('iron', [0, 0, 0], 0.28, 0, 0.08, { seg: 12 });
    p.cylinder('iron', [0, 0, 0], 0.18, 0.08, 0.5, { seg: 12, r1: 0.15 });
    p.cylinder('iron', [0, 0, 0], 0.15, 0.5, 0.62, { seg: 12, r1: 0.24 });
    p.cylinder('iron', [0, 0, 0], 0.24, 0.62, 0.68, { seg: 12 });
    p.ring('rope', [0, 0.32, 0], 0.17, 0.22, 0, 0.06, { seg: 12 });
    obox(p, 'rope', [0, 0.3, 0.55], [0.05, 0.05, 0.75], { rx: 0.25 });
    return p;
  },
  hb_capstan() {
    // A capstan (warping winch) on the quay: drum, cap and four bars.
    const p = piece('hb_capstan');
    p.cylinder('iron', [0, 0, 0], 0.45, 0, 0.12, { seg: 14 });
    p.cylinder('iron', [0, 0, 0], 0.26, 0.12, 0.8, { seg: 14, r1: 0.22 });
    p.cylinder('iron', [0, 0, 0], 0.32, 0.8, 0.95, { seg: 14 });
    for (let k = 0; k < 4; k++) obox(p, 'wood', [0, 0.88, 0], [1.6, 0.06, 0.06], { ry: (k * Math.PI) / 4 });
    p.ring('rope', [0, 0.3, 0], 0.24, 0.3, 0, 0.18, { seg: 14 });
    return p;
  },
  hb_lobster_pots() {
    // A stack of lobster pots with a float and a coil of line.
    const p = piece('hb_lobster_pots');
    creel(p, -0.34, 0, 0, 0);
    creel(p, 0.34, 0, 0.04, 0.1);
    creel(p, 0, 0.4, 0.02, -0.15);
    creel(p, 0.0, 0, 0.5, Math.PI / 2 + 0.2);
    p.sphere('netOrange', [0.55, 0.15, 0.5], 0.15, { rings: 5, seg: 8 });
    coil(p, -0.55, 0, 0.5, 0.22, 2);
    return p;
  },
  hb_buoy() {
    // A mooring buoy: a red float with a white band and a ring on top (float it on the water).
    const p = piece('hb_buoy');
    p.sphere('red', [0, 0.45, 0], 0.5, { rings: 8, seg: 12, squash: 0.9 });
    p.cylinder('white', [0, 0, 0], 0.51, 0.38, 0.52, { seg: 12 });
    p.ring('iron', [0, 0.95, 0], 0.08, 0.13, 0, 0.04, { seg: 10, axis: 'z' });
    return p;
  },
  hb_marker_buoy() {
    // A channel marker: a green cone on a float with a lantern on top.
    const p = piece('hb_marker_buoy');
    p.cylinder('green', [0, 0, 0], 0.8, 0, 0.6, { seg: 12, r1: 0.7 });
    p.cylinder('white', [0, 0, 0], 0.7, 0.6, 0.75, { seg: 12 });
    p.cylinder('green', [0, 0, 0], 0.5, 0.75, 2.1, { seg: 10, r1: 0.05 });
    p.box('iron', [-0.05, 0.75, -0.05], [0.05, 2.5, 0.05]);
    p.cylinder('lamp', [0, 2.5, 0], 0.12, 0, 0.25, { seg: 8 });
    p.cylinder('iron', [0, 2.75, 0], 0.15, 0, 0.06, { seg: 8, r1: 0.02 });
    return p;
  },
  hb_net_rack() {
    // A net-drying rack: two posts and rails with a net hung over them, cork floats along its edge.
    const p = piece('hb_net_rack');
    for (const x of [-1.6, 1.6]) {
      p.box('woodDark', [x - 0.07, 0, -0.07], [x + 0.07, 2.2, 0.07]);
      obox(p, 'woodDark', [x, 0.7, 0.45], [0.06, 1.6, 0.06], { rx: -0.6 });
    }
    p.box('wood', [-1.8, 2.05, -0.05], [1.8, 2.15, 0.05]);
    p.box('wood', [-1.8, 1.2, -0.05], [1.8, 1.28, 0.05]);
    obox(p, 'net', [0, 1.45, 0.12], [3.1, 1.3, 0.02], { rx: 0.12 });
    obox(p, 'net', [0, 1.6, -0.12], [3.1, 1.0, 0.02], { rx: -0.1 });
    for (let i = 0; i < 9; i++) p.box('netOrange', [-1.5 + i * 0.37, 0.78, 0.18], [-1.4 + i * 0.37, 0.88, 0.24]);
    return p;
  },
  hb_fish_stall() {
    // A fish stall: a trestle counter heaped with ice and fish, boxes below, a striped awning and a price board.
    const p = piece('hb_fish_stall');
    p.box('plank', [-1.2, 0.85, -0.5], [1.2, 0.92, 0.5]);
    for (const x of [-1.1, 1.1]) for (const z of [-0.4, 0.4]) p.box('wood', [x - 0.04, 0, z - 0.04], [x + 0.04, 0.85, z + 0.04]);
    p.box('ice', [-1.1, 0.92, -0.42], [1.1, 1.0, 0.42]);
    for (let i = 0; i < 9; i++) obox(p, i % 3 ? 'fish' : 'fishGold', [-0.9 + i * 0.22, 1.03, (i % 2) * 0.2 - 0.1], [0.12, 0.06, 0.45], { ry: 0.3 * ((i % 3) - 1) });
    fishBox(p, -0.6, 0, 0.05);
    fishBox(p, 0.4, 0, 0.0, 'red');
    for (const x of [-1.25, 1.25]) {
      p.box('woodDark', [x - 0.04, 0, -0.65], [x + 0.04, 2.3, -0.57]);
      p.box('woodDark', [x - 0.04, 0, 0.62], [x + 0.04, 2.0, 0.7]);
    }
    const a = Math.atan2(0.3, 1.35);
    for (let i = 0; i < 5; i++) obox(p, i % 2 ? 'white' : 'blue', [-1.0 + i * 0.5, 2.15, 0.02], [0.5, 0.03, 1.42], { rx: a });
    p.box('black', [-0.4, 1.25, -0.62], [0.4, 1.75, -0.58]);
    return p;
  },
  hb_fish_crates() {
    // Fish boxes stacked on a pallet, a few iced.
    const p = piece('hb_fish_crates');
    p.box('wood', [-0.9, 0, -0.6], [0.9, 0.14, 0.6]);
    fishBox(p, -0.45, 0.14, -0.3);
    fishBox(p, 0.45, 0.14, -0.3, 'red');
    fishBox(p, -0.45, 0.14, 0.3, 'red');
    fishBox(p, 0.45, 0.14, 0.3);
    p.box('blue', [-0.85, 0.38, -0.58], [0.0, 0.62, 0.0]);
    p.box('red', [0.0, 0.38, -0.58], [0.85, 0.62, 0.0]);
    p.box('blue', [-0.4, 0.62, -0.58], [0.45, 0.86, 0.0]);
    return p;
  },
  hb_fishing_boat() {
    // A small inshore fishing boat (stand-in under a stable id): a beamy hull, a wheelhouse aft, a mast and boom, a net drum.
    const p = piece('hb_fishing_boat');
    const L = 8.4;
    const n = 7;
    for (let i = 0; i < n; i++) {
      // Hull sections from the stern (z = -L/2) to the bow, narrowing and rising forward.
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const width = (t) => 2.6 * (t < 0.6 ? 1 : 1 - ((t - 0.6) / 0.4) ** 1.6 * 0.92);
      const z0 = -L / 2 + t0 * L;
      const z1 = -L / 2 + t1 * L;
      const w = (width(t0) + width(t1)) / 2;
      const sheer = 1.25 + Math.max(0, t1 - 0.6) * 1.0;
      p.box('blue', [-w / 2, 0.15, z0], [w / 2, sheer, z1]);
      p.box('white', [-w / 2 - 0.02, sheer - 0.18, z0], [w / 2 + 0.02, sheer, z1]);
      p.box('red', [-w / 2 * 0.8, 0, z0], [w / 2 * 0.8, 0.3, z1]);
    }
    p.box('plank', [-1.15, 1.1, -L / 2 + 0.2], [1.15, 1.16, L / 2 - 1.6]);
    // Wheelhouse aft.
    p.box('white', [-0.85, 1.16, -3.4], [0.85, 2.9, -1.6]);
    p.box('glass', [-0.7, 2.2, -1.62], [0.7, 2.7, -1.57]);
    for (const x of [-0.87, 0.87]) p.box('glass', [x - 0.02, 2.2, -3.1], [x + 0.02, 2.7, -1.9]);
    p.box('red', [-0.95, 2.9, -3.5], [0.95, 3.02, -1.5]);
    // Mast, boom and the net drum.
    p.cylinder('steel', [0, 1.16, 0.6], 0.07, 0, 5.2, { seg: 6 });
    obox(p, 'steel', [0, 3.0, 1.8], [0.08, 0.08, 2.6], { rx: -0.5 });
    p.cylinder('iron', [-0.6, 1.6, -0.6], 0.38, 0, 1.2, { seg: 10, axis: 'x' });
    p.cylinder('net', [-0.5, 1.6, -0.6], 0.36, 0, 1.0, { seg: 10, axis: 'x' });
    // Tyre fenders along the side.
    for (const z of [-2, 0, 2]) for (const s of [-1, 1]) p.ring('rubber', [s * 1.33, 0.9, z], 0.12, 0.26, -0.06, 0.12, { seg: 10, axis: 'x' });
    return p;
  },
  hb_anchor() {
    // An old stocked anchor laid against the quay: shank, stock, arms and flukes, a ring.
    const p = piece('hb_anchor');
    p.box('rust', [-0.07, 0, -0.07], [0.07, 2.0, 0.07]);
    p.box('rust', [-0.9, 1.75, -0.06], [0.9, 1.87, 0.06]);
    for (const s of [-1, 1]) {
      obox(p, 'rust', [s * 0.42, 0.35, 0], [0.1, 0.95, 0.12], { rz: s * 0.95 });
      obox(p, 'rust', [s * 0.78, 0.68, 0], [0.32, 0.2, 0.08], { rz: s * 0.3 });
    }
    p.ring('rust', [0, 2.1, 0], 0.1, 0.16, -0.03, 0.06, { seg: 10, axis: 'z' });
    return p;
  },
  hb_rope_coil() {
    // Two coils of mooring rope.
    const p = piece('hb_rope_coil');
    coil(p, -0.3, 0, 0, 0.38, 4);
    coil(p, 0.45, 0, 0.2, 0.3, 3);
    return p;
  },
  hb_lamp_post() {
    // A harbour lamp post: a fluted cast-iron column, a crossbar and a lantern.
    const p = piece('hb_lamp_post');
    p.cylinder('iron', [0, 0, 0], 0.22, 0, 0.5, { seg: 10, r1: 0.16 });
    p.cylinder('iron', [0, 0, 0], 0.09, 0.5, 3.6, { seg: 8, r1: 0.06 });
    p.box('iron', [-0.35, 3.3, -0.03], [0.35, 3.36, 0.03]);
    p.cylinder('iron', [0, 3.6, 0], 0.18, 0, 0.08, { seg: 6 });
    p.cylinder('lamp', [0, 3.68, 0], 0.16, 0, 0.45, { seg: 6, r1: 0.2 });
    p.cylinder('iron', [0, 4.13, 0], 0.24, 0, 0.18, { seg: 6, r1: 0.04 });
    return p;
  },
  hb_life_ring() {
    // A life ring on a post with a rope.
    const p = piece('hb_life_ring');
    p.box('woodDark', [-0.06, 0, -0.06], [0.06, 1.5, 0.06]);
    p.box('woodDark', [-0.35, 1.35, -0.04], [0.35, 1.45, 0.04]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      obox(p, k % 2 ? 'white' : 'red', [Math.cos(a) * 0.28, 1.0 + Math.sin(a) * 0.28, 0.12], [0.24, 0.12, 0.1], { rz: a + Math.PI / 2 });
    }
    return p;
  },
  hb_net_pile() {
    // A heap of fishing net with floats and a coil of line.
    const p = piece('hb_net_pile');
    p.sphere('net', [0, 0.1, 0], 0.9, { rings: 5, seg: 10, squash: 0.35 });
    p.sphere('net', [0.5, 0.15, 0.3], 0.55, { rings: 4, seg: 8, squash: 0.5 });
    p.sphere('netOrange', [-0.3, 0.2, 0.4], 0.5, { rings: 4, seg: 8, squash: 0.4 });
    for (let i = 0; i < 6; i++) p.sphere('netOrange', [-0.7 + i * 0.28, 0.33 - Math.abs(i - 2.5) * 0.05, -0.35 + (i % 2) * 0.15], 0.09, { rings: 3, seg: 6 });
    coil(p, 0.7, 0, -0.5, 0.25, 2);
    return p;
  },
  hb_gull() {
    // A herring gull standing (on a post, a roof ridge or the quay).
    const p = piece('hb_gull');
    p.sphere('feather', [0, 0.2, 0], 0.13, { rings: 5, seg: 8, squash: 0.8 });
    obox(p, 'wing', [0, 0.23, -0.08], [0.2, 0.08, 0.3], { rx: -0.25 });
    obox(p, 'black', [0, 0.22, -0.26], [0.12, 0.03, 0.1], { rx: -0.3 });
    p.sphere('feather', [0, 0.33, 0.11], 0.07, { rings: 4, seg: 6 });
    p.cylinder('beak', [0, 0.33, 0.17], 0.02, 0, 0.08, { seg: 4, r1: 0.005, axis: 'z' });
    for (const x of [-0.04, 0.04]) p.box('beak', [x - 0.01, 0, -0.01], [x + 0.01, 0.12, 0.01]);
    return p;
  },
  hb_tide_board() {
    // A tide board and harbour notice on two posts.
    const p = piece('hb_tide_board');
    for (const x of [-0.7, 0.7]) p.box('woodDark', [x - 0.05, 0, -0.05], [x + 0.05, 2.0, 0.05]);
    p.box('white', [-0.8, 1.1, 0.05], [0.8, 1.9, 0.08]);
    p.box('blue', [-0.8, 1.75, 0.08], [0.8, 1.9, 0.09]);
    for (let i = 0; i < 4; i++) p.box('black', [-0.65, 1.2 + i * 0.12, 0.08], [0.2 - (i % 2) * 0.3, 1.25 + i * 0.12, 0.09]);
    p.box('white', [0.3, 0.1, 0.05], [0.5, 1.05, 0.07]);
    for (let i = 0; i < 9; i++) p.box(i % 2 ? 'red' : 'black', [0.3, 0.12 + i * 0.1, 0.07], [0.42, 0.16 + i * 0.1, 0.08]);
    return p;
  },
  hb_dolphin() {
    // A mooring dolphin: a cluster of piles bound with chain, a bollard on top (stand it in the water).
    const p = piece('hb_dolphin');
    for (let k = 0; k < 7; k++) {
      const a = (k / 6) * Math.PI * 2;
      const r = k === 6 ? 0 : 0.42;
      p.cylinder('woodDark', [Math.cos(a) * r, 0, Math.sin(a) * r], 0.17, 0, k === 6 ? 4.4 : 4.0, { seg: 7 });
    }
    for (const y of [2.6, 3.7]) p.ring('iron', [0, y, 0], 0.56, 0.62, 0, 0.12, { seg: 12 });
    p.cylinder('iron', [0, 4.4, 0], 0.12, 0, 0.3, { seg: 8, r1: 0.16 });
    return p;
  },
  hb_fenders() {
    // Tyre fenders hung on chains (hang them on a quay face or a pier's side).
    const p = piece('hb_fenders');
    p.box('wood', [-1.2, 1.15, -0.05], [1.2, 1.3, 0.1]);
    for (const x of [-0.8, 0, 0.8]) {
      p.box('iron', [x - 0.015, 0.75, 0.0], [x + 0.015, 1.15, 0.03]);
      p.ring('rubber', [x, 0.42, 0.18], 0.16, 0.34, -0.12, 0.24, { seg: 12, axis: 'z' });
    }
    return p;
  },
};

// ---------------------------------------------------------------- build

for (const [id, make] of Object.entries(PROPS)) {
  const doc = piecesDocument([make()], 'tiletrigger prepare-harbor');
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
}
console.log(`wrote ${Object.keys(PROPS).length} prop sources to assets-src/tiletrigger-harbor`);
