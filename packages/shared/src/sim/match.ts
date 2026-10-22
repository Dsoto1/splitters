import type RAPIER from '@dimforge/rapier3d-compat';
import { BotBrain, type CombatantView, type PickupView } from '../bots/brain.ts';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, type BotDifficulty, type BotProfile } from '../bots/profile.ts';
import { buildMapGeometry, type WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import { add, createRng, distance, horizontalDistance, normalize, scale, viewDirection, type Vec3 } from '../math.ts';
import { NavWorld } from '../nav/index.ts';
import {
  POWERUP_DAMAGE_BIT,
  POWERUP_SPEED_BIT,
  type GameEvent,
  type MatchPhase,
  type PlayerSnapshot,
  type PrivateState,
  type RosterEntry,
  type ScoreEntry,
  type ServerMessage,
  type Tuple3,
} from '../protocol.ts';
import { MAX_PLAYER_SLOTS, PLAYER, TICK_DT, TICK_RATE } from './constants.ts';
import { ARMOR_ABSORB, DAMAGE_BOOST, MAX_ARMOR, PICKUP_RADIUS, SPEED_BOOST, getItem, type ItemDefinition } from './items.ts';
import { BUTTON_FIRE, BUTTON_RELOAD, sanitizeInput, stepMovement, type MoveState, type PlayerInput } from './movement.ts';
import { PhysicsWorld } from './physics.ts';
import { DEFAULT_DEATHMATCH_RULES, type MatchRules } from './rules.ts';
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
  slot: number;
  kind: 'human' | 'bot';
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
      this.pickups.push({ id: e.id, item, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, respawnTicks: Math.round((e.respawnSeconds ?? item.respawnSeconds) * TICK_RATE), availableAt: 0 });
    }
    this.phaseEndTick = this.roundEndTick();
  }

  private roundEndTick(): number {
    return this.rules.timeLimitSeconds > 0 ? this.tick + this.rules.timeLimitSeconds * TICK_RATE : Infinity;
  }

  combatants(): Combatant[] {
    return this.slots.filter((c): c is Combatant => c !== null);
  }

  addHuman(name: string): Combatant | null {
    return this.addCombatant('human', name);
  }

  addBot(name: string, profile: BotProfile, difficulty: BotDifficulty = BOT_DIFFICULTIES.normal): Combatant | null {
    const c = this.addCombatant('bot', name);
    if (c) {
      c.bot = new BotBrain(c.slot, profile, difficulty, this.seed);
      c.bot.onSpawn(c.yaw);
    }
    return c;
  }

  private addCombatant(kind: Combatant['kind'], name: string): Combatant | null {
    const slot = this.slots.indexOf(null);
    if (slot < 0) return null;
    const c: Combatant = {
      slot,
      kind,
      name,
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
      for (const c of this.combatants()) this.applyInputs(c);
      this.stepProjectiles();
      for (const c of this.combatants()) {
        if (!c.alive && this.tick >= c.respawnTick) this.spawn(c);
      }
      if (this.tick >= this.phaseEndTick) this.endRound();
    }
    this.recordHistory();
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private runBots(): void {
    const t0 = performance.now();
    const views = this.combatants().map(toView);
    const pickups: PickupView[] = this.pickups.map((p) => ({ id: p.id, item: p.item, pos: p.pos, available: this.tick >= p.availableAt }));
    for (const c of this.combatants()) {
      if (!c.bot) continue;
      const self = views.find((v) => v.slot === c.slot)!;
      const input = c.bot.think({
        tick: this.tick,
        self,
        others: views.filter((v) => v.slot !== c.slot),
        physics: this.physics,
        nav: this.nav,
        spawnPoints: this.spawnPoints.map((s) => s.pos),
        pickups,
        inventory: [...c.weapons.values()].map((w) => ({ def: w.def, mag: w.mag, reserve: w.reserve })),
        held: c.current,
      });
      c.queue.push(input);
    }
    this.lastAiMs = performance.now() - t0;
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

      c.move = stepMovement(this.physics, c.collider, c.move, input, c.speedTicks > 0 ? SPEED_BOOST : 1);
      if (c.fireCooldown > 0) c.fireCooldown--;
      if (c.raiseTicks > 0) c.raiseTicks--;
      if (c.speedTicks > 0) c.speedTicks--;
      if (c.damageTicks > 0) c.damageTicks--;
      if (c.reloadTicks > 0 && --c.reloadTicks === 0) this.finishReload(c);

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

      this.collectPickups(c);
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
      for (const yawOffset of [0, -0.3, 0.3]) {
        const dir = viewDirection(shooter.yaw + yawOffset, shooter.pitch);
        const shot = resolveHitscan(eye, dir, def.range, this.physics.raycastWorld(eye, dir, def.range), targets);
        if (shot.hitSlot !== null) {
          hit = shot.hitSlot;
          break;
        }
      }
      this.pendingEvents.push({ e: 'melee', s: shooter.slot, hit });
      if (hit !== null) this.damage(this.slots[hit]!, def.damage, shooter, def.id);
      return;
    }

    const to: Tuple3[] = [];
    const hits: (number | null)[] = [];
    for (let p = 0; p < def.pellets; p++) {
      const dir = this.spreadDir(aim, def.spread);
      const shot = resolveHitscan(eye, dir, def.range, this.physics.raycastWorld(eye, dir, def.range), targets);
      to.push(tuple(shot.end));
      hits.push(shot.hitSlot);
    }
    this.pendingEvents.push({ e: 'shot', s: shooter.slot, w: def.id, from: tuple(eye), to, hit: hits });
    for (const h of hits) if (h !== null) this.damage(this.slots[h]!, def.damage, shooter, def.id);
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
    return this.combatants()
      .filter((o) => o !== shooter && o.alive)
      .map((o) => ({ slot: o.slot, feet: past?.get(o.slot) ?? o.move.pos }));
  }

  private recordHistory(): void {
    const snap = new Map<number, Vec3>();
    for (const c of this.combatants()) if (c.alive) snap.set(c.slot, { ...c.move.pos });
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
      for (const c of this.combatants()) {
        if (!c.alive || (c.slot === p.owner && p.age < OWNER_GRACE_TICKS)) continue;
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
    const owner = this.slots[p.owner] ?? null;
    this.pendingEvents.push({ e: 'explode', s: p.owner, p: tuple(at), r: spec.splashRadius });
    for (const c of this.combatants()) {
      if (!c.alive) continue;
      const target = chest(c.move.pos);
      const d = distance(at, target);
      if (d > spec.splashRadius || !this.physics.lineOfSight(at, target)) continue;
      let dmg = spec.splashDamage + (spec.splashEdgeDamage - spec.splashDamage) * (d / spec.splashRadius);
      if (owner && c === owner) dmg *= spec.selfDamageScale;
      this.damage(c, dmg, owner, p.def.id);
    }
  }

  /** Apply damage through armor and the attacker's damage boost. */
  private damage(victim: Combatant, amount: number, attacker: Combatant | null, weapon: string): void {
    if (!victim.alive || this.phase !== 'playing') return;
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
    victim.deaths++;
    victim.respawnTick = this.tick + this.rules.respawnDelayTicks;
    if (killer) killer.kills++;
    else victim.kills--; // suicides (falls, own grenades) cost a point
    this.pendingEvents.push({ e: 'kill', killer: killer?.slot ?? null, victim: victim.slot, weapon });
    if (killer && killer.kills >= this.rules.scoreLimit) this.endRound();
  }

  // ---------------------------------------------------------------- pickups

  private collectPickups(c: Combatant): void {
    for (const p of this.pickups) {
      if (this.tick < p.availableAt) continue;
      if (horizontalDistance(p.pos, c.move.pos) > PICKUP_RADIUS || Math.abs(p.pos.y - c.move.pos.y) > 1.5) continue;
      if (!this.applyItem(c, p.item)) continue;
      p.availableAt = this.tick + p.respawnTicks;
      this.pendingEvents.push({ e: 'pickup', s: c.slot, id: p.id, item: p.item.id });
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
    const enemies = this.combatants().filter((o) => o !== c && o.alive);
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

  private endRound(): void {
    if (this.phase !== 'playing') return;
    const ranked = this.combatants().sort((a, b) => b.kills - a.kills);
    const top = ranked[0];
    const tied = top && ranked[1] && ranked[1].kills === top.kills;
    this.phase = 'intermission';
    this.phaseEndTick = this.tick + this.rules.intermissionTicks;
    this.projectiles = [];
    this.pendingEvents.push({ e: 'round_end', winner: top && !tied ? top.slot : null });
  }

  private startRound(): void {
    this.phase = 'playing';
    this.phaseEndTick = this.roundEndTick();
    for (const p of this.pickups) p.availableAt = 0;
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
      pk: this.pickups.filter((p) => this.tick < p.availableAt).map((p) => p.id),
    };
  }

  roster(): RosterEntry[] {
    return this.combatants().map((c) => ({ slot: c.slot, name: c.name, bot: c.kind === 'bot' }));
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
