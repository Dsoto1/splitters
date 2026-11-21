// Untracked (not committed): Memorial Hall's routes on the real map, on the game's physics and navmesh.
// MAPFILE=<path> npx vitest run packages/shared/test/sj8bLocal.test.ts
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PLAYER, PhysicsWorld, buildMapGeometry, initPhysics, loadMap, mapTerrainMesh, navLinks, type Vec3 } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
type P3 = [number, number, number];
const v = ([x, y, z]: P3): Vec3 => ({ x, y, z });

describe('Memorial Hall on the map', () => {
  it('routes', { timeout: 900_000 }, () => {
    const file = process.env.MAPFILE ?? new URL('../../../maps/st_johns.json', import.meta.url).pathname;
    const r = loadMap(readFileSync(file, 'utf8'));
    if (!r.ok) throw new Error('map does not load');
    const map = r.map;
    const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
    const nav = NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
    const length = (path: Vec3[] | null) => (path ? path.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.z - path[i - 1]!.z) : 0), 0) : Infinity);
    const smg = map.entities.find((e) => e.id === 'pickup_2874')!.position as P3;
    const health = map.entities.find((e) => e.id === 'pickup_2875')!.position as P3;
    const spawn = map.entities.find((e) => e.id === 'spawn_2925')!.position as P3;
    const court: P3 = [-12, 0.5, -48.5];
    const routes: [string, P3, P3][] = [
      ['court to the porch', court, [-33, 0, -48]],
      ['court to the hall, ground storey', court, [-44, 0, -50.5]],
      ['court to the SMG', court, smg],
      ['court to the health', court, health],
      ['ground storey, south end to the west passage round the drum', [-49, 0, -58], [-49.2, 0, -41.8]],
      ['ground storey, south end to the east passage round the drum', [-49, 0, -58], [-38.8, 0, -41.8]],
      ['an alcove, west wall of the middle bay', [-44, 0, -50.5], [-50.2, 0, -47.4]],
      ['an alcove, west wall of the south bay', [-44, 0, -52], [-50.2, 0, -55.1]],
      ['up the north stair', [-44, 0, -44.5], [-44, 4, -44.5]],
      ['down the north stair', [-44, 4, -44.5], [-44, 0, -44.5]],
      ['up the south stair', [-44.5, 0, -56], [-44.5, 4, -56]],
      ['down the south stair', [-44.5, 4, -56], [-44.5, 0, -56]],
      ['upper storey, south end to the north stair', [-49, 4, -58], [-44, 4, -44.5]],
      ['upper storey, behind the west row', [-44, 4, -48], [-50.4, 4, -48]],
      ['upper storey, behind the east row', [-44, 4, -48], [-37.6, 4, -48]],
      ['court to the upper storey', court, [-44, 4, -50]],
      ['the spawn to the hall', spawn, [-44, 0, -50.5]],
      ['into the wing', [-32, spawn[1], -31], [-40, 0, -32]],
      ['the spawn to the wing', spawn, [-40, 0, -32]],
    ];
    const rows: string[] = [];
    for (const [name, a, b] of routes) {
      const path = nav.findPath(v(a), v(b));
      const miss = path ? Math.hypot(path.at(-1)!.x - b[0], path.at(-1)!.y - b[1], path.at(-1)!.z - b[2]) : Infinity;
      rows.push(`${miss < 1.2 ? 'ok  ' : 'MISS'} ${name}: ${length(path).toFixed(1)} m, ends ${miss.toFixed(2)} m from its goal`);
    }
    const stand: P3[] = [[-44, 0.3, -50.5], [-44, 4.3, -48], [-44, 0.3, -57], [-48, 4.3, -57], [-49.2, 0.3, -41.8], [-38.8, 4.3, -41.8], [-44, 4.3, -52], [-40, 0.3, -32], [-33, 0.3, -48]];
    for (const p of stand) rows.push(`${physics.headroom(v(p), PLAYER.height) ? 'ok  ' : 'LOW '} standing room at ${p.join(', ')}`);
    for (const p of [smg, health]) rows.push(`${physics.headroom({ x: p[0], y: p[1] + 0.3, z: p[2] }, PLAYER.height) ? 'ok  ' : 'LOW '} standing room at a pickup ${p.join(', ')}`);
    console.log('\n' + rows.join('\n'));
    expect(rows.filter((x) => !x.startsWith('ok'))).toEqual([]);
  });
});
