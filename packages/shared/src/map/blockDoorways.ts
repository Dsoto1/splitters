/**
 * Doorways cut through free blocks (v52, doors that fit themselves: BlockEntity.doorways, cut by editor/doorFit.ts).
 * A wall of free blocks takes a door's doorway the way a tile's side does: the block is built as the doorway's edge
 * style (content/tiles/edges.json) along its long side, with the block's thickness for the wall's: the same collision
 * pieces round the opening (an arch's steps over its curve), the same frames, voussoirs and soffit on both faces and
 * through the thickness. Only the doorway's own pieces are the style's; the rest of the block stays plain (no
 * baseboard, no cornice). This module imports no map code but the edge styles', so geometry.ts can build from it.
 */

import { edgeSegments, edgeTrimBoxes, type SideTrim } from './edgeShapes.ts';
import type { MapEntity } from './schema.ts';

type Block = Extract<MapEntity, { kind: 'block' }>;

/** A block's long side: along its own x (as wide as deep or wider) or its own z; its thickness is the other. */
export function blockRun(e: Pick<Block, 'size'>): { along: 'x' | 'z'; length: number; thickness: number } {
  const [w, , d] = e.size;
  return w >= d ? { along: 'x', length: w, thickness: d } : { along: 'z', length: d, thickness: w };
}

/** Whether a block can take doorways: a plain solid block standing level (never tilted, glass, a force field or hidden at the start). */
export function blockTakesDoorways(e: Block): boolean {
  return e.behaviour === 'solid' && !e.pitch && !e.roll && !e.glass && !e.field && !e.startHidden;
}

/** One piece of a block's doorways in the block's run frame: u along the run from its middle, y up from its bottom, v across from one face (0) to the other (the thickness). */
export interface RunPiece {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  v0: number;
  v1: number;
  tilt?: number;
  surface?: SideTrim['surface'];
}

/**
 * A block's doorways as pieces in its run frame: `solids` (what it collides as and is drawn as: the style's wall pieces
 * round each opening, a sill under an opening that starts above the block's bottom) and `trim` (frames, voussoirs,
 * soffits: drawn, never collide). Each doorway owns the run up to halfway to its neighbours, so two doorways in one long
 * block are each built whole. Empty when the block has none.
 */
export function blockDoorwayPieces(e: Block): { solids: RunPiece[]; trim: RunPiece[] } {
  const solids: RunPiece[] = [];
  const trim: RunPiece[] = [];
  const doorways = [...(e.doorways ?? [])].sort((a, b) => a.at - b.at);
  if (!doorways.length) return { solids, trim };
  const { length: L, thickness: T } = blockRun(e);
  const H = e.size[1];
  for (let i = 0; i < doorways.length; i++) {
    const d = doorways[i]!;
    const from = i === 0 ? -L / 2 : (doorways[i - 1]!.at + d.at) / 2;
    const to = i === doorways.length - 1 ? L / 2 : (d.at + doorways[i + 1]!.at) / 2;
    if (!(to > from)) continue;
    const sill = Math.min(Math.max(0, d.y ?? 0), H);
    const height = H - sill;
    // Half a side long enough that the style's wall reaches both ends of the doorway's stretch.
    const half = L + Math.abs(d.at) + 1;
    if (sill > 0) solids.push({ u0: from, u1: to, y0: 0, y1: sill, v0: 0, v1: T });
    if (height <= 0) continue;
    for (const [u0, u1, y0, y1] of edgeSegments(d.style, half, height, T)) {
      const a = Math.max(from, u0 + d.at);
      const b = Math.min(to, u1 + d.at);
      if (b - a > 1e-6 && y1 - y0 > 1e-6) solids.push({ u0: a, u1: b, y0: sill + y0, y1: sill + y1, v0: 0, v1: T });
    }
    for (const p of edgeTrimBoxes(d.style, half, height, true, 'all', { wall: T, bare: true })) {
      const mid = (p.u0 + p.u1) / 2 + d.at;
      if (mid < from || mid > to) continue;
      trim.push({ u0: p.u0 + d.at, u1: p.u1 + d.at, y0: sill + p.y0, y1: sill + p.y1, v0: p.v0, v1: p.v1, ...(p.tilt ? { tilt: p.tilt } : {}), ...(p.surface ? { surface: p.surface } : {}) });
    }
  }
  return { solids, trim };
}

/** A run piece as a box in the world: [min, max] about its centre turned by the block's yaw, with its tilt in the wall's plane. */
export function runPieceBox(e: Block, p: RunPiece): { min: [number, number, number]; max: [number, number, number]; yaw?: number; pitch?: number; roll?: number } {
  const { along, thickness: T } = blockRun(e);
  const u = (p.u0 + p.u1) / 2;
  const v = (p.v0 + p.v1) / 2 - T / 2;
  const [lx, lz] = along === 'x' ? [u, v] : [v, u];
  const [hx, hz] = along === 'x' ? [(p.u1 - p.u0) / 2, (p.v1 - p.v0) / 2] : [(p.v1 - p.v0) / 2, (p.u1 - p.u0) / 2];
  // Turned about +Y as boxes are (geometry.ts yawXZ, boxQuat).
  const c = Math.cos(e.yaw);
  const s = Math.sin(e.yaw);
  const [ox, oz] = [lx * c + lz * s, -lx * s + lz * c];
  const cx = e.position[0] + ox;
  const cz = e.position[2] + oz;
  const y0 = e.position[1] + p.y0;
  const y1 = e.position[1] + p.y1;
  return {
    min: [cx - hx, y0, cz - hz],
    max: [cx + hx, y1, cz + hz],
    ...(e.yaw ? { yaw: e.yaw } : {}),
    ...(p.tilt ? (along === 'x' ? { roll: p.tilt } : { pitch: p.tilt }) : {}),
  };
}
