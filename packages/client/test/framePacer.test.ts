import { describe, expect, it } from 'vitest';
import { FramePacer } from '../src/game/framePacer.ts';

/** Refreshes of a `hz` display for `seconds`, each reaching the page 0..`jitter` ms late (seeded, repeatable). */
function refreshes(hz: number, seconds: number, jitter: number): number[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: Math.round(hz * seconds) }, (_, i) => (i * 1000) / hz + rnd() * jitter);
}

function drawn(hz: number, cap: number, jitter: number): number[] {
  const pacer = new FramePacer();
  return refreshes(hz, 10, jitter).filter((t) => pacer.tick(t, cap));
}

const gaps = (ts: number[]) => ts.slice(1).map((t, i) => t - ts[i]!);

describe('frame cap pacing', () => {
  it('draws every refresh of a 60 Hz screen under a 60 fps cap, whatever the callback jitter', () => {
    const ts = drawn(60, 60, 3);
    expect(ts.length).toBe(600);
    // The old rule (skip when less than 1000 / cap - 1.5 ms since the last frame) dropped 64 of these 600 frames.
    let last = -1e9;
    const old = refreshes(60, 10, 3).filter((t) => (t - last < 1000 / 60 - 1.5 ? false : ((last = t), true)));
    expect(old.length).toBeLessThan(560);
  });

  it('draws every other refresh of a 120 Hz screen, evenly', () => {
    const g = gaps(drawn(120, 60, 2));
    expect(g.length).toBeGreaterThan(590);
    expect(Math.max(...g)).toBeLessThan(16.67 + 2.5);
    expect(Math.min(...g)).toBeGreaterThan(16.67 - 2.5);
  });

  it('holds about the cap on a 144 Hz screen and halves a 60 Hz screen at 30', () => {
    expect(drawn(144, 60, 2).length).toBeGreaterThan(570);
    expect(drawn(144, 60, 2).length).toBeLessThan(620);
    const g = gaps(drawn(60, 30, 2));
    expect(Math.min(...g)).toBeGreaterThan(30);
    expect(g.length).toBe(299);
  });

  it('does not race to catch up after a stall', () => {
    const pacer = new FramePacer();
    const ts = [0, 16.7, 33.3, 250, 258.3, 266.7, 275, 283.3].filter((t) => pacer.tick(t, 60));
    expect(ts).toEqual([0, 16.7, 33.3, 250, 266.7, 283.3]);
  });

  it('draws everything with no cap', () => {
    expect(drawn(144, 0, 2).length).toBe(1440);
  });
});
