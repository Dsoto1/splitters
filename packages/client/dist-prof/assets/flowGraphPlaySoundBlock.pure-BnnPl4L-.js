import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber, b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphPlaySoundBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphPlaySoundBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.sound = this.registerDataInput("sound", RichTypeAny);
    this.volume = this.registerDataInput("volume", RichTypeNumber, 1);
    this.startOffset = this.registerDataInput("startOffset", RichTypeNumber, 0);
    this.loop = this.registerDataInput("loop", RichTypeBoolean, false);
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
    const vol = this.volume.getValue(context);
    const offset = this.startOffset.getValue(context);
    const loopVal = this.loop.getValue(context);
    soundValue.play({ volume: vol, startOffset: offset, loop: loopVal });
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphPlaySoundBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPlaySoundBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPlaySoundBlock", FlowGraphPlaySoundBlock);
}
export {
  FlowGraphPlaySoundBlock,
  RegisterFlowGraphPlaySoundBlock
};
