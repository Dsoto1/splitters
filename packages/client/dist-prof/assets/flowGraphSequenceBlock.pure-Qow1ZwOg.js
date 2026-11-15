import { a as FlowGraphExecutionBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import "./flowGraphRichTypes-B7BqVpav.js";
class FlowGraphSequenceBlock extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.executionSignals = [];
    this.setNumberOfOutputSignals(this.config.outputSignalCount);
  }
  _execute(context) {
    for (let i = 0; i < this.executionSignals.length; i++) {
      this.executionSignals[i]._activateSignal(context);
    }
  }
  /**
   * Sets the block's output flows. Would usually be passed from the constructor but can be changed afterwards.
   * @param outputSignalCount the number of output flows
   */
  setNumberOfOutputSignals(outputSignalCount = 1) {
    while (this.executionSignals.length > outputSignalCount) {
      const flow = this.executionSignals.pop();
      if (flow) {
        flow.disconnectFromAll();
        this._unregisterSignalOutput(flow.name);
      }
    }
    while (this.executionSignals.length < outputSignalCount) {
      this.executionSignals.push(this._registerSignalOutput(`out_${this.executionSignals.length}`));
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSequenceBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSequenceBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSequenceBlock", FlowGraphSequenceBlock);
}
export {
  FlowGraphSequenceBlock,
  RegisterFlowGraphSequenceBlock
};
