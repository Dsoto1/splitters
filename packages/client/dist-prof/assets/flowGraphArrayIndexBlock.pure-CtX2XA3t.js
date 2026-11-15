import { c as FlowGraphBlock, g as getNumericValue } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass, Y as FlowGraphInteger } from "./babylon-PnzH6wcM.js";
class FlowGraphArrayIndexBlock extends FlowGraphBlock {
  /**
   * Construct a FlowGraphArrayIndexBlock.
   * @param config construction parameters
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.array = this.registerDataInput("array", RichTypeAny);
    this.index = this.registerDataInput("index", RichTypeAny, new FlowGraphInteger(-1));
    this.value = this.registerDataOutput("value", RichTypeAny);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const array = this.array.getValue(context);
    const rawIndex = this.index.getValue(context);
    if (rawIndex === void 0 || rawIndex === null) {
      this.value.setValue(null, context);
      return;
    }
    let index;
    if (typeof rawIndex === "string") {
      const decoded = context.decodeIndexReference(rawIndex, this.config.referenceCollection);
      if (decoded === void 0) {
        this.value.setValue(null, context);
        return;
      }
      index = decoded;
    } else {
      index = getNumericValue(rawIndex);
    }
    if (array && index >= 0 && index < array.length) {
      this.value.setValue(array[index], context);
    } else {
      this.value.setValue(null, context);
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
    return "FlowGraphArrayIndexBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphArrayIndexBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphArrayIndexBlock", FlowGraphArrayIndexBlock);
}
export {
  FlowGraphArrayIndexBlock,
  RegisterFlowGraphArrayIndexBlock
};
