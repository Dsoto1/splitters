// Combat accessibility (game/combatPrefs.ts, game/rumble.ts; GUNPLAY_SPEC §42): aim held or toggled, camera shake,
// controller vibration; saved with the other options.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BUTTON_ZOOM, BUTTON_SPRINT } from '@tiletrigger/shared';
import { AimLatch, COMBAT_PREFS_EVENT, DEFAULT_COMBAT_PREFS, SHAKE_SCALE, combatPrefs, loadCombatPrefs, parseCombatPrefs, resetCombatPrefsCache, saveCombatPrefs, shakeScale } from '../src/game/combatPrefs.ts';
import { blastRumble, fireRumble, hitRumble, scaledRumble } from '../src/game/rumble.ts';
import { HIT_KICK, addKick } from '../src/game/hitKick.ts';

const store = new Map<string, string>();
const events: string[] = [];
beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= new EventTarget();
  g.document ??= Object.assign(new EventTarget(), { pointerLockElement: null });
  window.addEventListener(COMBAT_PREFS_EVENT, () => events.push(COMBAT_PREFS_EVENT));
});
beforeEach(() => {
  store.clear();
  events.length = 0;
  resetCombatPrefsCache();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
});
afterEach(() => resetCombatPrefsCache());

describe('the settings', () => {
  it('default to hold aim, full shake, vibration on at 70 %', () => {
    expect(loadCombatPrefs()).toEqual(DEFAULT_COMBAT_PREFS);
    expect(DEFAULT_COMBAT_PREFS).toEqual({ aim: 'hold', shake: 'full', vibration: true, vibrationStrength: 0.7 });
  });

  it('save, read back after a reload, and tell the page', () => {
    saveCombatPrefs({ aim: 'toggle', shake: 'reduced', vibration: false, vibrationStrength: 0.4 });
    expect(events).toEqual([COMBAT_PREFS_EVENT]);
    resetCombatPrefsCache();
    expect(combatPrefs()).toEqual({ aim: 'toggle', shake: 'reduced', vibration: false, vibrationStrength: 0.4 });
    // A change keeps the rest.
    saveCombatPrefs({ shake: 'off' });
    resetCombatPrefsCache();
    expect(combatPrefs()).toEqual({ aim: 'toggle', shake: 'off', vibration: false, vibrationStrength: 0.4 });
  });

  it('anything damaged or unknown reads as the default; the strength stays 10-100 %', () => {
    expect(parseCombatPrefs('not json')).toEqual(DEFAULT_COMBAT_PREFS);
    expect(parseCombatPrefs('{"aim":"sideways","shake":"wild","vibration":"yes","vibrationStrength":"loud"}')).toEqual(DEFAULT_COMBAT_PREFS);
    expect(parseCombatPrefs('{"vibrationStrength":5}').vibrationStrength).toBe(1);
    expect(parseCombatPrefs('{"vibrationStrength":0}').vibrationStrength).toBe(0.1);
  });
});

describe('aim: hold or toggle', () => {
  it('hold aims while the button is down', () => {
    const a = new AimLatch();
    expect([false, true, true, false].map((d) => a.update(d, 'hold'))).toEqual([false, true, true, false]);
  });

  it('toggle: a press aims, the next press stops; holding or letting go changes nothing', () => {
    const a = new AimLatch();
    const step = (press: boolean, down: boolean) => (press && a.press(), a.update(down, 'toggle'));
    expect([step(true, true), step(false, true), step(false, false), step(true, true), step(false, false), step(true, false)]).toEqual([true, true, true, false, false, true]);
    // A click quicker than a frame (down and up between two looks) still counts once.
    a.press();
    expect(a.update(false, 'toggle')).toBe(false);
  });

  it('a cancel (weapon change, death, vehicle) lets go, and forgets presses not yet seen', () => {
    const a = new AimLatch();
    a.press();
    a.update(true, 'toggle');
    a.cancel();
    expect(a.update(true, 'toggle')).toBe(false);
    a.press();
    a.cancel();
    expect(a.update(false, 'toggle')).toBe(false);
    a.press();
    expect(a.update(true, 'toggle')).toBe(true);
  });

  it('in play: right mouse toggles ADS (the same button scopes and works the Battle Rifle optic), a weapon change lets go, the touch Aim button follows the setting', async () => {
    const { InputState } = await import('../src/game/input.ts');
    const canvas = new EventTarget() as unknown as HTMLCanvasElement;
    (document as unknown as { pointerLockElement: unknown }).pointerLockElement = canvas;
    const input = new InputState(canvas);
    const mouse = (type: string, buttons: number) => window.dispatchEvent(Object.assign(new Event(type), { pointerType: 'mouse', buttons }));
    try {
      saveCombatPrefs({ aim: 'toggle' });
      mouse('pointerdown', 2);
      expect(input.sample().buttons & BUTTON_ZOOM).toBeTruthy();
      mouse('pointerup', 0);
      // Let go of the button: still aiming, and Shift holds breath rather than sprinting.
      window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'ShiftLeft', repeat: false }));
      const held = input.sample().buttons;
      expect(held & BUTTON_ZOOM).toBeTruthy();
      expect(held & BUTTON_SPRINT).toBeFalsy();
      window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'ShiftLeft' }));
      expect(input.zooming).toBe(true);
      // A second press stops.
      mouse('pointerdown', 2);
      mouse('pointerup', 0);
      expect(input.sample().buttons & BUTTON_ZOOM).toBeFalsy();
      // Aim again, then change weapons: the session cancels it.
      mouse('pointerdown', 2);
      mouse('pointerup', 0);
      expect(input.zooming).toBe(true);
      input.cancelAim();
      expect(input.zooming).toBe(false);
      // Hold: up stops at once.
      saveCombatPrefs({ aim: 'hold' });
      mouse('pointerdown', 2);
      expect(input.zooming).toBe(true);
      mouse('pointerup', 0);
      expect(input.zooming).toBe(false);
      // Touch's Aim button holds X while pressed and follows the setting (docs/MOBILE_AUDIT.md, proposal 3): Toggle
      // latches on a tap and the next tap lets go; Hold aims only while the finger is down.
      saveCombatPrefs({ aim: 'toggle' });
      input.setTouchEngaged(true);
      input.virtualKey('KeyX', true);
      input.virtualKey('KeyX', false);
      expect(input.zooming).toBe(true);
      input.virtualKey('KeyX', true);
      input.virtualKey('KeyX', false);
      expect(input.zooming).toBe(false);
      saveCombatPrefs({ aim: 'hold' });
      input.virtualKey('KeyX', true);
      expect(input.zooming).toBe(true);
      input.virtualKey('KeyX', false);
      expect(input.zooming).toBe(false);
    } finally {
      input.dispose();
      (document as unknown as { pointerLockElement: unknown }).pointerLockElement = null;
    }
  });
});

describe('camera shake', () => {
  it('Off, Reduced and Full keep none, about a third and all of it', () => {
    expect(SHAKE_SCALE).toEqual({ off: 0, reduced: 0.35, full: 1 });
    saveCombatPrefs({ shake: 'reduced' });
    expect(shakeScale()).toBe(0.35);
    saveCombatPrefs({ shake: 'off' });
    expect(shakeScale()).toBe(0);
  });

  it('scales the hit kick and its cap, on top of Reduce flashing (which keeps its own calmer shape)', () => {
    const full = addKick(null, 0, 1, 1, false, 1);
    const reduced = addKick(null, 0, 1, 1, false, 0.35);
    expect(reduced.pitch).toBeCloseTo(full.pitch * 0.35, 10);
    expect(addKick(null, 0, 1, 1, false, 0).pitch).toBe(0);
    let k = null;
    for (let i = 0; i < 20; i++) k = addKick(k, i * 0.05, 1, 0, false, 0.35);
    expect(k!.pitch).toBeLessThanOrEqual(HIT_KICK.max * 0.35 + 1e-12);
    const calmReduced = addKick(null, 0, 1, 1, true, 0.35);
    expect(calmReduced.pitch).toBeCloseTo(full.pitch * HIT_KICK.calmScale * 0.35, 10);
    expect(calmReduced.calm).toBe(true);
  });
});

describe('controller vibration', () => {
  it('heavy shots thump harder than an automatic\'s buzz, bigger blasts and harder hits rumble more', () => {
    expect(fireRumble(1.2, false).strong).toBeGreaterThan(fireRumble(0.5, true).strong);
    expect(fireRumble(0.5, true).duration).toBeLessThan(60);
    expect(blastRumble(1).strong).toBeGreaterThan(blastRumble(0.2).strong);
    expect(hitRumble(1).duration).toBeGreaterThan(hitRumble(0.1).duration);
    for (const e of [fireRumble(1.5, false), hitRumble(5), blastRumble(3)]) {
      expect(e.strong).toBeLessThanOrEqual(1);
      expect(e.weak).toBeLessThanOrEqual(1);
    }
  });

  it('off: nothing; the strength scales both motors', () => {
    const e = blastRumble(1);
    expect(scaledRumble(e, { ...DEFAULT_COMBAT_PREFS, vibration: false })).toBeNull();
    const half = scaledRumble(e, { ...DEFAULT_COMBAT_PREFS, vibrationStrength: 0.5 })!;
    expect(half.strong).toBeCloseTo(e.strong * 0.5, 10);
    expect(half.weak).toBeCloseTo(e.weak * 0.5, 10);
    expect(half.duration).toBe(Math.round(e.duration));
  });
});
