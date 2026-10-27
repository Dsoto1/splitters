import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Node } from '@babylonjs/core/node';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';

/**
 * How good the world looks, against how hard the machine works:
 *   low     tone mapping only (cheap colour and contrast)
 *   medium  + sharp sun shadows in a box that follows you
 *   high    + shadows that reach far (cascades), ambient occlusion in corners and bloom on bright spots
 */
export type GraphicsQuality = 'low' | 'medium' | 'high';
export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['low', 'medium', 'high'];
const KEY = 'tiletrigger.graphics';

export function loadGraphicsQuality(): GraphicsQuality {
  try {
    const q = localStorage.getItem(KEY) as GraphicsQuality | null;
    if (q && GRAPHICS_QUALITIES.includes(q)) return q;
  } catch {
    // Private windows: the default.
  }
  return 'medium';
}

export function saveGraphicsQuality(q: GraphicsQuality): void {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    // Lasts for this page.
  }
}

/**
 * The game's colour: ACES tone mapping with a touch more exposure and
 * contrast, and a vignette (left off where it would hide work, as in the
 * MapMaker). Matches, the menu, the MapMaker and the Character Designer use it, so a map and a
 * character look the same wherever you see them.
 */
export function applyToneMapping(scene: Scene, o: { vignette?: boolean } = {}): void {
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.15;
  ip.contrast = 1.12;
  ip.vignetteEnabled = o.vignette ?? true;
  ip.vignetteWeight = 1.2;
  ip.vignetteStretch = 0.6;
}

/** Half-size of the medium shadow box round the camera (metres): sharp nearby, none far away. */
const BOX = 45;

/**
 * Lighting polish for a match scene: tone mapping and colour grading, sun
 * shadows, and on high, ambient occlusion and bloom. Meshes join the shadows
 * as they're created (map, props, characters, pickups); the first-person
 * view model, the sky and the far backdrop are left out.
 */
export class Atmosphere {
  private shadows: ShadowGenerator | null = null;
  private pipeline: DefaultRenderingPipeline | null = null;
  private ssao: SSAO2RenderingPipeline | null = null;
  private readonly pending: AbstractMesh[] = [];
  private readonly observers: Observer<unknown>[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly camera: Camera,
    private readonly sun: DirectionalLight,
    private readonly viewRoot: TransformNode,
    readonly quality: GraphicsQuality = loadGraphicsQuality(),
  ) {
    applyToneMapping(scene);
    if (quality === 'low') return;

    const webgpu = (scene.getEngine() as { isWebGPU?: boolean }).isWebGPU === true;
    if (quality === 'high') {
      const csm = new CascadedShadowGenerator(2048, sun);
      csm.numCascades = 3;
      csm.lambda = 0.85;
      csm.shadowMaxZ = 160;
      csm.stabilizeCascades = true;
      csm.cascadeBlendPercentage = 0.08;
      this.shadows = csm;
    } else {
      // One sharp map in a box that travels with the camera.
      sun.autoUpdateExtends = false;
      sun.autoCalcShadowZBounds = false;
      sun.orthoLeft = -BOX;
      sun.orthoRight = BOX;
      sun.orthoTop = BOX;
      sun.orthoBottom = -BOX;
      sun.shadowMinZ = 1;
      sun.shadowMaxZ = 400;
      this.shadows = new ShadowGenerator(2048, sun);
      this.observers.push(scene.onBeforeRenderObservable.add(() => this.follow()) as Observer<unknown>);
    }
    const s = this.shadows;
    s.usePercentageCloserFiltering = true;
    s.filteringQuality = quality === 'high' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
    s.bias = 0.0015;
    s.normalBias = 0.02;
    s.darkness = 0.1;
    s.transparencyShadow = false;
    // Only casters that can reach the shadows: the shadow map draws its whole list every frame (no
    // culling of its own), which on a big map with 96 characters was several thousand draw calls.
    const reach = quality === 'high' ? 180 : BOX * Math.SQRT2 + 10;
    const near: AbstractMesh[] = [];
    let nearFrame = -1;
    const map = s.getShadowMap();
    if (map) {
      map.getCustomRenderList = (_pass, list, length) => {
        if (!list) return null;
        const frame = scene.getFrameId();
        if (frame === nearFrame) return near;
        nearFrame = frame;
        near.length = 0;
        const c = this.camera.globalPosition;
        const off = this.shadowless;
        for (let i = 0; i < length; i++) {
          const m = list[i]!;
          const b = m.getBoundingInfo().boundingSphere;
          if (Vector3.Distance(b.centerWorld, c) - b.radiusWorld > reach) continue;
          if (off.size && underAny(m, off)) continue;
          near.push(m);
        }
        return near;
      };
    }

    for (const m of scene.meshes) this.pending.push(m);
    this.observers.push(scene.onNewMeshAddedObservable.add((m) => this.pending.push(m)) as Observer<unknown>);
    // New meshes are sorted a frame later, once they have their parents and materials.
    this.observers.push(scene.onBeforeRenderObservable.add(() => this.sortPending()) as Observer<unknown>);

    if (quality === 'high') {
      try {
        this.pipeline = new DefaultRenderingPipeline('atmos', true, scene, [camera]);
        this.pipeline.bloomEnabled = true;
        this.pipeline.bloomThreshold = 0.82;
        this.pipeline.bloomWeight = 0.22;
        this.pipeline.bloomKernel = 48;
        this.pipeline.fxaaEnabled = true;
        // The pipeline does its own image processing: carry the settings over.
        this.pipeline.imageProcessingEnabled = true;
        if (!webgpu) {
          this.ssao = new SSAO2RenderingPipeline('atmosAO', scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camera]);
          this.ssao.radius = 1.6;
          this.ssao.totalStrength = 0.9;
          this.ssao.samples = 12;
          this.ssao.maxZ = 120;
        }
      } catch {
        // Older GPUs: shadows and tone mapping still apply.
        this.pipeline = null;
        this.ssao = null;
      }
    }
  }

  /**
   * Nodes whose meshes cast no shadow for now (a crowd's far characters: see
   * GameView.updateAvatars). They still catch shadows.
   */
  readonly shadowless = new Set<Node>();

  /** Is this mesh part of the world that should cast and catch shadows? */
  private worldly(m: AbstractMesh): boolean {
    if (m.isDisposed() || m.getTotalVertices() === 0) return false;
    if (m.renderingGroupId !== 0 || m.infiniteDistance) return false;
    // The backdrop (sky, ground and props past the border) stays out: it's far, and there's a lot of it.
    for (let n: { name: string; parent: unknown } | null = m; n; n = n.parent as typeof n) if (n.name.startsWith('backdrop_')) return false;
    if (m.isDescendantOf(this.viewRoot)) return false;
    const mat = m.material as { alpha?: number; disableLighting?: boolean } | null;
    if (mat?.disableLighting) return false;
    return true;
  }

  private sortPending(): void {
    if (!this.pending.length || !this.shadows) return;
    const map = this.shadows.getShadowMap();
    if (!map) return;
    for (const m of this.pending.splice(0)) {
      if (!this.worldly(m)) continue;
      m.receiveShadows = true;
      const mat = m.material as { alpha?: number } | null;
      // See-through things (glass, water, effects) catch shadows but don't cast them.
      if (mat && mat.alpha !== undefined && mat.alpha < 0.99) continue;
      // Ankle-high terrain plants (thousands of them) catch shadows but cast none worth drawing.
      if (m.name.startsWith('foliage')) continue;
      // Parts whose shadow falls inside their own body (a character's eyes): a draw for nothing.
      if ((m.metadata as { castsNoShadow?: boolean } | null)?.castsNoShadow) continue;
      map.renderList?.push(m);
      m.onDisposeObservable.addOnce(() => {
        const list = map.renderList;
        const i = list?.indexOf(m) ?? -1;
        if (list && i >= 0) list.splice(i, 1);
      });
    }
  }

  /** Medium: keep the shadow box centred on the camera, snapped to its texels so edges don't shimmer. */
  private follow(): void {
    const dir = this.sun.direction.normalizeToNew();
    const step = (BOX * 2) / 2048;
    const c = this.camera.globalPosition;
    const at = new Vector3(Math.round(c.x / step) * step, Math.round(c.y / step) * step, Math.round(c.z / step) * step);
    this.sun.position = at.subtract(dir.scale(200));
  }

  dispose(): void {
    for (const o of this.observers) o.remove();
    this.pipeline?.dispose();
    this.ssao?.dispose();
    this.shadows?.dispose();
  }
}

// ---------------------------------------------------------------- performance settings

/**
 * How many pixels to draw per CSS pixel. Retina screens have two, so drawing at
 * "native" is four times the work of "sharp"; "auto" draws 1.25 (sharp enough
 * that edges don't look soft, much cooler on laptops).
 */
export const RENDER_SCALES = ['auto', 'native', 'sharp', 'performance'] as const;
export type RenderScale = (typeof RENDER_SCALES)[number];
export const RENDER_SCALE_LABELS: Record<RenderScale, string> = {
  auto: 'Auto (crisp, cooler on Retina screens)',
  native: 'Native (full Retina, hottest)',
  sharp: 'Standard (1 pixel per point)',
  performance: 'Performance (75%)',
};
/** Frames per second at most (0: as fast as the screen refreshes, 120 on ProMotion displays). */
export const FRAME_CAPS = [60, 30, 120, 0] as const;
export type FrameCap = (typeof FRAME_CAPS)[number];

function load<T>(key: string, ok: readonly T[], fallback: T, parse: (s: string) => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && ok.includes(parse(raw))) return parse(raw);
  } catch {
    // Private windows: the default.
  }
  return fallback;
}
function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows: kept for this session only.
  }
}
export const loadRenderScale = (): RenderScale => load('tiletrigger.renderScale', RENDER_SCALES, 'auto', (s) => s as RenderScale);
export const saveRenderScale = (s: RenderScale): void => {
  save('tiletrigger.renderScale', s);
  // Applied at once by the app (main.ts listens).
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tiletrigger:render-scale'));
};
export const loadFrameCap = (): FrameCap => load('tiletrigger.frameCap', FRAME_CAPS, 60, (s) => Number(s) as FrameCap);
let frameCap: FrameCap | null = null;
export const saveFrameCap = (c: FrameCap): void => {
  frameCap = c;
  save('tiletrigger.frameCap', String(c));
};
/** The frame cap, read from storage once (it is checked every frame). */
export const currentFrameCap = (): FrameCap => (frameCap ??= loadFrameCap());

/** Pixels drawn per CSS pixel for a setting on this screen. */
export function renderRatio(scale: RenderScale, dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1): number {
  switch (scale) {
    case 'native':
      return dpr;
    case 'sharp':
      return 1;
    case 'performance':
      return 0.75;
    default:
      return Math.min(dpr, 1.25);
  }
}

/** Whether a node is one of `roots` or below one. */
function underAny(n: Node, roots: ReadonlySet<Node>): boolean {
  for (let p: Node | null = n; p; p = p.parent) if (roots.has(p)) return true;
  return false;
}
