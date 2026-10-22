import { MAP_FORMAT, MAP_FORMAT_VERSION } from './schema.ts';

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
]);

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
  if (obj.format !== MAP_FORMAT) throw new MapMigrationError(`not a ChronoSplit map (format=${String(obj.format)})`);
  const fromVersion = obj.formatVersion;
  if (typeof fromVersion !== 'number' || !Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new MapMigrationError(`invalid formatVersion ${String(fromVersion)}`);
  }
  if (fromVersion > targetVersion) {
    throw new MapMigrationError(`map format v${fromVersion} is newer than this game supports (v${targetVersion})`);
  }
  let doc = structuredClone(obj);
  for (let v = fromVersion; v < targetVersion; v++) {
    const step = migrations.get(v);
    if (!step) throw new MapMigrationError(`no migration from map format v${v}`);
    doc = { ...step(doc), formatVersion: v + 1 };
  }
  return { doc, fromVersion };
}
