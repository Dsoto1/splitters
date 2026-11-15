import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import { b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphKeyboardEventBlock } from "./flowGraphKeyboardEventBlock-Ib-99Tqp.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
class FlowGraphKeyDownEventBlock extends FlowGraphKeyboardEventBlock {
  /**
   * Creates a new FlowGraphKeyDownEventBlock.
   * @param config optional configuration
   */
  constructor(config) {
    super(config);
    this.type = "KeyDown";
    this.isRepeat = this.registerDataOutput("isRepeat", RichTypeBoolean);
  }
  /** @internal */
  _executeEvent(context, keyboardInfo) {
    const repeat = keyboardInfo.event.repeat ?? false;
    if (repeat && this.config?.ignoreRepeat) {
      return true;
    }
    this.isRepeat.setValue(repeat, context);
    return super._executeEvent(context, keyboardInfo);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphKeyDownEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphKeyDownEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphKeyDownEventBlock", FlowGraphKeyDownEventBlock);
}
export {
  FlowGraphKeyDownEventBlock,
  RegisterFlowGraphKeyDownEventBlock
};
