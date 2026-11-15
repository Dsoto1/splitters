import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphPauseSoundBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphPauseSoundBlock.
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
    if (soundValue.state === 5) {
      soundValue.resume();
    } else if (soundValue.state === 2 || soundValue.state === 3) {
      soundValue.pause();
    }
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphPauseSoundBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPauseSoundBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPauseSoundBlock", FlowGraphPauseSoundBlock);
}
export {
  FlowGraphPauseSoundBlock,
  RegisterFlowGraphPauseSoundBlock
};
