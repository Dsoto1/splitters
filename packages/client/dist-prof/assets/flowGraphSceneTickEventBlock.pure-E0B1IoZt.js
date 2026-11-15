import { e as FlowGraphEventBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { d as RichTypeNumber, a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
const EventKey = "sceneTick";
class FlowGraphSceneTickEventBlock extends FlowGraphEventBlock {
  /** @returns the shared scene-tick event key */
  get eventKey() {
    return EventKey;
  }
  /**
   * Creates a scene tick event block.
   * @param config optional clock behavior
   */
  constructor(config) {
    super(config);
    this.type = "SceneBeforeRender";
    this.timeSinceStart = this.registerDataOutput("timeSinceStart", RichTypeNumber, config?.useFirstTickAsStart ? NaN : 0);
    this.deltaTime = this.registerDataOutput("deltaTime", RichTypeNumber, config?.useFirstTickAsStart ? NaN : 0);
    this.eventRef = this.registerDataOutput("event", RichTypeString);
  }
  _updateOutputs(context) {
    this.eventRef.setValue(context.getEventReference(EventKey), context);
  }
  /**
   * @internal
   */
  _preparePendingTasks(_context) {
  }
  /**
   * @internal
   */
  _executeEvent(context, payload) {
    if (this.config?.useFirstTickAsStart) {
      const firstTick = context._getGlobalContextVariable("firstTickPayload", payload);
      context._setGlobalContextVariable("firstTickPayload", firstTick);
      const elapsedTime = payload.timeSinceStart - firstTick.timeSinceStart + payload.deltaTime - firstTick.deltaTime;
      this.timeSinceStart.setValue(payload === firstTick ? 0 : elapsedTime, context);
      this.deltaTime.setValue(payload === firstTick ? NaN : payload.deltaTime, context);
    } else {
      this.timeSinceStart.setValue(payload.timeSinceStart, context);
      this.deltaTime.setValue(payload.deltaTime, context);
    }
    this.eventRef.setValue(context.getEventReference(EventKey), context);
    this._execute(context);
    return true;
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
    return "FlowGraphSceneTickEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSceneTickEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSceneTickEventBlock", FlowGraphSceneTickEventBlock);
}
export {
  FlowGraphSceneTickEventBlock,
  RegisterFlowGraphSceneTickEventBlock
};
