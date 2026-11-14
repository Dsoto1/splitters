import { describe, expect, it } from 'vitest';
import { CORE_ITEMS } from '@tiletrigger/shared';
import { readFileSync } from 'node:fs';
import { LOOT_GLOW, LOOT_OUTLINE, LOOT_RING, lootGlowKey, lootGlowLevel, lootOutlineAlpha, lootOutlineRadii } from '../src/game/lootGlow.ts';
import { PICKUP_GUN_MAX_LENGTH, PICKUP_GUN_SCALE, pickupGunScale, pickupRoom } from '../src/game/pickupVisuals.ts';
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

  it("puts the thin dark outline round each glow's own ring, and makes it as dark with Reduce flashing on as off", () => {
    expect(LOOT_OUTLINE.width).toBeLessThanOrEqual(0.06);
    const effects = JSON.parse(readFileSync(new URL('../public/vfx/loot_fx.json', import.meta.url), 'utf8')).effects as Record<string, { nodes: { name: string; mesh?: { inner_radius?: number; outer_radius?: number } }[] }>;
    for (const [key, [inner, outer]] of Object.entries(LOOT_RING)) {
      const ring = effects[lastingFx(key)!.effect]!.nodes.find((n) => n.name === 'Ring_01')!.mesh!;
      expect([ring.inner_radius, ring.outer_radius], key).toEqual([inner, outer]);
      // The outline's lines hug the ring's edges as drawn (times the effect's scale), and are thin.
      expect(lootOutlineRadii(key, lastingFx(key)!.scale)).toEqual([inner * lastingFx(key)!.scale, outer * lastingFx(key)!.scale]);
    }
    expect(lootOutlineRadii('loot.none', 1)).toBeNull();
    // Full with the glow full, either setting; nothing without a glow; steady (it follows the eased level only).
    expect(lootOutlineAlpha(LOOT_GLOW.level, false)).toBeCloseTo(LOOT_OUTLINE.alpha);
    expect(lootOutlineAlpha(LOOT_GLOW.calmLevel, true)).toBeCloseTo(LOOT_OUTLINE.alpha);
    expect(lootOutlineAlpha(0, true)).toBe(0);
    expect(lootOutlineAlpha(LOOT_GLOW.calmLevel / 2, true)).toBeCloseTo(LOOT_OUTLINE.alpha / 2);
  });
});

describe('pickup guns drawn bigger (pickupVisuals.ts)', () => {
  it('draws a gun 1.4x, a long one no longer than the glow ring is wide, and never smaller than in the hand', () => {
    expect(PICKUP_GUN_SCALE).toBeGreaterThanOrEqual(1.3);
    expect(PICKUP_GUN_SCALE).toBeLessThanOrEqual(1.5);
    expect(pickupGunScale(0.88)).toBe(PICKUP_GUN_SCALE);
    expect(0.3 * pickupGunScale(0.3)).toBeCloseTo(0.42);
    // The sniper rifle (1.2 m) to the ring's width; the spear (2 m) as it is.
    expect(1.2 * pickupGunScale(1.2)).toBeCloseTo(PICKUP_GUN_MAX_LENGTH);
    expect(pickupGunScale(2)).toBe(1);
    // The weapon ring: 0.55 m outer radius times the glow's scale.
    expect(PICKUP_GUN_MAX_LENGTH).toBeLessThanOrEqual(2 * LOOT_RING['loot.weapon']![1] * lastingFx('loot.weapon')!.scale);
    expect(pickupGunScale(0)).toBe(PICKUP_GUN_SCALE);
  });

  it('keeps a turning gun clear of a wall it was clear of', () => {
    const wall = { min: [0.5, 0, -3] as [number, number, number], max: [0.9, 3, 3] as [number, number, number], kind: 'wall' as const, sourceId: 'w' };
    const room = pickupRoom([0, 0, 0], [wall]);
    expect(room).toBeCloseTo(0.5);
    // A rifle (0.88 m, 0.44 to its tip) fitted to the room; it never reaches the wall.
    expect((0.88 * pickupGunScale(0.88, room)) / 2).toBeLessThan(room);
    expect(pickupGunScale(0.88, room)).toBeGreaterThan(1);
    // Already touching it at its own size: left as it is.
    expect(pickupGunScale(1.1, room)).toBe(1);
    // A box above or below the height a gun turns at doesn't count; a turned box does.
    expect(pickupRoom([0, 0, 0], [{ ...wall, min: [0.5, 1.2, -3], max: [0.9, 3, 3] }])).toBe(Infinity);
    expect(pickupRoom([0, 0, 0], [{ ...wall, min: [-0.2, 0, 0.6], max: [0.2, 1, 1.4], yaw: Math.PI / 2 }])).toBeCloseTo(0.8);
  });
});
