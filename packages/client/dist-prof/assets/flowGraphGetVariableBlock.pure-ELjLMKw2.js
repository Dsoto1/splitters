import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphGetVariableBlock extends FlowGraphBlock {
  /**
   * Construct a FlowGraphGetVariableBlock.
   * @param config construction parameters
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.value = this.registerDataOutput("value", RichTypeAny, config.initialValue);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const variableNameValue = this.config.variable;
    if (context.hasVariable(variableNameValue)) {
      this.value.setValue(context.getVariable(variableNameValue), context);
    }
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize to
   */
  serialize(serializationObject) {
    super.serialize(serializationObject);
    serializationObject.config.variable = this.config.variable;
  }
  getClassName() {
    return "FlowGraphGetVariableBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphGetVariableBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphGetVariableBlock", FlowGraphGetVariableBlock);
}
export {
  FlowGraphGetVariableBlock,
  RegisterFlowGraphGetVariableBlock
};
