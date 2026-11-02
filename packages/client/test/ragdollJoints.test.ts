import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { EffectsWorld, initPhysics } from '@tiletrigger/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { JOINT_LIMITS, frameOf, jointAngles, planJoints, type JointPlan, type JointSetup, type PlanSegment } from '../src/game/ragdollJoints.ts';

beforeAll(() => initPhysics());

/** The full ragdoll's segments (ragdoll.ts FULL, without the capsule sizes). */
const SEGMENTS: PlanSegment[] = [
  { bone: 'pelvis', from: 'pelvis', to: 'neck_01' },
  { bone: 'neck_01', from: 'neck_01', to: 'Head', parent: { segment: 'pelvis', at: 'neck_01', joint: 'neck' } },
  ...(['l', 'r'] as const).flatMap((s): PlanSegment[] => [
    { bone: `upperarm_${s}`, from: `upperarm_${s}`, to: `lowerarm_${s}`, side: s, parent: { segment: 'pelvis', at: `upperarm_${s}`, joint: 'shoulder' } },
    { bone: `lowerarm_${s}`, from: `lowerarm_${s}`, to: `hand_${s}`, side: s, parent: { segment: `upperarm_${s}`, at: `lowerarm_${s}`, joint: 'elbow' } },
    { bone: `thigh_${s}`, from: `thigh_${s}`, to: `calf_${s}`, side: s, parent: { segment: 'pelvis', at: `thigh_${s}`, joint: 'hip' } },
    { bone: `calf_${s}`, from: `calf_${s}`, to: `foot_${s}`, side: s, parent: { segment: `thigh_${s}`, at: `calf_${s}`, joint: 'knee' } },
  ]),
];

type Pose = Record<string, [number, number, number]>;
const v = (p: [number, number, number]) => new Vector3(...p);

/**
 * Rigs as they stand at the moment of death, facing +Z with their right on +X (yaw 0), in the
 * different rest poses and proportions the roster has.
 */
function standing(o: { scale?: number; arms?: 'T' | 'A' | 'aim'; knees?: number; flipSides?: boolean; foldLegs?: boolean } = {}): Pose {
  const k = o.scale ?? 1;
  const p: Pose = { pelvis: [0, 1, 0], neck_01: [0, 1.5, 0.02], Head: [0, 1.65, 0.03] };
  for (const s of ['l', 'r'] as const) {
    const x = (s === 'r' ? 1 : -1) * (o.flipSides ? -1 : 1);
    p[`upperarm_${s}`] = [0.18 * x, 1.45, 0];
    if (o.arms === 'A') {
      p[`lowerarm_${s}`] = [0.36 * x, 1.22, 0];
      p[`hand_${s}`] = [0.52 * x, 1.0, 0.02];
    } else if (o.arms === 'aim') {
      // Holding a rifle: upper arm forward and down, forearm forward and in, elbow bent.
      p[`lowerarm_${s}`] = [0.24 * x, 1.25, 0.2];
      p[`hand_${s}`] = [0.05 * x, 1.32, 0.45];
    } else {
      p[`lowerarm_${s}`] = [0.45 * x, 1.45, 0];
      p[`hand_${s}`] = [0.7 * x, 1.45, 0];
    }
    p[`thigh_${s}`] = [0.1 * x, 0.95, 0];
    const bend = o.knees ?? 0.1;
    // The knee forward of the hip, the foot back under it: knees bend backwards.
    p[`calf_${s}`] = [0.1 * x, 0.95 - 0.45 * Math.cos(bend / 2), 0.45 * Math.sin(bend / 2)];
    p[`foot_${s}`] = [0.1 * x, p[`calf_${s}`]![1] - 0.42 * Math.cos(bend / 2), p[`calf_${s}`]![2] - 0.42 * Math.sin(bend / 2)];
    if (o.foldLegs) {
      // A rolling robot: legs folded onto the pelvis (one place for every leg joint).
      p[`thigh_${s}`] = [0, 1, 0];
      p[`calf_${s}`] = [0, 1, 0];
      p[`foot_${s}`] = [0, 1, 0];
    }
  }
  for (const n of Object.keys(p)) p[n] = p[n]!.map((c) => c * k) as [number, number, number];
  return p;
}

/** The same pose turned `yaw` about the vertical (facing (sin yaw, 0, cos yaw)). */
function turned(p: Pose, yaw: number): Pose {
  const q = Quaternion.RotationAxis(Vector3.Up(), yaw);
  return Object.fromEntries(Object.entries(p).map(([n, c]) => {
    const r = v(c).applyRotationQuaternion(q);
    return [n, [r.x, r.y, r.z]];
  }));
}

const plan = (p: Pose, yaw = 0): JointPlan => planJoints((n) => (p[n] ? v(p[n]!) : null), SEGMENTS, new Vector3(Math.sin(yaw), 0, Math.cos(yaw)));

const inside = (j: JointSetup, a: Vector3) => a.x >= j.limits.x[0] - 1e-6 && a.x <= j.limits.x[1] + 1e-6 && a.y >= j.limits.y[0] - 1e-6 && a.y <= j.limits.y[1] + 1e-6 && a.z >= j.limits.z[0] - 1e-6 && a.z <= j.limits.z[1] + 1e-6;

/** The joint's angles once its child limb has turned by `turn` (world) from the pose at death. */
const after = (j: JointSetup, turn: Quaternion) => jointAngles(j.parent, turn.multiply(j.child));

const RIGS: Record<string, Pose> = {
  'modular, arms down (A)': standing({ arms: 'A' }),
  'Meshy whole-body, T-pose': standing({ arms: 'T' }),
  'aiming, knees bent': standing({ arms: 'aim', knees: 0.9 }),
  'small (0.6)': standing({ arms: 'aim', scale: 0.6 }),
  'large (1.5)': standing({ arms: 'A', scale: 1.5 }),
  'turned 2 rad': turned(standing({ arms: 'aim', knees: 0.5 }), 2),
  "left and right swapped (a mirrored rig's names)": standing({ arms: 'A', flipSides: true }),
  'legs folded onto the pelvis (rolling robot)': standing({ arms: 'aim', foldLegs: true }),
};
const YAW: Record<string, number> = { 'turned 2 rad': 2 };

describe('ragdoll joint frames', () => {
  it('frameOf puts X, Y and Z where asked', () => {
    const x = new Vector3(0, 0, 1);
    const y = new Vector3(0, -1, 0);
    const q = frameOf(x, y);
    expect(Vector3.Right().applyRotationQuaternion(q).subtract(x).length()).toBeLessThan(1e-5);
    expect(Vector3.Up().applyRotationQuaternion(q).subtract(y).length()).toBeLessThan(1e-5);
    expect(Vector3.Forward().applyRotationQuaternion(q).subtract(Vector3.Cross(x, y)).length()).toBeLessThan(1e-5);
  });

  for (const [name, pose] of Object.entries(RIGS)) {
    it(`${name}: every joint starts inside its limits, which stay anatomical`, () => {
      const p = plan(pose, YAW[name] ?? 0);
      expect(p.joints.size).toBe(9);
      // Forward is where the body faced, whatever the rig calls left and right.
      const yaw = YAW[name] ?? 0;
      expect(Vector3.Dot(p.frame.forward, new Vector3(Math.sin(yaw), 0, Math.cos(yaw)))).toBeGreaterThan(0.9);
      for (const [bone, j] of p.joints) {
        expect(inside(j, jointAngles(j.parent, j.child)), bone).toBe(true);
        // Widened only as far as the pose at death needs: no joint gets free rein.
        for (const ax of ['x', 'y', 'z'] as const) expect(j.limits[ax][1] - j.limits[ax][0], `${bone} ${ax}`).toBeLessThan(3.2);
      }
      const f = p.frame.forward;
      const right = p.frame.right;
      for (const s of ['l', 'r'] as const) {
        const knee = p.joints.get(`calf_${s}`)!;
        const shin = p.dirs.get(`calf_${s}`)!;
        const kneeAxis = Vector3.Cross(shin, f).normalize();
        // A knee folds back (a shin swung 60° further towards the back stays inside) but never bends forward.
        expect(inside(knee, after(knee, Quaternion.RotationAxis(kneeAxis, -0.5))), `${s} knee folds`).toBe(true);
        expect(inside(knee, after(knee, Quaternion.RotationAxis(kneeAxis, 1.6))), `${s} knee hyperextends`).toBe(false);
        // A shin can't twist round.
        expect(inside(knee, after(knee, Quaternion.RotationAxis(shin, 1.2))), `${s} shin twists`).toBe(false);
        // An elbow doesn't bend backwards past straight.
        const elbow = p.joints.get(`lowerarm_${s}`)!;
        // The elbow's hinge is its frame's X (+X folds it).
        const hinge = Vector3.Right().applyRotationQuaternion(elbow.parent);
        expect(inside(elbow, after(elbow, Quaternion.RotationAxis(hinge, -2.2))), `${s} elbow hyperextends`).toBe(false);
        // A thigh can't swing up behind the back.
        const hip = p.joints.get(`thigh_${s}`)!;
        const thigh = p.dirs.get(`thigh_${s}`)!;
        if (name.includes('folded')) continue;
        const back = Quaternion.RotationAxis(right, 1.6);
        expect(inside(hip, after(hip, back)), `${s} thigh swings back`).toBe(false);
        // But it can come up forward, as a body folds at the hips.
        expect(inside(hip, after(hip, Quaternion.RotationAxis(right, -1.2))), `${s} thigh comes forward`).toBe(true);
        expect(thigh.y).toBeLessThan(0);
      }
      // The head can't turn round to look behind.
      const neck = p.joints.get('neck_01')!;
      expect(inside(neck, after(neck, Quaternion.RotationAxis(p.frame.up, 2.5))), 'head turns round').toBe(false);
    });
  }

  it('the limits hold in the physics: a knee driven forward stops at straight, holding its pose until then', () => {
    const world = new EffectsWorld([]);
    world.world.gravity = { x: 0, y: 0, z: 0 };
    const pose = standing({ arms: 'aim', knees: 1.0 });
    const p = plan(pose);
    const body = (from: string, to: string) => {
      const a = v(pose[from]!);
      const b = v(pose[to]!);
      const axis = b.subtract(a).normalize();
      const rot = new Quaternion();
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), axis, rot);
      const mid = a.add(b).scale(0.5);
      return { b: world.addBody({ kind: 'capsule', halfHeight: Math.max(0.01, Vector3.Distance(a, b) / 2 - 0.05), radius: 0.05 }, mid, rot, 'ragdoll'), rot, mid };
    };
    const local = (o: { rot: Quaternion; mid: Vector3 }, at: Vector3) => {
      const r = at.subtract(o.mid).applyRotationQuaternion(Quaternion.Inverse(o.rot));
      return { x: r.x, y: r.y, z: r.z };
    };
    const thigh = body('thigh_r', 'calf_r');
    const shin = body('calf_r', 'foot_r');
    const knee = p.joints.get('calf_r')!;
    const at = v(pose.calf_r!);
    const fa = Quaternion.Inverse(thigh.rot).multiply(knee.parent);
    const fb = Quaternion.Inverse(shin.rot).multiply(knee.child);
    world.ballJoint(thigh.b, shin.b, local(thigh, at), local(shin, at), { frameA: { x: fa.x, y: fa.y, z: fa.z, w: fa.w }, frameB: { x: fb.x, y: fb.y, z: fb.z, w: fb.w }, ...knee.limits });
    thigh.b.setBodyType(1 as never, true); // fixed
    // At rest inside its limits, the joint holds the pose (nothing snaps).
    for (let i = 0; i < 30; i++) world.step(1 / 60);
    const r0 = shin.b.rotation();
    expect(Math.abs(Quaternion.Dot(new Quaternion(r0.x, r0.y, r0.z, r0.w), shin.rot))).toBeGreaterThan(0.9998);
    // Spin the shin forward hard (hyperextending the knee): it stops about straight (a free ball joint, as before, let it swing on round).
    const axis = Vector3.Cross(p.dirs.get('calf_r')!, p.frame.forward).normalize();
    for (let i = 0; i < 120; i++) {
      shin.b.setAngvel({ x: axis.x * 6, y: axis.y * 6, z: axis.z * 6 }, true);
      world.step(1 / 60);
    }
    const r = shin.b.rotation();
    const now = new Quaternion(r.x, r.y, r.z, r.w).multiply(Quaternion.Inverse(shin.rot));
    const shinDir = p.dirs.get('calf_r')!.applyRotationQuaternion(now);
    const thighDir = p.dirs.get('thigh_r')!;
    // Straight is 0 between thigh and shin; forward of straight would put the shin ahead of the thigh's line.
    const hyper = Vector3.Dot(Vector3.Cross(thighDir, shinDir), p.frame.right);
    expect(Vector3.Dot(thighDir, shinDir)).toBeGreaterThan(0.95);
    expect(hyper).toBeGreaterThan(-0.12);
    world.free();
  });

  it('limit tables are sane: every range holds zero (the neutral pose) and bends one way more than the other where it should', () => {
    for (const [k, l] of Object.entries(JOINT_LIMITS)) for (const ax of ['x', 'y', 'z'] as const) expect(l[ax][0] <= 0 && l[ax][1] >= 0, `${k} ${ax}`).toBe(true);
    expect(JOINT_LIMITS.knee.x[0]).toBeGreaterThan(-0.1);
    expect(JOINT_LIMITS.elbow.x[0]).toBeGreaterThan(-0.1);
    expect(JOINT_LIMITS.hip.x[0]).toBeLessThan(-1.5);
  });
});
