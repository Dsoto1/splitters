/**
 * Ranks for everyone (owner, 2026-11-18; behind Options → Ranks & badges, off by default): every player and bot wears
 * a rank on nine steps, its title before the name and its group's badge (insignia.ts has the titles and badges).
 *
 * Progression: a rank rises quietly with what you do, scored as rank points: a kill 10, an objective play 30
 * (Fireteams' own points where they're higher: the same scale, sim/squadScores.ts). Everyone starts on step 1; a squad
 * leader wears at least step 3 and a team leader step 4 while they lead. Points carry from match to match: a player's
 * with their career (net/career.ts `points`; a career from before them counts its kills), a bot's for the session
 * (client game/rankBook.ts, by name). Purely cosmetic: nothing reads a rank but the names and badges.
 */
import type { InsigniaId, RankGroup } from './insignia.ts';
import { RANK_KILL_POINTS } from '../net/career.ts';
import { RANK_TITLES, nameWithoutRank, rankGroup, rankInsignia } from './insignia.ts';

/** Rank points at which each step starts (step 1 at 0). A good match is 100-250, so a session climbs a few steps. */
export const RANK_STEP_POINTS = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5000] as const;
/** What each play is worth in rank points. */
export const RANK_POINTS = { kill: RANK_KILL_POINTS, objective: 30 } as const;
/** The step a leader wears at least, while leading (owner, 2026-11-18). */
export const LEADER_STEP = { squad: 3, team: 4 } as const;

/** One match's rank points from a scoreboard line: kills and objective plays, or Fireteams' points where higher. */
export function matchRankPoints(s: { k: number; o?: number; p?: number }): number {
  const plays = Math.max(0, s.k) * RANK_POINTS.kill + Math.max(0, s.o ?? 0) * RANK_POINTS.objective;
  return Math.max(plays, Math.max(0, s.p ?? 0));
}

/** The step (1 to 9) for rank points, at least `floor` (a leader's). */
export function rankStep(points: number, floor = 1): number {
  let n = 1;
  for (let i = 1; i < RANK_STEP_POINTS.length; i++) if (points >= RANK_STEP_POINTS[i]!) n = i + 1;
  return Math.max(n, Math.min(9, floor));
}

/** A step's title in a group ("Sgt.", "Ghast"). */
export const rankTitle = (group: RankGroup, step: number): string => RANK_TITLES[group][Math.max(1, Math.min(9, step)) - 1]!;

/** What a ranked player is shown as: their title before their name (an Army soldier's own rank replaced). */
export function rankedName(name: string, group: RankGroup, step: number): string {
  return `${rankTitle(group, step)} ${group === 'army' ? nameWithoutRank(name, true) : name}`;
}

/** A player's rank as shown: their group, step, title, badge and name. */
export interface ShownRank {
  group: RankGroup;
  step: number;
  ins: InsigniaId;
  name: string;
}

/** Everything shown for a look, a name and a step. */
export function shownRank(look: string | undefined, name: string, step: number): ShownRank {
  const group = rankGroup(look);
  return { group, step, ins: rankInsignia(group, step), name: rankedName(name, group, step) };
}
