import { MODE_LABELS, type GameMode } from '../sim/rules.ts';

/** What a MapMaker bot test run (editor/mapTest.ts) found, in numbers, and in lines for a person. */
export interface BotTestSummary {
  mode: GameMode;
  bots: number;
  /** Match seconds played. */
  seconds: number;
  kills: number;
  stuck: number;
  searches: number;
  failed: number;
  /** The objective's moments: when each first happened (match seconds) and how often. */
  objective: { what: string; first: number; count: number }[];
  /** King of the Hill: seconds the hill was held by one team, and contested. */
  hill?: { held: number; contested: number };
  /** Wall-clock milliseconds the worker spent on the match, and per match second. */
  ms: number;
  msPerSecond: number;
}

/** Modes with objectives whose moments a run lists (none happening is worth saying). */
const OBJECTIVE_MODES = new Set<GameMode>(['core.ctf', 'core.bomb', 'core.hostage', 'core.breakthrough', 'core.elim', 'core.forts']);

/** Match seconds as m:ss. */
export function matchClock(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
}

/** A line of the summary for a person (MapMaker's results panel). */
export function botTestLines(s: BotTestSummary): string[] {
  const pct = s.searches ? ` (${((s.failed / s.searches) * 100).toFixed(1)}% of ${s.searches})` : '';
  const out = [`${MODE_LABELS[s.mode]}, ${s.bots} bots, ${matchClock(s.seconds)} played`, `Kills: ${s.kills} (${s.seconds ? ((s.kills / s.seconds) * 60).toFixed(1) : 0} a minute)`, `Stuck recoveries: ${s.stuck}`, `Failed route searches: ${s.failed}${pct}`];
  if (s.hill) out.push(`Hill held ${s.hill.held} s, contested ${s.hill.contested} s`);
  if (!s.objective.length && OBJECTIVE_MODES.has(s.mode)) out.push('No objective moments in this run');
  for (const o of s.objective) out.push(`${o.what}: first at ${matchClock(o.first)}${o.count > 1 ? `, ${o.count} times` : ''}`);
  return out;
}
