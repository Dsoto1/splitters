import { F as FlowGraphExecutionBlockWithOutSignal, g as getNumericValue } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber, c as RichTypeFlowGraphInteger } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass, Y as FlowGraphInteger, L as Logger } from "./babylon-PnzH6wcM.js";
class FlowGraphForLoopBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.startIndex = this.registerDataInput("startIndex", RichTypeAny, 0);
    this.endIndex = this.registerDataInput("endIndex", RichTypeAny);
    this.step = this.registerDataInput("step", RichTypeNumber, 1);
    this.index = this.registerDataOutput("index", RichTypeFlowGraphInteger, new FlowGraphInteger(getNumericValue(config?.initialIndex ?? 0)));
    this.executionFlow = this._registerSignalOutput("executionFlow");
    this.completed = this._registerSignalOutput("completed");
    this._unregisterSignalOutput("out");
  }
  /**
   * @internal
   */
  _execute(context) {
    const index = getNumericValue(this.startIndex.getValue(context));
    const step = this.step.getValue(context);
    let endIndex = getNumericValue(this.endIndex.getValue(context));
    const maxIterations = this.config?.maxLoopIterations ?? FlowGraphForLoopBlock.MaxLoopIterations;
    let iterations = 0;
    let truncated = false;
    if (this.config?.incrementIndexWhenLoopDone && !(index < endIndex)) {
      this.index.setValue(new FlowGraphInteger(index), context);
    }
    for (let i = index; i < endIndex; i += step) {
      this.index.setValue(new FlowGraphInteger(i), context);
      this.executionFlow._activateSignal(context);
      endIndex = getNumericValue(this.endIndex.getValue(context));
      if (++iterations >= maxIterations) {
        truncated = true;
        break;
      }
    }
    if (truncated) {
      Logger.Warn(`FlowGraphForLoopBlock: loop stopped after reaching the ${maxIterations}-iteration safety cap before its range completed.`);
    }
    if (this.config?.incrementIndexWhenLoopDone && iterations > 0) {
      this.index.setValue(new FlowGraphInteger(getNumericValue(this.index.getValue(context)) + step), context);
    }
    this.completed._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphForLoopBlock";
  }
}
FlowGraphForLoopBlock.MaxLoopIterations = 1e3;
let _Registered = false;
function RegisterFlowGraphForLoopBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphForLoopBlock", FlowGraphForLoopBlock);
}
export {
  FlowGraphForLoopBlock,
  RegisterFlowGraphForLoopBlock
};
