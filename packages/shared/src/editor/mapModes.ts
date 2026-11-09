/**
 * Map properties' mode list: modes the game no longer has (Race, removed 2026-11-09) are never offered, and a map
 * that still lists one can drop it. Maps that list it load either way (the game leaves it out); this only tidies the
 * map's own `supportedModes`.
 */

/** Modes gone from the game that old maps may still list. */
export const REMOVED_MODES: readonly string[] = ['core.race'];

export function isRemovedMode(mode: string): boolean {
  return REMOVED_MODES.includes(mode);
}

/** Does this list still carry a removed mode? */
export function hasRemovedMode(modes: readonly string[]): boolean {
  return modes.some(isRemovedMode);
}

/** The list without removed modes, in its order; a list left empty falls back to Deathmatch (what the game plays it as). */
export function withoutRemovedModes(modes: readonly string[]): string[] {
  const kept = modes.filter((m) => !isRemovedMode(m));
  return kept.length ? kept : ['core.deathmatch'];
}

/** The list after picking `main` as the main mode: it goes first, the other modes stay, removed ones go. */
export function withMainMode(modes: readonly string[], main: string): string[] {
  return withoutRemovedModes([main, ...modes.filter((m) => m !== main)]);
}
