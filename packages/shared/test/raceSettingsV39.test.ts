import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEAD_RACE_KEYS, MIGRATIONS, dropRaceSettingsV39 } from '../src/map/migrate.ts';
import { DEFAULT_RACE, MAP_FORMAT_VERSION, MapDocument, releaseCurrent, stampMapRelease, ambientCarEntities, loadMap, migrateMapDocument, racePath, trackGeometry } from '../src/index.ts';
import { makeMap } from './helpers.ts';

// Race mode was removed on 2026-11-08; its track settings (laps, start grid, race vehicle, combat) stayed in map files,
// read by nothing, until format v39 (docs/GAME_MODES.md, "Tracks and NPC traffic").
const MAPS = new URL('../../../maps/', import.meta.url);
const shipped = readdirSync(MAPS).filter((f) => f.endsWith('.json'));
const raw = (f: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(f, MAPS), 'utf8'));
const dead = (race: unknown): string[] => (race && typeof race === 'object' ? Object.keys(race).filter((k) => (DEAD_RACE_KEYS as readonly string[]).includes(k)) : []);

/** A v38 map with a track (every race setting written out, as MapMaker wrote them) and a plain road. */
function v38(): Record<string, unknown> {
  const doc = JSON.parse(JSON.stringify(makeMap([], [[0, 0, 0]]))) as Record<string, unknown>;
  const points = [[0, 0, 0], [40, 0, 0], [40, 0, 40], [0, 0, 40]];
  return {
    ...doc,
    formatVersion: 38,
    paths: [
      { id: 'race_track', points, closed: true, uses: ['road', 'race'], width: 12, style: 'asphalt', lay: true, race: { laps: 3, grid: 14, vehicle: 'speeder', combat: true, curbs: false, ambient: 2, ambientVehicle: 'speeder', pit: [-32, 12, 30] } },
      { id: 'lane', points: [[0, 0, 0], [5, 0, 0]], closed: false, uses: ['road'], width: 3, style: 'dirt', lay: true },
    ],
  };
}

describe('map format v39: race mode\'s dead track settings dropped', () => {
  it('the v38 -> v39 migration drops laps, grid, vehicle and combat and keeps the rest of the track', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(39);
    expect(MIGRATIONS.get(38)).toBe(dropRaceSettingsV39);
    const before = v38();
    const copy = JSON.parse(JSON.stringify(before));
    const { doc, fromVersion } = migrateMapDocument(before);
    expect(fromVersion).toBe(38);
    expect(before).toEqual(copy);
    const paths = doc.paths as Record<string, unknown>[];
    expect(paths[0]!.race).toEqual({ curbs: false, ambient: 2, ambientVehicle: 'speeder', pit: [-32, 12, 30] });
    expect(paths[1]).toEqual(copy.paths[1]);
    // Everything else as it was.
    expect({ ...doc, paths: undefined, formatVersion: undefined }).toEqual({ ...copy, paths: undefined, formatVersion: undefined });
    expect(dropRaceSettingsV39({ a: 1 })).toEqual({ a: 1 });
    expect(dropRaceSettingsV39({ paths: [{ id: 'p', race: null }] })).toEqual({ paths: [{ id: 'p', race: null }] });
  });

  it('a file that still names them (any version) loads without them, and saving writes none', () => {
    // A shipped map with a track, at v39, its track given every old setting again.
    const file = raw('sandsweep.json') as { paths: { race?: object }[] };
    const again = { ...file, formatVersion: 39, paths: file.paths.map((p) => (p.race ? { ...p, race: { laps: 5, grid: 2, vehicle: 'kart', combat: true, ...p.race } } : p)) };
    const r = loadMap(JSON.stringify(again));
    expect(r.ok ? [] : r.issues.map((i) => i.message)).toEqual([]);
    if (!r.ok) return;
    expect(dead(racePath(r.map)!.race)).toEqual([]);
    expect(dead(JSON.parse(JSON.stringify(MapDocument.parse(r.map))).paths[0].race)).toEqual([]);
    // MapMaker's new track (the Paths tool writes DEFAULT_RACE) names none either.
    expect(dead(DEFAULT_RACE)).toEqual([]);
  });

  it('every shipped map loads as before apart from the dropped settings: the same track, cars and pit', () => {
    let tracks = 0;
    for (const f of shipped) {
      const file = raw(f);
      const r = loadMap(JSON.stringify(file));
      expect(r.ok, f).toBe(true);
      if (!r.ok) continue;
      const paths = (file.paths ?? []) as { id: string; race?: Record<string, unknown> }[];
      for (const p of paths) {
        const got = r.map.paths!.find((q) => q.id === p.id)!;
        expect(dead(got.race), `${f} ${p.id}`).toEqual([]);
        if (!p.race) continue;
        // The settings still used, exactly as the file has them.
        const kept = Object.fromEntries(Object.entries(p.race).filter(([k]) => !(DEAD_RACE_KEYS as readonly string[]).includes(k)));
        expect(got.race, `${f} ${p.id}`).toEqual(kept);
      }
      if (!racePath(r.map)) continue;
      tracks++;
      // The same map with the dead settings taken out by hand plays the same track and NPC cars.
      const by = { ...file, paths: paths.map((p) => (p.race ? { ...p, race: Object.fromEntries(Object.entries(p.race).filter(([k]) => !dead({ [k]: 1 }).length)) } : p)) };
      const h = loadMap(JSON.stringify(by));
      expect(h.ok).toBe(true);
      if (!h.ok) continue;
      const [a, b] = [trackGeometry(r.map)!, trackGeometry(h.map)!];
      expect([a.start, a.length, a.gates]).toEqual([b.start, b.length, b.gates]);
      expect(ambientCarEntities(r.map)).toEqual(ambientCarEntities(h.map));
    }
    expect(tracks).toBeGreaterThanOrEqual(5);
  });

  it('a map stamped before v39 keeps its version: the dropped settings were all that changed', () => {
    let stamped = 0;
    for (const f of shipped) {
      const file = raw(f) as { metadata: { release?: { versionId: string; revision: number; schemaVersion: number } }; paths?: { race?: object }[] };
      if (!file.metadata.release || !file.paths?.some((p) => p.race)) continue;
      stamped++;
      for (const forEditing of [false, true]) {
        const r = loadMap(JSON.stringify(file), undefined, { forEditing });
        expect(r.ok && r.issues.filter((i) => i.code === 'release.changed'), f).toEqual([]);
        if (!r.ok) continue;
        // (As played the map is expanded, so only the map as made hashes to its stamp.)
        if (forEditing) expect(releaseCurrent(r.map), f).toBe(true);
        // (A stamp from v39 on needed no carrying: it keeps its own format; one from before is carried to today's. So is
        // one from before v45 on a map with terrain: v45 stores the same ground as base and painted cells.)
        const v = file.metadata.release.schemaVersion;
        // (And one from v50 on a map with categories: v51 keeps one category in place of the pairs.)
        const schemaVersion = v < 39 || (v < 45 && (file as { terrain?: unknown }).terrain) || (v === 50 && (file.metadata as { categories?: unknown }).categories) ? MAP_FORMAT_VERSION : v;
        expect(r.map.metadata.release).toMatchObject({ versionId: file.metadata.release.versionId, revision: file.metadata.release.revision, schemaVersion });
        // Exporting again keeps the version.
        if (forEditing) expect(stampMapRelease(r.map).metadata.release!.versionId).toBe(file.metadata.release.versionId);
      }
    }
    expect(stamped).toBeGreaterThanOrEqual(1);
    // A track edited since (its NPC cars) is changed: the stamp is not carried.
    const file = raw('neon_spire.json') as { metadata: { release?: object }; paths: { race?: { ambient?: number } }[] };
    if (!file.metadata.release) return;
    const edited = { ...file, paths: file.paths.map((p) => (p.race ? { ...p, race: { ...p.race, ambient: (p.race.ambient ?? 0) + 1 } } : p)) };
    const e = loadMap(JSON.stringify(edited));
    expect(e.ok && e.issues.map((i) => i.code)).toContain('release.changed');
  });
});

