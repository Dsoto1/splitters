/**
 * Maps converted from TimeSplitters MapMaker saves (maps/imported/, by
 * packages/server/src/tools/import-timesplitters.ts) stay out of the map list
 * until each one is verified: it validates with no errors and no warnings,
 * bots reach every floor, spawn and pickup, and it looks right in play
 * (docs/IMPORTED_MAPS_AUDIT.md). These are the verified ones; the rest open
 * only with `?imported` (all of them in the Arcade) or `?offline=<id>`.
 */
import type { Side } from './catalog.ts';
import type { Rotation } from './schema.ts';

export const VISIBLE_IMPORTED_MAPS: readonly string[] = ['ts2_clover', 'ts2_core', 'tsfp_archives', 'tsfp_bunker', 'tsfp_stack'];

export function isVisibleImportedMap(id: string): boolean {
  return VISIBLE_IMPORTED_MAPS.includes(id);
}

// ---------------------------------------------------------------- TimeSplitters MapMaker grid conventions
// (tools/import/timesplitters/FORMAT.md 2.2; the decoder tsdecode.py uses the same rules). The save's
// x is our east and its y our north; its quarter turns go counter-clockwise, ours clockwise.

const SIDE_ORDER: readonly Side[] = ['N', 'E', 'S', 'W'];

/** A side of an original piece turned by the save's rotation `rot` (counter-clockwise quarter turns). */
export function tsTurnSide(side: Side, rot: number): Side {
  return SIDE_ORDER[(SIDE_ORDER.indexOf(side) - (rot & 3) + 8) % 4]!;
}

/** Our rotation (clockwise quarter turns) that turns a piece the way the save's `rot` does. */
export function tsRotationToOurs(rot: number): Rotation {
  return ((4 - (rot & 3)) % 4) as Rotation;
}

/**
 * The grid cell of local cell (i, j) of a w × h original piece saved at (x, y) with rotation `rot`:
 * (x, y) is the minimum corner of the turned footprint (odd turns swap w and h).
 */
export function tsFootprintCell(x: number, y: number, rot: number, w: number, h: number, i: number, j: number): [number, number] {
  const r = rot & 3;
  const [dx, dy] = r === 0 ? [i, j] : r === 1 ? [h - 1 - j, i] : r === 2 ? [w - 1 - i, h - 1 - j] : [j, w - 1 - i];
  return [x + dx, y + dy];
}
