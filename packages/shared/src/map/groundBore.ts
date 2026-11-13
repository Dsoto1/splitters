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
 *  - **Rims** (`bore.rim`) and **covers** (`bore.cover`): the earth brought to the piece, up or down, so no wall of a
 *    buried piece stands bare and no hill overhangs a wing wall: the ground along a rim line goes to the rim's height
 *    (a wing wall's sloping top, a headwall's coping), and over a cover it is at least the cover's height (earth over
 *    the cap). See shapeGroundAtBores.
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

/**
 * A rim: a line the ground is brought to (a wing wall's top, a headwall's coping). Vertices within a grid square of the
 * line, either side of it, go to its height (`both`), or up to it (`raise`), or down to it (`lower`); further out the
 * ground may differ from it by MOUTH_BANK a metre. Only square across the line counts, never past its ends.
 */
export interface GroundRim {
  x0: number;
  z0: number;
  y0: number;
  x1: number;
  z1: number;
  y1: number;
  mode: 'both' | 'raise' | 'lower';
}

/** Cover: over the rectangle the ground is at least `y` high (earth over a buried piece), falling away outside at COVER_BANK. */
export interface GroundCover {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
}

export interface GroundBores {
  cuts: GroundCut[];
  openings: GroundOpening[];
  rims: GroundRim[];
  covers: GroundCover[];
  /** The placements that bore (their floors don't pull the ground down: settle.ts terrainUnderFloors). */
  tiles: Set<string>;
}

/** The steepest the banks of a mouth's cutting rise (rise over run): 56°, too steep to walk, so a mouth is entered by its floor. */
export const MOUTH_BANK = 1.5;
/** How steeply earth brought up to a buried piece falls away (a cover's mound, the berm at a rim): 35°, a slope players and bots walk, so a buried tunnel can be crossed over its top. */
export const COVER_BANK = 0.7;
/** How far under an opening's floor its ground lies (as open ground meets any floor's edge: settle.ts). */
const UNDER_FLOOR = 0.05;
/**
 * The way in to a mouth: level with its floor for MOUTH_LANDING metres out from its edge, then rising at MOUTH_RAMP
 * (19°, a slope players, bots and wheels take) until it meets the ground as made. So a mouth in a hillside gets a
 * short level cutting, and a mouth a level under flat ground gets an earth ramp down to it (11 m for 4 m of depth plus
 * the landing), not a trench with no way out.
 */
export const MOUTH_LANDING = 2;
export const MOUTH_RAMP = 0.35;
/** How high the way in is over the mouth's floor, `out` metres from the mouth's edge. */
export const mouthRamp = (out: number): number => Math.max(0, out - MOUTH_LANDING) * MOUTH_RAMP;
/** A mouth's cutting runs out until the ground as made is no more than this over the way in (daylight), */
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
    if (!on || high <= o.y + DAYLIGHT + mouthRamp(run + step)) break;
    run += step;
  }
  if (!run) return o;
  return { ...o, x0: dx < 0 ? o.x0 - run : o.x0, x1: dx > 0 ? o.x1 + run : o.x1, z0: dz < 0 ? o.z0 - run : o.z0, z1: dz > 0 ? o.z1 + run : o.z1 };
}

const NONE: GroundBores = { cuts: [], openings: [], rims: [], covers: [], tiles: new Set() };
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
    if (bores === NONE) bores = { cuts: [], openings: [], rims: [], covers: [], tiles: new Set() };
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
    for (const r of bore.rim ?? []) {
      const [ax, az] = rotateXZ(r.line[0]!, r.line[1]!, p.rotation);
      const [bx, bz] = rotateXZ(r.line[2]!, r.line[3]!, p.rotation);
      bores.rims.push({ x0: cx + ax, z0: cz + az, y0: baseY + r.y[0]!, x1: cx + bx, z1: cz + bz, y1: baseY + r.y[1]!, mode: r.mode });
    }
    for (const c of bore.cover ?? []) {
      const [ax, az] = rotateXZ(c[0]!, c[1]!, p.rotation);
      const [bx, bz] = rotateXZ(c[2]!, c[3]!, p.rotation);
      bores.covers.push({ x0: cx + Math.min(ax, bx), z0: cz + Math.min(az, bz), x1: cx + Math.max(ax, bx), z1: cz + Math.max(az, bz), y: baseY + c[4]! });
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

/** Whether the ground's surface at (x, z), `y` high, has been cut away there (or within `margin` of where it has). */
export function groundCutAt(cuts: readonly GroundCut[], x: number, y: number, z: number, margin = 0): boolean {
  for (const c of cuts) if (x > c.min[0] - margin && x < c.max[0] + margin && z > c.min[2] - margin && z < c.max[2] + margin && y > c.min[1] && y < c.max[1]) return true;
  return false;
}

const cutsOf = new WeakMap<object, readonly GroundCut[]>();
const NO_CUTS: readonly GroundCut[] = [];

/** Remember the cuts a ground as played was worked out with (settle.ts terrainUnderFloors). */
export function rememberTerrainCuts(t: TerrainData, cuts: readonly GroundCut[]): void {
  if (cuts.length) cutsOf.set(t, cuts);
}

/**
 * The cuts of a ground as played (the terrain loadMap plays and MapMaker shows), for what is placed on the ground by
 * its height alone: plants must not grow where the ground has been cut away (client foliage.ts).
 */
export function terrainCuts(t: TerrainData): readonly GroundCut[] {
  return cutsOf.get(t) ?? NO_CUTS;
}

/** Whether (x, z) is over a cut's footprint or within `margin` of one (bots there make the exact move: Match.relaxedMove). */
export function nearGroundCut(cuts: readonly GroundCut[], x: number, z: number, margin = 0): boolean {
  for (const c of cuts) if (x > c.min[0] - margin && x < c.max[0] + margin && z > c.min[2] - margin && z < c.max[2] + margin) return true;
  return false;
}

/**
 * The ground shaped round the buried pieces (settle.ts terrainUnderFloors calls it on the ground as made, paths laid):
 *
 *  - **mouths** (openings): every vertex of a grid square an opening touches comes down to the way in (level with
 *    the floor for a landing, then a ramp up: mouthRamp), the opening run out to daylight first, and beyond the ground
 *    rises no steeper than MOUTH_BANK;
 *  - **rims**: the ground along a rim goes to the rim's height (so earth meets a wing wall's top: no wall stands bare
 *    of its bank, and no hill overhangs it), up or down, and differs from it by at most MOUTH_BANK a metre further out;
 *  - **covers**: the ground over a buried piece is at least its cover (earth over its cap), falling away at COVER_BANK
 *    (as the earth raised to a rim does): gentle enough to walk, so a mound is crossed over its top.
 *
 * Where they disagree: a mouth's flat ground wins (the way in is never banked up: on a grid that doesn't line up with
 * the piece, a wing wall's last grid square may show a little of its foot instead), then the vertices held at a `both`
 * rim, then raising over lowering. Worked out per vertex
 * as bounds on the ground as it is, so doing it twice gives the same ground. The same terrain when nothing changed.
 */
export function shapeGroundAtBores(t: TerrainData, bores: Pick<GroundBores, 'openings' | 'rims' | 'covers'>): TerrainData {
  if (!bores.openings.length && !bores.rims.length && !bores.covers.length) return t;
  const s = t.spacing;
  let top = -Infinity;
  let bottom = Infinity;
  for (const h of t.heights) {
    if (h > top) top = h;
    if (h < bottom) bottom = h;
  }
  const high = t.baseY + top / 100;
  const low = t.baseY + bottom / 100;
  // Bounds per vertex, in centimetres over baseY (as the heights are): at most `hi`, at least `lo`, exactly `pin`, or flat at `flat`.
  const hi = new Map<number, number>();
  const lo = new Map<number, number>();
  const pin = new Map<number, number>();
  const flat = new Map<number, number>();
  const atMost = (m: Map<number, number>, i: number, v: number) => {
    const was = m.get(i);
    if (was === undefined || v < was) m.set(i, v);
  };
  const atLeast = (m: Map<number, number>, i: number, v: number) => {
    const was = m.get(i);
    if (was === undefined || v > was) m.set(i, v);
  };
  const cmDown = (y: number) => Math.floor((y - t.baseY) * 100 + 1e-6);
  const cmUp = (y: number) => Math.ceil((y - t.baseY) * 100 - 1e-6);
  const cols = (x0: number, x1: number): [number, number] => [Math.max(0, Math.floor((x0 - t.origin[0]) / s)), Math.min(t.cols - 1, Math.ceil((x1 - t.origin[0]) / s))];
  const rows = (z0: number, z1: number): [number, number] => [Math.max(0, Math.floor((z0 - t.origin[1]) / s)), Math.min(t.rows - 1, Math.ceil((z1 - t.origin[1]) / s))];
  // The grid squares a rectangle touches, as vertex ranges (their vertices are "on" the rectangle).
  const touched = (x0: number, z0: number, x1: number, z1: number) => ({
    c0: Math.floor((x0 - t.origin[0]) / s + 1e-9),
    c1: Math.ceil((x1 - t.origin[0]) / s - 1e-9),
    r0: Math.floor((z0 - t.origin[1]) / s + 1e-9),
    r1: Math.ceil((z1 - t.origin[1]) / s - 1e-9),
  });
  // How far a vertex is from a block of touched squares.
  const away = (q: { c0: number; c1: number; r0: number; r1: number }, c: number, r: number) => Math.hypot(Math.max(q.c0 - c, 0, c - q.c1), Math.max(q.r0 - r, 0, r - q.r1)) * s;

  for (const mouth of bores.openings) {
    // (Daylight is looked for on the ground as made, so two mouths near each other don't depend on their order.)
    const o = toDaylight(t, mouth);
    const floor = o.y - UNDER_FLOOR;
    const q = touched(o.x0, o.z0, o.x1, o.z1);
    if (q.c1 < 0 || q.r1 < 0 || q.c0 > t.cols - 1 || q.r0 > t.rows - 1) continue;
    const reach = Math.max(0, high - floor) / MOUTH_BANK + s;
    const [c0, c1] = cols(o.x0 - reach, o.x1 + reach);
    const [r0, r1] = rows(o.z0 - reach, o.z1 + reach);
    for (let r = r0; r <= r1; r++) {
      const z = t.origin[1] + r * s;
      for (let c = c0; c <= c1; c++) {
        const x = t.origin[0] + c * s;
        const i = r * t.cols + c;
        let d = away(q, c, r);
        // A mouth that faces a way is flat across its own width only: a vertex of its squares past its side belongs to
        // the bank there (or to a wing wall's rim), not to the way in.
        if (d === 0 && o.out) d = o.out[0] ? Math.max(o.z0 - z, 0, z - o.z1) : Math.max(o.x0 - x, 0, x - o.x1);
        // How far out from the mouth's own edge this vertex is, along the way in (no further than the cutting runs).
        let out = 0;
        if (mouth.out) {
          const [ox, oz] = mouth.out;
          const edge = ox > 0 ? mouth.x1 : ox < 0 ? mouth.x0 : oz > 0 ? mouth.z1 : mouth.z0;
          const far = ox ? o.x1 - o.x0 - (mouth.x1 - mouth.x0) : o.z1 - o.z0 - (mouth.z1 - mouth.z0);
          // (A grid square past the cutting's end still counts: its vertices are on the way in.)
          out = Math.max(0, Math.min(far + s, ox ? (x - edge) * ox : (z - edge) * oz));
        }
        const way = floor + mouthRamp(out);
        if (d <= 1e-9) atMost(flat, i, cmDown(way));
        else atMost(hi, i, cmDown(way + MOUTH_BANK * d));
      }
    }
  }

  for (const cover of bores.covers) {
    const q = touched(cover.x0, cover.z0, cover.x1, cover.z1);
    const reach = Math.max(0, cover.y - low) / COVER_BANK + s;
    const [c0, c1] = cols(cover.x0 - reach, cover.x1 + reach);
    const [r0, r1] = rows(cover.z0 - reach, cover.z1 + reach);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) atLeast(lo, r * t.cols + c, cmUp(cover.y - COVER_BANK * away(q, c, r)));
  }

  for (const rim of bores.rims) {
    const dx = rim.x1 - rim.x0;
    const dz = rim.z1 - rim.z0;
    const len2 = dx * dx + dz * dz;
    if (!(len2 > 0)) continue;
    const yTop = Math.max(rim.y0, rim.y1);
    const yLow = Math.min(rim.y0, rim.y1);
    const reach = Math.max(rim.mode === 'lower' ? 0 : (yTop - low) / COVER_BANK, rim.mode === 'raise' ? 0 : (high - yLow) / MOUTH_BANK, 0) + s;
    const [c0, c1] = cols(Math.min(rim.x0, rim.x1) - reach, Math.max(rim.x0, rim.x1) + reach);
    const [r0, r1] = rows(Math.min(rim.z0, rim.z1) - reach, Math.max(rim.z0, rim.z1) + reach);
    for (let r = r0; r <= r1; r++) {
      const z = t.origin[1] + r * s;
      for (let c = c0; c <= c1; c++) {
        const x = t.origin[0] + c * s;
        const u = ((x - rim.x0) * dx + (z - rim.z0) * dz) / len2;
        // Square across the line only: nothing past its ends (a wing's rim raises no earth in front of the mouth).
        if (u < -1e-9 || u > 1 + 1e-9) continue;
        const d = Math.hypot(x - (rim.x0 + u * dx), z - (rim.z0 + u * dz));
        const y = rim.y0 + (rim.y1 - rim.y0) * u;
        const i = r * t.cols + c;
        const e = Math.max(0, d - s);
        // Held at the rim: the vertices on the line, or the nearest either side of it (strictly within a square).
        if (rim.mode === 'both' && d < s - 1e-9) atMost(pin, i, Math.round((y - t.baseY) * 100));
        if (rim.mode !== 'lower') atLeast(lo, i, cmUp(y - COVER_BANK * e));
        if (rim.mode !== 'raise') atMost(hi, i, cmDown(y + MOUTH_BANK * e));
      }
    }
  }

  let heights: number[] | null = null;
  const set = (i: number, want: number) => {
    const v = Math.max(-5000, Math.min(20000, want));
    if (t.heights[i] === v) return;
    heights ??= [...t.heights];
    heights[i] = v;
  };
  const seen = new Set<number>([...flat.keys(), ...pin.keys(), ...hi.keys(), ...lo.keys()]);
  for (const i of seen) {
    const h = t.heights[i]!;
    const f = flat.get(i);
    if (f !== undefined) {
      set(i, Math.min(h, f));
      continue;
    }
    const p = pin.get(i);
    if (p !== undefined) {
      set(i, p);
      continue;
    }
    set(i, Math.max(Math.min(h, hi.get(i) ?? Infinity), lo.get(i) ?? -Infinity));
  }
  return heights ? { ...t, heights } : t;
}

/** The ground opened at the mouths only (no rims or covers): shapeGroundAtBores with just the openings. */
export function openGroundAtMouths(t: TerrainData, openings: readonly GroundOpening[]): TerrainData {
  return shapeGroundAtBores(t, { openings: [...openings], rims: [], covers: [] });
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
