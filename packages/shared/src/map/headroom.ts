import { PLAYER } from '../sim/constants.ts';
import { boxCorners, boxFootprint, buildMapGeometry, type WorldBox } from './geometry.ts';
import type { MapDocument } from './schema.ts';
import type { ValidationIssue } from './validate.ts';

/**
 * Stairs and ramps a player can't walk up or down standing (owner, 2026-11-18: Flavius Rule's hypogeum stairs needed
 * a crouch): along every flight's steps and every ramp, the clear height from the walking surface to the lowest thing
 * over it. MapMaker warns where it is under standing height (PLAYER.height), so no map ships one.
 */

/** Below this clear height a player has to crouch. */
export const STANDING_HEADROOM = PLAYER.height;
/** Ramps: tilted floors and solids no steeper than this (radians) are walked on. */
const RAMP_MAX_TILT = 0.7;
/**
 * Closer than this over a walking surface is an overlap of two pieces (a spiral's next flight, a block sunk into a
 * step), not a ceiling anyone would walk under: left to the overlap and navigation checks.
 */
const MIN_GAP = 0.3;
/** The grid the boxes are bucketed in to find what is over a point (m). */
const BUCKET = 4;

/** One place a flight or ramp is too low to stand: its piece, the clear height there and the point (x, y, z) of the surface. */
export interface LowHeadroom {
  sourceId: string;
  headroom: number;
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
export function lowHeadroom(map: MapDocument, boxes: readonly WorldBox[] = buildMapGeometry(map), need = STANDING_HEADROOM): LowHeadroom[] {
  const walk = boxes.filter((b) => b.kind !== 'trim' && (b.step || (tilted(b) && (b.kind === 'floor' || b.kind === 'solid') && Math.abs(b.pitch ?? 0) <= RAMP_MAX_TILT && Math.abs(b.roll ?? 0) <= RAMP_MAX_TILT)));
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
    const poly = polys.get(w) ?? boxFootprint(w);
    // A 3 × 3 grid over the walking face, a little in from its edges (the corners of the outline, blended).
    const [p0, p1, p2, p3] = poly as [[number, number], [number, number], [number, number], [number, number]];
    for (const s of [0.15, 0.5, 0.85]) {
      for (const t of [0.15, 0.5, 0.85]) {
        const ax = p0[0] + (p1[0] - p0[0]) * s, az = p0[1] + (p1[1] - p0[1]) * s;
        const bx = p3[0] + (p2[0] - p3[0]) * s, bz = p3[1] + (p2[1] - p3[1]) * s;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const y = faceY(w, x, z, true);
        let low = Infinity;
        let over = '';
        for (const b of buckets.get(`${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`) ?? []) {
          if (b === w) continue;
          const bottom = faceY(b, x, z, false);
          // Over the surface (what stands on it, the next step up or a wall's foot, reaches down to it; MIN_GAP), and lower
          // than anything found yet.
          if (bottom <= y + MIN_GAP || bottom >= low || bottom - y >= need) continue;
          if (!inside(polys.get(b)!, x, z)) continue;
          low = bottom;
          over = b.sourceId;
        }
        if (low - y < need) out.push({ sourceId: w.sourceId, headroom: low - y, at: [x, y, z], over });
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
  const low = lowHeadroom(map, boxes);
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
    message: `Stairs or ramp too low to walk standing: ${name(id)} has ${l.headroom.toFixed(2)} m over its walking surface at ${l.at.map((v) => v.toFixed(1)).join(', ')} (under ${name(piece(l.over))}); a player needs ${STANDING_HEADROOM} m. Raise what is over it, or move the stairs.`,
    targetId: id,
  }));
}
