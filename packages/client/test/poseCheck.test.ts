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
import { BIND_HOLD_MS, HOLD_FRAMES, PoseWatch, UNPOSED_HOLD_MS, poseCheckOn, rigidAlike, type PoseSample } from '../src/game/poseCheck.ts';
import type { CharacterInstance, Clip } from '../src/content/characters.ts';

/** The pose check (poseCheck.ts): a body drawn in its bind pose (the T-pose), or never posed, is reported once. */

function sample(key: object, o: Partial<PoseSample> = {}): PoseSample {
  return { key, visible: true, alive: true, bind: false, poses: 1, details: () => ({ who: 'x' }), ...o };
}

describe('PoseWatch', () => {
  it('reports a body drawn in its bind pose once it has been so for a moment, and only once', () => {
    const w = new PoseWatch();
    const body = {};
    let poses = 0;
    const at = (t: number) => w.observe(t, [sample(body, { bind: true, poses: ++poses })]);
    expect(at(0)).toEqual([]);
    expect(at(BIND_HOLD_MS - 50)).toEqual([]);
    const r = at(BIND_HOLD_MS + 10);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ reason: 'bind', who: 'x' });
    expect(r[0]!.forMs).toBeGreaterThanOrEqual(BIND_HOLD_MS);
    expect(at(BIND_HOLD_MS * 3)).toEqual([]);
  });

  it('a moment in the bind pose (a frame or two) is not reported', () => {
    const w = new PoseWatch();
    const body = {};
    for (let t = 0; t < 5000; t += 250) expect(w.observe(t, [sample(body, { bind: t % 1000 === 0, poses: t })])).toEqual([]);
  });

  it('only counts on-screen time: out of view the clock starts again', () => {
    const w = new PoseWatch();
    const body = {};
    for (let t = 0; t < 5000; t += 250) expect(w.observe(t, [sample(body, { bind: true, visible: t % 500 === 0, poses: t })])).toEqual([]);
  });

  it('reports a living body shown and never posed since, but not one posing', () => {
    const w = new PoseWatch();
    const stuck = {};
    const fine = {};
    let n = 0;
    let out: ReturnType<PoseWatch['observe']> = [];
    for (let t = 0; t <= UNPOSED_HOLD_MS + 250; t += 250) out = out.concat(w.observe(t, [sample(stuck, { poses: 7 }), sample(fine, { poses: ++n })]));
    expect(out).toHaveLength(1);
    expect(out[0]!.reason).toBe('unposed');
  });

  it('a dead body that stops posing is not "unposed" (its ragdoll or death pose holds it)', () => {
    const w = new PoseWatch();
    const body = {};
    for (let t = 0; t <= UNPOSED_HOLD_MS * 3; t += 250) expect(w.observe(t, [sample(body, { alive: false, poses: 3 })])).toEqual([]);
  });

  it('shown again after hiding, its pose count is taken afresh', () => {
    const w = new PoseWatch();
    const body = {};
    w.observe(0, [sample(body, { poses: 1 })]);
    w.observe(250, [sample(body, { visible: false, poses: 1 })]);
    // Shown at 500 with 5 poses, then posed: never reported.
    let out: ReturnType<PoseWatch['observe']> = [];
    for (let t = 500, p = 5; t < 3000; t += 250, p++) out = out.concat(w.observe(t, [sample(body, { poses: p })]));
    expect(out).toEqual([]);
  });

  it('on a slow page waits for frames as well as time (a far body steps every few frames)', () => {
    const w = new PoseWatch();
    const body = {};
    // A frame a second: 10 s is 10 frames, too few to call it never posed (or held in the bind pose).
    for (let t = 0, f = 0; t <= 10000; t += 1000, f++) expect(w.observe(t, [sample(body, { poses: 2, bind: true })], f)).toEqual([]);
    const r = w.observe(40000, [sample(body, { poses: 2, bind: true })], HOLD_FRAMES + 5);
    expect(r).toHaveLength(1);
    expect(r[0]!.forFrames).toBe(HOLD_FRAMES + 5);
  });

  it('writes at most its limit a match', () => {
    const w = new PoseWatch(2);
    const bodies = [{}, {}, {}];
    let out: ReturnType<PoseWatch['observe']> = [];
    for (let t = 0; t <= 2000; t += 250) out = out.concat(w.observe(t, bodies.map((b) => sample(b, { bind: true, poses: t }))));
    expect(out).toHaveLength(2);
  });

  it('is off in ?test=1 runs (and here) unless a test turns it on', () => {
    const g = globalThis as { __poseCheck?: boolean };
    g.__poseCheck = true;
    expect(poseCheckOn()).toBe(true);
    g.__poseCheck = false;
    expect(poseCheckOn()).toBe(false);
    delete g.__poseCheck;
  });
});

describe('rigidAlike', () => {
  const mats = (...ms: Matrix[]) => {
    const out = new Float32Array(ms.length * 16);
    ms.forEach((m, i) => m.copyToArray(out, i * 16));
    return out;
  };
  it('true when every probed matrix turns as the first (a skin at rest, moved or not)', () => {
    const moved = Matrix.Translation(0, 0.3, 0.1);
    expect(rigidAlike(mats(Matrix.Identity(), Matrix.Identity(), moved), [0, 1, 2])).toBe(true);
  });
  it('false when an arm is turned against the chest', () => {
    const arm = Matrix.RotationZ(1.2);
    expect(rigidAlike(mats(Matrix.Identity(), arm, Matrix.Identity()), [0, 1, 2])).toBe(false);
  });
  it("null when it can't tell", () => {
    expect(rigidAlike(mats(Matrix.Identity()), [0, -1, 5])).toBeNull();
  });
});

/** A rig with a chest and two arms whose bones rest at the identity (a T), and an aim clip that lowers the arms. */
function rig() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useConstantAnimationDeltaTime = true;
  const root = new TransformNode('char', scene);
  const sk = new Skeleton('sk', 'sk', scene);
  const joints = new Map<string, TransformNode>();
  const bones = new Map<string, Bone>();
  const joint = (name: string, parent: string | null) => {
    const n = new TransformNode(name, scene);
    n.parent = parent ? joints.get(parent)! : root;
    n.rotationQuaternion = Quaternion.Identity();
    joints.set(name, n);
    const b = new Bone(name, sk, parent ? bones.get(parent)! : null, Matrix.Identity());
    b.linkTransformNode(n);
    bones.set(name, b);
  };
  joint('root', null);
  joint('pelvis', 'root');
  joint('spine_03', 'pelvis');
  for (const s of ['l', 'r']) {
    joint(`upperarm_${s}`, 'spine_03');
    joint(`lowerarm_${s}`, `upperarm_${s}`);
  }
  const mesh = new Mesh('body', scene);
  mesh.parent = root;
  mesh.skeleton = sk;
  const aim = new AnimationGroup('aim_idle', scene);
  for (const s of ['l', 'r']) {
    const down = new Animation(`down_${s}`, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
    const q = Quaternion.RotationYawPitchRoll(0, 0, s === 'l' ? 1.2 : -1.2);
    down.setKeys([
      { frame: 0, value: q },
      { frame: 30, value: q },
    ]);
    aim.addTargetedAnimation(down, joints.get(`upperarm_${s}`)!);
  }
  const clips = new Map<Clip, AnimationGroup>([['aim_idle', aim]]);
  const ch: CharacterInstance = { root, joints, clips, meshes: [mesh], body: 'mannequin', hands: {}, dispose: () => scene.dispose() };
  const anim = new CharacterAnimator(scene, ch);
  /** One frame as the scene draws it: the clips, then the skin. */
  const frame = () => {
    scene.animate();
    sk.prepare();
    scene.incrementRenderId();
  };
  return { anim, frame, sk, scene, aim };
}

describe('CharacterAnimator.drawnBindPose', () => {
  it('sees a skin drawn at rest as the bind pose, and a posed one as not', () => {
    const { anim, frame, sk, aim } = rig();
    aim.stop();
    // Never posed: its skin as built is the T.
    sk.prepare();
    expect(anim.drawnBindPose()?.arms).toBe(true);
    aim.start(true);
    frame();
    frame();
    expect(anim.drawnBindPose()?.arms).toBe(false);
  });

  it('counts its evaluated poses (the "never posed" half of the check)', () => {
    const { anim, frame } = rig();
    const before = anim.poses;
    anim.stepAt(1000);
    frame();
    expect(anim.poses).toBeGreaterThan(before);
    expect(anim.poseState()).toMatchObject({ clip: 'aim_idle', dead: false, dormant: false });
  });
});
