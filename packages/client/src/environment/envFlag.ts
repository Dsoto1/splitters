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
