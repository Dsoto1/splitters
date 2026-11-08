// Set pieces part 5 (docs/SET_PIECES_PLAN.md, "As built: part 5"): the brainstorm list's twelve pieces in play, and
// the retired tiles' alias table. Every piece is walked through: bots path between its ways in, up both ends of every
// climb (stairs, ramps, the atrium's floors, the gallery) and into each room, in every turn (and mirror, where it may
// be mirrored); players climb the stairs. What every piece shares (turns, packs, ids, the z-fight audit, the walled
// ports) is setPieceExpand.test.ts and setPiecePlay.test.ts; the open-sided ones' ways through are here.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  TILE_ALIASES,
  applyCommand,
  buildMapGeometry,
  builtInSetPieces,
  emptyInput,
  initPhysics,
  invertCommand,
  loadMap,
  mapTerrainMesh,
  mirrorWidth,
  navLinks,
  newTerrain,
  replaceTilesWithSetPieceCommand,
  rotateXZ,
  serializeMap,
  setPieceParts,
  stepMovement,
  withTileAliases,
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

/** A map with one piece at (0, 0) on flat terrain at 0, in its first look. */
function withPiece(piece: string, rotation: Rotation, mirror = false): MapDocument {
  const def = library.pieces.get(piece)!;
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const p: SetPiecePlacement = { id: 'piece', piece, x: 0, y: 0, z: 0, rotation, mirror, pack: def.packs[0] };
  const r = loadMap(serializeMap({ ...map, setPieces: [p], terrain: newTerrain(200, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}

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

/**
 * Each piece's ways through, in its own frame (anchor cell's centre on its floor = 0, 0, 0; +z north): every point is
 * reached from the one before it (a chain), so each climb is proved from its foot to its head and on.
 */
const WALKS: Record<string, { chains: [number, number, number][][]; climbs?: { from: [number, number, number]; yaw: number; ticks: number; up: number }[] }> = {
  'setpiece.power_core_hall': {
    // In by the south door, up the west stair to the gallery, round it to the east side, down the east stair, out north.
    chains: [[[8, 0, -7], [8, 0, 2], [9.4, 0, 3], [-2, 4, 3], [-2, 4, 8], [8, 4, 18], [18, 4, 8], [18, 4, 14], [6.5, 0, 13], [8, 0, 23]], [[-7, 0, 8], [8, 0, 2], [23, 0, 8]]],
    climbs: [{ from: [9.5, 0.02, 3], yaw: -Math.PI / 2, ticks: 240, up: 4 }],
  },
  'setpiece.catwalk_bridge_2': { chains: [[[0, 0, -7], [0, 4, 6], [0, 4, 11]], [[-6, 0, 8], [0, 0, 8], [6, 0, 8]]], climbs: [{ from: [0, 0.02, -6], yaw: 0, ticks: 140, up: 4 }] },
  'setpiece.catwalk_bridge_3': { chains: [[[0, 0, -7], [0, 4, 8], [0, 0, 23]], [[-6, 0, 8], [0, 0, 8], [6, 0, 8]]], climbs: [{ from: [0, 0.02, -6], yaw: 0, ticks: 140, up: 4 }] },
  'setpiece.catwalk_bridge_4': { chains: [[[0, 0, -7], [0, 4, 8], [0, 4, 16], [0, 0, 31]]] },
  'setpiece.twin_stair_overlook': {
    chains: [[[-7, 0, 0], [8, 4, 0], [23, 0, 0]], [[8, 0, -7], [8, 0, 0], [8, 0, 7]]],
    climbs: [{ from: [-6, 0.02, 0], yaw: Math.PI / 2, ticks: 240, up: 4 }, { from: [22, 0.02, 0], yaw: -Math.PI / 2, ticks: 240, up: 4 }],
  },
  'setpiece.atrium_tower': {
    // Ground, the first-floor balcony, an office, the stairwell up to the upper atrium's floor, its balcony, the top offices.
    chains: [[[0, 0, -7], [4, 0, 6], [4, 4, 10.8], [16, 4, 0], [10.8, 4, 8], [4, 8, 4], [4, 12, 10.8], [16, 12, 0], [16, 12, 8]], [[23, 0, 0], [16, 0, 8], [16, 0, 15]]],
  },
  'setpiece.loading_dock': { chains: [[[8, 0, -6], [4, 1, 8], [16, 1, 8]], [[-7, 0, -2], [23, 0, -2]]] },
  'setpiece.sunken_arena': {
    chains: [[[8, 0, -7], [8, -2, 8], [8, 0, 23]], [[-7, 0, 8], [8, -2, 8], [23, 0, 8]], [[-7, 0, -7], [-3, 0, -3], [-3, 0, 19]]],
    climbs: [{ from: [8, -1.98, 13], yaw: 0, ticks: 240, up: 2 }],
  },
  'setpiece.reactor_room': {
    // In by the hall's door, up its stair to the catwalk, into the control room; out by the airlock; into the pump room.
    chains: [[[0, 0, -7], [0, 0, 6], [0, 4, 11], [10.8, 4, 8], [16, 4, 2]], [[23, 0, 0], [16, 0, 0], [8, 0, -3]], [[16, 0, 15], [16, 0, 8], [8, 0, 8]]],
  },
  'setpiece.bunker_cluster': { chains: [[[8, 0, -7], [8, 0, 8], [0, 0, 8]], [[8, 0, 8], [16, 0, 8]], [[8, 0, 8], [8, 0, 16]], [[-7, 0, 0], [23, 0, 0]]] },
  'setpiece.courtyard_gate': {
    chains: [[[8, 0, -7], [8, 0, 0], [8, 0, 7]], [[8, 0, 0], [16, 0, 0]], [[8, 0, 0], [8, 4, 0], [16, 4, 0]]],
  },
  'setpiece.server_vault': { chains: [[[0, 0, -7], [0, 0, -1], [0, 0, 7], [8, 0, 7], [8, 0, -1]], [[8, 0, 7], [15, 0, 8]]] },
  'setpiece.crossroads_plaza': { chains: [[[8, 0, -7], [8, 0, 8], [8, 0, 23]], [[-7, 0, 8], [8, 0, 8], [23, 0, 8]], [[8, 0, 8], [1, 0.15, 1], [15, 0.15, 15]]] },
  'setpiece.ramp_junction': {
    // Up the first ramp to the deck, on up the second to its head; under the deck, the corridor west under the second ramp.
    chains: [[[-7, 0, 0], [16, 4, 0], [16, 4, 8], [-2, 8, 8]], [[16, 0, -7], [16, 0, 8], [23, 0, 4]], [[16, 0, 8], [8, 0, 8], [-7, 0, 8]]],
    climbs: [{ from: [-6, 0.02, 0], yaw: Math.PI / 2, ticks: 300, up: 4 }],
  },
};

describe('the brainstorm list: every way through, every climb, in every turn', () => {
  it('lists every new piece', () => {
    for (const id of Object.keys(WALKS)) expect(library.pieces.has(id), id).toBe(true);
    expect(Object.keys(WALKS)).toHaveLength(14);
  });
  for (const [id, { chains, climbs }] of Object.entries(WALKS)) {
    it(`${id}: bots path along each chain; players climb`, { timeout: 120_000 }, () => {
      const def = library.pieces.get(id)!;
      const W = mirrorWidth(def);
      for (const rotation of ROTATIONS) {
        for (const mirror of def.mirror === 'free' ? [false, true] : [false]) {
          const map = withPiece(id, rotation, mirror);
          const nav = navOf(map);
          const at = ([x, y, z]: [number, number, number]) => place({ x, y, z }, rotation, mirror, W);
          for (const chain of chains) {
            for (let i = 1; i < chain.length; i++) {
              expect(miss(nav, at(chain[i - 1]!), at(chain[i]!)), `${id} turned ${rotation}${mirror ? ' mirrored' : ''}: ${chain[i - 1]} → ${chain[i]}`).toBeLessThan(1.2);
            }
          }
          nav.destroy();
          const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
          for (const c of climbs ?? []) {
            const end = walk(physics, at(c.from), placeYaw(c.yaw, rotation, mirror), c.ticks);
            expect(end.pos.y - c.from[1], `${id} turned ${rotation}${mirror ? ' mirrored' : ''}: climbed from ${c.from}`).toBeGreaterThan(c.up - 0.3);
          }
        }
      }
    });
  }
});

describe('the new pieces expand into what they are made of', () => {
  const kinds = (id: string) => {
    const def = library.pieces.get(id)!;
    const { tiles, entities } = setPieceParts({ id: 'p_1234', piece: id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, pack: def.packs[0] }, def, 'core.prototype', library);
    const n = (k: string) => entities.filter((e) => e.kind === k).length;
    return { tiles: tiles.length, blocks: n('block'), props: n('prop'), doors: n('door'), lights: n('light'), tileIds: [...new Set(tiles.map((t) => t.tile))].sort() };
  };
  it('each is made of the kit tiles, blocks, props, doors and lights it says', () => {
    expect(kinds('setpiece.power_core_hall')).toMatchObject({ tiles: 9, doors: 6, tileIds: ['core.room_tall'] });
    expect(kinds('setpiece.power_core_hall').blocks).toBeGreaterThan(40);
    expect(kinds('setpiece.catwalk_bridge_2')).toMatchObject({ tiles: 3, doors: 0, tileIds: ['core.bridge', 'core.stairs_open', 'core.yard'] });
    expect(kinds('setpiece.catwalk_bridge_3').tileIds).toEqual(['core.bridge', 'core.stairs_open', 'core.yard']);
    expect(kinds('setpiece.twin_stair_overlook')).toMatchObject({ tiles: 4, tileIds: ['core.platform', 'core.room', 'core.stairs_open'] });
    expect(kinds('setpiece.atrium_tower')).toMatchObject({ tiles: 9, doors: 4, tileIds: ['core.atrium', 'core.room', 'core.stairwell'] });
    expect(kinds('setpiece.loading_dock')).toMatchObject({ tiles: 6, tileIds: ['core.room', 'core.terrace'] });
    expect(kinds('setpiece.sunken_arena')).toMatchObject({ tiles: 9, tileIds: ['core.arena_pit', 'core.arena_tiers', 'core.arena_tiers_corner'] });
    expect(kinds('setpiece.reactor_room')).toMatchObject({ tiles: 5, doors: 5, tileIds: ['core.corridor_clear', 'core.room', 'orbital.reactor_hall'] });
    expect(kinds('setpiece.bunker_cluster')).toMatchObject({ tiles: 5, doors: 3, lights: 3, tileIds: ['core.room', 'core.yard', 'core.yard_wall'] });
    expect(kinds('setpiece.courtyard_gate')).toMatchObject({ tiles: 5, doors: 3, tileIds: ['core.room', 'core.stairwell'] });
    expect(kinds('setpiece.server_vault')).toMatchObject({ tiles: 4, doors: 4, tileIds: ['core.room'] });
    expect(kinds('setpiece.crossroads_plaza')).toMatchObject({ tiles: 9, tileIds: ['core.intersection', 'core.street', 'core.yard'] });
    expect(kinds('setpiece.ramp_junction')).toMatchObject({ tiles: 8, tileIds: ['core.corridor_clear', 'core.platform_rail', 'core.ramp', 'core.room'] });
  });

  it('the sunken arena carves its own hollow in the terrain: the ground under its pit is 2 m down', () => {
    const map = withPiece('setpiece.sunken_arena', 0);
    const t = map.terrain!;
    const h = (x: number, z: number) => t.baseY + t.heights[Math.round((z - t.origin[1]) / t.spacing) * t.cols + Math.round((x - t.origin[0]) / t.spacing)]! / 100;
    expect(h(8, 8)).toBeLessThan(-2);
    expect(h(-12, -12)).toBeCloseTo(0, 1);
  });
});

describe('retired tiles: the alias table', () => {
  const gantryMap = (): MapDocument => {
    const map = makeMap(
      [
        { id: 'home_room', tile: 'core.room', x: -3, y: 0, z: 0, rotation: 0 },
        { id: 'tile_040', tile: 'military.gantry', x: 2, y: 4, z: 0, rotation: 0 },
        { id: 'gantry_turned_with_a_very_long_id_that_is_past_forty_eight_chars', tile: 'military.gantry', x: 6, y: 0, z: 0, rotation: 1 },
      ],
      [[-24, 0, 0]],
    );
    return { ...map, classicStructure: { ...map.classicStructure, theme: 'core.military' } };
  };

  it('the Catwalk Gantry is retired for the Catwalk Bridge (Up), which covers its exact cells and levels', () => {
    expect(TILE_ALIASES.get('military.gantry')).toBe('setpiece.catwalk_bridge_2');
  });

  it('as played, a retired tile loads as its set piece at the same cell, level and turn, and the map serializes the piece', () => {
    const r = loadMap(serializeMap(gantryMap()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.map.classicStructure.tiles.some((t) => t.tile === 'military.gantry')).toBe(false);
    // Its parts are there as played: the stair and the deck, ids from the placement (the tile's own id where it fits).
    const ids = r.map.classicStructure.tiles.map((t) => t.id);
    expect(ids).toContain('sp_tile_040_0');
    expect(r.map.classicStructure.tiles.find((t) => t.id === 'sp_tile_040_0')).toMatchObject({ tile: 'core.stairs_open', x: 2, y: 4, z: 0 });
    // The doc with the alias applied keeps the placement and names the piece.
    const aliased = withTileAliases(gantryMap());
    expect(aliased.classicStructure.tiles.map((t) => t.tile)).toEqual(['core.room']);
    expect(aliased.setPieces!.map((p) => [p.id.length <= 48, p.piece, p.x, p.y, p.z, p.rotation, p.mirror])).toEqual([
      [true, 'setpiece.catwalk_bridge_2', 2, 4, 0, 0, false],
      [true, 'setpiece.catwalk_bridge_2', 6, 0, 0, 1, false],
    ]);
    expect(aliased.setPieces![0]!.id).toBe('tile_040');
    const saved = JSON.parse(serializeMap(aliased));
    expect(JSON.stringify(saved)).not.toContain('military.gantry');
    expect(saved.setPieces.map((p: SetPiecePlacement) => p.piece)).toEqual(['setpiece.catwalk_bridge_2', 'setpiece.catwalk_bridge_2']);
    // It plays as a map that placed the piece itself: the same geometry.
    const direct = loadMap(serializeMap(aliased));
    expect(direct.ok && buildMapGeometry(direct.map)).toEqual(buildMapGeometry(r.map));
    // A map with no retired tile is left as it is.
    const plain = makeMap([{ id: 'home_room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    expect(withTileAliases(plain)).toBe(plain);
  });

  it('MapMaker keeps the old id readable (forEditing), and Replace all swaps every one for the piece, one undo step', () => {
    const r = loadMap(serializeMap(gantryMap()), undefined, { forEditing: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.map.classicStructure.tiles.filter((t) => t.tile === 'military.gantry')).toHaveLength(2);
    const cmd = replaceTilesWithSetPieceCommand(r.map, 'military.gantry');
    if ('error' in cmd) throw new Error(cmd.error);
    const after = applyCommand(r.map, cmd.command);
    expect(after.classicStructure.tiles.map((t) => t.tile)).toEqual(['core.room']);
    expect(after.setPieces!.map((p) => [p.piece, p.x, p.y, p.rotation])).toEqual([
      ['setpiece.catwalk_bridge_2', 2, 4, 0],
      ['setpiece.catwalk_bridge_2', 6, 0, 1],
    ]);
    // What MapMaker exports is what play makes of the old map.
    expect(serializeMap(after)).toBe(serializeMap(withTileAliases(r.map)));
    expect(applyCommand(after, invertCommand(cmd.command))).toEqual(r.map);
    // Nothing to replace, or no piece for a tile that isn't retired.
    expect(replaceTilesWithSetPieceCommand(after, 'military.gantry')).toMatchObject({ error: expect.stringContaining('places no') });
    expect(replaceTilesWithSetPieceCommand(after, 'core.room')).toMatchObject({ error: expect.stringContaining('no set piece') });
  });
});
