import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import type { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';

/**
 * Static shadow cache (docs/PERF_96.md, "Performance round 2"): the static casters (the shadow proxies: the level,
 * terrain, roads and props merged per 48 m square, shadowProxy.ts) are drawn into a cascade only when that cascade
 * moves, and kept in a copy of its depth; every other frame the cascade starts from that copy and only the moving
 * casters (characters, held guns, doors, pickups, debris) are drawn on top.
 *
 * A cascade's square stays put (its matrices are kept) while the part of the view it serves still fits inside it: each
 * square is made CASCADE_MARGIN bigger than the view slice needs, and it moves (and its static casters are drawn again)
 * when the slice's centre has moved further than that margin, when the sun turns, when the static casters change, and
 * at least every REFRESH_FRAMES frames. The squares are snapped to their texels (stabilised cascades), so a square that
 * moves lands on the same texel grid: static shadows don't swim when it does.
 *
 * WebGL2 only (the copy is a depth blit between framebuffers); elsewhere the shadow map draws everything every frame as
 * before.
 */

/** Each cascade's square is this much bigger (of its radius) than its view slice needs: room to move before a redraw. */
export const CASCADE_MARGIN = [0.25, 0.15, 0.12] as const;
/** A cascade's static casters are drawn again at least this often (frames), staggered by cascade. */
export const REFRESH_FRAMES = 30;
/** Medium graphics' single box (half-size 45 m) moves when the camera's wanted box is this far (m) from the drawn one. */
export const BOX_SLACK = 6;

/** A cascade's square: its centre and radius (world metres). */
export interface CascadeSphere {
  x: number;
  y: number;
  z: number;
  r: number;
}

/**
 * Whether a cached square (`cached`, already grown by its margin) still holds the view slice `fresh` (not grown): the
 * slice's sphere lies inside the cached one.
 */
export function cascadeHolds(cached: CascadeSphere, fresh: CascadeSphere): boolean {
  return Math.hypot(fresh.x - cached.x, fresh.y - cached.y, fresh.z - cached.z) + fresh.r <= cached.r + 1e-6;
}

/** Whether cascade `layer` is due its every-REFRESH_FRAMES redraw at frame `frame` (spread over frames by cascade). */
export function refreshDue(frame: number, layer: number, last: number): boolean {
  return frame < last || frame - last >= REFRESH_FRAMES + ((layer * 7) % 11);
}

interface CascadeState {
  sphere: CascadeSphere;
  view: Matrix;
  proj: Matrix;
  transform: Matrix;
  min: Vector3;
  max: Vector3;
  center: Vector3;
  cameraPos: Vector3;
  array: Float32Array;
  light: Vector3;
  /** Frame the static casters were last drawn into this cascade. */
  drawn: number;
}

/** The private parts of Babylon's cascaded generator the cache keeps and puts back (Babylon 9.x). */
interface CsmInternals {
  _computeMatrices(): void;
  _computeCascadeFrustum(i: number): void;
  _viewMatrices: Matrix[];
  _projectionMatrices: Matrix[];
  _transformMatrices: Matrix[];
  _cascadeMinExtents: Vector3[];
  _cascadeMaxExtents: Vector3[];
  _frustumCenter: Vector3[];
  _shadowCameraPos: Vector3[];
  _transformMatricesAsArray: Float32Array;
  _lightDirection: Vector3;
  _currentLayer: number;
  numCascades: number;
}

interface GeneratorInternals {
  _renderForShadowMap(opaque: SubList, alphaTest: SubList, transparent: SubList, depthOnly: SubList): void;
}

interface SubList {
  data: SubMesh[];
  length: number;
}

interface RenderTargetInternals {
  _depthStencilTexture: { format: number; _hardwareTexture?: { underlyingResource: WebGLTexture } } | null;
  _depthStencilTextureWithStencil?: boolean;
}

interface EngineInternals {
  _gl?: WebGL2RenderingContext;
  webGLVersion?: number;
  isWebGPU?: boolean;
  _getInternalFormatFromDepthTextureFormat(format: number, hasDepth: boolean, hasStencil: boolean): number;
}

/** Depth copies between a shadow map's depth texture and a cache texture of the same format, one layer at a time. */
class DepthCopy {
  private readonly fbos: WebGLFramebuffer[] = [];
  private readonly mask: number;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly texture: WebGLTexture,
    layers: number,
    private readonly size: number,
    array: boolean,
    stencil: boolean,
  ) {
    this.mask = gl.DEPTH_BUFFER_BIT | (stencil ? gl.STENCIL_BUFFER_BIT : 0);
    const attachment = stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
    const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    for (let i = 0; i < layers; i++) {
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      if (array) gl.framebufferTextureLayer(gl.FRAMEBUFFER, attachment, texture, 0, i);
      else gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      this.fbos.push(fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
  }

  /** A cache for the depth texture of `rt` (null when it can't be made: then nothing is cached). */
  static create(engine: EngineInternals, rt: RenderTargetInternals, layers: number, size: number): DepthCopy | null {
    const gl = engine._gl;
    const depth = rt._depthStencilTexture;
    if (!gl || engine.isWebGPU || (engine.webGLVersion ?? 1) < 2 || !depth?._hardwareTexture) return null;
    const stencil = !!rt._depthStencilTextureWithStencil;
    const array = layers > 1;
    const target = array ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    const prevTex = gl.getParameter(array ? gl.TEXTURE_BINDING_2D_ARRAY : gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    const tex = gl.createTexture();
    if (!tex) return null;
    try {
      gl.bindTexture(target, tex);
      const internal = engine._getInternalFormatFromDepthTextureFormat(depth.format, true, stencil);
      if (array) gl.texStorage3D(target, 1, internal, size, size, layers);
      else gl.texStorage2D(target, 1, internal, size, size);
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } finally {
      gl.bindTexture(target, prevTex);
    }
    const copy = new DepthCopy(gl, tex, layers, size, array, stencil);
    if (!copy.complete()) {
      copy.dispose();
      return null;
    }
    return copy;
  }

  private complete(): boolean {
    const gl = this.gl;
    const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    let ok = true;
    for (const f of this.fbos) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ok = false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
    return ok;
  }

  /** The bound shadow map layer's depth into the cache (`toCache`), or the cache's into it. */
  copy(layer: number, toCache: boolean): void {
    const gl = this.gl;
    const fbo = this.fbos[layer];
    if (!fbo) return;
    const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const draw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    if (toCache) gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    else gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
    const s = this.size;
    gl.blitFramebuffer(0, 0, s, s, 0, 0, s, s, this.mask, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
  }

  dispose(): void {
    for (const f of this.fbos) this.gl.deleteFramebuffer(f);
    this.fbos.length = 0;
    this.gl.deleteTexture(this.texture);
  }
}

const emptyList = (): SubList => ({ data: [], length: 0 });

/** Is this a static caster (drawn into the cache, not every frame)? */
export const isStaticCaster = (m: AbstractMesh): boolean => (m.metadata as { shadowProxy?: boolean } | null)?.shadowProxy === true;

export class ShadowCache {
  /** Per layer: draw the static casters this frame. */
  private readonly redraw: boolean[];
  /** Per layer: the static casters were drawn and copied this frame. */
  private readonly copied: boolean[];
  private readonly states: (CascadeState | null)[];
  private frame = 0;
  private dirtyAll = true;
  /** Static draws this run (the perf probe): how many layer redraws, of how many layer renders. */
  readonly stats = { redraws: 0, renders: 0 };
  private readonly lists = { s: [emptyList(), emptyList(), emptyList(), emptyList()], d: [emptyList(), emptyList(), emptyList(), emptyList()] };
  private readonly disposers: (() => void)[] = [];

  private constructor(
    private readonly scene: Scene,
    private readonly gen: ShadowGenerator,
    private readonly csm: CsmInternals | null,
    private readonly depth: DepthCopy,
    private readonly layers: number,
  ) {
    this.redraw = new Array<boolean>(layers).fill(true);
    this.copied = new Array<boolean>(layers).fill(false);
    this.states = new Array<CascadeState | null>(layers).fill(null);
    this.install();
  }

  /** A cache for `gen` (the cascaded one on high, the single box on medium), or null where it can't run (WebGPU, WebGL1). */
  static attach(scene: Scene, gen: ShadowGenerator, csm: CascadedShadowGenerator | null): ShadowCache | null {
    const map = gen.getShadowMap();
    const rt = map?.renderTarget as unknown as RenderTargetInternals | null;
    if (!map || !rt) return null;
    const layers = csm ? csm.numCascades : 1;
    const depth = DepthCopy.create(scene.getEngine() as unknown as EngineInternals, rt, layers, map.getSize().width);
    if (!depth) return null;
    return new ShadowCache(scene, gen, csm as unknown as CsmInternals | null, depth, layers);
  }

  /** The layer being drawn now. */
  private get layer(): number {
    return this.csm ? (this.csm._currentLayer ?? 0) : 0;
  }

  /** Whether layer `layer` draws its static casters this frame (else they come from the cache). */
  drawsStatic(layer: number): boolean {
    return this.redraw[layer] ?? true;
  }

  /** The static casters changed (a batch of proxies built or rebuilt): every layer draws them again. */
  invalidate(): void {
    this.dirtyAll = true;
  }

  /** Medium graphics: the box moved this frame (its static casters are drawn again). */
  moved(): void {
    this.dirtyAll = true;
  }

  private install(): void {
    const gen = this.gen as unknown as GeneratorInternals;
    const map = this.gen.getShadowMap()!;
    // Each frame, before the layers: which layers draw their static casters (and, on high, keep or move their squares).
    const bind = map.onBeforeBindObservable.add(() => this.beginFrame());
    // Bound layer just cleared: start it from the cached static depth (a layer that redraws starts empty).
    const clear = map.onClearObservable.add(() => {
      const L = this.layer;
      this.stats.renders++;
      this.copied[L] = false;
      if (!this.redraw[L]) this.depth.copy(L, false);
      else this.stats.redraws++;
    });
    // A layer that redraws: static casters first, then their depth into the cache, then the moving ones.
    const render = gen._renderForShadowMap.bind(gen);
    gen._renderForShadowMap = (opaque, alphaTest, transparent, depthOnly) => {
      const L = this.layer;
      if (!this.redraw[L] || this.copied[L]) return render(opaque, alphaTest, transparent, depthOnly);
      const { s, d } = this.lists;
      split(opaque, s[0]!, d[0]!);
      split(alphaTest, s[1]!, d[1]!);
      split(transparent, s[2]!, d[2]!);
      split(depthOnly, s[3]!, d[3]!);
      render(s[0]!, s[1]!, s[2]!, s[3]!);
      this.depth.copy(L, true);
      this.copied[L] = true;
      render(d[0]!, d[1]!, d[2]!, d[3]!);
      for (const l of [...s, ...d]) {
        l.data.length = 0;
        l.length = 0;
      }
    };
    // A redrawn layer that had nothing to draw at all: its (empty) depth is still the cache's.
    const after = map.onAfterRenderObservable.add(() => {
      const L = this.layer;
      if (this.redraw[L] && !this.copied[L]) {
        this.depth.copy(L, true);
        this.copied[L] = true;
      }
    });
    this.disposers.push(() => {
      map.onBeforeBindObservable.remove(bind);
      map.onClearObservable.remove(clear);
      map.onAfterRenderObservable.remove(after);
      gen._renderForShadowMap = render;
    });
    const csm = this.csm;
    if (csm) {
      // Grow each cascade's square by its margin, as it is worked out.
      const frustum = csm._computeCascadeFrustum.bind(csm);
      csm._computeCascadeFrustum = (i: number) => {
        frustum(i);
        const k = 1 + (CASCADE_MARGIN[i] ?? CASCADE_MARGIN[CASCADE_MARGIN.length - 1]!);
        csm._cascadeMinExtents[i]!.scaleInPlace(k);
        csm._cascadeMaxExtents[i]!.scaleInPlace(k);
      };
      // Work the squares out as before, then keep each cascade's last square while it still holds its view slice.
      const compute = csm._computeMatrices.bind(csm);
      csm._computeMatrices = () => {
        compute();
        this.keepSquares();
      };
      this.disposers.push(() => {
        csm._computeCascadeFrustum = frustum;
        csm._computeMatrices = compute;
      });
    }
  }

  /** Before the layers each frame: which draw their static casters. */
  private beginFrame(): void {
    this.frame++;
    if (this.csm) return; // keepSquares (inside the matrices' update, after this) decides per cascade.
    const st = this.states[0];
    const due = this.dirtyAll || !st || refreshDue(this.frame, 0, st.drawn);
    this.redraw[0] = due;
    if (due) {
      this.dirtyAll = false;
      this.states[0] = { ...(st ?? blankState()), drawn: this.frame };
    }
  }

  /** High graphics: per cascade, keep last frame's square (and its cached static depth) or take the new one. */
  private keepSquares(): void {
    const csm = this.csm!;
    const all = this.dirtyAll;
    this.dirtyAll = false;
    for (let i = 0; i < this.layers; i++) {
      const center = csm._frustumCenter[i]!;
      const grown = csm._cascadeMaxExtents[i]!.x;
      const k = 1 + (CASCADE_MARGIN[i] ?? CASCADE_MARGIN[CASCADE_MARGIN.length - 1]!);
      const fresh: CascadeSphere = { x: center.x, y: center.y, z: center.z, r: grown / k };
      const st = this.states[i];
      const keep =
        !all &&
        !!st &&
        Vector3.DistanceSquared(st.light, csm._lightDirection) < 1e-10 &&
        cascadeHolds(st.sphere, fresh) &&
        !refreshDue(this.frame, i, st.drawn);
      this.redraw[i] = !keep;
      if (keep) this.restore(i, st);
      else this.states[i] = this.snapshot(i, { x: fresh.x, y: fresh.y, z: fresh.z, r: grown }, st ?? null);
    }
  }

  private snapshot(i: number, sphere: CascadeSphere, reuse: CascadeState | null): CascadeState {
    const csm = this.csm!;
    const st = reuse ?? blankState();
    st.sphere = sphere;
    st.view.copyFrom(csm._viewMatrices[i]!);
    st.proj.copyFrom(csm._projectionMatrices[i]!);
    st.transform.copyFrom(csm._transformMatrices[i]!);
    st.min.copyFrom(csm._cascadeMinExtents[i]!);
    st.max.copyFrom(csm._cascadeMaxExtents[i]!);
    st.center.copyFrom(csm._frustumCenter[i]!);
    st.cameraPos.copyFrom(csm._shadowCameraPos[i]!);
    st.array.set(csm._transformMatricesAsArray.subarray(i * 16, i * 16 + 16));
    st.light.copyFrom(csm._lightDirection);
    st.drawn = this.frame;
    return st;
  }

  private restore(i: number, st: CascadeState): void {
    const csm = this.csm!;
    csm._viewMatrices[i]!.copyFrom(st.view);
    csm._projectionMatrices[i]!.copyFrom(st.proj);
    csm._transformMatrices[i]!.copyFrom(st.transform);
    csm._cascadeMinExtents[i]!.copyFrom(st.min);
    csm._cascadeMaxExtents[i]!.copyFrom(st.max);
    csm._frustumCenter[i]!.copyFrom(st.center);
    csm._shadowCameraPos[i]!.copyFrom(st.cameraPos);
    csm._transformMatricesAsArray.set(st.array, i * 16);
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
    this.depth.dispose();
    void this.scene;
  }
}

function blankState(): CascadeState {
  return {
    sphere: { x: 0, y: 0, z: 0, r: 0 },
    view: Matrix.Identity(),
    proj: Matrix.Identity(),
    transform: Matrix.Identity(),
    min: new Vector3(),
    max: new Vector3(),
    center: new Vector3(),
    cameraPos: new Vector3(),
    array: new Float32Array(16),
    light: new Vector3(),
    drawn: 0,
  };
}

/** Sort a rendering list's submeshes into static casters (`s`) and the rest (`d`). */
function split(from: SubList, s: SubList, d: SubList): void {
  s.length = 0;
  d.length = 0;
  for (let i = 0; i < from.length; i++) {
    const sub = from.data[i]!;
    const to = isStaticCaster(sub.getRenderingMesh()) ? s : d;
    to.data[to.length++] = sub;
  }
}
