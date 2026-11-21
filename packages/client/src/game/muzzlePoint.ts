import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { ModelPoint } from '@tiletrigger/shared';

/**
 * Where a gun's muzzle is on its model (model space: +Z the barrel, +Y up), the point its tracers and flash leave
 * (grips auto-fit, owner 2026-11-18: "ensure bullets come out of the gun properly, especially in 3rd person"). A
 * weapon's own `view.muzzleAt` when it has one (read off a side view: 17 guns); otherwise measured from the model: the
 * middle of its front-most geometry (the vertices within MUZZLE_BAND of its length from the front), the barrel's end.
 * Before, a gun without `muzzleAt` used the front of its bounds a fifth above the middle of its height, which on a
 * gun with a tall stock or a magazine was 3-8 cm off the barrel (the Gatling's 7 cm above its barrels).
 */
export const MUZZLE_BAND = 0.03;

/** The middle of the front-most points (x, y, z flat): z the front, x and y the mean of those within the band. */
export function frontCentre(points: ArrayLike<number>): [number, number, number] | null {
  const n = Math.floor(points.length / 3);
  if (!n) return null;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const z = points[i * 3 + 2]!;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const band = Math.max(0.01, (maxZ - minZ) * MUZZLE_BAND);
  let x = 0;
  let y = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (points[i * 3 + 2]! < maxZ - band) continue;
    x += points[i * 3]!;
    y += points[i * 3 + 1]!;
    k++;
  }
  return [x / k, y / k, maxZ];
}

const measured = new Map<string, [number, number, number] | null>();

/**
 * The muzzle of a gun model as loaded under `node` (in `node`'s own space), its `muzzleAt` if set; measured once per
 * model (`key`, its file) and kept.
 */
export function muzzlePoint(node: TransformNode, at: ModelPoint | undefined, key: string): Vector3 {
  if (at) return new Vector3(at[0], at[1], at[2]);
  let p = measured.get(key);
  if (p === undefined) {
    node.computeWorldMatrix(true);
    const toNode = node.getWorldMatrix().clone().invert();
    const pts: number[] = [];
    const v = new Vector3();
    for (const m of node.getChildMeshes(false)) {
      const pos = m.getVerticesData(VertexBuffer.PositionKind);
      if (!pos) continue;
      m.computeWorldMatrix(true);
      const toLocal = m.getWorldMatrix().multiply(toNode);
      // Every few vertices is plenty for the front's middle (a gun has thousands).
      const step = Math.max(1, Math.floor(pos.length / 3 / 4000));
      for (let i = 0; i < pos.length / 3; i += step) {
        Vector3.TransformCoordinatesFromFloatsToRef(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, toLocal, v);
        pts.push(v.x, v.y, v.z);
      }
    }
    p = frontCentre(pts);
    measured.set(key, p);
  }
  if (p) return new Vector3(p[0], p[1], p[2]);
  // No geometry to read: the front of the bounds, a little above the middle (as before).
  const { min, max } = node.getHierarchyBoundingVectors(true);
  const inv = Matrix.Invert(node.getWorldMatrix());
  const lo = Vector3.TransformCoordinates(min, inv);
  const hi = Vector3.TransformCoordinates(max, inv);
  return new Vector3(0, (lo.y + hi.y) / 2 + (hi.y - lo.y) * 0.2, Math.max(lo.z, hi.z));
}
