import { aq as GLTFLoader } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_anisotropy";
class KHR_materials_anisotropy {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 195;
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
      promises.push(this._loadAnisotropyPropertiesAsync(extensionContext, extension, babylonMaterial));
      await Promise.all(promises);
    });
  }
  async _loadAnisotropyPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    const anisotropyWeight = properties.anisotropyStrength ?? 0;
    const anisotropyAngle = properties.anisotropyRotation ?? 0;
    adapter.specularRoughnessAnisotropy = anisotropyWeight;
    adapter.geometryTangentAngle = anisotropyAngle;
    const extensions = properties.extensions ?? {};
    if (!extensions.EXT_materials_anisotropy_openpbr || !extensions.EXT_materials_anisotropy_openpbr.openPbrAnisotropyEnabled) {
      adapter.configureGltfStyleAnisotropy(true);
    }
    if (properties.anisotropyTexture) {
      properties.anisotropyTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/anisotropyTexture`, properties.anisotropyTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Anisotropy Intensity)`;
        adapter.geometryTangentTexture = texture;
      }));
    }
    await Promise.all(promises);
  }
}
export {
  KHR_materials_anisotropy
};
