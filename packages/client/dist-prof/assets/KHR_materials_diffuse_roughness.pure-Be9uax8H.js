import { aq as GLTFLoader } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_diffuse_roughness";
class KHR_materials_diffuse_roughness {
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
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadDiffuseRoughnessPropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadDiffuseRoughnessPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.baseDiffuseRoughness = properties.diffuseRoughnessFactor ?? 0;
    if (properties.diffuseRoughnessTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/diffuseRoughnessTexture`, properties.diffuseRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Diffuse Roughness)`;
        adapter.baseDiffuseRoughnessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
export {
  KHR_materials_diffuse_roughness
};
