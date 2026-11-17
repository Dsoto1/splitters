/**
 * How many spare character bodies a match keeps for the next avatar of their look (View.keepBody), and the counts the
 * performance probes read (docs/PERF_FLAVIUS_MEMORY_2026-11-16.md, "Body pool").
 *
 * A body goes to the pool when its avatar goes (a corpse that sank away, one past MAX_CORPSES, a player who left), and a
 * respawn of that look takes it back at once instead of building a new one (10-25 ms and several MB of garbage each).
 * Small matches keep 16 at most, as before. Big matches (owner, 2026-11-17, "recs": "about 32") keep one for every two
 * players, up to 32: with 64 players and a pool of 16, most respawns built a new body, because the corpse of the last
 * life had not yet sunk away and the pool's other bodies were other looks.
 *
 * Why not more: every kept body is a skeleton with its meshes, bones and paused clips (about 4-6 MB of heap with its
 * share of the character files' structure, measured on Flavius Rule), and Roulette, which deals every life another
 * look, keeps the pool full of bodies that will rarely come back.
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
