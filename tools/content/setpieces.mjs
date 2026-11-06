// Set pieces as data (docs/SET_PIECES_PLAN.md; how to add one: docs/CONTENT_PIPELINE.md, "Set pieces").
//
//   node tools/content/setpieces.mjs           check the content and write the generated file
//   node tools/content/setpieces.mjs --check   check the content, and that the generated file is up to date
//
// Reads content/setpieces/<family>.json (each a family of pieces: a footprint, ports and parts in the piece's own
// frame) and content/setpieces/roles.json (the role packs: what each material role is in one look, and the themes
// each is the default for). Checks the files' shape and references here (families, ids, packs, themes, materials,
// facades, door styles), then the pieces themselves in TypeScript with the game's own code
// (tools/content/setpieces-check.ts: the map schema, map/setPieceCheck.ts, and every piece expanded and validated in
// each turn, mirrored and not, in each of its packs), and writes packages/shared/src/content/setPieces.generated.ts
// (SET_PIECE_DEFS, SET_PIECE_PACKS), which only map loading reads (map/setPieceLibrary.ts: not the menu's bundle).
// Maps name a piece and a pack by id and a piece's parts by index (sp_<placement>_<index>): an id never changes,
// a piece only ever gains parts at the end, and a pack or piece a map names can't be removed (checked here).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsList } from './materials.mjs';
import { check, comments, shape, tsInline } from './weapons.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = 'content/setpieces';
const ROLES = `${DIR}/roles.json`;
const GENERATED = 'packages/shared/src/content/setPieces.generated.ts';
const CHECKER = 'tools/content/setpieces-check.ts';

const { str, arr, obj, notes } = shape;
const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

/** The family files (every .json in content/setpieces/ but roles.json, sorted) and the role packs. */
export function load(root = ROOT) {
  const files = readdirSync(join(root, DIR)).filter((f) => f.endsWith('.json') && f !== 'roles.json').sort();
  return { families: files.map((f) => ({ file: `${DIR}/${f}`, json: readJson(root, `${DIR}/${f}`) })), roles: readJson(root, ROLES) };
}

const MATERIAL_ROLES = ['stone', 'trim', 'floor', 'paving', 'roof', 'wood', 'metal'];
const ID = /^setpiece\.[a-z0-9_]{1,40}$/;
const PACK_ID = /^[a-z0-9_]{2,32}$/;
const COLOUR = /^#[0-9a-f]{6}$/;

/** Set-piece and role-pack ids the maps name: [kind, id, where]. */
function namedByMaps(root) {
  const out = [];
  const dir = join(root, 'maps');
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const m = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const p of m.setPieces ?? []) {
      out.push(['piece', p.piece, `maps/${f}`]);
      if (p.pack) out.push(['pack', p.pack, `maps/${f}`]);
    }
  }
  return out;
}

/** Check everything and build the tables: { problems, out: { pieces, packs } }. */
export function build(content, root = ROOT, opts = {}) {
  const problems = [];
  const materials = new Set(readJson(root, 'content/materials.json').materials.map((m) => m.id));
  const themes = new Set(readJson(root, 'content/materials.json').themes.map((t) => t.id));
  const facades = tsList(root, 'packages/shared/src/map/tileOptions.ts', 'FACADES');
  const doors = tsList(root, 'packages/shared/src/map/schema.ts', 'DOOR_STYLES');
  const stylePacks = new Set([...readFileSync(join(root, 'packages/shared/src/editor/stylePacks.ts'), 'utf8').matchAll(/^\s{4}id: '([a-z]+)',$/gm)].map((m) => m[1]));

  // Role packs.
  const roles = content.roles;
  for (const k of Object.keys(roles ?? {})) if (!['$comment', 'packs'].includes(k)) problems.push(`${ROLES}: unknown field "${k}"`);
  const surface = obj({ material: str, 'tint?': str });
  const packShape = obj({
    id: str, displayName: str, 'stylePack?': str, themes: arr(str),
    roles: obj({ ...Object.fromEntries(MATERIAL_ROLES.map((r) => [`${r}?`, surface])), 'facade?': str, 'door?': str, 'glass?': str }),
    'notes?': notes,
  });
  const packs = [];
  const packIds = new Set();
  const themeOf = new Map();
  for (const [i, p] of (Array.isArray(roles?.packs) ? roles.packs : []).entries()) {
    const where = `${ROLES}: packs[${i}] (${p?.id})`;
    const bad = check(p, packShape, where);
    problems.push(...bad);
    if (bad.length) continue;
    if (!PACK_ID.test(p.id)) problems.push(`${where}: id is 2-32 lower case letters, digits and _`);
    if (packIds.has(p.id)) problems.push(`${where}: id ${p.id} is listed twice`);
    packIds.add(p.id);
    if (p.stylePack && !stylePacks.has(p.stylePack)) problems.push(`${where}: stylePack ${p.stylePack} is not a Style Pack (editor/stylePacks.ts)`);
    for (const t of p.themes) {
      if (!themes.has(t)) problems.push(`${where}: theme ${t} is not a theme (content/materials.json)`);
      if (themeOf.has(t)) problems.push(`${where}: theme ${t} is already ${themeOf.get(t)}'s (a theme has one pack at most)`);
      themeOf.set(t, p.id);
    }
    for (const [role, v] of Object.entries(p.roles)) {
      if (MATERIAL_ROLES.includes(role)) {
        if (!materials.has(v.material)) problems.push(`${where}: roles.${role}: ${v.material} is not a material (content/materials.json)`);
        if (v.tint !== undefined && !COLOUR.test(v.tint)) problems.push(`${where}: roles.${role}.tint is a #rrggbb colour (lower case)`);
      } else if (role === 'facade' && !facades.includes(v)) problems.push(`${where}: roles.facade: ${v} is not a facade (map/tileOptions.ts FACADES)`);
      else if (role === 'door' && !doors.includes(v)) problems.push(`${where}: roles.door: ${v} is not a door style (map/schema.ts DOOR_STYLES)`);
      else if (role === 'glass' && !['breakable', 'reinforced', 'none'].includes(v)) problems.push(`${where}: roles.glass is breakable, reinforced or none`);
    }
    const { notes: n, $comment: _c, ...pack } = p;
    packs.push({ pack: { ...pack, themes: [...pack.themes] }, notes: n });
  }
  if (!packs.length) problems.push(`${ROLES}: "packs" must be a list of at least 1`);

  // Families.
  const pieces = [];
  const ids = new Set();
  for (const { file, json } of content.families) {
    for (const k of Object.keys(json ?? {})) if (!['$comment', 'family', 'pieces'].includes(k)) problems.push(`${file}: unknown field "${k}"`);
    const family = file.slice(DIR.length + 1, -'.json'.length);
    if (json?.family !== family) problems.push(`${file}: "family" is ${family} (the file's name)`);
    if (!Array.isArray(json?.pieces) || !json.pieces.length) problems.push(`${file}: "pieces" must be a list of at least 1`);
    for (const [i, p] of (json?.pieces ?? []).entries()) {
      const where = `${file}: pieces[${i}] (${p?.id})`;
      if (!p || typeof p !== 'object') {
        problems.push(`${where}: a piece is an object`);
        continue;
      }
      if (!ID.test(p.id)) problems.push(`${where}: id is setpiece.<name> (lower case letters, digits and _)`);
      if (ids.has(p.id)) problems.push(`${where}: id ${p.id} is listed twice`);
      ids.add(p.id);
      if (p.family !== undefined && p.family !== family) problems.push(`${where}: family is ${family} (its file; leave it out)`);
      for (const pack of p.packs ?? []) if (!packIds.has(pack)) problems.push(`${where}: packs: ${pack} is not a role pack (${ROLES})`);
      // The family is the file's: given after the identity, before the rest, in the generated table.
      const { $comment: _c, notes: n, id, displayName, family: _f, ...rest } = p;
      pieces.push({ where, def: { id, displayName, family, ...rest }, notes: n });
    }
  }

  // Maps name pieces and packs by id: one they use can't be renamed or removed.
  for (const [kind, id, where] of namedByMaps(root)) {
    if (kind === 'piece' && id.startsWith('setpiece.') && !ids.has(id)) problems.push(`${where}: places set piece ${id}, which isn't in ${DIR}/ (an id never changes)`);
    if (kind === 'pack' && !packIds.has(id)) problems.push(`${where}: names role pack ${id}, which isn't in ${ROLES} (an id never changes)`);
  }

  // The pieces themselves, with the game's code (schema, references, footprints, ports, mirror, every expansion).
  if (!opts.skipDeep && pieces.length && !problems.length) problems.push(...deepCheck(root, pieces, packs));
  return { problems, out: { pieces, packs } };
}

/** tools/content/setpieces-check.ts on the pieces and packs (the game's TypeScript, run by node). */
function deepCheck(root, pieces, packs) {
  try {
    const stdout = execFileSync(process.execPath, ['--experimental-transform-types', '--no-warnings', join(root, CHECKER)], {
      cwd: root,
      input: JSON.stringify({ pieces: pieces.map((p) => ({ where: p.where, def: p.def })), packs: packs.map((p) => p.pack) }),
      maxBuffer: 64 << 20,
    });
    return JSON.parse(stdout.toString()).problems;
  } catch (e) {
    return [`${CHECKER} failed: ${String(e.stderr || e.message).trim().split('\n').slice(0, 6).join(' / ')}`];
  }
}

// ---------------------------------------------------------------- render

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/setpieces.mjs from content/setpieces/. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/setpieces.mjs`.');
  L.push("import type { SetPieceDefinitionInput } from '../map/schema.ts';");
  L.push("import type { SetPieceRolePackInput } from '../map/setPieces.ts';");
  L.push('');
  L.push('/**');
  L.push(' * The shipped set pieces, family by family (content/setpieces/<family>.json): map/setPieceLibrary.ts parses them');
  L.push(" * when a map is first loaded. Loaded with the map content only, never the menu's bundle.");
  L.push(' */');
  L.push('export const SET_PIECE_DEFS: readonly SetPieceDefinitionInput[] = [');
  for (const p of out.pieces) {
    L.push(`${comments(p.notes, '  ')}  {`);
    for (const [k, v] of Object.entries(p.def)) {
      if (k === 'parts' || k === 'ports') {
        L.push(`    ${k}: [`);
        for (const x of v) L.push(`      ${tsInline(x)},`);
        L.push('    ],');
      } else L.push(`    ${k}: ${tsInline(v)},`);
    }
    L.push('  },');
  }
  L.push('];');
  L.push('');
  L.push('/** The role packs (content/setpieces/roles.json): what each role is in one look, and the themes it is the default for. */');
  L.push('export const SET_PIECE_PACKS: readonly SetPieceRolePackInput[] = [');
  for (const p of out.packs) L.push(`${comments(p.notes, '  ')}  ${tsInline(p.pack)},`);
  L.push('];');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const content = load();
  // The generated file first (from the JSON alone), so the TypeScript check can import the game's code even when the
  // file was missing or held merge conflict markers; then the check.
  const first = build(content, ROOT, { skipDeep: true });
  if (first.problems.length) return fail(first.problems);
  const text = render(first.out);
  const stale = !existsSync(join(ROOT, GENERATED)) || readFileSync(join(ROOT, GENERATED), 'utf8') !== text;
  if (!checkOnly && stale) writeFileSync(join(ROOT, GENERATED), text);
  const { problems } = build(content);
  if (problems.length) return fail(problems);
  if (checkOnly && stale) return fail([`out of date: ${GENERATED} (run node tools/content/setpieces.mjs)`]);
  console.log(`set pieces OK: ${first.out.pieces.length} pieces, ${first.out.packs.length} role packs${checkOnly ? '' : stale ? `; wrote ${GENERATED}` : '; up to date'}`);
}

function fail(problems) {
  console.error(`set pieces: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
