import type RAPIER from '@dimforge/rapier3d-compat';
import { BotBrain, type CombatantView } from '../bots/brain.ts';
import { BOT_DIFFICULTIES, type BotDifficulty, type BotProfile } from '../bots/profile.ts';
import { buildMapGeometry, type WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import { createRng, horizontalDistance, viewDirection, type Vec3 } from '../math.ts';
import { NavWorld } from '../nav/index.ts';
import type { GameEvent, MatchPhase, PlayerSnapshot, RosterEntry, ScoreEntry, Tuple3 } from '../protocol.ts';
import { MAX_PLAYER_SLOTS, PLAYER, TICK_RATE } from './constants.ts';
import { BUTTON_FIRE, sanitizeInput, stepMovement, type MoveState, type PlayerInput } from './movement.ts';
import { PhysicsWorld } from './physics.ts';
import { DEFAULT_DEATHMATCH_RULES, type MatchRules } from './rules.ts';
import { getWeapon, resolveHitscan, type WeaponDefinition } from './weapons.ts';

/** At most this many queued inputs are applied per player per tick, which caps speed hacks. */
const MAX_INPUTS_PER_TICK = 2;
const MAX_QUEUED_INPUTS = 16;

export interface Combatant {
  slot: number;
  kind: 'human' | 'bot';
  name: string;
  collider: RAPIER.Collider;
  move: MoveState;
  yaw: number;
  pitch: number;
  health: number;
  alive: boolean;
  respawnTick: number;
  kills: number;
  deaths: number;
  /** Inputs remaining before the weapon can fire again. Counted per applied input so prediction and server agree. */
  fireCooldown: number;
  weapon: WeaponDefinition;
  queue: PlayerInput[];
  lastSeq: number;
  bot?: BotBrain;
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const tuple = (v: Vec3): Tuple3 => [r3(v.x), r3(v.y), r3(v.z)];

/**
 * Authoritative Deathmatch simulation. Contains no networking or Node/DOM
 * APIs, so the dedicated server, tests, load harness and (later) the in-browser
 * MapMaker test mode all drive the same code by calling tick().
 */
export class Match {
  readonly geometry: WorldBox[];
  readonly physics: PhysicsWorld;
  readonly nav: NavWorld;
  readonly slots: (Combatant | null)[] = new Array(MAX_PLAYER_SLOTS).fill(null);
  readonly spawnPoints: { pos: Vec3; yaw: number }[];

  tick = 0;
  phase: MatchPhase = 'playing';
  /** Tick when the current phase ends (round time limit or intermission). */
  private phaseEndTick: number;
  private pendingEvents: GameEvent[] = [];
  private readonly rng: () => number;
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
      alive: false,
      respawnTick: 0,
      kills: 0,
      deaths: 0,
      fireCooldown: 0,
      weapon: getWeapon(this.rules.startingWeapon),
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
      for (const c of this.combatants()) {
        if (!c.alive && this.tick >= c.respawnTick) this.spawn(c);
      }
      if (this.tick >= this.phaseEndTick) this.endRound();
    }
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private runBots(): void {
    const t0 = performance.now();
    const views = this.combatants().map(toView);
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
      c.move = stepMovement(this.physics, c.collider, c.move, input);
      if (c.fireCooldown > 0) c.fireCooldown--;
      if (input.buttons & BUTTON_FIRE && c.fireCooldown === 0) {
        c.fireCooldown = c.weapon.fireIntervalTicks;
        this.fire(c);
      }
      if (c.move.pos.y < PLAYER.killY) this.kill(c, null);
      if (!c.alive) break;
    }
  }

  private fire(shooter: Combatant): void {
    const origin = { x: shooter.move.pos.x, y: shooter.move.pos.y + PLAYER.eyeHeight, z: shooter.move.pos.z };
    const dir = viewDirection(shooter.yaw, shooter.pitch);
    const range = shooter.weapon.range;
    const targets = this.combatants()
      .filter((o) => o !== shooter && o.alive)
      .map((o) => ({ slot: o.slot, feet: o.move.pos }));
    const shot = resolveHitscan(origin, dir, range, this.physics.raycastWorld(origin, dir, range), targets);
    this.pendingEvents.push({ e: 'shot', s: shooter.slot, from: tuple(origin), to: tuple(shot.end), hit: shot.hitSlot });
    if (shot.hitSlot === null) return;
    const victim = this.slots[shot.hitSlot]!;
    victim.health -= shooter.weapon.damage;
    if (victim.health <= 0) this.kill(victim, shooter);
  }

  private kill(victim: Combatant, killer: Combatant | null): void {
    victim.alive = false;
    victim.health = 0;
    victim.deaths++;
    victim.respawnTick = this.tick + this.rules.respawnDelayTicks;
    if (killer) killer.kills++;
    else victim.kills--; // falling out of the world counts as a suicide
    this.pendingEvents.push({ e: 'kill', killer: killer?.slot ?? null, victim: victim.slot, weapon: killer?.weapon.id ?? 'core.fall' });
    if (killer && killer.kills >= this.rules.scoreLimit) this.endRound();
  }

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
    c.alive = true;
    c.fireCooldown = 0;
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
    this.pendingEvents.push({ e: 'round_end', winner: top && !tied ? top.slot : null });
  }

  private startRound(): void {
    this.phase = 'playing';
    this.phaseEndTick = this.roundEndTick();
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

  playerSnapshots(): PlayerSnapshot[] {
    return this.combatants().map((c) => {
      const s: PlayerSnapshot = {
        s: c.slot,
        p: [c.move.pos.x, c.move.pos.y, c.move.pos.z],
        vy: c.move.velY,
        g: c.move.grounded ? 1 : 0,
        yaw: r3(c.yaw),
        pitch: r3(c.pitch),
        hp: c.health,
        alive: c.alive ? 1 : 0,
      };
      if (c.bot) s.st = c.bot.state;
      return s;
    });
  }

  scores(): ScoreEntry[] {
    return this.combatants().map((c) => ({ s: c.slot, k: c.kills, d: c.deaths }));
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
  return { slot: c.slot, pos: c.move.pos, yaw: c.yaw, pitch: c.pitch, health: c.health, alive: c.alive };
}
