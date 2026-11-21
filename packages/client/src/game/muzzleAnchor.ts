import type { Vec3 } from '@tiletrigger/shared';

/**
 * Where a gun's muzzle is right now, in the world (null while that gun isn't drawn). Effects that start at a gun
 * (beams, lasers, freeze rays, chain lightning, ropes) ask it every frame they draw, after the camera, your
 * first-person gun and the characters' held guns are placed for that frame (view.ts `render`), so their start stays
 * on the muzzle however you strafe, turn or jump. Only the start follows: the far end keeps its own logic (the hit
 * point, the range).
 *
 * Why: a start captured once, when the shot was fired, stays where the gun was in the world. Your gun moves with
 * the camera, so at running speed a beam drawn for 90 ms (or a railgun's for 750 ms) was left up to a metre behind,
 * and the steady beams of Reduce flashing glided after it (owner, 2026-11-16: "it glides around and looks strange").
 */
export type MuzzleAnchor = () => Vec3 | null;

/**
 * A start point that stays on the muzzle: `anchor`'s point each time it's asked, or, while the gun isn't drawn (or
 * there is no anchor), the last point it gave: at first `from`, where the effect began.
 */
export function following(from: Vec3, anchor?: MuzzleAnchor | null): () => Vec3 {
  if (!anchor) return () => from;
  let last = from;
  return () => (last = anchor() ?? last);
}
