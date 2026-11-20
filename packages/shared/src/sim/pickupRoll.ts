/**
 * Random weapon pickups (docs/ARSENAL.md, "Random weapon pickups"). A pickup
 * placed as "Random from category" (PickupEntity.random), or any weapon
 * pickup while the host mixes them up (MatchRules.mixPickups) and the pickup
 * isn't marked "keep fixed", rolls a weapon of its category each time it
 * comes back. Rolls are a pure function of the match seed, the pickup's ID and
 * how many times it has rolled, so a match replays the same and every peer
 * that runs the sim agrees; clients that don't are told what lies there in
 * the snapshot (`pw`).
 */
import type { PickupEntity } from '../map/schema.ts';
import { CORE_ITEMS, getItem, type ItemDefinition } from './items.ts';
import { CORE_WEAPONS, type WeaponCategory } from './weapons.ts';

/** The weapon category of an item (a weapon pickup of a weapon that has one), else null. */
export function itemCategory(item: ItemDefinition | undefined): WeaponCategory | null {
  return item?.effect.kind === 'weapon' ? (CORE_WEAPONS[item.effect.weapon]?.category ?? null) : null;
}

const pools = new Map<WeaponCategory, readonly ItemDefinition[]>();

/**
 * Every weapon pickup item of a category that random pickups roll, in item order (the pool a random pickup rolls
 * from); a pickup marked `rolls: false` (the Pistol) is never in one.
 */
export function categoryItems(category: WeaponCategory): readonly ItemDefinition[] {
  let pool = pools.get(category);
  if (!pool) pools.set(category, (pool = CORE_ITEMS.filter((i) => i.rolls !== false && itemCategory(i) === category)));
  return pool;
}

/**
 * What a placed pickup rolls from, or null when it stays as placed: its own
 * `random` category; else, with `mix` (the host's "Mix up weapon pickups"),
 * the category of the weapon placed there unless it is kept fixed.
 */
export function pickupPool(entity: Pick<PickupEntity, 'item' | 'random' | 'keepFixed'>, mix: boolean): readonly ItemDefinition[] | null {
  const category = entity.random ?? (mix && !entity.keepFixed ? itemCategory(getItem(entity.item)) : null);
  if (!category) return null;
  const pool = categoryItems(category);
  return pool.length ? pool : null;
}

/** 32-bit FNV-1a of a string, mixed with a number (also the weapon sets' random spawn guns: sim/weaponSets.ts). */
export function rollHash(text: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  // Final avalanche (murmur3 fmix32).
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A seeded deck of `n` for a round (0, 1, 2…) of deals, keyed by `key`: a shuffle whose first is never the round
 * before's last, so every one comes up once before any comes up again and never the same twice running (two take
 * turns). The weapon sets' random spawn guns and grenades, and grenade pickups, are dealt from these.
 */
export function seededDeck(n: number, key: string, seed: number, round: number): number[] {
  if (n <= 2) return shuffled(n, key, seed, 0);
  const deck = shuffled(n, key, seed, round);
  // The round before's last is its shuffle's own: trading its first two places never moves the last of three or more.
  if (round > 0 && deck[0] === shuffled(n, key, seed, round - 1)[n - 1]) [deck[0], deck[1]] = [deck[1]!, deck[0]!];
  return deck;
}

function shuffled(n: number, key: string, seed: number, round: number): number[] {
  const deck = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = rollHash(`${key}_${round}_${k}`, seed >>> 0) % (k + 1);
    [deck[k], deck[j]] = [deck[j]!, deck[k]!];
  }
  return deck;
}

/** Deal `n` (0, 1, 2…) of a list of `count` from the deck keyed `key`: its index. */
export function dealFrom(count: number, key: string, seed: number, n: number): number {
  return seededDeck(count, key, seed, Math.floor(n / count))[n % count]!;
}

/**
 * Deal `n` (0, 1, 2…) of a grenade pickup `id` from `pool` (a weapon set's grenades): every kind once before any
 * again, never the same twice running (weapon pickups roll: rollPickup).
 */
export function dealPickup(seed: number, id: string, n: number, pool: readonly ItemDefinition[]): ItemDefinition {
  return pool[dealFrom(pool.length, `pickup_${id}`, seed, n)]!;
}

/**
 * Roll `n` (0, 1, 2…) of pickup `id` in a match seeded `seed`: an item of
 * `pool`. With more than one to choose from it never repeats `current` (the
 * weapon that lay there before), so a respawn always brings something new.
 */
export function rollPickup(seed: number, id: string, n: number, pool: readonly ItemDefinition[], current?: ItemDefinition): ItemDefinition {
  const choices = pool.length > 1 && current ? pool.filter((i) => i !== current) : pool;
  return choices[rollHash(id, (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0) % choices.length]!;
}
