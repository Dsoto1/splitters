import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import { buildMapGeometry } from '../map/geometry.ts';
import { expandSetPieces, setPiecePartId, type SetPieceLibrary } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import type { MapDocument } from '../map/schema.ts';
import type { EditCommand } from './commands.ts';
import type { Selection } from './operations.ts';

/**
 * Cut ground to floors (MapMaker's selection menu; docs/BUILDING_KIT.md "Ground and floors"): the ground as made over
 * the selection's floors lowered as the ground as played lowers it near a floor (settle.ts terrainUnderFloors: just
 * under the slab inside it, just under its top on its edges), however deep. The worked-out ground stops at
 * FLOOR_REACH (3 m) so a hill keeps what is buried in it; a tunnel's cut or a sunken yard deeper than that is the
 * map maker's to make, and this makes it in one undo step instead of holding Flatten over it. It only lowers; the
 * cut is the map's own ground from then on (stored, as Flatten's is), and Ctrl+Z gives the hill back.
 */
export function cutGroundToFloorsCommand(
  doc: MapDocument,
  sel: Selection,
  catalog: TileCatalog = coreCatalog,
  library: SetPieceLibrary = builtInSetPieces(),
): { command: EditCommand; vertices: number; deepest: number } | { error: string } {
  const t = doc.terrain;
  if (!t) return { error: 'this map has no terrain' };
  const ids = new Set([...sel.tiles, ...sel.entities]);
  const pieces = sel.setPieces ?? [];
  if (!ids.size && !pieces.length) return { error: 'nothing selected' };
  const mine = (id: string) => ids.has(id) || pieces.some((p) => id.startsWith(setPiecePartId(p, 0).slice(0, -1)));
  const floors = buildMapGeometry(expandSetPieces(doc, library, catalog).map, catalog).filter((b) => b.kind === 'floor' && !b.yaw && !b.pitch && !b.roll && mine(b.sourceId));
  if (!floors.length) return { error: 'the selection has no floors (select tiles, set pieces or blocks with a floor)' };
  const s = t.spacing;
  const cm = (y: number) => Math.floor((y - t.baseY) * 100);
  let heights: number[] | null = null;
  let deepest = 0;
  for (const b of floors.sort((a, c) => c.max[1] - a.max[1])) {
    const top = b.max[1];
    const c0 = Math.max(0, Math.ceil((b.min[0] - 0.01 - t.origin[0]) / s));
    const c1 = Math.min(t.cols - 1, Math.floor((b.max[0] + 0.01 - t.origin[0]) / s));
    const r0 = Math.max(0, Math.ceil((b.min[2] - 0.01 - t.origin[1]) / s));
    const r1 = Math.min(t.rows - 1, Math.floor((b.max[2] + 0.01 - t.origin[1]) / s));
    for (let r = r0; r <= r1; r++) {
      const z = t.origin[1] + r * s;
      const zEdge = z <= b.min[2] + 0.01 || z >= b.max[2] - 0.01;
      for (let c = c0; c <= c1; c++) {
        const x = t.origin[0] + c * s;
        const edge = zEdge || x <= b.min[0] + 0.01 || x >= b.max[0] - 0.01;
        const i = r * t.cols + c;
        const h = (heights ?? t.heights)[i]!;
        const want = cm(edge ? top - 0.05 : Math.min(top - 0.05, b.min[1] - 0.02));
        if (h <= want) continue;
        heights ??= [...t.heights];
        deepest = Math.max(deepest, (h - want) / 100);
        heights[i] = want;
      }
    }
  }
  if (!heights) return { error: 'the ground is already under the selection\'s floors' };
  const vertices = heights.reduce((n, h, i) => n + (h !== t.heights[i] ? 1 : 0), 0);
  return { command: { kind: 'setTerrain', before: t, after: { ...t, heights } }, vertices, deepest: Math.round(deepest * 100) / 100 };
}
