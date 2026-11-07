/**
 * Measuring switches for Bot AI Phase B (temporary: removed before landing). `pnpm bot-report` sets them from the BOTB
 * environment variable (comma-separated names), so one build can measure each part on its own. All off: the branch as
 * it is.
 */
export const BOT_TRIALS = {
  /** The old rule chain instead of scored choices (with every other switch on, the same as main). */
  legacy: false,
  /** No team brain jobs (groups, their corridors, staging). */
  nojobs: false,
  /** Groups, but no staging. */
  nostage: false,
  /** No interceptors. */
  nointercept: false,
  /** Loose bots don't take corridors toward the enemy's side. */
  noroamroute: false,
  /** Squads don't take corridors. */
  nosquadroute: false,
  /** No health and ammo pickups on the way to a goal. */
  nogoalpickup: false,
  /** Bots holding a place chase and investigate at any distance (as main). */
  holdfree: false,
};

export type BotTrial = keyof typeof BOT_TRIALS;

/** Sets the switches from a comma-separated list (unknown names throw). */
export function setBotTrials(list: string): void {
  for (const k of Object.keys(BOT_TRIALS) as BotTrial[]) BOT_TRIALS[k] = false;
  for (const name of list.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!(name in BOT_TRIALS)) throw new Error(`unknown bot trial ${name}`);
    BOT_TRIALS[name as BotTrial] = true;
  }
}
