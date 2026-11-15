import { e as FlowGraphEventBlock, _ as _IsDescendantOf } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { d as RichTypeNumber, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphPointerOutEventBlock extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.type = "PointerOut";
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber);
    this.targetMesh = this.registerDataInput("targetMesh", RichTypeAny, config?.targetMesh);
    this.meshOutOfPointer = this.registerDataOutput("meshOutOfPointer", RichTypeAny);
  }
  _executeEvent(context, payload) {
    const mesh = this.targetMesh.getValue(context);
    this.meshOutOfPointer.setValue(payload.mesh, context);
    this.pointerId.setValue(payload.pointerId, context);
    const skipEvent = payload.over && (payload.over === mesh || _IsDescendantOf(payload.over, mesh));
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
    return "FlowGraphPointerOutEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPointerOutEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPointerOutEventBlock", FlowGraphPointerOutEventBlock);
}
export {
  FlowGraphPointerOutEventBlock,
  RegisterFlowGraphPointerOutEventBlock
};
