import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAP_FORMAT_VERSION,
  MapDocument,
  Track,
  TrackGeometry,
  ambientCarEntities,
  buildMapGeometry,
  loadMap,
  migrateMapDocument,
  pathGeometry,
  racePath,
  racePathFromTrack,
  raceGridEntities,
  raceTrack,
  trackGeometry,
  validateMap,
  withTrackVehicles,
  type MapPath,
} from '../src/index.ts';
import { makeMap } from './helpers.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const raw = (id: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'));
const loaded = (doc: unknown): MapDocument => {
  const r = loadMap(doc);
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('; '));
  return r.map;
};

/** A v22 document: a race track of its own and one road path. */
function v22(): Record<string, unknown> {
  const doc = JSON.parse(JSON.stringify(makeMap([], [[0, 0, 0]])));
  return {
    ...doc,
    formatVersion: 22,
    track: { points: [[0, 0, -40], [50, 0, 0], [0, 0, 40], [-50, 0, 0]], width: 10, surface: 'dirt', ambient: 2 },
    paths: [{ id: 'race_track', style: 'cobble', width: 4, points: [[0, 0, 0], [10, 0, 0], [10, 0, 10]], loop: true, lay: true }],
  };
}

describe('one path primitive: migration (v22 -> v23)', () => {
  it('turns the race track into the first path (road + race, classic curve, not laid) and keeps every road', () => {
    const { doc, fromVersion } = migrateMapDocument(v22());
    expect(fromVersion).toBe(22);
    expect(doc.formatVersion).toBe(MAP_FORMAT_VERSION);
    expect(doc.track).toBeUndefined();
    const paths = doc.paths as Record<string, unknown>[];
    expect(paths).toHaveLength(2);
    // The track's id doesn't clash with an existing path's.
    expect(paths[0]).toMatchObject({ id: 'race_track_2', closed: true, uses: ['road', 'race'], width: 10, style: 'dirt', lay: false, curve: 'classic' });
    // v22 defaults filled in: laps 3, grid 8, kart, curbs; the settings the track had kept.
    expect(paths[0]!.race).toEqual({ laps: 3, grid: 8, vehicle: 'kart', combat: false, curbs: true, ambient: 2, ambientVehicle: 'kart', pit: null });
    expect(paths[1]).toEqual({ id: 'race_track', style: 'cobble', width: 4, points: [[0, 0, 0], [10, 0, 0], [10, 0, 10]], closed: true, uses: ['road'], lay: true });
    const map = MapDocument.parse(doc);
    expect(racePath(map)!.id).toBe('race_track_2');
    expect(raceTrack(map)).toMatchObject({ loop: true, width: 10, surface: 'dirt', ambient: 2, laps: 3 });
  });

  it('a map without a track or paths gains nothing; an open path stays open', () => {
    const { track: _t, paths: _p, ...plain } = v22();
    expect(migrateMapDocument(plain).doc.paths).toBeUndefined();
    const open = { ...plain, paths: [{ id: 'p1', style: 'dirt', width: 3, points: [[0, 0, 0], [5, 0, 0]], loop: false, lay: true }] };
    expect((migrateMapDocument(open).doc.paths as MapPath[])[0]).toMatchObject({ closed: false, uses: ['road'] });
    expect(migrateMapDocument({ ...plain, track: null }).doc).not.toHaveProperty('track');
  });

  // Every shipped map with a race track races and draws exactly as before: the same curve, checkpoints, grid,
  // ambient cars and pit, and the same ground (the track was never laid in on load and had no ground of its own).
  const tracked = readdirSync(MAPS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => raw(id).track);
  it('finds the shipped race maps', () => expect(tracked.length).toBeGreaterThanOrEqual(5));
  for (const id of tracked) {
    it(`${id}: races exactly as before`, () => {
      const file = raw(id);
      const before = new TrackGeometry(Track.parse(file.track));
      const map = loaded(file);
      const after = trackGeometry(map)!;
      expect(after.track).toEqual(before.track);
      expect(after.samples).toEqual(before.samples);
      expect(after.gates).toEqual(before.gates);
      expect(after.length).toBe(before.length);
      expect(after.grid()).toEqual(before.grid());
      expect(raceGridEntities(map).map((e) => [e.position, e.yaw])).toEqual(before.grid().map((p) => [[p.x, p.y, p.z], p.yaw]));
      const cars = ambientCarEntities(map);
      expect(cars).toHaveLength(before.track.ambient);
      if (before.track.pit) expect(cars[0]!.pit).toEqual(before.track.pit);
      // The ground: the terrain untouched, the terrain-less maps' ground slab where it always was.
      const { track: _t, ...noTrack } = file;
      const meta = file.metadata as MapDocument['metadata'];
      const plain = loaded({ ...noTrack, metadata: { ...meta, supportedModes: meta.supportedModes.filter((m) => m !== 'core.race') } });
      expect(map.terrain?.heights ?? null).toEqual(plain.terrain?.heights ?? null);
      const ground = (m: MapDocument) => buildMapGeometry(m).filter((b) => b.sourceId === 'ground');
      expect(ground(map)).toEqual(ground(plain));
      expect(withTrackVehicles(map, { mode: 'core.race' }).entities.length).toBe(map.entities.length + before.grid().length + before.track.ambient);
      expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    });
  }
});

/** A smooth closed path through a lopsided loop of points (uneven spacing, one sharp corner). */
function loop(o: Partial<MapPath> = {}): MapPath {
  return { id: 'loop', points: [[0, 0, 0], [40, 0, 0], [44, 0, 6], [40, 0, 30], [0, 0, 34], [-10, 0, 15]], closed: true, uses: ['road', 'race'], width: 10, style: 'asphalt', lay: false, ...o };
}

describe('closed paths (join ends)', () => {
  it('the curve wraps smoothly at the join: no gap, no kink where the last point meets the first', () => {
    for (const curve of ['smooth', 'classic'] as const) {
      const g = pathGeometry(loop({ curve }));
      expect(g.loop).toBe(true);
      const first = g.samples[0]!;
      const last = g.samples[g.samples.length - 1]!;
      // The first sample is the first point; the join is one sample step long, like every other.
      expect(Math.hypot(first.x, first.z)).toBeLessThan(1e-6);
      const steps = g.samples.slice(1).map((q, i) => Math.hypot(q.x - g.samples[i]!.x, q.z - g.samples[i]!.z));
      const join = Math.hypot(first.x - last.x, first.z - last.z);
      expect(join).toBeGreaterThan(0.2);
      expect(join).toBeLessThanOrEqual(Math.max(...steps) + 1e-6);
      // The heading turns no more across the join than the curve turns between other samples there.
      const turn = (a: { dx: number; dz: number }, b: { dx: number; dz: number }) => Math.acos(Math.max(-1, Math.min(1, a.dx * b.dx + a.dz * b.dz)));
      const around = Math.max(turn(g.samples[1]!, first), turn(last, g.samples[g.samples.length - 2]!));
      expect(turn(last, first)).toBeLessThan(around * 2 + 0.05);
      // Going on past the end comes round to the start.
      expect(g.at(g.length + 5).s).toBeCloseTo(5, 6);
    }
  });

  it('an open path has ends: it stops at its last point', () => {
    const g = pathGeometry(loop({ closed: false }));
    expect(g.loop).toBe(false);
    const last = g.samples[g.samples.length - 1]!;
    expect([last.x, last.z]).toEqual([-10, 15]);
    expect(g.at(g.length + 50).s).toBe(g.length);
  });

  it('checkpoints run round a loop in point order, from the start line at the first point; reversing reverses them', () => {
    const map = (p: MapPath): MapDocument => ({ ...makeMap([]), paths: [p] });
    const g = trackGeometry(map(loop()))!;
    expect(g.gates[0]!.s).toBe(0);
    expect(Math.hypot(g.gates[0]!.x, g.gates[0]!.z)).toBeLessThan(1e-6);
    // Gates are in order along the path and spread round the whole lap.
    for (let i = 1; i < g.gates.length; i++) expect(g.gates[i]!.s).toBeGreaterThan(g.gates[i - 1]!.s);
    expect(g.gates[g.gates.length - 1]!.s).toBeGreaterThan(g.length * 0.6);
    // Each gate faces the way the points go: the next point along is ahead of the first gate.
    expect(g.gateSide(g.gates[0]!, 40, 0).along).toBeGreaterThan(0);
    // Reversed (the start point kept), the race runs the other way round.
    const p = loop();
    const back = trackGeometry(map({ ...p, points: [p.points[0]!, ...p.points.slice(1).reverse()] }))!;
    expect(back.gateSide(back.gates[0]!, 40, 0).along).toBeLessThan(0);
    expect(back.gateSide(back.gates[0]!, -10, 15).along).toBeGreaterThan(0);
  });

  it('an open race path is point to point: a start line clear of the grid and a finish at the end', () => {
    const g = trackGeometry({ paths: [loop({ closed: false })] })!;
    expect(g.loop).toBe(false);
    expect(g.start).toBeGreaterThan(0);
    expect(g.gates[g.gates.length - 1]!.s).toBeCloseTo(g.length - 2, 6);
  });

  it('only the first race path is the race track; a path that is not a race is not', () => {
    const road = loop({ id: 'road', uses: ['road'] });
    const race = loop({ id: 'race', uses: ['race'] });
    expect(racePath({ paths: [road] })).toBeNull();
    expect(racePath({ paths: [road, race, { ...race, id: 'race2' }] })!.id).toBe('race');
    const issues = validateMap({ ...makeMap([]), paths: [road, race, { ...race, id: 'race2' }] }).map((i) => i.code);
    expect(issues).toContain('track.many');
    expect(racePathFromTrack(Track.parse({ points: [[0, 0, 0], [9, 0, 0]] }))).toMatchObject({ closed: true, uses: ['road', 'race'], curve: 'classic', lay: false });
  });
});
