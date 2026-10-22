import { TICK_RATE } from './constants.ts';

/** Reusable, mode-agnostic match rules (v1 spec §4.3). Phase 0 implements the Deathmatch subset. */
export interface MatchRules {
  mode: 'core.deathmatch';
  scoreLimit: number;
  /** 0 = no time limit. */
  timeLimitSeconds: number;
  respawnDelayTicks: number;
  startingWeapon: string;
  /** Ticks the results screen stays up before the next round starts. */
  intermissionTicks: number;
}

export const DEFAULT_DEATHMATCH_RULES: MatchRules = {
  mode: 'core.deathmatch',
  scoreLimit: 15,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapon: 'core.rifle',
  intermissionTicks: TICK_RATE * 6,
};
