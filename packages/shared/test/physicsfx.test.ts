import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_BLOOD,
  EditHistory,
  EffectsWorld,
  applyBrush,
  buildMapGeometry,
  floatingProps,
  groundNormal,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  moveEntitiesCommand,
  newTerrain,
  propFootprint,
  propTilts,
  scatterProps,
  serializeMap,
  settlePropsCommand,
  settledPropY,
  terrainHeightAt,
  validateMap,
  MAX_PROP_TILT,
  type MapDocument,
  type PropEntity,
} from '../src/index.ts';
import { loadArena, makeMap } from './helpers.ts';

beforeAll(() => initPhysics());

/** A 64 m terrain with a 6 m hill in the middle. */
function hillMap(): MapDocument {
  let t = newTerrain(64, 2);
  t = applyBrush(t, { brush: 'raise', x: 0, z: 0, radius: 14, strength: 6 });
  return { ...makeMap([], [[-24, 0, -24]]), terrain: t };
}

const prop = (id: string, model: string, x: number, y: number, z: number): PropEntity => ({ id, kind: 'prop', model, position: [x, y, z], yaw: 0.4, scale: 1, solid: true, tint: null });

describe('props on slopes', () => {
  it('beds a prop at the lowest ground under its footprint, so no corner floats', () => {
    const t = hillMap().terrain!;
    const e = prop('p', 'prop.rock_large', 7, 0, 2);
    const y = settledPropY(t, e)!;
    for (const [x, z] of propFootprint(e)) expect(y).toBeLessThanOrEqual(terrainHeightAt(t, x, z)! + 1e-6);
    // ...and not far below the lowest corner.
    const lowest = Math.min(...propFootprint(e).map(([x, z]) => terrainHeightAt(t, x, z)!));
    expect(lowest - y).toBeLessThan(0.05);
    expect(settledPropY(t, prop('off', 'prop.log', 99, 0, 0))).toBeNull();
  });

  it('leans natural props with the ground, at most 25°, and keeps trees upright', () => {
    const t = hillMap().terrain!;
    const n = groundNormal(t, 8, 0)!;
    expect(n.x).toBeGreaterThan(0.05);
    expect(Math.acos(n.y)).toBeLessThanOrEqual(MAX_PROP_TILT + 1e-6);
    expect(groundNormal(t, -28, -28)!.y).toBeCloseTo(1, 5);
    expect(propTilts('prop.log')).toBe(true);
    expect(propTilts('prop.rock_large')).toBe(true);
    expect(propTilts('prop.barrel')).toBe(false);
  });

  it('finds floating props, settles them in one undo step, and leaves supported ones alone', () => {
    const map = hillMap();
    const t = map.terrain!;
    const ground = settledPropY(t, prop('a', 'prop.log', 8, 0, 0))!;
    map.entities.push(
      prop('floater', 'prop.log', 8, ground + 0.8, 0),
      prop('ok', 'prop.log', -20, settledPropY(t, prop('x', 'prop.log', -20, 0, 6))!, 6),
      prop('base', 'prop.crate_small', -10, 0, -10),
      // Stacked on the crate: held up, not floating.
      prop('stacked', 'prop.crate_small', -10, 0.6, -10),
    );
    map.entities.find((e) => e.id === 'base')!.position[1] = 0;
    (map.entities.find((e) => e.id === 'base') as PropEntity).yaw = 0;
    (map.entities.find((e) => e.id === 'stacked') as PropEntity).yaw = 0;
    expect(floatingProps(map).map((f) => f.id)).toEqual(['floater']);
    expect(validateMap(map).some((i) => i.code === 'prop.floating' && i.targetId === 'floater')).toBe(true);

    const history = new EditHistory(map);
    history.execute('Settle', settlePropsCommand(map));
    const settled = history.doc.entities.find((e) => e.id === 'floater')!;
    expect(settled.position[1]).toBeCloseTo(ground, 2);
    expect(history.doc.entities.find((e) => e.id === 'stacked')!.position[1]).toBe(0.6);
    expect(floatingProps(history.doc)).toEqual([]);
    history.undo();
    expect(history.doc.entities.find((e) => e.id === 'floater')!.position[1]).toBeCloseTo(ground + 0.8, 5);
  });

  it('keeps a grounded prop on the ground when it is dragged up or down the hill', () => {
    const map = hillMap();
    const t = map.terrain!;
    map.entities.push(prop('log', 'prop.log', -20, settledPropY(t, prop('x', 'prop.log', -20, 0, 0))!, 0));
    const history = new EditHistory(map);
    history.execute('Move', moveEntitiesCommand(history.doc, ['log'], 14, 0, 0));
    const moved = history.doc.entities.find((e) => e.id === 'log')!;
    expect(moved.position[1]).toBeCloseTo(settledPropY(t, moved as PropEntity)!, 5);
    expect(moved.position[1]).toBeGreaterThan(0.5);
  });

  it('scatters plants bedded into the slope', () => {
    const map = hillMap();
    const placed = scatterProps(map, 'rocks', 8, 0, 4, 0, 7);
    expect(placed.length).toBeGreaterThan(0);
    for (const p of placed) {
      const lowest = Math.min(...propFootprint({ ...p, id: 'x' } as PropEntity).map(([x, z]) => terrainHeightAt(map.terrain!, x, z)!));
      expect(p.position[1]).toBeLessThanOrEqual(lowest + 0.01);
    }
  });
});

describe('effects physics', () => {
  it('drops a body onto the level and the terrain, and casts rays at static ground only', () => {
    const map = hillMap();
    const world = new EffectsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    const body = world.addBody({ kind: 'box', half: { x: 0.2, y: 0.2, z: 0.2 } }, { x: -20, y: 5, z: -20 }, { x: 0, y: 0, z: 0, w: 1 }, 'debris');
    for (let i = 0; i < 180; i++) world.step(1 / 60);
    const y = body.translation().y;
    expect(y).toBeGreaterThan(terrainHeightAt(map.terrain!, -20, -20)!);
    expect(y).toBeLessThan(terrainHeightAt(map.terrain!, -20, -20)! + 0.5);
    const hit = world.raycast({ x: 0, y: 20, z: 0 }, { x: 0, y: -1, z: 0 }, 40)!;
    expect(20 - hit.dist).toBeCloseTo(terrainHeightAt(map.terrain!, 0, 0)!, 0);
    expect(hit.normal.y).toBeGreaterThan(0.9);
    world.free();
  });

  it('holds jointed ragdoll parts together as they fall', () => {
    const world = new EffectsWorld(buildMapGeometry(hillMap()), mapTerrainMesh(hillMap()));
    const a = world.addBody({ kind: 'capsule', halfHeight: 0.3, radius: 0.12 }, { x: -20, y: 4, z: -20 }, { x: 0, y: 0, z: 0, w: 1 }, 'ragdoll', { vel: { x: 3, y: 0, z: 0 } });
    const b = world.addBody({ kind: 'capsule', halfHeight: 0.2, radius: 0.06 }, { x: -20, y: 3.2, z: -20 }, { x: 0, y: 0, z: 0, w: 1 }, 'ragdoll');
    world.ballJoint(a, b, { x: 0, y: -0.42, z: 0 }, { x: 0, y: 0.26, z: 0 });
    for (let i = 0; i < 120; i++) world.step(1 / 60);
    const pa = a.translation();
    const pb = b.translation();
    expect(Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z)).toBeLessThan(1);
    expect(pa.x).toBeGreaterThan(-20);
    world.free();
  });
});

describe('blood settings', () => {
  it('defaults to light red and round-trips a custom colour', () => {
    const map = loadArena();
    expect(map.blood).toBeNull();
    expect(DEFAULT_BLOOD).toEqual({ color: '#8a0b0b', amount: 'light' });
    const green = { ...map, blood: { color: '#3f9b1f', amount: 'heavy' as const } };
    const loaded = loadMap(serializeMap(green));
    expect(loaded.ok && loaded.map.blood).toEqual({ color: '#3f9b1f', amount: 'heavy' });
    const bad = loadMap(serializeMap({ ...map, blood: { color: 'green', amount: 'light' } }));
    expect(bad.ok).toBe(false);
  });
});
