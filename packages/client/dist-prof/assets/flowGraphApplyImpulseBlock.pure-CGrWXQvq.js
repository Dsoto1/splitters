import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, h as RichTypeVector3 } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphApplyImpulseBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphApplyImpulseBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.body = this.registerDataInput("body", RichTypeAny);
    this.impulse = this.registerDataInput("impulse", RichTypeVector3);
    this.location = this.registerDataInput("location", RichTypeVector3);
  }
  /**
   * @internal
   */
  _execute(context, _callingSignal) {
    const physicsBody = this.body.getValue(context);
    if (!physicsBody) {
      this._reportError(context, "No physics body provided");
      this.out._activateSignal(context);
      return;
    }
    const impulseVec = this.impulse.getValue(context);
    const locationVec = this.location.getValue(context);
    physicsBody.applyImpulse(impulseVec, locationVec);
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphApplyImpulseBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphApplyImpulseBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphApplyImpulseBlock", FlowGraphApplyImpulseBlock);
}
export {
  FlowGraphApplyImpulseBlock,
  RegisterFlowGraphApplyImpulseBlock
};
