import { e as FlowGraphEventBlock, f as FlowGraphCoordinator, d as defaultValueSerializationFunction } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass, L as Logger } from "./babylon-PnzH6wcM.js";
import { g as getRichTypeByFlowGraphType, a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
function GetFlowGraphCustomEventKey(eventId) {
  return `custom:${encodeURIComponent(eventId)}`;
}
class FlowGraphReceiveCustomEventBlock extends FlowGraphEventBlock {
  /** @returns the configured custom event id */
  get eventKey() {
    return GetFlowGraphCustomEventKey(this.config.eventId);
  }
  constructor(config) {
    super(config);
    this.config = config;
    this.initPriority = 1;
    for (const key of Object.keys(this.config.eventData ?? {})) {
      const entry = this.config.eventData[key];
      const typeKey = typeof entry.type === "string" ? entry.type : entry.type?.typeName;
      const richType = typeof entry.type?.serialize === "function" ? entry.type : getRichTypeByFlowGraphType(typeKey);
      entry.type = richType;
      this.registerDataOutput(key, richType, entry.value);
    }
    this.eventRef = this.config.eventData && Object.prototype.hasOwnProperty.call(this.config.eventData, "event") ? this.getDataOutput("event") : this.registerDataOutput("event", RichTypeString);
  }
  _updateOutputs(context) {
    this.eventRef.setValue(context.getEventReference(this.eventKey), context);
  }
  _preparePendingTasks(context) {
    const observable = context.configuration.coordinator.getCustomEventObservable(this.config.eventId);
    if (observable && observable.hasObservers() && observable.observers.length > FlowGraphCoordinator.MaxEventsPerType) {
      this._reportError(context, `FlowGraphReceiveCustomEventBlock: Too many observers for event ${this.config.eventId}. Max is ${FlowGraphCoordinator.MaxEventsPerType}.`);
      return;
    }
    const eventObserver = observable.add((eventData, eventState) => {
      context.configuration.coordinator._beginEventDispatch(this.eventKey, eventState);
      try {
        for (const key of Object.keys(this.config.eventData ?? {})) {
          const output = this.getDataOutput(key);
          if (!output) {
            continue;
          }
          const incoming = eventData?.[key];
          output.setValue(incoming === void 0 ? this._getEventDataDefault(key) : incoming, context);
        }
        this.eventRef.setValue(context.getEventReference(this.eventKey), context);
        this._execute(context);
      } finally {
        context.configuration.coordinator._endEventDispatch();
      }
    });
    context._setExecutionVariable(this, "_eventObserver", eventObserver);
  }
  /**
   * The value an output falls back to when the sender provides no value for it: the default
   * declared by the payload schema, or the socket type's default when the schema declares none.
   * @param key the payload key
   * @returns the default value for that key
   */
  _getEventDataDefault(key) {
    const entry = this.config.eventData && Object.prototype.hasOwnProperty.call(this.config.eventData, key) ? this.config.eventData[key] : void 0;
    return entry?.value !== void 0 ? entry.value : entry?.type?.defaultValue;
  }
  _cancelPendingTasks(context) {
    const observable = context.configuration.coordinator.getCustomEventObservable(this.config.eventId);
    if (observable) {
      const eventObserver = context._getExecutionVariable(this, "_eventObserver", null);
      observable.remove(eventObserver);
    } else {
      Logger.Warn(`FlowGraphReceiveCustomEventBlock: Missing observable for event ${this.config.eventId}`);
    }
  }
  _executeEvent(_context, _payload) {
    return true;
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
    return "FlowGraphReceiveCustomEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphReceiveCustomEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphReceiveCustomEventBlock", FlowGraphReceiveCustomEventBlock);
}
export {
  FlowGraphReceiveCustomEventBlock,
  GetFlowGraphCustomEventKey,
  RegisterFlowGraphReceiveCustomEventBlock
};
