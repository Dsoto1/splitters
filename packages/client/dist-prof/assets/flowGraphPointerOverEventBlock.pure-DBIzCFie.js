import { e as FlowGraphEventBlock, _ as _IsDescendantOf } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { d as RichTypeNumber, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphPointerOverEventBlock extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.type = "PointerOver";
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber);
    this.targetMesh = this.registerDataInput("targetMesh", RichTypeAny, config?.targetMesh);
    this.meshUnderPointer = this.registerDataOutput("meshUnderPointer", RichTypeAny);
  }
  _executeEvent(context, payload) {
    const mesh = this.targetMesh.getValue(context);
    this.meshUnderPointer.setValue(payload.mesh, context);
    const skipEvent = payload.out && (payload.out === mesh || _IsDescendantOf(payload.out, mesh));
    this.pointerId.setValue(payload.pointerId, context);
    if (!skipEvent && (payload.mesh === mesh || _IsDescendantOf(payload.mesh, mesh))) {
      this._execute(context);
      return !this.config?.stopPropagation;
    }
    return true;
  }
  /** @internal */
  _getReferencedMesh(context) {
    return this.targetMesh.getValue(context);
  }
  _preparePendingTasks(_context) {
  }
  _cancelPendingTasks(_context) {
  }
  getClassName() {
    return "FlowGraphPointerOverEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPointerOverEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPointerOverEventBlock", FlowGraphPointerOverEventBlock);
}
export {
  FlowGraphPointerOverEventBlock,
  RegisterFlowGraphPointerOverEventBlock
};
