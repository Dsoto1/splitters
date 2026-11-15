import { R as RichTypeAny, a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
function CloneInvalidValue(value, copies) {
  if (value === null || typeof value !== "object" && typeof value !== "function") {
    return value;
  }
  const clonedValues = copies ?? /* @__PURE__ */ new Map();
  if (clonedValues.has(value)) {
    return clonedValues.get(value);
  }
  const clone = value.clone;
  if (typeof clone === "function") {
    const result2 = clone.call(value);
    clonedValues.set(value, result2);
    return result2;
  }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    const result2 = structuredClone(value);
    clonedValues.set(value, result2);
    return result2;
  }
  const result = Array.isArray(value) ? new Array(value.length) : Object.create(prototype);
  clonedValues.set(value, result);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if ("value" in descriptor) {
      descriptor.value = CloneInvalidValue(descriptor.value, clonedValues);
    } else {
      descriptor.value = CloneInvalidValue(Reflect.get(value, key), clonedValues);
      delete descriptor.get;
      delete descriptor.set;
      descriptor.writable = true;
    }
    Object.defineProperty(result, key, descriptor);
  }
  return result;
}
class FlowGraphGetPropertyBlock extends FlowGraphCachedOperationBlock {
  /**
   * Constructs a new FlowGraphGetPropertyBlock.
   * @param config - the configuration of the block
   */
  constructor(config) {
    super(RichTypeAny, config);
    this.config = config;
    this.object = this.registerDataInput("object", RichTypeAny, config.object);
    this.propertyName = this.registerDataInput("propertyName", RichTypeString, config.propertyName);
    this.customGetFunction = this.registerDataInput("customGetFunction", RichTypeAny);
  }
  /**
   * Retrieves the property value from the target object.
   * @param context - the flow graph context
   * @returns the property value, or undefined if the target or property name is not set
   */
  _doOperation(context) {
    const getter = this.customGetFunction.getValue(context);
    let value;
    if (getter) {
      value = getter(this.object.getValue(context), this.propertyName.getValue(context), context);
    } else {
      const target = this.object.getValue(context);
      const propertyName = this.propertyName.getValue(context);
      value = target && propertyName ? this._getPropertyValue(target, propertyName) : void 0;
    }
    return value;
  }
  _getPropertyValue(target, propertyName) {
    const path = propertyName.split(".");
    let value = target;
    for (const prop of path) {
      value = value[prop];
      if (value === void 0) {
        return;
      }
    }
    return value;
  }
  _getInvalidOutputValue(context) {
    if (Object.prototype.hasOwnProperty.call(this.config, "invalidValue")) {
      return CloneInvalidValue(this.config.invalidValue);
    }
    return super._getInvalidOutputValue(context);
  }
  /**
   * Returns the class name of this block.
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphGetPropertyBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphGetPropertyBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphGetPropertyBlock", FlowGraphGetPropertyBlock);
}
export {
  FlowGraphGetPropertyBlock,
  RegisterFlowGraphGetPropertyBlock
};
