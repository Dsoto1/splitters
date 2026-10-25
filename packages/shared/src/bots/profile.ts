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

type Traits = Partial<Omit<BotProfile, 'id' | 'displayName'>>;
const character = (id: string, displayName: string, traits: Traits): BotProfile => ({ ...base, id, displayName, tags: [], ...traits });

/**
 * Each preset character plays its own way as a bot: stats, tendencies and
 * favourite weapons, in keeping with its bio. ARENA characters strafe-jump
 * and time items; TACTICAL ones hold angles and use cover and stance.
 */
export const CHARACTER_PROFILES: Readonly<Record<string, BotProfile>> = Object.fromEntries(
  [
    character('core.ranger', 'Ranger', { rangePreference: 85, accuracy: 70, aggression: 40, tacticalAwareness: 70, tags: ['SNIPER', 'TACTICAL'], weaponPreferences: ['core.sniper', 'core.marksman', 'core.rifle'] }),
    character('core.huntress', 'Huntress', { rangePreference: 70, accuracy: 72, pursuitPersistence: 80, tacticalAwareness: 60, tags: ['TACTICAL'], weaponPreferences: ['core.rifle', 'core.marksman', 'core.burst_rifle'] }),
    character('core.sprout', 'Sprout', { aggression: 70, itemGreed: 80, exploration: 75, rangePreference: 30, tags: ['ARENA'], weaponPreferences: ['core.smg', 'core.machine_pistol', 'core.nailgun'] }),
    character('core.bulwark', 'Bulwark', { aggression: 65, selfPreservation: 30, riskTolerance: 75, rangePreference: 25, tags: ['SUPPRESSOR'], weaponPreferences: ['core.lmg', 'core.auto_shotgun', 'core.rockets'] }),
    character('core.warden', 'Warden', { teamLoyalty: 85, objectivePriority: 80, tacticalAwareness: 80, selfPreservation: 60, tags: ['TACTICAL', 'SUPPRESSOR'], weaponPreferences: ['core.rifle', 'core.lmg', 'core.shotgun'] }),
    character('core.scout', 'Scout', { objectivePriority: 90, aggression: 60, exploration: 70, rangePreference: 35, tags: ['ARENA'], weaponPreferences: ['core.smg', 'core.sawed_off', 'core.pulse_pistol'] }),
    character('core.farmhand', 'Farmhand', { aggression: 75, meleePreference: 55, rangePreference: 15, accuracy: 40, riskTolerance: 70, tags: ['BERSERKER'], weaponPreferences: ['core.shotgun', 'core.sawed_off', 'core.auto_shotgun'] }),
    character('core.miller', 'Miller', { aggression: 30, selfPreservation: 75, tacticalAwareness: 75, pursuitPersistence: 25, rangePreference: 60, tags: ['TACTICAL'], weaponPreferences: ['core.marksman', 'core.launcher', 'core.rifle'] }),
    character('core.tracker', 'Tracker', { exploration: 85, pursuitPersistence: 85, tacticalAwareness: 60, tags: ['EXPLORER'], weaponPreferences: ['core.burst_rifle', 'core.rifle', 'core.laser_rifle'] }),
    character('core.pathfinder', 'Pathfinder', { exploration: 95, itemGreed: 75, aggression: 55, tags: ['EXPLORER', 'ARENA'], weaponPreferences: ['core.disc_launcher', 'core.plasma', 'core.railgun'] }),
    character('core.drifter', 'Drifter', { aggression: 45, selfPreservation: 70, riskTolerance: 30, rangePreference: 65, tags: ['SURVIVOR'], weaponPreferences: ['core.hand_cannon', 'core.marksman', 'core.flare_gun'] }),
    character('core.wayfarer', 'Wayfarer', { tacticalAwareness: 65, teamLoyalty: 70, objectivePriority: 70, tags: [], weaponPreferences: ['core.rifle', 'core.launcher', 'core.smg'] }),
    character('core.brawler', 'Brawler', { aggression: 95, meleePreference: 80, selfPreservation: 15, rangePreference: 5, riskTolerance: 90, accuracy: 35, tags: ['BERSERKER', 'RECKLESS'], weaponPreferences: ['core.shotgun', 'core.flamethrower', 'core.knife'] }),
    character('core.sprinter', 'Sprinter', { aggression: 80, itemGreed: 85, reactionSpeed: 75, rangePreference: 30, tacticalAwareness: 30, tags: ['ARENA'], weaponPreferences: ['core.smg', 'core.plasma', 'core.disc_launcher'] }),
    character('core.champion', 'Champion', { accuracy: 80, reactionSpeed: 80, aggression: 75, itemGreed: 80, tags: ['ARENA'], weaponPreferences: ['core.railgun', 'core.rockets', 'core.plasma'] }),
    character('core.commando', 'Commando', { aggression: 70, tacticalAwareness: 85, teamLoyalty: 75, accuracy: 65, tags: ['TACTICAL'], weaponPreferences: ['core.rifle', 'core.burst_rifle', 'core.shotgun'] }),
    character('core.frost', 'Frost', { rangePreference: 90, accuracy: 82, aggression: 30, selfPreservation: 70, tags: ['SNIPER'], weaponPreferences: ['core.sniper', 'core.railgun', 'core.marksman'] }),
    character('core.operative', 'Operative', { accuracy: 75, reactionSpeed: 75, tacticalAwareness: 80, aggression: 45, tags: ['TACTICAL'], weaponPreferences: ['core.smg', 'core.hand_cannon', 'core.marksman'] }),
    character('core.medic', 'Medic', { teamLoyalty: 95, selfPreservation: 70, objectivePriority: 70, aggression: 35, tags: ['SURVIVOR'], weaponPreferences: ['core.smg', 'core.rifle', 'core.pulse_pistol'] }),
    character('core.engineer', 'Engineer', { aggression: 60, rangePreference: 25, riskTolerance: 70, tags: ['SUPPRESSOR'], weaponPreferences: ['core.flamethrower', 'core.nailgun', 'core.launcher'] }),
    character('core.desperado', 'Desperado', { accuracy: 70, reactionSpeed: 85, aggression: 65, rangePreference: 45, tags: ['ARENA'], weaponPreferences: ['core.hand_cannon', 'core.shotgun', 'core.sawed_off'] }),
    character('core.raider', 'Raider', { aggression: 85, itemGreed: 80, exploration: 70, rangePreference: 25, tags: ['ARENA', 'RECKLESS'], weaponPreferences: ['core.auto_shotgun', 'core.smg', 'core.disc_launcher'] }),
    character('core.sentinel', 'Sentinel', { selfPreservation: 80, objectivePriority: 85, teamLoyalty: 80, aggression: 40, rangePreference: 55, tags: ['TACTICAL', 'SUPPRESSOR'], weaponPreferences: ['core.lmg', 'core.rifle', 'core.launcher'] }),
    character('core.striker', 'Striker', { aggression: 85, pursuitPersistence: 90, riskTolerance: 75, rangePreference: 30, tags: ['ARENA'], weaponPreferences: ['core.rockets', 'core.auto_shotgun', 'core.smg'] }),
  ].map((p) => [p.id, p]),
);

/** Overall bot style for a match: each character's own, or everyone arena / tactical. */
export type BotStyle = 'mixed' | 'arena' | 'tactical';
export const BOT_STYLES: readonly BotStyle[] = ['mixed', 'arena', 'tactical'];

/** The profile a bot plays with: its character's own when it has one, under the match's style. */
export function profileFor(look: string, fallback: BotProfile, style: BotStyle = 'mixed'): BotProfile {
  const own = CHARACTER_PROFILES[look] ?? fallback;
  if (style === 'mixed') return own;
  const tags = own.tags.filter((t) => t !== 'ARENA' && t !== 'TACTICAL');
  return { ...own, tags: [...tags, style === 'arena' ? 'ARENA' : 'TACTICAL'] };
}
