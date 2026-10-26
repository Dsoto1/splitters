import type { MapDocument } from '../map/schema.ts';
import { MAX_PLAYER_SLOTS } from './constants.ts';
import { MODE_LABELS, isTeamMode, mapCanRun, rulesForMap, rulesForMode, type GameMode, type MatchRules } from './rules.ts';

/** Rules that aren't about the map or the mode: they stay as the host set them when the map changes. */
const KEPT = ['bodySizes', 'emotes', 'botStyle', 'killstreaks', 'squadSpawn', 'friendlyFire', 'weapons', 'classes', 'classLimit', 'vehicleDamage', 'gravity', 'fallDamage'] as const;
/** Kept too when the mode stays the same (they mean different things in different modes). */
const SAME_MODE = ['scoreLimit', 'timeLimitSeconds', 'respawnDelayTicks', 'fortBuildSeconds', 'fortCombatSeconds', 'fortCycles', 'fortBudget'] as const;

/** Teams in a mode's rules: two-team modes always two; others the sizes listed (two when none are). */
export const teamCount = (rules: MatchRules): number => (!isTeamMode(rules.mode) ? 0 : rules.mode === 'core.ctf' || rules.mode === 'core.forts' || rules.mode === 'core.bomb' || rules.mode === 'core.hostage' ? 2 : Math.max(2, rules.teamSizes?.length ?? 2));

/** "8v8", "4v4v4": teams of one size. */
export const teamsLabel = (teams: number, size: number): string => Array.from({ length: teams }, () => size).join('v');

/**
 * The host changes map mid-match: the rules for `map` in `mode` (else the
 * current mode where the map runs it, else the map's own), keeping the host's
 * own settings, and the players to fill (team modes: every team at
 * `teamSize`; otherwise the same count as now).
 */
export function rulesForTravel(prev: MatchRules, map: MapDocument, fill: number, mode?: GameMode, teamSize?: number | null): { rules: MatchRules; fill: number } {
  const want = mode && mapCanRun(map, mode) ? mode : mapCanRun(map, prev.mode) ? prev.mode : null;
  const base = want ? rulesForMode(map, want) : rulesForMap(map);
  const out: MatchRules = { ...base };
  const put = <K extends keyof MatchRules>(k: K) => {
    if (prev[k] !== undefined) out[k] = prev[k];
  };
  for (const k of KEPT) put(k);
  if (base.mode === prev.mode) for (const k of SAME_MODE) put(k);
  if (prev.leaders && isTeamMode(base.mode)) out.leaders = prev.leaders;
  if (classesClash(out)) delete out.classes;
  const teams = teamCount(out);
  if (!teams) return { rules: out, fill: Math.max(1, Math.min(MAX_PLAYER_SLOTS, fill)) };
  const size = Math.max(1, Math.min(Math.floor(MAX_PLAYER_SLOTS / teams), teamSize ?? Math.max(1, Math.round(fill / teams))));
  out.teamSizes = Array.from({ length: teams }, () => size);
  return { rules: out, fill: size * teams };
}

/** Classes don't mix with spears or discs only. */
const classesClash = (r: MatchRules): boolean => !!r.classes && !!r.weapons && r.weapons !== 'normal';

/** "Changing map to Diamond Park (Team Deathmatch)…" */
export const travelNotice = (name: string, mode: GameMode): string => `Changing map to ${name} (${MODE_LABELS[mode]})…`;
