import { aq as GLTFLoader } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_iridescence";
class KHR_materials_iridescence {
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
      promises.push(this._loadIridescencePropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadIridescencePropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.thinFilmWeight = properties.iridescenceFactor ?? 0;
    adapter.thinFilmIor = properties.iridescenceIor ?? properties.iridescenceIOR ?? 1.3;
    adapter.thinFilmThicknessMinimum = properties.iridescenceThicknessMinimum ?? 100;
    adapter.thinFilmThicknessMaximum = properties.iridescenceThicknessMaximum ?? 400;
    if (properties.iridescenceTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/iridescenceTexture`, properties.iridescenceTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Iridescence)`;
        adapter.thinFilmWeightTexture = texture;
      }));
    }
    if (properties.iridescenceThicknessTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/iridescenceThicknessTexture`, properties.iridescenceThicknessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Iridescence Thickness)`;
        adapter.thinFilmThicknessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
export {
  KHR_materials_iridescence
};
