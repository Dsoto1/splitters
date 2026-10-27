import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { DepthRenderer } from '@babylonjs/core/Rendering/depthRenderer';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { MirrorTexture } from '@babylonjs/core/Materials/Textures/mirrorTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial as StdMat } from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import { terrainHeightAt, type Liquid, type MapDocument, type Vec3, type WaterEntity, type WorldBox } from '@tiletrigger/shared';
import { loadGraphicsQuality, type GraphicsQuality } from './atmosphere.ts';

/**
 * Better liquids. Water (and swamp, and tinted water) is one small shader:
 * two scrolling normal maps for waves, a Fresnel blend of reflection over the
 * see-through (refracted) water behind it, colour and opacity by depth so
 * shallows are clear and the deep is dark, soft foam where it meets the shore
 * or anything standing in it, and a sharp sun glint. Lava and acid get a
 * flowing emissive version of the same shader (no reflection).
 *
 * Graphics quality decides the reflection and where the depth comes from:
 *   high    a planar mirror of the sky and the big static meshes at reduced
 *           resolution (the largest body of water only) and the scene's
 *           depth (so players and props wading in it get foam too);
 *   medium  the sky picture as the reflection, depth baked per vertex from
 *           the terrain and level boxes under the water (no extra passes);
 *   low     the old scrolling-ripple material.
 *
 * Splashes and ripples (players, projectiles and shots entering or moving
 * through a liquid) are two thin-instanced meshes, a few dozen instances each.
 */

const PI = Math.PI;

Effect.ShadersStore.ttLiquidVertexShader = `
precision highp float;
attribute vec3 position;
attribute float depth;
uniform mat4 world;
uniform mat4 view;
uniform mat4 viewProjection;
varying vec3 vWorld;
varying float vDepth;
varying float vViewZ;
varying vec4 vClip;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  vDepth = depth;
  vViewZ = (view * w).z;
  gl_Position = viewProjection * w;
  vClip = gl_Position;
}`;

Effect.ShadersStore.ttLiquidFragmentShader = `
precision highp float;
varying vec3 vWorld;
varying float vDepth;
varying float vViewZ;
varying vec4 vClip;
uniform vec3 eye;
uniform float time;
uniform vec3 shallowColor;
uniform vec3 deepColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 ambient;
uniform vec3 horizon;
uniform float clarity;
uniform float reflectivity;
uniform float flow;
uniform float waveScale;
uniform float foamWidth;
uniform float alphaMax;
uniform float glow;
uniform vec4 fog;
uniform vec3 fogColor;
uniform float toneMap;
uniform sampler2D waveSampler;
#ifdef SKY
uniform sampler2D skySampler;
#endif
#ifdef MIRROR
uniform sampler2D mirrorSampler;
#endif
#ifdef SCENE_DEPTH
uniform sampler2D depthSampler;
#endif

vec3 aces(vec3 x) {
  x *= 1.15;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 fogged(vec3 col) {
  if (fog.x < 0.5) return col;
  float d = length(vWorld - eye);
  float f = fog.x < 1.5 ? exp(-fog.y * d) : exp(-pow(fog.y * d, 2.0));
  return mix(fogColor, col, clamp(f, 0.0, 1.0));
}

void main(void) {
  vec2 screen = vClip.xy / vClip.w * 0.5 + 0.5;
  // How much water lies behind this point along the view ray (scene depth), or under it (baked).
  float depthHere = vDepth;
#ifdef SCENE_DEPTH
  float sceneZ = texture2D(depthSampler, screen).r;
  if (sceneZ > 0.0 && sceneZ < 3000.0) depthHere = min(depthHere * 4.0 + 0.5, max(0.0, sceneZ - vViewZ));
#endif
#ifdef EMISSIVE
  // Lava and acid: two layers of noise drifting against each other, a dark crust over glowing seams.
  vec2 p = vWorld.xz * waveScale;
  float n1 = texture2D(waveSampler, p * 0.35 + vec2(time * flow, time * flow * 0.6)).a;
  float n2 = texture2D(waveSampler, p * 0.9 - vec2(time * flow * 0.7, -time * flow * 0.45)).a;
  float heat = smoothstep(0.3, 0.9, n1 * 0.65 + n2 * 0.55);
  float pulse = 0.85 + 0.15 * sin(time * 1.7 + n1 * 6.0);
  vec3 col = mix(deepColor, shallowColor * (1.0 + glow * 1.4), heat) * pulse;
  // Seams glow brighter where the crust meets the bank.
  float edge = 1.0 - smoothstep(0.0, foamWidth, depthHere);
  col += shallowColor * edge * 0.6;
  col = fogged(col);
  if (toneMap > 0.5) col = aces(col);
  gl_FragColor = vec4(col, alphaMax);
#else
  vec2 uvA = vWorld.xz * waveScale + vec2(time * flow, time * flow * 0.7);
  vec2 uvB = vWorld.xz * waveScale * 2.3 + vec2(-time * flow * 1.3, time * flow * 0.4);
  vec3 nA = texture2D(waveSampler, uvA).xyz * 2.0 - 1.0;
  vec3 nB = texture2D(waveSampler, uvB).xyz * 2.0 - 1.0;
  vec3 n = normalize(vec3(nA.x + nB.x * 0.6, 3.2, nA.y + nB.y * 0.6));
  vec3 toEye = eye - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  bool under = eye.y < vWorld.y;
  if (under) n = -n;
  // Waves flatten out with distance (no shimmer far away).
  n = normalize(mix(n, under ? vec3(0.0, -1.0, 0.0) : vec3(0.0, 1.0, 0.0), clamp(dist / 140.0, 0.0, 0.8)));
  float cosV = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
  vec3 R = reflect(-V, n);
  vec3 refl = mix(horizon, horizon * 0.7, clamp(R.y, 0.0, 1.0));
#ifdef SKY
  float lon = atan(R.z, R.x);
  float lat = acos(clamp(R.y, -1.0, 1.0));
  refl = texture2D(skySampler, vec2(lon / ${(2 * PI).toFixed(6)} + 0.5, lat / ${PI.toFixed(6)})).rgb;
#endif
#ifdef MIRROR
  // Where the mirror drew nothing (alpha 0) the sky picture shows.
  vec4 m = texture2D(mirrorSampler, screen + n.xz * 0.035);
  refl = mix(refl, m.rgb, m.a);
#endif
  // Colour and opacity by depth: clear in the shallows, dark and opaque in the deep.
  float deep = 1.0 - exp(-depthHere / clarity);
  vec3 body = mix(shallowColor, deepColor, deep) * ambient;
  float alpha = mix(0.12, alphaMax, deep);
  vec3 col = body;
  if (under) {
    // From below, the surface is a bright, rippling ceiling (total reflection away from the window overhead).
    col = mix(horizon * 0.9, deepColor * ambient, fres);
    alpha = 0.85;
  } else {
    col = mix(body, refl, fres * reflectivity);
    alpha = mix(alpha, 1.0, fres * reflectivity);
  }
  // Sun glint: a sharp sparkle and a softer sheen.
  float sd = max(dot(R, -sunDir), 0.0);
  float spec = (pow(sd, 900.0) * 9.0 + pow(sd, 90.0) * 0.25) * reflectivity;
  col += sunColor * spec;
  alpha = max(alpha, clamp(spec, 0.0, 1.0));
  // Soft foam along the shore and round anything standing in the water.
  float shore = 1.0 - smoothstep(0.0, foamWidth, depthHere);
  float lace = texture2D(waveSampler, vWorld.xz * 0.45 + vec2(time * 0.03, -time * 0.02)).a;
  float foam = shore * smoothstep(0.55, 0.8, lace + shore * 0.45 + 0.1 * sin(time * 1.3 + vWorld.x * 0.7));
  col = mix(col, vec3(0.92, 0.95, 0.96) * ambient, foam);
  alpha = max(alpha, foam * 0.92);
  col = fogged(col);
  if (toneMap > 0.5) col = aces(col);
  gl_FragColor = vec4(col, alpha);
#endif
}`;

/** How each liquid's surface looks: clarity (m to go dark), shine, wave size and speed, foam, max opacity, glow. */
const SURFACE: Record<Liquid, { deep: number; clarity: number; reflect: number; wave: number; flow: number; foam: number; alpha: number; glow: number }> = {
  water: { deep: 0.22, clarity: 2.4, reflect: 0.85, wave: 0.16, flow: 0.02, foam: 0.45, alpha: 0.94, glow: 0 },
  swamp: { deep: 0.35, clarity: 0.6, reflect: 0.35, wave: 0.07, flow: 0.006, foam: 0.25, alpha: 0.97, glow: 0 },
  acid: { deep: 0.25, clarity: 1, reflect: 0, wave: 0.18, flow: 0.03, foam: 0.6, alpha: 0.9, glow: 0.7 },
  lava: { deep: 0.08, clarity: 1, reflect: 0, wave: 0.14, flow: 0.012, foam: 0.9, alpha: 1, glow: 1.2 },
};

/** Liquids drawn with the emissive (flowing) version of the shader. */
const EMISSIVE = new Set<Liquid>(['lava', 'acid']);

export interface LiquidSurface {
  mesh: Mesh;
  material: ShaderMaterial;
}

export class WaterVisuals {
  private waves: RawTexture | null = null;
  private readonly materials: ShaderMaterial[] = [];
  private mirror: MirrorTexture | null = null;
  private mirrorY = 0;
  private depth: DepthRenderer | null = null;
  private readonly observers: Observer<unknown>[] = [];
  private readonly start = performance.now();
  readonly fx: WaterFx;
  /** Level boxes (static map geometry) the depth under the water is baked from; set by the game view. */
  levelBoxes: readonly WorldBox[] | null = null;
  /** The map (its terrain), for baking depth. */
  map: MapDocument | null = null;

  constructor(
    private readonly scene: Scene,
    readonly quality: GraphicsQuality = loadGraphicsQuality(),
    private readonly editor = false,
  ) {
    this.fx = new WaterFx(scene);
  }

  /** Whether this liquid gets the shader (low quality keeps the old material). */
  shaded(_liquid: Liquid): boolean {
    return this.quality !== 'low';
  }

  /** The surface of one body of liquid (its root sits at the entity's position). */
  surface(name: string, e: WaterEntity, color: string): LiquidSurface {
    const [w, h, d] = e.size;
    const top = e.position[1] + h;
    // Grid fine enough to carry the baked depth: about 2 m, at most 128 × 128 cells.
    const nx = Math.max(2, Math.min(128, Math.ceil(w / 2)));
    const nz = Math.max(2, Math.min(128, Math.ceil(d / 2)));
    const positions: number[] = [];
    const depths: number[] = [];
    const indices: number[] = [];
    const ground = this.groundSampler(e);
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const lx = -w / 2 + (w * i) / nx;
        const lz = -d / 2 + (d * j) / nz;
        positions.push(lx, h - 0.03, lz);
        depths.push(Math.max(0, top - ground(e.position[0] + lx, e.position[2] + lz)));
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
    const mesh = new Mesh(`${name}_surface`, this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vd.normals = normals;
    vd.applyToMesh(mesh);
    mesh.setVerticesData('depth', depths, false, 1);
    mesh.isPickable = false;
    const material = this.material(e.liquid, color, top, w * d);
    mesh.material = material;
    mesh.onDisposeObservable.addOnce(() => {
      material.dispose();
      const k = this.materials.indexOf(material);
      if (k >= 0) this.materials.splice(k, 1);
    });
    // Transparent, sorted with the other see-through things; never in the shadow map.
    mesh.receiveShadows = false;
    return { mesh, material };
  }

  /** Height of whatever is under the water at (x, z): terrain, level boxes under the surface, else the pool's floor. */
  private groundSampler(e: WaterEntity): (x: number, z: number) => number {
    const [px, py, pz] = e.position;
    const [w, h, d] = e.size;
    const top = py + h;
    const x0 = px - w / 2;
    const x1 = px + w / 2;
    const z0 = pz - d / 2;
    const z1 = pz + d / 2;
    // Boxes over the pool's footprint that reach up into the water (or through it: the shore).
    const boxes = (this.levelBoxes ?? []).filter((b) => b.max[1] > py - 0.01 && b.min[1] < top + 0.5 && b.max[0] > x0 && b.min[0] < x1 && b.max[2] > z0 && b.min[2] < z1 && b.kind !== 'trim');
    const terrain = this.map?.terrain ?? null;
    return (x, z) => {
      let g = py;
      if (terrain) {
        const t = terrainHeightAt(terrain, x, z);
        if (t !== null) g = Math.max(g, t);
      }
      for (const b of boxes) if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2]) g = Math.max(g, Math.min(top, b.max[1]));
      return Math.min(g, top);
    };
  }

  private material(liquid: Liquid, color: string, top: number, area: number): ShaderMaterial {
    const look = SURFACE[liquid];
    const emissive = EMISSIVE.has(liquid);
    const sky = emissive ? null : this.skyTexture();
    const mirror = !emissive && !this.editor && this.quality === 'high' ? this.mirrorFor(top, area) : null;
    const sceneDepth = !this.editor && this.quality === 'high' ? this.sceneDepth() : null;
    const defines = [...(emissive ? ['#define EMISSIVE'] : []), ...(sky ? ['#define SKY'] : []), ...(mirror ? ['#define MIRROR'] : []), ...(sceneDepth ? ['#define SCENE_DEPTH'] : [])];
    const samplers = ['waveSampler', ...(sky ? ['skySampler'] : []), ...(mirror ? ['mirrorSampler'] : []), ...(sceneDepth ? ['depthSampler'] : [])];
    const m = new ShaderMaterial(`liquid_${liquid}_${this.materials.length}`, this.scene, { vertex: 'ttLiquid', fragment: 'ttLiquid' }, {
      attributes: ['position', 'depth'],
      uniforms: ['world', 'view', 'viewProjection', 'eye', 'time', 'shallowColor', 'deepColor', 'sunDir', 'sunColor', 'ambient', 'horizon', 'clarity', 'reflectivity', 'flow', 'waveScale', 'foamWidth', 'alphaMax', 'glow', 'fog', 'fogColor', 'toneMap'],
      samplers,
      defines,
      needAlphaBlending: look.alpha < 1 || !emissive,
    });
    m.backFaceCulling = false;
    const base = Color3.FromHexString(color);
    // Shallow: the liquid's own colour, lifted; deep: much darker and a little bluer (water) or browner (swamp).
    const shallow = emissive ? base : Color3.Lerp(base, new Color3(0.75, 0.9, 0.92), 0.25);
    const deep = emissive ? base.scale(look.deep) : base.scale(look.deep).add(new Color3(0, 0.02, 0.05));
    m.setColor3('shallowColor', shallow);
    m.setColor3('deepColor', deep);
    m.setFloat('clarity', look.clarity);
    m.setFloat('reflectivity', look.reflect);
    m.setFloat('flow', look.flow * 1.5);
    m.setFloat('waveScale', look.wave);
    m.setFloat('foamWidth', look.foam);
    m.setFloat('alphaMax', look.alpha);
    m.setFloat('glow', look.glow);
    m.setTexture('waveSampler', this.waveTexture());
    if (sky) m.setTexture('skySampler', sky);
    if (mirror) m.setTexture('mirrorSampler', mirror);
    if (sceneDepth) m.setTexture('depthSampler', sceneDepth.getDepthMap());
    m.onBindObservable.add(() => this.bind(m));
    this.materials.push(m);
    return m;
  }

  /** Per-frame values: time, eye, sun, ambient light, fog (the underwater haze is scene fog too). */
  private bind(m: ShaderMaterial): void {
    const scene = this.scene;
    const effect = m.getEffect();
    if (!effect) return;
    const cam = scene.activeCamera;
    if (cam) effect.setVector3('eye', cam.globalPosition);
    effect.setFloat('time', (performance.now() - this.start) / 1000);
    const sun = scene.getLightByName('sun') as DirectionalLight | null;
    const hemi = scene.getLightByName('hemi') as HemisphericLight | null;
    const dir = sun ? sun.direction.normalizeToNew() : new Vector3(-0.4, -1, 0.3).normalize();
    effect.setVector3('sunDir', dir);
    const sunI = sun?.intensity ?? 0.6;
    effect.setColor3('sunColor', (sun?.diffuse ?? Color3.White()).scale(Math.min(1.5, sunI)));
    const light = Math.min(1.4, (hemi?.intensity ?? 0.8) * 0.75 + sunI * 0.35 * Math.max(0, -dir.y));
    effect.setColor3('ambient', new Color3(light, light, light));
    const c = scene.clearColor;
    effect.setColor3('horizon', new Color3(c.r, c.g, c.b));
    effect.setFloat4('fog', scene.fogEnabled ? scene.fogMode === 2 ? 2 : scene.fogMode === 1 ? 1 : 0 : 0, scene.fogDensity, 0, 0);
    effect.setColor3('fogColor', scene.fogColor);
    // Materials do their own tone mapping unless a post-process pipeline does it for the whole frame.
    effect.setFloat('toneMap', scene.imageProcessingConfiguration.applyByPostProcess ? 0 : 1);
  }

  /** The backdrop's sky picture (equirectangular), sampled along the reflected ray. */
  private skyTexture(): BaseTexture | null {
    const sky = this.scene.getMaterialByName('backdrop_skyMat') as StandardMaterial | null;
    return sky?.reflectionTexture ?? null;
  }

  /**
   * High quality: one mirror for the biggest body of water (the others reflect
   * the sky), at reduced resolution, drawing only the sky and the big static
   * meshes (level, terrain, border, scenery past it).
   */
  private mirrorFor(top: number, area: number): MirrorTexture | null {
    if (this.mirror) return Math.abs(this.mirrorY - top) < 0.05 ? this.mirror : null;
    if (area < 64) return null;
    const mirror = new MirrorTexture('waterMirror', { ratio: 0.4 }, this.scene, false);
    mirror.mirrorPlane = new Plane(0, -1, 0, top);
    mirror.clearColor.set(0, 0, 0, 0);
    mirror.refreshRate = 1;
    // A shader material doesn't hand its render targets to the scene: render it with the frame ourselves.
    this.scene.customRenderTargets.push(mirror);
    this.mirror = mirror;
    this.mirrorY = top;
    // The level and backdrop are built before the scenario; meshes added later (the border, scenery) join on the next frame.
    let dirty = true;
    this.observers.push(this.scene.onNewMeshAddedObservable.add(() => (dirty = true)) as Observer<unknown>);
    this.observers.push(
      this.scene.onBeforeRenderObservable.add(() => {
        if (!dirty) return;
        dirty = false;
        mirror.renderList = this.scene.meshes.filter((x) => mirrorable(x));
      }) as Observer<unknown>,
    );
    return mirror;
  }

  /** High quality: the camera-space depth the height fog uses (shared with it when the map has mist). */
  private sceneDepth(): DepthRenderer | null {
    if (this.depth) return this.depth;
    const cam = this.scene.activeCamera as Camera | null;
    if (!cam) return null;
    try {
      this.depth = this.scene.enableDepthRenderer(cam, false, true, Texture.NEAREST_SAMPLINGMODE, true);
    } catch {
      this.depth = null;
    }
    return this.depth;
  }

  /**
   * A tileable 256² texture made once: RGB a wave normal map (a sum of waves
   * with whole-number frequencies, so it wraps), A a soft value noise (foam
   * lace, lava crust).
   */
  private waveTexture(): RawTexture {
    if (this.waves) return this.waves;
    const n = 256;
    const height = new Float32Array(n * n);
    const noise = new Float32Array(n * n);
    const waves: [number, number, number, number][] = [
      [3, 1, 1, 0.3],
      [-2, 3, 0.7, 1.1],
      [5, -4, 0.35, 2.3],
      [1, 6, 0.3, 0.7],
      [-7, -2, 0.2, 4.1],
      [9, 5, 0.12, 5.2],
      [-4, 11, 0.1, 1.9],
    ];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = (x / n) * PI * 2;
        const v = (y / n) * PI * 2;
        let h = 0;
        for (const [a, b, amp, ph] of waves) h += amp * Math.sin(a * u + b * v + ph);
        height[y * n + x] = h;
      }
    }
    // Value noise on a 16-cell lattice (wraps), two octaves.
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const lattice = (cells: number) => Array.from({ length: cells * cells }, rnd);
    const sample = (g: number[], cells: number, x: number, y: number) => {
      const fx = (x / n) * cells;
      const fy = (y / n) * cells;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const at = (i: number, j: number) => g[((j % cells) * cells + (i % cells)) % g.length]!;
      const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
      const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
      return a + (b - a) * sy;
    };
    const g8 = lattice(8);
    const g16 = lattice(16);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) noise[y * n + x] = sample(g8, 8, x, y) * 0.65 + sample(g16, 16, x, y) * 0.35;
    const px = new Uint8Array(n * n * 4);
    const hAt = (x: number, y: number) => height[((y + n) % n) * n + ((x + n) % n)]!;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * 2.2;
        const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * 2.2;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * n + x) * 4;
        px[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
        px[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
        px[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
        px[i + 3] = Math.round(Math.max(0, Math.min(1, noise[y * n + x]!)) * 255);
      }
    }
    const tex = RawTexture.CreateRGBATexture(px, n, n, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    this.waves = tex;
    return tex;
  }

  /** Every liquid's mesh (automation and measurements). */
  surfaces(): Mesh[] {
    return this.scene.meshes.filter((m): m is Mesh => m instanceof Mesh && m.material instanceof ShaderMaterial && m.material.name.startsWith('liquid_'));
  }

  /** Whether the high-quality mirror is in use (automation). */
  get mirrored(): boolean {
    return !!this.mirror;
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    if (this.mirror) {
      const k = this.scene.customRenderTargets.indexOf(this.mirror);
      if (k >= 0) this.scene.customRenderTargets.splice(k, 1);
      this.mirror.dispose();
    }
    this.mirror = null;
    for (const o of this.observers) o.remove();
    this.observers.length = 0;
    this.waves?.dispose();
    this.waves = null;
    this.fx.dispose();
  }
}

/** Big static meshes worth reflecting: the level, the terrain, the border and the backdrop (sky included). */
function mirrorable(m: AbstractMesh): boolean {
  if (!(m.name.startsWith('map_') || m.name.startsWith('backdrop_') || m.name.startsWith('border_'))) return false;
  if (m.isDisposed() || m.getTotalVertices() === 0) return false;
  // Foliage and other scattered thin instances stay out.
  if ((m as Mesh).thinInstanceCount > 0) return false;
  const mat = m.material as { alpha?: number } | null;
  return !(mat && mat.alpha !== undefined && mat.alpha < 0.99);
}

// ---------------------------------------------------------------- splashes and ripples

interface Ring {
  at: Vec3;
  born: number;
  life: number;
  size: number;
}
interface Drop {
  p: Vec3;
  v: Vec3;
  born: number;
  life: number;
  floor: number;
}

const MAX_RINGS = 48;
const MAX_DROPS = 160;

/**
 * Cheap splash particles: rings spreading on the surface and droplets thrown
 * up, each kind one thin-instanced mesh (one draw call), recycled.
 */
export class WaterFx {
  private rings: Ring[] = [];
  private drops: Drop[] = [];
  private ringMesh: Mesh | null = null;
  private dropMesh: Mesh | null = null;
  private ringBuf = new Float32Array(MAX_RINGS * 16);
  private dropBuf = new Float32Array(MAX_DROPS * 16);
  private observer: Observer<Scene> | null = null;
  /** Bodies and projectiles last frame: where they were and whether they were in a liquid. */
  private readonly bodies = new Map<number, { y: number; x: number; z: number; ripple: number; inside: boolean }>();
  private readonly shells = new Map<number, { p: Vec3; inside: boolean }>();
  /** Liquids as boxes (top = max.y), set with the map. */
  liquids: readonly { min: Vec3; max: Vec3; liquid: Liquid }[] = [];
  /** A splash worth hearing (someone or something going in). */
  onSplash: ((at: Vec3, big: boolean) => void) | null = null;

  constructor(private readonly scene: Scene) {}

  private ensure(): void {
    if (this.ringMesh || this.scene.isDisposed) return;
    const ring = CreateDisc('waterfx_rings', { radius: 0.5, tessellation: 24 }, this.scene);
    ring.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, PI / 2, 0);
    ring.bakeCurrentTransformIntoVertices();
    const rm = new StdMat('waterfx_ringMat', this.scene);
    rm.diffuseColor = new Color3(0.85, 0.93, 0.95);
    rm.emissiveColor = new Color3(0.35, 0.4, 0.42);
    rm.specularColor = Color3.Black();
    rm.opacityTexture = ringTexture(this.scene);
    rm.opacityTexture.getAlphaFromRGB = true;
    rm.alpha = 0.75;
    rm.backFaceCulling = false;
    rm.disableDepthWrite = true;
    ring.material = rm;
    ring.isPickable = false;
    ring.thinInstanceSetBuffer('matrix', this.ringBuf, 16, false);
    ring.thinInstanceCount = 0;
    ring.alwaysSelectAsActiveMesh = true;
    const drop = CreateBox('waterfx_drops', { size: 0.07 }, this.scene);
    const dm = new StdMat('waterfx_dropMat', this.scene);
    dm.diffuseColor = new Color3(0.8, 0.9, 0.95);
    dm.emissiveColor = new Color3(0.35, 0.4, 0.45);
    dm.specularColor = new Color3(0.9, 0.9, 0.9);
    dm.alpha = 0.8;
    drop.material = dm;
    drop.isPickable = false;
    drop.thinInstanceSetBuffer('matrix', this.dropBuf, 16, false);
    drop.thinInstanceCount = 0;
    drop.alwaysSelectAsActiveMesh = true;
    this.ringMesh = ring;
    this.dropMesh = drop;
    this.observer = this.scene.onBeforeRenderObservable.add(() => this.step());
  }

  private surfaceAt(p: Vec3): { top: number; liquid: Liquid } | null {
    for (const l of this.liquids) if (p.x >= l.min.x && p.x <= l.max.x && p.z >= l.min.z && p.z <= l.max.z && p.y <= l.max.y + 0.05 && p.y >= l.min.y - 0.5) return { top: l.max.y, liquid: l.liquid };
    return null;
  }

  /** A splash at a point on a surface: a ring (or two) and droplets thrown up. */
  splash(at: Vec3, strength: number, liquid: Liquid = 'water'): void {
    this.ensure();
    const now = performance.now();
    if (liquid !== 'lava') {
      this.addRing({ at, born: now, life: 900 + strength * 500, size: 1.2 + strength * 2.4 });
      if (strength > 0.6) this.addRing({ at, born: now + 120, life: 1100, size: 0.8 + strength * 1.6 });
    }
    const count = Math.round(3 + strength * 12);
    for (let k = 0; k < count; k++) {
      const a = Math.random() * PI * 2;
      const s = (0.6 + Math.random() * 1.6) * (0.5 + strength);
      this.addDrop({ p: { ...at }, v: { x: Math.cos(a) * s * 0.6, y: 2 + Math.random() * 3 * (0.4 + strength), z: Math.sin(a) * s * 0.6 }, born: now, life: 900, floor: at.y });
    }
  }

  /** A small ring where something moves through the surface. */
  ripple(at: Vec3, size = 1.4): void {
    this.ensure();
    this.addRing({ at, born: performance.now(), life: 1200, size });
  }

  private addRing(r: Ring): void {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push(r);
  }

  private addDrop(d: Drop): void {
    if (this.drops.length >= MAX_DROPS) this.drops.shift();
    this.drops.push(d);
  }

  /**
   * Bodies (players, NPCs) and projectiles this frame: going in makes a
   * splash, wading or swimming at the surface leaves ripples.
   */
  track(bodies: readonly { slot: number; x: number; y: number; z: number }[], projectiles: ReadonlyMap<number, readonly [number, number, number, number]>): void {
    if (!this.liquids.length) return;
    const now = performance.now();
    const seen = new Set<number>();
    for (const b of bodies) {
      seen.add(b.slot);
      const s = this.surfaceAt({ x: b.x, y: b.y, z: b.z });
      const inside = !!s && b.y < s.top;
      const last = this.bodies.get(b.slot);
      if (!last) {
        this.bodies.set(b.slot, { x: b.x, y: b.y, z: b.z, ripple: now, inside });
        continue;
      }
      if (s && inside && !last.inside && Math.hypot(b.x - last.x, b.z - last.z) < 6) {
        const fall = Math.max(0, last.y - b.y);
        this.splash({ x: b.x, y: s.top + 0.02, z: b.z }, Math.min(1, 0.4 + fall * 0.8), s.liquid);
        this.onSplash?.({ x: b.x, y: s.top, z: b.z }, true);
      } else if (s && inside && b.y > s.top - 1.7 && now - last.ripple > 380 && Math.hypot(b.x - last.x, b.z - last.z) > 0.05) {
        this.ripple({ x: b.x, y: s.top + 0.02, z: b.z }, 1.2);
        last.ripple = now;
      }
      Object.assign(last, { x: b.x, y: b.y, z: b.z, inside });
    }
    for (const k of [...this.bodies.keys()]) if (!seen.has(k)) this.bodies.delete(k);
    const live = new Set<number>();
    for (const [id, p] of projectiles) {
      live.add(id);
      const at = { x: p[0], y: p[1], z: p[2] };
      const s = this.surfaceAt(at);
      const inside = !!s && at.y < s.top;
      const last = this.shells.get(id);
      if (last && s && inside && !last.inside) {
        this.splash({ x: at.x, y: s.top + 0.02, z: at.z }, 0.45, s.liquid);
        this.onSplash?.({ x: at.x, y: s.top, z: at.z }, false);
      }
      this.shells.set(id, { p: at, inside });
    }
    for (const k of [...this.shells.keys()]) if (!live.has(k)) this.shells.delete(k);
  }

  /** A hitscan shot from `from` to `to`: where it crosses a liquid's surface, a little splash. */
  shot(from: Vec3, to: Vec3): void {
    if (!this.liquids.length || from.y === to.y) return;
    for (const l of this.liquids) {
      const top = l.max.y;
      if ((from.y - top) * (to.y - top) >= 0) continue;
      const t = (from.y - top) / (from.y - to.y);
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      if (x < l.min.x || x > l.max.x || z < l.min.z || z > l.max.z) continue;
      this.splash({ x, y: top + 0.02, z }, 0.15, l.liquid);
      return;
    }
  }

  private step(): void {
    const now = performance.now();
    const dt = Math.min(0.05, this.scene.getEngine().getDeltaTime() / 1000);
    this.rings = this.rings.filter((r) => now - r.born < r.life);
    this.drops = this.drops.filter((d) => now - d.born < d.life && d.p.y >= d.floor - 0.05);
    const m = new Matrix();
    let n = 0;
    for (const r of this.rings) {
      const f = Math.max(0, (now - r.born) / r.life);
      // Not started yet (a second, later ring): hidden.
      const s = now < r.born ? 0 : r.size * (0.25 + f * 0.9);
      Matrix.ComposeToRef(new Vector3(s, 1, s), Quaternion.Identity(), new Vector3(r.at.x, r.at.y, r.at.z), m);
      m.copyToArray(this.ringBuf, n++ * 16);
    }
    if (this.ringMesh) {
      this.ringMesh.thinInstanceCount = n;
      if (n) this.ringMesh.thinInstanceBufferUpdated('matrix');
      (this.ringMesh.material as StdMat).alpha = 0.7;
    }
    n = 0;
    for (const d of this.drops) {
      d.v.y -= 9.8 * dt;
      d.p.x += d.v.x * dt;
      d.p.y += d.v.y * dt;
      d.p.z += d.v.z * dt;
      const f = (now - d.born) / d.life;
      const s = Math.max(0.2, 1 - f);
      Matrix.ComposeToRef(new Vector3(s, s * 1.6, s), Quaternion.Identity(), new Vector3(d.p.x, d.p.y, d.p.z), m);
      m.copyToArray(this.dropBuf, n++ * 16);
    }
    if (this.dropMesh) {
      this.dropMesh.thinInstanceCount = n;
      if (n) this.dropMesh.thinInstanceBufferUpdated('matrix');
    }
  }

  /** Live particles (automation). */
  get active(): number {
    return this.rings.length + this.drops.length;
  }

  dispose(): void {
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.ringMesh?.material?.dispose();
    this.ringMesh?.dispose();
    this.dropMesh?.material?.dispose();
    this.dropMesh?.dispose();
    this.ringMesh = this.dropMesh = null;
    this.rings = [];
    this.drops = [];
    this.bodies.clear();
    this.shells.clear();
  }
}

/** A soft ring (white edge, clear middle), made once per scene. */
function ringTexture(scene: Scene): RawTexture {
  const n = 64;
  const px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const v = Math.max(0, 1 - Math.abs(r - 0.82) / 0.12) * (r < 1 ? 1 : 0);
      const i = (y * n + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = Math.round(v * 255);
      px[i + 3] = 255;
    }
  }
  return RawTexture.CreateRGBATexture(px, n, n, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
}
