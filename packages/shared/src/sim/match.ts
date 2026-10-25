import type RAPIER from '@dimforge/rapier3d-compat';
import { BotBrain, type CombatantView, type MountView, type NoiseView, type PickupView, type SeatView } from '../bots/brain.ts';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, profileFor, type BotDifficulty, type BotProfile } from '../bots/profile.ts';
import { blockBoxes, buildMapGeometry, mapKillY, mapTerrainMesh, propBoxes, type WorldBox } from '../map/geometry.ts';
import { EncounterEntity as EncounterSchema, NPC_ROLES, PLAYERS_FACTION, type EncounterEntity, type Faction, type MapDocument, type NpcRole } from '../map/schema.ts';
import { add, createRng, distance, dot, horizontalDistance, lookAngles, normalize, scale, sub, viewDirection, type Vec3 } from '../math.ts';
import { getMountDef, mountToWorld, type MountDef, type SeatDef, type SeatRole } from './mounts.ts';
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
import { BUTTON_ALT, BUTTON_JUMP, BUTTON_CROUCH, EMOTE_DANCE, PING, QUICK_MESSAGES, SAY_FOLLOW, SAY_HOLD, BUTTON_RESPAWN, BUTTON_FIRE, BUTTON_RELOAD, BUTTON_ZOOM, BUTTON_THROW, BUTTON_USE, applyPads, mapLadders, mapPads, navLinks,
  padLandings, sanitizeInput, stepMovement, type JumpPad, type Ladder, type MoveState, type PlayerInput } from './movement.ts';
import { PhysicsWorld } from './physics.ts';
import { BREATH_SECONDS, JET, LIQUID_SPECS, liquidAt, mapLiquids, stepJetFuel, type LiquidBox } from './liquids.ts';
import { DEFAULT_DEATHMATCH_RULES, isTeamMode, matchPhysics, type MatchRules } from './rules.ts';
import { createMode, type ModeLogic } from './modes/index.ts';
import { Scenario } from './scenario.ts';
import { Encounters } from './encounters.ts';
import { ZombieSurvival } from './zombies.ts';
import { chargeIntoMelee } from './creatures.ts';
import { DEFAULT_LOOK, bodySizeOf, getLook, lookForBot } from '../content/looks.ts';
import { NPC_DAMAGE_TO_PLAYERS, NPC_ID_BASE, NPC_ROLE_PROFILES, NPC_ROLE_SPECS, mapFactions, mapTeams, matchTeams, relation, validLookId } from './npc.ts';
import { OIL_TRACTION, PROJECTILE_VISUALS, THROWABLES, THROWABLE_DEFS, ZONE_KINDS, getWeapon, zoneContains, rayCapsule, weaponByCode, weaponCode, resolveHitscan, throwableWeaponId, hitZone, zoneMultiplier, type HitZone, type AltFire, type ProjectileSpec, type StatusHit, type ThrowableKind, type WeaponDefinition, type ZoneKind, type ZoneSpec } from './weapons.ts';

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
  /** Movement multiplier set by an objective mode (flag carriers are slower); absent = 1. */
  modeSpeed?: number;
  /** Bots: the last shot that hit or passed close (for taking cover). */
  shotAt?: { tick: number; from: Vec3 };
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
  /** Walkers (the sheep): on the ground, which way they're heading, and ticks until they may hop again. */
  walking?: boolean;
  heading?: Vec3;
  hopIn?: number;
}

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
  readonly nav: NavWorld;
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
  private zones: Zone[] = [];
  private readonly pads: JumpPad[];
  private readonly ladders: Ladder[];
  private readonly liquids: LiquidBox[];
  private readonly mounts: MountRt[] = [];
  /** Collider handle -> mount, so shots and blasts can hurt vehicles. */
  private readonly mountBodies = new Map<number, MountRt>();
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
  /** Recent gunfire and explosions, for bots' hearing. */
  private noises: NoiseView[] = [];

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
    this.nav = NavWorld.build([...this.geometry, ...propBoxes(map, true), ...blockBoxes(map, true)], mapTerrainMesh(map), navLinks(map.entities, this.physics, this.phys.gravity));
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
    map.entities.forEach((e, index) => {
      if (e.kind !== 'mount') return;
      const def = getMountDef(e.model);
      if (def) this.addMount(index, def, { x: e.position[0], y: e.position[1], z: e.position[2] }, e.yaw, e.faction, e.respawnSeconds);
    });
    this.pads = mapPads(map.entities);
    this.ladders = mapLadders(map.entities);
    this.liquids = mapLiquids(map.entities);
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
      players: () => this.combatants().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos })),
      actors: () => this.actors().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos })),
      hurt: (slot, amount, weapon) => {
        const c = this.actor(slot);
        if (c) this.damage(c, amount, null, weapon);
      },
      blast: (at, radius, damage, edge, owner, weapon) => {
        this.pendingEvents.push({ e: 'explode', s: owner ?? -1, p: tuple(at), r: radius });
        this.splash(at, radius, damage, edge, owner === null ? null : (this.actor(owner) ?? null), weapon, 1);
      },
      endRound: (winner, outcome) => this.endRound(winner, outcome),
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
      nav: this.nav,
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
        })
      : null;
    this.zombies = rules.mode === 'core.zombies' ? this.zombieDirector() : null;
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
    // Team kills still cost the team, but a team's score never drops below zero.
    for (const [id, v] of out) out.set(id, Math.max(0, v));
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

  /** Small and large looks play differently unless the match turns body sizes off. */
  private applyBodySize(c: Combatant): void {
    const spec = BODY_SIZES[this.rules.bodySizes === false ? 'standard' : bodySizeOf(c.look)];
    c.size = spec.scale;
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
    if (c.queue.length > MAX_QUEUED_INPUTS) c.queue.splice(0, c.queue.length - MAX_QUEUED_INPUTS);
  }

  /** Advance the simulation by one fixed tick and return the events it produced. */
  step(): GameEvent[] {
    this.tick++;
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
      for (const c of this.actors()) this.applyInputs(c);
      this.stepMounts();
      this.stepProjectiles();
      this.stepZones();
      this.stepStatuses();
      if (this.phase === 'playing') this.scenario.step();
      if (this.phase === 'playing') this.encounters.step();
      if (this.phase === 'playing') this.mode?.step();
      if (this.phase === 'playing') this.zombies?.step();
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
    return events;
  }

  private runBots(): void {
    const t0 = performance.now();
    const actors = this.actors();
    const views = new Map(actors.map((c) => [c.slot, toView(c)]));
    const spearItem = getItem('core.weapon_spear');
    const lyingSpears: PickupView[] = spearItem ? this.projectiles.filter((p) => p.stuck && p.spec.retrievable).map((p) => ({ id: `spear_${p.id}`, item: spearItem, pos: p.pos, available: true })) : [];
    const pickups: PickupView[] = [...lyingSpears, ...this.pickups.filter((p) => this.rules.weapons !== 'spears' || !['weapon', 'ammo', 'throwable'].includes(p.item.effect.kind)).map((p) => ({ id: p.id, item: p.item, pos: p.pos, available: p.enabled && this.tick >= p.availableAt, ...(p.enabled && this.tick < p.availableAt ? { respawnIn: (p.availableAt - this.tick) / TICK_RATE } : {}) }))];
    const npcPickups: PickupView[] = [];
    const blockers = this.scenario.blockers();
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
    for (const c of actors) {
      if (!c.bot) continue;
      const hostiles = actors.filter((o) => o.alive && this.hostile(c, o));
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
        : (this.teammateOrder(c) ?? (zombies ? this.holdOutGoal(c, hostiles) : coop ? this.coopGoal(c, hostiles) : (this.mode?.botGoal(c, hostiles) ?? null)));
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
        blockers,
        hazards,
        orderGoal,
        allies,
        // Focused bots (flag carriers) also ignore distant gunfire and near misses: they keep running.
        noises: aware < Infinity ? undefined : noises,
        shotAt: aware < Infinity ? null : (c.shotAt ?? null),
        mounts: aware < Infinity ? undefined : mounts,
        seat: c.mount ? this.seatView(c) : null,
        squad: npc ? this.encounters.squadFor(c.slot, npc.role) : null,
      });
      // Melee creatures rush the target they can see instead of keeping their distance.
      if (npc && NPC_ROLE_SPECS[npc.role].melee && c.alive) {
        const target = c.bot.target === null ? null : this.actor(c.bot.target);
        chargeIntoMelee(input, c.move.pos, target?.alive ? target.move.pos : null, getWeapon(NPC_ROLE_SPECS[npc.role].weapon).range);
      }
      c.queue.push(input);
    }
    this.lastAiMs = performance.now() - t0;
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
      if (!spec || !m.alive) continue;
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
      seats: m.def.seats.map((s, i) => ({ role: s.role, free: m.seats[i] === null, ...(s.weapon ? { weapon: getWeapon(s.weapon) } : {}), ...(s.arc !== undefined ? { arc: s.arc } : {}) })),
      ...(m.def.vehicle ? { maxSpeed: m.def.vehicle.maxSpeed } : {}),
      humanNear: humans.some((h) => horizontalDistance(h.move.pos, m.pos) < 35),
    }));
  }

  private seatView(c: Combatant): SeatView | null {
    const m = this.mounts[c.mount!.index];
    const seat = m?.def.seats[c.mount!.seat];
    if (!m || !seat) return null;
    const gun = m.guns[c.mount!.seat];
    return { mount: m.index, seat: c.mount!.seat, role: seat.role, ...(gun ? { weapon: gun.def } : {}), ...(seat.arc !== undefined ? { arc: seat.arc } : {}), heat: gun?.heat ?? 0, overheated: gun?.overheated ?? false };
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
      if (ev.e !== 'shot' || ev.s < 0) continue;
      const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
      this.noises.push({ pos: from, tick: this.tick, by: ev.s, range: 45 });
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

  /** Where a teammate told this bot to be ("Follow me!" / "Hold here!"), while the order lasts. */
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
      if (!c.alive) continue;
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
        if (seat.role === 'driver') {
          const up = !!(input.buttons & BUTTON_JUMP);
          const down = !!(input.buttons & BUTTON_CROUCH);
          m.drive = m.def.vehicle?.fly ? { forward: input.forward, right: input.right, lift: (up ? 1 : 0) - (down ? 1 : 0) } : { forward: input.forward, right: input.right, brake: up };
        }
        if (seat.arc !== undefined) {
          const d = Math.atan2(Math.sin(c.yaw - m.yaw), Math.cos(c.yaw - m.yaw));
          c.yaw = m.yaw + Math.max(-seat.arc, Math.min(seat.arc, d));
        }
        c.pitch = Math.max(-0.5, Math.min(0.75, c.pitch));
        if (seat.weapon) {
          m.aimYaw = c.yaw;
          m.aimPitch = c.pitch;
        }
      } else {
        const was = c.move.pos;
        const before = c.move;
        const stepped = stepMovement(this.physics, c.collider, c.move, input, (c.speedTicks > 0 ? SPEED_BOOST : 1) * c.speedMul * statusSpeed(c), TICK_DT, this.tractionAt(c.move.pos), { liquids: this.liquids, jet: c.jetFuel !== null && c.jetFuel >= JET.burn, ladders: this.ladders, scale: c.size, gravity: this.phys.gravity });
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
      if (c.reloadTicks > 0 && --c.reloadTicks === 0) this.finishReload(c);

      if (input.buttons & BUTTON_USE) {
        c.useTick = this.tick;
        // Get out, get in, or use whatever you are looking at.
        if (c.mount) this.leaveMount(c, true);
        else if (!this.enterMount(c)) this.scenario.use(c.slot, { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z }, c.yaw, c.pitch);
        if (this.phase !== 'playing') break;
      }
      // Seated: the seat's gun if it has one; drivers without one can't shoot; passengers use their own.
      const seatNow = c.mount ? this.seatOf(c) : null;
      const gun = seatNow?.weapon ? this.mounts[c.mount!.index]!.guns[c.mount!.seat]! : null;
      const unarmed = seatNow?.role === 'driver' && !gun;
      const held = gun ?? heldWeapon(c);
      const def = held.def;
      const fireDown = (input.buttons & BUTTON_FIRE) !== 0;
      c.prevButtons = input.buttons;
      if (!fireDown) c.semiLatch = false;
      if (input.buttons & BUTTON_RELOAD) this.startReload(c);
      const frozen = c.frozenTicks > 0;
      const ready = c.fireCooldown === 0 && (gun ? true : c.raiseTicks === 0) && c.reloadTicks === 0 && !frozen && !unarmed;
      // Spin-up and charge: the trigger has to be held this long first.
      if (def.windupTicks) {
        const able = fireDown && c.raiseTicks === 0 && c.reloadTicks === 0 && !frozen && !held.overheated && (def.magazine === 0 || held.mag > 0);
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
        if (def.magazine > 0 && held.mag === 0) this.startReload(c);
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
      if (input.buttons & BUTTON_THROW && c.throwCooldown === 0 && c.throwable && c.throwable.count > 0 && !frozen && !unarmed && !gun) {
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
      if (c.move.pos.y < this.killY) this.kill(c, null, 'core.fall');
      if (!c.alive) break;
    }
  }

  // ---------------------------------------------------------------- weapons

  private switchTo(c: Combatant, code: number): void {
    const w = c.weapons.get(code);
    if (!w) return;
    c.current = code;
    c.raiseTicks = w.def.raiseTicks;
    c.reloadTicks = 0;
    c.windup = 0;
    c.burstLeft = 0;
    c.bloom = 0;
  }

  private startReload(c: Combatant): void {
    const w = heldWeapon(c);
    if (w.def.magazine === 0 || w.mag >= w.def.magazine || w.reserve === 0 || c.reloadTicks > 0) return;
    c.reloadTicks = w.def.reloadTicks;
  }

  private finishReload(c: Combatant): void {
    const w = heldWeapon(c);
    const take = Math.min(w.def.magazine - w.mag, w.reserve);
    w.mag += take;
    w.reserve -= take;
  }

  /** Launch a projectile from the eye along the aim (lifted a little for throws, so they arc). */
  private launch(shooter: Combatant, spec: ProjectileSpec, weapon: string, lift = 0, spread = 0): void {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    const aim = this.spreadDir(lift ? normalize(add(viewDirection(shooter.yaw, shooter.pitch), { x: 0, y: lift, z: 0 })) : viewDirection(shooter.yaw, shooter.pitch), spread);
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
    const aim = viewDirection(shooter.yaw, shooter.pitch);
    // Bloom from sustained fire widens the spread; each shot adds more. So does
    // shooting on the run or in the air; aiming down a scope tightens it, and a
    // scoped rifle fired from the hip is a guess.
    const spread = aimSpread(shooter, def, def.spread + (def.alt ? 0 : shooter.bloom) + movementSpread(shooter, def)) * STANCE_SPREAD[stanceOf(shooter.move)];
    if (def.recoil && !def.alt) shooter.bloom = Math.min(def.recoil.maxBloom, shooter.bloom + def.recoil.bloom);
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

    const to: Tuple3[] = [];
    const hits: (number | null)[] = [];
    const zones: number[] = [];
    const bodies: number[] = [];
    const struck: { slot: number; dir: Vec3; zone: HitZone }[] = [];
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
        for (const t of along) struck.push({ slot: t.slot, dir, zone: hitZone(feetOf(t.slot), eye.y + dir.y * t.d, heightOf(t.slot)) });
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
      if (shot.hitSlot !== null) struck.push({ slot: shot.hitSlot, dir, zone });
      else if (world) bodies.push(world.handle);
    }
    this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to, hit: hits, ...(zones.some((z) => z) ? { z: zones } : {}), ...(def.alt ? { alt: 1 as const } : {}) });
    for (const { slot, dir, zone } of struck) {
      const victim = this.actor(slot)!;
      this.damage(victim, def.damage * zoneMultiplier(zone, def.headshot), shooter, def.id, zone === 1);
      if (def.status) this.applyStatus(victim, def.status, shooter, def.id);
      if (def.knockback) this.push(victim, dir, def.knockback);
    }
    for (const b of bodies) if (!this.damageMountBody(b, this.boosted(shooter, def.damage), shooter)) this.scenario.damageBody(b, this.boosted(shooter, def.damage), shooter.slot);
    if (def.chain && struck.length) this.chainLightning(shooter, def, struck[0]!.slot, eye);
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
        if (!c.alive || (c === owner && p.age < OWNER_GRACE_TICKS)) continue;
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
          if (--p.ticksLeft <= 0 || (spec.maxBounces !== undefined && p.bounces > spec.maxBounces)) this.explode(p, p.pos);
          else keep.push(p);
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
    if (!step) return;
    const [hx, , hz] = m.def.half;
    for (const o of [[-(hx + 0.9), 0, 0], [hx + 0.9, 0, 0], [0, 0, -(hz + 0.9)], [0, 0, hz + 0.9]] as const) {
      const spot = mountToWorld(m.pos, m.yaw, o);
      // Room to stand: nothing solid from the knees to above the head (a ray starting inside a wall hits at once).
      if (this.physics.raycastHit({ x: spot.x, y: spot.y + 0.4, z: spot.z }, { x: 0, y: 1, z: 0 }, PLAYER.height)) continue;
      c.move = { pos: { x: spot.x, y: spot.y + 0.3, z: spot.z }, velY: 0, grounded: false };
      return;
    }
    c.move = { pos: { x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z }, velY: 0, grounded: false };
  }

  /** Damage whatever mount owns this collider; false when it isn't one. */
  private damageMountBody(handle: number, amount: number, attacker: Combatant | null): boolean {
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

  private damageMount(m: MountRt, amount: number, attacker: Combatant | null): void {
    if (!m.alive || this.phase !== 'playing' || amount <= 0) return;
    m.health -= amount;
    if (attacker) m.lastHitBy = attacker.slot;
    if (m.health <= 0) this.destroyMount(m);
  }

  /** It blows up: everyone aboard is thrown out into the blast; it comes back at home later. */
  private destroyMount(m: MountRt): void {
    m.alive = false;
    m.health = 0;
    m.respawnAt = this.tick + m.respawnTicks;
    const aboard = m.seats.map((slot) => (slot === null ? undefined : this.actor(slot))).filter((c): c is Combatant => !!c);
    for (const c of aboard) this.leaveMount(c, true);
    this.physics.setBoxEnabled(m.body, false);
    this.physics.commit();
    const at = { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z };
    this.pendingEvents.push({ e: 'explode', s: m.lastHitBy ?? -1, p: tuple(at), r: m.def.blast.radius });
    const by = m.lastHitBy === null ? null : (this.actor(m.lastHitBy) ?? null);
    this.splash(at, m.def.blast.radius, m.def.blast.damage, m.def.blast.damage * 0.2, by, 'core.wreck', 1, 6);
  }

  private respawnMount(m: MountRt): void {
    m.alive = true;
    m.health = m.def.health;
    m.pos = { ...m.home.pos };
    m.yaw = m.aimYaw = m.home.yaw;
    m.aimPitch = 0;
    m.speed = m.velY = m.slide = 0;
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
        if (this.phase === 'playing' && this.tick >= m.respawnAt) this.respawnMount(m);
        continue;
      }
      // Mounted guns cool whenever they are not firing.
      for (const g of m.guns) {
        if (!g?.def.heat || g.firedTick === this.tick) continue;
        g.heat = Math.max(0, (g.heat ?? 0) - g.def.heat.coolPerTick);
        if (g.heat === 0) g.overheated = false;
      }
      if (m.def.vehicle) this.driveVehicle(m);
      if (m.def.sentry) this.runSentry(m);
      // Riders move with it.
      m.seats.forEach((slot, seat) => {
        const c = slot === null ? undefined : this.actor(slot);
        if (c?.alive) c.move = { pos: this.seatFeet(m, seat), velY: 0, grounded: true };
      });
    }
    // Moved bodies must be in place before this tick's shots and sight checks.
    if (this.mounts.length) this.physics.commit();
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
    const target = forward > 0 ? v.maxSpeed * forward : forward < 0 ? -v.reverseSpeed * -forward : 0;
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
    const grip = grounded ? (v.grip ?? (v.hover ? 0.06 : 0.25)) * (brake ? 0.25 : 1) : 0;
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
      this.destroyMount(m);
      return;
    }
    // Running people over.
    if (Math.abs(m.speed) < 5) return;
    const driverSlot = m.seats[m.def.seats.findIndex((s) => s.role === 'driver')] ?? null;
    const driver = driverSlot === null ? null : (this.actor(driverSlot) ?? null);
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
    }
  }

  /** Sentries turn toward the nearest enemy they can see and fire while lined up. */
  private runSentry(m: MountRt): void {
    const spec = m.def.sentry!;
    const muzzle = { x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z };
    let target: Combatant | null = null;
    let bestD = spec.range;
    for (const c of this.actors()) {
      if (!c.alive) continue;
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
      .filter((c) => c.alive && (m.faction === null || relation(this.factions, m.faction, c.faction) === 'enemy'))
      .map((c) => ({ slot: c.slot, feet: c.move.pos }));
    const shot = resolveHitscan(muzzle, dir, def.range, world && world.handle !== m.body.handle ? world.dist : null, targets);
    this.pendingEvents.push({ e: 'shot', s: -1, w: def.id, from: tuple(muzzle), to: [tuple(shot.end)], hit: [shot.hitSlot] });
    if (shot.hitSlot !== null) this.damage(this.actor(shot.hitSlot)!, def.damage, null, def.id);
  }

  /** Mounts for snapshots (see MountSnapshot). */
  mountSnapshots(): MountSnapshot[] {
    return this.mounts.map((m) => [m.index, r3(m.pos.x), r3(m.pos.y), r3(m.pos.z), r3(m.yaw), r3(m.aimYaw), r3(m.aimPitch), Math.ceil((Math.max(0, m.health) / m.def.health) * 100), m.alive ? 1 : 0, ...m.seats.map((s) => s ?? -1)]);
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
    const drop = (peak - m.pos.y) * this.phys.gravity;
    if (drop > 5) this.damage(c, (drop - 5) * 9, null, 'core.fall');
  }

  /** Apply damage through armor and the attacker's damage boost. */
  private damage(victim: Combatant, amount: number, attacker: Combatant | null, weapon: string, head = false): void {
    if (!victim.alive || this.phase !== 'playing') return;
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
      if (this.rules.weapons === 'spears' && (p.item.effect.kind === 'weapon' || p.item.effect.kind === 'ammo' || p.item.effect.kind === 'throwable')) continue;
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
      case 'uav':
        this.uavUntil.set(this.uavSide(c), this.tick + e.seconds * TICK_RATE);
        this.pendingEvents.push({ e: 'msg', text: `${c.name}: UAV online`, secs: 3 });
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
    c.breath = 0;
    c.chill = c.bloom = c.windup = c.burstLeft = 0;
    c.semiLatch = false;
    c.weapons = new Map();
    for (const id of this.rules.weapons === 'spears' ? ['core.spear'] : this.rules.startingWeapons) {
      const def = getWeapon(id);
      c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === 'own' ? (def.alt.pickup ?? 0) : 0 });
      c.current = weaponCode(def);
    }
    // Everyone starts with a frag grenade (TimeSplitters-style loadouts are pickups after that).
    c.throwable = this.rules.startingGrenades > 0 && this.rules.weapons !== 'spears' ? { kind: 'frag', count: this.rules.startingGrenades } : null;
    c.fireCooldown = 0;
    c.throwCooldown = 0;
    c.reloadTicks = 0;
    c.raiseTicks = 0;
    c.speedTicks = 0;
    c.damageTicks = 0;
    c.bot?.onSpawn(sp.yaw);
    this.pendingEvents.push({ e: 'spawn', s: c.slot });
  }

  /**
   * Ends the round; the winner is the top scorer unless scenario logic names
   * one (`null` = nobody). Co-op missions end with an outcome instead.
   */
  private endRound(forced?: number | null, outcome?: 'victory' | 'defeat'): void {
    if (this.phase !== 'playing') return;
    const ranked = this.combatants().sort((a, b) => b.kills - a.kills);
    const named = forced === undefined || forced === null ? undefined : this.actor(forced);
    const top = forced === undefined ? ranked[0] : named && !named.npc ? named : undefined;
    const tied = forced === undefined && top && ranked[1] && ranked[1].kills === top.kills;
    this.phase = 'intermission';
    this.phaseEndTick = this.tick + this.rules.intermissionTicks;
    this.projectiles = [];
    this.zones = [];
    if (this.teams && !outcome) {
      // Team Deathmatch: the highest team score wins; a tie at the top is a draw (logic can still name a player, whose team wins).
      const scores = [...this.teamScores()].sort((x, y) => y[1] - x[1]);
      const team = named && !named.npc ? named.faction : scores.length > 1 && scores[0]![1] === scores[1]![1] ? null : (scores[0]?.[0] ?? null);
      this.pendingEvents.push({ e: 'round_end', winner: null, team });
      return;
    }
    this.pendingEvents.push(outcome ? { e: 'round_end', winner: null, outcome } : { e: 'round_end', winner: top && !tied ? top.slot : null });
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
    this.phaseEndTick = this.roundEndTick();
    this.mode?.reset();
    this.zombies?.reset();
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
    for (const c of this.combatants()) {
      c.kills = 0;
      c.selfKills = 0;
      c.deaths = 0;
      c.alive = false;
    }
    this.mode?.reset();
    this.zombies?.reset();
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
      const fx = statusBits(c);
      if (fx) s.fx = fx;
      if (c.bot) s.st = c.bot.state;
      if (c.move.stance) s.sn = c.move.stance;
      if (c.emoteUntil && this.tick < c.emoteUntil) s.em = 1;
      if (c.move.sprint) s.sr = 1;
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
    for (const b of this.combatants()) {
      if (b.kind !== 'bot' || !b.alive || b === c || this.hostile(c, b)) continue;
      // Free-for-all has no side to order.
      if (!this.teams && this.rules.mode !== 'core.coop' && this.rules.mode !== 'core.zombies') continue;
      if (horizontalDistance(b.move.pos, c.move.pos) > 30) continue;
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
      sp: c.speedTicks,
      dm: c.damageTicks,
      ...(c.jetFuel !== null ? { jp: c.jetFuel } : {}),
      ...(this.jammed(c) ? { jm: Math.ceil((this.jammed(c) - this.tick) / TICK_RATE) } : {}),
      ...(c.streak ? { ks: c.streak } : {}),
      ...((this.uavUntil.get(this.uavSide(c)) ?? 0) > this.tick ? { uv: Math.ceil((this.uavUntil.get(this.uavSide(c))! - this.tick) / TICK_RATE) } : {}),
      ...(c.move.stamina !== undefined || c.move.rest || c.move.winded ? { sta: [Math.round((c.move.stamina ?? 1) * 1000), c.move.rest ?? 0, c.move.winded ? 1 : 0] as [number, number, number] } : {}),
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
      ...(this.mode ? { md: this.mode.snapshot() } : this.zombies ? { md: { ts: [this.zombies.wave], zb: this.zombies.snapshot() } } : {}),
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

function toView(c: Combatant): CombatantView {
  const v: CombatantView = { slot: c.slot, pos: c.move.pos, yaw: c.yaw, pitch: c.pitch, health: c.health, armor: c.armor, alive: c.alive };
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
  ) {}

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
      const profile = CORE_BOT_PROFILES[this.counter % CORE_BOT_PROFILES.length]!;
      const name = BOT_NAMES[this.counter % BOT_NAMES.length]!;
      this.counter++;
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
    if (w.mag === 0) return false;
    w.mag--;
  }
  return true;
}

/** Movement multiplier from status effects (frozen solid, chilled, slowed) and the mode (carrying a flag). */
function statusSpeed(c: Combatant): number {
  if (c.frozenTicks > 0) return 0;
  return (c.slowTicks > 0 ? 0.55 : 1) * (1 - 0.6 * c.chill) * (c.modeSpeed ?? 1);
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
