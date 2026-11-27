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
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { muzzlePoint } from '../game/muzzlePoint.ts';
import { CORE_LOOKS, PICKABLE_LOOKS, PLAYER, armsLookFor, getWeapon } from '@tiletrigger/shared';
import { CharacterLibrary } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { gripInside } from './gripInside.ts';
import { CharacterAnimator, PISTOL, setCurlShare, setPistolTune, type MotionState } from '../game/characterAnimator.ts';
import { CreatureAnimator } from '../game/creatureAnimator.ts';
import { CreatureLibrary, fitPlayerSkin } from '../content/creatures.ts';
import type { CreatureModel } from '@tiletrigger/shared';
import { createViewCamera, poseCamera } from '../game/cameraPose.ts';
import { fitFirstPersonArms } from '../game/firstPersonArms.ts';
import { FirstPersonBodyRig, fitFirstPersonBody } from '../game/firstPersonBody.ts';
import { DEFAULT_FOV } from '../game/view.ts';
import { firstPersonHold, isLongMelee, meleePlacement } from '../game/meleeView.ts';
import { auditGrip } from './gripAudit.ts';
import { setPalmRule, skinHandFrame } from '../game/handProbe.ts';
import type { CharacterInstance, HandData } from '../content/characters.ts';
import type { WeaponHold } from '@tiletrigger/shared';
import { limbSamples } from './limbProbe.ts';

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

  /** `__grips.creature`: a creature carrying a gun as a player or bot in its skin does (its own hold, CreatureSpec grip). */
  let creature: { anim: CreatureAnimator; dispose(): void } | null = null;
  let creatures: CreatureLibrary | null = null;

  engine.runRenderLoop(() => {
    current?.anim.update(1 / 30, { ...still, pitch: eyePitch });
    creature?.anim.update(1 / 30, { ...still, pitch: eyePitch });
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
  /** The gun the posed character holds (third person or full-body first person; `__grips.inside`). */
  let held: TransformNode | null = null;
  /** The posed gun's weapon (its muzzle: `__grips.muzzle`). */
  let heldWeapon: string | null = null;
  /** `__grips.markMuzzle`: a dot on the muzzle and a tracer's first half metre from it, drawn over everything. */
  let marker: { dot: Mesh; line: LinesMesh } | null = null;
  /**
   * `__grips.tune(look, { grip, hands })`: a look's GripTune and measured hands changed for the poses that follow (to
   * tune a look live before writing its manifest); `__grips.tune(look, null)` clears it.
   */
  const tunes = new Map<string, { grip?: Partial<NonNullable<CharacterInstance['grip']>>; hands?: { l?: Partial<HandData>; r?: Partial<HandData> } }>();
  const tuned = (look: string, ch: CharacterInstance) => {
    const t = tunes.get(look);
    if (!t) return;
    if (t.grip) ch.grip = { ...(ch.grip ?? {}), ...t.grip };
    for (const s of ['l', 'r'] as const) if (t.hands?.[s] && ch.hands[s]) ch.hands[s] = { ...ch.hands[s]!, ...t.hands[s] };
  };
  const settle = async (n: number) => {
    const until = frames + n;
    while (frames < until) await new Promise((r) => setTimeout(r, 10));
  };

  /**
   * First person (arms or full body): the posed viewmodel's root and weapon, and its model's front end (a long melee
   * weapon is placed by its grip: game/meleeView.ts, as the game places it; `__grips.fpSwing` / `fpDraw` move it).
   */
  let fpView: { root: TransformNode; weapon: string; tipZ: number; rearZ: number } | null = null;
  let fpSwingAt: number | null = null;
  let fpRaise = 0;
  const placeView = (root: TransformNode, weapon: string, tipZ: number, rearZ: number) => {
    const def = getWeapon(weapon);
    fpView = { root, weapon, tipZ, rearZ };
    if (!isLongMelee(def)) {
      const [vx, vy, vz] = def.view.viewOffset;
      root.position.set(vx, vy, vz);
      return def.view.hold;
    }
    const p = meleePlacement(def, { tipZ, swing: fpSwingAt, raise: fpRaise });
    root.position.set(p.x, p.y, p.z);
    root.rotation.set(p.pitch, p.yaw, p.roll);
    return firstPersonHold(def, tipZ, rearZ);
  };

  /** Re-place the first-person view after a swing or draw change (`fpSwing`, `fpDraw`). */
  const replace = async () => {
    if (fpView) placeView(fpView.root, fpView.weapon, fpView.tipZ, fpView.rearZ);
    await settle(4);
  };

  /** Show `look` holding `weapon` from `view`; resolves once the pose has settled and is on screen. */
  async function pose(look: string, weapon: string, view: GripView): Promise<void> {
    held = null;
    fpView = null;
    heldWeapon = weapon;
    marker?.dot.dispose();
    marker?.line.dispose();
    marker = null;
    creature?.dispose();
    creature = null;
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
      tuned(look, ch);
      fitFirstPersonBody(ch, holder);
      const viewRoot = new TransformNode('grip_view', scene);
      viewRoot.parent = eye;
      const node = await models.instantiate(def.view.model, 'grip_viewmodel');
      const bounds = node.getHierarchyBoundingVectors(true);
      const hold = placeView(viewRoot, weapon, bounds.max.z, bounds.min.z);
      node.parent = viewRoot;
      held = node;
      for (const m of node.getChildMeshes()) m.renderingGroupId = 1;
      const anim = new CharacterAnimator(scene, ch);
      anim.gripExternal(node, hold);
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
      tuned(look, ch);
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      ch.root.scaling.scaleInPlace((PLAYER.height * ch.root.scaling.y) / Math.max(0.5, max.y - min.y));
      const anim = new CharacterAnimator(scene, ch);
      const node = await models.instantiate(def.view.model, 'grip_weapon');
      anim.hold(node, def.view.hold);
      held = node;
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
      const bounds = node.getHierarchyBoundingVectors(true);
      const hold = placeView(viewRoot, weapon, bounds.max.z, bounds.min.z);
      node.parent = viewRoot;
      const anim = new CharacterAnimator(scene, ch);
      anim.gripExternal(node, hold);
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
  async function upper(from: 'side' | 'front' | 'support'): Promise<void> {
    const j = joints?.get('upperarm_r');
    j?.computeWorldMatrix(true);
    const side = Math.sign(j?.getAbsolutePosition().x ?? 1) || 1;
    orbit.target.set(0, PLAYER.height * 0.66, 0.12);
    // (`support`: from the other side, where a long gun's support hand on its handguard shows.)
    orbit.alpha = from === 'side' ? (side > 0 ? 0 : Math.PI) : from === 'support' ? (side > 0 ? Math.PI : 0) : Math.PI / 2;
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

  /** A creature (`imp`, `puglin`, ...) holding `weapon` at a player's height, framed on its hands, as `pose(..., 'third')`. */
  async function poseCreature(kind: CreatureModel, weapon: string): Promise<void> {
    creature?.dispose();
    creature = null;
    current?.dispose();
    current = null;
    posed = null;
    rig = null;
    ground.setEnabled(true);
    creatures ??= new CreatureLibrary(scene);
    const ch = await creatures.create(kind, 'grip_creature');
    fitPlayerSkin(ch, PLAYER.height);
    const anim = new CreatureAnimator(scene, ch, true);
    const def = getWeapon(weapon);
    const node = await models.instantiate(def.view.model, 'grip_weapon');
    anim.hold(node, def.view.hold);
    creature = { anim, dispose: () => (anim.dispose(), ch.dispose(), node.dispose()) };
    joints = ch.joints;
    scene.activeCamera = orbit;
    await settle(40);
    const at = (n: string) => {
      const j = ch.joints.get(n);
      j?.computeWorldMatrix(true);
      return j ? j.getAbsolutePosition().clone() : new Vector3(0, 1.2, 0.3);
    };
    const side = Math.sign(at('upperarm_r').x) || 1;
    orbit.target.copyFrom(at('hand_r').add(at('hand_l')).scale(0.5));
    orbit.alpha = Math.PI / 2 - side * 0.75;
    orbit.beta = 1.25;
    orbit.radius = 0.95;
    await settle(4);
  }

  const api = {
    creature: poseCreature,
    /** The posed creature's animator (`__grips.creature`). */
    creatureAnim: () => creature?.anim ?? null,
    looks: () => CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, parts: l.parts, pickable: PICKABLE_LOOKS.includes(l) })),
    pose,
    head,
    /** First person: how far (model m) each palm is from its point on the gun (0: on it). */
    miss: () => current?.anim.gripMiss ?? null,
    /** The posed character's animator (tests: where its hands are drawn, gripCheck). */
    anim: () => current?.anim ?? null,
    /** Where the posed hands are drawn on the gun (model m from each hand's skin centre to its point; handProbe.ts). */
    /** Third person, a long gun: where the support hand went on the handguard (characterAnimator `supportHold`). */
    support: () => current?.anim.supportHold ?? null,
    /** The posed weapon's hold (its points on the gun, model m). */
    hold: () => posed?.hold ?? null,
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
    /** How far the held gun goes into each hand as drawn (tools/gripInside.ts), third person or full-body first person. */
    tune: (look: string, t: Parameters<typeof tunes.set>[1] | null) => (t ? tunes.set(look, t) : tunes.delete(look), undefined),
    /**
     * The posed character's GripTune replaced as it stands (third person; null: none), redrawn, and where its hands are
     * then drawn (`drawn`): the grip fit (tools/content/grip-fit.mjs) tries offsets on one pose without reloading it.
     */
    retune: async (grip: CharacterInstance['grip'] | null, frames = 6) => {
      if (!current) return null;
      current.anim.ch.grip = grip ?? undefined;
      await settle(frames);
      return api.drawn();
    },
    /** Where the posed gun's tracers and flash start (world): its muzzle as drawn (game/muzzlePoint.ts). */
    muzzle: () => {
      if (!held || !heldWeapon) return null;
      const def = getWeapon(heldWeapon);
      held.computeWorldMatrix(true);
      const p = Vector3.TransformCoordinates(muzzlePoint(held, def.view.muzzleAt, def.view.model), held.getWorldMatrix());
      return [p.x, p.y, p.z];
    },
    /** Mark the posed gun's muzzle: a dot there and the first half metre of a tracer down the barrel (pictures). */
    markMuzzle: async () => {
      if (!held || !heldWeapon) return null;
      const def = getWeapon(heldWeapon);
      held.computeWorldMatrix(true);
      const wm = held.getWorldMatrix();
      const at = Vector3.TransformCoordinates(muzzlePoint(held, def.view.muzzleAt, def.view.model), wm);
      const fwd = Vector3.TransformNormal(new Vector3(0, 0, 1), wm).normalize();
      marker?.dot.dispose();
      marker?.line.dispose();
      const dot = CreateSphere('grip_muzzleDot', { diameter: 0.025, segments: 8 }, scene);
      const mat = new StandardMaterial('grip_muzzleDotMat', scene);
      mat.emissiveColor = new Color3(1, 0.15, 0.9);
      mat.disableLighting = true;
      dot.material = mat;
      dot.position.copyFrom(at);
      dot.renderingGroupId = 2;
      const line = CreateLines('grip_tracer', { points: [at, at.add(fwd.scale(0.5))] }, scene);
      line.color = new Color3(1, 0.85, 0.2);
      line.renderingGroupId = 2;
      marker = { dot, line };
      await settle(2);
      return [at.x, at.y, at.z];
    },
    /**
     * First person, a long melee weapon (game/meleeView.ts): hold it `u` (0..1) of the way through its swing (null:
     * at rest), or `raise` of its draw still to go (1: just switched to), as the game places it; redrawn.
     */
    fpSwing: async (u: number | null) => {
      fpSwingAt = u;
      await replace();
    },
    fpDraw: async (raise: number) => {
      fpRaise = raise;
      await replace();
    },
    /**
     * First person: where each hand joint is on screen (normalised device coordinates: -1..1 across and up, inside the
     * view when both are within) and how far ahead of the eye (m); the e2e checks that both hands show.
     */
    handsOnScreen: () => {
      const arms = (current?.anim as unknown as { arms?: { r: { hand: TransformNode }; l: { hand: TransformNode } } } | undefined)?.arms;
      const cam = scene.activeCamera;
      if (!arms || !cam || cam !== eye) return null;
      const m = cam.getViewMatrix().multiply(cam.getProjectionMatrix());
      const v = cam.getViewMatrix();
      const at = (n: TransformNode) => {
        n.computeWorldMatrix(true);
        const p = n.getAbsolutePosition();
        const s = Vector3.TransformCoordinates(p, m);
        return { x: s.x, y: s.y, ahead: Vector3.TransformCoordinates(p, v).z };
      };
      return { r: at(arms.r.hand), l: at(arms.l.hand) };
    },
    /** The posed character's measured hands (length, width, thickness in model m; null: the rig's own). */
    hands: () => {
      const h = current?.anim.ch.hands;
      const pick = (x: HandData | undefined) => (x ? { length: x.length, width: x.width, thickness: x.thickness, curl: x.curl, fingers: x.fingers } : null);
      return h ? { r: pick(h.r), l: pick(h.l) } : null;
    },
    inside: () => (held && current ? gripInside([...(rig?.drawnMeshes ?? []), ...current.anim.ch.meshes], held) : null),
    /** Measurements of the third-person pose as drawn (tools/gripAudit.ts; tools/content/grip-audit.mjs ranks them). */
    audit: () => (posed ? auditGrip(posed.ch, posed.weapon, posed.hold) : null),
    /** Curl test: close the hands by this share of their curl (1 as the game does; 0 open), and redraw. */
    curl: async (share: number) => {
      setCurlShare(share);
      await settle(4);
    },
    /** The first-person pistol hold, changed live (characterAnimator PISTOL; to tune it), and redrawn. Returns it. */
    pistol: async (tune: Partial<typeof PISTOL> = {}) => {
      const now = { ...setPistolTune(tune) };
      await settle(4);
      return now;
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
    /**
     * Which way the posed character's palms were read (handProbe.skinHandFrame): per hand, the cue that decided and
     * each cue's vote (+ agrees), and `rig`: the rig's own reading in the pose as drawn (the thumb's side of the
     * knuckles; + agrees). Null for a hand without a frame of its own.
     */
    palms: () => {
      const ch = current?.anim.ch;
      if (!ch) return null;
      const out: Record<string, unknown> = {};
      for (const side of ['l', 'r'] as const) {
        const f = skinHandFrame(ch.meshes, (n) => ch.joints.get(n), side, ch.hands[side]?.palmSide);
        const j = (n: string) => ch.joints.get(`${n}_${side}`);
        const [hand, knuckle, index, pinky, thumb] = [j('hand'), j('middle_01'), j('index_01'), j('pinky_01'), j('thumb_02')];
        let rig: number | null = null;
        if (f && hand && knuckle && index && pinky && thumb) {
          for (const n of [hand, knuckle, index, pinky, thumb]) n.computeWorldMatrix(true);
          const wrist = hand.getAbsolutePosition();
          const fwd = knuckle.getAbsolutePosition().subtract(wrist).normalize();
          const across = index.getAbsolutePosition().subtract(pinky.getAbsolutePosition()).normalize();
          const t = thumb.getAbsolutePosition().subtract(wrist);
          const side_ = t.subtract(fwd.scale(Vector3.Dot(t, fwd))).subtract(across.scale(Vector3.Dot(t, across)));
          const palm = Vector3.TransformNormal(f.palm, hand.getWorldMatrix()).normalize();
          rig = Math.round(Vector3.Dot(side_.normalize(), palm) * 100) / 100;
        }
        const own = (current?.anim as unknown as { arms: { [k: string]: { frame?: { palm: Vector3 } } } | null }).arms?.[side]?.frame;
        out[side] = f ? { by: f.by, votes: f.votes, rig, fingers: ch.hands[side]?.fingers ?? 'rig', used: own ? Math.round(Vector3.Dot(own.palm, f.palm) * 100) / 100 : null } : null;
      }
      return out;
    },
    /** Before/after: hands built from now on read their palms by `rule` (`joints`, the default, or `old`). */
    palmRule: (rule: 'joints' | 'old') => setPalmRule(rule),
    /** The posed character's limbs, joints and skin (third person; tools/content/limb-audit.mjs). */
    limbs: () => (posed ? limbSamples(posed.ch) : null),
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
