import { e as FlowGraphEventBlock, h as _IsMacPlatform } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { a as RichTypeString, b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
class FlowGraphKeyboardEventBlock extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.key = this.registerDataInput("key", RichTypeString);
    this.keyCode = this.registerDataOutput("keyCode", RichTypeString);
    this.keyValue = this.registerDataOutput("keyValue", RichTypeString);
    this.shiftKey = this.registerDataOutput("shiftKey", RichTypeBoolean);
    this.ctrlKey = this.registerDataOutput("ctrlKey", RichTypeBoolean);
    this.altKey = this.registerDataOutput("altKey", RichTypeBoolean);
    this.metaKey = this.registerDataOutput("metaKey", RichTypeBoolean);
    this.commandOrCtrl = this.registerDataOutput("commandOrCtrl", RichTypeBoolean);
  }
  /** @internal */
  _executeEvent(context, keyboardInfo) {
    const evt = keyboardInfo.event;
    const filterKey = this.key.getValue(context);
    if (filterKey && filterKey !== evt.code) {
      return true;
    }
    this.keyCode.setValue(evt.code, context);
    this.keyValue.setValue(evt.key, context);
    this.shiftKey.setValue(evt.shiftKey, context);
    this.ctrlKey.setValue(evt.ctrlKey, context);
    this.altKey.setValue(evt.altKey, context);
    this.metaKey.setValue(evt.metaKey, context);
    this.commandOrCtrl.setValue(_IsMacPlatform ? evt.metaKey : evt.ctrlKey, context);
    this._execute(context);
    return !this.config?.stopPropagation;
  }
  /** @internal */
  _preparePendingTasks(_context) {
  }
  /** @internal */
  _cancelPendingTasks(_context) {
  }
}
export {
  FlowGraphKeyboardEventBlock as F
};
