import { at as ArrayItem, aq as GLTFLoader, aw as SpotLight, V as Vector3, P as PointLight, D as DirectionalLight, ax as Light, a as Color3 } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_lights_punctual";
class KHR_lights {
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
  loadNodeAsync(context, node, assign) {
    return GLTFLoader.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      this._loader._allMaterialsDirtyRequired = true;
      return await this._loader.loadNodeAsync(context, node, (babylonMesh) => {
        const light = ArrayItem.Get(extensionContext, this._lights, extension.light);
        const name = light.name || babylonMesh.name;
        const babylonLight = this._loader.babylonScene._executeWithBlockedEntityCollection(!!this._loader._assetContainer, () => {
          switch (light.type) {
            case "directional": {
              const babylonDirectionalLight = new DirectionalLight(name, Vector3.Backward(), this._loader.babylonScene);
              babylonDirectionalLight.position.setAll(0);
              return babylonDirectionalLight;
            }
            case "point":
              return new PointLight(name, Vector3.Zero(), this._loader.babylonScene);
            case "spot": {
              const babylonSpotLight = new SpotLight(name, Vector3.Zero(), Vector3.Backward(), 0, 1, this._loader.babylonScene);
              babylonSpotLight.angle = (light.spot && light.spot.outerConeAngle || Math.PI / 4) * 2;
              babylonSpotLight.innerAngle = (light.spot && light.spot.innerConeAngle || 0) * 2;
              return babylonSpotLight;
            }
            default:
              throw new Error(`${extensionContext}: Invalid light type (${light.type})`);
          }
        });
        babylonLight._parentContainer = this._loader._assetContainer;
        light._babylonLight = babylonLight;
        babylonLight.falloffType = Light.FALLOFF_GLTF;
        babylonLight.diffuse = light.color ? Color3.FromArray(light.color) : Color3.White();
        babylonLight.intensity = light.intensity == void 0 ? 1 : light.intensity;
        babylonLight.range = light.range == void 0 ? Number.MAX_VALUE : light.range;
        babylonLight.parent = babylonMesh;
        this._loader._babylonLights.push(babylonLight);
        GLTFLoader.AddPointerMetadata(babylonLight, extensionContext);
        assign(babylonMesh);
      });
    });
  }
}
export {
  KHR_lights
};
