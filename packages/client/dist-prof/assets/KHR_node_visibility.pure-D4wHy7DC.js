import { aA as AddObjectAccessorToKey } from "./babylon-PnzH6wcM.js";
const NAME = "KHR_node_visibility";
class KHR_node_visibility {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME);
  }
  onReady() {
    if (!this._loader) {
      return;
    }
    const nodes = this._loader.gltf.nodes;
    if (nodes) {
      for (const node of nodes) {
        const babylonTransformNode = node._babylonTransformNode;
        if (babylonTransformNode) {
          babylonTransformNode.inheritVisibility = true;
          if (node.extensions && node.extensions.KHR_node_visibility && node.extensions.KHR_node_visibility.visible === false) {
            babylonTransformNode.isVisible = false;
            node._primitiveBabylonMeshes?.forEach((mesh) => {
              mesh.inheritVisibility = true;
              mesh.isVisible = false;
            });
          }
        }
      }
    }
  }
  dispose() {
    delete this._loader;
  }
}
let _RuntimeRegistered = false;
function _RegisterKHRNodeVisibilityRuntime() {
  if (_RuntimeRegistered) {
    return;
  }
  _RuntimeRegistered = true;
  AddObjectAccessorToKey("/nodes/{}/extensions/KHR_node_visibility/visible", {
    get: (node) => {
      const tn = node._babylonTransformNode;
      if (tn && tn.isVisible !== void 0) {
        return tn.isVisible;
      }
      return true;
    },
    set: (value, node) => {
      node._primitiveBabylonMeshes?.forEach((mesh) => {
        mesh.inheritVisibility = true;
      });
      if (node._babylonTransformNode) {
        node._babylonTransformNode.isVisible = value;
      }
      node._primitiveBabylonMeshes?.forEach((mesh) => {
        mesh.isVisible = value;
      });
    },
    getTarget: (node) => node._babylonTransformNode,
    getPropertyName: [() => "isVisible"],
    type: "boolean"
  });
}
export {
  KHR_node_visibility,
  _RegisterKHRNodeVisibilityRuntime
};
