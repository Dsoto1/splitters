import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_DEATHMATCH_RULES, getWeapon, initPhysics, weaponCode } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** The Armory's Try it in the range (client frontend/armory.ts): the player holds the weapon now and at each spawn after. */
describe('holdOnSpawn (sim/match.ts)', () => {
  const yard = () => {
    const tiles = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    return makeMap(tiles, [[0, 0, 0]]);
  };

  it('puts the weapon in hand, full, and again after a respawn', () => {
    const match = new Match(yard(), DEFAULT_DEATHMATCH_RULES);
    const me = match.addHuman('me')!;
    match.step();
    match.holdOnSpawn(me, 'core.sniper');
    const code = weaponCode(getWeapon('core.sniper'));
    expect(me.current).toBe(code);
    expect(me.weapons.get(code)?.mag).toBe(getWeapon('core.sniper').magazine);
    // A new life: the spawn loadout, and the weapon in hand again.
    (match as unknown as { spawn(c: Combatant): void }).spawn(me);
    expect(me.current).toBe(code);
    expect(me.weapons.size).toBeGreaterThan(1);
  });

  it('ignores a weapon that does not exist', () => {
    const match = new Match(yard(), DEFAULT_DEATHMATCH_RULES);
    const me = match.addHuman('me')!;
    const was = me.current;
    match.holdOnSpawn(me, 'core.nothing');
    expect(me.current).toBe(was);
    expect(me.hand).toBeUndefined();
  });
});
