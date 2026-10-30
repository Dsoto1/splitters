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
   * SNIPER (scoped weapons from range, prone; holds long sightlines), CAMPER
   * (holds a covered spot for a while), LONE_WOLF (no squad, flanks), COWARD
   * (gives up fights early, backs off when outnumbered), SUPPRESSOR (keeps
   * firing at where an enemy went into cover), GRUNT (squad infantry that
   * advances in pairs, keeps close), EXPLORER (seeks unvisited places), NPC.
   * Roles from them: docs/BOTS.md.
   */
  tags: string[];
  /** Weapon IDs this personality favours when choosing what to hold. */
  weaponPreferences: string[];
  /** ARENA bots: 'always' bunny-hop (the Arena match style); otherwise they hop only in fights (bots/brain.ts arenaHop). */
  hop?: 'always';
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
  /**
   * Gunplay (GUNPLAY_SPEC §40), all 0..1: share of a bullet's real flight-time
   * lead the bot applies, share of its drop it holds over for, share of the
   * recoil climb it pulls down against, and burst discipline (1: bursts end
   * when the spread starts to grow; 0: holds the trigger well past it).
   */
  leadSkill?: number;
  dropComp?: number;
  recoilComp?: number;
  discipline?: number;
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
  // Aim recalibrated after the range-band dithering fix (bots no longer shuffle back and forth, which had cost them accuracy).
  easy: {
    id: 'easy',
    reactionMs: 650,
    aim: { settledRad: 0.085, acquireRad: 0.18, settleSeconds: 0.9, lagSeconds: 0.24, prediction: 0.2, headChance: 0.02, burst: [2, 4], tapSeconds: 0.45, leadSkill: 0.3, dropComp: 0.2, recoilComp: 0.2, discipline: 0.2 },
    turnRateRadPerSec: 3,
    perceptionIntervalTicks: 12,
    tactics: 0.35,
  },
  normal: {
    id: 'normal',
    reactionMs: 380,
    aim: { settledRad: 0.044, acquireRad: 0.13, settleSeconds: 0.6, lagSeconds: 0.15, prediction: 0.5, headChance: 0.08, burst: [3, 5], tapSeconds: 0.3, leadSkill: 0.7, dropComp: 0.6, recoilComp: 0.55, discipline: 0.6 },
    turnRateRadPerSec: 6,
    perceptionIntervalTicks: 8,
    tactics: 0.7,
  },
  hard: {
    id: 'hard',
    reactionMs: 220,
    aim: { settledRad: 0.028, acquireRad: 0.09, settleSeconds: 0.4, lagSeconds: 0.09, prediction: 0.8, headChance: 0.2, burst: [4, 6], tapSeconds: 0.2, leadSkill: 0.95, dropComp: 0.9, recoilComp: 0.85, discipline: 0.9 },
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
    character('core.ranger', 'Linktifa', { rangePreference: 85, accuracy: 70, aggression: 40, tacticalAwareness: 70, tags: ['SNIPER', 'TACTICAL'], weaponPreferences: ['core.sniper', 'core.marksman', 'core.rifle'] }),
    character('core.huntress', 'Huntress', { rangePreference: 70, accuracy: 72, pursuitPersistence: 80, tacticalAwareness: 60, tags: ['TACTICAL'], weaponPreferences: ['core.rifle', 'core.marksman', 'core.burst_rifle'] }),
    character('core.sprout', 'Sprout', { aggression: 70, itemGreed: 80, exploration: 75, rangePreference: 30, tags: ['ARENA'], weaponPreferences: ['core.smg', 'core.machine_pistol', 'core.nailgun'] }),
    character('core.bulwark', 'Bulwark', { aggression: 65, selfPreservation: 30, riskTolerance: 75, rangePreference: 25, tags: ['SUPPRESSOR'], weaponPreferences: ['core.lmg', 'core.auto_shotgun', 'core.rockets'] }),
    character('core.warden', 'Warden', { teamLoyalty: 85, objectivePriority: 80, tacticalAwareness: 80, selfPreservation: 60, tags: ['TACTICAL', 'SUPPRESSOR'], weaponPreferences: ['core.rifle', 'core.lmg', 'core.shotgun'] }),
    character('core.scout', 'Scout', { objectivePriority: 90, aggression: 60, exploration: 70, rangePreference: 35, tags: ['ARENA'], weaponPreferences: ['core.smg', 'core.sawed_off', 'core.pulse_pistol'] }),
    character('core.farmhand', 'Farmhand', { aggression: 75, meleePreference: 55, rangePreference: 15, accuracy: 40, riskTolerance: 70, tags: ['BERSERKER'], weaponPreferences: ['core.shotgun', 'core.sawed_off', 'core.auto_shotgun'] }),
    character('core.tracker', 'Tracker', { exploration: 85, pursuitPersistence: 85, tacticalAwareness: 60, tags: ['EXPLORER', 'LONE_WOLF'], weaponPreferences: ['core.burst_rifle', 'core.rifle', 'core.laser_rifle'] }),
    character('core.pathfinder', 'Pathfinder', { exploration: 95, itemGreed: 75, aggression: 55, tags: ['EXPLORER', 'ARENA'], weaponPreferences: ['core.disc_launcher', 'core.plasma', 'core.railgun'] }),
    character('core.drifter', 'Drifter', { aggression: 45, selfPreservation: 70, riskTolerance: 30, rangePreference: 65, tags: ['SURVIVOR', 'LONE_WOLF'], weaponPreferences: ['core.hand_cannon', 'core.marksman', 'core.flare_gun'] }),
    character('core.wayfarer', 'Wayfarer', { tacticalAwareness: 65, teamLoyalty: 70, objectivePriority: 70, tags: [], weaponPreferences: ['core.rifle', 'core.launcher', 'core.smg'] }),
    character('core.brawler', 'Brawler', { aggression: 95, meleePreference: 80, selfPreservation: 15, rangePreference: 5, riskTolerance: 90, accuracy: 35, tags: ['BERSERKER', 'RECKLESS'], weaponPreferences: ['core.shotgun', 'core.flamethrower', 'core.knife'] }),
    character('core.commando', 'Commando', { aggression: 70, tacticalAwareness: 85, teamLoyalty: 75, accuracy: 65, tags: ['TACTICAL'], weaponPreferences: ['core.rifle', 'core.burst_rifle', 'core.shotgun'] }),
    // Charges in with a big gun and won't be talked out of it.
    character('core.knight', 'Iron Knight', { aggression: 85, selfPreservation: 25, riskTolerance: 80, meleePreference: 60, rangePreference: 15, pursuitPersistence: 85, tags: ['BERSERKER'], weaponPreferences: ['core.auto_shotgun', 'core.shotgun', 'core.lmg'] }),
    // Space-age tech, cool head: energy weapons from mid range.
    character('core.nova', 'Capt. Nova', { aggression: 55, accuracy: 72, tacticalAwareness: 70, rangePreference: 55, tags: ['TACTICAL'], weaponPreferences: ['core.plasma', 'core.laser_rifle', 'core.railgun'] }),
    // Hangs back, picks his moment, never misses the pay-off.
    character('core.dapper', 'The Dapper', { aggression: 45, accuracy: 78, selfPreservation: 70, itemGreed: 80, rangePreference: 45, tags: ['TACTICAL'], weaponPreferences: ['core.smg', 'core.gilded_pistol', 'core.machine_pistol'] }),
    // Darts in close, grabs what's lying about, never fights fair.
    character('core.goblin', 'Goblin', { aggression: 80, itemGreed: 90, selfPreservation: 35, rangePreference: 15, meleePreference: 60, tags: ['ARENA', 'RECKLESS'], weaponPreferences: ['core.sawed_off', 'core.machine_pistol', 'core.knife'] }),
    // Keeps his distance and his fur clean: a gilded pistol and a good rifle.
    character('core.otter', 'Wealthy Otter', { aggression: 35, accuracy: 75, selfPreservation: 80, itemGreed: 85, rangePreference: 70, tags: ['TACTICAL', 'CAMPER'], weaponPreferences: ['core.marksman', 'core.gilded_pistol', 'core.sniper'] }),
    // Slow, stubborn and hard to shift.
    character('core.boglurker', 'Boglurker', { aggression: 70, selfPreservation: 30, riskTolerance: 80, rangePreference: 20, pursuitPersistence: 70, tags: ['SUPPRESSOR'], weaponPreferences: ['core.auto_shotgun', 'core.flamethrower', 'core.lmg'] }),
    // Commands the field with heavy ordnance.
    character('core.warlord', 'Salamander Warlord', { aggression: 65, tacticalAwareness: 75, objectivePriority: 80, rangePreference: 50, tags: ['SUPPRESSOR', 'TACTICAL'], weaponPreferences: ['core.launcher', 'core.rockets', 'core.lmg'] }),
    // Hunts in packs and never lets a wounded target go.
    character('core.hyena', 'Hyena Warrior', { aggression: 80, pursuitPersistence: 95, teamLoyalty: 80, rangePreference: 35, tags: ['ARENA'], weaponPreferences: ['core.smg', 'core.shotgun', 'core.burst_rifle'] }),
    // Patient, unhurried, and somehow always in the right place.
    character('core.elder', 'Elder Tomo', { aggression: 30, accuracy: 80, selfPreservation: 75, tacticalAwareness: 85, rangePreference: 60, tags: ['TACTICAL'], weaponPreferences: ['core.marksman', 'core.revolver', 'core.burst_rifle'] }),
    // Curious about everything, armed with things that glow.
    character('core.visitor', 'The Visitor', { aggression: 55, exploration: 90, itemGreed: 70, rangePreference: 50, tags: ['EXPLORER'], weaponPreferences: ['core.laser_rifle', 'core.plasma', 'core.pulse_pistol'] }),
    // Small, quick and easily distracted by shiny pickups.
    character('core.biscuit', 'Biscuit', { aggression: 70, itemGreed: 95, reactionSpeed: 80, exploration: 75, rangePreference: 25, tags: ['ARENA', 'RECKLESS'], weaponPreferences: ['core.smg', 'core.machine_pistol', 'core.bubble_blaster'] }),
    // Flies the map like an airfield: fast passes, rockets on the way through.
    character('core.ember', 'Flt. Lt. Ember', { aggression: 70, reactionSpeed: 80, exploration: 65, rangePreference: 45, tags: ['ARENA'], weaponPreferences: ['core.rockets', 'core.burst_rifle', 'core.flare_gun'] }),
    // Boards at close range with a short gun and a long grudge.
    character('core.barnacle', "Cap'n Barnacle", { aggression: 80, itemGreed: 85, riskTolerance: 75, rangePreference: 20, meleePreference: 45, tags: ['ARENA', 'RECKLESS'], weaponPreferences: ['core.sawed_off', 'core.hand_cannon', 'core.flak'] }),
    // Walks through the front door carrying the heaviest thing in the building.
    character('core.bogdan', 'Big Bogdan', { aggression: 75, selfPreservation: 25, riskTolerance: 85, rangePreference: 25, pursuitPersistence: 70, tags: ['SUPPRESSOR'], weaponPreferences: ['core.lmg', 'core.auto_shotgun', 'core.launcher'] }),
    character('core.frost', 'Frost', { rangePreference: 90, accuracy: 82, aggression: 30, selfPreservation: 70, tags: ['SNIPER'], weaponPreferences: ['core.sniper', 'core.railgun', 'core.marksman'] }),
    character('core.operative', 'Operative', { accuracy: 75, reactionSpeed: 75, tacticalAwareness: 80, aggression: 45, tags: ['TACTICAL'], weaponPreferences: ['core.smg', 'core.hand_cannon', 'core.marksman'] }),
    character('core.medic', 'Medic', { teamLoyalty: 95, selfPreservation: 70, objectivePriority: 70, aggression: 35, tags: ['SURVIVOR'], weaponPreferences: ['core.smg', 'core.rifle', 'core.pulse_pistol'] }),
    character('core.engineer', 'Engineer', { aggression: 60, rangePreference: 25, riskTolerance: 70, tags: ['SUPPRESSOR'], weaponPreferences: ['core.flamethrower', 'core.nailgun', 'core.launcher'] }),
    character('core.sentinel', 'Sentinel', { selfPreservation: 80, objectivePriority: 85, teamLoyalty: 80, aggression: 40, rangePreference: 55, tags: ['TACTICAL', 'SUPPRESSOR'], weaponPreferences: ['core.lmg', 'core.rifle', 'core.launcher'] }),
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
  return { ...own, tags: [...tags, style === 'arena' ? 'ARENA' : 'TACTICAL'], ...(style === 'arena' ? { hop: 'always' as const } : {}) };
}
