import { e as FlowGraphEventBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphSoundEndedEventBlock extends FlowGraphEventBlock {
  /**
   * Constructs a new FlowGraphSoundEndedEventBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.sound = this.registerDataInput("sound", RichTypeAny);
  }
  /**
   * @internal
   */
  _preparePendingTasks(context) {
    const soundValue = this.sound.getValue(context);
    if (!soundValue) {
      this._reportError(context, "No sound provided for sound-ended event");
      return;
    }
    const observer = soundValue.onEndedObservable.add(() => {
      this._execute(context);
    });
    context._setExecutionVariable(this, "_soundEndedObserver", observer);
    context._setExecutionVariable(this, "_subscribedSound", soundValue);
  }
  /**
   * @internal
   */
  _executeEvent(_context, _payload) {
    return true;
  }
  /**
   * @internal
   */
  _cancelPendingTasks(context) {
    const observer = context._getExecutionVariable(this, "_soundEndedObserver", null);
    const subscribedSound = context._getExecutionVariable(this, "_subscribedSound", null);
    if (observer && subscribedSound) {
      subscribedSound.onEndedObservable.remove(observer);
    }
    context._setExecutionVariable(this, "_soundEndedObserver", null);
    context._setExecutionVariable(this, "_subscribedSound", null);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSoundEndedEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSoundEndedEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSoundEndedEventBlock", FlowGraphSoundEndedEventBlock);
}
export {
  FlowGraphSoundEndedEventBlock,
  RegisterFlowGraphSoundEndedEventBlock
};
