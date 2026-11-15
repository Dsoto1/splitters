import { e as FlowGraphEventBlock, _ as _IsDescendantOf } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphPointerMoveEventBlock extends FlowGraphEventBlock {
  /**
   * Creates a new FlowGraphPointerMoveEventBlock.
   * @param config optional configuration
   */
  constructor(config) {
    super(config);
    this.type = "PointerMove";
    this.targetMesh = this.registerDataInput("targetMesh", RichTypeAny, config?.targetMesh);
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber);
    this.meshUnderPointer = this.registerDataOutput("meshUnderPointer", RichTypeAny);
    this.pickedPoint = this.registerDataOutput("pickedPoint", RichTypeAny);
  }
  /** @internal */
  _executeEvent(context, pointerInfo) {
    const mesh = this.targetMesh.getValue(context);
    const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
    if (mesh && !(pickedMesh === mesh || pickedMesh && _IsDescendantOf(pickedMesh, mesh))) {
      return true;
    }
    this.pointerId.setValue(pointerInfo.event.pointerId, context);
    this.meshUnderPointer.setValue(pickedMesh ?? null, context);
    this.pickedPoint.setValue(pointerInfo.pickInfo?.pickedPoint ?? null, context);
    this._execute(context);
    return !this.config?.stopPropagation;
  }
  /** @internal */
  _preparePendingTasks(_context) {
  }
  /** @internal */
  _cancelPendingTasks(_context) {
  }
  /**
   * @returns the class name of the block.
   */
  getClassName() {
    return "FlowGraphPointerMoveEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPointerMoveEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPointerMoveEventBlock", FlowGraphPointerMoveEventBlock);
}
export {
  FlowGraphPointerMoveEventBlock,
  RegisterFlowGraphPointerMoveEventBlock
};
