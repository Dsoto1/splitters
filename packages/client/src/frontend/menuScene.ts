import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PLAYER, getWeapon } from '@chronosplit/shared';
import { CharacterLibrary } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, type MotionState } from '../game/characterAnimator.ts';

/**
 * The live backdrop behind the main menu: your own character, rifle in hand,
 * on a lit plinth against a deep-space haze, with the camera drifting slowly.
 * Everything is our own geometry and lighting; no painted art.
 */
export class MenuScene {
  readonly scene: Scene;
  readonly characters: CharacterLibrary;
  private readonly models: ModelLibrary;
  private readonly camera: FreeCamera;
  private anim: CharacterAnimator | null = null;
  private look = '';
  private token = 0;
  private t = 0;
  /** Camera framing: hero right of centre (home) or far right, full length (screens with a big left panel). */
  private framing = { x: 0.2, tx: 0.55, y: 1.3, ty: 1.02, z: 3.3 };
  private goal = { ...this.framing };
  private readonly state: MotionState = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0.08, celebrate: false };

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.043, 0.059, 0.102, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.035;
    this.scene.fogColor = new Color3(0.07, 0.1, 0.17);
    this.camera = new FreeCamera('menuCam', new Vector3(-1.2, 1.35, 4.2), this.scene);
    this.camera.minZ = 0.05;
    this.camera.fov = 0.72;
    this.camera.inputs.clear();

    const hemi = new HemisphericLight('menuHemi', new Vector3(0, 1, 0.3), this.scene);
    hemi.intensity = 0.75;
    hemi.diffuse = new Color3(0.55, 0.65, 0.9);
    hemi.groundColor = new Color3(0.08, 0.1, 0.16);
    const key = new DirectionalLight('menuKey', new Vector3(-0.6, -0.7, -0.9), this.scene);
    key.intensity = 2.6;
    // Soft fill from the camera side (PBR characters have no environment map to light them).
    const fill = new DirectionalLight('menuFill', new Vector3(0.4, -0.2, -1), this.scene);
    fill.intensity = 0.9;
    fill.diffuse = new Color3(0.7, 0.8, 1);
    fill.specular = Color3.Black();
    key.diffuse = new Color3(1, 0.86, 0.7);
    // Cyan and orange rims, after the board's accent colours.
    const rimL = new PointLight('menuRimCyan', new Vector3(-1.6, 2.1, -1.2), this.scene);
    rimL.diffuse = Color3.FromHexString('#00d1ff');
    rimL.specular = Color3.Black();
    rimL.intensity = 2.2;
    rimL.range = 4;
    const rimR = new PointLight('menuRimOrange', new Vector3(1.8, 1.7, -1.1), this.scene);
    rimR.diffuse = Color3.FromHexString('#ffb347');
    rimR.specular = Color3.Black();
    rimR.intensity = 1.6;
    rimR.range = 4;

    const plinth = CreateDisc('menuPlinth', { radius: 1.25, tessellation: 64 }, this.scene);
    plinth.rotation.x = Math.PI / 2;
    plinth.position.y = 0.005;
    const pm = new StandardMaterial('menuPlinthMat', this.scene);
    pm.diffuseColor = Color3.FromHexString('#1e2838');
    pm.emissiveColor = Color3.FromHexString('#00d1ff').scale(0.08);
    pm.specularColor = Color3.Black();
    plinth.material = pm;
    const ground = CreateDisc('menuGround', { radius: 40, tessellation: 48 }, this.scene);
    ground.rotation.x = Math.PI / 2;
    const gm = new StandardMaterial('menuGroundMat', this.scene);
    gm.diffuseColor = Color3.FromHexString('#121827');
    gm.specularColor = Color3.Black();
    ground.material = gm;
    // A few dark monoliths in the haze give depth behind the hero.
    const mono = new StandardMaterial('menuMonoMat', this.scene);
    mono.diffuseColor = Color3.FromHexString('#141b2b');
    mono.specularColor = Color3.Black();
    mono.emissiveColor = Color3.FromHexString('#4f6bff').scale(0.04);
    mono.disableLighting = true;
    // Light strips on the monoliths, in the board's cyan and orange.
    const strip = (hex: string) => {
      const m = new StandardMaterial(`menuStrip${hex}`, this.scene);
      m.emissiveColor = Color3.FromHexString(hex);
      m.disableLighting = true;
      return m;
    };
    const cyan = strip('#00d1ff');
    const orange = strip('#ffb347');
    [[-6, -9, 3, 7], [-1.5, -13, 4, 11], [4.5, -8, 2.4, 6], [9, -14, 5, 9], [-11, -12, 4, 8]].forEach(([x, z, w, hgt], i) => {
      const b = CreateBox('menuMono', { width: w!, height: hgt!, depth: w! }, this.scene);
      b.position.set(x!, hgt! / 2, z!);
      b.material = mono;
      const s = CreateBox('menuStrip', { width: w! * 0.9, height: 0.06, depth: 0.02 }, this.scene);
      s.position.set(x!, hgt! * (0.35 + (i % 3) * 0.15), z! + w! / 2 + 0.02);
      s.material = i % 2 ? orange : cyan;
      const v = CreateBox('menuStripV', { width: 0.05, height: hgt! * 0.7, depth: 0.02 }, this.scene);
      v.position.set(x! - w! * 0.38, hgt! * 0.5, z! + w! / 2 + 0.02);
      v.material = cyan;
    });
    this.characters = new CharacterLibrary(this.scene);
    this.models = new ModelLibrary(this.scene);
  }

  /** Show a look as the hero (rebuilt when it changes). */
  setLook(look: string): void {
    if (look === this.look) return;
    this.look = look;
    const token = ++this.token;
    void this.characters.create({ look }, `menuHero_${token}`).then(async (ch) => {
      if (token !== this.token) return ch.dispose();
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      ch.root.scaling.scaleInPlace(PLAYER.height / Math.max(0.5, max.y - min.y));
      ch.root.rotation.y = 0.45;
      this.anim?.dispose();
      this.anim = new CharacterAnimator(this.scene, ch);
      const w = getWeapon('core.rifle');
      const node = await this.models.instantiate(w.view.model, `menuHeroRifle_${token}`);
      if (token === this.token) this.anim.hold(node, w.view.hold);
      else node.dispose();
    });
  }

  /** Where the hero stands on screen: beside the home menu, or pushed right of a wide panel. */
  setShot(shot: 'home' | 'side'): void {
    // Looking down -Z, screen right is world -X: a positive target x puts the hero right of centre.
    this.goal = shot === 'home' ? { x: 0.2, tx: 0.55, y: 1.3, ty: 1.02, z: 3.3 } : { x: 1.5, tx: 1.85, y: 1.15, ty: 0.95, z: 4.4 };
  }

  frame(dt: number): void {
    this.t += dt;
    const f = this.framing;
    const k = 1 - Math.exp(-dt * 4);
    for (const key of ['x', 'tx', 'y', 'ty', 'z'] as const) f[key] += (this.goal[key] - f[key]) * k;
    // Slow drift around the current framing.
    const sway = Math.sin(this.t * 0.25);
    this.camera.position.set(f.x + sway * 0.15, f.y + Math.sin(this.t * 0.17) * 0.04, f.z);
    this.camera.setTarget(new Vector3(f.tx + sway * 0.08, f.ty, 0));
    this.state.pitch = 0.06 + Math.sin(this.t * 0.6) * 0.03;
    this.anim?.update(dt, this.state);
    this.scene.render();
  }

  dispose(): void {
    this.anim?.dispose();
    this.scene.dispose();
  }
}
