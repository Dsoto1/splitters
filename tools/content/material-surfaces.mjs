#!/usr/bin/env node
// Surface types for library materials (docs/CONTENT_PIPELINE.md, "Surface types"; owner 2026-11-22, footsteps by surface):
//   node tools/content/material-surfaces.mjs           what each material without a `surface` would get, and what it can't place
//   node tools/content/material-surfaces.mjs --write   writes those `surface`s into content/materials.json
// A material's surface is derived from its id and name (words, in RULES order) and then its category (CATEGORY). It
// sets the material's footsteps and its impact's look and sound. It must not change what the server does to a round:
// where the type's ballistic class differs from the one the material has today (packages/shared/test/fixtures/
// surface-classes-before.json, the class every material had before surface types; the surface-types test holds the
// library to it), the material keeps today's class as its `ballistic`. A material that already names a surface is
// left alone (the Workbench's Materials table edits them by hand). Then run `node tools/content/materials.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = join(ROOT, 'content/materials.json');
const BEFORE = join(ROOT, 'packages/shared/test/fixtures/surface-classes-before.json');
const TYPES = join(ROOT, 'content/surface-types.json');

/** Words in a material's id or name (each matched at the start of a word: `ice` is not in lattice) and the surface they mean; the first rule that matches wins. */
export const RULES = [
  [['glass_facade', 'glass facade'], 'glass'],
  [['hieroglyph', 'carved', 'relief', 'slate', 'roof'], 'stone'],
  [['lighthouse'], 'plaster'],
  [['snow'], 'snow'],
  [['ice', 'glacier'], 'ice'],
  [['lava', 'frozen_rock', 'jungle_rock', 'pbr_rock', 'layered rock', 'mossy rock'], 'rock'],
  [['sandbag'], 'fabric'],
  [['sandstone'], 'stone'],
  [['gravel', 'shingle'], 'gravel'],
  [['sand', 'sea_bed'], 'sand'],
  [['grass', 'moss '], 'grass'],
  [['dirt', 'mud', 'forest', 'root', 'dusty_road', 'adobe'], 'dirt'],
  [['asphalt', 'parking', 'tactile', 'bunker', 'concrete', 'proto_'], 'concrete'],
  [['crate', 'board', 'floorboard', 'siding', 'clapboard', 'decking', 'wattle', 'mashrabiya', 'lattice'], 'thin_wood'],
  [['wood', 'plank', 'oak', 'cedar', 'walnut', 'timber', 'beam'], 'wood'],
  [['corrugated', 'prefab', 'white_panel'], 'sheet_metal'],
  [['steel', 'metal', 'iron', 'grate', 'grating', 'walkway', 'tread', 'brass', 'gold', 'hazard', 'scifi', 'orbital', 'circuit', 'tech'], 'metal'],
  [['light', 'glow', 'neon', 'beacon', 'lamp'], 'plastic'],
  [['brick', 'opus'], 'brick'],
  [['plaster', 'stucco', 'whitewash', 'render', 'paint', 'wallpaper', 'lapis', 'bands'], 'plaster'],
  [['carpet', 'canvas', 'rug', 'canopy', 'burlap', 'thatch'], 'fabric'],
  [['marble', 'cobble', 'setts', 'granite', 'ashlar', 'limestone', 'travertine', 'onyx', 'flagstone', 'slate', 'paving', 'carved', 'relief', 'hieroglyph', 'temple', 'stone', 'rubble', 'tile', 'mosaic', 'zellige', 'terrazzo', 'checker', 'inlay', 'delft'], 'stone'],
];

/** A material's category when no word placed it. */
export const CATEGORY = { Wood: 'wood', Metal: 'metal', Brick: 'brick', Stone: 'stone', Tile: 'stone', Fabric: 'fabric', Paint: 'plaster', Ground: 'dirt', Prototype: 'concrete' };

/** The surface a material gets from its words, else its category; null when neither places it. */
export function deriveSurface(m) {
  const text = `${m.id.replace(/^core\./, '')} ${m.displayName ?? ''}`.toLowerCase();
  for (const [words, surface] of RULES) if (words.some((w) => new RegExp(`(^|[^a-z])${w}`).test(text))) return surface;
  return CATEGORY[m.category] ?? null;
}

function main() {
  const write = process.argv.includes('--write');
  const text = readFileSync(FILE, 'utf8');
  const doc = JSON.parse(text);
  const before = JSON.parse(readFileSync(BEFORE, 'utf8')).materials;
  const classOf = Object.fromEntries(JSON.parse(readFileSync(TYPES, 'utf8')).types.map((t) => [t.id, t.ballistic]));
  const set = new Map();
  const unplaced = [];
  for (const m of doc.materials) {
    if (m.surface) continue;
    const surface = deriveSurface(m);
    if (!surface) {
      unplaced.push(m.id);
      continue;
    }
    const today = m.ballistic ?? before[m.id]?.ballistic;
    if (!today) throw new Error(`${m.id}: not in ${BEFORE}; enter its class there first (as the surface-types test says)`);
    set.set(m.id, { surface, ...(classOf[surface] !== today && !m.ballistic ? { ballistic: today } : {}) });
  }
  for (const [id, s] of set) console.log(`${id.padEnd(30)} ${s.surface.padEnd(12)} ${s.ballistic ? `(keeps class ${s.ballistic})` : ''}`);
  console.log(`${set.size} of ${doc.materials.length} materials get a surface; ${doc.materials.filter((m) => m.surface).length} had one${unplaced.length ? `; not placed: ${unplaced.join(', ')}` : ''}`);
  if (!write) return;
  // One material a line: the fields go in after its category, keeping the file's layout.
  const out = text.replace(/^(\s*\{ ?"id": "([^"]+)", .*?"category": "[^"]*",)/gm, (line, head, id) => {
    const s = set.get(id);
    if (!s || !doc.materials.some((m) => m.id === id)) return line;
    return `${head} "surface": "${s.surface}",${s.ballistic ? ` "ballistic": "${s.ballistic}",` : ''}`;
  });
  const check = JSON.parse(out);
  const missing = check.materials.filter((m) => set.has(m.id) && m.surface !== set.get(m.id).surface).map((m) => m.id);
  if (missing.length) throw new Error(`couldn't write: ${missing.join(', ')}`);
  writeFileSync(FILE, out);
  console.log(`wrote ${set.size} surfaces to content/materials.json (now run node tools/content/materials.mjs)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
