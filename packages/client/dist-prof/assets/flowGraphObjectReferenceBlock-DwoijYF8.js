import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
import "./babylon-PnzH6wcM.js";
function GetInteractivityObjectReference(context, value) {
  let object = value;
  while (object) {
    const candidate = context.getObjectReference(object, "nodes");
    if (candidate?.startsWith("/nodes/")) {
      return candidate;
    }
    object = object.parent;
  }
  return "";
}
class FlowGraphObjectReferenceBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.object = this.registerDataInput("object", RichTypeAny);
    this.value = this.registerDataOutput("value", RichTypeString, "");
  }
  /** @internal */
  _updateOutputs(context) {
    this.value.setValue(GetInteractivityObjectReference(context, this.object.getValue(context)), context);
  }
  /** @returns the serialized class name */
  getClassName() {
    return "FlowGraphObjectReferenceBlock";
  }
}
export {
  FlowGraphObjectReferenceBlock,
  GetInteractivityObjectReference
};
