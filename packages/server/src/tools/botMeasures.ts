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

  events(match: Match, events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.e !== 'kill') continue;
      const v = match.actor(e.victim);
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
