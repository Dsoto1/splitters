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
  boxCorners,
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

function mapOf(placements: SetPiecePlacement[], spacing = 2): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const r = loadMap(serializeMap({ ...map, setPieces: placements, terrain: newTerrain(200, spacing, [0, 0], 'grass') }));
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
const WALKS: Record<string, { chains: P3[][]; shut?: { from: P3; to: P3[] }; climbs?: { from: P3; yaw: number; ticks: number; up: number }[] }> = {
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
  'setpiece.refectory_bay': {
    chains: [[[-3, 0, 4], [3.5, 0, 4]], [[-2.6, 0, -2.4], [3.5, 0, -2.4]], [[-2.6, 0, 10.4], [3.5, 0, 10.4]]],
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
  // St. John's step 7c: the porch (in under its arch to its back, where the hall's doorway is) and the gate tower's
  // front (under the landing; up each outside stair to the landing and across it; down the other).
  'setpiece.entrance_porch': {
    chains: [[[0, 0, -3], [0, 0, 2.2], [0, 0, 3.5]]],
  },
  'setpiece.gate_tower_front': {
    chains: [[[0, 0, -3], [0, 0, 2.2], [0, 0, 3.5]], [[10.8, 0, -1], [10.8, 0, 2], [0, 4, 2], [-10.8, 0, 2], [0, 4, 2], [10.8, 0, 2]]],
    climbs: [{ from: [9.4, 0.3, 2], yaw: -Math.PI / 2, ticks: 100, up: 3.6 }, { from: [-9.4, 0.3, 2], yaw: Math.PI / 2, ticks: 100, up: 3.6 }],
  },
};

describe('the dormitory bays: every way through, every room, every stair, in every turn', () => {
  it('lists every piece of the family', () => {
    expect([...library.pieces.values()].filter((d) => d.family === 'academy').map((d) => d.id).sort()).toEqual(Object.keys(WALKS).sort());
  });
  for (const [id, { chains, shut, climbs }] of Object.entries(WALKS)) {
    it(`${id}: bots path along each chain; players climb; shut rooms stay shut`, { timeout: 240_000 }, () => {
      const def = library.pieces.get(id)!;
      const W = mirrorWidth(def);
      // (And with each choice of its options: the slim room doors, sim/passages.ts.)
      const choices: (Record<string, string> | undefined)[] = [undefined, ...(def.options ?? []).flatMap((o) => o.choices.slice(1).map((c) => ({ [o.name]: c.value })))];
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
 * The corner where the two halls meet, as the owner corrected it (St. John's step 7c), in DeKoven's frame above: the
 * main entrance is an Entrance Porch on the stair lobby's court side (west); the corridors join the mess hall wing's
 * dorm halls round the corner on the 2nd and the 3rd floor (the Stair End Bay's upper doors, a Dorm Entry Bay with its
 * side left open on each floor); the mess hall has a door by the clock tower; the reception has a Gate Tower Front,
 * its landing's door into the 2nd floor's corridor (an Admin Entry Bay with a Room doorway).
 */
function corner(): SetPiecePlacement[] {
  const at = (id: string, piece: string, x: number, y: number, z: number, rotation: Rotation = 0, options?: Record<string, string>): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate', ...(options ? { overrides: { options } } : {}) });
  const out = dekoven().filter((p) => !['mess', 'south', 'first3'].includes(p.id));
  out.push(at('south', 'setpiece.stair_end_bay_3', 1, 0, 0, 3, { lobbySide: 'door', upperDoor: 'end', topDoor: 'end', rails: 'metal' }));
  out.push(at('first3', 'setpiece.admin_entry_bay', 0, 3, 1, 1, { wayIn: 'door' }));
  out.push(at('porch', 'setpiece.entrance_porch', -1, 0, 0, 1), at('gate', 'setpiece.gate_tower_front', -1, 3, 0, 1));
  // The mess hall wing along x, cells -2 to 3 between its two stair ends, the clock tower by its west end.
  out.push(at('end_w', 'setpiece.stair_end_bay_3', -3, -2, 0, 0), at('end_e', 'setpiece.stair_end_bay_3', 4, -1, 0, 2), at('tower', 'setpiece.clock_tower', -3, 0, 0, 2));
  for (let x = -2; x <= 3; x++) {
    out.push(at(`mess_${x}`, 'setpiece.refectory_bay', x, -2, 0, 0, x === -2 ? { walls: 'door_north' } : x === 0 ? { walls: 'doors' } : undefined));
    for (const z of [1, 2]) {
      // The bay the corridor comes into: cell 0 on the 2nd floor (the stair's door is beside the hall's mouth), cell 1 on the 3rd.
      if (x === z - 1) out.push(at(`join_${z}`, 'setpiece.dorm_entry_bay', x, -1, z, 2, { roomDoors: 'slim', wayIn: 'open' }));
      else out.push(at(`dorm_${x}_${z}`, (x + z) % 2 ? 'setpiece.dorm_bay' : 'setpiece.dorm_bay_closed', x, -2, z, 0, { roomDoors: 'slim' }));
    }
  }
  return out;
}

describe("two halls joined at a corner: the porch, the corridors round the corner on two floors, the gate tower's landing (the DeKoven and Welles corner, St. John's step 7c)", () => {
  it('court to mess hall through the porch, the porch to the 2nd floor, the corridors into the dorm halls on the 2nd and 3rd floor, the clock tower door, each outside stair to the landing and the corridor', { timeout: 300_000 }, () => {
    const map = mapOf(corner());
    const nav = navOf(map);
    const length = (path: Vec3[]) => path.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.z - path[i - 1]!.z) : 0), 0);
    const route = (a: P3, b: P3, what: string, most: number, by?: (p: Vec3) => boolean): void => {
      const path = nav.findPath(v(a), v(b));
      expect(path, what).toBeTruthy();
      expect(Math.hypot(path!.at(-1)!.x - b[0], path!.at(-1)!.y - b[1], path!.at(-1)!.z - b[2]), `${what}: arrives`).toBeLessThan(1.2);
      expect(length(path!), `${what}: ${length(path!).toFixed(1)} m`).toBeLessThan(most);
      // (The way it goes: points every half metre along the path, a straight run has no corner to test.)
      const along: Vec3[] = [];
      path!.forEach((p, i) => {
        const q = path![i - 1] ?? p;
        const n = Math.ceil(Math.hypot(p.x - q.x, p.z - q.z) / 0.5) || 1;
        for (let k = 1; k <= n; k++) along.push({ x: q.x + ((p.x - q.x) * k) / n, y: q.y + ((p.y - q.y) * k) / n, z: q.z + ((p.z - q.z) * k) / n });
      });
      if (by) expect(along.some(by), `${what}: the way it goes`).toBe(true);
    };
    const near = (x: number, y: number, z: number, r = 1.8) => (p: Vec3) => Math.hypot(p.x - x, p.z - z) < r && Math.abs(p.y - y) < 1.5;
    // The porch (west of the lobby, its arch at x -7.25): from the court into the mess hall, and up to the 2nd floor.
    // (The mess hall is reached from inside the porch: from further out the door by the clock tower is as near.)
    route([-14, 0, 0], [1, 0, 0.5], 'court, porch, lobby', 18, near(-7.25, 0, 0));
    route([-6, 0, 0], [0, 0, -12], 'porch, lobby, mess hall', 20, near(0, 0, -4));
    route([-14, 0, 0], [4, 4, 12], 'court, porch, stair, 2nd floor corridor', 60, near(-7.25, 0, 0));
    // Round the corner: each corridor into the mess hall wing's dorm hall (its middle is z -12), to both of its ends,
    // through the stair bay's door on that floor (x 2.7 on the 2nd floor, x 8 on the 3rd; both in the wall at z -4).
    for (const [y, doorX] of [[4, 2.7], [8, 8]] as const) {
      route([4, y, 20], [-18, y, -12], `the corridor at ${y} m to the dorm hall's west end`, 75, near(doorX, y, -4, 1.6));
      route([4, y, 20], [26, y, -12], `the corridor at ${y} m to the dorm hall's east end`, 75, near(doorX, y, -4, 1.6));
      route([-18, y, -12], [4, y, 36], `the dorm hall at ${y} m to the corridor's north end`, 90, near(doorX, y, -4, 1.6));
    }
    // The clock tower (its door north, at z 4) and the mess hall's door beside it (x -16, in the wall at z -4).
    route([-24, 0, 7], [-16, 0, -12], "the clock tower's door to the mess hall", 34, near(-16, 0, -4));
    // The gate tower's front: under the landing into the reception; up each outside stair, across the landing and
    // through its door into the 2nd floor's corridor (not round by an inside stair).
    route([-14, 0, 24], [4, 0, 20], 'court, under the landing, reception, corridor', 30, near(-6, 0, 24));
    for (const [z, name] of [[13, 'south'], [35, 'north']] as const) {
      route([-12, 0, z], [4, 4, 24], `court, the ${name} outside stair, landing, 2nd floor corridor`, 34, near(-6, 4, 24, 2.4));
    }
    route([4, 4, 24], [-12, 0, 13], 'and down again from the corridor to the court', 34, near(-6, 4, 24, 2.4));
    nav.destroy();
    // Players: through the porch and its doorway into the lobby; up the south outside stair; across the landing through
    // the door; through the 3rd floor's door from the landing room into the dorm wing.
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    expect(walk(physics, v([-12, 0.05, 0]), Math.PI / 2, 220).pos.x, 'walked east through the porch into the lobby').toBeGreaterThan(-3);
    expect(walk(physics, v([-6, 0.3, 14.2]), 0, 105).pos.y, 'walked north up the south outside stair').toBeGreaterThan(3.6);
    expect(walk(physics, v([-6, 4.05, 24]), Math.PI / 2, 160).pos.x, 'walked east off the landing into the 2nd floor').toBeGreaterThan(-3);
    expect(walk(physics, v([8, 8.05, -1]), Math.PI, 160).pos.z, "walked south through the 3rd floor's door").toBeLessThan(-5.5);
    // The landing's parapet and the stairs' parapets hold: nobody walks off the landing's front or a stair's side.
    expect(walk(physics, v([-6, 4.05, 24]), -Math.PI / 2, 160).pos.y, "stopped by the landing's parapet").toBeGreaterThan(3.9);
    expect(walk(physics, v([-6, 2.3, 17.6]), -Math.PI / 2, 120).pos.y, "stopped by the stair's parapet").toBeGreaterThan(1.9);
  });

  it('the pointed arches: the ring stands proud of the wall on both faces, the wall behind it never dips into the opening, nothing is rolled past 45 degrees', () => {
    for (const [id, a, s, c, zFront] of [['setpiece.entrance_porch', 1.6, 1.7, 0.7, 0.5], ['setpiece.gate_tower_front', 1.7, 1.15, 0.7, 0]] as const) {
      const def = library.pieces.get(id)!;
      const { entities } = setPieceParts({ id: 'p_arch', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }, def, 'core.castle', library);
      const blocks = entities.flatMap((e) => (e.kind === 'block' ? [e] : []));
      const ring = blocks.filter((e) => /^Arch ring/.test(e.name ?? ''));
      expect(ring.length, id).toBe(9);
      for (const e of ring) {
        expect(Math.abs(e.roll ?? 0), `${id}: ${e.name}`).toBeLessThanOrEqual(Math.PI / 4 + 1e-6);
        expect(e.position[2] - e.size[2] / 2, `${id}: proud of the front`).toBeLessThan(zFront - 0.03);
        expect(e.position[2] + e.size[2] / 2, `${id}: proud of the back`).toBeGreaterThan(zFront + 0.5 + 0.03);
        // (Under the landing's top, 4 m: nothing of the ring shows through its floor.)
        if (id === 'setpiece.gate_tower_front') expect(Math.max(...boxCorners({ min: [e.position[0] - e.size[0] / 2, e.position[1], e.position[2] - e.size[2] / 2], max: [e.position[0] + e.size[0] / 2, e.position[1] + e.size[1], e.position[2] + e.size[2] / 2], roll: e.roll }).map((c) => c[1])), `${e.name}: under the landing`).toBeLessThan(4);
      }
      // The stone over the arch: each block's foot is on or over the opening's curve at its inner edge.
      const R = a + c;
      const over = blocks.filter((e) => /over the arch/.test(e.name ?? ''));
      expect(over.length, id).toBeGreaterThanOrEqual(3);
      for (const e of over) {
        const inner = Math.max(0, Math.abs(e.position[0]) - e.size[0] / 2);
        expect(e.position[1], `${id}: ${e.name} at x ${e.position[0]}`).toBeGreaterThanOrEqual(s + Math.sqrt(R * R - (inner + c) * (inner + c)) - 0.001);
      }
    }
  });

  it('black metal stair rails: every stair bay swaps each wooden rail for a Stair Railing in the same place; the railing stops a walk as the rail did', () => {
    const ids = ['setpiece.stair_end_bay', 'setpiece.stair_end_bay_3', 'setpiece.stair_end_bay_arched', 'setpiece.stair_end_bay_bridge', 'setpiece.stair_end_bay_roof', 'setpiece.stair_down_bay', 'setpiece.hall_centre'];
    for (const id of ids) {
      const def = library.pieces.get(id)!;
      const parts = (rails: string) => setPieceParts({ id: 'p_rails', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate', overrides: { options: { rails } } }, def, 'core.castle', library).entities;
      const wood = parts('wood').filter((e) => e.kind === 'block' && e.name === 'Stair rail');
      const metal = parts('metal');
      expect(wood.length, id).toBeGreaterThan(0);
      expect(metal.filter((e) => e.kind === 'block' && e.name === 'Stair rail'), id).toHaveLength(0);
      const railings = metal.filter((e) => e.kind === 'prop' && e.model === 'kit.fence.stair_rail');
      expect(railings.map((e) => e.position), id).toEqual(wood.map((e) => e.position));
    }
    const rail = getProp('kit.fence.stair_rail')!;
    expect(rail.size).toEqual([3.5, 1, 0.1]);
    expect(rail.boxes!.length).toBeGreaterThan(20);
    // On the 2nd floor's landing of a three-floor bay: walking at the rail over the first flight (z 1.95) from the north.
    for (const rails of ['wood', 'metal']) {
      const map = withPiece('setpiece.stair_end_bay_3', 0, false, { rails });
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
      const end = walk(physics, v([-1.75, 4.05, 3.4]), Math.PI, 120);
      expect(end.pos.z, `${rails}: stopped at the rail`).toBeGreaterThan(1.95);
      expect(end.pos.y, `${rails}: still on the landing`).toBeGreaterThan(3.9);
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
