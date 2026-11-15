import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphSetPhysicsMotionTypeBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Constructs a new FlowGraphSetPhysicsMotionTypeBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.body = this.registerDataInput("body", RichTypeAny);
    this.motionType = this.registerDataInput(
      "motionType",
      RichTypeNumber,
      2
      /* PhysicsMotionType.DYNAMIC */
    );
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
    physicsBody.setMotionType(this.motionType.getValue(context));
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSetPhysicsMotionTypeBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSetPhysicsMotionTypeBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSetPhysicsMotionTypeBlock", FlowGraphSetPhysicsMotionTypeBlock);
}
export {
  FlowGraphSetPhysicsMotionTypeBlock,
  RegisterFlowGraphSetPhysicsMotionTypeBlock
};
