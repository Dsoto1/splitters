import type { LookHitbox } from '../sim/hitbox.ts';
import { angleDelta, clamp, createRng, distance, horizontalDistance, lookAngles, type Vec3, hypot } from '../math.ts';
import type { NavWorld } from '../nav/index.ts';
import type { Corridor } from '../nav/corridors.ts';
import { parkourAlong, parkourInput, type ParkourKind, type ParkourLink } from '../nav/parkour.ts';
import { LIFT_FLAG, PLAYER, STANCES, TICK_DT, TICK_RATE, type Stance } from '../sim/constants.ts';
import { PICKUP_RADIUS, type ItemDefinition, type ItemEffect } from '../sim/items.ts';
import { BUTTON_ALT, BUTTON_CROUCH, BUTTON_FIRE, BUTTON_MELEE, BUTTON_JUMP, BUTTON_PRONE, BUTTON_RELOAD, BUTTON_SPRINT, BUTTON_THROW, BUTTON_USE, BUTTON_ZOOM, type PlayerInput } from '../sim/movement.ts';
import { THROWABLE_DEFS, getWeapon, smokeBlocks, weaponCode, type AltFire, type ProjectileSpec, type SmokeCloud, type ThrowableKind, type WeaponDefinition } from '../sim/weapons.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import { segmentHitsAabb, type Aabb } from '../sim/scenarioDefs.ts';
import { AimModel, type AimContext, type AimSolution, type AimTarget } from './aim.ts';
import { findCover, stillCovered, type CoverSpot } from './cover.ts';
import type { SightCache } from './sight.ts';
import type { ViewGrid } from './grid.ts';
import { MapMemory, laneWaypoint, pickExploreGoal } from './explore.ts';
import type { BotPlan } from './director.ts';
import type { PricedTrip } from './teamBrain.ts';
import { GUN_WEIGHT, OPT_CHASE, OPT_COVER, OPT_FIGHT, OPT_NOISE, OPT_PICKUP, OPT_POST, OPT_RETREAT, OPTIONS, POST_WEIGHT, SCOPE_WEIGHT, bestChoice, scoreChoices, type ChoiceInput } from './choices.ts';
import { goodShot, relocatePrefer, shotsPerSpot } from './sniper.ts';
import type { VantageBoard, VantageKind } from './vantage.ts';
import { simProfile } from '../sim/profile.ts';
import { hasTag, type BotDifficulty, type BotProfile } from './profile.ts';
import { fanPoints, isDoorway, solveThrow, turnAngle } from './tactics.ts';
import {
  ANTI_VEHICLE_SPLASH,
  ROADKILL_SPEED,
  RIDER_MIN_PROGRESS,
  RIDER_STUCK_TICKS,
  BOARD_CHECK_TICKS,
  MAX_BOARD_FAILS,
  aboutToBlow,
  antiVehicle,
  avoidSeconds,
  boardingSpot,
  freshDrive,
  inBoardingReach,
  inArc,
  inVehiclePath,
  mountOf,
  noHeadway,
  rideFor,
  steer,
  turretFor,
  vehicleFor,
  type DriveState,
  type Headway,
  type MountView,
  type SeatView,
} from './vehicles.ts';
import { followGuide, type Guide } from './guides.ts';

export type { MountView, SeatView } from './vehicles.ts';

export interface CombatantView {
  slot: number;
  pos: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  alive: boolean;
  /** Crouching (1) or prone (2); absent when standing. */
  stance?: Stance;
  /** A human player (bots leave vehicles to them). */
  human?: boolean;
  /** Sitting in a turret or vehicle. */
  mounted?: boolean;
  /** On the ground (not jumping or falling). */
  grounded?: boolean;
  /** A machine (a sentry gun), not a person: its own body would block a sight line to its middle. */
  object?: boolean;
  /** Hidden in a bush (and quiet): only spotted up close. */
  concealed?: boolean;
  /** Riding a zipline (the line carries them; they can't steer). */
  riding?: boolean;
  /** On a ladder (off the navmesh: no route starts there). */
  climbing?: boolean;
  /** Under an open canopy (a parachute or glider): no route starts in the air, but it steers. */
  chute?: boolean;
  /** Out of breath (ran its stamina dry): no sprinting until it is back (sim/movement.ts SPRINT.restart). */
  winded?: boolean;
  /** Body size (BODY_SIZES scale: small 0.78, large 1.18; absent = 1): eye, aim point and hit body scale with it. */
  size?: number;
  /** Its measured hit shapes and their scale before `size` (sim/hitbox.ts): bots aim at the real head and chest. */
  box?: LookHitbox | null;
  hitScale?: number;
}

export interface PickupView {
  id: string;
  item: ItemDefinition;
  pos: Vec3;
  available: boolean;
  /** Seconds until a taken pickup comes back (arena bots time items). */
  respawnIn?: number;
}

export interface InventoryView {
  def: WeaponDefinition;
  mag: number;
  reserve: number;
  /** Rounds of a second trigger with its own ammo (the Battle Axe's barrel). */
  alt?: number;
}

/** Something heard: gunfire or an explosion, and who made it (actor ID, -1 for nobody). */
export interface NoiseView {
  pos: Vec3;
  tick: number;
  by: number;
  /** Loudness: how far away it can be heard (m). */
  range: number;
}

/** Everything a bot may read. Bots get no more information than this. */
export interface BotWorldView {
  tick: number;
  self: CombatantView;
  others: readonly CombatantView[];
  physics: PhysicsWorld;
  nav: NavWorld;
  spawnPoints: readonly Vec3[];
  pickups: readonly PickupView[];
  /** The bot's own weapons and the slot it is holding. */
  inventory: readonly InventoryView[];
  /** Grenades or mines carried, and which. */
  throwables?: number;
  throwable?: ThrowableKind | null;
  held: number;
  /** Reloading right now. */
  reloading?: boolean;
  /** Closed doors bots can't open and intact breakable walls: paths through them are treated as unreachable. */
  blockers?: readonly Aabb[];
  /** The same as navmesh flags (NavWorld.markOpenings): a route asked for with them keeps out of those openings. */
  shut?: number;
  /** Traps that are dangerous right now: bots wait at the edge instead of walking in. */
  hazards?: readonly Aabb[];
  /**
   * Buttons that open closed doors (the door's box is one of `blockers`):
   * where to stand and the button face to aim at. A bot whose path a door
   * blocks goes and presses one first.
   */
  doorButtons?: readonly { door: Aabb; stand: Vec3; face: Vec3 }[];
  /** Lifts (movers going up and down): the ride's two ends (a navmesh link) and where the platform's top is now. */
  lifts?: readonly { start: Vec3; end: Vec3; top: Vec3; half: number }[];
  /**
   * Portal pairs (a navmesh link each way): where to step in, where you come
   * out, the portal's surface to walk into, and whether the pair works now
   * (logic can switch portals off: then the shortcut is shut).
   */
  portals?: readonly { start: Vec3; end: Vec3; face: Vec3; on: boolean }[];
  /**
   * Ziplines (a navmesh link each, one way, or each way on a two-way line):
   * where to stand and press E to grab it, where it drops you, and whether
   * this bot may ride it (team lines are shut to the other teams).
   */
  ziplines?: readonly { start: Vec3; end: Vec3; on: boolean }[];
  /**
   * Squad order (NPCs) or co-op goal (Player Bots): when not fighting, go here
   * instead of roaming, and wait within `radius` of it. Objective goals (CTF)
   * say more: see OrderGoal.
   */
  orderGoal?: OrderGoal | null;
  /** Living friendly actors (teammates, squadmates); may include the bot itself. */
  allies?: readonly CombatantView[];
  /** Recent gunfire and explosions. */
  noises?: readonly NoiseView[];
  /** A shot passed close by (or hit): when, and from where. */
  shotAt?: { tick: number; from: Vec3 } | null;
  /** Turrets and vehicles on the map. */
  mounts?: readonly MountView[];
  /** Routes and roads a bot driving a vehicle follows when one runs its way (guides.ts). */
  guides?: readonly Guide[];
  /** The seat the bot is in, if any. */
  seat?: SeatView | null;
  /** Squad tactics (NPCs): advance now (bounding) or hold and cover the one that is. */
  squad?: { advance: boolean } | null;
  /** Line of sight between actors shared by all bots in the match (perception uses it when given). */
  sight?: SightCache | undefined;
  /** A big match (past BOT_FULL_RATE bots): perception casts a bounded number of sight lines. */
  crowded?: boolean;
  /** Smoke clouds up now (smoke grenades, SMOKE): a sight line through one is blocked; shots still go through. */
  smoke?: readonly SmokeCloud[];
  /** `allies` on a grid (big matches): keeping apart reads the cells around the bot. */
  alliesGrid?: ViewGrid | undefined;
  /** The match's planning for this bot (role, squad, side knowledge: director.ts); undefined without one. */
  plan?: BotPlan | undefined;
}

/** What aiming reads (BotBrain.steer reads the whole view, like think). */
type SteerView = Pick<BotWorldView, 'tick' | 'self' | 'others' | 'inventory' | 'held'>;

/** Where a bot was sent (BotWorldView.orderGoal; the modes' BotGoal). */
export interface OrderGoal {
  pos: Vec3;
  radius: number;
  /**
   * Keep to it (CTF attackers, flag carriers, escorts, bots answering a flag in trouble): an enemy who slipped
   * away or a noise doesn't draw the bot off its way unless close or on the way (`detour`), it leaves cover as
   * soon as nobody is in sight, and it fights on the move rather than stopping to trade shots at range.
   */
  push?: boolean;
  /** How far (m) it goes out of its way for something (a noise, an enemy that slipped away, a gun); default by personality. */
  detour?: number;
  /** Run for it (a flag carrier): sprint there and never stop, not for cover, a retreat or a fight (it shoots only at enemies right on it). */
  run?: boolean;
  /** Holding it (CTF defenders): where the enemy comes from, to watch while it moves between spots round it. */
  watch?: Vec3 | null;
  /** A person's order ("Follow me!", "Hold here!"): it wins over pickups, noises and chases (bots still fight what they see). */
  order?: boolean;
}

export type BotState = 'roam' | 'advance' | 'engage' | 'cover' | 'chase' | 'investigate' | 'retreat' | 'hold' | 'mount' | 'mounted' | 'dead';

/**
 * What a bot did on its last think, and so why it stood still when it did
 * (measuring only: tools/bot-report.ts and the bot tests read it; nothing
 * decides on it). Set once per think, a string assignment.
 * - goal / station: going to its mode or order goal / within it (holding on purpose); stage: gathering with its group
 *   for a push (teamBrain.ts);
 * - squad, squadWait, regroup, singleFile: squad moves (director.ts);
 * - roam, pickup: its own goals; post, postTravel: a camper's or sniper's vantage spot;
 * - fight, cover, retreat, chase, chaseHold (a tactical bot holding the angle where an enemy vanished), investigate;
 * - noPath: wanted to go somewhere and had no route (or was backing off asking again); escape: getting off a patch of
 *   navmesh cut off from where it is going (planEscape);
 * - lift, zip, press (a door button), corner (pausing to check a corner), hazard (waiting at a trap), scan (looking
 *   round where an enemy was), throw (lining up a grenade), dodge (out of a vehicle's way);
 * - mount, mounted, dead.
 */
export type BotDoing =
  | 'goal'
  | 'station'
  | 'stage'
  | 'squad'
  | 'squadWait'
  | 'regroup'
  | 'singleFile'
  | 'roam'
  | 'pickup'
  | 'post'
  | 'postTravel'
  | 'fight'
  | 'cover'
  | 'retreat'
  | 'chase'
  | 'chaseHold'
  | 'investigate'
  | 'noPath'
  | 'escape'
  | 'parkour'
  | 'lift'
  | 'zip'
  | 'press'
  | 'corner'
  | 'hazard'
  | 'scan'
  | 'throw'
  | 'dodge'
  | 'mount'
  | 'mounted'
  | 'dead';

const SIGHT_RANGE = 60;
/**
 * A sniper on its spot with the scope up sees further (Phase B item 5): out to its gun's reach, SCOPE_SIGHT at most, but
 * past SIGHT_RANGE only within SCOPE_COS of where it looks (its scope's narrower view).
 */
const SCOPE_SIGHT = 120;
const SCOPE_COS = Math.cos((30 * Math.PI) / 180);
const HEARING_RANGE = 6;
/** How close a bot must be to spot someone hiding in a bush, and to keep tracking them once seen (m). */
const CONCEAL_SPOT = 4;
const CONCEAL_TRACK = 9;
const FOV_COS = Math.cos((110 / 2) * (Math.PI / 180));
const STUCK_WINDOW_TICKS = TICK_RATE;
const PATH_REFRESH_TICKS = TICK_RATE / 2;
/** Desirability of a pistol: a bot carrying nothing better goes for a gun first. */
const SIDEARM = 0.4;
/** Length of a route over the ground (m). */
function pathLength(route: readonly Vec3[]): number {
  let len = 0;
  for (let i = 1; i < route.length; i++) len += horizontalDistance(route[i - 1]!, route[i]!);
  return len;
}

/** Shortest trip (m) worth taking a vehicle for (vehicles.ts uses the same). */
const VEHICLE_TRIP = 55;
/** How far (m, plus height) a bot with only a sidearm detours for a gun. */
const GUN_DETOUR = 30;
/** Bounding (boundPhase): fights this far off or more (m); Mixed-style bots only from BOUND_MIXED. */
const BOUND_FROM = 12;
const BOUND_MIXED = 18;
/** How far a sniper-role bot goes for a scoped gun (m, plus height). */
const SCOPE_DETOUR = 70;
/** A sniper whose target looks straight at it (this or more: within about 25°) a moment is spotted: it moves on. */
const SPOTTED_FACING = 0.9;
/** Riding along: a vehicle standing still this long (s), with nothing to shoot for 4 s, is parked; riders get out. */
const RIDE_PARKED_SECONDS = 8;
/** A bot at the wheel gives up (gets out) when the route left hasn't shrunk this much (m) in this long (s). */
const DRIVE_PROGRESS_SECONDS = 12;
const DRIVE_MIN_PROGRESS = 10;
/** A pickup a bot got stuck going for is left alone this long (s). */
const PICKUP_GIVE_UP_SECONDS = 90;
/** How far (m) a bot goes to hop into a teammate's vehicle. */
const RIDE_REACH = 25;
/** Enemy vehicles: how far (m, plus height) a bot goes for a rocket or grenade launcher once one has been seen lately (VEHICLE_MEMORY s). */
const LAUNCHER_DETOUR = 30;
/** An objective at least this far off is gone to by a lane of the bot's own (orderTarget). */
const LANE_FROM = 50;
/**
 * Route variety (teamBrain.ts): a goal further than this (m) is gone to by a corridor (by its via, viaRoute); a bot
 * gathering for a group push keeps watch within STAGE_RADIUS of the spot.
 */
const ROUTE_FROM = 25;
const STAGE_RADIUS = 6;
/** Seconds a bot waits at a lift for the platform before it looks for another way (liftWait). */
const LIFT_PATIENCE = 6;
const VEHICLE_MEMORY = 12;
/** Score bonus (weaponScore) for an anti-vehicle weapon against a target in a vehicle; melee is worse than useless. */
const ANTI_VEHICLE_BONUS = 1.2;
/** Stepping out of a vehicle's path: committed for this long (s); sprinting when it is this close (s away). */
const DODGE_SECONDS = 0.8;
const DODGE_SPRINT_ETA = 1.2;
/**
 * How far (m) past the navmesh's edge a bot steps straight for a goal no route reaches (a pickup on a crate, a flag
 * on a prop): the navmesh keeps 0.8 m clear of things a body walks up to (its radius 0.4 + 0.4), and pickups and
 * flags are picked up from about a metre away.
 */
const STEP_OFF = 2.2;
/** A path corner counts as reached this close (m), or once passed and within PASS_RADIUS. */
const CORNER_RADIUS = 0.45;
/** How strongly teammates close by push a bot going somewhere out of a fight aside, at most (the way itself is 1). */
const SEPARATE_MAX = 0.8;
/** A teammate coming the other way this close ahead (m) is passed on the right (separate). */
const ONCOMING = 4;
const PASS_RADIUS = 1.4;

/** Tactical decisions (cover, grenades, mounts) run at about 10 Hz, staggered. */
const DECIDE_TICKS = 6;
/** Visibility of crouched and prone targets at range (they are harder to spot). */
const STANCE_SIGHT = [1, 0.8, 0.55] as const;
/**
 * Perception's sight lines: up to SIGHT_SEARCH (nearest first) while looking
 * for a target, SIGHT_TRACK in all once one is found (the rest keep tracking
 * other enemies' reaction times). A clump of 40 enemies in view costs a
 * handful of rays instead of 40.
 */
const SIGHT_SEARCH = 16;
const SIGHT_TRACK = 6;
/**
 * Clear shot (BotBrain.clearShot): a round that would strike the world this
 * close to the aim point (m) is a miss at the target (the ground at their
 * feet, the cover they're crouched against), not a shot into something in
 * between; suppression fire may land this close to the spot.
 */
const CLEAR_MARGIN = 1.5;
const SUPPRESS_MARGIN = 3;
/** The check's ray runs this far (rad) under the aim, for the rounds' spread (a rifle's settled cone is about this). */
const CLEAR_UNDER = 0.012;
/** A clear verdict holds this many ticks while the aim and the bot barely move (sustained fire: a ray every few ticks). */
const CLEAR_TTL = 3;
/** After a blocked verdict the bot holds fire this many ticks before asking again (no ray meanwhile). */
const BLOCKED_HOLD = 3;
/** Suppression: fire at the spot an enemy went out of sight for this long (s), only while the rounds reach it. */
const SUPPRESS_SECONDS = 1.5;
/** A tracked enemy perception had no ray to spare for stays tracked this long after it was last confirmed. */
const TRACK_UNCHECKED_TICKS = TICK_RATE / 2;

interface Candidate {
  o: CombatantView;
  dx: number;
  dz: number;
  score: number;
  checked: boolean;
}
const byScore = (a: Candidate, b: Candidate): number => a.score - b.score || a.o.slot - b.o.slot;

/** The actor IDs in a list of views, worked out once per list (a side's enemies are one list a tick, shared by its bots). */
const slotSets = new WeakMap<readonly CombatantView[], Set<number>>();
function slotsOf(list: readonly CombatantView[]): Set<number> {
  let set = slotSets.get(list);
  if (!set) slotSets.set(list, (set = new Set(list.map((o) => o.slot))));
  return set;
}

interface CornerCheck {
  start: number;
  until: number;
  points: Vec3[];
  /** The corner or doorway being checked. */
  corner: Vec3;
}

interface ThrowPlan {
  yaw: number;
  pitch: number;
  until: number;
  /**
   * Where it comes down, for a grenade whose blast reaches back to the thrower (the holy bomb's 9 m from a 9 m
   * throw): once it's thrown, get clear of it before its fuse (`fuse` s) runs out.
   */
  clear?: Vec3;
  fuse?: number;
}

/**
 * Player Bot brain. Produces a PlayerInput every tick, exactly like a human
 * client, so bots obey the same movement/weapon rules. Layers: perception
 * (staggered, sight and hearing), tactical decisions (~10 Hz: cover, peeking,
 * retreating, grenades, turrets and vehicles), navigation (routes through
 * the map, checking corners and clearing rooms on the way), and human-like
 * aim (aim.ts) with reaction time and trigger discipline.
 */
export class BotBrain {
  state: BotState = 'roam';
  /** Current path corners, exposed for the debug overlay. */
  path: Vec3[] = [];
  /** Destination of the current path. */
  goal: Vec3 | null = null;
  stuckCount = 0;
  /** What it did on its last think (measuring: BotDoing), and whether it meant to move then. */
  doing: BotDoing = 'roam';
  meantToMove = false;
  /** Route searches that found no way there (measuring). */
  pathFailures = 0;
  /** Route searches for where it was going (followPathNow; measuring), found or not. */
  pathSearches = 0;
  /** The last search that found no way (measuring: the scorecard's failed-search spots): from where, to where. */
  lastNoRoute: { goal: Vec3; from: Vec3 } | null = null;
  /** Route requests for a goal no route reaches, answered with a stand-in as near it as a route gets (measuring). */
  standIns = 0;
  /**
   * The goal it last asked for can't be reached from where it is (NavWorld.standIn): where it heads instead, as
   * near the goal as a route gets. Null when the route is to the goal itself.
   */
  private standIn: Vec3 | null = null;
  /** The last followPathTo found no route (or was backing off asking again) rather than arriving. */
  private pathMiss = false;
  /** The pickup it last set out for (the same object as roamGoal while it still goes for it). */
  private pickupAt: Vec3 | null = null;
  /** Keeping watch on station (keepWatch): the place it stands, until when, and the way it faces. */
  private watch: { spot: Vec3; until: number; yaw: number } | null = null;
  /** In a seat at the last think (the transport plane, a flyer), and out of one in the air with no canopy yet. */
  private seated = false;
  private bailedOut = false;
  /** Where its order goal was at the last think (does it move?). */
  private readonly lastOrder: Vec3 = { x: 1e9, y: 0, z: 1e9 };
  /** Getting off a cut-off patch of navmesh (planEscape): the place across, the goal it is for, until when it tries. */
  private escape: { across: Vec3; goal: Vec3; until: number } | null = null;
  /** Places across it tried and couldn't get to, left alone for a while. */
  private readonly failedCrossings: { at: Vec3; until: number }[] = [];
  /**
   * On a parkour link of its route (nav/parkour.ts: a drop, a gap jump, a jump up): the link, the route and corner it
   * was found at, when it started on it, and when it jumped (-1: not yet) or went over the edge (a drop).
   */
  private link: { l: ParkourLink; path: Vec3[]; index: number; since: number; jumped: number; left: number } | null = null;
  /** Parkour moves it made, by kind, and gave up on (measuring: bot-report). */
  readonly parkourDone: Record<ParkourKind, number> = { drop: 0, gap: 0, up: 0 };
  parkourGaveUp = 0;
  /** The link it was last on and since when (kept between routes: watchLink). */
  private linkClock: { l: ParkourLink; since: number; at: number } | null = null;
  /** The navmesh's goneVersion its route was planned against. */
  private goneSeen = 0;
  parkourMissed = 0;
  /** On a parkour link (the match has it think every tick until it lands: the jump is timed to the tick). */
  get parkouring(): boolean {
    return this.link !== null;
  }
  /** Last hop on a crossing. */
  private hopAt = -Infinity;
  /** The hop across (planEscape) is up a ledge higher than a jump clears: the legs tuck up in the air till it lands. */
  private tuckHop = false;
  /** The way it takes to a far objective (orderTarget): the goal it was picked for and the waypoint (null: straight). */
  private lane: { goal: Vec3; via: Vec3 | null } | null = null;
  /**
   * Route variety: the corridor it goes by to a far goal (its group's, its squad's, or the cheapest of its side's trip:
   * teamBrain.ts), the goal it is for, whether it has been by the corridor's via yet, and when it last went by it.
   */
  private route: { c: Corridor; goal: Vec3; next: number; used: number } | null = null;
  /** A corridor picked with its roaming goal (toward the enemy's side), for that goal only. */
  private roamRoute: { c: Corridor; goal: Vec3 } | null = null;
  /** A few steps aside after getting stuck on the same spot again and again (planSidestep). */
  private sidestep: { pos: Vec3; until: number } | null = null;
  /** Waiting for a lift since (-1: not waiting), and until when routes keep off lifts after waiting too long. */
  private liftWaitSince = -1;
  private offLiftsUntil = -Infinity;

  private seq = 0;
  private readonly rng: () => number;
  private readonly aim: AimModel;
  private readonly memory = new MapMemory();
  private targetSlot: number | null = null;
  private visibleSince = new Map<number, number>();
  /** Last tick each enemy in visibleSince was confirmed in sight. */
  private readonly confirmed = new Map<number, number>();
  /** Last tick each enemy was a candidate that perception did not cast a ray to. */
  private readonly unchecked = new Map<number, number>();
  /** Scratch for perception (no allocations per look). */
  private readonly pool: Candidate[] = [];
  private readonly live: Candidate[] = [];
  private readonly eyeAt = { x: 0, y: 0, z: 0 };
  private readonly eyeTo = { x: 0, y: 0, z: 0 };
  /** Scratch for grid queries (perception, keeping apart). */
  private readonly nearScratch: CombatantView[] = [];
  /** Last tick perception ran (a steering tick may have run it before a full think). */
  private lastPerceiveTick = -1;
  private lastKnown: { pos: Vec3; tick: number } | null = null;
  /** A noise worth checking out. */
  private heard: { pos: Vec3; tick: number } | null = null;
  /** A gun close enough to fetch before going on (set while deciding). */
  private gunNearby: Vec3 | null = null;
  /** A noise or sighting we couldn't get to: noises near it are ignored for a while. */
  private unreachable: { pos: Vec3; until: number } | null = null;
  /** Closest we have come to the current chase/investigate goal, and when. */
  private headway: { goal: Vec3; best: number; tick: number } | null = null;
  private pathIndex = 0;
  /** Came out of a portal since the path was last followed: the portal leg is done. */
  private portalled = false;
  private roamGoal: Vec3 | null = null;
  private via: Vec3 | null = null;
  private lastPathTick = -Infinity;
  /** The last goal no path led to, from where, and until when not to ask again (doubling with each failure in a row). */
  private noPath: { goal: Vec3; from: Vec3; until: number } | null = null;
  private pathFails = 0;
  private strafeDir = 1;
  private nextStrafeFlip = 0;
  /** When the current strafe run started, and the last tick spent strafing. */
  private strafeStart = -Infinity;
  private lastStrafeTick = -Infinity;
  /** Strafing (with hysteresis on the distance band). */
  private strafing = false;
  /** Fighting in the open: closing in, holding, or backing off (with hysteresis on the range). */
  private spacing: 'close' | 'hold' | 'back' = 'hold';
  /** Where a retreat is headed, kept for a while so the bot runs one way. */
  private retreatGoal: { pos: Vec3; until: number } | null = null;
  /** Retreating: sprint away (run) or back off shooting, committed for a moment. */
  private retreatMode: { run: boolean; until: number } | null = null;
  /** Smoothed movement intent in world space (inputs ease in and out rather than snapping). */
  private moveX = 0;
  private moveZ = 0;
  private nextHop = 0;
  private yaw = 0;
  private pitch = 0;
  private stuckCheck: { tick: number; pos: Vec3 } | null = null;
  private jumpNext = false;
  private lastPos: Vec3 | null = null;
  /** The tick of the previous think (big matches skip some ticks for bots with nobody to fight). */
  private lastThinkTick = 0;
  private speed = 0;
  private lastHealth = 100;
  private hurtTick = -Infinity;
  private underFireTick = -Infinity;
  private threatFrom: Vec3 | null = null;
  // Cover and peeking.
  private cover: CoverSpot | null = null;
  private nextCoverSearch = 0;
  private peekPhase: 'hide' | 'peek' = 'hide';
  private phaseUntil = 0;
  private peeks = 0;
  // Corners and rooms.
  private pie: CornerCheck | null = null;
  /** After a corner check: sweep the room once through (points empty until past the corner). */
  private clearing: { corner: Vec3; yaw: number; points: Vec3[]; start: number; until: number } | null = null;
  private readonly checked = new Map<string, number>();
  private scanUntil = 0;
  private scanYaw = 0;
  // Grenades.
  private throwPlan: ThrowPlan | null = null;
  private nextThrow = 0;
  // Turrets and vehicles.
  /** The mount it is going for; `spot`: where it walks to board (just off the hull), worked out where the mount stood at `spotOf`. */
  private mountPlan: { index: number; until: number; drive: boolean; ride?: boolean; spot?: Vec3; spotOf?: Vec3 } | null = null;
  /** Riding with a teammate: when the driver left (or the vehicle stopped), and how long before getting out. */
  private rideIdleSince = -Infinity;
  private noDriverSince = -Infinity;
  private bailDelay = 0;
  private drive: DriveState = freshDrive();
  private mountedSince = 0;
  private lastTargetTick = -Infinity;
  private useLatch = false;
  private lastUseTick = -Infinity;
  /** Vehicles (by mount index) this bot got stuck in, and until when it leaves them alone. */
  private readonly avoidMounts = new Map<number, number>();
  /** How many times it has given up on each mount (by index): each time it leaves it alone twice as long (avoidSeconds). */
  private readonly giveUps = new Map<number, number>();
  /** Use pressed beside the mount it was going for (and when): still not in it BOARD_CHECK_TICKS later, that boarding failed. */
  private boardTry: { index: number; tick: number } | null = null;
  /** Failed boardings per mount since it last got in one: at MAX_BOARD_FAILS it gives up on that one. */
  private readonly boardFails = new Map<number, number>();
  /** Boardings so far (bot-report): use pressed for a planned mount, those that failed, mounts given up on, and plans for one it had given up on before (`back`). */
  readonly boarding = { tries: 0, failed: 0, gaveUp: 0, back: 0 };
  private readonly skipMount = (m: MountView): boolean => (this.avoidMounts.get(m.index) ?? -Infinity) > this.lastThinkTick;
  /** Riding with a bot at the wheel: is it getting anywhere? */
  private riderHeadway: Headway = { pos: null, tick: 0 };
  /** Driving: how far the route still was when the current progress window opened, and when. */
  private driveLeft = { left: Infinity, tick: 0 };
  /** The target's mount, when it is in one (refreshed each think). */
  private targetMount: MountView | null = null;
  /** Last tick an enemy in a vehicle was in sight (launchers are worth fetching for a while after). */
  private vehicleSeenTick = -Infinity;
  /** Getting out of an enemy vehicle's way: which way, until when, and whether to sprint. */
  private dodge: { yaw: number; until: number; sprint: boolean } | null = null;
  /** The vehicle bearing down (mount index), when it was first noticed, and whether this bot reacts to it at all this time. */
  private roadkill: { index: number; since: number; notice: boolean } | null = null;
  /** Going to press a button that opens a door in the way. */
  private pressPlan: { stand: Vec3; face: Vec3; until: number; door: Aabb } | null = null;
  private pressedAt = -Infinity;
  /** The door the last press was for, and doors whose buttons didn't open them for us (left alone a while). */
  private pressedDoor: Aabb | null = null;
  private readonly noPress: { door: Aabb; until: number }[] = [];
  /** Waiting for or riding a lift: stand still this tick. */
  private holdStill = false;
  /** Standing where a zipline on the route is grabbed: press E this tick. */
  private zipPress = false;
  /** Last tick's act was aiming and shooting at the target (nothing else on): steer() can stand in for a think. */
  private steerable = false;
  /** Route variety and roles (seeded per bot): a stream of its own, so the bot's other choices stay as they were. */
  private readonly routeRng: () => number;
  /**
   * Holding a vantage spot (camper and sniper roles, director.ts): which spot,
   * when it got there (-1: on the way), how long it holds once there, until when.
   */
  private post: { board: VantageBoard; spot: number; kind: VantageKind; arrived: number; hold: number; until: number; shots: number; moving: boolean } | null = null;
  /**
   * How much its routes keep out of open ground (NavWorld.findPath `open`; Phase B item 6): Tactical bots the most,
   * Arena bots not at all, the rest a little.
   */
  private get coverRoutes(): number {
    return this.arena ? 0 : this.methodical ? 2 : 1;
  }

  /** Bounding (boundPhase): this half moving from cover to cover, or covering; null when not bounding. */
  private bound: 'move' | 'cover' | null = null;
  /** Where its last vantage spot was (a sniper moves on somewhere else, not back the way it came). */
  private prevSpot: Vec3 | null = null;
  /** Snipers: shots held for a better one, and spots left after a shot or two or for being spotted (measuring). */
  heldShots = 0;
  relocations = 0;
  private nextPost = 0;
  private lastSpot = -1;
  /** Recent stuck recoveries (when and where), to notice being stuck in a loop. */
  private readonly stuckLog: { tick: number; x: number; z: number }[] = [];
  /** Times it gave up on a goal it kept getting stuck on (debug and bench). */
  stuckLoops = 0;
  /** A goal it kept getting stuck on: left alone until then. */
  private avoid: { pos: Vec3; until: number } | null = null;
  /**
   * Pickups this bot got stuck going for (stuck three times by the same spot): left alone for
   * PICKUP_GIVE_UP_SECONDS, across respawns (a bot spawns by the same unreachable item again). Without it the
   * pickup check every 2 s sent it straight back, and whole squads stood at their spawn walking into a wall.
   */
  private readonly lostPickups: { pos: Vec3; until: number }[] = [];
  /** The squad goal last taken on (a new one replaces the bot's own goal). */
  private squadGoal: Vec3 | null = null;
  /** Catching up with its squad's leader. */
  private regrouping = false;

  /** The personality it plays now (playAs: Roulette's body each life), and the one it was made with. */
  profile: BotProfile;
  readonly baseProfile: BotProfile;

  constructor(
    readonly slot: number,
    profile: BotProfile,
    readonly difficulty: BotDifficulty,
    seed: number,
  ) {
    this.profile = profile;
    this.baseProfile = profile;
    this.rng = createRng(seed * 7919 + slot);
    this.routeRng = createRng((seed * 104729 + slot * 7919 + 17) >>> 0);
    this.aim = new AimModel(this.rng, difficulty, profile);
    this.clearCheck = () => this.clearShot();
    this.choice = { me: { x: 0, y: 0, z: 0 }, goal: null, profile, hurt: false, lowAmmo: false, cover: false, retreating: false, pickup: -Infinity, post: -Infinity, lost: null, noise: null, posted: false };
  }

  /**
   * Play another personality from now (Roulette: the body dealt this life; docs/BOT_AI_PLAN.md Phase B, "bots play to
   * their body"): its choices, ranges and tags. Its aim stays its own.
   */
  playAs(profile: BotProfile): void {
    this.profile = profile;
    this.choice.profile = profile;
  }

  /** Enemy currently targeted (actor ID), if any. */
  get target(): number | null {
    return this.targetSlot;
  }

  /** Where an enemy was last seen, and when. */
  get lastSeen(): { pos: Vec3; tick: number } | null {
    return this.lastKnown;
  }

  /** The cover spot the bot is using, if any (debug and tests). */
  get coverSpot(): CoverSpot | null {
    return this.cover;
  }

  /** A squadmate saw an enemy here: go and look, unless already fighting. */
  alert(pos: Vec3, tick: number): void {
    if (this.targetSlot !== null) return;
    if (this.lastKnown && this.lastKnown.tick >= tick) return;
    this.lastKnown = { pos: { ...pos }, tick };
  }

  /** Reset per-life memory when the bot respawns. */
  onSpawn(yaw: number): void {
    this.yaw = yaw;
    this.pitch = 0;
    this.targetSlot = null;
    this.portalled = false;
    this.visibleSince.clear();
    this.confirmed.clear();
    this.unchecked.clear();
    this.lastKnown = null;
    this.heard = null;
    this.unreachable = null;
    this.noPath = null;
    this.pathFails = 0;
    this.headway = null;
    this.path = [];
    this.goal = null;
    this.roamGoal = null;
    this.via = null;
    this.stuckCheck = null;
    this.cover = null;
    this.pie = null;
    this.clearing = null;
    this.checked.clear();
    this.throwPlan = null;
    this.mountPlan = null;
    this.memory.clear();
    this.aim.reset();
    this.lastPos = null;
    this.lastHealth = 100;
    this.hurtTick = this.underFireTick = -Infinity;
    this.retreatGoal = null;
    this.retreatMode = null;
    this.link = null;
    this.linkClock = null;
    this.spacing = 'hold';
    this.strafing = false;
    this.moveX = this.moveZ = 0;
    this.steerable = false;
    if (this.post) this.post.board.release(this.post.spot, this.slot);
    this.post = null;
    this.stuckLog.length = 0;
    this.avoid = null;
    this.squadGoal = null;
    this.regrouping = false;
    this.watch = null;
    this.escape = null;
    this.lane = null;
    this.sidestep = null;
    this.route = null;
    this.roamRoute = null;
    this.pickCand = null;
  }

  /** It killed someone: a sniper moves on to another spot soon after (they know where the shot came from). */
  onKill(tick: number): void {
    const p = this.post;
    if (p?.kind === 'sniper' && p.arrived >= 0) p.until = Math.min(p.until, tick + Math.round(TICK_RATE * (0.6 + this.routeRng() * 0.8)));
  }

  /** Holding (or heading for) a vantage spot: its kind and position (debug and tests). */
  get vantage(): { kind: VantageKind; pos: Vec3; arrived: boolean; parkour: boolean } | null {
    const p = this.post;
    return p ? { kind: p.kind, pos: p.board.spots[p.spot]!.pos, arrived: p.arrived >= 0, parkour: !!p.board.spots[p.spot]!.parkour } : null;
  }

  // ------------------------------------------------------------------ main loop

  think(view: BotWorldView): PlayerInput {
    const seq = ++this.seq;
    const me = view.self;
    this.steerable = false;
    if (!me.alive) {
      this.state = 'dead';
      this.doing = 'dead';
      this.meantToMove = false;
      return { seq, forward: 0, right: 0, yaw: this.yaw, pitch: this.pitch, buttons: 0 };
    }
    // Own movement and pain.
    const ticks = Math.max(1, Math.min(4, view.tick - this.lastThinkTick));
    this.lastThinkTick = view.tick;
    this.speed = this.lastPos ? Math.min(20, horizontalDistance(me.pos, this.lastPos) / (TICK_DT * ticks)) : 0;
    this.lastPos = { ...me.pos };
    if (me.health < this.lastHealth) this.hurtTick = view.tick;
    this.lastHealth = me.health;
    if (view.shotAt && view.tick - view.shotAt.tick <= 1) {
      this.underFireTick = view.shotAt.tick;
      this.threatFrom = { x: view.shotAt.from.x, y: view.shotAt.from.y - PLAYER.eyeHeight, z: view.shotAt.from.z };
    }

    const interval = this.difficulty.perceptionIntervalTicks;
    if ((view.tick + this.slot) % interval === 0 && this.lastPerceiveTick !== view.tick) this.perceive(view);

    const target = this.targetSlot === null ? undefined : view.others.find((o) => o.slot === this.targetSlot && o.alive);
    if (this.targetSlot !== null && !target) this.targetSlot = null;
    if (target) this.lastTargetTick = view.tick;
    // An enemy in a vehicle (or on a gun): a hard target (only looked up when they are sitting in something).
    this.targetMount = target?.mounted && view.mounts ? (mountOf(view.mounts, target.slot)?.mount ?? null) : null;
    if (this.targetMount?.kind === 'vehicle') this.vehicleSeenTick = view.tick;

    const ctx = this.aimContext(view);
    const ta = simProfile.on ? performance.now() : 0;
    this.aim.track(ctx, target ? { slot: target.slot, pos: target.pos, stance: target.stance } : null);
    if (simProfile.on) simProfile.add('botAim', performance.now() - ta);

    // Out of a plane (or a flyer) in the air: the canopy opens straight away (act()), not at the automatic opener's
    // height over whatever is below.
    if (view.seat) this.seated = true;
    else if (this.seated) {
      this.seated = false;
      this.bailedOut = me.grounded === false;
    }
    if (me.grounded !== false || me.chute || me.climbing) this.bailedOut = false;
    if (view.seat) {
      this.doing = 'mounted';
      this.meantToMove = false;
      return this.thinkMounted(view, seq, target, ctx);
    }
    this.useLatch = false;
    // Pressed use beside it and still not in: a failed boarding (no seat after all, out of reach, the mode won't let
    // it). Twice at one mount and it gives up on that one for a while and looks for something else, rather than
    // walking back to it again and again (the owner saw a bot at a stuck Dropship on Shingle Point, 2026-11-07).
    const tried = this.boardTry;
    if (tried && view.tick - tried.tick >= BOARD_CHECK_TICKS) {
      this.boardTry = null;
      this.boarding.failed++;
      const n = (this.boardFails.get(tried.index) ?? 0) + 1;
      this.boardFails.set(tried.index, n);
      if (n >= MAX_BOARD_FAILS) {
        this.giveUpOn(tried.index, view.tick);
        if (this.mountPlan?.index === tried.index) this.mountPlan = null;
      }
    }
    if (this.mountPlan && view.tick >= this.mountPlan.until) {
      // Didn't get in in time (no way to it, stuck on the way, someone else took it): leave that one alone a while,
      // as one it got stuck driving (the next check sent it straight back: Coldwater Gulch's bots spent 5 % of the
      // match walking into a vehicle they couldn't reach).
      if (!this.mountPlan.ride) this.giveUpOn(this.mountPlan.index, view.tick);
      this.mountPlan = null;
    }

    if ((view.tick + this.slot) % DECIDE_TICKS === 0) this.decide(view, target);
    // Whatever the last decision was, it needs what it was about.
    if ((this.state === 'chase' && !this.lastKnown) || (this.state === 'investigate' && !this.heard) || (this.state === 'hold' && !view.orderGoal) || this.state === 'dead' || this.state === 'mounted') this.state = 'advance';
    if (this.state === 'mount' && !this.mountPlan) this.state = 'advance';

    return this.act(view, seq, target, ctx);
  }

  private aimContext(view: SteerView): AimContext {
    const me = view.self;
    const stance = me.stance ?? 0;
    const def = this.heldDef(view);
    return {
      tick: view.tick,
      // Where its rounds start: the sim fires from the eye, which scales with body size.
      eye: { x: me.pos.x, y: me.pos.y + STANCES[stance].eye * (me.size ?? 1), z: me.pos.z },
      speed: this.speed,
      airborne: false,
      stance,
      steady: !!(def?.view.zoomFov && !def.alt),
      weapon: def,
    };
  }

  private heldDef(view: SteerView): WeaponDefinition | undefined {
    return this.heldWeapon(view)?.def;
  }

  /** Low on health by this bot's standards. */
  private hurt(view: BotWorldView): boolean {
    return view.self.health < (this.profile.selfPreservation / 100) * PLAYER.maxHealth * (this.coward ? 0.8 : 0.6);
  }

  /** COWARD: gives up a fight sooner, and won't take on several at once. */
  private get coward(): boolean {
    return hasTag(this.profile, 'COWARD');
  }

  /** A coward who has been hurt and can see three or more enemies backs off (shooting). */
  private outnumbered(): boolean {
    return this.coward && this.visibleSince.size >= 3 && this.lastHealth < PLAYER.maxHealth * 0.85;
  }

  /** On its vantage spot and holding it. */
  private posted(me: Vec3): boolean {
    const p = this.post;
    return !!p && p.arrived >= 0 && horizontalDistance(me, p.board.spots[p.spot]!.pos) < 1.6;
  }

  /** Done with the vantage spot (time up, flushed out, no way there): roam for a while before the next. */
  private leavePost(tick: number, cooldownSeconds: number): void {
    const p = this.post;
    if (!p) return;
    p.board.release(p.spot, this.slot);
    this.prevSpot = { ...p.board.spots[p.spot]!.pos };
    this.post = null;
    this.nextPost = tick + Math.round(TICK_RATE * cooldownSeconds);
    this.roamGoal = null;
    this.via = null;
  }

  /** How long a camper or sniper rests between spots (s): campers roam a good while (fun over camping), snipers relocate. */
  private postCooldown(kind: VantageKind): number {
    if (kind === 'sniper') return 4 + this.routeRng() * 6;
    return (this.arena ? 60 : this.methodical ? 35 : 45) + this.routeRng() * 30;
  }

  /**
   * Cover-to-cover advance (BOT_AI_PLAN.md Phase B item 6): a bot on its way to an objective (a goal to keep to, not a
   * carrier's run) in a fight at range bounds by its style: Tactical always, Mixed when the fight is BOUND_MIXED m or
   * further, Arena never (it keeps the rush; so do berserkers). Half the bots cover while half move, on a shared clock
   * by slot (odd and even), so teammates near each other take turns without anyone arranging it: 'cover' holds cover
   * facing the threat (peeking and shooting, not running at it), 'move' leaves it for cover further on, or advances in
   * the open shooting when there's none. Null: not bounding.
   */
  private boundPhase(view: BotWorldView, target: CombatantView | undefined, goal: OrderGoal | null | undefined): 'move' | 'cover' | null {
    if (!target || !goal?.push || goal.run || this.arena || this.berserker || view.self.mounted) return null;
    const dist = horizontalDistance(view.self.pos, target.pos);
    // (A playbook that has everyone bound, Breakthrough's: every style but Arena's from BOUND_FROM.)
    const all = !!view.plan?.job?.bound;
    if (dist < BOUND_FROM || (!this.methodical && !all && dist < BOUND_MIXED)) return null;
    const period = TICK_RATE * (this.methodical ? 3.5 : 4.5);
    return (Math.floor(view.tick / period) + this.slot) % 2 === 0 ? 'move' : 'cover';
  }

  /** On its sniper spot with its scoped gun in hand. */
  private sniping(view: BotWorldView, def: WeaponDefinition | undefined): boolean {
    const p = this.post;
    return !!p && p.kind === 'sniper' && !!def?.view.zoomFov && !def.alt && this.posted(view.self.pos);
  }

  /** A shot from its sniper spot: after its share of them (one, or two for the bold), it moves on. */
  private sniperShot(tick: number): void {
    const p = this.post;
    if (!p || ++p.shots < shotsPerSpot(this.profile)) return;
    this.relocate(tick, 0.4 + this.routeRng() * 0.6);
  }

  /** Leave the sniper spot in `seconds` for another one somewhere else soon after (counted once a spot). */
  private relocate(tick: number, seconds: number): void {
    const p = this.post;
    if (!p || p.moving) return;
    p.moving = true;
    p.until = Math.min(p.until, tick + Math.round(TICK_RATE * seconds));
    this.relocations++;
  }

  /** A scoped gun with rounds in it. */
  private hasScope(view: BotWorldView): boolean {
    for (const w of view.inventory) if (w.def.view.zoomFov && !w.def.alt && (w.def.magazine === 0 || w.mag + w.reserve > 0)) return true;
    return false;
  }

  /**
   * Camper and sniper roles, out of a fight with nowhere it was sent: take up
   * a free vantage spot (a camp spot with cover; a sniper spot with a long
   * view, only with a scoped gun) for a limited time. Team modes prefer spots
   * between the bases (not deep in its own, not in the enemy's).
   */
  private considerPost(view: BotWorldView): void {
    const plan = view.plan;
    const board = plan?.vantage;
    const tick = view.tick;
    const g = view.orderGoal ?? null;
    if (!board || this.post || tick < this.nextPost) return;
    if (plan.role !== 'camper' && plan.role !== 'sniper') return;
    const kind: VantageKind = plan.role === 'camper' ? 'camp' : 'sniper';
    // (A goal: only a sniper's, and only one to hold, a CTF defender's flag or a hill: its spot looks over it.)
    if (g && (kind !== 'sniper' || !holdsPost(g))) return;
    if (kind === 'sniper' && !this.hasScope(view)) {
      this.nextPost = tick + TICK_RATE * 5;
      return;
    }
    const towards = plan.towards;
    const away = kind === 'sniper' ? relocatePrefer(view.self.pos, this.prevSpot) : null;
    const eye = (p: Vec3) => ({ x: p.x, y: p.y + 1.5, z: p.z });
    const prefer = (p: Vec3) => {
      let v = away ? away(p) : 0;
      if (g) {
        // Near the goal it holds and in sight of it.
        const d = horizontalDistance(p, g.pos);
        v += d > 75 ? -3 : view.physics.lineOfSight(eye(p), eye(g.pos)) ? 1 : -0.5;
      } else if (towards?.length) {
        let near = Infinity;
        for (const t of towards) near = Math.min(near, horizontalDistance(t, p));
        v += near < 35 ? -2 : near < 130 ? 0.4 : 0;
      }
      return v;
    };
    const i = board.pick(kind, view.self.pos, tick, kind === 'sniper' ? 110 : 75, this.routeRng, prefer, this.lastSpot);
    if (i < 0) {
      this.nextPost = tick + TICK_RATE * 8;
      return;
    }
    const hold = kind === 'sniper' ? 25 + this.routeRng() * 25 : this.arena ? 10 + this.routeRng() * 8 : this.methodical ? 25 + this.routeRng() * 20 : 18 + this.routeRng() * 17;
    // Getting there gets a generous allowance; the hold starts on arrival.
    this.post = { board, spot: i, kind, arrived: -1, hold: Math.round(TICK_RATE * hold), until: tick + TICK_RATE * 40, shots: 0, moving: false };
    board.claim(i, this.slot, this.post.until);
    this.lastSpot = i;
  }

  /**
   * Going to or holding a vantage spot: get there, then stay on it (crouched,
   * or prone for a sniper with a scope) watching its sightline with a slow
   * sweep. Null when the post is over (time up, no way there).
   */
  private actPost(view: BotWorldView): { moveYaw: number | null; stance: Stance; moveScale: number } | null {
    const p = this.post!;
    const spot = p.board.spots[p.spot]!;
    const me = view.self.pos;
    const tick = view.tick;
    if (tick >= p.until) {
      this.leavePost(tick, this.postCooldown(p.kind));
      return null;
    }
    const d = horizontalDistance(me, spot.pos);
    if (p.arrived < 0) {
      if (d < 1.2 && Math.abs(me.y - spot.pos.y) < 1.5) {
        p.arrived = tick;
        p.until = tick + p.hold;
        p.board.claim(p.spot, this.slot, p.until);
      } else {
        const moveYaw = this.followPathTo(view, spot.pos, false);
        if (moveYaw === null) {
          // No way there (a roof, a shut door): leave that spot alone for a couple of minutes.
          p.board.unreachable(p.spot, this.slot, tick, TICK_RATE * 120);
          this.post = null;
          this.nextPost = tick + TICK_RATE * 3;
          return null;
        }
        return { moveYaw, stance: 0, moveScale: 1 };
      }
    }
    const sweep = Math.sin((tick + this.slot * 53) / (p.kind === 'sniper' ? 90 : 55)) * (p.kind === 'sniper' ? 0.35 : 0.7);
    this.turnToward(spot.yaw + sweep, spot.height > 2 ? -0.08 : 0);
    const scoped = !!this.heldDef(view)?.view.zoomFov;
    const settled = view.tick - this.underFireTick > TICK_RATE * 2;
    const prone = p.kind === 'sniper' && scoped && settled;
    // Holding it looks alive (owner: "nobody stands like a statue"): a camper shifts a step to one side and back
    // every few seconds where nothing is in the way, and stands up now and then to look over its cover (a sniper
    // lying on its scope stays down and only sweeps).
    const t = tick + this.slot * 37;
    const cycle = TICK_RATE * 6;
    let at = spot.pos;
    let stance: Stance = prone ? 2 : 1;
    if (!prone && p.kind === 'camp') {
      if (t % cycle < TICK_RATE * 1.6) {
        const side = Math.floor(t / cycle) % 2 ? 0.8 : -0.8;
        const step = { x: spot.pos.x + Math.cos(spot.yaw) * side, y: spot.pos.y, z: spot.pos.z - Math.sin(spot.yaw) * side };
        if (view.physics.lineOfSight({ x: spot.pos.x, y: spot.pos.y + 0.5, z: spot.pos.z }, { x: step.x, y: step.y + 0.5, z: step.z })) at = step;
      }
      if (t % (TICK_RATE * 5) < TICK_RATE) stance = 0;
    }
    const da = horizontalDistance(me, at);
    return { moveYaw: da > (at === spot.pos ? 0.6 : 0.3) ? Math.atan2(at.x - me.x, at.z - me.z) : null, stance, moveScale: 0.5 };
  }

  /** How far (m) a bot on its way to `goal` goes out of its way: the goal's say, else by how much it cares for objectives (8–20 m). */
  private detourFor(goal: OrderGoal): number {
    return goal.detour ?? 20 - (this.profile.objectivePriority / 100) * 12;
  }


  /** The corridor it walks (route variety: measuring, and the team brain's crowd price); null when it goes its own way. */
  get corridor(): Corridor | null {
    const r = this.route;
    return r && this.lastThinkTick - r.used < TICK_RATE * 3 ? r.c : null;
  }

  /**
   * Where to head for `goal` by corridor `c` (route variety): its vias in order (Corridor.vias: where it is furthest from
   * the trip's other corridors), each until the bot has been by it or is nearer the goal than it is, then the goal; the
   * bot's own routes do the rest, so it goes that corridor's way without following it point by point. (Following its
   * points every 12 m went wrong on maps with floors: a bot on a deck above a corridor counted as on it, headed for a
   * point on the ground ahead and stood under a gallery's rail; captures halved on the dev sample.)
   */
  private viaRoute(view: BotWorldView, c: Corridor, goal: Vec3): Vec3 {
    const me = view.self.pos;
    let r = this.route;
    if (!r || r.c !== c || horizontalDistance(r.goal, goal) > 8) r = this.route = { c, goal: { ...goal }, next: 0, used: view.tick };
    r.used = view.tick;
    const left = horizontalDistance(me, goal);
    while (r.next < c.vias.length) {
      const via = c.vias[r.next]!;
      // Near it, or already nearer the goal than it is: on to the next.
      if ((horizontalDistance(me, via) < 6 && Math.abs(me.y - via.y) < 3) || left < horizontalDistance(via, goal)) r.next++;
      else return via;
    }
    return goal;
  }

  /**
   * Keeping to its group's corridor all the way (orderTarget, then the route search: NavWorld.pathAlong): which, when it
   * was last asked for, and when a route along it last failed (then by its via for a while).
   */
  private along: { c: Corridor; tick: number; failed: number } | null = null;
  /** Routes that kept to a corridor all the way (measuring). */
  alongRoutes = 0;

  private alongFailed(c: Corridor, tick: number): boolean {
    const a = this.along;
    return !!a && a.c === c && tick - a.failed < TICK_RATE * 10;
  }

  /** `to`, where it was heading for `goal`, was one of its corridor's vias and no route gets there from here: on past it. */
  private skipVia(to: Vec3, goal: Vec3): boolean {
    const r = this.route;
    const via = r?.c.vias[r.next];
    if (!r || !via || horizontalDistance(r.goal, goal) > 8 || horizontalDistance(via, to) > 0.5) return false;
    r.next++;
    return true;
  }

  /** The team brain's job for this goal, if the job is for it (its route and staging only apply to their objective). */
  private jobFor(view: BotWorldView, g: OrderGoal) {
    const job = view.plan?.job;
    return job?.to && !g.run && horizontalDistance(job.to, g.pos) < 10 && Math.abs(job.to.y - g.pos.y) < 4 ? job : null;
  }

  /**
   * Where to head for an objective goal: far off, by a way of its own first (left, right or straight, picked once
   * per goal and life from its route stream), so a team's attackers spread over the map's routes instead of all
   * meeting the enemy's head-on in one corridor; then the goal itself. With a job from the team brain: its group's
   * corridor instead, and its staging spot first while the group gathers for a push.
   */
  private orderTarget(view: BotWorldView, g: OrderGoal): Vec3 {
    const me = view.self.pos;
    const job = this.jobFor(view, g);
    if (job) {
      if (job.stage) return job.stage;
      if (!job.route || horizontalDistance(me, g.pos) <= ROUTE_FROM) return g.pos;
      // Its group's corridor all the way (BOT_AI_PLAN.md Phase C item 4: NavWorld.pathAlong), when the corridor runs to
      // this goal; else by its via, then the shortest way on.
      if (job.route.polys.length > 1 && !this.alongFailed(job.route, view.tick)) {
        this.along = { c: job.route, tick: view.tick, failed: this.along?.c === job.route ? this.along.failed : -Infinity };
        return g.pos;
      }
      return this.viaRoute(view, job.route, g.pos);
    }
    let lane = this.lane;
    // (Only for a spot to get to, a flag: not for following someone, nor for a carrier running home the short way.)
    if (!g.push || g.detour === 0 || g.radius >= 1) return g.pos;
    if (!lane || horizontalDistance(lane.goal, g.pos) > 8) {
      const far = horizontalDistance(me, g.pos) > LANE_FROM;
      const r = this.routeRng();
      const side = r < 0.35 ? -1 : r < 0.7 ? 1 : 0;
      let via = far && side ? laneWaypoint(view.nav.mainPlaces(), me, g.pos, side) : null;
      // Only a waypoint routes get to from here and on from to the goal (the samples cover roofs and pools a route
      // never reaches: a bot sent by one of those stood where it was, Capitol Mall).
      if (via && (!view.nav.reachable(me, via) || !view.nav.reachable(via, g.pos))) via = null;
      lane = this.lane = { goal: { ...g.pos }, via };
    }
    const via = lane.via;
    // Near it, or already nearer the goal than it is: on to the goal.
    if (via && (horizontalDistance(me, via) < 6 || horizontalDistance(me, g.pos) < horizontalDistance(via, g.pos))) lane.via = null;
    return lane.via ?? g.pos;
  }

  private get berserker(): boolean {
    return hasTag(this.profile, 'BERSERKER');
  }

  /** Arena style (Quake feel): keeps moving, strafe-jumps, times the item respawns, rarely takes cover. */
  private get arena(): boolean {
    return hasTag(this.profile, 'ARENA');
  }

  /** Tactical style (Counter-Strike feel): slow and careful, holds angles, uses cover and stance a lot. */
  private get methodical(): boolean {
    return hasTag(this.profile, 'TACTICAL');
  }

  /** How tactically this bot plays (difficulty × personality), 0..1. */
  private get tactical(): number {
    return this.difficulty.tactics * (0.35 + (this.profile.tacticalAwareness / 100) * 0.9);
  }

  private preferredRange(view: BotWorldView): number {
    const def = this.heldDef(view);
    const base = 4 + (this.profile.rangePreference / 100) * 22;
    if (!def) return base;
    const [lo, hi] = def.botRange;
    return clamp(base, lo + 1, Math.max(lo + 2, Math.min(hi - 2, hi * 0.7)));
  }

  // ------------------------------------------------------------------ tactical decisions (~10 Hz)

  private decide(view: BotWorldView, target: CombatantView | undefined): void {
    if (!simProfile.on) return this.decideNow(view, target);
    const t0 = performance.now();
    this.decideNow(view, target);
    simProfile.add('botDecide', performance.now() - t0);
  }

  private decideNow(view: BotWorldView, target: CombatantView | undefined): void {
    const me = view.self;
    const tick = view.tick;
    const hurt = this.hurt(view);
    const underFire = tick - this.underFireTick < TICK_RATE * 1.5 || tick - this.hurtTick < TICK_RATE * 1.5;
    // Flushed off a vantage spot: hurt there, or shot at by someone it can't see. Or its time there is up (mid-fight too:
    // a sniper moves on after a kill).
    const post = this.post;
    if (post && ((post.arrived >= 0 && (this.hurtTick > post.arrived || (underFire && !target))) || tick >= post.until)) this.leavePost(tick, post.moving ? 1 + this.routeRng() * 2 : this.postCooldown(post.kind));
    // Holding a spot (or on the way to one): an enemy who slipped out of view, or a noise, isn't worth leaving it for, unless close.
    // Going for an objective (a goal to keep to): the same, unless it is on the way.
    const holding = this.posted(me.pos);
    const goal = view.orderGoal;
    const push = !!goal?.push;

    // Enemy vehicles about: out of the way of one bearing down.
    this.watchTraffic(view);
    const armedForVehicles = this.canHurtVehicles(view);

    // A lift from a teammate is worth taking even when hurt or with someone about.
    if (this.mountPlan && (this.mountPlan.ride || (!hurt && (!target || horizontalDistance(me.pos, target.pos) > 10)))) this.state = 'mount';
    else if (target && hurt && !this.berserker && !goal?.run) this.state = 'retreat';
    else if (!underFire && !armedForVehicles && this.fetchLauncher(view, target)) {
      // An enemy vehicle about and nothing that hurts it: a launcher close by first.
      this.state = 'advance';
    } else if (target) {
      this.state = this.cover ? 'cover' : 'engage';
      this.option = OPT_FIGHT;
    } else this.choose(view, hurt, underFire);

    // Cover-to-cover advance (Phase B item 6): on the way to an objective, in a fight at range, by style.
    this.bound = this.boundPhase(view, target, goal);
    // Cover: under fire, fighting at range, reloading or hurt, for bots that play tactically.
    const threat = target?.pos ?? (underFire ? this.threatFrom : null);
    // Better bots take cover far more often; arena bots mostly keep moving instead.
    // An enemy vehicle it has nothing to hurt with: cover (any bot that thinks at all).
    const outgunned = !!target && this.targetMount?.kind === 'vehicle' && !armedForVehicles;
    const coverChance = Math.max(this.arena ? this.tactical * 0.4 : 0.15 + this.tactical * 1.7 + (this.methodical ? 0.3 : 0), outgunned ? 0.4 + this.tactical * 0.6 : 0);
    if (threat && !this.berserker && !holding && !goal?.run && (this.bound !== null || this.rng() < coverChance)) {
      const dist = horizontalDistance(me.pos, threat);
      const held = this.heldWeapon(view);
      const lowAmmo = !!held && held.def.magazine > 0 && held.mag <= Math.ceil(held.def.magazine * 0.25);
      // (On the way to an objective, not for a fight at range or only for being shot at: it fights on the move instead,
      // unless it bounds: then in cover while its half covers, and from cover to cover further on while its half moves.)
      const wantCover = (underFire && !push) || hurt || lowAmmo || !!view.reloading || (dist > 11 && !push) || this.state === 'retreat' || outgunned || this.bound !== null;
      const threatEye = { x: threat.x, y: threat.y + PLAYER.eyeHeight, z: threat.z };
      if (this.cover && (horizontalDistance(this.cover.threat, threatEye) > 4 || (tick % 30 < DECIDE_TICKS && !stillCovered(view.physics, this.cover.pos, threatEye, me.size ?? 1)))) {
        // Threat moved round our cover: find another.
        this.cover = null;
      }
      if (wantCover && !this.cover && tick >= this.nextCoverSearch) {
        this.nextCoverSearch = tick + Math.round(TICK_RATE * (1.2 + this.rng()));
        const advance = view.squad?.advance === true || this.bound === 'move';
        this.cover = findCover({
          physics: view.physics,
          nav: view.nav,
          from: me.pos,
          threat: threatEye,
          radius: this.state === 'retreat' ? 9 : 8,
          preferred: advance ? Math.max(6, dist - 8) : this.preferredRange(view),
          avoid: view.allies?.filter((a) => a.slot !== me.slot).map((a) => a.pos),
          away: this.state === 'retreat',
          eyeScale: me.size ?? 1,
          rng: this.rng,
        });
        if (this.cover) {
          this.peekPhase = 'hide';
          this.peeks = 0;
          this.phaseUntil = tick + Math.round(TICK_RATE * (0.4 + this.rng() * 0.6));
        }
      }
    } else if (!target && !underFire && tick - this.lastTargetTick > TICK_RATE * 4) {
      this.cover = null;
    }
    // Bounding squads: the moving half leaves its cover for one further forward (reloading or hurt, it stays put).
    const moving = view.squad?.advance || (this.bound === 'move' && !view.reloading && !hurt);
    if (moving && this.cover && target && horizontalDistance(this.cover.pos, target.pos) > horizontalDistance(me.pos, target.pos) - 1 && tick >= this.nextCoverSearch) {
      this.cover = null;
    }

    this.considerGrenade(view, target);
    this.considerSmoke(view, target);
    this.considerMount(view, target);
  }

  // ------------------------------------------------------------------ scored choices

  /** The option it chose last (scored choices: OPT_*), and the scores it weighed (debug and tests). */
  private option = -1;
  readonly scores = new Float32Array(OPTIONS);
  /** The choice's input, refilled each choice (no allocation per think). */
  private readonly choice: ChoiceInput;
  /** The pickup worth a detour from its objective, worked out about once a second: where, and its score. */
  private pickCand: { pos: Vec3 | null; score: number; tick: number } | null = null;

  /**
   * Scored choices (BOT_AI_PLAN.md Phase B item 1), with nobody in sight: what to do now. Each option gets a score from
   * the bot's personality, its health, the mode's goal and its role (OrderGoal: keep to it, run, hold a place, a
   * person's order), the team brain's job, and distance; the best wins, and the one it chose last gets MARGIN more so
   * it doesn't dither between two. The states stay the "how".
   * - the objective (the mode's goal, a person's order, the team brain's cut-off point), or roaming without one;
   * - keeping up hide-and-peek behind cover just after a fight, or running on a moment after losing sight while
   *   getting away;
   * - a pickup: a real gun with only a sidearm (before chasing anyone), or what it needs while holding an objective
   *   (health when hurt, ammo when low), close by;
   * - chasing an enemy that slipped out of sight (more for persistent bots, fresh sightings and close ones);
   * - a noise.
   * Leaving the objective costs (leaveCost): a carrier never does; a bot keeping to its way turns aside only for
   * something within PUSH_NOTICE; one holding a place less the further it is. So a CTF attacker fights on its way to
   * the flag and turns back to it after the fight, and a defender or a bot on the hill doesn't wander off after a
   * shot it heard 30 m away.
   */
  private choose(view: BotWorldView, hurt: boolean, underFire: boolean): void {
    const me = view.self;
    const tick = view.tick;
    const g = view.orderGoal ?? null;
    const held = this.heldWeapon(view);
    const lk = this.lastKnown;
    const hd = this.heard;
    const c = this.choice;
    c.me = me.pos;
    c.goal = g;
    c.hurt = hurt;
    c.lowAmmo = !!held && held.def.magazine > 0 && held.mag + held.reserve <= held.def.magazine;
    // Ducked out of sight behind cover: keep up the hide-and-peek rather than charging off (an objective to get to:
    // only a moment).
    c.cover = !!this.cover && (underFire || !!view.reloading || hurt || tick - this.lastTargetTick < TICK_RATE * (g?.push ? 1 : 2.5 + (1 - this.profile.aggression / 100) * 3));
    // Getting away: keep running a moment after losing sight of the threat.
    c.retreating = this.state === 'retreat' && !!lk && tick - lk.tick < TICK_RATE * 3;
    c.pickup = this.pickupScore(view, g, underFire, hurt);
    c.lost = lk ? { pos: lk.pos, age: (tick - lk.tick) / TICK_RATE } : null;
    c.noise = hd ? { pos: hd.pos, age: (tick - hd.tick) / TICK_RATE } : null;
    c.posted = !!this.post;
    c.post = this.postScore(view, g);
    scoreChoices(c, this.scores);
    const best = bestChoice(this.scores, this.option, !!g);
    // Done with a chase or a noise (a chase that got there and found nobody looks round first).
    if (this.state === 'chase' && best !== OPT_CHASE) {
      if (lk && horizontalDistance(me.pos, lk.pos) <= 1.5) {
        this.scanUntil = tick + Math.round(TICK_RATE * (0.8 + this.tactical));
        this.scanYaw = this.yaw;
      }
      this.lastKnown = null;
    }
    if (this.state === 'investigate' && best !== OPT_NOISE) this.heard = null;
    this.option = best;
    switch (best) {
      case OPT_COVER:
        this.state = 'cover';
        break;
      case OPT_RETREAT:
        this.state = 'retreat';
        break;
      case OPT_CHASE:
        this.state = 'chase';
        break;
      case OPT_NOISE:
        this.state = 'investigate';
        break;
      case OPT_POST:
        // (A sniper's spot: held from the advance state, actPost.)
        this.state = 'advance';
        break;
      case OPT_PICKUP: {
        const at = this.gunNearby ?? this.pickCand?.pos ?? null;
        this.state = 'advance';
        if (at && (!this.roamGoal || horizontalDistance(this.roamGoal, at) > 0.5)) {
          this.roamGoal = this.pickupAt = { ...at };
          this.via = null;
        }
        break;
      }
      default:
        this.state = this.mountPlan ? 'mount' : g ? 'hold' : 'advance';
        if (this.state === 'advance') this.considerPost(view);
    }
  }

  /**
   * A sniper's spot (POST_WEIGHT; Phase B item 5): the sniper role with a scoped gun, with nowhere it was sent or a goal
   * to hold (its spot looks over it), holding a spot or able to take one now. -Infinity otherwise.
   */
  private postScore(view: BotWorldView, g: OrderGoal | null): number {
    if (view.plan?.role !== 'sniper' || (g && !holdsPost(g))) return -Infinity;
    if (!this.post) this.considerPost(view);
    return this.post ? POST_WEIGHT : -Infinity;
  }

  /**
   * The pickup option's score: a sniper's scoped gun first (SCOPE_WEIGHT, within SCOPE_DETOUR), a real gun close by
   * with only a sidearm (GUN_WEIGHT: before chasing anyone; on the way to an objective, one a few steps off it), else,
   * holding an objective, what it needs close by (health when hurt, ammo when low: its pickup score, worth more when
   * badly hurt), worked out about once a second. A roaming bot picks up what it needs as it goes (act()).
   */
  private pickupScore(view: BotWorldView, g: OrderGoal | null, underFire: boolean, hurt: boolean): number {
    this.gunNearby = null;
    if (underFire || g?.run || g?.order) return -Infinity;
    // A sniper without a scoped gun goes for one first (in Military and Sci-fi it spawns with one: Match.sniperGun).
    if (view.plan?.role === 'sniper' && !this.hasScope(view) && (!g || holdsPost(g))) {
      this.gunNearby = this.pickupGoal(view, 'weapon', SCOPE_DETOUR, (def) => !!def.view.zoomFov && !def.alt);
      if (this.gunNearby) return SCOPE_WEIGHT;
    }
    const keep = !g || ((!!g.push || !!g.watch) && g.detour !== 0);
    if (keep && bestLoadedDesirability(view.inventory) <= SIDEARM) {
      this.gunNearby = this.pickupGoal(view, 'weapon', g ? Math.min(GUN_DETOUR, this.detourFor(g)) : GUN_DETOUR);
      if (this.gunNearby) return GUN_WEIGHT;
    }
    if (!g || g.detour === 0) return -Infinity;
    const tick = view.tick;
    let c = this.pickCand;
    if (!c || tick - c.tick >= TICK_RATE) {
      const within = g.push ? this.detourFor(g) : 8;
      const pick = this.pickupScored(view, within);
      c = this.pickCand = { pos: pick?.pos ?? null, score: pick?.score ?? 0, tick };
    }
    if (!c.pos) return -Infinity;
    // (Badly hurt, health counts for more: half health or less.)
    const health = view.self.health <= PLAYER.maxHealth * 0.5 || hurt;
    return c.score * 2.4 * (health ? 1.6 : 1);
  }

  /** The best pickup within `within` m that a route reaches, with its score (bestPickup's), or null. */
  private pickupScored(view: BotWorldView, within: number): { pos: Vec3; score: number } | null {
    for (let tries = 0; tries < 3; tries++) {
      const pick = this.bestPickup(view, undefined, within);
      if (!pick || this.collectable(view, pick.pos)) return pick;
      this.losePickup(view, pick.pos);
    }
    return null;
  }

  // ------------------------------------------------------------------ per-tick actions

  private act(view: BotWorldView, seq: number, target: CombatantView | undefined, ctx: AimContext): PlayerInput {
    const me = view.self;
    const tick = view.tick;
    this.holdStill = false;
    if (this.pressPlan && tick >= this.pressPlan.until) this.pressPlan = null;
    // The door it was going to open is open now (someone else pressed): leave the button alone. A button that
    // toggles its door would shut it again, and with a team trying to get through it flapped open and shut while
    // they crowded the button (Iron Compound's main gate: 55 % of the bots' time).
    if (this.pressPlan && !view.blockers?.some((b) => sameBox(b, this.pressPlan!.door))) {
      this.pressPlan = null;
      this.path = [];
      this.goal = null;
      this.lastPathTick = -Infinity;
    }
    // Within reach of the button it's going to press: it looks at the button and nothing else (the look along its route,
    // or running for its goal, turned it back level every tick, and it never faced a console's button: Serene City's
    // thaw console, eight bots). Where it looked when the tick began, for the turn to the button to start from.
    const atButton = this.pressPlan !== null && this.pressReach(me, this.pressPlan);
    const yaw0 = this.yaw;
    const pitch0 = this.pitch;
    let moveYaw: number | null = null;
    let moveScale = 1;
    let backOff = false;
    let sprint = false;
    let wantFire = false;
    let stance: Stance = 0;
    let strafe = false;
    let sol: AimSolution | null = null;
    let lookDone = false;
    // (Measuring: what it does this tick; see BotDoing.)
    let doing: BotDoing = this.state === 'engage' ? 'fight' : this.state === 'cover' || this.state === 'retreat' || this.state === 'chase' || this.state === 'investigate' || this.state === 'mount' ? this.state : 'roam';
    this.pathMiss = false;
    const def = ctx.weapon;
    const hurt = this.hurt(view);
    const underFire = tick - this.underFireTick < TICK_RATE * 1.5;

    if (this.state !== 'retreat') {
      this.retreatGoal = null;
      this.retreatMode = null;
    }

    let aimedTarget = false;
    const aimAtTarget = (t: CombatantView) => {
      aimedTarget = true;
      const ta = simProfile.on ? performance.now() : 0;
      sol = this.aim.solve(ctx, { slot: t.slot, pos: t.pos, stance: this.aimStance(def, t), size: t.size ?? 1, box: t.box ?? null, yaw: t.yaw, hitScale: t.hitScale ?? 1, bodyStance: t.stance ?? 0 });
      if (simProfile.on) simProfile.add('botAim', performance.now() - ta);
      this.turnToward(sol.yaw, sol.pitch);
      lookDone = true;
      wantFire = true;
    };

    switch (this.state) {
      case 'engage':
      case 'cover':
      case 'retreat': {
        const t = target;
        if (!t) {
          const threat = this.lastKnown?.pos ?? this.threatFrom;
          if (this.state === 'retreat' && !this.cover && this.retreatGoal) {
            // Lost sight of them while getting away: keep going (stopping to look back is how you get caught).
            moveYaw = this.followPathTo(view, this.retreatGoal.pos, false);
            if (moveYaw !== null) {
              sprint = true;
              this.turnToward(moveYaw, 0);
              lookDone = true;
              break;
            }
          } else if (!this.cover && this.strafing && tick - this.lastTargetTick < TICK_RATE * 0.6) {
            // Out of sight for a moment mid-fight: carry on with the strafe rather than freezing.
            strafe = true;
          }
          if (this.cover && threat) {
            // Hidden behind cover (or peeking for the enemy to show again).
            const r = this.inCover(view, threat, def);
            moveYaw = r.moveYaw;
            sprint = r.sprint;
            stance = r.stance;
            moveScale = r.moveScale;
          }
          // Hold the angle where they were.
          if (threat && !sprint) this.lookAt(view, threat, 1.2);
          lookDone = !sprint;
          break;
        }
        const dist = horizontalDistance(me.pos, t.pos);
        const preferred = this.preferredRange(view);
        if (this.state === 'retreat' && !this.cover) {
          // No cover: get to health or away from the threat. One place, kept for a while, so the bot runs one way.
          const refuge = this.refuge(view, t.pos);
          moveYaw = this.followPathTo(view, refuge, false);
          if (moveYaw === null) this.retreatGoal = null;
          // Either turn and run, or back off shooting; stick with the choice for a moment.
          if (!this.retreatMode || tick >= this.retreatMode.until) {
            const run = dist > 9 || this.berserker || this.rng() < 0.5;
            this.retreatMode = { run, until: tick + Math.round(TICK_RATE * (1.3 + this.rng() * 1.2)) };
          }
          if (moveYaw !== null && this.retreatMode.run) {
            sprint = true;
            this.turnToward(moveYaw, 0);
            lookDone = true;
          } else aimAtTarget(t);
          break;
        }
        if (this.cover) {
          const r = this.inCover(view, t.pos, def);
          moveYaw = r.moveYaw;
          sprint = r.sprint;
          stance = r.stance;
          moveScale = r.moveScale;
          if (r.shoot) aimAtTarget(t);
          else if (sprint && moveYaw !== null) {
            this.turnToward(moveYaw, 0);
            lookDone = true;
          } else {
            this.lookAt(view, t.pos, STANCES[t.stance ?? 0].height * 0.6);
            lookDone = true;
          }
          break;
        }
        // In the open.
        if (this.berserker) {
          // Straight at them; sprint the long way in.
          if (dist > 7) moveYaw = this.followPathTo(view, t.pos, true);
          if (dist > 18) sprint = true;
          strafe = dist < 10;
        } else {
          const squadAdvance = view.squad?.advance === true;
          // Range bands with hysteresis: once closing in (or backing off), carry on until well inside the band.
          // A melee weapon has to get right up to them: it closes all the way in, and again as soon as they step off.
          const reach = def?.kind === 'melee';
          if (this.spacing === 'close') {
            if (dist < preferred + (reach ? 0.3 : 2.5) && !(squadAdvance && dist > 8)) this.spacing = 'hold';
          } else if (this.spacing === 'back') {
            if (dist > preferred - 1.5) this.spacing = 'hold';
          } else if (dist > preferred + (reach ? 1 : 4) || (squadAdvance && dist > 8)) this.spacing = 'close';
          else if (dist < preferred - 4) this.spacing = 'back';
          if (this.outnumbered() && dist < preferred + 6) this.spacing = 'back';
          this.strafing = this.strafing ? dist < 15.5 : dist < 13;
          if (this.spacing === 'close') {
            moveYaw = this.followPathTo(view, t.pos, true);
            moveScale = 0.75;
          } else if (this.spacing === 'back') backOff = true;
          else if (this.strafing) strafe = true;
          // Holding at range: crouch to steady the aim; snipers lie down.
          if (moveYaw === null && !backOff && !strafe) {
            stance = this.wantsProne(view, dist) ? 2 : dist > 13 && !this.arena && this.tactical > 0.25 ? 1 : 0;
          }
          // On a vantage spot: fight from it (unless they're right on top of it).
          if (dist > 7 && this.posted(me.pos)) {
            moveYaw = null;
            backOff = false;
            strafe = false;
            stance = this.wantsProne(view, dist) || (this.post!.kind === 'sniper' && !!def?.view.zoomFov && dist > 15) ? 2 : 1;
          }
          // On the way to an objective (owner: CTF attackers "hang out"): carry on toward it, shooting as it goes,
          // rather than stopping to trade shots at range. Up close it's a fight like any other.
          // A flag carrier runs whatever the range, sprinting past anyone not right on it.
          const g = view.orderGoal;
          if (g?.push && this.bound !== 'cover' && (dist > 9 || g.run) && (horizontalDistance(me.pos, g.pos) > g.radius + 0.5 || Math.abs(me.pos.y - g.pos.y) > 2)) {
            const go = this.followPathTo(view, this.orderTarget(view, g), false);
            if (go !== null) {
              moveYaw = go;
              moveScale = 0.85;
              backOff = false;
              strafe = false;
              stance = 0;
              // (A carrier sprints past anyone not close; close ones it shoots on the move.)
              if (g.run && dist > 12) sprint = true;
            }
          }
        }
        if (!sprint) aimAtTarget(t);
        break;
      }
      case 'chase': {
        const lk = this.lastKnown!;
        // Tactical bots hold the angle where the enemy vanished before pushing it.
        if (this.methodical && tick - lk.tick < TICK_RATE * (1 + this.tactical) && this.canSee(view, ctx.eye, lk.pos)) {
          this.lookAt(view, lk.pos, 1.2);
          lookDone = true;
          stance = this.tactical > 0.5 ? 1 : 0;
          doing = 'chaseHold';
          break;
        }
        const far = horizontalDistance(me.pos, lk.pos) > 25;
        moveYaw = this.followPathTo(view, lk.pos, false);
        if ((moveYaw === null && horizontalDistance(me.pos, lk.pos) > 1.5) || this.stalled(view, lk.pos)) {
          this.lastKnown = null;
          this.state = 'advance';
          break;
        }
        // Rejoin a fight that has moved away at a run; close in carefully.
        if (far && !this.careful()) sprint = true;
        else moveScale = this.careful() ? 0.7 : 1;
        // Suppressors keep firing at where the enemy went into cover.
        // Brief and deliberate: only while the rounds would reach the spot (clearShot), not into a wall on the way.
        if (hasTag(this.profile, 'SUPPRESSOR') && tick - lk.tick < TICK_RATE * SUPPRESS_SECONDS && horizontalDistance(me.pos, lk.pos) > 6) {
          moveYaw = null;
          const sup = this.suppress(view, lk.pos, ctx);
          if (sup) {
            sol = sup;
            lookDone = true;
            wantFire = true;
          }
        }
        break;
      }
      case 'investigate': {
        const goal = this.heard!.pos;
        moveYaw = this.followPathTo(view, goal, false);
        moveScale = this.careful() ? 0.65 : 1;
        // No way there (another floor, a shut door) or no closer for a while: let it go.
        if ((moveYaw === null && horizontalDistance(me.pos, goal) > 2) || this.stalled(view, goal)) {
          this.unreachable = { pos: goal, until: tick + TICK_RATE * 10 };
          this.heard = null;
          this.state = 'advance';
        }
        break;
      }
      case 'mount': {
        const plan = this.mountPlan;
        const m = plan && view.mounts?.find((x) => x.index === plan.index);
        if (!plan || !m || !m.alive || !m.seats.some((s) => s.free)) {
          this.mountPlan = null;
          break;
        }
        const d = horizontalDistance(me.pos, m.pos);
        if (plan.ride) {
          // A teammate's ride: still theirs, still a seat beside the driver's?
          const driver = m.seats.find((x) => x.role === 'driver')?.by;
          if (driver === undefined || !view.allies?.some((a) => a.slot === driver) || !m.seats.some((x) => x.free && x.role !== 'driver') || d > RIDE_REACH + 6) {
            this.mountPlan = null;
            break;
          }
          // It moves: re-plan to it as it goes, and run straight at it over the last few metres.
          if (d > m.enterRadius * 0.75) {
            moveYaw = d < 6 ? Math.atan2(m.pos.x - me.pos.x, m.pos.z - me.pos.z) : this.followPathTo(view, m.pos, true);
            sprint = d > 4;
          }
          break;
        }
        // To a spot just off its hull (its centre is inside it, where no route goes), until it can get in from here.
        if (!inBoardingReach(m, me.pos)) {
          if (!plan.spot || !plan.spotOf || horizontalDistance(plan.spotOf, m.pos) > 1.5) {
            plan.spot = boardingSpot(m, me.pos);
            plan.spotOf = { ...m.pos };
          }
          moveYaw = this.followPathTo(view, plan.spot, false);
          sprint = d > 8;
          // No way there at all: give up on it now, not when the plan runs out.
          if (moveYaw === null && horizontalDistance(me.pos, plan.spot) > 2) {
            this.giveUpOn(m.index, tick);
            this.mountPlan = null;
          }
        }
        break;
      }
      case 'hold': {
        const g = view.orderGoal;
        if (!g) break;
        // A goal that moves (a carrier to escort, a teammate to follow) is planned to afresh as it goes; one that
        // stays put (a flag at its base) only when it moves or the route runs out.
        const lo = this.lastOrder;
        const moving = horizontalDistance(lo, g.pos) > 0.05 || Math.abs(lo.y - g.pos.y) > 0.05;
        lo.x = g.pos.x;
        lo.y = g.pos.y;
        lo.z = g.pos.z;
        // Gathering with its group for a push (the team brain): at the staging spot it keeps watch toward the objective
        // until the group goes together.
        const stage = this.jobFor(view, g)?.stage ?? null;
        if (stage && horizontalDistance(me.pos, stage) < STAGE_RADIUS && Math.abs(me.pos.y - stage.y) < 3) {
          this.watch = this.watch && horizontalDistance(this.watch.spot, stage) < STAGE_RADIUS + 1 ? this.watch : null;
          const r = this.keepWatch(view, { pos: stage, radius: STAGE_RADIUS - 1, watch: g.pos }, true);
          moveYaw = r.moveYaw;
          moveScale = r.moveScale;
          stance = r.stance;
          lookDone = true;
          doing = 'stage';
          break;
        }
        if (horizontalDistance(me.pos, g.pos) > g.radius || Math.abs(me.pos.y - g.pos.y) > 2) {
          // A goal no route reaches from the main area (a flag dropped on a ledge, a carrier on a roof): keep watch as
          // near it as a route gets, facing it, until it comes within reach, rather than walking to and fro.
          const near = this.outOfReach(view, g.pos);
          if (near) {
            this.watch = this.watch && horizontalDistance(this.watch.spot, near) < 3.5 ? this.watch : null;
            const r = this.keepWatch(view, { pos: near, radius: 3, watch: g.pos });
            moveYaw = r.moveYaw;
            moveScale = r.moveScale;
            stance = r.stance;
            lookDone = true;
            doing = 'station';
            break;
          }
          const to = this.orderTarget(view, g);
          moveYaw = this.followPathTo(view, to, moving);
          // No way by its lane after all: straight for the goal.
          if (moveYaw === null && this.pathMiss && this.lane?.via) this.lane.via = null;
          // No way to its corridor's via: straight for the goal.
          else if (moveYaw === null && this.pathMiss && this.skipVia(to, g.pos)) moveYaw = null;
          else if (moveYaw === null && this.pathMiss && me.grounded !== false) {
            // As near as a route gets to a goal it can't reach (followPathNow went there): keep watch there, facing
            // it, until it comes within reach (a dropped flag goes home) or the goal changes. followPathNow keeps
            // asking for the route as its back-off allows, and looks for a way off a cut-off patch, a button, a lead
            // nearer, each time: Obsidian Orb's bots stranded on its reactor platform got off it so (a version that
            // only asked every 4 s, watching meanwhile, took 0 of its flags in two matches, against 5 a match). (Before
            // that, the route to the next place to watch from cleared the goal's back-off and every tick asked again:
            // Eagle Spires' attackers stood below the mesas asking 30 000 times a match.)
            this.pathMiss = false;
            this.watch = null;
            const r = this.keepWatch(view, { pos: this.standIn ?? view.nav.reachToward(me.pos, g.pos) ?? me.pos, radius: 3, watch: g.pos });
            moveYaw = r.moveYaw;
            moveScale = r.moveScale;
            stance = r.stance;
            lookDone = true;
            doing = 'station';
            break;
          }
          moveScale = this.careful() && !g.push ? 0.8 : 1;
          // An objective a way off: run for it (a carrier always), as players do.
          if (g.push && (g.run || horizontalDistance(me.pos, to) > 15)) sprint = true;
          doing = 'goal';
          this.watch = null;
        } else {
          // On station: keep watch like a person would (owner: "nobody stands like a statue").
          const r = this.keepWatch(view, g);
          moveYaw = r.moveYaw;
          moveScale = r.moveScale;
          stance = hasTag(this.profile, 'SNIPER') && me.grounded !== false ? (Math.max(1, r.stance) as Stance) : r.stance;
          lookDone = true;
          doing = 'station';
        }
        break;
      }
      case 'advance':
      case 'roam':
      default: {
        // Camper and sniper roles: a vantage spot to hold.
        if (this.post) {
          const r = this.actPost(view);
          if (r) {
            moveYaw = r.moveYaw;
            stance = r.stance;
            moveScale = r.moveScale;
            lookDone = r.moveYaw === null || horizontalDistance(me.pos, this.post!.board.spots[this.post!.spot]!.pos) < 1.6;
            doing = this.post && this.post.arrived >= 0 ? 'post' : 'postTravel';
            break;
          }
        }
        // In a squad: its goal and route replace the bot's own whenever the squad picks a new one.
        const cl = view.plan?.cluster ?? null;
        const av = this.avoid;
        if (cl?.goal && !view.orderGoal && !(av && tick < av.until && horizontalDistance(av.pos, cl.goal) < 6)) {
          if (!this.squadGoal || horizontalDistance(this.squadGoal, cl.goal) > 3) {
            this.squadGoal = { ...cl.goal };
            this.roamGoal = { ...cl.goal };
            this.via = cl.via ? { ...cl.via } : null;
            // (Toward the enemy's side, the squad's corridor: route variety.)
            this.roamRoute = cl.route ? { c: cl.route, goal: { ...cl.goal } } : null;
          } else if (!this.roamGoal) this.roamGoal = { ...cl.goal };
        } else this.squadGoal = null;
        if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2 || (tick + this.slot) % (TICK_RATE * 2) === 0) {
          // Re-evaluate pickups now and then; otherwise keep advancing on the current goal.
          const pick = this.pickupGoal(view);
          if (pick) this.roamGoal = this.pickupAt = pick;
          else if (this.squadGoal && horizontalDistance(me.pos, this.squadGoal) > 2 && (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2)) {
            // Back from a detour (a pickup, a goal it reached or couldn't reach): on to the squad's goal again, not one
            // of its own. (Before, a member or the leader that picked something up went off to a goal of its own until
            // the squad picked its next one: the leader one way, the members another, regrouping back and forth.)
            this.roamGoal = { ...this.squadGoal };
            this.via = null;
          } else if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2) this.pickAdvanceGoal(view);
        }
        let goal = this.roamGoal!;
        if (this.via) {
          if (horizontalDistance(me.pos, this.via) < 4) this.via = null;
          else goal = this.via;
        }
        // Toward the enemy's side by a corridor (its squad's, or the cheapest of its side's trip there: route variety).
        const rr = this.roamRoute;
        if (!this.via && rr && horizontalDistance(rr.goal, goal) < 3 && horizontalDistance(me.pos, goal) > ROUTE_FROM) goal = this.viaRoute(view, rr.c, goal);
        // A squad member far from its leader catches up first (regroups); one ahead of it waits.
        const follower = !!cl && cl.leader !== me.slot;
        const fromLeader = cl ? horizontalDistance(me.pos, cl.leaderPos) : 0;
        // (Hysteresis: from 28 m out until back within 15 m, so it doesn't swap goals at the edge.)
        this.regrouping = follower && (fromLeader > 28 || (this.regrouping && fromLeader > 15));
        const regroup = this.regrouping;
        if (regroup) goal = cl!.leaderPos;
        // A member already near the squad's goal waits there for the squad's next one (no crowding onto one spot).
        const waiting = follower && !regroup && !!this.squadGoal && !!this.roamGoal && horizontalDistance(this.roamGoal, this.squadGoal) < 1 && horizontalDistance(me.pos, this.squadGoal) < 8;
        // (Waiting, it keeps watch round the squad's goal, facing the enemy's side: no standing about.)
        const watching = waiting ? this.keepWatch(view, { pos: this.squadGoal!, radius: 7, watch: nearestOf(view.plan?.towards, me.pos) }) : null;
        moveYaw = watching ? watching.moveYaw : this.followPathTo(view, goal, regroup);
        if (watching) {
          stance = watching.stance;
          lookDone = true;
        }
        doing = waiting ? 'squadWait' : regroup ? 'regroup' : this.squadGoal && this.roamGoal && horizontalDistance(this.roamGoal, this.squadGoal) < 1 ? 'squad' : this.roamGoal && this.roamGoal === this.pickupAt ? 'pickup' : 'roam';
        // Arrived or unreachable: pick another goal next tick.
        if (moveYaw === null && !regroup && !waiting) {
          // No way to the squad's goal from here: leave it to the others for a while (its own goals meanwhile).
          if (this.squadGoal && this.roamGoal && horizontalDistance(this.roamGoal, this.squadGoal) < 1 && horizontalDistance(me.pos, this.squadGoal) > 3) this.avoid = { pos: { ...this.squadGoal }, until: tick + TICK_RATE * 20 };
          // No way to a pickup it was after (not there yet): the same, or the next pickup check sends it back.
          else if (this.roamGoal && !this.via && horizontalDistance(me.pos, this.roamGoal) > 1.5) this.losePickup(view, this.roamGoal);
          // At it and it's still there: it won't take (a dropped spear the bot has, its ammo full). The same, or the
          // next check picks it again (Sandfall Colosseum: five bots round a dropped spear for half a minute).
          else if (this.roamGoal && this.roamGoal === this.pickupAt && this.refused(view, this.roamGoal)) this.losePickup(view, this.roamGoal);
          this.roamGoal = null;
          this.via = null;
        }
        moveScale = watching ? watching.moveScale : this.careful() && this.clearing ? 0.7 : 1;
        if (cl && moveYaw !== null && !regroup && !watching) {
          if (follower && cl.goal && fromLeader > cl.spacing * 2 && horizontalDistance(me.pos, cl.goal) < horizontalDistance(cl.leaderPos, cl.goal) - 5) moveScale = Math.min(moveScale, 0.35);
          else if (!follower && cl.lagging) moveScale = Math.min(moveScale, 0.7);
          // Single file through doorways and onto bridges: a member right behind a teammate going the same way lets it through.
          if (follower && this.squadmateAhead(view, moveYaw)) {
            moveYaw = null;
            doing = 'singleFile';
          }
        }
        break;
      }
    }
    // Wanted to go somewhere and had no route there.
    if (this.pathMiss && moveYaw === null) doing = 'noPath';
    // On a ladder with nowhere to go (a new goal mid-climb: a ladder is off the navmesh, so no route starts there):
    // carry on along it, up while facing it, down otherwise, and plan again off it. Before, bots hung on Fernwood
    // Moon's vine ladders for minutes, every goal they picked having no route.
    if (me.climbing && moveYaw === null && !backOff && !strafe && !target) {
      moveYaw = this.yaw;
      moveScale = 1;
      if (doing === 'noPath') doing = 'goal';
    }
    // Under a canopy: no route starts in the air, so it steers straight for where it is going. (Before, it came down
    // wherever the jump carried it: Eagle Spires' attackers, out of the plane over the enemy's mesa, landed on its
    // cliffs below the flag and slid down them for half a minute.)
    if (me.chute && moveYaw === null && !backOff && !strafe) {
      const to = view.orderGoal?.pos ?? this.goal;
      if (to && horizontalDistance(me.pos, to) > 1) {
        moveYaw = Math.atan2(to.x - me.pos.x, to.z - me.pos.z);
        moveScale = 1;
        if (doing === 'noPath') doing = 'goal';
      }
    }
    // Just out of the plane, well above where it is going: the canopy straight away (jump, held as a player pulls the
    // cord), so it has the whole way down to steer in. The automatic opener waited until 28 m over whatever was
    // below: over a mesa's edge, that was below its top.
    if (this.bailedOut && me.grounded === false && !me.chute) {
      const to = view.orderGoal?.pos ?? this.goal;
      if (!to || me.pos.y - to.y > 12) this.jumpNext = true;
    }

    // No line on the target from here (clearShot): up from a crouch or prone; already standing, step aside
    // (and give up a cover spot it can't shoot from).
    const noLine = target && this.shotBlocked && tick < this.shotBlocked.until ? this.shotBlocked : null;
    if (noLine && (this.state === 'engage' || this.state === 'cover')) {
      stance = 0;
      if (noLine.side) {
        if (this.cover && this.peekPhase === 'peek') this.cover = null;
        if (moveYaw === null && !sprint && !backOff) strafe = true;
      }
    }

    // Corner checks and room clearing while moving through the map (not in a fight).
    const travelling = this.state === 'advance' || this.state === 'chase' || this.state === 'investigate' || this.state === 'hold';
    if (travelling && !target && moveYaw !== null && !sprint) {
      const r = this.checkCorners(view);
      if (r.pause !== undefined) {
        moveScale = Math.min(moveScale, r.pause);
        if (r.pause === 0) {
          moveYaw = null;
          doing = 'corner';
        }
      }
      if (r.look && !this.throwPlan) {
        this.lookAt(view, r.look, 0);
        lookDone = true;
      }
    } else if (target) {
      this.pie = null;
      this.clearing = null;
    }

    // An enemy vehicle bearing down: out of its path, whatever else was going on (still shooting unless it is close).
    const dodge = this.dodge && tick < this.dodge.until ? this.dodge : null;
    if (dodge) {
      moveYaw = dodge.yaw;
      moveScale = 1;
      backOff = false;
      strafe = false;
      stance = 0;
      sprint = dodge.sprint;
      doing = 'dodge';
    }

    // Grenade throw in progress: line it up and let go.
    let throwNow = false;
    if (this.throwPlan) {
      if (tick > this.throwPlan.until) this.throwPlan = null;
      else {
        this.turnToward(this.throwPlan.yaw, this.throwPlan.pitch);
        lookDone = true;
        wantFire = false;
        if (Math.abs(angleDelta(this.yaw, this.throwPlan.yaw)) < 0.03 && Math.abs(this.pitch - this.throwPlan.pitch) < 0.03) {
          throwNow = true;
          // A big blast landing close: run from where it comes down until it has gone off.
          const away = this.throwPlan.clear;
          if (away) this.dodge = { yaw: Math.atan2(me.pos.x - away.x, me.pos.z - away.z), until: tick + Math.round(TICK_RATE * ((this.throwPlan.fuse ?? 3) + 0.3)), sprint: true };
          this.throwPlan = null;
          this.nextThrow = tick + Math.round(TICK_RATE * (6 + this.rng() * 6));
          // Let it go off before walking in after it.
          if (this.pie) this.pie.until = Math.max(this.pie.until, tick + Math.round(TICK_RATE * 2.8));
        }
      }
    }

    if (this.throwPlan || throwNow) doing = 'throw';

    if (!lookDone && !atButton) {
      if (tick < this.scanUntil) {
        this.turnToward(this.scanYaw + Math.sin((this.scanUntil - tick) / 14) * 1.6, 0);
        if (moveYaw === null) doing = 'scan';
      } else if (this.holdStill) {
        // Waiting for a lift, or riding it: look about (a sweep and a glance back now and then), not at the shaft.
        const corner = this.path[this.pathIndex];
        const t = tick + this.slot * 41;
        const base = corner ? Math.atan2(corner.x - me.pos.x, corner.z - me.pos.z) : this.yaw;
        this.turnToward(base + Math.sin(t / 45) * 1.1 + (t % (TICK_RATE * 6) < TICK_RATE ? Math.PI * 0.8 : 0), 0);
      } else if (this.state === 'chase' && this.lastKnown && horizontalDistance(me.pos, this.lastKnown.pos) < 30 && this.canSee(view, ctx.eye, this.lastKnown.pos)) {
        // Keep the gun on where they were while closing in.
        this.lookAt(view, this.lastKnown.pos, 1.2);
      } else this.lookAlongPath(view);
    }

    if (moveYaw !== null && this.hazardAhead(view, moveYaw)) {
      moveYaw = null;
      doing = 'hazard';
    }
    // Going somewhere (or fighting on the move), as opposed to only being nudged aside by a teammate: what stuck checks judge.
    const meaning = moveYaw !== null || backOff || strafe;
    moveYaw = this.separate(view, moveYaw, !target && !strafe && !backOff);

    let forward = 0;
    let right = 0;
    if (moveYaw !== null) {
      if (sprint) {
        // Sprinting means facing where you run.
        this.turnToward(moveYaw, 0);
        const rel = angleDelta(this.yaw, moveYaw);
        forward = Math.cos(rel);
        right = Math.sin(rel);
        if (Math.abs(rel) > 0.5) sprint = false;
      } else {
        const rel = angleDelta(this.yaw, moveYaw);
        forward = Math.cos(rel) * moveScale;
        right = Math.sin(rel) * moveScale;
      }
    } else if (backOff) {
      forward = -0.8;
    }
    // On or waiting for a lift: stand still; at a button: stop, aim at it and press.
    let pressNow = false;
    if (this.holdStill) {
      forward = 0;
      right = 0;
      doing = 'lift';
    }
    const plan = this.pressPlan;
    if (plan) doing = 'press';
    // (Aiming at someone, it fights first: turning to the button as well, it did neither.)
    if (plan && !aimedTarget && this.pressReach(me, plan)) {
      forward = 0;
      right = 0;
      sprint = false;
      const a = lookAngles({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, plan.face);
      // (Only this turn this tick: any other, such as running's turn to face its way, would undo it.)
      this.yaw = yaw0;
      this.pitch = pitch0;
      this.turnToward(a.yaw, a.pitch);
      if (Math.abs(angleDelta(this.yaw, a.yaw)) < 0.3 && Math.abs(this.pitch - a.pitch) < 0.3) {
        pressNow = true;
        this.pressedDoor = plan.door;
        this.pressPlan = null;
        this.pressedAt = tick;
        this.path = [];
        this.goal = null;
        this.lastPathTick = -Infinity;
      }
    }
    if (strafe) {
      this.updateStrafe(tick);
      right = clamp(right + this.strafeDir * 0.7, -1, 1);
    }
    // Fighting: ease direction changes (no stutter-steps); travelling, follow the route's turns closely (no clipping corners).
    [forward, right] = this.smoothMove(forward, right, !!target || tick - this.lastTargetTick < TICK_RATE || strafe || backOff || this.state === 'retreat');
    // On a parkour link of its route: run it as the build played it (facing its way, full ahead, jump at the takeoff).
    const pk = this.link && (moveYaw !== null || this.link.jumped >= 0 || this.link.left >= 0) ? this.parkourMove(view) : null;
    if (pk) {
      this.yaw = pk.yaw;
      forward = pk.wait ? 0 : 1;
      right = 0;
      this.moveX = Math.sin(pk.yaw) * forward;
      this.moveZ = Math.cos(pk.yaw) * forward;
      doing = 'parkour';
      strafe = false;
    }

    let buttons = 0;
    // Fire through the aim model's trigger discipline.
    const reacted = target ? this.reacted(view, target) : true;
    let pull = false;
    const ta = simProfile.on ? performance.now() : 0;
    // A sniper on its spot takes only a calculated shot (bots/sniper.ts goodShot): it keeps the target in its scope and
    // waits rather than give the spot away on a poor one.
    const sniping = !!target && !!sol && wantFire && this.sniping(view, def);
    if (sniping && !goodShot({ dist: sol!.dist, reach: def!.botRange[1], lateral: this.aim.speedAcross(ctx.eye, target!.pos), facing: facingOf(target!, me.pos), settled: this.aim.settledOn(sol!), tracked: this.aim.trackedTicks(tick) / TICK_RATE })) {
      wantFire = false;
      if (tick % TICK_RATE === 0) this.heldShots++;
      this.aim.trigger(ctx, { yaw: this.yaw + 9, pitch: 0, dist: 1, halfAngle: 0 }, this.yaw, this.pitch, false);
    } else if (wantFire && sol && !sprint) pull = this.aim.trigger(ctx, sol, this.yaw, this.pitch, reacted, this.shotCheck(view, ctx, sol, target));
    else this.aim.trigger(ctx, { yaw: this.yaw + 9, pitch: 0, dist: 1, halfAngle: 0 }, this.yaw, this.pitch, false);
    if (simProfile.on) simProfile.add('botAim', performance.now() - ta);
    if (pull) buttons |= BUTTON_FIRE;
    // A sniper moves on after a shot or two (the shot told them where it is), and when it's spotted.
    if (pull && sniping) this.sniperShot(tick);
    else if (sniping && facingOf(target!, me.pos) > SPOTTED_FACING && this.aim.trackedTicks(tick) > TICK_RATE * 1.5) this.relocate(tick, 0.2);
    // Scoped weapons are fired through the scope (they spray from the hip); not up close (a sniper waiting on its shot
    // keeps it up).
    const sDist = (sol as AimSolution | null)?.dist ?? 0;
    if ((wantFire || sniping) && def?.view.zoomFov && !def.alt && sDist > 7) buttons |= BUTTON_ZOOM;
    if (throwNow) buttons |= BUTTON_THROW;

    // Reload: when empty; topping up only when nobody is in sight, or from behind cover.
    const held = this.heldWeapon(view);
    const inCoverHidden = !!this.cover && this.peekPhase === 'hide' && horizontalDistance(me.pos, this.cover.pos) < 0.8;
    if (held && held.def.magazine > 0 && held.reserve > 0 && !view.reloading) {
      if (held.mag === 0 || (!target && held.mag < held.def.magazine / 2) || (inCoverHidden && held.mag < held.def.magazine * 0.6)) buttons |= BUTTON_RELOAD;
    }
    // A melee weapon with a barrel (the Battle Axe's blunderbuss): swing within reach, fire the barrel at a
    // target a few steps beyond it, and load the barrel again when nobody is that close.
    const barrel = held && held.def.kind === 'melee' && held.def.alt?.kind === 'hitscan' ? held.def.alt : null;
    if (held && barrel) {
      const loaded = (held.alt ?? 0) >= barrel.cost;
      const s = sol as AimSolution | null;
      const lined = !!s && Math.abs(angleDelta(this.yaw, s.yaw)) < s.halfAngle + 0.05 && Math.abs(this.pitch - s.pitch) < s.halfAngle + 0.08;
      if (wantFire && s && loaded && reacted && lined && !sprint && s.dist > held.def.range + 0.6 && s.dist < barrelReach(barrel) && !view.reloading) {
        buttons |= BUTTON_ALT;
        buttons &= ~BUTTON_FIRE;
      }
      const near = !!target && horizontalDistance(me.pos, target.pos) < barrelReach(barrel) + 4;
      if (barrel.reload && !view.reloading && held.reserve > 0 && (held.alt ?? 0) < (barrel.max ?? 1) && (!target || (!near && !loaded))) buttons |= BUTTON_RELOAD;
    }
    // An oil slicker: puddles round the target first, then its igniter (the second trigger) sets them alight, about
    // once every three seconds of the fight (its puddles last far longer, so there is always some to light).
    const igniter = held && held.def.projectile?.zone?.kind === 'oil' && held.def.alt?.projectile?.ignites ? held.def.alt : null;
    if (igniter && pull && held!.mag >= igniter.cost && (tick + this.slot * 23) % (TICK_RATE * 3) >= TICK_RATE * 2.2) buttons = (buttons & ~BUTTON_FIRE) | BUTTON_ALT;
    // Dry up close: punch or kick (quick melee) rather than click an empty gun.
    if (target && held && held.def.kind !== 'melee' && !held.def.projectile?.disc && held.def.magazine > 0 && held.mag === 0 && held.reserve === 0 && horizontalDistance(me.pos, target.pos) < 2 && (tick + this.slot) % 12 === 0) {
      buttons |= BUTTON_MELEE;
      buttons &= ~BUTTON_FIRE;
    }
    if (view.reloading && !this.berserker && target && moveYaw === null) stance = Math.max(stance, 1) as Stance;
    // Badly hurt and hidden: lie flat.
    if (hurt && inCoverHidden && this.tactical > 0.5) stance = 2;

    if (pressNow) buttons |= BUTTON_USE;
    // At a zipline on the route: grab it (E once; the line does the rest).
    if (this.zipPress && !me.riding && tick - this.lastUseTick > 15) {
      buttons |= BUTTON_USE;
      this.lastUseTick = tick;
    }
    if (this.zipPress || me.riding) doing = 'zip';
    this.zipPress = false;
    if (sprint && moveYaw !== null && forward > 0.3) buttons |= BUTTON_SPRINT;
    else if (stance === 2) buttons |= BUTTON_PRONE;
    else if (stance === 1) buttons |= BUTTON_CROUCH;

    // Arena bots hop (harder to hit, faster through the air): on the Arena style all the time while they
    // strafe or run; ARENA characters on the Mixed style only in a fight, and less often (arenaHop).
    if (this.arena && me.grounded && stance === 0 && tick >= this.nextHop) {
      const fighting = !!target || underFire;
      const gap = arenaHop(this.profile.hop === 'always', fighting, strafe, forward > 0.6 && !sprint);
      if (gap) {
        this.jumpNext = true;
        this.nextHop = tick + Math.round(TICK_RATE * (gap[0] + this.rng() * (gap[1] - gap[0])));
      }
    }
    this.meantToMove = meaning && (forward !== 0 || right !== 0);
    // Crossing off a cut-off patch (planEscape): hop when the way across holds it up (a step too high to walk up, a lip).
    if (this.escape && moveYaw !== null) {
      doing = 'escape';
      if (this.meantToMove && me.grounded && this.pathIndex >= this.path.length - 1 && this.speed < 1.5 && tick - this.hopAt > 18) {
        this.jumpNext = true;
        this.hopAt = tick;
        // A jump clears about 1.1 m; tucking the legs up in the air (as players do) about 1.5 (ESCAPE_RISE).
        this.tuckHop = this.escape.across.y - me.pos.y > 1;
      }
    }
    if (me.grounded) {
      if (tick - this.hopAt > 2) this.tuckHop = false;
    } else if (this.tuckHop) buttons = (buttons & ~(BUTTON_SPRINT | BUTTON_PRONE)) | BUTTON_CROUCH;
    this.doing = doing;
    // (Not off a ladder in mid-air: letting go halfway up a tall one is a fall that hurts. Standing at its top or
    // foot, a hop is what gets you on or off it.)
    // (Strafing on the spot in a fight isn't being stuck: its runs reverse when something stops them, updateStrafe; a
    // stuck recovery there only threw away its cover and route. Going somewhere, or backing off, is judged.)
    if ((this.checkStuck(view, this.meantToMove && (moveYaw !== null || backOff)) && (!me.climbing || me.grounded)) || this.jumpNext) {
      buttons |= BUTTON_JUMP;
      this.jumpNext = false;
    }
    // A parkour link's own presses only (no shot, scope, stance or stray hop while it runs and jumps).
    if (pk) buttons = (buttons & ~(BUTTON_JUMP | BUTTON_CROUCH | BUTTON_PRONE | BUTTON_SPRINT | BUTTON_FIRE | BUTTON_ZOOM | BUTTON_ALT)) | pk.buttons;
    // Getting in: use when close enough to the planned mount.
    if (this.state === 'mount' && this.mountPlan) {
      const m = view.mounts?.find((x) => x.index === this.mountPlan!.index);
      // (The match's own rule: near its centre or its hull, sim/mounts.ts enterReach.)
      if (m && inBoardingReach(m, me.pos) && tick - this.lastUseTick > 20) {
        buttons |= BUTTON_USE;
        this.lastUseTick = tick;
        this.boardTry ??= { index: m.index, tick };
        this.boarding.tries++;
      }
    }
    this.steerable = aimedTarget && wantFire && !sprint && !dodge && !throwNow && !pressNow && !this.throwPlan && !this.pressPlan && !this.holdStill && this.state !== 'mount' && !this.link;
    return { seq, forward, right, yaw: this.yaw, pitch: this.pitch, buttons, weapon: this.chooseWeapon(view, target) };
  }

  /**
   * A steering tick (big matches, a fighting bot between its full thinks:
   * Match.runBots): no new decisions or route, but perception runs when it is
   * due (so a bot notices as fast as when it thinks every tick), the aim keeps
   * tracking the target, the trigger discipline runs, and the move carries on
   * in the same direction over the ground. Null when the bot should think in
   * full: it wasn't simply aiming at its target, perception picked another
   * target or lost it, or a decision is due.
   */
  steer(view: BotWorldView): { forward: number; right: number; yaw: number; pitch: number; fire: boolean; zoom: boolean } | null {
    const me = view.self;
    if (!this.steerable || !me.alive || this.targetSlot === null) return null;
    const tick = view.tick;
    if ((tick + this.slot) % DECIDE_TICKS === 0) return null;
    // Under fire or hurt: think it over (take cover, turn to the shooter).
    if (me.health < this.lastHealth || (view.shotAt && tick - view.shotAt.tick <= 1)) return null;
    if ((tick + this.slot) % this.difficulty.perceptionIntervalTicks === 0) {
      const was = this.targetSlot;
      this.perceive(view);
      if (this.targetSlot !== was) return null;
    }
    let target: CombatantView | undefined;
    for (const o of view.others) {
      if (o.slot === this.targetSlot) {
        target = o;
        break;
      }
    }
    if (!target?.alive) return null;
    const ctx = this.aimContext(view);
    const ta = simProfile.on ? performance.now() : 0;
    const aimed = this.aimed;
    aimed.slot = target.slot;
    aimed.pos = target.pos;
    aimed.stance = this.aimStance(ctx.weapon, target) ?? 0;
    aimed.size = target.size ?? 1;
    this.aim.track(ctx, aimed);
    const sol = this.aim.solve(ctx, aimed);
    this.turnToward(sol.yaw, sol.pitch);
    const fire = this.aim.trigger(ctx, sol, this.yaw, this.pitch, this.reacted(view, target), this.shotCheck(view, ctx, sol, target));
    if (simProfile.on) simProfile.add('botAim', performance.now() - ta);
    this.lastTargetTick = tick;
    // The same smoothed movement over the ground, seen from the new facing.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const def = ctx.weapon;
    return { forward: sin * this.moveX + cos * this.moveZ, right: cos * this.moveX - sin * this.moveZ, yaw: this.yaw, pitch: this.pitch, fire, zoom: !!(def?.view.zoomFov && !def.alt && sol.dist > 7) };
  }

  /** Scratch for steer()'s aim target. */
  private readonly aimed: AimTarget = { slot: -1, pos: { x: 0, y: 0, z: 0 }, stance: 0, size: 1 };

  private sightCache = { tick: -Infinity, ok: false };

  /** Line of sight to a spot, rechecked a few times a second (it only steers the look). */
  private canSee(view: BotWorldView, eye: Vec3, p: Vec3): boolean {
    if (view.tick - this.sightCache.tick >= DECIDE_TICKS) {
      const at = { x: p.x, y: p.y + 1.2, z: p.z };
      this.sightCache = { tick: view.tick, ok: view.physics.lineOfSight(eye, at) && !(view.smoke && smokeBlocks(eye, at, view.smoke)) };
    }
    return this.sightCache.ok;
  }

  // ------------------------------------------------------------------ clear shot

  /** Trigger pulls held because the line was blocked (tests and the probe). */
  blockedShots = 0;
  /** No shooting from here: stand up / step aside to get a line on the target, until `until`. */
  private shotBlocked: { until: number; side: boolean } | null = null;
  private holdFireUntil = -Infinity;
  /** Last clear verdict: when, and the aim and position it was for. */
  private clearAt = { tick: -Infinity, yaw: 0, pitch: 0, x: 0, y: 0, z: 0 };
  private readonly clearCheck: () => boolean;
  private shotView: BotWorldView | null = null;
  private shotCtx: AimContext | null = null;
  private shotSol: AimSolution | null = null;
  private shotTarget: CombatantView | undefined = undefined;
  private readonly shotDir = { x: 0, y: 0, z: 0 };
  private readonly shotPoint = { x: 0, y: 0, z: 0 };

  /** The clear-shot check for this tick's trigger pull (asked by the aim model only when a round would go). */
  private shotCheck(view: BotWorldView, ctx: AimContext, sol: AimSolution, target: CombatantView | undefined): () => boolean {
    this.shotView = view;
    this.shotCtx = ctx;
    this.shotSol = sol;
    this.shotTarget = target;
    return this.clearCheck;
  }

  /**
   * Would a round fired now reach the target? One ray from the eye (where the
   * sim starts every shot) along the bot's aim, to just short of the aim
   * point. Blocked, the bot holds fire, and works out why with one or two more
   * rays: its wandering aim was on something beside or in front of a target in
   * the open (it corrects, as a person seeing their crosshair on a rock
   * would); only their upper body shows over low cover (it aims higher); or
   * nothing of them can be hit from here (it stands up, or steps aside, for a
   * moment). Lobbed rounds, melee, and shots at vehicles and gun emplacements
   * (their bodies are what it shoots) aren't checked.
   */
  private clearShot(): boolean {
    const view = this.shotView!;
    const ctx = this.shotCtx!;
    const sol = this.shotSol!;
    const target = this.shotTarget;
    const def = ctx.weapon;
    const proj = def?.projectile;
    if (!def || def.kind === 'melee' || (proj && proj.gravity > 0) || target?.mounted || target?.object) return true;
    const tick = view.tick;
    if (tick < this.holdFireUntil) return false;
    const margin = target ? Math.max(CLEAR_MARGIN, (proj?.splashRadius ?? 0) * 0.7) : SUPPRESS_MARGIN;
    const reach = sol.dist - margin;
    if (reach < 1) return true;
    const eye = ctx.eye;
    const c = this.clearAt;
    if (tick - c.tick < CLEAR_TTL && Math.abs(angleDelta(c.yaw, this.yaw)) < 0.02 && Math.abs(c.pitch - this.pitch) < 0.02 && Math.abs(c.x - eye.x) + Math.abs(c.y - eye.y) + Math.abs(c.z - eye.z) < 0.25) return true;
    // A little under the aim: rounds spread, and a line that only just grazes the top of a wall puts some into it.
    const pitch = this.pitch - CLEAR_UNDER;
    const cp = Math.cos(pitch);
    const dir = this.shotDir;
    dir.x = Math.sin(this.yaw) * cp;
    dir.y = Math.sin(pitch);
    dir.z = Math.cos(this.yaw) * cp;
    if (simProfile.on) simProfile.count('botClearShot');
    if (view.physics.raycastHit(eye, dir, reach) === null) {
      c.tick = tick;
      c.yaw = this.yaw;
      c.pitch = this.pitch;
      c.x = eye.x;
      c.y = eye.y;
      c.z = eye.z;
      return true;
    }
    this.blockedShots++;
    this.holdFireUntil = tick + BLOCKED_HOLD;
    c.tick = -Infinity;
    // Think it over in full next tick (big matches steer between thinks).
    this.steerable = false;
    if (!target) return false;
    // Why: is their body itself behind something, or only the aim?
    const size = target.size ?? 1;
    const height = STANCES[target.stance ?? 0].height * size;
    const p = this.shotPoint;
    p.x = target.pos.x;
    p.z = target.pos.z;
    p.y = target.pos.y + height * 0.6;
    if (view.physics.shotLine(eye, p)) {
      this.aim.correct();
      return false;
    }
    p.y = target.pos.y + height - 0.3 * size;
    if (view.physics.shotLine(eye, p)) {
      // Only head and shoulders over the cover: aim there for a while (and, crouched or prone, stand up
      // for a clearer line over it).
      this.aim.raise(tick + TICK_RATE * 1.5);
      this.aim.correct();
      if ((view.self.stance ?? 0) !== 0) this.shotBlocked = { until: tick + Math.round(TICK_RATE * (0.8 + (this.slot % 5) * 0.1)), side: false };
      return false;
    }
    // Nothing of them to hit from here: up from a crouch first; already standing, step aside.
    this.shotBlocked = { until: tick + Math.round(TICK_RATE * (0.8 + (this.slot % 5) * 0.1)), side: (view.self.stance ?? 0) === 0 };
    return false;
  }

  /** Searching and clearing at a walk, not a run (berserkers don't bother). */
  private careful(): boolean {
    if (this.methodical) return true;
    return !this.berserker && !this.arena && this.tactical > 0.3;
  }

  /**
   * Keeping watch (owner, 2026-11-06: "why would some bots not be moving at all?"): a bot holding a spot on
   * purpose (a CTF defender by its flag, an escort by the carrier, a bot told to hold, a squad member waiting on
   * the squad's next goal) doesn't stand like a statue. Every few seconds it walks to another place round the
   * spot (in sight of its middle, toward where the enemy comes from), watches that way with a slow sweep and a
   * glance over its shoulder now and then, turns to a threat it knows of, and crouches and stands up again
   * (peeking). One nav lookup and one sight line per new place; nothing else per tick but a few sums.
   */
  private keepWatch(view: BotWorldView, g: { pos: Vec3; radius: number; watch?: Vec3 | null }, brisk = false): { moveYaw: number | null; moveScale: number; stance: Stance } {
    const me = view.self.pos;
    const tick = view.tick;
    let w = this.watch;
    if (!w || tick >= w.until || horizontalDistance(w.spot, g.pos) > g.radius + 0.5) w = this.watch = this.watchSpot(view, g, w, brisk);
    // Where to look: a threat it knows of (shot at, an enemy that slipped away, a noise), else the way it watches.
    const recent = (t: number) => tick - t < TICK_RATE * 12;
    let look = w.yaw;
    if (this.threatFrom && recent(this.underFireTick)) look = Math.atan2(this.threatFrom.x - me.x, this.threatFrom.z - me.z);
    else if (this.lastKnown && recent(this.lastKnown.tick)) look = Math.atan2(this.lastKnown.pos.x - me.x, this.lastKnown.pos.z - me.z);
    else if (this.heard && recent(this.heard.tick)) look = Math.atan2(this.heard.pos.x - me.x, this.heard.pos.z - me.z);
    // A slow sweep across it, and now and then a glance over the shoulder.
    const t = tick + this.slot * 41;
    const glance = t % (TICK_RATE * 7) < TICK_RATE * 0.8 ? Math.PI * 0.7 * (this.slot % 2 ? 1 : -1) : 0;
    this.turnToward(look + Math.sin(t / 50) * 0.7 + glance, Math.sin(t / 90) * 0.05);
    let moveYaw = horizontalDistance(me, w.spot) > 0.5 ? this.followPathTo(view, w.spot, false) : null;
    // No way to that place after all: another next time, and no standing about waiting for a route meanwhile.
    if (moveYaw === null && this.pathMiss) {
      w.until = tick;
      this.pathMiss = false;
      moveYaw = null;
    }
    // Crouched now and then (careful bots longer), standing up again to look over things.
    const period = TICK_RATE * (4 + (this.slot % 3));
    const down = t % period < period * (this.careful() ? 0.55 : 0.3);
    // (Never in the air: crouching under a canopy cuts it away.)
    return { moveYaw, moveScale: 0.5, stance: moveYaw === null && down && view.self.grounded !== false ? 1 : 0 };
  }

  /** The last outOfReach answer: for which goal, until when, and the stand-in (null: reachable). */
  private reachMemo: { goal: Vec3; until: number; near: Vec3 | null } | null = null;

  /**
   * A goal no route reaches from where the bot is, which is in the main area (nothing to get off first): the place
   * as near it as a route gets (NavWorld.standIn, known per component of routes and goal for the match). Null when
   * a route reaches it, or the bot is off the main area (followPathTo's escapes and stand-ins see to that). Asked at
   * most every second for the same goal.
   */
  private outOfReach(view: BotWorldView, goal: Vec3): Vec3 | null {
    const m = this.reachMemo;
    if (m && view.tick < m.until && horizontalDistance(m.goal, goal) < 1.5 && Math.abs(m.goal.y - goal.y) < 1.5) return m.near;
    const me = view.self.pos;
    const si = view.self.grounded !== false && view.nav.inMain(me) ? view.nav.standIn(me, goal) : null;
    const near = si && !si.exact && (horizontalDistance(si.pos, goal) > 0.5 || Math.abs(si.pos.y - goal.y) > 1.5) ? si.pos : null;
    this.reachMemo = { goal: { ...goal }, until: view.tick + TICK_RATE, near };
    return near;
  }

  /** The next place to keep watch from: inside the area, on its floor, in sight of its middle, not where it just was. */
  private watchSpot(view: BotWorldView, g: { pos: Vec3; radius: number; watch?: Vec3 | null }, prev: { spot: Vec3 } | null, brisk = false): { spot: Vec3; until: number; yaw: number } {
    // (Gathering for a push: shifting about more, a short spell at each place.)
    const hold = brisk ? 1.5 + this.routeRng() * 2 : (this.methodical ? 6 : this.arena ? 2.5 : 4) + this.routeRng() * 5;
    const facing = g.watch ? Math.atan2(g.watch.x - g.pos.x, g.watch.z - g.pos.z) : null;
    let spot: Vec3 = { ...g.pos };
    let part: number | null | undefined;
    if (g.radius >= 1.5) {
      for (let i = 0; i < 3; i++) {
        // Toward the way the enemy comes when there is one, else anywhere round it.
        const a = facing !== null ? facing + (this.routeRng() - 0.5) * Math.PI * 1.3 : this.routeRng() * Math.PI * 2;
        const r = g.radius * (0.3 + this.routeRng() * 0.6);
        const p = view.nav.closestPoint({ x: g.pos.x + Math.sin(a) * r, y: g.pos.y + 0.5, z: g.pos.z + Math.cos(a) * r }, { x: 1.5, y: 2, z: 1.5 });
        if (!p || horizontalDistance(p, g.pos) > g.radius || Math.abs(p.y - g.pos.y) > 2) continue;
        if (prev && horizontalDistance(p, prev.spot) < 1.5) continue;
        // On the goal's own part of the navmesh (a ledge or a roof in sight of it is no place to walk to).
        if (part === undefined) part = view.nav.partAt(g.pos)?.id ?? null;
        if (view.nav.partAt(p)?.id !== part) continue;
        if (!view.physics.lineOfSight({ x: g.pos.x, y: g.pos.y + 1.2, z: g.pos.z }, { x: p.x, y: p.y + 1.2, z: p.z })) continue;
        spot = p;
        break;
      }
    }
    // Facing: the way the enemy comes, else outward from the middle, else the way it faces now.
    const yaw = facing ?? (horizontalDistance(spot, g.pos) > 0.5 ? Math.atan2(spot.x - g.pos.x, spot.z - g.pos.z) : this.yaw);
    return { spot, until: view.tick + Math.round(TICK_RATE * hold), yaw };
  }

  /** Where to retreat to: health close by, or the far side from the threat; re-picked only now and then. */
  private refuge(view: BotWorldView, threat: Vec3): Vec3 {
    const me = view.self.pos;
    const r = this.retreatGoal;
    if (!r || view.tick >= r.until || horizontalDistance(me, r.pos) < 1.5) {
      const pos = this.pickupGoal(view, 'health') ?? farthest(view.spawnPoints, threat) ?? me;
      this.retreatGoal = { pos: { ...pos }, until: view.tick + Math.round(TICK_RATE * (3.5 + this.rng() * 2)) };
    }
    return this.retreatGoal!.pos;
  }

  /**
   * Strafing: commit to a direction for a while (shorter, with the odd quick
   * juke, for better bots), then usually reverse; turn round straight away
   * when blocked.
   */
  private updateStrafe(tick: number): void {
    const id = this.difficulty.id;
    if (tick - this.lastStrafeTick > TICK_RATE / 2) {
      // A fresh strafe: either way.
      this.strafeDir = this.rng() < 0.5 ? -1 : 1;
      this.nextStrafeFlip = tick + this.strafeRun(id);
      this.strafeStart = tick;
    } else if (tick >= this.nextStrafeFlip || (tick - this.strafeStart > 18 && this.speed < 0.8)) {
      // Run over (or up against something): reverse, mostly.
      const blocked = tick < this.nextStrafeFlip;
      if (blocked || this.rng() < (id === 'hard' ? 0.8 : 0.7)) this.strafeDir = -this.strafeDir;
      this.nextStrafeFlip = tick + this.strafeRun(id);
      this.strafeStart = tick;
    }
    this.lastStrafeTick = tick;
  }

  /** Length (ticks) of one strafe run. */
  private strafeRun(id: BotDifficulty['id']): number {
    if (id === 'hard' && this.rng() < 0.2) return Math.round(TICK_RATE * (0.25 + this.rng() * 0.15));
    const [lo, span] = id === 'hard' ? [0.5, 0.8] : id === 'easy' ? [0.8, 0.9] : [0.6, 1.0];
    return Math.round(TICK_RATE * (lo + this.rng() * span));
  }

  /**
   * Ease the movement intent in and out (in world space, so turning doesn't
   * smear it) rather than snapping between directions each tick: no
   * stutter-steps. Better bots change direction more sharply; out of a
   * fight the easing is slight, so the bot keeps to its route round corners.
   */
  private smoothMove(forward: number, right: number, fighting: boolean): [number, number] {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = sin * forward + cos * right;
    const wz = cos * forward - sin * right;
    const tau = !fighting ? 0.035 : this.difficulty.id === 'hard' ? 0.06 : this.difficulty.id === 'easy' ? 0.12 : 0.09;
    const k = 1 - Math.exp(-TICK_DT / tau);
    this.moveX += (wx - this.moveX) * k;
    this.moveZ += (wz - this.moveZ) * k;
    if (wx === 0 && wz === 0 && hypot(this.moveX, this.moveZ) < 0.08) this.moveX = this.moveZ = 0;
    return [sin * this.moveX + cos * this.moveZ, cos * this.moveX - sin * this.moveZ];
  }

  private reacted(view: Pick<BotWorldView, 'tick'>, target: CombatantView): boolean {
    const since = this.visibleSince.get(target.slot);
    return since !== undefined && view.tick - since >= this.reactionTicks();
  }

  private wantsProne(view: BotWorldView, dist: number): boolean {
    const def = this.heldDef(view);
    const scoped = !!def?.view.zoomFov;
    // Snipers lie down at range; so do the most tactical bots with a scope on a long sightline.
    const sniper = hasTag(this.profile, 'SNIPER') || (this.methodical && this.tactical > 0.75 && scoped && dist > 28);
    return sniper && dist > 22 && (scoped || (def?.botRange[0] ?? 0) >= 10) && view.tick - this.underFireTick > TICK_RATE * 2;
  }

  /**
   * Behind cover: get there (sprinting if under fire), then alternate hiding
   * (crouched, reloading) and peeking (standing up over low cover or leaning
   * out past tall cover) to shoot.
   */
  private inCover(view: BotWorldView, threat: Vec3, def: WeaponDefinition | undefined): { moveYaw: number | null; sprint: boolean; stance: Stance; moveScale: number; shoot: boolean } {
    const me = view.self;
    const tick = view.tick;
    const c = this.cover!;
    const d = horizontalDistance(me.pos, c.pos);
    const underFire = tick - this.underFireTick < TICK_RATE * 1.2;
    if (d > 0.45 && !(this.peekPhase === 'peek' && c.peek !== 0 && d < 1.8)) {
      const moveYaw = this.followPathTo(view, c.pos, false);
      if (moveYaw === null) {
        this.cover = null;
        return { moveYaw: null, sprint: false, stance: 0, moveScale: 1, shoot: true };
      }
      const sprint = d > 2.5 && (underFire || this.hurt(view) || this.state === 'retreat');
      return { moveYaw, sprint, stance: 0, moveScale: 1, shoot: !sprint };
    }
    // At cover: alternate hiding and peeking. Shorter peeks while under fire.
    if (tick >= this.phaseUntil) {
      const aggr = this.profile.aggression / 100;
      if (this.peekPhase === 'hide') {
        this.peekPhase = 'peek';
        this.peeks++;
        this.phaseUntil = tick + Math.round(TICK_RATE * (0.7 + this.rng() * 0.9 + aggr * 0.6) * (underFire ? 0.75 : 1));
      } else {
        this.peekPhase = 'hide';
        this.phaseUntil = tick + Math.round(TICK_RATE * (0.6 + this.rng() * 0.8 + (1 - aggr) * 0.6));
      }
    }
    // Several peeks without sight of anyone: they've moved; go and look.
    if (tick - this.lastTargetTick > TICK_RATE * 2 && this.peeks > 2 && !underFire) {
      this.cover = null;
      return { moveYaw: null, sprint: false, stance: 0, moveScale: 1, shoot: false };
    }
    const reloading = !!view.reloading;
    const held = this.heldWeapon(view);
    const empty = !!held && held.def.magazine > 0 && held.mag === 0;
    const sniping = this.wantsProne(view, horizontalDistance(me.pos, threat)) && c.low;
    if (this.peekPhase === 'hide' || reloading || empty) {
      // Hidden: crouch (low cover hides a crouched body; tall cover hides anyone).
      return { moveYaw: d > 0.35 ? this.followPathTo(view, c.pos, false) : null, sprint: false, stance: 1, moveScale: 0.5, shoot: false };
    }
    // Peek.
    if (c.low) return { moveYaw: null, sprint: false, stance: sniping ? 1 : 0, moveScale: 1, shoot: true };
    if (c.peek !== 0) {
      const tx = c.threat.x - c.pos.x;
      const tz = c.threat.z - c.pos.z;
      const l = hypot(tx, tz) || 1;
      const lean = { x: c.pos.x + (tz / l) * c.peek * 1.1, y: c.pos.y, z: c.pos.z - (tx / l) * c.peek * 1.1 };
      const moveYaw = horizontalDistance(me.pos, lean) > 0.3 ? Math.atan2(lean.x - me.pos.x, lean.z - me.pos.z) : null;
      return { moveYaw, sprint: false, stance: 0, moveScale: 0.8, shoot: true };
    }
    // Hide-only spot: step out to fight when the peek comes round.
    this.cover = null;
    void def;
    return { moveYaw: null, sprint: false, stance: 0, moveScale: 1, shoot: true };
  }

  /** Fire at a spot where an enemy went out of sight (suppression). */
  private suppress(view: BotWorldView, pos: Vec3, ctx: AimContext): AimSolution | null {
    const aimAt = { x: pos.x, y: pos.y + 1.0, z: pos.z };
    const want = lookAngles(ctx.eye, aimAt);
    // Spray around the spot rather than at a point.
    const wob = 0.04 * Math.sin(view.tick * 0.21 + this.slot);
    const sol = { yaw: want.yaw + wob, pitch: want.pitch + wob * 0.3, dist: distance(ctx.eye, aimAt), halfAngle: 0.08 };
    this.turnToward(sol.yaw, sol.pitch);
    return sol;
  }

  // ------------------------------------------------------------------ corners and rooms

  /**
   * Before going round a corner or through a doorway the bot slows and looks
   * into the space beyond, sweeping across it ("pieing" the corner); once
   * through, it checks the room's corners in turn. Spaces it went through
   * recently are not re-checked.
   */
  private checkCorners(view: BotWorldView): { pause?: number; look?: Vec3 } {
    const me = view.self;
    const tick = view.tick;
    if (this.pie) {
      const p = this.pie;
      if (tick >= p.until) {
        this.pie = null;
        this.clearing = { corner: p.corner, yaw: Math.atan2(p.points[1]!.x - p.corner.x, p.points[1]!.z - p.corner.z), points: [], start: 0, until: tick + TICK_RATE * 6 };
      } else {
        // Sweep the points in turn, one side across to the other.
        const per = Math.max(1, (p.until - p.start) / p.points.length);
        const idx = clamp(Math.floor((tick - p.start) / per), 0, p.points.length - 1);
        const d = horizontalDistance(me.pos, p.corner);
        return { pause: d > 2 ? 0.3 : 0, look: p.points[idx] };
      }
    }
    if (this.clearing) {
      const c = this.clearing;
      if (c.points.length === 0) {
        // Wait until through the doorway / round the corner, then check the room.
        const d = horizontalDistance(me.pos, c.corner);
        const ahead = (me.pos.x - c.corner.x) * Math.sin(c.yaw) + (me.pos.z - c.corner.z) * Math.cos(c.yaw);
        if (tick > c.until || d > 8) {
          this.clearing = null;
          return {};
        }
        if (ahead < 0.6) return {};
        const eye = { x: me.pos.x, y: me.pos.y + 1.4, z: me.pos.z };
        const pts = fanPoints(view.physics, eye, c.yaw, 1.3, 4, 16);
        // The room's far corners first, then the near ones.
        c.points = [pts[0]!, pts[3]!, pts[1]!, pts[2]!];
        c.start = tick;
        c.until = tick + Math.round(TICK_RATE * (0.8 + this.tactical * 0.8));
      }
      if (tick < c.until) {
        const per = Math.max(1, (c.until - c.start) / c.points.length);
        const i = clamp(Math.floor((tick - c.start) / per), 0, c.points.length - 1);
        return { pause: 0.6, look: c.points[i] };
      }
      this.clearing = null;
      return {};
    }
    if (!this.careful() || (tick + this.slot) % 4 !== 0) return {};
    const c = this.path[this.pathIndex];
    if (!c) return {};
    const dc = horizontalDistance(me.pos, c);
    if (dc < 0.5) return {};
    const dirX = (c.x - me.pos.x) / dc;
    const dirZ = (c.z - me.pos.z) / dc;
    let at: Vec3 | null = null;
    let yawIn = 0;
    // A doorway a couple of metres ahead that opens into a space (not just a corridor).
    const probeD = Math.min(dc, 2.4);
    const probe = { x: me.pos.x + dirX * probeD, y: me.pos.y, z: me.pos.z + dirZ * probeD };
    const beyond = { x: probe.x + dirX * 1.8, y: probe.y, z: probe.z + dirZ * 1.8 };
    const doorKey = `d${Math.round(probe.x / 2)},${Math.round(probe.y)},${Math.round(probe.z / 2)}`;
    if (!this.recentlyChecked(doorKey, tick) && isDoorway(view.physics, probe, dirX, dirZ, 2.3) && !isDoorway(view.physics, beyond, dirX, dirZ, 2.8)) {
      this.markChecked(doorKey, tick);
      at = probe;
      yawIn = Math.atan2(dirX, dirZ);
    } else {
      // A sharp turn at the next corner of the route.
      const next = this.path[this.pathIndex + 1];
      const k = key(c);
      if (next && dc < 3.2 && !this.recentlyChecked(k, tick) && turnAngle(me.pos, c, next) > 0.75) {
        this.markChecked(k, tick);
        at = c;
        yawIn = Math.atan2(next.x - c.x, next.z - c.z);
      }
    }
    if (!at) return {};
    // Somewhere it has just been: no need to check again.
    const into = { x: at.x + Math.sin(yawIn) * 4, y: at.y, z: at.z + Math.cos(yawIn) * 4 };
    if (this.memory.ageSeconds(into, tick) < 20) return {};
    const pts = fanPoints(view.physics, { x: at.x, y: at.y + 1.4, z: at.z }, yawIn, 0.85, 4, 16);
    // Start from the side we can see least of from here.
    const side = Math.sign(angleDelta(Math.atan2(at.x - me.pos.x, at.z - me.pos.z), yawIn)) || 1;
    if (side > 0) pts.reverse();
    this.pie = { start: tick, until: tick + Math.round(TICK_RATE * (0.6 + this.tactical * 0.9)), points: pts, corner: { ...at } };
    return { pause: 0.3, look: pts[0] };
  }

  private recentlyChecked(k: string, tick: number): boolean {
    const last = this.checked.get(k);
    return last !== undefined && tick - last < TICK_RATE * 25;
  }

  private markChecked(k: string, tick: number): void {
    this.checked.set(k, tick);
    if (this.checked.size > 48) this.checked.delete(this.checked.keys().next().value!);
  }

  // ------------------------------------------------------------------ grenades

  /**
   * Throw a grenade to flush an enemy out of cover (last seen moments ago,
   * now hidden, in throwing range) or into a room it is about to clear where
   * an enemy was heard. The throw is solved so it lands there, not at the
   * door frame or the enemy's face.
   */
  private considerGrenade(view: BotWorldView, target: CombatantView | undefined): void {
    const tick = view.tick;
    if (this.throwPlan || tick < this.nextThrow || !(view.throwables ?? 0) || !view.throwable || view.throwable === 'mine' || view.throwable === 'sandbag' || view.throwable === 'smoke') return;
    if (this.rng() > 0.25 + this.tactical * 0.5) return;
    const me = view.self;
    const eye = { x: me.pos.x, y: me.pos.y + STANCES[me.stance ?? 0].eye, z: me.pos.z };
    // A walker (the sheep) goes its own way: thrown short, it waddles the rest of the way to them.
    const walking = THROWABLE_DEFS[view.throwable].projectile;
    if (walking.walker) return this.considerWalker(view, target, eye, walking);
    let at: Vec3 | null = null;
    if (!target && this.lastKnown && tick - this.lastKnown.tick > TICK_RATE * 0.6 && tick - this.lastKnown.tick < TICK_RATE * 5) {
      const d = horizontalDistance(me.pos, this.lastKnown.pos);
      if (d > 7 && d < 24 && !view.physics.lineOfSight(eye, { x: this.lastKnown.pos.x, y: this.lastKnown.pos.y + 1, z: this.lastKnown.pos.z })) at = this.lastKnown.pos;
    } else if (!target && this.heard && tick - this.heard.tick < TICK_RATE * 6 && this.pie) {
      const d = horizontalDistance(me.pos, this.heard.pos);
      if (d > 5.5 && d < 22) at = this.heard.pos;
    } else if (target && this.targetMount?.kind === 'vehicle' && (this.targetMount.speed ?? 0) < 3 && THROWABLE_DEFS[view.throwable].projectile.splashDamage >= ANTI_VEHICLE_SPLASH) {
      // An enemy vehicle stopped (or crawling) within throwing range: a grenade under it.
      const d = horizontalDistance(me.pos, this.targetMount.pos);
      if (d > 8 && d < 22) at = this.targetMount.pos;
    } else if (target && this.cover && this.peekPhase === 'hide') {
      // Pinned behind cover: lob one at them.
      const d = horizontalDistance(me.pos, target.pos);
      if (d > 9 && d < 22 && this.rng() < 0.15) at = target.pos;
    }
    if (!at || !grenadeWorthIt(view.throwables ?? 0, !!target, this.tactical)) return;
    const spec = THROWABLE_DEFS[view.throwable].projectile;
    const sol = solveThrow(view.physics, eye, at, spec);
    if (!sol) {
      this.nextThrow = tick + TICK_RATE;
      return;
    }
    // Don't throw if it would land close to ourselves; a big blast with a long fuse (the holy bomb: its 9 m blast is
    // as far as it can be thrown) lands at least half its blast away, and the thrower then runs clear of it.
    const near = horizontalDistance(sol.impact, me.pos);
    if (near < spec.splashRadius + 0.5) {
      if (spec.fuseSeconds < 2.5 || near < spec.splashRadius * 0.5) return;
      this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: tick + TICK_RATE, clear: sol.impact, fuse: spec.fuseSeconds };
      return;
    }
    this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: tick + TICK_RATE };
  }

  /**
   * A walker (the sheep: it lands, waddles on the way it was thrown, hops over low things and goes off on the first
   * enemy it meets) at an enemy in sight, or seen a moment ago, 6-20 m off across open ground: thrown short along the
   * line to them (its slow throw carries 5-6 m), it walks the rest before its fuse runs out.
   */
  private considerWalker(view: BotWorldView, target: CombatantView | undefined, eye: Vec3, spec: ProjectileSpec): void {
    const tick = view.tick;
    const me = view.self;
    const goal = target?.pos ?? (this.lastKnown && tick - this.lastKnown.tick < TICK_RATE * 3 ? this.lastKnown.pos : null);
    if (!goal || !grenadeWorthIt(view.throwables ?? 0, !!target, this.tactical)) return;
    const d = horizontalDistance(me.pos, goal);
    if (d < 6 || d > 20 || Math.abs(goal.y - me.pos.y) > 1.2) return;
    const reach = Math.min(d - 2, ((spec.speed * spec.speed) / spec.gravity) * 0.8);
    if (reach < 2.5 || (d - reach) / spec.walker!.speed > spec.fuseSeconds - 1.5) return;
    const land = { x: me.pos.x + ((goal.x - me.pos.x) / d) * reach, y: me.pos.y, z: me.pos.z + ((goal.z - me.pos.z) / d) * reach };
    // Open ground the whole way: a knee-high line from where it lands to them (it turns at walls, round nothing).
    if (!view.physics.lineOfSight({ x: land.x, y: land.y + 0.4, z: land.z }, { x: goal.x, y: goal.y + 0.4, z: goal.z })) {
      this.nextThrow = tick + TICK_RATE;
      return;
    }
    const sol = solveThrow(view.physics, eye, land, spec, 1.5);
    if (!sol) {
      this.nextThrow = tick + TICK_RATE;
      return;
    }
    this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: tick + TICK_RATE };
  }

  /**
   * A smoke screen (a smoke grenade carried): caught in the open by an enemy 10-45 m off (no cover, and hurt or shot
   * at), the bot throws one a few metres out toward it, so the cloud stands between them while it moves on or back:
   * the enemy loses sight of it (bots and turrets alike; rounds still pass). Tactical bots do it more. Bounding cover
   * to cover (Phase B, boundPhase), the moving half sends one ahead before it crosses open ground (docs/BOTS.md, "Smoke").
   */
  private considerSmoke(view: BotWorldView, target: CombatantView | undefined): void {
    const tick = view.tick;
    if (view.throwable !== 'smoke' || !(view.throwables ?? 0) || this.throwPlan || tick < this.nextThrow || !target || this.cover) return;
    // Its half on the move with no cover round it (it left cover for one further on, or there is none): smoke first, so
    // the open ground it crosses is out of the enemy's sight. (No dice: bounding, a bot carrying smoke always uses it.)
    if (this.bound === 'move' && !view.reloading) {
      this.smokeScreen(view, target.pos);
      return;
    }
    const me = view.self;
    const shot = !!view.shotAt && tick - view.shotAt.tick < TICK_RATE * 1.5;
    if (me.health >= 70 && !shot) return;
    if (this.rng() > 0.3 + this.tactical * 0.5) return;
    this.smokeScreen(view, target.pos);
  }

  /** Throw smoke a few metres out toward `threat` (the cloud's middle between the bot and it); false when it can't. */
  smokeScreen(view: BotWorldView, threat: Vec3): boolean {
    const me = view.self;
    const d = horizontalDistance(me.pos, threat);
    if (view.throwable !== 'smoke' || !(view.throwables ?? 0) || d < 10 || d > 45) return false;
    const k = 5.5 / d;
    const at = { x: me.pos.x + (threat.x - me.pos.x) * k, y: me.pos.y, z: me.pos.z + (threat.z - me.pos.z) * k };
    const eye = { x: me.pos.x, y: me.pos.y + STANCES[me.stance ?? 0].eye, z: me.pos.z };
    const sol = solveThrow(view.physics, eye, at, THROWABLE_DEFS.smoke.projectile, 2.5);
    if (!sol) {
      this.nextThrow = view.tick + TICK_RATE;
      return false;
    }
    this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: view.tick + TICK_RATE };
    return true;
  }

  // ------------------------------------------------------------------ turrets and vehicles

  /** Carries something that hurts vehicles properly: a launcher with rounds, or a grenade with a big blast. */
  private canHurtVehicles(view: BotWorldView): boolean {
    for (const w of view.inventory) if (antiVehicle(w.def) && w.mag + w.reserve > 0) return true;
    const t = view.throwable;
    return !!t && t !== 'mine' && t !== 'sandbag' && (view.throwables ?? 0) > 0 && THROWABLE_DEFS[t].projectile.splashDamage >= ANTI_VEHICLE_SPLASH;
  }

  /**
   * An enemy vehicle seen lately (or in sight, not too close) and nothing
   * that hurts it: go for a launcher lying close by. True when it set off.
   */
  private fetchLauncher(view: BotWorldView, target: CombatantView | undefined): boolean {
    const tick = view.tick;
    if (tick - this.vehicleSeenTick > TICK_RATE * VEHICLE_MEMORY || view.orderGoal) return false;
    // Fighting someone on foot, or a vehicle right on top of us: fight (or dodge) first.
    if (target && (this.targetMount?.kind !== 'vehicle' || horizontalDistance(view.self.pos, target.pos) < 15)) return false;
    const p = this.pickupGoal(view, 'weapon', LAUNCHER_DETOUR, antiVehicle);
    if (!p) return false;
    this.roamGoal = p;
    this.gunNearby = p;
    this.via = null;
    return true;
  }

  /** How long (ticks) this bot takes to react to something it sees. */
  private reactionTicks(): number {
    return (this.difficulty.reactionMs / 1000) * TICK_RATE * (1.5 - this.profile.reactionSpeed / 100);
  }

  /**
   * An enemy vehicle bearing down on the bot (driven at it, or just coming
   * its way): step out of its path, after its reaction time, if it notices
   * at all (easier bots often don't). Arithmetic only, at decision rate; one
   * sight ray when a dodge starts, to pick a side with room.
   */
  private watchTraffic(view: BotWorldView): void {
    const tick = view.tick;
    if (this.dodge && tick >= this.dodge.until) this.dodge = null;
    const mounts = view.mounts;
    if (!mounts?.length) {
      this.roadkill = null;
      return;
    }
    const me = view.self;
    const hostile = slotsOf(view.others);
    let worst: MountView | null = null;
    let hit: { eta: number; away: number } | null = null;
    for (const m of mounts) {
      if (m.kind !== 'vehicle' || !m.alive || (m.speed ?? 0) < ROADKILL_SPEED) continue;
      let enemyAboard = false;
      for (const s of m.seats) if (s.role === 'driver' && s.by !== undefined && hostile.has(s.by)) enemyAboard = true;
      if (!enemyAboard) continue;
      const h = inVehiclePath(m, me.pos);
      if (h && (!hit || h.eta < hit.eta)) {
        worst = m;
        hit = h;
      }
    }
    if (!worst || !hit) {
      this.roadkill = null;
      return;
    }
    if (this.roadkill?.index !== worst.index) this.roadkill = { index: worst.index, since: tick, notice: this.rng() < 0.4 + 0.6 * this.difficulty.tactics };
    if (!this.roadkill.notice || tick - this.roadkill.since < this.reactionTicks()) return;
    let yaw = hit.away;
    if (!this.dodge && hit.eta > 1.5) {
      // A wall that side: the other side, while there is time to cross.
      const chest = { x: me.pos.x, y: me.pos.y + 1, z: me.pos.z };
      if (!view.physics.lineOfSight(chest, { x: chest.x + Math.sin(yaw) * 3, y: chest.y, z: chest.z + Math.cos(yaw) * 3 })) yaw += Math.PI;
    } else if (this.dodge) yaw = this.dodge.yaw;
    this.dodge = { yaw, until: tick + Math.round(TICK_RATE * DODGE_SECONDS), sprint: hit.eta < DODGE_SPRINT_ETA };
  }

  /** Explosives at an enemy in a vehicle go at the hull (low), not at the head poking out of it. */
  private aimStance(def: WeaponDefinition | undefined, t: CombatantView): Stance | undefined {
    return def && this.targetMount && t.slot === this.targetSlot && antiVehicle(def) ? 2 : t.stance;
  }

  /**
   * Leave mount `index` alone for a while (stuck in it, couldn't reach it, couldn't get in): each time it gives up on
   * the same one it stays away twice as long (avoidSeconds), so a vehicle nobody can use stops drawing it back.
   */
  private giveUpOn(index: number, tick: number): void {
    // Already leaving it alone (the stuck checks run every tick until it is out): once per give-up.
    if ((this.avoidMounts.get(index) ?? -Infinity) > tick) return;
    const n = (this.giveUps.get(index) ?? 0) + 1;
    this.giveUps.set(index, n);
    this.avoidMounts.set(index, tick + Math.round(TICK_RATE * avoidSeconds(n)));
    this.boardFails.delete(index);
    if (this.boardTry?.index === index) this.boardTry = null;
    this.boarding.gaveUp++;
  }

  private considerMount(view: BotWorldView, target: CombatantView | undefined): void {
    const mounts = view.mounts;
    if (!mounts?.length || this.mountPlan || hasTag(this.profile, 'NPC') || view.tick < this.nextMountTick) return;
    if ((view.tick + this.slot * 7) % (TICK_RATE / 2) >= DECIDE_TICKS) return;
    const me = view.self;
    // A teammate driving by with a seat free: hop in (unless on station somewhere it was sent, or in a close fight).
    const g = view.orderGoal;
    const onStation = !!g && horizontalDistance(me.pos, g.pos) < g.radius + 8;
    const ride = view.allies?.length ? rideFor(mounts, me.pos, me.slot, view.allies, RIDE_REACH, this.skipMount) : null;
    if (ride && !(onStation && horizontalDistance(g!.pos, ride.pos) > g!.radius + 4)) {
      const close = target && horizontalDistance(me.pos, target.pos) < 12 && horizontalDistance(me.pos, ride.pos) > 6;
      if (!close && this.rng() < 0.6 + (this.profile.teamLoyalty / 100) * 0.4) {
        this.mountPlan = { index: ride.index, until: view.tick + TICK_RATE * 8, drive: false, ride: true };
        if (this.giveUps.has(ride.index)) this.boarding.back++;
        this.state = 'mount';
        return;
      }
    }
    const enemy = target?.pos ?? (this.lastKnown && view.tick - this.lastKnown.tick < TICK_RATE * 4 ? this.lastKnown.pos : null);
    if (enemy) {
      // A turret covering the enemy, closer to us than they are.
      if (target && horizontalDistance(me.pos, target.pos) < 12) return;
      const m = turretFor(mounts, me.pos, enemy, Math.min(14, horizontalDistance(me.pos, enemy) * 0.6), this.skipMount);
      if (m && this.rng() < 0.4 + this.tactical * 0.6) {
        this.mountPlan = { index: m.index, until: view.tick + TICK_RATE * 6, drive: false };
        if (this.giveUps.has(m.index)) this.boarding.back++;
        this.state = 'mount';
      }
      return;
    }
    // Worth a drive only for a long trip: the current goal if it is far, else the push to the far side.
    let goal = this.roamGoal ?? view.orderGoal?.pos ?? null;
    if (!view.orderGoal && (!goal || horizontalDistance(me.pos, goal) < VEHICLE_TRIP)) {
      // A gun close by comes first.
      if (bestLoadedDesirability(view.inventory) <= SIDEARM && this.pickupGoal(view, 'weapon', GUN_DETOUR)) return;
      goal = farthest(view.spawnPoints, me.pos) ?? goal;
    }
    if (!goal) return;
    const v = vehicleFor(mounts, me.pos, goal, 22, this.skipMount);
    if (v && this.rng() < 0.5) {
      // Drive only along an open route (no long detours).
      // A boat (a vehicle that rides on water) may head straight across instead (see thinkMounted).
      const route = view.nav.findPath(v.pos, goal);
      if (!route && !v.floats) return;
      if (route && pathLength(route) > horizontalDistance(v.pos, goal) * 1.5 && !v.floats) return;
      this.roamGoal = { ...goal };
      this.via = null;
      this.mountPlan = { index: v.index, until: view.tick + TICK_RATE * 8, drive: true };
      if (this.giveUps.has(v.index)) this.boarding.back++;
      this.state = 'mount';
    }
  }

  /** In a turret or vehicle. */
  private thinkMounted(view: BotWorldView, seq: number, target: CombatantView | undefined, ctx: AimContext): PlayerInput {
    const tick = view.tick;
    const seat = view.seat!;
    const m = view.mounts?.find((x) => x.index === seat.mount);
    if (this.state !== 'mounted') {
      this.state = 'mounted';
      this.mountedSince = tick;
      // In: whatever it tried before at this one worked in the end.
      this.boardTry = null;
      this.boardFails.delete(seat.mount);
      this.giveUps.delete(seat.mount);
      this.drive = freshDrive();
      this.useLatch = true;
      this.path = [];
      this.goal = null;
      this.moveX = this.moveZ = 0;
      this.rideIdleSince = this.noDriverSince = -Infinity;
      this.bailDelay = Math.round(TICK_RATE * (0.35 + this.rng() * 0.5));
      this.riderHeadway = { pos: null, tick: 0 };
      this.driveLeft = { left: Infinity, tick };
      this.dodge = null;
      this.roadkill = null;
    }
    this.mountPlan = null;
    let forward = 0;
    let right = 0;
    let buttons = 0;
    let leave = false;
    const gunCtx: AimContext = { ...ctx, weapon: seat.weapon ?? ctx.weapon, steady: !!seat.weapon, speed: 0, stance: 0 };
    const armed = !!seat.weapon || seat.role === 'passenger';
    const inSeatArc = (p: Vec3) => !m || inArc(m, seat, p) || (!seat.weapon && seat.role === 'passenger');
    let fireAt: CombatantView | undefined = target && armed && inSeatArc(target.pos) ? target : undefined;
    if (seat.role === 'driver' && m) {
      const goal = this.roamGoal ?? view.orderGoal?.pos ?? farthest(view.spawnPoints, m.pos) ?? m.pos;
      const left = horizontalDistance(m.pos, goal);
      if (!this.goal || horizontalDistance(this.goal, goal) > 3 || tick - this.lastPathTick > TICK_RATE * 2) {
        this.goal = { ...goal };
        this.path = view.nav.findPath(m.pos, goal) ?? [];
        // On water the navmesh has no route (or only the long way round the shore): straight across, then up the bank.
        if (m.floats && (this.path.length < 2 || pathLength(this.path) > left * 1.5)) this.path = [];
        this.pathIndex = 1;
        this.lastPathTick = tick;
      }
      // Look ahead along the route.
      while (this.pathIndex < this.path.length - 1 && horizontalDistance(m.pos, this.path[this.pathIndex]!) < 6) this.pathIndex++;
      // A route or road running our way (not for boats): drive along it, a point ahead on the line.
      const guided = view.guides?.length && !m.floats ? followGuide(view.guides, m.pos, m.yaw, goal, m.speed ?? 0) : null;
      const aimPt = guided?.aim ?? this.path[this.pathIndex] ?? goal;
      let ctl = steer(this.drive, tick, m, aimPt, left);
      // Its speed hint: off the throttle above it.
      if (guided?.speed && (m.speed ?? 0) > guided.speed) ctl = { ...ctl, forward: Math.min(ctl.forward, 0) };
      // An armed pilot (forward guns) turns onto targets in front.
      if (seat.weapon && target && horizontalDistance(m.pos, target.pos) < 45) {
        ctl = steer(this.drive, tick, m, target.pos, 30);
        fireAt = inArc(m, seat, target.pos) ? target : undefined;
      }
      forward = ctl.forward;
      right = ctl.right;
      if (!fireAt) {
        const a = Math.atan2(aimPt.x - m.pos.x, aimPt.z - m.pos.z);
        this.turnToward(a, 0);
      }
      // Getting nowhere while moving (circling a spot it can't drive out of, a shore a boat can't climb): the route
      // left must shrink by DRIVE_MIN_PROGRESS m every DRIVE_PROGRESS_SECONDS, or it gives up like a stuck one. (The
      // stuck check only catches a vehicle standing or grinding in place; riders now stay aboard, so a circling
      // driver would take them round and round.)
      const routeLeft = this.path.length > 1 ? pathLength(this.path) : left;
      if (tick - this.driveLeft.tick >= TICK_RATE * DRIVE_PROGRESS_SECONDS) {
        if (!fireAt && routeLeft > this.driveLeft.left - DRIVE_MIN_PROGRESS) this.drive.stuck = true;
        this.driveLeft = { left: routeLeft, tick };
      } else if (this.driveLeft.left === Infinity) this.driveLeft = { left: routeLeft, tick };
      // Get out: arrived, about to blow (or on fire), stuck for good (a back-out didn't free it), or a fight with no gun.
      if (left < 14 || aboutToBlow(m) || this.drive.stuck || (target && !seat.weapon && horizontalDistance(m.pos, target.pos) < 22)) leave = true;
      // Don't climb straight back into the one that got stuck.
      if (this.drive.stuck) this.giveUpOn(m.index, tick);
    } else if (m && m.kind === 'vehicle') {
      // Riding along: stay while a teammate drives; get out when they do, when it is about to blow (or on fire),
      // when a bot at the wheel has got it stuck, or when it has sat parked a while with nothing to shoot.
      if (fireAt) this.lastTargetTick = tick;
      const driver = m.seats.find((s) => s.role === 'driver')?.by;
      const ally = driver !== undefined && driver !== view.self.slot ? view.allies?.find((a) => a.slot === driver) : undefined;
      const driven = !!ally;
      if (driven) this.noDriverSince = -Infinity;
      else if (this.noDriverSince === -Infinity) this.noDriverSince = tick;
      if ((m.speed ?? 0) > 0.5 || fireAt) this.rideIdleSince = -Infinity;
      else if (this.rideIdleSince === -Infinity) this.rideIdleSince = tick;
      // (rideIdleSince is -Infinity while it moves: only a vehicle that has actually stood still 8 s is parked. Testing
      // the gap alone read every moving vehicle as parked for good, and riders got out as soon as the driver set off.)
      const parked = this.rideIdleSince !== -Infinity && tick - this.rideIdleSince > TICK_RATE * RIDE_PARKED_SECONDS && tick - this.lastTargetTick > TICK_RATE * 4;
      // (A human at the wheel may stop on purpose; a bot driver never parks with riders.)
      const stuck = driven && !ally.human && noHeadway(this.riderHeadway, m.pos, tick, RIDER_STUCK_TICKS, RIDER_MIN_PROGRESS);
      if (stuck) this.giveUpOn(m.index, tick);
      if ((!driven && tick - this.noDriverSince >= this.bailDelay) || aboutToBlow(m) || parked || stuck) leave = true;
      if (!fireAt) this.turnToward(m.yaw, 0);
    } else if (m) {
      // Gunner: stay while there is something to shoot.
      if (fireAt) this.lastTargetTick = tick;
      const idle = tick - Math.max(this.lastTargetTick, this.mountedSince) > TICK_RATE * 7;
      const flanked = target && !inSeatArc(target.pos) && horizontalDistance(m.pos, target.pos) < 12;
      if (idle || m.health < 0.3 || flanked) leave = true;
      if (!fireAt) this.turnToward(m.yaw + (seat.facing ?? 0), 0);
    }
    if (fireAt) {
      const sol = this.aim.solve(gunCtx, { slot: fireAt.slot, pos: fireAt.pos, stance: this.aimStance(gunCtx.weapon, fireAt) });
      this.turnToward(sol.yaw, sol.pitch);
      const cool = !seat.overheated && seat.heat < 0.85;
      if (cool && this.aim.trigger(gunCtx, sol, this.yaw, this.pitch, this.reacted(view, fireAt))) buttons |= BUTTON_FIRE;
    }
    if (leave && tick - this.mountedSince > TICK_RATE && !this.useLatch) buttons |= BUTTON_USE;
    this.useLatch = (buttons & BUTTON_USE) !== 0;
    if (leave) this.nextMountTick = tick + TICK_RATE * 10;
    return { seq, forward, right, yaw: this.yaw, pitch: this.pitch, buttons };
  }

  private nextMountTick = 0;

  // ------------------------------------------------------------------ weapons and items

  private heldCache: { view: SteerView | null; w: InventoryView | undefined } = { view: null, w: undefined };

  private heldWeapon(view: SteerView): InventoryView | undefined {
    if (this.heldCache.view !== view) this.heldCache = { view, w: view.inventory.find((w) => weaponCode(w.def) === view.held) };
    return this.heldCache.w;
  }

  /**
   * Best owned weapon with ammo for the current distance: data-driven via each
   * weapon's desirability and range band, nudged by personality (range
   * preference, explosives fans, favourite weapons) and avoiding splash
   * damage up close. An empty gun in a close fight: draw another rather than
   * reload in the open.
   */
  private chooseWeapon(view: BotWorldView, target: CombatantView | undefined): number {
    const dist = target ? distance(view.self.pos, target.pos) : this.lastKnown ? Math.min(30, distance(view.self.pos, this.lastKnown.pos)) : 15;
    const others = view.inventory.filter((w) => w.def.magazine === 0 || w.mag > 0).length;
    let best = view.held;
    let bestScore = -Infinity;
    for (const w of view.inventory) {
      const score = weaponScore(w, { dist, target, held: weaponCode(w.def) === view.held, loadedElsewhere: others - (w.def.magazine === 0 || w.mag > 0 ? 1 : 0) > 0, profile: this.profile, vehicle: !!target && this.targetMount?.kind === 'vehicle' });
      if (score > bestScore) {
        bestScore = score;
        best = weaponCode(w.def);
      }
    }
    return best;
  }

  /**
   * The most worthwhile available pickup, if any is worth the detour. Value
   * depends on need (health/armor missing, weapon not owned, ammo low) and the
   * bot's item greed, discounted by distance.
   */
  private pickupGoal(view: BotWorldView, only?: 'health' | 'weapon', within = Infinity, weapons?: (def: WeaponDefinition) => boolean): Vec3 | null {
    for (let tries = 0; tries < 3; tries++) {
      const pick = this.bestPickup(view, only, within, weapons);
      // One no route gets within reach of (on a crate, on a ledge): left alone for a good while, and the next best.
      if (!pick || this.collectable(view, pick.pos)) return pick?.pos ?? null;
      this.losePickup(view, pick.pos);
    }
    return null;
  }

  /**
   * Whether a route gets the bot within reach of picking up what's at `pos` (on a crate it can't climb: beside it, close
   * enough), and back: not one in a trap seen from the main area (a perch a jump pad throws you onto with no way down,
   * Skyward's and Sky Islands'; a pit), where the bot would stand for the rest of its life.
   */
  private collectable(view: BotWorldView, pos: Vec3): boolean {
    const si = view.nav.standIn(view.self.pos, pos);
    // (Off the navmesh: no telling from here; the route's own checks see to it.)
    if (si?.exact && !view.nav.inMain(pos) && view.nav.inMain(view.self.pos)) return false;
    return !si || si.exact || (horizontalDistance(si.pos, pos) < STEP_OFF && Math.abs(si.pos.y - pos.y) < 1.4);
  }

  private bestPickup(view: BotWorldView, only?: 'health' | 'weapon', within = Infinity, weapons?: (def: WeaponDefinition) => boolean): { pos: Vec3; score: number } | null {
    const me = view.self;
    let best: { pos: Vec3; score: number } | null = null;
    const owned = new Map(view.inventory.map((w) => [w.def.id, w]));
    const bestOwned = bestLoadedDesirability(view.inventory);
    for (const p of view.pickups) {
      // Arena bots time the respawns: head for an item that will be back by the time they get there.
      const timed = this.arena && p.respawnIn !== undefined && p.respawnIn < horizontalDistance(me.pos, p.pos) / 5 + 1;
      if (!p.available && !timed) continue;
      if (this.lostPickups.length && this.pickupLost(p.pos)) continue;
      const e = p.item.effect;
      if (only && e.kind !== only) continue;
      if (weapons && (e.kind !== 'weapon' || !weapons(getWeapon(e.weapon)))) continue;
      let need = pickupNeed(e, me, view.inventory, owned, view.throwables ?? 0, view.throwable ?? null);
      if (need <= 0) continue;
      // A new gun is worth what it adds: a rifle to a bot holding a pistol, far more than a second SMG.
      if (e.kind === 'weapon' && !owned.has(e.weapon)) need *= clamp(1 + (getWeapon(e.weapon).botDesirability - bestOwned) * 2.5, 0.4, 2);
      const greed = 0.3 + (this.profile.itemGreed / 100) * 1.2;
      const d = horizontalDistance(me.pos, p.pos) + Math.abs(me.pos.y - p.pos.y) * 2;
      if (d > within) continue;
      const score = (p.item.botValue * need * greed) / (1 + d / 20);
      if (score > 0.12 && (!best || score > best.score)) best = { pos: p.pos, score };
    }
    return best ? { pos: { ...best.pos }, score: best.score } : null;
  }

  /** `goal` is a pickup this bot can't get to (stuck on the way, or no way there): leave it alone for a good while. */
  private losePickup(view: BotWorldView, goal: Vec3): void {
    if (!view.pickups.some((p) => horizontalDistance(p.pos, goal) < 0.5)) return;
    if (this.lostPickups.length >= 8) this.lostPickups.shift();
    this.lostPickups.push({ pos: { ...goal }, until: view.tick + TICK_RATE * PICKUP_GIVE_UP_SECONDS });
  }

  /** Within pickup reach of an item still lying at `pos`: the match already offered it and it wasn't taken. */
  private refused(view: BotWorldView, pos: Vec3): boolean {
    const me = view.self.pos;
    if (horizontalDistance(me, pos) > PICKUP_RADIUS || Math.abs(me.y - pos.y) > 1.5) return false;
    return view.pickups.some((p) => p.available && horizontalDistance(p.pos, pos) < 0.5);
  }

  /** A pickup at `pos` this bot gave up on (stuck going for it) and still leaves alone. */
  private pickupLost(pos: Vec3): boolean {
    const list = this.lostPickups;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]!.until <= this.lastThinkTick) list.splice(i, 1);
      else if (horizontalDistance(list[i]!.pos, pos) < 1.5) return true;
    }
    return false;
  }

  /**
   * Where to advance next: in team modes the enemy's side of the map (by one
   * of several routes, so teammates spread out); otherwise the places it
   * hasn't checked lately.
   */
  private pickAdvanceGoal(view: BotWorldView): void {
    // Only somewhere a route gets to from here (a region's spot on a roof, an enemy spawn up a one-way drop: another
    // pick), and a lane waypoint only if a route gets to it too. (Before, such goals were searched for, failed and
    // were dropped a think later, or stood at.)
    const me = view.self.pos;
    for (let tries = 0; tries < 3; tries++) {
      this.pickAdvanceGoalNow(view);
      if (!this.roamGoal || view.nav.reachable(me, this.roamGoal)) break;
    }
    if (this.via && !view.nav.reachable(me, this.via)) this.via = null;
  }

  private pickAdvanceGoalNow(view: BotWorldView): void {
    const me = view.self;
    const pts = view.spawnPoints;
    const places = view.nav.mainPlaces();
    this.via = null;
    this.roamRoute = null;
    const plan = view.plan;
    if (plan?.regions && !view.orderGoal) {
      // The side's knowledge: regions nobody has been to lately, toward the enemy, not crowded with teammates;
      // each bot its own taste (explorers range far, lone wolves keep away from the rest) and its own route.
      const lone = plan.role === 'lone_wolf';
      const explore = this.profile.exploration / 100;
      const o = { from: me.pos, tick: view.tick, rng: this.routeRng, ideal: 25 + explore * 50 + (lone ? 20 : 0), novelty: hasTag(this.profile, 'EXPLORER') ? 2 : 0.7 + explore, crowd: lone ? 2.5 : hasTag(this.profile, 'GRUNT') ? 0.2 : 0.8, towards: plan.towards, push: lone ? 1 : 1.7 - explore * 0.6, contact: lone ? 0.3 : 1 - explore * 0.4, memory: this.memory };
      // Team modes: often (more often the more aggressive) straight for the enemy's side, as before, by its own route;
      // otherwise somewhere the side hasn't been. Fights keep happening; the map gets used.
      const push = !lone && !!plan.towards?.length && this.routeRng() < 0.3 + this.profile.aggression / 250;
      let pick = push ? { pos: { ...plan.towards![Math.floor(this.routeRng() * plan.towards!.length)]! }, region: -1 } : plan.regions.pick(o);
      const av = this.avoid;
      if (pick && av && view.tick < av.until && horizontalDistance(pick.pos, av.pos) < 6) pick = plan.regions.pick(o);
      if (pick) {
        this.roamGoal = pick.pos;
        // Straight for the enemy's side: by the cheapest corridor of the side's trip there now (teammates on it, and
        // deaths and sightings near it, priced in: loose bots spread over the ways by themselves).
        const route = push ? cheapestRoute(plan.trips, pick.pos, this.routeRng) : null;
        if (route) {
          this.roamRoute = { c: route, goal: { ...pick.pos } };
          return;
        }
        const r = this.routeRng();
        // Lone wolves flank wide; the rest take the left, the right or the straight way.
        const lane = lone ? (r < 0.5 ? -1.6 : 1.6) : r < 0.35 ? -1 : r < 0.7 ? 1 : 0;
        if (lane !== 0) this.via = laneWaypoint(places, me.pos, pick.pos, lane);
        return;
      }
    }
    if (this.rng() * 100 < this.profile.exploration * 0.6 || pts.length === 0) {
      this.roamGoal = pickExploreGoal(places, pts, me.pos, this.memory, view.tick, this.rng, this.profile.exploration) ?? { ...(pts[0] ?? me.pos) };
    } else {
      this.roamGoal = { ...pts[Math.floor(this.rng() * pts.length)]! };
    }
    // Spread over the routes: a lane per bot.
    const lane = (this.slot % 3) - 1;
    if (lane !== 0 && this.roamGoal) this.via = laneWaypoint(places, me.pos, this.roamGoal, lane);
  }

  // ------------------------------------------------------------------ perception

  private perceive(view: BotWorldView): void {
    this.lastPerceiveTick = view.tick;
    if (!simProfile.on) return this.perceiveNow(view);
    const t0 = performance.now();
    this.perceiveNow(view);
    simProfile.add('botPerceive', performance.now() - t0);
    simProfile.count('botPerceive');
  }

  private perceiveNow(view: BotWorldView): void {
    const me = view.self;
    const tick = view.tick;
    const myEye = this.eyeAt;
    myEye.x = me.pos.x;
    myEye.y = me.pos.y + STANCES[me.stance ?? 0].eye * (me.size ?? 1);
    myEye.z = me.pos.z;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.memory.mark(me.pos, tick);
    // Who could be seen (in range, in view or close enough to hear, not hidden in a bush), nearest first. A sniper on
    // its spot with the scope up: further, within the scope's view.
    const live = this.live;
    live.length = 0;
    const held = this.post?.kind === 'sniper' ? this.heldDef(view) : undefined;
    const sight = held && this.sniping(view, held) ? Math.max(SIGHT_RANGE, Math.min(SCOPE_SIGHT, held.botRange[1])) : SIGHT_RANGE;
    for (const o of view.others) {
      if (!o.alive) continue;
      const ox = o.pos.x - me.pos.x;
      const oy = o.pos.y - me.pos.y;
      const oz = o.pos.z - me.pos.z;
      const d2 = ox * ox + oy * oy + oz * oz;
      if (d2 >= sight * sight) continue;
      const d = Math.sqrt(d2);
      const range = sight * STANCE_SIGHT[o.stance ?? 0];
      if (d > range && !this.visibleSince.has(o.slot)) continue;
      const dx = ox / (d || 1);
      const dz = oz / (d || 1);
      const ahead = dx * fx + dz * fz;
      const inFov = ahead >= FOV_COS * Math.sqrt(dx * dx + dz * dz);
      if (!inFov && d > HEARING_RANGE) continue;
      if (d > SIGHT_RANGE && ahead < SCOPE_COS * Math.sqrt(dx * dx + dz * dz)) continue;
      // Someone hiding in a bush is only spotted close by (a little further once already being tracked).
      if (o.concealed && d > (this.visibleSince.has(o.slot) ? CONCEAL_TRACK : CONCEAL_SPOT)) continue;
      const c = this.pool[live.length] ?? (this.pool[live.length] = { o, dx: 0, dz: 0, score: 0, checked: false });
      c.o = o;
      c.dx = dx;
      c.dz = dz;
      // Stick with the current target unless another is much closer.
      c.score = d * (o.slot === this.targetSlot ? 0.7 : 1);
      c.checked = false;
      live.push(c);
    }
    if (live.length > 1) live.sort(byScore);
    // Sight lines, nearest first: the first one clear is the target. A crowd costs a ray each, so
    // after the target only a few more (enemies already tracked keep their reaction time),
    // and without one at most SIGHT_SEARCH.
    let best: Candidate | null = null;
    let rays = 0;
    const theirEye = this.eyeTo;
    for (const c of live) {
      if (view.crowded && rays >= (best ? SIGHT_TRACK : SIGHT_SEARCH)) break;
      const o = c.o;
      theirEye.x = o.pos.x;
      theirEye.y = o.pos.y + STANCES[o.stance ?? 0].eye * (o.size ?? 1);
      theirEye.z = o.pos.z;
      rays++;
      c.checked = true;
      let clear: boolean;
      if (o.object) {
        // Check the sight line to just in front of it, not to a point inside its own body.
        theirEye.x -= c.dx * 0.8;
        theirEye.z -= c.dz * 0.8;
        clear = view.physics.lineOfSight(myEye, theirEye);
      } else clear = view.sight ? view.sight.lineOfSight(tick, me.slot, myEye, o.slot, theirEye) : view.physics.lineOfSight(myEye, theirEye);
      // Behind smoke: hidden (it doesn't stop rounds, so a bot already firing keeps its aim only while it sees).
      if (clear && view.smoke && smokeBlocks(myEye, theirEye, view.smoke)) clear = false;
      if (!clear) continue;
      // Behind bulletproof glass: seen, but not worth a bullet.
      if (view.physics.armorGlass && !view.physics.shotLine(myEye, theirEye)) continue;
      if (!this.visibleSince.has(o.slot)) this.visibleSince.set(o.slot, tick);
      this.confirmed.set(o.slot, tick);
      if (!best) best = c;
    }
    // Lost from sight: checked and blocked, or gone from view. Tracked enemies not checked this
    // time (further off than the ones that were) stay tracked while seen in the last half second.
    for (const c of live) if (!c.checked) this.unchecked.set(c.o.slot, tick);
    for (const [slot] of this.visibleSince) {
      const at = this.confirmed.get(slot) ?? -Infinity;
      if (at === tick || (this.unchecked.get(slot) === tick && tick - at <= TRACK_UNCHECKED_TICKS)) continue;
      this.visibleSince.delete(slot);
      this.confirmed.delete(slot);
    }

    if (best) {
      this.targetSlot = best.o.slot;
      const t = best.o;
      this.lastKnown = { pos: { ...t.pos }, tick };
    } else {
      this.targetSlot = null;
    }
    // Hearing: gunfire and explosions from enemies we can't see.
    if (view.noises?.length && !best) {
      const hostile = slotsOf(view.others);
      let loud: { pos: Vec3; tick: number; d: number } | null = null;
      for (const n of view.noises) {
        if (n.by >= 0 && !hostile.has(n.by)) continue;
        const d = horizontalDistance(n.pos, me.pos) + Math.abs(n.pos.y - me.pos.y) * 2;
        if (d > n.range || d < 3) continue;
        if (this.unreachable && view.tick < this.unreachable.until && horizontalDistance(n.pos, this.unreachable.pos) < 8) continue;
        if (!loud || d < loud.d) loud = { pos: n.pos, tick: n.tick, d };
      }
      // Big matches: a fight plenty of the side are already in (four or more within 12 m of it) is theirs, unless it's close.
      if (loud && view.crowded && view.alliesGrid && loud.d > 18) {
        let there = 0;
        for (const a of view.alliesGrid.near(loud.pos.x, loud.pos.z, 12, this.nearScratch)) {
          if (a.slot !== me.slot && horizontalDistance(a.pos, loud.pos) < 12 && ++there >= 4) break;
        }
        if (there >= 4) loud = null;
      }
      if (loud && (!this.heard || loud.tick > this.heard.tick + TICK_RATE)) {
        // Roughly where it came from (hearing isn't exact).
        const err = Math.min(4, loud.d * 0.08);
        const p = view.nav.closestPoint({ x: loud.pos.x + (this.rng() * 2 - 1) * err, y: loud.pos.y + 0.5, z: loud.pos.z + (this.rng() * 2 - 1) * err }, { x: 3, y: 3, z: 3 });
        if (p) this.heard = { pos: p, tick: loud.tick };
      }
    }
  }

  private lookAlongPath(view: BotWorldView): void {
    const corner = this.path[this.pathIndex];
    if (!corner) return;
    const me = view.self;
    const a = lookAngles({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, { x: corner.x, y: corner.y + PLAYER.eyeHeight, z: corner.z });
    // Glance about now and then while moving through open ground.
    const glance = Math.sin((view.tick + this.slot * 37) / 50) * 0.45 * (this.careful() ? 1 : 0.3);
    this.turnToward(a.yaw + glance, 0);
  }

  private lookAt(view: BotWorldView, p: Vec3, up: number): void {
    const me = view.self;
    const a = lookAngles({ x: me.pos.x, y: me.pos.y + STANCES[me.stance ?? 0].eye, z: me.pos.z }, { x: p.x, y: p.y + up, z: p.z });
    this.turnToward(a.yaw, a.pitch);
  }

  /**
   * Within reach of the button a press plan is for: players press from up to 2.2 m, eye to face. (Only at the one spot
   * in front of it, a few bots at one button kept each other off it: Primeval Park's fence power, 38 s.)
   */
  private pressReach(me: CombatantView, plan: { stand: Vec3; face: Vec3 }): boolean {
    if (Math.abs(me.pos.y - plan.stand.y) >= 1) return false;
    return horizontalDistance(me.pos, plan.stand) < 0.8 || distance({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, plan.face) < 1.9;
  }

  private turnToward(yaw: number, pitch: number): void {
    const maxStep = this.difficulty.turnRateRadPerSec * TICK_DT;
    this.yaw += clamp(angleDelta(this.yaw, yaw), -maxStep, maxStep);
    this.pitch += clamp(pitch - this.pitch, -maxStep, maxStep);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
  }

  /** A teammate within 2.6 m ahead along `moveYaw` (grid query in big matches). */
  private squadmateAhead(view: BotWorldView, moveYaw: number): boolean {
    if (!view.allies?.length) return false;
    const me = view.self.pos;
    const fx = Math.sin(moveYaw);
    const fz = Math.cos(moveYaw);
    const near = view.alliesGrid ? view.alliesGrid.near(me.x, me.z, 2.6, this.nearScratch) : view.allies;
    for (const a of near) {
      if (a.slot === view.self.slot || Math.abs(a.pos.y - me.y) > 1.5) continue;
      const dx = a.pos.x - me.x;
      const dz = a.pos.z - me.z;
      const d = hypot(dx, dz);
      if (d < 2.6 && d > 1e-3 && (dx * fx + dz * fz) / d > 0.7) return true;
    }
    return false;
  }

  /**
   * Teammates don't stack up: steer away from allies close by, and step aside when
   * standing on top of one (squads walking one navmesh path would otherwise move as a clump).
   * Going somewhere out of a fight (`travelling`), the push only steers aside, never back, and at most as strongly as
   * the way itself: two bots meeting in a narrow way pushed each other back and forth (Shingle Point's MG nest by hill
   * 1), and bodies don't block each other anyway. (In a fight it stays as it was: spread out, bots die less.) At a
   * ladder's foot and on it, none: everyone goes through that one place, one after another (three or four bots pushed
   * each other off Shingle Point's seawall ladders for seconds on end).
   */
  private separate(view: BotWorldView, moveYaw: number | null, travelling = false): number | null {
    if (!view.allies?.length) return moveYaw;
    // (Not waiting for or riding a lift: those keep their spacing round the shaft.)
    if (view.self.climbing || (!this.holdStill && this.atLadder(view.self.pos))) return moveYaw;
    const me = view.self.pos;
    let px = 0;
    let pz = 0;
    // Crowds (BOT_AI_PLAN.md Phase C item 3): travelling, a teammate close ahead coming the other way (facing us) is
    // passed on the right, both of them keeping right, as people do in a doorway, a tunnel or on stairs.
    let keepRight = 0;
    const fx = moveYaw === null ? 0 : Math.sin(moveYaw);
    const fz = moveYaw === null ? 0 : Math.cos(moveYaw);
    const reach = travelling && moveYaw !== null ? ONCOMING : 2.2;
    const near = view.alliesGrid ? view.alliesGrid.near(me.x, me.z, reach, this.nearScratch) : view.allies;
    for (const a of near) {
      if (a.slot === view.self.slot) continue;
      const dx = me.x - a.pos.x;
      const dz = me.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > reach * reach || Math.abs(a.pos.y - me.y) > 1.5) continue;
      if (reach > 2.2 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        // Ahead of us (along our way) and facing us (its look against our way).
        const ahead = -(dx * fx + dz * fz) / d;
        const facing = -(Math.sin(a.yaw) * fx + Math.cos(a.yaw) * fz);
        if (ahead > 0.6 && facing > 0.5) keepRight = Math.max(keepRight, (1 - d / ONCOMING) * 0.9 + 0.2);
      }
      if (d2 > 2.2 * 2.2) continue;
      const d = Math.sqrt(d2);
      // Exactly on top of each other: split by slot so the two go opposite ways.
      const ux = d < 1e-3 ? (view.self.slot < a.slot ? 1 : -1) : dx / d;
      const uz = d < 1e-3 ? 0 : dz / d;
      px += ux * (2.2 - d);
      pz += uz * (2.2 - d);
    }
    if (keepRight) {
      // (Our right, as stepMovement reads `right`: x cos, z -sin of the yaw.)
      px += fz * keepRight;
      pz -= fx * keepRight;
      if (simProfile.on) simProfile.count('botKeepRight');
    }
    if (!px && !pz) return moveYaw;
    if (moveYaw === null) return hypot(px, pz) > 1.4 ? Math.atan2(px, pz) : null;
    const wx = Math.sin(moveYaw);
    const wz = Math.cos(moveYaw);
    if (travelling) {
      const back = px * wx + pz * wz;
      if (back < 0) {
        px -= back * wx;
        pz -= back * wz;
      }
      const push = hypot(px, pz);
      if (push > SEPARATE_MAX) {
        px *= SEPARATE_MAX / push;
        pz *= SEPARATE_MAX / push;
      }
    }
    return Math.atan2(wx + px, wz + pz);
  }

  /** Heading for a ladder's foot (within a few metres) or up or down one: the path's leg there is too steep to walk. */
  private atLadder(me: Vec3): boolean {
    const i = this.pathIndex;
    const c = this.path[i];
    if (!c) return false;
    const steep = (a: Vec3 | undefined, b: Vec3 | undefined) => !!a && !!b && Math.abs(b.y - a.y) > 1.5 && Math.abs(b.y - a.y) > horizontalDistance(a, b) * 1.5;
    return (steep(c, this.path[i + 1]) && horizontalDistance(me, c) < 4) || steep(i > 0 ? this.path[i - 1] : undefined, c);
  }

  // ------------------------------------------------------------------ navigation

  /** Follow a navmesh path to `goal`; returns the world yaw to move along, or null when there is nowhere to go. */
  private followPathTo(view: BotWorldView, goal: Vec3, movingGoal: boolean): number | null {
    if (!simProfile.on) return this.followPathNow(view, goal, movingGoal);
    const t0 = performance.now();
    const r = this.followPathNow(view, goal, movingGoal);
    simProfile.add('botPath', performance.now() - t0);
    return r;
  }

  private followPathNow(view: BotWorldView, goal: Vec3, movingGoal: boolean): number | null {
    const me = view.self;
    // On a zipline: it carries us to its end; plan again from where it drops us.
    if (me.riding) {
      const c = this.path[this.pathIndex];
      return c ? Math.atan2(c.x - me.pos.x, c.z - me.pos.z) : null;
    }
    // A door in the way that a button opens: the button first.
    if (this.pressPlan) {
      goal = this.pressPlan.stand;
      movingGoal = false;
    } else if (this.sidestep) {
      // Stepping aside round something the navmesh doesn't know of (planSidestep): there first.
      if (view.tick >= this.sidestep.until || horizontalDistance(me.pos, this.sidestep.pos) < 0.8) this.sidestep = null;
      else {
        goal = this.sidestep.pos;
        movingGoal = false;
      }
    }
    // Made it across off a cut-off patch: ask for the route again straight away.
    const esc = this.escape;
    if (esc && horizontalDistance(me.pos, esc.across) < 1.2 && Math.abs(me.pos.y - esc.across.y) < 1.5) {
      this.escape = null;
      this.noPath = null;
      this.pathFails = 0;
      this.path = [];
      this.lastPathTick = -Infinity;
    }
    // (Ground on the way gone, or back: Scenario.surfacesGone; a route over a fallen bridge is planned again.)
    const navChanged = view.nav.goneVersion !== this.goneSeen;
    const goalMoved = this.goal === null || navChanged || horizontalDistance(this.goal, goal) > 2 || Math.abs(this.goal.y - goal.y) > 1.5;
    // (Heading for a stand-in: whether the goal itself has come within reach is asked again every second.)
    const stale = (movingGoal && view.tick - this.lastPathTick > PATH_REFRESH_TICKS) || (!!this.standIn && view.tick - this.lastPathTick > TICK_RATE);
    // Ran out of corners without arriving (e.g. pushed off the path): replan, throttled.
    const exhausted = this.pathIndex >= this.path.length && horizontalDistance(me.pos, this.standIn ?? goal) > 1;
    // In the air off the navmesh (out of the plane, under a canopy, a jump pad's flight): no route starts there, so none
    // is asked for until it lands; a route it is following (the pad's) carries on, and a canopy steers straight for the
    // goal meanwhile. (Before, every replan in the air was a failed search: 860 of Eagle Spires' 1,507 in a minute.)
    let replan = (goalMoved && view.tick - this.lastPathTick >= 2) || ((stale || exhausted) && view.tick - this.lastPathTick >= 6);
    // Over the tick's search budget (big matches): keep to the route it has and plan again next tick (one with no route
    // left, or one cut off by a fallen bridge, always searches).
    if (replan && !exhausted && this.path.length && this.pathIndex < this.path.length && this.goneSeen === view.nav.goneVersion && !view.nav.takeSearch()) replan = false;
    // (On a ladder off the navmesh likewise: it carries on along it and plans again off it. Fernwood Moon's vine ladder
    // made hundreds of failed searches a match from bots on it whose goal changed.)
    if (replan && (me.grounded === false || me.climbing) && !view.nav.closestPoint(me.pos)) {
      // (Still where it is going: a canopy steers for it.)
      this.goal = { ...goal };
      if (!this.path.length) this.pathMiss = true;
    } else if (replan) {
      this.goal = { ...goal };
      this.goneSeen = view.nav.goneVersion;
      // No way there a moment ago: don't search again every few ticks, back off (0.2 s, doubling up to 4 s).
      const np = this.noPath;
      // (Only from about where it failed: one that failed on a moving lift, or before crossing off a cut-off patch,
      // says nothing about here.)
      const backedOff = !!np && view.tick < np.until && horizontalDistance(np.goal, goal) < 2 && Math.abs(np.goal.y - goal.y) < 1.5 && horizontalDistance(np.from, me.pos) < 2 && Math.abs(np.from.y - me.pos.y) < 1.5;
      // Tired of waiting for a lift: a way that keeps off lifts if there is one (else the lift after all).
      const offLifts = view.tick < this.offLiftsUntil ? LIFT_FLAG : 0;
      // Off the navmesh (knocked or fallen onto ground it doesn't cover, a narrow ledge, spawned badly): no route starts
      // there. The nearest place on it first, level or below, straight there (before, it asked for routes that couldn't
      // start, and stood).
      const onto = backedOff || me.grounded === false || me.climbing ? null : view.nav.wayOnto(me.pos);
      // A goal no route reaches from here (a flag on a ledge or a roof, a pickup on a crate, a carrier in the air): as
      // near it as a route does get instead, no search for the goal itself. Known per component of routes and goal for
      // the match (NavWorld.standIn: a lookup, the second time).
      const si = backedOff || onto ? null : view.nav.standIn(me.pos, goal);
      this.standIn = si && !si.exact && (horizontalDistance(si.pos, goal) > 0.5 || Math.abs(si.pos.y - goal.y) > 1.5) ? si.pos : null;
      const to = this.standIn ?? goal;
      let found: Vec3[] | null = null;
      if (onto) found = [{ ...me.pos }, onto];
      else if (!backedOff) {
        // Flankers, recon, snipers and Arena bots take parkour's ways (roofs, jumps) as readily as walking (nav/parkour.ts).
        const agile = this.agile(view);
        // Along its group's corridor (orderTarget asked for it just now), else the usual search.
        const al = this.along;
        if (al && view.tick - al.tick <= DECIDE_TICKS * 2 && !offLifts && !this.standIn) {
          found = view.nav.pathAlong(me.pos, al.c.polys, to, view.shut ?? 0);
          if (found) this.alongRoutes++;
          else al.failed = view.tick;
        }
        found ??= (offLifts && view.nav.findPath(me.pos, to, offLifts, false, this.coverRoutes, agile)) || view.nav.findPath(me.pos, to, 0, true, this.coverRoutes, agile);
      }
      if (!backedOff && !onto) {
        this.pathFails = found ? 0 : Math.min(this.pathFails + 1, 6);
        this.pathSearches++;
        if (this.standIn) this.standIns++;
        // (A route somewhere else, a place to keep watch from on the way, leaves the back-off for the goal alone.)
        if (!found) this.noPath = { goal: { ...goal }, from: { ...me.pos }, until: view.tick + Math.min(TICK_RATE * 4, 6 << this.pathFails) };
        else if (np && horizontalDistance(np.goal, goal) < 2 && Math.abs(np.goal.y - goal.y) < 1.5) this.noPath = null;
        if (!found) {
          this.pathFailures++;
          this.lastNoRoute = this.noPath;
        }
      }
      this.path = found ?? [];
      // No route to the goal: cut off on a patch of navmesh players walk off (a step or a hop from the goal's part)?
      // Then off it first. Else as near the goal as a route gets (the stand-in), rather than standing.
      // (Not while falling or under a canopy: no route starts in the air, and it lands soon enough.)
      if (found && !this.standIn) this.escape = null;
      else if (!onto && horizontalDistance(me.pos, goal) > 1.5 && (me.grounded !== false || me.climbing)) {
        this.planEscape(view, goal);
        if (this.escape) this.standIn = null;
      } else if (this.escape && view.tick <= this.escape.until) {
        // Hopping across off a cut-off patch: on across, not back to the stand-in on the patch (a fight starting in
        // mid-hop sent Capitol Mall's pool bot back down into the pool, 14 s).
        this.path = [{ ...me.pos }, { ...this.escape.across }];
        this.standIn = null;
      }
      const door = this.pathBlocked(view);
      if (door) {
        this.path = [];
        // Pressed its button a while ago and it's still shut: that button doesn't open it for us (a rule that waits on
        // something else, a gate that shut again before we got there). Not again for a good while.
        const pd = this.pressedDoor;
        if (pd && sameBox(pd, door) && view.tick - this.pressedAt > TICK_RATE * 3) {
          this.noPress.push({ door: pd, until: view.tick + TICK_RATE * 30 });
          if (this.noPress.length > 4) this.noPress.shift();
          this.pressedDoor = null;
        }
        if (!this.pressPlan && view.tick - this.pressedAt > TICK_RATE * 3) this.planPress(view, door);
        // No button opens it for us: another way round, keeping out of what's shut to us (Fernwood Moon's Garrison
        // spawned inside its bunker, where the shortest way out is the blast door only the attackers can open: they
        // stood there until they died, with their own rear door a few steps away).
        if (!this.pressPlan && view.shut) {
          const round = view.nav.findPath(me.pos, goal, view.shut);
          if (round) {
            this.path = round;
            if (this.pathBlocked(view)) this.path = [];
          }
          // No way round either (a gate a button opens now and then, on cooldown): as near the goal as it gets this side
          // of what's shut, to wait there (keeping watch) for it to open or a button to be ready, asking again every
          // second. Before, it stood at the button, pressing a button that did nothing, every 3 s.
          if (!this.path.length) {
            const near = view.nav.findPath(me.pos, goal, view.shut, true);
            const end = near?.[near.length - 1];
            if (near && end && horizontalDistance(end, goal) > 1) {
              this.path = near;
              this.standIn = end;
            }
          }
        }
      }
      this.pathIndex = this.path.length > 1 ? 1 : 0;
      this.lastPathTick = view.tick;
    }
    // Just came out of a portal: that leg is done. Its end (a little way out of the far portal) can still be more than
    // a corner's reach away, and the leg would send us back into the near portal's face, which is now behind the far one.
    if (this.portalled) {
      this.portalled = false;
      const corner = this.path[this.pathIndex];
      if (corner && view.portals?.length && this.portalFace(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null)) this.pathIndex++;
    }
    while (this.pathIndex < this.path.length) {
      const c = this.path[this.pathIndex]!;
      const d = horizontalDistance(me.pos, c);
      if (Math.abs(me.pos.y - c.y) >= 1.6) break;
      // Reached, or already past it (beyond the corner along the way in): on to the next, no circling back.
      const prev = this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null;
      const past = !!prev && this.pathIndex < this.path.length - 1 && d < PASS_RADIUS && (me.pos.x - c.x) * (c.x - prev.x) + (me.pos.z - c.z) * (c.z - prev.z) > 0;
      if (d < CORNER_RADIUS || past) this.pathIndex++;
      else break;
    }
    const corner = this.path[this.pathIndex];
    if (!corner) {
      // As near a goal no route reaches as it gets (the stand-in): the callers keep watch there, or go for another goal.
      // Unless it's a step off the navmesh away and in the clear (a pickup on a crate, a flag on a prop: the navmesh
      // keeps clear of their sides, a body needn't): the last bit straight there.
      const si = this.standIn;
      if (si) {
        const dy = goal.y - me.pos.y;
        if (horizontalDistance(me.pos, goal) > 0.5 && horizontalDistance(si, goal) < STEP_OFF && dy < 1.4 && dy > -2 && view.physics.lineOfSight({ x: me.pos.x, y: me.pos.y + 1.2, z: me.pos.z }, { x: goal.x, y: Math.max(goal.y + 0.3, me.pos.y + 1.2), z: goal.z })) return Math.atan2(goal.x - me.pos.x, goal.z - me.pos.z);
        this.pathMiss = true;
        return null;
      }
      if (horizontalDistance(me.pos, goal) < 0.5) return null;
      if (this.path.length === 0) {
        this.pathMiss = true;
        return null;
      }
      return Math.atan2(goal.x - me.pos.x, goal.z - me.pos.z);
    }
    // The leg ahead a parkour link (a drop, a jump across or up): act() runs it (parkourMove).
    if (view.nav.parkour.length) this.watchLink(view, corner);
    if (view.lifts?.length) this.holdStill = this.liftWait(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null);
    // Taking a portal: the next corner is out of the far portal, so walk into this one's surface instead.
    const face = view.portals?.length ? this.portalFace(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null) : null;
    if (face) return Math.atan2(face.x - me.pos.x, face.z - me.pos.z);
    // Taking a zipline: the next corner is where it drops us, so go back to where it's grabbed and press E there.
    const grab = view.ziplines?.length ? this.zipGrab(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null) : null;
    if (grab) {
      if (horizontalDistance(me.pos, grab) < 1.1) this.zipPress = true;
      return Math.atan2(grab.x - me.pos.x, grab.z - me.pos.z);
    }
    return Math.atan2(corner.x - me.pos.x, corner.z - me.pos.z);
  }

  /** Flankers, recon, snipers and Arena bots: parkour links cost them no more than walking (NavWorld.findPath `agile`). */
  private agile(view: BotWorldView): boolean {
    const plan = view.plan;
    return this.arena || plan?.role === 'sniper' || plan?.job?.group === 'flank' || plan?.job?.group === 'recon';
  }

  /**
   * Whether the route's leg into `corner` is a parkour link (its corners the link's start and end): then it is the one
   * to run. A link it is already on (jumped, or over the edge) is kept until it lands, whatever the route does.
   */
  private watchLink(view: BotWorldView, corner: Vec3): void {
    const k = this.link;
    if (k && (k.jumped >= 0 || k.left >= 0)) return;
    if (k && k.path === this.path && k.index === this.pathIndex) return;
    const prev = this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null;
    const l = prev ? view.nav.parkourAt(prev, corner) : null;
    // (The same link again on a new route, after a stuck recovery cleared the last and the bot walked back to the link's
    // start: its clock goes on, so a link the bot can't make is given up in the end. On Qasr Medina one stood at a drop for
    // minutes, the character controller stalled at the end of a wall top it stood on, re-finding the link every second.)
    if (!l) {
      this.link = null;
      return;
    }
    const clock = this.linkClock;
    const since = clock && clock.l === l && view.tick - clock.at < TICK_RATE * 20 ? clock.since : view.tick;
    this.linkClock = { l, since, at: view.tick };
    this.link = { l, path: this.path, index: this.pathIndex, since, jumped: -1, left: -1 };
  }

  /**
   * Running a parkour link (nav/parkour.ts parkourInput, as the build played it through the movement code): facing
   * its way and running (sprinting for a gap), jumping at its takeoff, tucking the legs up in the air for a high ledge.
   * Null when it isn't on one now (still on its way to the link's start, wandered off it, or done: landed).
   */
  private parkourMove(view: BotWorldView): { yaw: number; buttons: number; wait: boolean } | null {
    const k = this.link!;
    const me = view.self;
    const l = k.l;
    const tick = view.tick;
    const grounded = me.grounded !== false;
    if (k.left < 0 && !grounded && me.pos.y < l.start.y - 0.4) k.left = tick;
    const off = k.jumped >= 0 ? k.jumped : k.left;
    if (off >= 0) {
      // Down again: done.
      if (grounded && tick - off > 3) {
        // (Down by its end: made; anywhere else, missed: short, or knocked off it.)
        if (horizontalDistance(me.pos, l.end) < 4.5 && Math.abs(me.pos.y - l.end.y) < 0.8) this.parkourDone[l.kind]++;
        else {
          this.parkourMissed++;
          view.nav.linkFailed(l, false);
        }
        this.link = null;
        return null;
      }
      // (In the air for ever: knocked about, under a canopy; let it go.)
      if (tick - off > TICK_RATE * 4) {
        this.link = null;
        return null;
      }
    } else {
      const along = parkourAlong(l, me.pos);
      const len = horizontalDistance(l.start, l.end);
      const side = Math.abs((me.pos.x - l.start.x) * Math.cos(l.yaw) - (me.pos.z - l.start.z) * Math.sin(l.yaw));
      // Not at it yet (on the way to its start) or off its line: walk on as the route says.
      if (along < -0.8 || side > 0.9 || along > len + 1) {
        if (tick - k.since > TICK_RATE * 6) {
          this.parkourGaveUp++;
          this.link = null;
        }
        return null;
      }
      // Too long at it without going (held up: something the build didn't have in the way): give up on it, and the link is
      // switched off for everyone (NavWorld.linkFailed); the route is planned again without it.
      if (tick - k.since > TICK_RATE * (l.sprint ? 8 : 4)) {
        this.parkourGaveUp++;
        view.nav.linkFailed(l, true);
        this.link = null;
        return null;
      }
      // A running jump wants a sprint: out of breath, it waits at the start for its stamina.
      if (l.sprint && me.winded) return { yaw: l.yaw, buttons: 0, wait: true };
    }
    const c = parkourInput(l, me.pos, grounded, k.jumped >= 0);
    if (c.jump) k.jumped = tick;
    return { yaw: c.yaw, buttons: c.buttons, wait: false };
  }

  /**
   * No route from here to `goal`. Standing on a patch of navmesh cut off from it that players walk off
   * (NavWorld.escapes: Capitol Mall's reflecting pool, slab edges, low roofs), the bot heads for the edge of the
   * patch nearest a place close by that does route to the goal, and steps or hops across (act() hops when the
   * crossing holds it up). Before, it stood where it was until it died (Diamond Park's dugouts were such patches,
   * fixed in the map since: "most of the team hung out in the dugout"). A crossing not made within 8 s is left
   * alone for 30 s and the next one, if any, is tried.
   */
  private planEscape(view: BotWorldView, goal: Vec3): void {
    const me = view.self.pos;
    const tick = view.tick;
    const failed = this.failedCrossings;
    for (let i = failed.length - 1; i >= 0; i--) if (failed[i]!.until <= tick) failed.splice(i, 1);
    let esc = this.escape;
    if (esc && tick > esc.until) {
      failed.push({ at: esc.across, until: tick + TICK_RATE * 30 });
      if (failed.length > 6) failed.shift();
      esc = this.escape = null;
    }
    const physics = view.physics;
    // Straight across, nothing in the way at knee or head height.
    const clear = (a: Vec3, b: Vec3) => {
      const y = Math.max(a.y, b.y);
      return physics.lineOfSight({ x: a.x, y: y + 0.5, z: a.z }, { x: b.x, y: y + 0.5, z: b.z }) && physics.lineOfSight({ x: a.x, y: y + 1.6, z: a.z }, { x: b.x, y: y + 1.6, z: b.z });
    };
    const pick = view.nav.escapes(me, goal, clear).find((o) => !failed.some((f) => horizontalDistance(f.at, o.across) < 1));
    if (!pick) {
      this.escape = null;
      return;
    }
    if (!esc || horizontalDistance(esc.across, pick.across) > 0.5) this.escape = { across: { ...pick.across }, goal: { ...goal }, until: tick + TICK_RATE * 8 };
    const lead = pick.edge && horizontalDistance(me, pick.edge) > 0.6 ? view.nav.findPath(me, pick.edge) : null;
    this.path = lead ? [...lead, { ...pick.across }] : [{ ...me }, { ...pick.across }];
  }

  /**
   * Stuck on the same spot again and again: somewhere 3–5 m to one side of the way it was going (walkable, and a
   * route there that isn't the way it was stuck), to walk to before carrying on. A few nav lookups, only then.
   */
  private planSidestep(view: BotWorldView): void {
    const me = view.self.pos;
    const corner = this.path[this.pathIndex] ?? this.goal;
    const ahead = corner ? Math.atan2(corner.x - me.x, corner.z - me.z) : this.yaw;
    const first = this.routeRng() < 0.5 ? 1 : -1;
    for (const side of [first, -first]) {
      for (const turn of [0.5, 0.75]) {
        const a = ahead + side * Math.PI * turn;
        const d = 3 + this.routeRng() * 2;
        const p = view.nav.closestPoint({ x: me.x + Math.sin(a) * d, y: me.y + 0.5, z: me.z + Math.cos(a) * d }, { x: 1, y: 2, z: 1 });
        if (!p || horizontalDistance(p, me) < 2 || Math.abs(p.y - me.y) > 1.5) continue;
        const route = view.nav.findPath(me, p);
        if (!route || pathLength(route) > d * 2.5) continue;
        this.sidestep = { pos: p, until: view.tick + TICK_RATE * 4 };
        this.path = [];
        this.goal = null;
        this.lastPathTick = -Infinity;
        return;
      }
    }
  }

  /** The portal surface to walk into when the path's next leg is a portal link (from in front of one portal to out of the other). */
  private portalFace(view: BotWorldView, corner: Vec3, prev: Vec3 | null): Vec3 | null {
    if (!prev) return null;
    const near = (a: Vec3, b: Vec3, r: number) => horizontalDistance(a, b) < r && Math.abs(a.y - b.y) < 1.2;
    for (const p of view.portals!) if (near(prev, p.start, 1.6) && near(corner, p.end, 1.8)) return p.face;
    return null;
  }

  /** Where to grab the zipline when the path's next leg is a zipline ride (from its grab spot to where it drops you). */
  private zipGrab(view: BotWorldView, corner: Vec3, prev: Vec3 | null): Vec3 | null {
    if (!prev) return null;
    const near = (a: Vec3, b: Vec3, r: number) => horizontalDistance(a, b) < r && Math.abs(a.y - b.y) < 1.2;
    for (const z of view.ziplines!) if (z.on && near(prev, z.start, 1.6) && near(corner, z.end, 1.8)) return z.start;
    return null;
  }

  /** Went through a portal: the view turned with you (the server turned the body). */
  turned(turn: number): void {
    this.yaw += turn;
    this.portalled = true;
  }

  /**
   * Lifts: the navmesh has a link from the platform's top at one end of its
   * run to the other. Coming up to the link, wait (a couple of metres back)
   * until the platform is there; on it, stand still until it has arrived.
   */
  private liftWait(view: BotWorldView, corner: Vec3, prev: Vec3 | null): boolean {
    const me = view.self.pos;
    // The navmesh snaps link ends to the floor beside the shaft, up to a couple of metres off.
    const near = (a: Vec3, b: Vec3) => horizontalDistance(a, b) < 2.6 && Math.abs(a.y - b.y) < 0.8;
    for (const l of view.lifts!) {
      if (prev && near(prev, l.start) && near(corner, l.end)) {
        // Riding (or about to): until the platform has brought us level with the far end.
        const aboard = horizontalDistance(me, l.top) < l.half + 0.2 && Math.abs(me.y - l.top.y) < 0.3;
        if (aboard && Math.abs(me.y - l.end.y) > 0.5) return true;
      } else if (near(corner, l.start)) {
        // Walking up to it: wait back from the edge while the platform is away. Waited a good while (a queue at a
        // small platform: Fernwood Moon's north lift held bots 20–90 s): another way, if there is one, for a while.
        if (Math.abs(l.top.y - l.start.y) > 0.3 && horizontalDistance(me, l.start) < 2.5) {
          if (this.liftWaitSince < 0) this.liftWaitSince = view.tick;
          if (view.tick - this.liftWaitSince < TICK_RATE * LIFT_PATIENCE) return true;
          this.liftWaitSince = -1;
          this.offLiftsUntil = view.tick + TICK_RATE * 20;
          this.path = [];
          this.lastPathTick = -Infinity;
          return false;
        }
      }
    }
    this.liftWaitSince = -1;
    return false;
  }

  /** The path is shut by a door some button opens: go and press it (if it can be reached). */
  private planPress(view: BotWorldView, door: Aabb): void {
    const me = view.self.pos;
    for (let i = this.noPress.length - 1; i >= 0; i--) if (this.noPress[i]!.until <= view.tick) this.noPress.splice(i, 1);
    if (this.noPress.some((n) => sameBox(n.door, door))) return;
    const options = (view.doorButtons ?? []).filter((d) => sameBox(d.door, door)).sort((a, b) => horizontalDistance(me, a.stand) - horizontalDistance(me, b.stand));
    for (const o of options) {
      const path = view.nav.findPath(me, o.stand);
      if (!path) continue;
      const saved = this.path;
      this.path = path;
      const blocked = this.pathBlocked(view);
      this.path = saved;
      if (blocked) continue;
      // Stand on the floor in front of it, where the route ends: a button on a console is a metre or more over the
      // floor, and its own spot's height never came within reach (Serene City's thaw console: eight bots stood under
      // it, never pressing, 400 s a match).
      const end = path[path.length - 1];
      const stand = end && horizontalDistance(end, o.stand) < 1.5 ? { x: o.stand.x, y: end.y, z: o.stand.z } : o.stand;
      this.pressPlan = { stand, face: o.face, until: view.tick + TICK_RATE * 20, door };
      this.path = path;
      this.goal = { ...stand };
      return;
    }
  }

  /** Chasing or investigating `goal` without getting any closer for five seconds. */
  private stalled(view: BotWorldView, goal: Vec3): boolean {
    const me = view.self.pos;
    const d = horizontalDistance(me, goal) + Math.abs(me.y - goal.y);
    const h = this.headway;
    if (!h || horizontalDistance(h.goal, goal) > 3 || view.tick - h.tick > TICK_RATE * 8) {
      this.headway = { goal: { ...goal }, best: d, tick: view.tick };
      return false;
    }
    if (d < h.best - 1) {
      h.best = d;
      h.tick = view.tick;
      return false;
    }
    return view.tick - h.tick > TICK_RATE * 5;
  }

  /** The closed door or breakable wall the planned path crosses, if any. */
  private pathBlocked(view: BotWorldView): Aabb | null {
    // A leg through a portal that is switched off is shut (there is no button to open it for the bot).
    const shut = [...(view.portals?.filter((p) => !p.on) ?? []), ...(view.ziplines?.filter((z) => !z.on).map((z) => ({ ...z, face: z.start })) ?? [])];
    if (shut.length) {
      const near = (a: Vec3, b: Vec3, r: number) => horizontalDistance(a, b) < r && Math.abs(a.y - b.y) < 1.2;
      for (let i = 1; i < this.path.length; i++) {
        const leg = shut.find((p) => near(this.path[i - 1]!, p.start, 1.6) && near(this.path[i]!, p.end, 1.8));
        if (leg) return { min: { x: leg.face.x - 0.5, y: leg.face.y, z: leg.face.z - 0.5 }, max: { x: leg.face.x + 0.5, y: leg.face.y + 3, z: leg.face.z + 0.5 } };
      }
    }
    if (!view.blockers?.length) return null;
    let prev = view.self.pos;
    for (const c of this.path) {
      const a = { x: prev.x, y: prev.y + 1, z: prev.z };
      const b = { x: c.x, y: c.y + 1, z: c.z };
      const rise = b.y - a.y;
      let hit: Aabb | undefined;
      if (Math.abs(rise) > 1.5 && Math.abs(rise) > horizontalDistance(a, b) * 1.5) {
        // Too steep to walk: a ladder (or a drop or a jump link). The bot climbs straight up or down at the low end and
        // steps across at the top. The straight line between the two ends would cut through the wall the ladder is on
        // (and its windows, which made every ladder-top roof look shut off), so check the way it actually goes.
        const low = rise > 0 ? a : b;
        const corner = { x: low.x, y: Math.max(a.y, b.y), z: low.z };
        hit = view.blockers.find((box) => segmentHitsAabb(a, corner, box) || segmentHitsAabb(corner, b, box));
      } else hit = view.blockers.find((box) => segmentHitsAabb(a, b, box));
      if (hit) return hit;
      prev = c;
    }
    return null;
  }

  /** Would the next couple of metres along `moveYaw` enter an active trap we are not already standing in? */
  private hazardAhead(view: BotWorldView, moveYaw: number): boolean {
    if (!view.hazards?.length) return false;
    const me = view.self.pos;
    const here = { x: me.x, y: me.y + 0.5, z: me.z };
    const ahead = { x: me.x + Math.sin(moveYaw) * 2, y: me.y + 0.5, z: me.z + Math.cos(moveYaw) * 2 };
    const inside = view.hazards.some((h) => segmentHitsAabb(here, here, h, PLAYER.radius));
    return !inside && view.hazards.some((h) => segmentHitsAabb(here, ahead, h, PLAYER.radius));
  }

  /** Detect lack of progress while trying to move; repath and hop when stuck. */
  private checkStuck(view: BotWorldView, moving: boolean): boolean {
    const pos = view.self.pos;
    if (!moving) {
      this.stuckCheck = null;
      return false;
    }
    if (!this.stuckCheck) {
      this.stuckCheck = { tick: view.tick, pos: { ...pos } };
      return false;
    }
    if (view.tick - this.stuckCheck.tick < STUCK_WINDOW_TICKS) return false;
    const progressed = horizontalDistance(pos, this.stuckCheck.pos) > 0.6 || Math.abs(pos.y - this.stuckCheck.pos.y) > 0.5;
    this.stuckCheck = { tick: view.tick, pos: { ...pos } };
    if (progressed) return false;
    this.stuckCount++;
    this.path = [];
    this.goal = null;
    this.lastPathTick = -Infinity;
    this.cover = null;
    // Stuck three times in ten seconds in the same spot: whatever it is after can't be had from here. Give it up.
    const log = this.stuckLog;
    log.push({ tick: view.tick, x: pos.x, z: pos.z });
    while (log.length && view.tick - log[0]!.tick > TICK_RATE * 10) log.shift();
    if (log.length >= 3 && log.every((l) => hypot(l.x - pos.x, l.z - pos.z) < 4)) {
      log.length = 0;
      this.stuckLoops++;
      // Sent somewhere (a mode goal: nothing to give up), or after anything else: a few steps aside first, round
      // what's in the way that the navmesh doesn't know of (a vehicle parked on the route, a crowd in a doorway).
      // Before, a bot walking into a parked dropship on Fernwood Moon jumped and walked into it again for minutes.
      this.planSidestep(view);
      if (this.roamGoal) this.avoid = { pos: { ...this.roamGoal }, until: view.tick + TICK_RATE * 20 };
      // A pickup it was after: off its list for a good while (the 2 s pickup check would send it straight back).
      if (this.roamGoal) this.losePickup(view, this.roamGoal);
      this.roamGoal = null;
      this.via = null;
      this.heard = null;
      if (this.state === 'chase') this.lastKnown = null;
      if (this.post) {
        this.post.board.unreachable(this.post.spot, this.slot, view.tick, TICK_RATE * 120);
        this.post = null;
        this.nextPost = view.tick + TICK_RATE * 5;
      }
    }
    return true;
  }
}

const key = (p: Vec3): string => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`;

/** The same door (or wall): boxes that match to a couple of centimetres. */
const sameBox = (a: Aabb, b: Aabb): boolean => Math.abs(a.min.x - b.min.x) + Math.abs(a.min.z - b.min.z) + Math.abs(a.max.x - b.max.x) + Math.abs(a.max.z - b.max.z) + Math.abs(a.min.y - b.min.y) < 0.05;

export interface WeaponChoiceContext {
  /** Distance to the target (or to where it was last seen). */
  dist: number;
  target: CombatantView | undefined;
  /** This is the weapon in hand. */
  held: boolean;
  /** Another owned weapon can fire right now (melee, or rounds in its magazine). */
  loadedElsewhere: boolean;
  profile: BotProfile;
  /** The target is in a vehicle: launchers first, knives last. */
  vehicle?: boolean;
}

/**
 * How much a bot wants to fight with this weapon now: its desirability and
 * range band, nudged by personality, minus splash danger up close, scarce
 * ammo (the last rockets are kept for a target worth them) and a magazine
 * about to run dry in a close fight. -Infinity when it can't fire at all.
 */
/** How far (m) bots fire a melee weapon's barrel: well inside its falloff, where most of the pattern still lands. */
export function barrelReach(alt: AltFire): number {
  return Math.min(alt.range ?? 10, (alt.falloff?.end ?? 16) * 0.45);
}

export function weaponScore(w: InventoryView, c: WeaponChoiceContext): number {
  const { def } = w;
  const rounds = w.mag + w.reserve;
  if (def.magazine > 0 && rounds <= 0) return -Infinity;
  const { dist, target, profile } = c;
  const [lo, reach] = def.botRange;
  // A melee weapon with a loaded barrel (the Battle Axe) also fights a few steps beyond its reach.
  const barrel = def.kind === 'melee' && def.alt?.kind === 'hitscan' && (w.alt ?? 0) >= def.alt.cost ? def.alt : null;
  const hi = barrel ? Math.max(reach, barrelReach(barrel)) : reach;
  let score = def.botDesirability + (dist >= lo && dist <= hi ? 0.6 : -Math.min(dist < lo ? lo - dist : dist - hi, 20) * 0.03);
  if (def.projectile && dist < def.projectile.splashRadius + 1) score -= 1.5 * (profile.selfPreservation / 100);
  if (profile.tags.includes('EXPLOSIVES_FAN') && def.projectile) score += 0.4;
  if (def.kind === 'melee') score += (profile.meleePreference / 100) * 0.5;
  // A target in a vehicle: a launcher (from outside its own blast), never a knife.
  if (c.vehicle) {
    if (antiVehicle(def) && !(def.projectile && dist < def.projectile.splashRadius + 1)) score += ANTI_VEHICLE_BONUS;
    else if (def.kind === 'melee') score -= 1;
  }
  if (profile.weaponPreferences.includes(def.id)) score += 0.25;
  if (def.magazine > 0) {
    // Scarce ammo (under two magazines', or a third of a full load's, worth left): worth less, and wasted on a target that's nearly dead anyway.
    const scarcity = Math.max(0, 1 - rounds / Math.max(def.magazine * 2, def.reserveMax / 3));
    score -= scarcity * def.botDesirability * 0.5;
    // (A vehicle's driver being nearly dead doesn't make the vehicle any softer.)
    if (target && !c.vehicle && target.health + target.armor <= 35) score -= scarcity * def.botDesirability * 0.6;
    if (target && dist < 15 && c.loadedElsewhere) {
      // Empty magazine with an enemy close: switching is faster than reloading.
      if (w.mag === 0) score -= 0.5;
      // Nearly empty (two shots or so) on a gun with a real magazine: draw the next gun before it clicks dry.
      else if (def.magazine >= 6 && w.mag <= Math.max(1, Math.floor(def.magazine * 0.1))) score -= 0.3;
    }
  }
  // Avoid dithering between near-equal choices.
  if (c.held) score += 0.15;
  return score;
}

/**
 * How badly a bot needs a pickup (0: not at all): health and armor by what's
 * missing, a weapon it lacks or has run dry, ammo only when it fits a weapon
 * running low (a box fits all), grenades when it has few.
 */
export function pickupNeed(e: ItemEffect, me: CombatantView, inventory: readonly InventoryView[], owned: ReadonlyMap<string, InventoryView>, throwables: number, throwable: ThrowableKind | null): number {
  if (e.kind === 'health') return (100 - me.health) / 60;
  if (e.kind === 'armor') return (100 - me.armor) / 100;
  if (e.kind === 'powerup') return 1;
  if (e.kind === 'weapon') {
    const w = owned.get(e.weapon);
    // Arena discs lie where they land: worth fetching whenever the hand isn't full.
    if (w?.def.projectile?.disc && w.mag < w.def.magazine) return w.mag === 0 ? 1.2 : 0.5;
    return !w ? 1 : w.def.magazine > 0 && w.mag === 0 && w.reserve === 0 ? 1.2 : w.reserve < w.def.reserveMax / 3 ? 0.4 : 0;
  }
  if (e.kind === 'ammo') {
    const low = inventory.filter((w) => w.def.magazine > 0 && (!e.ammo || w.def.ammo === e.ammo) && w.reserve < w.def.reserveMax / 3);
    return low.length ? (low.some((w) => w.mag + w.reserve === 0) ? 0.9 : 0.6) : 0;
  }
  if (e.kind === 'throwable') return throwables === 0 ? 0.5 : throwable === e.throwable && throwables < 2 ? 0.3 : 0;
  // Power discs (Disc Arena), for disc throwers.
  if (e.kind === 'disc') return inventory.some((w) => w.def.projectile?.disc) ? 0.8 : 0;
  return 0;
}

/**
 * Whether a grenade is worth throwing: the last one is kept for when the bot is
 * pinned by an enemy in sight, unless it plays recklessly (low tactical sense).
 */
/** The best weapon a bot carries that still has rounds, by desirability (0 with nothing). */
export function bestLoadedDesirability(inventory: readonly InventoryView[]): number {
  let best = 0;
  for (const w of inventory) if (w.def.magazine <= 0 || w.mag + w.reserve > 0) best = Math.max(best, w.def.botDesirability);
  return best;
}

export function grenadeWorthIt(count: number, enemyInSight: boolean, tactical: number): boolean {
  if (count <= 0) return false;
  return count > 1 || enemyInSight || tactical < 0.3;
}

function farthest(points: readonly Vec3[], from: Vec3): Vec3 | undefined {
  let best: Vec3 | undefined;
  let bestD = -1;
  for (const p of points) {
    const d = horizontalDistance(p, from) + Math.abs(p.y - from.y);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Of the side's trip ending nearest `goal` (within 40 m), the corridor that costs least now (teamBrain.ts prices: its
 * length with the teammates on it, and the deaths and sightings near it), with a little of the bot's own taste (up to
 * ×1.3): null when no trip ends there.
 */
function cheapestRoute(trips: readonly PricedTrip[], goal: Vec3, rng: () => number): Corridor | null {
  let best: PricedTrip | null = null;
  let bestD = 40;
  for (const t of trips) {
    const d = horizontalDistance(t.trip.to, goal);
    if (d < bestD && t.trip.corridors.length) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return null;
  let pick: Corridor | null = null;
  let low = Infinity;
  best.trip.corridors.forEach((c, k) => {
    const cost = best!.cost[k]! * (1 + rng() * 0.3);
    if (cost < low) {
      low = cost;
      pick = c;
    }
  });
  return pick;
}

/** A goal a sniper may hold a spot over (OrderGoal): one to hold (a CTF defender's flag, a hill), not one to get to. */
function holdsPost(g: OrderGoal): boolean {
  return !g.run && !g.order && !g.push;
}

/** How squarely `t` faces `at` (1: looking straight at it; 0: sideways; below: away). */
function facingOf(t: CombatantView, at: Vec3): number {
  const dx = at.x - t.pos.x;
  const dz = at.z - t.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  return (Math.sin(t.yaw) * dx + Math.cos(t.yaw) * dz) / d;
}

/** The nearest of `points` to `from` (null: none). */
function nearestOf(points: readonly Vec3[] | null | undefined, from: Vec3): Vec3 | null {
  let best: Vec3 | null = null;
  let bestD = Infinity;
  for (const p of points ?? []) {
    const d = horizontalDistance(p, from);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Arena hopping: the seconds (least, most) until the next hop, or null for no
 * hop now. `always` is the Arena match style (constant bunny-hopping while
 * strafing or running); otherwise an ARENA character on the Mixed style hops
 * only in a fight (a target, or under fire), while it strafes, and less often.
 */
export function arenaHop(always: boolean, fighting: boolean, strafing: boolean, running: boolean): [number, number] | null {
  if (always) return strafing || running ? [0.5, 1.1] : null;
  return fighting && strafing ? [1.3, 2.4] : null;
}
