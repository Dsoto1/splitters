/**
 * Reduce flashing (Options → Accessibility, and the pause menu's Settings): a seizure-safety setting, on by default.
 * The owner dropped the flashbang over seizure risk and asked for this (2026-11-06). With it on (docs/LOOK.md,
 * "Reduce flashing"):
 * - lightning (the Arc Caster, arc turrets, electric fences) holds a steady glow instead of crackling bolts
 *   (steadyArcs.ts), and the fence wires and an arc turret's charge stop flickering;
 * - big brightness jumps are capped and eased in: a blast near the camera, your own muzzle flash, a map light
 *   flaring (logic's "Flash"), the haze of water you dive into;
 * - blinking lights and blinking indicators pulse gently, at most once a second and at low contrast;
 * - nothing flashes saturated red over a large area (the hurt vignette is a darker, duller red that eases in and holds).
 * Off, everything looks as it always did. The e2e flow `flashing` records the brightest moments and holds them to
 * WCAG 2.3.1 (e2e/flicker.mjs).
 */

const KEY = 'tiletrigger.reduceFlashing';
/** Fired on window when the setting changes (the pause menu and Options show it, a running match applies it at once). */
export const REDUCE_FLASHING_EVENT = 'tiletrigger:reduce-flashing';

/** The saved setting: on unless switched off. */
export function loadReduceFlashing(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    // Private windows: the default.
    return true;
  }
}

let current: boolean | null = null;

/** Whether flashing is reduced now (read from storage once; effects ask every frame). */
export function reduceFlashing(): boolean {
  return (current ??= loadReduceFlashing());
}

export function saveReduceFlashing(on: boolean): void {
  current = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Lasts for this page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REDUCE_FLASHING_EVENT));
}

/** Tests: forget the value read, so the next read comes from storage again. */
export function resetReduceFlashingCache(): void {
  current = null;
}

/** Blinking with the setting on: a smooth pulse, at most once a second, never darker than `floor` of full. */
export const SAFE_BLINK = { maxHz: 1, floor: 0.55 } as const;

/**
 * How bright something blinking `hz` times a second is at `t` seconds (0..1): on for the first half of each blink,
 * off for the second; with flashing reduced a smooth pulse at most SAFE_BLINK.maxHz times a second between
 * SAFE_BLINK.floor and full (bright at the start of each, like the hard blink). 0 or less: steady.
 */
export function blinkLevel(t: number, hz: number, reduce = reduceFlashing()): number {
  if (!(hz > 0)) return 1;
  if (!reduce) return Math.floor(t * hz * 2) % 2 === 0 ? 1 : 0;
  const f = Math.min(hz, SAFE_BLINK.maxHz);
  return SAFE_BLINK.floor + (1 - SAFE_BLINK.floor) * (0.5 + 0.5 * Math.cos(2 * Math.PI * f * t));
}

/**
 * A small blinking indicator (a mine's or a sticky grenade's light, the bomb's): shown or not, and how bright. Off
 * (setting off): hard on and off. On: always shown, its brightness `blinkLevel`'s gentle pulse.
 */
export function indicator(t: number, hz: number, reduce = reduceFlashing()): { on: boolean; level: number } {
  const level = blinkLevel(t, hz, reduce);
  return reduce ? { on: true, level } : { on: level > 0, level: 1 };
}

/**
 * Move `from` toward `to`, at most `rise` a second up and `fall` a second down (a light's level, a haze's depth):
 * with flashing reduced nothing jumps in brightness between one frame and the next.
 */
export function ease(from: number, to: number, dt: number, rise: number, fall = rise): number {
  if (to > from) return Math.min(to, from + rise * dt);
  return Math.max(to, from - fall * dt);
}

/** How map lights change with the setting on: a "Flash" (logic) flares to this at most (2.5 off), and levels ease. */
export const SAFE_LIGHT = {
  /** Brightest a flashing light gets (times its level). */
  flash: 1.35,
  /** Level change a second, up and down: off to full in about 0.4 s. */
  rate: 2.5,
} as const;

/**
 * A blast's strength (0..1) seen from `dist` metres, for a blast of radius `radius`, with flashing reduced: full a
 * few radii off, dimmed as it nears the camera (a blast filling the view is the full-screen flash this setting caps).
 */
export function blastStrength(dist: number, radius: number): number {
  const r = Math.max(0.5, radius);
  const k = (dist - 0.6 * r) / (3 * r);
  return Math.max(0.3, Math.min(1, 0.3 + 0.7 * k));
}

/** A blast's effect, with flashing reduced, takes this long (s) to come up to its strength instead of popping in. */
export const BLAST_FADE_IN = 0.12;

/** Your own muzzle flash with flashing reduced: this much of its size and its brightness. */
export const SAFE_MUZZLE = { scale: 0.75, opacity: 0.45 } as const;
