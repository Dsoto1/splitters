import { describe, expect, it } from 'vitest';
import { SNAPSHOT_INTERVAL_TICKS, TICK_RATE, type PlayerSnapshot } from '@tiletrigger/shared';
import { Interpolator } from '../src/game/interpolation.ts';

const SPEED = 5.2;
const snap = (tick: number): PlayerSnapshot => ({ s: 1, p: [(tick / TICK_RATE) * SPEED, 0, 0], yaw: 0, pitch: 0, alive: 1, g: 1, w: 1, pu: 0 }) as unknown as PlayerSnapshot;

/**
 * A remote player running at a steady 5.2 m/s, snapshots every 2 ticks reaching
 * us 0..`jitter` ms late (seeded), drawn at 60 fps. Returns each frame's speed.
 */
function frameSpeeds(jitter: number): number[] {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const interp = new Interpolator();
  const arrivals: [number, number][] = [];
  for (let tick = 0; tick < TICK_RATE * 6; tick += SNAPSHOT_INTERVAL_TICKS) arrivals.push([tick, (tick / TICK_RATE) * 1000 + 20 + rnd() * jitter]);
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

  it('is exact when snapshots arrive on time', () => {
    for (const v of frameSpeeds(0)) expect(v).toBeCloseTo(SPEED, 6);
  });
});
