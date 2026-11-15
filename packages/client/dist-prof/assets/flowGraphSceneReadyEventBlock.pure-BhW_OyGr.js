import { e as FlowGraphEventBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
const EventKey = "sceneReady";
class FlowGraphSceneReadyEventBlock extends FlowGraphEventBlock {
  /** @returns the shared scene-ready event key */
  get eventKey() {
    return EventKey;
  }
  constructor() {
    super();
    this.initPriority = -1;
    this.type = "SceneReady";
    this.eventRef = this.registerDataOutput("event", RichTypeString);
  }
  _updateOutputs(context) {
    this.eventRef.setValue(context.getEventReference(EventKey), context);
  }
  _executeEvent(context, _payload) {
    this.eventRef.setValue(context.getEventReference(EventKey), context);
    this._execute(context);
    return true;
  }
  _preparePendingTasks(context) {
  }
  _cancelPendingTasks(context) {
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSceneReadyEventBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSceneReadyEventBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSceneReadyEventBlock", FlowGraphSceneReadyEventBlock);
}
export {
  FlowGraphSceneReadyEventBlock,
  RegisterFlowGraphSceneReadyEventBlock
};
