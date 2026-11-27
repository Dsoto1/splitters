import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import '@babylonjs/core/Animations/animatable';
import { Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { CharacterAnimator } from '../src/game/characterAnimator.ts';
import type { CharacterInstance, Clip } from '../src/content/characters.ts';

/**
 * The after-clip work (the strafe's hip turn and the spine's counter-turn, the aim) turns joints in place, on top of
 * what the clips wrote. A frame whose clips didn't write a joint (not evaluated, at weight 0, or a clip without that
 * joint) left last frame's turn on it, and the next turn stacked on that: frame on frame the hips and the top half spun
 * round (owner, 2026-11-27: "top half spinning" as characters first load in). Here the clips drive only the legs, so
 * the hips and spine are never written by a clip: each evaluation must still start from their clip pose.
 */
function rig(driveSpine: boolean) {
  const scene = new Scene(new NullEngine());
  scene.useConstantAnimationDeltaTime = true;
  const root = new TransformNode('char', scene);
  const joints = new Map<string, TransformNode>();
  const joint = (name: string, parent: TransformNode) => {
    const n = new TransformNode(name, scene);
    n.parent = parent;
    n.rotationQuaternion = Quaternion.Identity();
    joints.set(name, n);
    return n;
  };
  const skRoot = joint('root', root);
  const pelvis = joint('pelvis', skRoot);
  const s1 = joint('spine_01', pelvis);
  const s2 = joint('spine_02', s1);
  const s3 = joint('spine_03', s2);
  const thigh = joint('thigh_l', pelvis);
  const sk = new Skeleton('sk', 'sk', scene);
  let parentBone: Bone | null = null;
  for (const n of [skRoot, pelvis, s1, s2, s3]) {
    const b = new Bone(n.name, sk, parentBone, Matrix.Identity());
    b.linkTransformNode(n);
    parentBone = b;
  }
  new Bone('thigh_l', sk, sk.bones[1]!, Matrix.Identity()).linkTransformNode(thigh);
  const mesh = new Mesh('body', scene);
  mesh.parent = root;
  mesh.skeleton = sk;
  const clip = (name: string) => {
    const g = new AnimationGroup(name, scene);
    const targets = driveSpine ? [thigh, pelvis, s1, s2, s3] : [thigh];
    for (const t of targets) {
      const a = new Animation(`${name}_${t.name}`, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
      a.setKeys([
        { frame: 0, value: Quaternion.Identity() },
        { frame: 30, value: t === thigh ? Quaternion.RotationYawPitchRoll(0, 0.4, 0) : Quaternion.Identity() },
      ]);
      g.addTargetedAnimation(a, t);
    }
    return g;
  };
  const clips = new Map<Clip, AnimationGroup>((['idle', 'aim_idle', 'walk', 'run'] as const).map((c) => [c, clip(c)]));
  const ch: CharacterInstance = { root, joints, clips, meshes: [mesh], body: 'mannequin', hands: {}, dispose: () => scene.dispose() };
  const anim = new CharacterAnimator(scene, ch);
  // Strafing to the right: the hips turn toward the motion, the spine back by as much.
  const frame = () => {
    anim.stepAt(performance.now());
    anim.update(1 / 60, { speed: 3, moveAngle: 0.6, airborne: false, alive: true, pitch: 0, celebrate: false, stance: 0 });
    scene.animate();
    scene.incrementRenderId();
  };
  const angle = (n: TransformNode) => 2 * Math.acos(Math.min(1, Math.abs(n.rotationQuaternion!.w)));
  return { scene, anim, frame, pelvis, s3, angle };
}

describe('the hips and spine with no clip on them (owner, 2026-11-27: top halves spinning)', () => {
  it('turn as far as the strafe asks, not further every frame', () => {
    const { scene, anim, frame, pelvis, s3, angle } = rig(false);
    let most = 0;
    for (let i = 0; i < 240; i++) {
      frame();
      most = Math.max(most, angle(pelvis), angle(s3));
    }
    // The hip turn is capped well under a right angle (HIP_TURN_MAX); stacked, it went round and round.
    expect(most).toBeLessThan(1.2);
    expect(angle(pelvis)).toBeGreaterThan(0.1);
    expect(anim.undriven).toBeGreaterThan(100);
    scene.dispose();
  });

  it('changes nothing for joints the clips drive', () => {
    const { scene, anim, frame, pelvis, angle } = rig(true);
    for (let i = 0; i < 120; i++) frame();
    expect(angle(pelvis)).toBeGreaterThan(0.1);
    expect(angle(pelvis)).toBeLessThan(1.2);
    expect(anim.undriven).toBe(0);
    scene.dispose();
  });
});
