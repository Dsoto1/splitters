import { aq as GLTFLoader, a as Color3 } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_materials_pbrSpecularGlossiness";
class KHR_materials_pbrSpecularGlossiness {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 200;
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
      promises.push(this._loader.loadMaterialBasePropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadSpecularGlossinessPropertiesAsync(extensionContext, extension, babylonMaterial));
      this._loader.loadMaterialAlphaProperties(context, material, babylonMaterial);
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadSpecularGlossinessPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureSpecularGlossiness();
    if (properties.diffuseFactor) {
      adapter.baseColor = Color3.FromArray(properties.diffuseFactor);
      babylonMaterial.alpha = properties.diffuseFactor[3];
    } else {
      adapter.baseColor = Color3.White();
    }
    adapter.specularColor = properties.specularFactor ? Color3.FromArray(properties.specularFactor) : Color3.White();
    adapter.glossiness = properties.glossinessFactor == void 0 ? 1 : properties.glossinessFactor;
    if (properties.diffuseTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/diffuseTexture`, properties.diffuseTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Diffuse)`;
        adapter.baseColorTexture = texture;
      }));
    }
    if (properties.specularGlossinessTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/specularGlossinessTexture`, properties.specularGlossinessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Specular Glossiness)`;
        adapter.specularColorTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
export {
  KHR_materials_pbrSpecularGlossiness
};
