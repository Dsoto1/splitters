import { describe, expect, it, vi } from 'vitest';

// The owner hid the SMG (the Weapon Manager's Hide: `"hidden": true` in content/weapons/smg.json).
vi.mock('../src/content/weapons.generated.ts', async (load) => {
  const m = await load<typeof import('../src/content/weapons.generated.ts')>();
  return { ...m, CORE_WEAPONS: { ...m.CORE_WEAPONS, 'core.smg': { ...m.CORE_WEAPONS['core.smg']!, hidden: true } } };
});

const {
  WEAPON_SET_DEFS,
  categoryItems,
  classWeapons,
  getItem,
  isWeaponHidden,
  paletteItems,
  pickupPool,
  pickupWeapons,
  setCategoryPool,
  setHas,
  setMainGuns,
  setPickupPool,
  setWeaponIds,
  signatureWeapon,
} = await import('../src/index.ts');

/** A hidden weapon (docs/FEATURES.md, "Weapon Manager"): out of random pickups, sets, loadouts and the palette; placed, it still spawns. */
describe('a weapon the owner hid', () => {
  const smgItem = 'core.weapon_smg';
  const holds = (pool: readonly { effect: { kind: string; weapon?: string } }[] | null) => !!pool?.some((i) => i.effect.kind === 'weapon' && i.effect.weapon === 'core.smg');

  it('is hidden, and only it', () => {
    expect(isWeaponHidden('core.smg')).toBe(true);
    expect(isWeaponHidden('core.rifle')).toBe(false);
    expect(isWeaponHidden('core.nope')).toBe(false);
  });

  it('leaves random pickups and the host\'s mix-up; a pickup placed as it still lies there', () => {
    expect(holds(categoryItems('smg'))).toBe(false);
    expect(categoryItems('smg').length).toBeGreaterThan(0);
    expect(holds(pickupPool({ item: 'core.weapon_lmg', random: 'smg' }, false))).toBe(false);
    // Placed, no mix-up: stays as placed (the map still spawns it).
    expect(pickupPool({ item: smgItem }, false)).toBeNull();
    expect(getItem(smgItem)?.effect).toMatchObject({ kind: 'weapon', weapon: 'core.smg' });
    // The host's mix-up swaps it for another of its kind, unless kept fixed.
    expect(holds(pickupPool({ item: smgItem }, true))).toBe(false);
    expect(pickupPool({ item: smgItem, keepFixed: true }, true)).toBeNull();
  });

  it('leaves weapon sets: their lists, Mixed bag\'s "all", the random guns and their pickups', () => {
    const military = WEAPON_SET_DEFS.military;
    expect(military.weapons).toContain('core.smg');
    expect(setWeaponIds(military)!.has('core.smg')).toBe(false);
    expect(setHas(military, 'core.smg')).toBe(false);
    expect(holds(setCategoryPool(military, 'smg'))).toBe(false);
    expect(pickupWeapons().some((w) => w.id === 'core.smg')).toBe(false);
    expect(setWeaponIds(WEAPON_SET_DEFS.mixed)!.has('core.smg')).toBe(false);
    expect(setMainGuns(WEAPON_SET_DEFS.mixed).some((w) => w.id === 'core.smg')).toBe(false);
    expect(holds(setPickupPool(military, { item: smgItem, keepFixed: true }, false))).toBe(false);
    // Standard leaves weapons as placed: a placed SMG still lies there.
    expect(setPickupPool(WEAPON_SET_DEFS.standard, { item: smgItem }, false)).toBeNull();
  });

  it('leaves class loadouts (never all of one) and Roulette\'s signatures', () => {
    expect(classWeapons(['core.knife', 'core.smg', 'core.pistol'])).toEqual(['core.knife', 'core.pistol']);
    expect(classWeapons(['core.smg'])).toEqual(['core.smg']);
    // Dapper's signature is the SMG: the rifle instead.
    expect(signatureWeapon('core.dapper', false, WEAPON_SET_DEFS.standard)).toBe('core.rifle');
  });

  it('leaves MapMaker\'s palette', () => {
    const ids = paletteItems().map((i) => i.id);
    expect(ids).not.toContain(smgItem);
    expect(ids).toContain('core.weapon_rifle');
  });
});
