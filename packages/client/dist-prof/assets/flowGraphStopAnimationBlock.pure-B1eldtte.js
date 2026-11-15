import { R as RichTypeAny, d as RichTypeNumber } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass, L as Logger } from "./babylon-PnzH6wcM.js";
import { b as FlowGraphAsyncExecutionBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RemoveFlowGraphAnimationGroupObservers } from "./flowGraphAnimationHelpers-DPSJ5lI3.js";
class FlowGraphStopAnimationBlock extends FlowGraphAsyncExecutionBlock {
  constructor(config) {
    super(config);
    this.animationGroup = this.registerDataInput("animationGroup", RichTypeAny);
    this.stopAtFrame = this.registerDataInput("stopAtFrame", RichTypeNumber, -1);
  }
  _preparePendingTasks(context) {
    const animationToStopValue = this.animationGroup.getValue(context);
    const stopAtFrame = this.stopAtFrame.getValue(context) ?? -1;
    const pendingStopAnimations = context._getGlobalContextVariable("pendingStopAnimations", []);
    if (this.config?.useVirtualStopAt) {
      const existing = pendingStopAnimations.find((entry) => entry.uniqueId === animationToStopValue.uniqueId && entry.useVirtualStopAt);
      if (existing) {
        if (existing.block !== this) {
          context._removePendingBlock(existing.block);
        }
        existing.stopAtFrame = stopAtFrame;
        existing.block = this;
      } else {
        pendingStopAnimations.push({ uniqueId: animationToStopValue.uniqueId, stopAtFrame, block: this, useVirtualStopAt: true });
      }
    } else {
      pendingStopAnimations.push({ uniqueId: animationToStopValue.uniqueId, stopAtFrame, block: this, useVirtualStopAt: false });
    }
    context._setGlobalContextVariable("pendingStopAnimations", pendingStopAnimations);
  }
  _cancelPendingTasks(context) {
    const animationToStopValue = this.animationGroup.getValue(context);
    const pendingStopAnimations = context._getGlobalContextVariable("pendingStopAnimations", []);
    for (let i = 0; i < pendingStopAnimations.length; i++) {
      if (pendingStopAnimations[i].uniqueId === animationToStopValue.uniqueId && pendingStopAnimations[i].block === this) {
        pendingStopAnimations.splice(i, 1);
        context._setGlobalContextVariable("pendingStopAnimations", pendingStopAnimations);
        break;
      }
    }
  }
  _execute(context) {
    const animationToStopValue = this.animationGroup.getValue(context);
    const stopTime = this.stopAtFrame.getValue(context) ?? -1;
    if (!animationToStopValue) {
      Logger.Warn("No animation group provided to stop.");
      return this._reportError(context, "No animation group provided to stop.");
    }
    if (isNaN(stopTime)) {
      return this._reportError(context, "Invalid stop time.");
    }
    const useVirtualStopAt = !!this.config?.useVirtualStopAt;
    const hasScheduledStop = useVirtualStopAt ? this.stopAtFrame.isConnected() || context._hasConnectionValue(this.stopAtFrame) : stopTime > 0;
    let activateDone = false;
    if (hasScheduledStop) {
      if (useVirtualStopAt && animationToStopValue.isValidVirtualStopFrame(stopTime) && animationToStopValue.isVirtualFrameReached(stopTime)) {
        this._stopAnimation(animationToStopValue, context, stopTime);
        activateDone = true;
      } else {
        this._startPendingTasks(context);
      }
    } else {
      this._stopAnimation(animationToStopValue, context);
    }
    this.out._activateSignal(context);
    if (activateDone) {
      this.done._activateSignal(context);
    }
  }
  _executeOnTick(context) {
    const animationToStopValue = this.animationGroup.getValue(context);
    const pendingStopAnimations = context._getGlobalContextVariable("pendingStopAnimations", []);
    for (let i = 0; i < pendingStopAnimations.length; i++) {
      if (pendingStopAnimations[i].uniqueId === animationToStopValue.uniqueId && pendingStopAnimations[i].block === this) {
        const useVirtualStopAt = pendingStopAnimations[i].useVirtualStopAt;
        const shouldStop = useVirtualStopAt ? animationToStopValue.isValidVirtualStopFrame(pendingStopAnimations[i].stopAtFrame) && animationToStopValue.isVirtualFrameReached(pendingStopAnimations[i].stopAtFrame) : animationToStopValue.getCurrentFrame() >= pendingStopAnimations[i].stopAtFrame;
        if (shouldStop) {
          this._stopAnimation(animationToStopValue, context, useVirtualStopAt ? pendingStopAnimations[i].stopAtFrame : void 0);
          pendingStopAnimations.splice(i, 1);
          context._setGlobalContextVariable("pendingStopAnimations", pendingStopAnimations);
          this.done._activateSignal(context);
          context._removePendingBlock(this);
          break;
        } else if (!animationToStopValue.isPlaying) {
          pendingStopAnimations.splice(i, 1);
          context._setGlobalContextVariable("pendingStopAnimations", pendingStopAnimations);
          context._removePendingBlock(this);
          break;
        }
      }
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphStopAnimationBlock";
  }
  _stopAnimation(animationGroup, context, virtualStopFrame) {
    const currentlyRunning = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    const index = currentlyRunning.indexOf(animationGroup.uniqueId);
    if (index !== -1) {
      const suppressAnimationEnd = this.config?.skipOnAnimationEnd !== false;
      const owner = suppressAnimationEnd ? RemoveFlowGraphAnimationGroupObservers(context, animationGroup) : void 0;
      owner?._cleanupAfterExternalStop(context, animationGroup);
      if (virtualStopFrame !== void 0) {
        animationGroup.setVirtualCurrentFrame(virtualStopFrame);
      }
      if (suppressAnimationEnd) {
        animationGroup.stop(true);
      } else {
        animationGroup.stop();
      }
      const remainingIndex = currentlyRunning.indexOf(animationGroup.uniqueId);
      if (remainingIndex !== -1) {
        currentlyRunning.splice(remainingIndex, 1);
        context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunning);
      }
    }
  }
}
let _Registered = false;
function RegisterFlowGraphStopAnimationBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphStopAnimationBlock", FlowGraphStopAnimationBlock);
}
export {
  FlowGraphStopAnimationBlock,
  RegisterFlowGraphStopAnimationBlock
};
