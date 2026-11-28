// The Stair End Bay (3 floors)'s First-floor door: Double door (St. John's step 7c; owner, 2026-11-21: "the under
// stair could be removed to make room for a larger double door"): the second stair stands as the Stairwell (open
// under), its upper flight's top five steps 2.75 m over the first floor, and the door in the bay's outer wall is 3 m
// wide, two Slim Oak Doors standing open (a double door's pair: the left one mirrored, no post between them). Bots and players go through it both ways, under
// either leaf; the stair still climbs; nothing of it stands outside the bay.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  buildMapGeometry,
  emptyInput,
  getKitFamily,
  getProp,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  newTerrain,
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

const at = (id: string, piece: string, x: number, y: number, z: number, rotation: Rotation = 0, overrides?: SetPiecePlacement['overrides']): SetPiecePlacement => ({ id, piece, x, y, z, rotation, mirror: false, pack: 'collegiate', ...(overrides ? { overrides } : {}) });

/** Welles's west end: the bay at cell (1, 0) with the Double door, a Carriageway's room over the arch at (0, 1) on its west side. */
function shape(upperDoor: string): MapDocument {
  const map = makeMap([{ id: 'home', tile: 'core.room', x: -20, y: -20, z: 0, rotation: 0 }], [[-160, 0, -160]]);
  const placements = [at('end_w', 'setpiece.stair_end_bay_3', 1, 0, 0, 0, { options: { upperDoor } }), at('bridge', 'setpiece.carriageway_1', 0, 1, 0)];
  const r = loadMap(serializeMap({ ...map, setPieces: placements, terrain: newTerrain(200, 2, [0, 0], 'grass') }));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
}
function walk(physics: PhysicsWorld, from: Vec3, yaw: number, ticks: number): MoveState {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
  for (let i = 0; i < ticks; i++) s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw });
  physics.removeCollider(collider);
  return s;
}
function miss(nav: NavWorld, a: Vec3, b: Vec3): number {
  const path = nav.findPath(a, b);
  return path ? Math.hypot(path.at(-1)!.x - b.x, path.at(-1)!.y - b.y, path.at(-1)!.z - b.z) : Infinity;
}
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe("the Stair End Bay (3 floors)'s Double door (St. John's skyway, step 7c)", () => {
  it("the double door's leaves are the Slim Oak Door (open), the left one mirrored: the same size, passages, surface", () => {
    for (const id of ['kit.door.oak_slim_open_pair', 'kit.door.oak_slim_open_pair_left']) {
      expect(getKitFamily(id)?.passage, id).toEqual(getKitFamily('kit.door.oak_slim_open')!.passage);
      expect(getKitFamily(id)?.surface, id).toBe(getKitFamily('kit.door.oak_slim_open')!.surface);
      expect(getProp(id)?.size, id).toEqual(getProp('kit.door.oak_slim_open')?.size);
    }
  });

  it('the door is 3 m wide in the outer wall with standing room under the stair beside it; the stair keeps its steps', () => {
    const boxes = buildMapGeometry(shape('double')).filter((b) => b.sourceId?.startsWith('sp_end_w'));
    // The outer wall (bay x -4 to -3.5, world 4 to 4.5) on the first floor: nothing from z 4.62 to 7.48 below 6.6 m
    // but the leaves' own boxes at the jambs.
    const inDoor = boxes.filter((b) => b.min[0] < 4.45 && b.max[0] > 4.05 && b.min[1] < 6.5 && b.max[1] > 4.1 && b.min[2] < 7.45 && b.max[2] > 4.65);
    expect(inDoor.map((b) => b.sourceId)).toEqual([]);
    // Over the doorway inside (to 1.5 m in): 2.6 m or more of headroom from the first floor (4 m) across its width.
    const over = (x: number, z: number) => Math.min(...boxes.filter((b) => b.min[0] < x && b.max[0] > x && b.min[2] < z && b.max[2] > z && b.min[1] >= 4.05).map((b) => b.min[1])) - 4;
    for (const z of [4.8, 5.3, 6.2, 6.8, 7.3]) for (const x of [4.7, 5.2, 5.9]) expect(over(x, z), `over (${x}, ${z})`).toBeGreaterThanOrEqual(2.6 - 1e-6);
    // The single door's bay keeps the wall there.
    const single = buildMapGeometry(shape('end')).filter((b) => b.sourceId?.startsWith('sp_end_w'));
    expect(single.some((b) => b.min[0] < 4.45 && b.max[0] > 4.05 && b.min[1] < 6.5 && b.max[1] > 4.1 && b.min[2] < 6.8 && b.max[2] > 6.8)).toBe(true);
    // Nothing the Double door adds stands west of the outer wall (where a turned leaf would have stood, in the skyway).
    const before = new Set(single.map((b) => b.sourceId));
    const added = boxes.filter((b) => !before.has(b.sourceId));
    expect(added.length).toBeGreaterThan(0);
    // (The stairwell tile's facade trim stands out as the plain Stairwell's does.)
    const trimOut = Math.min(...single.map((b) => b.min[0]));
    for (const b of added) expect(b.min[0], b.sourceId).toBeGreaterThanOrEqual((b.sourceId?.startsWith('sp_end_w_34') ? trimOut : 4) - 1e-3);
  });

  it('bots go through it both ways, under either leaf, and up and down the stair; a body walks through under each leaf both ways', { timeout: 180_000 }, () => {
    const map = shape('double');
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    const nav = NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
    for (const z of [5.3, 6.8]) {
      expect(miss(nav, v(1, 4, z), v(8, 4, 4)), `skyway to the bay's first floor (z ${z})`).toBeLessThan(1.2);
      expect(miss(nav, v(8, 4, 4), v(1, 4, z)), `the bay's first floor to the skyway (z ${z})`).toBeLessThan(1.2);
      expect(miss(nav, v(1, 4, z), v(5.6, 4, z)), `straight in under the leaf at z ${z}`).toBeLessThan(1.2);
    }
    expect(miss(nav, v(1, 4, 6), v(8, 8, 4)), 'the skyway to the top floor, up the second stair').toBeLessThan(1.2);
    expect(miss(nav, v(1, 4, 6), v(8, 0, 4)), 'the skyway down to the lobby').toBeLessThan(1.2);
    // A path through the doorway is about as long as the straight line (not round a leaf or the long way).
    const path = nav.findPath(v(1, 4, 6), v(6, 4, 6))!;
    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
    expect(len).toBeLessThan(7);
    nav.destroy();
    // A body: east from the skyway into the bay, and west back out, under each leaf.
    for (const z of [5.0, 6.0, 7.1]) {
      const a = walk(physics, v(1, 4.05, z), Math.PI / 2, 90);
      const b = walk(physics, v(6.6, 4.05, z), -Math.PI / 2, 90);
      // (Whichever way a yaw of π/2 faces: one walk starts in the skyway, the other in the bay, and each goes the other way.)
      const [inward, outward] = a.pos.x > 1.5 ? [a, b] : [walk(physics, v(1, 4.05, z), -Math.PI / 2, 90), walk(physics, v(6.6, 4.05, z), Math.PI / 2, 90)];
      expect(inward.pos.x, `in from the skyway at z ${z}`).toBeGreaterThan(6.5);
      expect(outward.pos.x, `out to the skyway at z ${z}`).toBeLessThan(1);
      expect(inward.pos.y).toBeGreaterThan(3.9);
      expect(outward.pos.y).toBeGreaterThan(3.9);
    }
  });
});
