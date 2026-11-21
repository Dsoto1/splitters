/**
 * How many spare character bodies a match keeps for the next avatar of their look (View.keepBody), and the counts the
 * performance probes read (docs/PERF_FLAVIUS_MEMORY_2026-11-16.md, "Body pool").
 *
 * A body goes to the pool when its avatar goes (a corpse that sank away, one past MAX_CORPSES, a player who left), and a
 * respawn of that look takes it back at once instead of building a new one (10-25 ms and several MB of garbage each).
 * Small matches keep 16 at most, as before. Big matches (owner, 2026-11-17, "recs": "about 32") keep one for every two
 * players, up to 32. Measured on Flavius Rule with 64 bots (docs/PERF_FLAVIUS_MEMORY_2026-11-16.md, "Body pool"):
 * with 16, two respawns in three built a body (24 builds a minute) and the pool threw away a body every few seconds;
 * with 32, half reuse one (13 a minute), for about 13 MB more heap after a collection (well under 1 MB a body: the
 * character files' structure is shared).
 *
 * Why not more: every kept body is a skeleton with its paused clips on the scene's list of animations, and Roulette,
 * which deals every life another look, keeps the pool full of bodies that will rarely come back.
 *
 * `?perfoff=bodypool` keeps the old 16 in every match.
 */

import { perfOn } from './perfSwitches.ts';

/** Bodies kept per look: a look's next two lives come back at once. */
export const BODY_POOL_PER_LOOK = 2;
/** In all, in a small match (and with the saving off). */
export const BODY_POOL_SMALL = 16;
/** In all, at most, in a big match. */
export const BODY_POOL_BIG = 32;

/** The pool's size in all for a match of `players` other players and NPCs drawn as characters (the most seen so far). */
export function bodyPoolTotal(players: number, on = perfOn('bodypool')): number {
  const probe = (globalThis as { __bodyPoolTotal?: number }).__bodyPoolTotal;
  // A measurement's own size (tools/perf/match-profile.mjs PROF_POOL), set before the page loads.
  if (on && typeof probe === 'number' && probe > 0) return Math.floor(probe);
  if (!on) return BODY_POOL_SMALL;
  return Math.max(BODY_POOL_SMALL, Math.min(BODY_POOL_BIG, Math.ceil(players / 2)));
}

/** Since the page loaded: bodies built for an avatar, taken from the pool, put in it, and let go when it was full. */
export const bodyPoolStats = { built: 0, reused: 0, kept: 0, evicted: 0, refused: 0, size: BODY_POOL_SMALL };
(globalThis as unknown as { __bodyPool: typeof bodyPoolStats }).__bodyPool = bodyPoolStats;
