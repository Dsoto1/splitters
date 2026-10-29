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

/** Skies the sun shines through brightly enough for shafts of light. */
const SUNNY = new Set(['clear', 'cloudy', 'sunrise', 'sunset', 'dusk', 'misty', 'snowy']);

/**
 * Ground mist (a map's backdrop `mist`: height fog on high graphics, thicker distance fog on medium) and light
 * shafts from the sun through gaps and foliage (high graphics, sunny skies).
 */
/** Things at least this big (bounding radius, m) block the sun's shafts. */
const OCCLUDER_RADIUS = 2;

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
    if (this.scene.fogMode !== 2) {
      this.scene.fogMode = 2; // Scene.FOGMODE_EXP2
      this.scene.fogColor = color;
      this.scene.fogDensity = 0;
    }
    this.scene.fogDensity += mist * 0.006;
  }

  private addFog(doc: MapDocument, mist: number, color: Color3): void {
    this.depth = this.scene.enableDepthRenderer(this.camera, false, true, Texture.NEAREST_SAMPLINGMODE, true);
    const map = this.depth.getDepthMap();
    // The mist lies on the low ground: the lowest fifth of the terrain, or the ground floor.
    const t = doc.terrain;
    const baseY = t ? t.baseY + [...t.heights].sort((a, b) => a - b)[Math.floor(t.heights.length * 0.2)]! / 100 : 0;
    const fog = new PostProcess('heightFog', 'heightFog', ['invViewProj', 'camPos', 'camForward', 'fogColor', 'density', 'baseY', 'falloff', 'maxFog'], ['depthSampler'], 1, this.camera);
    const inv = new Matrix();
    fog.onApply = (effect) => {
      this.camera.getTransformationMatrix().invertToRef(inv);
      effect.setTexture('depthSampler', map);
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

  private addRays(sky: SkyDefinition): void {
    const sun = this.scene.getLightByName('sun') as DirectionalLight | null;
    if (!sun) return;
    // A round sun (the default source is a square card).
    const disc = CreateSphere('sunDisc', { diameter: 1, segments: 12 }, this.scene);
    disc.scaling.setAll(36);
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
    let refresh = 0;
    const occluders = () => {
      const list: AbstractMesh[] = [disc];
      for (const m of this.scene.meshes) {
        if (m === disc || !m.isEnabled() || m.renderingGroupId !== 0 || (m.metadata as { effect?: boolean } | null)?.effect) continue;
        if (m.getBoundingInfo().boundingSphere.radiusWorld >= OCCLUDER_RADIUS) list.push(m);
      }
      rays.getPass().renderList = list;
    };
    // The disc rides with the camera, far out along the way to the sun.
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      disc.position.copyFrom(this.camera.globalPosition).subtractInPlace(sun.direction.normalizeToNew().scale(900));
      // The level is built over the first frames and doors and destructibles change it: look again now and then.
      if (--refresh <= 0) {
        refresh = 120;
        occluders();
      }
    });
    this.rays = rays;
  }
}
