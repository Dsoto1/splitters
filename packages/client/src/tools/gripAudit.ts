import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponHold } from '@tiletrigger/shared';
import type { CharacterInstance } from '../content/characters.ts';

/**
 * Grip audit (team tool, `?mode=grips`, `__grips.audit()`): measures a posed character holding a gun the way
 * it is DRAWN (its skin through the skeleton's last matrices), in the character's own frame, in metres on a
 * 1.8 m body, so characters of any build compare. tools/content/grip-audit.mjs ranks every character by it.
 *
 * - hands: per hand, how much of the hand's skin is weighted to the four fingers (0: the fingers can't move the
 *   skin, so a curl leaves the hand flat), how many finger joints carry skin, and where the drawn fingertips end
 *   up from the hand's point on the gun (a hand closed round a grip has its tips near it; a flat hand's are a
 *   hand's length away);
 * - elbows: how far each elbow bends and whether it bends the way the arm's own skin expects (toward the upper
 *   arm's front in the bind pose; negative: bent backwards);
 * - gun: where the gun sits against the body (the butt and grip against the shoulder and head, the head's
 *   distance from the gun's line) and whether the arms cross the body's midline;
 * - stretch: skin edges much longer than in the bind pose (cloth dragged out by an arm: "spikes").
 */

const FINGER = /(?:^|_)(index|middle|ring|pinky)_0\d_([lr])$/;
const HANDISH = (side: 'l' | 'r') => new RegExp(`(?:^|_)(hand|index|middle|ring|pinky|thumb)(_0\\d)?_${side}$`);
const BODY_HEIGHT = 1.8;
/** How far ahead of the grip (m) a support hand's place on a long gun's handguard starts (characterAnimator's SUPPORT_MIN_AHEAD). */
const SUPPORT_AHEAD = 0.12;

interface Skin {
  mesh: AbstractMesh;
  names: string[];
  mats: Float32Array;
  bind: Float32Array;
  posed: Float32Array;
  bi: ArrayLike<number>;
  bw: ArrayLike<number>;
  count: number;
}

/** The body's main skinned mesh (the most vertices, not a low-detail copy), its bind and drawn vertex positions. */
function skinOf(ch: CharacterInstance): Skin | null {
  let best: AbstractMesh | null = null;
  let most = 0;
  for (const m of ch.meshes) {
    if (!m.skeleton || m.isDisposed() || /_lod/i.test(m.name)) continue;
    const n = m.getTotalVertices();
    if (n > most) {
      most = n;
      best = m;
    }
  }
  if (!best?.skeleton) return null;
  const sk = best.skeleton;
  const bi = best.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const bw = best.getVerticesData(VertexBuffer.MatricesWeightsKind);
  const pos = best.getVerticesData(VertexBuffer.PositionKind);
  if (!bi || !bw || !pos) return null;
  const mats = sk.getTransformMatrices(best);
  const count = Math.min(pos.length / 3, bw.length / 4);
  const posed = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3]!;
    const y = pos[v * 3 + 1]!;
    const z = pos[v * 3 + 2]!;
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (let k = 0; k < 4; k++) {
      const w = bw[v * 4 + k]!;
      if (!w) continue;
      const o = bi[v * 4 + k]! * 16;
      ax += w * (mats[o]! * x + mats[o + 4]! * y + mats[o + 8]! * z + mats[o + 12]!);
      ay += w * (mats[o + 1]! * x + mats[o + 5]! * y + mats[o + 9]! * z + mats[o + 13]!);
      az += w * (mats[o + 2]! * x + mats[o + 6]! * y + mats[o + 10]! * z + mats[o + 14]!);
    }
    posed[v * 3] = ax;
    posed[v * 3 + 1] = ay;
    posed[v * 3 + 2] = az;
  }
  return { mesh: best, names: sk.bones.map((b) => b.getTransformNode()?.name ?? b.name), mats, bind: Float32Array.from(pos), posed, bi, bw, count };
}

const at = (a: Float32Array, v: number) => new Vector3(a[v * 3]!, a[v * 3 + 1]!, a[v * 3 + 2]!);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface GripAudit {
  /** Body mesh vertices measured. */
  verts: number;
  /** `tipsGuard`/`centreGuard`: a long gun's support hand against the handguard's line (it slides back along it). */
  hands: Record<'l' | 'r', { fingerShare: number; fingerJoints: number; tips: number | null; centre: number | null; tipsGuard?: number; centreGuard?: number; measured: { curl: number; fingers: string } | null } | null>;
  elbows: Record<'l' | 'r', { bend: number; flex: number } | null>;
  gun: {
    /** Smallest distance (m) from the head joint to the gun's line (butt to handguard; a pistol's barrel). */
    headToGun: number;
    /** Grip height above the shooting shoulder joint (m; + above). */
    gripAboveShoulder: number;
    /** Grip ahead of the chest joint (m). */
    gripAhead: number;
    /** Each elbow's and hand's side of the body: + on its own side, in shoulder half-widths from the midline. */
    elbowSide: { l: number; r: number };
    handSide: { l: number; r: number };
    /** The arms' length (shoulder to wrist, bind) against the shoulders' width. */
    armOverShoulders: number;
    /** Shooting shoulder joint height above the neck joint (m; bulky or hunched builds have it near or above). */
    shoulderBelowNeck: number;
  } | null;
  /** `by`: spikes counted by the joint that holds each one's first end most. */
  stretch: { max: number; spikes: number; worst: string | null; by: Record<string, number> };
}

/** Measure the posed character (call after the pose has settled and been drawn). */
export function auditGrip(ch: CharacterInstance, weapon: TransformNode | null, hold: WeaponHold | null): GripAudit | null {
  const skin = skinOf(ch);
  if (!skin) return null;
  const { mesh, names, mats, bind, posed, bi, bw, count } = skin;
  mesh.computeWorldMatrix(true);
  const world = mesh.getWorldMatrix();
  const toLocal = world.clone().invert();
  // Mesh units to metres on a 1.8 m body.
  let minY = Infinity;
  let maxY = -Infinity;
  for (let v = 0; v < count; v++) {
    minY = Math.min(minY, bind[v * 3 + 1]!);
    maxY = Math.max(maxY, bind[v * 3 + 1]!);
  }
  const k = BODY_HEIGHT / Math.max(1e-6, maxY - minY);
  const bone = (n: string) => names.indexOf(n);
  const M = (b: number) => Matrix.FromArray(mats, b * 16);
  const bindAt = (b: number) => skin.mesh.skeleton!.bones[b]!.getAbsoluteInverseBindMatrix().clone().invert().getTranslation();
  const posedAt = (n: string) => {
    const b = bone(n);
    return b < 0 ? null : Vector3.TransformCoordinates(bindAt(b), M(b));
  };

  // The body's frame (mesh space): up +Y, front +Z (every character file stands facing +Z; a foot can't be trusted:
  // Cap'n Barnacle's peg leg points anywhere).
  const front = new Vector3(0, 0, 1);
  const up = new Vector3(0, 1, 0);
  const left = Vector3.Cross(up, front).normalize();

  // Hands: the fingers' share of the hand's skin, and where the drawn fingertips are from the hand's point on the gun.
  const handPoint = (side: 'l' | 'r') => {
    if (!weapon || !hold) return null;
    const p = side === 'r' ? hold.grip : hold.support;
    if (!p) return null;
    weapon.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(p[0], p[1], p[2]), weapon.getWorldMatrix()), toLocal);
  };
  const hands = {} as GripAudit['hands'];
  for (const side of ['l', 'r'] as const) {
    const re = HANDISH(side);
    const on = names.map((n) => re.test(n));
    const finger = names.map((n) => FINGER.exec(n)?.[2] === side);
    const used = new Set<number>();
    const pts: Vector3[] = [];
    let fingered = 0;
    for (let v = 0; v < count; v++) {
      let w = 0;
      let fw = 0;
      for (let j = 0; j < 4; j++) {
        const b = bi[v * 4 + j]!;
        const wj = bw[v * 4 + j]!;
        if (on[b]) w += wj;
        if (finger[b]) {
          fw += wj;
          if (wj > 0.2) used.add(b);
        }
      }
      if (w < 0.5) continue;
      if (fw >= 0.3) fingered++;
      pts.push(at(posed, v));
    }
    if (pts.length < 6) {
      hands[side] = null;
      continue;
    }
    const wrist = posedAt(`hand_${side}`) ?? pts[0]!;
    const centre = pts.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scale(1 / pts.length);
    const far = pts.map((p) => ({ p, d: Vector3.Distance(p, wrist) })).sort((a, b) => b.d - a.d).slice(0, Math.max(3, Math.floor(pts.length * 0.15)));
    const tip = far.reduce((a, x) => a.addInPlace(x.p), Vector3.Zero()).scale(1 / far.length);
    const target = handPoint(side);
    const measured = ch.hands[side];
    // A long gun's support hand slides back along the handguard on short arms (by design): measured against the
    // handguard's line too, from just ahead of the grip to the support point.
    const guard = side === 'l' && hold?.style === 'long' && hold.support ? [handPoint('r'), target] : null;
    const toGuard = (p: Vector3) => {
      const [g, s2] = guard as [Vector3, Vector3];
      const d = s2.subtract(g);
      const len = d.length();
      const t = Math.max(Math.min(SUPPORT_AHEAD / Math.max(1e-6, len * k), 1), Math.min(1, Vector3.Dot(p.subtract(g), d) / Math.max(1e-12, len * len)));
      return r3(Vector3.Distance(p, g.add(d.scale(t))) * k);
    };
    hands[side] = {
      fingerShare: r3(fingered / pts.length),
      fingerJoints: used.size,
      tips: target ? r3(Vector3.Distance(tip, target) * k) : null,
      centre: target ? r3(Vector3.Distance(centre, target) * k) : null,
      ...(guard?.[0] && guard[1] ? { tipsGuard: toGuard(tip), centreGuard: toGuard(centre) } : {}),
      measured: measured ? { curl: measured.curl, fingers: measured.fingers } : null,
    };
  }

  // Elbows: the bend, and whether the forearm went toward the upper arm's own front (the way its skin folds).
  const elbows = {} as GripAudit['elbows'];
  for (const side of ['l', 'r'] as const) {
    const ub = bone(`upperarm_${side}`);
    const s = posedAt(`upperarm_${side}`);
    const e = posedAt(`lowerarm_${side}`);
    const w = posedAt(`hand_${side}`);
    if (ub < 0 || !s || !e || !w) {
      elbows[side] = null;
      continue;
    }
    const upper = e.subtract(s).normalize();
    const fore = w.subtract(e).normalize();
    const bend = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(upper, fore))));
    const flexDir = fore.subtract(upper.scale(Vector3.Dot(fore, upper)));
    const armFront = Vector3.TransformNormal(front, M(ub));
    armFront.subtractInPlace(upper.scale(Vector3.Dot(armFront, upper)));
    const flex = flexDir.lengthSquared() > 1e-10 && armFront.lengthSquared() > 1e-10 ? Vector3.Dot(flexDir.normalize(), armFront.normalize()) : 1;
    elbows[side] = { bend: Math.round((bend * 180) / Math.PI), flex: r3(flex) };
  }

  // The gun against the body.
  let gun: GripAudit['gun'] = null;
  const head = posedAt('Head') ?? posedAt('head');
  const neck = posedAt('neck_01');
  const chest = posedAt('spine_03') ?? posedAt('spine_02');
  const pelvis = posedAt('pelvis');
  const sr = posedAt('upperarm_r');
  const sl = posedAt('upperarm_l');
  const grip = handPoint('r');
  if (weapon && hold && head && neck && chest && sr && sl && grip) {
    const g = (p: readonly number[]) => Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(p[0], p[1], p[2]), weapon.getWorldMatrix()), toLocal);
    const a = hold.style === 'long' && hold.shoulder ? g(hold.shoulder) : g(hold.grip);
    const b = hold.support && hold.style === 'long' ? g(hold.support) : g([hold.grip[0], hold.grip[1], hold.grip[2] + 0.2]);
    const ab = b.subtract(a);
    const t = Math.max(0, Math.min(1, Vector3.Dot(head.subtract(a), ab) / Math.max(1e-9, ab.lengthSquared())));
    const headToGun = Vector3.Distance(head, a.add(ab.scale(t))) * k;
    const mid = (pelvis ?? chest).clone();
    const half = Math.max(1e-6, Math.abs(Vector3.Dot(sl.subtract(sr), left)) / 2);
    const sideOf = (p: Vector3 | null, s: 'l' | 'r') => (p ? r3((Vector3.Dot(p.subtract(mid), left) * (s === 'l' ? 1 : -1)) / half) : 0);
    const reach = (s: 'l' | 'r') => {
      const u = bone(`upperarm_${s}`);
      const h = bone(`hand_${s}`);
      return u < 0 || h < 0 ? 0 : Vector3.Distance(bindAt(u), bindAt(h));
    };
    gun = {
      headToGun: r3(headToGun),
      gripAboveShoulder: r3(Vector3.Dot(grip.subtract(sr), up) * k),
      gripAhead: r3(Vector3.Dot(grip.subtract(chest), front) * k),
      elbowSide: { l: sideOf(posedAt('lowerarm_l'), 'l'), r: sideOf(posedAt('lowerarm_r'), 'r') },
      handSide: { l: sideOf(posedAt('hand_l'), 'l'), r: sideOf(posedAt('hand_r'), 'r') },
      armOverShoulders: r3((reach('l') + reach('r')) / 2 / (2 * half)),
      shoulderBelowNeck: r3(Vector3.Dot(neck.subtract(sr), up) * k),
    };
  }

  // Stretch: skin edges much longer drawn than in the bind pose.
  const idx = mesh.getIndices();
  let max = 1;
  let spikes = 0;
  let worst: string | null = null;
  const at_: Record<string, number> = {};
  if (idx) {
    const seen = new Set<number>();
    for (let i = 0; i + 2 < idx.length; i += 3) {
      for (const [p, q] of [[idx[i]!, idx[i + 1]!], [idx[i + 1]!, idx[i + 2]!], [idx[i + 2]!, idx[i]!]] as const) {
        const key = p < q ? p * count + q : q * count + p;
        if (seen.has(key)) continue;
        seen.add(key);
        const b0 = Vector3.Distance(at(bind, p), at(bind, q)) * k;
        const p0 = Vector3.Distance(at(posed, p), at(posed, q)) * k;
        if (b0 < 0.002 || p0 < 0.04) continue;
        const ratio = p0 / b0;
        if (ratio > max) {
          max = ratio;
          let wb = -1;
          let ww = 0;
          for (let j = 0; j < 4; j++) if (bw[p * 4 + j]! > ww) [ww, wb] = [bw[p * 4 + j]!, bi[p * 4 + j]!];
          worst = wb >= 0 ? names[wb] ?? null : null;
        }
        if (ratio > 3 && p0 > 0.1) {
          spikes++;
          // Where the spikes are: the joint that holds the edge's first end most.
          let wb = -1;
          let ww = 0;
          for (let j = 0; j < 4; j++) if (bw[p * 4 + j]! > ww) [ww, wb] = [bw[p * 4 + j]!, bi[p * 4 + j]!];
          const n = wb >= 0 ? names[wb] ?? '?' : '?';
          at_[n] = (at_[n] ?? 0) + 1;
        }
      }
    }
  }
  return { verts: count, hands, elbows, gun, stretch: { max: Math.round(max * 10) / 10, spikes, worst, by: at_ } };
}
