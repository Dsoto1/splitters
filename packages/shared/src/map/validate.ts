import { coreCatalog, type TileCatalog } from './catalog.ts';
import { isCastId } from '../content/botThemes.ts';
import { SURFACE_SLOTS, coreMaterials, coreThemes, groundThemes } from './materials.ts';
import { getItem } from '../sim/items.ts';
import { itemCategory } from '../sim/pickupRoll.ts';
import { WEAPON_CATEGORY_LABELS } from '../sim/weapons.ts';
import { isWeaponSetId } from '../sim/weaponSets.ts';
import { getProp } from '../content/props.ts';
import { getEnvSpecies, isEnvModel } from '../content/environment.ts';
import { MAX_BREAK_WALLS, breakWallEdges, buildOccupancy, isBuriedPassage, cellHasFloor, cellKey, cellSides, dynamicBlockIds, edgeSegments, edgeStoreys, propBoxes, resolveEdge, rotateSide, tallEdgeBlock, yawXZ, type CellOccupant, type WorldBox } from './geometry.ts';
import { mapGroundBores } from './groundBore.ts';
import { withPathsLaid } from './paths.ts';
import { EDGE_STYLE_LABELS, SIDE_DIRS } from './tileOptions.ts';
import { PLAYER } from '../sim/constants.ts';
import { DEFAULT_GROUND_THEME, isGroundMaterial, terrainHeightAt } from './terrain.ts';
import { borderRect, hasBorder } from './border.ts';
import { botHintIssues } from './botHints.ts';
import { floatingProps, terrainUnderFloors, withGroundAsPlayed } from './settle.ts';
import { carryReleaseOverCategoryPick, carryReleaseOverGroundLayers, migrateMapDocument, MapMigrationError, withOldGroundEncoding } from './migrate.ts';
import { MapDocument, type MapEntity } from './schema.ts';
import { IMPROMPTU_MIN_PLAYERS, SPAWN_SHARE } from '../sim/spawns.ts';
import { validateScenario } from './validateScenario.ts';
import { RESOURCE_BUDGETS, resourceBudgetIssues, utf8Length } from './budgets.ts';
import { carryReleaseOverRaceDrop, mapContentHash, releaseCurrent } from './identity.ts';
import { validateTrack } from './track.ts';
import { airplaneIssues } from '../sim/airplane.ts';
import { arcSentryIssues } from '../sim/mounts.ts';
import { ziplineShapeIssues } from '../sim/zipline.ts';
import { GLASS_EDGES } from '../sim/glass.ts';
import { expandSetPieces, setPieceOverlapIssues, type SetPieceLibrary } from './setPieces.ts';
import { withTileAliases } from './setPieceAliases.ts';
import { withPropAliases } from './propAliases.ts';
import { withNatureAliases } from './natureAliases.ts';
import { retiredMountIssues, withMountAliases } from './mountAliases.ts';
import { builtInSetPieces } from './setPieceLibrary.ts';
import { checkSetPieceDefinition } from './setPieceCheck.ts';

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
 *
 * As played (the default), set pieces are expanded into their parts (map/setPieces.ts) and paths laid into the
 * ground. `forEditing` (MapMaker) keeps both apart: the placements and the paths stay as they are, so the parts and
 * the ground follow them. Either way the checks see the expanded map.
 */
/**
 * `opts.forEditing`: the map as made, for MapMaker and publishing (see below). `opts.openWithErrors` (MapMaker's
 * Import and drafts): a map that reads and fits the format opens even when validation finds errors (no spawn point
 * yet, an unfinished mode): MapMaker lists them and is where they get fixed; play and publishing still refuse it.
 */
export function loadMap(json: string | unknown, catalog: TileCatalog = coreCatalog, opts: { forEditing?: boolean; openWithErrors?: boolean; library?: SetPieceLibrary } = {}): LoadResult {
  let raw: unknown = json;
  // Size first, before any parsing: a map is at most RESOURCE_BUDGETS.mapBytes of JSON wherever it comes from.
  const bytes = typeof json === 'string' ? utf8Length(json) : utf8Length(JSON.stringify(json) ?? '');
  if (bytes > RESOURCE_BUDGETS.mapBytes) {
    return { ok: false, issues: [{ severity: 'error', code: 'budget.bytes', message: `the map is ${(bytes / 1048576).toFixed(1)} MB: at most ${RESOURCE_BUDGETS.mapBytes / 1048576} MB` }] };
  }
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
  // A release stamp from before v39 whose map changed only by losing race mode's dead track settings keeps its version.
  // One from before v45 whose map changed only by v45's ground encoding (groundLayersV45) keeps its version too, and
  // one from before v39 checks its race settings with the ground put back as it was then.
  // One stamped at v50 whose map changed only by v51's one category (its tag pairs, the file's, put back) keeps its version.
  if (migrated.fromVersion === 50) parsed.data = carryReleaseOverCategoryPick(raw, parsed.data);
  if (migrated.fromVersion < 45) parsed.data = carryReleaseOverGroundLayers(parsed.data);
  if (migrated.fromVersion < 39 && !releaseCurrent(parsed.data)) {
    const asOld = withOldGroundEncoding(parsed.data) ?? parsed.data;
    const carried = carryReleaseOverRaceDrop(raw, asOld);
    const r = carried.metadata.release;
    if (carried !== asOld && r) parsed.data = { ...parsed.data, metadata: { ...parsed.data.metadata, release: { ...r, contentHash: mapContentHash(parsed.data) } } };
  }
  // A natural prop whose pack left the build (natureAliases.ts) is its generated species from here on, in MapMaker too.
  parsed.data = withNatureAliases(parsed.data);
  const library = opts.library ?? builtInSetPieces();
  // The map is checked as written (a retired tile is still a tile, and its release hash is the file's); as played a
  // retired tile plays as the set piece that replaced it (setPieceAliases.ts: the piece covers exactly its cells, so
  // nothing new can overlap), and MapMaker keeps it as made and offers Replace all.
  const issues = validateMap(parsed.data, catalog, library);
  if (issues.some((i) => i.severity === 'error') && !(opts.forEditing && opts.openWithErrors)) return { ok: false, issues };
  // MapMaker (`forEditing`) keeps the map as made: its set pieces as placements, its paths, and its own ground, which
  // it never lowers under a floor, so the parts, the laid paths and the ground kept under the floors follow a piece, a
  // path or a floor that moves (and the ground under one that goes comes back). As played: set pieces expanded into
  // their parts, on the ground as played (settle.ts withGroundAsPlayed: the paths laid in, the terrain kept under
  // every floor, the set pieces' too, and the props on the ground re-bedded on it), as MapMaker draws it.
  // A retired prop plays as the kit family that replaced it (propAliases.ts: the family has its size, so collision is
  // unchanged), set pieces' props included; MapMaker keeps it as made.
  // A retired vehicle plays as the one that replaced it (mountAliases.ts); MapMaker keeps it as made.
  const map = opts.forEditing ? parsed.data : mapAsPlayed(parsed.data, library, catalog);
  return { ok: true, map, issues, migratedFrom: migrated.fromVersion };
}

/**
 * A map as played (loadMap without `forEditing`) from the map as made: retired tiles as their set pieces, set pieces
 * expanded, retired props and vehicles as their replacements, on the ground as played. MapMaker's navigation check
 * builds from this too, so its navmesh is the Test's (sim/mapNav.ts navInputKey).
 */
export function mapAsPlayed(doc: MapDocument, library: SetPieceLibrary = builtInSetPieces(), catalog: TileCatalog = coreCatalog): MapDocument {
  return withGroundAsPlayed(withMountAliases(withPropAliases(expandSetPieces(withTileAliases(doc), library, catalog).map)), catalog);
}

/**
 * Semantic validation of a schema-valid map. Navigation reachability lives in nav/ (needs Recast). A map with set
 * pieces is checked as played: its placements expanded into their parts (whose issues name the placement), their
 * footprints against the map's tiles and each other, and the map's own set-piece definitions.
 */
export function validateMap(map: MapDocument, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): ValidationIssue[] {
  const issues = validatePieces(map, catalog, library);
  if (map.groups?.length) issues.push(...groupIssues(map));
  // Retired vehicles the map still names (mountAliases.ts): a warning each, it plays as the replacement.
  issues.push(...retiredMountIssues(map));
  // Bot hints (v33): warnings only (map/botHints.ts; the navmesh's own check is the navigation validator's).
  if (map.botHints?.length) issues.push(...botHintIssues(map));
  return issues;
}

/**
 * Buried tunnels (groundBore.ts) whose end comes out into the ground: a port of a piece with a bore that leads to
 * nothing built, with ground (as played) more than a step over its floor just outside. A Tunnel Portal on the end
 * opens the ground; a warning, since a dead end in the hill may be meant (it wants an end wall then).
 */
function buriedMouthIssues(map: MapDocument, cells: ReturnType<typeof buildOccupancy>['cells'], catalog: TileCatalog): ValidationIssue[] {
  const made = map.terrain;
  if (!made || !mapGroundBores(map, catalog).tiles.size) return [];
  const issues: ValidationIssue[] = [];
  const { cellSize, levelHeight } = map.classicStructure;
  let ground: typeof made | null = null;
  for (const [key, occ] of cells) {
    if (!occ.def.bore) continue;
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    for (const port of occ.def.ports) {
      if (port.level !== occ.level || (port.cell?.[0] ?? 0) !== occ.local[0] || (port.cell?.[1] ?? 0) !== occ.local[1]) continue;
      const side = rotateSide(port.side, occ.placement.rotation);
      const [dx, dy] = SIDE_DIRS[side];
      if (cells.has(cellKey(gx + dx, gy + dy, gz))) continue;
      // Closed by the map maker (the side's wall style in the inspector): a dead end, as meant.
      if (edgeSegments(resolveEdge(cells, gx, gy, gz, side), cellSize / 2, levelHeight).some(([u0, u1, y0, y1]) => u0 < 0 && u1 > 0 && y0 < 1 && y1 > 1)) continue;
      ground ??= terrainUnderFloors(withPathsLaid(map, mapGroundBores(map, catalog).cuts), undefined, catalog)!;
      const floor = gz * levelHeight;
      let over = -Infinity;
      for (const out of [0.4, 1.2, 2]) over = Math.max(over, (terrainHeightAt(ground, (gx + dx * 0.5) * cellSize + dx * out, (gy + dy * 0.5) * cellSize + dy * out) ?? -Infinity) - floor);
      if (over > PLAYER.maxStepHeight + 0.1 || isBuriedPassage(occ.def)) {
        issues.push({
          severity: 'warning',
          code: 'tunnel.mouth_buried',
          message: isBuriedPassage(occ.def)
            ? `the ${occ.def.displayName} at (${gx}, ${gy}, ${levelWord(gz)}) has an open end on its ${side} side: it is closed with a plain face for now; put a Tunnel Portal or a Dead End on it (Tunnel: Add portals, Close open ends)`
            : `the ${occ.def.displayName} at (${gx}, ${gy}) ends in the ground on its ${side} side (${over.toFixed(1)} m of earth over its floor): put a Tunnel Portal on that end, or close it with a wall`,
          targetId: occ.placement.id,
        });
      }
    }
  }
  return issues;
}

/**
 * Two buried pieces joined port to port with different bores (Tileset 04 step 6: a 7 m bore against a 3.6 m passage):
 * the walls don't meet, so the joint is open to the ground. A Reducer joins the two. Once for each joint.
 */
function boreProfileIssues(cells: ReturnType<typeof buildOccupancy>['cells']): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const portAt = (occ: CellOccupant, side: string) =>
    occ.def.ports.find((p) => p.level === occ.level && (p.cell?.[0] ?? 0) === occ.local[0] && (p.cell?.[1] ?? 0) === occ.local[1] && rotateSide(p.side, occ.placement.rotation) === side);
  for (const [key, occ] of cells) {
    if (!occ.def.bore) continue;
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    // (Each joint once: from its west or south piece.)
    for (const side of ['N', 'E'] as const) {
      const mine = portAt(occ, side);
      if (!mine) continue;
      const [dx, dy] = SIDE_DIRS[side];
      const next = cells.get(cellKey(gx + dx, gy + dy, gz));
      if (!next?.def.bore || next.placement.id === occ.placement.id) continue;
      const theirs = portAt(next, side === 'N' ? 'S' : 'W');
      if (!theirs || (mine.bore ?? 'S') === (theirs.bore ?? 'S')) continue;
      const wide = (mine.bore ?? 'S') === 'L' ? occ : next;
      const narrow = wide === occ ? next : occ;
      issues.push({
        severity: 'warning',
        code: 'tunnel.profile_mismatch',
        message: `the ${wide.def.displayName} (7 m bore) meets the ${narrow.def.displayName} (3.6 m passage) at (${gx}, ${gy}): the walls don't meet there. Put a Reducer between them`,
        targetId: narrow.placement.id,
      });
    }
  }
  return issues;
}

/**
 * A buried run standing as a mound on ground that would cover it a level down: a hint (the mound is a fair choice, a
 * bunker's berm; a flat surface is one Page Down away). One for the map, naming how many pieces and the first.
 */
function moundedRunIssues(map: MapDocument, cells: ReturnType<typeof buildOccupancy>['cells'], catalog: TileCatalog): ValidationIssue[] {
  const t = map.terrain;
  if (!t || !mapGroundBores(map, catalog).tiles.size) return [];
  const { cellSize, levelHeight } = map.classicStructure;
  const made = withPathsLaid(map, mapGroundBores(map, catalog).cuts).terrain ?? t;
  const mounded: string[] = [];
  for (const [key, occ] of cells) {
    const cover = occ.def.bore?.cover?.[0]?.[4];
    // (A portal is where a run comes out: it is judged by the pieces behind it.)
    if (cover === undefined || occ.def.bore?.open) continue;
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    if (cells.has(cellKey(gx, gy, gz - 1))) continue;
    const want = gz * levelHeight + cover;
    let low = Infinity;
    let high = -Infinity;
    for (const [ox, oz] of [[0, 0], [-3, -3], [3, -3], [-3, 3], [3, 3]] as const) {
      const h = terrainHeightAt(made, gx * cellSize + ox, gy * cellSize + oz);
      if (h === null) continue;
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    // More than half a metre of earth to add here, and none at all a level down, on ground that is near enough flat.
    if (low < want - 0.5 && low >= want - levelHeight - 0.01 && high - low < 0.5) mounded.push(occ.placement.id);
  }
  if (!mounded.length) return [];
  const ids = [...new Set(mounded)];
  return [{ severity: 'suggestion', code: 'tunnel.flush_a_level_down', message: `${ids.length} buried tunnel piece${ids.length === 1 ? ' stands' : 's stand'} as a mound on flat ground: a level down (Page Down) the ground already covers ${ids.length === 1 ? 'it' : 'them'} and the surface stays flat, with a ramp down to each portal`, targetId: ids[0]! }];
}

/**
 * Liquid in a buried passage: a liquid is a box and knows nothing of walls, so one that reaches into a bore above its
 * floor floods the tunnel (it is drawn there and waded in). Meant now and then (a flooded sewer); a warning, since a
 * pond dug over or beside a tunnel does it by accident. The fix is to keep the liquid's box out of the bore.
 */
function floodedBoreIssues(map: MapDocument, catalog: TileCatalog): ValidationIssue[] {
  const bores = mapGroundBores(map, catalog);
  if (!bores.cuts.length) return [];
  const issues: ValidationIssue[] = [];
  for (const e of map.entities) {
    if (e.kind !== 'water') continue;
    const [x, y, z] = e.position;
    const [w, h, d] = e.size;
    const top = y + h;
    // (A cut's lower y is its floor slab's underside, half a metre under the floor.)
    const hit = bores.cuts.find((c) => x - w / 2 < c.max[0] && x + w / 2 > c.min[0] && z - d / 2 < c.max[2] && z + d / 2 > c.min[2] && top > c.min[1] + 0.5 + 0.05 && y < Math.min(c.max[1], c.min[1] + 4.25));
    if (hit) {
      issues.push({ severity: 'warning', code: 'tunnel.flooded', message: `the ${e.liquid} ${e.id} reaches into a buried tunnel ${(top - hit.min[1] - 0.5).toFixed(1)} m over its floor: the passage is flooded there (keep the liquid's box out of the tunnel if that isn't meant)`, targetId: e.id });
    }
  }
  return issues;
}

/**
 * MapMaker's groups (v31) name the map's own things, each thing in one group at most: anything else is a warning
 * (MapMaker keeps them tidy; play ignores groups).
 */
function groupIssues(map: MapDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const have = new Set([...map.classicStructure.tiles.map((t) => t.id), ...map.entities.map((e) => e.id), ...(map.setPieces ?? []).map((p) => p.id)]);
  const seen = new Map<string, string>();
  for (const g of map.groups ?? []) {
    for (const m of g.members) {
      if (!have.has(m)) issues.push({ severity: 'warning', code: 'group.member', message: `group ${g.id} lists ${m}, which isn't in the map`, targetId: g.id });
      else if (seen.has(m) && seen.get(m) !== g.id) issues.push({ severity: 'warning', code: 'group.member', message: `${m} is in two groups (${seen.get(m)} and ${g.id})`, targetId: m });
      seen.set(m, g.id);
    }
  }
  return issues;
}

function validatePieces(map: MapDocument, catalog: TileCatalog, library: SetPieceLibrary): ValidationIssue[] {
  if (map.setPieces === undefined && map.setPieceDefs === undefined && map.lookDefs === undefined) return validateExpanded(map, map, catalog);
  const ex = expandSetPieces(map, library, catalog);
  const issues: ValidationIssue[] = [];
  const taken = new Set([...map.classicStructure.tiles.map((t) => t.id), ...map.entities.map((e) => e.id)]);
  for (const p of map.setPieces ?? []) {
    if (taken.has(p.id)) issues.push({ severity: 'error', code: 'id.duplicate', message: `duplicate ID "${p.id}"`, targetId: p.id });
    taken.add(p.id);
  }
  issues.push(...ex.issues, ...setPieceOverlapIssues(map, ex, buildOccupancy(map, catalog).cells));
  // The map as played travels in a joining player's welcome and is loaded again there: it must fit the size budget.
  const played = ex.map === map ? 0 : utf8Length(JSON.stringify(ex.map));
  if (played > RESOURCE_BUDGETS.mapBytes) issues.push({ severity: 'error', code: 'budget.bytes', message: `as played (its set pieces expanded) the map is ${(played / 1048576).toFixed(1)} MB: at most ${RESOURCE_BUDGETS.mapBytes / 1048576} MB` });
  for (const def of map.setPieceDefs ?? []) for (const p of checkSetPieceDefinition(def, { packs: library.packs, catalog })) issues.push({ severity: 'warning', code: 'setpiece.def', message: `the map's set piece ${def.id}: ${p}` });
  // The map's own looks (v47): each role a material the game has; a ground material only on floor, paving and roof (painting plan, 2a).
  for (const look of map.lookDefs ?? []) {
    for (const [role, v] of Object.entries(look.roles)) {
      if (!v || typeof v !== 'object') continue;
      if (!coreMaterials.get(v.material)) issues.push({ severity: 'warning', code: 'setpiece.look', message: `the map's look "${look.displayName}" (${look.id}): ${role} is ${v.material}, which is not a material (it takes the theme's)` });
      else if (isGroundMaterial(v.material) && role !== 'floor' && role !== 'paving' && role !== 'roof') issues.push({ severity: 'warning', code: 'setpiece.look', message: `the map's look "${look.displayName}" (${look.id}): ${role} is the ground material ${v.material}, which goes on floors, paving and roofs only` });
    }
    if (library.packs.has(look.id)) issues.push({ severity: 'error', code: 'setpiece.look_id', message: `the map's look ${look.id} has the id of a shipped look` });
  }
  for (const i of validateExpanded(ex.map, map, catalog)) {
    const placement = i.targetId ? ex.partOf.get(i.targetId) : undefined;
    issues.push(placement ? { ...i, targetId: placement } : i);
  }
  return issues;
}

/** validateMap on a map with no set pieces (or one expanded): `stored` is the map as saved (its release stamp is checked against that). */
function validateExpanded(map: MapDocument, stored: MapDocument, catalog: TileCatalog): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const seen = new Set<string>();
  for (const item of [...map.classicStructure.tiles, ...map.entities]) {
    if (seen.has(item.id)) issues.push({ severity: 'error', code: 'id.duplicate', message: `duplicate ID "${item.id}"`, targetId: item.id });
    seen.add(item.id);
  }

  if (map.bounds) {
    const { min, max } = map.bounds;
    for (const e of map.entities) {
      // Props and lights outside it are scenery (the scenery zone is meant to be built in: editor/ghostWhy.ts).
      if (e.kind === 'prop' || e.kind === 'light') continue;
      const [x, , z] = e.position;
      if (x < min[0] || x > max[0] || z < min[1] || z > max[1]) {
        issues.push({ severity: e.kind === 'spawn' ? 'error' : 'warning', code: 'bounds.outside', message: `${e.kind} ${e.id} is outside the map boundary`, targetId: e.id });
      }
    }
  }

  if (hasBorder(map) && !borderRect(map)) {
    issues.push({ severity: 'warning', code: 'border.noBoundary', message: 'the map has a border but no boundary (or walled terrain edge) to stand it along' });
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
  // The ground (map format v45): a Ground theme that exists, and grounds that are ground materials (nothing else draws as ground).
  if (map.terrain) {
    if (map.terrain.groundTheme && !groundThemes.get(map.terrain.groundTheme)) issues.push({ severity: 'warning', code: 'ground.theme_unknown', message: `unknown Ground theme "${map.terrain.groundTheme}": the ground shows ${DEFAULT_GROUND_THEME}'s base` });
    for (const g of map.terrain.grounds ?? []) if (!isGroundMaterial(g)) issues.push({ severity: 'error', code: 'material.unknown', message: `the terrain's grounds name "${g}", which is not a ground material` });
  }
  const blocks = map.entities.filter((e) => e.kind === 'block');
  for (const b of blocks) {
    if (b.kind === 'block' && b.material && !coreMaterials.get(b.material)) issues.push({ severity: 'error', code: 'material.unknown', message: `block ${b.id} uses unknown material "${b.material}"`, targetId: b.id });
  }
  if (map.classicStructure.tiles.length === 0 && !map.terrain && blocks.length === 0) {
    issues.push({ severity: 'error', code: 'tile.none', message: 'nothing to stand on: add terrain (Environment → Terrain), a structure tile or a block' });
  }

  issues.push(...budgetIssues(map));
  for (const x of map.botCast ?? []) if (!isCastId(x)) issues.push({ severity: 'warning', code: 'bots.cast_unknown', message: `bot characters: unknown group or theme "${x}" (left out)` });
  if (map.weaponSet !== undefined && !isWeaponSetId(map.weaponSet)) issues.push({ severity: 'warning', code: 'weapons.set_unknown', message: `weapon set: no set "${map.weaponSet}" (it plays Standard)` });
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
      message: `${spawns.length} spawn points for up to ${map.metadata.recommendedPlayers.max} players; spawns will be shared (matches of ${IMPROMPTU_MIN_PLAYERS}+ players add spawn points of their own on open ground, but placed ones play better)`,
    });
  } else {
    // Team maps: each side's own spawns for its share of the recommended players (a point per SPAWN_SHARE players).
    const sides = [...new Set(spawns.map((s) => s.faction).filter((f): f is string => !!f))];
    if (sides.length >= 2) {
      const want = Math.ceil(map.metadata.recommendedPlayers.max / sides.length / SPAWN_SHARE);
      const short = sides.filter((t) => spawns.filter((s) => s.faction === t).length < want);
      if (short.length) {
        issues.push({
          severity: 'warning',
          code: 'spawn.few',
          message: `${short.join(', ')} ${short.length === 1 ? 'has' : 'have'} fewer than ${want} spawn points of ${short.length === 1 ? 'its' : 'their'} own for up to ${map.metadata.recommendedPlayers.max} players (matches of ${IMPROMPTU_MIN_PLAYERS}+ players add spawn points of their own on the team's side, but placed ones play better)`,
        });
      }
    }
  }

  const { cellSize, levelHeight } = map.classicStructure;
  let propTops: WorldBox[] | undefined;
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
    // Or on a solid prop's collision (an airliner cabin's floor, a stair truck's platform), the same way.
    const onProp = !onTerrain && !onBlock && (propTops ??= propBoxes(map)).some((b) => Math.abs(b.max[1] - y) < 1 && pointOnBox(b, x, z));
    if (!onTerrain && !onBlock && !onProp && (!occ || !cellHasFloor(occ))) {
      issues.push({ severity: 'warning', code: 'spawn.no_floor', message: `spawn ${s.id} is not above a tile floor`, targetId: s.id });
    }
  }

  issues.push(...buriedMouthIssues(map, cells, catalog));
  issues.push(...boreProfileIssues(cells));
  issues.push(...floodedBoreIssues(map, catalog));
  issues.push(...moundedRunIssues(map, cells, catalog));
  for (const t of map.classicStructure.tiles) {
    if (t.family && !catalog.familiesOf(t.tile).some((d) => d.familyOf!.family === t.family)) {
      issues.push({ severity: 'warning', code: 'tile.family_unknown', message: `tile ${t.id} (${catalog.get(t.tile)?.displayName ?? t.tile}) doesn't come in the "${t.family}" family: it is drawn as its own`, targetId: t.id });
    }
  }

  const pickups = map.entities.filter((e) => e.kind === 'pickup');
  for (const p of pickups) {
    if (!getItem(p.item)) issues.push({ severity: 'error', code: 'pickup.unknown', message: `pickup ${p.id} uses unknown item "${p.item}"`, targetId: p.id });
    // Random from category: MapMaker shows the placed item, so it should be a weapon of that category.
    else if (p.random && itemCategory(getItem(p.item)) !== p.random) issues.push({ severity: 'warning', code: 'pickup.random_item', message: `pickup ${p.id} rolls ${WEAPON_CATEGORY_LABELS[p.random].toLowerCase()} but shows "${getItem(p.item)?.displayName}" in MapMaker`, targetId: p.id });
    if (p.keepFixed && !itemCategory(getItem(p.item))) issues.push({ severity: 'suggestion', code: 'pickup.keep_fixed', message: `pickup ${p.id} is kept fixed, but only weapon pickups are ever mixed up`, targetId: p.id });
  }
  // Disc Arena does no damage, so a map only for it needs no health.
  const discsOnly = map.metadata.supportedModes.length > 0 && map.metadata.supportedModes.every((m) => m === 'core.discs');
  if (!discsOnly && !pickups.some((p) => getItem(p.item)?.effect.kind === 'health')) {
    issues.push({ severity: 'suggestion', code: 'pickup.no_health', message: 'no health pickups: fights will snowball' });
  }

  for (const e of map.entities) {
    if (e.kind === 'prop' && !getProp(e.model)) issues.push({ severity: 'error', code: 'prop.unknown', message: `prop ${e.id} uses unknown model "${e.model}"`, targetId: e.id });
  }

  issues.push(...glassIssues(map, catalog));
  issues.push(...breakWallIssues(map, catalog));
  issues.push(...tallEdgeIssues(map, catalog));
  issues.push(...validateScenario(map));
  issues.push(...resourceBudgetIssues(map));
  if (stored.metadata.release && !releaseCurrent(stored)) {
    issues.push({ severity: 'warning', code: 'release.changed', message: 'changed since it was exported: the next export gives it a new version' });
  }
  issues.push(...validateTrack(map));
  const terrain = map.terrain;
  issues.push(...airplaneIssues(map, (x, z) => (terrain ? terrainHeightAt(terrain, x, z) : null)));
  issues.push(...ziplineShapeIssues(map.entities));
  issues.push(...arcSentryIssues(map.entities));

  const { min, max } = map.metadata.recommendedPlayers;
  if (min > max) issues.push({ severity: 'error', code: 'meta.players', message: `recommended players min ${min} > max ${max}` });

  return issues;
}

/** Level names as MapMaker shows them (editor/operations.ts levelName). */
const levelWord = (z: number) => (z === 0 ? 'Ground' : z > 0 ? `Level ${z}` : z === -1 ? 'Basement' : `Basement ${-z}`);

/**
 * Tall wall styles (two storeys and more: Grand arch, Gate arch, High wall, Towering wall) that rise through a floor or
 * a roof over their side (geometry.ts tallEdgeBlock): a warning each (MapMaker refuses new ones; owner, 2026-11-16).
 */
export function tallEdgeIssues(map: MapDocument, catalog: TileCatalog = coreCatalog): ValidationIssue[] {
  const tiles = map.classicStructure.tiles;
  if (!tiles.some((t) => t.edges && Object.values(t.edges).some((s) => s !== 'auto' && s !== 'open'))) return [];
  const { cellSize, levelHeight } = map.classicStructure;
  const half = cellSize / 2;
  const { cells } = buildOccupancy(map, catalog);
  const out: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const [key, occ] of cells) {
    const [x, y, z] = key.split(',').map(Number) as [number, number, number];
    for (const [, side] of cellSides(occ)) {
      const style = resolveEdge(cells, x, y, z, side);
      if (style === 'none' || edgeStoreys(style, half, levelHeight) <= 1) continue;
      // One wall, two cells: count it once.
      const [dx, dy] = SIDE_DIRS[side];
      const wall = `${[`${x},${y}`, `${x + dx},${y + dy}`].sort().join('|')}|${z}`;
      if (seen.has(wall)) continue;
      seen.add(wall);
      const block = tallEdgeBlock(cells, x, y, z, side, style, cellSize, levelHeight);
      if (!block) continue;
      const through = block.what === 'roof' ? `the roof over ${levelWord(block.level - 1)}` : `${levelWord(block.level)}'s floor`;
      out.push({ severity: 'warning', code: 'edge.tall', message: `tile ${occ.placement.id}: ${EDGE_STYLE_LABELS[style]} on its ${side} side (${levelWord(z)}) rises through ${through}; use a one-storey style there, or open the storey above`, targetId: occ.placement.id });
    }
  }
  return out;
}

/** Breakable walls that won't break (sim/breakWalls.ts): past the map's MAX_BREAK_WALLS, or on a piece with a facade. */
export function breakWallIssues(map: MapDocument, catalog: TileCatalog = coreCatalog): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!map.classicStructure.tiles.some((t) => t.breakWalls)) return out;
  const { over } = breakWallEdges(map, buildOccupancy(map, catalog).cells);
  if (over) out.push({ severity: 'warning', code: 'breakwall.budget', message: `${over} breakable wall${over === 1 ? '' : 's'} past the map's ${MAX_BREAK_WALLS} stay solid: mark fewer walls breakable` });
  for (const t of map.classicStructure.tiles) {
    if (t.breakWalls && t.options?.facade && t.options.facade !== 'none') out.push({ severity: 'warning', code: 'breakwall.facade', message: `tile ${t.id} has breakable walls and a facade: a faced piece's walls stay solid`, targetId: t.id });
  }
  return out;
}

/** Glass options that do nothing: glass on a side with no window, glass on a block that isn't plain solid. */
export function glassIssues(map: MapDocument, catalog: TileCatalog = coreCatalog): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const e of map.entities) {
    if (e.kind !== 'block' || !e.glass) continue;
    if (e.behaviour !== 'solid' || e.field) out.push({ severity: 'warning', code: 'glass.block', message: `block ${e.id} is glass but ${e.field ? 'a force field' : e.behaviour}: glass needs a plain solid block`, targetId: e.id });
  }
  if (!map.classicStructure.tiles.some((t) => t.glass)) return out;
  const { cells } = buildOccupancy(map, catalog);
  for (const [key, occ] of cells) {
    const glass = occ.placement.glass;
    if (!glass) continue;
    const [x, y, z] = key.split(',').map(Number) as [number, number, number];
    for (const [edge, worldSide] of cellSides(occ)) {
      if (!glass[edge]) continue;
      const style = resolveEdge(cells, x, y, z, worldSide);
      if (!GLASS_EDGES.has(style)) out.push({ severity: 'warning', code: 'glass.edge', message: `tile ${occ.placement.id} has glass on side ${edge} but no window there (${style === 'none' ? 'no wall' : style})`, targetId: occ.placement.id });
    }
  }
  // Glass keys naming cells the tile doesn't have.
  for (const t of map.classicStructure.tiles) {
    for (const edge of Object.keys(t.glass ?? {})) {
      const [dx, dy, dz] = edge.split(':')[0]!.split(',').map(Number) as [number, number, number];
      const has = [...cells.values()].some((o) => o.placement === t && o.local[0] === dx && o.local[1] === dy && o.local[2] === dz);
      if (!has) out.push({ severity: 'warning', code: 'glass.edge', message: `tile ${t.id} has glass on ${edge}, which isn't one of its cells`, targetId: t.id });
    }
  }
  return out;
}

/** Serialise with stable key order and trailing newline so map files diff cleanly. */
export function serializeMap(map: MapDocument): string {
  const t = map.terrain;
  if (!t) return `${JSON.stringify(map, null, 2)}\n`;
  // The terrain's grids are written a grid row to a line (a 321 × 321 terrain is 100,000 heights: one to a line, as
  // the rest of the file is laid out, its heights alone were over a megabyte). JSON all the same.
  const mark = (k: string) => `\u0001terrain:${k}`;
  let text = JSON.stringify({ ...map, terrain: { ...t, heights: mark('heights'), materials: mark('materials'), foliage: mark('foliage') } }, null, 2);
  const rows = (values: readonly number[], perRow: number): string => {
    if (!values.length) return '[]';
    const lines: string[] = [];
    for (let i = 0; i < values.length; i += perRow) lines.push(`      ${values.slice(i, i + perRow).join(', ')}`);
    return `[\n${lines.join(',\n')}\n    ]`;
  };
  for (const [k, values, perRow] of [['heights', t.heights, t.cols], ['materials', t.materials, t.cols - 1], ['foliage', t.foliage, t.cols - 1]] as const) {
    const key = `${JSON.stringify(k)}: ${JSON.stringify(mark(k))}`;
    const at = text.indexOf(key);
    if (at >= 0) text = `${text.slice(0, at)}${JSON.stringify(k)}: ${rows(values, Math.max(1, perRow))}${text.slice(at + key.length)}`;
  }
  return `${text}\n`;
}

/** Whether (x, z) is over a block's (turned) footprint. */
/** Whether (x, z) is inside a world box's footprint (turned with its yaw about its middle). */
function pointOnBox(b: WorldBox, x: number, z: number): boolean {
  const [cx, cz] = [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
  const [lx, lz] = yawXZ(x - cx, z - cz, -(b.yaw ?? 0));
  return Math.abs(lx) <= (b.max[0] - b.min[0]) / 2 && Math.abs(lz) <= (b.max[2] - b.min[2]) / 2;
}

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
  /** Different prop models (each is a download and a set of draw calls). 120 since 2026-11-21 (80 before). */
  propModels: 120,
  /** Solid free blocks: merged into the level's meshes like tiles, so mostly a navmesh build-time cost. */
  blocks: 3000,
  /** Breakable, crumbling and trapdoor blocks, and solid blocks logic drives or movers carry (each is simulated and sent to players). */
  dynamicBlocks: 150,
  liquids: 32,
  /** Gameplay pieces that think every tick: doors, traps, zones, squads, mounts, pads, buttons, movers. */
  active: 300,
  /** Lights (each lamp lights the pixels within its range: clustered, but a crowd of overlapping ones still costs every pixel they reach). */
  lights: 256,
  /**
   * Procedural environment species (`env.*` props, docs/PROCEDURAL_ENVIRONMENT.md): their own budget, apart from props.
   * They draw as thin instances batched per species, variant, level of detail and 64 m sector, so a copy costs far
   * less than a prop; what grows with the count is collision and navigation (trunks, boulders, cliffs).
   */
  env: {
    /** Placements in all (trees, shrubs, ground cover, boulders, cliffs). */
    placements: 4000,
    /** Placements that collide (trees, boulders, cliffs): shapes in every player's physics and the navmesh. */
    colliding: 3000,
    /** Cliff panels: each is a triangle-mesh collider and a navigation boundary. */
    cliffs: 120,
    /** Different species variants (each is a download and its own batches). */
    variants: 24,
  },
} as const;

function budgetIssues(map: MapDocument): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const over = (code: string, n: number, max: number, what: string) => {
    if (n > max) out.push({ severity: 'warning', code: `budget.${code}`, message: `${n} ${what} (budget ${max}): the map may run slowly on ordinary laptops` });
  };
  const e = map.entities;
  const all = e.filter((x) => x.kind === 'prop');
  // Environment species have their own budget (below); props are everything else.
  const props = all.filter((x) => !isEnvModel(x.model));
  const env = all.filter((x) => isEnvModel(x.model));
  over('tiles', map.classicStructure.tiles.length, MAP_BUDGETS.tiles, 'tiles');
  over('props', props.length, MAP_BUDGETS.props, 'props');
  over('prop_models', new Set(props.map((x) => x.model)).size, MAP_BUDGETS.propModels, 'different prop models');
  if (env.length) {
    const species = env.map((x) => getEnvSpecies(x.model));
    over('env', env.length, MAP_BUDGETS.env.placements, 'environment species placed (trees, plants, rocks, cliffs)');
    over('env_colliding', species.filter((s) => s && s.nav !== 'none').length, MAP_BUDGETS.env.colliding, 'trees, boulders and cliffs (environment species that collide)');
    over('env_cliffs', species.filter((s) => s?.category === 'cliff').length, MAP_BUDGETS.env.cliffs, 'cliff panels');
    over('env_variants', new Set(env.map((x) => `${x.model}#${x.variant ?? 0}`)).size, MAP_BUDGETS.env.variants, 'different environment species variants');
  }
  // Dynamic: breakable, crumbling and trapdoor blocks, and solid ones logic drives or movers carry (v20).
  const dynamic = dynamicBlockIds(map);
  over('blocks', e.filter((x) => x.kind === 'block' && !dynamic.has(x.id)).length, MAP_BUDGETS.blocks, 'solid blocks');
  over('dynamic_blocks', dynamic.size, MAP_BUDGETS.dynamicBlocks, 'breakable, crumbling, trapdoor, logic-driven or moving blocks');
  over('liquids', e.filter((x) => x.kind === 'water').length, MAP_BUDGETS.liquids, 'bodies of water, lava, acid or swamp');
  over('lights', e.filter((x) => x.kind === 'light').length, MAP_BUDGETS.lights, 'lights');
  over('active', e.filter((x) => ['door', 'trap', 'zone', 'encounter', 'mount', 'pad', 'button', 'mover', 'portal'].includes(x.kind)).length, MAP_BUDGETS.active, 'doors, traps, zones, squads, vehicles, pads, buttons, movers and portals');
  const xs = e.map((x) => x.position[0]);
  const zs = e.map((x) => x.position[2]);
  const span = xs.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) : 0;
  over('footprint', Math.round(span), MAP_BUDGETS.footprint, 'm across');
  return out;
}
