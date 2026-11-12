import { describe, expect, it } from 'vitest';
import { CORE_ITEMS } from '@tiletrigger/shared';
import { LOOT_GLOW, lootGlowKey, lootGlowLevel } from '../src/game/lootGlow.ts';
import { lastingFx } from '../src/game/fxMap.ts';
import { SAFE_LIGHT } from '../src/game/reduceFlashing.ts';

describe("pickups' floor glows (lootGlow.ts)", () => {
  it('gives weapons, health, armor and ammo a glow that content/vfx.json maps, as decoration, and other kinds none', () => {
    expect(lootGlowKey('core.weapon_rifle')).toBe('loot.weapon');
    expect(lootGlowKey('core.health_small')).toBe('loot.health');
    expect(lootGlowKey('core.armor_large')).toBe('loot.armor');
    expect(lootGlowKey('core.ammo')).toBe('loot.ammo');
    expect(lootGlowKey('core.powerup_speed')).toBeNull();
    expect(lootGlowKey('core.jetpack')).toBeNull();
    expect(lootGlowKey('no.such.item')).toBeNull();
    const keys = new Set(CORE_ITEMS.map((i) => lootGlowKey(i.id)).filter((k): k is string => !!k));
    expect([...keys].sort()).toEqual(['loot.ammo', 'loot.armor', 'loot.health', 'loot.weapon']);
    for (const k of keys) {
      const ref = lastingFx(k);
      expect(ref?.pack, k).toBe('loot_fx');
      expect(ref?.decor, k).toBe(true);
    }
  });

  it('eases in while drawn and is nothing while not, never past its strength', () => {
    let level = 0;
    for (let i = 0; i < 30; i++) level = lootGlowLevel(level, true, 1 / 60, false);
    expect(level).toBeGreaterThan(0.3);
    expect(level).toBeLessThan(LOOT_GLOW.level);
    for (let i = 0; i < 120; i++) level = lootGlowLevel(level, true, 1 / 60, false);
    expect(level).toBeCloseTo(LOOT_GLOW.level, 5);
    expect(lootGlowLevel(level, false, 1 / 60, false)).toBe(0);
  });

  it('with Reduce flashing on is dimmer and comes up far slower than a map light may change', () => {
    expect(LOOT_GLOW.calmLevel).toBeLessThan(LOOT_GLOW.level);
    expect(LOOT_GLOW.calmRise).toBeLessThan(SAFE_LIGHT.rate / 4);
    let level = 0;
    for (let i = 0; i < 60; i++) level = lootGlowLevel(level, true, 1 / 60, true);
    // A second in: half way there.
    expect(level).toBeCloseTo(LOOT_GLOW.calmRise, 5);
    for (let i = 0; i < 240; i++) level = lootGlowLevel(level, true, 1 / 60, true);
    expect(level).toBeCloseTo(LOOT_GLOW.calmLevel, 5);
    // Switched on mid-glow: it comes down to the calm strength, it doesn't stay at the brighter one.
    let down: number = LOOT_GLOW.level;
    for (let i = 0; i < 60; i++) down = lootGlowLevel(down, true, 1 / 60, true);
    expect(down).toBeCloseTo(LOOT_GLOW.calmLevel, 5);
  });
});
