import { e as FlowGraphEventBlock, _ as _IsDescendantOf } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { z as RegisterClass, V as Vector3, a2 as PointerEventTypes } from "./babylon-PnzH6wcM.js";
import { R as RichTypeAny, h as RichTypeVector3, d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
class FlowGraphMeshPickEventBlock extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.type = "MeshPick";
    const vectorDefault = config?.useNaNDefaults ? new Vector3(NaN, NaN, NaN) : void 0;
    this.asset = this.registerDataInput("asset", RichTypeAny, config?.targetMesh);
    this.pickedPoint = this.registerDataOutput("pickedPoint", RichTypeVector3, vectorDefault);
    this.pickOrigin = this.registerDataOutput("pickOrigin", RichTypeVector3, vectorDefault);
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber, config?.pointerIdDefault);
    this.pickedMesh = this.registerDataOutput("pickedMesh", RichTypeAny);
    this.pointerType = this.registerDataInput("pointerType", RichTypeAny, PointerEventTypes.POINTERPICK);
  }
  _getReferencedMesh(context) {
    return this.asset.getValue(context);
  }
  _executeEvent(context, pickedInfo) {
    const pointerType = this.pointerType.getValue(context);
    if (pointerType !== pickedInfo.type) {
      return true;
    }
    const mesh = this._getReferencedMesh(context);
    const pickedMesh = pickedInfo.pickInfo?.pickedMesh;
    const meshMatches = !mesh ? !!pickedMesh : !!(pickedMesh && (pickedMesh === mesh || _IsDescendantOf(pickedMesh, mesh)));
    if (meshMatches && pickedMesh) {
      this.pointerId.setValue(pickedInfo.event.pointerId, context);
      this.pickOrigin.setValue(pickedInfo.pickInfo.ray?.origin, context);
      this.pickedPoint.setValue(pickedInfo.pickInfo.pickedPoint, context);
      this.pickedMesh.setValue(pickedMesh, context);
      this._execute(context);
      return !this.config?.stopPropagation;
    } else {
      this.pointerId.resetToDefaultValue(context);
      this.pickOrigin.resetToDefaultValue(context);
      this.pickedPoint.resetToDefaultValue(context);
      this.pickedMesh.resetToDefaultValue(context);
    }
    return true;
  }
  /**
   * @internal
   */
  _preparePendingTasks(_context) {
  }
  /**
   * @internal
   */
  _cancelPendingTasks(_context) {
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphMeshPickEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphMeshPickEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphMeshPickEventBlock", FlowGraphMeshPickEventBlock);
}
export {
  FlowGraphMeshPickEventBlock,
  RegisterFlowGraphMeshPickEventBlock
};
