import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PLAYER, getWeapon, isCreature, lookStats, npcLookRole } from '@tiletrigger/shared';
import { CreatureLibrary, fitPlayerSkin } from '../content/creatures.ts';
import { CreatureAnimator } from '../game/creatureAnimator.ts';
import { CharacterLibrary } from '../content/characters.ts';
import { applyToneMapping } from '../game/graphicsSettings.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, type MotionState } from '../game/characterAnimator.ts';
import { testMode } from '../testMode.ts';

/** Browser tests (?test=1) compare screenshots: the drift and the hero's idle stop this far in, whatever the machine's speed. */
const STILL_AT = testMode() ? 0.5 : Infinity;
/** The hero stands turned this far (radians) towards the camera's side, before any turning by the viewer. */
const HERO_YAW = 0.45;
/**
 * Character Select (the 'side' shot) turns the hero further, three-quarter on: that camera stands almost where
 * the rifle points, and a hold seen down the barrel reads as a gun at the face with the arms crossed under it
 * (every character, the rig's own Farmhand too). Turned, the gun runs across the screen and the grip shows.
 */
const HERO_YAW_SELECT = 0.85;
/** A pick still loading this long (ms) shows the loading bar: never for a character already here. */
const BAR_AFTER = 150;
/** The bar's share for the download; building the body fills the rest, slowly, never going back. */
const BAR_DOWNLOAD = 0.85;

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
  private anim: CharacterAnimator | CreatureAnimator | null = null;
  private creatures: CreatureLibrary | null = null;
  private look = '';
  private token = 0;
  private t = 0;
  /** Seconds the current hero has been animated (for STILL_AT). */
  private heroT = 0;
  /** Camera framing: hero right of centre (home) or far right, full length (screens with a big left panel). */
  private framing = { x: 0.2, tx: 0.55, y: 1.3, ty: 1.02, z: 3.3 };
  private goal = { ...this.framing };
  private readonly state: MotionState = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0.08, celebrate: false };
  /** The hero's root, turned by `spin` (Character Select: drag to see the whole look). */
  private heroRoot: TransformNode | null = null;
  /** How far the viewer has turned the hero (radians) and how fast it is still turning after a flick (radians/s). */
  private yaw = 0;
  private yawSpeed = 0;
  /** The shot's own turn (HERO_YAW or HERO_YAW_SELECT), eased toward `baseGoal` with the camera. */
  private baseYaw = HERO_YAW;
  private baseGoal = HERO_YAW;
  /** The Armory (armory.ts) shows a weapon on the plinth: the heroes (the one shown and any fading out) are hidden meanwhile. */
  hideHero = false;
  private readonly stage: TransformNode;

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.043, 0.059, 0.102, 1);
    applyToneMapping(this.scene);
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
    this.stage = new TransformNode('menuStage', this.scene);
    this.characters = new CharacterLibrary(this.scene);
    // One download per file, shared by Character Select's prefetch and its picks (and the loading bar's progress).
    // Its own small chunk, after the menu's first: the menu's own hero loads by URL as before.
    void import('../content/fileFetcher.ts').then(({ FileFetcher }) => {
      if (!this.scene.isDisposed) this.characters.fetcher ??= new FileFetcher({ max: 2 });
    });
    this.models = new ModelLibrary(this.scene);
  }

  /**
   * Character Select: fetch a hovered or focused look's files (`soon`) and its neighbours' (`later`, after it), and
   * drop prefetches no longer wanted. Only the files: they're built into the scene when picked.
   */
  prefetch(look: string, neighbours: readonly string[] = []): void {
    const fetcher = this.characters.fetcher;
    if (!fetcher) return;
    const soon = this.filesOf(look);
    const later = neighbours.flatMap((l) => this.filesOf(l)).filter((u) => !soon.includes(u));
    fetcher.want(soon, 'soon', [...later, ...(this.loading?.files ?? [])]);
    for (const u of later) fetcher.get(u, 'later').catch(() => undefined);
  }

  private filesOf(look: string): string[] {
    const role = npcLookRole(look);
    if (role && isCreature(role)) return [];
    try {
      return this.characters.filesFor(look);
    } catch {
      return [];
    }
  }

  /** The loading bar (Character Select's), placed under the hero's feet and filled while a pick loads; null: none. */
  private bar: { el: HTMLElement; fill: HTMLElement } | null = null;
  /** The pick being loaded: since when, its files, how far the bar has filled, and when the body began to show. */
  private loading: { token: number; since: number; files: string[]; fill: number; opacity: number; builtFor: number; doneAt: number | null } | null = null;

  setLoadBar(el: HTMLElement | null): void {
    this.bar = el ? { el, fill: (el.firstElementChild as HTMLElement | null) ?? el } : null;
    if (el) el.style.opacity = '0';
  }

  /** Settles when the hero being shown (or the latest one asked for) is standing there with its gun, or failed to load. */
  private hero: Promise<unknown> = Promise.resolve();

  /** The hero and everything the scene draws are ready: the menu's 3D can fade in without popping. */
  async ready(): Promise<void> {
    let hero: Promise<unknown>;
    do {
      hero = this.hero;
      await hero.catch(() => undefined);
    } while (hero !== this.hero);
    if (!this.scene.isDisposed) await this.scene.whenReadyAsync();
  }

  /** Show a look as the hero (rebuilt when it changes). */
  setLook(look: string): void {
    if (look === this.look) return;
    this.look = look;
    const token = ++this.token;
    this.loading = { token, since: performance.now(), files: this.filesOf(look), fill: 0, opacity: 0, builtFor: 0, doneAt: null };
    const role = npcLookRole(look);
    if (role && isCreature(role)) {
      this.creatures ??= new CreatureLibrary(this.scene);
      this.hero = this.creatures.create(role, `menuHero_${token}`).then((ch) => {
        if (token !== this.token) return ch.dispose();
        // As the game draws a player in this skin: about a player's height.
        fitPlayerSkin(ch, PLAYER.height);
        ch.root.rotation.y = this.baseYaw + this.yaw;
        this.heroRoot = ch.root;
        ch.root.parent = this.stage;
        this.hide(ch.meshes);
        this.retire();
        const anim = new CreatureAnimator(this.scene, ch, true);
        this.anim = anim;
        this.heroT = 0;
        // Players in creature skins carry guns, like everyone else.
        const w = getWeapon('core.rifle');
        return this.models.instantiate(w.view.model, `menuHeroRifle_${token}`).then(
          (node) => (token === this.token ? (anim.hold(node, w.view.hold), this.appear([...ch.meshes, ...node.getChildMeshes()])) : node.dispose()),
          () => this.appear(ch.meshes),
        );
      });
      this.settle(token);
      return;
    }
    this.hero = this.characters.create({ look }, `menuHero_${token}`).then(async (ch) => {
      if (token !== this.token) return ch.dispose();
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      // At the look's body size, as a match draws it (small 0.78, large 1.18): Character Select showed every body at
      // the standard height, so a small goblin stood as tall as a large one (owner, 2026-11-03).
      ch.root.scaling.scaleInPlace((PLAYER.height * lookStats(look).size) / Math.max(0.5, max.y - min.y));
      ch.root.rotation.y = this.baseYaw + this.yaw;
      this.heroRoot = ch.root;
      ch.root.parent = this.stage;
      this.hide(ch.meshes);
      this.retire();
      const anim = new CharacterAnimator(this.scene, ch);
      this.anim = anim;
      this.heroT = 0;
      const w = getWeapon('core.rifle');
      const node = await this.models.instantiate(w.view.model, `menuHeroRifle_${token}`).catch(() => null);
      if (token !== this.token) return node?.dispose();
      if (node) anim.hold(node, w.view.hold);
      return this.appear([...ch.meshes, ...(node?.getChildMeshes() ?? [])]);
    });
    this.settle(token);
  }

  /** A pick that failed to load ends its loading bar too. */
  private settle(token: number): void {
    this.hero.catch(() => {
      if (this.loading?.token === token) this.loading.doneAt = performance.now();
    });
  }

  /** Heroes on their way out: the one shown stays until its successor fades in (never an empty plinth while it loads its gun). */
  private leaving: (CharacterAnimator | CreatureAnimator)[] = [];

  private retire(): void {
    if (this.anim) this.leaving.push(this.anim);
    this.anim = null;
  }

  /** Meshes fading in, and how far along (0..1). */
  private fading: { meshes: AbstractMesh[]; t: number } | null = null;

  /** A new hero stays out of sight while it loads its gun: never a bind-pose T for a frame, never a gun popping into empty hands. */
  private hide(meshes: AbstractMesh[]): void {
    for (const m of meshes) m.visibility = 0;
  }

  /**
   * Fade a hero in once its shaders are built and its clips have posed it (two animation ticks from then). A new
   * body's shaders compiled on the first frame it was drawn: a frame of most of a second on a slow machine, the old
   * body gone and the new one not yet there. Built while it is hidden, the one shown stays meanwhile.
   */
  private async appear(meshes: AbstractMesh[]): Promise<void> {
    const token = this.token;
    await this.compile(meshes);
    if (token !== this.token || this.scene.isDisposed) return;
    let ticks = 0;
    const obs = this.scene.onAfterAnimationsObservable.add(() => {
      if (++ticks < 2) return;
      this.scene.onAfterAnimationsObservable.remove(obs);
      this.fading = { meshes, t: 0 };
      for (const m of meshes) m.visibility = 0.001;
      for (const a of this.leaving.splice(0)) a.dispose();
      if (this.loading?.token === token) this.loading.doneAt = performance.now();
    });
  }

  /**
   * Build a hidden body's shaders for the fade (see-through) and for after it (solid): each mesh asked whether it is
   * ready to draw both ways, a frame apart, until it is (at most about two seconds; it fades in regardless then).
   */
  private async compile(meshes: AbstractMesh[]): Promise<void> {
    const ready = () =>
      meshes.every((m) => {
        if (m.isDisposed()) return true;
        const was = m.visibility;
        m.visibility = 0.5;
        const fading = m.isReady(true);
        m.visibility = 1;
        const solid = m.isReady(true);
        m.visibility = was;
        return fading && solid;
      });
    for (let i = 0; i < 120 && !this.scene.isDisposed && !ready(); i++) await new Promise((r) => this.scene.onAfterRenderObservable.addOnce(r));
  }

  /**
   * Turn the hero by `radians` (a drag or a turn button). `flick` is the speed (radians/s) it keeps turning at
   * afterwards, slowing to a stop.
   */
  spin(radians: number, flick = 0): void {
    this.yaw += radians;
    this.yawSpeed = flick;
  }

  /** Face the hero the usual way again (leaving Character Select; the camera moves then, so no easing back). */
  resetSpin(): void {
    this.yaw = 0;
    this.yawSpeed = 0;
    if (this.heroRoot && !this.heroRoot.isDisposed()) this.heroRoot.rotation.y = this.baseYaw;
  }

  /** Where the hero stands on screen: beside the home menu, or pushed right of a wide panel. */
  setShot(shot: 'home' | 'side' | 'armory'): void {
    // Looking down -Z, screen right is world -X: a positive target x puts the hero right of centre (the Armory: closer, at a weapon's height).
    this.goal = shot === 'home' ? { x: 0.2, tx: 0.55, y: 1.3, ty: 1.02, z: 3.3 } : shot === 'side' ? { x: 1.5, tx: 1.85, y: 1.15, ty: 0.95, z: 4.4 } : { x: 0.7, tx: 0.95, y: 1.3, ty: 1.12, z: 2.4 };
    this.baseGoal = shot === 'home' ? HERO_YAW : HERO_YAW_SELECT;
  }

  frame(dt: number): void {
    this.t += Math.max(0, Math.min(dt, STILL_AT - this.t));
    const f = this.framing;
    const k = 1 - Math.exp(-dt * 4);
    for (const key of ['x', 'tx', 'y', 'ty', 'z'] as const) f[key] += (this.goal[key] - f[key]) * k;
    this.baseYaw += (this.baseGoal - this.baseYaw) * k;
    // Slow drift around the current framing.
    const sway = Math.sin(this.t * 0.25);
    this.camera.position.set(f.x + sway * 0.15, f.y + Math.sin(this.t * 0.17) * 0.04, f.z);
    this.camera.setTarget(new Vector3(f.tx + sway * 0.08, f.ty, 0));
    this.state.pitch = 0.06 + Math.sin(this.t * 0.6) * 0.03;
    if (this.yawSpeed !== 0) {
      this.yaw += this.yawSpeed * dt;
      this.yawSpeed *= Math.exp(-dt * 3);
      if (Math.abs(this.yawSpeed) < 0.05) this.yawSpeed = 0;
    }
    if (this.heroRoot && !this.heroRoot.isDisposed()) this.heroRoot.rotation.y = this.baseYaw + this.yaw;
    this.stage.setEnabled(!this.hideHero);
    if (this.anim) {
      const step = Math.max(0, Math.min(dt, STILL_AT - this.heroT));
      this.heroT += step;
      if (step > 0) this.anim.update(step, this.state);
    }
    this.drawBar(dt);
    if (this.fading) {
      const f = this.fading;
      f.t = Math.min(1, f.t + dt / 0.3);
      for (const m of f.meshes) if (!m.isDisposed()) m.visibility = f.t;
      if (f.t >= 1) this.fading = null;
    }
    this.scene.render();
  }

  /**
   * The loading bar: hidden until a pick has loaded for BAR_AFTER ms, then a thin steady bar filling with the bytes
   * in (the rest of the way, slowly, while the body is built: it never goes back), fading out as the body fades in.
   * No pulse and no blink (Reduce flashing): its fill and its opacity only ever ease.
   */
  private drawBar(dt: number): void {
    const bar = this.bar;
    const l = this.loading;
    if (!bar) return;
    if (!l) {
      bar.el.style.opacity = '0';
      return;
    }
    const now = performance.now();
    // Came quickly (a character already here): never shown.
    if (l.doneAt !== null && l.opacity === 0) {
      this.loading = null;
      bar.el.style.opacity = '0';
      return;
    }
    if (l.doneAt === null && now - l.since < BAR_AFTER) return;
    const { loaded, total } = this.characters.fetcher?.progress(l.files) ?? { loaded: 0, total: 0 };
    const down = total > 0 ? loaded / total : 1;
    // Building, once the bytes are in: a slow approach to the end that the body's arrival completes.
    l.builtFor = down >= 1 ? l.builtFor + dt : 0;
    const goal = l.doneAt !== null ? 1 : Math.min(0.97, down * BAR_DOWNLOAD + (1 - Math.exp(-l.builtFor / 0.8)) * (1 - BAR_DOWNLOAD));
    l.fill = Math.max(l.fill, l.fill + (goal - l.fill) * (1 - Math.exp(-dt * 10)));
    bar.fill.style.transform = `scaleX(${l.fill.toFixed(3)})`;
    // In over 0.2 s; out over 0.3 s as the body fades in.
    l.opacity = l.doneAt === null ? Math.min(1, l.opacity + dt / 0.2) : Math.max(0, l.opacity - dt / 0.3);
    bar.el.style.opacity = l.opacity.toFixed(3);
    if (l.doneAt !== null && l.opacity <= 0) this.loading = null;
    // Just under the hero's feet, wherever the camera has drifted, and above the screen's turn buttons.
    const canvas = this.scene.getEngine().getRenderingCanvasClientRect();
    if (canvas) {
      const p = Vector3.Project(Vector3.ZeroReadOnly, Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(canvas.width, canvas.height));
      const below = bar.el.parentElement?.querySelector('.spin-bar')?.getBoundingClientRect().top ?? Infinity;
      bar.el.style.left = `${Math.round(canvas.left + p.x)}px`;
      bar.el.style.top = `${Math.round(Math.min(canvas.top + p.y + 6, below - 12))}px`;
    }
  }

  dispose(): void {
    for (const a of this.leaving.splice(0)) a.dispose();
    this.anim?.dispose();
    this.scene.dispose();
  }
}
