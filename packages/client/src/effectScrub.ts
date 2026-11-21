import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { Effect } from '@babylonjs/core/Materials/effect';

/**
 * Let go of a disposed scene that the engine's shader cache still reaches (the memory probe, fix 3c). Babylon keeps
 * each compiled effect in the engine for every later scene to reuse, and with it the callbacks it was built with:
 * the material plugin manager's code hook (`_processCodeAfterIncludes`, which holds its material and so its scene),
 * the material's `onCompiled` / `onError` and the fallbacks (which name a mesh). A Test's match scene, disposed on Back
 * to MapMaker, stayed reachable through the effects it compiled first: on Iron Maw with 15 bots each one held about
 * 200 MB. A compiled effect never runs those again (a reuse calls its own callback; a lost context rebuilds from the
 * processed code), so they are dropped from every effect that is ready. Effects still compiling keep theirs.
 */
export function scrubCompiledEffects(engine: AbstractEngine): number {
  const table = (engine as unknown as { _compiledEffects?: Record<string, Effect> })._compiledEffects;
  if (!table) return 0;
  let n = 0;
  for (const effect of Object.values(table)) {
    if (!effect || !effect.isReady()) continue;
    const e = effect as unknown as { _processCodeAfterIncludes?: unknown; _processFinalCode?: unknown; _fallbacks?: unknown };
    e._processCodeAfterIncludes = undefined;
    e._processFinalCode = null;
    e._fallbacks = null;
    effect.onCompiled = null;
    effect.onError = null;
    n++;
  }
  return n;
}
