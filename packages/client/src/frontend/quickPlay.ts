import { DEFAULT_RULES, mapPlayerCaps, type MapDocument, type MatchSetup } from '@tiletrigger/shared';

/**
 * Quick Play (main menu): one or two clicks into a match against bots, set up for you. Team Deathmatch or
 * Deathmatch, on one of our well-tested maps for that mode, as many players as the map recommends for the mode
 * (docs/GAME_MODES.md, "Player caps"; no more than this device runs), normal bots, the mode's own score and time
 * (they follow the size). The match starts through the same path as Match setup's Start.
 */
export type QuickMode = 'core.tdm' | 'core.deathmatch';
export const QUICK_MODES: readonly QuickMode[] = ['core.tdm', 'core.deathmatch'];

/**
 * The maps Quick Play picks from, by mode: official maps the bot scorecard and the browser tests play every day
 * (docs/BOTS.md and the TDM/DM tables in HANDOFF: few spawn deaths, bots that move round them), sizes from small to
 * mid. Only maps of the suite (maps/), never a player's own or a test map.
 */
export const QUICK_MAPS: Record<QuickMode, readonly string[]> = {
  'core.tdm': ['sandgate', 'canyon', 'crossroads', 'halcyon_station', 'frost_basin'],
  'core.deathmatch': ['citadel', 'crossroads', 'bunker_cross', 'halcyon_station'],
};

/** A map Quick Play might pick: its key, the modes it plays, its recommended most (metadata), and whether it's ours. */
export interface QuickCandidate {
  key: string;
  modes: readonly string[];
  recommendedMax: number;
  /** One of the suite's maps (not a player's own, not a test map). */
  official: boolean;
}

/**
 * Which map: the mode's list, those the menu has (official and playing the mode); where this device runs fewer
 * players than some maps recommend (a phone), the maps that fit it; not the map played last time when there's
 * another; then one at random (`rand` 0..1). Null when none is here.
 */
export function pickQuickMap(mode: QuickMode, maps: readonly QuickCandidate[], deviceMax: number, last: string | null, rand: number): string | null {
  const here = QUICK_MAPS[mode].map((k) => maps.find((m) => m.key === k && m.official && m.modes.includes(mode))).filter((m): m is QuickCandidate => !!m);
  if (!here.length) return null;
  const fits = here.filter((m) => m.recommendedMax <= deviceMax);
  const pool = fits.length ? fits : here;
  const fresh = pool.length > 1 ? pool.filter((m) => m.key !== last) : pool;
  return fresh[Math.min(fresh.length - 1, Math.floor(Math.max(0, rand) * fresh.length))]!.key;
}

/**
 * The match: the map's recommended player count for the mode (its caps, set in MapMaker or automatic), at most what
 * this device runs. Deathmatch: you and that many less one bots. Team Deathmatch: two even teams (bots fill both;
 * you take a place on the first).
 */
export function quickSetup(mode: QuickMode, map: MapDocument, key: string, deviceMax: number): MatchSetup {
  const recommended = Math.max(2, Math.min(deviceMax, mapPlayerCaps(map, mode).recommended));
  const base: MatchSetup = { map: key, mode, bots: recommended - 1, skill: 'normal', scoreLimit: DEFAULT_RULES[mode].scoreLimit, minutes: 10, scoreAuto: true, timeAuto: true };
  if (mode === 'core.deathmatch') return base;
  const side = Math.max(1, Math.floor(recommended / 2));
  return { ...base, bots: side * 2 - 1, teams: [side, side] };
}

/** What Quick Play remembers in this browser: the mode chosen last, and the map it played. */
export interface QuickPrefs {
  /** Null until Quick Play has been used here. */
  mode: QuickMode | null;
  last: string | null;
}

const KEY = 'tiletrigger.quickPlay';

export function loadQuickPrefs(): QuickPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<QuickPrefs> | null;
    return { mode: QUICK_MODES.includes(raw?.mode as QuickMode) ? (raw!.mode as QuickMode) : null, last: typeof raw?.last === 'string' ? raw.last : null };
  } catch {
    return { mode: null, last: null };
  }
}

export function saveQuickPrefs(p: QuickPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private windows: remembered for this page only.
  }
}
