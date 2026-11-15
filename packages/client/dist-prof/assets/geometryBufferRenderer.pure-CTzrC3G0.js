const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/geometry.vertex-D_ZO2Zex.js","assets/babylon-PnzH6wcM.js","assets/bonesVertex-Cpn2iSQy.js","assets/instancesVertex-23t-Q1Uk.js","assets/morphTargetsVertex-73_uAtmG.js","assets/instancesDeclaration-DL63iftc.js","assets/sceneUboDeclaration-CzhdE5li.js","assets/clipPlaneVertex-CtRrEuj6.js","assets/harmonicsFunctions-DA7iWIZ6.js","assets/bumpVertex-Ca-mLV48.js","assets/geometry.fragment-C2N-cV8f.js","assets/objectIdFunctions-CSQgrKyq.js","assets/clipPlaneFragment-BbExy4ec.js","assets/bumpFragment-Gor82Mmh.js","assets/samplerFragmentDeclaration-hhL6vafq.js","assets/helperFunctions-vFx73x84.js","assets/pbrIBLFunctions-C78jlyf6.js","assets/pbrBRDFFunctions-QDzgUJ5n.js","assets/openpbrSubsurfaceLayerData-Bbln2ibc.js","assets/reflectionFunction-CyEZlAae.js","assets/geometry.vertex-DERhfA1F.js","assets/bakedVertexAnimation-D_Sv770W.js","assets/morphTargetsVertex-ChAeSZCm.js","assets/instancesDeclaration-CoQOC7Vy.js","assets/sceneUboDeclaration-CFURaA3t.js","assets/clipPlaneVertex-BdoNWmEf.js","assets/harmonicsFunctions-DcVQlDTF.js","assets/bumpVertex-BmW8Tmtd.js","assets/geometry.fragment-BvWCu8av.js","assets/objectIdFunctions-DK-N0nzE.js","assets/clipPlaneFragment-D8NTl-r6.js","assets/bumpFragment-DfWeFEh5.js","assets/samplerFragmentDeclaration-_is6dKnS.js","assets/helperFunctions-Cbwc0-4F.js","assets/pbrIBLFunctions-k-OGLkc2.js","assets/openpbrSubsurfaceLayerData-DSr_sRDN.js","assets/pbrBRDFFunctions-COKAtYB-.js","assets/reflectionFunction-BOSii2hf.js"])))=>i.map(i=>d[i]);
import { S as Scene, aI as SceneComponentConstants, C as Color4, a9 as __vitePreload, j as VertexBuffer, aO as MaterialFlags, ba as PrepareDefinesForIBL, o as PrepareDefinesAndAttributesForMorphTargets, n as PushAttributesForInstances, p as PrepareStringDefinesForClipPlanes, G as Texture, M as Matrix, r as BindSceneUniformBuffer, aM as Material, t as BindClipPlane, x as BindMorphTargetParameters, bH as _GetGeometryRenderingObjectId, bI as _GetGeometryRenderingMeshBlendTag, X as _WarnImport, b2 as PrepareUniformsAndSamplersForIBL, A as AddClipPlaneUniforms } from "./babylon-PnzH6wcM.js";
import { M as MultiRenderTarget } from "./multiRenderTarget.pure-CHje0eeK.js";
class GeometryBufferRendererSceneComponent {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_GEOMETRYBUFFERRENDERER;
    this.scene = scene;
  }
  /**
   * Registers the component in a given scene
   */
  register() {
    this.scene._gatherRenderTargetsStage.registerStep(SceneComponentConstants.STEP_GATHERRENDERTARGETS_GEOMETRYBUFFERRENDERER, this, this._gatherRenderTargets);
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
  }
  /**
   * Disposes the component and the associated resources
   */
  dispose() {
  }
  _gatherRenderTargets(renderTargets) {
    if (this.scene._geometryBufferRenderer) {
      renderTargets.push(this.scene._geometryBufferRenderer.getGBuffer());
    }
  }
}
let _Registered$1 = false;
function RegisterGeometryBufferRendererSceneComponent(geometryBufferRendererClass) {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  Object.defineProperty(Scene.prototype, "geometryBufferRenderer", {
    get: function() {
      return this._geometryBufferRenderer;
    },
    set: function(value) {
      if (value && value.isSupported) {
        this._geometryBufferRenderer = value;
      }
    },
    enumerable: true,
    configurable: true
  });
  Scene.prototype.enableGeometryBufferRenderer = function(ratio = 1, depthFormat = 15, textureTypesAndFormats) {
    if (this._geometryBufferRenderer) {
      return this._geometryBufferRenderer;
    }
    this._geometryBufferRenderer = new geometryBufferRendererClass(this, ratio, depthFormat, textureTypesAndFormats);
    if (!this._geometryBufferRenderer.isSupported) {
      this._geometryBufferRenderer = null;
    }
    return this._geometryBufferRenderer;
  };
  Scene.prototype.disableGeometryBufferRenderer = function() {
    if (!this._geometryBufferRenderer) {
      return;
    }
    this._geometryBufferRenderer.dispose();
    this._geometryBufferRenderer = null;
  };
  geometryBufferRendererClass._SceneComponentInitialization = (scene) => {
    let component = scene._getComponent(SceneComponentConstants.NAME_GEOMETRYBUFFERRENDERER);
    if (!component) {
      component = new GeometryBufferRendererSceneComponent(scene);
      scene._addComponent(component);
    }
  };
}
function IsGaussianSplattingClassName(className) {
  return className === "GaussianSplattingMesh" || className === "GaussianSplattingStream";
}
function _IsGaussianSplattingMesh(mesh) {
  return mesh._isGaussianSplatting || IsGaussianSplattingClassName(mesh.getClassName());
}
function _IsMeshBlendingSupported(engine) {
  return engine.shaderPlatformName !== "NATIVE" && (engine.isWebGPU || engine.webGLVersion === 2);
}
var MeshBlendingRadiusClass;
(function(MeshBlendingRadiusClass2) {
  MeshBlendingRadiusClass2[MeshBlendingRadiusClass2["Small"] = 0] = "Small";
  MeshBlendingRadiusClass2[MeshBlendingRadiusClass2["Medium"] = 1] = "Medium";
  MeshBlendingRadiusClass2[MeshBlendingRadiusClass2["Large"] = 2] = "Large";
  MeshBlendingRadiusClass2[MeshBlendingRadiusClass2["ExtraLarge"] = 3] = "ExtraLarge";
})(MeshBlendingRadiusClass || (MeshBlendingRadiusClass = {}));
const Samplers = [
  "diffuseSampler",
  "bumpSampler",
  "reflectivitySampler",
  "albedoSampler",
  "morphTargets",
  "boneSampler",
  "transmissionWeightSampler",
  "subsurfaceWeightSampler",
  "iblShadowSampler"
];
const Uniforms = [
  "world",
  "mBones",
  "viewProjection",
  "diffuseMatrix",
  "alphaCutOff",
  "view",
  "previousWorld",
  "previousViewProjection",
  "mPreviousBones",
  "bumpMatrix",
  "reflectivityMatrix",
  "albedoMatrix",
  "reflectivityColor",
  "albedoColor",
  "reflectionMatrix",
  "vTransmissionWeight",
  "vSubsurfaceWeight",
  "vEyePosition",
  "vTransmissionScatterAnisotropy",
  "vSubsurfaceScatterAnisotropy",
  "shadowTextureSize",
  "metallic",
  "glossiness",
  "vTangentSpaceParams",
  "vBumpInfos",
  "morphTargetInfluences",
  "morphTargetCount",
  "morphTargetTextureInfo",
  "morphTargetTextureIndices",
  "boneTextureInfo",
  "objectId",
  "meshBlendTag"
];
class GeometryBufferRenderer {
  /** Gets or sets a boolean indicating if transparent meshes should be rendered */
  get renderTransparentMeshes() {
    return this._renderTransparentMeshes;
  }
  set renderTransparentMeshes(value) {
    if (value && this._enableMeshBlendTag && !this._scene.getEngine().getCaps().blendParametersPerTarget) {
      throw new Error("GeometryBufferRenderer: transparent mesh-blending tags require per-target blend parameters");
    }
    this._renderTransparentMeshes = value;
  }
  /**
   * Gets a boolean indicating if normals are encoded in the [0,1] range in the render target. If true, you should do `normal = normal_rt * 2.0 - 1.0` to get the right normal
   */
  get normalsAreUnsigned() {
    return this._normalsAreUnsigned;
  }
  /**
   * @internal
   * Sets up internal structures to share outputs with PrePassRenderer
   * This method should only be called by the PrePassRenderer itself
   */
  _linkPrePassRenderer(prePassRenderer) {
    if (this._enableObjectId || this._enableMeshBlendTag) {
      throw new Error("GeometryBufferRenderer: object ID and mesh-blending tag textures are not supported when linked to the PrePassRenderer");
    }
    this._linkedWithPrePass = true;
    this._prePassRenderer = prePassRenderer;
    this._scene._setPreviousWorldMatricesRequired(this, false);
    if (this._multiRenderTarget) {
      this._multiRenderTarget.onClearObservable.clear();
      this._multiRenderTarget.onClearObservable.add(() => {
      });
    }
  }
  /**
   * @internal
   * Separates internal structures from PrePassRenderer so the geometry buffer can now operate by itself.
   * This method should only be called by the PrePassRenderer itself
   */
  _unlinkPrePassRenderer() {
    this._linkedWithPrePass = false;
    this._createRenderTargets();
  }
  /**
   * @internal
   * Resets the geometry buffer layout
   */
  _resetLayout() {
    this._enableDepth = true;
    this._enableNormal = true;
    this._enablePosition = false;
    this._enableReflectivity = false;
    this._enableVelocity = false;
    this._enableVelocityLinear = false;
    this._enableScreenspaceDepth = false;
    this._enableIrradiance = false;
    this._enableObjectId = false;
    this._enableMeshBlendTag = false;
    this._attachmentsFromPrePass = [];
    this._scene._setPreviousWorldMatricesRequired(this, false);
  }
  /**
   * @internal
   * Replaces a texture in the geometry buffer renderer
   * Useful when linking textures of the prepass renderer
   */
  _forceTextureType(geometryBufferType, index) {
    if (geometryBufferType === GeometryBufferRenderer.POSITION_TEXTURE_TYPE) {
      this._positionIndex = index;
      this._enablePosition = true;
    } else if (geometryBufferType === GeometryBufferRenderer.VELOCITY_TEXTURE_TYPE) {
      this._velocityIndex = index;
      this._enableVelocity = true;
    } else if (geometryBufferType === GeometryBufferRenderer.VELOCITY_LINEAR_TEXTURE_TYPE) {
      this._velocityLinearIndex = index;
      this._enableVelocityLinear = true;
    } else if (geometryBufferType === GeometryBufferRenderer.REFLECTIVITY_TEXTURE_TYPE) {
      this._reflectivityIndex = index;
      this._enableReflectivity = true;
    } else if (geometryBufferType === GeometryBufferRenderer.DEPTH_TEXTURE_TYPE) {
      this._depthIndex = index;
      this._enableDepth = true;
    } else if (geometryBufferType === GeometryBufferRenderer.NORMAL_TEXTURE_TYPE) {
      this._normalIndex = index;
      this._enableNormal = true;
    } else if (geometryBufferType === GeometryBufferRenderer.SCREENSPACE_DEPTH_TEXTURE_TYPE) {
      this._screenspaceDepthIndex = index;
      this._enableScreenspaceDepth = true;
    } else if (geometryBufferType === GeometryBufferRenderer.IRRADIANCE_TEXTURE_TYPE) {
      this._irradianceIndex = index;
      this._enableIrradiance = true;
    } else if (geometryBufferType === GeometryBufferRenderer.OBJECT_ID_TEXTURE_TYPE) {
      this._objectIdIndex = index;
      this._enableObjectId = true;
    } else if (geometryBufferType === GeometryBufferRenderer.MESH_BLEND_TAG_TEXTURE_TYPE) {
      this._meshBlendTagIndex = index;
      this._enableMeshBlendTag = true;
    }
  }
  /**
   * @internal
   * Sets texture attachments
   * Useful when linking textures of the prepass renderer
   */
  _setAttachments(attachments) {
    this._attachmentsFromPrePass = attachments;
  }
  /**
   * @internal
   * Replaces the first texture which is hard coded as a depth texture in the geometry buffer
   * Useful when linking textures of the prepass renderer
   */
  _linkInternalTexture(internalTexture) {
    this._multiRenderTarget.setInternalTexture(internalTexture, 0, false);
  }
  /**
   * Gets the render list (meshes to be rendered) used in the G buffer.
   */
  get renderList() {
    return this._multiRenderTarget.renderList;
  }
  /**
   * Set the render list (meshes to be rendered) used in the G buffer.
   */
  set renderList(meshes) {
    this._multiRenderTarget.renderList = meshes;
  }
  /**
   * Gets whether or not G buffer are supported by the running hardware.
   * This requires draw buffer supports
   */
  get isSupported() {
    return this._multiRenderTarget.isSupported;
  }
  /**
   * Returns the index of the given texture type in the G-Buffer textures array
   * @param textureType The texture type constant. For example GeometryBufferRenderer.POSITION_TEXTURE_INDEX
   * @returns the index of the given texture type in the G-Buffer textures array
   */
  getTextureIndex(textureType) {
    switch (textureType) {
      case GeometryBufferRenderer.POSITION_TEXTURE_TYPE:
        return this._positionIndex;
      case GeometryBufferRenderer.VELOCITY_TEXTURE_TYPE:
        return this._velocityIndex;
      case GeometryBufferRenderer.VELOCITY_LINEAR_TEXTURE_TYPE:
        return this._velocityLinearIndex;
      case GeometryBufferRenderer.REFLECTIVITY_TEXTURE_TYPE:
        return this._reflectivityIndex;
      case GeometryBufferRenderer.DEPTH_TEXTURE_TYPE:
        return this._depthIndex;
      case GeometryBufferRenderer.NORMAL_TEXTURE_TYPE:
        return this._normalIndex;
      case GeometryBufferRenderer.SCREENSPACE_DEPTH_TEXTURE_TYPE:
        return this._screenspaceDepthIndex;
      case GeometryBufferRenderer.IRRADIANCE_TEXTURE_TYPE:
        return this._irradianceIndex;
      case GeometryBufferRenderer.OBJECT_ID_TEXTURE_TYPE:
        return this._objectIdIndex;
      case GeometryBufferRenderer.MESH_BLEND_TAG_TEXTURE_TYPE:
        return this._meshBlendTagIndex;
      default:
        return -1;
    }
  }
  /**
   * @returns a boolean indicating if object's depths are enabled for the G buffer.
   */
  get enableDepth() {
    return this._enableDepth;
  }
  /**
   * Sets whether or not object's depths are enabled for the G buffer.
   */
  set enableDepth(enable) {
    this._enableDepth = enable;
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * @returns a boolean indicating if object's normals are enabled for the G buffer.
   */
  get enableNormal() {
    return this._enableNormal;
  }
  /**
   * Sets whether or not object's normals are enabled for the G buffer.
   */
  set enableNormal(enable) {
    this._enableNormal = enable;
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * @returns a boolean indicating if objects positions are enabled for the G buffer.
   */
  get enablePosition() {
    return this._enablePosition;
  }
  /**
   * Sets whether or not objects positions are enabled for the G buffer.
   */
  set enablePosition(enable) {
    this._enablePosition = enable;
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * @returns a boolean indicating if objects velocities are enabled for the G buffer.
   */
  get enableVelocity() {
    return this._enableVelocity;
  }
  /**
   * Sets whether or not objects velocities are enabled for the G buffer.
   */
  set enableVelocity(enable) {
    this._enableVelocity = enable;
    if (!enable) {
      this._previousTransformationMatrices = {};
    }
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * @returns a boolean indicating if object's linear velocities are enabled for the G buffer.
   */
  get enableVelocityLinear() {
    return this._enableVelocityLinear;
  }
  /**
   * Sets whether or not object's linear velocities are enabled for the G buffer.
   */
  set enableVelocityLinear(enable) {
    this._enableVelocityLinear = enable;
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * Gets a boolean indicating if objects reflectivity are enabled in the G buffer.
   */
  get enableReflectivity() {
    return this._enableReflectivity;
  }
  /**
   * Sets whether or not objects reflectivity are enabled for the G buffer.
   * For Metallic-Roughness workflow with ORM texture, we assume that ORM texture is defined according to the default layout:
   * pbr.useRoughnessFromMetallicTextureAlpha = false;
   * pbr.useRoughnessFromMetallicTextureGreen = true;
   * pbr.useMetallnessFromMetallicTextureBlue = true;
   */
  set enableReflectivity(enable) {
    this._enableReflectivity = enable;
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * Sets whether or not objects screenspace depth are enabled for the G buffer.
   */
  get enableScreenspaceDepth() {
    return this._enableScreenspaceDepth;
  }
  set enableScreenspaceDepth(enable) {
    this._enableScreenspaceDepth = enable;
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * Gets a boolean indicating if objects irradiance are enabled in the G buffer.
   */
  get enableIrradiance() {
    return this._enableIrradiance;
  }
  /**
   * Sets whether or not objects irradiance are enabled for the G buffer.
   */
  set enableIrradiance(enable) {
    this._enableIrradiance = enable;
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * Gets whether object IDs are enabled for the G buffer.
   */
  get enableObjectId() {
    return this._enableObjectId;
  }
  /**
   * Sets whether object IDs are enabled for the G buffer.
   *
   * Object ID rendering currently requires a single-sample G buffer.
   * Object ID rendering is not supported when the G buffer is linked to the PrePassRenderer.
   * @see https://playground.babylonjs.com/?version=preview#SQXZ3X#1
   */
  set enableObjectId(enable) {
    if (enable && this._linkedWithPrePass) {
      throw new Error("GeometryBufferRenderer: object ID textures are not supported when linked to the PrePassRenderer");
    }
    if (enable && this.samples !== 1) {
      throw new Error("GeometryBufferRenderer: object ID textures currently require samples to be 1");
    }
    if (enable && !this._enableObjectId && !this._linkedWithPrePass) {
      const engine = this._scene.getEngine();
      const maxDrawBuffers = Math.min(engine.getCaps().maxDrawBuffers ?? 1, 8);
      const attachmentCount = this._assignRenderTargetIndices()[0] + 1;
      if (engine.getCaps().drawBuffersExtension && attachmentCount > maxDrawBuffers) {
        throw new Error(`GeometryBufferRenderer: ${attachmentCount} color attachments were requested, but this engine supports at most ${maxDrawBuffers}`);
      }
    }
    this._enableObjectId = enable;
    if (!enable) {
      this._objectIdIndex = -1;
    }
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * Gets whether packed mesh-blending tags are enabled for the G buffer.
   */
  get enableMeshBlendingTag() {
    return this._enableMeshBlendTag;
  }
  /**
   * Sets whether packed mesh-blending tags are enabled for the G buffer.
   *
   * Mesh-blending tags use a single-sample R8UI color attachment and are supported on WebGL2 and WebGPU.
   * Transparent rendering remains controlled by renderTransparentMeshes. Applications are responsible for
   * ensuring that transparent draws do not invalidate the SceneColor and geometry-input correspondence required
   * by the mesh-blending pass. On WebGL2, transparent rendering with this output requires per-target blend parameters.
   *
   * Enabling or disabling this output rebuilds the renderer's targets. The application retains ownership
   * of the GeometryBufferRenderer and of every post process that consumes the output.
   */
  set enableMeshBlendingTag(enable) {
    if (this._enableMeshBlendTag === enable) {
      return;
    }
    if (enable) {
      const engine = this._scene.getEngine();
      if (!_IsMeshBlendingSupported(engine)) {
        throw new Error("GeometryBufferRenderer: mesh-blending tag textures require WebGL2 or WebGPU");
      }
      if (this.renderTransparentMeshes && !engine.isWebGPU && !engine.getCaps().blendParametersPerTarget) {
        throw new Error("GeometryBufferRenderer: transparent mesh-blending tags require per-target blend parameters");
      }
      if (this._linkedWithPrePass) {
        throw new Error("GeometryBufferRenderer: mesh-blending tag textures are not supported when linked to the PrePassRenderer");
      }
      if (this.samples !== 1) {
        throw new Error("GeometryBufferRenderer: mesh-blending tag textures require samples to be 1");
      }
      if (!this._enableMeshBlendTag) {
        const maxDrawBuffers = Math.min(engine.getCaps().maxDrawBuffers ?? 1, 8);
        const attachmentCount = this._assignRenderTargetIndices()[0] + 1;
        if (engine.getCaps().drawBuffersExtension && attachmentCount > maxDrawBuffers) {
          throw new Error(`GeometryBufferRenderer: ${attachmentCount} color attachments were requested, but this engine supports at most ${maxDrawBuffers}`);
        }
      }
    }
    this._enableMeshBlendTag = enable;
    if (!enable) {
      this._meshBlendTagIndex = -1;
    }
    if (!this._linkedWithPrePass) {
      this.dispose();
      this._createRenderTargets();
    }
  }
  /**
   * Gets the scene associated with the buffer.
   */
  get scene() {
    return this._scene;
  }
  /**
   * Gets the ratio used by the buffer during its creation.
   * How big is the buffer related to the main canvas.
   */
  get ratio() {
    return typeof this._ratioOrDimensions === "object" ? 1 : this._ratioOrDimensions;
  }
  /**
   * Gets the shader language used in this material.
   */
  get shaderLanguage() {
    return this._shaderLanguage;
  }
  /**
   * Creates a new G Buffer for the scene
   * @param scene The scene the buffer belongs to
   * @param ratioOrDimensions How big is the buffer related to the main canvas (default: 1). You can also directly pass a width and height for the generated textures
   * @param depthFormat Format of the depth texture (default: 15)
   * @param textureTypesAndFormats The types, formats and optional sampling modes of textures to create as render targets.
   * If not provided, all textures will be RGBA and float or half float, depending on the engine capabilities.
   */
  constructor(scene, ratioOrDimensions = 1, depthFormat = 15, textureTypesAndFormats) {
    this._previousTransformationMatrices = {};
    this._previousBonesTransformationMatrices = {};
    this.excludedSkinnedMeshesFromVelocity = [];
    this._renderTransparentMeshes = true;
    this.generateNormalsInWorldSpace = false;
    this._normalsAreUnsigned = false;
    this._resizeObserver = null;
    this._enableDepth = true;
    this._enableNormal = true;
    this._enablePosition = false;
    this._enableVelocity = false;
    this._enableVelocityLinear = false;
    this._enableReflectivity = false;
    this._enableScreenspaceDepth = false;
    this._enableIrradiance = false;
    this._enableObjectId = false;
    this._enableMeshBlendTag = false;
    this._clearColor = new Color4(0, 0, 0, 0);
    this._clearDepthColor = new Color4(0, 0, 0, 1);
    this._positionIndex = -1;
    this._velocityIndex = -1;
    this._velocityLinearIndex = -1;
    this._reflectivityIndex = -1;
    this._depthIndex = -1;
    this._normalIndex = -1;
    this._screenspaceDepthIndex = -1;
    this._irradianceIndex = -1;
    this._objectIdIndex = -1;
    this._meshBlendTagIndex = -1;
    this._linkedWithPrePass = false;
    this.generateIrradianceWithScatterMask = false;
    this.useSpecificClearForDepthTexture = false;
    this._shaderLanguage = 0;
    this._shadersLoaded = false;
    this._scene = scene;
    this._ratioOrDimensions = ratioOrDimensions;
    this._useUbo = scene.getEngine().supportsUniformBuffers;
    this._depthFormat = depthFormat;
    this._textureTypesAndFormats = textureTypesAndFormats || {};
    this._initShaderSourceAsync();
    RegisterGeometryBufferRendererSceneComponent(GeometryBufferRenderer);
    GeometryBufferRenderer._SceneComponentInitialization(this._scene);
    this._createRenderTargets();
  }
  async _initShaderSourceAsync() {
    const engine = this._scene.getEngine();
    if (engine.isWebGPU && !GeometryBufferRenderer.ForceGLSL) {
      this._shaderLanguage = 1;
      await Promise.all([__vitePreload(() => import("./geometry.vertex-D_ZO2Zex.js"), true ? __vite__mapDeps([0,1,2,3,4,5,6,7,8,9]) : void 0), __vitePreload(() => import("./geometry.fragment-C2N-cV8f.js"), true ? __vite__mapDeps([10,1,11,12,13,14,15,16,6,17,18,19]) : void 0)]);
    } else {
      await Promise.all([__vitePreload(() => import("./geometry.vertex-DERhfA1F.js"), true ? __vite__mapDeps([20,1,21,22,23,24,25,26,27]) : void 0), __vitePreload(() => import("./geometry.fragment-BvWCu8av.js").then((n) => n.g), true ? __vite__mapDeps([28,1,29,30,31,32,33,34,35,24,36,37]) : void 0)]);
    }
    this._shadersLoaded = true;
  }
  /**
   * Checks whether everything is ready to render a submesh to the G buffer.
   * @param subMesh the submesh to check readiness for
   * @param useInstances is the mesh drawn using instance or not
   * @returns true if ready otherwise false
   */
  isReady(subMesh, useInstances) {
    if (!this._shadersLoaded) {
      return false;
    }
    const material = subMesh.getMaterial();
    if (material && material.disableDepthWrite) {
      return false;
    }
    if (_IsGaussianSplattingMesh(subMesh.getMesh())) {
      return false;
    }
    const defines = [];
    const attribs = [VertexBuffer.PositionKind];
    const mesh = subMesh.getMesh();
    const hasNormals = mesh.isVerticesDataPresent(VertexBuffer.NormalKind);
    if (hasNormals) {
      defines.push("#define HAS_NORMAL_ATTRIBUTE");
      attribs.push(VertexBuffer.NormalKind);
    }
    let uv1 = false;
    let uv2 = false;
    const color = false;
    if (material) {
      let needUv = false;
      if (material.needAlphaTestingForMesh(mesh) && material.getAlphaTestTexture()) {
        defines.push("#define ALPHATEST");
        defines.push(`#define ALPHATEST_UV${material.getAlphaTestTexture().coordinatesIndex + 1}`);
        needUv = true;
      }
      if ((material.bumpTexture || material.normalTexture || material.geometryNormalTexture) && MaterialFlags.BumpTextureEnabled) {
        const texture = material.bumpTexture || material.normalTexture || material.geometryNormalTexture;
        defines.push("#define BUMP");
        defines.push(`#define BUMP_UV${texture.coordinatesIndex + 1}`);
        needUv = true;
      }
      if (this._enableReflectivity) {
        let metallicWorkflow = false;
        if (material.getClassName() === "PBRMetallicRoughnessMaterial") {
          if (material.metallicRoughnessTexture) {
            defines.push("#define ORMTEXTURE");
            defines.push(`#define REFLECTIVITY_UV${material.metallicRoughnessTexture.coordinatesIndex + 1}`);
            defines.push("#define METALLICWORKFLOW");
            needUv = true;
            metallicWorkflow = true;
          }
          if (material.metallic != null) {
            defines.push("#define METALLIC");
            defines.push("#define METALLICWORKFLOW");
            metallicWorkflow = true;
          }
          if (material.roughness != null) {
            defines.push("#define ROUGHNESS");
            defines.push("#define METALLICWORKFLOW");
            metallicWorkflow = true;
          }
          if (metallicWorkflow) {
            if (material.baseTexture) {
              defines.push("#define ALBEDOTEXTURE");
              defines.push(`#define ALBEDO_UV${material.baseTexture.coordinatesIndex + 1}`);
              if (material.baseTexture.gammaSpace) {
                defines.push("#define GAMMAALBEDO");
              }
              needUv = true;
            }
            if (material.baseColor) {
              defines.push("#define ALBEDOCOLOR");
            }
          }
        } else if (material.getClassName() === "PBRSpecularGlossinessMaterial") {
          if (material.specularGlossinessTexture) {
            defines.push("#define SPECULARGLOSSINESSTEXTURE");
            defines.push(`#define REFLECTIVITY_UV${material.specularGlossinessTexture.coordinatesIndex + 1}`);
            needUv = true;
            if (material.specularGlossinessTexture.gammaSpace) {
              defines.push("#define GAMMAREFLECTIVITYTEXTURE");
            }
          } else {
            if (material.specularColor) {
              defines.push("#define REFLECTIVITYCOLOR");
            }
          }
          if (material.glossiness != null) {
            defines.push("#define GLOSSINESS");
          }
        } else if (material.getClassName() === "PBRMaterial") {
          if (material.metallicTexture) {
            defines.push("#define ORMTEXTURE");
            defines.push(`#define REFLECTIVITY_UV${material.metallicTexture.coordinatesIndex + 1}`);
            defines.push("#define METALLICWORKFLOW");
            needUv = true;
            metallicWorkflow = true;
          }
          if (material.metallic != null) {
            defines.push("#define METALLIC");
            defines.push("#define METALLICWORKFLOW");
            metallicWorkflow = true;
          }
          if (material.roughness != null) {
            defines.push("#define ROUGHNESS");
            defines.push("#define METALLICWORKFLOW");
            metallicWorkflow = true;
          }
          if (metallicWorkflow) {
            if (material.albedoTexture) {
              defines.push("#define ALBEDOTEXTURE");
              defines.push(`#define ALBEDO_UV${material.albedoTexture.coordinatesIndex + 1}`);
              if (material.albedoTexture.gammaSpace) {
                defines.push("#define GAMMAALBEDO");
              }
              needUv = true;
            }
            if (material.albedoColor) {
              defines.push("#define ALBEDOCOLOR");
            }
          } else {
            if (material.reflectivityTexture) {
              defines.push("#define SPECULARGLOSSINESSTEXTURE");
              defines.push(`#define REFLECTIVITY_UV${material.reflectivityTexture.coordinatesIndex + 1}`);
              if (material.reflectivityTexture.gammaSpace) {
                defines.push("#define GAMMAREFLECTIVITYTEXTURE");
              }
              needUv = true;
            } else if (material.reflectivityColor) {
              defines.push("#define REFLECTIVITYCOLOR");
            }
            if (material.microSurface != null) {
              defines.push("#define GLOSSINESS");
            }
          }
        } else if (material.getClassName() === "StandardMaterial") {
          if (material.specularTexture) {
            defines.push("#define REFLECTIVITYTEXTURE");
            defines.push(`#define REFLECTIVITY_UV${material.specularTexture.coordinatesIndex + 1}`);
            if (material.specularTexture.gammaSpace) {
              defines.push("#define GAMMAREFLECTIVITYTEXTURE");
            }
            needUv = true;
          }
          if (material.specularColor) {
            defines.push("#define REFLECTIVITYCOLOR");
          }
        } else if (material.getClassName() === "OpenPBRMaterial") {
          const openpbrMaterial = material;
          defines.push("#define METALLIC");
          defines.push("#define ROUGHNESS");
          if (openpbrMaterial._useRoughnessFromMetallicTextureGreen && openpbrMaterial.baseMetalnessTexture) {
            defines.push("#define ORMTEXTURE");
            defines.push(`#define REFLECTIVITY_UV${openpbrMaterial.baseMetalnessTexture.coordinatesIndex + 1}`);
            needUv = true;
          } else if (openpbrMaterial.baseMetalnessTexture) {
            defines.push("#define METALLIC_TEXTURE");
            defines.push(`#define METALLIC_UV${openpbrMaterial.baseMetalnessTexture.coordinatesIndex + 1}`);
            needUv = true;
          } else if (openpbrMaterial.specularRoughnessTexture) {
            defines.push("#define ROUGHNESS_TEXTURE");
            defines.push(`#define ROUGHNESS_UV${openpbrMaterial.specularRoughnessTexture.coordinatesIndex + 1}`);
            needUv = true;
          }
          if (openpbrMaterial.baseColorTexture) {
            defines.push("#define ALBEDOTEXTURE");
            defines.push(`#define ALBEDO_UV${openpbrMaterial.baseColorTexture.coordinatesIndex + 1}`);
            if (openpbrMaterial.baseColorTexture.gammaSpace) {
              defines.push("#define GAMMAALBEDO");
            }
            needUv = true;
          }
          if (openpbrMaterial.baseColor) {
            defines.push("#define ALBEDOCOLOR");
          }
        }
      }
      if (this._enableIrradiance && this.generateIrradianceWithScatterMask) {
        defines.push("#define IRRADIANCE_SCATTER_MASK");
        if (material.getClassName() === "OpenPBRMaterial") {
          const openpbrMaterial = material;
          if (openpbrMaterial.subsurfaceWeight > 0) {
            if (openpbrMaterial.subsurfaceWeightTexture) {
              defines.push("#define SUBSURFACE_WEIGHT");
              defines.push(`#define SUBSURFACEWEIGHT_UV${openpbrMaterial.subsurfaceWeightTexture.coordinatesIndex + 1}`);
              needUv = true;
            }
          }
          if (openpbrMaterial.transmissionWeight > 0) {
            if (openpbrMaterial.transmissionWeightTexture) {
              defines.push("#define TRANSMISSION_WEIGHT");
              defines.push(`#define TRANSMISSIONWEIGHT_UV${openpbrMaterial.transmissionWeightTexture.coordinatesIndex + 1}`);
              needUv = true;
            }
          }
        }
      }
      if (needUv) {
        defines.push("#define NEED_UV");
        if (mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
          attribs.push(VertexBuffer.UVKind);
          defines.push("#define UV1");
          uv1 = true;
        }
        if (mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) {
          attribs.push(VertexBuffer.UV2Kind);
          defines.push("#define UV2");
          uv2 = true;
        }
      }
    }
    if (this._enableDepth) {
      defines.push("#define DEPTH");
      defines.push("#define DEPTH_INDEX " + this._depthIndex);
    }
    if (this._enableNormal) {
      defines.push("#define NORMAL");
      defines.push("#define NORMAL_INDEX " + this._normalIndex);
    }
    if (this._enablePosition) {
      defines.push("#define POSITION");
      defines.push("#define POSITION_INDEX " + this._positionIndex);
    }
    if (this._enableVelocity) {
      defines.push("#define VELOCITY");
      defines.push("#define VELOCITY_INDEX " + this._velocityIndex);
      if (this.excludedSkinnedMeshesFromVelocity.indexOf(mesh) === -1) {
        defines.push("#define BONES_VELOCITY_ENABLED");
      }
    }
    if (this._enableVelocityLinear) {
      defines.push("#define VELOCITY_LINEAR");
      defines.push("#define VELOCITY_LINEAR_INDEX " + this._velocityLinearIndex);
      if (this.excludedSkinnedMeshesFromVelocity.indexOf(mesh) === -1) {
        defines.push("#define BONES_VELOCITY_ENABLED");
      }
    }
    if (this._enableReflectivity) {
      defines.push("#define REFLECTIVITY");
      defines.push("#define REFLECTIVITY_INDEX " + this._reflectivityIndex);
    }
    if (this._enableScreenspaceDepth) {
      if (this._screenspaceDepthIndex !== -1) {
        defines.push("#define SCREENSPACE_DEPTH_INDEX " + this._screenspaceDepthIndex);
        defines.push("#define SCREENSPACE_DEPTH");
      }
    }
    if (this._enableIrradiance) {
      if (this._irradianceIndex !== -1) {
        defines.push("#define IRRADIANCE_INDEX " + this._irradianceIndex);
        defines.push("#define IRRADIANCE");
        const scene = this._scene;
        if (scene.environmentTexture) {
          const iblDefines = {};
          let realtime = false;
          let realtimeQuality = 0;
          if (material.getClassName() === "OpenPBRMaterial" || material.getClassName() === "StandardMaterial" || material.getClassName() === "PBRMetallicRoughnessMaterial" || material.getClassName() === "PBRSpecularGlossinessMaterial" || material.getClassName() === "PBRMaterial") {
            realtime = material.realtimeFiltering ? true : false;
            realtimeQuality = material.realtimeFilteringQuality || 0;
          }
          PrepareDefinesForIBL(scene, scene.environmentTexture, iblDefines, realtime, realtimeQuality, true);
          for (const define in iblDefines) {
            if (iblDefines[define]) {
              defines.push("#define " + define);
            }
          }
          if (!iblDefines.USEIRRADIANCEMAP) {
            defines.push("#define SPHERICAL_HARMONICS");
          }
          const iblShadowsPipeline = scene.postProcessRenderPipelineManager.supportedPipelines.find((p) => p.getClassName() === "IBLShadowsRenderPipeline");
          if (iblShadowsPipeline) {
            const pipeline = iblShadowsPipeline;
            const shadowTexture = pipeline._getAccumulatedTexture();
            if (shadowTexture) {
              defines.push("#define IBL_SHADOW_TEXTURE");
              if (pipeline.coloredShadows) {
                defines.push("#define COLORED_IBL_SHADOWS");
              }
            }
          }
        }
      }
    }
    if (this._enableObjectId) {
      defines.push("#define OBJECT_ID");
      defines.push("#define OBJECT_ID_INDEX " + this._objectIdIndex);
    }
    if (this._enableMeshBlendTag) {
      defines.push("#define MESH_BLEND_TAG");
      defines.push("#define MESH_BLEND_TAG_INDEX " + this._meshBlendTagIndex);
    }
    if (this.generateNormalsInWorldSpace) {
      defines.push("#define NORMAL_WORLDSPACE");
    }
    if (this._normalsAreUnsigned) {
      defines.push("#define ENCODE_NORMAL");
    }
    if (mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton) {
      attribs.push(VertexBuffer.MatricesIndicesKind);
      attribs.push(VertexBuffer.MatricesWeightsKind);
      if (mesh.numBoneInfluencers > 4) {
        attribs.push(VertexBuffer.MatricesIndicesExtraKind);
        attribs.push(VertexBuffer.MatricesWeightsExtraKind);
      }
      defines.push("#define NUM_BONE_INFLUENCERS " + mesh.numBoneInfluencers);
      defines.push("#define BONETEXTURE " + mesh.skeleton.isUsingTextureForMatrices);
      defines.push("#define BonesPerMesh " + (mesh.skeleton.bones.length + 1));
    } else {
      defines.push("#define NUM_BONE_INFLUENCERS 0");
      defines.push("#define BONETEXTURE false");
      defines.push("#define BonesPerMesh 0");
    }
    const numMorphInfluencers = mesh.morphTargetManager ? PrepareDefinesAndAttributesForMorphTargets(
      mesh.morphTargetManager,
      defines,
      attribs,
      mesh,
      true,
      // usePositionMorph
      true,
      // useNormalMorph
      false,
      // useTangentMorph
      uv1,
      // useUVMorph
      uv2,
      // useUV2Morph
      color
      // useColorMorph
    ) : 0;
    if (useInstances) {
      defines.push("#define INSTANCES");
      PushAttributesForInstances(attribs, this._enableVelocity || this._enableVelocityLinear);
      if (subMesh.getRenderingMesh().hasThinInstances) {
        defines.push("#define THIN_INSTANCES");
      }
    }
    if (this._linkedWithPrePass) {
      defines.push("#define SCENE_MRT_COUNT " + this._attachmentsFromPrePass.length);
    } else {
      defines.push("#define SCENE_MRT_COUNT " + this._multiRenderTarget.textures.length);
    }
    PrepareStringDefinesForClipPlanes(material, this._scene, defines);
    const engine = this._scene.getEngine();
    const drawWrapper = subMesh._getDrawWrapper(void 0, true);
    const cachedDefines = drawWrapper.defines;
    const join = defines.join("\n");
    if (cachedDefines !== join) {
      drawWrapper.setEffect(engine.createEffect("geometry", {
        attributes: attribs,
        uniformsNames: Uniforms,
        samplers: Samplers,
        defines: join,
        onCompiled: null,
        fallbacks: null,
        onError: null,
        uniformBuffersNames: ["Scene"],
        indexParameters: { buffersCount: this._multiRenderTarget.textures.length - 1, maxSimultaneousMorphTargets: numMorphInfluencers },
        shaderLanguage: this.shaderLanguage
      }, engine), join);
    }
    return drawWrapper.effect.isReady();
  }
  /**
   * Gets the current underlying G Buffer.
   * @returns the buffer
   */
  getGBuffer() {
    return this._multiRenderTarget;
  }
  /**
   * Gets the number of samples used to render the buffer (anti aliasing).
   */
  get samples() {
    return this._multiRenderTarget.samples;
  }
  /**
   * Sets the number of samples used to render the buffer (anti aliasing).
   */
  set samples(value) {
    if (this._enableObjectId && value !== 1) {
      throw new Error("GeometryBufferRenderer: object ID textures currently require samples to be 1");
    }
    if (this._enableMeshBlendTag && value !== 1) {
      throw new Error("GeometryBufferRenderer: mesh-blending tag textures require samples to be 1");
    }
    this._multiRenderTarget.samples = value;
  }
  /**
   * Disposes the renderer and frees up associated resources.
   */
  dispose() {
    this._scene._setPreviousWorldMatricesRequired(this, false);
    if (this._resizeObserver) {
      const engine = this._scene.getEngine();
      engine.onResizeObservable.remove(this._resizeObserver);
      this._resizeObserver = null;
    }
    if (this._multiRenderTarget?.renderTarget && this.scene.getEngine()._currentRenderTarget === this._multiRenderTarget.renderTarget) {
      this.scene.getEngine().unBindFramebuffer(this._multiRenderTarget?.renderTarget);
    }
    this.getGBuffer().dispose();
  }
  _assignRenderTargetIndices() {
    const textureNames = [];
    const textureTypesAndFormats = [];
    let count = 0;
    if (this._enableDepth) {
      this._depthIndex = count;
      count++;
      textureNames.push("gBuffer_Depth");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.DEPTH_TEXTURE_TYPE]);
    }
    if (this._enableNormal) {
      this._normalIndex = count;
      count++;
      textureNames.push("gBuffer_Normal");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.NORMAL_TEXTURE_TYPE]);
    }
    if (this._enablePosition) {
      this._positionIndex = count;
      count++;
      textureNames.push("gBuffer_Position");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.POSITION_TEXTURE_TYPE]);
    }
    if (this._enableVelocity) {
      this._velocityIndex = count;
      count++;
      textureNames.push("gBuffer_Velocity");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.VELOCITY_TEXTURE_TYPE]);
    }
    if (this._enableVelocityLinear) {
      this._velocityLinearIndex = count;
      count++;
      textureNames.push("gBuffer_VelocityLinear");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.VELOCITY_LINEAR_TEXTURE_TYPE]);
    }
    if (this._enableReflectivity) {
      this._reflectivityIndex = count;
      count++;
      textureNames.push("gBuffer_Reflectivity");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.REFLECTIVITY_TEXTURE_TYPE]);
    }
    if (this._enableScreenspaceDepth) {
      this._screenspaceDepthIndex = count;
      count++;
      textureNames.push("gBuffer_ScreenspaceDepth");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.SCREENSPACE_DEPTH_TEXTURE_TYPE]);
    }
    if (this._enableIrradiance) {
      this._irradianceIndex = count;
      count++;
      textureNames.push("gBuffer_Irradiance");
      textureTypesAndFormats.push(this._textureTypesAndFormats[GeometryBufferRenderer.IRRADIANCE_TEXTURE_TYPE]);
    }
    if (this._enableObjectId) {
      this._objectIdIndex = count;
      count++;
      textureNames.push("gBuffer_ObjectId");
      textureTypesAndFormats.push({
        textureType: 0,
        textureFormat: 5,
        samplingMode: 1
      });
    }
    if (this._enableMeshBlendTag) {
      this._meshBlendTagIndex = count;
      count++;
      textureNames.push("gBuffer_MeshBlendTag");
      textureTypesAndFormats.push({
        textureType: 0,
        textureFormat: 8,
        samplingMode: 1
      });
    }
    return [count, textureNames, textureTypesAndFormats];
  }
  _createRenderTargets() {
    const engine = this._scene.getEngine();
    const [count, textureNames, textureTypesAndFormat] = this._assignRenderTargetIndices();
    const maxDrawBuffers = Math.min(engine.getCaps().maxDrawBuffers ?? 1, 8);
    if (engine.getCaps().drawBuffersExtension && count > maxDrawBuffers) {
      throw new Error(`GeometryBufferRenderer: ${count} color attachments were requested, but this engine supports at most ${maxDrawBuffers}`);
    }
    let type = 0;
    if (engine._caps.textureFloat && engine._caps.textureFloatLinearFiltering) {
      type = 1;
    } else if (engine._caps.textureHalfFloat && engine._caps.textureHalfFloatLinearFiltering) {
      type = 2;
    }
    const dimensions = this._getRenderTargetDimensions();
    const textureTypes = [];
    const textureFormats = [];
    const samplingModes = [];
    for (const typeAndFormat of textureTypesAndFormat) {
      if (typeAndFormat) {
        textureTypes.push(typeAndFormat.textureType);
        textureFormats.push(typeAndFormat.textureFormat);
        samplingModes.push(typeAndFormat.samplingMode ?? 2);
      } else {
        textureTypes.push(type);
        textureFormats.push(5);
        samplingModes.push(2);
      }
    }
    this._normalsAreUnsigned = textureTypes[GeometryBufferRenderer.NORMAL_TEXTURE_TYPE] === 11 || textureTypes[GeometryBufferRenderer.NORMAL_TEXTURE_TYPE] === 13;
    this._multiRenderTarget = new MultiRenderTarget("gBuffer", dimensions, count, this._scene, { generateMipMaps: false, generateDepthTexture: true, types: textureTypes, formats: textureFormats, samplingModes, depthTextureFormat: this._depthFormat }, textureNames.concat("gBuffer_DepthBuffer"));
    if (!this.isSupported) {
      return;
    }
    this._scene._setPreviousWorldMatricesRequired(this, !this._linkedWithPrePass && (this._enableVelocity || this._enableVelocityLinear));
    this._multiRenderTarget.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._multiRenderTarget.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._multiRenderTarget.refreshRate = 1;
    this._multiRenderTarget.renderParticles = false;
    this._multiRenderTarget.renderList = null;
    const layoutAttachmentsAll = [true];
    const layoutAttachmentsAllButDepth = [false];
    const layoutAttachmentsDepthOnly = [true];
    for (let i = 1; i < count; ++i) {
      layoutAttachmentsAll.push(true);
      layoutAttachmentsDepthOnly.push(false);
      layoutAttachmentsAllButDepth.push(true);
    }
    const attachmentsAll = engine.buildTextureLayout(layoutAttachmentsAll);
    const attachmentsAllButDepth = engine.buildTextureLayout(layoutAttachmentsAllButDepth);
    const attachmentsDepthOnly = engine.buildTextureLayout(layoutAttachmentsDepthOnly);
    this._multiRenderTarget.onClearObservable.add((engine2) => {
      const colorAttachments = this.useSpecificClearForDepthTexture ? attachmentsAllButDepth : attachmentsAll;
      engine2.clearAttachments(this._clearColor, colorAttachments, true, true, true);
      if (this.useSpecificClearForDepthTexture) {
        engine2.clearAttachments(this._clearDepthColor, attachmentsDepthOnly, true, false, false);
      }
      engine2.bindAttachments(attachmentsAll);
    });
    this._resizeObserver = engine.onResizeObservable.add(() => {
      if (this._multiRenderTarget) {
        this._multiRenderTarget.resize(this._getRenderTargetDimensions());
      }
    });
    const renderSubMesh = (subMesh) => {
      const renderingMesh = subMesh.getRenderingMesh();
      const effectiveMesh = subMesh.getEffectiveMesh();
      const scene = this._scene;
      const engine2 = scene.getEngine();
      const material = subMesh.getMaterial();
      if (!material) {
        return;
      }
      effectiveMesh._internalAbstractMeshDataInfo._isActiveIntermediate = false;
      if ((this._enableVelocity || this._enableVelocityLinear) && !this._previousTransformationMatrices[effectiveMesh.uniqueId]) {
        this._previousTransformationMatrices[effectiveMesh.uniqueId] = {
          world: Matrix.Identity(),
          viewProjection: scene.getTransformMatrix()
        };
        if (renderingMesh.skeleton) {
          const bonesTransformations = renderingMesh.skeleton.getTransformMatrices(renderingMesh);
          this._previousBonesTransformationMatrices[renderingMesh.uniqueId] = this._copyBonesTransformationMatrices(bonesTransformations, new Float32Array(bonesTransformations.length));
        }
      }
      const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
      if (batch.mustReturn) {
        return;
      }
      const hardwareInstancedRendering = engine2.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null || renderingMesh.hasThinInstances);
      const world = effectiveMesh.getWorldMatrix();
      if (this.isReady(subMesh, hardwareInstancedRendering)) {
        const drawWrapper = subMesh._getDrawWrapper();
        if (!drawWrapper) {
          return;
        }
        const effect = drawWrapper.effect;
        engine2.enableEffect(drawWrapper);
        if (!hardwareInstancedRendering) {
          renderingMesh._bind(subMesh, effect, material.fillMode);
        }
        if (!this._useUbo) {
          effect.setMatrix("viewProjection", scene.getTransformMatrix());
          effect.setMatrix("view", scene.getViewMatrix());
          this._scene.bindEyePosition(effect, "vEyePosition");
        } else {
          BindSceneUniformBuffer(effect, this._scene.getSceneUniformBuffer());
          this._scene.finalizeSceneUbo();
        }
        let sideOrientation;
        const instanceDataStorage = renderingMesh._instanceDataStorage;
        if (!instanceDataStorage.isFrozen && (material.backFaceCulling || material.sideOrientation !== null)) {
          const mainDeterminant = effectiveMesh._getWorldMatrixDeterminant();
          sideOrientation = material._getEffectiveOrientation(renderingMesh);
          if (mainDeterminant < 0) {
            sideOrientation = sideOrientation === Material.ClockWiseSideOrientation ? Material.CounterClockWiseSideOrientation : Material.ClockWiseSideOrientation;
          }
        } else {
          sideOrientation = renderingMesh._effectiveSideOrientation;
        }
        material._preBind(drawWrapper, sideOrientation);
        if (material.needAlphaTestingForMesh(effectiveMesh)) {
          const alphaTexture = material.getAlphaTestTexture();
          if (alphaTexture) {
            effect.setTexture("diffuseSampler", alphaTexture);
            effect.setMatrix("diffuseMatrix", alphaTexture.getTextureMatrix());
            effect.setFloat("alphaCutOff", material.alphaCutOff ?? 0.4);
          }
        }
        if ((material.bumpTexture || material.normalTexture || material.geometryNormalTexture) && scene.getEngine().getCaps().standardDerivatives && MaterialFlags.BumpTextureEnabled) {
          const texture = material.bumpTexture || material.normalTexture || material.geometryNormalTexture;
          effect.setFloat3("vBumpInfos", texture.coordinatesIndex, 1 / texture.level, material.parallaxScaleBias);
          effect.setMatrix("bumpMatrix", texture.getTextureMatrix());
          effect.setTexture("bumpSampler", texture);
          effect.setFloat2("vTangentSpaceParams", material.invertNormalMapX ? -1 : 1, material.invertNormalMapY ? -1 : 1);
        }
        if (this._enableReflectivity) {
          if (material.getClassName() === "PBRMetallicRoughnessMaterial") {
            if (material.metallicRoughnessTexture !== null) {
              effect.setTexture("reflectivitySampler", material.metallicRoughnessTexture);
              effect.setMatrix("reflectivityMatrix", material.metallicRoughnessTexture.getTextureMatrix());
            }
            if (material.metallic !== null) {
              effect.setFloat("metallic", material.metallic);
            }
            if (material.roughness !== null) {
              effect.setFloat("glossiness", 1 - material.roughness);
            }
            if (material.baseTexture !== null) {
              effect.setTexture("albedoSampler", material.baseTexture);
              effect.setMatrix("albedoMatrix", material.baseTexture.getTextureMatrix());
            }
            if (material.baseColor !== null) {
              effect.setColor3("albedoColor", material.baseColor);
            }
          } else if (material.getClassName() === "PBRSpecularGlossinessMaterial") {
            if (material.specularGlossinessTexture !== null) {
              effect.setTexture("reflectivitySampler", material.specularGlossinessTexture);
              effect.setMatrix("reflectivityMatrix", material.specularGlossinessTexture.getTextureMatrix());
            } else {
              if (material.specularColor !== null) {
                effect.setColor3("reflectivityColor", material.specularColor);
              }
            }
            if (material.glossiness !== null) {
              effect.setFloat("glossiness", material.glossiness);
            }
          } else if (material.getClassName() === "PBRMaterial") {
            if (material.metallicTexture !== null) {
              effect.setTexture("reflectivitySampler", material.metallicTexture);
              effect.setMatrix("reflectivityMatrix", material.metallicTexture.getTextureMatrix());
            }
            if (material.metallic !== null) {
              effect.setFloat("metallic", material.metallic);
            }
            if (material.roughness !== null) {
              effect.setFloat("glossiness", 1 - material.roughness);
            }
            if (material.roughness !== null || material.metallic !== null || material.metallicTexture !== null) {
              if (material.albedoTexture !== null) {
                effect.setTexture("albedoSampler", material.albedoTexture);
                effect.setMatrix("albedoMatrix", material.albedoTexture.getTextureMatrix());
              }
              if (material.albedoColor !== null) {
                effect.setColor3("albedoColor", material.albedoColor);
              }
            } else {
              if (material.reflectivityTexture !== null) {
                effect.setTexture("reflectivitySampler", material.reflectivityTexture);
                effect.setMatrix("reflectivityMatrix", material.reflectivityTexture.getTextureMatrix());
              } else if (material.reflectivityColor !== null) {
                effect.setColor3("reflectivityColor", material.reflectivityColor);
              }
              if (material.microSurface !== null) {
                effect.setFloat("glossiness", material.microSurface);
              }
            }
          } else if (material.getClassName() === "StandardMaterial") {
            if (material.specularTexture !== null) {
              effect.setTexture("reflectivitySampler", material.specularTexture);
              effect.setMatrix("reflectivityMatrix", material.specularTexture.getTextureMatrix());
            }
            if (material.specularColor !== null) {
              effect.setColor3("reflectivityColor", material.specularColor);
            }
          } else if (material.getClassName() === "OpenPBRMaterial") {
            const openpbrMaterial = material;
            if (openpbrMaterial._useRoughnessFromMetallicTextureGreen && openpbrMaterial.baseMetalnessTexture) {
              effect.setTexture("reflectivitySampler", openpbrMaterial.baseMetalnessTexture);
              effect.setMatrix("reflectivityMatrix", openpbrMaterial.baseMetalnessTexture.getTextureMatrix());
            } else if (openpbrMaterial.baseMetalnessTexture) {
              effect.setTexture("metallicSampler", openpbrMaterial.baseMetalnessTexture);
              effect.setMatrix("metallicMatrix", openpbrMaterial.baseMetalnessTexture.getTextureMatrix());
            } else if (openpbrMaterial.specularRoughnessTexture) {
              effect.setTexture("roughnessSampler", openpbrMaterial.specularRoughnessTexture);
              effect.setMatrix("roughnessMatrix", openpbrMaterial.specularRoughnessTexture.getTextureMatrix());
            }
            effect.setFloat("metallic", openpbrMaterial.baseMetalness);
            effect.setFloat("glossiness", 1 - openpbrMaterial.specularRoughness);
            if (openpbrMaterial.baseColorTexture !== null) {
              effect.setTexture("albedoSampler", openpbrMaterial.baseColorTexture);
              effect.setMatrix("albedoMatrix", openpbrMaterial.baseColorTexture.getTextureMatrix());
            }
            if (openpbrMaterial.baseColor !== null) {
              effect.setColor3("albedoColor", openpbrMaterial.baseColor);
            }
          }
        }
        if (this._enableIrradiance && scene.environmentTexture) {
          const reflectionTexture = scene.environmentTexture;
          const iblShadowsPipeline = scene.postProcessRenderPipelineManager.supportedPipelines.find((p) => p.getClassName() === "IBLShadowsRenderPipeline");
          if (iblShadowsPipeline) {
            const pipeline = iblShadowsPipeline;
            const shadowTexture = pipeline._getAccumulatedTexture();
            if (shadowTexture) {
              effect.setTexture("iblShadowSampler", shadowTexture);
              effect.setFloat2("shadowTextureSize", shadowTexture.getSize().width, shadowTexture.getSize().height);
            }
          }
          effect.setMatrix("reflectionMatrix", reflectionTexture.getReflectionTextureMatrix());
          effect.setFloat2("vReflectionInfos", reflectionTexture.level * scene.iblIntensity, 0);
          effect.setTexture("reflectionSampler", reflectionTexture);
          if (reflectionTexture.irradianceTexture) {
            effect.setTexture("irradianceSampler", reflectionTexture.irradianceTexture);
            if (reflectionTexture.irradianceTexture._dominantDirection) {
              effect.setVector3("vReflectionDominantDirection", reflectionTexture.irradianceTexture._dominantDirection);
            }
          }
          if (reflectionTexture.sphericalPolynomial) {
            const polynomials = reflectionTexture.sphericalPolynomial;
            if (polynomials.preScaledHarmonics) {
              const harmonics = polynomials.preScaledHarmonics;
              effect.setVector3("vSphericalL00", harmonics.l00);
              effect.setVector3("vSphericalL1_1", harmonics.l1_1);
              effect.setVector3("vSphericalL10", harmonics.l10);
              effect.setVector3("vSphericalL11", harmonics.l11);
              effect.setVector3("vSphericalL2_2", harmonics.l2_2);
              effect.setVector3("vSphericalL2_1", harmonics.l2_1);
              effect.setVector3("vSphericalL20", harmonics.l20);
              effect.setVector3("vSphericalL21", harmonics.l21);
              effect.setVector3("vSphericalL22", harmonics.l22);
            } else {
              effect.setFloat3("vSphericalX", polynomials.x.x, polynomials.x.y, polynomials.x.z);
              effect.setFloat3("vSphericalY", polynomials.y.x, polynomials.y.y, polynomials.y.z);
              effect.setFloat3("vSphericalZ", polynomials.z.x, polynomials.z.y, polynomials.z.z);
              effect.setFloat3("vSphericalXX_ZZ", polynomials.xx.x - polynomials.zz.x, polynomials.xx.y - polynomials.zz.y, polynomials.xx.z - polynomials.zz.z);
              effect.setFloat3("vSphericalYY_ZZ", polynomials.yy.x - polynomials.zz.x, polynomials.yy.y - polynomials.zz.y, polynomials.yy.z - polynomials.zz.z);
              effect.setFloat3("vSphericalZZ", polynomials.zz.x, polynomials.zz.y, polynomials.zz.z);
              effect.setFloat3("vSphericalXY", polynomials.xy.x, polynomials.xy.y, polynomials.xy.z);
              effect.setFloat3("vSphericalYZ", polynomials.yz.x, polynomials.yz.y, polynomials.yz.z);
              effect.setFloat3("vSphericalZX", polynomials.zx.x, polynomials.zx.y, polynomials.zx.z);
            }
          }
          if (this.generateIrradianceWithScatterMask && material.getClassName() === "OpenPBRMaterial") {
            const openpbrMaterial = material;
            effect.setFloat("vSubsurfaceWeight", openpbrMaterial.subsurfaceWeight);
            if (openpbrMaterial.subsurfaceWeightTexture) {
              effect.setTexture("subsurfaceWeightSampler", openpbrMaterial.subsurfaceWeightTexture);
              effect.setMatrix("subsurfaceWeightMatrix", openpbrMaterial.subsurfaceWeightTexture.getTextureMatrix());
            }
            effect.setFloat("vTransmissionWeight", openpbrMaterial.transmissionWeight);
            if (openpbrMaterial.transmissionWeightTexture) {
              effect.setTexture("transmissionWeightSampler", openpbrMaterial.transmissionWeightTexture);
              effect.setMatrix("transmissionWeightMatrix", openpbrMaterial.transmissionWeightTexture.getTextureMatrix());
            }
            effect.setFloat("vTransmissionScatterAnisotropy", openpbrMaterial.transmissionScatterAnisotropy);
            effect.setFloat("vSubsurfaceScatterAnisotropy", openpbrMaterial.subsurfaceScatterAnisotropy);
          }
        }
        BindClipPlane(effect, material, this._scene);
        if (renderingMesh.useBones && renderingMesh.computeBonesUsingShaders && renderingMesh.skeleton) {
          const skeleton = renderingMesh.skeleton;
          if (skeleton.isUsingTextureForMatrices && effect.getUniformIndex("boneTextureInfo") > -1) {
            const boneTexture = skeleton.getTransformMatrixTexture(renderingMesh);
            effect.setTexture("boneSampler", boneTexture);
            effect.setFloat2("boneTextureInfo", skeleton._textureWidth, skeleton._textureHeight);
          } else {
            effect.setMatrices("mBones", renderingMesh.skeleton.getTransformMatrices(renderingMesh));
          }
          if (this._enableVelocity || this._enableVelocityLinear) {
            effect.setMatrices("mPreviousBones", this._previousBonesTransformationMatrices[renderingMesh.uniqueId]);
          }
        }
        BindMorphTargetParameters(renderingMesh, effect);
        if (renderingMesh.morphTargetManager && renderingMesh.morphTargetManager.isUsingTextureForTargets) {
          renderingMesh.morphTargetManager._bind(effect);
        }
        if (this._enableVelocity || this._enableVelocityLinear) {
          effect.setMatrix("previousWorld", this._previousTransformationMatrices[effectiveMesh.uniqueId].world);
          effect.setMatrix("previousViewProjection", this._previousTransformationMatrices[effectiveMesh.uniqueId].viewProjection);
        }
        if (this._enableObjectId) {
          let objectId = renderingMesh.uniqueId;
          if (this.objectIdProvider) {
            objectId = _GetGeometryRenderingObjectId(renderingMesh, this.objectIdProvider);
          } else if (objectId > 16777215) {
            throw new Error(`Invalid geometry object ID ${objectId} for mesh "${renderingMesh.name}". Object IDs must be integers between 0 and 0xFFFFFF.`);
          }
          effect.setFloat("objectId", objectId);
        }
        if (this._enableMeshBlendTag) {
          const meshBlendTag = this.meshBlendTagProvider ? _GetGeometryRenderingMeshBlendTag(renderingMesh, this.meshBlendTagProvider) : renderingMesh.meshBlendingTag;
          effect.setInt("meshBlendTag", meshBlendTag);
        }
        if (hardwareInstancedRendering && renderingMesh.hasThinInstances) {
          effect.setMatrix("world", world);
        }
        renderingMesh._processRendering(effectiveMesh, subMesh, effect, material.fillMode, batch, hardwareInstancedRendering, (isInstance, w) => {
          if (!isInstance) {
            effect.setMatrix("world", w);
          }
        });
      }
      if (this._enableVelocity || this._enableVelocityLinear) {
        this._previousTransformationMatrices[effectiveMesh.uniqueId].world = world.clone();
        this._previousTransformationMatrices[effectiveMesh.uniqueId].viewProjection = this._scene.getTransformMatrix().clone();
        if (renderingMesh.skeleton) {
          this._copyBonesTransformationMatrices(renderingMesh.skeleton.getTransformMatrices(renderingMesh), this._previousBonesTransformationMatrices[effectiveMesh.uniqueId]);
        }
      }
    };
    this._multiRenderTarget.customIsReadyFunction = (mesh, refreshRate, preWarm) => {
      if ((preWarm || refreshRate === 0) && mesh.subMeshes) {
        for (let i = 0; i < mesh.subMeshes.length; ++i) {
          const subMesh = mesh.subMeshes[i];
          const material = subMesh.getMaterial();
          const renderingMesh = subMesh.getRenderingMesh();
          if (!material) {
            continue;
          }
          const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
          const hardwareInstancedRendering = engine.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null || renderingMesh.hasThinInstances);
          if (!this.isReady(subMesh, hardwareInstancedRendering)) {
            return false;
          }
        }
      }
      return true;
    };
    this._multiRenderTarget.customRenderFunction = (opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes) => {
      let index;
      if (this._linkedWithPrePass) {
        if (!this._prePassRenderer.enabled) {
          return;
        }
        this._scene.getEngine().bindAttachments(this._attachmentsFromPrePass);
      }
      if (depthOnlySubMeshes.length) {
        engine.setColorWrite(false);
        for (index = 0; index < depthOnlySubMeshes.length; index++) {
          renderSubMesh(depthOnlySubMeshes.data[index]);
        }
        engine.setColorWrite(true);
      }
      for (index = 0; index < opaqueSubMeshes.length; index++) {
        renderSubMesh(opaqueSubMeshes.data[index]);
      }
      engine.setDepthWrite(false);
      for (index = 0; index < alphaTestSubMeshes.length; index++) {
        renderSubMesh(alphaTestSubMeshes.data[index]);
      }
      if (this.renderTransparentMeshes) {
        for (index = 0; index < transparentSubMeshes.length; index++) {
          renderSubMesh(transparentSubMeshes.data[index]);
        }
      }
      engine.setDepthWrite(true);
    };
  }
  _getRenderTargetDimensions() {
    if (typeof this._ratioOrDimensions === "object") {
      return {
        width: Math.max(1, Math.floor(this._ratioOrDimensions.width)),
        height: Math.max(1, Math.floor(this._ratioOrDimensions.height))
      };
    }
    const engine = this._scene.getEngine();
    return {
      width: Math.max(1, Math.floor(engine.getRenderWidth() * this._ratioOrDimensions)),
      height: Math.max(1, Math.floor(engine.getRenderHeight() * this._ratioOrDimensions))
    };
  }
  // Copies the bones transformation matrices into the target array and returns the target's reference
  _copyBonesTransformationMatrices(source, target) {
    for (let i = 0; i < source.length; i++) {
      target[i] = source[i];
    }
    return target;
  }
}
GeometryBufferRenderer.ForceGLSL = false;
GeometryBufferRenderer.DEPTH_TEXTURE_TYPE = 0;
GeometryBufferRenderer.NORMAL_TEXTURE_TYPE = 1;
GeometryBufferRenderer.POSITION_TEXTURE_TYPE = 2;
GeometryBufferRenderer.VELOCITY_TEXTURE_TYPE = 3;
GeometryBufferRenderer.REFLECTIVITY_TEXTURE_TYPE = 4;
GeometryBufferRenderer.SCREENSPACE_DEPTH_TEXTURE_TYPE = 5;
GeometryBufferRenderer.VELOCITY_LINEAR_TEXTURE_TYPE = 6;
GeometryBufferRenderer.IRRADIANCE_TEXTURE_TYPE = 7;
GeometryBufferRenderer.OBJECT_ID_TEXTURE_TYPE = 8;
GeometryBufferRenderer.MESH_BLEND_TAG_TEXTURE_TYPE = 9;
GeometryBufferRenderer._SceneComponentInitialization = (_) => {
  throw _WarnImport("GeometryBufferRendererSceneComponent");
};
let _Registered = false;
function RegisterGeometryBufferRenderer() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  PrepareUniformsAndSamplersForIBL(Uniforms, Samplers, true);
  AddClipPlaneUniforms(Uniforms);
}
export {
  GeometryBufferRenderer as G,
  RegisterGeometryBufferRendererSceneComponent as R,
  _IsGaussianSplattingMesh as _,
  _IsMeshBlendingSupported as a,
  RegisterGeometryBufferRenderer as b
};
