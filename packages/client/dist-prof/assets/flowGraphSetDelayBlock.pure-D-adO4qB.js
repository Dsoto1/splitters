import { b as FlowGraphAsyncExecutionBlock, j as MarkDelayActive, M as MarkDelayInactive, I as IsDelayActive } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { d as RichTypeNumber, c as RichTypeFlowGraphInteger } from "./flowGraphRichTypes-B7BqVpav.js";
import { O as Observable, z as RegisterClass, Y as FlowGraphInteger, L as Logger } from "./babylon-PnzH6wcM.js";
var TimerState;
(function(TimerState2) {
  TimerState2[TimerState2["INIT"] = 0] = "INIT";
  TimerState2[TimerState2["STARTED"] = 1] = "STARTED";
  TimerState2[TimerState2["ENDED"] = 2] = "ENDED";
})(TimerState || (TimerState = {}));
function setAndStartTimer(options) {
  let timer = 0;
  const startTime = Date.now();
  options.observableParameters = options.observableParameters ?? {};
  const observer = options.contextObservable.add((payload) => {
    const now = Date.now();
    timer = now - startTime;
    const data = {
      startTime,
      currentTime: now,
      deltaTime: timer,
      completeRate: timer / options.timeout,
      payload
    };
    if (options.breakCondition && options.breakCondition(data)) {
      options.contextObservable.remove(observer);
      options.onAborted && options.onAborted(data);
      return;
    }
    if (timer >= options.timeout) {
      options.contextObservable.remove(observer);
      options.onEnded && options.onEnded(data);
      return;
    }
    options.onTick && options.onTick(data);
  }, options.observableParameters.mask, options.observableParameters.insertFirst, options.observableParameters.scope);
  return observer;
}
class AdvancedTimer {
  /**
   * Will construct a new advanced timer based on the options provided. Timer will not start until start() is called.
   * @param options construction options for this advanced timer
   */
  constructor(options) {
    this.onEachCountObservable = new Observable();
    this.onTimerAbortedObservable = new Observable();
    this.onTimerEndedObservable = new Observable();
    this.onStateChangedObservable = new Observable();
    this._observer = null;
    this._breakOnNextTick = false;
    this._tick = (payload) => {
      const now = Date.now();
      this._timer = now - this._startTime;
      const data = {
        startTime: this._startTime,
        currentTime: now,
        deltaTime: this._timer,
        completeRate: this._timer / this._timeToEnd,
        payload
      };
      const shouldBreak = this._breakOnNextTick || this._breakCondition(data);
      if (shouldBreak || this._timer >= this._timeToEnd) {
        this._stop(data, shouldBreak);
      } else {
        this.onEachCountObservable.notifyObservers(data);
      }
    };
    this._setState(
      0
      /* TimerState.INIT */
    );
    this._contextObservable = options.contextObservable;
    this._observableParameters = options.observableParameters ?? {};
    this._breakCondition = options.breakCondition ?? (() => false);
    this._timeToEnd = options.timeout;
    if (options.onEnded) {
      this.onTimerEndedObservable.add(options.onEnded);
    }
    if (options.onTick) {
      this.onEachCountObservable.add(options.onTick);
    }
    if (options.onAborted) {
      this.onTimerAbortedObservable.add(options.onAborted);
    }
  }
  /**
   * set a breaking condition for this timer. Default is to never break during count
   * @param predicate the new break condition. Returns true to break, false otherwise
   */
  set breakCondition(predicate) {
    this._breakCondition = predicate;
  }
  /**
   * Reset ALL associated observables in this advanced timer
   */
  clearObservables() {
    this.onEachCountObservable.clear();
    this.onTimerAbortedObservable.clear();
    this.onTimerEndedObservable.clear();
    this.onStateChangedObservable.clear();
  }
  /**
   * Will start a new iteration of this timer. Only one instance of this timer can run at a time.
   *
   * @param timeToEnd how much time to measure until timer ended
   */
  start(timeToEnd = this._timeToEnd) {
    if (this._state === 1) {
      throw new Error("Timer already started. Please stop it before starting again");
    }
    this._timeToEnd = timeToEnd;
    this._startTime = Date.now();
    this._timer = 0;
    this._observer = this._contextObservable.add(this._tick, this._observableParameters.mask, this._observableParameters.insertFirst, this._observableParameters.scope);
    this._setState(
      1
      /* TimerState.STARTED */
    );
  }
  /**
   * Will force a stop on the next tick.
   */
  stop() {
    if (this._state !== 1) {
      return;
    }
    this._breakOnNextTick = true;
  }
  /**
   * Dispose this timer, clearing all resources
   */
  dispose() {
    if (this._observer) {
      this._contextObservable.remove(this._observer);
    }
    this.clearObservables();
  }
  _setState(newState) {
    this._state = newState;
    this.onStateChangedObservable.notifyObservers(this._state);
  }
  _stop(data, aborted = false) {
    this._contextObservable.remove(this._observer);
    this._setState(
      2
      /* TimerState.ENDED */
    );
    if (aborted) {
      this.onTimerAbortedObservable.notifyObservers(data);
    } else {
      this.onTimerEndedObservable.notifyObservers(data);
    }
  }
}
class FlowGraphSetDelayBlock extends FlowGraphAsyncExecutionBlock {
  constructor(config) {
    super(config);
    this.cancel = this._registerSignalInput("cancel");
    this.duration = this.registerDataInput("duration", RichTypeNumber);
    this.lastDelayIndex = this.registerDataOutput("lastDelayIndex", RichTypeFlowGraphInteger, new FlowGraphInteger(-1));
  }
  _preparePendingTasks(context) {
    const duration = this.duration.getValue(context);
    if (duration < 0 || isNaN(duration) || !isFinite(duration)) {
      return this._reportError(context, "Invalid duration in SetDelay block");
    }
    const activeDelays = context._getGlobalContextVariable("activeDelays", 0);
    if (activeDelays >= FlowGraphSetDelayBlock.MaxParallelDelayCount) {
      return this._reportError(context, "Max parallel delays reached");
    }
    const lastDelayIndex = context._getGlobalContextVariable("lastDelayIndex", -1);
    const timers = context._getExecutionVariable(this, "pendingDelays", []);
    const scene = context.configuration.scene;
    const timer = new AdvancedTimer({
      timeout: duration * 1e3,
      // duration is in seconds
      contextObservable: scene.onBeforeRenderObservable,
      onEnded: () => this._onEnded(timer, context)
    });
    timer.start();
    const newIndex = lastDelayIndex + 1;
    this.lastDelayIndex.setValue(new FlowGraphInteger(newIndex), context);
    context._setGlobalContextVariable("lastDelayIndex", newIndex);
    MarkDelayActive(context, newIndex);
    timers[newIndex] = timer;
    context._setExecutionVariable(this, "pendingDelays", timers);
    this._updateGlobalTimers(context);
  }
  _cancelPendingTasks(context) {
    const timers = context._getExecutionVariable(this, "pendingDelays", []);
    const globalTimers = context._getGlobalContextVariable("pendingDelays", []);
    for (let index = 0; index < timers.length; index++) {
      const timer = timers[index];
      if (timer) {
        timer.dispose();
        MarkDelayInactive(context, index);
        delete globalTimers[index];
      }
    }
    context._setGlobalContextVariable("pendingDelays", globalTimers);
    context._deleteExecutionVariable(this, "pendingDelays");
    this.lastDelayIndex.setValue(new FlowGraphInteger(-1), context);
    this._updateGlobalTimers(context);
  }
  _execute(context, callingSignal) {
    if (callingSignal === this.cancel) {
      this._cancelPendingTasks(context);
      return;
    } else {
      this._preparePendingTasks(context);
      this.out._activateSignal(context);
    }
  }
  getClassName() {
    return "FlowGraphSetDelayBlock";
  }
  _onEnded(timer, context) {
    const timers = context._getExecutionVariable(this, "pendingDelays", []);
    const index = timers.indexOf(timer);
    if (index !== -1) {
      delete timers[index];
      const globalTimers = context._getGlobalContextVariable("pendingDelays", []);
      delete globalTimers[index];
      context._setGlobalContextVariable("pendingDelays", globalTimers);
      MarkDelayInactive(context, index);
    } else {
      Logger.Warn("FlowGraphTimerBlock: Timer ended but was not found in the running timers list");
    }
    context._removePendingBlock(this);
    this.done._activateSignal(context);
    this._updateGlobalTimers(context);
  }
  _updateGlobalTimers(context) {
    const timers = context._getExecutionVariable(this, "pendingDelays", []);
    const globalTimers = context._getGlobalContextVariable("pendingDelays", []);
    for (let i = 0; i < timers.length; i++) {
      if (!timers[i] || !IsDelayActive(context, i)) {
        continue;
      }
      const timer = timers[i];
      if (globalTimers[i] && globalTimers[i] !== timer) {
        Logger.Warn("FlowGraphTimerBlock: Timer ended but was not found in the running timers list");
      } else {
        globalTimers[i] = timer;
      }
    }
    context._setGlobalContextVariable("pendingDelays", globalTimers);
  }
}
FlowGraphSetDelayBlock.MaxParallelDelayCount = 100;
let _Registered = false;
function RegisterFlowGraphSetDelayBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSetDelayBlock", FlowGraphSetDelayBlock);
}
const flowGraphSetDelayBlock_pure = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  FlowGraphSetDelayBlock,
  RegisterFlowGraphSetDelayBlock
}, Symbol.toStringTag, { value: "Module" }));
export {
  RegisterFlowGraphSetDelayBlock as R,
  flowGraphSetDelayBlock_pure as f,
  setAndStartTimer as s
};
