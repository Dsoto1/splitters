/**
 * Bot personality (CHARACTERS_BOTS_V2 §11, §29) and difficulty (§12) are
 * separate: difficulty changes how well a bot executes, personality changes
 * what it chooses to do.
 */
export interface BotProfile {
  id: string;
  displayName: string;
  /** All attributes are 0..100. */
  accuracy: number;
  reactionSpeed: number;
  aggression: number;
  selfPreservation: number;
  tacticalAwareness: number;
  objectivePriority: number;
  itemGreed: number;
  pursuitPersistence: number;
  exploration: number;
  teamLoyalty: number;
  riskTolerance: number;
  meleePreference: number;
  rangePreference: number;
  /**
   * Behaviour tags the brain acts on: BERSERKER (rushes across open ground),
   * SNIPER (scoped weapons from range, prone), COWARD, SUPPRESSOR (keeps
   * firing at where an enemy went into cover), GRUNT (squad infantry that
   * advances in pairs), NPC.
   */
  tags: string[];
  /** Weapon IDs this personality favours when choosing what to hold. */
  weaponPreferences: string[];
}

/**
 * Human-like aim (see aim.ts). Errors are angles (radians, one standard
 * deviation) before the profile's accuracy and the situation (distance,
 * movement, stance, target speed) scale them.
 */
export interface AimSkill {
  /** Wobble once settled on a still target, shooting standing still. */
  settledRad: number;
  /** Extra error on first sight of a target (first shots miss more). */
  acquireRad: number;
  /** How fast the error settles while tracking (time constant). */
  settleSeconds: number;
  /** Tracking latency: the aim follows where the target was this long ago... */
  lagSeconds: number;
  /** ...and leads by this share of that lag (1 = perfect prediction). */
  prediction: number;
  /** Chance per burst of going for the head (centre mass otherwise), at accuracy 50. */
  headChance: number;
  /** Rounds per controlled burst with automatic weapons at range. */
  burst: readonly [number, number];
  /** Shortest time between semi-automatic taps. */
  tapSeconds: number;
}

export interface BotDifficulty {
  id: 'easy' | 'normal' | 'hard';
  /** Time an enemy must be continuously visible before the bot opens fire. */
  reactionMs: number;
  aim: AimSkill;
  turnRateRadPerSec: number;
  /** Ticks between perception refreshes (staggered across bots). */
  perceptionIntervalTicks: number;
  /** 0..1: how well it plays tactically (cover, corner checks, grenades, reloading in cover). */
  tactics: number;
}

export const BOT_DIFFICULTIES: Readonly<Record<BotDifficulty['id'], BotDifficulty>> = {
  easy: {
    id: 'easy',
    reactionMs: 650,
    aim: { settledRad: 0.074, acquireRad: 0.18, settleSeconds: 0.9, lagSeconds: 0.24, prediction: 0.2, headChance: 0.02, burst: [2, 4], tapSeconds: 0.45 },
    turnRateRadPerSec: 3,
    perceptionIntervalTicks: 12,
    tactics: 0.35,
  },
  normal: {
    id: 'normal',
    reactionMs: 380,
    aim: { settledRad: 0.042, acquireRad: 0.13, settleSeconds: 0.6, lagSeconds: 0.15, prediction: 0.5, headChance: 0.08, burst: [3, 5], tapSeconds: 0.3 },
    turnRateRadPerSec: 6,
    perceptionIntervalTicks: 8,
    tactics: 0.7,
  },
  hard: {
    id: 'hard',
    reactionMs: 220,
    aim: { settledRad: 0.028, acquireRad: 0.09, settleSeconds: 0.4, lagSeconds: 0.09, prediction: 0.8, headChance: 0.2, burst: [4, 6], tapSeconds: 0.2 },
    turnRateRadPerSec: 9,
    perceptionIntervalTicks: 5,
    tactics: 1,
  },
};

const base: Omit<BotProfile, 'id' | 'displayName' | 'tags'> = {
  accuracy: 50,
  reactionSpeed: 50,
  aggression: 50,
  selfPreservation: 50,
  tacticalAwareness: 50,
  objectivePriority: 50,
  itemGreed: 50,
  pursuitPersistence: 50,
  exploration: 50,
  teamLoyalty: 50,
  riskTolerance: 50,
  meleePreference: 20,
  rangePreference: 50,
  weaponPreferences: [],
};

/** Placeholder personalities until roster characters carry their own default profiles. */
export const CORE_BOT_PROFILES: readonly BotProfile[] = [
  { ...base, id: 'core.berserker', displayName: 'Berserker', aggression: 95, selfPreservation: 10, pursuitPersistence: 90, rangePreference: 10, riskTolerance: 95, accuracy: 35, tacticalAwareness: 15, tags: ['BERSERKER', 'RECKLESS'] },
  { ...base, id: 'core.marksman', displayName: 'Marksman', aggression: 35, selfPreservation: 60, pursuitPersistence: 30, rangePreference: 90, accuracy: 80, reactionSpeed: 60, tacticalAwareness: 70, tags: ['SNIPER'], weaponPreferences: ['core.sniper', 'core.marksman', 'core.railgun'] },
  { ...base, id: 'core.coward', displayName: 'Coward', aggression: 20, selfPreservation: 95, pursuitPersistence: 10, rangePreference: 70, riskTolerance: 5, tags: ['COWARD', 'SURVIVOR'] },
  { ...base, id: 'core.wanderer', displayName: 'Wanderer', exploration: 90, aggression: 55, tacticalAwareness: 65, tags: ['EXPLORER'] },
];

/** Does the profile carry this behaviour tag? */
export const hasTag = (p: BotProfile, tag: string): boolean => p.tags.includes(tag);
