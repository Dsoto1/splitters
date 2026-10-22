import type { MapDocument } from '../map/schema.ts';
import { TICK_RATE } from './constants.ts';

export type GameMode = 'core.deathmatch' | 'core.coop';

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
  /** Ticks the results screen stays up before the next round starts. */
  intermissionTicks: number;
}

export const DEFAULT_DEATHMATCH_RULES: MatchRules = {
  mode: 'core.deathmatch',
  scoreLimit: 15,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapons: ['core.knife', 'core.pistol'],
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
  intermissionTicks: TICK_RATE * 8,
};

/** The rules a map asks for: its first supported mode. */
export function rulesForMap(map: MapDocument): MatchRules {
  return map.metadata.supportedModes[0] === 'core.coop' ? DEFAULT_COOP_RULES : DEFAULT_DEATHMATCH_RULES;
}
