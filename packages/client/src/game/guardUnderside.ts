import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { WeaponHold } from '@tiletrigger/shared';

/**
 * Where a long gun's handguard is underneath its support point (third person: the support hand cups it from below,
 * its palm on the underside). A weapon's `support` is a point to hold, not a point on the surface: on the Assault
 * Rifle it sits 1.5 cm up inside the wooden handguard, so a palm set off it by half a grip and half a hand hung a few
 * centimetres under the gun (owner, 2026-11-20: "not holding their weapon properly").
 */

/** How far (model m) below the support point the underside is looked for, and above it (a point under the gun). */
export const GUARD_DOWN = 0.05;
export const GUARD_UP = 0.06;

/**
 * The underside's height (model y) straight below or above (`x`, `z`) from `y`, in triangles given in model space:
 * the lowest surface within GUARD_DOWN below `y` that the gun is solid down to (a point inside the handguard), else
 * the nearest surface within GUARD_UP above it (a point under the handguard), else null (nothing there).
 * Surfaces are found by a vertical line through each triangle; a gap of more than `gap` (m) of empty space ends
 * the guard (a magazine or a bipod hanging below it is not the guard).
 */
export function undersideAt(positions: ArrayLike<number>, indices: ArrayLike<number>, x: number, y: number, z: number, gap = 0.015): number | null {
  const hits: number[] = [];
  const p = (i: number) => [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!] as const;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = p(indices[t]!);
    const b = p(indices[t + 1]!);
    const c = p(indices[t + 2]!);
    // Barycentric coordinates of (x, z) in the triangle's projection on the ground plane.
    const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d;
    const v = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
    if (u < 0 || v < 0 || u + v > 1) continue;
    const h = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
    if (h >= y - GUARD_DOWN && h <= y + GUARD_UP) hits.push(h);
  }
  if (!hits.length) return null;
  const below = hits.filter((h) => h <= y).sort((m, n) => n - m);
  if (below.length) {
    // Down from the point through the guard's surfaces (its inside, a barrel within it) to its underside: the last
    // surface before a gap.
    let under = below[0]!;
    for (const h of below) {
      if (under - h > gap) break;
      under = h;
    }
    // A point inside the guard has a surface above it too; one under the gun has only the guard above.
    if (hits.some((h) => h > y)) return under;
  }
  const above = hits.filter((h) => h > y).sort((m, n) => m - n);
  return above.length ? above[0]! : below.length ? below[0]! : null;
}

/** A long gun's handguard under its support point, measured off its model (guardOf). */
export interface Guard {
  /** How far (model m) back from the support point the guard starts (0; behind a vertical grip, where it ends). */
  from: number;
  /** The underside's height (model y) where the guard starts. */
  under: number;
  /** How far (model m) back from the support point the handguard runs on at about that height (where a hand may slide). */
  back: number;
  /** The underside's height (model y) `slid` metres back from the support point (`from` to `back`). */
  at(slid: number): number;
}

/** Steps (m) the handguard is followed back along, and how far its underside may rise or fall and still be the guard. */
const GUARD_STEP = 0.01;
const GUARD_EVEN = 0.03;
/** An underside further than this (model m) below the support point is a vertical grip's end, not a handguard's (guardFrom). */
const GUARD_DEEP = 0.035;
/** The furthest (model m) behind the support point a guard behind a vertical grip is looked for. */
const GUARD_SKIP = 0.08;

/**
 * The handguard round a long gun's support point, from triangles in model space: its underside there, and how far
 * back toward `minZ` it runs at about the same height (a magazine, a trigger guard or a vertical grip's end is not the
 * handguard: a support hand slid back onto them hung under the gun, 2026-11-20).
 */
export function guardFrom(positions: ArrayLike<number>, indices: ArrayLike<number>, support: readonly [number, number, number], minZ: number): Guard | null {
  const at = (z: number) => undersideAt(positions, indices, support[0], support[1], z);
  const steps = Math.max(0, Math.floor((support[2] - minZ) / GUARD_STEP + 1e-6));
  const unders = Array.from({ length: steps + 1 }, (_, k) => at(support[2] - k * GUARD_STEP));
  /** The guard's run back from step `k`: its undersides at about that one's height, a vertical grip's end not one. */
  const run = (k: number): number[] => {
    const u0 = unders[k];
    if (u0 === null || u0 === undefined || support[1] - u0 > GUARD_DEEP) return [];
    const out = [u0];
    for (let n = k + 1; n <= steps; n++) {
      const u = unders[n];
      if (u === null || u === undefined || Math.abs(u - u0) > GUARD_EVEN) break;
      out.push(u);
    }
    return out;
  };
  // The guard starts at the support point, or a little behind it where a longer run of guard starts (a vertical grip
  // or a bipod's clamp at the point itself: the Sniper Rifle's).
  let from = 0;
  let best = run(0);
  for (let k = 1; k * GUARD_STEP <= GUARD_SKIP + 1e-9 && k <= steps; k++) {
    const r = run(k);
    if (r.length > best.length + GUARD_SKIP / GUARD_STEP) {
      best = r;
      from = k * GUARD_STEP;
    }
  }
  if (!best.length) return null;
  const list = best;
  return {
    from,
    under: list[0]!,
    back: from + (list.length - 1) * GUARD_STEP,
    at: (slid: number) => {
      const k = Math.max(0, Math.min(list.length - 1, (slid - from) / GUARD_STEP));
      const i = Math.floor(k);
      const f = k - i;
      return list[i]! + (i + 1 < list.length ? (list[i + 1]! - list[i]!) * f : 0);
    },
  };
}

const cache = new WeakMap<WeaponHold, Guard | null>();

/**
 * A long gun's handguard round its support point (guardFrom), measured once a hold from the weapon's drawn meshes
 * (`weapon`: its node, the model's space; null until its meshes have geometry, or when there is no surface there).
 * `minZ`: the furthest back (model z) a support hand may go.
 */
export function guardOf(weapon: TransformNode, hold: WeaponHold, minZ: number): Guard | null {
  const s = hold.support;
  if (!s || hold.style !== 'long') return null;
  if (cache.has(hold)) return cache.get(hold)!;
  weapon.computeWorldMatrix(true);
  const toModel = weapon.getWorldMatrix().clone().invert();
  const positions: number[] = [];
  const indices: number[] = [];
  const meshes = weapon.getChildMeshes(false).filter((m: AbstractMesh) => m.getTotalVertices() > 0);
  if (!meshes.length) return null;
  for (const m of meshes) {
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    const idx = m.getIndices();
    if (!pos || !idx) continue;
    m.computeWorldMatrix(true);
    const into = m.getWorldMatrix().multiply(toModel);
    const base = positions.length / 3;
    const v = new Vector3();
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i]!, pos[i + 1]!, pos[i + 2]!, into, v);
      positions.push(v.x, v.y, v.z);
    }
    for (let i = 0; i < idx.length; i++) indices.push(base + idx[i]!);
  }
  const guard = guardFrom(positions, indices, s, minZ);
  cache.set(hold, guard);
  return guard;
}
