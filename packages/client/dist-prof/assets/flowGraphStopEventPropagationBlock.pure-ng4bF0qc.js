import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { a as RichTypeString, b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphStopEventPropagationBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.event = this.registerDataInput("event", RichTypeString);
    this.stopImmediate = this.registerDataInput("stopImmediate", RichTypeBoolean, false);
  }
  _execute(context) {
    const event = this.event.getValue(context);
    const stopImmediate = this.stopImmediate.getValue(context);
    context.configuration.coordinator.stopEventPropagation(event, stopImmediate);
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphStopEventPropagationBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphStopEventPropagationBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphStopEventPropagationBlock", FlowGraphStopEventPropagationBlock);
}
export {
  FlowGraphStopEventPropagationBlock,
  RegisterFlowGraphStopEventPropagationBlock
};
