import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { SkeletonSpace } from '../src/game/characterAnimator.ts';
import { KNEE_OUT, STANCE_LEAN, TOE_OUT, standLegs, type Leg } from '../src/game/standLegs.ts';

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Two legs under a root, facing +z, the right at -x (as the game's bodies stand), posed as the standing clips stand
 * them: the ankles out wide, the knees bowed out and the right one turned out, the right toes splayed.
 */
function body(scene: Scene) {
  const root = new TransformNode('root', scene);
  const pelvis = new TransformNode('pelvis', scene);
  pelvis.parent = root;
  pelvis.position.set(0, 0.95, 0);
  const leg = (s: 'l' | 'r'): Leg => {
    const x = s === 'l' ? 0.1 : -0.1;
    const mk = (n: string, parent: TransformNode, p: Vector3) => {
      const t = new TransformNode(`${n}_${s}`, scene);
      t.parent = parent;
      t.position.copyFrom(p);
      t.rotationQuaternion = Quaternion.Identity();
      return t;
    };
    const thigh = mk('thigh', pelvis, new Vector3(x, 0, 0));
    const calf = mk('calf', thigh, new Vector3(0, -0.45, 0));
    const foot = mk('foot', calf, new Vector3(0, -0.42, 0));
    const ball = mk('ball', foot, new Vector3(0, -0.06, 0.13));
    // Bowed: the thigh out and turned, the knee bent, the foot turned out.
    const out = s === 'l' ? 1 : -1;
    thigh.rotationQuaternion = Quaternion.RotationYawPitchRoll(out * rad(s === 'r' ? 40 : 12), rad(-12), out * rad(14));
    calf.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, rad(22), -out * rad(6));
    foot.rotationQuaternion = Quaternion.RotationYawPitchRoll(out * rad(s === 'r' ? 20 : 2), rad(-10), 0);
    return { thigh, calf, foot, ball };
  };
  return { root, pelvis, legs: { l: leg('l'), r: leg('r') } };
}

const at = (n: TransformNode) => {
  n.computeWorldMatrix(true);
  return n.getAbsolutePosition().clone();
};
/** In the front view (x, y), the lean of `v` off straight down, + toward `out` (±1 on x). */
const lean = (v: Vector3, out: number) => deg(Math.atan2(v.x * out, -v.y));

function measure(legs: { l: Leg; r: Leg }) {
  const m = (s: 'l' | 'r') => {
    const out = s === 'l' ? 1 : -1;
    const leg = legs[s];
    const [h, k, a, b] = [leg.thigh, leg.calf, leg.foot, leg.ball].map(at) as [Vector3, Vector3, Vector3, Vector3];
    const shinOut = lean(a.subtract(k), out);
    const kneeBow = lean(k.subtract(h), out) - shinOut;
    const toe = b.subtract(a);
    const footYaw = deg(Math.atan2(toe.x * out, toe.z));
    // The knee off the hip-to-ankle line, seen from above.
    const line = a.subtract(h).normalize();
    const off = k.subtract(h).subtract(line.scale(Vector3.Dot(k.subtract(h), line)));
    const kneePoint = deg(Math.atan2(off.x * out, off.z));
    return { h, a, b, shinOut, kneeBow, footYaw, kneePoint, legLean: lean(a.subtract(h), out) };
  };
  return { l: m('l'), r: m('r') };
}

describe('standing legs (standLegs.ts)', () => {
  it('squares bowed legs: knees over the feet, toes nearly ahead, the stance no wider than STANCE_LEAN', () => {
    const scene = new Scene(new NullEngine());
    const { root, legs } = body(scene);
    const before = measure(legs);
    expect(before.r.kneeBow).toBeGreaterThan(5);
    expect(before.r.footYaw).toBeGreaterThan(20);
    standLegs(new SkeletonSpace(root), legs, Vector3.Up(), new Vector3(0, 0, 1), 1);
    const after = measure(legs);
    for (const s of ['l', 'r'] as const) {
      // The hip stays; the ankle stays at its height (on the ground) and its place ahead or behind.
      expect(Vector3.Distance(after[s].h, before[s].h)).toBeLessThan(1e-6);
      expect(after[s].a.y).toBeCloseTo(before[s].a.y, 4);
      expect(after[s].a.z).toBeCloseTo(before[s].a.z, 4);
      // Next to no bow in the front view (the knee points KNEE_OUT out, over the toes), the toes TOE_OUT out.
      expect(Math.abs(after[s].kneeBow)).toBeLessThan(4);
      expect(after[s].kneePoint).toBeGreaterThan(0);
      expect(after[s].kneePoint).toBeLessThan(KNEE_OUT + 3);
      expect(after[s].footYaw).toBeCloseTo(TOE_OUT, 0);
      expect(after[s].legLean).toBeLessThan(STANCE_LEAN + 2);
    }
    scene.dispose();
  });

  it('keeps the foot flat as the clip held it (only turned about the vertical)', () => {
    const scene = new Scene(new NullEngine());
    const { root, legs } = body(scene);
    const sole = (f: TransformNode) => {
      f.computeWorldMatrix(true);
      return Vector3.TransformNormal(new Vector3(0, -1, 0), f.getWorldMatrix()).normalize().y;
    };
    const was = [sole(legs.l.foot), sole(legs.r.foot)];
    standLegs(new SkeletonSpace(root), legs, Vector3.Up(), new Vector3(0, 0, 1), 1);
    expect(sole(legs.l.foot)).toBeCloseTo(was[0]!, 5);
    expect(sole(legs.r.foot)).toBeCloseTo(was[1]!, 5);
    scene.dispose();
  });

  it('weight 0 leaves the clips pose; a half weight goes part way', () => {
    const scene = new Scene(new NullEngine());
    const { root, legs } = body(scene);
    const before = measure(legs);
    standLegs(new SkeletonSpace(root), legs, Vector3.Up(), new Vector3(0, 0, 1), 0);
    expect(measure(legs).r.footYaw).toBeCloseTo(before.r.footYaw, 6);
    standLegs(new SkeletonSpace(root), legs, Vector3.Up(), new Vector3(0, 0, 1), 0.5);
    const half = measure(legs).r;
    expect(half.footYaw).toBeLessThan(before.r.footYaw - 3);
    expect(half.footYaw).toBeGreaterThan(TOE_OUT + 3);
    scene.dispose();
  });

  it('reads the way the toes point when the root faces the other way', () => {
    const scene = new Scene(new NullEngine());
    const { root, legs } = body(scene);
    // Told the body faces -z: the toes say +z, and the knees still bend toward them.
    standLegs(new SkeletonSpace(root), legs, Vector3.Up(), new Vector3(0, 0, -1), 1);
    const after = measure(legs);
    expect(after.l.kneePoint).toBeGreaterThan(0);
    expect(Math.abs(after.l.kneePoint)).toBeLessThan(KNEE_OUT + 3);
    scene.dispose();
  });
});
