import { angleDelta, clamp, createRng, horizontalDistance, lookAngles, type Vec3 } from '../math.ts';
import type { NavWorld } from '../nav/index.ts';
import { PLAYER, TICK_DT, TICK_RATE } from '../sim/constants.ts';
import { BUTTON_FIRE, BUTTON_JUMP, type PlayerInput } from '../sim/movement.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import type { BotDifficulty, BotProfile } from './profile.ts';

export interface CombatantView {
  slot: number;
  pos: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  alive: boolean;
}

/** Everything a bot may read. Bots get no more information than this. */
export interface BotWorldView {
  tick: number;
  self: CombatantView;
  others: readonly CombatantView[];
  physics: PhysicsWorld;
  nav: NavWorld;
  spawnPoints: readonly Vec3[];
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
        const refuge = farthest(view.spawnPoints, threat) ?? me.pos;
        moveYaw = this.followPathTo(view, refuge, false);
        if (target) wantFire = this.aimAt(view, target);
        else this.lookAlongPath(view);
        break;
      }
      case 'roam':
        if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 1.5) {
          this.roamGoal = this.pickRoamGoal(view);
        }
        moveYaw = this.followPathTo(view, this.roamGoal, false);
        // Arrived or unreachable: pick another goal next tick.
        if (moveYaw === null) this.roamGoal = null;
        this.lookAlongPath(view);
        break;
      case 'dead':
        break;
    }

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
    if (this.checkStuck(view, forward !== 0 || right !== 0) || this.jumpNext) {
      buttons |= BUTTON_JUMP;
      this.jumpNext = false;
    }
    return { seq, forward, right, yaw: this.yaw, pitch: this.pitch, buttons };
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
    const want = lookAngles(eye(view.self.pos), chest(target.pos));
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
