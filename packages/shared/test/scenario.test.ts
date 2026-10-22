import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BUTTON_FIRE,
  BUTTON_USE,
  CORE_BOT_PROFILES,
  PhysicsWorld,
  ScenarioBodies,
  buildMapGeometry,
  initPhysics,
  loadMap,
  validateMap,
  type GameEvent,
  type LogicRule,
  type MapDocument,
  type MapEntity,
  type PlayerInput,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const EAST = Math.PI / 2;

/** Two rooms side by side along +X with a doorway at x = 4. */
function twoRooms(entities: MapEntity[], logic: Partial<MapDocument['logic']> = {}, spawn: [number, number, number] = [-2, 0, 0]): MapDocument {
  const map = makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
    ],
    [spawn],
  );
  map.entities.push(...entities);
  map.logic = { variables: [], timers: [], objectives: [], rules: [], ...logic };
  return map;
}

const door = (extra: Partial<Extract<MapEntity, { kind: 'door' }>> = {}): MapEntity => ({ id: 'door_1', kind: 'door', position: [4, 0, 0], yaw: EAST, startOpen: false, locked: false, auto: true, ...extra });
const button = (pos: [number, number, number] = [2, 0, -3]): MapEntity => ({ id: 'button_1', kind: 'button', position: pos, yaw: 0, label: 'Open', once: false, cooldownSeconds: 0.5, startEnabled: true });
const rule = (r: Partial<LogicRule> & Pick<LogicRule, 'when' | 'do'>): LogicRule => ({ id: `rule_${Math.random().toString(36).slice(2, 8)}`, name: '', enabled: true, once: false, if: [], ...r });
const act = (type: LogicRule['do'][number]['type'], extra: Partial<LogicRule['do'][number]> = {}): LogicRule['do'][number] => ({ type, target: null, value: 0, text: '', state: '', ...extra });

class Driver {
  seq = 0;
  readonly events: GameEvent[] = [];
  constructor(
    readonly match: Match,
    readonly me: Combatant,
  ) {}

  input(over: Partial<PlayerInput> = {}): void {
    this.match.queueInputs(this.me.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: this.me.yaw, pitch: 0, buttons: 0, ...over }]);
    this.events.push(...this.match.step());
  }

  run(ticks: number, over: Partial<PlayerInput> = {}): void {
    for (let i = 0; i < ticks; i++) this.input(over);
  }

  place(x: number, z: number, yaw: number): void {
    this.me.move = { pos: { x, y: 0, z }, velY: 0, grounded: true };
    this.me.yaw = yaw;
  }

  of<K extends GameEvent['e']>(e: K): Extract<GameEvent, { e: K }>[] {
    return this.events.filter((x): x is Extract<GameEvent, { e: K }> => x.e === e);
  }
}

function start(map: MapDocument): Driver {
  const loaded = loadMap(map);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  const match = new Match(loaded.map, undefined, 3);
  const me = match.addHuman('me')!;
  const d = new Driver(match, me);
  d.run(2);
  return d;
}

describe('map format v4', () => {
  it('migrates a v3 map with empty logic', () => {
    const v3 = JSON.parse(readFileSync(new URL('./fixtures/arena_v3.json', import.meta.url), 'utf8'));
    const r = loadMap(v3);
    expect(r.ok && r.migratedFrom).toBe(3);
    if (r.ok) expect(r.map.logic).toEqual({ variables: [], timers: [], objectives: [], rules: [] });
  });
});

describe('doors and buttons', () => {
  it('a locked door blocks movement until a button rule opens it', () => {
    const d = start(
      twoRooms([door({ locked: true }), button()], {
        rules: [rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('door_unlock', { target: 'door_1' }), act('door_open', { target: 'door_1' })] })],
      }),
    );
    d.place(2, 0, EAST);
    d.run(90, { forward: 1, yaw: EAST });
    expect(d.me.move.pos.x).toBeLessThan(3.9);
    expect(d.match.scenario.doorOpen('door_1')).toBe(0);

    // Look at the button (south, slightly down) and press E.
    d.place(2, -1.6, Math.PI);
    d.input({ yaw: Math.PI, pitch: -0.2, buttons: BUTTON_USE });
    expect(d.of('use')).toEqual([{ e: 'use', s: d.me.slot, i: 2, ok: 1 }]);
    expect(d.of('door')).toEqual([{ e: 'door', i: 1, open: 1 }]);

    d.run(45);
    expect(d.match.scenario.doorOpen('door_1')).toBe(1);
    d.place(2, 0, EAST);
    d.run(90, { forward: 1, yaw: EAST });
    expect(d.me.move.pos.x).toBeGreaterThan(6);
  });

  it('auto doors open for nearby players and close after they leave; locked ones refuse E', () => {
    const d = start(twoRooms([door()]));
    d.place(1.5, 0, EAST);
    d.run(60);
    expect(d.match.scenario.doorOpen('door_1')).toBe(1);
    d.place(-3, 0, EAST);
    d.run(Math.round(60 * 2.5));
    expect(d.match.scenario.doorOpen('door_1')).toBe(0);

    const locked = start(twoRooms([door({ locked: true, auto: false })]));
    locked.place(2.6, 0, EAST);
    locked.input({ buttons: BUTTON_USE });
    expect(locked.of('use')[0]?.ok).toBe(0);
    expect(locked.match.scenario.doorOpen('door_1')).toBe(0);
  });

  it('closed doors stop bullets and bots treat locked doors as walls', () => {
    const map = twoRooms([door({ locked: true })], {}, [-2, 0, 0]);
    map.entities.push({ id: 'spawn_far', kind: 'spawn', position: [10, 0, 2], yaw: 0, faction: null });
    const loaded = loadMap(map);
    if (!loaded.ok) throw new Error('invalid');
    const match = new Match(loaded.map, undefined, 9);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 100 })!;
    bot.move = { pos: { x: -2, y: 0, z: 0 }, velY: 0, grounded: true };
    let maxX = -Infinity;
    for (let t = 0; t < 60 * 15; t++) {
      match.step();
      if (bot.alive) maxX = Math.max(maxX, bot.move.pos.x);
    }
    expect(maxX).toBeLessThan(3.6);

    const physics = new PhysicsWorld(buildMapGeometry(loaded.map));
    const bodies = new ScenarioBodies(physics, loaded.map);
    const from = { x: 0, y: 1.5, z: 0 };
    expect(physics.raycastWorld(from, { x: 1, y: 0, z: 0 }, 6)).toBeCloseTo(3.9, 1);
    bodies.setDoorOpen(1, 1);
    bodies.commit();
    expect(physics.raycastWorld(from, { x: 1, y: 0, z: 0 }, 6)).toBeNull();
  });
});

describe('traps', () => {
  it('an always-on spike floor hurts and eventually kills, credited to the trap', () => {
    const d = start(twoRooms([{ id: 'trap_1', kind: 'trap', trap: 'spikes', position: [10, 0, 0], yaw: 0, activation: 'always', onSeconds: 1, offSeconds: 1, offsetSeconds: 0, startEnabled: true, damage: null }]));
    d.place(10, 0, 0);
    d.run(5);
    expect(d.me.health).toBe(65);
    d.run(120);
    expect(d.of('kill')[0]).toMatchObject({ killer: null, victim: d.me.slot, weapon: 'core.trap_spikes' });
  });

  it('a cycling flame jet only burns while on, and a disabled trap is harmless', () => {
    const flames = (startEnabled: boolean): MapEntity => ({ id: 'trap_1', kind: 'trap', trap: 'flames', position: [8, 0, -3], yaw: 0, activation: 'cycle', onSeconds: 1, offSeconds: 2, offsetSeconds: 0, startEnabled, damage: 5 });
    const d = start(twoRooms([flames(true)]));
    d.place(8, 0, 0);
    const hp: number[] = [];
    for (let i = 0; i < 4; i++) {
      d.run(30);
      hp.push(d.me.health);
    }
    // On for the first second (damage), off for the next (no change).
    expect(hp[0]).toBeLessThan(100);
    expect(hp[1]).toBeLessThan(hp[0]!);
    expect(hp[2]).toBe(hp[1]);
    expect(hp[3]).toBe(hp[2]);

    const off = start(twoRooms([flames(false)]));
    off.place(8, 0, 0);
    off.run(120);
    expect(off.me.health).toBe(100);
  });

  it('a proximity mine warns, explodes, and rearms', () => {
    const d = start(twoRooms([{ id: 'mine_1', kind: 'trap', trap: 'mine', position: [10, 0, 0], yaw: 0, activation: 'proximity', onSeconds: 0.5, offSeconds: 3, offsetSeconds: 0, startEnabled: true, damage: 60 }]));
    d.place(10, 0, 0.5);
    d.run(30);
    expect(d.of('trap')[0]).toEqual({ e: 'trap', i: 1, warn: 1 });
    expect(d.of('explode')).toHaveLength(1);
    expect(d.me.health).toBeLessThan(60);
    d.place(-2, 0, 0);
    d.run(60);
    expect(d.of('explode')).toHaveLength(1);
  });

  it('a logic trap fires only when a zone rule tells it to', () => {
    const d = start(
      twoRooms(
        [
          { id: 'crush_1', kind: 'trap', trap: 'crusher', position: [8, 0, 0], yaw: 0, activation: 'logic', onSeconds: 1, offSeconds: 1, offsetSeconds: 0, startEnabled: true, damage: null },
          { id: 'zone_1', kind: 'zone', position: [8, 0, 0], size: [2, 3, 2], who: 'any', count: 1, startEnabled: true },
        ],
        { rules: [rule({ when: { event: 'zone_enter', target: 'zone_1' }, do: [act('wait', { value: 0.5 }), act('trap_fire', { target: 'crush_1' })] })] },
      ),
    );
    d.run(60);
    expect(d.of('trap')).toHaveLength(0);
    d.place(8, 0, 0);
    d.run(20);
    expect(d.of('trap')).toHaveLength(0);
    d.run(30);
    expect(d.of('trap')).toHaveLength(1);
    expect(d.of('kill')[0]?.weapon).toBe('core.trap_crusher');
  });
});

describe('destructibles', () => {
  it('shots break a crate, firing its destroyed rule; barrels explode and chain', () => {
    const d = start(
      twoRooms(
        [
          { id: 'crate_1', kind: 'destructible', model: 'crate', position: [2, 0, 0], yaw: 0, health: null, explosiveOnly: false },
          { id: 'barrel_1', kind: 'destructible', model: 'barrel', position: [10, 0, 2], yaw: 0, health: null, explosiveOnly: false },
          { id: 'barrel_2', kind: 'destructible', model: 'barrel', position: [10, 0, -1], yaw: 0, health: null, explosiveOnly: false },
        ],
        { variables: [{ id: 'var_broken', name: 'broken', initial: 0 }], rules: [rule({ when: { event: 'destroyed', target: null }, do: [act('add_var', { target: 'var_broken', value: 1 })] })] },
      ),
    );
    d.place(-2, 0, EAST);
    // Aim slightly down at the crate's centre (0.6 m high) from eye height.
    const pitch = -Math.atan2(1.0, 4);
    for (let i = 0; i < 10 && d.match.scenario.destructibleAlive('crate_1'); i++) {
      d.input({ yaw: EAST, pitch, buttons: BUTTON_FIRE });
      d.run(30, { yaw: EAST, pitch });
    }
    expect(d.match.scenario.destructibleAlive('crate_1')).toBe(false);
    expect(d.of('broken')).toEqual([{ e: 'broken', i: 1 }]);
    expect(d.match.scenario.variable('var_broken')).toBe(1);

    // Shooting one barrel sets off the other.
    d.place(4, -0.5, EAST);
    const toBarrel = Math.atan2(10 - 4, 2 + 0.5);
    for (let i = 0; i < 6 && d.match.scenario.destructibleAlive('barrel_1'); i++) {
      d.input({ yaw: toBarrel, pitch: -0.12, buttons: BUTTON_FIRE });
      d.run(30, { yaw: toBarrel, pitch: -0.12 });
    }
    expect(d.match.scenario.destructibleAlive('barrel_1')).toBe(false);
    expect(d.match.scenario.destructibleAlive('barrel_2')).toBe(false);
    expect(d.of('explode').length).toBeGreaterThanOrEqual(2);
    expect(d.match.scenario.variable('var_broken')).toBe(3);
  });

  it('explosive-only walls ignore bullets', () => {
    const d = start(twoRooms([{ id: 'wall_1', kind: 'destructible', model: 'wall', position: [4, 0, 0], yaw: EAST, health: 50, explosiveOnly: true }]));
    d.place(1, 0, EAST);
    for (let i = 0; i < 6; i++) {
      d.input({ yaw: EAST, pitch: -0.05, buttons: BUTTON_FIRE });
      d.run(20, { yaw: EAST, pitch: -0.05 });
    }
    expect(d.match.scenario.destructibleAlive('wall_1')).toBe(true);
  });
});

describe('logic', () => {
  it('zone -> objective, message, wait, then the instigator wins the round', () => {
    const d = start(
      twoRooms([{ id: 'zone_exit', kind: 'zone', position: [8, 0, 0], size: [4, 3, 4], who: 'any', count: 1, startEnabled: true }], {
        objectives: [{ id: 'obj_reach', text: 'Reach the far room', startActive: true, marker: 'zone_exit' }],
        rules: [
          rule({
            when: { event: 'zone_enter', target: 'zone_exit' },
            once: true,
            do: [act('objective', { target: 'obj_reach', state: 'complete' }), act('message', { text: 'Made it!', value: 3 }), act('wait', { value: 1 }), act('end_round', { state: 'instigator wins' })],
          }),
        ],
      }),
    );
    expect(d.match.scenario.objectiveState('obj_reach')).toBe('active');
    d.place(8, 0, 0);
    d.run(2);
    expect(d.match.scenario.objectiveState('obj_reach')).toBe('complete');
    expect(d.of('obj')).toEqual([{ e: 'obj', i: 0, st: 2 }]);
    expect(d.of('msg')).toEqual([{ e: 'msg', text: 'Made it!', secs: 3 }]);
    expect(d.match.phase).toBe('playing');
    d.run(62);
    expect(d.match.phase).toBe('intermission');
    expect(d.of('round_end')).toEqual([{ e: 'round_end', winner: d.me.slot }]);
  });

  it('counts button presses in a variable and opens the door on the third (IF condition)', () => {
    const d = start(
      twoRooms([door({ auto: false }), button()], {
        variables: [{ id: 'var_presses', name: 'presses', initial: 0 }],
        rules: [
          rule({ when: { event: 'button_pressed', target: 'button_1' }, do: [act('add_var', { target: 'var_presses', value: 1 })] }),
          rule({ when: { event: 'variable_changed', target: 'var_presses' }, if: [{ type: 'variable', target: 'var_presses', op: '>=', value: 3, state: '' }], do: [act('door_open', { target: 'door_1' })] }),
        ],
      }),
    );
    d.place(2, -1.6, Math.PI);
    for (let i = 0; i < 3; i++) {
      d.input({ yaw: Math.PI, pitch: -0.2, buttons: BUTTON_USE });
      if (i < 2) expect(d.of('door')).toHaveLength(0);
      d.run(40, { yaw: Math.PI });
    }
    expect(d.match.scenario.variable('var_presses')).toBe(3);
    expect(d.of('door')).toHaveLength(1);
  });

  it('timers fire timer_done; disabled pickups disappear; scenario state resets each round', () => {
    const d = start(
      twoRooms([{ id: 'pk_health', kind: 'pickup', position: [8, 0, 0], item: 'core.health_small', respawnSeconds: null }], {
        timers: [{ id: 'timer_1', name: 'countdown', seconds: 1, loop: false, visible: true }],
        variables: [{ id: 'var_x', name: 'x', initial: 0 }],
        rules: [
          rule({ when: { event: 'match_start', target: null }, do: [act('timer_start', { target: 'timer_1' }), act('disable', { target: 'pk_health' })] }),
          rule({ when: { event: 'timer_done', target: 'timer_1' }, do: [act('set_var', { target: 'var_x', value: 7 })] }),
        ],
      }),
    );
    const snap = d.match.snapshot([]);
    expect(snap.pk).toContain('pk_health');
    expect(snap.sc?.tm).toEqual([[0, 1]]);
    d.run(62);
    expect(d.match.scenario.variable('var_x')).toBe(7);
    d.match.scenario.reset();
    expect(d.match.scenario.variable('var_x')).toBe(0);
  });

  it('runaway rule chains are cut off instead of hanging', () => {
    const d = start(
      twoRooms([], {
        variables: [{ id: 'var_loop', name: 'loop', initial: 0 }],
        rules: [
          rule({ when: { event: 'match_start', target: null }, do: [act('add_var', { target: 'var_loop', value: 1 })] }),
          rule({ when: { event: 'variable_changed', target: 'var_loop' }, do: [act('add_var', { target: 'var_loop', value: 1 })] }),
        ],
      }),
    );
    d.run(5);
    expect(d.match.scenario.variable('var_loop')).toBeLessThanOrEqual(10);
  });
});

describe('scenario snapshots', () => {
  it('sends a keyframe, then only changes', () => {
    const d = start(twoRooms([door()]));
    const first = d.match.snapshot([]).sc;
    // start() already took no snapshots, so this is the keyframe.
    expect(first?.es).toEqual([[1, 0, 0]]);
    expect(d.match.snapshot([]).sc).toBeUndefined();
    d.place(2, 0, EAST);
    d.run(10);
    expect(d.match.snapshot([]).sc?.es?.[0]?.[0]).toBe(1);
  });
});

describe('scenario validation', () => {
  it('flags broken references, unused buttons and locked doors that never open', () => {
    const map = twoRooms([door({ locked: true }), button()], {
      rules: [rule({ id: 'rule_bad', name: 'bad', when: { event: 'button_pressed', target: 'nope_1' }, do: [act('door_open', { target: 'gone_1' })] })],
    });
    const codes = validateMap(map).map((i) => i.code);
    expect(codes).toContain('logic.target_broken');
    expect(codes).toContain('button.unused');
    expect(codes).toContain('door.never_opens');
    // Reference problems are warnings, so TEST still runs.
    expect(loadMap(map).ok).toBe(true);
  });
});

describe('demo map: The Vault', () => {
  it('can be won: button opens the door, two grenades breach the wall, the vault zone ends the round', () => {
    const loaded = loadMap(readFileSync(new URL('../../../maps/m3_vault.json', import.meta.url), 'utf8'));
    if (!loaded.ok) throw new Error('vault map invalid');
    const match = new Match(loaded.map, undefined, 5);
    const me = match.addHuman('me')!;
    const d = new Driver(match, me);
    d.run(2);
    expect(d.of('msg')[0]?.text).toContain('vault');

    // Press the control button (at z = -3.2, facing +Z) from just north of it.
    d.place(16, -1.6, Math.PI);
    d.input({ yaw: Math.PI, pitch: -0.25, buttons: BUTTON_USE });
    expect(match.scenario.objectiveState('obj_button')).toBe('complete');
    expect(match.scenario.objectiveState('obj_breach')).toBe('active');

    // Pick up the grenade launcher in the armory.
    d.place(18.5, 8.5, 0);
    d.run(3);
    expect(me.weapons.has(6)).toBe(true);

    // Lob grenades at the reinforced wall from the antechamber.
    d.place(22, 3, 0);
    me.health = 100;
    const yaw = Math.atan2(28 - 22, 0 - 3);
    for (let i = 0; i < 4 && match.scenario.destructibleAlive('wall_vault'); i++) {
      d.input({ yaw, pitch: 0.02, buttons: BUTTON_FIRE, weapon: 6 });
      d.run(70, { yaw, pitch: 0.02, weapon: 6 });
    }
    expect(match.scenario.destructibleAlive('wall_vault')).toBe(false);
    expect(d.of('cue').map((c) => c.cue)).toContain('alarm');
    expect(match.scenario.objectiveState('obj_vault')).toBe('active');

    d.place(33, 0, 0);
    d.run(5);
    expect(match.scenario.objectiveState('obj_vault')).toBe('complete');
    d.run(125);
    expect(d.of('round_end')).toEqual([{ e: 'round_end', winner: me.slot }]);
  });

  it('runs a full bot match on the vault without errors, and the traps do their job', () => {
    const loaded = loadMap(readFileSync(new URL('../../../maps/m3_vault.json', import.meta.url), 'utf8'));
    if (!loaded.ok) throw new Error('vault map invalid');
    const match = new Match(loaded.map, undefined, 11);
    for (let i = 0; i < 6; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    const events: GameEvent[] = [];
    for (let t = 0; t < 60 * 60; t++) events.push(...match.step());
    expect(events.filter((e) => e.e === 'trap').length).toBeGreaterThan(20);
    expect(events.filter((e) => e.e === 'kill').length).toBeGreaterThan(0);
  });
});
