/**
 * Who wears which rank (Options → Ranks & badges; shared content/ranks.ts has the steps, titles and badges). Every
 * browser works it out from what it already gets: the roster (who, which look, a person's career rank points `rx`)
 * and the scoreboard lines (kills, objective plays, Fireteams' points). So it costs nothing at match start and no
 * message more.
 *
 * - **You:** your career's rank points (careerStats.ts) plus this match's.
 * - **Other people:** the career rank points their browser sent as they joined (the roster's `rx`), plus this match's.
 * - **Bots:** what the same bot (by name, an Army bot's own rank left off) earned earlier this session, plus this
 *   match's. The session's tally lives in this module, so it carries from match to match until the page closes.
 * - **Leaders:** a squad leader wears at least step 3 and a team leader step 4, while they lead.
 *
 * A rank only rises: a new match (a slot's points start again) begins from what was carried. A rise from points is a
 * rank-up: the badge swells and glows for a moment (hud.ts, view.ts).
 */
import { matchRankPoints, nameWithoutRank, rankStep, readRankPoints, type RosterEntry, type ScoreEntry } from '@tiletrigger/shared';

/** The session's tally: rank points by who (a bot's name, a person's name), carried from match to match. */
const carried = new Map<string, number>();
/** At most this many kept (a long session of many bots): the oldest go first. */
const CARRIED_MAX = 2000;

function carry(key: string, points: number): void {
  if ((carried.get(key) ?? -1) >= points) return;
  carried.delete(key);
  carried.set(key, points);
  if (carried.size > CARRIED_MAX) carried.delete(carried.keys().next().value!);
}

/** Tests: forget the session's tally. */
export function resetCarriedRanks(): void {
  carried.clear();
}

/** Who a roster entry is, for the session's tally. */
export const rankKey = (p: Pick<RosterEntry, 'name' | 'bot'>): string => (p.bot ? `b:${nameWithoutRank(p.name)}` : `p:${p.name}`);

interface Entry {
  key: string;
  /** Rank points carried into this match. */
  base: number;
  /** This match's rank points as last seen. */
  match: number;
  /** The step from points alone, and as shown (with a leader's floor). */
  earned: number;
  step: number;
}

export class RankBook {
  private readonly bySlot = new Map<number, Entry>();

  /** `myPoints`: your career's rank points now (careerStats.ts), read as a match starts for you. */
  constructor(private readonly myPoints: () => number) {}

  /**
   * The scoreboard changed: everyone's points again. `leader(slot)`: 'team', 'squad' or null. Returns the slots that
   * ranked up from points just now (not someone first seen, not a leader's floor).
   */
  update(roster: ReadonlyMap<number, RosterEntry>, scores: readonly ScoreEntry[], me: number, leader: (slot: number) => 'team' | 'squad' | null): number[] {
    const up: number[] = [];
    for (const s of scores) {
      const p = roster.get(s.s);
      if (!p || p.sp) continue;
      const key = s.s === me ? 'me' : rankKey(p);
      const match = matchRankPoints(s);
      let e = this.bySlot.get(s.s);
      // Someone new in this slot, or a new match (their points started again): from what they carry.
      if (!e || e.key !== key || match < e.match) {
        const base = key === 'me' ? this.myPoints() : Math.max(carried.get(key) ?? 0, p.bot ? 0 : (readRankPoints(p.rx) ?? 0));
        e = { key, base, match, earned: rankStep(base + match), step: 0 };
        this.bySlot.set(s.s, e);
      }
      e.match = match;
      const total = e.base + match;
      if (key !== 'me') carry(key, total);
      const earned = rankStep(total);
      const l = leader(s.s);
      const step = rankStep(total, l === 'team' ? 4 : l === 'squad' ? 3 : 1);
      if (e.step > 0 && earned > e.earned && step > e.step) up.push(s.s);
      e.earned = earned;
      e.step = step;
    }
    return up;
  }

  /** A slot's step as shown (1 to 9), or null before their first scoreboard line. */
  step(slot: number): number | null {
    return this.bySlot.get(slot)?.step || null;
  }

  /** A slot left: forget them here (the session's tally keeps what they earned). */
  forget(slot: number): void {
    this.bySlot.delete(slot);
  }
}
