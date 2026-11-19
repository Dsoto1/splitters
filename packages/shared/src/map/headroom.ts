import { BODY_SIZES, PLAYER, STANCES } from '../sim/constants.ts';
import { boxCorners, boxFootprint, buildMapDecor, buildMapGeometry, type WorldBox } from './geometry.ts';
import { coplanarIssues, coplanarSpots, type CoplanarSpot } from './zfight.ts';
import type { MapDocument } from './schema.ts';
import type { ValidationIssue } from './validate.ts';

/**
 * Stairs and ramps a player can't walk up or down standing (owner, 2026-11-18/19: Flavius Rule's stair wells down to
 * the hypogeum needed a crouch, for a large character): along every flight's steps and every ramp, the clear height
 * from the walking surface to the lowest thing over it. MapMaker warns where it is under what the tallest body needs
 * (map/validate.ts), so no map ships one.
 */

/** The tallest body a player can have (BODY_SIZES.large): 2.12 m, 0.47 m round. */
const TALLEST = BODY_SIZES.large.scale * PLAYER.height;
const TALLEST_RADIUS = BODY_SIZES.large.scale * PLAYER.radius;
/** A step's rise (map/catalog.ts flight, descending). */
const STEP_RISE = 0.25;
/**
 * Over a flight's steps: the tallest body standing on the next step up while its head passes under an edge going down
 * (it rides that step's nose with the round of its feet): two risers over its height, 2.62 m. Flavius Rule's wells had
 * 2.5 m (a large body stuck on the way down; a standard one cleared it).
 */
export const STAIR_HEADROOM = TALLEST + 2 * STEP_RISE;
/** Over a ramp tilted `tilt` (radians): the tallest body's height, and its round's reach up the slope. */
export const rampHeadroom = (tilt: number): number => TALLEST + TALLEST_RADIUS * Math.tan(tilt);
/** Standing height alone (the old measure, PLAYER.height): what the clock tower's and every stair's tests also keep. */
export const STANDING_HEADROOM = PLAYER.height;
/** Ramps: tilted floors and solids no steeper than this (radians) are walked on. */
const RAMP_MAX_TILT = 0.7;
/** A ramp is a body wide both ways (its top face): a rail, a wall's top or a plate's edge is not one. */
const RAMP_MIN_WIDTH = 2 * PLAYER.radius;
/**
 * Lower than a crouch over a walking surface is no way through at all: two pieces overlapping (a hipped roof's
 * panels, a spiral's next flight, piled stones, a block sunk into a step), left to the overlap and navigation checks.
 */
const MIN_GAP = STANCES[1].height;
/** The grid the boxes are bucketed in to find what is over a point (m). */
const BUCKET = 4;

/** One place a flight or ramp is too low to stand: its piece, the clear height there and the point (x, y, z) of the surface. */
export interface LowHeadroom {
  sourceId: string;
  headroom: number;
  /** What it needs there (STAIR_HEADROOM over a step, rampHeadroom over a ramp). */
  need: number;
  at: [number, number, number];
  /** What is over it. */
  over: string;
}

const tilted = (b: WorldBox) => !!(b.pitch || b.roll);

/** Is (x, z) inside a box's outline from above? */
function inside(poly: readonly (readonly [number, number])[], x: number, z: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Height of the plane through three points at (x, z). */
function planeY(a: readonly number[], b: readonly number[], c: readonly number[], x: number, z: number): number {
  const ux = b[0]! - a[0]!, uy = b[1]! - a[1]!, uz = b[2]! - a[2]!;
  const vx = c[0]! - a[0]!, vy = c[1]! - a[1]!, vz = c[2]! - a[2]!;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (Math.abs(ny) < 1e-9) return Math.max(a[1]!, b[1]!, c[1]!);
  return a[1]! - (nx * (x - a[0]!) + nz * (z - a[2]!)) / ny;
}

/** A box's top (or bottom) face height at (x, z): its own plane for a tilted box. */
function faceY(b: WorldBox, x: number, z: number, top: boolean): number {
  if (!tilted(b)) return top ? b.max[1] : b.min[1];
  // Corners: bit 1 is max y; the face's four are 0,1,4,5 (bottom) or 2,3,6,7 (top).
  const c = boxCorners(b);
  const [i, j, k] = top ? [2, 3, 6] : [0, 1, 4];
  return planeY(c[i]!, c[j]!, c[k]!, x, z);
}

/**
 * Every place on a flight's steps or a ramp with less than standing headroom (map/geometry.ts boxes, as collision has
 * them; `boxes` defaults to the map's). One entry per sample point; headroomIssues sums them up by piece.
 */
export function lowHeadroom(map: MapDocument, boxes: readonly WorldBox[] = buildMapGeometry(map), need?: number, partOf: ReadonlyMap<string, string> = new Map()): LowHeadroom[] {
  const piece = (id: string) => partOf.get(id) ?? id;
  const ramp = (b: WorldBox) => tilted(b) && (b.kind === 'floor' || b.kind === 'solid') && Math.abs(b.pitch ?? 0) <= RAMP_MAX_TILT && Math.abs(b.roll ?? 0) <= RAMP_MAX_TILT && b.max[0] - b.min[0] >= RAMP_MIN_WIDTH && b.max[2] - b.min[2] >= RAMP_MIN_WIDTH;
  const walk = boxes.filter((b) => b.kind !== 'trim' && (b.step || ramp(b)));
  if (!walk.length) return [];
  // What could be over something: every collision box but trim, bucketed by its outline's extent.
  const polys = new Map<WorldBox, [number, number][]>();
  const buckets = new Map<string, WorldBox[]>();
  for (const b of boxes) {
    if (b.kind === 'trim') continue;
    const poly = boxFootprint(b);
    polys.set(b, poly);
    const xs = poly.map((p) => p[0]);
    const zs = poly.map((p) => p[1]);
    for (let i = Math.floor(Math.min(...xs) / BUCKET); i <= Math.floor(Math.max(...xs) / BUCKET); i++) {
      for (let k = Math.floor(Math.min(...zs) / BUCKET); k <= Math.floor(Math.max(...zs) / BUCKET); k++) {
        const key = `${i},${k}`;
        const list = buckets.get(key);
        if (list) list.push(b);
        else buckets.set(key, [b]);
      }
    }
  }
  const out: LowHeadroom[] = [];
  for (const w of walk) {
    const want = need ?? (w.step ? STAIR_HEADROOM : rampHeadroom(Math.max(Math.abs(w.pitch ?? 0), Math.abs(w.roll ?? 0))));
    const poly = polys.get(w) ?? boxFootprint(w);
    // Points over the walking face: its corners and edges, and a 3 × 3 grid a little in from them (the outline's corners
    // blended); the grid is what is measured.
    const [p0, p1, p2, p3] = poly as [[number, number], [number, number], [number, number], [number, number]];
    const at = (s: number, t: number): [number, number] => {
      const ax = p0[0] + (p1[0] - p0[0]) * s, az = p0[1] + (p1[1] - p0[1]) * s;
      const bx = p3[0] + (p2[0] - p3[0]) * s, bz = p3[1] + (p2[1] - p3[1]) * s;
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    };
    const near = new Set<WorldBox>();
    for (const [s, t] of [[0, 0], [1, 1], [0.5, 0.5]] as const) {
      const [x, z] = at(s, t);
      for (const b of buckets.get(`${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`) ?? []) near.add(b);
    }
    // Pieces built through the face (a hipped roof's panels crossing at the hip, a block sunk into a step): the face
    // beyond the crossing is inside them, nowhere anyone stands, so they are never what is over it.
    const through = new Set<WorldBox>();
    const edge = [0, 0.15, 0.5, 0.85, 1];
    for (const b of near) {
      if (b === w) continue;
      const bp = polys.get(b)!;
      for (const s of edge) {
        for (const t of edge) {
          const [x, z] = at(s, t);
          if (!inside(bp, x, z)) continue;
          const y = faceY(w, x, z, true);
          if (faceY(b, x, z, false) < y - 0.02 && faceY(b, x, z, true) > y + 0.02) through.add(b);
        }
      }
    }
    for (const s of [0.15, 0.5, 0.85]) {
      for (const t of [0.15, 0.5, 0.85]) {
        const [x, z] = at(s, t);
        const y = faceY(w, x, z, true);
        let low = Infinity;
        let over = '';
        for (const b of buckets.get(`${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`) ?? []) {
          // (A tilted piece over a tilted face of the same piece: a pitched roof's panels, each hanging past its hips
          // over the next; not a way anyone walks.)
          if (b === w || through.has(b) || (tilted(w) && tilted(b) && piece(b.sourceId) === piece(w.sourceId))) continue;
          const bottom = faceY(b, x, z, false);
          // Over the surface (what stands on it, the next step up or a wall's foot, reaches down to it; MIN_GAP), and lower
          // than anything found yet.
          if (bottom <= y + MIN_GAP || bottom >= low || bottom - y >= want) continue;
          if (!inside(polys.get(b)!, x, z)) continue;
          low = bottom;
          over = b.sourceId;
        }
        if (low - y < want) out.push({ sourceId: w.sourceId, headroom: low - y, need: want, at: [x, y, z], over });
      }
    }
  }
  return out;
}

/**
 * MapMaker's warning for stairs and ramps too low to walk standing: one for each piece (a tile, a set piece, a free
 * block) with any, naming its lowest clear height and what is over it. `partOf` (expandSetPieces) names a set piece's
 * part by its placement.
 */
export function headroomIssues(map: MapDocument, partOf: ReadonlyMap<string, string> = new Map(), boxes?: readonly WorldBox[]): ValidationIssue[] {
  const low = lowHeadroom(map, boxes, undefined, partOf);
  if (!low.length) return [];
  const piece = (id: string) => partOf.get(id) ?? id;
  const worst = new Map<string, LowHeadroom>();
  for (const l of low) {
    const id = piece(l.sourceId);
    const w = worst.get(id);
    if (!w || l.headroom < w.headroom) worst.set(id, l);
  }
  const name = (id: string) => {
    const tile = map.classicStructure.tiles.find((t) => t.id === id);
    if (tile) return `${tile.tile.replace(/^core\./, '').replace(/_/g, ' ')} ${id}`;
    const sp = map.setPieces?.find((p) => p.id === id);
    return sp ? `${sp.piece.replace(/^setpiece\./, '').replace(/_/g, ' ')} ${id}` : id;
  };
  return [...worst].map(([id, l]) => ({
    severity: 'warning' as const,
    code: 'stairs.headroom',
    message: `Stairs or ramp too low to walk standing: ${name(id)} has ${l.headroom.toFixed(2)} m over its walking surface at ${l.at.map((v) => v.toFixed(1)).join(', ')} (under ${name(piece(l.over))}); the tallest player needs ${l.need.toFixed(2)} m to walk it standing. Raise what is over it, or move the stairs.`,
    targetId: id,
  }));
}

/**
 * MapMaker's checks of a map's shape as played (`view`, set pieces expanded; `partOf` names their parts), run after
 * every edit beside validateMap (client editor/mapChecks.ts, its worker): the coplanar spots (zfight.ts) and their
 * warning, and stairs or ramps too low to walk standing. One build of the level's boxes for both.
 */
export function shapeChecks(view: MapDocument, partOf: ReadonlyMap<string, string>): { spots: CoplanarSpot[]; issues: ValidationIssue[] } {
  let spots: CoplanarSpot[] = [];
  let low: ValidationIssue[] = [];
  let geometry: WorldBox[] | null = null;
  try {
    geometry = buildMapGeometry(view);
    spots = coplanarSpots(view, [...geometry, ...buildMapDecor(view)], partOf);
  } catch {
    spots = [];
  }
  try {
    low = headroomIssues(view, partOf, geometry ?? undefined);
  } catch {
    low = [];
  }
  return { spots, issues: [...coplanarIssues(view, spots), ...low] };
}
