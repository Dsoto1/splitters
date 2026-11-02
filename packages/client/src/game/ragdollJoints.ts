import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';

/**
 * Ragdoll joint limits that hold for every rig.
 *
 * A ragdoll's joints were free balls: an elbow or knee could bend backwards,
 * a thigh swing up behind the back, a head or arm twist right round, so
 * bodies came to rest folded in impossible ways. Each joint now has a frame
 * on each of its two bodies and limits on the three angles between them
 * (Rapier's angular limits: 2·asin of the relative rotation's x, y and z).
 *
 * The frames are anatomical, made from where the joints are at the moment of
 * death (world positions only), never from a bone's own axes: the modular rig
 * and the whole-body Meshy rigs orient their bones differently and stand in
 * different rest poses, so limits written against bone axes would hold for one
 * rig and hyperextend another. In every frame Y runs along the limb (the
 * twist), X is the bend axis and Z = X × Y.
 *
 * - body: up is pelvis → neck, right is the right hip (or shoulder) side, forward = right × up;
 * - neck, spine: X is the body's right, Y the head's (spine's) direction; neutral is in line with the torso;
 * - shoulder: neutral is the arm out to the side, X forward (the raise axis, mirrored on the left);
 *   the upper arm's own X comes from its elbow's bend, so its twist is real;
 * - hip: neutral is the leg straight down, X the body's right; the thigh's own X is its knee's axis;
 * - elbow, knee: hinges about the axis of the bend they have at death (a limb in an animation pose
 *   never bends the wrong way); a straight one bends forward (elbow) or back (knee).
 *
 * Every range is widened to take the pose at death (a body that died mid-kick
 * starts inside its limits, rather than being snapped into them).
 */
export type RagdollJoint = 'neck' | 'spine' | 'shoulder' | 'elbow' | 'hip' | 'knee';
export type Side = 'l' | 'r' | null;
export type Range = readonly [number, number];
/** Angular limits (radians) about the joint frame's X (bend), Y (twist, along the limb) and Z. */
export interface JointLimits {
  x: Range;
  y: Range;
  z: Range;
}

/**
 * Anatomical ranges, for the right side (the left mirrors Z). Signs: +X bends
 * the limb's Y towards X × Y: the head nods forward, the arm rises, the thigh
 * swings back, an elbow or knee folds; +Z moves a right arm back and a right
 * leg in towards the other.
 */
export const JOINT_LIMITS: Readonly<Record<RagdollJoint, JointLimits>> = {
  neck: { x: [-0.6, 0.8], y: [-0.8, 0.8], z: [-0.5, 0.5] },
  spine: { x: [-0.4, 0.7], y: [-0.5, 0.5], z: [-0.4, 0.4] },
  shoulder: { x: [-1.55, 1.3], y: [-1.0, 1.0], z: [-1.5, 0.5] },
  elbow: { x: [-0.05, 2.6], y: [-0.5, 0.5], z: [-0.1, 0.1] },
  hip: { x: [-2.0, 0.45], y: [-0.5, 0.5], z: [-0.8, 0.25] },
  knee: { x: [-0.05, 2.5], y: [-0.12, 0.12], z: [-0.1, 0.1] },
};

/** How far a range is widened past the pose at death (radians). */
const SLACK = 0.05;
/** A joint counts as bent (its own bend gives the hinge axis) past this angle's sine (~15°). */
const BENT = 0.26;

/** The body's axes at death. */
export interface BodyFrame {
  right: Vector3;
  up: Vector3;
  forward: Vector3;
}

const unit = (v: Vector3, fallback: Vector3): Vector3 => {
  const l = v.length();
  return l > 1e-4 ? v.scale(1 / l) : fallback.clone();
};

/** `v` with its part along unit `axis` taken out, normalized (fallback when nothing is left). */
const across = (v: Vector3, axis: Vector3, fallback: Vector3): Vector3 => unit(v.subtract(axis.scale(Vector3.Dot(v, axis))), fallback);

/** A perpendicular to unit `v` (any). */
const anyPerp = (v: Vector3): Vector3 => across(Math.abs(v.y) < 0.9 ? Vector3.Up() : Vector3.Right(), v, Vector3.Forward());

/**
 * The body's frame: up along the torso, right towards `rightRef` (right hip minus left hip),
 * forward = right × up. `facing` (the way the character faced, horizontal) settles which way is
 * forward if the rig's left and right are swapped, and stands in when the hips coincide.
 */
export function bodyFrame(pelvis: Vector3, neck: Vector3, rightRef: Vector3 | null, facing: Vector3 | null): BodyFrame {
  const up = unit(neck.subtract(pelvis), Vector3.Up());
  let right: Vector3 | null = rightRef && rightRef.length() > 0.03 ? across(rightRef, up, Vector3.Zero()) : null;
  if (right && right.length() < 0.5) right = null;
  if (!right) right = facing ? across(Vector3.Cross(up, facing), up, anyPerp(up)) : anyPerp(up);
  let forward = Vector3.Cross(right, up);
  if (facing && Vector3.Dot(forward, facing) < 0) {
    right = right.scale(-1);
    forward = forward.scale(-1);
  }
  return { right, up, forward };
}

/**
 * A hinge's axis (elbow, knee) from the directions of its two limbs: the axis of the bend it has, so
 * that +X folds it; a straight limb folds towards `bendToward` (forward for an elbow, back for a knee).
 */
export function hingeAxis(upper: Vector3, lower: Vector3, bendToward: Vector3): Vector3 {
  const c = Vector3.Cross(upper, lower);
  if (c.length() > BENT && Vector3.Dot(upper, lower) > -0.95) return c.normalize();
  const b = across(bendToward, upper, anyPerp(upper));
  return unit(Vector3.Cross(upper, b), anyPerp(upper));
}

/** The rotation whose X axis is `x` (made square to `y`), Y axis `y` and Z axis x × y. */
export function frameOf(x: Vector3, y: Vector3): Quaternion {
  const Y = unit(y, Vector3.Up());
  const X = across(x, Y, anyPerp(Y));
  const Z = Vector3.Cross(X, Y);
  // Rows are where X, Y and Z go (Babylon's row vectors): a proper rotation, as Z = X × Y.
  return Quaternion.FromRotationMatrix(Matrix.FromValues(X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, 0, 0, 0, 1));
}

/** The angles Rapier limits between two joint frames (world rotations): 2·asin of parent⁻¹·child's x, y, z. */
export function jointAngles(parent: Quaternion, child: Quaternion): Vector3 {
  const r = Quaternion.Inverse(parent).multiply(child);
  const s = r.w < 0 ? -1 : 1;
  const a = (v: number) => 2 * Math.asin(Math.max(-1, Math.min(1, v * s)));
  return new Vector3(a(r.x), a(r.y), a(r.z));
}

/** Where one joint's frames sit (world rotations at death) and its limits. */
export interface JointSetup {
  parent: Quaternion;
  child: Quaternion;
  limits: JointLimits;
}

/**
 * One joint's frames and limits. `parentDir` and `childDir` are the two
 * limbs' directions (unit, from the joint outwards; the torso's runs pelvis →
 * neck); `hinge` is the child limb's own bend axis (the elbow's for an upper
 * arm or forearm, the knee's for a thigh or shin; see hingeAxis).
 */
export function jointSetup(kind: RagdollJoint, side: Side, body: BodyFrame, parentDir: Vector3, childDir: Vector3, hinge: Vector3 | null): JointSetup {
  const s = side === 'l' ? -1 : 1;
  let parent: Quaternion;
  let child: Quaternion;
  switch (kind) {
    case 'neck':
    case 'spine':
      parent = frameOf(body.right, parentDir);
      child = frameOf(body.right, childDir);
      break;
    case 'shoulder': {
      // Neutral: the arm out to the side; X forward on the right, back on the left, so +X raises either arm.
      parent = frameOf(body.forward.scale(s), body.right.scale(s));
      const h = hinge ?? hingeAxis(childDir, childDir, body.forward);
      child = frameOf(Vector3.Cross(h, childDir).scale(s), childDir);
      break;
    }
    case 'hip':
      // Neutral: the leg straight down; X the body's right, which is a straight knee's axis.
      parent = frameOf(body.right, body.up.scale(-1));
      child = frameOf(hinge ?? body.right, childDir);
      break;
    case 'elbow':
    case 'knee': {
      const h = hinge ?? hingeAxis(parentDir, childDir, kind === 'elbow' ? body.forward : body.forward.scale(-1));
      parent = frameOf(h, parentDir);
      child = frameOf(h, childDir);
      break;
    }
  }
  const base = JOINT_LIMITS[kind];
  const mirror = (r: Range): Range => (s < 0 ? [-r[1], -r[0]] : r);
  const now = jointAngles(parent, child);
  const widen = (r: Range, v: number): Range => [Math.min(r[0], v - SLACK), Math.max(r[1], v + SLACK)];
  return { parent, child, limits: { x: widen(base.x, now.x), y: widen(base.y, now.y), z: widen(mirror(base.z), now.z) } };
}

/** What planJoints needs of a ragdoll segment (ragdoll.ts): a capsule from joint `from` to `to`, jointed to `parent` at `at`. */
export interface PlanSegment {
  bone: string;
  from: string;
  to: string;
  side?: 'l' | 'r';
  parent?: { segment: string; at: string; joint: RagdollJoint };
}

/** A ragdoll's joints planned from where its joints are: the body's frame, each segment's direction and each joint's setup. */
export interface JointPlan {
  frame: BodyFrame;
  dirs: Map<string, Vector3>;
  joints: Map<string, JointSetup>;
}

const TRUNK = new Set(['pelvis', 'spine_02', 'neck_01']);

/**
 * Plan a ragdoll's joints from the world positions of its joints at death
 * (`at`: null for a joint the rig doesn't have; segments missing an end are
 * left out). Directions of folded segments (both ends in one place) fall back
 * to hanging down (limbs) or running up the body (trunk).
 */
export function planJoints(at: (joint: string) => Vector3 | null, segments: readonly PlanSegment[], facing: Vector3 | null): JointPlan {
  const segs = segments.filter((s) => at(s.from) && at(s.to));
  const pelvis = at('pelvis') ?? Vector3.Zero();
  const hip = (s: 'l' | 'r') => at(`thigh_${s}`) ?? at(`upperarm_${s}`);
  const hipL = hip('l');
  const hipR = hip('r');
  const frame = bodyFrame(pelvis, at('neck_01') ?? pelvis.add(Vector3.Up()), hipL && hipR ? hipR.subtract(hipL) : null, facing);
  const dirs = new Map<string, Vector3>();
  for (const seg of segs) {
    const d = at(seg.to)!.subtract(at(seg.from)!);
    dirs.set(seg.bone, d.length() > 0.02 ? d.normalize() : TRUNK.has(seg.bone) ? frame.up.clone() : frame.up.scale(-1));
  }
  const hinges = new Map<string, Vector3>();
  for (const s of ['l', 'r'] as const) {
    for (const [upper, lower, toward] of [
      [`upperarm_${s}`, `lowerarm_${s}`, frame.forward],
      [`thigh_${s}`, `calf_${s}`, frame.forward.scale(-1)],
    ] as const) {
      const u = dirs.get(upper);
      const l = dirs.get(lower);
      if (!u) continue;
      const h = hingeAxis(u, l ?? u, toward);
      hinges.set(upper, h);
      if (l) hinges.set(lower, h);
    }
  }
  const joints = new Map<string, JointSetup>();
  for (const seg of segs) {
    const p = seg.parent;
    const pd = p && dirs.get(p.segment);
    if (!p || !pd) continue;
    // Which side a limb is on is where it is, not what the rig calls it (a rig with left and right swapped).
    const out = Vector3.Dot(at(seg.from)!.subtract(pelvis), frame.right);
    const side = !seg.side ? null : Math.abs(out) > 0.02 ? (out > 0 ? 'r' : 'l') : seg.side;
    joints.set(seg.bone, jointSetup(p.joint, side, frame, pd, dirs.get(seg.bone)!, hinges.get(seg.bone) ?? null));
  }
  return { frame, dirs, joints };
}
