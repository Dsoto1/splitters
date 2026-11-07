// Weapon sets as data (docs/WEAPON_SETS_PLAN.md; docs/ARSENAL.md, "Weapon sets").
//
//   node tools/content/weapon-sets.mjs           check the content and write the generated file
//   node tools/content/weapon-sets.mjs --check   check the content, and that the generated file is up to date
//
// Reads content/weapon-sets.json (Standard, Military, Sci-fi, Medieval, Chaos, Mixed bag: each set's spawn loadout,
// its sniper bots' gun, its weapons and its grenades), content/weapons/*.json, content/throwables.json and
// content/pickups.json. Checks the schema (unknown fields are errors) and the references: every weapon exists and is
// one a pickup can hold (it has a category: never a tool, a mode-only weapon or a mounted gun), and a set's weapons
// that it doesn't spawn with have a pickup (they reach players as pickups and drops); spawn weapons are carried ones;
// the sniper gun is a scoped gun of the set (what the bots' sniper role looks for); a set that rolls a random main
// gun has one; grenades exist and have a pickup. Then writes packages/shared/src/content/weaponSets.generated.ts.
// Sets have no network code: maps, saved setups, server rules and MatchRules name a set by its id, so the id is what
// never changes. Behaviour stays in code (sim/weaponSets.ts: the loadouts, the pickup pools, the nearest categories).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, shape, sq, tsInline } from './weapons.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = 'content/weapon-sets.json';
const GENERATED = 'packages/shared/src/content/weaponSets.generated.ts';

const { str, bool, arr, obj, notes } = shape;

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

export function load(root = ROOT) {
  const weapons = new Map();
  for (const f of readdirSync(join(root, 'content/weapons'))) {
    if (!f.endsWith('.json') || f === 'families.json') continue;
    const w = readJson(root, `content/weapons/${f}`);
    weapons.set(w.id, w);
  }
  return {
    sets: readJson(root, FILE),
    weapons,
    throwables: readJson(root, 'content/throwables.json').throwables,
    pickups: readJson(root, 'content/pickups.json').pickups,
  };
}

/** Check everything and build the table: { problems, out: { sets } }. */
export function build(content) {
  const problems = [];
  const top = content.sets;
  for (const k of Object.keys(top ?? {})) if (!['$comment', 'sets'].includes(k)) problems.push(`${FILE}: unknown field "${k}"`);
  if (!Array.isArray(top?.sets) || !top.sets.length) {
    problems.push(`${FILE}: "sets" must be a list of at least 1`);
    return { problems, out: { sets: [] } };
  }
  // ("weapons" and "throwables" are a list or the word "all": checked by hand below.)
  const setShape = obj({ id: str, name: str, blurb: str, 'spawn?': arr(str, 1), 'randomGun?': bool, 'sniper?': str, 'notes?': notes });
  // Weapon pickups by weapon (drops and the match find a weapon's pickup as core.weapon_<name>), grenade pickups by kind.
  const weaponPickup = new Set(content.pickups.filter((p) => p.effect?.kind === 'weapon' && p.id === `core.weapon_${p.effect.weapon.replace(/^core\./, '')}`).map((p) => p.effect.weapon));
  const throwablePickup = new Set(content.pickups.filter((p) => p.effect?.kind === 'throwable').map((p) => p.effect.throwable));
  const kinds = content.throwables.map((t) => t.kind);
  const ids = new Set();
  const sets = [];
  for (const [i, s] of top.sets.entries()) {
    const where = `${FILE}: sets[${i}] (${s?.id})`;
    const { weapons: _w, throwables: _t, ...rest } = s && typeof s === 'object' ? s : { weapons: undefined, throwables: undefined };
    const bad = check(s && typeof s === 'object' ? rest : s, setShape, where);
    problems.push(...bad);
    if (bad.length || !s || typeof s !== 'object') continue;
    if (!/^[a-z][a-z0-9_]{1,23}$/.test(s.id)) problems.push(`${where}: id must be 2-24 lower case letters, digits and _, starting with a letter`);
    if (ids.has(s.id)) problems.push(`${where}: id ${s.id} is listed twice`);
    ids.add(s.id);
    const weapon = (id, what) => {
      const w = content.weapons.get(id);
      if (!w) {
        problems.push(`${where}: ${what} ${id} doesn't exist (content/weapons)`);
        return null;
      }
      if (!w.category) problems.push(`${where}: ${what} ${id} is a tool, a mode-only weapon or a mounted gun (it has no category): never in a set`);
      else if (!(w.slot >= 1)) problems.push(`${where}: ${what} ${id} is a mounted one (slot 0)`);
      return w;
    };
    const spawn = s.spawn ?? [];
    for (const id of spawn) weapon(id, 'spawn weapon');
    if (new Set(spawn).size !== spawn.length) problems.push(`${where}: a spawn weapon is listed twice`);
    let list = null;
    if (s.weapons !== undefined) {
      if (s.weapons === 'all') list = [...content.weapons.values()].filter((w) => w.category && w.slot >= 1 && weaponPickup.has(w.id)).map((w) => w.id);
      else if (!Array.isArray(s.weapons) || !s.weapons.length || s.weapons.some((x) => typeof x !== 'string')) problems.push(`${where}: "weapons" must be a list of weapon ids or "all"`);
      else {
        list = s.weapons;
        if (new Set(list).size !== list.length) problems.push(`${where}: a weapon is listed twice`);
        for (const id of list) {
          const w = weapon(id, 'weapon');
          // A set's weapons reach players as pickups (and drops), unless everyone spawns with them (the knife, the pistol).
          if (w?.category && !weaponPickup.has(id) && !spawn.includes(id)) problems.push(`${where}: weapon ${id} has no pickup (core.weapon_${id.replace(/^core\./, '')}), so it can only be in the set's spawn`);
        }
        if (!list.some((id) => weaponPickup.has(id))) problems.push(`${where}: no weapon of the set has a pickup: its weapon pickups would have nothing to hold`);
      }
    } else if (s.randomGun || s.sniper) problems.push(`${where}: a random gun or a sniper gun needs the set's "weapons"`);
    if (s.sniper !== undefined) {
      const w = weapon(s.sniper, 'sniper gun');
      if (w && !(w.view?.zoomFov && !w.alt)) problems.push(`${where}: sniper gun ${s.sniper} has no scope (view.zoomFov, and no second trigger: the zoom is right mouse), so sniper bots wouldn't take it as theirs`);
      if (list && !list.includes(s.sniper)) problems.push(`${where}: sniper gun ${s.sniper} isn't one of the set's weapons`);
    }
    if (s.randomGun && list && !list.some((id) => weaponPickup.has(id) && (content.weapons.get(id)?.slot ?? 0) >= 3)) problems.push(`${where}: "randomGun" needs a main gun (slot 3-9) among the set's weapons`);
    if (s.throwables !== undefined && s.throwables !== 'all') {
      if (!Array.isArray(s.throwables) || !s.throwables.length || s.throwables.some((x) => typeof x !== 'string')) problems.push(`${where}: "throwables" must be a list of throwable kinds or "all"`);
      else {
        if (new Set(s.throwables).size !== s.throwables.length) problems.push(`${where}: a throwable is listed twice`);
        for (const k of s.throwables) {
          if (!kinds.includes(k)) problems.push(`${where}: throwable ${k} doesn't exist (content/throwables.json)`);
          else if (!throwablePickup.has(k)) problems.push(`${where}: throwable ${k} has no pickup (content/pickups.json), so a grenade pickup couldn't hold it`);
        }
      }
    }
    sets.push({ ...s, notes: s.notes });
  }
  // The default (maps without a set, setups and servers that leave it out): Standard plays as before.
  const standard = sets.find((s) => s.id === 'standard');
  if (!standard) problems.push(`${FILE}: the "standard" set is missing (the default for every map that names none)`);
  else if (standard.spawn || standard.weapons !== undefined || standard.throwables !== undefined || standard.randomGun || standard.sniper) problems.push(`${FILE}: "standard" plays as before: no spawn, weapons, throwables, random gun or sniper gun of its own`);
  return { problems, out: { sets } };
}

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/weapon-sets.mjs from content/weapon-sets.json. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/weapon-sets.mjs`.');
  L.push("import type { WeaponSetDef } from '../sim/weaponSets.ts';");
  L.push('');
  L.push('/** Every weapon set, in menu order (its id: what maps, setups, server rules and MatchRules name). */');
  L.push(`export const WEAPON_SET_IDS = [${out.sets.map((s) => sq(s.id)).join(', ')}] as const;`);
  L.push('');
  L.push('/** The sets (content/weapon-sets.json; what each field means: sim/weaponSets.ts WeaponSetDef). */');
  L.push('export const WEAPON_SET_DEFS: Readonly<Record<(typeof WEAPON_SET_IDS)[number], WeaponSetDef>> = {');
  for (const s of out.sets) {
    for (const [k, n] of Object.entries(s.notes ?? {})) L.push(`  // ${k}: ${n}`);
    const { notes: _n, ...def } = s;
    const fields = Object.entries(def).map(([k, v]) => `    ${k}: ${tsInline(v)},`);
    L.push(`  ${s.id}: {`, ...fields, '  },');
  }
  L.push('};');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`weapon sets: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const text = render(out);
  const stale = !existsSync(join(ROOT, GENERATED)) || readFileSync(join(ROOT, GENERATED), 'utf8') !== text;
  if (checkOnly) {
    if (stale) {
      console.error(`weapon sets: out of date: ${GENERATED} (run node tools/content/weapon-sets.mjs)`);
      process.exit(1);
    }
  } else if (stale) writeFileSync(join(ROOT, GENERATED), text);
  console.log(`weapon sets OK: ${out.sets.length} sets${checkOnly ? '' : stale ? `; wrote ${GENERATED}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
