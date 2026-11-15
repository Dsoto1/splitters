import { d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphDebounceBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.count = this.registerDataInput("count", RichTypeNumber);
    this.reset = this._registerSignalInput("reset");
    this.currentCount = this.registerDataOutput("currentCount", RichTypeNumber);
  }
  _execute(context, callingSignal) {
    if (callingSignal === this.reset) {
      context._setExecutionVariable(this, "debounceCount", 0);
      return;
    }
    const count = this.count.getValue(context);
    const currentCount = context._getExecutionVariable(this, "debounceCount", 0);
    const newCount = currentCount + 1;
    this.currentCount.setValue(newCount, context);
    context._setExecutionVariable(this, "debounceCount", newCount);
    if (newCount >= count) {
      this.out._activateSignal(context);
      context._setExecutionVariable(this, "debounceCount", 0);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphDebounceBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphDebounceBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphDebounceBlock", FlowGraphDebounceBlock);
}
export {
  FlowGraphDebounceBlock,
  RegisterFlowGraphDebounceBlock
};
