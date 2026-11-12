import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, emptyInput, environmentShapes, initPhysics, loadMap, stepMovement, type MapDocument, type MapEntity, type MoveState } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { isBreakableProp, propBoxes } from '../src/map/geometry.ts';
import { resourceBudgetIssues } from '../src/map/budgets.ts';
import { breakableOf, propBreakLook, propHealth } from '../src/sim/scenarioDefs.ts';
import { getProp } from '../src/content/props.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const EAST = Math.PI / 2;
type Prop = Extract<MapEntity, { kind: 'prop' }>;
const prop = (id: string, model: string, x: number, extra: Partial<Prop> = {}): MapEntity => ({ id, kind: 'prop', model, position: [x, 0, 0], yaw: 0, scale: 1, solid: true, tint: null, ...extra });

function room(entities: MapEntity[], destruction = false): MapDocument {
  const map = makeMap([{ id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[-3, 0, 0]]);
  map.entities.push(...entities);
  if (destruction) map.metadata.destruction = true;
  return map;
}

/** A match on the map with a player at x = -2 facing the thing at x = 2; `shoot` fires at it until it goes, or 12 bursts have passed. */
function fight(map: MapDocument): { match: Match; shoot: (id: string) => boolean } {
  const loaded = loadMap(map);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  const match = new Match(loaded.map, undefined, 3);
  const me = match.addHuman('me')!;
  let seq = 0;
  const step = (buttons: number) => {
    match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: EAST, pitch: -Math.atan2(1.1, 4), buttons }]);
    match.step();
  };
  const shoot = (id: string): boolean => {
    step(0);
    me.move = { pos: { x: -2, y: 0, z: 0 }, velY: 0, grounded: true };
    me.yaw = EAST;
    for (let i = 0; i < 12 && match.scenario.destructibleAlive(id); i++) {
      step(BUTTON_FIRE);
      for (let k = 0; k < 30; k++) step(0);
    }
    return !match.scenario.destructibleAlive(id);
  };
  return { match, shoot };
}

/** Fire at the thing at x = 2 until it goes, or 12 bursts have passed. */
const shootAt = (map: MapDocument, id: string): boolean => fight(map).shoot(id);

describe('destructible environment (map format v36)', () => {
  // A bathtub: solid, and nothing the catalogue lets you break.
  const TUB = 'prop.bathtub';

  it('the catalogue decides on a map without the switch', () => {
    expect(getProp(TUB)?.breakable).toBeUndefined();
    const map = room([prop('tub_1', TUB, 2), prop('table_1', 'prop.table', 2, { position: [2, 0, 3] })]);
    expect(map.entities.filter((e) => isBreakableProp(e)).map((e) => e.id)).toEqual(['table_1']);
    expect(propBoxes(map).map((b) => b.sourceId)).toContain('tub_1');
    expect(propBoxes(map, true).map((b) => b.sourceId)).not.toContain('tub_1');
  });

  it('a prop with its own health breaks at that much damage, on any map', () => {
    const map = room([prop('tub_1', TUB, 2, { health: 20 })]);
    expect(isBreakableProp(map.entities.find((e) => e.id === 'tub_1')!)).toBe(true);
    expect(propBoxes(map).map((b) => b.sourceId)).not.toContain('tub_1');
    expect(shootAt(map, 'tub_1')).toBe(true);
  });

  it('a prop marked unbreakable never breaks, whatever the catalogue or the map says', () => {
    const map = room([prop('table_1', 'prop.table', 2, { unbreakable: true }), prop('tub_1', TUB, 2, { position: [2, 0, 3], unbreakable: true })], true);
    expect(map.entities.some((e) => isBreakableProp(e, true))).toBe(false);
    expect(propBoxes(map).map((b) => b.sourceId).sort()).toEqual(['table_1', 'tub_1']);
  });

  it('with the map\'s switch every solid prop breaks, but natural rocks and walk-through props', () => {
    const map = room([prop('tub_1', TUB, 2), prop('rock_1', 'prop.rock_large', 2, { position: [2, 0, 3] }), prop('ghost', TUB, 2, { position: [2, 0, -3], solid: false })], true);
    const breakable = map.entities.filter((e) => isBreakableProp(e, true)).map((e) => e.id);
    expect(breakable).toEqual(['tub_1']);
    expect(propBoxes(map, true).map((b) => b.sourceId)).toContain('tub_1');
    expect(propBoxes(map).map((b) => b.sourceId)).toContain('rock_1');
  });

  it('a prop the catalogue gives no health takes its size and material\'s; it breaks under fire', () => {
    const def = getProp(TUB)!;
    const h = propHealth(TUB, def.collision!, 1);
    expect(h).toBeGreaterThanOrEqual(5);
    expect(h % 5).toBe(0);
    // Bigger is tougher; a small wooden thing goes quickly, a big concrete one does not.
    expect(propHealth(TUB, def.collision!, 2)).toBeGreaterThan(h);
    expect(propHealth('prop.chair', [0.4, 0.95, 0.4], 1)).toBeLessThan(100);
    expect(propHealth('prop.concrete_block', [2, 2, 2], 1)).toBeGreaterThan(1000);
    expect(shootAt(room([prop('chair', 'prop.plant_small', 2), prop('seat_1', 'prop.bar_stool', 2, { position: [2, 0, 3] }), prop('tub_1', TUB, 2, { health: 30 })], true), 'tub_1')).toBe(true);
  });

  it('the breakable budget counts a destruction map\'s props', () => {
    const many = Array.from({ length: 1030 }, (_, i) => prop(`tub_${i}`, TUB, 2, { position: [(i % 40) * 0.1, 0, Math.floor(i / 40) * 0.1] }));
    expect(resourceBudgetIssues(room(many)).some((i) => i.code === 'budget.destructibles')).toBe(false);
    expect(resourceBudgetIssues(room(many, true)).some((i) => i.code === 'budget.destructibles')).toBe(true);
  });

  it('a v35 map opens unchanged: no switch, no prop health', () => {
    const map = room([prop('tub_1', TUB, 2)]);
    const old = { ...map, version: 35 } as MapDocument;
    const loaded = loadMap(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.map.metadata.destruction).toBeUndefined();
    expect(loaded.map.entities.find((e) => e.id === 'tub_1')).not.toHaveProperty('health');
  });
});

describe('a fallen log (env.deadwood.log) breaks only when the map maker gives it health', () => {
  const LOG = 'env.deadwood.log';
  const ids = (shapes: { sourceId: string }[]) => [...new Set(shapes.map((s) => s.sourceId))];
  // A line through the log, low over the floor (the log lies along z at x = 2, twice its built size: about 1.1 m high).
  const A = { x: 0, y: 0.5, z: 0 };
  const B = { x: 3.2, y: 0.5, z: 0 };

  it('without health it is solid cover, even where everything breaks', () => {
    const map = room([prop('log_1', LOG, 2, { scale: 2 })], true);
    expect(isBreakableProp(map.entities.find((e) => e.id === 'log_1')!, true)).toBe(false);
    expect(ids(environmentShapes(map))).toEqual(['log_1']);
    expect(environmentShapes(map, true)).toEqual([]);
    expect(propBoxes(map, true)).toEqual([]);
    const { match, shoot } = fight(map);
    expect(match.scenario.destructibleAlive('log_1')).toBeUndefined();
    shoot('log_1');
    expect(match.physics.shotLine(A, B)).toBe(false);
  });

  it('with health it takes damage, breaks, lets shots and bodies through, and is back at the next round', () => {
    const map = room([prop('log_1', LOG, 2, { scale: 2, health: 60 })]);
    expect(isBreakableProp(map.entities.find((e) => e.id === 'log_1')!)).toBe(true);
    // Not static any more: the scenario owns its hull; navigation sees its bounds with the other breakable solids.
    expect(environmentShapes(map)).toEqual([]);
    expect(ids(environmentShapes(map, true))).toEqual(['log_1']);
    expect(propBoxes(map)).toEqual([]);
    const [box] = propBoxes(map, true);
    expect(box?.sourceId).toBe('log_1');
    expect(box!.max[0] - box!.min[0]).toBeCloseTo(0.531 * 2, 2);
    expect(box!.max[2] - box!.min[2]).toBeCloseTo(2.229 * 2, 2);
    const b = breakableOf(map.entities.find((e) => e.id === 'log_1')!)!;
    expect(b.health).toBe(60);
    expect(b.shapes?.[0]?.kind).toBe('hull');
    expect(b.blocksPaths).toBe(false);

    const { match, shoot } = fight(map);
    const body = match.physics.createPlayerCollider();
    // A second of walking east from x = 0.5: into the log, or over where it lay.
    const walk = () => {
      let m: MoveState = { pos: { x: 0.5, y: 0, z: 0 }, velY: 0, grounded: true };
      for (let k = 0; k < 60; k++) m = stepMovement(match.physics, body, m, { ...emptyInput(k), forward: 1, yaw: EAST });
      return m.pos.x;
    };
    expect(match.scenario.destructibleAlive('log_1')).toBe(true);
    expect(match.physics.shotLine(A, B)).toBe(false);
    expect(walk()).toBeLessThan(1.6);
    expect(shoot('log_1')).toBe(true);
    expect(match.physics.shotLine(A, B)).toBe(true);
    expect(walk()).toBeGreaterThan(2);
    match.scenario.reset();
    expect(match.scenario.destructibleAlive('log_1')).toBe(true);
    expect(match.physics.shotLine(A, B)).toBe(false);
    expect(walk()).toBeLessThan(1.6);
  });

  it('unbreakable wins; a rock or a boulder given health still never breaks', () => {
    const map = room([prop('log_1', LOG, 2, { health: 60, unbreakable: true }), prop('rock_1', 'env.rock.boulder_round', 2, { position: [2, 0, 3], health: 60 }), prop('rock_2', 'env.rock.pebbles', 2, { position: [2, 0, -3], health: 60 })], true);
    expect(map.entities.filter((e) => isBreakableProp(e, true))).toEqual([]);
    expect(map.entities.filter((e) => breakableOf(e, undefined, true))).toEqual([]);
    expect(ids(environmentShapes(map))).toContain('log_1');
    expect(ids(environmentShapes(map))).toContain('rock_1');
    expect(propBoxes(map, true)).toEqual([]);
  });

  it('counts in the breakable budget on any map', () => {
    const logs = (health?: number) => Array.from({ length: 1030 }, (_, i) => prop(`log_${i}`, LOG, 2, { position: [(i % 40) * 0.1, 0, Math.floor(i / 40) * 0.1], ...(health ? { health } : {}) }));
    expect(resourceBudgetIssues(room(logs(), true)).some((i) => i.code === 'budget.destructibles')).toBe(false);
    expect(resourceBudgetIssues(room(logs(60))).some((i) => i.code === 'budget.destructibles')).toBe(true);
  });
});

describe('how a broken prop looks and sounds', () => {
  it('keeps a catalogue debris colour and picks one by material otherwise', () => {
    expect(propBreakLook('prop.crate', '#123456').debris).toBe('#123456');
    expect(propBreakLook('prop.crate').debris).toMatch(/^#[0-9a-f]{6}$/);
    expect(['break.crate', 'break.wall', 'break.glass']).toContain(propBreakLook('prop.crate').sound);
  });
});

describe('Breakyard, the test map (maps/breakyard.json)', () => {
  it('everything solid in the yard breaks, but the container marked unbreakable', async () => {
    const { readFileSync } = await import('node:fs');
    const r = loadMap(JSON.parse(readFileSync(new URL('../../../maps/breakyard.json', import.meta.url), 'utf8')));
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const map = r.map;
    expect(map.metadata.destruction).toBe(true);
    const solid = map.entities.filter((e) => e.kind === 'prop' && e.solid && getProp(e.model)?.collision);
    const kept = solid.filter((e) => !isBreakableProp(e, true));
    expect(solid.length).toBeGreaterThan(40);
    expect(kept.map((e) => (e.kind === 'prop' ? [e.model, e.unbreakable] : null))).toEqual([['kit.container.shipping', true]]);
    expect(solid.some((e) => e.kind === 'prop' && e.health === 500)).toBe(true);
  });
});
