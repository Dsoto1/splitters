// Slim room doors (owner, 2026-11-15: "the doors to each room … are a bit wide, we should move the frame in"): the dorm
// pieces' Room doors option (map format v42, set piece options) and the passage bots walk through (sim/passages.ts).
// Each room's 2 m doorway is brought in to 1.2 m (the piers either side 0.4 m wider, or a jamb in a thin wall), with a 1.2 m Oak Door in it. 1.2 m is narrower
// than the navmesh keeps open (it stays 0.8 m off walls), so the open slim door is a passage: a walking link through
// its frame. Here: the option swaps exactly the door parts; the doorway is 1.2 m; without the links the rooms are cut
// off and with them every open room is reached in every turn; a body that follows the route's corners walks in and
// out; and bots in a match, ordered to hold in a room, get there.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_BOT_PROFILES,
  DEFAULT_RULES,
  PASSAGE_REACH,
  PhysicsWorld,
  TICK_RATE,
  buildMapGeometry,
  builtInSetPieces,
  emptyInput,
  getKitFamily,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newTerrain,
  orderSay,
  passageLinks,
  placementOptions,
  rotateXZ,
  serializeMap,
  setPieceParts,
  stepMovement,
  validateMap,
  type MapDocument,
  type MoveState,
  type Rotation,
  type SetPiecePlacement,
  type Vec3,
} from '../src/index.ts';
import { BotFiller, Match, NavWorld, initNavigation, mapNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const library = builtInSetPieces();
const ROTATIONS = [0, 1, 2, 3] as Rotation[];
const SLIM = { options: { roomDoors: 'slim' } };
const DOOR_PIECES = ['setpiece.dorm_bay', 'setpiece.dorm_bay_closed', 'setpiece.dorm_corner_bay', 'setpiece.dorm_entry_bay', 'setpiece.dorm_office_bay', 'setpiece.hall_centre'];

function mapOf(placements: SetPiecePlacement[], spawns: [number, number, number][] = [[-160, 0, -160]], ground = true): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], spawns);
  const r = loadMap(serializeMap({ ...map, setPieces: placements, terrain: ground ? newTerrain(200, 2, [0, 0], 'grass') : null }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}
const bay = (rotation: Rotation, overrides?: SetPiecePlacement['overrides'], piece = 'setpiece.dorm_bay'): SetPiecePlacement => ({ id: 'bay0', piece, x: 0, y: 0, z: 0, rotation, mirror: false, pack: 'collegiate', ...(overrides ? { overrides } : {}) });
const at = (x: number, y: number, z: number, rotation: Rotation): Vec3 => {
  const [rx, rz] = rotateXZ(x, z, rotation);
  return { x: rx, y, z: rz };
};
function navOf(map: MapDocument, links = true): NavWorld {
  const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
  const all = navLinks(map.entities, physics);
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), links ? all : all.filter((l) => !passageLinks(map.entities).some((p) => p.start.x === l.start.x && p.start.z === l.start.z)));
}
const miss = (nav: NavWorld, a: Vec3, b: Vec3): number => {
  const path = nav.findPath(a, b);
  return path ? Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.z - b.z) : Infinity;
};
/** The middle of a Dorm Bay room's floor, by its door's x (−2 or 2) and side. */
const room = (cx: number, north: boolean): [number, number, number] => [cx, 0, north ? 8.3 : -0.3];

describe('the slim door props', () => {
  it('are the Oak Door 1.2 m wide: shut and ajar collide as the frame, open collides as its leaf and is a passage', () => {
    expect(getKitFamily('kit.door.oak_slim_open')?.passage).toEqual({ frame: -0.52 });
    expect(getKitFamily('kit.door.oak_slim')?.passage).toBeUndefined();
    expect(getKitFamily('kit.door.oak_slim_ajar')?.passage).toBeUndefined();
    // The wide open door is a passage too since its leaf collides (doorLeaves.test.ts).
    expect(getKitFamily('kit.door.oak_open')?.passage).toEqual({ frame: -0.92 });
  });
  it('a passage is a link each way through the frame, PASSAGE_REACH either side, turned with the prop', () => {
    const links = passageLinks([{ kind: 'prop', model: 'kit.door.oak_slim_open', position: [10, 4, 20], yaw: Math.PI / 2, scale: 1 }]);
    expect(links).toHaveLength(2);
    // Yaw a quarter: the prop's z is the map's x; the frame 0.52 m behind its centre.
    expect(links[0]!.start.x).toBeCloseTo(10 - 0.52 - PASSAGE_REACH, 5);
    expect(links[0]!.end.x).toBeCloseTo(10 - 0.52 + PASSAGE_REACH, 5);
    expect(links[0]!.start.z).toBeCloseTo(20, 5);
    expect(links[0]!.start.y).toBe(4);
    expect(links[1]).toEqual({ start: links[0]!.end, end: links[0]!.start });
    expect(passageLinks([{ kind: 'prop', model: 'kit.door.oak', position: [0, 0, 0], yaw: 0, scale: 1 }])).toHaveLength(0);
  });
});

describe('the Room doors option', () => {
  it('each dorm piece offers it, wide first (every placement made before it is unchanged)', () => {
    for (const id of DOOR_PIECES) {
      const def = library.pieces.get(id)!;
      expect(def.options?.find((o) => o.name === 'roomDoors')?.choices.map((c) => c.value), id).toEqual(['wide', 'slim']);
      expect(placementOptions({}, def).roomDoors).toBe('wide');
      expect(placementOptions({ overrides: { options: { roomDoors: 'nonsense' } } }, def).roomDoors).toBe('wide');
      const as = (o?: SetPiecePlacement['overrides']) => setPieceParts({ id: 'p0001', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, ...(o ? { overrides: o } : {}) }, def, 'core.prototype', library);
      // Unset and "wide" are the same piece, part for part.
      expect(JSON.stringify(as({ options: { roomDoors: 'wide' } }))).toBe(JSON.stringify(as()));
      const wide = as();
      const slim = as(SLIM);
      const doors = (es: typeof wide.entities, slimmed: boolean) => es.filter((e) => e.kind === 'prop' && e.model.startsWith('kit.door.oak') && e.model.includes('_slim') === slimmed || (e.kind === 'prop' && e.model === 'kit.door.oak' && !slimmed));
      const n = doors(wide.entities, false).length;
      expect(n, id).toBeGreaterThan(0);
      expect(doors(slim.entities, false), id).toHaveLength(0);
      expect(doors(slim.entities, true), id).toHaveLength(n);
      // The closet-deep walls' piers each side of a doorway are swapped for ones 0.4 m wider (as many blocks); the
      // office bay's thin walls get a jamb either side of each door instead.
      expect(slim.entities.filter((e) => e.kind === 'block').length - wide.entities.filter((e) => e.kind === 'block').length, id).toBe(id === 'setpiece.dorm_office_bay' ? 2 * n : 0);
      // The tiles and everything else stay as they are.
      expect(JSON.stringify(slim.tiles)).toBe(JSON.stringify(wide.tiles));
    }
  });
  it('a choice the piece does not offer is a warning, and plays as the first', () => {
    const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }]);
    const issues = validateMap({ ...map, setPieces: [bay(0, { options: { roomDoors: 'narrow', doors: 'x' } })] }, undefined, library);
    expect(issues.filter((i) => i.code === 'setpiece.option')).toHaveLength(1);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});

describe('slim doorways', () => {
  it('are 1.2 m between the jambs, and the closed rooms stay shut', () => {
    const map = mapOf([bay(0, SLIM)]);
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    // Across the doorway in the wall's depth (z 5.5), 1 m up: from its middle, the jamb 0.6 m on the latch side; on the
    // hinge side the open leaf, which collides (doorLeaves.test.ts), 0.454 m (a 1.05 m way through for a 0.8 m body).
    for (const cx of [-2, 2]) {
      const mid = { x: cx, y: 1, z: 5.5 };
      expect(physics.raycastWorld(mid, { x: 1, y: 0, z: 0 }, 2)).toBeCloseTo(0.454, 2);
      expect(physics.raycastWorld(mid, { x: -1, y: 0, z: 0 }, 2)).toBeCloseTo(0.6, 2);
    }
  });

  it('cut the rooms off the navmesh on their own; the passages join every open room again, in every turn', { timeout: 120_000 }, () => {
    for (const rotation of ROTATIONS) {
      const map = mapOf([bay(rotation, SLIM)]);
      const bare = navOf(map, false);
      const nav = navOf(map);
      const hall = at(0, 0, 4, rotation);
      for (const cx of [-2, 2]) {
        for (const north of [true, false]) {
          const r = at(...room(cx, north), rotation);
          expect(miss(bare, hall, r), `turn ${rotation}: room ${cx} ${north ? 'N' : 'S'} without the passages`).toBeGreaterThan(2);
          expect(miss(nav, hall, r), `turn ${rotation}: into room ${cx} ${north ? 'N' : 'S'}`).toBeLessThan(1.2);
          expect(miss(nav, r, hall), `turn ${rotation}: out of room ${cx} ${north ? 'N' : 'S'}`).toBeLessThan(1.2);
        }
      }
      bare.destroy();
      nav.destroy();
    }
    // The closed bay: its shut rooms (north) stay shut; its open ones are reached.
    const closed = mapOf([bay(0, SLIM, 'setpiece.dorm_bay_closed')]);
    const nav = navOf(closed);
    for (const cx of [-2, 2]) {
      expect(miss(nav, { x: 0, y: 0, z: 4 }, { x: cx, y: 0, z: 8.3 })).toBeGreaterThan(2);
      expect(miss(nav, { x: 0, y: 0, z: 4 }, { x: cx, y: 0, z: -0.3 })).toBeLessThan(1.2);
    }
    nav.destroy();
  });

  it("a body that follows a route's corners walks through: hall to room and back, in every turn", { timeout: 120_000 }, () => {
    for (const rotation of ROTATIONS) {
      // (No terrain under the floor: a capsule walking exactly along one of its grid lines, x = 2 here, snags on the
      // triangles' seam under the floor slab.)
      const map = mapOf([bay(rotation, SLIM)], undefined, false);
      const nav = navOf(map);
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
      const collider = physics.createPlayerCollider();
      // From the hall's west end (its mouth), into the north-east room, on to the window, and out to the hall's east end.
      const stops = [at(-3.4, 0, 4, rotation), at(2, 0, 8.6, rotation), at(2.2, 0, 10.4, rotation), at(3.4, 0, 4, rotation), at(-2, 0, -0.6, rotation), at(-3.4, 0, 4, rotation)];
      let s: MoveState = { pos: { ...stops[0]!, y: 0.02 }, velY: 0, grounded: true };
      let tick = 0;
      for (let k = 1; k < stops.length; k++) {
        const path = nav.findPath(s.pos, stops[k]!)!;
        expect(path, `turn ${rotation}: a route to stop ${k}`).toBeTruthy();
        let i = 1;
        // As bots do (brain.ts): a corner is reached within 0.45 m; head for the next.
        for (let t = 0; t < TICK_RATE * 20 && i < path.length; t++) {
          while (i < path.length && Math.hypot(s.pos.x - path[i]!.x, s.pos.z - path[i]!.z) < 0.45) i++;
          const c = path[Math.min(i, path.length - 1)]!;
          s = stepMovement(physics, collider, s, { ...emptyInput(tick++), forward: 1, yaw: Math.atan2(c.x - s.pos.x, c.z - s.pos.z) });
        }
        expect(Math.hypot(s.pos.x - stops[k]!.x, s.pos.z - stops[k]!.z), `turn ${rotation}: walked to stop ${k}, at ${s.pos.x.toFixed(2)},${s.pos.z.toFixed(2)} corner ${i}/${path.length} path ${JSON.stringify(path.map((c) => [+c.x.toFixed(2), +c.z.toFixed(2)]))}`).toBeLessThan(0.8);
      }
      physics.removeCollider(collider);
      nav.destroy();
    }
  });

  it('bots in a match, ordered to hold in a room, walk in through the slim door', { timeout: 240_000 }, () => {
    // Two slim bays end to end (cells 0 and 1), the yard round them; one team's squad ordered to hold in the first
    // bay's north-west room. Enemies removed, so nothing draws them off.
    const spawns: [number, number, number][] = [[-14, 0, 4], [-14, 0, 6], [-14, 0, 2], [26, 0, 4], [26, 0, 6], [26, 0, 2]];
    const map = mapOf([{ ...bay(0, SLIM), id: 'bay_a' }, { ...bay(0, SLIM), id: 'bay_b', x: 1 }], spawns);
    const match = new Match({ ...map, metadata: { ...map.metadata, supportedModes: ['core.tdm'] } }, { ...DEFAULT_RULES['core.tdm'], teamSizes: [4, 4], fireteams: 4, scoreLimit: 0, timeLimitSeconds: 0 }, 3);
    const filler = new BotFiller(match);
    const me = filler.join('me', undefined, 8)!;
    for (let i = 0; i < 7; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    for (let i = 0; i < TICK_RATE * 10 && match.phase !== 'playing'; i++) match.step();
    for (const c of match.combatants()) if (c.faction !== me.faction) match.remove(c.slot);
    const spot = { x: -2, y: 0, z: 9 };
    me.move = { pos: { ...spot }, velY: 0, grounded: true };
    match.queueInputs(me.slot, [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, say: orderSay('hold') }]);
    match.step();
    // The leader steps out to the hall's far end and waits there.
    const away = { x: 12, y: 0, z: 4 };
    for (let i = 0; i < TICK_RATE * 30; i++) {
      me.move = { pos: { ...away }, velY: 0, grounded: true };
      match.step();
    }
    const squad = match.fireteams!.squadOf(me.slot)!;
    const bots = squad.members.filter((m) => m !== me.slot).map((m) => match.slots[m]!.move.pos);
    // In the room: past its wall (z over 5.92) and between its partitions (x −4 to 0).
    const inside = bots.filter((p) => p.z > 5.95 && p.x > -4 && p.x < 0).length;
    expect(bots.length).toBeGreaterThan(0);
    expect(inside, `bots in the room: ${JSON.stringify(bots.map((p) => [+p.x.toFixed(1), +p.z.toFixed(1)]))}`).toBeGreaterThan(0);
  });

  it("on St. John's, every open slim door (Smythe Hall, Scott Johnston / Hazelwood) is walked through from a spawn", { timeout: 240_000 }, () => {
    const r = loadMap(readFileSync(new URL('../../../maps/st_johns.json', import.meta.url), 'utf8'));
    if (!r.ok) throw new Error('st_johns failed to load');
    const map = r.map;
    const { nav } = mapNavigation(map);
    const spawn = map.entities.find((e) => e.kind === 'spawn' && e.id === 'spawn_2902')!;
    const from = { x: spawn.position[0], y: spawn.position[1], z: spawn.position[2] };
    const links = passageLinks(map.entities);
    // Each door gives two links (in and out): both ends of each, from the spawn.
    expect(links.length).toBeGreaterThanOrEqual(2 * 40);
    const far = links.filter((l) => miss(nav, from, l.end) > 1.2).map((l) => [+l.end.x.toFixed(1), +l.end.y.toFixed(1), +l.end.z.toFixed(1)]);
    expect(far, 'passage ends no route reaches').toEqual([]);
    nav.destroy();
  });
});
