import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '@tiletrigger/shared';
import { initNavigation } from '@tiletrigger/shared/match';
import { LossyLink, pct, runNetLab } from '../src/tools/netLab.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A seeded stand-in for Math.random. */
const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

describe('net lab link (net-report, G3)', () => {
  it('delays each message by half the round trip plus jitter, in order', () => {
    const link = new LossyLink<number>({ rttMs: 100, jitterMs: 20, loss: 0 }, seeded(3), 16, () => undefined);
    let last = 0;
    for (let i = 0; i < 200; i++) {
      const at = link.arrival(200, i * 16);
      expect(at - i * 16).toBeGreaterThanOrEqual(50);
      expect(at).toBeGreaterThanOrEqual(last);
      last = at;
    }
    expect(link.lost).toBe(0);
  });

  it('resends a lost packet a round trip and three packet gaps later, holding everything behind it', () => {
    let r = 0;
    // The first packet is lost once; nothing else is.
    const rolls = [0.5, 0.01, 0.9];
    const link = new LossyLink<number>({ rttMs: 100, jitterMs: 0, loss: 0.05 }, () => rolls[r++] ?? 0.9, 16, () => undefined);
    const first = link.arrival(200, 0);
    expect(first).toBe(50 + 100 + 48);
    expect(link.lost).toBe(1);
    // Sent 16 ms later, not lost, but in order: it waits for the first.
    expect(link.arrival(200, 16)).toBe(first);
  });

  it('loses each of a big message\'s packets on its own', () => {
    const link = new LossyLink<number>({ rttMs: 0, jitterMs: 0, loss: 0.1 }, seeded(7), 33, () => undefined);
    for (let i = 0; i < 1000; i++) link.arrival(4600, i * 33);
    // Four packets a message: about 400 losses (and a few resends lost again).
    expect(link.lost).toBeGreaterThan(330);
    expect(link.lost).toBeLessThan(500);
    expect(pct([5, 1, 3, 2, 4], 0.5)).toBe(3);
  });
});

describe('net lab smoke (a real host, players over a 100 ms, 2 % loss link)', () => {
  it('fires and judges rounds, and the host confirms what the screens hit', async () => {
    const r = await runNetLab({ condition: { rttMs: 100, jitterMs: 20, loss: 0.02 }, clients: 4, seconds: 6, warmupSeconds: 2 });
    expect(r.rtt.p50).toBeGreaterThan(90);
    expect(r.shots).toBeGreaterThan(20);
    expect(r.screenHits).toBeGreaterThan(10);
    // Hits lost to the network itself (not a target already dead on the host): few. A smoke check, on about 30 hits
    // in real time: one hit is 3 points, and eight runs here gave 0.87 to 1.0 (CI once 0.848 against the old 0.85).
    // The measured figure is net-report's (`pnpm net-report`); this catches confirmation breaking, not drifting.
    expect(r.confirmed / (r.screenHits - r.missDead)).toBeGreaterThan(0.75);
    expect(r.unfired).toBeLessThanOrEqual(2);
    expect(r.downKBps).toBeGreaterThan(0);
  }, 40_000);
});
