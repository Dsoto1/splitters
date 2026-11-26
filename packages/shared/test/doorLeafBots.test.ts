// Bots stuck on propped-open doors (owner, 2026-11-26, St. Jasper's: "seen a few get stuck"). An open door's leaf
// collides (doorLeaves.test) but is left out of the walls the navmesh keeps 0.8 m off (WorldBox.navThrough), so the
// navmesh ran on through it and routes into the room crossed it: a bot following one walked into the leaf and stayed.
// Now the leaf is cut out of the navmesh with a body's room round it (nav/index.ts NAV_THROUGH_MARGIN). Here, on a
// Dorm Bay (wide and slim doors, every turn): every route between the hall and the room keeps a body clear of every
// leaf, and a body following routes as bots do walks in past the leaf and back out.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PLAYER,
  PhysicsWorld,
  TICK_RATE,
  buildMapGeometry,
  emptyInput,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  rotateXZ,
  serializeMap,
  stepMovement,
  yawXZ,
  type MapDocument,
  type MoveState,
  type Rotation,
  type Vec3,
  type WorldBox,
} from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const ROTATIONS = [0, 1, 2, 3] as Rotation[];

function mapOf(rotation: Rotation, roomDoors: 'wide' | 'slim'): MapDocument {
  // (No terrain under the floor: a capsule walking along one of its grid lines snags on the seam: slimDoors.test.)
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const r = loadMap(serializeMap({ ...map, setPieces: [{ id: 'bay0', piece: 'setpiece.dorm_bay', x: 0, y: 0, z: 0, rotation, mirror: false, pack: 'collegiate', overrides: { options: { roomDoors } } }], terrain: null }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}

/** How far (x, z) is from a (turned) box's footprint. */
function offBox(b: WorldBox, x: number, z: number): number {
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const [lx, lz] = yawXZ(x - cx, z - cz, -(b.yaw ?? 0));
  return Math.hypot(Math.max(0, Math.abs(lx) - (b.max[0] - b.min[0]) / 2), Math.max(0, Math.abs(lz) - (b.max[2] - b.min[2]) / 2));
}

/** The closest a route's straight legs come to any of the boxes. */
function routeClearance(path: readonly Vec3[], boxes: readonly WorldBox[]): number {
  let least = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05));
    for (let k = 0; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const z = a.z + ((b.z - a.z) * k) / n;
      for (const box of boxes) least = Math.min(least, offBox(box, x, z));
    }
  }
  return least;
}

describe('bots and propped-open doors', () => {
  it('routes between the hall and the rooms keep a body off every open leaf (wide and slim, every turn)', { timeout: 240_000 }, () => {
    for (const roomDoors of ['wide', 'slim'] as const) {
      for (const rotation of ROTATIONS) {
        const map = mapOf(rotation, roomDoors);
        const geo = buildMapGeometry(map);
        const physics = new PhysicsWorld(geo, mapTerrainMesh(map));
        const nav = NavWorld.build(geo, mapTerrainMesh(map), navLinks(map.entities, physics));
        const leaves = geo.filter((b) => b.navThrough);
        expect(leaves.length, `${roomDoors} turn ${rotation}`).toBe(4);
        const at = (x: number, z: number): Vec3 => {
          const [rx, rz] = rotateXZ(x, z, rotation);
          return { x: rx, y: 0, z: rz };
        };
        const halls = [at(-3.4, 4), at(3.4, 4)];
        let routes = 0;
        // Every place across the north-west and south-east rooms (both leaves' sides), there and back.
        for (const [x0, z0, z1] of [[-3.6, 6.2, 10.8], [0.4, -2.8, 1.8]] as const) {
          for (let x = x0; x <= x0 + 3.2 + 1e-9; x += 0.4) {
            for (let z = z0; z <= z1 + 1e-9; z += 0.4) {
              const spot = at(x, z);
              for (const hall of halls) {
                for (const [a, b] of [[hall, spot], [spot, hall]] as const) {
                  const path = nav.findPath(a, b);
                  if (!path || Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.z - b.z) > 0.3) continue;
                  routes++;
                  expect(routeClearance(path, leaves), `${roomDoors} turn ${rotation}: ${JSON.stringify(path.map((c) => [+c.x.toFixed(2), +c.z.toFixed(2)]))}`).toBeGreaterThan(PLAYER.radius);
                }
              }
            }
          }
        }
        // (Most of each room is reached: the rooms are still on the navmesh.)
        expect(routes, `${roomDoors} turn ${rotation}: routes`).toBeGreaterThan(100);
        nav.destroy();
      }
    }
  });

  it('a body following routes as bots do walks in past the open leaf and back out, both ways (wide and slim, every turn)', { timeout: 240_000 }, () => {
    for (const roomDoors of ['wide', 'slim'] as const) {
      for (const rotation of ROTATIONS) {
        const map = mapOf(rotation, roomDoors);
        const geo = buildMapGeometry(map);
        const physics = new PhysicsWorld(geo, mapTerrainMesh(map));
        const nav = NavWorld.build(geo, mapTerrainMesh(map), navLinks(map.entities, physics));
        const collider = physics.createPlayerCollider();
        const at = (x: number, z: number): Vec3 => {
          const [rx, rz] = rotateXZ(x, z, rotation);
          return { x: rx, y: 0, z: rz };
        };
        // The north-west room's door at x −2, its leaf on the +x jamb standing into the room: from the hall's west end
        // to beyond the leaf's far end on its hinge side, then out to the hall's east end, and into the south-east room
        // past its leaf (hinge side −x) and back to the west end.
        const stops = [at(-3.4, 4), at(-0.9, 8), at(3.4, 4), at(1, 0.1), at(-3.4, 4)];
        let s: MoveState = { pos: { ...stops[0]!, y: 0.02 }, velY: 0, grounded: true };
        let tick = 0;
        for (let k = 1; k < stops.length; k++) {
          const path = nav.findPath(s.pos, stops[k]!)!;
          expect(path, `${roomDoors} turn ${rotation}: a route to stop ${k}`).toBeTruthy();
          let i = 1;
          // As bots do (brain.ts): a corner is reached within 0.45 m; head for the next.
          for (let t = 0; t < TICK_RATE * 20 && i < path.length; t++) {
            while (i < path.length && Math.hypot(s.pos.x - path[i]!.x, s.pos.z - path[i]!.z) < 0.45) i++;
            const c = path[Math.min(i, path.length - 1)]!;
            s = stepMovement(physics, collider, s, { ...emptyInput(tick++), forward: 1, yaw: Math.atan2(c.x - s.pos.x, c.z - s.pos.z) });
          }
          expect(Math.hypot(s.pos.x - stops[k]!.x, s.pos.z - stops[k]!.z), `${roomDoors} turn ${rotation}: walked to stop ${k}, at ${s.pos.x.toFixed(2)},${s.pos.z.toFixed(2)} corner ${i}/${path.length} path ${JSON.stringify(path.map((c) => [+c.x.toFixed(2), +c.z.toFixed(2)]))}`).toBeLessThan(0.8);
        }
        physics.removeCollider(collider);
        nav.destroy();
      }
    }
  });
});
