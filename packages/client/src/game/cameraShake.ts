/**
 * Every camera shake, in one place, so Camera shake (Options → Accessibility; combatPrefs.ts) reaches all of them.
 * The view's own movement on top of your aim, and nothing else moves the camera without you:
 * - **blasts** near you (a vehicle going up is felt from further away) and **vehicle crashes** near you;
 * - the jolt of a **heavy round leaving the barrel** (revolver, rifles that slam, shotguns; automatics never shake);
 * - the **hit kick** when you are struck (hitKick.ts, scaled there by the same setting);
 * - the gentle **roll** of the view as you lean and as you ride a zipline (comfort, not aim), which the system's
 *   reduce-motion setting also turns off.
 * Off keeps none of it, Reduced about a third. The weapon's mechanical recoil and a scope's sway move your real aim
 * (where your rounds go), so they stay whatever the setting (GUNPLAY_SPEC §29, §42). There is no landing jolt.
 */

import { shakeScale } from './combatPrefs.ts';

/** How long a shake takes to settle (ms). */
export const SHAKE_MS = 650;

/** A blast `near` you (0 at its reach, 1 on top of it); `vehicle`: a vehicle going up. */
export function blastShake(near: number, vehicle: boolean): number {
  return near > 0 ? near * (vehicle ? 0.95 : 0.6) : 0;
}

/** How far a blast's shake reaches (m), from its radius. */
export function blastReach(radius: number, vehicle: boolean): number {
  return radius * (vehicle ? 6 : 3.5);
}

/** How far a vehicle crash's shake reaches (m). */
export const CRASH_REACH = 12;

/** A vehicle crash `near` you (0..1) of strength `n` (0..1). */
export function crashShake(near: number, n: number): number {
  return near > 0 ? near * n * 0.6 : 0;
}

/** Your own shot, by its weapon's visual kick: only big single kicks shake, and briefly. */
export function shotShake(visual: number): number {
  return visual >= 0.8 ? Math.min(0.25, visual * 0.15) : 0;
}

/**
 * A new shake on top of what is left of the last (`left`, already settling), by the Camera shake setting's share
 * `scale`: they add up to at most the share itself (Full: 1), and Off keeps none.
 */
export function addShake(left: number, amount: number, scale = shakeScale()): number {
  if (scale <= 0 || amount <= 0) return scale <= 0 ? 0 : left;
  return Math.min(scale, left + amount * scale);
}

/** What is left of a shake of `amount` set `ms` ago. */
export function shakeLeft(amount: number, ms: number): number {
  return amount * Math.max(0, 1 - ms / SHAKE_MS);
}

/** The share of the view's roll (lean, zipline) to keep: the Camera shake setting's, none with reduce motion on. */
export function rollScale(scale = shakeScale(), reduceMotion = prefersReducedMotion()): number {
  return reduceMotion ? 0 : scale;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
