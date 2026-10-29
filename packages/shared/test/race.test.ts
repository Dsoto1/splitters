import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BUTTON_FIRE,
  CORE_BOT_PROFILES,
  BUTTON_USE,
  DEFAULT_RACE_RULES,
  DEFAULT_RULES,
  TrackDriver,
  RaceDirector,
  TICK_RATE,
  TrackGeometry,
  layPathsIntoTerrain,
  racePathFromTrack,
  initPhysics,
  newTerrain,
  playableModes,
  raceGridEntities,
  terrainHeightAt,
  validateMap,
  withTrackVehicles,
  type GameEvent,
  type MapDocument,
  type RaceHost,
  type RacerView,
  type Track,
  type Vec3,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

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

/** Flat open ground with the oval on it and spawns in the infield. */
function raceMap(track: Track | null = oval()): MapDocument {
  const map = makeMap([], [[0, 0, 0], [4, 0, 0], [-4, 0, 0], [0, 0, 4]]);
  return { ...map, terrain: { ...newTerrain(180, 2), baseY: 0 }, ...(track ? { paths: [racePathFromTrack(track)] } : {}), metadata: { ...map.metadata, supportedModes: ['core.race'], recommendedPlayers: { min: 1, max: 4 } } };
}

/** A pretend match: racers are points we move along the road by hand. */
class FakeHost implements RaceHost {
  tick = 0;
  readonly events: GameEvent[] = [];
  readonly gridMounts = [0, 1, 2, 3];
  readonly views = new Map<number, RacerView>();
  readonly placed: { slot: number; pos: Vec3 }[] = [];
  ended: number | null | undefined;
  racers(): RacerView[] {
    return [...this.views.values()];
  }
  vehicle(i: number) {
    const v = [...this.views.values()].find((r) => r.mount === i);
    return v ? { alive: true, pos: v.pos, yaw: 0, speed: 10, maxSpeed: 20 } : null;
  }
  placeRacer(slot: number, mount: number, pos: Vec3): void {
    this.views.set(slot, { slot, alive: true, pos: { ...pos }, mount, driving: true });
    this.placed.push({ slot, pos: { ...pos } });
  }
  park(): void {}
  emit(ev: GameEvent): void {
    this.events.push(ev);
  }
  endRace(winner: number | null): void {
    this.ended = winner;
  }
}

/** Drive a racer along the centre line from `s0` to `s1` metres, a metre a tick. */
function drive(host: FakeHost, race: RaceDirector, slot: number, s0: number, s1: number): void {
  for (let s = s0; s <= s1; s += 1) {
    const p = race.track.at(s);
    host.views.get(slot)!.pos = { x: p.x, y: p.y, z: p.z };
    host.tick++;
    race.step();
  }
}

describe('race tracks', () => {
  it('samples a smooth circuit with checkpoints in order and a grid behind the start line', () => {
    const g = new TrackGeometry(oval());
    // Roughly the ellipse's perimeter (~298 m).
    expect(g.length).toBeGreaterThan(280);
    expect(g.length).toBeLessThan(310);
    expect(g.gates.length).toBeGreaterThanOrEqual(4);
    expect(g.gates[0]!.s).toBe(0);
    for (let i = 1; i < g.gates.length; i++) expect(g.gates[i]!.s).toBeGreaterThan(g.gates[i - 1]!.s);
    for (const slot of g.grid()) expect(g.gateSide(g.gates[0]!, slot.x, slot.z).along).toBeLessThan(-4);
    expect(g.onRoad(0, 0, -40)).toBe(true);
    expect(g.onRoad(0, 0, 0)).toBe(false);
    const near = g.nearest(3, -40)!;
    expect(Math.abs(near.lateral)).toBeLessThan(4);
  });

  it('a race road that lays levels the ground under it: flat under it, blended at the shoulders', () => {
    const hilly = { ...newTerrain(180, 2), heights: newTerrain(180, 2).heights.map((_, i) => (i % 7) * 40) };
    const t = layPathsIntoTerrain(hilly, [{ ...racePathFromTrack(oval()), lay: true }]);
    // Level across the road (the ground along it, smoothed).
    expect(Math.abs(terrainHeightAt(t, 0, -40)! - terrainHeightAt(t, 0, -37)!)).toBeLessThan(0.15);
    // Far from the road nothing changes.
    expect(terrainHeightAt(t, 0, 0)).toBeCloseTo(terrainHeightAt(hilly, 0, 0)!, 3);
  });

  it('validates: Race needs a track, inside the boundary; a good track is clean', () => {
    const codes = (m: MapDocument) => validateMap(m).map((i) => `${i.severity}:${i.code}`);
    expect(codes(raceMap(null))).toContain('error:race.no_track');
    expect(codes({ ...raceMap(), bounds: { min: [-30, -30], max: [30, 30], style: 'invisible', height: 8 } })).toContain('error:track.outside');
    expect(codes(raceMap()).filter((c) => c.startsWith('error') || c.includes('track'))).toEqual([]);
    expect(playableModes(raceMap())).toContain('core.race');
    expect(playableModes(makeMap([]))).not.toContain('core.race');
  });

  it('adds the grid vehicles after the map own entities, only for a race', () => {
    const map = raceMap();
    expect(raceGridEntities(map)).toHaveLength(4);
    expect(withTrackVehicles(map, { mode: 'core.deathmatch' })).toBe(map);
    const raced = withTrackVehicles(map, { mode: 'core.race', raceVehicle: 'speeder' });
    expect(raced.entities.slice(map.entities.length).map((e) => (e.kind === 'mount' ? e.model : e.kind))).toEqual(['speeder', 'speeder', 'speeder', 'speeder']);
  });
});

describe('race director', () => {
  it('counts checkpoints in order, laps and the finish; skipping a checkpoint does not count', () => {
    const host = new FakeHost();
    const race = new RaceDirector(host, new TrackGeometry(oval()), 2, false);
    host.views.set(0, { slot: 0, alive: true, pos: { x: 0, y: 0, z: 0 }, mount: 0, driving: true });
    host.views.set(1, { slot: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, mount: 1, driving: true });
    race.onSpawn(0);
    race.onSpawn(1);
    expect(race.holding).toBe(true);
    for (let i = 0; i < RACE_TICKS_TO_GO; i++) {
      host.tick++;
      race.step();
    }
    expect(host.events.some((e) => e.e === 'race' && e.a === 'go')).toBe(true);
    const L = race.track.length;
    // Racer 0 drives from the grid over the line and round.
    drive(host, race, 0, -8, 2);
    expect(race.status(0)).toMatchObject({ lap: 1, next: 1 });
    drive(host, race, 0, 2, L * 0.6);
    const mid = race.status(0)!;
    expect(mid.next).toBeGreaterThan(1);
    // Racer 1 jumps straight to the far side (cutting across): the checkpoints it skipped still wait.
    drive(host, race, 1, -8, 2);
    const cut = race.track.at(L * 0.6);
    host.views.get(1)!.pos = { x: cut.x, y: 0, z: cut.z };
    drive(host, race, 1, L * 0.6, L * 0.7);
    expect(race.status(1)!.next).toBe(1);
    expect(race.order()[0]!.slot).toBe(0);
    // Two full laps for racer 0: a best lap, then the finish.
    drive(host, race, 0, L * 0.6, L * 2 + 2);
    expect(race.status(0)!.finish).not.toBeNull();
    expect(race.status(0)!.best).not.toBeNull();
    const finish = host.events.find((e) => e.e === 'race' && e.a === 'finish');
    expect(finish).toMatchObject({ s: 0, n: 1 });
    expect(race.snapshot().r[0]![0]).toBe(0);
    // The others get the grace period, then the race ends with racer 0 the winner.
    for (let i = 0; i < 31 * TICK_RATE && host.ended === undefined; i++) {
      host.tick++;
      race.step();
    }
    expect(host.ended).toBe(0);
  });

  it('puts a racer who leaves their vehicle back just past their last checkpoint', () => {
    const host = new FakeHost();
    const race = new RaceDirector(host, new TrackGeometry(oval()), 3, false, false);
    host.views.set(0, { slot: 0, alive: true, pos: { x: 0, y: 0, z: 0 }, mount: 0, driving: true });
    race.onSpawn(0);
    host.tick++;
    race.step();
    drive(host, race, 0, -8, 100);
    const last = race.status(0)!.last;
    expect(last).toBeGreaterThan(0);
    // Thrown out of the vehicle.
    host.views.get(0)!.mount = null;
    const before = host.placed.length;
    for (let i = 0; i < TICK_RATE * 2; i++) {
      host.tick++;
      race.step();
    }
    expect(host.placed.length).toBe(before + 1);
    const spot = host.placed[host.placed.length - 1]!.pos;
    const gate = race.gates[last]!;
    expect(Math.hypot(spot.x - gate.x, spot.z - gate.z)).toBeLessThan(8);
    expect(race.track.gateSide(gate, spot.x, spot.z).along).toBeGreaterThan(0);
  });
});

const RACE_TICKS_TO_GO = 3 * TICK_RATE + 1;

describe('race matches', () => {
  const rules = { ...DEFAULT_RACE_RULES, raceLaps: 1 };

  it('starts everyone in a vehicle on the grid and holds them until the countdown ends', () => {
    const match = new Match(raceMap(), rules, 3);
    const me = match.addHuman('me')!;
    match.addBot('bot', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.normal);
    match.step();
    for (const c of match.combatants()) expect(c.mount?.seat).toBe(0);
    const start = { ...me.move.pos };
    for (let i = 0; i < 60; i++) {
      match.queueInputs(me.slot, [{ seq: i + 1, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: BUTTON_USE | BUTTON_FIRE }]);
      match.step();
    }
    expect(Math.hypot(me.move.pos.x - start.x, me.move.pos.z - start.z)).toBeLessThan(0.5);
    expect(me.mount).toBeDefined();
    expect(match.snapshot([]).md?.rc?.st).toBe(0);
  });

  it('a wrecked racer comes back at the last checkpoint in a fresh vehicle', () => {
    const match = new Match(raceMap(), rules, 3);
    const me = match.addHuman('me')!;
    for (let i = 0; i < RACE_TICKS_TO_GO; i++) match.step();
    // Blow the vehicle up under them.
    const m = (match as unknown as { mounts: { alive: boolean; health: number }[] }).mounts[me.mount!.index]!;
    (match as unknown as { destroyMount(m: unknown): void }).destroyMount(m);
    let back = false;
    for (let i = 0; i < 5 * TICK_RATE && !back; i++) {
      match.step();
      back = !!me.alive && !!me.mount && m.alive;
    }
    expect(back).toBe(true);
    expect(m.health).toBeGreaterThan(0);
  });

  it('a racing bot drives a full lap of the circuit and wins', () => {
    const match = new Match(raceMap(), rules, 7);
    const bot = match.addBot('Racer', CORE_BOT_PROFILES[0]!, BOT_DIFFICULTIES.normal)!;
    const events: GameEvent[] = [];
    for (let i = 0; i < 70 * TICK_RATE && !events.some((e) => e.e === 'round_end'); i++) events.push(...match.step());
    const race = match.race!;
    expect(events.some((e) => e.e === 'race' && e.a === 'finish' && e.s === bot.slot)).toBe(true);
    expect(events.find((e) => e.e === 'round_end')).toMatchObject({ winner: bot.slot });
    expect(race.status(bot.slot)?.passed).toBeGreaterThanOrEqual(race.gates.length + 1);
  });

  it('in a clean race nobody can hurt anybody', () => {
    const match = new Match(raceMap(), rules, 3);
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    expect(match.hostile(a, b)).toBe(false);
    const combat = new Match(raceMap(oval({ combat: true })), rules, 3);
    expect(combat.hostile(combat.addHuman('a')!, combat.addHuman('b')!)).toBe(true);
  });
});

describe('track driver and ambient cars', () => {
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

  it('ambient cars lap the track in any mode, belong to nobody, and come back in the pit lane when wrecked', () => {
    const map = { ...raceMap(oval({ ambient: 2 })), metadata: { ...raceMap().metadata, supportedModes: ['core.deathmatch'] } };
    const played = withTrackVehicles(map, { mode: 'core.deathmatch' });
    expect(played.entities.length).toBe(map.entities.length + 2);
    const match = new Match(map, { ...DEFAULT_RULES['core.deathmatch'], timeLimitSeconds: 0 }, 3);
    const mounts = (match as unknown as { mounts: { pos: Vec3; alive: boolean; home: { pos: Vec3 }; faction: string | null }[] }).mounts;
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
});
