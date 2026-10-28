import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { offscreenCamera } from './offscreen.ts';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CharacterLibrary } from '../content/characters.ts';
import { CharacterAnimator } from '../game/characterAnimator.ts';
import { CreatureLibrary } from '../content/creatures.ts';
import { CreatureAnimator } from '../game/creatureAnimator.ts';
import { getLook, isCreature, npcLookRole } from '@tiletrigger/shared';
import { SHIPPED_PORTRAITS } from './portraitIndex.ts';

const SIZE = 256;

/** Looks whose face the default three-quarter view hides: where the camera sits from the face, and a nudge of the aim point onto it. */
const PORTRAIT_VIEWS: Record<string, { from: Vector3; aim: Vector3 }> = {
  // Capt. Nova's suit has a collar piece in front of her chin: look past it from her right.
  'core.nova': { from: new Vector3(-0.55, 0.12, 0.65), aim: new Vector3(-0.08, 0.04, 0.05) },
};

/**
 * Character portraits rendered from our own 3D characters (never painted
 * art): each look is built in a private scene, framed head and shoulders,
 * rendered once into a texture and kept as a PNG data URL. Renders run one at
 * a time so the menus never stall.
 */
export class PortraitRenderer {
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly lib: CharacterLibrary;
  private readonly creatures: CreatureLibrary;
  private readonly cache = new Map<string, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(engine: AbstractEngine) {
    this.scene = new Scene(engine);
    // Never draws to the screen: only into the portrait texture.
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false;
    // Renders between the app's frames: never onto the screen (see offscreenCamera).
    this.scene.activeCamera = offscreenCamera(this.scene, 'portraitHidden');
    this.camera = new FreeCamera('portraitCam', new Vector3(0, 1.6, 1), this.scene);
    this.camera.fov = 0.42;
    this.camera.minZ = 0.02;
    // The texture is square: never take the aspect ratio from the screen (that squashed faces).
    this.camera.freezeProjectionMatrix(Matrix.PerspectiveFovLH(this.camera.fov, 1, 0.02, 50, engine.isNDCHalfZRange));
    const hemi = new HemisphericLight('portraitHemi', new Vector3(0, 1, 0.5), this.scene);
    hemi.intensity = 0.7;
    hemi.groundColor = new Color3(0.12, 0.14, 0.2);
    const key = new DirectionalLight('portraitKey', new Vector3(-0.5, -0.4, -1), this.scene);
    key.intensity = 1.05;
    const rim = new PointLight('portraitRim', new Vector3(0.8, 2, -0.8), this.scene);
    rim.diffuse = Color3.FromHexString('#00d1ff');
    rim.intensity = 6;
    this.lib = new CharacterLibrary(this.scene);
    this.creatures = new CreatureLibrary(this.scene);
  }

  /**
   * A portrait of a look (an image URL): the one shipped with the site when
   * there is one (portraitIndex.ts: instant, cached by the browser), else
   * rendered here once (a PNG data URL) and kept.
   */
  get(look: string): Promise<string> {
    const shipped = SHIPPED_PORTRAITS[look];
    if (shipped) return Promise.resolve(`${import.meta.env.BASE_URL}portraits/${shipped}`);
    return this.renderLive(look);
  }

  /** Render a portrait here even when one is shipped (tools/content/capture-portraits.mjs makes the shipped ones with it). */
  renderLive(look: string): Promise<string> {
    let p = this.cache.get(look);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.render(look))) as Promise<string>;
      p.catch(() => this.cache.delete(look));
      this.cache.set(look, p);
    }
    return p;
  }

  private async render(look: string): Promise<string> {
    const role = npcLookRole(look);
    if (role && isCreature(role)) return this.renderCreature(role);
    if (role) return this.renderSoldier(look);
    const ch = await this.lib.create({ look }, 'portrait');
    // Parted characters face -Z here and the portrait camera sits on +Z, so turn them round to face it;
    // whole-body (Meshy) models already face the camera.
    if (!getLook(look).whole) ch.root.rotation.y = Math.PI;
    const anim = new CharacterAnimator(this.scene, ch);
    try {
      // Settle into the idle stance (arms down) rather than the bind T-pose.
      for (let i = 0; i < 8; i++) {
        anim.update(0.1, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0.05, celebrate: false });
        this.scene.render();
      }
      ch.root.computeWorldMatrix(true);
      for (const n of ch.root.getDescendants(false)) (n as TransformNode).computeWorldMatrix?.(true);
      this.frameHead(ch.meshes, ch.joints, PORTRAIT_VIEWS[look]);
      return await this.snap(ch.meshes);
    } finally {
      anim.dispose(); // also disposes the character
    }
  }

  /** A creature skin, framed on the upper part of its posed body (they share no head joint). */
  private async renderCreature(kind: Parameters<CreatureLibrary['create']>[0]): Promise<string> {
    const ch = await this.creatures.create(kind, 'portraitCreature');
    ch.root.rotation.y = Math.PI;
    const anim = new CreatureAnimator(this.scene, ch);
    try {
      for (let i = 0; i < 8; i++) {
        anim.update(0.1, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false });
        this.scene.render();
      }
      this.frameBody(ch.meshes);
      return await this.snap(ch.meshes);
    } finally {
      anim.dispose();
    }
  }

  /** A soldier NPC skin (the mannequin), framed the same way. */
  private async renderSoldier(look: string): Promise<string> {
    const ch = await this.lib.create({ look }, 'portraitSoldier');
    ch.root.rotation.y = Math.PI;
    const anim = new CharacterAnimator(this.scene, ch);
    try {
      for (let i = 0; i < 8; i++) {
        anim.update(0.1, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0.05, celebrate: false });
        this.scene.render();
      }
      ch.root.computeWorldMatrix(true);
      for (const n of ch.root.getDescendants(false)) (n as TransformNode).computeWorldMatrix?.(true);
      this.frameHead(ch.meshes, ch.joints);
      return await this.snap(ch.meshes);
    } finally {
      anim.dispose();
    }
  }

  /**
   * Head and shoulders, whatever the body: from the neck joint up to the top
   * of the posed model (hair, a hat, an otter's ears), centred on the head
   * joint, seen three-quarter from the front. Bodies that aren't human-shaped
   * (the otter, the cat, big helmets) frame as well as people do, because
   * nothing assumes a head 1.8 m up.
   */
  private frameHead(meshes: AbstractMesh[], joints: ReadonlyMap<string, TransformNode>, view?: { from: Vector3; aim: Vector3 }): void {
    const head = joints.get('Head');
    if (!head) return this.frameBody(meshes);
    const { max } = bounds(meshes);
    const h = head.getAbsolutePosition();
    const neck = joints.get('neck_01')?.getAbsolutePosition() ?? h.subtract(new Vector3(0, 0.12, 0));
    // Neck to the top of the model: about a head; never a sliver, never the whole body (a tall hat, raised ears).
    const span = Math.min(0.75, Math.max(0.2, max.y - neck.y));
    const at = new Vector3(h.x, neck.y + span * 0.45, h.z);
    if (view) at.addInPlace(view.aim);
    // The frame shows about 1.7 heads: the head, the neck, the top of the shoulders.
    const dist = (span * 1.7) / (2 * Math.tan(this.camera.fov / 2));
    const from = (view?.from ?? new Vector3(0.26, 0.05, 1)).normalizeToNew();
    this.camera.position.copyFrom(at.add(from.scale(dist)));
    this.camera.setTarget(at.add(new Vector3(0, -span * 0.06, 0)));
  }

  /** A creature (or anything without a head joint), whole, seen three-quarter from the front: they come in every shape. */
  private frameBody(meshes: AbstractMesh[]): void {
    const { min, max } = bounds(meshes);
    const size = Math.min(6, Math.max(0.4, max.y - min.y, (max.x - min.x) * 0.8, (max.z - min.z) * 0.8));
    const at = new Vector3((min.x + max.x) / 2, min.y + (max.y - min.y) * 0.55, (min.z + max.z) / 2);
    const dist = (size * 1.15) / (2 * Math.tan(this.camera.fov / 2));
    const from = new Vector3(0.45, 0.25, 1).normalize();
    this.camera.position.copyFrom(at.add(from.scale(dist)));
    this.camera.setTarget(at);
  }

  /** Render the meshes into the portrait texture once everything is drawable; textures load and shaders compile asynchronously. */
  private async snap(meshes: AbstractMesh[]): Promise<string> {
    const textures = meshes.flatMap((m) => (m.material ? m.material.getActiveTextures() : []));
    const deadline = performance.now() + 20000;
    while (!(textures.every((t) => t.isReady()) && meshes.every((m) => m.isReady(true))) && performance.now() < deadline) {
      this.scene.render();
      await new Promise((r) => setTimeout(r, 50));
    }
    const rtt = new RenderTargetTexture('portraitRT', SIZE, this.scene, false);
    rtt.activeCamera = this.camera;
    rtt.renderList = meshes;
    rtt.clearColor = new Color4(0, 0, 0, 0);
    this.scene.customRenderTargets.push(rtt);
    // The first frames compile shaders; draw until something shows (or give up).
    let pixels: Uint8Array | null = null;
    for (let attempt = 0; attempt < 12 && !covered(pixels); attempt++) {
      this.scene.render();
      await new Promise((r) => setTimeout(r, 30));
      if (attempt >= 2) pixels = (await rtt.readPixels()) as Uint8Array | null;
    }
    this.scene.customRenderTargets.splice(this.scene.customRenderTargets.indexOf(rtt), 1);
    rtt.dispose();
    if (!pixels) throw new Error('portrait render failed');
    return toDataUrl(pixels, SIZE);
  }

  dispose(): void {
    this.scene.dispose();
  }
}

/** The posed (skinned) meshes' world bounds. */
function bounds(meshes: AbstractMesh[]): { min: Vector3; max: Vector3 } {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    m.refreshBoundingInfo({ applySkeleton: true, applyMorph: true });
    const b = m.getBoundingInfo().boundingBox;
    min.minimizeInPlace(b.minimumWorld);
    max.maximizeInPlace(b.maximumWorld);
  }
  return { min, max };
}

/** Whether a render drew the character (any opaque pixel), rather than an empty frame. */
function covered(pixels: Uint8Array | null): boolean {
  if (!pixels) return false;
  for (let i = 3; i < pixels.length; i += 64) if (pixels[i]! > 0) return true;
  return false;
}

/** RGBA pixels (bottom row first) to a PNG data URL. */
function toDataUrl(pixels: Uint8Array, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(size, size);
  const row = size * 4;
  for (let y = 0; y < size; y++) img.data.set(pixels.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  g.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
