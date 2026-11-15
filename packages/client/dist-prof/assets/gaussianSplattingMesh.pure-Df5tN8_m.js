const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/gaussianSplatting.fragment-Du8CLf6s.js","assets/babylon-PnzH6wcM.js","assets/clipPlaneFragment-BbExy4ec.js","assets/logDepthDeclaration-Cf0EhojL.js","assets/fogFragment-Dm1Vlk0e.js","assets/objectIdFunctions-CSQgrKyq.js","assets/meshBlendTagFragmentOutput-BcEf-EkO.js","assets/packingFunctions-BWnUrIa6.js","assets/logDepthFragment-81Y6Jflh.js","assets/geometryRenderingFragment-DR3MRJz3.js","assets/gaussianSplatting.vertex-DDOQD5tp.js","assets/sceneUboDeclaration-CzhdE5li.js","assets/meshUboDeclaration-w24jovMr.js","assets/helperFunctions-vFx73x84.js","assets/clipPlaneVertex-CtRrEuj6.js","assets/fogVertex-CNSnaHda.js","assets/gaussianSplatting-BCcFnXTH.js","assets/logDepthVertex-vt-aaTE3.js","assets/gaussianSplatting.fragment-BI6w5YIC.js","assets/clipPlaneFragment-D8NTl-r6.js","assets/logDepthDeclaration-CQzyhobd.js","assets/fogFragment-Dp8mD_y1.js","assets/objectIdFunctions-DK-N0nzE.js","assets/prePassDeclaration-DUmFubO5.js","assets/packingFunctions-BMJqx468.js","assets/logDepthFragment-DPo7Bo0h.js","assets/geometryRenderingFragment-DLwEyl8q.js","assets/gaussianSplatting.vertex-CUbuogMB.js","assets/gaussianSplattingUboDeclaration-trXWG817.js","assets/sceneUboDeclaration-CFURaA3t.js","assets/meshUboDeclaration-DahcYBU-.js","assets/clipPlaneVertex-BdoNWmEf.js","assets/fogVertex-DbLnME-r.js","assets/helperFunctions-Cbwc0-4F.js","assets/logDepthVertex-IJzM9PkV.js","assets/gaussianSplattingVoxel.vertex-Dtui2WbI.js","assets/gaussianSplattingVoxel.fragment-CSRdi2-M.js","assets/iblVoxelOpacityAtomicMax-B1nLab6q.js","assets/gaussianSplattingVoxel.vertex-CK3pcERo.js","assets/gaussianSplattingVoxel.fragment-DaipUjUL.js"])))=>i.map(i=>d[i]);
import { I as EngineStore, bo as DrawWrapper, bu as RandomGUID, bM as Effect, m as PushMaterial, M as Matrix, aU as MaterialHelperGeometryRendering, bb as PrepareDefinesForMisc, bc as PrepareDefinesForFrameBoundValues, bd as PrepareDefinesForAttributes, a$ as PrepareAttributesForInstances, b4 as PrepareUniformsAndSamplersList, A as AddClipPlaneUniforms, a9 as __vitePreload, O as Observable, t as BindClipPlane, w as BindFogParameters, v as BindLogDepth, f as Camera, L as Logger, bN as Engine, y as SerializationHelper, aM as Material, bh as PrepassDefinesMixin, bj as MaterialDefines, z as RegisterClass, j as VertexBuffer, bO as functions, bP as HighestCommonFactor, h as Mesh, V as Vector3, i as VertexData, a0 as Vector2, bQ as SubMesh, l as TmpVectors, al as FromHalfFloat, bR as runCoroutineAsync, bS as createYieldingScheduler, bT as ImportMeshAsync, am as ToHalfFloat, C as Color4, bU as runCoroutineSync, bB as RawTexture, k as BoundingInfo, bV as PickingInfo, Q as Quaternion, a6 as EncodeArrayBufferToBase64, bW as DecodeBase64ToBinary } from "./babylon-PnzH6wcM.js";
import { S as ShaderMaterial } from "./shaderMaterial.pure-T5Xe2ebz.js";
import { M as MultiRenderTarget } from "./multiRenderTarget.pure-CHje0eeK.js";
class MapMap {
  constructor() {
    this.mm = /* @__PURE__ */ new Map();
  }
  get(a, b) {
    const m = this.mm.get(a);
    if (m !== void 0) {
      return m.get(b);
    }
    return void 0;
  }
  set(a, b, v) {
    let m = this.mm.get(a);
    if (m === void 0) {
      this.mm.set(a, m = /* @__PURE__ */ new Map());
    }
    m.set(b, v);
  }
}
class ShadowDepthWrapper {
  /** Gets the standalone status of the wrapper */
  get standalone() {
    return this._options?.standalone ?? false;
  }
  /** Gets the base material the wrapper is built upon */
  get baseMaterial() {
    return this._baseMaterial;
  }
  /** Gets the doNotInjectCode status of the wrapper */
  get doNotInjectCode() {
    return this._options?.doNotInjectCode ?? false;
  }
  /**
   * Instantiate a new shadow depth wrapper.
   * It works by injecting some specific code in the vertex/fragment shaders of the base material and is used by a shadow generator to
   * generate the shadow depth map. For more information, please refer to the documentation:
   * https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows
   * @param baseMaterial Material to wrap
   * @param scene Define the scene the material belongs to
   * @param options Options used to create the wrapper
   */
  constructor(baseMaterial, scene, options) {
    this._baseMaterial = baseMaterial;
    this._scene = scene ?? EngineStore.LastCreatedScene;
    this._options = options;
    this._subMeshToEffect = /* @__PURE__ */ new Map();
    this._subMeshToDepthWrapper = new MapMap();
    this._meshes = /* @__PURE__ */ new Map();
    this._onEffectCreatedObserver = this._baseMaterial.onEffectCreatedObservable.add((params) => {
      const mesh = params.subMesh?.getMesh();
      if (mesh && !this._meshes.has(mesh)) {
        this._meshes.set(mesh, mesh.onDisposeObservable.add((mesh2) => {
          const iterator = this._subMeshToEffect.keys();
          for (let key = iterator.next(); key.done !== true; key = iterator.next()) {
            const subMesh = key.value;
            if (subMesh?.getMesh() === mesh2) {
              this._subMeshToEffect.delete(subMesh);
              this._deleteDepthWrapperEffect(subMesh);
            }
          }
        }));
      }
      if (this._subMeshToEffect.get(params.subMesh)?.[0] !== params.effect) {
        this._subMeshToEffect.set(params.subMesh, [params.effect, this._scene.getEngine().currentRenderPassId]);
        this._deleteDepthWrapperEffect(params.subMesh);
      }
    });
  }
  _deleteDepthWrapperEffect(subMesh) {
    const depthWrapperEntries = this._subMeshToDepthWrapper.mm.get(subMesh);
    if (depthWrapperEntries) {
      depthWrapperEntries.forEach((depthWrapper) => {
        depthWrapper.mainDrawWrapper.effect?.dispose();
      });
      this._subMeshToDepthWrapper.mm.delete(subMesh);
    }
  }
  /**
   * Gets the effect to use to generate the depth map
   * @param subMesh subMesh to get the effect for
   * @param shadowGenerator shadow generator to get the effect for
   * @param passIdForDrawWrapper Id of the pass for which the effect from the draw wrapper must be retrieved from
   * @returns the effect to use to generate the depth map for the subMesh + shadow generator specified
   */
  getEffect(subMesh, shadowGenerator, passIdForDrawWrapper) {
    const entry = this._subMeshToDepthWrapper.mm.get(subMesh)?.get(shadowGenerator);
    if (!entry) {
      return null;
    }
    let drawWrapper = entry.drawWrapper[passIdForDrawWrapper];
    if (!drawWrapper) {
      drawWrapper = entry.drawWrapper[passIdForDrawWrapper] = new DrawWrapper(this._scene.getEngine());
      drawWrapper.setEffect(entry.mainDrawWrapper.effect, entry.mainDrawWrapper.defines);
    }
    return drawWrapper;
  }
  /**
   * Specifies that the submesh is ready to be used for depth rendering
   * @param subMesh submesh to check
   * @param defines the list of defines to take into account when checking the effect
   * @param shadowGenerator combined with subMesh, it defines the effect to check
   * @param useInstances specifies that instances should be used
   * @param passIdForDrawWrapper Id of the pass for which the draw wrapper should be created
   * @returns a boolean indicating that the submesh is ready or not
   */
  isReadyForSubMesh(subMesh, defines, shadowGenerator, useInstances, passIdForDrawWrapper) {
    if (this.standalone) {
      if (!this._baseMaterial.isReadyForSubMesh(subMesh.getMesh(), subMesh, useInstances)) {
        return false;
      }
    }
    return this._makeEffect(subMesh, defines, shadowGenerator, passIdForDrawWrapper)?.isReady() ?? false;
  }
  /**
   * Disposes the resources
   */
  dispose() {
    this._baseMaterial.onEffectCreatedObservable.remove(this._onEffectCreatedObserver);
    this._onEffectCreatedObserver = null;
    const iterator = this._meshes.entries();
    for (let entry = iterator.next(); entry.done !== true; entry = iterator.next()) {
      const [mesh, observer] = entry.value;
      mesh.onDisposeObservable.remove(observer);
    }
  }
  _makeEffect(subMesh, defines, shadowGenerator, passIdForDrawWrapper) {
    const engine = this._scene.getEngine();
    const origEffectAndRenderPassId = this._subMeshToEffect.get(subMesh);
    if (!origEffectAndRenderPassId) {
      return null;
    }
    const [origEffect, origRenderPassId] = origEffectAndRenderPassId;
    if (!origEffect.isReady()) {
      return null;
    }
    let params = this._subMeshToDepthWrapper.get(subMesh, shadowGenerator);
    if (!params) {
      const mainDrawWrapper = new DrawWrapper(engine);
      const originalDefines = subMesh._getDrawWrapper(origRenderPassId)?.defines;
      mainDrawWrapper.defines = typeof originalDefines === "string" ? null : originalDefines ?? null;
      params = {
        drawWrapper: [],
        mainDrawWrapper,
        depthDefines: "",
        token: RandomGUID()
      };
      params.drawWrapper[passIdForDrawWrapper] = mainDrawWrapper;
      this._subMeshToDepthWrapper.set(subMesh, shadowGenerator, params);
    }
    const join = defines.join("\n");
    if (params.mainDrawWrapper.effect) {
      if (join === params.depthDefines) {
        return params.mainDrawWrapper.effect;
      }
    }
    params.depthDefines = join;
    const uniforms = origEffect.getUniformNames().slice();
    let vertexCode = origEffect.vertexSourceCodeBeforeMigration, fragmentCode = origEffect.fragmentSourceCodeBeforeMigration;
    if (!vertexCode && !fragmentCode) {
      return null;
    }
    if (!this.doNotInjectCode) {
      const vertexNormalBiasCode = this._options && this._options.remappedVariables ? `#include<shadowMapVertexNormalBias>(${this._options.remappedVariables.join(",")})` : `#include<shadowMapVertexNormalBias>`, vertexMetricCode = this._options && this._options.remappedVariables ? `#include<shadowMapVertexMetric>(${this._options.remappedVariables.join(",")})` : `#include<shadowMapVertexMetric>`, fragmentSoftTransparentShadow = this._options && this._options.remappedVariables ? `#include<shadowMapFragmentSoftTransparentShadow>(${this._options.remappedVariables.join(",")})` : `#include<shadowMapFragmentSoftTransparentShadow>`, fragmentBlockCode = `#include<shadowMapFragment>`, vertexExtraDeclartion = `#include<shadowMapVertexExtraDeclaration>`;
      if (origEffect.shaderLanguage === 0) {
        vertexCode = vertexCode.replace(/void\s+?main/g, `
${vertexExtraDeclartion}
void main`);
      } else {
        vertexCode = vertexCode.replace(/@vertex/g, `
${vertexExtraDeclartion}
@vertex`);
      }
      vertexCode = vertexCode.replace(/#define SHADOWDEPTH_NORMALBIAS|#define CUSTOM_VERTEX_UPDATE_WORLDPOS/g, vertexNormalBiasCode);
      if (vertexCode.indexOf("#define SHADOWDEPTH_METRIC") !== -1) {
        vertexCode = vertexCode.replace(/#define SHADOWDEPTH_METRIC/g, vertexMetricCode);
      } else {
        vertexCode = vertexCode.replace(/}\s*$/g, vertexMetricCode + "\n}");
      }
      vertexCode = vertexCode.replace(/#define SHADER_NAME.*?\n|out vec4 glFragColor;\n/g, "");
      const hasLocationForSoftTransparentShadow = fragmentCode.indexOf("#define SHADOWDEPTH_SOFTTRANSPARENTSHADOW") >= 0 || fragmentCode.indexOf("#define CUSTOM_FRAGMENT_BEFORE_FOG") >= 0;
      const hasLocationForFragment = fragmentCode.indexOf("#define SHADOWDEPTH_FRAGMENT") !== -1;
      let fragmentCodeToInjectAtEnd = "";
      if (!hasLocationForSoftTransparentShadow) {
        fragmentCodeToInjectAtEnd = fragmentSoftTransparentShadow + "\n";
      } else {
        fragmentCode = fragmentCode.replace(/#define SHADOWDEPTH_SOFTTRANSPARENTSHADOW|#define CUSTOM_FRAGMENT_BEFORE_FOG/g, fragmentSoftTransparentShadow);
      }
      fragmentCode = fragmentCode.replace(/void\s+?main/g, Effect.IncludesShadersStore["shadowMapFragmentExtraDeclaration"] + "\nvoid main");
      if (hasLocationForFragment) {
        fragmentCode = fragmentCode.replace(/#define SHADOWDEPTH_FRAGMENT/g, fragmentBlockCode);
      } else {
        fragmentCodeToInjectAtEnd += fragmentBlockCode + "\n";
      }
      if (fragmentCodeToInjectAtEnd) {
        fragmentCode = fragmentCode.replace(/}\s*$/g, fragmentCodeToInjectAtEnd + "}");
      }
      uniforms.push("biasAndScaleSM", "depthValuesSM", "lightDataSM", "softTransparentShadowSM");
    }
    params.mainDrawWrapper.effect = engine.createEffect({
      vertexSource: vertexCode,
      fragmentSource: fragmentCode,
      vertexToken: params.token,
      fragmentToken: params.token
    }, {
      attributes: origEffect.getAttributesNames(),
      uniformsNames: uniforms,
      uniformBuffersNames: origEffect.getUniformBuffersNames(),
      samplers: origEffect.getSamplers(),
      defines: join + "\n" + origEffect.defines.replace("#define SHADOWS", "").replace(/#define SHADOW\d/g, ""),
      indexParameters: origEffect.getIndexParameters(),
      shaderLanguage: origEffect.shaderLanguage
    }, engine);
    for (let id = 0; id < params.drawWrapper.length; ++id) {
      if (id !== passIdForDrawWrapper) {
        params.drawWrapper[id]?.setEffect(params.mainDrawWrapper.effect, params.mainDrawWrapper.defines);
      }
    }
    return params.mainDrawWrapper.effect;
  }
}
function GetGaussianSplattingMaxPartCount(engine) {
  const uniformsPerSplat = 5;
  const reservedUniforms = 40;
  const absoluteMax = 256;
  const maxUniformVectors = engine.getCaps().maxVertexUniformVectors;
  const available = Math.max(maxUniformVectors - reservedUniforms, 0);
  const maxFromUniforms = Math.floor(available / uniformsPerSplat);
  return Math.min(Math.max(maxFromUniforms, 1), absoluteMax);
}
const GaussianSplattingMaxPartCount = 128;
function GetPartIndexVaryingDeclaration(shaderLanguage) {
  const decl = shaderLanguage === 1 ? "varying vPartIndex: f32;" : "varying float vPartIndex;";
  return `
#if !defined(VPARTINDEX_VARYING_DECLARED)
#define VPARTINDEX_VARYING_DECLARED
${decl}
#endif
`;
}
class GaussianSplattingMaterialDefinesBase extends PrepassDefinesMixin(MaterialDefines) {
}
class GaussianSplattingMaterialDefines extends GaussianSplattingMaterialDefinesBase {
  /**
   * Constructor of the defines.
   * @param externalProperties External properties (e.g. from material plugins) to add to the defines.
   */
  constructor(externalProperties) {
    super(externalProperties);
    this.FOG = false;
    this.THIN_INSTANCES = true;
    this.LOGARITHMICDEPTH = false;
    this.CLIPPLANE = false;
    this.CLIPPLANE2 = false;
    this.CLIPPLANE3 = false;
    this.CLIPPLANE4 = false;
    this.CLIPPLANE5 = false;
    this.CLIPPLANE6 = false;
    this.SH_DEGREE = 0;
    this.COMPENSATION = false;
    this.IS_COMPOUND = false;
    this.MAX_PART_COUNT = GaussianSplattingMaxPartCount;
    this.USE_SOG = false;
    this.USE_SOG_V2 = false;
    this.rebuild();
  }
  /**
   * Checks if a define is part of the generated define list.
   * @param name define name to check
   * @returns true if the define exists
   */
  hasDefine(name) {
    return this._keys.indexOf(name) !== -1;
  }
}
class GaussianSplattingMaterial extends PushMaterial {
  /**
   * Instantiates a Gaussian Splatting Material in the given scene
   * @param name The friendly name of the material
   * @param scene The scene to add the material to
   */
  constructor(name, scene) {
    super(name, scene);
    this.kernelSize = GaussianSplattingMaterial.KernelSize;
    this.minPixelSize = GaussianSplattingMaterial.MinPixelSize;
    this._compensation = GaussianSplattingMaterial.Compensation;
    this._isDirty = false;
    this._sourceMesh = null;
    this._inverseProjection = Matrix.Identity();
    this._geometryProjectionUpdateFlag = -1;
    this._partMotionHistory = /* @__PURE__ */ new Map();
    this._renderPassObserver = null;
    this._voxelMissingTextureWarned = /* @__PURE__ */ new Set();
    this._voxelPartWorldData = new Float32Array(0);
    this._voxelPartVisibilityData = [];
    this.backFaceCulling = false;
    this.shadowDepthWrapper = GaussianSplattingMaterial._MakeGaussianSplattingShadowDepthWrapper(scene, this.shaderLanguage);
  }
  /**
   * Set compensation default value is `GaussianSplattingMaterial.Compensation`
   */
  set compensation(value) {
    this._isDirty = this._isDirty || this._compensation !== value;
    this._compensation = value;
  }
  /**
   * Get compensation
   */
  get compensation() {
    return this._compensation;
  }
  /**
   * Gets a boolean indicating that current material needs to register RTT
   */
  get hasRenderTargetTextures() {
    return false;
  }
  /**
   * Specifies whether or not this material should be rendered in alpha test mode.
   * @returns false
   */
  needAlphaTesting() {
    return false;
  }
  /**
   * Specifies whether or not this material should be rendered in alpha blend mode.
   * @returns true
   */
  needAlphaBlending() {
    return true;
  }
  static _BindViewportAndFocal(effect, camera, renderWidth, renderHeight, invViewportWidth = renderWidth) {
    effect.setFloat2("invViewport", 1 / invViewportWidth, 1 / renderHeight);
    if (camera) {
      const projection = camera.getProjectionMatrix();
      effect.setFloat2("focal", renderWidth * projection.m[0] / 2, renderHeight * projection.m[5] / 2);
    } else {
      effect.setFloat2("focal", 1e3, 1e3);
    }
  }
  /**
   * Checks whether the material is ready to be rendered for a given mesh.
   * @param mesh The mesh to render
   * @param subMesh The submesh to check against
   * @returns true if all the dependencies are ready (Textures, Effects...)
   */
  isReadyForSubMesh(mesh, subMesh) {
    const useInstances = true;
    const drawWrapper = subMesh._drawWrapper;
    let defines = subMesh.materialDefines;
    if (defines && this._isDirty) {
      defines.markAsUnprocessed();
    }
    if (drawWrapper.effect && this.isFrozen) {
      if (drawWrapper._wasPreviouslyReady && drawWrapper._wasPreviouslyUsingInstances === useInstances) {
        return true;
      }
    }
    if (!subMesh.materialDefines || this.pluginManager) {
      this._callbackPluginEventGeneric(4, this._eventInfo);
      const defineNames = this._eventInfo.defineNames;
      const needsNewDefines = !subMesh.materialDefines || defineNames && Object.keys(defineNames).some((name) => !defines.hasDefine(name));
      if (needsNewDefines) {
        defines = subMesh.materialDefines = new GaussianSplattingMaterialDefines(defineNames);
      }
    }
    const scene = this.getScene();
    if (this._isReadyForSubMesh(subMesh)) {
      return true;
    }
    this._eventInfo.isReadyForSubMesh = true;
    this._eventInfo.defines = defines;
    this._eventInfo.subMesh = subMesh;
    this._callbackPluginEventIsReadyForSubMesh(this._eventInfo);
    if (!this._eventInfo.isReadyForSubMesh) {
      return false;
    }
    if (!this._sourceMesh) {
      return false;
    }
    const engine = scene.getEngine();
    const gsMesh = this._sourceMesh;
    MaterialHelperGeometryRendering.PrepareDefines(engine.currentRenderPassId, gsMesh, defines);
    PrepareDefinesForMisc(mesh, scene, this._useLogarithmicDepth, this.pointsCloud, this.fogEnabled, false, defines, void 0, void 0, void 0, this._isVertexOutputInvariant);
    PrepareDefinesForFrameBoundValues(scene, engine, this, defines, useInstances, null, true);
    this._eventInfo.defines = defines;
    this._eventInfo.mesh = mesh;
    this._callbackPluginEventPrepareDefinesBeforeAttributes(this._eventInfo);
    PrepareDefinesForAttributes(mesh, defines, false, false);
    this._callbackPluginEventPrepareDefines(this._eventInfo);
    if (engine.version > 1 || engine.isWebGPU) {
      defines["SH_DEGREE"] = gsMesh.shDegree;
    }
    defines["IS_COMPOUND"] = gsMesh.isCompound;
    defines["MAX_PART_COUNT"] = GetGaussianSplattingMaxPartCount(engine);
    if (gsMesh.isCompound && (defines.PREPASS_VELOCITY || defines.PREPASS_VELOCITY_LINEAR)) {
      defines.MAX_PART_COUNT = Math.min(defines.MAX_PART_COUNT, Math.max(1, Math.floor((engine.getCaps().maxVertexUniformVectors - 53) / 9)));
      if (gsMesh.partCount > defines.MAX_PART_COUNT) {
        throw new Error(`GaussianSplattingMaterial "${this.name}": geometry velocity supports at most ${defines.MAX_PART_COUNT} compound parts on this engine`);
      }
    }
    defines["USE_SOG"] = gsMesh.useSog;
    defines["USE_SOG_V2"] = gsMesh.useSog && gsMesh.sogParams?.version === 2;
    const splatMaterial = gsMesh.material;
    defines["COMPENSATION"] = splatMaterial?.compensation ?? GaussianSplattingMaterial.Compensation;
    if (defines.isDirty) {
      defines.markAsProcessed();
      scene.resetCachedMaterial();
      PrepareAttributesForInstances(GaussianSplattingMaterial._Attribs, defines);
      const attribs = GaussianSplattingMaterial._Attribs.slice();
      const uniforms = GaussianSplattingMaterial._Uniforms.slice();
      const samplers = GaussianSplattingMaterial._Samplers.slice();
      const uniformBuffers = GaussianSplattingMaterial._UniformBuffers.slice();
      MaterialHelperGeometryRendering.AddUniformsAndSamplers(uniforms, samplers);
      PrepareUniformsAndSamplersList({
        uniformsNames: uniforms,
        uniformBuffersNames: uniformBuffers,
        samplers,
        defines
      });
      AddClipPlaneUniforms(uniforms);
      if (!this._uniformBufferLayoutBuilt) {
        this.buildUniformLayout();
      }
      this._eventInfo.fallbackRank = 0;
      this._eventInfo.defines = defines;
      this._eventInfo.attributes = attribs;
      this._eventInfo.uniforms = uniforms;
      this._eventInfo.samplers = samplers;
      this._eventInfo.uniformBuffersNames = uniformBuffers;
      this._eventInfo.customCode = void 0;
      this._eventInfo.mesh = mesh;
      this._callbackPluginEventGeneric(128, this._eventInfo);
      const join = defines.toString();
      const effect = scene.getEngine().createEffect("gaussianSplatting", {
        attributes: attribs,
        uniformsNames: uniforms,
        uniformBuffersNames: uniformBuffers,
        samplers,
        defines: join,
        onCompiled: this.onCompiled,
        onError: this.onError,
        indexParameters: { SCENE_MRT_COUNT: defines.SCENE_MRT_COUNT },
        processCodeAfterIncludes: this._eventInfo.customCode,
        multiTarget: defines.PREPASS,
        shaderLanguage: this._shaderLanguage,
        extraInitializationsAsync: async () => {
          if (this._shaderLanguage === 1) {
            await Promise.all([__vitePreload(() => import("./gaussianSplatting.fragment-Du8CLf6s.js"), true ? __vite__mapDeps([0,1,2,3,4,5,6,7,8,9]) : void 0), __vitePreload(() => import("./gaussianSplatting.vertex-DDOQD5tp.js"), true ? __vite__mapDeps([10,1,11,12,13,14,15,3,16,17]) : void 0)]);
          } else {
            await Promise.all([__vitePreload(() => import("./gaussianSplatting.fragment-BI6w5YIC.js"), true ? __vite__mapDeps([18,1,19,20,21,22,23,24,25,26]) : void 0), __vitePreload(() => import("./gaussianSplatting.vertex-CUbuogMB.js"), true ? __vite__mapDeps([27,1,28,29,30,31,32,20,33,34]) : void 0)]);
          }
        }
      }, engine);
      subMesh.setEffect(effect, defines, this._materialContext);
    }
    if (!subMesh.effect || !subMesh.effect.isReady()) {
      return false;
    }
    defines._renderId = scene.getRenderId();
    drawWrapper._wasPreviouslyReady = true;
    drawWrapper._wasPreviouslyUsingInstances = useInstances;
    this._isDirty = false;
    return true;
  }
  /**
   * GaussianSplattingMaterial belongs to a single mesh
   * @param mesh mesh this material belongs to
   */
  setSourceMesh(mesh) {
    if (this._sourceMesh !== mesh) {
      this._partMotionHistory.clear();
    }
    this._sourceMesh = mesh;
  }
  /**
   * Gets the source mesh of this material, which is the Gaussian Splatting mesh that provides the data for rendering
   * @returns The Gaussian Splatting mesh that provides the data for rendering, or null if not set
   */
  getSourceMesh() {
    return this._sourceMesh;
  }
  /**
   * Bind material effect for a specific Gaussian Splatting mesh
   * @param mesh Gaussian splatting mesh
   * @param effect Splatting material or node material
   * @param scene scene that contains mesh and camera used for rendering
   */
  static BindEffect(mesh, effect, scene) {
    const engine = scene.getEngine();
    const camera = scene.activeCamera;
    const renderWidth = engine.getRenderWidth() * (camera?.viewport.width ?? 1);
    const renderHeight = engine.getRenderHeight() * (camera?.viewport.height ?? 1);
    const material = mesh.material;
    const gsMaterial = material instanceof GaussianSplattingMaterial ? material : null;
    const gsMesh = gsMaterial?._sourceMesh ?? mesh.reservedDataStore?._gaussianSplattingSourceMesh;
    if (!gsMesh) {
      return;
    }
    const numberOfRigs = camera?.rigParent?.rigCameras.length || 1;
    GaussianSplattingMaterial._BindViewportAndFocal(effect, camera, renderWidth, renderHeight, renderWidth / numberOfRigs);
    effect.setFloat("kernelSize", gsMaterial?.kernelSize || GaussianSplattingMaterial.KernelSize);
    effect.setFloat("minPixelSize", gsMaterial ? gsMaterial.minPixelSize : GaussianSplattingMaterial.MinPixelSize);
    effect.setFloat("alpha", material?.alpha ?? 1);
    scene.bindEyePosition(effect, "eyePosition", true);
    if (gsMesh.covariancesATexture) {
      const textureSize = gsMesh.covariancesATexture.getSize();
      effect.setFloat2("dataTextureSize", textureSize.width, textureSize.height);
      effect.setTexture("covariancesATexture", gsMesh.covariancesATexture);
      effect.setTexture("covariancesBTexture", gsMesh.covariancesBTexture);
      effect.setTexture("centersTexture", gsMesh.centersTexture);
      effect.setTexture("colorsTexture", gsMesh.colorsTexture);
      if (gsMesh.useSog) {
        GaussianSplattingMaterial._BindSogUniforms(gsMesh, effect);
      } else if (gsMesh.shTextures) {
        for (let i = 0; i < gsMesh.shTextures.length; i++) {
          effect.setTexture(`shTexture${i}`, gsMesh.shTextures[i]);
        }
      }
      gsMesh.bindExtraEffectUniforms(effect);
    }
  }
  _bindGeometryRendering(effect, defines, mustRebind) {
    const sourceMesh = this._sourceMesh;
    if (!sourceMesh || !defines.PREPASS) {
      return;
    }
    const scene = this.getScene();
    const engine = scene.getEngine();
    const renderPassId = engine.currentRenderPassId;
    const configuration = MaterialHelperGeometryRendering.GetConfiguration(renderPassId);
    if (!configuration) {
      return;
    }
    MaterialHelperGeometryRendering.Bind(renderPassId, effect, sourceMesh, sourceMesh.getWorldMatrix(), this);
    MaterialHelperGeometryRendering._BindZeroAlphaDiscard(engine, effect);
    const camera = scene.activeCamera;
    if (camera) {
      if (defines.PREPASS_POSITION || defines.PREPASS_LOCAL_POSITION || defines.PREPASS_VELOCITY || defines.PREPASS_VELOCITY_LINEAR) {
        const projection = camera.getProjectionMatrix();
        if (projection.updateFlag !== this._geometryProjectionUpdateFlag) {
          projection.invertToRef(this._inverseProjection);
          this._geometryProjectionUpdateFlag = projection.updateFlag;
        }
        effect.setMatrix("inverseProjection", this._inverseProjection);
      }
      if (defines.PREPASS_NORMALIZED_VIEW_DEPTH) {
        effect.setFloat2("geometryDepthRange", camera.minZ, camera.maxZ);
      }
    }
    if (!mustRebind) {
      sourceMesh.bindExtraEffectUniforms(effect);
    }
    if (!sourceMesh.isCompound || !defines.PREPASS_VELOCITY && !defines.PREPASS_VELOCITY_LINEAR) {
      return;
    }
    const partCount = sourceMesh.partCount;
    let history = this._partMotionHistory.get(renderPassId);
    if (!history || history.configuration !== configuration || history.currentPartWorldMatrices.length !== partCount) {
      if (partCount > defines.MAX_PART_COUNT) {
        throw new Error(`GaussianSplattingMaterial "${this.name}": geometry velocity supports at most ${defines.MAX_PART_COUNT} compound parts on this engine`);
      }
      const currentPartWorldMatrices = new Array(partCount);
      for (let i = 0; i < partCount; i++) {
        currentPartWorldMatrices[i] = sourceMesh.getWorldMatrixForPart(i).clone();
      }
      history = {
        configuration,
        currentPartWorldMatrices,
        previousPartWorldData: new Float32Array(partCount * 16),
        lastUpdateFrameId: -1
      };
      this._partMotionHistory.set(renderPassId, history);
      this._renderPassObserver ?? (this._renderPassObserver = (engine._onReleaseRenderPassObservable ?? (engine._onReleaseRenderPassObservable = new Observable())).add((id) => this._partMotionHistory.delete(id)));
    }
    if (history.lastUpdateFrameId !== engine.frameId) {
      const consecutiveFrame = history.lastUpdateFrameId === engine.frameId - 1;
      for (let i = 0; i < partCount; i++) {
        const previous = consecutiveFrame ? history.currentPartWorldMatrices[i] : sourceMesh.getWorldMatrixForPart(i);
        previous.toArray(history.previousPartWorldData, i * 16);
      }
      history.lastUpdateFrameId = engine.frameId;
    }
    effect.setMatrices("previousPartWorld", history.previousPartWorldData);
    for (let i = 0; i < partCount; i++) {
      history.currentPartWorldMatrices[i].copyFrom(sourceMesh.getWorldMatrixForPart(i));
    }
  }
  /**
   * Releases the material and its render-pass motion histories.
   * @param forceDisposeEffect whether associated effects should be disposed
   * @param forceDisposeTextures whether associated textures should be disposed
   * @param notBoundToMesh whether mesh references can be left unchanged
   */
  dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh) {
    this.getScene().getEngine()._onReleaseRenderPassObservable?.remove(this._renderPassObserver);
    this._renderPassObserver = null;
    this._partMotionHistory.clear();
    super.dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh);
  }
  /**
   * Bind SOG dequantization uniforms + raw textures.
   * @internal
   */
  static _BindSogUniforms(gsMesh, effect) {
    const p = gsMesh.sogParams;
    if (!p) {
      return;
    }
    effect.setTexture("sogQuatsTexture", gsMesh.rotationsATexture);
    if (gsMesh.shTextures && gsMesh.shTextures.length >= 2) {
      effect.setTexture("sogShNCentroidsTexture", gsMesh.shTextures[0]);
      effect.setTexture("sogShNLabelsTexture", gsMesh.shTextures[1]);
    }
    if (p.codebookTexture) {
      effect.setTexture("sogCodebookTexture", p.codebookTexture);
    }
    effect.setFloat3("sogMeansMin", p.meansMin[0], p.meansMin[1], p.meansMin[2]);
    effect.setFloat3("sogMeansMax", p.meansMax[0], p.meansMax[1], p.meansMax[2]);
    if (p.scalesMin && p.scalesMax) {
      effect.setFloat3("sogScalesMin", p.scalesMin[0], p.scalesMin[1], p.scalesMin[2]);
      effect.setFloat3("sogScalesMax", p.scalesMax[0], p.scalesMax[1], p.scalesMax[2]);
    }
    if (p.sh0Min && p.sh0Max) {
      effect.setFloat4("sogSh0Min", p.sh0Min[0], p.sh0Min[1], p.sh0Min[2], p.sh0Min[3]);
      effect.setFloat4("sogSh0Max", p.sh0Max[0], p.sh0Max[1], p.sh0Max[2], p.sh0Max[3]);
    }
    effect.setFloat("sogShnMin", p.shnMin ?? 0);
    effect.setFloat("sogShnMax", p.shnMax ?? 0);
    effect.setFloat("sogShCoeffCount", p.shCoeffCount ?? 0);
  }
  /**
   * Binds the submesh to this material by preparing the effect and shader to draw
   * @param world defines the world transformation matrix
   * @param mesh defines the mesh containing the submesh
   * @param subMesh defines the submesh to bind the material to
   */
  bindForSubMesh(world, mesh, subMesh) {
    const scene = this.getScene();
    const defines = subMesh.materialDefines;
    if (!defines) {
      return;
    }
    const effect = subMesh.effect;
    if (!effect) {
      return;
    }
    this._activeEffect = effect;
    mesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
    mesh.transferToEffect(world);
    const mustRebind = this._mustRebind(scene, effect, subMesh, mesh.visibility);
    if (mustRebind) {
      this.bindView(effect);
      this.bindViewProjection(effect);
      GaussianSplattingMaterial.BindEffect(mesh, this._activeEffect, scene);
      BindClipPlane(effect, this, scene);
    } else if (scene.getEngine()._features.needToAlwaysBindUniformBuffers) {
      this._needToBindSceneUbo = true;
    }
    this._bindGeometryRendering(effect, defines, mustRebind);
    BindFogParameters(scene, mesh, effect);
    if (this.useLogarithmicDepth) {
      BindLogDepth(defines, effect, scene);
    }
    this._eventInfo.subMesh = subMesh;
    this._callbackPluginEventBindForSubMesh(this._eventInfo);
    this._afterBind(mesh, this._activeEffect, subMesh);
  }
  static _BindEffectUniforms(gsMesh, gsMaterial, shaderMaterial, scene) {
    const engine = scene.getEngine();
    const effect = shaderMaterial.getEffect();
    const camera = scene.activeCamera;
    if (!camera) {
      return;
    }
    gsMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
    shaderMaterial.bindView(effect);
    shaderMaterial.bindViewProjection(effect);
    const renderWidth = engine.getRenderWidth() * camera.viewport.width;
    const renderHeight = engine.getRenderHeight() * camera.viewport.height;
    GaussianSplattingMaterial._BindViewportAndFocal(effect, camera, renderWidth, renderHeight);
    effect.setFloat("kernelSize", gsMaterial && gsMaterial.kernelSize ? gsMaterial.kernelSize : GaussianSplattingMaterial.KernelSize);
    effect.setFloat("minPixelSize", gsMaterial ? gsMaterial.minPixelSize : GaussianSplattingMaterial.MinPixelSize);
    effect.setFloat("alpha", gsMaterial.alpha);
    let minZ, maxZ;
    const cameraIsOrtho = camera.mode === Camera.ORTHOGRAPHIC_CAMERA;
    if (cameraIsOrtho) {
      minZ = !engine.useReverseDepthBuffer && engine.isNDCHalfZRange ? 0 : 1;
      maxZ = engine.useReverseDepthBuffer && engine.isNDCHalfZRange ? 0 : 1;
    } else {
      minZ = engine.useReverseDepthBuffer && engine.isNDCHalfZRange ? camera.minZ : engine.isNDCHalfZRange ? 0 : camera.minZ;
      maxZ = engine.useReverseDepthBuffer && engine.isNDCHalfZRange ? 0 : camera.maxZ;
    }
    effect.setFloat2("depthValues", minZ, minZ + maxZ);
    if (gsMesh.covariancesATexture) {
      const textureSize = gsMesh.covariancesATexture.getSize();
      effect.setFloat2("dataTextureSize", textureSize.width, textureSize.height);
      effect.setTexture("covariancesATexture", gsMesh.covariancesATexture);
      effect.setTexture("covariancesBTexture", gsMesh.covariancesBTexture);
      effect.setTexture("centersTexture", gsMesh.centersTexture);
      effect.setTexture("colorsTexture", gsMesh.colorsTexture);
      gsMesh.bindExtraEffectUniforms(effect);
    }
  }
  _bindVoxelEffectUniforms(gsMesh, gsMaterial, shaderMaterial) {
    if (!gsMesh.rotationsATexture) {
      gsMesh.needsRotationScaleTextures = true;
      if (!gsMesh.rotationsATexture) {
        if (gsMesh.centersTexture && !gsMesh.splatsData && !this._voxelMissingTextureWarned.has(gsMesh.uniqueId)) {
          this._voxelMissingTextureWarned.add(gsMesh.uniqueId);
          Logger.Error("IBL voxelization: GaussianSplattingMesh rotation/scale textures are not available. Create the mesh either with keepInRam=true or needsRotationScaleTextures=true to enable IBL shadow voxelization.");
        }
        return false;
      }
    }
    this._voxelMissingTextureWarned.delete(gsMesh.uniqueId);
    const effect = shaderMaterial.getEffect();
    gsMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
    const textureSize = gsMesh.rotationsATexture.getSize();
    effect.setFloat("alpha", gsMaterial.alpha);
    effect.setFloat2("dataTextureSize", textureSize.width, textureSize.height);
    effect.setTexture("rotationsATexture", gsMesh.rotationsATexture);
    effect.setTexture("rotationsBTexture", gsMesh.rotationsBTexture);
    effect.setTexture("rotationScaleTexture", gsMesh.rotationScaleTexture);
    effect.setTexture("centersTexture", gsMesh.centersTexture);
    effect.setTexture("colorsTexture", gsMesh.colorsTexture);
    if (gsMesh.partIndicesTexture) {
      effect.setTexture("partIndicesTexture", gsMesh.partIndicesTexture);
      const partWorldDataLength = gsMesh.partCount * 16;
      if (this._voxelPartWorldData.length !== partWorldDataLength) {
        this._voxelPartWorldData = new Float32Array(partWorldDataLength);
      }
      const partWorldData = this._voxelPartWorldData;
      for (let i = 0; i < gsMesh.partCount; i++) {
        gsMesh.getWorldMatrixForPart(i).toArray(partWorldData, i * 16);
      }
      effect.setMatrices("partWorld", partWorldData);
      const partVisibilityData = this._voxelPartVisibilityData;
      partVisibilityData.length = gsMesh.partCount;
      for (let i = 0; i < gsMesh.partCount; i++) {
        partVisibilityData[i] = gsMesh.partVisibility[i] ?? 1;
      }
      effect.setArray("partVisibility", partVisibilityData);
    }
    return true;
  }
  /**
   * Create a voxel rendering material for a Gaussian Splatting mesh, for use with IBL shadow voxelization.
   * The returned ShaderMaterial's onBindObservable binds the GS mesh-side uniforms (textures, alpha, dataTextureSize, part data).
   * The caller (e.g. iblShadowsVoxelRenderer) is responsible for setting the per-slab uniforms on the returned material:
   * viewMatrix, invWorldScale, nearPlane, farPlane, stepSize.
   * @param scene scene it belongs to
   * @param shaderLanguage GLSL or WGSL
   * @param maxDrawBuffers number of draw buffers (MRT outputs) per voxelization slab
   * @param compoundMesh whether the mesh is a compound mesh
   * @returns voxel rendering shader material
   */
  makeVoxelRenderingMaterial(scene, shaderLanguage, maxDrawBuffers, compoundMesh = false) {
    const defines = [`#define MAX_DRAW_BUFFERS ${maxDrawBuffers}`];
    defines.push("#define IS_FOR_VOXELIZATION");
    if (compoundMesh) {
      defines.push("#define IS_COMPOUND 1");
      defines.push(`#define MAX_PART_COUNT ${GetGaussianSplattingMaxPartCount(scene.getEngine())}`);
    }
    const shaderMaterial = new ShaderMaterial("gaussianSplattingVoxelRender", scene, {
      vertex: "gaussianSplattingVoxel",
      fragment: "gaussianSplattingVoxel"
    }, {
      attributes: GaussianSplattingMaterial._Attribs,
      uniforms: GaussianSplattingMaterial._VoxelUniforms,
      samplers: GaussianSplattingMaterial._VoxelSamplers,
      uniformBuffers: GaussianSplattingMaterial._UniformBuffers,
      // WebGPU accumulates non-binary voxel opacity via atomicMax into this storage buffer.
      storageBuffers: shaderLanguage === 1 ? ["voxelOpacityBuffer"] : [],
      shaderLanguage,
      defines,
      needAlphaBlending: false,
      extraInitializationsAsync: async () => {
        if (shaderLanguage === 1) {
          await Promise.all([__vitePreload(() => import("./gaussianSplattingVoxel.vertex-Dtui2WbI.js"), true ? __vite__mapDeps([35,1,11,12,16]) : void 0), __vitePreload(() => import("./gaussianSplattingVoxel.fragment-CSRdi2-M.js"), true ? __vite__mapDeps([36,1,37]) : void 0)]);
        } else {
          await Promise.all([__vitePreload(() => import("./gaussianSplattingVoxel.vertex-CK3pcERo.js"), true ? __vite__mapDeps([38,1,28,29,30]) : void 0), __vitePreload(() => import("./gaussianSplattingVoxel.fragment-DaipUjUL.js"), true ? __vite__mapDeps([39,1]) : void 0)]);
        }
      }
    });
    shaderMaterial.cullBackFaces = false;
    shaderMaterial.backFaceCulling = false;
    shaderMaterial.depthFunction = Engine.ALWAYS;
    shaderMaterial.onBindObservable.add((mesh) => {
      const gsMaterial = mesh.material;
      const gsMesh = mesh;
      this._bindVoxelEffectUniforms(gsMesh, gsMaterial, shaderMaterial);
    });
    return shaderMaterial;
  }
  /**
   * Create a depth rendering material for a Gaussian Splatting mesh
   * @param scene scene it belongs to
   * @param shaderLanguage GLSL or WGSL
   * @param alphaBlendedDepth whether to enable alpha blended depth rendering
   * @param compoundMesh whether the mesh is a compound mesh
   * @returns depth rendering shader material
   */
  makeDepthRenderingMaterial(scene, shaderLanguage, alphaBlendedDepth = false, compoundMesh = false) {
    const defines = ["#define DEPTH_RENDER"];
    if (alphaBlendedDepth) {
      defines.push("#define ALPHA_BLENDED_DEPTH");
    }
    if (compoundMesh) {
      defines.push("#define IS_COMPOUND 1");
      defines.push(`#define MAX_PART_COUNT ${GetGaussianSplattingMaxPartCount(scene.getEngine())}`);
    }
    const shaderMaterial = new ShaderMaterial("gaussianSplattingDepthRender", scene, {
      vertex: "gaussianSplattingDepth",
      fragment: "gaussianSplattingDepth"
    }, {
      attributes: GaussianSplattingMaterial._Attribs,
      uniforms: GaussianSplattingMaterial._Uniforms,
      samplers: GaussianSplattingMaterial._Samplers,
      uniformBuffers: GaussianSplattingMaterial._UniformBuffers,
      shaderLanguage,
      defines,
      needAlphaBlending: alphaBlendedDepth
    });
    shaderMaterial.doNotSerialize = true;
    shaderMaterial.backFaceCulling = false;
    shaderMaterial.onBindObservable.add((mesh) => {
      const gsMaterial = mesh.material;
      const gsMesh = gsMaterial?.getSourceMesh() ?? mesh;
      GaussianSplattingMaterial._BindEffectUniforms(gsMesh, gsMaterial, shaderMaterial, scene);
    });
    return shaderMaterial;
  }
  static _MakeGaussianSplattingShadowDepthWrapper(scene, shaderLanguage) {
    const shaderMaterial = new ShaderMaterial("gaussianSplattingDepth", scene, {
      vertex: "gaussianSplattingDepth",
      fragment: "gaussianSplattingDepth"
    }, {
      attributes: GaussianSplattingMaterial._Attribs,
      uniforms: GaussianSplattingMaterial._Uniforms,
      samplers: GaussianSplattingMaterial._Samplers,
      uniformBuffers: GaussianSplattingMaterial._UniformBuffers,
      shaderLanguage
    });
    shaderMaterial.doNotSerialize = true;
    shaderMaterial.backFaceCulling = false;
    const shadowDepthWrapper = new ShadowDepthWrapper(shaderMaterial, scene, {
      standalone: true
    });
    shaderMaterial.onBindObservable.add((mesh) => {
      const gsMaterial = mesh.material;
      const gsMesh = gsMaterial?.getSourceMesh() ?? mesh;
      GaussianSplattingMaterial._BindEffectUniforms(gsMesh, gsMaterial, shaderMaterial, scene);
    });
    return shadowDepthWrapper;
  }
  /**
   * Clones the material.
   * @param name The cloned name.
   * @returns The cloned material.
   */
  clone(name) {
    const clone = SerializationHelper.Clone(() => new GaussianSplattingMaterial(name, this.getScene()), this);
    clone.id = name;
    clone.name = name;
    this._clonePlugins(clone, "");
    return clone;
  }
  /**
   * Serializes the current material to its JSON representation.
   * @returns The JSON representation.
   */
  serialize() {
    const serializationObject = super.serialize();
    serializationObject.customType = "BABYLON.GaussianSplattingMaterial";
    return serializationObject;
  }
  /**
   * Gets the class name of the material
   * @returns "GaussianSplattingMaterial"
   */
  getClassName() {
    return "GaussianSplattingMaterial";
  }
  /**
   * Parse a JSON input to create back a Gaussian Splatting material.
   * @param source The JSON data to parse
   * @param scene The scene to create the parsed material in
   * @param rootUrl The root url of the assets the material depends upon
   * @returns the instantiated GaussianSplattingMaterial.
   */
  static Parse(source, scene, rootUrl) {
    const material = SerializationHelper.Parse(() => new GaussianSplattingMaterial(source.name, scene), source, scene, rootUrl);
    Material._ParsePlugins(source, material, scene, rootUrl);
    return material;
  }
}
GaussianSplattingMaterial.KernelSize = 0.3;
GaussianSplattingMaterial.Compensation = false;
GaussianSplattingMaterial.MinPixelSize = 0;
GaussianSplattingMaterial._Attribs = [VertexBuffer.PositionKind, "splatIndex0", "splatIndex1", "splatIndex2", "splatIndex3"];
GaussianSplattingMaterial._Samplers = [
  "covariancesATexture",
  "covariancesBTexture",
  "centersTexture",
  "colorsTexture",
  "shTexture0",
  "shTexture1",
  "shTexture2",
  "shTexture3",
  "shTexture4",
  "partIndicesTexture",
  "sogQuatsTexture",
  "sogShNCentroidsTexture",
  "sogShNLabelsTexture",
  "sogCodebookTexture"
];
GaussianSplattingMaterial._UniformBuffers = ["Scene", "Mesh"];
GaussianSplattingMaterial._VoxelUniforms = [
  "world",
  "dataTextureSize",
  "alpha",
  "invWorldScale",
  "viewMatrix",
  "nearPlane",
  "farPlane",
  "stepSize",
  "partWorld",
  "partVisibility",
  "axis"
];
GaussianSplattingMaterial._VoxelSamplers = ["rotationsATexture", "rotationsBTexture", "rotationScaleTexture", "centersTexture", "colorsTexture", "partIndicesTexture"];
GaussianSplattingMaterial._Uniforms = [
  "world",
  "view",
  "projection",
  "inverseProjection",
  "vFogInfos",
  "vFogColor",
  "logarithmicDepthConstant",
  "invViewport",
  "dataTextureSize",
  "focal",
  "eyePosition",
  "kernelSize",
  "minPixelSize",
  "alpha",
  "depthValues",
  "geometryDepthRange",
  "geometryZeroAlphaDiscard",
  "partWorld",
  "previousPartWorld",
  "partVisibility",
  "sogMeansMin",
  "sogMeansMax",
  "sogScalesMin",
  "sogScalesMax",
  "sogSh0Min",
  "sogSh0Max",
  "sogShnMin",
  "sogShnMax",
  "sogShCoeffCount"
];
let _Registered$2 = false;
function RegisterGaussianSplattingMaterial() {
  if (_Registered$2) {
    return;
  }
  _Registered$2 = true;
  RegisterClass("BABYLON.GaussianSplattingMaterial", GaussianSplattingMaterial);
}
const HCF = HighestCommonFactor;
const Scalar = {
  ...functions,
  /**
   * Two pi constants convenient for computation.
   */
  TwoPi: Math.PI * 2,
  /**
   * Returns -1 if value is negative and +1 is value is positive.
   * @param value the value
   * @returns the value itself if it's equal to zero.
   */
  Sign: Math.sign,
  /**
   * the log2 of value.
   * @param value the value to compute log2 of
   * @returns the log2 of value.
   */
  Log2: Math.log2,
  /**
   * Returns the highest common factor of two integers.
   * @param a first parameter
   * @param b second parameter
   * @returns HCF of a and b
   */
  HCF
};
const GaussianSplattingSortWorkerCommand = {
  /** Main -> worker: set the source splat centers (stride 4: xyz + 1). */
  POSITIONS: "positions",
  /** Main -> worker: patch a contiguous sub-range of the existing source splat centers in place. */
  POSITIONS_UPDATE: "positionsUpdate",
  /** Main -> worker: set the compound-mesh rig node matrices. */
  PART_MATRICES: "partMatrices",
  /** Main -> worker: set the compound-mesh per-splat rig node indices. */
  PART_INDICES: "partIndices",
  /** Main -> worker: set the active source-splat ranges (flat [start0, count0, ...]). */
  INTERVALS: "intervals",
  /** Main -> worker: sort the active splats for a camera view. */
  SORT: "sort",
  /** Worker -> main: a completed sort result. */
  SORTED: "sorted"
};
const GaussianSplattingSortWorker = function(self) {
  let positions;
  let vertexCount = 0;
  let depthMix;
  let partIndices;
  let partMatrices;
  let intervals = null;
  let sortSourceIndices;
  let sortDepths;
  let sortKeys;
  let sortCounts;
  self.onmessage = (e) => {
    const command = e.data.command;
    if (command === "positions") {
      positions = e.data.positions;
      vertexCount = e.data.vertexCount;
    } else if (command === "positionsUpdate") {
      if (positions && e.data.data) {
        positions.set(e.data.data, e.data.offset);
      }
    } else if (command === "partMatrices") {
      partMatrices = e.data.partMatrices;
    } else if (command === "partIndices") {
      partIndices = e.data.partIndices;
    } else if (command === "intervals") {
      intervals = e.data.intervals;
    } else if (command === "sort") {
      const cameraId = e.data.cameraId;
      const sortRequestId = e.data.sortRequestId;
      const rangeVersion = e.data.rangeVersion;
      const globalWorldMatrix = e.data.worldMatrix;
      const cameraForward = e.data.cameraForward;
      const cameraPosition = e.data.cameraPosition;
      depthMix = e.data.depthMix;
      if (!positions || !cameraForward) {
        self.postMessage({ command: "sorted", depthMix, cameraId, sortRequestId, rangeVersion }, [depthMix.buffer]);
        return;
      }
      const useCountingSort = e.data.useCountingSort !== false;
      const logSortPerformance = !!e.data.logSortPerformance;
      const depthSign = e.data.rightHanded ? -1 : 1;
      const activeIntervals = intervals;
      const totalSplats = positions.length / 4;
      const emptySplatIndex = vertexCount;
      let renderSplatCount = totalSplats;
      if (activeIntervals) {
        renderSplatCount = 0;
        for (let rangeIndex = 1; rangeIndex < activeIntervals.length; rangeIndex += 2) {
          renderSplatCount += activeIntervals[rangeIndex];
        }
      }
      const vertexCountPadded = Math.max(renderSplatCount + 15 & -16, 16);
      const camDot = cameraForward[0] * cameraPosition[0] + cameraForward[1] * cameraPosition[1] + cameraForward[2] * cameraPosition[2];
      const computeDepthCoeffs = (m) => {
        return [
          cameraForward[0] * m[0] + cameraForward[1] * m[1] + cameraForward[2] * m[2],
          cameraForward[0] * m[4] + cameraForward[1] * m[5] + cameraForward[2] * m[6],
          cameraForward[0] * m[8] + cameraForward[1] * m[9] + cameraForward[2] * m[10],
          cameraForward[0] * m[12] + cameraForward[1] * m[13] + cameraForward[2] * m[14] - camDot
        ];
      };
      const perf = globalThis.performance;
      const sortStart = logSortPerformance && perf ? perf.now() : 0;
      try {
        if (useCountingSort) {
          const outIndices = new Uint32Array(depthMix.buffer);
          if (!sortSourceIndices || sortSourceIndices.length < renderSplatCount) {
            const capacity = Math.max(renderSplatCount, 16);
            sortSourceIndices = new Uint32Array(capacity);
            sortDepths = new Float32Array(capacity);
            sortKeys = new Uint32Array(capacity);
          }
          const compound = !!(partMatrices && partMatrices.length > 0 && partIndices && partIndices.length > 0);
          let depthCoeffs = [];
          let partLen = 0;
          let a = 0;
          let b = 0;
          let c = 0;
          let d = 0;
          if (compound) {
            depthCoeffs = partMatrices.map((m) => {
              const co = computeDepthCoeffs(m);
              co[0] *= depthSign;
              co[1] *= depthSign;
              co[2] *= depthSign;
              co[3] *= depthSign;
              return co;
            });
            partLen = partIndices.length;
          } else {
            const coeff = computeDepthCoeffs(globalWorldMatrix);
            a = coeff[0] * depthSign;
            b = coeff[1] * depthSign;
            c = coeff[2] * depthSign;
            d = coeff[3] * depthSign;
          }
          let writeIndex = 0;
          let minDepth = Infinity;
          let maxDepth = -Infinity;
          const partCount = depthCoeffs.length;
          let inconsistentSnapshot = false;
          const rangeWords = activeIntervals ? activeIntervals.length : 2;
          gather: for (let r = 0; r < rangeWords; r += 2) {
            const start = activeIntervals ? activeIntervals[r] : 0;
            const end = start + (activeIntervals ? activeIntervals[r + 1] : totalSplats);
            if (compound) {
              for (let sourceIndex = start; sourceIndex < end; sourceIndex++) {
                const o = 4 * sourceIndex;
                const rawPart = partIndices[sourceIndex < partLen ? sourceIndex : partLen - 1];
                if (rawPart >= partCount) {
                  inconsistentSnapshot = true;
                  break gather;
                }
                const coeff = depthCoeffs[rawPart];
                const depth = coeff[0] * positions[o] + coeff[1] * positions[o + 1] + coeff[2] * positions[o + 2] + coeff[3];
                sortSourceIndices[writeIndex] = sourceIndex;
                sortDepths[writeIndex] = depth;
                writeIndex++;
                if (depth < minDepth) {
                  minDepth = depth;
                }
                if (depth > maxDepth) {
                  maxDepth = depth;
                }
              }
            } else {
              for (let sourceIndex = start; sourceIndex < end; sourceIndex++) {
                const o = 4 * sourceIndex;
                const depth = a * positions[o] + b * positions[o + 1] + c * positions[o + 2] + d;
                sortSourceIndices[writeIndex] = sourceIndex;
                sortDepths[writeIndex] = depth;
                writeIndex++;
                if (depth < minDepth) {
                  minDepth = depth;
                }
                if (depth > maxDepth) {
                  maxDepth = depth;
                }
              }
            }
          }
          if (inconsistentSnapshot) {
            self.postMessage({ command: "sorted", depthMix, cameraId, sortRequestId, rangeVersion }, [depthMix.buffer]);
            return;
          }
          const compareBits = Math.max(10, Math.min(20, Math.round(Math.log2(Math.max(1, renderSplatCount) / 4))));
          const bucketCount = 2 ** compareBits + 1;
          if (!sortCounts || sortCounts.length !== bucketCount) {
            sortCounts = new Uint32Array(bucketCount);
          } else {
            sortCounts.fill(0);
          }
          const range = maxDepth - minDepth;
          if (!(range > 1e-12)) {
            for (let k = 0; k < renderSplatCount; k++) {
              sortKeys[k] = 0;
            }
            sortCounts[0] = renderSplatCount;
          } else {
            const scale = (bucketCount - 1) / range;
            const maxKey = bucketCount - 1;
            for (let k = 0; k < renderSplatCount; k++) {
              let key = (maxDepth - sortDepths[k]) * scale >>> 0;
              if (key > maxKey) {
                key = maxKey;
              }
              sortKeys[k] = key;
              sortCounts[key]++;
            }
          }
          for (let i = 1; i < bucketCount; i++) {
            sortCounts[i] += sortCounts[i - 1];
          }
          for (let k = 0; k < renderSplatCount; k++) {
            const dest = --sortCounts[sortKeys[k]];
            outIndices[2 * dest] = sortSourceIndices[k];
          }
          for (let dest = renderSplatCount; dest < vertexCountPadded; dest++) {
            outIndices[2 * dest] = emptySplatIndex;
          }
        } else {
          const indices = new Uint32Array(depthMix.buffer);
          const floatMix = new Float32Array(depthMix.buffer);
          if (activeIntervals) {
            let writeIndex = 0;
            for (let rangeIndex = 0; rangeIndex < activeIntervals.length; rangeIndex += 2) {
              const start = activeIntervals[rangeIndex];
              const count = activeIntervals[rangeIndex + 1];
              for (let sourceIndex = start; sourceIndex < start + count; sourceIndex++) {
                indices[2 * writeIndex++] = sourceIndex;
              }
            }
            for (; writeIndex < vertexCountPadded; writeIndex++) {
              indices[2 * writeIndex] = emptySplatIndex;
            }
          } else {
            for (let j = 0; j < vertexCountPadded; j++) {
              indices[2 * j] = j;
            }
          }
          let inconsistentSnapshot = false;
          if (partMatrices && partMatrices.length > 0 && partIndices && partIndices.length > 0) {
            const depthCoeffs = partMatrices.map((m) => computeDepthCoeffs(m));
            const length = partIndices.length;
            for (let j = 0; j < vertexCountPadded; j++) {
              const sourceIndex = indices[2 * j];
              const partIndex = partIndices[Math.min(sourceIndex, length - 1)];
              if (partIndex >= depthCoeffs.length) {
                inconsistentSnapshot = true;
                break;
              }
              const coeff = depthCoeffs[partIndex];
              floatMix[2 * j + 1] = coeff[0] * positions[4 * sourceIndex + 0] + coeff[1] * positions[4 * sourceIndex + 1] + coeff[2] * positions[4 * sourceIndex + 2] + coeff[3];
              indices[2 * j + 1] = ~indices[2 * j + 1];
            }
          } else {
            const [a, b, c, d] = computeDepthCoeffs(globalWorldMatrix);
            for (let j = 0; j < vertexCountPadded; j++) {
              const sourceIndex = indices[2 * j];
              floatMix[2 * j + 1] = a * positions[4 * sourceIndex + 0] + b * positions[4 * sourceIndex + 1] + c * positions[4 * sourceIndex + 2] + d;
              indices[2 * j + 1] = ~indices[2 * j + 1];
            }
          }
          if (!inconsistentSnapshot) {
            depthMix.sort();
          }
        }
      } catch (sortError) {
        console.error("Gaussian splat sort worker encountered an error (will retry next frame):", sortError);
      }
      if (logSortPerformance && perf) {
        console.log(`[GaussianSplatting] ${useCountingSort ? "counting" : "legacy"} sort: ${renderSplatCount} splats in ${(perf.now() - sortStart).toFixed(2)}ms`);
      }
      self.postMessage({ command: "sorted", depthMix, cameraId, sortRequestId, rangeVersion }, [depthMix.buffer]);
    }
  };
};
const IsNative = typeof _native !== "undefined";
const Native = IsNative ? _native : null;
const UnpackUnorm = (value, bits) => {
  const t = (1 << bits) - 1;
  return (value & t) / t;
};
const Unpack111011 = (value, result) => {
  result.x = UnpackUnorm(value >>> 21, 11);
  result.y = UnpackUnorm(value >>> 11, 10);
  result.z = UnpackUnorm(value, 11);
};
const Unpack8888 = (value, result) => {
  result[0] = UnpackUnorm(value >>> 24, 8) * 255;
  result[1] = UnpackUnorm(value >>> 16, 8) * 255;
  result[2] = UnpackUnorm(value >>> 8, 8) * 255;
  result[3] = UnpackUnorm(value, 8) * 255;
};
const UnpackRot = (value, result) => {
  const norm = 1 / (Math.sqrt(2) * 0.5);
  const a = (UnpackUnorm(value >>> 20, 10) - 0.5) * norm;
  const b = (UnpackUnorm(value >>> 10, 10) - 0.5) * norm;
  const c = (UnpackUnorm(value, 10) - 0.5) * norm;
  const m = Math.sqrt(1 - (a * a + b * b + c * c));
  switch (value >>> 30) {
    case 0:
      result.set(m, a, b, c);
      break;
    case 1:
      result.set(a, m, b, c);
      break;
    case 2:
      result.set(a, b, m, c);
      break;
    case 3:
      result.set(a, b, c, m);
      break;
  }
};
var PLYType;
(function(PLYType2) {
  PLYType2[PLYType2["FLOAT"] = 0] = "FLOAT";
  PLYType2[PLYType2["INT"] = 1] = "INT";
  PLYType2[PLYType2["UINT"] = 2] = "UINT";
  PLYType2[PLYType2["DOUBLE"] = 3] = "DOUBLE";
  PLYType2[PLYType2["UCHAR"] = 4] = "UCHAR";
  PLYType2[PLYType2["USHORT"] = 5] = "USHORT";
  PLYType2[PLYType2["UNDEFINED"] = 6] = "UNDEFINED";
})(PLYType || (PLYType = {}));
var PLYValue;
(function(PLYValue2) {
  PLYValue2[PLYValue2["MIN_X"] = 0] = "MIN_X";
  PLYValue2[PLYValue2["MIN_Y"] = 1] = "MIN_Y";
  PLYValue2[PLYValue2["MIN_Z"] = 2] = "MIN_Z";
  PLYValue2[PLYValue2["MAX_X"] = 3] = "MAX_X";
  PLYValue2[PLYValue2["MAX_Y"] = 4] = "MAX_Y";
  PLYValue2[PLYValue2["MAX_Z"] = 5] = "MAX_Z";
  PLYValue2[PLYValue2["MIN_SCALE_X"] = 6] = "MIN_SCALE_X";
  PLYValue2[PLYValue2["MIN_SCALE_Y"] = 7] = "MIN_SCALE_Y";
  PLYValue2[PLYValue2["MIN_SCALE_Z"] = 8] = "MIN_SCALE_Z";
  PLYValue2[PLYValue2["MAX_SCALE_X"] = 9] = "MAX_SCALE_X";
  PLYValue2[PLYValue2["MAX_SCALE_Y"] = 10] = "MAX_SCALE_Y";
  PLYValue2[PLYValue2["MAX_SCALE_Z"] = 11] = "MAX_SCALE_Z";
  PLYValue2[PLYValue2["PACKED_POSITION"] = 12] = "PACKED_POSITION";
  PLYValue2[PLYValue2["PACKED_ROTATION"] = 13] = "PACKED_ROTATION";
  PLYValue2[PLYValue2["PACKED_SCALE"] = 14] = "PACKED_SCALE";
  PLYValue2[PLYValue2["PACKED_COLOR"] = 15] = "PACKED_COLOR";
  PLYValue2[PLYValue2["X"] = 16] = "X";
  PLYValue2[PLYValue2["Y"] = 17] = "Y";
  PLYValue2[PLYValue2["Z"] = 18] = "Z";
  PLYValue2[PLYValue2["SCALE_0"] = 19] = "SCALE_0";
  PLYValue2[PLYValue2["SCALE_1"] = 20] = "SCALE_1";
  PLYValue2[PLYValue2["SCALE_2"] = 21] = "SCALE_2";
  PLYValue2[PLYValue2["DIFFUSE_RED"] = 22] = "DIFFUSE_RED";
  PLYValue2[PLYValue2["DIFFUSE_GREEN"] = 23] = "DIFFUSE_GREEN";
  PLYValue2[PLYValue2["DIFFUSE_BLUE"] = 24] = "DIFFUSE_BLUE";
  PLYValue2[PLYValue2["OPACITY"] = 25] = "OPACITY";
  PLYValue2[PLYValue2["F_DC_0"] = 26] = "F_DC_0";
  PLYValue2[PLYValue2["F_DC_1"] = 27] = "F_DC_1";
  PLYValue2[PLYValue2["F_DC_2"] = 28] = "F_DC_2";
  PLYValue2[PLYValue2["F_DC_3"] = 29] = "F_DC_3";
  PLYValue2[PLYValue2["ROT_0"] = 30] = "ROT_0";
  PLYValue2[PLYValue2["ROT_1"] = 31] = "ROT_1";
  PLYValue2[PLYValue2["ROT_2"] = 32] = "ROT_2";
  PLYValue2[PLYValue2["ROT_3"] = 33] = "ROT_3";
  PLYValue2[PLYValue2["MIN_COLOR_R"] = 34] = "MIN_COLOR_R";
  PLYValue2[PLYValue2["MIN_COLOR_G"] = 35] = "MIN_COLOR_G";
  PLYValue2[PLYValue2["MIN_COLOR_B"] = 36] = "MIN_COLOR_B";
  PLYValue2[PLYValue2["MAX_COLOR_R"] = 37] = "MAX_COLOR_R";
  PLYValue2[PLYValue2["MAX_COLOR_G"] = 38] = "MAX_COLOR_G";
  PLYValue2[PLYValue2["MAX_COLOR_B"] = 39] = "MAX_COLOR_B";
  PLYValue2[PLYValue2["SH_0"] = 40] = "SH_0";
  PLYValue2[PLYValue2["SH_1"] = 41] = "SH_1";
  PLYValue2[PLYValue2["SH_2"] = 42] = "SH_2";
  PLYValue2[PLYValue2["SH_3"] = 43] = "SH_3";
  PLYValue2[PLYValue2["SH_4"] = 44] = "SH_4";
  PLYValue2[PLYValue2["SH_5"] = 45] = "SH_5";
  PLYValue2[PLYValue2["SH_6"] = 46] = "SH_6";
  PLYValue2[PLYValue2["SH_7"] = 47] = "SH_7";
  PLYValue2[PLYValue2["SH_8"] = 48] = "SH_8";
  PLYValue2[PLYValue2["SH_9"] = 49] = "SH_9";
  PLYValue2[PLYValue2["SH_10"] = 50] = "SH_10";
  PLYValue2[PLYValue2["SH_11"] = 51] = "SH_11";
  PLYValue2[PLYValue2["SH_12"] = 52] = "SH_12";
  PLYValue2[PLYValue2["SH_13"] = 53] = "SH_13";
  PLYValue2[PLYValue2["SH_14"] = 54] = "SH_14";
  PLYValue2[PLYValue2["SH_15"] = 55] = "SH_15";
  PLYValue2[PLYValue2["SH_16"] = 56] = "SH_16";
  PLYValue2[PLYValue2["SH_17"] = 57] = "SH_17";
  PLYValue2[PLYValue2["SH_18"] = 58] = "SH_18";
  PLYValue2[PLYValue2["SH_19"] = 59] = "SH_19";
  PLYValue2[PLYValue2["SH_20"] = 60] = "SH_20";
  PLYValue2[PLYValue2["SH_21"] = 61] = "SH_21";
  PLYValue2[PLYValue2["SH_22"] = 62] = "SH_22";
  PLYValue2[PLYValue2["SH_23"] = 63] = "SH_23";
  PLYValue2[PLYValue2["SH_24"] = 64] = "SH_24";
  PLYValue2[PLYValue2["SH_25"] = 65] = "SH_25";
  PLYValue2[PLYValue2["SH_26"] = 66] = "SH_26";
  PLYValue2[PLYValue2["SH_27"] = 67] = "SH_27";
  PLYValue2[PLYValue2["SH_28"] = 68] = "SH_28";
  PLYValue2[PLYValue2["SH_29"] = 69] = "SH_29";
  PLYValue2[PLYValue2["SH_30"] = 70] = "SH_30";
  PLYValue2[PLYValue2["SH_31"] = 71] = "SH_31";
  PLYValue2[PLYValue2["SH_32"] = 72] = "SH_32";
  PLYValue2[PLYValue2["SH_33"] = 73] = "SH_33";
  PLYValue2[PLYValue2["SH_34"] = 74] = "SH_34";
  PLYValue2[PLYValue2["SH_35"] = 75] = "SH_35";
  PLYValue2[PLYValue2["SH_36"] = 76] = "SH_36";
  PLYValue2[PLYValue2["SH_37"] = 77] = "SH_37";
  PLYValue2[PLYValue2["SH_38"] = 78] = "SH_38";
  PLYValue2[PLYValue2["SH_39"] = 79] = "SH_39";
  PLYValue2[PLYValue2["SH_40"] = 80] = "SH_40";
  PLYValue2[PLYValue2["SH_41"] = 81] = "SH_41";
  PLYValue2[PLYValue2["SH_42"] = 82] = "SH_42";
  PLYValue2[PLYValue2["SH_43"] = 83] = "SH_43";
  PLYValue2[PLYValue2["SH_44"] = 84] = "SH_44";
  PLYValue2[PLYValue2["SH_45"] = 85] = "SH_45";
  PLYValue2[PLYValue2["SH_46"] = 86] = "SH_46";
  PLYValue2[PLYValue2["SH_47"] = 87] = "SH_47";
  PLYValue2[PLYValue2["SH_48"] = 88] = "SH_48";
  PLYValue2[PLYValue2["SH_49"] = 89] = "SH_49";
  PLYValue2[PLYValue2["SH_50"] = 90] = "SH_50";
  PLYValue2[PLYValue2["SH_51"] = 91] = "SH_51";
  PLYValue2[PLYValue2["SH_52"] = 92] = "SH_52";
  PLYValue2[PLYValue2["SH_53"] = 93] = "SH_53";
  PLYValue2[PLYValue2["SH_54"] = 94] = "SH_54";
  PLYValue2[PLYValue2["SH_55"] = 95] = "SH_55";
  PLYValue2[PLYValue2["SH_56"] = 96] = "SH_56";
  PLYValue2[PLYValue2["SH_57"] = 97] = "SH_57";
  PLYValue2[PLYValue2["SH_58"] = 98] = "SH_58";
  PLYValue2[PLYValue2["SH_59"] = 99] = "SH_59";
  PLYValue2[PLYValue2["SH_60"] = 100] = "SH_60";
  PLYValue2[PLYValue2["SH_61"] = 101] = "SH_61";
  PLYValue2[PLYValue2["SH_62"] = 102] = "SH_62";
  PLYValue2[PLYValue2["SH_63"] = 103] = "SH_63";
  PLYValue2[PLYValue2["SH_64"] = 104] = "SH_64";
  PLYValue2[PLYValue2["SH_65"] = 105] = "SH_65";
  PLYValue2[PLYValue2["SH_66"] = 106] = "SH_66";
  PLYValue2[PLYValue2["SH_67"] = 107] = "SH_67";
  PLYValue2[PLYValue2["SH_68"] = 108] = "SH_68";
  PLYValue2[PLYValue2["SH_69"] = 109] = "SH_69";
  PLYValue2[PLYValue2["SH_70"] = 110] = "SH_70";
  PLYValue2[PLYValue2["SH_71"] = 111] = "SH_71";
  PLYValue2[PLYValue2["UNDEFINED"] = 112] = "UNDEFINED";
})(PLYValue || (PLYValue = {}));
function _AcquireGsInterFrameYield(engine) {
  if (IsNative) {
    return;
  }
  const existing = engine.customAnimationFrameRequester;
  if (existing?._gsInterFrameYield) {
    existing._refCount++;
    return;
  }
  if (existing) {
    return;
  }
  let _timeoutId = 0;
  let _innerRafId = 0;
  const wrapper = {
    _gsInterFrameYield: true,
    _refCount: 1,
    requestAnimationFrame: (callback) => {
      _timeoutId = setTimeout(() => {
        _innerRafId = requestAnimationFrame(callback);
      }, 0);
      return _timeoutId;
    },
    cancelAnimationFrame: (_id) => {
      clearTimeout(_timeoutId);
      if (_innerRafId > 0) {
        cancelAnimationFrame(_innerRafId);
      }
      _timeoutId = 0;
      _innerRafId = 0;
    }
  };
  engine.customAnimationFrameRequester = wrapper;
}
function _ReleaseGsInterFrameYield(engine) {
  const existing = engine.customAnimationFrameRequester;
  if (!existing?._gsInterFrameYield) {
    return;
  }
  existing._refCount--;
  if (existing._refCount === 0) {
    engine.customAnimationFrameRequester = null;
  }
}
class GaussianSplattingMeshBase extends Mesh {
  /**
   * Returns a byte-accurate view for retained splat data, preserving any non-zero byte offset.
   * @param data The retained splat source bytes.
   * @returns A Uint8Array covering the exact source byte range.
   * @internal
   */
  static _GetSplatDataBytes(data) {
    return ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
  }
  /**
   * Returns a Float32 reinterpretation for retained splat data, copying only when alignment requires it.
   * @param data The retained splat source bytes.
   * @returns A Float32Array over the exact source byte range.
   * @internal
   */
  static _GetSplatDataFloats(data) {
    const bytes = GaussianSplattingMeshBase._GetSplatDataBytes(data);
    const floatSize = Float32Array.BYTES_PER_ELEMENT;
    if (bytes.byteLength % floatSize !== 0) {
      throw new Error(`Gaussian splat data byte length (${bytes.byteLength}) is not divisible by ${floatSize} and cannot be reinterpreted as Float32 data.`);
    }
    if (bytes.byteOffset % floatSize !== 0) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Float32Array(copy.buffer, 0, bytes.byteLength / floatSize);
    }
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / floatSize);
  }
  static _BuildSplatRangeData(ranges, vertexCount) {
    if (ranges === null) {
      return { ranges: null, count: vertexCount, key: "" };
    }
    const rangePairs = [];
    let totalCount = 0;
    let key = "";
    for (const range of ranges) {
      const start = Math.max(0, Math.floor(range.offset));
      const count = Math.max(0, Math.floor(range.count));
      const end = Math.min(vertexCount, start + count);
      const rangeCount = Math.max(0, end - start);
      if (rangeCount === 0) {
        continue;
      }
      rangePairs.push(start, rangeCount);
      totalCount += rangeCount;
      key += `${start}:${rangeCount};`;
    }
    return { ranges: new Uint32Array(rangePairs), count: totalCount, key };
  }
  /**
   * If true, disables depth sorting of the splats (default: false)
   * Disabling sorting also discards deferred forced-sort requests.
   */
  get disableDepthSort() {
    return this._disableDepthSort;
  }
  set disableDepthSort(value) {
    if (!this._disableDepthSort && value) {
      this._worker?.terminate();
      this._worker = null;
      this._disableDepthSort = true;
      this._forcedSortPending = false;
    } else if (this._disableDepthSort && !value) {
      this._disableDepthSort = false;
      this._sortIsDirty = true;
      this._instantiateWorker();
    }
  }
  /**
   * View direction factor used to compute the SH view direction in the shader.
   * @deprecated Not used anymore for SH rendering
   */
  get viewDirectionFactor() {
    return Vector3.OneReadOnly;
  }
  /**
   * SH degree. 0 = no sh (default). 1 = 3 parameters. 2 = 8 parameters. 3 = 15 parameters.
   * Value is clamped between 0 and the maximum degree available from loaded data.
   */
  get shDegree() {
    return this._shDegree;
  }
  set shDegree(value) {
    const maxDegree = this._maxShDegree;
    const clamped = Math.max(0, Math.min(Math.round(value), maxDegree));
    if (this._shDegree === clamped) {
      return;
    }
    this._shDegree = clamped;
    this.material?.resetDrawCache();
  }
  /**
   * Maximum SH degree available from the loaded data.
   */
  get maxShDegree() {
    return this._maxShDegree;
  }
  /**
   * Number of splats in the mesh
   */
  get splatCount() {
    return this._splatIndex?.length;
  }
  /**
   * Number of source splats currently selected for rendering.
   * When no range filter is active, this is the mesh's full source splat count.
   */
  get renderedSplatCount() {
    return this._activeSplatRanges ? this._activeSplatRenderCount : this._vertexCount;
  }
  /**
   * Restricts rendering to the provided source splat ranges.
   * Passing `null` clears the range filter and renders the full source splat set.
   * @param ranges contiguous source ranges to render, or null to render all splats
   */
  setSplatIndexRanges(ranges) {
    this._setSplatIndexRanges(ranges);
  }
  _setSplatIndexRanges(ranges) {
    const rangeData = GaussianSplattingMeshBase._BuildSplatRangeData(ranges, this._vertexCount);
    const isSameRangeSet = this._activeSplatRanges === null ? rangeData.ranges === null : rangeData.ranges !== null && this._activeSplatRangeKey === rangeData.key;
    if (isSameRangeSet) {
      return;
    }
    this._activeSplatRanges = rangeData.ranges;
    this._activeSplatRangeKey = rangeData.key;
    this._activeSplatRenderCount = rangeData.count;
    this._activeRangeVersion++;
    this._postIntervalsToWorker();
    if (this._worker) {
      this._ensureDepthMixSize(Math.max(this._activeSplatRenderCount + 15 & -16, 16));
      this._sortIsDirty = true;
      this._postToWorker(true);
    } else {
      this._updateSplatIndexBuffer(this._vertexCount);
      this._postToWorker(true);
    }
  }
  /**
   * Whether the depth sort is settled: a sort computed for the current active ranges and camera has been
   * applied to the rendered index buffer, and no further sort is pending or in flight (including a forced sort
   * deferred until a classic pass needs it). For a static camera
   * and a fixed active set this becomes true once the final sort completes. Used by streaming subclasses to
   * detect when rendering is fully up to date (e.g. for deterministic screenshots) and by IBL shadows to
   * avoid voxelizing against an index buffer the worker has not finished (re)building yet.
   * @internal
   */
  get _isDepthSortSettled() {
    return this._readyToDisplay && !this._sortIsDirty && !this._forcedSortPending && this._canPostToWorker;
  }
  // (Re)allocates the worker depth buffer to the given padded size. A fresh array is allocated when the
  // size differs or the current buffer is detached (in-flight in the worker), so a queued sort can be
  // re-posted with a correctly-sized buffer without disturbing the in-flight one.
  _ensureDepthMixSize(paddedCount) {
    if (IsNative) {
      return;
    }
    if (!this._depthMix || this._depthMix.length !== paddedCount || this._depthMix.buffer.byteLength === 0) {
      this._depthMix = new BigInt64Array(paddedCount);
    }
  }
  /**
   * Sends the active source-splat intervals to the sort worker. When no range filter is active,
   * a single interval covering all source splats is sent so the worker never assumes the full set.
   */
  _postIntervalsToWorker() {
    if (!this._worker) {
      return;
    }
    const intervals = this._activeSplatRanges ? new Uint32Array(this._activeSplatRanges) : new Uint32Array([0, this._vertexCount]);
    this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.INTERVALS, intervals }, [intervals.buffer]);
  }
  /**
   * Initializes this mesh to render from an externally-provided, GPU-decoded work buffer, bypassing the
   * CPU `updateData` path. The four textures must hold the standard decoded GS layout addressed by linear
   * splat index over a square texture: centers (x,y,z,1), covariance A (Sigma00,01,02,11) and B
   * (Sigma12,22,*,*) as full covariance (so `center.w` is 1), and RGBA color. `splatPositions` are the
   * stride-4 CPU centers consumed by the depth-sort worker.
   * @param centers centers texture
   * @param covariancesA covariance A texture
   * @param covariancesB covariance B texture
   * @param colors color texture
   * @param splatPositions stride-4 CPU centers for depth sorting (length vertexCount*4)
   * @param vertexCount number of splats addressable in the work buffer
   * @param shTextures optional baked higher-order SH textures (packed-u32) produced by the work buffer's SH decode.
   *   When provided, the draw path lights the decoded splats with view-dependent SH (the non-SOG `shTexture0..N`
   *   path). `shDegree` sets both the max and active SH degree.
   * @param shDegree SH degree of the baked SH textures (0 = none). Ignored when `shTextures` is empty/omitted.
   * @param rotationTextures optional decoded rotation/scale textures ([rotA, rotB, rotScale]) produced by the work
   *   buffer's rotation decode. When provided, they drive the voxel-IBL rotation/scale samplers so the streamed
   *   splats participate in voxel-based IBL shadowing.
   */
  _setExternalWorkBuffer(centers, covariancesA, covariancesB, colors, splatPositions, vertexCount, shTextures, shDegree = 0, rotationTextures) {
    this._covariancesATexture = covariancesA;
    this._covariancesBTexture = covariancesB;
    this._centersTexture = centers;
    this._colorsTexture = colors;
    this._splatPositions = splatPositions;
    this._vertexCount = vertexCount;
    if (shTextures && shTextures.length) {
      this._shTextures = shTextures;
      this._maxShDegree = shDegree;
      this._shDegree = shDegree;
    }
    if (rotationTextures && rotationTextures.length >= 3) {
      this._rotationsATexture = rotationTextures[0];
      this._rotationsBTexture = rotationTextures[1];
      this._rotationScaleTexture = rotationTextures[2];
      this._needsRotationScaleTextures = true;
    }
    this._activeSplatRanges = null;
    this._activeSplatRangeKey = "";
    this._activeSplatRenderCount = 0;
    this._readyToDisplay = false;
    this._instantiateWorker();
    this.setEnabled(true);
  }
  /**
   * returns the splats data array buffer that contains in order : postions (3 floats), size (3 floats), color (4 bytes), orientation quaternion (4 bytes)
   * Only available if the mesh was created with keepInRam: true
   */
  get splatsData() {
    return this._keepInRam ? this._splatsData : null;
  }
  /**
   * returns the SH data arrays
   * Only available if the mesh was created with keepInRam: true
   */
  get shData() {
    return this._keepInRam ? this._shData : null;
  }
  /**
   * Returns the min/max size range of splats in this mesh, where size is pow(|det(Σ)|, 1/6)
   * of the 3D covariance matrix — equivalent to the geometric mean of the principal radii.
   * Computed automatically during updateData(). Returns null before any data has been loaded.
   */
  get splatSizeRange() {
    if (!isFinite(this._splatSizeMin) || !isFinite(this._splatSizeMax)) {
      return null;
    }
    return { min: this._splatSizeMin, max: this._splatSizeMax };
  }
  /**
   * Gets the covariancesA texture
   */
  get covariancesATexture() {
    return this._covariancesATexture;
  }
  /**
   * Gets the covariancesB texture
   */
  get covariancesBTexture() {
    return this._covariancesBTexture;
  }
  /**
   * Gets the centers texture
   */
  get centersTexture() {
    return this._centersTexture;
  }
  /**
   * Gets the colors texture
   */
  get colorsTexture() {
    return this._colorsTexture;
  }
  /**
   * Gets the rotation matrix A texture (rotation elements m[0],m[1],m[2],m[4])
   */
  get rotationsATexture() {
    return this._rotationsATexture;
  }
  /**
   * Gets the rotation matrix B texture (rotation elements m[5],m[6],m[8],m[9])
   */
  get rotationsBTexture() {
    return this._rotationsBTexture;
  }
  /**
   * Gets the rotation scale texture (rotation element m[10] followed by scale diagonal sx,sy,sz)
   */
  get rotationScaleTexture() {
    return this._rotationScaleTexture;
  }
  /**
   * Enables or disables generation of rotation and scale matrix textures, required for voxel-based IBL shadows.
   */
  get needsRotationScaleTextures() {
    return this._needsRotationScaleTextures;
  }
  set needsRotationScaleTextures(value) {
    if (this._needsRotationScaleTextures === value) {
      return;
    }
    this._needsRotationScaleTextures = value;
    if (value && this._covariancesATexture) {
      if (this._splatsData) {
        this.updateData(this._splatsData, this._shData ?? void 0, { flipY: false }, void 0, this._shDegree);
      } else {
        Logger.Error("GaussianSplattingMeshBase: needsRotationScaleTextures was enabled after the mesh was already loaded, but the splat data is not kept in RAM. The rotation and scale matrix textures cannot be initialized. Please reload the mesh data via updateData() or construct with keepInRam=true.");
      }
    }
  }
  /**
   * Gets the SH textures
   */
  get shTextures() {
    return this._shTextures;
  }
  /**
   * True when this mesh holds raw SOG webp textures (dequantized in-shader) rather than the
   * pre-decoded covariance/center/color textures produced by the standard splat loader.
   */
  get useSog() {
    return this._useSog;
  }
  /**
   * SOG dequantization parameters paired with the raw textures.
   * Set by the splat loader when `useSogTextures: true`. Null otherwise.
   */
  get sogParams() {
    return this._sogParams;
  }
  /**
   * Install a set of raw SOG webp textures and bind the mesh to the in-shader dequantization path.
   * @param pack SOG texture pack produced by ParseSogMetaAsTextures.
   * @internal
   */
  setSogTextureData(pack) {
    this._useSog = true;
    this._sogParams?.codebookTexture?.dispose();
    this._sogParams = pack;
    this._vertexCount = pack.splatCount;
    this._shDegree = pack.shDegree ?? 0;
    this._maxShDegree = this._shDegree;
    this._splatPositions = pack.positions;
    this._covariancesATexture?.dispose();
    this._covariancesBTexture?.dispose();
    this._centersTexture?.dispose();
    this._colorsTexture?.dispose();
    this._rotationsATexture?.dispose();
    if (this._shTextures) {
      for (const t of this._shTextures) {
        t.dispose();
      }
    }
    this._centersTexture = pack.meansTextureL;
    this._covariancesATexture = pack.meansTextureU;
    this._covariancesBTexture = pack.scalesTexture;
    this._rotationsATexture = pack.quatsTexture;
    this._colorsTexture = pack.sh0Texture;
    const shTextures = [];
    if (pack.shCentroidsTexture) {
      shTextures.push(pack.shCentroidsTexture);
    }
    if (pack.shLabelsTexture) {
      shTextures.push(pack.shLabelsTexture);
    }
    this._shTextures = shTextures.length ? shTextures : null;
    this._material?.resetDrawCache();
    const size = pack.meansTextureL.getSize();
    this._textureSize.x = size.width;
    this._textureSize.y = size.height;
    this._updateSplatIndexBuffer(this._vertexCount);
    this._instantiateWorker();
    const positions = pack.positions;
    const minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    for (let i = 0; i < this._vertexCount; i++) {
      const x = positions[i * 4 + 0];
      const y = positions[i * 4 + 1];
      const z = positions[i * 4 + 2];
      if (x < minimum.x) {
        minimum.x = x;
      }
      if (y < minimum.y) {
        minimum.y = y;
      }
      if (z < minimum.z) {
        minimum.z = z;
      }
      if (x > maximum.x) {
        maximum.x = x;
      }
      if (y > maximum.y) {
        maximum.y = y;
      }
      if (z > maximum.z) {
        maximum.z = z;
      }
    }
    this.getBoundingInfo().reConstruct(minimum, maximum, this.getWorldMatrix());
    this.setEnabled(true);
    this._sortIsDirty = true;
  }
  /**
   * Gets the kernel size
   * Documentation and mathematical explanations here:
   * https://github.com/graphdeco-inria/gaussian-splatting/issues/294#issuecomment-1772688093
   * https://github.com/autonomousvision/mip-splatting/issues/18#issuecomment-1929388931
   */
  get kernelSize() {
    return this._material instanceof GaussianSplattingMaterial ? this._material.kernelSize : 0;
  }
  /**
   * Get the compensation state
   */
  get compensation() {
    return this._material instanceof GaussianSplattingMaterial ? this._material.compensation : false;
  }
  /**
   * Minimum projected splat size, in pixels, below which a splat is discarded (0 = disabled).
   * Applied in real time; no rebuild required.
   */
  get minPixelSize() {
    return this._material instanceof GaussianSplattingMaterial ? this._material.minPixelSize : 0;
  }
  set minPixelSize(value) {
    if (this._material instanceof GaussianSplattingMaterial) {
      this._material.minPixelSize = Math.max(0, value);
    }
  }
  /**
   * Sets the rendering material and updates camera views. Notifies material-change observers when the material changes.
   */
  set material(value) {
    const previous = this._material;
    this._material = value;
    if (value) {
      value.backFaceCulling = false;
      value.cullBackFaces = false;
      value.resetDrawCache();
    }
    this._cameraViewInfos?.forEach((cameraViewInfo) => {
      cameraViewInfo.mesh.material = value;
    });
    if (previous !== value && this.onMaterialChangedObservable.hasObservers()) {
      this.onMaterialChangedObservable.notifyObservers(this);
    }
  }
  /**
   * get rendering material
   */
  get material() {
    return this._material;
  }
  static _MakeSplatGeometryForMesh(mesh) {
    const vertexData = new VertexData();
    const originPositions = [-2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2, 0];
    const originIndices = [0, 1, 2, 0, 2, 3];
    const positions = [];
    const indices = [];
    for (let i = 0; i < GaussianSplattingMeshBase._BatchSize; i++) {
      for (let j = 0; j < 12; j++) {
        if (j == 2 || j == 5 || j == 8 || j == 11) {
          positions.push(i);
        } else {
          positions.push(originPositions[j]);
        }
      }
      indices.push(originIndices.map((v) => v + i * 4));
    }
    vertexData.positions = positions;
    vertexData.indices = indices.flat();
    vertexData.applyToMesh(mesh);
  }
  /**
   * Creates a new gaussian splatting mesh
   * @param name defines the name of the mesh
   * @param url defines the url to load from (optional)
   * @param scene defines the hosting scene (optional)
   * @param keepInRam keep datas in ram for editing purpose
   */
  constructor(name, url = null, scene = null, keepInRam = false) {
    super(name, scene);
    this.safeOrbitCameraLimits = null;
    this._vertexCount = 0;
    this._worker = null;
    this._modelViewProjectionMatrix = Matrix.Identity();
    this._canPostToWorker = true;
    this._readyToDisplay = false;
    this._sortRequestId = 0;
    this._activeRangeVersion = 0;
    this._hasRenderedOnce = false;
    this._covariancesATexture = null;
    this._covariancesBTexture = null;
    this._centersTexture = null;
    this._colorsTexture = null;
    this._mrtAtlas = null;
    this._useMrtAtlas = false;
    this._shMrtAtlas = null;
    this._useShMrtAtlas = false;
    this._shMrtAtlasTextureCount = 0;
    this._rotationsATexture = null;
    this._rotationsBTexture = null;
    this._rotationScaleTexture = null;
    this._rotMrtAtlas = null;
    this._useRotMrtAtlas = false;
    this._rotationDataA = null;
    this._rotationDataB = null;
    this._rotationScaleData = null;
    this._needsRotationScaleTextures = false;
    this._splatPositions = null;
    this._splatIndex = null;
    this._shTextures = null;
    this._splatsData = null;
    this._shData = null;
    this._textureSize = new Vector2(0, 0);
    this._keepInRam = false;
    this._alwaysRetainSplatsData = false;
    this._flipY = false;
    this._delayedTextureUpdate = null;
    this._useRGBACovariants = false;
    this._useSog = false;
    this._sogParams = null;
    this._material = null;
    this._tmpCovariances = [0, 0, 0, 0, 0, 0];
    this._splatSizeMin = Infinity;
    this._splatSizeMax = -Infinity;
    this._sortIsDirty = false;
    this._forcedSortPending = false;
    this._activeSplatRanges = null;
    this._activeSplatRangeKey = "";
    this._activeSplatRenderCount = 0;
    this._cachedBoundingMin = null;
    this._cachedBoundingMax = null;
    this._shDegree = 0;
    this._splatDataRevision = 0;
    this._splatDataPending = false;
    this._maxShDegree = 0;
    this._cameraViewInfos = /* @__PURE__ */ new Map();
    this.onPartCountChangedObservable = new Observable();
    this.onPartRemovedObservable = new Observable();
    this._onBeforeAtlasRebuildObservable = new Observable();
    this._onAfterAtlasRebuildObservable = new Observable();
    this.viewUpdateThreshold = GaussianSplattingMeshBase._DefaultViewUpdateThreshold;
    this._disableDepthSort = false;
    this._loadingPromise = null;
    this._updateTextureFromData = (texture, data, width, lineStart, lineCount) => {
      const engine = this._getTextureDataUpdateEngine();
      const internalTexture = texture.getInternalTexture();
      if (!engine._gl && !engine.isWebGPU && lineStart === 0 && lineCount === internalTexture.height) {
        engine.updateRawTexture(internalTexture, data, internalTexture.format, internalTexture.invertY, null, internalTexture.type, internalTexture._useSRGBBuffer);
        return;
      }
      engine.updateTextureData(internalTexture, data, 0, lineStart, width, lineCount, 0, 0, false);
    };
    this._updateTextureFromDataRect = (texture, data, xOffset, yOffset, width, height) => {
      const engine = this._getTextureDataUpdateEngine();
      engine.updateTextureData(texture.getInternalTexture(), data, xOffset, yOffset, width, height, 0, 0, false);
    };
    this.subMeshes = [];
    new SubMesh(0, 0, 4 * GaussianSplattingMeshBase._BatchSize, 0, 6 * GaussianSplattingMeshBase._BatchSize, this);
    this.setEnabled(false);
    this._useRGBACovariants = !this.getEngine().isWebGPU && this.getEngine().version === 1;
    _AcquireGsInterFrameYield(this.getEngine());
    this._keepInRam = keepInRam;
    if (url) {
      this._loadingPromise = this.loadFileAsync(url);
    }
    const gaussianSplattingMaterial = new GaussianSplattingMaterial(this.name + "_material", this._scene);
    gaussianSplattingMaterial.setSourceMesh(this);
    gaussianSplattingMaterial.doNotSerialize = true;
    this._material = gaussianSplattingMaterial;
    this._scene.onCameraRemovedObservable.add((camera) => {
      const cameraId = camera.uniqueId;
      const cameraViewInfos = this._cameraViewInfos.get(cameraId);
      if (cameraViewInfos) {
        if (this._geometry === cameraViewInfos.mesh.geometry) {
          this._geometry = null;
        }
        cameraViewInfos.mesh.dispose();
        this._cameraViewInfos.delete(cameraId);
      }
    });
  }
  /**
   * Get the loading promise when loading the mesh from a URL in the constructor
   * @returns constructor loading promise or null if no URL was provided
   */
  getLoadingPromise() {
    return this._loadingPromise;
  }
  /** @internal */
  get _isGaussianSplatting() {
    return true;
  }
  /**
   * Returns the class name
   * @returns "GaussianSplattingMeshBase"
   */
  getClassName() {
    return "GaussianSplattingMeshBase";
  }
  /**
   * Returns the total number of vertices (splats) within the mesh
   * @returns the total number of vertices
   */
  getTotalVertices() {
    return this._vertexCount;
  }
  /**
   * Is this node ready to be used/rendered
   * @param completeCheck defines if a complete check (including materials and lights) has to be done (false by default)
   * @returns true when ready
   */
  isReady(completeCheck = false) {
    const sortRequired = this._isSortRequired();
    if (!super.isReady(sortRequired && completeCheck, true)) {
      return false;
    }
    if (!sortRequired && !this._geometry) {
      this._postToWorker();
    }
    if (sortRequired && !this._readyToDisplay) {
      this._postToWorker(true);
      return false;
    }
    if (sortRequired && !this._hasRenderedOnce && !this._disableDepthSort) {
      const cameras = this._scene.activeCameras?.length ? this._scene.activeCameras : [this._scene.activeCamera];
      const canRenderWithPendingRefresh = this._scene._isInRenderingMeshEvaluation() && cameras.filter((camera) => camera !== null).length === 1;
      const worldMatrix = this.computeWorldMatrix(true);
      let sortBufferMissing = false;
      let sortRefreshPending = false;
      let worldMatrixDirty = false;
      for (const camera of cameras) {
        if (!camera) {
          continue;
        }
        const cameraViewInfo = this._cameraViewInfos.get(camera.uniqueId);
        if (!cameraViewInfo || !cameraViewInfo.splatIndexBufferSet || cameraViewInfo.sortAppliedId === 0) {
          sortBufferMissing = true;
          continue;
        }
        if (cameraViewInfo.sortAppliedId !== cameraViewInfo.sortRequestId) {
          sortRefreshPending = true;
          continue;
        }
        if (this._isSortStateDirty(cameraViewInfo, worldMatrix, camera, true)) {
          worldMatrixDirty = true;
        }
      }
      if (sortBufferMissing || sortRefreshPending || worldMatrixDirty) {
        this._postToWorker(true);
        if (sortBufferMissing || !canRenderWithPendingRefresh) {
          return false;
        }
      }
    }
    if (!this._geometry && this._cameraViewInfos.size) {
      this._geometry = this._cameraViewInfos.values().next().value.mesh.geometry;
    }
    if (this.material && this.material.shadowDepthWrapper) {
      const engine = this._scene.getEngine();
      const previousRenderPassId = engine.currentRenderPassId;
      try {
        for (const light of this._scene.lights) {
          const shadowGenerator = light.getShadowGenerator();
          if (!shadowGenerator) {
            continue;
          }
          const shadowMap = shadowGenerator.getShadowMap();
          const renderPassIds = shadowMap?.renderPassIds;
          if (!renderPassIds || renderPassIds.length === 0) {
            continue;
          }
          for (let p = 0; p < renderPassIds.length; ++p) {
            engine.currentRenderPassId = renderPassIds[p];
            for (const subMesh of this.subMeshes) {
              if (!shadowGenerator.isReady(subMesh, true, false)) {
                return false;
              }
            }
          }
        }
      } finally {
        engine.currentRenderPassId = previousRenderPassId;
      }
    }
    return true;
  }
  _getCameraDirection(camera) {
    const cameraViewMatrix = camera.getViewMatrix();
    const cameraProjectionMatrix = camera.getProjectionMatrix();
    const cameraViewProjectionMatrix = TmpVectors.Matrix[0];
    cameraViewMatrix.multiplyToRef(cameraProjectionMatrix, cameraViewProjectionMatrix);
    const modelMatrix = this.computeWorldMatrix(true);
    const modelViewMatrix = TmpVectors.Matrix[1];
    modelMatrix.multiplyToRef(cameraViewMatrix, modelViewMatrix);
    modelMatrix.multiplyToRef(cameraViewProjectionMatrix, this._modelViewProjectionMatrix);
    const localDirection = TmpVectors.Vector3[1];
    localDirection.set(modelViewMatrix.m[2], modelViewMatrix.m[6], modelViewMatrix.m[10]);
    localDirection.normalize();
    return localDirection;
  }
  _isSortStateDirty(cameraViewInfo, worldMatrix, camera, worldMatrixOnly = false) {
    const world = worldMatrix.m;
    const previousWorld = cameraViewInfo.sortWorldMatrix.m;
    for (let i = 0; i < previousWorld.length; i++) {
      if (!Scalar.WithinEpsilon(previousWorld[i], world[i], this.viewUpdateThreshold)) {
        return true;
      }
    }
    if (worldMatrixOnly) {
      return false;
    }
    const cameraViewMatrix = camera.getViewMatrix();
    if (!Scalar.WithinEpsilon(cameraViewInfo.sortCameraForward.x, cameraViewMatrix.m[2], this.viewUpdateThreshold) || !Scalar.WithinEpsilon(cameraViewInfo.sortCameraForward.y, cameraViewMatrix.m[6], this.viewUpdateThreshold) || !Scalar.WithinEpsilon(cameraViewInfo.sortCameraForward.z, cameraViewMatrix.m[10], this.viewUpdateThreshold)) {
      return true;
    }
    const cameraPosition = camera.globalPosition;
    return !Scalar.WithinEpsilon(cameraViewInfo.sortCameraPosition.x, cameraPosition.x, this.viewUpdateThreshold) || !Scalar.WithinEpsilon(cameraViewInfo.sortCameraPosition.y, cameraPosition.y, this.viewUpdateThreshold) || !Scalar.WithinEpsilon(cameraViewInfo.sortCameraPosition.z, cameraPosition.z, this.viewUpdateThreshold);
  }
  /** @internal */
  _postToWorker(forced = false) {
    const scene = this._scene;
    const frameId = scene.getFrameId();
    let outdated = false;
    this._cameraViewInfos.forEach((cameraViewInfos) => {
      if (cameraViewInfos.frameIdLastUpdate !== frameId) {
        outdated = true;
      }
    });
    const cameras = this._scene.activeCameras?.length ? this._scene.activeCameras : [this._scene.activeCamera];
    const activeViewInfos = [];
    cameras.forEach((camera) => {
      if (!camera) {
        return;
      }
      const cameraId = camera.uniqueId;
      const cameraViewInfos = this._cameraViewInfos.get(cameraId);
      if (cameraViewInfos) {
        activeViewInfos.push(cameraViewInfos);
      } else {
        const cameraMesh = new Mesh(this.name + "_cameraMesh_" + cameraId, this._scene);
        cameraMesh.doNotSerialize = true;
        cameraMesh.reservedDataStore = { hidden: true, _gaussianSplattingSourceMesh: this };
        cameraMesh.setEnabled(false);
        cameraMesh.material = this.material;
        if (cameraMesh.material && cameraMesh.material instanceof GaussianSplattingMaterial) {
          const gsMaterial = cameraMesh.material;
          if (!gsMaterial.getSourceMesh()) {
            gsMaterial.setSourceMesh(this);
          }
        }
        GaussianSplattingMeshBase._MakeSplatGeometryForMesh(cameraMesh);
        const newViewInfos = {
          camera,
          cameraDirection: new Vector3(0, 0, 0),
          sortWorldMatrix: Matrix.Identity(),
          sortCameraForward: new Vector3(0, 0, 0),
          sortCameraPosition: new Vector3(0, 0, 0),
          sortRequestId: 0,
          sortAppliedId: 0,
          mesh: cameraMesh,
          frameIdLastUpdate: frameId,
          splatIndexBufferSet: false
        };
        activeViewInfos.push(newViewInfos);
        this._cameraViewInfos.set(cameraId, newViewInfos);
      }
    });
    activeViewInfos.sort((a, b) => {
      if (a.sortAppliedId === 0 !== (b.sortAppliedId === 0)) {
        return a.sortAppliedId === 0 ? -1 : 1;
      }
      if (a.splatIndexBufferSet !== b.splatIndexBufferSet) {
        return a.splatIndexBufferSet ? 1 : -1;
      }
      return a.frameIdLastUpdate - b.frameIdLastUpdate;
    });
    const hasNativeSort = !!Native?.sortSplats && !!this._splatPositions && !!this._splatIndex;
    const sortRequired = this._isSortRequired();
    const hasSortFunction = sortRequired && !this._disableDepthSort && (this._worker || hasNativeSort);
    if (forced && !sortRequired && !this._disableDepthSort) {
      this._forcedSortPending = true;
    } else if (hasSortFunction && this._forcedSortPending) {
      forced = true;
    }
    if ((forced || outdated) && hasSortFunction && (this._scene.activeCameras?.length || this._scene.activeCamera) && this._canPostToWorker) {
      const worldMatrix = this.computeWorldMatrix(true);
      activeViewInfos.forEach((cameraViewInfos) => {
        const camera = cameraViewInfos.camera;
        const cameraDirection = this._getCameraDirection(camera);
        if ((forced || this._isSortStateDirty(cameraViewInfos, worldMatrix, camera)) && this._canPostToWorker) {
          const cameraViewMatrix = camera.getViewMatrix();
          cameraViewInfos.cameraDirection.copyFrom(cameraDirection);
          cameraViewInfos.sortWorldMatrix.copyFrom(worldMatrix);
          cameraViewInfos.sortCameraForward.set(cameraViewMatrix.m[2], cameraViewMatrix.m[6], cameraViewMatrix.m[10]);
          cameraViewInfos.sortCameraPosition.copyFrom(camera.globalPosition);
          cameraViewInfos.sortRequestId = ++this._sortRequestId;
          cameraViewInfos.frameIdLastUpdate = frameId;
          this._canPostToWorker = false;
          this._forcedSortPending = false;
          if (this._worker) {
            this._worker.postMessage({
              command: GaussianSplattingSortWorkerCommand.SORT,
              worldMatrix: worldMatrix.m,
              cameraForward: [cameraViewMatrix.m[2], cameraViewMatrix.m[6], cameraViewMatrix.m[10]],
              cameraPosition: [camera.globalPosition.x, camera.globalPosition.y, camera.globalPosition.z],
              depthMix: this._depthMix,
              cameraId: camera.uniqueId,
              sortRequestId: cameraViewInfos.sortRequestId,
              rangeVersion: this._activeRangeVersion,
              useCountingSort: GaussianSplattingMeshBase.UseCountingSort,
              rightHanded: this._scene.useRightHandedSystem,
              logSortPerformance: GaussianSplattingMeshBase.LogSortPerformance
            }, [this._depthMix.buffer]);
          } else if (Native?.sortSplats) {
            if (this._activeSplatRanges) {
              this._updateSplatIndexBuffer(this._vertexCount);
            } else {
              Native.sortSplats(this._modelViewProjectionMatrix, this._splatPositions, this._splatIndex, this._scene.useRightHandedSystem);
            }
            if (cameraViewInfos.splatIndexBufferSet) {
              cameraViewInfos.mesh.thinInstanceBufferUpdated("splatIndex");
            } else {
              cameraViewInfos.mesh.thinInstanceSetBuffer("splatIndex", this._splatIndex, 16, false);
              cameraViewInfos.splatIndexBufferSet = true;
            }
            cameraViewInfos.sortAppliedId = cameraViewInfos.sortRequestId;
            this._canPostToWorker = true;
            this._readyToDisplay = true;
          }
        }
      });
    } else if (this._disableDepthSort || !sortRequired) {
      if (this._delayedTextureUpdate) {
        this._updateSplatIndexBuffer(this._vertexCount);
        this._cameraViewInfos.forEach((info) => {
          if (info.splatIndexBufferSet) {
            info.mesh.thinInstanceBufferUpdated("splatIndex");
          }
        });
        this._commitDelayedTextureUpdate();
      }
      if (this._splatIndex) {
        activeViewInfos.forEach((cameraViewInfos) => {
          if (!cameraViewInfos.splatIndexBufferSet) {
            cameraViewInfos.mesh.thinInstanceSetBuffer("splatIndex", this._splatIndex, 16, false);
            cameraViewInfos.splatIndexBufferSet = true;
          }
        });
        this._readyToDisplay = true;
      }
      if (this._disableDepthSort || !this._worker) {
        this._canPostToWorker = true;
      }
    }
  }
  /**
   * Triggers the draw call for the mesh. Usually, you don't need to call this method by your own because the mesh rendering is handled by the scene rendering manager
   * @param subMesh defines the subMesh to render
   * @param enableAlphaMode defines if alpha mode can be changed
   * @param effectiveMeshReplacement defines an optional mesh used to provide info for the rendering
   * @returns the current mesh
   */
  render(subMesh, enableAlphaMode, effectiveMeshReplacement) {
    let beforeNotified = false;
    if (!this._isSortRequired()) {
      this.onBeforeRenderObservable.notifyObservers(this);
      beforeNotified = true;
      if (this._drawPointPass(enableAlphaMode)) {
        this.onAfterRenderObservable.notifyObservers(this);
        return this;
      }
    }
    this._postToWorker();
    if (!this._geometry && this._cameraViewInfos.size) {
      this._geometry = this._cameraViewInfos.values().next().value.mesh.geometry;
    }
    const cameraId = this._scene.activeCamera.uniqueId;
    const cameraViewInfos = this._cameraViewInfos.get(cameraId);
    if (!cameraViewInfos || !cameraViewInfos.splatIndexBufferSet) {
      if (beforeNotified) {
        this.onAfterRenderObservable.notifyObservers(this);
      }
      return this;
    }
    if (!beforeNotified && this.onBeforeRenderObservable) {
      this.onBeforeRenderObservable.notifyObservers(this);
    }
    const mesh = cameraViewInfos.mesh;
    mesh.getWorldMatrix().copyFrom(this.getWorldMatrix());
    const engine = this._scene.getEngine();
    const renderPassId = engine.currentRenderPassId;
    const renderPassMaterial = this.getMaterialForRenderPass(renderPassId);
    if (renderPassMaterial) {
      mesh.setMaterialForRenderPass(renderPassId, renderPassMaterial);
    }
    const ret = this._drawColorPass(mesh, subMesh, enableAlphaMode, effectiveMeshReplacement);
    this._hasRenderedOnce = true;
    if (renderPassMaterial) {
      mesh.setMaterialForRenderPass(renderPassId, void 0);
    }
    if (this.onAfterRenderObservable) {
      this.onAfterRenderObservable.notifyObservers(this);
    }
    return ret;
  }
  /**
   * Draws the inner per-camera mesh for one render pass. Subclasses may replace selected passes.
   * @param mesh inner per-camera mesh carrying the sorted splat geometry
   * @param subMesh the submesh to draw
   * @param enableAlphaMode whether alpha mode can be changed
   * @param effectiveMeshReplacement optional mesh providing render info
   * @returns the drawn mesh
   */
  _drawColorPass(mesh, subMesh, enableAlphaMode, effectiveMeshReplacement) {
    return mesh.render(subMesh, enableAlphaMode, effectiveMeshReplacement);
  }
  /**
   * Whether the current pass needs classic sorted splat geometry.
   * @returns whether classic sorting is required
   */
  _isSortRequired() {
    return true;
  }
  /**
   * Handles a compute-owned pass before allocating or waiting for sorted geometry.
   * @param _enableAlphaMode whether alpha mode can be changed
   * @returns whether the pass was handled
   */
  _drawPointPass(_enableAlphaMode) {
    return false;
  }
  static _TypeNameToEnum(name) {
    switch (name) {
      case "float":
        return 0;
      case "int":
        return 1;
      case "uint":
        return 2;
      case "double":
        return 3;
      case "uchar":
        return 4;
      case "ushort":
      case "uint16":
        return 5;
    }
    return 6;
  }
  static _ValueNameToEnum(name) {
    switch (name) {
      case "min_x":
        return 0;
      case "min_y":
        return 1;
      case "min_z":
        return 2;
      case "max_x":
        return 3;
      case "max_y":
        return 4;
      case "max_z":
        return 5;
      case "min_scale_x":
        return 6;
      case "min_scale_y":
        return 7;
      case "min_scale_z":
        return 8;
      case "max_scale_x":
        return 9;
      case "max_scale_y":
        return 10;
      case "max_scale_z":
        return 11;
      case "packed_position":
        return 12;
      case "packed_rotation":
        return 13;
      case "packed_scale":
        return 14;
      case "packed_color":
        return 15;
      case "x":
        return 16;
      case "y":
        return 17;
      case "z":
        return 18;
      case "scale_0":
        return 19;
      case "scale_1":
        return 20;
      case "scale_2":
        return 21;
      case "diffuse_red":
      case "red":
        return 22;
      case "diffuse_green":
      case "green":
        return 23;
      case "diffuse_blue":
      case "blue":
        return 24;
      case "f_dc_0":
        return 26;
      case "f_dc_1":
        return 27;
      case "f_dc_2":
        return 28;
      case "f_dc_3":
        return 29;
      case "opacity":
        return 25;
      case "rot_0":
        return 30;
      case "rot_1":
        return 31;
      case "rot_2":
        return 32;
      case "rot_3":
        return 33;
      case "min_r":
        return 34;
      case "min_g":
        return 35;
      case "min_b":
        return 36;
      case "max_r":
        return 37;
      case "max_g":
        return 38;
      case "max_b":
        return 39;
      case "f_rest_0":
        return 40;
      case "f_rest_1":
        return 41;
      case "f_rest_2":
        return 42;
      case "f_rest_3":
        return 43;
      case "f_rest_4":
        return 44;
      case "f_rest_5":
        return 45;
      case "f_rest_6":
        return 46;
      case "f_rest_7":
        return 47;
      case "f_rest_8":
        return 48;
      case "f_rest_9":
        return 49;
      case "f_rest_10":
        return 50;
      case "f_rest_11":
        return 51;
      case "f_rest_12":
        return 52;
      case "f_rest_13":
        return 53;
      case "f_rest_14":
        return 54;
      case "f_rest_15":
        return 55;
      case "f_rest_16":
        return 56;
      case "f_rest_17":
        return 57;
      case "f_rest_18":
        return 58;
      case "f_rest_19":
        return 59;
      case "f_rest_20":
        return 60;
      case "f_rest_21":
        return 61;
      case "f_rest_22":
        return 62;
      case "f_rest_23":
        return 63;
      case "f_rest_24":
        return 64;
      case "f_rest_25":
        return 65;
      case "f_rest_26":
        return 66;
      case "f_rest_27":
        return 67;
      case "f_rest_28":
        return 68;
      case "f_rest_29":
        return 69;
      case "f_rest_30":
        return 70;
      case "f_rest_31":
        return 71;
      case "f_rest_32":
        return 72;
      case "f_rest_33":
        return 73;
      case "f_rest_34":
        return 74;
      case "f_rest_35":
        return 75;
      case "f_rest_36":
        return 76;
      case "f_rest_37":
        return 77;
      case "f_rest_38":
        return 78;
      case "f_rest_39":
        return 79;
      case "f_rest_40":
        return 80;
      case "f_rest_41":
        return 81;
      case "f_rest_42":
        return 82;
      case "f_rest_43":
        return 83;
      case "f_rest_44":
        return 84;
      case "f_rest_45":
        return 85;
      case "f_rest_46":
        return 86;
      case "f_rest_47":
        return 87;
      case "f_rest_48":
        return 88;
      case "f_rest_49":
        return 89;
      case "f_rest_50":
        return 90;
      case "f_rest_51":
        return 91;
      case "f_rest_52":
        return 92;
      case "f_rest_53":
        return 93;
      case "f_rest_54":
        return 94;
      case "f_rest_55":
        return 95;
      case "f_rest_56":
        return 96;
      case "f_rest_57":
        return 97;
      case "f_rest_58":
        return 98;
      case "f_rest_59":
        return 99;
      case "f_rest_60":
        return 100;
      case "f_rest_61":
        return 101;
      case "f_rest_62":
        return 102;
      case "f_rest_63":
        return 103;
      case "f_rest_64":
        return 104;
      case "f_rest_65":
        return 105;
      case "f_rest_66":
        return 106;
      case "f_rest_67":
        return 107;
      case "f_rest_68":
        return 108;
      case "f_rest_69":
        return 109;
      case "f_rest_70":
        return 110;
      case "f_rest_71":
        return 111;
    }
    return 112;
  }
  /**
   * Parse a PLY file header and returns metas infos on splats and chunks
   * @param data the loaded buffer
   * @returns a PLYHeader
   */
  static ParseHeader(data) {
    const ubuf = new Uint8Array(data);
    const header = new TextDecoder().decode(ubuf.slice(0, 1024 * 10));
    const headerEnd = "end_header\n";
    const headerEndIndex = header.indexOf(headerEnd);
    if (headerEndIndex < 0 || !header) {
      return null;
    }
    const vertexCount = parseInt(/element vertex (\d+)\n/.exec(header)[1]);
    const chunkElement = /element chunk (\d+)\n/.exec(header);
    let chunkCount = 0;
    if (chunkElement) {
      chunkCount = parseInt(chunkElement[1]);
    }
    let rowVertexOffset = 0;
    let rowChunkOffset = 0;
    const offsets = {
      double: 8,
      int: 4,
      uint: 4,
      float: 4,
      short: 2,
      ushort: 2,
      uint16: 2,
      uchar: 1,
      list: 0
    };
    let ElementMode;
    (function(ElementMode2) {
      ElementMode2[ElementMode2["Vertex"] = 0] = "Vertex";
      ElementMode2[ElementMode2["Chunk"] = 1] = "Chunk";
      ElementMode2[ElementMode2["SH"] = 2] = "SH";
      ElementMode2[ElementMode2["Unused"] = 3] = "Unused";
    })(ElementMode || (ElementMode = {}));
    let chunkMode = 1;
    const vertexProperties = [];
    const chunkProperties = [];
    const filtered = header.slice(0, headerEndIndex).split("\n");
    let shDegree = 0;
    for (const prop of filtered) {
      if (prop.startsWith("property ")) {
        const [, typeName, name] = prop.split(" ");
        const value = GaussianSplattingMeshBase._ValueNameToEnum(name);
        if (value != 112) {
          if (value >= 111) {
            shDegree = 4;
          } else if (value >= 84) {
            shDegree = Math.max(shDegree, 3);
          } else if (value >= 63) {
            shDegree = Math.max(shDegree, 2);
          } else if (value >= 48) {
            shDegree = Math.max(shDegree, 1);
          }
        }
        const type = GaussianSplattingMeshBase._TypeNameToEnum(typeName);
        if (chunkMode == 1) {
          chunkProperties.push({ value, type, offset: rowChunkOffset });
          rowChunkOffset += offsets[typeName];
        } else if (chunkMode == 0) {
          vertexProperties.push({ value, type, offset: rowVertexOffset });
          rowVertexOffset += offsets[typeName];
        } else if (chunkMode == 2) {
          vertexProperties.push({ value, type, offset: rowVertexOffset });
        }
        if (!offsets[typeName]) {
          Logger.Warn(`Unsupported property type: ${typeName}.`);
        }
      } else if (prop.startsWith("element ")) {
        const [, type] = prop.split(" ");
        if (type == "chunk") {
          chunkMode = 1;
        } else if (type == "vertex") {
          chunkMode = 0;
        } else if (type == "sh") {
          chunkMode = 2;
        } else {
          chunkMode = 3;
        }
      }
    }
    const dataView = new DataView(data, headerEndIndex + headerEnd.length);
    const buffer = new ArrayBuffer(GaussianSplattingMeshBase._RowOutputLength * vertexCount);
    let shBuffer = null;
    let shCoefficientCount = 0;
    if (shDegree) {
      const shVectorCount = (shDegree + 1) * (shDegree + 1) - 1;
      shCoefficientCount = shVectorCount * 3;
      shBuffer = new ArrayBuffer(shCoefficientCount * vertexCount);
    }
    return {
      vertexCount,
      chunkCount,
      rowVertexLength: rowVertexOffset,
      rowChunkLength: rowChunkOffset,
      vertexProperties,
      chunkProperties,
      dataView,
      buffer,
      shDegree,
      shCoefficientCount,
      shBuffer
    };
  }
  static _GetCompressedChunks(header, offset) {
    if (!header.chunkCount) {
      return null;
    }
    const dataView = header.dataView;
    const compressedChunks = new Array(header.chunkCount);
    for (let i = 0; i < header.chunkCount; i++) {
      const currentChunk = {
        min: new Vector3(),
        max: new Vector3(),
        minScale: new Vector3(),
        maxScale: new Vector3(),
        minColor: new Vector3(0, 0, 0),
        maxColor: new Vector3(1, 1, 1)
      };
      compressedChunks[i] = currentChunk;
      for (let propertyIndex = 0; propertyIndex < header.chunkProperties.length; propertyIndex++) {
        const property = header.chunkProperties[propertyIndex];
        let value;
        switch (property.type) {
          case 0:
            value = dataView.getFloat32(property.offset + offset.value, true);
            break;
          default:
            continue;
        }
        switch (property.value) {
          case 0:
            currentChunk.min.x = value;
            break;
          case 1:
            currentChunk.min.y = value;
            break;
          case 2:
            currentChunk.min.z = value;
            break;
          case 3:
            currentChunk.max.x = value;
            break;
          case 4:
            currentChunk.max.y = value;
            break;
          case 5:
            currentChunk.max.z = value;
            break;
          case 6:
            currentChunk.minScale.x = value;
            break;
          case 7:
            currentChunk.minScale.y = value;
            break;
          case 8:
            currentChunk.minScale.z = value;
            break;
          case 9:
            currentChunk.maxScale.x = value;
            break;
          case 10:
            currentChunk.maxScale.y = value;
            break;
          case 11:
            currentChunk.maxScale.z = value;
            break;
          case 34:
            currentChunk.minColor.x = value;
            break;
          case 35:
            currentChunk.minColor.y = value;
            break;
          case 36:
            currentChunk.minColor.z = value;
            break;
          case 37:
            currentChunk.maxColor.x = value;
            break;
          case 38:
            currentChunk.maxColor.y = value;
            break;
          case 39:
            currentChunk.maxColor.z = value;
            break;
        }
      }
      offset.value += header.rowChunkLength;
    }
    return compressedChunks;
  }
  static _GetSplat(header, index, compressedChunks, offset) {
    const q = TmpVectors.Quaternion[0];
    const temp3 = TmpVectors.Vector3[0];
    const rowOutputLength = GaussianSplattingMeshBase._RowOutputLength;
    const buffer = header.buffer;
    const dataView = header.dataView;
    const position = new Float32Array(buffer, index * rowOutputLength, 3);
    const scale = new Float32Array(buffer, index * rowOutputLength + 12, 3);
    const rgba = new Uint8ClampedArray(buffer, index * rowOutputLength + 24, 4);
    const rot = new Uint8ClampedArray(buffer, index * rowOutputLength + 28, 4);
    let sh = null;
    if (header.shBuffer) {
      sh = new Uint8ClampedArray(header.shBuffer, index * header.shCoefficientCount, header.shCoefficientCount);
    }
    const chunkIndex = index >> 8;
    let r0 = 255;
    let r1 = 0;
    let r2 = 0;
    let r3 = 0;
    const plySH = [];
    for (let propertyIndex = 0; propertyIndex < header.vertexProperties.length; propertyIndex++) {
      const property = header.vertexProperties[propertyIndex];
      let value;
      switch (property.type) {
        case 0:
          value = dataView.getFloat32(offset.value + property.offset, true);
          break;
        case 1:
          value = dataView.getInt32(offset.value + property.offset, true);
          break;
        case 2:
          value = dataView.getUint32(offset.value + property.offset, true);
          break;
        case 3:
          value = dataView.getFloat64(offset.value + property.offset, true);
          break;
        case 4:
          value = dataView.getUint8(offset.value + property.offset);
          break;
        case 5:
          value = FromHalfFloat(dataView.getUint16(offset.value + property.offset, true));
          break;
        default:
          continue;
      }
      switch (property.value) {
        case 12:
          {
            const compressedChunk = compressedChunks[chunkIndex];
            Unpack111011(value, temp3);
            position[0] = Scalar.Lerp(compressedChunk.min.x, compressedChunk.max.x, temp3.x);
            position[1] = Scalar.Lerp(compressedChunk.min.y, compressedChunk.max.y, temp3.y);
            position[2] = Scalar.Lerp(compressedChunk.min.z, compressedChunk.max.z, temp3.z);
          }
          break;
        case 13:
          {
            UnpackRot(value, q);
            r0 = q.x;
            r1 = q.y;
            r2 = q.z;
            r3 = q.w;
          }
          break;
        case 14:
          {
            const compressedChunk = compressedChunks[chunkIndex];
            Unpack111011(value, temp3);
            scale[0] = Math.exp(Scalar.Lerp(compressedChunk.minScale.x, compressedChunk.maxScale.x, temp3.x));
            scale[1] = Math.exp(Scalar.Lerp(compressedChunk.minScale.y, compressedChunk.maxScale.y, temp3.y));
            scale[2] = Math.exp(Scalar.Lerp(compressedChunk.minScale.z, compressedChunk.maxScale.z, temp3.z));
          }
          break;
        case 15:
          {
            const compressedChunk = compressedChunks[chunkIndex];
            Unpack8888(value, rgba);
            rgba[0] = Scalar.Lerp(compressedChunk.minColor.x, compressedChunk.maxColor.x, rgba[0] / 255) * 255;
            rgba[1] = Scalar.Lerp(compressedChunk.minColor.y, compressedChunk.maxColor.y, rgba[1] / 255) * 255;
            rgba[2] = Scalar.Lerp(compressedChunk.minColor.z, compressedChunk.maxColor.z, rgba[2] / 255) * 255;
          }
          break;
        case 16:
          position[0] = value;
          break;
        case 17:
          position[1] = value;
          break;
        case 18:
          position[2] = value;
          break;
        case 19:
          scale[0] = Math.exp(value);
          break;
        case 20:
          scale[1] = Math.exp(value);
          break;
        case 21:
          scale[2] = Math.exp(value);
          break;
        case 22:
          rgba[0] = value;
          break;
        case 23:
          rgba[1] = value;
          break;
        case 24:
          rgba[2] = value;
          break;
        case 26:
          rgba[0] = (0.5 + GaussianSplattingMeshBase._SH_C0 * value) * 255;
          break;
        case 27:
          rgba[1] = (0.5 + GaussianSplattingMeshBase._SH_C0 * value) * 255;
          break;
        case 28:
          rgba[2] = (0.5 + GaussianSplattingMeshBase._SH_C0 * value) * 255;
          break;
        case 29:
          rgba[3] = (0.5 + GaussianSplattingMeshBase._SH_C0 * value) * 255;
          break;
        case 25:
          rgba[3] = 1 / (1 + Math.exp(-value)) * 255;
          break;
        case 30:
          r0 = value;
          break;
        case 31:
          r1 = value;
          break;
        case 32:
          r2 = value;
          break;
        case 33:
          r3 = value;
          break;
      }
      if (sh && property.value >= 40 && property.value <= 111) {
        const shIndex = property.value - 40;
        if (property.type == 4 && header.chunkCount) {
          const compressedValue = dataView.getUint8(header.rowChunkLength * header.chunkCount + header.vertexCount * header.rowVertexLength + index * header.shCoefficientCount + shIndex);
          plySH[shIndex] = (compressedValue * (8 / 255) - 4) * 127.5 + 127.5;
        } else {
          const clampedValue = Scalar.Clamp(value * 127.5 + 127.5, 0, 255);
          plySH[shIndex] = clampedValue;
        }
      }
    }
    if (sh) {
      const shDim = header.shDegree == 1 ? 3 : header.shDegree == 2 ? 8 : header.shDegree == 3 ? 15 : 24;
      for (let j = 0; j < shDim; j++) {
        sh[j * 3 + 0] = plySH[j];
        sh[j * 3 + 1] = plySH[j + shDim];
        sh[j * 3 + 2] = plySH[j + shDim * 2];
      }
    }
    q.set(r1, r2, r3, r0);
    q.normalize();
    rot[0] = q.w * 127.5 + 127.5;
    rot[1] = q.x * 127.5 + 127.5;
    rot[2] = q.y * 127.5 + 127.5;
    rot[3] = q.z * 127.5 + 127.5;
    offset.value += header.rowVertexLength;
  }
  /**
   * Converts a .ply data with SH coefficients splat
   * if data array buffer is not ply, returns the original buffer
   * @param data the .ply data to load
   * @param useCoroutine use coroutine and yield
   * @returns the loaded splat buffer and optional array of sh coefficients
   */
  static *ConvertPLYWithSHToSplat(data, useCoroutine = false) {
    const header = GaussianSplattingMeshBase.ParseHeader(data);
    if (!header) {
      return { buffer: data };
    }
    const offset = { value: 0 };
    const compressedChunks = GaussianSplattingMeshBase._GetCompressedChunks(header, offset);
    for (let i = 0; i < header.vertexCount; i++) {
      GaussianSplattingMeshBase._GetSplat(header, i, compressedChunks, offset);
      if (i % GaussianSplattingMeshBase._PlyConversionBatchSize === 0 && useCoroutine) {
        yield;
      }
    }
    let sh = null;
    if (header.shDegree && header.shBuffer) {
      const textureCount = Math.ceil(header.shCoefficientCount / 16);
      let shIndexRead = 0;
      const ubuf = new Uint8Array(header.shBuffer);
      sh = [];
      const splatCount = header.vertexCount;
      const engine = EngineStore.LastCreatedEngine;
      if (engine) {
        const width = engine.getCaps().maxTextureSize;
        const height = Math.ceil(splatCount / width);
        sh = AllocateShBuffers(textureCount, height * width * 4 * 4);
        for (let i = 0; i < splatCount; i++) {
          for (let shIndexWrite = 0; shIndexWrite < header.shCoefficientCount; shIndexWrite++) {
            const shValue = ubuf[shIndexRead++];
            const textureIndex = Math.floor(shIndexWrite / 16);
            const shArray = sh[textureIndex];
            const byteIndexInTexture = shIndexWrite % 16;
            const offsetPerSplat = i * 16;
            shArray[byteIndexInTexture + offsetPerSplat] = shValue;
          }
        }
      }
    }
    return { buffer: header.buffer, sh, shDegree: header.shDegree };
  }
  /**
   * Converts a .ply data array buffer to splat
   * if data array buffer is not ply, returns the original buffer
   * @param data the .ply data to load
   * @param useCoroutine use coroutine and yield
   * @returns the loaded splat buffer without SH coefficient, whether ply contains or not SH.
   */
  static *ConvertPLYToSplat(data, useCoroutine = false) {
    const header = GaussianSplattingMeshBase.ParseHeader(data);
    if (!header) {
      return data;
    }
    const offset = { value: 0 };
    const compressedChunks = GaussianSplattingMeshBase._GetCompressedChunks(header, offset);
    for (let i = 0; i < header.vertexCount; i++) {
      GaussianSplattingMeshBase._GetSplat(header, i, compressedChunks, offset);
      if (i % GaussianSplattingMeshBase._PlyConversionBatchSize === 0 && useCoroutine) {
        yield;
      }
    }
    return header.buffer;
  }
  /**
   * Converts a .ply data array buffer to splat
   * if data array buffer is not ply, returns the original buffer
   * @param data the .ply data to load
   * @returns the loaded splat buffer
   */
  static async ConvertPLYToSplatAsync(data) {
    return await runCoroutineAsync(GaussianSplattingMeshBase.ConvertPLYToSplat(data, true), createYieldingScheduler());
  }
  /**
   * Converts a .ply with SH data array buffer to splat
   * if data array buffer is not ply, returns the original buffer
   * @param data the .ply data to load
   * @returns the loaded splat buffer with SH
   */
  static async ConvertPLYWithSHToSplatAsync(data) {
    return await runCoroutineAsync(GaussianSplattingMeshBase.ConvertPLYWithSHToSplat(data, true), createYieldingScheduler());
  }
  /**
   * Loads a .splat Gaussian Splatting array buffer asynchronously
   * @param data arraybuffer containing splat file
   * @returns a promise that resolves when the operation is complete
   */
  async loadDataAsync(data) {
    return await this.updateDataAsync(data);
  }
  /**
   * Loads a Gaussian or Splatting file asynchronously
   * @param url path to the splat file to load
   * @param scene optional scene it belongs to
   * @returns a promise that resolves when the operation is complete
   * @deprecated Please use SceneLoader.ImportMeshAsync instead
   */
  async loadFileAsync(url, scene) {
    await ImportMeshAsync(url, scene || EngineStore.LastCreatedScene, { pluginOptions: { splat: { gaussianSplattingMesh: this } } });
  }
  /**
   * Releases resources associated with this mesh.
   * @param doNotRecurse Set to true to not recurse into each children (recurse into each children by default)
   */
  dispose(doNotRecurse) {
    if (this._mrtAtlas) {
      this._mrtAtlas.dispose();
      this._mrtAtlas = null;
      this._covariancesATexture = this._covariancesBTexture = this._centersTexture = this._colorsTexture = null;
    } else {
      this._covariancesATexture?.dispose();
      this._covariancesBTexture?.dispose();
      this._centersTexture?.dispose();
      this._colorsTexture?.dispose();
    }
    if (this._shMrtAtlas) {
      for (const mrt of this._shMrtAtlas) {
        mrt.dispose();
      }
      if (this._shTextures) {
        for (let k = this._shMrtAtlas.length; k < this._shTextures.length; k++) {
          this._shTextures[k].dispose();
        }
      }
      this._shMrtAtlas = null;
    } else if (this._shTextures) {
      for (const shTexture of this._shTextures) {
        shTexture.dispose();
      }
    }
    this._shTextures = null;
    if (this._rotMrtAtlas) {
      this._rotMrtAtlas.dispose();
      this._rotMrtAtlas = null;
    } else {
      this._rotationsATexture?.dispose();
      this._rotationsBTexture?.dispose();
      this._rotationScaleTexture?.dispose();
    }
    this._sogParams?.codebookTexture?.dispose();
    this._rotationsATexture = null;
    this._rotationsBTexture = null;
    this._rotationScaleTexture = null;
    this._rotationDataA = null;
    this._rotationDataB = null;
    this._rotationScaleData = null;
    this._covariancesATexture = null;
    this._covariancesBTexture = null;
    this._centersTexture = null;
    this._colorsTexture = null;
    this._shTextures = null;
    this._cachedBoundingMin = null;
    this._cachedBoundingMax = null;
    _ReleaseGsInterFrameYield(this.getEngine());
    this._worker?.terminate();
    this._worker = null;
    this.onPartCountChangedObservable.clear();
    this.onPartRemovedObservable.clear();
    this._cameraViewInfos.forEach((cameraViewInfo) => {
      cameraViewInfo.mesh.dispose();
    });
    super.dispose(doNotRecurse, true);
  }
  _copyTextures(source) {
    this._covariancesATexture = source.covariancesATexture?.clone();
    this._covariancesBTexture = source.covariancesBTexture?.clone();
    this._centersTexture = source.centersTexture?.clone();
    this._colorsTexture = source.colorsTexture?.clone();
    if (source._shTextures) {
      this._shTextures = [];
      for (const shTexture of source._shTextures) {
        this._shTextures?.push(shTexture.clone());
      }
    }
    if (source._rotationsATexture) {
      this._rotationsATexture = source._rotationsATexture.clone();
      this._rotationsBTexture = source._rotationsBTexture?.clone();
      this._rotationScaleTexture = source._rotationScaleTexture?.clone();
    }
  }
  /**
   * Returns a new Mesh object generated from the current mesh properties.
   * @param name is a string, the name given to the new mesh
   * @returns a new Gaussian Splatting Mesh
   */
  clone(name = "") {
    const newGS = new GaussianSplattingMeshBase(name, void 0, this.getScene());
    newGS._copySource(this);
    newGS.makeGeometryUnique();
    newGS._vertexCount = this._vertexCount;
    newGS._copyTextures(this);
    newGS._modelViewProjectionMatrix = Matrix.Identity();
    newGS._splatPositions = this._splatPositions;
    newGS._readyToDisplay = false;
    newGS._hasRenderedOnce = false;
    newGS._disableDepthSort = this._disableDepthSort;
    newGS._instantiateWorker();
    const binfo = this.getBoundingInfo();
    newGS.getBoundingInfo().reConstruct(binfo.minimum, binfo.maximum, this.getWorldMatrix());
    newGS.forcedInstanceCount = this.forcedInstanceCount;
    newGS.setEnabled(true);
    return newGS;
  }
  _makeEmptySplat(index, covA, covB, colorArray) {
    const covBSItemSize = this._useRGBACovariants ? 4 : 2;
    this._splatPositions[4 * index + 0] = 0;
    this._splatPositions[4 * index + 1] = 0;
    this._splatPositions[4 * index + 2] = 0;
    covA[index * 4 + 0] = ToHalfFloat(0);
    covA[index * 4 + 1] = ToHalfFloat(0);
    covA[index * 4 + 2] = ToHalfFloat(0);
    covA[index * 4 + 3] = ToHalfFloat(0);
    covB[index * covBSItemSize + 0] = ToHalfFloat(0);
    covB[index * covBSItemSize + 1] = ToHalfFloat(0);
    colorArray[index * 4 + 3] = 0;
  }
  /**
   * Processes a single splat from the source buffer (at srcIndex) and writes the result into
   * the destination texture arrays at dstIndex. This decoupling allows addPart to feed multiple
   * independent source buffers into a single set of destination arrays without merging them first.
   * @param dstIndex - destination splat index (into _splatPositions, covA, covB, colorArray)
   * @param fBuffer - float32 view of the source .splat buffer
   * @param uBuffer - uint8 view of the source .splat buffer
   * @param covA - destination covariancesA array
   * @param covB - destination covariancesB array
   * @param colorArray - destination color array
   * @param minimum - accumulated bounding minimum (updated in-place)
   * @param maximum - accumulated bounding maximum (updated in-place)
   * @param flipY - whether to negate the Y position
   * @param srcIndex - source splat index (defaults to dstIndex when omitted)
   * @param dstArrayIndex - index into the covA/covB/colorArray transients (defaults to dstIndex). Lets a streaming
   * write pass count-sized transients indexed from 0 while dstIndex still addresses the atlas-sized _splatPositions.
   */
  _makeSplat(dstIndex, fBuffer, uBuffer, covA, covB, colorArray, minimum, maximum, flipY, srcIndex = dstIndex, dstArrayIndex = dstIndex) {
    const matrixRotation = TmpVectors.Matrix[0];
    const matrixScale = TmpVectors.Matrix[1];
    const quaternion = TmpVectors.Quaternion[0];
    const covBSItemSize = this._useRGBACovariants ? 4 : 2;
    const x = fBuffer[8 * srcIndex + 0];
    const y = fBuffer[8 * srcIndex + 1] * (flipY ? -1 : 1);
    const z = fBuffer[8 * srcIndex + 2];
    this._splatPositions[4 * dstIndex + 0] = x;
    this._splatPositions[4 * dstIndex + 1] = y;
    this._splatPositions[4 * dstIndex + 2] = z;
    minimum.minimizeInPlaceFromFloats(x, y, z);
    maximum.maximizeInPlaceFromFloats(x, y, z);
    quaternion.set((uBuffer[32 * srcIndex + 28 + 1] - 127.5) / 127.5, (uBuffer[32 * srcIndex + 28 + 2] - 127.5) / 127.5, (uBuffer[32 * srcIndex + 28 + 3] - 127.5) / 127.5, -(uBuffer[32 * srcIndex + 28 + 0] - 127.5) / 127.5);
    quaternion.normalize();
    quaternion.toRotationMatrix(matrixRotation);
    Matrix.ScalingToRef(fBuffer[8 * srcIndex + 3 + 0] * 2, fBuffer[8 * srcIndex + 3 + 1] * 2, fBuffer[8 * srcIndex + 3 + 2] * 2, matrixScale);
    if (this._needsRotationScaleTextures) {
      const rotLength = this._splatPositions.length;
      if (!this._rotationDataA || this._rotationDataA.length < rotLength) {
        this._rotationDataA = new Uint16Array(rotLength);
        this._rotationDataB = new Uint16Array(rotLength);
        this._rotationScaleData = new Uint16Array(rotLength);
      }
      const rotDataA = this._rotationDataA;
      const rotDataB = this._rotationDataB;
      const rotScaleData = this._rotationScaleData;
      const rm = matrixRotation.m;
      const sm = matrixScale.m;
      rotDataA[dstIndex * 4 + 0] = ToHalfFloat(rm[0]);
      rotDataA[dstIndex * 4 + 1] = ToHalfFloat(rm[1]);
      rotDataA[dstIndex * 4 + 2] = ToHalfFloat(rm[2]);
      rotDataA[dstIndex * 4 + 3] = ToHalfFloat(rm[4]);
      rotDataB[dstIndex * 4 + 0] = ToHalfFloat(rm[5]);
      rotDataB[dstIndex * 4 + 1] = ToHalfFloat(rm[6]);
      rotDataB[dstIndex * 4 + 2] = ToHalfFloat(rm[8]);
      rotDataB[dstIndex * 4 + 3] = ToHalfFloat(rm[9]);
      rotScaleData[dstIndex * 4 + 0] = ToHalfFloat(rm[10]);
      rotScaleData[dstIndex * 4 + 1] = ToHalfFloat(sm[0]);
      rotScaleData[dstIndex * 4 + 2] = ToHalfFloat(sm[5]);
      rotScaleData[dstIndex * 4 + 3] = ToHalfFloat(sm[10]);
    }
    const m = matrixRotation.multiplyToRef(matrixScale, TmpVectors.Matrix[0]).m;
    const covariances = this._tmpCovariances;
    covariances[0] = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
    covariances[1] = m[0] * m[4] + m[1] * m[5] + m[2] * m[6];
    covariances[2] = m[0] * m[8] + m[1] * m[9] + m[2] * m[10];
    covariances[3] = m[4] * m[4] + m[5] * m[5] + m[6] * m[6];
    covariances[4] = m[4] * m[8] + m[5] * m[9] + m[6] * m[10];
    covariances[5] = m[8] * m[8] + m[9] * m[9] + m[10] * m[10];
    let factor = -1e4;
    for (let covIndex = 0; covIndex < 6; covIndex++) {
      factor = Math.max(factor, Math.abs(covariances[covIndex]));
    }
    this._splatPositions[4 * dstIndex + 3] = factor;
    const transform = factor;
    covA[dstArrayIndex * 4 + 0] = ToHalfFloat(covariances[0] / transform);
    covA[dstArrayIndex * 4 + 1] = ToHalfFloat(covariances[1] / transform);
    covA[dstArrayIndex * 4 + 2] = ToHalfFloat(covariances[2] / transform);
    covA[dstArrayIndex * 4 + 3] = ToHalfFloat(covariances[3] / transform);
    covB[dstArrayIndex * covBSItemSize + 0] = ToHalfFloat(covariances[4] / transform);
    covB[dstArrayIndex * covBSItemSize + 1] = ToHalfFloat(covariances[5] / transform);
    const c0 = covariances[0];
    const c1 = covariances[1];
    const c2 = covariances[2];
    const c3 = covariances[3];
    const c4 = covariances[4];
    const c5 = covariances[5];
    const det3d = c0 * (c3 * c5 - c4 * c4) - c1 * (c1 * c5 - c4 * c2) + c2 * (c1 * c4 - c3 * c2);
    const splatSize = Math.pow(Math.abs(det3d), 1 / 6);
    if (splatSize < this._splatSizeMin) {
      this._splatSizeMin = splatSize;
    }
    if (splatSize > this._splatSizeMax) {
      this._splatSizeMax = splatSize;
    }
    colorArray[dstArrayIndex * 4 + 0] = uBuffer[32 * srcIndex + 24 + 0];
    colorArray[dstArrayIndex * 4 + 1] = uBuffer[32 * srcIndex + 24 + 1];
    colorArray[dstArrayIndex * 4 + 2] = uBuffer[32 * srcIndex + 24 + 2];
    colorArray[dstArrayIndex * 4 + 3] = uBuffer[32 * srcIndex + 24 + 3];
  }
  _onUpdateTextures(_textureSize) {
  }
  /**
   * Called when part index data is received during a data load. Override to store and manage
   * part index state (e.g. allocating the padded Uint8Array).
   * No-op in the base class.
   * @param _partIndices - the raw part indices passed in by the caller
   * @param _textureLength - the padded texture length (width × height) to allocate into
   */
  _onIndexDataReceived(_partIndices, _textureLength) {
  }
  /**
   * Called at the start of an incremental texture update, before any splats are processed.
   * Override to perform incremental-specific setup, such as ensuring the part-index GPU texture
   * exists before the sub-texture upload begins.
   * No-op in the base class.
   * @param _textureSize - current texture dimensions
   */
  _onIncrementalUpdateStart(_textureSize) {
  }
  /**
   * Whether this mesh is in compound mode (has at least one part added via addPart).
   * Returns `false` in the base class; overridden to return `true` in the compound subclass.
   * Consumed by the material and depth renderer to toggle compound-specific shader paths.
   * @internal
   */
  get isCompound() {
    return false;
  }
  _setDelayedTextureUpdate(covA, covB, colorArray, sh) {
    this._delayedTextureUpdate = { covA, covB, colors: colorArray, centers: this._splatPositions, sh };
  }
  _commitDelayedTextureUpdate() {
    const update = this._delayedTextureUpdate;
    if (!update) {
      return;
    }
    const textureSize = this._getTextureSize(this._vertexCount);
    this._updateSubTextures(update.centers, update.covA, update.covB, update.colors, 0, textureSize.y, update.sh);
    this._delayedTextureUpdate = null;
  }
  /**
   * Creates (or recreates) the MRT-backed data atlas at the given size and points the four core data
   * textures at its attachments. The attachments use the same decoded GS layout as {@link GaussianSplattingWorkBuffer}
   * — [centers F32, covA HALF_FLOAT, covB HALF_FLOAT, colors U8], all RGBA — so a streaming engine can render
   * (decode/relayout) directly into the same textures the GS material samples, while static parts CPU-upload
   * into them via {@link _updateSubTextures}. Covariance B is RGBA here (its extra channels unused), so the
   * atlas forces {@link _useRGBACovariants}.
   * @param textureSize atlas dimensions (width, height)
   */
  _createMrtAtlas(textureSize) {
    this._useRGBACovariants = true;
    const engine = this.getEngine();
    const updateEngine = this._getTextureDataUpdateEngine();
    if (!updateEngine._gl && !updateEngine.isWebGPU) {
      return;
    }
    const covType = engine.getCaps().textureHalfFloatRender ? 2 : 1;
    const mrt = new MultiRenderTarget(this.name + "_gsAtlas", { width: textureSize.x, height: textureSize.y }, 4, this._scene, {
      types: [1, covType, covType, 0],
      formats: [5, 5, 5, 5],
      samplingModes: [
        1,
        1,
        1,
        1
      ],
      generateDepthBuffer: false,
      generateDepthTexture: false,
      generateMipMaps: false
    }, [this.name + "_gsCenters", this.name + "_gsCovA", this.name + "_gsCovB", this.name + "_gsColors"]);
    mrt.clearColor = new Color4(0, 0, 0, 0);
    mrt.renderList = [];
    mrt.onClearObservable.add(() => {
    });
    mrt.render();
    this._mrtAtlas = mrt;
    this._centersTexture = mrt.textures[0];
    this._covariancesATexture = mrt.textures[1];
    this._covariancesBTexture = mrt.textures[2];
    this._colorsTexture = mrt.textures[3];
  }
  /**
   * Creates the shared higher-order SH atlas: `_shMrtAtlasTextureCount` single-attachment integer render targets
   * (RGBA_INTEGER / UNSIGNED_INTEGER, packed-u32), sized to the whole atlas, so a streaming engine can GPU-decode
   * baked SH into the reserved region and static SH parts CPU-upload into the same attachments. `_shTextures` (the
   * draw path's `shTexture0..N` samplers) are the attachments. One MRT per attachment keeps within WebGPU's
   * per-sample color-attachment byte budget. No-op without a real GPU backend (mirrors {@link _createMrtAtlas}).
   * @param textureSize atlas dimensions (width, height)
   */
  _createShMrtAtlas(textureSize) {
    const updateEngine = this._getTextureDataUpdateEngine();
    if (!updateEngine._gl && !updateEngine.isWebGPU) {
      return;
    }
    const count = this._shMrtAtlasTextureCount;
    if (count <= 0) {
      return;
    }
    const mrts = [];
    const shTextures = [];
    for (let k = 0; k < count; k++) {
      const name = `${this.name}_gsShAtlas${k}`;
      const mrt = new MultiRenderTarget(name, { width: textureSize.x, height: textureSize.y }, 1, this._scene, {
        types: [7],
        formats: [11],
        samplingModes: [1],
        generateDepthBuffer: false,
        generateDepthTexture: false,
        generateMipMaps: false
      }, [name]);
      mrt.clearColor = new Color4(0, 0, 0, 0);
      mrt.renderList = [];
      mrt.onClearObservable.add(() => {
      });
      const attachment = mrt.textures[0];
      attachment.wrapU = 0;
      attachment.wrapV = 0;
      mrt.render();
      mrts.push(mrt);
      shTextures.push(attachment);
    }
    this._shMrtAtlas = mrts;
    this._shTextures = shTextures;
  }
  /**
   * Creates the shared rotation/scale atlas: one 3-attachment half-float render target ([rotA, rotB, rotScale])
   * sized to the whole atlas, so a streaming engine can GPU-decode rotation/scale into the reserved region and
   * static parts CPU-upload into the same attachments. `_rotationsATexture`/`_rotationsBTexture`/
   * `_rotationScaleTexture` (the voxel-IBL samplers) become the three attachments. No-op without a real GPU
   * backend (mirrors {@link _createMrtAtlas}).
   * @param textureSize atlas dimensions (width, height)
   */
  _createRotMrtAtlas(textureSize) {
    const updateEngine = this._getTextureDataUpdateEngine();
    if (!updateEngine._gl && !updateEngine.isWebGPU) {
      return;
    }
    const rotType = this.getEngine().getCaps().textureHalfFloatRender ? 2 : 1;
    const name = this.name + "_gsRotAtlas";
    const mrt = new MultiRenderTarget(name, { width: textureSize.x, height: textureSize.y }, 3, this._scene, {
      types: [rotType, rotType, rotType],
      formats: [5, 5, 5],
      samplingModes: [1, 1, 1],
      generateDepthBuffer: false,
      generateDepthTexture: false,
      generateMipMaps: false
    }, [name + "A", name + "B", name + "Scale"]);
    mrt.clearColor = new Color4(0, 0, 0, 0);
    mrt.renderList = [];
    mrt.onClearObservable.add(() => {
    });
    for (const attachment of mrt.textures) {
      attachment.wrapU = 0;
      attachment.wrapV = 0;
    }
    mrt.render();
    this._rotMrtAtlas = mrt;
    this._rotationsATexture = mrt.textures[0];
    this._rotationsBTexture = mrt.textures[1];
    this._rotationScaleTexture = mrt.textures[2];
  }
  // NB: partIndices is assumed to be padded to a round texture size
  _updateTextures(covA, covB, colorArray, sh) {
    const textureSize = this._getTextureSize(this._vertexCount);
    const createTextureFromData = (data, width, height, format) => {
      return new RawTexture(data, width, height, format, this._scene, false, false, 1, 1);
    };
    const createTextureFromDataU8 = (data, width, height, format) => {
      return new RawTexture(data, width, height, format, this._scene, false, false, 1, 0);
    };
    const createEmptyTextureU32 = (width, height, format) => {
      return new RawTexture(null, width, height, format, this._scene, false, false, 1, 7);
    };
    const createTextureFromDataF16 = (data, width, height, format) => {
      return new RawTexture(data, width, height, format, this._scene, false, false, 1, 2);
    };
    const firstTime = this._covariancesATexture === null;
    const textureSizeChanged = this._textureSize.y != textureSize.y;
    if (this._useShMrtAtlas && sh) {
      this._shMrtAtlasTextureCount = sh.length;
    }
    const needsMrtConversion = this._useMrtAtlas && !this._mrtAtlas || this._useShMrtAtlas && (!this._shMrtAtlas || this._shMrtAtlas.length !== this._shMrtAtlasTextureCount) || this._useRotMrtAtlas && !this._rotMrtAtlas;
    if (!firstTime && !textureSizeChanged && !needsMrtConversion) {
      this._setDelayedTextureUpdate(covA, covB, colorArray, sh);
      const positions = Float32Array.from(this._splatPositions);
      const vertexCount = this._vertexCount;
      if (this._worker) {
        this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.POSITIONS, positions, vertexCount }, [positions.buffer]);
        this._postIntervalsToWorker();
      }
      if (sh && !this._shTextures && !this._useShMrtAtlas) {
        this._shTextures = [];
        for (let textureIndex = 0; textureIndex < sh.length; textureIndex++) {
          const shTexture = createEmptyTextureU32(textureSize.x, textureSize.y, 11);
          shTexture.wrapU = 0;
          shTexture.wrapV = 0;
          this._shTextures.push(shTexture);
          this._updateShTextureData(shTexture, sh[textureIndex], textureSize.x, 0, textureSize.y);
        }
      }
      if (this._needsRotationScaleTextures && this._rotationDataA) {
        if (this._rotationsATexture) {
          this._updateTextureFromData(this._rotationsATexture, this._rotationDataA, textureSize.x, 0, textureSize.y);
          this._updateTextureFromData(this._rotationsBTexture, this._rotationDataB, textureSize.x, 0, textureSize.y);
          this._updateTextureFromData(this._rotationScaleTexture, this._rotationScaleData, textureSize.x, 0, textureSize.y);
        } else {
          this._rotationsATexture = createTextureFromDataF16(this._rotationDataA, textureSize.x, textureSize.y, 5);
          this._rotationsBTexture = createTextureFromDataF16(this._rotationDataB, textureSize.x, textureSize.y, 5);
          this._rotationScaleTexture = createTextureFromDataF16(this._rotationScaleData, textureSize.x, textureSize.y, 5);
          this._rotationsATexture.wrapU = 0;
          this._rotationsATexture.wrapV = 0;
          this._rotationsBTexture.wrapU = 0;
          this._rotationsBTexture.wrapV = 0;
          this._rotationScaleTexture.wrapU = 0;
          this._rotationScaleTexture.wrapV = 0;
        }
      }
      this._onUpdateTextures(textureSize);
      this._postToWorker(true);
    } else {
      const growingMrtAtlas = this._useMrtAtlas && !!this._mrtAtlas;
      if (growingMrtAtlas) {
        this._onBeforeAtlasRebuildObservable.notifyObservers(this._mrtAtlas);
      }
      if (this._mrtAtlas) {
        this._mrtAtlas.dispose();
        this._mrtAtlas = null;
        this._covariancesATexture = this._covariancesBTexture = this._centersTexture = this._colorsTexture = null;
      } else {
        this._covariancesATexture?.dispose();
        this._covariancesBTexture?.dispose();
        this._centersTexture?.dispose();
        this._colorsTexture?.dispose();
      }
      if (this._rotMrtAtlas) {
        this._rotMrtAtlas.dispose();
        this._rotMrtAtlas = null;
        this._rotationsATexture = null;
        this._rotationsBTexture = null;
        this._rotationScaleTexture = null;
      } else if (this._rotationsATexture) {
        this._rotationsATexture.dispose();
        this._rotationsBTexture?.dispose();
        this._rotationScaleTexture?.dispose();
        this._rotationsATexture = null;
        this._rotationsBTexture = null;
        this._rotationScaleTexture = null;
      }
      if (this._shTextures) {
        if (this._shMrtAtlas) {
          for (const mrt of this._shMrtAtlas) {
            mrt.dispose();
          }
          for (let k = this._shMrtAtlas.length; k < this._shTextures.length; k++) {
            this._shTextures[k].dispose();
          }
          this._shMrtAtlas = null;
        } else {
          for (const shTexture of this._shTextures) {
            shTexture.dispose();
          }
        }
        this._shTextures = null;
      }
      this._textureSize = textureSize;
      if (this._useMrtAtlas) {
        this._createMrtAtlas(textureSize);
        if (this._useShMrtAtlas) {
          this._createShMrtAtlas(textureSize);
        }
        if (this._useRotMrtAtlas) {
          this._createRotMrtAtlas(textureSize);
        }
        if (this._mrtAtlas) {
          this._updateSubTextures(this._splatPositions, covA, covB, colorArray, 0, textureSize.y);
          if (this._useShMrtAtlas && sh) {
            const shTex = this._shTextures;
            if (shTex) {
              for (let textureIndex = 0; textureIndex < sh.length && textureIndex < shTex.length; textureIndex++) {
                this._updateShTextureData(shTex[textureIndex], sh[textureIndex], textureSize.x, 0, textureSize.y);
              }
            }
          }
          if (growingMrtAtlas) {
            this._onAfterAtlasRebuildObservable.notifyObservers(this._mrtAtlas);
          }
        }
      } else {
        this._covariancesATexture = createTextureFromDataF16(covA, textureSize.x, textureSize.y, 5);
        this._covariancesBTexture = createTextureFromDataF16(covB, textureSize.x, textureSize.y, this._useRGBACovariants ? 5 : 7);
        this._centersTexture = createTextureFromData(this._splatPositions, textureSize.x, textureSize.y, 5);
        this._colorsTexture = createTextureFromDataU8(colorArray, textureSize.x, textureSize.y, 5);
      }
      if (sh && !this._useShMrtAtlas) {
        {
          this._shTextures = [];
          for (let textureIndex = 0; textureIndex < sh.length; textureIndex++) {
            const shTexture = createEmptyTextureU32(textureSize.x, textureSize.y, 11);
            shTexture.wrapU = 0;
            shTexture.wrapV = 0;
            this._shTextures.push(shTexture);
          }
          for (let textureIndex = 0; textureIndex < sh.length; textureIndex++) {
            this._updateShTextureData(this._shTextures[textureIndex], sh[textureIndex], textureSize.x, 0, textureSize.y);
          }
        }
      }
      if (this._needsRotationScaleTextures && !this._useRotMrtAtlas) {
        const rotDataA = this._rotationDataA ?? new Uint16Array(covA.length);
        const rotDataB = this._rotationDataB ?? new Uint16Array(covA.length);
        const rotScaleData = this._rotationScaleData ?? new Uint16Array(covA.length);
        this._rotationsATexture = createTextureFromDataF16(rotDataA, textureSize.x, textureSize.y, 5);
        this._rotationsBTexture = createTextureFromDataF16(rotDataB, textureSize.x, textureSize.y, 5);
        this._rotationScaleTexture = createTextureFromDataF16(rotScaleData, textureSize.x, textureSize.y, 5);
        this._rotationsATexture.wrapU = 0;
        this._rotationsATexture.wrapV = 0;
        this._rotationsBTexture.wrapU = 0;
        this._rotationsBTexture.wrapV = 0;
        this._rotationScaleTexture.wrapU = 0;
        this._rotationScaleTexture.wrapV = 0;
      }
      this._onUpdateTextures(textureSize);
      if (firstTime) {
        this._instantiateWorker();
      } else {
        if (this._worker) {
          const positions = Float32Array.from(this._splatPositions);
          const vertexCount = this._vertexCount;
          this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.POSITIONS, positions, vertexCount }, [positions.buffer]);
          this._postIntervalsToWorker();
        }
        this._postToWorker(true);
      }
    }
  }
  /**
   * Checks whether the GPU textures can be incrementally updated for a new addPart operation,
   * avoiding a full texture re-upload for existing splats.
   * Requires that the GPU textures already exist and the texture height won't change.
   * @param previousVertexCount - The number of splats previously committed to GPU
   * @param vertexCount - The new total number of splats
   * @param requiredShTextureCount - SH texture count this update requires (the merged `sh.length`), 0 when no SH
   * @returns true when only the new splat region needs to be uploaded
   */
  _canReuseCachedData(previousVertexCount, vertexCount, requiredShTextureCount = 0) {
    if (previousVertexCount <= 0 || previousVertexCount > vertexCount) {
      return false;
    }
    if (this._splatPositions === null || this._cachedBoundingMin === null || this._cachedBoundingMax === null) {
      return false;
    }
    if (this._covariancesATexture === null) {
      return false;
    }
    if (this._useMrtAtlas && !this._mrtAtlas) {
      return false;
    }
    if (this._useShMrtAtlas && (!this._shMrtAtlas || this._shMrtAtlas.length !== requiredShTextureCount)) {
      return false;
    }
    if (this._useRotMrtAtlas && !this._rotMrtAtlas) {
      return false;
    }
    const newTextureSize = this._getTextureSize(vertexCount);
    return newTextureSize.y === this._textureSize.y;
  }
  /**
   * Posts updated positions to the sort worker and marks the sort as dirty.
   * Called after processing new splats so the worker can re-sort with the complete position set.
   * Subclasses (e.g. compound) may override to additionally post part-index data.
   */
  _notifyWorkerNewData() {
    if (this._worker) {
      const positions = Float32Array.from(this._splatPositions);
      const vertexCount = this._vertexCount;
      this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.POSITIONS, positions, vertexCount }, [positions.buffer]);
      this._postIntervalsToWorker();
    }
    this._sortIsDirty = true;
  }
  /**
   * Patches only a contiguous range of source-splat centers in the sort worker, instead of re-copying and
   * transferring the entire position buffer (which is hundreds of MB for large streamed datasets and caused
   * a multi-frame freeze on every LOD decode). The worker must already hold a full-size position buffer (from
   * the initial {@link GaussianSplattingSortWorkerCommand.POSITIONS} message at worker creation). Marks the
   * sort dirty so the new splats are sorted in; the caller is responsible for any interval/range refresh.
   * @param splatOffset first splat index of the updated range
   * @param splatCount number of splats in the updated range
   */
  _postWorkerPositionsRange(splatOffset, splatCount) {
    if (!this._worker || !this._splatPositions || splatCount <= 0) {
      return;
    }
    const floatOffset = splatOffset * 4;
    const data = this._splatPositions.slice(floatOffset, floatOffset + splatCount * 4);
    this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.POSITIONS_UPDATE, offset: floatOffset, data }, [data.buffer]);
    this._sortIsDirty = true;
  }
  /**
   * Decodes raw `.splat` bytes (32 bytes/splat) into a contiguous sub-range of the already-allocated atlas,
   * uploading only the affected texels (never touching neighboring parts' texels) and patching just that
   * range of positions in the sort worker. Used to populate a region reserved by
   * {@link GaussianSplattingMesh.reserveStreamingPart} — the CPU path a streaming engine uses when GPU
   * decode/readback is unavailable, and the seam that verifies reservation + interleaving before the
   * streaming engine exists.
   *
   * The atlas textures and `_splatPositions` must already be sized to cover `[globalOffset, globalOffset+count)`
   * (guaranteed after `reserveStreamingPart`). Bounds of the written centers are accumulated into `min`/`max`
   * when provided (so the caller can grow the owning part's bounding info).
   * @param globalOffset first atlas splat index to write
   * @param count number of splats to write
   * @param splatsData raw `.splat` bytes for `count` splats (stride 32)
   * @param min optional running min accumulator for the written centers
   * @param max optional running max accumulator for the written centers
   */
  _writeStreamingSplats(globalOffset, count, splatsData, min, max) {
    if (!this._splatPositions) {
      return;
    }
    const capacity = this._splatPositions.length / 4;
    const uBuffer = GaussianSplattingMeshBase._GetSplatDataBytes(splatsData);
    if (!Number.isInteger(globalOffset) || !Number.isInteger(count) || globalOffset < 0 || count < 0 || globalOffset + count > capacity) {
      throw new Error(`_writeStreamingSplats: range [${globalOffset}, ${globalOffset + count}) is outside the atlas bounds [0, ${capacity})`);
    }
    if (uBuffer.length < count * 32) {
      throw new Error(`_writeStreamingSplats: splatsData has ${uBuffer.length} bytes, need ${count * 32} for ${count} splats (stride 32)`);
    }
    if (count === 0 || !this._covariancesATexture) {
      return;
    }
    const textureSize = this._getTextureSize(this._vertexCount);
    const width = textureSize.x;
    const covBSItemSize = this._useRGBACovariants ? 4 : 2;
    const end = globalOffset + count;
    const fBuffer = GaussianSplattingMeshBase._GetSplatDataFloats(splatsData);
    const covA = new Uint16Array(count * 4);
    const covB = new Uint16Array(count * covBSItemSize);
    const colorArray = new Uint8Array(count * 4);
    const localMin = min ?? new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const localMax = max ?? new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    for (let i = 0; i < count; i++) {
      this._makeSplat(globalOffset + i, fBuffer, uBuffer, covA, covB, colorArray, localMin, localMax, this._flipY, i, i);
    }
    if (this._splatsData) {
      const dst = new Uint8Array(GaussianSplattingMeshBase._GetSplatDataBytes(this._splatsData).buffer);
      dst.set(uBuffer.subarray(0, count * 32), globalOffset * 32);
    }
    const positions = this._splatPositions;
    let gi = globalOffset;
    while (gi < end) {
      const row = Math.floor(gi / width);
      const runEnd = Math.min(end, (row + 1) * width);
      const col = gi - row * width;
      const runLen = runEnd - gi;
      const li = gi - globalOffset;
      this._updateTextureFromDataRect(this._covariancesATexture, new Uint16Array(covA.buffer, li * 4 * 2, runLen * 4), col, row, runLen, 1);
      this._updateTextureFromDataRect(this._covariancesBTexture, new Uint16Array(covB.buffer, li * covBSItemSize * 2, runLen * covBSItemSize), col, row, runLen, 1);
      this._updateTextureFromDataRect(this._centersTexture, new Float32Array(positions.buffer, gi * 4 * 4, runLen * 4), col, row, runLen, 1);
      this._updateTextureFromDataRect(this._colorsTexture, new Uint8Array(colorArray.buffer, li * 4, runLen * 4), col, row, runLen, 1);
      gi = runEnd;
    }
    this._postWorkerPositionsRange(globalOffset, count);
  }
  *_updateData(data, isAsync, sh, partIndices, { flipY = false, previousVertexCount = 0 } = {}, shDegree) {
    if (!this._covariancesATexture) {
      this._readyToDisplay = false;
    }
    this._flipY = flipY;
    this._splatDataRevision++;
    this._splatDataPending = true;
    const uBuffer = new Uint8Array(data);
    const fBuffer = new Float32Array(uBuffer.buffer);
    if (this._keepInRam || this._alwaysRetainSplatsData) {
      this._splatsData = uBuffer.buffer;
      this._shData = sh ? sh.map((arr) => new Uint8Array(arr)) : null;
    } else {
      this._splatsData = null;
      this._shData = null;
    }
    const vertexCount = uBuffer.length / GaussianSplattingMeshBase._RowOutputLength;
    if (vertexCount != this._vertexCount) {
      this._activeSplatRanges = null;
      this._activeSplatRangeKey = "";
      this._activeSplatRenderCount = 0;
      this._updateSplatIndexBuffer(vertexCount);
    }
    this._vertexCount = vertexCount;
    this._maxShDegree = sh ? shDegree ?? 0 : 0;
    this._shDegree = this._maxShDegree;
    const textureSize = this._getTextureSize(vertexCount);
    const textureLength = textureSize.x * textureSize.y;
    const lineCountUpdate = GaussianSplattingMeshBase.ProgressiveUpdateAmount ?? textureSize.y;
    if (partIndices) {
      this._onIndexDataReceived(partIndices, textureLength);
    }
    const minimum = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const maximum = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    const covBSItemSize = this._useRGBACovariants ? 4 : 2;
    const covA = new Uint16Array(textureLength * 4);
    const covB = new Uint16Array(covBSItemSize * textureLength);
    const colorArray = new Uint8Array(textureLength * 4);
    const incremental = this._canReuseCachedData(previousVertexCount, vertexCount, sh?.length ?? 0);
    if (!incremental) {
      this._splatSizeMin = Infinity;
      this._splatSizeMax = -Infinity;
    }
    const firstNewLine = incremental ? Math.floor(previousVertexCount / textureSize.x) : 0;
    const firstNewTexel = firstNewLine * textureSize.x;
    const oldPositions = this._splatPositions;
    this._splatPositions = new Float32Array(4 * textureLength);
    if (incremental) {
      this._splatPositions.set(oldPositions.subarray(0, previousVertexCount * 4));
      minimum.copyFrom(this._cachedBoundingMin);
      maximum.copyFrom(this._cachedBoundingMax);
      this._onIncrementalUpdateStart(textureSize);
    }
    if (GaussianSplattingMeshBase.ProgressiveUpdateAmount) {
      if (!incremental) {
        this._updateTextures(covA, covB, colorArray, sh);
      }
      this.setEnabled(true);
      const partCount = Math.ceil(textureSize.y / lineCountUpdate);
      for (let partIndex = 0; partIndex < partCount; partIndex++) {
        const updateLine = partIndex * lineCountUpdate;
        const batchEndLine = Math.min(updateLine + lineCountUpdate, textureSize.y);
        if (batchEndLine <= firstNewLine) {
          continue;
        }
        const uploadStartLine = Math.max(updateLine, firstNewLine);
        const uploadStartTexel = uploadStartLine * textureSize.x;
        const batchEndTexel = batchEndLine * textureSize.x;
        for (let splatIdx = uploadStartTexel; splatIdx < batchEndTexel; splatIdx++) {
          if (splatIdx < vertexCount) {
            this._makeSplat(splatIdx, fBuffer, uBuffer, covA, covB, colorArray, minimum, maximum, flipY);
          } else {
            this._makeEmptySplat(splatIdx, covA, covB, colorArray);
          }
        }
        this._updateSubTextures(this._splatPositions, covA, covB, colorArray, uploadStartLine, batchEndLine - uploadStartLine, sh);
        this.getBoundingInfo().reConstruct(minimum, maximum, this.getWorldMatrix());
        if (isAsync) {
          yield;
        }
      }
      this._notifyWorkerNewData();
    } else {
      for (let i = firstNewTexel; i < vertexCount; i++) {
        this._makeSplat(i, fBuffer, uBuffer, covA, covB, colorArray, minimum, maximum, flipY);
        if (isAsync && i % GaussianSplattingMeshBase._SplatBatchSize === 0) {
          yield;
        }
      }
      const paddedEnd = incremental ? textureLength : vertexCount + 15 & -16;
      for (let i = vertexCount; i < paddedEnd; i++) {
        this._makeEmptySplat(i, covA, covB, colorArray);
      }
      if (incremental) {
        this._updateSubTextures(this._splatPositions, covA, covB, colorArray, firstNewLine, textureSize.y - firstNewLine, sh);
        this.getBoundingInfo().reConstruct(minimum, maximum, this.getWorldMatrix());
        this.setEnabled(true);
        this._notifyWorkerNewData();
      } else {
        this._updateTextures(covA, covB, colorArray, sh);
        this.getBoundingInfo().reConstruct(minimum, maximum, this.getWorldMatrix());
        this.setEnabled(true);
        this._sortIsDirty = true;
      }
    }
    this._cachedBoundingMin = minimum.clone();
    this._cachedBoundingMax = maximum.clone();
    this._splatDataPending = false;
    this._postToWorker(true);
  }
  /**
   * Update asynchronously the buffer
   * @param data array buffer containing center, color, orientation and scale of splats
   * @param sh optional array of uint8 array for SH data
   * @param partIndices optional array of uint8 for rig node indices
   * @param shDegree optional SH degree of the data
   * @returns a promise
   */
  async updateDataAsync(data, sh, partIndices, shDegree) {
    return await runCoroutineAsync(this._updateData(data, true, sh, partIndices, void 0, shDegree), createYieldingScheduler());
  }
  /**
   * @experimental
   * Update data from GS (position, orientation, color, scaling)
   * @param data array that contain all the datas
   * @param sh optional array of uint8 array for SH data
   * @param options optional informations on how to treat data (needs to be 3rd for backward compatibility)
   * @param partIndices optional array of uint8 for rig node indices
   * @param shDegree optional SH degree of the data
   */
  updateData(data, sh, options = { flipY: true }, partIndices, shDegree) {
    runCoroutineSync(this._updateData(data, false, sh, partIndices, options, shDegree));
  }
  /**
   * Refreshes the bounding info, taking into account all the thin instances defined
   * @returns the current Gaussian Splatting
   */
  refreshBoundingInfo() {
    this.thinInstanceRefreshBoundingInfo(false);
    return this;
  }
  // in case size is different
  _updateSplatIndexBuffer(vertexCount) {
    const renderedSplatCount = this._activeSplatRanges ? this._activeSplatRenderCount : vertexCount;
    const paddedVertexCount = Math.max(renderedSplatCount + 15 & -16, 16);
    const previousIndex = this._splatIndex;
    if (!previousIndex || paddedVertexCount !== previousIndex.length) {
      this._splatIndex = new Float32Array(paddedVertexCount);
      this._cameraViewInfos.forEach((cameraViewInfos) => {
        cameraViewInfos.mesh.thinInstanceSetBuffer("splatIndex", this._splatIndex, 16, false);
      });
    }
    const splatIndex = this._splatIndex;
    if (this._activeSplatRanges) {
      let index = 0;
      for (let rangeIndex = 0; rangeIndex < this._activeSplatRanges.length; rangeIndex += 2) {
        const start = this._activeSplatRanges[rangeIndex];
        const count = this._activeSplatRanges[rangeIndex + 1];
        for (let sourceIndex = start; sourceIndex < start + count; sourceIndex++) {
          splatIndex[index++] = sourceIndex;
        }
      }
      for (; index < paddedVertexCount; index++) {
        splatIndex[index] = vertexCount;
      }
    } else {
      for (let i = 0; i < paddedVertexCount; i++) {
        splatIndex[i] = i;
      }
    }
    if ((!this._depthMix || paddedVertexCount !== this._depthMix.length) && !IsNative) {
      this._depthMix = new BigInt64Array(paddedVertexCount);
    }
    this.forcedInstanceCount = Math.max(paddedVertexCount >> 4, 1);
  }
  _getTextureDataUpdateEngine() {
    return this.getEngine();
  }
  _updateShTextureData(texture, shData, textureWidth, lineStart, lineCount) {
    const engine = this._getTextureDataUpdateEngine();
    if (!engine._gl && !engine.isWebGPU) {
      const internalTexture = texture.getInternalTexture();
      const expectedByteLength = textureWidth * internalTexture.height * 16;
      let uploadData;
      if (shData.byteLength === expectedByteLength && shData.byteOffset % Uint32Array.BYTES_PER_ELEMENT === 0) {
        uploadData = new Uint32Array(shData.buffer, shData.byteOffset, shData.byteLength / Uint32Array.BYTES_PER_ELEMENT);
      } else {
        const padded = new Uint8Array(expectedByteLength);
        padded.set(shData.subarray(0, Math.min(shData.byteLength, expectedByteLength)));
        uploadData = new Uint32Array(padded.buffer);
      }
      engine.updateRawTexture(internalTexture, uploadData, internalTexture.format, internalTexture.invertY, null, internalTexture.type, internalTexture._useSRGBBuffer);
      return;
    }
    const bytesPerTexel = 16;
    const componentsPerTexel = 4;
    const startTexel = lineStart * textureWidth;
    const availableTexelCount = Math.floor(shData.byteLength / bytesPerTexel);
    if (startTexel >= availableTexelCount) {
      return;
    }
    let texelCount = Math.min(lineCount * textureWidth, availableTexelCount - startTexel);
    if (texelCount <= 0) {
      return;
    }
    const createView = (byteOffset, viewTexelCount) => {
      return new Uint32Array(shData.buffer, shData.byteOffset + byteOffset, viewTexelCount * componentsPerTexel);
    };
    const fullRowCount = Math.floor(texelCount / textureWidth);
    if (fullRowCount > 0) {
      const fullRowTexelCount = fullRowCount * textureWidth;
      this._updateTextureFromData(texture, createView(startTexel * bytesPerTexel, fullRowTexelCount), textureWidth, lineStart, fullRowCount);
      texelCount -= fullRowTexelCount;
    }
    if (texelCount > 0) {
      const partialRowOffset = (startTexel + fullRowCount * textureWidth) * bytesPerTexel;
      this._updateTextureFromDataRect(texture, createView(partialRowOffset, texelCount), 0, lineStart + fullRowCount, texelCount, 1);
    }
  }
  _updateSubTextures(centers, covA, covB, colors, lineStart, lineCount, sh) {
    const textureSize = this._getTextureSize(this._vertexCount);
    const covBSItemSize = this._useRGBACovariants ? 4 : 2;
    const texelStart = lineStart * textureSize.x;
    const texelCount = lineCount * textureSize.x;
    const covAView = new Uint16Array(covA.buffer, texelStart * 4 * Uint16Array.BYTES_PER_ELEMENT, texelCount * 4);
    const covBView = new Uint16Array(covB.buffer, texelStart * covBSItemSize * Uint16Array.BYTES_PER_ELEMENT, texelCount * covBSItemSize);
    const colorsView = new Uint8Array(colors.buffer, texelStart * 4, texelCount * 4);
    const centersView = new Float32Array(centers.buffer, texelStart * 4 * Float32Array.BYTES_PER_ELEMENT, texelCount * 4);
    this._updateTextureFromData(this._covariancesATexture, covAView, textureSize.x, lineStart, lineCount);
    this._updateTextureFromData(this._covariancesBTexture, covBView, textureSize.x, lineStart, lineCount);
    this._updateTextureFromData(this._centersTexture, centersView, textureSize.x, lineStart, lineCount);
    this._updateTextureFromData(this._colorsTexture, colorsView, textureSize.x, lineStart, lineCount);
    if (this._rotationsATexture && this._rotationDataA) {
      const rotAView = new Uint16Array(this._rotationDataA.buffer, texelStart * 4 * Uint16Array.BYTES_PER_ELEMENT, texelCount * 4);
      const rotBView = new Uint16Array(this._rotationDataB.buffer, texelStart * 4 * Uint16Array.BYTES_PER_ELEMENT, texelCount * 4);
      const rotScaleView = new Uint16Array(this._rotationScaleData.buffer, texelStart * 4 * Uint16Array.BYTES_PER_ELEMENT, texelCount * 4);
      this._updateTextureFromData(this._rotationsATexture, rotAView, textureSize.x, lineStart, lineCount);
      this._updateTextureFromData(this._rotationsBTexture, rotBView, textureSize.x, lineStart, lineCount);
      this._updateTextureFromData(this._rotationScaleTexture, rotScaleView, textureSize.x, lineStart, lineCount);
    }
    if (sh) {
      for (let i = 0; i < sh.length; i++) {
        this._updateShTextureData(this._shTextures[i], sh[i], textureSize.x, lineStart, lineCount);
      }
    }
  }
  _instantiateWorker() {
    if (!this._vertexCount) {
      return;
    }
    this._updateSplatIndexBuffer(this._vertexCount);
    if (this._disableDepthSort) {
      return;
    }
    if (IsNative) {
      return;
    }
    this._worker?.terminate();
    this._canPostToWorker = true;
    this._worker = new Worker(URL.createObjectURL(new Blob(["(", GaussianSplattingSortWorker.toString(), ")(self)"], {
      type: "application/javascript"
    })));
    const positions = Float32Array.from(this._splatPositions);
    const vertexCount = this._vertexCount;
    this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.POSITIONS, positions, vertexCount }, [positions.buffer]);
    this._postIntervalsToWorker();
    this._onWorkerCreated(this._worker);
    this._worker.onerror = () => {
      this._canPostToWorker = true;
    };
    this._worker.onmessage = (e) => {
      const renderedPadded = Math.max(this.renderedSplatCount + 15 & -16, 16);
      if (e.data.depthMix.length != renderedPadded || e.data.rangeVersion !== this._activeRangeVersion) {
        if (this._depthMix.buffer.byteLength > 0) {
          this._canPostToWorker = true;
          this._postToWorker(true);
          this._sortIsDirty = false;
        }
        return;
      }
      this._depthMix = e.data.depthMix;
      const cameraId = e.data.cameraId;
      const sortRequestId = e.data.sortRequestId;
      if (!this._splatIndex || this._splatIndex.length !== renderedPadded) {
        this._splatIndex = new Float32Array(renderedPadded);
        this._cameraViewInfos.forEach((info) => {
          info.mesh.thinInstanceSetBuffer("splatIndex", this._splatIndex, 16, false);
          info.splatIndexBufferSet = true;
        });
      }
      const indexMix = new Uint32Array(e.data.depthMix.buffer);
      if (this._splatIndex) {
        for (let j = 0; j < renderedPadded; j++) {
          this._splatIndex[j] = indexMix[2 * j];
        }
      }
      this.forcedInstanceCount = Math.max(renderedPadded >> 4, 1);
      this._commitDelayedTextureUpdate();
      const cameraViewInfos = this._cameraViewInfos.get(cameraId);
      if (cameraViewInfos) {
        if (cameraViewInfos.splatIndexBufferSet) {
          cameraViewInfos.mesh.thinInstanceBufferUpdated("splatIndex");
        } else {
          cameraViewInfos.mesh.thinInstanceSetBuffer("splatIndex", this._splatIndex, 16, false);
          cameraViewInfos.splatIndexBufferSet = true;
        }
        cameraViewInfos.sortAppliedId = sortRequestId;
      }
      this._canPostToWorker = true;
      this._readyToDisplay = true;
      if (this._sortIsDirty) {
        this._postToWorker(true);
        this._sortIsDirty = false;
      }
    };
  }
  _getTextureSize(length) {
    const engine = this._scene.getEngine();
    const width = engine.getCaps().maxTextureSize;
    let height = 1;
    if (engine.version === 1 && !engine.isWebGPU) {
      while (width * height < length) {
        height *= 2;
      }
      if (length > 0 && width * height === length) {
        height *= 2;
      }
    } else {
      height = Math.ceil(length / width);
      if (length > 0 && height * width === length) {
        height += 1;
      }
    }
    if (height > width) {
      Logger.Error("GaussianSplatting texture size: (" + width + ", " + height + "), maxTextureSize: " + width);
      height = width;
    }
    return new Vector2(width, height);
  }
  /**
   * Called after the sort worker has been created and the initial positions message has been sent.
   * Override in subclasses to post any additional setup messages the worker needs (e.g. group
   * indices, per-part matrices, etc.).
   * @param _worker the newly created worker
   */
  _onWorkerCreated(_worker) {
  }
  /**
   * Called by the material to bind any extra shader uniforms that are specific to this mesh type.
   * The base implementation is a no-op; override in subclasses to bind additional data.
   * @param _effect the shader effect that is being bound
   * @internal
   */
  bindExtraEffectUniforms(_effect) {
  }
  /**
   * Processes all splats from a source GaussianSplattingMesh directly into the destination
   * texture arrays starting at dstOffset. This is the core of the texture-direct compound API:
   * no merged CPU buffer is ever created; each source mesh is written straight into its region.
   *
   * @param source - The source mesh whose splats are appended
   * @param dstOffset - The destination splat index at which writing starts
   * @param covA - Destination covA array (full texture size)
   * @param covB - Destination covB array (full texture size)
   * @param colorArray - Destination color array (full texture size)
   * @param sh - Destination SH arrays (full texture size), or undefined
   * @param minimum - Accumulated bounding min (updated in-place)
   * @param maximum - Accumulated bounding max (updated in-place)
   * @internal Use GaussianSplattingMesh.addPart instead
   */
  _appendSourceToArrays(source, dstOffset, covA, covB, colorArray, sh, minimum, maximum) {
    const srcCount = source._vertexCount;
    const bytesPerTexel = 16;
    const srcRaw = source._splatsData;
    if (!srcRaw || srcCount === 0) {
      return;
    }
    const uBuffer = GaussianSplattingMeshBase._GetSplatDataBytes(srcRaw);
    const fBuffer = GaussianSplattingMeshBase._GetSplatDataFloats(srcRaw);
    for (let i = 0; i < srcCount; i++) {
      this._makeSplat(dstOffset + i, fBuffer, uBuffer, covA, covB, colorArray, minimum, maximum, false, i);
    }
    if (sh && source._shData) {
      for (let texIdx = 0; texIdx < sh.length; texIdx++) {
        if (texIdx < source._shData.length) {
          sh[texIdx].set(source._shData[texIdx].subarray(0, srcCount * bytesPerTexel), dstOffset * bytesPerTexel);
        }
      }
    }
  }
  /**
   * Modifies the splats according to the passed transformation matrix.
   * @param transform defines the transform matrix to use
   * @returns the current mesh
   */
  bakeTransformIntoVertices(transform) {
    const arrayBuffer = this.splatsData;
    if (!arrayBuffer) {
      Logger.Error("Cannot bake transform into vertices if splatsData is not kept in RAM");
      return this;
    }
    const m = transform.m;
    const scaleX = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
    const scaleY = Math.sqrt(m[4] * m[4] + m[5] * m[5] + m[6] * m[6]);
    const scaleZ = Math.sqrt(m[8] * m[8] + m[9] * m[9] + m[10] * m[10]);
    const epsilon = 1e-3;
    if (Math.abs(scaleX - scaleY) > epsilon || Math.abs(scaleX - scaleZ) > epsilon) {
      Logger.Error("Gaussian Splatting bakeTransformIntoVertices does not support non-uniform scaling");
      return this;
    }
    const uBuffer = new Uint8Array(arrayBuffer);
    const fBuffer = new Float32Array(arrayBuffer);
    const temp = TmpVectors.Vector3[0];
    let index;
    const quaternion = TmpVectors.Quaternion[0];
    const transformedQuaternion = TmpVectors.Quaternion[1];
    transform.decompose(temp, transformedQuaternion, temp);
    for (index = 0; index < this._vertexCount; index++) {
      const floatIndex = index * 8;
      Vector3.TransformCoordinatesFromFloatsToRef(fBuffer[floatIndex], fBuffer[floatIndex + 1], fBuffer[floatIndex + 2], transform, temp);
      fBuffer[floatIndex] = temp.x;
      fBuffer[floatIndex + 1] = temp.y;
      fBuffer[floatIndex + 2] = temp.z;
      fBuffer[floatIndex + 3] *= scaleX;
      fBuffer[floatIndex + 4] *= scaleX;
      fBuffer[floatIndex + 5] *= scaleX;
      quaternion.set((uBuffer[32 * index + 28 + 1] - 127.5) / 127.5, (uBuffer[32 * index + 28 + 2] - 127.5) / 127.5, (uBuffer[32 * index + 28 + 3] - 127.5) / 127.5, (uBuffer[32 * index + 28 + 0] - 127.5) / 127.5);
      quaternion.normalize();
      if (this.scaling.x < 0) {
        quaternion.x = -quaternion.x;
        quaternion.w = -quaternion.w;
      }
      if (this.scaling.y < 0) {
        quaternion.y = -quaternion.y;
        quaternion.w = -quaternion.w;
      }
      if (this.scaling.z < 0) {
        quaternion.z = -quaternion.z;
        quaternion.w = -quaternion.w;
      }
      transformedQuaternion.multiplyToRef(quaternion, quaternion);
      quaternion.normalize();
      uBuffer[32 * index + 28 + 0] = Math.round(quaternion.w * 127.5 + 127.5);
      uBuffer[32 * index + 28 + 1] = Math.round(quaternion.x * 127.5 + 127.5);
      uBuffer[32 * index + 28 + 2] = Math.round(quaternion.y * 127.5 + 127.5);
      uBuffer[32 * index + 28 + 3] = Math.round(quaternion.z * 127.5 + 127.5);
    }
    this.updateData(arrayBuffer, this.shData ?? void 0, { flipY: false });
    return this;
  }
}
GaussianSplattingMeshBase.UseCountingSort = true;
GaussianSplattingMeshBase.LogSortPerformance = false;
GaussianSplattingMeshBase._RowOutputLength = 3 * 4 + 3 * 4 + 4 + 4;
GaussianSplattingMeshBase._SH_C0 = 0.28209479177387814;
GaussianSplattingMeshBase._SplatBatchSize = 327680;
GaussianSplattingMeshBase._PlyConversionBatchSize = 32768;
GaussianSplattingMeshBase._BatchSize = 16;
GaussianSplattingMeshBase._DefaultViewUpdateThreshold = 1e-4;
GaussianSplattingMeshBase.ProgressiveUpdateAmount = 0;
function AllocateShBuffers(textureCount, bytesEach) {
  const result = [];
  for (let i = 0; i < textureCount; i++) {
    const arr = new Uint8Array(bytesEach);
    arr.fill(128);
    result.push(arr);
  }
  return result;
}
class GaussianSplattingPartProxyMesh extends Mesh {
  /**
   * Gets the index of the part in the compound mesh
   */
  get partIndex() {
    return this._partIndex;
  }
  /**
   * Backward-compatible alias for the owning compound mesh.
   * @deprecated Use `compoundSplatMesh` instead.
   */
  get proxiedMesh() {
    return this.compoundSplatMesh;
  }
  /**
   * Creates a new Gaussian Splatting part proxy mesh
   * @param name The name of the proxy mesh
   * @param scene The scene the proxy mesh belongs to
   * @param compoundSplatMesh The compound mesh that owns this part proxy
   * @param partIndex The index of the part in the compound mesh
   * @param boundingInfo Local-space bounds of the part inside the compound mesh
   * @param vertexCount Number of splats owned by the part
   * @param splatsDataOffset Offset of the part in the compound splat ordering
   * @param shDataOffset Offset of the part in the compound SH textures
   */
  constructor(name, scene, compoundSplatMesh, partIndex, boundingInfo, vertexCount, splatsDataOffset, shDataOffset = splatsDataOffset) {
    super(name, scene);
    this._disabledVisibility = null;
    this._partIndex = partIndex;
    this._vertexCount = vertexCount;
    this._splatsDataOffset = splatsDataOffset;
    this._shDataOffset = shDataOffset;
    this._minimum = boundingInfo.minimum.clone();
    this._maximum = boundingInfo.maximum.clone();
    this.compoundSplatMesh = compoundSplatMesh;
    this._applyBoundingInfo();
    this.compoundSplatMesh.setWorldMatrixForPart(this.partIndex, this.getWorldMatrix());
    this.onAfterWorldMatrixUpdateObservable.add(() => {
      this.compoundSplatMesh.setWorldMatrixForPart(this.partIndex, this.getWorldMatrix());
    });
    this.onEffectiveEnabledStateChangedObservable.add((isEnabled) => {
      if (isEnabled) {
        this.compoundSplatMesh.setPartVisibility(this.partIndex, this._disabledVisibility ?? this.compoundSplatMesh.getPartVisibility(this.partIndex));
        this._disabledVisibility = null;
      } else {
        this._disabledVisibility = this.compoundSplatMesh.getPartVisibility(this.partIndex);
        this.compoundSplatMesh.setPartVisibility(this.partIndex, 0);
      }
    });
  }
  /**
   * Updates the bounding info of this proxy mesh from its stored part metadata.
   */
  updateBoundingInfoFromPartData() {
    this._applyBoundingInfo();
  }
  /**
   * Backward-compatible alias retained while callers move away from source-mesh based semantics.
   */
  updateBoundingInfoFromProxiedMesh() {
    this.updateBoundingInfoFromPartData();
  }
  _applyBoundingInfo() {
    this.setBoundingInfo(new BoundingInfo(this._minimum.clone(), this._maximum.clone()));
  }
  /**
   * Returns the class name
   * @returns "GaussianSplattingPartProxyMesh"
   */
  getClassName() {
    return "GaussianSplattingPartProxyMesh";
  }
  /**
   * Returns the world-space bounding vectors spanning this part (and any descendants).
   *
   * A part proxy carries real bounds (set via {@link setBoundingInfo}) but owns NO geometry — the compound
   * holds the splats. The base {@link Node.getHierarchyBoundingVectors} only folds in a mesh's own bounds
   * when it has a `subMeshes` array (a geometry-less mesh's is `undefined`) and skips zero-vertex descendants,
   * so for a bare proxy it returns a degenerate ±MAX_VALUE box. Callers that treat the proxy as a normal mesh
   * (camera framing, grounding, picking) would then derive NaN / astronomically large offsets. This override
   * folds the proxy's own world-space box into whatever the base returns for descendants.
   * @param includeDescendants include bounding vectors from descendant meshes
   * @param predicate optional filter applied to each descendant mesh
   * @returns the world-space min/max spanning this part (and any descendants)
   */
  getHierarchyBoundingVectors(includeDescendants = true, predicate = null) {
    const result = super.getHierarchyBoundingVectors(includeDescendants, predicate);
    const info = this.getBoundingInfo();
    info.update(this.getWorldMatrix());
    Vector3.CheckExtends(info.boundingBox.minimumWorld, result.min, result.max);
    Vector3.CheckExtends(info.boundingBox.maximumWorld, result.min, result.max);
    return result;
  }
  /**
   * Updates the part index for this proxy mesh.
   * This should only be called internally when parts are removed from the compound mesh.
   * @param newPartIndex the new part index
   * @internal
   */
  updatePartIndex(newPartIndex) {
    this._partIndex = newPartIndex;
  }
  /**
   * Updates the per-part metadata for this proxy mesh.
   * This is used internally when compound parts are rebuilt and re-indexed.
   * @param vertexCount the number of splats owned by the part
   * @param splatsDataOffset the new splat offset in the compound
   * @param shDataOffset the new SH texel offset in the compound
   * @internal
   */
  updatePartMetadata(vertexCount, splatsDataOffset, shDataOffset = splatsDataOffset) {
    this._vertexCount = vertexCount;
    this._splatsDataOffset = splatsDataOffset;
    this._shDataOffset = shDataOffset;
  }
  /**
   * Gets whether the part should be visible when this proxy is enabled
   */
  get isVisible() {
    return this.visibility > 0;
  }
  /**
   * Sets whether the part should be visible when this proxy is enabled
   */
  set isVisible(value) {
    this.visibility = value ? 1 : 0;
  }
  /**
   * Gets the visibility applied to the part while this proxy is enabled (0.0 to 1.0)
   */
  get visibility() {
    return this._disabledVisibility ?? this.compoundSplatMesh.getPartVisibility(this.partIndex);
  }
  /**
   * Sets the visibility to apply to the part while this proxy is enabled (0.0 to 1.0)
   */
  set visibility(value) {
    const visibility = Math.max(0, Math.min(1, value));
    if (this.isEnabled()) {
      this.compoundSplatMesh.setPartVisibility(this.partIndex, visibility);
    } else {
      this._disabledVisibility = visibility;
    }
  }
  /**
   * Checks if a ray intersects with this proxy mesh using only bounding info
   * @param ray defines the ray to test
   * @returns the picking info with this mesh set as pickedMesh if hit
   */
  intersects(ray) {
    const pickingInfo = new PickingInfo();
    const boundingInfo = this.getBoundingInfo();
    if (!boundingInfo) {
      return pickingInfo;
    }
    if (!ray.intersectsSphere(boundingInfo.boundingSphere) || !ray.intersectsBox(boundingInfo.boundingBox)) {
      return pickingInfo;
    }
    pickingInfo.hit = true;
    pickingInfo.pickedMesh = this;
    pickingInfo.distance = Vector3.Distance(ray.origin, boundingInfo.boundingSphere.center);
    pickingInfo.subMeshId = 0;
    return pickingInfo;
  }
  /**
   * Serialize current GaussianSplattingPartProxyMesh
   * @param serializationObject defines the object which will receive the serialization data
   * @returns the serialized object
   */
  serialize(serializationObject = {}) {
    serializationObject = super.serialize(serializationObject);
    serializationObject.subMeshes = [];
    serializationObject.geometryUniqueId = void 0;
    serializationObject.geometryId = void 0;
    serializationObject.materialUniqueId = void 0;
    serializationObject.materialId = void 0;
    serializationObject.instances = [];
    serializationObject.actions = void 0;
    serializationObject.type = this.getClassName();
    serializationObject.compoundSplatMeshId = this.compoundSplatMesh.id;
    serializationObject.partIndex = this._partIndex;
    serializationObject.vertexCount = this._vertexCount;
    serializationObject.splatsDataOffset = this._splatsDataOffset;
    serializationObject.shDataOffset = this._shDataOffset;
    const boundingInfo = this.getBoundingInfo();
    serializationObject.boundingInfo = {
      minimum: boundingInfo.minimum.asArray(),
      maximum: boundingInfo.maximum.asArray()
    };
    return serializationObject;
  }
  /**
   * Parses a serialized GaussianSplattingPartProxyMesh
   * @param parsedMesh the serialized mesh
   * @param scene the scene to create the GaussianSplattingPartProxyMesh in
   * @returns the created GaussianSplattingPartProxyMesh
   */
  static Parse(parsedMesh, scene) {
    const partIndex = parsedMesh.partIndex;
    const compoundSplatMesh = parsedMesh.compoundSplatMesh ?? scene.getLastMeshById(parsedMesh.compoundSplatMeshId);
    if (!compoundSplatMesh) {
      throw new Error(`GaussianSplattingPartProxyMesh: compound mesh not found with ID ${parsedMesh.compoundSplatMeshId}`);
    }
    const minimum = Vector3.FromArray(parsedMesh.boundingInfo.minimum);
    const maximum = Vector3.FromArray(parsedMesh.boundingInfo.maximum);
    const boundingInfo = new BoundingInfo(minimum, maximum);
    const vertexCount = parsedMesh.vertexCount ?? 0;
    const splatsDataOffset = parsedMesh.splatsDataOffset ?? 0;
    const shDataOffset = parsedMesh.shDataOffset ?? splatsDataOffset;
    return new GaussianSplattingPartProxyMesh(parsedMesh.name, scene, compoundSplatMesh, partIndex, boundingInfo, vertexCount, splatsDataOffset, shDataOffset);
  }
}
let _Registered$1 = false;
function RegisterGaussianSplattingPartProxyMesh() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  Mesh._GaussianSplattingPartProxyMeshParser = GaussianSplattingPartProxyMesh.Parse;
}
let _PointSplattingControllerFactory = null;
function _SetGaussianPointSplattingControllerFactory(factory) {
  _PointSplattingControllerFactory = factory;
}
const _GaussianSplattingBytesPerSplat = 32;
const _GaussianSplattingBytesPerShTexel = 16;
function CompressPartIndices(partIndices) {
  const runs = [];
  const length = partIndices.length;
  let i = 0;
  while (i < length) {
    const value = partIndices[i];
    let count = 1;
    while (i + count < length && partIndices[i + count] === value) {
      count++;
    }
    runs.push(count, value);
    i += count;
  }
  return new Uint32Array(runs);
}
function ParsePartIndices(compressed) {
  let totalCount = 0;
  const length = compressed.length;
  for (let i = 0; i < length; i += 2) {
    totalCount += compressed[i];
  }
  const partIndices = new Uint8Array(totalCount);
  let offset = 0;
  for (let i = 0; i < length; i += 2) {
    const count = compressed[i];
    const value = compressed[i + 1];
    partIndices.fill(value, offset, offset + count);
    offset += count;
  }
  return partIndices;
}
class GaussianSplattingMesh extends GaussianSplattingMeshBase {
  /**
   * Internal render-resolution scale for point splatting (1 = full). Lower values emit ~scale^2 fewer
   * points; full resolution is reconstructed over frames. `"auto"` (default) targets a device-tiered point
   * budget, with the upscale factor capped at 8. Setting it restarts accumulation.
   */
  get pointSplattingRenderScale() {
    return this._pointRenderScale;
  }
  set pointSplattingRenderScale(value) {
    if (value === this._pointRenderScale) {
      return;
    }
    this._pointRenderScale = value;
    if (this._pointController) {
      this._pointController.renderScale = value;
    }
  }
  /** Enables previous-frame Hi-Z culling in point mode. Off by default because translucent splats can be biased. */
  get pointSplattingOcclusionCulling() {
    return this._pointOcclusionCulling;
  }
  set pointSplattingOcclusionCulling(value) {
    if (value === this._pointOcclusionCulling) {
      return;
    }
    this._pointOcclusionCulling = value;
    if (this._pointController) {
      this._pointController.occlusionCulling = value;
    }
  }
  /** Gets the part indices texture used for compound rendering */
  get partIndicesTexture() {
    return this._partIndicesTexture;
  }
  /**
   * Creates a new GaussianSplattingMesh
   * @param name the name of the mesh
   * @param url optional URL to load a Gaussian Splatting file from
   * @param scene the hosting scene
   * @param keepInRam whether to keep the raw splat data in RAM after uploading to GPU
   * @param needsRotationScaleTextures generate rotation and scale matrix textures required for voxel-based IBL shadows
   */
  constructor(name, url = null, scene = null, keepInRam = false, needsRotationScaleTextures = false) {
    super(name, url, scene, keepInRam);
    this._partProxies = [];
    this._part0LocalMin = null;
    this._part0LocalMax = null;
    this._partMatrices = [];
    this._rebuilding = false;
    this._partVisibility = [];
    this._pointScale = 1;
    this._pointRenderScale = "auto";
    this._pointOcclusionCulling = false;
    this._pointController = null;
    this._partSplatRanges = [];
    this._hasStreamingPart = false;
    this._streamingStates = [];
    this._splatBudget = 0;
    this._lodBudgetParticipants = [];
    this._budgetObserver = null;
    this._budgetDemands = [];
    this._budgetAlloc = [];
    this._budgetSettled = [];
    this._streamingShDegree = 0;
    this._tombstonedPartIndices = /* @__PURE__ */ new Set();
    this._partIndicesTexture = null;
    this._partIndices = null;
    this._partWorldData = new Float32Array(0);
    this._partVisibilityData = [];
    this._alwaysRetainSplatsData = true;
    this._needsRotationScaleTextures = needsRotationScaleTextures;
  }
  /**
   * Returns the class name
   * @returns "GaussianSplattingMesh"
   */
  getClassName() {
    return "GaussianSplattingMesh";
  }
  /**
   * Is this node ready to be used/rendered.
   * Force-syncs every part proxy's world matrix into `_partMatrices` BEFORE delegating to
   * the base readiness check. This guarantees that any pending proxy transform changes
   * (for example a user-set `proxy.position`) are reflected in the next sort post, so the
   * base `isReady` will only return true once `sortAppliedId === sortRequestId` for that
   * up-to-date state. Without this, the proxy's `onAfterWorldMatrixUpdateObservable` would
   * fire during the first render and queue a fresh sort AFTER readiness was reported,
   * leaving the rendered frame with stale splat order on `renderCount=1` runs.
   * @param completeCheck defines if a complete check (including materials and lights) has to be done (false by default)
   * @returns true when ready
   */
  isReady(completeCheck = false) {
    for (const proxy of this._partProxies) {
      if (proxy) {
        proxy.computeWorldMatrix(true);
      }
    }
    return super.isReady(completeCheck);
  }
  /**
   * Recomputes compound local-space bounds from part 0's stored AABB (if unproxied) plus all
   * proxy world AABBs inverse-transformed to compound-local space. All 8 corners of each proxy
   * AABB are transformed so the result is correct under non-identity compound rotation/scale.
   */
  _updateBoundingInfoFromProxies() {
    const compoundWorld = this.getWorldMatrix();
    const invCompoundWorld = Matrix.Invert(compoundWorld);
    const localMin = this._part0LocalMin ? this._part0LocalMin.clone() : new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const localMax = this._part0LocalMax ? this._part0LocalMax.clone() : new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    const corner = new Vector3();
    for (const proxy of this._partProxies) {
      if (!proxy || this._tombstonedPartIndices.has(proxy.partIndex)) {
        continue;
      }
      proxy.computeWorldMatrix(false);
      const bb = proxy.getBoundingInfo().boundingBox;
      const wMin = bb.minimumWorld;
      const wMax = bb.maximumWorld;
      for (let b = 0; b < 8; b++) {
        corner.set(b & 1 ? wMax.x : wMin.x, b & 2 ? wMax.y : wMin.y, b & 4 ? wMax.z : wMin.z);
        Vector3.TransformCoordinatesToRef(corner, invCompoundWorld, corner);
        localMin.minimizeInPlace(corner);
        localMax.maximizeInPlace(corner);
      }
    }
    if (localMin.x <= localMax.x) {
      if (this._boundingInfo) {
        this._boundingInfo.reConstruct(localMin, localMax, compoundWorld);
      } else {
        this._boundingInfo = new BoundingInfo(localMin, localMax, compoundWorld);
      }
      this._cachedBoundingMin = localMin.clone();
      this._cachedBoundingMax = localMax.clone();
    }
  }
  /**
   * Override for compound meshes: recomputes bounds from proxy world extents instead of
   * local bounds × world matrix, which is wrong for proxied parts with independent transforms.
   * @returns this mesh
   */
  _updateBoundingInfo() {
    if (this.isCompound) {
      this._updateBoundingInfoFromProxies();
      this._updateSubMeshesBoundingInfo(this.worldMatrixFromCache);
      return this;
    }
    return super._updateBoundingInfo();
  }
  /**
   * Replaces the base hierarchy bounds computation for compound meshes: computes world bounds
   * from scratch by iterating part 0's local AABB and all proxy meshes, rather than delegating
   * to the base _children traversal which never reaches proxies (they are not parented to the
   * compound). Visibility per-part is respected; invisible parts are excluded.
   * @param includeDescendants when true, includes descendants (default: true)
   * @param predicate optional filter predicate
   * @returns world-space min/max of the hierarchy bounding box
   */
  getHierarchyBoundingVectors(includeDescendants = true, predicate = null) {
    if (!this.isCompound) {
      return super.getHierarchyBoundingVectors(includeDescendants, predicate);
    }
    const min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    if (this._part0LocalMin && (this._partVisibility[0] ?? 1) > 0) {
      const wm = this.getWorldMatrix();
      const lMin = this._part0LocalMin;
      const lMax = this._part0LocalMax;
      const corner = new Vector3();
      for (let b = 0; b < 8; b++) {
        corner.set(b & 1 ? lMax.x : lMin.x, b & 2 ? lMax.y : lMin.y, b & 4 ? lMax.z : lMin.z);
        Vector3.TransformCoordinatesToRef(corner, wm, corner);
        min.minimizeInPlace(corner);
        max.maximizeInPlace(corner);
      }
    }
    for (let i = 0; i < this._partProxies.length; i++) {
      const proxy = this._partProxies[i];
      if (!proxy || (this._partVisibility[i] ?? 1) === 0) {
        continue;
      }
      proxy.computeWorldMatrix(false);
      const bb = proxy.getBoundingInfo().boundingBox;
      min.minimizeInPlace(bb.minimumWorld);
      max.maximizeInPlace(bb.maximumWorld);
    }
    return { min, max };
  }
  /**
   * Disposes proxy meshes and clears part data in addition to the base class GPU resources.
   * @param doNotRecurse Set to true to not recurse into each children
   */
  dispose(doNotRecurse) {
    if (this._budgetObserver) {
      this.getScene().onBeforeRenderObservable.remove(this._budgetObserver);
      this._budgetObserver = null;
    }
    this._lodBudgetParticipants = [];
    for (const proxy of this._partProxies) {
      proxy.dispose();
    }
    this._partIndicesTexture?.dispose();
    this._partProxies = [];
    this._partMatrices = [];
    this._partVisibility = [];
    this._partIndicesTexture = null;
    this._part0LocalMin = null;
    this._part0LocalMax = null;
    this._pointController?.dispose();
    this._pointController = null;
    super.dispose(doNotRecurse);
  }
  // ---------------------------------------------------------------------------
  // Worker and material hooks
  // ---------------------------------------------------------------------------
  /**
   * Posts the initial per-part data to the sort worker after it has been created.
   * Sends the current part matrices and group index array so the worker can correctly
   * weight depth values per part.
   * @param worker the newly created sort worker
   */
  _onWorkerCreated(worker) {
    worker.postMessage({ command: GaussianSplattingSortWorkerCommand.PART_MATRICES, partMatrices: this._partMatrices.map((matrix) => new Float32Array(matrix.m)) });
    worker.postMessage({ command: GaussianSplattingSortWorkerCommand.PART_INDICES, partIndices: this._partIndices ? new Uint8Array(this._partIndices) : null });
  }
  /**
   * Stores the raw part index array, padded to texture length, so the worker and GPU texture
   * creation step have access to it.
   * @param partIndices - the raw part indices array received during a data load
   * @param textureLength - the padded texture length to allocate into
   */
  _onIndexDataReceived(partIndices, textureLength) {
    this._partIndices = new Uint8Array(textureLength);
    this._partIndices.set(partIndices);
  }
  // Point-splatting properties are no-ops until the controller module is registered.
  /**
   * Lazily creates this mesh's point-splatting controller, or null when the optional module is absent.
   * @returns the controller, or null when point splatting has not been registered
   */
  _ensurePointController() {
    if (!this._pointController) {
      if (!_PointSplattingControllerFactory) {
        Logger.Warn('GaussianSplattingMesh: point splatting is not registered; import "@babylonjs/core/Meshes/GaussianSplatting/gaussianPointSplattingController" to enable it.');
        return null;
      }
      this._pointController = _PointSplattingControllerFactory(this);
      this._pointController.pointScale = this._pointScale;
      this._pointController.renderScale = this._pointRenderScale;
      this._pointController.occlusionCulling = this._pointOcclusionCulling;
    }
    return this._pointController;
  }
  /**
   * Whether the main color pass is rendered with the WebGPU compute point-splatting path instead of the
   * classic sorted quads. Off by default; other passes (shadows, picking, prepass) are unaffected. Falls
   * back to the classic path for multiple or rig cameras, floating-origin scenes, clip planes, and streamed parts.
   * Color rendering also falls back when the camera viewport does not cover the full target or projected-size visualization is enabled.
   * Wireframe, point-cloud, and other non-triangle fill modes use classic color, including scene-wide and mesh overrides.
   * Clipping and depth quantization use the supplied projection's planes, including frozen projections.
   * Tilted and custom projections are supported by the point path. Compute runs immediately
   * before compositing with the pass's actual view and target dimensions; matching color and depth passes share one result.
   * While point shaders compile, the pass waits without drawing classic splats. The color pass uses the classic path
   * while the GaussianSplattingSolidColorMaterialPlugin override is enabled or the source material's
   * alpha mode is not ALPHA_COMBINE. Point color supports only the built-in GaussianSplattingMaterial;
   * NodeMaterials, subclasses, and other source materials use classic color to preserve their shader behavior.
   * Custom material plugins and built-in visualization or picking plugins use classic color unless their
   * behavior is explicitly reproduced or they are known neutral while disabled. The built-in debug plugin is supported.
   * The source must require alpha blending without alpha testing; opaque and alpha-test transparency modes use classic color.
   * Material compatibility is reevaluated each draw, including after material replacement or plugin attachment. WebGPU only.
   *
   * Limitation: each pixel's accumulated color is depth-tested as a whole against its latest sample's depth. Where
   * other geometry intersects the splats, occluded splats can bleed through or visible ones drop out, and the
   * result can flicker as the latest sample changes. Non-intersecting geometry composites correctly, and mostly
   * opaque splats show no visible artifacts.
   *
   * Requires `@babylonjs/core/Meshes/GaussianSplatting/gaussianPointSplattingController` (included in
   * `@babylonjs/core`); without it, enabling this logs a warning and does nothing.
   * @see https://playground.babylonjs.com/#F39YWU#1
   */
  get pointSplattingRenderMode() {
    return this._pointController?.colorRenderMode ?? false;
  }
  set pointSplattingRenderMode(value) {
    if (value === this.pointSplattingRenderMode) {
      return;
    }
    const controller = value ? this._ensurePointController() : this._pointController;
    if (controller) {
      controller.colorRenderMode = value;
    }
  }
  /**
   * Whether the active camera's DepthRenderer depth for this mesh comes from the point-splatting compute
   * (an opaque nearest-surface depth) instead of the classic path. Off by default and independent of
   * {@link pointSplattingRenderMode}, with the same camera, floating-origin, clip-plane, data fallbacks and module requirement.
   * Color-only material fallbacks do not disable point depth. Scene-wide wireframe or point-cloud overrides
   * use classic depth. For partial camera viewports, point depth
   * requires a depth map with ignoreCameraViewport enabled. When point color is supported, depth maps
   * with different pixel dimensions use classic depth to preserve color accumulation.
   * Depth passes whose view, material parameters, or part inputs differ from retained point-color history
   * also use classic depth rather than resetting that history. WebGPU only.
   */
  get pointSplattingDepthRenderMode() {
    return this._pointController?.depthRenderMode ?? false;
  }
  set pointSplattingDepthRenderMode(value) {
    if (value === this.pointSplattingDepthRenderMode) {
      return;
    }
    const controller = value ? this._ensurePointController() : this._pointController;
    if (controller) {
      controller.depthRenderMode = value;
    }
  }
  /**
   * Counters of the most recent point-splatting compute frame, or null when compute has no available result.
   * Individual render passes may still use the classic path for unsupported configurations.
   *
   * Snapshot `renderedFrameCount` whenever `accumulationVersion` changes: after the first frame of a
   * generation, each further `pixelCycleLength` frames add one sample to every output pixel.
   * @returns the latest compute counters, or null when point splatting is not producing frames
   */
  get pointSplattingProgress() {
    return this._pointController?.progress ?? null;
  }
  /** Density multiplier for point splatting (higher = denser and slower). */
  get pointSplattingScale() {
    return this._pointScale;
  }
  set pointSplattingScale(value) {
    this._pointScale = value;
    if (this._pointController) {
      this._pointController.pointScale = value;
    }
  }
  /**
   * True when this mesh hosts a streamed (GPU-decoded) region, which is absent from the CPU `_splatsData`
   * that point splatting decodes.
   * @internal
   */
  get _pointStreamingUnsupported() {
    return this._hasStreamingPart;
  }
  /**
   * Force-computes every part proxy's world matrix (a non-forced call skips nodes already computed this frame).
   * @internal
   */
  _syncPartProxyWorldMatrices() {
    for (const proxy of this._partProxies) {
      proxy?.computeWorldMatrix(true);
    }
  }
  /**
   * Protected state the point-splatting controller needs to decode {@link _splatsData}.
   * @returns the decoded atlas positions, fallback flip-Y convention, part indices, and active splat-range pairs
   * @internal
   */
  _getPointDecodeInputs() {
    return { positions: this._splatPositions, flipY: this._flipY, partIndices: this._partIndices, activeRanges: this._activeSplatRanges };
  }
  _drawColorPass(mesh, subMesh, enableAlphaMode, effectiveMeshReplacement) {
    if (this._pointController?.drawColorPass(enableAlphaMode)) {
      return mesh;
    }
    return super._drawColorPass(mesh, subMesh, enableAlphaMode, effectiveMeshReplacement);
  }
  _isSortRequired() {
    return !this._pointController?.handlesCurrentPass;
  }
  _drawPointPass(enableAlphaMode) {
    return this._pointController?.drawColorPass(enableAlphaMode) ?? false;
  }
  /**
   * Returns `true` when at least one part has been added to this compound mesh.
   * Returns `false` before any parts are added, so the mesh renders in normal
   * (non-compound) mode until the first addPart/addParts call. This matches the
   * old base-class behavior of `this._partMatrices.length > 0` and avoids
   * binding unset partWorld uniforms (which would cause division-by-zero in the
   * Gaussian projection Jacobian and produce huge distorted splats).
   * @internal
   */
  get isCompound() {
    return this._partMatrices.length > 0;
  }
  /**
   * During a removePart rebuild, keep the existing sort worker alive rather than
   * tearing it down and spinning up a new one. This avoids startup latency and the
   * transient state window where a stale sort could fire against an incomplete
   * partMatrices array.
   * Outside of a rebuild the base-class behaviour is used unchanged.
   */
  _instantiateWorker() {
    if (this._rebuilding && this._worker) {
      this._updateSplatIndexBuffer(this._vertexCount);
      return;
    }
    super._instantiateWorker();
  }
  /**
   * Ensures the part-index GPU texture exists at the start of an incremental update.
   * Called before the sub-texture upload so the correct texture is available for the first batch.
   * @param textureSize - current texture dimensions
   */
  _onIncrementalUpdateStart(textureSize) {
    this._ensurePartIndicesTexture(textureSize, this._partIndices ?? void 0);
  }
  /**
   * Posts positions (via super) and then additionally posts the current part-index array
   * to the sort worker so it can associate each splat with its part.
   */
  _notifyWorkerNewData() {
    super._notifyWorkerNewData();
    if (this._worker) {
      this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.PART_INDICES, partIndices: this._partIndices ?? null });
    }
  }
  /**
   * Binds all compound-specific shader uniforms: the group index texture, per-part world
   * matrices, and per-part visibility values.
   * @param effect the shader effect that is being bound
   * @internal
   */
  bindExtraEffectUniforms(effect) {
    if (!this._partIndicesTexture) {
      return;
    }
    effect.setTexture("partIndicesTexture", this._partIndicesTexture);
    const partWorldDataLength = this.partCount * 16;
    if (this._partWorldData.length !== partWorldDataLength) {
      this._partWorldData = new Float32Array(partWorldDataLength);
    }
    const partWorldData = this._partWorldData;
    for (let i = 0; i < this.partCount; i++) {
      this._partMatrices[i].toArray(partWorldData, i * 16);
    }
    effect.setMatrices("partWorld", partWorldData);
    const partVisibilityData = this._partVisibilityData;
    partVisibilityData.length = this.partCount;
    for (let i = 0; i < this.partCount; i++) {
      partVisibilityData[i] = this._partVisibility[i] ?? 1;
    }
    effect.setArray("partVisibility", partVisibilityData);
  }
  // ---------------------------------------------------------------------------
  // Part matrix / visibility management
  // ---------------------------------------------------------------------------
  /**
   * Gets the number of parts in the compound.
   */
  get partCount() {
    return this._partMatrices.length;
  }
  /**
   * Shared LOD splat budget for the whole compound: a cap on the total splats its budget-participating LOD
   * engines (hosted streamed parts) render together, net of static parts. `0`/undefined disables it (each stream
   * uses its own budget, or none). Setting it apportions the cap across all registered participants by demand and
   * takes effect on the next frame. See {@link IGaussianSplattingLodBudgetParticipant}.
   * @experimental
   */
  get splatBudget() {
    return this._splatBudget;
  }
  set splatBudget(value) {
    const budget = value > 0 ? Math.floor(value) : 0;
    if (budget === this._splatBudget) {
      return;
    }
    this._splatBudget = budget;
    this._updateBudgetCoordination();
  }
  /**
   * Registers a LOD engine to share this compound's {@link splatBudget}. The compound apportions the budget
   * across all registered participants each frame. No-op if already registered.
   * @param participant the LOD engine (e.g. a hosted streamed part)
   * @experimental
   */
  registerLodBudgetParticipant(participant) {
    if (this._lodBudgetParticipants.indexOf(participant) === -1) {
      this._lodBudgetParticipants.push(participant);
      this._updateBudgetCoordination();
    }
  }
  /**
   * Removes a previously registered budget participant and releases its coordinated allocation (it reverts to its
   * own budget).
   * @param participant the LOD engine to remove
   * @experimental
   */
  unregisterLodBudgetParticipant(participant) {
    const i = this._lodBudgetParticipants.indexOf(participant);
    if (i !== -1) {
      this._lodBudgetParticipants.splice(i, 1);
      participant.setBudgetAllocation(null);
      this._updateBudgetCoordination();
    }
  }
  /**
   * Total splats contributed by static (non-streaming) parts — the fixed floor subtracted from the budget before
   * the streamable remainder is apportioned. Streaming regions are excluded (their rendered count is LOD-driven).
   * @returns the static parts' splat count
   */
  _staticSplatCount() {
    let proxied = 0;
    let sum = 0;
    for (const proxy of this._partProxies) {
      if (!proxy) {
        continue;
      }
      proxied += proxy._vertexCount;
      if (!this._streamingStates.some((s) => s.proxy === proxy) && !this._tombstonedPartIndices.has(proxy.partIndex)) {
        sum += proxy._vertexCount;
      }
    }
    if (!this._partProxies[0] && !this._tombstonedPartIndices.has(0)) {
      sum += Math.max(0, this._vertexCount - proxied);
    }
    return sum;
  }
  /**
   * Installs or removes the per-frame apportionment observer so it runs only while a budget and at least one
   * participant are both present. When coordination turns off, participants are released to their own budgets.
   */
  _updateBudgetCoordination() {
    const active = this._splatBudget > 0 && this._lodBudgetParticipants.length > 0;
    if (active && !this._budgetObserver) {
      this._budgetObserver = this.getScene().onBeforeRenderObservable.add(() => this._apportionBudget());
    } else if (!active && this._budgetObserver) {
      this.getScene().onBeforeRenderObservable.remove(this._budgetObserver);
      this._budgetObserver = null;
      for (const participant of this._lodBudgetParticipants) {
        participant.setBudgetAllocation(null);
      }
    }
  }
  /**
   * Apportions {@link splatBudget} (net of {@link _staticSplatCount}) across the registered participants by demand
   * via water-filling: each gets `min(demand, fairShare)` and any leftover is redistributed to the still-unmet
   * ones. Pushes each participant its allocation.
   */
  _apportionBudget() {
    const participants = this._lodBudgetParticipants;
    if (this._splatBudget <= 0 || participants.length === 0) {
      return;
    }
    const streamable = Math.max(0, this._splatBudget - this._staticSplatCount());
    const n = participants.length;
    const demands = this._budgetDemands;
    const alloc = this._budgetAlloc;
    const settled = this._budgetSettled;
    demands.length = n;
    alloc.length = n;
    settled.length = n;
    for (let i = 0; i < n; i++) {
      demands[i] = Math.max(0, participants[i].getBudgetDemand());
      alloc[i] = 0;
      settled[i] = false;
    }
    let remaining = streamable;
    let activeCount = participants.length;
    for (let pass = 0; pass < participants.length && activeCount > 0 && remaining > 0; pass++) {
      const share = remaining / activeCount;
      let progressed = false;
      for (let i = 0; i < participants.length; i++) {
        if (!settled[i] && demands[i] <= share) {
          alloc[i] = demands[i];
          remaining -= demands[i];
          settled[i] = true;
          activeCount--;
          progressed = true;
        }
      }
      if (!progressed) {
        for (let i = 0; i < participants.length; i++) {
          if (!settled[i]) {
            alloc[i] = share;
          }
        }
        break;
      }
    }
    for (let i = 0; i < participants.length; i++) {
      participants[i].setBudgetAllocation(Math.floor(alloc[i]));
    }
  }
  /**
   * Gets the part visibility array.
   */
  get partVisibility() {
    return this._partVisibility;
  }
  /**
   * Sets the world matrix for a specific part of the compound.
   * This will trigger a re-sort of the mesh.
   * The `_partMatrices` array is automatically extended when `partIndex >= partCount`.
   * @param partIndex index of the part
   * @param worldMatrix the world matrix to set
   */
  setWorldMatrixForPart(partIndex, worldMatrix) {
    if (this._partMatrices.length <= partIndex) {
      this.computeWorldMatrix(true);
      const defaultMatrix = this.getWorldMatrix();
      while (this._partMatrices.length <= partIndex) {
        this._partMatrices.push(defaultMatrix.clone());
        this._partVisibility.push(1);
      }
    }
    if (this._partMatrices[partIndex].equals(worldMatrix)) {
      return;
    }
    this._partMatrices[partIndex].copyFrom(worldMatrix);
    if (!this._rebuilding) {
      if (this._worker) {
        this._worker.postMessage({
          command: GaussianSplattingSortWorkerCommand.PART_MATRICES,
          partMatrices: this._partMatrices.map((matrix) => new Float32Array(matrix.m))
        });
      }
      this._postToWorker(true);
    }
  }
  /**
   * Gets the world matrix for a specific part of the compound.
   * @param partIndex index of the part, that must be between 0 and partCount - 1
   * @returns the world matrix for the part, or the current world matrix of the mesh if the part is not found
   */
  getWorldMatrixForPart(partIndex) {
    return this._partMatrices[partIndex] ?? this.getWorldMatrix();
  }
  /**
   * Gets the visibility for a specific part of the compound.
   * @param partIndex index of the part, that must be between 0 and partCount - 1
   * @returns the visibility value (0.0 to 1.0) for the part
   */
  getPartVisibility(partIndex) {
    return this._partVisibility[partIndex] ?? 1;
  }
  /**
   * Sets the visibility for a specific part of the compound.
   * @param partIndex index of the part, that must be between 0 and partCount - 1
   * @param value the visibility value (0.0 to 1.0) to set
   */
  setPartVisibility(partIndex, value) {
    this._partVisibility[partIndex] = Math.max(0, Math.min(1, value));
  }
  /**
   * Restricts which source splats of a single part are sorted and rendered, in GLOBAL source-splat
   * coordinates (offsets into the merged atlas). Static parts render fully by default; a streaming
   * part uses this to render only its currently-active LOD splats. The compound recomputes the union
   * of every part's active ranges and drives the single shared depth sort / draw with it, so all
   * parts still sort together in one pass.
   *
   * Passing `null` clears the override for that part (it reverts to rendering its full range). When no
   * part has an override, the compound clears the range filter entirely (renders every splat), which
   * preserves the non-streaming fast path.
   * @param partIndex index of the part to constrain
   * @param ranges active global source-splat ranges for the part, or `null` to render the whole part
   */
  setPartSplatRanges(partIndex, ranges) {
    if (partIndex < 0) {
      return;
    }
    this._partSplatRanges[partIndex] = ranges ? ranges.map((r) => ({ offset: r.offset, count: r.count })) : null;
    this._refreshPartRangeUnion();
  }
  /**
   * Sets the active splat ranges and invalidates decoded point-splatting data when they change.
   * @param ranges global source-splat ranges to render, or null to render all splats
   */
  setSplatIndexRanges(ranges) {
    const previous = this._activeSplatRanges;
    super.setSplatIndexRanges(ranges);
    if (previous !== this._activeSplatRanges) {
      this._pointController?.invalidateDecodedSplats();
    }
  }
  /**
   * Recomputes the global active-range union across all parts and pushes it to the shared sort/draw
   * via the base {@link setSplatIndexRanges}. When no part carries an override the filter is cleared
   * (render everything). A part without an override contributes its full `[offset, count)` derived
   * from its proxy; a part with an override contributes exactly those ranges.
   */
  _refreshPartRangeUnion() {
    let hasOverride = false;
    for (let i = 0; i < this._partSplatRanges.length; i++) {
      if (this._partSplatRanges[i]) {
        hasOverride = true;
        break;
      }
    }
    if (!hasOverride) {
      this.setSplatIndexRanges(null);
      return;
    }
    const collected = [];
    const partCount = this.partCount;
    for (let partIndex = 0; partIndex < partCount; partIndex++) {
      const override = this._partSplatRanges[partIndex];
      if (override) {
        for (const range of override) {
          if (range.count > 0) {
            collected.push({ offset: range.offset, count: range.count });
          }
        }
        continue;
      }
      const proxy = this._partProxies[partIndex];
      if (proxy && proxy._vertexCount > 0) {
        collected.push({ offset: proxy._splatsDataOffset, count: proxy._vertexCount });
      }
    }
    this.setSplatIndexRanges(GaussianSplattingMesh._CoalesceSplatRanges(collected));
  }
  /**
   * Sorts and merges adjacent/overlapping source-splat ranges so the interval list handed to the sort
   * worker stays compact (parts occupy disjoint regions, so this mainly coalesces contiguous parts).
   * @param ranges raw ranges
   * @returns coalesced ranges sorted by offset
   */
  static _CoalesceSplatRanges(ranges) {
    if (ranges.length <= 1) {
      return ranges;
    }
    const sorted = ranges.slice().sort((a, b) => a.offset - b.offset);
    const merged = [{ offset: sorted[0].offset, count: sorted[0].count }];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const range = sorted[i];
      const lastEnd = last.offset + last.count;
      if (range.offset <= lastEnd) {
        const end = Math.max(lastEnd, range.offset + range.count);
        last.count = end - last.offset;
      } else {
        merged.push({ offset: range.offset, count: range.count });
      }
    }
    return merged;
  }
  _copyTextures(source) {
    super._copyTextures(source);
    this._partIndicesTexture = source._partIndicesTexture?.clone();
  }
  _onUpdateTextures(textureSize) {
    const createTextureFromDataU8 = (data, width, height, format) => {
      return new RawTexture(data, width, height, format, this._scene, false, false, 1, 0);
    };
    if (this._partIndices) {
      const buffer = new Uint8Array(this._partIndices);
      if (!this._partIndicesTexture) {
        this._partIndicesTexture = createTextureFromDataU8(buffer, textureSize.x, textureSize.y, 6);
        this._partIndicesTexture.wrapU = 0;
        this._partIndicesTexture.wrapV = 0;
      } else {
        const existingSize = this._partIndicesTexture.getSize();
        if (existingSize.width !== textureSize.x || existingSize.height !== textureSize.y) {
          this._partIndicesTexture.dispose();
          this._partIndicesTexture = createTextureFromDataU8(buffer, textureSize.x, textureSize.y, 6);
          this._partIndicesTexture.wrapU = 0;
          this._partIndicesTexture.wrapV = 0;
        } else {
          this._updateTextureFromData(this._partIndicesTexture, buffer, textureSize.x, 0, textureSize.y);
        }
      }
    }
  }
  _updateSubTextures(splatPositions, covA, covB, colorArray, lineStart, lineCount, sh, partIndices) {
    super._updateSubTextures(splatPositions, covA, covB, colorArray, lineStart, lineCount, sh);
    if (partIndices && this._partIndicesTexture) {
      const textureSize = this._getTextureSize(this._vertexCount);
      const texelStart = lineStart * textureSize.x;
      const texelCount = lineCount * textureSize.x;
      const partIndicesView = new Uint8Array(partIndices.buffer, texelStart, texelCount);
      this._updateTextureFromData(this._partIndicesTexture, partIndicesView, textureSize.x, lineStart, lineCount);
      if (this._worker) {
        this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.PART_INDICES, partIndices });
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------
  /**
   * Creates the part indices GPU texture the first time an incremental addPart introduces
   * compound data. Has no effect if the texture already exists or no partIndices are provided.
   * @param textureSize - Current texture dimensions
   * @param partIndices - Part index data; if undefined the method is a no-op
   */
  _ensurePartIndicesTexture(textureSize, partIndices) {
    if (!partIndices || this._partIndicesTexture) {
      return;
    }
    const buffer = new Uint8Array(this._partIndices);
    this._partIndicesTexture = new RawTexture(buffer, textureSize.x, textureSize.y, 6, this._scene, false, false, 1, 0);
    this._partIndicesTexture.wrapU = 0;
    this._partIndicesTexture.wrapV = 0;
    if (this._worker) {
      this._worker.postMessage({ command: GaussianSplattingSortWorkerCommand.PART_INDICES, partIndices: partIndices ?? null });
    }
  }
  _appendPartSourceToArrays(source, dstOffset, covA, covB, colorArray, sh, minimum, maximum) {
    this._appendSourceToArrays(source, dstOffset, covA, covB, colorArray, sh, minimum, maximum);
  }
  _createRetainedPartSource(proxy) {
    if (!this._splatsData || this._shDegree > 0 && !this._shData) {
      return null;
    }
    const splatByteOffset = proxy._splatsDataOffset * _GaussianSplattingBytesPerSplat;
    const splatByteLength = proxy._vertexCount * _GaussianSplattingBytesPerSplat;
    const shByteOffset = proxy._shDataOffset * _GaussianSplattingBytesPerShTexel;
    const shByteLength = proxy._vertexCount * _GaussianSplattingBytesPerShTexel;
    const splatBytes = GaussianSplattingMeshBase._GetSplatDataBytes(this._splatsData);
    return {
      name: proxy.name,
      _vertexCount: proxy._vertexCount,
      _splatsData: splatBytes.subarray(splatByteOffset, splatByteOffset + splatByteLength),
      _shData: this._shData?.map((texture) => texture.subarray(shByteOffset, shByteOffset + shByteLength)) ?? null,
      _shDegree: this._shData ? this._shDegree : 0,
      isCompound: false,
      getWorldMatrix: () => proxy.getWorldMatrix(),
      getBoundingInfo: () => proxy.getBoundingInfo(),
      dispose: () => {
      }
    };
  }
  _retainMergedPartData(existingVertexCount, totalCount, others, shDegree) {
    if (!this._keepInRam && !this._alwaysRetainSplatsData) {
      this._splatsData = null;
      this._shData = null;
      return;
    }
    const mergedSplatsData = new Uint8Array(totalCount * _GaussianSplattingBytesPerSplat);
    let splatByteOffset = 0;
    if (this._splatsData && existingVertexCount > 0) {
      mergedSplatsData.set(GaussianSplattingMeshBase._GetSplatDataBytes(this._splatsData).subarray(0, existingVertexCount * _GaussianSplattingBytesPerSplat), splatByteOffset);
      splatByteOffset += existingVertexCount * _GaussianSplattingBytesPerSplat;
    }
    for (const other of others) {
      const splatByteLength = other._vertexCount * _GaussianSplattingBytesPerSplat;
      if (other._splatsData) {
        mergedSplatsData.set(GaussianSplattingMeshBase._GetSplatDataBytes(other._splatsData).subarray(0, splatByteLength), splatByteOffset);
      }
      splatByteOffset += splatByteLength;
    }
    this._splatsData = mergedSplatsData.buffer;
    if (shDegree <= 0) {
      this._shData = null;
      return;
    }
    const shTextureCount = Math.ceil(((shDegree + 1) * (shDegree + 1) - 1) * 3 / _GaussianSplattingBytesPerShTexel);
    const mergedShData = AllocateShBuffers(shTextureCount, totalCount * _GaussianSplattingBytesPerShTexel);
    let shByteOffset = 0;
    if (this._shData && existingVertexCount > 0) {
      const existingShByteLength = existingVertexCount * _GaussianSplattingBytesPerShTexel;
      for (let textureIndex = 0; textureIndex < mergedShData.length; textureIndex++) {
        if (textureIndex < this._shData.length) {
          mergedShData[textureIndex].set(this._shData[textureIndex].subarray(0, existingShByteLength), shByteOffset);
        }
      }
      shByteOffset += existingShByteLength;
    }
    for (const other of others) {
      const otherShByteLength = other._vertexCount * _GaussianSplattingBytesPerShTexel;
      if (other._shData) {
        for (let textureIndex = 0; textureIndex < mergedShData.length; textureIndex++) {
          if (textureIndex < other._shData.length) {
            mergedShData[textureIndex].set(other._shData[textureIndex].subarray(0, otherShByteLength), shByteOffset);
          }
        }
      }
      shByteOffset += otherShByteLength;
    }
    this._shData = mergedShData;
  }
  /**
   * Core implementation for adding one or more source parts as new
   * parts. Writes directly into texture-sized CPU arrays, updates the retained merged source
   * buffers, and uploads in one pass.
   *
   * @param others - Source meshes to append (must each be non-compound and fully loaded)
   * @param disposeOthers - Dispose source meshes after appending
   * @returns Proxy meshes and their assigned part indices
   */
  _addPartsInternal(others, disposeOthers) {
    if (others.length === 0) {
      return { proxyMeshes: [], assignedPartIndices: [] };
    }
    for (const other of others) {
      if (!other._splatsData && !other._isReservedEmpty) {
        throw new Error(`To call addPart()/addParts(), each source mesh must be fully loaded`);
      }
      if (other.isCompound) {
        throw new Error(`To call addPart()/addParts(), each source mesh must not be a compound`);
      }
    }
    const splatCountA = this._vertexCount;
    const totalOtherCount = others.reduce((s, o) => s + o._vertexCount, 0);
    const totalCount = splatCountA + totalOtherCount;
    const textureSize = this._getTextureSize(totalCount);
    const textureLength = textureSize.x * textureSize.y;
    const covBSItemSize = this._useRGBACovariants ? 4 : 2;
    const covA = new Uint16Array(textureLength * 4);
    const covB = new Uint16Array(covBSItemSize * textureLength);
    const colorArray = new Uint8Array(textureLength * 4);
    const streamingShDegree = this._streamingShDegree;
    const staticHasSH = this._shDegree > 0 || others.some((o) => o._shData !== null);
    const hasSH = staticHasSH || streamingShDegree > 0;
    const shDegreeNew = hasSH ? Math.max(this._shDegree, streamingShDegree, ...others.map((o) => o._shDegree)) : 0;
    let sh = void 0;
    if (hasSH && shDegreeNew > 0) {
      const shTextureCount = Math.ceil(((shDegreeNew + 1) * (shDegreeNew + 1) - 1) * 3 / _GaussianSplattingBytesPerShTexel);
      sh = AllocateShBuffers(shTextureCount, textureLength * _GaussianSplattingBytesPerShTexel);
    }
    const incremental = this._canReuseCachedData(splatCountA, totalCount, sh?.length ?? 0);
    const firstNewLine = incremental ? Math.floor(splatCountA / textureSize.x) : 0;
    const minimum = incremental ? this._cachedBoundingMin.clone() : new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const maximum = incremental ? this._cachedBoundingMax.clone() : new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    const oldPositions = this._splatPositions;
    this._splatPositions = new Float32Array(4 * textureLength);
    if (incremental && oldPositions) {
      this._splatPositions.set(oldPositions.subarray(0, splatCountA * 4));
    }
    let nextPartIndex = this.partCount;
    let partIndicesA = this._partIndices;
    if (!partIndicesA) {
      partIndicesA = new Uint8Array(splatCountA);
      nextPartIndex = splatCountA > 0 ? 1 : 0;
    }
    this._partIndices = new Uint8Array(textureLength);
    this._partIndices.set(partIndicesA.subarray(0, splatCountA));
    const assignedPartIndices = [];
    const assignedSplatsDataOffsets = [];
    let dstOffset = splatCountA;
    const maxPartCount = GetGaussianSplattingMaxPartCount(this._scene.getEngine());
    for (const other of others) {
      if (nextPartIndex >= maxPartCount) {
        throw new Error(`Cannot add part, as the maximum part count (${maxPartCount}) has been reached`);
      }
      const newPartIndex = nextPartIndex++;
      assignedPartIndices.push(newPartIndex);
      assignedSplatsDataOffsets.push(dstOffset);
      this._partIndices.fill(newPartIndex, dstOffset, dstOffset + other._vertexCount);
      dstOffset += other._vertexCount;
    }
    if (!incremental) {
      if (splatCountA > 0) {
        if (this._partProxies.length > 0) {
          let rebuildOffset = 0;
          if (!this._partProxies[0] && this._splatsData) {
            const proxyVertexCount = this._partProxies.reduce((sum, proxy) => sum + (proxy ? proxy._vertexCount : 0), 0);
            const part0Count = splatCountA - proxyVertexCount;
            if (part0Count > 0) {
              const uBufA = GaussianSplattingMeshBase._GetSplatDataBytes(this._splatsData);
              const fBufA = GaussianSplattingMeshBase._GetSplatDataFloats(this._splatsData);
              for (let i = 0; i < part0Count; i++) {
                this._makeSplat(i, fBufA, uBufA, covA, covB, colorArray, minimum, maximum, false);
              }
              if (sh && this._shData) {
                for (let texIdx = 0; texIdx < sh.length; texIdx++) {
                  if (texIdx < this._shData.length) {
                    sh[texIdx].set(this._shData[texIdx].subarray(0, part0Count * _GaussianSplattingBytesPerShTexel), 0);
                  }
                }
              }
              rebuildOffset += part0Count;
            }
          }
          for (let partIndex = 0; partIndex < this._partProxies.length; partIndex++) {
            const proxy = this._partProxies[partIndex];
            if (!proxy) {
              continue;
            }
            if (this._streamingStates.some((s) => s.proxy === proxy)) {
              rebuildOffset += proxy._vertexCount;
              continue;
            }
            const source = this._createRetainedPartSource(proxy);
            if (!source) {
              throw new Error(`Cannot rebuild compound part "${proxy.name}": the retained compound source data is not available.`);
            }
            this._appendPartSourceToArrays(source, rebuildOffset, covA, covB, colorArray, sh, minimum, maximum);
            rebuildOffset += source._vertexCount;
          }
        } else {
          if (this._splatsData) {
            const uBufA = GaussianSplattingMeshBase._GetSplatDataBytes(this._splatsData);
            const fBufA = GaussianSplattingMeshBase._GetSplatDataFloats(this._splatsData);
            for (let i = 0; i < splatCountA; i++) {
              this._makeSplat(i, fBufA, uBufA, covA, covB, colorArray, minimum, maximum, false);
            }
            if (sh && this._shData) {
              for (let texIdx = 0; texIdx < sh.length; texIdx++) {
                if (texIdx < this._shData.length) {
                  sh[texIdx].set(this._shData[texIdx].subarray(0, splatCountA * _GaussianSplattingBytesPerShTexel), 0);
                }
              }
            }
          }
        }
      }
    }
    if (incremental) {
      const firstNewTexel = firstNewLine * textureSize.x;
      if (firstNewTexel < splatCountA) {
        if (this._partProxies.length === 0) {
          if (this._splatsData) {
            const uBufA = GaussianSplattingMeshBase._GetSplatDataBytes(this._splatsData);
            const fBufA = GaussianSplattingMeshBase._GetSplatDataFloats(this._splatsData);
            for (let i = firstNewTexel; i < splatCountA; i++) {
              this._makeSplat(i, fBufA, uBufA, covA, covB, colorArray, minimum, maximum, false, i);
            }
          }
        } else {
          const proxyTotal = this._partProxies.reduce((s, p) => s + (p ? p._vertexCount : 0), 0);
          const part0Count = splatCountA - proxyTotal;
          const srcUBufs = new Array(this._partProxies.length).fill(null);
          const srcFBufs = new Array(this._partProxies.length).fill(null);
          const partStarts = new Array(this._partProxies.length).fill(0);
          if (!this._partProxies[0] && this._splatsData && part0Count > 0) {
            srcUBufs[0] = GaussianSplattingMeshBase._GetSplatDataBytes(this._splatsData);
            srcFBufs[0] = GaussianSplattingMeshBase._GetSplatDataFloats(this._splatsData);
            partStarts[0] = 0;
          }
          let cumOffset = part0Count;
          for (let pi = 0; pi < this._partProxies.length; pi++) {
            const proxy = this._partProxies[pi];
            if (!proxy) {
              continue;
            }
            if (this._streamingStates.some((s) => s.proxy === proxy)) {
              partStarts[pi] = cumOffset;
              cumOffset += proxy._vertexCount;
              continue;
            }
            const source = this._createRetainedPartSource(proxy);
            if (!source || !source._splatsData) {
              throw new Error(`Cannot rebuild compound part "${proxy.name}": the retained compound source data is not available.`);
            }
            srcUBufs[pi] = GaussianSplattingMeshBase._GetSplatDataBytes(source._splatsData);
            srcFBufs[pi] = GaussianSplattingMeshBase._GetSplatDataFloats(source._splatsData);
            partStarts[pi] = cumOffset;
            cumOffset += source._vertexCount;
          }
          for (let splatIdx = firstNewTexel; splatIdx < splatCountA; splatIdx++) {
            const partIdx = this._partIndices ? this._partIndices[splatIdx] : 0;
            const uBuf = partIdx < srcUBufs.length ? srcUBufs[partIdx] : null;
            const fBuf = partIdx < srcFBufs.length ? srcFBufs[partIdx] : null;
            if (uBuf && fBuf) {
              this._makeSplat(splatIdx, fBuf, uBuf, covA, covB, colorArray, minimum, maximum, false, splatIdx - (partStarts[partIdx] ?? 0));
            }
          }
        }
      }
    }
    dstOffset = splatCountA;
    for (const other of others) {
      this._appendPartSourceToArrays(other, dstOffset, covA, covB, colorArray, sh, minimum, maximum);
      dstOffset += other._vertexCount;
    }
    const paddedEnd = totalCount + 15 & -16;
    for (let i = totalCount; i < paddedEnd; i++) {
      this._makeEmptySplat(i, covA, covB, colorArray);
    }
    if (totalCount !== this._vertexCount) {
      this._updateSplatIndexBuffer(totalCount);
    }
    this._retainMergedPartData(splatCountA, totalCount, others, staticHasSH ? shDegreeNew : 0);
    this._vertexCount = totalCount;
    this._shDegree = shDegreeNew;
    this._maxShDegree = shDegreeNew;
    const needsWorkerGate = !this._rebuilding;
    if (needsWorkerGate) {
      this._canPostToWorker = false;
      this._rebuilding = true;
    }
    try {
      if (incremental) {
        if (sh && (!this._shTextures || sh.length > this._shTextures.length)) {
          if (!this._shTextures) {
            this._shTextures = [];
          }
          while (this._shTextures.length < sh.length) {
            const idx = this._shTextures.length;
            const shTexture = new RawTexture(null, textureSize.x, textureSize.y, 11, this._scene, false, false, 1, 7);
            shTexture.wrapU = 0;
            shTexture.wrapV = 0;
            this._shTextures.push(shTexture);
            const src = this._shData && idx < this._shData.length ? this._shData[idx] : sh[idx];
            this._updateShTextureData(shTexture, src, textureSize.x, 0, textureSize.y);
          }
        }
        if (sh && this._shData) {
          const firstNewTexel = firstNewLine * textureSize.x;
          if (firstNewTexel < splatCountA) {
            const byteStart = firstNewTexel * _GaussianSplattingBytesPerShTexel;
            const byteEnd = splatCountA * _GaussianSplattingBytesPerShTexel;
            for (let texIdx = 0; texIdx < sh.length; texIdx++) {
              if (texIdx < this._shData.length) {
                sh[texIdx].set(this._shData[texIdx].subarray(byteStart, byteEnd), byteStart);
              }
            }
          }
        }
        this._onUpdateTextures(textureSize);
        this._updateSubTextures(this._splatPositions, covA, covB, colorArray, firstNewLine, textureSize.y - firstNewLine, sh);
      } else {
        this._updateTextures(covA, covB, colorArray, sh);
      }
      this.setEnabled(true);
      this._notifyWorkerNewData();
      if (!this._partProxies[0] && splatCountA > 0 && !this._part0LocalMin) {
        this._part0LocalMin = this.getBoundingInfo().minimum.clone();
        this._part0LocalMax = this.getBoundingInfo().maximum.clone();
      }
      const proxyMeshes = [];
      for (let i = 0; i < others.length; i++) {
        const other = others[i];
        const newPartIndex = assignedPartIndices[i];
        const partWorldMatrix = other.getWorldMatrix();
        this.setWorldMatrixForPart(newPartIndex, partWorldMatrix);
        const proxyMesh = new GaussianSplattingPartProxyMesh(other.name, this.getScene(), this, newPartIndex, other.getBoundingInfo(), other._vertexCount, assignedSplatsDataOffsets[i], assignedSplatsDataOffsets[i]);
        if (disposeOthers) {
          other.dispose();
        }
        const quaternion = new Quaternion();
        partWorldMatrix.decompose(proxyMesh.scaling, quaternion, proxyMesh.position);
        proxyMesh.rotationQuaternion = quaternion;
        proxyMesh.computeWorldMatrix(true);
        this._partProxies[newPartIndex] = proxyMesh;
        proxyMeshes.push(proxyMesh);
      }
      this._updateBoundingInfoFromProxies();
      if (needsWorkerGate) {
        this._rebuilding = false;
        if (this._worker) {
          this._worker.postMessage({
            command: GaussianSplattingSortWorkerCommand.PART_MATRICES,
            partMatrices: this._partMatrices.map((matrix) => new Float32Array(matrix.m))
          });
        }
        this._canPostToWorker = true;
        if (this._hasStreamingPart) {
          this._refreshPartRangeUnion();
        }
        this._postToWorker(true);
      }
      this.onPartCountChangedObservable.notifyObservers(this.partCount);
      return { proxyMeshes, assignedPartIndices };
    } catch (e) {
      if (needsWorkerGate) {
        this._rebuilding = false;
        this._canPostToWorker = true;
      }
      throw e;
    }
  }
  // ---------------------------------------------------------------------------
  // Public compound API
  // ---------------------------------------------------------------------------
  /**
   * Add another mesh to this mesh, as a new part. This makes the current mesh a compound, if not already.
   * The source mesh's splat data is read directly and copied into the compound's retained source buffers.
   * @param other - The other mesh to add. Must be fully loaded before calling this method.
   * @param disposeOther - Whether to dispose the other mesh after adding it to the current mesh.
   * @returns a placeholder mesh that can be used to manipulate the part transform
   * @deprecated Use {@link GaussianSplattingCompoundMesh.addPart} instead.
   */
  addPart(other, disposeOther = true) {
    const { proxyMeshes } = this._addPartsInternal([other], disposeOther);
    return proxyMeshes[0];
  }
  /**
   * Recomputes the shared SH-atlas state ({@link _useShMrtAtlas}, {@link _shMrtAtlasTextureCount},
   * {@link _streamingShDegree}) from the currently-live (non-tombstoned) streaming parts. Call before an atlas
   * rebuild that follows a removal so a stale SH degree/count from a removed part can't keep the SH atlas active
   * (and SH_DEGREE high) with nothing refilling the SH texels.
   */
  _refreshStreamingShState() {
    let count = 0;
    let degree = 0;
    let needsRot = false;
    for (const state of this._streamingStates) {
      if (this._tombstonedPartIndices.has(state.partIndex)) {
        continue;
      }
      if (state.shTextureCount > count) {
        count = state.shTextureCount;
      }
      if (state.shDegree > degree) {
        degree = state.shDegree;
      }
      if (state.needsRotationScale) {
        needsRot = true;
      }
    }
    this._shMrtAtlasTextureCount = count;
    this._useShMrtAtlas = count > 0;
    this._streamingShDegree = degree;
    this._useRotMrtAtlas = needsRot;
  }
  /**
   * Tombstones a part of a streaming compound: excludes it from the render union permanently and hides its
   * proxy, leaving its atlas rows idle. Used instead of the compacting {@link removePart} rebuild whenever a
   * streaming part is reserved — a streamed region has no retained CPU source and decodes at a FIXED base
   * offset, so the rebuild can neither reconstruct it nor shift any part without desynchronizing the streaming
   * engine. Every other part keeps its exact offset (no shift), so resident streams keep decoding at their base.
   * The empty `[]` override survives future add-driven rebuilds, so the region stays invisible even though its
   * texels get rebuilt; memory is only reclaimed by disposing/recreating the whole compound.
   * @param index the part index to tombstone
   */
  _tombstonePart(index) {
    this.onPartRemovedObservable.notifyObservers(index);
    const proxy = this._partProxies[index];
    if (proxy) {
      proxy.setEnabled(false);
      proxy.visibility = 0;
    }
    this._partVisibility[index] = 0;
    const removedState = this._streamingStates.find((s) => s.partIndex === index);
    if (removedState) {
      removedState.removed = true;
    }
    this._partSplatRanges[index] = [];
    this._tombstonedPartIndices.add(index);
    this._refreshPartRangeUnion();
    this._updateBoundingInfoFromProxies();
  }
  /**
   * Tears the compound down to an empty state so a subsequent {@link _addPartsInternal} recreates fresh GPU
   * textures. Shared by {@link removePart} (compacting rebuild) and {@link compactAtlas}. Does NOT dispose the
   * part proxies — callers dispose only the proxies being removed and reuse the survivors' proxy objects.
   * @internal
   */
  _resetForRebuild() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    if (this._mrtAtlas) {
      this._mrtAtlas.dispose();
      this._mrtAtlas = null;
      this._covariancesATexture = this._covariancesBTexture = this._centersTexture = this._colorsTexture = null;
    } else {
      this._covariancesATexture?.dispose();
      this._covariancesBTexture?.dispose();
      this._centersTexture?.dispose();
      this._colorsTexture?.dispose();
      this._covariancesATexture = null;
      this._covariancesBTexture = null;
      this._centersTexture = null;
      this._colorsTexture = null;
    }
    if (this._rotMrtAtlas) {
      this._rotMrtAtlas.dispose();
      this._rotMrtAtlas = null;
    } else {
      this._rotationsATexture?.dispose();
      this._rotationsBTexture?.dispose();
      this._rotationScaleTexture?.dispose();
    }
    this._rotationsATexture = null;
    this._rotationsBTexture = null;
    this._rotationScaleTexture = null;
    if (this._shMrtAtlas) {
      for (const mrt of this._shMrtAtlas) {
        mrt.dispose();
      }
      this._shMrtAtlas = null;
      this._shTextures = null;
    } else if (this._shTextures) {
      for (const t of this._shTextures) {
        t.dispose();
      }
      this._shTextures = null;
    }
    if (this._partIndicesTexture) {
      this._partIndicesTexture.dispose();
      this._partIndicesTexture = null;
    }
    this._vertexCount = 0;
    this._splatPositions = null;
    this._partIndices = null;
    this._partMatrices = [];
    this._partVisibility = [];
    this._cachedBoundingMin = null;
    this._cachedBoundingMax = null;
    this._part0LocalMin = null;
    this._part0LocalMax = null;
    this._splatsData = null;
    this._shData = null;
    this._shDegree = 0;
    this._partProxies = [];
    this._partSplatRanges = [];
  }
  /**
   * Reclaims the atlas rows of parts removed (tombstoned) while a streaming part was resident. `removePart`
   * on a streaming compound only tombstones — it excludes the part from the render union and hides its proxy,
   * but leaves its rows allocated, since compacting them would relocate the still-resident streaming regions.
   * This method performs that compaction: it rebuilds the shared atlas from the LIVE parts at new, contiguous
   * (row-aligned for streaming) offsets, physically relocating each surviving streaming region's GPU texels,
   * CPU sort positions, and decode/render base offset, and drops the tombstoned rows — shrinking the atlas.
   *
   * Call it after removing one or more models to actually free the GPU/CPU memory (e.g. on idle, or once a
   * batch of removals settles). No-op when nothing is tombstoned. Safe while streams are actively decoding:
   * each surviving region is backed up before the old atlas is disposed and restored at its new base after.
   */
  compactAtlas() {
    if (this._tombstonedPartIndices.size === 0) {
      return;
    }
    const atlasWidth = this._getTextureSize(1).x;
    const specs = [];
    let cumOffset = 0;
    for (let i = 0; i < this._partProxies.length; i++) {
      const proxy = this._partProxies[i];
      if (!proxy || this._tombstonedPartIndices.has(i)) {
        continue;
      }
      const state = this._streamingStates.find((s) => s.proxy === proxy) ?? null;
      const worldMatrix = proxy.getWorldMatrix().clone();
      const visibility = this._partVisibility[i] ?? 1;
      if (state) {
        const alignedBase = Math.ceil(cumOffset / atlasWidth) * atlasWidth;
        const frontPad = alignedBase - cumOffset;
        const regionSplats = frontPad + state.capacity;
        const source = {
          name: proxy.name,
          _vertexCount: regionSplats,
          _splatsData: null,
          _shData: null,
          _shDegree: 0,
          isCompound: false,
          getWorldMatrix: () => worldMatrix,
          getBoundingInfo: () => new BoundingInfo(Vector3.ZeroReadOnly, Vector3.ZeroReadOnly),
          dispose: () => {
          },
          _isReservedEmpty: true
        };
        specs.push({ oldProxy: proxy, source, worldMatrix, visibility, state, newBase: alignedBase, frontPad });
        cumOffset += regionSplats;
      } else {
        const source = this._createRetainedPartSource(proxy);
        if (!source || !source._splatsData) {
          throw new Error(`compactAtlas: the retained source data for static part "${proxy.name}" is not available.`);
        }
        specs.push({ oldProxy: proxy, source, worldMatrix, visibility, state: null, newBase: 0, frontPad: 0 });
        cumOffset += source._vertexCount;
      }
    }
    if (this._mrtAtlas) {
      this._onBeforeAtlasRebuildObservable.notifyObservers(this._mrtAtlas);
    }
    for (const i of this._tombstonedPartIndices) {
      this._partProxies[i]?.dispose();
    }
    this._resetForRebuild();
    if (specs.length === 0) {
      this._streamingStates.length = 0;
      this._hasStreamingPart = false;
      this._tombstonedPartIndices.clear();
      this._refreshStreamingShState();
      this._useMrtAtlas = false;
      this._useRGBACovariants = !this.getEngine().isWebGPU && this.getEngine().version === 1;
      this.setEnabled(false);
      this.onPartCountChangedObservable.notifyObservers(0);
      return;
    }
    this._refreshStreamingShState();
    this._rebuilding = true;
    this._canPostToWorker = false;
    try {
      const { proxyMeshes: newProxies } = this._addPartsInternal(specs.map((s) => s.source), false);
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const newProxy = newProxies[i];
        const newPartIndex = newProxy.partIndex;
        this.setWorldMatrixForPart(newPartIndex, spec.worldMatrix);
        this.setPartVisibility(newPartIndex, spec.visibility);
        const quaternion = new Quaternion();
        spec.worldMatrix.decompose(newProxy.scaling, quaternion, newProxy.position);
        newProxy.rotationQuaternion = quaternion;
        newProxy.computeWorldMatrix(true);
        spec.oldProxy.updatePartIndex(newPartIndex);
        spec.oldProxy.updatePartMetadata(newProxy._vertexCount, newProxy._splatsDataOffset, newProxy._shDataOffset);
        this._partProxies[newPartIndex] = spec.oldProxy;
        newProxy.dispose();
        if (spec.state) {
          spec.state.partIndex = newPartIndex;
          spec.state.base = newProxy._splatsDataOffset + spec.frontPad;
          this._partSplatRanges[newPartIndex] = spec.state.localRanges ? spec.state.localRanges.map((r) => ({ offset: spec.state.base + r.offset, count: r.count })) : null;
        } else {
          this._partSplatRanges[newPartIndex] = null;
        }
      }
      if (this._mrtAtlas) {
        this._onAfterAtlasRebuildObservable.notifyObservers(this._mrtAtlas);
      }
      this._streamingStates = specs.filter((s) => s.state).map((s) => s.state);
      this._hasStreamingPart = this._streamingStates.length > 0;
      this._tombstonedPartIndices.clear();
      this._updateBoundingInfoFromProxies();
      this._rebuilding = false;
      this._canPostToWorker = true;
      this._refreshPartRangeUnion();
      this._notifyWorkerNewData();
      const workerAfterRebuild = this._worker;
      workerAfterRebuild?.postMessage({
        command: GaussianSplattingSortWorkerCommand.PART_MATRICES,
        partMatrices: this._partMatrices.map((matrix) => new Float32Array(matrix.m))
      });
      this._postToWorker(true);
      this.onPartCountChangedObservable.notifyObservers(this.partCount);
    } catch (e) {
      this._rebuilding = false;
      this._canPostToWorker = true;
      throw e;
    }
  }
  /**
   * Remove a part from this compound mesh.
   * The remaining parts are rebuilt directly from the compound mesh's retained source buffers.
   * The current mesh is reset to a plain (single-part) state and then each remaining source is
   * re-added via addParts.
   * When a streaming part is reserved the part is tombstoned instead of compacted (see {@link _tombstonePart}).
   * @param index - The index of the part to remove
   * @deprecated Use {@link GaussianSplattingCompoundMesh.removePart} instead.
   */
  removePart(index) {
    if (index < 0 || index >= this.partCount) {
      throw new Error(`Part index ${index} is out of range [0, ${this.partCount})`);
    }
    if (this._hasStreamingPart) {
      this._tombstonePart(index);
      return;
    }
    const survivors = [];
    for (let proxyIndex = 0; proxyIndex < this._partProxies.length; proxyIndex++) {
      const proxy = this._partProxies[proxyIndex];
      if (!proxy || proxyIndex === index) {
        continue;
      }
      const source = this._createRetainedPartSource(proxy);
      if (!source) {
        throw new Error(`Cannot remove part: the retained compound source data is not available for part "${proxy.name}".`);
      }
      survivors.push({ proxyMesh: proxy, source, oldIndex: proxyIndex, worldMatrix: proxy.getWorldMatrix().clone(), visibility: this._partVisibility[proxyIndex] ?? 1 });
    }
    survivors.sort((a, b) => a.oldIndex - b.oldIndex);
    for (const { proxyMesh, source } of survivors) {
      if (!source._splatsData) {
        throw new Error(`Cannot remove part: the source data for part "${proxyMesh.name}" is not available.`);
      }
      if (source._shDegree > 0 && !source._shData) {
        throw new Error(`Cannot remove part: the SH data for part "${proxyMesh.name}" is not available.`);
      }
    }
    this.onPartRemovedObservable.notifyObservers(index);
    this._partProxies[index]?.dispose();
    this._resetForRebuild();
    if (survivors.length === 0) {
      this.setEnabled(false);
      this.onPartCountChangedObservable.notifyObservers(0);
      return;
    }
    this._rebuilding = true;
    this._canPostToWorker = false;
    try {
      const sources = survivors.map((s) => s.source);
      const { proxyMeshes: newProxies } = this._addPartsInternal(sources, false);
      for (let i = 0; i < survivors.length; i++) {
        const oldProxy = survivors[i].proxyMesh;
        const newProxy = newProxies[i];
        const newPartIndex = newProxy.partIndex;
        this.setWorldMatrixForPart(newPartIndex, survivors[i].worldMatrix);
        this.setPartVisibility(newPartIndex, survivors[i].visibility);
        const quaternion = new Quaternion();
        survivors[i].worldMatrix.decompose(newProxy.scaling, quaternion, newProxy.position);
        newProxy.rotationQuaternion = quaternion;
        newProxy.computeWorldMatrix(true);
        oldProxy.updatePartIndex(newPartIndex);
        oldProxy.updatePartMetadata(newProxy._vertexCount, newProxy._splatsDataOffset, newProxy._shDataOffset);
        this._partProxies[newPartIndex] = oldProxy;
        newProxy.dispose();
      }
      this._rebuilding = false;
      const workerAfterRebuild = this._worker;
      workerAfterRebuild?.postMessage({
        command: GaussianSplattingSortWorkerCommand.PART_MATRICES,
        partMatrices: this._partMatrices.map((matrix) => new Float32Array(matrix.m))
      });
      this._canPostToWorker = true;
      this._postToWorker(true);
    } catch (e) {
      this._rebuilding = false;
      this._canPostToWorker = true;
      throw e;
    }
  }
  /**
   * Reserves a contiguous region of `capacity` splats in the compound as a new part for dynamic (streamed)
   * content. Unlike {@link addPart}, no source data is copied: the region is created as invisible padding
   * (zeroed) for a streaming engine to populate over time via the returned handle. The reserved part
   * participates in the compound's single shared depth sort and draw exactly like a static part — it has a
   * `partIndex`, a per-part world matrix (via its proxy), and a per-part visibility — so streamed splats are
   * sorted and rendered together in one pass with the static parts.
   *
   * Add the streaming part LAST (after all static parts). The returned handle drives which of the region's
   * splats render (LOD) and writes their data.
   * @param capacity number of splats to reserve
   * @param worldMatrix initial world matrix for the region's proxy (e.g. carrying a source's up-axis
   *   convention); defaults to identity
   * @param name name for the region's proxy mesh
   * @param shTextureCount number of packed-u32 higher-order SH textures to allocate as a shared render-target SH
   *   atlas the streaming engine bakes into (`ceil(coeffs*3/16)` for the stream's max SH degree); 0 = no SH
   * @param shDegree SH degree of the streamed content (drives the compound's `SH_DEGREE`); ignored when
   *   `shTextureCount` is 0. The compound keeps the MAX SH degree across its parts.
   * @param needsRotationScale when true, converts the compound's rotation/scale textures to a shared render-target
   *   half-float atlas the streaming engine decodes into, so the streamed splats participate in voxel-IBL shadows.
   * @returns a handle used to populate and control the reserved region
   */
  reserveStreamingPart(capacity, worldMatrix = Matrix.Identity(), name = this.name + "_streamingPart", shTextureCount = 0, shDegree = 0, needsRotationScale = false) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new Error("reserveStreamingPart: capacity must be a positive integer");
    }
    const maxSupportedShDegree = 4;
    if (!Number.isSafeInteger(shDegree) || shDegree < 0 || shDegree > maxSupportedShDegree) {
      throw new Error(`reserveStreamingPart: shDegree must be an integer in [0, ${maxSupportedShDegree}]`);
    }
    if (!Number.isSafeInteger(shTextureCount) || shTextureCount < 0) {
      throw new Error("reserveStreamingPart: shTextureCount must be a non-negative integer");
    }
    if (shDegree > 0 !== shTextureCount > 0) {
      throw new Error("reserveStreamingPart: shDegree and shTextureCount must both be positive (SH) or both zero (no SH)");
    }
    if (shDegree > 0) {
      const expectedShTextureCount = Math.ceil(((shDegree + 1) * (shDegree + 1) - 1) * 3 / _GaussianSplattingBytesPerShTexel);
      if (shTextureCount !== expectedShTextureCount) {
        throw new Error(`reserveStreamingPart: shTextureCount ${shTextureCount} does not match shDegree ${shDegree} (expected ${expectedShTextureCount})`);
      }
    }
    const maxTextureSize = this._scene.getEngine().getCaps().maxTextureSize;
    const maxCapacity = maxTextureSize * maxTextureSize;
    const atlasWidth = this._getTextureSize(1).x;
    const startOffset = this._vertexCount;
    const alignedBase = Math.ceil(startOffset / atlasWidth) * atlasWidth;
    const frontPad = alignedBase - startOffset;
    const alignedCapacity = Math.ceil(capacity / atlasWidth) * atlasWidth;
    const regionSplats = frontPad + alignedCapacity;
    const projectedSplats = startOffset + regionSplats;
    if (projectedSplats + 1 > maxCapacity) {
      throw new Error(`reserveStreamingPart: capacity ${capacity} would grow the atlas to ${projectedSplats} splats (plus a sentinel), exceeding the maximum atlas capacity ${maxCapacity}`);
    }
    this._useMrtAtlas = true;
    this._useRGBACovariants = true;
    if (shTextureCount > 0 && shDegree > 0) {
      this._useShMrtAtlas = true;
      this._shMrtAtlasTextureCount = Math.max(this._shMrtAtlasTextureCount, shTextureCount);
      this._streamingShDegree = Math.max(this._streamingShDegree, shDegree);
    }
    if (needsRotationScale) {
      this._useRotMrtAtlas = true;
      this._needsRotationScaleTextures = true;
    }
    const boundsMin = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const boundsMax = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    const reservedSource = {
      name,
      _vertexCount: regionSplats,
      _splatsData: null,
      _shData: null,
      _shDegree: 0,
      isCompound: false,
      getWorldMatrix: () => worldMatrix,
      getBoundingInfo: () => new BoundingInfo(Vector3.ZeroReadOnly, Vector3.ZeroReadOnly),
      dispose: () => {
      },
      _isReservedEmpty: true
    };
    const { proxyMeshes, assignedPartIndices } = this._addPartsInternal([reservedSource], false);
    const proxy = proxyMeshes[0];
    const state = {
      proxy,
      base: alignedBase,
      partIndex: assignedPartIndices[0],
      capacity: alignedCapacity,
      boundsMin,
      boundsMax,
      localRanges: null,
      shTextureCount: shTextureCount > 0 && shDegree > 0 ? shTextureCount : 0,
      shDegree: shTextureCount > 0 && shDegree > 0 ? shDegree : 0,
      needsRotationScale,
      removed: false
    };
    this._streamingStates.push(state);
    capacity = alignedCapacity;
    const compound = this;
    const applyBounds = () => {
      if (boundsMin.x <= boundsMax.x) {
        proxy.setBoundingInfo(new BoundingInfo(boundsMin.clone(), boundsMax.clone()));
        compound._updateBoundingInfoFromProxies();
      }
    };
    const assertLive = (method) => {
      if (state.removed) {
        throw new Error(`${method}: this streaming part has been removed`);
      }
    };
    const assertLocalRange = (method, offset, count) => {
      if (!Number.isInteger(offset) || !Number.isInteger(count) || offset < 0 || count < 0 || offset + count > state.capacity) {
        throw new Error(`${method}: local range [${offset}, ${offset + count}) is outside the reserved region [0, ${state.capacity})`);
      }
    };
    const handle = {
      proxy,
      capacity,
      get partIndex() {
        return state.partIndex;
      },
      get base() {
        return state.base;
      },
      get centersTexture() {
        return compound.centersTexture;
      },
      get covariancesATexture() {
        return compound.covariancesATexture;
      },
      get covariancesBTexture() {
        return compound.covariancesBTexture;
      },
      get colorsTexture() {
        return compound.colorsTexture;
      },
      get splatPositions() {
        return compound._splatPositions;
      },
      get mrtAtlas() {
        return compound._mrtAtlas;
      },
      get shMrtAtlas() {
        return compound._shMrtAtlas;
      },
      get rotMrtAtlas() {
        return compound._rotMrtAtlas;
      },
      get atlasWidth() {
        return compound._getTextureSize(compound._vertexCount).x;
      },
      get isDepthSortSettled() {
        return compound._isDepthSortSettled;
      },
      setActiveRanges: (localRanges) => {
        assertLive("setActiveRanges");
        if (localRanges) {
          for (const r of localRanges) {
            assertLocalRange("setActiveRanges", r.offset, r.count);
          }
        }
        state.localRanges = localRanges ? localRanges.map((r) => ({ offset: r.offset, count: r.count })) : null;
        const globalRanges = localRanges ? localRanges.map((r) => ({ offset: state.base + r.offset, count: r.count })) : null;
        compound.setPartSplatRanges(state.partIndex, globalRanges);
      },
      writeSplats: (localOffset, count, splatsData) => {
        assertLive("writeSplats");
        assertLocalRange("writeSplats", localOffset, count);
        compound._writeStreamingSplats(state.base + localOffset, count, splatsData, boundsMin, boundsMax);
        applyBounds();
      },
      postPositionsRange: (localOffset, count) => {
        assertLive("postPositionsRange");
        assertLocalRange("postPositionsRange", localOffset, count);
        compound._postWorkerPositionsRange(state.base + localOffset, count);
      },
      expandBounds: (min, max) => {
        assertLive("expandBounds");
        boundsMin.minimizeInPlace(min);
        boundsMax.maximizeInPlace(max);
        applyBounds();
      },
      notifyDataChanged: () => {
        assertLive("notifyDataChanged");
        compound._notifyWorkerNewData();
      },
      onBeforeAtlasRebuild: (callback) => {
        const observer = compound._onBeforeAtlasRebuildObservable.add(callback);
        return () => compound._onBeforeAtlasRebuildObservable.remove(observer);
      },
      onAfterAtlasRebuild: (callback) => {
        const observer = compound._onAfterAtlasRebuildObservable.add(callback);
        return () => compound._onAfterAtlasRebuildObservable.remove(observer);
      }
    };
    this._hasStreamingPart = true;
    return handle;
  }
  /**
   * Serialize current GaussianSplattingMesh
   * @param serializationObject defines the object which will receive the serialization data
   * @param encoding the encoding of binary data, defaults to base64 for json serialize,
   * kept for future internal use like cloning where base64 encoding wastes cycles and memory
   * @returns the serialized object
   */
  serialize(serializationObject = {}, encoding = "base64") {
    serializationObject = super.serialize(serializationObject);
    serializationObject.subMeshes = [];
    serializationObject.geometryUniqueId = void 0;
    serializationObject.geometryId = void 0;
    serializationObject.materialUniqueId = void 0;
    serializationObject.materialId = void 0;
    serializationObject.instances = [];
    serializationObject.actions = void 0;
    serializationObject.type = this.getClassName();
    serializationObject.keepInRam = this._keepInRam;
    serializationObject.disableDepthSort = this._disableDepthSort;
    serializationObject.viewUpdateThreshold = this.viewUpdateThreshold;
    serializationObject._flipY = this._flipY;
    serializationObject.pointSplattingScale = this._pointScale;
    serializationObject.pointSplattingRenderScale = this._pointRenderScale;
    serializationObject.pointSplattingOcclusionCulling = this._pointOcclusionCulling;
    serializationObject.pointSplattingRenderMode = this.pointSplattingRenderMode;
    serializationObject.pointSplattingDepthRenderMode = this.pointSplattingDepthRenderMode;
    if (this._splatsData) {
      serializationObject.splatsData = encoding === "base64" ? EncodeArrayBufferToBase64(this._splatsData) : this._splatsData;
    }
    if (this._shData) {
      serializationObject.shData = encoding === "base64" ? this._shData.map(EncodeArrayBufferToBase64) : this._shData;
      serializationObject.shDegree = this._shDegree;
    }
    if (this._partIndices) {
      const compressedIndices = CompressPartIndices(this._partIndices.subarray(0, this._vertexCount));
      serializationObject.partIndices = encoding === "base64" ? EncodeArrayBufferToBase64(compressedIndices) : compressedIndices;
    }
    if (this._partProxies.length) {
      serializationObject.partProxies = this._partProxies.filter((proxy) => !!proxy).map((proxy) => proxy.serialize());
    }
    return serializationObject;
  }
  /**
   * Internal helper to parses a serialized GaussianSplattingMesh or GaussianSplattingCompoundMesh
   * @param parsedMesh the serialized mesh
   * @param scene the scene to create the GaussianSplattingMesh or GaussianSplattingCompoundMesh in
   * @param ctor the constructor of the mesh to create
   * @returns the created GaussianSplattingMesh
   * @internal
   */
  static _ParseInternal(parsedMesh, scene, ctor) {
    const mesh = new ctor(parsedMesh.name, null, scene, parsedMesh.keepInRam);
    mesh.disableDepthSort = parsedMesh.disableDepthSort ?? false;
    mesh.viewUpdateThreshold = parsedMesh.viewUpdateThreshold ?? GaussianSplattingMeshBase._DefaultViewUpdateThreshold;
    let splatsData = parsedMesh.splatsData;
    if (typeof splatsData === "string") {
      splatsData = DecodeBase64ToBinary(splatsData);
    }
    const shData = parsedMesh.shData;
    let parsedShData;
    if (Array.isArray(shData) && shData.length) {
      const newData = [];
      for (let i = 0, length = shData.length; i < length; i++) {
        const data = shData[i];
        if (typeof data === "string") {
          newData[i] = new Uint8Array(DecodeBase64ToBinary(data));
        } else {
          newData[i] = data;
        }
      }
      parsedShData = newData;
    }
    let partIndices = parsedMesh.partIndices;
    let parsedPartIndices;
    if (typeof partIndices === "string") {
      partIndices = new Uint32Array(DecodeBase64ToBinary(partIndices));
    }
    if (partIndices) {
      parsedPartIndices = ParsePartIndices(partIndices);
    }
    if (splatsData) {
      const flipY = parsedMesh._flipY ?? false;
      mesh.updateData(splatsData, parsedShData, { flipY }, parsedPartIndices, parsedMesh.shDegree);
    }
    if (parsedMesh.pointSplattingScale !== void 0) {
      mesh.pointSplattingScale = parsedMesh.pointSplattingScale;
    }
    if (parsedMesh.pointSplattingRenderScale !== void 0) {
      mesh.pointSplattingRenderScale = parsedMesh.pointSplattingRenderScale;
    }
    if (parsedMesh.pointSplattingOcclusionCulling !== void 0) {
      mesh.pointSplattingOcclusionCulling = parsedMesh.pointSplattingOcclusionCulling;
    }
    if (parsedMesh.pointSplattingRenderMode) {
      mesh.pointSplattingRenderMode = true;
    }
    if (parsedMesh.pointSplattingDepthRenderMode) {
      mesh.pointSplattingDepthRenderMode = true;
    }
    if (parsedMesh.partProxies) {
      for (const serializedPart of parsedMesh.partProxies) {
        const part = Object.assign({}, serializedPart);
        part.compoundSplatMesh = mesh;
        const proxyMesh = Mesh.Parse(part, scene, "");
        const newPartIndex = proxyMesh.partIndex;
        mesh._partProxies[newPartIndex] = proxyMesh;
        mesh.setWorldMatrixForPart(newPartIndex, proxyMesh.getWorldMatrix());
        mesh.setPartVisibility(newPartIndex, proxyMesh.isEnabled() ? proxyMesh.visibility : 0);
      }
    }
    return mesh;
  }
  /**
   * Parses a serialized GaussianSplattingMesh
   * @param parsedMesh the serialized mesh
   * @param scene the scene to create the GaussianSplattingMesh in
   * @returns the created GaussianSplattingMesh
   */
  static Parse(parsedMesh, scene) {
    return GaussianSplattingMesh._ParseInternal(parsedMesh, scene, GaussianSplattingMesh);
  }
}
let _Registered = false;
function RegisterGaussianSplattingMesh() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  Mesh._GaussianSplattingMeshParser = GaussianSplattingMesh.Parse;
}
export {
  AllocateShBuffers as A,
  GaussianSplattingMesh as G,
  RegisterGaussianSplattingMaterial as R,
  Scalar as S,
  _SetGaussianPointSplattingControllerFactory as _,
  GetGaussianSplattingMaxPartCount as a,
  GetPartIndexVaryingDeclaration as b,
  GaussianSplattingMaterial as c,
  RegisterGaussianSplattingPartProxyMesh as d,
  RegisterGaussianSplattingMesh as e
};
