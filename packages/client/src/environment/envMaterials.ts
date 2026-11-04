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
      m.albedoTexture = this.texture(ENV_TEXTURES.rock);
      if (this.tier.normals) m.bumpTexture = this.texture(ENV_TEXTURES.rockNormal, true);
      m.roughness = 0.86;
    } else if (name === 'env.grass') {
      m.backFaceCulling = false;
      m.roughness = 0.85;
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
