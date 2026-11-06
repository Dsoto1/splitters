// The navigation audit (nav/audit.ts), ledge-drop links, polygons inside solid boxes, stand-ins and the way onto the
// navmesh (docs/BOTS.md, "Navigation audit").
import { beforeAll, describe, expect, it } from 'vitest';
import { applyBrush, buildMapGeometry, initPhysics, newTerrain, terrainHeightAt, type MapDocument } from '../src/index.ts';
import { NavWorld, auditNavigation, dropOptions, initNavigation, mapNavigation, validateMapNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Open yard tiles, 3 × 3 (x and z from -4 to 20), floor at 0. */
const yard = (spawns: [number, number, number][]): MapDocument => {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `y${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  return makeMap(tiles, spawns);
};
const block = (id: string, center: [number, number], size: [number, number, number], y = 0) =>
  ({ id, kind: 'block', position: [center[0], y, center[1]], size, yaw: 0, material: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: null, health: 100 }) as MapDocument['entities'][number];

describe('navigation audit', () => {
  it('leaves out the floor Recast finds inside a solid box taller than a body (Eagle Spires: one at every rock block)', () => {
    const map = yard([[0, 0, 0]]);
    map.entities.push(block('rock', [10, 10], [5, 2.5, 5]));
    // Without the fix (no physics at build): a polygon inside the rock.
    const plain = NavWorld.build(buildMapGeometry(map));
    expect(plain.nearestPoly({ x: 10, y: 0.2, z: 10 }, { x: 0.5, y: 0.5, z: 0.5 })).not.toBeNull();
    plain.destroy();
    const built = mapNavigation(map);
    expect(built.nav.insideSolid).toBeGreaterThan(0);
    const inside = built.nav.nearestPoly({ x: 10, y: 0.2, z: 10 }, { x: 0.5, y: 0.5, z: 0.5 });
    expect(inside === null || Math.max(Math.abs(inside.point.x - 10), Math.abs(inside.point.z - 10)) >= 2.5).toBe(true);
    // Its top is still walkable (a roof of its own, nobody gets onto: an island, not a trap).
    expect(built.nav.nearestPoly({ x: 10, y: 2.6, z: 10 }, { x: 0.5, y: 0.5, z: 0.5 })).not.toBeNull();
    built.physics.free();
    built.nav.destroy();
  });

  it('keeps open hillside: a polygon is judged at its surface (the detail mesh), not its corners’ average height', () => {
    // A 64 m terrain with a 6 m hill, its top levelled and a knoll on it: polygons over the rim whose corners average
    // well under the ground at their middle (the first check left out most of Frost Basin's and Iron Maw's slopes as
    // "inside" the ground; here two polygons).
    let t = newTerrain(64, 2);
    t = applyBrush(t, { brush: 'raise', x: 0, z: 0, radius: 18, strength: 6 });
    t = applyBrush(t, { brush: 'flatten', x: 0, z: 0, radius: 10.8, strength: 1, target: 4.2 });
    t = applyBrush(t, { brush: 'raise', x: 9, z: -5.4, radius: 7.2, strength: 2.4 });
    const map: MapDocument = { ...makeMap([], [[-24, 0, -24]]), terrain: t };
    const built = mapNavigation(map);
    expect(built.nav.insideSolid).toBe(0);
    // The hilltop routes from the spawn.
    expect(built.nav.findPath({ x: -24, y: 0, z: -24 }, { x: 0, y: terrainHeightAt(t, 0, 0)!, z: 0 })).not.toBeNull();
    built.physics.free();
    built.nav.destroy();
  });

  it('gives a ledge with no way down a drop link: a spawn point on it gets out (one way), and nothing is cut off', () => {
    const map = yard([
      [0, 0, 0],
      [10, 2, 10],
    ]);
    map.entities.push(block('slab', [10, 10], [7, 2, 7]));
    // Without drop links: the spawn point on the slab is cut off.
    const geometry = buildMapGeometry(map);
    const built = mapNavigation(map);
    const opts = { ...dropOptions(map, built.physics, geometry, built.phys), official: true };
    const bare = NavWorld.build(geometry);
    expect(auditNavigation(map, bare, built.physics, opts).issues.map((i) => i.code)).toContain('nav.disconnected');
    bare.destroy();
    // With them (as the match builds it): a way down, not up.
    expect(built.nav.drops).toBeGreaterThan(0);
    expect(built.nav.findPath({ x: 10, y: 2, z: 10 }, { x: 0, y: 0, z: 0 })).not.toBeNull();
    expect(built.nav.findPath({ x: 0, y: 0, z: 0 }, { x: 10, y: 2, z: 10 })).toBeNull();
    expect(auditNavigation(map, built.nav, built.physics, opts).issues).toEqual([]);
    // A goal on the slab, from the ground: as near as a route gets (beside it), remembered.
    const si = built.nav.standIn({ x: 0, y: 0, z: 0 }, { x: 10, y: 2, z: 10 });
    expect(si?.exact).toBe(false);
    expect(si!.pos.y).toBeLessThan(0.5);
    expect(Math.hypot(si!.pos.x - 10, si!.pos.z - 10)).toBeLessThan(6);
    built.physics.free();
    built.nav.destroy();
  });

  it('gives a knoll with sides too steep to stand on a way down: the body slides to the foot (Frost Basin’s ice ridge)', () => {
    // A 9 m knoll, its top levelled, a spawn point on it; its flanks are steeper than anyone can stand on, so a fall off
    // the top lands on no navmesh: the drop link goes to where the body slides to.
    let t = newTerrain(48, 1);
    t = applyBrush(t, { brush: 'raise', x: 0, z: 0, radius: 8, strength: 10 });
    t = applyBrush(t, { brush: 'flatten', x: 0, z: 0, radius: 3, strength: 1, target: terrainHeightAt(t, 0, 0)! - 1 });
    const top = { x: 0, y: terrainHeightAt(t, 0, 0)!, z: 0 };
    const map: MapDocument = { ...makeMap([], [[-16, 0, -16], [top.x, top.y, top.z]]), terrain: t };
    const built = mapNavigation(map);
    expect(built.nav.drops).toBeGreaterThan(0);
    expect(built.nav.findPath(top, { x: -16, y: 0, z: -16 })).not.toBeNull();
    expect(validateMapNavigation(map, true).issues).toEqual([]);
    built.physics.free();
    built.nav.destroy();
  });

  it('reports a pit bots fall into and nobody gets out of: an error on an official map, a warning in MapMaker', () => {
    // A plaza 3 m up (spawn points on it) round a 5 m pit down to the yard's floor.
    const map = yard([
      [-1, 3, 8],
      [17, 3, 8],
    ]);
    map.entities.push(block('west', [-1, 8], [6, 3, 24]), block('east', [17, 8], [6, 3, 24]), block('north', [8, -1], [12, 3, 6]), block('south', [8, 17], [12, 3, 6]));
    const official = validateMapNavigation(map, true);
    const trap = official.issues.find((i) => i.code === 'nav.trap');
    expect(trap?.severity).toBe('error');
    expect(trap?.message).toMatch(/nobody gets out/);
    expect(official.audit.traps.length).toBe(1);
    expect(official.audit.traps[0]!.dropOut).toBeNull();
    expect(validateMapNavigation(map, false).issues.find((i) => i.code === 'nav.trap')?.severity).toBe('warning');
  });

  it('walks a bot off the navmesh onto it: the nearest place, level or below', () => {
    const map = yard([[0, 0, 0]]);
    // A post too narrow for the navmesh to cover its top.
    map.entities.push(block('post', [10, 10], [1, 4, 1]));
    const built = mapNavigation(map);
    expect(built.nav.wayOnto({ x: 0, y: 0, z: 0 })).toBeNull();
    const down = built.nav.wayOnto({ x: 10, y: 4, z: 10 });
    expect(down).not.toBeNull();
    expect(down!.y).toBeLessThan(0.5);
    built.physics.free();
    built.nav.destroy();
  });
});
