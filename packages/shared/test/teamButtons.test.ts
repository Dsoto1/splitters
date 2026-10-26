import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, teamAllows, validateMap, type MapEntity, type ScenarioActor } from '../src/index.ts';
import { initNavigation } from '../src/match.ts';
import { EAST, act, bareScenario, button, codes, loaded, rule, twoRooms } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const door = (extra: Partial<Extract<MapEntity, { kind: 'door' }>> = {}): MapEntity => ({ id: 'door_1', kind: 'door', position: [4, 0, 0], yaw: EAST, startOpen: false, locked: false, auto: true, ...extra });

describe('team-only buttons, doors and zones', () => {
  it('only the button\'s team can press it', () => {
    const actors: ScenarioActor[] = [
      { slot: 0, alive: true, pos: { x: 2, y: 0, z: -1.6 }, team: 'embers' },
      { slot: 1, alive: true, pos: { x: 2, y: 0, z: -1.6 }, team: 'tide' },
    ];
    const map = twoRooms([button('button_1', [2, 0, -3], { team: 'embers' })], {
      variables: [{ id: 'var_n', name: 'n', initial: 0 }],
      rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('add_var', { target: 'var_n', value: 1 })] })],
    });
    const { scenario, events, tick } = bareScenario(map, actors);
    scenario.step();
    const eye = { x: 2, y: 1.6, z: -1.6 };
    scenario.use(1, eye, Math.PI, -0.2);
    expect(events.filter((e) => e.e === 'use')).toEqual([{ e: 'use', s: 1, i: 1, ok: 0 }]);
    expect(scenario.variable('var_n')).toBe(0);
    tick.n += 60;
    scenario.use(0, eye, Math.PI, -0.2);
    expect(scenario.variable('var_n')).toBe(1);
  });

  it('a team door opens by itself only for its team, and blocks other teams\' bots', () => {
    const actors: ScenarioActor[] = [{ slot: 1, alive: true, pos: { x: 2.5, y: 0, z: 0 }, team: 'tide' }];
    const { scenario, tick } = bareScenario(twoRooms([door({ team: 'embers' })]), actors);
    for (let i = 0; i < 60; i++, tick.n++) scenario.step();
    expect(scenario.doorOpen('door_1')).toBe(0);
    expect(scenario.blockers('tide')).toHaveLength(1);
    expect(scenario.blockers('embers')).toHaveLength(0);
    actors[0]!.team = 'embers';
    for (let i = 0; i < 60; i++, tick.n++) scenario.step();
    expect(scenario.doorOpen('door_1')).toBe(1);
  });

  it('a team zone only counts that team', () => {
    const actors: ScenarioActor[] = [{ slot: 0, alive: true, pos: { x: 0, y: 0, z: 0 }, team: 'tide' }];
    const zone: MapEntity = { id: 'zone_1', kind: 'zone', position: [0, 0, 0], size: [4, 3, 4], who: 'any', count: 1, startEnabled: true, team: 'embers' };
    const map = twoRooms([zone], {
      variables: [{ id: 'var_in', name: 'in', initial: 0 }],
      rules: [rule({ when: { event: 'zone_enter', target: 'zone_1' }, do: [act('add_var', { target: 'var_in', value: 1 })] })],
    });
    const { scenario, tick } = bareScenario(map, actors);
    for (let i = 0; i < 5; i++, tick.n++) scenario.step();
    expect(scenario.variable('var_in')).toBe(0);
    actors.push({ slot: 1, alive: true, pos: { x: 0.5, y: 0, z: 0 }, team: 'embers' });
    for (let i = 0; i < 5; i++, tick.n++) scenario.step();
    expect(scenario.variable('var_in')).toBe(1);
  });

  it('filters name a team or faction of the map', () => {
    expect(teamAllows(undefined, null)).toBe(true);
    expect(teamAllows('embers', 'tide')).toBe(false);
    const map = twoRooms([button('button_1', [2, 0, -3], { team: 'nobody' }), door({ team: 'tide' })], {
      rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('door_open', { target: 'door_1' })] })],
    });
    const issues = validateMap(loaded(map)).filter((i) => i.code === 'team.unknown');
    expect(issues.map((i) => i.targetId)).toEqual(['button_1']);
    expect(codes(validateMap(loaded(map)))).toEqual(['team.unknown']);
  });
});
