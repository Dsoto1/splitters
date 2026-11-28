import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon } from '@tiletrigger/shared';
import { armoryModel, armoryRole, armorySections, armoryStats, armoryTags, inArmory, loadArmoryFavs, toggleArmoryFav } from '../src/frontend/armoryData.ts';
import { WHEEL_CATEGORIES, wheelCategoryOf } from '../src/game/wheelCategories.ts';

/** The Armory's data (frontend/armoryData.ts; docs/ARSENAL.md, "Armory"). */
describe('armory data', () => {
  const sections = armorySections();
  const listed = sections.flatMap((s) => s.weapons.map((w) => w.id));

  it('lists every weapon a player can hold once, in the wheel categories, hidden and mounted ones left out', () => {
    expect(new Set(listed).size).toBe(listed.length);
    const order = sections.map((s) => WHEEL_CATEGORIES.indexOf(s.id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const s of sections) for (const w of s.weapons) expect(wheelCategoryOf(w)).toBe(s.id);
    for (const def of Object.values(CORE_WEAPONS)) {
      if (def.hidden || def.slot === 0) expect(listed).not.toContain(def.id);
    }
    expect(listed).toContain('core.rifle');
    expect(listed).toContain('core.knife');
    expect(listed).toContain('core.medkit');
    expect(listed).not.toContain('core.space_shield');
    expect(listed).not.toContain('core.mount_mg');
    expect(listed).not.toContain('core.arena_disc');
    expect(inArmory(getWeapon('core.smg'))).toBe(true);
  });

  it('gives every listed weapon a role, tags and stat bars in range', () => {
    for (const id of listed) {
      const def = getWeapon(id);
      expect(armoryRole(def).length, id).toBeGreaterThan(3);
      expect(armoryTags(def).length, id).toBeGreaterThan(0);
      const stats = armoryStats(def);
      expect(stats.length, id).toBeGreaterThan(0);
      for (const s of stats) {
        expect(s.share, `${id} ${s.key}`).toBeGreaterThanOrEqual(0);
        expect(s.share, `${id} ${s.key}`).toBeLessThanOrEqual(1);
        expect(s.text, `${id} ${s.key}`).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('reads the bars the way a player would: an SMG fires faster than a sniper, which reaches further', () => {
    const get = (id: string, key: string) => armoryStats(getWeapon(id)).find((s) => s.key === key)!.share;
    expect(get('core.smg', 'rate')).toBeGreaterThan(get('core.sniper', 'rate'));
    expect(get('core.sniper', 'range')).toBeGreaterThan(get('core.smg', 'range'));
    expect(armoryStats(getWeapon('core.knife')).some((s) => s.key === 'magazine')).toBe(false);
  });

  it('shows the held (sharpest) copy where a gun has one', () => {
    expect(armoryModel(getWeapon('core.smg'))).toBe(getWeapon('core.smg').view.held!.high);
    expect(armoryModel(getWeapon('core.knife'))).toBe(getWeapon('core.knife').view.model);
  });

  it('keeps favourites in storage', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(loadArmoryFavs(store)).toEqual([]);
    expect(toggleArmoryFav('core.smg', store)).toBe(true);
    expect(loadArmoryFavs(store)).toEqual(['core.smg']);
    expect(toggleArmoryFav('core.smg', store)).toBe(false);
    expect(loadArmoryFavs(store)).toEqual([]);
  });
});
