import type { WeaponDefinition } from '@tiletrigger/shared';
import { SIGHT_FITS, type SightFit } from '@tiletrigger/shared/sightFit';
import { DEFAULT_RELIEF } from './opticView.ts';
import { glassCentre, hasGlass, opticOf, type CarriedOptic } from './optics.ts';

/**
 * Where the first-person gun sits aiming down the sights (docs/GUNPLAY_SPEC.md §15, "Sights that line up"; owner,
 * 2026-11-18: "aiming down sights puts the camera exactly behind each gun's own drawn sights").
 *
 * A gun with a sight fit (shared sightFit.generated.ts, measured from its model by tools/content/sight-fit.mjs) is
 * turned and moved so the fit's `eye` point is the camera and the line from it to the front sight's top is the view
 * axis: the front sight sits on the crosshair's centre, where the round goes (rounds leave from the eye along the
 * aim, §5), seen through the aperture or over the notch as the fit's `rear` says. Only the placement at full aim
 * changes: the blend, the field of view, the bob, the kick and the sway are the view's own, as before.
 *
 * A gun with an optic in its model (`view.optic`) brings its eyepiece to the eye (opticView.ts); a gun that carries a
 * red dot or a holographic sight (optics.ts, a housing built in code on its top) is moved so the eye looks along the
 * barrel through the middle of its glass; and a gun with neither sights nor an optic keeps the placement every gun
 * had before: centred, the top of its bounds just under the eye line, pushed forward until its stock is out of view.
 */

/** Field of view while aiming down the sights, as a fraction of the normal one. */
export const ADS_FOV = 0.72;
/** The eye line's height over the top of an unfitted gun's bounds (m). */
export const UNFITTED_OVER = 0.006;
/** How far ahead of the eye a gun's rear end stays when aimed (m): out of view, clear of the near plane with its kick. */
export const STOCK_AHEAD = 0.2;
/** A fitted gun's sights lie this close to the aim, as placed (degrees): the audit's and the unit test's pass mark. */
export const SIGHT_TOLERANCE_DEG = 0.1;

/** A viewmodel's place under the camera: its position and its turn about x (nose down) and y (camera space, metres and radians). */
export interface GunPlacement {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
}

/** What the view measures of a loaded viewmodel (its own space): the top and the rear end of its bounds. */
export interface GunBounds {
  sightTop: number;
  stockZ: number;
}

type Point = readonly [number, number, number];

/** A model-space point under a placement's turn (the engine's order: about x, then about y). */
export function turned(p: Point, pitch: number, yaw: number): [number, number, number] {
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
  const y = p[1] * cp - p[2] * sp;
  const z1 = p[1] * sp + p[2] * cp;
  const [cy, sy] = [Math.cos(yaw), Math.sin(yaw)];
  return [p[0] * cy + z1 * sy, y, -p[0] * sy + z1 * cy];
}

/** A model-space point in camera space under a placement. */
export function placed(p: Point, at: GunPlacement): [number, number, number] {
  const t = turned(p, at.pitch, at.yaw);
  return [t[0] + at.x, t[1] + at.y, t[2] + at.z];
}

/** The placement that puts a fit's eye on the camera, looking along the line to its front sight's top. */
export function sightPlacement(fit: SightFit): GunPlacement {
  const d = [fit.front[0] - fit.eye[0], fit.front[1] - fit.eye[1], fit.front[2] - fit.eye[2]] as const;
  const pitch = Math.atan2(d[1], d[2]);
  const yaw = -Math.atan2(d[0], Math.hypot(d[1], d[2]));
  const e = turned(fit.eye, pitch, yaw);
  return { x: -e[0], y: -e[1], z: -e[2], pitch, yaw };
}

/** The placement of a gun without a fit: the top of its bounds just under the eye line, its rear end STOCK_AHEAD of the eye. */
export function unfittedPlacement(def: WeaponDefinition, bounds: GunBounds): GunPlacement {
  return { x: 0, y: -(bounds.sightTop + UNFITTED_OVER), z: Math.max(def.view.viewOffset[2], STOCK_AHEAD - bounds.stockZ), pitch: 0, yaw: 0 };
}

/**
 * The placement of a gun aimed through a glass on its top (a red dot, a holographic sight): the glass's middle on the
 * view axis, the gun level along it, as far ahead as an unfitted gun (its rear end STOCK_AHEAD of the eye).
 */
export function glassPlacement(def: WeaponDefinition, optic: CarriedOptic, bounds: GunBounds): GunPlacement {
  const c = glassCentre(optic);
  return { x: -c[0], y: -c[1], z: unfittedPlacement(def, bounds).z, pitch: 0, yaw: 0 };
}

/**
 * A weapon's placement at full aim: its model's optic's eyepiece on the eye, else behind the glass of the optic it
 * carries, else its sight fit, else the unfitted placement. `fitted: false` gives the placement from before the fit
 * and the optics (the sight sheet's "before" picture). `carried`: the optic it carries (default: its own).
 */
export function aimPlacement(def: WeaponDefinition, bounds: GunBounds, fitted = true, carried: CarriedOptic | null = opticOf(def)): GunPlacement {
  const optic = def.view.optic;
  if (optic) return { x: -optic.eye[0], y: -optic.eye[1], z: (optic.relief ?? DEFAULT_RELIEF) - optic.eye[2], pitch: 0, yaw: 0 };
  if (fitted && hasGlass(carried)) return glassPlacement(def, carried, bounds);
  const fit = fitted ? SIGHT_FITS[def.id] : undefined;
  return fit ? sightPlacement(fit) : unfittedPlacement(def, bounds);
}

/** The placement `ads` (0..1) of the way from the hip (`view.viewOffset`) to the aim. */
export function blendPlacement(def: WeaponDefinition, aim: GunPlacement, ads: number): GunPlacement {
  const [vx, vy, vz] = def.view.viewOffset;
  return { x: vx + (aim.x - vx) * ads, y: vy + (aim.y - vy) * ads, z: vz + (aim.z - vz) * ads, pitch: aim.pitch * ads, yaw: aim.yaw * ads };
}

/** The angle (degrees) between the view axis and a camera-space point. */
export function offAxis(p: Point): number {
  return (Math.atan2(Math.hypot(p[0], p[1]), p[2]) * 180) / Math.PI;
}

/** How far a fit's sights lie off the aim under a placement (degrees): the larger of its rear and front points' angles. */
export function sightError(fit: SightFit, at: GunPlacement): number {
  return Math.max(offAxis(placed(fit.rear, at)), offAxis(placed(fit.front, at)));
}
