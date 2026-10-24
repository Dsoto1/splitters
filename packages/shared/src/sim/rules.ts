import type { MapDocument } from '../map/schema.ts';
import { TICK_RATE } from './constants.ts';
import { mapTeams } from './npc.ts';

export type GameMode = 'core.deathmatch' | 'core.coop' | 'core.tdm' | 'core.ctf' | 'core.koth' | 'core.elim';

/** Every mode, in menu order. */
export const GAME_MODES: readonly GameMode[] = ['core.deathmatch', 'core.tdm', 'core.ctf', 'core.koth', 'core.elim', 'core.coop'];

export const MODE_LABELS: Record<GameMode, string> = {
  'core.deathmatch': 'Deathmatch',
  'core.tdm': 'Team Deathmatch',
  'core.ctf': 'Capture the Flag',
  'core.koth': 'King of the Hill',
  'core.elim': 'Elimination',
  'core.coop': 'Co-op',
};

/** Modes played in teams (factions from mapTeams). */
export const isTeamMode = (mode: string): boolean => mode === 'core.tdm' || mode === 'core.ctf' || mode === 'core.koth' || mode === 'core.elim';

export const isGameMode = (mode: string): mode is GameMode => (GAME_MODES as readonly string[]).includes(mode);

/** Reusable, mode-agnostic match rules (v1 spec §4.3). */
export interface MatchRules {
  mode: GameMode;
  /** Kills that win the round; 0 = no score limit (co-op ends through logic). */
  scoreLimit: number;
  /** 0 = no time limit. */
  timeLimitSeconds: number;
  respawnDelayTicks: number;
  /** Weapons every player spawns with; the last one is held. */
  startingWeapons: string[];
  /** Frag grenades everyone spawns with. */
  startingGrenades: number;
  /** Ticks the results screen stays up before the next round starts. */
  intermissionTicks: number;
  /**
   * Team modes: players per team, 2–8 teams of any sizes (e.g. [2, 2, 2, 12]).
   * Absent: two teams, balanced as players join.
   */
  teamSizes?: number[];
  /** Capture the Flag: seconds a dropped flag lies before it goes home on its own (default 30). */
  flagReturnSeconds?: number;
  /** King of the Hill: seconds before the hill moves to the next spot (default 60). */
  hillSeconds?: number;
  /** Small and large characters play differently (BODY_SIZES); false makes everyone standard. Default true. */
  bodySizes?: boolean;
  /** Quick messages and emotes (default true). */
  emotes?: boolean;
  /** How bots play: each character's own way (mixed, default), all arena-style or all tactical. */
  botStyle?: 'mixed' | 'arena' | 'tactical';
  /** Kill-streak rewards (UAV, supply pulse, Counter-UAV, airstrike). Default true. */
  killstreaks?: boolean;
  /** Team modes: respawn beside a teammate who isn't in a fight, when one is free. Default true. */
  squadSpawn?: boolean;
}

export const DEFAULT_DEATHMATCH_RULES: MatchRules = {
  mode: 'core.deathmatch',
  scoreLimit: 15,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
};

/**
 * Co-op: every player (and Player Bot) is on the players faction against the
 * map's NPCs. No friendly fire, no score or time limit; the mission's logic
 * ends the round with victory or defeat.
 */
export const DEFAULT_COOP_RULES: MatchRules = {
  mode: 'core.coop',
  scoreLimit: 0,
  timeLimitSeconds: 0,
  respawnDelayTicks: Math.round(TICK_RATE * 3),
  startingWeapons: ['core.knife', 'core.pistol', 'core.rifle'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 8,
};

/**
 * Team Deathmatch: two to eight sides (the map's first two factions, or
 * Embers and Tide, then the rest of the palette), filled to their sizes as
 * players join, no friendly fire. Every kill scores for the
 * killer's team; the first team to the limit wins.
 */
export const DEFAULT_TDM_RULES: MatchRules = {
  mode: 'core.tdm',
  scoreLimit: 40,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 2.5),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
};

/**
 * Capture the Flag: two teams, each with a flag at its base. Bring the enemy
 * flag home while your own is there to score; the score limit counts captures.
 */
export const DEFAULT_CTF_RULES: MatchRules = {
  mode: 'core.ctf',
  scoreLimit: 3,
  timeLimitSeconds: 900,
  respawnDelayTicks: Math.round(TICK_RATE * 3),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 8,
  flagReturnSeconds: 30,
};

/**
 * King of the Hill: a hill zone that moves between the map's hill spots every
 * minute; a team scores a point per second while it alone stands on it.
 */
export const DEFAULT_KOTH_RULES: MatchRules = {
  mode: 'core.koth',
  scoreLimit: 120,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 3),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
  hillSeconds: 60,
};

/**
 * Elimination: round-based Team Deathmatch. The dead wait for the next round;
 * the last team standing wins the round, and the score limit counts rounds.
 */
export const DEFAULT_ELIM_RULES: MatchRules = {
  mode: 'core.elim',
  scoreLimit: 5,
  timeLimitSeconds: 900,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
};

export const DEFAULT_RULES: Record<GameMode, MatchRules> = {
  'core.deathmatch': DEFAULT_DEATHMATCH_RULES,
  'core.tdm': DEFAULT_TDM_RULES,
  'core.coop': DEFAULT_COOP_RULES,
  'core.ctf': DEFAULT_CTF_RULES,
  'core.koth': DEFAULT_KOTH_RULES,
  'core.elim': DEFAULT_ELIM_RULES,
};

/** Capture the Flag needs a flag base for each of its two teams. */
export function hasFlagBases(map: MapDocument): boolean {
  return mapTeams(map, 2).every((t) => map.entities.some((e) => e.kind === 'flag' && e.team === t.id));
}

/** King of the Hill needs at least one hill spot. */
export const hasHills = (map: MapDocument): boolean => map.entities.some((e) => e.kind === 'hill');

/** Can this map run the mode at all (CTF without flag bases or KOTH without hills can't)? */
export function mapCanRun(map: MapDocument, mode: GameMode): boolean {
  if (mode === 'core.ctf') return hasFlagBases(map);
  if (mode === 'core.koth') return hasHills(map);
  return true;
}

/**
 * The modes a map offers: the supported modes it can run, plus Capture the
 * Flag when it has flag bases, King of the Hill when it has hills, and
 * Elimination wherever Team Deathmatch is offered.
 */
export function playableModes(map: MapDocument): GameMode[] {
  const listed = map.metadata.supportedModes.filter(isGameMode).filter((m) => mapCanRun(map, m));
  const out = listed.length ? [...listed] : (['core.deathmatch'] as GameMode[]);
  if (hasFlagBases(map) && !out.includes('core.ctf')) out.push('core.ctf');
  if (hasHills(map) && !out.includes('core.koth')) out.push('core.koth');
  if (out.includes('core.tdm') && !out.includes('core.elim')) out.push('core.elim');
  return out;
}

/** Default rules for a mode on a map (team modes take the map's recommended teams; CTF is always two). */
export function rulesForMode(map: MapDocument, mode: GameMode): MatchRules {
  const base = DEFAULT_RULES[mode];
  if (mode === 'core.ctf') return { ...base, teamSizes: [...(map.teamSetup?.sizes.slice(0, 2) ?? [8, 8])] };
  if (isTeamMode(mode) && map.teamSetup) return { ...base, teamSizes: [...map.teamSetup.sizes] };
  return base;
}

/** The rules a map asks for: its first supported mode (when it can run it). */
export function rulesForMap(map: MapDocument): MatchRules {
  const first = map.metadata.supportedModes[0];
  return rulesForMode(map, first && isGameMode(first) && mapCanRun(map, first) ? first : 'core.deathmatch');
}
