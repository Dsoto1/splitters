import { horizontalDistance, type Vec3 } from '../math.ts';
import type { OrderGoal } from './brain.ts';
import type { BotProfile } from './profile.ts';

/**
 * Scored choices (docs/BOTS.md, "Scored choices"; BOT_AI_PLAN.md Phase B item 1): with nobody in sight, what a bot
 * does next. Each option gets a score from the bot's personality, its health and ammo, its goal and role (OrderGoal:
 * keep to it, run, hold a place, a person's order) and distance; the best wins, and the one chosen last gets MARGIN
 * more so a bot doesn't dither between two. The brain's states stay the "how" (BotBrain.choose applies the choice).
 * A pure function of what the brain gathered: a few comparisons and multiplications a think (about 10 Hz).
 *
 * The weights keep the order the old rules had where it was tuned (keeping up hide-and-peek behind cover, then a real
 * gun when holding only a sidearm, then running on from a threat, then an enemy that slipped away, then a noise, then
 * the goal or roaming), and add what the rules lacked: a bot holding a place (a CTF defender, a hill) goes to look
 * only at what happens near the place it holds, a person's order holds the bot within a few steps of it, a carrier
 * never leaves its run, a hurt bot cares less for noises, one short of ammo less for a chase, and one on its way to a
 * goal takes the health, armour or ammo it needs close by.
 */
export const OPT_GOAL = 0;
export const OPT_ROAM = 1;
export const OPT_COVER = 2;
export const OPT_RETREAT = 3;
export const OPT_PICKUP = 4;
export const OPT_CHASE = 5;
export const OPT_NOISE = 6;
export const OPT_FIGHT = 7;
export const OPTIONS = 8;

/** How much more the option chosen last counts (no dithering between two close ones). */
export const MARGIN = 0.25;
/** Roaming, with nothing else to do (no objective): anything worth a look beats it. */
export const ROAM_WEIGHT = 0.3;
/**
 * An enemy that slipped out of sight, and a noise, at least: above any goal but a carrier's run and a person's order,
 * with the margin on top, so where a bot may leave its goal for one (leaveCost) it does, as it did before scores.
 */
export const CHASE_WEIGHT = 1.6;
export const NOISE_WEIGHT = 1.5;
/**
 * Keeping up hide-and-peek behind cover just after a fight, a real gun close by when holding only a sidearm, running
 * on a moment after losing sight while getting away: in that order, and above any chase.
 */
export const COVER_WEIGHT = 2.9;
export const GUN_WEIGHT = 2.75;
export const RETREAT_WEIGHT = 2.6;
/** On the way to an objective (OrderGoal.push): noises and enemies that slipped away only this close are worth turning aside for (m). */
export const PUSH_NOTICE = 12;
/** Holding a place (a defender, a guard): what happens this close to it (m, past its radius) is worth going to look at. */
export const HOLD_NOTICE = 12;
/** Under a person's order: only what happens this close (m) draws the bot off it. */
export const ORDER_NOTICE = 10;
/** A camper or sniper on its spot (or on its way there) leaves it only for something this close (m). */
export const POST_NOTICE = 10;

/** What the brain gathered for a choice (BotBrain.choose). */
export interface ChoiceInput {
  me: Vec3;
  goal: OrderGoal | null;
  profile: BotProfile;
  hurt: boolean;
  /** Its gun's rounds, loaded and spare, no more than a magazine. */
  lowAmmo: boolean;
  /** Behind cover, with a fight a moment ago or under fire: keeping up hide-and-peek is an option. */
  cover: boolean;
  /** Getting away from a threat it lost sight of a moment ago. */
  retreating: boolean;
  /** The pickup option's score (GUN_WEIGHT for a real gun with only a sidearm), -Infinity for none. */
  pickup: number;
  /** An enemy that slipped out of sight: where, and how long ago (s). */
  lost: { pos: Vec3; age: number } | null;
  /** A noise worth checking: where, and how long ago (s). */
  noise: { pos: Vec3; age: number } | null;
  /** Holding (or heading for) a vantage spot. */
  posted: boolean;
}

/**
 * How much a bot's objective is worth to it: a carrier's run home above everything, a person's order next, then an
 * objective to keep to (CTF attackers, an interceptor's cut-off point), one to hold (a defender's base), any other goal
 * (a hill, co-op's, a squad leader's); a little more for bots that care for objectives.
 */
export function goalWeight(g: OrderGoal, p: BotProfile): number {
  const care = (p.objectivePriority / 100) * 0.3;
  if (g.run) return 6;
  if (g.order) return 2.4;
  if (g.push) return 1 + care;
  if (g.watch) return 0.9 + care;
  return 0.8 + care;
}

/**
 * How much leaving its goal to go to `at`, `d` m away, costs a bot: nothing without one; a carrier never leaves its
 * way, a bot under a person's orders only for something within ORDER_NOTICE, one keeping to its way (OrderGoal.push)
 * only for something within PUSH_NOTICE (measured: attackers allowed anything on their way spent 29 % of their time
 * going to noises 20-50 m off, and none got to the flag); one holding a place nothing for what happens close to the
 * place it holds, more the further from it (a CTF defender doesn't leave its flag for a fight 30 m off).
 */
export function leaveCost(g: OrderGoal | null, d: number, at: Vec3): number {
  if (!g) return 0;
  if (g.run) return Infinity;
  if (g.order) return d > ORDER_NOTICE ? Infinity : 0;
  if (g.push) return d > PUSH_NOTICE ? Infinity : 0;
  const off = horizontalDistance(g.pos, at) - g.radius;
  return Math.min(1.6, Math.max(0, (off - HOLD_NOTICE) / 12));
}

/** Every option's score into `sc` (-Infinity: not an option now). */
export function scoreChoices(i: ChoiceInput, sc: Float32Array): void {
  const g = i.goal;
  const p = i.profile;
  sc.fill(-Infinity);
  sc[OPT_GOAL] = g ? goalWeight(g, p) : -Infinity;
  sc[OPT_ROAM] = g ? -Infinity : ROAM_WEIGHT;
  if (i.cover) sc[OPT_COVER] = COVER_WEIGHT;
  if (i.retreating) sc[OPT_RETREAT] = RETREAT_WEIGHT;
  sc[OPT_PICKUP] = i.pickup;
  const lost = i.lost;
  if (lost && !i.hurt) {
    // An enemy that slipped out of sight: worth more to persistent bots and the fresher the sighting, less with
    // little ammo left; worth nothing once older than its persistence lets it chase.
    const most = 1 + (p.pursuitPersistence / 100) * 7;
    const d = horizontalDistance(i.me, lost.pos);
    if (lost.age < most && d > 1.5) sc[OPT_CHASE] = CHASE_WEIGHT + (p.pursuitPersistence / 100) * 0.4 + 0.4 * (1 - lost.age / most) - (i.lowAmmo ? 0.3 : 0) - leaveCost(g, d, lost.pos);
    if (i.posted && d > POST_NOTICE) sc[OPT_CHASE] = -Infinity;
  }
  const noise = i.noise;
  if (noise) {
    // A noise: more to aggressive and curious bots and the fresher it is, less when hurt.
    const d = horizontalDistance(i.me, noise.pos);
    if (noise.age < 10 && d > 2) sc[OPT_NOISE] = NOISE_WEIGHT + (p.aggression / 100) * 0.25 + (p.exploration / 100) * 0.15 + 0.2 * (1 - noise.age / 10) - (i.hurt ? 0.6 : 0) - leaveCost(g, d, noise.pos);
    if (i.posted && d > POST_NOTICE) sc[OPT_NOISE] = -Infinity;
  }
}

/** The best option (the one chosen last counts MARGIN more); with none, the goal or roaming. */
export function bestChoice(sc: Float32Array, last: number, hasGoal: boolean): number {
  let best = -1;
  let top = -Infinity;
  for (let i = 0; i < OPTIONS; i++) {
    const v = sc[i]! + (i === last && sc[i]! > -Infinity ? MARGIN : 0);
    if (v > top) {
      top = v;
      best = i;
    }
  }
  return best < 0 ? (hasGoal ? OPT_GOAL : OPT_ROAM) : best;
}
