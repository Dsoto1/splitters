import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import { R as RemoveFlowGraphAnimationGroupObservers } from "./flowGraphAnimationHelpers-DPSJ5lI3.js";
class FlowGraphSetPropertyBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.config = config;
    this.object = this.registerDataInput("object", RichTypeAny, config.target);
    this.value = this.registerDataInput("value", RichTypeAny);
    this.propertyName = this.registerDataInput("propertyName", RichTypeString, config.propertyName);
    this.customSetFunction = this.registerDataInput("customSetFunction", RichTypeAny);
  }
  _execute(context, _callingSignal) {
    try {
      const target = this.object.getValue(context);
      const value = this.value.getValue(context);
      const propertyName = this.propertyName.getValue(context);
      if (!this.config.stopOnError) {
        this._stopRunningAnimations(context, target, propertyName);
      }
      const setFunction = this.customSetFunction.getValue(context);
      if (setFunction) {
        setFunction(target, propertyName, value, context);
      } else {
        this._setPropertyValue(target, propertyName, value);
      }
      if (this.config.stopOnError) {
        this._stopRunningAnimations(context, target, propertyName);
      }
    } catch (e) {
      this._reportError(context, e);
      if (this.config.stopOnError) {
        return;
      }
    }
    this.out._activateSignal(context);
  }
  _stopRunningAnimations(context, target, propertyName) {
    const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    for (let groupIndex = currentlyRunningAnimationGroups.length - 1; groupIndex >= 0; groupIndex--) {
      const uniqueId = currentlyRunningAnimationGroups[groupIndex];
      const animationGroup = context.assetsContext.animationGroups.find((animationGroup2) => animationGroup2.uniqueId === uniqueId);
      if (animationGroup) {
        for (const targetedAnimations of animationGroup.targetedAnimations) {
          if (targetedAnimations.target === target && targetedAnimations.animation.targetProperty === propertyName) {
            RemoveFlowGraphAnimationGroupObservers(context, animationGroup)?._cleanupAfterExternalStop(context, animationGroup);
            animationGroup.stop(true);
            animationGroup.dispose();
            const index = currentlyRunningAnimationGroups.indexOf(uniqueId);
            if (index !== -1) {
              currentlyRunningAnimationGroups.splice(index, 1);
              context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunningAnimationGroups);
            }
            break;
          }
        }
      }
    }
  }
  _setPropertyValue(target, propertyName, value) {
    const path = propertyName.split(".");
    let obj = target;
    for (let i = 0; i < path.length - 1; i++) {
      const prop = path[i];
      if (obj[prop] === void 0) {
        obj[prop] = {};
      }
      obj = obj[prop];
    }
    obj[path[path.length - 1]] = value;
  }
  getClassName() {
    return "FlowGraphSetPropertyBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphSetPropertyBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSetPropertyBlock", FlowGraphSetPropertyBlock);
}
export {
  FlowGraphSetPropertyBlock,
  RegisterFlowGraphSetPropertyBlock
};
