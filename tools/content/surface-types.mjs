// Surface types as data (docs/CONTENT_PIPELINE.md, "Surface types").
//
//   node tools/content/surface-types.mjs           check the content and write the generated file
//   node tools/content/surface-types.mjs --check   check the content, and that the generated file is up to date
//
// Reads content/surface-types.json (each type's ballistic class, impact decal, debris and sound family, footstep
// family; the legacy effect guess for entries without a surface), the `surface` of props in content/props/<pack>.json
// (per prop, or for the whole pack at the file's top level) and content/vfx.json map.impacts (how each type's impact
// is drawn, keyed by type id). Checks the schema (unknown fields are errors) and every reference: a type's ballistic
// class is in sim/gunplay.ts BALLISTIC_MATERIALS, every surface a prop, a pack or the guess names is a type, every type
// has its drawing in content/vfx.json and nothing else does, and the drawing throws what the type's debris says.
// Library materials name their surface in content/materials.json (checked by tools/content/materials.mjs against
// this list). Writes packages/shared/src/content/surfaceTypes.generated.ts.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, shape, sq, tsInline } from './weapons.mjs';
import { tsList } from './materials.mjs';
import { readPropPacks } from './props-manifest.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = 'content/surface-types.json';
const VFX = 'content/vfx.json';
const GENERATED = 'packages/shared/src/content/surfaceTypes.generated.ts';
const GUNPLAY = 'packages/shared/src/sim/gunplay.ts';

const { str, en, arr, obj, map } = shape;

export const DECALS = ['hole', 'none'];
export const DEBRIS = ['dust', 'splinters', 'chips', 'leaves', 'sparks'];
export const SOUNDS = ['hard', 'wood', 'metal', 'soft', 'glass', 'water', 'none'];
export const FOOTSTEPS = ['hard', 'wood', 'metal', 'soft', 'foliage', 'sand', 'gravel', 'snow', 'water'];
const ID = /^[a-z][a-z0-9_]*$/;
const COLOUR = /^#[0-9a-f]{6}$/;

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const noComment = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== '$comment')) : v);

/** The surface type ids in content/surface-types.json (for tools/content/materials.mjs). */
export function surfaceTypeIds(root = ROOT) {
  const t = readJson(root, FILE).types;
  return Array.isArray(t) ? t.map((x) => x?.id).filter((x) => typeof x === 'string') : [];
}

export function load(root = ROOT) {
  return { surfaces: readJson(root, FILE), vfx: readJson(root, VFX), packs: readPropPacks(join(root, 'content/props')) };
}

/** Check everything and build the tables: { problems, out: { types, guess, props } }. */
export function build(content, root = ROOT) {
  const problems = [];
  const classes = tsList(root, GUNPLAY, 'BALLISTIC_MATERIALS');
  const type = obj({
    id: str, name: str, ballistic: en(classes),
    impact: obj({ decal: en(DECALS), debris: arr(en(DEBRIS)), sound: en(SOUNDS) }),
    'footstep?': en(FOOTSTEPS),
  });
  const top = content.surfaces;
  for (const k of Object.keys(top ?? {})) if (!['$comment', 'types', 'guess'].includes(k)) problems.push(`${FILE}: unknown field "${k}"`);
  if (!Array.isArray(top?.types) || !top.types.length) problems.push(`${FILE}: "types" must be a list of at least 1`);

  const types = [];
  const ids = new Set();
  for (const [i, t] of (Array.isArray(top?.types) ? top.types : []).entries()) {
    const where = `${FILE}: types[${i}] (${t?.id})`;
    const bad = check(t, type, where);
    problems.push(...bad);
    if (bad.length) continue;
    if (!ID.test(t.id)) problems.push(`${where}: id must be lower case letters, digits and _`);
    if (ids.has(t.id)) problems.push(`${where}: id ${t.id} is listed twice`);
    if (new Set(t.impact.debris).size !== t.impact.debris.length) problems.push(`${where}: impact.debris lists something twice`);
    ids.add(t.id);
    types.push({ id: t.id, name: t.name, ballistic: t.ballistic, impact: { decal: t.impact.decal, debris: t.impact.debris, sound: t.impact.sound }, ...(t.footstep ? { footstep: t.footstep } : {}) });
  }
  const known = (id, where) => {
    if (!ids.has(id)) problems.push(`${where}: surface type ${JSON.stringify(id)} isn't in ${FILE}`);
  };

  // The legacy effect guess: words per type, then the fallback.
  const guess = noComment(top?.guess);
  const guessBad = check(guess, obj({ fallback: str, words: map(arr(str, 1)) }), `${FILE}: guess`);
  problems.push(...guessBad);
  if (!guessBad.length) {
    known(guess.fallback, `${FILE}: guess.fallback`);
    for (const t of Object.keys(guess.words)) known(t, `${FILE}: guess.words`);
  }

  // Props: a pack's `surface` covers its props; a prop's own wins.
  const props = [];
  for (const p of content.packs) {
    const where = `content/props/${p.id}.json`;
    const raw = p;
    if (raw.surface !== undefined) known(raw.surface, `${where}: surface`);
    for (const prop of p.props) {
      if (prop.surface !== undefined) known(prop.surface, `${where}: ${prop.id}: surface`);
      const s = prop.surface ?? raw.surface;
      if (s !== undefined) props.push([`prop.${prop.id}`, s]);
    }
  }

  // content/vfx.json map.impacts: one drawing per type, nothing else (but accentRange).
  const impacts = noComment(content.vfx?.map?.impacts) ?? {};
  const fx = obj({ 'sparks?': shape.int, 'dust?': str, 'dustSize?': shape.num, 'chips?': shape.int, 'chip?': str, accent: shape.nullable(obj({ pack: str, effect: str, scale: shape.num })) });
  for (const [k, v] of Object.entries(impacts)) {
    if (k === 'accentRange') continue;
    const where = `${VFX}: map.impacts.${k}`;
    if (!ids.has(k)) {
      problems.push(`${where}: no surface type ${k} in ${FILE} (impacts are keyed by surface type)`);
      continue;
    }
    const bad = check(v, fx, where);
    problems.push(...bad);
    if (bad.length) continue;
    const debris = new Set(types.find((t) => t.id === k).impact.debris);
    const says = (has, what, on) => has !== on && problems.push(`${where}: ${on ? `the type throws ${what} (${FILE}) but this draws none` : `draws ${what} the type doesn't throw (${FILE} impact.debris)`}`);
    says((v.sparks ?? 0) > 0, 'sparks', debris.has('sparks'));
    says((v.chips ?? 0) > 0, 'chips, splinters or leaves', debris.has('chips') || debris.has('splinters') || debris.has('leaves'));
    says(v.dust !== undefined, 'dust', debris.has('dust'));
    if ((v.chips ?? 0) > 0 && v.chip === undefined) problems.push(`${where}: chips need a "chip" colour`);
    for (const c of ['dust', 'chip']) if (v[c] !== undefined && !COLOUR.test(v[c])) problems.push(`${where}: ${c} ${JSON.stringify(v[c])} is not a #rrggbb colour (lower case)`);
  }
  for (const t of types) if (!(t.id in impacts)) problems.push(`${VFX}: map.impacts has no drawing for surface type ${t.id}`);
  if (content.vfx?.map?.surfaces !== undefined) problems.push(`${VFX}: map.surfaces is gone: the effect guess lives in ${FILE} (guess)`);

  return { problems, out: { types, guess, props } };
}

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/surface-types.mjs from content/surface-types.json and content/props/*.json. Do not edit by');
  L.push('// hand: edit the JSON and run `node tools/content/surface-types.mjs`.');
  L.push("import type { SurfaceTypeDefinition, SurfaceTypeId } from '../sim/surfaceTypes.ts';");
  L.push('');
  L.push('/** Every surface type id, in content/surface-types.json order. */');
  L.push(`export const SURFACE_TYPE_IDS = [${out.types.map((t) => sq(t.id)).join(', ')}] as const;`);
  L.push('');
  L.push('/** Each surface type: its ballistic class, its impact (decal, debris, sound family) and footstep family. */');
  L.push('export const SURFACE_TYPE_LIST: readonly SurfaceTypeDefinition[] = [');
  for (const t of out.types) L.push(`  ${tsInline(t)},`);
  L.push('];');
  L.push('');
  L.push('/** The effect of an entry with no surface: the first type whose words are in its name, else the fallback. */');
  L.push('export const SURFACE_GUESS: { readonly fallback: SurfaceTypeId; readonly words: readonly (readonly [SurfaceTypeId, readonly string[]])[] } = {');
  L.push(`  fallback: ${sq(out.guess.fallback)},`);
  L.push('  words: [');
  for (const [t, words] of Object.entries(out.guess.words)) L.push(`    [${sq(t)}, [${words.map(sq).join(', ')}]],`);
  L.push('  ],');
  L.push('};');
  L.push('');
  L.push('/** Props that name their surface (content/props/<pack>.json `surface`, the prop\'s own or its pack\'s), by model id. */');
  L.push('export const PROP_SURFACES: Readonly<Record<string, SurfaceTypeId>> = {');
  for (const [id, s] of out.props) L.push(`  ${sq(id)}: ${sq(s)},`);
  L.push('};');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`surface-types: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const text = render(out);
  const stale = !existsSync(join(ROOT, GENERATED)) || readFileSync(join(ROOT, GENERATED), 'utf8') !== text;
  if (checkOnly) {
    if (stale) {
      console.error(`surface-types: out of date: ${GENERATED} (run node tools/content/surface-types.mjs)`);
      process.exit(1);
    }
  } else if (stale) writeFileSync(join(ROOT, GENERATED), text);
  console.log(`surface types OK: ${out.types.length} surface types, ${out.props.length} props with a surface${checkOnly ? '' : stale ? `; wrote ${GENERATED}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
