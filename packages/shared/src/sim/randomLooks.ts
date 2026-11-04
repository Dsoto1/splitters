/**
 * Random characters (MatchRules.randomCharacters, default off): everyone, people and bots, plays a random look each
 * life. Only looks on the roster (CORE_LOOKS: playable, not retired; NPC-only bodies and NPC skins are not on it).
 * The pick is a hash of the match seed, the slot and the life, so a match replays the same and host and clients
 * agree; the look travels in the `spawn` event (and the roster for anyone joining later).
 */
import { CORE_LOOKS } from '../content/looks.ts';

/** The looks a random character may be: every look on the roster. */
export const RANDOM_LOOK_POOL: readonly string[] = CORE_LOOKS.map((l) => l.id);

/** A 32-bit mix of the inputs (the same everywhere: integer arithmetic only). */
function mix(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

/** The look `slot` plays in its `life`-th life (from 1) of a match seeded `seed`; never `avoid` when there is a choice. */
export function randomLook(seed: number, slot: number, life: number, avoid?: string): string {
  const pool = RANDOM_LOOK_POOL;
  const i = mix(seed | 0, slot | 0, life | 0) % pool.length;
  const pick = pool[i]!;
  // A new life shows a new face: not the look just played.
  return pick === avoid && pool.length > 1 ? pool[(i + 1) % pool.length]! : pick;
}
