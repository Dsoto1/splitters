import { aq as GLTFLoader, a as Color3 } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_fuzz";
class KHR_materials_fuzz {
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
      promises.push(this._loadFuzzPropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadFuzzPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureFuzz();
    adapter.fuzzWeight = properties.fuzzFactor !== void 0 ? properties.fuzzFactor : 0;
    adapter.fuzzColor = properties.fuzzColorFactor !== void 0 ? Color3.FromArray(properties.fuzzColorFactor) : Color3.White();
    adapter.fuzzRoughness = properties.fuzzRoughnessFactor !== void 0 ? properties.fuzzRoughnessFactor : 0.5;
    if (properties.fuzzTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/fuzzTexture`, properties.fuzzTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Fuzz)`;
        adapter.fuzzWeightTexture = texture;
      }));
    }
    if (properties.fuzzColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/fuzzColorTexture`, properties.fuzzColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Fuzz Color)`;
        adapter.fuzzColorTexture = texture;
      }));
    }
    if (properties.fuzzRoughnessTexture) {
      properties.fuzzRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/fuzzRoughnessTexture`, properties.fuzzRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Fuzz Roughness)`;
        adapter.fuzzRoughnessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
export {
  KHR_materials_fuzz
};
