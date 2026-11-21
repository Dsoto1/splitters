// Tileset 11's two tiles (docs/map-briefs/urban/URBAN_PLAN.md, step E), both data tiles in content/tiles/core.json:
// the Fire Escape (one cell, one level, stacked a storey at a time) and the Scaffold Bay (one cell, two levels).
// Bots path up and down them in every turn, players climb them and are stopped by their rails, shots pass between
// the rail bars and the tubes and stop on treads and planks, and nothing floats.
import { beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld, buildMapGeometry, coreCatalog, emptyInput, getStylePack, initPhysics, loadMap, mapTerrainMesh, navLinks, newTerrain, rotateXZ, serializeMap, stepMovement, type LocalBox, type MapDocument, type MoveState, type Rotation, type Vec3 } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

type Tiles = MapDocument['classicStructure']['tiles'];
const ROTATIONS = [0, 1, 2, 3] as Rotation[];
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;

/** The tiles on flat terrain at 0 (neither tile has a floor of its own: they stand on the ground or on what is below). */
function mapOf(tiles: Tiles): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -8, y: -8, z: 0, rotation: 0 }, ...tiles], [[-64, 0, -64]]);
  const r = loadMap(serializeMap({ ...map, terrain: newTerrain(120, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}
const physicsOf = (map: MapDocument) => new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
function navOf(map: MapDocument): NavWorld {
  const physics = physicsOf(map);
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
}
function walk(physics: PhysicsWorld, from: Vec3, yaw: number, ticks: number): MoveState {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
  for (let i = 0; i < ticks; i++) s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw });
  physics.removeCollider(collider);
  return s;
}
function miss(nav: NavWorld, a: Vec3, b: Vec3): number {
  const path = nav.findPath(a, b);
  return path ? Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.y - b.y, path.at(-1)!.z - b.z) : Infinity;
}
/** A point of the tile's own frame (cell centre on its floor = 0, 0, 0; +z north) where a turn puts it. */
const turned = ([x, y, z]: readonly [number, number, number], rotation: Rotation): Vec3 => {
  const [rx, rz] = rotateXZ(x, z, rotation);
  return { x: rx, y, z: rz };
};
const yawOf = (yaw: number, rotation: Rotation) => yaw + (rotation * Math.PI) / 2;
describe('the Fire Escape and the Scaffold Bay are data tiles in the Urban pack', () => {
  it('both come from content/tiles/core.json, under Vertical, and Style Pack 14 lists them', () => {
    const fire = coreCatalog.get('core.fire_escape')!;
    const scaffold = coreCatalog.get('core.scaffold_bay')!;
    expect(fire.cells).toEqual([[0, 0, 0]]);
    expect(scaffold.cells).toEqual([[0, 0, 0], [0, 0, 1]]);
    for (const def of [fire, scaffold]) {
      expect(def.category).toBe('Vertical');
      expect(def.floors).toEqual([]);
      expect(getStylePack('urban')!.tiles).toContain(def.id);
    }
  });

  it('nothing floats: every solid part bears on the ground through the parts it touches, and each sloped rail ends on one', () => {
    for (const id of ['core.fire_escape', 'core.scaffold_bay']) {
      const def = coreCatalog.get(id)!;
      const parts = [...(def.extraFloors ?? []), ...(def.solids ?? [])].filter((b) => b.kind !== 'trim');
      const level = parts.filter((b) => !b.roll && !b.pitch);
      const touch = (a: LocalBox, b: LocalBox) => [0, 1, 2].every((i) => a.min[i]! <= b.max[i]! + 0.011 && b.min[i]! <= a.max[i]! + 0.011);
      const held = new Set(level.filter((b) => b.min[1] <= 0.011));
      for (let grew = true; grew; ) {
        grew = false;
        for (const b of level) if (!held.has(b) && [...held].some((h) => touch(b, h))) grew = held.add(b).size > 0;
      }
      expect(level.filter((b) => !held.has(b)).map((b) => [b.min, b.max]), `${id}: parts in the air`).toEqual([]);
      // A sloped rail (a bar turned about its middle): both ends within a hand of a standing part.
      const sloped = parts.filter((b) => b.roll || b.pitch);
      expect(sloped.length, id).toBeGreaterThan(0);
      for (const b of sloped) {
        const c = [0, 1, 2].map((i) => (b.min[i]! + b.max[i]!) / 2);
        const half = (b.max[0] - b.min[0]) / 2;
        for (const s of [-1, 1]) {
          const end = [c[0]! + s * half * Math.cos(b.roll!), c[1]! + s * half * Math.sin(b.roll!), c[2]!];
          const near = level.some((p) => [0, 1, 2].every((i) => end[i]! >= p.min[i]! - 0.15 && end[i]! <= p.max[i]! + 0.15));
          expect(near, `${id}: a rail end at ${end.map((v) => v.toFixed(2))} meets nothing`).toBe(true);
        }
      }
    }
  });
});

describe('the Fire Escape', () => {
  const one = (rotation: Rotation) => mapOf([{ id: 'fire', tile: 'core.fire_escape', x: 0, y: 0, z: 0, rotation }]);

  it('bots path from the ground to the top landing and back, in every turn', { timeout: 120_000 }, () => {
    for (const rotation of ROTATIONS) {
      const nav = navOf(one(rotation));
      const at = (p: [number, number, number]) => turned(p, rotation);
      expect(miss(nav, at([0, 0, 6]), at([2.8, 2, -1.6])), `turned ${rotation}: up to the half landing`).toBeLessThan(1.2);
      expect(miss(nav, at([0, 0, 6]), at([-2.8, 4, -1.6])), `turned ${rotation}: up to the top`).toBeLessThan(1.2);
      expect(miss(nav, at([-2.8, 4, -1.6]), at([0, 0, 6])), `turned ${rotation}: back down`).toBeLessThan(1.2);
      nav.destroy();
    }
  });

  it('a player climbs both flights; the landings\' rails stop a walk off their ends', () => {
    for (const rotation of ROTATIONS) {
      const physics = physicsOf(one(rotation));
      const at = (p: [number, number, number]) => turned(p, rotation);
      // East up the outer lane: stopped by the half landing's east rail, 2 m up.
      const up = walk(physics, at([-3.5, 0.02, 0]), yawOf(EAST, rotation), 140);
      const half = at([3.5, 2, 0]);
      expect(Math.hypot(up.pos.x - half.x, up.pos.z - half.z), `turned ${rotation}: ${up.pos.x.toFixed(2)}, ${up.pos.y.toFixed(2)}, ${up.pos.z.toFixed(2)}`).toBeLessThan(0.3);
      expect(up.pos.y).toBeCloseTo(2, 1);
      // West up the lane by the wall: stopped by the top landing's west rail, 4 m up.
      const top = walk(physics, at([3, 2.02, -2.6]), yawOf(WEST, rotation), 150);
      const pad = at([-3.5, 4, -2.6]);
      expect(Math.hypot(top.pos.x - pad.x, top.pos.z - pad.z), `turned ${rotation}: ${top.pos.x.toFixed(2)}, ${top.pos.y.toFixed(2)}, ${top.pos.z.toFixed(2)}`).toBeLessThan(0.3);
      expect(top.pos.y).toBeCloseTo(4, 1);
      // North off the top landing: its rail holds.
      const north = walk(physics, at([-3, 4.02, -2]), yawOf(NORTH, rotation), 90);
      expect(north.pos.y, `turned ${rotation}: held by the north rail`).toBeCloseTo(4, 1);
      physics.free();
    }
  });

  it('stacks: two up a two-storey building reach its upper floor and the roof line, and bots come back down', { timeout: 120_000 }, () => {
    // Rooms south of the stair on both levels; the upper room's north side is an arch (6.5 m: the landing is the west 2.4 m
    // of the wall, which a centred door misses) onto the first top landing.
    const map = mapOf([
      { id: 'room0', tile: 'core.room', x: 0, y: -1, z: 0, rotation: 0 },
      { id: 'room1', tile: 'core.room', x: 0, y: -1, z: 1, rotation: 0, edges: { '0,0,0:N': 'arch' } },
      { id: 'fire0', tile: 'core.fire_escape', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'fire1', tile: 'core.fire_escape', x: 0, y: 0, z: 1, rotation: 0 },
    ]);
    const nav = navOf(map);
    const street = { x: 0, y: 0, z: 6 };
    expect(miss(nav, street, { x: 0, y: 4, z: -8 }), 'into the upper room by its arch').toBeLessThan(1.2);
    expect(miss(nav, street, { x: -2.8, y: 8, z: -1.6 }), 'to the second top landing').toBeLessThan(1.2);
    expect(miss(nav, { x: -2.8, y: 8, z: -1.6 }, street), 'and down').toBeLessThan(1.2);
    nav.destroy();
    const physics = physicsOf(map);
    // The second stair starts on the first one's landing: east from it climbs to the next half landing.
    const up = walk(physics, { x: -3.5, y: 4.02, z: 0 }, EAST, 140);
    expect(up.pos.x).toBeGreaterThan(3.2);
    expect(up.pos.y).toBeCloseTo(6, 1);
    physics.free();
  });

  it('shots pass between the rail bars and stop on a landing', () => {
    const physics = physicsOf(one(0));
    // Across the half landing 0.75 m above it (between the bars at 0.5 and 1 m), from north to the wall side.
    expect(physics.raycastWorld({ x: 3, y: 2.75, z: 3 }, { x: 0, y: 0, z: -1 }, 6.5)).toBeNull();
    // Along a bar: stopped.
    expect(physics.raycastWorld({ x: 3, y: 2.97, z: 3 }, { x: 0, y: 0, z: -1 }, 6.5)).not.toBeNull();
    // Up at the landing from below: stopped.
    expect(physics.raycastWorld({ x: 3, y: 0.5, z: -2 }, { x: 0, y: 1, z: 0 }, 3)).toBeCloseTo(1.4, 1);
    physics.free();
  });
});

describe('the Scaffold Bay', () => {
  const one = (rotation: Rotation) => mapOf([{ id: 'scaf', tile: 'core.scaffold_bay', x: 0, y: 0, z: 0, rotation }]);

  it('bots path from the ground to both decks and back, and under the lower deck, in every turn', { timeout: 120_000 }, () => {
    for (const rotation of ROTATIONS) {
      const nav = navOf(one(rotation));
      const at = (p: [number, number, number]) => turned(p, rotation);
      const street = at([0, 0, 6]);
      expect(miss(nav, street, at([-2, 2, -2.8])), `turned ${rotation}: to the lower deck`).toBeLessThan(1.2);
      expect(miss(nav, street, at([2, 4, -2.8])), `turned ${rotation}: to the upper deck`).toBeLessThan(1.2);
      expect(miss(nav, at([2, 4, -2.8]), street), `turned ${rotation}: back down`).toBeLessThan(1.2);
      expect(miss(nav, at([-2, 2, -2.8]), at([2, 4, -2.8])), `turned ${rotation}: deck to deck`).toBeLessThan(1.2);
      nav.destroy();
    }
  });

  it('a player climbs to each deck and walks it; the rails hold at the stair\'s landings', () => {
    for (const rotation of ROTATIONS) {
      const physics = physicsOf(one(rotation));
      const at = (p: [number, number, number]) => turned(p, rotation);
      const up = walk(physics, at([-3.5, 0.02, 0]), yawOf(EAST, rotation), 140);
      expect(up.pos.y, `turned ${rotation}: the first landing`).toBeCloseTo(2, 1);
      const top = walk(physics, at([3, 2.02, 2.4]), yawOf(WEST, rotation), 150);
      expect(top.pos.y, `turned ${rotation}: the second landing`).toBeCloseTo(4, 1);
      const held = at([-3.5, 4, 2.4]);
      expect(Math.hypot(top.pos.x - held.x, top.pos.z - held.z), `turned ${rotation}: held by the west rail`).toBeLessThan(0.3);
      // Along the lower deck under the upper one, end to end (1.9 m of headroom).
      const along = walk(physics, at([3, 2.02, -2.6]), yawOf(WEST, rotation), 60);
      expect(along.pos.y).toBeCloseTo(2, 1);
      expect(Math.hypot(along.pos.x - at([3, 2, -2.6]).x, along.pos.z - at([3, 2, -2.6]).z)).toBeGreaterThan(4);
      physics.free();
    }
  });

  it('bays join end to end: the decks of a row are one walk', { timeout: 120_000 }, () => {
    const map = mapOf([{ id: 'bay_a', tile: 'core.scaffold_bay', x: 0, y: 0, z: 0, rotation: 0 }, { id: 'bay_b', tile: 'core.scaffold_bay', x: 1, y: 0, z: 0, rotation: 0 }]);
    const nav = navOf(map);
    expect(miss(nav, { x: -2, y: 4, z: -2.8 }, { x: 10, y: 4, z: -2.8 })).toBeLessThan(1.2);
    expect(miss(nav, { x: -2, y: 2, z: -2.8 }, { x: 10, y: 2, z: -2.8 })).toBeLessThan(1.2);
    nav.destroy();
  });

  it('shots pass between the tubes and rails and stop on the planks', () => {
    const physics = physicsOf(one(0));
    // Through the bay under the lower deck, between the standards (x 2.05 and 3.95), north to south.
    expect(physics.raycastWorld({ x: 3, y: 1, z: 3.9 }, { x: 0, y: 0, z: -1 }, 7.8)).toBeNull();
    // Over the upper deck between its rail's bars.
    expect(physics.raycastWorld({ x: 2, y: 4.75, z: 3.9 }, { x: 0, y: 0, z: -1 }, 7.8)).toBeNull();
    // Up at a deck from below.
    expect(physics.raycastWorld({ x: 2, y: 0.5, z: -3 }, { x: 0, y: 1, z: 0 }, 3)).toBeCloseTo(1.4, 1);
    // At a standard.
    expect(physics.raycastWorld({ x: 0, y: 1, z: 3.9 }, { x: 0, y: 0, z: -1 }, 7.8)).not.toBeNull();
    physics.free();
  });
});
