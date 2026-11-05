import type { Scene } from '@babylonjs/core/scene';
import { Animatable } from '@babylonjs/core/Animations/animatable';
import { Scene as SceneClass } from '@babylonjs/core/scene';

/**
 * Two of Babylon's animation bookkeeping costs that grow with the number of running animations, which in a
 * 48-player match is some 8,000 (one per animated joint of every started clip; docs/PERF_96.md, "Performance
 * round 2"):
 *
 * - Stopping a clip (AnimationGroup.stop) looked each of its ~70 joint animations up in the scene's list of running
 *   ones (an indexOf each: half a million comparisons per stop), only to leave the removal to the group, which then
 *   sweeps the list once. Its animations are disposed and the group's sweep removes them, as before; the lookups go.
 * - Disposing any mesh or node (an effect's emitters every few frames) asked the scene to stop its animations, which
 *   walks all 8,000. A node nothing ever animated (in a scene marked with `trackAnimatedTargets`) skips the walk.
 */

let installed = false;
const animated = new WeakSet<object>();
const tracked = new WeakSet<Scene>();

interface AnimatableInternals {
  _runtimeAnimations: { dispose(): void }[];
  _raiseOnAnimationEnd(): void;
  appendAnimations(target: unknown, animations: unknown[]): void;
  stop(animationName?: string, targetMask?: (target: unknown) => boolean, useGlobalSplice?: boolean, skipOnAnimationEnd?: boolean): void;
}

/** Install the patches (once; before the match scene is made, so every animation in it is seen starting). */
export function installAnimationPatches(): void {
  if (installed) return;
  installed = true;
  const proto = Animatable.prototype as unknown as AnimatableInternals;
  const stop = proto.stop;
  proto.stop = function (this: AnimatableInternals, animationName, targetMask, useGlobalSplice = false, skipOnAnimationEnd = false): void {
    // Only an AnimationGroup's own stop (and the scene's stopAllAnimations) pass useGlobalSplice: they sweep the list.
    // The animatables a group holds are running ones (one that ends is taken out of the group as it ends).
    if (useGlobalSplice && !animationName && !targetMask) {
      const runtime = this._runtimeAnimations;
      if (!runtime.length) return;
      for (let i = 0; i < runtime.length; i++) runtime[i]!.dispose();
      runtime.length = 0;
      if (!skipOnAnimationEnd) this._raiseOnAnimationEnd();
      return;
    }
    return stop.call(this, animationName, targetMask, useGlobalSplice, skipOnAnimationEnd);
  };
  const append = proto.appendAnimations;
  proto.appendAnimations = function (this: AnimatableInternals, target: unknown, animations: unknown[]): void {
    if (target && typeof target === 'object') animated.add(target);
    return append.call(this, target, animations);
  };
  const sceneProto = SceneClass.prototype as unknown as { stopAnimation(target: unknown, animationName?: string, targetMask?: unknown): void };
  const stopAnimation = sceneProto.stopAnimation;
  sceneProto.stopAnimation = function (this: Scene, target: unknown, animationName?: string, targetMask?: unknown): void {
    if (tracked.has(this) && target && typeof target === 'object' && !animated.has(target)) return;
    return stopAnimation.call(this, target, animationName, targetMask);
  };
}

/** `scene` was made after installAnimationPatches: every animated target in it is known, so others skip the stop walk. */
export function trackAnimatedTargets(scene: Scene): void {
  if (installed) tracked.add(scene);
}
