import { coreCatalog, type TileCatalog } from './catalog.ts';
import { SURFACE_SLOTS, coreMaterials, coreThemes } from './materials.ts';
import { getItem } from '../sim/items.ts';
import { getProp } from '../content/props.ts';
import { buildOccupancy, cellHasFloor, cellKey, yawXZ } from './geometry.ts';
import { terrainHeightAt } from './terrain.ts';
import { floatingProps } from './settle.ts';
import { migrateMapDocument, MapMigrationError } from './migrate.ts';
import { MapDocument, type MapEntity } from './schema.ts';
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
  const blocks = map.entities.filter((e) => e.kind === 'block');
  for (const b of blocks) {
    if (b.kind === 'block' && b.material && !coreMaterials.get(b.material)) issues.push({ severity: 'error', code: 'material.unknown', message: `block ${b.id} uses unknown material "${b.material}"`, targetId: b.id });
  }
  if (map.classicStructure.tiles.length === 0 && !map.terrain && blocks.length === 0) {
    issues.push({ severity: 'error', code: 'tile.none', message: 'map has no structural tiles' });
  }

  issues.push(...budgetIssues(map));
  const floating = floatingProps(map);
  if (floating.length) {
    const worst = floating.reduce((a, b) => (b.gap > a.gap ? b : a));
    issues.push({
      severity: 'warning',
      code: 'prop.floating',
      message: `${floating.length} prop${floating.length > 1 ? 's float' : ' floats'} above the ground (worst: ${worst.id}, ${worst.gap} m); MapMaker's "Settle on ground" beds them in`,
      targetId: worst.id,
    });
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
    // Standing on a free block (its top within reach of the spawn's feet).
    const onBlock = blocks.some((b) => b.kind === 'block' && Math.abs(b.position[1] + b.size[1] - y) < 1 && pointOnBlock(b, x, z));
    if (!onTerrain && !onBlock && (!occ || !cellHasFloor(occ))) {
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

/** Whether (x, z) is over a block's (turned) footprint. */
function pointOnBlock(b: Extract<MapEntity, { kind: 'block' }>, x: number, z: number): boolean {
  const [lx, lz] = yawXZ(x - b.position[0], z - b.position[2], -b.yaw);
  return Math.abs(lx) <= b.size[0] / 2 && Math.abs(lz) <= b.size[2] / 2;
}

/**
 * Soft limits that keep a map smooth in a browser on an ordinary laptop
 * (see docs/MAP_BUDGETS.md). Going over is allowed but warned about.
 */
export const MAP_BUDGETS = {
  /** Playable footprint across (m). */
  footprint: 400,
  tiles: 1500,
  props: 1500,
  /** Different prop models (each is a download and a set of draw calls). */
  propModels: 80,
  blocks: 600,
  /** Breakable, crumbling and trapdoor blocks (each is simulated and sent to players). */
  dynamicBlocks: 150,
  liquids: 32,
  /** Gameplay pieces that think every tick: doors, traps, zones, squads, mounts, pads. */
  active: 300,
} as const;

function budgetIssues(map: MapDocument): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const over = (code: string, n: number, max: number, what: string) => {
    if (n > max) out.push({ severity: 'warning', code: `budget.${code}`, message: `${n} ${what} (budget ${max}): the map may run slowly on ordinary laptops` });
  };
  const e = map.entities;
  const props = e.filter((x) => x.kind === 'prop');
  over('tiles', map.classicStructure.tiles.length, MAP_BUDGETS.tiles, 'tiles');
  over('props', props.length, MAP_BUDGETS.props, 'props');
  over('prop_models', new Set(props.map((x) => x.model)).size, MAP_BUDGETS.propModels, 'different prop models');
  over('blocks', e.filter((x) => x.kind === 'block').length, MAP_BUDGETS.blocks, 'blocks');
  over('dynamic_blocks', e.filter((x) => x.kind === 'block' && x.behaviour !== 'solid').length, MAP_BUDGETS.dynamicBlocks, 'breakable, crumbling or trapdoor blocks');
  over('liquids', e.filter((x) => x.kind === 'water').length, MAP_BUDGETS.liquids, 'bodies of water, lava, acid or swamp');
  over('active', e.filter((x) => ['door', 'trap', 'zone', 'encounter', 'mount', 'pad', 'button'].includes(x.kind)).length, MAP_BUDGETS.active, 'doors, traps, zones, squads, vehicles, pads and buttons');
  const xs = e.map((x) => x.position[0]);
  const zs = e.map((x) => x.position[2]);
  const span = xs.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) : 0;
  over('footprint', Math.round(span), MAP_BUDGETS.footprint, 'm across');
  return out;
}
