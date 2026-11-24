import type { Matrix } from '@babylonjs/core/Maths/math.vector';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec3 } from '@tiletrigger/shared';

/**
 * Bullet holes on the blocks the scenario drives (breakable, crumbling, trapdoor, logic-driven or carried by a
 * mover): those are not in the effects world's static shapes (EffectsWorld only has the level), so a round that
 * stopped on one used to leave no hole at all (the Training Range's plank target boards). A round that stopped on
 * one is found here against the block as drawn, and its hole goes on the block in the block's own frame, so it
 * rides a mover, breaks away with the block and is cleared when the block comes back (ScenarioVisuals, ImpactVisuals.holeOn).
 */

/** How far a round's end may be from the face it seems to have hit (as EffectsWorld's static hole test: impactVisuals.ts surfaceHit). */
export const BLOCK_HOLE_SLACK = 0.35;

/** Where a round from `from` that stopped at `to` met a box: its point and face normal in the box's frame, and how far along the ray. */
export interface LocalHit {
  dist: number;
  point: Vector3;
  normal: Vector3;
}

/**
 * The face of a box (half sizes `half`, centred on its frame's origin; `world` its world matrix) that a round from
 * `from` to `to` met, if the round stopped there (within BLOCK_HOLE_SLACK of the face): point and normal in the
 * box's own frame. Null when the ray misses it, starts inside it, or the face is clearly nearer or further than where
 * the round stopped (it went past, or stopped on something else first).
 */
export function rayBoxLocalHit(from: Vec3, to: Vec3, world: Matrix, half: Vec3): LocalHit | null {
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (len < 0.05) return null;
  const inv = world.clone().invert();
  const a = Vector3.TransformCoordinates(new Vector3(from.x, from.y, from.z), inv);
  const b = Vector3.TransformCoordinates(new Vector3(to.x, to.y, to.z), inv);
  const d = b.subtract(a);
  // The box's frame may be scaled (a breaking block shrinks): measure along the world ray by the fraction of it.
  let t0 = -Infinity;
  let t1 = Infinity;
  let axis = -1;
  let sign = 0;
  const lo = [-half.x, -half.y, -half.z];
  const hi = [half.x, half.y, half.z];
  const o = [a.x, a.y, a.z];
  const v = [d.x, d.y, d.z];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(v[k]!) < 1e-9) {
      if (o[k]! < lo[k]! || o[k]! > hi[k]!) return null;
      continue;
    }
    let n = (lo[k]! - o[k]!) / v[k]!;
    let f = (hi[k]! - o[k]!) / v[k]!;
    let s = -1;
    if (n > f) {
      [n, f] = [f, n];
      s = 1;
    }
    if (n > t0) {
      t0 = n;
      axis = k;
      sign = s;
    }
    t1 = Math.min(t1, f);
  }
  if (axis < 0 || t0 > t1 || t0 < 0) return null;
  const dist = t0 * len;
  if (Math.abs(dist - len) > BLOCK_HOLE_SLACK) return null;
  const point = a.add(d.scale(t0));
  const normal = new Vector3(axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0);
  return { dist, point, normal };
}
