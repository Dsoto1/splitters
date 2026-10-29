import { describe, expect, it } from 'vitest';
import { LookFilter, browserLookScale, zoomLookScale, type LookMove } from '../src/game/lookFilter.ts';

/** A steady swipe: `perFrame` px per 16.7 ms frame, delivered as `subs` sub-moves per event. */
function swipe(frames: number, perFrame: number, subs: number, start = 1000, summed = true): LookMove[] {
  const out: LookMove[] = [];
  for (let f = 0; f < frames; f++) {
    const parts = Array.from({ length: subs }, () => ({ dx: perFrame / subs, dy: 0 }));
    // WebKit-like: the dispatched event carries only the last sub-move, not the sum.
    const dx = summed ? perFrame : perFrame / subs;
    out.push({ dx, dy: 0, t: start + f * 16.7, coalesced: subs > 1 ? parts : undefined });
  }
  return out;
}

/** Feed events, taking once per frame (as InputState.frame does). */
function run(f: LookFilter, moves: LookMove[]): number {
  let total = 0;
  for (const m of moves) {
    f.push(m);
    total += f.take().dx;
  }
  return total;
}

describe('LookFilter', () => {
  it('passes ordinary movement through unchanged', () => {
    const f = new LookFilter();
    f.reset(0);
    expect(run(f, swipe(60, 12, 1))).toBeCloseTo(720);
  });

  it('recovers the movement Safari loses when it coalesces moves without summing them', () => {
    const f = new LookFilter();
    f.reset(0);
    // 8 sub-moves per frame (a 500 Hz mouse at 60 fps); the event says 1/8 of it.
    expect(run(f, swipe(60, 40, 8, 1000, false))).toBeCloseTo(2400);
    expect(f.stats.resummed).toBe(60);
  });

  it('does not double-count where the browser already sums (Chrome)', () => {
    const f = new LookFilter();
    f.reset(0);
    expect(run(f, swipe(60, 40, 8, 1000, true))).toBeCloseTo(2400);
    expect(f.stats.resummed).toBe(0);
  });

  it('keeps the event delta when the coalesced list is zeroed (Firefox under lock)', () => {
    const f = new LookFilter();
    f.reset(0);
    const moves = swipe(30, 20, 4).map((m) => ({ ...m, coalesced: m.coalesced?.map(() => ({ dx: 0, dy: 0 })) }));
    expect(run(f, moves)).toBeCloseTo(600);
  });

  it('drops the jump right after the lock', () => {
    const f = new LookFilter();
    f.reset(1000);
    // Safari: the first event after locking carries the cursor's trip to the lock point.
    run(f, [{ dx: -640, dy: 380, t: 1004 }]);
    expect(f.take()).toEqual({ dx: 0, dy: 0 });
    expect(f.stats.settle).toBe(1);
    // Small moves in the settle window still count; later, anything normal does.
    expect(run(f, [{ dx: 3, dy: 0, t: 1020 }, { dx: 90, dy: 0, t: 1200 }])).toBe(93);
  });

  it('drops a lone spike between ordinary moves', () => {
    const f = new LookFilter();
    f.reset(0);
    const moves = swipe(20, 6, 1, 1000);
    moves.splice(10, 0, { dx: -1800, dy: 900, t: moves[9]!.t + 3 });
    expect(run(f, moves)).toBeCloseTo(120);
    expect(f.stats.spikes).toBe(1);
  });

  it('lets a real fast flick through as it builds up', () => {
    const f = new LookFilter();
    f.reset(0);
    // Accelerating to ~600 px a frame and back: every step is under 8x the one before.
    const steps = [20, 60, 150, 320, 600, 600, 450, 200, 60, 10];
    const moves = steps.map((dx, i) => ({ dx, dy: 0, t: 1000 + i * 16.7 }));
    expect(run(f, moves)).toBe(steps.reduce((a, b) => a + b));
    expect(f.stats.spikes).toBe(0);
  });

  it('drops duplicated deliveries of the same move', () => {
    const f = new LookFilter();
    f.reset(0);
    const m = { dx: 5, dy: -2, t: 1500 };
    expect(run(f, [m, { ...m }, { dx: 5, dy: -2, t: 1516 }])).toBe(10);
    expect(f.stats.duplicates).toBe(1);
  });

  it('accumulates many events per frame into one step (rate independent)', () => {
    const f = new LookFilter();
    f.reset(0);
    // 1000 Hz uncoalesced events, taken once per ~60 Hz frame: the total is all that matters.
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < 1000; i++) {
      f.push({ dx: 1, dy: 0.5, t: 1000 + i });
      if (i % 17 === 16) ({ dx, dy } = ((g) => ({ dx: dx + g.dx, dy: dy + g.dy }))(f.take()));
    }
    const rest = f.take();
    expect(dx + rest.dx).toBeCloseTo(1000);
    expect(dy + rest.dy).toBeCloseTo(500);
    expect(f.take()).toEqual({ dx: 0, dy: 0 });
  });

  it('forgets movement nobody took for a while', () => {
    const f = new LookFilter();
    f.reset(0);
    f.push({ dx: 50, dy: 0, t: 1000 });
    f.push({ dx: 4, dy: 0, t: 2000 });
    expect(f.take().dx).toBe(4);
  });

  it('keeps sub-pixel and touchpad-sized moves (no rounding, no dead zone)', () => {
    const f = new LookFilter();
    f.reset(0);
    const moves = Array.from({ length: 50 }, (_, i) => ({ dx: i % 2 ? 0.5 : 1, dy: i % 3 ? 0 : -1, t: 1000 + i * 8 }));
    const total = moves.reduce((a, m) => a + m.dx, 0);
    expect(run(f, moves)).toBeCloseTo(total);
  });

  it('applies the per-browser scale', () => {
    const f = new LookFilter(2);
    f.reset(0);
    expect(run(f, [{ dx: 10, dy: 0, t: 500 }])).toBe(20);
  });

  it('ignores NaN deltas', () => {
    const f = new LookFilter();
    f.reset(0);
    expect(run(f, [{ dx: Number.NaN, dy: 1, t: 500 }, { dx: 2, dy: 0, t: 520 }])).toBe(2);
  });
});

describe('browserLookScale', () => {
  const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15';
  const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  it('normalises old Safari only', () => {
    expect(browserLookScale(safari, false)).toBe(2);
    expect(browserLookScale(safari, true)).toBe(1);
    expect(browserLookScale(chrome, false)).toBe(1);
    expect(browserLookScale(chrome, true)).toBe(1);
  });
});

describe('zoomLookScale', () => {
  const base = 1.35;
  const ads = base * 0.72;
  it('is 1 in hip fire', () => {
    expect(zoomLookScale(base, base, ads)).toBe(1);
  });
  it('matches on-screen movement at the crosshair (tan ratio)', () => {
    const fov = 0.3;
    expect(zoomLookScale(fov, base, ads)).toBeCloseTo(Math.tan(fov / 2) / Math.tan(base / 2), 6);
  });
  it('applies the zoom multiplier fully from aiming down the sights', () => {
    expect(zoomLookScale(ads, base, ads, 1.5)).toBeCloseTo(1.5 * zoomLookScale(ads, base, ads), 6);
    expect(zoomLookScale(0.3, base, ads, 0.5)).toBeCloseTo(0.5 * zoomLookScale(0.3, base, ads), 6);
  });
  it('eases the multiplier in while the sights come up (no jump)', () => {
    const near = zoomLookScale(base - 1e-4, base, ads, 2);
    expect(near).toBeGreaterThan(0.99);
    expect(near).toBeLessThan(1.01);
  });
  it('is monotonic in FOV at multiplier 1', () => {
    let prev = 0;
    for (let fov = 0.1; fov <= base; fov += 0.05) {
      const s = zoomLookScale(fov, base, ads);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});
