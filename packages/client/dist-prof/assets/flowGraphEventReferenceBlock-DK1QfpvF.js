import { R as RichTypeAny, d as RichTypeNumber, h as RichTypeVector3, a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
import { a as FlowGraphExecutionBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { M as Matrix, V as Vector3 } from "./babylon-PnzH6wcM.js";
import { GetInteractivityObjectReference } from "./flowGraphObjectReferenceBlock-DwoijYF8.js";
class FlowGraphEventReferenceBlock extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this._assetInverse = Matrix.Identity();
    this._selectionPointValue = Vector3.Zero();
    this._selectionRayOriginValue = Vector3.Zero();
    const nanVector = new Vector3(NaN, NaN, NaN);
    this.node = this.registerDataInput("node", RichTypeAny);
    this.controllerIndexInput = this.registerDataInput("controllerIndexInput", RichTypeNumber, -1);
    this.selectionPointInput = this.registerDataInput("selectionPointInput", RichTypeVector3, nanVector);
    this.selectionRayOriginInput = this.registerDataInput("selectionRayOriginInput", RichTypeVector3, nanVector);
    this.nodeReference = this.registerDataOutput("nodeReference", RichTypeString, "");
    this.controllerIndex = this.registerDataOutput("controllerIndex", RichTypeNumber, -1);
    this.selectionPoint = this.registerDataOutput("selectionPoint", RichTypeVector3, nanVector);
    this.selectionRayOrigin = this.registerDataOutput("selectionRayOrigin", RichTypeVector3, nanVector);
    this.value = this.registerDataOutput("value", RichTypeString, "");
    this.out = this._registerSignalOutput("out");
  }
  /** @internal */
  _execute(context) {
    this.nodeReference.setValue(GetInteractivityObjectReference(context, this.node.getValue(context)), context);
    const pointerId = this.controllerIndexInput.getValue(context);
    if (pointerId < 0) {
      this.controllerIndex.setValue(-1, context);
    } else {
      const controllerIndices = context._getGlobalContextVariable("khrInteractivityControllerIndices", /* @__PURE__ */ new Map());
      let controllerIndex = controllerIndices.get(pointerId);
      if (controllerIndex === void 0) {
        controllerIndex = controllerIndices.size;
        controllerIndices.set(pointerId, controllerIndex);
        context._setGlobalContextVariable("khrInteractivityControllerIndices", controllerIndices);
      }
      this.controllerIndex.setValue(controllerIndex, context);
    }
    const node = this.node.getValue(context);
    let root = node?.parent;
    while (root?.parent) {
      root = root.parent;
    }
    if (root?.getWorldMatrix) {
      root.getWorldMatrix().invertToRef(this._assetInverse);
      Vector3.TransformCoordinatesToRef(this.selectionPointInput.getValue(context), this._assetInverse, this._selectionPointValue);
      Vector3.TransformCoordinatesToRef(this.selectionRayOriginInput.getValue(context), this._assetInverse, this._selectionRayOriginValue);
      this.selectionPoint.setValue(this._selectionPointValue, context);
      this.selectionRayOrigin.setValue(this._selectionRayOriginValue, context);
    } else {
      this.selectionPoint.setValue(this.selectionPointInput.getValue(context), context);
      this.selectionRayOrigin.setValue(this.selectionRayOriginInput.getValue(context), context);
    }
    this.value.setValue(context.getEventReference(this.config.eventKey ?? "gltf:manual"), context);
    this.out._activateSignal(context);
  }
  /** @returns the serialized class name */
  getClassName() {
    return "FlowGraphEventReferenceBlock";
  }
}
export {
  FlowGraphEventReferenceBlock
};
