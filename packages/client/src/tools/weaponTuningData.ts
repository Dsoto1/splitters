import {
  BULLET_SUBSTEPS,
  NEAR_INSTANT_M,
  TICK_DT,
  TICK_RATE,
  bulletPhysics,
  firingOf,
  gunplayOf,
  holdoverMarks,
  impactFalloff,
  kickOf,
  newGunState,
  recoilIdle,
  recoilShot,
  shotCone,
  spreadOf,
  type Ballistics,
  type WeaponDefinition,
} from '@tiletrigger/shared';

/**
 * The numbers behind the weapon tuning screen (`?mode=weapons`, tools/weaponTuning.ts; docs/GUNPLAY_SPEC.md §45):
 * everything comes from the sim's own pure functions (`kickOf` / `recoilShot` / `recoilIdle`, `spreadOf`,
 * `impactFalloff`, `flightTo`, `gunplayOf().handling`), so what the screen shows is what a match does.
 */

export interface RecoilPoint {
  /** Aim offset after this round (radians: yaw right, pitch up), with the recovery between rounds as the sim runs it. */
  yaw: number;
  pitch: number;
}

/** The aim's path over a held trigger (or the fastest pulls a semi-automatic allows) for up to `rounds` rounds. */
export function recoilPath(def: WeaponDefinition, mode = 0, rounds = 30): RecoilPoint[] {
  const firing = firingOf(def, mode);
  const gp = gunplayOf(def);
  const n = Math.max(1, Math.min(rounds, def.magazine > 0 ? def.magazine : rounds));
  const g = newGunState();
  const out: RecoilPoint[] = [];
  // A burst: its rounds on the burst's timer, then the trigger's interval to the next burst.
  const burst = firing.burst;
  let fired = 0;
  let wait = 0;
  let inBurst = 0;
  for (let tick = 0; fired < n && tick < 100_000; tick++) {
    if (wait <= 0) {
      recoilShot(g, firing.kick);
      fired++;
      out.push({ yaw: g.ry, pitch: g.rp });
      if (burst) {
        inBurst++;
        if (inBurst < burst.count) wait = burst.intervalTicks;
        else {
          inBurst = 0;
          wait = Math.max(1, firing.interval - burst.intervalTicks * (burst.count - 1));
        }
      } else wait = Math.max(1, firing.interval);
    } else recoilIdle(g, firing.kick, gp.accuracy, firing.interval);
    wait--;
  }
  return out;
}

export interface Cones {
  /** Cone half-angles (radians) by what the shooter is doing; null where the weapon has no spread model. */
  hip: number;
  ads: number;
  moving: number;
  air: number;
  /** Hip fire after a long spray (the magazine, or 30 rounds). */
  sprayed: number;
  /** The pellet pattern on top (multi-pellet weapons), radians. */
  pattern: number;
}

/** The spread cones of the primary trigger (spec §14-15, §27). */
export function spreadCones(def: WeaponDefinition): Cones | null {
  const a = gunplayOf(def).accuracy;
  if (!a) return null;
  const still = { run: 0, airborne: false, stance: 1 };
  const g = newGunState();
  const cone = (gs: typeof g, ctx: typeof still) => spreadOf(a, gs, ctx);
  return {
    hip: cone(g, still),
    ads: cone({ ...g, ads: 1 }, still),
    moving: cone(g, { ...still, run: 1 }),
    air: cone(g, { ...still, airborne: true }),
    sprayed: cone({ ...g, spray: def.magazine > 0 ? Math.min(def.magazine, 30) : 30 }, still),
    pattern: shotCone(def, a, g, still) - cone(g, still),
  };
}

/** Damage of one trigger pull (every pellet on the body) at `dist` metres under a ballistics rule. */
export function damageAt(def: WeaponDefinition, dist: number, ballistics: Ballistics = 'standard'): number {
  if (dist > def.range) return 0;
  const gp = gunplayOf(def);
  const rules = { ballistics };
  let ratio = 1;
  if (gp.ballistic) {
    const p = bulletPhysics(gp.ballistic, rules);
    // As the sim slows a round (semi-implicit Euler, BULLET_SUBSTEPS a tick, the first metres a ray): gunplay.ts speedRatioAt.
    const q = Math.max(0, 1 - (p.drag * TICK_DT) / BULLET_SUBSTEPS);
    ratio = p.drag > 0 && dist > NEAR_INSTANT_M ? Math.max(0, 1 - (p.drag * (dist - NEAR_INSTANT_M)) / (p.speed * q)) : 1;
  }
  return def.damage * Math.max(1, def.pellets) * impactFalloff(gp, rules, dist, ratio);
}

/** Seconds to put `hp` down with body hits at `dist` (every round landing), or null when it can't. */
export function ttkAt(def: WeaponDefinition, dist: number, hp = 100, ballistics: Ballistics = 'standard', mode = 0): number | null {
  const per = damageAt(def, dist, ballistics);
  if (per <= 0) return null;
  const shots = Math.ceil(hp / per - 1e-9);
  const f = firingOf(def, mode);
  if (f.burst && f.burst.count > 1) {
    // Bursts: rounds inside a burst on its timer, then the wait to the next.
    const gap = Math.max(1, f.interval - f.burst.intervalTicks * (f.burst.count - 1));
    let ticks = 0;
    for (let i = 1; i < shots; i++) ticks += i % f.burst.count === 0 ? gap : f.burst.intervalTicks;
    return ticks / TICK_RATE;
  }
  return ((shots - 1) * Math.max(1, f.interval)) / TICK_RATE;
}

export interface WeaponStats {
  damage: number;
  /** Trigger pulls a minute (bursts count each round). */
  rpm: number;
  /** Climb over the first ten rounds (radians). */
  recoil: number;
  capacity: number;
  /** Muzzle velocity (m/s; hitscan: null). */
  velocity: number | null;
  /** Hip spread standing, a pellet pattern included (radians). */
  spread: number;
  /** Movement speed (share of running speed). */
  move: number;
  /** Seconds from leaving a sprint to the first round. */
  sprintExit: number;
  /** Seconds to bring the sights up, and to draw the weapon. */
  ads: number;
  equip: number;
  /** Seconds of a reload from empty. */
  reload: number;
}

/** The side-by-side bars (spec §45's comparison). */
export function weaponStats(def: WeaponDefinition, mode = 0): WeaponStats {
  const gp = gunplayOf(def);
  const f = firingOf(def, mode);
  const cones = spreadCones(def);
  const path = recoilPath(def, mode, 10);
  const perMin = f.burst && f.burst.count > 1 ? (f.burst.count * 60 * TICK_RATE) / Math.max(1, f.interval) : (60 * TICK_RATE) / Math.max(1, f.interval);
  const reload = gp.reload.type === 'magazine' ? gp.reload.empty : gp.reload.start + gp.reload.each * Math.max(1, def.magazine) + gp.reload.end;
  return {
    damage: def.damage * Math.max(1, def.pellets),
    rpm: perMin,
    recoil: path.length ? Math.hypot(path[path.length - 1]!.pitch, path[path.length - 1]!.yaw) : 0,
    capacity: def.magazine,
    velocity: gp.ballistic?.velocity ?? def.projectile?.speed ?? null,
    spread: cones ? cones.hip + cones.pattern : def.spread,
    move: gp.handling.move,
    sprintExit: gp.handling.sprintExit / TICK_RATE,
    ads: (gp.accuracy?.adsTicks ?? 0) / TICK_RATE,
    equip: def.raiseTicks / TICK_RATE,
    reload: reload / TICK_RATE,
  };
}

/** Drop below the aim (m) at `dist`, with the holdover marks a scope would carry (spec §5). */
export function dropAt(def: WeaponDefinition, ballistics: Ballistics = 'standard'): { dist: number; angle: number }[] {
  const b = gunplayOf(def).ballistic;
  return b ? holdoverMarks(b, { ballistics }, [50, 100, 150, 200, 250, 300, 400, 500].filter((d) => d <= def.range)) : [];
}
