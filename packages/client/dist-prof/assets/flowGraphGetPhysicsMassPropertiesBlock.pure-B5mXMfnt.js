import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber, h as RichTypeVector3 } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphGetPhysicsMassPropertiesBlock extends FlowGraphBlock {
  /**
   * Constructs a new FlowGraphGetPhysicsMassPropertiesBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.body = this.registerDataInput("body", RichTypeAny);
    this.mass = this.registerDataOutput("mass", RichTypeNumber);
    this.centerOfMass = this.registerDataOutput("centerOfMass", RichTypeVector3);
    this.inertia = this.registerDataOutput("inertia", RichTypeVector3);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const physicsBody = this.body.getValue(context);
    if (!physicsBody) {
      return;
    }
    const props = physicsBody.getMassProperties();
    if (props.mass !== void 0) {
      this.mass.setValue(props.mass, context);
    }
    if (props.centerOfMass) {
      this.centerOfMass.setValue(props.centerOfMass, context);
    }
    if (props.inertia) {
      this.inertia.setValue(props.inertia, context);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphGetPhysicsMassPropertiesBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphGetPhysicsMassPropertiesBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphGetPhysicsMassPropertiesBlock", FlowGraphGetPhysicsMassPropertiesBlock);
}
export {
  FlowGraphGetPhysicsMassPropertiesBlock,
  RegisterFlowGraphGetPhysicsMassPropertiesBlock
};
