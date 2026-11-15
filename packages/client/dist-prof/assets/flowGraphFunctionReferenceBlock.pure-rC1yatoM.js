import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { a as RichTypeString, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphFunctionReferenceBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.functionName = this.registerDataInput("functionName", RichTypeString);
    this.object = this.registerDataInput("object", RichTypeAny);
    this.context = this.registerDataInput("context", RichTypeAny, null);
    this.output = this.registerDataOutput("output", RichTypeAny);
  }
  _updateOutputs(context) {
    const functionName = this.functionName.getValue(context);
    const object = this.object.getValue(context);
    const contextValue = this.context.getValue(context);
    if (object && functionName) {
      const func = object[functionName];
      if (func && typeof func === "function") {
        this.output.setValue(func.bind(contextValue), context);
      }
    }
  }
  getClassName() {
    return "FlowGraphFunctionReference";
  }
}
let _Registered = false;
function RegisterFlowGraphFunctionReferenceBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphFunctionReference", FlowGraphFunctionReferenceBlock);
}
export {
  FlowGraphFunctionReferenceBlock,
  RegisterFlowGraphFunctionReferenceBlock
};
