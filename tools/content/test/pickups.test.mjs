import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as pickups from '../pickups.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ROOT = pickups.ROOT;

describe('pickups generator (tools/content/pickups.mjs)', () => {
  const content = pickups.load();
  const find = (c, id) => c.pickups.pickups.find((p) => p.id === id);

  it('finds no problems and the generated file is up to date', () => {
    const { problems, out } = pickups.build(content);
    expect(problems).toEqual([]);
    expect(pickups.render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/pickups.generated.ts'), 'utf8'));
  });

  it('checks the schema: unknown fields, effect kinds and enums', () => {
    const c = clone(content);
    find(c, 'core.health_small').respawn = 10;
    find(c, 'core.armor_small').effect.amout = 5;
    find(c, 'core.ammo_light').effect.ammo = 'darts';
    find(c, 'core.jetpack').effect.kind = 'rocketboots';
    find(c, 'core.powerup_speed').effect.powerup = 'invisibility';
    c.pickups.rules.armor.absorbs = 0.5;
    c.pickups.extra = 1;
    const p = pickups.build(c).problems.join('\n');
    expect(p).toMatch(/health_small\): unknown field "respawn"/);
    expect(p).toMatch(/effect: unknown field "amout"/);
    expect(p).toMatch(/effect\.ammo: one of light/);
    expect(p).toMatch(/effect: kind one of health/);
    expect(p).toMatch(/effect\.powerup: one of speed, damage/);
    expect(p).toMatch(/rules\.armor: unknown field "absorbs"/);
    expect(p).toMatch(/pickups\.json: unknown field "extra"/);
  });

  it('checks the references and numbers', () => {
    const c = clone(content);
    find(c, 'core.weapon_rifle').effect.weapon = 'core.nothing';
    find(c, 'core.weapon_smg').effect.weapon = 'core.mount_mg';
    find(c, 'core.weapon_shotgun').effect.weapon = 'core.sniper';
    find(c, 'core.grenades').effect.count = 40;
    find(c, 'core.mines').effect.throwable = 'pie';
    find(c, 'core.uav').botValue = 1.5;
    delete find(c, 'core.glider').displayName;
    c.pickups.pickups.push(clone(find(c, 'core.health_large')));
    const p = pickups.build(c).problems.join('\n');
    expect(p).toMatch(/weapon core\.nothing doesn't exist/);
    expect(p).toMatch(/weapon core\.mount_mg is a mounted one/);
    expect(p).toMatch(/weapon_shotgun\): a weapon pickup's id is core\.weapon_sniper/);
    expect(p).toMatch(/grenades\): count must be 1-\d+/);
    expect(p).toMatch(/effect\.throwable: one of frag/);
    expect(p).toMatch(/uav\): botValue must be 0-1/);
    expect(p).toMatch(/glider\): "displayName" is missing/);
    expect(p).toMatch(/core\.health_large is listed twice/);
  });

  it('keeps every pickup the maps and Style Packs name', () => {
    const c = clone(content);
    c.pickups.pickups = c.pickups.pickups.filter((p) => p.id !== 'core.health_large');
    expect(pickups.build(c).problems.join('\n')).toMatch(/names pickup core\.health_large, which isn't in content\/pickups\.json/);
  });

  it('gives weapon pickups their weapon name and default bot value', () => {
    const { out } = pickups.build(content);
    const lmg = out.items.find((i) => i.id === 'core.weapon_lmg');
    expect(lmg.displayName).toBe(JSON.parse(readFileSync(join(ROOT, 'content/weapons/lmg.json'), 'utf8')).displayName);
    expect(lmg.botValue).toBe(pickups.weaponBotValue(30));
    expect(out.items.find((i) => i.id === 'core.disc_fast')).toMatchObject({ displayName: undefined, disc: 'fast' });
  });
});
