// Library materials as data (docs/CONTENT_SCALABILITY.md step 6; how to add one: docs/CONTENT_PIPELINE.md,
// "Materials and themes").
//
//   node tools/content/materials.mjs           check the content and write the generated file
//   node tools/content/materials.mjs --check   check the content, and that the generated file is up to date
//
// Reads content/materials.json: every library surface material in MapMaker's palette order (a procedural pattern in
// two colours, or a scanned texture set; repeat size, shine, glow), the themes (each surface slot's default material
// and tint, the sky colour) and the tint swatches. Checks the schema (unknown fields are errors) and the references
// (patterns and categories are the lists in map/materials.ts; texture sets are in content/textures.json and their
// files are under packages/client/public/textures; themes name real materials; every material and theme the maps,
// the Style Packs and the code name exists), then writes packages/shared/src/content/materials.generated.ts.
// Materials and themes have no network code: maps store them as their id, so the id is what never changes.
// Behaviour and rendering stay in code: the pattern painters (client/materials/patterns.ts), the Babylon materials
// (client/mapMeshes.ts), the ballistic class (sim/gunplay.ts materialClass) and the terrain layers (map/terrain.ts).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, comments, shape, sq, tsInline } from './weapons.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = 'content/materials.json';
const GENERATED = 'packages/shared/src/content/materials.generated.ts';
const MATERIALS_TS = 'packages/shared/src/map/materials.ts';
const TEXTURES = 'packages/client/public/textures';

const { num, str, bool, en, obj, notes } = shape;

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

/** An `export const NAME = [...] as const` list from TypeScript, comments stripped (one source for the enums). */
export function tsList(root, file, name) {
  const src = readFileSync(join(root, file), 'utf8');
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`));
  if (!m) throw new Error(`${file}: ${name} not found`);
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

export function load(root = ROOT) {
  return { materials: readJson(root, FILE) };
}

const COLOUR = /^#[0-9a-f]{6}$/;
const ID = /^core\.[a-z][a-z0-9_]*$/;

/** Material and theme ids named outside the table: maps, Style Packs, code. [kind, id, where]. */
function namedElsewhere(root) {
  const named = [];
  const maps = join(root, 'maps');
  if (existsSync(maps)) {
    for (const f of readdirSync(maps).filter((x) => x.endsWith('.json')).sort()) {
      const text = readFileSync(join(maps, f), 'utf8');
      for (const m of text.matchAll(/"material":\s*"([^"]+)"/g)) named.push(['material', m[1], `maps/${f}`]);
      for (const m of text.matchAll(/"theme":\s*"([^"]+)"/g)) named.push(['theme', m[1], `maps/${f}`]);
    }
  }
  const packs = 'packages/shared/src/editor/stylePacks.ts';
  const packSrc = readFileSync(join(root, packs), 'utf8');
  for (const [kind, field] of [['theme', 'themes'], ['material', 'materials']]) {
    for (const m of packSrc.matchAll(new RegExp(`\\b${field}:\\s*\\[([^\\]]*)\\]`, 'g'))) {
      for (const id of m[1].replace(/\/\/[^\n]*/g, '').matchAll(/'([^']+)'/g)) named.push([kind, id[1], packs]);
    }
  }
  // Code that names a library material (MapMaker's block presets, path looks, Style Pack facades, terrain layers).
  const terrain = 'packages/shared/src/map/terrain.ts';
  const layers = readFileSync(join(root, terrain), 'utf8').match(/TERRAIN_SURFACES[^=]*=\s*\{([^}]*)\}/);
  for (const id of layers?.[1].matchAll(/'(core\.[^']+)'/g) ?? []) named.push(['material', id[1], terrain]);
  for (const dir of ['packages/shared/src', 'packages/client/src']) {
    const walk = (rel) => {
      for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
        const p = `${rel}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.generated.ts')) {
          for (const m of readFileSync(join(root, p), 'utf8').matchAll(/\b(?:material|surface|skin)\s*:\s*'(core\.[a-z0-9_]+)'/g)) named.push(['material', m[1], p]);
        }
      }
    };
    if (existsSync(join(root, dir))) walk(dir);
  }
  return named;
}

/** Check everything and build the tables: { problems, out: { materials, themes, tints } }. */
export function build(content, root = ROOT) {
  const problems = [];
  const patterns = tsList(root, MATERIALS_TS, 'PATTERN_IDS');
  const categories = tsList(root, MATERIALS_TS, 'MATERIAL_CATEGORIES');
  // A theme gives every slot a default but the roof (an unpainted roof looks like the room's floor).
  const slots = tsList(root, MATERIALS_TS, 'SURFACE_SLOTS').filter((s) => s !== 'roof');
  const textureSets = new Set(readJson(root, 'content/textures.json').textures);

  const material = obj({
    id: str, displayName: str, category: en(categories), 'pattern?': en(patterns), 'texture?': str, base: str, 'accent?': str,
    scale: num, shine: num, 'emissive?': bool, 'notes?': notes,
  });
  const style = obj({ material: str, 'tint?': str });
  const theme = obj({ id: str, displayName: str, sky: str, slots: obj(Object.fromEntries(slots.map((s) => [s, style]))), 'notes?': notes });

  const top = content.materials;
  for (const k of Object.keys(top ?? {})) if (!['$comment', 'materials', 'themes', 'tintSwatches'].includes(k)) problems.push(`${FILE}: unknown field "${k}"`);
  for (const k of ['materials', 'themes', 'tintSwatches']) if (!Array.isArray(top?.[k]) || !top[k].length) problems.push(`${FILE}: "${k}" must be a list of at least 1`);
  const colour = (v, where) => !COLOUR.test(v) && problems.push(`${where}: ${JSON.stringify(v)} is not a #rrggbb colour (lower case)`);

  const materials = [];
  const ids = new Set();
  for (const [i, m] of (Array.isArray(top?.materials) ? top.materials : []).entries()) {
    const where = `${FILE}: materials[${i}] (${m?.id})`;
    const bad = check(m, material, where);
    problems.push(...bad);
    if (bad.length) continue;
    if (!ID.test(m.id)) problems.push(`${where}: id must be core. then lower case letters, digits and _`);
    if (ids.has(m.id)) problems.push(`${where}: id ${m.id} is listed twice`);
    ids.add(m.id);
    colour(m.base, `${where}: base`);
    if (m.texture !== undefined) {
      // A scanned set draws its photo: no pattern or accent (resolved as plain, accent = base, for minimaps and icons).
      if (m.pattern !== undefined || m.accent !== undefined) problems.push(`${where}: a texture material has no "pattern" or "accent" (its photo is the pattern)`);
      if (!textureSets.has(m.texture)) problems.push(`${where}: texture ${m.texture} is not in content/textures.json`);
      const maps = ['color', 'normal', ...(m.emissive ? ['emission'] : [])];
      for (const map of maps) if (!existsSync(join(root, TEXTURES, `${m.texture}_${map}.jpg`))) problems.push(`${where}: ${TEXTURES}/${m.texture}_${map}.jpg not found`);
    } else {
      if (m.pattern === undefined) problems.push(`${where}: "pattern" is missing (or give a scanned "texture")`);
      if (m.accent === undefined) problems.push(`${where}: "accent" is missing`);
      else colour(m.accent, `${where}: accent`);
    }
    if (!(m.scale > 0)) problems.push(`${where}: scale must be above 0 (metres a repeat covers)`);
    if (!(m.shine >= 0 && m.shine <= 1)) problems.push(`${where}: shine must be 0-1`);
    // The resolved definition, in the hand-written table's key order.
    const def = {
      id: m.id, displayName: m.displayName, category: m.category, pattern: m.pattern ?? 'plain', base: m.base, accent: m.accent ?? m.base,
      scale: m.scale, shine: m.shine, ...(m.emissive ? { emissive: true } : {}), ...(m.texture !== undefined ? { texture: m.texture } : {}),
    };
    materials.push({ def, notes: m.notes });
  }

  const themes = [];
  const themeIds = new Set();
  for (const [i, t] of (Array.isArray(top?.themes) ? top.themes : []).entries()) {
    const where = `${FILE}: themes[${i}] (${t?.id})`;
    const bad = check(t, theme, where);
    problems.push(...bad);
    if (bad.length) continue;
    if (!ID.test(t.id)) problems.push(`${where}: id must be core. then lower case letters, digits and _`);
    if (themeIds.has(t.id)) problems.push(`${where}: id ${t.id} is listed twice`);
    themeIds.add(t.id);
    colour(t.sky, `${where}: sky`);
    const out = {};
    for (const s of slots) {
      const st = t.slots[s];
      if (!ids.has(st.material) && materials.length === top.materials.length) problems.push(`${where}: slots.${s} names material ${st.material}, which isn't in ${FILE}`);
      if (st.tint !== undefined) colour(st.tint, `${where}: slots.${s}.tint`);
      out[s] = st.tint !== undefined ? { material: st.material, tint: st.tint } : { material: st.material };
    }
    themes.push({ def: { id: t.id, displayName: t.displayName, sky: t.sky, slots: out }, notes: t.notes });
  }
  if (themes.length && !themeIds.has('core.prototype')) problems.push(`${FILE}: themes must keep core.prototype (the fallback theme: map/surfaces.ts)`);

  const tints = Array.isArray(top?.tintSwatches) ? top.tintSwatches : [];
  const seen = new Set();
  for (const [i, c] of tints.entries()) {
    colour(c, `${FILE}: tintSwatches[${i}]`);
    if (seen.has(c)) problems.push(`${FILE}: tintSwatches[${i}]: ${c} is listed twice`);
    seen.add(c);
  }

  // Maps, Style Packs and code name materials and themes by id: one they use can't be renamed or removed.
  if (materials.length === (top?.materials ?? []).length && themes.length === (top?.themes ?? []).length) {
    const once = new Set();
    for (const [kind, id, where] of namedElsewhere(root)) {
      if (once.has(`${kind} ${id} ${where}`)) continue;
      once.add(`${kind} ${id} ${where}`);
      if (kind === 'material' && !ids.has(id)) problems.push(`${where}: names material ${id}, which isn't in ${FILE} (a material id never changes)`);
      if (kind === 'theme' && !themeIds.has(id)) problems.push(`${where}: names theme ${id}, which isn't in ${FILE} (a theme id never changes)`);
    }
  }
  return { problems, out: { materials, themes, tints } };
}

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/materials.mjs from content/materials.json. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/materials.mjs`.');
  L.push("import type { MaterialDefinition, ThemeDefinition } from '../map/materials.ts';");
  L.push('');
  L.push('/** Every library surface material, in MapMaker\'s palette order. */');
  L.push('export const CORE_MATERIALS: readonly MaterialDefinition[] = [');
  for (const m of out.materials) L.push(`${comments(m.notes, '  ')}  ${tsInline(m.def)},`);
  L.push('];');
  L.push('');
  L.push('/** Themes: each surface slot\'s default material and tint, and the sky colour. */');
  L.push('export const CORE_THEMES: readonly ThemeDefinition[] = [');
  for (const t of out.themes) L.push(`${comments(t.notes, '  ')}  ${tsInline(t.def)},`);
  L.push('];');
  L.push('');
  L.push('/** Curated tint swatches offered first in the UI; any #rrggbb is also allowed. */');
  L.push('export const TINT_SWATCHES: readonly string[] = [');
  for (let i = 0; i < out.tints.length; i += 6) L.push(`  ${out.tints.slice(i, i + 6).map(sq).join(', ')},`);
  L.push('];');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`materials: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const text = render(out);
  const stale = !existsSync(join(ROOT, GENERATED)) || readFileSync(join(ROOT, GENERATED), 'utf8') !== text;
  if (checkOnly) {
    if (stale) {
      console.error(`materials: out of date: ${GENERATED} (run node tools/content/materials.mjs)`);
      process.exit(1);
    }
  } else if (stale) writeFileSync(join(ROOT, GENERATED), text);
  console.log(`materials OK: ${out.materials.length} materials, ${out.themes.length} themes${checkOnly ? '' : stale ? `; wrote ${GENERATED}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
