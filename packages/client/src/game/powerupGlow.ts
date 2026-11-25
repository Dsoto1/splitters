import {
  PHANTOM_SHOWN,
  POWERUP_DAMAGE_BIT,
  POWERUP_OVERDRIVE_BIT,
  POWERUP_RAPID_BIT,
  POWERUP_SPEED_BIT,
  POWERUP_VAMPIRE_BIT,
} from '@tiletrigger/shared';
import { POWERUP_LOOKS } from './powerupLook.ts';

/**
 * How power-ups show on a body others see (docs/LOOK.md, "Power-ups"). Seizure-safe by design (CLAUDE.md,
 * Accessibility): Overdrive is a steady gold glow that swells and settles slower than once a second, never a flicker or
 * a change of colour; Reduce flashing holds it still. Phantom is a faint shimmer the same way.
 */

/** Overdrive's glow swells and settles this often (Hz): under once a second (WCAG 2.3.1 asks under three flashes). */
export const OVERDRIVE_PULSE_HZ = 0.8;
/** The emissive share of the colour: the base glow is 0.55 (Speed, Double Damage); Overdrive between these. */
export const OVERDRIVE_GLOW_LOW = 0.5;
export const OVERDRIVE_GLOW_HIGH = 0.8;
/** With Reduce flashing on: held here. */
export const OVERDRIVE_GLOW_STEADY = 0.65;
export const BASE_GLOW = 0.55;

/** The body's glow colour: the strongest power-up it has that shows (Overdrive first), else none. */
export function bodyGlowColor(pu: number): string | null {
  if (pu & POWERUP_OVERDRIVE_BIT) return POWERUP_LOOKS.overdrive.color;
  if (pu & POWERUP_DAMAGE_BIT) return '#c03cff';
  if (pu & POWERUP_SPEED_BIT) return '#36d6ff';
  if (pu & POWERUP_VAMPIRE_BIT) return POWERUP_LOOKS.vampire.color;
  if (pu & POWERUP_RAPID_BIT) return POWERUP_LOOKS.rapid.color;
  return null;
}

/**
 * The glow's share now (`t` in seconds): Overdrive's slow swell, in twentieths so the material is set at most about
 * a dozen times a second; anything else the base glow.
 */
export function bodyGlowScale(pu: number, t: number, reduce: boolean): number {
  if (!(pu & POWERUP_OVERDRIVE_BIT)) return BASE_GLOW;
  if (reduce) return OVERDRIVE_GLOW_STEADY;
  const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * OVERDRIVE_PULSE_HZ * t);
  return Math.round((OVERDRIVE_GLOW_LOW + (OVERDRIVE_GLOW_HIGH - OVERDRIVE_GLOW_LOW) * wave) * 20) / 20;
}

/** Phantom's shimmer drifts this often (Hz), by this much either side of PHANTOM_SHOWN. */
export const PHANTOM_SHIMMER_HZ = 0.6;
export const PHANTOM_SHIMMER = 0.04;
/** A teammate in Phantom: a ghost, so you can still tell where they are. */
export const PHANTOM_ALLY_SHOWN = 0.4;

/** How much of a body in Phantom is drawn (1 solid): to enemies a faint, slow shimmer; Reduce flashing holds it still. */
export function phantomShown(t: number, enemy: boolean, reduce: boolean): number {
  if (!enemy) return PHANTOM_ALLY_SHOWN;
  if (reduce) return PHANTOM_SHOWN;
  return PHANTOM_SHOWN + PHANTOM_SHIMMER * Math.sin(2 * Math.PI * PHANTOM_SHIMMER_HZ * t);
}

/** Phantom eases in and out over about a sixth of a second (a shot gives them away without a pop). */
export function easePhantom(now: number, want: number, dt: number): number {
  const step = dt * 6;
  return want > now ? Math.min(want, now + step) : Math.max(want, now - step);
}
