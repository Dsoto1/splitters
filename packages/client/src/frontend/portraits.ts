import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { offscreenCamera, offscreenProjection } from './offscreen.ts';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CharacterLibrary } from '../content/characters.ts';
import { CharacterAnimator } from '../game/characterAnimator.ts';
import { CreatureLibrary } from '../content/creatures.ts';
import { CreatureAnimator } from '../game/creatureAnimator.ts';
import { decodeLook, isCreature, npcLookRole } from '@tiletrigger/shared';
import { SHIPPED_PORTRAITS } from './portraitIndex.ts';

const SIZE = 256;

/**
 * A look's own portrait framing, where the default (head and shoulders, three-quarter from its left, framed from the
 * neck to the top of the model) leaves its face off centre or hidden: `from`, where the camera sits from the face
 * (x the character's left, z its front; the default is (0.26, 0.05, 1)); `aim`, a nudge of the aim point (m; every
 * portrait body is built at its full 1.8 m); `zoom`, the frame's size against the default (more than 1 shows more round the head).
 */
export interface PortraitView {
  from?: [number, number, number];
  aim?: [number, number, number];
  zoom?: number;
}

/** Looks whose face the default view hides or leaves off centre (tools/content/capture-portraits.mjs ships them). */
const PORTRAIT_VIEWS: Record<string, PortraitView> = {
  // The Roster Board's thumbnail flags (owner, 2026-11-01): faces cut off, low in the frame or hidden.
  // Bandit's ears and snout ran off the frame: wider, from a little below, so the snout shows past his paws.
  'core.bandit': { from: [0.1, -0.1, 1], aim: [0, -0.03, 0], zoom: 1.5 },
  // Wide heads and long snouts (Boglurker's crocodile, a frog) filled the frame edge to edge.
  'core.boglurker': { aim: [0, 0.02, 0], zoom: 1.45 },
  'core.croakley': { zoom: 1.4 },
  // The tortoise's head is small against its shell: wider, so the shell's dome frames it (any size: a portrait body is
  // built at 1.8 m, so Shellback's move from large to standard, 2026-11-06, left the picture as it was).
  'core.tortoise': { zoom: 1.25 },
  // Cool Hands Rex's long snout and shades ran off the frame; Fishy Fred's face sits low on the front of the fish, its
  // tail curled up over its back: wider, the aim down onto the face.
  'core.trex': { zoom: 1.15 },
  'core.fishyfred': { aim: [0, -0.06, 0], zoom: 1.25 },
  // Sir Galloway's visor: from a little below, into the helmet.
  'core.galloway': { from: [0.26, -0.2, 1], zoom: 0.9 },
  // Grizzelda's hat brim hid her face from above: from below, the aim down onto her face.
  'core.grizzelda': { from: [0.2, -0.35, 1], aim: [0, -0.08, 0.03], zoom: 1.1 },
  // Lancer Mei's and Shade's tall helmet and hood put the face at the bottom: aim down onto it, a little closer.
  'core.mei': { aim: [0, -0.1, 0], zoom: 0.85 },
  'core.shade': { aim: [0, -0.08, 0], zoom: 0.9 },
  // Rattles and Rotter hold their heads tilted to one side: wider, the aim onto the face.
  'core.rattles': { aim: [-0.05, 0, 0], zoom: 1.25 },
  'core.rotter': { from: [0.8, 0, 1], aim: [0.12, -0.04, 0], zoom: 1.3 },
  // Saint Nick's tall hat (rebuilt finer, 2026-11-01) put his face at the bottom.
  'core.saintnick': { aim: [0, -0.12, 0], zoom: 1.1 },
};

/** Creatures framed on the top share of their body instead of whole (owner, 2026-11-03: "zoom in on the imp thumbnail"). */
const CREATURE_TOPS: Partial<Record<string, number>> = { imp: 0.42 };

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
    this.camera.freezeProjectionMatrix(offscreenProjection(engine, this.camera.fov, 1, 0.02, 50));
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
    // A design of yours: its ID is the look itself, so a picture drawn once is kept in this browser for good.
    if (decodeLook(look)) {
      const kept = keptPortraits()[look];
      if (kept) return Promise.resolve(kept);
      return this.renderLive(look).then((url) => (keepPortrait(look, url), url));
    }
    return this.renderLive(look);
  }

  /**
   * Render a portrait here even when one is shipped (tools/content/capture-portraits.mjs makes the shipped ones with
   * it). `view`: try another framing than the look's own (PORTRAIT_VIEWS), not kept.
   */
  renderLive(look: string, view?: PortraitView): Promise<string> {
    if (view) return (this.queue = this.queue.then(() => this.render(look, view))) as Promise<string>;
    let p = this.cache.get(look);
    if (!p) {
      p = (this.queue = this.queue.then(() => this.render(look))) as Promise<string>;
      p.catch(() => this.cache.delete(look));
      this.cache.set(look, p);
    }
    return p;
  }

  private async render(look: string, view: PortraitView | undefined = PORTRAIT_VIEWS[look]): Promise<string> {
    const role = npcLookRole(look);
    if (role && isCreature(role)) return this.renderCreature(role);
    if (role) return this.renderSoldier(look);
    // Every character faces the portrait camera (on +Z) as built. (They used to be turned round: with the depth
    // test reversed (see offscreenProjection) a character seen from behind showed its face through its head.)
    const ch = await this.lib.create({ look }, 'portrait');
    const anim = new CharacterAnimator(this.scene, ch);
    try {
      // Settle into the idle stance (arms down) rather than the bind T-pose.
      for (let i = 0; i < 8; i++) {
        anim.update(0.1, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0.05, celebrate: false });
        this.scene.render();
      }
      ch.root.computeWorldMatrix(true);
      for (const n of ch.root.getDescendants(false)) (n as TransformNode).computeWorldMatrix?.(true);
      this.frameHead(ch.meshes, ch.joints, view);
      return await this.snap(ch.meshes);
    } finally {
      anim.dispose(); // also disposes the character
    }
  }

  /** A creature skin, framed on the upper part of its posed body (they share no head joint). */
  private async renderCreature(kind: Parameters<CreatureLibrary['create']>[0]): Promise<string> {
    const ch = await this.creatures.create(kind, 'portraitCreature');
    const anim = new CreatureAnimator(this.scene, ch);
    try {
      for (let i = 0; i < 8; i++) {
        anim.update(0.1, { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false });
        this.scene.render();
      }
      this.frameBody(ch.meshes, CREATURE_TOPS[kind]);
      return await this.snap(ch.meshes);
    } finally {
      anim.dispose();
    }
  }

  /** A soldier NPC skin (the mannequin), framed the same way. */
  private async renderSoldier(look: string): Promise<string> {
    const ch = await this.lib.create({ look }, 'portraitSoldier');
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
  private frameHead(meshes: AbstractMesh[], joints: ReadonlyMap<string, TransformNode>, view?: PortraitView): void {
    const head = joints.get('Head');
    if (!head) return this.frameBody(meshes);
    const { max } = bounds(meshes);
    const h = head.getAbsolutePosition();
    const neck = joints.get('neck_01')?.getAbsolutePosition() ?? h.subtract(new Vector3(0, 0.12, 0));
    // Neck to the top of the model: about a head; never a sliver, never the whole body (a tall hat, raised ears).
    const span = Math.min(0.75, Math.max(0.2, max.y - neck.y));
    const at = new Vector3(h.x, neck.y + span * 0.45, h.z);
    if (view?.aim) at.addInPlace(Vector3.FromArray(view.aim));
    // The frame shows about 1.7 heads: the head, the neck, the top of the shoulders.
    const dist = (span * 1.7 * (view?.zoom ?? 1)) / (2 * Math.tan(this.camera.fov / 2));
    const from = (view?.from ? Vector3.FromArray(view.from) : new Vector3(0.26, 0.05, 1)).normalizeToNew();
    this.camera.position.copyFrom(at.add(from.scale(dist)));
    this.camera.setTarget(at.add(new Vector3(0, -span * 0.06, 0)));
  }

  /** A creature (or anything without a head joint), whole, seen three-quarter from the front: they come in every shape. */
  private frameBody(meshes: AbstractMesh[], top?: number): void {
    const { min, max } = bounds(meshes);
    // `top`: only the top share of the body, head and shoulders (a tall, thin creature whole is a speck in the tile).
    const h = (max.y - min.y) * (top ?? 1);
    const size = Math.min(6, Math.max(0.3, h, top ? 0 : (max.x - min.x) * 0.8, top ? 0 : (max.z - min.z) * 0.8));
    const at = new Vector3((min.x + max.x) / 2, top ? max.y - h * 0.5 : min.y + (max.y - min.y) * 0.55, (min.z + max.z) / 2);
    const dist = (size * 1.15) / (2 * Math.tan(this.camera.fov / 2));
    const from = new Vector3(0.45, 0.25, 1).normalize();
    this.camera.position.copyFrom(at.add(from.scale(dist)));
    this.camera.setTarget(at);
  }

  /** Render the meshes into the portrait texture once everything is drawable; textures load and shaders compile asynchronously. */
  private async snap(all: AbstractMesh[]): Promise<string> {
    const meshes = withoutLodLevels(all);
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

/**
 * The meshes without the ones that are another mesh's lower level of detail (a character part's `_lod` copy).
 * A scene draws one level of each, but a render target draws every mesh it's given: both levels together
 * fought (mosaics on faces and hoods) and the coarse copy showed through the fine one (see-through helmets).
 */
function withoutLodLevels(meshes: AbstractMesh[]): AbstractMesh[] {
  const levels = new Set<AbstractMesh>();
  for (const m of meshes) if (m instanceof Mesh) for (const l of m.getLODLevels()) if (l.mesh) levels.add(l.mesh);
  return levels.size ? meshes.filter((m) => !levels.has(m)) : meshes;
}

/** The posed (skinned) meshes' world bounds. */
function bounds(all: AbstractMesh[]): { min: Vector3; max: Vector3 } {
  const meshes = withoutLodLevels(all);
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
const KEPT = 'cs.portraits';
/** Kept for at most this many designs (the Designer saves up to 24); the oldest go first. */
const MAX_KEPT = 32;

function keptPortraits(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEPT) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Keep a design's portrait (shrunk to a small WebP, about 10 kB) so it is never drawn again in this browser. */
function keepPortrait(look: string, url: string): void {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    c.getContext('2d')!.drawImage(img, 0, 0, 160, 160);
    const small = c.toDataURL('image/webp', 0.85);
    const all = Object.entries(keptPortraits()).filter(([k]) => k !== look);
    try {
      localStorage.setItem(KEPT, JSON.stringify(Object.fromEntries([...all.slice(-(MAX_KEPT - 1)), [look, small.startsWith('data:image/webp') ? small : url]])));
    } catch {
      // Storage full or unavailable: it is drawn again next time.
    }
  };
  img.src = url;
}

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
