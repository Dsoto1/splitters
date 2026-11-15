import { a as FlowGraphExecutionBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphFlipFlopBlock extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.onOn = this._registerSignalOutput("onOn");
    this.onOff = this._registerSignalOutput("onOff");
    this.value = this.registerDataOutput("value", RichTypeBoolean);
  }
  _execute(context, _callingSignal) {
    let value = context._getExecutionVariable(this, "value", typeof this.config?.startValue === "boolean" ? !this.config.startValue : false);
    value = !value;
    context._setExecutionVariable(this, "value", value);
    this.value.setValue(value, context);
    if (value) {
      this.onOn._activateSignal(context);
    } else {
      this.onOff._activateSignal(context);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphFlipFlopBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphFlipFlopBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphFlipFlopBlock", FlowGraphFlipFlopBlock);
}
export {
  FlowGraphFlipFlopBlock,
  RegisterFlowGraphFlipFlopBlock
};
