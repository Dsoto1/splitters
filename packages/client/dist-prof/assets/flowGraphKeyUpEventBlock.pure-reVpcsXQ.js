import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import { F as FlowGraphKeyboardEventBlock } from "./flowGraphKeyboardEventBlock-Ib-99Tqp.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
import "./flowGraphRichTypes-B7BqVpav.js";
class FlowGraphKeyUpEventBlock extends FlowGraphKeyboardEventBlock {
  /**
   * Creates a new FlowGraphKeyUpEventBlock.
   * @param config optional configuration
   */
  constructor(config) {
    super(config);
    this.type = "KeyUp";
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphKeyUpEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphKeyUpEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphKeyUpEventBlock", FlowGraphKeyUpEventBlock);
}
export {
  FlowGraphKeyUpEventBlock,
  RegisterFlowGraphKeyUpEventBlock
};
