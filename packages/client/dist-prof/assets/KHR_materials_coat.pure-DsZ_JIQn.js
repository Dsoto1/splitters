import { aq as GLTFLoader, a as Color3 } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_coat";
class KHR_materials_coat {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 191;
    this.useOpenPBR = false;
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
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      if (material.extensions && material.extensions["KHR_materials_openpbr"]) {
        this.useOpenPBR = true;
      }
      promises.push(this._loadCoatPropertiesAsync(extensionContext, extension, babylonMaterial));
      await Promise.all(promises);
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadCoatPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureCoat();
    adapter.coatWeight = properties.coatFactor !== void 0 ? properties.coatFactor : 0;
    adapter.coatRoughness = properties.coatRoughnessFactor !== void 0 ? properties.coatRoughnessFactor : 0;
    if (properties.coatTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatTexture`, properties.coatTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat)`;
        adapter.coatWeightTexture = texture;
      }));
    }
    if (properties.coatRoughnessTexture) {
      properties.coatRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatRoughnessTexture`, properties.coatRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Roughness)`;
        adapter.coatRoughnessTexture = texture;
      }));
    }
    if (properties.coatNormalTexture) {
      properties.coatNormalTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatNormalTexture`, properties.coatNormalTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Normal)`;
        adapter.geometryCoatNormalTexture = texture;
        if (properties.coatNormalTexture?.scale != void 0) {
          adapter.geometryCoatNormalTextureScale = properties.coatNormalTexture.scale;
        }
      }));
      adapter.setNormalMapInversions(!babylonMaterial.getScene().useRightHandedSystem, babylonMaterial.getScene().useRightHandedSystem);
    }
    adapter.coatDarkening = properties.coatDarkeningFactor !== void 0 ? properties.coatDarkeningFactor : 1;
    adapter.coatIor = properties.coatIor !== void 0 ? properties.coatIor : 1.5;
    const colorFactor = Color3.White();
    if (properties.coatColorFactor !== void 0) {
      colorFactor.fromArray(properties.coatColorFactor);
    }
    adapter.coatColor = colorFactor;
    if (properties.coatColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatColorTexture`, properties.coatColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Color)`;
        adapter.coatColorTexture = texture;
      }));
    }
    const coatAnisotropyWeight = properties.coatAnisotropyStrength ?? 0;
    const coatAnisotropyAngle = properties.coatAnisotropyRotation ?? 0;
    adapter.coatRoughnessAnisotropy = coatAnisotropyWeight;
    adapter.geometryCoatTangentAngle = coatAnisotropyAngle;
    if (!this.useOpenPBR) {
      adapter.configureGltfStyleAnisotropy(true);
    }
    if (properties.coatAnisotropyTexture) {
      properties.coatAnisotropyTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatAnisotropyTexture`, properties.coatAnisotropyTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Anisotropy)`;
        adapter.geometryCoatTangentTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
export {
  KHR_materials_coat
};
