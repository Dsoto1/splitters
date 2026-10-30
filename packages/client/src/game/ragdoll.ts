import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { EffectShape, EffectsWorld, Vec3 } from '@tiletrigger/shared';
import { SkeletonSpace } from './characterAnimator.ts';
import { RAGDOLL_BUDGET, type RagdollTier } from './ragdollBudget.ts';

type Body = ReturnType<EffectsWorld['addBody']>;
type Joint = ReturnType<EffectsWorld['ballJoint']>;

/** One limb segment: a capsule from joint `from` to joint `to`, posing the bone at `from`. */
interface Segment {
  bone: string;
  from: string;
  to: string;
  radius: number;
  /** Extend past `to` (hands, feet, the head's crown), metres. */
  extend?: number;
  /** Ball-joint to this segment, at this joint. */
  parent?: { segment: string; at: string };
}

/** Full tier: ten capsules (torso, head, upper and lower arms, thighs, shins). */
const FULL: readonly Segment[] = [
  { bone: 'pelvis', from: 'pelvis', to: 'neck_01', radius: 0.14 },
  { bone: 'neck_01', from: 'neck_01', to: 'Head', radius: 0.1, extend: 0.18, parent: { segment: 'pelvis', at: 'neck_01' } },
  ...(['l', 'r'] as const).flatMap((s): Segment[] => [
    { bone: `upperarm_${s}`, from: `upperarm_${s}`, to: `lowerarm_${s}`, radius: 0.055, parent: { segment: 'pelvis', at: `upperarm_${s}` } },
    { bone: `lowerarm_${s}`, from: `lowerarm_${s}`, to: `hand_${s}`, radius: 0.05, extend: 0.1, parent: { segment: `upperarm_${s}`, at: `lowerarm_${s}` } },
    { bone: `thigh_${s}`, from: `thigh_${s}`, to: `calf_${s}`, radius: 0.075, parent: { segment: 'pelvis', at: `thigh_${s}` } },
    { bone: `calf_${s}`, from: `calf_${s}`, to: `foot_${s}`, radius: 0.06, extend: 0.08, parent: { segment: `thigh_${s}`, at: `calf_${s}` } },
  ]),
];

/** Cheap tier: pelvis, chest and head; the limbs hang in a limp pose (CharacterAnimator.ragdoll('limp')). */
const CHEAP: readonly Segment[] = [
  { bone: 'pelvis', from: 'pelvis', to: 'spine_02', radius: 0.15 },
  { bone: 'spine_02', from: 'spine_02', to: 'neck_01', radius: 0.15, parent: { segment: 'pelvis', at: 'spine_02' } },
  { bone: 'neck_01', from: 'neck_01', to: 'Head', radius: 0.1, extend: 0.18, parent: { segment: 'spine_02', at: 'neck_01' } },
];

/** A standard body's parts, to park in the pool before the first death (sizes near the mannequin's). */
export const RAGDOLL_PREWARM: readonly { key: string; shape: EffectShape }[] = [
  ...FULL.map((s) => ({ key: `full:${s.bone}`, shape: { kind: 'capsule' as const, halfHeight: s.bone === 'pelvis' ? 0.2 : s.bone === 'neck_01' ? 0.06 : 0.12, radius: s.radius } })),
  ...CHEAP.map((s) => ({ key: `cheap:${s.bone}`, shape: { kind: 'capsule' as const, halfHeight: 0.08, radius: s.radius } })),
];

interface Part {
  seg: Segment;
  key: string;
  bone: TransformNode;
  body: Body;
  /** Body rotation and the bone's rotation (skeleton space) at the moment of death. */
  body0: Quaternion;
  bone0: Quaternion;
}

/**
 * A ragdoll: on death the character's body becomes physics capsules joined at
 * the joints, thrown by whatever killed them, and the skeleton follows the
 * bodies. Drawn only: it lives in the client's effects world and never touches
 * the game. Full tier: ten capsules; cheap tier: pelvis, chest and head (the
 * limbs hang limp). Bodies come from the effects world's pool and go back to
 * it when the ragdoll freezes: once it rests (or after RAGDOLL_BUDGET's time)
 * the pose stays as it is and costs nothing per frame.
 *
 * Each bone takes its capsule's rotation since death, carried into the
 * skeleton's own space (the glTF import mirrors the scene above it), so
 * twists come through as well as swings.
 */
export class Ragdoll {
  private readonly parts: Part[] = [];
  private readonly joints: Joint[] = [];
  private readonly space: SkeletonSpace;
  private readonly toSpace: Matrix;
  private readonly fromSpace: Matrix;
  private readonly pelvis: TransformNode;
  private readonly rootJoint: TransformNode;
  /** The root's and pelvis's positions at death, and the root's local linear transform (skeleton space → its parent's). */
  private readonly root0: Vector3;
  private readonly pelvis0: Vector3;
  private readonly rootLinear: Matrix;
  /** Pelvis joint relative to the torso capsule's centre (world, at death, in the capsule's frame). */
  private readonly pelvisLocal: Vec3;
  private readonly born = performance.now();
  private settled = false;
  /** No longer simulated: the bodies went back to the pool and the pose stays as it is. */
  frozen = false;

  constructor(
    private readonly world: EffectsWorld,
    joints: ReadonlyMap<string, TransformNode>,
    rootJoint: TransformNode,
    push: Vec3,
    readonly tier: Exclude<RagdollTier, 'posed'> = 'full',
  ) {
    this.space = new SkeletonSpace(rootJoint);
    rootJoint.computeWorldMatrix(true);
    // Linear parts only: rotations are carried between world and skeleton space by conjugation.
    this.fromSpace = rootJoint.getWorldMatrix().clone().setTranslation(Vector3.Zero());
    this.toSpace = this.fromSpace.clone().invert();
    this.pelvis = joints.get('pelvis')!;
    this.rootJoint = rootJoint;
    this.root0 = rootJoint.position.clone();
    this.pelvis0 = this.pelvis.position.clone();
    const parentWorld = (rootJoint.parent as TransformNode | null)?.computeWorldMatrix(true) ?? Matrix.Identity();
    this.rootLinear = rootJoint.getWorldMatrix().multiply(Matrix.Invert(parentWorld)).setTranslation(Vector3.Zero());
    const world0 = (n: string) => {
      const j = joints.get(n)!;
      j.computeWorldMatrix(true);
      return j.getAbsolutePosition().clone();
    };
    const byName = new Map<string, Part>();
    for (const seg of tier === 'full' ? FULL : CHEAP) {
      const bone = joints.get(seg.bone);
      if (!bone || !joints.get(seg.from) || !joints.get(seg.to)) continue;
      const a = world0(seg.from);
      let b = world0(seg.to);
      const axis = b.subtract(a);
      axis.normalize();
      if (seg.extend) b = b.add(axis.scale(seg.extend));
      const full = Vector3.Distance(a, b);
      const rot = new Quaternion();
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), axis, rot);
      const mid = a.add(b).scale(0.5);
      const half = Math.max(0.01, full / 2 - seg.radius);
      // Limbs fly a little looser than the torso, which takes the brunt of the hit.
      const share = seg.bone === 'pelvis' ? 1 : 0.8;
      const key = `${tier}:${seg.bone}`;
      const body = this.world.takeRagdollBody(key, { kind: 'capsule', halfHeight: half, radius: seg.radius }, mid, rot, {
        vel: { x: push.x * share + (Math.random() - 0.5) * 0.6, y: push.y * share, z: push.z * share + (Math.random() - 0.5) * 0.6 },
        spin: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 },
        density: seg.bone === 'pelvis' ? 1.2 : 0.9,
      });
      const part: Part = { seg, key, bone, body, body0: rot.clone(), bone0: this.space.rot(bone) };
      this.parts.push(part);
      byName.set(seg.bone, part);
      if (seg.parent) {
        const p = byName.get(seg.parent.segment);
        if (p) {
          const at = world0(seg.parent.at);
          this.joints.push(this.world.ballJoint(p.body, body, this.local(p.body, at), this.local(body, at)));
        }
      }
    }
    const torso = byName.get('pelvis')!;
    this.pelvisLocal = this.local(torso.body, world0('pelvis'));
  }

  /** Physics bodies this ragdoll keeps awake (0 once frozen). */
  get bodies(): number {
    return this.frozen ? 0 : this.parts.length;
  }

  /** The torso's velocity now (a ragdoll dropping a tier hands it on). */
  get velocity(): Vec3 {
    const torso = this.parts[0]?.body;
    if (!torso || this.frozen) return { x: 0, y: 0, z: 0 };
    const v = torso.linvel();
    return { x: v.x, y: v.y, z: v.z };
  }

  /** A world point in a body's own frame. */
  private local(body: Body, p: Vector3): Vec3 {
    const t = body.translation();
    const r = body.rotation();
    const inv = Quaternion.Inverse(new Quaternion(r.x, r.y, r.z, r.w));
    const v = p.subtract(new Vector3(t.x, t.y, t.z)).applyRotationQuaternion(inv);
    return { x: v.x, y: v.y, z: v.z };
  }

  /**
   * Pose the skeleton from the bodies (parents before children). Call every
   * frame after the physics step. Returns true when the ragdoll has just
   * frozen (it rested, or ran out of time): the caller then stops the pose.
   */
  update(): boolean {
    if (this.frozen) return false;
    for (const part of this.parts) {
      const r = part.body.rotation();
      const now = new Quaternion(r.x, r.y, r.z, r.w);
      const delta = now.multiply(Quaternion.Inverse(part.body0));
      // Into skeleton space: S⁻¹·Δ·S on the linear parts (row vectors: v·toSpace⁻¹·Δ·toSpace).
      const m = new Matrix();
      Matrix.FromQuaternionToRef(delta, m);
      const inSpace = this.fromSpace.multiply(m).multiply(this.toSpace);
      const q = new Quaternion();
      inSpace.decompose(undefined, q);
      this.space.setRot(part.bone, q.multiply(part.bone0), 1);
      if (part.bone === this.pelvis) {
        const t = part.body.translation();
        const at = new Vector3(this.pelvisLocal.x, this.pelvisLocal.y, this.pelvisLocal.z).applyRotationQuaternion(now).add(new Vector3(t.x, t.y, t.z));
        // The pelvis hangs off the skeleton root, whose local space is the skeleton space. Move the root
        // itself, pelvis and all: some skins weigh a few vertices to the root, which would otherwise stay
        // where the body fell from and stretch after it.
        const move = this.space.point(at).subtract(this.pelvis0);
        this.rootJoint.position.copyFrom(this.root0.add(Vector3.TransformNormal(move, this.rootLinear)));
        this.pelvis.position.copyFrom(this.pelvis0);
        this.rootJoint.computeWorldMatrix(true);
        this.pelvis.computeWorldMatrix(true);
      }
    }
    const age = (performance.now() - this.born) / 1000;
    // Settle faster: after the first tumble, damping goes up so the body comes to rest sooner.
    if (!this.settled && age > 0.9) {
      this.settled = true;
      for (const p of this.parts) {
        p.body.setLinearDamping(2.2);
        p.body.setAngularDamping(5);
      }
    }
    if (this.parts.every((p) => p.body.isSleeping()) || age > (this.tier === 'full' ? RAGDOLL_BUDGET.fullSeconds : RAGDOLL_BUDGET.cheapSeconds)) {
      this.freeze();
      return true;
    }
    return false;
  }

  /** Stop simulating: the bodies go back to the pool; the bones keep the pose they have. */
  freeze(): void {
    if (this.frozen) return;
    this.frozen = true;
    for (const j of this.joints) this.world.removeJoint(j);
    this.joints.length = 0;
    for (const p of this.parts) this.world.parkRagdollBody(p.key, p.body);
  }

  /** Every part has come to rest (or it is frozen): no need to re-pose the skeleton. */
  get resting(): boolean {
    return this.frozen || this.parts.every((p) => p.body.isSleeping());
  }

  dispose(): void {
    this.freeze();
    this.parts.length = 0;
  }
}

/**
 * A body laid down with no simulation (a death out of view): it takes the
 * death's final pose on the ground, along the hit, and freezes once the pose
 * has been drawn (a couple of frames). Costs nothing after that.
 */
export class PosedBody {
  readonly tier = 'posed' as const;
  readonly bodies = 0;
  readonly resting = true;
  readonly velocity: Vec3 = { x: 0, y: 0, z: 0 };
  frozen = false;
  private frames = 0;

  update(): boolean {
    if (this.frozen || ++this.frames < 3) return false;
    this.frozen = true;
    return true;
  }

  freeze(): void {
    this.frozen = true;
  }

  dispose(): void {}
}

/** A dead body: a ragdoll (full or cheap) or one laid down. */
export type DeadBody = Ragdoll | PosedBody;
