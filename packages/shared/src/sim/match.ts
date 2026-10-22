import type RAPIER from '@dimforge/rapier3d-compat';
import { BotBrain, type CombatantView, type PickupView } from '../bots/brain.ts';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, type BotDifficulty, type BotProfile } from '../bots/profile.ts';
import { buildMapGeometry, type WorldBox } from '../map/geometry.ts';
import { NPC_ROLES, PLAYERS_FACTION, type EncounterEntity, type MapDocument, type NpcRole } from '../map/schema.ts';
import { add, createRng, distance, horizontalDistance, normalize, scale, viewDirection, type Vec3 } from '../math.ts';
import { NavWorld } from '../nav/index.ts';
import {
  POWERUP_DAMAGE_BIT,
  POWERUP_SPEED_BIT,
  type GameEvent,
  type MatchPhase,
  type NpcSnapshot,
  type PlayerSnapshot,
  type PrivateState,
  type RosterEntry,
  type ScoreEntry,
  type ServerMessage,
  type Tuple3,
} from '../protocol.ts';
import { MAX_PLAYER_SLOTS, PLAYER, TICK_DT, TICK_RATE } from './constants.ts';
import { ARMOR_ABSORB, DAMAGE_BOOST, MAX_ARMOR, PICKUP_RADIUS, SPEED_BOOST, getItem, type ItemDefinition } from './items.ts';
import { BUTTON_FIRE, BUTTON_RELOAD, BUTTON_USE, sanitizeInput, stepMovement, type MoveState, type PlayerInput } from './movement.ts';
import { PhysicsWorld } from './physics.ts';
import { DEFAULT_DEATHMATCH_RULES, type MatchRules } from './rules.ts';
import { Scenario } from './scenario.ts';
import { Encounters } from './encounters.ts';
import { DEFAULT_LOOK, getLook, lookForBot } from '../content/looks.ts';
import { NPC_DAMAGE_TO_PLAYERS, NPC_ID_BASE, NPC_PROFILE, NPC_ROLE_SPECS, mapFactions, relation } from './npc.ts';
import { getWeapon, rayCapsule, resolveHitscan, type WeaponDefinition } from './weapons.ts';

/** At most this many queued inputs are applied per player per tick, which caps speed hacks. */
const MAX_INPUTS_PER_TICK = 2;
const MAX_QUEUED_INPUTS = 16;
/** Lag compensation never rewinds further than this (≈ 300 ms). */
export const MAX_REWIND_TICKS = 18;
const HISTORY_TICKS = MAX_REWIND_TICKS + 2;
/** Projectiles ignore their owner briefly so they don't explode in the shooter's face. */
const OWNER_GRACE_TICKS = 8;

export interface WeaponState {
  def: WeaponDefinition;
  mag: number;
  reserve: number;
}

export interface Combatant {
  /** Actor ID: the player slot (0..31), or NPC_ID_BASE + n for NPCs. */
  slot: number;
  kind: 'human' | 'bot' | 'npc';
  /** Faction; null = free-for-all player (deathmatch). */
  faction: string | null;
  /** Movement speed multiplier (NPC roles are slower). */
  speedMul: number;
  /** NPC details. */
  npc?: { encounter: string; role: NpcRole; removeAt: number };
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
  /** Owned weapons by slot. */
  weapons: Map<number, WeaponState>;
  /** Slot of the held weapon. */
  current: number;
  // Timers below count applied inputs (not server ticks) so client prediction can mirror them exactly.
  fireCooldown: number;
  reloadTicks: number;
  raiseTicks: number;
  speedTicks: number;
  damageTicks: number;
  queue: PlayerInput[];
  lastSeq: number;
  bot?: BotBrain;
}

interface Projectile {
  id: number;
  owner: number;
  def: WeaponDefinition;
  pos: Vec3;
  vel: Vec3;
  ticksLeft: number;
  age: number;
}

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
  readonly physics: PhysicsWorld;
  readonly nav: NavWorld;
  readonly slots: (Combatant | null)[] = new Array(MAX_PLAYER_SLOTS).fill(null);
  readonly spawnPoints: { pos: Vec3; yaw: number }[];
  readonly pickups: PickupState[];
  /** Doors, buttons, destructibles, zones, traps and the map's logic rules. */
  readonly scenario: Scenario;
  /** NPC squads spawned by encounter entities. */
  readonly encounters: Encounters;
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
  private nextProjectileId = 1;
  /** Positions of everyone at recent ticks, for lag-compensated hitscan. */
  private readonly history = new Map<number, Map<number, Vec3>>();
  /** Bot AI time spent in the most recent tick, for instrumentation. */
  lastAiMs = 0;

  /** Requires initPhysics() and initNavigation() to have resolved. */
  constructor(
    readonly map: MapDocument,
    readonly rules: MatchRules = DEFAULT_DEATHMATCH_RULES,
    readonly seed = 1,
  ) {
    this.geometry = buildMapGeometry(map);
    this.physics = new PhysicsWorld(this.geometry);
    this.nav = NavWorld.build(this.geometry);
    this.rng = createRng(seed);
    this.spawnPoints = map.entities
      .filter((e) => e.kind === 'spawn')
      .map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, yaw: e.yaw }));
    this.pickups = [];
    for (const e of map.entities) {
      if (e.kind !== 'pickup') continue;
      const item = getItem(e.item);
      if (!item) continue;
      this.pickups.push({ id: e.id, item, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, respawnTicks: Math.round((e.respawnSeconds ?? item.respawnSeconds) * TICK_RATE), availableAt: 0, enabled: true });
    }
    this.phaseEndTick = this.roundEndTick();
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
  }

  /** The map's NPC factions (or the default enemy faction). */
  get factions() {
    return mapFactions(this.map);
  }

  /** Faction players join: everyone shares one side in co-op; deathmatch is free-for-all. */
  private get playerFaction(): string | null {
    return this.rules.mode === 'core.coop' ? PLAYERS_FACTION : null;
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
      npc: { encounter: e.id, role, removeAt: Infinity },
      move: { pos: { ...pos }, velY: 0, grounded: false },
      yaw,
      health: spec.health,
      alive: true,
      weapons: new Map([[def.slot, { def, mag: def.magazine, reserve: def.reserveMax }]]),
      current: def.slot,
    };
    c.bot = new BotBrain(id, NPC_PROFILE, BOT_DIFFICULTIES[e.difficulty], this.seed);
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
      collider: this.physics.createPlayerCollider(),
      move: { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: false },
      yaw: 0,
      pitch: 0,
      health: PLAYER.maxHealth,
      armor: 0,
      alive: false,
      respawnTick: 0,
      kills: 0,
      deaths: 0,
      weapons: new Map(),
      current: 0,
      fireCooldown: 0,
      reloadTicks: 0,
      raiseTicks: 0,
      speedTicks: 0,
      damageTicks: 0,
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
    if (c) c.look = getLook(look).id;
    return c;
  }

  addBot(name: string, profile: BotProfile, difficulty: BotDifficulty = BOT_DIFFICULTIES.normal): Combatant | null {
    const c = this.addCombatant('bot', name);
    if (c) {
      c.look = lookForBot(c.slot);
      c.bot = new BotBrain(c.slot, profile, difficulty, this.seed);
      c.bot.onSpawn(c.yaw);
    }
    return c;
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
    } else {
      this.runBots();
      for (const c of this.actors()) this.applyInputs(c);
      this.stepProjectiles();
      if (this.phase === 'playing') this.scenario.step();
      if (this.phase === 'playing') this.encounters.step();
      for (const c of this.combatants()) {
        if (!c.alive && this.tick >= c.respawnTick) this.spawn(c);
      }
      for (const c of this.npcs.values()) if (!c.alive && this.tick >= c.npc!.removeAt) this.removeNpc(c.slot);
      if (this.tick >= this.phaseEndTick) this.endRound();
    }
    this.recordHistory();
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private runBots(): void {
    const t0 = performance.now();
    const actors = this.actors();
    const views = new Map(actors.map((c) => [c.slot, toView(c)]));
    const pickups: PickupView[] = this.pickups.map((p) => ({ id: p.id, item: p.item, pos: p.pos, available: p.enabled && this.tick >= p.availableAt }));
    const npcPickups: PickupView[] = [];
    const blockers = this.scenario.blockers();
    const hazards = this.scenario.hazards();
    const spawnPoints = this.spawnPoints.map((s) => s.pos);
    const coop = this.rules.mode === 'core.coop';
    for (const c of actors) {
      if (!c.bot) continue;
      const hostiles = actors.filter((o) => o.alive && this.hostile(c, o));
      const npc = c.npc;
      // Dormant NPCs (no enemy within earshot of the squad's area) skip thinking entirely.
      if (npc && c.alive && !c.bot.lastSeen && !hostiles.some((o) => horizontalDistance(o.move.pos, c.move.pos) < 70)) {
        c.queue.push({ seq: c.lastSeq + 1, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0 });
        continue;
      }
      const orderGoal = npc ? this.encounters.goalFor(c.slot) : coop ? this.coopGoal(c, hostiles) : null;
      const input = c.bot.think({
        tick: this.tick,
        self: views.get(c.slot)!,
        others: hostiles.map((o) => views.get(o.slot)!),
        physics: this.physics,
        nav: this.nav,
        spawnPoints: npc && orderGoal ? [orderGoal.pos] : spawnPoints,
        pickups: npc ? npcPickups : pickups,
        inventory: [...c.weapons.values()].map((w) => ({ def: w.def, mag: w.mag, reserve: w.reserve })),
        held: c.current,
        blockers,
        hazards,
        orderGoal,
      });
      c.queue.push(input);
    }
    this.lastAiMs = performance.now() - t0;
  }

  /**
   * Co-op Player Bots head for the nearest enemy they know of (the mission's
   * NPCs), or stay near a human when there is nothing to fight.
   */
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

  private applyInputs(c: Combatant): void {
    const n = Math.min(MAX_INPUTS_PER_TICK, c.queue.length);
    for (let i = 0; i < n; i++) {
      const input = c.queue.shift()!;
      c.lastSeq = input.seq;
      c.yaw = input.yaw;
      c.pitch = input.pitch;
      if (!c.alive) continue;

      if (input.weapon && input.weapon !== c.current && c.weapons.has(input.weapon)) this.switchTo(c, input.weapon);

      c.move = stepMovement(this.physics, c.collider, c.move, input, (c.speedTicks > 0 ? SPEED_BOOST : 1) * c.speedMul);
      if (c.fireCooldown > 0) c.fireCooldown--;
      if (c.raiseTicks > 0) c.raiseTicks--;
      if (c.speedTicks > 0) c.speedTicks--;
      if (c.damageTicks > 0) c.damageTicks--;
      if (c.reloadTicks > 0 && --c.reloadTicks === 0) this.finishReload(c);

      if (input.buttons & BUTTON_USE) {
        this.scenario.use(c.slot, { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z }, c.yaw, c.pitch);
        if (this.phase !== 'playing') break;
      }
      const held = heldWeapon(c);
      if (input.buttons & BUTTON_RELOAD) this.startReload(c);
      if (input.buttons & BUTTON_FIRE && c.fireCooldown === 0 && c.raiseTicks === 0 && c.reloadTicks === 0) {
        if (held.def.magazine > 0 && held.mag === 0) this.startReload(c);
        else {
          if (held.def.magazine > 0) held.mag--;
          c.fireCooldown = held.def.fireIntervalTicks;
          this.fire(c, held.def, input.viewTick ?? 0);
        }
      }

      if (!c.npc) this.collectPickups(c);
      // NPCs never run dry: their reserve refills.
      else if (held.reserve < held.def.magazine) held.reserve = held.def.reserveMax;
      if (c.move.pos.y < PLAYER.killY) this.kill(c, null, 'core.fall');
      if (!c.alive) break;
    }
  }

  // ---------------------------------------------------------------- weapons

  private switchTo(c: Combatant, slot: number): void {
    const w = c.weapons.get(slot);
    if (!w) return;
    c.current = slot;
    c.raiseTicks = w.def.raiseTicks;
    c.reloadTicks = 0;
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

  private fire(shooter: Combatant, def: WeaponDefinition, viewTick: number): void {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + PLAYER.eyeHeight, z: shooter.move.pos.z };
    const aim = viewDirection(shooter.yaw, shooter.pitch);
    if (def.kind === 'projectile' && def.projectile) {
      const spec = def.projectile;
      this.projectiles.push({
        id: this.nextProjectileId++,
        owner: shooter.slot,
        def,
        pos: add(eye, scale(aim, 0.5)),
        vel: scale(aim, spec.speed),
        ticksLeft: Math.round(spec.fuseSeconds * TICK_RATE),
        age: 0,
      });
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
      else if (body !== null) this.scenario.damageBody(body, this.boosted(shooter, def.damage), shooter.slot);
      return;
    }

    const to: Tuple3[] = [];
    const hits: (number | null)[] = [];
    const bodies: number[] = [];
    for (let p = 0; p < def.pellets; p++) {
      const dir = this.spreadDir(aim, def.spread);
      const world = this.physics.raycastHit(eye, dir, def.range);
      const shot = resolveHitscan(eye, dir, def.range, world?.dist ?? null, targets);
      to.push(tuple(shot.end));
      hits.push(shot.hitSlot);
      if (shot.hitSlot === null && world) bodies.push(world.handle);
    }
    this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to, hit: hits });
    for (const h of hits) if (h !== null) this.damage(this.actor(h)!, def.damage, shooter, def.id);
    for (const b of bodies) this.scenario.damageBody(b, this.boosted(shooter, def.damage), shooter.slot);
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
  private targetsFor(shooter: Combatant, viewTick: number): { slot: number; feet: Vec3 }[] {
    let past: Map<number, Vec3> | undefined;
    if (shooter.kind === 'human' && viewTick > 0) {
      const t = Math.max(this.tick - MAX_REWIND_TICKS, Math.min(this.tick, viewTick));
      past = this.history.get(t);
    }
    // Allies are not targets: shots pass through them (no friendly fire).
    return this.actors()
      .filter((o) => o.alive && this.hostile(shooter, o))
      .map((o) => ({ slot: o.slot, feet: past?.get(o.slot) ?? o.move.pos }));
  }

  private recordHistory(): void {
    const snap = new Map<number, Vec3>();
    for (const c of this.actors()) if (c.alive) snap.set(c.slot, { ...c.move.pos });
    this.history.set(this.tick, snap);
    this.history.delete(this.tick - HISTORY_TICKS);
  }

  private stepProjectiles(): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      const spec = p.def.projectile!;
      p.age++;
      p.vel = { x: p.vel.x, y: p.vel.y - spec.gravity * TICK_DT, z: p.vel.z };
      const delta = scale(p.vel, TICK_DT);
      const len = Math.hypot(delta.x, delta.y, delta.z);
      const dir = scale(delta, 1 / (len || 1));
      let hitDist = this.physics.raycastWorld(p.pos, dir, len);
      const owner = this.actor(p.owner);
      for (const c of this.actors()) {
        if (!c.alive || (c === owner && p.age < OWNER_GRACE_TICKS)) continue;
        if (owner && c !== owner && !this.hostile(owner, c)) continue;
        const d = rayCapsule(p.pos, dir, c.move.pos);
        if (d !== null && d <= len && (hitDist === null || d < hitDist)) hitDist = d;
      }
      if (hitDist !== null) {
        this.explode(p, add(p.pos, scale(dir, Math.max(0, hitDist - 0.05))));
        continue;
      }
      p.pos = add(p.pos, delta);
      if (--p.ticksLeft <= 0 || p.pos.y < PLAYER.killY) {
        this.explode(p, p.pos);
        continue;
      }
      keep.push(p);
    }
    this.projectiles = keep;
  }

  private explode(p: Projectile, at: Vec3): void {
    const spec = p.def.projectile!;
    const owner = this.actor(p.owner) ?? null;
    this.pendingEvents.push({ e: 'explode', s: p.owner, p: tuple(at), r: spec.splashRadius });
    this.splash(at, spec.splashRadius, spec.splashDamage, spec.splashEdgeDamage, owner, p.def.id, spec.selfDamageScale);
  }

  /** Radial damage falling off from `damage` at the centre to `edge` at `radius`, blocked by walls. Also hits destructibles. */
  private splash(at: Vec3, radius: number, damage: number, edge: number, owner: Combatant | null, weapon: string, selfScale: number): void {
    for (const c of this.actors()) {
      if (!c.alive) continue;
      const target = chest(c.move.pos);
      const d = distance(at, target);
      if (d > radius || !this.physics.lineOfSight(at, target)) continue;
      let dmg = damage + (edge - damage) * (d / radius);
      if (owner && c === owner) dmg *= selfScale;
      this.damage(c, dmg, owner, weapon);
    }
    const boost = owner && owner.damageTicks > 0 ? DAMAGE_BOOST : 1;
    this.scenario.splash(at, radius, damage * boost, edge * boost, owner?.slot ?? null, this.physics);
  }

  private boosted(attacker: Combatant, amount: number): number {
    return attacker.damageTicks > 0 ? amount * DAMAGE_BOOST : amount;
  }

  /** Apply damage through armor and the attacker's damage boost. */
  private damage(victim: Combatant, amount: number, attacker: Combatant | null, weapon: string): void {
    if (!victim.alive || this.phase !== 'playing') return;
    // No friendly fire; hazards (no attacker) and your own grenades still hurt.
    if (attacker && attacker !== victim && !this.hostile(attacker, victim)) return;
    if (attacker?.npc && !victim.npc) amount *= NPC_DAMAGE_TO_PLAYERS;
    let dmg = attacker && attacker !== victim && attacker.damageTicks > 0 ? amount * DAMAGE_BOOST : amount;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, dmg * ARMOR_ABSORB);
      victim.armor -= absorbed;
      dmg -= absorbed;
    }
    victim.health -= dmg;
    if (victim.health <= 0) this.kill(victim, attacker === victim ? null : attacker, weapon);
  }

  private kill(victim: Combatant, killer: Combatant | null, weapon: string): void {
    victim.alive = false;
    victim.health = 0;
    this.pendingEvents.push({ e: 'kill', killer: killer?.slot ?? null, victim: victim.slot, weapon });
    // Only players score; NPC kills of players count as the player's death.
    if (killer && !killer.npc) killer.kills++;
    if (victim.npc) {
      victim.npc.removeAt = this.tick + TICK_RATE * 2;
      this.encounters.onNpcKilled(victim.slot, killer?.slot ?? null);
      return;
    }
    victim.deaths++;
    victim.respawnTick = this.tick + this.rules.respawnDelayTicks;
    if (!killer) victim.kills--; // suicides (falls, own grenades, traps) cost a point
    this.scenario.playerKilled(victim.slot, killer?.slot ?? null);
    if (killer && !killer.npc && this.rules.scoreLimit > 0 && killer.kills >= this.rules.scoreLimit) this.endRound();
  }

  // ---------------------------------------------------------------- pickups

  private collectPickups(c: Combatant): void {
    for (const p of this.pickups) {
      if (!p.enabled || this.tick < p.availableAt) continue;
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
        if (c.health >= PLAYER.maxHealth) return false;
        c.health = Math.min(PLAYER.maxHealth, c.health + e.amount);
        return true;
      case 'armor':
        if (c.armor >= MAX_ARMOR) return false;
        c.armor = Math.min(MAX_ARMOR, c.armor + e.amount);
        return true;
      case 'ammo': {
        let used = false;
        for (const w of c.weapons.values()) {
          if (w.def.magazine === 0 || w.reserve >= w.def.reserveMax) continue;
          w.reserve = Math.min(w.def.reserveMax, w.reserve + Math.ceil(w.def.pickupAmmo / 2));
          used = true;
        }
        return used;
      }
      case 'weapon': {
        const def = getWeapon(e.weapon);
        const owned = c.weapons.get(def.slot);
        if (owned) {
          if (owned.reserve >= def.reserveMax) return false;
          owned.reserve = Math.min(def.reserveMax, owned.reserve + def.pickupAmmo);
          return true;
        }
        c.weapons.set(def.slot, { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo) });
        // New guns come up immediately, like most arena shooters.
        if (def.slot > c.current) this.switchTo(c, def.slot);
        return true;
      }
      case 'powerup':
        if (e.powerup === 'speed') c.speedTicks = e.seconds * TICK_RATE;
        else c.damageTicks = e.seconds * TICK_RATE;
        return true;
    }
  }

  // ---------------------------------------------------------------- lifecycle

  /** Spawn at the point farthest from living opponents, with a little randomness among near-equal choices. */
  private spawn(c: Combatant): void {
    const enemies = this.actors().filter((o) => o.alive && this.hostile(c, o));
    let best = this.spawnPoints[0];
    let bestScore = -Infinity;
    for (const sp of this.spawnPoints) {
      const nearest = enemies.reduce((m, e) => Math.min(m, horizontalDistance(sp.pos, e.move.pos) + Math.abs(sp.pos.y - e.move.pos.y) * 2), 100);
      const score = nearest + this.rng() * 3;
      if (score > bestScore) {
        bestScore = score;
        best = sp;
      }
    }
    const sp = best ?? { pos: { x: 0, y: 0, z: 0 }, yaw: 0 };
    c.move = { pos: { ...sp.pos }, velY: 0, grounded: false };
    c.yaw = sp.yaw;
    c.pitch = 0;
    c.health = PLAYER.maxHealth;
    c.armor = 0;
    c.alive = true;
    c.weapons = new Map();
    for (const id of this.rules.startingWeapons) {
      const def = getWeapon(id);
      c.weapons.set(def.slot, { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo) });
      c.current = def.slot;
    }
    c.fireCooldown = 0;
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
    this.pendingEvents.push(outcome ? { e: 'round_end', winner: null, outcome } : { e: 'round_end', winner: top && !tied ? top.slot : null });
  }

  private startRound(): void {
    this.phase = 'playing';
    this.phaseEndTick = this.roundEndTick();
    for (const p of this.pickups) p.availableAt = 0;
    for (const id of [...this.npcs.keys()]) this.removeNpc(id);
    this.encounters.reset();
    this.scenario.reset();
    for (const c of this.combatants()) {
      c.kills = 0;
      c.deaths = 0;
      c.alive = false;
    }
    for (const c of this.combatants()) this.spawn(c);
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
      if (c.bot) s.st = c.bot.state;
      return s;
    });
  }

  /** The owning player's inventory and timers. */
  privateState(slot: number): PrivateState | undefined {
    const c = this.slots[slot];
    if (!c) return undefined;
    return {
      inv: [...c.weapons.values()].sort((a, b) => a.def.slot - b.def.slot).map((w) => [w.def.slot, w.mag, w.reserve]),
      rl: c.reloadTicks,
      rs: c.raiseTicks,
      sp: c.speedTicks,
      dm: c.damageTicks,
    };
  }

  /** Compact NPC state for snapshots (see NpcSnapshot). */
  npcSnapshots(): NpcSnapshot[] {
    const factions = this.factions;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return [...this.npcs.values()].map((c) => {
      const role = NPC_ROLES.indexOf(c.npc!.role);
      const spec = NPC_ROLE_SPECS[c.npc!.role];
      return [c.slot, r2(c.move.pos.x), r2(c.move.pos.y), r2(c.move.pos.z), r3(c.yaw), r3(c.pitch), Math.ceil((Math.max(0, c.health) / spec.health) * 100), role, Math.max(0, factions.findIndex((f) => f.id === c.faction)), c.alive ? 1 : 0, c.current];
    });
  }

  scores(): ScoreEntry[] {
    return this.combatants().map((c) => ({ s: c.slot, k: c.kills, d: c.deaths }));
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
      pr: this.projectiles.map((p) => [p.id, r3(p.pos.x), r3(p.pos.y), r3(p.pos.z)]),
      pk: this.pickups.filter((p) => !p.enabled || this.tick < p.availableAt).map((p) => p.id),
      sc: this.scenario.delta(),
      np: this.npcSnapshots(),
    };
  }

  roster(): RosterEntry[] {
    return this.combatants().map((c) => ({ slot: c.slot, name: c.name, bot: c.kind === 'bot', look: c.look }));
  }

  destroy(): void {
    this.nav.destroy();
    this.physics.free();
  }
}

function toView(c: Combatant): CombatantView {
  return { slot: c.slot, pos: c.move.pos, yaw: c.yaw, pitch: c.pitch, health: c.health, armor: c.armor, alive: c.alive };
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
    for (let i = bots.length; i > want; i--) this.match.remove(bots[i - 1]!.slot);
    for (let i = bots.length; i < want; i++) {
      const profile = CORE_BOT_PROFILES[this.counter % CORE_BOT_PROFILES.length]!;
      const name = BOT_NAMES[this.counter % BOT_NAMES.length]!;
      this.counter++;
      if (!this.match.addBot(name, profile, this.difficulty)) break;
    }
  }
}
