import { at as ArrayItem, aq as GLTFLoader, aw as SpotLight, V as Vector3, ax as Light, a as Color3, G as Texture } from "./babylon-PnzH6wcM.js";
const NAME = "EXT_lights_ies";
class EXT_lights_ies {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    delete this._lights;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._lights = extension.lights;
      ArrayItem.Assign(this._lights);
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      this._loader._allMaterialsDirtyRequired = true;
      let babylonSpotLight;
      let light;
      const transformNode = await this._loader.loadNodeAsync(context, node, (babylonMesh) => {
        light = ArrayItem.Get(extensionContext, this._lights, extension.light);
        const name = light.name || babylonMesh.name;
        babylonSpotLight = this._loader.babylonScene._executeWithBlockedEntityCollection(!!this._loader._assetContainer, () => new SpotLight(name, Vector3.Zero(), Vector3.Backward(), 0, 1, this._loader.babylonScene));
        babylonSpotLight.angle = Math.PI / 2;
        babylonSpotLight.innerAngle = 0;
        babylonSpotLight._parentContainer = this._loader._assetContainer;
        light._babylonLight = babylonSpotLight;
        babylonSpotLight.falloffType = Light.FALLOFF_GLTF;
        babylonSpotLight.diffuse = extension.color ? Color3.FromArray(extension.color) : Color3.White();
        babylonSpotLight.intensity = extension.multiplier || 1;
        babylonSpotLight.range = Number.MAX_VALUE;
        babylonSpotLight.parent = babylonMesh;
        this._loader._babylonLights.push(babylonSpotLight);
        GLTFLoader.AddPointerMetadata(babylonSpotLight, extensionContext);
        assign(babylonMesh);
      });
      let bufferData;
      if (light.uri) {
        bufferData = await this._loader.loadUriAsync(context, light, light.uri);
      } else {
        const bufferView = ArrayItem.Get(`${context}/bufferView`, this._loader.gltf.bufferViews, light.bufferView);
        bufferData = await this._loader.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView);
      }
      babylonSpotLight.iesProfileTexture = new Texture(babylonSpotLight.name + "_iesProfile", this._loader.babylonScene, true, false, void 0, null, null, bufferData, true, void 0, void 0, void 0, void 0, ".ies");
      return transformNode;
    });
  }
}
export {
  EXT_lights_ies
};
