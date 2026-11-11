import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, initPhysics, loadMap, type MapDocument, type MapEntity } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { isBreakableProp, propBoxes } from '../src/map/geometry.ts';
import { resourceBudgetIssues } from '../src/map/budgets.ts';
import { propBreakLook, propHealth } from '../src/sim/scenarioDefs.ts';
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

/** Fire at the thing at x = 2 until it goes, or 12 bursts have passed. */
function shootAt(map: MapDocument, id: string): boolean {
  const loaded = loadMap(map);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  const match = new Match(loaded.map, undefined, 3);
  const me = match.addHuman('me')!;
  let seq = 0;
  const step = (buttons: number) => {
    match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: EAST, pitch: -Math.atan2(1.1, 4), buttons }]);
    match.step();
  };
  step(0);
  me.move = { pos: { x: -2, y: 0, z: 0 }, velY: 0, grounded: true };
  me.yaw = EAST;
  for (let i = 0; i < 12 && match.scenario.destructibleAlive(id); i++) {
    step(BUTTON_FIRE);
    for (let k = 0; k < 30; k++) step(0);
  }
  return !match.scenario.destructibleAlive(id);
}

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

describe('how a broken prop looks and sounds', () => {
  it('keeps a catalogue debris colour and picks one by material otherwise', () => {
    expect(propBreakLook('prop.crate', '#123456').debris).toBe('#123456');
    expect(propBreakLook('prop.crate').debris).toMatch(/^#[0-9a-f]{6}$/);
    expect(['break.crate', 'break.wall', 'break.glass']).toContain(propBreakLook('prop.crate').sound);
  });
});
