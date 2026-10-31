import type { Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';
import type { WeaponCategory, WeaponDefinition } from './weapons.ts';
import { hypot } from '../math.ts';

/**
 * Stopping power and blast throws (docs/GUNPLAY_SPEC.md, "Stopping power").
 *
 * A round that hits a living body shoves it a little along the shot and slows
 * it for a moment: a pistol barely, a shotgun or sniper noticeably. It is
 * arcade-light (docs/GUNPLAY_DIRECTION.md: responsiveness before realism), so
 * it never becomes a stun-lock: within one stagger window the shove and the
 * slow are capped, the window lasts at most IMPACT.maxStaggerSeconds however
 * many rounds land, and after it the body is immune for IMPACT.immunitySeconds.
 *
 * Server-authoritative: the shove is push velocity (MoveState.vx/vz, sent in
 * snapshots) and the slow is part of the status speed (private state `ms`),
 * so the local player's prediction replays it on reconciliation like any push.
 */
export const IMPACT = {
  /** Shove (m/s along the shot) at stopping power 1, for a full-damage hit. */
  shove: 3.6,
  /** Share of speed taken away at stopping power 1. */
  slow: 0.42,
  /** Stagger seconds at stopping power 0 and at 1. */
  minSeconds: 0.12,
  maxSeconds: 0.42,
  /** Caps per stagger window: total shove (m/s), deepest slow, longest window. */
  maxShove: 4.5,
  maxSlow: 0.5,
  maxStaggerSeconds: 0.6,
  /** After a window: no stopping power for this long. */
  immunitySeconds: 0.5,
} as const;

/** Stopping power (0..1) by weapon category, when a weapon sets none of its own. */
export const STOPPING_BY_CATEGORY: Record<WeaponCategory, number> = {
  pistol: 0.15,
  smg: 0.12,
  rifle: 0.3,
  shotgun: 0.8,
  sniper: 0.9,
  explosive: 0.4,
  melee: 0.55,
  special: 0.25,
};
/** Heavy revolvers and hand cannons hit like a rifle round. */
const REVOLVER_STOPPING = 0.45;
/** Mounted guns, tools and anything without a category. */
const DEFAULT_STOPPING = 0.3;

/** A weapon's stopping power, 0..1: its own, its family's (revolvers), or its category's. */
export function stoppingPower(def: Pick<WeaponDefinition, 'stoppingPower' | 'category' | 'family' | 'kind'>): number {
  if (def.stoppingPower !== undefined) return Math.max(0, Math.min(1, def.stoppingPower));
  if (def.family === 'revolver') return REVOLVER_STOPPING;
  return def.category ? STOPPING_BY_CATEGORY[def.category] : DEFAULT_STOPPING;
}

/** One stagger: shove (m/s), slow (share of speed) and how long it lasts (ticks), for a full hit at this stopping power. */
export function staggerOf(power: number): { shove: number; slow: number; ticks: number } {
  return { shove: IMPACT.shove * power, slow: IMPACT.slow * power, ticks: Math.round((IMPACT.minSeconds + (IMPACT.maxSeconds - IMPACT.minSeconds) * power) * TICK_RATE) };
}

/** A body's stagger state (on every combatant). Ticks count simulation ticks. */
export interface ImpactState {
  /** Ticks left of the current stagger window (0: none). */
  ticks: number;
  /** Ticks since the window opened. */
  elapsed: number;
  /** Speed taken away now (share). */
  slow: number;
  /** Shove already given in this window (m/s). */
  shove: number;
  /** Ticks of immunity left after a window. */
  immune: number;
}

export const newImpact = (): ImpactState => ({ ticks: 0, elapsed: 0, slow: 0, shove: 0, immune: 0 });

const MAX_STAGGER_TICKS = Math.round(IMPACT.maxStaggerSeconds * TICK_RATE);
const IMMUNE_TICKS = Math.round(IMPACT.immunitySeconds * TICK_RATE);

/**
 * A hit lands with stopping power `power` and `share` of a full shot's damage
 * (a shotgun pellet is 1/pellets; a softened round less). Updates the state
 * and returns the shove (m/s) to give the body now (0 while immune or capped).
 * Pellets of one blast add up to the weapon's own slow; repeated hits never
 * slow more than the hardest-hitting weapon in the window.
 */
export function hitImpact(s: ImpactState, power: number, share = 1): number {
  if (power <= 0 || share <= 0 || s.immune > 0) return 0;
  if (s.ticks === 0) {
    s.elapsed = 0;
    s.slow = 0;
    s.shove = 0;
  }
  const one = staggerOf(power);
  const k = Math.min(1, share);
  const shove = Math.max(0, Math.min(one.shove * k, IMPACT.maxShove - s.shove));
  s.shove += shove;
  const cap = Math.min(IMPACT.maxSlow, Math.max(s.slow, one.slow));
  s.slow = Math.min(cap, s.slow + one.slow * k);
  s.ticks = Math.max(s.ticks, Math.min(one.ticks, MAX_STAGGER_TICKS - s.elapsed));
  return shove;
}

/** One tick: the window runs down, then immunity. */
export function stepImpact(s: ImpactState): void {
  if (s.ticks > 0) {
    s.ticks--;
    s.elapsed++;
    if (s.ticks === 0) {
      s.slow = 0;
      s.shove = 0;
      s.elapsed = 0;
      s.immune = IMMUNE_TICKS;
    }
  } else if (s.immune > 0) s.immune--;
}

/** Movement multiplier from a stagger (1 when none). */
export const impactSpeed = (s: ImpactState): number => (s.ticks > 0 ? 1 - s.slow : 1);

/** Blast throws (Match.splash): how hard a blast pushes, when the explosive sets no `knockback` of its own. */
export function blastKnockback(spec: { knockback?: number; splashDamage: number }): number {
  if (spec.knockback !== undefined) return spec.knockback;
  // Flames, plasma pops and the like don't throw people; real explosions do.
  if (spec.splashDamage < 35) return 0;
  return Math.max(6, Math.min(13, 4 + spec.splashDamage * 0.06));
}

/** Blast throw shaping: horizontal share, lift (base and how much more from below), and your own blast (rocket jumps). */
export const BLAST = {
  /** Strength left at the edge of the radius (linear from 1 at the centre). */
  edge: 0.4,
  out: 0.85,
  lift: 0.9,
  liftFromBelow: 0.35,
  /** The least lift, for a blast above you. */
  minLift: 0.35,
  /** Your own blast: a little less sideways, a little less up (a rocket jump of about 2.4 m). */
  selfOut: 0.7,
  selfLift: 0.8,
} as const;

/**
 * The velocity a blast at distance `d` (of `radius`) gives a body, along
 * `dir` (unit, from the blast to the body's chest): up and out, so people near
 * it fly and land. `self`: the blast's own owner (rocket jumps).
 */
export function blastThrow(dir: Vec3, d: number, radius: number, knockback: number, self = false): Vec3 {
  if (knockback <= 0 || d > radius) return { x: 0, y: 0, z: 0 };
  const speed = knockback * (1 - (1 - BLAST.edge) * Math.max(0, d / radius));
  const h = hypot(dir.x, dir.z);
  const out = speed * (self ? BLAST.selfOut : BLAST.out);
  const lift = speed * Math.max(BLAST.minLift, BLAST.lift + BLAST.liftFromBelow * dir.y) * (self ? BLAST.selfLift : 1);
  return h > 0.05 ? { x: (dir.x / h) * out * Math.min(1, h * 1.5), y: lift, z: (dir.z / h) * out * Math.min(1, h * 1.5) } : { x: 0, y: lift, z: 0 };
}
