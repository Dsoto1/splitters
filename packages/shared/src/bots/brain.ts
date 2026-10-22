import { angleDelta, clamp, createRng, distance, horizontalDistance, lookAngles, type Vec3 } from '../math.ts';
import type { NavWorld } from '../nav/index.ts';
import { PLAYER, TICK_DT, TICK_RATE } from '../sim/constants.ts';
import type { ItemDefinition } from '../sim/items.ts';
import { BUTTON_FIRE, BUTTON_JUMP, BUTTON_RELOAD, type PlayerInput } from '../sim/movement.ts';
import type { WeaponDefinition } from '../sim/weapons.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import { segmentHitsAabb, type Aabb } from '../sim/scenarioDefs.ts';
import type { BotDifficulty, BotProfile } from './profile.ts';

export interface CombatantView {
  slot: number;
  pos: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  alive: boolean;
}

export interface PickupView {
  id: string;
  item: ItemDefinition;
  pos: Vec3;
  available: boolean;
}

export interface InventoryView {
  def: WeaponDefinition;
  mag: number;
  reserve: number;
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
  held: number;
  /** Closed doors bots can't open and intact breakable walls: paths through them are treated as unreachable. */
  blockers?: readonly Aabb[];
  /** Traps that are dangerous right now: bots wait at the edge instead of walking in. */
  hazards?: readonly Aabb[];
  /**
   * Squad order (NPCs) or co-op goal (Player Bots): when not fighting, go here
   * instead of roaming, and wait within `radius` of it.
   */
  orderGoal?: { pos: Vec3; radius: number } | null;
}

export type BotState = 'roam' | 'engage' | 'chase' | 'retreat' | 'dead';

const eye = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
const chest = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + PLAYER.height * 0.6, z: p.z });

const SIGHT_RANGE = 60;
const HEARING_RANGE = 6;
const FOV_COS = Math.cos((110 / 2) * (Math.PI / 180));
const STUCK_WINDOW_TICKS = TICK_RATE;
const PATH_REFRESH_TICKS = TICK_RATE / 2;

/**
 * Player Bot brain. Produces a PlayerInput every tick, exactly like a human
 * client, so bots obey the same movement/weapon rules. Layers (v1 spec §7.3):
 * perception (staggered), tactical state choice, navigation, combat aim, and
 * humanisation via reaction delay, aim error and turn-rate limits.
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
  private targetSlot: number | null = null;
  private visibleSince = new Map<number, number>();
  private lastKnown: { pos: Vec3; tick: number } | null = null;
  private pathIndex = 0;
  private roamGoal: Vec3 | null = null;
  private lastPathTick = -Infinity;
  private aimErrYaw = 0;
  private aimErrPitch = 0;
  private strafeDir = 1;
  private nextStrafeFlip = 0;
  private yaw = 0;
  private pitch = 0;
  private stuckCheck: { tick: number; pos: Vec3 } | null = null;
  private jumpNext = false;

  constructor(
    readonly slot: number,
    readonly profile: BotProfile,
    readonly difficulty: BotDifficulty,
    seed: number,
  ) {
    this.rng = createRng(seed * 7919 + slot);
  }

  /** Enemy currently targeted (actor ID), if any. */
  get target(): number | null {
    return this.targetSlot;
  }

  /** Where an enemy was last seen, and when. */
  get lastSeen(): { pos: Vec3; tick: number } | null {
    return this.lastKnown;
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
    this.lastKnown = null;
    this.path = [];
    this.goal = null;
    this.roamGoal = null;
    this.stuckCheck = null;
  }

  think(view: BotWorldView): PlayerInput {
    const seq = ++this.seq;
    const me = view.self;
    if (!me.alive) {
      this.state = 'dead';
      return { seq, forward: 0, right: 0, yaw: this.yaw, pitch: this.pitch, buttons: 0 };
    }

    const interval = this.difficulty.perceptionIntervalTicks;
    if ((view.tick + this.slot) % interval === 0) this.perceive(view);

    const target = this.targetSlot === null ? undefined : view.others.find((o) => o.slot === this.targetSlot && o.alive);
    if (this.targetSlot !== null && !target) this.targetSlot = null;

    this.chooseState(view, target);

    let moveYaw: number | null = null;
    let backOff = false;
    let wantFire = false;

    switch (this.state) {
      case 'engage': {
        const t = target!;
        const dist = horizontalDistance(me.pos, t.pos);
        const preferred = 4 + (this.profile.rangePreference / 100) * 22;
        if (dist > preferred + 3) moveYaw = this.followPathTo(view, t.pos, true);
        else if (dist < preferred - 3) backOff = true;
        wantFire = this.aimAt(view, t);
        break;
      }
      case 'chase':
        moveYaw = this.followPathTo(view, this.lastKnown!.pos, false);
        this.lookAlongPath(view);
        break;
      case 'retreat': {
        const threat = target?.pos ?? this.lastKnown?.pos ?? me.pos;
        const refuge = this.pickupGoal(view, 'health') ?? farthest(view.spawnPoints, threat) ?? me.pos;
        moveYaw = this.followPathTo(view, refuge, false);
        if (target) wantFire = this.aimAt(view, target);
        else this.lookAlongPath(view);
        break;
      }
      case 'roam':
        if (view.orderGoal) {
          const g = view.orderGoal;
          if (horizontalDistance(me.pos, g.pos) > g.radius || Math.abs(me.pos.y - g.pos.y) > 2) {
            moveYaw = this.followPathTo(view, g.pos, true);
            this.lookAlongPath(view);
          } else {
            // On station: slowly scan around.
            this.turnToward(this.yaw + 0.6 * TICK_DT * (this.strafeDir || 1), 0);
          }
          break;
        }
        if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 1.5 || (view.tick + this.slot) % TICK_RATE === 0) {
          // Re-evaluate pickups once a second; otherwise keep the current goal.
          this.roamGoal = this.pickupGoal(view) ?? (this.roamGoal && horizontalDistance(me.pos, this.roamGoal) >= 1.5 ? this.roamGoal : this.pickRoamGoal(view));
        }
        moveYaw = this.followPathTo(view, this.roamGoal, false);
        // Arrived or unreachable: pick another goal next tick.
        if (moveYaw === null) this.roamGoal = null;
        this.lookAlongPath(view);
        break;
      case 'dead':
        break;
    }

    if (moveYaw !== null && this.hazardAhead(view, moveYaw)) moveYaw = null;

    let forward = 0;
    let right = 0;
    if (moveYaw !== null) {
      const rel = angleDelta(this.yaw, moveYaw);
      forward = Math.cos(rel);
      right = Math.sin(rel);
    } else if (backOff) {
      forward = -1;
    }
    if (this.state === 'engage' || (this.state === 'retreat' && target)) {
      if (view.tick >= this.nextStrafeFlip) {
        this.strafeDir = this.rng() < 0.5 ? -1 : 1;
        this.nextStrafeFlip = view.tick + Math.round(TICK_RATE * (0.4 + this.rng()));
      }
      right = clamp(right + this.strafeDir * 0.8, -1, 1);
    }

    let buttons = 0;
    if (wantFire) buttons |= BUTTON_FIRE;
    const held = view.inventory.find((w) => w.def.slot === view.held);
    // Reload when empty, or top up when nothing is threatening us.
    if (held && held.def.magazine > 0 && held.reserve > 0 && (held.mag === 0 || (!target && held.mag < held.def.magazine / 2))) buttons |= BUTTON_RELOAD;
    if (this.checkStuck(view, forward !== 0 || right !== 0) || this.jumpNext) {
      buttons |= BUTTON_JUMP;
      this.jumpNext = false;
    }
    return { seq, forward, right, yaw: this.yaw, pitch: this.pitch, buttons, weapon: this.chooseWeapon(view, target) };
  }

  /**
   * Best owned weapon with ammo for the current distance: data-driven via each
   * weapon's desirability and range band, nudged by personality (range
   * preference, explosives fans) and avoiding splash damage up close.
   */
  private chooseWeapon(view: BotWorldView, target: CombatantView | undefined): number {
    const dist = target ? distance(view.self.pos, target.pos) : 15;
    let best = view.held;
    let bestScore = -Infinity;
    for (const w of view.inventory) {
      const hasAmmo = w.def.magazine === 0 || w.mag + w.reserve > 0;
      if (!hasAmmo) continue;
      const [lo, hi] = w.def.botRange;
      let score = w.def.botDesirability + (dist >= lo && dist <= hi ? 0.6 : -Math.min(dist < lo ? lo - dist : dist - hi, 20) * 0.03);
      if (w.def.projectile && dist < w.def.projectile.splashRadius + 1) score -= 1.5 * (this.profile.selfPreservation / 100);
      if (this.profile.tags.includes('EXPLOSIVES_FAN') && w.def.projectile) score += 0.4;
      if (w.def.kind === 'melee') score += (this.profile.meleePreference / 100) * 0.5;
      // Avoid dithering between near-equal choices.
      if (w.def.slot === view.held) score += 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = w.def.slot;
      }
    }
    return best;
  }

  /**
   * The most worthwhile available pickup, if any is worth the detour. Value
   * depends on need (health/armor missing, weapon not owned, ammo low) and the
   * bot's item greed, discounted by distance.
   */
  private pickupGoal(view: BotWorldView, only?: 'health'): Vec3 | null {
    const me = view.self;
    let best: { pos: Vec3; score: number } | null = null;
    const owned = new Map(view.inventory.map((w) => [w.def.id, w]));
    for (const p of view.pickups) {
      if (!p.available) continue;
      const e = p.item.effect;
      if (only && e.kind !== only) continue;
      let need = 0;
      if (e.kind === 'health') need = (100 - me.health) / 60;
      else if (e.kind === 'armor') need = (100 - me.armor) / 100;
      else if (e.kind === 'powerup') need = 1;
      else if (e.kind === 'weapon') {
        const w = owned.get(e.weapon);
        need = !w ? 1 : w.reserve < w.def.reserveMax / 3 ? 0.4 : 0;
      } else if (e.kind === 'ammo') need = view.inventory.some((w) => w.def.magazine > 0 && w.reserve < w.def.reserveMax / 3) ? 0.6 : 0;
      if (need <= 0) continue;
      const greed = 0.3 + (this.profile.itemGreed / 100) * 1.2;
      const d = horizontalDistance(me.pos, p.pos) + Math.abs(me.pos.y - p.pos.y) * 2;
      const score = (p.item.botValue * need * greed) / (1 + d / 20);
      if (score > 0.12 && (!best || score > best.score)) best = { pos: p.pos, score };
    }
    return best ? { ...best.pos } : null;
  }

  private perceive(view: BotWorldView): void {
    const me = view.self;
    const myEye = eye(me.pos);
    const facing = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    let best: { slot: number; dist: number } | null = null;
    const seen = new Set<number>();
    for (const o of view.others) {
      if (!o.alive) continue;
      const d = Math.hypot(o.pos.x - me.pos.x, o.pos.y - me.pos.y, o.pos.z - me.pos.z);
      if (d > SIGHT_RANGE) continue;
      const dx = (o.pos.x - me.pos.x) / (d || 1);
      const dz = (o.pos.z - me.pos.z) / (d || 1);
      const inFov = dx * facing.x + dz * facing.z >= FOV_COS * Math.hypot(dx, dz);
      if (!inFov && d > HEARING_RANGE) continue;
      if (!view.physics.lineOfSight(myEye, eye(o.pos))) continue;
      seen.add(o.slot);
      if (!this.visibleSince.has(o.slot)) this.visibleSince.set(o.slot, view.tick);
      if (!best || d < best.dist) best = { slot: o.slot, dist: d };
    }
    for (const slot of [...this.visibleSince.keys()]) if (!seen.has(slot)) this.visibleSince.delete(slot);

    if (best) {
      this.targetSlot = best.slot;
      const t = view.others.find((o) => o.slot === best.slot)!;
      this.lastKnown = { pos: { ...t.pos }, tick: view.tick };
    } else {
      this.targetSlot = null;
    }
    // Aim error drifts between perception updates rather than jittering every tick.
    const err = this.difficulty.aimErrorRad * (1.5 - this.profile.accuracy / 100);
    this.aimErrYaw = (this.rng() * 2 - 1) * err;
    this.aimErrPitch = (this.rng() * 2 - 1) * err * 0.5;
  }

  private chooseState(view: BotWorldView, target: CombatantView | undefined): void {
    const me = view.self;
    const lowHealth = me.health < (this.profile.selfPreservation / 100) * PLAYER.maxHealth * 0.6;
    if (target && lowHealth) {
      this.state = 'retreat';
    } else if (target) {
      this.state = 'engage';
    } else if (this.lastKnown && !lowHealth) {
      const pursuitTicks = TICK_RATE * (1 + (this.profile.pursuitPersistence / 100) * 7);
      const fresh = view.tick - this.lastKnown.tick < pursuitTicks;
      const arrived = horizontalDistance(me.pos, this.lastKnown.pos) < 1.5;
      this.state = fresh && !arrived ? 'chase' : 'roam';
      if (this.state === 'roam') this.lastKnown = null;
    } else if (this.state === 'retreat' && this.lastKnown && view.tick - this.lastKnown.tick < TICK_RATE * 3) {
      // Keep running for a moment after losing sight of the threat.
    } else {
      this.state = 'roam';
    }
  }

  /** Turn toward the target with limited turn rate; returns true when the shot is lined up and reaction time has passed. */
  private aimAt(view: BotWorldView, target: CombatantView): boolean {
    const from = eye(view.self.pos);
    const want = lookAngles(from, chest(target.pos));
    // Lobbed projectiles: aim above the target to cancel the drop over the flight time.
    const lob = view.inventory.find((w) => w.def.slot === view.held)?.def.projectile;
    if (lob && lob.gravity > 0) {
      const d = distance(from, chest(target.pos));
      const t = d / lob.speed;
      want.pitch += Math.atan2(0.5 * lob.gravity * t * t, d);
    }
    this.turnToward(want.yaw + this.aimErrYaw, want.pitch + this.aimErrPitch);
    const since = this.visibleSince.get(target.slot);
    const reactionTicks = (this.difficulty.reactionMs / 1000) * TICK_RATE * (1.5 - this.profile.reactionSpeed / 100);
    const reacted = since !== undefined && view.tick - since >= reactionTicks;
    const onTarget = Math.abs(angleDelta(this.yaw, want.yaw)) < 0.12 && Math.abs(this.pitch - want.pitch) < 0.12;
    return reacted && onTarget;
  }

  private lookAlongPath(view: BotWorldView): void {
    const corner = this.path[this.pathIndex];
    if (!corner) return;
    const a = lookAngles(eye(view.self.pos), { x: corner.x, y: corner.y + PLAYER.eyeHeight, z: corner.z });
    this.turnToward(a.yaw, 0);
  }

  private turnToward(yaw: number, pitch: number): void {
    const maxStep = this.difficulty.turnRateRadPerSec * TICK_DT;
    this.yaw += clamp(angleDelta(this.yaw, yaw), -maxStep, maxStep);
    this.pitch += clamp(pitch - this.pitch, -maxStep, maxStep);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
  }

  /** Follow a navmesh path to `goal`; returns the world yaw to move along, or null when there is nowhere to go. */
  private followPathTo(view: BotWorldView, goal: Vec3, movingGoal: boolean): number | null {
    const me = view.self;
    const goalMoved = this.goal === null || horizontalDistance(this.goal, goal) > 2 || Math.abs(this.goal.y - goal.y) > 1.5;
    const stale = movingGoal && view.tick - this.lastPathTick > PATH_REFRESH_TICKS;
    // Ran out of corners without arriving (e.g. pushed off the path): replan, throttled.
    const exhausted = this.pathIndex >= this.path.length && horizontalDistance(me.pos, goal) > 1;
    if (goalMoved || ((stale || exhausted) && view.tick - this.lastPathTick >= 6)) {
      this.goal = { ...goal };
      this.path = view.nav.findPath(me.pos, goal) ?? [];
      if (this.pathBlocked(view)) this.path = [];
      this.pathIndex = this.path.length > 1 ? 1 : 0;
      this.lastPathTick = view.tick;
    }
    while (this.pathIndex < this.path.length) {
      const c = this.path[this.pathIndex]!;
      if (horizontalDistance(me.pos, c) < 0.35 && Math.abs(me.pos.y - c.y) < 1.6) this.pathIndex++;
      else break;
    }
    const corner = this.path[this.pathIndex];
    if (!corner) {
      if (this.path.length === 0 || horizontalDistance(me.pos, goal) < 0.5) return null;
      return Math.atan2(goal.x - me.pos.x, goal.z - me.pos.z);
    }
    return Math.atan2(corner.x - me.pos.x, corner.z - me.pos.z);
  }

  /** Does the planned path cross a closed door or breakable wall? */
  private pathBlocked(view: BotWorldView): boolean {
    if (!view.blockers?.length) return false;
    let prev = view.self.pos;
    for (const c of this.path) {
      const a = { x: prev.x, y: prev.y + 1, z: prev.z };
      const b = { x: c.x, y: c.y + 1, z: c.z };
      if (view.blockers.some((box) => segmentHitsAabb(a, b, box))) return true;
      prev = c;
    }
    return false;
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

  private pickRoamGoal(view: BotWorldView): Vec3 {
    const pts = view.spawnPoints;
    if (pts.length === 0) return { ...view.self.pos };
    // Explorers prefer far-away points; others pick uniformly.
    if (this.rng() * 100 < this.profile.exploration) {
      return { ...(farthest(pts, view.self.pos) ?? pts[0]!) };
    }
    return { ...pts[Math.floor(this.rng() * pts.length)]! };
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
    const progressed = horizontalDistance(pos, this.stuckCheck.pos) > 0.75 || Math.abs(pos.y - this.stuckCheck.pos.y) > 0.5;
    this.stuckCheck = { tick: view.tick, pos: { ...pos } };
    if (progressed) return false;
    this.stuckCount++;
    this.path = [];
    this.goal = null;
    this.lastPathTick = -Infinity;
    return true;
  }
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
