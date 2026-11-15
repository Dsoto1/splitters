import { h as RichTypeVector3, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import { z as RegisterClass, V as Vector3 } from "./babylon-PnzH6wcM.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
class FlowGraphGetLinearVelocityBlock extends FlowGraphCachedOperationBlock {
  /**
   * Constructs a new FlowGraphGetLinearVelocityBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(RichTypeVector3, config);
    this.body = this.registerDataInput("body", RichTypeAny);
  }
  /**
   * @internal
   */
  _doOperation(context) {
    const physicsBody = this.body.getValue(context);
    if (!physicsBody) {
      return void 0;
    }
    let result = context._getExecutionVariable(this, "_cachedVelocity", null);
    if (!result) {
      result = new Vector3();
      context._setExecutionVariable(this, "_cachedVelocity", result);
    }
    physicsBody.getLinearVelocityToRef(result);
    return result;
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphGetLinearVelocityBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphGetLinearVelocityBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphGetLinearVelocityBlock", FlowGraphGetLinearVelocityBlock);
}
export {
  FlowGraphGetLinearVelocityBlock,
  RegisterFlowGraphGetLinearVelocityBlock
};
