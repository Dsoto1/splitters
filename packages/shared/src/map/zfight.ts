import { coreMaterials } from './materials.ts';
import { coplanarOverlaps, type CoplanarOverlap } from './faces.ts';
import { buildMapDecor, buildMapGeometry, type WorldBox } from './geometry.ts';
import type { MapDocument } from './schema.ts';
import { faceSlot, resolveSurface, styleKey } from './surfaces.ts';
import type { ValidationIssue } from './validate.ts';

/** A coplanar overlap MapMaker points out: two pieces of the map whose faces share a plane and look different. */
export interface CoplanarSpot extends CoplanarOverlap {
  /** The two placements or blocks (tile or entity ids). */
  ids: [string, string];
}

/** The style a box's face draws in (its own material, or the tile's surface for that slot). */
function faceStyle(map: MapDocument, tiles: Map<string, MapDocument['classicStructure']['tiles'][number]>, b: WorldBox, n: readonly [number, number, number]): string {
  if (b.surface && coreMaterials.get(b.surface.material)) return `${b.surface.material}|${b.surface.tint ?? '-'}`;
  return styleKey(resolveSurface(map, tiles.get(b.sourceId), faceSlot(b, n)));
}

/**
 * Coplanar overlaps in what the map draws that its author may want to know about: a free block's
 * face in the same plane as another piece's (a block or a tile), facing the same way, in a
 * different look. The renderer draws only one of them there (visibleFaces' priority), so these
 * never flicker; but one look hides the other, which may not be what was meant. Left out: tiles
 * against tiles (neighbouring rooms share walls by design, the pass sorts those out), overlaps
 * inside one piece (a set piece's parts are one piece: `partOf`, from expandSetPieces, names each
 * part's placement; the author can't move a part on its own), and faces that look the same
 * (nothing shows).
 */
export function coplanarSpots(map: MapDocument, boxes: readonly WorldBox[] = [...buildMapGeometry(map), ...buildMapDecor(map)], partOf: ReadonlyMap<string, string> = new Map()): CoplanarSpot[] {
  const tiles = new Map(map.classicStructure.tiles.map((t) => [t.id, t]));
  const entities = new Set(map.entities.map((e) => e.id));
  const piece = (id: string) => partOf.get(id) ?? id;
  const out: CoplanarSpot[] = [];
  for (const o of coplanarOverlaps(boxes, { minArea: 0.01 })) {
    const a = boxes[o.a]!;
    const b = boxes[o.b]!;
    if (piece(a.sourceId) === piece(b.sourceId) || (!entities.has(a.sourceId) && !entities.has(b.sourceId))) continue;
    const n = [Math.round(o.normal[0]), Math.round(o.normal[1]), Math.round(o.normal[2])] as [number, number, number];
    if (faceStyle(map, tiles, a, n) === faceStyle(map, tiles, b, n)) continue;
    out.push({ ...o, ids: [a.sourceId, b.sourceId] });
  }
  return out;
}

/**
 * MapMaker's warning for coplanar spots: one for the map (there can be hundreds), naming the
 * pair of pieces with the most overlap, which clicking the warning selects.
 */
export function coplanarIssues(map: MapDocument, spots: readonly CoplanarSpot[] = coplanarSpots(map)): ValidationIssue[] {
  if (!spots.length) return [];
  const pairs = new Map<string, { ids: [string, string]; area: number }>();
  for (const s of spots) {
    const key = s.ids.join('|');
    const p = pairs.get(key) ?? { ids: s.ids, area: 0 };
    p.area += s.area;
    pairs.set(key, p);
  }
  const top = [...pairs.values()].sort((a, b) => b.area - a.area)[0]!;
  const entities = new Set(map.entities.map((e) => e.id));
  const name = (id: string) => {
    const tile = map.classicStructure.tiles.find((t) => t.id === id);
    return tile ? `${tile.tile.replace(/^core\./, '')} ${id}` : id;
  };
  const n = spots.length;
  return [
    {
      severity: 'warning',
      code: 'geometry.coplanar',
      message: `${n} place${n > 1 ? 's' : ''} where a block's face lies in the same plane as another piece's, in a different look: only one look shows there (most: ${name(top.ids[0])} and ${name(top.ids[1])}, ${top.area.toFixed(2)} m²). Move one a little or match their materials; Overlaps in the top bar shows where.`,
      targetId: entities.has(top.ids[1]) ? top.ids[1] : top.ids[0],
    },
  ];
}
