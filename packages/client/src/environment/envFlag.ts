/**
 * The new environment renderer is behind `?env=1` until Phase 4 (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10): with it,
 * placed `env.*` species draw as chunked thin instances (environmentVisuals.ts) and the terrain's grass grows as the
 * generated grass clump. Without it, `env.*` placements still draw, as ordinary props (one node each, level 0).
 * Kept tiny: the match and MapMaker read it; the renderer itself loads with them, never with the menu.
 */
export function envRendererOn(): boolean {
  try {
    return new URLSearchParams(location.search).get('env') === '1';
  } catch {
    return false;
  }
}

/**
 * Whether a match draws placed species with the environment renderer (chunked thin instances, levels of detail):
 * on by default since Environment Phase 2 (the official maps' trees and bushes are species now); `?env=0` draws them
 * as prop nodes instead (one each, level 0), as MapMaker does.
 */
export function envBatchedOn(): boolean {
  try {
    return new URLSearchParams(location.search).get('env') !== '0';
  } catch {
    return true;
  }
}
