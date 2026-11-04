// Weapons as data (docs/CONTENT_SCALABILITY.md, "Weapons as data"; how to add one: docs/CONTENT_PIPELINE.md).
//
//   node tools/content/weapons.mjs           check the content and write the generated file and the codes lock
//   node tools/content/weapons.mjs --check   check the content, and that the generated file and the lock are up to date
//
// Reads content/weapons/families.json (the default block and the gunplay families), content/weapons/<name>.json (one
// weapon each: only the values that differ from the defaults, its network code and its design notes),
// content/throwables.json, content/classes.json and content/abilities.json. Checks the schema and the references
// (ammo types, models and sounds exist; slots 0-9; codes unique and never reused; classes name real weapons), then
// writes packages/shared/src/content/weapons.generated.ts. Behaviour stays in code (gunplayOf, the projectile kinds,
// the ability handlers): the data names a behaviour and gives its numbers.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED = 'packages/shared/src/content/weapons.generated.ts';
const LOCK = 'content/codes.lock.json';

// ---------------------------------------------------------------- schema

const num = { t: 'num' };
const int = { t: 'int' };
const str = { t: 'str' };
const bool = { t: 'bool' };
const en = (values) => ({ t: 'enum', values });
const tup = (n, of = num) => ({ t: 'tuple', n, of });
const arr = (of, min = 0) => ({ t: 'arr', of, min });
const obj = (shape) => ({ t: 'obj', shape });
const nullable = (of) => ({ t: 'null|', of });
const oneOf = (key, cases) => ({ t: 'oneOf', key, cases });
const map = (of) => ({ t: 'map', of });
const lazy = (f) => ({ t: 'lazy', f });
const vec3 = tup(3);
const notes = map(str);

/** The enum lists live in TypeScript (one source); read them from it. */
function tsList(file, name) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]\\s*as const`));
  if (!m) throw new Error(`${file}: ${name} not found`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

export function schemas(root = ROOT, families = []) {
  const W = 'packages/shared/src/sim/weapons.ts';
  const list = (name) => tsList(W, name);
  const status = obj({ kind: en(list('STATUS_KINDS')), seconds: num, 'amount?': num });
  const projectile = obj({
    speed: num, gravity: num, fuseSeconds: num, splashRadius: num, splashDamage: num, splashEdgeDamage: num, selfDamageScale: num,
    visual: en(list('PROJECTILE_VISUALS')),
    'bounce?': num, 'mine?': obj({ armSeconds: num, triggerRadius: num }), 'impactDamage?': num, 'maxBounces?': int,
    'sticky?': en(['world', 'any']), 'homing?': obj({ turnRate: num, range: num }), 'drag?': num,
    'zone?': obj({ kind: en(list('ZONE_KINDS')), radius: num, seconds: num }), 'knockback?': num, 'status?': status,
    'ignites?': bool, 'guided?': obj({ turnRate: num }),
    'cluster?': obj({ count: int, speed: num, spec: lazy(() => projectile) }),
    'walker?': obj({ speed: num }), 'retrievable?': bool,
    'airstrike?': obj({ count: int, spacing: num, height: num, bomb: lazy(() => projectile) }),
    'cover?': obj({ half: vec3, health: num }), 'disc?': obj({ push: num, lift: num, 'split?': bool }),
  });
  const kick = { pitch: arr(num, 1), yaw: arr(num), variance: num, delay: int, settle: num, rate: num, visual: num };
  const accuracy = { base: num, move: num, air: num, perShot: num, tight: int, max: num, recovery: num, ads: num, adsTicks: int };
  const ballistic = { velocity: num, gravityScale: num, 'drag?': num, energy: num, tracerEvery: int, 'tracerFinal?': int };
  const partial = (shape) => obj(Object.fromEntries(Object.entries(shape).map(([k, v]) => [k.endsWith('?') ? k : `${k}?`, v])));
  const falloff = obj({ start: num, end: num, min: num, curve: en(['linear', 'smooth', 'steep']) });
  const reload = oneOf('type', {
    magazine: obj({ type: str, tactical: int, empty: int, out: num, in: num }),
    shell: obj({ type: str, start: int, each: int, end: int }),
  });
  const hold = obj({ style: en(['pistol', 'long', 'melee']), grip: vec3, 'support?': vec3, 'shoulder?': vec3 });
  const flash = obj({ effect: str, 'scale?': num });
  const view = obj({
    model: str, 'fallback?': str, viewOffset: vec3, tracer: str, 'zoomFov?': num, hold, 'sound?': str, 'beam?': bool,
    'muzzle?': flash, 'muzzleAt?': vec3, 'altShot?': obj({ sound: str, 'rate?': num, flash, 'smoke?': num }),
  });
  const alt = obj({
    label: str, ammo: en(['shared', 'own']), cost: int, 'max?': int, 'pickup?': int, fireIntervalTicks: int, kind: en(['hitscan', 'projectile']),
    'damage?': num, 'pellets?': int, 'spread?': num, 'range?': num, 'projectile?': projectile,
    'reload?': obj({ start: int, each: int, end: int }), 'kick?': obj(kick), 'falloff?': falloff, 'headshot?': num,
  });
  const weapon = obj({
    id: str, code: int, displayName: str, 'category?': en(list('WEAPON_CATEGORIES')), kind: en(['hitscan', 'projectile', 'melee']), slot: int,
    'family?': en(families), 'fireMode?': en(['auto', 'semi', 'burst']),
    damage: num, pellets: int, spread: num, fireIntervalTicks: int, range: num, magazine: int, reserveMax: int, pickupAmmo: int,
    reloadTicks: int, raiseTicks: int, 'projectile?': projectile, 'ammo?': en(list('AMMO_TYPES')), 'heal?': num,
    'grapple?': obj({ speed: num }), 'alt?': alt, 'burst?': obj({ count: int, intervalTicks: int }), 'windupTicks?': int,
    'windupResets?': bool, 'heat?': obj({ perShot: num, coolPerTick: num }), 'pierce?': int,
    'chain?': obj({ jumps: int, range: num, falloff: num }), 'status?': status, 'knockback?': num, 'stoppingPower?': num,
    'headshot?': num, 'legshot?': num, 'recoil?': obj({ 'kick?': num, bloom: num, maxBloom: num, recover: num }),
    'ballistic?': nullable(partial(ballistic)), 'accuracy?': partial(accuracy), 'kick?': partial(kick), 'reload?': reload,
    'falloff?': falloff, botDesirability: num, botRange: tup(2), view, 'notes?': notes,
  });
  const family = obj({ ballistic: nullable(obj(ballistic)), accuracy: obj(accuracy), kick: obj(kick), falloff, head: num, legs: num, 'notes?': notes });
  const throwable = obj({ kind: str, code: int, displayName: str, max: int, throwIntervalTicks: int, projectile, 'notes?': notes });
  return { weapon, family, throwable, projectile };
}

/** Problems with `v` against schema `s`, as "path: message". */
export function check(v, s, path, out = []) {
  const bad = (m) => out.push(`${path}: ${m}`);
  switch (s.t) {
    case 'lazy':
      return check(v, s.f(), path, out);
    case 'num':
      if (typeof v !== 'number' || !Number.isFinite(v)) bad(`a number, not ${JSON.stringify(v)}`);
      break;
    case 'int':
      if (!Number.isInteger(v)) bad(`a whole number, not ${JSON.stringify(v)}`);
      break;
    case 'str':
      if (typeof v !== 'string' || !v) bad(`some text, not ${JSON.stringify(v)}`);
      break;
    case 'bool':
      if (typeof v !== 'boolean') bad(`true or false, not ${JSON.stringify(v)}`);
      break;
    case 'enum':
      if (!s.values.includes(v)) bad(`one of ${s.values.join(', ')}, not ${JSON.stringify(v)}`);
      break;
    case 'tuple':
      if (!Array.isArray(v) || v.length !== s.n) bad(`a list of ${s.n}`);
      else v.forEach((x, i) => check(x, s.of, `${path}[${i}]`, out));
      break;
    case 'arr':
      if (!Array.isArray(v) || v.length < s.min) bad(`a list${s.min ? ` of at least ${s.min}` : ''}`);
      else v.forEach((x, i) => check(x, s.of, `${path}[${i}]`, out));
      break;
    case 'map':
      if (!v || typeof v !== 'object' || Array.isArray(v)) bad('an object');
      else for (const [k, x] of Object.entries(v)) check(x, s.of, `${path}.${k}`, out);
      break;
    case 'null|':
      if (v !== null) check(v, s.of, path, out);
      break;
    case 'oneOf': {
      const c = v && s.cases[v[s.key]];
      if (!c) bad(`${s.key} one of ${Object.keys(s.cases).join(', ')}`);
      else check(v, c, path, out);
      break;
    }
    case 'obj': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) {
        bad('an object');
        break;
      }
      const keys = new Map(Object.keys(s.shape).map((k) => [k.replace(/\?$/, ''), k]));
      for (const k of Object.keys(v)) if (!keys.has(k) && k !== '$comment') bad(`unknown field "${k}"`);
      for (const [k, full] of keys) {
        if (v[k] === undefined) {
          if (!full.endsWith('?')) bad(`"${k}" is missing`);
        } else check(v[k], s.shape[full], `${path}.${k}`, out);
      }
      break;
    }
    default:
      throw new Error(`schema type ${s.t}`);
  }
  return out;
}

// ---------------------------------------------------------------- load

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const optJson = (root, rel) => (existsSync(join(root, rel)) ? readJson(root, rel) : null);

/** Everything the generator reads. */
export function load(root = ROOT) {
  const dir = 'content/weapons';
  const files = readdirSync(join(root, dir)).filter((f) => f.endsWith('.json') && f !== 'families.json').sort();
  return {
    families: readJson(root, `${dir}/families.json`),
    weapons: files.map((f) => ({ file: `${dir}/${f}`, data: readJson(root, `${dir}/${f}`) })),
    throwables: optJson(root, 'content/throwables.json'),
    classes: optJson(root, 'content/classes.json'),
    abilities: optJson(root, 'content/abilities.json'),
    lock: optJson(root, LOCK) ?? { weapons: {}, throwables: {}, classes: {} },
  };
}

// ---------------------------------------------------------------- validate

const strip = ({ code: _c, notes: _n, $comment: _x, ...rest }) => rest;

/**
 * Check everything and build the tables. Returns { problems, out } where out holds the resolved tables (in code order)
 * and the new lock.
 */
export function build(content, root = ROOT) {
  const problems = [];
  const families = content.families;
  const familyIds = Object.keys(families.families ?? {});
  const S = schemas(root, familyIds);
  for (const [id, f] of Object.entries(families.families ?? {})) check(f, S.family, `families.json: families.${id}`, problems);

  const sounds = new Set(Object.keys(readJson(root, 'content/sounds.json').sounds));
  const procedural = new Set([...readFileSync(join(root, 'packages/client/src/content/models.ts'), 'utf8').matchAll(/path === '(procedural\/[\w-]+)'/g)].map((m) => m[1]));
  const modelExists = (p) => procedural.has(p) || existsSync(join(root, 'packages/client/public/models', p));

  const lock = { weapons: { ...content.lock.weapons }, throwables: { ...(content.lock.throwables ?? {}) }, classes: { ...(content.lock.classes ?? {}) } };
  /** Codes: unique, and a code once given always names the same thing (also after it is retired). */
  const codes = (what, items, min) => {
    const seen = new Map();
    const given = new Map(Object.entries(lock[what]).map(([id, c]) => [c, id]));
    for (const { id, code, where } of items) {
      if (!Number.isInteger(code) || code < min) {
        problems.push(`${where}: code must be a whole number from ${min}`);
        continue;
      }
      if (seen.has(code)) problems.push(`${where}: code ${code} is also ${seen.get(code)}'s`);
      seen.set(code, id);
      if (lock[what][id] !== undefined && lock[what][id] !== code) problems.push(`${where}: ${id} has code ${lock[what][id]} (${LOCK}); a code never changes`);
      else if (given.has(code) && given.get(code) !== id) problems.push(`${where}: code ${code} was ${given.get(code)}'s (${LOCK}); codes are never reused`);
      else lock[what][id] = code;
    }
  };

  // Weapons.
  const weapons = [];
  for (const { file, data } of content.weapons) {
    // The file's own order, with the defaults it leaves out just before its view.
    const def = {};
    const fill = () => Object.entries(families.defaults).forEach(([k, v]) => !(k in data) && (def[k] = v));
    for (const [k, v] of Object.entries(data)) {
      if (k === 'view') fill();
      def[k] = v;
    }
    if (!('view' in data)) fill();
    const p = check(def, S.weapon, file);
    problems.push(...p);
    if (!def.view || !Array.isArray(def.botRange)) continue;
    const name = file.replace(/^.*\//, '').replace(/\.json$/, '');
    if (def.id !== `core.${name}`) problems.push(`${file}: id must be core.${name}`);
    if (def.slot < 0 || def.slot > 9) problems.push(`${file}: slot ${def.slot} is not 0-9`);
    if (def.botRange[0] > def.botRange[1]) problems.push(`${file}: botRange runs backwards`);
    for (const m of [def.view.model, def.view.fallback]) if (m && !modelExists(m)) problems.push(`${file}: model ${m} not found under packages/client/public/models`);
    const sound = def.view.sound ?? `fire.${name}`;
    if (!sounds.has(sound)) problems.push(`${file}: sound ${sound} is not in content/sounds.json`);
    if (def.view.altShot && !sounds.has(def.view.altShot.sound)) problems.push(`${file}: sound ${def.view.altShot.sound} is not in content/sounds.json`);
    if (def.magazine > 0 && def.kind !== 'melee' && !def.ammo && def.reserveMax > 0) problems.push(`${file}: a weapon with a reserve needs an ammo type`);
    if (!p.length) weapons.push({ code: def.code, id: def.id, notes: def.notes, def: strip(def), file });
  }
  codes('weapons', weapons.map((w) => ({ id: w.id, code: w.code, where: w.file })), 1);
  weapons.sort((a, b) => a.code - b.code);
  const weaponIds = new Set(weapons.map((w) => w.id));

  // Throwables.
  let throwables = null;
  if (content.throwables) {
    throwables = [];
    for (const [i, t] of (content.throwables.throwables ?? []).entries()) {
      const where = `content/throwables.json: throwables[${i}]`;
      const p = check(t, S.throwable, where);
      problems.push(...p);
      if (!p.length) throwables.push({ code: t.code, kind: t.kind, notes: t.notes, def: strip(t), where });
    }
    codes('throwables', throwables.map((t) => ({ id: t.kind, code: t.code, where: t.where })), 0);
    throwables.sort((a, b) => a.code - b.code);
    // Snapshots send a throwable as its code, read back by position: codes run 0, 1, 2... with no gaps.
    throwables.forEach((t, i) => t.code !== i && problems.push(`${t.where}: throwable codes must run 0-${throwables.length - 1} with no gaps`));
  }

  // Abilities (numbers per kind; their behaviour is in sim/classes.ts).
  const abilities = content.abilities?.abilities ?? null;
  if (content.abilities) {
    const shapes = {
      sentry: obj({ rebuildSeconds: num, dispenser: obj({ radius: num, hps: num, ammo: num }), 'notes?': notes }),
      cloak: obj({ seconds: num, rechargeSeconds: num, 'notes?': notes }),
      overcharge: obj({ seconds: num, healing: num, 'notes?': notes }),
    };
    for (const [k, a] of Object.entries(abilities ?? {})) {
      if (!shapes[k]) problems.push(`content/abilities.json: unknown ability "${k}" (its behaviour has to be written in sim/classes.ts first)`);
      else check(a, shapes[k], `content/abilities.json: abilities.${k}`, problems);
    }
    for (const k of Object.keys(shapes)) if (!abilities?.[k]) problems.push(`content/abilities.json: abilities.${k} is missing`);
  }

  // Classes.
  let classes = null;
  if (content.classes) {
    const kinds = new Set((throwables ?? []).map((t) => t.kind));
    const classShape = obj({
      id: str, code: int, name: str, role: en(['Offence', 'Defence', 'Support']), blurb: str, health: num, speed: num, 'airJumps?': int,
      weapons: arr(str, 1), 'throwable?': obj({ kind: str, count: int }), 'ability?': en(Object.keys(abilities ?? {})), 'backstab?': bool, 'notes?': notes,
    });
    classes = [];
    for (const [i, c] of (content.classes.classes ?? []).entries()) {
      const where = `content/classes.json: classes[${i}] (${c?.id})`;
      const p = check(c, classShape, where);
      problems.push(...p);
      if (p.length) continue;
      for (const w of c.weapons) if (!weaponIds.has(w)) problems.push(`${where}: weapon ${w} doesn't exist`);
      if (c.throwable && throwables && !kinds.has(c.throwable.kind)) problems.push(`${where}: throwable ${c.throwable.kind} doesn't exist`);
      classes.push({ code: c.code, id: c.id, notes: c.notes, def: strip(c), where });
    }
    codes('classes', classes.map((c) => ({ id: c.id, code: c.code, where: c.where })), 0);
    classes.sort((a, b) => a.code - b.code);
    // The class screen and snapshots send a class as its code, read back by position: 0, 1, 2... with no gaps.
    classes.forEach((c, i) => c.code !== i && problems.push(`${c.where}: class codes must run 0-${classes.length - 1} with no gaps`));
  }

  // Nothing given a code may silently disappear: it stays in the lock (retired), so its code is never reused.
  return { problems, out: { families, familyIds, weapons, throwables, classes, abilities, lock } };
}

// ---------------------------------------------------------------- write

const IDENT = /^[A-Za-z_$][\w$]*$/;
const sq = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const numTs = (n) => (Object.is(n, -0) ? '-0' : String(n));
const key = (k) => (IDENT.test(k) ? k : sq(k));
function tsInline(v) {
  if (v === null) return 'null';
  if (typeof v === 'number') return numTs(v);
  if (typeof v === 'string') return sq(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(tsInline).join(', ')}]`;
  return `{ ${Object.entries(v).map(([k, x]) => `${key(k)}: ${tsInline(x)}`).join(', ')} }`;
}
function ts(v, ind) {
  const one = tsInline(v);
  if (v === null || typeof v !== 'object' || Array.isArray(v) || one.length + ind.length <= 120) return one;
  const next = `${ind}  `;
  return `{\n${Object.entries(v).map(([k, x]) => `${next}${key(k)}: ${ts(x, next)},`).join('\n')}\n${ind}}`;
}
const comments = (notes, ind) => Object.entries(notes ?? {}).map(([k, n]) => `${ind}// ${k}: ${n}\n`).join('');

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/weapons.mjs from content/weapons/*.json, content/throwables.json, content/classes.json');
  L.push('// and content/abilities.json. Do not edit by hand: edit the JSON and run `node tools/content/weapons.mjs`.');
  if (out.classes) L.push("import type { ClassDef } from '../sim/classes.ts';");
  L.push("import type { FamilyDefaults } from '../sim/gunplay.ts';");
  L.push(`import type { ${out.throwables ? 'ThrowableDefinition, ' : ''}WeaponDefinition } from '../sim/weapons.ts';`);
  L.push('');
  L.push('/** Weapon families (spec §34): they carry the defaults below. */');
  L.push(`export const WEAPON_FAMILIES = [${out.familyIds.map(sq).join(', ')}] as const;`);
  L.push('');
  L.push('/** Family baselines (spec §4 velocities, §11 body multipliers, §37 falloff): content/weapons/families.json. */');
  L.push('export const FAMILY_DEFAULTS: Readonly<Record<(typeof WEAPON_FAMILIES)[number], FamilyDefaults>> = {');
  for (const id of out.familyIds) {
    const { notes, ...f } = out.families.families[id];
    L.push(`${comments(notes, '  ')}  ${key(id)}: ${ts(f, '  ')},`);
  }
  L.push('};');
  L.push('');
  L.push('/** Every weapon, in network-code order (content/weapons/<name>.json over families.json `defaults`). */');
  L.push('export const CORE_WEAPONS: Readonly<Record<string, WeaponDefinition>> = {');
  for (const w of out.weapons) L.push(`${comments(w.notes, '  ')}  ${sq(w.id)}: ${ts(w.def, '  ')},`);
  L.push('};');
  L.push('');
  L.push('/** Network codes (wire and inventory key): never changed, never reused (content/codes.lock.json). */');
  L.push(`export const WEAPON_CODES: Readonly<Record<string, number>> = { ${out.weapons.map((w) => `${sq(w.id)}: ${w.code}`).join(', ')} };`);
  if (out.throwables) {
    L.push('');
    L.push('/** Thrown equipment (G), in code order: a snapshot sends the code (its index here). */');
    L.push(`export const THROWABLES = [${out.throwables.map((t) => sq(t.kind)).join(', ')}] as const;`);
    L.push('export const THROWABLE_DEFS: Readonly<Record<(typeof THROWABLES)[number], ThrowableDefinition>> = {');
    for (const t of out.throwables) {
      const { code: _c, ...def } = t.def;
      L.push(`${comments(t.notes, '  ')}  ${key(t.kind)}: ${ts(def, '  ')},`);
    }
    L.push('};');
  }
  if (out.abilities) {
    L.push('');
    L.push('/** Class abilities: their numbers (content/abilities.json); behaviour in sim/classes.ts. */');
    L.push(`export const CLASS_ABILITIES = [${Object.keys(out.abilities).map(sq).join(', ')}] as const;`);
    L.push('export const ABILITIES = {');
    for (const [k, a] of Object.entries(out.abilities)) {
      const { notes, ...rest } = a;
      L.push(`${comments(notes, '  ')}  ${key(k)}: ${ts(rest, '  ')},`);
    }
    L.push('} as const;');
  }
  if (out.classes) {
    L.push('');
    L.push('/** Classes in code order: the class screen and snapshots send the code (its index here). */');
    L.push(`export const CLASS_IDS = [${out.classes.map((c) => sq(c.id)).join(', ')}] as const;`);
    L.push('export const CLASS_DEFS: Readonly<Record<(typeof CLASS_IDS)[number], ClassDef>> = {');
    for (const c of out.classes) {
      const { code: _c, ...def } = c.def;
      L.push(`${comments(c.notes, '  ')}  ${key(c.id)}: ${ts(def, '  ')},`);
    }
    L.push('};');
  }
  return `${L.join('\n')}\n`;
}

const byCode = (m) => Object.fromEntries(Object.entries(m).sort((a, b) => a[1] - b[1]));
export const lockText = (lock) =>
  `${JSON.stringify(
    {
      $comment: 'Every network code ever given (tools/content/weapons.mjs keeps it): a code never changes and is never reused, also after its weapon, throwable or class is gone.',
      weapons: byCode(lock.weapons),
      throwables: byCode(lock.throwables),
      classes: byCode(lock.classes),
    },
    null,
    2,
  )}\n`;

// ---------------------------------------------------------------- main

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`weapons: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const files = [
    [GENERATED, render(out)],
    [LOCK, lockText(out.lock)],
  ];
  const stale = files.filter(([rel, text]) => !existsSync(join(ROOT, rel)) || readFileSync(join(ROOT, rel), 'utf8') !== text).map(([rel]) => rel);
  if (checkOnly) {
    if (stale.length) {
      console.error(`weapons: out of date: ${stale.join(', ')} (run node tools/content/weapons.mjs)`);
      process.exit(1);
    }
  } else for (const [rel, text] of files) if (stale.includes(rel)) writeFileSync(join(ROOT, rel), text);
  console.log(`weapons OK: ${out.weapons.length} weapons, ${out.throwables?.length ?? 0} throwables, ${out.classes?.length ?? 0} classes${checkOnly ? '' : stale.length ? `; wrote ${stale.join(', ')}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
