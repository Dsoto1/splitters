import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation, validateNavigation } from '../src/nav/index.ts';
import { buildMapGeometry } from '../src/index.ts';
import { loadArena, makeMap } from './helpers.ts';

beforeAll(() => initNavigation());

describe('navigation', () => {
  it('generates a navmesh for the arena and finds a path up the stairs', () => {
    const arena = loadArena();
    const nav = NavWorld.build(buildMapGeometry(arena));
    const path = nav.findPath({ x: 0, y: 0, z: 0 }, { x: 16, y: 4, z: 5.5 });
    expect(path).not.toBeNull();
    const end = path![path!.length - 1]!;
    expect(end.y).toBeCloseTo(4, 0);
    // The route climbs through the stairs cell (z 12..20): one straight leg from ground to upper level.
    const climbs = path!.slice(1).some((b, i) => {
      const a = path![i]!;
      return a.y < 0.5 && b.y > 3.5 && a.z > 12 && a.z < 20 && b.z > 12 && b.z < 20;
    });
    expect(climbs).toBe(true);
    expect(validateNavigation(arena, nav)).toEqual([]);
    nav.destroy();
  });

  it('reports spawns on disconnected islands', () => {
    const map = makeMap(
      [
        { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
        { id: 'room_b', tile: 'core.room', x: 3, y: 0, z: 0, rotation: 0 },
      ],
      [
        [0, 0, 0],
        [24, 0, 0],
      ],
    );
    const nav = NavWorld.build(buildMapGeometry(map));
    expect(nav.findPath({ x: 0, y: 0, z: 0 }, { x: 24, y: 0, z: 0 })).toBeNull();
    expect(validateNavigation(map, nav).map((i) => [i.code, i.targetId])).toEqual([['nav.disconnected', 'spawn_1']]);
    nav.destroy();
  });
});
