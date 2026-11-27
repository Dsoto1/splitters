import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/**
 * Standing still: the legs squared after the clips (owner, 2026-11-27: "notice the characters bowed legs, more so
 * towards the ankles"; docs/CHARACTER_LIMBS.md). The shared standing armed clips (aim_idle, idle) stand every body
 * with its knees bowed out 6°/10°, the left shin leaning out 8°, the right knee pointing 44° out and its toes 30° out:
 * on wide hips and bare shins that reads as bow legs and splayed ankles. This pass, run on the clips' pose while the
 * feet are planted, re-solves each leg as a two-bone chain: the hip where the clip put it, the ankle at the clip's
 * height and place along the body but no further out than a natural stance, the knee bending toward the way the toes
 * point (a little out from straight ahead), and the foot turned about the vertical so its toes point nearly ahead
 * (its pitch and roll on the ground kept). The knee's bend stays the clip's (the ankle's distance from the hip is
 * only shortened by the stance), so the slight flex of a ready stance is kept.
 */

/** Furthest (degrees) a standing leg's hip-to-ankle line leans out in the front view (the stance a little wider than the hips). */
export const STANCE_LEAN = 3;
/** The share of a wider stance taken in toward it (1: all of it). */
export const STANCE_TAKE = 0.85;
/** Seen from above, the way a standing knee and its toes point: this far (degrees) out from straight ahead. */
export const KNEE_OUT = 6;
export const TOE_OUT = 7;

/** The space the pass works in (the animator's SkeletonSpace): positions and turns read and set there. */
export interface LegSpace {
  point(world: Vector3): Vector3;
  pos(n: TransformNode): Vector3;
  rot(n: TransformNode): Quaternion;
  setRot(n: TransformNode, rot: Quaternion, weight: number): void;
}

export interface Leg {
  thigh: TransformNode;
  calf: TransformNode;
  foot: TransformNode;
  /** The ball of the foot (the toes' joint), for the way the foot points. */
  ball: TransformNode;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** The rotation taking direction `from` to direction `to`. */
function turn(from: Vector3, to: Vector3): Quaternion {
  const q = new Quaternion();
  Quaternion.FromUnitVectorsToRef(from.normalizeToNew(), to.normalizeToNew(), q);
  return q;
}


/** Where the pass puts one leg's knee and ankle (the space's coordinates), from its hip, knee and ankle and the body's frame. */
export function standTargets(
  hip: Vector3,
  knee: Vector3,
  ankle: Vector3,
  up: Vector3,
  out: Vector3,
  forward: Vector3,
): { ankle: Vector3; pole: Vector3 } {
  const thigh = Vector3.Distance(hip, knee);
  const shin = Vector3.Distance(knee, ankle);
  const leg = ankle.subtract(hip);
  const drop = -Vector3.Dot(leg, up);
  const side = Vector3.Dot(leg, out);
  // The ankle no further out than STANCE_LEAN from under the hip (never pushed out: a narrow stance is the clip's).
  const most = Math.max(0, drop) * Math.tan(rad(STANCE_LEAN));
  const inBy = side > most ? (side - most) * STANCE_TAKE : 0;
  const target = ankle.subtract(out.scale(inBy));
  // The knee bends toward the way the toes point: ahead, a little out; from the middle of the hip-to-ankle line.
  const ahead = forward.scale(Math.cos(rad(KNEE_OUT))).add(out.scale(Math.sin(rad(KNEE_OUT))));
  const mid = hip.add(target).scale(0.5);
  return { ankle: target, pole: mid.add(ahead.scale(thigh + shin)) };
}

/**
 * One leg squared (see the file's note), blended by `weight` from the clips' pose. `up`, `out` (away from the body's
 * middle on this leg's side) and `forward` are the body's, in the space's coordinates.
 */
export function standLeg(space: LegSpace, leg: Leg, up: Vector3, out: Vector3, forward: Vector3, weight: number): void {
  if (weight <= 0) return;
  const footRot = space.rot(leg.foot);
  const a = space.pos(leg.thigh);
  const b = space.pos(leg.calf);
  const c = space.pos(leg.foot);
  const toes = space.pos(leg.ball).subtract(c);
  const { ankle, pole } = standTargets(a, b, c, up, out, forward);
  const l1 = Vector3.Distance(a, b);
  const l2 = Vector3.Distance(b, c);
  const toTarget = ankle.subtract(a);
  const d = Math.min(Math.max(toTarget.length(), Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999);
  const dir = toTarget.normalize();
  const toPole = pole.subtract(a);
  const bend = toPole.subtract(dir.scale(Vector3.Dot(toPole, dir))).normalize();
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const knee = a.add(dir.scale(l1 * cosA)).add(bend.scale(l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA))));
  space.setRot(leg.thigh, turn(b.subtract(a), knee.subtract(a)).multiply(space.rot(leg.thigh)), weight);
  const b2 = space.pos(leg.calf);
  const c2 = space.pos(leg.foot);
  space.setRot(leg.calf, turn(c2.subtract(b2), a.add(dir.scale(d)).subtract(b2)).multiply(space.rot(leg.calf)), weight);
  // The foot as the clip held it on the ground, turned about the vertical so its toes point TOE_OUT out from ahead.
  const flat = toes.subtract(up.scale(Vector3.Dot(toes, up)));
  let yaw = 0;
  if (flat.lengthSquared() > 1e-10) {
    flat.normalize();
    const want = forward.scale(Math.cos(rad(TOE_OUT))).add(out.scale(Math.sin(rad(TOE_OUT))));
    yaw = Math.atan2(Vector3.Dot(Vector3.Cross(flat, want), up), Vector3.Dot(flat, want));
  }
  space.setRot(leg.foot, Quaternion.RotationAxis(up, yaw).multiply(footRot), weight);
}

/**
 * Both legs squared, blended by `weight`. `up` and `forward` are world directions (the body's up and the way it
 * faces); the legs' sides come from the hips.
 */
export function standLegs(space: LegSpace, legs: { l: Leg; r: Leg }, upWorld: Vector3, forwardWorld: Vector3, weight: number): void {
  if (weight <= 0.001) return;
  const o = space.point(Vector3.Zero());
  const up = space.point(upWorld).subtract(o).normalize();
  const hl = space.pos(legs.l.thigh);
  const hr = space.pos(legs.r.thigh);
  const across = hr.subtract(hl);
  across.subtractInPlace(up.scale(Vector3.Dot(across, up)));
  if (across.lengthSquared() < 1e-10) return;
  across.normalize();
  const fw = space.point(forwardWorld).subtract(o);
  fw.subtractInPlace(up.scale(Vector3.Dot(fw, up))).subtractInPlace(across.scale(Vector3.Dot(fw, across)));
  if (fw.lengthSquared() < 1e-10) return;
  fw.normalize();
  // (Toward the toes, whichever way the root's frame reads: the clips stand every body with its feet ahead.)
  const toes = space.pos(legs.l.ball).subtract(space.pos(legs.l.foot)).add(space.pos(legs.r.ball).subtract(space.pos(legs.r.foot)));
  if (Vector3.Dot(toes, fw) < 0) fw.negateInPlace();
  standLeg(space, legs.l, up, across.negate(), fw, weight);
  standLeg(space, legs.r, up, across, fw, weight);
}
