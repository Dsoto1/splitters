import { a as addNewInteractivityFlowGraphMapping } from "./declarationMapper-Hl5Q9jGZ.js";
import { aA as AddObjectAccessorToKey } from "./babylon-PnzH6wcM.js";
import { I as InitializeInteractivityNodeState, G as GetInteractivityNodeRuntimeReference, S as SetInteractivityNodeState, a as GetInteractivityNodeState } from "./interactivityNodeReference-C-aTZQuu.js";
import "./flowGraphRichTypes-B7BqVpav.js";
const NAME = "KHR_node_hoverability";
const MeshPointerOverPrefix = "targetMeshPointerOver_";
const MeshPointerOutPrefix = "targetMeshPointerOut_";
class KHR_node_hoverability {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 100;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME);
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-misused-promises
  async onReady() {
    InitializeInteractivityNodeState(this._loader.gltf.nodes ?? [], "hoverable", (node) => node.extensions?.KHR_node_hoverability?.hoverable);
  }
  dispose() {
    this._loader = null;
  }
}
let _RuntimeRegistered = false;
function _RegisterKHRNodeHoverabilityRuntime() {
  if (_RuntimeRegistered) {
    return;
  }
  _RuntimeRegistered = true;
  addNewInteractivityFlowGraphMapping("event/onHoverIn", NAME, {
    // using GetVariable as the nodeIndex is a configuration and not a value (i.e. it's not mutable)
    blocks: [
      "FlowGraphPointerOverEventBlock",
      "FlowGraphGetVariableBlock",
      "FlowGraphIndexOfBlock",
      "KHR_interactivity/FlowGraphGLTFDataProvider",
      "KHR_interactivity/FlowGraphEventReferenceBlock"
    ],
    declarationSchema: {
      inputValueSockets: {},
      outputValueSockets: {
        hoveredNode: "ref",
        controllerIndex: "int",
        event: "ref"
      }
    },
    declarationSchemaVariants: [{ inputValueSockets: {}, outputValueSockets: { hoveredNode: "ref", controllerIndex: "int" } }],
    configuration: {
      nodeIndex: {
        name: "variable",
        configurationType: "int",
        toBlock: "FlowGraphGetVariableBlock",
        indexSource: "assetNodes",
        invalidUsesDefault: true,
        dataTransformer(data) {
          return MeshPointerOverPrefix + data;
        }
      }
    },
    outputs: {
      values: {
        hoverNodeIndex: {
          name: "index",
          toBlock: "FlowGraphIndexOfBlock"
          /* FlowGraphBlockNames.IndexOf */
        },
        hoveredNode: { name: "nodeReference", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        controllerIndex: { name: "controllerIndex", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        event: { name: "value", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" }
      },
      flows: {
        out: { name: "out", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" }
      }
    },
    interBlockConnectors: [
      {
        input: "targetMesh",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "nodes",
        inputBlockIndex: 2,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "object",
        output: "meshUnderPointer",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "node",
        output: "meshUnderPointer",
        inputBlockIndex: 4,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "controllerIndexInput",
        output: "pointerId",
        inputBlockIndex: 4,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "in",
        output: "done",
        inputBlockIndex: 4,
        outputBlockIndex: 0
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, _arrays, serializedObjects, context, globalGLTF) {
      const nodeIndex = gltfBlock.configuration?.["nodeIndex"]?.value?.[0];
      const validNodeIndex = typeof nodeIndex === "number" && Number.isInteger(nodeIndex) && nodeIndex >= 0 && nodeIndex < (globalGLTF?.nodes?.length ?? 0);
      const variableName = validNodeIndex ? MeshPointerOverPrefix + nodeIndex : MeshPointerOverPrefix + "unbound";
      serializedObjects[1].config.variable = variableName;
      context._userVariables[variableName] = validNodeIndex ? GetInteractivityNodeRuntimeReference(globalGLTF?.nodes?.[nodeIndex]) : { type: "any", value: [{}] };
      const eventKey = `${NAME}:event/onHoverIn:${nodeIndex}`;
      serializedObjects[0].config.eventKey = eventKey;
      serializedObjects[4].config.eventKey = eventKey;
      return serializedObjects;
    }
  });
  addNewInteractivityFlowGraphMapping("event/onHoverOut", NAME, {
    // using GetVariable as the nodeIndex is a configuration and not a value (i.e. it's not mutable)
    blocks: [
      "FlowGraphPointerOutEventBlock",
      "FlowGraphGetVariableBlock",
      "FlowGraphIndexOfBlock",
      "KHR_interactivity/FlowGraphGLTFDataProvider",
      "KHR_interactivity/FlowGraphEventReferenceBlock"
    ],
    declarationSchema: {
      inputValueSockets: {},
      outputValueSockets: {
        hoveredNode: "ref",
        controllerIndex: "int",
        event: "ref"
      }
    },
    declarationSchemaVariants: [{ inputValueSockets: {}, outputValueSockets: { hoveredNode: "ref", controllerIndex: "int" } }],
    configuration: {
      nodeIndex: {
        name: "variable",
        configurationType: "int",
        toBlock: "FlowGraphGetVariableBlock",
        indexSource: "assetNodes",
        invalidUsesDefault: true,
        dataTransformer(data) {
          return MeshPointerOutPrefix + data;
        }
      }
    },
    outputs: {
      values: {
        hoverNodeIndex: {
          name: "index",
          toBlock: "FlowGraphIndexOfBlock"
          /* FlowGraphBlockNames.IndexOf */
        },
        hoveredNode: { name: "nodeReference", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        controllerIndex: { name: "controllerIndex", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        event: { name: "value", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" }
      },
      flows: {
        out: { name: "out", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" }
      }
    },
    interBlockConnectors: [
      {
        input: "targetMesh",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "nodes",
        inputBlockIndex: 2,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "object",
        output: "meshOutOfPointer",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "node",
        output: "meshOutOfPointer",
        inputBlockIndex: 4,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "controllerIndexInput",
        output: "pointerId",
        inputBlockIndex: 4,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "in",
        output: "done",
        inputBlockIndex: 4,
        outputBlockIndex: 0
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, _arrays, serializedObjects, context, globalGLTF) {
      const nodeIndex = gltfBlock.configuration?.["nodeIndex"]?.value?.[0];
      const validNodeIndex = typeof nodeIndex === "number" && Number.isInteger(nodeIndex) && nodeIndex >= 0 && nodeIndex < (globalGLTF?.nodes?.length ?? 0);
      const variableName = validNodeIndex ? MeshPointerOutPrefix + nodeIndex : MeshPointerOutPrefix + "unbound";
      serializedObjects[1].config.variable = variableName;
      context._userVariables[variableName] = validNodeIndex ? GetInteractivityNodeRuntimeReference(globalGLTF?.nodes?.[nodeIndex]) : { type: "any", value: [{}] };
      const eventKey = `${NAME}:event/onHoverOut:${nodeIndex}`;
      serializedObjects[0].config.eventKey = eventKey;
      serializedObjects[4].config.eventKey = eventKey;
      return serializedObjects;
    }
  });
  AddObjectAccessorToKey("/nodes/{}/extensions/KHR_node_hoverability/hoverable", {
    get: (node) => {
      return GetInteractivityNodeState(node, "hoverable");
    },
    set: (value, node) => {
      SetInteractivityNodeState(node, "hoverable", value);
    },
    getTarget: (node) => node._babylonTransformNode,
    getPropertyName: [() => "pointerOverDisableMeshTesting"],
    type: "boolean"
  });
}
export {
  KHR_node_hoverability,
  _RegisterKHRNodeHoverabilityRuntime
};
