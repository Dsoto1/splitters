import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, h as RichTypeVector3 } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphSetAngularVelocityBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphSetAngularVelocityBlock.
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
    physicsBody.setAngularVelocity(this.velocity.getValue(context));
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSetAngularVelocityBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSetAngularVelocityBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSetAngularVelocityBlock", FlowGraphSetAngularVelocityBlock);
}
export {
  FlowGraphSetAngularVelocityBlock,
  RegisterFlowGraphSetAngularVelocityBlock
};
