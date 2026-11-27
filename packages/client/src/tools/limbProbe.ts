import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { CharacterInstance } from '../content/characters.ts';

/** The joints the limb audit reads (tools/content/limb-audit.mjs, docs/CHARACTER_LIMBS.md). */
export const LIMB_JOINTS = ['pelvis', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'] as const;
/** Bones whose skin the audit samples: the drawn shin and foot, beside the joints' own line. */
const SKIN_BONES = ['calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'];

export type P3 = [number, number, number];
/** One bone's skin, as drawn: the vertices it holds most (world m), split along the bone into its upper and lower halves' centroids, and the lowest few's centroid. */
export interface SkinSample {
  n: number;
  upper: P3;
  lower: P3;
  /** The centroid of the lowest tenth of its vertices (a foot's sole). */
  low: P3;
  /** The sole's lowest tenth, its spread from side to side: min and max of x, and the y at each end (a rolled foot's sole tilts). */
  soleLeft: P3;
  soleRight: P3;
}

/**
 * The posed character's limbs as the game draws them (team tool: `__grips.limbs()`): its joints' world positions,
 * and for the shins and feet the skinned vertices' halves (CPU skinning of the drawn, full-detail meshes), so the
 * audit can tell a bow in the joints' pose from one in the skin round them.
 */
export function limbSamples(ch: CharacterInstance): { joints: Record<string, P3>; skin: Record<string, SkinSample> } {
  const joints: Record<string, P3> = {};
  for (const n of LIMB_JOINTS) {
    const j = ch.joints.get(n);
    if (!j) continue;
    j.computeWorldMatrix(true);
    const p = j.getAbsolutePosition();
    joints[n] = [p.x, p.y, p.z];
  }
  const pts = new Map<string, Vector3[]>(SKIN_BONES.map((b) => [b, []]));
  for (const m of ch.meshes as Mesh[]) {
    if (/_lod/.test(m.name) || !m.skeleton || !m.isEnabled() || !m.getTotalVertices?.()) continue;
    const idx = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const wts = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
    const pos = m.getPositionData(true, true);
    if (!idx || !wts || !pos) continue;
    const bones = m.skeleton.bones;
    const world = m.computeWorldMatrix(true);
    for (let v = 0; v < pos.length / 3; v++) {
      let best = -1;
      let bw = 0;
      for (let k = 0; k < 4; k++) if (wts[v * 4 + k]! > bw) ((bw = wts[v * 4 + k]!), (best = idx[v * 4 + k]!));
      const name = best >= 0 ? bones[best]?.name : undefined;
      const into = name ? pts.get(name) : undefined;
      if (!into || bw < 0.6) continue;
      into.push(Vector3.TransformCoordinates(new Vector3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]), world));
    }
  }
  const mean = (vs: Vector3[]): P3 => {
    const s = vs.reduce((a, b) => a.addInPlace(b), Vector3.Zero()).scale(1 / Math.max(1, vs.length));
    return [s.x, s.y, s.z];
  };
  const skin: Record<string, SkinSample> = {};
  for (const [bone, vs] of pts) {
    if (vs.length < 12) continue;
    // Along the bone: from its joint to its child's (the foot's child is the ball; the ball's runs forward from it).
    const child = { calf_l: 'foot_l', calf_r: 'foot_r', foot_l: 'ball_l', foot_r: 'ball_r' }[bone];
    const a = joints[bone];
    const b = child ? joints[child] : undefined;
    const axis = a && b ? new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize() : new Vector3(0, 0, 1);
    const at = a ? new Vector3(...a) : Vector3.Zero();
    const sorted = [...vs].sort((p, q) => Vector3.Dot(p.subtract(at), axis) - Vector3.Dot(q.subtract(at), axis));
    const half = sorted.length >> 1;
    const byY = [...vs].sort((p, q) => p.y - q.y);
    const lowest = byY.slice(0, Math.max(4, Math.round(vs.length / 10)));
    const byX = [...lowest].sort((p, q) => p.x - q.x);
    const tenth = Math.max(1, Math.round(byX.length / 4));
    skin[bone] = { n: vs.length, upper: mean(sorted.slice(0, half)), lower: mean(sorted.slice(half)), low: mean(lowest), soleLeft: mean(byX.slice(0, tenth)), soleRight: mean(byX.slice(-tenth)) };
  }
  return { joints, skin };
}

/** The wrists and forearms the wrist measure reads (both sides). */
const WRIST_JOINTS = ['lowerarm_l', 'hand_l', 'lowerarm_r', 'hand_r'] as const;

/** Each wrist and forearm joint's rotation as the character was built (its rest pose), to measure the turns from. */
export function restOfArms(ch: CharacterInstance): Map<string, Quaternion> {
  const out = new Map<string, Quaternion>();
  for (const n of WRIST_JOINTS) {
    const q = ch.joints.get(n)?.rotationQuaternion;
    if (q) out.set(n, q.clone());
  }
  return out;
}

/**
 * A joint's turn off its rest rotation, split into its twist about its own bone (`along`, its child's offset in its
 * own frame: a hand's toward its middle knuckle, a forearm's toward the wrist) and the swing left (the bend), degrees.
 * (d = rest⁻¹·local = swing·twist: the twist turns about the bone first, the swing then bends it.)
 */
export function swingTwist(local: Quaternion, rest: Quaternion, along: Vector3): { bend: number; twist: number } {
  const d = Quaternion.Inverse(rest).multiply(local);
  if (d.w < 0) d.scaleInPlace(-1);
  const axis = along.normalizeToNew();
  const p = d.x * axis.x + d.y * axis.y + d.z * axis.z;
  let tw = new Quaternion(axis.x * p, axis.y * p, axis.z * p, d.w);
  const l = tw.length();
  tw = l < 1e-9 ? Quaternion.Identity() : tw.scale(1 / l);
  const sw = d.multiply(Quaternion.Inverse(tw));
  const deg = (q: Quaternion) => (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
  const sign = p * tw.w >= 0 ? 1 : -1;
  return { bend: Math.round(deg(sw) * 10) / 10, twist: Math.round(sign * deg(tw) * 10) / 10 };
}

/**
 * The wrists (team tool: `__grips.wrists()`, any view): each hand's bend and twist off its rest pose against its
 * forearm, and each forearm's twist against its upper arm (a support hand under a handguard, turned palm up: the
 * turn the wrist's skin takes, and the share the forearm takes of it).
 */
export function wristMeasures(ch: CharacterInstance, rest: Map<string, Quaternion>): Record<'l' | 'r', { bend: number; twist: number; forearmTwist: number }> | null {
  const one = (s: 'l' | 'r') => {
    const hand = ch.joints.get(`hand_${s}`);
    const lower = ch.joints.get(`lowerarm_${s}`);
    const knuckle = ch.joints.get(`middle_01_${s}`) ?? ch.joints.get(`index_01_${s}`);
    const rh = rest.get(`hand_${s}`);
    const rl = rest.get(`lowerarm_${s}`);
    if (!hand?.rotationQuaternion || !lower?.rotationQuaternion || !rh || !rl || !knuckle) return null;
    const w = swingTwist(hand.rotationQuaternion, rh, knuckle.position);
    const f = swingTwist(lower.rotationQuaternion, rl, hand.position);
    return { bend: w.bend, twist: w.twist, forearmTwist: f.twist };
  };
  const l = one('l');
  const r = one('r');
  return l && r ? { l, r } : null;
}
