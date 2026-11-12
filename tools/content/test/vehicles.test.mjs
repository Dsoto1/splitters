import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lockText } from '../weapons.mjs';
import * as npcs from '../npcs.mjs';
import * as vehicles from '../vehicles.mjs';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ROOT = vehicles.ROOT;

describe('vehicles generator (tools/content/vehicles.mjs)', () => {
  const content = vehicles.load();
  const mount = (c, id) => c.mounts.find((m) => m.data.id === id).data;

  it('finds no problems and the generated file is up to date', () => {
    const { problems, out } = vehicles.build(content);
    expect(problems).toEqual([]);
    expect(vehicles.render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/mounts.generated.ts'), 'utf8'));
  });

  it('checks the schema, weapons and models', () => {
    const c = clone(content);
    const tank = mount(c, 'tank');
    tank.helth = 3;
    tank.seats[1].weapon = 'core.nothing';
    tank.seats[2].weapon = 'core.rifle';
    tank.model = 'vehicles/missing.glb';
    const p = vehicles.build(c).problems.join('\n');
    expect(p).toMatch(/unknown field "helth"/);
    expect(c.mounts.length).toBeGreaterThan(0);
    // The schema failed, so the references are checked once it passes.
    delete tank.helth;
    const q = vehicles.build(c).problems.join('\n');
    expect(q).toMatch(/weapon core\.nothing doesn't exist/);
    expect(q).toMatch(/weapon core\.rifle is not a mounted one/);
    expect(q).toMatch(/model vehicles\/missing\.glb not found/);
  });

  it('checks seats by kind, and the palette order', () => {
    const c = clone(content);
    mount(c, 'turret_mg').seats[0].role = 'passenger';
    mount(c, 'snow_sled').seats.push({ role: 'driver', label: 'Second driver', offset: [0, 0, 0] });
    mount(c, 'sentry').seats.push({ role: 'gunner', label: 'Gunner', offset: [0, 0, 0], weapon: 'core.mount_mg' });
    mount(c, 'hauler').seats[1].weapon = undefined;
    mount(c, 'buggy').order = mount(c, 'snow_sled').order;
    const p = vehicles.build(clone(c)).problems.join('\n');
    expect(p).toMatch(/turret_mg\.json: a turret has gunner seats only/);
    expect(p).toMatch(/snow_sled\.json: a vehicle has exactly one driver seat/);
    expect(p).toMatch(/sentry\.json: a sentry has no seats/);
    expect(p).toMatch(/hauler\.json: seats\[1\] \(Gunner\): a gunner seat needs a weapon/);
    expect(p).toMatch(/order \d+ is also (snow_sled|buggy)'s/);
  });

  it("checks a drawn tire's size", () => {
    const c = clone(content);
    mount(c, 'buggy').wheels.radius = 0;
    mount(c, 'troop_truck').wheels.width = -0.5;
    const p = vehicles.build(c).problems.join('\n');
    expect(p).toMatch(/buggy\.json: wheels\.radius and wheels\.width are the drawn tire's size/);
    expect(p).toMatch(/troop_truck\.json: wheels\.radius and wheels\.width are the drawn tire's size/);
    mount(c, 'gun_jeep').wheels.raduis = 0.5;
    expect(vehicles.build(c).problems.join('\n')).toMatch(/unknown field "raduis"/);
    // Left out: the tire model's own size.
    const d = clone(content);
    delete mount(d, 'buggy').wheels.radius;
    delete mount(d, 'buggy').wheels.width;
    expect(vehicles.build(d).problems).toEqual([]);
  });

  it('needs both route crafts', () => {
    const c = clone(content);
    c.mounts = c.mounts.filter((m) => m.data.id !== 'dropship_drop');
    expect(vehicles.build(c).problems.join('\n')).toMatch(/dropship_drop\.json is missing/);
  });
});

describe('NPC roles generator (tools/content/npcs.mjs)', () => {
  const content = npcs.load();

  it('finds no problems and the generated file and lock are up to date', () => {
    const { problems, out } = npcs.build(content);
    expect(problems).toEqual([]);
    expect(npcs.render(out)).toBe(readFileSync(join(ROOT, 'packages/shared/src/content/npcRoles.generated.ts'), 'utf8'));
    expect(lockText(out.lock)).toBe(readFileSync(join(ROOT, 'content/codes.lock.json'), 'utf8'));
  });

  it('rejects a duplicate code, a changed code, a reused one and a gap', () => {
    const c = clone(content);
    c.npcs.roles[1].code = 0;
    const p = npcs.build(c).problems.join('\n');
    expect(p).toMatch(/code 0 is also trooper's/);
    expect(p).toMatch(/gunner has code 1 .* never changes/);
    // A new role may not take a retired one's code (the lock remembers it).
    const d = clone(content);
    d.lock.npcRoles.retired_role = 18;
    d.npcs.roles.push({ ...clone(d.npcs.roles[0]), role: 'newcomer', code: 18, bot: { id: 'core.npc_newcomer', tags: ['NPC'] } });
    expect(npcs.build(d).problems.join('\n')).toMatch(/code 18 was retired_role's .* never reused/);
    const e = clone(content);
    e.npcs.roles.push({ ...clone(e.npcs.roles[0]), role: 'newcomer', code: 20, bot: { id: 'core.npc_newcomer', tags: ['NPC'] } });
    expect(npcs.build(e).problems.join('\n')).toMatch(/codes must run 0-18 with no gaps/);
  });

  it('checks the schema', () => {
    const c = clone(content);
    c.npcs.roles.find((x) => x.role === 'trooper').speeed = 1;
    c.npcs.roles.find((x) => x.role === 'goblin').bot.tags.push('NINJA');
    const p = npcs.build(c).problems.join('\n');
    expect(p).toMatch(/unknown field "speeed"/);
    expect(p).toMatch(/tags\[3\]: one of/);
  });

  it('checks the references', () => {
    const c = clone(content);
    const r = c.npcs.roles.find((x) => x.role === 'goblin');
    r.weapon = 'core.mount_mg';
    r.look = 'core.nobody';
    r.bot.aggression = 140;
    c.npcs.roles.find((x) => x.role === 'heavy').creature = true;
    c.npcs.roles.find((x) => x.role === 'sniper').weapon = 'core.nothing';
    const p = npcs.build(c).problems.join('\n');
    expect(p).toMatch(/weapon core\.mount_mg is a mounted one/);
    expect(p).toMatch(/weapon core\.nothing doesn't exist/);
    expect(p).toMatch(/look core\.nobody is not a character look/);
    expect(p).toMatch(/heavy\): a creature role needs its body/);
    expect(p).toMatch(/bot\.aggression must be 0-100/);
  });
});
