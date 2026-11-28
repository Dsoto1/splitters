import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUTTON_FIRE, CORE_BOT_PROFILES, getWeapon, initPhysics, loadMap, rulesForMode, weaponCode, type GameEvent } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const range = () => {
  const loaded = loadMap(readFileSync(new URL('../../../maps/practice_range.json', import.meta.url), 'utf8'));
  if (!loaded.ok) throw new Error('practice_range did not load');
  return loaded.map;
};

/**
 * A lean match (MatchOptions `lean`: the Practice range and Test my loadout alone; client main.ts playRange): no
 * navmesh unless something asks, no bot tick, play as soon as you have loaded; and the range's weapon picker
 * (holdOnSpawn with `swap`). Shots land as in any match.
 */
describe('lean range (sim/match.ts)', () => {
  it('makes no navmesh, skips the countdown, and a shot still hits', () => {
    const map = range();
    const rules = { ...rulesForMode(map, 'core.deathmatch'), timeLimitSeconds: 0, scoreLimit: 0 };
    const match = new Match(map, rules, 1, { startGate: true, lean: true });
    const me = match.addHuman('me')!;
    match.step();
    expect(match.phase).toBe('waiting');
    match.ready(me.slot);
    match.step();
    expect(match.phase).toBe('playing');
    match.holdOnSpawn(me, 'core.rifle');
    const events: GameEvent[] = [];
    for (let i = 0; i < 60; i++) {
      match.queueInputs(me.slot, [{ seq: i + 1, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: i % 2 ? BUTTON_FIRE : 0 }]);
      events.push(...match.step());
    }
    expect(events.some((e) => e.e === 'shot')).toBe(true);
    expect(match.navMade).toBe(false);
    // Something that does need it (a bot) makes it then.
    match.addBot('bot', CORE_BOT_PROFILES[0]!);
    expect(match.navMade).toBe(true);
  });

  it('a picked weapon replaces the last one picked, and stays for the next life', () => {
    const map = range();
    const match = new Match(map, rulesForMode(map, 'core.deathmatch'), 1, { lean: true });
    const me = match.addHuman('me')!;
    match.step();
    const start = me.weapons.size;
    match.holdOnSpawn(me, 'core.sniper', true);
    match.holdOnSpawn(me, 'core.shotgun', true);
    const shotgun = weaponCode(getWeapon('core.shotgun'));
    expect(me.current).toBe(shotgun);
    expect(me.weapons.has(weaponCode(getWeapon('core.sniper')))).toBe(false);
    expect(me.weapons.size).toBe(start + 1);
    expect(me.hand).toBe('core.shotgun');
  });
});
