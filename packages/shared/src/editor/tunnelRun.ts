import { coreCatalog, SIDES, SIDE_DIRS, type Side, type TileCatalog } from '../map/catalog.ts';
import { buildOccupancy, cellKey, edgeSegments, resolveEdge, rotateSide, type CellOccupant } from '../map/geometry.ts';
import type { MapDocument, Rotation, SetPiecePlacement, TilePlacement } from '../map/schema.ts';
import { expandSetPieces } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import { newId, type EditCommand } from './commands.ts';

/**
 * MapMaker's tunnel tools (Tileset 04 steps 3 and 5; docs/map-briefs/tunnels/PLAN_2026-11-13.md): a buried piece's
 * material family (map format v37: the same shape drawn in another family's materials and trim; v44: a set piece's
 * tunnel parts too), a whole connected run changed at once, a portal put on each end of a run that comes out into the
 * ground, and a Dead End put on each end to close it.
 */

/** The families a placed tile can be drawn in, with the one it is drawn in now; empty for a tile with none. */
export function tileFamilies(placement: Pick<TilePlacement, 'tile' | 'family'>, catalog: TileCatalog = coreCatalog): { family: string; label: string; on: boolean }[] {
  const now = catalog.drawn(placement)?.familyOf?.family;
  return catalog.familiesOf(placement.tile).map((d) => ({ family: d.familyOf!.family, label: d.familyOf!.label, on: d.familyOf!.family === now }));
}

const OPPOSITE: Record<Side, Side> = { N: 'S', E: 'W', S: 'N', W: 'E' };

/** The map with its set pieces' parts in place (a Lit Tunnel Run is part of a run, and its cells are taken). */
const asBuilt = (doc: MapDocument, catalog: TileCatalog): MapDocument => (doc.setPieces?.length ? expandSetPieces(doc, builtInSetPieces(), catalog).map : doc);

/** The world sides a cell's piece has a port on. */
function portSides(occ: CellOccupant): Side[] {
  return occ.def.ports
    .filter((p) => p.level === occ.level && (p.cell?.[0] ?? 0) === occ.local[0] && (p.cell?.[1] ?? 0) === occ.local[1])
    .map((p) => rotateSide(p.side, occ.placement.rotation));
}

/** Whether a side of a cell has been closed with a wall style (a dead end the map maker made). */
function walledUp(cells: Map<string, CellOccupant>, x: number, y: number, z: number, side: Side, cellSize: number, levelHeight: number): boolean {
  return edgeSegments(resolveEdge(cells, x, y, z, side), cellSize / 2, levelHeight).some(([u0, u1, y0, y1]) => u0 < 0 && u1 > 0 && y0 < 1 && y1 > 1);
}

/**
 * The buried pieces joined to the given ones port to port (a run and its branches), the given ones included: what
 * "the whole run" means for the Family switch. Pieces that aren't buried (no bore) are not part of a run. A run goes
 * on through a set piece's tunnels (a Lit Tunnel Run), but only the map's own tiles are returned.
 */
export function connectedRun(doc: MapDocument, tileIds: readonly string[], catalog: TileCatalog = coreCatalog): string[] {
  const seen = runIds(doc, tileIds, catalog);
  return doc.classicStructure.tiles.filter((t) => seen.has(t.id)).map((t) => t.id);
}

/** The set pieces with a buried part in the run joined to the given pieces (tile ids, set piece parts' ids too). */
export function connectedRunPieces(doc: MapDocument, tileIds: readonly string[], catalog: TileCatalog = coreCatalog): string[] {
  if (!doc.setPieces?.length) return [];
  const { partOf } = expandSetPieces(doc, builtInSetPieces(), catalog);
  const pieces = new Set<string>();
  for (const id of runIds(doc, tileIds, catalog)) {
    const piece = partOf.get(id);
    if (piece) pieces.add(piece);
  }
  return doc.setPieces.filter((p) => pieces.has(p.id)).map((p) => p.id);
}

function runIds(doc: MapDocument, tileIds: readonly string[], catalog: TileCatalog): Set<string> {
  const { cells } = buildOccupancy(asBuilt(doc, catalog), catalog);
  const byTile = new Map<string, [number, number, number, CellOccupant][]>();
  for (const [key, occ] of cells) {
    if (!occ.def.bore) continue;
    const [x, y, z] = key.split(',').map(Number) as [number, number, number];
    const list = byTile.get(occ.placement.id);
    if (list) list.push([x, y, z, occ]);
    else byTile.set(occ.placement.id, [[x, y, z, occ]]);
  }
  const seen = new Set<string>();
  const queue = tileIds.filter((id) => byTile.has(id));
  for (const id of queue) seen.add(id);
  while (queue.length) {
    const id = queue.pop()!;
    for (const [x, y, z, occ] of byTile.get(id) ?? []) {
      for (const side of portSides(occ)) {
        const [dx, dy] = SIDE_DIRS[side];
        const there = cells.get(cellKey(x + dx, y + dy, z));
        if (!there?.def.bore || seen.has(there.placement.id) || !portSides(there).includes(OPPOSITE[side])) continue;
        seen.add(there.placement.id);
        queue.push(there.placement.id);
      }
    }
  }
  return seen;
}

/**
 * Draw the given tiles in a family (one undo step). Tiles that don't come in it, and those already in it, are left
 * alone; an error when none would change. A tile set back to its own family loses the field.
 */
export function setTileFamilyCommand(doc: MapDocument, tileIds: readonly string[], family: string, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const want = new Set(tileIds);
  const before: TilePlacement[] = [];
  const after: TilePlacement[] = [];
  for (const t of doc.classicStructure.tiles) {
    if (!want.has(t.id)) continue;
    const families = tileFamilies(t, catalog);
    const to = families.find((f) => f.family === family);
    if (!to || to.on) continue;
    const { family: _was, ...rest } = t;
    before.push(t);
    after.push(catalog.get(t.tile)?.familyOf?.family === family ? rest : { ...rest, family });
  }
  if (!before.length) return { error: `No selected piece can change to the ${family} family` };
  return { kind: 'updateTiles', before, after };
}

/**
 * The families a placed set piece's tunnel parts can be drawn in (those every such part comes in), with the one it is
 * drawn in now (its `family`, else its first such part's own); empty for a piece with no tunnel parts.
 */
export function setPieceFamilies(doc: MapDocument, placement: SetPiecePlacement, catalog: TileCatalog = coreCatalog): { family: string; label: string; on: boolean }[] {
  const def = doc.setPieceDefs?.find((d) => d.id === placement.piece) ?? builtInSetPieces().pieces.get(placement.piece);
  const parts = (def?.parts ?? []).flatMap((p) => (p.kind === 'tile' && catalog.get(p.tile)?.familyOf ? [p.tile] : []));
  if (!parts.length) return [];
  let common: { family: string; label: string }[] | null = null;
  for (const tile of parts) {
    const list = catalog.familiesOf(tile).map((d) => ({ family: d.familyOf!.family, label: d.familyOf!.label }));
    common = common ? common.filter((f) => list.some((g) => g.family === f.family)) : list;
  }
  const now = placement.family && common!.some((f) => f.family === placement.family) ? placement.family : catalog.get(parts[0]!)!.familyOf!.family;
  return common!.map((f) => ({ ...f, on: f.family === now }));
}

/**
 * Draw the given set pieces' tunnel parts in a family (map format v44; one undo step). Pieces that don't come in it,
 * and those already in it, are left alone. A piece set back to its parts' own family loses the field.
 */
export function setPieceFamilyCommand(doc: MapDocument, pieceIds: readonly string[], family: string, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const want = new Set(pieceIds);
  const before: SetPiecePlacement[] = [];
  const after: SetPiecePlacement[] = [];
  for (const p of doc.setPieces ?? []) {
    if (!want.has(p.id)) continue;
    const families = setPieceFamilies(doc, p, catalog);
    const to = families.find((f) => f.family === family);
    if (!to || to.on) continue;
    const { family: _was, ...rest } = p;
    const def = doc.setPieceDefs?.find((d) => d.id === p.piece) ?? builtInSetPieces().pieces.get(p.piece);
    const own = def?.parts.find((q) => q.kind === 'tile' && catalog.get(q.tile)?.familyOf);
    const ownFamily = own?.kind === 'tile' ? catalog.get(own.tile)?.familyOf?.family : undefined;
    before.push(p);
    after.push(ownFamily === family ? rest : { ...rest, family });
  }
  if (!before.length) return { error: `No selected set piece can change to the ${family} family` };
  return { kind: 'updateSetPieces', before, after };
}

/**
 * The Family switch on tiles and set pieces at once (a whole run through a Lit Tunnel Run): one undo step. An error
 * only when nothing would change.
 */
export function setRunFamilyCommand(doc: MapDocument, tileIds: readonly string[], pieceIds: readonly string[], family: string, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const tiles = tileIds.length ? setTileFamilyCommand(doc, tileIds, family, catalog) : null;
  const pieces = pieceIds.length ? setPieceFamilyCommand(doc, pieceIds, family, catalog) : null;
  const cmds = [tiles, pieces].filter((c): c is EditCommand => !!c && !('error' in c));
  if (!cmds.length) return { error: `Nothing selected can change to the ${family} family` };
  return cmds.length === 1 ? cmds[0]! : { kind: 'batch', commands: cmds };
}

/** An end of a buried run that leads to nothing built and isn't walled up: where a portal goes. */
export interface OpenEnd {
  tile: string;
  side: Side;
  /** The empty cell beyond it. */
  x: number;
  y: number;
  z: number;
}

/** The open ends of the given buried pieces (all of the map's when none are given). */
export function openEnds(doc: MapDocument, tileIds?: readonly string[], catalog: TileCatalog = coreCatalog): OpenEnd[] {
  const { cells } = buildOccupancy(asBuilt(doc, catalog), catalog);
  const { cellSize, levelHeight } = doc.classicStructure;
  const want = tileIds ? new Set(tileIds) : null;
  const out: OpenEnd[] = [];
  for (const [key, occ] of cells) {
    // (A portal's own mouth is no open end: it is the way out. Nor are steps down from the surface.)
    if (!occ.def.bore || occ.def.bore.open || occ.def.bore.sky || (want && !want.has(occ.placement.id))) continue;
    const [x, y, z] = key.split(',').map(Number) as [number, number, number];
    for (const side of portSides(occ)) {
      const [dx, dy] = SIDE_DIRS[side];
      if (cells.has(cellKey(x + dx, y + dy, z)) || walledUp(cells, x, y, z, side, cellSize, levelHeight)) continue;
      out.push({ tile: occ.placement.id, side, x: x + dx, y: y + dy, z });
    }
  }
  return out;
}

/** The portal that goes on a buried piece: the tunnel kit's, in the piece's family, or the vaulted Tunnel Portal. */
function portalFor(placement: TilePlacement, catalog: TileCatalog): { tile: string; family?: string } | null {
  const def = catalog.get(placement.tile);
  if (!def?.bore) return null;
  if (!def.familyOf) return catalog.get('core.tunnel_portal') ? { tile: 'core.tunnel_portal' } : null;
  // The kit's portal shape, of the same kit (its first family's id prefix).
  return kitShape(def, placement, 'portal', catalog);
}

/**
 * A shape of the tunnel kit for a placed kit piece, in that piece's family: its base tile (`<kit>_<shape>`) and the
 * family when it isn't the base's own.
 */
function kitShape(def: NonNullable<ReturnType<TileCatalog['get']>>, placement: TilePlacement, shape: string, catalog: TileCatalog): { tile: string; family?: string } | null {
  const drawn = catalog.drawn(placement)!;
  const prefix = def.familyOf!.base.slice(0, def.familyOf!.base.lastIndexOf('_'));
  const portal = catalog.get(`${prefix}_${shape}`);
  if (!portal?.familyOf || portal.familyOf.base !== portal.id) return null;
  const family = drawn.familyOf!.family;
  return portal.familyOf!.family === family ? { tile: portal.id } : { tile: portal.id, family };
}

/**
 * A portal on every open end of the given buried pieces (all of the map's when none are given), turned to face out,
 * in the piece's own family: one undo step. An error when there is no open end.
 */
export function addPortalsCommand(doc: MapDocument, tileIds?: readonly string[], catalog: TileCatalog = coreCatalog): { command: EditCommand; placed: TilePlacement[] } | { error: string } {
  const ends = openEnds(doc, tileIds, catalog);
  if (!ends.length) return { error: 'No open end to put a portal on (every end is joined, walled up or already a mouth)' };
  const byId = new Map(asBuilt(doc, catalog).classicStructure.tiles.map((t) => [t.id, t]));
  const taken = new Set<string>();
  const placed: TilePlacement[] = [];
  for (const end of ends) {
    const key = cellKey(end.x, end.y, end.z);
    const portal = portalFor(byId.get(end.tile)!, catalog);
    if (!portal || taken.has(key)) continue;
    taken.add(key);
    // The portal's tunnel side is its north: turned so that faces back at the piece.
    const rotation = ((SIDES.indexOf(end.side) + 2) % 4) as Rotation;
    placed.push({ id: newId('tile'), tile: portal.tile, x: end.x, y: end.y, z: end.z, rotation, ...(portal.family ? { family: portal.family } : {}) });
  }
  if (!placed.length) return { error: 'No portal fits these ends' };
  return { command: { kind: 'addTiles', tiles: placed }, placed };
}

/**
 * "Close open ends": a Dead End on every open end of the given buried pieces (all of the map's when none are given),
 * turned so its passage faces back at the piece, in the piece's own family: one undo step. Ends of the vaulted
 * tunnels have no Dead End shape and are left (wall them up with Sides). An error when there is nothing to close.
 */
export function closeOpenEndsCommand(doc: MapDocument, tileIds?: readonly string[], catalog: TileCatalog = coreCatalog): { command: EditCommand; placed: TilePlacement[] } | { error: string } {
  const ends = openEnds(doc, tileIds, catalog);
  if (!ends.length) return { error: 'No open end to close (every end is joined, walled up or a mouth)' };
  const byId = new Map(asBuilt(doc, catalog).classicStructure.tiles.map((t) => [t.id, t]));
  const taken = new Set<string>();
  const placed: TilePlacement[] = [];
  for (const end of ends) {
    const key = cellKey(end.x, end.y, end.z);
    const from = byId.get(end.tile)!;
    const def = catalog.get(from.tile);
    const shape = def?.familyOf ? kitShape(def, from, 'end', catalog) : null;
    if (!shape || taken.has(key)) continue;
    taken.add(key);
    // The Dead End's passage runs south: turned so that faces back at the piece.
    const rotation = SIDES.indexOf(end.side) as Rotation;
    placed.push({ id: newId('tile'), tile: shape.tile, x: end.x, y: end.y, z: end.z, rotation, ...(shape.family ? { family: shape.family } : {}) });
  }
  if (!placed.length) return { error: 'No Dead End fits these ends (the vaulted tunnels have none: wall them up with Sides)' };
  return { command: { kind: 'addTiles', tiles: placed }, placed };
}
