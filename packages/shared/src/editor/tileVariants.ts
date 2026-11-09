import { coreCatalog, type TileCatalog, type TileDefinition, type TileOptionId } from '../map/catalog.ts';
import type { MapDocument, TilePlacement } from '../map/schema.ts';
import type { EditCommand } from './commands.ts';

/**
 * MapMaker's tile options that are tiles of their own (content/tiles/core.json `optionOf`): the Vaulted Tunnel's side
 * walls are the tile "Vaulted Tunnel (Side Walls)". The inspector shows a checkbox; switching it swaps the placement's
 * tile for its twin and keeps everything else (place, turn, paint, walls). The palette lists only the plain tile.
 */
export const TILE_OPTION_LABELS: Record<TileOptionId, string> = {
  sideWalls: 'Side walls',
};

export const TILE_OPTION_HELP: Record<TileOptionId, string> = {
  sideWalls: 'Masonry up to ground level on the closed sides, so the ground round the tunnel meets a kerb instead of sloping down to it',
};

/** One option a tile offers: whether it is on for that tile, and the tile it is with the option off and on. */
export interface TileOptionState {
  option: TileOptionId;
  label: string;
  on: boolean;
  off: string;
  onTile: string;
}

/** A tile that is another tile with an option on (kept out of the palette). */
export const isTileOptionTwin = (def: TileDefinition | undefined): boolean => !!def?.optionOf;

/** The options a tile has (as the plain tile or as one with an option on). */
export function tileOptionsOf(tile: string, catalog: TileCatalog = coreCatalog): TileOptionState[] {
  const def = catalog.get(tile);
  if (!def) return [];
  if (def.optionOf) return [{ option: def.optionOf.option, label: TILE_OPTION_LABELS[def.optionOf.option], on: true, off: def.optionOf.tile, onTile: def.id }];
  return catalog
    .all()
    .filter((d) => d.optionOf?.tile === tile)
    .map((d) => ({ option: d.optionOf!.option, label: TILE_OPTION_LABELS[d.optionOf!.option], on: false, off: tile, onTile: d.id }));
}

/**
 * Switch an option on or off for the given tiles (one undo step). Tiles without the option, and those already as
 * asked, are left alone; an error when none would change.
 */
export function setTileOptionCommand(doc: MapDocument, tileIds: readonly string[], option: TileOptionId, on: boolean, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const want = new Set(tileIds);
  const before: TilePlacement[] = [];
  const after: TilePlacement[] = [];
  for (const t of doc.classicStructure.tiles) {
    if (!want.has(t.id)) continue;
    const s = tileOptionsOf(t.tile, catalog).find((o) => o.option === option);
    if (!s || s.on === on) continue;
    before.push(t);
    after.push({ ...t, tile: on ? s.onTile : s.off });
  }
  if (!before.length) return { error: `No selected tile can change its ${TILE_OPTION_LABELS[option].toLowerCase()}` };
  return { kind: 'updateTiles', before, after };
}
