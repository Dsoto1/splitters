// NPC roles as data (docs/CONTENT_SCALABILITY.md step 4; how to add one: docs/CONTENT_PIPELINE.md, "How to add an NPC
// role").
//
//   node tools/content/npcs.mjs           check the content and write the generated file and the codes lock
//   node tools/content/npcs.mjs --check   check the content, and that the generated file and the lock are up to date
//
// Reads content/npcs.json (every role: health, weapon, speed, size, damage, the creature / melee flags, the character
// look it is drawn as, its bot profile's changes from NPC_PROFILE, and design notes). Checks the schema (unknown fields
// are errors) and the references (weapons exist and are carried ones, slot 1-9; looks are core-tier character looks in
// content/characters; creature roles have a body in sim/creatures.ts; bot tags are ones the brain reads; codes unique,
// never changed, never reused, running 0, 1, 2...), then writes packages/shared/src/content/npcRoles.generated.ts and
// the npcRoles section of content/codes.lock.json. Behaviour and looks logic stay in code (sim/npc.ts: NPC_PROFILE,
// the NPC skins and their colours; content/looks.ts NPC_KEPT_LOOKS; the brain).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, comments, key, lockText, shape, sq, tsInline } from './weapons.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = 'content/npcs.json';
const GENERATED = 'packages/shared/src/content/npcRoles.generated.ts';
const LOCK = 'content/codes.lock.json';
/** The bot traits (0-100) a role may change (bots/profile.ts BotProfile). */
const TRAITS = [
  'accuracy', 'reactionSpeed', 'aggression', 'selfPreservation', 'tacticalAwareness', 'objectivePriority', 'itemGreed', 'pursuitPersistence',
  'exploration', 'teamLoyalty', 'riskTolerance', 'meleePreference', 'rangePreference',
];

const { num, int, str, bool, en, arr, obj, notes } = shape;

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const optJson = (root, rel) => (existsSync(join(root, rel)) ? readJson(root, rel) : null);

/** Bot tags the code reads (`hasTag(p, 'X')`), so a typo can't pass for a tag. */
function knownTags(root) {
  const tags = new Set(['NPC']);
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) for (const m of readFileSync(p, 'utf8').matchAll(/hasTag\([^,()]+,\s*'([A-Z_]+)'\)/g)) tags.add(m[1]);
    }
  };
  walk(join(root, 'packages/shared/src'));
  return [...tags].sort();
}

export function load(root = ROOT) {
  return { npcs: readJson(root, FILE), lock: optJson(root, LOCK) ?? {} };
}

/** Check everything and build the tables: { problems, out: { roles (code order), lock } }. */
export function build(content, root = ROOT) {
  const problems = [];
  const tags = knownTags(root);
  const bot = obj({
    id: str, 'displayName?': str, ...Object.fromEntries(TRAITS.map((t) => [`${t}?`, num])), 'weaponPreferences?': arr(str), tags: arr(en(tags), 1),
  });
  const role = obj({
    role: str, code: int, label: str, health: num, weapon: str, speed: num, scale: num, 'creature?': bool, 'melee?': bool, 'damage?': num, 'look?': str,
    bot, 'notes?': notes,
  });

  const slots = new Map();
  for (const f of readdirSync(join(root, 'content/weapons'))) {
    if (!f.endsWith('.json') || f === 'families.json') continue;
    const w = readJson(root, `content/weapons/${f}`);
    slots.set(w.id, w.slot);
  }
  const looks = new Set();
  // Experimental characters, by their manifests' tier (`content.experimentalLooks`: more of them, for a test).
  const experimental = new Set(content.experimentalLooks ?? []);
  for (const f of readdirSync(join(root, 'content/characters'))) {
    if (!f.endsWith('.json')) continue;
    const c = readJson(root, `content/characters/${f}`);
    looks.add(c.look);
    if (c.tier === 'experimental') experimental.add(c.look);
  }
  const creatureSrc = readFileSync(join(root, 'packages/shared/src/sim/creatures.ts'), 'utf8');
  const specs = creatureSrc.slice(creatureSrc.indexOf('export const CREATURE_SPECS'));
  const creatureBodies = new Set([...specs.matchAll(/^\s{2}(\w+): \{ model:/gm)].map((m) => m[1]));

  const roles = [];
  const ids = new Set();
  const botIds = new Set();
  for (const [i, r] of (content.npcs.roles ?? []).entries()) {
    const where = `${FILE}: roles[${i}] (${r?.role})`;
    const p = check(r, role, where);
    problems.push(...p);
    if (p.length) continue;
    if (!/^[a-z][a-z0-9_]*$/.test(r.role)) problems.push(`${where}: role must be lower case letters, digits and _`);
    if (ids.has(r.role)) problems.push(`${where}: role ${r.role} is listed twice`);
    ids.add(r.role);
    if (!slots.has(r.weapon)) problems.push(`${where}: weapon ${r.weapon} doesn't exist (content/weapons)`);
    else if (!(slots.get(r.weapon) >= 1)) problems.push(`${where}: weapon ${r.weapon} is a mounted one (slot 0); an NPC carries a slot 1-9 weapon`);
    if (r.look !== undefined && !looks.has(r.look)) problems.push(`${where}: look ${r.look} is not a character look (content/characters/*.json)`);
    if (r.look !== undefined && experimental.has(r.look)) problems.push(`${where}: look ${r.look} is an experimental character (tier in its manifest): an NPC role is drawn as a core one (docs/CHARACTERS.md, "Tier")`);
    if (r.look !== undefined && r.creature) problems.push(`${where}: a creature is drawn with its own body, not a look`);
    if (r.creature && !creatureBodies.has(r.role)) problems.push(`${where}: a creature role needs its body in sim/creatures.ts CREATURE_SPECS (code first)`);
    if (r.health <= 0 || r.speed <= 0 || r.scale <= 0) problems.push(`${where}: health, speed and scale must be above 0`);
    if (r.damage !== undefined && r.damage < 0) problems.push(`${where}: damage can't be negative`);
    for (const t of TRAITS) if (r.bot[t] !== undefined && (r.bot[t] < 0 || r.bot[t] > 100)) problems.push(`${where}: bot.${t} must be 0-100`);
    if (botIds.has(r.bot.id)) problems.push(`${where}: bot id ${r.bot.id} is also another role's`);
    botIds.add(r.bot.id);
    for (const w of r.bot.weaponPreferences ?? []) if (!slots.has(w)) problems.push(`${where}: bot.weaponPreferences: ${w} doesn't exist`);
    const { role: id, code, notes: n, bot: b, ...spec } = r;
    roles.push({ id, code, notes: n, spec, bot: b, where });
  }

  // Codes: what NPC snapshots carry (the client reads a role back by position). Unique, never changed, never reused
  // (also after a role is gone: it stays in the lock), and running 0, 1, 2... with no gaps.
  const lock = { ...content.lock, npcRoles: { ...(content.lock.npcRoles ?? {}) } };
  delete lock.$comment;
  const given = new Map(Object.entries(lock.npcRoles).map(([id, c]) => [c, id]));
  const seen = new Map();
  for (const r of roles) {
    if (r.code < 0) {
      problems.push(`${r.where}: code must be a whole number from 0`);
      continue;
    }
    if (seen.has(r.code)) problems.push(`${r.where}: code ${r.code} is also ${seen.get(r.code)}'s`);
    seen.set(r.code, r.id);
    if (lock.npcRoles[r.id] !== undefined && lock.npcRoles[r.id] !== r.code) problems.push(`${r.where}: ${r.id} has code ${lock.npcRoles[r.id]} (${LOCK}); a code never changes`);
    else if (given.has(r.code) && given.get(r.code) !== r.id) problems.push(`${r.where}: code ${r.code} was ${given.get(r.code)}'s (${LOCK}); codes are never reused`);
    else lock.npcRoles[r.id] = r.code;
  }
  roles.sort((a, b) => a.code - b.code);
  if (roles.length === (content.npcs.roles ?? []).length) roles.forEach((r, i) => r.code !== i && problems.push(`${r.where}: NPC role codes must run 0-${roles.length - 1} with no gaps`));
  return { problems, out: { roles, lock } };
}

export function render(out) {
  const L = [];
  const roleT = '(typeof NPC_ROLES)[number]';
  L.push('// Generated by tools/content/npcs.mjs from content/npcs.json. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/npcs.mjs`.');
  L.push("import type { BotProfile } from '../bots/profile.ts';");
  L.push("import type { NpcRoleSpec } from '../sim/npc.ts';");
  L.push('');
  L.push('/** NPC roles in code order: NPC snapshots send a role as its code (its index here; content/codes.lock.json). */');
  L.push(`export const NPC_ROLES = [${out.roles.map((r) => sq(r.id)).join(', ')}] as const;`);
  L.push('/** The creature kinds among NPC_ROLES (their own bodies and clips, not the soldier rig). */');
  L.push(`export const CREATURE_ROLES = [${out.roles.filter((r) => r.spec.creature).map((r) => sq(r.id)).join(', ')}] as const satisfies readonly ${roleT}[];`);
  L.push('');
  L.push('/** Each role\'s numbers (content/npcs.json). */');
  L.push(`export const NPC_ROLE_SPECS: Record<${roleT}, NpcRoleSpec> = {`);
  for (const r of out.roles) L.push(`${comments(r.notes, '  ')}  ${key(r.id)}: ${tsInline(r.spec)},`);
  L.push('};');
  L.push('');
  L.push('/** What each role\'s bot profile changes from NPC_PROFILE (sim/npc.ts NPC_ROLE_PROFILES). */');
  L.push(`export const NPC_ROLE_BOTS: Readonly<Record<${roleT}, Partial<BotProfile> & Pick<BotProfile, 'id' | 'tags'>>> = {`);
  for (const r of out.roles) L.push(`  ${key(r.id)}: ${tsInline(r.bot)},`);
  L.push('};');
  return `${L.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`npcs: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const files = [
    [GENERATED, render(out)],
    [LOCK, lockText(out.lock)],
  ];
  const stale = files.filter(([rel, text]) => !existsSync(join(ROOT, rel)) || readFileSync(join(ROOT, rel), 'utf8') !== text).map(([rel]) => rel);
  if (checkOnly) {
    if (stale.length) {
      console.error(`npcs: out of date: ${stale.join(', ')} (run node tools/content/npcs.mjs)`);
      process.exit(1);
    }
  } else for (const [rel, text] of files) if (stale.includes(rel)) writeFileSync(join(ROOT, rel), text);
  console.log(`npcs OK: ${out.roles.length} roles${checkOnly ? '' : stale.length ? `; wrote ${stale.join(', ')}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
