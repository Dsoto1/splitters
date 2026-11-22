import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, getWeapon, weaponCode } from '@tiletrigger/shared';
import { CategoryPicks, WHEEL_CATEGORIES, byCategory, categoryKeyPick, wheelCategoryOf } from '../src/game/wheelCategories.ts';
import { arcAngles, categoryAim } from '../src/game/weaponWheel.ts';

const code = (id: string) => weaponCode(getWeapon(id));
const cat = (id: string) => wheelCategoryOf(getWeapon(id));

describe('wheel categories from weapon data', () => {
  it('puts the benchmark weapons and the odd ones where a player looks for them', () => {
    expect(cat('core.pistol')).toBe('pistol');
    expect(cat('core.revolver')).toBe('pistol');
    expect(cat('core.flare_gun')).toBe('pistol');
    expect(cat('core.smg')).toBe('smg');
    expect(cat('core.machine_pistol')).toBe('smg');
    expect(cat('core.rifle')).toBe('rifle');
    expect(cat('core.battle_rifle')).toBe('rifle');
    expect(cat('core.shotgun')).toBe('shotgun');
    expect(cat('core.sniper')).toBe('sniper');
    expect(cat('core.crossbow')).toBe('sniper');
    expect(cat('core.rockets')).toBe('heavy');
    expect(cat('core.lmg')).toBe('heavy');
    expect(cat('core.flamethrower')).toBe('heavy');
    expect(cat('core.laser_rifle')).toBe('energy');
    expect(cat('core.plasma')).toBe('energy');
    expect(cat('core.railgun')).toBe('energy');
    expect(cat('core.knife')).toBe('melee');
    expect(cat('core.space_shield')).toBe('melee');
    expect(cat('core.medkit')).toBe('melee');
    expect(cat('core.grapple')).toBe('melee');
  });

  it('every weapon a player can carry has a slice, and every slice has weapons', () => {
    const carried = Object.values(CORE_WEAPONS).filter((w) => w.slot > 0);
    const seen = new Set(carried.map(wheelCategoryOf));
    for (const c of WHEEL_CATEGORIES) expect(seen.has(c), c).toBe(true);
  });
});

describe('category keys (the number keys)', () => {
  const owned = ['core.knife', 'core.pistol', 'core.hand_cannon', 'core.revolver', 'core.rifle', 'core.burst_rifle', 'core.battle_rifle', 'core.desert_carbine', 'core.shotgun', 'core.lmg'].map(code);

  it('a key brings out its category; again cycles through every weapon held in it, round to the first', () => {
    const picks = new CategoryPicks();
    let held = code('core.shotgun');
    const press = (n: number) => {
      const next = categoryKeyPick(n, owned, held, picks);
      if (next) {
        held = next;
        picks.note(next);
      }
      return held;
    };
    const rifles = byCategory(owned).get('rifle')!;
    expect(rifles.length).toBe(4);
    const got = [press(3), press(3), press(3), press(3), press(3)];
    expect(got).toEqual([...rifles, rifles[0]]);
    // Key 1: the pistols, every one of them (the old slot keys only ever reached the first, the Pistol).
    const pistols = [press(1), press(1), press(1)];
    expect(new Set(pistols).size).toBe(3);
  });

  it('away from a category, its key brings back the one used last there (not the first)', () => {
    const picks = new CategoryPicks();
    picks.note(code('core.battle_rifle'));
    expect(categoryKeyPick(3, owned, code('core.shotgun'), picks)).toBe(code('core.battle_rifle'));
    // A category you hold nothing in: no switch.
    expect(categoryKeyPick(7, owned, code('core.shotgun'), picks)).toBeNull();
    // The only one held in it, already in hand: no switch either.
    expect(categoryKeyPick(4, owned, code('core.shotgun'), picks)).toBeNull();
  });
});

describe('pointing the category wheel', () => {
  const slices = WHEEL_CATEGORIES.map((_, k) => ({ count: k === 2 ? 5 : k === 6 ? 0 : 2, pick: k === 2 ? 3 : 0 }));
  const at = (a: number, len: number) => [Math.sin(a) * len, -Math.cos(a) * len] as const;
  const slice = (k: number) => (k * Math.PI * 2) / 8;

  it('the middle picks nothing; a slice picks its last pick; an empty slice picks nothing', () => {
    expect(categoryAim(0.05, 0, slices, -1)).toBeNull();
    expect(categoryAim(...at(slice(2), 0.5), slices, -1)).toEqual({ slice: 2, item: 3 });
    expect(categoryAim(...at(slice(6), 0.5), slices, -1)).toBeNull();
  });

  it('a flick straight out to the rim keeps the slice\'s last pick; round the arc picks the others', () => {
    expect(categoryAim(...at(slice(2), 1), slices, -1)).toEqual({ slice: 2, item: 3 });
    const angles = arcAngles(2, 5, 3);
    expect(angles[3]).toBeCloseTo(slice(2));
    expect(categoryAim(...at(angles[0]!, 1), slices, 2)).toEqual({ slice: 2, item: 0 });
    expect(categoryAim(...at(angles[4]!, 1), slices, 2)).toEqual({ slice: 2, item: 4 });
  });
});

describe('the switch request (the number-key bug)', async () => {
  const { WeaponRequest } = await import('../src/game/weaponRequest.ts');
  const pistol = code('core.pistol');
  const cannon = code('core.hand_cannon');
  const revolver = code('core.revolver');

  it('a quick second press is not dropped by a snapshot from before the host read it', () => {
    // Pistol in hand. Key 1 → Hand Cannon (inputs 1-2 carry it), key 1 again at once → back to the Pistol (input 3 on).
    const r = new WeaponRequest();
    r.ask(cannon);
    r.sent(1);
    r.sent(2);
    r.ask(pistol);
    r.sent(3);
    // The host's snapshot from before input 1: the Pistol still in hand. The old rule ("that weapon in hand: done")
    // dropped the request here, and inputs 1-2 then switched to the Hand Cannon and stayed: the press was lost.
    r.snapshot(pistol, 0);
    expect(r.want).toBe(pistol);
    // Inputs 1-2 switch to the Hand Cannon: still asking.
    r.snapshot(cannon, 2);
    expect(r.want).toBe(pistol);
    // Input 3 read and the Pistol in hand: done.
    r.snapshot(pistol, 3);
    expect(r.want).toBe(0);
  });

  it('a request for a weapon you no longer hold is dropped, so keys step on from the one in hand', () => {
    const r = new WeaponRequest();
    r.ask(revolver);
    // (Lost with a life the page never saw end.) The old code kept it, and every key then counted from a weapon not
    // in its slot: always the slot's first (the Pistol, the AK).
    expect(r.current(cannon, (c) => c !== revolver)).toBe(cannon);
    expect(r.want).toBe(0);
    const owned = [pistol, cannon, revolver, code('core.rifle')];
    const picks = new CategoryPicks();
    expect(categoryKeyPick(1, owned, r.current(cannon, () => true), picks)).toBe(revolver);
  });
});
