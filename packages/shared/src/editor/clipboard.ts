import { z } from 'zod';
import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import { coreThemes } from '../map/materials.ts';
import { MapEntity, MapGroup, SetPieceDefinition, SetPiecePlacement, TilePlacement, type MapDocument } from '../map/schema.ts';
import { piecesFor, setPieceFootprint, type SetPieceLibrary } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import { applyCommand, type EditCommand } from './commands.ts';
import { freshCopies } from './copyItems.ts';
import { addGroupsCommand, copiedGroups } from './groups.ts';
import { checkLayout, levelName, placementCells, type Selection } from './operations.ts';
import { addSetPieceDefCommand } from './setPieceEdit.ts';

/**
 * MapMaker's clipboard (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 3 item 4): Copy (Ctrl+C) puts the selection in this
 * browser's local storage (no uploads), so Paste (Ctrl+V) brings it into this map or another one. Pasted things get
 * new ids and land relative to the pointer: the copy's anchor cell (the middle of its cells, its lowest level) goes on
 * the cell under the pointer, on the level being edited. The map's own set pieces the copy uses travel with it; whole
 * groups stay groups.
 *
 * Another map's grid or theme: a paste into a map with a different cell size or level height is refused (the pieces
 * wouldn't line up). One into a map of another theme goes in (owner, 2026-11-09; PASTE_ACROSS_THEMES): the pieces
 * take this map's theme wherever they wore their old map's (its walls, floors and roofs, a set piece's roles), and
 * keep their own paint (a surface painted by hand, a set piece's own role pack); `pasteNote` says so.
 */
export const CLIPBOARD_FORMAT = 'tiletrigger.mapmaker.clipboard';
/** The owner's call (2026-11-09: allowed): may a copy go into a map of another theme (its pieces then wear this map's theme, their own paint kept)? Off: refused. */
export const PASTE_ACROSS_THEMES = true;

export const MapClipboard = z.object({
  format: z.literal(CLIPBOARD_FORMAT),
  version: z.literal(1),
  /** Where it was copied from. */
  from: z.object({ mapId: z.string().max(64), mapName: z.string().max(80), theme: z.string().max(64), cellSize: z.number().positive(), levelHeight: z.number().positive() }),
  /** The cell and level the copy is placed by. */
  anchor: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  tiles: z.array(TilePlacement).max(4096),
  entities: z.array(MapEntity).max(4096),
  setPieces: z.array(SetPiecePlacement).max(1024),
  /** The source map's own set pieces the copy's placements use. */
  setPieceDefs: z.array(SetPieceDefinition).max(64),
  /** Groups copied whole. */
  groups: z.array(MapGroup).max(256),
});
export type MapClipboard = z.infer<typeof MapClipboard>;

/** How many things a clipboard holds. */
export const clipboardCount = (c: Pick<MapClipboard, 'tiles' | 'entities' | 'setPieces'>): number => c.tiles.length + c.entities.length + c.setPieces.length;

/** Copy the selection (null-free: a refusal when nothing is selected). */
export function copySelection(doc: MapDocument, sel: Selection, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): MapClipboard | { error: string } {
  const t = new Set(sel.tiles);
  const e = new Set(sel.entities);
  const p = new Set(sel.setPieces ?? []);
  const tiles = doc.classicStructure.tiles.filter((x) => t.has(x.id));
  const entities = doc.entities.filter((x) => e.has(x.id));
  const setPieces = (doc.setPieces ?? []).filter((x) => p.has(x.id));
  if (!tiles.length && !entities.length && !setPieces.length) return { error: 'nothing selected to copy' };
  const { cellSize, levelHeight, theme } = doc.classicStructure;
  const pieces = piecesFor(doc, library);
  const cells: [number, number, number][] = [];
  for (const x of tiles) cells.push(...(placementCells(x, catalog) ?? []));
  for (const x of setPieces) {
    const def = pieces.get(x.piece);
    if (def) cells.push(...setPieceFootprint(x, def));
  }
  const mid = (vs: number[]) => Math.round((Math.min(...vs) + Math.max(...vs)) / 2);
  const anchor: [number, number, number] = cells.length
    ? [mid(cells.map((c) => c[0])), mid(cells.map((c) => c[1])), Math.min(...cells.map((c) => c[2]))]
    : [mid(entities.map((x) => x.position[0] / cellSize)), mid(entities.map((x) => x.position[2] / cellSize)), Math.min(...entities.map((x) => Math.floor(x.position[1] / levelHeight + 0.25)))];
  const ids = new Set([...t, ...e, ...p]);
  const used = new Set(setPieces.map((x) => x.piece));
  return {
    format: CLIPBOARD_FORMAT,
    version: 1,
    from: { mapId: doc.metadata.id, mapName: doc.metadata.name, theme, cellSize, levelHeight },
    anchor,
    tiles,
    entities,
    setPieces,
    setPieceDefs: (doc.setPieceDefs ?? []).filter((d) => used.has(d.id)),
    groups: (doc.groups ?? []).filter((g) => g.members.every((m) => ids.has(m))),
  };
}

/** A clipboard read back from storage, checked (null: none, or not one this build reads). */
export function parseClipboard(json: unknown): MapClipboard | null {
  const r = MapClipboard.safeParse(json);
  return r.success ? r.data : null;
}

/** Why this clipboard can't go into this map, or null. */
export function pasteRefusal(doc: MapDocument, clip: MapClipboard): string | null {
  const { cellSize, levelHeight, theme } = doc.classicStructure;
  const from = `copied from ${clip.from.mapName}`;
  if (clip.from.cellSize !== cellSize || clip.from.levelHeight !== levelHeight)
    return `${from}, a map on ${clip.from.cellSize} m cells and ${clip.from.levelHeight} m levels; this map's are ${cellSize} m and ${levelHeight} m, so the pieces wouldn't line up`;
  if (!PASTE_ACROSS_THEMES && clip.from.theme !== theme) return `${from}, a map in another theme (${clip.from.theme}); this map is ${theme}. Paste it into a map of the same theme`;
  for (const d of clip.setPieceDefs) {
    const mine = doc.setPieceDefs?.find((x) => x.id === d.id);
    if (mine && JSON.stringify(mine) !== JSON.stringify(d)) return `${from}: it uses the set piece ${d.displayName} (${d.id}), and this map has a different piece of that name`;
  }
  return null;
}

/** What a paste into this map should be told beyond its count (another theme: what the pieces wear now), or null. */
export function pasteNote(doc: MapDocument, clip: MapClipboard): string | null {
  const theme = doc.classicStructure.theme;
  if (clip.from.theme === theme) return null;
  return `from a ${themeName(clip.from.theme)} map: the pieces wear this map's ${themeName(theme)} theme, their own paint kept`;
}
const themeName = (id: string) => coreThemes.get(id)?.displayName ?? id;

/**
 * Paste: the clipboard's things with new ids, their anchor on `cell` and `level` (things move with their tiles, by
 * whole cells and levels). Refused when the grid or theme don't match (pasteRefusal) or a tile or set piece wouldn't
 * fit there. One undo step.
 */
export function pasteCommand(
  doc: MapDocument,
  clip: MapClipboard,
  cell: readonly [number, number],
  level: number,
  catalog: TileCatalog = coreCatalog,
  library: SetPieceLibrary = builtInSetPieces(),
): { command: EditCommand; selection: Selection } | { error: string } {
  const why = pasteRefusal(doc, clip);
  if (why) return { error: why };
  const { cellSize, levelHeight } = doc.classicStructure;
  const [dx, dy, dz] = [cell[0] - clip.anchor[0], cell[1] - clip.anchor[1], level - clip.anchor[2]];
  const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
  const copies = freshCopies({
    tiles: clip.tiles.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy, z: t.z + dz })),
    entities: clip.entities.map((e) => ({ ...e, position: [r3(e.position[0] + dx * cellSize), r3(e.position[1] + dz * levelHeight), r3(e.position[2] + dy * cellSize)] }) as MapEntity),
    setPieces: clip.setPieces.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz })),
  });
  const defs: EditCommand[] = [];
  let at = doc;
  for (const d of clip.setPieceDefs) {
    if (doc.setPieceDefs?.some((x) => x.id === d.id)) continue;
    const c = addSetPieceDefCommand(at, d);
    if ('error' in c) return c;
    defs.push(c);
    at = applyCommand(at, c);
  }
  const check = checkLayout(at, { tiles: copies.tiles, setPieces: copies.setPieces }, [], catalog, library);
  if (!check.ok) return { error: `on ${levelName(level)} here it ${check.reason}` };
  const add: EditCommand = { kind: 'batch', commands: [...defs, { kind: 'addTiles', tiles: copies.tiles }, { kind: 'addEntities', entities: copies.entities }, { kind: 'addSetPieces', setPieces: copies.setPieces }] };
  const groups = addGroupsCommand(applyCommand(doc, add), copiedGroups(clip.groups, copies.idMap));
  return {
    command: groups ? { kind: 'batch', commands: [add, groups] } : add,
    selection: { tiles: copies.tiles.map((t) => t.id), entities: copies.entities.map((e) => e.id), ...(copies.setPieces.length ? { setPieces: copies.setPieces.map((p) => p.id) } : {}) },
  };
}
