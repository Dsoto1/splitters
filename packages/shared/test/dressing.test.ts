import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation, validateNavigation } from '../src/nav/index.ts';
import {
  DRESS_DENSITIES,
  DRESS_RECIPES,
  ROOM_TYPES,
  buildMapGeometry,
  dressMapRoom,
  dressRoom,
  dressSpace,
  getProp,
  guessRoomType,
  propBoxes,
  recipeModels,
  roomCells,
  validateMap,
  type DressedProp,
  type MapDocument,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => initNavigation());

/**
 * A room (1 × 1 or 2 × 2) with a doorway south and west into two rooms that
 * only meet through it, and a window east; a spawn in each side room.
 */
function testMap(tile = 'core.room'): MapDocument {
  const big = tile === 'core.room_large';
  const map = makeMap(
    [
      { id: 'room_a', tile, x: 0, y: 0, z: 0, rotation: 0, edges: { [big ? '1,0,0:E' : '0,0,0:E']: 'window' } },
      { id: 'side_w', tile: 'core.room', x: -1, y: 0, z: 0, rotation: 0 },
      { id: 'side_s', tile: 'core.room', x: 0, y: -1, z: 0, rotation: 0 },
    ],
    [
      [-8, 0, 0],
      [0, 0, -8],
    ],
  );
  return map;
}

const withProps = (map: MapDocument, props: DressedProp[]): MapDocument => ({ ...map, entities: [...map.entities, ...props.map((p, i) => ({ ...p, id: `dressed_${i}` }))] });

/** Visual footprint of a dressed prop on the floor. */
function footprint(p: DressedProp): [number, number, number, number] {
  const [w, , d] = getProp(p.model)!.size;
  const c = Math.abs(Math.cos(p.yaw));
  const s = Math.abs(Math.sin(p.yaw));
  const hx = (c * w + s * d) / 2;
  const hz = (s * w + c * d) / 2;
  return [p.position[0] - hx, p.position[2] - hz, p.position[0] + hx, p.position[2] + hz];
}

describe('interior dressing', () => {
  it('has a recipe for every room type, and every prop in it exists', () => {
    expect(ROOM_TYPES.length).toBeGreaterThanOrEqual(20);
    for (const type of ROOM_TYPES) {
      expect(DRESS_RECIPES[type].length, type).toBeGreaterThan(0);
      for (const id of recipeModels(type)) expect(getProp(id), `${type}: ${id}`).toBeDefined();
    }
  });

  it('reads a room from the map: floor inside the walls, doorways and the window', () => {
    const map = testMap();
    const space = dressSpace(map, roomCells(map, 0, 0, 0));
    expect(space.rects).toEqual([{ x0: -3.5, x1: 3.5, z0: -3.5, z1: 3.5 }]);
    expect(space.openings.filter((o) => o.kind === 'door').map((o) => [o.x, o.z])).toEqual(
      expect.arrayContaining([
        [0, -3.5],
        [-3.5, 0],
      ]),
    );
    expect(space.openings.filter((o) => o.kind === 'window').map((o) => [o.x, o.z])).toEqual([[3.5, 0]]);
    // The north wall whole; the south and west walls either side of their doorways; the east wall either side of its window.
    expect(space.walls.length).toBe(7);
    expect(roomCells(testMap('core.room_large'), 1, 1, 0)).toHaveLength(4);
  });

  it('is deterministic for a seed and varies with it', () => {
    const map = testMap();
    let differ = 0;
    for (const type of ROOM_TYPES) {
      const a = dressMapRoom(map, [0, 0, 0], type, { seed: 'one' });
      expect(dressMapRoom(map, [0, 0, 0], type, { seed: 'one' })).toEqual(a);
      if (JSON.stringify(dressMapRoom(map, [0, 0, 0], type, { seed: 'two' })) !== JSON.stringify(a)) differ++;
    }
    expect(differ).toBeGreaterThan(ROOM_TYPES.length / 2);
  });

  it('dresses every room type with wall pieces, waist-high cover and nothing in front of doorways or windows', () => {
    for (const tile of ['core.room', 'core.room_large']) {
      const map = testMap(tile);
      const space = dressSpace(map, roomCells(map, 0, 0, 0));
      for (const type of ROOM_TYPES) {
        const props = dressRoom(space, type, { seed: 7 });
        expect(props.length, `${tile} ${type}`).toBeGreaterThanOrEqual(2);
        // Some cover to fight round: a solid piece between knee and chest height.
        const cover = props.some((p) => {
          const def = getProp(p.model)!;
          return p.solid && p.position[1] < 0.3 && def.collision && def.collision[1] >= 0.55 && def.collision[1] <= 1.45;
        });
        expect(cover, `${tile} ${type} has cover`).toBe(true);
        for (const p of props) {
          if (p.position[1] > 0.3) continue;
          const [x0, z0, x1, z1] = footprint(p);
          // Inside the room's walls.
          expect(x0, `${type} ${p.model}`).toBeGreaterThan(-3.55);
          expect(z0, `${type} ${p.model}`).toBeGreaterThan(-3.55);
          // Doorways: nothing within 1.5 m in front of them; the window: 0.9 m.
          for (const o of space.openings) {
            const depth = o.kind === 'door' ? 1.5 : 0.9;
            const half = o.width / 2;
            const zx0 = Math.min(o.x, o.x + o.nx * depth) - (o.nz ? half : 0);
            const zx1 = Math.max(o.x, o.x + o.nx * depth) + (o.nz ? half : 0);
            const zz0 = Math.min(o.z, o.z + o.nz * depth) - (o.nx ? half : 0);
            const zz1 = Math.max(o.z, o.z + o.nz * depth) + (o.nx ? half : 0);
            const overlap = x1 > zx0 + 0.05 && x0 < zx1 - 0.05 && z1 > zz0 + 0.05 && z0 < zz1 - 0.05;
            expect(overlap, `${tile} ${type}: ${p.model} at ${p.position} blocks the ${o.kind} at ${o.x},${o.z}`).toBe(false);
          }
        }
      }
    }
  });

  it('never cuts the way between doorways (navmesh, as the validator checks it)', () => {
    for (const tile of ['core.room', 'core.room_large']) {
      const map = testMap(tile);
      for (const type of ROOM_TYPES) {
        for (const density of ['normal', 'full'] as const) {
          const dressed = withProps(map, dressMapRoom(map, [0, 0, 0], type, { seed: `${type}-${density}`, density }));
          expect(validateMap(dressed).filter((i) => i.severity === 'error')).toEqual([]);
          const nav = NavWorld.build([...buildMapGeometry(dressed), ...propBoxes(dressed, true)]);
          // The two side rooms only meet through the dressed room: their spawns must still reach each other.
          expect(validateNavigation(dressed, nav), `${tile} ${type} ${density}`).toEqual([]);
          // And the middle of the room is still reachable from both doorways.
          const path = nav.findPath({ x: -8, y: 0, z: 0 }, { x: 0, y: 0, z: -8 });
          expect(path, `${tile} ${type} ${density}`).not.toBeNull();
          nav.destroy();
        }
      }
    }
  });

  it('places more with density, and stays within its budgets', () => {
    const map = testMap('core.room_large');
    const space = dressSpace(map, roomCells(map, 0, 0, 0));
    const totals = DRESS_DENSITIES.map((density) => ROOM_TYPES.reduce((n, type) => n + dressRoom(space, type, { seed: 3, density }).length, 0));
    expect(totals[0]).toBeLessThan(totals[1]!);
    expect(totals[1]).toBeLessThan(totals[2]!);
    for (const type of ROOM_TYPES) {
      const full = dressRoom(space, type, { seed: 3, density: 'full' });
      expect(full.length, type).toBeLessThanOrEqual(48);
      expect(new Set(full.map((p) => p.model)).size, type).toBeLessThanOrEqual(16);
      expect(dressRoom(space, type, { seed: 3, density: 'full', max: 6 }).length).toBeLessThanOrEqual(6);
    }
    // At the map's model budget, only models already in use are picked.
    const used = new Set(recipeModels('kitchen').slice(0, 3));
    const limited = dressRoom(space, 'kitchen', { seed: 3, models: { used, limit: used.size } });
    for (const p of limited) expect(used.has(p.model)).toBe(true);
  });

  it('keeps spawns and pickups clear, and stands round what the room already has', () => {
    const map = testMap('core.room_large');
    map.entities.push({ id: 'spawn_mid', kind: 'spawn', position: [4, 0, 4], yaw: 0, faction: null });
    map.classicStructure.tiles[0]!.options = { layout: 'four_pillars' };
    const space = dressSpace(map, roomCells(map, 0, 0, 0));
    expect(space.blocked!.length).toBeGreaterThanOrEqual(4);
    for (const type of ROOM_TYPES) {
      for (const p of dressRoom(space, type, { seed: 11, density: 'full' })) {
        if (p.position[1] > 0.3) continue;
        const [x0, z0, x1, z1] = footprint(p);
        const dx = Math.max(x0 - 4, 0, 4 - x1);
        const dz = Math.max(z0 - 4, 0, 4 - z1);
        expect(Math.hypot(dx, dz), `${type}: ${p.model} on the spawn`).toBeGreaterThan(1);
        for (const b of space.blocked!) {
          const overlap = x1 > b.x0 + 0.05 && x0 < b.x1 - 0.05 && z1 > b.z0 + 0.05 && z0 < b.z1 - 0.05;
          expect(overlap, `${type}: ${p.model} in a pillar`).toBe(false);
        }
      }
    }
  });

  it('dresses a house upstairs on its floor, never over the stair hole, keeping the stairs reachable', () => {
    const map = makeMap([{ id: 'house_a', tile: 'core.house', x: 0, y: 0, z: 0, rotation: 0 }], [[4, 0, 4]]);
    const space = dressSpace(map, roomCells(map, 0, 0, 1));
    expect(space.y).toBe(4);
    const inside = (x: number, z: number) => space.rects.some((r) => x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05);
    for (const type of ['bedroom', 'office', 'storage'] as const) {
      const props = dressRoom(space, type, { seed: 5, density: 'full' });
      expect(props.length).toBeGreaterThan(2);
      for (const p of props.filter((q) => q.position[1] < space.y + 0.3)) {
        const [x0, z0, x1, z1] = footprint(p);
        expect(inside(x0, z0) && inside(x1, z1) && inside(x0, z1) && inside(x1, z0), `${type}: ${p.model} at ${p.position}`).toBe(true);
      }
      const dressed = withProps(map, [...props, ...dressMapRoom(map, [0, 0, 0], 'living', { seed: 5, density: 'full' })]);
      dressed.entities.push({ id: 'pickup_up', kind: 'pickup', item: 'core.health_small', position: [8, 4, 0], respawnSeconds: null });
      const nav = NavWorld.build([...buildMapGeometry(dressed), ...propBoxes(dressed, true)]);
      expect(validateNavigation(dressed, nav), type).toEqual([]);
      nav.destroy();
    }
  });

  it('guesses a room type from size and theme', () => {
    const map = testMap();
    const small = dressSpace(map, roomCells(map, 0, 0, 0));
    expect(ROOM_TYPES).toContain(guessRoomType(small, 'core.lab', 0.3));
    expect(['office', 'lab', 'server', 'kitchen']).toContain(guessRoomType(small, 'core.lab', 0.5));
    const big = dressSpace(testMap('core.room_large'), roomCells(testMap('core.room_large'), 0, 0, 0));
    expect(['living', 'dining', 'library']).toContain(guessRoomType(big, 'core.manor', 0.9));
  });
});
