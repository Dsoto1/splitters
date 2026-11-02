import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { STRIDE_MAX_GAIN, STRIDE_MAX_RATE, clipCycleRate, clipGaitWeights, matchClipPhase, strideWarp, type ClipLoop } from '../src/game/gait.ts';
import { scaleTurn, worldTurn } from '../src/game/characterAnimator.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

// The WWII Infantry clip set's loops as measured (content/meshy.lock.json): walk, run, backward shooting walk.
const WALK: ClipLoop = { speed: 1.532, seconds: 1.033, footDown: 0.194 };
const RUN: ClipLoop = { speed: 5.019, seconds: 0.633, footDown: 0.211 };
const BACK: ClipLoop = { speed: 0.847, seconds: 1.267, footDown: 0.526 };

describe('clip gait: speed blend', () => {
  it('walks at the walk\'s own speed and below, runs from most of the run\'s, blends between', () => {
    expect(clipGaitWeights(0.8, WALK.speed, RUN.speed)).toEqual({ walk: 1, run: 0 });
    expect(clipGaitWeights(WALK.speed, WALK.speed, RUN.speed).run).toBe(0);
    expect(clipGaitWeights(5.2, WALK.speed, RUN.speed)).toEqual({ walk: 0, run: 1 });
    const mid = clipGaitWeights(3, WALK.speed, RUN.speed);
    expect(mid.walk + mid.run).toBeCloseTo(1, 9);
    expect(mid.run).toBeGreaterThan(0.2);
    expect(mid.run).toBeLessThan(0.8);
  });

  it('keeps the planted foot still: one cycle covers the blended loops\' ground at that speed', () => {
    // All run at 5.2 m/s (the game's pace): the run's own cycle rate times the speed's share of its natural speed.
    expect(clipCycleRate(5.2, [{ loop: RUN, weight: 1 }])).toBeCloseTo(5.2 / (RUN.speed * RUN.seconds), 9);
    // A bigger body covers more ground per cycle: fewer cycles.
    expect(clipCycleRate(5.2, [{ loop: RUN, weight: 1 }], 1.25)).toBeCloseTo(5.2 / (RUN.speed * RUN.seconds * 1.25), 9);
    // Blended, between the two.
    const r = clipCycleRate(3, [{ loop: WALK, weight: 0.5 }, { loop: RUN, weight: 0.5 }]);
    expect(r).toBeCloseTo(3 / ((WALK.speed * WALK.seconds + RUN.speed * RUN.seconds) / 2), 9);
    expect(clipCycleRate(3, [])).toBe(0);
  });

  it('joins a loop with its left foot down when the leading loop\'s is', () => {
    expect(matchClipPhase(WALK, WALK.footDown, RUN)).toBeCloseTo(RUN.footDown, 9);
    expect(matchClipPhase(RUN, 0.9, WALK)).toBeCloseTo(0.9 - RUN.footDown + WALK.footDown, 9);
    expect(matchClipPhase(RUN, 0, WALK)).toBeCloseTo(1 - RUN.footDown + WALK.footDown, 9);
  });
});

describe('clip gait: stride warping', () => {
  it('plays a slow clip faster up to the cadence cap, then lengthens the stride', () => {
    // At its own pace: as authored.
    expect(strideWarp(BACK.speed, BACK.speed)).toEqual({ rate: 1, gain: 1 });
    expect(strideWarp(1.5, BACK.speed).gain).toBe(1);
    // Backing up at 3 m/s: the cadence stops at the cap and the steps are longer.
    const mid = strideWarp(3, BACK.speed);
    expect(mid.rate).toBeCloseTo(STRIDE_MAX_RATE, 9);
    expect(mid.gain).toBeGreaterThan(1.5);
    expect(mid.rate * mid.gain * BACK.speed).toBeCloseTo(3, 9);
    // Backpedalling aiming (3.9 m/s): the longest stride, the cadence a little over the cap.
    const ads = strideWarp(3.9, BACK.speed);
    expect(ads.gain).toBe(STRIDE_MAX_GAIN);
    expect(ads.rate).toBeLessThan(STRIDE_MAX_RATE * 1.1);
    // Faster still, the stride stops growing and the cadence takes the rest (the feet slide no more than they must).
    const full = strideWarp(8, BACK.speed);
    expect(full.gain).toBe(STRIDE_MAX_GAIN);
    expect(full.rate * full.gain * BACK.speed).toBeCloseTo(8, 9);
    // A bigger body: its own pace is faster.
    expect(strideWarp(BACK.speed * 1.2, BACK.speed, 1.2).rate).toBeCloseTo(1, 9);
  });

  it('scales a turn about the middle pose', () => {
    const mid = Quaternion.RotationAxis(new Vector3(1, 0, 0), 0.3);
    const q = Quaternion.RotationAxis(new Vector3(1, 0, 0), 0.5);
    const out = scaleTurn(mid, q, 2);
    const want = Quaternion.RotationAxis(new Vector3(1, 0, 0), 0.7);
    expect(Math.abs(Quaternion.Dot(out, want))).toBeCloseTo(1, 9);
    expect(Math.abs(Quaternion.Dot(scaleTurn(mid, q, 1), q))).toBeCloseTo(1, 9);
  });
});

describe('worldTurn', () => {
  it('turns a joint the same way about the world\'s up in every joint frame (the spine\'s and the hips\' alike)', () => {
    // A joint under the glTF import's mirrored root (z scaled -1), in joint frames as rigs have them: Y up (the root's), X along the bone (a UE spine's), Z along it.
    const frames = [Quaternion.Identity(), Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.PI / 2), Quaternion.RotationAxis(new Vector3(1, 0, 0), -Math.PI / 2), Quaternion.RotationYawPitchRoll(0.4, 1.1, -0.7)];
    for (const f of frames) {
      const engine = new NullEngine();
      engines.push(engine);
      const scene = new Scene(engine);
      const mirror = new TransformNode('__root__', scene);
      mirror.scaling.set(1, 1, -1);
      const parent = new TransformNode('parent', scene);
      parent.parent = mirror;
      parent.rotationQuaternion = f;
      const joint = new TransformNode('joint', scene);
      joint.parent = parent;
      joint.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.2, -0.3, 0.1);
      joint.computeWorldMatrix(true);
      // A point off the joint's pivot, in the world, before and after.
      const probe = new TransformNode('probe', scene);
      probe.parent = joint;
      probe.position.set(0.3, 0.1, 0.5);
      probe.computeWorldMatrix(true);
      const p0 = probe.getAbsolutePosition().subtract(joint.getAbsolutePosition());
      joint.rotationQuaternion = worldTurn(parent, Vector3.Up(), 0.5).multiply(joint.rotationQuaternion);
      joint.computeWorldMatrix(true);
      probe.computeWorldMatrix(true);
      const p1 = probe.getAbsolutePosition().subtract(joint.getAbsolutePosition());
      // Turned about the world's up by 0.5 rad, toward +X from +Z (Babylon's yaw): heights kept.
      expect(p1.y).toBeCloseTo(p0.y, 5);
      const yaw = (v: Vector3) => Math.atan2(v.x, v.z);
      const d = yaw(p1) - yaw(p0);
      expect(Math.atan2(Math.sin(d), Math.cos(d))).toBeCloseTo(0.5, 6);
    }
  });
});
