import { b as RichTypeBoolean, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
class FlowGraphIsSoundPlayingBlock extends FlowGraphCachedOperationBlock {
  /**
   * Constructs a new FlowGraphIsSoundPlayingBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(RichTypeBoolean, config);
    this.sound = this.registerDataInput("sound", RichTypeAny);
  }
  /**
   * @internal
   */
  _doOperation(context) {
    const soundValue = this.sound.getValue(context);
    if (!soundValue) {
      return void 0;
    }
    return soundValue.state === 3 || soundValue.state === 2;
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphIsSoundPlayingBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphIsSoundPlayingBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphIsSoundPlayingBlock", FlowGraphIsSoundPlayingBlock);
}
export {
  FlowGraphIsSoundPlayingBlock,
  RegisterFlowGraphIsSoundPlayingBlock
};
