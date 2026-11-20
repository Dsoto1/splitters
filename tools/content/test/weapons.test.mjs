import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, build, load, lockText, render, renderFamilies } from '../weapons.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));

describe('weapons generator (tools/content/weapons.mjs)', () => {
  const content = load();

  it('finds no problems and the generated file is up to date', () => {
    const { problems, out } = build(content);
    expect(problems).toEqual([]);
    expect(render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/weapons.generated.ts'), 'utf8'));
    expect(renderFamilies(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/weaponFamilies.generated.ts'), 'utf8'));
    expect(lockText(out.lock)).toBe(readFileSync(join(ROOT, 'content/codes.lock.json'), 'utf8'));
  });

  it('rejects a duplicate code, a changed code and a reused one', () => {
    const c = clone(content);
    const pistol = c.weapons.find((w) => w.data.id === 'core.pistol');
    pistol.data.code = 1;
    expect(build(c).problems.join('\n')).toMatch(/code 1 is also/);
    expect(build(c).problems.join('\n')).toMatch(/core\.pistol has code 2 .* never changes/);
    // A new weapon may not take a retired one's code (the lock remembers it).
    const d = clone(content);
    d.lock.weapons['core.retired_gun'] = 999;
    d.weapons.push({ file: 'content/weapons/new_gun.json', data: { ...clone(pistol.data), id: 'core.new_gun', code: 999, view: { ...pistol.data.view, sound: 'fire.pistol' } } });
    expect(build(d).problems.join('\n')).toMatch(/code 999 was core\.retired_gun's .* never reused/);
  });

  it('checks the schema and the references', () => {
    const c = clone(content);
    const w = c.weapons.find((x) => x.data.id === 'core.rifle').data;
    w.slot = 12;
    w.ammo = 'arrows';
    w.damag = 3;
    w.view.model = 'guns/missing.glb';
    w.view.sound = 'fire.missing';
    const p = build(c).problems.join('\n');
    expect(p).toMatch(/slot 12 is not 0-9/);
    expect(p).toMatch(/ammo: one of light/);
    expect(p).toMatch(/unknown field "damag"/);
    expect(p).toMatch(/model guns\/missing\.glb not found/);
    expect(p).toMatch(/sound fire\.missing is not/);
  });

  it('checks that classes name real weapons, throwables and abilities', () => {
    if (!content.classes) return;
    const c = clone(content);
    c.classes.classes[0].weapons.push('core.nothing');
    c.classes.classes[0].throwable = { kind: 'snowball', count: 1 };
    c.classes.classes[0].ability = 'teleport';
    const p = build(c).problems.join('\n');
    expect(p).toMatch(/weapon core\.nothing doesn't exist/);
    expect(p).toMatch(/throwable snowball doesn't exist/);
    expect(p).toMatch(/ability: one of/);
  });

  // Dual wielding, step 1 (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield"): data only.
  describe('akimbo', () => {
    const weapon = (c, id) => c.weapons.find((x) => x.data.id === id).data;
    const problemsOf = (edit) => {
      const c = clone(content);
      edit(c);
      return build(c).problems.join('\n');
    };

    it('exactly four weapons are eligible today', () => {
      expect(content.weapons.filter((w) => w.data.akimbo !== undefined).map((w) => w.data.id).sort()).toEqual(['core.machine_pistol', 'core.pistol', 'core.pulse_pistol', 'core.sawed_off']);
    });

    it('making another weapon eligible is one line of data', () => {
      expect(problemsOf((c) => (weapon(c, 'core.smg').akimbo = true))).toBe('');
      expect(problemsOf((c) => (weapon(c, 'core.gilded_pistol').akimbo = { as: 'pistol' }))).toBe('');
      expect(problemsOf((c) => (weapon(c, 'core.smg').akimbo = { cone: 2, move: -0.05 }))).toBe('');
    });

    it('is refused with an alt-fire, a zoom scope or fire modes, and on melee', () => {
      expect(problemsOf((c) => (weapon(c, 'core.rifle').akimbo = true))).toMatch(/rifle\.json: akimbo is refused on a weapon with an alt-fire/);
      expect(problemsOf((c) => (weapon(c, 'core.sniper').akimbo = true))).toMatch(/sniper\.json: akimbo is refused on a weapon with a zoom scope/);
      const br = problemsOf((c) => (weapon(c, 'core.battle_rifle').akimbo = true));
      expect(br).toMatch(/akimbo is refused on a weapon with fire modes/);
      expect(br).toMatch(/akimbo is refused on a weapon with a zoom scope/);
      expect(problemsOf((c) => (weapon(c, 'core.knife').akimbo = { as: 'pistol' }))).toMatch(/akimbo is refused on a weapon with kind "melee"/);
    });

    it('needs a family that has the trade', () => {
      expect(problemsOf((c) => (weapon(c, 'core.gilded_pistol').akimbo = true))).toMatch(/akimbo on a weapon without a family needs/);
      expect(problemsOf((c) => (weapon(c, 'core.revolver').akimbo = true))).toMatch(/family revolver has no akimbo block/);
      expect(problemsOf((c) => (weapon(c, 'core.pulse_pistol').akimbo = { as: 'bazooka' }))).toMatch(/akimbo\.as: one of pistol/);
    });

    it('checks the shape and the ranges', () => {
      expect(problemsOf((c) => (weapon(c, 'core.pistol').akimbo = false))).toMatch(/akimbo: true or an object/);
      expect(problemsOf((c) => (weapon(c, 'core.pistol').akimbo = { cones: 2 }))).toMatch(/unknown field "cones"/);
      expect(problemsOf((c) => (weapon(c, 'core.pistol').akimbo = { cone: 0.8 }))).toMatch(/akimbo\.cone multiplies what one gun has, 1-3/);
      expect(problemsOf((c) => (c.families.families.smg.akimbo.move = 0.05))).toMatch(/families\.smg: akimbo\.move is taken off handling\.move/);
      expect(problemsOf((c) => (c.families.families.smg.akimbo.spread = 2))).toMatch(/unknown field "spread"/);
      expect(problemsOf((c) => delete c.families.akimbo)).toMatch(/families\.json: akimbo: an object/);
      expect(problemsOf((c) => delete c.families.akimbo.raise)).toMatch(/"raise" is missing/);
      // Running speed with a pair stays within handling's own floor.
      expect(problemsOf((c) => Object.assign(weapon(c, 'core.pistol'), { handling: { move: 0.9 }, akimbo: { move: -0.1 } }))).toMatch(/a pair would run at 0\.80/);
    });
  });
});
