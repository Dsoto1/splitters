import { angleDelta, clamp, lookAngles, type Vec3 } from '../math.ts';
import { PLAYER, STANCES, TICK_DT, TICK_RATE, type Stance } from '../sim/constants.ts';
import type { WeaponDefinition } from '../sim/weapons.ts';
import type { BotDifficulty, BotProfile } from './profile.ts';

/**
 * Human-like aiming for Player Bots and NPCs. Nobody gets a perfect shot:
 *
 * - The crosshair wanders around where the bot means to aim (a smooth random
 *   walk, not per-shot jitter). On first sight the error is large and it
 *   settles over time while the bot keeps tracking the same target.
 * - How far it wanders depends on distance, the shooter's own movement and
 *   stance (holding still and crouching steady it), how fast the target
 *   moves across the view, and the profile's accuracy.
 * - Tracking lags: the bot aims where the target was a moment ago and leads
 *   it by only part of that, so strafing targets (and direction changes)
 *   are genuinely harder to hit.
 * - Trigger discipline: controlled bursts with automatics at range, tapping
 *   semi-autos, waiting for a settled aim before a slow single shot.
 * - Mostly centre mass; skilled bots now and then go for the head.
 *
 * Deterministic: all randomness comes from the bot's seeded RNG.
 */

/** What a bot can see of its own situation when shooting. */
export interface AimContext {
  tick: number;
  /** Shooter's eye. */
  eye: Vec3;
  /** Shooter's horizontal speed (m/s) and whether it is in the air. */
  speed: number;
  airborne: boolean;
  stance: Stance;
  /** Looking down a scope (or a mounted gun). */
  steady: boolean;
  weapon: WeaponDefinition | undefined;
}

/** A target as the bot perceives it. */
export interface AimTarget {
  slot: number;
  pos: Vec3;
  stance?: Stance;
}

export interface AimSolution {
  yaw: number;
  pitch: number;
  /** Distance to the aim point. */
  dist: number;
  /** Angular half-width of the target body at this distance (radians). */
  halfAngle: number;
}

/** History length (ticks) for the tracking-lag model. */
const HISTORY = 32;
/** Forget the target's track (and lose the settled aim) after this long without sight. */
const REACQUIRE_TICKS = Math.round(TICK_RATE * 0.8);

export class AimModel {
  /** Current aim error (radians). */
  errYaw = 0;
  errPitch = 0;
  private trackSlot: number | null = null;
  /** Tick the current target was acquired (aim starts unsettled). */
  acquiredTick = 0;
  private lastSeenTick = -Infinity;
  private readonly hist = new Float64Array(HISTORY * 3);
  private histCount = 0;
  private histHead = 0;
  private spareGauss: number | null = null;
  // Trigger state.
  private burstLeft = 0;
  private pauseUntil = 0;
  private nextTap = 0;
  private held = false;
  private head = false;
  private nextPointPick = 0;

  constructor(
    private readonly rng: () => number,
    private readonly difficulty: BotDifficulty,
    private readonly profile: BotProfile,
  ) {}

  /** Accuracy multiplier from the profile: 50 → 1, 80 → 0.64, 30 → 1.24. */
  private get accuracyScale(): number {
    return 1.6 - (clamp(this.profile.accuracy, 0, 100) / 100) * 1.2;
  }

  private gauss(): number {
    if (this.spareGauss !== null) {
      const g = this.spareGauss;
      this.spareGauss = null;
      return g;
    }
    const u = Math.max(1e-9, this.rng());
    const v = this.rng();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spareGauss = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  /** Reset on respawn. */
  reset(): void {
    this.trackSlot = null;
    this.histCount = 0;
    this.errYaw = this.errPitch = 0;
    this.burstLeft = 0;
    this.held = false;
  }

  /** Ticks since the current target was acquired. */
  trackedTicks(tick: number): number {
    return this.trackSlot === null ? 0 : tick - this.acquiredTick;
  }

  /**
   * Every tick while the bot sees `target` (or null): record where the target
   * is (for the lag model) and evolve the aim error.
   */
  track(ctx: AimContext, target: AimTarget | null): void {
    if (!target) {
      if (this.trackSlot !== null && ctx.tick - this.lastSeenTick > REACQUIRE_TICKS) this.trackSlot = null;
      return;
    }
    const skill = this.difficulty.aim;
    if (this.trackSlot !== target.slot || ctx.tick - this.lastSeenTick > REACQUIRE_TICKS) {
      // New target (or found again after a while): start unsettled.
      this.trackSlot = target.slot;
      this.acquiredTick = ctx.tick;
      this.histCount = 0;
      const e = skill.acquireRad * this.accuracyScale * (0.7 + 0.6 * this.rng());
      const a = this.rng() * Math.PI * 2;
      this.errYaw = Math.cos(a) * e;
      this.errPitch = Math.sin(a) * e * 0.5;
      this.burstLeft = 0;
      this.pauseUntil = ctx.tick + Math.round(TICK_RATE * 0.05);
      this.head = false;
      this.nextPointPick = 0;
    }
    this.lastSeenTick = ctx.tick;
    // Record the target's position.
    const i = this.histHead * 3;
    this.hist[i] = target.pos.x;
    this.hist[i + 1] = target.pos.y;
    this.hist[i + 2] = target.pos.z;
    this.histHead = (this.histHead + 1) % HISTORY;
    this.histCount = Math.min(HISTORY, this.histCount + 1);

    // Error wanders around zero with a spread set by the situation (Ornstein-Uhlenbeck).
    const sigma = this.sigma(ctx, target);
    const k = Math.exp(-TICK_DT / Math.max(0.05, skill.settleSeconds));
    const n = Math.sqrt(1 - k * k) * sigma;
    this.errYaw = this.errYaw * k + n * this.gauss();
    this.errPitch = this.errPitch * k + n * 0.55 * this.gauss();
  }

  /** Target position `ago` ticks back (clamped to the history we have). */
  private past(ago: number): Vec3 | null {
    if (this.histCount === 0) return null;
    const back = Math.min(ago, this.histCount - 1);
    const i = ((this.histHead - 1 - back + HISTORY * 2) % HISTORY) * 3;
    return { x: this.hist[i]!, y: this.hist[i + 1]!, z: this.hist[i + 2]! };
  }

  /** The target's velocity as the bot has seen it (m/s), `ago` ticks back. */
  private velocity(ago: number): Vec3 {
    const span = 6;
    const a = this.past(ago);
    const b = this.past(ago + span);
    if (!a || !b || this.histCount < 3) return { x: 0, y: 0, z: 0 };
    const ticks = Math.max(1, Math.min(span, this.histCount - 1 - Math.min(ago, this.histCount - 1)));
    return { x: (a.x - b.x) / (ticks * TICK_DT), y: 0, z: (a.z - b.z) / (ticks * TICK_DT) };
  }

  /** Current error spread (1σ, radians). */
  private sigma(ctx: AimContext, target: AimTarget): number {
    const skill = this.difficulty.aim;
    const dx = target.pos.x - ctx.eye.x;
    const dz = target.pos.z - ctx.eye.z;
    const dist = Math.max(1, Math.hypot(dx, dz));
    // Angular speed of the target across the view.
    const v = this.velocity(0);
    const lateral = Math.abs(v.x * dz - v.z * dx) / dist;
    const omega = lateral / dist;
    const distF = 0.85 + dist / 80;
    const moveF = 1 + 0.9 * Math.min(1.5, ctx.speed / PLAYER.runSpeed) + (ctx.airborne ? 0.8 : 0);
    const stanceF = ctx.stance === 2 ? 0.62 : ctx.stance === 1 ? 0.8 : 1;
    const targetF = 1 + Math.min(2, omega * 1.6);
    const steadyF = ctx.steady ? 0.75 : 1;
    return skill.settledRad * this.accuracyScale * distF * moveF * stanceF * targetF * steadyF;
  }

  /**
   * Where to point: the target as seen a moment ago, led by part of that lag
   * (and by the flight time for projectiles), at chest or head height, plus
   * the current error.
   */
  solve(ctx: AimContext, target: AimTarget): AimSolution {
    const skill = this.difficulty.aim;
    const lagTicks = Math.round(skill.lagSeconds * TICK_RATE);
    const seen = this.past(lagTicks) ?? target.pos;
    const v = this.velocity(lagTicks);
    const height = STANCES[target.stance ?? 0].height;
    // Pick chest or head now and then (per burst), not every tick.
    if (ctx.tick >= this.nextPointPick) {
      const dist0 = Math.hypot(target.pos.x - ctx.eye.x, target.pos.z - ctx.eye.z);
      const settled = this.trackedTicks(ctx.tick) > skill.settleSeconds * TICK_RATE;
      this.head = settled && dist0 < 40 && this.rng() < skill.headChance * (this.profile.accuracy / 50);
      this.nextPointPick = ctx.tick + Math.round(TICK_RATE * (0.6 + this.rng() * 0.8));
    }
    const up = this.head ? height - 0.15 : height * 0.6;
    let lead = skill.lagSeconds * skill.prediction;
    const proj = ctx.weapon?.projectile;
    const dist = Math.hypot(seen.x - ctx.eye.x, seen.y + up - ctx.eye.y, seen.z - ctx.eye.z);
    // Projectiles: lead a moving target a little (never the full flight time).
    if (proj && proj.speed > 0) lead += (dist / proj.speed) * (0.35 + 0.5 * skill.prediction);
    const point = { x: seen.x + v.x * lead, y: seen.y + up, z: seen.z + v.z * lead };
    const want = lookAngles(ctx.eye, point);
    if (proj && proj.gravity > 0) {
      const t = dist / proj.speed;
      want.pitch += Math.atan2(0.5 * proj.gravity * t * t, dist);
    }
    return { yaw: want.yaw + this.errYaw, pitch: want.pitch + this.errPitch, dist, halfAngle: Math.atan2(PLAYER.radius, Math.max(1, dist)) };
  }

  /**
   * Trigger discipline. Given whether the shot is lined up (the bot's own
   * view; it can't see its error), decide whether to hold fire this tick.
   */
  trigger(ctx: AimContext, sol: AimSolution, yaw: number, pitch: number, reacted: boolean): boolean {
    const def = ctx.weapon;
    const skill = this.difficulty.aim;
    const tol = sol.halfAngle + 0.012;
    const lined = Math.abs(angleDelta(yaw, sol.yaw)) < tol && Math.abs(pitch - sol.pitch) < tol * 1.6;
    let pull = false;
    if (def && reacted && lined && (def.kind !== 'melee' || sol.dist < def.range + 0.6)) {
      const mode = def.fireMode ?? 'auto';
      if (def.windupTicks) pull = true; // spin-up and charge weapons: keep the trigger down
      else if (def.kind === 'melee') pull = true;
      else if (mode === 'auto' && def.fireIntervalTicks <= 12 && !def.projectile?.splashRadius) pull = this.autoBurst(ctx, sol, def);
      else {
        // Taps: semi-autos, burst rifles and slow single shots.
        const slow = def.fireIntervalTicks >= 30 || def.damage >= 50;
        const settledEnough = !slow || Math.hypot(this.errYaw, this.errPitch) < sol.halfAngle * 1.3 || this.trackedTicks(ctx.tick) > skill.settleSeconds * TICK_RATE * 2.5;
        if (!this.held && ctx.tick >= this.nextTap && settledEnough) {
          pull = true;
          const gap = Math.max(def.fireIntervalTicks + 1, Math.round(skill.tapSeconds * TICK_RATE * (0.8 + this.rng() * 0.5)));
          this.nextTap = ctx.tick + gap;
        }
      }
    }
    this.held = pull;
    return pull;
  }

  /** Automatic fire: spray up close, short controlled bursts further out. */
  private autoBurst(ctx: AimContext, sol: AimSolution, def: WeaponDefinition): boolean {
    if (sol.dist < 9) return true;
    if (ctx.tick < this.pauseUntil) return false;
    if (this.burstLeft <= 0) {
      const [lo, hi] = this.difficulty.aim.burst;
      // Wider guns and longer range: shorter bursts.
      const spreadRatio = (def.spread + (def.recoil?.maxBloom ?? 0) * 0.5) / Math.max(0.005, sol.halfAngle);
      const shrink = sol.dist > 30 || spreadRatio > 1.5 ? 1 : 0;
      const shots = Math.max(2, Math.round(lo + this.rng() * (hi - lo)) - shrink);
      this.burstLeft = shots * def.fireIntervalTicks;
    }
    this.burstLeft--;
    if (this.burstLeft <= 0) {
      // Let the spread recover before the next burst.
      this.pauseUntil = ctx.tick + Math.round(TICK_RATE * (0.18 + 0.004 * sol.dist + this.rng() * 0.18));
    }
    return true;
  }
}
