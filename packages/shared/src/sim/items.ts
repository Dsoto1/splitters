/**
 * Pickup items (v1 spec §5.4): data only. Map pickup entities reference these
 * by content ID; respawn times can be overridden per placed pickup.
 */
export type ItemEffect =
  | { kind: 'health'; amount: number }
  | { kind: 'armor'; amount: number }
  | { kind: 'ammo' }
  | { kind: 'weapon'; weapon: string }
  | { kind: 'powerup'; powerup: 'speed' | 'damage'; seconds: number };

export interface ItemDefinition {
  id: string;
  displayName: string;
  effect: ItemEffect;
  respawnSeconds: number;
  /** AI value 0..1 before situational scaling. */
  botValue: number;
}

const item = (id: string, displayName: string, effect: ItemEffect, respawnSeconds: number, botValue: number): ItemDefinition => ({ id: `core.${id}`, displayName, effect, respawnSeconds, botValue });

export const CORE_ITEMS: readonly ItemDefinition[] = [
  item('health_small', 'Health (Small)', { kind: 'health', amount: 25 }, 15, 0.4),
  item('health_large', 'Health (Large)', { kind: 'health', amount: 50 }, 25, 0.7),
  item('armor_small', 'Armor (Small)', { kind: 'armor', amount: 25 }, 20, 0.4),
  item('armor_large', 'Armor (Large)', { kind: 'armor', amount: 75 }, 30, 0.75),
  item('ammo', 'Ammo Box', { kind: 'ammo' }, 15, 0.3),
  item('weapon_rifle', 'Assault Rifle', { kind: 'weapon', weapon: 'core.rifle' }, 15, 0.6),
  item('weapon_shotgun', 'Shotgun', { kind: 'weapon', weapon: 'core.shotgun' }, 15, 0.6),
  item('weapon_sniper', 'Sniper Rifle', { kind: 'weapon', weapon: 'core.sniper' }, 20, 0.6),
  item('weapon_launcher', 'Grenade Launcher', { kind: 'weapon', weapon: 'core.launcher' }, 25, 0.7),
  item('powerup_speed', 'Speed Boost', { kind: 'powerup', powerup: 'speed', seconds: 15 }, 60, 0.6),
  item('powerup_damage', 'Double Damage', { kind: 'powerup', powerup: 'damage', seconds: 15 }, 60, 0.85),
];

const byId = new Map(CORE_ITEMS.map((i) => [i.id, i]));
export const getItem = (id: string): ItemDefinition | undefined => byId.get(id);

export const MAX_ARMOR = 100;
/** Share of incoming damage absorbed by armor while any remains. */
export const ARMOR_ABSORB = 2 / 3;
export const SPEED_BOOST = 1.35;
export const DAMAGE_BOOST = 2;
export const PICKUP_RADIUS = 1.1;
