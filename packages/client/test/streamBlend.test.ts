import { describe, expect, it } from 'vitest';
import { STREAM_BLEND_MS, streamPoint, streamStart, streamWeight } from '../src/game/streamBlend.ts';
import { Interpolator } from '../src/game/interpolation.ts';

describe('projectile streams leave the muzzle (found with the beam fix, 2026-11-16)', () => {
  it('eases the muzzle offset out over a piece\'s first moments', () => {
    expect(streamWeight(0)).toBe(1);
    expect(streamWeight(STREAM_BLEND_MS / 2)).toBeCloseTo(0.5, 5);
    expect(streamWeight(STREAM_BLEND_MS)).toBe(0);
    for (let t = 0; t < STREAM_BLEND_MS; t += 10) expect(streamWeight(t + 10)).toBeLessThanOrEqual(streamWeight(t));
  });

  it('draws a new piece on the live muzzle while you strafe, then on the host\'s path', () => {
    // The host fired it from the eye of 100 ms ago; you have strafed 0.6 m since and the gun hangs below and right.
    let muzzle = { x: 0.8, y: 1.4, z: 0.3 };
    const s = streamStart({ x: 0, y: 1.6, z: 0.5 }, () => muzzle, 1000);
    expect(streamPoint(s, { x: 0, y: 1.6, z: 0.5 }, 1000)).toEqual(muzzle);
    // It flies on (the host's path), and you keep moving: still leaving the muzzle as it is now, at first.
    muzzle = { x: 0.9, y: 1.4, z: 0.3 };
    const early = streamPoint(s, { x: 0, y: 1.6, z: 1.0 }, 1010);
    expect(early.x).toBeGreaterThan(0.85);
    expect(early.z).toBeGreaterThan(0.75);
    // Past the blend: where the host has it (where it hits).
    expect(streamPoint(s, { x: 0, y: 1.5, z: 4 }, 1000 + STREAM_BLEND_MS)).toEqual({ x: 0, y: 1.5, z: 4 });
  });

  it('stays on the host\'s path when there is no gun to follow', () => {
    const s = streamStart({ x: 1, y: 1, z: 1 }, null, 0);
    expect(streamPoint(s, { x: 1, y: 1, z: 2 }, 10)).toEqual({ x: 1, y: 1, z: 2 });
  });

  it('keeps a stream piece\'s shooter from the snapshot, and none for other projectiles', () => {
    const i = new Interpolator();
    i.push(10, [], [[1, 0, 1, 0, 9, 3], [2, 5, 1, 5, 1]], undefined, 0);
    i.push(11, [], [[1, 0, 1, 1, 9, 3], [2, 5, 1, 6, 1]], undefined, 50);
    const out = i.sampleProjectiles(200);
    expect(out.get(1)![4]).toBe(3);
    expect(out.get(2)![4]).toBe(-1);
  });
});
