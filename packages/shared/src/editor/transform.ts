import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import type { MapDocument } from '../map/schema.ts';
import type { SetPieceLibrary } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import type { EditCommand } from './commands.ts';
import { selectionIds } from './groups.ts';
import { moveCommand, moveEntitiesCommand, type Selection } from './operations.ts';
import { normalizeTurn, turnByCommand } from './turnRing.ts';

/**
 * The shared transform command (MapMaker UI spec Phase 2; docs/MAPMAKER_UI_AUDIT.md §5). Every way of moving or turning
 * the selection goes through here: the drag, the arrow-key nudges, the rotate ring, the quick facings and the
 * inspector's X / Height / Z, Level and Facing fields. So the same move gives the same result however it is made:
 *
 * - tiles and set pieces move by whole cells and pass the layout check (moveCommand), and what is selected with them
 *   is carried the same distance;
 * - things move through moveEntitiesCommand, so positions are rounded to the millimetre and a prop resting on the
 *   terrain is bedded again where it lands (unless the move is up or down);
 * - it moves and turns the whole selection: a moving build selected whole (the mover with its blocks and props, as a
 *   click selects it) moves and turns as one, where the inspector used to move the mover alone;
 * - turning goes through turnByCommand (rotateCommand's `angle`), as the ring and R do.
 *
 * Each call is one command, so one undo step. It is pure: no editor state, tested headless (shared
 * test/transform.test.ts).
 */

export type Move3 = readonly [number, number, number];

export type Transform =
  /** By whole cells: [east, north, levels] (the arrow keys, a tile drag). Things alone move the same distance in metres. */
  | { by: { cells: Move3 } }
  /** By metres: [x, height, z] (a drag or nudge of things). A selection with tiles or set pieces needs whole cells. */
  | { by: { metres: Move3 } }
  /**
   * One coordinate of `id` typed in the inspector, the rest of the selection carried with it. For a tile or set piece
   * the axes are its cell [x, y, level] (whole numbers); for a thing its position in metres [x, height, z].
   */
  | { set: { id: string; axis: 0 | 1 | 2; value: number } }
  /** Turn by this much (radians) about the selection's centre (the ring; a thing alone turns in place). */
  | { turn: number }
  /** Turn so `id` faces `deg` degrees (the Facing field and the quick facings), the rest turning with it. */
  | { face: { id: string; deg: number } };

const QUARTER = Math.PI / 2;

/** What `id` is, and where: a tile or set piece by its cell, a thing by its position in metres; with its facing. */
function anchorOf(doc: MapDocument, id: string): { grid: boolean; at: Move3; facing: number | null } | null {
  const t = doc.classicStructure.tiles.find((x) => x.id === id);
  if (t) return { grid: true, at: [t.x, t.y, t.z], facing: t.rotation * QUARTER };
  const p = (doc.setPieces ?? []).find((x) => x.id === id);
  if (p) return { grid: true, at: [p.x, p.y, p.z], facing: p.rotation * QUARTER };
  const e = doc.entities.find((x) => x.id === id);
  if (e) return { grid: false, at: e.position, facing: 'yaw' in e ? e.yaw : null };
  return null;
}

/** The selection a field of `id` acts on: the selection when `id` is in it, otherwise `id` alone. */
function around(doc: MapDocument, sel: Selection, id: string): Selection {
  if (selectionIds(sel).includes(id)) return sel;
  if (doc.classicStructure.tiles.some((t) => t.id === id)) return { tiles: [id], entities: [] };
  if ((doc.setPieces ?? []).some((p) => p.id === id)) return { tiles: [], entities: [], setPieces: [id] };
  return { tiles: [], entities: [id] };
}

const mm = (v: number) => Math.round(v * 1000) / 1000;

/** Move the selection by whole cells (tiles, set pieces and what they carry) or by metres (things alone). */
function moveBy(doc: MapDocument, sel: Selection, by: { cells: Move3 } | { metres: Move3 }, catalog: TileCatalog, library: SetPieceLibrary): EditCommand | { error: string } {
  const { cellSize, levelHeight } = doc.classicStructure;
  const grid = sel.tiles.length > 0 || (sel.setPieces?.length ?? 0) > 0;
  let cells: Move3 | null = 'cells' in by ? by.cells : null;
  if (!cells && grid) {
    const [x, y, z] = (by as { metres: Move3 }).metres;
    const c: Move3 = [x / cellSize, z / cellSize, y / levelHeight];
    if (c.some((v) => Math.abs(v - Math.round(v)) > 1e-6)) return { error: 'tiles and set pieces move by whole cells' };
    cells = c.map(Math.round) as unknown as Move3;
  }
  const metres: Move3 = cells ? [cells[0] * cellSize, cells[2] * levelHeight, cells[1] * cellSize] : (by as { metres: Move3 }).metres;
  if (metres.every((v) => Math.abs(v) < 1e-9)) return { error: 'no move' };
  const commands: EditCommand[] = [];
  if (grid && cells) {
    if (cells.some((v) => !Number.isInteger(v))) return { error: 'tiles and set pieces move by whole cells' };
    const layout = moveCommand(doc, { tiles: sel.tiles, entities: [], ...(sel.setPieces ? { setPieces: sel.setPieces } : {}) }, cells[0], cells[1], cells[2], catalog, library);
    if ('error' in layout) return layout;
    commands.push(layout);
  }
  if (sel.entities.length) commands.push(moveEntitiesCommand(doc, sel.entities, metres[0], metres[1], metres[2]));
  if (!commands.length) return { error: 'nothing selected' };
  return commands.length === 1 ? commands[0]! : { kind: 'batch', commands };
}

/** The selection moved or turned (see `Transform`): one command, or why it can't be (the layout check's reason, "no move"). */
export function transformCommand(doc: MapDocument, sel: Selection, t: Transform, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): EditCommand | { error: string } {
  if ('by' in t) return moveBy(doc, sel, t.by, catalog, library);
  if ('turn' in t) return turnByCommand(doc, sel, t.turn, catalog, library);
  const id = 'set' in t ? t.set.id : t.face.id;
  const a = anchorOf(doc, id);
  if (!a) return { error: 'it is not in the map' };
  const s = around(doc, sel, id);
  if ('face' in t) {
    if (a.facing === null) return { error: 'it has no facing' };
    const turn = normalizeTurn((t.face.deg * Math.PI) / 180 - a.facing);
    if (Math.abs(turn) < 1e-3) return { error: `already facing ${t.face.deg}°` };
    return turnByCommand(doc, s, turn, catalog, library);
  }
  const { axis, value } = t.set;
  if (!Number.isFinite(value)) return { error: 'not a number' };
  const d = (a.grid ? Math.round(value) : mm(value)) - a.at[axis];
  if (Math.abs(d) < 1e-9) return { error: 'no move' };
  if (a.grid) return moveBy(doc, s, { cells: [axis === 0 ? d : 0, axis === 1 ? d : 0, axis === 2 ? d : 0] }, catalog, library);
  return moveBy(doc, s, { metres: [axis === 0 ? d : 0, axis === 1 ? d : 0, axis === 2 ? d : 0] }, catalog, library);
}
