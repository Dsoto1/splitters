/**
 * Retired tiles (docs/SET_PIECES_PLAN.md, "As built: part 5"): an old monolithic tile a set piece now replaces leaves
 * MapMaker's palette but stays readable. content/setpieces/aliases.json names the piece for each; the piece covers
 * exactly the tile's cells and levels unturned (tools/content/setpieces-check.ts checks it), so a placement of the
 * tile becomes a placement of the piece at the same cell, level and turn.
 *
 * - As played, loadMap puts the piece in the tile's place (`withTileAliases`): saved and shipped maps that place the
 *   tile keep working and play the piece. The tile's own edges, surfaces and options go with it (the piece has its own).
 * - MapMaker opens the map as made (the tile stays) and offers "Replace all" in the tile's inspector
 *   (editor/setPieceEdit.ts `replaceTilesWithSetPieceCommand`, one undo step), so an exported map names the piece.
 * Not a format change: no field is added, and a map that never placed a retired tile is untouched.
 */
import { SET_PIECE_TILE_ALIASES } from '../content/setPieces.generated.ts';
import type { MapDocument, SetPiecePlacement, TilePlacement } from './schema.ts';

/** Retired tile id → the set piece that replaces it. */
export const TILE_ALIASES: ReadonlyMap<string, string> = /* @__PURE__ */ new Map(SET_PIECE_TILE_ALIASES.map((a) => [a.tile, a.piece]));

/** The set piece that replaces a retired tile, or undefined for a tile that isn't retired. */
export const retiredTileReplacement = (tile: string): string | undefined => TILE_ALIASES.get(tile);

/** A placement id for the piece taking a tile's place: the tile's own id when it fits (4-48 characters), else a short form of it, never one `taken`. */
function placementId(tileId: string, taken: Set<string>): string {
  let base = tileId.length <= 48 ? tileId : `${tileId.slice(0, 39)}_${hash(tileId)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base.slice(0, 44)}_${n}`;
  taken.add(id);
  return id;
}
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).padStart(7, '0').slice(0, 8);
}

/**
 * The set-piece placements that take the place of these tile placements (each turned as it was, never mirrored), with
 * ids that clash with nothing in the map. `piece` names the replacement (else the alias table's).
 */
export function placementsForTiles(doc: Pick<MapDocument, 'classicStructure' | 'entities' | 'setPieces'>, tiles: readonly TilePlacement[], piece?: string): SetPiecePlacement[] {
  const replaced = new Set(tiles.map((t) => t.id));
  const taken = new Set([...doc.classicStructure.tiles.filter((t) => !replaced.has(t.id)).map((t) => t.id), ...doc.entities.map((e) => e.id), ...(doc.setPieces ?? []).map((p) => p.id)]);
  const out: SetPiecePlacement[] = [];
  for (const t of tiles) {
    const to = piece ?? TILE_ALIASES.get(t.tile);
    if (!to) continue;
    out.push({ id: placementId(t.id, taken), piece: to, x: t.x, y: t.y, z: t.z, rotation: t.rotation, mirror: false });
  }
  return out;
}

/** The map with every retired tile it places replaced by its set piece (the map itself when it places none). */
export function withTileAliases<T extends MapDocument>(doc: T): T {
  const old = doc.classicStructure.tiles.filter((t) => TILE_ALIASES.has(t.tile));
  if (!old.length) return doc;
  const gone = new Set(old.map((t) => t.id));
  return {
    ...doc,
    classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.filter((t) => !gone.has(t.id)) },
    setPieces: [...(doc.setPieces ?? []), ...placementsForTiles(doc, old)],
  };
}
