import { describe, expect, it } from 'vitest';
import { SNAPSHOT_INTERVAL_TICKS, TICK_RATE, type PlayerSnapshot } from '@tiletrigger/shared';
import { Interpolator } from '../src/game/interpolation.ts';

const SPEED = 5.2;
const snap = (tick: number): PlayerSnapshot => ({ s: 1, p: [(tick / TICK_RATE) * SPEED, 0, 0], yaw: 0, pitch: 0, alive: 1, g: 1, w: 1, pu: 0 }) as unknown as PlayerSnapshot;

/**
 * A remote player running at a steady 5.2 m/s, snapshots every 2 ticks reaching
 * us 0..`jitter` ms late (seeded), drawn at 60 fps. Returns each frame's speed.
 */
function frameSpeeds(jitter: number, delay: (tick: number) => number = () => 0): number[] {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const interp = new Interpolator();
  const arrivals: [number, number][] = [];
  for (let tick = 0; tick < TICK_RATE * 6; tick += SNAPSHOT_INTERVAL_TICKS) arrivals.push([tick, (tick / TICK_RATE) * 1000 + 20 + rnd() * jitter + delay(tick)]);
  const speeds: number[] = [];
  let last: number | null = null;
  let next = 0;
  for (let now = 500; now < 5500; now += 1000 / 60) {
    while (next < arrivals.length && arrivals[next]![1] <= now) {
      const [tick, at] = arrivals[next++]!;
      interp.push(tick, [snap(tick)], [], undefined, at);
    }
    const x = interp.sample(now)[0]!.x;
    if (last !== null) speeds.push((x - last) * 60);
    last = x;
  }
  return speeds;
}

describe('snapshot interpolation', () => {
  it('moves a steadily running player steadily, though snapshots arrive unevenly', () => {
    const speeds = frameSpeeds(12);
    const worst = Math.max(...speeds.map((v) => Math.abs(v / SPEED - 1)));
    // Setting the clock from each arrival (the old way) gave frame speeds from 0 to 15.6 m/s here.
    expect(worst).toBeLessThan(0.12);
    expect(Math.min(...speeds)).toBeGreaterThan(0);
  });

  it('stays even when a busy sim worker delivers snapshots in bursts', () => {
    // The worker catching up runs two snapshot intervals at once: pairs arrive together.
    const speeds = frameSpeeds(3, (tick) => (tick % (SNAPSHOT_INTERVAL_TICKS * 2) === 0 ? 1000 / 30 : 0));
    const worst = Math.max(...speeds.map((v) => Math.abs(v / SPEED - 1)));
    expect(worst).toBeLessThan(0.12);
  });

  it('carries on through a late snapshot instead of stopping', () => {
    // Every second, one snapshot (and those behind it) comes 120 ms late.
    const speeds = frameSpeeds(0, (tick) => (tick % TICK_RATE < 8 ? 120 - ((tick % TICK_RATE) / TICK_RATE) * 1000 : 0));
    expect(Math.min(...speeds)).toBeGreaterThan(SPEED * 0.5);
  });

  it('never runs a player backwards when the server clock slips for good', () => {
    // From 2 s on every snapshot comes 250 ms later (the host dropped a backlog).
    const speeds = frameSpeeds(2, (tick) => (tick >= TICK_RATE * 2 ? 250 : 0));
    expect(Math.min(...speeds)).toBeGreaterThan(-1e-6);
    // ...and it is running normally again half a second later.
    const after = speeds.slice(Math.round(60 * 2.5));
    for (const v of after.slice(0, 60)) expect(Math.abs(v / SPEED - 1)).toBeLessThan(0.12);
  });

  it('keeps far players (sent every fourth snapshot in big matches) moving between their snapshots', () => {
    const interp = new Interpolator();
    const near = (tick: number): PlayerSnapshot => ({ ...snap(tick), s: 2, p: [0, 0, 0] });
    const speeds: number[] = [];
    let last: number | null = null;
    let tick = 0;
    for (let now = 0; now < 3000; now += 1000 / 60) {
      // Snapshots on time, every 2 ticks; player 1 only in every fourth, held back in the rest.
      while ((tick / TICK_RATE) * 1000 <= now) {
        const far = (tick / SNAPSHOT_INTERVAL_TICKS) % 4 === 0;
        interp.push(tick, far ? [near(tick), snap(tick)] : [near(tick)], [], far ? [] : [1], (tick / TICK_RATE) * 1000);
        tick += SNAPSHOT_INTERVAL_TICKS;
      }
      const x = interp.sample(now).find((p) => p.slot === 1)?.x;
      if (x === undefined || now < 500) continue;
      if (last !== null) speeds.push((x - last) * 60);
      last = x;
    }
    // Before: stopped for a frame or two in every gap, then jumped on (0 and ~2x speed).
    expect(Math.min(...speeds)).toBeGreaterThan(SPEED * 0.9);
    expect(Math.max(...speeds)).toBeLessThan(SPEED * 1.1);
  });

  it('is exact when snapshots arrive on time', () => {
    for (const v of frameSpeeds(0)) expect(v).toBeCloseTo(SPEED, 6);
  });
});
