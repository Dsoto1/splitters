import { LEGACY_MAP_FORMAT, MAP_FORMAT, MAP_FORMAT_VERSION } from './schema.ts';

/** Upgrades a raw document from `from` to `from + 1`. Must not mutate its input. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registered migrations keyed by the version they upgrade *from*. Every format
 * change adds an entry here plus a test fixture of the old version.
 */
export const MIGRATIONS: ReadonlyMap<number, Migration> = new Map<number, Migration>([
  // v1 -> v2: tiles gained optional per-surface styles. Absent means "theme default", so v1 data is already valid.
  [1, (doc) => ({ ...doc })],
  // v2 -> v3: new `pickup` entity kind. Existing entities are unchanged.
  [2, (doc) => ({ ...doc })],
  // v3 -> v4: scenario entities (door, button, destructible, zone, trap) and the `logic` block, which defaults to empty.
  [3, (doc) => ({ ...doc })],
  // v4 -> v5: `encounter` entities and the `factions` list (defaults to empty = the built-in enemy faction).
  [4, (doc) => ({ ...doc })],
  // v5 -> v6: per-side tile edges, the trim surface slot and `prop` entities, all optional.
  [5, (doc) => ({ ...doc })],
  // v6 -> v7: optional outdoor `terrain` (absent = none).
  [6, (doc) => ({ ...doc })],
  // v7 -> v8: optional map `bounds` and `teamSetup` (absent = none).
  [7, (doc) => ({ ...doc })],
  // v8 -> v9: optional `backdrop` (absent = the theme's) and terrain `foliage` (absent = from each cell's material).
  [8, (doc) => ({ ...doc })],
  // v9 -> v10: optional `blood` settings (absent = dark red, light).
  [9, (doc) => ({ ...doc })],
  // v10 -> v11: `flag` (Capture the Flag bases) and `hill` (King of the Hill) entity kinds. Existing entities are unchanged.
  [10, (doc) => ({ ...doc })],
  // v11 -> v12: `ladder` entity kind. Existing entities are unchanged.
  [11, (doc) => ({ ...doc })],
  // v12 -> v13: `bombsite` entity kind (Bomb mode). Existing entities are unchanged.
  [12, (doc) => ({ ...doc })],
  // v13 -> v14: `hostage` and `rescue` entity kinds (Hostage mode). Existing entities are unchanged.
  [13, (doc) => ({ ...doc })],
  // v14 -> v15: `light` entity kind (lights and their fixtures). Existing entities are unchanged.
  [14, (doc) => ({ ...doc })],
  // v15 -> v16: optional room `options` on tiles (layout, floor, ceiling, corners) and three wall styles (broken, bars, shutter).
  [15, (doc) => ({ ...doc })],
  // v16 -> v17: zombies in encounter rosters (optional).
  [16, (doc) => ({ ...doc })],
  // v17 -> v18: optional race `track` (absent = none).
  [17, (doc) => ({ ...doc })],
  // v18 -> v19: `airplane` entity kind (transport plane, air drop) and an optional `skin` on mounts (absent = automatic).
  [18, (doc) => ({ ...doc })],
  // v19 -> v20: `mover` entity kind; optional light `off`/`blink`, block `pitch`/`roll`/`startHidden`, liquid `tint`,
  // and `team` on buttons, doors and zones; new logic actions and conditions. All additive: v19 data is valid as is.
  [19, (doc) => ({ ...doc })],
  // v20 -> v21: optional `onWater` on mounts (vehicles that float). Absent = sinks, as before: v20 data is valid as is.
  [20, (doc) => ({ ...doc })],
  // v21 -> v22: optional `metadata.thumbnail` (the map's picture) and `metadata.thumbnailCamera`. Additive.
  [21, (doc) => ({ ...doc })],
  // v22 -> v23: one path primitive. Paths gain `closed` (was `loop`) and `uses`; the race `track` becomes a race path.
  [22, migratePathsV23],
  // v23 -> v24: optional `random` (a weapon category) and `keepFixed` on pickups. Absent = the item as placed: additive.
  [23, (doc) => ({ ...doc })],
]);

/** The race track's own settings as they were in v22 (missing = the v22 defaults). */
const V22_TRACK_DEFAULTS: Record<string, unknown> = { width: 12, loop: true, laps: 3, grid: 8, vehicle: 'kart', combat: false, surface: 'asphalt', curbs: true, ambient: 0, ambientVehicle: 'kart', pit: null };

/**
 * v22 -> v23: every path is one kind of thing (schema.ts MapPath).
 * - A v22 path (a road: id, style, width, points, loop, lay) keeps all that, `loop` renamed `closed`, used as a road.
 * - The v22 `track` becomes the first path, used as a road and a race, with the classic curve the track always
 *   had and `lay: false` (the race road was drawn over the ground as authored, never laid in on load), so it is
 *   raced and drawn exactly as before. Its surface (asphalt or dirt) is the road's style.
 * - NPC squads had no routes before v23 (patrol walked to a target entity and back, which stays as it is).
 */
export function migratePathsV23(doc: Record<string, unknown>): Record<string, unknown> {
  const { track, ...rest } = doc;
  const old = Array.isArray(doc.paths) ? (doc.paths as Record<string, unknown>[]) : [];
  const paths: Record<string, unknown>[] = old.map((p) => {
    const { loop, ...keep } = p;
    return { ...keep, closed: loop === true, uses: ['road'] };
  });
  if (track && typeof track === 'object') {
    const t = { ...V22_TRACK_DEFAULTS, ...(track as Record<string, unknown>) };
    const ids = new Set(paths.map((p) => p.id));
    let id = 'race_track';
    for (let n = 2; ids.has(id); n++) id = `race_track_${n}`;
    paths.unshift({
      id,
      points: t.points,
      closed: t.loop,
      uses: ['road', 'race'],
      width: t.width,
      style: t.surface === 'dirt' ? 'dirt' : 'asphalt',
      lay: false,
      curve: 'classic',
      race: { laps: t.laps, grid: t.grid, vehicle: t.vehicle, combat: t.combat, curbs: t.curbs, ambient: t.ambient, ambientVehicle: t.ambientVehicle, pit: t.pit },
    });
  }
  return paths.length ? { ...rest, paths } : (({ paths: _none, ...r }) => r)(rest);
}

export class MapMigrationError extends Error {}

/**
 * Bring a raw (already JSON-parsed, not yet schema-validated) document up to
 * the current format version. Never mutates the input, so the caller still
 * holds the original if a migration fails.
 */
export function migrateMapDocument(
  raw: unknown,
  migrations: ReadonlyMap<number, Migration> = MIGRATIONS,
  targetVersion: number = MAP_FORMAT_VERSION,
): { doc: Record<string, unknown>; fromVersion: number } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new MapMigrationError('map document must be a JSON object');
  const obj = raw as Record<string, unknown>;
  // Maps saved before the game was renamed from ChronoSplit carry the old format name.
  if (obj.format !== MAP_FORMAT && obj.format !== LEGACY_MAP_FORMAT) throw new MapMigrationError(`not a Tile Trigger map (format=${String(obj.format)})`);
  const fromVersion = obj.formatVersion;
  if (typeof fromVersion !== 'number' || !Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new MapMigrationError(`invalid formatVersion ${String(fromVersion)}`);
  }
  if (fromVersion > targetVersion) {
    throw new MapMigrationError(`map format v${fromVersion} is newer than this game supports (v${targetVersion})`);
  }
  let doc: Record<string, unknown> = { ...structuredClone(obj), format: MAP_FORMAT };
  for (let v = fromVersion; v < targetVersion; v++) {
    const step = migrations.get(v);
    if (!step) throw new MapMigrationError(`no migration from map format v${v}`);
    doc = { ...step(doc), formatVersion: v + 1 };
  }
  return { doc, fromVersion };
}
