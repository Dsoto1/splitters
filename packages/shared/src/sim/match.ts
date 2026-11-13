import type RAPIER from '@dimforge/rapier3d-compat';
import { simProfile } from './profile.ts';
import { BotBrain, type BotWorldView, type CombatantView, type InventoryView, type MountView, type NoiseView, type OrderGoal, type PickupView, type SeatView } from '../bots/brain.ts';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, profileFor, type BotDifficulty, type BotProfile, type BotStyle } from '../bots/profile.ts';
import { botSetInUse, mapBotSet, type BotEntry, type BotSet } from './botSet.ts';
import { SightCache } from '../bots/sight.ts';
import { ViewGrid } from '../bots/grid.ts';
import { BotDirector, CLUSTER_MIN_PLAYERS, assignRoles, leadAbility, type DirectorMember } from '../bots/director.ts';
import { Fireteams, REFUSALS, SQUAD_SPACINGS, checkOrder, squadHalf, squadSnapshot, fireteamMode, memberGoal, orderFromSay, ORDER_KINDS, type SquadNote, type OrderKind } from './fireteams.ts';
import type { TeamBrain } from '../bots/teamBrain.ts';
import { regionLayout } from '../bots/regions.ts';
import { VantageBoard, vantageFor } from '../bots/vantage.ts';
import { hintSpots, withHintSpots } from '../bots/hints.ts';
import { BotDebugCollector, type BotDebugFrame } from '../bots/debugView.ts';
import { mapBotHints } from '../map/botHints.ts';
import { buildMapGeometry, mapKillY, mapTerrainMesh, type WorldBox } from '../map/geometry.ts';
import { EncounterEntity as EncounterSchema, NPC_ROLES, PLAYERS_FACTION, type EncounterEntity, type Faction, type MapDocument, type NpcRole, type PickupEntity } from '../map/schema.ts';
import { add, createRng, distance, dot, horizontalDistance, lookAngles, normalize, scale, sub, viewDirection, type Vec3, hypot } from '../math.ts';
import {
  MOUNT_BURN_FRACTION, MOUNT_BURN_SECONDS, MOUNT_FLAG_ALIVE, MOUNT_FLAG_ARC, MOUNT_FLAG_BURNING, MOUNT_FLAG_CHARGING, MOUNT_FLAG_WRECK, MOUNT_WRECK_FADE_SECONDS, MOUNT_WRECK_SECONDS, VEHICLE_DAMAGE_SCALE,
  airCraftDef, BUILT_MOUNT_BASE, enterReach, FLOAT, MOUNT_DEFS, footprintGap, getMountDef, mountMass, mountToWorld, type MountDef, type SeatDef, type SeatRole, ammoRefillTicks, ammoRefilledBy, armourScale, firingSeat, sealedMount, type MountHit,
} from './mounts.ts';
import { airRoute, botDropIndex, canDrop, dropArea, dropIndex, dropOffsets, dropPlan, dropStretchEnds, dropTarget, routePose, shouldJump, ticksToRouteEnd, type AirRoute, type DropPlan } from './airplane.ts';
import { CHUTE, heightAboveGround } from './parachute.ts';
import type { NavWorld } from '../nav/index.ts';
import { buildMapNav } from './mapNav.ts';
import {
  POWERUP_DAMAGE_BIT,
  POWERUP_SPEED_BIT,
  STATUS_BURN,
  FX_JACKPOT,
  FX_PROTECTED,
  STATUS_CHILL,
  FX_JET,
  FX_SWIM,
  STATUS_FROZEN,
  STATUS_POISON,
  STATUS_SLOW,
  type GameEvent,
  type MatchPhase,
  type NpcSnapshot,
  type PlayerSnapshot,
  type PrivateState,
  type RosterEntry,
  type ScoreEntry,
  type ServerMessage,
  type Tuple3,
  type ZoneSnapshot,
  type MountSnapshot,
  type CoverSnapshot,
} from '../protocol.ts';
import { MAX_PLAYER_SLOTS, PLAYER, TICK_DT, TICK_RATE, type Stance } from './constants.ts';
import { CORE_WEAPONS } from '../content/weapons.generated.ts';
import { lastHit, type LookHitbox } from './hitbox.ts';
import { lookHitbox, npcHitbox } from './lookHitbox.ts';
import { classStats, matchStats, type CharacterStats } from './characterStats.ts';
import { randomLook } from './randomLooks.ts';
import { RouletteDirector } from './roulette.ts';
import { RESOURCE_BUDGETS } from '../map/budgets.ts';
import { ARMOR_ABSORB, DAMAGE_BOOST, MAX_ARMOR, PICKUP_RADIUS, SPEED_BOOST, STREAK_REWARDS, getItem, type ItemDefinition } from './items.ts';
import { rollPickup } from './pickupRoll.ts';
import { setAllowsDrop, setLoadout, setPickupPool, setSpawnWeapons, weaponSetInPlay, type WeaponSetDef } from './weaponSets.ts';
import { DROP_LIE_SECONDS, DROP_REACH, MAX_DROPS, chooseDrop, dropItem, dropSpent, takeDropAmmo, type WeaponDrop } from './drops.ts';
import { bodyHeightOf, eyeHeightOf, stanceOf } from './movement.ts';
import { thirdPersonAim, type RayQuery } from './thirdPerson.ts';
import { getProp } from '../content/props.ts';
import { getEnvSpecies } from '../content/environment.ts';
import { environmentShapes, type EnvWorldShape } from '../map/environment.ts';
import { SURFACE_TYPES } from './surfaceTypes.ts';
import { ZIP, leaveZipline, mapZiplines, oneHanded, ziplineLinks, type Zipline } from './zipline.ts';
import { BUTTON_AUTO_RELOAD, BUTTON_THIRD_PERSON, BUTTON_STEER_LOOK, BUTTON_ALT, BUTTON_MELEE, BUTTON_JUMP, BUTTON_CROUCH, BUTTON_PRONE, BUTTON_SPRINT, EMOTE_DANCE, PING, QUICK_MESSAGES, SAY_FOLLOW, SAY_HOLD, BUTTON_RESPAWN, BUTTON_FIRE, BUTTON_RELOAD, BUTTON_ZOOM, BUTTON_THROW, BUTTON_USE, applyPads, mapLadders, mapPads, LUNAR_PAD_BOOST,
  padLandings, sanitizeInput, stepMovement, gravityAt, mapGravityZones, type GravityZone, type JumpPad, type Ladder, type MoveEnv, type MoveState, type PlayerInput } from './movement.ts';
import { PhysicsWorld, type GroundHeight } from './physics.ts';
import { newSuspension, stepSuspension, suspensionOf, suspensionSnapshot, type SuspensionSetup, type SuspensionState } from './suspension.ts';
import { terrainHeightAt } from '../map/terrain.ts';
import { mapGroundBores, nearGroundCut, type GroundCut } from '../map/groundBore.ts';
import { BREATH_SECONDS, JET, LIQUID_SPECS, floatSurface, liquidAt, mapLiquids, stepJetFuel, waterSpan, type LiquidBox } from './liquids.ts';
import { DEFAULT_DEATHMATCH_RULES, dropsInPlay, isTeamMode, matchPhysics, restrictedWeapons, rouletteOn, type MatchRules } from './rules.ts';
import type { CarryOver } from './playlist.ts';
import type { CheckpointPlayer, CheckpointSquad, MatchCheckpoint } from '../net/handoff.ts';
import { tallied, tallyOf, tallyRow } from './squadScores.ts';
import { CLASS_DEFS, ClassPlay, classFromSay, classIndex, classesInPlay, type ClassState } from './classes.ts';
import { ARENA_DISC, DISC_KNOCK_CREDIT_SECONDS, DISC_SPAWN_GUARD_SECONDS, DISC_POWERS, DISC_POWER_SHOTS, discThrows, dodgeDisc, keepOnDeck, splitVelocities, type DiscPower } from './discs.ts';
import { createMode, type ModeLogic } from './modes/index.ts';
import { KothMode, onHill } from './modes/koth.ts';
import { teamHome, type BotTripSpec } from './modes/types.ts';
import { findCorridors, type Trip } from '../nav/corridors.ts';
import { Scenario, teamAllows } from './scenario.ts';
import { liftLinks } from './movers.ts';
import { MatchAwards } from './awards.ts';
import { MATCH_PLAY } from '../content/matchPlay.generated.ts';
import { IMPROMPTU_MIN_PLAYERS, SPAWN_DEATHS_KEPT, SpawnSides, leaderSpotSafe, spawnProtection, WAVE_MIN_PLAYERS, centroid, generateSpawns, pickSpawn, spawnShortfall, spawnsPerTick, type SpawnDeath, type SpawnSpot } from './spawns.ts';
import { applyPortals, portalCarry, portalSegment } from './portals.ts';
import { Encounters } from './encounters.ts';
import { ZombieSurvival } from './zombies.ts';
import { roadHandling } from './road.ts';
import { TrackDriver, type DrivenVehicle } from './trackDriver.ts';
import { vehicleGuides, type Guide } from '../bots/guides.ts';
import { ambientCarEntities, trackGeometry, type TrackGeometry } from '../map/track.ts';
import { chargeIntoMelee } from './creatures.ts';
import { DEFAULT_LOOK, getLook, lookForBot } from '../content/looks.ts';
import { BOT_NAMES, botNameFor } from '../content/botNames.ts';
import { castLooks, validBotCast } from '../content/botThemes.ts';
import { NPC_DAMAGE_TO_PLAYERS, NPC_ID_BASE, NPC_ROLE_PROFILES, NPC_ROLE_SPECS, mapFactions, mapTeams, matchTeams, relation, validLookId } from './npc.ts';
import {
  BULLET_LIFETIME, BULLET_SUBSTEPS, MATERIAL_BALLISTICS, MAX_PENETRATIONS, PENETRATION_MIN_ENERGY, penetrationLoss, MAX_RICOCHETS, NEAR_INSTANT_M,
  RELOAD_KINDS, RICOCHET_MAX_ANGLE, autoReloadDue, beginReload, bulletPhysics, counterRecoil, entityMaterial, falloffAt, flyBullet, gunplayOf, lethalityScale, newGunState, penetrate, recoilIdle, recoilShot, ricochets, roundsReady, shotCone, stepAds, stepReload, surfaceMaterial,
  type BallisticMaterial, type FalloffSpec, type GunState, type Gunplay, type KickSpec, type ReloadRun,
} from './gunplay.ts';
import { GLASS, glassAt } from './glass.ts';
import { OIL_TRACTION, PROJECTILE_VISUALS, SMOKE, THROWABLES, THROWABLE_DEFS, ZONE_KINDS, getWeapon, smokeBlocks, smokeRadius, zoneContains, rayCapsule, rayTarget, PROJECTILE_THICKNESS, weaponByCode, weaponCode, resolveHitscan, throwableWeaponId, type HitZone, UNARMED, unarmedStrike, type AltFire, type ProjectileSpec, type SmokeCloud, type StatusHit, type ThrowableKind, type WeaponDefinition, type ZoneKind, type ZoneSpec } from './weapons.ts';
import { blastKnockback, blastThrow, hitImpact, impactSpeed, newImpact, stepImpact, stoppingPower, type ImpactState } from './impact.ts';

/** At most this many queued inputs are applied per player per tick, which caps speed hacks. */
const MAX_INPUTS_PER_TICK = 2;
/** Fireteams' formations: a spot's walkable ground is looked for this far round it (a step up or down, not a floor away). */
const SPOT_GROUND = { x: 0.8, y: 1.6, z: 0.8 };
/** Fireteams: a bot leader's members this near (m) are told where its enemy is. */
const SQUAD_ALERT = 45;
/**
 * Inputs held for a player at most (older ones are dropped). Links are reliable and ordered, so a lost packet holds
 * everything behind it until it is sent again: about a round trip and a few packet gaps later the inputs arrive at
 * once. At 150-250 ms that burst is 15-25 inputs on top of the one or two waiting, and every input dropped here is a
 * step the player's prediction took and the host didn't (a snap back) or a round they saw leave and the host never
 * fired (docs/GUNPLAY_AUDIT.md, G3; it was 16). The cap only bounds how far behind a player can be; speed hacks are
 * held by MAX_INPUTS_PER_TICK.
 */
export const MAX_QUEUED_INPUTS = 32;
/** The default look's shapes (a new combatant's until its look is set). */
const DEFAULT_HITBOX = lookHitbox(DEFAULT_LOOK);
/** Lag compensation never rewinds further than this (≈ 300 ms). */
export const MAX_REWIND_TICKS = 18;
const HISTORY_TICKS = MAX_REWIND_TICKS + 2;
/** Projectiles ignore their owner briefly so they don't explode in the shooter's face. */
const OWNER_GRACE_TICKS = 8;
/** Damage numbers (privateState `dd`): how long a hit stays in the private state (a few snapshots, for one lost). */
const DEALT_KEEP_TICKS = 8;
/** Arena discs drop where their flight ends: found within this far below (m), else over the void (back to the thrower). */
const DISC_DROP_REACH = 40;
/** A dropped disc lies this long (s) for anyone to pick up, then goes back to its thrower. */
const DISC_LIE_SECONDS = 15;
/** And can't be picked up for this long (s) after it drops (not by the player it just hit). */
const DISC_PICKUP_DELAY = 0.4;

/** The pickup a lying spear or disc counts as (core.spear: core.weapon_spear). */
function lyingItem(p: Projectile): ItemDefinition | undefined {
  return getItem(`core.weapon_${p.weapon.replace(/^core\./, '')}`);
}
/** Start gate: the longest a match waits for its players to load, and the countdown after. */
export const START_WAIT_SECONDS = 30;
export const COUNTDOWN_SECONDS = 3;
/** Vehicle crashes: closing speed (m/s) below which nothing is hurt, and damage per m/s over it (split by weight). */
const RAM_MIN_SPEED = 5;
/** A vehicle nobody drives brakes at this rate (m/s²) when its data has no `vehicle.idleBrake`. */
const DEFAULT_IDLE_BRAKE = 10;
/** A rider steps out of a vehicle on the ground only where there is ground within this far (m) under the spot (leaveMount, exitReachable). */
const EXIT_STEP_DOWN = 2;
/** A turret with a traverse rate fires once its barrel is within this of its gunner's aim (rad: about 3 degrees). */
const TURRET_ON_AIM = 0.05;
/** The share of a vehicle's half width a bot's route must be clear for (MountView.routeHalfWidth) without `vehicle.routeFit`: its probe's (0.95). */
const ROUTE_FIT = 0.95;
const RAM_DAMAGE = 8;
/** Bots see hostile sentries as targets with these IDs (+ mount index); never a real actor ID. */
const SENTRY_VIEW_BASE = 1_000_000;

export interface WeaponState {
  def: WeaponDefinition;
  mag: number;
  reserve: number;
  /** Rounds for a second trigger with its own ammo (the rifle's underbarrel grenades). */
  alt: number;
  /** Heat weapons: 0..1, and whether it overheated (locked until it cools right down). */
  heat?: number;
  overheated?: boolean;
  /** Mounted guns: the tick it last fired (they cool when idle, manned or not). */
  firedTick?: number;
  /** A magazine is in but no round is chambered (an empty reload stopped before the bolt). */
  unchambered?: boolean;
  /** Mounted guns with limited ammunition (SeatDef.ammo): rounds aboard, and ticks toward the next one back. */
  shells?: number;
  shellTicks?: number;
}

/** Driven with the throttle open, moving under WEDGE_STEP m a tick for WEDGE_TICKS (3 s): wedged (MountRt.wedged). */
const WEDGE_STEP = 0.01;
const WEDGE_TICKS = 180;
/** A wedged vehicle counts as got out once it is this far (m) from where it wedged. */
const WEDGE_FREED = 3;
/** A flyer blocked with the throttle open climbs on its own for this many ticks after the last blocked one. */
const CLIMB_ASSIST_TICKS = 30;

/** A turret, sentry or vehicle in play (see mounts.ts). */
interface MountRt {
  /** Index of its map entity (snapshots refer to it). */
  index: number;
  def: MountDef;
  home: { pos: Vec3; yaw: number };
  pos: Vec3;
  yaw: number;
  velY: number;
  /** Signed speed along the heading (vehicles). */
  speed: number;
  push: { x: number; z: number };
  /** Where the gunner (or the sentry) is aiming. */
  aimYaw: number;
  aimPitch: number;
  health: number;
  alive: boolean;
  respawnAt: number;
  respawnTicks: number;
  /** Occupant per seat (actor slot), or null. */
  seats: (number | null)[];
  /** Mounted gun per seat. */
  guns: (WeaponState | null)[];
  /** Some gun aboard has limited ammunition (SeatDef.ammo): resupply() runs. */
  ammoGuns: boolean;
  body: RAPIER.Collider;
  probe: RAPIER.Collider | null;
  /**
   * Ground vehicles whose probe capsule stands taller than the hull (all of them: its radius follows the hull's
   * width): a probe of the same round bottom cut off at the hull's top (PhysicsWorld.createLowVehicleProbe). It
   * carries the vehicle while something is over the hull that the capsule's dome would catch on (`low`: a deck,
   * a beam, a low roof), so a vehicle goes, and gets out, wherever its hull fits (Match.moveVehicleProbe).
   */
  lowProbe: RAPIER.Collider | null;
  low: boolean;
  faction: string | null;
  /** The driver's controls this tick. */
  /** Driver's controls: throttle, steering and the handbrake (jump); in a flyer, jump climbs and crouch dives (`lift`). */
  drive: { forward: number; right: number; brake?: boolean; lift?: number };
  /** Sideways slide (m/s along the vehicle's right), kept between ticks so it drifts. */
  slide: number;
  airborne: boolean;
  /** Placed to ride on water (MountEntity.onWater), and riding on it right now (see FLOAT). */
  floats: boolean;
  afloat: boolean;
  /** Skipped this tick's drive (Match.farVehicle): the next one covers two ticks. */
  moveOwed?: boolean;
  /** Parked and settled since this tick (driveVehicle skips the physics until something moves it). */
  restSince?: number;
  /** Ambient traffic (a track's NPC cars): driven by a TrackDriver with nobody in the seat, so never idle-braked. */
  ambient?: boolean;
  /** Raycast suspension (wheeled light vehicles, sim/suspension.ts): its tuning and the sprung body. */
  suspSetup?: SuspensionSetup;
  susp?: SuspensionState;
  cooldown: number;
  /** Who damaged it last (credit for the explosion). */
  lastHitBy: number | null;
  runOver: Map<number, number>;
  /** On fire (health under MOUNT_BURN_FRACTION, or driven into lava): it loses health on its own until it blows. */
  burning: boolean;
  /** Destroyed vehicles: the charred wreck stays, solid but with no seats, until this tick (0: no wreck). */
  wreckUntil: number;
  /** Velocity (m/s) it was driven at last tick, for crashes; and the tick each other mount (by index) may crash into it again. */
  vel: { x: number; z: number };
  rammed: Map<number, number>;
  /** A sentry a player built (Classes): their slot. It never comes back by itself. */
  builtBy?: number;
  /** An arc sentry's state (mounts.ts ArcSentrySpec): wind-up ticks done, the slot it is on, ticks locked, vent ticks left. */
  arc?: ArcSentryState;
  /**
   * Wedged: driven with the throttle open and going nowhere for WEDGE_TICKS. Bots see it (MountView.wedged) and leave
   * it for something else until it has moved WEDGE_FREED metres from `at` (someone got it out); a respawn clears it.
   */
  stall: number;
  wedged?: { at: Vec3 };
  /** Flyers: ticks left of the climb a flyer driven into something it can't pass makes on its own (driveVehicle). */
  climbAssist: number;
  /** Flyers: the height (m) it was flying at when climbAssist lifted it; past the obstacle it settles back down to it. */
  assistFrom: number | null;
  /** The transport plane: the route it flies and how players board it (see airplane.ts). */
  route?: AirRoute;
  airdrop?: 'off' | 'start' | 'always';
  /** Where along the route riders may jump out (worked out on first use: dropPlanFor). */
  drops?: DropPlan;
  /** The tick its route's clock started (play began). */
  routeT0?: number;
}

/** An arc sentry's runtime state (see Match.runArcSentry). */
export interface ArcSentryState {
  /** Ticks of wind-up done on `target` (the arc locks on once they reach the spec's wind-up). */
  charge: number;
  /** The slot it is winding up on or locked onto, or null. */
  target: number | null;
  /** Ticks the arc has been locked on. */
  lockTicks: number;
  /** Ticks left venting after a full lock (it can't charge or fire). */
  vent: number;
}

/** A spectator by choice (Match.spectate): who they are and the score they had, kept for when they join again. */
export interface Spectator {
  name: string;
  look: string;
  account?: boolean;
  /** Their party (Combatant.party), kept for when they join again. */
  party?: string;
  kills: number;
  deaths: number;
  selfKills: number;
  objective: number;
  /** Tick they started watching. */
  since: number;
}

/** Lunar (MatchRules.lunar): the least knockback any blast has (the disc launcher's), so explosions throw players about. */
const LUNAR_BLAST_KNOCK = 10;

export interface Combatant {
  /** Actor ID: the player slot (0..MAX_PLAYER_SLOTS-1), or NPC_ID_BASE + n for NPCs. */
  slot: number;
  kind: 'human' | 'bot' | 'npc';
  /** Faction; null = free-for-all player (deathmatch). */
  faction: string | null;
  /** Movement speed multiplier (NPC roles are slower). */
  speedMul: number;
  /** Body size scale (BODY_SIZES): height, width and eyes. 1 for standard. */
  size: number;
  /**
   * Measured hit shapes (sim/hitbox.ts) of the look `hitLook` they were taken for, and their scale before `size`
   * (an NPC role's drawn scale, a creature skin's fit). Refreshed whenever the look changes (hitboxOf).
   */
  hitbox: LookHitbox;
  hitLook: string;
  hitScale: number;
  /** Character stats it plays with (sim/characterStats.ts): its look's, its size class's, or standard. */
  stats: CharacterStats;
  /** Random characters (rules.randomCharacters): the look it chose, kept while it plays random ones; and lives begun. */
  ownLook?: string;
  lives?: number;
  /** Lives begun in this match (1 from the first spawn): a weapon set's random spawn gun is rolled for each (sim/weaponSets.ts). */
  spawns?: number;
  /** Health on spawn and the most health pickups can give. */
  maxHealth: number;
  /** Dancing until this tick (emote); and the next tick a quick message or emote may be sent. */
  emoteUntil?: number;
  sayAt?: number;
  pingAt?: number;
  /** Highest point of the current fall, and whether a jump pad threw you (fall damage). */
  fallPeak?: number;
  padFlight?: boolean;
  /** Tick it last took damage (squad spawns avoid teammates in a fight). */
  hurtAt?: number;
  /** Takes no damage (the browser's test mode, offline only); falling out of the map still kills. */
  invulnerable?: boolean;
  /** Kills since this one last died (kill-streak rewards). */
  streak?: number;
  /** A teammate's order to a bot: follow them, or hold a spot, until `until`. */
  order?: { kind: 'follow' | 'hold'; leader: number; pos: Vec3; until: number };
  /** Their last ping (Fireteams: Go there and Attack that read it): where, the enemy it marked, when. */
  lastPing?: { pos: Vec3; target: number | null; tick: number };
  /** The next tick a Fireteams order may be given. */
  orderAt?: number;
  /**
   * A Player Bot from the host's bot set (sim/botSet.ts): which entry it plays (by index), its own skill and
   * style (absent: the match's), and its squad label (bots of one squad on one side stick together).
   */
  botSet?: { index: number; skill?: BotDifficulty['id']; style?: BotStyle; squad?: string };
  /** NPC details. */
  /** `damage`: the encounter's damage multiplier (MapMaker). */
  npc?: { encounter: string; role: NpcRole; removeAt: number; damage: number };
  /** Character look (players and bots). */
  look: string;
  /**
   * A player who is away (AWAY): a bot plays their body until they come back.
   * `name` is theirs; `key` (account or browser key) lets their next
   * connection reclaim the place; `until` (tick) is when a dropped player's
   * hold runs out (null: idle but still connected).
   */
  away?: { name: string; key: string | null; why: 'afk' | 'dropped'; until: number | null; since?: number };
  /** A signed-in player playing under their username, checked by the host (account ticket): shown as a verified account. */
  account?: boolean;
  /**
   * The party this person came with (net/party.ts: the tag in the invite link they joined by, or their own): team
   * modes put a joining member on the team most of their party is on (takeOverBot). People only; the roster says it (`py`).
   */
  party?: string;
  name: string;
  collider: RAPIER.Collider;
  move: MoveState;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  alive: boolean;
  respawnTick: number;
  kills: number;
  deaths: number;
  /** Suicides: each costs the player a point (in `kills`) but not their team. */
  selfKills: number;
  /** Objective plays this round (flag captures, bomb plants and defuses, hostage rescues), for the scoreboard. */
  objective: number;
  /** Owned weapons by weapon code. */
  weapons: Map<number, WeaponState>;
  /** Code of the held weapon. */
  current: number;
  /** Carried grenades or mines (G), or none. */
  throwable: { kind: ThrowableKind; count: number } | null;
  // Timers below count applied inputs (not server ticks) so client prediction can mirror them exactly.
  fireCooldown: number;
  throwCooldown: number;
  /** Unarmed quick melee: ticks until the next strike, and the tick of the last punch (punch, then kick). */
  meleeCooldown: number;
  /** Humans: damage dealt lately, for their damage numbers (PrivateState `dd`; [tick, amount, flags, x, y, z, key]). */
  dealt?: [number, number, number, number, number, number, number][];
  punchedAt: number;
  reloadTicks: number;
  raiseTicks: number;
  speedTicks: number;
  damageTicks: number;
  /** Trigger state: buttons last input, spin-up/charge, semi-auto latch, burst in progress, spread bloom. */
  prevButtons: number;
  /** Tick this player last pressed Use (E): objective modes read it (Bomb: plant / defuse). */
  useTick?: number;
  windup: number;
  /** A person on foot in the third-person view (their input's BUTTON_THIRD_PERSON): rounds go toward the crosshair. */
  thirdPerson?: boolean;
  semiLatch: boolean;
  burstLeft: number;
  burstTimer: number;
  bloom: number;
  /** Mechanical recoil offset, spray and sights (gunplay.ts), counted in applied inputs like the timers. */
  gun: GunState;
  /** The reload in progress (stages, shells); `reloadTicks` is what is left of it. */
  reload: ReloadRun | null;
  /** Horizontal speed over the last tick (m/s), for movement spread. */
  moveSpeed: number;
  /** Riding in a standing place (a flatbed, a roof gun), ducked down: the crouch button, read each tick (seatMove). */
  rideCrouch?: boolean;
  /** Skipped this tick's move (Match.relaxedMove): the next one covers two ticks. */
  moveOwed?: boolean;
  /** Status effects (ticks left; chill builds 0..1 into a freeze), and who caused them (kill credit). */
  burnTicks: number;
  /** Jetpack fuel units (see JET), or null without a jetpack. */
  jetFuel: number | null;
  /** Ticks spent with your head under water (drowning starts after BREATH_SECONDS). */
  breath: number;
  poisonTicks: number;
  slowTicks: number;
  /** Stopping power: the stagger (shove, slow) from hits, its caps and immunity (sim/impact.ts). */
  impact: ImpactState;
  chill: number;
  frozenTicks: number;
  statusBy: number | null;
  statusWeapon: string;
  queue: PlayerInput[];
  lastSeq: number;
  bot?: BotBrain;
  /** Seat in a turret or vehicle: mount index (into Match.mounts) and seat. */
  mount?: { index: number; seat: number };
  /** Carrying a glider (an item): canopies open as gliders. Lost on death. */
  glider?: boolean;
  /** Movement multiplier set by an objective mode (flag carriers are slower); absent = 1. */
  modeSpeed?: number;
  /** Bots: the last shot that hit or passed close (for taking cover). */
  shotAt?: { tick: number; from: Vec3 };
  /** Classes: the player's class and its ability state, and the class's movement multiplier. */
  cls?: ClassState;
  classSpeed?: number;
  /** Disc Arena: a power disc's throws left, and who last knocked this player about (credit for a fall). */
  discPower?: { kind: DiscPower; shots: number };
  knockedBy?: { slot: number; tick: number; weapon: string };
  /** Tick it last spawned (or the round began): Disc Arena's spawn guard. */
  spawnedAt?: number;
  /** Spawn protection runs until this tick (0: none, or dropped by firing): Match.shielded. */
  shieldUntil?: number;
  /** MapMaker's Play from here: where this player's lives start (feet, facing) until play begins (Match.startHere). */
  startAt?: { pos: Vec3; yaw: number; pitch: number };
}

interface Projectile {
  id: number;
  owner: number;
  spec: ProjectileSpec;
  /** Weapon (or thrown equipment) credited for kills. */
  weapon: string;
  pos: Vec3;
  vel: Vec3;
  ticksLeft: number;
  age: number;
  /** Mines: stuck in place, and the tick they arm. */
  stuck?: boolean;
  armAt?: number;
  bounces?: number;
  /** Sticky projectiles riding on a player: whose, and where on them. */
  stuckTo?: number;
  stuckOffset?: Vec3;
  /** Arena discs: an extra disc (triple throws, splits) that doesn't come back to its thrower. */
  extra?: boolean;
  /** Walkers (the sheep): on the ground, which way they're heading, and ticks until they may hop again. */
  walking?: boolean;
  heading?: Vec3;
  hopIn?: number;
  /** Fired by a rider: the vehicle (index into the match's mounts) it passes through rather than hitting. */
  fromMount?: number;
}

/**
 * A conventional bullet in flight (GUNPLAY_SPEC §3.2). Server-only and light:
 * clients draw their own tracers from the shot event, so bullets never go out
 * in snapshots.
 */
interface Bullet {
  owner: number;
  trig: Trigger;
  /** Muzzle point (for falloff and the impact event). */
  origin: Vec3;
  pos: Vec3;
  vel: Vec3;
  gravity: number;
  drag: number;
  travelled: number;
  age: number;
  energy: number;
  /** Damage left after penetrations and ricochets (1 = full). */
  scale: number;
  pens: number;
  rics: number;
  /** Surfaces it passed through or glanced off (drawn as impacts). */
  marks: Tuple3[];
  /** Tick it was fired (it already flew that tick). */
  born: number;
}

/** Where a bullet ended up: a player (with damage to apply), a surface, or nowhere. */
interface BulletEnd {
  at: Vec3;
  victim: Combatant | null;
  zone: HitZone;
  damage: number;
  dir: Vec3;
  /** Ran out of range or time in the air (nothing to draw where it ends). */
  gone?: boolean;
}

/** Bodies a shot can hit; `who` is the actor (lists kept for a whole bullet pass skip anyone killed during it). */
type ShotTargets = readonly ShotBody[];
/** A body as a shot sees it: where it stands and, for the measured shapes, its yaw, stance, scale and shapes. */
type ShotBody = { slot: number; feet: Vec3; height: number; radius: number; box: LookHitbox; yaw: number; stance: Stance; scale: number; who?: Combatant };
/** One body in the lag-compensation history. */
type PastBody = Vec3 & { h: number; yaw: number; stance: Stance; scale: number; box: LookHitbox };

/** A ground hazard or field (see ZONE_KINDS). */
interface Zone {
  kind: ZoneKind;
  pos: Vec3;
  radius: number;
  /** When it came (smoke billows out from then: smokeRadius). */
  start: number;
  endTick: number;
  owner: number;
  weapon: string;
}

const MAX_ZONES = 48;
/** Fort Wars rebuilds the navmesh mid-match only on maps up to this many square metres (about 150 × 150 m). */
const NAV_REBUILD_MAX_AREA = 22_500;
/** Deployed sandbag walls standing at once; the oldest goes when another lands. */
const MAX_COVERS = 16;

interface Cover {
  id: number;
  /** Ground point under its centre. */
  pos: Vec3;
  yaw: number;
  half: Vec3;
  health: number;
  max: number;
  body: RAPIER.Collider;
}
/** Per-tick damage of hazards and status effects. */
const BURN_DPS = 12;
const POISON_DPS = 9;
const FIRE_ZONE_DPS = 14;
const FROZEN_TICKS = Math.round(TICK_RATE * 1.4);

interface PickupState {
  id: string;
  /** What lies there now (a random pickup's latest roll). */
  item: ItemDefinition;
  /** The item as placed in the map. */
  placed: ItemDefinition;
  /** Random from category (or mixed up by the host): what it rolls from; null keeps the placed item. */
  pool: readonly ItemDefinition[] | null;
  /** Rolls so far (the next roll's number, sim/pickupRoll.ts). */
  rolls: number;
  /** The map entity's own random settings. */
  entity: Pick<PickupEntity, 'item' | 'random' | 'keepFixed'>;
  pos: Vec3;
  respawnTicks: number;
  availableAt: number;
  /** Scenario logic can switch pickups off. */
  enabled: boolean;
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** An arc sentry's snapshot bits: winding up on a target, or its arc locked on. */
function arcFlags(m: MountRt): number {
  const st = m.arc!;
  const arc = m.def.sentry?.arc;
  if (!arc || st.target === null || st.vent > 0) return 0;
  return st.charge < Math.round(arc.windUpSeconds * TICK_RATE) ? MOUNT_FLAG_CHARGING : MOUNT_FLAG_ARC;
}
/** Look-to-steer: steering (-1..1) per radian the driver looks off the nose. */
const LOOK_STEER_GAIN = 2.2;
/** The vehicle probe's feet ride this far over the ground (the character controller's skin): the wheels' rest. */
const VEHICLE_SKIN = 0.02;
/** Suspension rays a tick before vehicles start reusing last tick's ground (24 four-wheelers). */
const SUSPENSION_RAY_BUDGET = 96;
const tuple = (v: Vec3): Tuple3 => [r3(v.x), r3(v.y), r3(v.z)];
/** Chest height above the feet (m). */
const CHEST = PLAYER.height * 0.55;
const chest = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + CHEST, z: p.z });

export const heldWeapon = (c: Combatant): WeaponState => c.weapons.get(c.current)!;

/**
 * Authoritative Deathmatch simulation. Contains no networking or Node/DOM
 * APIs, so the dedicated server, tests, load harness and the in-browser
 * MapMaker TEST all drive the same code by calling step().
 */
export class Match {
  readonly geometry: WorldBox[];
  /** The map's environment colliders (map/environment.ts): physics and navigation. */
  readonly envShapes: EnvWorldShape[];
  /** Falling below this height kills (some way under the lowest floor). */
  readonly killY: number;
  /** Gravity multiple and fall damage in force (match rules over the map's own). */
  readonly phys: { gravity: number; fallDamage: boolean };
  readonly physics: PhysicsWorld;
  /** Bots' shared, briefly cached sight lines between actors (see SightCache). */
  readonly sight: SightCache;
  /** Rebuilt mid-match only by Fort Wars (when the forts are done). */
  nav: NavWorld;
  readonly slots: (Combatant | null)[] = new Array(MAX_PLAYER_SLOTS).fill(null);
  /** The map's spawn points, then any made up for this match (see ensureSpawnCapacity). */
  readonly spawnPoints: SpawnSpot[];
  readonly pickups: PickupState[];
  /** Weapons dropped by the fallen (rules.dropWeapons, sim/drops.ts), oldest first. */
  readonly drops: WeaponDrop[] = [];
  private nextDropId = 1;
  /** Doors, buttons, destructibles, zones, traps and the map's logic rules. */
  readonly scenario: Scenario;
  /** NPC squads spawned by encounter entities. */
  readonly encounters: Encounters;
  /** The wave director in Zombies (null in every other mode). */
  readonly zombies: ZombieSurvival | null;
  /** Living and recently dead NPCs by actor ID. */
  readonly npcs = new Map<number, Combatant>();
  private nextNpcId = NPC_ID_BASE;

  tick = 0;
  phase: MatchPhase = 'playing';
  /** Tick when the current phase ends (round time limit or intermission). */
  private phaseEndTick: number;
  private pendingEvents: GameEvent[] = [];
  private readonly rng: () => number;
  private projectiles: Projectile[] = [];
  private bullets: Bullet[] = [];
  private zones: Zone[] = [];
  private readonly pads: JumpPad[];
  /** Foliage to hide in (bushes, ferns, tall crops): footprint centre, radius, base and top. */
  private readonly hides: { x: number; z: number; r: number; y0: number; y1: number }[] = [];
  /** The tick each actor last fired (giving away where they hide). */
  private readonly lastShot = new Map<number, number>();
  private readonly ladders: Ladder[];
  /** The map's ziplines (zipline.ts): riders' MoveState.zip indexes this. */
  readonly ziplines: Zipline[];
  /** Each zipline's ride as bots see it (its navmesh link's ends) and the team it is for. */
  private readonly zipRides: { start: Vec3; end: Vec3; team?: string }[];
  private readonly liquids: LiquidBox[];
  /** Low-gravity (or heavy) zones: movement falls by their factor inside. */
  private readonly gravityZones: GravityZone[];
  private readonly mounts: MountRt[] = [];
  /** Collider handle -> mount, so shots and blasts can hurt vehicles. */
  private readonly mountBodies = new Map<number, MountRt>();
  /** Air drop: who has had this round's start in the plane, and where each bot aboard means to jump (target, last distance). */
  private readonly airdropped = new Set<number>();
  private readonly planeDrops = new Map<number, { target: Vec3; prev?: number; at?: number }>();
  /** The tick each rider was last told they can't jump out here (the hint isn't repeated every tick the key is held). */
  private readonly dropHints = new Map<number, number>();
  private nextProjectileId = 1;
  private covers: Cover[] = [];
  /** UAV sweeps running: side (team, or one player in free-for-all) -> tick it ends. */
  private readonly uavUntil = new Map<string, number>();
  /** Counter-UAVs running: the jamming side -> tick it ends (everyone else's minimap is jammed). */
  private readonly jamUntil = new Map<string, number>();
  private nextCoverId = 1;
  /** Positions of everyone at recent ticks, for lag-compensated hitscan. */
  /**
   * Where everyone was over the last HISTORY_TICKS ticks (lag compensation), as a ring: each tick reuses the
   * oldest entry's map and position objects instead of making new ones (they lived just long enough to be
   * promoted out of the young generation, then died: work for the full collections behind the hiccups).
   */
  private readonly history: { tick: number; at: Map<number, PastBody>; pool: Map<number, PastBody> }[] = [];
  /** Bot AI time spent in the most recent tick, for instrumentation. */
  lastAiMs = 0;

  /**
   * The in-game bot debug view's frame (`?botdebug=1`, host or offline: bots/debugView.ts), built only when the page
   * asks (a few times a second while the view is on). Player Bots only.
   */
  botDebugFrame(): BotDebugFrame {
    this.botDebug ??= new BotDebugCollector();
    const d = this.director;
    const slots = this.slots;
    const tick = this.tick;
    return this.botDebug.frame({
      tick,
      *bots() {
        for (const c of slots) {
          if (!c?.bot || c.kind !== 'bot') continue;
          yield { slot: c.slot, faction: c.faction, pos: c.move.pos, alive: c.alive, brain: c.bot, role: d?.roleOf(c.slot) ?? null, callouts: d && c.faction ? d.calloutsFor(c.faction).recent(tick, TICK_RATE * 3) : [] };
        }
      },
    });
  }
  private botDebug: BotDebugCollector | null = null;
  /**
   * Slots that count as people watching for movement detail (load tests stand
   * bots in for players with it; see relaxedMove).
   */
  readonly watchers = new Set<number>();
  /** The movement environment handed to stepMovement, refilled per actor (applyInputs). */
  private readonly moveEnv: MoveEnv = { liquids: undefined, jet: false, ladders: undefined, scale: 1, gravity: 1, gravityZones: undefined, airJumps: undefined, jetpack: undefined, glider: undefined, autoChute: undefined, ground: undefined, jump: 1, stamina: 1 };
  /** Where the people (and watchers) are this tick, in big matches only (relaxedMove). */
  private watched: Vec3[] | null = null;
  /** The cuts buried tunnels make in the ground (groundBore.ts): bots in or over one never move coarsely (relaxedMove). */
  private get groundBores(): readonly GroundCut[] {
    return this.map.terrain ? mapGroundBores(this.map).cuts : NO_BORES;
  }
  /** The terrain's height, for coarse moves (relaxedMove), on maps with terrain. */
  private groundFn: GroundHeight | null | undefined;
  private get groundAt(): GroundHeight | null {
    if (this.groundFn === undefined) {
      const t = this.map.terrain;
      this.groundFn = t ? (x, z) => terrainHeightAt(t, x, z) : null;
    }
    return this.groundFn;
  }
  /** Objective rules (Capture the Flag, King of the Hill, Elimination); null in other modes. */
  readonly mode: ModeLogic | null;
  /** The map's track (its path used as a track, `race`), if it has one: vehicles grip better on the road, and ambient NPC cars lap it. */
  private readonly road: TrackGeometry | null;
  /** Routes and roads bots driving vehicles follow (bots/guides.ts). */
  private readonly guides: readonly Guide[];
  /** Ambient cars: NPC-driven vehicles lapping the track in any mode (mount index, driver, ticks stuck). */
  private readonly ambient: { mount: number; driver: TrackDriver; stuck: number }[] = [];
  /** Recent gunfire and explosions, for bots' hearing. */
  private noises: NoiseView[] = [];
  /** Classes (rules.classes): loadouts, abilities and class bots; null without classes. */
  readonly classes: ClassPlay | null;

  /** Requires initPhysics() and initNavigation() to have resolved. */
  constructor(
    readonly map: MapDocument,
    readonly rules: MatchRules = DEFAULT_DEATHMATCH_RULES,
    readonly seed = 1,
    /**
     * `startGate`: hold the start until every person has loaded (`ready`:
     * players and spectators alike, so a match only spectators watch starts
     * once they have), at most START_WAIT_SECONDS, then count down; every
     * later round counts down too. Off (play at once) for headless matches
     * and tests.
     */
    private readonly opts: { startGate?: boolean } = {},
  ) {
    this.geometry = buildMapGeometry(map);
    this.killY = mapKillY(this.geometry, map);
    this.phys = matchPhysics(rules, map);
    this.envShapes = environmentShapes(map);
    this.physics = new PhysicsWorld(this.geometry, mapTerrainMesh(map), this.envShapes);
    this.sight = new SightCache(this.physics);
    // Bots plan around breakable props too (they are scenario colliders, not static geometry).
    this.nav = buildMapNav(map, this.geometry, this.physics, this.envShapes, this.phys);
    this.rng = createRng(seed);
    this.spawnPoints = map.entities
      .filter((e) => e.kind === 'spawn')
      .map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, yaw: e.yaw, team: e.faction }));
    this.pickups = [];
    for (const e of map.entities) {
      if (e.kind !== 'pickup') continue;
      const item = getItem(e.item);
      if (!item) continue;
      const p: PickupState = { id: e.id, item, placed: item, pool: null, rolls: 0, entity: { item: e.item, random: e.random, keepFixed: e.keepFixed }, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, respawnTicks: Math.round((e.respawnSeconds ?? item.respawnSeconds) * TICK_RATE), availableAt: 0, enabled: true };
      this.pickups.push(p);
      this.repool(p);
    }
    for (const e of map.entities) {
      if (e.kind !== 'prop') continue;
      // Environment species carry their own concealment cylinder (content/environment.ts); props read their size.
      const env = getEnvSpecies(e.model);
      if (env) {
        if (env.conceals) this.hides.push({ x: e.position[0], z: e.position[2], r: env.conceals.radius * e.scale, y0: e.position[1] - 0.3, y1: e.position[1] + env.conceals.height * e.scale });
        continue;
      }
      const def = getProp(e.model);
      if (!def?.conceals) continue;
      this.hides.push({ x: e.position[0], z: e.position[2], r: (Math.min(def.size[0], def.size[2]) * e.scale) / 2, y0: e.position[1] - 0.3, y1: e.position[1] + def.size[1] * e.scale });
    }
    map.entities.forEach((e, index) => {
      if (e.kind !== 'mount') return;
      const def = getMountDef(e.model);
      if (def) this.addMount(index, def, { x: e.position[0], y: e.position[1], z: e.position[2] }, e.yaw, e.faction, e.respawnSeconds, !!e.onWater && !!def.vehicle);
    });
    this.road = trackGeometry(map);
    this.guides = vehicleGuides(map.paths);
    // Ambient cars (any mode): out on the track at first; wrecked ones come back in the pit lane.
    if (this.road) {
      const base = map.entities.length;
      for (const [i, car] of ambientCarEntities(map).entries()) {
        const def = getMountDef(car.entity.model);
        if (!def) continue;
        const index = this.mounts.length;
        this.addMount(base + i, def, { x: car.entity.position[0], y: car.entity.position[1], z: car.entity.position[2] }, car.entity.yaw, null, 12);
        this.mounts[index]!.home = { pos: { x: car.pit[0], y: car.pit[1], z: car.pit[2] }, yaw: car.pitYaw };
        this.mounts[index]!.ambient = true;
        this.ambient.push({ mount: index, driver: new TrackDriver(((i % 3) - 1) * 0.4, 0.86 + (i % 4) * 0.04), stuck: 0 });
      }
    }
    // Transport planes: mounts that fly their route, can't be hurt and don't block anything.
    map.entities.forEach((e, index) => {
      if (e.kind !== 'airplane') return;
      const route = airRoute(e);
      const pose = routePose(route, 0);
      this.addMount(index, airCraftDef(e.craft), { x: pose.pos.x, y: pose.pos.y, z: pose.pos.z }, pose.yaw, null, null);
      const m = this.mounts[this.mounts.length - 1]!;
      m.route = route;
      m.airdrop = e.airdrop;
      this.physics.setBoxEnabled(m.body, false);
    });
    // Lunar: stronger jump pads (client prediction scales them the same).
    this.pads = mapPads(map.entities, rules.lunar ? LUNAR_PAD_BOOST : 1);
    this.ladders = mapLadders(map.entities);
    this.ziplines = mapZiplines(map.entities);
    this.zipRides = this.ziplines.flatMap((z) => ziplineLinks([z], this.physics).map((l) => ({ ...l, ...(z.team ? { team: z.team } : {}) })));
    this.liquids = mapLiquids(map.entities);
    this.gravityZones = mapGravityZones(map.entities);
    this.phaseEndTick = this.roundEndTick();
    if (opts.startGate) {
      this.phase = 'waiting';
      this.phaseEndTick = START_WAIT_SECONDS * TICK_RATE;
    }
    const match = this;
    this.scenario = new Scenario(map, this.physics, {
      get tick() {
        return match.tick;
      },
      players: () => this.combatants().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos, team: c.faction })),
      actors: () => this.actors().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos, team: c.faction })),
      teamOf: (slot) => this.actor(slot)?.faction ?? null,
      hurt: (slot, amount, weapon) => {
        const c = this.actor(slot);
        if (c) this.damage(c, amount, null, weapon);
      },
      push: (slot, dir, speed) => {
        const c = this.actor(slot);
        if (c?.alive) this.push(c, dir, speed);
      },
      blast: (at, radius, damage, edge, owner, weapon) => {
        this.pendingEvents.push({ e: 'explode', s: owner ?? -1, p: tuple(at), r: radius, ...(weapon ? { w: weapon } : {}) });
        this.splash(at, radius, damage, edge, owner === null ? null : (this.actor(owner) ?? null), weapon, 1, blastKnockback({ splashDamage: damage }));
      },
      endRound: (winner, outcome, next) => this.endRound(winner, outcome, next),
      encounter: (id, op, order) => {
        if (op === 'start') this.encounters.start(id);
        else if (op === 'stop') this.encounters.stop(id);
        else if (order) this.encounters.setOrder(id, order);
      },
      encounterAlive: (id) => this.encounters.alive(id),
      budgetWarning: (text) => this.budgetWarning(`logic:${text}`, text),
      setPickupEnabled: (id, enabled) => {
        const p = this.pickups.find((q) => q.id === id);
        if (p) p.enabled = enabled;
      },
      emit: (ev) => this.pendingEvents.push(ev),
    });
    // Doors and walls that block paths, and lift rides, as navmesh flags: a bot's route can keep out of the ones shut
    // to it, and off a lift it's tired of waiting for.
    this.nav.markOpenings([...this.scenario.openings(), ...this.scenario.surfaces()], this.scenario.openings().length);
    this.nav.markLifts(liftLinks(map));
    this.encounters = new Encounters(map, {
      get tick() {
        return match.tick;
      },
      get nav() {
        return match.nav;
      },
      players: () => this.combatants().filter((c) => c.alive).map((c) => ({ slot: c.slot, pos: c.move.pos })),
      hostiles: (faction) => this.actors().filter((c) => c.alive && relation(this.factions, faction, c.faction) === 'enemy').map((c) => ({ id: c.slot, pos: c.move.pos })),
      spawnNpc: (e, role, pos, yaw) => this.spawnNpc(e, role, pos, yaw),
      npc: (id) => {
        const c = this.npcs.get(id);
        return c && { alive: c.alive, pos: c.move.pos, brain: c.bot! };
      },
      inShutDoor: (pos) => this.scenario.inShutDoor(pos, PLAYER.radius),
      entityPos: (id) => {
        const e = map.entities.find((x) => x.id === id);
        return e && { x: e.position[0], y: e.position[1], z: e.position[2] };
      },
      fire: (event, target, instigator) => this.scenario.fire(event, target, instigator),
      random: () => this.rng(),
    });
    this.mode = this.teams
      ? createMode(rules.mode, {
          get tick() {
            return match.tick;
          },
          teams: this.teams,
          rules,
          map,
          killY: this.killY,
          combatants: () => this.combatants(),
          emit: (ev) => this.pendingEvents.push(ev),
          endRound: (winner) => (winner === undefined ? this.endRound() : this.endRound(undefined, undefined, undefined, winner)),
          hurt: (c, amount, cause) => this.damage(c, amount, null, cause),
          respawn: (c) => {
            this.leaveMount(c, false);
            this.spawn(c);
          },
          groundBelow: (p) => {
            const hit = this.physics.raycastHit(p, { x: 0, y: -1, z: 0 }, 8);
            return hit ? p.y - hit.dist : null;
          },
          deadly: (p) => {
            const l = this.liquids.length ? liquidAt(this.liquids, { x: p.x, y: p.y + 0.3, z: p.z }) : null;
            return !!l && LIQUID_SPECS[l.liquid].dps >= 30;
          },
          path: (a, b) => this.nav.findPath(a, b),
          explode: (at, radius, damage, by) => {
            this.pendingEvents.push({ e: 'explode', s: by?.slot ?? -1, p: tuple(at), r: radius, w: 'core.bomb' });
            this.splash(at, radius, damage, damage * 0.15, by, 'core.bomb', 1, 12);
          },
          physics: this.physics,
          spawnPoints: this.spawnPoints,
          rebuildNav: (extra) => this.rebuildNav(extra),
        })
      : null;
    this.zombies = rules.mode === 'core.zombies' ? this.zombieDirector() : null;
    this.classes = classesInPlay(rules) ? this.classDirector() : null;
    this.roulette = rouletteOn(rules) ? this.rouletteDirector() : null;
  }

  /**
   * Roulette (sim/roulette.ts): decks, rolls, picks, tokens, the awards and Lunar's gravity storm, when the match
   * plays it (the Roulette mode, or `rules.roulette` in another).
   */
  readonly roulette: RouletteDirector | null;

  /** End-of-match awards and the revenge and nemesis callouts (sim/awards.ts), every mode. */
  readonly awards = new MatchAwards();

  private rouletteDirector(): RouletteDirector {
    const match = this;
    const base = this.phys.gravity;
    return new RouletteDirector({
      seed: this.seed,
      get rules() {
        return match.rules;
      },
      tick: () => match.tick,
      emit: (ev) => match.pendingEvents.push(ev),
      weaponSet: () => match.weaponSet,
      baseGravity: base,
    });
  }

  /** Roulette, Swap on kill: `c` becomes `look` at once, keeping its share of health and its weapons. */
  private swapLook(c: Combatant, look: string): void {
    const share = c.maxHealth > 0 ? c.health / c.maxHealth : 1;
    c.look = look;
    this.applyBodySize(c);
    c.health = Math.max(1, Math.round(share * c.maxHealth));
    if (c.bot) c.bot.playAs(this.bodyProfile(c));
    this.pendingEvents.push({ e: 'rl', a: 'swap', s: c.slot, l: look });
  }

  /**
   * Bots play to their body (docs/BOT_AI_PLAN.md Phase B; Roulette deals a new one every life): the look's own
   * personality, then a small body flanks (a lone wolf that roams wide), a large one pushes (more aggressive, closes in,
   * keeps after its target).
   */
  private bodyProfile(c: Combatant): BotProfile {
    const base = c.bot!.baseProfile;
    const own = profileFor(c.look, base, c.botSet?.style ?? this.rules.botStyle);
    if (c.size < 0.9) return { ...own, aggression: Math.max(0, own.aggression - 10), exploration: Math.min(100, own.exploration + 20), rangePreference: Math.min(100, own.rangePreference + 5), tags: [...new Set([...own.tags.filter((t) => t !== 'GRUNT' && t !== 'BERSERKER'), 'LONE_WOLF'])] };
    if (c.size > 1.1) return { ...own, aggression: Math.min(100, own.aggression + 20), pursuitPersistence: Math.min(100, own.pursuitPersistence + 20), riskTolerance: Math.min(100, own.riskTolerance + 15), rangePreference: Math.max(0, own.rangePreference - 20), tags: own.tags.filter((t) => t !== 'LONE_WOLF' && t !== 'COWARD' && t !== 'CAMPER') };
    return own;
  }

  /** A vehicle as a track driver sees it. */
  private trackVehicle(m: MountRt): DrivenVehicle {
    return { pos: m.pos, yaw: m.yaw, speed: m.speed, maxSpeed: m.def.vehicle?.maxSpeed ?? 0 };
  }

  /** Other vehicles out and about near `m` (for a track driver's overtaking). */
  private vehiclesNear(m: MountRt): DrivenVehicle[] {
    const out: DrivenVehicle[] = [];
    for (const o of this.mounts) if (o !== m && o.alive && o.def.vehicle && Math.abs(o.pos.x - m.pos.x) < 40 && Math.abs(o.pos.z - m.pos.z) < 40) out.push(this.trackVehicle(o));
    return out;
  }

  /**
   * Ambient cars: each one nobody has taken the wheel of drives the track
   * (TrackDriver). One stuck for a while (or lost far off the road) is
   * taken back to the pit lane; wrecked ones come back there on their own.
   */
  private driveAmbient(track: TrackGeometry): void {
    for (const a of this.ambient) {
      const m = this.mounts[a.mount]!;
      if (!m.alive) continue;
      const driverSeat = m.def.seats.findIndex((s) => s.role === 'driver');
      if (driverSeat >= 0 && m.seats[driverSeat] !== null) continue;
      const d = a.driver.drive(track, this.trackVehicle(m), this.tick, this.vehiclesNear(m));
      m.drive = { forward: d.forward, right: d.right, brake: d.brake };
      const near = track.nearest(m.pos.x, m.pos.z, 100);
      a.stuck = Math.abs(m.speed) < 1 || !near || near.dist > track.width / 2 + 40 ? a.stuck + 1 : 0;
      if (a.stuck > TICK_RATE * 8) {
        a.stuck = 0;
        for (const slot of m.seats) if (slot !== null) this.leaveMount(this.actor(slot)!, true);
        this.respawnMount(m);
      }
    }
  }

  /** Classes: what the class rules may see and do in the match. */
  private classDirector(): ClassPlay {
    const match = this;
    return new ClassPlay({
      get tick() {
        return match.tick;
      },
      rules: this.rules,
      get teams() {
        return match.teams;
      },
      combatants: () => this.combatants(),
      hostile: (a, b) => this.hostile(a, b),
      emit: (ev) => this.pendingEvents.push(ev),
      groundBelow: (p) => {
        const hit = this.physics.raycastHit(p, { x: 0, y: -1, z: 0 }, 4);
        return hit ? p.y - hit.dist : null;
      },
      lineOfSight: (a, b) => this.physics.lineOfSight(a, b),
      buildSentry: (c, at, yaw) => this.buildSentry(c, at, yaw),
      sentryOf: (slot) => {
        const m = this.mounts.find((x) => x.builtBy === slot && x.alive);
        return m ? m.pos : null;
      },
      removeSentry: (slot) => {
        const m = this.mounts.find((x) => x.builtBy === slot);
        if (m?.alive) {
          m.alive = false;
          m.health = 0;
          m.respawnAt = Infinity;
          this.physics.setBoxEnabled(m.body, false);
          this.physics.commit();
        }
      },
    });
  }

  /**
   * Classes: a Mechanic's sentry, on the floor at `at` facing `yaw`, on their
   * side (credit for its kills is theirs). Each builder has one: building
   * again moves it. False when someone or something is in the way.
   */
  private buildSentry(c: Combatant, at: Vec3, yaw: number): boolean {
    const def = MOUNT_DEFS.sentry;
    const half = { x: def.half[0], y: def.half[1], z: def.half[2] };
    if (!this.physics.headroom({ x: at.x, y: at.y + 0.05, z: at.z }, half.y * 2, Math.max(half.x, half.z))) return false;
    if (this.actors().some((o) => o.alive && horizontalDistance(o.move.pos, at) < half.x + PLAYER.radius && Math.abs(o.move.pos.y - at.y) < 1.5)) return false;
    let m = this.mounts.find((x) => x.builtBy === c.slot);
    if (!m) {
      this.addMount(BUILT_MOUNT_BASE + c.slot, def, at, yaw, c.faction, Infinity);
      m = this.mounts[this.mounts.length - 1]!;
      m.builtBy = c.slot;
    }
    m.faction = c.faction;
    m.home = { pos: { ...at }, yaw };
    this.respawnMount(m);
    this.physics.commit();
    return true;
  }

  /**
   * A fresh navmesh with extra obstacles (Fort Wars forts); bots replan on it.
   * Recast rebuilds the whole mesh, which on big terrain maps takes seconds,
   * so those keep the mesh they have (false).
   */
  private rebuildNav(extra: readonly WorldBox[]): boolean {
    const t = this.map.terrain;
    const xs = this.geometry.filter((b) => b.sourceId !== 'ground').flatMap((b) => [b.min[0], b.max[0]]);
    const zs = this.geometry.filter((b) => b.sourceId !== 'ground').flatMap((b) => [b.min[2], b.max[2]]);
    if (t) {
      xs.push(t.origin[0], t.origin[0] + (t.cols - 1) * t.spacing);
      zs.push(t.origin[1], t.origin[1] + (t.rows - 1) * t.spacing);
    }
    const area = xs.length ? (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)) : 0;
    if (area > NAV_REBUILD_MAX_AREA) return false;
    const old = this.nav;
    this.nav = buildMapNav(this.map, this.geometry, this.physics, this.envShapes, this.phys, extra, false);
    old.destroy();
    this.nav.markOpenings([...this.scenario.openings(), ...this.scenario.surfaces()], this.scenario.openings().length);
    this.nav.markLifts(liftLinks(this.map));
    this.nav.places();
    this.sight.clear();
    // (The trips' corridors again, on the new navmesh, the next time they are asked for.)
    this.trips = null;
    return true;
  }

  /** Zombies: the horde spawner the director raises zombies through, and its link to the match. */
  private zombieDirector(): ZombieSurvival {
    const horde = EncounterSchema.parse({ id: 'zombie_horde', kind: 'encounter', position: [0, 0, 0], yaw: 0, faction: mapFactions(this.map)[0]?.id ?? 'syndicate' });
    let spots: Vec3[] | null = null;
    const match = this;
    return new ZombieSurvival({
      get tick() {
        return match.tick;
      },
      players: () => this.combatants().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos, eye: { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z }, bot: c.kind === 'bot' })),
      spawnSpots: () =>
        (spots ??= [
          // The map's NPC spawners (their vents, hatches and burrows), its spawn points, then open floor all over.
          ...this.map.entities.filter((e) => e.kind === 'encounter' || e.kind === 'spawn').map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] })),
          ...this.nav.places(),
        ]),
      sees: (a, b) => this.physics.lineOfSight(a, b),
      spawnZombie: (pos, health, speed) => {
        const id = this.spawnNpc(horde, 'zombie', pos, this.rng() * Math.PI * 2);
        const c = id === null ? undefined : this.npcs.get(id);
        if (!c) return null;
        c.health = c.maxHealth = Math.round(c.maxHealth * health);
        c.speedMul *= speed;
        return id;
      },
      zombieAlive: (id) => !!this.npcs.get(id)?.alive,
      revive: (slot) => {
        const c = this.slots[slot];
        if (c && !c.alive) this.spawn(c);
      },
      emit: (ev) => this.pendingEvents.push(ev),
      defeat: () => this.endRound(null, 'defeat'),
      random: () => this.rng(),
    });
  }

  private factionList?: readonly Faction[];

  /** The map's NPC factions (or the default enemy faction), after the teams in Team Deathmatch. */
  get factions(): readonly Faction[] {
    if (!this.factionList) {
      const npc = mapFactions(this.map);
      this.factionList = this.teams ? [...this.teams, ...npc.filter((f) => !this.teams!.some((t) => t.id === f.id))] : npc;
    }
    return this.factionList;
  }

  private teamList?: readonly Faction[] | null;

  /** The sides in team modes (2–8; Capture the Flag always has two); null in other modes. */
  get teams(): readonly Faction[] | null {
    if (this.teamList === undefined) this.teamList = isTeamMode(this.rules.mode) ? matchTeams(this.map, this.rules) : null;
    return this.teamList;
  }

  /** Target players per team: the rules' sizes, or even teams. */
  teamTargets(): Map<string, number> {
    const teams = this.teams ?? [];
    return new Map(teams.map((t, i) => [t.id, this.rules.teamSizes?.[i] ?? 16]));
  }

  /**
   * Faction players join: everyone shares one side in co-op; deathmatch is
   * free-for-all; team modes put each newcomer on the team furthest below its
   * size (as a share of it, so a 12-player team fills alongside 2-player ones).
   */
  private get playerFaction(): string | null {
    return this.factionFor('bot');
  }

  /**
   * The team a newcomer joins. People follow the rules' team assignment
   * (fixed: the first person to `hostTeam`; random: any team with room);
   * bots, and people under 'balanced', go where playerFaction puts them.
   */
  private factionFor(kind: Combatant['kind']): string | null {
    if (this.teams && kind === 'human') {
      const assign = this.rules.teamAssign;
      const people = this.combatants().filter((c) => c.kind === 'human').length;
      const fixed = this.rules.hostTeam;
      if (assign === 'fixed' && people === 0 && fixed !== undefined && Number.isInteger(fixed) && this.teams[fixed]) return this.teams[fixed].id;
      if (assign === 'random') {
        const targets = this.teamTargets();
        const open = this.teams.filter((t) => this.combatants().filter((c) => c.faction === t.id && c.kind === 'human').length < targets.get(t.id)!);
        const pool = open.length ? open : this.teams;
        return pool[Math.min(pool.length - 1, Math.floor(this.rng() * pool.length))]!.id;
      }
    }
    if (this.teams) {
      const targets = this.teamTargets();
      const count = (id: string) => this.combatants().filter((c) => c.faction === id).length;
      let best = this.teams[0]!.id;
      let bestFill = Infinity;
      for (const t of this.teams) {
        const fill = count(t.id) / targets.get(t.id)!;
        if (fill < bestFill - 1e-9) {
          bestFill = fill;
          best = t.id;
        }
      }
      return best;
    }
    return this.rules.mode === 'core.coop' || this.rules.mode === 'core.zombies' ? PLAYERS_FACTION : null;
  }

  /** Kills per team in Team Deathmatch; objective modes keep their own score. */
  teamScores(): Map<string, number> {
    if (this.mode) return this.mode.teamScores();
    const out = new Map<string, number>((this.teams ?? []).map((t) => [t.id, 0]));
    for (const c of this.combatants()) if (c.faction && out.has(c.faction)) out.set(c.faction, out.get(c.faction)! + c.kills);
    for (const [team, n] of this.leaderBounty) if (out.has(team)) out.set(team, out.get(team)! + n);
    return out;
  }

  private readonly hostility = new Map<string, boolean>();

  /** Should `a` attack (and be able to hurt) `b`? */
  hostile(a: Combatant, b: Combatant): boolean {
    if (a === b) return false;
    // Fast paths: deathmatch players fight everyone; same faction never fights.
    if (a.faction === null && b.faction === null) return true;
    if (a.faction === b.faction) return false;
    const key = `${a.faction}|${b.faction}`;
    let h = this.hostility.get(key);
    if (h === undefined) {
      h = relation(this.factions, a.faction, b.faction) === 'enemy';
      this.hostility.set(key, h);
    }
    return h;
  }

  /**
   * Can `a`'s shots, blasts, blades and fire hurt `b`? An enemy always; a teammate (anyone not hostile) only with
   * the match's friendly fire on, and never between NPCs and players (as `damage` rules). Hit tests use this, so with
   * friendly fire on a teammate in the line of fire takes the round (and stops it) instead of letting it through;
   * aiming, homing and bots' choice of target stay on `hostile`.
   */
  canHurt(a: Combatant, b: Combatant): boolean {
    if (a === b) return false;
    if (this.hostile(a, b)) return true;
    return (this.rules.friendlyFire ?? 'off') !== 'off' && !a.npc && !b.npc;
  }

  /** Players and NPCs. */
  actors(): Combatant[] {
    return [...this.combatants(), ...this.npcs.values()];
  }

  actor(id: number): Combatant | undefined {
    return id >= NPC_ID_BASE ? this.npcs.get(id) : (this.slots[id] ?? undefined);
  }

  /** Recent NPC spawn ticks (the per-second and per-minute spawn budgets). */
  private npcSpawnTicks: number[] = [];

  private spawnNpc(e: EncounterEntity, role: NpcRole, pos: Vec3, yaw: number): number | null {
    // Map-wide NPC budgets: alive at once, and spawned per second and per minute. Callers try again later.
    let alive = 0;
    for (const n of this.npcs.values()) if (n.alive) alive++;
    if (alive >= RESOURCE_BUDGETS.activeNpcs) {
      this.budgetWarning('npcs', `${RESOURCE_BUDGETS.activeNpcs} NPCs alive at once: more wait until some fall`);
      return null;
    }
    const t = this.tick;
    this.npcSpawnTicks = this.npcSpawnTicks.filter((x) => x > t - 60 * TICK_RATE);
    const lastSecond = this.npcSpawnTicks.filter((x) => x > t - TICK_RATE).length;
    if (lastSecond >= RESOURCE_BUDGETS.npcSpawnsPerSecond || this.npcSpawnTicks.length >= RESOURCE_BUDGETS.npcSpawnsPerMinute) {
      this.budgetWarning('npcSpawns', `NPCs spawning faster than ${RESOURCE_BUDGETS.npcSpawnsPerSecond} a second or ${RESOURCE_BUDGETS.npcSpawnsPerMinute} a minute: spawns wait`);
      return null;
    }
    this.npcSpawnTicks.push(t);
    const spec = NPC_ROLE_SPECS[role];
    const id = this.nextNpcId++;
    const def = getWeapon(spec.weapon);
    const npcHit = npcHitbox(role, id);
    const c: Combatant = {
      ...this.blankCombatant(id, 'npc', spec.label),
      faction: e.faction,
      speedMul: spec.speed,
      npc: { encounter: e.id, role, removeAt: Infinity, damage: e.damage ?? 1 },
      move: { pos: { ...pos }, velY: 0, grounded: false },
      yaw,
      health: spec.health * (e.health ?? 1),
      maxHealth: spec.health * (e.health ?? 1),
      size: e.size ?? 1,
      // Hit as drawn: its creature body, its character look or the mannequin, at the role's scale.
      hitbox: npcHit.box,
      hitScale: npcHit.scale,
      alive: true,
      weapons: new Map([[weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 }]]),
      current: weaponCode(def),
    };
    c.bot = new BotBrain(id, NPC_ROLE_PROFILES[role], BOT_DIFFICULTIES[e.difficulty], this.seed);
    c.bot.onSpawn(yaw);
    this.npcs.set(id, c);
    return id;
  }

  private blankCombatant(slot: number, kind: Combatant['kind'], name: string, team?: string | null): Combatant {
    return {
      slot,
      kind,
      name,
      look: DEFAULT_LOOK,
      faction: kind === 'npc' ? null : (team !== undefined ? team : this.factionFor(kind)),
      speedMul: 1,
      size: 1,
      hitbox: DEFAULT_HITBOX.box,
      hitLook: DEFAULT_LOOK,
      hitScale: DEFAULT_HITBOX.scale,
      stats: classStats('standard'),
      maxHealth: PLAYER.maxHealth,
      collider: this.physics.createPlayerCollider(),
      move: { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: false },
      yaw: 0,
      pitch: 0,
      health: PLAYER.maxHealth,
      armor: 0,
      alive: false,
      respawnTick: 0,
      kills: 0,
      selfKills: 0,
      objective: 0,
      deaths: 0,
      weapons: new Map(),
      current: 0,
      throwable: null,
      fireCooldown: 0,
      meleeCooldown: 0,
      punchedAt: -1000,
      throwCooldown: 0,
      reloadTicks: 0,
      raiseTicks: 0,
      speedTicks: 0,
      damageTicks: 0,
      prevButtons: 0,
      moveSpeed: 0,
      windup: 0,
      semiLatch: false,
      burstLeft: 0,
      burstTimer: 0,
      bloom: 0,
      gun: newGunState(),
      reload: null,
      burnTicks: 0,
      jetFuel: null,
      breath: 0,
      poisonTicks: 0,
      slowTicks: 0,
      impact: newImpact(),
      chill: 0,
      frozenTicks: 0,
      statusBy: null,
      statusWeapon: '',
      queue: [],
      lastSeq: 0,
    };
  }

  private removeNpc(id: number): void {
    const c = this.npcs.get(id);
    if (!c) return;
    this.physics.removeCollider(c.collider);
    this.npcs.delete(id);
  }

  private roundEndTick(): number {
    return this.rules.timeLimitSeconds > 0 ? this.tick + this.rules.timeLimitSeconds * TICK_RATE : Infinity;
  }

  combatants(): Combatant[] {
    return this.slots.filter((c): c is Combatant => c !== null);
  }

  /** `team`: the faction to join (default: the rules' team assignment). */
  /**
   * MapMaker's Play from here (editor/playFromHere.ts): put a player at a spot now, feet there and facing that way,
   * and start any life before play begins there too (the countdown's). Once play begins, the spawn points again.
   */
  startHere(c: Combatant, at: { pos: Vec3; yaw: number; pitch: number }): void {
    c.startAt = { pos: { ...at.pos }, yaw: at.yaw, pitch: at.pitch };
    if (!c.alive) return;
    // Out of a vehicle or the drop plane the spawn may have put them in: on foot, where asked.
    this.leaveMount(c, false);
    c.move = { pos: { ...at.pos }, velY: 0, grounded: false };
    c.yaw = at.yaw;
    c.pitch = at.pitch;
  }

  addHuman(name: string, look?: string, team?: string | null): Combatant | null {
    const c = this.addCombatant('human', name, team);
    if (c) this.chooseLook(c, validLookId(look));
    return c;
  }

  /**
   * `asCharacter`: play the look's own profile (under the match's bot style) instead of `profile` when it has one.
   * `o`: a bot of the host's bot set: its team (a faction ID), look, and own skill, style and squad.
   */
  addBot(name: string | ((look: string) => string), profile: BotProfile, difficulty: BotDifficulty = BOT_DIFFICULTIES.normal, asCharacter = false, o?: { team?: string; look?: string; botSet?: NonNullable<Combatant['botSet']> }): Combatant | null {
    const team = o?.team !== undefined && this.teams?.some((t) => t.id === o.team) ? o.team : undefined;
    const c = this.addCombatant('bot', typeof name === 'string' ? name : '', team);
    if (c) {
      const own = o?.look ? validLookId(o.look) : this.botLook(c.slot);
      // A random bot is named after what it wears (BotFiller: the look's own name, else its theme's).
      if (typeof name === 'function') c.name = name(own);
      this.chooseLook(c, own);
      if (o?.botSet) c.botSet = { ...o.botSet };
      const skill = c.botSet?.skill ? BOT_DIFFICULTIES[c.botSet.skill] : difficulty;
      c.bot = new BotBrain(c.slot, asCharacter ? profileFor(c.ownLook ?? c.look, profile, c.botSet?.style ?? this.rules.botStyle) : profile, skill, this.seed);
      c.bot.onSpawn(c.yaw);
      // Bots choose routes from the navmesh's sample places: build them now, not mid-match.
      this.nav.places();
      this.refreshRoles();
    }
    return c;
  }

  /** Every name in the match now: players, bots and spectators (bot naming skips them). */
  namesInUse(): string[] {
    return [...this.combatants().map((c) => c.name), ...[...this.spectators.values()].map((s) => s.name)];
  }

  /**
   * Which looks random bots wear (content/botNames.ts): the host's choice (rules.botCast), else the map's
   * (MapDocument.botCast); empty: every look.
   */
  get botCast(): readonly string[] {
    return this.rules.botCast ?? validBotCast(this.map.botCast);
  }

  /** A random bot's look for its slot: spread across the looks the bot-characters setting allows (all: the whole roster, as ever). */
  botLook(slot: number): string {
    const cast = this.botCast;
    if (!cast.length) return lookForBot(slot);
    const pool = castLooks(cast);
    return pool[(slot + 1) % pool.length]!.id;
  }

  /**
   * The bot-characters setting changed mid-match: a random bot (not the host's set's, not playing for an away
   * player) wearing a look it no longer allows wears an allowed one and takes a name for it. Returns how many changed.
   */
  recastBots(name: (look: string, self: Combatant) => string): number {
    let n = 0;
    const cast = this.botCast;
    const pool = castLooks(cast);
    for (const c of this.combatants()) {
      if (c.kind !== 'bot' || c.away || c.botSet || pool.some((l) => l.id === c.look)) continue;
      c.look = this.botLook(c.slot);
      this.applyBodySize(c);
      c.name = name(c.look, c);
      this.rebrain(c, c.bot!.difficulty);
      n++;
    }
    if (n) this.rolesFor = -1;
    return n;
  }

  /**
   * A player joining a running match makes room by removing a Player Bot: the
   * worst-scoring bot (fewest kills less deaths) on the team that most needs a
   * player (fewest people for its size). The player then spawns like anyone
   * else, at a spawn point, never in the bot's place. Null when there is no bot
   * to remove or no free slot after.
   */
  takeOverBot(name: string, look?: string, party?: string): Combatant | null {
    const all = this.combatants();
    // An away player's place is held for them: never given to someone else.
    const bots = all.filter((c) => c.kind === 'bot' && !c.away);
    if (!bots.length) return null;
    const targets = this.teamTargets();
    const people = (team: string | null) => all.filter((c) => c.kind === 'human' && c.faction === team).length / (team ? (targets.get(team) ?? 1) : 1);
    const score = (c: Combatant) => c.kills - c.deaths;
    // Random or fixed assignment: the team is chosen first and one of its bots makes room.
    const want = this.teams && this.rules.teamAssign && this.rules.teamAssign !== 'balanced' ? this.factionFor('human') : undefined;
    const mine = (c: Combatant) => (want !== undefined && c.faction === want ? 0 : 1);
    // A party stays together: the team most of the joiner's party is on, while it has a bot to give way.
    const with_ = party ? this.partyTeam(party) : undefined;
    const near = (c: Combatant) => (with_ !== undefined && c.faction === with_ ? 0 : 1);
    bots.sort((a, b) => mine(a) - mine(b) || near(a) - near(b) || people(a.faction) - people(b.faction) || setRank(a) - setRank(b) || score(a) - score(b) || a.kills - b.kills || b.slot - a.slot);
    const out = bots[0]!;
    const from = out.name;
    this.botThought.delete(out.slot);
    this.remove(out.slot);
    const c = this.addHuman(name, look, want !== undefined && out.faction === want ? want : out.faction);
    if (c) {
      if (party) c.party = party;
      this.pendingEvents.push({ e: 'takeover', s: c.slot, from, to: name });
    }
    return c;
  }

  /** Free-for-all: the living people (and kept places) of `c`'s party, besides `c` (none: an empty set). */
  private partyNear(c: Combatant): Set<Combatant> {
    const out = new Set<Combatant>();
    for (const o of this.combatants()) if (o !== c && o.alive && o.party === c.party && (o.kind === 'human' || o.away)) out.add(o);
    return out;
  }

  /** Team modes: the team most of `party`'s people are on now (ties: the first team), or undefined (none in the match, or no teams). */
  partyTeam(party: string): string | undefined {
    if (!this.teams) return undefined;
    const n = new Map<string, number>();
    for (const c of this.combatants()) if (c.party === party && (c.kind === 'human' || c.away) && c.faction) n.set(c.faction, (n.get(c.faction) ?? 0) + 1);
    let best: string | undefined;
    for (const t of this.teams) if ((n.get(t.id) ?? 0) > (best === undefined ? 0 : (n.get(best) ?? 0))) best = t.id;
    return best;
  }

  /**
   * Between matches (sim/mapVote.ts): keep the scoreboard up until at least `tick` (the vote, then its winner, before
   * the host travels), so the match doesn't start itself over meanwhile. Never shortens a longer hold.
   */
  holdIntermission(tick: number): void {
    if (this.phase === 'intermission') this.phaseEndTick = Math.max(this.phaseEndTick, tick);
  }

  /** The tick the intermission ends at (the next round starts) while there is one, else null. */
  get intermissionEnds(): number | null {
    return this.phase === 'intermission' ? this.phaseEndTick : null;
  }

  /**
   * A player left: a Player Bot takes their slot back in place (same body,
   * position, team, loadout and score) instead of the slot emptying.
   */
  handToBot(slot: number, name: string, profile: BotProfile, difficulty: BotDifficulty = BOT_DIFFICULTIES.normal, asCharacter = false): Combatant | null {
    const c = this.slots[slot];
    if (!c || c.kind !== 'human') return null;
    const from = c.name;
    c.kind = 'bot';
    c.name = name;
    delete c.party;
    c.queue = [];
    c.prevButtons = 0;
    this.readySlots.delete(slot);
    c.bot = new BotBrain(c.slot, asCharacter ? profileFor(c.look, profile, this.rules.botStyle) : profile, difficulty, this.seed);
    c.bot.onSpawn(c.yaw);
    this.nav.places();
    this.refreshRoles();
    this.squadsDirty = true;
    this.pendingEvents.push({ e: 'takeover', s: c.slot, from, to: name, bot: 1 });
    return c;
  }

  /**
   * The host changed bot skill or style mid-match: every Player Bot gets a
   * fresh brain with the new skill, playing its character under the new style
   * (rules.botStyle), from where it stands.
   */
  retuneBots(difficulty: BotDifficulty, style?: MatchRules['botStyle']): void {
    if (style) this.setRules({ botStyle: style === 'mixed' ? undefined : style });
    for (const c of this.combatants()) {
      if (c.kind !== 'bot' || !c.bot) continue;
      // A bot of the host's set with its own skill or style keeps it.
      this.rebrain(c, c.away ? difficulty : c.botSet?.skill ? BOT_DIFFICULTIES[c.botSet.skill] : difficulty);
    }
    this.rolesFor = -1;
    this.refreshRoles();
  }

  /** A fresh brain for a Player Bot from where it stands: `difficulty`, playing its character under its style (its own, else the match's). */
  private rebrain(c: Combatant, difficulty: BotDifficulty): void {
    if (!c.bot) return;
    c.bot = new BotBrain(c.slot, profileFor(c.look, c.bot.profile, c.botSet?.style ?? this.rules.botStyle), difficulty, this.seed);
    c.bot.onSpawn(c.yaw);
    this.botThought.delete(c.slot);
  }

  /**
   * The host's bot set changed for this bot (BotFiller.setBotSet): its name, look, skill, style and squad from
   * `entry` (index `index`), where it stands. `difficulty`: the match's skill, for an entry without its own.
   * A new look rebuilds its character on every screen (the clients' character queue spreads that out).
   */
  updateSetBot(c: Combatant, index: number, entry: BotEntry, difficulty: BotDifficulty): void {
    if (c.kind !== 'bot' || c.away) return;
    const before = c.botSet;
    c.botSet = { index, ...(entry.skill ? { skill: entry.skill } : {}), ...(entry.style ? { style: entry.style } : {}), ...(entry.squad ? { squad: entry.squad } : {}) };
    c.name = entry.name;
    const look = entry.look ? validLookId(entry.look) : c.look;
    const relook = look !== c.look;
    if (relook) {
      c.look = look;
      this.applyBodySize(c);
    }
    if (relook || before?.skill !== c.botSet.skill || before?.style !== c.botSet.style) {
      this.rebrain(c, c.botSet.skill ? BOT_DIFFICULTIES[c.botSet.skill] : difficulty);
      this.rolesFor = -1;
    }
    this.squadLeads = null;
  }

  /** A bot no longer plays an entry of the host's set (the set changed): a random bot from now on, under `name`. */
  dropSetBot(c: Combatant, name: string, difficulty: BotDifficulty): void {
    if (!c.botSet) return;
    const own = c.botSet.skill !== undefined || c.botSet.style !== undefined;
    delete c.botSet;
    c.name = name;
    if (own) this.rebrain(c, difficulty);
    this.squadLeads = null;
  }

  /** The faction the next bot joins (the team that most needs a player), or null outside team modes. */
  nextBotTeam(): string | null {
    return this.teams ? this.factionFor('bot') : null;
  }

  /** How many are on a team now, and how many it should have (team modes). */
  teamRoom(team: string): { on: number; size: number } {
    return { on: this.combatants().filter((c) => c.faction === team).length, size: this.teamTargets().get(team) ?? 0 };
  }

  /**
   * The host changed a setting mid-match (team sizes, bot style): the match
   * takes a new rules object (the one it was given may be shared, e.g. a
   * mode's defaults). Team count stays as it started.
   */
  setRules(patch: Partial<MatchRules>): void {
    (this as { rules: MatchRules }).rules = { ...this.rules, ...patch };
    // "Mix up weapon pickups" turned on or off, or another weapon set: every pickup it touches rolls (or goes back to
    // what was placed) now; everyone's next life spawns with the set's loadout.
    if ('mixPickups' in patch || 'weaponSet' in patch) for (const p of this.pickups) this.repool(p);
    // Weapon drops turned off: the ones lying about go too.
    if (!dropsInPlay(this.rules)) this.drops.length = 0;
  }

  /** The host ends the match now: the results as they stand, then the scoreboard (and a fresh round after the intermission). */
  endMatch(): boolean {
    if (this.phase !== 'playing') return false;
    this.endRound();
    return true;
  }

  /** The host starts the match over on the same map: scores cleared, everyone respawned, the countdown again. */
  restartMatch(): void {
    this.startRound();
  }

  /**
   * A look's size and stats (sim/characterStats.ts): small and large looks play differently unless the match turns
   * body sizes off, and a look's own stats count unless it turns character stats off.
   */
  private applyBodySize(c: Combatant): void {
    const spec = matchStats(c.look, this.rules);
    c.stats = spec;
    c.size = spec.size;
    // Classes set health and speed themselves.
    if (c.cls) return;
    c.speedMul = spec.speed;
    // At full health (as everyone is, joining: they spawn before their look is set), full health of the new size.
    if (!c.alive || c.health >= c.maxHealth) c.health = spec.health;
    c.maxHealth = spec.health;
  }

  /**
   * A player's or bot's own choice of look: worn now, or (while Random characters gives it random ones) kept for
   * when that goes off.
   */
  private chooseLook(c: Combatant, look: string): void {
    if (c.ownLook !== undefined) {
      c.ownLook = look;
      return;
    }
    c.look = look;
    this.applyBodySize(c);
  }

  /**
   * Random characters: a player or bot (not an NPC) starting a life plays a random roster look (sim/randomLooks.ts),
   * its own choice kept for when the setting goes off again. True when its look changed (the spawn event carries it).
   */
  private relookOnSpawn(c: Combatant): boolean {
    if (c.kind === 'npc') return false;
    if (this.roulette) {
      // Roulette: the next card of the player's own deck (or the streak pick chosen), every life.
      c.ownLook ??= c.look;
      c.lives = (c.lives ?? 0) + 1;
      c.look = this.roulette.deal(c).look;
      this.applyBodySize(c);
      return true;
    }
    if (this.rules.randomCharacters) {
      c.ownLook ??= c.look;
      c.lives = (c.lives ?? 0) + 1;
      const look = randomLook(this.seed, c.slot, c.lives, c.look);
      if (look === c.look) return false;
      c.look = look;
    } else {
      if (c.ownLook === undefined) return false;
      const own = c.ownLook;
      c.ownLook = undefined;
      if (own === c.look) return false;
      c.look = own;
    }
    this.applyBodySize(c);
    return true;
  }

  /** `at`: this slot (a spectator joining again takes back the slot kept for them); else the first free one. */
  private addCombatant(kind: Combatant['kind'], name: string, team?: string | null, at?: number): Combatant | null {
    const slot = at ?? this.slots.findIndex((s, i) => s === null && !this.spectators.has(i));
    if (slot < 0 || this.slots[slot]) return null;
    const c = this.blankCombatant(slot, kind, name, team);
    this.slots[slot] = c;
    this.squadsDirty = true;
    this.spawnOrQueue(c);
    return c;
  }

  remove(slot: number): void {
    const c = this.slots[slot];
    // A spectator leaving (or removed): the slot kept for them is free again.
    if (!c) {
      if (this.spectators.delete(slot)) {
        this.activity.delete(slot);
        this.readySlots.delete(slot);
      }
      return;
    }
    this.activity.delete(slot);
    if (this.phase === 'playing') this.mode?.onLeave(c);
    this.fireteams?.scores.leave(c.slot);
    this.classes?.onLeave(c);
    this.roulette?.forget(slot);
    this.readySlots.delete(slot);
    this.leaveMount(c, false);
    this.physics.removeCollider(c.collider);
    this.slots[slot] = null;
    this.squadsDirty = true;
    this.director?.forget(slot);
    this.rolesFor = -1;
    this.leadGoals.delete(slot);
    this.squadLeads = null;
  }

  /**
   * Spectators by choice (pause menu → Spectate): out of the match (no body, no team, not counted for team
   * sizes or the bot fill, so a bot can take the place), their slot kept for them with nothing in it, and
   * their score kept for when they join again (joinFromSpectating). Their connection keeps its slot.
   */
  private readonly spectators = new Map<number, Spectator>();

  /** A player leaves play to watch: their body goes (as if they left), their slot and score wait for them. False if not a player in the match. */
  spectate(slot: number): boolean {
    const c = this.slots[slot];
    if (!c || c.kind !== 'human') return false;
    const s: Spectator = { name: c.name, look: c.look, kills: c.kills, deaths: c.deaths, selfKills: c.selfKills, objective: c.objective, since: this.tick, ...(c.account ? { account: true } : {}), ...(c.party ? { party: c.party } : {}) };
    // Their client stays loaded: a spectator counts for the start gate as a player does.
    const loaded = this.readySlots.has(slot);
    this.remove(slot);
    this.spectators.set(slot, s);
    if (loaded) this.readySlots.add(slot);
    // Watching counts as being there (camera input: noteActivity); the clock starts now.
    this.activity.set(slot, { tick: this.tick, yaw: NaN, pitch: NaN });
    return true;
  }

  /** A spectator joins play again, in the slot kept for them, with the score they had (team: the rules' assignment). */
  joinFromSpectating(slot: number): Combatant | null {
    const s = this.spectators.get(slot);
    if (!s) return null;
    this.spectators.delete(slot);
    const c = this.addCombatant('human', s.name, undefined, slot);
    if (!c) return null;
    this.chooseLook(c, validLookId(s.look));
    c.kills = s.kills;
    c.deaths = s.deaths;
    c.selfKills = s.selfKills;
    c.objective = s.objective;
    if (s.account) c.account = true;
    if (s.party) c.party = s.party;
    // Their client has the match loaded already (the start gate needn't wait for them).
    this.readySlots.add(slot);
    this.resetIdle(slot);
    return c;
  }

  /** Whether this slot is kept for a spectator. */
  isSpectator(slot: number): boolean {
    return this.spectators.has(slot);
  }

  /** How many spectators there are (each keeps a slot). */
  get spectatorCount(): number {
    return this.spectators.size;
  }

  /** The spectators' slots. */
  spectatorSlots(): number[] {
    return [...this.spectators.keys()];
  }

  /** When each player last really played (moved, turned or pressed something), and where they last looked. */
  private activity = new Map<number, { tick: number; yaw: number; pitch: number }>();

  /**
   * Note what a player's inputs say about them being there: moving, a button or
   * turning counts (a client sends inputs all the time, even untouched). Returns
   * whether they played. Works for a player who is away too (AWAY: they come back).
   */
  noteActivity(slot: number, inputs: readonly PlayerInput[]): boolean {
    const c = this.slots[slot];
    // Spectators (and the dead watching) count too: their camera input (`sp`, or turning) says they're there.
    if (c ? c.kind !== 'human' && !c.away : !this.spectators.has(slot)) return false;
    const was = this.activity.get(slot);
    let active = false;
    let yaw = was?.yaw ?? NaN;
    let pitch = was?.pitch ?? NaN;
    for (const i of inputs) {
      const turned = Number.isFinite(yaw) && (Math.abs(i.yaw - yaw) > 0.02 || Math.abs(i.pitch - pitch) > 0.02);
      if (i.forward || i.right || i.buttons || i.sp || turned) active = true;
      yaw = i.yaw;
      pitch = i.pitch;
    }
    this.activity.set(slot, { tick: active || !was ? this.tick : was.tick, yaw, pitch });
    return active;
  }

  /** Seconds since this player last played (0 when unknown: just joined). */
  idleSeconds(slot: number): number {
    const a = this.activity.get(slot);
    return a ? (this.tick - a.tick) / TICK_RATE : 0;
  }

  /** Start counting idle time again now (a new round, a player back from being away). */
  resetIdle(slot?: number): void {
    for (const [s, a] of this.activity) if (slot === undefined || s === slot) a.tick = this.tick;
  }

  /**
   * A player is away: a bot plays their body where it is (team, score and
   * loadout stay), shown as "Name (away)", until they come back (comeBack).
   */
  setAway(slot: number, away: NonNullable<Combatant['away']>, profile: BotProfile, difficulty: BotDifficulty = BOT_DIFFICULTIES.normal): Combatant | null {
    const c = this.slots[slot];
    if (!c || c.kind !== 'human') return null;
    c.kind = 'bot';
    c.away = away;
    c.name = `${away.name.slice(0, 25)} (away)`;
    c.queue = [];
    c.prevButtons = 0;
    this.readySlots.delete(slot);
    c.bot = new BotBrain(c.slot, profileFor(c.look, profile, this.rules.botStyle), difficulty, this.seed);
    c.bot.onSpawn(c.yaw);
    this.nav.places();
    this.refreshRoles();
    this.squadsDirty = true;
    return c;
  }

  /** An away player is back: their body is theirs again, where the bot left it. */
  comeBack(slot: number, name?: string): Combatant | null {
    const c = this.slots[slot];
    if (!c?.away) return null;
    c.kind = 'human';
    c.name = name ?? c.away.name;
    delete c.away;
    c.bot = undefined;
    c.queue = [];
    c.prevButtons = 0;
    // A new connection counts its inputs from 1 again; the same one carries on: either is newer than nothing.
    c.lastSeq = 0;
    this.botThought.delete(slot);
    this.nav.places();
    this.refreshRoles();
    this.resetIdle(slot);
    this.squadsDirty = true;
    return c;
  }

  /** Queue untrusted client inputs. Out-of-order or duplicate sequence numbers are dropped. */
  queueInputs(slot: number, inputs: readonly PlayerInput[]): void {
    const c = this.slots[slot];
    if (!c || c.kind !== 'human') return;
    const last = c.queue.length ? c.queue[c.queue.length - 1]!.seq : c.lastSeq;
    let seq = last;
    for (const raw of inputs) {
      const input = sanitizeInput(raw);
      if (input.seq <= seq) continue;
      seq = input.seq;
      c.queue.push(input);
    }
    if (c.queue.length > MAX_QUEUED_INPUTS) {
      const dropped = c.queue.splice(0, c.queue.length - MAX_QUEUED_INPUTS);
      // A backlog drops old inputs, but not a class pick (or quick message) one of them carried.
      const say = dropped.reverse().find((i) => i.say)?.say;
      if (say && !c.queue[0]!.say) c.queue[0]!.say = say;
    }
  }

  /** Advance the simulation by one fixed tick and return the events it produced. */
  step(): GameEvent[] {
    this.tick++;
    if (this.rules.leaders && this.teams) this.updateLeaders();
    this.stepFireteams();
    if (this.phase === 'intermission') {
      if (this.tick >= this.phaseEndTick) this.startRound();
    } else if (this.phase === 'waiting' || this.phase === 'countdown') {
      // Loading, then the countdown: everyone stands at their spawn and can only look around.
      for (const c of this.actors()) {
        for (const input of c.queue) {
          input.forward = 0;
          input.right = 0;
          input.buttons = 0;
        }
        this.applyInputs(c);
      }
      // Bots waiting for their spawn wave take their places during the wait.
      this.spawnDue();
      // Everyone who must have loaded first: the people playing and the spectators (a match only spectators
      // watch, bots against bots, starts as soon as they have loaded); nobody there yet: the wait runs out.
      const people = [...this.combatants().filter((c) => c.kind === 'human').map((c) => c.slot), ...this.spectators.keys()];
      if (this.phase === 'waiting' && ((people.length > 0 && people.every((slot) => this.readySlots.has(slot))) || this.tick >= this.phaseEndTick)) this.startCountdown();
      else if (this.phase === 'countdown' && this.tick >= this.phaseEndTick) this.beginPlay();
    } else {
      const prof = simProfile.on;
      let t = prof ? performance.now() : 0;
      const lap = (key: string) => {
        const now = performance.now();
        simProfile.add(key, now - t);
        t = now;
      };
      this.runBots();
      if (prof) lap('bots');
      // Movers first, so everyone moves against (and rides) this tick's platforms.
      this.scenario.moveMovers();
      if (prof) lap('scenario');
      const actors = this.actors();
      this.watched = this.botBudget(actors) > 1 ? actors.filter((c) => c.alive && (c.kind === 'human' || this.watchers.has(c.slot))).map((c) => c.move.pos) : null;
      for (const c of actors) this.applyInputs(c);
      if (prof) lap('players');
      if (this.ambient.length && this.road) this.driveAmbient(this.road);
      this.stepMounts();
      if (prof) lap('mounts');
      this.stepProjectiles();
      this.stepDrops();
      this.stepBullets();
      this.stepZones();
      this.stepStatuses();
      if (prof) lap('projectiles');
      if (this.phase === 'playing') this.scenario.step();
      if (this.phase === 'playing') this.encounters.step();
      if (this.phase === 'playing') this.mode?.step();
      // Roulette with Lunar: the gravity storm moves the match's gravity (movement reads it every move).
      if (this.phase === 'playing' && this.roulette) this.phys.gravity = this.roulette.step();
      if (this.phase === 'playing') this.zombies?.step();
      if (this.phase === 'playing') this.classes?.step();
      this.spawnDue();
      for (const c of this.npcs.values()) if (!c.alive && this.tick >= c.npc!.removeAt) this.removeNpc(c.slot);
      if (this.tick >= this.phaseEndTick) this.endRound();
      if (prof) lap('scenario');
    }
    this.recordHistory();
    const events = this.pendingEvents;
    this.pendingEvents = [];
    this.noteCombat(events);
    this.noteObjectives(events);
    this.awards.events(
      events,
      (slot) => {
        const c = this.actor(slot);
        return !!c && c.kind !== 'npc';
      },
      (a, b) => {
        const x = this.actor(a);
        const y = this.actor(b);
        return !!x && !!y && x !== y && this.hostile(x, y);
      },
      (w) => {
        const d = CORE_WEAPONS[w];
        return !!d && !d.projectile && d.kind !== 'melee';
      },
    );
    this.classes?.events(events);
    return events;
  }

  /** Big matches: an empty vehicle (ambient traffic, a parked car rolling) more than twice RELAXED_RANGE from every player. */
  private farVehicle(m: MountRt): boolean {
    const near = this.watched;
    if (!near || m.route || !m.seats.every((s) => s === null)) return false;
    const r = RELAXED_RANGE * 2;
    for (const w of near) if ((w.x - m.pos.x) ** 2 + (w.z - m.pos.z) ** 2 < r * r) return false;
    return true;
  }

  /**
   * Movement detail for big matches (past BOT_FULL_RATE bots), for bots and
   * NPCs walking on the ground (no push, jump, ladder, swim, canopy or
   * jetpack). 'coarse': on terrain maps the terrain's height function stands
   * in for its collision mesh (PhysicsWorld.moveCharacter), the dearest thing
   * the character controller collides with. 'far': also more than
   * RELAXED_RANGE from every player, so it moves every other tick by two
   * ticks' worth; snapshots go out every other tick anyway, so nobody sees
   * the difference. 'full': the same move a player makes.
   */
  private relaxedMove(c: Combatant, input: PlayerInput): 'full' | 'coarse' | 'far' {
    const near = this.watched;
    if (!near || c.kind === 'human' || this.watchers.has(c.slot) || c.bot?.parkouring) return 'full';
    const m = c.move;
    if (!m.grounded || m.velY !== 0 || m.vx || m.vz || m.swim || m.climb || m.chute || m.jet || m.zip !== undefined || input.buttons & (BUTTON_JUMP | BUTTON_USE)) return 'full';
    const p = m.pos;
    // Near a portal (stepping through turns and moves you) or in a gravity zone: the exact move.
    for (const g of this.scenario.portals) if ((g.pos.x - p.x) ** 2 + (g.pos.z - p.z) ** 2 < (RELAXED_PORTAL + g.width / 2) ** 2) return 'full';
    if (this.gravityZones.length && gravityAt(this.gravityZones, p) !== 1) return 'full';
    // In or over a buried tunnel (groundBore.ts): the ground's height there is the hill's, not the tunnel's floor.
    if (this.groundBores.length && nearGroundCut(this.groundBores, p.x, p.z, RELAXED_BORE)) return 'full';
    for (const w of near) if ((w.x - p.x) ** 2 + (w.z - p.z) ** 2 < RELAXED_RANGE * RELAXED_RANGE) return 'coarse';
    return 'far';
  }

  /**
   * Hidden in foliage: inside a bush (or fern, or tall crop) whose top is above
   * your eyes (crouch or lie down in the small ones), and not given away by
   * firing in the last two seconds. Bots then only spot you up close.
   */
  private concealed(c: Combatant): boolean {
    // A cloaked Shade (Classes) is as hidden as anyone in a bush.
    if (c.alive && this.classes?.cloaked(c)) return true;
    if (!this.hides.length || c.mount || !c.alive) return false;
    const fired = this.lastShot.get(c.slot);
    if (fired !== undefined && this.tick - fired < 2 * TICK_RATE) return false;
    const p = c.move.pos;
    const eye = p.y + eyeHeightOf(c.move);
    return this.hides.some((h) => p.y >= h.y0 && eye <= h.y1 + 0.15 && hypot(p.x - h.x, p.z - h.z) < h.r);
  }

  private runBots(): void {
    // Ground that has gone (a crumbled bridge, an open trapdoor, a drawbridge up: Scenario.surfacesGone), a few times a
    // second: routes keep off it from now on, and bots on one over it plan again (Phase C item 2).
    if (this.tick % 6 === 0) this.nav.setGone(this.scenario.surfacesGone());
    // The tick's route searches for bots (Phase C item 4): plenty for a normal match, a ceiling for a crowd's spikes.
    this.nav.beginTick(SEARCH_BUDGET);
    const t0 = performance.now();
    const actors = this.actors();
    // Actors as bots see them: one view object per actor, refilled every tick (no 96 new objects a tick).
    const views = this.views;
    if (views.size > actors.length * 2 + 16) views.clear();
    for (const c of actors) {
      // Spawn protection run out: gone from the view too.
      if (c.shieldUntil && !this.shielded(c)) c.shieldUntil = 0;
      const v = views.get(c.slot);
      if (v) fillView(v, c, this.concealed(c), this.sheltered(c));
      else views.set(c.slot, toView(c, this.concealed(c), this.sheltered(c)));
    }
    // Spears and discs lying where they landed, for whoever picks them up.
    const lying: PickupView[] = [];
    for (const p of this.projectiles) {
      if (!p.stuck || !p.spec.retrievable) continue;
      const item = lyingItem(p);
      if (item) lying.push({ id: `${p.spec.disc ? 'disc' : 'spear'}_${p.id}`, item, pos: p.pos, available: true });
    }
    // Weapons dropped by the fallen count as weapon pickups.
    for (const d of this.drops) lying.push({ id: `drop_${d.id}`, item: d.item, pos: d.pos, available: true });
    const pickups: PickupView[] = [...lying, ...this.pickups.filter((p) => !restrictedWeapons(this.rules) || !['weapon', 'ammo', 'throwable'].includes(p.item.effect.kind)).map((p) => ({ id: p.id, item: p.item, pos: p.pos, available: p.enabled && this.tick >= p.availableAt, ...(p.enabled && this.tick < p.availableAt ? { respawnIn: (p.availableAt - this.tick) / TICK_RATE } : {}) }))];
    const npcPickups: PickupView[] = [];
    // Team-only doors block other teams; buttons a bot may press can open the doors in its way.
    const blockersBy = new Map<string | null, ReturnType<Scenario['blockers']>>();
    const blockersFor = (team: string | null) => blockersBy.get(team) ?? blockersBy.set(team, this.scenario.blockers(team)).get(team)!;
    const shutBy = new Map<string | null, number>();
    const shutFor = (team: string | null) => shutBy.get(team) ?? shutBy.set(team, this.scenario.openingsShut(team)).get(team)!;
    const buttonsBy = new Map<string | null, ReturnType<Scenario['doorButtons']>>();
    const doorButtonsFor = (team: string | null) => buttonsBy.get(team) ?? buttonsBy.set(team, this.scenario.doorButtons(team)).get(team)!;
    const lifts = this.scenario.liftViews();
    const portals = this.scenario.portalViews();
    const hazards = this.scenario.hazards();
    const spawnPoints = this.spawnPoints.map((s) => s.pos);
    // Team Deathmatch bots roam toward the other side's spawns, so the teams meet in the middle.
    const teamRoam = new Map<string, Vec3[]>();
    for (const t of this.teams ?? []) {
      // Teams without bases of their own roam the whole map.
      if (!this.spawnPoints.some((s) => s.team === t.id)) continue;
      const away = this.spawnPoints.filter((s) => s.team !== null && s.team !== t.id).map((s) => s.pos);
      if (away.length) teamRoam.set(t.id, away);
    }
    const coop = this.rules.mode === 'core.coop';
    const zombies = this.rules.mode === 'core.zombies';
    const mounts = this.mounts.length ? this.mountViews(actors) : undefined;
    const noises = this.noises.length ? this.noises : undefined;
    // Living members of each side (a bot finds itself in its own list and skips it).
    const factionViews = new Map<string, CombatantView[]>();
    for (const o of actors) {
      if (!o.alive || o.faction === null) continue;
      let list = factionViews.get(o.faction);
      if (!list) factionViews.set(o.faction, (list = []));
      list.push(views.get(o.slot)!);
    }
    // Who each side may attack depends only on the sides (and never yourself): work it out once
    // per side a tick instead of once per bot, which is quadratic with 96 players.
    const hostileBySide = new Map<string | null, Combatant[]>();
    const hostilesOf = (c: Combatant): Combatant[] => {
      let list = hostileBySide.get(c.faction);
      if (!list) hostileBySide.set(c.faction, (list = actors.filter((o) => o.alive && (o === c || this.hostile(c, o)) && (o !== c || c.faction === null))));
      return list.includes(c) ? list.filter((o) => o !== c) : list;
    };
    // Their views, likewise once per side (when the side's list doesn't hold the bot itself).
    const hostileViewsBySide = new Map<string | null, CombatantView[]>();
    const hostileViews = (c: Combatant, hostiles: Combatant[]): CombatantView[] => {
      if (hostiles !== hostileBySide.get(c.faction)) return hostiles.map((o) => views.get(o.slot)!);
      let list = hostileViewsBySide.get(c.faction);
      if (!list) hostileViewsBySide.set(c.faction, (list = hostiles.map((o) => views.get(o.slot)!)));
      return list;
    };
    const anySentries = this.mounts.some((m) => m.def.sentry && m.alive);
    this.directBots(actors);
    const director = this.director;
    const every = this.botBudget(actors);
    // Big matches: each side's living members on a grid over the ground, for keeping apart.
    const alliesGrids = new Map<string, ViewGrid>();
    if (every > 1) {
      let i = 0;
      for (const [side, list] of factionViews) alliesGrids.set(side, this.gridFor(i++, list));
    }
    // Think budget (big matches): at most this many full thinks a tick; the rest of those due wait a tick,
    // steering or coasting meanwhile, and go first on the next (round robin: the loop starts at a different
    // bot every tick, and a bot never waits two ticks running).
    let thinkers = 0;
    for (const c of actors) if (c.bot && c.alive) thinkers++;
    const cap = every > 1 ? Math.ceil(thinkers / every) + BOT_THINK_SLACK : Infinity;
    let thoughts = 0;
    const deferredBefore = this.botDeferred;
    const deferred = new Set<number>();
    const n = actors.length;
    const from = every > 1 && n ? (this.tick * 7) % n : 0;
    for (let k = 0; k < n; k++) {
      const c = actors[(k + from) % n]!;
      if (!c.bot) continue;
      // (A bot on a parkour link thinks every tick until it lands: its jump is timed to the tick.)
      const due = every === 1 || (this.tick + c.slot) % every === 0 || deferredBefore.has(c.slot) || c.bot.parkouring;
      // Big matches: a bot with nobody to fight thinks on its own ticks and keeps its last move in between.
      if (!due && this.coastBot(c, every)) continue;
      const hostiles = hostilesOf(c);
      // Objective modes can narrow what a bot notices (flag carriers keep running).
      const aware = this.mode && !c.npc ? this.mode.botAwareness(c) : Infinity;
      const npc = c.npc;
      // Dormant NPCs (no enemy within earshot of the squad's area) skip thinking entirely.
      // Zombies always know where the living are.
      const shambler = npc?.role === 'zombie';
      if (npc && !shambler && c.alive && !c.bot.lastSeen && !this.encounters.roaming(c.slot) && !hostiles.some((o) => horizontalDistance(o.move.pos, c.move.pos) < 70)) {
        c.queue.push({ seq: c.lastSeq + 1, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0 });
        continue;
      }
      const others = aware < Infinity || anySentries ? [...(aware < Infinity ? hostiles.filter((o) => horizontalDistance(o.move.pos, c.move.pos) <= aware) : hostiles).map((o) => views.get(o.slot)!), ...this.hostileSentries(c)] : hostileViews(c, hostiles);
      const allies = c.faction === null ? undefined : factionViews.get(c.faction);
      const tt = simProfile.on ? performance.now() : 0;
      // Over the think budget, a bot due to think steers (or coasts) this tick and thinks first on the next.
      const over = due && every > 1 && thoughts >= cap && !deferredBefore.has(c.slot) && !c.bot.parkouring;
      const mayWait = every > 1 && (!due || over) && c.alive && !c.mount;
      // (A steering bot has no use for its goal, except a class's own input below.)
      let orderGoal = mayWait && !this.classes ? undefined : this.botGoal(c, hostiles, zombies, coop);
      const view: BotWorldView = {
        tick: this.tick,
        self: views.get(c.slot)!,
        others,
        physics: this.physics,
        // Shared sight lines and bounded perception only in big matches: smaller ones see exactly as before.
        sight: every > 1 ? this.sight : undefined,
        crowded: every > 1,
        ...(this.smokeClouds().length ? { smoke: this.smokeClouds() } : {}),
        nav: this.nav,
        spawnPoints: orderGoal === undefined ? spawnPoints : npc && orderGoal ? [orderGoal.pos] : (c.faction && teamRoam.get(c.faction)) || spawnPoints,
        pickups: npc ? npcPickups : pickups,
        inventory: this.inventoryOf(c),
        throwables: c.throwable?.count ?? 0,
        throwable: c.throwable?.kind ?? null,
        held: c.current,
        reloading: c.reloadTicks > 0,
        blockers: blockersFor(c.faction),
        shut: shutFor(c.faction),
        doorButtons: doorButtonsFor(c.faction),
        ...(lifts.length ? { lifts } : {}),
        ...(portals.length ? { portals } : {}),
        ...(this.zipRides.length ? { ziplines: this.zipRides.map((r) => ({ start: r.start, end: r.end, on: teamAllows(r.team, c.faction) })) } : {}),
        hazards,
        orderGoal: orderGoal ?? null,
        allies,
        // Focused bots (flag carriers) also ignore distant gunfire and near misses: they keep running.
        noises: aware < Infinity ? undefined : noises,
        shotAt: aware < Infinity ? null : (c.shotAt ?? null),
        // Bots that may not take a vehicle right now (carrying the bomb, leading hostages) don't see any to get in.
        mounts: aware < Infinity ? undefined : mounts && !c.mount && this.mode?.blocksVehicle(c) ? mounts.filter((m) => m.kind !== 'vehicle') : mounts,
        // Every mount's hull, for walking round the ones standing still (BotBrain.pastHulls), even for a focused bot.
        hulls: c.mount ? undefined : mounts,
        seat: c.mount ? this.seatView(c) : null,
        guides: this.guides,
        squad: npc ? this.encounters.squadFor(c.slot, npc.role) : null,
        // (Always present, so every view has one shape: bot code reading it stays monomorphic.)
        alliesGrid: every > 1 && c.faction !== null ? alliesGrids.get(c.faction) : undefined,
        plan: npc || !director || c.kind !== 'bot' ? undefined : director.planFor(c.slot),
      };
      // Big matches: between its full thinks a fighting bot steers: perception runs when due, its aim
      // follows the target and the trigger discipline runs, its move carries on (see BotBrain.steer).
      let input: PlayerInput | null = null;
      if (mayWait) {
        const last = this.botThought.get(c.slot);
        const s = last && this.tick - last.tick < every ? c.bot.steer(view) : null;
        if (s && last) {
          input = { seq: c.lastSeq + 1, forward: s.forward, right: s.right, yaw: s.yaw, pitch: s.pitch, buttons: (last.input.buttons & COAST_BUTTONS) | (s.fire ? BUTTON_FIRE : 0) | (s.zoom ? BUTTON_ZOOM : 0) };
          if (simProfile.on) simProfile.count('botSteer');
        } else if (over && this.coastBot(c, every, true)) {
          deferred.add(c.slot);
          if (simProfile.on) simProfile.count('botDeferred');
          continue;
        }
        if (input && over) {
          deferred.add(c.slot);
          if (simProfile.on) simProfile.count('botDeferred');
        }
      }
      if (!input) {
        if (orderGoal === undefined) {
          orderGoal = this.botGoal(c, hostiles, zombies, coop);
          view.orderGoal = orderGoal;
          view.spawnPoints = npc && orderGoal ? [orderGoal.pos] : (c.faction && teamRoam.get(c.faction)) || spawnPoints;
        }
        input = c.bot.think(view);
        thoughts++;
        if (simProfile.on) {
          const took = performance.now() - tt;
          simProfile.add('botThink', took);
          simProfile.count('botThink');
          // The slowest single think (bench --spikes: one bot's bad moment, or many ordinary ones).
          if (took > (simProfile.ms.get('botThink slowest') ?? 0)) simProfile.ms.set('botThink slowest', took);
        }
      }
      // Melee creatures rush the target they can see instead of keeping their distance.
      if (npc && NPC_ROLE_SPECS[npc.role].melee && c.alive) {
        const target = c.bot.target === null ? null : this.actor(c.bot.target);
        chargeIntoMelee(input, c.move.pos, target?.alive ? target.move.pos : null, getWeapon(NPC_ROLE_SPECS[npc.role].weapon).range);
      }
      if (!npc) this.mode?.botInput?.(c, input);
      if (!npc) this.classes?.botInput(c, input, orderGoal ?? null);
      if (!npc && c.alive && !c.mount && this.rules.weapons === 'discs') this.dodgeDiscs(c, input);
      this.planeBot(c, input);
      // Bots fight recoil like players do, as well as their skill allows (spec §40).
      if (c.alive && (c.gun.rp > 0 || c.gun.ry !== 0)) {
        const k = c.bot.difficulty.aim.recoilComp ?? 0.5;
        input.rc = [c.gun.rp * k, c.gun.ry * k];
      }
      c.queue.push(input);
      if (every > 1) this.botThought.set(c.slot, { input, tick: this.tick });
    }
    this.botDeferred = deferred;
    this.lastAiMs = performance.now() - t0;
  }

  /** Bots' views of the actors, by actor ID, refilled each tick (runBots). */
  private readonly views = new Map<number, CombatantView>();
  /** Each bot's last thought-out (or steered) input and its tick (only kept in big matches, see coastBot). */
  private readonly botThought = new Map<number, { input: PlayerInput; tick: number }>();
  /** Bots whose think the budget put off last tick: they think first this tick. */
  private botDeferred = new Set<number>();
  /** Grids reused tick to tick (runBots). */
  private readonly grids: ViewGrid[] = [];

  /** Squads, roles and each side's map knowledge for Player Bots (bots/director.ts); made with the first bot. */
  private director: BotDirector | null = null;
  /** The bots' common trips with their corridors (botTrips); null until asked for, and again once the navmesh changes. */
  private trips: (BotTripSpec & { trip: Trip })[] | null = null;

  /** A side's team brain (bots/teamBrain.ts: its groups, pushes and prices), for measuring and tests; null before the first bot. */
  teamBrain(side: string): TeamBrain | null {
    return this.director?.brainFor(side) ?? null;
  }

  /** A Player Bot's role this match (director.ts: squad, camper, sniper, lone wolf), for measuring; null without one. */
  botRole(slot: number): string | null {
    return this.director?.roleOf(slot) ?? null;
  }

  /**
   * The trips a team's bots make again and again (the mode's: base to flag, spawn to hill...; without a mode, each
   * team's spawn to the other's) and two or three corridors for each (nav/corridors.ts: a few ms each, kept per
   * navmesh), worked out the first time they are asked for (at setup: refreshRoles) and again once the navmesh is
   * rebuilt (Fort Wars). The team brain spreads its groups over them; the scorecard measures who walks which.
   */
  /** Measuring (bot-report, tests): every mount's id, state, crew and limited ammunition, read only. */
  mountStates(): { index: number; id: string; pos: Vec3; yaw: number; speed: number; health: number; alive: boolean; seats: readonly (number | null)[]; shells: (number | null)[] }[] {
    return this.mounts.map((m) => ({ index: m.index, id: m.def.id, pos: { ...m.pos }, yaw: m.yaw, speed: m.speed, health: Math.max(0, m.health), alive: m.alive, seats: [...m.seats], shells: m.guns.map((g) => g?.shells ?? null) }));
  }

  botTrips(): readonly (BotTripSpec & { trip: Trip })[] {
    if (this.trips) return this.trips;
    let specs: readonly BotTripSpec[] = this.mode?.botTrips?.() ?? [];
    if (!this.mode && this.teams && this.teams.length === 2) {
      const [a, b] = this.teams;
      const ha = teamHome(this.spawnPoints, a!.id);
      const hb = teamHome(this.spawnPoints, b!.id);
      if (ha && hb) specs = [{ team: a!.id, from: ha, to: hb, kind: 'attack' }, { team: b!.id, from: hb, to: ha, kind: 'attack' }];
    }
    this.nav.mainPlaces();
    return (this.trips = specs.map((s) => ({ ...s, trip: findCorridors(this.nav, s.from, s.to) })));
  }
  /** Player Bots the roles were last handed out for (-1: hand them out again). */
  private rolesFor = -1;

  /**
   * Roles for the Player Bots (director.ts assignRoles: campers, snipers and
   * lone wolves a small share each, by the match's bot style), when the roster
   * has changed. The first time a camper or sniper turns up, the map's vantage
   * spots are worked out (once per map: vantage.ts), at setup, not mid-tick.
   */
  private refreshRoles(): void {
    const bots = this.combatants().filter((c) => c.kind === 'bot' && c.bot);
    if (!bots.length || bots.length === this.rolesFor) return;
    this.rolesFor = bots.length;
    // (The main area's places: regions, lanes and vantage spots a route gets to, not roofs and pits.)
    const places = this.nav.mainPlaces();
    // (With the map's bot hints, MapMaker's: extra candidates on top of the computed spots; bots/hints.ts.)
    this.director ??= new BotDirector(this.seed, regionLayout(places), places, (a, b) => this.physics.lineOfSight(a, b), mapBotHints(this.map));
    const roles = assignRoles(
      bots.map((c) => ({ slot: c.slot, profile: c.bot!.profile })),
      this.rules.botStyle ?? 'mixed',
      this.seed,
    );
    // Fireteams: every bot plays in its squad (no lone campers or snipers wandering off from it).
    if (this.fireteams) for (const k of roles.keys()) roles.set(k, 'squad');
    for (const [slot, role] of roles) this.director.setRole(slot, role);
    // Bots that spawned this tick, before their roles were known: a sniper takes the weapon set's scoped gun now.
    for (const c of bots) this.rearmForRole(c);
    // The common trips' corridors, here at setup rather than in a tick (a few ms each).
    this.botTrips();
    if (!this.director.vantage && [...roles.values()].some((r) => r === 'camper' || r === 'sniper')) {
      // (With the roofs and ledges only parkour reaches, nav/parkour.ts: snipers' spots others don't go to.)
      const ray = (o: Vec3, d: Vec3, max: number) => this.physics.raycastWorld(o, d, max);
      this.director.vantage = new VantageBoard(withHintSpots(vantageFor(places, ray, this.nav.parkourPlaces()), hintSpots(this.director.hints, ray)));
      // Snipers' spots are worth more the better they look down the ways the enemy comes (the trips' corridors).
      this.director.vantage.lanes(
        this.botTrips().flatMap((t) => t.trip.corridors.map((c) => c.line)),
        (a, b) => this.physics.lineOfSight(a, b),
      );
      for (const c of bots) this.director.planFor(c.slot).vantage = this.director.vantage;
    }
  }

  /**
   * The director's low-rate pass (once a second per side, sides staggered):
   * each team's region knowledge, and squads in big team matches without an
   * objective mode (objective modes send bots where the objective is).
   */
  private directBots(actors: readonly Combatant[]): void {
    const d = this.director;
    const teams = this.teams;
    if (!d || !teams) return;
    const ft = this.fireteams;
    const squads = (actors.length >= CLUSTER_MIN_PLAYERS || !!ft) && !this.mode && this.rules.mode !== 'core.coop' && this.rules.mode !== 'core.zombies';
    const trips = this.botTrips();
    const all = trips.map((x) => x.trip);
    teams.forEach((t, i) => {
      if ((this.tick + i * 29) % TICK_RATE !== 0) return;
      // What the mode says about the side (its attackers' objective, an enemy to cut off) for the team brain.
      const brief = this.mode?.botBrief?.(t.id) ?? null;
      const everyone: Vec3[] = [];
      const members: DirectorMember[] = [];
      for (const c of actors) {
        if (c.faction !== t.id || !c.alive) continue;
        everyone.push(c.move.pos);
        if (!c.bot || c.npc || c.kind !== 'bot') continue;
        const fighting = c.bot.target !== null;
        const seen = c.bot.lastSeen;
        const ordered = !!c.order && this.tick <= c.order.until;
        // Fireteams: a member follows its squad (the team brain plans for its bot leader only); no squads by proximity.
        const team = ft?.squadOf(c.slot);
        const follower = !!team && team.leader !== c.slot;
        members.push({
          slot: c.slot,
          pos: c.move.pos,
          fighting,
          enemyAt: fighting && seen ? seen.pos : null,
          free: !team && !c.mount && !c.order && !c.botSet?.squad && d.planFor(c.slot).role === 'squad',
          teamLeader: this.isLeader(c),
          profile: c.bot.profile,
          // (The mode's goal only when the mode briefs the side: the team brain's groups are made of its attackers.)
          goal: brief && !ordered && !follower ? (this.mode?.botGoal(c, []) ?? null) : null,
          corridor: c.bot.corridor,
          ordered: ordered || !!c.botSet?.squad || follower,
          mounted: !!c.mount,
          seen: seen && this.tick - seen.tick < TICK_RATE * 1.5 ? seen.pos : null,
          // (Fireteams: a bot-led squad's member plays its leader's play: the same group, corridor and staging.)
          ...(follower && team && !team.human && team.leader !== null ? { unit: team.leader } : {}),
        });
      }
      const towards = this.spawnPoints.filter((s) => s.team !== null && s.team !== t.id && !s.generated).map((s) => s.pos);
      const own = trips.filter((x) => x.team === t.id).map((x) => x.trip);
      // Fireteams: its bot-led squads as the director's (fixed) squads, leader first, the members alive.
      const fixed = ft ? ft.teamSquads(t.id).filter((q) => !q.human && q.leader !== null).map((q) => [q.leader!, ...q.members.filter((m) => m !== q.leader && this.slots[m]?.alive)]) : null;
      d.update(this.tick, t.id, everyone, members, towards.length ? towards : null, squads, (slot, at) => this.slots[slot]?.bot?.alert(at, this.tick), brief, own, all, fixed);
    });
  }

  /** The team brain's own goal for a bot (an interceptor's cut-off point), if it has one. */
  private jobGoal(c: Combatant): { pos: Vec3; radius: number } | null {
    if (c.kind !== 'bot' || !this.director) return null;
    return this.director.planFor(c.slot).job?.goal ?? null;
  }

  /** Where a bot is told to go (squad orders, teammates' orders, co-op and mode goals), or null to roam. */
  private botGoal(c: Combatant, hostiles: Combatant[], zombies: boolean, coop: boolean): { pos: Vec3; radius: number } | null {
    const g = this.botGoalOf(c, hostiles, zombies, coop);
    return this.fireteams && c.bot && c.kind === 'bot' ? this.fireteamPlayGoal(c, g) : g;
  }

  private botGoalOf(c: Combatant, hostiles: Combatant[], zombies: boolean, coop: boolean): { pos: Vec3; radius: number } | null {
    const npc = c.npc;
    if (npc) return npc.role === 'zombie' ? this.nearestGoal(c, hostiles, 1.5) : this.encounters.goalFor(c.slot);
    // Fireteams: a squad member does what its squad was told (its leader's order, following its leader), unless it
    // carries the objective (a flag, the bomb: what keeps a carrier out of vehicles), which it takes where it goes.
    const told = this.fireteamGoal(c);
    if (told && !this.mode?.blocksVehicle(c)) return told;
    const order = this.teammateOrder(c);
    if (order) return order;
    const squad = this.squadGoal(c);
    if (squad !== undefined) return squad;
    // The team brain's job for it (an interceptor cutting off our flag's carrier), over the mode's goal.
    const job = this.jobGoal(c);
    if (job) return job;
    const goal = zombies ? this.holdOutGoal(c, hostiles) : coop ? this.coopGoal(c, hostiles) : this.classGoal(c, this.mode?.botGoal(c, hostiles) ?? null);
    // A squad's leader: its followers go where it goes.
    if (c.botSet?.squad) this.leadGoals.set(c.slot, goal);
    return goal;
  }

  /** Squads of the host's bot set: "side|label" -> the leader's slot (the first of them alive), rebuilt once a tick. */
  private squadLeads: { tick: number; lead: Map<string, number> } | null = null;
  /** Each squad leader's own goal when it last thought (null: roaming). */
  private readonly leadGoals = new Map<number, { pos: Vec3; radius: number } | null>();

  private squadKey(c: Combatant): string | null {
    const label = c.botSet?.squad;
    // Squads only make sense with a side: team modes and co-op (in a free-for-all everyone is an enemy).
    if (!label || c.kind !== 'bot' || c.away || c.faction === null) return null;
    return `${c.faction}|${label.toLowerCase()}`;
  }

  /**
   * A bot in a squad of the host's set that isn't its leader: back to the leader when it strays (more than
   * SQUAD_STRAY m), else the leader's own goal, else (the leader roaming) close by the leader. Undefined: not
   * a follower (no squad, or it leads), so its own goals apply.
   */
  private squadGoal(c: Combatant): { pos: Vec3; radius: number } | null | undefined {
    const key = this.squadKey(c);
    if (!key) return undefined;
    if (this.squadLeads?.tick !== this.tick) {
      const lead = new Map<string, number>();
      for (const x of this.combatants()) {
        const k = x.alive ? this.squadKey(x) : null;
        if (k && !lead.has(k)) lead.set(k, x.slot);
      }
      this.squadLeads = { tick: this.tick, lead };
    }
    const slot = this.squadLeads.lead.get(key);
    const leader = slot === undefined ? undefined : this.slots[slot];
    if (!leader || leader === c || !leader.alive) return undefined;
    if (horizontalDistance(c.move.pos, leader.move.pos) > SQUAD_STRAY) return { pos: leader.move.pos, radius: 5 };
    return this.leadGoals.get(leader.slot) ?? { pos: leader.move.pos, radius: 6 };
  }

  private gridFor(i: number, list: readonly CombatantView[]): ViewGrid {
    const g = this.grids[i] ?? (this.grids[i] = new ViewGrid());
    return g.reset(list);
  }

  /** The bot's weapons as it sees them: the same objects tick to tick, refreshed (no allocation per bot a tick). */
  private inventoryOf(c: Combatant): InventoryView[] {
    let list = this.botInventory.get(c.slot);
    if (!list) this.botInventory.set(c.slot, (list = []));
    let i = 0;
    for (const w of c.weapons.values()) {
      const v = list[i];
      if (v) {
        v.def = w.def;
        v.mag = w.mag;
        v.reserve = w.reserve;
        v.alt = w.alt;
      } else list[i] = { def: w.def, mag: w.mag, reserve: w.reserve, alt: w.alt };
      i++;
    }
    list.length = i;
    return list;
  }

  private readonly botInventory = new Map<number, InventoryView[]>();

  /**
   * Think budget: up to BOT_FULL_RATE thinking bots (Player Bots and awake
   * NPCs) all think every tick; past that, bots think in full on one tick in
   * BOT_THINK_EVERY (20 Hz), steering (fighting) or coasting (not) in between.
   */
  private botBudget(actors: readonly Combatant[]): number {
    let n = 0;
    for (const c of actors) if (c.bot && c.alive) n++;
    return n > BOT_FULL_RATE ? BOT_THINK_EVERY : 1;
  }

  /**
   * Between its thinks, a bot that is alive, on foot, not fighting and not
   * under fire repeats the move it thought out last (without one-shot buttons).
   * `force` (over the think budget): a fighting bot too. Returns false when it
   * should think now.
   */
  private coastBot(c: Combatant, every: number, force = false): boolean {
    if (!c.alive || c.mount) return false;
    if (!force && (c.bot!.target !== null || (c.shotAt && this.tick - c.shotAt.tick <= every))) return false;
    const last = this.botThought.get(c.slot);
    if (!last || this.tick - last.tick >= every) return false;
    // Field by field (no rest/spread copy: two bots in three coast on any tick of a big match).
    const i = last.input;
    // (A fighting bot put off by the think budget keeps its finger on the trigger for that tick.)
    const next: PlayerInput = { seq: c.lastSeq + 1, forward: i.forward, right: i.right, yaw: i.yaw, pitch: i.pitch, buttons: i.buttons & (force ? COAST_BUTTONS | BUTTON_FIRE : COAST_BUTTONS) };
    if (i.viewTick !== undefined) next.viewTick = i.viewTick;
    if (i.rc) next.rc = i.rc;
    c.queue.push(next);
    return true;
  }

  /**
   * Sentries that would shoot this bot, close enough to matter, as targets it
   * can shoot back at (they can be destroyed). Seen as a prone figure so the
   * bot aims at the gun's body, not over it.
   */
  private hostileSentries(c: Combatant): CombatantView[] {
    const out: CombatantView[] = [];
    for (const m of this.mounts) {
      const spec = m.def.sentry;
      if (!spec || !m.alive || m.builtBy === c.slot) continue;
      if (m.faction !== null && relation(this.factions, m.faction, c.faction) !== 'enemy') continue;
      if (horizontalDistance(m.pos, c.move.pos) > spec.range + 10) continue;
      out.push({ slot: SENTRY_VIEW_BASE + m.index, pos: m.pos, yaw: m.aimYaw, pitch: 0, health: Math.max(0, m.health), armor: 0, alive: true, stance: 2, human: false, mounted: false, grounded: true, object: true, concealed: false, size: 1 });
    }
    return out;
  }

  /** Is vehicle `m` on or over water (or another liquid): afloat, its feet in it, or (a flyer) water under it? */
  private overWater(m: MountRt): boolean {
    if (m.afloat || liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y + 0.2, z: m.pos.z }) || liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y - 0.5, z: m.pos.z })) return true;
    if (!m.def.vehicle?.fly) return false;
    const hit = this.physics.raycastHit({ x: m.pos.x, y: m.pos.y - 0.05, z: m.pos.z }, { x: 0, y: -1, z: 0 }, 60);
    const below = hit ? m.pos.y - 0.05 - hit.dist : m.pos.y - 60;
    // The first liquid between it and the ground under it.
    for (let y = m.pos.y - 0.5; y > below; y -= 1) if (liquidAt(this.liquids, { x: m.pos.x, y, z: m.pos.z })) return true;
    return false;
  }

  /** Turrets and vehicles as bots see them (built once per tick). */
  private mountViews(actors: readonly Combatant[]): MountView[] {
    const humans = actors.filter((a) => a.kind === 'human' && a.alive);
    return this.mounts.map((m) => ({
      index: m.index,
      kind: m.def.kind,
      pos: m.pos,
      yaw: m.yaw,
      health: Math.max(0, m.health) / m.def.health,
      alive: m.alive,
      enterRadius: m.def.enterRadius,
      seats: m.def.seats.map((s, i) => ({ role: s.role, free: m.seats[i] === null, ...(m.seats[i] !== null ? { by: m.seats[i]! } : {}), ...(s.weapon ? { weapon: getWeapon(s.weapon) } : {}), ...(s.arc !== undefined ? { arc: s.arc } : {}), ...(s.facing ? { facing: s.facing } : {}), ...(s.ammo && m.guns[i]?.shells !== undefined ? { shells: m.guns[i]!.shells, maxShells: s.ammo.max, ...(s.ammo.pickups ? { refills: s.ammo.pickups } : {}) } : {}) })),
      ...(m.def.vehicle ? { maxSpeed: m.def.vehicle.maxSpeed, speed: Math.abs(m.speed) } : {}),
      ...(m.def.vehicle && m.speed < -0.5 ? { reversing: true } : {}),
      ...(m.burning ? { burning: true } : {}),
      ...(!m.alive && m.wreckUntil > this.tick ? { wreck: true } : {}),
      ...(m.floats ? { floats: true } : {}),
      ...(m.wedged ? { wedged: true } : {}),
      ...(m.def.armour?.sealed ? { sealed: true } : {}),
      ...(m.def.armour && (m.def.armour.bullets ?? 1) < 0.5 ? { armoured: true } : {}),
      ...(m.def.bailHealth !== undefined ? { bailHealth: m.def.bailHealth } : {}),
      ...(m.def.vehicle?.pivot ? { pivots: true } : {}),
      ...(m.def.vehicle && this.liquids.length && this.overWater(m) ? { overWater: true } : {}),
      ...(m.def.vehicle && !m.def.vehicle.fly ? { routeHalfWidth: Math.min(m.def.half[0], m.def.half[2]) * (m.def.vehicle.routeFit ?? ROUTE_FIT) } : {}),
      half: m.def.half,
      humanNear: humans.some((h) => horizontalDistance(h.move.pos, m.pos) < 35),
    }));
  }

  private seatView(c: Combatant): SeatView | null {
    const m = this.mounts[c.mount!.index];
    const seat = m?.def.seats[c.mount!.seat];
    if (!m || !seat) return null;
    // The gun it fires: its seat's, or (a driver, driverFires) the empty gunner seat's, with that seat's arc.
    const gs = this.gunSeatOf(c);
    const gun = gs === null ? null : m.guns[gs];
    const aim = gs === null ? seat : m.def.seats[gs]!;
    // (A driver working the seat's gun has their own arc there: SeatDef.driverArc.)
    const arc = gs !== null && gs !== c.mount!.seat ? (aim.driverArc ?? aim.arc) : aim.arc;
    const ammo = gs === null ? undefined : m.def.seats[gs]!.ammo;
    return { mount: m.index, seat: c.mount!.seat, role: seat.role, ...(seat.role !== 'driver' && !seat.seated && !m.def.airplane ? { ducks: true } : {}), ...(gun ? { weapon: gun.def } : {}), ...(arc !== undefined ? { arc } : {}), ...(aim.facing ? { facing: aim.facing } : {}), heat: gun?.heat ?? 0, overheated: gun?.overheated ?? false, ...(gun?.shells !== undefined && ammo ? { shells: gun.shells, maxShells: ammo.max, ...(ammo.pickups ? { refills: ammo.pickups } : {}) } : {}) };
  }

  /**
   * What bots hear and feel this tick: gunfire and explosions become noises
   * (kept for a second), and shots passing close to (or hitting) someone mark
   * them as under fire, with where it came from.
   */
  private noteCombat(events: readonly GameEvent[]): void {
    this.noises = this.noises.filter((n) => this.tick - n.tick < TICK_RATE);
    let actors: Combatant[] | undefined;
    for (const ev of events) {
      if (ev.e === 'explode') this.noises.push({ pos: { x: ev.p[0], y: ev.p[1], z: ev.p[2] }, tick: this.tick, by: ev.s, range: 60 });
      if (ev.e === 'impact') {
        // A bullet that flew a while: a near miss (or a hit) still sends bots into cover.
        const shooter = this.actor(ev.s);
        const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
        const to = { x: ev.to[0], y: ev.to[1], z: ev.to[2] };
        if (shooter) for (const c of (actors ??= this.actors())) if (c.bot && c.alive && this.hostile(shooter, c) && (ev.hit === c.slot || segmentDistance(c.move.pos, from, to, CHEST) < 1.6)) c.shotAt = { tick: this.tick, from };
        continue;
      }
      if (ev.e !== 'shot' || ev.s < 0) continue;
      const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
      this.noises.push({ pos: from, tick: this.tick, by: ev.s, range: 45 });
      this.lastShot.set(ev.s, this.tick);
      const shooter = this.actor(ev.s);
      const end = ev.to[0];
      if (!shooter || !end) continue;
      const to = { x: end[0], y: end[1], z: end[2] };
      for (const c of (actors ??= this.actors())) {
        if (!c.bot || !c.alive || !this.hostile(shooter, c)) continue;
        if (ev.hit.includes(c.slot) || segmentDistance(c.move.pos, from, to, CHEST) < 1.6) c.shotAt = { tick: this.tick, from };
      }
    }
    if (this.noises.length > 48) this.noises.splice(0, this.noises.length - 48);
  }

  /**
   * Co-op Player Bots head for the nearest enemy they know of (the mission's
   * NPCs), or stay near a human when there is nothing to fight.
   */
  /** The nearest of `among` (a zombie's prey), as a goal. */
  private nearestGoal(c: Combatant, among: readonly Combatant[], radius: number): { pos: Vec3; radius: number } | null {
    let best: Vec3 | null = null;
    let bestD = Infinity;
    for (const h of among) {
      const d = horizontalDistance(h.move.pos, c.move.pos) + Math.abs(h.move.pos.y - c.move.pos.y) * 2;
      if (d < bestD) {
        bestD = d;
        best = h.move.pos;
      }
    }
    return best ? { pos: best, radius } : null;
  }

  /** Zombies: Player Bots stay with the humans and let the horde come to them; alone, they go hunting. */
  private holdOutGoal(c: Combatant, hostiles: Combatant[]): { pos: Vec3; radius: number } | null {
    const human = this.nearestGoal(c, this.combatants().filter((o) => o.kind === 'human' && o.alive), 5);
    return human ?? this.nearestGoal(c, hostiles, 3);
  }

  private coopGoal(c: Combatant, hostiles: Combatant[]): { pos: Vec3; radius: number } | null {
    let best: Vec3 | null = null;
    let bestD = Infinity;
    for (const h of hostiles) {
      const d = horizontalDistance(h.move.pos, c.move.pos) + Math.abs(h.move.pos.y - c.move.pos.y) * 2;
      if (d < bestD) {
        bestD = d;
        best = h.move.pos;
      }
    }
    // Close right in: line of sight is what starts the fight, not distance.
    if (best) return { pos: best, radius: 2 };
    const human = this.combatants().find((o) => o.kind === 'human' && o.alive);
    return human ? { pos: human.move.pos, radius: 4 } : null;
  }

  /** Classes: Medics follow patients, Mechanics hold their sentry; others keep the mode's goal. */
  private classGoal(c: Combatant, goal: { pos: Vec3; radius: number } | null): { pos: Vec3; radius: number } | null {
    return this.classes ? this.classes.botGoal(c, goal) : goal;
  }

  /** Disc Arena: a bot sidesteps and hops an enemy disc about to hit it, and never walks off the edge. */
  private dodgeDiscs(c: Combatant, input: PlayerInput): void {
    const floorAt = (p: Vec3) => this.physics.raycastHit({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }, 6) !== null;
    const discs = this.projectiles.filter((p) => p.spec.disc && p.owner !== c.slot && !p.stuck).map((p) => ({ pos: p.pos, vel: p.vel, owner: this.actor(p.owner) }));
    const threats = discs.filter((d) => !d.owner || this.hostile(d.owner, c));
    if (threats.length && dodgeDisc(input, { pos: c.move.pos, yaw: input.yaw, grounded: c.move.grounded }, threats, floorAt)) return;
    keepOnDeck(input, { ...c.move, padFlight: !!c.padFlight }, floorAt);
  }

  /** Where a teammate told this bot to be ("Follow me!" / "Hold here!"), while the order lasts. */
  /** Team leaders (rules.leaders): team ID -> leader slot. */
  private readonly leaderOf = new Map<string, number>();
  /** Leader variant: points each team earned by downing enemy leaders. */
  private readonly leaderBounty = new Map<string, number>();

  /** Whether `c` leads their team (rules.leaders). */
  isLeader(c: Combatant): boolean {
    return !!this.rules.leaders && !!c.faction && this.leaderOf.get(c.faction) === c.slot && this.slots[c.slot] === c;
  }

  /** Each team's leader slot, in team order (-1: nobody on the team). */
  leaders(): number[] {
    return (this.teams ?? []).map((t) => this.leaderOf.get(t.id) ?? -1);
  }

  /**
   * Keep a leader on every team: a person leads ahead of a bot (the first to
   * join, by slot); the leader keeps the job until they leave, or until a
   * person joins a team a bot was leading. A player who takes over the
   * leading bot (same slot) leads straight away.
   */
  private updateLeaders(): void {
    for (const t of this.teams!) {
      const cur = this.leaderOf.get(t.id);
      const c = cur === undefined ? null : this.slots[cur];
      const onTeam = c && c.faction === t.id ? c : null;
      if (onTeam?.kind === 'human') continue;
      const members = this.combatants().filter((m) => m.faction === t.id);
      const next = members.find((m) => m.kind === 'human') ?? onTeam ?? members[0];
      if (!next) {
        this.leaderOf.delete(t.id);
        continue;
      }
      if (next === onTeam) continue;
      this.leaderOf.set(t.id, next.slot);
      this.pendingEvents.push({ e: 'leader', a: 'lead', s: next.slot, team: t.id });
    }
  }

  /** A leader went down: the Leader variant pays the side that did it. */
  private leaderDown(victim: Combatant, killer: Combatant | null): void {
    const team = victim.faction!;
    const scorer = killer && killer !== victim && killer.faction && this.hostile(killer, victim) ? killer.faction : null;
    const n = this.rules.leaders === 'vip' && scorer && !this.mode ? LEADER_BOUNTY : 0;
    if (n && scorer) this.leaderBounty.set(scorer, (this.leaderBounty.get(scorer) ?? 0) + n);
    this.pendingEvents.push({ e: 'leader', a: 'down', s: victim.slot, team, ...(n ? { n } : {}) });
  }

  private teammateOrder(c: Combatant): OrderGoal | null {
    const o = c.order;
    if (!o || this.tick > o.until) return null;
    // (A person's order: it wins over pickups, noises and chases in the bot's choices; it still fights what it sees.)
    if (o.kind === 'hold') return { pos: o.pos, radius: 3, order: true };
    const leader = this.actor(o.leader);
    if (!leader?.alive) {
      c.order = undefined;
      return null;
    }
    return { pos: leader.move.pos, radius: 4, order: true };
  }

  // ------------------------------------------------------------------ Fireteams (sim/fireteams.ts)

  /** Fireteams: every team's fixed squads (null: the variant is off). */
  fireteams: Fireteams | null = null;
  /** The roster changed since the squads were last brought in line with it. */
  private squadsDirty = true;
  private squadsAt = -Infinity;

  /** Once a tick: the squads kept in line with the roster (when it changed, and every 2 s), and their orders a few times a second. */
  private stepFireteams(): void {
    const size = this.rules.fireteams;
    if (!size || !this.teams || !fireteamMode(this.rules.mode)) {
      if (this.fireteams) {
        // The variant went off: campers, snipers and lone wolves get their roles back.
        this.fireteams = null;
        this.rolesFor = -1;
        this.refreshRoles();
      }
      return;
    }
    if (!this.fireteams || this.fireteams.size !== size) {
      this.fireteams = new Fireteams(size);
      this.squadsDirty = true;
      // Every bot plays in its squad from here on (refreshRoles: no campers, snipers or lone wolves). The roles were
      // handed out as the bots joined, before the first tick made the squads: without handing them out again here,
      // a camper or sniper leading a squad took it to a vantage spot and sat there with it, and a lone wolf led its
      // squad away from the fight (owner, 2026-11-12: squads standing about until their leader was shot).
      this.rolesFor = -1;
      this.refreshRoles();
    }
    const ft = this.fireteams;
    if (this.squadsDirty || this.tick - this.squadsAt >= TICK_RATE * 2) {
      this.squadsDirty = false;
      this.squadsAt = this.tick;
      const roster = this.combatants().map((c) => ({ slot: c.slot, team: c.faction, human: c.kind === 'human', lead: c.bot ? leadAbility(c.bot.profile) : 0, pos: c.move.pos }));
      this.squadNotes(ft.sync(roster, this.tick));
    }
    // Objective first (Part 2): the mode gives a bot-led squad one role for all of it (CTF: attack or defend together).
    // (Follow-ups: every squad by size, people's too, so CTF's smallest of 4+ squads defends: ModeLogic.squadRole.)
    this.mode?.botUnits?.(this.squadUnit, this.squadInfo);
    if (this.phase === 'playing' && this.tick % 6 === 0) this.squadNotes(ft.step(this.tick, this.squadWorld));
    // Squad scores (Part 3): objective plays as they're counted, and King of the Hill's seconds on the hill.
    if (this.phase === 'playing' && this.tick % 6 === 0) this.tallySquads(this.tick % TICK_RATE === 0);
    // A bot leader in a fight: its members not in one are told where its enemy is (once a second, squads staggered).
    if (this.phase === 'playing') {
      for (const s of ft.squads) {
        if (s.human || s.leader === null || (this.tick + s.id * 7) % TICK_RATE !== 0) continue;
        const l = this.slots[s.leader];
        const seen = l?.alive && l.bot && l.bot.target !== null ? l.bot.lastSeen : null;
        if (!seen) continue;
        for (const m of s.members) {
          const b = this.slots[m];
          if (b && b !== l && b.alive && b.bot && b.bot.target === null && horizontalDistance(b.move.pos, l!.move.pos) < SQUAD_ALERT) b.bot.alert(seen.pos, this.tick);
        }
      }
    }
  }

  /** Fireteams: the squad a slot is in now (its id), for the squad scores. */
  private readonly squadIdOf = (slot: number): number | undefined => this.fireteams?.squadOf(slot)?.id;

  /**
   * Squad scores (sim/squadScores.ts): each player's objective plays since last counted (the scoreboard's objective
   * column, however the mode credits it) go to them and their squad; `second`: King of the Hill's second on the hill
   * for every living player of the team alone holding it.
   */
  private tallySquads(second: boolean): void {
    const ft = this.fireteams;
    if (!ft) return;
    for (const c of this.combatants()) ft.scores.objectives(c.slot, c.objective, ft.squadOf(c.slot)?.id);
    const koth = second && this.mode instanceof KothMode ? this.mode : null;
    if (!koth || !koth.holder || koth.holder === 'contested') return;
    for (const c of this.combatants()) if (c.alive && c.faction === koth.holder && onHill(koth.hill, c.move.pos)) ft.scores.hill(c.slot, ft.squadOf(c.slot)?.id);
  }

  /** Fireteams: a bot's unit for the mode's roles (its bot-led squad's id; null: in a person's squad; undefined: none). */
  private readonly squadUnit = (slot: number): number | null | undefined => {
    const s = this.fireteams?.squadOf(slot);
    return s ? (s.human ? null : s.id) : undefined;
  };

  /** Fireteams follow-ups: any slot's squad for the mode's squad roles (its id, a person leads it, they've given it an order). */
  private readonly squadInfo = (slot: number): { id: number; human: boolean; ordered: boolean } | undefined => {
    const s = this.fireteams?.squadOf(slot);
    return s ? { id: s.id, human: s.human, ordered: s.ordered } : undefined;
  };

  /**
   * Fireteams follow-ups: a person's squad plays its mode role by itself (CTF: Defend, the smallest of 4+ squads) until
   * the person gives it an order; meanwhile its bots play the role as a bot-led squad's do (ctfBotGoal's defend: round
   * our flag's base, to our dropped flag, after its carrier).
   */
  private roleDefault(s: { id: number; human: boolean; ordered: boolean }): boolean {
    return s.human && !s.ordered && this.mode?.squadRole?.(s.id) === 'defend';
  }

  /** What the squads' step reads of the match (formations: sight lines at chest height, the walkable ground). */
  private readonly squadWorld = {
    member: (slot: number) => {
      const c = this.slots[slot];
      return c ? { alive: c.alive, pos: c.move.pos, yaw: c.yaw, carrying: !!this.mode?.blocksVehicle(c) } : null;
    },
    target: (slot: number) => {
      const c = this.actor(slot);
      return c?.alive ? c.move.pos : null;
    },
    clear: (a: Vec3, b: Vec3) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (d < 1e-3) return 0;
      const hit = this.physics.raycastWorld(a, { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d }, d);
      return hit === null ? d : hit;
    },
    ground: (p: Vec3) => this.nav.closestPoint(p, SPOT_GROUND),
  };

  /** The squads' news as events: a new leader, an order (the match's own, as a squad forms up or an order ends). */
  private squadNotes(notes: readonly SquadNote[]): void {
    for (const n of notes) {
      const sq = n.squad;
      if (n.a === 'lead') this.pendingEvents.push({ e: 'squad', a: 'lead', s: n.slot, sq: sq.id, n: sq.members.length, ...(n.human ? { h: 1 as const } : {}), ...(n.from !== null ? { from: n.from } : {}), team: sq.team });
      else if (sq.leader !== null) this.pendingEvents.push({ e: 'squad', a: 'order', s: sq.leader, sq: sq.id, k: ORDER_KINDS.indexOf(n.order.kind), ...(n.order.auto ? { auto: 1 as const } : {}), team: sq.team });
    }
  }

  /**
   * A leader's order from the wheel (or the B menu's Follow me / Hold here): checked (sim/fireteams.ts checkOrder:
   * only a person leading a squad, alive; Go there their fresh ping or the point they aim at; Attack that the enemy in
   * their sights or their fresh ping's; Defend the objective the mode's nearest), then given to the squad, and the
   * first member alive answers (the callout). A refused order tells the leader why.
   */
  private squadOrder(c: Combatant, kind: OrderKind): void {
    const ft = this.fireteams;
    if (!ft || !c.faction) return;
    const s = ft.ledBy(c.slot);
    const aim = c.alive ? this.aimAt(c) : null;
    const lp = c.lastPing;
    // (A ping's enemy counts while it is still alive and an enemy.)
    const pinged = lp?.target != null ? this.actor(lp.target) : null;
    const ping = lp ? { pos: lp.pos, target: pinged?.alive && this.hostile(c, pinged) ? pinged.slot : null, age: (this.tick - lp.tick) / TICK_RATE } : null;
    const r = checkOrder(kind, {
      leads: !!s?.human,
      alive: c.alive,
      pos: c.move.pos,
      aim: aim?.at ?? null,
      aimEnemy: aim?.target?.alive && this.hostile(c, aim.target) ? aim.target.slot : null,
      ping: ping && (lp!.target === null || ping.target !== null) ? ping : null,
      objective: kind === 'defend' ? this.squadObjective(c.faction, c.move.pos) : null,
    });
    if (!r.ok || !s) {
      this.pendingEvents.push({ e: 'squad', a: 'deny', s: c.slot, n: REFUSALS.indexOf(r.ok ? 'notLeader' : r.why), team: c.faction });
      return;
    }
    ft.order(s, kind, r.pos, r.target, this.tick);
    const k = ORDER_KINDS.indexOf(kind);
    // (Spread out / Stay tight: what the spacing is now, SQUAD_SPACINGS index.)
    const sp = kind === 'spacing' ? { n: SQUAD_SPACINGS.indexOf(s.spacing) } : {};
    this.pendingEvents.push({ e: 'squad', a: 'order', s: c.slot, sq: s.id, k, ...sp, team: s.team });
    // The first member alive answers; an attack tells everyone where the enemy is.
    const target = r.target !== null ? this.actor(r.target) : null;
    let answered = false;
    for (const m of s.members) {
      const b = this.slots[m];
      if (!b || b === c || !b.alive || b.kind !== 'bot') continue;
      if (!answered) {
        answered = true;
        this.pendingEvents.push({ e: 'squad', a: 'ack', s: b.slot, sq: s.id, k, ...sp, team: s.team });
      }
      if (target) b.bot?.alert(target.move.pos, this.tick);
    }
  }

  /**
   * The objective a squad defends: the mode's own for the side, nearest the leader (ModeLogic.defendSpot: the hill in
   * play, the sector's objectives, our flag), else the nearest end of the side's trips to hold (the sites, the
   * hostages), else any trip's end (the site to plant at); null in Team Deathmatch.
   */
  squadObjective(team: string, near: Vec3): Vec3 | null {
    const own = this.mode?.defendSpot?.(team, near);
    if (own !== undefined) return own;
    const trips = this.botTrips().filter((t) => t.team === team && t.kind !== 'carry');
    const pick = (list: typeof trips): Vec3 | null => {
      let best: Vec3 | null = null;
      for (const t of list) if (!best || horizontalDistance(t.to, near) < horizontalDistance(best, near)) best = t.to;
      return best;
    };
    return pick(trips.filter((t) => t.kind === 'defend')) ?? pick(trips);
  }

  /** Fireteams: where a squad member goes (its squad's order; its leader's way), or null (not a member: its own goals). */
  private fireteamGoal(c: Combatant): OrderGoal | null {
    const s = c.kind === 'bot' ? this.fireteams?.squadOf(c.slot) : undefined;
    if (!s || s.leader === null || s.leader === c.slot) return null;
    // (A person's squad on its mode role's default, Defend, until they give an order: its bots play the role.)
    if (this.roleDefault(s)) return null;
    const leader = this.slots[s.leader];
    const t = s.order.kind === 'attack' && s.order.target !== null ? this.actor(s.order.target) : null;
    // (Following the squad's anchor: the leader's position, moved on every few metres, so routes aren't asked afresh
    // every think.)
    return memberGoal(s, c.slot, leader?.alive ? (s.anchor ?? leader.move.pos) : null, t?.alive ? t.move.pos : null, { me: c.move.pos, tick: this.tick });
  }

  /**
   * Fireteams (Part 2): a bot-led squad playing its play (the mode's goal, the leader's team-brain job) bounds by its
   * halves while it is on the move (the leader and every other member, then the rest: `OrderGoal.half`), so one half
   * covers, firing at where the enemy went, while the other moves up. Any other bot: as it was.
   */
  private fireteamPlayGoal(c: Combatant, g: { pos: Vec3; radius: number } | null): { pos: Vec3; radius: number } | null {
    const s = this.fireteams!.squadOf(c.slot);
    if (!s || s.human || !g || this.tick >= s.movingUntil || !(g as OrderGoal).push || (g as OrderGoal).half !== undefined) return g;
    return { ...g, half: squadHalf(s, c.slot) } as OrderGoal;
  }

  /**
   * Fireteams: a squadmate respawns beside its leader when it's safe there (spawns.ts leaderSpotSafe: no enemy within
   * 20 m, no fresh deaths, out of sight of the nearest enemies; the leader on foot on the ground, not hurt lately, and
   * where the mode allows a squad spawn), else (null) at the team's spawn. Undefined: not a squadmate (the usual rule).
   */
  private fireteamSpawn(c: Combatant): { pos: Vec3; yaw: number } | null | undefined {
    const s = c.kind === 'npc' ? undefined : this.fireteams?.squadOf(c.slot);
    if (!s || s.leader === null || s.leader === c.slot) return undefined;
    const l = this.slots[s.leader];
    if (!l?.alive || l.mount || !l.move.grounded || this.tick - (l.hurtAt ?? -Infinity) < TICK_RATE * 4) return null;
    if (this.mode?.spawnBeside?.(c, l) === false) return null;
    const enemies: Vec3[] = [];
    for (const o of this.actors()) if (o.alive && this.hostile(c, o)) enemies.push(o.move.pos);
    if (!leaderSpotSafe(l.move.pos, { tick: this.tick, enemies, deaths: this.recentDeaths, sees: (a, b) => this.sees(a, b) })) return null;
    return this.besideMate(l);
  }

  private applyInputs(c: Combatant): void {
    const n = Math.min(MAX_INPUTS_PER_TICK, c.queue.length);
    for (let i = 0; i < n; i++) {
      const input = c.queue.shift()!;
      c.lastSeq = input.seq;
      c.yaw = input.yaw;
      c.pitch = input.pitch;
      // The class screen (Classes): works while you're down too.
      const pick = this.classes && !c.npc ? classFromSay(input.say) : null;
      if (pick) {
        this.classes!.choose(c, pick);
        input.say = undefined;
      }
      // Roulette's death screen: a streak pick's card, or a reroll token spent (checked by the director).
      if (this.roulette?.input(c, input.say)) input.say = undefined;
      if (!c.alive) continue;
      // Firing, throwing or striking drops spawn protection at once.
      if (c.shieldUntil && input.buttons & (BUTTON_FIRE | BUTTON_ALT | BUTTON_THROW | BUTTON_MELEE)) c.shieldUntil = 0;
      // The player pulling against the recoil (the client reports how much of its mouse movement countered it).
      if (input.rc) counterRecoil(c.gun, input.rc[0], input.rc[1]);
      // Fireteams: an order from the wheel (checked here: only a squad's leader, alive, with what it needs).
      const ordered = orderFromSay(input.say);
      if (ordered) {
        if (!c.npc && this.tick >= (c.orderAt ?? 0)) {
          c.orderAt = this.tick + Math.round(TICK_RATE * 0.3);
          this.squadOrder(c, ordered);
        }
        input.say = undefined;
      }
      if (input.say === PING && !c.npc && this.tick >= (c.pingAt ?? 0)) {
        c.pingAt = this.tick + Math.round(TICK_RATE * 0.75);
        this.ping(c);
      } else if (input.say && !c.npc && this.tick >= (c.sayAt ?? 0)) {
        c.sayAt = this.tick + TICK_RATE;
        // Follow / hold orders reach your team's bots even with the pop-ups turned off.
        // (Fireteams: they order the leader's own squad.)
        if (input.say === SAY_FOLLOW || input.say === SAY_HOLD) {
          if (this.fireteams?.ledBy(c.slot)) this.squadOrder(c, input.say === SAY_FOLLOW ? 'follow' : 'hold');
          else this.orderBots(c, input.say === SAY_FOLLOW ? 'follow' : 'hold');
        }
        if (this.rules.emotes !== false) {
          if (input.say === EMOTE_DANCE) c.emoteUntil = this.tick + TICK_RATE * 3;
          else if (input.say <= QUICK_MESSAGES.length) this.pendingEvents.push({ e: 'say', s: c.slot, m: input.say, ...(this.teams && c.faction ? { team: c.faction } : {}) });
        }
      }
      // Moving or shooting ends a dance.
      if (c.emoteUntil && (input.forward || input.right || input.buttons & BUTTON_FIRE)) c.emoteUntil = undefined;
      // Stuck (or just wants out): die here and respawn like any other death.
      if (input.buttons & BUTTON_RESPAWN && !c.npc) {
        this.kill(c, null, 'core.respawn');
        continue;
      }

      if (input.weapon && input.weapon !== c.current && c.weapons.has(input.weapon)) this.switchTo(c, input.weapon);

      const zipBefore = c.move.zip;
      const seat = c.mount ? this.seatOf(c) : null;
      if (seat) {
        // In a turret or vehicle: no walking. Drivers steer; gunners' aim stays within the gun's arc.
        const m = this.mounts[c.mount!.index]!;
        // Standing places (a flatbed, a roof gun: not a real seat, not the wheel, where crouch is "down"): crouch
        // ducks you down where you stand (owner, 2026-11-11), a smaller target with a lower eye, as on foot.
        c.rideCrouch = seat.role !== 'driver' && !seat.seated && !m.def.airplane && !!(input.buttons & BUTTON_CROUCH);
        // The plane: jump (or E, below) jumps out.
        if (m.def.airplane && input.buttons & BUTTON_JUMP && !(input.buttons & BUTTON_USE)) {
          if (this.mayJumpOut(c, m)) {
            this.leaveMount(c, true);
            continue;
          }
        }
        if (seat.role === 'driver') {
          const up = !!(input.buttons & BUTTON_JUMP);
          const down = !!(input.buttons & BUTTON_CROUCH);
          // Look-to-steer (the Warthog way): the wheel turns toward where the driver looks, on top of A/D; backing up
          // it steers the other way round, so the nose still swings toward the look.
          let right = input.right;
          if (input.buttons & BUTTON_STEER_LOOK && m.def.vehicle && !m.def.vehicle.fly) {
            const off = Math.atan2(Math.sin(c.yaw - m.yaw), Math.cos(c.yaw - m.yaw));
            right = Math.max(-1, Math.min(1, right + off * LOOK_STEER_GAIN * (m.speed < -0.5 ? -1 : 1)));
          }
          m.drive = m.def.vehicle?.fly ? { forward: input.forward, right, lift: (up ? 1 : 0) - (down ? 1 : 0) } : { forward: input.forward, right, brake: up };
        }
        if (seat.arc !== undefined) {
          const centre = m.yaw + (seat.facing ?? 0);
          const d = Math.atan2(Math.sin(c.yaw - centre), Math.cos(c.yaw - centre));
          c.yaw = centre + Math.max(-seat.arc, Math.min(seat.arc, d));
        }
        c.pitch = Math.max(-0.5, Math.min(0.75, c.pitch));
        // A vehicle that turns its own gun (MountDef.turret) is aimed by that seat alone (the roof gun doesn't turn it),
        // or by the driver while they work that seat's gun (driverFires), turned as far as its arc lets it.
        const gunSeat = this.gunSeatOf(c);
        if (gunSeat !== null && (m.def.turret === undefined || m.def.turret.seat === gunSeat)) {
          const want = gunSeat === c.mount!.seat ? c.yaw : this.arcYaw(m, gunSeat, c.yaw, true);
          const traverse = m.def.turret?.traverse;
          if (traverse) {
            // A real turret: it turns toward the aim at its own rate, the short way round.
            const d = Math.atan2(Math.sin(want - m.aimYaw), Math.cos(want - m.aimYaw));
            const step = traverse * TICK_DT;
            m.aimYaw += Math.max(-step, Math.min(step, d));
          } else m.aimYaw = want;
          m.aimPitch = c.pitch;
        }
      } else {
        // Standing on a moving platform: go where it goes.
        const ridden = zipBefore === undefined ? this.scenario.carry(c.move.pos) : null;
        if (ridden) c.move = { ...c.move, pos: ridden };
        // In the way of a train: run over.
        else if (this.scenario.strike(c.move.pos, PLAYER.radius * c.size, PLAYER.height * c.size) > 0) {
          this.damage(c, 500, null, 'core.roadkill');
          if (!c.alive) continue;
        }
        const was = c.move.pos;
        const before = c.move;
        // Big matches: bots on foot move coarsely over terrain, and far from every player every other tick (relaxedMove).
        const detail = ridden ? 'full' : this.relaxedMove(c, input);
        if (detail === 'far' && !c.moveOwed && (this.tick + c.slot) % 2 === 0) c.moveOwed = true;
        else {
          const dt = c.moveOwed ? TICK_DT * 2 : TICK_DT;
          c.moveOwed = false;
          // One movement environment object, refilled per actor (no objects made per move; one shape for stepMovement to read).
          const env = this.moveEnv;
          env.liquids = this.liquids;
          env.jet = c.jetFuel !== null && c.jetFuel >= JET.burn;
          env.ladders = this.ladders;
          env.scale = c.size;
          env.jump = c.stats.jump;
          env.stamina = c.stats.stamina;
          env.gravity = this.phys.gravity;
          env.gravityZones = this.gravityZones.length ? this.gravityZones : undefined;
          env.airJumps = c.cls ? (this.classes?.airJumps(c) ?? 0) : undefined;
          env.jetpack = c.jetFuel !== null ? true : undefined;
          env.glider = c.glider ? true : undefined;
          env.autoChute = c.kind !== 'human' ? true : undefined;
          env.ground = detail !== 'full' && this.groundAt ? this.groundAt : undefined;
          env.ziplines = this.ziplines.length ? this.ziplines : undefined;
          env.team = this.ziplines.length ? c.faction : undefined;
          // Bots ride a zipline to its end: a stray E (a door, a vehicle) or a stuck-hop must not drop them off it.
          if (c.bot && c.move.zip !== undefined) input.buttons &= ~(BUTTON_USE | BUTTON_JUMP);
          const stepped = stepMovement(this.physics, c.collider, c.move, input, (c.speedTicks > 0 ? SPEED_BOOST : 1) * c.speedMul * statusSpeed(c), dt, this.tractionAt(c.move.pos), env);
          c.move = applyPads(this.pads, stepped);
          // Into a portal: out of its partner, turned by the difference in their facings (as client prediction does).
          const through = this.scenario.portals.length && c.move.zip === undefined ? applyPortals(this.scenario.portals, before, c.move, this.scenario.portalOn, c.size, bodyHeightOf(c.move, c.size)) : null;
          if (through) {
            c.move = through.state;
            c.yaw += through.turn;
            c.bot?.turned(through.turn);
          }
          this.trackFall(c, before, c.move !== stepped);
          c.moveSpeed = hypot(c.move.pos.x - was.x, c.move.pos.z - was.z) / dt;
          if (c.jetFuel !== null) c.jetFuel = stepJetFuel(c.jetFuel, !!c.move.jet);
        }
      }
      if (c.fireCooldown > 0) c.fireCooldown--;
      if (c.throwCooldown > 0) c.throwCooldown--;
      if (c.meleeCooldown > 0) c.meleeCooldown--;
      if (c.raiseTicks > 0) c.raiseTicks--;
      if (c.speedTicks > 0) c.speedTicks--;
      if (c.damageTicks > 0) c.damageTicks--;
      this.advanceReload(c);

      // E that grabbed or let go of a zipline this tick was used up by it.
      if (input.buttons & BUTTON_USE && (c.move.zip !== undefined) !== (zipBefore !== undefined)) input.buttons &= ~BUTTON_USE;
      if (input.buttons & BUTTON_USE) {
        c.useTick = this.tick;
        // Get out, get in, or use whatever you are looking at.
        if (c.mount) {
          const ride = this.mounts[c.mount.index];
          if (!ride?.route || this.mayJumpOut(c, ride)) this.leaveMount(c, true);
        } else if (!this.enterMount(c)) this.scenario.use(c.slot, { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z }, c.yaw, c.pitch);
        if (this.phase !== 'playing') break;
      }
      // A mode tool (the Fort Wars Builder) takes the trigger for itself.
      if (!c.mount && this.mode?.useInput?.(c, input)) input.buttons &= ~(BUTTON_FIRE | BUTTON_ALT | BUTTON_ZOOM | BUTTON_RELOAD);
      // Seated: the seat's gun if it has one; drivers without one can't shoot; passengers use their own.
      const seatNow = c.mount ? this.seatOf(c) : null;
      const gunSeat = this.gunSeatOf(c);
      const gun = gunSeat !== null ? this.mounts[c.mount!.index]!.guns[gunSeat]! : null;
      // Nobody shoots from the plane's benches (everyone shares the hold before the drop).
      const held = gun ?? heldWeapon(c);
      // On a zipline one hand holds the trolley: sidearms and blades only.
      const unarmed = (seatNow?.role === 'driver' && !gun) || (!!c.mount && !!this.mounts[c.mount.index]!.def.airplane) || (c.move.zip !== undefined && !gun && !oneHanded(held.def));
      const def = held.def;
      c.thirdPerson = c.kind === 'human' && !c.mount && (input.buttons & BUTTON_THIRD_PERSON) !== 0;
      const fireDown = (input.buttons & BUTTON_FIRE) !== 0;
      const pressed = input.buttons & ~c.prevButtons;
      c.prevButtons = input.buttons;
      if (!fireDown) c.semiLatch = false;
      // Reloads give way to emergency actions (spec §16): breaking into a sprint, using something.
      if (c.reload && ((pressed & BUTTON_SPRINT && input.forward > 0) || pressed & BUTTON_USE)) this.cancelReload(c);
      if (input.buttons & BUTTON_RELOAD) this.startReload(c);
      const frozen = c.frozenTicks > 0;
      const gp = gunplayOf(def);
      stepAds(c.gun, gp.accuracy, !!(input.buttons & BUTTON_ZOOM) && !gun);
      // Firing interrupts a reload whenever a round is ready: a loaded shell, a tactical reload's chambered round.
      // A melee weapon loading its barrel always swings (the loads already in stay); its barrel fires once one is in.
      if (c.reload && !gun && c.fireCooldown === 0 && c.raiseTicks === 0) {
        const swing = def.kind === 'melee' && ((fireDown && !c.semiLatch) || (pressed & BUTTON_MELEE) !== 0);
        const shoot = (fireDown && !c.semiLatch && roundsReady(held) > 0) || (input.buttons & BUTTON_ALT && !fireDown && def.alt?.reload && held.alt >= def.alt.cost);
        if (swing || shoot) this.cancelReload(c);
      }
      const ready = c.fireCooldown === 0 && (gun ? this.turretOnAim(c) : c.raiseTicks === 0) && c.reloadTicks === 0 && !frozen && !unarmed;
      // Spin-up and charge: the trigger has to be held this long first.
      if (def.windupTicks) {
        const able = fireDown && c.raiseTicks === 0 && c.reloadTicks === 0 && !frozen && !held.overheated && (def.magazine === 0 || roundsReady(held) > 0);
        c.windup = able ? Math.min(def.windupTicks, c.windup + 1) : Math.max(0, c.windup - 2);
      }
      let fired = false;
      if (c.burstLeft > 0) {
        // The rest of a burst follows on its own timer.
        if (--c.burstTimer <= 0) {
          if (!frozen && c.reloadTicks === 0 && spendRound(held)) {
            this.fire(c, primaryTrigger(def), input.viewTick ?? 0);
            fired = true;
            c.burstLeft--;
            c.burstTimer = def.burst?.intervalTicks ?? 1;
          } else c.burstLeft = 0;
        }
      } else if (fireDown && ready && !c.semiLatch && (!def.windupTicks || c.windup >= def.windupTicks)) {
        if (def.magazine > 0 && roundsReady(held) === 0) this.startReload(c);
        else if (spendRound(held)) {
          const mode = def.fireMode ?? 'auto';
          c.fireCooldown = def.fireIntervalTicks;
          c.semiLatch = mode !== 'auto';
          this.fire(c, primaryTrigger(def), input.viewTick ?? 0);
          fired = true;
          if (mode === 'burst' && def.burst) {
            c.burstLeft = def.burst.count - 1;
            c.burstTimer = def.burst.intervalTicks;
          }
          if (def.windupResets) c.windup = 0;
        }
      } else if (input.buttons & BUTTON_ALT && ready && held.def.alt) {
        const alt = held.def.alt;
        if (alt.ammo === 'own' ? held.alt >= alt.cost : held.mag >= alt.cost) {
          if (alt.ammo === 'own') held.alt -= alt.cost;
          else held.mag -= alt.cost;
          c.fireCooldown = alt.fireIntervalTicks;
          this.fire(c, altTrigger(held.def, alt), input.viewTick ?? 0);
        } else if (alt.ammo === 'shared' || alt.reload) this.startReload(c);
      }
      // Quick melee: the held melee weapon swings; with a gun in hand, a punch or a kick (no lockout of the gun).
      if (pressed & BUTTON_MELEE && !c.mount && !frozen && !fired) {
        if (def.kind === 'melee' && !getWeapon(def.id).heal) {
          if (ready && spendRound(held)) {
            c.fireCooldown = def.fireIntervalTicks;
            this.fire(c, primaryTrigger(def), input.viewTick ?? 0);
            fired = true;
          }
        } else {
          // Melee is an emergency action: the press breaks a reload where it is (spec §16), struck or not (prediction
          // mirrors it); the ammunition keeps the stage the reload reached.
          if (c.reload) this.cancelReload(c);
          // (Not in Disc Arena, where nobody takes damage: discs only knock people off.)
          if (c.meleeCooldown === 0 && !def.projectile?.disc) this.strike(c, unarmedStrike(input.forward, this.tick - c.punchedAt), input.viewTick ?? 0);
        }
      }
      // Auto-reload (the player's option): an empty magazine starts reloading by itself once the gun is ready.
      if (input.buttons & BUTTON_AUTO_RELOAD && !gun && !unarmed && !frozen && !fired && autoReloadDue(def, held, c, ((input.buttons & BUTTON_SPRINT) !== 0 && input.forward > 0) || (input.buttons & BUTTON_MELEE) !== 0)) this.startReload(c);
      if (fired && gun) gun.firedTick = this.tick;
      // Heat weapons cool when not firing (mounted guns cool in stepMounts); bloom settles.
      for (const w of c.weapons.values()) {
        if (!w.def.heat || (fired && w === held)) continue;
        w.heat = Math.max(0, (w.heat ?? 0) - w.def.heat.coolPerTick);
        if (w.heat === 0) w.overheated = false;
      }
      if (!fired && c.bloom > 0) c.bloom = Math.max(0, c.bloom - (def.recoil?.recover ?? 0.002));
      // Aim settles back after the recoil along the weapon's curve; the spray recovers.
      if (!fired) recoilIdle(c.gun, gp.kick, gp.accuracy, def.fireIntervalTicks);
      // Classes: G is the class's ability (sentry, overcharge, cloak) when it has one.
      if (input.buttons & BUTTON_THROW && !frozen && !gun && c.cls && this.classes?.useAbility(c)) {
        // Used.
      } else if (input.buttons & BUTTON_THROW && c.throwCooldown === 0 && c.throwable && c.throwable.count > 0 && !frozen && !unarmed && !gun) {
        const def = THROWABLE_DEFS[c.throwable.kind];
        c.throwCooldown = def.throwIntervalTicks;
        if (--c.throwable.count === 0) c.throwable = null;
        this.launch(c, def.projectile, throwableWeaponId(def.kind), 0.12);
        this.pendingEvents.push({ e: 'throw', s: c.slot });
      }

      if (c.mount) {
        // Seated players ride along; nothing else to do this input.
      } else if (!c.npc) this.collectPickups(c);
      // NPCs never run dry: their reserve refills.
      else if (held.reserve < held.def.magazine) held.reserve = held.def.reserveMax;
      if (c.move.pos.y < this.killY) this.fallKill(c);
      if (!c.alive) break;
    }
  }

  // ---------------------------------------------------------------- weapons

  private switchTo(c: Combatant, code: number): void {
    const w = c.weapons.get(code);
    if (!w) return;
    c.current = code;
    c.raiseTicks = w.def.raiseTicks;
    // Swapping always beats a reload: whatever stage it reached stays done (spec §16, §19).
    this.cancelReload(c);
    c.windup = 0;
    c.burstLeft = 0;
    c.bloom = 0;
    // The new gun starts a fresh spray; the aim offset still settles on its own.
    c.gun.shots = 0;
    c.gun.spray = 0;
    c.gun.ads = 0;
  }

  /** Start a reload of the held weapon: a staged magazine change or round by round (gunplay.ts). */
  private startReload(c: Combatant): void {
    if (c.reloadTicks > 0) return;
    const w = heldWeapon(c);
    const run = beginReload(w.def, w);
    if (!run) return;
    c.reload = run;
    c.reloadTicks = run.total;
    c.burstLeft = 0;
  }

  /** Stop a reload where it is: the ammunition keeps the stage it reached. */
  private cancelReload(c: Combatant): void {
    c.reload = null;
    c.reloadTicks = 0;
  }

  /** One applied input of reloading (something else zeroing `reloadTicks` cancels it). */
  private advanceReload(c: Combatant): void {
    if (!c.reload || c.reloadTicks === 0) {
      c.reload = null;
      c.reloadTicks = 0;
      return;
    }
    const w = heldWeapon(c);
    c.reload = stepReload(w.def, w, c.reload);
    c.reloadTicks = c.reload ? Math.max(1, c.reload.total - c.reload.t) : 0;
  }

  /** Where a shooter's rounds go: the view plus the mechanical recoil offset. */
  /**
   * Where a shot goes: the view plus the gun's recoil offset. In third person the view is first turned, from
   * the eye, onto what the crosshair is on (sim/thirdPerson.ts), worked out here from the host's own world and
   * `targets` (as the shooter saw them): the client only says the view is third person.
   */
  private aimOf(c: Combatant, targets?: ShotTargets): Vec3 {
    let yaw = c.yaw;
    let pitch = c.pitch;
    if (c.thirdPerson && !c.mount) {
      const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
      const bodies: RayQuery | undefined = targets
        ? (o, d, max) => {
            let best: number | null = null;
            for (const t of targets) {
              const h = rayTarget(o, d, t, max);
              if (h !== null && h < max && (best === null || h < best)) best = h;
            }
            return best;
          }
        : undefined;
      ({ yaw, pitch } = thirdPersonAim(this.worldRay, eye, yaw, pitch, bodies));
    }
    return viewDirection(yaw + c.gun.ry, Math.max(-1.55, Math.min(1.55, pitch + c.gun.rp)));
  }

  /** Level geometry along a ray (third-person aim). */
  private readonly worldRay: RayQuery = (o, d, max) => this.physics.raycastWorld(o, d, max);

  /** Launch a projectile from the eye along the aim (lifted a little for throws, so they arc). */
  private launch(shooter: Combatant, spec: ProjectileSpec, weapon: string, lift = 0, spread = 0): void {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    const aim = this.spreadDir(lift ? normalize(add(viewDirection(shooter.yaw, shooter.pitch), { x: 0, y: lift, z: 0 })) : this.aimOf(shooter, shooter.thirdPerson ? this.targetsFor(shooter, 0, true) : undefined), spread);
    this.projectiles.push({
      id: this.nextProjectileId++,
      owner: shooter.slot,
      spec,
      weapon,
      pos: add(eye, scale(aim, 0.5)),
      vel: scale(aim, spec.speed),
      ticksLeft: Math.round(spec.fuseSeconds * TICK_RATE),
      age: 0,
      ...(shooter.mount ? { fromMount: shooter.mount.index } : {}),
    });
  }

  private fire(shooter: Combatant, def: Trigger, viewTick: number): void {
    // A rider's rounds leave through the vehicle they sit in (a seated eye is under its roof line).
    this.physics.shotSkip = shooter.mount ? (this.mounts[shooter.mount.index]?.body ?? null) : null;
    // A driver working a gunner seat's gun (driverFires) shoots within that seat's arc, whatever way they look.
    const ride = shooter.mount ? this.mounts[shooter.mount.index] : undefined;
    const gunSeat = ride ? this.gunSeatOf(shooter) : null;
    const lookYaw = shooter.yaw;
    if (ride && gunSeat !== null && gunSeat !== shooter.mount!.seat) shooter.yaw = this.arcYaw(ride, gunSeat, lookYaw, true);
    try {
      if (!simProfile.on) return this.fireNow(shooter, def, viewTick);
      const t0 = performance.now();
      this.fireNow(shooter, def, viewTick);
      simProfile.add('fire', performance.now() - t0);
      simProfile.count('fire');
    } finally {
      this.physics.shotSkip = null;
      shooter.yaw = lookYaw;
    }
  }

  private fireNow(shooter: Combatant, def: Trigger, viewTick: number): void {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    const aim = this.aimOf(shooter, shooter.thirdPerson ? this.targetsFor(shooter, viewTick, true) : undefined);
    const gp = gunplayOf(getWeapon(def.id));
    let spread: number;
    if (gp.accuracy && !def.alt) {
      // Gunplay spread (spec §14): base, movement, air and sustained fire, tightened by stance and the sights,
      // plus the pellet pattern of a shotgun.
      spread = shotCone(def, gp.accuracy, shooter.gun, { run: shooter.moveSpeed / PLAYER.runSpeed, airborne: !shooter.move.grounded, stance: STANCE_SPREAD[stanceOf(shooter.move)] });
      // A scoped rifle fired from the hip is a gamble: fine across a room, a guess further out (not a lottery: ADS is never mandatory).
      const zoom = getWeapon(def.id).view.zoomFov;
      if (zoom && !shooter.npc && shooter.gun.ads < 0.5) spread += zoom < 0.5 ? NO_SCOPE_SPREAD : 0.012;
    } else {
      // Bloom from sustained fire widens the spread; each shot adds more. So does
      // shooting on the run or in the air; aiming down a scope tightens it, and a
      // scoped rifle fired from the hip is a guess.
      spread = aimSpread(shooter, def, def.spread + (def.alt ? 0 : shooter.bloom) + movementSpread(shooter, def)) * STANCE_SPREAD[stanceOf(shooter.move)];
      if (def.recoil && !def.alt) shooter.bloom = Math.min(def.recoil.maxBloom, shooter.bloom + def.recoil.bloom);
    }
    // Mechanical recoil: this round kicks the aim for the next one (a second trigger only by its own kick).
    if (!def.alt && def.kind !== 'melee') recoilShot(shooter.gun, gp.kick);
    else if (def.alt && def.kick) recoilShot(shooter.gun, def.kick);
    if (def.kind === 'projectile' && def.projectile?.disc && !def.alt) {
      this.throwDisc(shooter, def.projectile, def.id);
      return;
    }
    if (def.kind === 'projectile' && def.projectile) {
      for (let p = 0; p < Math.max(1, def.pellets); p++) this.launch(shooter, def.projectile, def.id, 0, spread);
      if (def.alt) this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to: [], hit: [], alt: 1 });
      return;
    }

    const grapple = getWeapon(def.id).grapple;
    if (grapple) {
      this.fireGrapple(shooter, eye, aim, def, grapple.speed);
      return;
    }
    const heal = getWeapon(def.id).heal;
    if (heal) {
      this.useMedkit(shooter, eye, aim, heal, def.range);
      return;
    }
    const targets = this.targetsFor(shooter, viewTick);
    if (def.kind === 'melee') {
      const { hit, body } = this.meleeTrace(shooter, eye, def.range, targets);
      this.pendingEvents.push({ e: 'melee', s: shooter.slot, hit });
      if (hit !== null) {
        const victim = this.actor(hit)!;
        this.damage(victim, def.damage, shooter, def.id);
        this.stagger(victim, this.powerOf(def.id), viewDirection(shooter.yaw, 0), 1);
        // Heavy melee (the battle axe) shoves the target along the swing.
        if (def.knockback && victim.alive) this.push(victim, viewDirection(shooter.yaw, 0), def.knockback);
      }
      else if (body !== null && !this.damageMountBody(body, this.boosted(shooter, def.damage), shooter, 'melee')) this.scenario.damageBody(body, this.boosted(shooter, def.damage), shooter.slot);
      return;
    }

    if (gp.ballistic && !def.alt && def.kind === 'hitscan') {
      this.fireBullets(shooter, def, gp, eye, aim, spread, viewTick, targets);
      return;
    }

    const to: Tuple3[] = [];
    const hits: (number | null)[] = [];
    const zones: number[] = [];
    const bodies: { handle: number; dist: number; at: Vec3 }[] = [];
    const struck: { slot: number; dir: Vec3; zone: HitZone; dist: number; keep: number }[] = [];
    for (let p = 0; p < def.pellets; p++) {
      const dir = this.spreadDir(aim, spread);
      const world = this.physics.raycastHit(eye, dir, def.range);
      if (def.pierce) {
        // Piercing rounds go through players (not walls): everyone along the line, nearest first.
        const wallAt = world?.dist ?? def.range;
        const along = targets
          .map((t) => {
            const d = rayTarget(eye, dir, t, wallAt);
            return { slot: t.slot, d, zone: d === null ? (0 as HitZone) : lastHit.zone };
          })
          .filter((t): t is { slot: number; d: number; zone: HitZone } => t.d !== null && t.d < wallAt)
          .sort((a, b) => a.d - b.d)
          .slice(0, def.pierce + 1);
        // Breakable glass on the way shatters; a round that went through some hits a little softer (GLASS.passDamage).
        const panes = this.scenario.glassAlong(eye, dir, wallAt);
        this.scenario.shootGlass(eye, dir, wallAt, shooter.slot);
        for (const t of along) struck.push({ slot: t.slot, dir, zone: t.zone, dist: t.d, keep: GLASS.passDamage ** panes.filter((d) => d < t.d).length });
        to.push(tuple(add(eye, scale(dir, wallAt))));
        hits.push(along[0]?.slot ?? null);
        zones.push(along[0]?.zone ?? 0);
        if (world) bodies.push({ handle: world.handle, dist: wallAt, at: add(eye, scale(dir, wallAt)) });
        continue;
      }
      const shot = resolveHitscan(eye, dir, def.range, world?.dist ?? null, targets);
      // Shots go through breakable glass, shattering it on the way (sim/glass.ts), and lose a little for each pane.
      const broke = this.scenario.shootGlass(eye, dir, hypot(shot.end.x - eye.x, shot.end.y - eye.y, shot.end.z - eye.z), shooter.slot);
      to.push(tuple(shot.end));
      hits.push(shot.hitSlot);
      const zone = shot.hitSlot !== null ? shot.zone : 0;
      zones.push(zone);
      if (shot.hitSlot !== null) struck.push({ slot: shot.hitSlot, dir, zone, dist: shot.distance, keep: GLASS.passDamage ** broke });
      else if (world) bodies.push({ handle: world.handle, dist: world.dist, at: shot.end });
    }
    this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to, hit: hits, ...(zones.some((z) => z) ? { z: zones } : {}), ...(def.alt ? { alt: 1 as const } : {}) });
    // A second trigger can bring its own falloff and head multiple (the Battle Axe's blunderbuss).
    const falloff = def.falloff ?? gp.falloff;
    for (const { slot, dir, zone, dist, keep } of struck) {
      const victim = this.actor(slot)!;
      const zoneK = zone === 1 && def.alt && def.headshot !== undefined ? def.headshot : zoneScale(gp, zone);
      this.damage(victim, def.damage * zoneK * falloffAt(falloff, dist) * keep, shooter, def.id, zone === 1);
      if (def.status) this.applyStatus(victim, def.status, shooter, def.id);
      this.stagger(victim, this.powerOf(def.id), dir, (falloffAt(falloff, dist) * keep) / Math.max(1, def.pellets));
      if (def.knockback) this.push(victim, dir, def.knockback);
    }
    for (const b of bodies) {
      this.noteTargetHit(shooter, b.handle, this.boosted(shooter, def.damage) * falloffAt(falloff, b.dist), b.at);
      if (!this.damageMountBody(b.handle, this.boosted(shooter, def.damage), shooter, 'bullet', def.id)) this.scenario.damageBody(b.handle, this.boosted(shooter, def.damage), shooter.slot);
    }
    if (def.chain && struck.length) this.chainLightning(shooter, def, struck[0]!.slot, eye);
  }

  /** Disc Arena: throw a disc (or, with a power disc, a fast, triple, splitting or freezing throw). */
  private throwDisc(shooter: Combatant, spec: ProjectileSpec, weapon: string): void {
    const power = shooter.discPower ?? null;
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    discThrows(spec, power?.kind ?? null).forEach((t, i) => {
      const aim = viewDirection(shooter.yaw + t.yaw, shooter.pitch);
      this.projectiles.push({ id: this.nextProjectileId++, owner: shooter.slot, spec: t.spec, weapon, pos: add(eye, scale(aim, 0.5)), vel: scale(aim, t.spec.speed), ticksLeft: Math.round(t.spec.fuseSeconds * TICK_RATE), age: 0, ...(i > 0 ? { extra: true } : {}) });
    });
    if (power && --power.shots <= 0) shooter.discPower = undefined;
  }

  /** A disc struck a player: shove them along its flight (credit for a fall), maybe freeze them. */
  private discHit(victim: Combatant, p: Projectile, dir: Vec3): void {
    const disc = p.spec.disc!;
    const owner = this.actor(p.owner);
    // Just spawned: the disc glances off.
    if (this.tick - (victim.spawnedAt ?? -Infinity) < DISC_SPAWN_GUARD_SECONDS * TICK_RATE) return;
    if (p.spec.status) this.applyStatus(victim, p.spec.status, owner ?? null, p.weapon);
    const h = hypot(dir.x, dir.z) || 1;
    victim.move = { ...victim.move, vx: (victim.move.vx ?? 0) + (dir.x / h) * disc.push, vz: (victim.move.vz ?? 0) + (dir.z / h) * disc.push, velY: Math.max(victim.move.velY, disc.lift), grounded: false };
    if (owner && owner !== victim) victim.knockedBy = { slot: owner.slot, tick: this.tick, weapon: p.weapon };
    victim.hurtAt = this.tick;
    this.pendingEvents.push({ e: 'knock', s: p.owner, t: victim.slot });
  }

  /** Off the edge: a fall soon after an enemy's disc hit is their kill, otherwise your own. */
  private fallKill(c: Combatant): void {
    const k = c.knockedBy;
    const by = k && this.tick - k.tick <= DISC_KNOCK_CREDIT_SECONDS * TICK_RATE ? this.actor(k.slot) : undefined;
    c.knockedBy = undefined;
    if (by && by !== c && this.hostile(by, c)) this.kill(c, by, k!.weapon);
    else this.kill(c, null, 'core.fall');
  }

  /** Lightning jumps from the first target to the nearest enemies in reach (with a clear line), weaker each jump. */
  private chainLightning(shooter: Combatant, def: Trigger, first: number, from: Vec3): void {
    const chain = def.chain!;
    const hit = new Set([first]);
    let at = this.actor(first)!;
    let damage = def.damage;
    const pts: Tuple3[] = [tuple(from), tuple(chest(at.move.pos))];
    for (let j = 0; j < chain.jumps; j++) {
      const here = chest(at.move.pos);
      let next: Combatant | null = null;
      let best = chain.range;
      for (const o of this.actors()) {
        if (!o.alive || hit.has(o.slot) || !this.hostile(shooter, o)) continue;
        const d = distance(here, chest(o.move.pos));
        if (d < best && this.physics.lineOfSight(here, chest(o.move.pos))) {
          best = d;
          next = o;
        }
      }
      if (!next) break;
      damage *= chain.falloff;
      hit.add(next.slot);
      pts.push(tuple(chest(next.move.pos)));
      this.damage(next, damage, shooter, def.id);
      at = next;
    }
    this.pendingEvents.push({ e: 'arc', s: shooter.slot, pts });
  }

  /** Put a status effect on a player (kill credit for its damage goes to `by`). */
  private applyStatus(c: Combatant, st: StatusHit, by: Combatant | null, weapon: string): void {
    if (!c.alive || (by && by !== c && !this.canHurt(by, c))) return;
    const ticks = Math.round(st.seconds * TICK_RATE);
    if (st.kind === 'burn') c.burnTicks = Math.max(c.burnTicks, ticks);
    else if (st.kind === 'poison') c.poisonTicks = Math.max(c.poisonTicks, ticks);
    else if (st.kind === 'slow') c.slowTicks = Math.max(c.slowTicks, ticks);
    else if (c.frozenTicks === 0) {
      c.chill = Math.min(1, c.chill + (st.amount ?? 0.1));
      if (c.chill >= 1) {
        c.frozenTicks = FROZEN_TICKS;
        c.chill = 0;
      }
    }
    c.statusBy = by?.slot ?? null;
    c.statusWeapon = weapon;
  }

  /**
   * Stopping power (sim/impact.ts): a hit by `weapon` with `share` of a full shot's damage shoves a
   * living body a little along `dir` and slows it briefly, within the stagger caps and immunity.
   * Stays on the ground (no lift), so the ground's grip takes the shove back off quickly.
   */
  private stagger(victim: Combatant, power: number, dir: Vec3, share: number): void {
    if (!victim.alive || victim.mount || victim.invulnerable) return;
    const shove = hitImpact(victim.impact, power, share);
    if (shove <= 0) return;
    const h = hypot(dir.x, dir.z);
    if (h < 0.05) return;
    victim.move = { ...victim.move, vx: (victim.move.vx ?? 0) + (dir.x / h) * shove, vz: (victim.move.vz ?? 0) + (dir.z / h) * shove };
  }

  /** Stopping power by weapon id (cached). */
  private readonly stopping = new Map<string, number>();
  private powerOf(weapon: string): number {
    let power = this.stopping.get(weapon);
    if (power === undefined) {
      power = stoppingPower(getWeapon(weapon));
      this.stopping.set(weapon, power);
    }
    return power;
  }

  /** Three short rays in a narrow fan (forgiving melee without a full sweep): who it hits, or the body it strikes. A swing at a window smashes it. */
  private meleeTrace(shooter: Combatant, eye: Vec3, range: number, shapes: ReturnType<Match['targetsFor']>): { hit: number | null; body: number | null } {
    let body: number | null = null;
    // Melee reaches the body's whole capsule (PLAYER.radius at its size), not the measured shapes: a swing is a
    // sweep, forgiving by design (responsiveness over realism, GUNPLAY_DIRECTION.md).
    const targets = shapes.map((t) => ({ slot: t.slot, feet: t.feet, height: t.height, radius: t.radius }));
    for (const yawOffset of [0, -0.3, 0.3]) {
      const dir = viewDirection(shooter.yaw + yawOffset, shooter.pitch);
      const world = this.physics.raycastHit(eye, dir, range);
      const shot = resolveHitscan(eye, dir, range, world?.dist ?? null, targets);
      if (yawOffset === 0) this.scenario.shootGlass(eye, dir, shot.distance, shooter.slot);
      if (shot.hitSlot !== null) return { hit: shot.hitSlot, body: null };
      if (world && body === null) body = world.handle;
    }
    return { hit: null, body };
  }

  /**
   * Unarmed quick melee (UNARMED): a punch or a kick at whoever is in reach. Small damage, a stagger
   * (stopping power) and, for a kick, a shove. Breaks into a reload like any emergency action.
   */
  private strike(c: Combatant, kind: 'punch' | 'kick', viewTick: number): void {
    const s = UNARMED[kind];
    c.meleeCooldown = s.cooldownTicks;
    if (kind === 'punch') c.punchedAt = this.tick;
    else c.punchedAt = -1000;
    if (c.reload) this.cancelReload(c);
    const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
    const { hit, body } = this.meleeTrace(c, eye, s.range * c.size, this.targetsFor(c, viewTick));
    this.pendingEvents.push({ e: 'melee', s: c.slot, hit, u: kind === 'punch' ? 1 : 2 });
    if (hit !== null) {
      const victim = this.actor(hit)!;
      const dir = viewDirection(c.yaw, 0);
      this.damage(victim, s.damage, c, s.id);
      this.stagger(victim, s.stopping, dir, 1);
      if (s.shove && victim.alive && !victim.mount) this.push(victim, dir, s.shove);
    } else if (body !== null && !this.damageMountBody(body, this.boosted(c, s.damage), c, 'melee')) this.scenario.damageBody(body, this.boosted(c, s.damage), c.slot);
  }

  /** Shove a player along `dir` (horizontal push plus a little lift). */
  private push(c: Combatant, dir: Vec3, speed: number): void {
    const h = hypot(dir.x, dir.z) || 1;
    c.move = { ...c.move, vx: (c.move.vx ?? 0) + (dir.x / h) * speed, vz: (c.move.vz ?? 0) + (dir.z / h) * speed, velY: Math.max(c.move.velY, speed * 0.45 + dir.y * speed * 0.5), grounded: false };
  }

  /** A blast throw (blastThrow): adds its sideways speed to the push and lifts at least as hard as it says. */
  private throwBy(c: Combatant, v: Vec3): void {
    if (!v.x && !v.y && !v.z) return;
    c.move = { ...c.move, vx: (c.move.vx ?? 0) + v.x, vz: (c.move.vz ?? 0) + v.z, velY: Math.max(c.move.velY, v.y), grounded: false };
  }

  /** Ground grip at a point: oil makes it slick. */
  private tractionAt(pos: Vec3): number {
    for (const z of this.zones) if (z.kind === 'oil' && inZone(z, pos)) return OIL_TRACTION;
    return 1;
  }

  /** Uniform random direction within a cone around `dir`. */
  private spreadDir(dir: Vec3, spread: number): Vec3 {
    if (spread <= 0) return dir;
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng()) * spread;
    // Build a basis around dir.
    const up = Math.abs(dir.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const right = normalize({ x: up.y * dir.z - up.z * dir.y, y: up.z * dir.x - up.x * dir.z, z: up.x * dir.y - up.y * dir.x });
    const up2 = { x: dir.y * right.z - dir.z * right.y, y: dir.z * right.x - dir.x * right.z, z: dir.x * right.y - dir.y * right.x };
    return normalize(add(dir, add(scale(right, Math.cos(a) * r), scale(up2, Math.sin(a) * r))));
  }

  /**
   * Hit targets as the shooter saw them. Humans see remote players about one
   * round trip plus the interpolation delay in the past, so their shots are
   * resolved against recorded positions at the tick they were viewing
   * (bounded by MAX_REWIND_TICKS). Bots see the present.
   */
  private targetsFor(shooter: Combatant, viewTick: number, aimOnly = false): ShotBody[] {
    let past: Map<number, PastBody> | undefined;
    if (shooter.kind === 'human' && viewTick > 0) {
      const t = Math.max(this.tick - MAX_REWIND_TICKS, Math.min(this.tick, viewTick));
      const e = this.history[t % HISTORY_TICKS];
      past = e?.tick === t ? e.at : undefined;
    }
    // Allies are not targets: shots pass through them, unless the match has friendly fire on (canHurt). Third-person
    // aim (`aimOnly`) settles on enemies only, as ever.
    return this.actors()
      .filter((o) => o.alive && !this.sheltered(o) && (aimOnly ? this.hostile(shooter, o) : this.canHurt(shooter, o)))
      .map((o) => {
        const then = past?.get(o.slot);
        // The rewound body is the whole body as it was: where it stood, which way it faced, its stance and shapes.
        return then ? { slot: o.slot, feet: then, height: then.h, radius: PLAYER.radius * o.size, box: then.box, yaw: then.yaw, stance: then.stance, scale: then.scale, who: o } : this.shotBody(o);
      });
  }

  /** A combatant's body where it is now, for shots: its measured shapes, facing, stance and scale. */
  private shotBody(o: Combatant): ShotBody {
    const box = hitboxOf(o);
    return { slot: o.slot, feet: o.move.pos, height: bodyHeightOf(o.move, o.size), radius: PLAYER.radius * o.size, box, yaw: o.yaw, stance: stanceOf(o.move), scale: o.hitScale * o.size, who: o };
  }

  private recordHistory(): void {
    const i = this.tick % HISTORY_TICKS;
    const e = this.history[i] ?? (this.history[i] = { tick: -1, at: new Map(), pool: new Map() });
    e.tick = this.tick;
    e.at.clear();
    for (const c of this.actors()) {
      if (!c.alive) continue;
      let o = e.pool.get(c.slot);
      if (!o) e.pool.set(c.slot, (o = { x: 0, y: 0, z: 0, h: 0, yaw: 0, stance: 0, scale: 1, box: c.hitbox }));
      o.x = c.move.pos.x;
      o.y = c.move.pos.y;
      o.z = c.move.pos.z;
      o.h = bodyHeightOf(c.move, c.size);
      o.yaw = c.yaw;
      o.stance = stanceOf(c.move);
      o.box = hitboxOf(c);
      o.scale = c.hitScale * c.size;
      e.at.set(c.slot, o);
    }
  }

  private stepProjectiles(): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      const spec = p.spec;
      p.age++;
      const owner = this.actor(p.owner);
      if (p.stuckTo !== undefined) {
        // Riding on a player until the fuse runs out (it stays where they fell if they die).
        const host = this.actor(p.stuckTo);
        if (host?.alive) p.pos = add(host.move.pos, p.stuckOffset!);
        if (--p.ticksLeft <= 0) this.explode(p, p.pos);
        else keep.push(p);
        continue;
      }
      if (p.stuck && spec.retrievable) {
        if (this.retrieve(p)) continue;
        // Lying unclaimed too long: back to whoever threw it.
        if (--p.ticksLeft <= 0) {
          const w = owner?.weapons.get(weaponCode(getWeapon(p.weapon)));
          if (w) w.mag = Math.min(w.def.magazine, w.mag + 1);
          continue;
        }
        keep.push(p);
        continue;
      }
      if (p.stuck) {
        // An armed mine waits for an enemy (or its fuse).
        const armed = this.tick >= (p.armAt ?? 0);
        const trigger = spec.mine?.triggerRadius ?? 0;
        const near = armed && this.actors().some((c) => c.alive && (!owner || c !== owner) && (!owner || this.hostile(owner, c)) && distance(chest(c.move.pos), p.pos) <= trigger);
        if (near || --p.ticksLeft <= 0) {
          this.explode(p, p.pos);
          continue;
        }
        keep.push(p);
        continue;
      }
      if (p.walking) {
        if (this.walk(p, owner ?? null)) keep.push(p);
        continue;
      }
      if (spec.homing && owner) this.steer(p, owner, spec.homing);
      if (spec.guided && owner?.alive) this.guide(p, owner, spec.guided.turnRate);
      if (spec.drag) p.vel = scale(p.vel, Math.max(0, 1 - spec.drag * TICK_DT));
      p.vel = { x: p.vel.x, y: p.vel.y - spec.gravity * TICK_DT, z: p.vel.z };
      const delta = scale(p.vel, TICK_DT);
      const len = hypot(delta.x, delta.y, delta.z);
      const dir = scale(delta, 1 / (len || 1));
      this.physics.shotSkip = p.fromMount !== undefined ? (this.mounts[p.fromMount]?.body ?? null) : null;
      const wall = this.physics.raycastNormal(p.pos, dir, len);
      this.physics.shotSkip = null;
      // Through a portal (before whatever wall it is set in): out of its partner, turned with it.
      const gate = this.scenario.portals.length ? portalSegment(this.scenario.portals, p.pos, add(p.pos, delta), this.scenario.portalOn) : null;
      if (gate && (!wall || wall.dist >= gate.t * len - 0.15)) {
        const at = add(p.pos, scale(delta, gate.t));
        const out = portalCarry(gate.a, gate.b, at, p.vel);
        p.pos = out.pos;
        p.vel = out.vel;
        keep.push(p);
        continue;
      }
      // Grenades and rockets fly through breakable glass, shattering it (sim/glass.ts).
      if (len > 0) this.scenario.shootGlass(p.pos, dir, wall?.dist ?? len, p.owner);
      let hitDist = wall?.dist ?? null;
      let victim: Combatant | null = null;
      for (const c of this.actors()) {
        // Your own discs never hit you.
        if (!c.alive || (c === owner && (p.age < OWNER_GRACE_TICKS || spec.disc))) continue;
        if (owner && c !== owner && !this.canHurt(owner, c)) continue;
        const d = rayTarget(p.pos, dir, this.shotBody(c), len, PROJECTILE_THICKNESS);
        if (d !== null && d <= len && (hitDist === null || d < hitDist)) {
          hitDist = d;
          victim = c;
        }
      }
      if (hitDist !== null) {
        const at = add(p.pos, scale(dir, Math.max(0, hitDist - 0.05)));
        if (victim && spec.retrievable) {
          // A spear: through them, then it drops at their feet for someone to pick up.
          if (spec.impactDamage) this.damage(victim, spec.impactDamage, owner ?? null, p.weapon);
          const down = this.physics.raycastHit({ x: at.x, y: at.y + 0.2, z: at.z }, { x: 0, y: -1, z: 0 }, 4);
          p.pos = { x: at.x, y: down ? at.y + 0.2 - down.dist + 0.1 : victim.move.pos.y + 0.1, z: at.z };
          p.vel = { x: 0, y: 0, z: 0 };
          p.stuck = true;
          keep.push(p);
          continue;
        }
        if (victim && spec.sticky === 'any') {
          // Sticks to the player it hits and rides along until it goes off.
          if (spec.impactDamage) this.damage(victim, spec.impactDamage, owner ?? null, p.weapon);
          if (spec.status) this.applyStatus(victim, spec.status, owner ?? null, p.weapon);
          p.stuckTo = victim.slot;
          // On the body itself, not out on the hit shapes' margin (HITBOX_MARGIN): at most a quarter metre from its middle.
          const ox = at.x - victim.move.pos.x;
          const oz = at.z - victim.move.pos.z;
          const in_ = Math.min(1, (0.25 * victim.size) / Math.max(1e-6, Math.hypot(ox, oz)));
          p.stuckOffset = { x: ox * in_, y: Math.min(PLAYER.height, Math.max(0.3, at.y - victim.move.pos.y)), z: oz * in_ };
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.walker && wall.normal.y > 0.6) {
          // Landed: off it goes, the way it was thrown.
          const h = hypot(p.vel.x, p.vel.z);
          p.heading = h > 0.1 ? { x: p.vel.x / h, y: 0, z: p.vel.z / h } : { x: Math.sin(owner?.yaw ?? 0), y: 0, z: Math.cos(owner?.yaw ?? 0) };
          p.pos = add(at, scale(wall.normal, 0.05));
          p.vel = { x: 0, y: 0, z: 0 };
          p.walking = true;
          p.hopIn = 0;
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.sticky) {
          p.pos = add(at, scale(wall.normal, 0.06));
          p.stuck = true;
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.mine) {
          // Mines stick to whatever they land on and arm shortly after.
          p.pos = add(at, scale(wall.normal, 0.06));
          p.stuck = true;
          p.armAt = this.tick + Math.round(spec.mine.armSeconds * TICK_RATE);
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.bounce !== undefined) {
          // Reflect off the surface, losing speed; keep the fuse running.
          const n = wall.normal;
          const vn = p.vel.x * n.x + p.vel.y * n.y + p.vel.z * n.z;
          p.vel = scale({ x: p.vel.x - 2 * vn * n.x, y: p.vel.y - 2 * vn * n.y, z: p.vel.z - 2 * vn * n.z }, spec.bounce);
          p.pos = add(at, scale(n, 0.05));
          p.bounces = (p.bounces ?? 0) + 1;
          if (spec.disc?.split && p.bounces === 1) {
            // A splitting disc: two more fly off either side of the bounce.
            const plain = { ...spec, disc: { push: spec.disc.push, lift: spec.disc.lift } };
            for (const v of splitVelocities(p.vel)) this.projectiles.push({ id: this.nextProjectileId++, owner: p.owner, spec: plain, weapon: p.weapon, pos: { ...p.pos }, vel: v, ticksLeft: p.ticksLeft, age: p.age, bounces: 1, extra: true });
          }
          if (--p.ticksLeft <= 0 || (spec.maxBounces !== undefined && p.bounces > spec.maxBounces)) this.explode(p, p.pos);
          else keep.push(p);
          continue;
        }
        if (victim && spec.disc) {
          this.discHit(victim, p, dir);
          this.explode(p, at);
          continue;
        }
        if (victim && spec.impactDamage) this.damage(victim, spec.impactDamage, owner ?? null, p.weapon);
        if (victim && spec.status) this.applyStatus(victim, spec.status, owner ?? null, p.weapon);
        if (!victim && wall && spec.impactDamage && !this.damageMountBody(wall.handle, spec.impactDamage, owner ?? null, 'blast', p.weapon)) this.scenario.damageBody(wall.handle, spec.impactDamage, p.owner);
        this.explode(p, at);
        continue;
      }
      p.pos = add(p.pos, delta);
      if (--p.ticksLeft <= 0 || p.pos.y < this.killY) {
        this.explode(p, p.pos);
        continue;
      }
      keep.push(p);
    }
    this.projectiles = keep;
    if (keep.length > RESOURCE_BUDGETS.activeProjectiles) this.capProjectiles();
  }

  /** Over the projectile budget: the oldest bots' and NPCs' projectiles go first, then the oldest of all (no blast). */
  private capProjectiles(): void {
    let excess = this.projectiles.length - RESOURCE_BUDGETS.activeProjectiles;
    this.budgetWarning('projectiles', `over ${RESOURCE_BUDGETS.activeProjectiles} projectiles in flight: the oldest are removed`);
    const human = (p: Projectile) => this.slots[p.owner]?.kind === 'human';
    const drop = new Set<Projectile>();
    for (const pass of [false, true]) {
      for (const p of this.projectiles) {
        if (excess <= 0) break;
        if (drop.has(p) || (!pass && human(p))) continue;
        drop.add(p);
        excess--;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !drop.has(p));
  }

  /** Runtime budget warnings (map/budgets.ts), logged once per kind and match. */
  private readonly budgetWarned = new Set<string>();
  budgetWarning(kind: string, text: string): void {
    if (this.budgetWarned.has(kind)) return;
    this.budgetWarned.add(kind);
    console.warn(`[map budget] ${this.map.metadata.name}: ${text}`);
  }

  // ---------------------------------------------------------------- bullets (GUNPLAY_SPEC §3-6, §8, §38)

  /**
   * Fire conventional bullets (weapons with a ballistic spec).
   *
   * Lag compensation is designed together with travel (spec §38). The first
   * NEAR_INSTANT_M metres are a ray resolved in this tick against the world
   * as the shooter saw it (their view tick), so close range is instant and
   * fair. The bullet then "catches up" the ticks the input spent on its way
   * to the server, one tick of flight per recorded tick, against those
   * rewound positions; after that it flies against the live world. A shooter
   * therefore leads only for the bullet's travel time, never for latency, and
   * nobody is ever rewound further than MAX_REWIND_TICKS. Bots and NPCs have
   * no latency: their bullets fly against the live world from the start.
   */
  private fireBullets(shooter: Combatant, def: Trigger, gp: Gunplay, eye: Vec3, aim: Vec3, spread: number, viewTick: number, viewTargets: ShotTargets): void {
    const bal = gp.ballistic!;
    const phys = bulletPhysics(bal, this.rules);
    const lag = shooter.kind === 'human' && viewTick > 0 ? Math.max(0, Math.min(MAX_REWIND_TICKS, this.tick - viewTick)) : 0;
    // Targets as the shooter saw them k ticks after their view tick (k = lag is now), built once per shot.
    const byTick: ShotTargets[] = [viewTargets];
    const seen = (k: number): ShotTargets => (byTick[k] ??= lag > 0 ? this.targetsFor(shooter, this.tick - lag + k) : viewTargets);
    const to: Tuple3[] = [];
    const hits: (number | null)[] = [];
    const zones: number[] = [];
    const flying: number[] = [];
    const marks: Tuple3[] = [];
    const ends: BulletEnd[] = [];
    let armored = false;
    for (let p = 0; p < Math.max(1, def.pellets); p++) {
      const dir = this.spreadDir(aim, spread);
      const b: Bullet = { owner: shooter.slot, trig: def, origin: eye, pos: { ...eye }, vel: scale(dir, phys.speed), gravity: phys.gravity, drag: phys.drag, travelled: 0, age: 0, energy: bal.energy, scale: 1, pens: 0, rics: 0, marks: [], born: this.tick };
      // Near range: one straight ray, no time taken.
      const near = add(eye, scale(dir, Math.min(NEAR_INSTANT_M, def.range)));
      b.pos = near;
      let end = this.bulletSegment(b, eye, near, seen(0));
      // Then this tick's flight, or (for a human) the ticks the shot spent reaching the server,
      // each against the world as the shooter saw it then.
      for (let k = 1; !end && k <= Math.max(1, lag); k++) end = this.flyTick(b, seen(k));
      marks.push(...b.marks);
      b.marks = [];
      if (end) {
        to.push(tuple(end.at));
        hits.push(end.victim?.slot ?? null);
        zones.push(end.zone);
        if (end.victim && end.victim.armor > 0) armored = true;
        ends.push(end);
      } else {
        // Still flying: clients draw it on from here; its landing comes as an `impact` event.
        to.push(tuple(b.pos));
        hits.push(null);
        zones.push(0);
        flying.push(p);
        this.bullets.push(b);
      }
    }
    this.pendingEvents.push({
      e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to, hit: hits,
      ...(zones.some((z) => z) ? { z: zones } : {}),
      v: Math.round(phys.speed), g: r3(phys.gravity),
      ...(flying.length ? { fl: flying } : {}),
      ...(armored ? { ar: 1 as const } : {}),
      ...(marks.length ? { pn: marks } : {}),
    });
    for (const end of ends) this.bulletHit(shooter, def, end);
  }

  /** Bullets in flight: one tick each (sub-stepped), against the live world. */
  private stepBullets(): void {
    if (!this.bullets.length) return;
    const keep: Bullet[] = [];
    // Who each bullet can hit, built once per side for the pass (nobody moves during it): in a
    // big fight hundreds of rounds are in the air from dozens of shooters on two sides.
    const targets = new Map<number | string, ShotTargets>();
    for (const b of this.bullets) {
      if (b.born === this.tick) {
        keep.push(b);
        continue;
      }
      const side = this.actor(b.owner)?.faction;
      const key = side === null || side === undefined ? b.owner : side;
      let list = targets.get(key);
      if (!list) targets.set(key, (list = this.liveTargets(b.owner)));
      const end = this.flyTick(b, list);
      if (!end) {
        keep.push(b);
        continue;
      }
      const owner = this.actor(b.owner) ?? null;
      this.pendingEvents.push({
        e: 'impact', s: b.owner, w: b.trig.id, from: tuple(b.origin), to: tuple(end.at), hit: end.victim?.slot ?? null,
        ...(end.zone ? { z: end.zone } : {}),
        ...(end.victim && end.victim.armor > 0 ? { ar: 1 as const } : {}),
        ...(b.marks.length ? { pn: b.marks } : {}),
        ...(end.gone ? { gone: 1 as const } : {}),
      });
      this.bulletHit(owner, b.trig, end);
    }
    this.bullets = keep;
  }

  /** Living actors a bullet of `owner`'s can hit, where they are now (allies are passed through unless friendly fire is on, as with every shot). */
  private liveTargets(owner: number): ShotTargets {
    const shooter = this.actor(owner);
    if (shooter) return this.targetsFor(shooter, 0);
    return this.actors()
      .filter((o) => o.alive && o.slot !== owner && !this.sheltered(o))
      .map((o) => this.shotBody(o));
  }

  /** One tick of flight (BULLET_SUBSTEPS segments). Returns where it ended, or null while it flies on. */
  private flyTick(b: Bullet, targets: ShotTargets): BulletEnd | null {
    const dt = TICK_DT / BULLET_SUBSTEPS;
    for (let i = 0; i < BULLET_SUBSTEPS; i++) {
      const seg = flyBullet(b, b.gravity, b.drag, dt);
      b.age += dt;
      const end = this.bulletSegment(b, seg.from, seg.to, targets);
      if (end) return end;
      if (b.travelled >= b.trig.range || b.age >= BULLET_LIFETIME || b.pos.y < this.killY) return { at: { ...b.pos }, victim: null, zone: 0, damage: 0, dir: normalize(b.vel), gone: true };
    }
    return null;
  }

  /**
   * Test the straight piece of flight a → c against players and the world.
   * Returns the bullet's end when it stops (a body, or a surface it can't get
   * through). Otherwise the bullet is moved on: to c, or out of the far side
   * of a surface it went through (energy-based penetration, spec §8), or off a
   * surface it glanced off (rare, bounded ricochets).
   */
  private bulletSegment(b: Bullet, a: Vec3, c: Vec3, targets: ShotTargets): BulletEnd | null {
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const dz = c.z - a.z;
    const len = hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const u = { x: dx / len, y: dy / len, z: dz / len };
    const wall = this.physics.raycastNormal(a, u, len);
    let best = wall?.dist ?? Infinity;
    let victim: ShotTargets[number] | null = null;
    let zone: HitZone = 0;
    // Only bodies near the segment are worth the capsule test.
    const mx = (a.x + c.x) / 2;
    const mz = (a.z + c.z) / 2;
    const reach = len / 2 + 2;
    for (const t of targets) {
      if (Math.abs(t.feet.x - mx) > reach || Math.abs(t.feet.z - mz) > reach || (t.who && !t.who.alive)) continue;
      const d = rayTarget(a, u, t, Math.min(len, best));
      if (d !== null && d <= len && d < best) {
        best = d;
        victim = t;
        zone = lastHit.zone;
      }
    }
    // Water soaks up energy on the way to whatever is hit (spec §8): a pistol round dies in a metre of it,
    // a rifle round comes out the far side slower and weaker.
    const wet = this.liquids.length ? waterSpan(this.liquids, a, u, Math.min(len, best)) : null;
    if (wet) {
      const left = penetrate(b.energy, 'water', wet.length);
      if (left === null) {
        const stop = wet.enter + Math.max(0, b.energy - PENETRATION_MIN_ENERGY) / MATERIAL_BALLISTICS.water.resist;
        return { at: add(a, scale(u, stop)), victim: null, zone: 0, damage: 0, dir: u };
      }
      const kept = left / b.energy;
      b.energy = left;
      b.vel = scale(b.vel, Math.sqrt(kept));
      b.scale *= kept;
    }
    // Breakable glass before whatever stops it shatters, and the round goes on a little weaker (GLASS.passDamage).
    const panes = this.scenario.shootGlass(a, u, Math.min(best, len), b.owner);
    if (panes) {
      b.scale *= GLASS.passDamage ** panes;
      b.energy = Math.max(PENETRATION_MIN_ENERGY, b.energy - penetrationLoss('glass', GLASS.thickness) * panes);
    }
    if (victim) {
      const at = add(a, scale(u, best));
      const gp = gunplayOf(getWeapon(b.trig.id));
      const damage = b.trig.damage * zoneScale(gp, zone) * falloffAt(gp.falloff, b.travelled + best) * b.scale;
      return { at, victim: this.actor(victim.slot) ?? null, zone, damage, dir: u };
    }
    if (wall) {
      const at = add(a, scale(u, wall.dist));
      const mat = this.materialAt(wall.handle);
      const spec = MATERIAL_BALLISTICS[mat];
      // The round hurts what it strikes: vehicles, turrets and sandbags as any shot does; doors, crates and
      // glass by their material (glass shatters, concrete barely chips).
      const owner = this.actor(b.owner) ?? null;
      const raw = owner ? this.boosted(owner, b.trig.damage * b.scale) : b.trig.damage * b.scale;
      this.noteTargetHit(owner, wall.handle, raw * falloffAt(gunplayOf(getWeapon(b.trig.id)).falloff, b.travelled + wall.dist), at);
      if (!this.damageMountBody(wall.handle, raw, owner, 'bullet', b.trig.id) && spec.destruction > 0) this.scenario.damageBody(wall.handle, raw * spec.destruction, b.owner);
      // Ricochet: only grazing hits on hard surfaces, at most once, and the round comes off weakened.
      const n = wall.normal;
      const grazing = Math.asin(Math.min(1, Math.abs(u.x * n.x + u.y * n.y + u.z * n.z)));
      if (b.rics < MAX_RICOCHETS && spec.ricochet > 0 && grazing < RICOCHET_MAX_ANGLE && ricochets(mat, grazing, this.rng())) {
        const vn = b.vel.x * n.x + b.vel.y * n.y + b.vel.z * n.z;
        b.vel = scale({ x: b.vel.x - 2 * vn * n.x, y: b.vel.y - 2 * vn * n.y, z: b.vel.z - 2 * vn * n.z }, 0.6);
        b.pos = add(at, scale(n, 0.02));
        b.scale *= 0.5;
        b.energy *= 0.4;
        b.rics++;
        b.travelled += wall.dist;
        b.marks.push(tuple(at));
        return null;
      }
      // Penetration: energy against what is in the way, how thick it is.
      if (b.pens < MAX_PENETRATIONS && this.rules.ballistics !== 'arcade') {
        const exit = this.exitPoint(at, u);
        if (exit) {
          const thick = distance(at, exit);
          const left = penetrate(b.energy, mat, thick);
          if (left !== null) {
            const kept = left / b.energy;
            b.energy = left;
            b.vel = scale(b.vel, Math.sqrt(kept));
            b.scale *= kept;
            b.pens++;
            b.travelled += wall.dist + thick;
            b.pos = add(exit, scale(u, 0.01));
            b.marks.push(tuple(at));
            return null;
          }
        }
      }
      return { at, victim: null, zone: 0, damage: 0, dir: u };
    }
    b.travelled += len;
    return null;
  }

  /** Where a ray entering a surface at `at` comes out (null: thicker than a metre or so, or solid all the way). */
  private exitPoint(at: Vec3, u: Vec3): Vec3 | null {
    const probe = 1.2;
    const start = add(at, scale(u, probe));
    const back = this.physics.raycastHit(start, scale(u, -1), probe - 0.005);
    if (!back || back.dist <= 0.001) return null;
    return add(start, scale(u, -back.dist));
  }

  /** What a collider is made of, ballistically (gunplay.ts). */
  private materialAt(handle: number): BallisticMaterial {
    const mount = this.mountBodies.get(handle);
    if (mount) {
      const surface = mount.def.armour?.surface;
      return surface ? (SURFACE_TYPES[surface as keyof typeof SURFACE_TYPES]?.ballistic ?? 'metal') : 'metal';
    }
    if (this.covers.some((c) => c.body.handle === handle)) return 'soil';
    const i = this.scenario.bodies.entityAt(handle);
    if (i !== undefined) {
      // Bulletproof glass (shots only ever strike that kind: breakable panes are shot through).
      if (glassAt(this.map, i)) return 'armor';
      const e = this.map.entities[i];
      return e ? entityMaterial(e) : 'concrete';
    }
    // Environment shapes (trunks, limbs, boulders, cliffs) are made of their species' surface.
    const env = this.physics.shapeAt(handle);
    if (env) return SURFACE_TYPES[env.surface].ballistic;
    const box = this.physics.boxAt(handle);
    if (!box) return 'concrete';
    if (box.kind === 'prop') {
      const e = this.entityById(box.sourceId);
      return e ? entityMaterial(e) : 'wood';
    }
    // Free blocks and Style Pack pieces carry their own material; tile structure is structural.
    return box.surface ? surfaceMaterial(box.surface.material) : 'concrete';
  }

  private entityIds?: Map<string, MapDocument['entities'][number]>;
  private entityById(id: string): MapDocument['entities'][number] | undefined {
    this.entityIds ??= new Map(this.map.entities.map((e) => [e.id, e]));
    return this.entityIds.get(id);
  }

  /** A bullet struck someone: damage, status and push. */
  private bulletHit(shooter: Combatant | null, def: Trigger, end: BulletEnd): void {
    const victim = end.victim;
    if (!victim) return;
    this.damage(victim, end.damage, shooter, def.id, end.zone === 1);
    if (def.status) this.applyStatus(victim, def.status, shooter, def.id);
    this.stagger(victim, this.powerOf(def.id), end.dir, end.damage / Math.max(1, def.damage * Math.max(1, def.pellets)));
    if (def.knockback) this.push(victim, end.dir, def.knockback * (end.damage / Math.max(1, def.damage)));
  }

  /** A lying spear or disc goes to the first living player close by who has a throw of it to spare. */
  private retrieve(p: Projectile): boolean {
    const code = weaponCode(getWeapon(p.weapon));
    const disc = !!p.spec.disc;
    // A disc that just knocked someone over drops at their feet: not theirs at once.
    if (this.tick < (p.armAt ?? 0)) return false;
    for (const c of this.actors()) {
      if (!c.alive || distance(c.move.pos, p.pos) > 1.6) continue;
      const w = c.weapons.get(code);
      if (!w || w.mag >= w.def.magazine) continue;
      w.mag++;
      if (c.current !== code) this.switchTo(c, code);
      this.pendingEvents.push({ e: 'pickup', s: c.slot, id: `${disc ? 'disc' : 'spear'}_${p.id}`, item: lyingItem(p)?.id ?? 'core.weapon_spear' });
      return true;
    }
    return false;
  }

  private explode(p: Projectile, at: Vec3): void {
    const spec = p.spec;
    const owner = this.actor(p.owner) ?? null;
    if (spec.disc) {
      // Its flight is over: the disc drops to the ground there for anyone to pick up, like ammo (extras just
      // vanish). Over the void it goes back to its thrower, and so does one left lying (stepProjectiles).
      if (p.extra) return;
      const down = this.physics.raycastHit({ x: at.x, y: at.y + 0.2, z: at.z }, { x: 0, y: -1, z: 0 }, DISC_DROP_REACH);
      if (!down) {
        const w = owner?.weapons.get(weaponCode(getWeapon(p.weapon)));
        if (w) w.mag = Math.min(w.def.magazine, w.mag + 1);
        return;
      }
      this.projectiles.push({ ...p, id: this.nextProjectileId++, spec: { ...spec, retrievable: true }, pos: { x: at.x, y: at.y + 0.2 - down.dist + 0.1, z: at.z }, vel: { x: 0, y: 0, z: 0 }, stuck: true, ticksLeft: Math.round(DISC_LIE_SECONDS * TICK_RATE), armAt: this.tick + Math.round(DISC_PICKUP_DELAY * TICK_RATE) });
      return;
    }
    if (spec.splashRadius > 0) this.pendingEvents.push({ e: 'explode', s: p.owner, p: tuple(at), r: spec.splashRadius, w: p.weapon });
    if (spec.splashRadius > 0) this.splash(at, spec.splashRadius, spec.splashDamage, spec.splashEdgeDamage, owner, p.weapon, spec.selfDamageScale, blastKnockback(spec), spec.status);
    // Flames, flares and real explosions set oil alight.
    if (spec.ignites || spec.splashDamage >= 30) this.ignite(at, Math.max(1, spec.splashRadius));
    if (spec.zone) this.spawnZone(spec.zone, at, p.owner, p.weapon);
    if (spec.cluster) {
      // Bomblets thrown out and up all round.
      for (let i = 0; i < spec.cluster.count; i++) {
        const a = ((i + this.rng() * 0.6) / spec.cluster.count) * Math.PI * 2;
        const up = 0.55 + this.rng() * 0.35;
        const out = Math.sqrt(1 - up * up);
        this.spawnProjectile(p.owner, spec.cluster.spec, p.weapon, { x: at.x, y: at.y + 0.2, z: at.z }, scale({ x: Math.cos(a) * out, y: up, z: Math.sin(a) * out }, spec.cluster.speed));
      }
    }
    if (spec.airstrike) {
      // Bombs in a line along the thrower's facing, falling from high above the marker.
      const yaw = owner?.yaw ?? 0;
      const f = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
      const n = spec.airstrike.count;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * spec.airstrike.spacing;
        this.spawnProjectile(p.owner, spec.airstrike.bomb, p.weapon, { x: at.x + f.x * off, y: at.y + spec.airstrike.height + i * 1.5, z: at.z + f.z * off }, { x: 0, y: -8, z: 0 });
      }
      this.pendingEvents.push({ e: 'msg', text: 'Airstrike inbound!', secs: 3 });
    }
    if (spec.cover) this.deployCover(p, at, spec.cover);
  }

  /** A sandbag wall on the ground where it landed, square to the thrower; nothing when someone stands in the way. */
  private deployCover(p: Projectile, at: Vec3, cover: NonNullable<ProjectileSpec['cover']>): void {
    const owner = this.actor(p.owner);
    const yaw = owner?.yaw ?? Math.atan2(p.vel.x, p.vel.z);
    // Back off a wall it struck so the bags sit in front of it.
    const back = { x: -Math.sin(yaw) * 0.35, z: -Math.cos(yaw) * 0.35 };
    const from = { x: at.x + back.x, y: at.y + 0.4, z: at.z + back.z };
    const down = this.physics.raycastHit(from, { x: 0, y: -1, z: 0 }, 6);
    if (!down) return;
    const pos = { x: from.x, y: from.y - down.dist, z: from.z };
    const half = { x: cover.half[0], y: cover.half[1], z: cover.half[2] };
    const reach = hypot(half.x, half.z) + PLAYER.radius;
    for (const c of this.actors()) {
      if (c.alive && hypot(c.move.pos.x - pos.x, c.move.pos.z - pos.z) < reach && c.move.pos.y < pos.y + half.y * 2 && c.move.pos.y + PLAYER.height > pos.y) {
        // Hand the bag back rather than wasting it.
        if (owner?.alive && (!owner.throwable || owner.throwable.kind === 'sandbag')) owner.throwable = { kind: 'sandbag', count: Math.min(THROWABLE_DEFS.sandbag.max, (owner.throwable?.count ?? 0) + 1) };
        return;
      }
    }
    const body = this.physics.createBox({ x: pos.x, y: pos.y + half.y, z: pos.z }, half, yaw);
    this.physics.commit();
    this.covers.push({ id: this.nextCoverId++, pos, yaw, half, health: cover.health, max: cover.health, body });
    if (this.covers.length > MAX_COVERS) this.removeCover(this.covers[0]!);
  }

  private removeCover(cv: Cover): void {
    this.covers = this.covers.filter((c) => c !== cv);
    this.physics.removeCollider(cv.body);
    this.physics.commit();
  }

  private damageCover(cv: Cover, amount: number): void {
    cv.health -= amount;
    if (cv.health > 0) return;
    this.removeCover(cv);
  }

  /**
   * Hook the surface you're aiming at and get yanked toward it: the launch is
   * aimed a little above the hook (gravity pulls the arc down) and capped so
   * a long throw doesn't fling you through the far wall.
   */
  private fireGrapple(shooter: Combatant, eye: Vec3, aim: Vec3, def: { id: string; range: number }, speed: number): void {
    const dist = this.physics.raycastWorld(eye, aim, def.range);
    if (dist === null || dist < 1.5) {
      this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to: [tuple(add(eye, scale(aim, dist ?? def.range)))], hit: [null] });
      return;
    }
    const hook = add(eye, scale(aim, dist));
    const feet = shooter.move.pos;
    const to = { x: hook.x - feet.x, y: hook.y - feet.y - 0.6, z: hook.z - feet.z };
    const flat = hypot(to.x, to.z);
    const t = Math.max(0.25, hypot(flat, to.y) / speed);
    const h = flat || 1;
    const along = Math.min(speed, flat / t);
    shooter.move = {
      ...shooter.move,
      vx: (to.x / h) * along,
      vz: (to.z / h) * along,
      velY: Math.min(speed * 1.1, Math.max(4, to.y / t + PLAYER.gravity * t * 0.5)),
      grounded: false,
    };
    this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to: [tuple(hook)], hit: [null] });
  }

  /** Heal the hurt teammate you're aiming at within reach, or else yourself. */
  private useMedkit(shooter: Combatant, eye: Vec3, aim: Vec3, amount: number, range: number): void {
    let best: Combatant | null = null;
    let bestD = range;
    for (const c of this.actors()) {
      if (c === shooter || !c.alive || this.hostile(shooter, c) || c.health >= c.maxHealth) continue;
      const d = rayCapsule(eye, aim, c.move.pos, PLAYER.radius * c.size + 0.3, bodyHeightOf(c.move, c.size));
      if (d !== null && d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    const target = best ?? (shooter.health < shooter.maxHealth ? shooter : null);
    if (!target) return;
    const n = Math.min(amount, target.maxHealth - target.health);
    target.health += n;
    this.pendingEvents.push({ e: 'heal', s: shooter.slot, t: target.slot, n });
  }

  private spawnProjectile(owner: number, spec: ProjectileSpec, weapon: string, pos: Vec3, vel: Vec3): void {
    this.projectiles.push({ id: this.nextProjectileId++, owner, spec, weapon, pos, vel, ticksLeft: Math.round(spec.fuseSeconds * TICK_RATE), age: OWNER_GRACE_TICKS });
  }

  /** Laser-guided rockets turn toward whatever their shooter is aiming at. */
  private guide(p: Projectile, owner: Combatant, turnRate: number): void {
    const eye = { x: owner.move.pos.x, y: owner.move.pos.y + eyeHeightOf(owner.move, owner.size), z: owner.move.pos.z };
    const look = viewDirection(owner.yaw, owner.pitch);
    const hit = this.physics.raycastWorld(eye, look, 300);
    const target = add(eye, scale(look, hit ?? 300));
    const to = sub(target, p.pos);
    const d = hypot(to.x, to.y, to.z);
    if (d < 0.5) return;
    const speed = hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
    const k = Math.min(1, turnRate * TICK_DT);
    p.vel = scale(normalize(add(scale(p.vel, (1 - k) / speed), scale(to, k / d))), speed);
  }

  /**
   * A walker's step on the ground: forward at its pace, falling when the ground
   * drops away, hopping at low obstacles and turning at walls. Bursts on an enemy
   * (or when the fuse runs out). Returns whether it is still going.
   */
  private walk(p: Projectile, owner: Combatant | null): boolean {
    const spec = p.spec;
    const speed = spec.walker!.speed;
    if (--p.ticksLeft <= 0 || p.pos.y < this.killY) {
      this.explode(p, p.pos);
      return false;
    }
    for (const c of this.actors()) {
      if (!c.alive || (owner && c === owner) || (owner && !this.hostile(owner, c))) continue;
      if (horizontalDistance(c.move.pos, p.pos) < 0.9 && Math.abs(c.move.pos.y + 0.6 - p.pos.y) < 1.4) {
        this.explode(p, p.pos);
        return false;
      }
    }
    let h = p.heading!;
    if (p.hopIn) p.hopIn--;
    const ahead = this.physics.raycastWorld({ x: p.pos.x, y: p.pos.y + 0.3, z: p.pos.z }, h, 0.5);
    if (ahead !== null) {
      // Something in the way: hop it if it's low, otherwise turn.
      const high = this.physics.raycastWorld({ x: p.pos.x, y: p.pos.y + 1.3, z: p.pos.z }, h, 0.6);
      if (high === null && !p.hopIn && p.vel.y === 0) {
        p.vel = { x: 0, y: 6, z: 0 };
        p.hopIn = 30;
      } else if (p.vel.y === 0) {
        h = p.heading = { x: h.z, y: 0, z: -h.x };
      }
    }
    let vy = p.vel.y - spec.gravity * TICK_DT;
    const next = { x: p.pos.x + h.x * speed * TICK_DT, y: p.pos.y + vy * TICK_DT, z: p.pos.z + h.z * speed * TICK_DT };
    if (this.physics.raycastWorld({ x: next.x, y: next.y + 0.3, z: next.z }, h, 0.2) !== null) {
      next.x = p.pos.x;
      next.z = p.pos.z;
    }
    const ground = vy <= 0 ? this.physics.raycastWorld({ x: next.x, y: p.pos.y + 0.3, z: next.z }, { x: 0, y: -1, z: 0 }, 0.3 + Math.max(0.05, -vy * TICK_DT)) : null;
    if (ground !== null) {
      next.y = p.pos.y + 0.3 - ground;
      vy = 0;
    }
    p.vel = { x: 0, y: vy, z: 0 };
    p.pos = next;
    return true;
  }

  /** Swarm missiles turn toward the nearest enemy ahead of them that they can see. */
  private steer(p: Projectile, owner: Combatant, homing: NonNullable<ProjectileSpec['homing']>): void {
    const speed = hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
    const fwd = scale(p.vel, 1 / speed);
    let best: Vec3 | null = null;
    let bestD = homing.range;
    for (const c of this.actors()) {
      if (!c.alive || c === owner || !this.hostile(owner, c)) continue;
      const to = sub(chest(c.move.pos), p.pos);
      const d = hypot(to.x, to.y, to.z);
      if (d > bestD || dot(to, fwd) < d * 0.3) continue;
      if (!this.sees(p.pos, chest(c.move.pos))) continue;
      best = scale(to, 1 / d);
      bestD = d;
    }
    if (!best) return;
    const k = Math.min(1, homing.turnRate * TICK_DT);
    p.vel = scale(normalize(add(scale(fwd, 1 - k), scale(best, k))), speed);
  }

  // ---------------------------------------------------------------- turrets, sentries and vehicles

  private addMount(index: number, def: MountDef, pos: Vec3, yaw: number, faction: string | null, respawnSeconds: number | null, floats = false): void {
    const half = { x: def.half[0], y: def.half[1], z: def.half[2] };
    const body = this.physics.createBox({ x: pos.x, y: pos.y + half.y, z: pos.z }, half, yaw);
    const probe = def.vehicle ? this.physics.createVehicleProbe(Math.min(half.x, half.z) * 0.95) : null;
    const lowProbe = def.vehicle && !def.vehicle.fly ? this.physics.createLowVehicleProbe(Math.min(half.x, half.z) * 0.95, half.y * 2) : null;
    const m: MountRt = {
      index,
      def,
      home: { pos: { ...pos }, yaw },
      pos: { ...pos },
      yaw,
      velY: 0,
      speed: 0,
      push: { x: 0, z: 0 },
      aimYaw: yaw,
      aimPitch: 0,
      health: def.health,
      alive: true,
      respawnAt: 0,
      respawnTicks: Math.round((respawnSeconds ?? def.respawnSeconds) * TICK_RATE),
      seats: def.seats.map(() => null),
      guns: def.seats.map((seat) => (seat.weapon ? { def: getWeapon(seat.weapon), mag: 0, reserve: 0, alt: 0, heat: 0, ...(seat.ammo ? { shells: seat.ammo.start ?? seat.ammo.max, shellTicks: 0 } : {}) } : null)),
      ammoGuns: def.seats.some((seat) => !!seat.weapon && !!seat.ammo),
      body,
      probe,
      lowProbe,
      low: false,
      faction,
      drive: { forward: 0, right: 0 },
      slide: 0,
      airborne: false,
      floats,
      afloat: false,
      cooldown: 0,
      lastHitBy: null,
      runOver: new Map(),
      burning: false,
      wreckUntil: 0,
      vel: { x: 0, z: 0 },
      rammed: new Map(),
      stall: 0,
      climbAssist: 0,
      assistFrom: null,
    };
    const setup = suspensionOf(def);
    if (setup) {
      m.suspSetup = setup;
      m.susp = newSuspension(setup);
    }
    this.mounts.push(m);
    this.mountBodies.set(body.handle, m);
  }

  private seatOf(c: Combatant): SeatDef | null {
    if (!c.mount) return null;
    return this.mounts[c.mount.index]?.def.seats[c.mount.seat] ?? null;
  }

  /** Aboard a sealed vehicle that still stands (MountArmour.sealed, the Tank): out of reach of everything outside. */
  private sheltered(c: Combatant): boolean {
    if (!c.mount) return false;
    const m = this.mounts[c.mount.index];
    return !!m && m.alive && sealedMount(m.def);
  }

  /** The seat whose gun this rider fires (their own, or the driver's on an empty driverFires seat: mounts.ts firingSeat), or null. */
  private gunSeatOf(c: Combatant): number | null {
    if (!c.mount) return null;
    const m = this.mounts[c.mount.index];
    return m ? firingSeat(m.def, c.mount.seat, (i) => m.seats[i] !== null) : null;
  }

  /**
   * `yaw` kept within seat `seat`'s arc on mount `m` (all round: unchanged). `driver`: for a driver working the
   * seat's gun (driverFires), whose arc may be narrower (SeatDef.driverArc).
   */
  private arcYaw(m: MountRt, seat: number, yaw: number, driver = false): number {
    const s = m.def.seats[seat];
    const arc = driver ? (s?.driverArc ?? s?.arc) : s?.arc;
    if (!s || arc === undefined) return yaw;
    const centre = m.yaw + (s.facing ?? 0);
    const d = Math.atan2(Math.sin(yaw - centre), Math.cos(yaw - centre));
    return centre + Math.max(-arc, Math.min(arc, d));
  }

  /**
   * A turret with a traverse rate (MountDef.turret.traverse): is its barrel on the aim of `c`, who works its gun?
   * True for every other gun. The gun holds its shot until it is (the trigger held, it fires as the barrel arrives),
   * so a round always goes where its gunner is looking.
   */
  private turretOnAim(c: Combatant): boolean {
    const m = c.mount ? this.mounts[c.mount.index] : undefined;
    const t = m?.def.turret;
    if (!m || !t?.traverse) return true;
    const gunSeat = this.gunSeatOf(c);
    if (gunSeat !== t.seat) return true;
    const want = gunSeat === c.mount!.seat ? c.yaw : this.arcYaw(m, gunSeat, c.yaw, true);
    return Math.abs(Math.atan2(Math.sin(want - m.aimYaw), Math.cos(want - m.aimYaw))) <= TURRET_ON_AIM;
  }

  /** Where a seat's occupant stands right now. */
  private seatFeet(m: MountRt, seat: number): Vec3 {
    return mountToWorld(m.pos, m.yaw, m.def.seats[seat]!.offset);
  }

  /**
   * A rider's movement state in a seat: on the seat point; sitting (a real seat) takes the crouching eye and height,
   * and so does a rider in a standing place who ducks (`crouch`: Combatant.rideCrouch).
   */
  private seatMove(m: MountRt, seat: number, crouch = false): MoveState {
    const pos = this.seatFeet(m, seat);
    return m.def.seats[seat]!.seated || crouch ? { pos, velY: 0, grounded: true, stance: 1 } : { pos, velY: 0, grounded: true };
  }

  /** Climb into the nearest turret or vehicle in reach with a free seat (driver first, then gunner, then passengers). */
  private enterMount(c: Combatant): boolean {
    let best: MountRt | null = null;
    let bestD = Infinity;
    for (const m of this.mounts) {
      if (!m.alive || !m.def.seats.length || !m.seats.includes(null)) continue;
      if (m.def.vehicle && this.mode?.blocksVehicle(c)) continue;
      // Near its centre or its hull (a long hull, or one wedged with only its nose clear: sim/mounts.ts enterReach).
      const d = enterReach(m.def, m.pos, m.yaw, c.move.pos);
      if (d !== null && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (!best) return false;
    const order: SeatRole[] = ['driver', 'gunner', 'passenger'];
    let seat = -1;
    for (const role of order) {
      seat = best.def.seats.findIndex((s, i) => s.role === role && best!.seats[i] === null);
      if (seat >= 0) break;
    }
    if (seat < 0) return false;
    best.seats[seat] = c.slot;
    c.mount = { index: this.mounts.indexOf(best), seat };
    c.move = this.seatMove(best, seat);
    c.reloadTicks = 0;
    c.windup = 0;
    c.burstLeft = 0;
    this.pendingEvents.push({ e: 'mount', s: c.slot, m: best.index, seat });
    return true;
  }

  /** Get out (beside the mount, where there is room), or just free the seat (death, leaving the match). */
  leaveMount(c: Combatant, step: boolean): void {
    if (!c.mount) return;
    const m = this.mounts[c.mount.index];
    const seat = c.mount.seat;
    c.mount = undefined;
    c.rideCrouch = false;
    if (!m) return;
    m.seats[seat] = null;
    if (m.def.seats[seat]?.role === 'driver') m.drive = { forward: 0, right: 0 };
    this.pendingEvents.push({ e: 'mount', s: c.slot, m: m.index, seat: -1 });
    this.planeDrops.delete(c.slot);
    if (!step) return;
    if (m.route) {
      // Out of the plane's tail ramp, carried along by its speed; the automatic opener is armed.
      const pose = routePose(m.route, this.routeTick(m));
      const at = mountToWorld(m.pos, m.yaw, [0, -1.5, -m.def.half[2] - 1]);
      c.move = { pos: at, velY: 0, grounded: false, vx: pose.vel.x * 0.5, vz: pose.vel.z * 0.5, drop: true };
      return;
    }
    const [hx, , hz] = m.def.half;
    for (const o of [[-(hx + 0.9), 0, 0], [hx + 0.9, 0, 0], [0, 0, -(hz + 0.9)], [0, 0, hz + 0.9]] as const) {
      const spot = mountToWorld(m.pos, m.yaw, o);
      // Room to stand: nothing solid from the knees to above the head (a ray starting inside a wall hits at once).
      if (this.physics.raycastHit({ x: spot.x, y: spot.y + 0.4, z: spot.z }, { x: 0, y: 1, z: 0 }, PLAYER.height)) continue;
      if (!this.exitReachable(m, o, spot)) continue;
      c.move = this.bailOut({ x: spot.x, y: spot.y + 0.3, z: spot.z });
      return;
    }
    c.move = this.bailOut({ x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z });
  }

  /**
   * A side's step-out spot (leaveMount) is on this side of whatever the hull is parked against: nothing solid (a wall,
   * a fence) between the hull's face and the spot, at the knees and at the chest; and ground under it within
   * EXIT_STEP_DOWN (or water; a flyer's rider may step out anywhere, under the parachute when high): a buggy parked along Riot Junction's east wall put a
   * rider beyond the wall, over the void outside the street, and it fell to the slab 4 m under the street with no
   * way out (gunplay pass 3's find).
   */
  private exitReachable(m: MountRt, o: readonly [number, number, number], spot: Vec3): boolean {
    const len = Math.hypot(o[0], o[2]);
    const face = Math.abs(o[0]) > 0 ? m.def.half[0] : m.def.half[2];
    const dir = { x: (spot.x - m.pos.x) / len, y: 0, z: (spot.z - m.pos.z) / len };
    const reach = len - face + PLAYER.radius;
    for (const h of [0.5, 1.2]) {
      const from = { x: m.pos.x + dir.x * (face + 0.02), y: spot.y + h, z: m.pos.z + dir.z * (face + 0.02) };
      if (this.physics.moveRay(from, dir, reach) !== null) return false;
    }
    // (A flyer in the air: out under the parachute. Afloat: into the water.)
    if (m.def.vehicle?.fly || liquidAt(this.liquids, { x: spot.x, y: spot.y + 0.1, z: spot.z })) return true;
    return this.physics.moveRay({ x: spot.x, y: spot.y + 0.4, z: spot.z }, { x: 0, y: -1, z: 0 }, 0.4 + EXIT_STEP_DOWN) !== null;
  }

  /** Stepping out at `at`: high up (a flyer in the air), the parachute's automatic opener is armed. */
  private bailOut(at: Vec3): MoveState {
    const high = heightAboveGround(this.physics, at, CHUTE.minHeight + 1) === null;
    return { pos: at, velY: 0, grounded: false, ...(high ? { drop: true } : {}) };
  }

  /**
   * A bot riding the plane: it picks where to come down (its side's
   * objective or base) and jumps when the plane passes over it, then
   * parachutes in. It never presses E or jump aboard otherwise.
   */
  private planeBot(c: Combatant, input: PlayerInput): void {
    const m = c.mount ? this.mounts[c.mount.index] : undefined;
    if (!m?.route) return;
    input.buttons &= ~(BUTTON_USE | BUTTON_JUMP);
    const drops = this.dropPlanFor(m);
    // Stay aboard through the countdown (and pick where to come down once play has begun: the mode has handed out
    // its roles by then, on play's first tick).
    if (this.phase !== 'playing' || this.routeTick(m) < 1) return;
    let plan = this.planeDrops.get(c.slot);
    if (!plan) {
      const objective = dropTarget(this.map, c.faction, this.rng(), this.rules.mode);
      // Where the mode sends it, when it does (a CTF defender comes down by its own flag, not the enemy's: before,
      // the whole planeload jumped over the enemy flag and the defenders walked home from there), else its side's
      // objective or base.
      const goal = this.mode?.botGoal(c, [])?.pos;
      const target = goal ? { ...goal } : objective;
      // The good stretch nearest its target where it lands on ground it can walk on from.
      const at = botDropIndex(drops, m.route, target, dropOffsets(m.route, m.def.half[2])[1], this.rng());
      this.planeDrops.set(c.slot, (plan = { target, ...(at >= 0 ? { at } : {}) }));
    }
    if (!canDrop(drops, m.route, this.routeTick(m))) return;
    if (plan.at !== undefined) {
      if (dropIndex(drops, m.route, this.routeTick(m)) === plan.at) input.buttons |= BUTTON_USE;
      return;
    }
    const { jump, dist } = shouldJump(m.pos, plan.target, plan.prev, ticksToRouteEnd(m.route, this.routeTick(m)));
    plan.prev = dist;
    if (jump) input.buttons |= BUTTON_USE;
  }

  /** Ticks a drop route has flown: its clock starts with play (the wait and countdown hold it at its first point). */
  private routeTick(m: MountRt): number {
    return Math.max(0, this.tick - (m.routeT0 ?? 0));
  }

  /**
   * Where riders of a drop route may jump out: over the map's play area
   * (dropArea), above a floor or the terrain (not the void), clear of lava
   * and acid; bots also want ground on their navmesh. Worked out once.
   */
  dropPlanFor(m: MountRt): DropPlan {
    if (m.drops) return m.drops;
    const route = m.route!;
    const area = dropArea(this.map);
    const ground = (x: number, z: number): number | null => {
      if (area && (x < area.x0 || x > area.x1 || z < area.z0 || z > area.z1)) return null;
      const top = route.y - 4;
      const d = this.physics.raycastWorld({ x, y: top, z }, { x: 0, y: -1, z: 0 }, top - this.killY);
      if (d === null) return null;
      const y = top - d;
      if (y < this.killY + 2) return null;
      const wet = liquidAt(this.liquids, { x, y: y + 0.3, z });
      if (wet && (wet.liquid === 'lava' || wet.liquid === 'acid')) return null;
      return y;
    };
    const reach = (x: number, z: number): boolean => {
      const y = ground(x, z);
      if (y === null) return false;
      const q = this.nav.closestPoint({ x, y: y + 0.5, z }, { x: 2, y: 2, z: 2 });
      return !!q && Math.abs(q.y - y) < 1.5;
    };
    return (m.drops = dropPlan(route, (x, z) => ground(x, z) !== null, reach, dropOffsets(route, m.def.half[2])));
  }

  /** Whether a rider of mount `m` may jump out now; if not, they're told why (once a second at most). */
  private mayJumpOut(c: Combatant, m: MountRt): boolean {
    if (!m.route || canDrop(this.dropPlanFor(m), m.route, this.routeTick(m))) return true;
    if (!c.npc && this.tick - (this.dropHints.get(c.slot) ?? -Infinity) >= TICK_RATE) {
      this.dropHints.set(c.slot, this.tick);
      this.pendingEvents.push({ e: 'msg', text: `Not over the drop zone: you can jump when the ${m.def.displayName.toLowerCase()} is over the map`, secs: 2, s: c.slot });
    }
    return false;
  }

  /** Air drop: seat a spawning player in a transport plane with a free bench; false when there is none. */
  private boardPlane(c: Combatant): boolean {
    for (const m of this.mounts) {
      if (!m.route || m.airdrop === 'off' || m.airdrop === undefined) continue;
      if (m.airdrop === 'start' && this.airdropped.has(c.slot)) continue;
      const seat = m.seats.indexOf(null);
      if (seat < 0) continue;
      this.airdropped.add(c.slot);
      m.seats[seat] = c.slot;
      c.mount = { index: this.mounts.indexOf(m), seat };
      c.move = this.seatMove(m, seat);
      c.yaw = m.yaw;
      this.pendingEvents.push({ e: 'mount', s: c.slot, m: m.index, seat });
      return true;
    }
    return false;
  }

  /** Damage whatever mount owns this collider; false when it isn't one. */
  private damageMountBody(handle: number, amount: number, attacker: Combatant | null, hit: MountHit = 'other', weapon?: string): boolean {
    if (this.mode?.damageBody?.(handle, amount, attacker)) return true;
    const cv = this.covers.find((c) => c.body.handle === handle);
    if (cv) {
      this.damageCover(cv, amount);
      return true;
    }
    const m = this.mountBodies.get(handle);
    if (!m) return false;
    this.damageMount(m, amount, attacker, false, hit, weapon);
    return true;
  }

  /**
   * Hurt a mount. Vehicles take the match's vehicle damage share (tough:
   * half, off: none); `raw` skips that (fire, lava and water run on their
   * own clock). The attacker gets the credit when it blows; damage from
   * nobody (fire, crashes, water) leaves the last attacker's credit standing.
   * The transport plane can't be hurt. Armour (MountDef.armour) takes its share of bullets, blasts and melee (`hit`).
   * A vehicle takes `weapon`'s vehicleDamage multiple of it (rockets: more), before its armour's share.
   */
  private damageMount(m: MountRt, amount: number, attacker: Combatant | null, raw = false, hit: MountHit = 'other', weapon?: string): void {
    if (!m.alive || this.phase !== 'playing' || amount <= 0 || m.route) return;
    if (m.def.kind === 'vehicle' && !raw) amount *= VEHICLE_DAMAGE_SCALE[this.rules.vehicleDamage ?? 'normal'] * (weapon ? (CORE_WEAPONS[weapon]?.vehicleDamage ?? 1) : 1);
    amount *= armourScale(m.def, hit);
    if (amount <= 0) return;
    m.health -= amount;
    if (attacker) m.lastHitBy = attacker.slot;
    if (m.health > 0 && m.def.kind === 'vehicle' && m.health < m.def.health * MOUNT_BURN_FRACTION) m.burning = true;
    if (m.health <= 0) this.destroyMount(m);
  }

  /**
   * It blows up: everyone aboard is thrown out into the blast, which hurts
   * people, other mounts and destructibles (so barrels and gas cans nearby go
   * up too) and lights oil. A vehicle leaves a charred wreck that stays as
   * solid cover for a while; it comes back where it was placed later.
   * `wreck` false: nothing is left (it fell off the map).
   */
  private destroyMount(m: MountRt, wreck = true): void {
    m.alive = false;
    m.health = 0;
    m.burning = false;
    m.arc = undefined;
    m.respawnAt = this.tick + m.respawnTicks;
    const aboard = m.seats.map((slot) => (slot === null ? undefined : this.actor(slot))).filter((c): c is Combatant => !!c);
    const killer = m.lastHitBy === null ? null : (this.actor(m.lastHitBy) ?? null);
    // A sealed crew (the Tank's) dies with it, credited to whoever destroyed it; anyone else is thrown out into the blast.
    if (sealedMount(m.def) && wreck) for (const c of aboard) this.kill(c, killer === c ? null : killer, 'core.wreck');
    else for (const c of aboard) this.leaveMount(c, true);
    const keep = wreck && m.def.vehicle ? Math.min(MOUNT_WRECK_SECONDS * TICK_RATE, m.respawnTicks - Math.round(MOUNT_WRECK_FADE_SECONDS * TICK_RATE)) : 0;
    m.wreckUntil = keep > 0 ? this.tick + keep : 0;
    m.speed *= 0.4;
    m.slide *= 0.4;
    // The blast starts inside the body: take it out of the world while it goes off, or it would shield everything.
    this.physics.setBoxEnabled(m.body, false);
    this.physics.commit();
    const at = { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z };
    this.pendingEvents.push({ e: 'explode', s: m.lastHitBy ?? -1, p: tuple(at), r: m.def.blast.radius, m: m.index });
    const by = m.lastHitBy === null ? null : (this.actor(m.lastHitBy) ?? null);
    this.splash(at, m.def.blast.radius, m.def.blast.damage, m.def.blast.damage * 0.2, by, 'core.wreck', 1, 9);
    this.ignite(at, m.def.blast.radius);
    if (m.wreckUntil && !m.alive) {
      this.physics.setBoxEnabled(m.body, true);
      this.physics.commit();
    }
  }

  private respawnMount(m: MountRt): void {
    m.alive = true;
    m.health = m.def.health;
    m.burning = false;
    m.wreckUntil = 0;
    m.restSince = undefined;
    m.pos = { ...m.home.pos };
    m.yaw = m.aimYaw = m.home.yaw;
    m.aimPitch = 0;
    m.speed = m.velY = m.slide = 0;
    m.vel = { x: 0, z: 0 };
    m.airborne = m.afloat = false;
    m.push = { x: 0, z: 0 };
    m.lastHitBy = null;
    m.stall = m.climbAssist = 0;
    m.assistFrom = null;
    m.wedged = undefined;
    m.low = false;
    if (m.suspSetup) m.susp = newSuspension(m.suspSetup);
    m.guns.forEach((g, i) => {
      if (!g) return;
      g.heat = 0;
      g.overheated = false;
      const ammo = m.def.seats[i]?.ammo;
      if (ammo) {
        g.shells = ammo.start ?? ammo.max;
        g.shellTicks = 0;
      }
    });
    this.physics.setBoxEnabled(m.body, true);
    this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
  }

  private stepMounts(): void {
    const prof = simProfile.on;
    this.suspensionRays = 0;
    for (const m of this.mounts) {
      const t0 = prof ? performance.now() : 0;
      this.stepMount(m);
      // Profiling (bench --spikes): which kind of mount a slow tick went on.
      if (prof) simProfile.add(`mount ${m.def.kind}${m.seats.some((s) => s !== null) ? ' (manned)' : ''}`, performance.now() - t0);
    }
    // Moved bodies must be in place before this tick's shots and sight checks.
    if (this.mounts.length) this.physics.commit();
  }

  private stepMount(m: MountRt): void {
    {
      if (!m.alive) {
        // The wreck settles where it fell, then stops being solid while it fades; the mount respawns at home later.
        if (this.tick < m.wreckUntil) this.settleWreck(m);
        else if (m.wreckUntil) {
          m.wreckUntil = 0;
          this.physics.setBoxEnabled(m.body, false);
        }
        if (this.phase === 'playing' && this.tick >= m.respawnAt) this.respawnMount(m);
        return;
      }
      // Mounted guns cool whenever they are not firing.
      for (const g of m.guns) {
        if (!g?.def.heat || g.firedTick === this.tick) continue;
        g.heat = Math.max(0, (g.heat ?? 0) - g.def.heat.coolPerTick);
        if (g.heat === 0) g.overheated = false;
      }
      if (m.ammoGuns) this.resupply(m);
      if (m.route) this.flyPlane(m);
      if (m.def.vehicle) {
        // Empty vehicles far from every player (ambient traffic) drive every other tick, two ticks at a time.
        if (this.farVehicle(m) && !m.moveOwed && (this.tick + m.index) % 2 === 0) m.moveOwed = true;
        else {
          this.driveVehicle(m, m.moveOwed ? 2 : 1);
          m.moveOwed = false;
        }
      }
      if (m.def.sentry) this.runSentry(m);
      if (m.alive && m.def.vehicle) this.vehicleHazards(m);
      if (!m.alive) return;
      // Riders move with it; shooting their own guns from a moving one spreads like shooting on the run.
      m.seats.forEach((slot, seat) => {
        const c = slot === null ? undefined : this.actor(slot);
        if (!c?.alive) return;
        c.move = this.seatMove(m, seat, c.rideCrouch);
        c.moveSpeed = Math.abs(m.speed);
      });
    }
  }

  /**
   * Limited mounted ammunition (SeatDef.ammo): a round back every refillSeconds, and every round back when the
   * vehicle, crewed, stands over one of the ammo pickups the seat names (SeatAmmo.pickups: the Tank's cannon, the
   * Ammo Box only) that is up (which it takes, as a player would).
   */
  private resupply(m: MountRt): void {
    let short = false;
    m.guns.forEach((g, i) => {
      const ammo = m.def.seats[i]?.ammo;
      if (!g || !ammo || g.shells === undefined) return;
      if (g.shells >= ammo.max) {
        g.shellTicks = 0;
        return;
      }
      short = true;
      const every = ammoRefillTicks(ammo, TICK_RATE);
      if (every && (g.shellTicks = (g.shellTicks ?? 0) + 1) >= every) {
        g.shells++;
        g.shellTicks = 0;
      }
    });
    if (!short || (this.tick + m.index) % 6) return;
    const crew = m.seats.find((s) => s !== null);
    if (crew === undefined || crew === null) return;
    const reach = Math.max(m.def.half[0], m.def.half[2]) + PICKUP_RADIUS;
    for (const p of this.pickups) {
      if (!p.enabled || this.tick < p.availableAt || p.item.effect.kind !== 'ammo' || restrictedWeapons(this.rules)) continue;
      // Only a pickup that refills a gun running short (SeatAmmo.pickups).
      if (!m.guns.some((g, i) => g?.shells !== undefined && m.def.seats[i]?.ammo && g.shells < m.def.seats[i]!.ammo!.max && ammoRefilledBy(m.def.seats[i]!.ammo!, p.item.id))) continue;
      if (horizontalDistance(p.pos, m.pos) > reach || p.pos.y < m.pos.y - 1.5 || p.pos.y > m.pos.y + m.def.half[1] * 2 + 1) continue;
      // Over its footprint (seen from above), with PICKUP_RADIUS to spare round the hull.
      const s = Math.sin(m.yaw);
      const c = Math.cos(m.yaw);
      const dx = p.pos.x - m.pos.x;
      const dz = p.pos.z - m.pos.z;
      if (Math.abs(dx * c - dz * s) > m.def.half[0] + PICKUP_RADIUS || Math.abs(dx * s + dz * c) > m.def.half[2] + PICKUP_RADIUS) continue;
      m.guns.forEach((g, i) => {
        const ammo = m.def.seats[i]?.ammo;
        if (g && ammo && ammoRefilledBy(ammo, p.item.id)) {
          g.shells = ammo.max;
          g.shellTicks = 0;
        }
      });
      p.availableAt = this.tick + p.respawnTicks;
      this.pendingEvents.push({ e: 'pickup', s: crew, id: p.id, item: p.item.id });
      this.scenario.pickupTaken(p.id, crew);
      this.reroll(p);
      return;
    }
  }

  /** The private seat state (PrivateState.mo): [map entity index, seat, the gun's heat %, and its rounds aboard when they are limited]. */
  private seatState(c: Combatant): [number, number, number] | [number, number, number, number] {
    const m = this.mounts[c.mount!.index]!;
    const gs = this.gunSeatOf(c);
    const gun = gs === null ? null : m.guns[gs];
    const heat = Math.round((gun?.heat ?? 0) * 100);
    return gun?.shells !== undefined ? [m.index, c.mount!.seat, heat, gun.shells] : [m.index, c.mount!.seat, heat];
  }

  /** The plane follows its route by the clock; at the end of an open route it starts over, throwing out anyone still aboard. */
  private flyPlane(m: MountRt): void {
    const route = m.route!;
    const t = this.routeTick(m);
    const pose = routePose(route, t);
    const drops = this.dropPlanFor(m);
    // Leaving the stretch riders can land from (or the end of an open route over it): out they go, here.
    // A route with no good stretch at all throws them out where an open route ends, as it always did.
    if (drops.any ? dropStretchEnds(drops, route, t) : ticksToRouteEnd(route, t) <= 1) {
      for (const slot of m.seats) {
        const c = slot === null ? undefined : this.actor(slot);
        if (c) this.leaveMount(c, true);
      }
    }
    m.pos = pose.pos;
    m.yaw = m.aimYaw = pose.yaw;
  }

  /**
   * Fire, lava and water. A burning vehicle loses health on its own (from
   * the burn threshold it blows in MOUNT_BURN_SECONDS), so it goes up unless
   * someone finishes it first; lava sets it alight at once and eats it fast;
   * acid corrodes it; a ground vehicle sunk in deep water floods. Credit goes
   * to whoever hit it last.
   */
  private vehicleHazards(m: MountRt): void {
    if (this.phase !== 'playing' || (this.rules.vehicleDamage ?? 'normal') === 'off') return;
    const v = m.def.vehicle!;
    const max = m.def.health;
    if (this.liquids.length) {
      const low = liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y + 0.2, z: m.pos.z });
      if (low?.liquid === 'lava') {
        m.burning = true;
        this.damageMount(m, (max * 0.2) / TICK_RATE, null, true);
      } else if (low?.liquid === 'acid') this.damageMount(m, (max * 0.06) / TICK_RATE, null, true);
      // Afloat it rides at the surface and never floods; lava and acid carry nothing, so a floater sinks in and burns.
      const deep = !v.hover && !v.fly && !m.afloat ? liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y + m.def.half[1] * 1.5, z: m.pos.z }) : null;
      if (deep && deep.liquid !== 'lava') this.damageMount(m, (max * 0.12) / TICK_RATE, null, true);
    }
    if (m.alive && m.burning) this.damageMount(m, (max * MOUNT_BURN_FRACTION) / MOUNT_BURN_SECONDS / TICK_RATE, null, true);
  }

  /** A wreck coasts to a stop and drops to the ground (a downed flyer falls), staying solid. */
  private settleWreck(m: MountRt): void {
    if (!m.probe) return;
    m.speed *= 0.9;
    m.slide *= 0.8;
    m.push = { x: m.push.x * 0.85, z: m.push.z * 0.85 };
    const vx = Math.sin(m.yaw) * m.speed + Math.cos(m.yaw) * m.slide + m.push.x;
    const vz = Math.cos(m.yaw) * m.speed - Math.sin(m.yaw) * m.slide + m.push.z;
    // At rest on the ground: only look again now and then (something under it may have broken).
    if (Math.abs(vx) + Math.abs(vz) < 0.05 && !m.airborne && this.tick % 15 !== m.index % 15) {
      m.vel = { x: 0, z: 0 };
      return;
    }
    m.velY = Math.max(-30, m.velY - PLAYER.gravity * TICK_DT);
    const moved = this.moveVehicleProbe(m, { x: vx * TICK_DT, y: m.velY * TICK_DT, z: vz * TICK_DT });
    if (moved.grounded) m.velY = 0;
    m.airborne = !moved.grounded;
    m.vel = { x: vx, z: vz };
    m.pos = moved.feet;
    this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
    if (m.pos.y < this.killY) {
      m.wreckUntil = 0;
      this.physics.setBoxEnabled(m.body, false);
    }
  }

  /**
   * Move a vehicle's probe by `delta`. The probe capsule's dome stands well over the hull (its radius follows the
   * hull's width: a Hauler's is 3.4 m tall, its hull 2 m), so under a deck, a beam or a low roof the capsule caught
   * where the hull fits and the vehicle wedged there, unable to drive in or out. With something over the hull that
   * the dome would touch (PhysicsWorld.overhead), or when the capsule is stopped and the low probe (the same bottom,
   * cut off at the hull's top) gets further, the low probe carries it (`low`) until the space over it is clear
   * again. Over open ground nothing is overhead: the capsule alone, as before.
   */
  private moveVehicleProbe(m: MountRt, delta: Vec3): { feet: Vec3; grounded: boolean; blocked: number } {
    const lowProbe = m.lowProbe;
    if (!lowProbe) return this.physics.moveVehicle(m.probe!, m.body, m.pos, delta, !m.def.vehicle!.fly);
    const r = Math.min(m.def.half[0], m.def.half[2]) * 0.95;
    const hull = m.def.half[1] * 2;
    m.low = this.physics.overhead(m.pos, hull, this.physics.probeHeight(m.probe!) + 0.1, r, m.body);
    if (m.low) return this.physics.moveVehicle(lowProbe, m.body, m.pos, delta);
    const moved = this.physics.moveVehicle(m.probe!, m.body, m.pos, delta);
    if (moved.blocked < 0.25) return moved;
    // Stopped: by a wall (the low probe does no better) or by something over the hull's top (it gets further).
    const low = this.physics.moveVehicle(lowProbe, m.body, m.pos, delta);
    if (low.blocked > moved.blocked - 0.05) return moved;
    m.low = true;
    return low;
  }

  /**
   * Crashes between mounts: a vehicle driven into another vehicle, a wreck
   * or a turret hurts both, by how fast they closed and how heavy the other
   * one is (a hover bike into a tank comes off far worse), and shoves the lighter
   * one. Each side's driver gets the credit for the other's damage.
   */
  private ramMounts(m: MountRt, vx: number, vz: number, driver: Combatant | null): void {
    if (hypot(vx, vz) < RAM_MIN_SPEED) return;
    const reach = hypot(m.def.half[0], m.def.half[2]) + 0.5;
    for (const o of this.mounts) {
      if (o === m || o.route || (!o.alive && this.tick >= o.wreckUntil) || (m.rammed.get(o.index) ?? 0) > this.tick) continue;
      // Too far apart to touch (the exact test below is dearer).
      const r = reach + hypot(o.def.half[0], o.def.half[2]);
      if (Math.abs(o.pos.x - m.pos.x) > r || Math.abs(o.pos.z - m.pos.z) > r) continue;
      const c = footprintGap({ pos: m.pos, yaw: m.yaw, half: m.def.half }, { pos: o.pos, yaw: o.yaw, half: o.def.half });
      if (!c || c.gap > 0.3) continue;
      const closing = (vx - o.vel.x) * c.nx + (vz - o.vel.z) * c.nz;
      if (closing < RAM_MIN_SPEED) continue;
      m.rammed.set(o.index, this.tick + TICK_RATE / 2);
      o.rammed.set(m.index, this.tick + TICK_RATE / 2);
      const ma = mountMass(m.def);
      const mb = mountMass(o.def);
      const hit = (closing - 3) * RAM_DAMAGE;
      const otherSlot = o.alive ? (o.seats[o.def.seats.findIndex((s) => s.role === 'driver')] ?? null) : null;
      const other = otherSlot === null ? null : (this.actor(otherSlot) ?? null);
      this.damageMount(o, (hit * 2 * ma) / (ma + mb), driver);
      this.damageMount(m, (hit * 2 * mb) / (ma + mb), other);
      if (o.def.vehicle) {
        const shove = (closing * ma) / (ma + mb);
        o.push = { x: o.push.x + c.nx * shove, z: o.push.z + c.nz * shove };
      }
      if (m.alive) m.speed *= mb > ma ? 0.3 : 0.6;
      const at = { x: (m.pos.x + o.pos.x) / 2, y: m.pos.y + Math.min(m.def.half[1], o.def.half[1]), z: (m.pos.z + o.pos.z) / 2 };
      this.pendingEvents.push({ e: 'crash', p: tuple(at), n: Math.min(1, closing / 25) });
    }
  }

  /**
   * Arcade driving with weight. Throttle pushes along the heading; the tyres
   * (or hover pads) only kill part of any sideways slide each tick, so
   * turning hard at speed drifts, the handbrake (jump) breaks grip for a
   * powerslide, and hovercraft glide. Steering is sharpest at mid speed.
   * Going over a crest keeps the climb's upward speed, so ramps launch you;
   * in the air there's little steering and no throttle, and a hard landing
   * dents the vehicle. Walls bleed speed, less for heavy ones.
   */
  private driveVehicle(m: MountRt, ticks = 1): void {
    const dt = TICK_DT * ticks;
    const v = m.def.vehicle!;
    const { forward, right, brake } = m.drive;
    const speedBefore = m.speed;
    const mass = v.mass ?? 1;
    const grounded = !m.airborne || !!v.hover || !!v.fly;
    // On a track's road tyres grip better; off it wheeled vehicles are a little slower.
    const road = roadHandling(this.road, m.pos, !!v.hover || !!v.fly);
    // On water: a little slower, and the hull slides more (see FLOAT).
    const water = m.afloat ? FLOAT.speed : 1;
    const target = (forward > 0 ? v.maxSpeed * forward : forward < 0 ? -v.reverseSpeed * -forward : 0) * road.speed * water;
    const braking = target === 0 || Math.sign(target) !== Math.sign(m.speed);
    let rate = (target === 0 ? v.accel * (v.hover ? 0.35 : 0.8) : braking ? v.accel * 1.8 : v.accel) * dt;
    if (!grounded) rate = 0;
    if (brake && grounded) rate = Math.max(rate, v.accel * 1.2 * dt);
    const piloted = m.def.seats.some((s, i) => s.role === 'driver' && m.seats[i] !== null);
    // Nobody at the wheel (and no track driver): it brakes to a stop (`idleBrake`), its slide with it. Before, an empty
    // hovercraft glided on at accel × 0.35 (a Hauler bailed out of at 12.7 m/s went ~35 m, into a door it then blocked).
    const idle = !piloted && !m.ambient && grounded ? (v.idleBrake ?? DEFAULT_IDLE_BRAKE) * dt : 0;
    if (idle) {
      rate = Math.max(rate, idle);
      const slide = Math.abs(m.slide);
      m.slide = slide > idle ? m.slide - Math.sign(m.slide) * idle : 0;
    }
    m.speed += Math.max(-rate, Math.min(rate, (brake || idle ? 0 : target) - m.speed));
    // Steering: needs some speed, tightest around half speed, a little lazier flat out; barely any in the air.
    const frac = Math.min(1, Math.abs(m.speed) / v.maxSpeed);
    const steer = Math.min(1, Math.abs(m.speed) / 5) * (1 - 0.35 * frac * frac) * (grounded ? 1 : 0.2) * (brake ? 1.35 : 1);
    // Tracks (`pivot`) turn it on the spot too, fading out as it picks up speed (the wheel's own turn takes over).
    const pivot = v.pivot && grounded ? v.pivot * Math.max(0, 1 - Math.abs(m.speed) / 5) : 0;
    const turn = right * dt * (v.turnRate * steer + pivot) * (m.speed >= -0.05 ? 1 : -1);
    m.yaw += turn;
    // Turning swings the heading out from under the momentum: that becomes slide, which grip then eats.
    m.slide += -m.speed * Math.sin(turn);
    // Loose at speed (drift): the grip falls off with the square of speed, so a hard turn flat out powerslides.
    // With suspension, wheels off the ground (over a crest, two on a kerb) grip less.
    const loose = v.drift ? 1 - v.drift * frac * frac : 1;
    const wheels = m.susp && m.suspSetup ? 0.35 + (0.65 * m.susp.contact) / m.suspSetup.points.length : 1;
    const grip = grounded ? Math.min(0.6, (v.grip ?? (v.hover ? 0.06 : 0.25)) * road.grip * loose * wheels) * (brake ? 0.25 : 1) * (m.afloat ? FLOAT.grip : 1) : 0;
    m.slide *= (1 - grip) ** ticks;
    if (Math.abs(m.slide) < 0.02) m.slide = 0;
    if (v.fly) {
      // Flyers hold their height: climb or dive at the pilot's say, and sink back down with nobody at the controls.
      // Driven into something it can't pass (a wreck's hull, a wall, a prop too tall to ride over), a flyer climbs on
      // its own until it clears it (climbAssist): it lifts over instead of wedging (a bot pilot never climbs). Past
      // it, it settles back down to the height it was flying at (assistFrom), unless the pilot climbs or dives.
      const asked = m.drive.lift ?? 0;
      if (asked) m.assistFrom = null;
      else if (m.climbAssist > 0) m.assistFrom ??= m.pos.y;
      else if (m.assistFrom !== null && m.pos.y <= m.assistFrom + 0.05) m.assistFrom = null;
      const want = !piloted ? -v.fly.climb * 0.5 : m.climbAssist > 0 ? Math.max(1, asked) * v.fly.climb : m.assistFrom !== null ? -v.fly.climb * 0.5 : asked * v.fly.climb;
      m.velY += Math.max(-v.fly.climb * 3 * dt, Math.min(v.fly.climb * 3 * dt, want - m.velY));
      if (m.pos.y >= m.home.pos.y + v.fly.ceiling && m.velY > 0) m.velY = 0;
    } else m.velY -= PLAYER.gravity * dt;
    const dir = { x: Math.sin(m.yaw), z: Math.cos(m.yaw) };
    const side = { x: Math.cos(m.yaw), z: -Math.sin(m.yaw) };
    const vx = dir.x * m.speed + side.x * m.slide + m.push.x;
    const vz = dir.z * m.speed + side.z * m.slide + m.push.z;
    // Parked and settled (nobody aboard, nothing pushing): no physics, but a look every half second
    // in case the ground went from under it.
    const parked = !vx && !vz && m.seats.every((s) => s === null) && (!m.susp || m.susp.settled);
    if (!parked) m.restSince = undefined;
    else if (m.restSince !== undefined && (this.tick - m.restSince) % 30 !== 0) {
      m.vel = { x: 0, z: 0 };
      m.velY = 0;
      return;
    }
    const startY = m.pos.y;
    // Riding on water: the surface holds it up with its feet `draft` under, rising to it from below
    // (it comes back up after a plunge); on the way down from a jump the water catches it.
    const surface = m.floats && this.liquids.length ? floatSurface(this.liquids, m.pos) : null;
    const line = surface === null ? null : surface - (v.draft ?? FLOAT.draft);
    if (line !== null && m.pos.y + m.velY * dt < line) m.velY = Math.min(FLOAT.rise, (line - m.pos.y) / dt);
    const moved = this.moveVehicleProbe(m, { x: vx * dt, y: m.velY * dt, z: vz * dt });
    if (parked && Math.abs(moved.feet.y - startY) < 1e-3) m.restSince ??= this.tick;
    else m.restSince = undefined;
    const climbed = (moved.feet.y - startY) / dt;
    const afloat = line !== null && moved.feet.y <= line + 0.02;
    const wasAfloat = m.afloat;
    const wasAirborne = m.airborne;
    const fallSpeed = m.velY;
    m.afloat = afloat;
    if (afloat && !moved.grounded) {
      // On the water, not the bed or the shore: it rides the surface (a splash, never a hard landing).
      m.velY = 0;
      m.airborne = false;
    } else if (moved.grounded) {
      // Hard landing: the heavier and faster it comes down, the more it hurts.
      if (m.airborne && !wasAfloat && !afloat && m.velY < -11 && !v.hover && !v.fly) this.damageMount(m, (-m.velY - 11) * 6 * mass, null);
      // On the ground the vertical speed follows the slope, so leaving a ramp keeps the climb (a flyer lifts off at will).
      m.velY = v.fly ? Math.max(0, m.velY) : Math.max(0, Math.min(climbed, 14));
      m.airborne = false;
    } else m.airborne = true;
    if (moved.blocked > 0.6 && Math.abs(m.speed) > 4) {
      m.speed *= Math.min(0.8, 0.4 + mass * 0.1);
      m.slide *= 0.5;
    }
    const throttle = piloted && Math.abs(forward) > 0.2;
    if (v.fly) m.climbAssist = throttle && moved.blocked > 0.5 ? CLIMB_ASSIST_TICKS : Math.max(0, m.climbAssist - ticks);
    // Wedged: driven and getting nowhere for a while (bots leave it for something else until it is got out).
    const step = Math.hypot(moved.feet.x - m.pos.x, moved.feet.z - m.pos.z);
    m.stall = throttle && step < WEDGE_STEP * ticks ? m.stall + ticks : Math.max(0, m.stall - 2 * ticks);
    if (m.stall >= WEDGE_TICKS && !m.wedged) m.wedged = { at: { ...moved.feet } };
    else if (m.wedged && Math.hypot(moved.feet.x - m.wedged.at.x, moved.feet.z - m.wedged.at.z) > WEDGE_FREED) {
      // Got out: free, and the stall it built up is over (left over, it marked the vehicle wedged again a tick later).
      m.wedged = undefined;
      m.stall = 0;
    }
    m.pos = moved.feet;
    if (m.susp) this.suspend(m, ticks, speedBefore, turn, right, wasAirborne && !m.airborne ? Math.max(0, -fallSpeed) : 0);
    const decay = (moved.grounded || afloat ? 0.9 : 0.99) ** ticks;
    m.push = { x: m.push.x * decay, z: m.push.z * decay };
    this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
    if (m.pos.y < this.killY) {
      this.destroyMount(m, false);
      return;
    }
    const driverSlot = m.seats[m.def.seats.findIndex((s) => s.role === 'driver')] ?? null;
    const driver = driverSlot === null ? null : (this.actor(driverSlot) ?? null);
    m.vel = { x: vx, z: vz };
    this.ramMounts(m, vx, vz, driver);
    if (!m.alive) return;
    // Running people over.
    if (Math.abs(m.speed) < 5) return;
    for (const c of this.actors()) {
      if (!c.alive || m.seats.includes(c.slot) || (m.runOver.get(c.slot) ?? 0) > this.tick) continue;
      const rel = { x: c.move.pos.x - m.pos.x, z: c.move.pos.z - m.pos.z };
      const lx = rel.x * Math.cos(m.yaw) - rel.z * Math.sin(m.yaw);
      const lz = rel.x * Math.sin(m.yaw) + rel.z * Math.cos(m.yaw);
      if (Math.abs(lx) > m.def.half[0] + PLAYER.radius || Math.abs(lz) > m.def.half[2] + PLAYER.radius || Math.abs(c.move.pos.y - m.pos.y) > 1.5) continue;
      // Teammates only with friendly fire on (canHurt): then it is a team kill like any other.
      if (driver && driver !== c && !this.canHurt(driver, c)) continue;
      m.runOver.set(c.slot, this.tick + 30);
      this.push(c, { x: dir.x + (lx >= 0 ? 1 : -1) * Math.cos(m.yaw) * 0.6, y: 0.4, z: dir.z - (lx >= 0 ? 1 : -1) * Math.sin(m.yaw) * 0.6 }, Math.abs(m.speed) * 0.8);
      this.damage(c, Math.abs(m.speed) * 5, driver, 'core.roadkill');
      this.pendingEvents.push({ e: 'crash', p: tuple(chest(c.move.pos)), n: Math.min(1, Math.abs(m.speed) / 40) });
    }
  }

  /** Suspension rays cast this tick (stepMounts resets it): past SUSPENSION_RAY_BUDGET, vehicles sample less often. */
  private suspensionRays = 0;

  /**
   * The sprung body (sim/suspension.ts) after the chassis moved: one ray down per wheel, then the springs. Far,
   * parked and settled vehicles skip it (driveVehicle's parked early return, Match.farVehicle); past the tick's
   * ray budget a vehicle reuses the ground it found last tick on two ticks of three.
   */
  private suspend(m: MountRt, ticks: number, speedBefore: number, turn: number, steer: number, landing: number): void {
    const s = m.susp!;
    const t = m.suspSetup!;
    // Moving two ticks at a time (empty and far from every player: nobody sees it): the body just sits level.
    if (ticks > 1) {
      s.h = s.hv = s.p = s.pv = s.r = s.rv = s.steer = 0;
      s.wheel.fill(0);
      s.contact = t.points.length;
      s.settled = true;
      return;
    }
    const dt = TICK_DT;
    // A crash stops it in a tick: the springs see a hard stop, not a thousand m/s².
    const aLong = Math.max(-40, Math.min(40, (m.speed - speedBefore) / dt));
    const aLat = Math.max(-40, Math.min(40, (m.speed * turn) / dt));
    const grounded = !m.airborne;
    // Nothing to do: settled, standing still, nothing landing. The body stays as it is.
    if (s.settled && grounded && !landing && m.vel.x === 0 && m.vel.z === 0 && m.speed === 0 && steer === 0) return;
    // Ground under each wheel (in the air the wheels just hang: no rays).
    if (grounded && (this.suspensionRays < SUSPENSION_RAY_BUDGET || (this.tick + m.index) % 3 === 0)) {
      const sin = Math.sin(m.yaw);
      const cos = Math.cos(m.yaw);
      const top = t.hubY + 0.6;
      const reach = top + t.travel + 0.5;
      for (let i = 0; i < t.points.length; i++) {
        const [x, z] = t.points[i]!;
        const d = this.physics.groundBelow({ x: m.pos.x + x * cos + z * sin, y: m.pos.y + top, z: m.pos.z - x * sin + z * cos }, reach, m.body);
        s.ground[i] = d === null ? null : top - d + VEHICLE_SKIN;
      }
      this.suspensionRays += t.points.length;
    }
    stepSuspension(s, t, dt, { grounded, aLong, aLat, landing, steer });
  }

  /** Sentries turn toward the nearest enemy they can see and fire while lined up. */
  private runSentry(m: MountRt): void {
    const spec = m.def.sentry!;
    if (spec.arc) return this.runArcSentry(m);
    const muzzle = { x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z };
    let target: Combatant | null = null;
    let bestD = spec.range;
    for (const c of this.actors()) {
      if (!c.alive || c.slot === m.builtBy) continue;
      if (m.faction !== null && relation(this.factions, m.faction, c.faction) !== 'enemy') continue;
      const d = distance(muzzle, chest(c.move.pos));
      if (d < bestD && this.sees(muzzle, chest(c.move.pos))) {
        bestD = d;
        target = c;
      }
    }
    if (m.cooldown > 0) m.cooldown--;
    if (!target) return;
    const want = lookAngles(muzzle, chest(target.move.pos));
    const dy = Math.atan2(Math.sin(want.yaw - m.aimYaw), Math.cos(want.yaw - m.aimYaw));
    const turn = spec.turnRate * TICK_DT;
    m.aimYaw += Math.max(-turn, Math.min(turn, dy));
    m.aimPitch += Math.max(-turn, Math.min(turn, want.pitch - m.aimPitch));
    if (Math.abs(dy) > 0.12 || m.cooldown > 0) return;
    const def = getWeapon(spec.weapon);
    m.cooldown = def.fireIntervalTicks;
    const dir = this.spreadDir(viewDirection(m.aimYaw, m.aimPitch), def.spread);
    const world = this.physics.raycastHit(muzzle, dir, def.range);
    const targets = this.actors()
      .filter((c) => c.alive && c.slot !== m.builtBy && (m.faction === null || relation(this.factions, m.faction, c.faction) === 'enemy'))
      .map((c) => this.shotBody(c));
    const shot = resolveHitscan(muzzle, dir, def.range, world && world.handle !== m.body.handle ? world.dist : null, targets);
    this.scenario.shootGlass(muzzle, dir, shot.distance, m.builtBy ?? null);
    this.pendingEvents.push({ e: 'shot', s: -1, w: def.id, from: tuple(muzzle), to: [tuple(shot.end)], hit: [shot.hitSlot] });
    // A built sentry's kills are its builder's.
    if (shot.hitSlot !== null) this.damage(this.actor(shot.hitSlot)!, def.damage, m.builtBy === undefined ? null : (this.slots[m.builtBy] ?? null), def.id);
  }

  /** Whether an arc sentry may shoot this combatant (alive, not its builder, an enemy of its team if it has one). */
  private arcTargetable(m: MountRt, c: Combatant | undefined): c is Combatant {
    if (!c || !c.alive || c.slot === m.builtBy) return false;
    return m.faction === null || relation(this.factions, m.faction, c.faction) === 'enemy';
  }

  /**
   * An arc sentry (mounts.ts ArcSentrySpec): keeps to the target it has while it can see it in range, else takes
   * the nearest one it can see; turns to it, winds up while lined up, then holds an arc on it that hits every
   * `fireIntervalTicks` (and jumps to one enemy beside it, `chain`). Losing sight or range drops the lock and the
   * charge: the next target needs the full wind-up. A full lock ends in a vent.
   */
  private runArcSentry(m: MountRt): void {
    const spec = m.def.sentry!;
    const arc = spec.arc!;
    const st = (m.arc ??= { charge: 0, target: null, lockTicks: 0, vent: 0 });
    const def = getWeapon(spec.weapon);
    const muzzle = { x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z };
    const sees = (c: Combatant): boolean => distance(muzzle, chest(c.move.pos)) <= spec.range && this.sees(muzzle, chest(c.move.pos));
    if (m.cooldown > 0) m.cooldown--;
    if (st.vent > 0) {
      st.vent--;
      return;
    }
    const held = st.target === null ? undefined : this.actor(st.target);
    if (!this.arcTargetable(m, held) || !sees(held)) {
      // Lost (or never had) it: start again on whoever is nearest in sight.
      st.target = null;
      st.charge = 0;
      st.lockTicks = 0;
      let bestD = spec.range;
      for (const c of this.actors()) {
        if (!this.arcTargetable(m, c)) continue;
        const d = distance(muzzle, chest(c.move.pos));
        if (d < bestD && this.sees(muzzle, chest(c.move.pos))) {
          bestD = d;
          st.target = c.slot;
        }
      }
      if (st.target === null) return;
    }
    const target = this.actor(st.target!)!;
    const want = lookAngles(muzzle, chest(target.move.pos));
    const dy = Math.atan2(Math.sin(want.yaw - m.aimYaw), Math.cos(want.yaw - m.aimYaw));
    const turn = spec.turnRate * TICK_DT;
    m.aimYaw += Math.max(-turn, Math.min(turn, dy));
    m.aimPitch += Math.max(-turn, Math.min(turn, want.pitch - m.aimPitch));
    const windUp = Math.round(arc.windUpSeconds * TICK_RATE);
    if (st.charge < windUp) {
      // Winds up only while lined up (a quick sidestep out of its swing slows the charge, it doesn't reset it).
      if (Math.abs(dy) <= 0.2) st.charge++;
      return;
    }
    // Locked on: it follows the target without missing, hitting on its weapon's beat.
    if (st.lockTicks >= Math.round(arc.lockSeconds * TICK_RATE)) {
      st.vent = Math.round(arc.ventSeconds * TICK_RATE);
      st.target = null;
      st.charge = 0;
      st.lockTicks = 0;
      m.cooldown = 0;
      return;
    }
    st.lockTicks++;
    if (m.cooldown > 0) return;
    m.cooldown = def.fireIntervalTicks;
    const by = m.builtBy === undefined ? null : (this.slots[m.builtBy] ?? null);
    const pts: Tuple3[] = [tuple(muzzle), tuple(chest(target.move.pos))];
    this.damage(target, def.damage, by, def.id);
    // The arc jumps on to the nearest other enemy in reach with a clear line, weaker.
    const chain = def.chain;
    let at = target;
    let damage = def.damage;
    const hit = new Set([target.slot]);
    for (let j = 0; chain && j < chain.jumps; j++) {
      const here = chest(at.move.pos);
      let next: Combatant | null = null;
      let best = chain.range;
      for (const o of this.actors()) {
        if (hit.has(o.slot) || !this.arcTargetable(m, o)) continue;
        const d = distance(here, chest(o.move.pos));
        if (d < best && this.physics.lineOfSight(here, chest(o.move.pos))) {
          best = d;
          next = o;
        }
      }
      if (!next) break;
      damage *= chain.falloff;
      hit.add(next.slot);
      pts.push(tuple(chest(next.move.pos)));
      this.damage(next, damage, by, def.id);
      at = next;
    }
    this.pendingEvents.push({ e: 'arc', s: -1, pts, m: m.index });
  }

  /** Vehicles with raycast suspension, alive, for snapshots (`ms`, see suspensionSnapshot). */
  suspensionSnapshots(): number[][] {
    const out: number[][] = [];
    for (const m of this.mounts) if (m.susp && m.alive) out.push(suspensionSnapshot(m.index, m.susp));
    return out;
  }

  /** Mounts for snapshots (see MountSnapshot). */
  mountSnapshots(): MountSnapshot[] {
    return this.mounts.map((m) => [m.index, r3(m.pos.x), r3(m.pos.y), r3(m.pos.z), r3(m.yaw), r3(m.aimYaw), r3(m.aimPitch), Math.ceil((Math.max(0, m.health) / m.def.health) * 100), (m.alive ? MOUNT_FLAG_ALIVE : 0) | (this.tick < m.wreckUntil ? MOUNT_FLAG_WRECK : 0) | (m.burning ? MOUNT_FLAG_BURNING : 0) | (m.alive && m.arc ? arcFlags(m) : 0), ...m.seats.map((s) => s ?? -1)]);
  }

  // ---------------------------------------------------------------- hazards and status effects

  /** A smoke zone's radius now (SMOKE: it billows out, sits, thins; 0 once it hides nothing). */
  private smokeNow(z: Zone): number {
    return smokeRadius(z.radius, (this.tick - z.start) / TICK_RATE, (z.endTick - z.start) / TICK_RATE);
  }

  private smokeCache: { tick: number; clouds: SmokeCloud[] } = { tick: -1, clouds: [] };

  /** The smoke clouds up now, for the sight checks (bots, sentries, homing, spawn safety); worked out once a tick. */
  smokeClouds(): readonly SmokeCloud[] {
    if (this.smokeCache.tick === this.tick) return this.smokeCache.clouds;
    const clouds: SmokeCloud[] = [];
    for (const z of this.zones) {
      if (z.kind !== 'smoke') continue;
      const radius = this.smokeNow(z);
      if (radius > 0) clouds.push({ x: z.pos.x, y: z.pos.y + radius * SMOKE.rise, z: z.pos.z, radius });
    }
    this.smokeCache = { tick: this.tick, clouds };
    return clouds;
  }

  /**
   * Whether `b` can be seen from `a`: nothing static in the way and no smoke cloud across it. For sight only:
   * shots, blasts and chain lightning go through smoke (they use the physics' own line).
   */
  sees(a: Vec3, b: Vec3): boolean {
    return this.physics.lineOfSight(a, b) && !smokeBlocks(a, b, this.smokeClouds());
  }

  private spawnZone(spec: ZoneSpec, at: Vec3, owner: number, weapon: string): void {
    let pos = at;
    // Puddles, flames and smoke settle on the floor below (smoke billows up from where the grenade lies); toxic
    // clouds and fields stay where they burst.
    if (spec.kind === 'fire' || spec.kind === 'oil' || spec.kind === 'goo' || spec.kind === 'smoke') {
      const down = this.physics.raycastHit({ x: at.x, y: at.y + 0.3, z: at.z }, { x: 0, y: -1, z: 0 }, 8);
      if (down) pos = { x: at.x, y: at.y + 0.3 - down.dist, z: at.z };
    }
    const endTick = this.tick + Math.round(spec.seconds * TICK_RATE);
    // A fresh splash on top of a puddle of the same kind just tops it up.
    const same = this.zones.find((z) => z.kind === spec.kind && distance(z.pos, pos) < spec.radius * 0.5);
    if (same) {
      same.endTick = Math.max(same.endTick, endTick);
      same.owner = owner;
      return;
    }
    this.zones.push({ kind: spec.kind, pos, radius: spec.radius, start: this.tick, endTick, owner, weapon });
    if (this.zones.length > MAX_ZONES) this.zones.shift();
  }

  /** Oil within reach of a flame or blast catches fire. */
  private ignite(at: Vec3, reach: number): void {
    for (const z of this.zones) {
      if (z.kind !== 'oil' || distance(z.pos, at) > z.radius + reach) continue;
      z.kind = 'fire';
      z.radius *= 1.15;
      z.endTick = this.tick + TICK_RATE * 7;
    }
  }

  private stepZones(): void {
    if (!this.zones.length) return;
    const live: Zone[] = [];
    for (const z of this.zones) {
      if (this.tick < z.endTick) {
        live.push(z);
        continue;
      }
      if (z.kind === 'singularity') {
        // The field collapses with a bang.
        this.pendingEvents.push({ e: 'explode', s: z.owner, p: tuple(z.pos), r: 5, w: z.weapon });
        this.splash(z.pos, 5, 90, 20, this.actor(z.owner) ?? null, z.weapon, 0.6, blastKnockback({ splashDamage: 90 }));
        this.ignite(z.pos, 5);
      }
    }
    this.zones = live;
    // Fire spreads along oil.
    for (const f of this.zones) if (f.kind === 'fire') this.ignite(f.pos, f.radius * 0.5);
    for (const c of this.actors()) {
      if (!c.alive) continue;
      for (const z of this.zones) {
        // Smoke only hides (smokeClouds): nothing happens to whoever stands in it.
        if (z.kind === 'smoke' || !inZone(z, c.move.pos)) continue;
        const owner = this.actor(z.owner) ?? null;
        switch (z.kind) {
          case 'fire':
            this.applyStatus(c, { kind: 'burn', seconds: 2 }, owner, z.weapon);
            this.damage(c, FIRE_ZONE_DPS / TICK_RATE, owner, z.weapon);
            break;
          case 'toxic':
            this.applyStatus(c, { kind: 'poison', seconds: 2 }, owner, z.weapon);
            break;
          case 'goo':
            this.applyStatus(c, { kind: 'slow', seconds: 0.4 }, owner, z.weapon);
            break;
          case 'singularity': {
            // Dragged in, harder near the middle, and lifted off the ground.
            const to = sub(z.pos, chest(c.move.pos));
            const d = hypot(to.x, to.y, to.z) || 1;
            const pull = 0.9 * (1 - d / z.radius) + 0.15;
            const vx = Math.max(-14, Math.min(14, (c.move.vx ?? 0) + (to.x / d) * pull));
            const vz = Math.max(-14, Math.min(14, (c.move.vz ?? 0) + (to.z / d) * pull));
            c.move = { ...c.move, vx, vz, velY: Math.max(c.move.velY, to.y > 0 ? 2.5 : c.move.velY), grounded: to.y > 0 ? false : c.move.grounded };
            break;
          }
          case 'oil':
            break;
        }
        if (!c.alive) break;
      }
    }
  }

  /** Lava and acid burn while you stand in them; staying under water too long drowns you. */
  private stepLiquid(c: Combatant): void {
    if (!this.liquids.length) return;
    const p = c.move.pos;
    const feet = liquidAt(this.liquids, { x: p.x, y: p.y + 0.1, z: p.z });
    if (feet && LIQUID_SPECS[feet.liquid].dps > 0) this.damage(c, LIQUID_SPECS[feet.liquid].dps / TICK_RATE, null, `core.${feet.liquid}`);
    const head = liquidAt(this.liquids, { x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
    c.breath = head ? c.breath + 1 : 0;
    if (c.alive && c.breath > BREATH_SECONDS * TICK_RATE) this.damage(c, 10 / TICK_RATE, null, 'core.drown');
  }

  /** Damage over time, slows wearing off, chill thawing. */
  private stepStatuses(): void {
    for (const c of this.actors()) {
      if (!c.alive) continue;
      const by = c.statusBy === null ? null : (this.actor(c.statusBy) ?? null);
      if (c.burnTicks > 0) {
        c.burnTicks--;
        this.damage(c, BURN_DPS / TICK_RATE, by, c.statusWeapon);
      }
      if (c.alive && c.poisonTicks > 0) {
        c.poisonTicks--;
        this.damage(c, POISON_DPS / TICK_RATE, by, c.statusWeapon);
      }
      if (c.alive) this.stepLiquid(c);
      if (c.slowTicks > 0) c.slowTicks--;
      stepImpact(c.impact);
      if (c.frozenTicks > 0) c.frozenTicks--;
      else if (c.chill > 0) c.chill = Math.max(0, c.chill - 0.45 / TICK_RATE);
    }
  }

  /** Radial damage falling off from `damage` at the centre to `edge` at `radius`, blocked by walls. Also hits destructibles. */
  private splash(at: Vec3, radius: number, damage: number, edge: number, owner: Combatant | null, weapon: string, selfScale: number, knockback = 0, status?: StatusHit): void {
    // Lunar: every blast throws players about (as hard as a disc launcher's), in the low gravity a long way.
    if (this.rules.lunar && knockback < LUNAR_BLAST_KNOCK && damage > 0) knockback = LUNAR_BLAST_KNOCK;
    for (const c of this.actors()) {
      if (!c.alive || this.sheltered(c)) continue;
      const target = chest(c.move.pos);
      const d = distance(at, target);
      if (d > radius || !this.physics.lineOfSight(at, target)) continue;
      let dmg = damage + (edge - damage) * (d / radius);
      if (owner && c === owner) dmg *= selfScale;
      // Knockback throws everyone up and out (you too: rocket and disc jumps), friends included; damage() decides who is hurt (teammates only with friendly fire on).
      if (knockback && !c.mount) this.throwBy(c, blastThrow(d > 0.01 ? scale(sub(target, at), 1 / d) : { x: 0, y: 1, z: 0 }, d, radius, knockback, c === owner));
      if (dmg > 0) this.damage(c, dmg, owner, weapon);
      if (status && c.alive) this.applyStatus(c, status, owner, weapon);
    }
    const boost = owner && owner.damageTicks > 0 ? DAMAGE_BOOST : 1;
    for (const m of this.mounts) {
      if (!m.alive) continue;
      const centre = { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z };
      const d = Math.max(0, distance(at, centre) - Math.min(m.def.half[0], m.def.half[2]));
      if (d <= radius) this.damageMount(m, (damage + (edge - damage) * (d / radius)) * boost, owner, false, 'blast', weapon);
    }
    for (const cv of [...this.covers]) {
      const d = Math.max(0, distance(at, { x: cv.pos.x, y: cv.pos.y + cv.half.y, z: cv.pos.z }) - cv.half.x);
      // Bags soak blasts well: explosives are the way through, just slower than you'd like.
      if (d <= radius) this.damageCover(cv, (damage + (edge - damage) * (d / radius)) * boost * 1.5);
    }
    this.scenario.splash(at, radius, damage * boost, edge * boost, owner?.slot ?? null, this.physics);
    this.mode?.splash?.(at, radius, damage * boost, edge * boost, owner);
  }

  private boosted(attacker: Combatant, amount: number): number {
    return attacker.damageTicks > 0 ? amount * DAMAGE_BOOST : amount;
  }

  /**
   * Fall damage (when the match or map has it on): the drop from the top of
   * the fall to where you land, weighted by gravity, past 5 m hurts and about
   * 16 m kills. Jump-pad flights, ladders and water landings are free.
   */
  private trackFall(c: Combatant, before: MoveState, padded: boolean): void {
    const m = c.move;
    if (m.chute) {
      // Under a canopy the fall starts over every tick: you land at its gentle sink rate.
      c.fallPeak = m.pos.y;
      c.padFlight = false;
      return;
    }
    if (padded || m.climb || m.swim) {
      c.fallPeak = undefined;
      c.padFlight = padded || c.padFlight;
      return;
    }
    if (!m.grounded) {
      c.fallPeak = Math.max(c.fallPeak ?? before.pos.y, m.pos.y);
      return;
    }
    const peak = c.fallPeak;
    const free = c.padFlight;
    c.fallPeak = undefined;
    c.padFlight = false;
    if (!this.phys.fallDamage || peak === undefined || free || before.grounded) return;
    // A landing in a low-gravity zone is as soft as the gravity there.
    const drop = (peak - m.pos.y) * this.phys.gravity * gravityAt(this.gravityZones, m.pos);
    if (drop > 5) this.damage(c, (drop - 5) * 9, null, 'core.fall');
  }

  /** Apply damage through armor and the attacker's damage boost. */
  private damage(victim: Combatant, amount: number, attacker: Combatant | null, weapon: string, head = false): void {
    if (!victim.alive || this.phase !== 'playing' || victim.invulnerable) return;
    // Shut inside a sealed vehicle (the Tank): nothing from outside reaches the crew; they die with it (destroyMount).
    if (this.sheltered(victim)) return;
    if (this.mode?.blocksDamage?.(victim, attacker)) return;
    // Spawn protection (content/match-play.json): nobody else's damage gets through until it runs out or they fire.
    if (attacker && attacker !== victim && this.shielded(victim)) return;
    if (this.classes) amount = this.classes.adjustDamage(victim, attacker, weapon, amount);
    // Lethality (spec §10): one systemic multiple, so every weapon keeps its identity.
    amount *= lethalityScale(this.rules);
    if (amount <= 0) return;
    // No friendly fire; hazards (no attacker) and your own grenades still hurt.
    if (attacker && attacker !== victim && !this.hostile(attacker, victim)) {
      // Friendly fire (team modes and co-op, when the match turns it on): players hurt teammates, NPCs never do.
      const ff = this.rules.friendlyFire ?? 'off';
      if (ff === 'off' || attacker.npc || victim.npc) return;
      if (ff === 'half') amount *= 0.5;
    }
    if (attacker?.npc && !victim.npc) amount *= NPC_DAMAGE_TO_PLAYERS;
    if (attacker?.npc) amount *= (NPC_ROLE_SPECS[attacker.npc.role].damage ?? 1) * attacker.npc.damage;
    // Character stats: the attacker's damage dealt (melee strength for a melee hit), the victim's armor.
    else if (attacker && attacker !== victim) amount *= isMeleeWeapon(weapon) ? attacker.stats.melee : attacker.stats.damage;
    if (victim.stats.armor > 0) amount *= 1 - victim.stats.armor;
    let dmg = attacker && attacker !== victim && attacker.damageTicks > 0 ? amount * DAMAGE_BOOST : amount;
    const hit = dmg;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, dmg * ARMOR_ABSORB);
      victim.armor -= absorbed;
      dmg -= absorbed;
      // The hit that broke their armour (the armour-break sparks).
      if (victim.armor <= 0.01) {
        victim.armor = 0;
        this.pendingEvents.push({ e: 'hurt', a: 'armor', s: victim.slot, p: [round2(victim.move.pos.x), round2(victim.move.pos.y + 1.2 * victim.size), round2(victim.move.pos.z)] });
      }
    }
    // A heavy hit (content/match-play.json heavyHit): the big-hit effect on them, the screen edge if it's you.
    if (attacker && attacker !== victim && hit >= MATCH_PLAY.heavyHit) this.pendingEvents.push({ e: 'hurt', a: 'big', s: victim.slot, k: attacker.slot, n: Math.round(hit), p: [round2(victim.move.pos.x), round2(victim.move.pos.y + 1.1 * victim.size), round2(victim.move.pos.z)] });
    const armoured = dmg < hit;
    victim.health -= dmg;
    victim.hurtAt = this.tick;
    if (attacker && attacker !== victim) {
      // Fireteams' assists (sim/squadScores.ts): an enemy's hit on a player or bot.
      if (this.fireteams && !attacker.npc && !victim.npc && this.hostile(attacker, victim)) this.fireteams.scores.hurt(attacker.slot, victim.slot, this.tick);
      const k = victim.size;
      const at = { x: victim.move.pos.x, y: victim.move.pos.y + (head ? 1.75 : 1.2) * k, z: victim.move.pos.z };
      this.noteDealt(attacker, hit, (head ? 1 : 0) | (armoured ? 2 : 0) | (victim.health <= 0 ? 4 : 0), at, victim.slot);
    }
    // A hard hit knocks a zipline rider off the line (keeping the ride's momentum).
    if (victim.move.zip !== undefined && dmg >= ZIP.knockDamage) victim.move = leaveZipline(this.ziplines, victim.move);
    if (victim.health <= 0) this.kill(victim, attacker === victim ? null : attacker, weapon, head);
  }

  /**
   * Damage numbers (a HUD option): what a human player's hit did, summed per target per tick, kept for the last few
   * snapshots (privateState `dd`). `key` tells targets apart (a combatant's slot, or -1 - a body's handle).
   */
  private noteDealt(attacker: Combatant, amount: number, flags: number, at: Vec3, key: number): void {
    if (attacker.kind !== 'human' || !(amount > 0)) return;
    const list = (attacker.dealt ??= []);
    const last = list[list.length - 1];
    if (last && last[0] === this.tick && last[6] === key) {
      last[1] += amount;
      last[2] |= flags;
      return;
    }
    while (list.length && (list[0]![0] < this.tick - DEALT_KEEP_TICKS || list.length >= 24)) list.shift();
    list.push([this.tick, amount, flags, at.x, at.y, at.z, key]);
  }

  /** A round struck a body: on a target (a breakable board, crate or barrel), the shooter sees what it would do to a body. */
  private noteTargetHit(owner: Combatant | null, handle: number, amount: number, at: Vec3): void {
    if (owner?.kind === 'human' && this.scenario.shootableTarget(handle)) this.noteDealt(owner, amount, 8, at, -1 - handle);
  }

  private kill(victim: Combatant, killer: Combatant | null, weapon: string, head = false): void {
    this.leaveMount(victim, false);
    victim.alive = false;
    victim.health = 0;
    if (!victim.npc) this.dropWeapon(victim);
    // A team kill (friendly fire on: a teammate downed by your round, blast, grenade, vehicle, turret or burn; every
    // source ends here): marked in the kill feed (`tk`) for everyone, and nothing rewarding. No kill, no score, no
    // streak (it ends the killer's), no streak reward, no kill confirmation, no callout or award credit, no Roulette
    // or mode credit. Kills never go down.
    const teamKill = !!killer && killer !== victim && !this.hostile(killer, victim);
    this.pendingEvents.push({ e: 'kill', killer: killer?.slot ?? null, victim: victim.slot, weapon, ...(head && !teamKill ? { hs: 1 as const } : {}), ...(teamKill ? { tk: 1 as const } : {}) });
    // Only players score; NPC kills of players count as the player's death.
    if (killer && !killer.npc && !teamKill) killer.kills++;
    if (killer && killer !== victim && !teamKill) killer.bot?.onKill(this.tick);
    victim.streak = 0;
    if (teamKill) {
      killer!.streak = 0;
      this.awards.endStreak(killer!.slot);
      this.roulette?.endStreak(killer!);
    } else if (killer && killer !== victim && !killer.npc && killer.alive) {
      killer.streak = (killer.streak ?? 0) + 1;
      this.streakReward(killer);
    }
    // Whoever gets credit for it: nobody for a team kill (the death still counts).
    const credited = teamKill ? null : killer;
    if (!victim.npc) {
      // Awards and callouts (sim/awards.ts): a scoring kill, else just a death (a fall, their own grenade, a team kill).
      const scored = !!credited && credited !== victim && !credited.npc;
      for (const call of this.awards.kill(scored ? credited!.slot : null, victim.slot)) this.pendingEvents.push({ e: 'callout', ...call });
      // Fireteams' squad scores (Part 3): the kill and its assists, to each player and the squad they're in.
      if (this.fireteams) this.fireteams.scores.kill(scored ? credited!.slot : null, victim.slot, this.tick, TICK_RATE, this.squadIdOf);
    }
    if (victim.npc) {
      victim.npc.removeAt = this.tick + TICK_RATE * 2;
      this.encounters.onNpcKilled(victim.slot, credited?.slot ?? null);
      return;
    }
    victim.deaths++;
    // Spawn choice: a fresh body here, downed by an enemy who may still be watching (sim/spawns.ts SpawnChoice.deaths).
    if (killer && killer !== victim && !teamKill) {
      this.recentDeaths.push({ pos: { ...victim.move.pos }, tick: this.tick });
      if (this.recentDeaths.length > SPAWN_DEATHS_KEPT) this.recentDeaths.shift();
    }
    // The team brain prices the corridors near where a teammate fell up for a minute (route variety: death cost).
    if (this.teams && victim.faction) this.director?.noteDeath(victim.faction, victim.move.pos, this.tick);
    // Zombies: the fallen sit out the rest of the wave.
    victim.respawnTick = this.zombies ? Infinity : this.tick + this.rules.respawnDelayTicks;
    // Suicides (falls, own grenades, traps) are just a death, counted for stats.
    if (!killer) victim.selfKills++;
    this.scenario.playerKilled(victim.slot, killer?.slot ?? null);
    if (this.isLeader(victim)) this.leaderDown(victim, credited);
    this.mode?.onKill(victim, credited);
    if (this.roulette) {
      const scorer = killer && !killer.npc && killer !== victim && !teamKill ? killer : null;
      const r = this.roulette.onKill(victim, scorer, !!scorer);
      if (scorer && r.bonus) scorer.kills += r.bonus;
      if (scorer && r.swap && scorer.alive) this.swapLook(scorer, r.swap);
      if (victim.kind === 'bot') this.roulette.botChoose(victim, this.botBodyStyle(victim));
    }
    if (!credited || credited.npc || this.rules.scoreLimit <= 0) return;
    const score = this.teams && credited.faction ? (this.teamScores().get(credited.faction) ?? 0) : credited.kills;
    if (score >= this.rules.scoreLimit) this.endRound();
  }

  // ---------------------------------------------------------------- pickups

  private collectPickups(c: Combatant): void {
    for (const p of this.pickups) {
      if (!p.enabled || this.tick < p.availableAt) continue;
      // Spears only: no other weapons, ammo or grenades to pick up.
      if (restrictedWeapons(this.rules) && (p.item.effect.kind === 'weapon' || p.item.effect.kind === 'ammo' || p.item.effect.kind === 'throwable')) continue;
      if (horizontalDistance(p.pos, c.move.pos) > PICKUP_RADIUS || Math.abs(p.pos.y - c.move.pos.y) > 1.5) continue;
      if (!this.applyItem(c, p.item)) continue;
      p.availableAt = this.tick + p.respawnTicks;
      this.pendingEvents.push({ e: 'pickup', s: c.slot, id: p.id, item: p.item.id });
      this.scenario.pickupTaken(p.id, c.slot);
      // A random pickup comes back as another weapon of its category.
      this.reroll(p);
    }
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i]!;
      if (horizontalDistance(d.pos, c.move.pos) > PICKUP_RADIUS || Math.abs(d.pos.y - c.move.pos.y) > 1.5) continue;
      if (!this.takeDrop(c, d)) continue;
      this.pendingEvents.push({ e: 'pickup', s: c.slot, id: `drop_${d.id}`, item: d.item.id });
      if (!dropSpent(d)) continue;
      this.drops.splice(i--, 1);
    }
  }

  /**
   * A fallen player's or bot's primary with ammo left drops at the body (rules.dropWeapons; sim/drops.ts):
   * the weapon in hand unless it's part of the starting loadout, else their best one with ammo. It lies on
   * the ground below them (none over the void) for DROP_LIE_SECONDS; past MAX_DROPS the oldest goes.
   */
  private dropWeapon(c: Combatant): void {
    if (!dropsInPlay(this.rules)) return;
    // Never what everyone spawns with (the set's, else the mode's) or the class's own; only the weapon set's weapons.
    const set = this.weaponSet;
    const defaults = new Set([...(set ? setSpawnWeapons(set, this.rules) : this.rules.startingWeapons), ...(c.cls ? CLASS_DEFS[c.cls.id].weapons : [])]);
    const w = chooseDrop(c.weapons.values(), c.weapons.get(c.current), defaults, (def) => setAllowsDrop(set, def.id));
    const item = w && dropItem(w.def);
    if (!w || !item) return;
    const at = c.move.pos;
    const down = this.physics.raycastHit({ x: at.x, y: at.y + 0.5, z: at.z }, { x: 0, y: -1, z: 0 }, DROP_REACH);
    if (!down) return;
    if (this.drops.length >= MAX_DROPS) this.drops.splice(0, this.drops.length - MAX_DROPS + 1);
    this.drops.push({ id: this.nextDropId++, def: w.def, item, mag: w.mag, reserve: w.reserve, alt: w.alt, pos: { x: at.x, y: at.y + 0.5 - down.dist, z: at.z }, yaw: c.yaw, until: this.tick + Math.round(DROP_LIE_SECONDS * TICK_RATE) });
    // (The fallen's inventory stays as it was until they respawn with a fresh loadout: the rest is recycled.)
  }

  /**
   * Picking up a dropped weapon: someone without it gets it with exactly the ammo it held (and comes up like a
   * map pickup's); someone with it takes its ammo as far as their reserve has room. False: nothing taken.
   */
  private takeDrop(c: Combatant, d: WeaponDrop): boolean {
    const code = weaponCode(d.def);
    const owned = c.weapons.get(code);
    if (owned) return takeDropAmmo(owned, d);
    c.weapons.set(code, { def: d.def, mag: Math.min(d.def.magazine, d.mag), reserve: Math.min(d.def.reserveMax, d.reserve), alt: d.alt });
    d.mag = d.reserve = d.alt = 0;
    if (d.def.slot > (weaponByCode(c.current)?.slot ?? 0)) this.switchTo(c, code);
    // Taken whole: it goes (a heat weapon has no ammo to run out of).
    d.until = -1;
    return true;
  }

  /** Dropped weapons lying past their time go. */
  private stepDrops(): void {
    if (!this.drops.length) return;
    const keep = this.drops.filter((d) => d.until > this.tick);
    if (keep.length !== this.drops.length) this.drops.splice(0, this.drops.length, ...keep);
  }

  /** Dropped weapons lying now, for the snapshot (`dw`): [id, item ID, x, y, z, yaw]. */
  dropSnapshots(): [number, string, number, number, number, number][] {
    return this.drops.map((d) => [d.id, d.item.id, r3(d.pos.x), r3(d.pos.y), r3(d.pos.z), r3(d.yaw)]);
  }

  /** Work out what a pickup rolls from (the weapon set, its own category, or the host's mix-up), and roll it afresh when that changed. */
  private repool(p: PickupState): void {
    const pool = setPickupPool(this.weaponSet, p.entity, !!this.rules.mixPickups);
    // Pools are shared per category (categoryItems), so the same pool is the same array.
    if (pool === p.pool) return;
    p.pool = pool;
    if (pool) this.reroll(p);
    else p.item = p.placed;
  }

  /** The next roll of a random pickup (deterministic: the match seed, its ID and its roll count). */
  private reroll(p: PickupState): void {
    if (p.pool) p.item = rollPickup(this.seed, p.id, p.rolls++, p.pool, p.item);
  }

  /** What random pickups hold now, where it isn't what was placed: [pickup ID, item ID] (the snapshot's `pw`). */
  pickupItems(): [string, string][] {
    return this.pickups.filter((p) => p.item !== p.placed).map((p) => [p.id, p.item.id]);
  }

  /** Returns false when the item would be wasted (full health, weapon already maxed), leaving it in place. */
  private applyItem(c: Combatant, item: ItemDefinition): boolean {
    const e = item.effect;
    switch (e.kind) {
      case 'health':
        if (c.health >= c.maxHealth) return false;
        c.health = Math.min(c.maxHealth, c.health + e.amount);
        return true;
      case 'armor':
        if (c.armor >= MAX_ARMOR) return false;
        c.armor = Math.min(MAX_ARMOR, c.armor + e.amount);
        return true;
      case 'ammo': {
        // A typed box fills weapons of that type (fully); the general box gives half a pickup to everything.
        let used = false;
        for (const w of c.weapons.values()) {
          // (A melee weapon with a reserve keeps it for its barrel: the Battle Axe's shells.)
          if (w.def.reserveMax === 0 || (e.ammo && w.def.ammo !== e.ammo)) continue;
          if (w.reserve < w.def.reserveMax) {
            w.reserve = Math.min(w.def.reserveMax, w.reserve + (e.ammo ? w.def.pickupAmmo : Math.ceil(w.def.pickupAmmo / 2)));
            used = true;
          }
        }
        // Explosives also refill underbarrel grenades.
        if (!e.ammo || e.ammo === 'explosive') {
          for (const w of c.weapons.values()) {
            const alt = w.def.alt;
            if (alt?.ammo === 'own' && !alt.reload && w.alt < (alt.max ?? 0)) {
              w.alt = Math.min(alt.max ?? 0, w.alt + (e.ammo ? (alt.pickup ?? 1) : 1));
              used = true;
            }
          }
        }
        return used;
      }
      case 'throwable': {
        const max = THROWABLE_DEFS[e.throwable].max;
        // Carrying the other kind: swap to this one.
        if (c.throwable && c.throwable.kind === e.throwable && c.throwable.count >= max) return false;
        const have = c.throwable?.kind === e.throwable ? c.throwable.count : 0;
        c.throwable = { kind: e.throwable, count: Math.min(max, have + e.count) };
        return true;
      }
      case 'weapon': {
        const def = getWeapon(e.weapon);
        const owned = c.weapons.get(weaponCode(def));
        if (owned) {
          const altMax = def.alt?.ammo === 'own' ? (def.alt.max ?? 0) : 0;
          if (owned.reserve >= def.reserveMax && owned.alt >= altMax) return false;
          owned.reserve = Math.min(def.reserveMax, owned.reserve + def.pickupAmmo);
          owned.alt = Math.min(altMax, owned.alt + (def.alt?.pickup ?? 0));
          return true;
        }
        c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === 'own' ? (def.alt.pickup ?? 0) : 0 });
        // New guns come up immediately, like most arena shooters.
        if (def.slot > (weaponByCode(c.current)?.slot ?? 0)) this.switchTo(c, weaponCode(def));
        return true;
      }
      case 'jetpack':
        if (c.jetFuel === JET.max) return false;
        c.jetFuel = JET.max;
        return true;
      case 'glider':
        if (c.glider) return false;
        c.glider = true;
        return true;
      case 'uav':
        this.uavUntil.set(this.uavSide(c), this.tick + e.seconds * TICK_RATE);
        this.pendingEvents.push({ e: 'msg', text: `${c.name}: UAV online`, secs: 3 });
        return true;
      case 'disc':
        // Only for disc throwers; a fresh one replaces what's left of the last.
        if (![...c.weapons.values()].some((w) => w.def.projectile?.disc)) return false;
        c.discPower = { kind: e.power, shots: DISC_POWER_SHOTS };
        return true;
      case 'powerup':
        if (e.powerup === 'speed') c.speedTicks = e.seconds * TICK_RATE;
        else c.damageTicks = e.seconds * TICK_RATE;
        return true;
    }
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * Spawn at the best spawn point (sim/spawns.ts pickSpawn: far from living
   * enemies, out of their sight, nobody standing on it, not used in the last
   * few seconds), with a little randomness among near-equal choices. In team
   * modes a team uses its own spawns when the map has any, and usually
   * spawns beside a teammate out of the fight (squad spawn).
   */
  private spawn(c: Combatant): void {
    this.ensureSpawnCapacity();
    const relook = this.relookOnSpawn(c);
    const enemies: Vec3[] = [];
    const occupants: Vec3[] = [];
    // Free-for-all parties (net/party.ts): the members aren't a danger the spawn avoids, and it leans their way.
    const party = !this.teams && c.party ? this.partyNear(c) : null;
    for (const o of this.actors()) {
      if (!o.alive || o === c) continue;
      occupants.push(o.move.pos);
      if (this.hostile(c, o) && !party?.has(o)) enemies.push(o.move.pos);
    }
    // A mode may say where (Breakthrough: the side's spawn group for the sector in play).
    const forMode = this.mode?.spawnSpots?.(c) ?? null;
    const own = forMode?.length ? forMode : this.teams && c.faction ? this.spawnPoints.filter((sp) => sp.team === c.faction) : [];
    const shared = this.spawnPoints.filter((sp) => sp.team === null);
    // A team without spawns of its own (more teams than the map has bases) uses the shared ones, else anyone's, farthest from enemies.
    const candidates = own.length ? own : shared.length ? shared : this.spawnPoints;
    // Team modes on shared spawns: the sides rotate. Spawns near teammates out of a fight win, and each side keeps its
    // own end of the map (SpawnSides) wherever the fight has moved: no spawn flips. (On a side's own spawns, the
    // squad spawn below puts them beside a teammate.)
    const rotating = !!this.teams && c.faction !== null && !own.length;
    const calm = this.tick - TICK_RATE * 4;
    const mates = rotating && c.faction ? this.combatants().filter((o) => o !== c && o.alive && o.faction === c.faction && (o.hurtAt ?? -Infinity) < calm).map((o) => o.move.pos) : undefined;
    const side = rotating && c.faction ? this.spawnSides.of(c.faction) : null;
    // Made-up spawn points on a side: the ones nearer the side's base are preferred (they are on its own third anyway).
    const home = own.length && own.some((sp) => sp.generated) && c.faction ? this.sideHome(c.faction) : null;
    const partyAt = party?.size ? [...party].filter((o) => (o.hurtAt ?? -Infinity) < calm).map((o) => o.move.pos) : [];
    const pick = pickSpawn({ tick: this.tick, candidates, lastUsed: this.spawnUsed, enemies, occupants, ...(mates ? { mates } : {}), ...(partyAt.length ? { party: partyAt } : {}), home, side, deaths: this.recentDeaths, sees: (a, b) => this.sees(a, b), rng: this.rng });
    const best = candidates[pick];
    // Team modes: usually beside a teammate who's out of the fight and out of enemy sight, else the safest spawn point.
    // Fireteams: a squadmate beside its leader when that's safe, else at the team's spawn.
    const leader = this.fireteamSpawn(c);
    const squad = leader !== undefined ? leader : this.teams && this.rules.squadSpawn !== false && this.rng() < 0.7 ? this.squadSpawnSpot(c) : null;
    if (!squad && best) this.spawnUsed.set(best, this.tick);
    // Play from here: until play begins, this player's lives start where MapMaker's camera was (startHere).
    const at = c.startAt;
    const sp = at ? { pos: at.pos, yaw: at.yaw } : (squad ?? best ?? { pos: { x: 0, y: 0, z: 0 }, yaw: 0 });
    if (rotating && c.faction) this.spawnSides.note(c.faction, sp.pos);
    c.streak = 0;
    c.order = undefined;
    c.move = { pos: { ...sp.pos }, velY: 0, grounded: false };
    c.yaw = sp.yaw;
    c.pitch = at?.pitch ?? 0;
    c.health = c.maxHealth;
    c.armor = 0;
    c.alive = true;
    c.burnTicks = c.poisonTicks = c.slowTicks = c.frozenTicks = 0;
    c.impact = newImpact();
    c.jetFuel = null;
    c.glider = undefined;
    // A fall cut short by death (shot under a parachute, say) doesn't carry over to the new life.
    c.fallPeak = undefined;
    c.padFlight = false;
    c.breath = 0;
    c.chill = c.bloom = c.windup = c.burstLeft = 0;
    c.semiLatch = false;
    c.gun = newGunState();
    c.reload = null;
    c.spawns = (c.spawns ?? 0) + 1;
    this.loadout(c, c.spawns);
    c.discPower = undefined;
    c.knockedBy = undefined;
    c.spawnedAt = this.tick;
    c.fireCooldown = 0;
    c.throwCooldown = 0;
    c.reloadTicks = 0;
    c.raiseTicks = 0;
    c.speedTicks = 0;
    c.damageTicks = 0;
    // Classes: the class's loadout, health and speed replace all that.
    this.classes?.onSpawn(c);
    // Roulette: the character's signature weapon in hand, a jackpot's armour, a tiny body, spawn protection.
    const rl = this.roulette && !c.cls && c.kind !== 'npc' ? this.roulette : null;
    if (rl) {
      const sig = rl.signatureFor(c);
      if (sig) this.give(c, sig);
      rl.equip(c);
      if (c.bot) c.bot.playAs(this.bodyProfile(c));
    }
    // Spawn protection: a short shield (content/match-play.json, by mode), dropped the moment they fire. Every
    // respawn, and a first life that begins mid-round (someone joining); not the lives the round opens with (everyone
    // is spread over the spawns, and a round with a start gate holds them in the countdown).
    const midRound = (c.spawns ?? 0) > 1 || this.tick - this.roundBegan > TICK_RATE * 2;
    const shield = c.kind === 'npc' || !midRound ? 0 : spawnProtection(this.rules);
    c.shieldUntil = shield > 0 ? this.tick + Math.round(shield * TICK_RATE) : 0;
    c.bot?.onSpawn(sp.yaw);
    this.mode?.onSpawn?.(c);
    const roll = rl?.rollOf(c);
    this.pendingEvents.push({ e: 'spawn', s: c.slot, ...(relook ? { l: c.look } : {}), ...(roll ? { j: roll === 'jackpot' ? (1 as const) : (2 as const) } : {}), ...(rl ? { nx: rl.upcoming(c, 3) } : {}) });
    if (rl && c.kind === 'bot') rl.botChoose(c, this.botBodyStyle(c));
    // Play from here: on foot where you asked (no grid, no plane).
    if (at) return;
    // Air drop maps start you (or always spawn you) in the transport plane.
    if (this.mounts.some((m) => m.route && m.airdrop && m.airdrop !== 'off')) this.boardPlane(c);
  }

  /**
   * The weapon set in play (sim/weaponSets.ts, docs/WEAPON_SETS_PLAN.md): the host's (rules.weaponSet), else the map's
   * default, else Standard; null where the weapons are fixed (spears or discs only, Disc Arena).
   */
  get weaponSet(): WeaponSetDef | null {
    return weaponSetInPlay(this.rules, this.map);
  }

  /**
   * The scoped gun a sniper-role Player Bot spawns with in place of its main gun (docs/BOT_AI_PLAN.md Phase B item 5):
   * the weapon set's (Military: the marksman rifle; Sci-fi: the railgun). None in the other sets, where a sniper goes
   * for a scoped pickup first (BotBrain.pickupScore).
   */
  get sniperGun(): string | null {
    return this.weaponSet?.sniper ?? null;
  }

  /**
   * The starting weapons and grenades for life number `life` (a bot waiting for its spawn wave carries them already):
   * the weapon set's (sim/weaponSets.ts setLoadout: its spawn weapons, its random gun for the life, a sniper-role
   * bot's scoped gun, its first grenade), or one spear or a hand of arena discs where the weapons are fixed.
   */
  private loadout(c: Combatant, life: number): void {
    c.weapons = new Map();
    const set = this.weaponSet;
    const kit = set
      ? setLoadout(set, this.rules, { seed: this.seed, slot: c.slot, life, sniper: c.kind === 'bot' && this.director?.roleOf(c.slot) === 'sniper' })
      : { weapons: [this.rules.weapons === 'spears' ? 'core.spear' : ARENA_DISC], throwable: null };
    for (const id of kit.weapons) {
      const def = getWeapon(id);
      c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === 'own' ? (def.alt.pickup ?? 0) : 0 });
      c.current = weaponCode(def);
    }
    // A grenade or two of the set's first kind (frags, TimeSplitters-style; the rest are pickups after that).
    c.throwable = kit.throwable ? { ...kit.throwable } : null;
  }

  /** A weapon in hand at spawn (Roulette's signature): added full (or topped up when carried), and held. */
  private give(c: Combatant, id: string): void {
    const def = getWeapon(id);
    const code = weaponCode(def);
    c.weapons.set(code, { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === 'own' ? (def.alt.pickup ?? 0) : 0 });
    c.current = code;
  }

  /** How a bot plays its body (Roulette's picks and tokens): a pusher (large, or aggressive), a flanker (small, or a lone wolf). */
  private botBodyStyle(c: Combatant): { push: boolean; flank: boolean } {
    const p = c.bot?.profile;
    const flank = !!p && (p.tags.includes('LONE_WOLF') || p.tags.includes('SNIPER') || p.tags.includes('COWARD'));
    return { push: !!p && !flank && (p.aggression >= 60 || p.tags.includes('BERSERKER')), flank };
  }

  /**
   * A bot whose role was worked out after it spawned (a bot is added, spawns, then the roles are shared out again)
   * takes the loadout of its role at once while it still carries its untouched spawn loadout: a sniper the set's
   * scoped gun, a bot that is no longer one the set's main gun.
   */
  private rearmForRole(c: Combatant): void {
    if (!c.alive || c.kind !== 'bot' || c.cls || !this.sniperGun || c.spawnedAt !== this.tick) return;
    const set = this.weaponSet;
    if (!set) return;
    const life = c.spawns ?? 0;
    const kit = (sniper: boolean) => setLoadout(set, this.rules, { seed: this.seed, slot: c.slot, life, sniper }).weapons.join();
    const now = [...c.weapons.values()].map((w) => w.def.id).join();
    const sniper = this.director?.roleOf(c.slot) === 'sniper';
    if (now !== kit(sniper) && now === kit(!sniper)) this.loadout(c, life);
  }

  /** Under spawn protection now (sim/spawns.ts spawnProtection): nobody else's damage gets through. */
  shielded(c: Combatant): boolean {
    return c.alive && this.tick < (c.shieldUntil ?? 0);
  }

  /** Spawn points used lately (tick), for the recent-use penalty. */
  private readonly spawnUsed = new Map<SpawnSpot, number>();
  /** Where people died lately (the newest SPAWN_DEATHS_KEPT): a spawn point by a fresh body is a worse one. */
  private readonly recentDeaths: SpawnDeath[] = [];
  /** Team modes on shared spawns: where each side has been spawning lately (each keeps its end of the map). */
  private readonly spawnSides = new SpawnSides();
  /** Players the made-up spawn points were last worked out for. */
  private impromptuFor = 0;

  /**
   * Big matches on maps with too few (or too bunched) spawn points for the
   * players in it: extra points made up from the navmesh (sim/spawns.ts
   * generateSpawns), added to `spawnPoints` for this match only (the map is
   * never changed). Worked out again only when the match grows past the
   * players they were made for; the same map and seed give the same points.
   */
  private ensureSpawnCapacity(): void {
    const sized = this.teams && this.rules.teamSizes?.length ? this.rules.teamSizes.reduce((a, b) => a + b, 0) : 0;
    const players = Math.min(MAX_PLAYER_SLOTS, Math.max(sized, this.combatants().length));
    if (players <= this.impromptuFor || players < IMPROMPTU_MIN_PLAYERS) return;
    // In steps of eight players (a match filling up one bot at a time works this out a few times, not every time).
    const target = Math.min(MAX_PLAYER_SLOTS, Math.ceil(players / 8) * 8);
    this.impromptuFor = target;
    const mapSpots = this.spawnPoints.filter((sp) => !sp.generated);
    const targets = this.teamTargets();
    const planned = [...targets.values()].reduce((a, b) => a + b, 0);
    const sides = this.teams ? this.teams.map((t) => ({ id: t.id, players: Math.ceil((targets.get(t.id) ?? 1) * (sized ? 1 : target / Math.max(1, planned))) })) : null;
    const short = spawnShortfall(mapSpots, sides, target);
    if (!short.size) return;
    const avoid = this.map.entities.filter((e) => e.kind === 'trap' || e.kind === 'zone' || e.kind === 'pad' || e.kind === 'portal').map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));
    const valid = (p: Vec3): boolean => {
      if (p.y < this.killY + 3) return false;
      if (avoid.some((a) => horizontalDistance(a, p) < 4.5 && Math.abs(a.y - p.y) < 4)) return false;
      if (this.liquids.length && (liquidAt(this.liquids, { x: p.x, y: p.y + 0.3, z: p.z }) || liquidAt(this.liquids, { x: p.x, y: p.y - 0.6, z: p.z }))) return false;
      if (!this.physics.headroom({ x: p.x, y: p.y + 0.05, z: p.z }, PLAYER.height)) return false;
      if (this.physics.raycastWorld({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }, 1.5) === null) return false;
      // Not at the edge of a drop: walkable ground all round.
      let around = 0;
      for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]] as const) {
        const q = this.nav.closestPoint({ x: p.x + dx, y: p.y + 0.5, z: p.z + dz }, { x: 0.6, y: 1.2, z: 0.6 });
        if (q && Math.abs(q.y - p.y) < 1) around++;
      }
      return around >= 3;
    };
    const made: SpawnSpot[] = [];
    const allCentre = centroid(mapSpots.map((sp) => sp.pos)) ?? { x: 0, y: 0, z: 0 };
    let k = 0;
    for (const [side, count] of short) {
      const home = side ? this.sideHome(side) : null;
      const away = side ? centroid(mapSpots.filter((sp) => sp.team !== null && sp.team !== side).map((sp) => sp.pos)) : null;
      made.push(
        ...generateSpawns({
          places: this.nav.places(),
          existing: [...mapSpots, ...made],
          side,
          count,
          seed: (this.seed * 2654435761 + 977 * ++k) >>> 0,
          home,
          away,
          faceTo: away ?? allCentre,
          valid,
          reachable: (a, b) => this.nav.findPath(a, b) !== null,
        }),
      );
    }
    this.spawnPoints.length = 0;
    this.spawnPoints.push(...mapSpots, ...made);
  }

  /** The middle of a side's own spawn points (the map's), or null when it has none. */
  private sideHome(side: string): Vec3 | null {
    return centroid(this.spawnPoints.filter((sp) => sp.team === side && !sp.generated).map((sp) => sp.pos));
  }

  /**
   * Big matches: a bot joining (or starting a round) waits for its spawn wave
   * instead of spawning on the spot (Match.spawnDue): its loadout now, its place
   * when its turn comes, a few bots a tick.
   */
  private queueSpawn(c: Combatant): void {
    c.alive = false;
    c.respawnTick = this.tick;
    this.loadout(c, (c.spawns ?? 0) + 1);
    // Made-up spawn points now, while the match is being set up, not in its first tick.
    this.ensureSpawnCapacity();
  }

  /** Spawn everyone due: people at once, bots a few a tick in big matches (spawnsPerTick), longest-waiting first. */
  private spawnDue(): void {
    const all = this.combatants();
    const budget = spawnsPerTick(all.length);
    let due: Combatant[] | null = null;
    for (const c of all) {
      if (c.alive || this.tick < c.respawnTick) continue;
      if (c.kind === 'human' || budget === Infinity) this.spawn(c);
      else (due ??= []).push(c);
    }
    if (!due) return;
    due.sort((a, b) => a.respawnTick - b.respawnTick || a.slot - b.slot);
    for (let i = 0; i < due.length && i < budget; i++) this.spawn(due[i]!);
  }

  /** In a big match a bot waits for its spawn wave; otherwise it spawns now. */
  private spawnOrQueue(c: Combatant): void {
    if (c.kind === 'bot' && this.combatants().length >= WAVE_MIN_PLAYERS) this.queueSpawn(c);
    else this.spawn(c);
  }

  /**
   * Ends the round; the winner is the top scorer unless scenario logic names
   * one (`null` = nobody). Co-op missions end with an outcome instead.
   */
  /** The map a "Next map" logic action sent everyone on to (a suite map ID; hosts check it), once the round has ended. */
  nextMap: string | null = null;

  private endRound(forced?: number | null, outcome?: 'victory' | 'defeat', next?: string, winTeam?: string | null): void {
    if (this.phase !== 'playing') return;
    if (next) this.nextMap = next;
    const ranked = this.combatants().sort((a, b) => b.kills - a.kills);
    const named = forced === undefined || forced === null ? undefined : this.actor(forced);
    const top = forced === undefined ? ranked[0] : named && !named.npc ? named : undefined;
    const tied = forced === undefined && top && ranked[1] && ranked[1].kills === top.kills;
    this.phase = 'intermission';
    this.phaseEndTick = this.tick + this.rules.intermissionTicks;
    // The match's awards (and Roulette's), with the round's end: the scoreboard shows them.
    const players = this.combatants().filter((c) => c.kind !== 'npc');
    // (Fireteams: the objective plays of this last tick counted first.)
    if (this.fireteams) this.tallySquads(false);
    const here = new Set(players.map((c) => c.slot));
    const aw = [...this.awards.awards(players.map((c) => c.slot)), ...(this.fireteams ? this.fireteams.scores.awards(this.fireteams.squads, here) : []), ...(this.roulette ? this.roulette.awards(players) : [])];
    if (aw.length) this.pendingEvents.push({ e: 'awards', aw });
    // (Lunar's storm is over with the round.)
    if (this.roulette) this.phys.gravity = this.roulette.calmGravity();
    this.projectiles = [];
    this.bullets = [];
    this.zones = [];
    if (this.teams && !outcome) {
      // Team Deathmatch: the highest team score wins; a tie at the top is a draw (logic can still name a player, whose
      // team wins; a mode can name the team: Breakthrough's attack, or the better of its two rounds).
      const scores = [...this.teamScores()].sort((x, y) => y[1] - x[1]);
      const team = winTeam !== undefined ? winTeam : named && !named.npc ? named.faction : scores.length > 1 && scores[0]![1] === scores[1]![1] ? null : (scores[0]?.[0] ?? null);
      this.pendingEvents.push({ e: 'round_end', winner: null, team });
      return;
    }
    this.pendingEvents.push(outcome ? { e: 'round_end', winner: null, outcome, ...(next ? { next } : {}) } : { e: 'round_end', winner: top && !tied ? top.slot : null });
  }

  /** Scenario chains: start this player with what they carried from the previous map (score, weapons). */
  applyCarry(c: Combatant, carry: CarryOver): void {
    if (carry.kills !== undefined) c.kills = carry.kills;
    if (carry.deaths !== undefined) c.deaths = carry.deaths;
    for (const [id, mag, reserve] of carry.weapons ?? []) {
      let def: WeaponDefinition;
      try {
        def = getWeapon(id);
      } catch {
        continue;
      }
      c.weapons.set(weaponCode(def), { def, mag: Math.max(0, Math.min(def.magazine, mag)), reserve: Math.max(0, Math.min(def.reserveMax, reserve)), alt: def.alt?.max ?? 0 });
    }
  }

  /**
   * Host handoff: everyone in the match as they stand now (people, away players and Player Bots), for a
   * successor host to restore (MatchCheckpoint). `keyOf`: a person's hashed key (handoffKey), when known.
   */
  checkpointPlayers(keyOf: (c: Combatant) => string | null, successor: number | null): CheckpointPlayer[] {
    const r = (v: number) => Math.round(v * 100) / 100;
    return this.combatants().map((c) => {
      const person = c.kind === 'human' || !!c.away;
      const key = person ? keyOf(c) : null;
      const held = c.weapons.get(c.current);
      return {
        name: c.away ? c.away.name : c.name,
        kind: person ? 'human' : 'bot',
        ...(key ? { key } : {}),
        ...(c.slot === successor ? { succ: 1 as const } : {}),
        ...(c.account ? { acct: 1 as const } : {}),
        ...(person && c.party ? { py: c.party } : {}),
        look: c.look,
        team: c.faction,
        k: c.kills,
        d: c.deaths,
        ...(c.selfKills ? { x: c.selfKills } : {}),
        ...(c.objective ? { o: c.objective } : {}),
        alive: c.alive,
        ...(c.alive ? { p: [r(c.move.pos.x), r(c.move.pos.y), r(c.move.pos.z)] as [number, number, number], yaw: r(c.yaw), hp: Math.round(c.health), ar: Math.round(c.armor) } : {}),
        w: [...c.weapons.values()].map((w): [string, number, number] => [w.def.id, w.mag, w.reserve]),
        ...(held ? { cur: held.def.id } : {}),
        ...((t) => (t && tallied(t) ? { sp: tallyRow(t) } : {}))(this.fireteams?.scores.player(c.slot)),
      };
    });
  }

  /**
   * Host handoff (Fireteams follow-ups): the squads as they stand, their members and leader by their index in
   * `checkpointPlayers`' list (the same order: `combatants()`), with each squad's points. Undefined: no squads.
   */
  checkpointSquads(): CheckpointSquad[] | undefined {
    const ft = this.fireteams;
    if (!ft?.squads.length) return undefined;
    const index = new Map(this.combatants().map((c, i) => [c.slot, i]));
    const out: CheckpointSquad[] = [];
    for (const q of ft.squads) {
      const m = q.members.map((slot) => index.get(slot)).filter((i): i is number => i !== undefined);
      if (!m.length) continue;
      const l = q.leader !== null ? (index.get(q.leader) ?? -1) : -1;
      out.push({ m, l, t: tallyRow(ft.scores.squad(q.id)), ...(q.human ? { h: 1 as const } : {}) });
    }
    return out.length ? out : undefined;
  }

  /**
   * Host handoff (Fireteams follow-ups): the squads and points a checkpoint carried, put back once its players are in
   * (`placed`: each checkpoint player's index → their new place). The squads are made again as they were (in their
   * order, members and leader), each with its points, and every player gets their own points back, so nothing starts
   * from zero; the next `sync` brings them in line with whoever is here (a person still away: a bot leads their squad
   * until they're back, as for anyone away).
   */
  restoreSquads(cp: MatchCheckpoint, placed: ReadonlyMap<number, Combatant>): void {
    const size = this.rules.fireteams;
    if (!size || !this.teams || !fireteamMode(this.rules.mode)) return;
    if (!this.fireteams || this.fireteams.size !== size) {
      this.fireteams = new Fireteams(size);
      this.rolesFor = -1;
    }
    const ft = this.fireteams;
    this.squadsDirty = true;
    cp.players.forEach((p, i) => {
      const c = placed.get(i);
      if (c && p.sp) ft.scores.restorePlayer(c.slot, tallyOf(p.sp));
    });
    const list = (cp.squads ?? []).map((q) => {
      const lead = q.l >= 0 ? placed.get(q.l) : undefined;
      const first = lead ?? q.m.map((i) => placed.get(i)).find((c) => !!c?.faction);
      const team = first?.faction ?? null;
      const members = q.m.map((i) => placed.get(i)).filter((c): c is Combatant => !!c && c.faction === team && team !== null).map((c) => c.slot);
      return { team: team ?? '', leader: lead && lead.faction === team ? lead.slot : null, members: team === null ? [] : members, human: q.h === 1 && lead?.kind === 'human' };
    });
    ft.adopt(list, this.tick).forEach((s, k) => {
      if (s) ft.scores.restoreSquad(s.id, tallyOf(cp.squads![k]!.t));
    });
  }

  /**
   * Host handoff: a player just added to this match (addHuman / addBot) takes the place a checkpoint
   * recorded: team, score, weapons, and (alive) where they stood, facing the same way, with the same health.
   * The dead wait a moment and respawn as usual.
   */
  restoreCombatant(c: Combatant, p: CheckpointPlayer): void {
    const team = p.team === null ? null : (this.teams?.find((t) => t.id === p.team)?.id ?? c.faction);
    if (team !== c.faction) {
      c.faction = team;
      this.squadsDirty = true;
    }
    c.kills = p.k;
    c.deaths = p.d;
    c.selfKills = p.x ?? 0;
    c.objective = p.o ?? 0;
    c.account = p.acct === 1;
    // Their party stays together with the new host (team modes: one side; free-for-all: friendly names, spawns).
    if (p.py && p.kind === 'human') c.party = p.py;
    if (p.alive && p.p) {
      if (!c.alive) this.spawn(c);
      this.leaveMount(c, false);
      c.move = { pos: { x: p.p[0], y: p.p[1], z: p.p[2] }, velY: 0, grounded: false };
      c.yaw = p.yaw ?? c.yaw;
      c.pitch = 0;
      c.health = Math.max(1, Math.min(c.maxHealth, p.hp ?? c.maxHealth));
      c.armor = Math.max(0, Math.min(MAX_ARMOR, p.ar ?? 0));
    } else {
      this.leaveMount(c, false);
      c.alive = false;
      c.respawnTick = this.zombies ? Infinity : this.tick + Math.max(TICK_RATE, this.rules.respawnDelayTicks);
    }
    const weapons = new Map<number, WeaponState>();
    for (const [id, mag, reserve] of p.w ?? []) {
      let def: WeaponDefinition;
      try {
        def = getWeapon(id);
      } catch {
        continue;
      }
      weapons.set(weaponCode(def), { def, mag: Math.max(0, Math.min(def.magazine, mag)), reserve: Math.max(0, Math.min(def.reserveMax, reserve)), alt: def.alt?.max ?? 0 });
    }
    if (weapons.size) {
      c.weapons = weapons;
      const cur = [...weapons.values()].find((w) => w.def.id === p.cur) ?? [...weapons.values()][0]!;
      c.current = weaponCode(cur.def);
      c.raiseTicks = 0;
      c.reload = null;
    }
  }

  /**
   * Host handoff: carry on a match restored from a checkpoint in `phase`, with `timeLeft` seconds of it to
   * go: no start gate, countdown or round_start. Objective modes get their team scores back. A checkpoint
   * from before the round began just starts as a new match does.
   */
  resume(phase: MatchPhase, timeLeft: number, teams?: readonly [string, number][]): void {
    if (phase === 'playing') {
      this.phase = 'playing';
      for (const c of this.combatants()) c.spawnedAt = this.tick;
      this.mode?.reset();
      this.zombies?.reset();
      this.phaseEndTick = this.rules.timeLimitSeconds > 0 ? this.tick + Math.max(1, timeLeft) * TICK_RATE : Infinity;
    } else if (phase === 'intermission') {
      this.phase = 'intermission';
      this.phaseEndTick = this.tick + Math.max(1, timeLeft) * TICK_RATE;
    }
    if (teams?.length) this.mode?.restoreScores?.(new Map(teams));
  }

  /** What `c` would carry into the next map of a chain. */
  carryOf(c: Combatant): CarryOver {
    return { kills: c.kills, deaths: c.deaths, weapons: [...c.weapons.values()].map((w): [string, number, number] => [w.def.id, w.mag, w.reserve]) };
  }

  /** People (players and spectators) whose client has loaded everything (start gate). */
  private readonly readySlots = new Set<number>();

  /** A client finished loading. Late joiners just play; the first ones start the countdown. */
  ready(slot: number): void {
    this.readySlots.add(slot);
  }

  private startCountdown(): void {
    this.phase = 'countdown';
    this.phaseEndTick = this.tick + COUNTDOWN_SECONDS * TICK_RATE;
  }

  /** The countdown is over: the round (and its clock, objectives and waves) starts now. */
  private beginPlay(): void {
    // Drop routes start from their first point as play begins (off the map's edge, for a run-in).
    for (const m of this.mounts) if (m.route) m.routeT0 = this.tick;
    this.phase = 'playing';
    for (const c of this.combatants()) {
      c.spawnedAt = this.tick;
      // Play from here: from now on, lives start at the spawn points.
      c.startAt = undefined;
    }
    this.phaseEndTick = this.roundEndTick();
    this.mode?.reset();
    this.zombies?.reset();
    this.roulette?.calm();
    this.pendingEvents.push({ e: 'round_start' });
  }

  /**
   * Called as each new round starts (the scoreboard's end, or a restart), before it resets: HostControl puts the
   * rules the host saved for the next match in play.
   */
  beforeRound?: () => void;

  /** The tick the round in play began (spawn protection leaves out the lives the round opens with). */
  private roundBegan = 0;

  private startRound(): void {
    this.beforeRound?.();
    this.phase = 'playing';
    this.roundBegan = this.tick;
    for (const m of this.mounts) if (m.route) m.routeT0 = this.tick;
    this.phaseEndTick = this.roundEndTick();
    for (const p of this.pickups) p.availableAt = 0;
    this.drops.length = 0;
    for (const id of [...this.npcs.keys()]) this.removeNpc(id);
    this.encounters.reset();
    this.scenario.reset();
    for (const cv of [...this.covers]) this.removeCover(cv);
    this.uavUntil.clear();
    this.jamUntil.clear();
    this.leaderBounty.clear();
    for (const c of this.combatants()) {
      c.kills = 0;
      c.selfKills = 0;
      c.objective = 0;
      c.deaths = 0;
      c.alive = false;
      this.leaveMount(c, false);
    }
    this.airdropped.clear();
    this.mode?.reset();
    this.zombies?.reset();
    this.classes?.reset();
    this.roulette?.reset();
    this.awards.reset();
    this.fireteams?.scores.reset();
    for (const c of this.combatants()) this.spawnOrQueue(c);
    if (this.opts.startGate) {
      // Every round opens with the countdown (round_start comes when it ends).
      this.startCountdown();
      return;
    }
    this.pendingEvents.push({ e: 'round_start' });
  }

  timeLeftSeconds(): number {
    // A mode with a clock of its own shows it while in play (Breakthrough's sector clock).
    const own = this.phase === 'playing' ? (this.mode?.clock?.() ?? null) : null;
    if (own !== null) return own;
    return Number.isFinite(this.phaseEndTick) ? Math.max(0, Math.ceil((this.phaseEndTick - this.tick) / TICK_RATE)) : 0;
  }

  // ---------------------------------------------------------------- snapshots

  playerSnapshots(): PlayerSnapshot[] {
    return this.combatants().map((c) => {
      const s: PlayerSnapshot = {
        s: c.slot,
        p: [c.move.pos.x, c.move.pos.y, c.move.pos.z],
        vy: c.move.velY,
        g: c.move.grounded ? 1 : 0,
        yaw: r3(c.yaw),
        pitch: r3(c.pitch),
        hp: Math.ceil(c.health),
        ar: Math.ceil(c.armor),
        alive: c.alive ? 1 : 0,
        w: c.current,
        pu: (c.speedTicks > 0 ? POWERUP_SPEED_BIT : 0) | (c.damageTicks > 0 ? POWERUP_DAMAGE_BIT : 0),
      };
      if (c.move.vx || c.move.vz) {
        s.vx = c.move.vx ?? 0;
        s.vz = c.move.vz ?? 0;
      }
      const fx = statusBits(c) | (this.classes?.fx(c) ?? 0) | (c.alive && this.shielded(c) ? FX_PROTECTED : 0) | (this.roulette && c.alive && this.roulette.rollOf(c) === 'jackpot' ? FX_JACKPOT : 0);
      if (fx) s.fx = fx;
      if (c.cls) s.cl = classIndex(c.cls.id);
      if (c.bot) s.st = c.bot.state;
      if (c.move.stance) s.sn = c.move.stance;
      if (c.emoteUntil && this.tick < c.emoteUntil) s.em = 1;
      if (c.move.sprint) s.sr = 1;
      if (c.move.chute) s.ch = c.move.chute;
      if (c.move.drop) s.dr = 1;
      if (c.move.zip !== undefined) s.zl = [c.move.zip, c.move.zs ?? 0, c.move.zv ?? 0];
      return s;
    });
  }

  private uavSide(c: Combatant): string {
    return this.teams && c.faction ? `team:${c.faction}` : `slot:${c.slot}`;
  }

  /** Under an enemy Counter-UAV: the minimap shows static. */
  private jammed(c: Combatant): number {
    const side = this.uavSide(c);
    let until = 0;
    for (const [jammer, end] of this.jamUntil) if (jammer !== side && end > until) until = end;
    return until > this.tick ? until : 0;
  }

  /** Mark what you're aiming at for your side: an enemy in your sights, or the spot. */
  private ping(c: Combatant): void {
    const aim = this.aimAt(c);
    if (!aim) return;
    const { at, target } = aim;
    c.lastPing = { pos: { ...at }, target: target?.slot ?? null, tick: this.tick };
    this.pendingEvents.push({ e: 'ping', s: c.slot, p: tuple(at), ...(target ? { t: target.slot } : {}), ...(this.teams && c.faction ? { team: c.faction } : {}) });
  }

  /** What `c` aims at: an enemy in their sights (its middle), else the world along their view within 150 m; null: nothing. */
  private aimAt(c: Combatant): { at: Vec3; target: Combatant | null } | null {
    const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
    const dir = viewDirection(c.yaw, c.pitch);
    const wall = this.physics.raycastWorld(eye, dir, 150) ?? 150;
    let target: Combatant | null = null;
    let best = wall;
    for (const o of this.actors()) {
      if (!o.alive || o === c || !this.hostile(c, o)) continue;
      const d = rayCapsule(eye, dir, o.move.pos, PLAYER.radius * o.size + 0.35, bodyHeightOf(o.move, o.size));
      if (d !== null && d < best) {
        best = d;
        target = o;
      }
    }
    if (best >= 150 && !target) return null;
    const at = target ? { x: target.move.pos.x, y: target.move.pos.y + 1, z: target.move.pos.z } : add(eye, scale(dir, best));
    return { at, target };
  }

  /** "Follow me!" / "Hold here!": your side's bots nearby do it for a while. */
  private orderBots(c: Combatant, kind: 'follow' | 'hold'): void {
    const lead = this.isLeader(c);
    for (const b of this.combatants()) {
      if (b.kind !== 'bot' || !b.alive || b === c || this.hostile(c, b)) continue;
      // Free-for-all has no side to order.
      if (!this.teams && this.rules.mode !== 'core.coop' && this.rules.mode !== 'core.zombies') continue;
      // A team leader's order reaches the whole team; anyone else's, the bots within earshot.
      if (!lead && horizontalDistance(b.move.pos, c.move.pos) > 30) continue;
      b.order = { kind, leader: c.slot, pos: { ...c.move.pos }, until: this.tick + TICK_RATE * 40 };
    }
  }

  /** Kill-streak rewards, earned at these streaks. */
  private streakReward(c: Combatant): void {
    if (this.rules.killstreaks === false || c.npc) return;
    const r = STREAK_REWARDS.findIndex((x) => x.kills === c.streak);
    if (r < 0) return;
    const reward = STREAK_REWARDS[r]!;
    this.pendingEvents.push({ e: 'streak', s: c.slot, r });
    const side = this.uavSide(c);
    switch (reward.id) {
      case 'uav':
        this.uavUntil.set(side, Math.max(this.uavUntil.get(side) ?? 0, this.tick + TICK_RATE * 20));
        break;
      case 'supply':
        // Heal and restock you and every teammate within 15 m.
        for (const o of this.actors()) {
          if (!o.alive || o.npc || (o !== c && (this.hostile(c, o) || horizontalDistance(o.move.pos, c.move.pos) > 15))) continue;
          const healed = Math.min(50, o.maxHealth - o.health);
          o.health += healed;
          for (const w of o.weapons.values()) w.reserve = Math.max(w.reserve, w.def.reserveMax);
          if (healed > 0) this.pendingEvents.push({ e: 'heal', s: c.slot, t: o.slot, n: Math.round(healed) });
        }
        break;
      case 'counter_uav':
        this.jamUntil.set(side, this.tick + TICK_RATE * 20);
        break;
      case 'airstrike':
        c.throwable = { kind: 'airstrike', count: 1 };
        break;
    }
  }

  /**
   * Team modes: a spot beside a teammate nobody is shooting at (no enemy
   * within 20 m, not hurt in the last few seconds), or null.
   */
  private squadSpawnSpot(c: Combatant): { pos: Vec3; yaw: number } | null {
    if (!this.teams || !c.faction || this.rules.squadSpawn === false || c.kind === 'npc') return null;
    const enemies = this.actors().filter((o) => o.alive && this.hostile(c, o));
    const mates = this.combatants().filter((o) => o !== c && o.alive && !o.mount && o.faction === c.faction && o.move.grounded && this.tick - (o.hurtAt ?? -Infinity) > TICK_RATE * 4 && !enemies.some((e) => distance(e.move.pos, o.move.pos) < 20) && this.mode?.spawnBeside?.(c, o) !== false);
    if (!mates.length) return null;
    // A few of them at random, out of enemy sight (the nearest three within 50 m checked for a clear line to its head;
    // never beside a teammate an enemy is looking at), the one nearest the fight (none within 20 m, above).
    for (let i = mates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [mates[i], mates[j]] = [mates[j]!, mates[i]!];
    }
    let mate: Combatant | null = null;
    let mateScore = -Infinity;
    for (const o of mates.slice(0, 4)) {
      const near = enemies.map((e) => ({ e, d: distance(e.move.pos, o.move.pos) })).filter((x) => x.d < 50).sort((a, b) => a.d - b.d);
      const head = { x: o.move.pos.x, y: o.move.pos.y + 1.6, z: o.move.pos.z };
      if (near.slice(0, 3).some((x) => this.sees({ x: x.e.move.pos.x, y: x.e.move.pos.y + 1.6, z: x.e.move.pos.z }, head))) continue;
      const score = -(near.length ? near[0]!.d : 50);
      if (score > mateScore) [mate, mateScore] = [o, score];
    }
    if (!mate) return null;
    return this.besideMate(mate);
  }

  /** A clear spot on walkable ground a step from `mate` (behind or beside them), facing their way; null: none. */
  private besideMate(mate: Combatant): { pos: Vec3; yaw: number } | null {
    // Only beside a teammate on walkable ground (the navmesh), and onto it: one stuck where nobody walks drew every
    // squadmate spawning after it in with it (a rider thrown under a street's floor: four bots a round).
    const walkable = (p: Vec3): boolean => {
      const q = this.nav.closestPoint({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0.6, y: 1.2, z: 0.6 });
      return !!q && Math.abs(q.y - p.y) < 1;
    };
    if (!walkable(mate.move.pos)) return null;
    for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2, 0, (3 * Math.PI) / 4, (-3 * Math.PI) / 4]) {
      const yaw = mate.yaw + a;
      const pos = { x: mate.move.pos.x + Math.sin(yaw) * 1.4, y: mate.move.pos.y, z: mate.move.pos.z + Math.cos(yaw) * 1.4 };
      // Clear of walls, with floor under it, and not through a wall from the teammate.
      if (!this.physics.headroom({ x: pos.x, y: pos.y + 0.05, z: pos.z }, PLAYER.height)) continue;
      const floor = this.physics.raycastWorld({ x: pos.x, y: pos.y + 0.5, z: pos.z }, { x: 0, y: -1, z: 0 }, 1.5);
      if (floor === null) continue;
      if (!this.physics.lineOfSight({ x: mate.move.pos.x, y: mate.move.pos.y + 1, z: mate.move.pos.z }, { x: pos.x, y: pos.y + 1, z: pos.z })) continue;
      const at = { x: pos.x, y: pos.y + 0.5 - floor, z: pos.z };
      if (!walkable(at)) continue;
      return { pos: at, yaw: mate.yaw };
    }
    return null;
  }

  /** The owning player's inventory and timers. */
  privateState(slot: number): PrivateState | undefined {
    const c = this.slots[slot];
    if (!c) return undefined;
    return {
      inv: [...c.weapons.entries()].sort((a, b) => a[0] - b[0]).map(([code, w]) => (w.def.heat ? [code, w.mag, w.reserve, w.alt, Math.round((w.heat ?? 0) * 100) + (w.overheated ? 100 : 0)] : [code, w.mag, w.reserve, w.alt])),
      ...(statusSpeed(c) !== 1 ? { ms: Math.round(statusSpeed(c) * 1000) } : {}),
      ...(c.speedMul !== 1 || c.stats.jump !== 1 || c.stats.stamina !== 1 ? { bs: [Math.round(c.speedMul * 1000), Math.round(c.stats.jump * 1000), Math.round(c.stats.stamina * 1000)] as [number, number, number] } : {}),
      ...(c.mount ? { mo: this.seatState(c) } : {}),
      ...(c.throwable ? { gr: [THROWABLES.indexOf(c.throwable.kind), c.throwable.count] as [number, number] } : {}),
      rl: c.reloadTicks,
      rs: c.raiseTicks,
      ...(c.dealt?.some((d) => d[0] > this.tick - DEALT_KEEP_TICKS) ? { dd: c.dealt.filter((d) => d[0] > this.tick - DEALT_KEEP_TICKS).map((d) => [d[0], Math.round(d[1]), d[2], round2(d[3]), round2(d[4]), round2(d[5])] as [number, number, number, number, number, number]) } : {}),
      ...(c.reload && c.reloadTicks > 0 ? { rd: [RELOAD_KINDS.indexOf(c.reload.kind), c.reload.t, c.reload.total, c.reload.stage] as [number, number, number, number] } : {}),
      ...([...c.weapons.values()].some((w) => w.unchambered) ? { uc: [...c.weapons.entries()].filter(([, w]) => w.unchambered).map(([code]) => code) } : {}),
      sp: c.speedTicks,
      dm: c.damageTicks,
      ...(c.jetFuel !== null ? { jp: c.jetFuel } : {}),
      ...(c.glider ? { gl: 1 as const } : {}),
      ...(this.jammed(c) ? { jm: Math.ceil((this.jammed(c) - this.tick) / TICK_RATE) } : {}),
      ...(c.streak ? { ks: c.streak } : {}),
      ...((this.uavUntil.get(this.uavSide(c)) ?? 0) > this.tick ? { uv: Math.ceil((this.uavUntil.get(this.uavSide(c))! - this.tick) / TICK_RATE) } : {}),
      ...(c.move.stamina !== undefined || c.move.rest || c.move.winded ? { sta: [Math.round((c.move.stamina ?? 1) * 1000), c.move.rest ?? 0, c.move.winded ? 1 : 0] as [number, number, number] } : {}),
      ...(this.classes?.privateState(c) ?? {}),
      ...(c.discPower ? { dp: [DISC_POWERS.indexOf(c.discPower.kind), c.discPower.shots] as [number, number] } : {}),
      ...(this.roulette ? { rp: this.roulette.privateState(c) } : {}),
    };
  }

  /** Compact NPC state for snapshots (see NpcSnapshot). */
  npcSnapshots(): NpcSnapshot[] {
    const factions = this.factions;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return [...this.npcs.values()].map((c) => {
      const role = NPC_ROLES.indexOf(c.npc!.role);
      const snap: NpcSnapshot = [c.slot, r2(c.move.pos.x), r2(c.move.pos.y), r2(c.move.pos.z), r3(c.yaw), r3(c.pitch), Math.ceil((Math.max(0, c.health) / c.maxHealth) * 100), role, Math.max(0, factions.findIndex((f) => f.id === c.faction)), c.alive ? 1 : 0, c.current];
      if (c.size !== 1) snap.push(r2(c.size));
      return snap;
    });
  }

  scores(): ScoreEntry[] {
    const ft = this.fireteams;
    return this.combatants().map((c) => {
      const pts = ft ? ft.scores.points(c.slot) : 0;
      return { s: c.slot, k: c.kills, d: c.deaths, ...(c.selfKills ? { x: c.selfKills } : {}), ...(c.objective ? { o: c.objective } : {}), ...(pts ? { p: pts } : {}) };
    });
  }

  /** Credit objective plays (the scoreboard's Caps / Bomb / Rescues column) to the player who made them. */
  private noteObjectives(events: readonly GameEvent[]): void {
    for (const ev of events) {
      // (Breakthrough credits a zone's capture to the attackers standing in it itself.)
      const play = (ev.e === 'flag' && ev.a === 'capture') || ((ev.e === 'bomb' || ev.e === 'bt') && (ev.a === 'plant' || ev.a === 'defuse')) || (ev.e === 'hostage' && ev.a === 'rescue');
      if (!play || ev.s === null || ev.s === undefined) continue;
      const c = this.slots[ev.s];
      if (c) c.objective++;
    }
  }

  /** Snapshot message body shared by every recipient; hosts add the per-recipient `ack` and `me`. */
  snapshot(events: GameEvent[]): Omit<Extract<ServerMessage, { t: 'snapshot' }>, 't' | 'ack' | 'me'> {
    return {
      tick: this.tick,
      phase: this.phase,
      timeLeft: this.timeLeftSeconds(),
      players: this.playerSnapshots(),
      score: this.scores(),
      ev: events,
      pr: this.projectiles.map((p) => [p.id, r3(p.pos.x), r3(p.pos.y), r3(p.pos.z), PROJECTILE_VISUALS.indexOf(p.spec.visual)]),
      pk: this.pickups.filter((p) => !p.enabled || this.tick < p.availableAt).map((p) => p.id),
      ...(this.pickups.some((p) => p.item !== p.placed) ? { pw: this.pickupItems() } : {}),
      ...(this.drops.length ? { dw: this.dropSnapshots() } : {}),
      ...(this.mounts.length ? { mt: this.mountSnapshots() } : {}),
      ...(this.mounts.some((m) => m.susp && m.alive) ? { ms: this.suspensionSnapshots() } : {}),
      ...(this.covers.length ? { cv: this.covers.map((c): CoverSnapshot => [c.id, r3(c.pos.x), r3(c.pos.y), r3(c.pos.z), r3(c.yaw), Math.ceil((Math.max(0, c.health) / c.max) * 100)]) } : {}),
      ...(this.zones.length ? { zn: this.zones.map((z): ZoneSnapshot => [ZONE_KINDS.indexOf(z.kind), r3(z.pos.x), r3(z.pos.y), r3(z.pos.z), r3(z.kind === 'smoke' ? this.smokeNow(z) : z.radius), Math.round((z.endTick - this.tick) / 6) / 10]) } : {}),
      sc: this.scenario.delta(),
      np: this.npcSnapshots(),
      ...(this.rules.leaders && this.teams ? { ld: this.teams.map((t) => this.leaderOf.get(t.id) ?? -1) } : {}),
      ...(this.fireteams && this.teams ? { fs: this.fireteams.squads.map((q) => squadSnapshot(q, this.teams!.findIndex((t) => t.id === q.team), this.fireteams!.scores.squad(q.id).points, q.human && q.ordered ? null : (this.mode?.squadRole?.(q.id) ?? null))) } : {}),
      ...(this.roulette?.snapshot() ? { rl: this.roulette.snapshot()! } : {}),
      ...(this.mode ? { md: this.mode.snapshot() } : this.zombies ? { md: { ts: [this.zombies.wave], zb: this.zombies.snapshot() } } : {}),
    };
  }

  roster(): RosterEntry[] {
    const players = this.combatants().map((c): RosterEntry => ({ slot: c.slot, name: c.name, bot: c.kind === 'bot', look: c.look, team: this.teams ? c.faction : null, ...(c.account && c.kind === 'human' ? { acct: 1 as const } : {}), ...(c.party && c.kind === 'human' ? { py: c.party } : {}) }));
    // Spectators by choice, last: on no team, marked `sp`.
    if (!this.spectators.size) return players;
    return [...players, ...[...this.spectators].map(([slot, s]): RosterEntry => ({ slot, name: s.name, bot: false, look: s.look, team: null, sp: 1, ...(s.account ? { acct: 1 as const } : {}), ...(s.party ? { py: s.party } : {}) }))];
  }

  destroy(): void {
    this.nav.destroy();
    this.physics.free();
  }
}

/**
 * An actor as bots see it. Every view has every field (one object shape):
 * perception reads dozens of them a look, and views of mixed shapes made those
 * reads polymorphic.
 */
function toView(c: Combatant, concealed = false, sheltered = false): CombatantView {
  return { slot: c.slot, pos: c.move.pos, yaw: c.yaw, pitch: c.pitch, health: c.health, armor: c.armor, alive: c.alive, stance: stanceOf(c.move), human: c.kind === 'human', mounted: !!c.mount, sheltered, grounded: c.move.grounded, object: false, concealed, riding: c.move.zip !== undefined, climbing: !!c.move.climb, chute: !!c.move.chute, size: c.size, box: hitboxOf(c), hitScale: c.hitScale, winded: !!c.move.winded, ...(c.shieldUntil ? { shielded: true, shieldUntil: c.shieldUntil } : {}) };
}

/** Refill a view made by toView for this tick. */
function fillView(v: CombatantView, c: Combatant, concealed: boolean, sheltered: boolean): void {
  v.slot = c.slot;
  v.pos = c.move.pos;
  v.yaw = c.yaw;
  v.pitch = c.pitch;
  v.health = c.health;
  v.armor = c.armor;
  v.alive = c.alive;
  v.stance = stanceOf(c.move);
  v.human = c.kind === 'human';
  v.mounted = !!c.mount;
  v.sheltered = sheltered;
  v.grounded = c.move.grounded;
  v.concealed = concealed;
  v.riding = c.move.zip !== undefined;
  v.climbing = !!c.move.climb;
  v.chute = !!c.move.chute;
  v.size = c.size;
  v.box = hitboxOf(c);
  v.hitScale = c.hitScale;
  v.shielded = !!c.shieldUntil && c.alive;
  v.shieldUntil = c.shieldUntil ?? 0;
}

/** A combatant's hit shapes, taken again when its look changed (players and bots; an NPC's are set at its spawn). */
function hitboxOf(c: Combatant): LookHitbox {
  if (c.kind !== 'npc' && c.hitLook !== c.look) {
    const h = lookHitbox(c.look);
    c.hitbox = h.box;
    c.hitScale = h.scale;
    c.hitLook = c.look;
  }
  return c.hitbox;
}

/** Distance from point p to the segment a-b. */
function segmentDistance(p: Vec3, a: Vec3, b: Vec3, lift = 0): number {
  // Scalar maths (the same numbers as the vector version, no objects: noteCombat calls this for every bot on every shot).
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const py = p.y + lift;
  const len2 = abx * abx + aby * aby + abz * abz;
  const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (py - a.y) * aby + (p.z - a.z) * abz) / len2)) : 0;
  const dx = p.x - (a.x + abx * t);
  const dy = py - (a.y + aby * t);
  const dz = p.z - (a.z + abz * t);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Away players (BotFiller.watch, hold, input): an online player who stops
 * playing is warned, then a bot plays their place until they come back; a
 * player whose connection drops keeps their place for a while, a bot playing
 * it, and their next connection takes it back.
 */
export const AWAY = {
  /** Idle this long (no moving, turning or pressing anything) and a bot plays for you (0: never). */
  afkSeconds: 90,
  /** The warning comes this long before. */
  warnSeconds: 15,
  /** A dropped player's place is kept this long for them to reconnect. */
  holdSeconds: 60,
  /** Away for being idle this long (still connected): removed from the match, freeing the place (0: never). */
  kickMinutes: 10,
} as const;

/** What BotFiller.watch found: players to warn, players a bot now plays for, holds that ran out, idle players to remove. */
export interface AwayChanges {
  warn: number[];
  away: number[];
  released: string[];
  /** Away for being idle past `kickMinutes`: the host removes them (kick), freeing the place. */
  kick: number[];
}

/** A follower in a squad of the host's bot set further than this (m) from its leader goes back to it. */
const SQUAD_STRAY = 14;

/** People in the match: players, and away players whose place a bot keeps for them. */
const isPerson = (c: Combatant) => c.kind === 'human' || !!c.away;

/** Which bot gives way first (lowest first): random bots, then the host's set from its last entry back (the first ones stay longest). */
const setRank = (c: Combatant): number => (c.botSet ? 1_000_000 - c.botSet.index : 0);

/** The general bot names (content/botNames.ts), still exported here for older imports. */
export { BOT_NAMES };

/** Keeps a match at a target player count by adding or removing Player Bots around the humans. */
export class BotFiller {
  private counter = 0;
  /** The host's bot set (sim/botSet.ts): its bots come first, in order; null: every bot random. */
  private set: BotSet | null = null;
  /** The set changed mid-match: bots are swapped in and out one at a time (stage), not all at once. */
  private staging = false;
  /** The host chose the set (a map change carries it on); otherwise it is the map's own (MapDocument.bots), or none. */
  private chosen = false;

  constructor(
    private readonly match: Match,
    private difficulty: BotDifficulty = BOT_DIFFICULTIES.normal,
    /**
     * `takeBack`: a bot takes a leaving player's place where they stood; off (the default), the slot empties and a fresh bot spawns normally.
     * `botSet`: the host's bot set (already validated: validateBotSet); without one, the map's own bots play.
     */
    private readonly opts: { takeBack?: boolean; botSet?: BotSet | null } = {},
  ) {
    this.chosen = botSetInUse(opts.botSet);
    this.set = this.chosen ? opts.botSet! : mapBotSet(match.map);
  }

  /** The set the host chose (null: theirs is none, so the next map's own bots play), for a map change to carry on. */
  get hostSet(): BotSet | null {
    return this.chosen ? this.set : null;
  }

  /** The host's bot set now (null: random bots). */
  get botSet(): BotSet | null {
    return this.set;
  }

  /** Whether a changed set is still being swapped in (stage). */
  get settling(): boolean {
    return this.staging;
  }

  /** The next random bot's base profile (it plays its look's own when it has one). */
  private nextProfile(): BotProfile {
    return CORE_BOT_PROFILES[this.counter++ % CORE_BOT_PROFILES.length]!;
  }

  /**
   * A random bot's name for what it wears (content/botNames.ts): the look's own name, else its theme's next free
   * name, else a general one. Never a name in use in the match (players, bots, spectators) or the host's set's;
   * `self`: the bot being renamed (its own name is free to keep).
   */
  nameFor(look: string, self?: Combatant): string {
    const used = new Set<string>();
    for (const n of this.match.namesInUse()) used.add(n.toLowerCase());
    if (self) used.delete(self.name.toLowerCase());
    if (this.set) for (const e of this.set.entries) used.add(e.name.toLowerCase());
    // Roulette: every life wears another look, so a name after one ("Biscuit", the cat) soon names the wrong
    // character (the owner aimed at the old man and read "Biscuit"): a general name, kept for the match.
    const from = this.match.roulette ? undefined : look;
    // Matches differ in which names come up (the seed); seed 1 (tests, default) takes each list in order.
    return botNameFor(from, (n) => used.has(n.toLowerCase()), (this.match.seed - 1) * 37);
  }

  /**
   * The bot-characters setting changed (Match.setRules({ botCast }) first): random bots wearing a look it no
   * longer allows change into one it does, named for it. Returns how many changed.
   */
  recast(): number {
    return this.match.recastBots((look, self) => this.nameFor(look, self));
  }

  /** A team of the match by order (a set's `team`), or undefined (auto, or no such team). */
  private teamAt(i: number | undefined): string | undefined {
    return i === undefined ? undefined : this.match.teams?.[i]?.id;
  }

  /** The set's bots not in the match now, in order. */
  private waiting(): { entry: BotEntry; index: number }[] {
    const set = this.set;
    if (!set) return [];
    const used = new Set<number>();
    for (const c of this.match.combatants()) if (c.kind === 'bot' && c.botSet) used.add(c.botSet.index);
    return set.entries.flatMap((entry, index) => (used.has(index) ? [] : [{ entry, index }]));
  }

  /**
   * The next bot to add: the set's first bot waiting for the team that most needs a player (its own team's
   * first, then one without a team), else a random bot; with "only these bots", null when none fits.
   */
  private pick(): { entry: BotEntry; index: number; team?: string } | 'random' | null {
    const set = this.set;
    if (!set) return 'random';
    const free = this.waiting();
    const m = this.match;
    if (m.teams) {
      const team = m.nextBotTeam()!;
      const own = free.find((x) => this.teamAt(x.entry.team) === team) ?? free.find((x) => this.teamAt(x.entry.team) === undefined);
      if (own) return { ...own, team };
      if (set.fill === 'random') return 'random';
      // Only these bots: another team with room whose own bots wait.
      const other = free.find((x) => {
        const t = this.teamAt(x.entry.team);
        if (!t) return false;
        const r = m.teamRoom(t);
        return r.on < r.size;
      });
      return other ? { ...other, team: this.teamAt(other.entry.team)! } : null;
    }
    const first = free[0];
    return first ?? (set.fill === 'only' ? null : 'random');
  }

  /** Add one bot (the set's next, else a random one). False when none can be added. */
  private addOne(): boolean {
    const p = this.pick();
    if (!p) return false;
    if (p === 'random') {
      return !!this.match.addBot((look) => this.nameFor(look), this.nextProfile(), this.difficulty, true);
    }
    const e = p.entry;
    const profile = CORE_BOT_PROFILES[p.index % CORE_BOT_PROFILES.length]!;
    const botSet = { index: p.index, ...(e.skill ? { skill: e.skill } : {}), ...(e.style ? { style: e.style } : {}), ...(e.squad ? { squad: e.squad } : {}) };
    return !!this.match.addBot(e.name, profile, this.difficulty, true, { ...(p.team ? { team: p.team } : {}), ...(e.look ? { look: e.look } : {}), botSet });
  }

  /**
   * The host set a new bot set (or none) mid-match. Bots already playing one of its entries keep their place
   * (matched by name, else by position in the list) and take the entry's name, look, skill, style and squad
   * now; bots whose entry is gone play on as random bots. The rest (new entries, team moves, "only these
   * bots") is swapped in one bot at a time by `stage`, so a big change never lands in one frame.
   */
  setBotSet(next: BotSet | null): void {
    const set = botSetInUse(next) ? next : null;
    this.set = set;
    this.chosen = true;
    const bots = this.match.combatants().filter((c) => c.kind === 'bot' && !c.away && c.botSet);
    const claimed = new Map<Combatant, number>();
    const taken = new Set<number>();
    if (set) {
      for (const c of bots) {
        const i = set.entries.findIndex((e, j) => !taken.has(j) && e.name.toLowerCase() === c.name.toLowerCase());
        if (i >= 0) {
          claimed.set(c, i);
          taken.add(i);
        }
      }
      for (const c of bots) {
        const i = c.botSet!.index;
        if (claimed.has(c) || i >= set.entries.length || taken.has(i)) continue;
        claimed.set(c, i);
        taken.add(i);
      }
    }
    for (const c of bots) {
      const i = claimed.get(c);
      if (i === undefined) this.match.dropSetBot(c, this.nameFor(c.look, c), this.difficulty);
      else this.match.updateSetBot(c, i, set!.entries[i]!, this.difficulty);
    }
    this.staging = true;
  }

  /**
   * One step of swapping a changed set in (call a few times a second while `settling`): one bot that no
   * longer fits (a random bot where a set bot waits for its team, a set bot on the wrong team, any random
   * bot under "only these bots") goes, and the fill brings in the next. Returns whether the roster changed.
   */
  stage(fill: number): boolean {
    if (!this.staging) return false;
    const m = this.match;
    const set = this.set;
    const bots = m.combatants().filter((c) => c.kind === 'bot' && !c.away);
    const waiting = this.waiting();
    const fits = (team: string | null) => waiting.some((x) => {
      const t = this.teamAt(x.entry.team);
      return t === undefined || t === team;
    });
    const stale = bots
      .filter((c) => {
        if (c.botSet) {
          const e = set?.entries[c.botSet.index];
          const t = this.teamAt(e?.team);
          return !e || (t !== undefined && t !== c.faction);
        }
        return !!set && (set.fill === 'only' || fits(c.faction));
      })
      .sort((a, b) => setRank(a) - setRank(b) || b.slot - a.slot)[0];
    if (stale) {
      m.remove(stale.slot);
      this.rebalance(fill);
      return true;
    }
    this.staging = false;
    const before = bots.length;
    this.rebalance(fill);
    return m.combatants().filter((c) => c.kind === 'bot' && !c.away).length !== before;
  }

  /**
   * A player joins: the worst-scoring bot on the team that needs them is removed
   * to make room (Match.takeOverBot) and they spawn normally, or they get a slot
   * of their own when there is no bot. Then the fill is kept.
   */
  join(name: string, look: string | undefined, fill: number, party?: string): Combatant | null {
    let c = this.match.takeOverBot(name, look, party);
    if (!c) {
      c = this.match.addHuman(name, look, party ? this.match.partyTeam(party) : undefined);
      if (c && party) c.party = party;
    }
    this.rebalance(fill);
    return c;
  }

  /** A player leaves: their slot empties and the fill spawns a fresh bot normally (or, with `takeBack`, a bot takes their place where they were). */
  leave(slot: number, fill: number): void {
    const c = this.match.slots[slot];
    // A spectator leaving: only the slot kept for them frees up.
    if (!c) return this.match.remove(slot);
    if (c.away) {
      // Gone for good while away: the bot playing their place stays, as a bot of its own.
      this.release(slot);
      return this.rebalance(fill);
    }
    const all = this.match.combatants();
    const humans = all.filter(isPerson).length - (c.kind === 'human' ? 1 : 0);
    const bots = all.filter((x) => x.kind === 'bot' && !x.away).length;
    const want = Math.max(0, Math.min(fill - humans, MAX_PLAYER_SLOTS - humans - this.match.spectatorCount));
    if (this.opts.takeBack === true && c.kind === 'human' && bots < want) {
      this.match.handToBot(slot, this.nameFor(c.look), this.nextProfile(), this.difficulty, true);
    } else this.match.remove(slot);
    this.rebalance(fill);
  }

  /**
   * A player chooses to spectate (Match.spectate): their body leaves the match and the fill brings in a bot
   * for the place, as when a player leaves. False when they aren't a player in the match.
   */
  spectate(slot: number, fill: number): boolean {
    if (!this.match.spectate(slot)) return false;
    this.warned.delete(slot);
    this.rebalance(fill);
    return true;
  }

  /** A spectator joins play again (their kept slot and score); a bot gives way to keep the fill, as when a player joins. */
  rejoin(slot: number, fill: number): Combatant | null {
    const c = this.match.joinFromSpectating(slot);
    if (c) this.rebalance(fill);
    return c;
  }

  private warned = new Set<number>();

  /**
   * A player is away: a bot plays their place for them. `why` afk: idle but
   * connected (they come back by playing: input); dropped: their connection
   * closed, and the place is kept `holdSeconds` for their next connection
   * (reclaim, by `key`: their account, else their browser key). Without a key
   * a dropped player simply leaves.
   */
  hold(slot: number, why: 'afk' | 'dropped', key: string | null, fill: number, holdSeconds: number = AWAY.holdSeconds): boolean {
    const c = this.match.slots[slot];
    if (!c) return false;
    if (why === 'dropped' && (!key || holdSeconds <= 0)) {
      this.leave(slot, fill);
      return false;
    }
    this.warned.delete(slot);
    const until = why === 'dropped' ? this.match.tick + Math.round(holdSeconds * TICK_RATE) : null;
    if (c.away) {
      // Idle, then the connection dropped too: now held for a reconnect.
      c.away = { ...c.away, why, key: key ?? c.away.key, until };
      return true;
    }
    const profile = this.nextProfile();
    return !!this.match.setAway(slot, { name: c.name, key, why, until, since: this.match.tick }, profile, this.difficulty);
  }

  /** A player's inputs: a player away for being idle is back the moment they play. Then the inputs are queued. */
  input(slot: number, inputs: readonly PlayerInput[]): boolean {
    const active = this.match.noteActivity(slot, inputs);
    const c = this.match.slots[slot];
    let back = false;
    if (active && c?.away?.why === 'afk') back = !!this.match.comeBack(slot);
    if (active) this.warned.delete(slot);
    this.match.queueInputs(slot, inputs);
    return back;
  }

  /**
   * Host handoff: fill a fresh match from a checkpoint. Bots come back as bots, `me` (the successor's own
   * player, marked `succ`) as a player, and everyone else as an away player whose place a bot keeps, held
   * for their next connection by their hashed key (reclaim). Returns the successor's own player.
   */
  restore(cp: MatchCheckpoint, fill: number, me: { name: string; look?: string }, placed: Map<number, Combatant> = new Map()): Combatant | null {
    let mine: Combatant | null = null;
    // People first (their teams as they were), then the bots. `placed`: each checkpoint player's index → their new place.
    const order = cp.players.map((p, i) => ({ p, i })).sort((a, b) => (a.p.kind === b.p.kind ? 0 : a.p.kind === 'human' ? -1 : 1));
    for (const { p, i } of order) {
      if (p.kind === 'bot') {
        const profile = CORE_BOT_PROFILES[this.counter % CORE_BOT_PROFILES.length]!;
        this.counter++;
        const c = this.match.addBot(p.name, profile, this.difficulty, true);
        if (!c) continue;
        c.look = validLookId(p.look);
        this.match.restoreCombatant(c, p);
        placed.set(i, c);
        continue;
      }
      const self = p.succ === 1 && !mine;
      const c = this.match.addHuman(self ? me.name : p.name, self ? (me.look ?? p.look) : p.look, p.team);
      if (!c) continue;
      this.match.restoreCombatant(c, p);
      placed.set(i, c);
      if (self) mine = c;
      // Their place waits for them (twice the usual hold: everyone is reconnecting at once, some on slow machines);
      // with no key, a bot takes it over for good.
      else this.hold(c.slot, 'dropped', p.key ?? null, fill, AWAY.holdSeconds * 2);
    }
    mine ??= this.match.addHuman(me.name, me.look);
    // Fireteams: the squads and their points as the old host had them (follow-ups).
    this.match.restoreSquads(cp, placed);
    this.rebalance(fill);
    return mine;
  }

  /** A new connection takes back the place held for `key` (a dropped player reconnecting). Null when none is held. */
  reclaim(key: string, name: string): Combatant | null {
    const c = this.match.combatants().find((x) => x.away && x.away.key === key);
    if (!c) return null;
    this.warned.delete(c.slot);
    return this.match.comeBack(c.slot, name);
  }

  /** Whether this player is away (a bot plays for them). */
  isAway(slot: number): boolean {
    return !!this.match.slots[slot]?.away;
  }

  /**
   * Once a second or so: warn players about to go idle, hand idle players'
   * places to bots (`afkSeconds`; 0: never), and end holds that ran out (the
   * bot stays). `people`: the slots this applies to (online players; never the
   * host's own player in a browser-hosted game).
   */
  watch(fill: number, people: ReadonlySet<number>, afkSeconds: number = AWAY.afkSeconds, kickMinutes: number = AWAY.kickMinutes): AwayChanges {
    const out: AwayChanges = { warn: [], away: [], released: [], kick: [] };
    const m = this.match;
    for (const c of m.combatants()) {
      const away = c.away;
      if (away && away.until !== null && m.tick >= away.until) {
        out.released.push(away.name);
        this.release(c.slot);
      }
    }
    if (out.released.length) this.rebalance(fill);
    // Idle time counts only while the match is being played.
    if (m.phase !== 'playing') {
      m.resetIdle();
      this.warned.clear();
      return out;
    }
    if (afkSeconds <= 0) return out;
    // Away for being idle too long, still connected: the host removes them (someone opening many tabs and leaving them).
    if (kickMinutes > 0) {
      for (const c of m.combatants()) {
        const a = c.away;
        if (a?.why === 'afk' && people.has(c.slot) && a.since !== undefined && m.tick - a.since >= kickMinutes * 60 * TICK_RATE) out.kick.push(c.slot);
      }
      // A spectator has no body for a bot to play: one who sends no camera input at all for as long is removed too.
      for (const slot of m.spectatorSlots()) if (people.has(slot) && m.idleSeconds(slot) >= kickMinutes * 60) out.kick.push(slot);
    }
    for (const c of m.combatants()) {
      if (c.kind !== 'human' || !people.has(c.slot)) continue;
      const idle = m.idleSeconds(c.slot);
      if (idle >= afkSeconds) {
        this.hold(c.slot, 'afk', null, fill);
        out.away.push(c.slot);
      } else if (idle >= afkSeconds - AWAY.warnSeconds && !this.warned.has(c.slot)) {
        this.warned.add(c.slot);
        out.warn.push(c.slot);
      }
    }
    return out;
  }

  /** A held place is no longer kept: the bot playing it stays, under a bot name. */
  private release(slot: number): void {
    const c = this.match.slots[slot];
    if (!c?.away) return;
    delete c.away;
    delete c.party;
    c.name = this.nameFor(c.look, c);
    this.warned.delete(slot);
  }

  /** Bot skill now (the host can change it mid-match: retune). */
  get skill(): BotDifficulty {
    return this.difficulty;
  }

  /** The host changed bot skill (and maybe style): bots in the match and bots added later play that way. */
  retune(difficulty: BotDifficulty, style?: MatchRules['botStyle']): void {
    this.difficulty = difficulty;
    this.match.retuneBots(difficulty, style);
  }

  /**
   * Keep humans + bots at `fill`. Too many: bots go, the worst-scoring first
   * (fewest kills less deaths, as when a player joins), from the team most
   * over its size so the sides stay as set. Too few: bots join and spawn
   * normally on the teams that need them.
   */
  rebalance(fill: number): void {
    // Uneven teams resized: a team over its size gives up bots first (worst-scoring first), then the fill tops the others up.
    if (this.match.teams) {
      const targets = this.match.teamTargets();
      const score = (c: Combatant) => c.kills - c.deaths;
      for (const t of this.match.teams) {
        const on = this.match.combatants().filter((c) => c.faction === t.id);
        const spare = on.filter((c) => c.kind === 'bot' && !c.away).sort((a, b) => setRank(a) - setRank(b) || score(a) - score(b) || a.kills - b.kills || b.slot - a.slot);
        for (let n = on.length; n > (targets.get(t.id) ?? n) && spare.length; n--) this.match.remove(spare.shift()!.slot);
      }
    }
    const all = this.match.combatants();
    const humans = all.filter(isPerson).length;
    const bots = all.filter((c) => c.kind === 'bot' && !c.away);
    // Spectators aren't in the match (a bot plays in their place) but each keeps a slot.
    const want = Math.max(0, Math.min(fill - humans, MAX_PLAYER_SLOTS - humans - this.match.spectatorCount));
    const targets = this.match.teamTargets();
    for (let i = bots.length; i > want; i--) {
      // In team modes, take bots from the team most over its size so the sides stay as set.
      const live = this.match.combatants();
      // How full the team stays without one of its bots: the team left fullest gives one up (ties: the bigger team).
      const over = (team: string | null) => (live.filter((c) => c.faction === team).length - 1) / (team ? (targets.get(team) ?? 1) : 1);
      const score = (c: Combatant) => c.kills - c.deaths;
      const left = live.filter((c) => c.kind === 'bot' && !c.away).sort((a, b) => over(b.faction) - over(a.faction) || setRank(a) - setRank(b) || score(a) - score(b) || a.kills - b.kills || b.slot - a.slot);
      this.match.remove(left[0]!.slot);
    }
    // The host's set first, in order (per team in team modes), then random bots (unless the set says only these).
    for (let i = bots.length; i < want; i++) if (!this.addOne()) break;
  }
}

/** What one trigger pull does: the weapon's own fire, or its second trigger. */
interface Trigger {
  id: string;
  kind: WeaponDefinition['kind'];
  damage: number;
  pellets: number;
  spread: number;
  range: number;
  projectile?: ProjectileSpec;
  alt?: true;
  pierce?: number;
  chain?: WeaponDefinition['chain'];
  status?: StatusHit;
  knockback?: number;
  recoil?: WeaponDefinition['recoil'];
  headshot?: number;
  /** Second triggers: their own kick and falloff (AltFire). */
  kick?: KickSpec;
  falloff?: FalloffSpec;
}

/** Leader variant (rules.leaders 'vip'): extra points for downing an enemy team's leader. */
export const LEADER_BOUNTY = 3;

/** Past this many thinking bots, bots think in full on one tick in BOT_THINK_EVERY (Match.botBudget). */
export const BOT_FULL_RATE = 40;
/** Big matches: a full think every this many ticks (20 Hz); steering or coasting in between. */
export const BOT_THINK_EVERY = 3;
/** Think budget: full thinks a tick past an even share (thinking bots / BOT_THINK_EVERY) before the rest wait a tick. */
const BOT_THINK_SLACK = 6;
/** In those matches, bots this far (m) from every player move at half rate (Match.relaxedMove). */
export const RELAXED_RANGE = 45;
/** Bots this close (m) to a buried tunnel's footprint always make the exact move (Match.relaxedMove). */
const RELAXED_BORE = 2;
const NO_BORES: readonly GroundCut[] = [];
/** Bots this close (m) to a portal's edge always make the exact move (Match.relaxedMove). */
const RELAXED_PORTAL = 6;
/** Held buttons a coasting bot keeps (movement stance); fire, use, jump and the rest are one-shot. */
const COAST_BUTTONS = BUTTON_SPRINT | BUTTON_CROUCH | BUTTON_PRONE;
/**
 * Route searches bots may start in a tick (NavWorld.beginTick; BOT_AI_PLAN.md Phase C item 4): a 96-bot match averages
 * about ten a tick, its spikes (a respawn wave, a flag taken: everyone's goal moves at once) several times that; those
 * over it wait a tick, following the route they have.
 */
const SEARCH_BUDGET = 24;

/** Crouching steadies your aim; lying prone steadies it more. */
const STANCE_SPREAD = [1, 0.7, 0.5] as const;
/** Extra cone (radians) of a scoped rifle fired before the scope is half up: 30 cm at 10 m. */
export const NO_SCOPE_SPREAD = 0.03;

/** Extra spread from moving and jumping (radians); multi-pellet guns already spray, so they care less. */
function movementSpread(c: Combatant, def: Trigger): number {
  if (def.kind === 'melee') return 0;
  const k = def.pellets > 1 ? 0.35 : 1;
  const run = Math.min(1, c.moveSpeed / PLAYER.runSpeed);
  return (run > 0.25 ? 0.014 * run : 0) * k + (c.move.grounded ? 0 : 0.035 * k);
}

/** Scoped: a third of the spread. Scope weapons fired unscoped: a wide no-scope cone (NPCs aim their own way). */
/** Spread while aiming down the sights of an unscoped gun. */
const ADS_SPREAD = 0.55;

function aimSpread(c: Combatant, def: Trigger, spread: number): number {
  const w = getWeapon(def.id);
  if (def.alt || c.npc) return spread;
  // Aiming down the sights tightens every gun; scopes most of all.
  if (!w.view.zoomFov) return c.prevButtons & BUTTON_ZOOM ? spread * ADS_SPREAD : spread;
  if (c.prevButtons & BUTTON_ZOOM) return spread * 0.35;
  return spread + (w.view.zoomFov < 0.5 ? 0.05 : 0.012);
}

function primaryTrigger(def: WeaponDefinition): Trigger {
  return {
    id: def.id,
    kind: def.kind,
    damage: def.damage,
    pellets: def.pellets,
    spread: def.spread,
    range: def.range,
    ...(def.projectile ? { projectile: def.projectile } : {}),
    ...(def.pierce ? { pierce: def.pierce } : {}),
    ...(def.chain ? { chain: def.chain } : {}),
    ...(def.status ? { status: def.status } : {}),
    ...(def.knockback ? { knockback: def.knockback } : {}),
    ...(def.recoil ? { recoil: def.recoil } : {}),
    ...(def.headshot !== undefined ? { headshot: def.headshot } : {}),
  };
}

/** Use one round (or add heat) for a shot; false when the weapon can't fire. */
function spendRound(w: WeaponState): boolean {
  // Limited mounted ammunition (the Tank's shells): none aboard, no shot; heat (if any) still paces it.
  if (w.shells !== undefined) {
    if (w.shells <= 0 || w.overheated) return false;
    w.shells--;
  }
  const heat = w.def.heat;
  if (heat) {
    if (w.overheated) return false;
    w.heat = (w.heat ?? 0) + heat.perShot;
    if (w.heat >= 1) {
      w.heat = 1;
      w.overheated = true;
    }
    return true;
  }
  if (w.def.magazine > 0) {
    if (w.mag === 0 || w.unchambered) return false;
    w.mag--;
  }
  return true;
}

/** Whether a hit came from a melee strike (a melee weapon, a punch or a kick): melee strength counts, not damage dealt. */
function isMeleeWeapon(weapon: string): boolean {
  if (weapon === UNARMED.punch.id || weapon === UNARMED.kick.id) return true;
  return CORE_WEAPONS[weapon]?.kind === 'melee';
}

/** Body-zone damage multiple for a weapon: head, torso or legs (spec §11). */
function zoneScale(gp: Gunplay, zone: HitZone): number {
  return zone === 1 ? gp.head : zone === 2 ? gp.legs : 1;
}
/** Movement multiplier from status effects (frozen solid, chilled, slowed) and the mode (carrying a flag). */
function statusSpeed(c: Combatant): number {
  if (c.frozenTicks > 0) return 0;
  return (c.slowTicks > 0 ? 0.55 : 1) * impactSpeed(c.impact) * (1 - 0.6 * c.chill) * (c.modeSpeed ?? 1) * (c.classSpeed ?? 1);
}

const inZone = (z: Zone, feet: Vec3): boolean => zoneContains(z.kind, z.pos, z.radius, feet);

/** Status bits for snapshots (STATUS_*). */
function statusBits(c: Combatant): number {
  return (c.move.jet ? FX_JET : 0) | (c.move.swim ? FX_SWIM : 0) | (c.burnTicks > 0 ? STATUS_BURN : 0) | (c.poisonTicks > 0 ? STATUS_POISON : 0) | (c.slowTicks > 0 ? STATUS_SLOW : 0) | (c.frozenTicks > 0 ? STATUS_FROZEN : 0) | (c.chill > 0.05 ? STATUS_CHILL : 0);
}

function altTrigger(def: WeaponDefinition, alt: AltFire): Trigger {
  return {
    id: def.id,
    kind: alt.kind,
    damage: alt.damage ?? def.damage,
    pellets: alt.pellets ?? def.pellets,
    spread: alt.spread ?? def.spread,
    range: alt.range ?? def.range,
    ...(alt.projectile ? { projectile: alt.projectile } : {}),
    ...(alt.kick ? { kick: alt.kick } : {}),
    ...(alt.falloff ? { falloff: alt.falloff } : {}),
    ...(alt.headshot !== undefined ? { headshot: alt.headshot } : {}),
    alt: true,
  };
}

/** Two decimals (event positions). */
const round2 = (v: number): number => Math.round(v * 100) / 100;
