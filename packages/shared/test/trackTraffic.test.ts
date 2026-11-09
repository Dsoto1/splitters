import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  GAME_MODES,
  MODE_LABELS,
  SERVER_RULES,
  TICK_RATE,
  TrackDriver,
  TrackGeometry,
  initPhysics,
  isGameMode,
  layPathsIntoTerrain,
  loadMap,
  modeOptions,
  newTerrain,
  normalizeSetup,
  playableModes,
  racePathFromTrack,
  setupFamily,
  terrainHeightAt,
  validateMap,
  validateRotation,
  withTrackVehicles,
  type MapDocument,
  type Track,
  type Vec3,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

/**
 * Race mode was removed (owner, 2026-11-08: "steer away from racing and focus on battles and maps"). The track
 * stays as map data: a path used as a track (`uses: ['race']`, no format change), whose ambient NPC cars lap it in
 * every mode as traffic and hazards, driven by TrackDriver.
 */

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** An oval circuit, 110 × 80 m, run anticlockwise seen from above (+x first, then +z). */
function oval(o: Partial<Track> = {}): Track {
  const points: [number, number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    points.push([Math.round(Math.sin(a) * 55 * 100) / 100, 0, Math.round(-Math.cos(a) * 40 * 100) / 100]);
  }
  return { points, width: 12, loop: true, laps: 2, grid: 4, vehicle: 'kart', combat: false, surface: 'asphalt', curbs: true, ambient: 0, ambientVehicle: 'kart', pit: null, ...o };
}

/** Flat open ground with the oval on it and spawns in the infield, offering `modes`. */
function trackMap(track: Track | null = oval(), modes: string[] = ['core.deathmatch']): MapDocument {
  const map = makeMap([], [[0, 0, 0], [4, 0, 0], [-4, 0, 0], [0, 0, 4]]);
  return { ...map, terrain: { ...newTerrain(180, 2), baseY: 0 }, ...(track ? { paths: [racePathFromTrack(track)] } : {}), metadata: { ...map.metadata, supportedModes: modes, recommendedPlayers: { min: 1, max: 8 } } };
}

type MountView = { yaw: number; pos: Vec3; alive: boolean; home: { pos: Vec3 }; faction: string | null; ambient?: boolean; speed: number };
const mountsOf = (match: Match) => (match as unknown as { mounts: MountView[] }).mounts;

const MAPS = new URL('../../../maps/', import.meta.url);
const shipped = (id: string): MapDocument => {
  const r = loadMap(JSON.parse(readFileSync(new URL(`${id}.json`, MAPS), 'utf8')));
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('; '));
  return r.map;
};

describe('Race is no longer a mode', () => {
  it('is in no mode list: GAME_MODES, labels, default rules, setup families, server rules', () => {
    expect(GAME_MODES as readonly string[]).not.toContain('core.race');
    expect(isGameMode('core.race')).toBe(false);
    expect(Object.keys(MODE_LABELS)).not.toContain('core.race');
    expect(Object.keys(DEFAULT_RULES)).not.toContain('core.race');
    for (const m of GAME_MODES) expect(setupFamily(m) as string).not.toBe('race');
    for (const key of ['laps', 'racevehicle', 'racecombat']) expect(SERVER_RULES.some((r) => r.key === key)).toBe(false);
  });

  it('a map with a track no longer offers Race (Match Setup, Quick Play and the vote read playableModes)', () => {
    const map = trackMap(oval({ ambient: 2 }), ['core.deathmatch', 'core.tdm']);
    expect(playableModes(map)).not.toContain('core.race');
    expect(modeOptions(map, playableModes(map)).map((o) => o.mode) as string[]).not.toContain('core.race');
    expect(playableModes(map)).toEqual(expect.arrayContaining(['core.deathmatch', 'core.tdm']));
  });

  it('a map that still lists race loads, plays its other modes, and MapMaker is told to drop it', () => {
    const old = trackMap(oval(), ['core.race', 'core.deathmatch']);
    const r = loadMap(old);
    expect(r.ok).toBe(true);
    expect(playableModes(old)).not.toContain('core.race');
    expect(playableModes(old)[0]).toBe('core.deathmatch');
    expect(validateMap(old).filter((i) => i.code === 'race.removed').map((i) => i.severity)).toEqual(['warning']);
    expect(validateMap(old).filter((i) => i.severity === 'error')).toEqual([]);
    // Race alone: it falls back to Deathmatch rather than offering nothing.
    expect(playableModes(trackMap(oval(), ['core.race']))[0]).toBe('core.deathmatch');
    // The two shipped maps that listed it (Apex Ring, Sandsweep) had it dropped in MapMaker's Map properties.
    for (const id of ['apex_ring', 'sandsweep']) {
      const map = shipped(id);
      expect(map.metadata.supportedModes).not.toContain('core.race');
      expect(playableModes(map)).toContain('core.deathmatch');
    }
  });

  it('saved setups, rotations and requests that ask for race are refused or fall back', () => {
    expect(normalizeSetup({ mode: 'core.race', bots: 3 })?.mode).not.toBe('core.race');
    const lookup = (id: string) => (id === 'apex_ring' ? { name: 'Apex Ring', modes: playableModes(shipped('apex_ring')) } : null);
    const r = validateRotation(['apex_ring:race', 'apex_ring:core.race', 'apex_ring:tdm'], lookup);
    expect(r.entries).toEqual([{ map: 'apex_ring', mode: 'core.tdm' }]);
    expect(r.dropped).toHaveLength(2);
  });
});

describe('tracks (map data)', () => {
  it('samples a smooth circuit with checkpoints in order', () => {
    const g = new TrackGeometry(oval());
    // Roughly the ellipse's perimeter (~298 m).
    expect(g.length).toBeGreaterThan(280);
    expect(g.length).toBeLessThan(310);
    expect(g.gates.length).toBeGreaterThanOrEqual(4);
    expect(g.gates[0]!.s).toBe(0);
    for (let i = 1; i < g.gates.length; i++) expect(g.gates[i]!.s).toBeGreaterThan(g.gates[i - 1]!.s);
    expect(g.onRoad(0, 0, -40)).toBe(true);
    expect(g.onRoad(0, 0, 0)).toBe(false);
    const near = g.nearest(3, -40)!;
    expect(Math.abs(near.lateral)).toBeLessThan(4);
  });

  it('a track road that lays levels the ground under it: flat under it, blended at the shoulders', () => {
    const hilly = { ...newTerrain(180, 2), heights: newTerrain(180, 2).heights.map((_, i) => (i % 7) * 40) };
    const t = layPathsIntoTerrain(hilly, [{ ...racePathFromTrack(oval()), lay: true }]);
    expect(Math.abs(terrainHeightAt(t, 0, -40)! - terrainHeightAt(t, 0, -37)!)).toBeLessThan(0.15);
    expect(terrainHeightAt(t, 0, 0)).toBeCloseTo(terrainHeightAt(hilly, 0, 0)!, 3);
  });

  it('validates: inside the boundary; a good track is clean', () => {
    const codes = (m: MapDocument) => validateMap(m).map((i) => `${i.severity}:${i.code}`);
    expect(codes({ ...trackMap(), bounds: { min: [-30, -30], max: [30, 30], style: 'invisible', height: 8 } })).toContain('error:track.outside');
    expect(codes(trackMap()).filter((c) => c.startsWith('error') || c.includes('track') || c.includes('race'))).toEqual([]);
  });

  it('adds only the ambient cars after the map own entities (no start grid)', () => {
    const map = trackMap(oval({ ambient: 3, ambientVehicle: 'speeder' }));
    const played = withTrackVehicles(map);
    expect(played.entities.slice(map.entities.length).map((e) => (e.kind === 'mount' ? e.model : e.kind))).toEqual(['speeder', 'speeder', 'speeder']);
    const quiet = trackMap();
    expect(withTrackVehicles(quiet)).toBe(quiet);
  });
});

describe('track driver and ambient NPC cars (traffic in battle modes)', () => {
  it('a track driver pulls out to pass a slow car in its lane', () => {
    const g = new TrackGeometry(oval());
    const p = g.at(20);
    const yaw = Math.atan2(p.dx, p.dz);
    const me = { pos: { x: p.x, y: 0, z: p.z }, yaw, speed: 15, maxSpeed: 20 };
    const q = g.at(30);
    const slow = { pos: { x: q.x, y: 0, z: q.z }, yaw, speed: 3, maxSpeed: 20 };
    const free = new TrackDriver().drive(g, me, 1, []);
    const passing = new TrackDriver().drive(g, me, 1, [slow]);
    expect(Math.abs(passing.right - free.right)).toBeGreaterThan(0.1);
  });

  it('ambient cars lap the track in Deathmatch, belong to nobody, and come back in the pit lane when wrecked', () => {
    const map = trackMap(oval({ ambient: 2 }));
    expect(withTrackVehicles(map).entities.length).toBe(map.entities.length + 2);
    const match = new Match(map, { ...DEFAULT_RULES['core.deathmatch'], timeLimitSeconds: 0 }, 3);
    const mounts = mountsOf(match);
    expect(mounts).toHaveLength(2);
    const start = mounts.map((m) => ({ ...m.pos }));
    for (let i = 0; i < 10 * TICK_RATE; i++) match.step();
    const g = new TrackGeometry(oval());
    for (const [i, m] of mounts.entries()) {
      expect(Math.hypot(m.pos.x - start[i]!.x, m.pos.z - start[i]!.z)).toBeGreaterThan(40);
      expect(Math.abs(g.nearest(m.pos.x, m.pos.z)!.lateral)).toBeLessThan(8);
      expect(m.faction).toBeNull();
    }
    (match as unknown as { destroyMount(m: unknown): void }).destroyMount(mounts[0]);
    for (let i = 0; i < 13 * TICK_RATE && !mounts[0]!.alive; i++) match.step();
    expect(mounts[0]!.alive).toBe(true);
    expect(Math.hypot(mounts[0]!.pos.x - mounts[0]!.home.pos.x, mounts[0]!.pos.z - mounts[0]!.home.pos.z)).toBeLessThan(3);
  });

  it('in Team Deathmatch on a track map the NPC cars keep lapping while the teams fight', () => {
    const map = trackMap(oval({ ambient: 3 }), ['core.tdm']);
    expect(playableModes(map)[0]).toBe('core.tdm');
    const match = new Match(map, { ...DEFAULT_RULES['core.tdm'], timeLimitSeconds: 0, scoreLimit: 0 }, 5);
    for (let i = 0; i < 4; i++) match.addHuman(`p${i}`);
    const mounts = mountsOf(match);
    expect(mounts.filter((m) => m.ambient)).toHaveLength(3);
    const g = new TrackGeometry(oval());
    // Distance driven along the centre line, lap after lap (wrapping at the start line).
    const along = mounts.map((m) => g.nearest(m.pos.x, m.pos.z)!.sample.s);
    const driven = mounts.map(() => 0);
    for (let i = 0; i < 40 * TICK_RATE; i++) {
      match.step();
      mounts.forEach((m, k) => {
        const s = g.nearest(m.pos.x, m.pos.z, 400)?.sample.s;
        if (s === undefined) return;
        let d = s - along[k]!;
        if (d < -g.length / 2) d += g.length;
        if (d > g.length / 2) d -= g.length;
        driven[k]! += d;
        along[k] = s;
      });
    }
    // Every car has gone round at least once, the way the track runs, and stays on the road.
    for (const [k, m] of mounts.entries()) {
      expect(driven[k]).toBeGreaterThan(g.length);
      expect(Math.abs(g.nearest(m.pos.x, m.pos.z)!.lateral)).toBeLessThan(8);
      expect(m.faction).toBeNull();
    }
  });

  it('an NPC car runs over someone standing on the road (roadkill, credited to nobody)', () => {
    const map = trackMap(oval({ ambient: 1 }), ['core.tdm']);
    const match = new Match(map, { ...DEFAULT_RULES['core.tdm'], timeLimitSeconds: 0, scoreLimit: 0 }, 9);
    const victim = match.addHuman('walker')!;
    const car = mountsOf(match)[0]!;
    for (let i = 0; i < 3 * TICK_RATE; i++) match.step();
    expect(Math.abs(car.speed)).toBeGreaterThan(5);
    const v = victim as unknown as { alive: boolean; health: number; move: { pos: Vec3 } };
    expect(v.alive).toBe(true);
    const full = v.health;
    let crash = false;
    for (let i = 0; i < 6 * TICK_RATE && !crash; i++) {
      // The walker steps out onto the road a few metres in front of the car.
      if (v.alive && i < TICK_RATE) v.move.pos = { x: car.pos.x + Math.sin(car.yaw) * 3, y: v.move.pos.y, z: car.pos.z + Math.cos(car.yaw) * 3 };
      crash = match.step().some((ev) => ev.e === 'crash');
    }
    expect(crash).toBe(true);
    expect(!v.alive || v.health < full).toBe(true);
  });
});
