import { seededRandom } from '../map/catalog.ts';
import { buildMapDecor, buildMapGeometry, buildOccupancy, breakWallEdges, type BreakWallEdge, type WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import type { OBox } from './scenarioDefs.ts';
import { cachedWindowPanes } from './glass.ts';

/**
 * Breakable walls (format v53; docs/BUILDING_KIT.md, "Breakable walls"): the walls of placed pieces a map maker marked
 * breakable (a tile's `breakWalls`, every tile of a set piece with one). Each is a section: one cell side's wall, or
 * both faces of a wall between two pieces (map/geometry.ts breakWallEdges). Play leaves a section's boxes out of the
 * level's collision and drawing: the scenario collides with them (they go when the wall breaks), and draws them apart.
 * A broken section leaves its remains: stubs at the ends, the part over a hole in a tall wall, ragged teeth round the
 * hole (all colliding), and a little rubble on the floor (drawn only). The server, every predicting client and the
 * renderer build the same list from the map, in the same order, so a section is known everywhere by its place in it:
 * scenario index `map.entities.length + windowPanes(map).length + k` (wallSectionIndex).
 */

export interface WallSection {
  k: number;
  /** Stable name: `<placement id>:wall:<edge>`. */
  id: string;
  edge: BreakWallEdge;
  /** Its wall boxes, as the level would have them (they collide while it stands). */
  boxes: WorldBox[];
  /** Its sides' trim (frames, baseboards): drawn with it, gone with it. */
  trim: WorldBox[];
  /** Everything it is, as one upright box: where blasts reach it and debris flies from. */
  bounds: OBox;
  /** What is left standing once broken: these collide. */
  remains: WorldBox[];
  /** Rubble on the floor once broken: drawn only. */
  rubble: WorldBox[];
  /** Scenario indices of the window panes in it: they shatter with it. */
  glass: number[];
}

/** The hole's height over the wall's foot (m), a little more or less by the wall; a wall lower than HOLE_TOP + LINTEL_MIN loses its whole height. */
const HOLE_TOP = 2.75;
const LINTEL_MIN = 0.45;
/** How much wall stands at each end of the hole (m). */
const STUB = [0.45, 0.95] as const;

export const boxObox = (b: WorldBox): OBox => ({
  center: { x: (b.min[0] + b.max[0]) / 2, y: (b.min[1] + b.max[1]) / 2, z: (b.min[2] + b.max[2]) / 2 },
  half: { x: (b.max[0] - b.min[0]) / 2, y: (b.max[1] - b.min[1]) / 2, z: (b.max[2] - b.min[2]) / 2 },
  yaw: b.yaw ?? 0,
});

/** The sections of a map, in order. `geometry`/`decor`: buildMapGeometry/buildMapDecor of it, when the caller has them. */
export function wallSections(map: MapDocument, geometry?: readonly WorldBox[], decor?: readonly WorldBox[]): WallSection[] {
  if (!map.classicStructure.tiles.some((t) => t.breakWalls)) return [];
  const { sections: edges } = breakWallEdges(map, buildOccupancy(map).cells);
  if (!edges.length) return [];
  const boxes = edges.map(() => [] as WorldBox[]);
  const trim = edges.map(() => [] as WorldBox[]);
  for (const b of geometry ?? buildMapGeometry(map)) if (b.breakWall !== undefined) boxes[b.breakWall]?.push(b);
  for (const b of decor ?? buildMapDecor(map)) if (b.breakWall !== undefined) trim[b.breakWall]?.push(b);
  const panes = cachedWindowPanes(map);
  const base = map.entities.length;
  const { cellSize } = map.classicStructure;
  return edges.map((edge, k) => {
    const own = boxes[k]!;
    const glass: number[] = [];
    panes.forEach((p, i) => {
      const id = p.id.replace(/:\d+$/, '');
      if (edge.glassIds.includes(id) || edge.glassIds.includes(p.id)) glass.push(base + i);
    });
    const id = `${edge.sourceId}:wall:${edge.edge}`;
    const { remains, rubble } = own.length ? wallRemains(id, edge.edge, own, cellSize) : { remains: [], rubble: [] };
    return { k, id, edge, boxes: own, trim: trim[k]!, bounds: own.length ? boundsOf(own) : { center: { x: 0, y: -1e4, z: 0 }, half: { x: 0.01, y: 0.01, z: 0.01 }, yaw: 0 }, remains, rubble, glass };
  });
}

const cache = new WeakMap<MapDocument, WallSection[]>();

/** wallSections, worked out once per map document (documents are replaced, not changed, when edited). */
export function cachedWallSections(map: MapDocument, geometry?: readonly WorldBox[]): WallSection[] {
  let s = cache.get(map);
  if (!s) cache.set(map, (s = wallSections(map, geometry)));
  return s;
}

/** The scenario index of section k (after the entities and the window panes). */
export const wallSectionIndex = (map: MapDocument, k: number): number => map.entities.length + cachedWindowPanes(map).length + k;

/** The section at a scenario index, or null. */
export function wallSectionAt(map: MapDocument, i: number): WallSection | null {
  const k = i - map.entities.length - cachedWindowPanes(map).length;
  if (k < 0) return null;
  return cachedWallSections(map)[k] ?? null;
}

function boundsOf(boxes: readonly WorldBox[]): OBox {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a]!, b.min[a]!);
      max[a] = Math.max(max[a]!, b.max[a]!);
    }
  }
  return boxObox({ min: min as [number, number, number], max: max as [number, number, number], kind: 'wall', sourceId: '' });
}

/**
 * What a broken section leaves: one hole through every face of the wall (the same span for both faces of a wall
 * between two pieces), at the wall's foot, with the wall left at its ends and over the hole in a tall wall, ragged
 * teeth round it, and rubble at its foot. Worked out from the section's name, so it is the same everywhere.
 */
export function wallRemains(id: string, edge: string, boxes: readonly WorldBox[], cellSize: number): { remains: WorldBox[]; rubble: WorldBox[] } {
  const rnd = seededRandom(`breakwall:${id}`);
  const r = (lo: number, hi: number) => lo + (hi - lo) * rnd();
  // The wall's line: along x (an S edge) or along z (a W edge); "across" is the other horizontal axis.
  const [lx, ly] = edge.split(':')[0]!.split(',').map(Number) as [number, number];
  const alongX = edge.endsWith(':S');
  const A = alongX ? 0 : 2;
  const C = alongX ? 2 : 0;
  const line = (alongX ? ly : lx) * cellSize - cellSize / 2;
  // Its faces: the boxes on each side of the line.
  const faces = [boxes.filter((b) => (b.min[C]! + b.max[C]!) / 2 >= line), boxes.filter((b) => (b.min[C]! + b.max[C]!) / 2 < line)].filter((f) => f.length);
  const extent = (list: readonly WorldBox[], axis: number) => [Math.min(...list.map((b) => b.min[axis]!)), Math.max(...list.map((b) => b.max[axis]!))] as const;
  const [a0, a1] = extent(boxes, A);
  const [y0] = extent(boxes, 1);
  const s0 = r(STUB[0], STUB[1]);
  const s1 = r(STUB[0], STUB[1]);
  const h0 = Math.min(a0 + s0, (a0 + a1) / 2 - 0.3);
  const h1 = Math.max(a1 - s1, (a0 + a1) / 2 + 0.3);
  const holeTop = y0 + HOLE_TOP + r(-0.15, 0.25);
  const remains: WorldBox[] = [];
  const rubble: WorldBox[] = [];
  const kindOf = boxes[0]!;
  const box = (alo: number, ahi: number, ylo: number, yhi: number, clo: number, chi: number, from: WorldBox): WorldBox => {
    const min: [number, number, number] = [0, ylo, 0];
    const max: [number, number, number] = [0, yhi, 0];
    min[A] = alo;
    max[A] = ahi;
    min[C] = clo;
    max[C] = chi;
    return { min, max, kind: 'wall', sourceId: from.sourceId, ...(from.surface ? { surface: from.surface } : {}), ...(from.paint ? { paint: from.paint } : {}) };
  };
  for (const face of faces) {
    const [fa0, fa1] = extent(face, A);
    const [fy0, fy1] = extent(face, 1);
    const [c0, c1] = extent(face, C);
    const from = face[0] ?? kindOf;
    const top = fy1 - holeTop >= LINTEL_MIN ? holeTop : fy1;
    // The ends, full height.
    if (h0 > fa0 + 0.02) remains.push(box(fa0, Math.min(h0, fa1), fy0, fy1, c0, c1, from));
    if (h1 < fa1 - 0.02) remains.push(box(Math.max(h1, fa0), fa1, fy0, fy1, c0, c1, from));
    // Over the hole.
    if (top < fy1) remains.push(box(Math.max(h0, fa0), Math.min(h1, fa1), top, fy1, c0, c1, from));
  }
  // Ragged teeth (the same for every face, so the hole goes clean through): from the ends into the hole, and down from
  // over it. A tooth is a little shallower than the wall, so the two faces' teeth read as broken masonry.
  const teeth: [number, number, number, number][] = [];
  for (const [end, dir] of [[h0, 1], [h1, -1]] as const) {
    let y = y0 + r(0.1, 0.5);
    while (y < holeTop - 0.35) {
      const h = r(0.35, 0.9);
      const d = r(0.12, 0.42);
      const y1 = Math.min(y + h, holeTop);
      teeth.push(dir > 0 ? [end, end + d, y, y1] : [end - d, end, y, y1]);
      y = y1 + r(0.15, 0.6);
    }
  }
  const lintel = faces.some((f) => extent(f, 1)[1] - holeTop >= LINTEL_MIN);
  if (lintel) {
    let a = h0 + r(0.1, 0.4);
    while (a < h1 - 0.4) {
      const w = r(0.3, 0.8);
      const d = r(0.12, 0.45);
      teeth.push([a, Math.min(a + w, h1), holeTop - d, holeTop]);
      a += w + r(0.2, 0.7);
    }
  }
  for (const face of faces) {
    const [c0, c1] = extent(face, C);
    const [fy0, fy1] = extent(face, 1);
    const from = face[0] ?? kindOf;
    const inset = (c1 - c0) * 0.15;
    for (const [t0, t1, ty0, ty1] of teeth) {
      if (ty1 > fy1 || ty0 < fy0) continue;
      remains.push(box(t0, t1, ty0, ty1, c0 + inset * rnd(), c1 - inset * rnd(), from));
    }
    // Rubble at the foot of the hole, spilling a little each way.
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = r(h0, h1 - 0.5);
      const w = r(0.25, 0.7);
      const spill = r(0.1, 0.45);
      const h = r(0.1, 0.3);
      rubble.push(box(a, Math.min(a + w, h1), fy0, fy0 + h, c0 - spill, c1 + spill, from));
    }
  }
  return { remains, rubble };
}
