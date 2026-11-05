import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
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
import { applyWorldGrade, loadGraphicsQuality, type GraphicsQuality } from './graphicsSettings.ts';
import { buildShadowProxies, proxyable } from './shadowProxy.ts';
import { underSmall } from './shadowFlags.ts';
import { BOX_SLACK, ShadowCache, isStaticCaster } from './shadowCache.ts';
import { perfOn } from './perfSwitches.ts';

export * from './graphicsSettings.ts';

/** Half-size of the medium shadow box round the camera (metres): sharp nearby, none far away. */
const BOX = 45;
/** The medium box sits this much of its half-size ahead of the camera, where shadows are seen, not behind it. */
const AHEAD = 0.4;
/** A caster smaller across than this many texels of its shadow map is left out of that map. */
const MIN_TEXELS = 6;

/**
 * Lighting polish for a match scene: tone mapping and colour grading, sun
 * shadows, and on high, ambient occlusion and bloom. Meshes join the shadows
 * as they're created (map, props, characters, pickups); the first-person
 * view model, the sky and the far backdrop are left out.
 */
/** Small clutter props (propVisuals.ts `isSmallProp`) cast shadows only within this many metres of the camera. */
export const SMALL_CASTER_REACH = 15;
/** Static casters are merged into shadow proxies once none has come for this long (ms): the level and props load in bursts. */
const STATIC_SETTLE_MS = 500;

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
    applyWorldGrade(scene);
    if (quality === 'low') return;

    const webgpu = (scene.getEngine() as { isWebGPU?: boolean }).isWebGPU === true;
    if (quality === 'high') {
      const csm = new CascadedShadowGenerator(2048, sun);
      csm.numCascades = 3;
      csm.lambda = 0.85;
      csm.shadowMaxZ = 120;
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
    // Tight enough that shadows meet the things casting them (contact), loose enough to stay free of acne.
    s.bias = 0.001;
    s.normalBias = 0.014;
    s.darkness = 0.1;
    s.transparencyShadow = false;
    // Only casters that can reach the shadows: the shadow map draws its whole list every frame (no
    // culling of its own), which on a big map with 96 characters was several thousand draw calls.
    const reach = quality === 'high' ? 180 : BOX * Math.SQRT2 + BOX * AHEAD + 10;
    const near: AbstractMesh[] = [];
    /** `near` without the static casters, for a cascade that takes them from the static shadow cache this frame. */
    const nearMoving: AbstractMesh[] = [];
    let nearFrame = -1;
    // Then each map (a cascade on high) draws only the casters inside its own square, as the light sees
    // it: with three cascades every caster was drawn three times. Depth is clamped, so only the sides cut.
    // This is decided per mesh as it draws (customAllowRendering), not by giving each map a list of its own:
    // Babylon keeps instances' visibility per pass, and lists that differed by cascade lost the trees and
    // props (instances) from the main view. Instanced meshes always draw: all their copies are one call.
    const csm = s instanceof CascadedShadowGenerator ? s : null;
    const at = new Vector3();
    const map = s.getShadowMap();
    /** The square the map being drawn covers, worked out once per map per frame. */
    const square = { frame: -1, layer: -1, ok: false, kx: 0, ky: 0, minRadius: 0 };
    let counted = -1;
    // Static casters drawn only when a cascade moves (shadowCache.ts), the rest every frame on top.
    this.cache = map && perfOn('shadowcache') ? ShadowCache.attach(scene, s, csm) : null;
    const cache = this.cache;
    if (map) {
      map.getCustomRenderList = (pass, list, length) => {
        if (!list) return null;
        const frame = scene.getFrameId();
        const pick = () => (cache && !cache.drawsStatic(pass) ? nearMoving : near);
        if (frame === nearFrame) return pick();
        nearFrame = frame;
        near.length = 0;
        nearMoving.length = 0;
        const c = this.camera.globalPosition;
        const off = this.shadowless;
        for (let i = 0; i < length; i++) {
          const m = list[i]!;
          const b = m.getBoundingInfo().boundingSphere;
          const d = Vector3.Distance(b.centerWorld, c) - b.radiusWorld;
          if (d > reach) continue;
          // Small clutter (grass, flowers, small rocks: propVisuals' `smallCaster`) casts only near the camera.
          if (d > SMALL_CASTER_REACH && (m.metadata as { smallCaster?: boolean } | null)?.smallCaster) continue;
          if (off.size && underAny(m, off)) continue;
          near.push(m);
          if (!(cache ? cache.isStatic(m) : isStaticCaster(m))) nearMoving.push(m);
        }
        return pick();
      };
      s.customAllowRendering = (sub) => {
        const m = sub.getRenderingMesh();
        const frame = scene.getFrameId();
        if (counted !== frame) {
          counted = frame;
          this.casterCount = 0;
        }
        if (m.hasInstances || m.hasThinInstances) {
          this.casterCount++;
          return true;
        }
        const layer = csm ? ((csm as unknown as { _currentLayer?: number })._currentLayer ?? 0) : 0;
        if (square.frame !== frame || square.layer !== layer) {
          square.frame = frame;
          square.layer = layer;
          const lo = csm ? csm.getCascadeMinExtents(layer) : null;
          const hi = csm ? csm.getCascadeMaxExtents(layer) : null;
          square.ok = !csm || (!!lo && !!hi && hi.x > lo.x && hi.y > lo.y);
          // The map's square is -1..1 across; a metre is this much of it.
          square.kx = csm && square.ok ? 2 / (hi!.x - lo!.x) : 1 / BOX;
          square.ky = csm && square.ok ? 2 / (hi!.y - lo!.y) : 1 / BOX;
          // Casters smaller than a few of the map's texels cast a speck: the far cascade's texel is a quarter
          // metre. The square is 2 / kx metres across and the map that many texels: MIN_TEXELS of them across.
          square.minRadius = MIN_TEXELS / (square.kx * map.getSize().width);
        }
        if (!square.ok) return true;
        const toMap = csm ? csm.getCascadeTransformMatrix(layer) : s.getTransformMatrix();
        if (!toMap) return true;
        const b = m.getBoundingInfo().boundingSphere;
        if (b.radiusWorld < square.minRadius) return false;
        Vector3.TransformCoordinatesToRef(b.centerWorld, toMap, at);
        const r = b.radiusWorld;
        if (Math.abs(at.x) - r * square.kx > 1 || Math.abs(at.y) - r * square.ky > 1) return false;
        this.casterCount++;
        return true;
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
        // Edges smoothed by 4x multisampling where WebGL2 has it, not FXAA: FXAA blurred the whole picture
        // (on top of Auto's 1.25 pixels per point, high looked fuzzier than medium).
        if (webgpu || ((scene.getEngine() as { webGLVersion?: number }).webGLVersion ?? 1) >= 2) this.pipeline.samples = 4;
        else this.pipeline.fxaaEnabled = true;
        // The pipeline does its own image processing: carry the settings over.
        this.pipeline.imageProcessingEnabled = true;
        if (!webgpu) {
          // Occlusion worked out at half size, denoised at full size: denoised at half size too it was grainy.
          this.ssao = new SSAO2RenderingPipeline('atmosAO', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera]);
          // Corners and contact: a tighter radius and more strength than before the world grade (docs/LOOK.md).
          this.ssao.radius = 1.3;
          this.ssao.totalStrength = 1.15;
          this.ssao.samples = 16;
          this.ssao.bilateralSoften = 0.04;
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
  /** Meshes the shadow map drew in the last frame (the performance overlay shows it). */
  casterCount = 0;
  /** The static shadow cache (null on low, WebGPU and WebGL1, or with `?perfoff=shadowcache`). */
  readonly cache: ShadowCache | null = null;
  /** Medium: where the shadow box was last put (it moves only past BOX_SLACK while the static cache is on). */
  private boxAt: Vector3 | null = null;

  /**
   * Static casters wait here a moment (the level and the props stream in over a few frames) and then cast through
   * merged proxies (shadowProxy.ts), one batch at a time.
   */
  private staticQueue: AbstractMesh[] = [];
  private staticAt = 0;
  private readonly batches: { sources: AbstractMesh[]; proxies: AbstractMesh[]; dirty: boolean }[] = [];
  private batchCount = 0;

  /** Static casters queued for half a second without a new one: merge them into a batch of proxies. */
  private flushStatic(now: number): void {
    for (const b of this.batches) if (b.dirty) this.rebuild(b);
    if (!this.staticQueue.length || now - this.staticAt < STATIC_SETTLE_MS) return;
    const b = { sources: this.staticQueue.splice(0).filter((m) => !m.isDisposed()), proxies: [] as AbstractMesh[], dirty: false };
    this.batches.push(b);
    this.rebuild(b);
  }

  /** (Re)build a batch's proxies: its sources still there and still static; those that no longer are cast on their own. */
  private rebuild(b: { sources: AbstractMesh[]; proxies: AbstractMesh[]; dirty: boolean }): void {
    const map = this.shadows?.getShadowMap();
    if (!map?.renderList) return;
    b.dirty = false;
    for (const p of b.proxies) p.dispose();
    const keep = b.sources.filter((m) => !m.isDisposed());
    const { proxies, sources } = buildShadowProxies(this.scene, keep, String(this.batchCount++));
    const merged = new Set(sources);
    for (const m of keep) {
      if (merged.has(m)) continue;
      // No longer static (moved, hidden): back in the list on its own.
      if (m.metadata && (m.metadata as { shadowProxied?: boolean }).shadowProxied) (m.metadata as { shadowProxied?: boolean }).shadowProxied = false;
      if (!map.renderList.includes(m)) addCaster(map, m);
    }
    for (const m of sources) {
      if (!b.sources.includes(m)) continue;
      m.metadata = { ...(m.metadata as object | null), shadowProxied: true };
      // A merged mesh that goes away takes its triangles out of the batch.
      if (!this.watched.has(m)) {
        this.watched.add(m);
        m.onDisposeObservable.addOnce(() => {
          this.watched.delete(m);
          for (const x of this.batches) if (x.sources.includes(m)) x.dirty = true;
        });
      }
    }
    b.sources = sources;
    for (const p of proxies) addCaster(map, p);
    b.proxies = proxies;
    // The static casters changed: every cascade draws them into its cache again.
    this.cache?.invalidate();
  }

  private readonly watched = new Set<AbstractMesh>();

  /** Shadow proxies in use, and how many meshes they stand in for (tests and the perf probe). */
  get proxyStats(): { proxies: number; sources: number } {
    return { proxies: this.batches.reduce((n, b) => n + b.proxies.length, 0), sources: this.batches.reduce((n, b) => n + b.sources.length, 0) };
  }

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
    if (!this.shadows) return;
    this.flushStatic(performance.now());
    if (!this.pending.length) return;
    const map = this.shadows.getShadowMap();
    if (!map) return;
    for (const m of this.pending.splice(0)) {
      if (!this.worldly(m)) continue;
      // Instances take it from their source mesh (setting it on one only logs a warning: thousands in a match).
      if (!m.isAnInstance) m.receiveShadows = true;
      const mat = m.material as { alpha?: number } | null;
      // See-through things (glass, water, effects) catch shadows but don't cast them.
      if (mat && mat.alpha !== undefined && mat.alpha < 0.99) continue;
      // Ankle-high terrain plants (thousands of them) catch shadows but cast none worth drawing.
      if (m.name.startsWith('foliage')) continue;
      // Parts whose shadow falls inside their own body (a character's eyes): a draw for nothing.
      if ((m.metadata as { castsNoShadow?: boolean } | null)?.castsNoShadow) continue;
      // Small things placed under a node that says so (a pickup, a held gun) cast only near the camera, as clutter does.
      if (underSmall(m)) m.metadata = { ...(m.metadata as object | null), smallCaster: true };
      // Static geometry (not small clutter, which casts only near the camera) casts through merged proxies.
      if (!(m.metadata as { smallCaster?: boolean } | null)?.smallCaster && proxyable(m)) {
        this.staticQueue.push(m);
        this.staticAt = performance.now();
        continue;
      }
      addCaster(map, m);
    }
  }

  /** Medium: keep the shadow box centred on the camera, snapped to its texels so edges don't shimmer. */
  private follow(): void {
    const dir = this.sun.direction.normalizeToNew();
    const step = (BOX * 2) / 2048;
    const fwd = this.camera.getDirection(Vector3.Forward());
    const flat = Math.hypot(fwd.x, fwd.z) || 1;
    const c = this.camera.globalPosition;
    const cx = c.x + (fwd.x / flat) * BOX * AHEAD;
    const cz = c.z + (fwd.z / flat) * BOX * AHEAD;
    const at = new Vector3(Math.round(cx / step) * step, Math.round(c.y / step) * step, Math.round(cz / step) * step);
    // With the static cache the box stays put until the camera's box is BOX_SLACK away (its static casters drawn again then).
    if (this.cache && this.boxAt && Vector3.Distance(at, this.boxAt) < BOX_SLACK) return;
    this.boxAt = at;
    this.cache?.moved();
    this.sun.position = at.subtract(dir.scale(200));
  }

  dispose(): void {
    for (const o of this.observers) o.remove();
    for (const b of this.batches) for (const p of b.proxies) p.dispose();
    this.cache?.dispose();
    this.pipeline?.dispose();
    this.ssao?.dispose();
    this.shadows?.dispose();
  }
}

/** Into a shadow map's list, and out of it again when the mesh goes. */
function addCaster(map: RenderTargetTexture, m: AbstractMesh): void {
  map.renderList?.push(m);
  m.onDisposeObservable.addOnce(() => {
    const list = map.renderList;
    const i = list?.indexOf(m) ?? -1;
    if (list && i >= 0) list.splice(i, 1);
  });
}

/** Whether a node is one of `roots` or below one. */
function underAny(n: Node, roots: ReadonlySet<Node>): boolean {
  for (let p: Node | null = n; p; p = p.parent) if (roots.has(p)) return true;
  return false;
}
