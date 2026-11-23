import {
  CORE_ITEMS,
  CORE_WEAPONS,
  DEFAULT_RULES,
  FAMILY_DEFAULTS,
  WEAPON_CATEGORIES,
  WEAPON_SET_DEFS,
  WEAPON_SET_IDS,
  gunplayOf,
  pickupWeapons,
  type WeaponDefinition,
} from '@tiletrigger/shared';
import soundManifest from '../../../../content/sounds.json';
import {
  SOUND_SLOTS,
  applicableStats,
  buildChangeSet,
  getPath,
  isEmptyEdit,
  validateChangeSet,
  weaponInfo,
  type ChangeSet,
  type SoundSlot,
  type StatValue,
  type ValidationContext,
  type WeaponEdit,
  type WeaponInfo,
} from '../../../../tools/content/weapon-edits-format.mjs';

/**
 * The Weapon Manager's state and rules (tools/weaponManager.ts draws them; docs/FEATURES.md, "Weapon Manager"): the
 * owner's edits per weapon, kept in this browser until sent; an edited copy of a weapon's definition for the live
 * comparisons; the same checks the repo tool runs (tools/content/weapon-edits-format.mjs); and the change set the
 * page sends. Nothing here changes the game: the change set is applied in the repo by
 * `node tools/content/apply-weapon-edits.mjs`, and a session lands it.
 */

export type Edits = Record<string, WeaponEdit>;
export const STORAGE_KEY = 'tt.weaponManager.v1';

/** Each weapon's short description: `notes.description` in its content file (none yet for most). */
const FILES = import.meta.glob<{ notes?: Record<string, string> }>('../../../../content/weapons/*.json', { eager: true, import: 'default' });
const DESCRIPTIONS: Record<string, string> = {};
const DESIGN: Record<string, string> = {};
for (const [path, file] of Object.entries(FILES)) {
  const notes = file.notes;
  const id = `core.${path.replace(/^.*\//, '').replace(/\.json$/, '')}`;
  if (notes?.description) DESCRIPTIONS[id] = notes.description;
  if (notes?.design) DESIGN[id] = notes.design;
}
export const descriptionOf = (id: string): string => DESCRIPTIONS[id] ?? '';
/** The weapon's design note, shown as a hint where it has no description yet. */
export const designNoteOf = (id: string): string => DESIGN[id] ?? '';

/** Every weapon in the game, by slot then name (mounted guns, slot 0, last). */
export function weaponList(): WeaponDefinition[] {
  return Object.values(CORE_WEAPONS).sort((a, b) => (a.slot || 99) - (b.slot || 99) || a.displayName.localeCompare(b.displayName));
}

export const infoOf = (def: WeaponDefinition): WeaponInfo => weaponInfo(def, def.family ? FAMILY_DEFAULTS[def.family] : null);

/** A stat's value in the game now: the weapon's own, else what its family gives it. */
export function currentStat(def: WeaponDefinition, path: string): StatValue | undefined {
  const gp = gunplayOf(def);
  const [head, leaf] = path.split('.') as [string, string | undefined];
  const from = (o: unknown) => getPath(o, leaf!) as StatValue | undefined;
  switch (head) {
    case 'falloff':
      return from(gp.falloff);
    case 'accuracy':
      return from(gp.accuracy);
    case 'kick':
      return from(gp.kick);
    case 'ballistic':
      return from(gp.ballistic ?? def.ballistic ?? (def.family ? FAMILY_DEFAULTS[def.family].ballistic : null));
    case 'handling':
      return from(gp.handling);
    case 'headshot':
      return gp.head;
    case 'reload':
      return from(def.reload);
    default:
      return getPath(def, path) as StatValue | undefined;
  }
}

/** The sound a weapon plays in a slot now (fire: its own or `fire.<name>`; reload: its own or every weapon's). */
export function currentSound(def: WeaponDefinition, slot: SoundSlot): string | null {
  if (slot === 'fire') return def.view.sound ?? `fire.${def.id.replace(/^core\./, '')}`;
  if (slot === 'alt') return def.view.altShot?.sound ?? null;
  return def.view.reloadSound ?? 'reload.start';
}

/** The sound slots a weapon has (alt only with a second-trigger shot). */
export const soundSlots = (def: WeaponDefinition): SoundSlot[] => SOUND_SLOTS.filter((s) => s !== 'alt' || !!def.view.altShot);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * The weapon as the edit would make it, for the live comparisons and the list: a new object (the sim's caches key on
 * the definition, so the edited copy gets its own numbers).
 */
export function editedDef(def: WeaponDefinition, e: WeaponEdit | undefined): WeaponDefinition {
  if (isEmptyEdit(e)) return def;
  const d = clone(def) as WeaponDefinition & Record<string, unknown>;
  if (e!.name !== undefined) d.displayName = e!.name.trim() || def.displayName;
  if (e!.category !== undefined) d.category = e!.category as WeaponDefinition['category'];
  if (e!.hidden !== undefined) d.hidden = e!.hidden || undefined;
  const s = e!.sounds ?? {};
  if (s.fire) d.view.sound = s.fire;
  if (s.alt && d.view.altShot) d.view.altShot.sound = s.alt;
  if (s.reload) d.view.reloadSound = s.reload;
  for (const [path, v] of Object.entries(e!.stats ?? {})) {
    const [head, leaf] = path.split('.') as [string, string | undefined];
    if (!leaf) {
      d[head] = v;
      continue;
    }
    const famFalloff = def.family ? FAMILY_DEFAULTS[def.family].falloff : null;
    const base = (d[head] as Record<string, unknown> | undefined) ?? (head === 'falloff' ? { ...famFalloff } : {});
    d[head] = { ...base, [leaf]: v };
  }
  return d;
}

// ---------------------------------------------------------------- sets

export type SetMembership = { id: string; name: string; editable: boolean; member: boolean; locked?: string; note?: string };

/** Whether a weapon can be in a set's list (a category, carried, a pickup to hold it), else why not. */
export function canJoinSet(id: string): string | null {
  const w = CORE_WEAPONS[id];
  if (!w?.category) return 'it has no category (tools, mode-only weapons and mounted guns are never in a set)';
  if (!(w.slot >= 1)) return 'a mounted gun (slot 0) is never in a set';
  if (!CORE_ITEMS.some((i) => i.effect.kind === 'weapon' && i.effect.weapon === id)) return 'it has no pickup, so a set\'s pickups couldn\'t hold it';
  return null;
}

/** A weapon's place in every set, with the edit's changes: lists can be edited; Mixed bag and Standard can't. */
export function setsOf(def: WeaponDefinition, e: WeaponEdit | undefined): SetMembership[] {
  return WEAPON_SET_IDS.map((sid) => {
    const set = WEAPON_SET_DEFS[sid];
    if (set.weapons === undefined) return { id: sid, name: set.name, editable: false, member: true, note: 'leaves weapons as placed' };
    if (set.weapons === 'all') return { id: sid, name: set.name, editable: false, member: !!def.category && def.slot >= 1 && !canJoinSet(def.id), note: 'every weapon a pickup can hold' };
    const listed = set.weapons.includes(def.id);
    const locked = set.spawn?.includes(def.id) ? 'everyone spawns with it' : set.sniper === def.id ? 'sniper bots carry it' : undefined;
    const member = e?.sets?.[sid] ?? listed;
    return { id: sid, name: set.name, editable: !locked && (listed || !canJoinSet(def.id)), member, ...(locked ? { locked } : {}) };
  });
}

// ---------------------------------------------------------------- hiding

const STARTING = new Set(Object.values(DEFAULT_RULES).flatMap((r) => r.startingWeapons));

/** Why a weapon can't be hidden (the repo tool's own rules: tools/content/weapons.mjs hideBlockers), or none. */
export function hideBlockers(id: string): string[] {
  const out: string[] = [];
  if (STARTING.has(id)) out.push("a mode's starting weapon");
  for (const sid of WEAPON_SET_IDS) {
    const s = WEAPON_SET_DEFS[sid];
    if (s.spawn?.includes(id)) out.push(`the ${s.name} set spawns with it`);
    if (s.sniper === id) out.push(`the ${s.name} set's sniper gun`);
  }
  if (id === 'core.rifle') out.push("Roulette's fallback signature");
  return [...new Set(out)];
}

// ---------------------------------------------------------------- sounds

export const SOUND_IDS = Object.keys(soundManifest.sounds).sort();

type SoundEntry = { label?: string; synth?: string; lazy?: boolean };
const SOUND_DEFS = soundManifest.sounds as Record<string, SoundEntry>;

/** The sci-fi and energy guns' sounds (their ids' second part). */
const SCIFI = /^fire\.(plasma|pulse|laser|railgun|arc|freeze|vortex|disc|bubble|goo|flame|nail)(\.|$)/;
const LAUNCH = /^fire\.(launcher|rockets|swarm|flare|flak)(\.|$)/;

/** A sound's name in the picker: its manifest label ("Rifle: HK416 close"), else its id. */
export const soundLabel = (id: string): string => SOUND_DEFS[id]?.label ?? id;

/** The sound library as the picker groups it (each group in label order). */
export function soundGroups(): { label: string; ids: string[] }[] {
  const groups: [string, (id: string) => boolean][] = [
    ['Guns', (id) => id.startsWith('fire.') && !SCIFI.test(id) && !LAUNCH.test(id) && !SOUND_DEFS[id]?.synth],
    ['Sci-fi and energy', (id) => SCIFI.test(id) && !SOUND_DEFS[id]?.synth],
    ['Launchers and rockets', (id) => LAUNCH.test(id) && !SOUND_DEFS[id]?.synth],
    ['Synthesised weapon sounds', (id) => id.startsWith('fire.') && !!SOUND_DEFS[id]?.synth],
    ['Reload and handling', (id) => /^(reload\.|weapon\.|dryfire$|throw$|knife\.)/.test(id)],
    ['Impacts and explosions', (id) => /^(impact\.|explosion|break\.|glass\.|blood\.)/.test(id)],
    ['Everything else', () => true],
  ];
  const left = new Set(SOUND_IDS);
  return groups.map(([label, test]) => {
    const ids = [...left].filter(test).sort((a, b) => soundLabel(a).localeCompare(soundLabel(b)) || a.localeCompare(b));
    for (const id of ids) left.delete(id);
    return { label, ids };
  });
}

// ---------------------------------------------------------------- checking and sending

/** The checks' view of the game (the same rules the repo tool applies). */
export function validationContext(): ValidationContext {
  const weapons: ValidationContext['weapons'] = new Map();
  for (const def of Object.values(CORE_WEAPONS)) weapons.set(def.id, { name: def.displayName, info: infoOf(def), current: (path) => currentStat(def, path) });
  return {
    weapons,
    sounds: new Set(SOUND_IDS),
    sets: WEAPON_SET_IDS.map((sid) => WEAPON_SET_DEFS[sid]),
    categories: WEAPON_CATEGORIES,
    blockers: hideBlockers,
    canJoinSet,
  };
}

/** An edit with what the page saw before it (`was`), for whoever reviews the change set. */
export function withWas(def: WeaponDefinition, e: WeaponEdit): WeaponEdit {
  const was: Record<string, unknown> = {};
  if (e.name !== undefined) was.name = def.displayName;
  if (e.hidden !== undefined) was.hidden = !!def.hidden;
  if (e.category !== undefined) was.category = def.category ?? null;
  if (e.description !== undefined) was.description = descriptionOf(def.id);
  if (e.sounds && Object.keys(e.sounds).length) was.sounds = Object.fromEntries(Object.keys(e.sounds).map((k) => [k, currentSound(def, k as SoundSlot)]));
  if (e.stats && Object.keys(e.stats).length) was.stats = Object.fromEntries(Object.keys(e.stats).map((k) => [k, currentStat(def, k)]));
  if (e.sets && Object.keys(e.sets).length) was.sets = Object.fromEntries(Object.keys(e.sets).map((sid) => [sid, setsOf(def, undefined).find((m) => m.id === sid)?.member ?? false]));
  const { was: _old, ...rest } = e;
  return Object.keys(was).length ? { ...rest, was } : rest;
}

/** The change set the page sends, and its problems (the repo tool would refuse it with any). */
export function changeSet(edits: Edits, created = new Date().toISOString()): { set: ChangeSet; problems: string[] } {
  const withPrev: Edits = {};
  for (const [id, e] of Object.entries(edits)) if (CORE_WEAPONS[id] && !isEmptyEdit(e)) withPrev[id] = withWas(CORE_WEAPONS[id]!, e);
  const set = buildChangeSet(withPrev, { created, from: 'Weapon Manager (?mode=weapons, Manage)' });
  return { set, problems: validateChangeSet(set, validationContext()).problems };
}

/**
 * Tidy an edit: values back at the game's own are dropped (so "edited" means different), empty parts removed.
 * Returns undefined when nothing is left.
 */
export function tidy(def: WeaponDefinition, e: WeaponEdit): WeaponEdit | undefined {
  const out: WeaponEdit = {};
  if (e.name !== undefined && e.name.trim() !== def.displayName) out.name = e.name;
  if (e.hidden !== undefined && e.hidden !== !!def.hidden) out.hidden = e.hidden;
  if (e.category !== undefined && e.category !== def.category) out.category = e.category;
  if (e.description !== undefined && e.description.trim() !== descriptionOf(def.id)) out.description = e.description;
  const sounds = Object.fromEntries(Object.entries(e.sounds ?? {}).filter(([k, v]) => v !== currentSound(def, k as SoundSlot)));
  if (Object.keys(sounds).length) out.sounds = sounds;
  const base = setsOf(def, undefined);
  const sets = Object.fromEntries(Object.entries(e.sets ?? {}).filter(([sid, v]) => base.find((m) => m.id === sid)?.member !== v));
  if (Object.keys(sets).length) out.sets = sets;
  const stats = Object.fromEntries(Object.entries(e.stats ?? {}).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(currentStat(def, k))));
  if (Object.keys(stats).length) out.stats = stats;
  if (e.note?.trim()) out.note = e.note;
  return isEmptyEdit(out) ? undefined : out;
}

export { applicableStats };

// ---------------------------------------------------------------- kept in this browser until sent

export function loadEdits(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Edits {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Edits).filter(([id, e]) => CORE_WEAPONS[id] && e && typeof e === 'object'));
  } catch {
    return {};
  }
}

export function saveEdits(edits: Edits, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (Object.keys(edits).length) storage?.setItem(STORAGE_KEY, JSON.stringify(edits));
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    // Private windows and blocked storage: the edits live as long as the page.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** pickupWeapons, for the list's "in random pickups" line. */
export const inRandomPickups = (def: WeaponDefinition): boolean => !def.hidden && pickupWeapons().some((w) => w.id === def.id);
