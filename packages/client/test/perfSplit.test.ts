import { describe, expect, it } from 'vitest';
import { COUNT, SYS, perfProbe, type FrameSample } from '../src/game/perfProbe.ts';
import { frameCounts, frameSplit } from '../src/game/perfOverlay.ts';
import { isSmallProp } from '../src/game/propVisuals.ts';
// @ts-expect-error a plain .mjs tool
import { histQuantile } from '../../../tools/perf/compare.mjs';

const frame = (sys: Partial<Record<keyof typeof SYS, number>>, o: Partial<FrameSample> = {}): FrameSample => {
  const y = new Array<number>(Object.keys(SYS).length).fill(0);
  for (const [k, v] of Object.entries(sys)) y[SYS[k as keyof typeof SYS]] = v!;
  return { dt: 20, sim: 0, ticks: 0, batch: 0, msg: 1, js: 8, render: 10, sys: y, n: [3, 4, 1, 2, 0, 1], ...o };
};

describe('the performance split', () => {
  it('takes the characters out of render and the systems out of the game JS', () => {
    const s = frameSplit(frame({ avatars: 2, anim: 1.5, skin: 0.5, fx: 1, ragdoll: 0.5, flames: 0.2, hud: 0.3, shadow: 3, post: 1, cull: 2 }));
    expect(s.characters).toBeCloseTo(4);
    expect(s.renderScene).toBeCloseTo(10 - 2 - 3 - 1);
    expect(s.game).toBeCloseTo(8 - (2 + 1 + 0.5 + 0.2 + 0.3));
    expect(s.net).toBe(1);
    expect(frameCounts(frame({})).skinned).toBe(4);
    expect(COUNT.built).toBe(5);
  });

  it('runs while anyone wants it, and spans add up', () => {
    perfProbe.use('a', true);
    perfProbe.use('b', true);
    perfProbe.use('a', false);
    expect(perfProbe.on).toBe(true);
    perfProbe.use('b', false);
    expect(perfProbe.on).toBe(false);
    perfProbe.sys.fill(0);
    perfProbe.add(SYS.fx, performance.now() - 5);
    expect(perfProbe.sys[SYS.fx]).toBeGreaterThanOrEqual(5);
    perfProbe.reset();
  });
});

describe('small clutter (shadows only near the camera)', () => {
  it('is short, or a low plant', () => {
    expect(isSmallProp([1.1, 0.7, 1.1], false, 1)).toBe(true); // tall grass
    expect(isSmallProp([1.1, 1.1, 0.9], false, 1)).toBe(true); // wheat
    expect(isSmallProp([0.76, 1.1, 0.76], true, 1)).toBe(false); // a barrel
    expect(isSmallProp([1.3, 1.2, 1.6], false, 1)).toBe(false); // a leafy bush
    expect(isSmallProp([0.6, 0.6, 0.6], true, 2)).toBe(false); // a small crate scaled up
  });
});

describe('compare.mjs', () => {
  it('reads a p95 off a histogram', () => {
    const edges = [1, 2, 4, 8];
    expect(histQuantile(edges, [0, 100, 0, 0, 0], 0.95)).toBeCloseTo(1.95);
    expect(histQuantile(edges, [90, 0, 0, 10, 0], 0.95)).toBeGreaterThan(4);
  });
});

describe("the recording's main-thread watch (performance round 4)", () => {
  it('reports nothing, and throws nothing, where the browser has no long-task or long-frame entries', async () => {
    const { watchMainThread } = await import('../src/game/perfRecorder.ts');
    const w = watchMainThread();
    expect(w.blocks(0, performance.now())).toEqual([]);
    w.stop();
  });
});
