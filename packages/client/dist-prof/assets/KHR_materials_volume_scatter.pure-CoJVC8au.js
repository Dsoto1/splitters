import { aq as GLTFLoader, a as Color3, V as Vector3 } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_volume_scatter";
function multiScatterToSingleScatterAlbedo(multiScatter) {
  const multiScatterAlbedo = new Vector3(multiScatter.r, multiScatter.g, multiScatter.b);
  const s = new Vector3(4.09712, 4.09712, 4.09712);
  s.addInPlace(new Vector3(4.20863, 4.20863, 4.20863).multiplyInPlace(multiScatterAlbedo));
  const p = new Vector3(9.59217, 9.59217, 9.59217);
  p.addInPlace(new Vector3(41.6808, 41.6808, 41.6808).multiplyInPlace(multiScatterAlbedo));
  p.addInPlace(new Vector3(17.7126, 17.7126, 17.7126).multiplyInPlace(multiScatterAlbedo.multiply(multiScatterAlbedo)));
  s.subtractInPlace(new Vector3(Math.sqrt(p.x), Math.sqrt(p.y), Math.sqrt(p.z)));
  return new Vector3(1, 1, 1).subtract(s.multiply(s));
}
class KHR_materials_volume_scatter {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 172;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME);
    if (this.enabled) {
      this._loader._disableInstancedMesh++;
    }
  }
  /** @internal */
  dispose() {
    if (this.enabled) {
      this._loader._disableInstancedMesh--;
    }
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadVolumePropertiesAsync(extensionContext, material, babylonMaterial, extension));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadVolumePropertiesAsync(context, material, babylonMaterial, extension) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    if (adapter.transmissionWeight === 0 && adapter.subsurfaceWeight === 0 || adapter.geometryThinWalled) {
      return Promise.resolve();
    }
    const scatterColor = extension.multiscatterColorFactor !== void 0 && extension.multiscatterColorFactor.length == 3 ? Color3.FromArray(extension.multiscatterColorFactor) : Color3.Black();
    const scatterAnisotropy = extension.scatterAnisotropy !== void 0 ? extension.scatterAnisotropy : 0;
    let texturePromise = Promise.resolve(null);
    if (extension.multiscatterColorTexture) {
      extension.multiscatterColorTexture.nonColorData = true;
      texturePromise = this._loader.loadTextureInfoAsync(`${context}/multiscatterColorTexture`, extension.multiscatterColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Scatter Color)`;
        if (adapter.transmissionWeight > 0) {
          adapter.transmissionScatterTexture = texture;
        }
        if (adapter.subsurfaceWeight > 0) {
          adapter.subsurfaceColorTexture = texture;
        }
      });
    }
    const extinctionCoefficient = new Vector3(-Math.log(adapter.transmissionColor.r), -Math.log(adapter.transmissionColor.g), -Math.log(adapter.transmissionColor.b));
    extinctionCoefficient.scaleInPlace(1 / Math.max(adapter.transmissionDepth, 1e-6));
    if (adapter.transmissionWeight > 0) {
      const singleScatterAlbedo = multiScatterToSingleScatterAlbedo(scatterColor);
      const scatteringCoefficient = extinctionCoefficient.multiply(singleScatterAlbedo);
      scatteringCoefficient.scaleInPlace(adapter.transmissionDepth);
      adapter.transmissionScatter.set(scatteringCoefficient.x, scatteringCoefficient.y, scatteringCoefficient.z);
      adapter.transmissionScatterAnisotropy = scatterAnisotropy;
    }
    if (adapter.subsurfaceWeight > 0) {
      adapter.subsurfaceScatterAnisotropy = scatterAnisotropy;
      adapter.subsurfaceColor = scatterColor;
      const mfp = new Vector3(extinctionCoefficient.x !== 0 ? 1 / extinctionCoefficient.x : 1, extinctionCoefficient.y !== 0 ? 1 / extinctionCoefficient.y : 1, extinctionCoefficient.z !== 0 ? 1 / extinctionCoefficient.z : 1);
      adapter.subsurfaceRadius = Math.max(mfp.x, mfp.y, mfp.z);
      adapter.subsurfaceRadiusScale = new Color3(mfp.x / adapter.subsurfaceRadius, mfp.y / adapter.subsurfaceRadius, mfp.z / adapter.subsurfaceRadius);
    }
    return texturePromise.then(() => {
    });
  }
}
export {
  KHR_materials_volume_scatter
};
