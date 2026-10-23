import { coreCatalog, type TileCatalog } from './catalog.ts';
import { SURFACE_SLOTS, coreMaterials, coreThemes } from './materials.ts';
import { getItem } from '../sim/items.ts';
import { getProp } from '../content/props.ts';
import { buildOccupancy, cellHasFloor, cellKey } from './geometry.ts';
import { terrainHeightAt } from './terrain.ts';
import { migrateMapDocument, MapMigrationError } from './migrate.ts';
import { MapDocument } from './schema.ts';
import { validateScenario } from './validateScenario.ts';

export type IssueSeverity = 'error' | 'warning' | 'suggestion';

/** A creator-facing validation result. `targetId` lets the editor focus the offending object. */
export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  targetId?: string;
}

export type LoadResult =
  | { ok: true; map: MapDocument; issues: ValidationIssue[]; migratedFrom: number }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Parse untrusted map JSON: migrate, schema-validate, then run semantic checks.
 * `ok` is false only when the map cannot be used at all (errors); warnings and
 * suggestions ride along with a usable map.
 */
export function loadMap(json: string | unknown, catalog: TileCatalog = coreCatalog): LoadResult {
  let raw: unknown = json;
  if (typeof json === 'string') {
    try {
      raw = JSON.parse(json);
    } catch (e) {
      return { ok: false, issues: [{ severity: 'error', code: 'json.parse', message: `invalid JSON: ${(e as Error).message}` }] };
    }
  }
  let migrated;
  try {
    migrated = migrateMapDocument(raw);
  } catch (e) {
    if (e instanceof MapMigrationError) return { ok: false, issues: [{ severity: 'error', code: 'format.version', message: e.message }] };
    throw e;
  }
  const parsed = MapDocument.safeParse(migrated.doc);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ severity: 'error', code: 'schema', message: `${i.path.join('.') || '(root)'}: ${i.message}` })),
    };
  }
  const issues = validateMap(parsed.data, catalog);
  if (issues.some((i) => i.severity === 'error')) return { ok: false, issues };
  return { ok: true, map: parsed.data, issues, migratedFrom: migrated.fromVersion };
}

/** Semantic validation of a schema-valid map. Navigation reachability lives in nav/ (needs Recast). */
export function validateMap(map: MapDocument, catalog: TileCatalog = coreCatalog): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const seen = new Set<string>();
  for (const item of [...map.classicStructure.tiles, ...map.entities]) {
    if (seen.has(item.id)) issues.push({ severity: 'error', code: 'id.duplicate', message: `duplicate ID "${item.id}"`, targetId: item.id });
    seen.add(item.id);
  }

  if (map.bounds) {
    const { min, max } = map.bounds;
    for (const e of map.entities) {
      const [x, , z] = e.position;
      if (x < min[0] || x > max[0] || z < min[1] || z > max[1]) {
        issues.push({ severity: e.kind === 'spawn' ? 'error' : 'warning', code: 'bounds.outside', message: `${e.kind} ${e.id} is outside the map boundary`, targetId: e.id });
      }
    }
  }

  const { cells, overlaps, unknownTiles } = buildOccupancy(map, catalog);
  for (const t of unknownTiles) {
    issues.push({ severity: 'error', code: 'tile.unknown', message: `unknown tile "${t.tile}"`, targetId: t.id });
  }
  for (const o of overlaps) {
    issues.push({ severity: 'error', code: 'tile.overlap', message: `tiles ${o.ids[0]} and ${o.ids[1]} overlap at cell ${o.key}`, targetId: o.ids[1] });
  }
  if (!coreThemes.get(map.classicStructure.theme)) {
    issues.push({ severity: 'error', code: 'theme.unknown', message: `unknown theme "${map.classicStructure.theme}"` });
  }
  for (const t of map.classicStructure.tiles) {
    for (const slot of SURFACE_SLOTS) {
      const style = t.surfaces?.[slot];
      if (style && !coreMaterials.get(style.material)) {
        issues.push({ severity: 'error', code: 'material.unknown', message: `tile ${t.id} uses unknown material "${style.material}"`, targetId: t.id });
      }
    }
  }
  if (map.classicStructure.tiles.length === 0 && !map.terrain) {
    issues.push({ severity: 'error', code: 'tile.none', message: 'map has no structural tiles' });
  }

  const spawns = map.entities.filter((e) => e.kind === 'spawn');
  if (spawns.length === 0) {
    issues.push({ severity: 'error', code: 'spawn.none', message: 'map has no spawn points' });
  } else if (spawns.length < map.metadata.recommendedPlayers.max) {
    issues.push({
      severity: 'warning',
      code: 'spawn.few',
      message: `${spawns.length} spawn points for up to ${map.metadata.recommendedPlayers.max} players; spawns will be shared`,
    });
  }

  const { cellSize, levelHeight } = map.classicStructure;
  for (const s of spawns) {
    const [x, y, z] = s.position;
    const gx = Math.round(x / cellSize);
    const gy = Math.round(z / cellSize);
    const gz = Math.floor((y + 0.01) / levelHeight);
    const occ = cells.get(cellKey(gx, gy, gz));
    const ground = map.terrain ? terrainHeightAt(map.terrain, x, z) : null;
    const onTerrain = ground !== null && Math.abs(ground - y) < 1.5;
    if (!onTerrain && (!occ || !cellHasFloor(occ))) {
      issues.push({ severity: 'warning', code: 'spawn.no_floor', message: `spawn ${s.id} is not above a tile floor`, targetId: s.id });
    }
  }

  const pickups = map.entities.filter((e) => e.kind === 'pickup');
  for (const p of pickups) {
    if (!getItem(p.item)) issues.push({ severity: 'error', code: 'pickup.unknown', message: `pickup ${p.id} uses unknown item "${p.item}"`, targetId: p.id });
  }
  if (!pickups.some((p) => getItem(p.item)?.effect.kind === 'health')) {
    issues.push({ severity: 'suggestion', code: 'pickup.no_health', message: 'no health pickups: fights will snowball' });
  }

  for (const e of map.entities) {
    if (e.kind === 'prop' && !getProp(e.model)) issues.push({ severity: 'error', code: 'prop.unknown', message: `prop ${e.id} uses unknown model "${e.model}"`, targetId: e.id });
  }

  issues.push(...validateScenario(map));

  const { min, max } = map.metadata.recommendedPlayers;
  if (min > max) issues.push({ severity: 'error', code: 'meta.players', message: `recommended players min ${min} > max ${max}` });

  return issues;
}

/** Serialise with stable key order and trailing newline so map files diff cleanly. */
export function serializeMap(map: MapDocument): string {
  return `${JSON.stringify(map, null, 2)}\n`;
}
