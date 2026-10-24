/**
 * Pickup items (v1 spec §5.4): data only. Map pickup entities reference these
 * by content ID; respawn times can be overridden per placed pickup.
 */
import { CORE_WEAPONS, type AmmoType, type ThrowableKind } from './weapons.ts';

const weaponName = (id: string): string => CORE_WEAPONS[id]?.displayName ?? id;

export type ItemEffect =
  | { kind: 'health'; amount: number }
  | { kind: 'armor'; amount: number }
  /** Ammo for every owned weapon (`ammo` absent) or for weapons of one ammo type. */
  | { kind: 'ammo'; ammo?: AmmoType }
  | { kind: 'throwable'; throwable: ThrowableKind; count: number }
  | { kind: 'weapon'; weapon: string }
  | { kind: 'powerup'; powerup: 'speed' | 'damage'; seconds: number }
  /** A jetpack: hold jump in the air to fly; fuel recharges while you don't. Lost when you die. */
  | { kind: 'jetpack' }
  /** A UAV sweep: every enemy shows on your team's minimaps (yours alone in free-for-all) for a while. */
  | { kind: 'uav'; seconds: number };

export interface ItemDefinition {
  id: string;
  displayName: string;
  effect: ItemEffect;
  respawnSeconds: number;
  /** AI value 0..1 before situational scaling. */
  botValue: number;
}

const item = (id: string, displayName: string, effect: ItemEffect, respawnSeconds: number, botValue: number): ItemDefinition => ({ id: `core.${id}`, displayName, effect, respawnSeconds, botValue });

/** A pickup for each weapon of the extended arsenal (`core.weapon_<name>`); power weapons respawn slower. */
const EXTENDED_WEAPON_ITEMS: ItemDefinition[] = [
  ['pulse_pistol', 15], ['hand_cannon', 20], ['gilded_pistol', 60], ['flare_gun', 20], ['machine_pistol', 15],
  ['burst_rifle', 15], ['laser_rifle', 25], ['marksman', 20], ['sawed_off', 15], ['auto_shotgun', 20], ['flak', 25],
  ['railgun', 35], ['disc_launcher', 25], ['bubble_blaster', 20], ['goo_gun', 20], ['oil_slicker', 20],
  ['lmg', 30], ['nailgun', 20], ['swarm', 35], ['guided', 40], ['singularity', 45], ['arc_caster', 25], ['flamethrower', 25], ['freeze_ray', 25],
].map(([name, respawn]) => item(`weapon_${name}`, weaponName(`core.${name}`), { kind: 'weapon', weapon: `core.${name}` }, respawn as number, 0.55 + Math.min(0.35, (respawn as number) / 120)));

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
  item('weapon_smg', 'Submachine Gun', { kind: 'weapon', weapon: 'core.smg' }, 15, 0.55),
  item('weapon_rockets', 'Rocket Launcher', { kind: 'weapon', weapon: 'core.rockets' }, 30, 0.8),
  item('weapon_plasma', 'Plasma Rifle', { kind: 'weapon', weapon: 'core.plasma' }, 25, 0.7),
  item('ammo_light', 'Light Rounds', { kind: 'ammo', ammo: 'light' }, 12, 0.25),
  item('ammo_rifle', 'Rifle Rounds', { kind: 'ammo', ammo: 'rifle' }, 12, 0.25),
  item('ammo_shells', 'Shells', { kind: 'ammo', ammo: 'shells' }, 12, 0.25),
  item('ammo_sniper', 'Sniper Rounds', { kind: 'ammo', ammo: 'sniper' }, 15, 0.25),
  item('ammo_explosive', 'Explosives', { kind: 'ammo', ammo: 'explosive' }, 20, 0.35),
  item('ammo_cells', 'Energy Cells', { kind: 'ammo', ammo: 'cells' }, 15, 0.25),
  item('grenades', 'Frag Grenades', { kind: 'throwable', throwable: 'frag', count: 2 }, 20, 0.45),
  item('mines', 'Proximity Mines', { kind: 'throwable', throwable: 'mine', count: 2 }, 25, 0.4),
  ...EXTENDED_WEAPON_ITEMS,
  item('ammo_fuel', 'Fuel Canisters', { kind: 'ammo', ammo: 'fuel' }, 15, 0.25),
  item('ammo_chem', 'Chem Canisters', { kind: 'ammo', ammo: 'chem' }, 15, 0.25),
  item('sticky_grenades', 'Sticky Grenades', { kind: 'throwable', throwable: 'sticky', count: 2 }, 25, 0.45),
  item('incendiaries', 'Incendiaries', { kind: 'throwable', throwable: 'incendiary', count: 2 }, 25, 0.45),
  item('gas_grenades', 'Gas Grenades', { kind: 'throwable', throwable: 'toxic', count: 2 }, 25, 0.4),
  item('vortex_grenades', 'Vortex Grenades', { kind: 'throwable', throwable: 'vortex', count: 1 }, 35, 0.5),
  item('weapon_medkit', 'Medkit', { kind: 'weapon', weapon: 'core.medkit' }, 30, 0.5),
  item('weapon_grapple', 'Grapple Hook', { kind: 'weapon', weapon: 'core.grapple' }, 30, 0.3),
  item('holy_bomb', 'Holy Bomb', { kind: 'throwable', throwable: 'holy', count: 1 }, 60, 0.55),
  item('cluster_bombs', 'Cluster Bombs', { kind: 'throwable', throwable: 'cluster', count: 1 }, 40, 0.5),
  item('sheep', 'Sheep', { kind: 'throwable', throwable: 'sheep', count: 1 }, 45, 0.55),
  item('airstrike', 'Airstrike Flare', { kind: 'throwable', throwable: 'airstrike', count: 1 }, 60, 0.5),
  item('sandbags', 'Sandbags', { kind: 'throwable', throwable: 'sandbag', count: 2 }, 30, 0.35),
  item('powerup_speed', 'Speed Boost', { kind: 'powerup', powerup: 'speed', seconds: 15 }, 60, 0.6),
  item('powerup_damage', 'Double Damage', { kind: 'powerup', powerup: 'damage', seconds: 15 }, 60, 0.85),
  item('jetpack', 'Jetpack', { kind: 'jetpack' }, 45, 0.6),
  item('uav', 'UAV Uplink', { kind: 'uav', seconds: 20 }, 75, 0.5),
];

const byId = new Map(CORE_ITEMS.map((i) => [i.id, i]));
export const getItem = (id: string): ItemDefinition | undefined => byId.get(id);

export const MAX_ARMOR = 100;
/** Share of incoming damage absorbed by armor while any remains. */
export const ARMOR_ABSORB = 2 / 3;
export const SPEED_BOOST = 1.35;
export const DAMAGE_BOOST = 2;
export const PICKUP_RADIUS = 1.1;
