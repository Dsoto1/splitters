import { yawXZ, type Vec3, type WorldBox } from '@chronosplit/shared';

export interface BoxHit {
  box: WorldBox;
  /** Outward normal of the face that was hit (world space). */
  normal: [number, number, number];
  /** The same normal in the box's own (unturned) frame. */
  localNormal: [number, number, number];
  distance: number;
}

/** Nearest box face hit by a ray (slab test). Used to pick paintable surfaces. */
export function raycastBoxes(origin: Vec3, dir: Vec3, boxes: readonly WorldBox[]): BoxHit | null {
  let best: BoxHit | null = null;
  for (const box of boxes) {
    // Turned boxes: test the ray in the box's own frame.
    let o = [origin.x, origin.y, origin.z];
    let d = [dir.x, dir.y, dir.z];
    const cx = (box.min[0] + box.max[0]) / 2;
    const cz = (box.min[2] + box.max[2]) / 2;
    if (box.yaw) {
      const [ox, oz] = yawXZ(origin.x - cx, origin.z - cz, -box.yaw);
      const [dx, dz] = yawXZ(dir.x, dir.z, -box.yaw);
      o = [cx + ox, origin.y, cz + oz];
      d = [dx, dir.y, dz];
    }
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
      const localNormal: [number, number, number] = [0, 0, 0];
      localNormal[axis] = sign;
      const [nx, nz] = box.yaw ? yawXZ(localNormal[0], localNormal[2], box.yaw) : [localNormal[0], localNormal[2]];
      best = { box, normal: [nx, localNormal[1], nz], localNormal, distance: tmin };
    }
  }
  return best;
}
