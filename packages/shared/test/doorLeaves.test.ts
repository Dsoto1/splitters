// Open doors are cover (owner, 2026-11-19: "the wooden doors for dorms and such on st. johns map i seem to walk
// through … i would like to hide behind doors for cover if possible"). The open Oak Doors (wide and slim) and the
// Painted Door collided as nothing; now each collides as its leaf, standing square into the room on its hinges, while
// the doorway beside it stays clear, and the doorway is a passage (sim/passages.ts) so bots still walk into the room
// the leaf narrows. Shut doors keep the frame's slab; ajar ones the slab and their leaf at its angle (owner, 2026-11-19). Here: the catalogue boxes, a ray and a body stopped by
// the leaf, the doorway still open, and every open room of a Dorm Bay reached on the navmesh in every turn.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  TICK_RATE,
  buildMapGeometry,
  emptyInput,
  getProp,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newTerrain,
  rotateXZ,
  serializeMap,
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

const ROTATIONS = [0, 1, 2, 3] as Rotation[];

function mapOf(placements: SetPiecePlacement[]): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const r = loadMap(serializeMap({ ...map, setPieces: placements, terrain: newTerrain(200, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}
const bay = (rotation: Rotation, roomDoors: 'wide' | 'slim' = 'wide'): SetPiecePlacement => ({ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation, mirror: false, pack: 'collegiate', overrides: { options: { roomDoors } } });
const at = (x: number, y: number, z: number, rotation: Rotation): Vec3 => {
  const [rx, rz] = rotateXZ(x, z, rotation);
  return { x: rx, y, z: rz };
};
const dir = (x: number, z: number, rotation: Rotation): Vec3 => ({ ...at(x, 0, z, rotation), y: 0 });

describe('open doors collide as their leaf', () => {
  it('the catalogue: the open doors have one box, the leaf (7 cm thick, floor to its top), off to the hinge side', () => {
    for (const [id, w] of [['kit.door.oak_open', 2], ['kit.door.painted_open', 2], ['kit.door.oak_slim_open', 1.5]] as const) {
      const def = getProp(id)!;
      expect(def.collision, id).not.toBeNull();
      expect(def.boxes, id).toHaveLength(1);
      const [x0, y0, z0, x1, y1, z1] = def.boxes![0]!;
      expect(x1 - x0, id).toBeCloseTo(0.07, 3);
      expect(y0).toBe(0);
      expect(y1, id).toBeGreaterThan(2.4);
      // On the hinge (+x) side, inside the frame; the rest of the doorway clear.
      expect(x0, id).toBeGreaterThan(w / 2 - 0.2);
      expect(x1, id).toBeLessThan(w / 2);
      // From the wall's plane a leaf's length into the room.
      expect(z1 - z0, id).toBeGreaterThan(w - 0.2);
    }
    // Shut: the frame's slab. Ajar (owner, 2026-11-19, "2b"): the slab, and its leaf at 25° (a seventh number, the box's
    // own turn), from the hinge 0.8 m into the room.
    expect(getProp('kit.door.oak')!.collision).toEqual([2, 2.6, 0.16]);
    for (const [id, w] of [['kit.door.oak_ajar', 2], ['kit.door.oak_slim_ajar', 1.5]] as const) {
      const boxes = getProp(id)!.boxes!;
      expect(boxes[0], id).toEqual([-w / 2, 0, -0.08, w / 2, 2.6, 0.08]);
      expect(boxes, id).toHaveLength(2);
      const [x0, , z0, x1, y1, z1, turn] = boxes[1]!;
      expect(turn, id).toBeCloseTo((25 * Math.PI) / 180, 3);
      expect(z1 - z0, id).toBeCloseTo(0.07, 3);
      expect(x1 - x0, id).toBeGreaterThan(w - 0.2);
      expect(y1, id).toBeGreaterThan(2.4);
    }
  });

  it('an ajar door: rounds stop at its leaf in the room; the doorway stays shut by the slab; the leaf is off the navmesh', () => {
    for (const roomDoors of ['wide', 'slim'] as const) {
      const map = mapOf([{ ...bay(0, roomDoors), piece: 'setpiece.dorm_bay_closed' }]);
      const geo = buildMapGeometry(map);
      const physics = new PhysicsWorld(geo, mapTerrainMesh(map));
      // The door at x 2 (its frame at z 5.26), the room north of it. From inside the room looking south, beside the
      // latch end: the leaf (0.8 m in at its far end), not the slab 2.2 m off.
      const x = roomDoors === 'wide' ? 1.6 : 1.85;
      const d = physics.raycastWorld({ x, y: 1.2, z: 7.5 }, { x: 0, y: 0, z: -1 }, 4)!;
      expect(d, `${roomDoors}: the leaf`).toBeLessThan(1.95);
      expect(d, `${roomDoors}: the leaf`).toBeGreaterThan(1.3);
      // From the hall, through the doorway's middle: the slab, as before.
      expect(physics.raycastWorld({ x: 2, y: 1.2, z: 4 }, { x: 0, y: 0, z: 1 }, 4), `${roomDoors}: the slab`).toBeCloseTo(1.18, 2);
      const door = map.entities.find((e) => e.kind === 'prop' && e.model.includes('_ajar'))!;
      const mine = geo.filter((b) => b.sourceId === door.id);
      expect(mine.map((b) => !!b.navThrough), roomDoors).toEqual([false, true]);
      expect(mine[1]!.yaw, roomDoors).toBeCloseTo((25 * Math.PI) / 180, 3);
    }
  });

  it('a Dorm Bay: rounds and bodies stop at the open leaf; the doorway beside it is clear (every turn, wide and slim)', { timeout: 60_000 }, () => {
    for (const roomDoors of ['wide', 'slim'] as const) {
      // The north-west room's door at x −2; its leaf on the +x jamb: x −1.08 (wide) or −1.33 (slim), into the room (+z).
      const leafX = roomDoors === 'wide' ? -1.076 : -1.326;
      for (const rotation of ROTATIONS) {
        const map = mapOf([bay(rotation, roomDoors)]);
        const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
        // From inside the room, east of the leaf, looking west: the leaf, 0.5 m away.
        const from = at(leafX + 0.5, 1.2, 6.1, rotation);
        expect(physics.raycastWorld(from, dir(-1, 0, rotation), 3), `${roomDoors} turn ${rotation}: the leaf`).toBeCloseTo(0.5, 1);
        // Through the doorway's middle from the hall: on past the door into the room.
        expect(physics.raycastWorld(at(-2, 1.2, 4, rotation), dir(0, 1, rotation), 6) ?? 6, `${roomDoors} turn ${rotation}: the doorway`).toBeGreaterThan(3);
        // A body walking west at the wide leaf stops against it (the slim leaf is too short to meet one clear of the wall).
        if (roomDoors === 'slim') continue;
        const collider = physics.createPlayerCollider();
        let s: MoveState = { pos: { ...at(leafX + 0.6, 0, 6.4, rotation), y: 0.02 }, velY: 0, grounded: true };
        const yaw = Math.atan2(dir(-1, 0, rotation).x, dir(-1, 0, rotation).z);
        for (let t = 0; t < TICK_RATE * 2; t++) s = stepMovement(physics, collider, s, { ...emptyInput(t), forward: 1, yaw });
        const [lx] = rotateXZ(s.pos.x, s.pos.z, ((4 - rotation) % 4) as Rotation);
        expect(lx, `${roomDoors} turn ${rotation}: stopped east of the leaf`).toBeGreaterThan(leafX + 0.3);
        physics.removeCollider(collider);
      }
    }
  });

  it("a Dorm Bay's open rooms are all reached on the navmesh with the wide doors' leaves in, every turn", { timeout: 120_000 }, () => {
    for (const rotation of ROTATIONS) {
      const map = mapOf([bay(rotation, 'wide')]);
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
      const nav = NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
      const hall = at(0, 0, 4, rotation);
      for (const cx of [-2, 2]) {
        for (const z of [8.3, -0.3]) {
          const room = at(cx, 0, z, rotation);
          for (const [a, b] of [[hall, room], [room, hall]] as const) {
            const path = nav.findPath(a, b);
            const miss = path ? Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.z - b.z) : Infinity;
            expect(miss, `turn ${rotation}: room ${cx},${z}`).toBeLessThan(1.2);
          }
        }
      }
      nav.destroy();
    }
  });
});
