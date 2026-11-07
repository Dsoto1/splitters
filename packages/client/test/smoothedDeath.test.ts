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
import type { AnimStep } from '../src/game/animLod.ts';
import type { CharacterInstance, Clip } from '../src/content/characters.ts';

/**
 * Frozen characters (owner, 2026-11-07): a character that died while its animation was smoothed (performance round 4's
 * bands, some 15 m and more away) kept the smoothing on after GameView stopped stepping it, so its skin was drawn from
 * its last two living poses: the ragdoll under it showed as a figure standing mid-stride where it died (in the air if
 * it died there). These drive a CharacterAnimator as GameView does, on a three-joint rig whose bones rest at the
 * identity, so a joint's skin matrix is its rotation.
 */

/** 20 Hz, smoothed: a character 25-40 m away (animLod.ts OUTER). */
const SMOOTHED: AnimStep = { ms: 50, frames: 3, detail: 'coarse', smooth: true };

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
  // The aim pose swings the thigh 0 → 1.2 rad over its loop (a stride's worth of change between evaluations).
  const swing = new Animation('swing', 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
  swing.setKeys([
    { frame: 0, value: Quaternion.Identity() },
    { frame: 30, value: Quaternion.RotationYawPitchRoll(0, 1.2, 0) },
  ]);
  const aim = new AnimationGroup('aim_idle', scene);
  aim.addTargetedAnimation(swing, thigh);
  const hold = new Animation('hold', 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
  hold.setKeys([
    { frame: 0, value: Quaternion.RotationYawPitchRoll(0, -0.4, 0) },
    { frame: 10, value: Quaternion.RotationYawPitchRoll(0, -0.4, 0) },
  ]);
  const death = new AnimationGroup('death', scene);
  death.addTargetedAnimation(hold, thigh);
  const clips = new Map<Clip, AnimationGroup>([
    ['aim_idle', aim],
    ['death', death],
  ]);
  const ch: CharacterInstance = { root, joints: new Map([['root', skRoot], ['pelvis', pelvis], ['thigh_l', thigh]]), clips, meshes: [mesh], body: 'mannequin', hands: {}, dispose: () => scene.dispose() };
  const anim = new CharacterAnimator(scene, ch);
  let now = 1000;
  let frame = 0;
  const alive = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };
  /** One frame as GameView runs it: stepped (unless `stepped` is false: a dead body is not), animated, skinned. */
  const tick = (stepped = true) => {
    now += 1000 / 60;
    frame++;
    if (stepped && anim.stepAt(now, SMOOTHED, frame, 0)) anim.update(1 / 20, alive);
    scene.animate();
    scene.incrementRenderId();
    sk.prepare(true);
  };
  /** The thigh's skin matrix as drawn (its bones rest at the identity: the joint's rotation). */
  const drawnThigh = () => Quaternion.FromRotationMatrix(Matrix.FromArray((sk as unknown as { _transformMatrices: Float32Array })._transformMatrices, 16 * 2));
  const near = (a: Quaternion, b: Quaternion) => Math.abs(Quaternion.Dot(a, b)) > 0.9999;
  return { scene, anim, thigh, tick, drawnThigh, near };
}

describe('a body that dies while smoothed (frozen characters, 2026-11-07)', () => {
  it('a ragdoll is drawn as its bones lie, not as the last living poses', () => {
    const { scene, anim, thigh, tick, drawnThigh, near } = rig();
    for (let i = 0; i < 20; i++) tick();
    expect(anim.smoothing).toBe(true);
    const lastAlive = drawnThigh();
    // The death hands the body to a ragdoll (GameView: startRagdoll), and the view stops stepping it.
    anim.ragdoll('stop');
    expect(anim.smoothing).toBe(false);
    for (const pitch of [0.7, -0.9, 0.3]) {
      // Physics turns the joint.
      const flung = Quaternion.RotationYawPitchRoll(0.5, pitch, 0.2);
      thigh.rotationQuaternion = flung.clone();
      tick(false);
      expect(near(drawnThigh(), flung)).toBe(true);
      expect(near(drawnThigh(), lastAlive)).toBe(false);
    }
    // At rest it freezes (or a crowd drops it from the budget): the last pose stays, whatever the joint says later.
    const rest = Quaternion.RotationYawPitchRoll(0, 1.4, 0);
    thigh.rotationQuaternion = rest.clone();
    tick(false);
    anim.freezePose();
    thigh.rotationQuaternion = Quaternion.Identity();
    tick(false);
    expect(near(drawnThigh(), rest)).toBe(true);
    scene.dispose();
  });

  it('a body laid down (out of view) or dying without a ragdoll stops smoothing too', () => {
    const a = rig();
    for (let i = 0; i < 20; i++) a.tick();
    expect(a.anim.smoothing).toBe(true);
    a.anim.lieDown();
    expect(a.anim.smoothing).toBe(false);
    a.scene.dispose();
    const b = rig();
    for (let i = 0; i < 20; i++) b.tick();
    b.anim.update(0, { speed: 0, moveAngle: 0, airborne: false, alive: false, pitch: 0, celebrate: false });
    expect(b.anim.smoothing).toBe(false);
    b.scene.dispose();
  });

  it('a body kept for reuse stands again with a fresh smoothing state', () => {
    const { scene, anim, thigh, tick, drawnThigh, near } = rig();
    for (let i = 0; i < 20; i++) tick();
    anim.ragdoll('stop');
    thigh.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.5, 0.7, 0.2);
    tick(false);
    anim.freezePose();
    // The corpse goes (GameView.keepBody), and the body is taken by the next avatar of its look.
    anim.standBy();
    expect(anim.smoothing).toBe(false);
    anim.setDormant(false);
    // Revived on its first update; every frame after draws the bones' own pose (one step behind at most), never one
    // from before the death.
    tick();
    for (let i = 0; i < 12; i++) {
      tick();
      const drawn = drawnThigh();
      expect(near(drawn, Quaternion.RotationYawPitchRoll(0.5, 0.7, 0.2))).toBe(false);
      // On the aim pose's swing (a pure turn about x, as the clip makes it).
      expect(Math.abs(drawn.y) + Math.abs(drawn.z)).toBeLessThan(1e-4);
    }
    expect(anim.smoothing).toBe(true);
    scene.dispose();
  });
});
