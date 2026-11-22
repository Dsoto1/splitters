import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TICK_RATE, type ModelPoint, type WeaponDefinition, type WeaponHold } from '@tiletrigger/shared';

/**
 * Long melee weapons in first person (owner, 2026-11-22: the Katana, Scimitar, Baseball Bat and Battle Axe showed
 * only the blade, the hands below the frame; docs/CHARACTERS.md, "Long melee in first person").
 *
 * A melee weapon whose grip lies well back from the middle of its model (`hold.grip`, model z) is a long one: its
 * viewmodel is placed by its grip, not by `viewOffset`. The grip goes to a fixed place in the lower right of the view,
 * where the hands show, and the weapon is turned from there: a blade, bat or axe stands raised and leaning in (a
 * ready stance), a polearm (one reaching further than POLE_REACH ahead of the hand: the Spear) points ahead along the
 * aim. Both hands hold it in first person: the support hand goes a hand's width behind the grip (toward the pommel),
 * a polearm's ahead of it along the shaft. The same rule for every long melee weapon, from its grip and measured
 * length, none per weapon. Third person is unchanged (the weapon rides in the right hand, `hold.style` melee).
 *
 * The swing is a pose curve over the strike (meleeSwing): a blade winds up over the shoulder and cuts down and across
 * to the left, a polearm draws back and thrusts. The draw (the match's raise) brings it up from low on the right
 * shoulder. Nothing here flashes (Reduce flashing): the weapon only moves.
 */

/** A melee weapon's grip this far (model m) or more behind its model's middle makes it a long one (the knife's is 0.1). */
export const LONG_MELEE_GRIP = 0.2;
/** Reach (model m, from the grip to the far end) past which a long melee weapon is a polearm, held level and thrust. */
export const POLE_REACH = 1.2;
/** How far (model m) behind the grip the support hand goes on a blade, bat or axe (about a hand's width), and ahead of it on a polearm. */
export const SUPPORT_BACK = 0.085;
export const POLE_SUPPORT_AHEAD = 0.3;
/** Seconds the swing's pose curve lasts at most (a slower weapon's swing still ends here; a quicker one sooner). */
export const SWING_SECONDS = 0.5;

/** The viewmodel's place under the camera: position (m, camera space: +x right, +y up, +z ahead) and Euler turn (radians, as a TransformNode's rotation: x nose down, y to the right, z roll). */
export interface MeleePlacement {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

/** A pose: where the grip is in the view (camera space, m) and the weapon's turn about it. */
interface Key {
  at: number;
  hand: readonly [number, number, number];
  pitch: number;
  yaw: number;
  roll: number;
}

/**
 * Blade, bat, axe. Rest: the grip low in the lower right, the weapon raised about 55 degrees and leaning in a little,
 * so both hands and the length of the blade show and the middle of the view stays clear. The swing: wind up (back
 * over the shoulder), cut down and across to the lower left, come back.
 */
const BLADE_REST: Key = { at: 0, hand: [0.15, -0.13, 0.42], pitch: -0.72, yaw: -0.28, roll: -0.35 };
const BLADE_SWING: readonly Key[] = [
  BLADE_REST,
  { at: 0.2, hand: [0.21, -0.13, 0.34], pitch: -1.25, yaw: -0.05, roll: -0.55 },
  { at: 0.5, hand: [-0.04, -0.25, 0.46], pitch: 0.3, yaw: -0.95, roll: -1.1 },
  { ...BLADE_REST, at: 1 },
];
/** Blade, bat, axe drawn: low on the right, laid back over the shoulder (raise 1), coming up to rest. */
const BLADE_DRAW: Key = { at: 0, hand: [0.26, -0.5, 0.32], pitch: -1.7, yaw: 0.25, roll: -0.2 };

/** Polearm. Rest: the shaft along the aim, the lead hand low on the right, the point a little up. The swing: draw back, thrust. */
const POLE_REST: Key = { at: 0, hand: [0.17, -0.2, 0.36], pitch: -0.08, yaw: -0.12, roll: 0 };
const POLE_SWING: readonly Key[] = [
  POLE_REST,
  { at: 0.25, hand: [0.19, -0.19, 0.27], pitch: -0.12, yaw: -0.1, roll: 0.05 },
  { at: 0.5, hand: [0.11, -0.17, 0.62], pitch: -0.02, yaw: -0.14, roll: 0 },
  { ...POLE_REST, at: 1 },
];
const POLE_DRAW: Key = { at: 0, hand: [0.24, -0.5, 0.3], pitch: -0.6, yaw: 0.2, roll: 0.1 };

/** Whether `def` is a long melee weapon (held by its grip in first person, with both hands). */
export function isLongMelee(def: WeaponDefinition | undefined): boolean {
  return !!def && def.kind === 'melee' && -def.view.hold.grip[2] >= LONG_MELEE_GRIP;
}

/** Whether a long melee weapon is a polearm: `tipZ` (model m) is the model's front end, measured; unknown counts as a blade. */
export function isPolearm(def: WeaponDefinition, tipZ?: number): boolean {
  return tipZ !== undefined && tipZ - def.view.hold.grip[2] > POLE_REACH;
}

/**
 * The hold first person uses: a long melee weapon two-handed (the shooting hand on its grip, the support hand behind
 * it along the handle, held as a long gun's hands are); any other weapon its own hold.
 */
export function firstPersonHold(def: WeaponDefinition, tipZ?: number): WeaponHold {
  const hold = def.view.hold;
  if (!isLongMelee(def)) return hold;
  const g = hold.grip;
  // (A polearm's support hand leads, ahead of the grip along the shaft: the shooting hand drives the thrust from behind.)
  const support: ModelPoint = isPolearm(def, tipZ) ? [g[0], g[1], g[2] + POLE_SUPPORT_AHEAD] : [g[0], g[1], g[2] - SUPPORT_BACK];
  return { style: 'long', grip: g, support };
}

/** How long (s) a long melee weapon's swing curve lasts: most of its time between strikes, at most SWING_SECONDS. */
export function swingSeconds(def: WeaponDefinition): number {
  return Math.max(0.25, Math.min(SWING_SECONDS, (def.fireIntervalTicks / TICK_RATE) * 0.85));
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function blend(a: Key, b: Key, t: number): Key {
  return {
    at: lerp(a.at, b.at, t),
    hand: [lerp(a.hand[0], b.hand[0], t), lerp(a.hand[1], b.hand[1], t), lerp(a.hand[2], b.hand[2], t)],
    pitch: lerp(a.pitch, b.pitch, t),
    yaw: lerp(a.yaw, b.yaw, t),
    roll: lerp(a.roll, b.roll, t),
  };
}

function along(keys: readonly Key[], u: number): Key {
  const v = Math.max(0, Math.min(1, u));
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (v <= b.at) return blend(a, b, smooth((v - a.at) / Math.max(1e-6, b.at - a.at)));
  }
  return keys[keys.length - 1]!;
}

/**
 * Where a long melee weapon's viewmodel goes. `swing`: how far through the swing (0..1, null: none), `raise`: the
 * draw still to go (1 just switched to, 0 up), `level`: 0..1 toward pointing along the aim (the Battle Axe's barrel
 * going off: it fires from where you look, not from the sky).
 */
export function meleePlacement(def: WeaponDefinition, o: { tipZ?: number; swing?: number | null; raise?: number; level?: number } = {}): MeleePlacement {
  const pole = isPolearm(def, o.tipZ);
  let key = o.swing === null || o.swing === undefined ? (pole ? POLE_REST : BLADE_REST) : along(pole ? POLE_SWING : BLADE_SWING, o.swing);
  if (o.raise) key = blend(key, pole ? POLE_DRAW : BLADE_DRAW, smooth(Math.max(0, Math.min(1, o.raise))));
  if (o.level) key = blend(key, { ...key, pitch: 0, yaw: 0, roll: 0 }, Math.max(0, Math.min(1, o.level)));
  return placeByGrip(def.view.hold.grip, key);
}

/** The viewmodel's position that puts the model point `grip` at `key.hand`, turned by the key's angles. */
function placeByGrip(grip: ModelPoint, key: Key): MeleePlacement {
  const rot = Quaternion.RotationYawPitchRoll(key.yaw, key.pitch, key.roll);
  const g = new Vector3(grip[0], grip[1], grip[2]).applyRotationQuaternion(rot);
  return { x: key.hand[0] - g.x, y: key.hand[1] - g.y, z: key.hand[2] - g.z, pitch: key.pitch, yaw: key.yaw, roll: key.roll };
}

/** A model point of the weapon, in camera space, with the viewmodel at `p` (tests: where the hands' points are). */
export function placedPoint(p: MeleePlacement, point: ModelPoint): [number, number, number] {
  const v = new Vector3(point[0], point[1], point[2]).applyRotationQuaternion(Quaternion.RotationYawPitchRoll(p.yaw, p.pitch, p.roll));
  return [p.x + v.x, p.y + v.y, p.z + v.z];
}
