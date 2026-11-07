// Reduce flashing (game/reduceFlashing.ts): the setting, its default, and what it does to blinking, lights, blasts,
// the hurt vignette and lightning.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { REDUCE_FLASHING_EVENT, SAFE_BLINK, SAFE_LIGHT, blastStrength, blinkLevel, ease, indicator, loadReduceFlashing, reduceFlashing, resetReduceFlashingCache, saveReduceFlashing } from '../src/game/reduceFlashing.ts';
import { CALM_HURT, HURT_LOOKS, HurtFade } from '../src/game/hurtVignette.ts';
import { STEADY_ARC, SteadyArcs } from '../src/game/steadyArcs.ts';

const store = new Map<string, string>();
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const events: string[] = [];
beforeEach(() => {
  store.clear();
  events.length = 0;
  resetReduceFlashingCache();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
  resetReduceFlashingCache();
});

/** Linear light of an 8-bit sRGB channel (WCAG). */
const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);

describe('the Reduce flashing setting', () => {
  it('is on by default, and on when storage is unavailable', () => {
    expect(loadReduceFlashing()).toBe(true);
    expect(reduceFlashing()).toBe(true);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    expect(loadReduceFlashing()).toBe(true);
  });

  it('is saved with the other settings, read back, and announced so the pause menu and a running match follow', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (e: Event) => (events.push(e.type), true) } });
    try {
      saved();
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
  const saved = () => {
    saveReduceFlashing(false);
    expect(store.get('tiletrigger.reduceFlashing')).toBe('0');
    expect(reduceFlashing()).toBe(false);
    expect(events).toEqual([REDUCE_FLASHING_EVENT]);
    resetReduceFlashingCache();
    expect(reduceFlashing()).toBe(false);
    saveReduceFlashing(true);
    expect(store.get('tiletrigger.reduceFlashing')).toBe('1');
    resetReduceFlashingCache();
    expect(reduceFlashing()).toBe(true);
  };
});

describe('blinking', () => {
  /** Peaks of a level over `seconds`, sampled at 60 frames a second. */
  const peaks = (hz: number, seconds: number, reduce: boolean) => {
    const v = Array.from({ length: seconds * 60 + 1 }, (_, i) => blinkLevel(i / 60, hz, reduce));
    let n = 0;
    for (let i = 1; i + 1 < v.length; i++) if (v[i]! > v[i - 1]! && v[i]! >= v[i + 1]!) n++;
    return { v, n };
  };

  it('off: blinks hard on and off at its rate, as it always did', () => {
    expect([0, 0.13, 0.26, 0.38].map((t) => blinkLevel(t, 4, false))).toEqual([1, 0, 1, 0]);
    expect(blinkLevel(0.3, 0, false)).toBe(1);
  });

  it('on: a smooth pulse at most once a second, never darker than its floor', () => {
    for (const hz of [0.4, 1, 2.5, 4, 10]) {
      const { v, n } = peaks(hz, 3, true);
      expect(Math.min(...v)).toBeGreaterThanOrEqual(SAFE_BLINK.floor - 1e-9);
      expect(Math.max(...v)).toBeLessThanOrEqual(1);
      // No more than one pulse a second (a 0.4 Hz blink keeps its slower pace).
      expect(n).toBeLessThanOrEqual(3);
      // Smooth: under a fifteenth of its range from one frame to the next.
      for (let i = 1; i < v.length; i++) expect(Math.abs(v[i]! - v[i - 1]!)).toBeLessThan((1 - SAFE_BLINK.floor) / 15);
    }
  });

  it('indicators (a mine, a sticky grenade, the bomb) stay shown and pulse with it on', () => {
    expect(indicator(0.2, 3, false)).toEqual({ on: false, level: 1 });
    const calm = indicator(0.2, 3, true);
    expect(calm.on).toBe(true);
    expect(calm.level).toBeGreaterThanOrEqual(SAFE_BLINK.floor);
  });
});

describe('lights and blasts', () => {
  it('eases toward a level at a limited rate: off to full in about 0.4 s', () => {
    let v = 0;
    const steps: number[] = [];
    for (let i = 0; i < 30; i++) steps.push((v = ease(v, 1, 1 / 60, SAFE_LIGHT.rate)));
    expect(steps[0]).toBeCloseTo(SAFE_LIGHT.rate / 60, 6);
    expect(steps.findIndex((x) => x >= 1)).toBeGreaterThan(20);
    expect(ease(1, SAFE_LIGHT.flash, 1 / 60, SAFE_LIGHT.rate)).toBeLessThan(1.05);
    expect(SAFE_LIGHT.flash).toBeLessThan(2.5);
  });

  it('dims a blast the nearer it is to the camera, never below a floor, full a few radii off', () => {
    expect(blastStrength(0, 4)).toBeCloseTo(0.3, 6);
    expect(blastStrength(2, 4)).toBeCloseTo(0.3, 6);
    expect(blastStrength(30, 4)).toBe(1);
    let last = 0;
    for (let d = 0; d <= 30; d += 0.5) {
      const s = blastStrength(d, 4);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});

describe('the hurt vignette', () => {
  it('calm is a dull red, not a saturated one (WCAG red flash: R / (R + G + B) under 0.8 in linear light)', () => {
    const share = ([r, g, b]: readonly [number, number, number]) => lin(r) / (lin(r) + lin(g) + lin(b));
    expect(share(HURT_LOOKS.classic.color)).toBeGreaterThanOrEqual(0.8);
    expect(share(HURT_LOOKS.calm.color)).toBeLessThan(0.8);
    expect(HURT_LOOKS.calm.inner).toBeGreaterThan(HURT_LOOKS.classic.inner);
  });

  it('classic snaps on with each hit and is gone in 0.7 s', () => {
    const f = new HurtFade();
    f.hit(20, 1000);
    expect(f.update(1000, false)).toBeCloseTo(0.95, 6);
    expect(f.update(1300, false)).toBeLessThan(0.6);
    expect(f.update(1700, false)).toBe(0);
  });

  it('calm comes up over a few frames, holds steady while hits keep coming, then goes', () => {
    const f = new HurtFade();
    let now = 1000;
    f.hit(20, now);
    // The first frame after a hit is far from its full strength.
    expect(f.update((now += 16), true)).toBeLessThan(0.2);
    const levels: number[] = [];
    // Hit ten times a second for two seconds (an SMG on you): after it has come up, it barely moves.
    for (let i = 0; i < 120; i++) {
      now += 1000 / 60;
      if (i % 6 === 0) f.hit(10, now);
      levels.push(f.update(now, true));
    }
    const settled = levels.slice(30);
    expect(Math.max(...settled) - Math.min(...settled)).toBeLessThan(0.01);
    expect(Math.max(...levels)).toBeLessThanOrEqual(CALM_HURT.peak + 1e-9);
    // After the last hit it holds, then fades out.
    for (let i = 0; i < 90; i++) f.update((now += 1000 / 60), true);
    expect(f.level).toBe(0);
  });
});

describe('steady lightning', () => {
  let engine: NullEngine;
  beforeEach(() => {
    engine = new NullEngine();
  });
  afterEach(() => engine.dispose());

  it('holds one beam per source through a stream of arcs, glides its ends, and lets it fade after the last', () => {
    const scene = new Scene(engine);
    const arcs = new SteadyArcs(scene);
    let now = 1000;
    const levels: number[] = [];
    // An Arc Caster's stream: an arc every 150 ms, to a target that moves a little each time.
    for (let i = 0; i < 40; i++) {
      now += 1000 / 60;
      if (i % 9 === 0) arcs.hit('s3', [{ x: 0, y: 1.5, z: 0 }, { x: 5 + i * 0.02, y: 1.2, z: 0 }, { x: 8, y: 1.2, z: 2 }], '#9fd8ff', now);
      arcs.update(now);
      const core = scene.meshes.find((m) => m.name === 'steadyArc_s3_0')!;
      levels.push((core.material as { alpha: number }).alpha);
    }
    expect(arcs.count).toBe(1);
    // Two segments of core and glow, and the glow where it lands: no new meshes per arc.
    expect(scene.meshes.filter((m) => m.name.startsWith('steadyArc')).length).toBe(5);
    // Up over a few frames, then steady.
    expect(levels[0]).toBeLessThan(levels[10]!);
    const held = levels.slice(10);
    expect(Math.max(...held) - Math.min(...held)).toBeLessThan(1e-9);
    // Gone a little after the last arc.
    for (let i = 0; i < 60; i++) arcs.update((now += 1000 / 60));
    expect(arcs.count).toBe(0);
    expect(scene.meshes.filter((m) => m.name.startsWith('steadyArc')).length).toBe(0);
    expect(STEADY_ARC.hold + STEADY_ARC.release).toBeLessThan(1);
  });
});
