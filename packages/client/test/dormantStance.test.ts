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
 * A character that stood up while it was asleep (out of view, setDormant) came back crouched ("Hyena Warrior can stay
 * crouched after waking", characters3). Driven as GameView drives one, on a three-joint rig whose bones rest at the
 * identity: the crouch clip bends the thigh, the standing one leaves it straight.
 */
function rig() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useConstantAnimationDeltaTime = true;
  const root = new TransformNode('char', scene);
  const joint = (name: string, parent: TransformNode) => {
    const n = new TransformNode(name, scene);
    n.parent = parent;
    n.rotationQuaternion = Quaternion.Identity();
    return n;
  };
  const skRoot = joint('root', root);
  const pelvis = joint('pelvis', skRoot);
  const thigh = joint('thigh_l', pelvis);
  const sk = new Skeleton('sk', 'sk', scene);
  const bRoot = new Bone('root', sk, null, Matrix.Identity());
  const bPelvis = new Bone('pelvis', sk, bRoot, Matrix.Identity());
  const bThigh = new Bone('thigh_l', sk, bPelvis, Matrix.Identity());
  bRoot.linkTransformNode(skRoot);
  bPelvis.linkTransformNode(pelvis);
  bThigh.linkTransformNode(thigh);
  const mesh = new Mesh('body', scene);
  mesh.parent = root;
  mesh.skeleton = sk;
  const pose = (name: string, pitch: number) => {
    const a = new Animation(name, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
    a.setKeys([
      { frame: 0, value: Quaternion.RotationYawPitchRoll(0, pitch, 0) },
      { frame: 30, value: Quaternion.RotationYawPitchRoll(0, pitch, 0) },
    ]);
    const g = new AnimationGroup(name, scene);
    g.addTargetedAnimation(a, thigh);
    return g;
  };
  const clips = new Map<Clip, AnimationGroup>([
    ['idle', pose('idle', 0)],
    ['aim_idle', pose('aim_idle', 0)],
    ['crouch_idle', pose('crouch_idle', 1.2)],
  ]);
  const ch: CharacterInstance = { root, joints: new Map([['root', skRoot], ['pelvis', pelvis], ['thigh_l', thigh]]), clips, meshes: [mesh], body: 'mannequin', hands: {}, dispose: () => scene.dispose() };
  const anim = new CharacterAnimator(scene, ch);
  const state = (stance: number) => ({ speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false, stance });
  const frame = (dt: number, stance: number) => {
    anim.update(dt, state(stance));
    scene.animate();
    scene.incrementRenderId();
    sk.prepare();
  };
  const bend = () => {
    const q = Quaternion.FromRotationMatrix(Matrix.FromArray((sk as unknown as { _transformMatrices: Float32Array })._transformMatrices, 16 * 2));
    return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  };
  return { scene, anim, clips, frame, bend };
}

describe('a character that stands up while asleep (out of view)', () => {
  it('wakes standing: the crouch it left while asleep is not played again', () => {
    const { scene, anim, clips, frame, bend } = rig();
    for (let i = 0; i < 30; i++) frame(1 / 60, 1);
    expect(bend()).toBeGreaterThan(1.1);
    // Out of view; it stands up meanwhile, evaluated now and then with a long step (a culled avatar: every 8th frame).
    anim.setDormant(true);
    frame(0.25, 0);
    frame(0.25, 0);
    anim.setDormant(false);
    // The first frames after waking (a far character is evaluated every few frames: here the clips just play).
    for (let i = 0; i < 3; i++) {
      scene.animate();
      scene.incrementRenderId();
    }
    const crouch = clips.get('crouch_idle')!;
    expect({ playing: crouch.isPlaying && crouch.weight > 0.001, weight: +crouch.weight.toFixed(2) }).toEqual({ playing: false, weight: expect.any(Number) });
    frame(1 / 60, 0);
    expect(bend()).toBeLessThan(0.05);
    // And it crouches again when it next does.
    for (let i = 0; i < 30; i++) frame(1 / 60, 1);
    expect(bend()).toBeGreaterThan(1.1);
    scene.dispose();
  });
});
