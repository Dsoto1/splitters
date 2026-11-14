// The Urban family (Tileset 11, docs/map-briefs/urban/URBAN_PLAN.md, step D): eight town set pieces built in MapMaker
// from pieces the game already had (content/setpieces/urban.json). Each is walked in every turn (and mirrored, where
// it may be): bots path along its ways through, players climb what looks climbable and come back down, the parking
// ramp's head meets the deck (on foot and for the vehicle probe), glass is glass, and nothing floats. What every piece
// shares (turns, packs, ids, the z-fight audit) is setPieceExpand.test.ts and setPiecePlay.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  buildMapGeometry,
  builtInSetPieces,
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
const IDS = ['setpiece.porch', 'setpiece.bus_shelter', 'setpiece.parking_deck_bay', 'setpiece.parking_deck_ramp', 'setpiece.concrete_frame', 'setpiece.concrete_frame_2', 'setpiece.bandstand', 'setpiece.shop_unit'];

/** A map of these placements on flat terrain at 0, each in the Urban & Civilian look. */
function withPieces(pieces: Pick<SetPiecePlacement, 'id' | 'piece' | 'x' | 'y'>[], rotation: Rotation = 0, mirror = false): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const setPieces: SetPiecePlacement[] = pieces.map((p) => ({ ...p, z: 0, rotation, mirror, pack: 'urban' }));
  const r = loadMap(serializeMap({ ...map, setPieces, terrain: newTerrain(200, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}
const withPiece = (piece: string, rotation: Rotation = 0, mirror = false) => withPieces([{ id: 'piece', piece, x: 0, y: 0 }], rotation, mirror);

/** A point of the piece's own frame where the placement puts it. */
function place(p: Vec3, rotation: Rotation, mirror: boolean, W: number): Vec3 {
  const x = mirror ? W * 8 - p.x : p.x;
  const [rx, rz] = rotateXZ(x, p.z, rotation);
  return { x: rx, y: p.y, z: rz };
}
const placeYaw = (yaw: number, rotation: Rotation, mirror: boolean) => (mirror ? -yaw : yaw) + (rotation * Math.PI) / 2;
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
/** How far a bot's path from a to b ends from b (Infinity: no path). */
function miss(nav: NavWorld, a: Vec3, b: Vec3): number {
  const path = nav.findPath(a, b);
  return path ? Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.y - b.y, path.at(-1)!.z - b.z) : Infinity;
}
const NORTH = 0;
const EAST = Math.PI / 2;
const SOUTH = Math.PI;
const WEST = -Math.PI / 2;

/**
 * Each piece's ways through, in its own frame (anchor cell's centre on its floor = 0, 0, 0; +z north): every point of a
 * chain is reached from the one before it. `walks`: a player walking straight from a point for some ticks ends within
 * 0.6 m of `to` across the ground and 0.1 m in height (a climb, a way down, or a stop at something solid).
 */
const WALKS: Record<string, { chains: [number, number, number][][]; walks?: { from: [number, number, number]; yaw: number; ticks: number; to: [number, number, number] }[] }> = {
  // Up the step onto the deck and along it; back down the step.
  'setpiece.porch': {
    chains: [[[0, 0, -3], [0, 0.3, 2.8], [-2.6, 0.3, 2.8]], [[2.6, 0.3, 2.8], [0, 0, -3]]],
    walks: [
      { from: [0, 0.02, -2], yaw: NORTH, ticks: 62, to: [0, 0.3, 3.2] },
      { from: [0, 0.32, 3], yaw: SOUTH, ticks: 60, to: [0, 0, -2.2] },
    ],
  },
  // In under the canopy to the seats; the back pane stops a player coming from behind.
  'setpiece.bus_shelter': {
    chains: [[[0, 0, -3], [-1.4, 0, 0.1]], [[0, 0, -3], [0, 0, 3]]],
    walks: [{ from: [1, 0.02, 3.4], yaw: SOUTH, ticks: 80, to: [1, 0, 1.75] }],
  },
  // Under the deck, between its columns, every way.
  'setpiece.parking_deck_bay': { chains: [[[-7, 0, 0], [0, 0, 0], [7, 0, 0]], [[0, 0, -7], [0, 0, 0], [0, 0, 7]]] },
  // Up the ramp to its head; under its head from side to side.
  'setpiece.parking_deck_ramp': {
    chains: [[[-7, 0, 0], [-3, 0, 0], [11.6, 4, 0]], [[11.6, 4, 0], [-7, 0, 0]], [[9, 0, -7], [11, 0, 0], [9, 0, 7]]],
    walks: [{ from: [-6, 0.02, 0], yaw: EAST, ticks: 222, to: [11.8, 4, 0] }],
  },
  'setpiece.concrete_frame': { chains: [[[-7, 0, 0], [0, 0, 0], [7, 0, 0]], [[0, 0, -7], [0, 0, 0], [0, 0, 7]]] },
  // Up the stair onto the upper floor; through the ground floor.
  'setpiece.concrete_frame_2': {
    chains: [[[-7, 0, 0], [8, 4, 0], [10.5, 4, 2.8]], [[8, 4, 0], [-7, 0, 0]], [[8, 0, -7], [8, 0, 0], [8, 0, 7]], [[8, 0, 0], [15, 0, 0]]],
    walks: [{ from: [-6, 0.02, 0], yaw: EAST, ticks: 203, to: [9.6, 4, 0] }],
  },
  // In through an arch on each side, onto the stage and off it.
  'setpiece.bandstand': {
    chains: [[[4, 0, -7], [4, 0.3, 4], [4, 0, 15]], [[-7, 0, 4], [4, 0.3, 4], [15, 0, 4]]],
    walks: [{ from: [4, 0.02, -0.5], yaw: NORTH, ticks: 50, to: [4, 0.3, 3.8] }],
  },
  // From the pavement in by the front door, and out by the back door; round behind the counter; round the pavement.
  'setpiece.shop_unit': {
    chains: [[[8, 0, 0], [8, 0, 8], [8, 0, 15]], [[8, 0, 8], [3.2, 0, 9], [-1, 0, 10.6]], [[-7, 0, 0], [0, 0, 0], [15, 0, 0]]],
    // The shopfront is glass: a player on the pavement walking at it is stopped at the wall line.
    walks: [{ from: [0, 0.02, 1], yaw: NORTH, ticks: 80, to: [0, 0, 3.6] }],
  },
};

describe('the Urban family: every way through, in every turn', () => {
  it('lists the eight pieces, each in the Urban & Civilian look first', () => {
    expect(Object.keys(WALKS)).toEqual(IDS);
    for (const id of IDS) {
      const def = library.pieces.get(id)!;
      expect(def, id).toBeDefined();
      expect(def.family, id).toBe('urban');
      expect(def.packs[0], id).toBe('urban');
    }
    expect([...library.pieces.values()].filter((d) => d.family === 'urban').map((d) => d.id)).toEqual(IDS);
  });
  for (const [id, { chains, walks }] of Object.entries(WALKS)) {
    it(`${id}: bots path along each chain; players walk where it looks walkable`, { timeout: 120_000 }, () => {
      const def = library.pieces.get(id)!;
      const W = mirrorWidth(def);
      for (const rotation of ROTATIONS) {
        for (const mirror of def.mirror === 'free' ? [false, true] : [false]) {
          const map = withPiece(id, rotation, mirror);
          const where = `${id} turned ${rotation}${mirror ? ' mirrored' : ''}`;
          const nav = navOf(map);
          const at = ([x, y, z]: [number, number, number]) => place({ x, y, z }, rotation, mirror, W);
          for (const chain of chains) for (let i = 1; i < chain.length; i++) expect(miss(nav, at(chain[i - 1]!), at(chain[i]!)), `${where}: ${chain[i - 1]} → ${chain[i]}`).toBeLessThan(1.2);
          nav.destroy();
          const physics = physicsOf(map);
          for (const w of walks ?? []) {
            const end = walk(physics, at(w.from), placeYaw(w.yaw, rotation, mirror), w.ticks);
            const to = at(w.to);
            expect(Math.hypot(end.pos.x - to.x, end.pos.z - to.z), `${where}: walked from ${w.from} to ${[end.pos.x, end.pos.y, end.pos.z].map((v) => v.toFixed(2))}, not ${w.to}`).toBeLessThan(0.6);
            expect(Math.abs(end.pos.y - to.y), `${where}: walked from ${w.from}, height ${end.pos.y.toFixed(2)}`).toBeLessThan(0.1);
          }
          physics.free();
        }
      }
    });
  }
});

describe('the parking deck: the ramp meets the deck', () => {
  // The ramp at the anchor (cells 0 and 1), a bay against its east end (cell 2) and one beyond (cell 3).
  const deck = () => withPieces([{ id: 'ramp', piece: 'setpiece.parking_deck_ramp', x: 0, y: 0 }, { id: 'bay_a', piece: 'setpiece.parking_deck_bay', x: 2, y: 0 }, { id: 'bay_b', piece: 'setpiece.parking_deck_bay', x: 3, y: 0 }]);

  it('a player walks up the ramp onto the deck and back down, and a bot paths both ways', () => {
    const map = deck();
    const physics = physicsOf(map);
    const up = walk(physics, { x: -6, y: 0.02, z: 0 }, EAST, 330);
    expect(up.pos.x, 'on the far bay').toBeGreaterThan(20);
    expect(up.pos.y, 'at the deck').toBeCloseTo(4, 1);
    const down = walk(physics, { x: 22, y: 4.02, z: 0 }, WEST, 400);
    expect(down.pos.x, 'off the ramp').toBeLessThan(-3);
    expect(down.pos.y, 'on the ground').toBeLessThan(0.1);
    // The deck's parapet (south) stops a walk off the edge; its open north edge does not.
    const south = walk(physics, { x: 16, y: 4.02, z: 0 }, SOUTH, 120);
    expect(south.pos.y).toBeCloseTo(4, 1);
    expect(south.pos.z).toBeGreaterThan(-3.6);
    physics.free();
    const nav = navOf(map);
    expect(miss(nav, { x: -7, y: 0, z: 0 }, { x: 24, y: 4, z: 0 })).toBeLessThan(1.2);
    expect(miss(nav, { x: 24, y: 4, z: 0 }, { x: -7, y: 0, z: 0 })).toBeLessThan(1.2);
    nav.destroy();
  });

  it('the vehicle probe drives up the ramp onto the deck and back down (plan step D3: "check that vehicles climb the ramp")', () => {
    const physics = physicsOf(deck());
    for (const radius of [0.7, 1.1]) {
      const probe = physics.createVehicleProbe(radius);
      const body = physics.createVehicleProbe(0.1);
      let feet = { x: -6, y: 0, z: 0 };
      const drive = (toX: number) => {
        for (let i = 0; i < 900 && Math.abs(toX - feet.x) > 0.05; i++) feet = physics.moveVehicle(probe, body, feet, { x: Math.sign(toX - feet.x) * 0.1, y: -0.2, z: 0 }).feet;
      };
      drive(20);
      expect(feet.x, `r${radius}: on the deck`).toBeGreaterThan(19.9);
      expect(feet.y, `r${radius}: at the deck`).toBeCloseTo(4, 1);
      drive(-6);
      expect(feet.x, `r${radius}: back off the ramp`).toBeLessThan(-5.9);
      expect(feet.y, `r${radius}: on the ground`).toBeLessThan(0.1);
    }
    physics.free();
  });

  it('the ramp is a slope a player walks (16 degrees), its head level with the deck', () => {
    const { entities } = setPieceParts({ id: 'p_1234', piece: 'setpiece.parking_deck_ramp', x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: 'urban' }, library.pieces.get('setpiece.parking_deck_ramp')!, 'core.city', library);
    const slab = entities.find((e) => e.kind === 'block' && e.roll && e.size[2] > 5);
    expect(slab && slab.kind === 'block' && ((slab.roll ?? 0) * 180) / Math.PI).toBeCloseTo(16, 3);
    const head = entities.find((e) => e.kind === 'block' && !e.roll && e.size[2] > 5);
    expect(head && head.kind === 'block' && head.position[1] + head.size[1]).toBeCloseTo(4, 5);
    expect(head && head.kind === 'block' && head.position[0] + head.size[0] / 2).toBeCloseTo(12, 5);
  });
});

describe('the Urban family is made of what it says, and stands on the ground', () => {
  const kinds = (id: string, pack = 'urban') => {
    const def = library.pieces.get(id)!;
    const { tiles, entities } = setPieceParts({ id: 'p_1234', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack }, def, 'core.city', library);
    const n = (k: string) => entities.filter((e) => e.kind === k).length;
    return { tiles: tiles.length, blocks: n('block'), props: n('prop'), doors: n('door'), lights: n('light'), tileIds: [...new Set(tiles.map((t) => t.tile))].sort(), entities, tileList: tiles };
  };

  it('each is made of the kit tiles, blocks, props, doors and lights it was built from in MapMaker', () => {
    expect(kinds('setpiece.porch')).toMatchObject({ tiles: 0, blocks: 7, props: 8, doors: 0, lights: 0 });
    expect(kinds('setpiece.bus_shelter')).toMatchObject({ tiles: 0, blocks: 8, props: 2 });
    expect(kinds('setpiece.parking_deck_bay')).toMatchObject({ tiles: 2, blocks: 2, props: 2, tileIds: ['core.platform'] });
    expect(kinds('setpiece.parking_deck_ramp')).toMatchObject({ tiles: 2, blocks: 6, props: 0, tileIds: ['core.platform'] });
    expect(kinds('setpiece.concrete_frame')).toMatchObject({ tiles: 1, blocks: 0, props: 2, tileIds: ['core.room'] });
    expect(kinds('setpiece.concrete_frame_2')).toMatchObject({ tiles: 3, blocks: 0, props: 1, tileIds: ['core.room', 'core.stairs_open'] });
    expect(kinds('setpiece.bandstand')).toMatchObject({ tiles: 4, blocks: 5, props: 0, tileIds: ['core.round_arcade_s'] });
    expect(kinds('setpiece.shop_unit')).toMatchObject({ tiles: 4, blocks: 0, props: 7, doors: 1, lights: 1, tileIds: ['core.platform', 'core.room'] });
    // Modest: none has more than 16 parts.
    for (const id of IDS) expect(library.pieces.get(id)!.parts.length, id).toBeLessThanOrEqual(16);
  });

  it('they take the look of the pack they are placed with: roles, not fixed materials', () => {
    const material = (id: string, pack: string) => kinds(id, pack).entities.flatMap((e) => (e.kind === 'block' && !e.glass ? [`${e.material}${e.tint ?? ''}`] : []));
    expect(new Set(material('setpiece.porch', 'urban'))).toEqual(new Set(['core.pbr_planks', 'core.pbr_concrete_dark']));
    expect(new Set(material('setpiece.porch', 'suburban'))).toEqual(new Set(['core.pbr_clapboard', 'core.pbr_slate_roof']));
    expect(new Set(material('setpiece.bus_shelter', 'urban'))).toEqual(new Set(['core.pbr_steel#7c8088']));
    // The road stays a road in every look; the concrete round it is the trim role.
    expect(new Set(material('setpiece.parking_deck_ramp', 'urban'))).toEqual(new Set(['core.pbr_asphalt', 'core.pbr_concrete#d6d2c8']));
    expect(new Set(material('setpiece.parking_deck_ramp', 'industrial'))).toEqual(new Set(['core.pbr_asphalt', 'core.pbr_steel#d8b040']));
    for (const pack of ['urban', 'industrial']) expect(kinds('setpiece.parking_deck_bay', pack).tileList.map((t) => t.surfaces?.floor?.material)).toEqual(['core.parking_bays', 'core.parking_bays']);
    const shop = kinds('setpiece.shop_unit').tileList.filter((t) => t.tile === 'core.room');
    expect(shop.map((t) => t.options?.facade)).toEqual(['brick', 'brick']);
    expect(shop.map((t) => t.surfaces?.floor?.material)).toEqual(['core.pbr_terrazzo', 'core.pbr_terrazzo']);
    expect(kinds('setpiece.shop_unit').entities.find((e) => e.kind === 'door')).toMatchObject({ style: 'oak', auto: true });
  });

  it('glass is glass: the shelter\'s three panes and the shopfront shatter in a town', () => {
    const panes = kinds('setpiece.bus_shelter').entities.filter((e) => e.kind === 'block' && e.glass);
    expect(panes.map((e) => e.kind === 'block' && e.glass)).toEqual(['breakable', 'breakable', 'breakable']);
    const front = kinds('setpiece.shop_unit').tileList.find((t) => Object.values(t.edges ?? {}).includes('shopfront'))!;
    const side = Object.entries(front.edges!).find(([, v]) => v === 'shopfront')![0];
    expect(front.glass?.[side]).toBe('breakable');
  });

  it('the deck has a half wall to crouch behind on its south side and no other wall', () => {
    const walls = buildMapGeometry(withPiece('setpiece.parking_deck_bay')).filter((b) => b.sourceId.startsWith('sp_piece_') && b.kind === 'wall');
    expect(walls.map((b) => [b.min.map((v) => +v.toFixed(2)), b.max.map((v) => +v.toFixed(2))])).toEqual([[[-4, 4, -4], [4, 5.1, -3.5]]]);
  });

  // Blocks over a floor (roofs, the canopy) hang from posts and walls and are not checked here; the ramp's tilted slabs
  // are walked in the tests above.
  it('nothing floats: every prop, and every untilted block on its level, stands on a floor, a block or the ground', () => {
    for (const id of IDS) {
      const map = withPiece(id, 0);
      const physics = physicsOf(map);
      for (const e of map.entities) {
        if (!e.id.startsWith('sp_piece_') || (e.kind !== 'prop' && e.kind !== 'block')) continue;
        if (e.kind === 'block' && (e.pitch || e.roll || e.glass || e.position[1] >= 3.5)) continue;
        if (e.kind === 'prop' && !getProp(e.model)?.collision) continue;
        const [x, y, z] = e.position;
        if (Math.abs(y) < 0.01) continue;
        const hit = physics.raycastHit({ x, y: y - 0.01, z }, { x: 0, y: -1, z: 0 }, 0.3);
        expect(hit, `${id}: ${e.kind} ${'model' in e ? e.model : ''} at ${e.position}`).not.toBeNull();
      }
      physics.free();
    }
  });
});
