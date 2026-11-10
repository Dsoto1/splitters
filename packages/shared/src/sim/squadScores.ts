/**
 * Fireteams Part 3 (docs/FIRETEAMS_PLAN.md, "Part 3"; docs/BOTS.md, "Fireteams Part 3"): squad scores and the squad
 * MVP at the end of the match.
 *
 * - **Points** (SQUAD_POINTS): a kill 10, an assist 5 (hurting an enemy someone else downs within ASSIST_SECONDS),
 *   an objective play 30 (what the scoreboard's objective column counts: a flag capture, a bomb planted or defused, a
 *   hostage rescued, a Breakthrough zone taken or charge set or defused), and King of the Hill a point for every
 *   second on the hill while your team alone holds it. There are no revives in the team modes, so none count.
 * - **Who gets them:** the player (their own points, every squad they were in), and the squad they are in at that
 *   moment (a squad keeps what its members earned in it when they leave). Team kills, falls and an NPC's kills earn
 *   nothing, as for the match's own score.
 * - **The end of the match** (`squadAwards`): Best Squad (the most points; ties to the lower squad id) and a Squad
 *   MVP for every squad (its member still in the match with the most points of their own; ties to the lower slot).
 *   A squad or member with no points gets nothing.
 *
 * Everything is sim state, deterministic, and cleared with the round.
 */

/** What each play is worth (points). */
export const SQUAD_POINTS = { kill: 10, assist: 5, objective: 30, hill: 1 } as const;
/** Damage dealt this recently (s) before someone else's kill is an assist. */
export const ASSIST_SECONDS = 10;

/** A squad's or a player's tally. */
export interface SquadTally {
  points: number;
  kills: number;
  assists: number;
  /** Objective plays (captures, plants, defuses, rescues, zones). */
  objectives: number;
  /** King of the Hill: seconds on the hill while their team held it. */
  hill: number;
}

/** A squad award: Best Squad [kind, the squad's leader (or first member), points, squad id]; Squad MVP [kind, the member, their points, squad id]. */
export type SquadAward = [kind: 'bestsquad' | 'squadmvp', slot: number, value: number, squad: number];

/** A squad as the awards see it: its id, leader and members (sim/fireteams.ts Squad). */
export interface SquadLike {
  id: number;
  leader: number | null;
  members: readonly number[];
}

const blank = (): SquadTally => ({ points: 0, kills: 0, assists: 0, objectives: 0, hill: 0 });

export class SquadScores {
  private readonly squads = new Map<number, SquadTally>();
  private readonly players = new Map<number, SquadTally>();
  /** Who hurt whom lately: victim -> attacker -> the tick of their last hit. */
  private readonly hurts = new Map<number, Map<number, number>>();
  /** Each player's objective plays as last seen (the match's `objective` counter; credited as it grows). */
  private readonly seen = new Map<number, number>();

  reset(): void {
    this.squads.clear();
    this.players.clear();
    this.hurts.clear();
    this.seen.clear();
  }

  private add(slot: number, squad: number | undefined, f: (t: SquadTally) => void): void {
    let p = this.players.get(slot);
    if (!p) this.players.set(slot, (p = blank()));
    f(p);
    if (squad === undefined) return;
    let s = this.squads.get(squad);
    if (!s) this.squads.set(squad, (s = blank()));
    f(s);
  }

  /** `attacker` hurt `victim`, an enemy of theirs (not a teammate, not themselves). */
  hurt(attacker: number, victim: number, tick: number): void {
    let m = this.hurts.get(victim);
    if (!m) this.hurts.set(victim, (m = new Map()));
    m.set(attacker, tick);
  }

  /**
   * `victim` went down: a scoring kill by `killer` (null: a fall, a team kill, an NPC), and an assist for everyone else
   * who hurt them in the last ASSIST_SECONDS (`tickRate` ticks a second). `squadOf`: a slot's squad id now.
   */
  kill(killer: number | null, victim: number, tick: number, tickRate: number, squadOf: (slot: number) => number | undefined): void {
    const hurt = this.hurts.get(victim);
    this.hurts.delete(victim);
    if (killer === null || killer === victim) return;
    this.add(killer, squadOf(killer), (t) => {
      t.kills++;
      t.points += SQUAD_POINTS.kill;
    });
    if (!hurt) return;
    const since = tick - ASSIST_SECONDS * tickRate;
    for (const [a, at] of [...hurt].sort((x, y) => x[0] - y[0])) {
      if (a === killer || a === victim || at < since) continue;
      this.add(a, squadOf(a), (t) => {
        t.assists++;
        t.points += SQUAD_POINTS.assist;
      });
    }
  }

  /** A player's objective plays as the match counts them now: what's new since last seen is credited. */
  objectives(slot: number, count: number, squad: number | undefined): void {
    const was = this.seen.get(slot);
    this.seen.set(slot, count);
    // (First seen: their count as it stands, nothing credited: a player coming back keeps theirs.)
    if (was === undefined || count <= was) return;
    const n = count - was;
    this.add(slot, squad, (t) => {
      t.objectives += n;
      t.points += n * SQUAD_POINTS.objective;
    });
  }

  /** King of the Hill: a second on the hill while their team alone held it. */
  hill(slot: number, squad: number | undefined): void {
    this.add(slot, squad, (t) => {
      t.hill++;
      t.points += SQUAD_POINTS.hill;
    });
  }

  /** A player left the match: their recent hits no longer earn assists. */
  leave(slot: number): void {
    this.seen.delete(slot);
    for (const m of this.hurts.values()) m.delete(slot);
    this.hurts.delete(slot);
  }

  squad(id: number): SquadTally {
    return this.squads.get(id) ?? blank();
  }

  player(slot: number): SquadTally {
    return this.players.get(slot) ?? blank();
  }

  /** A player's points (0 for none). */
  points(slot: number): number {
    return this.players.get(slot)?.points ?? 0;
  }

  /**
   * The squad awards among the players still in the match (`here`): Best Squad first, then each squad's MVP in the
   * squads' order. Squads with nobody left in the match are left out.
   */
  awards(squads: readonly SquadLike[], here: ReadonlySet<number>): SquadAward[] {
    const out: SquadAward[] = [];
    const live = squads.filter((s) => s.members.some((m) => here.has(m)));
    let best: SquadLike | null = null;
    for (const s of live) {
      const p = this.squad(s.id).points;
      if (p <= 0) continue;
      if (!best || p > this.squad(best.id).points || (p === this.squad(best.id).points && s.id < best.id)) best = s;
    }
    if (best) {
      const named = best.leader !== null && here.has(best.leader) ? best.leader : best.members.filter((m) => here.has(m)).sort((a, b) => a - b)[0]!;
      out.push(['bestsquad', named, this.squad(best.id).points, best.id]);
    }
    for (const s of live) {
      let mvp: number | null = null;
      for (const m of [...s.members].sort((a, b) => a - b)) {
        if (!here.has(m) || this.points(m) <= 0) continue;
        if (mvp === null || this.points(m) > this.points(mvp)) mvp = m;
      }
      if (mvp !== null) out.push(['squadmvp', mvp, this.points(mvp), s.id]);
    }
    return out;
  }
}
