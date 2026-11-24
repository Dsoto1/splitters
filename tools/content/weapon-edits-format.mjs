// The Weapon Manager's change set (docs/FEATURES.md, "Weapon Manager"; docs/GUNPLAY_SPEC.md §45 note): the one file
// the owner's page (`?mode=weapons`, Manage) sends and `node tools/content/apply-weapon-edits.mjs <file>` applies.
// Pure and browser-safe: the page imports it to check edits before they are sent, the repo tool to check them again
// before writing anything. No player uploads: the page only produces this file; the game's data stays in the repo.
//
// A change set (version 1):
//   {
//     "format": "tiletrigger.weapon-edits", "version": 1, "created": "<ISO time>", "from": "<what made it>",
//     "weapons": {
//       "<weapon id>": {
//         "name": "New display name",
//         "hidden": true | false,                      true hides it, false shows it again
//         "category": "smg",                           one of WEAPON_CATEGORIES (only for a weapon that has one)
//         "description": "One line for the team",      its `notes.description` ("" removes it)
//         "sounds": { "fire": "<sound id>", "alt": "<sound id>", "reload": "<sound id>",
//                     "explosion": "<sound id>" | "none", "impact": "<sound id>" | "none" },
//         "sets": { "<set id>": true | false },        in or out of a weapon set's list
//         "stats": { "<path>": <number or list> },     STAT_FIELDS below, within their ranges
//         "note": "free text for the team",            becomes a QUEUE line ("Weapon notes from the owner")
//         "was": { ... }                               what the page saw before the edit (for review; never applied)
//       }
//     },
//     "throwables": {                                optional: thrown equipment (content/throwables.json), by kind
//       "<kind>": { "sounds": { "explosion": "<sound id>" | "none" }, "note": "free text", "was": { ... } }
//     }
//   }

export const CHANGE_SET_FORMAT = 'tiletrigger.weapon-edits';
export const CHANGE_SET_VERSION = 1;
export const TEXT_LIMITS = { name: 40, description: 300, note: 1000 };
/**
 * The sounds a weapon can pick: its shot, its second trigger's shot (only a weapon with one), its reload's start, its
 * explosion (only a weapon that blows something up: in place of the shared `explosion`, the debris still under it) and
 * its impact (a hit sound layered on the struck surface's own). Explosion and impact are none until picked, and
 * "none" (NO_SOUND) puts one back to none.
 */
export const SOUND_SLOTS = ['fire', 'alt', 'reload', 'explosion', 'impact'];
/** The slots that may be "none" (nothing of the weapon's own: the shared sounds only). */
export const OPTIONAL_SOUND_SLOTS = ['explosion', 'impact'];
export const NO_SOUND = 'none';
/** The sounds a throwable can pick: its explosion (only one that blows up). */
export const THROWABLE_SOUND_SLOTS = ['explosion'];
export const THROWABLE_EDIT_KEYS = ['sounds', 'note', 'was'];
/** Where a weapon or throwable keeps each optional sound: `view.<key>` of a weapon, `<key>` of a throwable. */
export const SOUND_KEYS = { explosion: 'explosionSound', impact: 'impactSound' };
export const EDIT_KEYS = ['name', 'hidden', 'category', 'description', 'sounds', 'sets', 'stats', 'note', 'was'];

/**
 * The stats the manager edits: the path in a weapon's content file, a label, the unit the page shows (`scale`
 * multiplies the stored value for it), the valid range of the stored value, whole numbers only, and when a weapon
 * has it (`when`, a test on weaponInfo). Ranges keep values playable and inside what the sim handles; the content
 * generator's own checks (handling 0.85-1.1 and 0-18 ticks) are the same here.
 */
export const STAT_FIELDS = [
  { path: 'damage', label: 'Damage', unit: 'a hit', min: 0, max: 1000, when: () => true },
  { path: 'pellets', label: 'Pellets', unit: 'a shot', min: 1, max: 32, int: true, when: (w) => w.pellets > 1 },
  { path: 'fireIntervalTicks', label: 'Fire interval', unit: 'ticks', min: 1, max: 240, int: true, when: () => true },
  { path: 'magazine', label: 'Magazine', unit: 'rounds', min: 1, max: 500, int: true, when: (w) => w.magazine > 0 },
  { path: 'reserveMax', label: 'Reserve', unit: 'rounds', min: 0, max: 2000, int: true, when: (w) => w.magazine > 0 },
  { path: 'reloadTicks', label: 'Reload', unit: 'ticks', min: 0, max: 600, int: true, when: (w) => w.magazine > 0 && !w.reloadType },
  { path: 'reload.tactical', label: 'Reload (rounds left)', unit: 'ticks', min: 1, max: 600, int: true, when: (w) => w.reloadType === 'magazine' },
  { path: 'reload.empty', label: 'Reload (empty)', unit: 'ticks', min: 1, max: 600, int: true, when: (w) => w.reloadType === 'magazine' },
  { path: 'reload.start', label: 'Reload start', unit: 'ticks', min: 0, max: 300, int: true, when: (w) => w.reloadType === 'shell' },
  { path: 'reload.each', label: 'Reload a shell', unit: 'ticks', min: 1, max: 300, int: true, when: (w) => w.reloadType === 'shell' },
  { path: 'reload.end', label: 'Reload end', unit: 'ticks', min: 0, max: 300, int: true, when: (w) => w.reloadType === 'shell' },
  { path: 'raiseTicks', label: 'Draw', unit: 'ticks', min: 0, max: 120, int: true, when: () => true },
  { path: 'range', label: 'Range', unit: 'm', min: 0, max: 2000, when: (w) => w.kind !== 'projectile' },
  { path: 'falloff.start', label: 'Falloff starts', unit: 'm', min: 0, max: 2000, when: (w) => w.hasFalloff },
  { path: 'falloff.end', label: 'Falloff ends', unit: 'm', min: 0, max: 2000, when: (w) => w.hasFalloff },
  { path: 'falloff.min', label: 'Damage at the end', unit: '%', scale: 100, min: 0, max: 1, when: (w) => w.hasFalloff },
  { path: 'headshot', label: 'Headshot', unit: '×', min: 1, max: 5, when: (w) => w.kind !== 'melee' },
  { path: 'spread', label: 'Spread', unit: 'mrad', scale: 1000, min: 0, max: 0.2, when: (w) => w.kind === 'hitscan' && !w.hasAccuracy },
  { path: 'accuracy.base', label: 'Hip spread', unit: 'mrad', scale: 1000, min: 0, max: 0.2, when: (w) => w.hasAccuracy },
  { path: 'accuracy.ads', label: 'Sights spread', unit: '× hip', min: 0.05, max: 1, when: (w) => w.hasAccuracy },
  { path: 'kick.pitch', label: 'Recoil up', unit: 'mrad', scale: 1000, min: 0, max: 0.2, list: true, when: (w) => w.hasKick },
  { path: 'kick.yaw', label: 'Recoil sideways', unit: 'mrad', scale: 1000, min: -0.2, max: 0.2, list: true, when: (w) => w.hasKick },
  { path: 'ballistic.velocity', label: 'Bullet speed', unit: 'm/s', min: 50, max: 2000, when: (w) => w.hasBallistic },
  { path: 'projectile.speed', label: 'Projectile speed', unit: 'm/s', min: 1, max: 500, when: (w) => w.hasProjectile },
  { path: 'projectile.splashDamage', label: 'Splash damage', unit: '', min: 0, max: 1000, when: (w) => w.hasProjectile },
  { path: 'projectile.splashRadius', label: 'Splash radius', unit: 'm', min: 0, max: 20, when: (w) => w.hasProjectile },
  { path: 'handling.move', label: 'Move speed', unit: '%', scale: 100, min: 0.85, max: 1.1, when: () => true },
  { path: 'handling.sprintExit', label: 'Sprint to fire', unit: 'ticks', min: 0, max: 18, int: true, when: () => true },
];

export const statField = (path) => STAT_FIELDS.find((f) => f.path === path);

/**
 * What decides which stats a weapon has, from its definition (a content file over families.json `defaults`, or the
 * game's resolved table) and its family's block (families.json `families.<id>`, the same as FAMILY_DEFAULTS).
 */
export function weaponInfo(def, family) {
  return {
    kind: def.kind,
    pellets: def.pellets ?? 1,
    magazine: def.magazine ?? 0,
    reloadType: def.reload?.type ?? null,
    hasFalloff: !!(def.falloff ?? family?.falloff),
    hasAccuracy: !!(def.accuracy ?? family?.accuracy),
    hasKick: !!(def.kick ?? family?.kick),
    hasBallistic: def.kind === 'hitscan' && !def.view?.beam && def.ballistic !== null && !!(def.ballistic ?? family?.ballistic),
    hasProjectile: !!def.projectile,
    hasAlt: !!def.view?.altShot,
    blowsUp: blowsUp(def.projectile) || blowsUp(def.alt?.projectile),
    category: def.category ?? null,
  };
}

/** Whether a projectile bursts with a blast (splash damage over a radius): what an explosion sound is for. */
export const blowsUp = (p) => !!p && (p.splashRadius ?? 0) > 0;

export const applicableStats = (info) => STAT_FIELDS.filter((f) => f.when(info));

/** A value at a dotted path of an object (undefined when any step is missing). */
export const getPath = (o, path) => path.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), o);

/** Whether an edit changes nothing. */
export function isEmptyEdit(e) {
  if (!e) return true;
  return (
    e.name === undefined && e.hidden === undefined && e.category === undefined && e.description === undefined && !e.note?.trim() &&
    !Object.keys(e.sounds ?? {}).length && !Object.keys(e.sets ?? {}).length && !Object.keys(e.stats ?? {}).length
  );
}

/** Whether a throwable's edit changes nothing. */
export const isEmptyThrowableEdit = (e) => !e || (!Object.keys(e.sounds ?? {}).length && !e.note?.trim());

/**
 * One change set from the page's edits (weapon id -> edit; `throwables`: kind -> edit), empty edits left out, in id
 * order. The `throwables` block is there only when one is edited.
 */
export function buildChangeSet(edits, { created = new Date().toISOString(), from = 'Weapon Manager', throwables = {} } = {}) {
  const weapons = {};
  for (const id of Object.keys(edits).sort()) {
    const e = edits[id];
    if (isEmptyEdit(e)) continue;
    const out = {};
    for (const k of EDIT_KEYS) {
      const v = e[k];
      if (v === undefined || v === null) continue;
      if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
      if (k === 'note' && !String(v).trim()) continue;
      out[k] = v;
    }
    weapons[id] = out;
  }
  const thrown = {};
  for (const kind of Object.keys(throwables).sort()) {
    const e = throwables[kind];
    if (isEmptyThrowableEdit(e)) continue;
    thrown[kind] = Object.fromEntries(THROWABLE_EDIT_KEYS.filter((k) => e[k] !== undefined && !(k === 'note' && !String(e[k]).trim()) && !(typeof e[k] === 'object' && !Object.keys(e[k]).length)).map((k) => [k, e[k]]));
  }
  return { format: CHANGE_SET_FORMAT, version: CHANGE_SET_VERSION, created, from, weapons, ...(Object.keys(thrown).length ? { throwables: thrown } : {}) };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Problems with one stat value (none: an empty list). `info` is weaponInfo of the weapon it is for.
 */
export function statProblems(path, value, info) {
  const f = statField(path);
  if (!f) return [`${path} is not a stat the manager edits (${STAT_FIELDS.map((x) => x.path).join(', ')})`];
  if (info && !f.when(info)) return [`${path} doesn't apply to this weapon`];
  const one = (v, where) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return [`${where} must be a number, not ${JSON.stringify(v)}`];
    if (f.int && !Number.isInteger(v)) return [`${where} must be a whole number, not ${v}`];
    if (v < f.min || v > f.max) return [`${where} is ${v}, outside ${f.min}-${f.max}`];
    return [];
  };
  if (f.list) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 30) return [`${path} must be a list of 1-30 numbers`];
    return value.flatMap((v, i) => one(v, `${path}[${i}]`));
  }
  return one(value, path);
}

/**
 * Check a change set against the game's data. `ctx`:
 *   weapons     Map of weapon id -> { name, info, current? } (info: weaponInfo; current(path): the stat's value in the
 *               game now, its family's when the weapon leaves it out, for the falloff check and stale warnings)
 *   sounds      Set of sound ids (content/sounds.json)
 *   sets        list of { id, weapons (a list, "all" or absent), spawn?, sniper? } (content/weapon-sets.json)
 *   categories  the weapon categories (WEAPON_CATEGORIES)
 *   blockers    (id) -> reasons it can't be hidden (tools/content/weapons.mjs hideBlockers)
 *   canJoinSet  (id) -> null, or why it can't be in a set's list
 *   throwables  Map of throwable kind -> { name, blowsUp } (absent: a change set with throwables is refused)
 * Returns { problems, warnings }: problems refuse the whole set; warnings (a value changed in the repo since the
 * page saw it) are printed.
 */
export function validateChangeSet(cs, ctx) {
  const problems = [];
  const warnings = [];
  if (!isObj(cs)) return { problems: ['the change set must be a JSON object'], warnings };
  if (cs.format !== CHANGE_SET_FORMAT) problems.push(`"format" must be "${CHANGE_SET_FORMAT}"`);
  if (cs.version !== CHANGE_SET_VERSION) {
    problems.push(
      typeof cs.version === 'number' && cs.version > CHANGE_SET_VERSION
        ? `version ${cs.version} is newer than this tool reads (${CHANGE_SET_VERSION}): update the repo first`
        : `"version" must be ${CHANGE_SET_VERSION}`,
    );
  }
  if (!isObj(cs.weapons)) {
    problems.push('"weapons" must be an object of weapon id -> edit');
    return { problems, warnings };
  }
  // Names after the change: none twice (case and spaces aside).
  const finalName = new Map([...ctx.weapons].map(([id, w]) => [id, w.name]));
  for (const [id, e] of Object.entries(cs.weapons)) if (ctx.weapons.has(id) && isObj(e) && typeof e.name === 'string') finalName.set(id, e.name.trim());
  const nameKey = (n) => n.toLowerCase().replace(/\s+/g, ' ');
  const byName = new Map();
  for (const [id, n] of finalName) byName.set(nameKey(n), [...(byName.get(nameKey(n)) ?? []), id]);

  for (const [id, e] of Object.entries(cs.weapons)) {
    const at = (m) => problems.push(`${id}: ${m}`);
    const w = ctx.weapons.get(id);
    if (!w) {
      at('no weapon has this id');
      continue;
    }
    if (!isObj(e)) {
      at('the edit must be an object');
      continue;
    }
    for (const k of Object.keys(e)) if (!EDIT_KEYS.includes(k)) at(`unknown field "${k}" (${EDIT_KEYS.join(', ')})`);
    if (e.name !== undefined) {
      if (typeof e.name !== 'string' || !e.name.trim()) at('name must be some text');
      else if (e.name.trim().length > TEXT_LIMITS.name) at(`name is longer than ${TEXT_LIMITS.name} characters`);
      else if (CONTROL.test(e.name)) at('name has a control character');
      else {
        const same = (byName.get(nameKey(e.name.trim())) ?? []).filter((x) => x !== id);
        if (same.length) at(`name "${e.name.trim()}" is also ${same.join(', ')}'s`);
      }
    }
    if (e.hidden !== undefined) {
      if (typeof e.hidden !== 'boolean') at('hidden must be true or false');
      else if (e.hidden) for (const why of ctx.blockers(id)) at(`can't be hidden: ${why}`);
    }
    if (e.category !== undefined) {
      if (!ctx.categories.includes(e.category)) at(`category must be one of ${ctx.categories.join(', ')}`);
      else if (!w.info.category) at('has no category to change (tools, mode-only weapons and mounted guns never roll)');
    }
    if (e.description !== undefined) {
      if (typeof e.description !== 'string') at('description must be text');
      else if (e.description.length > TEXT_LIMITS.description) at(`description is longer than ${TEXT_LIMITS.description} characters`);
    }
    if (e.note !== undefined) {
      if (typeof e.note !== 'string') at('note must be text');
      else if (e.note.length > TEXT_LIMITS.note) at(`note is longer than ${TEXT_LIMITS.note} characters`);
    }
    if (e.was !== undefined && !isObj(e.was)) at('was must be an object');
    if (e.sounds !== undefined) {
      if (!isObj(e.sounds)) at('sounds must be an object of slot -> sound id');
      else
        for (const [slot, sid] of Object.entries(e.sounds)) {
          if (!SOUND_SLOTS.includes(slot)) at(`sounds.${slot}: the slots are ${SOUND_SLOTS.join(', ')}`);
          else if (slot === 'alt' && !w.info.hasAlt) at('sounds.alt: this weapon has no second-trigger shot');
          else if (slot === 'explosion' && !w.info.blowsUp) at('sounds.explosion: nothing this weapon fires blows up');
          else if (sid === NO_SOUND && OPTIONAL_SOUND_SLOTS.includes(slot)) continue;
          else if (typeof sid !== 'string' || !ctx.sounds.has(sid)) at(`sounds.${slot}: ${JSON.stringify(sid)} is not a sound in the game (content/sounds.json)`);
        }
    }
    if (e.sets !== undefined) {
      if (!isObj(e.sets)) at('sets must be an object of set id -> true or false');
      else
        for (const [sid, inSet] of Object.entries(e.sets)) {
          const set = ctx.sets.find((s) => s.id === sid);
          if (!set) at(`sets.${sid}: no weapon set has this id`);
          else if (typeof inSet !== 'boolean') at(`sets.${sid} must be true or false`);
          else if (!Array.isArray(set.weapons)) at(`sets.${sid}: this set ${set.weapons === 'all' ? 'holds every weapon a pickup can' : 'leaves weapons as placed'}; it has no list to edit`);
          else if (!inSet && (set.spawn?.includes(id) || set.sniper === id)) at(`sets.${sid}: the set ${set.sniper === id ? "gives it to sniper bots" : 'spawns with it'}; it can't leave`);
          else if (inSet) {
            const why = ctx.canJoinSet(id);
            if (why) at(`sets.${sid}: ${why}`);
          }
        }
    }
    if (e.stats !== undefined) {
      if (!isObj(e.stats)) at('stats must be an object of path -> value');
      else {
        for (const [path, v] of Object.entries(e.stats)) for (const p of statProblems(path, v, w.info)) at(`stats: ${p}`);
        const start = e.stats['falloff.start'] ?? w.current?.('falloff.start');
        const end = e.stats['falloff.end'] ?? w.current?.('falloff.end');
        if (typeof start === 'number' && typeof end === 'number' && end < start) at(`stats: falloff ends (${end} m) before it starts (${start} m)`);
      }
    }
    // Stale: the repo changed since the page saw it.
    if (isObj(e.was)) {
      if (typeof e.was.name === 'string' && e.was.name !== w.name) warnings.push(`${id}: its name is "${w.name}" in the repo now, not "${e.was.name}" as the page saw`);
      if (isObj(e.was.stats))
        for (const [path, v] of Object.entries(e.was.stats)) {
          const now = w.current?.(path);
          if (now !== undefined && JSON.stringify(now) !== JSON.stringify(v)) warnings.push(`${id}: ${path} is ${JSON.stringify(now)} in the repo now, not ${JSON.stringify(v)} as the page saw`);
        }
    }
  }
  if (cs.throwables !== undefined) {
    if (!isObj(cs.throwables)) problems.push('"throwables" must be an object of throwable kind -> edit');
    else
      for (const [kind, e] of Object.entries(cs.throwables)) {
        const at = (m) => problems.push(`throwable ${kind}: ${m}`);
        const t = ctx.throwables?.get(kind);
        if (!t) {
          at('no throwable has this kind');
          continue;
        }
        if (!isObj(e)) {
          at('the edit must be an object');
          continue;
        }
        for (const k of Object.keys(e)) if (!THROWABLE_EDIT_KEYS.includes(k)) at(`unknown field "${k}" (${THROWABLE_EDIT_KEYS.join(', ')})`);
        if (e.note !== undefined && (typeof e.note !== 'string' || e.note.length > TEXT_LIMITS.note)) at(`note must be text of at most ${TEXT_LIMITS.note} characters`);
        if (e.sounds !== undefined) {
          if (!isObj(e.sounds)) at('sounds must be an object of slot -> sound id');
          else
            for (const [slot, sid] of Object.entries(e.sounds)) {
              if (!THROWABLE_SOUND_SLOTS.includes(slot)) at(`sounds.${slot}: a throwable's slots are ${THROWABLE_SOUND_SLOTS.join(', ')}`);
              else if (slot === 'explosion' && !t.blowsUp) at("sounds.explosion: it doesn't blow up");
              else if (sid !== NO_SOUND && (typeof sid !== 'string' || !ctx.sounds.has(sid))) at(`sounds.${slot}: ${JSON.stringify(sid)} is not a sound in the game (content/sounds.json)`);
            }
        }
      }
  }
  return { problems, warnings };
}
