// Set pieces in play (docs/SET_PIECES_PLAN.md): what the expansion builds is what the exploded map builds (collision,
// navigation), no two drawn faces share a plane anywhere in a map of every piece (the z-fighting audit), and shots,
// players and bots go through every arch and doorway of the carriageways and along the skybridges, while the stone
// round them stops them. The new kit pieces collide by tile and edge geometry (the arch edge, the vaulted ceiling).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DOOR,
  PhysicsWorld,
  applyCommand,
  buildMapDecor,
  buildMapGeometry,
  builtInSetPieces,
  coplanarOverlaps,
  doorLeaves,
  emptyInput,
  explodeSetPieceCommand,
  initPhysics,
  loadMap,
  serializeMap,
  stepMovement,
  visibleFaces,
  type MapDocument,
  type MapEntity,
  type MoveState,
  type Rotation,
  type SetPiecePlacement,
  type TilePlacement,
  type Vec3,
  type WorldBox,
} from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const library = builtInSetPieces();
const yard = (id: string, x: number, y: number, z = 0): TilePlacement => ({ id, tile: 'core.yard', x, y, z, rotation: 0 });
const room = (id: string, x: number, y: number, z = 0, extra: Partial<TilePlacement> = {}): TilePlacement => ({ id, tile: 'core.room', x, y, z, rotation: 0, ...extra });
/** A street running east-west (open ground: no walls between streets). */
const street = (id: string, x: number, y: number): TilePlacement => ({ id, tile: 'core.street', x, y, z: 0, rotation: 1 });

/** A placement as the tests give it: turn and mirror optional. */
type PieceIn = Omit<SetPiecePlacement, 'mirror' | 'rotation'> & Partial<Pick<SetPiecePlacement, 'mirror' | 'rotation'>>;

/** A map of these tiles and set pieces (theme Castle Keep: Collegiate Gothic), spawn on the first tile. */
function mapOf(tiles: TilePlacement[], pieces: PieceIn[], theme = 'core.castle'): MapDocument {
  const t0 = tiles[0]!;
  const map = makeMap(tiles, [[t0.x * 8, t0.z * 4, t0.y * 8]]);
  return { ...map, classicStructure: { ...map.classicStructure, theme }, setPieces: pieces.map((p) => ({ ...p, rotation: p.rotation ?? 0, mirror: p.mirror ?? false })) };
}

const played = (doc: MapDocument): MapDocument => {
  const r = loadMap(serializeMap(doc));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
};

/** The carriageway at (0, 0), turned and mirrored, with a yard at each end of the passage and a room at each side. */
function gate(piece: 'setpiece.carriageway_1' | 'setpiece.carriageway_2', rotation: Rotation = 0, mirror = false): MapDocument {
  const wide = piece === 'setpiece.carriageway_2' ? 2 : 1;
  // Unturned the passage runs north-south over cells x 0..wide-1: yards north and south, rooms east and west.
  const local: [number, number, string][] = [];
  for (let x = 0; x < wide; x++) local.push([x, 1, 'yard'], [x, -1, 'yard']);
  local.push([-1, 0, 'room'], [wide, 0, 'room']);
  const turn = (x: number, y: number): [number, number] => {
    let [a, b] = mirror ? [wide - 1 - x, y] : [x, y];
    for (let i = 0; i < rotation; i++) [a, b] = [b, -a];
    return [a, b];
  };
  const tiles = local.map(([x, y, kind], i) => {
    const [a, b] = turn(x, y);
    return kind === 'yard' ? yard(`yard_${i}`, a, b) : room(`room_${i}`, a, b);
  });
  return mapOf(tiles, [{ id: 'gate_piece', piece, x: 0, y: 0, z: 0, rotation, mirror }]);
}

/** Walk along +z (yaw 0) or another facing for `ticks` from `from`. */
function walk(physics: PhysicsWorld, from: Vec3, yaw: number, ticks = 300): MoveState {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
  for (let i = 0; i < ticks; i++) s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw });
  physics.removeCollider(collider);
  return s;
}

describe('set pieces build what their exploded parts build', () => {
  it('collision boxes, trim and navigation from the expansion equal those from the exploded map', () => {
    const doc = mapOf(
      [room('east', 3, 0), room('west', -2, 0), room('bldg_1', 6, 4, 1), room('bldg_2', 6, 8, 1), yard('south', 0, -1), yard('north', 0, 1)],
      [
        { id: 'gate_a', piece: 'setpiece.carriageway_2', x: 0, y: 0, z: 0, rotation: 0, pack: 'collegiate' },
        { id: 'bridge_a', piece: 'setpiece.skybridge_3', x: 6, y: 5, z: 1, rotation: 0, mirror: true },
        { id: 'gate_b', piece: 'setpiece.carriageway_1', x: -6, y: -6, z: 0, rotation: 1, mirror: true, pack: 'gothic' },
      ],
    );
    const asPlayed = played(doc);
    let exploded = doc;
    for (const p of doc.setPieces!) {
      const r = explodeSetPieceCommand(exploded, p.id);
      if ('error' in r) throw new Error(r.error);
      exploded = applyCommand(exploded, r.command);
    }
    const asExploded = played(exploded);
    expect(serializeMap(asExploded)).toBe(serializeMap(asPlayed));
    expect(buildMapGeometry(asExploded)).toEqual(buildMapGeometry(asPlayed));
    expect(buildMapDecor(asExploded)).toEqual(buildMapDecor(asPlayed));
    const a = NavWorld.build(buildMapGeometry(asPlayed));
    const b = NavWorld.build(buildMapGeometry(asExploded));
    for (const [from, to] of [
      [{ x: 0, y: 0, z: -8 }, { x: 0, y: 0, z: 8 }],
      [{ x: 24, y: 0, z: 0 }, { x: -16, y: 0, z: 0 }],
      [{ x: 48, y: 4, z: 32 }, { x: 48, y: 4, z: 64 }],
    ] as const) expect(a.findPath(from, to)).toEqual(b.findPath(from, to));
    a.destroy();
    b.destroy();
  });
});

describe('z-fighting audit over every set piece', () => {
  it('a map of every shipped piece, in each turn, mirrored and not, in packs with facades: no coplanar overlaps left', { timeout: 120_000 }, () => {
    const pieces: SetPiecePlacement[] = [];
    let n = 0;
    const packs = ['collegiate', 'military', 'medieval', 'orbital'];
    for (const def of library.pieces.values()) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        for (const mirror of [false, true]) {
          pieces.push({ id: `piece_${n}`, piece: def.id, x: (n % 8) * 6, y: Math.floor(n / 8) * 6, z: def.id.includes('skybridge') ? 1 : 0, rotation, mirror, pack: packs[n % packs.length] });
          n++;
        }
      }
    }
    // Neighbours round some of them: rooms beside the carriageways, buildings at the skybridges' ends.
    const doc = mapOf([room('home', -10, -10)], pieces);
    const map = played(doc);
    const boxes: WorldBox[] = [...buildMapGeometry(map), ...buildMapDecor(map)];
    const faces = visibleFaces(boxes);
    const left = coplanarOverlaps(boxes, { faces });
    expect(left.slice(0, 5).map((o) => `${boxes[o.a]!.kind} ${boxes[o.a]!.sourceId} / ${boxes[o.b]!.kind} ${boxes[o.b]!.sourceId} at ${o.center.map((v) => v.toFixed(2))} (${o.area.toFixed(3)} m²)`)).toEqual([]);
  });

  it('carriageways between buildings and skybridges meeting them: no coplanar overlaps left', () => {
    for (const rotation of [0, 1] as Rotation[]) {
      const map = played(gate('setpiece.carriageway_2', rotation, rotation === 1));
      const boxes = [...buildMapGeometry(map), ...buildMapDecor(map)];
      expect(coplanarOverlaps(boxes, { faces: visibleFaces(boxes) })).toEqual([]);
    }
    const bridge = played(mapOf([room('bldg_a', 0, -1, 1, { options: { facade: 'gothic_stone' } }), room('bldg_b', 0, 2, 1, { options: { facade: 'gothic_stone' } }), room('bldg_a0', 0, -1), room('bldg_b0', 0, 2)], [{ id: 'bridge_1', piece: 'setpiece.skybridge_2', x: 0, y: 0, z: 1 }]));
    const boxes = [...buildMapGeometry(bridge), ...buildMapDecor(bridge)];
    expect(coplanarOverlaps(boxes, { faces: visibleFaces(boxes) })).toEqual([]);
  });
});

describe('the carriageway: shots, players and bots pass its arches and doorways; its stone stops them', () => {
  it('shots go through both arches under the curve, and stop on the piers and the stone over the arch', () => {
    for (const piece of ['setpiece.carriageway_1', 'setpiece.carriageway_2'] as const) {
      const physics = new PhysicsWorld(buildMapGeometry(played(gate(piece))));
      const lanes = piece === 'setpiece.carriageway_1' ? [0] : [0, 8];
      for (const cx of lanes) {
        // Through the whole passage, south to north (z -6 to +6 is 12 m: the yards beyond are open).
        for (const [u, y] of [[0, 1.4], [0, 3.2], [-1.9, 2.8], [1.9, 2.8], [-1.5, 0.9], [1.5, 3], [0.8, 3.22], [-2.35, 2.72], [2.35, 2.72]]) {
          const hit = physics.raycastHit({ x: cx + u!, y: y!, z: -6 }, { x: 0, y: 0, z: 1 }, 12);
          expect(hit === null || hit.dist > 11.9, `${piece} lane ${cx}: a shot at u ${u}, ${y} m stopped at ${hit?.dist}`).toBe(true);
        }
        // Into the stone: a pier beside the opening, the spandrel over the crown. The yard beyond the arch builds the
        // same arch on its side (as it would a doorway), so the stone starts at its face, 1.5 m on.
        for (const [u, y] of [[3.2, 1.5], [-3.2, 1.5], [0, 3.6], [2.45, 2.95]]) {
          const hit = physics.raycastHit({ x: cx + u!, y: y!, z: -6 }, { x: 0, y: 0, z: 1 }, 12);
          expect(hit, `${piece} lane ${cx}: a shot at u ${u}, ${y} m went through`).not.toBeNull();
          expect(hit!.dist).toBeGreaterThan(1.4);
          expect(hit!.dist).toBeLessThan(2.1);
        }
      }
    }
  });

  it('shots go through the side doorways; the doors close them and open clear of them', () => {
    const map = played(gate('setpiece.carriageway_1'));
    const physics = new PhysicsWorld(buildMapGeometry(map));
    for (const [z, y] of [[0, 1.5], [-1.3, 0.4], [1.3, 2.8]]) {
      // From the west room through both doorways into the east room (16 m), with no door in the static level.
      const hit = physics.raycastHit({ x: -8, y: y!, z: z! }, { x: 1, y: 0, z: 0 }, 16);
      expect(hit === null || hit.dist > 11.4, `doorway at z ${z}, ${y} m`).toBe(true);
    }
    const doors = map.entities.filter((e): e is Extract<MapEntity, { kind: 'door' }> => e.kind === 'door');
    expect(doors).toHaveLength(2);
    for (const d of doors) {
      expect(d.style).toBe('oak');
      // Shut, its leaves fill the 3 m doorway; open, they slide into the wall beside it (the door turns a quarter:
      // its leaves run along z).
      for (const leaf of doorLeaves(d, 0)) expect(Math.abs(leaf.center.z - d.position[2]) + leaf.half.x).toBeLessThanOrEqual(DOOR.width / 2 + 1e-6);
      for (const leaf of doorLeaves(d, 1)) expect(Math.abs(leaf.center.z - d.position[2]) - leaf.half.x).toBeGreaterThanOrEqual(DOOR.width / 2 - 1e-6);
    }
  });

  it('players walk through the passage in every turn and mirror, and through its doorways into the buildings', () => {
    for (const rotation of [0, 1, 2, 3] as Rotation[]) {
      for (const mirror of [false, true]) {
        const map = played(gate('setpiece.carriageway_1', rotation, mirror));
        const physics = new PhysicsWorld(buildMapGeometry(map));
        // Along the passage, which runs north-south turned by `rotation`: forward is local +z.
        const yaw = -rotation * (Math.PI / 2);
        const [sx, sz] = [-Math.sin(yaw) * 9, -Math.cos(yaw) * 9];
        const end = walk(physics, { x: sx, y: 0, z: sz }, yaw);
        expect(Math.hypot(end.pos.x - sx, end.pos.z - sz), `turned ${rotation} ${mirror}: walked from the yard through the arches`).toBeGreaterThan(14);
      }
    }
    const physics = new PhysicsWorld(buildMapGeometry(played(gate('setpiece.carriageway_2'))));
    // East-west through both side doorways and the wide passage, beside its column (yaw π/2 faces +x).
    expect(walk(physics, { x: -8, y: 0, z: 1 }, Math.PI / 2, 420).pos.x).toBeGreaterThan(18);
    // Straight into the column: stopped in front of it.
    expect(walk(physics, { x: -2, y: 0, z: 0 }, Math.PI / 2).pos.x).toBeLessThan(3.6);
    // Into a pier: stopped.
    expect(walk(physics, { x: 3.2, y: 0, z: -9 }, 0).pos.z).toBeLessThan(-4.2);
  });

  it("bots' paths go through the passage end to end, and through the doorways", () => {
    for (const piece of ['setpiece.carriageway_1', 'setpiece.carriageway_2'] as const) {
      for (const rotation of [0, 1] as Rotation[]) {
        const map = played(gate(piece, rotation));
        const nav = NavWorld.build(buildMapGeometry(map));
        const along = (z: number): Vec3 => (rotation ? { x: z, y: 0, z: 0 } : { x: 0, y: 0, z });
        const path = nav.findPath(along(-9), along(9));
        expect(path, `${piece} ${rotation}`).not.toBeNull();
        const last = path!.at(-1)!;
        expect(Math.hypot(last.x - along(9).x, last.z - along(9).z), `${piece} ${rotation}: reached the far yard`).toBeLessThan(1);
        // Every point of the path stays in the passage's lanes or the yards: it went through, not round.
        const wide = piece === 'setpiece.carriageway_2' ? 16 : 8;
        for (const p of path!) expect(Math.abs(rotation ? p.z : p.x) < wide, `${piece}: ${JSON.stringify(p)}`).toBe(true);
        // West room to east room, through both doorways.
        const across = (x: number): Vec3 => (rotation ? { x: 0, y: 0, z: -x } : { x, y: 0, z: 0 });
        const side = nav.findPath(across(-8), across(wide));
        expect(side && Math.hypot(side.at(-1)!.x - across(wide).x, side.at(-1)!.z - across(wide).z) < 1, `${piece} ${rotation}: through the doorways`).toBe(true);
        nav.destroy();
      }
    }
  });
});

describe('the skybridge: between two buildings on level 1, nothing underneath', () => {
  /** Rooms at both ends on level 1 (on rooms on the ground), the bridge between them over a street running east-west. */
  const bridged = (piece: string, cells: number) =>
    mapOf([room('bldg_a', 0, -1, 1), room('bldg_b', 0, cells, 1), room('bldg_a0', 0, -1), room('bldg_b0', 0, cells), street('under_w', -1, 0), street('under', 0, 0), street('under_e', 1, 0)], [{ id: 'bridge_1', piece, x: 0, y: 0, z: 1 }]);

  it('players walk from one building to the other along it; shots go through its windows and doors; the street passes under it', () => {
    for (const [piece, cells] of [['setpiece.skybridge_2', 2], ['setpiece.skybridge_3', 3], ['setpiece.skybridge_4', 4]] as const) {
      const map = played(bridged(piece, cells));
      const physics = new PhysicsWorld(buildMapGeometry(map));
      const end = walk(physics, { x: 0, y: 4, z: -8 }, 0, 240 + cells * 100);
      expect(end.pos.z, piece).toBeGreaterThan(cells * 8);
      expect(end.pos.y).toBeGreaterThan(3.9);
      // Through both end doorways, the length of the bridge (static level: no door leaves, no glass panes).
      const along = physics.raycastHit({ x: 0, y: 5.5, z: -8 }, { x: 0, y: 0, z: 1 }, cells * 8 + 12);
      expect(along === null || along.dist > cells * 8 + 7, piece).toBe(true);
      // Across, through a window on each side (sill 0.9, head 2.5 over the bridge's floor at 4 m).
      const across = physics.raycastHit({ x: -10, y: 5.7, z: 1.75 }, { x: 1, y: 0, z: 0 }, 20);
      expect(across === null || across.dist > 19, `${piece} windows`).toBe(true);
      // Under it: the street runs on under the bridge, open from the road to the bridge's underside; the bridge builds
      // nothing below its deck.
      const under = physics.raycastHit({ x: -10, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 20);
      expect(under === null || under.dist > 19.9, `${piece}: the street under it`).toBe(true);
      expect(buildMapGeometry(map).filter((b) => b.sourceId.startsWith('sp_bridge_1_') && b.min[1] < 3.4)).toEqual([]);
      const nav = NavWorld.build(buildMapGeometry(map));
      const path = nav.findPath({ x: 0, y: 4, z: -8 }, { x: 0, y: 4, z: cells * 8 });
      expect(path && path.at(-1)!.z > cells * 8 - 1, `${piece}: bots path along it`).toBe(true);
      nav.destroy();
    }
  });

  it('its windows have glass from the role pack; its doors meet the buildings at their level', () => {
    const map = played(bridged('setpiece.skybridge_2', 2));
    const glass = map.classicStructure.tiles.filter((t) => t.id.startsWith('sp_')).flatMap((t) => Object.values(t.glass ?? {}));
    expect(glass).toEqual(['breakable', 'breakable', 'breakable', 'breakable']);
    const doors = map.entities.filter((e) => e.kind === 'door');
    expect(doors.map((d) => d.position)).toEqual([[0, 4, -4], [0, 4, 12]]);
  });
});
