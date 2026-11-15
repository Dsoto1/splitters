import { aq as GLTFLoader } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_dispersion";
class KHR_materials_dispersion {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 174;
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
      promises.push(this._loadDispersionPropertiesAsync(extensionContext, material, babylonMaterial, extension));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadDispersionPropertiesAsync(context, material, babylonMaterial, extension) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    if (adapter.transmissionWeight == 0 || !extension.dispersion) {
      return Promise.resolve();
    }
    adapter.transmissionDispersionAbbeNumber = 20;
    adapter.transmissionDispersionScale = extension.dispersion;
    return Promise.resolve();
  }
}
export {
  KHR_materials_dispersion
};
