import { MAX_TILE_CELL, MAX_TILE_LEVEL, type MapDocument } from '../map/schema.ts';

/**
 * MapMaker's two outlines (docs/BUILDING_KIT.md, "Where you can build"): the playable boundary, inside which the
 * match is played, and the build limit, where placement stops. Between them is the scenery zone: pieces built there
 * blend the play space into the world around it (owner, 2026-11-05), so it is allowed, never an error.
 */
export interface AreaRect {
  /** World X, Z of the south-west and north-east corners. */
  min: [number, number];
  max: [number, number];
}

/** Where placement stops: tiles within MAX_TILE_CELL cells of the centre, so to the outer edge of the last cell. */
export function buildLimitRect(doc: Pick<MapDocument, 'classicStructure'>): AreaRect {
  const r = (MAX_TILE_CELL + 0.5) * doc.classicStructure.cellSize;
  return { min: [-r, -r], max: [r, r] };
}

/** The levels a tile may stand on: MAX_TILE_LEVEL up or down. */
export const BUILD_LEVELS = { min: -MAX_TILE_LEVEL, max: MAX_TILE_LEVEL } as const;

/** The playable boundary: the map's bounds, or without them its terrain's extent; null when it has neither. */
export function playableRect(doc: Pick<MapDocument, 'bounds' | 'terrain'>): (AreaRect & { from: 'bounds' | 'terrain' }) | null {
  if (doc.bounds) return { min: [...doc.bounds.min], max: [...doc.bounds.max], from: 'bounds' };
  const t = doc.terrain;
  if (!t) return null;
  return { min: [t.origin[0], t.origin[1]], max: [t.origin[0] + (t.cols - 1) * t.spacing, t.origin[1] + (t.rows - 1) * t.spacing], from: 'terrain' };
}

/** Which zone a ground point is in: the play area, the scenery zone outside it, or past the build limit. */
export type BuildZone = 'play' | 'scenery' | 'beyond';

export function buildZone(doc: Pick<MapDocument, 'bounds' | 'terrain' | 'classicStructure'>, x: number, z: number): BuildZone {
  const inside = (r: AreaRect) => x >= r.min[0] && x <= r.max[0] && z >= r.min[1] && z <= r.max[1];
  if (!inside(buildLimitRect(doc))) return 'beyond';
  const play = playableRect(doc);
  return !play || inside(play) ? 'play' : 'scenery';
}

/** Whether a grid cell (x, y across, z the level) is one a tile may occupy. */
export function insideBuildLimit(x: number, y: number, z: number): boolean {
  return Math.abs(x) <= MAX_TILE_CELL && Math.abs(y) <= MAX_TILE_CELL && Math.abs(z) <= MAX_TILE_LEVEL;
}

/** What MapMaker says when a placement would cross the build limit. */
export function buildLimitReason(doc: Pick<MapDocument, 'classicStructure'>, z: number): string {
  const metres = Math.round(MAX_TILE_CELL * doc.classicStructure.cellSize);
  if (Math.abs(z) > MAX_TILE_LEVEL) return `past the build limit: levels go ${MAX_TILE_LEVEL} up and ${MAX_TILE_LEVEL} down (pick a level within them)`;
  return `past the build limit (the white dashed outline): tiles stay within ${MAX_TILE_CELL} cells (${metres.toLocaleString('en')} m) of the centre. Inside it, outside the playable boundary is fine for scenery`;
}
