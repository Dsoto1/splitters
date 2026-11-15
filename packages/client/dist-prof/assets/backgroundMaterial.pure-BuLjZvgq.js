const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/background.vertex-BSyGbpcj.js","assets/babylon-PnzH6wcM.js","assets/sceneUboDeclaration-CFURaA3t.js","assets/backgroundUboDeclaration-Z-hhgbmB.js","assets/helperFunctions-Cbwc0-4F.js","assets/bakedVertexAnimation-D_Sv770W.js","assets/instancesDeclaration-CoQOC7Vy.js","assets/clipPlaneVertex-BdoNWmEf.js","assets/fogVertex-DbLnME-r.js","assets/shadowsVertex-Cw3037Hn.js","assets/logDepthDeclaration-CQzyhobd.js","assets/logDepthVertex-IJzM9PkV.js","assets/background.fragment-DriwRoN_.js","assets/reflectionFunction-BOSii2hf.js","assets/imageProcessingFunctions-16KHFFYj.js","assets/shadowsFragmentFunctions-B0ObXIYJ.js","assets/clusteredLightingFunctions-Cuu0SUCz.js","assets/lightsFragmentFunctions-CgiQATRv.js","assets/clipPlaneFragment-D8NTl-r6.js","assets/fogFragment-Dp8mD_y1.js","assets/lightFragment-fzQbvocV.js","assets/logDepthFragment-DPo7Bo0h.js","assets/background.vertex-C5EKNzn9.js","assets/sceneUboDeclaration-CzhdE5li.js","assets/backgroundUboDeclaration-D_3xJUfx.js","assets/helperFunctions-vFx73x84.js","assets/bonesVertex-Cpn2iSQy.js","assets/instancesVertex-23t-Q1Uk.js","assets/instancesDeclaration-DL63iftc.js","assets/clipPlaneVertex-CtRrEuj6.js","assets/fogVertex-CNSnaHda.js","assets/shadowsVertex-D5xsxluj.js","assets/logDepthDeclaration-Cf0EhojL.js","assets/logDepthVertex-vt-aaTE3.js","assets/background.fragment-DM1VJ3u5.js","assets/reflectionFunction-CyEZlAae.js","assets/imageProcessingFunctions-BJDZDhUW.js","assets/shadowsFragmentFunctions-8xXOZkT-.js","assets/clusteredLightingFunctions-DAc2D0Os.js","assets/lightsFragmentFunctions-C62kB_zL.js","assets/clipPlaneFragment-BbExy4ec.js","assets/fogFragment-Dm1Vlk0e.js","assets/lightFragment-Ck-gGuYL.js","assets/logDepthFragment-81Y6Jflh.js"])))=>i.map(i=>d[i]);
import { F as FreeCamera, bC as Node, V as Vector3, f as Camera, aK as __classPrivateFieldGet, aL as __classPrivateFieldSet, a8 as __runInitializers, a as Color3, aN as SmartArray, a1 as Vector4, b5 as PrepareDefinesForLights, aS as AreLightsTexturesReady, b6 as PrepareDefinesForMultiview, aO as MaterialFlags, b9 as PrepareDefinesForMergedUV, ba as PrepareDefinesForIBL, bb as PrepareDefinesForMisc, bc as PrepareDefinesForFrameBoundValues, bd as PrepareDefinesForAttributes, j as VertexBuffer, L as Logger, E as EffectFallbacks, aZ as HandleFallbacksForShadows, a_ as PrepareAttributesForBones, a$ as PrepareAttributesForInstances, A as AddClipPlaneUniforms, b2 as PrepareUniformsAndSamplersForIBL, b3 as ImageProcessingConfiguration, b4 as PrepareUniformsAndSamplersList, aT as PrepareUniformLayoutForIBL, s as BindBonesParameters, aV as BindTextureMatrix, aW as BindIBLParameters, l as TmpVectors, aX as BindIBLSamplers, t as BindClipPlane, aY as BindLights, w as BindFogParameters, v as BindLogDepth, y as SerializationHelper, a7 as __esDecorate, be as _ShaderImportLoader, a9 as __vitePreload, bf as ImageProcessingDefinesMixin, bg as ImageProcessingMixin, m as PushMaterial, bj as MaterialDefines, bF as serializeAsColor3, bn as expandToProperty, bm as serialize, bG as serializeAsTexture, bz as serializeAsVector3, bk as RegisterImageProcessingConfiguration, z as RegisterClass } from "./babylon-PnzH6wcM.js";
class TouchCamera extends FreeCamera {
  /**
   * Defines the touch sensibility for rotation.
   * The higher the faster.
   */
  get touchAngularSensibility() {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      return touch.touchAngularSensibility;
    }
    return 0;
  }
  set touchAngularSensibility(value) {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      touch.touchAngularSensibility = value;
    }
  }
  /**
   * Defines the touch sensibility for move.
   * The higher the faster.
   */
  get touchMoveSensibility() {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      return touch.touchMoveSensibility;
    }
    return 0;
  }
  set touchMoveSensibility(value) {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      touch.touchMoveSensibility = value;
    }
  }
  /**
   * Instantiates a new touch camera.
   * This represents a FPS type of camera controlled by touch.
   * This is like a universal camera minus the Gamepad controls.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_introduction#universal-camera
   * @param name Define the name of the camera in the scene
   * @param position Define the start position of the camera in the scene
   * @param scene Define the scene the camera belongs to
   */
  constructor(name, position, scene) {
    super(name, position, scene);
    this.inputs.addTouch();
    this._setupInputs();
  }
  /**
   * Gets the current object class name.
   * @returns the class name
   */
  getClassName() {
    return "TouchCamera";
  }
  /** @internal */
  _setupInputs() {
    const touch = this.inputs.attached["touch"];
    const mouse = this.inputs.attached["mouse"];
    if (mouse) {
      mouse.touchEnabled = !touch;
    } else if (touch) {
      touch.allowMouse = !mouse;
    }
  }
}
let _Registered$2 = false;
function RegisterTouchCamera() {
  if (_Registered$2) {
    return;
  }
  _Registered$2 = true;
  Node.AddNodeConstructor("TouchCamera", (name, scene) => {
    return () => new TouchCamera(name, Vector3.Zero(), scene);
  });
}
class UniversalCamera extends TouchCamera {
  /**
   * Defines the gamepad rotation sensibility.
   * This is the threshold from when rotation starts to be accounted for to prevent jittering.
   */
  get gamepadAngularSensibility() {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      return gamepad.gamepadAngularSensibility;
    }
    return 0;
  }
  set gamepadAngularSensibility(value) {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      gamepad.gamepadAngularSensibility = value;
    }
  }
  /**
   * Defines the gamepad move sensibility.
   * This is the threshold from when moving starts to be accounted for to prevent jittering.
   */
  get gamepadMoveSensibility() {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      return gamepad.gamepadMoveSensibility;
    }
    return 0;
  }
  set gamepadMoveSensibility(value) {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      gamepad.gamepadMoveSensibility = value;
    }
  }
  /**
   * The Universal Camera is the one to choose for first person shooter type games, and works with all the keyboard, mouse, touch and gamepads. This replaces the earlier Free Camera,
   * which still works and will still be found in many Playgrounds.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_introduction#universal-camera
   * @param name Define the name of the camera in the scene
   * @param position Define the start position of the camera in the scene
   * @param scene Define the scene the camera belongs to
   */
  constructor(name, position, scene) {
    super(name, position, scene);
    this.inputs.addGamepad();
  }
  /**
   * Gets the current object class name.
   * @returns the class name
   */
  getClassName() {
    return "UniversalCamera";
  }
}
let _Registered$1 = false;
function RegisterUniversalCamera() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  Node.AddNodeConstructor("FreeCamera", (name, scene) => {
    return () => new UniversalCamera(name, Vector3.Zero(), scene);
  });
  Camera._CreateDefaultParsedCamera = (name, scene) => {
    return new UniversalCamera(name, Vector3.Zero(), scene);
  };
}
RegisterUniversalCamera();
class BackgroundMaterialDefinesBase extends MaterialDefines {
}
class BackgroundMaterialDefines extends ImageProcessingDefinesMixin(BackgroundMaterialDefinesBase) {
  /**
   * Constructor of the defines.
   */
  constructor() {
    super();
    this.DIFFUSE = false;
    this.DIFFUSEDIRECTUV = 0;
    this.GAMMADIFFUSE = false;
    this.DIFFUSEHASALPHA = false;
    this.OPACITYFRESNEL = false;
    this.REFLECTIONBLUR = false;
    this.REFLECTIONFRESNEL = false;
    this.REFLECTIONFALLOFF = false;
    this.TEXTURELODSUPPORT = false;
    this.PREMULTIPLYALPHA = false;
    this.USERGBCOLOR = false;
    this.USEHIGHLIGHTANDSHADOWCOLORS = false;
    this.BACKMAT_SHADOWONLY = false;
    this.NOISE = false;
    this.REFLECTIONBGR = false;
    this.PROJECTED_GROUND = false;
    this.REFLECTION = false;
    this.REFLECTIONMAP_3D = false;
    this.REFLECTIONMAP_SPHERICAL = false;
    this.REFLECTIONMAP_PLANAR = false;
    this.REFLECTIONMAP_CUBIC = false;
    this.REFLECTIONMAP_PROJECTION = false;
    this.REFLECTIONMAP_SKYBOX = false;
    this.REFLECTIONMAP_EXPLICIT = false;
    this.REFLECTIONMAP_EQUIRECTANGULAR = false;
    this.REFLECTIONMAP_EQUIRECTANGULAR_FIXED = false;
    this.REFLECTIONMAP_MIRROREDEQUIRECTANGULAR_FIXED = false;
    this.INVERTCUBICMAP = false;
    this.REFLECTIONMAP_OPPOSITEZ = false;
    this.LODINREFLECTIONALPHA = false;
    this.GAMMAREFLECTION = false;
    this.RGBDREFLECTION = false;
    this.EQUIRECTANGULAR_RELFECTION_FOV = false;
    this.MAINUV1 = false;
    this.MAINUV2 = false;
    this.UV1 = false;
    this.UV2 = false;
    this.CLIPPLANE = false;
    this.CLIPPLANE2 = false;
    this.CLIPPLANE3 = false;
    this.CLIPPLANE4 = false;
    this.CLIPPLANE5 = false;
    this.CLIPPLANE6 = false;
    this.POINTSIZE = false;
    this.FOG = false;
    this.NORMAL = false;
    this.NUM_BONE_INFLUENCERS = 0;
    this.BonesPerMesh = 0;
    this.INSTANCES = false;
    this.SHADOWFLOAT = false;
    this.LOGARITHMICDEPTH = false;
    this.NONUNIFORMSCALING = false;
    this.ALPHATEST = false;
    this.rebuild();
  }
}
class BackgroundMaterialBase extends ImageProcessingMixin(PushMaterial) {
}
let BackgroundMaterial = (() => {
  var _a, _BackgroundMaterial_primaryColor_accessor_storage, _BackgroundMaterial_reflectionTexture_accessor_storage, _BackgroundMaterial_reflectionBlur_accessor_storage, _BackgroundMaterial_diffuseTexture_accessor_storage, _BackgroundMaterial_shadowLights_accessor_storage, _BackgroundMaterial_shadowLevel_accessor_storage, _BackgroundMaterial_sceneCenter_accessor_storage, _BackgroundMaterial_opacityFresnel_accessor_storage, _BackgroundMaterial_reflectionFresnel_accessor_storage, _BackgroundMaterial_reflectionFalloffDistance_accessor_storage, _BackgroundMaterial_reflectionAmount_accessor_storage, _BackgroundMaterial_reflectionReflectance0_accessor_storage, _BackgroundMaterial_reflectionReflectance90_accessor_storage, _BackgroundMaterial_useRGBColor_accessor_storage, _BackgroundMaterial_enableNoise_accessor_storage, _BackgroundMaterial_maxSimultaneousLights_accessor_storage, _BackgroundMaterial_shadowOnly_accessor_storage, _BackgroundMaterial_enableGroundProjection_accessor_storage;
  let _classSuper = BackgroundMaterialBase;
  let __primaryColor_decorators;
  let __primaryColor_initializers = [];
  let __primaryColor_extraInitializers = [];
  let _primaryColor_decorators;
  let _primaryColor_initializers = [];
  let _primaryColor_extraInitializers = [];
  let ___perceptualColor_decorators;
  let ___perceptualColor_initializers = [];
  let ___perceptualColor_extraInitializers = [];
  let __primaryColorShadowLevel_decorators;
  let __primaryColorShadowLevel_initializers = [];
  let __primaryColorShadowLevel_extraInitializers = [];
  let __primaryColorHighlightLevel_decorators;
  let __primaryColorHighlightLevel_initializers = [];
  let __primaryColorHighlightLevel_extraInitializers = [];
  let __reflectionTexture_decorators;
  let __reflectionTexture_initializers = [];
  let __reflectionTexture_extraInitializers = [];
  let _reflectionTexture_decorators;
  let _reflectionTexture_initializers = [];
  let _reflectionTexture_extraInitializers = [];
  let __reflectionBlur_decorators;
  let __reflectionBlur_initializers = [];
  let __reflectionBlur_extraInitializers = [];
  let _reflectionBlur_decorators;
  let _reflectionBlur_initializers = [];
  let _reflectionBlur_extraInitializers = [];
  let __diffuseTexture_decorators;
  let __diffuseTexture_initializers = [];
  let __diffuseTexture_extraInitializers = [];
  let _diffuseTexture_decorators;
  let _diffuseTexture_initializers = [];
  let _diffuseTexture_extraInitializers = [];
  let _shadowLights_decorators;
  let _shadowLights_initializers = [];
  let _shadowLights_extraInitializers = [];
  let __shadowLevel_decorators;
  let __shadowLevel_initializers = [];
  let __shadowLevel_extraInitializers = [];
  let _shadowLevel_decorators;
  let _shadowLevel_initializers = [];
  let _shadowLevel_extraInitializers = [];
  let __sceneCenter_decorators;
  let __sceneCenter_initializers = [];
  let __sceneCenter_extraInitializers = [];
  let _sceneCenter_decorators;
  let _sceneCenter_initializers = [];
  let _sceneCenter_extraInitializers = [];
  let __opacityFresnel_decorators;
  let __opacityFresnel_initializers = [];
  let __opacityFresnel_extraInitializers = [];
  let _opacityFresnel_decorators;
  let _opacityFresnel_initializers = [];
  let _opacityFresnel_extraInitializers = [];
  let __reflectionFresnel_decorators;
  let __reflectionFresnel_initializers = [];
  let __reflectionFresnel_extraInitializers = [];
  let _reflectionFresnel_decorators;
  let _reflectionFresnel_initializers = [];
  let _reflectionFresnel_extraInitializers = [];
  let __reflectionFalloffDistance_decorators;
  let __reflectionFalloffDistance_initializers = [];
  let __reflectionFalloffDistance_extraInitializers = [];
  let _reflectionFalloffDistance_decorators;
  let _reflectionFalloffDistance_initializers = [];
  let _reflectionFalloffDistance_extraInitializers = [];
  let __reflectionAmount_decorators;
  let __reflectionAmount_initializers = [];
  let __reflectionAmount_extraInitializers = [];
  let _reflectionAmount_decorators;
  let _reflectionAmount_initializers = [];
  let _reflectionAmount_extraInitializers = [];
  let __reflectionReflectance0_decorators;
  let __reflectionReflectance0_initializers = [];
  let __reflectionReflectance0_extraInitializers = [];
  let _reflectionReflectance0_decorators;
  let _reflectionReflectance0_initializers = [];
  let _reflectionReflectance0_extraInitializers = [];
  let __reflectionReflectance90_decorators;
  let __reflectionReflectance90_initializers = [];
  let __reflectionReflectance90_extraInitializers = [];
  let _reflectionReflectance90_decorators;
  let _reflectionReflectance90_initializers = [];
  let _reflectionReflectance90_extraInitializers = [];
  let __useRGBColor_decorators;
  let __useRGBColor_initializers = [];
  let __useRGBColor_extraInitializers = [];
  let _useRGBColor_decorators;
  let _useRGBColor_initializers = [];
  let _useRGBColor_extraInitializers = [];
  let __enableNoise_decorators;
  let __enableNoise_initializers = [];
  let __enableNoise_extraInitializers = [];
  let _enableNoise_decorators;
  let _enableNoise_initializers = [];
  let _enableNoise_extraInitializers = [];
  let __maxSimultaneousLights_decorators;
  let __maxSimultaneousLights_initializers = [];
  let __maxSimultaneousLights_extraInitializers = [];
  let _maxSimultaneousLights_decorators;
  let _maxSimultaneousLights_initializers = [];
  let _maxSimultaneousLights_extraInitializers = [];
  let __shadowOnly_decorators;
  let __shadowOnly_initializers = [];
  let __shadowOnly_extraInitializers = [];
  let _shadowOnly_decorators;
  let _shadowOnly_initializers = [];
  let _shadowOnly_extraInitializers = [];
  let _enableGroundProjection_decorators;
  let _enableGroundProjection_initializers = [];
  let _enableGroundProjection_extraInitializers = [];
  let _projectedGroundRadius_decorators;
  let _projectedGroundRadius_initializers = [];
  let _projectedGroundRadius_extraInitializers = [];
  let _projectedGroundHeight_decorators;
  let _projectedGroundHeight_initializers = [];
  let _projectedGroundHeight_extraInitializers = [];
  return _a = class BackgroundMaterial extends _classSuper {
    /**
     * Key light Color (multiply against the environment texture)
     */
    get primaryColor() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_primaryColor_accessor_storage, "f");
    }
    set primaryColor(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_primaryColor_accessor_storage, value, "f");
    }
    /**
     * Experimental Internal Use Only.
     *
     * Key light Color in "perceptual value" meaning the color you would like to see on screen.
     * This acts as a helper to set the primary color to a more "human friendly" value.
     * Conversion to linear space as well as exposure and tone mapping correction will be applied to keep the
     * output color as close as possible from the chosen value.
     * (This does not account for contrast color grading and color curves as they are considered post effect and not directly
     * part of lighting setup.)
     */
    get _perceptualColor() {
      return this.__perceptualColor;
    }
    set _perceptualColor(value) {
      this.__perceptualColor = value;
      this._computePrimaryColorFromPerceptualColor();
      this._markAllSubMeshesAsLightsDirty();
    }
    /**
     * Defines the level of the shadows (dark area of the reflection map) in order to help scaling the colors.
     * The color opposite to the primary color is used at the level chosen to define what the black area would look.
     */
    get primaryColorShadowLevel() {
      return this._primaryColorShadowLevel;
    }
    set primaryColorShadowLevel(value) {
      this._primaryColorShadowLevel = value;
      this._computePrimaryColors();
      this._markAllSubMeshesAsLightsDirty();
    }
    /**
     * Defines the level of the highlights (highlight area of the reflection map) in order to help scaling the colors.
     * The primary color is used at the level chosen to define what the white area would look.
     */
    get primaryColorHighlightLevel() {
      return this._primaryColorHighlightLevel;
    }
    set primaryColorHighlightLevel(value) {
      this._primaryColorHighlightLevel = value;
      this._computePrimaryColors();
      this._markAllSubMeshesAsLightsDirty();
    }
    /**
     * Reflection Texture used in the material.
     * Should be author in a specific way for the best result (refer to the documentation).
     */
    get reflectionTexture() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_reflectionTexture_accessor_storage, "f");
    }
    set reflectionTexture(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_reflectionTexture_accessor_storage, value, "f");
    }
    /**
     * Reflection Texture level of blur.
     *
     * Can be use to reuse an existing HDR Texture and target a specific LOD to prevent authoring the
     * texture twice.
     */
    get reflectionBlur() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_reflectionBlur_accessor_storage, "f");
    }
    set reflectionBlur(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_reflectionBlur_accessor_storage, value, "f");
    }
    /**
     * Diffuse Texture used in the material.
     * Should be author in a specific way for the best result (refer to the documentation).
     */
    get diffuseTexture() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_diffuseTexture_accessor_storage, "f");
    }
    set diffuseTexture(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_diffuseTexture_accessor_storage, value, "f");
    }
    /**
     * Specify the list of lights casting shadow on the material.
     * All scene shadow lights will be included if null.
     */
    get shadowLights() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_shadowLights_accessor_storage, "f");
    }
    set shadowLights(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_shadowLights_accessor_storage, value, "f");
    }
    /**
     * Helps adjusting the shadow to a softer level if required.
     * 0 means black shadows and 1 means no shadows.
     */
    get shadowLevel() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_shadowLevel_accessor_storage, "f");
    }
    set shadowLevel(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_shadowLevel_accessor_storage, value, "f");
    }
    /**
     * In case of opacity Fresnel or reflection falloff, this is use as a scene center.
     * It is usually zero but might be interesting to modify according to your setup.
     */
    get sceneCenter() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_sceneCenter_accessor_storage, "f");
    }
    set sceneCenter(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_sceneCenter_accessor_storage, value, "f");
    }
    /**
     * This helps specifying that the material is falling off to the sky box at grazing angle.
     * This helps ensuring a nice transition when the camera goes under the ground.
     */
    get opacityFresnel() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_opacityFresnel_accessor_storage, "f");
    }
    set opacityFresnel(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_opacityFresnel_accessor_storage, value, "f");
    }
    /**
     * This helps specifying that the material is falling off from diffuse to the reflection texture at grazing angle.
     * This helps adding a mirror texture on the ground.
     */
    get reflectionFresnel() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_reflectionFresnel_accessor_storage, "f");
    }
    set reflectionFresnel(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_reflectionFresnel_accessor_storage, value, "f");
    }
    /**
     * This helps specifying the falloff radius off the reflection texture from the sceneCenter.
     * This helps adding a nice falloff effect to the reflection if used as a mirror for instance.
     */
    get reflectionFalloffDistance() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_reflectionFalloffDistance_accessor_storage, "f");
    }
    set reflectionFalloffDistance(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_reflectionFalloffDistance_accessor_storage, value, "f");
    }
    /**
     * This specifies the weight of the reflection against the background in case of reflection Fresnel.
     */
    get reflectionAmount() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_reflectionAmount_accessor_storage, "f");
    }
    set reflectionAmount(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_reflectionAmount_accessor_storage, value, "f");
    }
    /**
     * This specifies the weight of the reflection at grazing angle.
     */
    get reflectionReflectance0() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_reflectionReflectance0_accessor_storage, "f");
    }
    set reflectionReflectance0(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_reflectionReflectance0_accessor_storage, value, "f");
    }
    /**
     * This specifies the weight of the reflection at a perpendicular point of view.
     */
    get reflectionReflectance90() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_reflectionReflectance90_accessor_storage, "f");
    }
    set reflectionReflectance90(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_reflectionReflectance90_accessor_storage, value, "f");
    }
    /**
     * Sets the reflection reflectance fresnel values according to the default standard
     * empirically know to work well :-)
     */
    set reflectionStandardFresnelWeight(value) {
      let reflectionWeight = value;
      if (reflectionWeight < 0.5) {
        reflectionWeight = reflectionWeight * 2;
        this.reflectionReflectance0 = _a.StandardReflectance0 * reflectionWeight;
        this.reflectionReflectance90 = _a.StandardReflectance90 * reflectionWeight;
      } else {
        reflectionWeight = reflectionWeight * 2 - 1;
        this.reflectionReflectance0 = _a.StandardReflectance0 + (1 - _a.StandardReflectance0) * reflectionWeight;
        this.reflectionReflectance90 = _a.StandardReflectance90 + (1 - _a.StandardReflectance90) * reflectionWeight;
      }
    }
    /**
     * Helps to directly use the maps channels instead of their level.
     */
    get useRGBColor() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_useRGBColor_accessor_storage, "f");
    }
    set useRGBColor(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_useRGBColor_accessor_storage, value, "f");
    }
    /**
     * This helps reducing the banding effect that could occur on the background.
     */
    get enableNoise() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_enableNoise_accessor_storage, "f");
    }
    set enableNoise(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_enableNoise_accessor_storage, value, "f");
    }
    /**
     * The current fov(field of view) multiplier, 0.0 - 2.0. Defaults to 1.0. Lower values "zoom in" and higher values "zoom out".
     * Best used when trying to implement visual zoom effects like fish-eye or binoculars while not adjusting camera fov.
     * Recommended to be keep at 1.0 except for special cases.
     */
    get fovMultiplier() {
      return this._fovMultiplier;
    }
    set fovMultiplier(value) {
      if (isNaN(value)) {
        value = 1;
      }
      this._fovMultiplier = Math.max(0, Math.min(2, value));
    }
    /**
     * Number of Simultaneous lights allowed on the material.
     */
    get maxSimultaneousLights() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_maxSimultaneousLights_accessor_storage, "f");
    }
    set maxSimultaneousLights(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_maxSimultaneousLights_accessor_storage, value, "f");
    }
    /**
     * Make the material only render shadows
     */
    get shadowOnly() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_shadowOnly_accessor_storage, "f");
    }
    set shadowOnly(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_shadowOnly_accessor_storage, value, "f");
    }
    /**
     * Enables the ground projection mode on the material.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/environment/skybox#ground-projection
     */
    get enableGroundProjection() {
      return __classPrivateFieldGet(this, _BackgroundMaterial_enableGroundProjection_accessor_storage, "f");
    }
    set enableGroundProjection(value) {
      __classPrivateFieldSet(this, _BackgroundMaterial_enableGroundProjection_accessor_storage, value, "f");
    }
    /**
     * Instantiates a Background Material in the given scene
     * @param name The friendly name of the material
     * @param scene The scene to add the material to
     * @param forceGLSL Use the GLSL code generation for the shader (even on WebGPU). Default is false
     */
    constructor(name, scene, forceGLSL = false) {
      super(name, scene, void 0, forceGLSL);
      this._primaryColor = __runInitializers(this, __primaryColor_initializers, void 0);
      _BackgroundMaterial_primaryColor_accessor_storage.set(this, (__runInitializers(this, __primaryColor_extraInitializers), __runInitializers(this, _primaryColor_initializers, Color3.White())));
      this.__perceptualColor = (__runInitializers(this, _primaryColor_extraInitializers), __runInitializers(this, ___perceptualColor_initializers, void 0));
      this._primaryColorShadowLevel = (__runInitializers(this, ___perceptualColor_extraInitializers), __runInitializers(this, __primaryColorShadowLevel_initializers, 0));
      this._primaryColorHighlightLevel = (__runInitializers(this, __primaryColorShadowLevel_extraInitializers), __runInitializers(this, __primaryColorHighlightLevel_initializers, 0));
      this._reflectionTexture = (__runInitializers(this, __primaryColorHighlightLevel_extraInitializers), __runInitializers(this, __reflectionTexture_initializers, void 0));
      _BackgroundMaterial_reflectionTexture_accessor_storage.set(this, (__runInitializers(this, __reflectionTexture_extraInitializers), __runInitializers(this, _reflectionTexture_initializers, null)));
      this._reflectionBlur = (__runInitializers(this, _reflectionTexture_extraInitializers), __runInitializers(this, __reflectionBlur_initializers, void 0));
      _BackgroundMaterial_reflectionBlur_accessor_storage.set(this, (__runInitializers(this, __reflectionBlur_extraInitializers), __runInitializers(this, _reflectionBlur_initializers, 0)));
      this._diffuseTexture = (__runInitializers(this, _reflectionBlur_extraInitializers), __runInitializers(this, __diffuseTexture_initializers, void 0));
      _BackgroundMaterial_diffuseTexture_accessor_storage.set(this, (__runInitializers(this, __diffuseTexture_extraInitializers), __runInitializers(this, _diffuseTexture_initializers, null)));
      this._shadowLights = (__runInitializers(this, _diffuseTexture_extraInitializers), null);
      _BackgroundMaterial_shadowLights_accessor_storage.set(this, __runInitializers(this, _shadowLights_initializers, null));
      this._shadowLevel = (__runInitializers(this, _shadowLights_extraInitializers), __runInitializers(this, __shadowLevel_initializers, void 0));
      _BackgroundMaterial_shadowLevel_accessor_storage.set(this, (__runInitializers(this, __shadowLevel_extraInitializers), __runInitializers(this, _shadowLevel_initializers, 0)));
      this._sceneCenter = (__runInitializers(this, _shadowLevel_extraInitializers), __runInitializers(this, __sceneCenter_initializers, void 0));
      _BackgroundMaterial_sceneCenter_accessor_storage.set(this, (__runInitializers(this, __sceneCenter_extraInitializers), __runInitializers(this, _sceneCenter_initializers, Vector3.Zero())));
      this._opacityFresnel = (__runInitializers(this, _sceneCenter_extraInitializers), __runInitializers(this, __opacityFresnel_initializers, void 0));
      _BackgroundMaterial_opacityFresnel_accessor_storage.set(this, (__runInitializers(this, __opacityFresnel_extraInitializers), __runInitializers(this, _opacityFresnel_initializers, true)));
      this._reflectionFresnel = (__runInitializers(this, _opacityFresnel_extraInitializers), __runInitializers(this, __reflectionFresnel_initializers, void 0));
      _BackgroundMaterial_reflectionFresnel_accessor_storage.set(this, (__runInitializers(this, __reflectionFresnel_extraInitializers), __runInitializers(this, _reflectionFresnel_initializers, false)));
      this._reflectionFalloffDistance = (__runInitializers(this, _reflectionFresnel_extraInitializers), __runInitializers(this, __reflectionFalloffDistance_initializers, void 0));
      _BackgroundMaterial_reflectionFalloffDistance_accessor_storage.set(this, (__runInitializers(this, __reflectionFalloffDistance_extraInitializers), __runInitializers(this, _reflectionFalloffDistance_initializers, 0)));
      this._reflectionAmount = (__runInitializers(this, _reflectionFalloffDistance_extraInitializers), __runInitializers(this, __reflectionAmount_initializers, void 0));
      _BackgroundMaterial_reflectionAmount_accessor_storage.set(this, (__runInitializers(this, __reflectionAmount_extraInitializers), __runInitializers(this, _reflectionAmount_initializers, 1)));
      this._reflectionReflectance0 = (__runInitializers(this, _reflectionAmount_extraInitializers), __runInitializers(this, __reflectionReflectance0_initializers, void 0));
      _BackgroundMaterial_reflectionReflectance0_accessor_storage.set(this, (__runInitializers(this, __reflectionReflectance0_extraInitializers), __runInitializers(this, _reflectionReflectance0_initializers, 0.05)));
      this._reflectionReflectance90 = (__runInitializers(this, _reflectionReflectance0_extraInitializers), __runInitializers(this, __reflectionReflectance90_initializers, void 0));
      _BackgroundMaterial_reflectionReflectance90_accessor_storage.set(this, (__runInitializers(this, __reflectionReflectance90_extraInitializers), __runInitializers(this, _reflectionReflectance90_initializers, 0.5)));
      this._useRGBColor = (__runInitializers(this, _reflectionReflectance90_extraInitializers), __runInitializers(this, __useRGBColor_initializers, void 0));
      _BackgroundMaterial_useRGBColor_accessor_storage.set(this, (__runInitializers(this, __useRGBColor_extraInitializers), __runInitializers(this, _useRGBColor_initializers, true)));
      this._enableNoise = (__runInitializers(this, _useRGBColor_extraInitializers), __runInitializers(this, __enableNoise_initializers, void 0));
      _BackgroundMaterial_enableNoise_accessor_storage.set(this, (__runInitializers(this, __enableNoise_extraInitializers), __runInitializers(this, _enableNoise_initializers, false)));
      this._fovMultiplier = (__runInitializers(this, _enableNoise_extraInitializers), 1);
      this.useEquirectangularFOV = false;
      this._maxSimultaneousLights = __runInitializers(this, __maxSimultaneousLights_initializers, 4);
      _BackgroundMaterial_maxSimultaneousLights_accessor_storage.set(this, (__runInitializers(this, __maxSimultaneousLights_extraInitializers), __runInitializers(this, _maxSimultaneousLights_initializers, 4)));
      this._shadowOnly = (__runInitializers(this, _maxSimultaneousLights_extraInitializers), __runInitializers(this, __shadowOnly_initializers, false));
      _BackgroundMaterial_shadowOnly_accessor_storage.set(this, (__runInitializers(this, __shadowOnly_extraInitializers), __runInitializers(this, _shadowOnly_initializers, false)));
      this.switchToBGR = (__runInitializers(this, _shadowOnly_extraInitializers), false);
      this._enableGroundProjection = false;
      _BackgroundMaterial_enableGroundProjection_accessor_storage.set(this, __runInitializers(this, _enableGroundProjection_initializers, false));
      this.projectedGroundRadius = (__runInitializers(this, _enableGroundProjection_extraInitializers), __runInitializers(this, _projectedGroundRadius_initializers, 1e3));
      this.projectedGroundHeight = (__runInitializers(this, _projectedGroundRadius_extraInitializers), __runInitializers(this, _projectedGroundHeight_initializers, 10));
      this._renderTargets = (__runInitializers(this, _projectedGroundHeight_extraInitializers), new SmartArray(16));
      this._reflectionControls = Vector4.Zero();
      this._white = Color3.White();
      this._primaryShadowColor = Color3.Black();
      this._primaryHighlightColor = Color3.Black();
      this._attachImageProcessingConfiguration(null);
      this.getRenderTargetTextures = () => {
        this._renderTargets.reset();
        if (this._diffuseTexture && this._diffuseTexture.isRenderTarget) {
          this._renderTargets.push(this._diffuseTexture);
        }
        if (this._reflectionTexture && this._reflectionTexture.isRenderTarget) {
          this._renderTargets.push(this._reflectionTexture);
        }
        return this._renderTargets;
      };
    }
    /**
     * Gets a boolean indicating that current material needs to register RTT
     */
    get hasRenderTargetTextures() {
      if (this._diffuseTexture && this._diffuseTexture.isRenderTarget) {
        return true;
      }
      if (this._reflectionTexture && this._reflectionTexture.isRenderTarget) {
        return true;
      }
      return false;
    }
    /**
     * The entire material has been created in order to prevent overdraw.
     * @returns false
     */
    needAlphaTesting() {
      return true;
    }
    /**
     * The entire material has been created in order to prevent overdraw.
     * @returns true if blending is enable
     */
    needAlphaBlending() {
      return this.alpha < 1 || this._diffuseTexture != null && this._diffuseTexture.hasAlpha || this._shadowOnly;
    }
    /**
     * Checks whether the material is ready to be rendered for a given mesh.
     * @param mesh The mesh to render
     * @param subMesh The submesh to check against
     * @param useInstances Specify wether or not the material is used with instances
     * @returns true if all the dependencies are ready (Textures, Effects...)
     */
    isReadyForSubMesh(mesh, subMesh, useInstances = false) {
      const drawWrapper = subMesh._drawWrapper;
      if (drawWrapper.effect && this.isFrozen) {
        if (drawWrapper._wasPreviouslyReady && drawWrapper._wasPreviouslyUsingInstances === useInstances) {
          return true;
        }
      }
      if (!subMesh.materialDefines) {
        subMesh.materialDefines = new BackgroundMaterialDefines();
      }
      const scene = this.getScene();
      const defines = subMesh.materialDefines;
      if (this._isReadyForSubMesh(subMesh)) {
        return true;
      }
      const engine = scene.getEngine();
      PrepareDefinesForLights(scene, mesh, defines, false, this._maxSimultaneousLights);
      defines._needNormals = true;
      if (!AreLightsTexturesReady(scene, mesh, this._maxSimultaneousLights)) {
        return false;
      }
      PrepareDefinesForMultiview(scene, defines);
      if (defines._areTexturesDirty) {
        defines._needUVs = false;
        if (scene.texturesEnabled) {
          if (scene.getEngine().getCaps().textureLOD) {
            defines.TEXTURELODSUPPORT = true;
          }
          if (this._diffuseTexture && MaterialFlags.DiffuseTextureEnabled) {
            if (!this._diffuseTexture.isReadyOrNotBlocking()) {
              return false;
            }
            PrepareDefinesForMergedUV(this._diffuseTexture, defines, "DIFFUSE");
            defines.DIFFUSEHASALPHA = this._diffuseTexture.hasAlpha;
            defines.GAMMADIFFUSE = this._diffuseTexture.gammaSpace;
            defines.OPACITYFRESNEL = this._opacityFresnel;
          } else {
            defines.DIFFUSE = false;
            defines.DIFFUSEDIRECTUV = 0;
            defines.DIFFUSEHASALPHA = false;
            defines.GAMMADIFFUSE = false;
            defines.OPACITYFRESNEL = false;
          }
          const reflectionTexture = this._reflectionTexture;
          PrepareDefinesForIBL(scene, reflectionTexture, defines);
          if (reflectionTexture && MaterialFlags.ReflectionTextureEnabled) {
            if (!reflectionTexture.isReadyOrNotBlocking()) {
              return false;
            }
            defines.EQUIRECTANGULAR_RELFECTION_FOV = this.useEquirectangularFOV;
            defines.REFLECTIONBGR = this.switchToBGR;
            defines.REFLECTIONBLUR = this._reflectionBlur > 0;
            if (this.reflectionFresnel) {
              defines.REFLECTIONFRESNEL = true;
              defines.REFLECTIONFALLOFF = this.reflectionFalloffDistance > 0;
              this._reflectionControls.x = this.reflectionAmount;
              this._reflectionControls.y = this.reflectionReflectance0;
              this._reflectionControls.z = this.reflectionReflectance90;
              this._reflectionControls.w = 1 / this.reflectionFalloffDistance;
            } else {
              defines.REFLECTIONFRESNEL = false;
              defines.REFLECTIONFALLOFF = false;
            }
          } else {
            defines.REFLECTIONFRESNEL = false;
            defines.REFLECTIONFALLOFF = false;
            defines.REFLECTIONBLUR = false;
          }
        }
        defines.PREMULTIPLYALPHA = this.alphaMode === 7 || this.alphaMode === 8;
        defines.USERGBCOLOR = this._useRGBColor;
        defines.NOISE = this._enableNoise;
      }
      if (defines._areLightsDirty) {
        defines.USEHIGHLIGHTANDSHADOWCOLORS = !this._useRGBColor && (this._primaryColorShadowLevel !== 0 || this._primaryColorHighlightLevel !== 0);
        defines.BACKMAT_SHADOWONLY = this._shadowOnly;
      }
      if (defines._areImageProcessingDirty && this._imageProcessingConfiguration) {
        if (!this._imageProcessingConfiguration.isReady()) {
          return false;
        }
        this._imageProcessingConfiguration.prepareDefines(defines);
      }
      if (defines._areMiscDirty) {
        if (defines.REFLECTIONMAP_3D && this._enableGroundProjection) {
          defines.PROJECTED_GROUND = true;
          defines.REFLECTIONMAP_SKYBOX = true;
        } else {
          defines.PROJECTED_GROUND = false;
        }
      }
      PrepareDefinesForMisc(mesh, scene, this._useLogarithmicDepth, this.pointsCloud, this.fogEnabled, this.needAlphaTestingForMesh(mesh), defines, void 0, void 0, void 0, this._isVertexOutputInvariant);
      PrepareDefinesForFrameBoundValues(scene, engine, this, defines, useInstances, null, subMesh.getRenderingMesh().hasThinInstances);
      if (PrepareDefinesForAttributes(mesh, defines, false, true, false)) {
        if (mesh) {
          if (!scene.getEngine().getCaps().standardDerivatives && !mesh.isVerticesDataPresent(VertexBuffer.NormalKind)) {
            mesh.createNormals(true);
            Logger.Warn("BackgroundMaterial: Normals have been created for the mesh: " + mesh.name);
          }
        }
      }
      if (defines.isDirty) {
        defines.markAsProcessed();
        scene.resetCachedMaterial();
        const fallbacks = new EffectFallbacks();
        if (defines.FOG) {
          fallbacks.addFallback(0, "FOG");
        }
        if (defines.POINTSIZE) {
          fallbacks.addFallback(1, "POINTSIZE");
        }
        if (defines.MULTIVIEW) {
          fallbacks.addFallback(0, "MULTIVIEW");
        }
        HandleFallbacksForShadows(defines, fallbacks, this._maxSimultaneousLights);
        const attribs = [VertexBuffer.PositionKind];
        if (defines.NORMAL) {
          attribs.push(VertexBuffer.NormalKind);
        }
        if (defines.UV1) {
          attribs.push(VertexBuffer.UVKind);
        }
        if (defines.UV2) {
          attribs.push(VertexBuffer.UV2Kind);
        }
        PrepareAttributesForBones(attribs, mesh, defines, fallbacks);
        PrepareAttributesForInstances(attribs, defines);
        const uniforms = [
          "world",
          "view",
          "viewProjection",
          "vEyePosition",
          "vLightsType",
          "vFogInfos",
          "vFogColor",
          "pointSize",
          "mBones",
          "vPrimaryColor",
          "vPrimaryColorShadow",
          "fFovMultiplier",
          "shadowLevel",
          "alpha",
          "vBackgroundCenter",
          "vReflectionControl",
          "vDiffuseInfos",
          "diffuseMatrix",
          "projectedGroundInfos",
          "logarithmicDepthConstant"
        ];
        AddClipPlaneUniforms(uniforms);
        const samplers = ["diffuseSampler"];
        PrepareUniformsAndSamplersForIBL(uniforms, samplers, false);
        const uniformBuffers = ["Material", "Scene"];
        if (ImageProcessingConfiguration) {
          ImageProcessingConfiguration.PrepareUniforms(uniforms, defines);
          ImageProcessingConfiguration.PrepareSamplers(samplers, defines);
        }
        PrepareUniformsAndSamplersList({
          uniformsNames: uniforms,
          uniformBuffersNames: uniformBuffers,
          samplers,
          defines,
          maxSimultaneousLights: this._maxSimultaneousLights,
          shaderLanguage: this._shaderLanguage
        });
        const join = defines.toString();
        const effect = scene.getEngine().createEffect("background", {
          attributes: attribs,
          uniformsNames: uniforms,
          uniformBuffersNames: uniformBuffers,
          samplers,
          defines: join,
          fallbacks,
          onCompiled: this.onCompiled,
          onError: this.onError,
          indexParameters: { maxSimultaneousLights: this._maxSimultaneousLights },
          shaderLanguage: this._shaderLanguage,
          extraInitializationsAsync: _a._ShaderLoader.getLoadCallback(this._shaderLanguage)
        }, engine);
        subMesh.setEffect(effect, defines, this._materialContext);
        this.buildUniformLayout();
      }
      if (!subMesh.effect || !subMesh.effect.isReady()) {
        return false;
      }
      defines._renderId = scene.getRenderId();
      drawWrapper._wasPreviouslyReady = true;
      drawWrapper._wasPreviouslyUsingInstances = useInstances;
      this._checkScenePerformancePriority();
      return true;
    }
    /**
     * Compute the primary color according to the chosen perceptual color.
     */
    _computePrimaryColorFromPerceptualColor() {
      if (!this.__perceptualColor) {
        return;
      }
      this._primaryColor.copyFrom(this.__perceptualColor);
      this._primaryColor.toLinearSpaceToRef(this._primaryColor, this.getScene().getEngine().useExactSrgbConversions);
      if (this._imageProcessingConfiguration) {
        this._primaryColor.scaleToRef(1 / this._imageProcessingConfiguration.exposure, this._primaryColor);
      }
      this._computePrimaryColors();
    }
    /**
     * Compute the highlights and shadow colors according to their chosen levels.
     */
    _computePrimaryColors() {
      if (this._primaryColorShadowLevel === 0 && this._primaryColorHighlightLevel === 0) {
        return;
      }
      this._primaryColor.scaleToRef(this._primaryColorShadowLevel, this._primaryShadowColor);
      this._primaryColor.subtractToRef(this._primaryShadowColor, this._primaryShadowColor);
      this._white.subtractToRef(this._primaryColor, this._primaryHighlightColor);
      this._primaryHighlightColor.scaleToRef(this._primaryColorHighlightLevel, this._primaryHighlightColor);
      this._primaryColor.addToRef(this._primaryHighlightColor, this._primaryHighlightColor);
    }
    /**
     * Build the uniform buffer used in the material.
     */
    buildUniformLayout() {
      this._uniformBuffer.addUniform("vPrimaryColor", 4);
      this._uniformBuffer.addUniform("vPrimaryColorShadow", 4);
      this._uniformBuffer.addUniform("vDiffuseInfos", 2);
      this._uniformBuffer.addUniform("diffuseMatrix", 16);
      this._uniformBuffer.addUniform("fFovMultiplier", 1);
      this._uniformBuffer.addUniform("pointSize", 1);
      this._uniformBuffer.addUniform("shadowLevel", 1);
      this._uniformBuffer.addUniform("alpha", 1);
      this._uniformBuffer.addUniform("vBackgroundCenter", 3);
      this._uniformBuffer.addUniform("vReflectionControl", 4);
      this._uniformBuffer.addUniform("projectedGroundInfos", 2);
      PrepareUniformLayoutForIBL(this._uniformBuffer, true, false, false);
      this._uniformBuffer.create();
    }
    /**
     * Unbind the material.
     */
    unbind() {
      if (this._diffuseTexture && this._diffuseTexture.isRenderTarget) {
        this._uniformBuffer.setTexture("diffuseSampler", null);
      }
      if (this._reflectionTexture && this._reflectionTexture.isRenderTarget) {
        this._uniformBuffer.setTexture("reflectionSampler", null);
      }
      super.unbind();
    }
    /**
     * Bind only the world matrix to the material.
     * @param world The world matrix to bind.
     */
    bindOnlyWorldMatrix(world) {
      this._activeEffect.setMatrix("world", world);
    }
    /**
     * Bind the material for a dedicated submesh (every used meshes will be considered opaque).
     * @param world The world matrix to bind.
     * @param mesh the mesh to bind for.
     * @param subMesh The submesh to bind for.
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
      this.bindOnlyWorldMatrix(world);
      BindBonesParameters(mesh, this._activeEffect);
      const mustRebind = this._mustRebind(scene, effect, subMesh, mesh.visibility);
      const needToAlwaysBindUniformBuffers = scene.getEngine()._features.needToAlwaysBindUniformBuffers;
      if (mustRebind) {
        this._uniformBuffer.bindToEffect(effect, "Material");
        this.bindViewProjection(effect);
        const reflectionTexture = this._reflectionTexture;
        if (!this._uniformBuffer.useUbo || !this.isFrozen || !this._uniformBuffer.isSync || subMesh._drawWrapper._forceRebindOnNextCall) {
          if (scene.texturesEnabled) {
            if (this._diffuseTexture && MaterialFlags.DiffuseTextureEnabled) {
              this._uniformBuffer.updateFloat2("vDiffuseInfos", this._diffuseTexture.coordinatesIndex, this._diffuseTexture.level);
              BindTextureMatrix(this._diffuseTexture, this._uniformBuffer, "diffuse");
            }
            BindIBLParameters(scene, defines, this._uniformBuffer, Color3.White(), reflectionTexture, false, true, false, false, false, false, this._reflectionBlur);
          }
          if (this.shadowLevel > 0) {
            this._uniformBuffer.updateFloat("shadowLevel", this.shadowLevel);
          }
          this._uniformBuffer.updateFloat("alpha", this.alpha);
          if (this.pointsCloud) {
            this._uniformBuffer.updateFloat("pointSize", this.pointSize);
          }
          if (defines.USEHIGHLIGHTANDSHADOWCOLORS) {
            this._uniformBuffer.updateColor4("vPrimaryColor", this._primaryHighlightColor, 1);
            this._uniformBuffer.updateColor4("vPrimaryColorShadow", this._primaryShadowColor, 1);
          } else {
            this._uniformBuffer.updateColor4("vPrimaryColor", this._primaryColor, 1);
          }
        }
        this._uniformBuffer.updateFloat("fFovMultiplier", this._fovMultiplier);
        if (defines.REFLECTIONFRESNEL) {
          this._uniformBuffer.updateFloat4("vReflectionControl", this._reflectionControls.x, this._reflectionControls.y, this._reflectionControls.z, this._reflectionControls.w);
        }
        if (defines.REFLECTIONFRESNEL && defines.REFLECTIONFALLOFF || defines.OPACITYFRESNEL) {
          const center = TmpVectors.Vector3[0].copyFrom(this.sceneCenter).subtractInPlace(scene.floatingOriginOffset);
          this._uniformBuffer.updateFloat3("vBackgroundCenter", center.x, center.y, center.z);
        }
        if (scene.texturesEnabled) {
          if (this._diffuseTexture && MaterialFlags.DiffuseTextureEnabled) {
            this._uniformBuffer.setTexture("diffuseSampler", this._diffuseTexture);
          }
          if (reflectionTexture && MaterialFlags.ReflectionTextureEnabled) {
            BindIBLSamplers(scene, defines, this._uniformBuffer, reflectionTexture);
          }
          if (defines.PROJECTED_GROUND) {
            this._uniformBuffer.updateFloat2("projectedGroundInfos", this.projectedGroundRadius, this.projectedGroundHeight);
          }
        }
        BindClipPlane(this._activeEffect, this, scene);
        scene.bindEyePosition(effect);
      } else if (needToAlwaysBindUniformBuffers) {
        this._uniformBuffer.bindToEffect(effect, "Material");
        this._needToBindSceneUbo = true;
      }
      if ((mustRebind || !this.isFrozen || needToAlwaysBindUniformBuffers) && scene.lightsEnabled) {
        BindLights(scene, mesh, this._activeEffect, defines, this._maxSimultaneousLights);
      }
      if (mustRebind || !this.isFrozen) {
        this.bindView(effect);
        BindFogParameters(scene, mesh, this._activeEffect, true);
        if (this._useLogarithmicDepth) {
          BindLogDepth(defines, effect, scene);
        }
        if (this._imageProcessingConfiguration) {
          this._imageProcessingConfiguration.bind(this._activeEffect);
        }
      }
      this._afterBind(mesh, this._activeEffect, subMesh);
      this._uniformBuffer.update();
    }
    /**
     * Checks to see if a texture is used in the material.
     * @param texture - Base texture to use.
     * @returns - Boolean specifying if a texture is used in the material.
     */
    hasTexture(texture) {
      if (super.hasTexture(texture)) {
        return true;
      }
      if (this._reflectionTexture === texture) {
        return true;
      }
      if (this._diffuseTexture === texture) {
        return true;
      }
      return false;
    }
    /**
     * Dispose the material.
     * @param forceDisposeEffect Force disposal of the associated effect.
     * @param forceDisposeTextures Force disposal of the associated textures.
     */
    dispose(forceDisposeEffect = false, forceDisposeTextures = false) {
      if (forceDisposeTextures) {
        if (this.diffuseTexture) {
          this.diffuseTexture.dispose();
        }
        if (this.reflectionTexture) {
          this.reflectionTexture.dispose();
        }
      }
      this._renderTargets.dispose();
      if (this._imageProcessingConfiguration && this._imageProcessingObserver) {
        this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
      }
      super.dispose(forceDisposeEffect);
    }
    /**
     * Clones the material.
     * @param name The cloned name.
     * @returns The cloned material.
     */
    clone(name) {
      return SerializationHelper.Clone(() => new _a(name, this.getScene()), this);
    }
    /**
     * Serializes the current material to its JSON representation.
     * @returns The JSON representation.
     */
    serialize() {
      const serializationObject = super.serialize();
      serializationObject.customType = "BABYLON.BackgroundMaterial";
      return serializationObject;
    }
    /**
     * Gets the class name of the material
     * @returns "BackgroundMaterial"
     */
    getClassName() {
      return "BackgroundMaterial";
    }
    /**
     * Parse a JSON input to create back a background material.
     * @param source The JSON data to parse
     * @param scene The scene to create the parsed material in
     * @param rootUrl The root url of the assets the material depends upon
     * @returns the instantiated BackgroundMaterial.
     */
    static Parse(source, scene, rootUrl) {
      return SerializationHelper.Parse(() => new _a(source.name, scene), source, scene, rootUrl);
    }
  }, _BackgroundMaterial_primaryColor_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_reflectionTexture_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_reflectionBlur_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_diffuseTexture_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_shadowLights_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_shadowLevel_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_sceneCenter_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_opacityFresnel_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_reflectionFresnel_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_reflectionFalloffDistance_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_reflectionAmount_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_reflectionReflectance0_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_reflectionReflectance90_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_useRGBColor_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_enableNoise_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_maxSimultaneousLights_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_shadowOnly_accessor_storage = /* @__PURE__ */ new WeakMap(), _BackgroundMaterial_enableGroundProjection_accessor_storage = /* @__PURE__ */ new WeakMap(), (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    __primaryColor_decorators = [serializeAsColor3()];
    _primaryColor_decorators = [expandToProperty("_markAllSubMeshesAsLightsDirty")];
    ___perceptualColor_decorators = [serializeAsColor3()];
    __primaryColorShadowLevel_decorators = [serialize()];
    __primaryColorHighlightLevel_decorators = [serialize()];
    __reflectionTexture_decorators = [serializeAsTexture()];
    _reflectionTexture_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __reflectionBlur_decorators = [serialize()];
    _reflectionBlur_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __diffuseTexture_decorators = [serializeAsTexture()];
    _diffuseTexture_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    _shadowLights_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __shadowLevel_decorators = [serialize()];
    _shadowLevel_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __sceneCenter_decorators = [serializeAsVector3()];
    _sceneCenter_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __opacityFresnel_decorators = [serialize()];
    _opacityFresnel_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __reflectionFresnel_decorators = [serialize()];
    _reflectionFresnel_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __reflectionFalloffDistance_decorators = [serialize()];
    _reflectionFalloffDistance_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __reflectionAmount_decorators = [serialize()];
    _reflectionAmount_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __reflectionReflectance0_decorators = [serialize()];
    _reflectionReflectance0_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __reflectionReflectance90_decorators = [serialize()];
    _reflectionReflectance90_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __useRGBColor_decorators = [serialize()];
    _useRGBColor_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __enableNoise_decorators = [serialize()];
    _enableNoise_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __maxSimultaneousLights_decorators = [serialize()];
    _maxSimultaneousLights_decorators = [expandToProperty("_markAllSubMeshesAsTexturesDirty")];
    __shadowOnly_decorators = [serialize()];
    _shadowOnly_decorators = [expandToProperty("_markAllSubMeshesAsLightsDirty")];
    _enableGroundProjection_decorators = [serialize(), expandToProperty("_markAllSubMeshesAsMiscDirty")];
    _projectedGroundRadius_decorators = [serialize()];
    _projectedGroundHeight_decorators = [serialize()];
    __esDecorate(_a, null, _primaryColor_decorators, { kind: "accessor", name: "primaryColor", static: false, private: false, access: { has: (obj) => "primaryColor" in obj, get: (obj) => obj.primaryColor, set: (obj, value) => {
      obj.primaryColor = value;
    } }, metadata: _metadata }, _primaryColor_initializers, _primaryColor_extraInitializers);
    __esDecorate(_a, null, _reflectionTexture_decorators, { kind: "accessor", name: "reflectionTexture", static: false, private: false, access: { has: (obj) => "reflectionTexture" in obj, get: (obj) => obj.reflectionTexture, set: (obj, value) => {
      obj.reflectionTexture = value;
    } }, metadata: _metadata }, _reflectionTexture_initializers, _reflectionTexture_extraInitializers);
    __esDecorate(_a, null, _reflectionBlur_decorators, { kind: "accessor", name: "reflectionBlur", static: false, private: false, access: { has: (obj) => "reflectionBlur" in obj, get: (obj) => obj.reflectionBlur, set: (obj, value) => {
      obj.reflectionBlur = value;
    } }, metadata: _metadata }, _reflectionBlur_initializers, _reflectionBlur_extraInitializers);
    __esDecorate(_a, null, _diffuseTexture_decorators, { kind: "accessor", name: "diffuseTexture", static: false, private: false, access: { has: (obj) => "diffuseTexture" in obj, get: (obj) => obj.diffuseTexture, set: (obj, value) => {
      obj.diffuseTexture = value;
    } }, metadata: _metadata }, _diffuseTexture_initializers, _diffuseTexture_extraInitializers);
    __esDecorate(_a, null, _shadowLights_decorators, { kind: "accessor", name: "shadowLights", static: false, private: false, access: { has: (obj) => "shadowLights" in obj, get: (obj) => obj.shadowLights, set: (obj, value) => {
      obj.shadowLights = value;
    } }, metadata: _metadata }, _shadowLights_initializers, _shadowLights_extraInitializers);
    __esDecorate(_a, null, _shadowLevel_decorators, { kind: "accessor", name: "shadowLevel", static: false, private: false, access: { has: (obj) => "shadowLevel" in obj, get: (obj) => obj.shadowLevel, set: (obj, value) => {
      obj.shadowLevel = value;
    } }, metadata: _metadata }, _shadowLevel_initializers, _shadowLevel_extraInitializers);
    __esDecorate(_a, null, _sceneCenter_decorators, { kind: "accessor", name: "sceneCenter", static: false, private: false, access: { has: (obj) => "sceneCenter" in obj, get: (obj) => obj.sceneCenter, set: (obj, value) => {
      obj.sceneCenter = value;
    } }, metadata: _metadata }, _sceneCenter_initializers, _sceneCenter_extraInitializers);
    __esDecorate(_a, null, _opacityFresnel_decorators, { kind: "accessor", name: "opacityFresnel", static: false, private: false, access: { has: (obj) => "opacityFresnel" in obj, get: (obj) => obj.opacityFresnel, set: (obj, value) => {
      obj.opacityFresnel = value;
    } }, metadata: _metadata }, _opacityFresnel_initializers, _opacityFresnel_extraInitializers);
    __esDecorate(_a, null, _reflectionFresnel_decorators, { kind: "accessor", name: "reflectionFresnel", static: false, private: false, access: { has: (obj) => "reflectionFresnel" in obj, get: (obj) => obj.reflectionFresnel, set: (obj, value) => {
      obj.reflectionFresnel = value;
    } }, metadata: _metadata }, _reflectionFresnel_initializers, _reflectionFresnel_extraInitializers);
    __esDecorate(_a, null, _reflectionFalloffDistance_decorators, { kind: "accessor", name: "reflectionFalloffDistance", static: false, private: false, access: { has: (obj) => "reflectionFalloffDistance" in obj, get: (obj) => obj.reflectionFalloffDistance, set: (obj, value) => {
      obj.reflectionFalloffDistance = value;
    } }, metadata: _metadata }, _reflectionFalloffDistance_initializers, _reflectionFalloffDistance_extraInitializers);
    __esDecorate(_a, null, _reflectionAmount_decorators, { kind: "accessor", name: "reflectionAmount", static: false, private: false, access: { has: (obj) => "reflectionAmount" in obj, get: (obj) => obj.reflectionAmount, set: (obj, value) => {
      obj.reflectionAmount = value;
    } }, metadata: _metadata }, _reflectionAmount_initializers, _reflectionAmount_extraInitializers);
    __esDecorate(_a, null, _reflectionReflectance0_decorators, { kind: "accessor", name: "reflectionReflectance0", static: false, private: false, access: { has: (obj) => "reflectionReflectance0" in obj, get: (obj) => obj.reflectionReflectance0, set: (obj, value) => {
      obj.reflectionReflectance0 = value;
    } }, metadata: _metadata }, _reflectionReflectance0_initializers, _reflectionReflectance0_extraInitializers);
    __esDecorate(_a, null, _reflectionReflectance90_decorators, { kind: "accessor", name: "reflectionReflectance90", static: false, private: false, access: { has: (obj) => "reflectionReflectance90" in obj, get: (obj) => obj.reflectionReflectance90, set: (obj, value) => {
      obj.reflectionReflectance90 = value;
    } }, metadata: _metadata }, _reflectionReflectance90_initializers, _reflectionReflectance90_extraInitializers);
    __esDecorate(_a, null, _useRGBColor_decorators, { kind: "accessor", name: "useRGBColor", static: false, private: false, access: { has: (obj) => "useRGBColor" in obj, get: (obj) => obj.useRGBColor, set: (obj, value) => {
      obj.useRGBColor = value;
    } }, metadata: _metadata }, _useRGBColor_initializers, _useRGBColor_extraInitializers);
    __esDecorate(_a, null, _enableNoise_decorators, { kind: "accessor", name: "enableNoise", static: false, private: false, access: { has: (obj) => "enableNoise" in obj, get: (obj) => obj.enableNoise, set: (obj, value) => {
      obj.enableNoise = value;
    } }, metadata: _metadata }, _enableNoise_initializers, _enableNoise_extraInitializers);
    __esDecorate(_a, null, _maxSimultaneousLights_decorators, { kind: "accessor", name: "maxSimultaneousLights", static: false, private: false, access: { has: (obj) => "maxSimultaneousLights" in obj, get: (obj) => obj.maxSimultaneousLights, set: (obj, value) => {
      obj.maxSimultaneousLights = value;
    } }, metadata: _metadata }, _maxSimultaneousLights_initializers, _maxSimultaneousLights_extraInitializers);
    __esDecorate(_a, null, _shadowOnly_decorators, { kind: "accessor", name: "shadowOnly", static: false, private: false, access: { has: (obj) => "shadowOnly" in obj, get: (obj) => obj.shadowOnly, set: (obj, value) => {
      obj.shadowOnly = value;
    } }, metadata: _metadata }, _shadowOnly_initializers, _shadowOnly_extraInitializers);
    __esDecorate(_a, null, _enableGroundProjection_decorators, { kind: "accessor", name: "enableGroundProjection", static: false, private: false, access: { has: (obj) => "enableGroundProjection" in obj, get: (obj) => obj.enableGroundProjection, set: (obj, value) => {
      obj.enableGroundProjection = value;
    } }, metadata: _metadata }, _enableGroundProjection_initializers, _enableGroundProjection_extraInitializers);
    __esDecorate(null, null, __primaryColor_decorators, { kind: "field", name: "_primaryColor", static: false, private: false, access: { has: (obj) => "_primaryColor" in obj, get: (obj) => obj._primaryColor, set: (obj, value) => {
      obj._primaryColor = value;
    } }, metadata: _metadata }, __primaryColor_initializers, __primaryColor_extraInitializers);
    __esDecorate(null, null, ___perceptualColor_decorators, { kind: "field", name: "__perceptualColor", static: false, private: false, access: { has: (obj) => "__perceptualColor" in obj, get: (obj) => obj.__perceptualColor, set: (obj, value) => {
      obj.__perceptualColor = value;
    } }, metadata: _metadata }, ___perceptualColor_initializers, ___perceptualColor_extraInitializers);
    __esDecorate(null, null, __primaryColorShadowLevel_decorators, { kind: "field", name: "_primaryColorShadowLevel", static: false, private: false, access: { has: (obj) => "_primaryColorShadowLevel" in obj, get: (obj) => obj._primaryColorShadowLevel, set: (obj, value) => {
      obj._primaryColorShadowLevel = value;
    } }, metadata: _metadata }, __primaryColorShadowLevel_initializers, __primaryColorShadowLevel_extraInitializers);
    __esDecorate(null, null, __primaryColorHighlightLevel_decorators, { kind: "field", name: "_primaryColorHighlightLevel", static: false, private: false, access: { has: (obj) => "_primaryColorHighlightLevel" in obj, get: (obj) => obj._primaryColorHighlightLevel, set: (obj, value) => {
      obj._primaryColorHighlightLevel = value;
    } }, metadata: _metadata }, __primaryColorHighlightLevel_initializers, __primaryColorHighlightLevel_extraInitializers);
    __esDecorate(null, null, __reflectionTexture_decorators, { kind: "field", name: "_reflectionTexture", static: false, private: false, access: { has: (obj) => "_reflectionTexture" in obj, get: (obj) => obj._reflectionTexture, set: (obj, value) => {
      obj._reflectionTexture = value;
    } }, metadata: _metadata }, __reflectionTexture_initializers, __reflectionTexture_extraInitializers);
    __esDecorate(null, null, __reflectionBlur_decorators, { kind: "field", name: "_reflectionBlur", static: false, private: false, access: { has: (obj) => "_reflectionBlur" in obj, get: (obj) => obj._reflectionBlur, set: (obj, value) => {
      obj._reflectionBlur = value;
    } }, metadata: _metadata }, __reflectionBlur_initializers, __reflectionBlur_extraInitializers);
    __esDecorate(null, null, __diffuseTexture_decorators, { kind: "field", name: "_diffuseTexture", static: false, private: false, access: { has: (obj) => "_diffuseTexture" in obj, get: (obj) => obj._diffuseTexture, set: (obj, value) => {
      obj._diffuseTexture = value;
    } }, metadata: _metadata }, __diffuseTexture_initializers, __diffuseTexture_extraInitializers);
    __esDecorate(null, null, __shadowLevel_decorators, { kind: "field", name: "_shadowLevel", static: false, private: false, access: { has: (obj) => "_shadowLevel" in obj, get: (obj) => obj._shadowLevel, set: (obj, value) => {
      obj._shadowLevel = value;
    } }, metadata: _metadata }, __shadowLevel_initializers, __shadowLevel_extraInitializers);
    __esDecorate(null, null, __sceneCenter_decorators, { kind: "field", name: "_sceneCenter", static: false, private: false, access: { has: (obj) => "_sceneCenter" in obj, get: (obj) => obj._sceneCenter, set: (obj, value) => {
      obj._sceneCenter = value;
    } }, metadata: _metadata }, __sceneCenter_initializers, __sceneCenter_extraInitializers);
    __esDecorate(null, null, __opacityFresnel_decorators, { kind: "field", name: "_opacityFresnel", static: false, private: false, access: { has: (obj) => "_opacityFresnel" in obj, get: (obj) => obj._opacityFresnel, set: (obj, value) => {
      obj._opacityFresnel = value;
    } }, metadata: _metadata }, __opacityFresnel_initializers, __opacityFresnel_extraInitializers);
    __esDecorate(null, null, __reflectionFresnel_decorators, { kind: "field", name: "_reflectionFresnel", static: false, private: false, access: { has: (obj) => "_reflectionFresnel" in obj, get: (obj) => obj._reflectionFresnel, set: (obj, value) => {
      obj._reflectionFresnel = value;
    } }, metadata: _metadata }, __reflectionFresnel_initializers, __reflectionFresnel_extraInitializers);
    __esDecorate(null, null, __reflectionFalloffDistance_decorators, { kind: "field", name: "_reflectionFalloffDistance", static: false, private: false, access: { has: (obj) => "_reflectionFalloffDistance" in obj, get: (obj) => obj._reflectionFalloffDistance, set: (obj, value) => {
      obj._reflectionFalloffDistance = value;
    } }, metadata: _metadata }, __reflectionFalloffDistance_initializers, __reflectionFalloffDistance_extraInitializers);
    __esDecorate(null, null, __reflectionAmount_decorators, { kind: "field", name: "_reflectionAmount", static: false, private: false, access: { has: (obj) => "_reflectionAmount" in obj, get: (obj) => obj._reflectionAmount, set: (obj, value) => {
      obj._reflectionAmount = value;
    } }, metadata: _metadata }, __reflectionAmount_initializers, __reflectionAmount_extraInitializers);
    __esDecorate(null, null, __reflectionReflectance0_decorators, { kind: "field", name: "_reflectionReflectance0", static: false, private: false, access: { has: (obj) => "_reflectionReflectance0" in obj, get: (obj) => obj._reflectionReflectance0, set: (obj, value) => {
      obj._reflectionReflectance0 = value;
    } }, metadata: _metadata }, __reflectionReflectance0_initializers, __reflectionReflectance0_extraInitializers);
    __esDecorate(null, null, __reflectionReflectance90_decorators, { kind: "field", name: "_reflectionReflectance90", static: false, private: false, access: { has: (obj) => "_reflectionReflectance90" in obj, get: (obj) => obj._reflectionReflectance90, set: (obj, value) => {
      obj._reflectionReflectance90 = value;
    } }, metadata: _metadata }, __reflectionReflectance90_initializers, __reflectionReflectance90_extraInitializers);
    __esDecorate(null, null, __useRGBColor_decorators, { kind: "field", name: "_useRGBColor", static: false, private: false, access: { has: (obj) => "_useRGBColor" in obj, get: (obj) => obj._useRGBColor, set: (obj, value) => {
      obj._useRGBColor = value;
    } }, metadata: _metadata }, __useRGBColor_initializers, __useRGBColor_extraInitializers);
    __esDecorate(null, null, __enableNoise_decorators, { kind: "field", name: "_enableNoise", static: false, private: false, access: { has: (obj) => "_enableNoise" in obj, get: (obj) => obj._enableNoise, set: (obj, value) => {
      obj._enableNoise = value;
    } }, metadata: _metadata }, __enableNoise_initializers, __enableNoise_extraInitializers);
    __esDecorate(null, null, __maxSimultaneousLights_decorators, { kind: "field", name: "_maxSimultaneousLights", static: false, private: false, access: { has: (obj) => "_maxSimultaneousLights" in obj, get: (obj) => obj._maxSimultaneousLights, set: (obj, value) => {
      obj._maxSimultaneousLights = value;
    } }, metadata: _metadata }, __maxSimultaneousLights_initializers, __maxSimultaneousLights_extraInitializers);
    __esDecorate(null, null, __shadowOnly_decorators, { kind: "field", name: "_shadowOnly", static: false, private: false, access: { has: (obj) => "_shadowOnly" in obj, get: (obj) => obj._shadowOnly, set: (obj, value) => {
      obj._shadowOnly = value;
    } }, metadata: _metadata }, __shadowOnly_initializers, __shadowOnly_extraInitializers);
    __esDecorate(null, null, _projectedGroundRadius_decorators, { kind: "field", name: "projectedGroundRadius", static: false, private: false, access: { has: (obj) => "projectedGroundRadius" in obj, get: (obj) => obj.projectedGroundRadius, set: (obj, value) => {
      obj.projectedGroundRadius = value;
    } }, metadata: _metadata }, _projectedGroundRadius_initializers, _projectedGroundRadius_extraInitializers);
    __esDecorate(null, null, _projectedGroundHeight_decorators, { kind: "field", name: "projectedGroundHeight", static: false, private: false, access: { has: (obj) => "projectedGroundHeight" in obj, get: (obj) => obj.projectedGroundHeight, set: (obj, value) => {
      obj.projectedGroundHeight = value;
    } }, metadata: _metadata }, _projectedGroundHeight_initializers, _projectedGroundHeight_extraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), /**
   * Standard reflectance value at parallel view angle.
   */
  _a.StandardReflectance0 = 0.05, /**
   * Standard reflectance value at grazing angle.
   */
  _a.StandardReflectance90 = 0.5, _a._ShaderLoader = new _ShaderImportLoader(() => [__vitePreload(() => import("./background.vertex-BSyGbpcj.js"), true ? __vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11]) : void 0), __vitePreload(() => import("./background.fragment-DriwRoN_.js"), true ? __vite__mapDeps([12,1,2,3,4,13,14,15,16,17,10,18,19,20,21]) : void 0)], () => [__vitePreload(() => import("./background.vertex-C5EKNzn9.js"), true ? __vite__mapDeps([22,1,23,24,25,26,27,28,29,30,31,32,33]) : void 0), __vitePreload(() => import("./background.fragment-DM1VJ3u5.js"), true ? __vite__mapDeps([34,1,23,24,25,35,36,37,38,39,32,40,41,42,43]) : void 0)]), _a;
})();
let _Registered = false;
function RegisterBackgroundMaterial() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterImageProcessingConfiguration();
  RegisterClass("BABYLON.BackgroundMaterial", BackgroundMaterial);
}
export {
  BackgroundMaterial as B,
  RegisterTouchCamera as R,
  UniversalCamera as U,
  RegisterBackgroundMaterial as a
};
