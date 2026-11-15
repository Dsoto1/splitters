import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphStopSoundBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphStopSoundBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.sound = this.registerDataInput("sound", RichTypeAny);
  }
  /**
   * @internal
   */
  _execute(context, _callingSignal) {
    const soundValue = this.sound.getValue(context);
    if (!soundValue) {
      this._reportError(context, "No sound provided");
      this.out._activateSignal(context);
      return;
    }
    soundValue.stop();
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphStopSoundBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphStopSoundBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphStopSoundBlock", FlowGraphStopSoundBlock);
}
export {
  FlowGraphStopSoundBlock,
  RegisterFlowGraphStopSoundBlock
};
