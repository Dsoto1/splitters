/**
 * Weapon drops (MatchRules.dropWeapons, default on): when a player or bot
 * dies, their primary with ammo left lies at the body as a pickup carrying
 * exactly that ammo; the rest of what they carried is recycled. The match
 * (sim/match.ts) owns the lying drops; this module decides what drops and
 * what a pickup of one takes.
 */
import { getItem, type ItemDefinition } from './items.ts';
import type { WeaponDefinition } from './weapons.ts';

/** A dropped weapon lies this long (s), then goes. */
export const DROP_LIE_SECONDS = 30;
/** Most drops lying at once; a new one past this takes the oldest one's place. */
export const MAX_DROPS = 24;
/** A drop lies where the ground is found within this far below the body (m); over the void there is none. */
export const DROP_REACH = 40;

/** What a weapon in hand holds (sim/match.ts WeaponState). */
export interface DropAmmo {
  def: WeaponDefinition;
  mag: number;
  reserve: number;
  alt: number;
}

/** A weapon lying where someone fell. */
export interface WeaponDrop extends DropAmmo {
  id: number;
  item: ItemDefinition;
  pos: { x: number; y: number; z: number };
  yaw: number;
  /** Tick it goes. */
  until: number;
}

/** The pickup item a weapon lies as (`core.weapon_<name>`), when it has one. */
export function dropItem(def: WeaponDefinition): ItemDefinition | undefined {
  const item = getItem(`core.weapon_${def.id.replace(/^core\./, '')}`);
  return item?.effect.kind === 'weapon' && item.effect.weapon === def.id ? item : undefined;
}

/** Whether a weapon has anything to fire: ammo in it or in reserve; heat weapons never run dry; plain melee holds none. */
export function hasAmmo(w: DropAmmo): boolean {
  if (w.def.magazine > 0 || w.def.reserveMax > 0) return w.mag + w.reserve > 0;
  return !!w.def.heat;
}

/**
 * Whether a weapon can drop at all: a pickup weapon (it has a category and an item, so not a tool, a mode-only
 * weapon or a mounted gun), not a thrown one fetched back (spears, discs), not one everyone starts with, and
 * with ammo left.
 */
export function droppable(w: DropAmmo, defaults: ReadonlySet<string>): boolean {
  const def = w.def;
  return !!def.category && !def.projectile?.retrievable && !defaults.has(def.id) && !!dropItem(def) && hasAmmo(w);
}

/**
 * What a fallen player drops: the weapon in hand when it can drop, else their best (most desirable) one that
 * can; null when nothing can. `defaults`: the starting loadout (rules and class), which never drops.
 */
export function chooseDrop<W extends DropAmmo>(weapons: Iterable<W>, held: W | undefined, defaults: ReadonlySet<string>): W | null {
  if (held && droppable(held, defaults)) return held;
  let best: W | null = null;
  for (const w of weapons) if (droppable(w, defaults) && (!best || w.def.botDesirability > best.def.botDesirability)) best = w;
  return best;
}

/**
 * Someone who already has the dropped weapon takes its ammo, as far as their reserve (and second trigger)
 * has room: the drop keeps the rest. Returns whether anything was taken.
 */
export function takeDropAmmo(owned: DropAmmo, drop: DropAmmo): boolean {
  const def = owned.def;
  let taken = false;
  const room = Math.max(0, def.reserveMax - owned.reserve);
  const rounds = Math.min(room, drop.mag + drop.reserve);
  if (rounds > 0) {
    owned.reserve += rounds;
    // From the drop's reserve first, then its magazine.
    const fromReserve = Math.min(drop.reserve, rounds);
    drop.reserve -= fromReserve;
    drop.mag -= rounds - fromReserve;
    taken = true;
  }
  const altMax = def.alt?.ammo === 'own' ? (def.alt.max ?? 0) : 0;
  const altRounds = Math.min(Math.max(0, altMax - owned.alt), drop.alt);
  if (altRounds > 0) {
    owned.alt += altRounds;
    drop.alt -= altRounds;
    taken = true;
  }
  return taken;
}

/** Whether a drop has nothing left worth lying there for (its ammo all taken). */
export const dropSpent = (d: DropAmmo): boolean => d.mag + d.reserve + d.alt <= 0 && (d.def.magazine > 0 || d.def.reserveMax > 0);
