import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { EffectsWorld, Vec3 } from '@chronosplit/shared';
import { SkeletonSpace } from './characterAnimator.ts';

type Body = ReturnType<EffectsWorld['addBody']>;

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

const SEGMENTS: readonly Segment[] = [
  { bone: 'pelvis', from: 'pelvis', to: 'neck_01', radius: 0.14 },
  { bone: 'neck_01', from: 'neck_01', to: 'Head', radius: 0.1, extend: 0.18, parent: { segment: 'pelvis', at: 'neck_01' } },
  ...(['l', 'r'] as const).flatMap((s): Segment[] => [
    { bone: `upperarm_${s}`, from: `upperarm_${s}`, to: `lowerarm_${s}`, radius: 0.055, parent: { segment: 'pelvis', at: `upperarm_${s}` } },
    { bone: `lowerarm_${s}`, from: `lowerarm_${s}`, to: `hand_${s}`, radius: 0.05, extend: 0.1, parent: { segment: `upperarm_${s}`, at: `lowerarm_${s}` } },
    { bone: `thigh_${s}`, from: `thigh_${s}`, to: `calf_${s}`, radius: 0.075, parent: { segment: 'pelvis', at: `thigh_${s}` } },
    { bone: `calf_${s}`, from: `calf_${s}`, to: `foot_${s}`, radius: 0.06, extend: 0.08, parent: { segment: `thigh_${s}`, at: `calf_${s}` } },
  ]),
];

interface Part {
  seg: Segment;
  bone: TransformNode;
  body: Body;
  /** Body rotation and the bone's rotation (skeleton space) at the moment of death. */
  body0: Quaternion;
  bone0: Quaternion;
}

/**
 * A ragdoll: on death the character's limbs become physics capsules joined
 * at the shoulders, hips, elbows, knees and neck, thrown by whatever killed
 * them, and the skeleton follows the bodies until the next spawn. Drawn only:
 * it lives in the client's effects world and never touches the game.
 *
 * Each bone takes its capsule's rotation since death, carried into the
 * skeleton's own space (the glTF import mirrors the scene above it), so
 * twists come through as well as swings.
 */
export class Ragdoll {
  private readonly parts: Part[] = [];
  private readonly space: SkeletonSpace;
  private readonly toSpace: Matrix;
  private readonly fromSpace: Matrix;
  private readonly pelvis: TransformNode;
  /** Pelvis joint relative to the torso capsule's centre (world, at death, in the capsule's frame). */
  private readonly pelvisLocal: Vec3;

  constructor(
    private readonly world: EffectsWorld,
    joints: ReadonlyMap<string, TransformNode>,
    rootJoint: TransformNode,
    push: Vec3,
  ) {
    this.space = new SkeletonSpace(rootJoint);
    rootJoint.computeWorldMatrix(true);
    // Linear parts only: rotations are carried between world and skeleton space by conjugation.
    this.fromSpace = rootJoint.getWorldMatrix().clone().setTranslation(Vector3.Zero());
    this.toSpace = this.fromSpace.clone().invert();
    this.pelvis = joints.get('pelvis')!;
    const world0 = (n: string) => {
      const j = joints.get(n)!;
      j.computeWorldMatrix(true);
      return j.getAbsolutePosition().clone();
    };
    const byName = new Map<string, Part>();
    for (const seg of SEGMENTS) {
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
      const body = this.world.addBody({ kind: 'capsule', halfHeight: half, radius: seg.radius }, mid, rot, 'ragdoll', {
        vel: { x: push.x * share + (Math.random() - 0.5) * 0.6, y: push.y * share, z: push.z * share + (Math.random() - 0.5) * 0.6 },
        spin: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 },
        density: seg.bone === 'pelvis' ? 1.2 : 0.9,
      });
      const part: Part = { seg, bone, body, body0: rot.clone(), bone0: this.space.rot(bone) };
      this.parts.push(part);
      byName.set(seg.bone, part);
      if (seg.parent) {
        const p = byName.get(seg.parent.segment);
        if (p) {
          const at = world0(seg.parent.at);
          this.world.ballJoint(p.body, body, this.local(p.body, at), this.local(body, at));
        }
      }
    }
    const torso = byName.get('pelvis')!;
    this.pelvisLocal = this.local(torso.body, world0('pelvis'));
  }

  /** A world point in a body's own frame. */
  private local(body: Body, p: Vector3): Vec3 {
    const t = body.translation();
    const r = body.rotation();
    const inv = Quaternion.Inverse(new Quaternion(r.x, r.y, r.z, r.w));
    const v = p.subtract(new Vector3(t.x, t.y, t.z)).applyRotationQuaternion(inv);
    return { x: v.x, y: v.y, z: v.z };
  }

  /** Pose the skeleton from the bodies (parents before children). Call every frame after the physics step. */
  update(): void {
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
        // The pelvis hangs off the skeleton root, whose local space is the skeleton space.
        this.pelvis.position.copyFrom(this.space.point(at));
        this.pelvis.computeWorldMatrix(true);
      }
    }
  }

  dispose(): void {
    for (const p of this.parts) this.world.remove(p.body);
    this.parts.length = 0;
  }
}
