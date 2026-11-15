import { aq as GLTFLoader, a as Color3 } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_sheen";
class KHR_materials_sheen {
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
      promises.push(this._loadSheenPropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadSheenPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureFuzz();
    const sheenColor = properties.sheenColorFactor !== void 0 ? Color3.FromArray(properties.sheenColorFactor) : Color3.Black();
    const sheenRoughness = properties.sheenRoughnessFactor !== void 0 ? properties.sheenRoughnessFactor : 0;
    adapter.fuzzWeight = 1;
    adapter.fuzzColor = sheenColor;
    adapter.fuzzRoughness = sheenRoughness;
    if (properties.sheenColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/sheenColorTexture`, properties.sheenColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Sheen Color)`;
        adapter.fuzzColorTexture = texture;
      }));
    }
    if (properties.sheenRoughnessTexture) {
      properties.sheenRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/sheenRoughnessTexture`, properties.sheenRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Sheen Roughness)`;
        adapter.fuzzRoughnessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
export {
  KHR_materials_sheen
};
