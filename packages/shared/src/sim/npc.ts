import { CORE_BOT_PROFILES, type BotProfile } from '../bots/profile.ts';
import { PLAYERS_FACTION, type Faction, type MapDocument, type NpcRole, type Relation } from '../map/schema.ts';

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
}

/** The basic squad archetype: troopers with rifles, gunners with shotguns, heavies with grenade launchers. */
export const NPC_ROLE_SPECS: Record<NpcRole, NpcRoleSpec> = {
  trooper: { label: 'Trooper', health: 70, weapon: 'core.rifle', speed: 0.82, scale: 1 },
  gunner: { label: 'Gunner', health: 90, weapon: 'core.shotgun', speed: 0.9, scale: 1.05 },
  heavy: { label: 'Heavy', health: 160, weapon: 'core.launcher', speed: 0.7, scale: 1.18 },
};

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
