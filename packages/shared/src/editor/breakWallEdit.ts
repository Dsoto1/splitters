import { coreCatalog, SIDES, type TileCatalog } from '../map/catalog.ts';
import { edgeKey } from '../map/geometry.ts';
import type { BreakWalls, MapDocument, SetPiecePlacement, TilePlacement } from '../map/schema.ts';
import type { EditCommand } from './commands.ts';

/**
 * MapMaker's breakable walls (format v54; shared sim/breakWalls.ts): the inspector marks every wall of the selected
 * tiles and set pieces breakable (or one side of a tile), sets how much a wall takes, and whether shots break it too.
 * One undo step each.
 */

/** What the selected tiles and set pieces say: how many are marked, of how many, and the first marked one's settings. */
export function breakWallState(doc: MapDocument, tileIds: readonly string[], pieceIds: readonly string[] = []): { on: number; of: number; health?: number; shots: boolean } {
  const t = new Set(tileIds);
  const p = new Set(pieceIds);
  const marks: (Omit<BreakWalls, 'sides'> | undefined)[] = [...doc.classicStructure.tiles.filter((x) => t.has(x.id)).map((x) => x.breakWalls), ...(doc.setPieces ?? []).filter((x) => p.has(x.id)).map((x) => x.breakWalls)];
  const first = marks.find((m) => m);
  return { on: marks.filter((m) => m).length, of: marks.length, ...(first?.health !== undefined ? { health: first.health } : {}), shots: !!first?.shots };
}

/**
 * Every wall of these tiles and set pieces breakable (`value`: their health and shots; a tile keeps no side list), or
 * none (`null`). Or, with `only`, change just the health or shots of those already marked.
 */
export function setBreakWallsCommand(doc: MapDocument, tileIds: readonly string[], pieceIds: readonly string[], value: Omit<BreakWalls, 'sides'> | null, only = false): EditCommand | { error: string } {
  const t = new Set(tileIds);
  const p = new Set(pieceIds);
  const next = <T extends { breakWalls?: unknown }>(x: T, keepSides: boolean): T | null => {
    const had = x.breakWalls as BreakWalls | undefined;
    if (only && !had) return null;
    if (!value) {
      if (!had) return null;
      const { breakWalls: _, ...rest } = x;
      return rest as T;
    }
    const bw: BreakWalls = { ...(keepSides && only && had?.sides ? { sides: had.sides } : {}), ...(value.health !== undefined ? { health: value.health } : {}), ...(value.shots ? { shots: true } : {}) };
    if (JSON.stringify(bw) === JSON.stringify(had)) return null;
    return { ...x, breakWalls: bw };
  };
  const before: TilePlacement[] = [];
  const after: TilePlacement[] = [];
  for (const x of doc.classicStructure.tiles) {
    if (!t.has(x.id)) continue;
    const n = next(x, true);
    if (n) before.push(x), after.push(n);
  }
  const pb: SetPiecePlacement[] = [];
  const pa: SetPiecePlacement[] = [];
  for (const x of doc.setPieces ?? []) {
    if (!p.has(x.id)) continue;
    const n = next(x, false);
    if (n) pb.push(x), pa.push(n);
  }
  if (!before.length && !pb.length) return { error: value ? 'Nothing to change' : 'No breakable walls selected' };
  const commands: EditCommand[] = [];
  if (before.length) commands.push({ kind: 'updateTiles', before, after });
  if (pb.length) commands.push({ kind: 'updateSetPieces', before: pb, after: pa });
  return commands.length === 1 ? commands[0]! : { kind: 'batch', commands };
}

/** A tile's own sides (tile-local edge keys) of each of its cells. */
export function tileSideKeys(t: Pick<TilePlacement, 'tile'>, catalog: TileCatalog = coreCatalog): string[] {
  const def = catalog.get(t.tile);
  return def ? def.cells.flatMap((c) => SIDES.map((s) => edgeKey(c, s))) : [];
}

/** Whether one side of a tile (its tile-local edge key) is marked breakable. */
export const sideBreaks = (t: Pick<TilePlacement, 'breakWalls'>, key: string): boolean => !!t.breakWalls && (!t.breakWalls.sides || t.breakWalls.sides.includes(key));

/** One side of a tile breakable or not (the rest as they were; every side on again needs no list). */
export function setBreakSideCommand(doc: MapDocument, tileId: string, key: string, on: boolean, catalog: TileCatalog = coreCatalog): EditCommand | { error: string } {
  const t = doc.classicStructure.tiles.find((x) => x.id === tileId);
  if (!t) return { error: 'No such tile' };
  if (sideBreaks(t, key) === on) return { error: 'Nothing to change' };
  const all = tileSideKeys(t, catalog);
  const now = new Set(t.breakWalls ? (t.breakWalls.sides ?? all) : []);
  if (on) now.add(key);
  else now.delete(key);
  const { breakWalls: had, ...rest } = t;
  const settings = { ...(had?.health !== undefined ? { health: had.health } : {}), ...(had?.shots ? { shots: true } : {}) };
  const sides = all.filter((k) => now.has(k));
  const next: TilePlacement = !sides.length ? rest : { ...rest, breakWalls: { ...(sides.length === all.length ? {} : { sides }), ...settings } };
  return { kind: 'updateTiles', before: [t], after: [next] };
}
