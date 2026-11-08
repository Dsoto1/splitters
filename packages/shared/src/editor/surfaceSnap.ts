import type { Vec3 } from '../math.ts';
import type { WorldBox } from '../map/geometry.ts';
import { settledPropY, supportUnder } from '../map/settle.ts';
import type { PropEntity } from '../map/schema.ts';
import { terrainHeightAt, terrainRaycast, type TerrainData } from '../map/terrain.ts';
import { raycastBoxes } from './raycast.ts';

/**
 * Surface snap (MapMaker overhaul Phase 1, items 3 and 4): where the pointer's ray meets what MapMaker draws, and
 * where a prop dropped there comes to rest. The boxes are the map as shown (tiles' floors, walls and roofs, blocks,
 * solid props); the ground is the ground as shown (`EditorApp.shownGround`: paths laid in, kept under the floors).
 */

/** What a ray met: the ground, the top of a box, or a box's side. */
export interface SurfaceHit {
  point: Vec3;
  on: 'ground' | 'top' | 'side';
  /** The box hit (null on the ground). */
  box: WorldBox | null;
  /** Outward normal of the face hit (world space; straight up on the ground). */
  normal: [number, number, number];
  distance: number;
}

/** A face counts as a top when its normal points this far up (a box's top face is exactly 1). */
const TOP = 0.7;

/** The nearest thing a ray meets: a box (barriers left out: they're invisible) or the ground. Null when it meets neither. */
export function surfaceHit(origin: Vec3, dir: Vec3, boxes: readonly WorldBox[], ground: TerrainData | null): SurfaceHit | null {
  const solid = boxes.some((b) => b.kind === 'barrier') ? boxes.filter((b) => b.kind !== 'barrier') : boxes;
  const box = raycastBoxes(origin, dir, solid);
  const g = ground ? terrainRaycast(ground, origin, dir) : null;
  const gd = g ? Math.hypot(g.x - origin.x, g.y - origin.y, g.z - origin.z) : Infinity;
  if (box && box.distance <= gd) {
    const d = box.distance;
    const point = { x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d };
    return { point, on: box.normal[1] > TOP ? 'top' : 'side', box: box.box, normal: box.normal, distance: d };
  }
  if (g) return { point: g, on: 'ground', box: null, normal: [0, 1, 0], distance: gd };
  return null;
}

/** What stands under (x, z), no higher than `fromY` plus a hair: the highest box top there, or the ground. */
export interface Rest {
  y: number;
  on: 'top' | 'ground';
  /** The box's source (a tile, block or prop), or null on the ground. */
  sourceId: string | null;
}

/**
 * The surface under (x, z) at or below `fromY` (+ 10 cm): the highest box top there, or the ground when that is
 * higher (or nothing else is there). `prop` beds the answer into the ground the way placing a prop does (the lowest
 * ground under its footprint, settledPropY); without it the ground's own height there. Null over nothing at all.
 */
export function restUnder(boxes: readonly WorldBox[], ground: TerrainData | null, x: number, z: number, fromY: number, prop?: Pick<PropEntity, 'model' | 'yaw' | 'scale'>, skip = ''): Rest | null {
  const top = supportUnder(boxes, x, z, fromY, skip);
  const gh = ground ? terrainHeightAt(ground, x, z) : null;
  const gy = gh === null || gh > fromY + 0.1 ? null : prop && ground ? (settledPropY(ground, { ...prop, position: [x, 0, z] }) ?? gh) : gh;
  if (top > -Infinity && (gy === null || top >= (gh ?? -Infinity) - 0.01)) {
    const src = sourceAt(boxes, x, z, top, skip);
    return { y: round2(top), on: 'top', sourceId: src };
  }
  if (gy !== null) return { y: gy, on: 'ground', sourceId: null };
  return null;
}

/** Where a prop dropped by the pointer lands: its spot on the map, what it stands on, and what the ray met. */
export interface PropDrop {
  position: [number, number, number];
  on: Rest['on'];
  sourceId: string | null;
  hit: SurfaceHit;
}

/**
 * Where a prop dropped under the pointer's ray comes to rest (Phase 1 item 4).
 * - On a top (a tabletop, a roof, a ledge, a floor): there, on that top.
 * - On a side (a wall, a table's edge): stood off the face by half the prop's depth, then dropped onto whatever is
 *   below that point (the floor at the wall's foot, the ground).
 * - On the ground: bedded into it like any prop (the lowest ground under its footprint).
 * `snap` rounds x and z (the grid snap; identity for free placement): the prop then lands on what is under the snapped
 * spot, so snapping off a table's edge drops it to the floor beside it, as you'd see it. Null when the ray meets
 * nothing (the caller falls back to the level being edited).
 */
export function propDrop(origin: Vec3, dir: Vec3, boxes: readonly WorldBox[], ground: TerrainData | null, prop: Pick<PropEntity, 'model' | 'yaw' | 'scale'> & { size?: readonly [number, number, number] }, snap: (v: number) => number = (v) => v, skip = ''): PropDrop | null {
  const hit = surfaceHit(origin, dir, boxes, ground);
  if (!hit) return null;
  let { x, z } = hit.point;
  if (hit.on === 'side') {
    const size = prop.size ?? [0.5, 0.5, 0.5];
    const off = (Math.min(size[0], size[2]) * prop.scale) / 2 + 0.02;
    const len = Math.hypot(hit.normal[0], hit.normal[2]) || 1;
    x += (hit.normal[0] / len) * off;
    z += (hit.normal[2] / len) * off;
  }
  x = round2(snap(x));
  z = round2(snap(z));
  const rest = restUnder(boxes, ground, x, z, hit.point.y, prop, skip);
  if (!rest) return null;
  return { position: [x, rest.y, z], on: rest.on, sourceId: rest.sourceId, hit };
}

/** The box whose top is `top` under (x, z): what a prop there stands on. */
function sourceAt(boxes: readonly WorldBox[], x: number, z: number, top: number, skip: string): string | null {
  for (const b of boxes) {
    if (b.sourceId === skip || b.kind === 'barrier' || Math.abs(b.max[1] - top) > 1e-6) continue;
    if (supportUnder([b], x, z, top, skip) === top) return b.sourceId;
  }
  return null;
}

const round2 = (v: number) => Math.round(v * 100) / 100 + 0;
