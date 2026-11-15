import { aq as GLTFLoader, l as TmpVectors, V as Vector3, Q as Quaternion, M as Matrix, L as Logger, ar as unregisterGLTFExtension, as as registerGLTFExtension, at as ArrayItem } from "./babylon-PnzH6wcM.js";
const NAME = "EXT_mesh_gpu_instancing";
class EXT_mesh_gpu_instancing {
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
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      this._loader._disableInstancedMesh++;
      const promise = this._loader.loadNodeAsync(`/nodes/${node.index}`, node, assign);
      this._loader._disableInstancedMesh--;
      if (!node._primitiveBabylonMeshes) {
        return await promise;
      }
      const promises = new Array();
      let instanceCount = 0;
      const loadAttribute = (attribute) => {
        if (extension.attributes[attribute] == void 0) {
          promises.push(Promise.resolve(null));
          return;
        }
        const accessor = ArrayItem.Get(`${extensionContext}/attributes/${attribute}`, this._loader.gltf.accessors, extension.attributes[attribute]);
        promises.push(this._loader._loadFloatAccessorAsync(`/accessors/${accessor.bufferView}`, accessor));
        if (instanceCount === 0) {
          instanceCount = accessor.count;
        } else if (instanceCount !== accessor.count) {
          throw new Error(`${extensionContext}/attributes: Instance buffer accessors do not have the same count.`);
        }
      };
      loadAttribute("TRANSLATION");
      loadAttribute("ROTATION");
      loadAttribute("SCALE");
      loadAttribute("_COLOR_0");
      return await promise.then(async (babylonTransformNode) => {
        const [translationBuffer, rotationBuffer, scaleBuffer, colorBuffer] = await Promise.all(promises);
        const matrices = new Float32Array(instanceCount * 16);
        TmpVectors.Vector3[0].copyFromFloats(0, 0, 0);
        TmpVectors.Quaternion[0].copyFromFloats(0, 0, 0, 1);
        TmpVectors.Vector3[1].copyFromFloats(1, 1, 1);
        for (let i = 0; i < instanceCount; ++i) {
          translationBuffer && Vector3.FromArrayToRef(translationBuffer, i * 3, TmpVectors.Vector3[0]);
          rotationBuffer && Quaternion.FromArrayToRef(rotationBuffer, i * 4, TmpVectors.Quaternion[0]);
          scaleBuffer && Vector3.FromArrayToRef(scaleBuffer, i * 3, TmpVectors.Vector3[1]);
          Matrix.ComposeToRef(TmpVectors.Vector3[1], TmpVectors.Quaternion[0], TmpVectors.Vector3[0], TmpVectors.Matrix[0]);
          TmpVectors.Matrix[0].copyToArray(matrices, i * 16);
        }
        for (const babylonMesh of node._primitiveBabylonMeshes) {
          babylonMesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
          if (colorBuffer) {
            if (colorBuffer.length === instanceCount * 3) {
              babylonMesh.thinInstanceSetBuffer("color", colorBuffer, 3, true);
            } else if (colorBuffer.length === instanceCount * 4) {
              babylonMesh.thinInstanceSetBuffer("color", colorBuffer, 4, true);
            } else {
              Logger.Warn("Unexpected size of _COLOR_0 attribute for mesh " + babylonMesh.name);
            }
          }
        }
        return babylonTransformNode;
      });
    });
  }
}
let _Registered = false;
function RegisterEXT_mesh_gpu_instancing() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  unregisterGLTFExtension(NAME);
  registerGLTFExtension(NAME, true, (loader) => new EXT_mesh_gpu_instancing(loader));
}
export {
  EXT_mesh_gpu_instancing,
  RegisterEXT_mesh_gpu_instancing
};
