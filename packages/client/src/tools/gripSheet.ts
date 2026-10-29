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
import { CharacterAnimator, type MotionState } from '../game/characterAnimator.ts';
import { createViewCamera, poseCamera } from '../game/cameraPose.ts';
import { fitFirstPersonArms } from '../game/firstPersonArms.ts';
import { DEFAULT_FOV } from '../game/view.ts';

/** How a pose is shown: the character from outside, or its own first-person arms from the eye. */
export type GripView = 'third' | 'first';

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
  let current: { anim: CharacterAnimator; dispose(): void } | null = null;
  let frames = 0;

  engine.runRenderLoop(() => {
    current?.anim.update(1 / 30, still);
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
    const def = getWeapon(weapon);
    if (view === 'third') {
      ground.setEnabled(true);
      const ch = await characters.create({ look }, 'grip_char');
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      ch.root.scaling.scaleInPlace((PLAYER.height * ch.root.scaling.y) / Math.max(0.5, max.y - min.y));
      const anim = new CharacterAnimator(scene, ch);
      const node = await models.instantiate(def.view.model, 'grip_weapon');
      anim.hold(node, def.view.hold);
      current = { anim, dispose: () => anim.dispose() };
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

  const api = {
    looks: () => CORE_LOOKS.map((l) => ({ id: l.id, name: l.name, parts: l.parts })),
    pose,
  };
  Object.assign(window, { __grips: api });
}
