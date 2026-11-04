/**
 * Pickup items (v1 spec §5.4): data only. Map pickup entities reference these
 * by content ID; respawn times can be overridden per placed pickup. The table
 * and the pickup rules are data: content/pickups.json, through
 * tools/content/pickups.mjs (docs/CONTENT_PIPELINE.md, "How to add a pickup");
 * what each effect does stays in code (match.ts applyItem).
 */
import { CORE_ITEMS, PICKUP_RULES } from '../content/pickups.generated.ts';
import type { AmmoType, ThrowableKind } from './weapons.ts';
import type { DiscPower } from './discs.ts';

export { CORE_ITEMS };

/** The powerups a pickup can give (content/pickups.json reads this list). */
export const POWERUP_KINDS = ['speed', 'damage'] as const;
export type PowerupKind = (typeof POWERUP_KINDS)[number];

export type ItemEffect =
  | { kind: 'health'; amount: number }
  | { kind: 'armor'; amount: number }
  /** Ammo for every owned weapon (`ammo` absent) or for weapons of one ammo type. */
  | { kind: 'ammo'; ammo?: AmmoType }
  | { kind: 'throwable'; throwable: ThrowableKind; count: number }
  | { kind: 'weapon'; weapon: string }
  | { kind: 'powerup'; powerup: PowerupKind; seconds: number }
  /** A jetpack: hold jump in the air to fly; fuel recharges while you don't. Lost when you die. */
  | { kind: 'jetpack' }
  /** A glider pack: your canopy opens as a fast glider instead of a parachute (see parachute.ts). Lost when you die. */
  | { kind: 'glider' }
  /** A UAV sweep: every enemy shows on your team's minimaps (yours alone in free-for-all) for a while. */
  | { kind: 'uav'; seconds: number }
  /** A power disc (Disc Arena): the next few throws are fast, triple, splitting or freezing discs. */
  | { kind: 'disc'; power: DiscPower };

export interface ItemDefinition {
  id: string;
  displayName: string;
  effect: ItemEffect;
  respawnSeconds: number;
  /** AI value 0..1 before situational scaling. */
  botValue: number;
}

const byId = new Map(CORE_ITEMS.map((i) => [i.id, i]));
export const getItem = (id: string): ItemDefinition | undefined => byId.get(id);

export const MAX_ARMOR: number = PICKUP_RULES.armor.max;
/** Share of incoming damage absorbed by armor while any remains. */
export const ARMOR_ABSORB: number = PICKUP_RULES.armor.absorb;
export const SPEED_BOOST: number = PICKUP_RULES.powerup.speedBoost;
export const DAMAGE_BOOST: number = PICKUP_RULES.powerup.damageBoost;
export const PICKUP_RADIUS: number = PICKUP_RULES.pickup.radius;

/**
 * Kill-streak rewards (kills without dying), for your whole side: a UAV
 * sweep, a supply pulse (heals and restocks you and teammates within 15 m),
 * a Counter-UAV that jams enemy minimaps, and an airstrike flare.
 */
export const STREAK_REWARDS = [
  { kills: 3, id: 'uav', name: 'UAV' },
  { kills: 5, id: 'supply', name: 'Supply Pulse' },
  { kills: 7, id: 'counter_uav', name: 'Counter-UAV' },
  { kills: 9, id: 'airstrike', name: 'Airstrike' },
] as const;
