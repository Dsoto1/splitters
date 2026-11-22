/**
 * Host-vouched stats (docs/PLAYER_PROFILES_PLAN.md, Phase 4). A player's own browser counts their career (career.ts),
 * so a modified browser could inflate it. Here the match's host counts instead: at the end of a match a signed-in host
 * sends the hub the standings it computed for the other signed-in players in it (POST /api/v1/profile/vouch). The hub
 * keeps a line only for an account it gave a ticket to join that game's code (the account ticket a host checks), never
 * for the host's own account, and no faster than real time (a pair of host and player can't send an hour of play in a
 * minute). Those lines add up to a second, smaller record on the profile: what other people's hosts saw. Nothing reads
 * it for matchmaking or rewards (there is no ranked play); it is shown beside the career so a card can say how much of
 * it someone else's machine counted.
 */
import { MATCH_LIMITS, MATCH_MIN_SECONDS } from './career.ts';

/** One player's match as the host saw it. */
export interface VouchLine {
  /** The account (Cognito sub) the player's ticket proved to the host. */
  sub: string;
  result: 'win' | 'loss' | 'draw' | 'none';
  kills: number;
  deaths: number;
  /** Seconds the player was in this match. */
  seconds: number;
}

/** A host's report at the end of a match. */
export interface VouchReport {
  /** The join code the game is listed under (the tickets were for it). */
  code: string;
  /** The mode played (a GameMode id). */
  mode: string;
  lines: VouchLine[];
}

/** What other people's hosts counted for an account. */
export interface Vouched {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  seconds: number;
}

export const VOUCH_MAX_LINES = 96;
export const emptyVouched = (): Vouched => ({ matches: 0, wins: 0, kills: 0, deaths: 0, seconds: 0 });

const RESULTS = ['win', 'loss', 'draw', 'none'] as const;
const count = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

/** Why `r` isn't a report the hub reads, or null. (Each line is then checked against the hub's tickets.) */
export function vouchProblem(r: unknown): string | null {
  if (typeof r !== 'object' || r === null) return 'send a report';
  const o = r as Partial<Record<keyof VouchReport, unknown>>;
  if (typeof o.code !== 'string' || !/^[A-Za-z0-9_-]{3,32}$/.test(o.code)) return 'bad code';
  if (typeof o.mode !== 'string' || !/^[a-z][a-z0-9_]*\.[a-z0-9_.-]{1,40}$/.test(o.mode)) return 'unknown mode';
  if (!Array.isArray(o.lines) || o.lines.length > VOUCH_MAX_LINES) return 'bad lines';
  for (const l of o.lines as unknown[]) {
    if (typeof l !== 'object' || l === null) return 'bad line';
    const x = l as Partial<Record<keyof VouchLine, unknown>>;
    if (typeof x.sub !== 'string' || !x.sub || x.sub.length > 128) return 'bad account';
    if (!RESULTS.includes(x.result as VouchLine['result'])) return 'unknown result';
    if (!count(x.kills, MATCH_LIMITS.kills) || !count(x.deaths, MATCH_LIMITS.deaths)) return 'kills and deaths out of range';
    if (!count(x.seconds, MATCH_LIMITS.seconds) || x.seconds < MATCH_MIN_SECONDS) return 'too short to count';
  }
  return null;
}

/** A vouched record read back from storage or the hub (missing fields 0), or an empty one. */
export function readVouched(v: unknown): Vouched {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const n = (k: keyof Vouched) => (typeof o[k] === 'number' && Number.isFinite(o[k]) && (o[k] as number) >= 0 ? Math.floor(o[k] as number) : 0);
  const out = { matches: n('matches'), wins: n('wins'), kills: n('kills'), deaths: n('deaths'), seconds: n('seconds') };
  out.wins = Math.min(out.wins, out.matches);
  return out;
}

/** The record with one more line. */
export const addVouched = (v: Vouched, l: VouchLine): Vouched => ({ matches: v.matches + 1, wins: v.wins + (l.result === 'win' ? 1 : 0), kills: v.kills + l.kills, deaths: v.deaths + l.deaths, seconds: v.seconds + l.seconds });

/** The line a card and Profile show ('' before any). */
export function vouchedLine(v: Vouched): string {
  if (!v.matches) return '';
  return `Counted by other hosts: ${v.matches} ${v.matches === 1 ? 'match' : 'matches'} · ${v.wins} ${v.wins === 1 ? 'win' : 'wins'} · K/D ${(Math.round((v.kills / Math.max(1, v.deaths)) * 100) / 100).toFixed(2)}`;
}
