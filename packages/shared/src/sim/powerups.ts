/**
 * The power-ups beyond Speed Boost and Double Damage (owner, 2026-11-24): Overdrive, Regen, Rapid Fire, Phantom,
 * Moon Boots, Vampire and Bottomless Mag. Their numbers are data (content/pickups.json `rules.powerup`); what each
 * does lives here (the pure parts both the match and client prediction run) and in sim/match.ts (the rest).
 * docs/PICKUPS.md, "Power-ups", has the starting balance.
 */
import { PICKUP_RULES } from '../content/pickups.generated.ts';
import { TICK_RATE } from './constants.ts';
import type { ItemDefinition, PowerupKind } from './items.ts';

/** The seven, in the order of PrivateState `px` and of the HUD's timers. */
export const EXTRA_POWERUPS = ['overdrive', 'regen', 'rapid', 'phantom', 'moon', 'vampire', 'bottomless'] as const;
export type ExtraPowerup = (typeof EXTRA_POWERUPS)[number];

/** Inputs of each one left (0: off). */
export type PowerTicks = Record<ExtraPowerup, number>;
export const noPowers = (): PowerTicks => ({ overdrive: 0, regen: 0, rapid: 0, phantom: 0, moon: 0, vampire: 0, bottomless: 0 });

const R = PICKUP_RULES.powerup;
export const OVERDRIVE_SPEED: number = R.overdriveSpeed;
export const OVERDRIVE_PUSH: number = R.overdrivePush;
export const OVERDRIVE_LIFT: number = R.overdriveLift;
export const OVERDRIVE_DAMAGE: number = R.overdriveDamage;
/** An enemy Overdrive knocked over can't be knocked again for this long (one bump, not a grinder). */
export const OVERDRIVE_KNOCK_EVERY_TICKS = TICK_RATE;
export const REGEN_PER_TICK: number = R.regenPerSecond / TICK_RATE;
export const RAPID_FIRE: number = R.rapidFire;
export const RAPID_RELOAD: number = R.rapidReload;
export const RAPID_WITH_DAMAGE: number = R.rapidWithDamage;
export const PHANTOM_SHOWN: number = R.phantomShown;
export const PHANTOM_REVEAL_TICKS: number = Math.round(R.phantomRevealSeconds * TICK_RATE);
export const MOON_GRAVITY: number = R.moonGravity;
export const MOON_JUMP: number = R.moonJump;
export const VAMPIRE_SHARE: number = R.vampireShare;

/** The weapon id kills by an Overdrive bump are credited to (the kill feed's "Overdrive"). */
export const OVERDRIVE_WEAPON = 'core.overdrive';

/** Count every running timer down one input. */
export function tickPowers(p: PowerTicks): void {
  for (const k of EXTRA_POWERUPS) if (p[k] > 0) p[k]--;
}

/**
 * Rapid Fire's extra steps this input for a timer running `rate` times as fast, with `left` inputs of it left (before
 * this input's count down): 0 or 1, spread evenly (at 1.5, every other input). Only `left` decides it, so the match
 * and client prediction step on the same inputs.
 */
export function rapidSteps(left: number, rate: number): number {
  if (left <= 0 || rate <= 1) return 0;
  const k = rate - 1;
  return Math.floor(left * k + 1e-9) - Math.floor((left - 1) * k + 1e-9);
}

/** Rapid Fire's fire-rate multiple: smaller with Double Damage on too, so the two never triple the damage a second. */
export const rapidFireRate = (damageBoosted: boolean): number => (damageBoosted ? RAPID_WITH_DAMAGE : RAPID_FIRE);

/** Moving: the speed multiple, the gravity and jump multiples Overdrive and Moon Boots add. */
export function powerMove(p: PowerTicks): { speed: number; gravity: number; jump: number } {
  return { speed: p.overdrive > 0 ? OVERDRIVE_SPEED : 1, gravity: p.moon > 0 ? MOON_GRAVITY : 1, jump: p.moon > 0 ? MOON_JUMP : 1 };
}

/** The power-up a pickup item gives, if it is one. */
export const powerupOf = (item: ItemDefinition | undefined): PowerupKind | null => (item?.effect.kind === 'powerup' ? item.effect.powerup : null);

/**
 * PrivateState `px`: the seven timers in EXTRA_POWERUPS order, or undefined when none runs (the snapshot leaves it out).
 */
export function powersWire(p: PowerTicks): number[] | undefined {
  return EXTRA_POWERUPS.some((k) => p[k] > 0) ? EXTRA_POWERUPS.map((k) => p[k]) : undefined;
}

export function powersFromWire(px: readonly number[] | undefined): PowerTicks {
  const p = noPowers();
  if (px) EXTRA_POWERUPS.forEach((k, i) => (p[k] = Math.max(0, px[i] ?? 0)));
  return p;
}

/**
 * A weapon held under Bottomless Mag: its magazine (and a second gun's) kept full, a round always chambered. Works on
 * anything with a magazine (spears and heat guns: nothing to do for the heat). Returns whether it changed anything.
 */
export function fillMagazine(w: { def: { magazine: number; kind: string }; mag: number; unchambered?: boolean; off?: { mag: number; unchambered?: boolean } }): boolean {
  if (!(w.def.magazine > 0)) return false;
  let changed = false;
  if (w.mag < w.def.magazine || w.unchambered) {
    w.mag = Math.max(w.mag, w.def.magazine);
    w.unchambered = undefined;
    changed = true;
  }
  if (w.off && (w.off.mag < w.def.magazine || w.off.unchambered)) {
    w.off.mag = Math.max(w.off.mag, w.def.magazine);
    w.off.unchambered = undefined;
    changed = true;
  }
  return changed;
}
