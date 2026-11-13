import { coreCatalog, type TileCatalog } from './catalog.ts';
import { rotateSide, rotateXZ } from './geometry.ts';
import { SIDE_DIRS } from './tileOptions.ts';
import type { MapDocument } from './schema.ts';
import { terrainHeightAt, terrainTriangles, vertexY, type TerrainData } from './terrain.ts';

/**
 * Ground over a tunnel (Tileset 04 step 1; docs/map-briefs/tunnels/PLAN_2026-11-13.md).
 *
 * The terrain is a height grid: one height a point, no holes. A tunnel piece that says so (TileDefinition.bore) keeps
 * the ground it is buried in:
 *
 *  - **Cuts** (`bore.cut`, boxes in the tile's frame): the part of the ground's surface inside a cut box is taken out
 *    of the surface: of what is drawn, of the collision mesh and of what the navmesh is built from. Ground above the
 *    box stays (the hill over the tunnel), ground below it stays (a tunnel on a bank), and ground outside its footprint
 *    is untouched and meets the piece's own masonry. The cut is exact (the surface's triangles are clipped to the box),
 *    not whole grid squares, so no gap opens beside the piece.
 *  - **Openings** (`bore.open`, boxes whose lower y is the floor): a mouth. The ground over the opening comes down to
 *    just under that floor (every grid square the opening touches), and beyond it rises no steeper than MOUTH_BANK:
 *    a cutting with banks, as wide as the hill is high there. With `bore.out` (the side the mouth faces) the cutting
 *    runs on that way until the ground as made is down to the floor (daylight). It only ever lowers ground.
 *
 * Neither is stored. Like the ground kept under floors (settle.ts terrainUnderFloors), both are worked out from the
 * map's tiles and its ground as made every time the map is loaded or shown, so a tunnel that moves takes its mouth
 * with it and the hill comes back. A map's file keeps the hill as the map maker made it.
 */
export interface GroundCut {
  min: [number, number, number];
  max: [number, number, number];
}

/** A mouth: the rectangle (world X/Z) open to the sky, and the floor the ground comes down to. */
export interface GroundOpening {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  /** The way out of the mouth (a unit step in X/Z), when the piece says: the cutting runs on that way to daylight. */
  out?: [number, number];
}

export interface GroundBores {
  cuts: GroundCut[];
  openings: GroundOpening[];
  /** The placements that bore (their floors don't pull the ground down: settle.ts terrainUnderFloors). */
  tiles: Set<string>;
}

/** The steepest the banks of a mouth's cutting rise (rise over run): 56°, too steep to walk, so a mouth is entered by its floor. */
export const MOUTH_BANK = 1.5;
/** How far under an opening's floor its ground lies (as open ground meets any floor's edge: settle.ts). */
const UNDER_FLOOR = 0.05;
/** A mouth's cutting runs out until the ground as made is no more than this over its floor (daylight), */
const DAYLIGHT = 0.25;
/** or this far (m): a mouth facing rising ground can't be dug out for ever (validate-map reports it). */
export const MOUTH_CUTTING_MAX = 48;

/**
 * An opening run out to daylight: its rectangle stretched the way out of the mouth until the ground as made, across
 * its width, is down to its floor (or MOUTH_CUTTING_MAX, or the terrain's edge). The same opening when it has no way out.
 */
function toDaylight(t: TerrainData, o: GroundOpening): GroundOpening {
  if (!o.out) return o;
  const [dx, dz] = o.out;
  const step = t.spacing / 2;
  // Across the mouth: its width, sampled at the grid's own fineness.
  const across: number[] = [];
  const [a0, a1] = dx ? [o.z0, o.z1] : [o.x0, o.x1];
  for (let a = a0; a < a1; a += step) across.push(a);
  across.push(a1);
  const edge = dx > 0 ? o.x1 : dx < 0 ? o.x0 : dz > 0 ? o.z1 : o.z0;
  let run = 0;
  while (run < MOUTH_CUTTING_MAX) {
    const at = edge + (dx + dz) * (run + step);
    let high = -Infinity;
    let on = false;
    for (const a of across) {
      const h = dx ? terrainHeightAt(t, at, a) : terrainHeightAt(t, a, at);
      if (h === null) continue;
      on = true;
      high = Math.max(high, h);
    }
    if (!on || high <= o.y + DAYLIGHT) break;
    run += step;
  }
  if (!run) return o;
  return { ...o, x0: dx < 0 ? o.x0 - run : o.x0, x1: dx > 0 ? o.x1 + run : o.x1, z0: dz < 0 ? o.z0 - run : o.z0, z1: dz > 0 ? o.z1 + run : o.z1 };
}

const NONE: GroundBores = { cuts: [], openings: [], tiles: new Set() };
const cache = new WeakMap<readonly unknown[], { catalog: TileCatalog; cellSize: number; levelHeight: number; bores: GroundBores }>();

/** The cuts and openings of a map's tiles (its set pieces expanded), cached on its tile list. */
export function mapGroundBores(map: Pick<MapDocument, 'classicStructure'>, catalog: TileCatalog = coreCatalog): GroundBores {
  const { tiles, cellSize, levelHeight } = map.classicStructure;
  const hit = cache.get(tiles);
  if (hit && hit.catalog === catalog && hit.cellSize === cellSize && hit.levelHeight === levelHeight) return hit.bores;
  let bores = NONE;
  for (const p of tiles) {
    const bore = catalog.get(p.tile)?.bore;
    if (!bore) continue;
    if (bores === NONE) bores = { cuts: [], openings: [], tiles: new Set() };
    bores.tiles.add(p.id);
    const cx = p.x * cellSize;
    const cz = p.y * cellSize;
    const baseY = p.z * levelHeight;
    const world = (b: readonly number[]) => {
      const [ax, az] = rotateXZ(b[0]!, b[2]!, p.rotation);
      const [bx, bz] = rotateXZ(b[3]!, b[5]!, p.rotation);
      return { x0: cx + Math.min(ax, bx), x1: cx + Math.max(ax, bx), z0: cz + Math.min(az, bz), z1: cz + Math.max(az, bz), y0: baseY + b[1]!, y1: baseY + b[4]! };
    };
    for (const b of bore.cut ?? []) {
      const w = world(b);
      bores.cuts.push({ min: [w.x0, w.y0, w.z0], max: [w.x1, w.y1, w.z1] });
    }
    for (const b of bore.open ?? []) {
      const w = world(b);
      const out = bore.out ? SIDE_DIRS[rotateSide(bore.out, p.rotation)] : null;
      bores.openings.push({ x0: w.x0, z0: w.z0, x1: w.x1, z1: w.z1, y: w.y0, ...(out ? { out: [out[0], out[1]] as [number, number] } : {}) });
    }
  }
  cache.set(tiles, { catalog, cellSize, levelHeight, bores });
  return bores;
}

/** A short text that changes when a map's cuts do (MapMaker redraws the ground on it). */
export function groundCutsKey(cuts: readonly GroundCut[]): string {
  return cuts.length ? cuts.map((c) => `${c.min.join(',')},${c.max.join(',')}`).join(';') : '';
}

export type P3 = [number, number, number];

/** The part of a convex polygon where `sign × (p[axis] − at) ≥ 0` (Sutherland–Hodgman; the order of its points is kept). */
function clipHalf(poly: readonly P3[], axis: 0 | 1 | 2, at: number, sign: 1 | -1): P3[] {
  const out: P3[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const da = sign * (a[axis] - at);
    const db = sign * (b[axis] - at);
    if (da >= 0) out.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const u = da / (da - db);
      const p: P3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      // Exactly on the plane, so the two sides of a cut share the point.
      p[axis] = at;
      out.push(p);
    }
  }
  return out;
}

/** Twice a polygon's area seen from above (it lies on the ground: no overhangs). */
function planArea2(poly: readonly P3[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j]![0] * poly[i]![2] - poly[i]![0] * poly[j]![2];
  return Math.abs(a);
}

const MIN_AREA2 = 1e-6;
const real = (poly: readonly P3[]): boolean => poly.length >= 3 && planArea2(poly) > MIN_AREA2;

/**
 * A convex polygon of the ground's surface with the part inside `cut` taken out: the pieces that are left (convex,
 * wound as the polygon was), or the polygon itself (the same array) when the cut doesn't reach its surface.
 */
function cutOne(poly: readonly P3[], cut: GroundCut): readonly (readonly P3[])[] {
  let inside: readonly P3[] = poly;
  const outside: P3[][] = [];
  const sides: [0 | 2, number, 1 | -1][] = [
    [0, cut.min[0], -1],
    [0, cut.max[0], 1],
    [2, cut.min[2], -1],
    [2, cut.max[2], 1],
  ];
  for (const [axis, at, sign] of sides) {
    const out = clipHalf(inside, axis, at, sign);
    if (real(out)) outside.push(out);
    inside = clipHalf(inside, axis, at, sign === 1 ? -1 : 1);
    if (!real(inside)) return [poly];
  }
  // The part over the cut's footprint: what is above the box and what is below it stay.
  let low = Infinity;
  let high = -Infinity;
  for (const p of inside) {
    low = Math.min(low, p[1]);
    high = Math.max(high, p[1]);
  }
  if (low >= cut.max[1] || high <= cut.min[1]) return [poly];
  const above = clipHalf(inside, 1, cut.max[1], 1);
  if (real(above)) outside.push(above);
  const below = clipHalf(inside, 1, cut.min[1], -1);
  if (real(below)) outside.push(below);
  return outside;
}

/** A convex polygon of the ground's surface with every cut taken out of it: `[poly]` itself when none reaches it. */
export function cutGroundPolygon(poly: readonly P3[], cuts: readonly GroundCut[]): readonly (readonly P3[])[] {
  let pieces: readonly (readonly P3[])[] = [poly];
  for (const cut of cuts) {
    let next: (readonly P3[])[] | null = null;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]!;
      const got = cutOne(piece, cut);
      if (got.length === 1 && got[0] === piece) {
        next?.push(piece);
        continue;
      }
      next ??= pieces.slice(0, i);
      next.push(...got);
    }
    if (next) pieces = next;
  }
  return pieces;
}

/**
 * The grid squares of a terrain that cuts may reach (their footprints overlap, and the square's heights reach into
 * the cut's), each with those cuts: the squares to clip, a few dozen on a map with tunnels. Keyed r × (cols − 1) + c.
 */
export function cutCells(t: TerrainData, cuts: readonly GroundCut[]): Map<number, GroundCut[]> {
  const out = new Map<number, GroundCut[]>();
  const s = t.spacing;
  for (const cut of cuts) {
    const c0 = Math.max(0, Math.floor((cut.min[0] - t.origin[0]) / s));
    const c1 = Math.min(t.cols - 2, Math.ceil((cut.max[0] - t.origin[0]) / s) - 1);
    const r0 = Math.max(0, Math.floor((cut.min[2] - t.origin[1]) / s));
    const r1 = Math.min(t.rows - 2, Math.ceil((cut.max[2] - t.origin[1]) / s) - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const h = [vertexY(t, c, r), vertexY(t, c + 1, r), vertexY(t, c, r + 1), vertexY(t, c + 1, r + 1)];
        if (Math.min(...h) >= cut.max[1] || Math.max(...h) <= cut.min[1]) continue;
        const k = r * (t.cols - 1) + c;
        const list = out.get(k);
        if (list) list.push(cut);
        else out.set(k, [cut]);
      }
    }
  }
  return out;
}

/**
 * What is left of grid square (c, r) after the cuts: convex pieces wound like the ground's own two triangles
 * (00-01-11 and 00-11-10, counter-clockwise from above), or null when no cut reaches the square's surface.
 */
export function cutCellPieces(t: TerrainData, c: number, r: number, cuts: readonly GroundCut[]): (readonly P3[])[] | null {
  const x0 = t.origin[0] + c * t.spacing;
  const z0 = t.origin[1] + r * t.spacing;
  const x1 = x0 + t.spacing;
  const z1 = z0 + t.spacing;
  const p00: P3 = [x0, vertexY(t, c, r), z0];
  const p10: P3 = [x1, vertexY(t, c + 1, r), z0];
  const p01: P3 = [x0, vertexY(t, c, r + 1), z1];
  const p11: P3 = [x1, vertexY(t, c + 1, r + 1), z1];
  const a: P3[] = [p00, p01, p11];
  const b: P3[] = [p00, p11, p10];
  const pa = cutGroundPolygon(a, cuts);
  const pb = cutGroundPolygon(b, cuts);
  if (pa.length === 1 && pa[0] === a && pb.length === 1 && pb[0] === b) return null;
  return [...pa, ...pb];
}

/** Whether the ground's surface at (x, z), `y` high, has been cut away there. */
export function groundCutAt(cuts: readonly GroundCut[], x: number, y: number, z: number): boolean {
  for (const c of cuts) if (x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && y > c.min[1] && y < c.max[1]) return true;
  return false;
}

/** Whether (x, z) is over a cut's footprint or within `margin` of one (bots there make the exact move: Match.relaxedMove). */
export function nearGroundCut(cuts: readonly GroundCut[], x: number, z: number, margin = 0): boolean {
  for (const c of cuts) if (x > c.min[0] - margin && x < c.max[0] + margin && z > c.min[2] - margin && z < c.max[2] + margin) return true;
  return false;
}

/**
 * The ground opened at the mouths: every vertex of a grid square an opening touches comes down to just under the
 * opening's floor, and vertices beyond come down to a bank rising MOUTH_BANK from the opening's edge. Only lowers;
 * the same terrain when nothing changed.
 */
export function openGroundAtMouths(t: TerrainData, openings: readonly GroundOpening[]): TerrainData {
  let heights: number[] | null = null;
  const s = t.spacing;
  for (const mouth of openings) {
    // (Daylight is looked for on the ground as made, so two mouths near each other don't depend on their order.)
    const o = toDaylight(t, mouth);
    const floor = o.y - UNDER_FLOOR;
    // The grid squares the opening touches: their vertices lie flat.
    const fc0 = Math.floor((o.x0 - t.origin[0]) / s + 1e-9);
    const fc1 = Math.ceil((o.x1 - t.origin[0]) / s - 1e-9);
    const fr0 = Math.floor((o.z0 - t.origin[1]) / s + 1e-9);
    const fr1 = Math.ceil((o.z1 - t.origin[1]) / s - 1e-9);
    if (fc1 < 0 || fr1 < 0 || fc0 > t.cols - 1 || fr0 > t.rows - 1) continue;
    // How far the banks can reach: the highest ground over the floor, at MOUTH_BANK.
    let top = -Infinity;
    for (const h of t.heights) if (h > top) top = h;
    const reach = Math.max(0, t.baseY + top / 100 - floor) / MOUTH_BANK + s;
    const c0 = Math.max(0, Math.floor((o.x0 - reach - t.origin[0]) / s));
    const c1 = Math.min(t.cols - 1, Math.ceil((o.x1 + reach - t.origin[0]) / s));
    const r0 = Math.max(0, Math.floor((o.z0 - reach - t.origin[1]) / s));
    const r1 = Math.min(t.rows - 1, Math.ceil((o.z1 + reach - t.origin[1]) / s));
    for (let r = r0; r <= r1; r++) {
      const z = t.origin[1] + r * s;
      for (let c = c0; c <= c1; c++) {
        const x = t.origin[0] + c * s;
        const flat = c >= fc0 && c <= fc1 && r >= fr0 && r <= fr1;
        // From the flat squares' edge, so the bank starts where the flat ground ends.
        const dx = Math.max(t.origin[0] + fc0 * s - x, 0, x - (t.origin[0] + fc1 * s));
        const dz = Math.max(t.origin[1] + fr0 * s - z, 0, z - (t.origin[1] + fr1 * s));
        const want = Math.floor(((flat ? floor : floor + MOUTH_BANK * Math.hypot(dx, dz)) - t.baseY) * 100);
        const i = r * t.cols + c;
        if ((heights ?? t.heights)[i]! > want) {
          heights ??= [...t.heights];
          heights[i] = want;
        }
      }
    }
  }
  return heights ? { ...t, heights } : t;
}

/**
 * The terrain's triangle mesh (physics and navigation: terrain.ts terrainTriangles) with the cuts taken out: the grid's
 * own vertices and triangles everywhere else, and each cut square's remaining pieces on vertices of their own.
 */
export function terrainTrianglesCut(t: TerrainData, cuts: readonly GroundCut[]): { positions: Float32Array; indices: Uint32Array } {
  const grid = terrainTriangles(t);
  const cells = cuts.length ? cutCells(t, cuts) : null;
  if (!cells?.size) return grid;
  const extra: number[] = [];
  const tris: number[] = [];
  const gone = new Set<number>();
  let next = t.cols * t.rows;
  for (const [k, list] of cells) {
    const c = k % (t.cols - 1);
    const r = (k - c) / (t.cols - 1);
    const pieces = cutCellPieces(t, c, r, list);
    if (!pieces) continue;
    gone.add(k);
    for (const poly of pieces) {
      const first = next;
      for (const p of poly) extra.push(p[0], p[1], p[2]);
      next += poly.length;
      for (let i = 1; i < poly.length - 1; i++) tris.push(first, first + i, first + i + 1);
    }
  }
  if (!gone.size) return grid;
  const positions = new Float32Array(grid.positions.length + extra.length);
  positions.set(grid.positions);
  positions.set(extra, grid.positions.length);
  const indices = new Uint32Array(grid.indices.length - gone.size * 6 + tris.length);
  let o = 0;
  // The grid's triangles are six indices a square, in square order.
  for (let k = 0; k < (t.cols - 1) * (t.rows - 1); k++) {
    if (gone.has(k)) continue;
    indices.set(grid.indices.subarray(k * 6, k * 6 + 6), o);
    o += 6;
  }
  indices.set(tris, o);
  return { positions, indices };
}
