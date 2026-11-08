import { Fireteams, ORDER_KINDS, TICK_RATE, horizontalDistance, type OrderKind, type Squad, type Vec3 } from '@tiletrigger/shared';
import { leadAbility, type Match } from '@tiletrigger/shared/match';

/**
 * Fireteams measures for bot-report (docs/FIRETEAMS_PLAN.md, "Measured with the bot scorecard"):
 * - **cohesion**: each squad member's distance to its leader (both alive, on a squad of two or more), sampled once a
 *   second: the mean, and the share within 10 m and within 25 m;
 * - **survival**: the share of squad members alive, sampled once a second;
 * - **orders**: with `--orders`, every squad's leader is given an order every ORDER_EVERY s (Hold here, Go there,
 *   Regroup, Defend the objective, Follow me, Attack that, in turn, as a person would give them), and how many were
 *   carried out (half the squad there: Fireteams.step) and in how long.
 *
 * With the variant off the same squads are worked out alongside (a Fireteams of the same size kept in line with the
 * roster, as the match would) without the bots knowing: the cohesion and survival bots have by themselves, to compare.
 */
export interface SquadRow {
  /** The variant was on (the bots played in squads), and the squad size. */
  on: boolean;
  size: number;
  squads: number;
  /** Member-seconds sampled (leader and member alive), the mean distance (m), the share within 10 and 25 m. */
  samples: number;
  cohesion: number;
  within10: number;
  within25: number;
  /** The share of squad members alive (member-seconds alive over member-seconds). */
  survival: number;
  /** By order kind: given, carried out, and the mean seconds to carry one out. */
  orders: Partial<Record<OrderKind, [given: number, done: number, seconds: number]>>;
}

/** Scripted orders (--orders): one every this many seconds per squad, staggered by squad. */
const ORDER_EVERY = 30;
const SCRIPT: readonly OrderKind[] = ['hold', 'go', 'regroup', 'defend', 'follow', 'attack'];

export class SquadMeter {
  /** The squads measured alongside with the variant off (made on first use). */
  private shadow: Fireteams | null = null;
  private on = false;
  private samples = 0;
  private dist = 0;
  private near10 = 0;
  private near25 = 0;
  private memberSeconds = 0;
  private aliveSeconds = 0;
  private readonly seen = new Set<number>();

  constructor(
    private readonly match: Match,
    private readonly orders: boolean,
    private readonly size: number,
  ) {}

  /** The match's squads (the variant on: it makes them on its first tick), else the ones worked out alongside. */
  private get ft(): Fireteams {
    if (this.match.fireteams) {
      this.on = true;
      return this.match.fireteams;
    }
    return (this.shadow ??= new Fireteams(this.size));
  }

  /** Every tick (cheap): scripted orders when due. */
  step(tick: number): void {
    const ft = this.match.fireteams;
    if (!this.orders || !ft || this.match.phase !== 'playing') return;
    for (const s of ft.squads) {
      if (s.leader === null || (tick + s.id * 97) % (ORDER_EVERY * TICK_RATE) !== 0) continue;
      const lead = this.match.slots[s.leader];
      if (!lead?.alive) continue;
      const n = Math.floor(tick / (ORDER_EVERY * TICK_RATE)) + s.id;
      const kind = SCRIPT[n % SCRIPT.length]!;
      const at = this.orderPlace(s, kind, lead.move.pos);
      if (at === undefined) continue;
      ft.order(s, kind, at.pos, at.target, tick);
    }
  }

  /** Where (and whom) a scripted order is for, or undefined when there is none (no objective, no enemy alive). */
  private orderPlace(s: Squad, kind: OrderKind, from: Vec3): { pos: Vec3 | null; target: number | null } | undefined {
    const foes = this.match.combatants().filter((c) => c.alive && c.faction && c.faction !== s.team);
    const nearest = (list: readonly { move: { pos: Vec3 }; slot: number }[]) => list.slice().sort((a, b) => horizontalDistance(a.move.pos, from) - horizontalDistance(b.move.pos, from) || a.slot - b.slot)[0];
    switch (kind) {
      case 'hold':
        return { pos: { ...from }, target: null };
      case 'go': {
        // 25 m toward the nearest enemy, as a leader pings a spot ahead.
        const f = nearest(foes);
        if (!f) return undefined;
        const d = Math.max(1, horizontalDistance(f.move.pos, from));
        const k = Math.min(1, 25 / d);
        return { pos: { x: from.x + (f.move.pos.x - from.x) * k, y: from.y, z: from.z + (f.move.pos.z - from.z) * k }, target: null };
      }
      case 'defend': {
        const trips = this.match.botTrips().filter((t) => t.team === s.team && t.kind !== 'carry');
        const pick = trips.filter((t) => t.kind === 'defend').concat(trips)[0];
        return pick ? { pos: { ...pick.to }, target: null } : undefined;
      }
      case 'attack': {
        const f = nearest(foes);
        return f ? { pos: null, target: f.slot } : undefined;
      }
      default:
        return { pos: null, target: null };
    }
  }

  /** Once a second: cohesion and survival (and, with the variant off, the squads brought in line with the roster). */
  sample(): void {
    const m = this.match;
    const ft = this.ft;
    if (!this.match.fireteams) ft.sync(m.combatants().map((c) => ({ slot: c.slot, team: c.faction, human: c.kind === 'human', lead: c.bot ? leadAbility(c.bot.profile) : 0, pos: c.move.pos })), m.tick);
    if (m.phase !== 'playing') return;
    for (const s of ft.squads) {
      this.seen.add(s.id);
      const lead = s.leader === null ? null : m.slots[s.leader];
      for (const slot of s.members) {
        const c = m.slots[slot];
        if (!c) continue;
        this.memberSeconds++;
        if (c.alive) this.aliveSeconds++;
        if (slot === s.leader || !c.alive || !lead?.alive || s.members.length < 2) continue;
        const d = horizontalDistance(c.move.pos, lead.move.pos);
        this.samples++;
        this.dist += d;
        if (d <= 10) this.near10++;
        if (d <= 25) this.near25++;
      }
    }
  }

  result(): SquadRow {
    const orders: SquadRow['orders'] = {};
    for (const o of this.ft.orders) {
      if (o.auto) continue;
      const row = (orders[o.kind] ??= [0, 0, 0]);
      row[0]++;
      if (o.done !== null) {
        row[1]++;
        row[2] += (o.done - o.tick) / TICK_RATE;
      }
    }
    for (const k of ORDER_KINDS) {
      const r = orders[k];
      if (r && r[1]) r[2] = Math.round((r[2] / r[1]) * 10) / 10;
    }
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 1000 : 0);
    return {
      on: this.on,
      size: this.ft.size,
      squads: this.seen.size,
      samples: this.samples,
      cohesion: this.samples ? Math.round((this.dist / this.samples) * 10) / 10 : 0,
      within10: pct(this.near10, this.samples),
      within25: pct(this.near25, this.samples),
      survival: pct(this.aliveSeconds, this.memberSeconds),
      orders,
    };
  }
}

/** One line for a match (bot-report's printMatch). */
export function squadText(r: SquadRow): string {
  const ord = ORDER_KINDS.filter((k) => r.orders[k]).map((k) => {
    const [g, d, s] = r.orders[k]!;
    return `${k} ${d}/${g}${d ? ` in ${s} s` : ''}`;
  });
  return `squads (${r.on ? 'Fireteams' : 'variant off: the same squads, measured'}, size ${r.size}, ${r.squads} squads): to the leader ${r.cohesion} m on average, within 10 m ${(r.within10 * 100).toFixed(0)}%, within 25 m ${(r.within25 * 100).toFixed(0)}% | members alive ${(r.survival * 100).toFixed(0)}%${ord.length ? ` | orders carried out: ${ord.join(', ')}` : ''}`;
}

/** Several matches' squad rows together (a summary row). */
export function squadTotals(rows: readonly SquadRow[]): { n: number; cohesion: number; within10: number; within25: number; survival: number; orders: Partial<Record<OrderKind, [number, number, number]>> } {
  const samples = rows.reduce((a, r) => a + r.samples, 0);
  const w = (f: (r: SquadRow) => number) => (samples ? rows.reduce((a, r) => a + f(r) * r.samples, 0) / samples : 0);
  const orders: Partial<Record<OrderKind, [number, number, number]>> = {};
  for (const r of rows)
    for (const k of ORDER_KINDS) {
      const o = r.orders[k];
      if (!o) continue;
      const t = (orders[k] ??= [0, 0, 0]);
      t[2] = (t[2] * t[1] + o[2] * o[1]) / Math.max(1, t[1] + o[1]);
      t[0] += o[0];
      t[1] += o[1];
    }
  return { n: rows.length, cohesion: w((r) => r.cohesion), within10: w((r) => r.within10), within25: w((r) => r.within25), survival: rows.length ? rows.reduce((a, r) => a + r.survival, 0) / rows.length : 0, orders };
}
