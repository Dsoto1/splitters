import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, c as RichTypeFlowGraphInteger } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass, Y as FlowGraphInteger } from "./babylon-PnzH6wcM.js";
class FlowGraphIndexOfBlock extends FlowGraphBlock {
  /**
   * Construct a FlowGraphIndexOfBlock.
   * @param config construction parameters
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.object = this.registerDataInput("object", RichTypeAny);
    this.array = this.registerDataInput("array", RichTypeAny);
    this.index = this.registerDataOutput("index", RichTypeFlowGraphInteger, new FlowGraphInteger(-1));
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const object = this.object.getValue(context);
    const array = this.array.getValue(context);
    if (array) {
      this.index.setValue(new FlowGraphInteger(array.indexOf(object)), context);
    }
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize to
   */
  serialize(serializationObject) {
    super.serialize(serializationObject);
  }
  getClassName() {
    return "FlowGraphIndexOfBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphIndexOfBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphIndexOfBlock", FlowGraphIndexOfBlock);
}
export {
  FlowGraphIndexOfBlock,
  RegisterFlowGraphIndexOfBlock
};
