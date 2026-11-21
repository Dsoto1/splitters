import { describe, expect, it } from 'vitest';

/** Frames at a steady interval: `busy` ms of our own work each, for `seconds`; returns whether the note fired. */
function run(toll: { frame: (s: number, e: number, cap: number, hidden: boolean) => boolean }, clock: { t: number }, dt: number, busy: number, seconds: number): boolean {
  let fired = false;
  const end = clock.t + seconds * 1000;
  while (clock.t < end) {
    if (toll.frame(clock.t, clock.t + busy, 0, false)) fired = true;
    clock.t += dt;
  }
  return fired;
}

describe('the worn-down tab note (fix 3d)', () => {
  it('fires once after 30 s of a toll in a tab that earlier ran clean, never for a healthy frame', async () => {
    const { TabToll } = await import('../src/game/tabToll.ts');
    const toll = new TabToll();
    const clock = { t: 1000 };
    // A fresh tab: 60 fps with 12 ms of our work, and 60 fps with 4 ms (the idle wait for the screen is no toll).
    expect(run(toll, clock, 1000 / 60, 12, 15)).toBe(false);
    expect(run(toll, clock, 1000 / 60, 4, 15)).toBe(false);
    expect(toll.lastSecondMs).toBeLessThan(1);
    // Worn: 33 ms frames for 13.5 ms of ours (the owner's 30 fps Test). Not yet at 25 s; at 30 s, once.
    expect(run(toll, clock, 1000 / 30, 13.5, 25)).toBe(false);
    expect(toll.lastSecondMs).toBeGreaterThan(15);
    expect(run(toll, clock, 1000 / 30, 13.5, 10)).toBe(true);
    expect(run(toll, clock, 1000 / 30, 13.5, 40)).toBe(false);
  });

  it('a frame that is slow because our own work is (two refreshes for 20 ms) is not the toll', async () => {
    const { TabToll } = await import('../src/game/tabToll.ts');
    const toll = new TabToll();
    const clock = { t: 1000 };
    run(toll, clock, 1000 / 60, 5, 5);
    run(toll, clock, 1000 / 30, 20, 10);
    expect(toll.lastSecondMs).toBe(0);
    expect(toll.streak).toBe(0);
  });
});
