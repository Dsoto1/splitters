import { b as FlowGraphAsyncExecutionBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { d as RichTypeNumber, b as RichTypeBoolean, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass, Z as AnimationGroup } from "./babylon-PnzH6wcM.js";
import { R as RemoveFlowGraphAnimationGroupObservers } from "./flowGraphAnimationHelpers-DPSJ5lI3.js";
class FlowGraphPlayAnimationBlock extends FlowGraphAsyncExecutionBlock {
  constructor(config) {
    super(config, ["animationLoop", "animationEnd", "animationGroupLoop"]);
    this.config = config;
    this.speed = this.registerDataInput("speed", RichTypeNumber);
    this.loop = this.registerDataInput("loop", RichTypeBoolean);
    this.from = this.registerDataInput("from", RichTypeNumber, 0);
    this.to = this.registerDataInput("to", RichTypeNumber);
    this.currentFrame = this.registerDataOutput("currentFrame", RichTypeNumber);
    this.currentTime = this.registerDataOutput("currentTime", RichTypeNumber);
    this.currentAnimationGroup = this.registerDataOutput("currentAnimationGroup", RichTypeAny);
    this.animationGroup = this.registerDataInput("animationGroup", RichTypeAny, config?.animationGroup);
    this.animation = this.registerDataInput("animation", RichTypeAny);
    this.animationTargets = this.registerDataInput("animationTargets", RichTypeAny);
    this.object = this.registerDataInput("object", RichTypeAny);
  }
  /**
   * @internal
   * @param context
   */
  _startPendingTasks(context) {
    if (context._getExecutionVariable(this, "_initialized", false)) {
      this._cancelPendingTasks(context);
      this._resetAfterCanceled(context);
    }
    if (!this._tryPreparePendingTasks(context)) {
      return;
    }
    context._addPendingBlock(this);
    context._setExecutionVariable(this, "_initialized", true);
    this.out._activateSignal(context);
  }
  /**
   * @internal
   * @param context the graph context
   */
  _preparePendingTasks(context) {
    this._tryPreparePendingTasks(context);
  }
  /**
   * Prepares and starts the animation, reporting whether it could be started. Invalid inputs
   * activate `err` and return false, so the caller neither activates `out` nor registers the
   * block as pending.
   * @param context the graph context
   * @returns whether the animation was prepared and started successfully
   */
  _tryPreparePendingTasks(context) {
    let ag;
    let animation;
    let animationTargets;
    try {
      ag = this.animationGroup.getValue(context);
      animation = this.animation.getValue(context);
      animationTargets = ag ? void 0 : this.animationTargets.getValue(context);
    } catch (error) {
      this._reportError(context, error);
      return false;
    }
    if (!ag && !animation) {
      this._reportError(context, "No animation or animation group provided");
      return false;
    } else if (!ag && Array.isArray(animation) && animation.length === 0) {
      this._reportError(context, "Animation array is empty");
      return false;
    } else if (ag && ag.targetedAnimations.length === 0) {
      this._reportError(context, "Animation group has no targeted animations");
      return false;
    } else {
      const currentAnimationGroup = this.currentAnimationGroup.getValue(context);
      if (currentAnimationGroup && currentAnimationGroup !== ag) {
        currentAnimationGroup.dispose();
      }
      let animationGroupToUse = ag;
      let isInterpolation = false;
      let interpolationAnimationsArray;
      let interpolationTarget;
      if (animation && !animationGroupToUse) {
        const target = animationTargets === void 0 ? this.object.getValue(context) : void 0;
        const animationsArray = Array.isArray(animation) ? animation : [animation];
        if (animationTargets !== void 0 && (!Array.isArray(animationTargets) || animationTargets.length !== animationsArray.length)) {
          this._reportError(context, "Animation targets must match the animation array.");
          return false;
        }
        if (!animationTargets && !target) {
          this._reportError(context, "No target object provided");
          return false;
        }
        if (animationTargets) {
          for (const animationTarget of animationTargets) {
            if (!animationTarget) {
              this._reportError(context, "No target object provided");
              return false;
            }
          }
        }
        const name = animationsArray[0].name;
        animationGroupToUse = new AnimationGroup("flowGraphAnimationGroup-" + name + "-" + (target?.name ?? "targets"), context.configuration.scene);
        const interpolationAnimations = context._getGlobalContextVariable("interpolationAnimations", []);
        for (let index = 0; index < animationsArray.length; index++) {
          const anim = animationsArray[index];
          animationGroupToUse.addTargetedAnimation(anim, animationTargets ? animationTargets[index] : target);
          if (interpolationAnimations.indexOf(anim.uniqueId) !== -1) {
            isInterpolation = true;
          }
        }
        interpolationAnimationsArray = animationsArray;
        interpolationTarget = target;
      }
      const speed = this.speed.getValue(context) || 1;
      const from = this.from.getValue(context) ?? 0;
      const rawTo = this.to.getValue(context);
      const hasTo = this.to.isConnected() || context._hasConnectionValue(this.to);
      const to = hasTo ? rawTo : animationGroupToUse.to;
      if (!animation) {
        if (isNaN(rawTo)) {
          this._reportError(context, "Invalid animation end time");
          return false;
        }
        if (this.speed.isConnected() || context._hasConnectionValue(this.speed)) {
          const providedSpeed = this.speed.getValue(context);
          if (!isFinite(providedSpeed) || providedSpeed <= 0) {
            this._reportError(context, "Invalid animation speed");
            return false;
          }
        }
      }
      if (!isFinite(from)) {
        this._reportError(context, "Invalid animation duration");
        return false;
      }
      if (animation && (!isFinite(to) || to < 0)) {
        this._reportError(context, "Invalid animation duration");
        return false;
      }
      if (animation) {
        const animationsArray = Array.isArray(animation) ? animation : [animation];
        for (const anim of animationsArray) {
          const easing = anim.getEasingFunction?.();
          if (easing && "x1" in easing) {
            const bezier = easing;
            if (!Number.isFinite(bezier.x1) || !Number.isFinite(bezier.y1) || !Number.isFinite(bezier.x2) || !Number.isFinite(bezier.y2) || bezier.x1 < 0 || bezier.x1 > 1 || bezier.x2 < 0 || bezier.x2 > 1) {
              this._reportError(context, "Invalid bezier curve control points");
              return false;
            }
          }
        }
      }
      if (isInterpolation && interpolationAnimationsArray) {
        this._checkInterpolationDuplications(context, interpolationAnimationsArray, interpolationTarget, animationTargets);
      }
      const loop = !isFinite(to) || this.loop.getValue(context);
      this.currentAnimationGroup.setValue(animationGroupToUse, context);
      const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
      if (currentlyRunningAnimationGroups.indexOf(animationGroupToUse.uniqueId) !== -1) {
        this._stopAnimationGroup(context, animationGroupToUse);
      }
      try {
        if (this.config?.useVirtualTimeline) {
          animationGroupToUse.startWithVirtualTimeline(loop, speed, from, to);
        } else {
          animationGroupToUse.start(loop, speed, from, to);
        }
        const observers = {
          block: this,
          groupEnd: animationGroupToUse.onAnimationGroupEndObservable.add(() => this._onAnimationGroupEnd(context, animationGroupToUse)),
          animationEnd: animationGroupToUse.onAnimationEndObservable.add(() => this._eventsSignalOutputs["animationEnd"]._activateSignal(context)),
          animationLoop: animationGroupToUse.onAnimationLoopObservable.add(() => this._eventsSignalOutputs["animationLoop"]._activateSignal(context)),
          groupLoop: animationGroupToUse.onAnimationGroupLoopObservable.add(() => this._eventsSignalOutputs["animationGroupLoop"]._activateSignal(context))
        };
        const observerSets = context._getGlobalContextVariable("animationGroupObserverSets", /* @__PURE__ */ new Map());
        observerSets.set(animationGroupToUse.uniqueId, observers);
        context._setGlobalContextVariable("animationGroupObserverSets", observerSets);
        currentlyRunningAnimationGroups.push(animationGroupToUse.uniqueId);
        context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunningAnimationGroups);
      } catch (e) {
        this._reportError(context, e);
        return false;
      }
      return true;
    }
  }
  _reportError(context, error) {
    super._reportError(context, error);
    this.currentFrame.setValue(-1, context);
    this.currentTime.setValue(-1, context);
  }
  /**
   * @internal
   */
  _executeOnTick(_context) {
    const ag = this.currentAnimationGroup.getValue(_context);
    if (ag) {
      this.currentFrame.setValue(ag.getCurrentFrame(), _context);
      this.currentTime.setValue(ag.animatables[0]?.elapsedTime ?? 0, _context);
    }
  }
  _execute(context) {
    this._startPendingTasks(context);
  }
  _onAnimationGroupEnd(context, animationGroup) {
    RemoveFlowGraphAnimationGroupObservers(context, animationGroup);
    this._removeFromCurrentlyRunning(context, animationGroup);
    this._resetAfterCanceled(context);
    this.done._activateSignal(context);
  }
  /**
   * The idea behind this function is to check every running animation group and check if the targeted animations it uses are interpolation animations.
   * If they are, we want to see that they don't collide with the current interpolation animations that are starting to play.
   * If they do, we want to stop the already-running animation group.
   * @internal
   */
  _checkInterpolationDuplications(context, animation, target, targets) {
    const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    for (let groupIndex = currentlyRunningAnimationGroups.length - 1; groupIndex >= 0; groupIndex--) {
      const uniqueId = currentlyRunningAnimationGroups[groupIndex];
      const ag = context.assetsContext.animationGroups.find((ag2) => ag2.uniqueId === uniqueId);
      if (ag) {
        let stopped = false;
        for (const anim of ag.targetedAnimations) {
          for (let index = 0; index < animation.length; index++) {
            if (anim.animation.targetProperty === animation[index].targetProperty && anim.target === (targets ? targets[index] : target)) {
              this._stopAnimationGroup(context, ag);
              stopped = true;
              break;
            }
          }
          if (stopped) {
            break;
          }
        }
      }
    }
  }
  _stopAnimationGroup(context, animationGroup) {
    const owner = RemoveFlowGraphAnimationGroupObservers(context, animationGroup);
    owner?._cleanupAfterExternalStop(context, animationGroup);
    animationGroup.stop(true);
    if (animationGroup.name.startsWith("flowGraphAnimationGroup-")) {
      animationGroup.dispose();
    }
    this._removeFromCurrentlyRunning(context, animationGroup);
  }
  /** @internal */
  _cleanupAfterExternalStop(context, animationGroup) {
    this._removeFromCurrentlyRunning(context, animationGroup);
    this._resetAfterCanceled(context);
  }
  _removeFromCurrentlyRunning(context, animationGroup) {
    const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    const idx = currentlyRunningAnimationGroups.indexOf(animationGroup.uniqueId);
    if (idx !== -1) {
      currentlyRunningAnimationGroups.splice(idx, 1);
      context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunningAnimationGroups);
    }
  }
  /**
   * @internal
   * Stop any currently running animations.
   */
  _cancelPendingTasks(context) {
    const ag = this.currentAnimationGroup.getValue(context);
    if (ag) {
      this._stopAnimationGroup(context, ag);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphPlayAnimationBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphPlayAnimationBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphPlayAnimationBlock", FlowGraphPlayAnimationBlock);
}
export {
  FlowGraphPlayAnimationBlock,
  RegisterFlowGraphPlayAnimationBlock,
  RemoveFlowGraphAnimationGroupObservers
};
