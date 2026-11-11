// Roulette's data (docs/ROULETTE_MODE_PLAN.md; sim/roulette.ts): signature loadouts, jackpot weapons and the odds.
//
//   node tools/content/roulette.mjs           check the content and write the generated file
//   node tools/content/roulette.mjs --check   check the content, and that the generated file is up to date
//
// Reads content/roulette.json and content/weapons/*.json. Checks the schema (unknown fields are errors) and the
// references: every signature and jackpot weapon exists and is one a pickup can hold (a category, a hand slot: never a
// tool, a mode-only weapon or a mounted gun); every character named is a look on the roster (looks.ts and the
// characters' manifests; never a retired or an experimental one); every group is one of Character Select's; the odds are shares. Then
// writes packages/shared/src/content/roulette.generated.ts. Behaviour stays in code (sim/roulette.ts).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, shape, tsInline } from './weapons.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = 'content/roulette.json';
const GENERATED = 'packages/shared/src/content/roulette.generated.ts';
/** Character Select's groups: the same list as CHARACTER_GROUPS in packages/shared/src/content/looks.ts (and GROUPS in character-manifests.mjs). */
const GROUPS = ['soldiers', 'legends', 'folk', 'horror', 'animals', 'creatures'];

const { num, int, str, map, obj } = shape;
const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

/** Look ids the game knows: the part-built presets (looks.ts) and the whole-body characters (their manifests), less the retired. */
function lookIds(root) {
  const ids = new Set();
  const experimental = new Set();
  const looks = readFileSync(join(root, 'packages/shared/src/content/looks.ts'), 'utf8');
  for (const m of looks.matchAll(/\{ id: '(core\.[a-z0-9_]+)'/g)) ids.add(m[1]);
  for (const f of readdirSync(join(root, 'content/characters'))) {
    if (!f.endsWith('.json')) continue;
    const c = readJson(root, `content/characters/${f}`);
    if (typeof c.look === 'string') ids.add(c.look);
    if (typeof c.look === 'string' && c.tier === 'experimental') experimental.add(c.look);
  }
  const retired = looks.match(/export const RETIRED_LOOKS[^=]*=\s*\{([\s\S]*?)\n\};/);
  const gone = new Set(retired ? [...retired[1].matchAll(/'(core\.[a-z0-9_]+)':/g)].map((m) => m[1]) : []);
  return { ids, gone, experimental };
}

export function load(root = ROOT) {
  const weapons = new Map();
  for (const f of readdirSync(join(root, 'content/weapons'))) {
    if (!f.endsWith('.json') || f === 'families.json') continue;
    const w = readJson(root, `content/weapons/${f}`);
    weapons.set(w.id, w);
  }
  return { data: readJson(root, FILE), weapons, looks: lookIds(root) };
}

/** Check everything and build the table: { problems, out }. */
export function build(content) {
  const problems = [];
  const d = content.data;
  const top = obj({ $comment: str, characters: map(str), groups: map(str), jackpot: map(str), odds: obj({ jackpot: num, tiny: num, pickJackpot: num }), jackpotArmor: int, tiny: obj({ size: num, speed: num }), streakPick: int, rerollEvery: int, rerollMax: int });
  problems.push(...check(d, top, FILE));
  if (problems.length) return { problems, out: null };
  const weapon = (id, where) => {
    const w = content.weapons.get(id);
    if (!w) problems.push(`${where}: ${id} doesn't exist (content/weapons)`);
    else if (!w.category || !(w.slot >= 1)) problems.push(`${where}: ${id} is a tool, a mode-only weapon or a mounted gun: a signature is a weapon a player carries`);
  };
  for (const [look, w] of Object.entries(d.characters)) {
    if (content.looks.gone.has(look)) problems.push(`${FILE}: characters.${look} is a retired look (RETIRED_LOOKS): list the look it plays instead`);
    else if (!content.looks.ids.has(look)) problems.push(`${FILE}: characters.${look} isn't a look on the roster`);
    else if (content.looks.experimental?.has(look)) problems.push(`${FILE}: characters.${look} is an experimental character (tier in its manifest): Roulette never deals one, so it takes no signature (docs/CHARACTERS.md, "Tier")`);
    weapon(w, `${FILE}: characters.${look}`);
  }
  for (const g of GROUPS) if (!d.groups[g]) problems.push(`${FILE}: groups.${g} is missing (every group needs a fallback)`);
  for (const [g, w] of Object.entries(d.groups)) {
    if (!GROUPS.includes(g)) problems.push(`${FILE}: groups.${g} isn't a character group (${GROUPS.join(', ')})`);
    weapon(w, `${FILE}: groups.${g}`);
  }
  for (const [from, to] of Object.entries(d.jackpot)) {
    weapon(from, `${FILE}: jackpot (from)`);
    weapon(to, `${FILE}: jackpot.${from}`);
    if (from === to) problems.push(`${FILE}: jackpot.${from} hands out the same weapon`);
  }
  for (const [k, v] of Object.entries(d.odds)) if (!(v >= 0 && v <= 0.5)) problems.push(`${FILE}: odds.${k} must be a share from 0 to 0.5`);
  if (d.odds.jackpot + d.odds.tiny > 0.5) problems.push(`${FILE}: odds.jackpot + odds.tiny must be at most 0.5`);
  if (!(d.jackpotArmor >= 0 && d.jackpotArmor <= 100)) problems.push(`${FILE}: jackpotArmor must be 0-100`);
  if (!(d.tiny.size >= 0.5 && d.tiny.size < 1)) problems.push(`${FILE}: tiny.size must be from 0.5 to under 1`);
  if (!(d.tiny.speed >= 1 && d.tiny.speed <= 1.25)) problems.push(`${FILE}: tiny.speed must be from 1 to 1.25`);
  if (!(d.streakPick >= 2 && d.streakPick <= 10)) problems.push(`${FILE}: streakPick must be 2-10`);
  if (!(d.rerollEvery >= 1 && d.rerollEvery <= 10)) problems.push(`${FILE}: rerollEvery must be 1-10`);
  if (!(d.rerollMax >= 1 && d.rerollMax <= 5)) problems.push(`${FILE}: rerollMax must be 1-5`);
  const { $comment: _c, ...out } = d;
  return { problems, out };
}

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/roulette.mjs from content/roulette.json. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/roulette.mjs`.');
  L.push('');
  L.push('/** Roulette\'s data (content/roulette.json; what each field means: its $comment, and sim/roulette.ts). */');
  L.push('export const ROULETTE_DATA = {');
  for (const [k, v] of Object.entries(out)) {
    // The long tables a line an entry (branches that add characters change different lines).
    if (v && typeof v === 'object' && Object.keys(v).length > 8) L.push(`  ${k}: {`, ...Object.entries(v).map(([a, b]) => `    ${tsInline({ [a]: b }).slice(2, -2)},`), '  },');
    else L.push(`  ${k}: ${tsInline(v)},`);
  }
  L.push('} as const;');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`roulette: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const text = render(out);
  const stale = !existsSync(join(ROOT, GENERATED)) || readFileSync(join(ROOT, GENERATED), 'utf8') !== text;
  if (checkOnly) {
    if (stale) {
      console.error(`roulette: out of date: ${GENERATED} (run node tools/content/roulette.mjs)`);
      process.exit(1);
    }
  } else if (stale) writeFileSync(join(ROOT, GENERATED), text);
  console.log(`roulette OK: ${Object.keys(out.characters).length} signatures${checkOnly ? '' : stale ? `; wrote ${GENERATED}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
