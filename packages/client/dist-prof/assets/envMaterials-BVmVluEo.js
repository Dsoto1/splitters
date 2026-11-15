import { j as VertexBuffer, h as Mesh, G as Texture, aB as PBRMaterial, a as Color3, bt as MaterialPluginBase, z as RegisterClass } from "./babylon-PnzH6wcM.js";
import "./materialPluginBase-Dhlt5oKE.js";
import { aE as loadGraphicsQuality, aD as versioned } from "./index-BAsW2uYW.js";
var ShaderLanguage;
(function(ShaderLanguage2) {
  ShaderLanguage2[ShaderLanguage2["GLSL"] = 0] = "GLSL";
  ShaderLanguage2[ShaderLanguage2["WGSL"] = 1] = "WGSL";
})(ShaderLanguage || (ShaderLanguage = {}));
const ENV_TEXTURES = { bark: "env/bark.webp", barkNormal: "env/bark_n.webp", rock: "env/rock.webp", rockNormal: "env/rock_n.webp", leaves: "env/leaves.webp" };
const ENV_RENDER = [
  { id: "env.broadleaf.oak", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [2504, 982, 254, 4], variants: [{ index: 0, name: "summer", file: "env/broadleaf.oak.summer.glb" }, { index: 1, name: "autumn", file: "env/broadleaf.oak.autumn.glb" }] },
  { id: "env.broadleaf.maple", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [2148, 954, 278, 4], variants: [{ index: 0, name: "summer", file: "env/broadleaf.maple.summer.glb" }, { index: 1, name: "autumn", file: "env/broadleaf.maple.autumn.glb" }] },
  { id: "env.broadleaf.acacia", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [2468, 906, 264, 4], variants: [{ index: 0, name: "green", file: "env/broadleaf.acacia.green.glb" }, { index: 1, name: "dry", file: "env/broadleaf.acacia.dry.glb" }] },
  { id: "env.cactus.saguaro", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [1968, 648, 276, 4], variants: [{ index: 0, name: "green", file: "env/cactus.saguaro.green.glb" }, { index: 1, name: "dry", file: "env/cactus.saguaro.dry.glb" }] },
  { id: "env.cliff.face", category: "cliff", role: "blocking", lods: [0, 40, 100], triangles: [2124, 696, 192], variants: [{ index: 0, name: "bare", file: "env/cliff.face.bare.glb" }, { index: 1, name: "snow", file: "env/cliff.face.snow.glb" }] },
  { id: "env.conifer.pine_tall", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [2208, 534, 138, 4], variants: [{ index: 0, name: "summer", file: "env/conifer.pine_tall.summer.glb" }, { index: 1, name: "snow", file: "env/conifer.pine_tall.snow.glb" }] },
  { id: "env.conifer.spruce", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [2662, 612, 174, 4], variants: [{ index: 0, name: "summer", file: "env/conifer.spruce.summer.glb" }, { index: 1, name: "snow", file: "env/conifer.spruce.snow.glb" }] },
  { id: "env.deadwood.log", category: "deadwood", role: "cover", lods: [0, 25, 70], triangles: [372, 120, 36], variants: [{ index: 0, name: "bare", file: "env/deadwood.log.bare.glb" }, { index: 1, name: "moss", file: "env/deadwood.log.moss.glb" }] },
  { id: "env.fern.bracken", category: "groundcover", role: "cover", lods: [0], triangles: [56], variants: [{ index: 0, name: "summer", file: "env/fern.bracken.summer.glb" }, { index: 1, name: "autumn", file: "env/fern.bracken.autumn.glb" }] },
  { id: "env.flower.meadow", category: "groundcover", role: "decorative", lods: [0], triangles: [27], variants: [{ index: 0, name: "white", file: "env/flower.meadow.white.glb" }, { index: 1, name: "yellow", file: "env/flower.meadow.yellow.glb" }, { index: 2, name: "purple", file: "env/flower.meadow.purple.glb" }, { index: 3, name: "red", file: "env/flower.meadow.red.glb" }] },
  { id: "env.grass.clump", category: "groundcover", role: "decorative", lods: [0], triangles: [35], variants: [{ index: 0, name: "summer", file: "env/grass.clump.summer.glb" }, { index: 1, name: "dry", file: "env/grass.clump.dry.glb" }] },
  { id: "env.hedge.privet", category: "plant", role: "blocking", lods: [0, 25, 90], triangles: [670, 190, 4], variants: [{ index: 0, name: "green", file: "env/hedge.privet.green.glb" }, { index: 1, name: "autumn", file: "env/hedge.privet.autumn.glb" }] },
  { id: "env.hedge.yew", category: "plant", role: "blocking", lods: [0, 25, 90], triangles: [662, 188, 4], variants: [{ index: 0, name: "green", file: "env/hedge.yew.green.glb" }, { index: 1, name: "snow", file: "env/hedge.yew.snow.glb" }] },
  { id: "env.palm.coconut", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [976, 336, 128, 4], variants: [{ index: 0, name: "green", file: "env/palm.coconut.green.glb" }, { index: 1, name: "dry", file: "env/palm.coconut.dry.glb" }] },
  { id: "env.palm.leaning", category: "tree", role: "cover", lods: [0, 30, 70, 140], triangles: [932, 348, 128, 4], variants: [{ index: 0, name: "green", file: "env/palm.leaning.green.glb" }, { index: 1, name: "dry", file: "env/palm.leaning.dry.glb" }] },
  { id: "env.rock.boulder_angular", category: "boulder", role: "cover", lods: [0, 30, 80], triangles: [700, 220, 60], variants: [{ index: 0, name: "bare", file: "env/rock.boulder_angular.bare.glb" }, { index: 1, name: "moss", file: "env/rock.boulder_angular.moss.glb" }] },
  { id: "env.rock.boulder_round", category: "boulder", role: "cover", lods: [0, 30, 80], triangles: [700, 220, 60], variants: [{ index: 0, name: "bare", file: "env/rock.boulder_round.bare.glb" }, { index: 1, name: "moss", file: "env/rock.boulder_round.moss.glb" }] },
  { id: "env.rock.slab", category: "boulder", role: "cover", lods: [0, 30, 80], triangles: [700, 220, 60], variants: [{ index: 0, name: "bare", file: "env/rock.slab.bare.glb" }, { index: 1, name: "moss", file: "env/rock.slab.moss.glb" }] },
  { id: "env.rock.outcrop", category: "boulder", role: "blocking", lods: [0, 40, 100], triangles: [685, 221, 64], variants: [{ index: 0, name: "bare", file: "env/rock.outcrop.bare.glb" }, { index: 1, name: "moss", file: "env/rock.outcrop.moss.glb" }] },
  { id: "env.rock.pebbles", category: "rock", role: "decorative", lods: [0], triangles: [60], variants: [{ index: 0, name: "grey", file: "env/rock.pebbles.grey.glb" }, { index: 1, name: "sand", file: "env/rock.pebbles.sand.glb" }] },
  { id: "env.shrub.broadleaf", category: "plant", role: "cover", lods: [0, 25, 60], triangles: [400, 100, 4], variants: [{ index: 0, name: "summer", file: "env/shrub.broadleaf.summer.glb" }, { index: 1, name: "autumn", file: "env/shrub.broadleaf.autumn.glb" }] },
  { id: "env.shrub.laurel", category: "plant", role: "cover", lods: [0, 25, 60], triangles: [440, 108, 4], variants: [{ index: 0, name: "green", file: "env/shrub.laurel.green.glb" }, { index: 1, name: "dry", file: "env/shrub.laurel.dry.glb" }] },
  { id: "env.water.eelgrass", category: "groundcover", role: "decorative", lods: [0], triangles: [49], variants: [{ index: 0, name: "green", file: "env/water.eelgrass.green.glb" }, { index: 1, name: "olive", file: "env/water.eelgrass.olive.glb" }] }
];
const ENV_TIERS = {
  low: { lodScale: 0.6, wind: 0, normals: false },
  medium: { lodScale: 0.8, wind: 0.6, normals: true },
  high: { lodScale: 1, wind: 1, normals: true }
};
const ENV_ROCK_SCALE = [1 / 2.6, 1 / 13.8, 1.4];
const ROCK_GAIN = 3.1.toFixed(2);
const ENV_WIND_KIND = "envWind";
class EnvWindPlugin extends MaterialPluginBase {
  constructor(material, params = { time: 0, strength: 0 }) {
    super(material, "EnvWind", 200, { ENVWIND: false });
    this.params = params;
    this._enable(true);
  }
  params;
  getClassName() {
    return "EnvWindPlugin";
  }
  isCompatible(shaderLanguage) {
    return shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL;
  }
  prepareDefines(defines) {
    defines["ENVWIND"] = true;
  }
  getAttributes(attributes) {
    attributes.push(ENV_WIND_KIND);
  }
  getUniforms() {
    return { ubo: [{ name: "envWindParams", size: 4, type: "vec4" }], vertex: "#ifdef ENVWIND\nuniform vec4 envWindParams;\n#endif\n" };
  }
  bindForSubMesh(ubo, _scene, _engine, _subMesh) {
    ubo.updateFloat4("envWindParams", this.params.time, this.params.strength, 0, 0);
  }
  getCustomCode(shaderType, shaderLanguage = ShaderLanguage.GLSL) {
    if (shaderType !== "vertex") return null;
    if (shaderLanguage === ShaderLanguage.WGSL) {
      return {
        CUSTOM_VERTEX_DEFINITIONS: "attribute envWind: vec2f;\n",
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
`
      };
    }
    return {
      CUSTOM_VERTEX_DEFINITIONS: "attribute vec2 envWind;\n",
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
{
  vec3 envBase = finalWorld[3].xyz;
  float envPh = dot(envBase.xz, vec2(0.13, 0.17));
  float envS = (sin(envWindParams.x * 1.1 + envPh) * 0.6 + sin(envWindParams.x * 2.3 + envPh * 1.7) * 0.25) * envWindParams.y * envWind.x;
  worldPos.xyz += vec3(0.94, 0.0, 0.33) * envS * 0.35 + vec3(0.0, -abs(envS) * 0.05, 0.0);
  worldPos.xyz += envWind.y * envWindParams.y * 0.035 * vec3(sin(envWindParams.x * 7.0 + worldPos.y * 3.0 + envPh), sin(envWindParams.x * 6.0 + worldPos.x * 2.0), cos(envWindParams.x * 7.5 + worldPos.z * 3.0));
}
`
    };
  }
}
RegisterClass("BABYLON.EnvWindPlugin", EnvWindPlugin);
class EnvRockPlugin extends MaterialPluginBase {
  constructor(material, albedo, normal, params) {
    super(material, "EnvRock", 150, { ENVROCK: false });
    this.albedo = albedo;
    this.normal = normal;
    this.params = params;
    this._enable(true);
  }
  albedo;
  normal;
  params;
  getClassName() {
    return "EnvRockPlugin";
  }
  isCompatible(shaderLanguage) {
    return shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL;
  }
  isReadyForSubMesh() {
    return this.albedo.isReady() && this.normal.isReady();
  }
  prepareDefines(defines) {
    defines["ENVROCK"] = true;
  }
  getSamplers(samplers) {
    samplers.push("envRockAlbedoSampler", "envRockNormalSampler");
  }
  getActiveTextures(activeTextures) {
    activeTextures.push(this.albedo, this.normal);
  }
  hasTexture(texture) {
    return texture === this.albedo || texture === this.normal;
  }
  getUniforms() {
    return { ubo: [{ name: "envRockParams", size: 4, type: "vec4" }], fragment: "#ifdef ENVROCK\nuniform vec4 envRockParams;\n#endif\n" };
  }
  bindForSubMesh(ubo) {
    ubo.updateFloat4("envRockParams", this.params[0], this.params[1], this.params[2], 0);
    ubo.setTexture("envRockAlbedoSampler", this.albedo);
    ubo.setTexture("envRockNormalSampler", this.normal);
  }
  getCustomCode(shaderType, shaderLanguage = ShaderLanguage.GLSL) {
    if (shaderType !== "fragment") return null;
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
  surfaceAlbedo = surfaceAlbedo * toLinearSpaceVec3(envC.rgb) * ${ROCK_GAIN} * (0.78 + 0.42 * envM) * envWarm;
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
        "!reflectivityBlock\\(\\s*uniforms\\.vReflectivityColor": "reflectivityBlock(vec4f(uniforms.vReflectivityColor.x, envRough, uniforms.vReflectivityColor.z, uniforms.vReflectivityColor.w)"
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
  surfaceAlbedo *= toLinearSpace(envC.rgb) * ${ROCK_GAIN} * (0.78 + 0.42 * envM) * envWarm;
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
      "!reflectivityBlock\\(\\s*vReflectivityColor": "reflectivityBlock(vec4(vReflectivityColor.x, envRough, vReflectivityColor.zw)"
    };
  }
}
const perScene = /* @__PURE__ */ new WeakMap();
function envMaterialsFor(scene, quality) {
  let m = perScene.get(scene);
  if (!m) perScene.set(scene, m = new EnvMaterials(scene, ENV_TIERS[quality] ?? ENV_TIERS.medium));
  return m;
}
function applyEnvMaterials(container, scene) {
  const mats = envMaterialsFor(scene, loadGraphicsQuality());
  for (const mesh of container.meshes) {
    const own = mesh.material;
    if (!own?.name.startsWith("env.")) continue;
    mesh.material = mats.get(own.name, own.albedoTexture ?? null);
    const uv2 = mesh.getVerticesData(VertexBuffer.UV2Kind);
    if (uv2 && mesh instanceof Mesh) mesh.setVerticesData(ENV_WIND_KIND, Float32Array.from(uv2), false, 2);
  }
}
class EnvMaterials {
  constructor(scene, tier) {
    this.scene = scene;
    this.tier = tier;
    this.wind.strength = tier.wind;
    const tick = scene.onBeforeRenderObservable.add(() => {
      this.wind.time += Math.min(0.1, scene.getEngine().getDeltaTime() / 1e3);
    });
    scene.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(tick));
  }
  scene;
  tier;
  wind = { time: 0, strength: 1 };
  cache = /* @__PURE__ */ new Map();
  textures = /* @__PURE__ */ new Map();
  wireframe = false;
  /** Wind strength, 0–1 (the tier's by default; the envlab's toggle sets it). */
  setWind(strength) {
    this.wind.strength = strength;
  }
  setWireframe(on) {
    this.wireframe = on;
    for (const m of this.cache.values()) m.wireframe = on;
  }
  texture(url, normal = false) {
    let t = this.textures.get(url);
    if (!t) {
      t = new Texture(versioned(`${"/"}${url}`), this.scene, false, false);
      if (normal) t.gammaSpace = false;
      this.textures.set(url, t);
    }
    return t;
  }
  /**
   * The material for a GLB material name: env.bark, env.leaf, env.rock, env.grass, or env.impostor.* (whose
   * picture is the GLB's own, passed as `own`).
   */
  get(name, own) {
    const key = name.startsWith("env.impostor") ? name : name;
    let m = this.cache.get(key);
    if (m) return m;
    m = new PBRMaterial(`env_${name}`, this.scene);
    m.metallic = 0;
    m.roughness = 0.9;
    m.albedoColor = Color3.White();
    m.environmentIntensity = 0.6;
    m.maxSimultaneousLights = 4;
    m.wireframe = this.wireframe;
    const leafy = name === "env.leaf" || name.startsWith("env.impostor");
    if (name === "env.bark") {
      m.albedoTexture = this.texture(ENV_TEXTURES.bark);
      if (this.tier.normals) m.bumpTexture = this.texture(ENV_TEXTURES.barkNormal, true);
      m.roughness = 0.92;
    } else if (name === "env.rock") {
      m.roughness = 0.86;
      if (this.tier.normals) new EnvRockPlugin(m, this.texture(ENV_TEXTURES.rock), this.texture(ENV_TEXTURES.rockNormal, true), ENV_ROCK_SCALE);
      else m.albedoTexture = this.texture(ENV_TEXTURES.rock);
    } else if (name === "env.grass") {
      m.backFaceCulling = false;
      m.roughness = 0.85;
      m.maxSimultaneousLights = 2;
    } else if (leafy) {
      const tex = name === "env.leaf" ? this.texture(ENV_TEXTURES.leaves) : own;
      if (tex) {
        tex.hasAlpha = true;
        m.albedoTexture = tex;
      }
      m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
      m.alphaCutOff = 0.5;
      m.useAlphaFromAlbedoTexture = true;
      m.backFaceCulling = false;
      m.roughness = 0.8;
    }
    if (name !== "env.rock") new EnvWindPlugin(m, this.wind);
    this.cache.set(key, m);
    return m;
  }
  dispose() {
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.cache.clear();
    this.textures.clear();
  }
}
const envMaterials = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ENV_TIERS,
  ENV_WIND_KIND,
  EnvMaterials,
  applyEnvMaterials,
  envMaterialsFor
}, Symbol.toStringTag, { value: "Module" }));
export {
  ENV_TIERS as E,
  EnvMaterials as a,
  ENV_RENDER as b,
  ENV_WIND_KIND as c,
  envMaterials as d,
  envMaterialsFor as e
};
