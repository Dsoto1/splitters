import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import '@babylonjs/core/Animations/animatable';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { CharacterAnimator, hoverScaleOf } from '../src/game/characterAnimator.ts';
import type { CharacterInstance, Clip } from '../src/content/characters.ts';
import { getLook } from '@tiletrigger/shared';
import { MEASURED_HITBOXES } from '../../shared/src/content/hitboxes.generated.ts';

/**
 * Floaters hover (owner, 2026-11-27): The Veiled Vanguard and Mujina are drawn their look's `hover` height clear of the
 * ground with a slow bob, scaled with their size, and come down seated or dead; their hit shapes are measured as high.
 */
function body(size: number, locomotion?: 'hover' | 'roll') {
  const scene = new Scene(new NullEngine());
  const holder = new TransformNode('avatar', scene);
  const root = new TransformNode('char', scene);
  root.parent = holder;
  // A 1.8 m body standing on its origin, fitted and sized as view.ts does (the model's 0.9 m rest height to 1.8 m, then its size).
  const mesh = CreateBox('body', { width: 0.2, depth: 0.2, height: 0.9 }, scene);
  mesh.position.y = 0.45;
  mesh.parent = root;
  root.scaling.setAll(2 * size);
  const thigh = new TransformNode('thigh_l', scene);
  thigh.parent = root;
  thigh.rotationQuaternion = Quaternion.Identity();
  const clip = (name: string) => {
    const g = new AnimationGroup(name, scene);
    const a = new Animation(`${name}_t`, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
    a.setKeys([
      { frame: 0, value: Quaternion.Identity() },
      { frame: 30, value: Quaternion.Identity() },
    ]);
    g.addTargetedAnimation(a, thigh);
    return g;
  };
  const clips = new Map<Clip, AnimationGroup>((['idle', 'aim_idle', 'walk', 'run'] as const).map((c) => [c, clip(c)]));
  const ch: CharacterInstance = { root, joints: new Map([['thigh_l', thigh]]), clips, meshes: [mesh], body: 'female', hands: {}, ...(locomotion ? { locomotion } : {}), ...(locomotion === 'hover' ? { hover: 0.3 } : {}), dispose: () => scene.dispose() };
  const anim = new CharacterAnimator(scene, ch);
  const state = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false, stance: 0 as const, seated: false };
  const run = (seconds: number, s: Partial<typeof state> = {}) => {
    const lifts: number[] = [];
    for (let i = 0; i < seconds * 60; i++) {
      anim.update(1 / 60, { ...state, ...s });
      lifts.push(root.position.y);
    }
    return lifts;
  };
  return { scene, anim, root, run };
}

describe('floaters hover (owner, 2026-11-27)', () => {
  it('is data: The Veiled Vanguard and Mujina hover, the Baseball Robot still rolls', () => {
    for (const id of ['core.vanguard', 'core.facelessspirit']) {
      expect(getLook(id).locomotion, id).toBe('hover');
      expect(getLook(id).hover, id).toBeGreaterThan(0.2);
    }
    expect(getLook('core.rollerbot').locomotion).toBe('roll');
    expect(getLook('core.rollerbot').hover).toBeUndefined();
  });

  it('floats its height clear of the ground with a calm bob, and its size scales both', () => {
    for (const size of [1, 1.18]) {
      const { scene, root, run } = body(size, 'hover');
      expect(hoverScaleOf({ root })).toBeCloseTo(size, 3);
      run(3);
      const lifts = run(3.2);
      const lo = Math.min(...lifts), hi = Math.max(...lifts);
      // About 0.3 m (times the size) up, bobbing a few centimetres, never down to the ground.
      expect(lo).toBeGreaterThan(0.25 * size);
      expect(hi).toBeLessThan(0.35 * size);
      expect(hi - lo).toBeGreaterThan(0.03 * size);
      // Slow: no frame moves it more than a few millimetres (no flicker).
      const steps = lifts.slice(1).map((y, i) => Math.abs(y - lifts[i]!));
      expect(Math.max(...steps)).toBeLessThan(0.002 * size);
      scene.dispose();
    }
  });

  it('comes down seated and dead, and walks on the ground when it does not hover', () => {
    const { scene, anim, root, run } = body(1, 'hover');
    run(3);
    run(3, { seated: true });
    // Seated it sits on the cushion as everyone does (the seat's own drop), no lift on top.
    expect(Math.abs(anim.hoverLift)).toBeLessThan(0.02);
    run(3);
    expect(root.position.y).toBeGreaterThan(0.2);
    run(0.1, { alive: false });
    expect(root.position.y).toBe(0);
    scene.dispose();
    for (const loco of [undefined, 'roll'] as const) {
      const other = body(1, loco);
      expect(Math.max(...other.run(2).map(Math.abs))).toBe(0);
      other.scene.dispose();
    }
  });

  it('is shot where it is drawn: its hit shapes are measured as high as it floats', () => {
    for (const id of ['core.vanguard', 'core.facelessspirit']) {
      const box = MEASURED_HITBOXES[id]!;
      expect(box.hover).toBe(getLook(id).hover);
      // Drawn upright in every stance (it hunches, it doesn't crouch): the standing shapes, the head near 1.9 m.
      expect(box.crouch).toBeNull();
      expect(box.stand.head!.y).toBeGreaterThan(1.8);
      expect(Math.min(...box.stand.legs.flatMap((l) => [l.a[1], l.b[1]]), box.stand.torso!.a[0])).toBeGreaterThan(0.25);
    }
  });
});
