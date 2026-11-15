import { d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphThrottleBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Creates a throttle block.
   * @param config optional duration handling
   */
  constructor(config) {
    super(config);
    this.reset = this._registerSignalInput("reset");
    this.duration = this.registerDataInput("duration", RichTypeNumber);
    this.lastRemainingTime = this.registerDataOutput("lastRemainingTime", RichTypeNumber, NaN);
  }
  _execute(context, callingSignal) {
    if (callingSignal === this.reset) {
      this.lastRemainingTime.setValue(NaN, context);
      context._setExecutionVariable(this, "lastRemainingTime", NaN);
      context._setExecutionVariable(this, "timestamp", 0);
      return;
    }
    const durationValue = this.duration.getValue(context);
    if (durationValue < 0 || durationValue === 0 && !this.config?.allowZeroDuration || isNaN(durationValue) || !isFinite(durationValue)) {
      return this._reportError(context, "Invalid duration in Throttle block");
    }
    const lastRemainingTime = context._getExecutionVariable(this, "lastRemainingTime", NaN);
    const currentTime = Date.now();
    if (isNaN(lastRemainingTime)) {
      this.lastRemainingTime.setValue(0, context);
      context._setExecutionVariable(this, "lastRemainingTime", 0);
      context._setExecutionVariable(this, "timestamp", currentTime);
      return this.out._activateSignal(context);
    } else {
      const elapsedTime = currentTime - context._getExecutionVariable(this, "timestamp", 0);
      const durationInMs = durationValue * 1e3;
      if (durationInMs <= elapsedTime) {
        this.lastRemainingTime.setValue(0, context);
        context._setExecutionVariable(this, "lastRemainingTime", 0);
        context._setExecutionVariable(this, "timestamp", currentTime);
        return this.out._activateSignal(context);
      } else {
        const remainingTime = durationInMs - elapsedTime;
        this.lastRemainingTime.setValue(remainingTime / 1e3, context);
        context._setExecutionVariable(this, "lastRemainingTime", remainingTime);
      }
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphThrottleBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphThrottleBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphThrottleBlock", FlowGraphThrottleBlock);
}
export {
  FlowGraphThrottleBlock,
  RegisterFlowGraphThrottleBlock
};
