/**
 * Rate limits shared by everything that takes untrusted traffic: the
 * dedicated server and a browser hosting friends (per connection), and the
 * hub (per address). Pure and clock-injectable so tests can drive them.
 */

/** A token bucket: `rate` tokens a second, holding at most `burst`. */
export class TokenBucket {
  private tokens: number;
  private at: number;

  constructor(
    readonly rate: number,
    readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = burst;
    this.at = now();
  }

  /** Spend `n` tokens if there are enough. */
  take(n = 1): boolean {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + ((t - this.at) / 1000) * this.rate);
    this.at = t;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

/**
 * Per-connection message budget for game traffic (guests of a browser host,
 * clients of the dedicated server). A client sends one input message a sim
 * tick (60/s) plus a ping a second, so 100/s with a burst of 200 leaves room
 * for a tab catching up after a hitch. Messages over the budget are dropped;
 * a client that keeps going over (DROPS_TO_KICK drops within WINDOW_MS) is
 * disconnected.
 */
export const MESSAGE_RATE = { perSecond: 100, burst: 200, dropsToKick: 250, windowMs: 5000 } as const;

export type MessageVerdict = 'ok' | 'drop' | 'kick';

export class MessageGuard {
  private readonly bucket: TokenBucket;
  private drops: number[] = [];
  private kicked = false;

  constructor(
    private readonly opts: { perSecond: number; burst: number; dropsToKick: number; windowMs: number } = MESSAGE_RATE,
    private readonly now: () => number = Date.now,
  ) {
    this.bucket = new TokenBucket(opts.perSecond, opts.burst, now);
  }

  /** Whether to handle a message that just arrived, drop it, or close the connection. */
  check(): MessageVerdict {
    if (this.kicked) return 'kick';
    if (this.bucket.take()) return 'ok';
    const t = this.now();
    this.drops.push(t);
    if (this.drops.length > this.opts.dropsToKick) this.drops = this.drops.filter((d) => d > t - this.opts.windowMs);
    if (this.drops.length >= this.opts.dropsToKick) {
      this.kicked = true;
      return 'kick';
    }
    return 'drop';
  }
}

/**
 * Token buckets keyed by caller (an IP address, a listing): `perMinute`
 * requests a minute with bursts up to `burst`. Keeps at most `maxKeys`
 * callers, forgetting the least recently seen (so a spray of addresses can't
 * grow it without bound).
 */
export class KeyedLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly rate: number;
  private readonly burst: number;
  private readonly maxKeys: number;

  constructor(
    opts: { perMinute: number; burst?: number; maxKeys?: number },
    private readonly now: () => number = Date.now,
  ) {
    this.rate = opts.perMinute / 60;
    this.burst = opts.burst ?? opts.perMinute;
    this.maxKeys = opts.maxKeys ?? 20_000;
  }

  allow(key: string, cost = 1): boolean {
    let b = this.buckets.get(key);
    if (b) this.buckets.delete(key);
    else {
      b = new TokenBucket(this.rate, this.burst, this.now);
      if (this.buckets.size >= this.maxKeys) this.buckets.delete(this.buckets.keys().next().value!);
    }
    // Re-inserted: Map order is least recently seen first.
    this.buckets.set(key, b);
    return b.take(cost);
  }

  get size(): number {
    return this.buckets.size;
  }
}

/** Counts of open things per key (sockets per IP), with a cap. */
export class KeyedCounter {
  private readonly counts = new Map<string, number>();

  constructor(readonly max: number) {}

  /** Count one more for `key` unless it is at the cap. */
  acquire(key: string): boolean {
    const n = this.counts.get(key) ?? 0;
    if (n >= this.max) return false;
    this.counts.set(key, n + 1);
    return true;
  }

  release(key: string): void {
    const n = (this.counts.get(key) ?? 0) - 1;
    if (n > 0) this.counts.set(key, n);
    else this.counts.delete(key);
  }

  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }
}
