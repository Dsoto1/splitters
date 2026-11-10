import { horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from '../sim/constants.ts';

/**
 * What a bot remembers of its enemies (BOT_AI_PLAN.md Phase D item 1; docs/BOTS.md, "Memory and callouts"): where each
 * was last seen, where shots at it came from, what it heard and what teammates called out, each for a while (its skill
 * tier's `memorySeconds`: easy bots forget sooner). A handful of entries a bot, refreshed in place: no allocation per
 * look once full.
 *
 * What it is for: where a bot holding a spot looks (the freshest threat first), the angles it checks on its way
 * (a remembered spot close by), and how fast it reacts to someone showing where it expected them (BotBrain.reactAfter).
 * It sends nobody anywhere: chasing and noises stay the scored choices' (choices.ts), so objectives play as before.
 */
export type MemorySource = 'seen' | 'shot' | 'callout' | 'heard';

export interface EnemySpot {
  /** The enemy (actor slot); -1: not known who (a shot from somewhere, a noise). */
  slot: number;
  pos: Vec3;
  tick: number;
  source: MemorySource;
}

/** Entries kept at most (oldest go first). */
export const MEMORY_SIZE = 8;
/** Spots this close (m) of the same enemy, or of nobody known, are one spot. */
const SAME = 4;
/** How much each source counts when picking where to look (a shot at it most: someone is there and knows it is here). */
const WEIGHT: Record<MemorySource, number> = { shot: 1.6, seen: 1.2, callout: 0.9, heard: 0.6 };

export class EnemyMemory {
  readonly spots: EnemySpot[] = [];

  clear(): void {
    this.spots.length = 0;
  }

  /** Something about an enemy here and now: refreshes that enemy's spot (or one close by of nobody known), else a new one. */
  note(slot: number, pos: Vec3, tick: number, source: MemorySource): void {
    const s = this.spots;
    let at = -1;
    for (let i = 0; i < s.length; i++) {
      const e = s[i]!;
      if (slot >= 0 ? e.slot === slot : e.slot < 0 && horizontalDistance(e.pos, pos) < SAME) {
        at = i;
        break;
      }
    }
    if (at >= 0) {
      const e = s[at]!;
      // (A sighting isn't replaced by an older or weaker word of the same enemy.)
      if (e.tick > tick || (e.tick === tick && WEIGHT[e.source] > WEIGHT[source])) return;
      e.pos.x = pos.x;
      e.pos.y = pos.y;
      e.pos.z = pos.z;
      e.tick = tick;
      e.source = source;
      return;
    }
    if (s.length >= MEMORY_SIZE) {
      let old = 0;
      for (let i = 1; i < s.length; i++) if (s[i]!.tick < s[old]!.tick) old = i;
      s.splice(old, 1);
    }
    s.push({ slot, pos: { x: pos.x, y: pos.y, z: pos.z }, tick, source });
  }

  /** That enemy is dead (or gone): nothing to remember of it. */
  forget(slot: number): void {
    for (let i = this.spots.length - 1; i >= 0; i--) if (this.spots[i]!.slot === slot) this.spots.splice(i, 1);
  }

  /** Entries older than `keepTicks` go. */
  expire(tick: number, keepTicks: number): void {
    for (let i = this.spots.length - 1; i >= 0; i--) if (tick - this.spots[i]!.tick > keepTicks) this.spots.splice(i, 1);
  }

  /**
   * The spot most worth a look from `from`: by its source, fresher and nearer first (within `range` m and `keepTicks`).
   * Null for none.
   */
  best(from: Vec3, tick: number, keepTicks: number, range = 60): EnemySpot | null {
    let best: EnemySpot | null = null;
    let top = 0;
    for (const e of this.spots) {
      const age = tick - e.tick;
      if (age > keepTicks) continue;
      const d = horizontalDistance(e.pos, from);
      if (d > range || d < 2) continue;
      const v = WEIGHT[e.source] * (1 - age / (keepTicks + 1)) * (1 - (d / range) * 0.5);
      if (v > top) {
        top = v;
        best = e;
      }
    }
    return best;
  }

  /** Is `pos` (an enemy just seen) where it expected someone: within `near` m of a fresh spot? */
  expected(pos: Vec3, tick: number, keepTicks: number, near = 7): boolean {
    for (const e of this.spots) if (tick - e.tick <= keepTicks && horizontalDistance(e.pos, pos) < near && Math.abs(e.pos.y - pos.y) < 4) return true;
    return false;
  }
}

/** A callout: an enemy a teammate saw, where and when, and who saw it. */
export interface Callout {
  slot: number;
  pos: Vec3;
  tick: number;
  by: number;
}

/** Callouts kept per side (a ring), and how often one bot calls out the same enemy at most. */
const BOARD_SIZE = 64;
const RECALL_TICKS = TICK_RATE * 2;

/**
 * A side's callouts (Phase D item 1: "a teammate's sighting reaches the squad"): a bot that spots an enemy says where;
 * teammates within their skill's `calloutRange` of the spot take it into their memory when they next look about. One
 * board per side, a ring of the last BOARD_SIZE; reading it is a scan of the entries newer than the reader's last look.
 */
export class CalloutBoard {
  private readonly ring: Callout[] = [];
  private next = 0;
  /** Callouts posted so far (measuring). */
  posted = 0;
  /** When each caller last called out each enemy (caller * 4096 + enemy), so one sighting isn't repeated every look. */
  private readonly lastCall = new Map<number, number>();

  /** A bot saw an enemy here (posted at most every RECALL_TICKS per caller and enemy). */
  post(by: number, slot: number, pos: Vec3, tick: number): void {
    const k = by * 4096 + slot;
    const last = this.lastCall.get(k);
    if (last !== undefined && tick - last < RECALL_TICKS) return;
    this.lastCall.set(k, tick);
    if (this.lastCall.size > 2048) this.lastCall.clear();
    const c = this.ring[this.next];
    if (c) {
      c.slot = slot;
      c.pos.x = pos.x;
      c.pos.y = pos.y;
      c.pos.z = pos.z;
      c.tick = tick;
      c.by = by;
    } else this.ring[this.next] = { slot, pos: { x: pos.x, y: pos.y, z: pos.z }, tick, by };
    this.next = (this.next + 1) % BOARD_SIZE;
    this.posted++;
  }

  /** Callouts after tick `since` (not the reader's own), within `range` m of `from`, each handed to `take`. */
  read(since: number, from: Vec3, range: number, reader: number, take: (c: Callout) => void): void {
    for (const c of this.ring) if (c.tick > since && c.by !== reader && horizontalDistance(c.pos, from) <= range) take(c);
  }

  /** The newest callouts (debug view). */
  recent(tick: number, ticks: number): Callout[] {
    return this.ring.filter((c) => tick - c.tick <= ticks);
  }
}
