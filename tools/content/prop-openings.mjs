// The openings audit (docs/CONTENT_PIPELINE.md, "Prop collision"): every placeable prop's collision against its
// model. Collision that fills an opening you can see or walk through (a window, a hole, an arch, a doorway, the space
// under a table or a bridge: closed in by the model, or by the model and the ground) a MIN_OPENING square fits in
// stops rounds in the air and blocks players there (voxel-collision.mjs filledOpenings). Such a prop collides as
// `voxel` (or `frame` / `openings`), or says in its entry why its collision fills the opening (`fills`: a stair
// flight solid underneath so players and bots walk up it, a lattice too fine for its box budget).
//
//   node tools/content/prop-openings.mjs           the list: each prop whose collision fills an opening (id, collide
//                                                   mode, the opening's size, the maps placing it solid) and each
//                                                   `fills` prop with its reason
//   node tools/content/prop-openings.mjs --json    the same as JSON
//   node tools/content/prop-openings.mjs --check   fail (pnpm content:check runs this) on a prop that fills an opening
//                                                   without a `fills` reason, a stale `fills`, a voxel prop over its
//                                                   box budget or not rebuilt, a trunk column off its trunk
//   ONLY=<id>,… limits it to those props.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { loadPropManifest } from './props-manifest.mjs';
import { filledOpenings, sceneTriangles, trunkBoxes, voxelBudget } from './voxel-collision.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TABLE = join(ROOT, 'packages/shared/src/content/props.generated.ts');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** The generated prop table (props.generated.ts), read as data. */
export function propTable() {
  const src = readFileSync(TABLE, 'utf8');
  const body = src.slice(src.indexOf('CORE_PROPS: readonly PropDefinition[] = [') + 'CORE_PROPS: readonly PropDefinition[] = '.length, src.lastIndexOf('];') + 1);
  return new Function(`return ${body}`)();
}

/** Natural rocks collide as two tiers (map/geometry.ts propBoxes): the same here. */
const isRock = (def) => def.category === 'Rocks & Wood' && /rock|boulder|stone|cliff/.test(def.id);

/** A prop's collision as the game builds it (map/geometry.ts propBoxes), in its own space as drawn: boxes, or null. */
export function gameBoxes(def) {
  if (!def.collision) return null;
  if (def.boxes) return def.boxes.map((b) => [...b]);
  const [w, h, d] = def.collision;
  if (isRock(def) && h > 0.3) {
    const low = Math.min(h * 0.5, 0.7);
    return [
      [-(w / 2) * 0.85, 0, -(d / 2) * 0.85, (w / 2) * 0.85, low, (d / 2) * 0.85],
      [-(w / 2) * 0.55, low, -(d / 2) * 0.55, (w / 2) * 0.55, h * 0.92, (d / 2) * 0.55],
    ];
  }
  if (isRock(def)) return null;
  return [[-w / 2, 0, -d / 2, w / 2, h, d / 2]];
}

/** The model's triangles as the game draws it (x mirrored, as the collision boxes are). */
async function drawnTriangles(file) {
  const doc = await io.read(join(ROOT, 'packages/client/public', file));
  return sceneTriangles(doc.getRoot().listScenes()[0]).map((t) => t.map(([x, y, z]) => [-x, y, z]));
}

/** Where each prop is placed solid: { 'prop.id': { map: count } }. */
export function placements() {
  const out = {};
  for (const f of readdirSync(join(ROOT, 'maps')).sort()) {
    if (!f.endsWith('.json')) continue;
    const m = JSON.parse(readFileSync(join(ROOT, 'maps', f), 'utf8'));
    for (const e of m.entities ?? []) {
      if (e.kind !== 'prop' || !e.solid) continue;
      const at = (out[e.model] ??= {});
      at[f.slice(0, -5)] = (at[f.slice(0, -5)] ?? 0) + 1;
    }
  }
  return out;
}

/** The audit: { rows (props whose collision fills an opening, or that say why it does), problems }. */
export async function audit({ only = null } = {}) {
  const manifest = loadPropManifest();
  const entries = new Map(manifest.props.map((p) => [`prop.${p.id}`, p]));
  const used = placements();
  const rows = [];
  const problems = [];
  for (const def of propTable()) {
    const p = entries.get(def.id);
    if (!p || (only && !only.includes(p.id))) continue;
    const boxes = gameBoxes(def);
    if (!boxes) {
      if (p.fills) problems.push(`${p.id}: "fills" but it has no collision`);
      continue;
    }
    const tris = await drawnTriangles(def.file);
    const openings = filledOpenings(tris, boxes);
    const mode = p.collide ?? 'box';
    if (mode === 'voxel') {
      if (!def.boxes) problems.push(`${p.id}: collide "voxel" but props.generated.ts has no boxes for it (run node tools/content/prepare-props.mjs)`);
      else if (def.boxes.length > voxelBudget(p)) problems.push(`${p.id}: ${def.boxes.length} collision boxes, over its budget of ${voxelBudget(p)} (set a coarser voxelCell or a bigger voxelAir, or a voxelBudget with a reason)`);
    }
    if (mode === 'trunk') {
      // The column the build makes now (prepare-props.mjs, trunkBoxes), in the game's frame.
      const want = trunkBoxes(tris.map((t) => t.map(([x, y, z]) => [-x, y, z])), def.size)?.map(([x0, y0, z0, x1, y1, z1]) => [-x1, y0, z0, -x0, y1, z1]) ?? null;
      const same = (a, b) => (!a && !b) || (!!a && !!b && a.length === b.length && a.every((x, i) => x.every((v, k) => Math.abs(v - b[i][k]) < 2e-3)));
      if (!same(want, def.boxes ?? null)) problems.push(`${p.id}: its trunk column is not where the trunk is (run node tools/content/prepare-props.mjs)`);
    }
    if (openings.length && !p.fills) problems.push(`${p.id}: its collision (${mode}) fills an opening ${openings[0].size.join(' × ')} m (along ${openings[0].axis}): collide "voxel", or say why in "fills"`);
    if (!openings.length && p.fills) problems.push(`${p.id}: "fills" but its collision fills no opening now (drop it)`);
    if (openings.length || p.fills) rows.push({ id: p.id, collide: mode, boxes: boxes.length, openings, ...(p.fills ? { fills: p.fills } : {}), maps: used[def.id] ?? {} });
  }
  return { rows, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.env.ONLY?.split(',').filter(Boolean) ?? null;
  const { rows, problems } = await audit({ only });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else if (!process.argv.includes('--check')) {
    for (const r of rows) {
      const o = r.openings[0];
      const maps = Object.entries(r.maps).map(([m, n]) => (n > 1 ? `${m} ×${n}` : m)).join(', ') || 'no map';
      console.log(`${r.id.padEnd(30)} ${r.collide.padEnd(8)} ${o ? `${o.size.join(' × ')} m along ${o.axis}` : 'none'.padEnd(10)}  ${maps}${r.fills ? `\n    fills: ${r.fills}` : ''}`);
    }
    console.log(`${rows.filter((r) => !r.fills).length} props fill an opening, ${rows.filter((r) => r.fills).length} say why`);
  }
  if (problems.length) {
    for (const p of problems) console.error(`ERROR ${p}`);
    if (process.argv.includes('--check')) process.exit(1);
  } else if (process.argv.includes('--check')) console.log(`prop openings: ${rows.length} props fill an opening, every one says why`);
}
