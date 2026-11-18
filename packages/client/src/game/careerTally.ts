import { CORE_WEAPONS, MATCH_LIMITS, MATCH_MIN_SECONDS, MATCH_WEAPONS, type GameEvent, type MatchSummary } from '@tiletrigger/shared';

/** Rounds that count towards accuracy: guns' rounds (not melee, not projectiles), as the Most Accurate award counts them (sim/awards.ts). */
const gunRound = (w: string): boolean => {
  const d = CORE_WEAPONS[w];
  return !!d && !d.projectile && d.kind !== 'melee';
};

type RoundEnd = Extract<GameEvent, { e: 'round_end' }>;

/**
 * Your own match, counted from the events every browser already gets (docs/PLAYER_PROFILES_PLAN.md, Phase 1): kills,
 * deaths, rounds fired and hits, headshots, your best streak and kills by weapon. At the end of the match
 * (`round_end`) it makes the summary careerStats.ts adds to your career. A few additions per event: nothing at
 * match start, nothing per frame.
 */
export class CareerTally {
  kills = 0;
  deaths = 0;
  shots = 0;
  hits = 0;
  headshots = 0;
  bestStreak = 0;
  private streak = 0;
  private readonly weapons = new Map<string, number>();
  private startedAt: number;
  /** The summary was made: nothing more counts until the next round starts. */
  private done = false;

  constructor(
    /** Your slot now. */
    private readonly me: () => number,
    /** Whether a hit of `b` by `a` is on an enemy (not a teammate). */
    private readonly enemies: (a: number, b: number) => boolean,
    now: number,
  ) {
    this.startedAt = now;
  }

  /** A new round (the match replayed or moved on): counting starts again. */
  reset(now: number): void {
    this.kills = this.deaths = this.shots = this.hits = this.headshots = this.bestStreak = this.streak = 0;
    this.weapons.clear();
    this.startedAt = now;
    this.done = false;
  }

  event(ev: GameEvent): void {
    if (this.done) return;
    const me = this.me();
    if (me < 0) return;
    if (ev.e === 'shot') {
      if (ev.s !== me || !gunRound(ev.w)) return;
      const flying = ev.fl?.length ? new Set(ev.fl) : null;
      for (let i = 0; i < ev.to.length; i++) {
        this.shots++;
        const h = ev.hit[i];
        if (!flying?.has(i) && h !== null && h !== undefined && h !== me && this.enemies(me, h)) this.hits++;
      }
    } else if (ev.e === 'impact') {
      if (ev.s === me && gunRound(ev.w) && ev.hit !== null && ev.hit !== me && this.enemies(me, ev.hit)) this.hits++;
    } else if (ev.e === 'kill') {
      if (ev.victim === me) {
        this.deaths++;
        this.streak = 0;
      } else if (ev.killer === me && !ev.tk) {
        this.kills++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        if (ev.hs) this.headshots++;
        if (CORE_WEAPONS[ev.weapon]) this.weapons.set(ev.weapon, (this.weapons.get(ev.weapon) ?? 0) + 1);
      }
    }
  }

  /**
   * The match ended: its summary, or null when it doesn't count (you were in it under MATCH_MIN_SECONDS, or it was
   * already summed). `myTeam`: your team's id in a team mode, else null.
   */
  finish(ev: RoundEnd, mode: string, myTeam: string | null, now: number): MatchSummary | null {
    if (this.done) return null;
    this.done = true;
    const seconds = Math.min(MATCH_LIMITS.seconds, Math.round((now - this.startedAt) / 1000));
    if (seconds < MATCH_MIN_SECONDS) return null;
    const me = this.me();
    const result: MatchSummary['result'] = ev.outcome
      ? ev.outcome === 'victory'
        ? 'win'
        : 'loss'
      : 'team' in ev
        ? !myTeam
          ? 'none'
          : ev.team === null || ev.team === undefined
            ? 'draw'
            : ev.team === myTeam
              ? 'win'
              : 'loss'
        : ev.winner === null
          ? 'draw'
          : ev.winner === me
            ? 'win'
            : 'loss';
    const weaponKills = Object.fromEntries([...this.weapons].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, MATCH_WEAPONS));
    return { mode, result, kills: this.kills, deaths: this.deaths, shots: this.shots, hits: this.hits, headshots: this.headshots, bestStreak: this.bestStreak, seconds, weaponKills };
  }
}
