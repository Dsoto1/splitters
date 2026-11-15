import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, h as RichTypeVector3 } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphSetLinearVelocityBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphSetLinearVelocityBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.body = this.registerDataInput("body", RichTypeAny);
    this.velocity = this.registerDataInput("velocity", RichTypeVector3);
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
    physicsBody.setLinearVelocity(this.velocity.getValue(context));
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSetLinearVelocityBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSetLinearVelocityBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSetLinearVelocityBlock", FlowGraphSetLinearVelocityBlock);
}
export {
  FlowGraphSetLinearVelocityBlock,
  RegisterFlowGraphSetLinearVelocityBlock
};
