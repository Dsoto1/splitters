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
  tags: string[];
  weaponPreferences: string[];
}

export interface BotDifficulty {
  id: 'easy' | 'normal' | 'hard';
  /** Time an enemy must be continuously visible before the bot opens fire. */
  reactionMs: number;
  /** Base aim error (radians) before the profile's accuracy is applied. */
  aimErrorRad: number;
  turnRateRadPerSec: number;
  /** Ticks between perception refreshes (staggered across bots). */
  perceptionIntervalTicks: number;
}

export const BOT_DIFFICULTIES: Readonly<Record<BotDifficulty['id'], BotDifficulty>> = {
  easy: { id: 'easy', reactionMs: 650, aimErrorRad: 0.12, turnRateRadPerSec: 3, perceptionIntervalTicks: 12 },
  normal: { id: 'normal', reactionMs: 380, aimErrorRad: 0.06, turnRateRadPerSec: 6, perceptionIntervalTicks: 8 },
  hard: { id: 'hard', reactionMs: 200, aimErrorRad: 0.025, turnRateRadPerSec: 10, perceptionIntervalTicks: 5 },
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
  { ...base, id: 'core.berserker', displayName: 'Berserker', aggression: 95, selfPreservation: 10, pursuitPersistence: 90, rangePreference: 10, riskTolerance: 95, accuracy: 35, tags: ['BERSERKER', 'RECKLESS'] },
  { ...base, id: 'core.marksman', displayName: 'Marksman', aggression: 35, selfPreservation: 60, pursuitPersistence: 30, rangePreference: 90, accuracy: 80, reactionSpeed: 60, tags: ['SNIPER'] },
  { ...base, id: 'core.coward', displayName: 'Coward', aggression: 20, selfPreservation: 95, pursuitPersistence: 10, rangePreference: 70, riskTolerance: 5, tags: ['COWARD', 'SURVIVOR'] },
  { ...base, id: 'core.wanderer', displayName: 'Wanderer', exploration: 90, aggression: 55, tags: ['EXPLORER'] },
];
