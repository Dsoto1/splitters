/**
 * Weapon sets (docs/WEAPON_SETS_PLAN.md; docs/ARSENAL.md, "Weapon sets"): Standard, Military, Sci-fi, Medieval, Chaos
 * and Mixed bag, as data in content/weapon-sets.json. A set decides what a match spawns with, what its weapon and
 * grenade pickups turn into and what drops. Each map has a default (MapDocument.weaponSet: MapMaker's Map properties;
 * absent, Standard) and the host can pick another (MatchRules.weaponSet: Match setup, the pause menu's Host tab, a
 * server's `set` rule).
 *
 * - Spawn: the set's weapons (Standard: the mode's own), plus a random main gun each life for Chaos and Mixed bag
 *   (dealt from a deck shuffled from the match seed and the slot: each once before any again; a match replays the
 *   same), with sniper-role bots carrying the set's scoped gun in place of the main gun (Match.sniperGun), and the
 *   set's first grenade.
 * - Pickups: a weapon pickup holds a weapon of the set of its own category, else of the nearest categories the set
 *   has (a sniper pickup in Sci-fi is the railgun; nearCategories), rolled again each time it comes back; one marked
 *   "keep fixed" stays as placed when its weapon is of the set. Grenade pickups likewise hold the set's grenades.
 * - Drops: only the set's weapons.
 * - Never in a set: tools, mode-only weapons and mounted guns (no category). Classes keep their own loadouts (pickups
 *   still roll within the set). Matches with fixed weapons (Disc Arena, spears or discs only) play no set.
 *
 * Pure functions of the data and their arguments; the pools are built on first use (the menu reads only the names).
 */
import type { MapDocument, PickupEntity } from '../map/schema.ts';
import { WEAPON_SET_DEFS, WEAPON_SET_IDS } from '../content/weaponSets.generated.ts';
import { CORE_ITEMS, getItem, type ItemDefinition } from './items.ts';
import { categoryItems, itemCategory, pickupPool, rollHash } from './pickupRoll.ts';
import { restrictedWeapons, type MatchRules } from './rules.ts';
import { CORE_WEAPONS, THROWABLES, THROWABLE_DEFS, WEAPON_CATEGORIES, getWeapon, type ThrowableKind, type WeaponCategory, type WeaponDefinition } from './weapons.ts';

export { WEAPON_SET_DEFS, WEAPON_SET_IDS };
export type WeaponSetId = (typeof WEAPON_SET_IDS)[number];

/** A weapon set as content/weapon-sets.json gives it (built by tools/content/weapon-sets.mjs). */
export interface WeaponSetDef {
  id: string;
  /** The menus' label, and a line for their tooltip. */
  name: string;
  blurb: string;
  /** Weapons everyone spawns with, the last one held (absent: the mode's own, MatchRules.startingWeapons). */
  spawn?: readonly string[];
  /** Plus one of the set's main guns (slots 3-9) each life, dealt from a shuffled deck (randomGunFor), and held. */
  randomGun?: boolean;
  /** What sniper-role bots spawn with in place of the spawn's main gun: a scoped gun of the set. */
  sniper?: string;
  /** The set's weapons ("all": every weapon a pickup can hold); absent: pickups as placed, anything drops. */
  weapons?: readonly string[] | 'all';
  /** The set's grenades ("all": every one); absent: as placed, and frags at spawn. */
  throwables?: readonly ThrowableKind[] | 'all';
}

/** The set a map or match plays when none is named. */
export const STANDARD_SET: WeaponSetId = 'standard';

export const isWeaponSetId = (v: unknown): v is WeaponSetId => typeof v === 'string' && (WEAPON_SET_IDS as readonly string[]).includes(v);

/** A set by id; Standard for none or an id no set has (a map or setup from a build with another set). */
export function getWeaponSet(id: string | null | undefined): WeaponSetDef {
  return isWeaponSetId(id) ? WEAPON_SET_DEFS[id] : WEAPON_SET_DEFS[STANDARD_SET];
}

/** Every set, in menu order. */
export const weaponSetList = (): readonly WeaponSetDef[] => WEAPON_SET_IDS.map((id) => WEAPON_SET_DEFS[id]);

/** A map's own default set (MapDocument.weaponSet; Standard when it names none, or one this build doesn't have). */
export function mapWeaponSet(map: Pick<MapDocument, 'weaponSet'> | null | undefined): WeaponSetId {
  const id = map?.weaponSet;
  return isWeaponSetId(id) ? id : STANDARD_SET;
}

/** The set a match plays: the host's choice (MatchRules.weaponSet), else the map's default, else Standard. */
export function matchWeaponSet(rules: Pick<MatchRules, 'weaponSet'>, map: Pick<MapDocument, 'weaponSet'> | null | undefined): WeaponSetId {
  return isWeaponSetId(rules.weaponSet) ? rules.weaponSet : mapWeaponSet(map);
}

/** The set in play, or null where the weapons are fixed (Disc Arena, spears or discs only: no set applies). */
export function weaponSetInPlay(rules: MatchRules, map: Pick<MapDocument, 'weaponSet'> | null | undefined): WeaponSetDef | null {
  return restrictedWeapons(rules) ? null : WEAPON_SET_DEFS[matchWeaponSet(rules, map)];
}

// ---------------------------------------------------------------- what a set holds

/** A weapon pickup's item for a weapon (`core.weapon_<name>`), when it has one. */
function weaponItem(id: string): ItemDefinition | undefined {
  const item = getItem(`core.weapon_${id.replace(/^core\./, '')}`);
  return item?.effect.kind === 'weapon' && item.effect.weapon === id ? item : undefined;
}

let anyPickup: readonly WeaponDefinition[] | undefined;
/** Every weapon a pickup can hold (a category and a pickup item), in weapon order: Mixed bag's "all". */
export function pickupWeapons(): readonly WeaponDefinition[] {
  return (anyPickup ??= Object.values(CORE_WEAPONS).filter((w) => !!w.category && w.slot >= 1 && !!weaponItem(w.id)));
}

const members = new Map<string, ReadonlySet<string>>();
/**
 * The weapons of a set: its list (Mixed bag: every weapon a pickup can hold), its spawn and its sniper gun. Null for a
 * set that leaves weapons as placed (Standard: anything goes).
 */
export function setWeaponIds(set: WeaponSetDef): ReadonlySet<string> | null {
  if (set.weapons === undefined) return null;
  let ids = members.get(set.id);
  if (!ids) {
    const list = set.weapons === 'all' ? pickupWeapons().map((w) => w.id) : set.weapons;
    members.set(set.id, (ids = new Set([...list, ...(set.spawn ?? []), ...(set.sniper ? [set.sniper] : [])])));
  }
  return ids;
}

/** Whether a weapon belongs to a set (always, for a set that leaves weapons as placed). */
export function setHas(set: WeaponSetDef, weapon: string): boolean {
  const ids = setWeaponIds(set);
  return !ids || ids.has(weapon);
}

const mains = new Map<string, readonly WeaponDefinition[]>();
/** A set's main guns: its weapons in slots 3-9 that a pickup can hold (what a random gun is rolled from), in weapon order. */
export function setMainGuns(set: WeaponSetDef): readonly WeaponDefinition[] {
  let guns = mains.get(set.id);
  if (!guns) {
    const ids = setWeaponIds(set);
    mains.set(set.id, (guns = ids ? pickupWeapons().filter((w) => w.slot >= 3 && ids.has(w.id)) : []));
  }
  return guns;
}

/**
 * How alike two weapon categories play (lower: nearer): a weapon pickup of a category its set lacks holds one of the
 * nearest categories it has (all those at the nearest distance together). Sidearms, SMGs, rifles and the specials
 * (mid-range oddballs) sit near each other; shotguns near SMGs and melee (up close); snipers near rifles; explosives
 * near the specials (splash and oddballs).
 */
const NEAR: Readonly<Record<WeaponCategory, Readonly<Partial<Record<WeaponCategory, number>>>>> = {
  pistol: { smg: 1, special: 1, rifle: 2, shotgun: 2, melee: 3, sniper: 3, explosive: 3 },
  smg: { rifle: 1, pistol: 1, shotgun: 1, special: 2, explosive: 3, sniper: 3, melee: 3 },
  rifle: { smg: 1, sniper: 1, special: 1, pistol: 2, shotgun: 2, explosive: 2, melee: 4 },
  shotgun: { smg: 1, melee: 2, pistol: 2, rifle: 2, special: 2, explosive: 3, sniper: 4 },
  sniper: { rifle: 1, explosive: 2, special: 2, smg: 3, pistol: 3, shotgun: 4, melee: 5 },
  explosive: { special: 1, rifle: 2, sniper: 2, smg: 3, shotgun: 3, pistol: 3, melee: 5 },
  melee: { shotgun: 1, pistol: 2, smg: 2, special: 3, rifle: 3, explosive: 4, sniper: 5 },
  special: { explosive: 1, pistol: 1, rifle: 1, smg: 2, shotgun: 2, sniper: 2, melee: 3 },
};

/** The categories a pickup of `category` holds from, of those a set `has`: its own, else the nearest (ties together). */
export function nearCategories(category: WeaponCategory, has: (c: WeaponCategory) => boolean): WeaponCategory[] {
  if (has(category)) return [category];
  let best = Infinity;
  let out: WeaponCategory[] = [];
  for (const c of WEAPON_CATEGORIES) {
    if (c === category || !has(c)) continue;
    const d = NEAR[category][c] ?? 9;
    if (d < best) [best, out] = [d, [c]];
    else if (d === best) out.push(c);
  }
  return out;
}

const pools = new Map<string, readonly ItemDefinition[]>();
/**
 * The pickup items a weapon pickup of `category` holds in a set that has weapons of its own: the set's weapons of that
 * category, else of the nearest categories it has, in item order. The same array each time (Match.repool compares
 * pools to see a change).
 */
export function setCategoryPool(set: WeaponSetDef, category: WeaponCategory): readonly ItemDefinition[] {
  const key = `${set.id}|${category}`;
  let pool = pools.get(key);
  if (!pool) {
    const ids = setWeaponIds(set);
    const inSet = (i: ItemDefinition) => i.effect.kind === 'weapon' && (!ids || ids.has(i.effect.weapon));
    const has = (c: WeaponCategory) => categoryItems(c).some(inSet);
    const cats = new Set(nearCategories(category, has));
    pools.set(key, (pool = CORE_ITEMS.filter((i) => inSet(i) && cats.has(itemCategory(i)!))));
  }
  return pool;
}

/** The pickup item of each grenade kind (its first). */
function throwableItem(kind: ThrowableKind): ItemDefinition | undefined {
  return CORE_ITEMS.find((i) => i.effect.kind === 'throwable' && i.effect.throwable === kind);
}

/** A set's grenades (every one for "all"), in throwable order for "all", else the set's own; null: as placed. */
export function setThrowables(set: WeaponSetDef): readonly ThrowableKind[] | null {
  if (set.throwables === undefined) return null;
  return set.throwables === 'all' ? THROWABLES.filter((k) => !!throwableItem(k)) : set.throwables;
}

const grenadePools = new Map<string, readonly ItemDefinition[]>();
/** The pickup items a grenade pickup holds in a set with grenades of its own (the same array each time). */
export function setThrowablePool(set: WeaponSetDef): readonly ItemDefinition[] | null {
  const kinds = setThrowables(set);
  if (!kinds) return null;
  let pool = grenadePools.get(set.id);
  if (!pool) grenadePools.set(set.id, (pool = kinds.map(throwableItem).filter((i): i is ItemDefinition => !!i)));
  return pool.length ? pool : null;
}

/**
 * What a placed pickup rolls from in a match playing `set` (null: no set applies, spears or discs only), or null when
 * it stays as placed. A set that leaves weapons as placed (Standard) keeps today's rules: the pickup's own random
 * category, or the host's mix-up (`mix`). In a set with weapons of its own, every weapon pickup rolls within the set
 * by its category (its own `random` one, else its weapon's), unless it is kept fixed and its weapon is of the set;
 * grenade pickups likewise in a set with grenades of its own. Tools, ammo, health and the rest stay as placed.
 */
export function setPickupPool(set: WeaponSetDef | null, entity: Pick<PickupEntity, 'item' | 'random' | 'keepFixed'>, mix: boolean): readonly ItemDefinition[] | null {
  if (!set) return pickupPool(entity, mix);
  const item = getItem(entity.item);
  if (item?.effect.kind === 'throwable') {
    const pool = setThrowablePool(set);
    if (!pool || (entity.keepFixed && pool.includes(item))) return null;
    return pool;
  }
  if (set.weapons === undefined) return pickupPool(entity, mix);
  const category = entity.random ?? itemCategory(item);
  if (!category) return null;
  if (!entity.random && entity.keepFixed && item?.effect.kind === 'weapon' && setHas(set, item.effect.weapon)) return null;
  const pool = setCategoryPool(set, category);
  return pool.length ? pool : null;
}

/** Whether a weapon may lie as a drop in a match playing `set`: one of the set's (anything, for a set without weapons of its own). */
export const setAllowsDrop = (set: WeaponSetDef | null, weapon: string): boolean => !set || setHas(set, weapon);

// ---------------------------------------------------------------- spawning

/** What a player spawns with: weapons (the last one held) and a grenade. */
export interface SpawnLoadout {
  weapons: string[];
  throwable: { kind: ThrowableKind; count: number } | null;
}

/** The weapons everyone spawns with in a set, whatever the life (never dropped): the set's own, else the mode's. */
export const setSpawnWeapons = (set: WeaponSetDef, rules: Pick<MatchRules, 'startingWeapons'>): readonly string[] => set.spawn ?? rules.startingWeapons;

/**
 * A set's random main gun for a life (1, 2, 3…), or null without one: the life's place in a deck of the set's main
 * guns shuffled from the match seed, the slot and the round, so every one comes up once before any comes up again
 * (Chaos's nine oddballs in nine lives), and never the same twice running.
 */
export function randomGunFor(set: WeaponSetDef, seed: number, slot: number, life: number): string | null {
  if (!set.randomGun) return null;
  const guns = setMainGuns(set);
  if (!guns.length) return null;
  const i = Math.max(0, life - 1);
  return guns[gunDeck(guns.length, seed, slot, Math.floor(i / guns.length))[i % guns.length]!]!.id;
}

/** A slot's deck of `n` guns for a round of lives: a seeded shuffle, whose first is never the round before's last. */
function gunDeck(n: number, seed: number, slot: number, round: number): number[] {
  // Two guns take turns.
  if (n <= 2) return shuffledGuns(n, seed, slot, 0);
  const deck = shuffledGuns(n, seed, slot, round);
  // The round before's last is its shuffle's own: trading its first two places never moves the last of three or more.
  if (round > 0 && deck[0] === shuffledGuns(n, seed, slot, round - 1)[n - 1]) [deck[0], deck[1]] = [deck[1]!, deck[0]!];
  return deck;
}

function shuffledGuns(n: number, seed: number, slot: number, round: number): number[] {
  const deck = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = rollHash(`spawn_gun_${slot}_${round}_${k}`, seed >>> 0) % (k + 1);
    [deck[k], deck[j]] = [deck[j]!, deck[k]!];
  }
  return deck;
}

/**
 * A spawn loadout in a set: its spawn weapons (Standard: the mode's own), its random main gun for this life, and for a
 * sniper-role bot the set's scoped gun in place of the main gun (added when the spawn has none); the set's first grenade
 * (frags in a set without grenades of its own), as many as the rules give (at most what a player carries).
 */
export function setLoadout(set: WeaponSetDef, rules: Pick<MatchRules, 'startingWeapons' | 'startingGrenades'>, o: { seed: number; slot: number; life: number; sniper?: boolean }): SpawnLoadout {
  const weapons = [...setSpawnWeapons(set, rules)];
  const gun = randomGunFor(set, o.seed, o.slot, o.life);
  if (gun) weapons.push(gun);
  if (o.sniper && set.sniper && !weapons.includes(set.sniper)) {
    const last = weapons.length - 1;
    if (last >= 0 && getWeapon(weapons[last]!).slot >= 3) weapons[last] = set.sniper;
    else weapons.push(set.sniper);
  }
  const kind = setThrowables(set)?.[0] ?? 'frag';
  const count = Math.min(rules.startingGrenades, THROWABLE_DEFS[kind].max);
  return { weapons, throwable: count > 0 ? { kind, count } : null };
}

/**
 * A set's main gun: the spawn's held gun when it is one (slots 3-9: Military's assault rifle, Sci-fi's plasma rifle),
 * else the set's first main gun (Chaos and Mixed bag roll theirs; Medieval has none: null), null for a set without
 * weapons of its own.
 */
export function setMainGun(set: WeaponSetDef): string | null {
  const held = set.spawn?.[set.spawn.length - 1];
  if (held && getWeapon(held).slot >= 3) return held;
  return setMainGuns(set)[0]?.id ?? null;
}

/**
 * A weapon a mode hands out (the Roulette mode's signature loadouts, docs/ROULETTE_MODE_PLAN.md) as the set allows:
 * the weapon when it is of the set, else the set's main gun (else the weapon: a set without one, Medieval, keeps it).
 */
export function inSetOr(set: WeaponSetDef | null, weapon: string): string {
  if (!set || setHas(set, weapon)) return weapon;
  return setMainGun(set) ?? weapon;
}

/**
 * Every weapon a match in this set can put in a hand (spawn, random guns, the sniper gun, what its pickups may hold):
 * the client loads their models with the map. Null: a set that leaves weapons as placed (the map's pickups decide).
 */
export function setWeaponsInPlay(set: WeaponSetDef, rules: Pick<MatchRules, 'startingWeapons'>): readonly string[] | null {
  const ids = setWeaponIds(set);
  return ids ? [...new Set([...setSpawnWeapons(set, rules), ...ids])] : null;
}
