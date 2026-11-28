import { describe, expect, it } from 'vitest';
import { armorySections } from '../src/frontend/armoryData.ts';
import { pickerOrder, stepWeapon } from '../src/game/rangePicker.ts';

/** The ranges' weapon picker (game/rangePicker.ts): the Armory's weapons, favourites first, and the quick previous / next. */
describe('range picker', () => {
  it('lists the Armory by its categories, favourites first', () => {
    const plain = pickerOrder([]);
    expect(plain.map((s) => s.id)).toEqual(armorySections().map((s) => s.id));
    const favs = pickerOrder(['core.shotgun', 'core.nothing', 'core.pistol']);
    expect(favs[0]!.id).toBe('favs');
    expect(favs[0]!.weapons.map((d) => d.id)).toEqual(['core.shotgun', 'core.pistol']);
    expect(favs.length).toBe(plain.length + 1);
  });

  it('steps through every weapon in order, wrapping round', () => {
    const all = armorySections().flatMap((s) => s.weapons.map((d) => d.id));
    expect(stepWeapon(all[0]!, 1)).toBe(all[1]);
    expect(stepWeapon(all[0]!, -1)).toBe(all[all.length - 1]);
    expect(stepWeapon(all[all.length - 1]!, 1)).toBe(all[0]);
    expect(stepWeapon(null, 1)).toBe(all[0]);
    expect(stepWeapon('core.not_listed', -1)).toBe(all[all.length - 1]);
  });
});
