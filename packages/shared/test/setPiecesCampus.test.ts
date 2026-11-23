// The campus family (content/setpieces/campus.json; docs/map-briefs/st_johns, steps 7-10: DeKoven's offices, Memorial
// Hall's library, the chapel, the gym and the pool), built ahead of the halls that will use them. Each piece is walked in
// every turn (and mirror, where it may be mirrored) and with each choice of its options: bots path along its halls and
// aisles, into its rooms, up the chapel's spiral stairs to the gallery, round the pool's deck; a player climbs a spiral
// stair; shut rooms stay shut. Then what each is made of and costs (St. John's is near its 4,096 entities). What every
// piece shares (ports, turns, packs, the z-fight audit) is setPieceExpand.test.ts and setPiecePlay.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  buildMapGeometry,
  builtInSetPieces,
  emptyInput,
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
  type MapDocument,
  type MoveState,
  type Rotation,
  type SetPiecePlacement,
  type Vec3,
} from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const library = builtInSetPieces();
const ROTATIONS = [0, 1, 2, 3] as Rotation[];
type P3 = [number, number, number];

function mapOf(placements: SetPiecePlacement[]): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const r = loadMap(serializeMap({ ...map, setPieces: placements, terrain: newTerrain(200, 2, [0, 0], 'grass') }));
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
function navOf(map: MapDocument): NavWorld {
  const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
}
/** How far a bot's path from a to b ends from b (Infinity: no path). */
function miss(nav: NavWorld, a: Vec3, b: Vec3): number {
  const path = nav.findPath(a, b);
  return path ? Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.y - b.y, path.at(-1)!.z - b.z) : Infinity;
}
const v = ([x, y, z]: P3): Vec3 => ({ x, y, z });

/** One way of walking a piece: with these options, every point of each chain is reached from the one before; `shut` are not. */
interface Walk {
  options?: Record<string, string>;
  chains: P3[][];
  shut?: { from: P3; to: P3[] };
  /** A closed end: from `from` to `to` (just past it) only the long way round, outside (a path at least `min` m long). */
  closed?: { from: P3; to: P3; min: number };
}

const hall = (y = 0): P3[] => [[-7, y, 4], [0, y, 4], [7, y, 4]];
const WALKS: Record<string, Walk[]> = {
  // DeKoven (step 7): along the hall past the trophy case; into each office at its back door, past the desk and out.
  'setpiece.admin_bay': [
    ...['display', 'plain', 'reception'].map((hallChoice): Walk => ({
      options: { hall: hallChoice },
      chains: [hall(), [[0, 0, 4], [2.3, 0, 1.0], [2.2, 0, -2.6], [-0.2, 0, -2.8], [0, 0, 4]], [[0, 0, 4], [2.3, 0, 7.0], [2.2, 0, 10.6], [-0.2, 0, 10.8], [0, 0, 4]]],
    })),
    { options: { offices: 'shut' }, chains: [hall(), [[0, 0, 4], [2.3, 0, 1.0], [2.2, 0, -2.6], [0, 0, 4]]], shut: { from: [0, 0, 4], to: [[2.2, 0, 10.6]] } },
    // A closed east end: in from the west only; past the wall only by going round outside.
    { options: { end: 'east', hall: 'plain' }, chains: [[[-3, 0, 4], [1.5, 0, 4]]], closed: { from: [0, 0, 4], to: [6, 0, 4], min: 30 } },
    // A basement's bay: solid outer walls, the same walks.
    { options: { walls: 'solid' }, chains: [hall(), [[0, 0, 4], [2.3, 0, 1.0], [2.2, 0, -2.6], [-0.2, 0, -2.8], [0, 0, 4]]] },
  ],
  // DeKoven's reception (step 7b): along the hall over the crest; in at the south arch past the desk; the north office.
  'setpiece.admin_entry_bay': [
    { chains: [hall(), [[0, 0, -7], [0, 0, -1], [0, 0, 4]], [[0, 0, 4], [2.3, 0, 7.0], [2.2, 0, 10.6], [-0.2, 0, 10.8], [0, 0, 4]], [[0, 0, 4], [-2.4, 0, -1.5]]] },
    { options: { offices: 'shut' }, chains: [hall(), [[0, 0, -7], [0, 0, 4]]], shut: { from: [0, 0, 4], to: [[2.2, 0, 10.6]] } },
  ],
  // Memorial Hall (step 8): along the reading room between the tables; in at the south door's arch; a closed end.
  'setpiece.library_bay': [
    { chains: [hall(), [[0, 0, 4], [-2.6, 0, -1.8], [2.6, 0, 9.8], [0, 0, 4]]] },
    { options: { door: 'south' }, chains: [hall(), [[0, 0, -7], [0, 0, -1.5], [0, 0, 4]]] },
    { options: { end: 'east' }, chains: [[[-7, 0, 4], [2.5, 0, 4]]], closed: { from: [0, 0, 4], to: [6, 0, 4], min: 20 } },
  ],
  // In at the porch's south door, through it and out of its north door.
  'setpiece.library_porch': [{ chains: [[[0, 0, -7], [0, 0, -1.5], [0, 0, 1.5], [0, 0, 7]]] }],
  // The two-storey library (step 8b). A bay: along the ground storey past the globe, along the upper storey down the
  // runner; in under its arch, through the porch and its door, where it has one.
  'setpiece.library_bay_2': [
    { chains: [[[-7, 0, 6.5], [7, 0, 6.5]], [[-3, 4, 4], [3, 4, 4]]] },
    { options: { door: 'south' }, chains: [[[0, 0, -7], [0, 0, -2], [0, 0, 1.5], [3, 0, 6.5]]] },
    { options: { door: 'north' }, chains: [[[0, 0, 15], [0, 0, 10], [0, 0, 6.5], [3, 0, 6.5]]] },
  ],
  // The end bay: in from the hall, up the spiral stair from its door to the floor above, along the upper storey; down again.
  'setpiece.library_end_bay_2': [
    { chains: [[[7, 0, 7], [-1, 0, 7], [0, 0, 4.5], [0, 4, 4.5], [3.5, 4, 4.5], [0, 4, 4.5], [0, 0, 4.5]]] },
    // Rounded corners (the Memorial Hall pass): the same stair (its drum against the corner now), and between the tall
    // cases in the north cell on both storeys.
    { options: { plan: 'rounded' }, chains: [[[7, 0, 7], [-1, 0, 7], [0, 0, 4.5], [0, 4, 4.5], [3.5, 4, 4.5], [0, 4, 4.5], [0, 0, 4.5]], [[7, 0, 7], [0, 0, 10.5]], [[3.5, 4, 4.5], [0, 4, 10.5]]] },
  ],
  // The faceted end: up the hall's bay to the stair's door, round the drum both ways, up the stair and back down the
  // runner; in at the bay's door where it has one.
  'setpiece.library_faceted_end': [
    { chains: [[[4, 0, -7], [4, 0, 2.5], [-1.2, 0, 6.2], [4, 0, 2.5], [9.2, 0, 6.2]], [[4, 0, 3.5], [4, 4, 3.5], [4, 4, -3], [4, 4, 3.5], [4, 0, 3.5]]] },
    { options: { door: 'east' }, chains: [[[15, 0, 0], [10, 0, 0], [6.5, 0, 0], [4, 0, 2.5]]] },
    { options: { door: 'west' }, chains: [[[-7, 0, 0], [-2, 0, 0], [1.5, 0, 0], [4, 0, 2.5]]] },
    // Rounded corners (the Memorial Hall pass): up the bay into the end among its cases, along the upper storey from
    // the bay into the end; in at the arch either side; onto the window bench's seat, either side.
    { options: { plan: 'rounded' }, chains: [[[4, 0, -7], [4, 0, 2.5], [4, 0, 7], [1, 0, 9.5], [4, 0, 7], [7, 0, 9.5]], [[4, 4, -3], [4, 4, 3.5], [4, 4, 8]]] },
    { options: { plan: 'rounded', door: 'east', bench: 'east' }, chains: [[[15, 0, 0], [10, 0, 0], [6.5, 0, 0], [4, 0, 2.5]], [[4, 4, 0], [10.9, 5, 0], [10.9, 5, 6]]] },
    { options: { plan: 'rounded', door: 'west', bench: 'west' }, chains: [[[-7, 0, 0], [-2, 0, 0], [1.5, 0, 0], [4, 0, 2.5]], [[4, 4, 0], [-2.9, 5, 0], [-2.9, 5, 6]]] },
  ],
  // Up the wing's steps and in at its door under the gable.
  'setpiece.gable_wing': [{ chains: [[[-0.5, 0, 7], [-0.5, 0.6, -1]]] }],
  // The chapel (step 9): the centre aisle between the pews and both side aisles behind the arcades.
  'setpiece.chapel_bay': ['blue', 'amber'].map((glass): Walk => ({ options: { glass }, chains: [hall(), [[-7, 0, -2.45], [0, 0, -2.45], [7, 0, -2.45]], [[-7, 0, 10.45], [0, 0, 10.45], [7, 0, 10.45]]] })),
  // From the nave up the steps to the altar; along each aisle through its end door: the sacristy and out of the back
  // door, the vestry by the organ and out of the north door.
  'setpiece.chapel_chancel': [
    {
      chains: [
        [[-7, 0, 4], [-1.5, 0.5, 4], [1.5, 0.5, 2.2]],
        [[-7, 0, -2.45], [-2.0, 0, -2.6], [0.5, 0, -1.6], [0, 0, -7]],
        [[-7, 0, 10.45], [-2.0, 0, 10.6], [0, 0, 9.4], [0, 0, 15]],
      ],
    },
  ],
  // In at the red doors along the passage to the nave; into each spiral stair and up it to the gallery; down again.
  'setpiece.chapel_narthex': [
    {
      chains: [
        [[-7, 0, 4], [0, 0, 4], [7, 0, 4]],
        [[0, 0, 4], [0, 0, 1.2], [0, 4, 4], [2.5, 4, 4]],
        [[0, 0, 4], [0, 0, 6.8], [0, 4, 4]],
        [[2.5, 4, 4], [0, 0, 6.8], [0, 0, 4]],
      ],
    },
  ],
  // The gym (step 10): across the court; up the bleachers; a closed end.
  'setpiece.gym_bay': [
    { chains: [hall().map(([x, y]): P3 => [x, y, 8]), [[0, 0, -2], [0, 0, 18]]] },
    { options: { bleachers: 'both' }, chains: [hall().map(([x, y]): P3 => [x, y, 8]), [[0, 0, 4], [0, 1.12, -3.0]], [[0, 0, 12], [0, 1.12, 19.0]]] },
    { options: { bleachers: 'south' }, chains: [[[0, 0, 4], [0, 1.12, -3.0]]] },
    { options: { bleachers: 'north' }, chains: [[[0, 0, 12], [0, 1.12, 19.0]]] },
    { options: { end: 'east' }, chains: [[[-7, 0, 8], [1.5, 0, 8]]], closed: { from: [0, 0, 8], to: [6, 0, 8], min: 30 } },
  ],
  // In at the wide door across the hall; up a ladder to the balcony and along it.
  'setpiece.gym_entrance': [{ chains: [[[-7, 0, 8], [0, 0, 8], [7, 0, 8]], [[0, 0, -2.2], [-2.0, 4, -1.5], [-2.0, 4, 17.5]]] }],
  // The pool: in at the south door onto the landing, up the steps onto the deck and round the pool on it.
  'setpiece.pool_hall': [{ chains: [[[0, 0, -7], [0, 0, -2], [6.5, 1.5, -1.5], [-2.25, 1.5, 12], [4, 1.5, 26], [10.25, 1.5, 12], [6.5, 1.5, -1.5], [0, 0, -2]]] }],
};

describe('the campus pieces: every way through, every room, every stair, in every turn', () => {
  it('lists every piece of the family', () => {
    expect([...library.pieces.values()].filter((d) => d.family === 'campus').map((d) => d.id).sort()).toEqual(Object.keys(WALKS).sort());
  });
  for (const [id, walks] of Object.entries(WALKS)) {
    it(`${id}: bots path along each chain; shut rooms stay shut`, { timeout: 300_000 }, () => {
      const def = library.pieces.get(id)!;
      const W = mirrorWidth(def);
      for (const { options, chains, shut, closed } of walks) {
        for (const rotation of ROTATIONS) {
          for (const mirror of def.mirror === 'free' ? [false, true] : [false]) {
            const nav = navOf(withPiece(id, rotation, mirror, options));
            const at = (p: P3) => place(v(p), rotation, mirror, W);
            const where = `${id} turned ${rotation}${mirror ? ' mirrored' : ''}${options ? ` ${JSON.stringify(options)}` : ''}`;
            for (const chain of chains) for (let i = 1; i < chain.length; i++) expect(miss(nav, at(chain[i - 1]!), at(chain[i]!)), `${where}: ${chain[i - 1]} → ${chain[i]}`).toBeLessThan(1.2);
            for (const to of shut?.to ?? []) expect(miss(nav, at(shut!.from), at(to)), `${where}: into the shut part at ${to}`).toBeGreaterThan(2);
            if (closed) {
              const path = nav.findPath(at(closed.from), at(closed.to));
              const length = path ? path.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.z - path[i - 1]!.z) : 0), 0) : Infinity;
              expect(length, `${where}: through the closed end`).toBeGreaterThan(closed.min);
            }
            nav.destroy();
          }
        }
      }
    });
  }
});

describe("Memorial Hall's rounded plan: real windows of breakable glass", () => {
  // Each pane fills a clear opening: a shot (and sight: glass lets both through) passes from 1 m inside to 1 m outside
  // 5 cm in from each of its edges, and is stopped by the wall 5 cm out past each (no gap round the glass).
  for (const [id, options] of [['setpiece.library_faceted_end', { plan: 'rounded', door: 'east' }], ['setpiece.library_faceted_end', { plan: 'rounded', door: 'none' }], ['setpiece.library_end_bay_2', { plan: 'rounded' }]] as const) {
    it(`${id} ${JSON.stringify(options)}: every pane is clear glass filling an open window`, () => {
      for (const rotation of ROTATIONS) {
        const map = withPiece(id, rotation, false, options);
        const panes = map.entities.filter((e): e is Extract<MapDocument['entities'][number], { kind: 'block' }> => e.kind === 'block' && e.glass === 'breakable');
        expect(panes.length, `${id} turned ${rotation}`).toBeGreaterThanOrEqual(id === 'setpiece.library_end_bay_2' ? 5 : 12);
        const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
        for (const b of panes) {
          // The pane's thin side is its normal (untilted, a quarter turn at most); u runs along the wall.
          const alongX = b.size[0] > b.size[2];
          const n = alongX ? { x: 0, z: 1 } : { x: 1, z: 0 };
          const hu = (alongX ? b.size[0] : b.size[2]) / 2;
          const at = (du: number, y: number, s: number) => ({ x: b.position[0] + (alongX ? du : 0) + s * n.x, y, z: b.position[2] + (alongX ? 0 : du) + s * n.z });
          const shot = (du: number, y: number) => physics.shotLine(at(du, y, -1), at(du, y, 1)) && physics.lineOfSight(at(du, y, -1), at(du, y, 1));
          const y0 = b.position[1];
          const y1 = y0 + b.size[1];
          const ym = (y0 + y1) / 2;
          const where = `${id} turned ${rotation}: the pane at ${b.position}`;
          for (const [du, y] of [[0, ym], [-hu + 0.05, ym], [hu - 0.05, ym], [0, y0 + 0.05], [0, y1 - 0.05]] as const) expect(shot(du, y), `${where}: through it at ${du}, ${y}`).toBe(true);
          for (const [du, y] of [[-hu - 0.05, ym], [hu + 0.05, ym], [0, y0 - 0.05], [0, y1 + 0.05]] as const) expect(shot(du, y), `${where}: past its edge at ${du}, ${y}`).toBe(false);
        }
        physics.free();
      }
    });
  }
});

describe('the spiral stair (core.stair_spiral)', () => {
  /** A player steered round the stair: each tick, toward a point a little further round (clockwise seen from above). */
  function climb(physics: PhysicsWorld, centre: Vec3, from: Vec3, ticks: number, r = 1.7): number {
    const collider = physics.createPlayerCollider();
    let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
    let top = s.pos.y;
    for (let i = 0; i < ticks; i++) {
      const a = Math.atan2(s.pos.z - centre.z, s.pos.x - centre.x) - 0.45;
      const tx = centre.x + r * Math.cos(a);
      const tz = centre.z + r * Math.sin(a);
      s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw: Math.atan2(tx - s.pos.x, tz - s.pos.z) });
      top = Math.max(top, s.pos.y);
    }
    physics.removeCollider(collider);
    // (Steered on round, it walks off the top landing's far edge again: the highest it got.)
    return top;
  }
  it('a player walks up it, round one turn, to the floor above (both of the narthex\'s)', () => {
    const map = withPiece('setpiece.chapel_narthex', 0);
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    // The south stair: its shaft's centre 0.25 m south of the cell's; in at the landing inside its north door.
    expect(climb(physics, { x: 0, y: 0, z: -0.25 }, { x: 0.2, y: 0.05, z: 1.3 }, 200)).toBeGreaterThan(3.9);
    // The north stair, turned half round: its centre 0.25 m north of the north cell's.
    expect(climb(physics, { x: 0, y: 0, z: 8.25 }, { x: -0.2, y: 0.05, z: 6.7 }, 200)).toBeGreaterThan(3.9);
  });
});

describe('what the campus pieces are made of, and what they cost', () => {
  const made = (id: string, options?: Record<string, string>) => {
    const def = library.pieces.get(id)!;
    const { tiles, entities } = setPieceParts({ id: 'p_1234', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate', ...(options ? { overrides: { options } } : {}) }, def, 'core.castle', library);
    const n = (k: string) => entities.filter((e) => e.kind === k).length;
    return { tiles: tiles.length, entities: entities.length, blocks: n('block'), props: n('prop'), lights: n('light'), doors: n('door'), water: n('water'), ladders: n('ladder'), tileIds: [...new Set(tiles.map((t) => t.tile))].sort() };
  };
  it('each is the tiles, blocks, props and lights it says (entities as placed, for the budget)', () => {
    expect(made('setpiece.admin_bay')).toMatchObject({ tiles: 2, blocks: 14, props: 10, lights: 1, doors: 0, entities: 25 });
    expect(made('setpiece.admin_bay', { hall: 'plain', offices: 'shut' })).toMatchObject({ props: 5, entities: 20 });
    expect(made('setpiece.admin_bay', { hall: 'reception' })).toMatchObject({ props: 11, entities: 26 });
    expect(made('setpiece.library_bay')).toMatchObject({ tiles: 2, blocks: 0, props: 6, lights: 1, entities: 7, tileIds: ['core.hall_tall'] });
    expect(made('setpiece.library_porch')).toMatchObject({ tiles: 1, props: 1, lights: 1, entities: 2, tileIds: ['core.porch_round'] });
    expect(made('setpiece.chapel_bay')).toMatchObject({ tiles: 2, blocks: 6, props: 4, lights: 1, entities: 11 });
    expect(made('setpiece.chapel_chancel')).toMatchObject({ tiles: 2, blocks: 9, props: 5, lights: 2, entities: 16 });
    expect(made('setpiece.chapel_narthex')).toMatchObject({ tiles: 2, blocks: 3, props: 2, lights: 2, entities: 7, tileIds: ['core.stair_spiral'] });
    expect(made('setpiece.gym_bay')).toMatchObject({ tiles: 3, props: 1, lights: 1, entities: 2 });
    expect(made('setpiece.gym_bay', { bleachers: 'both', end: 'east' })).toMatchObject({ props: 4, entities: 5 });
    expect(made('setpiece.gym_entrance')).toMatchObject({ tiles: 3, blocks: 2, ladders: 2, props: 2, lights: 1, entities: 7 });
    expect(made('setpiece.pool_hall')).toMatchObject({ tiles: 8, blocks: 11, water: 1, ladders: 1, props: 1, lights: 2, entities: 16 });
  });
  it("the pool's water fills its basin (turned with the piece) and the deck stands over it", () => {
    for (const rotation of ROTATIONS) {
      const map = withPiece('setpiece.pool_hall', rotation);
      const water = map.entities.filter((e) => e.kind === 'water');
      expect(water).toHaveLength(1);
      const w = water[0] as Extract<MapDocument['entities'][number], { kind: 'water' }>;
      const [cx, cz] = rotateXZ(4, 13.5, rotation);
      expect(w.position[0]).toBeCloseTo(cx);
      expect(w.position[2]).toBeCloseTo(cz);
      // 10 m across, 22 m long, its long way along the piece's z whatever the turn.
      expect([...w.size].sort((a, b) => a - b)).toEqual([1.4, 10, 22]);
      expect(rotation % 2 === 0 ? w.size[2] : w.size[0]).toBe(22);
    }
  });
});
