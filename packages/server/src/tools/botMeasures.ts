import { TICK_RATE, type GameEvent } from '@tiletrigger/shared';
import type { Match } from '@tiletrigger/shared/match';

/**
 * Behaviour measures (docs/BOTS.md "Measuring"; `pnpm bench` and the bot scorecard, `pnpm bot-report`): deaths soon
 * after spawning (from the match's first tick, warm-up included), map coverage (the share of the navmesh's 21 m
 * regions some bot stood in, per minute), how evenly the bots used the map (entropy of bot-seconds per region,
 * 0..1), crowding (the most bots in one region, averaged over one-second samples).
 */
export class Behaviour {
  private static readonly REGION = 21;
  private readonly regions = new Map<number, number>();
  private readonly hist: Float64Array;
  private visited = new Set<number>();
  private readonly perMinute: number[] = [];
  private samples = 0;
  private crowdSum = 0;
  private readonly crowd = new Map<number, number>();
  earlyKills = 0;
  earlySpawnDeaths = 0;
  spawnDeaths = 0;
  deaths = 0;
  /** Kills by the region the victim fell in (how evenly the fighting spread over the map). */
  private readonly killHist = new Map<number, number>();
  /** Per combatant: the last tick it hit or was hit by an enemy (its fight), and its life's start. */
  private readonly active = new Map<number, number>();
  /** Gaps out of a fight (s): from a spawn or a fight's end to the next fight; of them, from a spawn. */
  readonly gaps: number[] = [];
  readonly firstFights: number[] = [];
  /** Distances (m) from shooter to target of every hit on an enemy (rounds and pellets; melee is about 2 m). */
  private hitDist = 0;
  private hits = 0;

  constructor(match: Match) {
    for (const p of match.nav.places()) {
      const k = Behaviour.key(p);
      if (!this.regions.has(k)) this.regions.set(k, this.regions.size);
    }
    this.hist = new Float64Array(this.regions.size);
  }

  private static key(p: { x: number; y: number; z: number }): number {
    const R = Behaviour.REGION;
    return ((Math.floor(p.x / R) + 512) * 1024 + (Math.floor(p.z / R) + 512)) * 64 + (Math.floor(p.y / 4) + 32);
  }

  /** A fight goes on while its hits come no more than this far apart (s); a longer quiet is time between fights. */
  static readonly FIGHT_GAP = 3;

  /** `slot` hit an enemy or was hit by one this tick: its fight goes on, or a new one starts (the gap before it counted). */
  private fought(match: Match, slot: number): void {
    const c = match.actor(slot);
    if (!c || c.kind === 'npc') return;
    const now = match.tick;
    const born = c.spawnedAt ?? 0;
    const last = this.active.get(slot);
    if (last === undefined || last < born) {
      // The first fight of a life: the time since spawning (warm-up: since the match began).
      const s = (now - born) / TICK_RATE;
      this.gaps.push(s);
      this.firstFights.push(s);
    } else if (now - last > Behaviour.FIGHT_GAP * TICK_RATE) this.gaps.push((now - last) / TICK_RATE);
    this.active.set(slot, now);
  }

  private hit(match: Match, shooter: number, target: number | null | undefined, from?: readonly number[], to?: readonly number[]): void {
    if (target === null || target === undefined || target === shooter) return;
    const a = match.actor(shooter);
    const b = match.actor(target);
    if (!a || !b || b.kind === 'npc' || a.kind === 'npc') return;
    if (a.faction && a.faction === b.faction) return;
    this.fought(match, shooter);
    this.fought(match, target);
    if (from && to) {
      this.hitDist += Math.hypot(to[0]! - from[0]!, to[1]! - from[1]!, to[2]! - from[2]!);
      this.hits++;
    }
  }

  events(match: Match, events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.e === 'shot') {
        const flying = new Set(e.fl ?? []);
        e.hit.forEach((h, i) => !flying.has(i) && this.hit(match, e.s, h, e.from, e.to[i]));
        continue;
      }
      if (e.e === 'impact') {
        this.hit(match, e.s, e.hit, e.from, e.to);
        continue;
      }
      if (e.e === 'melee') {
        this.hit(match, e.s, e.hit);
        continue;
      }
      if (e.e !== 'kill') continue;
      const v = match.actor(e.victim);
      if (v && e.killer !== null && e.killer !== undefined && e.killer !== e.victim) {
        // Blasts and the like have no hit event: the kill is the fight's last blow.
        this.fought(match, e.killer);
        this.fought(match, e.victim);
        const i = this.regions.get(Behaviour.key(v.move.pos));
        if (i !== undefined) this.killHist.set(i, (this.killHist.get(i) ?? 0) + 1);
      }
      const young = !!v && match.tick - (v.spawnedAt ?? -Infinity) < TICK_RATE * 3;
      this.deaths++;
      if (young) this.spawnDeaths++;
      if (match.tick <= TICK_RATE * 15) {
        this.earlyKills++;
        if (young) this.earlySpawnDeaths++;
      }
    }
  }

  sample(match: Match): void {
    this.crowd.clear();
    let top = 0;
    for (const c of match.combatants()) {
      if (!c.alive || !c.bot) continue;
      const i = this.regions.get(Behaviour.key(c.move.pos));
      if (i === undefined) continue;
      this.visited.add(i);
      this.hist[i]!++;
      const n = (this.crowd.get(i) ?? 0) + 1;
      this.crowd.set(i, n);
      if (n > top) top = n;
    }
    this.samples++;
    this.crowdSum += top;
    if (this.samples % 60 === 0) {
      this.perMinute.push(this.visited.size / Math.max(1, this.regions.size));
      this.visited = new Set();
    }
  }

  /** Coverage per minute (the part-minute at the end scaled up to a minute if no whole minute was measured). */
  coverage(seconds: number): number {
    if (this.perMinute.length) return this.perMinute.reduce((a, b) => a + b, 0) / this.perMinute.length;
    return (this.visited.size / Math.max(1, this.regions.size)) * Math.min(1, 60 / Math.max(1, seconds));
  }

  spread(): number {
    const total = this.hist.reduce((a, b) => a + b, 0);
    if (!total || this.regions.size < 2) return 0;
    let h = 0;
    for (const v of this.hist) if (v > 0) h -= (v / total) * Math.log(v / total);
    return h / Math.log(this.regions.size);
  }

  /** Seconds out of a fight between fights (from a spawn or a fight's end to the next), on average; and from a spawn alone. */
  get betweenFights(): number {
    return this.gaps.length ? this.gaps.reduce((a, b) => a + b, 0) / this.gaps.length : 0;
  }

  get firstFight(): number {
    return this.firstFights.length ? this.firstFights.reduce((a, b) => a + b, 0) / this.firstFights.length : 0;
  }

  /** Average shooter-to-target distance of hits on enemies (m). */
  get engagement(): number {
    return this.hits ? this.hitDist / this.hits : 0;
  }

  /**
   * How evenly kills spread over the map: the entropy of kills by 21 m region over the most it could be for that
   * many kills (log of the regions, or of the kills when fewer), 0..1; and the share of kills in the busiest tenth
   * of the regions that saw any.
   */
  killSpread(): { even: number; top10: number } {
    const counts = [...this.killHist.values()];
    const total = counts.reduce((a, b) => a + b, 0);
    if (total < 2 || this.regions.size < 2) return { even: 0, top10: 1 };
    let h = 0;
    for (const v of counts) h -= (v / total) * Math.log(v / total);
    const most = Math.log(Math.min(this.regions.size, total));
    counts.sort((a, b) => b - a);
    const top = counts.slice(0, Math.max(1, Math.ceil(counts.length / 10))).reduce((a, b) => a + b, 0);
    return { even: most > 0 ? h / most : 0, top10: top / total };
  }

  /** The pace of play (bot-report's `pace` line). */
  pace(): { betweenFights: number; firstFight: number; fights: number; engagement: number; hits: number; killSpread: number; killTop10: number } {
    const k = this.killSpread();
    return { betweenFights: round2(this.betweenFights), firstFight: round2(this.firstFight), fights: this.gaps.length, engagement: round2(this.engagement), hits: this.hits, killSpread: round3(k.even), killTop10: round3(k.top10) };
  }

  /** Average of the most bots in one region over the samples. */
  get crowding(): number {
    return this.crowdSum / Math.max(1, this.samples);
  }

  report(match: Match, seconds: number, kills: number): string {
    void match;
    return `behaviour: first 15 s ${this.earlyKills} kills (${this.earlySpawnDeaths} within 3 s of spawning) | spawn deaths ${this.spawnDeaths} of ${this.deaths} (${((this.spawnDeaths / Math.max(1, this.deaths)) * 100).toFixed(1)}%) | coverage ${(this.coverage(seconds) * 100).toFixed(1)}% of ${this.regions.size} regions a minute | spread ${this.spread().toFixed(3)} | crowd ${this.crowding.toFixed(1)} | kills/min ${((kills / seconds) * 60).toFixed(0)}`;
  }

  row(id: string, clump: boolean, seconds: number, kills: number, stuck: number): string {
    return `| ${id} | ${clump ? 'clumped' : 'spread'} | ${this.earlyKills} (${this.earlySpawnDeaths}) | ${((this.spawnDeaths / Math.max(1, this.deaths)) * 100).toFixed(1)} | ${(this.coverage(seconds) * 100).toFixed(1)}% | ${this.spread().toFixed(3)} | ${this.crowding.toFixed(1)} | ${((kills / seconds) * 60).toFixed(0)} | ${stuck} |`;
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
