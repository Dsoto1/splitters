import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { Observer } from '@babylonjs/core/Misc/observable';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { PostProcess } from '@babylonjs/core/PostProcesses/postProcess';
import { VolumetricLightScatteringPostProcess } from '@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess';
import type { DepthRenderer } from '@babylonjs/core/Rendering/depthRenderer';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import type { Backdrop, MapDocument, SkyDefinition } from '@tiletrigger/shared';
import type { GraphicsQuality } from './atmosphere.ts';
import { markWholeSceneDepth } from './sceneDepth.ts';
import { perfOn } from './perfSwitches.ts';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';

/**
 * Height fog: haze along each view ray that is thickest at the ground and thins
 * with height (an exact integral of density e^(-k·height) along the ray), so
 * mist pools in valleys and ditches and hilltops stand clear of it. A screen
 * pass over the camera-space depth, so it works on every material.
 */
Effect.ShadersStore.heightFogFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform mat4 invViewProj;
uniform vec3 camPos;
uniform vec3 camForward;
uniform vec3 fogColor;
uniform float density;
uniform float baseY;
uniform float falloff;
uniform float maxFog;
void main(void) {
  vec4 color = texture2D(textureSampler, vUV);
  float viewZ = texture2D(depthSampler, vUV).r;
  vec4 far = invViewProj * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - camPos);
  // Nothing drawn here (the sky): fog it as if the ground went on a long way, so the horizon blends.
  float dist = viewZ > 5000.0 || viewZ <= 0.0 ? 600.0 : viewZ / max(dot(dir, camForward), 0.05);
  float dy = dir.y * dist;
  float k = falloff * dy;
  float along = abs(k) > 1e-4 ? (1.0 - exp(-k)) / k : 1.0;
  float amount = density * exp(-falloff * (camPos.y - baseY)) * dist * along;
  float f = clamp(1.0 - exp(-amount), 0.0, maxFog);
  gl_FragColor = vec4(mix(color.rgb, fogColor, f), color.a);
}`;

/** Babylon's pre-pass texture of camera-space depth (Constants.PREPASS_DEPTH_TEXTURE_TYPE: view z, as the fog wants). */
const PREPASS_DEPTH = 5;

interface PrePass {
  enabled: boolean;
  getIndex(type: number): number;
  getRenderTarget(): { textures?: BaseTexture[] } | null;
}

/** The scene's pre-pass renderer (SSAO2 on high turns it on), or null. */
function prePass(scene: Scene): PrePass | null {
  return (scene as unknown as { prePassRenderer?: PrePass | null }).prePassRenderer ?? null;
}

/** The pre-pass's camera-space depth texture this frame, or null when it writes none. */
export function prePassDepth(scene: Scene): BaseTexture | null {
  const pp = prePass(scene);
  if (!pp?.enabled) return null;
  const i = pp.getIndex(PREPASS_DEPTH);
  return i >= 0 ? (pp.getRenderTarget()?.textures?.[i] ?? null) : null;
}

/** Skies the sun shines through brightly enough for shafts of light. */
const SUNNY = new Set(['clear', 'cloudy', 'sunrise', 'sunset', 'dusk', 'misty', 'snowy']);

/**
 * Ground mist (a map's backdrop `mist`: height fog on high graphics, thicker distance fog on medium) and light
 * shafts from the sun through gaps and foliage (high graphics, sunny skies).
 */
/** Things at least this big (bounding radius, m) block the sun's shafts. */
const OCCLUDER_RADIUS = 2;
/** How often the shafts' occluders are gathered again (ms). */
const OCCLUDER_REFRESH_MS = 2000;
/** The sun's disc: its size and how far out along the way to the sun it rides (m). */
const SUN_DIAMETER = 36;
const SUN_DISTANCE = 900;
/**
 * Half-angle (radians) of the cone from the camera to the sun inside which an occluder can hide the disc: the disc's
 * own (its radius over its distance, about 1.1 degrees) twice over, and the half-size pass's pixels (a few
 * thousandths): generous, as a false "covers" only costs a draw.
 */
const SUN_CONE = (2 * (SUN_DIAMETER / 2)) / SUN_DISTANCE + 0.01;
const SUN_CONE_TAN = Math.tan(SUN_CONE);
const SUN_CONE_COS = Math.cos(SUN_CONE);

/** Whether a mesh's bounding sphere reaches the cone from `eye` along `toSun` (unit), SUN_CONE wide. */
export function coversSun(m: AbstractMesh, eye: Vector3, toSun: Vector3): boolean {
  const b = m.getBoundingInfo().boundingSphere;
  const c = b.centerWorld;
  const r = b.radiusWorld;
  const vx = c.x - eye.x;
  const vy = c.y - eye.y;
  const vz = c.z - eye.z;
  const t = vx * toSun.x + vy * toSun.y + vz * toSun.z;
  if (t < -r) return false;
  const off = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t));
  return off <= Math.max(t, 0) * SUN_CONE_TAN + r / SUN_CONE_COS;
}
/**
 * Margin (radians) past the view's corner within which the sun counts as in view: the disc's own size (about a degree)
 * and a fast turn between this frame's test and the camera the pass draws with.
 */
const SUN_VIEW_MARGIN = 0.35;

/**
 * Whether the sun (the direction `toSun`, unit) may be in the camera's view: within the view's corner half-angle
 * (vertical field of view and aspect) plus SUN_VIEW_MARGIN of where the camera looks. Generous on purpose: a false
 * "in view" only costs the pass's draws; a false "out of view" would lose shafts.
 */
export function sunInView(camera: Camera, toSun: Vector3): boolean {
  const engine = camera.getEngine();
  const aspect = engine.getAspectRatio(camera);
  const vertical = camera.fovMode === 0 ? camera.fov : 2 * Math.atan(Math.tan(camera.fov / 2) / Math.max(aspect, 1e-3));
  const t = Math.tan(vertical / 2);
  const corner = Math.atan(t * Math.sqrt(1 + aspect * aspect));
  const forward = camera.getDirection(Vector3.Forward());
  const cos = Vector3.Dot(forward, toSun) / Math.max(forward.length(), 1e-6);
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= corner + SUN_VIEW_MARGIN;
}

export class SkyEffects {
  private fog: PostProcess | null = null;
  private depth: DepthRenderer | null = null;
  private rays: VolumetricLightScatteringPostProcess | null = null;
  private observer: Observer<Scene> | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly camera: Camera,
    private readonly quality: GraphicsQuality,
  ) {}

  apply(doc: MapDocument, backdrop: Backdrop, sky: SkyDefinition): void {
    this.dispose();
    if (this.quality === 'low') return;
    const mist = backdrop.mist ?? 0;
    if (mist > 0 && sky.id !== 'space') {
      if (this.quality === 'high') this.addFog(doc, mist, Color3.FromHexString(sky.horizon));
      else this.foldMist(mist, Color3.FromHexString(sky.horizon));
    }
    if (this.quality === 'high' && SUNNY.has(sky.id) && sky.light.elevation < 75) this.addRays(sky);
  }

  dispose(): void {
    this.fog?.dispose(this.camera);
    if (this.rays) {
      this.rays.mesh.material?.dispose();
      this.rays.mesh.dispose();
      this.rays.dispose(this.camera);
    }
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    if (this.depth) this.scene.disableDepthRenderer(this.camera);
    this.fog = this.rays = this.depth = null;
    this.observer = null;
  }

  /**
   * Medium: the mist thickens the scene's own distance fog, worked out in each material as it draws.
   * The height fog needs the scene's depth, and drawing that took a second pass over the whole scene
   * every frame (hundreds of draw calls in a city map).
   */
  private foldMist(mist: number, color: Color3): void {
    if (this.scene.fogMode !== 2 || this.scene.fogDensity === 0) {
      this.scene.fogMode = 2; // Scene.FOGMODE_EXP2
      this.scene.fogColor = color;
      this.scene.fogDensity = 0;
    }
    this.scene.fogDensity += mist * 0.006;
  }

  private addFog(doc: MapDocument, mist: number, color: Color3): void {
    // High graphics' ambient occlusion already writes the view's camera-space depth in the main pass (Babylon's
    // pre-pass, for SSAO2): the fog reads that. Its own depth map drew the whole view a second time (Shingle Point:
    // 400 of a frame's 1,000 draws). Without the pre-pass (WebGPU, no SSAO) it draws its own, as before.
    const shared = perfOn('fogprepass') && !!prePass(this.scene);
    if (!shared) this.wholeDepth();
    // The mist lies on the low ground: the lowest fifth of the terrain, or the ground floor.
    const t = doc.terrain;
    const baseY = t ? t.baseY + [...t.heights].sort((a, b) => a - b)[Math.floor(t.heights.length * 0.2)]! / 100 : 0;
    const fog = new PostProcess('heightFog', 'heightFog', ['invViewProj', 'camPos', 'camForward', 'fogColor', 'density', 'baseY', 'falloff', 'maxFog'], ['depthSampler'], 1, this.camera);
    const inv = new Matrix();
    fog.onApply = (effect) => {
      this.camera.getTransformationMatrix().invertToRef(inv);
      // The pre-pass's depth while it has one (else, from now on, a depth map of its own).
      const depth = (this.depth ? null : prePassDepth(this.scene)) ?? this.wholeDepth().getDepthMap();
      effect.setTexture('depthSampler', depth);
      effect.setMatrix('invViewProj', inv);
      effect.setVector3('camPos', this.camera.globalPosition);
      effect.setVector3('camForward', this.camera.getDirection(Vector3.Forward()));
      effect.setColor3('fogColor', color);
      effect.setFloat('density', 0.0015 + mist * 0.011);
      effect.setFloat('baseY', baseY);
      effect.setFloat('falloff', 0.32 - mist * 0.16);
      effect.setFloat('maxFog', 0.35 + mist * 0.35);
    };
    this.fog = fog;
  }

  /** The scene's depth map of the whole view (made on first use; water shares it and leaves it whole). */
  private wholeDepth(): DepthRenderer {
    if (!this.depth) {
      this.depth = this.scene.enableDepthRenderer(this.camera, false, true, Texture.NEAREST_SAMPLINGMODE, true);
      // The fog reads the depth of the whole view: water (which shares this depth map) mustn't trim it to itself.
      markWholeSceneDepth(this.depth);
    }
    return this.depth;
  }

  private addRays(sky: SkyDefinition): void {
    const sun = this.scene.getLightByName('sun') as DirectionalLight | null;
    if (!sun) return;
    // A round sun (the default source is a square card).
    const disc = CreateSphere('sunDisc', { diameter: 1, segments: 12 }, this.scene);
    disc.scaling.setAll(SUN_DIAMETER);
    disc.isPickable = false;
    const mat = new StandardMaterial('sunDiscMat', this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = Color3.FromHexString(sky.light.sunColor);
    disc.material = mat;
    const rays = new VolumetricLightScatteringPostProcess('sunRays', { postProcessRatio: 1, passRatio: 0.5 }, this.camera, disc, 64, Texture.BILINEAR_SAMPLINGMODE, this.scene.getEngine(), false, this.scene);
    rays.exposure = 0.2;
    rays.decay = 0.965;
    rays.weight = 0.5;
    rays.density = 0.9;
    // The shafts come through gaps in big things (buildings, terrain, trees): only those block the light.
    // Drawing every mesh into the light's pass as well was a second draw for each, hundreds a frame in a
    // fight; people, props and effects barely dent a shaft. They go in as the pass's own render list (as a
    // shadow map's): the post-process's includedMeshes filter lost instanced meshes (trees, props) from
    // the main view.
    //
    // Only what covers the sun's disc matters. The pass is cleared to black and occluders draw black, so an occluder
    // changes a pixel only where it hides the disc: everything else is black on black. Each frame the pass draws the
    // disc and only the occluders whose bounds reach the narrow cone from the camera to the disc (SUN_CONE: the disc's
    // own size and a margin), and with the disc out of view the disc alone. The same picture, without the hundreds of
    // draws the whole list was (St. John's: about 700 a frame, as many as the main view).
    const pass = rays.getPass();
    const scene = this.scene;
    const camera = this.camera;
    let occluders: AbstractMesh[] = [disc];
    const near: AbstractMesh[] = [disc];
    const sunOnly: AbstractMesh[] = [disc];
    const toSun = new Vector3();
    let inView = true;
    let nearFrame = -1;
    pass.getCustomRenderList = () => {
      if (!inView) return sunOnly;
      const frame = scene.getFrameId();
      if (frame === nearFrame) return near;
      nearFrame = frame;
      near.length = 1;
      const p = camera.globalPosition;
      for (const m of occluders) if (m !== disc && !m.isDisposed() && coversSun(m, p, toSun)) near.push(m);
      return near;
    };
    const collect = () => {
      const list: AbstractMesh[] = [disc];
      for (const m of scene.meshes) {
        if (m === disc || !m.isEnabled() || m.renderingGroupId !== 0 || (m.metadata as { effect?: boolean } | null)?.effect) continue;
        if (m.getBoundingInfo().boundingSphere.radiusWorld >= OCCLUDER_RADIUS) list.push(m);
      }
      occluders = list;
      pass.renderList = list;
    };
    let next = 0;
    // The disc rides with the camera, far out along the way to the sun.
    this.observer = scene.onBeforeRenderObservable.add(() => {
      sun.direction.normalizeToRef(toSun).scaleInPlace(-1);
      disc.position.copyFrom(camera.globalPosition).addInPlace(toSun.scale(SUN_DISTANCE));
      // The level is built over the first seconds and doors and destructibles change it: look again every couple of
      // seconds (by the clock: every 120 frames was a minute in a slow software render).
      const now = performance.now();
      if (now >= next) {
        next = now + OCCLUDER_REFRESH_MS;
        collect();
      }
      inView = sunInView(camera, toSun);
    });
    this.rays = rays;
  }
}
