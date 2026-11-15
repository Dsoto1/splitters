import { T as TransformNode, G as Texture, O as Observable, h as Mesh, aE as Axis, V as Vector3, S as Scene, C as Color4, a as Color3, H as HemisphericLight, D as DirectionalLight, d as CreateGround, aB as PBRMaterial } from "./babylon-PnzH6wcM.js";
import { B as BackgroundMaterial, U as UniversalCamera } from "./backgroundMaterial.pure-BuLjZvgq.js";
import { S as ShadowGenerator, c as createPropNode, i as initPhysics, P as PhysicsWorld } from "./shadowGenerator-_IcnNyty.js";
import "./groundBuilder-BbO9y42p.js";
import { C as CreateLineSystem } from "./linesBuilder-6E0Gh92-.js";
import { C as CreateSphere } from "./sphereBuilder.pure-CT5peVwp.js";
import { EnvironmentVisuals } from "./environmentVisuals-DHOOYxSF.js";
import { aD as versioned, M as ModelLibrary } from "./index-BAsW2uYW.js";
import { b as ENV_RENDER } from "./envMaterials-BVmVluEo.js";
import { n as newMapDocument } from "./operations-Dkr39omZ.js";
import { e as environmentShapes } from "./scenarioDefs-BcDISE-R.js";
import "./rapier-BmnBVapV.js";
import "./settle-BDJE4VMF.js";
import "./vendor-BIr0ad6t.js";
import "./thinInstanceMesh.pure-BG4P9X5v.js";
import "./babylonFileParser.function-CbkFZ5Hm.js";
import "./shaderMaterial.pure-T5Xe2ebz.js";
import "./materialPluginBase-Dhlt5oKE.js";
import "./setPieceLibrary-B87Q0Jtb.js";
class TextureDome extends TransformNode {
  /**
   * Gets the texture being displayed on the sphere
   */
  get texture() {
    return this._texture;
  }
  /**
   * Sets the texture being displayed on the sphere
   */
  set texture(newTexture) {
    if (this._texture === newTexture) {
      return;
    }
    this._texture = newTexture;
    if (this._useDirectMapping) {
      this._texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      this._texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      this._material.diffuseTexture = this._texture;
    } else {
      this._texture.coordinatesMode = Texture.FIXED_EQUIRECTANGULAR_MIRRORED_MODE;
      this._texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      this._material.reflectionTexture = this._texture;
    }
    this._changeTextureMode(this._textureMode);
  }
  /**
   * Gets the mesh used for the dome.
   */
  get mesh() {
    return this._mesh;
  }
  /**
   * The current fov(field of view) multiplier, 0.0 - 2.0. Defaults to 1.0. Lower values "zoom in" and higher values "zoom out".
   * Also see the options.resolution property.
   */
  get fovMultiplier() {
    return this._material.fovMultiplier;
  }
  set fovMultiplier(value) {
    this._material.fovMultiplier = value;
  }
  /**
   * Gets or set the current texture mode for the texture. It can be:
   * * TextureDome.MODE_MONOSCOPIC : Define the texture source as a Monoscopic panoramic 360.
   * * TextureDome.MODE_TOPBOTTOM  : Define the texture source as a Stereoscopic TopBottom/OverUnder panoramic 360.
   * * TextureDome.MODE_SIDEBYSIDE : Define the texture source as a Stereoscopic Side by Side panoramic 360.
   */
  get textureMode() {
    return this._textureMode;
  }
  /**
   * Sets the current texture mode for the texture. It can be:
   * * TextureDome.MODE_MONOSCOPIC : Define the texture source as a Monoscopic panoramic 360.
   * * TextureDome.MODE_TOPBOTTOM  : Define the texture source as a Stereoscopic TopBottom/OverUnder panoramic 360.
   * * TextureDome.MODE_SIDEBYSIDE : Define the texture source as a Stereoscopic Side by Side panoramic 360.
   */
  set textureMode(value) {
    if (this._textureMode === value) {
      return;
    }
    this._changeTextureMode(value);
  }
  /**
   * Is it a 180 degrees dome (half dome) or 360 texture (full dome)
   */
  get halfDome() {
    return this._halfDome;
  }
  /**
   * Set the halfDome mode. If set, only the front (180 degrees) will be displayed and the back will be blacked out.
   */
  set halfDome(enabled) {
    this._halfDome = enabled;
    this._halfDomeMask.setEnabled(enabled);
    this._changeTextureMode(this._textureMode);
  }
  /**
   * Set the cross-eye mode. If set, images that can be seen when crossing eyes will render correctly
   */
  set crossEye(enabled) {
    this._crossEye = enabled;
    this._changeTextureMode(this._textureMode);
  }
  /**
   * Is it a cross-eye texture?
   */
  get crossEye() {
    return this._crossEye;
  }
  /**
   * The background material of this dome.
   */
  get material() {
    return this._material;
  }
  /**
   * Create an instance of this class and pass through the parameters to the relevant classes- Texture, StandardMaterial, and Mesh.
   * @param name Element's name, child elements will append suffixes for their own names.
   * @param textureUrlOrElement defines the url(s) or the (video) HTML element to use
   * @param options An object containing optional or exposed sub element properties
   * @param options.resolution
   * @param options.clickToPlay
   * @param options.autoPlay
   * @param options.loop
   * @param options.size
   * @param options.poster
   * @param options.faceForward
   * @param options.useDirectMapping
   * @param options.halfDomeMode
   * @param options.crossEyeMode
   * @param options.generateMipMaps
   * @param options.mesh
   * @param scene
   * @param onError
   */
  constructor(name, textureUrlOrElement, options, scene, onError = null) {
    super(name, scene);
    this.onError = onError;
    this._halfDome = false;
    this._crossEye = false;
    this._useDirectMapping = false;
    this._textureMode = TextureDome.MODE_MONOSCOPIC;
    this._onBeforeCameraRenderObserver = null;
    this.onLoadErrorObservable = new Observable();
    this.onLoadObservable = new Observable();
    scene = this.getScene();
    name = name || "textureDome";
    options.resolution = Math.abs(options.resolution) | 0 || 32;
    options.clickToPlay = Boolean(options.clickToPlay);
    options.autoPlay = options.autoPlay === void 0 ? true : Boolean(options.autoPlay);
    options.loop = options.loop === void 0 ? true : Boolean(options.loop);
    options.size = Math.abs(options.size) || (scene.activeCamera ? scene.activeCamera.maxZ * 0.48 : 1e3);
    if (options.useDirectMapping === void 0) {
      this._useDirectMapping = true;
    } else {
      this._useDirectMapping = options.useDirectMapping;
    }
    if (options.faceForward === void 0) {
      options.faceForward = true;
    }
    this._setReady(false);
    if (!options.mesh) {
      this._mesh = CreateSphere(name + "_mesh", { segments: options.resolution, diameter: options.size, updatable: false, sideOrientation: Mesh.BACKSIDE }, scene);
    } else {
      this._mesh = options.mesh;
    }
    const material = this._material = new BackgroundMaterial(name + "_material", scene);
    material.useEquirectangularFOV = true;
    material.fovMultiplier = 1;
    material.opacityFresnel = false;
    const texture = this._initTexture(textureUrlOrElement, scene, options);
    this.texture = texture;
    this._mesh.material = material;
    this._mesh.parent = this;
    this._halfDomeMask = CreateSphere("", { slice: 0.5, diameter: options.size * 0.98, segments: options.resolution * 2, sideOrientation: Mesh.BACKSIDE }, scene);
    this._halfDomeMask.rotate(Axis.X, -Math.PI / 2);
    this._halfDomeMask.parent = this._mesh;
    this._halfDome = !!options.halfDomeMode;
    this._halfDomeMask.setEnabled(this._halfDome);
    this._crossEye = !!options.crossEyeMode;
    this._texture.anisotropicFilteringLevel = 1;
    this._texture.onLoadObservable.addOnce(() => {
      this._setReady(true);
    });
    if (options.faceForward && scene.activeCamera) {
      const camera = scene.activeCamera;
      const forward = Vector3.Forward();
      const direction = Vector3.TransformNormal(forward, camera.getViewMatrix());
      direction.normalize();
      this.rotation.y = Math.acos(Vector3.Dot(forward, direction));
    }
    this._changeTextureMode(this._textureMode);
  }
  _changeTextureMode(value) {
    this._scene.onBeforeCameraRenderObservable.remove(this._onBeforeCameraRenderObserver);
    this._textureMode = value;
    this._texture.uScale = 1;
    this._texture.vScale = 1;
    this._texture.uOffset = 0;
    this._texture.vOffset = 0;
    this._texture.vAng = 0;
    switch (value) {
      case TextureDome.MODE_MONOSCOPIC:
        if (this._halfDome) {
          this._texture.uScale = 2;
          this._texture.uOffset = -1;
        }
        break;
      case TextureDome.MODE_SIDEBYSIDE: {
        this._texture.uScale = this._halfDome ? 0.99999 : 0.5;
        const rightOffset = this._halfDome ? 0 : 0.5;
        const leftOffset = this._halfDome ? -0.5 : 0;
        this._onBeforeCameraRenderObserver = this._scene.onBeforeCameraRenderObservable.add((camera) => {
          let isRightCamera = camera.isRightCamera;
          if (this._crossEye) {
            isRightCamera = !isRightCamera;
          }
          if (isRightCamera) {
            this._texture.uOffset = rightOffset;
          } else {
            this._texture.uOffset = leftOffset;
          }
        });
        break;
      }
      case TextureDome.MODE_TOPBOTTOM:
        this._texture.vScale = this._halfDome ? 0.99999 : 0.5;
        this._onBeforeCameraRenderObserver = this._scene.onBeforeCameraRenderObservable.add((camera) => {
          let isRightCamera = camera.isRightCamera;
          if (this._crossEye) {
            isRightCamera = !isRightCamera;
          }
          this._texture.vOffset = isRightCamera ? 0.5 : 0;
        });
        break;
    }
  }
  /**
   * Releases resources associated with this node.
   * @param doNotRecurse Set to true to not recurse into each children (recurse into each children by default)
   * @param disposeMaterialAndTextures Set to true to also dispose referenced materials and textures (false by default)
   */
  dispose(doNotRecurse, disposeMaterialAndTextures = false) {
    this._texture.dispose();
    this._mesh.dispose();
    this._material.dispose();
    this._scene.onBeforeCameraRenderObservable.remove(this._onBeforeCameraRenderObserver);
    this.onLoadErrorObservable.clear();
    this.onLoadObservable.clear();
    super.dispose(doNotRecurse, disposeMaterialAndTextures);
  }
}
TextureDome.MODE_MONOSCOPIC = 0;
TextureDome.MODE_TOPBOTTOM = 1;
TextureDome.MODE_SIDEBYSIDE = 2;
class PhotoDome extends TextureDome {
  /**
   * Gets or sets the texture being displayed on the sphere
   */
  get photoTexture() {
    return this.texture;
  }
  /**
   * sets the texture being displayed on the sphere
   */
  set photoTexture(value) {
    this.texture = value;
  }
  /**
   * Gets the current video mode for the video. It can be:
   * * TextureDome.MODE_MONOSCOPIC : Define the texture source as a Monoscopic panoramic 360.
   * * TextureDome.MODE_TOPBOTTOM  : Define the texture source as a Stereoscopic TopBottom/OverUnder panoramic 360.
   * * TextureDome.MODE_SIDEBYSIDE : Define the texture source as a Stereoscopic Side by Side panoramic 360.
   */
  get imageMode() {
    return this.textureMode;
  }
  /**
   * Sets the current video mode for the video. It can be:
   * * TextureDome.MODE_MONOSCOPIC : Define the texture source as a Monoscopic panoramic 360.
   * * TextureDome.MODE_TOPBOTTOM  : Define the texture source as a Stereoscopic TopBottom/OverUnder panoramic 360.
   * * TextureDome.MODE_SIDEBYSIDE : Define the texture source as a Stereoscopic Side by Side panoramic 360.
   */
  set imageMode(value) {
    this.textureMode = value;
  }
  _initTexture(urlsOrElement, scene, options) {
    return new Texture(urlsOrElement, scene, !options.generateMipMaps, !this._useDirectMapping, void 0, () => {
      this.onLoadObservable.notifyObservers();
    }, (message, exception) => {
      this.onLoadErrorObservable.notifyObservers(message || "Unknown error occured");
      if (this.onError) {
        this.onError(message, exception);
      }
    });
  }
}
PhotoDome.MODE_MONOSCOPIC = TextureDome.MODE_MONOSCOPIC;
PhotoDome.MODE_TOPBOTTOM = TextureDome.MODE_TOPBOTTOM;
PhotoDome.MODE_SIDEBYSIDE = TextureDome.MODE_SIDEBYSIDE;
const BEFORE_X = 90;
const LINEUP = [
  ["env.broadleaf.oak", 0, "prop.oak", -12, 4],
  ["env.broadleaf.oak", 1, "prop.oak_autumn", -3.5, 4],
  ["env.conifer.pine_tall", 0, "prop.nt_pine_tall", 4.5, 4],
  ["env.conifer.pine_tall", 1, "prop.nt_pine_snow_tall", 11, 4],
  ["env.shrub.broadleaf", 0, "prop.bush_large", -4, -4],
  ["env.shrub.broadleaf", 1, "prop.bush_leafy", -1.6, -4],
  ["env.rock.boulder_angular", 0, "prop.nt_boulder", 1.6, -4],
  ["env.rock.boulder_angular", 1, "prop.nt_boulder_moss", 4.6, -4],
  ["env.grass.clump", 0, "prop.grass_tall", -7.5, -5],
  ["env.grass.clump", 1, "prop.grass_patch", -6.2, -5],
  // The plants brush's flowers and fern (foliage.ts), in front of the grass.
  ["env.flower.meadow", 0, "", -7.4, -6.9],
  ["env.flower.meadow", 3, "prop.flower_red", -6.4, -6.6],
  ["env.flower.meadow", 1, "prop.flower_yellow", -5.4, -6.9],
  ["env.flower.meadow", 2, "prop.flower_purple", -4.4, -6.6],
  ["env.fern.bracken", 0, "prop.fern", -2.9, -6.4],
  ["env.fern.bracken", 1, "prop.plant_low", -1.5, -6.7],
  // Pebbles and eelgrass (the plants brush's stones and water plants), in front of the boulders.
  ["env.rock.pebbles", 0, "prop.stones", 0.9, -6.5],
  ["env.rock.pebbles", 1, "prop.stones", 2.2, -6.8],
  ["env.water.eelgrass", 0, "prop.mn_eelgrass", 3.7, -6.5],
  ["env.water.eelgrass", 1, "prop.mn_eelgrass", 5, -6.5]
];
const LINEUP2 = [
  ["env.broadleaf.maple", 0, "prop.tree_round", -15, -70, 0],
  ["env.broadleaf.maple", 1, "prop.tree_round_autumn", -8, -70, 0],
  ["env.broadleaf.acacia", 0, "prop.tree_plateau", 0, -68, 0],
  ["env.conifer.spruce", 0, "prop.pine_round", 8, -70, 0],
  ["env.conifer.spruce", 1, "prop.pine", 14, -70, 0],
  ["env.palm.coconut", 0, "prop.palm_tall", -11, -78, 0],
  ["env.palm.leaning", 0, "prop.palm_bent", -5, -78, 0],
  ["env.cactus.saguaro", 0, "prop.cactus_tall", 3, -79, 0],
  ["env.cactus.saguaro", 1, "prop.cactus", 6, -79, 0],
  ["env.shrub.laurel", 0, "prop.bush_large", -5, -86, 0],
  ["env.shrub.laurel", 1, "prop.bush", -2.2, -86, 0],
  ["env.hedge.privet", 0, "prop.hedge", 1.2, -86, 1.3],
  ["env.hedge.yew", 0, "prop.hedge_large", 5.2, -85, 1.3],
  // The other variants, behind and to the sides (every variant is drawn: the environment e2e flow checks it).
  ["env.broadleaf.acacia", 1, "prop.tree_plateau", 22, -64, 0],
  ["env.palm.coconut", 1, "prop.palm", -18, -80, 0],
  ["env.palm.leaning", 1, "prop.palm_bent", 12, -80, 0],
  // The rocks and deadwood of the Rockfall Canyon refresh, in front of the bushes (beside the Kenney pieces they replace).
  ["env.rock.boulder_round", 0, "prop.rock_large", -14, -88, 0],
  ["env.rock.boulder_round", 1, "prop.rock_large", -10.5, -88, 0.6],
  ["env.rock.slab", 0, "prop.rock_flat", 10, -88, 0],
  ["env.rock.slab", 1, "prop.rock_flat", 15, -88, 0.4],
  ["env.rock.outcrop", 0, "prop.rocks_tall", -22, -84, 0],
  ["env.rock.outcrop", 1, "prop.rocks_tall", 22, -84, 0.8],
  ["env.deadwood.log", 0, "prop.log", -8, -90, 1.2],
  ["env.deadwood.log", 1, "prop.log", 8, -90, 0.3],
  ["env.hedge.privet", 1, "prop.hedge", 1.2, -91, 1.3],
  ["env.hedge.yew", 1, "prop.hedge_large", 5.2, -91, 1.3]
];
const EYE = 1.7;
async function openEnvLab(engine, canvas, rendererKind) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.62, 0.72, 0.82, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 35e-4;
  scene.fogColor = new Color3(0.66, 0.74, 0.82);
  scene.ambientColor = new Color3(0.25, 0.27, 0.3);
  const camera = new UniversalCamera("cam", new Vector3(0, EYE, -16), scene);
  camera.minZ = 0.05;
  camera.maxZ = 1500;
  camera.fov = 1.2;
  camera.speed = 0.6;
  camera.setTarget(new Vector3(0, EYE, 10));
  camera.attachControl(canvas, true);
  camera.keysUp.push(87);
  camera.keysDown.push(83);
  camera.keysLeft.push(65);
  camera.keysRight.push(68);
  const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.75;
  hemi.groundColor = new Color3(0.32, 0.3, 0.24);
  const sun = new DirectionalLight("sun", new Vector3(-0.55, -0.7, 0.45), scene);
  sun.position = new Vector3(80, 110, -70);
  sun.intensity = 2.4;
  sun.diffuse = new Color3(1, 0.96, 0.88);
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 1e-3;
  shadows.normalBias = 0.02;
  shadows.darkness = 0.15;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 400;
  sun.autoCalcShadowZBounds = true;
  try {
    const dome = new PhotoDome("sky", versioned(`${"/"}skies/clear.jpg`), { resolution: 32, size: 1200 }, scene);
    dome.mesh.isPickable = false;
  } catch {
  }
  const ground = CreateGround("ground", { width: 600, height: 600, subdivisions: 2 }, scene);
  const gm = new PBRMaterial("ground_mat", scene);
  gm.albedoColor = new Color3(0.23, 0.26, 0.14);
  gm.metallic = 0;
  gm.roughness = 1;
  ground.material = gm;
  ground.receiveShadows = true;
  ground.isPickable = false;
  const entities = [];
  const oldEntities = [];
  const ent = (id, model, pos, variant, yaw = 0, scale = 1) => ({ id, kind: "prop", model, position: pos, yaw, scale, solid: true, tint: null, ...variant !== void 0 ? { variant } : {} });
  for (const [i, [model, variant, old, x, z]] of LINEUP.entries()) {
    if (model === "env.flower.meadow") {
      for (let k = 0; k < 5; k++) entities.push(ent(`flower_${i}_${k}`, model, [x + (k % 3 - 1) * 0.3, 0, z + Math.floor(k / 3) * 0.32 + k % 2 * 0.08], variant, k * 2.1, 0.9 + k % 3 * 0.12));
      if (old) oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z]));
      continue;
    }
    if (model === "env.water.eelgrass") {
      for (let k = 0; k < 4; k++) entities.push(ent(`eelgrass_${i}_${k}`, model, [x + (k % 2 - 0.5) * 0.42, 0, z + Math.floor(k / 2) * 0.38], variant, k * 1.9, 0.9 + k % 3 * 0.15));
      oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z]));
      continue;
    }
    if (model === "env.grass.clump") {
      for (let k = 0; k < 30; k++) entities.push(ent(`grass_${i}_${k}`, model, [x + (k % 5 - 2) * 0.28, 0, z + Math.floor(k / 5) * 0.3], variant, k * 1.3, 0.9 + k % 3 * 0.15));
      oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z + 0.6]));
      continue;
    }
    entities.push(ent(`lineup_${i}`, model, [x, 0, z], variant));
    oldEntities.push(ent(`old_${i}`, old, [x + BEFORE_X, 0, z]));
  }
  for (const [i, [model, variant, old, x, z, yaw]] of LINEUP2.entries()) {
    entities.push(ent(`lineup2_${i}`, model, [x, 0, z], variant, yaw));
    oldEntities.push(ent(`old2_${i}`, old, [x + BEFORE_X, 0, z], void 0, yaw));
  }
  for (let k = 0; k < 4; k++) {
    entities.push(ent(`wall_${k}`, "env.cliff.face", [-12 + k * 8, 0, 30], k % 2));
    for (let j = 0; j < 2; j++) oldEntities.push(ent(`old_wall_${k}_${j}`, "prop.cliff", [-14 + k * 8 + j * 4 + BEFORE_X, 0, 30]));
  }
  for (const [i, d] of [10, 25, 40, 60, 85, 110, 140, 170].entries()) {
    entities.push(ent(`row_oak_${i}`, "env.broadleaf.oak", [-46, 0, d], 0, i));
    entities.push(ent(`row_pine_${i}`, "env.conifer.pine_tall", [-36, 0, d], 0, i));
    entities.push(ent(`row_rock_${i}`, "env.rock.boulder_angular", [-29, 0, d], 1, i));
  }
  const env = new EnvironmentVisuals(scene, "high");
  const still = new URLSearchParams(location.search).has("test");
  if (still) env.materials.setWind(0);
  await env.setPlacements(entities, null);
  const library = new ModelLibrary(scene);
  const oldNodes = oldEntities.map((e) => createPropNode(scene, library, e, `old_${e.id}`, true, false, null));
  const casters = () => {
    const list = shadows.getShadowMap().renderList;
    list.length = 0;
    for (const m of scene.meshes) {
      if (m === ground || !m.isEnabled() || m.name === "sky" || m.name.startsWith("env_collider") || m.metadata?.castsNoShadow) continue;
      if (m.getTotalVertices() > 0) list.push(m);
      m.receiveShadows = true;
    }
  };
  await initPhysics();
  const doc = { ...newMapDocument("Environment lab"), entities };
  let colliderLines = null;
  const showColliders = (on) => {
    colliderLines?.dispose();
    colliderLines = null;
    if (!on) return;
    const physics = new PhysicsWorld([], null, environmentShapes(doc));
    const r = physics.world.debugRender();
    const lines = [];
    for (let i = 0; i < r.vertices.length; i += 6) lines.push([new Vector3(r.vertices[i], r.vertices[i + 1], r.vertices[i + 2]), new Vector3(r.vertices[i + 3], r.vertices[i + 4], r.vertices[i + 5])]);
    colliderLines = CreateLineSystem("env_colliders", { lines }, scene);
    colliderLines.color = new Color3(1, 0.25, 0.2);
    colliderLines.isPickable = false;
    physics.free();
  };
  const base = {
    lineup: [[0, EYE, -20], [0, 3, 4]],
    trees: [[0, EYE, -12], [0, 4.5, 4]],
    small: [[0, EYE, -11], [-1, 0.6, -4]],
    plants: [[-4.6, EYE, -8.2], [-4.2, 0.5, -4]],
    rocks: [[3.2, EYE, -8.6], [3.1, 0.6, -4]],
    ground: [[3, EYE, -10], [3, 0.1, -6.6]],
    cliffs: [[2, EYE, 15], [4, 4, 30]],
    trees2: [[0, EYE, -96], [0, 4.2, -72]],
    small2: [[0, EYE, -94], [0, 0.9, -84]],
    palms: [[-3, EYE, -90], [-2, 3.8, -78]]
  };
  const VIEWS = {};
  for (const [k, [p, t]] of Object.entries(base)) {
    VIEWS[k] = [new Vector3(...p), new Vector3(...t)];
    VIEWS[`before-${k}`] = [new Vector3(p[0] + BEFORE_X, p[1], p[2]), new Vector3(t[0] + BEFORE_X, t[1], t[2])];
  }
  VIEWS["lod-row"] = [new Vector3(-40, EYE, -4), new Vector3(-40, 3, 60)];
  VIEWS.overview = [new Vector3(-30, 28, -45), new Vector3(0, 0, 20)];
  const panel = document.createElement("div");
  panel.id = "envlab-panel";
  panel.style.cssText = "position:fixed;left:8px;top:8px;width:300px;background:rgba(18,21,26,.88);padding:10px 12px;font:12px/1.45 system-ui;color:#e6e6e6;border-radius:6px;z-index:10";
  const opt = (id, label, values) => `<label style="display:block;margin:3px 0">${label} <select id="${id}">${values.map((v) => `<option>${v}</option>`).join("")}</select></label>`;
  const chk = (id, label, on = false) => `<label style="display:block;margin:3px 0"><input type="checkbox" id="${id}" ${on ? "checked" : ""}> ${label}</label>`;
  panel.innerHTML = `<b style="font-size:13px">Environment lab</b> <span style="color:#9ab">${rendererKind} · eye height ${EYE} m</span>
${opt("el-view", "View", Object.keys(VIEWS))}
${opt("el-lod", "Level of detail", ["auto", "0", "1", "2", "3"])}
${opt("el-tier", "Tier", ["high", "medium", "low"])}
${opt("el-rows", "Show", ["both", "new", "old"])}
${chk("el-wire", "Wireframe")}${chk("el-coll", "Colliders")}${chk("el-wind", "Wind", !still)}
<div id="el-stats" style="margin-top:6px;color:#9ab;white-space:pre"></div>
<div style="color:#789;margin-top:4px">WASD + drag to look · species: ${ENV_RENDER.map((s) => s.id.slice(4)).join(", ")}</div>`;
  document.body.append(panel);
  const $ = (id) => document.getElementById(id);
  const state = {
    ready: false,
    view: "lineup",
    stats: () => ({ env: env.stats(), draws: engine._drawCalls?.current ?? null, meshes: scene.getActiveMeshes().length }),
    frames: () => frames,
    scene,
    shadows,
    set: async (o) => {
      if (o.lod !== void 0) env.forceLevel(o.lod);
      if (o.wireframe !== void 0) {
        env.materials.setWireframe(o.wireframe);
        for (const n of oldNodes) for (const m of n.getChildMeshes()) if (m.material) m.material.wireframe = o.wireframe;
      }
      if (o.colliders !== void 0) showColliders(o.colliders);
      if (o.wind !== void 0) env.materials.setWind(o.wind ? env.currentTier.wind || 1 : 0);
      if (o.tier !== void 0) env.setTier(o.tier);
      if (o.rows !== void 0) {
        for (const n of oldNodes) n.setEnabled(o.rows !== "new");
        for (const m of scene.meshes) if (m.name.startsWith("env_") && !m.name.startsWith("env_tpl") && m.name !== "env_colliders") m.isVisible = o.rows !== "old";
      }
      if (o.view && VIEWS[o.view]) {
        state.view = o.view;
        $("el-view").value = o.view;
        const [p, t] = VIEWS[o.view];
        camera.position.copyFrom(p);
        camera.setTarget(t);
      }
      env.update(camera.position);
      casters();
    }
  };
  $("el-view").onchange = () => void state.set({ view: $("el-view").value });
  $("el-lod").onchange = () => {
    const v = $("el-lod").value;
    void state.set({ lod: v === "auto" ? null : Number(v) });
  };
  $("el-tier").onchange = () => void state.set({ tier: $("el-tier").value });
  $("el-rows").onchange = () => void state.set({ rows: $("el-rows").value });
  $("el-wire").onchange = () => void state.set({ wireframe: $("el-wire").checked });
  $("el-coll").onchange = () => void state.set({ colliders: $("el-coll").checked });
  $("el-wind").onchange = () => void state.set({ wind: $("el-wind").checked });
  await Promise.all(oldNodes.map((n) => new Promise((done) => {
    const t0 = performance.now();
    const check = () => n.getChildMeshes().length || performance.now() - t0 > 8e3 ? done() : setTimeout(check, 50);
    check();
  })));
  const view = new URLSearchParams(location.search).get("view");
  await state.set({ view: view && VIEWS[view] ? view : "lineup" });
  let frames = 0;
  let statsAt = 0;
  scene.onAfterRenderObservable.add(() => {
    frames++;
    env.update(camera.position);
    if (performance.now() - statsAt > 500) {
      statsAt = performance.now();
      const s = env.stats();
      $("el-stats").textContent = `copies ${s.copies} · batches ${s.drawnBatches}/${s.batches}
per level ${s.perLevel.join(" / ")}
env triangles ${s.triangles}
active meshes ${scene.getActiveMeshes().length}`;
    }
  });
  window.addEventListener("resize", () => engine.resize());
  engine.runRenderLoop(() => scene.render());
  await scene.whenReadyAsync();
  casters();
  state.ready = true;
  window.__envlab = state;
}
export {
  openEnvLab
};
