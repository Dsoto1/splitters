import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphContextBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.userVariables = this.registerDataOutput("userVariables", RichTypeAny);
    this.executionId = this.registerDataOutput("executionId", RichTypeNumber);
  }
  _updateOutputs(context) {
    this.userVariables.setValue(context.userVariables, context);
    this.executionId.setValue(context.executionId, context);
  }
  serialize(serializationObject) {
    super.serialize(serializationObject);
  }
  getClassName() {
    return "FlowGraphContextBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphContextBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphContextBlock", FlowGraphContextBlock);
}
export {
  FlowGraphContextBlock,
  RegisterFlowGraphContextBlock
};
