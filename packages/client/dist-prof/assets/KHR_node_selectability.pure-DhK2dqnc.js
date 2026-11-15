import { a as addNewInteractivityFlowGraphMapping } from "./declarationMapper-Hl5Q9jGZ.js";
import { aA as AddObjectAccessorToKey } from "./babylon-PnzH6wcM.js";
import { I as InitializeInteractivityNodeState, G as GetInteractivityNodeRuntimeReference, S as SetInteractivityNodeState, a as GetInteractivityNodeState } from "./interactivityNodeReference-C-aTZQuu.js";
import "./flowGraphRichTypes-B7BqVpav.js";
const NAME = "KHR_node_selectability";
class KHR_node_selectability {
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
    InitializeInteractivityNodeState(this._loader.gltf.nodes ?? [], "selectable", (node) => node.extensions?.KHR_node_selectability?.selectable);
  }
  dispose() {
    this._loader = null;
  }
}
let _RuntimeRegistered = false;
function _RegisterKHRNodeSelectabilityRuntime() {
  if (_RuntimeRegistered) {
    return;
  }
  _RuntimeRegistered = true;
  addNewInteractivityFlowGraphMapping("event/onSelect", NAME, {
    // using GetVariable as the nodeIndex is a configuration and not a value (i.e. it's not mutable)
    blocks: [
      "FlowGraphMeshPickEventBlock",
      "FlowGraphGetVariableBlock",
      "FlowGraphIndexOfBlock",
      "KHR_interactivity/FlowGraphGLTFDataProvider",
      "KHR_interactivity/FlowGraphEventReferenceBlock"
    ],
    declarationSchema: {
      inputValueSockets: {},
      outputValueSockets: {
        selectedNode: "ref",
        selectionRayOrigin: "float3",
        selectionPoint: "float3",
        controllerIndex: "int",
        event: "ref"
      }
    },
    declarationSchemaVariants: [
      {
        inputValueSockets: {},
        outputValueSockets: { selectedNode: "ref", selectionRayOrigin: "float3", selectionPoint: "float3", controllerIndex: "int" }
      },
      {
        inputValueSockets: {},
        outputValueSockets: { selectedNode: "ref", rayOrigin: "float3", selectionPoint: "float3", controllerIndex: "int" }
      }
    ],
    configuration: {
      nodeIndex: {
        name: "variable",
        configurationType: "int",
        toBlock: "FlowGraphGetVariableBlock",
        indexSource: "assetNodes",
        invalidUsesDefault: true,
        dataTransformer(data) {
          return "pickedMesh_" + data;
        }
      }
    },
    outputs: {
      values: {
        selectedNodeIndex: {
          name: "index",
          toBlock: "FlowGraphIndexOfBlock"
          /* FlowGraphBlockNames.IndexOf */
        },
        // `selectedNode` is the new ref-typed output from the Opaque-Reference
        // spec update. It's the picked Babylon mesh itself, available directly
        // from FlowGraphMeshPickEventBlock.pickedMesh — no IndexOf lookup needed.
        selectedNode: { name: "nodeReference", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        controllerIndex: { name: "controllerIndex", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        selectionPoint: { name: "selectionPoint", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        selectionRayOrigin: { name: "selectionRayOrigin", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        rayOrigin: { name: "selectionRayOrigin", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" },
        event: { name: "value", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" }
      },
      flows: {
        out: { name: "out", toBlock: "KHR_interactivity/FlowGraphEventReferenceBlock" }
      }
    },
    interBlockConnectors: [
      {
        input: "asset",
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
        output: "pickedMesh",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "node",
        output: "pickedMesh",
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
        input: "selectionPointInput",
        output: "pickedPoint",
        inputBlockIndex: 4,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "selectionRayOriginInput",
        output: "pickOrigin",
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
      const variableName = validNodeIndex ? "pickedMesh_" + nodeIndex : "pickedMesh_unbound";
      serializedObjects[1].config.variable = variableName;
      context._userVariables[variableName] = validNodeIndex ? GetInteractivityNodeRuntimeReference(globalGLTF?.nodes?.[nodeIndex]) : { type: "any", value: [{}] };
      const eventKey = `${NAME}:event/onSelect:${nodeIndex}`;
      serializedObjects[0].config.eventKey = eventKey;
      serializedObjects[0].config.useNaNDefaults = true;
      serializedObjects[0].config.pointerIdDefault = -1;
      serializedObjects[4].config.eventKey = eventKey;
      return serializedObjects;
    }
  });
  AddObjectAccessorToKey("/nodes/{}/extensions/KHR_node_selectability/selectable", {
    get: (node) => {
      return GetInteractivityNodeState(node, "selectable");
    },
    set: (value, node) => {
      SetInteractivityNodeState(node, "selectable", value);
    },
    getTarget: (node) => node._babylonTransformNode,
    getPropertyName: [() => "isPickable"],
    type: "boolean"
  });
}
export {
  KHR_node_selectability,
  _RegisterKHRNodeSelectabilityRuntime
};
