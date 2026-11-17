/**
 * Combat accessibility (Options → Accessibility, and the pause menu's Settings; docs/GUNPLAY_SPEC.md §42):
 * - **Aim**: hold the aim button to aim down the sights or scope (the default), or press once to aim and again to stop.
 *   On a phone or tablet the default is Toggle (the Aim button latches), and the setting is offered in Options →
 *   Controls → Touch as well. A toggled aim lets go when you change weapons, die, get in a vehicle or leave play
 *   (input.ts, AimLatch).
 * - **Camera shake**: Off, Reduced or Full (the default), for the view's own movement on top of your aim: the jolt of a
 *   heavy round leaving the barrel, the hit kick when you are struck, and blasts and crashes near you. The weapon's
 *   mechanical recoil is where your rounds go, so it stays (GUNPLAY_SPEC §29). Reduce flashing keeps its own limits on
 *   top (the hit kick's calm shape: hitKick.ts).
 * - **Controller vibration**: on or off, and how strong, through the Gamepad API's vibration where the browser has it
 *   (rumble.ts): firing, taking hits and blasts near you. Hidden where the browser can't vibrate a controller.
 * Saved in this browser with the other options; a running match applies a change at once.
 */

import { isTouchDevice } from '../touchDevice.ts';

export const AIM_MODES = ['hold', 'toggle'] as const;
export type AimMode = (typeof AIM_MODES)[number];
export const SHAKE_LEVELS = ['off', 'reduced', 'full'] as const;
export type ShakeLevel = (typeof SHAKE_LEVELS)[number];

export interface CombatPrefs {
  aim: AimMode;
  shake: ShakeLevel;
  vibration: boolean;
  /** 0.1..1 */
  vibrationStrength: number;
}

export const DEFAULT_COMBAT_PREFS: Readonly<CombatPrefs> = { aim: 'hold', shake: 'full', vibration: true, vibrationStrength: 0.7 };
/** A phone or tablet's defaults: its Aim button latches until the setting says otherwise. */
export const TOUCH_COMBAT_DEFAULTS: Readonly<CombatPrefs> = { ...DEFAULT_COMBAT_PREFS, aim: 'toggle' };

const KEY = 'tiletrigger.combat';
/** Fired on window when a setting changes (the pause menu and Options keep in step, a running match applies it). */
export const COMBAT_PREFS_EVENT = 'tiletrigger:combat-prefs';

/** How much of the camera's shake and hit kick each level keeps. */
export const SHAKE_SCALE: Readonly<Record<ShakeLevel, number>> = { off: 0, reduced: 0.35, full: 1 };

export const AIM_LABELS: Readonly<Record<AimMode, string>> = { hold: 'Hold', toggle: 'Toggle' };
export const SHAKE_LABELS: Readonly<Record<ShakeLevel, string>> = { off: 'Off', reduced: 'Reduced', full: 'Full' };

const clampStrength = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_COMBAT_PREFS.vibrationStrength;
  return Math.round(Math.max(0.1, Math.min(1, n)) * 100) / 100;
};

/** A stored value read back: anything unknown or missing is the default. */
export function parseCombatPrefs(raw: string | null, defaults: Readonly<CombatPrefs> = DEFAULT_COMBAT_PREFS): CombatPrefs {
  let o: Partial<Record<keyof CombatPrefs, unknown>> = {};
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (v && typeof v === 'object') o = v as typeof o;
  } catch {
    // A damaged value: the defaults.
  }
  return {
    aim: AIM_MODES.find((m) => m === o.aim) ?? defaults.aim,
    shake: SHAKE_LEVELS.find((s) => s === o.shake) ?? DEFAULT_COMBAT_PREFS.shake,
    vibration: typeof o.vibration === 'boolean' ? o.vibration : DEFAULT_COMBAT_PREFS.vibration,
    vibrationStrength: clampStrength(o.vibrationStrength),
  };
}

export function loadCombatPrefs(): CombatPrefs {
  try {
    return parseCombatPrefs(localStorage.getItem(KEY), isTouchDevice() ? TOUCH_COMBAT_DEFAULTS : DEFAULT_COMBAT_PREFS);
  } catch {
    // Private windows: the defaults.
    return { ...(isTouchDevice() ? TOUCH_COMBAT_DEFAULTS : DEFAULT_COMBAT_PREFS) };
  }
}

let current: CombatPrefs | null = null;

/** The settings now (read from storage once; the game asks every frame). */
export function combatPrefs(): Readonly<CombatPrefs> {
  return (current ??= loadCombatPrefs());
}

/** Change some settings, save them and tell the page. */
export function saveCombatPrefs(change: Partial<CombatPrefs>): void {
  const next = parseCombatPrefs(JSON.stringify({ ...combatPrefs(), ...change }), combatPrefs());
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Lasts for this page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(COMBAT_PREFS_EVENT));
}

/** Tests: forget the value read, so the next read comes from storage again. */
export function resetCombatPrefsCache(): void {
  current = null;
}

/** The share of camera shake and hit kick to keep now (Camera shake). */
export function shakeScale(): number {
  return SHAKE_SCALE[combatPrefs().shake];
}

/**
 * Aim down the sights, held or toggled. `press` is called as an aim button goes down (the event itself, so a click
 * quicker than a frame still counts); `update` takes whether one is down now and gives whether you aim: held, while
 * it is down; toggled, each press flips it. `cancel` lets a toggled aim go (a weapon change, death, a vehicle,
 * leaving play).
 */
export class AimLatch {
  private latched = false;
  private presses = 0;

  press(): void {
    this.presses++;
  }

  update(down: boolean, mode: AimMode): boolean {
    const presses = this.presses;
    this.presses = 0;
    if (mode === 'hold') {
      this.latched = false;
      return down;
    }
    if (presses % 2) this.latched = !this.latched;
    return this.latched;
  }

  /** Let a toggled aim go (and forget presses not yet seen). */
  cancel(): void {
    this.latched = false;
    this.presses = 0;
  }

  get on(): boolean {
    return this.latched;
  }
}
