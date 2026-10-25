import { encodeLook, getLook } from '../content/looks.ts';
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
 * heavies with grenade launchers, snipers with scoped rifles. Then the creatures: imps and puglins rush
 * in and claw (the knife's melee strike), the cyclops spits slowing goo, the
 * oculus spits fast plasma bolts, and the scolitex is a slow, heavy brute
 * whose claws hit hard.
 */
export const NPC_ROLE_SPECS: Record<NpcRole, NpcRoleSpec> = {
  trooper: { label: 'Trooper', health: 70, weapon: 'core.rifle', speed: 0.82, scale: 1 },
  gunner: { label: 'Gunner', health: 90, weapon: 'core.shotgun', speed: 0.9, scale: 1.05 },
  heavy: { label: 'Heavy', health: 160, weapon: 'core.launcher', speed: 0.7, scale: 1.18 },
  sniper: { label: 'Sniper', health: 60, weapon: 'core.sniper', speed: 0.8, scale: 0.97 },
  imp: { label: 'Imp', health: 70, weapon: 'core.knife', speed: 1.05, scale: 1, creature: true, melee: true, damage: 0.7 },
  puglin: { label: 'Puglin', health: 45, weapon: 'core.knife', speed: 1.15, scale: 1, creature: true, melee: true, damage: 0.45 },
  cyclops: { label: 'Cyclops', health: 90, weapon: 'core.goo_gun', speed: 0.75, scale: 1, creature: true },
  oculus: { label: 'Oculus', health: 60, weapon: 'core.plasma', speed: 0.9, scale: 1, creature: true },
  scolitex: { label: 'Scolitex', health: 320, weapon: 'core.knife', speed: 0.8, scale: 1, creature: true, melee: true, damage: 1.5 },
};

/** How many NPCs an encounter roster fields in its first wave. */
export const rosterSize = (roster: Partial<Record<NpcRole, number>>): number => NPC_ROLES.reduce((n, r) => n + (roster[r] ?? 0), 0);

/** How many of a role an encounter's roster has (missing roles count as none). */
export const rosterCount = (roster: Partial<Record<NpcRole, number>>, role: NpcRole): number => roster[role] ?? 0;

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

/**
 * Role behaviour on top of NPC_PROFILE (same aim model and cover use as
 * Player Bots): troopers and gunners are grunts that advance in pairs (one
 * moves while the other covers), heavies keep firing at where an enemy went
 * into cover, snipers hang back and go prone at range.
 */
export const NPC_ROLE_PROFILES: Record<NpcRole, BotProfile> = {
  trooper: { ...NPC_PROFILE, id: 'core.npc_trooper', tags: ['NPC', 'GRUNT'] },
  gunner: { ...NPC_PROFILE, id: 'core.npc_gunner', aggression: 75, rangePreference: 15, tags: ['NPC', 'GRUNT'] },
  heavy: { ...NPC_PROFILE, id: 'core.npc_heavy', aggression: 45, rangePreference: 60, pursuitPersistence: 30, tags: ['NPC', 'SUPPRESSOR'] },
  sniper: { ...NPC_PROFILE, id: 'core.npc_sniper', displayName: 'Sniper', accuracy: 45, aggression: 25, rangePreference: 95, pursuitPersistence: 10, tacticalAwareness: 65, tags: ['NPC', 'SNIPER'] },
  // Creatures: the clawing ones rush you across open ground; the spitters keep their distance.
  imp: { ...NPC_PROFILE, id: 'core.npc_imp', displayName: 'Imp', aggression: 95, selfPreservation: 10, rangePreference: 5, tacticalAwareness: 15, tags: ['NPC', 'BERSERKER', 'RECKLESS'] },
  puglin: { ...NPC_PROFILE, id: 'core.npc_puglin', displayName: 'Puglin', aggression: 95, selfPreservation: 15, rangePreference: 5, tacticalAwareness: 10, tags: ['NPC', 'BERSERKER', 'RECKLESS'] },
  cyclops: { ...NPC_PROFILE, id: 'core.npc_cyclops', displayName: 'Cyclops', aggression: 55, rangePreference: 45, tacticalAwareness: 30, tags: ['NPC'] },
  oculus: { ...NPC_PROFILE, id: 'core.npc_oculus', displayName: 'Oculus', aggression: 60, rangePreference: 50, tacticalAwareness: 30, tags: ['NPC'] },
  scolitex: { ...NPC_PROFILE, id: 'core.npc_scolitex', displayName: 'Scolitex', aggression: 90, selfPreservation: 5, rangePreference: 5, tacticalAwareness: 10, tags: ['NPC', 'BERSERKER', 'RECKLESS'] },
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

/**
 * NPCs as player skins: look IDs `npc:<role>`. Only the looks change; a
 * player in one keeps the player's hitbox, health and weapons.
 */
export const NPC_LOOK_PREFIX = 'npc:';
export const npcLookRole = (look: string | undefined): NpcRole | null => {
  if (!look?.startsWith(NPC_LOOK_PREFIX)) return null;
  const role = look.slice(NPC_LOOK_PREFIX.length);
  return role in NPC_ROLE_SPECS ? (role as NpcRole) : null;
};
export const NPC_LOOKS: readonly { id: string; name: string; role: NpcRole }[] = (Object.keys(NPC_ROLE_SPECS) as NpcRole[]).map((role) => ({ id: `${NPC_LOOK_PREFIX}${role}`, name: NPC_ROLE_SPECS[role].label, role }));
/** Soldier NPC skins: a uniform colour per role so they read apart. */
export const NPC_LOOK_COLORS: Partial<Record<NpcRole, string>> = { trooper: '#56703c', gunner: '#9a7440', heavy: '#474d58', sniper: '#3f5a36' };
/** A look ID kept as is when valid (presets, custom looks, NPC skins), else the default. */
export const validLookId = (id: string | undefined): string => (npcLookRole(id) ? id! : getLook(id).id);

/** First-person arm colour for each NPC skin (creature hide, soldier uniform). */
const NPC_ARM_COLORS: Record<NpcRole, string> = { trooper: '#4f7a2c', gunner: '#a8782c', heavy: '#3c4450', sniper: '#3a6a28', imp: '#e0302a', puglin: '#7ab830', cyclops: '#3a7cf0', oculus: '#f07020', scolitex: '#20c8b0' };

/**
 * The look whose arms you see in first person: your own, or for an NPC skin
 * bare arms tinted that NPC's colour (so a cyclops player sees blue hands).
 */
export function armsLookFor(look: string): string {
  const role = npcLookRole(look);
  if (!role) return look;
  return encodeLook({ body: 'male', parts: ['athlete_torso_m', 'peasant_legs_m', 'peasant_feet_m'], hair: [], colorways: [], skin: NPC_ARM_COLORS[role], hairColor: null });
}

/**
 * The teams a match plays with: the map's (two for Capture the Flag and Bomb,
 * else as many as the rules' team sizes), renamed and recoloured by the rules.
 */
export function matchTeams(map: MapDocument, rules: { mode: string; teamSizes?: number[]; teamNames?: string[]; teamColors?: string[] }): readonly Faction[] {
  const two = rules.mode === 'core.ctf' || rules.mode === 'core.bomb';
  return mapTeams(map, two ? 2 : (rules.teamSizes?.length ?? 2)).map((t, i) => ({
    ...t,
    name: rules.teamNames?.[i]?.trim().slice(0, 24) || t.name,
    color: /^#[0-9a-f]{6}$/i.test(rules.teamColors?.[i] ?? '') ? rules.teamColors![i]!.toLowerCase() : t.color,
  }));
}
