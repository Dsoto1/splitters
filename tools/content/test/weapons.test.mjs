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
});
