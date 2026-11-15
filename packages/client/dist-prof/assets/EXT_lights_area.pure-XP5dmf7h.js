import { at as ArrayItem, aq as GLTFLoader, V as Vector3, ax as Light, a as Color3, T as TransformNode, Q as Quaternion } from "./babylon-PnzH6wcM.js";
import { R as RectAreaLight } from "./rectAreaLight.pure-6EsYnjQF.js";
const NAME = "EXT_lights_area";
class EXT_lights_area {
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
        const size = light.size !== void 0 ? light.size : 1;
        const babylonLight = this._loader.babylonScene._executeWithBlockedEntityCollection(!!this._loader._assetContainer, () => {
          switch (light.type) {
            case "rect": {
              const width = light.rect?.aspect !== void 0 ? light.rect.aspect * size : size;
              const height = size;
              return new RectAreaLight(name, Vector3.Zero(), width, height, this._loader.babylonScene);
            }
            case "disk": {
              const newSize = Math.sqrt(size * size * 0.25 * Math.PI);
              return new RectAreaLight(name, Vector3.Zero(), newSize, newSize, this._loader.babylonScene);
            }
            default:
              throw new Error(`${extensionContext}: Invalid area light type (${light.type})`);
          }
        });
        babylonLight._parentContainer = this._loader._assetContainer;
        light._babylonLight = babylonLight;
        babylonLight.falloffType = Light.FALLOFF_GLTF;
        babylonLight.diffuse = light.color ? Color3.FromArray(light.color) : Color3.White();
        babylonLight.intensity = light.intensity == void 0 ? 1 : light.intensity;
        const lightParentNode = new TransformNode(`${name}_orientation`, this._loader.babylonScene);
        lightParentNode.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.PI);
        lightParentNode.parent = babylonMesh;
        babylonLight.parent = lightParentNode;
        this._loader._babylonLights.push(babylonLight);
        GLTFLoader.AddPointerMetadata(babylonLight, extensionContext);
        assign(babylonMesh);
      });
    });
  }
}
export {
  EXT_lights_area
};
