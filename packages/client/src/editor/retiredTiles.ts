import { TILE_ALIASES, coreCatalog, type MapDocument } from '@tiletrigger/shared';

/** Retired tiles (content/setpieces/aliases.json) stay out of the palette: maps that place one still load. */
export const isRetiredTile = (id: string): boolean => TILE_ALIASES.has(id);

/**
 * The tile inspector's note on a retired tile (docs/SET_PIECES_PLAN.md, "As built: part 5"): what replaced it, and
 * "Replace all" (every placement of it becomes the set piece, one undo step: editor/setPieceEdit.ts
 * `replaceTilesWithSetPieceCommand`). Null for a tile that isn't retired.
 */
export function retiredTilePanel(doc: MapDocument, tile: string, pieceName: (id: string) => string, replaceAll: (tile: string) => void): HTMLElement | null {
  const piece = TILE_ALIASES.get(tile);
  if (!piece) return null;
  const count = doc.classicStructure.tiles.filter((t) => t.tile === tile).length;
  const name = coreCatalog.get(tile)?.displayName ?? tile;
  const box = document.createElement('div');
  box.className = 'ed-retired';
  box.id = 'ed-retired';
  const note = document.createElement('small');
  note.textContent = `${name} is retired: the ${pieceName(piece)} set piece replaces it (it plays as that already). Replace all to keep the set piece in the map.`;
  const go = document.createElement('button');
  go.id = 'ed-retired-replace';
  go.textContent = `Replace all ${count} with ${pieceName(piece)}`;
  go.addEventListener('click', () => replaceAll(tile));
  box.append(note, go);
  return box;
}
