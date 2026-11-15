import { d as RichTypeNumber, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
class FlowGraphGetSoundVolumeBlock extends FlowGraphCachedOperationBlock {
  /**
   * Constructs a new FlowGraphGetSoundVolumeBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(RichTypeNumber, config);
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
    return soundValue.volume;
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphGetSoundVolumeBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphGetSoundVolumeBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphGetSoundVolumeBlock", FlowGraphGetSoundVolumeBlock);
}
export {
  FlowGraphGetSoundVolumeBlock,
  RegisterFlowGraphGetSoundVolumeBlock
};
