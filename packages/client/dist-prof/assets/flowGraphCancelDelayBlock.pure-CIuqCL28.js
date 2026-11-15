import { F as FlowGraphExecutionBlockWithOutSignal, g as getNumericValue, M as MarkDelayInactive } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { c as RichTypeFlowGraphInteger } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphCancelDelayBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Creates a delay cancellation block.
   * @param config optional invalid-index handling
   */
  constructor(config) {
    super(config);
    this.delayIndex = this.registerDataInput("delayIndex", RichTypeFlowGraphInteger);
  }
  _execute(context, _callingSignal) {
    const delayIndex = getNumericValue(this.delayIndex.getValue(context));
    if (delayIndex < 0 || isNaN(delayIndex) || !isFinite(delayIndex)) {
      if (this.config?.ignoreInvalidDelay) {
        this.out._activateSignal(context);
        return;
      }
      return this._reportError(context, "Invalid delay index");
    }
    const timers = context._getGlobalContextVariable("pendingDelays", []);
    const timer = timers[delayIndex];
    if (timer) {
      timer.dispose();
      delete timers[delayIndex];
      context._setGlobalContextVariable("pendingDelays", timers);
    }
    MarkDelayInactive(context, delayIndex);
    this.out._activateSignal(context);
  }
  getClassName() {
    return "FlowGraphCancelDelayBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphCancelDelayBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphCancelDelayBlock", FlowGraphCancelDelayBlock);
}
export {
  FlowGraphCancelDelayBlock,
  RegisterFlowGraphCancelDelayBlock
};
