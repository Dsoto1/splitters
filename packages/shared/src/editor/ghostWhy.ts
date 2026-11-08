import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import type { WorldBox } from '../map/geometry.ts';
import type { MapDocument, Rotation } from '../map/schema.ts';
import { terrainHeightAt, type TerrainData } from '../map/terrain.ts';
import { HANGING_PROPS, supportUnder } from '../map/settle.ts';
import { buildZone } from './buildArea.ts';
import { checkPlacement, isBareFloor, upperFloorAt, type PlacementCheck } from './operations.ts';

/**
 * The ghost says why (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 1 item 1): beside the pointer, before the click, a few
 * words on why a placement is refused (`bad`: the ghost is red and the click is refused), on what the validator will
 * warn about once it's placed (`warn`), or on where it is (`note`: the scenery zone, which is fine).
 */
export type GhostTone = 'bad' | 'warn' | 'note';
export interface GhostNote {
  tone: GhostTone;
  text: string;
}

/**
 * Whether the tile tool's ghost fits at a cell: `checkPlacement`, or a floor-only piece (Platform) on another piece's
 * empty upper storey, which becomes that piece's floor there (placeTileCommand does the same).
 */
export function tileGhostCheck(doc: MapDocument, tile: string, x: number, y: number, z: number, rotation: Rotation, catalog: TileCatalog = coreCatalog): PlacementCheck {
  const check = checkPlacement(doc, [{ id: '__ghost', tile, x, y, z, rotation }], [], catalog);
  if (check.ok) return check;
  if (isBareFloor(catalog.get(tile)) && upperFloorAt(doc, x, y, z, catalog)?.has === false) return { ok: true };
  return check;
}

/** A refused check as the ghost's note (null when it fits). */
export function checkNote(check: PlacementCheck): GhostNote | null {
  return check.ok ? null : { tone: 'bad', text: check.short };
}

/** The scenery zone note, for anything placed at ground point (x, z) outside the playable boundary. */
export const SCENERY_NOTE = 'Outside the playable area: scenery zone';

/**
 * Where a tile or set piece goes (x, z: its anchor's world point): the scenery zone is a note, never a refusal (past
 * the build limit, the placement check refuses it).
 */
export function zoneNote(doc: Pick<MapDocument, 'bounds' | 'terrain' | 'classicStructure'>, x: number, z: number): GhostNote | null {
  return buildZone(doc, x, z) === 'scenery' ? { tone: 'note', text: SCENERY_NOTE } : null;
}

/** The kinds of thing the entity tools place, as the ghost knows them. */
export type GhostEntityKind = 'spawn' | 'pickup' | 'prop' | 'mount' | 'npc' | 'object';

/** What the ghost needs to see under an entity: the map's floors and blocks (world boxes) and the ground as shown. */
export interface GhostGround {
  boxes: readonly WorldBox[];
  terrain: TerrainData | null;
}

/** How far a spawn's feet may be from the ground or a floor and still stand on it (as validateMap's spawn check). */
const TERRAIN_REACH = 1.5;
const FLOOR_REACH = 1;

/** Whether something stands under point (x, y, z): the ground within reach, or the top of a floor, block or wall. */
export function standsOnSomething(ground: GhostGround, x: number, y: number, z: number): boolean {
  const h = ground.terrain ? terrainHeightAt(ground.terrain, x, z) : null;
  if (h !== null && Math.abs(h - y) < TERRAIN_REACH) return true;
  return supportUnder(ground.boxes, x, z, y, '') >= y - FLOOR_REACH;
}

/**
 * The note for an entity's ghost at `at`, worst first:
 * - spawns, pickups, vehicles, NPCs and props with nothing under them: "No floor under it" (validateMap warns about
 *   spawns off a floor and floating props; the others drop or stand in the air). Hung props (chandeliers) are left out;
 * - outside the map's boundary (when it has one; validateMap warns, and a spawn there is an error);
 * - in the scenery zone (no boundary set: the terrain's edge): the note.
 * Objects (doors, zones, lights, logic pieces) only get the zone notes: many are meant to hang or float.
 */
export function entityGhostNote(doc: Pick<MapDocument, 'bounds' | 'terrain' | 'classicStructure'>, kind: GhostEntityKind, at: readonly [number, number, number], ground: GhostGround, model = ''): GhostNote | null {
  const [x, y, z] = at;
  const zone = buildZone(doc, x, z);
  if (kind === 'spawn' && zone !== 'play' && doc.bounds) return { tone: 'warn', text: 'Outside the map boundary: a spawn must be inside it' };
  const needsFloor = kind !== 'object' && !(kind === 'prop' && HANGING_PROPS.has(model));
  if (needsFloor && !standsOnSomething(ground, x, y, z)) return { tone: 'warn', text: 'No floor under it' };
  if (zone === 'beyond') return { tone: 'warn', text: 'Past the build limit: outside the build area' };
  if (zone === 'scenery') return doc.bounds ? { tone: 'warn', text: 'Outside the map boundary (scenery zone)' } : { tone: 'note', text: SCENERY_NOTE };
  return null;
}
