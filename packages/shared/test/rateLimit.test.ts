import { describe, expect, it } from 'vitest';
import { KeyedCounter, KeyedLimiter, MESSAGE_RATE, MessageGuard, TokenBucket } from '../src/net/rateLimit.ts';

describe('rate limits', () => {
  it('a token bucket allows its burst, then its rate', () => {
    let now = 0;
    const b = new TokenBucket(10, 5, () => now);
    for (let i = 0; i < 5; i++) expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
    now += 100; // one token back
    expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
    now += 10_000; // never more than the burst
    for (let i = 0; i < 5; i++) expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
  });

  it('a game connection at the normal pace (60 inputs and a ping a second) is never limited', () => {
    let now = 0;
    const g = new MessageGuard(MESSAGE_RATE, () => now);
    for (let s = 0; s < 30; s++) {
      for (let i = 0; i < 61; i++) {
        expect(g.check()).toBe('ok');
        now += 1000 / 61;
      }
    }
  });

  it('a flood is dropped, and one that keeps up is disconnected', () => {
    let now = 0;
    const g = new MessageGuard(MESSAGE_RATE, () => now);
    const verdicts: string[] = [];
    // 1,000 messages a second.
    for (let i = 0; i < 2000 && verdicts.at(-1) !== 'kick'; i++) {
      verdicts.push(g.check());
      now += 1;
    }
    expect(verdicts.slice(0, MESSAGE_RATE.burst).every((v) => v === 'ok')).toBe(true);
    expect(verdicts).toContain('drop');
    expect(verdicts.at(-1)).toBe('kick');
    // Kicked for good.
    now += 60_000;
    expect(g.check()).toBe('kick');
  });

  it('per-caller limits keep callers apart and forget the oldest past their size', () => {
    let now = 0;
    const l = new KeyedLimiter({ perMinute: 60, burst: 3, maxKeys: 2 }, () => now);
    expect([l.allow('a'), l.allow('a'), l.allow('a'), l.allow('a')]).toEqual([true, true, true, false]);
    expect(l.allow('b')).toBe(true);
    now += 1000;
    expect(l.allow('a')).toBe(true);
    expect(l.allow('c')).toBe(true);
    expect(l.size).toBe(2);
  });

  it('counts open things per key up to a cap', () => {
    const c = new KeyedCounter(2);
    expect([c.acquire('ip'), c.acquire('ip'), c.acquire('ip')]).toEqual([true, true, false]);
    c.release('ip');
    expect(c.acquire('ip')).toBe(true);
    c.release('ip');
    c.release('ip');
    expect(c.count('ip')).toBe(0);
  });
});
