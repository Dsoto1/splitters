import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import type { MapDocument } from '../map/schema.ts';
import type { SetPieceLibrary } from '../map/setPieces.ts';
import type { EditCommand } from './commands.ts';
import { rotateCommand, yawStep, type Selection } from './operations.ts';

/**
 * Turning by mouse (MapMaker overhaul Phase 3, item 9): the rotate ring on the selection gizmo and the inspector's
 * quick facings. Both turn through rotateCommand (its `angle`), so a drag or a click is one undo step, turning the
 * selection about its centre exactly as R does.
 */

const QUARTER = Math.PI / 2;

/**
 * The ring's step for a selection: the selected thing's own step (yawStep, the same as R; `fine`: Shift's finer
 * step). Tiles, set pieces, zones and liquids keep to quarter turns, even with Shift. Several things: the coarsest of
 * their steps, so each lands on a turn its own R could reach.
 */
export function ringStep(doc: MapDocument, sel: Selection, fine = false): number {
  if (sel.tiles.length || (sel.setPieces?.length ?? 0) > 0) return QUARTER;
  const ids = new Set(sel.entities);
  const kinds = new Set(doc.entities.filter((e) => ids.has(e.id)).map((e) => e.kind));
  if (!kinds.size) return QUARTER;
  if (kinds.has('zone') || kinds.has('water')) return QUARTER;
  return Math.max(...[...kinds].map((k) => yawStep(k, fine)));
}

/** The facing of the direction from `center` to `point` on the ground (radians, 0 along +Z, as yaw is everywhere). */
export function yawToward(center: { x: number; z: number }, point: { x: number; z: number }): number {
  return Math.atan2(point.x - center.x, point.z - center.z);
}

/** A drag's turn (radians, any size) snapped to whole steps, in (-π, π]. A step of 0 leaves it free. */
export function snapTurn(turn: number, step: number): number {
  const t = normalizeTurn(turn);
  if (step <= 0) return t;
  return normalizeTurn(Math.round(t / step) * step);
}

/** An angle in (-π, π], unrounded. */
export function normalizeTurn(a: number): number {
  let y = a % (Math.PI * 2);
  if (y > Math.PI) y -= Math.PI * 2;
  if (y <= -Math.PI) y += Math.PI * 2;
  return Math.abs(y) < 1e-12 ? 0 : y;
}

/** A turn in whole degrees for the ring's label: "+45°", "-90°", "0°". */
export function turnLabel(turn: number): string {
  const d = Math.round((normalizeTurn(turn) * 180) / Math.PI);
  return `${d > 0 ? '+' : ''}${d}°`;
}

/** The ring's command: turn the selection by `turn` (radians) about its centre, or an error (nothing to do: no turn). */
export function turnByCommand(doc: MapDocument, sel: Selection, turn: number, catalog: TileCatalog = coreCatalog, library?: SetPieceLibrary): EditCommand | { error: string } {
  const t = normalizeTurn(turn);
  if (Math.abs(t) < 1e-9) return { error: 'no turn' };
  return rotateCommand(doc, sel, catalog, { angle: t, ...(library ? { library } : {}) });
}

/** The facing of one selected thing (radians), or null when the selection isn't one thing with a facing. */
export function facingOf(doc: MapDocument, sel: Selection): number | null {
  const n = sel.tiles.length + sel.entities.length + (sel.setPieces?.length ?? 0);
  if (n !== 1) return null;
  if (sel.tiles.length) {
    const t = doc.classicStructure.tiles.find((x) => x.id === sel.tiles[0]);
    return t ? t.rotation * QUARTER : null;
  }
  if (sel.setPieces?.length) {
    const p = (doc.setPieces ?? []).find((x) => x.id === sel.setPieces![0]);
    return p ? p.rotation * QUARTER : null;
  }
  const e = doc.entities.find((x) => x.id === sel.entities[0]);
  return e && 'yaw' in e ? e.yaw : null;
}

/** The quick facings: 0°, 90°, 180°, 270°. */
export const QUICK_FACINGS: readonly number[] = [0, 90, 180, 270];

/** Turn one selected thing to face `deg` (a quick facing): one undo step; an error when it already does. */
export function setFacingCommand(doc: MapDocument, sel: Selection, deg: number, catalog: TileCatalog = coreCatalog, library?: SetPieceLibrary): EditCommand | { error: string } {
  const now = facingOf(doc, sel);
  if (now === null) return { error: 'select one thing with a facing' };
  const turn = normalizeTurn((deg * Math.PI) / 180 - now);
  if (Math.abs(turn) < 1e-3) return { error: `already facing ${deg}°` };
  return turnByCommand(doc, sel, turn, catalog, library);
}
