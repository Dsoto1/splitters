// MapMaker Style Packs, Set 1 (docs/ROADMAP_V1.md Sprint 7): 04 Orbital Station
// and 07 Neon Megacity. Builds
//
//   assets-src/tiletrigger-stylepacks/<id>.glb   props we model ourselves, in code
//                                                (tools/content/pieces.mjs); prepare-props
//                                                turns them into placeable props
//   packages/client/public/packs/facades_<set>.glb  facade pieces for the room option
//                                                Facade (Station hull, Glass tower, Neon
//                                                block), one node per piece, also ours
//   packages/client/public/packs/neon_<tower>.glb   glass towers from Kenney's City Kit
//                                                (Commercial) (CC0), fitted to whole cells
//
// and writes content/packs.lock.json (checked by `pnpm content:check`). Our own
// pieces are rebuilt every run; the Kenney towers only with --downloads, a
// directory holding the extracted kit (folder kenney_city-kit-commercial_2.1),
// otherwise they are kept as built and checked against the lock file. The kit
// itself never goes into the repo.
//
//   node tools/content/prepare-packs.mjs [--downloads <dir>]
//
// Then `node tools/content/prepare-props.mjs [--downloads <dir>]` and `pnpm content:build`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { Piece, piecesDocument } from './pieces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/packs');
const SRC = join(ROOT, 'assets-src/tiletrigger-stylepacks');
const LOCK = join(ROOT, 'content/packs.lock.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const quiet = new Logger(Logger.Verbosity.WARN);
const arg = process.argv.indexOf('--downloads');
const downloads = arg > 0 ? resolve(process.argv[arg + 1] ?? '') : null;
const oldLock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { files: [] };
mkdirSync(OUT, { recursive: true });
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  white: { color: hex('#e8ecef'), rough: 0.45 },
  pale: { color: hex('#c9d0d6'), rough: 0.5 },
  grey: { color: hex('#7c858e'), metal: 0.4, rough: 0.5 },
  dark: { color: hex('#2a2f37'), metal: 0.3, rough: 0.55 },
  black: { color: hex('#121419'), rough: 0.7 },
  cyan: { color: hex('#7fe6ff'), emissive: glow('#7fe6ff') },
  blue: { color: hex('#4aa8ff'), emissive: glow('#4aa8ff') },
  core: { color: hex('#9ff4ff'), emissive: glow('#9ff4ff') },
  amber: { color: hex('#ffb347'), emissive: glow('#ffb347') },
  red: { color: hex('#ff3b3b'), emissive: glow('#ff3b3b') },
  pink: { color: hex('#ff4fd8'), emissive: glow('#ff4fd8') },
  violet: { color: hex('#9a6bff'), emissive: glow('#9a6bff') },
  green: { color: hex('#5dff9a'), emissive: glow('#5dff9a') },
  space: { color: hex('#05070f'), emissive: glow('#0b1430', 0.6), metal: 0.2, rough: 0.05 },
  star: { color: hex('#ffffff'), emissive: glow('#ffffff') },
  glass: { color: hex('#9fd8ff'), metal: 0.1, rough: 0.05, alpha: 0.35 },
  pane: { color: hex('#1d3550'), metal: 0.6, rough: 0.12 },
  lit: { color: hex('#ffe3b0'), emissive: glow('#ffd9a0', 0.55) },
  litcool: { color: hex('#bfe8ff'), emissive: glow('#bfe8ff', 0.45) },
  concrete: { color: hex('#4a4652'), rough: 0.9 },
  concrete2: { color: hex('#3a3742'), rough: 0.9 },
  shutter: { color: hex('#8a8f96'), metal: 0.5, rough: 0.5 },
  orange: { color: hex('#e86a2a'), rough: 0.6 },
  yellow: { color: hex('#e8c020'), rough: 0.6 },
  teal: { color: hex('#1e6f78'), rough: 0.6 },
};
const piece = (name) => new Piece(name, MATS);

// ---------------------------------------------------------------- props we model ourselves

/** Each is built in metres, standing on y = 0, facing +Z; prepare-props measures and centres it. */
const PROPS = {
  // 04 Orbital Station
  os_viewport() {
    // A round viewport onto space for a wall: a white frame, a glowing rim and dark glass with stars.
    const p = piece('os_viewport');
    p.ring('white', [0, 1.2, 0], 0.92, 1.2, 0, 0.22, { axis: 'z', seg: 28 });
    p.ring('cyan', [0, 1.2, 0], 0.86, 0.94, 0.04, 0.2, { axis: 'z', seg: 28 });
    p.cylinder('space', [0, 1.2, 0], 0.9, 0.02, 0.06, { axis: 'z', seg: 28 });
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.8;
      const s = 0.012 + rnd() * 0.02;
      const [x, y] = [Math.cos(a) * r, 1.2 + Math.sin(a) * r];
      p.box('star', [x - s, y - s, 0.065], [x + s, y + s, 0.07]);
    }
    for (const a of [0, 1, 2, 3]) {
      const t = (a * Math.PI) / 2 + Math.PI / 4;
      p.box('grey', [Math.cos(t) * 1.06 - 0.06, 1.2 + Math.sin(t) * 1.06 - 0.06, 0.2], [Math.cos(t) * 1.06 + 0.06, 1.2 + Math.sin(t) * 1.06 + 0.06, 0.26]);
    }
    return p;
  },
  os_reactor_core() {
    // The reactor: a glowing column in a ringed cage on a heavy base.
    const p = piece('os_reactor_core');
    p.cylinder('dark', [0, 0, 0], 2.1, 0, 0.5, { seg: 24 });
    p.cylinder('grey', [0, 0, 0], 1.7, 0.5, 0.9, { seg: 24, r1: 1.4 });
    p.cylinder('core', [0, 0, 0], 0.75, 0.9, 7.2, { seg: 20 });
    p.cylinder('glass', [0, 0, 0], 1.05, 0.9, 7.2, { seg: 20, caps: false });
    for (const y of [1.6, 3.2, 4.8, 6.4]) p.ring('white', [0, y, 0], 1.08, 1.4, 0, 0.3, { seg: 24 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.box('grey', [Math.cos(a) * 1.25 - 0.1, 0.9, Math.sin(a) * 1.25 - 0.1], [Math.cos(a) * 1.25 + 0.1, 7.4, Math.sin(a) * 1.25 + 0.1], -a);
    }
    p.cylinder('grey', [0, 0, 0], 1.5, 7.2, 7.6, { seg: 24, r1: 1.1 });
    p.cylinder('cyan', [0, 0, 0], 0.5, 7.6, 7.8, { seg: 16 });
    return p;
  },
  os_field_emitter() {
    // A force-field emitter post: stand one at each end of a field.
    const p = piece('os_field_emitter');
    p.box('dark', [-0.35, 0, -0.35], [0.35, 0.25, 0.35]);
    p.box('grey', [-0.18, 0.25, -0.18], [0.18, 3.1, 0.18]);
    p.box('cyan', [-0.05, 0.4, 0.18], [0.05, 2.9, 0.22]);
    p.box('cyan', [-0.05, 0.4, -0.22], [0.05, 2.9, -0.18]);
    p.box('dark', [-0.26, 3.1, -0.26], [0.26, 3.3, 0.26]);
    return p;
  },
  os_cryo_pod() {
    // An upright cryo pod: glass tube on a base with a lit core.
    const p = piece('os_cryo_pod');
    p.cylinder('dark', [0, 0, 0], 0.72, 0, 0.3, { seg: 18 });
    p.cylinder('glass', [0, 0, 0], 0.6, 0.3, 2.05, { seg: 18 });
    p.cylinder('litcool', [0, 0, 0], 0.18, 0.3, 1.9, { seg: 10 });
    p.cylinder('white', [0, 0, 0], 0.72, 2.05, 2.35, { seg: 18, r1: 0.5 });
    p.box('cyan', [-0.25, 0.1, 0.66], [0.25, 0.2, 0.74]);
    return p;
  },
  os_holo_globe() {
    // A hologram table: a pedestal and a glowing planet.
    const p = piece('os_holo_globe');
    p.cylinder('dark', [0, 0, 0], 0.55, 0, 0.15, { seg: 18 });
    p.cylinder('grey', [0, 0, 0], 0.22, 0.15, 0.9, { seg: 12 });
    p.cylinder('white', [0, 0, 0], 0.7, 0.9, 1.05, { seg: 18 });
    p.ring('cyan', [0, 1.05, 0], 0.52, 0.62, 0, 0.03, { seg: 18 });
    p.sphere('blue', [0, 1.75, 0], 0.5, { rings: 10, seg: 16 });
    p.ring('cyan', [0, 1.75, 0], 0.62, 0.68, -0.01, 0.02, { seg: 24 });
    return p;
  },
  os_cargo_crate() {
    // A station cargo crate with glowing seams (waist-high cover).
    const p = piece('os_cargo_crate');
    p.box('white', [-0.7, 0, -0.55], [0.7, 1.1, 0.55]);
    p.box('dark', [-0.72, 0, -0.57], [0.72, 0.12, 0.57]);
    p.box('dark', [-0.72, 0.98, -0.57], [0.72, 1.1, 0.57]);
    for (const z of [-0.56, 0.56]) p.box('cyan', [-0.5, 0.5, z - 0.01], [0.5, 0.56, z + 0.01]);
    p.box('amber', [-0.72, 0.5, -0.1], [-0.7, 0.62, 0.1]);
    return p;
  },
  // 07 Neon Megacity
  nc_vending() {
    // A glowing drinks machine.
    const p = piece('nc_vending');
    p.box('dark', [-0.5, 0, -0.4], [0.5, 2.0, 0.4]);
    p.box('pink', [-0.42, 0.75, 0.4], [0.28, 1.85, 0.42]);
    p.box('litcool', [-0.38, 0.8, 0.42], [0.24, 1.8, 0.43]);
    p.box('grey', [0.3, 0.9, 0.4], [0.44, 1.5, 0.44]);
    p.box('black', [-0.4, 0.25, 0.4], [0.24, 0.55, 0.44]);
    p.box('pink', [-0.5, 1.95, -0.4], [0.5, 2.0, 0.4]);
    return p;
  },
  nc_ac_unit() {
    // A rooftop air-conditioning unit.
    const p = piece('nc_ac_unit');
    p.box('pale', [-0.85, 0, -0.55], [0.85, 1.0, 0.55]);
    p.box('dark', [-0.86, 0.1, 0.55], [0.86, 0.9, 0.57]);
    for (let i = 0; i < 8; i++) p.box('grey', [-0.8, 0.15 + i * 0.1, 0.57], [0.8, 0.18 + i * 0.1, 0.6]);
    p.cylinder('black', [0, 1.0, 0], 0.42, 0, 0.05, { seg: 16 });
    p.box('grey', [-0.4, 1.04, -0.04], [0.4, 1.08, 0.04]);
    p.box('grey', [-0.04, 1.04, -0.4], [0.04, 1.08, 0.4]);
    return p;
  },
  nc_water_tank() {
    // A rooftop water tank on legs.
    const p = piece('nc_water_tank');
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) p.box('dark', [x - 0.08, 0, z - 0.08], [x + 0.08, 1.4, z + 0.08]);
    p.box('dark', [-1.1, 1.4, -1.1], [1.1, 1.55, 1.1]);
    p.cylinder('concrete', [0, 0, 0], 1.15, 1.55, 3.4, { seg: 18 });
    p.cylinder('concrete2', [0, 0, 0], 1.2, 3.4, 4.0, { seg: 18, r1: 0.1 });
    for (const y of [2.0, 2.9]) p.ring('dark', [0, y, 0], 1.14, 1.2, 0, 0.06, { seg: 18 });
    return p;
  },
  nc_holo_kiosk() {
    // A street kiosk: a counter under a canopy with a lit sign band.
    const p = piece('nc_holo_kiosk');
    p.box('dark', [-1.0, 0, -0.5], [1.0, 1.05, 0.5]);
    p.box('violet', [-1.0, 1.0, 0.5], [1.0, 1.06, 0.52]);
    for (const x of [-0.95, 0.95]) p.box('grey', [x - 0.05, 1.05, -0.45], [x + 0.05, 2.5, -0.35]);
    p.box('dark', [-1.15, 2.5, -0.7], [1.15, 2.65, 0.75]);
    p.box('cyan', [-1.1, 2.3, 0.72], [1.1, 2.5, 0.76]);
    p.box('litcool', [-0.6, 1.1, -0.3], [0.6, 1.8, -0.25]);
    return p;
  },
  nc_food_stall() {
    // A noodle stall: counter, striped awning and red lanterns.
    const p = piece('nc_food_stall');
    p.box('concrete', [-1.2, 0, -0.6], [1.2, 1.0, 0.6]);
    p.box('yellow', [-1.25, 1.0, -0.65], [1.25, 1.08, 0.65]);
    for (const x of [-1.15, 1.15]) p.box('dark', [x - 0.05, 1.08, -0.6], [x + 0.05, 2.5, -0.5]);
    for (let i = 0; i < 6; i++) p.box(i % 2 ? 'red' : 'white', [-1.3 + i * 0.4333, 2.45, -0.75], [-1.3 + (i + 1) * 0.4333, 2.55, 1.0]);
    for (const x of [-0.8, 0, 0.8]) p.sphere('red', [x, 2.2, 0.85], 0.14, { rings: 6, seg: 10, squash: 1.25 });
    p.box('amber', [-1.2, 0.85, 0.6], [1.2, 0.92, 0.62]);
    return p;
  },
  nc_antenna() {
    // A rooftop antenna mast with a red beacon.
    const p = piece('nc_antenna');
    p.box('dark', [-0.4, 0, -0.4], [0.4, 0.2, 0.4]);
    p.cylinder('grey', [0, 0, 0], 0.09, 0.2, 6.2, { seg: 8, r1: 0.05 });
    for (const [y, w] of [[2.4, 0.9], [3.8, 0.7], [5.0, 0.5]]) p.box('grey', [-w, y - 0.03, -0.03], [w, y + 0.03, 0.03]);
    p.sphere('red', [0, 6.3, 0], 0.13, { rings: 6, seg: 10 });
    return p;
  },
  nc_neon_barrier() {
    // A concrete jersey barrier with a neon stripe (waist-high cover).
    const p = piece('nc_neon_barrier');
    p.box('concrete', [-1.0, 0, -0.3], [1.0, 0.25, 0.3]);
    p.box('concrete', [-1.0, 0.25, -0.18], [1.0, 0.95, 0.18]);
    for (const z of [-0.19, 0.19]) p.box('pink', [-0.95, 0.6, z - 0.01], [0.95, 0.66, z + 0.01]);
    return p;
  },
};

// ---------------------------------------------------------------- facades we model ourselves

/** Facade pieces follow the city kit's convention (FACADE_PIECES): 8/3 m wide, a 4 m storey (bands 4/3 m), pivot at the bottom centre of the face, facing +Z, depth behind it. */
const W = 4 / 3;
const DEPTH = 0.3;
function slab(p, mat, y0, y1, z0 = -DEPTH, z1 = -0.04) {
  p.box(mat, [-W, y0, z0], [W, y1, z1]);
}
function windowBay(p, frame, glassMat, lightMat, x0, x1, y0, y1) {
  p.box(glassMat, [x0, y0, -0.12], [x1, y1, -0.1]);
  if (lightMat) p.box(lightMat, [x0 + 0.1, y0 + 0.15, -0.2], [x1 - 0.1, y1 - 0.2, -0.18]);
  p.box(frame, [x0 - 0.06, y0 - 0.06, -0.12], [x1 + 0.06, y0, 0]);
  p.box(frame, [x0 - 0.06, y1, -0.12], [x1 + 0.06, y1 + 0.06, 0]);
  p.box(frame, [x0 - 0.06, y0, -0.12], [x0, y1, 0]);
  p.box(frame, [x1, y0, -0.12], [x1 + 0.06, y1, 0]);
}

const FACADES = {
  orbital: () => {
    const panel = (name, viewport) => {
      const p = piece(name);
      if (!viewport) slab(p, 'white', 0, 4);
      else {
        // The panel round a round viewport (left and right piers, above and below).
        slab(p, 'white', 0, 1.25);
        slab(p, 'white', 3.15, 4);
        p.box('white', [-W, 1.25, -DEPTH], [-0.95, 3.15, -0.04]);
        p.box('white', [0.95, 1.25, -DEPTH], [W, 3.15, -0.04]);
        p.ring('pale', [0, 2.2, -0.2], 0.78, 0.98, 0, 0.22, { axis: 'z', seg: 24 });
        p.ring('cyan', [0, 2.2, -0.2], 0.72, 0.8, 0.02, 0.18, { axis: 'z', seg: 24 });
        p.cylinder('space', [0, 2.2, -0.2], 0.74, 0, 0.04, { axis: 'z', seg: 24 });
        // Fill the corners between the ring and the piers.
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) p.box('white', [sx > 0 ? 0.55 : -0.95, sy > 0 ? 2.75 : 1.25, -DEPTH], [sx > 0 ? 0.95 : -0.55, sy > 0 ? 3.15 : 1.65, -0.04]);
      }
      // Seams, a glowing trim line and a vent.
      for (const x of [-W + 0.02, W - 0.06]) p.box('pale', [x, 0, -0.06], [x + 0.04, 4, -0.02]);
      p.box('pale', [-W, 0.62, -0.06], [W, 0.66, -0.02]);
      p.box('cyan', [-W, 3.42, -0.06], [W, 3.5, 0]);
      p.box('dark', [-0.5, 0.18, -0.06], [0.5, 0.42, -0.03]);
      return p;
    };
    const band = piece('Hull_Band');
    slab(band, 'white', 0, W);
    band.box('cyan', [-W, W / 2 - 0.04, -0.06], [W, W / 2 + 0.04, 0]);
    const cornice = piece('Hull_Cornice');
    cornice.box('pale', [-W, 0, -0.4], [W, 0.45, 0.08]);
    cornice.box('cyan', [-W, 0.18, 0.08], [W, 0.27, 0.11]);
    const column = piece('Hull_Column');
    column.box('pale', [-0.36, 0, -0.36], [0.36, 4, 0.36]);
    for (const [a, b] of [[[-0.05, 0.3, 0.36], [0.05, 3.7, 0.39]], [[0.36, 0.3, -0.05], [0.39, 3.7, 0.05]], [[-0.05, 0.3, -0.39], [0.05, 3.7, -0.36]], [[-0.39, 0.3, -0.05], [-0.36, 3.7, 0.05]]]) column.box('cyan', a, b);
    return [panel('Hull_Panel', false), panel('Hull_Viewport', true), band, cornice, column];
  },
  neon: () => {
    const out = [];
    // Glass tower: a curtain wall of dark blue glass, every other bay lit inside.
    for (const [name, light] of [['Glass_Lit', 'litcool'], ['Glass_Pane', null], ['Glass_Lobby', 'lit']]) {
      const p = piece(name);
      const lobby = name === 'Glass_Lobby';
      p.box('dark', [-W, 0, -DEPTH], [W, lobby ? 0.15 : 0.35, -0.04]);
      windowBay(p, 'dark', 'pane', light, -W + 0.08, -0.04, lobby ? 0.15 : 0.35, 3.7);
      windowBay(p, 'dark', 'pane', light, 0.04, W - 0.08, lobby ? 0.15 : 0.35, 3.7);
      p.box('dark', [-W, 3.7, -DEPTH], [W, 4, -0.04]);
      p.box('dark', [-W, 0, -DEPTH], [-W + 0.08, 4, -0.04]);
      p.box('dark', [W - 0.08, 0, -DEPTH], [W, 4, -0.04]);
      if (lobby) p.box('cyan', [-W, 3.72, -0.04], [W, 3.8, 0.02]);
      out.push(p);
    }
    const gBand = piece('Glass_Band');
    slab(gBand, 'dark', 0, W);
    gBand.box('cyan', [-W, W / 2 - 0.04, -0.04], [W, W / 2 + 0.04, 0.01]);
    const gCornice = piece('Glass_Cornice');
    gCornice.box('dark', [-W, 0, -0.4], [W, 0.6, 0.06]);
    gCornice.box('pink', [-W, 0.25, 0.06], [W, 0.34, 0.1]);
    const gColumn = piece('Glass_Column');
    gColumn.box('dark', [-0.34, 0, -0.34], [0.34, 4, 0.34]);
    gColumn.box('cyan', [0.34, 0, -0.04], [0.37, 4, 0.04]);
    gColumn.box('cyan', [-0.04, 0, 0.34], [0.04, 4, 0.37]);
    out.push(gBand, gCornice, gColumn);
    // Neon block: dark concrete, lit windows with AC units, neon strips and shopfronts with half-up shutters.
    const win = piece('Neon_Window');
    slab(win, 'concrete', 0, 1.0);
    slab(win, 'concrete', 2.8, 4);
    win.box('concrete', [-W, 1.0, -DEPTH], [-0.85, 2.8, -0.04]);
    win.box('concrete', [0.85, 1.0, -DEPTH], [W, 2.8, -0.04]);
    windowBay(win, 'dark', 'pane', 'lit', -0.85, 0.85, 1.0, 2.8);
    win.box('pale', [-0.45, 0.45, -0.04], [0.45, 0.95, 0.35]);
    win.box('dark', [-0.4, 0.5, 0.35], [0.4, 0.9, 0.37]);
    win.box('pink', [-W, 3.55, -0.04], [W, 3.62, 0.02]);
    const wall = piece('Neon_Wall');
    slab(wall, 'concrete2', 0, 4);
    wall.box('pink', [-W, 3.55, -0.04], [W, 3.62, 0.02]);
    // A vertical sign blade sticking out of the wall.
    wall.box('dark', [-0.06, 1.2, -0.04], [0.06, 3.3, 0.7]);
    wall.box('cyan', [-0.08, 1.3, 0.1], [0.08, 3.2, 0.62]);
    wall.box('dark', [-1.1, 0.3, -0.04], [-0.8, 3.4, 0.06]);
    const shop = piece('Neon_Shop');
    shop.box('concrete', [-W, 3.0, -DEPTH], [W, 4, -0.04]);
    shop.box('concrete', [-W, 0, -DEPTH], [-1.1, 3.0, -0.04]);
    shop.box('concrete', [1.1, 0, -DEPTH], [W, 3.0, -0.04]);
    shop.box('lit', [-1.1, 0, -0.22], [1.1, 2.9, -0.2]);
    for (let i = 0; i < 10; i++) shop.box('shutter', [-1.1, 1.6 + i * 0.13, -0.12], [1.1, 1.7 + i * 0.13, -0.08]);
    shop.box('pink', [-1.2, 3.05, -0.04], [1.2, 3.12, 0.04]);
    shop.box('green', [-0.9, 3.25, -0.04], [0.9, 3.75, 0.0]);
    const shopWall = piece('Neon_ShopWall');
    slab(shopWall, 'concrete2', 0, 4);
    shopWall.box('teal', [-1.0, 0.2, -0.04], [-0.2, 1.4, -0.02]);
    shopWall.box('orange', [-0.1, 0.4, -0.04], [0.9, 1.1, -0.02]);
    shopWall.box('pink', [-W, 3.05, -0.04], [W, 3.12, 0.04]);
    const nBand = piece('Neon_Band');
    slab(nBand, 'concrete', 0, W);
    nBand.box('violet', [-W, W / 2 - 0.04, -0.04], [W, W / 2 + 0.04, 0.02]);
    const nCornice = piece('Neon_Cornice');
    nCornice.box('concrete2', [-W, 0, -0.4], [W, 0.7, 0.06]);
    nCornice.box('pink', [-W, 0.4, 0.06], [W, 0.48, 0.1]);
    const nColumn = piece('Neon_Column');
    nColumn.box('concrete2', [-0.34, 0, -0.34], [0.34, 4, 0.34]);
    nColumn.box('pink', [0.34, 0, -0.04], [0.37, 4, 0.04]);
    nColumn.box('pink', [-0.04, 0, 0.34], [0.04, 4, 0.37]);
    out.push(win, wall, shop, shopWall, nBand, nCornice, nColumn);
    return out;
  },
};

// ---------------------------------------------------------------- Kenney glass towers (download)

/** City Kit (Commercial) towers: [source, out name, footprint cells, metres across the footprint]. Street face +Z, centred on the cells. */
const TOWERS = [
  ['building-skyscraper-a', 'neon_tower_a', [2, 2], 15.2],
  ['building-skyscraper-b', 'neon_tower_b', [2, 2], 15.2],
  ['building-skyscraper-c', 'neon_tower_c', [2, 2], 15.2],
  ['building-skyscraper-e', 'neon_tower_e', [2, 2], 15.2],
  ['building-a', 'neon_shop_a', [1, 1], 7.4],
  ['building-n', 'neon_block_n', [2, 2], 15.2],
];

/**
 * Where you stand on the roof: at a few points round the middle of the
 * footprint, the highest surface straight below; the lowest of those (rooftop
 * clutter pokes up above it, walk-through).
 */
function roofHeight(doc, across) {
  const tris = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION').getArray();
      const idx = prim.getIndices().getArray();
      const at = (i) => [m[0] * a[i * 3] + m[4] * a[i * 3 + 1] + m[8] * a[i * 3 + 2] + m[12], m[1] * a[i * 3] + m[5] * a[i * 3 + 1] + m[9] * a[i * 3 + 2] + m[13], m[2] * a[i * 3] + m[6] * a[i * 3 + 1] + m[10] * a[i * 3 + 2] + m[14]];
      for (let k = 0; k + 2 < idx.length; k += 3) tris.push([at(idx[k]), at(idx[k + 1]), at(idx[k + 2])]);
    }
  }
  const below = (x, z) => {
    let top = 0;
    for (const [p, q, r] of tris) {
      const d = (q[2] - r[2]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[2] - r[2]);
      if (Math.abs(d) < 1e-9) continue;
      const u = ((q[2] - r[2]) * (x - r[0]) + (r[0] - q[0]) * (z - r[2])) / d;
      const v = ((r[2] - p[2]) * (x - r[0]) + (p[0] - r[0]) * (z - r[2])) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      top = Math.max(top, u * p[1] + v * q[1] + (1 - u - v) * r[1]);
    }
    return top;
  };
  const k = across * 0.18;
  return Math.min(...[[0, 0], [k, k], [-k, k], [k, -k], [-k, -k]].map(([x, z]) => below(x, z)));
}

async function tower([src, out, cells, across]) {
  const path = join(downloadDir('kenney_city-kit-commercial_2.1'), 'Models', 'GLB format', `${src}.glb`);
  const doc = await io.read(path);
  doc.setLogger(quiet);
  const scene = doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  const s = across / Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
  const root = doc.createNode('tower').setScale([s, s, s]).setTranslation([(-(b.min[0] + b.max[0]) / 2) * s, -b.min[1] * s, (-(b.min[2] + b.max[2]) / 2) * s]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);
  for (const mat of doc.getRoot().listMaterials()) {
    // Darkened and cooled for the night city, with the colour map glowing faintly (lit windows read in the dark).
    mat.setMetallicFactor(0).setRoughnessFactor(0.7).setBaseColorFactor([0.42, 0.42, 0.5, 1]);
    const tex = mat.getBaseColorTexture();
    if (tex) {
      tex.setImage(new Uint8Array(await sharp(Buffer.from(tex.getImage())).removeAlpha().png({ compressionLevel: 9, palette: true }).toBuffer())).setMimeType('image/png').setURI('');
      mat.setEmissiveTexture(tex).setEmissiveFactor([0.1, 0.1, 0.14]);
    }
  }
  await doc.transform(weld(), dedup(), prune());
  const roof = Math.round(roofHeight(doc, across) * 100) / 100;
  const height = Math.round((b.max[1] - b.min[1]) * s * 100) / 100;
  doc.getRoot().getAsset().generator = 'tiletrigger prepare-packs';
  const glb = Buffer.from(await io.writeBinary(doc));
  writeFileSync(join(OUT, `${out}.glb`), glb);
  console.log(`${out.padEnd(16)} ${cells.join('×')} cells  height ${height} m  roof ${roof} m`);
  return entry(`packs/${out}.glb`, 'kenney-city-kit-commercial', `${src}.glb`, glb, doc, { cells, height, roof });
}

function downloadDir(folder) {
  const direct = join(downloads, folder);
  if (existsSync(direct)) return direct;
  for (const d of readdirSync(downloads, { withFileTypes: true })) if (d.isDirectory() && existsSync(join(downloads, d.name, folder))) return join(downloads, d.name, folder);
  throw new Error(`${folder} not found in ${downloads}`);
}

function triangles(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  return n;
}

function entry(file, source, src, glb, doc, extra = {}) {
  return { file, source, src, sha256: createHash('sha256').update(glb).digest('hex').slice(0, 16), triangles: triangles(doc), bytes: glb.byteLength, ...extra };
}

// ---------------------------------------------------------------- build

const files = [];
for (const [id, make] of Object.entries(PROPS)) {
  const doc = piecesDocument([make()], 'tiletrigger prepare-packs');
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
}
console.log(`wrote ${Object.keys(PROPS).length} prop sources to assets-src/tiletrigger-stylepacks`);
for (const [set, make] of Object.entries(FACADES)) {
  const doc = piecesDocument(make(), 'tiletrigger prepare-packs');
  await doc.transform(dedup(), prune());
  const glb = Buffer.from(await io.writeBinary(doc));
  writeFileSync(join(OUT, `facades_${set}.glb`), glb);
  files.push(entry(`packs/facades_${set}.glb`, 'tiletrigger-stylepacks', `tools/content/prepare-packs.mjs (${set})`, glb, doc));
  console.log(`facades_${set}.glb ${triangles(doc)} tris ${glb.byteLength} B`);
}
const built = new Map(oldLock.files.map((f) => [f.file, f]));
for (const t of TOWERS) {
  const file = `packs/${t[1]}.glb`;
  if (downloads) files.push(await tower(t));
  else {
    const path = join(ROOT, 'packages/client/public', file);
    if (!existsSync(path)) throw new Error(`${file} is missing; rebuild it with --downloads <dir> (see docs/CONTENT_PIPELINE.md)`);
    const glb = readFileSync(path);
    const old = built.get(file);
    if (old?.sha256 !== createHash('sha256').update(glb).digest('hex').slice(0, 16)) throw new Error(`${file} does not match content/packs.lock.json; rebuild it with --downloads <dir>`);
    files.push(old);
  }
}
writeFileSync(LOCK, `${JSON.stringify({ $comment: 'Generated by tools/content/prepare-packs.mjs. Do not edit by hand.', files }, null, 2)}\n`);
console.log(`wrote content/packs.lock.json (${files.length} files)${downloads ? '' : '; Kenney towers kept as built'}`);
