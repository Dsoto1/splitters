/**
 * Maps taken out of the game after the owner's map review. Their files stay
 * because tests, demos and e2e flows use them, but no menu, playlist, host
 * map picker, MapMaker template list or online listing offers them.
 */
export const RETIRED_MAPS: ReadonlySet<string> = new Set([
  'phase0_arena',
  'm3_vault',
  'm4_outpost',
  'sky_islands',
  'creature_lab',
  'dead_reel',
  'pharaohs_reach',
  'skyward',
  'sandsweep',
  'blackout',
  'cedar_lane',
  'glacier_line',
  // The procedural environment's Phase 1 showcase (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10): play tests and perf runs only.
  'env_showcase',
  // Owner, 2026-11-06 (after Bot AI Phase A's navigation audit): out of the game.
  'obsidian_orb',
  'reactor',
  'serpent_gorge',
  'iron_compound',
  // Owner, 2026-11-24: "i think we can retire citadel". `?offline=citadel` and its e2e flow still play it.
  'citadel',
  // Owner, 2026-11-24: too close to Vinefall Sanctum.
  'verdant_ziggurat',
]);

export const isRetiredMap = (id: string): boolean => RETIRED_MAPS.has(id);

/**
 * Training maps (owner, 2026-11-24: "its just training and testing"): ours and kept up to date, but never offered as
 * a place to play a mode. No map list, category, featured list, vote, rotation, playlist, host map picker or online
 * listing offers them; Profile → Favourite loadout → Test weapons opens one alone, offline (main.ts `playRange`),
 * and the tutorial plays on it. MapMaker still opens and remixes them.
 */
export const TRAINING_MAPS: ReadonlySet<string> = new Set(['training_range']);

export const isTrainingMap = (id: string): boolean => TRAINING_MAPS.has(id);

/** Not offered anywhere a player picks or is sent to a map: retired, or a training map. */
export const isUnlistedMap = (id: string): boolean => isRetiredMap(id) || isTrainingMap(id);
