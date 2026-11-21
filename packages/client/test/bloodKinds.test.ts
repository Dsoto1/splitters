import { describe, expect, it } from 'vitest';
import { BLOOD_KINDS } from '@tiletrigger/shared';
import { bloodStyle, puffAlpha } from '../src/game/bloodVisuals.ts';
import { gameplayFx } from '../src/game/fxMap.ts';

describe('blood kinds', () => {
  it('every kind has a style; no kind is the map default', () => {
    for (const k of BLOOD_KINDS) expect(bloodStyle(k).color, k).toMatch(/^#[0-9a-f]{6}$/);
    expect(bloodStyle(null).color).toBeNull();
    expect(bloodStyle(null).splats).toBe(true);
  });

  it('liquids splat and make the wet sound; bone dust and a wisp leave no decals', () => {
    for (const k of ['red', 'green', 'blue', 'oil'] as const) expect([bloodStyle(k).splats, bloodStyle(k).wet], k).toEqual([true, true]);
    for (const k of ['bone', 'stone', 'spirit'] as const) expect([bloodStyle(k).splats, bloodStyle(k).wet], k).toEqual([false, false]);
    expect(bloodStyle('spirit').drops).toBe(0);
    // Stone dust is bone's dust, greyer.
    expect(bloodStyle('stone').puff).toBe(bloodStyle('bone').puff);
    expect(bloodStyle('stone').color).not.toBe(bloodStyle('bone').color);
  });

  it("oil's sparks and a spirit's wisp are mapped pack effects", () => {
    expect(bloodStyle('oil').fx).toBe('blood.oil');
    expect(bloodStyle('spirit').fx).toBe('blood.spirit');
    expect(gameplayFx('blood.oil')?.pack).toBe('electric_fx');
    expect(gameplayFx('blood.spirit')?.tint).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a wisp eases in (no pop) and every puff fades out', () => {
    expect(puffAlpha('wisp', 0)).toBe(0);
    expect(puffAlpha('wisp', 0.1)).toBeGreaterThan(0);
    expect(puffAlpha('wisp', 0.1)).toBeLessThan(0.6);
    expect(puffAlpha('mist', 0)).toBe(1);
    for (const k of ['mist', 'dust', 'wisp'] as const) expect(puffAlpha(k, 5), k).toBe(0);
  });
});
