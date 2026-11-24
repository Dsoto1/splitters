import type { OpticSpec, WeaponDefinition } from '@tiletrigger/shared';
import { OPTIC_KINDS, OPTIC_NONE, WEAPON_OPTICS, type OpticKind, type OpticKindId } from '@tiletrigger/shared/optics';
import { myOpticFor } from '../opticPrefs.ts';
import { DEFAULT_RELIEF } from './opticView.ts';

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
 *  - `sniper`: the full-screen scope with a fine crosshair and holdover marks;
 *  - `x2`: a 2x optic built in code on the gun's top (a `magtube`), looked through as the model's own tube is
 *    (opticView.ts: its eyepiece comes to the eye, the world magnified by the kind's `power`), with a chevron and
 *    holdover ticks.
 * Which one a gun carries is its default, or the one the player picked for it in their loadout (opticPrefs.ts; others'
 * from the roster's `op`: opticFor).
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
  /** Where a housing built in code stands (model space) and its size; `eye`: the eye's model z behind a 1x glass on a long gun. */
  mount?: { at: readonly [number, number, number]; scale: number; eye?: number };
  /** The model's own open sight instead: its window's middle and half width and height (no housing is built). */
  window?: { at: readonly [number, number, number]; half: readonly [number, number]; round?: boolean };
}

/** The optic `def` carries (`choice`: another of its allowed ones, as a loadout picks; anything else: its default), or null: none. */
export function opticOf(def: Pick<WeaponDefinition, 'id'>, choice?: string): CarriedOptic | null {
  const w = WEAPON_OPTICS[def.id];
  if (!w) return null;
  const id = choice && (w.allowed as readonly string[]).includes(choice) ? (choice as OpticKindId) : w.default;
  const kind = OPTIC_KINDS[id];
  // A gun's own zoom is its own optic's; a magnifying tube built in code brings the kind's.
  const mag = kind.housing === 'magtube' ? kind.power : id === w.default ? w.mag : undefined;
  return { id, kind, ...(mag ? { mag } : {}), ...(w.mount ? { mount: w.mount } : {}), ...(w.window ? { window: w.window } : {}) };
}

/** The optics a player may pick for a gun, its default first; one or none: there is no choice to make. */
export function opticChoices(def: Pick<WeaponDefinition, 'id'>): { id: OpticKindId; name: string }[] {
  const w = WEAPON_OPTICS[def.id];
  if (!w || w.allowed.length < 2) return [];
  return [w.default, ...w.allowed.filter((a) => a !== w.default)].map((id) => ({ id, name: OPTIC_KINDS[id].name }));
}

/** Each player's optic choices as the roster gives them (slot → weapon ID → kind), and your own slot. */
const rosterOptics = new Map<number, Readonly<Record<string, string>>>();
let ownSlot = -1;
let opticsSeen = 0;

/** The roster came (session.ts): everyone's choices. True when any changed. */
export function setRosterOptics(players: readonly { slot: number; op?: Record<string, string> }[], own: number): boolean {
  ownSlot = own;
  let changed = players.length !== rosterOptics.size || players.some((p) => !rosterOptics.has(p.slot));
  const next = new Map<number, Readonly<Record<string, string>>>();
  for (const p of players) {
    const op = p.op ?? {};
    const was = rosterOptics.get(p.slot);
    if (!was || Object.keys(was).length !== Object.keys(op).length || Object.keys(op).some((k) => was[k] !== op[k])) changed = true;
    next.set(p.slot, op);
  }
  rosterOptics.clear();
  for (const [k, v] of next) rosterOptics.set(k, v);
  if (changed) opticsSeen++;
  return changed;
}

/** Goes up whenever someone's optic choices change (the view rebuilds a gun whose optic is no longer the one drawn). */
export const opticsVersion = (): number => opticsSeen;
/** Your own choices changed (opticPrefs.ts): the view draws them from now on. */
export function ownOpticsChanged(): void {
  opticsSeen++;
}

/**
 * The optic `def` carries in the hands of the player in `slot`: yours from your loadout (opticPrefs.ts, at once), anyone
 * else's from the roster (bots and older hosts: none, so each gun's default). No slot: yours.
 */
export function opticFor(def: Pick<WeaponDefinition, 'id'>, slot?: number): CarriedOptic | null {
  if (slot === undefined || slot === ownSlot) return opticOf(def, myOpticFor(def.id));
  return opticOf(def, rosterOptics.get(slot)?.[def.id]);
}

/** A housing built in code on the gun's top: the red dot's tube, the holographic frame or the 2x optic's tube. */
export function builtHousing(o: CarriedOptic | null): o is CarriedOptic & { kind: OpticKind & { glass: NonNullable<OpticKind['glass']> } } {
  return !!o && (o.kind.housing === 'tube' || o.kind.housing === 'frame' || o.kind.housing === 'magtube') && (!!o.mount || !!o.window) && !!o.kind.glass;
}

/**
 * The eyepiece a gun is looked through (opticView.ts): its model's own tube (`view.optic`), or the 2x optic built on its
 * top: the tube's rear end on the line of its glass's middle, its clear radius the glass's, with the usual relief.
 */
export function eyepieceOf(def: Pick<WeaponDefinition, 'view'>, o: CarriedOptic | null): OpticSpec | undefined {
  if (def.view.optic) return def.view.optic;
  if (!o || o.kind.housing !== 'magtube' || !o.mount || !o.kind.glass || !o.mag) return undefined;
  const g = o.kind.glass;
  const m = o.mount;
  return { mag: o.mag, eye: [m.at[0], m.at[1] + g.rise * m.scale, m.at[2] - (g.length * m.scale) / 2], radius: g.half[1] * m.scale, relief: DEFAULT_RELIEF, reticle: 'chevron' };
}

/** Why a weapon carries no optic (undefined: it carries one). */
export const opticNone = (def: Pick<WeaponDefinition, 'id'>): string | undefined => OPTIC_NONE[def.id];

/** An optic whose housing is built in code and whose mark is drawn on its glass. */
export function hasGlass(o: CarriedOptic | null): o is CarriedOptic & { kind: OpticKind & { glass: NonNullable<OpticKind['glass']>; mark: NonNullable<OpticKind['mark']> } } {
  return !!o && (o.kind.housing === 'tube' || o.kind.housing === 'frame') && (!!o.mount || !!o.window) && !!o.kind.glass && !!o.kind.mark;
}

/** The middle of a mounted optic's glass (model space, metres). */
export function glassCentre(o: CarriedOptic): [number, number, number] {
  if (o.window) return [o.window.at[0], o.window.at[1], o.window.at[2]];
  const m = o.mount!;
  return [m.at[0], m.at[1] + o.kind.glass!.rise * m.scale, m.at[2]];
}

/**
 * Where the glass mesh itself goes on the gun (model space): the window's middle, a little ahead of a built housing's
 * (a red dot's round glass 0.3 of its length, a holographic window 0.22, both on the glass's line). opticHousing.ts puts
 * it here; the checks hold it on the aim.
 */
export function glassAt(o: CarriedOptic): [number, number, number] {
  const c = glassCentre(o);
  if (o.window || !o.mount) return c;
  return [c[0], c[1], c[2] + o.kind.glass!.length * o.mount.scale * (o.kind.housing === 'tube' ? 0.3 : 0.22)];
}

/** The window's half width and height (metres). */
export function glassHalf(o: CarriedOptic): [number, number] {
  if (o.window) return [o.window.half[0], o.window.half[1]];
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
export const GLASS_SHARE = 0.13;
export const PICTURE_MAX = 2;

/** How much larger the aimed gun is drawn: `depth` the glass's distance ahead of the eye (m), `fov` the aimed field of view. */
export function pictureScale(o: CarriedOptic | null, depth: number, fov: number): number {
  if (!hasGlass(o) || !(depth > 0)) return 1;
  const plain = glassHalf(o)[1] / depth / Math.tan(fov / 2);
  return Math.max(1, Math.min(PICTURE_MAX, GLASS_SHARE / plain));
}

/**
 * Iron sights on a long gun get the same frame, gently: a rear sight further than IRONS_DEPTH from the eye is drawn as
 * large as it would be at that distance, the gun at most IRONS_MAX times larger (past that the hands, which keep their
 * own size, look small on it). A handgun's sights are already that near: drawn plainly.
 */
export const IRONS_DEPTH = 0.36;
export const IRONS_MAX = 1.6;

/** How much larger a gun aimed down its iron sights is drawn: `rearDepth` its rear sight's distance ahead of the eye (m). */
export function ironsPicture(rearDepth: number): number {
  return Math.max(1, Math.min(IRONS_MAX, rearDepth / IRONS_DEPTH));
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
