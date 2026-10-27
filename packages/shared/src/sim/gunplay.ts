/**
 * Gunplay foundation (docs/GUNPLAY_SPEC.md, phases G0 and G1): ballistic
 * bullets, split mechanical recoil with predictable recovery, the spread
 * model, staged and per-shell reloads, damage falloff, ballistic materials
 * and the creator's lethality / ballistics rules.
 *
 * Everything here is pure data and arithmetic so the server (Match), the
 * client's prediction (LocalPlayer) and tests run the same code. Behaviour is
 * driven by WeaponDefinition data (spec §35): a weapon's `family` supplies
 * defaults and the weapon's own `ballistic` / `accuracy` / `kick` / `reload`
 * / `falloff` fields override them. No function here names a weapon.
 */
import { TICK_DT } from './constants.ts';
import { CORE_MATERIALS } from '../map/materials.ts';
import type { MapEntity } from '../map/schema.ts';
import type { MatchRules } from './rules.ts';
import type { WeaponDefinition } from './weapons.ts';

// ---------------------------------------------------------------- families

/** Weapon families (spec §34): they carry the defaults below. */
export const WEAPON_FAMILIES = ['pistol', 'revolver', 'machine_pistol', 'smg', 'rifle', 'battle_rifle', 'marksman', 'precision', 'lmg', 'shotgun'] as const;
export type WeaponFamily = (typeof WEAPON_FAMILIES)[number];

/** Gravity bullets fall with (m/s²) before a weapon's own `gravityScale` and the ballistics rule. */
export const BULLET_GRAVITY = 9.81;
/**
 * Near range (spec §4): the first this-many metres of a conventional bullet's
 * flight are resolved as a ray in the tick it was fired, so close-range
 * shooting is instant, with no visible delay.
 */
export const NEAR_INSTANT_M = 8;
/** Integration sub-steps per server tick for bullets in flight. */
export const BULLET_SUBSTEPS = 2;
/** Longest a bullet stays in the air (s), whatever its range. */
export const BULLET_LIFETIME = 3;

/**
 * Projectile physics for a conventional bullet (spec §3.2). Present on a
 * weapon = it fires ballistic bullets instead of hitscan rays.
 */
export interface BallisticSpec {
  /** Muzzle velocity (m/s), see the family table in spec §4. */
  velocity: number;
  /** Multiple of BULLET_GRAVITY. */
  gravityScale: number;
  /** Share of speed lost per second (0 = none). */
  drag?: number;
  /** Penetration energy (arbitrary units, see BALLISTIC_MATERIALS resistances). */
  energy: number;
  /** Draw a tracer every Nth round (1 every shot, 0 never), plus the magazine's last `tracerFinal` rounds. */
  tracerEvery: number;
  tracerFinal?: number;
}

/** Spread model (spec §14). Angles are cone half-angles in radians. */
export interface AccuracySpec {
  /** Settled, standing, hip spread. 0 = the first shot goes exactly where the reticle is. */
  base: number;
  /** Added at full running speed. */
  move: number;
  /** Added while airborne. */
  air: number;
  /** Sustained-fire growth per round after the first `tight` rounds of a spray. */
  perShot: number;
  tight: number;
  /** Ceiling of the whole cone (before stance and ADS). */
  max: number;
  /** Spray rounds forgotten per second once the trigger is released. */
  recovery: number;
  /** Cone multiple when fully aimed down the sights (hip-fire specialists stay near 1). */
  ads: number;
  /** Ticks to come fully up to the sights (accuracy blends in; firing is never blocked). */
  adsTicks: number;
}

/**
 * Mechanical recoil (spec §12, §29): moves the real aim. Deterministic per
 * shot index of the current spray, with a bounded, deterministic horizontal
 * wobble on top. Visual recoil (`visual`) is camera and viewmodel kick only.
 */
export interface KickSpec {
  /** Upward kick per round (radians) by round index; the last value repeats. */
  pitch: readonly number[];
  /** Sideways kick per round (radians, + = right) by round index; the pattern repeats. */
  yaw: readonly number[];
  /** Bounded deterministic sideways wobble added per round (radians). */
  variance: number;
  /** Ticks after the last round before aim starts to settle back. */
  delay: number;
  /** Recovery: share of the remaining offset recovered per second (exponential)... */
  settle: number;
  /** ...plus a constant rad/s, so it always arrives. */
  rate: number;
  /** Camera / viewmodel kick strength (presentation only, 0..1.5). */
  visual: number;
}

/** Reloads (spec §16-18): staged magazines or round-by-round. Durations in ticks. */
export type ReloadSpec =
  | {
      type: 'magazine';
      /** Rounds left in the gun: the magazine comes out, a new one goes in. */
      tactical: number;
      /** Empty: also chamber a round at the end. */
      empty: number;
      /** When the old magazine is out and the new one in, as shares of the duration. */
      out: number;
      in: number;
    }
  | {
      type: 'shell';
      /** Open up / lift the gun, then each round, then close (cosmetic, interruptible). */
      start: number;
      each: number;
      end: number;
    };

/** Damage over distance (spec §37): full to `start`, down to `min` at `end`. */
export interface FalloffSpec {
  start: number;
  end: number;
  min: number;
  curve: 'linear' | 'smooth' | 'steep';
}

interface FamilyDefaults {
  ballistic: BallisticSpec | null;
  accuracy: AccuracySpec;
  kick: KickSpec;
  falloff: FalloffSpec;
  head: number;
  legs: number;
}

const acc = (base: number, move: number, air: number, perShot: number, tight: number, max: number, recovery: number, ads: number, adsTicks = 12): AccuracySpec => ({ base, move, air, perShot, tight, max, recovery, ads, adsTicks });
const kick = (pitch: number[], yaw: number[], variance: number, delay: number, settle: number, rate: number, visual: number): KickSpec => ({ pitch, yaw, variance, delay, settle, rate, visual });

/** Family baselines (spec §4 velocities, §11 body multipliers, §37 falloff). */
export const FAMILY_DEFAULTS: Readonly<Record<WeaponFamily, FamilyDefaults>> = {
  pistol: {
    ballistic: { velocity: 375, gravityScale: 1, energy: 450, tracerEvery: 0, tracerFinal: 0 },
    accuracy: acc(0.002, 0.006, 0.02, 0.003, 1, 0.03, 10, 0.6, 8),
    kick: kick([0.012], [0.002, -0.002], 0.003, 4, 12, 0.35, 0.5),
    falloff: { start: 18, end: 45, min: 0.65, curve: 'linear' },
    head: 2,
    legs: 0.8,
  },
  revolver: {
    ballistic: { velocity: 300, gravityScale: 1, energy: 1800, tracerEvery: 1 },
    // A true first shot, but a round fired before the last one's spray has settled (about half a second) is a guess.
    accuracy: acc(0.0005, 0.012, 0.06, 0.022, 0, 0.06, 3, 0.5, 10),
    kick: kick([0.12], [0.012, -0.008], 0.008, 10, 3.5, 0.06, 1.5),
    falloff: { start: 25, end: 60, min: 0.7, curve: 'smooth' },
    head: 1.75,
    legs: 0.85,
  },
  machine_pistol: {
    ballistic: { velocity: 360, gravityScale: 1, energy: 350, tracerEvery: 4 },
    accuracy: acc(0.012, 0.006, 0.03, 0.006, 2, 0.08, 16, 0.85, 8),
    kick: kick([0.006], [0.003, 0.004, -0.002, -0.004], 0.004, 3, 14, 0.3, 0.4),
    falloff: { start: 8, end: 25, min: 0.5, curve: 'steep' },
    head: 1.5,
    legs: 0.85,
  },
  smg: {
    ballistic: { velocity: 400, gravityScale: 1, energy: 400, tracerEvery: 3, tracerFinal: 5 },
    // Dead steady for five rounds, then it climbs and blooms hard; let go and it is steady again almost at once.
    accuracy: acc(0.006, 0.004, 0.03, 0.0065, 5, 0.09, 40, 0.8, 10),
    kick: kick([0.003, 0.003, 0.003, 0.003, 0.003, 0.006, 0.008, 0.01, 0.011], [0, 0.001, 0.002, 0.003, 0.004, 0.002, -0.002, -0.004, -0.004, -0.002], 0.004, 3, 14, 0.3, 0.45),
    falloff: { start: 12, end: 35, min: 0.55, curve: 'steep' },
    head: 1.5,
    legs: 0.85,
  },
  rifle: {
    ballistic: { velocity: 820, gravityScale: 1, energy: 1200, tracerEvery: 3, tracerFinal: 3 },
    accuracy: acc(0.0015, 0.008, 0.035, 0.0012, 3, 0.025, 8, 0.4, 14),
    kick: kick([0.01, 0.0085], [0, 0.001, 0.002, 0.002, 0.001, 0, -0.001, -0.002, -0.002, -0.001], 0.002, 5, 7, 0.12, 0.6),
    falloff: { start: 30, end: 80, min: 0.75, curve: 'smooth' },
    head: 2,
    legs: 0.8,
  },
  battle_rifle: {
    ballistic: { velocity: 880, gravityScale: 1, energy: 1800, tracerEvery: 2 },
    accuracy: acc(0.001, 0.02, 0.06, 0.004, 1, 0.03, 6, 0.3, 16),
    kick: kick([0.03], [0.004, -0.003], 0.004, 6, 6, 0.1, 0.8),
    falloff: { start: 40, end: 100, min: 0.8, curve: 'smooth' },
    head: 2,
    legs: 0.85,
  },
  marksman: {
    ballistic: { velocity: 900, gravityScale: 1, energy: 2000, tracerEvery: 1 },
    accuracy: acc(0.001, 0.025, 0.07, 0.005, 0, 0.035, 5, 0.3, 16),
    kick: kick([0.035], [0.003, -0.003], 0.004, 6, 6, 0.1, 0.8),
    falloff: { start: 60, end: 150, min: 0.85, curve: 'smooth' },
    head: 2,
    legs: 0.85,
  },
  precision: {
    // Fast (least lead of all) but heavy: 12 cm of drop at 100 m, half a metre at 200 m. A shot taken the moment
    // the bolt closes is a little off; wait a beat and it is dead on (patience).
    ballistic: { velocity: 950, gravityScale: 2.5, energy: 3000, tracerEvery: 1 },
    accuracy: acc(0, 0.03, 0.1, 0.015, 0, 0.05, 1.2, 0.2, 18),
    kick: kick([0.07], [0.006, -0.004], 0.005, 8, 5, 0.08, 1.1),
    falloff: { start: 150, end: 300, min: 0.9, curve: 'linear' },
    head: 3,
    legs: 0.9,
  },
  lmg: {
    ballistic: { velocity: 760, gravityScale: 1, energy: 1500, tracerEvery: 4 },
    accuracy: acc(0.012, 0.03, 0.07, 0.0012, 6, 0.045, 5, 0.7, 20),
    kick: kick([0.005], [0.002, -0.001, 0.001, -0.002], 0.003, 4, 6, 0.12, 0.45),
    falloff: { start: 30, end: 80, min: 0.7, curve: 'smooth' },
    head: 1.5,
    legs: 0.85,
  },
  shotgun: {
    // Pellets stay hitscan (spec §3.1 allows it for performance): damage loss comes from spread and per-pellet falloff.
    ballistic: null,
    // The pellet pattern is the weapon's own `spread` (pelletCone); this is aim error on top of it.
    accuracy: acc(0, 0.006, 0.02, 0, 0, 0.04, 6, 0.9, 10),
    kick: kick([0.06], [0.006, -0.006], 0.004, 8, 5, 0.1, 1),
    falloff: { start: 6, end: 22, min: 0.25, curve: 'steep' },
    head: 1.25,
    legs: 0.85,
  },
};

/** Everything gunplay needs to know about one weapon, defaults filled in. */
export interface Gunplay {
  family: WeaponFamily | null;
  ballistic: BallisticSpec | null;
  accuracy: AccuracySpec | null;
  kick: KickSpec | null;
  reload: ReloadSpec;
  falloff: FalloffSpec | null;
  head: number;
  legs: number;
}

/** Head / leg multipliers for weapons without a family (unchanged from before the gunplay pass; weapons.ts exports them). */
const DEFAULT_HEAD = 2;
const DEFAULT_LEGS = 0.75;

const cache = new WeakMap<WeaponDefinition, Gunplay>();

/** A weapon's gunplay data: its own fields over its family's defaults (cached). */
export function gunplayOf(def: WeaponDefinition): Gunplay {
  let g = cache.get(def);
  if (g) return g;
  const fam = def.family ? FAMILY_DEFAULTS[def.family] : null;
  const ballistic = def.ballistic === null ? null : def.ballistic ? { ...(fam?.ballistic ?? {}), ...def.ballistic } as BallisticSpec : (fam?.ballistic ?? null);
  g = {
    family: def.family ?? null,
    // Hitscan weapons with a bullet family fly; projectiles, beams and melee never do.
    ballistic: def.kind === 'hitscan' && !def.view.beam ? ballistic : null,
    accuracy: def.accuracy ? { ...(fam?.accuracy ?? acc(def.spread, 0.014, 0.035, 0, 0, 0.1, 6, 0.55)), ...def.accuracy } : (fam?.accuracy ?? null),
    // Weapons without a family keep their old camera kick, now as a deterministic climb.
    kick: def.kick ? { ...(fam?.kick ?? kick([0], [0], 0, 4, 8, 0.1, 0.5)), ...def.kick } : (fam?.kick ?? (def.recoil?.kick ? kick([def.recoil.kick], [0.25 * def.recoil.kick, -0.25 * def.recoil.kick], 0.2 * def.recoil.kick, 4, 8, 0.1, Math.min(1.2, def.recoil.kick * 15)) : null)),
    reload: def.reload ?? { type: 'magazine', tactical: def.reloadTicks, empty: def.reloadTicks, out: 0.35, in: 1 },
    falloff: def.falloff ?? fam?.falloff ?? null,
    head: def.headshot ?? fam?.head ?? DEFAULT_HEAD,
    legs: def.legshot ?? fam?.legs ?? DEFAULT_LEGS,
  };
  cache.set(def, g);
  return g;
}

// ---------------------------------------------------------------- creator rules (spec §10, §5, §43)

export const LETHALITY_LEVELS = ['arcade', 'standard', 'tactical'] as const;
export type Lethality = (typeof LETHALITY_LEVELS)[number];
/**
 * Effective health per lethality level; applied as one systemic damage
 * multiple (1 / health) so every weapon keeps its identity (spec §10).
 */
export const LETHALITY_HEALTH: Readonly<Record<Lethality, number>> = { arcade: 1.4, standard: 1, tactical: 0.72 };

export const BALLISTICS_LEVELS = ['arcade', 'standard', 'advanced'] as const;
export type Ballistics = (typeof BALLISTICS_LEVELS)[number];
/** Projectile physics emphasis (spec §5): muzzle velocity, gravity and drag multiples. */
export const BALLISTICS_SCALE: Readonly<Record<Ballistics, { velocity: number; gravity: number; drag: number }>> = {
  arcade: { velocity: 1.6, gravity: 0.25, drag: 0.5 },
  standard: { velocity: 1, gravity: 1, drag: 1 },
  advanced: { velocity: 0.8, gravity: 1.75, drag: 1.5 },
};

/** Damage multiple a match's lethality rule applies to everything. */
export function lethalityScale(rules: Pick<MatchRules, 'lethality'>): number {
  return 1 / (LETHALITY_HEALTH[rules.lethality ?? 'standard'] ?? 1);
}

/** Launch speed, gravity (m/s², positive down) and drag of a weapon's bullets under a match's ballistics rule. */
export function bulletPhysics(b: BallisticSpec, rules: Pick<MatchRules, 'ballistics'> = {}): { speed: number; gravity: number; drag: number } {
  const s = BALLISTICS_SCALE[rules.ballistics ?? 'standard'] ?? BALLISTICS_SCALE.standard;
  return { speed: b.velocity * s.velocity, gravity: BULLET_GRAVITY * b.gravityScale * s.gravity, drag: (b.drag ?? 0) * s.drag };
}

// ---------------------------------------------------------------- falloff & body zones

/** Damage multiple at `dist` metres (1 for weapons without falloff). */
export function falloffAt(f: FalloffSpec | null, dist: number): number {
  if (!f || dist <= f.start) return 1;
  if (dist >= f.end) return f.min;
  const u = (dist - f.start) / (f.end - f.start);
  const k = f.curve === 'smooth' ? u * u * (3 - 2 * u) : f.curve === 'steep' ? 1 - (1 - u) * (1 - u) : u;
  return 1 - (1 - f.min) * k;
}

// ---------------------------------------------------------------- recoil & spread state

/**
 * Per-player recoil and spray state. Counted in applied inputs, exactly like
 * the other weapon timers, so client prediction reproduces it bit for bit.
 */
export interface GunState {
  /** Mechanical recoil offset added to the aim (radians; pitch up, yaw right). */
  rp: number;
  ry: number;
  /** Rounds in the current recoil pattern (resets once aim has settled). */
  shots: number;
  /** Inputs since the last round. */
  idle: number;
  /** Sustained-fire spray (rounds, recovering once the trigger is released). */
  spray: number;
  /** Aim-down-sights blend 0..1. */
  ads: number;
}

export const newGunState = (): GunState => ({ rp: 0, ry: 0, shots: 0, idle: 1000, spray: 0, ads: 0 });

/** A bounded, deterministic wobble in [-1, 1] for round `i` (no RNG: client and server agree). */
export function wobble(i: number): number {
  let h = (i + 1) * 0x9e3779b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** The kick of round `i` of a spray. */
export function kickOf(k: KickSpec, i: number): { pitch: number; yaw: number } {
  const pitch = k.pitch[Math.min(i, k.pitch.length - 1)] ?? 0;
  const yaw = (k.yaw.length ? k.yaw[i % k.yaw.length]! : 0) + k.variance * wobble(i);
  return { pitch, yaw };
}

/** A round was fired: kick the aim and grow the spray. */
export function recoilShot(g: GunState, k: KickSpec | null): void {
  if (k) {
    const r = kickOf(k, g.shots);
    g.rp += r.pitch;
    g.ry += r.yaw;
  }
  g.shots++;
  g.spray++;
  g.idle = 0;
}

/**
 * The player pulled against the recoil (spec §12: input can counter it).
 * `pitch` / `yaw` are the counter movements the client reports (radians, in
 * the direction that undoes the kick); only what is still there is taken.
 */
export function counterRecoil(g: GunState, pitch: number, yaw: number): void {
  if (pitch > 0 && g.rp > 0) g.rp -= Math.min(g.rp, pitch);
  if (yaw !== 0 && g.ry !== 0 && Math.sign(yaw) === Math.sign(g.ry)) g.ry -= Math.sign(g.ry) * Math.min(Math.abs(g.ry), Math.abs(yaw));
}

/**
 * How much of a mouse movement counters the current recoil (the client works
 * this out per input and sends it; the server applies it with counterRecoil).
 * `dPitch` / `dYaw` are the mouse movement since the last input.
 */
export function counterFrom(g: GunState, dPitch: number, dYaw: number): [number, number] {
  const p = dPitch < 0 && g.rp > 0 ? Math.min(g.rp, -dPitch) : 0;
  let y = 0;
  if (g.ry > 0 && dYaw < 0) y = Math.min(g.ry, -dYaw);
  else if (g.ry < 0 && dYaw > 0) y = -Math.min(-g.ry, dYaw);
  return [p, y];
}

/**
 * One applied input with no round fired: after the weapon's delay, aim
 * settles back toward where it was before the spray along a fixed curve
 * (exponential plus a constant rate), and the spray recovers.
 * `interval` is the weapon's fire interval: spray only starts recovering once
 * the trigger has really been let go.
 */
export function recoilIdle(g: GunState, k: KickSpec | null, a: AccuracySpec | null, interval: number, dt: number = TICK_DT): void {
  g.idle++;
  if (a && g.idle > interval && g.spray > 0) g.spray = Math.max(0, g.spray - a.recovery * dt);
  const delay = k?.delay ?? 4;
  if (g.idle <= delay) return;
  const settle = k ? 1 - Math.exp(-k.settle * dt) : 1;
  const rate = (k?.rate ?? 1) * dt;
  const back = (v: number) => {
    const s = Math.abs(v) * settle + rate;
    return Math.abs(v) <= s ? 0 : v - Math.sign(v) * s;
  };
  g.rp = back(g.rp);
  g.ry = back(g.ry);
  if (g.rp === 0 && g.ry === 0) g.shots = 0;
}

/** Inputs until the aim is back where it started (the delay included) after a spray that left offset `rp` (for tests and tuning UIs). */
export function settleTicks(k: KickSpec, rp: number): number {
  const g = { ...newGunState(), rp, idle: 0 };
  let n = 0;
  while (g.rp > 0 && n < 10_000) {
    recoilIdle(g, k, null, 0);
    n++;
  }
  return n;
}

/** Bring the sights up (or down) one input. */
export function stepAds(g: GunState, a: AccuracySpec | null, aiming: boolean): void {
  const step = 1 / Math.max(1, a?.adsTicks ?? 12);
  g.ads = aiming ? Math.min(1, g.ads + step) : Math.max(0, g.ads - step * 2);
}

/** What the shooter is doing when a round leaves the barrel. */
export interface SpreadContext {
  /** Horizontal speed as a share of running speed. */
  run: number;
  airborne: boolean;
  /** Stance multiple (crouched and prone are steadier). */
  stance: number;
}

/** Cone half-angle for the next round (spec §14). */
export function spreadOf(a: AccuracySpec, g: GunState, ctx: SpreadContext): number {
  const sustained = Math.max(0, g.spray - a.tight) * a.perShot;
  const moving = ctx.run > 0.25 ? a.move * Math.min(1, ctx.run) : 0;
  const cone = Math.min(a.max, a.base + moving + (ctx.airborne ? a.air : 0) + sustained);
  return cone * (1 + (a.ads - 1) * g.ads) * ctx.stance;
}

/**
 * Cone for a weapon's primary trigger: the gunplay spread, plus the pellet
 * pattern (the weapon's own `spread`) for multi-pellet weapons. The pattern
 * is fixed, so a shotgun's reach is learnable: the sights and stance tighten
 * your aim, not the pattern.
 */
export function shotCone(def: Pick<WeaponDefinition, 'pellets' | 'spread'>, a: AccuracySpec, g: GunState, ctx: SpreadContext): number {
  return spreadOf(a, g, ctx) + (def.pellets > 1 ? def.spread : 0);
}

// ---------------------------------------------------------------- reloads

/** The ammunition a reload works on (server WeaponState or the client's predicted copy). */
export interface AmmoBox {
  mag: number;
  reserve: number;
  /** A magazine is in but no round chambered yet (an empty reload interrupted before the bolt). */
  unchambered?: boolean;
}

/** Reload kinds by index (PrivateState `rd`). */
export const RELOAD_KINDS = ['tactical', 'empty', 'chamber', 'shell'] as const;

/** A reload in progress. `t` counts applied inputs. */
export interface ReloadRun {
  kind: (typeof RELOAD_KINDS)[number];
  t: number;
  total: number;
  /** Magazine: 1 old magazine out, 2 new one in. Shell: rounds loaded so far. */
  stage: number;
}

/** Whether a reload makes sense now. */
export function canReload(def: WeaponDefinition, w: AmmoBox): boolean {
  if (def.magazine === 0 || def.heat) return false;
  if (w.unchambered) return true;
  return w.mag < def.magazine && w.reserve > 0;
}

/** Start a reload (null when there is nothing to do). */
export function beginReload(def: WeaponDefinition, w: AmmoBox): ReloadRun | null {
  if (!canReload(def, w)) return null;
  const r = gunplayOf(def).reload;
  if (r.type === 'shell') {
    const missing = Math.min(def.magazine - w.mag, w.reserve);
    return { kind: 'shell', t: 0, total: r.start + r.each * missing + r.end, stage: 0 };
  }
  if (w.unchambered) return { kind: 'chamber', t: 0, total: Math.max(1, Math.round(r.empty * (1 - r.in))), stage: 2 };
  const kind = w.mag > 0 ? 'tactical' : 'empty';
  return { kind, t: 0, total: kind === 'tactical' ? r.tactical : r.empty, stage: 0 };
}

/**
 * Advance a reload by one applied input. Ammunition follows the mechanical
 * stage reached, not the animation's end (spec §16): the old magazine's
 * rounds go back to reserve when it comes out (one stays chambered on a
 * tactical reload), the new one is usable once in (an empty reload also has
 * to chamber), and each shell or cartridge exists the moment it is loaded.
 * Returns the run, or null when it is finished.
 */
export function stepReload(def: WeaponDefinition, w: AmmoBox, run: ReloadRun): ReloadRun | null {
  const r = gunplayOf(def).reload;
  run.t++;
  if (r.type === 'shell') {
    // One round in at the end of each `each` ticks after the opening.
    if (run.t >= r.start + r.each * (run.stage + 1) && w.mag < def.magazine && w.reserve > 0) {
      w.mag++;
      w.reserve--;
      run.stage++;
    }
    // Full (or out of reserve): only the closing motion is left.
    if (w.mag >= def.magazine || w.reserve === 0) run.total = Math.min(run.total, Math.max(run.t, r.start + r.each * run.stage) + r.end);
    return run.t >= run.total ? null : run;
  }
  if (run.kind === 'chamber') {
    if (run.t >= run.total) {
      w.unchambered = false;
      return null;
    }
    return run;
  }
  const outAt = Math.max(1, Math.round(run.total * r.out));
  const inAt = Math.max(outAt, Math.round(run.total * r.in));
  if (run.stage === 0 && run.t >= outAt) {
    // Magazine out: its rounds go back to reserve; a tactical reload keeps one in the chamber.
    const keep = run.kind === 'tactical' ? Math.min(1, w.mag) : 0;
    w.reserve += w.mag - keep;
    w.mag = keep;
    run.stage = 1;
  }
  if (run.stage === 1 && run.t >= inAt) {
    // New magazine in.
    const take = Math.min(def.magazine - w.mag, w.reserve);
    w.mag += take;
    w.reserve -= take;
    if (run.kind === 'empty' && w.mag > 0) w.unchambered = true;
    run.stage = 2;
  }
  if (run.t >= run.total) {
    if (run.kind === 'empty') w.unchambered = false;
    return null;
  }
  return run;
}

/** Rounds that can be fired right now (an unchambered magazine can't). */
export const roundsReady = (w: AmmoBox): number => (w.unchambered ? 0 : w.mag);

// ---------------------------------------------------------------- ballistic flight

export interface BulletState {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
}

/**
 * Advance a bullet by `dt` seconds (semi-implicit Euler: gravity and drag
 * change the velocity, then it moves). Returns the straight segment flown.
 */
export function flyBullet(b: BulletState, gravity: number, drag: number, dt: number): { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } } {
  const from = { ...b.pos };
  if (drag > 0) {
    const k = Math.max(0, 1 - drag * dt);
    b.vel = { x: b.vel.x * k, y: b.vel.y * k, z: b.vel.z * k };
  }
  b.vel = { x: b.vel.x, y: b.vel.y - gravity * dt, z: b.vel.z };
  b.pos = { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt, z: b.pos.z + b.vel.z * dt };
  return { from, to: { ...b.pos } };
}

/**
 * Where a bullet fired from `origin` along `dir` lands, ignoring targets:
 * near range as a ray, then sub-stepped flight until `raycast` hits or
 * `maxDist` / BULLET_LIFETIME runs out. Client tracers and the training
 * range's drop readout use it; the server runs the same steps in Match.
 */
export function traceBullet(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  phys: { speed: number; gravity: number; drag: number },
  maxDist: number,
  raycast: (o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, len: number) => number | null,
): { end: { x: number; y: number; z: number }; time: number; hit: boolean } {
  const near = Math.min(NEAR_INSTANT_M, maxDist);
  const first = raycast(origin, dir, near);
  if (first !== null) return { end: { x: origin.x + dir.x * first, y: origin.y + dir.y * first, z: origin.z + dir.z * first }, time: 0, hit: true };
  const b: BulletState = { pos: { x: origin.x + dir.x * near, y: origin.y + dir.y * near, z: origin.z + dir.z * near }, vel: { x: dir.x * phys.speed, y: dir.y * phys.speed, z: dir.z * phys.speed } };
  let travelled = near;
  let time = 0;
  const dt = TICK_DT / BULLET_SUBSTEPS;
  while (time < BULLET_LIFETIME && travelled < maxDist) {
    const seg = flyBullet(b, phys.gravity, phys.drag, dt);
    time += dt;
    const d = { x: seg.to.x - seg.from.x, y: seg.to.y - seg.from.y, z: seg.to.z - seg.from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 1e-9) break;
    const u = { x: d.x / len, y: d.y / len, z: d.z / len };
    const hit = raycast(seg.from, u, len);
    if (hit !== null) return { end: { x: seg.from.x + u.x * hit, y: seg.from.y + u.y * hit, z: seg.from.z + u.z * hit }, time: time - dt + (hit / len) * dt, hit: true };
    travelled += len;
  }
  return { end: b.pos, time, hit: false };
}

/** Flight time (s) and drop (m) of a weapon's bullet to `dist` metres on a flat shot (no drag), under a ballistics rule. */
export function flightTo(b: BallisticSpec, dist: number, rules: Pick<MatchRules, 'ballistics'> = {}): { time: number; drop: number } {
  const p = bulletPhysics(b, rules);
  const time = Math.max(0, dist - NEAR_INSTANT_M) / p.speed;
  return { time, drop: 0.5 * p.gravity * time * time };
}

/** Whether round number `n` (0-based, of the trigger pulls since the weapon was drawn) is drawn as a tracer, with `left` rounds remaining in the magazine after it. */
export function isTracer(b: BallisticSpec | null, n: number, left: number): boolean {
  if (!b) return true;
  if (b.tracerFinal && left < b.tracerFinal) return true;
  return b.tracerEvery > 0 && n % b.tracerEvery === 0;
}

// ---------------------------------------------------------------- materials (spec §8, G1)

export const BALLISTIC_MATERIALS = ['flesh', 'glass', 'thin_wood', 'wood', 'drywall', 'stone', 'brick', 'concrete', 'thin_metal', 'metal', 'armor', 'water', 'soil', 'energy'] as const;
export type BallisticMaterial = (typeof BALLISTIC_MATERIALS)[number];

export interface MaterialBallistics {
  /** Energy lost per metre of material crossed. */
  resist: number;
  /** Ricochet chance at a grazing hit (0 never). */
  ricochet: number;
  /** Damage multiple for destructibles of this material. */
  destruction: number;
}

export const MATERIAL_BALLISTICS: Readonly<Record<BallisticMaterial, MaterialBallistics>> = {
  flesh: { resist: 2500, ricochet: 0, destruction: 1 },
  glass: { resist: 150, ricochet: 0, destruction: 3 },
  thin_wood: { resist: 600, ricochet: 0, destruction: 1.5 },
  wood: { resist: 1000, ricochet: 0, destruction: 1.2 },
  drywall: { resist: 500, ricochet: 0, destruction: 1.5 },
  stone: { resist: 6000, ricochet: 0.1, destruction: 0.4 },
  brick: { resist: 5000, ricochet: 0.05, destruction: 0.6 },
  concrete: { resist: 7000, ricochet: 0.1, destruction: 0.4 },
  thin_metal: { resist: 4500, ricochet: 0.45, destruction: 0.8 },
  metal: { resist: 16000, ricochet: 0.5, destruction: 0.5 },
  armor: { resist: 40000, ricochet: 0.6, destruction: 0.2 },
  water: { resist: 400, ricochet: 0.2, destruction: 0 },
  soil: { resist: 5000, ricochet: 0, destruction: 0 },
  energy: { resist: 1e9, ricochet: 0, destruction: 0 },
};

/** A bullet goes on through a surface only with this much energy left. */
export const PENETRATION_MIN_ENERGY = 60;
/** At most this many surfaces passed through per bullet. */
export const MAX_PENETRATIONS = 3;
/** Grazing hits (closer to the surface than this many radians) may ricochet off metal and stone. */
export const RICOCHET_MAX_ANGLE = 0.35;
/** At most one ricochet per bullet. */
export const MAX_RICOCHETS = 1;

/** What a library surface material (map/materials.ts id) or a model name is made of, ballistically. */
export function materialClass(id: string | null | undefined, category?: string | null): BallisticMaterial {
  const s = (id ?? '').toLowerCase();
  if (/glass|window|pane/.test(s)) return 'glass';
  if (/drywall|plaster|paint|canvas|carpet|fabric|tent/.test(s)) return 'drywall';
  if (/board|crate|plank|fence|barricade|pallet|shelf|table|chair|door|box|siding|walnut|wood|barrel_wood|keg/.test(s)) return /plank|board|crate|fence|pallet|siding|barricade/.test(s) ? 'thin_wood' : 'wood';
  if (/armor|vault|blast/.test(s)) return 'armor';
  if (/sheet|corrugated|panel_metal|locker|cabinet|vending|car|van|bus|truck|container|grate|walkway|barrel|gas|generator|tank/.test(s)) return 'thin_metal';
  if (/steel|metal|iron|plate|brass|rust|pipe|machine/.test(s)) return 'metal';
  if (/brick/.test(s)) return 'brick';
  if (/sand|soil|dirt|mud|grass|sandbag|rock|terrain/.test(s)) return /rock/.test(s) ? 'stone' : 'soil';
  if (/stone|cobble|marble|travertine|onyx|flagstone|tile|terrazzo|paving/.test(s)) return 'stone';
  if (/concrete/.test(s)) return 'concrete';
  if (/energy|field|neon|glow|light/.test(s)) return 'energy';
  switch (category) {
    case 'Wood':
      return 'wood';
    case 'Metal':
      return 'metal';
    case 'Brick':
      return 'brick';
    case 'Stone':
    case 'Tile':
      return 'stone';
    case 'Fabric':
    case 'Paint':
      return 'drywall';
    case 'Ground':
      return 'soil';
    default:
      return 'concrete';
  }
}

/** Energy a bullet loses crossing `thickness` metres of a material. */
export const penetrationLoss = (m: BallisticMaterial, thickness: number): number => MATERIAL_BALLISTICS[m].resist * Math.max(0, thickness);

/**
 * Passing through (spec §8): energy-based, not binary. Returns the energy
 * left after the surface, or null when the bullet stops in it.
 */
export function penetrate(energy: number, m: BallisticMaterial, thickness: number): number | null {
  const left = energy - penetrationLoss(m, thickness);
  return left >= PENETRATION_MIN_ENERGY ? left : null;
}

/**
 * Whether a hit at `grazing` radians from the surface (0 = skimming along it)
 * ricochets, given a 0..1 roll: rare, bounded, only on hard materials.
 */
export function ricochets(m: BallisticMaterial, grazing: number, roll: number): boolean {
  const chance = MATERIAL_BALLISTICS[m].ricochet;
  if (chance <= 0 || grazing >= RICOCHET_MAX_ANGLE) return false;
  return roll < chance * (1 - grazing / RICOCHET_MAX_ANGLE);
}

const MATERIAL_CATEGORY = new Map(CORE_MATERIALS.map((m) => [m.id, m.category]));

/** Ballistic class of a library surface material (free blocks, Style Pack pieces). */
export const surfaceMaterial = (id: string | null | undefined): BallisticMaterial => (id ? materialClass(id, MATERIAL_CATEGORY.get(id) ?? null) : 'concrete');

const DESTRUCTIBLE_MATERIAL: Readonly<Record<string, BallisticMaterial>> = { crate: 'thin_wood', barrel: 'thin_metal', wall: 'brick', glass: 'glass', boards: 'thin_wood', gas: 'thin_metal', generator: 'metal' };

/**
 * What a map entity's collider is made of. Tile structure (walls and floors
 * from the theme) counts as structural concrete so existing maps keep their
 * cover; materials come from free blocks, props, doors and destructibles.
 */
export function entityMaterial(e: MapEntity): BallisticMaterial {
  switch (e.kind) {
    case 'destructible':
      return DESTRUCTIBLE_MATERIAL[e.model] ?? 'wood';
    case 'door':
      return 'wood';
    case 'block':
      return surfaceMaterial(e.material);
    case 'prop':
      return materialClass(e.model);
    default:
      return 'concrete';
  }
}
