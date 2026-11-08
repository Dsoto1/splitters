// Vehicles, turrets and sentries as data (docs/CONTENT_SCALABILITY.md step 4; how to add one: docs/CONTENT_PIPELINE.md,
// "How to add a vehicle or turret").
//
//   node tools/content/vehicles.mjs           check the content and write the generated file
//   node tools/content/vehicles.mjs --check   check the content, and that the generated file is up to date
//
// Reads content/vehicles/<id>.json (one mount each: its tuning, seats, mounted weapons, drawing numbers and design
// notes). Checks the schema (unknown fields are errors) and the references (weapons exist and are mounted ones, slot 0;
// models exist; the vehicle sounds every mount plays exist; seats fit their kind; the palette `order` is unique), then
// writes packages/shared/src/content/mounts.generated.ts. Behaviour stays in code (sim/mounts.ts helpers, the match's
// driving, suspension, sentries and arc lock): the data gives the numbers.
//
// Mounts have no network code: a mount travels as its map entity index and a map names it by id. Never rename an id
// (saved maps name it). `order` is MapMaker's palette and inspector order. The two route crafts (`airplane: true`:
// the transport plane and the dropship on a drop route) are not placeable and have no `order`.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, comments, key, shape, sq, tsInline } from './weapons.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = 'content/vehicles';
const GENERATED = 'packages/shared/src/content/mounts.generated.ts';
/** The route crafts the code names (sim/mounts.ts AIRPLANE_DEF, DROPSHIP_DROP_DEF). */
export const ROUTE_CRAFTS = ['airplane', 'dropship_drop'];
/** Sounds every mount plays (client: explosion when destroyed, crashes). */
const MOUNT_SOUNDS = ['explosion.vehicle', 'vehicle.crash'];

// ---------------------------------------------------------------- schema

const { num, int, str, bool, en, tup, arr, obj, vec3, notes } = shape;

export function schemas() {
  const seat = obj({
    role: en(['driver', 'gunner', 'passenger']), label: str, offset: vec3, 'weapon?': str, 'arc?': num, 'facing?': num, 'seated?': bool, 'legDrop?': num, 'straddle?': num,
    'ammo?': obj({ max: int, 'start?': int, refillSeconds: num }), 'driverFires?': bool,
  });
  const armour = obj({ 'surface?': str, 'sealed?': bool, 'bullets?': num, 'blasts?': num, 'melee?': num });
  const suspension = obj({
    'wheels?': arr(tup(2), 1), 'hub?': num, travel: num, bump: num, freq: num, damping: num, squat: num, lean: num, tumble: num, land: num,
    maxTilt: num, steer: num,
  });
  const vehicle = obj({
    maxSpeed: num, reverseSpeed: num, accel: num, turnRate: num, 'hover?': bool, 'grip?': num, 'mass?': num,
    'fly?': obj({ climb: num, ceiling: num }), 'draft?': num, 'suspension?': suspension, 'drift?': num, 'pivot?': num, 'idleBrake?': num, 'routeFit?': num,
  });
  const sentry = obj({ weapon: str, range: num, turnRate: num, 'arc?': obj({ windUpSeconds: num, lockSeconds: num, ventSeconds: num }) });
  const mount = obj({
    id: str, 'order?': int, displayName: str, kind: en(['turret', 'sentry', 'vehicle']), model: str, health: num, half: vec3, seats: arr(seat),
    enterRadius: num, respawnSeconds: num, blast: obj({ radius: num, damage: num }), 'vehicle?': vehicle, 'sentry?': sentry, 'glow?': str,
    'airplane?': bool, 'rideHeight?': num, 'wheels?': obj({ model: str, at: arr(vec3, 1) }), 'cockpitEye?': vec3, 'turret?': obj({ seat: int, 'pitch?': tup(2) }), 'fallback?': str, 'armour?': armour, 'bailHealth?': num, blurb: str, 'notes?': notes,
  });
  return { mount, seat };
}

// ---------------------------------------------------------------- load

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

export function load(root = ROOT) {
  const files = readdirSync(join(root, DIR)).filter((f) => f.endsWith('.json')).sort();
  return { mounts: files.map((f) => ({ file: `${DIR}/${f}`, data: readJson(root, `${DIR}/${f}`) })) };
}

/** Weapon id -> slot, from content/weapons/<name>.json. */
function weaponSlots(root) {
  const dir = join(root, 'content/weapons');
  const out = new Map();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'families.json') continue;
    const w = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    out.set(w.id, w.slot);
  }
  return out;
}

// ---------------------------------------------------------------- validate

const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

/** Check everything and build the tables: { problems, out: { mounts (placeable, palette order), crafts } }. */
export function build(content, root = ROOT) {
  const problems = [];
  const S = schemas();
  const slots = weaponSlots(root);
  const sounds = new Set(Object.keys(readJson(root, 'content/sounds.json').sounds));
  for (const s of MOUNT_SOUNDS) if (!sounds.has(s)) problems.push(`content/sounds.json: ${s} is missing (every mount plays it)`);
  const surfaces = new Set(readJson(root, 'content/surface-types.json').types.map((t) => t.id));
  const procedural = new Set([...readFileSync(join(root, 'packages/client/src/content/models.ts'), 'utf8').matchAll(/path === '(procedural\/[\w-]+)'/g)].map((m) => m[1]));
  const modelExists = (p) => procedural.has(p) || existsSync(join(root, 'packages/client/public/models', p));
  const mountedWeapon = (where, w) => {
    if (!slots.has(w)) problems.push(`${where}: weapon ${w} doesn't exist (content/weapons)`);
    else if (slots.get(w) !== 0) problems.push(`${where}: weapon ${w} is not a mounted one (slot ${slots.get(w)}, not 0)`);
  };

  const mounts = [];
  const crafts = [];
  const orders = new Map();
  for (const { file, data } of content.mounts) {
    const p = check(data, S.mount, file);
    problems.push(...p);
    if (p.length) continue;
    const d = data;
    const name = file.replace(/^.*\//, '').replace(/\.json$/, '');
    if (d.id !== name) problems.push(`${file}: id must be ${name} (the file name)`);
    if (!/^[a-z][a-z0-9_]*$/.test(d.id)) problems.push(`${file}: id must be lower case letters, digits and _`);
    for (const m of [d.model, d.wheels?.model, d.fallback]) if (m && !modelExists(m)) problems.push(`${file}: model ${m} not found under packages/client/public/models`);
    if (d.glow !== undefined && !isHex(d.glow)) problems.push(`${file}: glow must be a colour like #8f7bff`);
    if (d.turret && !d.seats[d.turret.seat]?.weapon) problems.push(`${file}: turret.seat must be a seat with a mounted weapon (its aim turns the model's turret and barrel)`);
    if (d.turret?.pitch && !(d.turret.pitch[0] <= 0 && d.turret.pitch[1] >= 0)) problems.push(`${file}: turret.pitch is [lowest, highest] drawn barrel pitch (rad), lowest ≤ 0 ≤ highest`);
    if (d.health <= 0) problems.push(`${file}: health must be above 0`);
    if (d.half.some((h) => h <= 0)) problems.push(`${file}: half sizes must be above 0`);
    if (d.respawnSeconds < 0 || d.enterRadius < 0 || d.blast.radius < 0 || d.blast.damage < 0) problems.push(`${file}: respawnSeconds, enterRadius and blast can't be negative`);
    if (d.armour) {
      const a = d.armour;
      if (a.surface !== undefined && !surfaces.has(a.surface)) problems.push(`${file}: armour.surface ${a.surface} is not a surface type (content/surface-types.json)`);
      for (const k of ['bullets', 'blasts', 'melee']) if (a[k] !== undefined && (a[k] < 0 || a[k] > 5)) problems.push(`${file}: armour.${k} is the share of that damage taken, 0 to 5`);
      if (a.sealed && d.kind !== 'vehicle') problems.push(`${file}: armour.sealed is for vehicles (a crew shut in)`);
    }
    if (d.bailHealth !== undefined && (d.bailHealth <= 0 || d.bailHealth >= 1)) problems.push(`${file}: bailHealth is a share of health, above 0 and under 1`);
    if (d.seats.filter((s) => s.driverFires).length > 1) problems.push(`${file}: only one seat can be driverFires`);

    // Seats by kind.
    const roles = d.seats.map((s) => s.role);
    d.seats.forEach((s, i) => {
      const where = `${file}: seats[${i}] (${s.label})`;
      if (s.weapon) mountedWeapon(where, s.weapon);
      if (s.role === 'gunner' && !s.weapon) problems.push(`${where}: a gunner seat needs a weapon`);
      if (s.role === 'passenger' && s.weapon) problems.push(`${where}: passengers shoot their own weapons (no weapon)`);
      if (s.arc !== undefined && (s.arc <= 0 || s.arc > Math.PI)) problems.push(`${where}: arc must be above 0 and at most π (leave it out for all round)`);
      if (s.arc !== undefined && !s.weapon) problems.push(`${where}: an arc only limits a mounted weapon`);
      if (s.legDrop !== undefined && !s.seated) problems.push(`${where}: legDrop is for seated riders`);
      if (s.straddle !== undefined && !s.seated) problems.push(`${where}: straddle is for seated riders`);
      if (s.straddle !== undefined && (s.straddle < 0 || s.straddle > 0.8)) problems.push(`${where}: straddle must be 0 to 0.8 rad`);
      if (s.ammo && !s.weapon) problems.push(`${where}: ammo is for a mounted weapon`);
      if (s.ammo && (s.ammo.max < 1 || s.ammo.refillSeconds < 0 || (s.ammo.start !== undefined && (s.ammo.start < 0 || s.ammo.start > s.ammo.max)))) problems.push(`${where}: ammo needs max 1 or more, refillSeconds 0 or more (0: none back over time) and start 0 to max`);
      if (s.driverFires && (s.role !== 'gunner' || !s.weapon)) problems.push(`${where}: driverFires is for a gunner seat with a weapon`);
      if (s.driverFires && d.seats.some((x) => x.role === 'driver' && x.weapon)) problems.push(`${where}: driverFires needs a driver without a weapon of their own`);
      if (s.driverFires && d.kind !== 'vehicle') problems.push(`${where}: driverFires is for vehicles (a driver)`);
    });
    if (d.kind === 'turret') {
      if (!d.seats.length || roles.some((r) => r !== 'gunner')) problems.push(`${file}: a turret has gunner seats only (at least one)`);
      if (d.vehicle || d.sentry) problems.push(`${file}: a turret has no vehicle or sentry block`);
    } else if (d.kind === 'sentry') {
      if (d.seats.length || d.enterRadius !== 0) problems.push(`${file}: a sentry has no seats and enterRadius 0`);
      if (!d.sentry) problems.push(`${file}: a sentry needs a sentry block`);
      else mountedWeapon(`${file}: sentry`, d.sentry.weapon);
      if (d.vehicle) problems.push(`${file}: a sentry has no vehicle block`);
    } else if (d.airplane) {
      if (d.vehicle || d.sentry) problems.push(`${file}: a route craft has no vehicle or sentry block (it flies its route)`);
      if (roles.some((r) => r !== 'passenger')) problems.push(`${file}: a route craft carries passengers only`);
    } else {
      if (!d.vehicle) problems.push(`${file}: a vehicle needs a vehicle block`);
      if (roles.filter((r) => r === 'driver').length !== 1) problems.push(`${file}: a vehicle has exactly one driver seat`);
      if (d.sentry) problems.push(`${file}: a vehicle has no sentry block`);
    }
    if (d.sentry && d.kind !== 'sentry') problems.push(`${file}: only a sentry has a sentry block`);
    if (d.vehicle && d.vehicle.reverseSpeed > d.vehicle.maxSpeed) problems.push(`${file}: reverseSpeed is above maxSpeed`);

    // Placeable ones have a palette order; the route crafts don't.
    const { order, notes: n, ...def } = d;
    if (d.airplane) {
      if (!ROUTE_CRAFTS.includes(d.id)) problems.push(`${file}: a route craft (airplane: true) must be one of ${ROUTE_CRAFTS.join(', ')} (the code names them)`);
      if (order !== undefined) problems.push(`${file}: a route craft is not placeable (no order)`);
      crafts.push({ id: d.id, notes: n, def, file });
    } else {
      if (ROUTE_CRAFTS.includes(d.id)) problems.push(`${file}: ${d.id} is a route craft (airplane: true)`);
      if (order === undefined) problems.push(`${file}: a placeable mount needs an order (MapMaker palette)`);
      else if (orders.has(order)) problems.push(`${file}: order ${order} is also ${orders.get(order)}'s`);
      else orders.set(order, d.id);
      mounts.push({ id: d.id, order, notes: n, def, file });
    }
  }
  for (const id of ROUTE_CRAFTS) if (!crafts.some((c) => c.id === id)) problems.push(`${DIR}/${id}.json is missing (the code names it)`);
  mounts.sort((a, b) => a.order - b.order);
  crafts.sort((a, b) => ROUTE_CRAFTS.indexOf(a.id) - ROUTE_CRAFTS.indexOf(b.id));
  return { problems, out: { mounts, crafts } };
}

// ---------------------------------------------------------------- write

/** TypeScript for a value: one line when it fits, objects and lists of objects broken over lines. */
function ts(v, ind) {
  const one = tsInline(v);
  if (v === null || typeof v !== 'object' || one.length + ind.length <= 120) return one;
  const next = `${ind}  `;
  if (Array.isArray(v)) return `[\n${v.map((x) => `${next}${ts(x, next)},`).join('\n')}\n${ind}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${next}${key(k)}: ${ts(x, next)},`).join('\n')}\n${ind}}`;
}

export function render(out) {
  const L = [];
  L.push('// Generated by tools/content/vehicles.mjs from content/vehicles/*.json. Do not edit by hand: edit the JSON and run');
  L.push('// `node tools/content/vehicles.mjs`.');
  L.push("import type { MountDef } from '../sim/mounts.ts';");
  L.push('');
  L.push('/** Placeable mounts, in MapMaker palette order (`order`). Maps name a mount by id: never rename one. */');
  L.push(`export const MOUNT_MODELS = [${out.mounts.map((m) => sq(m.id)).join(', ')}] as const;`);
  L.push('');
  L.push('export const MOUNT_DEFS: Readonly<Record<(typeof MOUNT_MODELS)[number], MountDef>> = {');
  for (const m of out.mounts) L.push(`${comments(m.notes, '  ')}  ${key(m.id)}: ${ts(m.def, '  ')},`);
  L.push('};');
  L.push('');
  L.push('/** The route crafts (`airplane` map entities): not placeable, they fly their entity\'s route. */');
  L.push(`export const ROUTE_CRAFT_DEFS: Readonly<Record<${out.crafts.map((c) => sq(c.id)).join(' | ')}, MountDef>> = {`);
  for (const c of out.crafts) L.push(`${comments(c.notes, '  ')}  ${key(c.id)}: ${ts(c.def, '  ')},`);
  L.push('};');
  return `${L.join('\n')}\n`;
}

// ---------------------------------------------------------------- main

function main() {
  const checkOnly = process.argv.includes('--check');
  const { problems, out } = build(load());
  if (problems.length) {
    console.error(`vehicles: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const text = render(out);
  const stale = !existsSync(join(ROOT, GENERATED)) || readFileSync(join(ROOT, GENERATED), 'utf8') !== text;
  if (checkOnly && stale) {
    console.error(`vehicles: out of date: ${GENERATED} (run node tools/content/vehicles.mjs)`);
    process.exit(1);
  }
  if (!checkOnly && stale) writeFileSync(join(ROOT, GENERATED), text);
  console.log(`vehicles OK: ${out.mounts.length} mounts, ${out.crafts.length} route crafts${checkOnly ? '' : stale ? `; wrote ${GENERATED}` : '; up to date'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
