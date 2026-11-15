import { b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
import { a as FlowGraphExecutionBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphBranchBlock extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.condition = this.registerDataInput("condition", RichTypeBoolean);
    this.onTrue = this._registerSignalOutput("onTrue");
    this.onFalse = this._registerSignalOutput("onFalse");
  }
  _execute(context) {
    if (this.condition.getValue(context)) {
      this.onTrue._activateSignal(context);
    } else {
      this.onFalse._activateSignal(context);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphBranchBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphBranchBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphBranchBlock", FlowGraphBranchBlock);
}
export {
  FlowGraphBranchBlock,
  RegisterFlowGraphBranchBlock
};
