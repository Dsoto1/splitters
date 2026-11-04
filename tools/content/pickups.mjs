// Pickups as data (docs/CONTENT_SCALABILITY.md step 5; how to add one: docs/CONTENT_PIPELINE.md, "How to add a
// pickup").
//
//   node tools/content/pickups.mjs           check the content and write the generated file
//   node tools/content/pickups.mjs --check   check the content, and that the generated file is up to date
//
// Reads content/pickups.json (every pickup item in palette order: health, armor, ammo, throwables, weapons, powerups,
// jetpack, glider, UAV, disc powers; and the pickup rules: armor cap and absorption, powerup multiples, pickup reach).
// Checks the schema (unknown fields are errors) and the references (weapons exist and are carried ones, a weapon
// pickup is `core.weapon_<weapon>`; ammo types, throwable kinds, disc powers and powerups exist; every pickup the maps
// and the Style Packs name exists), then writes packages/shared/src/content/pickups.generated.ts. Pickups have no
// network code: they travel as their id (pickup events, the snapshot's taken and rolled pickups), so the id is what
// never changes. Behaviour and visuals stay in code (sim/match.ts applyItem, sim/pickupRoll.ts, the bots'
// pickupNeed, the client's pickup models and MapMaker's icons).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, comments, key, shape, sq, tsInline } from './weapons.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = 'content/pickups.json';
const GENERATED = 'packages/shared/src/content/pickups.generated.ts';

const { num, int, str, en, obj, oneOf, notes } = shape;

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

/** An `export const NAME = [...] as const` list from TypeScript (one source for the enums). */
function tsList(root, file, name) {
  const src = readFileSync(join(root, file), 'utf8');
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]\\s*as const`));
  if (!m) throw new Error(`${file}: ${name} not found`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** The weapon a weapon pickup's id must name (drops and the match find a weapon's pickup by it). */
const weaponPickupId = (weapon) => `core.weapon_${weapon.replace(/^core\./, '')}`;
/** A weapon pickup's bot value when the file leaves it out: power weapons respawn slower and are worth more. */
export const weaponBotValue = (respawnSeconds) => 0.55 + Math.min(0.35, respawnSeconds / 120);

export function load(root = ROOT) {
  return { pickups: readJson(root, FILE) };
}

/** Pickup ids named outside the table: placed in maps/*.json, offered by the Style Packs. */
function namedElsewhere(root) {
  const named = [];
  const maps = join(root, 'maps');
  if (existsSync(maps)) {
    for (const f of readdirSync(maps).filter((x) => x.endsWith('.json')).sort()) {
      for (const m of readFileSync(join(maps, f), 'utf8').matchAll(/"item":\s*"(core\.[^"]+)"/g)) named.push([m[1], `maps/${f}`]);
    }
  }
  const packs = 'packages/shared/src/editor/stylePacks.ts';
  for (const m of readFileSync(join(root, packs), 'utf8').matchAll(/pickups:\s*\[([^\]]*)\]/g)) {
    for (const id of m[1].matchAll(/'([^']+)'/g)) named.push([id[1], packs]);
  }
  return named;
}

/** Check everything and build the table: { problems, out: { rules, items } }. */
export function build(content, root = ROOT) {
  const problems = [];
  const W = 'packages/shared/src/sim/weapons.ts';
  const ammoTypes = tsList(root, W, 'AMMO_TYPES');
  const discPowers = tsList(root, 'packages/shared/src/sim/discs.ts', 'DISC_POWERS');
  const powerups = tsList(root, 'packages/shared/src/sim/items.ts', 'POWERUP_KINDS');
  const throwables = new Map(readJson(root, 'content/throwables.json').throwables.map((t) => [t.kind, t]));
  const weapons = new Map();
  for (const f of readdirSync(join(root, 'content/weapons'))) {
    if (!f.endsWith('.json') || f === 'families.json') continue;
    const w = readJson(root, `content/weapons/${f}`);
    weapons.set(w.id, w);
  }

  const effect = oneOf('kind', {
    health: obj({ kind: str, amount: num }),
    armor: obj({ kind: str, amount: num }),
    ammo: obj({ kind: str, 'ammo?': en(ammoTypes) }),
    throwable: obj({ kind: str, throwable: en([...throwables.keys()]), count: int }),
    weapon: obj({ kind: str, weapon: str }),
    powerup: obj({ kind: str, powerup: en(powerups), seconds: num }),
    jetpack: obj({ kind: str }),
    glider: obj({ kind: str }),
    uav: obj({ kind: str, seconds: num }),
    disc: obj({ kind: str, power: en(discPowers) }),
  });
  const pickup = obj({ id: str, 'displayName?': str, effect, respawnSeconds: num, 'botValue?': num, 'notes?': notes });
  const rules = obj({
    pickup: obj({ radius: num, 'notes?': notes }),
    armor: obj({ max: num, absorb: num, 'notes?': notes }),
    powerup: obj({ speedBoost: num, damageBoost: num, 'notes?': notes }),
  });

  // The file's own shape first (rules strict; each pickup checked on its own below so one bad entry names itself).
  const top = content.pickups;
  for (const k of Object.keys(top ?? {})) if (!['$comment', 'rules', 'pickups'].includes(k)) problems.push(`${FILE}: unknown field "${k}"`);
  if (!Array.isArray(top?.pickups) || !top.pickups.length) problems.push(`${FILE}: "pickups" must be a list of at least 1`);
  problems.push(...check(top?.rules, rules, `${FILE}: rules`));
  const r = top?.rules;
  if (problems.length === 0) {
    if (!(r.pickup.radius > 0)) problems.push(`${FILE}: rules.pickup.radius must be above 0`);
    if (!(r.armor.max > 0)) problems.push(`${FILE}: rules.armor.max must be above 0`);
    if (!(r.armor.absorb >= 0 && r.armor.absorb <= 1)) problems.push(`${FILE}: rules.armor.absorb must be 0-1 (a share of the damage)`);
    if (!(r.powerup.speedBoost > 0 && r.powerup.damageBoost > 0)) problems.push(`${FILE}: rules.powerup multiples must be above 0`);
  }

  const items = [];
  const ids = new Set();
  for (const [i, p] of (Array.isArray(top?.pickups) ? top.pickups : []).entries()) {
    const where = `${FILE}: pickups[${i}] (${p?.id})`;
    const bad = check(p, pickup, where);
    problems.push(...bad);
    if (bad.length) continue;
    if (!/^core\.[a-z][a-z0-9_]*$/.test(p.id)) problems.push(`${where}: id must be core. then lower case letters, digits and _`);
    if (ids.has(p.id)) problems.push(`${where}: id ${p.id} is listed twice`);
    ids.add(p.id);
    const e = p.effect;
    let displayName = p.displayName;
    let botValue = p.botValue;
    if (e.kind === 'weapon') {
      const w = weapons.get(e.weapon);
      if (!w) problems.push(`${where}: weapon ${e.weapon} doesn't exist (content/weapons)`);
      else if (!(w.slot >= 1)) problems.push(`${where}: weapon ${e.weapon} is a mounted one (slot 0); a pickup gives a carried weapon`);
      if (p.id !== weaponPickupId(e.weapon)) problems.push(`${where}: a weapon pickup's id is ${weaponPickupId(e.weapon)} (drops and the match find it by that)`);
      displayName ??= w?.displayName;
      botValue ??= weaponBotValue(p.respawnSeconds);
    } else if (displayName === undefined && e.kind !== 'disc') problems.push(`${where}: "displayName" is missing (only weapon pickups and disc powers take theirs from elsewhere)`);
    if (botValue === undefined) problems.push(`${where}: "botValue" is missing (only weapon pickups have a default)`);
    else if (!(botValue >= 0 && botValue <= 1)) problems.push(`${where}: botValue must be 0-1`);
    if (!(p.respawnSeconds > 0)) problems.push(`${where}: respawnSeconds must be above 0`);
    if ((e.kind === 'health' || e.kind === 'armor') && !(e.amount > 0)) problems.push(`${where}: amount must be above 0`);
    if ((e.kind === 'powerup' || e.kind === 'uav') && !(e.seconds > 0)) problems.push(`${where}: seconds must be above 0`);
    if (e.kind === 'throwable') {
      const max = throwables.get(e.throwable)?.max ?? 0;
      if (!(e.count >= 1 && e.count <= max)) problems.push(`${where}: count must be 1-${max} (the most a player carries of ${e.throwable})`);
    }
    items.push({ id: p.id, displayName, disc: displayName === undefined ? e.power : undefined, effect: e, respawnSeconds: p.respawnSeconds, botValue, notes: p.notes });
  }

  // Maps and Style Packs name pickups by id: a pickup they use can't be renamed or removed.
  if (items.length === (top?.pickups ?? []).length) {
    for (const [id, where] of namedElsewhere(root)) if (!ids.has(id)) problems.push(`${where}: names pickup ${id}, which isn't in ${FILE} (a pickup id never changes)`);
  }
  return { problems, out: { rules: r, items } };
}

const strip = ({ notes: _n, ...v }) => v;

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/pickups.mjs from content/pickups.json. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/pickups.mjs`.');
  L.push("import { DISC_POWER_LABELS } from '../sim/discs.ts';");
  L.push("import type { ItemDefinition } from '../sim/items.ts';");
  L.push('');
  L.push('/** Armor, powerup multiples and pickup reach (content/pickups.json `rules`). */');
  L.push('export const PICKUP_RULES = {');
  for (const [k, v] of Object.entries(out.rules)) L.push(`${comments(v.notes, '  ')}  ${key(k)}: ${tsInline(strip(v))},`);
  L.push('} as const;');
  L.push('');
  L.push('/** Every pickup item, in palette order (also the order random weapon pickups roll from: sim/pickupRoll.ts). */');
  L.push('export const CORE_ITEMS: readonly ItemDefinition[] = [');
  for (const i of out.items) {
    const name = i.displayName === undefined ? `DISC_POWER_LABELS.${i.disc}` : sq(i.displayName);
    L.push(`${comments(i.notes, '  ')}  { id: ${sq(i.id)}, displayName: ${name}, effect: ${tsInline(i.effect)}, respawnSeconds: ${tsInline(i.respawnSeconds)}, botValue: ${tsInline(i.botValue)} },`);
  }
  L.push('];');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`pickups: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const text = render(out);
  const stale = !existsSync(join(ROOT, GENERATED)) || readFileSync(join(ROOT, GENERATED), 'utf8') !== text;
  if (checkOnly) {
    if (stale) {
      console.error(`pickups: out of date: ${GENERATED} (run node tools/content/pickups.mjs)`);
      process.exit(1);
    }
  } else if (stale) writeFileSync(join(ROOT, GENERATED), text);
  console.log(`pickups OK: ${out.items.length} pickups${checkOnly ? '' : stale ? `; wrote ${GENERATED}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
