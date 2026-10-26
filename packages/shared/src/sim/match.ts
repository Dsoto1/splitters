import type RAPIER from '@dimforge/rapier3d-compat';
import { BotBrain, type CombatantView, type MountView, type NoiseView, type PickupView, type SeatView } from '../bots/brain.ts';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, profileFor, type BotDifficulty, type BotProfile } from '../bots/profile.ts';
import { blockBoxes, buildMapGeometry, mapKillY, mapTerrainMesh, propBoxes, type WorldBox } from '../map/geometry.ts';
import { EncounterEntity as EncounterSchema, NPC_ROLES, PLAYERS_FACTION, type EncounterEntity, type Faction, type MapDocument, type NpcRole } from '../map/schema.ts';
import { add, createRng, distance, dot, horizontalDistance, lookAngles, normalize, scale, sub, viewDirection, type Vec3 } from '../math.ts';
import {
  MOUNT_BURN_FRACTION, MOUNT_BURN_SECONDS, MOUNT_FLAG_ALIVE, MOUNT_FLAG_BURNING, MOUNT_FLAG_WRECK, MOUNT_WRECK_FADE_SECONDS, MOUNT_WRECK_SECONDS, VEHICLE_DAMAGE_SCALE,
  AIRPLANE_DEF, BUILT_MOUNT_BASE, MOUNT_DEFS, footprintGap, getMountDef, mountMass, mountToWorld, type MountDef, type SeatDef, type SeatRole,
} from './mounts.ts';
import { airRoute, dropTarget, routePose, shouldJump, ticksToRouteEnd, type AirRoute } from './airplane.ts';
import { CHUTE, heightAboveGround } from './parachute.ts';
import { NavWorld } from '../nav/index.ts';
import {
  POWERUP_DAMAGE_BIT,
  POWERUP_SPEED_BIT,
  STATUS_BURN,
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
import { BODY_SIZES, MAX_PLAYER_SLOTS, PLAYER, TICK_DT, TICK_RATE } from './constants.ts';
import { ARMOR_ABSORB, DAMAGE_BOOST, MAX_ARMOR, PICKUP_RADIUS, SPEED_BOOST, STREAK_REWARDS, getItem, type ItemDefinition } from './items.ts';
import { bodyHeightOf, eyeHeightOf, stanceOf } from './movement.ts';
import { getProp } from '../content/props.ts';
import { BUTTON_ALT, BUTTON_JUMP, BUTTON_CROUCH, BUTTON_PRONE, BUTTON_SPRINT, EMOTE_DANCE, PING, QUICK_MESSAGES, SAY_FOLLOW, SAY_HOLD, BUTTON_RESPAWN, BUTTON_FIRE, BUTTON_RELOAD, BUTTON_ZOOM, BUTTON_THROW, BUTTON_USE, applyPads, mapLadders, mapPads, navLinks,
  padLandings, sanitizeInput, stepMovement, gravityAt, mapGravityZones, type GravityZone, type JumpPad, type Ladder, type MoveState, type PlayerInput } from './movement.ts';
import { PhysicsWorld } from './physics.ts';
import { BREATH_SECONDS, JET, LIQUID_SPECS, liquidAt, mapLiquids, stepJetFuel, type LiquidBox } from './liquids.ts';
import { DEFAULT_DEATHMATCH_RULES, isTeamMode, matchPhysics, restrictedWeapons, type MatchRules } from './rules.ts';
import type { CarryOver } from './playlist.ts';
import { ClassPlay, classFromSay, classIndex, classesInPlay, type ClassState } from './classes.ts';
import { ARENA_DISC, DISC_KNOCK_CREDIT_SECONDS, DISC_SPAWN_GUARD_SECONDS, DISC_POWERS, DISC_POWER_SHOTS, discThrows, dodgeDisc, keepOnDeck, splitVelocities, type DiscPower } from './discs.ts';
import { createMode, type ModeLogic } from './modes/index.ts';
import { Scenario } from './scenario.ts';
import { liftLinks } from './movers.ts';
import { Encounters } from './encounters.ts';
import { ZombieSurvival } from './zombies.ts';
import { RaceDirector, raceShot, roadHandling, type RaceVehicleView } from './race.ts';
import { TrackDriver } from './trackDriver.ts';
import { ambientCarEntities, raceGridEntities, trackGeometry, type TrackGeometry } from '../map/track.ts';
import { chargeIntoMelee } from './creatures.ts';
import { DEFAULT_LOOK, bodySizeOf, getLook, lookForBot } from '../content/looks.ts';
import { NPC_DAMAGE_TO_PLAYERS, NPC_ID_BASE, NPC_ROLE_PROFILES, NPC_ROLE_SPECS, mapFactions, mapTeams, matchTeams, relation, validLookId } from './npc.ts';
import {
  BULLET_LIFETIME, BULLET_SUBSTEPS, MATERIAL_BALLISTICS, MAX_PENETRATIONS, MAX_RICOCHETS, NEAR_INSTANT_M,
  RELOAD_KINDS, RICOCHET_MAX_ANGLE, beginReload, bulletPhysics, counterRecoil, entityMaterial, falloffAt, flyBullet, gunplayOf, lethalityScale, newGunState, penetrate, recoilIdle, recoilShot, ricochets, roundsReady, spreadOf, stepAds, stepReload, surfaceMaterial,
  type BallisticMaterial, type GunState, type Gunplay, type ReloadRun,
} from './gunplay.ts';
import { OIL_TRACTION, PROJECTILE_VISUALS, THROWABLES, THROWABLE_DEFS, ZONE_KINDS, getWeapon, zoneContains, rayCapsule, weaponByCode, weaponCode, resolveHitscan, throwableWeaponId, hitZone, type HitZone, type AltFire, type ProjectileSpec, type StatusHit, type ThrowableKind, type WeaponDefinition, type ZoneKind, type ZoneSpec } from './weapons.ts';

/** At most this many queued inputs are applied per player per tick, which caps speed hacks. */
const MAX_INPUTS_PER_TICK = 2;
const MAX_QUEUED_INPUTS = 16;
/** Lag compensation never rewinds further than this (≈ 300 ms). */
export const MAX_REWIND_TICKS = 18;
const HISTORY_TICKS = MAX_REWIND_TICKS + 2;
/** Projectiles ignore their owner briefly so they don't explode in the shooter's face. */
const OWNER_GRACE_TICKS = 8;
/** Start gate: the longest a match waits for its players to load, and the countdown after. */
export const START_WAIT_SECONDS = 30;
export const COUNTDOWN_SECONDS = 3;
/** Vehicle crashes: closing speed (m/s) below which nothing is hurt, and damage per m/s over it (split by weight). */
const RAM_MIN_SPEED = 5;
const RAM_DAMAGE = 8;
/** Bots see hostile sentries as targets with these IDs (+ mount index); never a real actor ID. */
const SENTRY_VIEW_BASE = 1_000_000;
/** Racing bots hold their fire this long after the start. */
const RACE_HOLD_FIRE_TICKS = TICK_RATE * 10;

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
}

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
  body: RAPIER.Collider;
  probe: RAPIER.Collider | null;
  faction: string | null;
  /** The driver's controls this tick. */
  /** Driver's controls: throttle, steering and the handbrake (jump); in a flyer, jump climbs and crouch dives (`lift`). */
  drive: { forward: number; right: number; brake?: boolean; lift?: number };
  /** Sideways slide (m/s along the vehicle's right), kept between ticks so it drifts. */
  slide: number;
  airborne: boolean;
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
  /** The transport plane: the route it flies and how players board it (see airplane.ts). */
  route?: AirRoute;
  airdrop?: 'off' | 'start' | 'always';
}

export interface Combatant {
  /** Actor ID: the player slot (0..31), or NPC_ID_BASE + n for NPCs. */
  slot: number;
  kind: 'human' | 'bot' | 'npc';
  /** Faction; null = free-for-all player (deathmatch). */
  faction: string | null;
  /** Movement speed multiplier (NPC roles are slower). */
  speedMul: number;
  /** Body size scale (BODY_SIZES): height, width and eyes. 1 for standard. */
  size: number;
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
  /** Kills since this one last died (kill-streak rewards). */
  streak?: number;
  /** A teammate's order to a bot: follow them, or hold a spot, until `until`. */
  order?: { kind: 'follow' | 'hold'; leader: number; pos: Vec3; until: number };
  /** NPC details. */
  /** `damage`: the encounter's damage multiplier (MapMaker). */
  npc?: { encounter: string; role: NpcRole; removeAt: number; damage: number };
  /** Character look (players and bots). */
  look: string;
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
  /** Owned weapons by weapon code. */
  weapons: Map<number, WeaponState>;
  /** Code of the held weapon. */
  current: number;
  /** Carried grenades or mines (G), or none. */
  throwable: { kind: ThrowableKind; count: number } | null;
  // Timers below count applied inputs (not server ticks) so client prediction can mirror them exactly.
  fireCooldown: number;
  throwCooldown: number;
  reloadTicks: number;
  raiseTicks: number;
  speedTicks: number;
  damageTicks: number;
  /** Trigger state: buttons last input, spin-up/charge, semi-auto latch, burst in progress, spread bloom. */
  prevButtons: number;
  /** Tick this player last pressed Use (E): objective modes read it (Bomb: plant / defuse). */
  useTick?: number;
  windup: number;
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
  /** Status effects (ticks left; chill builds 0..1 into a freeze), and who caused them (kill credit). */
  burnTicks: number;
  /** Jetpack fuel units (see JET), or null without a jetpack. */
  jetFuel: number | null;
  /** Ticks spent with your head under water (drowning starts after BREATH_SECONDS). */
  breath: number;
  poisonTicks: number;
  slowTicks: number;
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

type ShotTargets = readonly { slot: number; feet: Vec3; height: number; radius: number }[];

/** A ground hazard or field (see ZONE_KINDS). */
interface Zone {
  kind: ZoneKind;
  pos: Vec3;
  radius: number;
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
  item: ItemDefinition;
  pos: Vec3;
  respawnTicks: number;
  availableAt: number;
  /** Scenario logic can switch pickups off. */
  enabled: boolean;
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const tuple = (v: Vec3): Tuple3 => [r3(v.x), r3(v.y), r3(v.z)];
const chest = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + PLAYER.height * 0.55, z: p.z });

export const heldWeapon = (c: Combatant): WeaponState => c.weapons.get(c.current)!;

/**
 * Authoritative Deathmatch simulation. Contains no networking or Node/DOM
 * APIs, so the dedicated server, tests, load harness and the in-browser
 * MapMaker TEST all drive the same code by calling step().
 */
export class Match {
  readonly geometry: WorldBox[];
  /** Falling below this height kills (some way under the lowest floor). */
  readonly killY: number;
  /** Gravity multiple and fall damage in force (match rules over the map's own). */
  readonly phys: { gravity: number; fallDamage: boolean };
  readonly physics: PhysicsWorld;
  /** Rebuilt mid-match only by Fort Wars (when the forts are done). */
  nav: NavWorld;
  readonly slots: (Combatant | null)[] = new Array(MAX_PLAYER_SLOTS).fill(null);
  readonly spawnPoints: { pos: Vec3; yaw: number; team: string | null }[];
  readonly pickups: PickupState[];
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
  private readonly liquids: LiquidBox[];
  /** Low-gravity (or heavy) zones: movement falls by their factor inside. */
  private readonly gravityZones: GravityZone[];
  private readonly mounts: MountRt[] = [];
  /** Collider handle -> mount, so shots and blasts can hurt vehicles. */
  private readonly mountBodies = new Map<number, MountRt>();
  /** Air drop: who has had this round's start in the plane, and where each bot aboard means to jump (target, last distance). */
  private readonly airdropped = new Set<number>();
  private readonly planeDrops = new Map<number, { target: Vec3; prev?: number }>();
  private nextProjectileId = 1;
  private covers: Cover[] = [];
  /** UAV sweeps running: side (team, or one player in free-for-all) -> tick it ends. */
  private readonly uavUntil = new Map<string, number>();
  /** Counter-UAVs running: the jamming side -> tick it ends (everyone else's minimap is jammed). */
  private readonly jamUntil = new Map<string, number>();
  private nextCoverId = 1;
  /** Positions of everyone at recent ticks, for lag-compensated hitscan. */
  private readonly history = new Map<number, Map<number, Vec3 & { h: number }>>();
  /** Bot AI time spent in the most recent tick, for instrumentation. */
  lastAiMs = 0;
  /** Objective rules (Capture the Flag, King of the Hill, Elimination); null in other modes. */
  readonly mode: ModeLogic | null;
  /** The race in Race mode (null in every other mode); see race.ts. */
  readonly race: RaceDirector | null;
  /** The map's race track, if it has one (vehicles grip better on the road in any mode). */
  private readonly road: TrackGeometry | null;
  /** Racing Player Bots' drivers (by slot). */
  private readonly raceBots = new Map<number, TrackDriver>();
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
     * `startGate`: hold the start until every human has loaded (`ready`), at
     * most START_WAIT_SECONDS, then count down; every later round counts down
     * too. Off (play at once) for headless matches and tests.
     */
    private readonly opts: { startGate?: boolean } = {},
  ) {
    this.geometry = buildMapGeometry(map);
    this.killY = mapKillY(this.geometry, map);
    this.phys = matchPhysics(rules, map);
    this.physics = new PhysicsWorld(this.geometry, mapTerrainMesh(map));
    // Bots plan around breakable props too (they are scenario colliders, not static geometry).
    this.nav = NavWorld.build([...this.geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), [...navLinks(map.entities, this.physics, this.phys.gravity), ...liftLinks(map)]);
    this.rng = createRng(seed);
    this.spawnPoints = map.entities
      .filter((e) => e.kind === 'spawn')
      .map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, yaw: e.yaw, team: e.faction }));
    this.pickups = [];
    for (const e of map.entities) {
      if (e.kind !== 'pickup') continue;
      const item = getItem(e.item);
      if (!item) continue;
      this.pickups.push({ id: e.id, item, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, respawnTicks: Math.round((e.respawnSeconds ?? item.respawnSeconds) * TICK_RATE), availableAt: 0, enabled: true });
    }
    for (const e of map.entities) {
      if (e.kind !== 'prop') continue;
      const def = getProp(e.model);
      if (!def?.conceals) continue;
      this.hides.push({ x: e.position[0], z: e.position[2], r: (Math.min(def.size[0], def.size[2]) * e.scale) / 2, y0: e.position[1] - 0.3, y1: e.position[1] + def.size[1] * e.scale });
    }
    map.entities.forEach((e, index) => {
      if (e.kind !== 'mount') return;
      const def = getMountDef(e.model);
      if (def) this.addMount(index, def, { x: e.position[0], y: e.position[1], z: e.position[2] }, e.yaw, e.faction, e.respawnSeconds);
    });
    // Race: the start-grid vehicles, after the map's own mounts (clients add the same ones: withRaceGrid).
    this.road = trackGeometry(map);
    const gridMounts: number[] = [];
    if (rules.mode === 'core.race') {
      raceGridEntities(map, rules.raceVehicle).forEach((e, i) => {
        const def = getMountDef(e.model);
        if (!def) return;
        gridMounts.push(this.mounts.length);
        // They never come back on their own: the race puts them where they're needed.
        this.addMount(map.entities.length + i, def, { x: e.position[0], y: e.position[1], z: e.position[2] }, e.yaw, null, 1e6);
      });
    }
    // Ambient cars (any mode): out on the track at first; wrecked ones come back in the pit lane.
    if (this.road) {
      const base = map.entities.length + gridMounts.length;
      for (const [i, car] of ambientCarEntities(map).entries()) {
        const def = getMountDef(car.entity.model);
        if (!def) continue;
        const index = this.mounts.length;
        this.addMount(base + i, def, { x: car.entity.position[0], y: car.entity.position[1], z: car.entity.position[2] }, car.entity.yaw, null, 12);
        this.mounts[index]!.home = { pos: { x: car.pit[0], y: car.pit[1], z: car.pit[2] }, yaw: car.pitYaw };
        this.ambient.push({ mount: index, driver: new TrackDriver(((i % 3) - 1) * 0.4, 0.86 + (i % 4) * 0.04), stuck: 0 });
      }
    }
    // Transport planes: mounts that fly their route, can't be hurt and don't block anything.
    map.entities.forEach((e, index) => {
      if (e.kind !== 'airplane') return;
      const route = airRoute(e);
      const pose = routePose(route, 0);
      this.addMount(index, AIRPLANE_DEF, { x: pose.pos.x, y: pose.pos.y, z: pose.pos.z }, pose.yaw, null, null);
      const m = this.mounts[this.mounts.length - 1]!;
      m.route = route;
      m.airdrop = e.airdrop;
      this.physics.setBoxEnabled(m.body, false);
    });
    this.pads = mapPads(map.entities);
    this.ladders = mapLadders(map.entities);
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
        this.pendingEvents.push({ e: 'explode', s: owner ?? -1, p: tuple(at), r: radius });
        this.splash(at, radius, damage, edge, owner === null ? null : (this.actor(owner) ?? null), weapon, 1);
      },
      endRound: (winner, outcome, next) => this.endRound(winner, outcome, next),
      encounter: (id, op, order) => {
        if (op === 'start') this.encounters.start(id);
        else if (op === 'stop') this.encounters.stop(id);
        else if (order) this.encounters.setOrder(id, order);
      },
      encounterAlive: (id) => this.encounters.alive(id),
      setPickupEnabled: (id, enabled) => {
        const p = this.pickups.find((q) => q.id === id);
        if (p) p.enabled = enabled;
      },
      emit: (ev) => this.pendingEvents.push(ev),
    });
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
          endRound: () => this.endRound(),
          respawn: (c) => {
            this.leaveMount(c, false);
            this.spawn(c);
          },
          groundBelow: (p) => {
            const hit = this.physics.raycastHit(p, { x: 0, y: -1, z: 0 }, 8);
            return hit ? p.y - hit.dist : null;
          },
          path: (a, b) => this.nav.findPath(a, b),
          explode: (at, radius, damage, by) => {
            this.pendingEvents.push({ e: 'explode', s: by?.slot ?? -1, p: tuple(at), r: radius });
            this.splash(at, radius, damage, damage * 0.15, by, 'core.bomb', 1, 8);
          },
          physics: this.physics,
          spawnPoints: this.spawnPoints,
          rebuildNav: (extra) => this.rebuildNav(extra),
        })
      : null;
    this.zombies = rules.mode === 'core.zombies' ? this.zombieDirector() : null;
    this.classes = classesInPlay(rules) ? this.classDirector() : null;
    this.race = rules.mode === 'core.race' && this.road ? this.raceDirector(this.road, gridMounts) : null;
  }

  /** Race: the director and its link to the match (vehicles, racers, the end of the race). */
  private raceDirector(track: TrackGeometry, gridMounts: number[]): RaceDirector {
    const match = this;
    return new RaceDirector(
      {
        get tick() {
          return match.tick;
        },
        gridMounts,
        racers: () => this.combatants().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos, mount: c.mount?.index ?? null, driving: this.seatOf(c)?.role === 'driver' })),
        vehicle: (i) => {
          const m = this.mounts[i];
          return m ? this.raceVehicle(m) : null;
        },
        placeRacer: (slot, i, pos, yaw) => this.placeRacer(slot, i, pos, yaw),
        park: (i) => {
          const m = this.mounts[i];
          if (!m) return;
          for (const slot of m.seats) if (slot !== null) this.leaveMount(this.actor(slot)!, true);
          m.alive = false;
          m.respawnAt = Infinity;
          this.physics.setBoxEnabled(m.body, false);
        },
        emit: (ev) => this.pendingEvents.push(ev),
        endRace: (winner) => this.endRound(winner),
      },
      track,
      this.rules.raceLaps ?? track.track.laps,
      this.rules.raceCombat ?? track.track.combat,
      !this.opts.startGate,
    );
  }

  private raceVehicle(m: MountRt): RaceVehicleView {
    return { alive: m.alive, pos: m.pos, yaw: m.yaw, speed: m.speed, maxSpeed: m.def.vehicle?.maxSpeed ?? 0 };
  }

  /** Race: a fresh vehicle at `pos` (on the ground under it), facing `yaw`, with the racer at the wheel. */
  private placeRacer(slot: number, index: number, pos: Vec3, yaw: number): void {
    const c = this.slots[slot];
    const m = this.mounts[index];
    if (!c?.alive || !m) return;
    if (c.mount && c.mount.index !== index) this.leaveMount(c, false);
    for (const other of m.seats) if (other !== null && other !== slot) this.leaveMount(this.actor(other)!, true);
    const from = { x: pos.x, y: pos.y + 4, z: pos.z };
    const hit = this.physics.raycastHit(from, { x: 0, y: -1, z: 0 }, 12);
    const y = hit && !this.mountBodies.has(hit.handle) ? from.y - hit.dist : pos.y;
    m.home = { pos: { x: pos.x, y: y + 0.05, z: pos.z }, yaw };
    this.respawnMount(m);
    m.respawnAt = Infinity;
    m.drive = { forward: 0, right: 0 };
    for (const g of m.guns) if (g) g.overheated = false;
    this.physics.commit();
    const seat = m.def.seats.findIndex((s) => s.role === 'driver');
    if (seat < 0) return;
    if (m.seats[seat] !== slot) {
      m.seats[seat] = slot;
      c.mount = { index, seat };
      this.pendingEvents.push({ e: 'mount', s: slot, m: m.index, seat });
    }
    c.move = { pos: this.seatFeet(m, seat), velY: 0, grounded: true };
    c.yaw = yaw;
    c.pitch = 0;
    c.bot?.onSpawn(yaw);
    this.raceBots.delete(slot);
  }

  /** Other vehicles out and about near `m` (for a track driver's overtaking). */
  private vehiclesNear(m: MountRt): RaceVehicleView[] {
    const out: RaceVehicleView[] = [];
    for (const o of this.mounts) if (o !== m && o.alive && o.def.vehicle && Math.abs(o.pos.x - m.pos.x) < 40 && Math.abs(o.pos.z - m.pos.z) < 40) out.push(this.raceVehicle(o));
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
      const d = a.driver.drive(track, this.raceVehicle(m), this.tick, this.vehiclesNear(m));
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

  /** Race: on the grid nobody moves; nobody gets out; in a clean race nobody shoots. */
  private raceInputs(race: RaceDirector): void {
    for (const c of this.combatants()) {
      for (const q of c.queue) {
        if (race.holding) {
          q.forward = 0;
          q.right = 0;
          q.buttons = 0;
        }
        q.buttons &= ~BUTTON_USE;
        if (!race.combat) q.buttons &= ~(BUTTON_FIRE | BUTTON_ALT | BUTTON_THROW);
      }
    }
  }

  /** Race: a Player Bot drives the track (raceSteer) and, in a combat race, fires its forward gun at rivals ahead. */
  private raceBotInput(c: Combatant, race: RaceDirector): PlayerInput {
    const input: PlayerInput = { seq: c.lastSeq + 1, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0 };
    const m = c.mount ? this.mounts[c.mount.index] : undefined;
    const seat = this.seatOf(c);
    if (!c.alive || !m?.def.vehicle || seat?.role !== 'driver') return input;
    let driver = this.raceBots.get(c.slot);
    // Each bot keeps to its own lane and pushes a little more or less in the bends.
    if (!driver) this.raceBots.set(c.slot, (driver = new TrackDriver((((c.slot * 7) % 5) - 2) * 0.25, 0.85 + ((c.slot * 37) % 16) / 100)));
    const view = this.raceVehicle(m);
    input.yaw = m.yaw;
    // Finished: ease off and roll to a stop.
    if (race.status(c.slot)?.finish !== null && race.status(c.slot)) return input;
    const d = driver.drive(race.track, view, this.tick, this.vehiclesNear(m));
    input.forward = d.forward;
    input.right = d.right;
    if (d.brake) input.buttons |= BUTTON_JUMP;
    // Combat race: bursts at rivals ahead (well under a second, then a breather), never a constant stream,
    // and not in the opening seconds, while the field is still bunched up off the grid.
    if (race.combat && seat.weapon && race.elapsed > RACE_HOLD_FIRE_TICKS && (this.tick + c.slot * 13) % 100 < 40) {
      const gun = getWeapon(seat.weapon);
      const rivals = this.combatants().filter((o) => o !== c && o.alive).map((o) => o.move.pos);
      const shot = raceShot(view, seat.arc ?? Math.PI, Math.min(gun.range, 30), rivals, (a, b) => this.physics.lineOfSight(a, b));
      if (shot) {
        input.yaw = shot.yaw;
        input.pitch = shot.pitch;
        input.buttons |= shot.buttons;
      }
    }
    return input;
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
    this.nav = NavWorld.build([...this.geometry, ...propBoxes(this.map, true), ...blockBoxes(this.map, true), ...extra], mapTerrainMesh(this.map), [...navLinks(this.map.entities, this.physics, this.phys.gravity), ...liftLinks(this.map)]);
    old.destroy();
    this.nav.places();
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

  /** Kills per team in Team Deathmatch (suicides count against the team); objective modes keep their own score. */
  teamScores(): Map<string, number> {
    if (this.mode) return this.mode.teamScores();
    const out = new Map<string, number>((this.teams ?? []).map((t) => [t.id, 0]));
    for (const c of this.combatants()) if (c.faction && out.has(c.faction)) out.set(c.faction, out.get(c.faction)! + c.kills + c.selfKills);
    for (const [team, n] of this.leaderBounty) if (out.has(team)) out.set(team, out.get(team)! + n);
    // Team kills still cost the team, but a team's score never drops below zero.
    for (const [id, v] of out) out.set(id, Math.max(0, v));
    return out;
  }

  private readonly hostility = new Map<string, boolean>();

  /** Should `a` attack (and be able to hurt) `b`? */
  hostile(a: Combatant, b: Combatant): boolean {
    if (a === b) return false;
    // A clean race: nobody fights.
    if (this.race && !this.race.combat) return false;
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

  /** Players and NPCs. */
  actors(): Combatant[] {
    return [...this.combatants(), ...this.npcs.values()];
  }

  actor(id: number): Combatant | undefined {
    return id >= NPC_ID_BASE ? this.npcs.get(id) : (this.slots[id] ?? undefined);
  }

  private spawnNpc(e: EncounterEntity, role: NpcRole, pos: Vec3, yaw: number): number | null {
    const spec = NPC_ROLE_SPECS[role];
    const id = this.nextNpcId++;
    const def = getWeapon(spec.weapon);
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
      alive: true,
      weapons: new Map([[weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 }]]),
      current: weaponCode(def),
    };
    c.bot = new BotBrain(id, NPC_ROLE_PROFILES[role], BOT_DIFFICULTIES[e.difficulty], this.seed);
    c.bot.onSpawn(yaw);
    this.npcs.set(id, c);
    return id;
  }

  private blankCombatant(slot: number, kind: Combatant['kind'], name: string): Combatant {
    return {
      slot,
      kind,
      name,
      look: DEFAULT_LOOK,
      faction: kind === 'npc' ? null : this.playerFaction,
      speedMul: 1,
      size: 1,
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
      deaths: 0,
      weapons: new Map(),
      current: 0,
      throwable: null,
      fireCooldown: 0,
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

  addHuman(name: string, look?: string): Combatant | null {
    const c = this.addCombatant('human', name);
    if (c) {
      c.look = validLookId(look);
      this.applyBodySize(c);
    }
    return c;
  }

  /** `asCharacter`: play the look's own profile (under the match's bot style) instead of `profile` when it has one. */
  addBot(name: string, profile: BotProfile, difficulty: BotDifficulty = BOT_DIFFICULTIES.normal, asCharacter = false): Combatant | null {
    const c = this.addCombatant('bot', name);
    if (c) {
      c.look = lookForBot(c.slot);
      this.applyBodySize(c);
      c.bot = new BotBrain(c.slot, asCharacter ? profileFor(c.look, profile, this.rules.botStyle) : profile, difficulty, this.seed);
      c.bot.onSpawn(c.yaw);
      // Bots choose routes from the navmesh's sample places: build them now, not mid-match.
      this.nav.places();
    }
    return c;
  }

  /**
   * A player joining a running match makes room by removing a Player Bot: the
   * worst-scoring bot (fewest kills less deaths) on the team that most needs a
   * player (fewest people for its size). The player then spawns like anyone
   * else, at a spawn point, never in the bot's place. Null when there is no bot
   * to remove or no free slot after.
   */
  takeOverBot(name: string, look?: string): Combatant | null {
    const all = this.combatants();
    const bots = all.filter((c) => c.kind === 'bot');
    if (!bots.length) return null;
    const targets = this.teamTargets();
    const people = (team: string | null) => all.filter((c) => c.kind === 'human' && c.faction === team).length / (team ? (targets.get(team) ?? 1) : 1);
    const score = (c: Combatant) => c.kills - c.deaths;
    bots.sort((a, b) => people(a.faction) - people(b.faction) || score(a) - score(b) || a.kills - b.kills || b.slot - a.slot);
    const out = bots[0]!;
    const from = out.name;
    this.botThought.delete(out.slot);
    this.raceBots.delete(out.slot);
    this.remove(out.slot);
    const c = this.addHuman(name, look);
    if (c) this.pendingEvents.push({ e: 'takeover', s: c.slot, from, to: name });
    return c;
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
    c.queue = [];
    c.prevButtons = 0;
    this.readySlots.delete(slot);
    c.bot = new BotBrain(c.slot, asCharacter ? profileFor(c.look, profile, this.rules.botStyle) : profile, difficulty, this.seed);
    c.bot.onSpawn(c.yaw);
    this.nav.places();
    this.pendingEvents.push({ e: 'takeover', s: c.slot, from, to: name, bot: 1 });
    return c;
  }

  /** Small and large looks play differently unless the match turns body sizes off. */
  private applyBodySize(c: Combatant): void {
    const spec = BODY_SIZES[this.rules.bodySizes === false ? 'standard' : bodySizeOf(c.look)];
    c.size = spec.scale;
    // Classes set health and speed themselves.
    if (c.cls) return;
    c.speedMul = spec.speed;
    c.maxHealth = spec.health;
    if (!c.alive) c.health = spec.health;
  }

  private addCombatant(kind: Combatant['kind'], name: string): Combatant | null {
    const slot = this.slots.indexOf(null);
    if (slot < 0) return null;
    const c = this.blankCombatant(slot, kind, name);
    this.slots[slot] = c;
    this.spawn(c);
    return c;
  }

  remove(slot: number): void {
    const c = this.slots[slot];
    if (!c) return;
    if (this.phase === 'playing') this.mode?.onLeave(c);
    this.classes?.onLeave(c);
    this.readySlots.delete(slot);
    this.leaveMount(c, false);
    this.physics.removeCollider(c.collider);
    this.slots[slot] = null;
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
      const humans = this.combatants().filter((c) => c.kind === 'human');
      if (this.phase === 'waiting' && ((humans.length > 0 && humans.every((c) => this.readySlots.has(c.slot))) || this.tick >= this.phaseEndTick)) this.startCountdown();
      else if (this.phase === 'countdown' && this.tick >= this.phaseEndTick) this.beginPlay();
    } else {
      this.runBots();
      if (this.race) this.raceInputs(this.race);
      // Movers first, so everyone moves against (and rides) this tick's platforms.
      this.scenario.moveMovers();
      for (const c of this.actors()) this.applyInputs(c);
      if (this.ambient.length && this.road) this.driveAmbient(this.road);
      this.stepMounts();
      this.stepProjectiles();
      this.stepBullets();
      this.stepZones();
      this.stepStatuses();
      if (this.phase === 'playing') this.scenario.step();
      if (this.phase === 'playing') this.encounters.step();
      if (this.phase === 'playing') this.mode?.step();
      if (this.phase === 'playing') this.zombies?.step();
      if (this.phase === 'playing') this.classes?.step();
      if (this.phase === 'playing') this.race?.step();
      for (const c of this.combatants()) {
        if (!c.alive && this.tick >= c.respawnTick) this.spawn(c);
      }
      for (const c of this.npcs.values()) if (!c.alive && this.tick >= c.npc!.removeAt) this.removeNpc(c.slot);
      if (this.tick >= this.phaseEndTick) this.endRound();
    }
    this.recordHistory();
    const events = this.pendingEvents;
    this.pendingEvents = [];
    this.noteCombat(events);
    this.classes?.events(events);
    return events;
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
    return this.hides.some((h) => p.y >= h.y0 && eye <= h.y1 + 0.15 && Math.hypot(p.x - h.x, p.z - h.z) < h.r);
  }

  private runBots(): void {
    const t0 = performance.now();
    const actors = this.actors();
    const views = new Map(actors.map((c) => [c.slot, toView(c, this.concealed(c))]));
    const spearItem = getItem('core.weapon_spear');
    const lyingSpears: PickupView[] = spearItem ? this.projectiles.filter((p) => p.stuck && p.spec.retrievable).map((p) => ({ id: `spear_${p.id}`, item: spearItem, pos: p.pos, available: true })) : [];
    const pickups: PickupView[] = [...lyingSpears, ...this.pickups.filter((p) => !restrictedWeapons(this.rules) || !['weapon', 'ammo', 'throwable'].includes(p.item.effect.kind)).map((p) => ({ id: p.id, item: p.item, pos: p.pos, available: p.enabled && this.tick >= p.availableAt, ...(p.enabled && this.tick < p.availableAt ? { respawnIn: (p.availableAt - this.tick) / TICK_RATE } : {}) }))];
    const npcPickups: PickupView[] = [];
    // Team-only doors block other teams; buttons a bot may press can open the doors in its way.
    const blockersBy = new Map<string | null, ReturnType<Scenario['blockers']>>();
    const blockersFor = (team: string | null) => blockersBy.get(team) ?? blockersBy.set(team, this.scenario.blockers(team)).get(team)!;
    const buttonsBy = new Map<string | null, ReturnType<Scenario['doorButtons']>>();
    const doorButtonsFor = (team: string | null) => buttonsBy.get(team) ?? buttonsBy.set(team, this.scenario.doorButtons(team)).get(team)!;
    const lifts = this.scenario.liftViews();
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
    const budget = this.botBudget(actors);
    for (const c of actors) {
      if (!c.bot) continue;
      if (this.race && !c.npc) {
        c.queue.push(this.raceBotInput(c, this.race));
        continue;
      }
      // Big matches: a bot with nobody to fight thinks every other tick and keeps its last move in between.
      if (budget > 1 && this.coastBot(c, budget)) continue;
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
      const orderGoal = npc
        ? shambler
          ? this.nearestGoal(c, hostiles, 1.5)
          : this.encounters.goalFor(c.slot)
        : (this.teammateOrder(c) ?? (zombies ? this.holdOutGoal(c, hostiles) : coop ? this.coopGoal(c, hostiles) : this.classGoal(c, this.mode?.botGoal(c, hostiles) ?? null)));
      const allies = c.faction === null ? undefined : factionViews.get(c.faction);
      const input = c.bot.think({
        tick: this.tick,
        self: views.get(c.slot)!,
        others: [...(aware < Infinity ? hostiles.filter((o) => horizontalDistance(o.move.pos, c.move.pos) <= aware) : hostiles).map((o) => views.get(o.slot)!), ...this.hostileSentries(c)],
        physics: this.physics,
        nav: this.nav,
        spawnPoints: npc && orderGoal ? [orderGoal.pos] : (c.faction && teamRoam.get(c.faction)) || spawnPoints,
        pickups: npc ? npcPickups : pickups,
        inventory: [...c.weapons.values()].map((w) => ({ def: w.def, mag: w.mag, reserve: w.reserve })),
        throwables: c.throwable?.count ?? 0,
        throwable: c.throwable?.kind ?? null,
        held: c.current,
        reloading: c.reloadTicks > 0,
        blockers: blockersFor(c.faction),
        doorButtons: doorButtonsFor(c.faction),
        ...(lifts.length ? { lifts } : {}),
        hazards,
        orderGoal,
        allies,
        // Focused bots (flag carriers) also ignore distant gunfire and near misses: they keep running.
        noises: aware < Infinity ? undefined : noises,
        shotAt: aware < Infinity ? null : (c.shotAt ?? null),
        // Bots that may not take a vehicle right now (carrying the bomb, leading hostages) don't see any to get in.
        mounts: aware < Infinity ? undefined : mounts && !c.mount && this.mode?.blocksVehicle(c) ? mounts.filter((m) => m.kind !== 'vehicle') : mounts,
        seat: c.mount ? this.seatView(c) : null,
        squad: npc ? this.encounters.squadFor(c.slot, npc.role) : null,
      });
      // Melee creatures rush the target they can see instead of keeping their distance.
      if (npc && NPC_ROLE_SPECS[npc.role].melee && c.alive) {
        const target = c.bot.target === null ? null : this.actor(c.bot.target);
        chargeIntoMelee(input, c.move.pos, target?.alive ? target.move.pos : null, getWeapon(NPC_ROLE_SPECS[npc.role].weapon).range);
      }
      if (!npc) this.mode?.botInput?.(c, input);
      if (!npc) this.classes?.botInput(c, input, orderGoal);
      if (!npc && c.alive && !c.mount && this.rules.weapons === 'discs') this.dodgeDiscs(c, input);
      this.planeBot(c, input);
      // Bots fight recoil like players do, as well as their skill allows (spec §40).
      if (c.alive && (c.gun.rp > 0 || c.gun.ry !== 0)) {
        const k = c.bot.difficulty.aim.recoilComp ?? 0.5;
        input.rc = [c.gun.rp * k, c.gun.ry * k];
      }
      c.queue.push(input);
      if (budget > 1) this.botThought.set(c.slot, { input, tick: this.tick });
    }
    this.lastAiMs = performance.now() - t0;
  }

  /** Each bot's last thought-out input and its tick (only kept in big matches, see coastBot). */
  private readonly botThought = new Map<number, { input: PlayerInput; tick: number }>();

  /**
   * Think budget: up to BOT_FULL_RATE thinking bots (Player Bots and awake
   * NPCs) all think every tick; past that, bots with nobody to fight think
   * every other tick (96-player matches).
   */
  private botBudget(actors: readonly Combatant[]): number {
    let n = 0;
    for (const c of actors) if (c.bot && c.alive) n++;
    return n > BOT_FULL_RATE ? 2 : 1;
  }

  /**
   * On its off tick, a bot that is alive, on foot, not fighting and not under
   * fire repeats the move it thought out last tick (without one-shot buttons).
   * Returns false when it should think now.
   */
  private coastBot(c: Combatant, every: number): boolean {
    if ((this.tick + c.slot) % every === 0 || !c.alive || c.mount || c.bot!.target !== null) return false;
    if (c.shotAt && this.tick - c.shotAt.tick <= 2) return false;
    const last = this.botThought.get(c.slot);
    if (!last || last.tick !== this.tick - 1) return false;
    const { seq: _seq, say: _say, build: _build, weapon: _weapon, ...keep } = last.input;
    c.queue.push({ ...keep, seq: c.lastSeq + 1, buttons: keep.buttons & COAST_BUTTONS });
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
      out.push({ slot: SENTRY_VIEW_BASE + m.index, pos: m.pos, yaw: m.aimYaw, pitch: 0, health: Math.max(0, m.health), armor: 0, alive: true, stance: 2, grounded: true, object: true });
    }
    return out;
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
      seats: m.def.seats.map((s, i) => ({ role: s.role, free: m.seats[i] === null, ...(m.seats[i] !== null ? { by: m.seats[i]! } : {}), ...(s.weapon ? { weapon: getWeapon(s.weapon) } : {}), ...(s.arc !== undefined ? { arc: s.arc } : {}), ...(s.facing ? { facing: s.facing } : {}) })),
      ...(m.def.vehicle ? { maxSpeed: m.def.vehicle.maxSpeed, speed: Math.abs(m.speed) } : {}),
      humanNear: humans.some((h) => horizontalDistance(h.move.pos, m.pos) < 35),
    }));
  }

  private seatView(c: Combatant): SeatView | null {
    const m = this.mounts[c.mount!.index];
    const seat = m?.def.seats[c.mount!.seat];
    if (!m || !seat) return null;
    const gun = m.guns[c.mount!.seat];
    return { mount: m.index, seat: c.mount!.seat, role: seat.role, ...(gun ? { weapon: gun.def } : {}), ...(seat.arc !== undefined ? { arc: seat.arc } : {}), ...(seat.facing ? { facing: seat.facing } : {}), heat: gun?.heat ?? 0, overheated: gun?.overheated ?? false };
  }

  /**
   * What bots hear and feel this tick: gunfire and explosions become noises
   * (kept for a second), and shots passing close to (or hitting) someone mark
   * them as under fire, with where it came from.
   */
  private noteCombat(events: readonly GameEvent[]): void {
    this.noises = this.noises.filter((n) => this.tick - n.tick < TICK_RATE);
    for (const ev of events) {
      if (ev.e === 'explode') this.noises.push({ pos: { x: ev.p[0], y: ev.p[1], z: ev.p[2] }, tick: this.tick, by: ev.s, range: 60 });
      if (ev.e === 'impact') {
        // A bullet that flew a while: a near miss (or a hit) still sends bots into cover.
        const shooter = this.actor(ev.s);
        const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
        const to = { x: ev.to[0], y: ev.to[1], z: ev.to[2] };
        if (shooter) for (const c of this.actors()) if (c.bot && c.alive && this.hostile(shooter, c) && (ev.hit === c.slot || segmentDistance(chest(c.move.pos), from, to) < 1.6)) c.shotAt = { tick: this.tick, from };
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
      for (const c of this.actors()) {
        if (!c.bot || !c.alive || !this.hostile(shooter, c)) continue;
        if (ev.hit.includes(c.slot) || segmentDistance(chest(c.move.pos), from, to) < 1.6) c.shotAt = { tick: this.tick, from };
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

  private teammateOrder(c: Combatant): { pos: Vec3; radius: number } | null {
    const o = c.order;
    if (!o || this.tick > o.until) return null;
    if (o.kind === 'hold') return { pos: o.pos, radius: 3 };
    const leader = this.actor(o.leader);
    if (!leader?.alive) {
      c.order = undefined;
      return null;
    }
    return { pos: leader.move.pos, radius: 4 };
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
      if (!c.alive) continue;
      // The player pulling against the recoil (the client reports how much of its mouse movement countered it).
      if (input.rc) counterRecoil(c.gun, input.rc[0], input.rc[1]);
      if (input.say === PING && !c.npc && this.tick >= (c.pingAt ?? 0)) {
        c.pingAt = this.tick + Math.round(TICK_RATE * 0.75);
        this.ping(c);
      } else if (input.say && !c.npc && this.tick >= (c.sayAt ?? 0)) {
        c.sayAt = this.tick + TICK_RATE;
        // Follow / hold orders reach your team's bots even with the pop-ups turned off.
        if (input.say === SAY_FOLLOW || input.say === SAY_HOLD) this.orderBots(c, input.say === SAY_FOLLOW ? 'follow' : 'hold');
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

      const seat = c.mount ? this.seatOf(c) : null;
      if (seat) {
        // In a turret or vehicle: no walking. Drivers steer; gunners' aim stays within the gun's arc.
        const m = this.mounts[c.mount!.index]!;
        // The plane: jump (or E, below) jumps out.
        if (m.def.airplane && input.buttons & BUTTON_JUMP && !(input.buttons & BUTTON_USE)) {
          this.leaveMount(c, true);
          continue;
        }
        if (seat.role === 'driver') {
          const up = !!(input.buttons & BUTTON_JUMP);
          const down = !!(input.buttons & BUTTON_CROUCH);
          m.drive = m.def.vehicle?.fly ? { forward: input.forward, right: input.right, lift: (up ? 1 : 0) - (down ? 1 : 0) } : { forward: input.forward, right: input.right, brake: up };
        }
        if (seat.arc !== undefined) {
          const centre = m.yaw + (seat.facing ?? 0);
          const d = Math.atan2(Math.sin(c.yaw - centre), Math.cos(c.yaw - centre));
          c.yaw = centre + Math.max(-seat.arc, Math.min(seat.arc, d));
        }
        c.pitch = Math.max(-0.5, Math.min(0.75, c.pitch));
        if (seat.weapon) {
          m.aimYaw = c.yaw;
          m.aimPitch = c.pitch;
        }
      } else {
        // Standing on a moving platform: go where it goes.
        const ridden = this.scenario.carry(c.move.pos);
        if (ridden) c.move = { ...c.move, pos: ridden };
        // In the way of a train: run over.
        else if (this.scenario.strike(c.move.pos, PLAYER.radius * c.size, PLAYER.height * c.size) > 0) {
          this.damage(c, 500, null, 'core.roadkill');
          if (!c.alive) continue;
        }
        const was = c.move.pos;
        const before = c.move;
        const stepped = stepMovement(this.physics, c.collider, c.move, input, (c.speedTicks > 0 ? SPEED_BOOST : 1) * c.speedMul * statusSpeed(c), TICK_DT, this.tractionAt(c.move.pos), { liquids: this.liquids, jet: c.jetFuel !== null && c.jetFuel >= JET.burn, ladders: this.ladders, scale: c.size, gravity: this.phys.gravity, ...(this.gravityZones.length ? { gravityZones: this.gravityZones } : {}), ...(c.cls ? { airJumps: this.classes?.airJumps(c) ?? 0 } : {}), ...(c.jetFuel !== null ? { jetpack: true } : {}), ...(c.glider ? { glider: true } : {}), ...(c.kind !== 'human' ? { autoChute: true } : {}) });
        c.move = applyPads(this.pads, stepped);
        this.trackFall(c, before, c.move !== stepped);
        c.moveSpeed = Math.hypot(c.move.pos.x - was.x, c.move.pos.z - was.z) / TICK_DT;
        if (c.jetFuel !== null) c.jetFuel = stepJetFuel(c.jetFuel, !!c.move.jet);
      }
      if (c.fireCooldown > 0) c.fireCooldown--;
      if (c.throwCooldown > 0) c.throwCooldown--;
      if (c.raiseTicks > 0) c.raiseTicks--;
      if (c.speedTicks > 0) c.speedTicks--;
      if (c.damageTicks > 0) c.damageTicks--;
      this.advanceReload(c);

      if (input.buttons & BUTTON_USE) {
        c.useTick = this.tick;
        // Get out, get in, or use whatever you are looking at.
        if (c.mount) this.leaveMount(c, true);
        else if (!this.enterMount(c)) this.scenario.use(c.slot, { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z }, c.yaw, c.pitch);
        if (this.phase !== 'playing') break;
      }
      // A mode tool (the Fort Wars Builder) takes the trigger for itself.
      if (!c.mount && this.mode?.useInput?.(c, input)) input.buttons &= ~(BUTTON_FIRE | BUTTON_ALT | BUTTON_ZOOM | BUTTON_RELOAD);
      // Seated: the seat's gun if it has one; drivers without one can't shoot; passengers use their own.
      const seatNow = c.mount ? this.seatOf(c) : null;
      const gun = seatNow?.weapon ? this.mounts[c.mount!.index]!.guns[c.mount!.seat]! : null;
      // Nobody shoots from the plane's benches (everyone shares the hold before the drop).
      const unarmed = (seatNow?.role === 'driver' && !gun) || (!!c.mount && !!this.mounts[c.mount.index]!.def.airplane);
      const held = gun ?? heldWeapon(c);
      const def = held.def;
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
      if (fireDown && c.reload && !gun && !c.semiLatch && c.fireCooldown === 0 && c.raiseTicks === 0 && roundsReady(held) > 0) this.cancelReload(c);
      const ready = c.fireCooldown === 0 && (gun ? true : c.raiseTicks === 0) && c.reloadTicks === 0 && !frozen && !unarmed;
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
        } else if (alt.ammo === 'shared') this.startReload(c);
      }
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
  private aimOf(c: Combatant): Vec3 {
    return viewDirection(c.yaw + c.gun.ry, Math.max(-1.55, Math.min(1.55, c.pitch + c.gun.rp)));
  }

  /** Launch a projectile from the eye along the aim (lifted a little for throws, so they arc). */
  private launch(shooter: Combatant, spec: ProjectileSpec, weapon: string, lift = 0, spread = 0): void {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    const aim = this.spreadDir(lift ? normalize(add(viewDirection(shooter.yaw, shooter.pitch), { x: 0, y: lift, z: 0 })) : this.aimOf(shooter), spread);
    this.projectiles.push({
      id: this.nextProjectileId++,
      owner: shooter.slot,
      spec,
      weapon,
      pos: add(eye, scale(aim, 0.5)),
      vel: scale(aim, spec.speed),
      ticksLeft: Math.round(spec.fuseSeconds * TICK_RATE),
      age: 0,
    });
  }

  private fire(shooter: Combatant, def: Trigger, viewTick: number): void {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    const aim = this.aimOf(shooter);
    const gp = gunplayOf(getWeapon(def.id));
    let spread: number;
    if (gp.accuracy && !def.alt) {
      // Gunplay spread (spec §14): base, movement, air and sustained fire, tightened by stance and the sights.
      spread = spreadOf(gp.accuracy, shooter.gun, { run: shooter.moveSpeed / PLAYER.runSpeed, airborne: !shooter.move.grounded, stance: STANCE_SPREAD[stanceOf(shooter.move)] });
      // A scoped rifle fired from the hip is a guess.
      const zoom = getWeapon(def.id).view.zoomFov;
      if (zoom && !shooter.npc && shooter.gun.ads < 0.5) spread += zoom < 0.5 ? 0.05 : 0.012;
    } else {
      // Bloom from sustained fire widens the spread; each shot adds more. So does
      // shooting on the run or in the air; aiming down a scope tightens it, and a
      // scoped rifle fired from the hip is a guess.
      spread = aimSpread(shooter, def, def.spread + (def.alt ? 0 : shooter.bloom) + movementSpread(shooter, def)) * STANCE_SPREAD[stanceOf(shooter.move)];
      if (def.recoil && !def.alt) shooter.bloom = Math.min(def.recoil.maxBloom, shooter.bloom + def.recoil.bloom);
    }
    // Mechanical recoil: this round kicks the aim for the next one.
    if (!def.alt && def.kind !== 'melee') recoilShot(shooter.gun, gp.kick);
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
      // Three short rays in a narrow fan make melee forgiving without a full sweep.
      let hit: number | null = null;
      let body: number | null = null;
      for (const yawOffset of [0, -0.3, 0.3]) {
        const dir = viewDirection(shooter.yaw + yawOffset, shooter.pitch);
        const world = this.physics.raycastHit(eye, dir, def.range);
        const shot = resolveHitscan(eye, dir, def.range, world?.dist ?? null, targets);
        if (shot.hitSlot !== null) {
          hit = shot.hitSlot;
          break;
        }
        if (world && body === null) body = world.handle;
      }
      this.pendingEvents.push({ e: 'melee', s: shooter.slot, hit });
      if (hit !== null) this.damage(this.actor(hit)!, def.damage, shooter, def.id);
      else if (body !== null && !this.damageMountBody(body, this.boosted(shooter, def.damage), shooter)) this.scenario.damageBody(body, this.boosted(shooter, def.damage), shooter.slot);
      return;
    }

    if (gp.ballistic && !def.alt && def.kind === 'hitscan') {
      this.fireBullets(shooter, def, gp, eye, aim, spread, viewTick, targets);
      return;
    }

    const to: Tuple3[] = [];
    const hits: (number | null)[] = [];
    const zones: number[] = [];
    const bodies: number[] = [];
    const struck: { slot: number; dir: Vec3; zone: HitZone; dist: number }[] = [];
    const feetOf = (slot: number) => targets.find((t) => t.slot === slot)!.feet;
    const heightOf = (slot: number) => targets.find((t) => t.slot === slot)!.height;
    for (let p = 0; p < def.pellets; p++) {
      const dir = this.spreadDir(aim, spread);
      const world = this.physics.raycastHit(eye, dir, def.range);
      if (def.pierce) {
        // Piercing rounds go through players (not walls): everyone along the line, nearest first.
        const wallAt = world?.dist ?? def.range;
        const along = targets
          .map((t) => ({ slot: t.slot, d: rayCapsule(eye, dir, t.feet, t.radius ?? PLAYER.radius, t.height) }))
          .filter((t): t is { slot: number; d: number } => t.d !== null && t.d < wallAt)
          .sort((a, b) => a.d - b.d)
          .slice(0, def.pierce + 1);
        for (const t of along) struck.push({ slot: t.slot, dir, zone: hitZone(feetOf(t.slot), eye.y + dir.y * t.d, heightOf(t.slot)), dist: t.d });
        to.push(tuple(add(eye, scale(dir, wallAt))));
        hits.push(along[0]?.slot ?? null);
        zones.push(along[0] ? hitZone(feetOf(along[0].slot), eye.y + dir.y * along[0].d, heightOf(along[0].slot)) : 0);
        if (world) bodies.push(world.handle);
        continue;
      }
      const shot = resolveHitscan(eye, dir, def.range, world?.dist ?? null, targets);
      to.push(tuple(shot.end));
      hits.push(shot.hitSlot);
      const zone = shot.hitSlot !== null ? hitZone(feetOf(shot.hitSlot), shot.end.y, heightOf(shot.hitSlot)) : 0;
      zones.push(zone);
      if (shot.hitSlot !== null) struck.push({ slot: shot.hitSlot, dir, zone, dist: shot.distance });
      else if (world) bodies.push(world.handle);
    }
    this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to, hit: hits, ...(zones.some((z) => z) ? { z: zones } : {}), ...(def.alt ? { alt: 1 as const } : {}) });
    for (const { slot, dir, zone, dist } of struck) {
      const victim = this.actor(slot)!;
      this.damage(victim, def.damage * zoneScale(gp, zone) * falloffAt(gp.falloff, dist), shooter, def.id, zone === 1);
      if (def.status) this.applyStatus(victim, def.status, shooter, def.id);
      if (def.knockback) this.push(victim, dir, def.knockback);
    }
    for (const b of bodies) if (!this.damageMountBody(b, this.boosted(shooter, def.damage), shooter)) this.scenario.damageBody(b, this.boosted(shooter, def.damage), shooter.slot);
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
    const h = Math.hypot(dir.x, dir.z) || 1;
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
    if (!c.alive || (by && by !== c && !this.hostile(by, c))) return;
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

  /** Shove a player along `dir` (horizontal push plus a little lift). */
  private push(c: Combatant, dir: Vec3, speed: number): void {
    const h = Math.hypot(dir.x, dir.z) || 1;
    c.move = { ...c.move, vx: (c.move.vx ?? 0) + (dir.x / h) * speed, vz: (c.move.vz ?? 0) + (dir.z / h) * speed, velY: Math.max(c.move.velY, speed * 0.45 + dir.y * speed * 0.5), grounded: false };
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
  private targetsFor(shooter: Combatant, viewTick: number): { slot: number; feet: Vec3; height: number; radius: number }[] {
    let past: Map<number, Vec3 & { h: number }> | undefined;
    if (shooter.kind === 'human' && viewTick > 0) {
      const t = Math.max(this.tick - MAX_REWIND_TICKS, Math.min(this.tick, viewTick));
      past = this.history.get(t);
    }
    // Allies are not targets: shots pass through them (no friendly fire).
    return this.actors()
      .filter((o) => o.alive && this.hostile(shooter, o))
      .map((o) => {
        const then = past?.get(o.slot);
        return { slot: o.slot, feet: then ?? o.move.pos, height: then?.h ?? bodyHeightOf(o.move, o.size), radius: PLAYER.radius * o.size };
      });
  }

  private recordHistory(): void {
    const snap = new Map<number, Vec3 & { h: number }>();
    for (const c of this.actors()) if (c.alive) snap.set(c.slot, { ...c.move.pos, h: bodyHeightOf(c.move, c.size) });
    this.history.set(this.tick, snap);
    this.history.delete(this.tick - HISTORY_TICKS);
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
          if (w) w.mag = Math.max(w.mag, 1);
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
      const len = Math.hypot(delta.x, delta.y, delta.z);
      const dir = scale(delta, 1 / (len || 1));
      const wall = this.physics.raycastNormal(p.pos, dir, len);
      let hitDist = wall?.dist ?? null;
      let victim: Combatant | null = null;
      for (const c of this.actors()) {
        // Your own discs never hit you.
        if (!c.alive || (c === owner && (p.age < OWNER_GRACE_TICKS || spec.disc))) continue;
        if (owner && c !== owner && !this.hostile(owner, c)) continue;
        const d = rayCapsule(p.pos, dir, c.move.pos, PLAYER.radius * c.size, bodyHeightOf(c.move, c.size));
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
          p.stuckOffset = { x: at.x - victim.move.pos.x, y: Math.min(PLAYER.height, Math.max(0.3, at.y - victim.move.pos.y)), z: at.z - victim.move.pos.z };
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.walker && wall.normal.y > 0.6) {
          // Landed: off it goes, the way it was thrown.
          const h = Math.hypot(p.vel.x, p.vel.z);
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
        if (!victim && wall && spec.impactDamage && !this.damageMountBody(wall.handle, spec.impactDamage, owner ?? null)) this.scenario.damageBody(wall.handle, spec.impactDamage, p.owner);
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
    const targets = new Map<number, ShotTargets>();
    for (const b of this.bullets) {
      if (b.born === this.tick) {
        keep.push(b);
        continue;
      }
      let list = targets.get(b.owner);
      if (!list) targets.set(b.owner, (list = this.liveTargets(b.owner)));
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

  /** Living actors a bullet of `owner`'s can hit, where they are now (allies are passed through, as with every shot). */
  private liveTargets(owner: number): ShotTargets {
    const shooter = this.actor(owner);
    if (shooter) return this.targetsFor(shooter, 0);
    return this.actors()
      .filter((o) => o.alive && o.slot !== owner)
      .map((o) => ({ slot: o.slot, feet: o.move.pos, height: bodyHeightOf(o.move, o.size), radius: PLAYER.radius * o.size }));
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
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const u = { x: dx / len, y: dy / len, z: dz / len };
    const wall = this.physics.raycastNormal(a, u, len);
    let best = wall?.dist ?? Infinity;
    let victim: ShotTargets[number] | null = null;
    // Only bodies near the segment are worth the capsule test.
    const mx = (a.x + c.x) / 2;
    const mz = (a.z + c.z) / 2;
    const reach = len / 2 + 2;
    for (const t of targets) {
      if (Math.abs(t.feet.x - mx) > reach || Math.abs(t.feet.z - mz) > reach) continue;
      const d = rayCapsule(a, u, t.feet, t.radius, t.height);
      if (d !== null && d <= len && d < best) {
        best = d;
        victim = t;
      }
    }
    if (victim) {
      const at = add(a, scale(u, best));
      const zone = hitZone(victim.feet, at.y, victim.height);
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
      if (!this.damageMountBody(wall.handle, raw, owner) && spec.destruction > 0) this.scenario.damageBody(wall.handle, raw * spec.destruction, b.owner);
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
    if (this.mountBodies.has(handle)) return 'metal';
    if (this.covers.some((c) => c.body.handle === handle)) return 'soil';
    const i = this.scenario.bodies.entityAt(handle);
    if (i !== undefined) {
      const e = this.map.entities[i];
      return e ? entityMaterial(e) : 'concrete';
    }
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
    if (def.knockback) this.push(victim, end.dir, def.knockback * (end.damage / Math.max(1, def.damage)));
  }

  /** A lying spear goes to the first living player close by whose spear is thrown. */
  private retrieve(p: Projectile): boolean {
    const code = weaponCode(getWeapon(p.weapon));
    for (const c of this.actors()) {
      if (!c.alive || distance(c.move.pos, p.pos) > 1.6) continue;
      const w = c.weapons.get(code);
      if (!w || w.mag > 0) continue;
      w.mag = 1;
      if (c.current !== code) this.switchTo(c, code);
      this.pendingEvents.push({ e: 'pickup', s: c.slot, id: `spear_${p.id}`, item: 'core.weapon_spear' });
      return true;
    }
    return false;
  }

  private explode(p: Projectile, at: Vec3): void {
    const spec = p.spec;
    const owner = this.actor(p.owner) ?? null;
    if (spec.disc) {
      // Its flight is over: the disc goes back to its thrower (extras just vanish).
      const w = !p.extra && owner ? owner.weapons.get(weaponCode(getWeapon(p.weapon))) : undefined;
      if (w) w.mag = Math.min(w.def.magazine, w.mag + 1);
      return;
    }
    if (spec.splashRadius > 0) this.pendingEvents.push({ e: 'explode', s: p.owner, p: tuple(at), r: spec.splashRadius });
    if (spec.splashRadius > 0) this.splash(at, spec.splashRadius, spec.splashDamage, spec.splashEdgeDamage, owner, p.weapon, spec.selfDamageScale, spec.knockback, spec.status);
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
    const reach = Math.hypot(half.x, half.z) + PLAYER.radius;
    for (const c of this.actors()) {
      if (c.alive && Math.hypot(c.move.pos.x - pos.x, c.move.pos.z - pos.z) < reach && c.move.pos.y < pos.y + half.y * 2 && c.move.pos.y + PLAYER.height > pos.y) {
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
    const flat = Math.hypot(to.x, to.z);
    const t = Math.max(0.25, Math.hypot(flat, to.y) / speed);
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
    const d = Math.hypot(to.x, to.y, to.z);
    if (d < 0.5) return;
    const speed = Math.hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
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
    const speed = Math.hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
    const fwd = scale(p.vel, 1 / speed);
    let best: Vec3 | null = null;
    let bestD = homing.range;
    for (const c of this.actors()) {
      if (!c.alive || c === owner || !this.hostile(owner, c)) continue;
      const to = sub(chest(c.move.pos), p.pos);
      const d = Math.hypot(to.x, to.y, to.z);
      if (d > bestD || dot(to, fwd) < d * 0.3) continue;
      if (!this.physics.lineOfSight(p.pos, chest(c.move.pos))) continue;
      best = scale(to, 1 / d);
      bestD = d;
    }
    if (!best) return;
    const k = Math.min(1, homing.turnRate * TICK_DT);
    p.vel = scale(normalize(add(scale(fwd, 1 - k), scale(best, k))), speed);
  }

  // ---------------------------------------------------------------- turrets, sentries and vehicles

  private addMount(index: number, def: MountDef, pos: Vec3, yaw: number, faction: string | null, respawnSeconds: number | null): void {
    const half = { x: def.half[0], y: def.half[1], z: def.half[2] };
    const body = this.physics.createBox({ x: pos.x, y: pos.y + half.y, z: pos.z }, half, yaw);
    const probe = def.vehicle ? this.physics.createVehicleProbe(Math.min(half.x, half.z) * 0.95) : null;
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
      guns: def.seats.map((seat) => (seat.weapon ? { def: getWeapon(seat.weapon), mag: 0, reserve: 0, alt: 0, heat: 0 } : null)),
      body,
      probe,
      faction,
      drive: { forward: 0, right: 0 },
      slide: 0,
      airborne: false,
      cooldown: 0,
      lastHitBy: null,
      runOver: new Map(),
      burning: false,
      wreckUntil: 0,
      vel: { x: 0, z: 0 },
      rammed: new Map(),
    };
    this.mounts.push(m);
    this.mountBodies.set(body.handle, m);
  }

  private seatOf(c: Combatant): SeatDef | null {
    if (!c.mount) return null;
    return this.mounts[c.mount.index]?.def.seats[c.mount.seat] ?? null;
  }

  /** Where a seat's occupant stands right now. */
  private seatFeet(m: MountRt, seat: number): Vec3 {
    return mountToWorld(m.pos, m.yaw, m.def.seats[seat]!.offset);
  }

  /** Climb into the nearest turret or vehicle in reach with a free seat (driver first, then gunner, then passengers). */
  private enterMount(c: Combatant): boolean {
    let best: MountRt | null = null;
    let bestD = Infinity;
    for (const m of this.mounts) {
      if (!m.alive || !m.def.seats.length || !m.seats.includes(null)) continue;
      if (m.def.vehicle && this.mode?.blocksVehicle(c)) continue;
      const d = horizontalDistance(m.pos, c.move.pos);
      if (d <= m.def.enterRadius && Math.abs(m.pos.y - c.move.pos.y) < 2.5 && d < bestD) {
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
    c.move = { pos: this.seatFeet(best, seat), velY: 0, grounded: true };
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
    if (!m) return;
    m.seats[seat] = null;
    if (m.def.seats[seat]?.role === 'driver') m.drive = { forward: 0, right: 0 };
    this.pendingEvents.push({ e: 'mount', s: c.slot, m: m.index, seat: -1 });
    this.planeDrops.delete(c.slot);
    if (!step) return;
    if (m.route) {
      // Out of the plane's tail ramp, carried along by its speed; the automatic opener is armed.
      const pose = routePose(m.route, this.tick);
      const at = mountToWorld(m.pos, m.yaw, [0, -1.5, -m.def.half[2] - 1]);
      c.move = { pos: at, velY: 0, grounded: false, vx: pose.vel.x * 0.5, vz: pose.vel.z * 0.5, drop: true };
      return;
    }
    const [hx, , hz] = m.def.half;
    for (const o of [[-(hx + 0.9), 0, 0], [hx + 0.9, 0, 0], [0, 0, -(hz + 0.9)], [0, 0, hz + 0.9]] as const) {
      const spot = mountToWorld(m.pos, m.yaw, o);
      // Room to stand: nothing solid from the knees to above the head (a ray starting inside a wall hits at once).
      if (this.physics.raycastHit({ x: spot.x, y: spot.y + 0.4, z: spot.z }, { x: 0, y: 1, z: 0 }, PLAYER.height)) continue;
      c.move = this.bailOut({ x: spot.x, y: spot.y + 0.3, z: spot.z });
      return;
    }
    c.move = this.bailOut({ x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z });
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
    let plan = this.planeDrops.get(c.slot);
    if (!plan) this.planeDrops.set(c.slot, (plan = { target: dropTarget(this.map, c.faction, this.rng(), this.rules.mode) }));
    // Stay aboard through the countdown.
    if (this.phase !== 'playing') return;
    const { jump, dist } = shouldJump(m.pos, plan.target, plan.prev, ticksToRouteEnd(m.route, this.tick));
    plan.prev = dist;
    if (jump) input.buttons |= BUTTON_USE;
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
      c.move = { pos: this.seatFeet(m, seat), velY: 0, grounded: true };
      c.yaw = m.yaw;
      this.pendingEvents.push({ e: 'mount', s: c.slot, m: m.index, seat });
      return true;
    }
    return false;
  }

  /** Damage whatever mount owns this collider; false when it isn't one. */
  private damageMountBody(handle: number, amount: number, attacker: Combatant | null): boolean {
    if (this.mode?.damageBody?.(handle, amount, attacker)) return true;
    const cv = this.covers.find((c) => c.body.handle === handle);
    if (cv) {
      this.damageCover(cv, amount);
      return true;
    }
    const m = this.mountBodies.get(handle);
    if (!m) return false;
    this.damageMount(m, amount, attacker);
    return true;
  }

  /**
   * Hurt a mount. Vehicles take the match's vehicle damage share (tough:
   * half, off: none); `raw` skips that (fire, lava and water run on their
   * own clock). The attacker gets the credit when it blows; damage from
   * nobody (fire, crashes, water) leaves the last attacker's credit standing.
   * The transport plane can't be hurt.
   */
  private damageMount(m: MountRt, amount: number, attacker: Combatant | null, raw = false): void {
    if (!m.alive || this.phase !== 'playing' || amount <= 0 || m.route) return;
    if (m.def.kind === 'vehicle' && !raw) amount *= VEHICLE_DAMAGE_SCALE[this.rules.vehicleDamage ?? 'normal'];
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
    m.respawnAt = this.tick + m.respawnTicks;
    const aboard = m.seats.map((slot) => (slot === null ? undefined : this.actor(slot))).filter((c): c is Combatant => !!c);
    for (const c of aboard) this.leaveMount(c, true);
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
    this.splash(at, m.def.blast.radius, m.def.blast.damage, m.def.blast.damage * 0.2, by, 'core.wreck', 1, 6);
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
    m.pos = { ...m.home.pos };
    m.yaw = m.aimYaw = m.home.yaw;
    m.aimPitch = 0;
    m.speed = m.velY = m.slide = 0;
    m.vel = { x: 0, z: 0 };
    m.airborne = false;
    m.push = { x: 0, z: 0 };
    m.lastHitBy = null;
    for (const g of m.guns) if (g) g.heat = 0;
    this.physics.setBoxEnabled(m.body, true);
    this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
  }

  private stepMounts(): void {
    for (const m of this.mounts) {
      if (!m.alive) {
        // The wreck settles where it fell, then stops being solid while it fades; the mount respawns at home later.
        if (this.tick < m.wreckUntil) this.settleWreck(m);
        else if (m.wreckUntil) {
          m.wreckUntil = 0;
          this.physics.setBoxEnabled(m.body, false);
        }
        if (this.phase === 'playing' && this.tick >= m.respawnAt) this.respawnMount(m);
        continue;
      }
      // Mounted guns cool whenever they are not firing.
      for (const g of m.guns) {
        if (!g?.def.heat || g.firedTick === this.tick) continue;
        g.heat = Math.max(0, (g.heat ?? 0) - g.def.heat.coolPerTick);
        if (g.heat === 0) g.overheated = false;
      }
      if (m.route) this.flyPlane(m);
      if (m.def.vehicle) this.driveVehicle(m);
      if (m.def.sentry && this.race?.combat !== false) this.runSentry(m);
      if (m.alive && m.def.vehicle) this.vehicleHazards(m);
      if (!m.alive) continue;
      // Riders move with it.
      m.seats.forEach((slot, seat) => {
        const c = slot === null ? undefined : this.actor(slot);
        if (c?.alive) c.move = { pos: this.seatFeet(m, seat), velY: 0, grounded: true };
      });
    }
    // Moved bodies must be in place before this tick's shots and sight checks.
    if (this.mounts.length) this.physics.commit();
  }

  /** The plane follows its route by the clock; at the end of an open route it starts over, throwing out anyone still aboard. */
  private flyPlane(m: MountRt): void {
    const route = m.route!;
    const pose = routePose(route, this.tick);
    if (ticksToRouteEnd(route, this.tick) <= 1) {
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
      const deep = !v.hover && !v.fly ? liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y + m.def.half[1] * 1.5, z: m.pos.z }) : null;
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
    const moved = this.physics.moveVehicle(m.probe, m.body, m.pos, { x: vx * TICK_DT, y: m.velY * TICK_DT, z: vz * TICK_DT });
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
   * Crashes between mounts: a vehicle driven into another vehicle, a wreck
   * or a turret hurts both, by how fast they closed and how heavy the other
   * one is (a kart into a tank comes off far worse), and shoves the lighter
   * one. Each side's driver gets the credit for the other's damage.
   */
  private ramMounts(m: MountRt, vx: number, vz: number, driver: Combatant | null): void {
    if (Math.hypot(vx, vz) < RAM_MIN_SPEED) return;
    for (const o of this.mounts) {
      if (o === m || o.route || (!o.alive && this.tick >= o.wreckUntil) || (m.rammed.get(o.index) ?? 0) > this.tick) continue;
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
  private driveVehicle(m: MountRt): void {
    const v = m.def.vehicle!;
    const { forward, right, brake } = m.drive;
    const mass = v.mass ?? 1;
    const grounded = !m.airborne || !!v.hover || !!v.fly;
    // On a track's road tyres grip better; off it wheeled vehicles are a little slower.
    const road = roadHandling(this.road, m.pos, !!v.hover || !!v.fly);
    const target = (forward > 0 ? v.maxSpeed * forward : forward < 0 ? -v.reverseSpeed * -forward : 0) * road.speed;
    const braking = target === 0 || Math.sign(target) !== Math.sign(m.speed);
    let rate = (target === 0 ? v.accel * (v.hover ? 0.35 : 0.8) : braking ? v.accel * 1.8 : v.accel) * TICK_DT;
    if (!grounded) rate = 0;
    if (brake && grounded) rate = Math.max(rate, v.accel * 1.2 * TICK_DT);
    m.speed += Math.max(-rate, Math.min(rate, (brake ? 0 : target) - m.speed));
    // Steering: needs some speed, tightest around half speed, a little lazier flat out; barely any in the air.
    const frac = Math.min(1, Math.abs(m.speed) / v.maxSpeed);
    const steer = Math.min(1, Math.abs(m.speed) / 5) * (1 - 0.35 * frac * frac) * (grounded ? 1 : 0.2) * (brake ? 1.35 : 1);
    const turn = right * v.turnRate * TICK_DT * steer * (m.speed >= 0 ? 1 : -1);
    m.yaw += turn;
    // Turning swings the heading out from under the momentum: that becomes slide, which grip then eats.
    m.slide += -m.speed * Math.sin(turn);
    const grip = grounded ? Math.min(0.6, (v.grip ?? (v.hover ? 0.06 : 0.25)) * road.grip) * (brake ? 0.25 : 1) : 0;
    m.slide *= 1 - grip;
    if (Math.abs(m.slide) < 0.02) m.slide = 0;
    if (v.fly) {
      // Flyers hold their height: climb or dive at the pilot's say, and sink back down with nobody at the controls.
      const piloted = m.def.seats.some((s, i) => s.role === 'driver' && m.seats[i] !== null);
      const want = piloted ? (m.drive.lift ?? 0) * v.fly.climb : -v.fly.climb * 0.5;
      m.velY += Math.max(-v.fly.climb * 3 * TICK_DT, Math.min(v.fly.climb * 3 * TICK_DT, want - m.velY));
      if (m.pos.y >= m.home.pos.y + v.fly.ceiling && m.velY > 0) m.velY = 0;
    } else m.velY -= PLAYER.gravity * TICK_DT;
    const dir = { x: Math.sin(m.yaw), z: Math.cos(m.yaw) };
    const side = { x: Math.cos(m.yaw), z: -Math.sin(m.yaw) };
    const vx = dir.x * m.speed + side.x * m.slide + m.push.x;
    const vz = dir.z * m.speed + side.z * m.slide + m.push.z;
    const startY = m.pos.y;
    const moved = this.physics.moveVehicle(m.probe!, m.body, m.pos, { x: vx * TICK_DT, y: m.velY * TICK_DT, z: vz * TICK_DT });
    const climbed = (moved.feet.y - startY) / TICK_DT;
    if (moved.grounded) {
      // Hard landing: the heavier and faster it comes down, the more it hurts.
      if (m.airborne && m.velY < -11 && !v.hover && !v.fly) this.damageMount(m, (-m.velY - 11) * 6 * mass, null);
      // On the ground the vertical speed follows the slope, so leaving a ramp keeps the climb (a flyer lifts off at will).
      m.velY = v.fly ? Math.max(0, m.velY) : Math.max(0, Math.min(climbed, 14));
      m.airborne = false;
    } else m.airborne = true;
    if (moved.blocked > 0.6 && Math.abs(m.speed) > 4) {
      m.speed *= Math.min(0.8, 0.4 + mass * 0.1);
      m.slide *= 0.5;
    }
    m.pos = moved.feet;
    const decay = moved.grounded ? 0.9 : 0.99;
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
      if (driver && driver !== c && !this.hostile(driver, c)) continue;
      m.runOver.set(c.slot, this.tick + 30);
      this.push(c, { x: dir.x + (lx >= 0 ? 1 : -1) * Math.cos(m.yaw) * 0.6, y: 0.4, z: dir.z - (lx >= 0 ? 1 : -1) * Math.sin(m.yaw) * 0.6 }, Math.abs(m.speed) * 0.8);
      this.damage(c, Math.abs(m.speed) * 5, driver, 'core.roadkill');
      this.pendingEvents.push({ e: 'crash', p: tuple(chest(c.move.pos)), n: Math.min(1, Math.abs(m.speed) / 40) });
    }
  }

  /** Sentries turn toward the nearest enemy they can see and fire while lined up. */
  private runSentry(m: MountRt): void {
    const spec = m.def.sentry!;
    const muzzle = { x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z };
    let target: Combatant | null = null;
    let bestD = spec.range;
    for (const c of this.actors()) {
      if (!c.alive || c.slot === m.builtBy) continue;
      if (m.faction !== null && relation(this.factions, m.faction, c.faction) !== 'enemy') continue;
      const d = distance(muzzle, chest(c.move.pos));
      if (d < bestD && this.physics.lineOfSight(muzzle, chest(c.move.pos))) {
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
      .map((c) => ({ slot: c.slot, feet: c.move.pos }));
    const shot = resolveHitscan(muzzle, dir, def.range, world && world.handle !== m.body.handle ? world.dist : null, targets);
    this.pendingEvents.push({ e: 'shot', s: -1, w: def.id, from: tuple(muzzle), to: [tuple(shot.end)], hit: [shot.hitSlot] });
    // A built sentry's kills are its builder's.
    if (shot.hitSlot !== null) this.damage(this.actor(shot.hitSlot)!, def.damage, m.builtBy === undefined ? null : (this.slots[m.builtBy] ?? null), def.id);
  }

  /** Mounts for snapshots (see MountSnapshot). */
  mountSnapshots(): MountSnapshot[] {
    return this.mounts.map((m) => [m.index, r3(m.pos.x), r3(m.pos.y), r3(m.pos.z), r3(m.yaw), r3(m.aimYaw), r3(m.aimPitch), Math.ceil((Math.max(0, m.health) / m.def.health) * 100), (m.alive ? MOUNT_FLAG_ALIVE : 0) | (this.tick < m.wreckUntil ? MOUNT_FLAG_WRECK : 0) | (m.burning ? MOUNT_FLAG_BURNING : 0), ...m.seats.map((s) => s ?? -1)]);
  }

  // ---------------------------------------------------------------- hazards and status effects

  private spawnZone(spec: ZoneSpec, at: Vec3, owner: number, weapon: string): void {
    let pos = at;
    // Puddles and flames settle on the floor below; clouds and fields stay where they burst.
    if (spec.kind === 'fire' || spec.kind === 'oil' || spec.kind === 'goo') {
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
    this.zones.push({ kind: spec.kind, pos, radius: spec.radius, endTick, owner, weapon });
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
        this.pendingEvents.push({ e: 'explode', s: z.owner, p: tuple(z.pos), r: 5 });
        this.splash(z.pos, 5, 90, 20, this.actor(z.owner) ?? null, z.weapon, 0.6);
        this.ignite(z.pos, 5);
      }
    }
    this.zones = live;
    // Fire spreads along oil.
    for (const f of this.zones) if (f.kind === 'fire') this.ignite(f.pos, f.radius * 0.5);
    for (const c of this.actors()) {
      if (!c.alive) continue;
      for (const z of this.zones) {
        if (!inZone(z, c.move.pos)) continue;
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
            const d = Math.hypot(to.x, to.y, to.z) || 1;
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
      if (c.frozenTicks > 0) c.frozenTicks--;
      else if (c.chill > 0) c.chill = Math.max(0, c.chill - 0.45 / TICK_RATE);
    }
  }

  /** Radial damage falling off from `damage` at the centre to `edge` at `radius`, blocked by walls. Also hits destructibles. */
  private splash(at: Vec3, radius: number, damage: number, edge: number, owner: Combatant | null, weapon: string, selfScale: number, knockback = 0, status?: StatusHit): void {
    for (const c of this.actors()) {
      if (!c.alive) continue;
      const target = chest(c.move.pos);
      const d = distance(at, target);
      if (d > radius || !this.physics.lineOfSight(at, target)) continue;
      let dmg = damage + (edge - damage) * (d / radius);
      if (owner && c === owner) dmg *= selfScale;
      // Knockback throws everyone (you too: disc jumps), friends included, but only enemies take damage.
      if (knockback) this.push(c, d > 0.01 ? scale(sub(target, at), 1 / d) : { x: 0, y: 1, z: 0 }, knockback * (1 - (d / radius) * 0.6));
      if (dmg > 0) this.damage(c, dmg, owner, weapon);
      if (status && c.alive) this.applyStatus(c, status, owner, weapon);
    }
    const boost = owner && owner.damageTicks > 0 ? DAMAGE_BOOST : 1;
    for (const m of this.mounts) {
      if (!m.alive) continue;
      const centre = { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z };
      const d = Math.max(0, distance(at, centre) - Math.min(m.def.half[0], m.def.half[2]));
      if (d <= radius) this.damageMount(m, (damage + (edge - damage) * (d / radius)) * boost, owner);
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
    if (!victim.alive || this.phase !== 'playing') return;
    if (this.mode?.blocksDamage?.(victim, attacker)) return;
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
    let dmg = attacker && attacker !== victim && attacker.damageTicks > 0 ? amount * DAMAGE_BOOST : amount;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, dmg * ARMOR_ABSORB);
      victim.armor -= absorbed;
      dmg -= absorbed;
    }
    victim.health -= dmg;
    victim.hurtAt = this.tick;
    if (victim.health <= 0) this.kill(victim, attacker === victim ? null : attacker, weapon, head);
  }

  private kill(victim: Combatant, killer: Combatant | null, weapon: string, head = false): void {
    this.leaveMount(victim, false);
    victim.alive = false;
    victim.health = 0;
    this.pendingEvents.push({ e: 'kill', killer: killer?.slot ?? null, victim: victim.slot, weapon, ...(head ? { hs: 1 as const } : {}) });
    // Only players score; NPC kills of players count as the player's death.
    // Team kills cost a point and earn no streak.
    const teamKill = !!killer && killer !== victim && !this.hostile(killer, victim);
    if (killer && !killer.npc) killer.kills += teamKill ? -1 : 1;
    victim.streak = 0;
    if (killer && killer !== victim && !killer.npc && killer.alive && !teamKill) {
      killer.streak = (killer.streak ?? 0) + 1;
      this.streakReward(killer);
    }
    if (victim.npc) {
      victim.npc.removeAt = this.tick + TICK_RATE * 2;
      this.encounters.onNpcKilled(victim.slot, killer?.slot ?? null);
      return;
    }
    victim.deaths++;
    // Zombies: the fallen sit out the rest of the wave.
    victim.respawnTick = this.zombies ? Infinity : this.tick + this.rules.respawnDelayTicks;
    // Suicides (falls, own grenades, traps) cost the player a point, not their team.
    if (!killer) {
      victim.kills--;
      victim.selfKills++;
    }
    this.scenario.playerKilled(victim.slot, killer?.slot ?? null);
    if (this.isLeader(victim)) this.leaderDown(victim, killer);
    this.mode?.onKill(victim, killer);
    if (!killer || killer.npc || this.rules.scoreLimit <= 0) return;
    const score = this.teams && killer.faction ? (this.teamScores().get(killer.faction) ?? 0) : killer.kills;
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
    }
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
          if (w.def.magazine === 0 || (e.ammo && w.def.ammo !== e.ammo)) continue;
          if (w.reserve < w.def.reserveMax) {
            w.reserve = Math.min(w.def.reserveMax, w.reserve + (e.ammo ? w.def.pickupAmmo : Math.ceil(w.def.pickupAmmo / 2)));
            used = true;
          }
        }
        // Explosives also refill underbarrel grenades.
        if (!e.ammo || e.ammo === 'explosive') {
          for (const w of c.weapons.values()) {
            const alt = w.def.alt;
            if (alt?.ammo === 'own' && w.alt < (alt.max ?? 0)) {
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
   * Spawn at the point farthest from living opponents, with a little randomness
   * among near-equal choices. In Team Deathmatch a team uses its own spawns
   * when the map has any.
   */
  private spawn(c: Combatant): void {
    const enemies = this.actors().filter((o) => o.alive && this.hostile(c, o));
    const own = this.teams && c.faction ? this.spawnPoints.filter((sp) => sp.team === c.faction) : [];
    const shared = this.spawnPoints.filter((sp) => sp.team === null);
    // A team without spawns of its own (more teams than the map has bases) uses the shared ones, else anyone's, farthest from enemies.
    const candidates = own.length ? own : shared.length ? shared : this.spawnPoints;
    let best = candidates[0];
    let bestScore = -Infinity;
    // Team modes on shared spawns: the sides rotate. Spawns near your teammates and out of
    // enemy sight win, so each team keeps an area of its own wherever the fight has moved.
    const rotating = !!this.teams && c.faction !== null && !own.length;
    const mates = rotating ? this.combatants().filter((o) => o !== c && o.alive && o.faction === c.faction) : [];
    for (const sp of candidates) {
      const nearest = enemies.reduce((m, e) => Math.min(m, horizontalDistance(sp.pos, e.move.pos) + Math.abs(sp.pos.y - e.move.pos.y) * 2), 100);
      let score = nearest + this.rng() * 3;
      if (rotating) {
        score += Math.min(3, mates.filter((m) => horizontalDistance(m.move.pos, sp.pos) < 25).length) * 8;
        const head = { x: sp.pos.x, y: sp.pos.y + 1.6, z: sp.pos.z };
        if (enemies.some((e) => horizontalDistance(e.move.pos, sp.pos) < 45 && this.physics.lineOfSight({ x: e.move.pos.x, y: e.move.pos.y + 1.6, z: e.move.pos.z }, head))) score -= 40;
      }
      if (score > bestScore) {
        bestScore = score;
        best = sp;
      }
    }
    // Team modes: usually beside a teammate who's out of the fight, else the safest spawn point.
    const sp = (this.teams && this.rules.squadSpawn !== false && this.rng() < 0.7 ? this.squadSpawnSpot(c) : null) ?? best ?? { pos: { x: 0, y: 0, z: 0 }, yaw: 0 };
    c.streak = 0;
    c.order = undefined;
    c.move = { pos: { ...sp.pos }, velY: 0, grounded: false };
    c.yaw = sp.yaw;
    c.pitch = 0;
    c.health = c.maxHealth;
    c.armor = 0;
    c.alive = true;
    c.burnTicks = c.poisonTicks = c.slowTicks = c.frozenTicks = 0;
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
    c.weapons = new Map();
    for (const id of this.rules.weapons === 'spears' ? ['core.spear'] : this.rules.weapons === 'discs' ? [ARENA_DISC] : this.rules.startingWeapons) {
      const def = getWeapon(id);
      c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === 'own' ? (def.alt.pickup ?? 0) : 0 });
      c.current = weaponCode(def);
    }
    // Everyone starts with a frag grenade (TimeSplitters-style loadouts are pickups after that).
    c.throwable = this.rules.startingGrenades > 0 && !restrictedWeapons(this.rules) ? { kind: 'frag', count: this.rules.startingGrenades } : null;
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
    c.bot?.onSpawn(sp.yaw);
    this.mode?.onSpawn?.(c);
    this.pendingEvents.push({ e: 'spawn', s: c.slot });
    // Race: straight into your vehicle, on the grid or at your last checkpoint.
    this.race?.onSpawn(c.slot);
    // Air drop maps start you (or always spawn you) in the transport plane.
    if (this.mounts.some((m) => m.route && m.airdrop && m.airdrop !== 'off')) this.boardPlane(c);
  }

  /**
   * Ends the round; the winner is the top scorer unless scenario logic names
   * one (`null` = nobody). Co-op missions end with an outcome instead.
   */
  /** The map a "Next map" logic action sent everyone on to (a suite map ID; hosts check it), once the round has ended. */
  nextMap: string | null = null;

  private endRound(forced?: number | null, outcome?: 'victory' | 'defeat', next?: string): void {
    if (this.phase !== 'playing') return;
    if (next) this.nextMap = next;
    const ranked = this.combatants().sort((a, b) => b.kills - a.kills);
    const named = forced === undefined || forced === null ? undefined : this.actor(forced);
    const top = forced === undefined ? ranked[0] : named && !named.npc ? named : undefined;
    const tied = forced === undefined && top && ranked[1] && ranked[1].kills === top.kills;
    this.phase = 'intermission';
    this.phaseEndTick = this.tick + this.rules.intermissionTicks;
    this.projectiles = [];
    this.bullets = [];
    this.zones = [];
    if (this.teams && !outcome) {
      // Team Deathmatch: the highest team score wins; a tie at the top is a draw (logic can still name a player, whose team wins).
      const scores = [...this.teamScores()].sort((x, y) => y[1] - x[1]);
      const team = named && !named.npc ? named.faction : scores.length > 1 && scores[0]![1] === scores[1]![1] ? null : (scores[0]?.[0] ?? null);
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

  /** What `c` would carry into the next map of a chain. */
  carryOf(c: Combatant): CarryOver {
    return { kills: c.kills, deaths: c.deaths, weapons: [...c.weapons.values()].map((w): [string, number, number] => [w.def.id, w.mag, w.reserve]) };
  }

  /** Humans whose client has loaded everything (start gate). */
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
    this.phase = 'playing';
    for (const c of this.combatants()) c.spawnedAt = this.tick;
    this.phaseEndTick = this.roundEndTick();
    this.mode?.reset();
    this.zombies?.reset();
    this.race?.reset(false);
    this.pendingEvents.push({ e: 'round_start' });
  }

  private startRound(): void {
    this.phase = 'playing';
    this.phaseEndTick = this.roundEndTick();
    for (const p of this.pickups) p.availableAt = 0;
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
      c.deaths = 0;
      c.alive = false;
      this.leaveMount(c, false);
    }
    this.airdropped.clear();
    this.mode?.reset();
    this.zombies?.reset();
    this.classes?.reset();
    this.race?.reset(!this.opts.startGate);
    for (const c of this.combatants()) this.spawn(c);
    if (this.opts.startGate) {
      // Every round opens with the countdown (round_start comes when it ends).
      this.startCountdown();
      return;
    }
    this.pendingEvents.push({ e: 'round_start' });
  }

  timeLeftSeconds(): number {
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
      const fx = statusBits(c) | (this.classes?.fx(c) ?? 0);
      if (fx) s.fx = fx;
      if (c.cls) s.cl = classIndex(c.cls.id);
      if (c.bot) s.st = c.bot.state;
      if (c.move.stance) s.sn = c.move.stance;
      if (c.emoteUntil && this.tick < c.emoteUntil) s.em = 1;
      if (c.move.sprint) s.sr = 1;
      if (c.move.chute) s.ch = c.move.chute;
      if (c.move.drop) s.dr = 1;
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
    if (best >= 150 && !target) return;
    const at = target ? { x: target.move.pos.x, y: target.move.pos.y + 1, z: target.move.pos.z } : add(eye, scale(dir, best));
    this.pendingEvents.push({ e: 'ping', s: c.slot, p: tuple(at), ...(target ? { t: target.slot } : {}), ...(this.teams && c.faction ? { team: c.faction } : {}) });
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
    const mates = this.combatants().filter((o) => o !== c && o.alive && !o.mount && o.faction === c.faction && o.move.grounded && this.tick - (o.hurtAt ?? -Infinity) > TICK_RATE * 4 && !enemies.some((e) => distance(e.move.pos, o.move.pos) < 20));
    if (!mates.length) return null;
    const mate = mates[Math.floor(this.rng() * mates.length)]!;
    for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2, 0, (3 * Math.PI) / 4, (-3 * Math.PI) / 4]) {
      const yaw = mate.yaw + a;
      const pos = { x: mate.move.pos.x + Math.sin(yaw) * 1.4, y: mate.move.pos.y, z: mate.move.pos.z + Math.cos(yaw) * 1.4 };
      // Clear of walls, with floor under it, and not through a wall from the teammate.
      if (!this.physics.headroom({ x: pos.x, y: pos.y + 0.05, z: pos.z }, PLAYER.height)) continue;
      const floor = this.physics.raycastWorld({ x: pos.x, y: pos.y + 0.5, z: pos.z }, { x: 0, y: -1, z: 0 }, 1.5);
      if (floor === null) continue;
      if (!this.physics.lineOfSight({ x: mate.move.pos.x, y: mate.move.pos.y + 1, z: mate.move.pos.z }, { x: pos.x, y: pos.y + 1, z: pos.z })) continue;
      return { pos: { x: pos.x, y: pos.y + 0.5 - floor, z: pos.z }, yaw: mate.yaw };
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
      ...(c.mount ? { mo: [this.mounts[c.mount.index]!.index, c.mount.seat, Math.round((this.mounts[c.mount.index]!.guns[c.mount.seat]?.heat ?? 0) * 100)] as [number, number, number] } : {}),
      ...(c.throwable ? { gr: [THROWABLES.indexOf(c.throwable.kind), c.throwable.count] as [number, number] } : {}),
      rl: c.reloadTicks,
      rs: c.raiseTicks,
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
    return this.combatants().map((c) => ({ s: c.slot, k: c.kills, d: c.deaths, ...(c.selfKills ? { x: c.selfKills } : {}) }));
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
      ...(this.mounts.length ? { mt: this.mountSnapshots() } : {}),
      ...(this.covers.length ? { cv: this.covers.map((c): CoverSnapshot => [c.id, r3(c.pos.x), r3(c.pos.y), r3(c.pos.z), r3(c.yaw), Math.ceil((Math.max(0, c.health) / c.max) * 100)]) } : {}),
      ...(this.zones.length ? { zn: this.zones.map((z): ZoneSnapshot => [ZONE_KINDS.indexOf(z.kind), r3(z.pos.x), r3(z.pos.y), r3(z.pos.z), r3(z.radius), Math.round((z.endTick - this.tick) / 6) / 10]) } : {}),
      sc: this.scenario.delta(),
      np: this.npcSnapshots(),
      ...(this.rules.leaders && this.teams ? { ld: this.teams.map((t) => this.leaderOf.get(t.id) ?? -1) } : {}),
      ...(this.mode ? { md: this.mode.snapshot() } : this.zombies ? { md: { ts: [this.zombies.wave], zb: this.zombies.snapshot() } } : this.race ? { md: { ts: [], rc: this.race.snapshot() } } : {}),
    };
  }

  roster(): RosterEntry[] {
    return this.combatants().map((c) => ({ slot: c.slot, name: c.name, bot: c.kind === 'bot', look: c.look, team: this.teams ? c.faction : null }));
  }

  destroy(): void {
    this.nav.destroy();
    this.physics.free();
  }
}

function toView(c: Combatant, concealed = false): CombatantView {
  const v: CombatantView = { slot: c.slot, pos: c.move.pos, yaw: c.yaw, pitch: c.pitch, health: c.health, armor: c.armor, alive: c.alive };
  if (concealed) v.concealed = true;
  const stance = stanceOf(c.move);
  if (stance) v.stance = stance;
  if (c.kind === 'human') v.human = true;
  if (c.mount) v.mounted = true;
  if (c.move.grounded) v.grounded = true;
  return v;
}

/** Distance from point p to the segment a-b. */
function segmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 > 1e-9 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2)) : 0;
  return distance(p, add(a, scale(ab, t)));
}

const BOT_NAMES = ['Brassneck', 'Mildred', 'Captain Pell', 'Wick', 'Doctor Umber', 'Spoke', 'Gloam', 'Tibbs', 'Ferro', 'Lady Ash', 'Nub', 'Quill'];

/** Keeps a match at a target player count by adding or removing Player Bots around the humans. */
export class BotFiller {
  private counter = 0;

  constructor(
    private readonly match: Match,
    private readonly difficulty: BotDifficulty = BOT_DIFFICULTIES.normal,
    /** `takeBack`: a bot takes a leaving player's place where they stood; off (the default), the slot empties and a fresh bot spawns normally. */
    private readonly opts: { takeBack?: boolean } = {},
  ) {}

  private nextBot(): { name: string; profile: BotProfile } {
    const profile = CORE_BOT_PROFILES[this.counter % CORE_BOT_PROFILES.length]!;
    const round = Math.floor(this.counter / BOT_NAMES.length);
    // Big matches run out of names: Mildred, then Mildred 2.
    const name = `${BOT_NAMES[this.counter % BOT_NAMES.length]!}${round ? ` ${round + 1}` : ''}`;
    this.counter++;
    return { name, profile };
  }

  /**
   * A player joins: the worst-scoring bot on the team that needs them is removed
   * to make room (Match.takeOverBot) and they spawn normally, or they get a slot
   * of their own when there is no bot. Then the fill is kept.
   */
  join(name: string, look: string | undefined, fill: number): Combatant | null {
    const c = this.match.takeOverBot(name, look) ?? this.match.addHuman(name, look);
    this.rebalance(fill);
    return c;
  }

  /** A player leaves: their slot empties and the fill spawns a fresh bot normally (or, with `takeBack`, a bot takes their place where they were). */
  leave(slot: number, fill: number): void {
    const c = this.match.slots[slot];
    if (!c) return;
    const all = this.match.combatants();
    const humans = all.filter((x) => x.kind === 'human').length - (c.kind === 'human' ? 1 : 0);
    const bots = all.filter((x) => x.kind === 'bot').length;
    const want = Math.max(0, Math.min(fill - humans, MAX_PLAYER_SLOTS - humans));
    if (this.opts.takeBack === true && c.kind === 'human' && bots < want) {
      const { name, profile } = this.nextBot();
      this.match.handToBot(slot, name, profile, this.difficulty, true);
    } else this.match.remove(slot);
    this.rebalance(fill);
  }

  rebalance(fill: number): void {
    const all = this.match.combatants();
    const humans = all.filter((c) => c.kind === 'human').length;
    const bots = all.filter((c) => c.kind === 'bot');
    const want = Math.max(0, Math.min(fill - humans, MAX_PLAYER_SLOTS - humans));
    const targets = this.match.teamTargets();
    for (let i = bots.length; i > want; i--) {
      // In team modes, take bots from the team most over its size so the sides stay as set.
      const live = this.match.combatants();
      const over = (team: string | null) => live.filter((c) => c.faction === team).length / (team ? (targets.get(team) ?? 1) : 1);
      const left = live.filter((c) => c.kind === 'bot').sort((a, b) => over(b.faction) - over(a.faction) || b.slot - a.slot);
      this.match.remove(left[0]!.slot);
    }
    for (let i = bots.length; i < want; i++) {
      const { name, profile } = this.nextBot();
      if (!this.match.addBot(name, profile, this.difficulty, true)) break;
    }
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
}

/** Leader variant (rules.leaders 'vip'): extra points for downing an enemy team's leader. */
export const LEADER_BOUNTY = 3;

/** Past this many thinking bots, idle ones think every other tick (Match.botBudget). */
export const BOT_FULL_RATE = 40;
/** Held buttons a coasting bot keeps (movement stance); fire, use, jump and the rest are one-shot. */
const COAST_BUTTONS = BUTTON_SPRINT | BUTTON_CROUCH | BUTTON_PRONE;

/** Crouching steadies your aim; lying prone steadies it more. */
const STANCE_SPREAD = [1, 0.7, 0.5] as const;

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

/** Body-zone damage multiple for a weapon: head, torso or legs (spec §11). */
function zoneScale(gp: Gunplay, zone: HitZone): number {
  return zone === 1 ? gp.head : zone === 2 ? gp.legs : 1;
}
/** Movement multiplier from status effects (frozen solid, chilled, slowed) and the mode (carrying a flag). */
function statusSpeed(c: Combatant): number {
  if (c.frozenTicks > 0) return 0;
  return (c.slowTicks > 0 ? 0.55 : 1) * (1 - 0.6 * c.chill) * (c.modeSpeed ?? 1) * (c.classSpeed ?? 1);
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
    range: def.range,
    ...(alt.projectile ? { projectile: alt.projectile } : {}),
    alt: true,
  };
}
