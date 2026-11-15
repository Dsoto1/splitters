import { G as GaussianSplattingMesh, A as AllocateShBuffers } from "./gaussianSplattingMesh.pure-Df5tN8_m.js";
import { aq as GLTFLoader, at as ArrayItem } from "./babylon-PnzH6wcM.js";
import "./shaderMaterial.pure-T5Xe2ebz.js";
import "./multiRenderTarget.pure-CHje0eeK.js";
const NAME = "KHR_gaussian_splatting";
const ShC0 = 0.28209479177387814;
const RotationAttribute = "KHR_gaussian_splatting:ROTATION";
const ScaleAttribute = "KHR_gaussian_splatting:SCALE";
const OpacityAttribute = "KHR_gaussian_splatting:OPACITY";
const ShDegree0Attribute = "KHR_gaussian_splatting:SH_DEGREE_0_COEF_0";
const ShCoefficientCountPerDegree = [0, 3, 5, 7];
function Clamp255(value) {
  return value <= 0 ? 0 : value >= 255 ? 255 : value + 0.5 | 0;
}
class KHR_gaussian_splatting {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadMeshPrimitiveAsync(context, name, node, mesh, primitive, assign) {
    return GLTFLoader.LoadExtensionAsync(context, primitive, this.name, async (extensionContext) => {
      if (primitive.mode != void 0 && primitive.mode !== 0) {
        throw new Error(`${extensionContext}: Gaussian splatting primitives must use POINTS mode`);
      }
      const loader = this._loader;
      const loadAttribute = (attributeName) => {
        const accessorIndex = primitive.attributes[attributeName];
        if (accessorIndex == void 0) {
          return null;
        }
        const accessor = ArrayItem.Get(`${context}/attributes/${attributeName}`, loader.gltf.accessors, accessorIndex);
        return loader._loadFloatAccessorAsync(`/accessors/${accessor.index}`, accessor);
      };
      const positionsPromise = loadAttribute("POSITION");
      if (!positionsPromise) {
        throw new Error(`${extensionContext}: Gaussian splatting primitive is missing the POSITION attribute`);
      }
      let shDegree = 0;
      const shAttributeNames = [];
      for (let degree = 1; degree <= 3; degree++) {
        if (primitive.attributes[`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_0`] == void 0) {
          break;
        }
        shDegree = degree;
        for (let coef = 0; coef < ShCoefficientCountPerDegree[degree]; coef++) {
          shAttributeNames.push(`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_${coef}`);
        }
      }
      const scene = loader.babylonScene;
      const gaussianSplattingMesh = scene._executeWithBlockedEntityCollection(!!loader._assetContainer, () => new GaussianSplattingMesh(name, null, scene));
      gaussianSplattingMesh._parentContainer = loader._assetContainer;
      GLTFLoader.AddPointerMetadata(gaussianSplattingMesh, context);
      loader.parent.onMeshLoadedObservable.notifyObservers(gaussianSplattingMesh);
      assign(gaussianSplattingMesh);
      const engineCaps = scene.getEngine().getCaps();
      const [positions, rotations, scales, opacities, shDegree0, colors, ...shHigherDegrees] = await Promise.all([
        positionsPromise,
        loadAttribute(RotationAttribute),
        loadAttribute(ScaleAttribute),
        loadAttribute(OpacityAttribute),
        loadAttribute(ShDegree0Attribute),
        loadAttribute("COLOR_0"),
        ...shAttributeNames.map((attributeName) => loadAttribute(attributeName))
      ]);
      const splatCount = positions.length / 3;
      const colorStride = colors ? colors.length / splatCount : 0;
      const rowOutputLength = 3 * 4 + 3 * 4 + 4 + 4;
      const buffer = new ArrayBuffer(rowOutputLength * splatCount);
      const floatView = new Float32Array(buffer);
      const byteView = new Uint8Array(buffer);
      let shBuffers = null;
      if (shDegree > 0) {
        const shVectorCount = (shDegree + 1) * (shDegree + 1) - 1;
        const shComponentCount = shVectorCount * 3;
        const textureCount = Math.ceil(shComponentCount / 16);
        const width = engineCaps.maxTextureSize;
        const height = Math.ceil(splatCount / width);
        shBuffers = AllocateShBuffers(textureCount, height * width * 4 * 4);
      }
      for (let i = 0; i < splatCount; i++) {
        const floatBase = i * 8;
        const byteBase = i * 32;
        const p = i * 3;
        floatView[floatBase + 0] = positions[p + 0];
        floatView[floatBase + 1] = positions[p + 1];
        floatView[floatBase + 2] = positions[p + 2];
        floatView[floatBase + 3] = scales ? scales[p + 0] : 1;
        floatView[floatBase + 4] = scales ? scales[p + 1] : 1;
        floatView[floatBase + 5] = scales ? scales[p + 2] : 1;
        if (shDegree0) {
          byteView[byteBase + 24] = Clamp255((0.5 + ShC0 * shDegree0[p + 0]) * 255);
          byteView[byteBase + 25] = Clamp255((0.5 + ShC0 * shDegree0[p + 1]) * 255);
          byteView[byteBase + 26] = Clamp255((0.5 + ShC0 * shDegree0[p + 2]) * 255);
        } else if (colors) {
          const c = i * colorStride;
          byteView[byteBase + 24] = Clamp255(colors[c + 0] * 255);
          byteView[byteBase + 25] = Clamp255(colors[c + 1] * 255);
          byteView[byteBase + 26] = Clamp255(colors[c + 2] * 255);
        } else {
          byteView[byteBase + 24] = 255;
          byteView[byteBase + 25] = 255;
          byteView[byteBase + 26] = 255;
        }
        if (opacities) {
          byteView[byteBase + 27] = Clamp255(opacities[i] * 255);
        } else if (colors && colorStride >= 4) {
          byteView[byteBase + 27] = Clamp255(colors[i * colorStride + 3] * 255);
        } else {
          byteView[byteBase + 27] = 255;
        }
        const r = i * 4;
        const qx = rotations ? rotations[r + 0] : 0;
        const qy = rotations ? rotations[r + 1] : 0;
        const qz = rotations ? rotations[r + 2] : 0;
        const qw = rotations ? rotations[r + 3] : 1;
        byteView[byteBase + 28] = Clamp255(qw * 127.5 + 127.5);
        byteView[byteBase + 29] = Clamp255(qx * 127.5 + 127.5);
        byteView[byteBase + 30] = Clamp255(qy * 127.5 + 127.5);
        byteView[byteBase + 31] = Clamp255(qz * 127.5 + 127.5);
        if (shBuffers) {
          const offsetPerSplat = i * 16;
          for (let coef = 0; coef < shHigherDegrees.length; coef++) {
            const coefData = shHigherDegrees[coef];
            if (!coefData) {
              continue;
            }
            for (let channel = 0; channel < 3; channel++) {
              const flatIndex = coef * 3 + channel;
              const textureIndex = flatIndex >> 4;
              const byteIndexInTexture = flatIndex & 15;
              shBuffers[textureIndex][offsetPerSplat + byteIndexInTexture] = Clamp255(coefData[p + channel] * 128 + 128);
            }
          }
        }
      }
      await gaussianSplattingMesh.updateDataAsync(buffer, shBuffers ?? void 0, void 0, shDegree || void 0);
      return gaussianSplattingMesh;
    });
  }
}
export {
  KHR_gaussian_splatting
};
