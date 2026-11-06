// The navigation audit (nav/audit.ts), ledge-drop links, polygons inside solid boxes, stand-ins and the way onto the
// navmesh (docs/BOTS.md, "Navigation audit").
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, PhysicsWorld, TICK_RATE, applyBrush, blockBoxes, buildMapGeometry, initPhysics, mapPads, newTerrain, padLandings, terrainHeightAt, type MapDocument } from '../src/index.ts';
import { Match, NavWorld, auditNavigation, dropOptions, initNavigation, mapNavigation, solidsRay, validateMapNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** Open yard tiles, 3 × 3 (x and z from -4 to 20), floor at 0. */
const yard = (spawns: [number, number, number][]): MapDocument => {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) tiles.push({ id: `y${x}${z}`, tile: 'core.yard', x, y: z, z: 0, rotation: 0 });
  return makeMap(tiles, spawns);
};
const block = (id: string, center: [number, number], size: [number, number, number], y = 0, behaviour = 'solid') =>
  ({ id, kind: 'block', position: [center[0], y, center[1]], size, yaw: 0, material: null, behaviour, trigger: 'step', delaySeconds: 0.8, respawnSeconds: null, health: 100 }) as MapDocument['entities'][number];
/** A plaza `h` m up (spawn points on it) round a 12 m pit down to the yard's floor. */
const pitMap = (h: number): MapDocument => {
  const map = yard([
    [-1, h, 8],
    [17, h, 8],
  ]);
  map.entities.push(block('west', [-1, 8], [6, h, 24]), block('east', [17, 8], [6, h, 24]), block('north', [8, -1], [12, h, 6]), block('south', [8, 17], [12, h, 6]));
  return map;
};

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
    const map = pitMap(3);
    const official = validateMapNavigation(map, true);
    const trap = official.issues.find((i) => i.code === 'nav.trap');
    expect(trap?.severity).toBe('error');
    expect(trap?.message).toMatch(/nobody gets out/);
    expect(official.audit.traps.length).toBe(1);
    expect(official.audit.traps[0]!.dropOut).toBeNull();
    expect(validateMapNavigation(map, false).issues.find((i) => i.code === 'nav.trap')?.severity).toBe('warning');
  });

  it('counts no fall through a railing a standing body can’t pass (Bunker Cross’s galleries: rails the rays slip between)', () => {
    // The 3 m pit, railed round: rails 0.1, 1.4 and 2.6 m over the plaza, at its edges. Rays at a step's, a knee's and a
    // head's height pass between them; a body doesn't. Nobody falls in: the pit is no trap (an island).
    const map = pitMap(3);
    const rail = (id: string, x: number, z: number, w: number, d: number) => [0.1, 1.4, 2.6].map((h, k) => block(`${id}${k}`, [x, z], [w, 0.1, d], 3 + h));
    map.entities.push(...rail('rw', 2.05, 8, 0.1, 12), ...rail('re', 13.95, 8, 0.1, 12), ...rail('rn', 8, 2.05, 12, 0.1), ...rail('rs', 8, 13.95, 12, 0.1));
    const official = validateMapNavigation(map, true);
    expect(official.issues.filter((i) => i.code === 'nav.trap')).toEqual([]);
    expect(official.audit.traps).toEqual([]);
    expect(official.audit.patches.length).toBeGreaterThan(0);
  });

  it('counts a pit 1.3 m deep as none: bots hop out of it, the legs tucked up (Undergate Transit’s track beds); 1.8 m deep is one', () => {
    expect(validateMapNavigation(pitMap(1.3), true).issues.filter((i) => i.code === 'nav.trap')).toEqual([]);
    expect(validateMapNavigation(pitMap(1.8), true).issues.find((i) => i.code === 'nav.trap')?.severity).toBe('error');
    // And a bot put into the 1.3 m pit does get out (a jump alone clears about 1.1 m).
    const match = new Match(pitMap(1.3), { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, timeLimitSeconds: 0 }, 2);
    for (let i = 0; i < 2; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i]!, BOT_DIFFICULTIES.normal, true);
    match.step();
    const bot = match.combatants()[0]!;
    bot.move = { pos: { x: 8, y: 0, z: 8 }, velY: 0, grounded: true };
    let out = -1;
    for (let t = 0; t < TICK_RATE * 15 && out < 0; t++) {
      match.step();
      if (bot.alive && bot.move.grounded && bot.move.pos.y > 1.2) out = t;
    }
    match.destroy();
    expect(out).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it('lands a jump pad’s flight on the scenario’s solids, as the navmesh has them (Erosion’s corner pads onto its crumbling decks)', () => {
    const map = yard([[0, 0, 0]]);
    map.entities.push(block('deck', [10, 10], [6, 0.5, 6], 3, 'crumble'), { id: 'pad', kind: 'pad', position: [4, 0, 10], yaw: Math.PI / 2, power: 13, push: 7 } as MapDocument['entities'][number]);
    // The level alone (the scenario adds the deck after the navmesh): the flight comes down on the floor under it.
    const physics = new PhysicsWorld(buildMapGeometry(map), null);
    expect(padLandings(mapPads(map.entities), physics)[0]!.end.y).toBeLessThan(0.5);
    expect(padLandings(mapPads(map.entities), physics, 1, [], solidsRay(blockBoxes(map, true)))[0]!.end.y).toBeCloseTo(3.5, 1);
    physics.free();
    // As the match builds it: a route up onto the deck by the pad.
    const built = mapNavigation(map);
    expect(built.nav.findPath({ x: 1, y: 0, z: 10 }, { x: 10, y: 3.5, z: 10 })).not.toBeNull();
    built.physics.free();
    built.nav.destroy();
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
