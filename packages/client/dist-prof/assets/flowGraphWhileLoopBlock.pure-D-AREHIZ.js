import { b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass, L as Logger } from "./babylon-PnzH6wcM.js";
class FlowGraphWhileLoopBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.config = config;
    this.condition = this.registerDataInput("condition", RichTypeBoolean);
    this.executionFlow = this._registerSignalOutput("executionFlow");
    this.completed = this._registerSignalOutput("completed");
    this._unregisterSignalOutput("out");
  }
  _execute(context, _callingSignal) {
    let conditionValue = this.condition.getValue(context);
    if (this.config?.doWhile && !conditionValue) {
      this.executionFlow._activateSignal(context);
    }
    let i = 0;
    while (conditionValue) {
      this.executionFlow._activateSignal(context);
      ++i;
      if (i >= FlowGraphWhileLoopBlock.MaxLoopCount) {
        Logger.Warn("FlowGraphWhileLoopBlock: Max loop count reached. Breaking.");
        break;
      }
      conditionValue = this.condition.getValue(context);
    }
    this.completed._activateSignal(context);
  }
  getClassName() {
    return "FlowGraphWhileLoopBlock";
  }
}
FlowGraphWhileLoopBlock.MaxLoopCount = 1e3;
let _Registered = false;
function RegisterFlowGraphWhileLoopBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphWhileLoopBlock", FlowGraphWhileLoopBlock);
}
export {
  FlowGraphWhileLoopBlock,
  RegisterFlowGraphWhileLoopBlock
};
