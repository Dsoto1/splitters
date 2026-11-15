import { g as getRichTypeByFlowGraphType } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphExecutionBlockWithOutSignal, d as defaultValueSerializationFunction } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphSendCustomEventBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.config = config;
    for (const key of Object.keys(this.config.eventData ?? {})) {
      const entry = this.config.eventData[key];
      const typeKey = typeof entry.type === "string" ? entry.type : entry.type?.typeName;
      const richType = typeof entry.type?.serialize === "function" ? entry.type : getRichTypeByFlowGraphType(typeKey);
      entry.type = richType;
      this.registerDataInput(key, richType, entry.value);
    }
  }
  _execute(context) {
    const eventId = this.config.eventId;
    const eventData = /* @__PURE__ */ Object.create(null);
    for (const port of this.dataInputs) {
      Object.defineProperty(eventData, port.name, {
        configurable: true,
        enumerable: true,
        value: port.getValue(context),
        writable: true
      });
    }
    context.configuration.coordinator.notifyCustomEvent(eventId, eventData);
    this.out._activateSignal(context);
  }
  serialize(serializationObject = {}) {
    super.serialize(serializationObject);
    const serializedEventData = /* @__PURE__ */ Object.create(null);
    for (const key of Object.keys(this.config.eventData ?? {})) {
      const entry = this.config.eventData[key];
      const serializedEntry = { type: entry.type.typeName };
      if (entry.value !== void 0) {
        defaultValueSerializationFunction("value", entry.value, serializedEntry);
      }
      Object.defineProperty(serializedEventData, key, {
        configurable: true,
        enumerable: true,
        value: serializedEntry,
        writable: true
      });
    }
    serializationObject.config.eventData = serializedEventData;
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSendCustomEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSendCustomEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSendCustomEventBlock", FlowGraphSendCustomEventBlock);
}
export {
  FlowGraphSendCustomEventBlock,
  RegisterFlowGraphSendCustomEventBlock
};
