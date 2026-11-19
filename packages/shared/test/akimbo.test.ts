/**
 * Dual wielding, step 1 (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield"): the weapon data and its resolver. Nothing in a
 * match reads it yet; the match rule is in matchSetup.test.ts and serverRules.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { AKIMBO_BASE, CORE_WEAPONS, FAMILY_DEFAULTS, akimboOf, gunplayOf, type WeaponDefinition } from '../src/index.ts';

const weapon = (id: string): WeaponDefinition => CORE_WEAPONS[id]!;

describe('akimboOf', () => {
  it('exactly four weapons can be paired today', () => {
    expect(Object.values(CORE_WEAPONS).filter((d) => akimboOf(d)).map((d) => d.id).sort()).toEqual(['core.machine_pistol', 'core.pistol', 'core.pulse_pistol', 'core.sawed_off']);
    for (const id of ['revolver', 'hand_cannon', 'smg', 'gilded_pistol', 'flare_gun', 'goo_gun', 'freeze_ray', 'nailgun', 'lmg', 'shotgun', 'auto_shotgun', 'rifle', 'knife']) {
      expect(akimboOf(weapon(`core.${id}`)), id).toBeNull();
    }
  });

  it('resolves the base block, then the family, then the weapon', () => {
    expect(akimboOf(weapon('core.pistol'))).toEqual({ cone: 1.5, pattern: 1, kick: 1.2, reload: 1.35, raise: 1.25, move: 0 });
    expect(akimboOf(weapon('core.machine_pistol'))).toEqual({ cone: 1.6, pattern: 1, kick: 1.25, reload: 1.35, raise: 1.25, move: 0 });
    expect(akimboOf(weapon('core.sawed_off'))).toEqual({ cone: 1, pattern: 1.15, kick: 1.4, reload: 1.5, raise: 1.25, move: 0 });
    // No family of its own: it takes the pistol's trade by name.
    expect(weapon('core.pulse_pistol').family).toBeUndefined();
    expect(akimboOf(weapon('core.pulse_pistol'))).toEqual(akimboOf(weapon('core.pistol')));
    // The SMG family has its trade ready; the full-stock SMG itself isn't eligible.
    expect({ ...AKIMBO_BASE, ...FAMILY_DEFAULTS.smg.akimbo }).toEqual({ cone: 1.7, pattern: 1, kick: 1.3, reload: 1.4, raise: 1.25, move: -0.03 });
    expect(AKIMBO_BASE).toEqual({ cone: 1, pattern: 1, kick: 1, reload: 1, raise: 1.25, move: 0 });
  });

  it('takes a weapon\'s own numbers and `as`, and caches', () => {
    const smg = { ...weapon('core.smg'), akimbo: true as const };
    expect(akimboOf(smg)).toEqual({ cone: 1.7, pattern: 1, kick: 1.3, reload: 1.4, raise: 1.25, move: -0.03 });
    expect(akimboOf(smg)).toBe(akimboOf(smg));
    const own = { ...weapon('core.smg'), akimbo: { as: 'machine_pistol' as const, kick: 2, raise: 1 } };
    expect(akimboOf(own)).toEqual({ cone: 1.6, pattern: 1, kick: 2, reload: 1.35, raise: 1, move: 0 });
    expect(akimboOf(own)).not.toHaveProperty('as');
  });

  it('leaves a weapon\'s gunplay as it was', () => {
    for (const id of ['core.pistol', 'core.machine_pistol', 'core.pulse_pistol', 'core.sawed_off']) {
      const { akimbo: _a, ...plain } = weapon(id);
      expect(gunplayOf(weapon(id)), id).toEqual(gunplayOf(plain));
    }
  });
});
