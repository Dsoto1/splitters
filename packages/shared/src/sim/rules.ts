import type { MapDocument } from '../map/schema.ts';
import { racePath } from '../map/track.ts';
import { TICK_RATE } from './constants.ts';
import { mapTeams } from './npc.ts';

export type GameMode = 'core.deathmatch' | 'core.coop' | 'core.tdm' | 'core.ctf' | 'core.koth' | 'core.elim' | 'core.bomb' | 'core.hostage' | 'core.breakthrough' | 'core.zombies' | 'core.forts' | 'core.discs' | 'core.race' | 'core.roulette';

/** Every mode, in menu order. */
export const GAME_MODES: readonly GameMode[] = ['core.deathmatch', 'core.roulette', 'core.tdm', 'core.ctf', 'core.koth', 'core.elim', 'core.bomb', 'core.hostage', 'core.breakthrough', 'core.forts', 'core.coop', 'core.zombies', 'core.discs', 'core.race'];

export const MODE_LABELS: Record<GameMode, string> = {
  'core.deathmatch': 'Deathmatch',
  'core.roulette': 'Roulette',
  'core.tdm': 'Team Deathmatch',
  'core.ctf': 'Capture the Flag',
  'core.koth': 'King of the Hill',
  'core.elim': 'Elimination',
  'core.bomb': 'Bomb',
  'core.hostage': 'Hostage Rescue',
  'core.breakthrough': 'Breakthrough',
  'core.coop': 'Co-op',
  'core.zombies': 'Zombies',
  'core.forts': 'Fort Wars',
  'core.discs': 'Disc Arena',
  'core.race': 'Race',
};

/** Modes played in teams (factions from mapTeams). */
export const isTeamMode = (mode: string): boolean => mode === 'core.tdm' || mode === 'core.ctf' || mode === 'core.koth' || mode === 'core.elim' || mode === 'core.bomb' || mode === 'core.hostage' || mode === 'core.breakthrough' || mode === 'core.forts';

/** Modes that are always exactly two teams (attack/defend, or one flag each). */
export const isTwoTeamMode = (mode: string): boolean => mode === 'core.ctf' || mode === 'core.forts' || mode === 'core.bomb' || mode === 'core.hostage' || mode === 'core.breakthrough';

export const isGameMode = (mode: string): mode is GameMode => (GAME_MODES as readonly string[]).includes(mode);

/** Reusable, mode-agnostic match rules (v1 spec §4.3). */
export interface MatchRules {
  mode: GameMode;
  /** Kills that win the round; 0 = no score limit (co-op ends through logic). */
  scoreLimit: number;
  /** 0 = no time limit. */
  timeLimitSeconds: number;
  respawnDelayTicks: number;
  /** Weapons every player spawns with; the last one is held. */
  startingWeapons: string[];
  /** Frag grenades everyone spawns with. */
  startingGrenades: number;
  /** Ticks the results screen stays up before the next round starts. */
  intermissionTicks: number;
  /**
   * Team modes: players per team, 2–8 teams of any sizes (e.g. [2, 2, 2, 12]).
   * Absent: two teams, balanced as players join.
   */
  teamSizes?: number[];
  /**
   * Team modes: how people are put on teams. 'balanced' (default): each
   * person joins the team with the fewest people for its size, so people
   * (who outplay bots) spread evenly. 'random': a random team with room.
   * 'fixed': the first person (offline you, the Host game host) joins
   * `hostTeam`; anyone after is balanced.
   */
  teamAssign?: 'balanced' | 'random' | 'fixed';
  /** Team modes with teamAssign 'fixed': the team (by order, from 0) the first person joins. */
  hostTeam?: number;
  /**
   * Team leaders (team modes): each team's first person (else a bot) leads,
   * marked for everyone; the leader's "Follow me!" / "Hold here!" orders the
   * whole team's bots, wherever they are. 'vip': Leader variant of Team
   * Deathmatch, where downing an enemy leader scores LEADER_BOUNTY extra.
   */
  leaders?: boolean | 'vip';
  /**
   * Fireteams (sim/fireteams.ts, docs/FIRETEAMS_PLAN.md): every person leads a fixed squad of bots of this size (their
   * leader included, 4-6), bot-led squads of the same size fill each team, and leaders order their squad by a wheel.
   * Team modes FIRETEAM_MODES. Absent: off.
   */
  fireteams?: number;
  /** Capture the Flag: seconds a dropped flag lies before it goes home on its own (default 30). */
  flagReturnSeconds?: number;
  /** King of the Hill: seconds before the hill moves to the next spot (default 60). */
  hillSeconds?: number;
  /** Small and large characters play differently (BODY_SIZES); false makes everyone standard. Default true. */
  bodySizes?: boolean;
  /**
   * Character stats: each look's own health, speed, size, damage, stamina, jump, melee and armor (sim/characterStats.ts;
   * a look without one plays its size class's). false: nobody's own stats count. Default true.
   */
  characterStats?: boolean;
  /** Random characters: everyone, people and bots, plays a random playable look each life (sim/randomLooks.ts). Default false. */
  randomCharacters?: boolean;
  /** Quick messages and emotes (default true). */
  emotes?: boolean;
  /** How bots play: each character's own way (mixed, default), all arena-style or all tactical. */
  botStyle?: 'mixed' | 'arena' | 'tactical';
  /**
   * Which looks random bots wear, and so their names (content/botNames.ts): character groups and/or name themes
   * ("soldiers"). Absent: the map's own (MapDocument.botCast); empty: every look (All).
   */
  botCast?: string[];
  /**
   * Mix up weapon pickups: every weapon pickup not marked "keep fixed" rolls a weapon of the same category
   * as the one placed there each time it comes back (sim/pickupRoll.ts). Default off.
   */
  mixPickups?: boolean;
  /**
   * Drop weapon on death: a fallen player's or bot's primary with ammo left lies at the body for anyone to
   * pick up, with exactly that ammo (sim/drops.ts). Default true; never in Disc Arena, races or spears/discs only.
   */
  dropWeapons?: boolean;
  /**
   * Weapon set (sim/weaponSets.ts, content/weapon-sets.json: standard, military, scifi, medieval, chaos, mixed): what
   * everyone spawns with, what weapon and grenade pickups hold and what drops. Absent: the map's default
   * (MapDocument.weaponSet), else Standard. Spears or discs only (and Disc Arena) play none.
   */
  weaponSet?: string;
  /**
   * Seconds of spawn protection each life (a shield nobody else's damage gets through, dropped the moment you fire);
   * absent: the mode's (content/match-play.json spawnProtection; sim/spawns.ts spawnProtection). 0: none.
   */
  spawnProtection?: number;
  /** Kill-streak rewards (UAV, supply pulse, Counter-UAV, airstrike). Default true. */
  killstreaks?: boolean;
  /** Team modes: respawn beside a teammate who isn't in a fight, when one is free. Default true. */
  squadSpawn?: boolean;
  /** Gravity multiple (1 normal); absent: the map's own (MapMaker), else normal. */
  gravity?: number;
  /** Long falls hurt; absent: the map's own setting, else off. */
  fallDamage?: boolean;
  /** Team modes: whether shots and blasts hurt teammates (full or half damage). Default off. */
  friendlyFire?: 'off' | 'half' | 'on';
  /** Team names and colours chosen for this match (by team order); absent: the map's. */
  teamNames?: string[];
  teamColors?: string[];
  /**
   * Spears only: everyone holds one throwing spear (one hit kills; fetch it back). Discs only: everyone
   * throws arena discs that knock players off instead of hurting them (Disc Arena). Either way, no
   * weapon, ammo or grenade pickups.
   */
  weapons?: 'normal' | 'spears' | 'discs';
  /** Classes (sim/classes.ts): everyone picks a class with its own loadout, health, speed and ability. */
  classes?: boolean;
  /** Classes: most players per team (all players in free-for-all) in any one class; 0 or absent = no limit. */
  classLimit?: number;
  /** How much damage vehicles take: normal, tough (half) or off (they can't be destroyed except by falling off the map). Default normal. */
  vehicleDamage?: 'normal' | 'tough' | 'off';
  /** Fort Wars: seconds of each build phase and each combat (Capture the Flag) phase, build/combat cycles, and build points per team per match. */
  fortBuildSeconds?: number;
  fortCombatSeconds?: number;
  fortCycles?: number;
  fortBudget?: number;
  /**
   * Breakthrough (sim/modes/breakthrough.ts): the attackers' reinforcements, per attacker (the pool is this times the
   * attacking team's size, topped up by half as much for each sector taken; default BREAKTHROUGH_POOL), the seconds
   * each sector puts on the clock (default BREAKTHROUGH_SECTOR_SECONDS; a sector's own `seconds` wins), and whether
   * a second round is played with the sides swapped (default no).
   */
  breakthroughPool?: number;
  breakthroughSectorSeconds?: number;
  breakthroughSwap?: boolean;
  /**
   * Roulette (sim/roulette.ts, docs/ROULETTE_MODE_PLAN.md): a new character every life from each player's own
   * shuffled deck, with character stats, a spawn card and spawn protection. Always on in `core.roulette`; `roulette`
   * plays it in another mode (Roulette's Teams variant: Team Deathmatch). Its standard features are on unless switched
   * off (`rouletteSignature` signature loadouts, `rouletteJackpots` jackpot and tiny rolls and the Giant Slayer bonus,
   * `rouletteStreakPick` a pick of 3 after a streak); its variants are off unless switched on (`rouletteRerolls` reroll
   * tokens earned by kills, `rouletteSwapOnKill` become your victim, `rouletteVariety` bonus points for kills as new
   * characters). `teamOutlines`: strong team-colour outlines on every player (random looks hide the sides).
   */
  roulette?: boolean;
  rouletteSignature?: boolean;
  rouletteJackpots?: boolean;
  rouletteStreakPick?: boolean;
  rouletteRerolls?: boolean;
  rouletteSwapOnKill?: boolean;
  rouletteVariety?: boolean;
  teamOutlines?: boolean;
  /**
   * Lunar's extras (the Lunar variant, with its low gravity and no fall damage): a bonus point for a kill while
   * airborne, explosions that throw players about, floaty ragdolls, stronger jump pads, and a gravity storm every
   * minute (gravity shifts for a while after a 3-second warning). Default off.
   */
  lunar?: boolean;
  /** Race: the vehicle everyone races in (absent: the track's own). */
  raceVehicle?: 'kart' | 'speeder' | 'buggy';
  /** Race: weapons, vehicle guns and sideline sentries on (absent: the track's own setting). */
  raceCombat?: boolean;
  /** Race: laps of a circuit (absent: the track's own). */
  raceLaps?: number;
  /**
   * Lethality (GUNPLAY_SPEC §10): one systemic damage multiple so every
   * weapon keeps its identity. Arcade ≈ 140% effective health, tactical ≈ 72%.
   * Absent: standard.
   */
  lethality?: 'arcade' | 'standard' | 'tactical';
  /**
   * Ballistics (GUNPLAY_SPEC §5): arcade bullets fly faster and barely drop,
   * advanced ones are slower and drop more. Absent: standard.
   */
  ballistics?: 'arcade' | 'standard' | 'advanced';
}

/**
 * The highest score limit a host can set: big matches suggest far more than the old cap of 1,000 (48 v 48 Team
 * Deathmatch about 1,500: matchSetup.ts suggestedLimits), with room above for longer matches.
 */
export const SCORE_LIMIT_MAX = 5000;

/** Weapons-only rules (spears, discs) take away weapon, ammo and grenade pickups. */
export const restrictedWeapons = (rules: MatchRules): boolean => !!rules.weapons && rules.weapons !== 'normal';

/** Whether weapons drop on death in this match: the rule (default on), and never where it makes no sense. */
export const dropsInPlay = (rules: MatchRules): boolean => rules.dropWeapons !== false && !restrictedWeapons(rules) && rules.mode !== 'core.discs' && rules.mode !== 'core.race';

/** The gravity multiple and fall damage a match plays with: its own rules, else the map's, else normal / off. */
export function matchPhysics(rules: MatchRules, map: { physics?: { gravity: number; fallDamage: boolean } | null }): { gravity: number; fallDamage: boolean } {
  return { gravity: rules.gravity ?? map.physics?.gravity ?? 1, fallDamage: rules.fallDamage ?? map.physics?.fallDamage ?? false };
}

/** Whether Roulette's core plays in this match: the Roulette mode, or Roulette in another mode (its Teams variant). */
export const rouletteOn = (rules: Pick<MatchRules, 'mode' | 'roulette'>): boolean => rules.mode === 'core.roulette' || !!rules.roulette;

export const DEFAULT_DEATHMATCH_RULES: MatchRules = {
  mode: 'core.deathmatch',
  scoreLimit: 15,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
};

/**
 * Roulette (sim/roulette.ts): free-for-all where everyone plays a new character every life, with its stats, its
 * signature weapon and a chance of a jackpot roll. The score counts kills and bonus points (Giant Slayer, air kills,
 * variety).
 */
export const DEFAULT_ROULETTE_RULES: MatchRules = {
  mode: 'core.roulette',
  scoreLimit: 20,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 2.5),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 9,
  characterStats: true,
};

/**
 * Co-op: every player (and Player Bot) is on the players faction against the
 * map's NPCs. No friendly fire, no score or time limit; the mission's logic
 * ends the round with victory or defeat.
 */
export const DEFAULT_COOP_RULES: MatchRules = {
  mode: 'core.coop',
  scoreLimit: 0,
  timeLimitSeconds: 0,
  respawnDelayTicks: Math.round(TICK_RATE * 3),
  startingWeapons: ['core.knife', 'core.pistol', 'core.rifle'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 8,
};

/**
 * Zombies: everyone on the players' side against endless waves of zombies
 * (sim/zombies.ts). The fallen wait for the next wave; the game ends when
 * nobody is left standing. No score or time limit.
 */
export const DEFAULT_ZOMBIES_RULES: MatchRules = {
  mode: 'core.zombies',
  scoreLimit: 0,
  timeLimitSeconds: 0,
  respawnDelayTicks: Math.round(TICK_RATE * 3),
  startingWeapons: ['core.knife', 'core.pistol', 'core.rifle'],
  startingGrenades: 2,
  intermissionTicks: TICK_RATE * 8,
};

/**
 * Team Deathmatch: two to eight sides (the map's first two factions, or
 * Embers and Tide, then the rest of the palette), filled to their sizes as
 * players join, no friendly fire. Every kill scores for the
 * killer's team; the first team to the limit wins.
 */
export const DEFAULT_TDM_RULES: MatchRules = {
  mode: 'core.tdm',
  scoreLimit: 40,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 2.5),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
};

/**
 * Capture the Flag: two teams, each with a flag at its base. Bring the enemy
 * flag home while your own is there to score; the score limit counts captures.
 */
export const DEFAULT_CTF_RULES: MatchRules = {
  mode: 'core.ctf',
  scoreLimit: 3,
  timeLimitSeconds: 900,
  respawnDelayTicks: Math.round(TICK_RATE * 3),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 8,
  flagReturnSeconds: 30,
};

/**
 * King of the Hill: a hill zone that moves between the map's hill spots every
 * minute; a team scores a point per second while it alone stands on it.
 */
export const DEFAULT_KOTH_RULES: MatchRules = {
  mode: 'core.koth',
  scoreLimit: 120,
  timeLimitSeconds: 600,
  respawnDelayTicks: Math.round(TICK_RATE * 3),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
  hillSeconds: 60,
};

/**
 * Elimination: round-based Team Deathmatch. The dead wait for the next round;
 * the last team standing wins the round, and the score limit counts rounds.
 */
export const DEFAULT_ELIM_RULES: MatchRules = {
  mode: 'core.elim',
  scoreLimit: 5,
  timeLimitSeconds: 900,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
};

/**
 * Bomb: rounds like Elimination. The first team attacks with the bomb (plant
 * it at a bomb site, then keep it from being defused until it blows); the
 * second defends. Score limit counts rounds won.
 */
export const DEFAULT_BOMB_RULES: MatchRules = {
  mode: 'core.bomb',
  scoreLimit: 7,
  timeLimitSeconds: 1500,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapons: ['core.knife', 'core.pistol', 'core.rifle'],
  startingGrenades: 1,
  intermissionTicks: TICK_RATE * 6,
};

/** Hostage Rescue: rounds; the first team brings hostages to a rescue zone, the second guards them. */
export const DEFAULT_HOSTAGE_RULES: MatchRules = { ...DEFAULT_BOMB_RULES, mode: 'core.hostage' };

/** Breakthrough: reinforcements per attacker, and the seconds a sector puts on the clock, unless the match says otherwise. */
export const BREAKTHROUGH_POOL = 6;
export const BREAKTHROUGH_SECTOR_SECONDS = 240;
/** The most reinforcements per attacker a match can set. */
export const BREAKTHROUGH_POOL_MAX = 40;

/**
 * Breakthrough: the first team attacks through the map's sectors in order, the second holds each line in turn
 * (sim/modes/breakthrough.ts). The mode ends the match itself (the last sector taken, or the attackers out of
 * reinforcements or time), so there is no score or time limit; the defenders respawn a little slower.
 */
export const DEFAULT_BREAKTHROUGH_RULES: MatchRules = {
  mode: 'core.breakthrough',
  scoreLimit: 0,
  timeLimitSeconds: 0,
  respawnDelayTicks: Math.round(TICK_RATE * 4),
  startingWeapons: ['core.knife', 'core.pistol', 'core.rifle'],
  startingGrenades: 2,
  intermissionTicks: TICK_RATE * 8,
  breakthroughPool: BREAKTHROUGH_POOL,
  breakthroughSectorSeconds: BREAKTHROUGH_SECTOR_SECONDS,
};

/**
 * Fort Wars (SourceForts-style): a build phase with the teams walled apart,
 * each spending build points on pieces round its flag, then Capture the Flag
 * over the forts; optionally several build/combat cycles. The mode ends the
 * match itself after the last combat phase (no match time limit).
 */
export const DEFAULT_FORTS_RULES: MatchRules = {
  ...DEFAULT_CTF_RULES,
  mode: 'core.forts',
  timeLimitSeconds: 0,
  fortBuildSeconds: 150,
  fortCombatSeconds: 300,
  fortCycles: 1,
  fortBudget: 420,
};

/**
 * Disc Arena (Ricochet-style): free-for-all with arena discs only. Discs
 * knock players about instead of hurting them; whoever knocked you into the
 * void scores. Power discs lie about the arena.
 */
export const DEFAULT_DISCS_RULES: MatchRules = {
  mode: 'core.discs',
  scoreLimit: 10,
  timeLimitSeconds: 480,
  respawnDelayTicks: Math.round(TICK_RATE * 2),
  startingWeapons: ['core.arena_disc'],
  startingGrenades: 0,
  intermissionTicks: TICK_RATE * 6,
  weapons: 'discs',
  killstreaks: false,
};

/**
 * Race: everyone starts on the grid in a vehicle; checkpoints in order, laps
 * of the circuit, first over the line wins (sim/race.ts). The score limit is
 * unused; the time limit is a safety net.
 */
export const DEFAULT_RACE_RULES: MatchRules = {
  mode: 'core.race',
  scoreLimit: 0,
  timeLimitSeconds: 900,
  respawnDelayTicks: Math.round(TICK_RATE * 1.5),
  startingWeapons: ['core.knife', 'core.pistol'],
  startingGrenades: 0,
  intermissionTicks: TICK_RATE * 10,
};

export const DEFAULT_RULES: Record<GameMode, MatchRules> = {
  'core.deathmatch': DEFAULT_DEATHMATCH_RULES,
  'core.roulette': DEFAULT_ROULETTE_RULES,
  'core.tdm': DEFAULT_TDM_RULES,
  'core.coop': DEFAULT_COOP_RULES,
  'core.ctf': DEFAULT_CTF_RULES,
  'core.koth': DEFAULT_KOTH_RULES,
  'core.elim': DEFAULT_ELIM_RULES,
  'core.bomb': DEFAULT_BOMB_RULES,
  'core.hostage': DEFAULT_HOSTAGE_RULES,
  'core.breakthrough': DEFAULT_BREAKTHROUGH_RULES,
  'core.zombies': DEFAULT_ZOMBIES_RULES,
  'core.forts': DEFAULT_FORTS_RULES,
  'core.discs': DEFAULT_DISCS_RULES,
  'core.race': DEFAULT_RACE_RULES,
};

/** Race needs a track. */
export const hasTrack = (map: MapDocument): boolean => !!racePath(map);

/** Capture the Flag needs a flag base for each of its two teams. */
export function hasFlagBases(map: MapDocument): boolean {
  return mapTeams(map, 2).every((t) => map.entities.some((e) => e.kind === 'flag' && e.team === t.id));
}

/** King of the Hill needs at least one hill spot. */
export const hasHills = (map: MapDocument): boolean => map.entities.some((e) => e.kind === 'hill');

/** Bomb mode needs at least one bomb site. */
export const hasBombsites = (map: MapDocument): boolean => map.entities.some((e) => e.kind === 'bombsite');

/** Hostage Rescue needs hostages and somewhere to take them. */
export const hasHostages = (map: MapDocument): boolean => map.entities.some((e) => e.kind === 'hostage') && map.entities.some((e) => e.kind === 'rescue');

/** Breakthrough needs sectors: at least one, with an objective in it (MapMaker's Breakthrough pieces). */
export const hasSectors = (map: MapDocument): boolean => map.entities.some((e) => e.kind === 'sector' && map.entities.some((o) => o.kind === 'objective' && o.sector === e.order));

/** Can this map run the mode at all (CTF without flag bases, KOTH without hills or Bomb without sites can't)? */
export function mapCanRun(map: MapDocument, mode: GameMode): boolean {
  if (mode === 'core.bomb') return hasBombsites(map);
  if (mode === 'core.hostage') return hasHostages(map);
  if (mode === 'core.breakthrough') return hasSectors(map);
  if (mode === 'core.ctf' || mode === 'core.forts') return hasFlagBases(map);
  if (mode === 'core.koth') return hasHills(map);
  if (mode === 'core.race') return hasTrack(map);
  return true;
}

/**
 * The modes a map offers: the supported modes it can run, plus Capture the
 * Flag when it has flag bases, King of the Hill when it has hills, and
 * Elimination wherever Team Deathmatch is offered.
 */
export function playableModes(map: MapDocument): GameMode[] {
  const listed = map.metadata.supportedModes.filter(isGameMode).filter((m) => mapCanRun(map, m));
  const out = listed.length ? [...listed] : (['core.deathmatch'] as GameMode[]);
  if (hasFlagBases(map) && !out.includes('core.ctf')) out.push('core.ctf');
  // Fort Wars builds round the same two flag bases, so any CTF map plays it.
  if (hasFlagBases(map) && !out.includes('core.forts')) out.push('core.forts');
  if (hasHills(map) && !out.includes('core.koth')) out.push('core.koth');
  if (out.includes('core.tdm') && !out.includes('core.elim')) out.push('core.elim');
  if (hasBombsites(map) && !out.includes('core.bomb')) out.push('core.bomb');
  if (hasHostages(map) && !out.includes('core.hostage')) out.push('core.hostage');
  if (hasSectors(map) && !out.includes('core.breakthrough')) out.push('core.breakthrough');
  if (hasTrack(map) && !out.includes('core.race')) out.push('core.race');
  // Roulette is a free-for-all: it plays wherever Deathmatch or Team Deathmatch does.
  if ((out.includes('core.deathmatch') || out.includes('core.tdm')) && !out.includes('core.roulette')) out.splice(out.indexOf('core.deathmatch') >= 0 ? out.indexOf('core.deathmatch') + 1 : out.length, 0, 'core.roulette');
  // Zombies plays anywhere: the horde rises from the map's spawners, spawn points or open floor.
  if (!out.includes('core.zombies')) out.push('core.zombies');
  return out;
}

/** Default rules for a mode on a map (team modes take the map's recommended teams; CTF is always two). */
export function rulesForMode(map: MapDocument, mode: GameMode): MatchRules {
  const base = DEFAULT_RULES[mode];
  if (isTwoTeamMode(mode)) return { ...base, teamSizes: [...(map.teamSetup?.sizes.slice(0, 2) ?? [8, 8])] };
  if (isTeamMode(mode) && map.teamSetup) return { ...base, teamSizes: [...map.teamSetup.sizes] };
  return base;
}

/** The rules a map asks for: its first supported mode (when it can run it). */
export function rulesForMap(map: MapDocument): MatchRules {
  const first = map.metadata.supportedModes[0];
  return rulesForMode(map, first && isGameMode(first) && mapCanRun(map, first) ? first : 'core.deathmatch');
}
