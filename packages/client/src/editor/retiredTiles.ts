import { TILE_ALIASES, coreCatalog, type MapDocument, type SetPieceDefinition } from '@tiletrigger/shared';

/** Retired tiles (content/setpieces/aliases.json) stay out of the palette: maps that place one still load. */
export const isRetiredTile = (id: string): boolean => TILE_ALIASES.has(id);

/**
 * The tile inspector's "Replace all" (docs/SET_PIECES_PLAN.md, "As built: part 5" and part 6): every placement of
 * this tile becomes a set piece at the same cell, level and turn, one undo step (editor/setPieceEdit.ts
 * `replaceTilesWithSetPieceCommand`). A retired tile says what replaced it and offers that piece first; any tile can
 * be replaced by any set piece (a piece bigger than the tile must fit where it lands: MapMaker says why if not, then
 * move what's in the way and try again).
 */
export function replaceTilePanel(doc: MapDocument, tile: string, pieces: readonly SetPieceDefinition[], replaceAll: (tile: string, piece: string) => void): HTMLElement {
  const retiredFor = TILE_ALIASES.get(tile);
  const count = doc.classicStructure.tiles.filter((t) => t.tile === tile).length;
  const name = coreCatalog.get(tile)?.displayName ?? tile;
  const nameOf = (id: string) => pieces.find((p) => p.id === id)?.displayName ?? id;
  const box = document.createElement('div');
  box.className = 'ed-retired';
  box.id = 'ed-retired';
  const note = document.createElement('small');
  note.textContent = retiredFor
    ? `${name} is retired: the ${nameOf(retiredFor)} set piece replaces it (it plays as that already). Replace all to keep the set piece in the map.`
    : `Replace every ${name} in the map with a set piece, where each one stands (same cell, level and turn).`;
  const pick = document.createElement('select');
  pick.id = 'ed-replace-piece';
  const sorted = [...pieces].sort((a, b) => (a.id === retiredFor ? -1 : b.id === retiredFor ? 1 : a.displayName.localeCompare(b.displayName)));
  for (const p of sorted) pick.append(new Option(p.displayName, p.id, false, p.id === retiredFor));
  const go = document.createElement('button');
  go.id = 'ed-retired-replace';
  const label = () => (go.textContent = `Replace all ${count} with ${nameOf(pick.value)}`);
  label();
  pick.addEventListener('change', label);
  go.addEventListener('click', () => replaceAll(tile, pick.value));
  box.append(note, pick, go);
  return box;
}
