// The academy family (content/setpieces/academy.json; docs/map-briefs/st_johns, step 1): the dormitory bays. Each
// piece is walked in every turn (and mirror, where it may be mirrored): bots path along the hall, into every open room
// and out again, up every stair; players climb the stairs; nobody gets into a shut room. Then the bays as they are
// meant to be used: end to end as one hall, on one floor, two and three, the stairs meeting floor to floor. What every
// piece shares (turns, packs, ids, the z-fight audit) is setPieceExpand.test.ts and setPiecePlay.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import {
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

function mapOf(placements: SetPiecePlacement[]): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const r = loadMap(serializeMap({ ...map, setPieces: placements, terrain: newTerrain(200, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}
const withPiece = (piece: string, rotation: Rotation, mirror = false): MapDocument => mapOf([{ id: 'piece', piece, x: 0, y: 0, z: 0, rotation, mirror, pack: 'collegiate' }]);

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
  'setpiece.dorm_office_bay': {
    // Along the hall past the stair on both floors; up the stair; into the bathrooms and the office on both floors.
    chains: [
      [[-7, 0, 4], [0, 0, 4.6], [8, 0, 5.2], [16, 0, 4.6], [23, 0, 4]],
      [[0, 0, 4.6], [0, 0, 0], [16, 4, 0], [16, 4, 4.6], [8, 4, 5.2], [0, 4, 4.6]],
      ...[0, 4].flatMap((y) => [0, 8, 16].map((x): P3[] => [[8, y, 5.2], [x === 8 ? 6.6 : x, y, 8.6], [8, y, 5.2]])),
    ],
    shut: { from: [8, 0, 5.2], to: [[16, 0, 0]] },
    climbs: [{ from: [4.6, 0.3, 0], yaw: Math.PI / 2, ticks: 260, up: 3.5 }],
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
      for (const rotation of ROTATIONS) {
        for (const mirror of def.mirror === 'free' ? [false, true] : [false]) {
          const map = withPiece(id, rotation, mirror);
          const nav = navOf(map);
          const at = (p: P3) => place(v(p), rotation, mirror, W);
          const where = `${id} turned ${rotation}${mirror ? ' mirrored' : ''}`;
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
    // Drawn as trim with that surface in a map; no collision box of the map comes from the sash.
    const map = mapOf([{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    const painted = buildMapDecor(map).filter((b) => b.surface?.material === 'core.paint_matte');
    expect(painted).toHaveLength(28);
    expect(painted.every((b) => b.kind === 'trim')).toBe(true);
    expect(buildMapGeometry(map).some((b) => b.surface?.material === 'core.paint_matte')).toBe(false);
  });

  it('the Room doorway is 2 m wide and 2.6 m high in an oak frame, whatever the trim; the Oak Door fits it', () => {
    expect(EDGE_SHAPES.door_room!.openings).toEqual([[-1, 1, 0, 2.6]]);
    expect(edgeSegments('door_room', 4, 4)).toContainEqual([-1, 1, 2.6, 4, 0.5]);
    const frame = edgeTrimBoxes('door_room', 4, 4).filter((p) => p.surface);
    expect(frame).toHaveLength(3);
    expect(frame.every((p) => p.surface!.material === 'core.oak_beam')).toBe(true);
    for (const id of ['kit.door.oak', 'kit.door.oak_ajar', 'kit.door.oak_open']) expect(getProp(id)!.size.slice(0, 2), id).toEqual([2, 2.6]);
    // Shut and ajar close the doorway (the slab in it); open leaves it clear.
    expect(getProp('kit.door.oak')!.collision).toEqual([2, 2.6, 0.16]);
    expect(getProp('kit.door.oak_ajar')!.boxes).toEqual([[-1, 0, -0.08, 1, 2.6, 0.08]]);
    expect(getProp('kit.door.oak_open')!.collision).toBeNull();
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
    expect(made('setpiece.dorm_bay')).toMatchObject({ tiles: 2, blocks: 14, props: 36, doors: 0, lights: 1, tileIds: ['core.room'] });
    expect(made('setpiece.dorm_bay').models).toEqual(['kit.bed.bunk', 'kit.cabinet.closet_front', 'kit.door.oak_open', 'kit.seat.chair', 'kit.table.desk_hutch', 'prop.hh_cupboard_sink']);
    expect(made('setpiece.dorm_bay_closed')).toMatchObject({ tiles: 2, blocks: 14, props: 30, doors: 0, lights: 1 });
    expect(made('setpiece.stair_end_bay')).toMatchObject({ tiles: 3, doors: 0, tileIds: ['core.room', 'core.stairwell'] });
    expect(made('setpiece.stair_end_bay_3')).toMatchObject({ tiles: 4, doors: 0, tileIds: ['core.room', 'core.stairwell'] });
    expect(made('setpiece.dorm_office_bay')).toMatchObject({ tiles: 11, doors: 0, tileIds: ['core.room', 'core.stairs'] });
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
    // 4 panes. (2026-11-12, with free-standing closets and one desk a room: 110.)
    expect(one.collision).toBeLessThanOrEqual(104);
    expect(one.trim).toBeLessThanOrEqual(135);
    expect(one.panes).toBe(4);
    expect(one.props).toBe(36);
  });

  it('the closets are in the entry wall: its face and the closet fronts line up, nothing behind, beside or over them is open', () => {
    const map = mapOf([{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'collegiate' }]);
    const fronts = map.entities.filter((e) => e.kind === 'prop' && e.model === 'kit.cabinet.closet_front');
    expect(fronts).toHaveLength(8);
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
