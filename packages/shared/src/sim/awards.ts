/**
 * End-of-match awards for every mode, and the revenge and nemesis callouts (docs/GAME_MODES.md, "Spawns, protection
 * and awards"): Most Accurate (hits over rounds fired, `accuracyMinShots` at least), Longest Streak (kills in one
 * life), Nemesis (the most kills of one opponent) and Most Revenge Kills (downing whoever downed you last). Roulette
 * adds its own (sim/roulette.ts: Shapeshifter, Giant Slayer, Moonwalker, Unluckiest Roll) to the same list.
 *
 * The match feeds it every round fired and hit (its shot and impact events) and every kill; everything is sim state,
 * deterministic, and cleared with the round. Thresholds are data: content/match-play.json `awards` and `callouts`.
 */
import { MATCH_PLAY } from '../content/matchPlay.generated.ts';
import { getLook } from '../content/looks.ts';
import type { GameEvent } from '../protocol.ts';
import type { RouletteAward } from './roulette.ts';

/** The match's own awards (every mode); Roulette's kinds join them in Roulette. */
export type MatchAwardKind = 'accurate' | 'streak' | 'nemesis' | 'revenge';

/**
 * An award at the end of a match: [kind, slot, value, extra]. Value: accuracy in percent, kills, revenge kills (and
 * Roulette's: characters, kills, air kills, tenths of a second). Extra: Nemesis, the slot of the one they kept
 * downing; Most Accurate, the rounds fired; Unluckiest Roll, the look.
 */
export type MatchAward = [kind: MatchAwardKind, slot: number, value: number, extra?: number] | RouletteAward;

/** A callout as a kill makes it: `s` got revenge on `t`, or `s` became `t`'s nemesis (`n` kills in a row). */
export type Callout = { a: 'revenge'; s: number; t: number } | { a: 'nemesis'; s: number; t: number; n: number };

const A = MATCH_PLAY.awards;
const NEMESIS_RUN: number = MATCH_PLAY.callouts.nemesis;

interface Tally {
  shots: number;
  hits: number;
  streak: number;
  best: number;
  revenge: number;
  /** Who downed them last (a revenge target), or -1. */
  lastKiller: number;
}

export class MatchAwards {
  private readonly tally = new Map<number, Tally>();
  /** Kills of `victim` by `killer` this match: `killer * 4096 + victim` -> kills. */
  private readonly pair = new Map<number, number>();
  /** Kills in a row of `victim` by `killer` with none back (the nemesis callout). */
  private readonly run = new Map<number, number>();

  private of(slot: number): Tally {
    let t = this.tally.get(slot);
    if (!t) this.tally.set(slot, (t = { shots: 0, hits: 0, streak: 0, best: 0, revenge: 0, lastKiller: -1 }));
    return t;
  }

  reset(): void {
    this.tally.clear();
    this.pair.clear();
    this.run.clear();
  }

  /**
   * Rounds fired and hits on enemies from a tick's events: a shot's rounds (each pellet; one still in flight hits or
   * misses with its impact), and the impacts of rounds that were. `counts(slot)`: a player or bot (not an NPC);
   * `enemies(a, b)`: whether a hit of b by a counts (not a teammate, a vehicle or a prop).
   */
  events(events: readonly GameEvent[], counts: (slot: number) => boolean, enemies: (a: number, b: number) => boolean, rounds: (weapon: string) => boolean): void {
    for (const e of events) {
      if (e.e === 'shot') {
        if (!counts(e.s) || !rounds(e.w)) continue;
        const t = this.of(e.s);
        const flying = e.fl?.length ? new Set(e.fl) : null;
        for (let i = 0; i < e.to.length; i++) {
          t.shots++;
          const h = e.hit[i];
          if (!flying?.has(i) && h !== null && h !== undefined && enemies(e.s, h)) t.hits++;
        }
      } else if (e.e === 'impact') {
        if (!counts(e.s) || !rounds(e.w)) continue;
        if (e.hit !== null && enemies(e.s, e.hit)) this.of(e.s).hits++;
      }
    }
  }

  /**
   * A kill that scores (`killer` a player or bot downing an enemy, not a team kill or their own fall), or a death
   * that doesn't (`killer` null: a fall, their own grenade). Returns the callouts it makes.
   */
  kill(killer: number | null, victim: number): Callout[] {
    const out: Callout[] = [];
    const v = this.of(victim);
    v.streak = 0;
    if (killer === null || killer === victim) return out;
    const k = this.of(killer);
    k.streak++;
    k.best = Math.max(k.best, k.streak);
    const key = killer * 4096 + victim;
    this.pair.set(key, (this.pair.get(key) ?? 0) + 1);
    // Revenge: downing whoever downed you last (once for each time they did).
    if (k.lastKiller === victim) {
      k.revenge++;
      k.lastKiller = -1;
      out.push({ a: 'revenge', s: killer, t: victim });
    }
    v.lastKiller = killer;
    // Nemesis: the same player downing you again and again with none back (the run ends when you get one back).
    this.run.delete(victim * 4096 + killer);
    const run = (this.run.get(key) ?? 0) + 1;
    this.run.set(key, run);
    if (run === NEMESIS_RUN) out.push({ a: 'nemesis', s: killer, t: victim, n: run });
    return out;
  }

  /**
   * The awards for the players still in the match (`slots`, in slot order; ties go to the lower slot; an award
   * nobody earned isn't given).
   */
  awards(slots: readonly number[]): MatchAward[] {
    const out: MatchAward[] = [];
    const here = new Set(slots);
    const rows = [...slots].sort((a, b) => a - b).map((s) => [s, this.tally.get(s)] as const).filter((x): x is readonly [number, Tally] => !!x[1]);
    const top = (value: (t: Tally) => number, min: number): readonly [number, Tally] | null => {
      let best: readonly [number, Tally] | null = null;
      for (const x of rows) if (value(x[1]) >= min && (!best || value(x[1]) > value(best[1]))) best = x;
      return best;
    };
    const acc = top((t) => (t.shots >= A.accuracyMinShots ? t.hits / t.shots : -1), 0);
    if (acc && acc[1].hits > 0) out.push(['accurate', acc[0], Math.round((acc[1].hits / acc[1].shots) * 100), acc[1].shots]);
    const streak = top((t) => t.best, A.streakMin);
    if (streak) out.push(['streak', streak[0], streak[1].best]);
    let nemesis: [number, number, number] | null = null;
    for (const [key, n] of this.pair) {
      const killer = Math.floor(key / 4096);
      const victim = key % 4096;
      if (!here.has(killer) || n < A.nemesisMin) continue;
      if (!nemesis || n > nemesis[2] || (n === nemesis[2] && (killer < nemesis[0] || (killer === nemesis[0] && victim < nemesis[1])))) nemesis = [killer, victim, n];
    }
    if (nemesis) out.push(['nemesis', nemesis[0], nemesis[2], nemesis[1]]);
    const revenge = top((t) => t.revenge, A.revengeMin);
    if (revenge) out.push(['revenge', revenge[0], revenge[1].revenge]);
    return out;
  }

  /** For bot-report and tests: rounds fired and hit, best streak and revenge kills of a slot. */
  stats(slot: number): { shots: number; hits: number; best: number; revenge: number } | null {
    const t = this.tally.get(slot);
    return t ? { shots: t.shots, hits: t.hits, best: t.best, revenge: t.revenge } : null;
  }
}

/** An award's title and line, for the scoreboard (the client's): the match's and Roulette's. */
export function awardText(a: MatchAward, name: (slot: number) => string): { title: string; line: string } {
  const who = name(a[1]);
  switch (a[0]) {
    case 'accurate':
      return { title: 'Most Accurate', line: `${who}: ${a[2]}% of ${a[3] ?? 0} rounds on target` };
    case 'streak':
      return { title: 'Longest Streak', line: `${who}: ${a[2]} kills in one life` };
    case 'nemesis':
      return { title: 'Nemesis', line: `${who}: downed ${typeof a[3] === 'number' ? name(a[3]) : 'one player'} ${a[2]} times` };
    case 'revenge':
      return { title: 'Most Revenge Kills', line: `${who}: ${a[2]} ${a[2] === 1 ? 'payback' : 'paybacks'}` };
    case 'shapeshifter':
      return { title: 'Shapeshifter', line: `${who}: ${a[2]} different characters` };
    case 'giantslayer':
      return { title: 'Giant Slayer', line: `${who}: ${a[2]} large ${a[2] === 1 ? 'character' : 'characters'} downed as a small one` };
    case 'moonwalker':
      return { title: 'Moonwalker', line: `${who}: ${a[2]} air ${a[2] === 1 ? 'kill' : 'kills'}` };
    case 'unlucky':
      return { title: 'Unluckiest Roll', line: `${who} as ${getLook(String(a[3])).name}: down in ${(a[2] / 10).toFixed(1)} s` };
  }
}
