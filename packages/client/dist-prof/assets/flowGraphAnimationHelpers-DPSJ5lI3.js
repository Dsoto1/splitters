function RemoveFlowGraphAnimationGroupObservers(context, animationGroup) {
  const observerSets = context._getGlobalContextVariable("animationGroupObserverSets", /* @__PURE__ */ new Map());
  const observers = observerSets.get(animationGroup.uniqueId);
  if (!observers) {
    return void 0;
  }
  animationGroup.onAnimationGroupEndObservable.remove(observers.groupEnd);
  animationGroup.onAnimationEndObservable.remove(observers.animationEnd);
  animationGroup.onAnimationLoopObservable.remove(observers.animationLoop);
  animationGroup.onAnimationGroupLoopObservable.remove(observers.groupLoop);
  observerSets.delete(animationGroup.uniqueId);
  context._setGlobalContextVariable("animationGroupObserverSets", observerSets);
  return observers.block;
}
export {
  RemoveFlowGraphAnimationGroupObservers as R
};
