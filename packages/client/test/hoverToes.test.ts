import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import '@babylonjs/core/Animations/animatable';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CharacterAnimator } from '../src/game/characterAnimator.ts';
import type { CharacterInstance, Clip } from '../src/content/characters.ts';

/**
 * Floaters point their toes down (owner, 2026-11-28: "it looks odd when she's floating and has feet as if they are
 * planted"): off the ground a hovering body's feet hang, toes down and knees a little bent; seated, dead or not
 * hovering they stand as the clips put them. A look's `hoverPose`: `thrusters` (jets under the feet, Botboy) holds the
 * legs straight and together with the soles flat to the ground; `clips` keeps the clips' legs.
 */
function body(locomotion?: 'hover', hoverPose?: 'thrusters' | 'clips') {
  const scene = new Scene(new NullEngine());
  const holder = new TransformNode('avatar', scene);
  const root = new TransformNode('char', scene);
  root.parent = holder;
  const mesh = CreateBox('body', { width: 0.2, depth: 0.2, height: 0.9 }, scene);
  mesh.position.y = 0.45;
  mesh.parent = root;
  root.scaling.setAll(2);
  // One leg (and its twin), the rig's way: thigh at the hip, calf at the knee, foot at the ankle, ball ahead (+z, the body's front).
  const joints = new Map<string, TransformNode>();
  const legs: TransformNode[] = [];
  const pelvis = new TransformNode('pelvis', scene);
  pelvis.parent = root;
  pelvis.position.set(0, 0.45, 0);
  pelvis.rotationQuaternion = Quaternion.Identity();
  joints.set('pelvis', pelvis);
  // A spine (the after-clip pass runs on a body that has one).
  let back: TransformNode = pelvis;
  for (const n of ['spine_01', 'spine_02', 'spine_03']) {
    const j = new TransformNode(n, scene);
    j.parent = back;
    j.position.set(0, 0.1, 0);
    j.rotationQuaternion = Quaternion.Identity();
    joints.set(n, j);
    back = j;
  }
  for (const side of ['l', 'r']) {
    let parent: TransformNode = pelvis;
    for (const [name, at] of [['thigh', [side === 'l' ? 0.05 : -0.05, 0, 0]], ['calf', [0, -0.2, 0]], ['foot', [0, -0.2, 0]], ['ball', [0, -0.03, 0.06]]] as const) {
      const j = new TransformNode(`${name}_${side}`, scene);
      j.parent = parent;
      j.position.set(at[0], at[1], at[2]);
      j.rotationQuaternion = Quaternion.Identity();
      joints.set(j.name, j);
      legs.push(j);
      parent = j;
    }
  }
  // Clips that hold every leg joint at rest (the clips write the legs each frame; the after-clip pass turns them from there).
  const clip = (name: string) => {
    const g = new AnimationGroup(name, scene);
    for (const j of legs) {
      const a = new Animation(`${name}_${j.name}`, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
      a.setKeys([
        { frame: 0, value: Quaternion.Identity() },
        { frame: 30, value: Quaternion.Identity() },
      ]);
      g.addTargetedAnimation(a, j);
    }
    return g;
  };
  const clips = new Map<Clip, AnimationGroup>((['idle', 'aim_idle', 'walk', 'run'] as const).map((c) => [c, clip(c)]));
  const ch: CharacterInstance = { root, joints, clips, meshes: [mesh], body: 'female', hands: {}, ...(locomotion ? { locomotion, hover: 0.3 } : {}), ...(hoverPose ? { hoverPose } : {}), dispose: () => scene.dispose() };
  const anim = new CharacterAnimator(scene, ch);
  const state = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false, stance: 0 as const, seated: false };
  /** Frames, then the toes' pitch below level (rad, from their rest), the knee's bend, the feet's and the hips' spread (m). */
  const run = (seconds: number, s: Partial<typeof state> = {}) => {
    for (let i = 0; i < seconds * 60; i++) {
      anim.update(1 / 60, { ...state, ...s });
      scene.animate();
    }
    const at = (n: string) => joints.get(n)!.getAbsolutePosition().clone();
    const toe = at('ball_l').subtract(at('foot_l'));
    const shin = at('foot_l').subtract(at('calf_l'));
    return { toes: Math.atan2(-toe.y, toe.z) - Math.atan2(0.03, 0.06), knee: Vector3.GetAngleBetweenVectors(shin, Vector3.Down(), Vector3.Right()), feet: Vector3.Distance(at('foot_l'), at('foot_r')), hips: Vector3.Distance(at('thigh_l'), at('thigh_r')) };
  };
  return { scene, run };
}

describe('floaters point their toes down (owner, 2026-11-28)', () => {
  it('off the ground the feet hang, toes down 45-75 degrees, knees a little bent', () => {
    const { scene, run } = body('hover');
    const up = run(3);
    expect(up.toes).toBeGreaterThan((45 * Math.PI) / 180);
    expect(up.toes).toBeLessThan((75 * Math.PI) / 180);
    expect(Math.abs(up.knee)).toBeGreaterThan(0.1);
    expect(Math.abs(up.knee)).toBeLessThan(0.45);
    // Seated (the lift eased away), the feet are the clips' again (dead, the ragdoll takes the legs).
    const seated = run(3, { seated: true });
    expect(Math.abs(seated.toes)).toBeLessThan(0.05);
    scene.dispose();
  });

  it('jets under the feet (thrusters): legs nearly straight and together, soles flat to the ground', () => {
    const { scene, run } = body('hover', 'thrusters');
    const up = run(3);
    expect(Math.abs(up.toes)).toBeLessThan(0.03);
    expect(Math.abs(up.knee)).toBeLessThan(0.1);
    expect(up.feet).toBeLessThan(up.hips - 0.02);
    scene.dispose();
  });

  it("leaves a walker's legs and a look that keeps the clips' (hoverPose: clips) as the clips pose them", () => {
    for (const b of [body(), body('hover', 'clips')]) {
      const r = b.run(3);
      expect(Math.abs(r.toes)).toBeLessThan(1e-3);
      expect(Math.abs(r.knee)).toBeLessThan(1e-3);
      b.scene.dispose();
    }
  });
});
