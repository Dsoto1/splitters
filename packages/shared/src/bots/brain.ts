import { angleDelta, clamp, createRng, distance, horizontalDistance, lookAngles, type Vec3 } from '../math.ts';
import type { NavWorld } from '../nav/index.ts';
import { PLAYER, STANCES, TICK_DT, TICK_RATE, type Stance } from '../sim/constants.ts';
import type { ItemDefinition, ItemEffect } from '../sim/items.ts';
import { BUTTON_ALT, BUTTON_CROUCH, BUTTON_FIRE, BUTTON_MELEE, BUTTON_JUMP, BUTTON_PRONE, BUTTON_RELOAD, BUTTON_SPRINT, BUTTON_THROW, BUTTON_USE, BUTTON_ZOOM, type PlayerInput } from '../sim/movement.ts';
import { THROWABLE_DEFS, getWeapon, weaponCode, type AltFire, type ThrowableKind, type WeaponDefinition } from '../sim/weapons.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import { segmentHitsAabb, type Aabb } from '../sim/scenarioDefs.ts';
import { AimModel, type AimContext, type AimSolution, type AimTarget } from './aim.ts';
import { findCover, stillCovered, type CoverSpot } from './cover.ts';
import type { SightCache } from './sight.ts';
import type { ViewGrid } from './grid.ts';
import { MapMemory, laneWaypoint, pickExploreGoal } from './explore.ts';
import type { BotPlan } from './director.ts';
import type { VantageBoard, VantageKind } from './vantage.ts';
import { simProfile } from '../sim/profile.ts';
import { hasTag, type BotDifficulty, type BotProfile } from './profile.ts';
import { fanPoints, isDoorway, solveThrow, turnAngle } from './tactics.ts';
import {
  ANTI_VEHICLE_SPLASH,
  ROADKILL_SPEED,
  RIDER_MIN_PROGRESS,
  RIDER_STUCK_TICKS,
  STUCK_AVOID_SECONDS,
  aboutToBlow,
  antiVehicle,
  freshDrive,
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
   * Squad order (NPCs) or co-op goal (Player Bots): when not fighting, go here
   * instead of roaming, and wait within `radius` of it.
   */
  orderGoal?: { pos: Vec3; radius: number } | null;
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
  /** `allies` on a grid (big matches): keeping apart reads the cells around the bot. */
  alliesGrid?: ViewGrid | undefined;
  /** The match's planning for this bot (role, squad, side knowledge: director.ts); undefined without one. */
  plan?: BotPlan | undefined;
}

/** What aiming reads (BotBrain.steer reads the whole view, like think). */
type SteerView = Pick<BotWorldView, 'tick' | 'self' | 'others' | 'inventory' | 'held'>;

export type BotState = 'roam' | 'advance' | 'engage' | 'cover' | 'chase' | 'investigate' | 'retreat' | 'hold' | 'mount' | 'mounted' | 'dead';

const SIGHT_RANGE = 60;
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
/** How far (m) a bot goes to hop into a teammate's vehicle. */
const RIDE_REACH = 25;
/** Enemy vehicles: how far (m, plus height) a bot goes for a rocket or grenade launcher once one has been seen lately (VEHICLE_MEMORY s). */
const LAUNCHER_DETOUR = 30;
const VEHICLE_MEMORY = 12;
/** Score bonus (weaponScore) for an anti-vehicle weapon against a target in a vehicle; melee is worse than useless. */
const ANTI_VEHICLE_BONUS = 1.2;
/** Stepping out of a vehicle's path: committed for this long (s); sprinting when it is this close (s away). */
const DODGE_SECONDS = 0.8;
const DODGE_SPRINT_ETA = 1.2;
/** A path corner counts as reached this close (m), or once passed and within PASS_RADIUS. */
const CORNER_RADIUS = 0.45;
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
  private roamGoal: Vec3 | null = null;
  private via: Vec3 | null = null;
  private lastPathTick = -Infinity;
  /** The last goal no path led to, and until when not to ask again (doubling with each failure in a row). */
  private noPath: { goal: Vec3; until: number } | null = null;
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
  private mountPlan: { index: number; until: number; drive: boolean; ride?: boolean } | null = null;
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
  private readonly skipMount = (m: MountView): boolean => (this.avoidMounts.get(m.index) ?? -Infinity) > this.lastThinkTick;
  /** Riding with a bot at the wheel: is it getting anywhere? */
  private riderHeadway: Headway = { pos: null, tick: 0 };
  /** The target's mount, when it is in one (refreshed each think). */
  private targetMount: MountView | null = null;
  /** Last tick an enemy in a vehicle was in sight (launchers are worth fetching for a while after). */
  private vehicleSeenTick = -Infinity;
  /** Getting out of an enemy vehicle's way: which way, until when, and whether to sprint. */
  private dodge: { yaw: number; until: number; sprint: boolean } | null = null;
  /** The vehicle bearing down (mount index), when it was first noticed, and whether this bot reacts to it at all this time. */
  private roadkill: { index: number; since: number; notice: boolean } | null = null;
  /** Going to press a button that opens a door in the way. */
  private pressPlan: { stand: Vec3; face: Vec3; until: number } | null = null;
  private pressedAt = -Infinity;
  /** Waiting for or riding a lift: stand still this tick. */
  private holdStill = false;
  /** Last tick's act was aiming and shooting at the target (nothing else on): steer() can stand in for a think. */
  private steerable = false;
  /** Route variety and roles (seeded per bot): a stream of its own, so the bot's other choices stay as they were. */
  private readonly routeRng: () => number;
  /**
   * Holding a vantage spot (camper and sniper roles, director.ts): which spot,
   * when it got there (-1: on the way), how long it holds once there, until when.
   */
  private post: { board: VantageBoard; spot: number; kind: VantageKind; arrived: number; hold: number; until: number } | null = null;
  private nextPost = 0;
  private lastSpot = -1;
  /** Recent stuck recoveries (when and where), to notice being stuck in a loop. */
  private readonly stuckLog: { tick: number; x: number; z: number }[] = [];
  /** Times it gave up on a goal it kept getting stuck on (debug and bench). */
  stuckLoops = 0;
  /** A goal it kept getting stuck on: left alone until then. */
  private avoid: { pos: Vec3; until: number } | null = null;
  /** The squad goal last taken on (a new one replaces the bot's own goal). */
  private squadGoal: Vec3 | null = null;
  /** Catching up with its squad's leader. */
  private regrouping = false;

  constructor(
    readonly slot: number,
    readonly profile: BotProfile,
    readonly difficulty: BotDifficulty,
    seed: number,
  ) {
    this.rng = createRng(seed * 7919 + slot);
    this.routeRng = createRng((seed * 104729 + slot * 7919 + 17) >>> 0);
    this.aim = new AimModel(this.rng, difficulty, profile);
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
  }

  /** It killed someone: a sniper moves on to another spot soon after (they know where the shot came from). */
  onKill(tick: number): void {
    const p = this.post;
    if (p?.kind === 'sniper' && p.arrived >= 0) p.until = Math.min(p.until, tick + Math.round(TICK_RATE * (0.6 + this.routeRng() * 0.8)));
  }

  /** Holding (or heading for) a vantage spot: its kind and position (debug and tests). */
  get vantage(): { kind: VantageKind; pos: Vec3; arrived: boolean } | null {
    const p = this.post;
    return p ? { kind: p.kind, pos: p.board.spots[p.spot]!.pos, arrived: p.arrived >= 0 } : null;
  }

  // ------------------------------------------------------------------ main loop

  think(view: BotWorldView): PlayerInput {
    const seq = ++this.seq;
    const me = view.self;
    this.steerable = false;
    if (!me.alive) {
      this.state = 'dead';
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

    if (view.seat) return this.thinkMounted(view, seq, target, ctx);
    this.useLatch = false;
    if (this.mountPlan && view.tick >= this.mountPlan.until) this.mountPlan = null;

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
      eye: { x: me.pos.x, y: me.pos.y + STANCES[stance].eye, z: me.pos.z },
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
    if (!board || this.post || tick < this.nextPost || view.orderGoal) return;
    if (plan.role !== 'camper' && plan.role !== 'sniper') return;
    const kind: VantageKind = plan.role === 'camper' ? 'camp' : 'sniper';
    if (kind === 'sniper' && !this.hasScope(view)) {
      this.nextPost = tick + TICK_RATE * 5;
      return;
    }
    const towards = plan.towards;
    const prefer = towards?.length
      ? (p: Vec3) => {
          let near = Infinity;
          for (const t of towards) near = Math.min(near, horizontalDistance(t, p));
          return near < 35 ? -2 : near < 130 ? 0.4 : 0;
        }
      : undefined;
    const i = board.pick(kind, view.self.pos, tick, kind === 'sniper' ? 110 : 75, this.routeRng, prefer, this.lastSpot);
    if (i < 0) {
      this.nextPost = tick + TICK_RATE * 8;
      return;
    }
    const hold = kind === 'sniper' ? 25 + this.routeRng() * 25 : this.arena ? 10 + this.routeRng() * 8 : this.methodical ? 25 + this.routeRng() * 20 : 18 + this.routeRng() * 17;
    // Getting there gets a generous allowance; the hold starts on arrival.
    this.post = { board, spot: i, kind, arrived: -1, hold: Math.round(TICK_RATE * hold), until: tick + TICK_RATE * 40 };
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
    return { moveYaw: d > 0.6 ? Math.atan2(spot.pos.x - me.x, spot.pos.z - me.z) : null, stance: p.kind === 'sniper' && scoped && settled ? 2 : 1, moveScale: 0.5 };
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
    if (post && ((post.arrived >= 0 && (this.hurtTick > post.arrived || (underFire && !target))) || tick >= post.until)) this.leavePost(tick, this.postCooldown(post.kind));
    // Holding a spot (or on the way to one): an enemy who slipped out of view, or a noise, isn't worth leaving it for, unless close.
    const holding = this.posted(me.pos);
    const stayPut = (p: Vec3) => !!this.post && horizontalDistance(me.pos, p) > 10;

    // Enemy vehicles about: out of the way of one bearing down.
    this.watchTraffic(view);
    const armedForVehicles = this.canHurtVehicles(view);

    // A lift from a teammate is worth taking even when hurt or with someone about.
    if (this.mountPlan && (this.mountPlan.ride || (!hurt && (!target || horizontalDistance(me.pos, target.pos) > 10)))) this.state = 'mount';
    else if (target && hurt && !this.berserker) this.state = 'retreat';
    else if (!underFire && !armedForVehicles && this.fetchLauncher(view, target)) {
      // An enemy vehicle about and nothing that hurts it: a launcher close by first.
      this.state = 'advance';
    } else if (target) this.state = this.cover ? 'cover' : 'engage';
    else if (this.cover && (underFire || tick - this.lastTargetTick < TICK_RATE * (2.5 + (1 - this.profile.aggression / 100) * 3))) {
      // Ducked out of sight behind cover: keep up the hide-and-peek rather than charging off.
      this.state = 'cover';
    } else if (!underFire && !view.orderGoal && bestLoadedDesirability(view.inventory) <= SIDEARM && (this.gunNearby = this.pickupGoal(view, 'weapon', GUN_DETOUR))) {
      // Only a sidearm: grab a real gun close by before chasing anyone.
      this.state = 'advance';
      this.roamGoal = this.gunNearby;
      this.via = null;
    } else if (this.state === 'retreat' && this.lastKnown && tick - this.lastKnown.tick < TICK_RATE * 3) {
      // Keep running for a moment after losing sight of the threat.
    } else if (this.lastKnown && !hurt && !stayPut(this.lastKnown.pos) && tick - this.lastKnown.tick < TICK_RATE * (1 + (this.profile.pursuitPersistence / 100) * 7) && horizontalDistance(me.pos, this.lastKnown.pos) > 1.5) {
      this.state = 'chase';
    } else if (this.heard && !stayPut(this.heard.pos) && tick - this.heard.tick < TICK_RATE * 10 && horizontalDistance(me.pos, this.heard.pos) > 2) {
      this.state = 'investigate';
    } else {
      if (this.state === 'chase' && this.lastKnown && horizontalDistance(me.pos, this.lastKnown.pos) <= 1.5) {
        // Got there and nobody's here: look around before moving on.
        this.scanUntil = tick + Math.round(TICK_RATE * (0.8 + this.tactical));
        this.scanYaw = this.yaw;
      }
      if (this.state === 'investigate') this.heard = null;
      if (this.state === 'chase') this.lastKnown = null;
      this.state = this.mountPlan ? 'mount' : view.orderGoal ? 'hold' : 'advance';
      if (this.state === 'advance') this.considerPost(view);
    }

    // Cover: under fire, fighting at range, reloading or hurt, for bots that play tactically.
    const threat = target?.pos ?? (underFire ? this.threatFrom : null);
    // Better bots take cover far more often; arena bots mostly keep moving instead.
    // An enemy vehicle it has nothing to hurt with: cover (any bot that thinks at all).
    const outgunned = !!target && this.targetMount?.kind === 'vehicle' && !armedForVehicles;
    const coverChance = Math.max(this.arena ? this.tactical * 0.4 : 0.15 + this.tactical * 1.7 + (this.methodical ? 0.3 : 0), outgunned ? 0.4 + this.tactical * 0.6 : 0);
    if (threat && !this.berserker && !holding && this.rng() < coverChance) {
      const dist = horizontalDistance(me.pos, threat);
      const held = this.heldWeapon(view);
      const lowAmmo = !!held && held.def.magazine > 0 && held.mag <= Math.ceil(held.def.magazine * 0.25);
      const wantCover = underFire || hurt || lowAmmo || !!view.reloading || dist > 11 || this.state === 'retreat' || outgunned;
      const threatEye = { x: threat.x, y: threat.y + PLAYER.eyeHeight, z: threat.z };
      if (this.cover && (horizontalDistance(this.cover.threat, threatEye) > 4 || (tick % 30 < DECIDE_TICKS && !stillCovered(view.physics, this.cover.pos, threatEye)))) {
        // Threat moved round our cover: find another.
        this.cover = null;
      }
      if (wantCover && !this.cover && tick >= this.nextCoverSearch) {
        this.nextCoverSearch = tick + Math.round(TICK_RATE * (1.2 + this.rng()));
        const advance = view.squad?.advance === true;
        this.cover = findCover({
          physics: view.physics,
          nav: view.nav,
          from: me.pos,
          threat: threatEye,
          radius: this.state === 'retreat' ? 9 : 8,
          preferred: advance ? Math.max(6, dist - 8) : this.preferredRange(view),
          avoid: view.allies?.filter((a) => a.slot !== me.slot).map((a) => a.pos),
          away: this.state === 'retreat',
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
    // Bounding squads: the moving half leaves its cover for one further forward.
    if (view.squad?.advance && this.cover && target && horizontalDistance(this.cover.pos, target.pos) > horizontalDistance(me.pos, target.pos) - 1 && tick >= this.nextCoverSearch) {
      this.cover = null;
    }

    this.considerGrenade(view, target);
    this.considerMount(view, target);
  }

  // ------------------------------------------------------------------ per-tick actions

  private act(view: BotWorldView, seq: number, target: CombatantView | undefined, ctx: AimContext): PlayerInput {
    const me = view.self;
    const tick = view.tick;
    this.holdStill = false;
    if (this.pressPlan && tick >= this.pressPlan.until) this.pressPlan = null;
    let moveYaw: number | null = null;
    let moveScale = 1;
    let backOff = false;
    let sprint = false;
    let wantFire = false;
    let stance: Stance = 0;
    let strafe = false;
    let sol: AimSolution | null = null;
    let lookDone = false;
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
      sol = this.aim.solve(ctx, { slot: t.slot, pos: t.pos, stance: this.aimStance(def, t) });
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
        if (hasTag(this.profile, 'SUPPRESSOR') && tick - lk.tick < TICK_RATE * 2.5 && horizontalDistance(me.pos, lk.pos) > 6) {
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
        if (d > m.enterRadius * 0.8) {
          moveYaw = this.followPathTo(view, m.pos, false);
          sprint = d > 8;
        }
        break;
      }
      case 'hold': {
        const g = view.orderGoal;
        if (!g) break;
        if (horizontalDistance(me.pos, g.pos) > g.radius || Math.abs(me.pos.y - g.pos.y) > 2) {
          moveYaw = this.followPathTo(view, g.pos, true);
          moveScale = this.careful() ? 0.8 : 1;
        } else {
          // On station: scan around slowly.
          this.turnToward(this.yaw + 0.6 * TICK_DT * (this.strafeDir || 1), 0);
          lookDone = true;
          if (hasTag(this.profile, 'SNIPER')) stance = 1;
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
          }
        } else this.squadGoal = null;
        if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2 || (tick + this.slot) % (TICK_RATE * 2) === 0) {
          // Re-evaluate pickups now and then; otherwise keep advancing on the current goal.
          const pick = this.pickupGoal(view);
          if (pick) this.roamGoal = pick;
          else if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2) this.pickAdvanceGoal(view);
        }
        let goal = this.roamGoal!;
        if (this.via) {
          if (horizontalDistance(me.pos, this.via) < 4) this.via = null;
          else goal = this.via;
        }
        // A squad member far from its leader catches up first (regroups); one ahead of it waits.
        const follower = !!cl && cl.leader !== me.slot;
        const fromLeader = cl ? horizontalDistance(me.pos, cl.leaderPos) : 0;
        // (Hysteresis: from 28 m out until back within 15 m, so it doesn't swap goals at the edge.)
        this.regrouping = follower && (fromLeader > 28 || (this.regrouping && fromLeader > 15));
        const regroup = this.regrouping;
        if (regroup) goal = cl!.leaderPos;
        // A member already near the squad's goal waits there for the squad's next one (no crowding onto one spot).
        const waiting = follower && !regroup && !!this.squadGoal && !!this.roamGoal && horizontalDistance(this.roamGoal, this.squadGoal) < 1 && horizontalDistance(me.pos, this.squadGoal) < 8;
        moveYaw = waiting ? null : this.followPathTo(view, goal, regroup);
        // Arrived or unreachable: pick another goal next tick.
        if (moveYaw === null && !regroup && !waiting) {
          this.roamGoal = null;
          this.via = null;
        }
        moveScale = this.careful() && this.clearing ? 0.7 : 1;
        if (cl && moveYaw !== null && !regroup) {
          if (follower && cl.goal && fromLeader > cl.spacing * 2 && horizontalDistance(me.pos, cl.goal) < horizontalDistance(cl.leaderPos, cl.goal) - 5) moveScale = Math.min(moveScale, 0.35);
          else if (!follower && cl.lagging) moveScale = Math.min(moveScale, 0.7);
          // Single file through doorways and onto bridges: a member right behind a teammate going the same way lets it through.
          if (follower && this.squadmateAhead(view, moveYaw)) moveYaw = null;
        }
        break;
      }
    }

    // Corner checks and room clearing while moving through the map (not in a fight).
    const travelling = this.state === 'advance' || this.state === 'chase' || this.state === 'investigate' || this.state === 'hold';
    if (travelling && !target && moveYaw !== null && !sprint) {
      const r = this.checkCorners(view);
      if (r.pause !== undefined) {
        moveScale = Math.min(moveScale, r.pause);
        if (r.pause === 0) moveYaw = null;
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
          this.throwPlan = null;
          this.nextThrow = tick + Math.round(TICK_RATE * (6 + this.rng() * 6));
          // Let it go off before walking in after it.
          if (this.pie) this.pie.until = Math.max(this.pie.until, tick + Math.round(TICK_RATE * 2.8));
        }
      }
    }

    if (!lookDone) {
      if (tick < this.scanUntil) {
        this.turnToward(this.scanYaw + Math.sin((this.scanUntil - tick) / 14) * 1.6, 0);
      } else if (this.state === 'chase' && this.lastKnown && horizontalDistance(me.pos, this.lastKnown.pos) < 30 && this.canSee(view, ctx.eye, this.lastKnown.pos)) {
        // Keep the gun on where they were while closing in.
        this.lookAt(view, this.lastKnown.pos, 1.2);
      } else this.lookAlongPath(view);
    }

    if (moveYaw !== null && this.hazardAhead(view, moveYaw)) moveYaw = null;
    // Going somewhere (or fighting on the move), as opposed to only being nudged aside by a teammate: what stuck checks judge.
    const meaning = moveYaw !== null || backOff || strafe;
    moveYaw = this.separate(view, moveYaw);

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
    }
    const plan = this.pressPlan;
    if (plan && horizontalDistance(me.pos, plan.stand) < 0.8 && Math.abs(me.pos.y - plan.stand.y) < 1) {
      forward = 0;
      right = 0;
      const a = lookAngles({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, plan.face);
      this.turnToward(a.yaw, a.pitch);
      if (Math.abs(angleDelta(this.yaw, a.yaw)) < 0.3 && Math.abs(this.pitch - a.pitch) < 0.3) {
        pressNow = true;
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

    let buttons = 0;
    // Fire through the aim model's trigger discipline.
    const reacted = target ? this.reacted(view, target) : true;
    let pull = false;
    const ta = simProfile.on ? performance.now() : 0;
    if (wantFire && sol && !sprint) pull = this.aim.trigger(ctx, sol, this.yaw, this.pitch, reacted);
    else this.aim.trigger(ctx, { yaw: this.yaw + 9, pitch: 0, dist: 1, halfAngle: 0 }, this.yaw, this.pitch, false);
    if (simProfile.on) simProfile.add('botAim', performance.now() - ta);
    if (pull) buttons |= BUTTON_FIRE;
    // Scoped weapons are fired through the scope (they spray from the hip); not up close.
    const sDist = (sol as AimSolution | null)?.dist ?? 0;
    if (wantFire && def?.view.zoomFov && !def.alt && sDist > 7) buttons |= BUTTON_ZOOM;
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
    // Dry up close: punch or kick (quick melee) rather than click an empty gun.
    if (target && held && held.def.kind !== 'melee' && !held.def.projectile?.disc && held.def.magazine > 0 && held.mag === 0 && held.reserve === 0 && horizontalDistance(me.pos, target.pos) < 2 && (tick + this.slot) % 12 === 0) {
      buttons |= BUTTON_MELEE;
      buttons &= ~BUTTON_FIRE;
    }
    if (view.reloading && !this.berserker && target && moveYaw === null) stance = Math.max(stance, 1) as Stance;
    // Badly hurt and hidden: lie flat.
    if (hurt && inCoverHidden && this.tactical > 0.5) stance = 2;

    if (pressNow) buttons |= BUTTON_USE;
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
    if (this.checkStuck(view, meaning && (forward !== 0 || right !== 0)) || this.jumpNext) {
      buttons |= BUTTON_JUMP;
      this.jumpNext = false;
    }
    // Getting in: use when close enough to the planned mount.
    if (this.state === 'mount' && this.mountPlan) {
      const m = view.mounts?.find((x) => x.index === this.mountPlan!.index);
      if (m && horizontalDistance(me.pos, m.pos) <= m.enterRadius * (this.mountPlan.ride ? 0.85 : 0.8) && Math.abs(m.pos.y - me.pos.y) < 2.3 && tick - this.lastUseTick > 20) {
        buttons |= BUTTON_USE;
        this.lastUseTick = tick;
      }
    }
    this.steerable = aimedTarget && wantFire && !sprint && !dodge && !throwNow && !pressNow && !this.throwPlan && !this.pressPlan && !this.holdStill && this.state !== 'mount';
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
    this.aim.track(ctx, aimed);
    const sol = this.aim.solve(ctx, aimed);
    this.turnToward(sol.yaw, sol.pitch);
    const fire = this.aim.trigger(ctx, sol, this.yaw, this.pitch, this.reacted(view, target));
    if (simProfile.on) simProfile.add('botAim', performance.now() - ta);
    this.lastTargetTick = tick;
    // The same smoothed movement over the ground, seen from the new facing.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const def = ctx.weapon;
    return { forward: sin * this.moveX + cos * this.moveZ, right: cos * this.moveX - sin * this.moveZ, yaw: this.yaw, pitch: this.pitch, fire, zoom: !!(def?.view.zoomFov && !def.alt && sol.dist > 7) };
  }

  /** Scratch for steer()'s aim target. */
  private readonly aimed: AimTarget = { slot: -1, pos: { x: 0, y: 0, z: 0 }, stance: 0 };

  private sightCache = { tick: -Infinity, ok: false };

  /** Line of sight to a spot, rechecked a few times a second (it only steers the look). */
  private canSee(view: BotWorldView, eye: Vec3, p: Vec3): boolean {
    if (view.tick - this.sightCache.tick >= DECIDE_TICKS) this.sightCache = { tick: view.tick, ok: view.physics.lineOfSight(eye, { x: p.x, y: p.y + 1.2, z: p.z }) };
    return this.sightCache.ok;
  }

  /** Searching and clearing at a walk, not a run (berserkers don't bother). */
  private careful(): boolean {
    if (this.methodical) return true;
    return !this.berserker && !this.arena && this.tactical > 0.3;
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
    if (wx === 0 && wz === 0 && Math.hypot(this.moveX, this.moveZ) < 0.08) this.moveX = this.moveZ = 0;
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
      const l = Math.hypot(tx, tz) || 1;
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
    if (this.throwPlan || tick < this.nextThrow || !(view.throwables ?? 0) || !view.throwable || view.throwable === 'mine' || view.throwable === 'sandbag') return;
    if (this.rng() > 0.25 + this.tactical * 0.5) return;
    const me = view.self;
    const eye = { x: me.pos.x, y: me.pos.y + STANCES[me.stance ?? 0].eye, z: me.pos.z };
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
    // Don't throw if it would land close to ourselves.
    if (horizontalDistance(sol.impact, me.pos) < spec.splashRadius + 0.5) return;
    this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: tick + TICK_RATE };
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
      this.drive = freshDrive();
      this.useLatch = true;
      this.path = [];
      this.goal = null;
      this.moveX = this.moveZ = 0;
      this.rideIdleSince = this.noDriverSince = -Infinity;
      this.bailDelay = Math.round(TICK_RATE * (0.35 + this.rng() * 0.5));
      this.riderHeadway = { pos: null, tick: 0 };
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
      // Get out: arrived, about to blow (or on fire), stuck for good (a back-out didn't free it), or a fight with no gun.
      if (left < 14 || aboutToBlow(m) || this.drive.stuck || (target && !seat.weapon && horizontalDistance(m.pos, target.pos) < 22)) leave = true;
      // Don't climb straight back into the one that got stuck.
      if (this.drive.stuck) this.avoidMounts.set(m.index, tick + TICK_RATE * STUCK_AVOID_SECONDS);
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
      const parked = tick - this.rideIdleSince > TICK_RATE * 8 && tick - this.lastTargetTick > TICK_RATE * 4;
      // (A human at the wheel may stop on purpose; a bot driver never parks with riders.)
      const stuck = driven && !ally.human && noHeadway(this.riderHeadway, m.pos, tick, RIDER_STUCK_TICKS, RIDER_MIN_PROGRESS);
      if (stuck) this.avoidMounts.set(m.index, tick + TICK_RATE * STUCK_AVOID_SECONDS);
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
    const me = view.self;
    let best: { pos: Vec3; score: number } | null = null;
    const owned = new Map(view.inventory.map((w) => [w.def.id, w]));
    const bestOwned = bestLoadedDesirability(view.inventory);
    for (const p of view.pickups) {
      // Arena bots time the respawns: head for an item that will be back by the time they get there.
      const timed = this.arena && p.respawnIn !== undefined && p.respawnIn < horizontalDistance(me.pos, p.pos) / 5 + 1;
      if (!p.available && !timed) continue;
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
    return best ? { ...best.pos } : null;
  }

  /**
   * Where to advance next: in team modes the enemy's side of the map (by one
   * of several routes, so teammates spread out); otherwise the places it
   * hasn't checked lately.
   */
  private pickAdvanceGoal(view: BotWorldView): void {
    const me = view.self;
    const pts = view.spawnPoints;
    const places = view.nav.places();
    this.via = null;
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
    myEye.y = me.pos.y + STANCES[me.stance ?? 0].eye;
    myEye.z = me.pos.z;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.memory.mark(me.pos, tick);
    // Who could be seen (in range, in view or close enough to hear, not hidden in a bush), nearest first.
    const live = this.live;
    live.length = 0;
    for (const o of view.others) {
      if (!o.alive) continue;
      const ox = o.pos.x - me.pos.x;
      const oy = o.pos.y - me.pos.y;
      const oz = o.pos.z - me.pos.z;
      const d2 = ox * ox + oy * oy + oz * oz;
      if (d2 >= SIGHT_RANGE * SIGHT_RANGE) continue;
      const d = Math.sqrt(d2);
      const range = SIGHT_RANGE * STANCE_SIGHT[o.stance ?? 0];
      if (d > range && !this.visibleSince.has(o.slot)) continue;
      const dx = ox / (d || 1);
      const dz = oz / (d || 1);
      const inFov = dx * fx + dz * fz >= FOV_COS * Math.sqrt(dx * dx + dz * dz);
      if (!inFov && d > HEARING_RANGE) continue;
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
      theirEye.y = o.pos.y + STANCES[o.stance ?? 0].eye;
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
      const d = Math.hypot(dx, dz);
      if (d < 2.6 && d > 1e-3 && (dx * fx + dz * fz) / d > 0.7) return true;
    }
    return false;
  }

  /**
   * Teammates don't stack up: steer away from allies close by, and step aside when
   * standing on top of one (squads walking one navmesh path would otherwise move as a clump).
   */
  private separate(view: BotWorldView, moveYaw: number | null): number | null {
    if (!view.allies?.length) return moveYaw;
    const me = view.self.pos;
    let px = 0;
    let pz = 0;
    const near = view.alliesGrid ? view.alliesGrid.near(me.x, me.z, 2.2, this.nearScratch) : view.allies;
    for (const a of near) {
      if (a.slot === view.self.slot) continue;
      const dx = me.x - a.pos.x;
      const dz = me.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 2.2 * 2.2 || Math.abs(a.pos.y - me.y) > 1.5) continue;
      const d = Math.sqrt(d2);
      // Exactly on top of each other: split by slot so the two go opposite ways.
      const ux = d < 1e-3 ? (view.self.slot < a.slot ? 1 : -1) : dx / d;
      const uz = d < 1e-3 ? 0 : dz / d;
      px += ux * (2.2 - d);
      pz += uz * (2.2 - d);
    }
    if (!px && !pz) return moveYaw;
    if (moveYaw === null) return Math.hypot(px, pz) > 1.4 ? Math.atan2(px, pz) : null;
    const mx = Math.sin(moveYaw) + px;
    const mz = Math.cos(moveYaw) + pz;
    return Math.atan2(mx, mz);
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
    // A door in the way that a button opens: the button first.
    if (this.pressPlan) {
      goal = this.pressPlan.stand;
      movingGoal = false;
    }
    const goalMoved = this.goal === null || horizontalDistance(this.goal, goal) > 2 || Math.abs(this.goal.y - goal.y) > 1.5;
    const stale = movingGoal && view.tick - this.lastPathTick > PATH_REFRESH_TICKS;
    // Ran out of corners without arriving (e.g. pushed off the path): replan, throttled.
    const exhausted = this.pathIndex >= this.path.length && horizontalDistance(me.pos, goal) > 1;
    if ((goalMoved && view.tick - this.lastPathTick >= 2) || ((stale || exhausted) && view.tick - this.lastPathTick >= 6)) {
      this.goal = { ...goal };
      // No way there a moment ago: don't search again every few ticks, back off (0.2 s, doubling up to 4 s).
      const np = this.noPath;
      const backedOff = !!np && view.tick < np.until && horizontalDistance(np.goal, goal) < 2 && Math.abs(np.goal.y - goal.y) < 1.5;
      const found = backedOff ? null : view.nav.findPath(me.pos, goal);
      if (!backedOff) {
        this.pathFails = found ? 0 : Math.min(this.pathFails + 1, 6);
        this.noPath = found ? null : { goal: { ...goal }, until: view.tick + Math.min(TICK_RATE * 4, 6 << this.pathFails) };
      }
      this.path = found ?? [];
      const door = this.pathBlocked(view);
      if (door) {
        this.path = [];
        if (!this.pressPlan && view.tick - this.pressedAt > TICK_RATE * 3) this.planPress(view, door);
      }
      this.pathIndex = this.path.length > 1 ? 1 : 0;
      this.lastPathTick = view.tick;
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
      if (this.path.length === 0 || horizontalDistance(me.pos, goal) < 0.5) return null;
      return Math.atan2(goal.x - me.pos.x, goal.z - me.pos.z);
    }
    if (view.lifts?.length) this.holdStill = this.liftWait(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null);
    // Taking a portal: the next corner is out of the far portal, so walk into this one's surface instead.
    const face = view.portals?.length ? this.portalFace(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1]! : null) : null;
    if (face) return Math.atan2(face.x - me.pos.x, face.z - me.pos.z);
    return Math.atan2(corner.x - me.pos.x, corner.z - me.pos.z);
  }

  /** The portal surface to walk into when the path's next leg is a portal link (from in front of one portal to out of the other). */
  private portalFace(view: BotWorldView, corner: Vec3, prev: Vec3 | null): Vec3 | null {
    if (!prev) return null;
    const near = (a: Vec3, b: Vec3, r: number) => horizontalDistance(a, b) < r && Math.abs(a.y - b.y) < 1.2;
    for (const p of view.portals!) if (near(prev, p.start, 1.6) && near(corner, p.end, 1.8)) return p.face;
    return null;
  }

  /** Went through a portal: the view turned with you (the server turned the body). */
  turned(turn: number): void {
    this.yaw += turn;
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
        // Walking up to it: wait back from the edge while the platform is away.
        if (Math.abs(l.top.y - l.start.y) > 0.3 && horizontalDistance(me, l.start) < 2.5) return true;
      }
    }
    return false;
  }

  /** The path is shut by a door some button opens: go and press it (if it can be reached). */
  private planPress(view: BotWorldView, door: Aabb): void {
    const same = (a: Aabb, b: Aabb) => Math.abs(a.min.x - b.min.x) + Math.abs(a.min.z - b.min.z) + Math.abs(a.max.x - b.max.x) + Math.abs(a.max.z - b.max.z) + Math.abs(a.min.y - b.min.y) < 0.05;
    const me = view.self.pos;
    const options = (view.doorButtons ?? []).filter((d) => same(d.door, door)).sort((a, b) => horizontalDistance(me, a.stand) - horizontalDistance(me, b.stand));
    for (const o of options) {
      const path = view.nav.findPath(me, o.stand);
      if (!path) continue;
      const saved = this.path;
      this.path = path;
      const blocked = this.pathBlocked(view);
      this.path = saved;
      if (blocked) continue;
      this.pressPlan = { stand: o.stand, face: o.face, until: view.tick + TICK_RATE * 20 };
      this.path = path;
      this.goal = { ...o.stand };
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
    const shut = view.portals?.filter((p) => !p.on);
    if (shut?.length) {
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
    if (log.length >= 3 && log.every((l) => Math.hypot(l.x - pos.x, l.z - pos.z) < 4)) {
      log.length = 0;
      this.stuckLoops++;
      if (this.roamGoal) this.avoid = { pos: { ...this.roamGoal }, until: view.tick + TICK_RATE * 20 };
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
 * Arena hopping: the seconds (least, most) until the next hop, or null for no
 * hop now. `always` is the Arena match style (constant bunny-hopping while
 * strafing or running); otherwise an ARENA character on the Mixed style hops
 * only in a fight (a target, or under fire), while it strafes, and less often.
 */
export function arenaHop(always: boolean, fighting: boolean, strafing: boolean, running: boolean): [number, number] | null {
  if (always) return strafing || running ? [0.5, 1.1] : null;
  return fighting && strafing ? [1.3, 2.4] : null;
}
