import { aq as GLTFLoader } from "./babylon-PnzH6wcM.js";
const NAME = "MSFT_sRGBFactors";
class MSFT_sRGBFactors {
  /** @internal */
  constructor(loader) {
    this.name = NAME;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /** @internal*/
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader.LoadExtraAsync(context, material, this.name, async (extraContext, extra) => {
      if (extra) {
        const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
        const promise = this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial);
        const useExactSrgbConversions = babylonMaterial.getScene().getEngine().useExactSrgbConversions;
        if (!adapter.baseColorTexture) {
          adapter.baseColor.toLinearSpaceToRef(adapter.baseColor, useExactSrgbConversions);
        }
        if (!adapter.specularColorTexture) {
          adapter.specularColor.toLinearSpaceToRef(adapter.specularColor, useExactSrgbConversions);
        }
        return await promise;
      }
    });
  }
}
export {
  MSFT_sRGBFactors
};
