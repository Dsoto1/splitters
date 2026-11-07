import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as sets from '../weapon-sets.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
/** The content with its sets (the JSON file) copied, to change them: the weapons, throwables and pickups are shared. */
const withSets = (c) => ({ ...c, sets: clone(c.sets) });
const ROOT = sets.ROOT;

describe('weapon sets generator (tools/content/weapon-sets.mjs)', () => {
  const content = sets.load();
  const find = (c, id) => c.sets.sets.find((s) => s.id === id);
  const problems = (c) => sets.build(c).problems.join('\n');

  it('finds no problems and the generated file is up to date', () => {
    const { problems: p, out } = sets.build(content);
    expect(p).toEqual([]);
    expect(sets.render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/weaponSets.generated.ts'), 'utf8'));
    expect(out.sets.map((s) => s.id)).toEqual(['standard', 'military', 'scifi', 'medieval', 'chaos', 'mixed']);
  });

  it('checks the schema and the ids', () => {
    const c = withSets(content);
    find(c, 'military').spawns = ['core.knife'];
    find(c, 'scifi').id = 'Sci Fi';
    c.sets.sets.push(clone(find(c, 'medieval')));
    c.sets.extra = 1;
    const p = problems(c);
    expect(p).toMatch(/\(military\): unknown field "spawns"/);
    expect(p).toMatch(/\(Sci Fi\): id must be 2-24 lower case letters/);
    expect(p).toMatch(/id medieval is listed twice/);
    expect(p).toMatch(/weapon-sets\.json: unknown field "extra"/);
  });

  it('every weapon exists and can be a pickup (or is spawned with); never a tool, a mode-only weapon or a mounted gun', () => {
    const c = withSets(content);
    find(c, 'military').weapons.push('core.lazer');
    find(c, 'chaos').weapons.push('core.medkit', 'core.mount_mg');
    // The knife has no pickup: fine in a spawn, not as a pickup weapon only.
    find(c, 'scifi').weapons.push('core.knife');
    find(c, 'scifi').spawn = ['core.pulse_pistol', 'core.plasma'];
    const p = problems(c);
    expect(p).toMatch(/\(military\): weapon core\.lazer doesn't exist/);
    expect(p).toMatch(/\(chaos\): weapon core\.medkit is a tool, a mode-only weapon or a mounted gun/);
    expect(p).toMatch(/\(chaos\): weapon core\.mount_mg is a tool/);
    expect(p).toMatch(/\(scifi\): weapon core\.knife has no pickup/);
  });

  it('the sniper gun is a scoped gun of the set; a random gun needs a main gun; grenades exist and have pickups', () => {
    const c = withSets(content);
    find(c, 'military').sniper = 'core.rifle';
    find(c, 'scifi').sniper = 'core.marksman';
    find(c, 'medieval').randomGun = true;
    find(c, 'chaos').throwables = ['sheep', 'pie'];
    find(c, 'standard').weapons = ['core.rifle'];
    const p = problems(c);
    expect(p).toMatch(/\(military\): sniper gun core\.rifle has no scope/);
    expect(p).toMatch(/\(scifi\): sniper gun core\.marksman isn't one of the set's weapons/);
    expect(p).toMatch(/\(medieval\): "randomGun" needs a main gun/);
    expect(p).toMatch(/\(chaos\): throwable pie doesn't exist/);
    expect(p).toMatch(/"standard" plays as before/);
    const d = withSets(content);
    d.sets.sets = d.sets.sets.filter((s) => s.id !== 'standard');
    expect(problems(d)).toMatch(/the "standard" set is missing/);
  });
});
