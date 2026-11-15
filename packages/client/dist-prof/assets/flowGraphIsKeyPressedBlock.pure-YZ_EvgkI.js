import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import { a as RichTypeString, b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
class FlowGraphIsKeyPressedBlock extends FlowGraphBlock {
  /**
   * Creates a new FlowGraphIsKeyPressedBlock.
   * @param config optional configuration
   */
  constructor(config) {
    super(config);
    this.key = this.registerDataInput("key", RichTypeString);
    this.withShift = this.registerDataInput("withShift", RichTypeBoolean);
    this.withCtrl = this.registerDataInput("withCtrl", RichTypeBoolean);
    this.withAlt = this.registerDataInput("withAlt", RichTypeBoolean);
    this.withMeta = this.registerDataInput("withMeta", RichTypeBoolean);
    this.withCommandOrCtrl = this.registerDataInput("withCommandOrCtrl", RichTypeBoolean);
    this.isPressed = this.registerDataOutput("isPressed", RichTypeBoolean);
  }
  /** @internal */
  _updateOutputs(context) {
    const coordinator = context.configuration.sceneEventCoordinator;
    if (!coordinator) {
      this.isPressed.setValue(false, context);
      return;
    }
    const keys = coordinator.pressedKeys;
    const keyCode = this.key.getValue(context);
    let pressed = keyCode ? keys.has(keyCode) : true;
    if (pressed && this.withShift.getValue(context)) {
      pressed = keys.has("ShiftLeft") || keys.has("ShiftRight");
    }
    if (pressed && this.withCtrl.getValue(context)) {
      pressed = keys.has("ControlLeft") || keys.has("ControlRight");
    }
    if (pressed && this.withAlt.getValue(context)) {
      pressed = keys.has("AltLeft") || keys.has("AltRight");
    }
    if (pressed && this.withMeta.getValue(context)) {
      pressed = keys.has("MetaLeft") || keys.has("MetaRight");
    }
    if (pressed && this.withCommandOrCtrl.getValue(context)) {
      pressed = keys.has("CommandOrControl");
    }
    this.isPressed.setValue(pressed, context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphIsKeyPressedBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphIsKeyPressedBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphIsKeyPressedBlock", FlowGraphIsKeyPressedBlock);
}
export {
  FlowGraphIsKeyPressedBlock,
  RegisterFlowGraphIsKeyPressedBlock
};
