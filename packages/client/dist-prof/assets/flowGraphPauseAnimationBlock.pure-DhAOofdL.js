import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphPauseAnimationBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.animationToPause = this.registerDataInput("animationToPause", RichTypeAny);
  }
  _execute(context) {
    const animationToPauseValue = this.animationToPause.getValue(context);
    animationToPauseValue.pause();
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphPauseAnimationBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPauseAnimationBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPauseAnimationBlock", FlowGraphPauseAnimationBlock);
}
export {
  FlowGraphPauseAnimationBlock,
  RegisterFlowGraphPauseAnimationBlock
};
