import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { shareWristTwist, wristTwist } from '../src/game/characterAnimator.ts';
import { swingTwist } from '../src/tools/limbProbe.ts';

const rad = (d: number) => (d * Math.PI) / 180;

/** An upper arm, forearm and hand along +x, the hand turned palm up (a half turn less a little) and bent back. */
function arm(scene: Scene) {
  const upper = new TransformNode('upperarm_l', scene);
  upper.rotationQuaternion = Quaternion.RotationAxis(new Vector3(0, 0, 1), rad(-30));
  const lower = new TransformNode('lowerarm_l', scene);
  lower.parent = upper;
  lower.position.set(0.28, 0, 0);
  lower.rotationQuaternion = Quaternion.RotationAxis(new Vector3(0, 1, 0), rad(40));
  const hand = new TransformNode('hand_l', scene);
  hand.parent = lower;
  hand.position.set(0.26, 0, 0);
  const rest = Quaternion.Identity();
  hand.rotationQuaternion = Quaternion.RotationAxis(new Vector3(1, 0, 0), rad(-150)).multiply(Quaternion.RotationAxis(new Vector3(0, 0, 1), rad(25)));
  return { upper, lower, hand, rest };
}
const world = (n: TransformNode) => {
  n.computeWorldMatrix(true);
  const q = new Quaternion();
  n.getWorldMatrix().decompose(undefined, q);
  return { q, p: n.getAbsolutePosition().clone() };
};

describe('support wrist twist shared along the forearm', () => {
  it('measures the twist and the bend off rest', () => {
    const scene = new Scene(new NullEngine());
    const { hand, rest } = arm(scene);
    const m = swingTwist(hand.rotationQuaternion!, rest, hand.position, false);
    expect(m.twist).toBeCloseTo(-150, 0);
    expect(m.bend).toBeCloseTo(25, 0);
    expect((wristTwist(hand.parent as TransformNode, hand, rest)! * 180) / Math.PI).toBeCloseTo(-150, 0);
    scene.dispose();
  });

  it('moves the share into the forearm, the hand left where it was in the world, its bend unchanged', () => {
    const scene = new Scene(new NullEngine());
    const { lower, hand, rest } = arm(scene);
    const before = world(hand);
    const lowerRest = lower.rotationQuaternion!.clone();
    shareWristTwist(lower, hand, rest, 0.4);
    const after = world(hand);
    expect(Vector3.Distance(before.p, after.p)).toBeLessThan(1e-6);
    expect(Math.abs(Quaternion.Dot(before.q, after.q))).toBeGreaterThan(1 - 1e-6);
    const m = swingTwist(hand.rotationQuaternion!, rest, hand.position, false);
    expect(m.twist).toBeCloseTo(-90, 0);
    expect(m.bend).toBeCloseTo(25, 0);
    // The forearm took the 60°, about its own line.
    expect(swingTwist(lower.rotationQuaternion!, lowerRest, hand.position, true).twist).toBeCloseTo(-60, 0);
    scene.dispose();
  });
});
