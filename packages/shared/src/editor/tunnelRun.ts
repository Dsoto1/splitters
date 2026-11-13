import { coreCatalog, SIDES, SIDE_DIRS, type Side, type TileCatalog } from '../map/catalog.ts';
import { buildOccupancy, cellKey, edgeSegments, resolveEdge, rotateSide, type CellOccupant } from '../map/geometry.ts';
import type { MapDocument, Rotation, TilePlacement } from '../map/schema.ts';
import { expandSetPieces } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import { newId, type EditCommand } from './commands.ts';

/**
 * MapMaker's tunnel tools (Tileset 04 step 3; docs/map-briefs/tunnels/PLAN_2026-11-13.md): a buried piece's material
 * family (map format v37: the same shape drawn in another family's materials and trim), a whole connected run
 * changed at once, and a portal put on each end of a run that comes out into the ground.
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
  return doc.classicStructure.tiles.filter((t) => seen.has(t.id)).map((t) => t.id);
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
    // (A portal's own mouth is no open end: it is the way out.)
    if (!occ.def.bore || occ.def.bore.open || (want && !want.has(occ.placement.id))) continue;
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
  const drawn = catalog.drawn(placement)!;
  // The kit's portal shape: the base tile whose bore opens the ground, of the same kit (its first family's id prefix).
  const prefix = def.familyOf.base.slice(0, def.familyOf.base.lastIndexOf('_'));
  const portal = catalog.all().find((d) => d.familyOf && d.familyOf.base === d.id && d.bore?.open && d.id.startsWith(`${prefix}_`));
  if (!portal) return null;
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
