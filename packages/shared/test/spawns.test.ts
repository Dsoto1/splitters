import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_RULES, PLAYER, TICK_RATE, createRng, horizontalDistance, initPhysics, loadMap, rulesForMode, type MapDocument, type Vec3 } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { SPAWN_RECENT_TICKS, WAVE_MIN_PLAYERS, distinctSpots, generateSpawns, pickSpawn, spawnScore, spawnShortfall, spawnsPerTick, type SpawnSpot } from '../src/sim/spawns.ts';
import { validateMap } from '../src/map/validate.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const spot = (x: number, z: number, team: string | null = null): SpawnSpot => ({ pos: { x, y: 0, z }, yaw: 0, team });
const choice = (candidates: SpawnSpot[], over: Partial<Parameters<typeof pickSpawn>[0]> = {}) => ({ tick: 1000, candidates, lastUsed: new Map<SpawnSpot, number>(), enemies: [] as Vec3[], occupants: [] as Vec3[], rng: createRng(1), ...over });

describe('choosing a spawn point', () => {
  it('stays away from enemies, off occupied and just-used points, and out of enemy sight', () => {
    const a = spot(0, 0);
    const b = spot(0, 30);
    const c = spot(80, 0);
    // Enemies beside c: a or b (about as safe as each other), never c.
    const enemies = [{ x: 85, y: 0, z: 0 }, { x: 85, y: 0, z: 30 }];
    expect(pickSpawn(choice([a, b, c], { enemies }))).not.toBe(2);
    // Someone standing on a: b. Someone on b: a.
    expect(pickSpawn(choice([a, b, c], { enemies, occupants: [{ x: 0.3, y: 0, z: 0.2 }] }))).toBe(1);
    expect(pickSpawn(choice([a, b, c], { enemies, occupants: [{ x: 0.2, y: 0, z: 30.1 }] }))).toBe(0);
    // a used a moment ago: b; b used a moment ago: a; long ago counts for nothing.
    expect(pickSpawn(choice([a, b, c], { enemies, lastUsed: new Map([[a, 1000 - 10]]) }))).toBe(1);
    expect(pickSpawn(choice([a, b, c], { enemies, lastUsed: new Map([[b, 1000 - 10]]) }))).toBe(0);
    const base = spawnScore(a, choice([a, b, c], { enemies }));
    expect(spawnScore(a, choice([a, b, c], { enemies, lastUsed: new Map([[a, 1000 - 10]]) }))).toBeLessThan(base - 15);
    expect(spawnScore(a, choice([a, b, c], { enemies, lastUsed: new Map([[a, 1000 - SPAWN_RECENT_TICKS - 1]]) }))).toBe(base);
    // An enemy 45 m from a with a clear line to it, none to b: b (the sight check costs a handful of rays at most).
    let rays = 0;
    const sees = (from: Vec3, to: Vec3) => {
      rays++;
      return Math.abs(to.x) < 1 && Math.abs(to.z) < 1 && Math.abs(from.x + 45) < 1;
    };
    expect(pickSpawn(choice([a, b], { enemies: [{ x: -45, y: 0, z: 15 }], sees }))).toBe(1);
    expect(rays).toBeLessThanOrEqual(18);
  });

  it('spawns bots in waves in big matches, everyone at once in small ones', () => {
    expect(spawnsPerTick(WAVE_MIN_PLAYERS - 1)).toBe(Infinity);
    expect(spawnsPerTick(32)).toBe(4);
    expect(spawnsPerTick(96)).toBe(12);
    const map = loadMap(readFileSync(new URL('../../../maps/riot_junction.json', import.meta.url), 'utf8'));
    if (!map.ok) throw new Error('map');
    const match = new Match(map.map, { ...rulesForMode(map.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [24, 24] }, 3);
    for (let i = 0; i < 48; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % 4]!, BOT_DIFFICULTIES.normal);
    // The first few join at once; the rest wait for their wave.
    expect(match.combatants().filter((c) => c.alive).length).toBe(WAVE_MIN_PLAYERS - 1);
    const spawned: number[] = [];
    let alive = match.combatants().filter((c) => c.alive).length;
    for (let t = 0; t < TICK_RATE; t++) {
      match.step();
      const now = match.combatants().filter((c) => c.alive).length;
      spawned.push(now - alive);
      alive = now;
    }
    expect(Math.max(...spawned)).toBe(spawnsPerTick(48));
    expect(match.combatants().every((c) => c.alive)).toBe(true);
    // Nobody spawned on top of anybody.
    const all = match.combatants();
    let stacked = 0;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (horizontalDistance(all[i]!.move.pos, all[j]!.move.pos) < 0.3) stacked++;
    expect(stacked).toBe(0);
    // Waiting bots had their loadout all along.
    expect(all.every((c) => c.weapons.size > 0)).toBe(true);
    match.destroy();
  });
});

describe('made-up spawn points', () => {
  it('counts how many a side is short, with bunched points counting once', () => {
    expect(distinctSpots([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }])).toBe(2);
    const pts = [spot(0, 0, 'a'), spot(1, 0, 'a'), spot(50, 0, 'b'), spot(80, 0, 'b'), spot(110, 0, 'b'), spot(140, 0, 'b')];
    // 8 players: small, nothing made up.
    expect(spawnShortfall(pts, [{ id: 'a', players: 4 }, { id: 'b', players: 4 }], 8).size).toBe(0);
    // 24 a side: 8 points each wanted; a has one distinct place, b four.
    const short = spawnShortfall(pts, [{ id: 'a', players: 24 }, { id: 'b', players: 24 }], 48);
    expect(short.get('a')).toBe(7);
    expect(short.get('b')).toBe(4);
    // Free-for-all: one shared pool.
    expect(spawnShortfall(pts, null, 30).get(null)).toBe(10 - 5);
  });

  it('are valid, spread, on the right side and the same for the same map and seed (and the map is untouched)', () => {
    const raw = readFileSync(new URL('../../../maps/canyon.json', import.meta.url), 'utf8');
    const build = (seed: number) => {
      const r = loadMap(raw);
      if (!r.ok) throw new Error('map');
      const before = r.map.entities.filter((e) => e.kind === 'spawn').length;
      const m = new Match(r.map, { ...rulesForMode(r.map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0, teamSizes: [48, 48] }, seed);
      for (let i = 0; i < 96; i++) m.addBot(`b${i}`, CORE_BOT_PROFILES[i % 4]!, BOT_DIFFICULTIES.normal);
      m.step();
      expect(r.map.entities.filter((e) => e.kind === 'spawn').length).toBe(before);
      return m;
    };
    const m = build(11);
    const made = m.spawnPoints.filter((s) => s.generated);
    expect(made.length).toBeGreaterThanOrEqual(8);
    const sides = new Set(made.map((s) => s.team));
    expect(sides.size).toBe(2);
    for (const side of sides) {
      const own = m.spawnPoints.filter((s) => s.team === side && !s.generated).map((s) => s.pos);
      const other = m.spawnPoints.filter((s) => s.team !== side && s.team !== null && !s.generated).map((s) => s.pos);
      const home = { x: own.reduce((a, p) => a + p.x, 0) / own.length, z: own.reduce((a, p) => a + p.z, 0) / own.length };
      const away = { x: other.reduce((a, p) => a + p.x, 0) / other.length, z: other.reduce((a, p) => a + p.z, 0) / other.length };
      for (const s of made.filter((x) => x.team === side)) {
        // On the side's own half (of the line between the bases).
        const ax = away.x - home.x;
        const az = away.z - home.z;
        expect(((s.pos.x - home.x) * ax + (s.pos.z - home.z) * az) / (ax * ax + az * az)).toBeLessThanOrEqual(0.5);
        // Walkable, with standing room, and reachable from the side's own spawns.
        expect(m.nav.closestPoint(s.pos, { x: 0.5, y: 1, z: 0.5 })).not.toBeNull();
        expect(m.physics.headroom({ x: s.pos.x, y: s.pos.y + 0.05, z: s.pos.z }, PLAYER.height)).toBe(true);
        expect(m.nav.findPath(own[0]!, s.pos)).not.toBeNull();
        // At least 6 m from every other spawn point of the side.
        for (const o of m.spawnPoints) if (o !== s && (o.team === side || o.team === null) && Math.abs(o.pos.y - s.pos.y) < 2) expect(horizontalDistance(o.pos, s.pos)).toBeGreaterThanOrEqual(5.9);
      }
    }
    const again = build(11);
    expect(again.spawnPoints.filter((s) => s.generated).map((s) => s.pos)).toEqual(made.map((s) => s.pos));
    m.destroy();
    again.destroy();
  }, 120_000);

  it('makes up nothing for small matches or maps with plenty of spawns', () => {
    const tiles = [];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    const map: MapDocument = makeMap(tiles, [[0, 0, 4], [30, 0, 4], [10, 0, 10], [20, 0, 10]]);
    const m = new Match(map, { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3] }, 1);
    for (let i = 0; i < 6; i++) m.addBot(`b${i}`, CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.normal);
    m.step();
    expect(m.spawnPoints.some((s) => s.generated)).toBe(false);
    m.destroy();
    // Direct: a count of zero, or no places, makes nothing.
    expect(generateSpawns({ places: [], existing: [], side: null, count: 4, seed: 1, faceTo: { x: 0, y: 0, z: 0 }, valid: () => true, reachable: () => true })).toEqual([]);
  });

  it("MapMaker's validator warns when a team has too few spawn points of its own", () => {
    const tiles = [{ id: 'y0', tile: 'core.yard', x: 0, y: 0, z: 0, rotation: 0 as const }];
    // 24 players, two teams: a point per 3 players a side wants 4 each.
    const teamMap = (red: number, blue: number): MapDocument => {
      const map = makeMap(tiles, []);
      map.metadata.recommendedPlayers = { min: 2, max: 24 };
      map.entities = [
        ...Array.from({ length: red }, (_, i) => ({ id: `r${i}`, kind: 'spawn' as const, position: [i, 0, 0] as [number, number, number], yaw: 0, faction: 'red' })),
        ...Array.from({ length: blue }, (_, i) => ({ id: `b${i}`, kind: 'spawn' as const, position: [i, 0, 6] as [number, number, number], yaw: 0, faction: 'blue' })),
      ];
      return map;
    };
    const few = (map: MapDocument) => validateMap(map).filter((i) => i.code === 'spawn.few');
    // Enough points overall (24), but blue has only 2 of its own.
    const short = few(teamMap(22, 2));
    expect(short.length).toBe(1);
    expect(short[0]!.severity).toBe('warning');
    expect(short[0]!.message).toMatch(/^blue has fewer than 4 spawn points/);
    expect(short[0]!.message).toContain('add spawn points of their own');
    expect(few(teamMap(12, 12))).toEqual([]);
  });
});
