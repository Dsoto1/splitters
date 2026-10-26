import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation } from '../src/nav/index.ts';
import { EditHistory, PhysicsWorld, applyBrush, buildMapGeometry, initPhysics, loadMap, mapTerrainMesh, newTerrain, paintSlopes, stepMovement, terrainHeightAt, terrainRaycast, validateMap, TERRAIN_MATERIALS, type MapDocument } from '../src/index.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A 64 m terrain with a 6 m hill in the middle and nothing else. */
function hillMap(): MapDocument {
  let t = newTerrain(64, 2);
  t = applyBrush(t, { brush: 'raise', x: 0, z: 0, radius: 14, strength: 6 });
  const map = makeMap([], [[-24, 0, -24]]);
  return { ...map, terrain: t };
}

describe('terrain', () => {
  it('interpolates heights on the surface and is empty off it', () => {
    const t = hillMap().terrain!;
    expect(terrainHeightAt(t, 0, 0)).toBeCloseTo(6, 1);
    expect(terrainHeightAt(t, -30, -30)).toBeCloseTo(0, 5);
    expect(terrainHeightAt(t, 40, 0)).toBeNull();
    const h = terrainHeightAt(t, 5, 3)!;
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(6);
  });

  it('brushes raise, lower, flatten, smooth and paint', () => {
    let t = newTerrain(32, 2);
    t = applyBrush(t, { brush: 'raise', x: 0, z: 0, radius: 6, strength: 2 });
    expect(terrainHeightAt(t, 0, 0)).toBeCloseTo(2, 2);
    const lowered = applyBrush(t, { brush: 'lower', x: 0, z: 0, radius: 6, strength: 3 });
    expect(terrainHeightAt(lowered, 0, 0)).toBeCloseTo(-1, 2);
    const flat = applyBrush(t, { brush: 'flatten', x: 0, z: 0, radius: 8, strength: 1, target: 0.5 });
    expect(terrainHeightAt(flat, 0, 0)).toBeCloseTo(0.5, 2);
    const smooth = applyBrush(t, { brush: 'smooth', x: 0, z: 0, radius: 8, strength: 1 });
    expect(terrainHeightAt(smooth, 0, 0)!).toBeLessThan(2);
    const painted = applyBrush(t, { brush: 'paint', x: 0, z: 0, radius: 3, strength: 1, material: 'dirt' });
    expect(painted.materials.filter((m) => m === TERRAIN_MATERIALS.indexOf('dirt')).length).toBeGreaterThanOrEqual(4);
    // The input terrain is never changed.
    expect(terrainHeightAt(t, 0, 0)).toBeCloseTo(2, 2);
  });

  it('paints steep slopes as stone', () => {
    let t = newTerrain(32, 2);
    t = applyBrush(t, { brush: 'raise', x: 0, z: 0, radius: 5, strength: 8 });
    const stone = TERRAIN_MATERIALS.indexOf('stone');
    expect(paintSlopes(t).materials.filter((m) => m === stone).length).toBeGreaterThan(0);
  });

  it('loads and validates as part of a map, spawns on terrain count as on the floor', () => {
    const map = hillMap();
    const r = loadMap(JSON.parse(JSON.stringify(map)));
    expect(r.ok).toBe(true);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    expect(validateMap(map).some((i) => i.code === 'spawn.no_floor')).toBe(false);
    const bad = { ...map, terrain: { ...map.terrain!, heights: [1, 2, 3] } };
    expect(loadMap(JSON.parse(JSON.stringify(bad))).ok).toBe(false);
  });

  it('players walk up the hill and the boundary keeps them in', () => {
    const map = hillMap();
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    const collider = physics.createPlayerCollider();
    let state = { pos: { x: -20, y: 1, z: 0 }, velY: 0, grounded: false };
    // Walk east (+x) up and over the hill.
    for (let i = 0; i < 560; i++) state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: Math.PI / 2, pitch: 0, buttons: 0 });
    expect(state.pos.x).toBeGreaterThan(14);
    expect(Math.abs(state.pos.y - terrainHeightAt(map.terrain!, state.pos.x, state.pos.z)!)).toBeLessThan(0.3);
    // Keep walking: the edge wall stops them at x = 32.
    for (let i = 0; i < 300; i++) state = stepMovement(physics, collider, state, { seq: i, forward: 1, right: 0, yaw: Math.PI / 2, pitch: 0, buttons: 0 });
    expect(state.pos.x).toBeLessThan(32);
    expect(state.pos.y).toBeGreaterThan(-1);
  });

  it('coarse moves (bots in big matches) follow the ground without colliding with the terrain mesh, and stop at slopes too steep to climb', () => {
    const map = hillMap();
    const t = map.terrain!;
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    const collider = physics.createPlayerCollider();
    const ground = (x: number, z: number) => terrainHeightAt(t, x, z);
    let feet = { x: -20, y: terrainHeightAt(t, -20, 0)!, z: 0 };
    // Up and over the hill, two ticks at a time like a far bot.
    for (let i = 0; i < 160; i++) {
      const r = physics.moveCharacter(collider, feet, { x: 0.2, y: -0.01, z: 0 }, undefined, undefined, ground);
      expect(r.grounded).toBe(true);
      feet = r.feet;
      expect(Math.abs(feet.y - terrainHeightAt(t, feet.x, feet.z)!)).toBeLessThan(0.02);
    }
    expect(feet.x).toBeGreaterThan(10);
    // A wall of earth: no walking up it.
    const steep = { ...map, terrain: applyBrush(newTerrain(64, 2), { brush: 'raise', x: 6, z: 0, radius: 3, strength: 12 }) };
    const wall = new PhysicsWorld(buildMapGeometry(steep), mapTerrainMesh(steep));
    const c2 = wall.createPlayerCollider();
    const g2 = (x: number, z: number) => terrainHeightAt(steep.terrain, x, z);
    let f2 = { x: -4, y: g2(-4, 0)!, z: 0 };
    for (let i = 0; i < 80; i++) f2 = wall.moveCharacter(c2, f2, { x: 0.2, y: -0.01, z: 0 }, undefined, undefined, g2).feet;
    expect(f2.y).toBeLessThan(4);
  });

  it('bots can path over it, and MapMaker can point at it', () => {
    const map = hillMap();
    const nav = NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map));
    const path = nav.findPath({ x: -24, y: 0, z: -24 }, { x: 0, y: 6, z: 0 });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]!.y).toBeGreaterThan(5);
    nav.destroy();
    const hit = terrainRaycast(map.terrain!, { x: 0, y: 40, z: -30 }, { x: 0, y: -0.8, z: 0.6 });
    expect(hit).not.toBeNull();
    expect(Math.abs(hit!.y - terrainHeightAt(map.terrain!, hit!.x, hit!.z)!)).toBeLessThan(0.05);
  });
  it('a brush stroke is one undoable edit', () => {
    const doc = makeMap([]);
    const h = new EditHistory(doc);
    const t = newTerrain(40);
    h.execute('Create terrain', { kind: 'setTerrain', before: null, after: t });
    const hill = applyBrush(applyBrush(t, { brush: 'raise', x: 0, z: 0, radius: 6, strength: 1 }), { brush: 'raise', x: 2, z: 0, radius: 6, strength: 1 });
    h.execute('Terrain raise', { kind: 'setTerrain', before: t, after: hill });
    expect(terrainHeightAt(h.doc.terrain!, 1, 0)).toBeGreaterThan(1.5);
    h.undo();
    expect(h.doc.terrain).toBe(t);
    h.undo();
    expect(h.doc.terrain).toBeNull();
  });
});
