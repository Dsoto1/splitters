import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphSetSoundVolumeBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphSetSoundVolumeBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.sound = this.registerDataInput("sound", RichTypeAny);
    this.volume = this.registerDataInput("volume", RichTypeNumber, 1);
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
    soundValue.volume = vol;
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSetSoundVolumeBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSetSoundVolumeBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSetSoundVolumeBlock", FlowGraphSetSoundVolumeBlock);
}
export {
  FlowGraphSetSoundVolumeBlock,
  RegisterFlowGraphSetSoundVolumeBlock
};
