import { e as FlowGraphEventBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, h as RichTypeVector3, d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
class FlowGraphPhysicsCollisionEventBlock extends FlowGraphEventBlock {
  /**
   * Constructs a new FlowGraphPhysicsCollisionEventBlock.
   * @param config - optional configuration for the block
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.body = this.registerDataInput("body", RichTypeAny);
    this.otherBody = this.registerDataOutput("otherBody", RichTypeAny);
    this.point = this.registerDataOutput("point", RichTypeVector3);
    this.normal = this.registerDataOutput("normal", RichTypeVector3);
    this.impulse = this.registerDataOutput("impulse", RichTypeNumber);
    this.distance = this.registerDataOutput("distance", RichTypeNumber);
  }
  /**
   * @internal
   */
  _preparePendingTasks(context) {
    const physicsBody = this.body.getValue(context);
    if (!physicsBody) {
      this._reportError(context, "No physics body provided for collision event");
      return;
    }
    physicsBody.setCollisionCallbackEnabled(true);
    const observer = physicsBody.getCollisionObservable().add((event) => {
      this._onCollision(context, event);
    });
    context._setExecutionVariable(this, "_collisionObserver", observer);
    context._setExecutionVariable(this, "_subscribedBody", physicsBody);
  }
  _onCollision(context, event) {
    const physicsBody = this.body.getValue(context);
    const other = event.collider === physicsBody ? event.collidedAgainst : event.collider;
    this.otherBody.setValue(other, context);
    if (event.point) {
      this.point.setValue(event.point, context);
    }
    if (event.normal) {
      this.normal.setValue(event.normal, context);
    }
    this.impulse.setValue(event.impulse, context);
    this.distance.setValue(event.distance, context);
    this._execute(context);
  }
  /**
   * @internal
   */
  _executeEvent(_context, _payload) {
    return true;
  }
  /**
   * @internal
   */
  _cancelPendingTasks(context) {
    const observer = context._getExecutionVariable(this, "_collisionObserver", null);
    const subscribedBody = context._getExecutionVariable(this, "_subscribedBody", null);
    if (observer && subscribedBody) {
      const observable = subscribedBody.getCollisionObservable();
      observable.remove(observer);
      if (!observable.hasObservers()) {
        subscribedBody.setCollisionCallbackEnabled(false);
      }
    }
    context._setExecutionVariable(this, "_collisionObserver", null);
    context._setExecutionVariable(this, "_subscribedBody", null);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphPhysicsCollisionEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPhysicsCollisionEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPhysicsCollisionEventBlock", FlowGraphPhysicsCollisionEventBlock);
}
export {
  FlowGraphPhysicsCollisionEventBlock,
  RegisterFlowGraphPhysicsCollisionEventBlock
};
