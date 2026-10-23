import type { MapDocument } from '../map/schema.ts';
import { TICK_RATE } from './constants.ts';

export type GameMode = 'core.deathmatch' | 'core.coop' | 'core.tdm';

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

/** The rules a map asks for: its first supported mode. */
export function rulesForMap(map: MapDocument): MatchRules {
  switch (map.metadata.supportedModes[0]) {
    case 'core.coop':
      return DEFAULT_COOP_RULES;
    case 'core.tdm':
      return map.teamSetup ? { ...DEFAULT_TDM_RULES, teamSizes: [...map.teamSetup.sizes] } : DEFAULT_TDM_RULES;
    default:
      return DEFAULT_DEATHMATCH_RULES;
  }
}
