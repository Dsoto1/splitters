import { CORE_BOT_PROFILES, type BotProfile } from '../bots/profile.ts';
import { NPC_ROLES, PLAYERS_FACTION, type Faction, type MapDocument, type NpcRole, type Relation } from '../map/schema.ts';

/**
 * NPC combatants (MASTER_SPEC_V2 §8, CHARACTERS_BOTS_V2 §14): scenario
 * soldiers that don't use player slots. They reuse the Player Bot brain with
 * weaker settings and take orders from their encounter's squad.
 */

/** NPC actor IDs start here; player slots are 0..31. */
export const NPC_ID_BASE = 100;
export const isNpcId = (id: number): boolean => id >= NPC_ID_BASE;

export interface NpcRoleSpec {
  label: string;
  health: number;
  weapon: string;
  /** Movement speed relative to players. */
  speed: number;
  /** Visual size multiplier. */
  scale: number;
  /** A creature instead of a soldier: drawn with its own body and clips (sim/creatures.ts), no held weapon. */
  creature?: boolean;
  /** Charges into melee range once it has seen its target (instead of keeping its distance). */
  melee?: boolean;
  /** Multiplier on the damage its attacks do. */
  damage?: number;
}

/**
 * The basic squad archetype: troopers with rifles, gunners with shotguns,
 * heavies with grenade launchers. Then the creatures: imps and puglins rush
 * in and claw (the knife's melee strike), the cyclops spits slowing goo, the
 * oculus spits fast plasma bolts, and the scolitex is a slow, heavy brute
 * whose claws hit hard.
 */
export const NPC_ROLE_SPECS: Record<NpcRole, NpcRoleSpec> = {
  trooper: { label: 'Trooper', health: 70, weapon: 'core.rifle', speed: 0.82, scale: 1 },
  gunner: { label: 'Gunner', health: 90, weapon: 'core.shotgun', speed: 0.9, scale: 1.05 },
  heavy: { label: 'Heavy', health: 160, weapon: 'core.launcher', speed: 0.7, scale: 1.18 },
  imp: { label: 'Imp', health: 70, weapon: 'core.knife', speed: 1.05, scale: 1, creature: true, melee: true, damage: 0.7 },
  puglin: { label: 'Puglin', health: 45, weapon: 'core.knife', speed: 1.15, scale: 1, creature: true, melee: true, damage: 0.45 },
  cyclops: { label: 'Cyclops', health: 90, weapon: 'core.goo_gun', speed: 0.75, scale: 1, creature: true },
  oculus: { label: 'Oculus', health: 60, weapon: 'core.plasma', speed: 0.9, scale: 1, creature: true },
  scolitex: { label: 'Scolitex', health: 320, weapon: 'core.knife', speed: 0.8, scale: 1, creature: true, melee: true, damage: 1.5 },
};

/** How many NPCs an encounter roster fields in its first wave. */
export const rosterSize = (roster: Readonly<Record<NpcRole, number>>): number => NPC_ROLES.reduce((n, r) => n + (roster[r] ?? 0), 0);

/**
 * NPC weapons hit players for this fraction of normal damage, so squads are a
 * threat in numbers rather than one-shot killers (NPC vs NPC is unscaled).
 */
export const NPC_DAMAGE_TO_PLAYERS = 0.55;

/** NPCs aim worse and hold position more than Player Bots; difficulty still applies on top. */
export const NPC_PROFILE: BotProfile = {
  ...CORE_BOT_PROFILES[3]!,
  id: 'core.npc_soldier',
  displayName: 'Soldier',
  accuracy: 30,
  reactionSpeed: 35,
  aggression: 55,
  selfPreservation: 30,
  pursuitPersistence: 45,
  itemGreed: 0,
  exploration: 0,
  rangePreference: 55,
  tags: ['NPC'],
};

/** The enemy faction every map has unless it defines its own. */
export const DEFAULT_FACTIONS: readonly Faction[] = [{ id: 'syndicate', name: 'Syndicate', color: '#d04a3a', relations: {} }];

export const mapFactions = (map: MapDocument): readonly Faction[] => (map.factions.length ? map.factions : DEFAULT_FACTIONS);

/** Most teams a team match can have. */
export const MAX_TEAMS = 8;

/** Team sides, in order, when a map doesn't name its own (the first two can be renamed by the map's first two factions). */
export const DEFAULT_TEAMS: readonly Faction[] = [
  { id: 'embers', name: 'Embers', color: '#e2703a', relations: {} },
  { id: 'tide', name: 'Tide', color: '#3a8fe2', relations: {} },
  { id: 'verdant', name: 'Verdant', color: '#4cc25a', relations: {} },
  { id: 'volt', name: 'Volt', color: '#e8c530', relations: {} },
  { id: 'violet', name: 'Violet', color: '#a05ae0', relations: {} },
  { id: 'frost', name: 'Frost', color: '#5fe0e0', relations: {} },
  { id: 'crimson', name: 'Crimson', color: '#d8344f', relations: {} },
  { id: 'ash', name: 'Ash', color: '#b8b8b8', relations: {} },
];

/**
 * The sides of a team match: the map's first two factions (when it names at
 * least two) and then the rest of the palette, `count` of them (default: the
 * map's recommended team setup, else two).
 */
export function mapTeams(map: MapDocument, count = map.teamSetup?.sizes.length ?? 2): readonly Faction[] {
  const named = map.factions.length >= 2 ? [map.factions[0]!, map.factions[1]!] : [];
  const rest = DEFAULT_TEAMS.filter((t, i) => i >= named.length && !named.some((n) => n.id === t.id));
  return [...named, ...rest].slice(0, Math.max(2, Math.min(MAX_TEAMS, count)));
}

/** Team layouts offered in one click in MapMaker and the Arcade (any other mix can be set by hand). */
export const TEAM_PRESETS: readonly (readonly number[])[] = [
  [1, 1], [2, 2], [4, 4], [8, 8], [2, 2, 2], [3, 3, 3], [2, 2, 2, 2], [4, 4, 4, 4], [2, 2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 12], [1, 3], [4, 12],
];

/** Short "2v2v4" style label for a team layout. */
export const teamLayoutLabel = (sizes: readonly number[]): string => sizes.join('v');

/**
 * How faction `a` treats faction `b`. `null` is a free-for-all player
 * (deathmatch): everyone is their enemy, and NPC factions treat them like the
 * players faction. A relation set on either side wins; otherwise a faction is
 * allied with itself and an enemy of everyone else.
 */
export function relation(factions: readonly Faction[], a: string | null, b: string | null): Relation {
  if (a === null && b === null) return 'enemy';
  const fa = a ?? PLAYERS_FACTION;
  const fb = b ?? PLAYERS_FACTION;
  if (fa === fb) return a === null || b === null ? 'enemy' : 'ally';
  const find = (id: string) => factions.find((f) => f.id === id);
  return find(fa)?.relations[fb] ?? find(fb)?.relations[fa] ?? 'enemy';
}

export const PLAYERS_FACTION_INFO: Faction = { id: PLAYERS_FACTION, name: 'Players', color: '#4aa3e6', relations: {} };
