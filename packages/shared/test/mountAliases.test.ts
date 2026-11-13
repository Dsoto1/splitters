import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_USE,
  DEFAULT_DEATHMATCH_RULES,
  MOUNT_DEFS,
  MOUNT_MODELS,
  MapDocument,
  RACE_VEHICLES,
  RETIRED_MOUNTS,
  RETIRED_MOUNT_MODELS,
  TICK_RATE,
  applyCommand,
  getMountDef,
  initPhysics,
  invertCommand,
  isRetiredMount,
  liveMount,
  loadMap,
  mapIdentity,
  newTerrain,
  placedMountDef,
  racePathFromTrack,
  raceTrack,
  releaseCurrent,
  replaceRetiredMountCommand,
  retiredMountUses,
  stampMapRelease,
  validateMap,
  withMountAliases,
  withTrackVehicles,
  type GameEvent,
  type PlayerInput,
  type Track,
  type Vec3,
} from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

/**
 * The Go-Kart and the Ice Cream Truck were retired (owner, 2026-11-12). Maps name a vehicle by id, so the two ids
 * stay readable (sim/mounts.ts RETIRED_MOUNTS, map/mountAliases.ts): a map that still names one is a valid file as
 * written (its release stamp still describes it), plays with the vehicle that took its place (the Hover Bike for
 * the Go-Kart, the Buggy for the Ice Cream Truck), and MapMaker replaces them all in one step.
 */

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const MAPS = new URL('../../../maps/', import.meta.url);
type MountView = { def: { id: string }; pos: Vec3; alive: boolean; seats: (number | null)[]; speed: number; ambient?: boolean };
const mountsOf = (match: Match) => (match as unknown as { mounts: MountView[] }).mounts;

class Driver {
  private seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput> = {}): void {
    const seq = (this.seq.get(c.slot) ?? 0) + 1;
    this.seq.set(c.slot, seq);
    this.match.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      each();
      out.push(...this.match.step());
    }
    return out;
  }
}

/** A map file as an old MapMaker wrote it: an open yard with a Go-Kart and an Ice Cream Truck parked on it. */
function oldFile(): Record<string, unknown> & { entities: Record<string, unknown>[] } {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles) as unknown as { entities: Record<string, unknown>[] };
  return {
    ...map,
    entities: [
      ...map.entities,
      { id: 'mount_kart', kind: 'mount', model: 'kart', position: [4, 0, 12], yaw: Math.PI / 2, faction: null, respawnSeconds: null },
      { id: 'mount_van', kind: 'mount', model: 'ice_cream_truck', position: [20, 0, 20], yaw: 0, faction: null, respawnSeconds: 90, skin: 'desert' },
    ],
  };
}

/** An oval track, as an old file had it: its cars (and its old race vehicle) karts. */
function oldTrackFile(ambient = 3): Record<string, unknown> & { paths: { id: string; race?: Record<string, unknown> }[] } {
  const points: [number, number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    points.push([Math.round(Math.sin(a) * 55 * 100) / 100, 0, Math.round(-Math.cos(a) * 40 * 100) / 100]);
  }
  const track = { points, width: 12, loop: true, laps: 2, grid: 4, vehicle: 'kart', combat: false, surface: 'asphalt', curbs: true, ambient, ambientVehicle: 'kart', pit: null } as unknown as Track;
  const base = makeMap([], [[0, 0, 0], [4, 0, 0]]);
  return { ...base, terrain: { ...newTerrain(180, 2), baseY: 0 }, paths: [racePathFromTrack(track)] } as unknown as ReturnType<typeof oldTrackFile>;
}

describe('retired vehicles (Go-Kart, Ice Cream Truck)', () => {
  it('are in no list: not placeable, no definition of their own, not offered for a track', () => {
    expect([...RETIRED_MOUNT_MODELS].sort()).toEqual(Object.keys(RETIRED_MOUNTS).sort());
    for (const id of RETIRED_MOUNT_MODELS) {
      expect(MOUNT_MODELS as readonly string[]).not.toContain(id);
      expect(Object.keys(MOUNT_DEFS)).not.toContain(id);
      expect(RACE_VEHICLES as readonly string[]).not.toContain(id);
      expect(isRetiredMount(id)).toBe(true);
    }
    expect(isRetiredMount('tank')).toBe(false);
    expect(isRetiredMount('toString')).toBe(false);
  });

  it('each stands for a vehicle that exists: the Hover Bike (one seat, no gun) and the Buggy (no mounted gun)', () => {
    expect(RETIRED_MOUNTS).toEqual({ kart: 'hover_bike', ice_cream_truck: 'troop_buggy', buggy: 'troop_buggy' });
    for (const to of Object.values(RETIRED_MOUNTS)) expect(MOUNT_MODELS).toContain(to);
    expect(MOUNT_DEFS.hover_bike.seats).toHaveLength(1);
    // Neither replacement brings a mounted weapon the retired vehicle didn't have.
    for (const to of Object.values(RETIRED_MOUNTS)) expect(MOUNT_DEFS[to].seats.some((s) => s.weapon)).toBe(false);
    expect(liveMount('kart')).toBe('hover_bike');
    expect(liveMount('ice_cream_truck')).toBe('troop_buggy');
    expect(liveMount('tank')).toBe('tank');
    // Whoever asks for a retired vehicle's definition gets its replacement's.
    expect(getMountDef('kart')).toBe(MOUNT_DEFS.hover_bike);
    expect(placedMountDef('ice_cream_truck')).toBe(MOUNT_DEFS.troop_buggy);
    expect(getMountDef('unicycle')).toBeUndefined();
  });

  it('an old map file that places them is valid as written, and loads to play with their replacements', () => {
    // As written: the schema still reads the two ids (MapMaker opens the map as made).
    const written = MapDocument.parse(oldFile());
    expect(written.entities.filter((e) => e.kind === 'mount').map((e) => e.model)).toEqual(['kart', 'ice_cream_truck']);
    const editing = loadMap(JSON.stringify(oldFile()), undefined, { forEditing: true });
    expect(editing.ok && editing.map.entities.filter((e) => e.kind === 'mount').map((e) => e.model)).toEqual(['kart', 'ice_cream_truck']);
    // As played: the replacements, everything else about each placement kept.
    const r = loadMap(JSON.stringify(oldFile()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const mounts = r.map.entities.filter((e) => e.kind === 'mount');
    expect(mounts.map((e) => [e.id, e.model])).toEqual([['mount_kart', 'hover_bike'], ['mount_van', 'troop_buggy']]);
    expect(mounts[1]).toMatchObject({ position: [20, 0, 20], yaw: 0, respawnSeconds: 90, skin: 'desert' });
    // MapMaker's checks say so, once per retired vehicle, as a warning.
    const told = r.issues.filter((i) => i.code === 'mount.retired');
    expect(told.map((i) => i.severity)).toEqual(['warning', 'warning']);
    expect(told[0]!.message).toMatch(/Go-Kart is retired .*plays as the Hover Bike/);
    expect(told[1]!.message).toMatch(/Ice Cream Truck is retired .*plays as the Troop Buggy/);
    // The played map has nothing left to say about it; a map that names neither is untouched (the same object).
    expect(validateMap(r.map).filter((i) => i.code === 'mount.retired')).toEqual([]);
    expect(withMountAliases(r.map)).toBe(r.map);
    // A vehicle that never existed is still refused.
    const bad = oldFile();
    bad.entities.at(-1)!.model = 'unicycle';
    expect(loadMap(JSON.stringify(bad)).ok).toBe(false);
  });

  it("an exported map's release stamp still describes it: no new version, no \"changed since it was exported\"", () => {
    const stamped = stampMapRelease(MapDocument.parse(oldFile()), new Date('2026-10-30T00:00:00Z'));
    const text = JSON.stringify(stamped);
    const editing = loadMap(text, undefined, { forEditing: true });
    expect(editing.ok && releaseCurrent(editing.map)).toBe(true);
    expect(editing.ok && mapIdentity(editing.map)).toMatchObject({ stamped: true, versionId: stamped.metadata.release!.versionId, contentHash: stamped.metadata.release!.contentHash });
    const played = loadMap(text);
    expect(played.ok && played.issues.filter((i) => i.code === 'release.changed')).toEqual([]);
  });

  it('and plays: both are in the match, and the one that was a Go-Kart is got into and driven', () => {
    const r = loadMap(JSON.stringify(oldFile()));
    if (!r.ok) throw new Error('the old file did not load');
    const match = new Match(r.map, { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 });
    const d = new Driver(match);
    const me = match.addHuman('me')!;
    d.run(2);
    const [bike, buggy] = mountsOf(match);
    expect([bike!.def.id, buggy!.def.id]).toEqual(['hover_bike', 'troop_buggy']);
    expect(bike!.alive && buggy!.alive).toBe(true);
    me.move = { pos: { x: bike!.pos.x, y: 0, z: bike!.pos.z + 1.5 }, velY: 0, grounded: true };
    d.run(1, () => d.input(me, { buttons: BUTTON_USE }));
    d.run(1, () => d.input(me));
    expect(me.mount).toMatchObject({ seat: 0 });
    const from = { ...bike!.pos };
    d.run(TICK_RATE * 2, () => d.input(me, { forward: 1 }));
    expect(Math.hypot(bike!.pos.x - from.x, bike!.pos.z - from.z)).toBeGreaterThan(8);
    // A match made straight from the file as written (no loadMap) plays the same vehicles.
    const direct = new Match(MapDocument.parse(oldFile()), { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 });
    expect(mountsOf(direct).map((m) => m.def.id)).toEqual(['hover_bike', 'troop_buggy']);
  });

  it("an old track whose NPC cars are karts laps hover bikes; a track that doesn't say gets them too", () => {
    const file = oldTrackFile();
    expect(file.paths[0]!.race).toMatchObject({ vehicle: 'kart', ambientVehicle: 'kart' });
    // As written the path still says kart; the track as the game reads it is on hover bikes either way.
    const written = MapDocument.parse(file);
    expect(written.paths![0]!.race).toMatchObject({ vehicle: 'kart', ambientVehicle: 'kart' });
    expect(raceTrack(written)).toMatchObject({ vehicle: 'hover_bike', ambientVehicle: 'hover_bike', ambient: 3 });
    expect(withTrackVehicles(written).entities.filter((e) => e.kind === 'mount').map((e) => e.model)).toEqual(['hover_bike', 'hover_bike', 'hover_bike']);
    const r = loadMap(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.map.paths![0]!.race).toMatchObject({ vehicle: 'hover_bike', ambientVehicle: 'hover_bike' });
    expect(r.issues.filter((i) => i.code === 'mount.retired').map((i) => i.message)[0]).toMatch(/Go-Kart is retired \(the track's cars \(race_track\)\)/);
    const match = new Match(r.map, { ...DEFAULT_DEATHMATCH_RULES, timeLimitSeconds: 0 }, 3);
    const cars = mountsOf(match).filter((m) => m.ambient);
    expect(cars.map((m) => m.def.id)).toEqual(['hover_bike', 'hover_bike', 'hover_bike']);
    const start = cars.map((m) => ({ ...m.pos }));
    for (let i = 0; i < 10 * TICK_RATE; i++) match.step();
    for (const [i, m] of cars.entries()) expect(Math.hypot(m.pos.x - start[i]!.x, m.pos.z - start[i]!.z)).toBeGreaterThan(40);
    // No race settings at all, or none that name a vehicle: the defaults (the Go-Kart was the default).
    const { race: _race, ...plain } = file.paths[0]!;
    const bare = loadMap(JSON.stringify({ ...file, paths: [plain] }));
    expect(bare.ok && raceTrack(bare.map)).toMatchObject({ vehicle: 'hover_bike', ambientVehicle: 'hover_bike' });
    const some = loadMap(JSON.stringify({ ...file, paths: [{ ...plain, race: { ambient: 2 } }] }));
    expect(some.ok && raceTrack(some.map)).toMatchObject({ ambient: 2, ambientVehicle: 'hover_bike' });
  });

  it("MapMaker's Replace all puts the replacement in the map (placed ones and the track), one undo step", () => {
    const doc = MapDocument.parse({ ...oldFile(), terrain: oldTrackFile().terrain, paths: oldTrackFile().paths });
    expect(retiredMountUses(doc)).toEqual([
      { model: 'kart', entities: ['mount_kart'], paths: ['race_track'] },
      { model: 'ice_cream_truck', entities: ['mount_van'], paths: [] },
    ]);
    const r = replaceRetiredMountCommand(doc, 'kart');
    expect([r.placed, r.tracks]).toEqual([1, 1]);
    const next = applyCommand(doc, r.command);
    expect(next.entities.find((e) => e.id === 'mount_kart')).toMatchObject({ kind: 'mount', model: 'hover_bike', position: [4, 0, 12] });
    expect(next.paths![0]!.race).toMatchObject({ vehicle: 'hover_bike', ambientVehicle: 'hover_bike', ambient: 3 });
    // The other retired vehicle is its own Replace all; undo puts the karts back.
    expect(retiredMountUses(next)).toEqual([{ model: 'ice_cream_truck', entities: ['mount_van'], paths: [] }]);
    expect(applyCommand(next, invertCommand(r.command))).toEqual(doc);
    const both = applyCommand(next, replaceRetiredMountCommand(next, 'ice_cream_truck').command);
    expect(both.entities.find((e) => e.id === 'mount_van')).toMatchObject({ model: 'troop_buggy', respawnSeconds: 90, skin: 'desert' });
    expect(retiredMountUses(both)).toEqual([]);
    expect(validateMap(both).filter((i) => i.code === 'mount.retired')).toEqual([]);
    // Another vehicle than the usual one: the placed ones only (a track has its own list).
    const jeep = replaceRetiredMountCommand(doc, 'ice_cream_truck', 'gun_jeep');
    expect([jeep.placed, jeep.tracks]).toEqual([1, 0]);
    expect(applyCommand(doc, jeep.command).entities.find((e) => e.id === 'mount_van')).toMatchObject({ model: 'gun_jeep' });
    // Nothing to replace: nothing happens.
    const none = replaceRetiredMountCommand(both, 'kart');
    expect([none.placed, none.tracks]).toEqual([0, 0]);
  });

  it('a shipped map as it was before (Cedar Lane, format v27, stamped, with its Ice Cream Truck) loads and plays with a Buggy there', () => {
    const text = readFileSync(new URL('./fixtures/cedar_lane_v27_ice_cream_truck.json', import.meta.url), 'utf8');
    const raw = JSON.parse(text) as { formatVersion: number; metadata: { release?: { versionId: string } }; entities: { id: string; kind: string; model?: string; position: number[] }[] };
    const was = raw.entities.filter((e) => e.kind === 'mount' && e.model === 'ice_cream_truck');
    expect(raw.formatVersion).toBe(27);
    expect(was).toHaveLength(1);
    const r = loadMap(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Its release stamp still describes the file: the only thing said is that the truck is retired.
    expect(r.issues.filter((i) => i.severity !== 'suggestion').map((i) => i.code)).toEqual(['mount.retired']);
    const editing = loadMap(text, undefined, { forEditing: true });
    expect(editing.ok && raw.metadata.release && mapIdentity(editing.map).versionId).toBe(raw.metadata.release?.versionId);
    const now = r.map.entities.find((e) => e.id === was[0]!.id);
    expect(now).toMatchObject({ kind: 'mount', model: 'troop_buggy', position: was[0]!.position });
    const match = new Match(r.map, { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 });
    match.addHuman('me');
    for (let i = 0; i < TICK_RATE * 3; i++) match.step();
    const buggy = mountsOf(match).find((m) => Math.hypot(m.pos.x - was[0]!.position[0]!, m.pos.z - was[0]!.position[2]!) < 3 && m.def.id === 'troop_buggy');
    expect(buggy?.alive).toBe(true);
  });

  it('no shipped map names a retired vehicle any more (replaced in MapMaker)', () => {
    const naming: string[] = [];
    for (const f of readdirSync(MAPS).filter((n) => n.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(new URL(f, MAPS), 'utf8')) as { entities?: { kind: string; model?: string }[]; paths?: { race?: { vehicle?: string; ambientVehicle?: string } }[]; track?: { vehicle?: string; ambientVehicle?: string } };
      const ids = [
        ...(doc.entities ?? []).filter((e) => e.kind === 'mount').map((e) => e.model),
        ...(doc.paths ?? []).flatMap((p) => [p.race?.vehicle, p.race?.ambientVehicle]),
        doc.track?.vehicle,
        doc.track?.ambientVehicle,
      ];
      if (ids.some(isRetiredMount)) naming.push(f);
    }
    expect(naming).toEqual([]);
  });
});
