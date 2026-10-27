import { SNAPSHOT_INTERVAL_TICKS, TICK_RATE, type ScenarioSnapshot, type ServerMessage } from '@tiletrigger/shared';

type Snapshot = Extract<ServerMessage, { t: 'snapshot' }>;

/** Events that only show or sound something (tracers, impacts, blasts): skipped where nobody would see them in time. */
export const VISUAL_EVENTS: ReadonlySet<string> = new Set(['shot', 'impact', 'melee', 'arc', 'explode', 'crash', 'throw']);

/** Two scenario deltas as one: entity states by index (the later wins), objectives and timers the latest sent. */
function mergeScenario(a: ScenarioSnapshot | undefined, b: ScenarioSnapshot | undefined): ScenarioSnapshot | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: ScenarioSnapshot = {};
  if (a.es || b.es) {
    const es = new Map<number, [number, number, number]>();
    for (const e of a.es ?? []) es.set(e[0], e);
    for (const e of b.es ?? []) es.set(e[0], e);
    out.es = [...es.values()];
  }
  const ob = b.ob ?? a.ob;
  if (ob) out.ob = ob;
  const tm = b.tm ?? a.tm;
  if (tm) out.tm = tm;
  return out;
}

/**
 * One snapshot standing for `older` then `newer`, as if the page had handled
 * both: every event of both in order, the scenario changes of both, Fort Wars
 * pieces from the older one when the newer didn't resend them; everything else
 * (positions, health, private state, the ack) is a full state and comes from
 * the newer one.
 */
export function mergeSnapshots(older: Snapshot, newer: Snapshot): Snapshot {
  const out: Snapshot = { ...newer, ev: [...older.ev, ...newer.ev] };
  const sc = mergeScenario(older.sc, newer.sc);
  if (sc) out.sc = sc;
  if (newer.md && !newer.md.fp && older.md?.fp) out.md = { ...newer.md, fp: older.md.fp };
  // Interest management: players the newer one held back are still drawn from the older one.
  if (newer.hold?.length) {
    const have = new Set(newer.players.map((p) => p.s));
    const kept = older.players.filter((p) => newer.hold!.includes(p.s) && !have.has(p.s));
    if (kept.length) {
      out.players = [...newer.players, ...kept];
      const back = new Set(kept.map((p) => p.s));
      out.hold = newer.hold.filter((s) => !back.has(s));
    }
  }
  return out;
}

/** How a page has kept up with its match's snapshots (perf runs read it as `window.__sim.backlog`). */
export interface SnapshotBacklog {
  /** Snapshots that arrived while others were still waiting, and were merged into one. */
  merged: number;
  /** The most merged into one delivery. */
  most: number;
  /** Deliveries that stood for more than LATE_SNAPSHOTS snapshots (the page was over a second behind). */
  late: number;
}

/** Snapshots the match sends a second. */
const PER_SECOND = TICK_RATE / SNAPSHOT_INTERVAL_TICKS;

/** A delivery merging more than this many snapshots (a second's worth) means the page fell well behind. */
export const LATE_SNAPSHOTS = PER_SECOND;

/**
 * Snapshots from a match running elsewhere (the sim worker) arrive as
 * messages whether or not the page keeps up. A page busy for a while (a
 * multi-second frame while models and shaders load, a slow machine with 96
 * players in view) finds hundreds queued, and handling each in full (scenario
 * colliders, vehicles, prediction replay: several milliseconds apiece) can
 * take longer than the match takes to send more: the page falls further
 * behind for good. Here the first snapshot of a burst is delivered at once;
 * any that arrive before the page's next free moment (`later`, a task queued
 * behind the ones already waiting) are merged and delivered as one, so a
 * backlog costs one snapshot's work, not hundreds. Past a second's worth,
 * the purely visual events of what is waiting are dropped (as in a hidden
 * tab), so catching up doesn't fire every shot of the last minute at once.
 * Other messages first flush what is waiting, so the order between them is kept.
 */
export class SnapshotCoalescer {
  readonly backlog: SnapshotBacklog = { merged: 0, most: 0, late: 0 };
  private held: Snapshot | null = null;
  private count = 0;
  private armed = false;
  private warned = false;

  constructor(
    private readonly deliver: (m: ServerMessage) => void,
    private readonly later: (fn: () => void) => void = (fn) => setTimeout(fn, 0),
  ) {}

  push(m: ServerMessage): void {
    if (m.t !== 'snapshot') {
      this.flush();
      this.deliver(m);
      return;
    }
    if (!this.armed) {
      // Nothing waiting: straight through, and a marker behind whatever is queued now.
      this.armed = true;
      this.later(() => {
        this.armed = false;
        this.flush();
      });
      this.deliver(m);
      return;
    }
    // Over a second behind: the shots and blasts of what is waiting are history; they would only all go off at once.
    const held = this.held && this.count >= LATE_SNAPSHOTS ? { ...this.held, ev: this.held.ev.filter((e) => !VISUAL_EVENTS.has(e.e)) } : this.held;
    this.held = held ? mergeSnapshots(held, m) : m;
    this.count++;
  }

  /** Deliver what is waiting (merged), if anything. */
  flush(): void {
    const m = this.held;
    if (!m) return;
    const n = this.count;
    this.held = null;
    this.count = 0;
    if (n > 1) {
      this.backlog.merged += n;
      this.backlog.most = Math.max(this.backlog.most, n);
    }
    if (n > LATE_SNAPSHOTS) {
      this.backlog.late++;
      if (!this.warned) {
        this.warned = true;
        console.warn(`The page fell ${(n / PER_SECOND).toFixed(1)} s behind its match; ${n} snapshots were merged to catch up.`);
      }
    }
    this.deliver(m);
  }

  /** Drop anything waiting (the match is over). */
  clear(): void {
    this.held = null;
    this.count = 0;
  }
}
