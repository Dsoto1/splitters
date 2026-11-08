import { TICK_RATE } from './constants.ts';
import type { GameMode } from './rules.ts';
import type { RotationEntry } from './rotation.ts';

/**
 * Between matches: the end-of-match scoreboard, then everyone votes on the next map from two or three of our own
 * maps that fit the people in the match and the mode, and the next match starts on the winner about 20 s after the
 * last one ended (docs/GAME_MODES.md "Between matches"). The same rules run on a dedicated server or Host Service
 * (server.ts), in a browser hosting a match (matchHost.ts; the page picks the maps, it knows our suite) and offline.
 *
 * - **Who votes:** people only (players and spectators), one vote each, changeable until the vote closes. Bots
 *   don't vote: a match of one person and bots is that person's pick.
 * - **The winner:** the most votes. A tie goes to the host's own vote when it is among the tied maps (a browser
 *   host; a dedicated server has no player of its own), else to the first tied map in the list, and the list
 *   starts with the rotation's next map: no votes at all keeps the rotation going as if there had been no vote.
 * - **Off** (the host's "Vote on the next map" setting): plain rotation, as before (an empty rotation replays).
 */

/** How long the vote stays open (s), from the end of the match: the scoreboard and the vote share the screen. */
export const VOTE_SECONDS = 12;
/** The winner on screen before everyone travels (s). With the map's load and the start countdown: ~20 s in all. */
export const VOTE_RESULT_SECONDS = 3;
/** Maps on the ballot at most (two when there are no more that fit). */
export const VOTE_OPTIONS = 3;

/** One map on the ballot: a suite map ID, its display name, and the mode it would play. */
export interface VoteOption {
  map: string;
  name: string;
  mode: GameMode;
}

/** What everyone's screen shows of the vote (ServerMessage `vote`). */
export interface VoteState {
  /** The maps, in ballot order (the first is the rotation's next, when there is one). */
  o: VoteOption[];
  /** Votes for each, in the same order. */
  n: number[];
  /** Seconds until the vote closes (0 once it has). */
  left: number;
  /** The winner (index into `o`), once the vote has closed. */
  w?: number;
  /** How it was won: the most votes, a tie the host broke, a tie the list order broke, or nobody voted. */
  by?: VoteWin;
}

export type VoteWin = 'votes' | 'host' | 'order' | 'none';

/** A candidate for the ballot: a map in a mode, and the most players that map takes in that mode (mapPlayerCaps). */
export interface VoteCandidate extends RotationEntry {
  name: string;
  max: number;
}

/** A small seeded random source (tests pass one; hosts use Math.random). */
export type VoteRandom = () => number;

/**
 * The ballot: up to `count` maps that fit `people`, never the map just played (unless nothing else fits).
 * `rotation`: the host's rotation, from its next entry on (its order); `suite`: the rest of our maps that play the
 * mode just played. The rotation's next fitting entry comes first, then the rest of the rotation, then the suite in
 * a random order. Fewer than two that fit: no vote (an empty list), and the host goes on as without one.
 */
export function pickVoteOptions(o: {
  rotation: readonly VoteCandidate[];
  suite: readonly VoteCandidate[];
  current: string;
  people: number;
  count?: number;
  random?: VoteRandom;
}): VoteOption[] {
  const count = Math.max(2, Math.min(o.count ?? VOTE_OPTIONS, 4));
  const random = o.random ?? Math.random;
  const fits = (c: VoteCandidate) => c.max >= Math.max(1, o.people);
  const out: VoteOption[] = [];
  const add = (c: VoteCandidate) => {
    if (out.length < count && !out.some((x) => x.map === c.map)) out.push({ map: c.map, name: c.name, mode: c.mode });
  };
  const fresh = (c: VoteCandidate) => fits(c) && c.map !== o.current;
  for (const c of o.rotation) if (fresh(c)) add(c);
  const rest = o.suite.filter(fresh);
  // Fisher-Yates over a copy: a different few each time.
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  for (const c of rest) add(c);
  // Nothing else fits: the map just played may come back as an option.
  if (out.length < 2) for (const c of [...o.rotation, ...o.suite]) if (fits(c) && c.map === o.current) add(c);
  return out.length >= 2 ? out : [];
}

/**
 * The winner from everyone's votes (voter → option index). Ties: the host's vote when it is among them, else the
 * first tied option in ballot order; no votes: the first option.
 */
export function tallyVotes(votes: ReadonlyMap<number, number>, options: number, host: number | null = null): { winner: number; counts: number[]; by: VoteWin } {
  const counts = Array.from({ length: options }, () => 0);
  for (const i of votes.values()) if (i >= 0 && i < options) counts[i]!++;
  const most = Math.max(0, ...counts);
  if (most === 0) return { winner: 0, counts, by: 'none' };
  const tied = counts.flatMap((n, i) => (n === most ? [i] : []));
  if (tied.length === 1) return { winner: tied[0]!, counts, by: 'votes' };
  const mine = host === null ? undefined : votes.get(host);
  if (mine !== undefined && tied.includes(mine)) return { winner: mine, counts, by: 'host' };
  return { winner: tied[0]!, counts, by: 'order' };
}

/**
 * One vote, run by whoever runs the match, ticked with it: open at the end of a match, closed `seconds` later (or
 * when the match's intermission is held longer: `closeAt` follows the host), then the winner, then the travel.
 */
export class MapVote {
  private readonly votes = new Map<number, number>();
  private result: { winner: number; counts: number[]; by: VoteWin } | null = null;
  /** When it closes as planned (a held scoreboard may keep it open longer, never shorter). */
  readonly planned: number;

  constructor(
    readonly options: readonly VoteOption[],
    /** Tick the vote closes at. */
    public closeAt: number,
    /** The host's own player (a browser host), whose vote breaks ties; null on a dedicated server. */
    private readonly host: number | null = null,
  ) {
    this.planned = closeAt;
  }

  /** The ticks a vote takes, open to travel. */
  static ticks(): number {
    return (VOTE_SECONDS + VOTE_RESULT_SECONDS) * TICK_RATE;
  }

  get closed(): boolean {
    return this.result !== null;
  }

  /** The winning option once closed. */
  get winner(): VoteOption | null {
    return this.result ? (this.options[this.result.winner] ?? null) : null;
  }

  /** `slot` votes for option `i` (a later vote replaces an earlier one). False when closed or out of range. */
  cast(slot: number, i: number): boolean {
    if (this.result || !Number.isInteger(i) || i < 0 || i >= this.options.length) return false;
    if (this.votes.get(slot) === i) return false;
    this.votes.set(slot, i);
    return true;
  }

  /** Someone left: their vote goes with them. */
  forget(slot: number): boolean {
    return !this.result && this.votes.delete(slot);
  }

  /** What `slot` voted for (undefined: nothing yet). */
  voteOf(slot: number): number | undefined {
    return this.votes.get(slot);
  }

  /**
   * Close the vote at `tick` if it's time; true the tick it closes. `holdUntil`: the match's intermission end (a
   * host or a test held the scoreboard longer): the vote stays open until the winner's moment before it.
   */
  tick(tick: number, holdUntil: number | null = null): boolean {
    if (holdUntil !== null) this.closeAt = Math.max(this.planned, holdUntil - (VOTE_RESULT_SECONDS + 1) * TICK_RATE);
    if (this.result || tick < this.closeAt) return false;
    this.result = tallyVotes(this.votes, this.options.length, this.host);
    return true;
  }

  /** The vote as everyone's screen shows it. */
  state(tick: number): VoteState {
    const counts = this.result?.counts ?? tallyVotes(this.votes, this.options.length).counts;
    return {
      o: this.options.map((x) => ({ ...x })),
      n: counts,
      left: this.result ? 0 : Math.max(0, Math.ceil((this.closeAt - tick) / TICK_RATE)),
      ...(this.result ? { w: this.result.winner, by: this.result.by } : {}),
    };
  }
}

/** A vote state from untrusted JSON (a host's message), or null. */
export function parseVoteState(v: unknown): VoteState | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.o) || o.o.length < 2 || o.o.length > 4 || !Array.isArray(o.n) || o.n.length !== o.o.length) return null;
  const opts: VoteOption[] = [];
  for (const x of o.o as unknown[]) {
    const e = x as Record<string, unknown> | null;
    if (!e || typeof e.map !== 'string' || typeof e.name !== 'string' || typeof e.mode !== 'string') return null;
    opts.push({ map: e.map.slice(0, 80), name: e.name.slice(0, 80), mode: e.mode as GameMode });
  }
  const n = (o.n as unknown[]).map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0));
  const w = typeof o.w === 'number' && Number.isInteger(o.w) && o.w >= 0 && o.w < opts.length ? o.w : undefined;
  const by = o.by === 'votes' || o.by === 'host' || o.by === 'order' || o.by === 'none' ? o.by : undefined;
  return { o: opts, n, left: typeof o.left === 'number' && Number.isFinite(o.left) ? Math.max(0, Math.min(120, Math.round(o.left))) : 0, ...(w !== undefined ? { w } : {}), ...(by ? { by } : {}) };
}
