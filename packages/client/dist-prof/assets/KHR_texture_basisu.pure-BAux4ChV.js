import { aq as GLTFLoader, at as ArrayItem } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_texture_basisu";
class KHR_texture_basisu {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadTextureAsync(context, texture, assign) {
    return GLTFLoader.LoadExtensionAsync(context, texture, this.name, async (extensionContext, extension) => {
      const sampler = texture.sampler == void 0 ? GLTFLoader.DefaultSampler : ArrayItem.Get(`${context}/sampler`, this._loader.gltf.samplers, texture.sampler);
      const image = ArrayItem.Get(`${extensionContext}/source`, this._loader.gltf.images, extension.source);
      return await this._loader._createTextureAsync(context, sampler, image, (babylonTexture) => {
        assign(babylonTexture);
      }, texture._textureInfo.nonColorData ? { useRGBAIfASTCBC7NotAvailableWhenUASTC: true } : void 0, !texture._textureInfo.nonColorData, texture);
    });
  }
}
export {
  KHR_texture_basisu
};
