const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/color.vertex-BZ3_tdHQ.js","assets/babylon-PnzH6wcM.js","assets/bonesVertex-Cpn2iSQy.js","assets/instancesVertex-23t-Q1Uk.js","assets/clipPlaneVertex-CtRrEuj6.js","assets/fogVertex-CNSnaHda.js","assets/instancesDeclaration-DL63iftc.js","assets/vertexColorMixing-CGAqvR_s.js","assets/color.fragment-7gWdA4-W.js","assets/clipPlaneFragment-BbExy4ec.js","assets/fogFragment-Dm1Vlk0e.js","assets/color.vertex-BrGCNa0G.js","assets/bakedVertexAnimation-D_Sv770W.js","assets/clipPlaneVertex-BdoNWmEf.js","assets/fogVertex-DbLnME-r.js","assets/instancesDeclaration-CoQOC7Vy.js","assets/vertexColorMixing-D6-vT13a.js","assets/color.fragment-CANfyjVO.js","assets/clipPlaneFragment-D8NTl-r6.js","assets/fogFragment-Dp8mD_y1.js"])))=>i.map(i=>d[i]);
import { h as Mesh, a as Color3, C as Color4, j as VertexBuffer, aM as Material, a9 as __vitePreload, bq as InstancedMesh, br as _MissingSideEffect, i as VertexData, L as Logger, bs as _CreationDataStorage, V as Vector3 } from "./babylon-PnzH6wcM.js";
import { S as ShaderMaterial } from "./shaderMaterial.pure-T5Xe2ebz.js";
var _a, _b;
class LinesMesh extends Mesh {
  _isShaderMaterial(shader) {
    if (!shader) {
      return false;
    }
    return shader.getClassName() === "ShaderMaterial";
  }
  /**
   * Creates a new LinesMesh
   * @param name defines the name
   * @param scene defines the hosting scene
   * @param parent defines the parent mesh if any
   * @param source defines the optional source LinesMesh used to clone data from
   * @param doNotCloneChildren When cloning, skip cloning child meshes of source, default False.
   * When false, achieved by calling a clone(), also passing False.
   * This will make creation of children, recursive.
   * @param useVertexColor defines if this LinesMesh supports vertex color
   * @param useVertexAlpha defines if this LinesMesh supports vertex alpha
   * @param material material to use to draw the line. If not provided, will create a new one
   */
  constructor(name, scene = null, parent = null, source = null, doNotCloneChildren, useVertexColor, useVertexAlpha, material) {
    super(name, scene, parent, source, doNotCloneChildren);
    this.useVertexColor = useVertexColor;
    this.useVertexAlpha = useVertexAlpha;
    this.color = new Color3(1, 1, 1);
    this.alpha = 1;
    this._shaderLanguage = 0;
    this._ownsMaterial = false;
    if (source) {
      this.color = source.color.clone();
      this.alpha = source.alpha;
      this.useVertexColor = source.useVertexColor;
      this.useVertexAlpha = source.useVertexAlpha;
    }
    this.intersectionThreshold = 0.1;
    const defines = [];
    const options = {
      attributes: [VertexBuffer.PositionKind],
      uniforms: ["world", "viewProjection"],
      needAlphaBlending: true,
      defines,
      useClipPlane: null,
      shaderLanguage: 0
    };
    if (!this.useVertexAlpha) {
      options.needAlphaBlending = false;
    } else {
      options.defines.push("#define VERTEXALPHA");
    }
    if (!this.useVertexColor) {
      options.uniforms.push("color");
      this._color4 = new Color4();
    } else {
      options.defines.push("#define VERTEXCOLOR");
      options.attributes.push(VertexBuffer.ColorKind);
    }
    if (material) {
      this.material = material;
    } else {
      const engine = this.getScene().getEngine();
      if (engine.isWebGPU && !LinesMesh.ForceGLSL) {
        this._shaderLanguage = 1;
      }
      options.shaderLanguage = this._shaderLanguage;
      options.extraInitializationsAsync = async () => {
        if (this._shaderLanguage === 1) {
          await Promise.all([__vitePreload(() => import("./color.vertex-BZ3_tdHQ.js"), true ? __vite__mapDeps([0,1,2,3,4,5,6,7]) : void 0), __vitePreload(() => import("./color.fragment-7gWdA4-W.js"), true ? __vite__mapDeps([8,1,9,10]) : void 0)]);
        } else {
          await Promise.all([__vitePreload(() => import("./color.vertex-BrGCNa0G.js"), true ? __vite__mapDeps([11,1,12,13,14,15,16]) : void 0), __vitePreload(() => import("./color.fragment-CANfyjVO.js"), true ? __vite__mapDeps([17,1,18,19]) : void 0)]);
        }
      };
      const material2 = new ShaderMaterial("colorShader", this.getScene(), "color", options, false);
      material2.doNotSerialize = true;
      this._ownsMaterial = true;
      this._setInternalMaterial(material2);
    }
  }
  /**
   * @returns the string "LineMesh"
   */
  getClassName() {
    return "LinesMesh";
  }
  /**
   * @internal
   */
  get material() {
    return this._internalAbstractMeshDataInfo._material;
  }
  /**
   * @internal
   */
  set material(value) {
    const currentMaterial = this.material;
    if (currentMaterial === value) {
      return;
    }
    const shouldDispose = currentMaterial && this._ownsMaterial;
    this._ownsMaterial = false;
    this._setInternalMaterial(value);
    if (shouldDispose) {
      currentMaterial?.dispose();
    }
  }
  _setInternalMaterial(material) {
    this._setMaterial(material);
    if (this.material) {
      this.material.fillMode = Material.LineListDrawMode;
      this.material.disableLighting = true;
    }
  }
  /**
   * @internal
   */
  get checkCollisions() {
    return false;
  }
  set checkCollisions(value) {
  }
  /**
   * @internal
   */
  _bind(_subMesh, colorEffect) {
    if (!this._geometry) {
      return this;
    }
    const indexToBind = this.isUnIndexed ? null : this._geometry.getIndexBuffer();
    if (!this._userInstancedBuffersStorage || this.hasThinInstances) {
      this._geometry._bind(colorEffect, indexToBind);
    } else {
      this._geometry._bind(colorEffect, indexToBind, this._userInstancedBuffersStorage.vertexBuffers, this._userInstancedBuffersStorage.vertexArrayObjects);
    }
    if (!this.useVertexColor && this._isShaderMaterial(this.material)) {
      const { r, g, b } = this.color;
      this._color4.set(r, g, b, this.alpha);
      this.material.setColor4("color", this._color4);
    }
    return this;
  }
  /**
   * @internal
   */
  _draw(subMesh, fillMode, instancesCount) {
    if (!this._geometry || !this._geometry.getVertexBuffers() || !this._unIndexed && !this._geometry.getIndexBuffer()) {
      return this;
    }
    const engine = this.getScene().getEngine();
    if (this._unIndexed) {
      engine.drawArraysType(Material.LineListDrawMode, subMesh.verticesStart, subMesh.verticesCount, instancesCount);
    } else {
      engine.drawElementsType(Material.LineListDrawMode, subMesh.indexStart, subMesh.indexCount, instancesCount);
    }
    return this;
  }
  /**
   * Disposes of the line mesh (this disposes of the automatically created material if not instructed otherwise).
   * @param doNotRecurse If children should be disposed
   * @param disposeMaterialAndTextures This parameter is used to force disposing the material in case it is not the default one
   * @param doNotDisposeMaterial If the material should not be disposed (default: false, meaning the material might be disposed)
   */
  dispose(doNotRecurse, disposeMaterialAndTextures = false, doNotDisposeMaterial) {
    if (!doNotDisposeMaterial) {
      if (this._ownsMaterial) {
        this.material?.dispose(false, false, true);
      } else if (disposeMaterialAndTextures) {
        this.material?.dispose(false, false, true);
      }
    }
    super.dispose(doNotRecurse);
  }
  /**
   * Returns a new LineMesh object cloned from the current one.
   * @param name defines the cloned mesh name
   * @param newParent defines the new mesh parent
   * @param doNotCloneChildren if set to true, none of the mesh children are cloned (false by default)
   * @returns the new mesh
   */
  clone(name, newParent = null, doNotCloneChildren) {
    if (newParent && newParent._addToSceneRootNodes === void 0) {
      const createOptions = newParent;
      createOptions.source = this;
      return new LinesMesh(name, this.getScene(), createOptions.parent, createOptions.source, createOptions.doNotCloneChildren);
    }
    return new LinesMesh(name, this.getScene(), newParent, this, doNotCloneChildren);
  }
  /**
   * Creates a new InstancedLinesMesh object from the mesh model.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
   * @param name defines the name of the new instance
   * @returns a new InstancedLinesMesh
   */
  createInstance(name) {
    const instance = new InstancedLinesMesh(name, this);
    if (this.instancedBuffers) {
      instance.instancedBuffers = {};
      for (const key in this.instancedBuffers) {
        instance.instancedBuffers[key] = this.instancedBuffers[key];
      }
    }
    return instance;
  }
  /**
   * Serializes this ground mesh
   * @param serializationObject object to write serialization to
   */
  serialize(serializationObject) {
    super.serialize(serializationObject);
    serializationObject.color = this.color.asArray();
    serializationObject.alpha = this.alpha;
  }
  /**
   * Parses a serialized ground mesh
   * @param parsedMesh the serialized mesh
   * @param scene the scene to create the ground mesh in
   * @returns the created ground mesh
   */
  static Parse(parsedMesh, scene) {
    const result = new LinesMesh(parsedMesh.name, scene);
    result.color = Color3.FromArray(parsedMesh.color);
    result.alpha = parsedMesh.alpha;
    return result;
  }
}
LinesMesh.ForceGLSL = false;
class InstancedLinesMesh extends InstancedMesh {
  constructor(name, source) {
    super(name, source);
    this.intersectionThreshold = source.intersectionThreshold;
  }
  /**
   * @returns the string "InstancedLinesMesh".
   */
  getClassName() {
    return "InstancedLinesMesh";
  }
}
let _Registered$1 = false;
function RegisterLinesMesh() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  Mesh._LinesMeshParser = (parsedMesh, scene) => {
    return LinesMesh.Parse(parsedMesh, scene);
  };
}
(_a = LinesMesh.prototype).enableEdgesRendering ?? (_a.enableEdgesRendering = _MissingSideEffect("LinesMesh", "enableEdgesRendering"));
(_b = InstancedLinesMesh.prototype).enableEdgesRendering ?? (_b.enableEdgesRendering = _MissingSideEffect("InstancedLinesMesh", "enableEdgesRendering"));
function CreateLineSystemVertexData(options) {
  const indices = [];
  const positions = [];
  const lines = options.lines;
  const colors = options.colors;
  const vertexColors = [];
  let idx = 0;
  for (let l = 0; l < lines.length; l++) {
    const points = lines[l];
    for (let index = 0; index < points.length; index++) {
      const { x, y, z } = points[index];
      positions.push(x, y, z);
      if (colors) {
        const color = colors[l];
        const { r, g, b, a } = color[index];
        vertexColors.push(r, g, b, a);
      }
      if (index > 0) {
        indices.push(idx - 1);
        indices.push(idx);
      }
      idx++;
    }
  }
  const vertexData = new VertexData();
  vertexData.indices = indices;
  vertexData.positions = positions;
  if (colors) {
    vertexData.colors = vertexColors;
  }
  return vertexData;
}
function CreateDashedLinesVertexData(options) {
  const dashSize = options.dashSize || 3;
  const gapSize = options.gapSize || 1;
  const dashNb = options.dashNb || 200;
  const points = options.points;
  const positions = [];
  const indices = [];
  const curvect = Vector3.Zero();
  let lg = 0;
  let nb;
  let curshft;
  let idx = 0;
  let i;
  for (i = 0; i < points.length - 1; i++) {
    points[i + 1].subtractToRef(points[i], curvect);
    lg += curvect.length();
  }
  const shft = lg / dashNb;
  const dashshft = dashSize * shft / (dashSize + gapSize);
  for (i = 0; i < points.length - 1; i++) {
    points[i + 1].subtractToRef(points[i], curvect);
    nb = Math.floor(curvect.length() / shft);
    curvect.normalize();
    for (let j = 0; j < nb; j++) {
      curshft = shft * j;
      positions.push(points[i].x + curshft * curvect.x, points[i].y + curshft * curvect.y, points[i].z + curshft * curvect.z);
      positions.push(points[i].x + (curshft + dashshft) * curvect.x, points[i].y + (curshft + dashshft) * curvect.y, points[i].z + (curshft + dashshft) * curvect.z);
      indices.push(idx, idx + 1);
      idx += 2;
    }
  }
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  return vertexData;
}
function CreateLineSystem(name, options, scene = null) {
  const instance = options.instance;
  const lines = options.lines;
  const colors = options.colors;
  if (instance) {
    const positions = instance.getVerticesData(VertexBuffer.PositionKind);
    let vertexColor;
    let lineColors;
    if (colors) {
      vertexColor = instance.getVerticesData(VertexBuffer.ColorKind);
    }
    let i = 0;
    let c = 0;
    for (let l = 0; l < lines.length; l++) {
      const points = lines[l];
      for (let p = 0; p < points.length; p++) {
        positions[i] = points[p].x;
        positions[i + 1] = points[p].y;
        positions[i + 2] = points[p].z;
        if (colors && vertexColor) {
          lineColors = colors[l];
          vertexColor[c] = lineColors[p].r;
          vertexColor[c + 1] = lineColors[p].g;
          vertexColor[c + 2] = lineColors[p].b;
          vertexColor[c + 3] = lineColors[p].a;
          c += 4;
        }
        i += 3;
      }
    }
    instance.updateVerticesData(VertexBuffer.PositionKind, positions, false, false);
    if (colors && vertexColor) {
      instance.updateVerticesData(VertexBuffer.ColorKind, vertexColor, false, false);
    }
    instance.refreshBoundingInfo();
    return instance;
  }
  const useVertexColor = colors ? true : false;
  const lineSystem = new LinesMesh(name, scene, null, void 0, void 0, useVertexColor, options.useVertexAlpha, options.material);
  const vertexData = CreateLineSystemVertexData(options);
  vertexData.applyToMesh(lineSystem, options.updatable);
  return lineSystem;
}
function CreateLines(name, options, scene = null) {
  const colors = options.colors ? [options.colors] : null;
  const lines = CreateLineSystem(name, { lines: [options.points], updatable: options.updatable, instance: options.instance, colors, useVertexAlpha: options.useVertexAlpha, material: options.material }, scene);
  return lines;
}
function CreateDashedLines(name, options, scene = null) {
  const points = options.points;
  const instance = options.instance;
  const gapSize = options.gapSize || 1;
  const dashSize = options.dashSize || 3;
  if (instance) {
    const positionFunction = (positions) => {
      const curvect = Vector3.Zero();
      const nbSeg = positions.length / 6;
      let lg = 0;
      let nb;
      let curshft;
      let p = 0;
      let i;
      let j;
      for (i = 0; i < points.length - 1; i++) {
        points[i + 1].subtractToRef(points[i], curvect);
        lg += curvect.length();
      }
      const shft = lg / nbSeg;
      const dashSize2 = instance._creationDataStorage.dashSize;
      const gapSize2 = instance._creationDataStorage.gapSize;
      const dashshft = dashSize2 * shft / (dashSize2 + gapSize2);
      for (i = 0; i < points.length - 1; i++) {
        points[i + 1].subtractToRef(points[i], curvect);
        nb = Math.floor(curvect.length() / shft);
        curvect.normalize();
        j = 0;
        while (j < nb && p < positions.length) {
          curshft = shft * j;
          positions[p] = points[i].x + curshft * curvect.x;
          positions[p + 1] = points[i].y + curshft * curvect.y;
          positions[p + 2] = points[i].z + curshft * curvect.z;
          positions[p + 3] = points[i].x + (curshft + dashshft) * curvect.x;
          positions[p + 4] = points[i].y + (curshft + dashshft) * curvect.y;
          positions[p + 5] = points[i].z + (curshft + dashshft) * curvect.z;
          p += 6;
          j++;
        }
      }
      while (p < positions.length) {
        positions[p] = points[i].x;
        positions[p + 1] = points[i].y;
        positions[p + 2] = points[i].z;
        p += 3;
      }
    };
    if (options.dashNb || options.dashSize || options.gapSize || options.useVertexAlpha || options.material) {
      Logger.Warn("You have used an option other than points with the instance option. Please be aware that these other options will be ignored.");
    }
    instance.updateMeshPositions(positionFunction, false);
    return instance;
  }
  const dashedLines = new LinesMesh(name, scene, null, void 0, void 0, void 0, options.useVertexAlpha, options.material);
  const vertexData = CreateDashedLinesVertexData(options);
  vertexData.applyToMesh(dashedLines, options.updatable);
  dashedLines._creationDataStorage = new _CreationDataStorage();
  dashedLines._creationDataStorage.dashSize = dashSize;
  dashedLines._creationDataStorage.gapSize = gapSize;
  return dashedLines;
}
let _Registered = false;
function RegisterLinesBuilder() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  VertexData.CreateLineSystem = CreateLineSystemVertexData;
  VertexData.CreateDashedLines = CreateDashedLinesVertexData;
  Mesh.CreateLines = (name, points, scene = null, updatable = false, instance = null) => {
    const options = {
      points,
      updatable,
      instance
    };
    return CreateLines(name, options, scene);
  };
  Mesh.CreateDashedLines = (name, points, dashSize, gapSize, dashNb, scene = null, updatable, instance) => {
    const options = {
      points,
      dashSize,
      gapSize,
      dashNb,
      updatable,
      instance
    };
    return CreateDashedLines(name, options, scene);
  };
}
RegisterLinesBuilder();
export {
  CreateLineSystem as C,
  InstancedLinesMesh as I,
  LinesMesh as L,
  RegisterLinesMesh as R,
  CreateLines as a,
  CreateDashedLines as b
};
