/**
 * A changed map's pace against the map as it was (`pnpm bot-report <map> --base=origin/main`; docs/BOTS.md, "A changed
 * map's pace"): kills a minute and the time from a spawn to the first fight, before and after. A warning, never a
 * gate: Iron Maw went from about 17 kills a minute to about 4 with nothing saying so.
 */
export interface Pace {
  /** Kills a minute over the matches played. */
  killsMin: number;
  /** Seconds from a spawn to that life's first fight (undefined: no life got to a fight, or the mode's report has no pace measures). */
  firstFight?: number;
}

/** Kills a minute below this share of the map before: a warning. */
export const PACE_KILLS_SHARE = 0.6;
/** The first fight this many times later than before (and at least PACE_FIRST_FIGHT_S later): a warning. */
export const PACE_FIRST_FIGHT_TIMES = 1.5;
export const PACE_FIRST_FIGHT_S = 5;

/** What got slower from `before` to `after`, in words ([] for nothing worth a warning). */
export function paceWarnings(before: Pace, after: Pace): string[] {
  const out: string[] = [];
  if (before.killsMin > 0 && after.killsMin < before.killsMin * PACE_KILLS_SHARE) out.push(`kills a minute fell from ${before.killsMin.toFixed(1)} to ${after.killsMin.toFixed(1)} (${Math.round((1 - after.killsMin / before.killsMin) * 100)}% fewer)`);
  if (before.firstFight !== undefined && after.firstFight !== undefined && after.firstFight > before.firstFight * PACE_FIRST_FIGHT_TIMES && after.firstFight - before.firstFight >= PACE_FIRST_FIGHT_S)
    out.push(`the first fight after a spawn comes ${(after.firstFight - before.firstFight).toFixed(1)} s later (${before.firstFight.toFixed(1)} s to ${after.firstFight.toFixed(1)} s)`);
  return out;
}

/** The lines printed for one map: the two numbers before and after, then a WARNING line for what got slower. */
export function paceLines(map: string, base: string, before: Pace, after: Pace): string[] {
  const s = (x: number | undefined) => (x === undefined ? '-' : x.toFixed(1));
  const lines = [`${map} against ${base}: kills a minute ${s(before.killsMin)} → ${s(after.killsMin)}; first fight after a spawn ${s(before.firstFight)} → ${s(after.firstFight)} s`];
  for (const w of paceWarnings(before, after)) lines.push(`WARNING    map.pace             ${map}: ${w}: the change made the map slower to play (not a gate: say so in the handoff if it is meant)`);
  return lines;
}
