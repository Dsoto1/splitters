import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CORE_LOOKS, PLAYER, armsLookFor, getWeapon } from '@tiletrigger/shared';
import { CharacterLibrary } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, setCurlShare, type MotionState } from '../game/characterAnimator.ts';
import { createViewCamera, poseCamera } from '../game/cameraPose.ts';
import { fitFirstPersonArms } from '../game/firstPersonArms.ts';
import { FirstPersonBodyRig, fitFirstPersonBody } from '../game/firstPersonBody.ts';
import { DEFAULT_FOV } from '../game/view.ts';
import { auditGrip } from './gripAudit.ts';
import type { CharacterInstance } from '../content/characters.ts';
import type { WeaponHold } from '@tiletrigger/shared';

/** How a pose is shown: the character from outside, its own first-person arms from the eye, or its whole body from the eye (full-body first person). */
export type GripView = 'third' | 'first' | 'body';

/**
 * Grip check (team tool, `?mode=grips`): one character at a time holding one
 * weapon, in third person (framed on the hands) or first person (the game's
 * own first-person arms and viewmodel placement), so a bad grip shows at a
 * glance. tools/content/grip-sheet.mjs drives it through `window.__grips` and
 * screenshots each pose into a sheet per character.
 */
export async function openGripSheet(engine: AbstractEngine): Promise<void> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.22, 0.25, 1);
  new HemisphericLight('hemi', new Vector3(0.3, 1, 0.4), scene).intensity = 0.95;
  new DirectionalLight('sun', new Vector3(-0.4, -1, 0.6), scene).intensity = 0.8;
  const ground = CreateGround('ground', { width: 8, height: 8 }, scene);
  const gm = new StandardMaterial('groundMat', scene);
  gm.diffuseColor = new Color3(0.3, 0.32, 0.36);
  ground.material = gm;

  const orbit = new ArcRotateCamera('orbit', Math.PI / 2, 1.2, 1.2, new Vector3(0, 1.3, 0), scene);
  orbit.minZ = 0.02;
  const eye = createViewCamera('eye', scene);
  eye.minZ = 0.02;
  eye.fov = DEFAULT_FOV;
  scene.activeCamera = orbit;

  window.addEventListener('resize', () => engine.resize());
  const characters = new CharacterLibrary(scene, { atlas: true });
  const models = new ModelLibrary(scene);
  const still: MotionState = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };
  /** Full-body first person: the view's pitch (radians, the game's: + looks up) and the body's motion (`__grips.motion`). */
  let eyePitch = 0;
  let eyeDrop = 0;
  let rig: FirstPersonBodyRig | null = null;
  let current: { anim: CharacterAnimator; dispose(): void } | null = null;
  /** The posed character's joints (third person), for posture measurements. */
  let joints: Map<string, TransformNode> | null = null;
  /** The third-person pose's character, gun and hold (`__grips.audit`). */
  let posed: { ch: CharacterInstance; weapon: TransformNode; hold: WeaponHold } | null = null;
  let frames = 0;
  /** `__grips.drive`: shots a second fired while driven (0: none), and the frame of the last one. */
  let fireRate = 0;
  let firedAt = 0;

  /** `__grips.crowd`: extra characters driven like the posed one (an animation cost measurement). */
  const crowd: CharacterAnimator[] = [];

  engine.runRenderLoop(() => {
    current?.anim.update(1 / 30, { ...still, pitch: eyePitch });
    for (const a of crowd) a.update(1 / 30, { ...still, pitch: eyePitch });
    if (fireRate > 0 && current && frames - firedAt >= 30 / fireRate) {
      firedAt = frames;
      current.anim.trigger('shoot');
    }
    if (rig) {
      eye.position.set(0, PLAYER.eyeHeight - eyeDrop, 0);
      poseCamera(eye, 0, eyePitch);
      rig.eye.copyFrom(eye.position);
      rig.pitch = eyePitch;
    }
    scene.render();
    frames++;
  });
  const settle = async (n: number) => {
    const until = frames + n;
    while (frames < until) await new Promise((r) => setTimeout(r, 10));
  };

  /** Show `look` holding `weapon` from `view`; resolves once the pose has settled and is on screen. */
  async function pose(look: string, weapon: string, view: GripView): Promise<void> {
    current?.dispose();
    current = null;
    joints = null;
    posed = null;
    rig = null;
    const def = getWeapon(weapon);
    if (view === 'body') {
      // Full-body first person, as the game draws it (firstPersonBody.ts): the whole character under the eye,
      // its head shrunk away, the viewmodel placed as the game places it and gripped by IK.
      ground.setEnabled(true);
      const holder = new TransformNode('grip_body', scene);
      const ch = await characters.create({ look }, 'grip_char');
      fitFirstPersonBody(ch, holder);
      const viewRoot = new TransformNode('grip_view', scene);
      viewRoot.parent = eye;
      const node = await models.instantiate(def.view.model, 'grip_viewmodel');
      node.parent = viewRoot;
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      const [vx, vy, vz] = def.view.viewOffset;
      viewRoot.position.set(vx, vy, vz);
      const anim = new CharacterAnimator(scene, ch);
      anim.gripExternal(node, def.view.hold);
      const r = new FirstPersonBodyRig(scene, ch, anim, holder);
      rig = r;
      current = {
        anim,
        dispose: () => {
          r.dispose();
          anim.dispose();
          node.dispose();
          viewRoot.dispose();
          holder.dispose();
        },
      };
      joints = ch.joints;
      eye.position.set(0, PLAYER.eyeHeight - eyeDrop, 0);
      poseCamera(eye, 0, eyePitch);
      scene.activeCamera = eye;
      await settle(40);
    } else if (view === 'third') {
      ground.setEnabled(true);
      const ch = await characters.create({ look }, 'grip_char');
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      ch.root.scaling.scaleInPlace((PLAYER.height * ch.root.scaling.y) / Math.max(0.5, max.y - min.y));
      const anim = new CharacterAnimator(scene, ch);
      const node = await models.instantiate(def.view.model, 'grip_weapon');
      anim.hold(node, def.view.hold);
      current = { anim, dispose: () => anim.dispose() };
      joints = ch.joints;
      posed = { ch, weapon: node, hold: def.view.hold };
      scene.activeCamera = orbit;
      await settle(40);
      // Framed on the hands, from the front and to the character's right (the gun hand's side).
      const at = (n: string) => {
        const j = ch.joints.get(n);
        j?.computeWorldMatrix(true);
        return j ? j.getAbsolutePosition().clone() : new Vector3(0, 1.2, 0.3);
      };
      const hr = at('hand_r');
      const hl = at('hand_l');
      const side = Math.sign(at('upperarm_r').x) || 1;
      const target = def.view.hold.style === 'melee' ? hr : hr.add(hl).scale(0.5);
      orbit.target.copyFrom(target);
      orbit.alpha = Math.PI / 2 - side * 0.75;
      orbit.beta = 1.25;
      orbit.radius = 0.95;
      await settle(4);
    } else {
      ground.setEnabled(false);
      const root = new TransformNode('grip_fp', scene);
      root.parent = eye;
      const viewRoot = new TransformNode('grip_view', scene);
      viewRoot.parent = eye;
      const ch = await characters.create({ look: armsLookFor(look), armsOnly: true }, 'grip_arms');
      fitFirstPersonArms(ch, root);
      const node = await models.instantiate(def.view.model, 'grip_viewmodel');
      node.parent = viewRoot;
      const [vx, vy, vz] = def.view.viewOffset;
      viewRoot.position.set(vx, vy, vz);
      const anim = new CharacterAnimator(scene, ch);
      anim.gripExternal(node, def.view.hold);
      current = {
        anim,
        dispose: () => {
          anim.dispose();
          node.dispose();
          viewRoot.dispose();
          root.dispose();
        },
      };
      eye.position.set(0, PLAYER.eyeHeight, -3);
      poseCamera(eye, 0, 0);
      scene.activeCamera = eye;
      await settle(40);
    }
  }

  /**
   * After a third-person pose, the whole body from its right side, its front or its back (posture checks:
   * a hunched back or bent knees show side-on), or its feet side-on at floor level (`feet`: soles flat or tilted).
   */
  async function body(from: 'side' | 'front' | 'back' | 'feet'): Promise<void> {
    orbit.target.set(0, from === 'feet' ? 0.12 : PLAYER.height / 2, 0);
    orbit.alpha = from === 'side' || from === 'feet' ? 0 : from === 'front' ? Math.PI / 2 : -Math.PI / 2;
    orbit.beta = from === 'feet' ? Math.PI / 2 - 0.02 : Math.PI / 2 - 0.05;
    orbit.radius = from === 'feet' ? 1.3 : 3.4;
    await settle(4);
  }

  /**
   * After a third-person pose, the upper body (hips up) from the gun hand's side or the front, as Character
   * Select shows it (the audit's views: the side is where a gun at the face shows; the front foreshortens a gun
   * pointed at the camera).
   */
  async function upper(from: 'side' | 'front'): Promise<void> {
    const j = joints?.get('upperarm_r');
    j?.computeWorldMatrix(true);
    const side = Math.sign(j?.getAbsolutePosition().x ?? 1) || 1;
    orbit.target.set(0, PLAYER.height * 0.66, 0.12);
    orbit.alpha = from === 'side' ? (side > 0 ? 0 : Math.PI) : Math.PI / 2;
    orbit.beta = Math.PI / 2 - 0.08;
    orbit.radius = 2.3;
    await settle(4);
  }

  /**
   * After a third-person pose, the head (and its gear) from `alpha` round it (0: its right side, π/2: the front), at
   * `radius` m (`beta`: from above or below; held weapons tip the head down): about 0.95 frames the head as a portrait; at in-game distances (5-15 m) the camera keeps the game's
   * field of view and aims at the head, so a crop of the middle of the shot shows the head at the size players see it.
   */
  async function head(alpha: number, radius: number, beta = Math.PI / 2 - 0.08): Promise<void> {
    const j = joints?.get('Head');
    j?.computeWorldMatrix(true);
    const p = j ? j.getAbsolutePosition() : new Vector3(0, PLAYER.eyeHeight, 0);
    orbit.target.set(p.x, p.y + 0.06, p.z);
    orbit.alpha = alpha;
    orbit.beta = beta;
    orbit.radius = radius;
    orbit.fov = radius > 2 ? DEFAULT_FOV : 0.8;
    await settle(4);
  }

  const api = {
    looks: () => CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, parts: l.parts })),
    pose,
    head,
    /** First person: how far (model m) each palm is from its point on the gun (0: on it). */
    miss: () => current?.anim.gripMiss ?? null,
    /** The posed character's animator (tests: where its hands are drawn, gripCheck). */
    anim: () => current?.anim ?? null,
    /** Where the posed hands are drawn on the gun (model m from each hand's skin centre to its point; handProbe.ts). */
    drawn: () => current?.anim.drawnGrip([...(rig?.drawnMeshes ?? []), ...(current?.anim.ch.meshes ?? [])]) ?? null,
    body,
    upper,
    /**
     * After a third-person pose, a close look at one joint (a support hand on the handguard): the orbit camera on
     * that joint's position, `alpha`/`beta` round it (radians, Babylon's), `radius` away (m).
     */
    closeUp: async (joint: string, alpha: number, beta: number, radius = 0.35) => {
      const j = joints?.get(joint);
      j?.computeWorldMatrix(true);
      if (j) orbit.target.copyFrom(j.getAbsolutePosition());
      orbit.alpha = alpha;
      orbit.beta = beta;
      orbit.radius = radius;
      await settle(4);
    },
    /** Measurements of the third-person pose as drawn (tools/gripAudit.ts; tools/content/grip-audit.mjs ranks them). */
    audit: () => (posed ? auditGrip(posed.ch, posed.weapon, posed.hold) : null),
    /** Curl test: close the hands by this share of their curl (1 as the game does; 0 open), and redraw. */
    curl: async (share: number) => {
      setCurlShare(share);
      await settle(4);
    },
    /**
     * Full-body first person (`pose(look, weapon, 'body')`): the view's pitch (radians, the game's: + looks up), and the
     * body's motion (speed m/s, stance 0 standing / 1 crouched, airborne); `drop` lowers the eye (m, a crouch).
     */
    /** Full body: look at the posed body from outside (from its right side, `alpha` round), or back through its eyes (null). */
    outside: async (alpha: number | null) => {
      if (alpha === null) scene.activeCamera = eye;
      else {
        orbit.target.set(0, 1.2, 0);
        orbit.alpha = alpha;
        orbit.beta = 1.3;
        orbit.radius = 2.4;
        scene.activeCamera = orbit;
      }
      await settle(4);
    },
    look: async (pitch: number, motion: { speed?: number; stance?: number; airborne?: boolean; sprinting?: boolean; drop?: number } = {}) => {
      eyePitch = pitch;
      eyeDrop = motion.drop ?? 0;
      Object.assign(still, { speed: motion.speed ?? 0, stance: motion.stance ?? 0, airborne: !!motion.airborne, sprinting: !!motion.sprinting });
      await settle(30);
    },
    /**
     * Third person in motion (the legs step in place; the animator is fed 1/30 s a frame): the body's motion (speed,
     * moveAngle, stance, sprinting; `pitch` the aim) and `rate` shots a second fired meanwhile (0: none).
     */
    drive: async (motion: Partial<MotionState>, rate = 0, frames = 30) => {
      if (motion.pitch !== undefined) eyePitch = motion.pitch;
      const { pitch: _pitch, ...rest } = motion;
      Object.assign(still, { moveAngle: 0, speed: 0, ...rest });
      fireRate = rate;
      await settle(frames);
    },
    /**
     * Animation cost: `n` more characters of `look` (each holding `weapon`, in a grid behind the posed one) driven by
     * the same motion (`drive`), or none (n 0; n < 0 keeps the crowd there is). Returns, over `seconds`, the mean milliseconds a frame spends
     * evaluating clips and in the animators' after-clip work (aim, IK, grip), and the playing animatables.
     */
    crowd: async (look: string, n: number, weapon = 'core.rifle', seconds = 3) => {
      // n < 0: measure the crowd already there.
      if (n >= 0) for (const a of crowd.splice(0)) a.dispose();
      for (let i = 0; i < n; i++) {
        const ch = await characters.create({ look }, `crowd_${i}`);
        ch.root.position.set((i % 12) * 1.2 - 6.6, 0, 3 + Math.floor(i / 12) * 1.5);
        const a = new CharacterAnimator(scene, ch);
        a.hold(await models.instantiate(getWeapon(weapon).view.model, `crowd_w${i}`), getWeapon(weapon).view.hold);
        crowd.push(a);
      }
      await settle(20);
      let t0 = 0;
      let anim = 0;
      let after = 0;
      let count = 0;
      const b = scene.onBeforeAnimationsObservable.add(() => (t0 = performance.now()));
      // Added first among the after-animation observers' tail: clip evaluation ends here; the animators' own work follows.
      const m = scene.onAfterAnimationsObservable.add(() => {
        const t = performance.now();
        anim += t - t0;
        t0 = t;
      }, undefined, true);
      const e = scene.onAfterAnimationsObservable.add(() => {
        after += performance.now() - t0;
        count++;
      });
      const until = performance.now() + seconds * 1000;
      while (performance.now() < until) await settle(1);
      scene.onBeforeAnimationsObservable.remove(b);
      scene.onAfterAnimationsObservable.remove(m);
      scene.onAfterAnimationsObservable.remove(e);
      return { frames: count, animMs: anim / Math.max(1, count), afterMs: after / Math.max(1, count), animatables: scene.animatables.length };
    },
    /** World positions of the posed character's joints (third person), by name. */
    joints: (): Record<string, [number, number, number]> =>
      Object.fromEntries(
        [...(joints ?? new Map<string, TransformNode>())].map(([n, j]) => {
          j.computeWorldMatrix(true);
          const p = j.getAbsolutePosition();
          return [n, [p.x, p.y, p.z]];
        }),
      ),
  };
  Object.assign(window, { __grips: api });
}
