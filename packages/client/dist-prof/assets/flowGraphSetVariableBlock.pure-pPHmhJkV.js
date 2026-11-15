import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
import { R as RemoveFlowGraphAnimationGroupObservers } from "./flowGraphAnimationHelpers-DPSJ5lI3.js";
class FlowGraphSetVariableBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    if (config.variables && config.variable) {
      throw new Error("FlowGraphSetVariableBlock: variable and variables are both defined");
    }
    if (config.variables) {
      for (const variable of config.variables) {
        this.registerDataInput(variable, RichTypeAny);
      }
    } else {
      this.registerDataInput("value", RichTypeAny);
    }
  }
  _execute(context, _callingSignal) {
    if (this.config?.variables) {
      const variables = this.config.variables;
      let values;
      if (this.config.evaluateInputsBeforeWrite) {
        values = [];
        for (const variable of variables) {
          values.push(this.getDataInput(variable)?.getValue(context));
        }
      }
      for (let i = 0; i < variables.length; i++) {
        this._saveVariable(context, variables[i], values?.[i], values ? void 0 : variables[i]);
      }
    } else {
      this._saveVariable(context, this.config?.variable, void 0, "value");
    }
    this.out._activateSignal(context);
  }
  _saveVariable(context, variableName, value, inputName) {
    const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    for (const animationUniqueId of currentlyRunningAnimationGroups) {
      const animationGroup = context.assetsContext.animationGroups.find((animationGroup2) => animationGroup2.uniqueId == animationUniqueId);
      if (animationGroup) {
        for (const targetAnimation of animationGroup.targetedAnimations) {
          if (targetAnimation.target === context || this.config?.cancelVariableAnimations && targetAnimation.target === context.userVariables) {
            if (targetAnimation.animation.targetProperty === variableName) {
              if (this.config?.cancelVariableAnimations) {
                RemoveFlowGraphAnimationGroupObservers(context, animationGroup)?._cleanupAfterExternalStop(context, animationGroup);
                animationGroup.stop(true);
                animationGroup.dispose();
              } else {
                animationGroup.stop();
              }
              const index = currentlyRunningAnimationGroups.indexOf(animationUniqueId);
              if (index > -1) {
                currentlyRunningAnimationGroups.splice(index, 1);
              }
              context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunningAnimationGroups);
              break;
            }
          }
        }
      }
    }
    context.setVariable(variableName, inputName === void 0 ? value : this.getDataInput(inputName)?.getValue(context));
  }
  getClassName() {
    return "FlowGraphSetVariableBlock";
  }
  serialize(serializationObject) {
    super.serialize(serializationObject);
    serializationObject.config.variable = this.config?.variable;
  }
}
let _Registered = false;
function RegisterFlowGraphSetVariableBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSetVariableBlock", FlowGraphSetVariableBlock);
}
export {
  FlowGraphSetVariableBlock,
  RegisterFlowGraphSetVariableBlock
};
