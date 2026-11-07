import { horizontalDistance, type Vec3 } from '../math.ts';
import type { BotProfile } from './profile.ts';
import type { VantageSpot } from './vantage.ts';

/**
 * Snipers who play like snipers (docs/BOTS.md, "Snipers"; BOT_AI_PLAN.md Phase B item 5; owner, 2026-11-06: "camping
 * in tucked away high spots … to take calculated shots, some even moving locations after, acting like real snipers").
 * Pure functions the brain asks: whether a shot from a sniper spot is worth taking now, how many shots a spot is worth,
 * which spot next, and how well a spot covers the ways the enemy comes.
 */

/** What a sniper on its spot knows about the shot it is lined up on. */
export interface ShotView {
  /** Distance to the target (m) and the gun's reach (the far end of its useful range, m). */
  dist: number;
  reach: number;
  /** The target's speed across the sniper's view (m/s). */
  lateral: number;
  /** How squarely the target faces the sniper (1: looking straight at it; below 0.5: not looking its way). */
  facing: number;
  /** The aim has settled on the target (its wander within about the target's width). */
  settled: boolean;
  /** Seconds it has been lined up on this target. */
  tracked: number;
}

/** A shot this good it takes at once: settled on a still or unaware target in reach. */
const STILL = 1.2;
const UNAWARE = 0.5;
/** Lined up this long (s), the aim counts as settled however far off the target is (its wander never gets that small). */
const SETTLE_WAIT = 2;
/** After this long lined up (s), a settled shot at a target moving across, short of a sprint, is taken anyway. */
const PATIENCE = 3;
const SPRINT = 4.8;

/**
 * Calculated shots: a sniper on its spot fires only on a good shot (in reach, the aim settled, and the target still,
 * not looking its way, or lined up a while and not sprinting), and otherwise keeps tracking without firing: a poor shot
 * gives the spot away for nothing. (At 100 m a body is a few milliradians wide, narrower than a bot's aim wanders: lined
 * up SETTLE_WAIT, that's as settled as it gets.)
 */
export function goodShot(s: ShotView): boolean {
  if (s.dist > s.reach || (!s.settled && s.tracked < SETTLE_WAIT)) return false;
  if (s.lateral < STILL || s.facing < UNAWARE) return true;
  return s.tracked >= PATIENCE && s.lateral < SPRINT;
}

/** How many shots a sniper takes from one spot before it moves on: one, or two for the bolder (aggression 60+). */
export function shotsPerSpot(p: BotProfile): number {
  return p.aggression >= 60 ? 2 : 1;
}

/**
 * How well a sniper spot covers the ways the enemy comes (lines of the trips' corridors): the share of route points
 * within its view (the sector it looks down, 35° either side) and its reach that it can see, of up to `most` checked
 * (nearest first). Worked out once per match per spot (a sight line per point checked).
 */
export function laneCover(spot: VantageSpot, lines: readonly (readonly Vec3[])[], sees: (a: Vec3, b: Vec3) => boolean, most = 24): number {
  const eye = { x: spot.pos.x, y: spot.pos.y + 1.5, z: spot.pos.z };
  const fx = Math.sin(spot.yaw);
  const fz = Math.cos(spot.yaw);
  const cos = Math.cos((35 * Math.PI) / 180);
  const cands: { p: Vec3; d: number }[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length; i += 2) {
      const p = line[i]!;
      const dx = p.x - eye.x;
      const dz = p.z - eye.z;
      const d = Math.hypot(dx, dz);
      if (d < 12 || d > spot.reach) continue;
      if ((dx * fx + dz * fz) / d < cos) continue;
      cands.push({ p, d });
    }
  }
  if (!cands.length) return 0;
  cands.sort((a, b) => a.d - b.d);
  const step = Math.max(1, Math.floor(cands.length / most));
  let seen = 0;
  let checked = 0;
  for (let i = 0; i < cands.length && checked < most; i += step) {
    checked++;
    const p = cands[i]!.p;
    if (sees(eye, { x: p.x, y: p.y + 1.2, z: p.z })) seen++;
  }
  return seen / checked;
}

/**
 * Where a sniper goes next after a shot or two: somewhere else (at least `apart` m from the spot it leaves) and not back
 * the way it came (no nearer the spot before that than the one it leaves is). A preference for `pick` (VantageBoard.pick).
 */
export function relocatePrefer(from: Vec3, before: Vec3 | null, apart = 18): (p: Vec3) => number {
  return (p: Vec3) => {
    if (horizontalDistance(p, from) < apart) return -5;
    if (before && horizontalDistance(p, before) < horizontalDistance(from, before)) return -1;
    return 0;
  };
}
