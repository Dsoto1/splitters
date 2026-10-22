import type { Vec3, WorldBox } from '@chronosplit/shared';

export interface BoxHit {
  box: WorldBox;
  /** Outward normal of the face that was hit. */
  normal: [number, number, number];
  distance: number;
}

/** Nearest box face hit by a ray (slab test). Used to pick paintable surfaces. */
export function raycastBoxes(origin: Vec3, dir: Vec3, boxes: readonly WorldBox[]): BoxHit | null {
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  let best: BoxHit | null = null;
  for (const box of boxes) {
    let tmin = -Infinity;
    let tmax = Infinity;
    let axis = -1;
    let sign = 0;
    let miss = false;
    for (let i = 0; i < 3; i++) {
      const di = d[i]!;
      const oi = o[i]!;
      if (Math.abs(di) < 1e-12) {
        if (oi < box.min[i]! || oi > box.max[i]!) {
          miss = true;
          break;
        }
        continue;
      }
      let t1 = (box.min[i]! - oi) / di;
      let t2 = (box.max[i]! - oi) / di;
      // Entering through the min face means the face normal points to -axis.
      let s = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = i;
        sign = s;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) {
        miss = true;
        break;
      }
    }
    if (miss || axis < 0 || tmin < 0) continue;
    if (!best || tmin < best.distance) {
      const normal: [number, number, number] = [0, 0, 0];
      normal[axis] = sign;
      best = { box, normal, distance: tmin };
    }
  }
  return best;
}
