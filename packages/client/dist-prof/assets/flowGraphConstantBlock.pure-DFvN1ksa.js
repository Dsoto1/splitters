import { c as FlowGraphBlock, d as defaultValueSerializationFunction } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { i as getRichTypeFromValue } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphConstantBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.output = this.registerDataOutput("output", getRichTypeFromValue(config.value));
  }
  _updateOutputs(context) {
    this.output.setValue(this.config.value, context);
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphConstantBlock";
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize to
   * @param valueSerializeFunction the function to use to serialize the value
   */
  serialize(serializationObject = {}, valueSerializeFunction = defaultValueSerializationFunction) {
    super.serialize(serializationObject);
    valueSerializeFunction("value", this.config.value, serializationObject.config);
  }
}
let _Registered = false;
function RegisterFlowGraphConstantBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphConstantBlock", FlowGraphConstantBlock);
}
export {
  FlowGraphConstantBlock,
  RegisterFlowGraphConstantBlock
};
