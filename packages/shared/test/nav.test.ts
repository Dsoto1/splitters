import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { NavWorld, initNavigation, validateNavigation } from '../src/nav/index.ts';
import { buildMapGeometry, loadMap, mapTerrainMesh } from '../src/index.ts';
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

describe('long routes', () => {
  it('finds the way round the lake on Norman Shores (house to house across the basin, over the bridge) from anywhere along it', () => {
    const loaded = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/norman_shores.json', import.meta.url)), 'utf8'));
    if (!loaded.ok) throw new Error('Norman Shores failed to load');
    const map = loaded.map;
    const nav = NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map));
    // The flags sit in the two southern houses, facing each other across the water: the way is north over the bridge.
    const [a, b] = map.entities.filter((e) => e.kind === 'flag').map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));
    const path = nav.findPath(a!, b!);
    expect(path).not.toBeNull();
    let len = 0;
    for (let i = 1; i < path!.length; i++) len += Math.hypot(path![i]!.x - path![i - 1]!.x, path![i]!.z - path![i - 1]!.z);
    expect(len).toBeGreaterThan(250);
    expect(Math.max(...path!.map((p) => p.z))).toBeGreaterThan(40);
    // Setting off from along the way (a teammate who went ahead) gets there too.
    const mid = path![Math.floor(path!.length / 2)]!;
    const rest = nav.findPath(mid, b!);
    expect(rest).not.toBeNull();
    const end = rest![rest!.length - 1]!;
    expect(Math.hypot(end.x - b!.x, end.z - b!.z)).toBeLessThan(1.5);
    // Every spawn reaches every other.
    expect(validateNavigation(map, nav).filter((i) => i.code === 'nav.disconnected')).toEqual([]);
    nav.destroy();
  }, 120_000);
});
