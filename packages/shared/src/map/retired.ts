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
]);

export const isRetiredMap = (id: string): boolean => RETIRED_MAPS.has(id);
