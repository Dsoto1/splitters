import type { OpticSpec } from '@tiletrigger/shared';

/**
 * A real optic (a weapon's `view.optic`, docs/ARSENAL.md "Battle Rifle optic"): aiming down the sights brings the
 * eyepiece of the model's own scope tube to the eye, and you look through it at a magnified view with a reticle.
 *
 * How it is drawn, with no second render of the scene: the camera narrows to the optic's magnification (the world as
 * the scope shows it: `mag` times the hip view, so the post-processing, fog and level of detail are the scene's own),
 * while the gun is drawn at a field of view of its own, by squashing it across the view axis
 * (`squash`, on the node between the camera and the gun: a perspective image depends only on x/z and y/z, so scaling
 * x and y by tan(world)/tan(gun) draws it as that field of view would). Its field of view is chosen so the
 * eyepiece's glass fills LENS_SHARE of the screen's half-height. A depth-only disc on the glass keeps the inside of the
 * tube from drawing over the view, and the HUD shades everything round the glass (the eyepiece's shadow: the
 * magnified world outside it is never seen plainly) and draws the reticle in it.
 *
 * `blend` (0..1) eases the eye onto the scope once the sights are up: both fields of view slide between the sights'
 * and the optic's (in tangent space), so the eyepiece grows into the lens instead of jumping.
 */
export const LENS_SHARE = 0.62;
/** Eye relief when the weapon gives none (m): beyond the camera's near plane (0.1 m) with room for the rim. */
export const DEFAULT_RELIEF = 0.12;
/** Seconds to bring the eye onto the scope once the sights are up, and to come off it. */
export const OPTIC_IN = 0.12;
export const OPTIC_OUT = 0.08;

export interface OpticFrame {
  /** The camera's vertical field of view (radians). */
  worldFov: number;
  /** The field of view the gun is drawn at (radians). */
  gunFov: number;
  /** Scale across the view axis for the gun (x and y; z stays 1). */
  squash: number;
  /** The glass's radius on screen, as a share of the screen's half-height. */
  lens: number;
  /** Magnification of the view over the hip view at this blend. */
  mag: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** The view at `blend` for an optic, from the sights' field of view `adsFov` (both vertical, radians). */
export function opticFrame(optic: OpticSpec, adsFov: number, hipFov: number, blend: number): OpticFrame {
  const e = ease(Math.max(0, Math.min(1, blend)));
  const relief = optic.relief ?? DEFAULT_RELIEF;
  const adsTan = Math.tan(adsFov / 2);
  const worldTan = adsTan + (Math.tan(hipFov / 2) / optic.mag - adsTan) * e;
  const gunTan = adsTan + (optic.radius / relief / LENS_SHARE - adsTan) * e;
  return {
    worldFov: 2 * Math.atan(worldTan),
    gunFov: 2 * Math.atan(gunTan),
    squash: worldTan / gunTan,
    lens: optic.radius / relief / gunTan,
    mag: Math.tan(hipFov / 2) / worldTan,
  };
}
