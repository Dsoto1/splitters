// MapMaker Style Packs 03 Imperial Arena (Roman) and 09 Sands of Egypt
// (docs/ROADMAP_V1.md Sprint 7): the props we model ourselves, in code, from
// plain geometry (tools/content/pieces.mjs): columns, braziers, statues, a
// chariot, a lift cage and the like for the arena; an obelisk, a sphinx, a
// seated pharaoh, boats on the Nile, palms and papyrus for Egypt. No pack and
// no generative AI service is involved: the code is the source.
//
//   node tools/content/prepare-ancient.mjs
//
// Writes assets-src/tiletrigger-ancient/<id>.glb (licence "Owned", see the
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
const SRC = join(ROOT, 'assets-src/tiletrigger-ancient');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  marble: { color: hex('#ece6da'), rough: 0.35 },
  marbleShade: { color: hex('#c8c0b0'), rough: 0.4 },
  travertine: { color: hex('#d8c8a6'), rough: 0.8 },
  sandstone: { color: hex('#d9b98a'), rough: 0.85 },
  sandDark: { color: hex('#b8946a'), rough: 0.85 },
  granite: { color: hex('#a8665a'), rough: 0.6 },
  graniteDark: { color: hex('#6e4038'), rough: 0.6 },
  basalt: { color: hex('#2e2c2c'), rough: 0.5 },
  terracotta: { color: hex('#b8603a'), rough: 0.8 },
  bronze: { color: hex('#8a6a3a'), metal: 0.7, rough: 0.4 },
  gold: { color: hex('#d8a83a'), metal: 0.85, rough: 0.3 },
  iron: { color: hex('#3c3836'), metal: 0.6, rough: 0.5 },
  wood: { color: hex('#7a5232'), rough: 0.8 },
  woodDark: { color: hex('#4e3420'), rough: 0.8 },
  red: { color: hex('#9a1e18'), rough: 0.7 },
  purple: { color: hex('#5a1e5a'), rough: 0.7 },
  cream: { color: hex('#e8dcc0'), rough: 0.9 },
  linen: { color: hex('#f0e8d4'), rough: 0.9 },
  lapis: { color: hex('#21409a'), rough: 0.5 },
  turquoise: { color: hex('#2f9a96'), rough: 0.5 },
  ochre: { color: hex('#b24a28'), rough: 0.7 },
  black: { color: hex('#1a1816'), rough: 0.5 },
  leaf: { color: hex('#3e6a24'), rough: 0.8 },
  leafLight: { color: hex('#6a8e30'), rough: 0.8 },
  reed: { color: hex('#a89a50'), rough: 0.9 },
  trunk: { color: hex('#6a5038'), rough: 0.9 },
  water: { color: hex('#3f8fb0'), metal: 0.1, rough: 0.1, alpha: 0.8 },
  coal: { color: hex('#2a1a12'), emissive: glow('#ff5a1a', 0.4) },
  fire: { color: hex('#ff8a2a'), emissive: glow('#ff8a2a') },
  flame: { color: hex('#ffd060'), emissive: glow('#ffd060') },
};
const piece = (name) => new Piece(name, MATS);

/** A double-sided triangle (sails, fronds). */
function sheet(p, mat, a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  const nn = n.map((x) => x / l);
  p.tri(mat, a, b, c, nn);
  p.tri(mat, a, c, b, nn.map((x) => -x));
}

/** A round column shaft with a torus base and a block capital (Roman). */
function column(p, x, z, h, r, mat = 'marble') {
  p.box(mat, [x - r * 1.35, 0, z - r * 1.35], [x + r * 1.35, 0.18, z + r * 1.35]);
  p.cylinder(mat, [x, 0, z], r * 1.2, 0.18, 0.34, { seg: 16, r1: r * 1.05 });
  p.cylinder(mat, [x, 0, z], r, 0.34, h - 0.4, { seg: 16, r1: r * 0.86 });
  p.cylinder(mat, [x, 0, z], r * 0.9, h - 0.4, h - 0.18, { seg: 16, r1: r * 1.15 });
  p.box(mat, [x - r * 1.3, h - 0.18, z - r * 1.3], [x + r * 1.3, h, z + r * 1.3]);
}

/** A flame: a few glowing cones over a bed of coals. */
function flames(p, x, y, z, s = 1) {
  p.cylinder('coal', [x, y, z], 0.32 * s, 0, 0.06 * s, { seg: 10 });
  p.cylinder('fire', [x, y, z], 0.26 * s, 0.05 * s, 0.55 * s, { seg: 7, r1: 0 });
  p.cylinder('fire', [x + 0.12 * s, y, z - 0.06 * s], 0.13 * s, 0.05 * s, 0.4 * s, { seg: 6, r1: 0 });
  p.cylinder('flame', [x - 0.05 * s, y, z + 0.05 * s], 0.14 * s, 0.05 * s, 0.42 * s, { seg: 6, r1: 0 });
}

/** An amphora standing at x, z (0.85 m tall at scale 1). */
function amphora(p, x, z, s = 1, mat = 'terracotta') {
  p.cylinder(mat, [x, 0, z], 0.04 * s, 0, 0.14 * s, { seg: 8, r1: 0.12 * s });
  p.sphere(mat, [x, 0.38 * s, z], 0.2 * s, { rings: 8, seg: 12, squash: 1.35 });
  p.cylinder(mat, [x, 0, z], 0.07 * s, 0.62 * s, 0.82 * s, { seg: 10, r1: 0.06 * s });
  p.ring(mat, [x, 0.82 * s, z], 0.05 * s, 0.09 * s, 0, 0.04 * s, { seg: 10 });
  for (const d of [-1, 1]) p.box(mat, [x + d * 0.07 * s - 0.02 * s, 0.6 * s, z - 0.02 * s], [x + d * 0.16 * s + 0.02 * s, 0.78 * s, z + 0.02 * s]);
}

// ---------------------------------------------------------------- 03 Imperial Arena

/** Each is built in metres, standing on y = 0, facing +Z; prepare-props measures and centres it. */
const PROPS = {
  im_column_ionic() {
    // A free-standing marble column with an Ionic capital: volutes either side.
    const p = piece('im_column_ionic');
    p.box('marble', [-0.6, 0, -0.6], [0.6, 0.25, 0.6]);
    p.cylinder('marble', [0, 0, 0], 0.5, 0.25, 0.42, { seg: 18, r1: 0.44 });
    p.cylinder('marble', [0, 0, 0], 0.4, 0.42, 5.45, { seg: 18, r1: 0.34 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.box('marbleShade', [Math.cos(a) * 0.37 - 0.02, 0.5, Math.sin(a) * 0.37 - 0.02], [Math.cos(a) * 0.37 + 0.02, 5.3, Math.sin(a) * 0.37 + 0.02]);
    }
    p.cylinder('marble', [0, 0, 0], 0.38, 5.45, 5.65, { seg: 18, r1: 0.44 });
    p.box('marble', [-0.5, 5.6, -0.36], [0.5, 5.8, 0.36]);
    for (const x of [-0.5, 0.5]) p.cylinder('marble', [x, 5.62, 0], 0.17, -0.37, 0.37, { seg: 12, axis: 'z' });
    p.box('marble', [-0.6, 5.8, -0.6], [0.6, 6.0, 0.6]);
    return p;
  },
  im_brazier() {
    // A bronze fire bowl on a tripod.
    const p = piece('im_brazier');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      p.cylinder('bronze', [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32], 0.04, 0, 0.95, { seg: 6, r1: 0.03 });
      p.box('bronze', [Math.cos(a) * 0.32 - 0.07, 0, Math.sin(a) * 0.32 - 0.07], [Math.cos(a) * 0.32 + 0.07, 0.06, Math.sin(a) * 0.32 + 0.07]);
    }
    p.ring('bronze', [0, 0.45, 0], 0.26, 0.33, 0, 0.04, { seg: 12 });
    p.cylinder('bronze', [0, 0, 0], 0.2, 0.9, 1.18, { seg: 16, r1: 0.52 });
    p.ring('bronze', [0, 1.18, 0], 0.47, 0.55, 0, 0.05, { seg: 16 });
    flames(p, 0, 1.12, 0, 1.1);
    return p;
  },
  im_statue_emperor() {
    // An emperor in a toga on an inscribed plinth, his right arm held out (adlocutio), a sceptre in his left.
    const p = piece('im_statue_emperor');
    p.box('marbleShade', [-0.7, 0, -0.7], [0.7, 0.2, 0.7]);
    p.box('marble', [-0.6, 0.2, -0.6], [0.6, 1.2, 0.6]);
    p.box('bronze', [-0.45, 0.55, 0.6], [0.45, 0.85, 0.62]);
    p.box('marbleShade', [-0.68, 1.2, -0.68], [0.68, 1.35, 0.68]);
    const y = 1.35;
    p.box('marble', [-0.2, y, -0.12], [-0.03, y + 0.85, 0.12]);
    p.box('marble', [0.03, y, -0.12], [0.2, y + 0.85, 0.12]);
    p.cylinder('marble', [0, y, 0], 0.34, 0.45, 1.25, { seg: 10, r1: 0.3 });
    p.box('marble', [-0.3, y + 0.75, -0.18], [0.3, y + 1.45, 0.18]);
    p.box('marbleShade', [-0.32, y + 0.8, -0.2], [0.05, y + 1.4, 0.2], 0.35);
    p.box('marble', [-0.36, y + 1.38, -0.2], [0.36, y + 1.52, 0.2]);
    p.cylinder('marble', [0, y + 1.52, 0], 0.08, 0, 0.1, { seg: 8 });
    p.sphere('marble', [0, y + 1.75, 0], 0.15, { rings: 8, seg: 10, squash: 1.15 });
    p.ring('leafLight', [0, y + 1.82, 0], 0.13, 0.17, 0, 0.04, { seg: 12 });
    // Right arm out in front, raised a little; left arm down holding the sceptre.
    p.box('marble', [0.3, y + 1.3, -0.07], [0.42, y + 1.44, 0.1]);
    p.cylinder('marble', [0.36, y + 1.38, 0], 0.065, 0.05, 0.62, { seg: 8, axis: 'z' });
    p.box('marble', [-0.42, y + 0.85, -0.07], [-0.3, y + 1.44, 0.07]);
    p.cylinder('bronze', [-0.42, y + 0.2, 0.1], 0.025, 0, 1.6, { seg: 6 });
    p.sphere('gold', [-0.42, y + 1.82, 0.1], 0.06, { rings: 5, seg: 8 });
    return p;
  },
  im_amphorae() {
    // A cluster of wine and oil amphorae round a crate.
    const p = piece('im_amphorae');
    p.box('wood', [-0.3, 0, -0.25], [0.3, 0.45, 0.25]);
    amphora(p, -0.55, 0.15, 1.05);
    amphora(p, 0.55, 0.1, 0.95);
    amphora(p, 0.05, 0.45, 1.0);
    amphora(p, -0.2, -0.5, 0.9, 'cream');
    amphora(p, 0.4, -0.45, 1.0);
    return p;
  },
  im_weapon_rack() {
    // A gladiators' rack: spears, a trident, two scuta and short swords.
    const p = piece('im_weapon_rack');
    for (const x of [-0.9, 0.9]) p.box('wood', [x - 0.06, 0, -0.06], [x + 0.06, 1.9, 0.06]);
    for (const y of [0.25, 1.1, 1.8]) p.box('wood', [-0.95, y, -0.05], [0.95, y + 0.08, 0.05]);
    for (const x of [-0.6, -0.35, -0.1]) {
      p.cylinder('wood', [x, 0.08, 0.12], 0.02, 0, 1.95, { seg: 6 });
      p.cylinder('iron', [x, 0.08, 0.12], 0.035, 1.95, 2.2, { seg: 4, r1: 0 });
    }
    p.cylinder('wood', [0.15, 0.08, 0.12], 0.02, 0, 1.9, { seg: 6 });
    for (const dx of [-0.08, 0, 0.08]) p.cylinder('iron', [0.15 + dx, 1.98, 0.12], 0.015, 0, 0.25, { seg: 4, r1: 0.004 });
    p.box('iron', [0.05, 1.96, 0.1], [0.25, 2.0, 0.14]);
    for (const x of [0.45, 0.72]) {
      p.box('red', [x - 0.24, 0.3, 0.1], [x + 0.24, 1.3, 0.16]);
      p.box('gold', [x - 0.25, 0.78, 0.15], [x + 0.25, 0.82, 0.17]);
      p.sphere('gold', [x, 0.8, 0.17], 0.08, { rings: 4, seg: 8, squash: 0.6 });
    }
    for (const x of [-0.75, -0.55]) {
      p.box('iron', [x - 0.03, 1.22, -0.12], [x + 0.03, 1.72, -0.08]);
      p.box('bronze', [x - 0.08, 1.18, -0.13], [x + 0.08, 1.22, -0.07]);
    }
    return p;
  },
  im_training_post() {
    // A palus: the wooden post gladiators practise their strokes on, a straw target and a shield hung on it.
    const p = piece('im_training_post');
    p.box('woodDark', [-0.4, 0, -0.4], [0.4, 0.15, 0.4]);
    p.cylinder('wood', [0, 0, 0], 0.13, 0.15, 1.9, { seg: 10 });
    p.box('wood', [-0.55, 1.35, -0.06], [0.55, 1.47, 0.06]);
    p.cylinder('reed', [0, 0, 0], 0.2, 0.9, 1.3, { seg: 10 });
    p.sphere('reed', [0, 1.98, 0], 0.16, { rings: 6, seg: 8 });
    p.box('bronze', [0.3, 0.75, 0.1], [0.62, 1.3, 0.14]);
    return p;
  },
  im_aquila() {
    // A legion's eagle standard: a pole topped with a gilded eagle in a wreath, a red SPQR plaque below.
    const p = piece('im_aquila');
    p.box('woodDark', [-0.35, 0, -0.35], [0.35, 0.12, 0.35]);
    p.cylinder('wood', [0, 0, 0], 0.035, 0, 2.5, { seg: 8 });
    p.box('red', [-0.25, 1.65, 0.03], [0.25, 1.95, 0.06]);
    p.box('gold', [-0.27, 1.95, 0.0], [0.27, 1.99, 0.07]);
    p.ring('leafLight', [0, 2.2, 0], 0.13, 0.18, -0.02, 0.04, { seg: 12, axis: 'z' });
    p.box('gold', [-0.1, 2.48, -0.06], [0.1, 2.52, 0.06]);
    p.sphere('gold', [0, 2.62, 0], 0.1, { rings: 6, seg: 8, squash: 1.2 });
    p.sphere('gold', [0, 2.8, 0.05], 0.055, { rings: 5, seg: 8 });
    p.cylinder('gold', [0, 2.79, 0.08], 0.025, 0, 0.08, { seg: 5, r1: 0, axis: 'z' });
    for (const d of [-1, 1]) {
      p.box('gold', [d * 0.08, 2.6, -0.03], [d * 0.34, 2.68, 0.03]);
      p.box('gold', [d * 0.3, 2.66, -0.03], [d * 0.4, 2.92, 0.03]);
    }
    return p;
  },
  im_vexillum() {
    // A cavalry banner: a red cloth with a gold fringe hanging from a crossbar.
    const p = piece('im_vexillum');
    p.box('woodDark', [-0.35, 0, -0.35], [0.35, 0.12, 0.35]);
    p.cylinder('wood', [0, 0, 0], 0.035, 0, 3.0, { seg: 8 });
    p.box('wood', [-0.55, 2.75, -0.03], [0.55, 2.81, 0.03]);
    p.box('red', [-0.5, 1.6, 0.03], [0.5, 2.75, 0.06]);
    p.box('gold', [-0.5, 1.55, 0.03], [0.5, 1.62, 0.07]);
    p.box('gold', [-0.15, 2.05, 0.06], [0.15, 2.35, 0.07]);
    p.cylinder('gold', [0, 3.0, 0], 0.07, 0, 0.18, { seg: 4, r1: 0 });
    return p;
  },
  im_chariot() {
    // A racing chariot: two spoked wheels, a curved red-and-gold car, the pole reaching forward.
    const p = piece('im_chariot');
    for (const x of [-0.72, 0.72]) {
      p.ring('woodDark', [x, 0.62, -0.1], 0.52, 0.62, -0.04, 0.08, { seg: 18, axis: 'x' });
      p.cylinder('bronze', [x, 0.62, -0.1], 0.1, -0.08, 0.08, { seg: 10, axis: 'x' });
      for (let i = 0; i < 4; i++) p.box('wood', [x - 0.03, 0.62 - 0.03, -0.1 - 0.55], [x + 0.03, 0.62 + 0.03, -0.1 + 0.55], (i * Math.PI) / 4);
    }
    p.cylinder('iron', [0, 0.62, -0.1], 0.04, -0.75, 0.75, { seg: 6, axis: 'x' });
    p.box('wood', [-0.62, 0.5, -0.5], [0.62, 0.6, 0.45]);
    p.box('red', [-0.62, 0.6, 0.35], [0.62, 1.35, 0.45]);
    for (const x of [-0.62, 0.62]) p.box('red', [x - 0.05, 0.6, -0.2], [x + 0.05, 1.05, 0.45]);
    p.box('gold', [-0.64, 1.3, 0.33], [0.64, 1.38, 0.47]);
    p.box('gold', [-0.2, 0.8, 0.45], [0.2, 1.15, 0.47]);
    p.box('wood', [-0.05, 0.55, 0.45], [0.05, 0.65, 2.6]);
    p.box('wood', [-0.7, 0.62, 2.45], [0.7, 0.7, 2.55]);
    return p;
  },
  im_lift_cage() {
    // A hypogeum beast cage: an iron-barred box with a timber floor and roof, its gate on the front.
    const p = piece('im_lift_cage');
    p.box('wood', [-1.0, 0, -1.0], [1.0, 0.15, 1.0]);
    p.box('wood', [-1.05, 2.45, -1.05], [1.05, 2.6, 1.05]);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.box('iron', [x - 0.06, 0.15, z - 0.06], [x + 0.06, 2.45, z + 0.06]);
    for (let i = 1; i < 8; i++) {
      const u = -1 + i * 0.25;
      p.box('iron', [u - 0.02, 0.15, -1.02], [u + 0.02, 2.45, -0.98]);
      p.box('iron', [-1.02, 0.15, u - 0.02], [-0.98, 2.45, u + 0.02]);
      p.box('iron', [0.98, 0.15, u - 0.02], [1.02, 2.45, u + 0.02]);
      p.box('iron', [u - 0.02, 0.15, 0.98], [u + 0.02, 2.45, 1.02]);
    }
    for (const y of [0.9, 1.7]) {
      p.box('iron', [-1.02, y, -1.02], [1.02, y + 0.05, -0.98]);
      p.box('iron', [-1.02, y, 0.98], [1.02, y + 0.05, 1.02]);
      p.box('iron', [-1.02, y, -1.02], [-0.98, y + 0.05, 1.02]);
      p.box('iron', [0.98, y, -1.02], [1.02, y + 0.05, 1.02]);
    }
    p.box('iron', [-0.1, 2.6, -0.1], [0.1, 2.8, 0.1]);
    p.ring('iron', [0, 2.9, 0], 0.08, 0.12, -0.02, 0.04, { seg: 10, axis: 'z' });
    return p;
  },
  im_stakes() {
    // A row of sharpened stakes lashed to a log: a barricade at the arena's edge.
    const p = piece('im_stakes');
    p.cylinder('woodDark', [-1.5, 0.2, 0], 0.18, 0, 3.0, { seg: 10, axis: 'x' });
    for (let i = 0; i < 9; i++) {
      const x = -1.35 + i * 0.34;
      const z = i % 2 ? 0.12 : -0.12;
      p.cylinder('wood', [x, 0, z], 0.07, 0, 0.9, { seg: 6 });
      p.cylinder('wood', [x, 0, z], 0.07, 0.9, 1.25, { seg: 6, r1: 0 });
    }
    return p;
  },
  im_altar() {
    // A marble altar with a moulded top and a bronze fire dish.
    const p = piece('im_altar');
    p.box('marbleShade', [-0.55, 0, -0.45], [0.55, 0.15, 0.45]);
    p.box('marble', [-0.45, 0.15, -0.35], [0.45, 0.85, 0.35]);
    p.box('marbleShade', [-0.55, 0.85, -0.45], [0.55, 0.98, 0.45]);
    for (const x of [-0.45, 0.45]) p.cylinder('marble', [x, 0.98, 0], 0.08, -0.45, 0.45, { seg: 10, axis: 'z' });
    p.box('leafLight', [-0.46, 0.55, 0.35], [0.46, 0.6, 0.37]);
    p.cylinder('bronze', [0, 0.98, 0], 0.18, 0, 0.12, { seg: 12, r1: 0.28 });
    flames(p, 0, 1.06, 0, 0.6);
    return p;
  },
  im_bench() {
    // A marble bench on lion's-paw feet.
    const p = piece('im_bench');
    p.box('marble', [-1.1, 0.38, -0.3], [1.1, 0.48, 0.3]);
    for (const x of [-0.9, 0.9]) {
      p.box('marbleShade', [x - 0.12, 0, -0.25], [x + 0.12, 0.38, 0.25]);
      p.sphere('marbleShade', [x, 0.06, 0.24], 0.08, { rings: 4, seg: 8, squash: 0.7 });
    }
    return p;
  },
  im_fountain() {
    // A round fountain: a stone basin of water and a bowl on a pedestal in the middle.
    const p = piece('im_fountain');
    p.ring('travertine', [0, 0, 0], 1.25, 1.45, 0, 0.6, { seg: 24 });
    p.cylinder('travertine', [0, 0, 0], 1.3, 0, 0.12, { seg: 24 });
    p.cylinder('water', [0, 0, 0], 1.26, 0.12, 0.5, { seg: 24 });
    p.cylinder('marble', [0, 0, 0], 0.2, 0, 1.2, { seg: 12 });
    p.cylinder('marble', [0, 0, 0], 0.15, 1.2, 1.45, { seg: 14, r1: 0.6 });
    p.cylinder('water', [0, 0, 0], 0.55, 1.4, 1.46, { seg: 14 });
    p.cylinder('water', [0, 0, 0], 0.06, 1.45, 1.75, { seg: 6, r1: 0.03 });
    return p;
  },
  im_velarium() {
    // An awning on two masts: striped canvas shading a stand, guyed with ropes.
    const p = piece('im_velarium');
    for (const x of [-2.4, 2.4]) {
      p.box('woodDark', [x - 0.25, 0, -0.25], [x + 0.25, 0.15, 0.25]);
      p.cylinder('wood', [x, 0, 0], 0.09, 0.15, 4.4, { seg: 8 });
    }
    for (let i = 0; i < 6; i++) p.box(i % 2 ? 'cream' : 'red', [-2.5 + (i * 5) / 6, 3.9, -1.6], [-2.5 + ((i + 1) * 5) / 6, 3.96, 1.6]);
    p.box('wood', [-2.5, 3.96, -0.04], [2.5, 4.04, 0.04]);
    for (const x of [-2.4, 2.4]) p.cylinder('gold', [x, 4.4, 0], 0.1, 0, 0.18, { seg: 6, r1: 0 });
    return p;
  },
  im_bust() {
    // A marble bust on a fluted pedestal.
    const p = piece('im_bust');
    p.box('marbleShade', [-0.3, 0, -0.3], [0.3, 0.12, 0.3]);
    p.cylinder('marble', [0, 0, 0], 0.18, 0.12, 1.05, { seg: 12, r1: 0.15 });
    p.box('marbleShade', [-0.25, 1.05, -0.25], [0.25, 1.15, 0.25]);
    p.box('marble', [-0.28, 1.15, -0.14], [0.28, 1.38, 0.14]);
    p.cylinder('marble', [0, 1.38, 0], 0.07, 0, 0.1, { seg: 8 });
    p.sphere('marble', [0, 1.58, 0.01], 0.13, { rings: 8, seg: 10, squash: 1.15 });
    p.ring('leafLight', [0, 1.63, 0.01], 0.11, 0.15, 0, 0.03, { seg: 12 });
    return p;
  },
  im_throne() {
    // The emperor's chair: marble with a high back, gilded arms and a purple cushion.
    const p = piece('im_throne');
    p.box('marbleShade', [-0.75, 0, -0.6], [0.75, 0.2, 0.6]);
    p.box('marble', [-0.55, 0.2, -0.4], [0.55, 0.6, 0.4]);
    p.box('purple', [-0.5, 0.6, -0.38], [0.5, 0.72, 0.38]);
    p.box('marble', [-0.6, 0.2, -0.55], [0.6, 1.9, -0.4]);
    p.box('gold', [-0.62, 1.85, -0.57], [0.62, 1.95, -0.38]);
    for (const x of [-0.58, 0.58]) {
      p.box('gold', [x - 0.06, 0.6, -0.4], [x + 0.06, 0.95, 0.4]);
      p.sphere('gold', [x, 0.97, 0.38], 0.07, { rings: 4, seg: 8 });
    }
    p.box('purple', [-0.45, 0.75, -0.42], [0.45, 1.6, -0.38]);
    return p;
  },

  // ---------------------------------------------------------------- 09 Sands of Egypt

  eg_obelisk() {
    // A red granite obelisk on a pedestal, banded with carved signs, its pyramidion gilded.
    const p = piece('eg_obelisk');
    p.box('graniteDark', [-0.9, 0, -0.9], [0.9, 0.6, 0.9]);
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const y0 = 0.6 + (i * 7.4) / segs;
      const y1 = 0.6 + ((i + 1) * 7.4) / segs;
      const r = 0.55 - (i * 0.16) / segs;
      p.box('granite', [-r, y0, -r], [r, y1, r]);
      // A column of signs cut down the middle of each face.
      for (let k = 0; k < 3; k++) {
        const y = y0 + 0.15 + k * ((y1 - y0) / 3);
        p.box('graniteDark', [-0.09, y, r - 0.005], [0.09, y + 0.18, r + 0.01]);
        p.box('graniteDark', [-0.09, y, -r - 0.01], [0.09, y + 0.18, -r + 0.005]);
        p.box('graniteDark', [r - 0.005, y, -0.09], [r + 0.01, y + 0.18, 0.09]);
        p.box('graniteDark', [-r - 0.01, y, -0.09], [-r + 0.005, y + 0.18, 0.09]);
      }
    }
    p.cylinder('gold', [0, 0, 0], 0.55, 8.0, 9.0, { seg: 4, r1: 0 });
    return p;
  },
  eg_sphinx() {
    // A sphinx couchant on a plinth: lion's body, paws forward, a striped nemes headdress and a pharaoh's face.
    const p = piece('eg_sphinx');
    p.box('sandDark', [-1.1, 0, -3.1], [1.1, 0.5, 3.1]);
    const y = 0.5;
    p.box('sandstone', [-0.8, y, -2.9], [0.8, y + 1.0, 0.6]);
    p.box('sandstone', [-0.75, y + 1.0, -2.6], [0.75, y + 1.25, 0.3]);
    for (const x of [-0.85, 0.85]) {
      p.box('sandstone', [x - 0.2, y, -2.8], [x + 0.2, y + 0.75, -1.6]);
      p.box('sandstone', [x - 0.22, y, 0.4], [x + 0.22, y + 0.38, 2.9]);
      p.box('sandDark', [x - 0.24, y, 2.65], [x + 0.24, y + 0.42, 2.95]);
    }
    p.box('sandstone', [-0.7, y, 0.2], [0.7, y + 1.7, 1.2]);
    p.box('sandstone', [-0.18, y + 0.05, -3.05], [0.18, y + 0.25, -2.85]);
    // The head and headdress.
    const hy = y + 1.7;
    p.box('sandstone', [-0.4, hy - 0.1, 0.55], [0.4, hy + 0.85, 1.25]);
    p.box('lapis', [-0.62, hy + 0.2, 0.35], [0.62, hy + 1.0, 1.15]);
    for (let i = 0; i < 5; i++) p.box('gold', [-0.63, hy + 0.25 + i * 0.15, 0.34], [0.63, hy + 0.31 + i * 0.15, 1.16]);
    for (const x of [-0.5, 0.5]) {
      p.box('lapis', [x - 0.13, hy - 0.55, 1.0], [x + 0.13, hy + 0.3, 1.2]);
      for (let i = 0; i < 4; i++) p.box('gold', [x - 0.14, hy - 0.5 + i * 0.2, 1.19], [x + 0.14, hy - 0.45 + i * 0.2, 1.21]);
    }
    p.box('lapis', [-0.55, hy + 0.95, 0.4], [0.55, hy + 1.1, 1.05]);
    p.box('sandstone', [-0.32, hy, 1.2], [0.32, hy + 0.75, 1.32]);
    p.box('sandDark', [-0.2, hy + 0.48, 1.31], [-0.06, hy + 0.54, 1.34]);
    p.box('sandDark', [0.06, hy + 0.48, 1.31], [0.2, hy + 0.54, 1.34]);
    p.box('sandstone', [-0.06, hy + 0.25, 1.31], [0.06, hy + 0.45, 1.4]);
    p.box('sandDark', [-0.1, hy - 0.35, 1.18], [0.1, hy + 0.05, 1.3]);
    p.box('gold', [-0.05, hy + 0.85, 1.15], [0.05, hy + 1.15, 1.3]);
    p.cylinder('sandstone', [0.7, y + 0.15, -2.9], 0.07, 0, 2.2, { seg: 6, axis: 'z' });
    return p;
  },
  eg_statue_pharaoh() {
    // A seated colossus: the king enthroned, hands on his knees, in the double crown.
    const p = piece('eg_statue_pharaoh');
    p.box('sandDark', [-1.2, 0, -1.4], [1.2, 0.4, 1.6]);
    p.box('sandstone', [-1.0, 0.4, -1.3], [1.0, 2.4, 0.4]);
    for (let i = 0; i < 4; i++) p.box('lapis', [1.0, 0.7 + i * 0.4, -1.1], [1.02, 0.85 + i * 0.4, 0.2]);
    for (const x of [-0.35, 0.35]) {
      p.box('sandstone', [x - 0.25, 0.4, 0.4], [x + 0.25, 2.0, 1.35]);
      p.box('sandstone', [x - 0.25, 0.4, 1.15], [x + 0.25, 0.55, 1.55]);
      p.box('sandstone', [x - 0.25, 2.0, -0.4], [x + 0.25, 2.5, 1.35]);
      p.box('sandstone', [x - 0.2, 2.5, 0.85], [x + 0.2, 2.62, 1.3]);
    }
    p.box('linen', [-0.6, 2.4, -0.5], [0.6, 2.7, 0.6]);
    p.box('sandstone', [-0.55, 2.7, -0.45], [0.55, 4.1, 0.3]);
    for (const x of [-0.72, 0.72]) {
      p.box('sandstone', [x - 0.16, 2.8, -0.3], [x + 0.16, 3.95, 0.2]);
      p.box('sandstone', [x - 0.15, 2.5, 0.2], [x + 0.15, 2.8, 1.1]);
    }
    p.box('turquoise', [-0.58, 3.7, -0.3], [0.58, 3.95, 0.33]);
    p.box('sandstone', [-0.3, 4.1, -0.3], [0.3, 4.8, 0.28]);
    p.box('lapis', [-0.48, 4.3, -0.4], [0.48, 4.95, 0.2]);
    for (const x of [-0.38, 0.38]) p.box('lapis', [x - 0.1, 3.75, 0.12], [x + 0.1, 4.6, 0.3]);
    p.box('sandDark', [-0.08, 3.75, 0.25], [0.08, 4.12, 0.34]);
    p.cylinder('linen', [0, 4.95, -0.05], 0.3, 0, 0.75, { seg: 10, r1: 0.18 });
    p.sphere('linen', [0, 5.72, -0.05], 0.14, { rings: 5, seg: 8 });
    p.box('ochre', [-0.4, 4.95, -0.42], [0.4, 5.25, 0.3]);
    return p;
  },
  eg_anubis() {
    // Anubis as a black jackal lying watchful on a gilded shrine chest.
    const p = piece('eg_anubis');
    p.box('gold', [-0.45, 0, -0.8], [0.45, 0.12, 0.8]);
    p.box('black', [-0.4, 0.12, -0.75], [0.4, 0.75, 0.75]);
    for (let i = 0; i < 3; i++) p.box('gold', [-0.41, 0.25 + i * 0.18, -0.76], [0.41, 0.3 + i * 0.18, 0.76]);
    p.box('gold', [-0.45, 0.75, -0.8], [0.45, 0.8, 0.8]);
    p.box('black', [-0.22, 0.8, -0.6], [0.22, 1.1, 0.35]);
    for (const x of [-0.13, 0.13]) p.box('black', [x - 0.06, 0.8, 0.3], [x + 0.06, 0.88, 0.75]);
    p.box('black', [-0.13, 1.0, 0.25], [0.13, 1.35, 0.45]);
    p.box('gold', [-0.15, 1.05, 0.24], [0.15, 1.12, 0.46]);
    p.box('black', [-0.12, 1.3, 0.3], [0.12, 1.52, 0.55]);
    p.box('black', [-0.05, 1.33, 0.55], [0.05, 1.43, 0.78]);
    for (const x of [-0.08, 0.08]) p.cylinder('black', [x, 1.5, 0.38], 0.05, 0, 0.26, { seg: 4, r1: 0 });
    p.cylinder('black', [0, 0.85, -0.6], 0.04, 0, 0.12, { seg: 6, axis: 'z', r1: 0.03 });
    return p;
  },
  eg_sarcophagus() {
    // A stone coffin with a gilded anthropoid lid: the mask, the crossed arms, blue bands.
    const p = piece('eg_sarcophagus');
    p.box('graniteDark', [-0.6, 0, -1.25], [0.6, 0.7, 1.25]);
    p.box('gold', [-0.55, 0.7, -1.2], [0.55, 0.85, 1.2]);
    p.box('gold', [-0.45, 0.85, -1.15], [0.45, 0.98, 0.7]);
    p.sphere('gold', [0, 0.9, 0.85], 0.32, { rings: 6, seg: 10, squash: 0.45 });
    p.box('lapis', [-0.36, 0.95, 0.68], [0.36, 1.08, 0.95]);
    p.box('gold', [-0.18, 0.98, 0.78], [0.18, 1.12, 1.02]);
    for (const z of [-0.8, -0.4, 0.0]) p.box('lapis', [-0.46, 0.97, z], [0.46, 1.0, z + 0.12]);
    p.box('turquoise', [-0.3, 0.99, 0.3], [0.3, 1.03, 0.4], 0.5);
    p.box('turquoise', [-0.3, 0.99, 0.3], [0.3, 1.03, 0.4], -0.5);
    return p;
  },
  eg_canopic_jars() {
    // Four canopic jars with the heads of the sons of Horus, on a little chest.
    const p = piece('eg_canopic_jars');
    p.box('wood', [-0.5, 0, -0.5], [0.5, 0.18, 0.5]);
    p.box('gold', [-0.51, 0.16, -0.51], [0.51, 0.2, 0.51]);
    const heads = ['linen', 'ochre', 'black', 'turquoise'];
    [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(([x, z], i) => {
      p.cylinder('travertine', [x, 0.2, z], 0.12, 0, 0.38, { seg: 10, r1: 0.15 });
      p.sphere(heads[i], [x, 0.66, z], 0.12, { rings: 5, seg: 8 });
    });
    return p;
  },
  eg_column_papyrus() {
    // A papyrus-bundle column: painted bands round the shaft, an open papyrus capital.
    const p = piece('eg_column_papyrus');
    p.cylinder('sandDark', [0, 0, 0], 0.8, 0, 0.3, { seg: 18 });
    p.cylinder('sandstone', [0, 0, 0], 0.5, 0.3, 5.6, { seg: 12, r1: 0.44 });
    for (const [y, mat] of [[1.2, 'lapis'], [1.45, 'ochre'], [4.6, 'lapis'], [4.85, 'turquoise'], [5.1, 'ochre']]) p.ring(mat, [0, y, 0], 0.44, 0.52, 0, 0.12, { seg: 12 });
    p.cylinder('turquoise', [0, 0, 0], 0.44, 5.6, 6.5, { seg: 12, r1: 0.9 });
    p.cylinder('sandstone', [0, 0, 0], 0.9, 6.5, 6.65, { seg: 12 });
    p.box('sandDark', [-0.6, 6.65, -0.6], [0.6, 7.0, 0.6]);
    return p;
  },
  eg_felucca() {
    // A Nile sailing boat: a wooden hull with raised ends, a mast and a lateen sail.
    const p = piece('eg_felucca');
    p.box('wood', [-0.85, 0, -2.2], [0.85, 0.75, 2.2]);
    p.box('woodDark', [-0.88, 0.65, -2.2], [0.88, 0.8, 2.2]);
    for (const d of [-1, 1]) {
      p.box('wood', [-0.55, 0.1, d * 2.2 - (d < 0 ? 1.1 : 0)], [0.55, 0.85, d * 2.2 + (d > 0 ? 1.1 : 0)]);
      p.box('wood', [-0.25, 0.3, d * 3.3 - (d < 0 ? 0.5 : 0)], [0.25, 1.15, d * 3.3 + (d > 0 ? 0.5 : 0)]);
    }
    p.box('woodDark', [-0.8, 0.55, -2.1], [0.8, 0.6, 2.1]);
    p.cylinder('wood', [0, 0.6, 1.0], 0.07, 0, 6.6, { seg: 8 });
    // The sail: a big triangle from low at the bow to the top of the yard behind the mast.
    sheet(p, 'linen', [0, 1.4, 3.2], [0, 7.4, -2.6], [0, 1.4, -1.4]);
    p.cylinder('woodDark', [0, 1.35, -1.6], 0.04, 0, 4.9, { seg: 6, axis: 'z' });
    return p;
  },
  eg_reed_boat() {
    // A papyrus-reed skiff: bundles lashed together, the ends curling up.
    const p = piece('eg_reed_boat');
    for (let i = 0; i < 9; i++) {
      const z0 = -2.25 + i * 0.5;
      const r = 0.42 - Math.abs(i - 4) * 0.06;
      p.cylinder('reed', [0, 0.35, z0], r, 0, 0.5, { seg: 10, axis: 'z' });
      p.ring('woodDark', [0, 0.35, z0 + 0.25], r, r + 0.03, -0.02, 0.04, { seg: 10, axis: 'z' });
    }
    for (const d of [-1, 1]) p.cylinder('reed', [0, 0.35, d * 2.4], 0.13, 0, 1.0, { seg: 8, r1: 0.06 });
    p.box('wood', [-0.25, 0.65, -0.5], [0.25, 0.72, 0.5]);
    return p;
  },
  eg_palm() {
    // A date palm: a ringed trunk leaning a little, a crown of drooping fronds, clusters of dates.
    const p = piece('eg_palm');
    const H = 7.0;
    for (let i = 0; i < 10; i++) {
      const y0 = (i * H) / 10;
      const lean = (i / 10) ** 2 * 0.6;
      p.cylinder('trunk', [lean, y0, 0], 0.22 - i * 0.008, 0, H / 10 + 0.02, { seg: 8, r1: 0.2 - i * 0.008 });
    }
    const top = [0.6, H, 0];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      const mid = [top[0] + c * 1.5, H + 0.5, top[2] + s * 1.5];
      const tip = [top[0] + c * 3.0, H - 0.9, top[2] + s * 3.0];
      const side = [-s * 0.45, 0, c * 0.45];
      sheet(p, k % 2 ? 'leaf' : 'leafLight', top, [mid[0] + side[0], mid[1], mid[2] + side[2]], [mid[0] - side[0], mid[1], mid[2] - side[2]]);
      sheet(p, k % 2 ? 'leaf' : 'leafLight', tip, [mid[0] - side[0], mid[1], mid[2] - side[2]], [mid[0] + side[0], mid[1], mid[2] + side[2]]);
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      p.sphere('ochre', [top[0] + Math.cos(a) * 0.35, H - 0.35, Math.sin(a) * 0.35], 0.18, { rings: 4, seg: 6, squash: 1.4 });
    }
    return p;
  },
  eg_papyrus() {
    // A clump of papyrus: tall stems with feathery umbels.
    const p = piece('eg_papyrus');
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = 0.12 + (i % 3) * 0.14;
      const [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
      const h = 1.3 + ((i * 7) % 5) * 0.12;
      p.cylinder('leaf', [x, 0, z], 0.022, 0, h, { seg: 4 });
      p.cylinder('leafLight', [x, h - 0.02, z], 0.02, 0, 0.3, { seg: 6, r1: 0.2 });
    }
    p.cylinder('leaf', [0, 0, 0], 0.32, 0, 0.12, { seg: 8, r1: 0.25 });
    return p;
  },
  eg_torch() {
    // A tall fire stand: a papyrus-topped pole and a burning bowl.
    const p = piece('eg_torch');
    p.box('sandDark', [-0.28, 0, -0.28], [0.28, 0.2, 0.28]);
    p.cylinder('wood', [0, 0, 0], 0.07, 0.2, 1.75, { seg: 8 });
    for (const y of [0.6, 1.2]) p.ring('gold', [0, y, 0], 0.07, 0.1, 0, 0.06, { seg: 8 });
    p.cylinder('gold', [0, 0, 0], 0.08, 1.75, 2.0, { seg: 12, r1: 0.32 });
    flames(p, 0, 1.95, 0, 0.75);
    return p;
  },
  eg_chest() {
    // A gilded chest on carrying poles, heaped with gold.
    const p = piece('eg_chest');
    p.box('wood', [-0.55, 0.1, -0.38], [0.55, 0.65, 0.38]);
    for (const [x, z] of [[-0.5, -0.33], [0.5, -0.33], [0.5, 0.33], [-0.5, 0.33]]) p.box('gold', [x - 0.05, 0, z - 0.05], [x + 0.05, 0.12, z + 0.05]);
    p.box('gold', [-0.57, 0.6, -0.4], [0.57, 0.72, 0.4]);
    p.box('lapis', [-0.4, 0.25, 0.38], [0.4, 0.5, 0.4]);
    for (const z of [-0.25, 0.25]) p.cylinder('woodDark', [-1.0, 0.3, z], 0.035, 0, 2.0, { seg: 6, axis: 'x' });
    for (let i = 0; i < 7; i++) p.sphere('gold', [-0.35 + (i % 4) * 0.22, 0.75 + (i > 3 ? 0.08 : 0), -0.15 + (i % 3) * 0.14], 0.1, { rings: 4, seg: 6, squash: 0.5 });
    return p;
  },
  eg_stele() {
    // A round-topped stele: an inscribed slab on a base.
    const p = piece('eg_stele');
    p.box('sandDark', [-0.7, 0, -0.35], [0.7, 0.3, 0.35]);
    p.box('travertine', [-0.55, 0.3, -0.15], [0.55, 1.9, 0.15]);
    p.cylinder('travertine', [0, 1.9, -0.15], 0.55, 0, 0.3, { seg: 16, axis: 'z' });
    p.sphere('gold', [0, 2.05, 0.15], 0.14, { rings: 4, seg: 8, squash: 0.3 });
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) p.box(r % 2 ? 'lapis' : 'ochre', [-0.4 + c * 0.22, 0.5 + r * 0.22, 0.15], [-0.28 + c * 0.22, 0.62 + r * 0.22, 0.17]);
    p.box('ochre', [-0.5, 1.82, 0.15], [0.5, 1.86, 0.17]);
    return p;
  },
  eg_cat_statue() {
    // Bastet: a black cat sitting upright, a gold ring in her ear.
    const p = piece('eg_cat_statue');
    p.box('sandDark', [-0.3, 0, -0.35], [0.3, 0.18, 0.35]);
    p.cylinder('black', [0, 0.18, -0.05], 0.22, 0, 0.6, { seg: 10, r1: 0.12 });
    p.sphere('black', [0, 0.32, 0.0], 0.2, { rings: 6, seg: 8, squash: 0.8 });
    for (const x of [-0.08, 0.08]) p.box('black', [x - 0.03, 0.18, 0.08], [x + 0.03, 0.62, 0.16]);
    p.sphere('black', [0, 0.9, 0.0], 0.13, { rings: 6, seg: 8 });
    p.box('black', [-0.04, 0.84, 0.1], [0.04, 0.9, 0.17]);
    for (const x of [-0.07, 0.07]) p.cylinder('black', [x, 0.98, -0.01], 0.045, 0, 0.14, { seg: 4, r1: 0 });
    p.ring('gold', [0.11, 0.9, 0], 0.025, 0.04, -0.01, 0.02, { seg: 8, axis: 'z' });
    p.ring('gold', [0, 0.72, 0], 0.11, 0.135, 0, 0.03, { seg: 10 });
    p.cylinder('black', [0.18, 0.2, -0.3], 0.03, 0, 0.5, { seg: 5, axis: 'z' });
    return p;
  },
};

// ---------------------------------------------------------------- build

for (const [id, make] of Object.entries(PROPS)) {
  const doc = piecesDocument([make()], 'tiletrigger prepare-ancient');
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
}
console.log(`wrote ${Object.keys(PROPS).length} prop sources to assets-src/tiletrigger-ancient`);
