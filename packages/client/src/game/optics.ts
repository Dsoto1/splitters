import type { WeaponDefinition } from '@tiletrigger/shared';
import { OPTIC_KINDS, OPTIC_NONE, WEAPON_OPTICS, type OpticKind, type OpticKindId } from '@tiletrigger/shared/optics';

/**
 * Optics by gun (docs/GUNPLAY_SPEC.md §15, "Optics by gun"; owner, 2026-11-18: "real optics by gun: red dot or
 * holographic for close range, 2-3x for rifles and carbines, a full scope for snipers, each with its own reticle").
 *
 * content/optics.json says what each kind is and which gun carries which (shared optics.generated.ts, loaded with the
 * match's view); this module reads it for the client: the optic a weapon carries, where its glass is on the model,
 * and how big its sight picture is drawn. No engine code here (opticHousing.ts builds the housings).
 *
 * How each kind aims:
 *  - `irons`: down the gun's own sights (sightPose.ts, the sight fit); no mark on the HUD, the front sight is the aim;
 *  - `reddot`, `holo`: a housing built in code on the gun's top; the eye comes behind its glass and the mark is drawn
 *    on the glass, on the point of aim (the middle of the view: rounds leave the eye along the aim, §5), so it stays
 *    there while the gun bobs and kicks and is hidden where the window is not;
 *  - `scope`: the 2-3x optics: the model's own tube (`view.optic`, opticView.ts) or the scope overlay
 *    (`view.zoomFov`), with a chevron and holdover ticks;
 *  - `sniper`: the full-screen scope with a fine crosshair and holdover marks.
 * A weapon without one (`OPTIC_NONE`) keeps the aim it had: the gun's top under the eye and the HUD's aim dot.
 */

/** The hip's vertical field of view (radians): view.ts's DEFAULT_FOV, and tools/content/optics.mjs's HIP_FOV. */
export const HIP_FOV = 1.35;

/** The optic a weapon carries. */
export interface CarriedOptic {
  id: OpticKindId;
  kind: OpticKind;
  /** Its own magnification over the hip view (magnified optics). */
  mag?: number;
  /** Where a housing built in code stands (model space) and its size. */
  mount?: { at: readonly [number, number, number]; scale: number };
}

/** The optic `def` carries (`choice`: another of its allowed ones; the loadout's choice comes later), or null: none. */
export function opticOf(def: Pick<WeaponDefinition, 'id'>, choice?: OpticKindId): CarriedOptic | null {
  const w = WEAPON_OPTICS[def.id];
  if (!w) return null;
  const id = choice && w.allowed.includes(choice) ? choice : w.default;
  return { id, kind: OPTIC_KINDS[id], ...(w.mag ? { mag: w.mag } : {}), ...(w.mount ? { mount: w.mount } : {}) };
}

/** Why a weapon carries no optic (undefined: it carries one). */
export const opticNone = (def: Pick<WeaponDefinition, 'id'>): string | undefined => OPTIC_NONE[def.id];

/** An optic whose housing is built in code and whose mark is drawn on its glass. */
export function hasGlass(o: CarriedOptic | null): o is CarriedOptic & { mount: NonNullable<CarriedOptic['mount']>; kind: OpticKind & { glass: NonNullable<OpticKind['glass']>; mark: NonNullable<OpticKind['mark']> } } {
  return !!o && (o.kind.housing === 'tube' || o.kind.housing === 'frame') && !!o.mount && !!o.kind.glass && !!o.kind.mark;
}

/** The middle of a mounted optic's glass (model space, metres). */
export function glassCentre(o: CarriedOptic): [number, number, number] {
  const m = o.mount!;
  return [m.at[0], m.at[1] + o.kind.glass!.rise * m.scale, m.at[2]];
}

/** The window's half width and height (metres). */
export function glassHalf(o: CarriedOptic): [number, number] {
  const g = o.kind.glass!;
  return [g.half[0] * o.mount!.scale, g.half[1] * o.mount!.scale];
}

/** The aimed vertical field of view of a weapon's optic (radians) at its first zoom; null: no optic. */
export function aimedFov(o: CarriedOptic | null): number | null {
  if (!o) return null;
  if (o.mag) return 2 * Math.atan(Math.tan(HIP_FOV / 2) / o.mag);
  return HIP_FOV * (o.kind.adsFov ?? 1);
}

/**
 * The sight picture (depth is the limit on sight size: the camera's near plane keeps a long gun's glass 0.4-0.7 m from
 * the eye, where its window is a few dozen pixels across). A gun with a glass is drawn larger about the view axis as
 * it comes up to the eye (the frame the Battle Rifle's optic uses, opticView.ts: a perspective image depends only on
 * x/z and y/z, so scaling the gun's x and y draws it as a narrower field of view of its own would, with every depth
 * unchanged: nothing comes nearer the near plane). The scale brings the window's half-height to GLASS_SHARE of the
 * screen's, never smaller than drawn plainly, never over PICTURE_MAX.
 */
export const GLASS_SHARE = 0.2;
export const PICTURE_MAX = 3;

/** How much larger the aimed gun is drawn: `depth` the glass's distance ahead of the eye (m), `fov` the aimed field of view. */
export function pictureScale(o: CarriedOptic | null, depth: number, fov: number): number {
  if (!hasGlass(o) || !(depth > 0)) return 1;
  const plain = glassHalf(o)[1] / depth / Math.tan(fov / 2);
  return Math.max(1, Math.min(PICTURE_MAX, GLASS_SHARE / plain));
}

/**
 * The mark's brightness (0..1), steady: a reticle never flickers or blooms (CLAUDE.md, Accessibility). Capped under
 * the bloom threshold's reach; Reduce flashing lowers it a little more and drops the soft halo.
 */
export const MARK_GAIN = 0.92;
export const MARK_GAIN_CALM = 0.8;
/** The mark's colour (linear-ish RGB, each under 1: a saturated red whose brightness stays under High's bloom threshold). */
export const MARK_COLOUR: readonly [number, number, number] = [1, 0.16, 0.12];

/** Whether a point `t` (tangents of the angles across and up from the aim) is on a kind's mark: the test's reading of the shader. */
export function onMark(kind: OpticKind, t: readonly [number, number]): boolean {
  const m = kind.mark;
  if (!m) return false;
  const r = Math.hypot(t[0], t[1]);
  if (r <= m.dot) return true;
  if (kind.reticle !== 'ring' || !m.ring) return false;
  const w = ringWidth(m.ring);
  if (Math.abs(r - m.ring) <= w / 2) return true;
  // Four ticks outside the ring, on the axes.
  return r > m.ring && r <= m.ring * RING_TICK && Math.min(Math.abs(t[0]), Math.abs(t[1])) <= w / 2;
}

/** A ring's line width for its radius, and how far its four ticks reach (a multiple of the radius). */
export const ringWidth = (ring: number): number => ring * 0.09;
export const RING_TICK = 1.32;
