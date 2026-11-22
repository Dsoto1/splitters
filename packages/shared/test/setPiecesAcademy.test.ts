// The academy family (content/setpieces/academy.json; docs/map-briefs/st_johns, step 1): the dormitory bays. Each
// piece is walked in every turn (and mirror, where it may be mirrored): bots path along the hall, into every open room
// and out again, up every stair; players climb the stairs; nobody gets into a shut room. Then the bays as they are
// meant to be used: end to end as one hall, on one floor, two and three, the stairs meeting floor to floor. What every
// piece shares (turns, packs, ids, the z-fight audit) is setPieceExpand.test.ts and setPiecePlay.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PLAYER,
  PhysicsWorld,
  buildMapDecor,
  buildMapGeometry,
  builtInSetPieces,
  checkSetPieceDefinition,
  edgeSegments,
  edgeTrimBoxes,
  emptyInput,
  getProp,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  mirrorWidth,
  navLinks,
  newTerrain,
  rotateXZ,
  serializeMap,
  setPieceParts,
  stepMovement,
  validateMap,
  windowPanes,
  type MapDocument,
  type MoveState,
  type Rotation,
  type SetPiecePlacement,
  type Vec3,
} from '../src/index.ts';
import { EDGE_SHAPES } from '../src/content/edgeStyles.generated.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const library = builtInSetPieces();
const ROTATIONS = [0, 1, 2, 3] as Rotation[];
type P3 = [number, number, number];

function mapOf(placements: SetPiecePlacement[], spacing = 2, raise = 0): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const r = loadMap(serializeMap({ ...map, setPieces: placements, terrain: { ...newTerrain(200, spacing, [0, 0], 'grass'), baseY: raise } }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}
const withPiece = (piece: string, rotation: Rotation, mirror = false, options?: Record<string, string>): MapDocument => mapOf([{ id: 'piece', piece, x: 0, y: 0, z: 0, rotation, mirror, pack: 'collegiate', ...(options ? { overrides: { options } } : {}) }]);

/** A point of the piece's own frame where the placement puts it. */
function place(p: Vec3, rotation: Rotation, mirror: boolean, W: number): Vec3 {
  const x = mirror ? W * 8 - p.x : p.x;
  const [rx, rz] = rotateXZ(x, p.z, rotation);
  return { x: rx, y: p.y, z: rz };
}
const placeYaw = (yaw: number, rotation: Rotation, mirror: boolean) => (mirror ? -yaw : yaw) + (rotation * Math.PI) / 2;

function navOf(map: MapDocument): NavWorld {
  const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
}
function walk(physics: PhysicsWorld, from: Vec3, yaw: number, ticks: number): MoveState {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
  for (let i = 0; i < ticks; i++) s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw });
  physics.removeCollider(collider);
  return s;
}
/** How far a bot's path from a to b ends from b (Infinity: no path). */
function miss(nav: NavWorld, a: Vec3, b: Vec3): number {
  const path = nav.findPath(a, b);
  return path ? Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.y - b.y, path.at(-1)!.z - b.z) : Infinity;
}
const v = ([x, y, z]: P3): Vec3 => ({ x, y, z });

/** The middle of a dorm room's open floor (between the desk and the bunk), by its door's x and its side of the hall. */
const roomFloor = (cx: number, north: boolean, y = 0): P3 => [cx + (north ? 0 : 0), y, north ? 8.3 : -0.3];
/** By a dorm room's window, past both desks, between the second desk and the bunk. */
const byWindow = (cx: number, north: boolean, y = 0): P3 => [cx + (north ? -0.25 : 0.25), y, north ? 10.6 : -2.6];

/**
 * Each piece's ways through, in its own frame (anchor cell's centre on its floor = 0, 0, 0; +z north; the hall's
 * middle is z = 4): every point is reached from the one before it. `shut`: places nobody reaches from `from`.
 */
const WALKS: Record<string, { chains: P3[][]; shut?: { from: P3; to: P3[] }; climbs?: { from: P3; yaw: number; ticks: number; up: number }[]; options?: string[] }> = {
  'setpiece.dorm_bay': {
    // Along the hall; into each of the four rooms, on between the second desk and the bunk to the window, and out again.
    chains: [[[-7, 0, 4], [0, 0, 4], [7, 0, 4]], ...[-2, 2].flatMap((cx) => [true, false].map((north): P3[] => [[0, 0, 4], roomFloor(cx, north), byWindow(cx, north), [0, 0, 4]]))],
  },
  'setpiece.dorm_bay_closed': {
    chains: [[[-7, 0, 4], [0, 0, 4], [7, 0, 4]], ...[-2, 2].map((cx): P3[] => [[0, 0, 4], roomFloor(cx, false), byWindow(cx, false), [0, 0, 4]])],
    shut: { from: [0, 0, 4], to: [roomFloor(-2, true), roomFloor(2, true)] },
  },
  'setpiece.stair_end_bay': {
    // In at the outside door, through the lobby to the hall's mouth; up the stairs to the landing room and the upper mouth.
    chains: [[[-7, 0, 8], [0, 0, 7], [3, 0, 4]], [[0, 0, 7], [-2.5, 4, 3], [0, 4, 8], [3, 4, 4]]],
    climbs: [{ from: [-1.75, 0.02, 2.6], yaw: Math.PI, ticks: 150, up: 2 }],
  },
  'setpiece.stair_end_bay_3': {
    chains: [[[-7, 0, 8], [0, 0, 7], [3, 0, 4]], [[0, 0, 7], [-2.5, 4, 3], [3, 4, 4], [2.5, 8, 5], [0, 8, 0], [3, 8, 4]]],
    climbs: [{ from: [-1.75, 0.02, 2.6], yaw: Math.PI, ticks: 150, up: 2 }, { from: [1.75, 4.02, 5.4], yaw: 0, ticks: 150, up: 2 }],
  },
  // St. John's step 7b: the three-floor bay with its stair on up to the roof (out north onto the roof over the lobby's
  // side, 12 m up), and on east along a hall's roof.
  'setpiece.stair_end_bay_roof': {
    chains: [[[-7, 0, 8], [0, 0, 7], [3, 0, 4]], [[0, 0, 7], [-2.5, 4, 3], [3, 4, 4], [2.5, 8, 5], [3, 8, 4], [-2.5, 12, 3], [0, 12, 8]]],
    climbs: [{ from: [-1.75, 0.02, 2.6], yaw: Math.PI, ticks: 150, up: 2 }, { from: [1.75, 4.02, 5.4], yaw: 0, ticks: 150, up: 2 }, { from: [-1.75, 8.02, 2.6], yaw: Math.PI, ticks: 150, up: 2 }],
  },
  // St. John's step 7b: the hall through on the ground floor (west mouth to east mouth past the stair's landing), down
  // the stair to the basement lobby and to the basement hall's mouth (beyond it is the basement it serves), the waiting room.
  'setpiece.stair_down_bay': {
    chains: [[[-7, 0, 4], [0, 0, 4.6], [7, 0, 4]], [[0, 0, 4.6], [0, 0, 9]], [[3, 0, 4], [-2.5, 0, 3], [0, -4, 7], [3, -4, 4]]],
    climbs: [{ from: [-1.75, -3.98, 2.6], yaw: Math.PI, ticks: 150, up: 2 }],
  },
  'setpiece.dorm_office_bay': {
    // Along the hall past the stair on both floors; up the stair; into the bathrooms and the office on both floors.
    chains: [
      [[-7, 0, 4], [0, 0, 4.6], [8, 0, 5.2], [16, 0, 4.6], [23, 0, 4]],
      [[0, 0, 4.6], [0, 0, 0], [16, 4, 0], [16, 4, 4.6], [8, 4, 5.2], [0, 4, 4.6]],
      ...[0, 4].flatMap((y) => [0, 8, 16].map((x): P3[] => [[8, y, 5.2], [x === 8 ? 6.6 : x, y, 8.6], [8, y, 5.2]])),
    ],
    shut: { from: [8, 0, 5.2], to: [[16, 0, 0]] },
    climbs: [{ from: [4.6, 0.3, 0], yaw: Math.PI / 2, ticks: 260, up: 3.5 }],
  },  // St. John's step 2 (Smythe Hall): the L's turn, a side entry, two end bays' doors, the corner tower.
  'setpiece.dorm_corner_bay': {
    // In at the west mouth, round the turn, out of the south mouth; into the north rooms, the east room, the lounge and the washroom.
    chains: [
      [[-7, 0, 4], [0, 0, 4], [4, 0, 4], [4, 0, -2], [4, 0, -7]],
      ...[-2, 2].map((cx): P3[] => [[0, 0, 4], roomFloor(cx, true), byWindow(cx, true), [0, 0, 4]]),
      [[4, 0, 0], [8.3, 0, -2], [10.6, 0, -1.75], [4, 0, 0]],
      [[4, 0, 0], [6.6, 0, 2], [8.7, 0, 8.5], [10.8, 0, 2.5], [4, 0, 4]],
      [[0, 0, 4], [-2, 0, 1.2], [-0.5, 0, -1.2], [0.6, 0, -1.4], [0, 0, 4]],
    ],
  },
  'setpiece.dorm_entry_bay': {
    // Along the hall; in from outside under the arch, through the entrance hall to the hall; into the two north rooms.
    chains: [[[-7, 0, 4], [0, 0, 4], [7, 0, 4]], [[0, 0, -7], [0, 0, -1], [0, 0, 4]], [[-2.5, 0, -2.6], [2.5, 0, 1.2]], ...[-2, 2].map((cx): P3[] => [[0, 0, 4], roomFloor(cx, true), byWindow(cx, true), [0, 0, 4]])],
  },
  'setpiece.stair_end_bay_arched': {
    chains: [[[-7, 0, 8], [0, 0, 7], [3, 0, 4]], [[0, 0, 7], [-2.5, 4, 3], [0, 4, 8], [3, 4, 4]]],
    climbs: [{ from: [-1.75, 0.02, 2.6], yaw: Math.PI, ticks: 150, up: 2 }],
  },
  'setpiece.stair_end_bay_bridge': {
    chains: [[[-7, 0, 8], [0, 0, 7], [3, 0, 4]], [[0, 0, 7], [-2.5, 4, 3], [0, 4, 8], [-3.2, 4, 8], [3, 4, 4]]],
    climbs: [{ from: [-1.75, 0.02, 2.6], yaw: Math.PI, ticks: 150, up: 2 }],
  },
  // St. John's step 3 (Scott Johnston / Hazelwood): the hall's centre on three floors, the round turret.
  'setpiece.hall_centre': {
    // Along the hall on every floor; in under the arch to the hall; up the first stair, then the second; into the north
    // rooms on every floor; the room over the first stair.
    chains: [
      ...[0, 4, 8].map((y): P3[] => [[-3.5, y, 4], [4, y, 4], [11.5, y, 4]]),
      [[8, 0, -14], [8, 0, -8], [8, 0, 0], [4, 0, 4]],
      [[0, 0, 0], [0, 4, 0], [4, 4, 4]],
      [[8, 4, 0], [8, 8, 0], [4, 8, 4], [0, 8, -8]],
      ...[0, 4, 8].flatMap((y) => [-2, 2, 6, 10].map((cx): P3[] => [[4, y, 4], [cx, y, 8.3], [4, y, 4]])),
    ],
  },
  // St. John's step 5 (Stangeland / Cord): the classroom bay. Along the hall (as far as the closed east end allows);
  // into each classroom at its back door, to the back by the windows, along the front aisle past the rows, and out.
  'setpiece.classroom_bay': {
    chains: [[[-7, 0, 4], [0, 0, 4], [3, 0, 4]], ...[true, false].map((north): P3[] => (north ? [[0, 0, 4], [2.4, 0, 6.8], [2.4, 0, 10.6], [-2.2, 0, 6.6], [0, 0, 4]] : [[0, 0, 4], [2.4, 0, 1.2], [2.4, 0, -2.6], [-2.2, 0, 1.4], [0, 0, 4]]))],
  },
  // St. John's step 5b: the court door. Along the hall; in under the arch to the hall; into the north classroom.
  'setpiece.classroom_entry_bay': {
    chains: [[[-7, 0, 4], [0, 0, 4], [7, 0, 4]], [[0, 0, -7], [0, 0, -1], [0, 0, 4]], [[0, 0, 4], [2.4, 0, 6.8], [2.4, 0, 10.6], [-2.2, 0, 6.6], [0, 0, 4]]],
  },
  // St. John's step 6 (Welles): the mess hall bay. Along its middle and both sides past the tables and benches.
  // (With each choice of its Long walls here; the step 7d options, which move the floor, the furniture and the west
  // end, have their own walks below: "a mess hall's kit".)
  'setpiece.refectory_bay': {
    chains: [[[-3, 0, 4], [3.5, 0, 4]], [[-2.6, 0, -2.4], [3.5, 0, -2.4]], [[-2.6, 0, 10.4], [3.5, 0, 10.4]]],
    options: ['walls'],
  },
  // St. John's step 7d: the serving bay (from the hall's side round the line's south end to the servers' side) and the
  // kitchen (from its doorway's side round the prep counter to the ranges), on a level floor and a sunk one.
  'setpiece.refectory_servery': {
    chains: [[[-3, 0, 4], [-2.5, 0, -1.5], [2.8, 0, -1.5], [2.8, 0, 8]]],
  },
  'setpiece.refectory_kitchen': {
    chains: [[[-2.4, 0, 4], [1.4, 0, 1], [1.4, 0, 9.5], [-2.4, 0, 9.5]]],
  },
  // The clock tower: in at its door and up the stair round its core to the belfry gallery along the south wall.
  'setpiece.clock_tower': {
    chains: [[[0, 0, -7], [0, 0, -2.2], [-2, 17.5, -2.2]]],
  },
  'setpiece.corner_turret_round': {
    // Round it on the ground (it is solid: nobody gets in).
    chains: [[[-3, 0, -3.5], [-3, 0, 3.5], [3.5, 0, 3.5]]],
    shut: { from: [-3, 0, -3.5], to: [[2.25, 0, -2.25]] },
  },
  'setpiece.corner_tower_square': {
    // In at the door, up the ladder to the lookout and down again.
    chains: [[[1.2, 0, -7], [1.2, 0, -2.6], [1.2, 11.8, -0.6], [1.2, 0, -7]]],
  },
};

describe('the dormitory bays: every way through, every room, every stair, in every turn', () => {
  it('lists every piece of the family', () => {
    expect([...library.pieces.values()].filter((d) => d.family === 'academy').map((d) => d.id).sort()).toEqual(Object.keys(WALKS).sort());
  });
  for (const [id, { chains, shut, climbs, options: walked }] of Object.entries(WALKS)) {
    it(`${id}: bots path along each chain; players climb; shut rooms stay shut`, { timeout: 240_000 }, () => {
      const def = library.pieces.get(id)!;
      const W = mirrorWidth(def);
      // (And with each choice of its options: the slim room doors, sim/passages.ts.)
      const choices: (Record<string, string> | undefined)[] = [undefined, ...(def.options ?? []).filter((o) => !walked || walked.includes(o.name)).flatMap((o) => o.choices.slice(1).map((c) => ({ [o.name]: c.value })))];
      for (const options of choices) for (const rotation of ROTATIONS) {
        for (const mirror of def.mirror === 'free' ? [false, true] : [false]) {
          const map = withPiece(id, rotation, mirror, options);
          const nav = navOf(map);
          const at = (p: P3) => place(v(p), rotation, mirror, W);
          const where = `${id} turned ${rotation}${mirror ? ' mirrored' : ''}${options ? ` ${JSON.stringify(options)}` : ''}`;
          for (const chain of chains) for (let i = 1; i < chain.length; i++) expect(miss(nav, at(chain[i - 1]!), at(chain[i]!)), `${where}: ${chain[i - 1]} → ${chain[i]}`).toBeLessThan(1.2);
          for (const to of shut?.to ?? []) expect(miss(nav, at(shut!.from), at(to)), `${where}: into the shut room at ${to}`).toBeGreaterThan(2);
          nav.destroy();
          const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
          for (const c of climbs ?? []) {
            const end = walk(physics, at(c.from), placeYaw(c.yaw, rotation, mirror), c.ticks);
            expect(end.pos.y - c.from[1], `${where}: climbed from ${c.from}`).toBeGreaterThan(c.up - 0.3);
          }
        }
      }
    });
  }
});

/** A hall along x from cell 0: a stair end, a dorm bay, the office bay, a closed dorm bay, a stair end (turned half round). */
function hall(floors: 1 | 2 | 3): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, z: number, rotation: Rotation = 0, y = 0): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate' });
  const out: SetPiecePlacement[] = [];
  const end = floors === 3 ? 'setpiece.stair_end_bay_3' : 'setpiece.stair_end_bay';
  if (floors > 1) out.push(at('end_w', end, 0, 0), at('end_e', end, 6, 0, 2, 1), at('office', 'setpiece.dorm_office_bay', 2, 0));
  for (let z = 0; z < floors; z++) {
    out.push(at(`dorm_a_${z}`, 'setpiece.dorm_bay', 1, z), at(`dorm_b_${z}`, 'setpiece.dorm_bay_closed', 5, z));
    if (floors === 1 || z === 2) for (const x of [2, 3, 4]) out.push(at(`dorm_c_${x}_${z}`, 'setpiece.dorm_bay', x, z));
  }
  return out;
}

describe('bays end to end make one hall', () => {
  it('on one floor: five bays, the hall straight through, every open room', { timeout: 120_000 }, () => {
    const nav = navOf(mapOf(hall(1)));
    // From outside the west end, along the hall (z = 4), out of the east end.
    expect(miss(nav, v([4 - 7, 0, 4]), v([44 + 7, 0, 4]))).toBeLessThan(1.2);
    for (const x of [1, 2, 3, 4]) for (const cx of [-2, 2]) for (const north of [true, false]) expect(miss(nav, v([4, 0, 4]), v([x * 8 + cx, 0, north ? 8.3 : -0.3])), `room at ${x * 8 + cx}, ${north ? 'north' : 'south'}`).toBeLessThan(1.2);
    nav.destroy();
  });
  for (const floors of [2, 3] as const) {
    it(`on ${floors} floors: both end stairs and the middle stair meet every floor's hall`, { timeout: 240_000 }, () => {
      const map = mapOf(hall(floors));
      const nav = navOf(map);
      const top = (floors - 1) * 4;
      // In at the west lobby's door, the length of the ground floor's hall, out at the east lobby's door.
      expect(miss(nav, v([-7, 0, 8]), v([55, 0, 0]))).toBeLessThan(1.2);
      // From the west lobby up to every floor, and along each floor's hall to the far end's landing.
      for (let y = 4; y <= top; y += 4) {
        expect(miss(nav, v([0, 0, 7]), v([12, y, 4])), `west stair to the hall at ${y} m`).toBeLessThan(1.2);
        expect(miss(nav, v([12, y, 4]), v([44, y, 4])), `the hall at ${y} m, end to end`).toBeLessThan(1.2);
        expect(miss(nav, v([48, 0, 1]), v([44, y, 4])), `east stair to the hall at ${y} m`).toBeLessThan(1.2);
        // A room on that floor (the first dorm bay's south-west one).
        expect(miss(nav, v([0, 0, 7]), v([6, y, -0.3])), `a room at ${y} m`).toBeLessThan(1.2);
      }
      // The middle stair: from its foot in the office bay's stair hall to the first floor's hall.
      const path = nav.findPath(v([16, 0, 0]), v([32, 4, 4.6]));
      expect(path).toBeTruthy();
      expect(Math.max(...path!.map((p) => p.x))).toBeLessThan(36);
      nav.destroy();
      // A player walks up the middle stair, and up the west end's first flight.
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
      expect(walk(physics, v([20.6, 0.3, 0]), Math.PI / 2, 260).pos.y).toBeGreaterThan(3.5);
      expect(walk(physics, v([-1.75, 0.02, 2.6]), Math.PI, 150).pos.y).toBeGreaterThan(1.7);
    });
  }
});

/**
 * Smythe Hall's shape (St. John's step 2): a two-floor L. The short arm runs west to east along z = 4 (cells y 0, 1) from
 * an arched end bay at x 0 to the Dorm Corner Bay at x 1-2, the long arm south from it along x = 12 (cells x 1, 2): two
 * Dorm Bays turned a quarter, the Dorm Entry Bay in the ground floor's middle, and the Stair End Bay (upper door) at the
 * south end, its upper door meeting a Skybridge. The Square Corner Tower stands at the short arm's west end.
 */
function smythe(): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, y: number, z: number, rotation: Rotation = 0): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate' });
  const out: SetPiecePlacement[] = [at('end_w', 'setpiece.stair_end_bay_arched', 0, 0, 0), at('end_s', 'setpiece.stair_end_bay_bridge', 2, -4, 0, 3), at('tower', 'setpiece.corner_tower_square', -1, 0, 0), at('bridge', 'setpiece.skybridge_2', 1, -6, 1)];
  for (const z of [0, 1]) {
    out.push(at(`corner_${z}`, 'setpiece.dorm_corner_bay', 1, 0, z));
    for (const y of [-1, -2, -3]) out.push(at(`arm_${y}_${z}`, y === -2 && z === 0 ? 'setpiece.dorm_entry_bay' : 'setpiece.dorm_bay', 1, y, z, 1));
  }
  return out;
}

describe("a two-floor L (Smythe Hall's shape)", () => {
  it('one hall round the corner on both floors; both stairs, the side entry, the bridge and the tower', { timeout: 240_000 }, () => {
    const map = mapOf(smythe());
    const nav = navOf(map);
    for (const y of [0, 4]) {
      // From the west end's hall mouth round the corner to the south end's.
      expect(miss(nav, v([4, y, 4]), v([12, y, -28])), `the hall at ${y} m, end to end`).toBeLessThan(1.2);
      // A room off each arm and the lounge.
      expect(miss(nav, v([4, y, 4]), v([6, y, 8.3])), `a north room at ${y} m`).toBeLessThan(1.2);
      expect(miss(nav, v([4, y, 4]), v([16.3, y, -14])), `a long arm's east room at ${y} m`).toBeLessThan(1.2);
      expect(miss(nav, v([4, y, 4]), v([16.7, y, 8.5])), `the lounge at ${y} m`).toBeLessThan(1.2);
    }
    // In under the far end's arch and up its stair; in at the side entry; up the south stair to the bridge and across it.
    expect(miss(nav, v([-7, 0, 8]), v([12, 4, 0]))).toBeLessThan(1.2);
    expect(miss(nav, v([1, 0, -16]), v([12, 0, -16]))).toBeLessThan(1.2);
    expect(miss(nav, v([12, 0, -26]), v([8, 4, -40]))).toBeLessThan(1.2);
    expect(miss(nav, v([12, 4, -24]), v([8, 4, -44]))).toBeLessThan(1.2);
    // The tower's door, ladder and lookout.
    expect(miss(nav, v([-6.8, 0, -6]), v([-6.8, 11.8, -0.6]))).toBeLessThan(1.2);
    nav.destroy();
  });
});

/**
 * Stangeland / Cord's shape (St. John's step 5): a three-floor school hall along z = 4 (cells y 0, 1). The 3-floor Stair
 * End Bay at x 0, four Classroom Bays a floor at x 1-4, the 3-floor Stair End Bay at the east end (x 5, turned
 * half round, anchored a cell north) with a Carriageway beside it (x 6, y 0) whose door on each floor meets the end
 * bay's lobby and its first-floor door (the 3-floor Stair End Bay's First-floor door option, St. John's step 5b); a
 * Classroom Entry Bay turned half round opens the ground floor's hall to the north.
 */
function stangeland(): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, y: number, z: number, rotation: Rotation = 0, overrides?: SetPiecePlacement['overrides']): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate', ...(overrides ? { overrides } : {}) });
  const out = [at('end_w', 'setpiece.stair_end_bay_3', 0, 0, 0), at('end_e', 'setpiece.stair_end_bay_3', 5, 1, 0, 2, { options: { upperDoor: 'end' } }), at('bridge', 'setpiece.carriageway_1', 6, 0, 0)];
  // (St. John's step 5b: the court door, a Classroom Entry Bay turned half round on the ground floor; pennants in a few rooms.)
  for (let z = 0; z < 3; z++) for (const x of [1, 2, 3, 4]) out.push(x === 2 && z === 0 ? at('entry', 'setpiece.classroom_entry_bay', 2, 1, 0, 2) : at(`bay_${x}_${z}`, 'setpiece.classroom_bay', x, 0, z, 0, x === 3 && z === 1 ? { options: { pennants: 'both' } } : undefined));
  return out;
}

describe("a three-floor school hall joined to a bridge (Stangeland / Cord's shape)", () => {
  it('every floor end to end, every classroom, both stairs, the bridge on the ground and the first floor', { timeout: 240_000 }, () => {
    const map = mapOf(stangeland());
    const nav = navOf(map);
    for (const y of [0, 4, 8]) {
      expect(miss(nav, v([4, y, 4]), v([36, y, 4])), `the hall at ${y} m, end to end`).toBeLessThan(1.2);
      for (const x of [1, 4]) for (const north of [true, false]) expect(miss(nav, v([x * 8, y, 4]), v([x * 8 + 2.4, y, north ? 10.6 : -2.6])), `the classroom at x ${x}, ${north ? 'north' : 'south'}, ${y} m`).toBeLessThan(1.2);
      // From the west lobby to every floor.
      expect(miss(nav, v([0, 0, 7]), v([12, y, 4])), `west stair to ${y} m`).toBeLessThan(1.2);
    }
    // Both end stairs reach the top floor (the east one three floors, with the bridge's door on the first).
    expect(miss(nav, v([40, 0, 1]), v([36, 8, 4])), 'east stair to the top floor').toBeLessThan(1.2);
    // In from the court under the entry bay's arch (turned half round: the arch faces north), along the hall.
    expect(miss(nav, v([20, 0, 15]), v([20, 0, 8]))).toBeLessThan(1.2);
    expect(miss(nav, v([20, 0, 15]), v([4, 0, 4]))).toBeLessThan(1.2);
    // The bridge: in from its passage at the side door to the east lobby; its room over the arch to the first floor's hall.
    expect(miss(nav, v([48, 0, 0]), v([40, 0, 0.5]))).toBeLessThan(1.2);
    expect(miss(nav, v([48, 4, 0]), v([30, 4, 4]))).toBeLessThan(1.2);
    // The east stair from the ground to the first floor.
    expect(miss(nav, v([40, 0, 1]), v([36, 4, 4]))).toBeLessThan(1.2);
    nav.destroy();
  });
});

/**
 * Welles Hall's shape (St. John's step 6): three floors between two 3-floor Stair End Bays, the west one with its
 * First-floor door meeting a Carriageway (x 0, y 1) on the ground and the first floor: the mess hall of Refectory Bays
 * on the ground (one with doors both sides, one with the fireplace), Classroom Bays over it, Dorm Bays on top; the
 * Clock Tower beside the bridge, north of the west end, turned half round (its door and belfry gallery face north).
 */
function welles(): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, y: number, z: number, rotation: Rotation = 0, overrides?: SetPiecePlacement['overrides']): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate', ...(overrides ? { overrides } : {}) });
  const out = [at('end_w', 'setpiece.stair_end_bay_3', 1, 0, 0, 0, { options: { upperDoor: 'end' } }), at('end_e', 'setpiece.stair_end_bay_3', 8, 1, 0, 2), at('bridge', 'setpiece.carriageway_1', 0, 1, 0), at('tower', 'setpiece.clock_tower', 1, 2, 0, 2)];
  const walls: Record<number, string> = { 4: 'doors', 6: 'fire_south' };
  for (let x = 2; x <= 7; x++) {
    out.push(at(`mess_${x}`, 'setpiece.refectory_bay', x, 0, 0, 0, walls[x] ? { options: { walls: walls[x]! } } : undefined));
    out.push(at(`class_${x}`, 'setpiece.classroom_bay', x, 0, 1));
    out.push(at(`dorm_${x}`, x % 2 ? 'setpiece.dorm_bay' : 'setpiece.dorm_bay_closed', x, 0, 2, 0, { options: { roomDoors: 'slim' } }));
  }
  return out;
}

describe("a three-floor mess hall with its clock tower (Welles Hall's shape)", () => {
  it('every floor end to end, the mess hall crossed, classrooms and rooms, both stairs, the bridge on two floors, the tower to its belfry', { timeout: 240_000 }, () => {
    const map = mapOf(welles());
    const nav = navOf(map);
    for (const y of [0, 4, 8]) {
      expect(miss(nav, v([16, y, 4]), v([56, y, 4])), `the hall at ${y} m, end to end`).toBeLessThan(1.2);
      // From the west lobby and from the east lobby to every floor.
      expect(miss(nav, v([8, 0, 8]), v([20, y, 4])), `west stair to ${y} m`).toBeLessThan(1.2);
      expect(miss(nav, v([64, 0, 0]), v([52, y, 4])), `east stair to ${y} m`).toBeLessThan(1.2);
    }
    // The mess hall: between the tables and benches, along both sides; across it through the doors (x 4), in from outside.
    for (const z of [-2.6, 10.6]) expect(miss(nav, v([18, 0, z]), v([58, 0, z])), `the mess hall along z ${z}`).toBeLessThan(1.2);
    expect(miss(nav, v([32, 0, -9]), v([32, 0, 17])), 'through the mess hall from Exeter Street to the court').toBeLessThan(1.2);
    // Classrooms on the first floor, rooms on the top floor (the open ones).
    for (const x of [2, 7]) for (const north of [true, false]) expect(miss(nav, v([x * 8, 4, 4]), v([x * 8 + 2.4, 4, north ? 10.6 : -2.6])), `the classroom at x ${x}, ${north ? 'north' : 'south'}`).toBeLessThan(1.2);
    for (const north of [true, false]) expect(miss(nav, v([24, 8, 4]), v(roomFloor(24 - 2, north, 8))), `a room of the dorm bay at x 3, ${north ? 'north' : 'south'}`).toBeLessThan(1.2);
    // The bridge: through its side door into the west lobby; its room over the arch to the first floor's hall.
    expect(miss(nav, v([0, 0, 8]), v([8, 0, 8]))).toBeLessThan(1.2);
    expect(miss(nav, v([0, 4, 8]), v([24, 4, 4]))).toBeLessThan(1.2);
    // The clock tower: in at its door from the north, up the stair round its core to the belfry's gallery (17.5 m).
    expect(miss(nav, v([8, 0, 22]), v([8, 0, 18.2])), 'in at the tower door').toBeLessThan(1.2);
    expect(miss(nav, v([8, 0, 22]), v([8, 17.5, 18.2])), 'up the tower to the belfry').toBeLessThan(1.2);
    expect(miss(nav, v([16, 0, 4]), v([10, 17.5, 18.2])), 'from the mess hall to the belfry').toBeLessThan(1.2);
    nav.destroy();
  });

  it('the belfry is a perch: its sills a metre over the gallery, nothing of the tower falls through or leans out', () => {
    const map = mapOf([{ id: 'tower', piece: 'setpiece.clock_tower', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    // Standing on the gallery (the stair's last landing, along the south wall), the opening's sill stops a walk south.
    const s = walk(physics, { x: -1.2, y: 17.6, z: -2.2 }, Math.PI, 60);
    expect(s.pos.z).toBeGreaterThan(-3.5);
    expect(s.pos.y).toBeGreaterThan(17.3);
    // Every box stays inside its cell and under 24 m.
    for (const b of buildMapGeometry(map).filter((b) => b.sourceId?.startsWith('sp_tower'))) {
      expect(b.min[0]).toBeGreaterThanOrEqual(-4.001);
      expect(b.max[0]).toBeLessThanOrEqual(4.001);
      expect(b.min[2]).toBeGreaterThanOrEqual(-4.001);
      expect(b.max[2]).toBeLessThanOrEqual(4.001);
      expect(b.max[1]).toBeLessThanOrEqual(24.001);
    }
  });
});

describe('the clock tower has room to stand in (owner, 2026-11-19: the first build was too low to use)', () => {
  it("a room's height (3.7 m, a 4 m level under its 0.3 m floor) over the door and every step and landing, the belfry 4 m under its roof", () => {
    const map = mapOf([{ id: 'tower', piece: 'setpiece.clock_tower', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    const boxes = buildMapGeometry(map).filter((b) => b.sourceId?.startsWith('sp_tower'));
    /** The clear height over (x, z) from y up: to the underside of the lowest box over that point. */
    const over = (x: number, y: number, z: number) => Math.min(...boxes.filter((b) => b.min[0] < x && b.max[0] > x && b.min[2] < z && b.max[2] > z && b.min[1] >= y - 1e-6).map((b) => b.min[1])) - y;
    // Inside the door (the ground floor between the door and the stair's foot).
    for (const x of [-1, 0, 1, 2.6]) expect(over(x, 0, -2.6), `ground at x ${x}`).toBeGreaterThanOrEqual(3.7 - 1e-6);
    // Every step and landing (the stair's slabs: 0.3 m thick inside the walls, off the core): over its middle and corners.
    const treads = boxes.filter((b) => Math.abs(b.max[1] - b.min[1] - 0.3) < 1e-6 && b.max[0] <= 3.41 && b.min[0] >= -3.41 && b.max[2] <= 3.41 && b.min[2] >= -3.41);
    expect(treads.length).toBe(70);
    for (const t of treads) {
      if (t.max[1] >= 17.5 - 1e-6) continue; // the belfry's floor: below
      for (const [fx, fz] of [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
        const x = t.min[0] + (t.max[0] - t.min[0]) * fx!;
        const z = t.min[2] + (t.max[2] - t.min[2]) * fz!;
        expect(over(x, t.max[1], z), `over the step at ${t.max[1]} m (${x.toFixed(2)}, ${z.toFixed(2)})`).toBeGreaterThanOrEqual(3.7 - 1e-6);
      }
    }
    // The belfry's gallery, under its roof.
    expect(over(-1.2, 17.5, -2.6)).toBeGreaterThanOrEqual(4 - 1e-6);
    // A player stands up all the way round: from the door, every tread's middle has standing room for the capsule.
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    for (const t of treads) expect(physics.headroom({ x: (t.min[0] + t.max[0]) / 2, y: t.max[1] + 0.3, z: (t.min[2] + t.max[2]) / 2 }, PLAYER.height), `standing on the step at ${t.max[1]} m`).toBe(true);
  });
});

/**
 * DeKoven Hall's shape (St. John's step 7b), its corridor north to south along x 4: the mess hall's bay with doors both
 * sides (y -2), the south Stair End Bay (3 floors) turned so its lobby door is on the mess hall's north door, four
 * bays a floor (ground: Admin Bays, the Admin Entry Bay, the Basement Stair Bay; first floor Admin Bays; top floor
 * Dorm Bays; basement Admin Bays with solid walls), and the north Stair End Bay with the roof stair between two Round
 * Corner Turrets.
 */
function dekoven(): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, y: number, z: number, rotation: Rotation = 0, options?: Record<string, string>): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate', ...(options ? { overrides: { options } } : {}) });
  const out: SetPiecePlacement[] = [
    at('mess', 'setpiece.refectory_bay', 0, -2, 0, 0, { walls: 'doors' }),
    at('south', 'setpiece.stair_end_bay_3', 1, 0, 0, 3),
    at('north', 'setpiece.stair_end_bay_roof', 0, 5, 0, 1),
    at('turret_w', 'setpiece.corner_turret_round', -1, 5, 0, 3),
    at('turret_e', 'setpiece.corner_turret_round', 2, 5, 0, 2),
    at('ground1', 'setpiece.admin_bay', 0, 1, 0, 1),
    at('ground2', 'setpiece.admin_bay', 0, 2, 0, 1, { hall: 'plain', offices: 'shut' }),
    at('ground3', 'setpiece.admin_entry_bay', 0, 3, 0, 1),
    at('ground4', 'setpiece.stair_down_bay', 0, 4, 0, 1, { top: 'open' }),
  ];
  for (const y of [1, 2, 3]) out.push(at(`base${y}`, 'setpiece.admin_bay', 0, y, -1, 1, { hall: 'plain', offices: y === 2 ? 'open' : 'shut', walls: 'solid' }));
  for (const y of [1, 2, 3, 4]) {
    out.push(at(`first${y}`, 'setpiece.admin_bay', 0, y, 1, 1, { hall: y === 1 ? 'display' : 'plain', offices: y % 2 ? 'open' : 'shut' }));
    out.push(at(`top${y}`, y % 2 ? 'setpiece.dorm_bay' : 'setpiece.dorm_bay_closed', 0, y, 2, 1, { roomDoors: 'slim' }));
  }
  return out;
}

describe("a three-floor office hall with a basement and a roof perch, joined to a mess hall (DeKoven Hall's shape)", () => {
  it('every floor end to end, both stairs, the basement, the roof, the reception, and the mess hall to the 2nd floor through the lobby', { timeout: 300_000 }, () => {
    // (On a 2 m ground grid and on a 2.5 m one: St. John's 2.5 m grid has points on the basement's corridor walls, which
    // pulled the ground down into a basement of plain Rooms. The route checks are the same on both.)
    for (const spacing of [2, 2.5]) dekovenWalks(mapOf(dekoven(), spacing), `ground grid ${spacing} m`);
  });
  function dekovenWalks(map: MapDocument, grid: string): void {
    const nav = navOf(map);
    const hallMiddle = (y: number): Vec3 => v([4, y, 20]);
    // Every floor's corridor from its south end to its north end (the ground floor through the Basement Stair Bay).
    for (const y of [0, 4, 8]) expect(miss(nav, v([4, y, 5]), v([4, y, 35])), `the hall at ${y} m, end to end`).toBeLessThan(1.2);
    // Both stairs to every floor: from the south lobby (the mess hall's side) and from the north lobby (the road's side).
    for (const y of [4, 8]) {
      expect(miss(nav, v([0, 0, 0]), hallMiddle(y)), `south stair to ${y} m`).toBeLessThan(1.2);
      expect(miss(nav, v([8, 0, 40]), hallMiddle(y)), `north stair to ${y} m`).toBeLessThan(1.2);
    }
    // The owner's route: from the mess hall through its north door into the lobby, up the stair to the 2nd floor; and back.
    const up = nav.findPath(v([0, 0, -12]), v([4, 4, 12]))!;
    expect(up, 'mess hall to the 2nd floor').toBeTruthy();
    const length = (path: Vec3[]) => path.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.z - path[i - 1]!.z) : 0), 0);
    expect(Math.hypot(up.at(-1)!.x - 4, up.at(-1)!.y - 4, up.at(-1)!.z - 12)).toBeLessThan(1.2);
    // (Through the lobby and up the south stair, not round by the reception and the north stair: under 60 m.)
    expect(length(up), 'the route goes through the lobby door').toBeLessThan(60);
    expect(up.some((p) => Math.abs(p.z + 4) < 1.2 && Math.abs(p.x) < 1.6), 'it crosses the lobby door on the mess hall wall').toBe(true);
    expect(miss(nav, v([4, 4, 12]), v([0, 0, -12])), 'and back down into the mess hall').toBeLessThan(1.2);
    // In at the north door and at the reception's arch (west); the crest's bay to the corridor.
    expect(miss(nav, v([8, 0, 47]), hallMiddle(0)), 'in at the north door').toBeLessThan(1.2);
    expect(miss(nav, v([-7, 0, 24]), hallMiddle(0)), 'in at the reception').toBeLessThan(1.2);
    // The basement: down the Basement Stair Bay, along its hall to the far end, into its open office.
    expect(miss(nav, hallMiddle(0), v([4, -4, 6])), `${grid}: down to the basement and along it`).toBeLessThan(1.2);
    expect(miss(nav, v([4, -4, 30]), v([4, 0, 12])), 'up from the basement').toBeLessThan(1.2);
    // Offices and rooms: a ground-floor office, a first-floor one, a top-floor room.
    expect(miss(nav, hallMiddle(0), v([-2.6, 0, 5.8])), 'a ground-floor office').toBeLessThan(1.2);
    expect(miss(nav, hallMiddle(4), v([-2.6, 4, 5.8])), 'a first-floor office').toBeLessThan(1.2);
    // The roof: up the north stair onto the roof, along the hall's roof to its south end (the perch), and down again.
    expect(miss(nav, v([8, 0, 40]), v([8, 12, 40])), 'onto the roof by the stair head').toBeLessThan(1.2);
    expect(miss(nav, v([0, 0, -12]), v([4, 12, 10])), 'from the mess hall to the roof').toBeLessThan(1.2);
    expect(miss(nav, v([4, 12, 10]), hallMiddle(0)), 'and down from the roof').toBeLessThan(1.2);
    nav.destroy();
    // A player walks from the mess hall through both doorways into the lobby, and up the roof stair's last flight.
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    expect(walk(physics, v([0, 0.05, -7]), 0, 140).pos.z, `${grid}: walked north out of the mess hall into the lobby`).toBeGreaterThan(-2.5);
    // No ground lies in the basement: over its corridor and offices the ground as played is cut away or above the ceiling.
    for (const z of [10, 16, 24]) for (const x of [-1, 3.6, 4.4, 9]) expect(physics.headroom({ x, y: -3.7, z }, PLAYER.height), `${grid}: standing room in the basement at (${x}, ${z})`).toBe(true);
  }
});

/**
 * Memorial Hall's shape (St. John's step 8, the library): three Library Bays north to south (x 0 and 1, y 0 to 2), the
 * south one turned 90 with its East end closed (the hall's south wall), the others turned 270, the north one's East
 * end closed (the north wall), the middle one's South door a Round arch (it faces east), and the Library Porch east of
 * it, turned 270 so its way out faces east, to the grounds.
 */
function memorialHall(): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, y: number, rotation: Rotation, options?: Record<string, string>): SetPiecePlacement => ({ id, piece, x, y, z: 0, rotation, mirror: false, pack: 'collegiate', ...(options ? { overrides: { options } } : {}) });
  return [
    at('south', 'setpiece.library_bay', 0, 0, 1, { end: 'east' }),
    at('middle', 'setpiece.library_bay', 1, 1, 3, { door: 'south' }),
    at('north', 'setpiece.library_bay', 1, 2, 3, { end: 'east' }),
    at('porch', 'setpiece.library_porch', 2, 1, 3),
  ];
}

describe("a library of one tall room with a round porch (Memorial Hall's shape)", () => {
  it('in at the porch from the grounds, the reading room end to end and round its tables, both ends closed, a player walks in', { timeout: 240_000 }, () => {
    for (const spacing of [2, 2.5]) {
      const map = mapOf(memorialHall(), spacing);
      const nav = navOf(map);
      const grid = `ground grid ${spacing} m`;
      const length = (path: Vec3[] | null) => (path ? path.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.z - path[i - 1]!.z) : 0), 0) : Infinity);
      // From the grounds east of the porch, through it, into the reading room: the short way (about 18 m).
      const inAtPorch = nav.findPath(v([22, 0, 8]), v([4, 0, 8]));
      expect(length(inAtPorch), `${grid}: in at the porch`).toBeLessThan(24);
      expect(miss(nav, v([22, 0, 8]), v([16, 0, 8])), `${grid}: into the porch`).toBeLessThan(1.2);
      // The room end to end down both aisles (the tables stand along the middle), and across it between two tables.
      for (const x of [0.5, 7.5]) expect(miss(nav, v([x, 0, -2.5]), v([x, 0, 18.5])), `${grid}: the aisle at x ${x}`).toBeLessThan(1.2);
      expect(miss(nav, v([0.5, 0, 4]), v([7.5, 0, 4])), `${grid}: across the room between the bays`).toBeLessThan(1.2);
      // Both ends are walls: to a point just outside either, only by the porch and round the hall.
      expect(length(nav.findPath(v([4, 0, 18.5]), v([4, 0, 23]))), `${grid}: the north end is closed`).toBeGreaterThan(30);
      expect(length(nav.findPath(v([4, 0, -2.5]), v([4, 0, -7]))), `${grid}: the south end is closed`).toBeGreaterThan(30);
      // The west wall has no door.
      expect(length(nav.findPath(v([-2.5, 0, 8]), v([-7, 0, 8]))), `${grid}: the west wall is closed`).toBeGreaterThan(30);
      nav.destroy();
      // A player walks west from the grounds through the porch's two doorways and the hall's arch.
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
      expect(walk(physics, v([22, 0.05, 8]), -Math.PI / 2, 200).pos.x, `${grid}: walked in through the porch`).toBeLessThan(10.5);
      // Standing room all through the tall room (no ground in it), under an 8 m roof.
      for (const z of [-2, 4, 12, 18]) for (const x of [-2.5, 0.5, 7.5, 10.5]) expect(physics.headroom({ x, y: 0.3, z }, PLAYER.height), `${grid}: standing room at (${x}, ${z})`).toBe(true);
    }
  });
});

describe("a mess hall's main entrance: Twin arches (St. John's step 7a, map format v49)", () => {
  it('the style is two round arches 2.8 m wide on a 0.6 m pier, one storey, no glass', () => {
    expect(EDGE_SHAPES.arch_twin!.openings).toEqual([[-3.1, -0.3, 0, 3.2], [0.3, 3.1, 0, 3.2]]);
    const segs = edgeSegments('arch_twin', 4, 3.5);
    // The middle pier and the end piers stand floor to ceiling; each crown is 3.2 m up; nothing rises past the storey.
    expect(segs).toContainEqual([-0.3, 0.3, 0, 3.5, 0.5]);
    expect(segs).toContainEqual([-4, -3.1, 0, 3.5, 0.5]);
    expect(segs).toContainEqual([3.1, 4, 0, 3.5, 0.5]);
    expect(segs).toContainEqual([-1.94, -1.46, 3.2, 3.5, 0.5]);
    expect(Math.max(...segs.map((g) => g[3]))).toBe(3.5);
    // The stone over each opening never dips below its semicircle (centre 1.7 m from the middle, radius 1.4, springing 1.8).
    for (const [u0, u1, y0] of segs) {
      if (y0 === 0) continue;
      const c = u0 < 0 ? -1.7 : 1.7;
      const inner = Math.min(Math.abs(u0 - c), Math.abs(u1 - c));
      expect(y0, `the step over ${u0}..${u1}`).toBeGreaterThanOrEqual(Math.min(3.2, 1.8 + Math.sqrt(Math.max(0, 1.4 * 1.4 - inner * inner))) - 0.011);
    }
    // Voussoirs on both arches, imposts on the three piers; the two rings meet over the middle pier and don't overlap.
    const trim = edgeTrimBoxes('arch_twin', 4, 3.5, true);
    expect(trim.filter((t) => t.tilt !== undefined || (t.y1 > 3.2 && t.y0 > 2.9 && t.y1 - t.y0 > 0.4)).length).toBeGreaterThan(30);
    expect(trim.filter((t) => t.y0 === 1.65 && t.y1 === 1.8).length).toBe(6);
  });
  for (const [choice, north] of [['main_north', true], ['main_south', false]] as const) {
    it(`${choice}: bots path in through either arch; a player walks through each and is stopped by the pier; the window stays opposite`, { timeout: 240_000 }, () => {
      const def = library.pieces.get('setpiece.refectory_bay')!;
      for (const rotation of ROTATIONS) for (const mirror of [false, true]) {
        const map = withPiece('setpiece.refectory_bay', rotation, mirror, { walls: choice });
        const at = (p: P3) => place(v(p), rotation, mirror, mirrorWidth(def));
        const where = `${choice} turned ${rotation}${mirror ? ' mirrored' : ''}`;
        const wall = north ? 12 : -4;
        const out = north ? 1 : -1;
        const nav = navOf(map);
        for (const x of [-1.7, 1.7]) {
          expect(miss(nav, at([x, 0, wall + out * 3]), at([-3, 0, 4])), `${where}: from outside the arch at x ${x} to the hall's middle`).toBeLessThan(1.2);
          // Straight through: the path stays in that arch's lane (no detour round the piece).
          const path = nav.findPath(at([x, 0, wall + out * 3]), at([x, 0, wall - out * 1.6]))!;
          expect(path, `${where}: a path through the arch at x ${x}`).toBeTruthy();
          let length = 0;
          for (let i = 1; i < path.length; i++) length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
          expect(length, `${where}: the path through the arch at x ${x} is the straight one`).toBeLessThan(6);
        }
        nav.destroy();
        const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
        const yaw = placeYaw(north ? Math.PI : 0, rotation, mirror);
        const local = (p: Vec3) => {
          // Back into the piece's frame: undo the turn, then the mirror.
          const [x, z] = rotateXZ(p.x, p.z, ((4 - rotation) % 4) as Rotation);
          return { x: mirror ? mirrorWidth(def) * 8 - x : x, z };
        };
        for (const x of [-1.7, 1.7]) {
          const end = local(walk(physics, at([x, 0, wall + out * 2]), yaw, 70).pos);
          expect((end.z - wall) * out, `${where}: walked in through the arch at x ${x} (ended z ${end.z.toFixed(2)})`).toBeLessThan(-0.6);
        }
        const stopped = local(walk(physics, at([0, 0, wall + out * 2]), yaw, 70).pos);
        expect((stopped.z - wall) * out, `${where}: the middle pier stops a walk`).toBeGreaterThan(0.2);
        // The other long wall keeps its arched window, glazed; the banner hangs on the south wall unless that is the entrance.
        expect(windowPanes(map).length, `${where}: one window pane`).toBe(1);
        expect(map.entities.filter((e) => e.kind === 'prop' && e.model === 'prop.dg_banner').length, `${where}: banner`).toBe(north ? 1 : 0);
      }
    });
  }
  it('a part\'s `when` may list several choices: in for each of them, out for the rest; a choice the option lacks is refused', () => {
    const def = library.pieces.get('setpiece.refectory_bay')!;
    const banner = def.parts.findIndex((p) => p.kind === 'prop' && p.model === 'prop.dg_banner');
    expect(Array.isArray(def.parts[banner]!.when!.walls)).toBe(true);
    for (const c of def.options![0]!.choices) {
      const { entities } = setPieceParts({ id: 'p_1', piece: def.id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate', overrides: { options: { walls: c.value } } }, def, 'core.castle', library);
      expect(entities.some((e) => e.id === `sp_p_1_${banner}`), c.value).toBe(c.value !== 'main_south');
    }
    const bad = { ...def, parts: def.parts.map((p, i) => (i === banner ? { ...p, when: { walls: ['windows', 'nowhere'] } } : p)) };
    expect(checkSetPieceDefinition(bad as typeof def).join('; ')).toMatch(/walls has no choice "nowhere"/);
  });
});

describe('the wall styles the bays are built with', () => {
  it('a sash window is 1.2 m wide from 0.9 to 3 m, glazed; the twin has one each side, 2 m from the middle', () => {
    expect(EDGE_SHAPES.window_sash!.openings).toEqual([[-0.6, 0.6, 0.9, 3]]);
    expect(EDGE_SHAPES.windows_sash!.openings).toEqual([[-2.6, -1.4, 0.9, 3], [1.4, 2.6, 0.9, 3]]);
    const map = mapOf([{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    // One pane a room, in the middle of its outer wall (the rooms' doors are at x -2 and 2), breakable in the Collegiate look.
    const panes = windowPanes(map);
    expect(panes.map((p) => [p.box.center.x, p.box.center.z, p.kind]).sort()).toEqual([[-2, -3.75, 'breakable'], [-2, 11.75, 'breakable'], [2, -3.75, 'breakable'], [2, 11.75, 'breakable']]);
    // The wall stands round the opening, floor to ceiling, and is 0.5 m thick.
    const segs = edgeSegments('window_sash', 4, 4);
    expect(segs).toContainEqual([-0.6, 0.6, 0, 0.9, 0.5]);
    expect(segs).toContainEqual([-0.6, 0.6, 3, 4, 0.5]);
  });

  it('the classroom windows are four sashes 1.25 m wide from 0.9 to 3.2 m, clear of a facade\'s buttresses; one pane each', () => {
    expect(EDGE_SHAPES.windows_school!.openings).toEqual([[-3.1, -1.85, 0.9, 3.2], [-1.45, -0.2, 0.9, 3.2], [0.2, 1.45, 0.9, 3.2], [1.85, 3.1, 0.9, 3.2]]);
    // The Collegiate facades' buttresses stand 0.13 to 0.77 m in from a side's ends (half − 0.45 ± 0.32).
    for (const [u0, u1] of EDGE_SHAPES.windows_school!.openings as [number, number, number, number][]) expect(Math.max(Math.abs(u0), Math.abs(u1))).toBeLessThan(4 - 0.45 - 0.32 - 0.1);
    const map = mapOf([{ id: 'bay0', piece: 'setpiece.classroom_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    const panes = windowPanes(map);
    expect(panes).toHaveLength(8);
    expect(panes.every((p) => p.kind === 'breakable')).toBe(true);
  });

  it('the sash is drawn in the wall by the glass, in its own paint; nothing of it collides', () => {
    const trim = edgeTrimBoxes('window_sash', 4, 4);
    const sash = trim.filter((p) => p.surface);
    // Two stiles, a bottom and a top rail, the meeting rail, a glazing bar in each sash.
    expect(sash).toHaveLength(7);
    for (const p of sash) {
      expect(p.surface).toEqual({ material: 'core.paint_matte', tint: '#e6e1d3' });
      // Inside the wall's thickness, round the glass's plane (0.25 m in), inside the opening.
      expect(p.v0).toBeGreaterThan(0);
      expect(p.v1).toBeLessThan(0.5);
      expect(p.v0).toBeLessThan(0.25);
      expect(p.v1).toBeGreaterThan(0.25);
      expect(p.u0).toBeGreaterThanOrEqual(-0.6);
      expect(p.u1).toBeLessThanOrEqual(0.6);
      expect(p.y0).toBeGreaterThanOrEqual(0.9);
      expect(p.y1).toBeLessThanOrEqual(3);
      expect(p.depth).toBeUndefined();
    }
    // A meeting rail half way up the glass, across it.
    expect(sash.some((p) => Math.abs((p.y0 + p.y1) / 2 - 1.95) < 0.01 && p.u1 - p.u0 > 1)).toBe(true);
    // The stone sill stands into the room; where nothing is built beyond, the surround is on the outer face too.
    expect(trim.some((p) => p.depth === 0.14 && p.y1 === 0.9)).toBe(true);
    expect(edgeTrimBoxes('window_sash', 4, 4, true).filter((p) => p.v1 === 0).length).toBe(4);
    // The bay's windows are glazed: each pane carries its sash in that paint (drawn with the glass, gone when it is
    // shot out: owner, 2026-11-18, 2a), so the level's trim leaves it out; no collision box of the map comes from it.
    const map = mapOf([{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    expect(buildMapDecor(map).filter((b) => b.surface?.material === 'core.paint_matte')).toHaveLength(0);
    const bars = windowPanes(map).flatMap((p) => p.bars ?? []);
    expect(bars).toHaveLength(28);
    expect(bars.every((b) => b.tint === '#e6e1d3')).toBe(true);
    expect(buildMapGeometry(map).some((b) => b.surface?.material === 'core.paint_matte')).toBe(false);
  });

  it('the Room doorway is 2 m wide and 2.6 m high in an oak frame, whatever the trim; the Oak Door fits it', () => {
    expect(EDGE_SHAPES.door_room!.openings).toEqual([[-1, 1, 0, 2.6]]);
    expect(edgeSegments('door_room', 4, 4)).toContainEqual([-1, 1, 2.6, 4, 0.5]);
    const frame = edgeTrimBoxes('door_room', 4, 4).filter((p) => p.surface);
    expect(frame).toHaveLength(3);
    expect(frame.every((p) => p.surface!.material === 'core.oak_beam')).toBe(true);
    for (const id of ['kit.door.oak', 'kit.door.oak_ajar', 'kit.door.oak_open']) expect(getProp(id)!.size.slice(0, 2), id).toEqual([2, 2.6]);
    // Shut and ajar close the doorway (the slab in it); open collides as its leaf beside the clear doorway (cover:
    // owner, 2026-11-19; doorLeaves.test.ts).
    expect(getProp('kit.door.oak')!.collision).toEqual([2, 2.6, 0.16]);
    expect(getProp('kit.door.oak_ajar')!.boxes![0]).toEqual([-1, 0, -0.08, 1, 2.6, 0.08]);
    expect(getProp('kit.door.oak_open')!.boxes).toHaveLength(1);
    expect(getProp('kit.door.oak_open')!.boxes![0]![0]).toBeGreaterThan(0.8);
  });
});

describe('what the bays are made of, and what they cost', () => {
  const made = (id: string) => {
    const def = library.pieces.get(id)!;
    const { tiles, entities } = setPieceParts({ id: 'p_1234', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }, def, 'core.castle', library);
    const n = (k: string) => entities.filter((e) => e.kind === k).length;
    const models = [...new Set(entities.flatMap((e) => (e.kind === 'prop' ? [e.model] : [])))].sort();
    return { tiles: tiles.length, blocks: n('block'), props: n('prop'), doors: n('door'), lights: n('light'), tileIds: [...new Set(tiles.map((t) => t.tile))].sort(), models };
  };
  it('each is made of the kit tiles, blocks, props and lights it says', () => {
    // Room furniture paired (the default since St. John's step 4): a room's desks and chairs one prop, its closet
    // fronts another, so a room is 5 props, not 9.
    expect(made('setpiece.dorm_bay')).toMatchObject({ tiles: 2, blocks: 14, props: 20, doors: 0, lights: 1, tileIds: ['core.room'] });
    expect(made('setpiece.dorm_bay').models).toEqual(['kit.bed.bunk', 'kit.cabinet.closet_front_pair', 'kit.door.oak_open', 'kit.table.desk_hutch_pair', 'prop.hh_cupboard_sink']);
    expect(made('setpiece.dorm_bay_closed')).toMatchObject({ tiles: 2, blocks: 14, props: 18, doors: 0, lights: 1 });
    expect(made('setpiece.hall_centre')).toMatchObject({ props: 65 });
    expect(made('setpiece.stair_end_bay')).toMatchObject({ tiles: 3, doors: 0, tileIds: ['core.room', 'core.stairwell'] });
    expect(made('setpiece.stair_end_bay_3')).toMatchObject({ tiles: 4, doors: 0, tileIds: ['core.room', 'core.stairwell'] });
    expect(made('setpiece.dorm_office_bay')).toMatchObject({ tiles: 11, doors: 0, tileIds: ['core.room', 'core.stairs'] });
    // A classroom bay: two rooms of 7 props (door, three rows of four desks, the teacher's desk, chalkboard, screen).
    expect(made('setpiece.classroom_bay')).toMatchObject({ tiles: 2, blocks: 10, props: 14, doors: 0, lights: 1, tileIds: ['core.room'] });
    expect(made('setpiece.classroom_bay').models).toEqual(['kit.board.chalk', 'kit.board.screen', 'kit.door.oak_open', 'kit.table.desk', 'kit.table.school_desks']);
    // St. John's step 5b: pennants are off unless a placement turns them on (the owner: a handful of rooms).
    expect(made('setpiece.classroom_entry_bay')).toMatchObject({ tiles: 2, props: 9, lights: 1, tileIds: ['core.room'] });
    // St. John's step 6: a mess hall bay is two piers, two long tables with four benches, a chandelier and a banner, one
    // light; the fireplace adds six blocks. The clock tower is its tile (no entities) and four clock faces, one light.
    expect(made('setpiece.refectory_bay')).toMatchObject({ tiles: 2, blocks: 2, props: 8, doors: 0, lights: 1, tileIds: ['core.room'] });
    expect(made('setpiece.refectory_bay').models).toEqual(['kit.seat.bench', 'prop.dg_banner', 'prop.dg_table_long', 'prop.hm_chandelier']);
    expect(made('setpiece.clock_tower')).toMatchObject({ tiles: 1, blocks: 0, props: 4, doors: 0, lights: 1, tileIds: ['gothic.clock_tower'], models: ['kit.sign.clock_face'] });
  });

  it('no door of a hall thinks: every door is a still prop (no door entities, no breakable props but the ones the catalogue leaves)', () => {
    const map = mapOf(hall(2));
    expect(map.entities.filter((e) => e.kind === 'door')).toHaveLength(0);
  });

  it('a dorm bay stays inside its budget: collision boxes, trim, glass, props by model', () => {
    const cost = (placements: SetPiecePlacement[]) => {
      const map = mapOf(placements);
      const mine = (id: string) => id.startsWith('sp_') || placements.some((p) => id === p.id);
      return {
        collision: buildMapGeometry(map).filter((b) => mine(b.sourceId)).length,
        trim: buildMapDecor(map).filter((b) => mine(b.sourceId)).length,
        panes: windowPanes(map).length,
        props: map.entities.filter((e) => e.kind === 'prop').length,
      };
    };
    const one = cost([{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    // Measured 2026-11-13: 100 collision boxes (walls, slabs and roofs 18, entry walls and partitions 14, furniture 68:
    // a bunk is 12, a desk 2, the sink 1; the closets are the entry walls, the chairs are not solid), 130 trim boxes,
    // 4 panes. (2026-11-12, with free-standing closets and one desk a room: 110.) 2026-11-19: 114, with the four open
    // doors' leaves and the facade's plinth and buttresses colliding (doorLeaves.test.ts, facadeCover.test.ts).
    expect(one.collision).toBeLessThanOrEqual(114);
    expect(one.trim).toBeLessThanOrEqual(135);
    expect(one.panes).toBe(4);
    expect(one.props).toBe(20);
  });

  it('paired furniture collides exactly as the separate pieces did, in every dorm piece and turn', () => {
    const rotateYaw = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
    const furniture = /^kit\.(table\.desk_hutch|seat\.chair|cabinet\.closet_front)/;
    const boxes = (piece: string, rotation: Rotation, furnitureChoice: string) => {
      const map = withPiece(piece, rotation, false, { furniture: furnitureChoice });
      const ids = new Set(map.entities.filter((e) => e.kind === 'prop' && furniture.test(e.model)).map((e) => e.id));
      const r = (v: number) => Math.round(v * 100) / 100;
      return buildMapGeometry(map)
        .filter((b) => ids.has(b.sourceId))
        .map((b) => {
          // The box in the world: its corners in plan, turned about its middle, and its height.
          const cx = (b.min[0] + b.max[0]) / 2;
          const cz = (b.min[2] + b.max[2]) / 2;
          const corners = [[b.min[0], b.min[2]], [b.max[0], b.min[2]], [b.max[0], b.max[2]], [b.min[0], b.max[2]]].map(([x, z]) => {
            const [dx, dz] = rotateYaw(x! - cx, z! - cz, b.yaw ?? 0);
            return `${r(cx + dx)}/${r(cz + dz)}`;
          });
          return [...corners.sort(), r(b.min[1]), r(b.max[1])].join(',');
        })
        .sort();
    };
    for (const piece of ['setpiece.dorm_bay', 'setpiece.dorm_bay_closed', 'setpiece.dorm_corner_bay', 'setpiece.dorm_entry_bay', 'setpiece.hall_centre'])
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const paired = boxes(piece, rotation, 'paired');
        expect(paired.length, `${piece} turned ${rotation}`).toBeGreaterThan(0);
        expect(paired, `${piece} turned ${rotation}`).toEqual(boxes(piece, rotation, 'separate'));
      }
  });

  it('the closets are in the entry wall: its face and the closet fronts line up, nothing behind, beside or over them is open', () => {
    // The separate fronts (Room furniture: Separate pieces), and the paired fronts' two halves where they stand.
    const map = mapOf([{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate', overrides: { options: { furniture: 'separate' } } }]);
    const fronts = map.entities.filter((e) => e.kind === 'prop' && e.model === 'kit.cabinet.closet_front');
    expect(fronts).toHaveLength(8);
    const paired = mapOf([{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]).entities.filter((e) => e.kind === 'prop' && e.model === 'kit.cabinet.closet_front_pair');
    expect(paired).toHaveLength(4);
    expect(getProp('kit.cabinet.closet_front_pair')!.collision).toBeNull();
    const halves = paired.flatMap((e) => [-1.47, 1.47].map((d) => `${(e.position[0] + d).toFixed(2)},${e.position[2].toFixed(3)}`)).sort();
    expect(halves).toEqual(fronts.map((e) => `${e.position[0].toFixed(2)},${e.position[2].toFixed(3)}`).sort());
    expect(getProp('kit.cabinet.closet_front')!.collision).toBeNull();
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    for (const f of fronts) {
      const [x, , z] = f.position;
      const north = z > 4;
      const into = north ? 1 : -1;
      // The front's back is on the wall's face (6 mm behind its middle): a ray from the room, from half a metre out
      // (nothing stands in front of a closet), meets the wall there, at the front's foot, middle and top, over it to
      // the ceiling, and beside it.
      const face = z - into * 0.006;
      for (const [dx, y] of [[0, 0.2], [0, 1.2], [0, 2.25], [0, 3.3], [-0.45, 1.2], [0.45, 1.2]] as const) {
        const hit = physics.raycastHit({ x: x + dx, y, z: face + into * 0.5 }, { x: 0, y: 0, z: -into }, 3);
        expect(hit?.dist, `the wall behind the closet front at ${x}, ${z} (${dx}, ${y})`).toBeCloseTo(0.5, 2);
      }
      // The wall is solid from that face to the hall (0.72 m): a ray from the hall meets it at the hall's side.
      const hall = physics.raycastHit({ x, y: 1.2, z: 4 }, { x: 0, y: 0, z: into }, 3);
      expect(hall?.dist).toBeCloseTo(1.2, 2);
      expect(Math.abs(face - 4)).toBeCloseTo(1.92, 2);
    }
    // No two entry-wall boxes overlap (z-fighting is audited over every piece in setPiecePlay.test.ts).
    const walls = map.entities.filter((e) => e.kind === 'block' && /^Entry wall/.test(e.name ?? ''));
    expect(walls).toHaveLength(8);
  });

  it("a set piece's footprint holds a prop's own box as it stands (a bunk against the wall at its edge)", () => {
    const def = library.pieces.get('setpiece.dorm_bay')!;
    expect(checkSetPieceDefinition(def, { packs: library.packs })).toEqual([]);
    // The bunk in the north-east room stands 0.6 m inside the footprint's east edge; moved 0.2 m further east it would reach out of it.
    const bunk = def.parts.findIndex((p) => p.kind === 'prop' && p.model === 'kit.bed.bunk' && p.position[0] > 2);
    const part = def.parts[bunk]!;
    if (part.kind !== 'prop') throw new Error('no bunk');
    expect(part.position[0] + getProp('kit.bed.bunk')!.size[0] / 2).toBeGreaterThan(3.9);
    const moved = { ...def, parts: def.parts.map((p, i) => (i === bunk && p.kind === 'prop' ? { ...p, position: [p.position[0] + 0.2, p.position[1], p.position[2]] as P3 } : p)) };
    expect(checkSetPieceDefinition(moved, { packs: library.packs }).join(' ')).toMatch(/kit\.bed\.bunk reaches outside the footprint/);
  });
});

// ---------------------------------------------------------------- the mess hall's kit (St. John's step 7d)

/** The Welles shape with the mess hall as the owner drew it: fireplace and drinks west, four bays of rows, the line, the kitchen east. */
function messHall(): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, y: number, z: number, rotation: Rotation = 0, options?: Record<string, string>): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate', ...(options ? { overrides: { options } } : {}) });
  const look = { floor: 'sunk', ceiling: 'timber', aisle: 'arcade', lights: 'bowls', flags: 'hung' };
  return [
    at('end_w', 'setpiece.stair_end_bay_3', 1, 0, 0, 0),
    at('end_e', 'setpiece.stair_end_bay_3', 8, 1, 0, 2),
    at('mess_2', 'setpiece.refectory_bay', 2, 0, 0, 0, { ...look, furniture: 'rows', end: 'fire_drinks' }),
    at('mess_3', 'setpiece.refectory_bay', 3, 0, 0, 0, { ...look, furniture: 'rows_podium' }),
    at('mess_4', 'setpiece.refectory_bay', 4, 0, 0, 0, { ...look, furniture: 'rows_gap', walls: 'doors' }),
    at('mess_5', 'setpiece.refectory_bay', 5, 0, 0, 0, { ...look, furniture: 'rows' }),
    at('serve', 'setpiece.refectory_servery', 6, 0, 0, 0, { floor: 'sunk', ceiling: 'timber' }),
    at('kitchen', 'setpiece.refectory_kitchen', 7, 0, 0, 0, { floor: 'sunk', end: 'door' }),
    ...[2, 3, 4, 5, 6, 7].flatMap((x) => [at(`class_${x}`, 'setpiece.classroom_bay', x, 0, 1), at(`dorm_${x}`, 'setpiece.dorm_bay_closed', x, 0, 2, 0, { roomDoors: 'slim' })]),
  ];
}

describe("a mess hall's kit: sunk floor, timber ceiling, arcade, rows, the line and the kitchen (St. John's step 7d)", () => {
  const BAY = 'setpiece.refectory_bay';
  const TURNS = ROTATIONS.flatMap((rotation) => [false, true].map((mirror) => ({ rotation, mirror })));
  /** The piece on a 2 m ground grid at the floors' height and on a 2.5 m one 4 cm over them (St. John's own). */
  const GRIDS = [{ spacing: 2, raise: 0 }, { spacing: 2.5, raise: 0.04 }];
  const one = (piece: string, rotation: Rotation, mirror: boolean, options: Record<string, string>, grid = GRIDS[0]!): MapDocument => mapOf([{ id: 'piece', piece, x: 0, y: 0, z: 0, rotation, mirror, pack: 'collegiate', overrides: { options } }], grid.spacing, grid.raise);
  const frame = (rotation: Rotation, mirror: boolean) => ({
    at: (p: P3) => place(v(p), rotation, mirror, 0),
    /** Back into the piece's frame: undo the turn, then the mirror. */
    local: (p: Vec3) => {
      const [x, z] = rotateXZ(p.x, p.z, ((4 - rotation) % 4) as Rotation);
      return { x: mirror ? -x : x, y: p.y, z };
    },
    yaw: (yaw: number) => placeYaw(yaw, rotation, mirror),
  });
  const length = (path: Vec3[]) => path.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.z - path[i - 1]!.z) : 0), 0);
  const world = (map: MapDocument) => {
    const geometry = buildMapGeometry(map);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(map));
    return { physics, nav: NavWorld.build(geometry, mapTerrainMesh(map), navLinks(map.entities, physics)) };
  };

  it('the Sunk Room is a Room with its slab half a metre down and the ground cut out of its cell', () => {
    for (const grid of GRIDS) {
      const map = one(BAY, 0, false, { floor: 'sunk', furniture: 'none' }, grid);
      expect(map.classicStructure.tiles.filter((t) => t.id.startsWith('sp_piece')).map((t) => t.tile)).toEqual(['core.room_sunk', 'core.room_sunk']);
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
      // The floor is at -0.5 all over the bay (a ray down from head height), nothing of the ground lies over it, and
      // there are 4 m from it to the ceiling.
      for (const x of [-3, -1.3, 0.2, 1.9, 3.4]) for (const z of [-2.6, -0.9, 0.8, 2.4, 4, 5.7, 7.5, 9.2, 10.6]) {
        const hit = physics.raycastHit({ x, y: 1.5, z }, { x: 0, y: -1, z: 0 }, 5);
        expect(hit?.dist, `grid ${grid.spacing}: the floor under (${x}, ${z})`).toBeCloseTo(2, 2);
        expect(physics.headroom({ x, y: -0.5, z }, 3.95, 0.3), `grid ${grid.spacing}: 4 m clear over (${x}, ${z})`).toBe(true);
      }
      // Outside the long walls the ground is at the doorways' level, not the sunk floor's (no ditch along the hall).
      const ground = mapTerrainMesh(map)!;
      expect(ground).toBeTruthy();
      for (const z of [-4.6, 12.6]) for (const x of [-3, 0, 3]) {
        const hit = physics.raycastHit({ x, y: 2, z }, { x: 0, y: -1, z: 0 }, 5);
        expect(2 - hit!.dist, `grid ${grid.spacing}: the ground outside at (${x}, ${z})`).toBeGreaterThan(-0.12);
        expect(2 - hit!.dist).toBeLessThan(0.06);
      }
    }
  });

  for (const [choice, ways] of [['door_south', [[0, false]]], ['door_north', [[0, true]]], ['doors', [[0, false], [0, true]]], ['main_south', [[-1.7, false], [1.7, false]]], ['main_north', [[-1.7, true], [1.7, true]]]] as const) {
    it(`sunk floor, ${choice}: bots and players go in and out through every doorway over its step, in every turn, on both ground grids`, { timeout: 480_000 }, () => {
      for (const grid of GRIDS) for (const { rotation, mirror } of TURNS) {
        const { at, local, yaw } = frame(rotation, mirror);
        const where = `${choice} turned ${rotation}${mirror ? ' mirrored' : ''}, grid ${grid.spacing}`;
        const { physics, nav } = world(one(BAY, rotation, mirror, { floor: 'sunk', walls: choice, furniture: 'none' }, grid));
        for (const [x, north] of ways) {
          const wall = north ? 12 : -4;
          const out = north ? 1 : -1;
          const outside: P3 = [x, 0, wall + out * 3];
          const inside: P3 = [x, -0.5, wall - out * 4];
          // Bots: in over the step and out again, straight through the doorway (7 m apart).
          for (const [a, b] of [[outside, inside], [inside, outside]]) {
            const path = nav.findPath(at(a!), at(b!));
            expect(path, `${where}: a path ${a} → ${b}`).toBeTruthy();
            const end = path!.at(-1)!;
            expect(Math.hypot(end.x - at(b!).x, end.y - b![1], end.z - at(b!).z), `${where}: ${a} → ${b} arrives`).toBeLessThan(0.6);
            expect(length(path!), `${where}: ${a} → ${b} is the straight way`).toBeLessThan(8.5);
          }
          // A player walks in (down two steps of 0.25 m onto the sunk floor) and out again (up onto the ground).
          const down = walk(physics, at([x, 0.1, wall + out * 2]), yaw(north ? Math.PI : 0), 110);
          expect((local(down.pos).z - wall) * out, `${where}: walked in at x ${x}`).toBeLessThan(-2);
          expect(down.pos.y, `${where}: stands on the sunk floor`).toBeCloseTo(-0.5, 1);
          const up = walk(physics, at([x, -0.45, wall - out * 3]), yaw(north ? 0 : Math.PI), 130);
          expect((local(up.pos).z - wall) * out, `${where}: walked out at x ${x}`).toBeGreaterThan(1);
          expect(up.pos.y, `${where}: stands on the ground outside`).toBeGreaterThan(-0.15);
        }
        nav.destroy();
      }
    });
  }

  it('sunk floor, west end Steps up: one step across the end, walked both ways; without it the end is a half-metre drop bots do not climb', { timeout: 240_000 }, () => {
    for (const grid of GRIDS) for (const { rotation, mirror } of TURNS) {
      const { at, local, yaw } = frame(rotation, mirror);
      const where = `turned ${rotation}${mirror ? ' mirrored' : ''}, grid ${grid.spacing}`;
      const { physics, nav } = world(one(BAY, rotation, mirror, { floor: 'sunk', end: 'steps', furniture: 'none' }, grid));
      for (const z of [-1, 4, 9]) {
        expect(miss(nav, at([-7, 0, z]), at([0, -0.5, z])), `${where}: in at the west end, z ${z}`).toBeLessThan(0.6);
        expect(miss(nav, at([0, -0.5, z]), at([-7, 0, z])), `${where}: out at the west end, z ${z}`).toBeLessThan(0.6);
        expect(length(nav.findPath(at([0, -0.5, z]), at([-7, 0, z]))!), `${where}: straight out`).toBeLessThan(8.5);
        const up = walk(physics, at([-1, -0.45, z]), yaw(-Math.PI / 2), 120);
        expect(local(up.pos).x, `${where}: walked up and out west at z ${z}`).toBeLessThan(-5);
      }
      // The east end has no step: from the ground beyond it nobody climbs back... but everybody may drop in.
      const back = nav.findPath(at([0, -0.5, 4]), at([7, 0, 4]));
      expect(!back || length(back) > 12 || Math.hypot(back.at(-1)!.x - at([7, 0, 4]).x, back.at(-1)!.z - at([7, 0, 4]).z) > 1.2, `${where}: no climb out of the open east end`).toBe(true);
      nav.destroy();
    }
  });

  it('every floor-standing part stands on its floor, every hung part hangs from the ceiling, whatever the choices', () => {
    const HUNG: Record<string, number> = { 'kit.roof.timber_bay': 2.8, 'kit.lamp.chandelier_bowl': 1.9, 'kit.board.flags': 1.78, 'prop.hm_chandelier': 2.5, 'prop.dg_banner': 0.9, 'kit.wall.arcade': -0.45 };
    for (const id of [BAY, 'setpiece.refectory_servery', 'setpiece.refectory_kitchen']) {
      const def = library.pieces.get(id)!;
      expect(checkSetPieceDefinition(def, { packs: library.packs })).toEqual([]);
      const others = def.options!.filter((o) => o.name !== 'floor');
      // Each choice of each option alone, and the fullest hall's, on both floors.
      const sets: Record<string, string>[] = [{}, ...others.flatMap((o) => o.choices.slice(1).map((c) => ({ [o.name]: c.value }))), ...(id === BAY ? [{ ceiling: 'timber', aisle: 'arcade', lights: 'bowls', flags: 'hung', furniture: 'rows_podium', end: 'fire_drinks' }, { aisle: 'arcade', furniture: 'rows_gap', end: 'fireplace' }, { aisle: 'arcade', furniture: 'rows', end: 'drinks', walls: 'doors' }] : [])];
      for (const set of sets) for (const [floor, y] of [['level', 0], ['sunk', -0.5]] as const) {
        const where = `${id} ${JSON.stringify({ ...set, floor })}`;
        const { tiles, entities } = setPieceParts({ id: 'p_1', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate', overrides: { options: { ...set, floor } } }, def, 'core.castle', library);
        expect(tiles.map((t) => t.tile), where).toEqual(floor === 'sunk' ? ['core.room_sunk', 'core.room_sunk'] : ['core.room', 'core.room']);
        const seen = new Set<string>();
        for (const e of entities) {
          if (e.kind === 'prop') {
            const size = getProp(e.model)!.size;
            const top = e.position[1] + size[1] * (e.scale ?? 1);
            if (HUNG[e.model] !== undefined) expect(e.position[1], `${where}: ${e.model} hangs`).toBeCloseTo(HUNG[e.model]!, 3);
            else expect(e.position[1], `${where}: ${e.model} stands on the floor`).toBe(y);
            expect(top, `${where}: ${e.model} stays under the ceiling`).toBeLessThanOrEqual(3.5 + 1e-6);
            // No twin: the same model twice in one place would be a level part and a sunk part both in play.
            const key = `${e.model}@${e.position[0].toFixed(2)},${e.position[2].toFixed(2)}`;
            expect(seen.has(key), `${where}: ${key} twice`).toBe(false);
            seen.add(key);
          }
          if (e.kind === 'block') {
            const bottom = e.position[1];
            // A block stands on the floor, on the level's own floor (a wall, a pier, a fireplace of the long walls) or is a lintel.
            expect(bottom === y || bottom === 0 || /Lintel|Mantel|Firebox|Chimney|Capital/.test(e.name ?? ''), `${where}: block ${e.name} at ${bottom}`).toBe(true);
            expect(bottom + e.size[1], `${where}: block ${e.name} stays under the ceiling`).toBeLessThanOrEqual(3.5 + 1e-6);
          }
        }
        // One steady light a bay (two with the hearth's): nothing here flickers (a light part has no effect to flicker with).
        expect(entities.filter((e) => e.kind === 'light').length, `${where}: lights`).toBe(set.end === 'fireplace' || set.end === 'fire_drinks' ? 2 : 1);
      }
    }
  });

  it('the arcade: bots and players pass through each arch, a pier stops a walk, the stone over an arch is solid; in every turn, on both floors', { timeout: 480_000 }, () => {
    for (const floor of ['level', 'sunk']) for (const { rotation, mirror } of TURNS) {
      const y = floor === 'sunk' ? -0.5 : 0;
      const { at, local, yaw } = frame(rotation, mirror);
      const where = `${floor} floor, turned ${rotation}${mirror ? ' mirrored' : ''}`;
      const { physics, nav } = world(one(BAY, rotation, mirror, { floor, aisle: 'arcade', furniture: 'none', end: 'wall' }));
      for (const x of [-2, 2]) {
        // Through the arch at x from the main hall into the aisle and back: the straight way (5 m), not round the end.
        for (const [a, b] of [[[x, y, 3], [x, y, -2]], [[x, y, -2], [x, y, 3]]] as P3[][]) {
          const path = nav.findPath(at(a!), at(b!));
          expect(path, `${where}: a path through the arch at x ${x}`).toBeTruthy();
          expect(Math.hypot(path!.at(-1)!.x - at(b!).x, path!.at(-1)!.z - at(b!).z), `${where}: arrives through the arch at x ${x}`).toBeLessThan(0.6);
          expect(length(path!), `${where}: straight through the arch at x ${x}`).toBeLessThan(6);
        }
        expect(local(walk(physics, at([x, y + 0.05, 2.5]), yaw(Math.PI), 100).pos).z, `${where}: walked south through the arch at x ${x}`).toBeLessThan(-1.5);
      }
      for (const x of [-3.9, 0, 3.9]) expect(local(walk(physics, at([x, y + 0.05, 2.5]), yaw(Math.PI), 100).pos).z, `${where}: the pier at x ${x} stops a walk`).toBeGreaterThan(0.6);
      // Over the arch's crown and over a pier the wall is solid up to the ceiling; under the crown it is open.
      const eye = (x: number, h: number) => physics.raycastHit(at([x, h, 3]), { x: at([0, 0, -1]).x - at([0, 0, 0]).x, y: 0, z: at([0, 0, -1]).z - at([0, 0, 0]).z }, 5.5)?.dist;
      expect(eye(-2, 3.2), `${where}: stone over the crown`).toBeCloseTo(2.7, 1);
      expect(eye(-2, y + 1.5) ?? 9, `${where}: open under the crown`).toBeGreaterThan(5);
      expect(eye(0, y + 1), `${where}: the pier`).toBeCloseTo(2.6, 1);
      nav.destroy();
    }
  });

  it('rows of mess tables: four rows, three aisles between them for bots, a cross aisle where asked, tables that collide and chairs that do not', { timeout: 480_000 }, () => {
    for (const floor of ['level', 'sunk']) for (const { rotation, mirror } of TURNS) {
      const y = floor === 'sunk' ? -0.5 : 0;
      const { at, local, yaw } = frame(rotation, mirror);
      const where = `${floor} floor, turned ${rotation}${mirror ? ' mirrored' : ''}`;
      for (const furniture of ['rows', 'rows_gap', 'rows_podium']) {
        // (A sunk bay alone ends in a half-metre drop each way, and a lane cut off between two rows is too small a
        // floor for the navmesh to keep: with Steps up at the west end the row's west tables are left out and the lanes
        // meet there, as they do in a hall.)
        const { physics, nav } = world(one(BAY, rotation, mirror, { floor, aisle: 'arcade', furniture, ...(floor === 'sunk' ? { end: 'steps' } : {}) }));
        // (Four rows evenly spaced: the three aisles between them are the lanes.)
        for (const z of [3.26, 6.07, 8.88]) {
          const [from, to]: P3[] = floor === 'sunk' ? [[-2.6, y, z], [3.1, y, z]] : [[-3.2, y, z], [3.4, y, z]];
          const path = nav.findPath(at(from!), at(to!));
          expect(path, `${where}, ${furniture}: the lane at z ${z}`).toBeTruthy();
          expect(Math.hypot(path!.at(-1)!.x - at(to!).x, path!.at(-1)!.z - at(to!).z), `${where}, ${furniture}: the lane at z ${z} arrives`).toBeLessThan(0.6);
          expect(length(path!), `${where}, ${furniture}: the lane at z ${z} is straight`).toBeLessThan(7.6);
        }
        const across = nav.findPath(at([0, y, 3.26]), at([0, y, 8.88]));
        // (Bots keep to the aisles between the rows: the side aisle behind the arcade is theirs only where it has no
        // small tables, a bay with a way in on its south side; players walk into it anywhere. The whole hall's walk has it.)
        if (furniture === 'rows_gap') expect(length(across!), `${where}: across the hall by the cross aisle`).toBeLessThan(6.5);
        // A table stops a walk across the rows; a chair does not (a player brushes through to the table's edge).
        const stopped = local(walk(physics, at([furniture === 'rows_gap' ? 3.05 : 1.95, y + 0.05, 3.26]), yaw(0), 100).pos);
        expect(stopped.z, `${where}, ${furniture}: stopped by the second row's table (z ${stopped.z.toFixed(2)})`).toBeLessThan(4.28);
        expect(stopped.z, `${where}, ${furniture}: walked through its chairs`).toBeGreaterThan(3.7);
        nav.destroy();
      }
    }
  });

  it('the west end: a wall, the fireplace wall and the drink stations close it; their pieces stand against it clear of the lanes', { timeout: 480_000 }, () => {
    for (const end of ['wall', 'fireplace', 'drinks', 'fire_drinks']) for (const floor of ['level', 'sunk']) for (const { rotation, mirror } of TURNS.filter((t) => end === 'fire_drinks' || !t.mirror)) {
      const y = floor === 'sunk' ? -0.5 : 0;
      const { at, local, yaw } = frame(rotation, mirror);
      const where = `${end}, ${floor} floor, turned ${rotation}${mirror ? ' mirrored' : ''}`;
      const map = one(BAY, rotation, mirror, { floor, aisle: 'arcade', furniture: 'rows', end, ...(floor === 'sunk' ? {} : {}) });
      const { physics, nav } = world(map);
      // Nobody walks out west; the cross way before the end wall joins the three aisles (the row's west tables are left out).
      expect(local(walk(physics, at([-1.5, y + 0.05, 8.88]), yaw(-Math.PI / 2), 120).pos).x, `${where}: the end is closed`).toBeGreaterThan(-3.6);
      const cross = nav.findPath(at([-1.4, y, 3.26]), at([-1.4, y, 8.88]));
      expect(cross, `${where}: across before the end wall`).toBeTruthy();
      expect(length(cross!), `${where}: across before the end wall, straight`).toBeLessThan(7.5);
      // Every prop of the end stands inside the bay, east of the wall's face.
      const wallFace = -3.5;
      for (const e of map.entities) if (e.kind === 'prop' && /fireplace|panel_window|drink_station/.test(e.model)) expect(local(v(e.position as P3)).x, `${where}: ${e.model}`).toBeGreaterThan(wallFace);
      nav.destroy();
    }
  });

  it('the serving line and the kitchen: round the line to the servers\' side, through the kitchen\'s doorway, out at its back door; in every turn, on both floors', { timeout: 480_000 }, () => {
    for (const floor of ['level', 'sunk']) for (const { rotation, mirror } of TURNS) {
      const y = floor === 'sunk' ? -0.5 : 0;
      const where = `${floor} floor, turned ${rotation}${mirror ? ' mirrored' : ''}`;
      // Two bays end to end along the pieces' own x: the serving bay, then the kitchen east of it (west of it, mirrored).
      const [dx, dz] = rotateXZ(mirror ? -1 : 1, 0, rotation);
      const base = { rotation, mirror, pack: 'collegiate' as const };
      const map = mapOf([
        { ...base, id: 'serve', piece: 'setpiece.refectory_servery', x: 0, y: 0, z: 0, overrides: { options: { floor } } },
        { ...base, id: 'kitchen', piece: 'setpiece.refectory_kitchen', x: dx, y: dz, z: 0, overrides: { options: { floor, end: 'door' } } },
      ]);
      const { at, local, yaw } = frame(rotation, mirror);
      const { physics, nav } = world(map);
      const hallSide: P3 = [-2.5, y, 5];
      const behind: P3 = [2.8, y, 8];
      const kitchen: P3 = [8, y, 1];
      const beyond: P3 = [14.5, 0, 4];
      const there = (a: P3, b: P3, max: number, what: string) => {
        const path = nav.findPath(at(a), at(b));
        expect(path, `${where}: ${what}`).toBeTruthy();
        expect(Math.hypot(path!.at(-1)!.x - at(b).x, path!.at(-1)!.y - b[1], path!.at(-1)!.z - at(b).z), `${where}: ${what} arrives`).toBeLessThan(0.6);
        expect(length(path!), `${where}: ${what} (${length(path!).toFixed(1)} m)`).toBeLessThan(max);
      };
      there(hallSide, behind, 18, 'round the south end of the line to the servers\' side');
      there(behind, kitchen, 13, 'from behind the line through the kitchen\'s doorway');
      there(hallSide, kitchen, 19, 'from the hall into the kitchen');
      there(kitchen, beyond, 12, 'out at the kitchen\'s back door');
      there(beyond, hallSide, 25, 'in at the back door and through to the hall');
      // The counters stop a walk east across the line; a player walks through the kitchen's doorway and out at the back door.
      expect(local(walk(physics, at([-2.5, y + 0.05, 8]), yaw(Math.PI / 2), 100).pos).x, `${where}: the line stops a walk`).toBeLessThan(0.2);
      expect(local(walk(physics, at([2.5, y + 0.05, 4]), yaw(Math.PI / 2), 80).pos).x, `${where}: walked into the kitchen`).toBeGreaterThan(5);
      expect(local(walk(physics, at([9, y + 0.05, 4]), yaw(Math.PI / 2), 120).pos).x, `${where}: walked out at the back door`).toBeGreaterThan(12.5);
      nav.destroy();
      // With the East end a wall, the kitchen is closed there.
      if (!mirror && floor === 'sunk') {
        const closed = world(mapOf([{ ...base, id: 'kitchen', piece: 'setpiece.refectory_kitchen', x: 0, y: 0, z: 0, overrides: { options: { floor, end: 'wall' } } }]));
        expect(local(walk(closed.physics, at([1, y + 0.05, 4]), yaw(Math.PI / 2), 120).pos).x, `${where}: the end wall`).toBeLessThan(3.4);
        closed.nav.destroy();
      }
    }
  });

  it("the whole hall as the owner drew it, under two floors, on both ground grids: every way in, every lane, the aisle, the line, the kitchen", { timeout: 480_000 }, () => {
    for (const grid of GRIDS) {
      const map = mapOf(messHall(), grid.spacing, grid.raise);
      const where = `grid ${grid.spacing}`;
      const { physics, nav } = world(map);
      const floor = -0.5;
      const middle = v([32, floor, 6.07]);
      const go = (a: Vec3, b: Vec3, max: number, what: string) => {
        const path = nav.findPath(a, b);
        expect(path, `${where}: ${what}`).toBeTruthy();
        expect(Math.hypot(path!.at(-1)!.x - b.x, path!.at(-1)!.y - b.y, path!.at(-1)!.z - b.z), `${where}: ${what} arrives`).toBeLessThan(0.6);
        expect(length(path!), `${where}: ${what} (${length(path!).toFixed(1)} m)`).toBeLessThan(max);
      };
      go(v([32, 0, 17]), middle, 13, 'from the court in at the north door');
      go(middle, v([32, 0, 17]), 13, 'and out again');
      go(v([32, 0, -9]), middle, 17, 'from the street in at the south door, through the aisle and an arch');
      for (const z of [3.26, 6.07, 8.88]) go(v([21.5, floor, z]), v([45, floor, z]), 25, `the aisle at z ${z}, end to end`);
      go(v([32, floor, 3.26]), v([30, floor, -2.2]), 9, 'from the cross aisle into the side aisle through an arch');
      go(v([45, floor, 5.73]), v([51, floor, 8]), 18, "round the line to the servers' side");
      go(middle, v([58, floor, 1]), 34, 'into the kitchen');
      go(v([58, floor, 1]), v([64, 0, 4]), 9, "out at the kitchen's back door to the east stair's lobby");
      go(middle, v([56, 4, 4]), 70, 'from the hall to the floor above by the east stair');
      go(v([56, 8, 4]), middle, 90, 'and down from the top floor into the hall');
      // The west end is closed by the fireplace wall: the west stair is reached round outside.
      expect(length(nav.findPath(v([8, 0, 8]), v([21.5, floor, 6.07]))!), `${where}: the west lobby is not on the hall`).toBeGreaterThan(40);
      nav.destroy();
      // A player walks in at the north door and stands on the sunk floor; 4 m of room over every lane.
      const inside = walk(physics, v([32, 0.1, 14]), Math.PI, 110);
      expect(inside.pos.z, `${where}: walked in`).toBeLessThan(9);
      expect(inside.pos.y).toBeCloseTo(-0.5, 1);
      for (const x of [22, 30, 38, 45, 50, 58]) for (const z of [3.26, 6.07, 8.88]) expect(physics.headroom({ x, y: floor, z }, 3.95, 0.3), `${where}: 4 m clear at (${x}, ${z})`).toBe(true);
      for (const x of [22, 30, 38]) expect(physics.headroom({ x, y: floor, z: -2 }, 3.95, 0.3), `${where}: the aisle at ${x}`).toBe(true);
    }
    // What it is made of: seven lights (one a bay and the hearth's), the kit's models.
    const map = mapOf(messHall());
    const mine = map.entities.filter((e) => /^sp_(mess_|serve|kitchen)/.test(e.id));
    expect(mine.filter((e) => e.kind === 'light')).toHaveLength(7);
    expect([...new Set(mine.flatMap((e) => (e.kind === 'prop' ? [e.model] : [])))].sort()).toEqual(['kit.appliance.fridge', 'kit.appliance.stove', 'kit.board.flags', 'kit.cabinet.kitchen', 'kit.door.walk_in', 'kit.lamp.chandelier_bowl', 'kit.monument.bell_stand', 'kit.roof.timber_bay', 'kit.shelf.end', 'kit.shop.drink_station', 'kit.shop.serving_line', 'kit.table.lectern', 'kit.table.mess', 'kit.table.mess_small', 'kit.wall.arcade', 'kit.wall.fireplace', 'kit.wall.panel_window', 'prop.dg_banner']);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    expect(validateMap(map).filter((i) => /^tunnel\./.test(i.code))).toEqual([]);
  });

  it('timber beams on piers: a pier with a capital under every beam on the north side, twin sashes between them, the aisles and the north door as they were', { timeout: 480_000 }, () => {
    const def = library.pieces.get(BAY)!;
    const parts = (options: Record<string, string>) => setPieceParts({ id: 'p_1', piece: BAY, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate', overrides: { options } }, def, 'core.castle', library);
    const blocks = (options: Record<string, string>, name: string) => parts(options).entities.filter((e) => e.kind === 'block' && e.name === name);
    // Three piers a bay where the north wall has its window (half a pier at each end, a whole one in the middle), each
    // 0.45 m deep with its capital's top under the beams (3.06 m); two where it has a way in or the fireplace.
    for (const floor of ['level', 'sunk']) {
      const piers = blocks({ ceiling: 'timber_piers', floor }, 'Beam pier');
      expect(piers.map((e) => (e.kind === 'block' ? [e.position[0], e.size[0]] : [])).sort((a, b) => a[0]! - b[0]!)).toEqual([[-3.75, 0.5], [0, 1], [3.75, 0.5]]);
      for (const e of [...piers, ...blocks({ ceiling: 'timber_piers', floor }, 'Capital')]) if (e.kind === 'block') expect(e.position[2] - e.size[2] / 2, 'no nearer the tables than the old wall pier').toBeGreaterThanOrEqual(10.95 - 1e-9);
      for (const e of blocks({ ceiling: 'timber_piers', floor }, 'Capital')) if (e.kind === 'block') expect(e.position[1] + e.size[1]).toBeCloseTo(3.06, 6);
      expect(blocks({ ceiling: 'timber_piers', floor }, 'Pier').map((e) => e.position[2]), 'the old north wall pier is left out').toEqual([-3.4]);
      expect(blocks({ ceiling: 'timber_piers', floor }, 'Pier foot')).toHaveLength(floor === 'sunk' ? 4 : 0);
      for (const walls of ['door_north', 'doors', 'main_north', 'fire_north']) expect(blocks({ ceiling: 'timber_piers', floor, walls }, 'Beam pier'), walls).toHaveLength(2);
      const north = parts({ ceiling: 'timber_piers', floor }).tiles.find((t) => t.y === 1)!;
      expect(north.edges?.['0,0,0:N']).toBe('windows_sash');
      expect(parts({ ceiling: 'timber', floor }).tiles.find((t) => t.y === 1)!.edges?.['0,0,0:N']).toBe('window_arched');
      expect(parts({ ceiling: 'timber_piers', floor }).entities.some((e) => e.kind === 'prop' && e.model === 'kit.roof.timber_bay')).toBe(true);
    }
    // In every turn: the three aisles between the rows as before, the middle pier solid, two panes of glass north.
    for (const { rotation, mirror } of TURNS) {
      const { at, local, yaw } = frame(rotation, mirror);
      const where = `turned ${rotation}${mirror ? ' mirrored' : ''}`;
      const map = one(BAY, rotation, mirror, { floor: 'sunk', ceiling: 'timber_piers', aisle: 'arcade', furniture: 'rows', end: 'steps' });
      const { physics, nav } = world(map);
      for (const z of [3.26, 6.07, 8.88]) {
        const path = nav.findPath(at([-2.6, -0.5, z]), at([3.1, -0.5, z]));
        expect(path && length(path), `${where}: the aisle at z ${z}`).toBeLessThan(6.6);
      }
      expect(local(walk(physics, at([-2, -0.45, 6.07]), yaw(0), 20).pos).z, `${where}: (a walk north starts)`).toBeGreaterThan(6.2);
      const hit = physics.raycastHit(at([0, 1, 8.9]), { x: at([0, 0, 1]).x - at([0, 0, 0]).x, y: 0, z: at([0, 0, 1]).z - at([0, 0, 0]).z }, 4);
      expect(hit?.dist, `${where}: the middle pier's face at z 11.05`).toBeCloseTo(2.15, 1);
      expect(windowPanes(map).filter((w) => w.id.includes(':0,0,0:N')).length, `${where}: two sashes north`).toBe(2);
      nav.destroy();
    }
    // The west bay of St. John's hall as it will be placed: the fireplace end, a door north with its step, the cross aisle.
    for (const grid of GRIDS) {
      const { physics, nav } = world(one(BAY, 0, false, { walls: 'door_north', floor: 'sunk', ceiling: 'timber_piers', aisle: 'arcade', furniture: 'rows_gap', end: 'fire_drinks', lights: 'bowls', flags: 'hung' }, grid));
      for (const [a, b] of [[[0, 0, 15], [0, -0.5, 6.07]], [[0, -0.5, 6.07], [0, 0, 15]]] as P3[][]) {
        const path = nav.findPath(v(a!), v(b!));
        expect(path, `grid ${grid.spacing}: ${a} → ${b}`).toBeTruthy();
        expect(Math.hypot(path!.at(-1)!.x - b![0], path!.at(-1)!.y - b![1], path!.at(-1)!.z - b![2]), `grid ${grid.spacing}: ${a} → ${b} arrives`).toBeLessThan(0.6);
        expect(length(path!), `grid ${grid.spacing}: ${a} → ${b} straight`).toBeLessThan(10.5);
      }
      const down = walk(physics, v([0, 0.1, 14]), Math.PI, 110);
      expect(down.pos.z, `grid ${grid.spacing}: walked in at the north door`).toBeLessThan(10);
      expect(down.pos.y).toBeCloseTo(-0.5, 1);
      nav.destroy();
    }
  });

  it('every new option starts at the bay as it was: a placement made before step 7d expands as before', () => {
    const def = library.pieces.get(BAY)!;
    expect(def.options!.map((o) => `${o.name}:${o.choices[0]!.value}`), 'first choices').toEqual(['walls:windows', 'floor:level', 'ceiling:plain', 'aisle:none', 'furniture:benches', 'lights:iron', 'flags:none', 'end:open']);
    const { tiles, entities } = setPieceParts({ id: 'p_1', piece: BAY, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }, def, 'core.castle', library);
    // The same parts by index as before the kit (ids are `sp_<placement>_<part index>`: 0-1 the tiles, 12-22 the rest).
    expect([...tiles.map((t) => t.id), ...entities.map((e) => e.id)].map((id) => Number(id.split('_').at(-1))).sort((a, b) => a - b)).toEqual([0, 1, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  });
});
