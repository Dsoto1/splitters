import { aq as GLTFLoader } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_clearcoat";
class KHR_materials_clearcoat {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 190;
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
      promises.push(this._loadClearCoatPropertiesAsync(extensionContext, extension, babylonMaterial));
      await Promise.all(promises);
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadClearCoatPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureCoat();
    adapter.coatWeight = properties.clearcoatFactor !== void 0 ? properties.clearcoatFactor : 0;
    adapter.coatRoughness = properties.clearcoatRoughnessFactor !== void 0 ? properties.clearcoatRoughnessFactor : 0;
    if (properties.clearcoatTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/clearcoatTexture`, properties.clearcoatTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (ClearCoat)`;
        adapter.coatWeightTexture = texture;
      }));
    }
    if (properties.clearcoatRoughnessTexture) {
      properties.clearcoatRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/clearcoatRoughnessTexture`, properties.clearcoatRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (ClearCoat Roughness)`;
        adapter.coatRoughnessTexture = texture;
      }));
    }
    if (properties.clearcoatNormalTexture) {
      properties.clearcoatNormalTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/clearcoatNormalTexture`, properties.clearcoatNormalTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (ClearCoat Normal)`;
        adapter.geometryCoatNormalTexture = texture;
        if (properties.clearcoatNormalTexture?.scale != void 0) {
          adapter.geometryCoatNormalTextureScale = properties.clearcoatNormalTexture.scale;
        }
      }));
      adapter.setNormalMapInversions(!babylonMaterial.getScene().useRightHandedSystem, babylonMaterial.getScene().useRightHandedSystem);
    }
    return Promise.all(promises).then(() => {
    });
  }
}
export {
  KHR_materials_clearcoat
};
