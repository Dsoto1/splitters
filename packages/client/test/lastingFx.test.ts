import { describe, expect, it } from 'vitest';
import type { GodotVfx, VfxHandle } from '../src/game/godotVfx.ts';
import { LastingFx } from '../src/game/lastingFx.ts';

/** A stand-in for GodotVfx: `cap` lasting effects at once, each a handle that records what was done to it. */
function fakeVfx(cap: number) {
  const live: { at: { x: number }; level: number; stopped: boolean }[] = [];
  const vfx = {
    get loopRoom() {
      return Math.max(0, cap - live.filter((l) => !l.stopped).length);
    },
    start(_pack: string, _effect: string, at: { x: number }) {
      if (live.filter((l) => !l.stopped).length >= cap) return null;
      const l = { at: { x: at.x }, level: 0, stopped: false };
      live.push(l);
      const h: VfxHandle = {
        move: (to) => void (l.at.x = to.x),
        setLevel: (v) => void (l.level = v),
        stop: () => void (l.stopped = true),
        get done() {
          return l.stopped;
        },
      };
      return h;
    },
  };
  return { vfx: vfx as unknown as GodotVfx, live };
}

describe('lasting effects (lastingFx.ts)', () => {
  it('draws the nearest wanted ones up to the cap, and hands a place on when a nearer one appears', () => {
    const { vfx, live } = fakeVfx(2);
    const fx = new LastingFx(vfx);
    const cam = { x: 0, y: 0, z: 0 };
    fx.want('a', 'fire.zone', { x: 30, y: 0, z: 0 });
    fx.want('b', 'fire.zone', { x: 10, y: 0, z: 0 });
    fx.want('c', 'fire.zone', { x: 20, y: 0, z: 0 });
    fx.update(cam);
    expect([fx.drawn('a'), fx.drawn('b'), fx.drawn('c')]).toEqual([false, true, true]);
    // A nearer one: the farthest drawn gives its place up.
    fx.want('d', 'fire.zone', { x: 5, y: 0, z: 0 });
    fx.want('b', 'fire.zone', { x: 10, y: 0, z: 0 });
    fx.want('c', 'fire.zone', { x: 20, y: 0, z: 0 });
    fx.update(cam);
    fx.update(cam);
    expect(fx.drawn('d') && fx.drawn('b') && !fx.drawn('c')).toBe(true);
    expect(live.filter((l) => !l.stopped).length).toBeLessThanOrEqual(2);
  });

  it('moves a drawn effect rather than remaking it, and stops what is no longer asked for', async () => {
    const { vfx, live } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    fx.want('a', 'fire.zone', { x: 1, y: 0, z: 0 }, { level: 0.5 });
    fx.update({ x: 0, y: 0, z: 0 });
    fx.want('a', 'fire.zone', { x: 2, y: 0, z: 0 });
    fx.update({ x: 0, y: 0, z: 0 });
    expect(live.length).toBe(1);
    expect(live[0]!.at.x).toBe(2);
    expect(live[0]!.level).toBe(1);
    await new Promise((r) => setTimeout(r, 350));
    fx.update({ x: 0, y: 0, z: 0 });
    expect(fx.drawn('a')).toBe(false);
    expect(live[0]!.stopped).toBe(true);
  });

  it('leaves out what is beyond its range and unknown keys', () => {
    const { vfx } = fakeVfx(4);
    const fx = new LastingFx(vfx);
    fx.want('far', 'fire.zone', { x: 500, y: 0, z: 0 });
    fx.want('odd', 'no.such.effect', { x: 1, y: 0, z: 0 });
    fx.update({ x: 0, y: 0, z: 0 });
    expect(fx.drawn('far') || fx.drawn('odd')).toBe(false);
  });
});
