import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Node } from '@babylonjs/core/node';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import { applyToneMapping, loadGraphicsQuality, type GraphicsQuality } from './graphicsSettings.ts';

export * from './graphicsSettings.ts';

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
    // Effects (muzzle flashes, hits, explosions) glow: no shadow on them, none from them (they were most of a
    // fight's shadow casters, a second draw each, and a flash or a puff of smoke casting a shadow looks wrong).
    if ((m.metadata as { effect?: boolean } | null)?.effect) return false;
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

/** Whether a node is one of `roots` or below one. */
function underAny(n: Node, roots: ReadonlySet<Node>): boolean {
  for (let p: Node | null = n; p; p = p.parent) if (roots.has(p)) return true;
  return false;
}
