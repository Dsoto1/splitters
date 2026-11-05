import type { Scene } from '@babylonjs/core/scene';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { Nullable } from '@babylonjs/core/types';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Material } from '@babylonjs/core/Materials/material';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import type { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { versioned } from '../assetUrl.ts';
import { ENV_TEXTURES } from '../content/environment.generated.ts';
import { loadGraphicsQuality } from '../game/graphicsSettings.ts';

/**
 * The environment's materials (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §9.3): one per kind of surface for the whole
 * scene, drawn with the shared pictures (bark, rock, the leaves atlas, tools/content/env/textures.mjs) times each
 * vertex's colour, which carries the species and season. Leaves are alpha-tested, never blended. Wind is a vertex
 * shader plugin (GLSL and WGSL) reading each vertex's sway and flutter weights (the `envWind` attribute, from the
 * GLB's second uv set) and each copy's position for its phase; it moves only what is drawn, never a collider.
 */

/** Graphics tier settings the environment reads (game/graphicsSettings.ts quality). */
export interface EnvTier {
  /** Level of detail distances are multiplied by this. */
  lodScale: number;
  /** 0 = still, 1 = full sway and leaf flutter. */
  wind: number;
  /** Normal maps on bark and rock. */
  normals: boolean;
}

export const ENV_TIERS: Record<string, EnvTier> = {
  low: { lodScale: 0.6, wind: 0, normals: false },
  medium: { lodScale: 0.8, wind: 0.6, normals: true },
  high: { lodScale: 1, wind: 1, normals: true },
};

/** Rock tri-planar: the picture repeats every 2.6 m, its tone sample every 13.8 m; normal map strength. */
const ENV_ROCK_SCALE: [number, number, number] = [1 / 2.6, 1 / 13.8, 1.4];
/** The rock picture is a detail layer round mid grey: this brings its linear mean (about 0.22) back to about 1, so the vertex colour sets the tone. */
const ROCK_GAIN = (3.1).toFixed(2);

/** The vertex attribute carrying wind weights (x: sway, 0 at the ground to 1 at branch tips; y: leaf flutter). */
export const ENV_WIND_KIND = 'envWind';

class EnvWindPlugin extends MaterialPluginBase {
  constructor(
    material: Material,
    private readonly params: { time: number; strength: number },
  ) {
    super(material, 'EnvWind', 200, { ENVWIND: false });
    this._enable(true);
  }

  override getClassName(): string {
    return 'EnvWindPlugin';
  }

  override isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL;
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines['ENVWIND'] = true;
  }

  override getAttributes(attributes: string[]): void {
    attributes.push(ENV_WIND_KIND);
  }

  override getUniforms(): { ubo: { name: string; size: number; type: string }[]; vertex: string } {
    return { ubo: [{ name: 'envWindParams', size: 4, type: 'vec4' }], vertex: '#ifdef ENVWIND\nuniform vec4 envWindParams;\n#endif\n' };
  }

  override bindForSubMesh(ubo: UniformBuffer, _scene: Scene, _engine: AbstractEngine, _subMesh: SubMesh): void {
    ubo.updateFloat4('envWindParams', this.params.time, this.params.strength, 0, 0);
  }

  override getCustomCode(shaderType: string, shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL): Nullable<{ [pointName: string]: string }> {
    if (shaderType !== 'vertex') return null;
    if (shaderLanguage === ShaderLanguage.WGSL) {
      return {
        CUSTOM_VERTEX_DEFINITIONS: 'attribute envWind: vec2f;\n',
        CUSTOM_VERTEX_UPDATE_WORLDPOS: `
{
  let envW = vertexInputs.envWind;
  let envP = uniforms.envWindParams;
  let envBase = finalWorld[3].xyz;
  let envPh = dot(envBase.xz, vec2f(0.13, 0.17));
  let envS = (sin(envP.x * 1.1 + envPh) * 0.6 + sin(envP.x * 2.3 + envPh * 1.7) * 0.25) * envP.y * envW.x;
  worldPos = vec4f(worldPos.xyz + vec3f(0.94, 0.0, 0.33) * envS * 0.35 + vec3f(0.0, -abs(envS) * 0.05, 0.0)
    + envW.y * envP.y * 0.035 * vec3f(sin(envP.x * 7.0 + worldPos.y * 3.0 + envPh), sin(envP.x * 6.0 + worldPos.x * 2.0), cos(envP.x * 7.5 + worldPos.z * 3.0)), worldPos.w);
}
`,
      };
    }
    return {
      CUSTOM_VERTEX_DEFINITIONS: 'attribute vec2 envWind;\n',
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
{
  vec3 envBase = finalWorld[3].xyz;
  float envPh = dot(envBase.xz, vec2(0.13, 0.17));
  float envS = (sin(envWindParams.x * 1.1 + envPh) * 0.6 + sin(envWindParams.x * 2.3 + envPh * 1.7) * 0.25) * envWindParams.y * envWind.x;
  worldPos.xyz += vec3(0.94, 0.0, 0.33) * envS * 0.35 + vec3(0.0, -abs(envS) * 0.05, 0.0);
  worldPos.xyz += envWind.y * envWindParams.y * 0.035 * vec3(sin(envWindParams.x * 7.0 + worldPos.y * 3.0 + envPh), sin(envWindParams.x * 6.0 + worldPos.x * 2.0), cos(envWindParams.x * 7.5 + worldPos.z * 3.0));
}
`,
    };
  }
}

/**
 * Rock drawn tri-planar in world space (medium and high): the rock picture (albedo, roughness in its alpha) and its
 * normal map are sampled along the three world axes and blended by the surface's direction, so there are no uv seams
 * or stretched faces, and no two boulders (or cliff panels) show the same patch of picture. A second, 5.3 times larger
 * sample of the same picture varies the tone over metres and a third over tens of metres (warm and cool patches),
 * which breaks up the repeat; the vertex colour (strata, wear, moss, cavities from the generator) multiplies on top.
 * Normals: the three tangent-space samples whiteout-blended onto the surface normal. Roughness: the picture's, made
 * rougher where the vertex colour is mossy (green over red). GLSL and WGSL.
 */
class EnvRockPlugin extends MaterialPluginBase {
  constructor(
    material: Material,
    private readonly albedo: Texture,
    private readonly normal: Texture,
    /** [world scale (1/m), macro scale, normal strength]. */
    private readonly params: [number, number, number],
  ) {
    super(material, 'EnvRock', 150, { ENVROCK: false });
    this._enable(true);
  }

  override getClassName(): string {
    return 'EnvRockPlugin';
  }

  override isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL;
  }

  override isReadyForSubMesh(): boolean {
    return this.albedo.isReady() && this.normal.isReady();
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines['ENVROCK'] = true;
  }

  override getSamplers(samplers: string[]): void {
    samplers.push('envRockAlbedoSampler', 'envRockNormalSampler');
  }

  override getActiveTextures(activeTextures: BaseTexture[]): void {
    activeTextures.push(this.albedo, this.normal);
  }

  override hasTexture(texture: BaseTexture): boolean {
    return texture === this.albedo || texture === this.normal;
  }

  override getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
    return { ubo: [{ name: 'envRockParams', size: 4, type: 'vec4' }], fragment: '#ifdef ENVROCK\nuniform vec4 envRockParams;\n#endif\n' };
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    ubo.updateFloat4('envRockParams', this.params[0], this.params[1], this.params[2], 0);
    ubo.setTexture('envRockAlbedoSampler', this.albedo);
    ubo.setTexture('envRockNormalSampler', this.normal);
  }

  override getCustomCode(shaderType: string, shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL): Nullable<{ [pointName: string]: string }> {
    if (shaderType !== 'fragment') return null;
    if (shaderLanguage === ShaderLanguage.WGSL) {
      return {
        CUSTOM_FRAGMENT_DEFINITIONS: `
var envRockAlbedoSamplerSampler: sampler;
var envRockAlbedoSampler: texture_2d<f32>;
var envRockNormalSamplerSampler: sampler;
var envRockNormalSampler: texture_2d<f32>;
`,
        CUSTOM_FRAGMENT_UPDATE_ALPHA: `
var envRough: f32 = uniforms.vReflectivityColor.y;
{
  let envPar = uniforms.envRockParams;
  let envN = normalize(fragmentInputs.vNormalW);
  var envW = pow(abs(envN), vec3f(4.0));
  envW = envW / (envW.x + envW.y + envW.z);
  let envP = fragmentInputs.vPositionW * envPar.x;
  let envCx = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envP.zy);
  let envCy = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envP.xz);
  let envCz = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envP.xy);
  let envC = envCx * envW.x + envCy * envW.y + envCz * envW.z;
  let envQ = fragmentInputs.vPositionW * envPar.y;
  let envM = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envQ.zy + vec2f(0.37, 0.11)).g * envW.x
    + textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envQ.xz + vec2f(0.61, 0.29)).g * envW.y
    + textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envQ.xy + vec2f(0.13, 0.71)).g * envW.z;
  let envF = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, fragmentInputs.vPositionW.xz * 0.023 + vec2f(0.5, 0.5)).g;
  let envWarm = mix(vec3f(0.93, 0.95, 1.0), vec3f(1.06, 1.0, 0.92), smoothstep(0.35, 0.65, envF));
  surfaceAlbedo = surfaceAlbedo * toLinearSpaceVec3(envC.rgb) * ${ROCK_GAIN} * (0.62 + 0.7 * envM) * envWarm;
  envRough = envC.a;
#ifdef VERTEXCOLOR
  envRough = mix(envRough, 0.97, clamp((fragmentInputs.vColor.g - fragmentInputs.vColor.r) * 9.0, 0.0, 1.0));
#endif
  let envS = sign(envN);
  var envTx = textureSample(envRockNormalSampler, envRockNormalSamplerSampler, envP.zy).xyz * 2.0 - 1.0;
  var envTy = textureSample(envRockNormalSampler, envRockNormalSamplerSampler, envP.xz).xyz * 2.0 - 1.0;
  var envTz = textureSample(envRockNormalSampler, envRockNormalSamplerSampler, envP.xy).xyz * 2.0 - 1.0;
  envTx = vec3f(envTx.xy * envPar.z * vec2f(envS.x, 1.0) + envN.zy, abs(envTx.z) * envN.x);
  envTy = vec3f(envTy.xy * envPar.z * vec2f(envS.y, 1.0) + envN.xz, abs(envTy.z) * envN.y);
  envTz = vec3f(envTz.xy * envPar.z * vec2f(-envS.z, 1.0) + envN.xy, abs(envTz.z) * envN.z);
  normalW = normalize(envTx.zyx * envW.x + envTy.xzy * envW.y + envTz.xyz * envW.z);
}
`,
        '!reflectivityBlock\\(\\s*uniforms\\.vReflectivityColor': 'reflectivityBlock(vec4f(uniforms.vReflectivityColor.x, envRough, uniforms.vReflectivityColor.z, uniforms.vReflectivityColor.w)',
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
#ifdef ENVROCK
uniform sampler2D envRockAlbedoSampler;
uniform sampler2D envRockNormalSampler;
#endif
`,
      CUSTOM_FRAGMENT_UPDATE_ALPHA: `
float envRough = vReflectivityColor.y;
#ifdef ENVROCK
{
  vec3 envN = normalize(vNormalW);
  vec3 envW = pow(abs(envN), vec3(4.0));
  envW /= envW.x + envW.y + envW.z;
  vec3 envP = vPositionW * envRockParams.x;
  vec4 envC = texture2D(envRockAlbedoSampler, envP.zy) * envW.x + texture2D(envRockAlbedoSampler, envP.xz) * envW.y + texture2D(envRockAlbedoSampler, envP.xy) * envW.z;
  vec3 envQ = vPositionW * envRockParams.y;
  float envM = texture2D(envRockAlbedoSampler, envQ.zy + vec2(0.37, 0.11)).g * envW.x + texture2D(envRockAlbedoSampler, envQ.xz + vec2(0.61, 0.29)).g * envW.y + texture2D(envRockAlbedoSampler, envQ.xy + vec2(0.13, 0.71)).g * envW.z;
  float envF = texture2D(envRockAlbedoSampler, vPositionW.xz * 0.023 + vec2(0.5)).g;
  vec3 envWarm = mix(vec3(0.93, 0.95, 1.0), vec3(1.06, 1.0, 0.92), smoothstep(0.35, 0.65, envF));
  surfaceAlbedo *= toLinearSpace(envC.rgb) * ${ROCK_GAIN} * (0.62 + 0.7 * envM) * envWarm;
  envRough = envC.a;
#ifdef VERTEXCOLOR
  envRough = mix(envRough, 0.97, clamp((vColor.g - vColor.r) * 9.0, 0.0, 1.0));
#endif
  vec3 envS = sign(envN);
  vec3 envTx = texture2D(envRockNormalSampler, envP.zy).xyz * 2.0 - 1.0;
  vec3 envTy = texture2D(envRockNormalSampler, envP.xz).xyz * 2.0 - 1.0;
  vec3 envTz = texture2D(envRockNormalSampler, envP.xy).xyz * 2.0 - 1.0;
  envTx = vec3(envTx.xy * envRockParams.z * vec2(envS.x, 1.0) + envN.zy, abs(envTx.z) * envN.x);
  envTy = vec3(envTy.xy * envRockParams.z * vec2(envS.y, 1.0) + envN.xz, abs(envTy.z) * envN.y);
  envTz = vec3(envTz.xy * envRockParams.z * vec2(-envS.z, 1.0) + envN.xy, abs(envTz.z) * envN.z);
  normalW = normalize(envTx.zyx * envW.x + envTy.xzy * envW.y + envTz.xyz * envW.z);
}
#endif
`,
      '!reflectivityBlock\\(\\s*vReflectivityColor': 'reflectivityBlock(vec4(vReflectivityColor.x, envRough, vReflectivityColor.zw)',
    };
  }
}

const perScene = new WeakMap<Scene, EnvMaterials>();

/** The scene's environment materials (made on first use, at the chosen graphics tier). */
export function envMaterialsFor(scene: Scene, quality: string): EnvMaterials {
  let m = perScene.get(scene);
  if (!m) perScene.set(scene, (m = new EnvMaterials(scene, ENV_TIERS[quality] ?? ENV_TIERS.medium!)));
  return m;
}

/**
 * An environment model loaded as an ordinary prop (ModelLibrary): its placeholder materials (env.bark, env.leaf,
 * env.rock, env.grass, env.impostor.*) swapped for the scene's environment materials, and its wind weights (the
 * second uv set) named for the wind plugin.
 */
export function applyEnvMaterials(container: AssetContainer, scene: Scene): void {
  const mats = envMaterialsFor(scene, loadGraphicsQuality());
  for (const mesh of container.meshes) {
    const own = mesh.material;
    if (!own?.name.startsWith('env.')) continue;
    mesh.material = mats.get(own.name, (own as { albedoTexture?: BaseTexture | null }).albedoTexture ?? null);
    const uv2 = mesh.getVerticesData(VertexBuffer.UV2Kind);
    if (uv2 && mesh instanceof Mesh) mesh.setVerticesData(ENV_WIND_KIND, Float32Array.from(uv2), false, 2);
  }
}

/** The environment's shared materials for one scene. */
export class EnvMaterials {
  private readonly wind = { time: 0, strength: 1 };
  private readonly cache = new Map<string, PBRMaterial>();
  private readonly textures = new Map<string, Texture>();
  private wireframe = false;

  constructor(
    private readonly scene: Scene,
    private tier: EnvTier,
  ) {
    this.wind.strength = tier.wind;
    const tick = scene.onBeforeRenderObservable.add(() => {
      this.wind.time += Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    });
    scene.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(tick));
  }

  /** Wind strength, 0–1 (the tier's by default; the envlab's toggle sets it). */
  setWind(strength: number): void {
    this.wind.strength = strength;
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    for (const m of this.cache.values()) m.wireframe = on;
  }

  private texture(url: string, normal = false): Texture {
    let t = this.textures.get(url);
    if (!t) {
      t = new Texture(versioned(`${import.meta.env.BASE_URL}${url}`), this.scene, false, false);
      if (normal) t.gammaSpace = false;
      this.textures.set(url, t);
    }
    return t;
  }

  /**
   * The material for a GLB material name: env.bark, env.leaf, env.rock, env.grass, or env.impostor.* (whose
   * picture is the GLB's own, passed as `own`).
   */
  get(name: string, own?: BaseTexture | null): PBRMaterial {
    const key = name.startsWith('env.impostor') ? name : name;
    let m = this.cache.get(key);
    if (m) return m;
    m = new PBRMaterial(`env_${name}`, this.scene);
    m.metallic = 0;
    m.roughness = 0.9;
    m.albedoColor = Color3.White();
    m.environmentIntensity = 0.6;
    m.maxSimultaneousLights = 4;
    m.wireframe = this.wireframe;
    const leafy = name === 'env.leaf' || name.startsWith('env.impostor');
    if (name === 'env.bark') {
      m.albedoTexture = this.texture(ENV_TEXTURES.bark);
      if (this.tier.normals) m.bumpTexture = this.texture(ENV_TEXTURES.barkNormal, true);
      m.roughness = 0.92;
    } else if (name === 'env.rock') {
      m.roughness = 0.86;
      // Medium and high: tri-planar in world space (EnvRockPlugin). Low: the model's box-projected uv, no normals.
      if (this.tier.normals) new EnvRockPlugin(m, this.texture(ENV_TEXTURES.rock), this.texture(ENV_TEXTURES.rockNormal, true), ENV_ROCK_SCALE);
      else m.albedoTexture = this.texture(ENV_TEXTURES.rock);
    } else if (name === 'env.grass') {
      m.backFaceCulling = false;
      m.roughness = 0.85;
      // Ground cover (thousands of blades, stems and leaves in view): the sun and one more light, as the old lambert plants had.
      m.maxSimultaneousLights = 2;
    } else if (leafy) {
      const tex = name === 'env.leaf' ? this.texture(ENV_TEXTURES.leaves) : (own as Texture | null);
      if (tex) {
        tex.hasAlpha = true;
        m.albedoTexture = tex;
      }
      // Cut-outs: alpha-tested, never blended (no sorting, no blended overdraw).
      m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
      m.alphaCutOff = 0.5;
      m.useAlphaFromAlbedoTexture = true;
      m.backFaceCulling = false;
      m.roughness = 0.8;
    }
    // Everything sways but rock.
    if (name !== 'env.rock') new EnvWindPlugin(m, this.wind);
    this.cache.set(key, m);
    return m;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.cache.clear();
    this.textures.clear();
  }
}
