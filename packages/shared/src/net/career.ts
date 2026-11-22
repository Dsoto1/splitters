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
  /** Phase 3: the map's name as the match showed it (cleaned to MAP_NAME_MAX of plain characters). */
  map?: string;
  /** Phase 3: rounds fired and hits on enemies by gun ([shots, hits], at most MATCH_WEAPONS of them). */
  weaponRounds?: Record<string, [number, number]>;
  /** Phase 3: when the match ended (Unix seconds); the hub keeps it only within the last HISTORY_AGE_DAYS, else uses its own clock. */
  at?: number;
}

/** One mode's part of a career (Phase 3). */
export interface ModeLine {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  seconds: number;
}

/** One of the last matches (Phase 3): Profile's History. */
export interface HistoryLine {
  /** When it ended, Unix seconds. */
  at: number;
  map: string;
  mode: string;
  result: MatchSummary['result'];
  kills: number;
  deaths: number;
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
  /** Phase 3: the career by mode (a GameMode id → its line), at most CAREER_MODES. Empty in a career from before. */
  modes: Record<string, ModeLine>;
  /** Phase 3: rounds fired and hits by gun ([shots, hits]), the CAREER_WEAPONS most fired kept. */
  weaponRounds: Record<string, [number, number]>;
  /** Phase 3: the last HISTORY_MAX matches, newest first. */
  history: HistoryLine[];
}

/** A match counts once you've been in it this long (a join at the very end, or a quit at once, isn't a match). */
export const MATCH_MIN_SECONDS = 30;
/** The bounds a summary must keep (one match, one player: generous, just past anything a real match makes). */
export const MATCH_LIMITS = { kills: 500, deaths: 500, shots: 50_000, seconds: 4 * 3600, points: 50_000 } as const;
export const MATCH_WEAPONS = 16;
export const CAREER_WEAPONS = 40;
export const CAREER_MODES = 24;
export const HISTORY_MAX = 20;
export const HISTORY_AGE_DAYS = 30;
export const MAP_NAME_MAX = 40;
const RESULTS = ['win', 'loss', 'draw', 'none'] as const;
const WEAPON_ID = /^[a-z][a-z0-9_]*\.[a-z0-9_.-]{1,40}$/;
const MODE_ID = /^[a-z][a-z0-9_]*\.[a-z0-9_.-]{1,40}$/;

export const emptyCareer = (): Career => ({ matches: 0, wins: 0, kills: 0, deaths: 0, shots: 0, hits: 0, headshots: 0, bestStreak: 0, seconds: 0, weaponKills: {}, points: 0, modes: {}, weaponRounds: {}, history: [] });

/** A map name as a career keeps it: letters, digits, spaces and a little punctuation, at most MAP_NAME_MAX; '' for none. */
export function cleanMapName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/[^\p{L}\p{N} '’&.,:!?()_+#-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAP_NAME_MAX).trim();
}

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
  if (s.map !== undefined && typeof s.map !== 'string') return 'map must be text';
  if (s.at !== undefined && !count(s.at, 2 ** 32)) return 'bad time';
  if (s.weaponRounds !== undefined) {
    if (typeof s.weaponRounds !== 'object' || s.weaponRounds === null || Array.isArray(s.weaponRounds)) return 'weapon rounds must be an object';
    const r = Object.entries(s.weaponRounds as Record<string, unknown>);
    if (r.length > MATCH_WEAPONS) return 'too many weapons';
    let fired = 0;
    let hit = 0;
    for (const [id, v] of r) {
      if (!WEAPON_ID.test(id) || !Array.isArray(v) || v.length !== 2 || !count(v[0], MATCH_LIMITS.shots) || !count(v[1], MATCH_LIMITS.shots) || v[1] > v[0]) return 'bad weapon rounds';
      fired += v[0];
      hit += v[1];
    }
    if (fired > s.shots || hit > s.hits) return 'weapon rounds add up to more than shots';
  }
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
    ...(m.map !== undefined && cleanMapName(m.map) ? { map: cleanMapName(m.map) } : {}),
    ...(m.weaponRounds ? { weaponRounds: Object.fromEntries(Object.entries(m.weaponRounds).filter(([, v]) => v[0] > 0).map(([id, v]) => [id, [v[0], v[1]] as [number, number]])) } : {}),
    ...(m.at !== undefined ? { at: m.at } : {}),
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

/** The most-fired guns' rounds, at most `n`, most shots first (ties by id). */
function topRounds(w: Record<string, [number, number]>, n: number): Record<string, [number, number]> {
  return Object.fromEntries(
    Object.entries(w)
      .filter(([, v]) => v[0] > 0)
      .sort((a, b) => b[1][0] - a[1][0] || (a[0] < b[0] ? -1 : 1))
      .slice(0, n),
  );
}

/** The modes most played, at most CAREER_MODES (ties by id). */
function topModes(m: Record<string, ModeLine>): Record<string, ModeLine> {
  return Object.fromEntries(
    Object.entries(m)
      .sort((a, b) => b[1].matches - a[1].matches || (a[0] < b[0] ? -1 : 1))
      .slice(0, CAREER_MODES),
  );
}

/**
 * The career with one more match (a new object; `c` is left as it was). `at`: when it ended (Unix seconds), for its
 * history line: the summary's own time, else now.
 */
export function addMatch(c: Career, m: MatchSummary, at: number = m.at ?? Math.floor(Date.now() / 1000)): Career {
  const weaponKills = { ...c.weaponKills };
  for (const [id, n] of Object.entries(m.weaponKills)) weaponKills[id] = (weaponKills[id] ?? 0) + n;
  const weaponRounds = { ...c.weaponRounds };
  for (const [id, [shots, hits]] of Object.entries(m.weaponRounds ?? {})) {
    const had = weaponRounds[id] ?? [0, 0];
    weaponRounds[id] = [had[0] + shots, had[1] + hits];
  }
  const was = c.modes[m.mode] ?? { matches: 0, wins: 0, kills: 0, deaths: 0, shots: 0, hits: 0, seconds: 0 };
  const modes = { ...c.modes, [m.mode]: { matches: was.matches + 1, wins: was.wins + (m.result === 'win' ? 1 : 0), kills: was.kills + m.kills, deaths: was.deaths + m.deaths, shots: was.shots + m.shots, hits: was.hits + m.hits, seconds: was.seconds + m.seconds } };
  const line: HistoryLine = { at, map: cleanMapName(m.map), mode: m.mode, result: m.result, kills: m.kills, deaths: m.deaths };
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
    modes: topModes(modes),
    weaponRounds: topRounds(weaponRounds, CAREER_WEAPONS),
    history: [line, ...c.history].slice(0, HISTORY_MAX),
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
  const whole = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  const rounds: Record<string, [number, number]> = {};
  if (typeof o.weaponRounds === 'object' && o.weaponRounds !== null) {
    for (const [id, v] of Object.entries(o.weaponRounds as Record<string, unknown>)) {
      if (!WEAPON_ID.test(id) || !Array.isArray(v) || v.length !== 2) continue;
      const shots = whole(v[0]);
      if (shots > 0) rounds[id] = [shots, Math.min(shots, whole(v[1]))];
    }
  }
  const modes: Record<string, ModeLine> = {};
  if (typeof o.modes === 'object' && o.modes !== null && !Array.isArray(o.modes)) {
    for (const [id, v] of Object.entries(o.modes as Record<string, unknown>)) {
      if (!MODE_ID.test(id) || typeof v !== 'object' || v === null) continue;
      const l = v as Record<string, unknown>;
      const line: ModeLine = { matches: whole(l.matches), wins: whole(l.wins), kills: whole(l.kills), deaths: whole(l.deaths), shots: whole(l.shots), hits: whole(l.hits), seconds: whole(l.seconds) };
      if (!line.matches) continue;
      line.wins = Math.min(line.wins, line.matches);
      line.hits = Math.min(line.hits, line.shots);
      modes[id] = line;
    }
  }
  const history: HistoryLine[] = [];
  if (Array.isArray(o.history)) {
    for (const v of o.history.slice(0, HISTORY_MAX)) {
      if (typeof v !== 'object' || v === null) continue;
      const h = v as Record<string, unknown>;
      if (typeof h.mode !== 'string' || !MODE_ID.test(h.mode) || !RESULTS.includes(h.result as MatchSummary['result'])) continue;
      history.push({ at: whole(h.at), map: cleanMapName(h.map), mode: h.mode, result: h.result as MatchSummary['result'], kills: Math.min(whole(h.kills), MATCH_LIMITS.kills), deaths: Math.min(whole(h.deaths), MATCH_LIMITS.deaths) });
    }
  }
  const c: Career = { matches: num('matches'), wins: num('wins'), kills: num('kills'), deaths: num('deaths'), shots: num('shots'), hits: num('hits'), headshots: num('headshots'), bestStreak: num('bestStreak'), seconds: num('seconds'), weaponKills: topWeapons(w, CAREER_WEAPONS), points: num('points'), modes: topModes(modes), weaponRounds: topRounds(rounds, CAREER_WEAPONS), history };
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
  // Phase 3's parts add up to no more than the totals.
  const modes = Object.values(c.modes);
  const sum = (k: keyof ModeLine) => modes.reduce((a, l) => a + l[k], 0);
  if (sum('matches') > c.matches || sum('wins') > c.wins || sum('kills') > c.kills || sum('deaths') > c.deaths || sum('shots') > c.shots || sum('seconds') > c.seconds) return 'modes add up to more than the totals';
  if (Object.values(c.weaponRounds).reduce((a, v) => a + v[0], 0) > c.shots) return 'weapon rounds add up to more than shots';
  if (c.history.length > Math.min(c.matches, HISTORY_MAX)) return 'too much history';
  return null;
}

/** A mode's line's accuracy (%), K/D and win rate, as a career's. */
export const modeAccuracy = (l: Pick<ModeLine, 'shots' | 'hits'>): number | null => careerAccuracy(l);

/** Rank points a kill is worth (content/ranks.ts RANK_POINTS.kill; here so the menu needn't load the ranks). */
export const RANK_KILL_POINTS = 10;
/** A career's rank points (content/ranks.ts): its own, or its kills' worth for a career from before them. */
export const careerRankPoints = (c: { kills: number; points?: number }): number => Math.max(c.points ?? 0, c.kills * RANK_KILL_POINTS);

/** The most rank points a joiner's career may bring (a sanity cap on what the roster carries). */
export const RANK_POINTS_MAX = 10_000_000;
/** A rank-points count from the wire (the roster, a hello): a whole number in range, else null. */
export const readRankPoints = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= RANK_POINTS_MAX ? v : null);

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
