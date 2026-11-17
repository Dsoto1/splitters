/**
 * Controller vibration (Options → Accessibility: Controller vibration and its strength; combatPrefs.ts): a short
 * rumble through the Gamepad API's `vibrationActuator` where the browser has it (Chromium browsers; not every
 * browser can), for firing, taking hits and blasts near you. Only a controller that is in use rumbles, and only while
 * the setting is on; the strength scales every effect.
 */
import { combatPrefs } from './combatPrefs.ts';

interface Actuator {
  playEffect?: (type: string, params: { duration: number; startDelay?: number; strongMagnitude: number; weakMagnitude: number }) => Promise<unknown>;
}

/** Whether this browser can vibrate a controller at all (the setting is hidden where it can't). */
export function vibrationSupported(): boolean {
  try {
    return typeof Gamepad !== 'undefined' && 'vibrationActuator' in Gamepad.prototype;
  } catch {
    return false;
  }
}

/** One rumble: how long (ms) and how hard the heavy (strong) and light (weak) motors run, 0..1 before the strength. */
export interface RumbleEffect {
  duration: number;
  strong: number;
  weak: number;
}

/** A shot of a weapon with visual kick `kick` (0..1.5: a pistol's 0.5, the revolver's 1.2). */
export function fireRumble(kick: number, auto: boolean): RumbleEffect {
  const k = Math.max(0, Math.min(1.5, kick));
  // Automatics a short buzz each round, so a spray doesn't blur into one long drone; heavy single shots a thump.
  return auto ? { duration: 45, strong: 0.1 * k, weak: 0.35 + 0.15 * k } : { duration: 70 + 50 * k, strong: 0.25 + 0.4 * k, weak: 0.3 + 0.2 * k };
}

/** A hit taken with stopping power `power` (a pellet its share). */
export function hitRumble(power: number): RumbleEffect {
  const p = Math.max(0, Math.min(1.2, power));
  return { duration: 90 + 80 * p, strong: 0.35 + 0.5 * p, weak: 0.25 };
}

/** A blast or crash `near` (0..1: 1 on top of you). */
export function blastRumble(near: number): RumbleEffect {
  const n = Math.max(0, Math.min(1, near));
  return { duration: 160 + 320 * n, strong: 0.25 + 0.75 * n, weak: 0.2 + 0.5 * n };
}

/** The effect at the player's strength, or null when vibration is off or too faint to feel. */
export function scaledRumble(e: RumbleEffect, prefs = combatPrefs()): RumbleEffect | null {
  if (!prefs.vibration) return null;
  const s = prefs.vibrationStrength;
  const strong = Math.min(1, e.strong * s);
  const weak = Math.min(1, e.weak * s);
  if (strong < 0.02 && weak < 0.02) return null;
  return { duration: Math.round(e.duration), strong, weak };
}

/** The controller in use, if it can vibrate. */
function activePad(): Actuator | null {
  const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() ?? [] : [];
  for (const g of pads) {
    if (!g?.connected || g.mapping !== 'standard') continue;
    const a = (g as unknown as { vibrationActuator?: Actuator }).vibrationActuator;
    if (a?.playEffect) return a;
  }
  return null;
}

/** Rumble the controller in use (`padActive`: one has been used this page), if the setting allows. */
export function rumble(e: RumbleEffect, padActive: boolean): void {
  if (!padActive) return;
  const s = scaledRumble(e);
  if (!s) return;
  const pad = activePad();
  if (!pad) return;
  // A new effect replaces the one playing; a browser that refuses just doesn't rumble.
  pad.playEffect!('dual-rumble', { duration: s.duration, startDelay: 0, strongMagnitude: s.strong, weakMagnitude: s.weak })?.catch?.(() => {});
}
