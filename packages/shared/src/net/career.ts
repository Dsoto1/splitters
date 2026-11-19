/**
 * Career stats (docs/PLAYER_PROFILES_PLAN.md, Phase 1): what a player has done across matches, summed one match at a
 * time. A guest's career is kept in their browser (client careerStats.ts); a signed-in player's on the hub, with
 * their profile (packages/server/src/profiles.ts, POST /api/v1/profile/match). The browser that played the match
 * counts it (client game/careerTally.ts) and sends one small summary at the end; the hub checks it is plausible
 * (`matchProblem`) and adds it. There is no ranked play, so a summary is trusted as far as these bounds go
 * (docs/MULTIPLAYER_DIRECTION.md §6: basic sanity is enough).
 */

/** One match as the player's browser counted it. */
export interface MatchSummary {
  /** The mode played (a GameMode id). */
  mode: string;
  /** Your team (or you, free-for-all; co-op: the mission) won, lost or drew; 'none' when the match had no winner to speak of. */
  result: 'win' | 'loss' | 'draw' | 'none';
  kills: number;
  deaths: number;
  /** Rounds fired from guns (hitscan, not melee or projectiles), as the end-of-match Most Accurate award counts them. */
  shots: number;
  /** Of those, the ones that hit an enemy. */
  hits: number;
  headshots: number;
  /** Most kills in one life. */
  bestStreak: number;
  /** Seconds you were in the match. */
  seconds: number;
  /** Kills by weapon id (core.rifle …), at most MATCH_WEAPONS of them. */
  weaponKills: Record<string, number>;
  /** Rank points earned (content/ranks.ts: kills and objective plays). Optional: an older hub drops it, an older browser sends none. */
  points?: number;
}

/** The totals. */
export interface Career {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  headshots: number;
  bestStreak: number;
  seconds: number;
  /** Kills by weapon id, the CAREER_WEAPONS most used kept. */
  weaponKills: Record<string, number>;
  /** Rank points (content/ranks.ts), summed from matches that sent them; 0 in a career from before them (its kills stand in). */
  points: number;
}

/** A match counts once you've been in it this long (a join at the very end, or a quit at once, isn't a match). */
export const MATCH_MIN_SECONDS = 30;
/** The bounds a summary must keep (one match, one player: generous, just past anything a real match makes). */
export const MATCH_LIMITS = { kills: 500, deaths: 500, shots: 50_000, seconds: 4 * 3600, points: 50_000 } as const;
export const MATCH_WEAPONS = 16;
export const CAREER_WEAPONS = 40;
const RESULTS = ['win', 'loss', 'draw', 'none'] as const;
const WEAPON_ID = /^[a-z][a-z0-9_]*\.[a-z0-9_.-]{1,40}$/;
const MODE_ID = /^[a-z][a-z0-9_]*\.[a-z0-9_.-]{1,40}$/;

export const emptyCareer = (): Career => ({ matches: 0, wins: 0, kills: 0, deaths: 0, shots: 0, hits: 0, headshots: 0, bestStreak: 0, seconds: 0, weaponKills: {}, points: 0 });

const count = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

/** Why `m` isn't a match summary the hub keeps, or null when it is. */
export function matchProblem(m: unknown): string | null {
  if (typeof m !== 'object' || m === null) return 'send a match summary';
  const s = m as Partial<Record<keyof MatchSummary, unknown>>;
  if (typeof s.mode !== 'string' || !MODE_ID.test(s.mode)) return 'unknown mode';
  if (!RESULTS.includes(s.result as MatchSummary['result'])) return 'unknown result';
  if (!count(s.kills, MATCH_LIMITS.kills) || !count(s.deaths, MATCH_LIMITS.deaths)) return 'kills and deaths out of range';
  if (!count(s.shots, MATCH_LIMITS.shots) || !count(s.hits, MATCH_LIMITS.shots) || s.hits > s.shots) return 'shots and hits out of range';
  if (!count(s.headshots, MATCH_LIMITS.kills) || s.headshots > s.kills) return 'headshots out of range';
  if (!count(s.bestStreak, MATCH_LIMITS.kills) || s.bestStreak > s.kills) return 'streak out of range';
  if (!count(s.seconds, MATCH_LIMITS.seconds) || s.seconds < MATCH_MIN_SECONDS) return 'too short to count';
  if (s.points !== undefined && !count(s.points, MATCH_LIMITS.points)) return 'points out of range';
  if (typeof s.weaponKills !== 'object' || s.weaponKills === null || Array.isArray(s.weaponKills)) return 'weapon kills must be an object';
  const w = Object.entries(s.weaponKills as Record<string, unknown>);
  if (w.length > MATCH_WEAPONS) return 'too many weapons';
  let sum = 0;
  for (const [id, n] of w) {
    if (!WEAPON_ID.test(id) || !count(n, MATCH_LIMITS.kills)) return 'bad weapon kills';
    sum += n;
  }
  if (sum > s.kills) return 'weapon kills add up to more than kills';
  return null;
}

/** Only the summary's own fields (what the hub stores: nothing else a client sends). */
export function cleanSummary(m: MatchSummary): MatchSummary {
  return {
    mode: m.mode,
    result: m.result,
    kills: m.kills,
    deaths: m.deaths,
    shots: m.shots,
    hits: m.hits,
    headshots: m.headshots,
    bestStreak: m.bestStreak,
    seconds: m.seconds,
    weaponKills: Object.fromEntries(Object.entries(m.weaponKills).filter(([, n]) => n > 0)),
    ...(m.points ? { points: m.points } : {}),
  };
}

/** The most-used weapons, at most `n`, most kills first (ties by id, so the result never wobbles). */
function topWeapons(w: Record<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(w)
      .filter(([, k]) => k > 0)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, n),
  );
}

/** The career with one more match (a new object; `c` is left as it was). */
export function addMatch(c: Career, m: MatchSummary): Career {
  const weaponKills = { ...c.weaponKills };
  for (const [id, n] of Object.entries(m.weaponKills)) weaponKills[id] = (weaponKills[id] ?? 0) + n;
  return {
    matches: c.matches + 1,
    wins: c.wins + (m.result === 'win' ? 1 : 0),
    kills: c.kills + m.kills,
    deaths: c.deaths + m.deaths,
    shots: c.shots + m.shots,
    hits: c.hits + m.hits,
    headshots: c.headshots + m.headshots,
    bestStreak: Math.max(c.bestStreak, m.bestStreak),
    seconds: c.seconds + m.seconds,
    weaponKills: topWeapons(weaponKills, CAREER_WEAPONS),
    points: c.points + (m.points ?? 0),
  };
}

/** A career read back from storage or the hub: every field a whole number (missing ones 0), or null when it isn't one. */
export function readCareer(v: unknown): Career | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === 'number' && Number.isFinite(o[k]) && (o[k] as number) >= 0 ? Math.floor(o[k] as number) : 0);
  const w: Record<string, number> = {};
  if (typeof o.weaponKills === 'object' && o.weaponKills !== null) {
    for (const [id, n] of Object.entries(o.weaponKills as Record<string, unknown>)) if (WEAPON_ID.test(id) && typeof n === 'number' && n > 0) w[id] = Math.floor(n);
  }
  const c: Career = { matches: num('matches'), wins: num('wins'), kills: num('kills'), deaths: num('deaths'), shots: num('shots'), hits: num('hits'), headshots: num('headshots'), bestStreak: num('bestStreak'), seconds: num('seconds'), weaponKills: topWeapons(w, CAREER_WEAPONS), points: num('points') };
  c.wins = Math.min(c.wins, c.matches);
  c.hits = Math.min(c.hits, c.shots);
  return c;
}

/**
 * Why a guest's career can't be moved onto an account (the one-time move at the first sign-in), or null. Its
 * totals must be ones real matches could add up to: per match no more than MATCH_LIMITS.
 */
export function careerProblem(v: unknown): string | null {
  const c = readCareer(v);
  if (!c) return 'send a career';
  if (c.matches < 1) return 'no matches';
  if (c.matches > 100_000) return 'too many matches';
  const per = (n: number, max: number) => n <= c.matches * max;
  if (!per(c.points, MATCH_LIMITS.points)) return 'totals out of range';
  if (!per(c.kills, MATCH_LIMITS.kills) || !per(c.deaths, MATCH_LIMITS.deaths) || !per(c.shots, MATCH_LIMITS.shots) || !per(c.seconds, MATCH_LIMITS.seconds)) return 'totals out of range';
  if (c.seconds < c.matches * MATCH_MIN_SECONDS) return 'totals out of range';
  if (c.headshots > c.kills || c.bestStreak > c.kills || c.bestStreak > MATCH_LIMITS.kills) return 'totals out of range';
  if (Object.values(c.weaponKills).reduce((a, b) => a + b, 0) > c.kills) return 'weapon kills add up to more than kills';
  return null;
}

/** Rank points a kill is worth (content/ranks.ts RANK_POINTS.kill; here so the menu needn't load the ranks). */
export const RANK_KILL_POINTS = 10;
/** A career's rank points (content/ranks.ts): its own, or its kills' worth for a career from before them. */
export const careerRankPoints = (c: { kills: number; points?: number }): number => Math.max(c.points ?? 0, c.kills * RANK_KILL_POINTS);

/** Hits over rounds fired, in percent (null before any rounds). */
export const careerAccuracy = (c: Pick<Career, 'shots' | 'hits'>): number | null => (c.shots > 0 ? Math.round((c.hits / c.shots) * 1000) / 10 : null);
/** Kills per death, to two places (kills alone before any death). */
export const careerKd = (c: Pick<Career, 'kills' | 'deaths'>): number => Math.round((c.kills / Math.max(1, c.deaths)) * 100) / 100;
/** Wins over matches, in percent (null before any match). */
export const careerWinRate = (c: Pick<Career, 'matches' | 'wins'>): number | null => (c.matches > 0 ? Math.round((c.wins / c.matches) * 100) : null);
/** The weapon with the most kills (ties by id), or null. */
export function favouriteWeapon(c: Pick<Career, 'weaponKills'>): string | null {
  return Object.keys(topWeapons(c.weaponKills, 1))[0] ?? null;
}
