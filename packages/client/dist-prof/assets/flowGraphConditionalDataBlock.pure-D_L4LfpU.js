import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { b as RichTypeBoolean, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphConditionalDataBlock extends FlowGraphBlock {
  /**
   * Creates a new instance of the block
   * @param config optional configuration for this block
   */
  constructor(config) {
    super(config);
    this.condition = this.registerDataInput("condition", RichTypeBoolean);
    this.onTrue = this.registerDataInput("onTrue", RichTypeAny);
    this.onFalse = this.registerDataInput("onFalse", RichTypeAny);
    this.output = this.registerDataOutput("output", RichTypeAny);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const condition = this.condition.getValue(context);
    this.output.setValue(condition ? this.onTrue.getValue(context) : this.onFalse.getValue(context), context);
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphConditionalBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphConditionalDataBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphConditionalBlock", FlowGraphConditionalDataBlock);
}
export {
  FlowGraphConditionalDataBlock,
  RegisterFlowGraphConditionalDataBlock
};
