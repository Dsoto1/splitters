import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import '@babylonjs/core/Animations/animatable';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { patchAnimatables } from '../src/game/characterAnimator.ts';

/** Groups each turning `node` to a fixed rotation, started together at weight 1 for a frame. */
function groups(scene: Scene, node: TransformNode, n: number): AnimationGroup[] {
  return Array.from({ length: n }, (_, i) => {
    const a = new Animation(`turn${i}`, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
    const q = Quaternion.RotationYawPitchRoll(0.3 * (i + 1), 0.1 * i, 0);
    a.setKeys([
      { frame: 0, value: q },
      { frame: 30, value: q },
    ]);
    const g = new AnimationGroup(`g${i}`, scene);
    g.addTargetedAnimation(a, node);
    g.start(true);
    g.weight = 1;
    return g;
  });
}

const finite = (q: Quaternion) => [q.x, q.y, q.z, q.w].every(Number.isFinite);

describe('weighted clip blend (far enemies drawn as legs only, 2026-11-06)', () => {
  it('two clips dropping to weight 0 first in the order leave a rotation, not NaN', () => {
    patchAnimatables();
    const scene = new Scene(new NullEngine());
    const node = new TransformNode('spine', scene);
    node.rotationQuaternion = Quaternion.Identity();
    const [a, b, c] = groups(scene, node, 3);
    scene.animate();
    // A fight's kept shot and hit clips restarted at weight 0 (their first frame at 0 still blends), the aim pose on.
    a!.weight = 0;
    b!.weight = 0;
    c!.weight = 1;
    scene.animate();
    expect(finite(node.rotationQuaternion!)).toBe(true);
    // The rotation is the one clip that has weight.
    expect(Math.abs(Quaternion.Dot(node.rotationQuaternion!, Quaternion.RotationYawPitchRoll(0.9, 0.2, 0)))).toBeGreaterThan(0.999);
    scene.animate();
    expect(finite(node.rotationQuaternion!)).toBe(true);
    scene.dispose();
  });

  it('a clip at weight 0 changes nothing in a blend of the others', () => {
    patchAnimatables();
    const scene = new Scene(new NullEngine());
    const node = new TransformNode('spine', scene);
    node.rotationQuaternion = Quaternion.Identity();
    const [a, b, c, d] = groups(scene, node, 4);
    scene.animate();
    a!.weight = 0;
    b!.weight = 0;
    c!.weight = 0.5;
    d!.weight = 0.5;
    scene.animate();
    const want = Quaternion.Slerp(Quaternion.RotationYawPitchRoll(0.9, 0.2, 0), Quaternion.RotationYawPitchRoll(1.2, 0.3, 0), 0.5);
    expect(finite(node.rotationQuaternion!)).toBe(true);
    expect(Math.abs(Quaternion.Dot(node.rotationQuaternion!, want))).toBeGreaterThan(0.999);
    scene.dispose();
  });
});
