// Combat accessibility (game/combatPrefs.ts, game/rumble.ts; GUNPLAY_SPEC §42): aim held or toggled, camera shake,
// controller vibration; saved with the other options.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BUTTON_ZOOM, BUTTON_SPRINT } from '@tiletrigger/shared';
import { AimLatch, COMBAT_PREFS_EVENT, DEFAULT_COMBAT_PREFS, SHAKE_SCALE, combatPrefs, loadCombatPrefs, parseCombatPrefs, resetCombatPrefsCache, saveCombatPrefs, shakeScale } from '../src/game/combatPrefs.ts';
import { blastRumble, fireRumble, hitRumble, rumble, scaledRumble, vibrationSupported } from '../src/game/rumble.ts';
import { CRASH_REACH, SHAKE_MS, addShake, blastReach, blastShake, crashShake, rollScale, shakeLeft, shotShake } from '../src/game/cameraShake.ts';
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
      // A scoped gun in hand (the session sets it).
      input.breathScope = true;
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
      // Touch's Aim button holds the aim action while pressed and follows the setting (docs/MOBILE_AUDIT.md, proposal 3): Toggle
      // latches on a tap and the next tap lets go; Hold aims only while the finger is down.
      saveCombatPrefs({ aim: 'toggle' });
      input.setTouchEngaged(true);
      input.virtualAction('aim', true);
      input.virtualAction('aim', false);
      expect(input.zooming).toBe(true);
      input.virtualAction('aim', true);
      input.virtualAction('aim', false);
      expect(input.zooming).toBe(false);
      saveCombatPrefs({ aim: 'hold' });
      input.virtualAction('aim', true);
      expect(input.zooming).toBe(true);
      input.virtualAction('aim', false);
      expect(input.zooming).toBe(false);
    } finally {
      input.dispose();
      (document as unknown as { pointerLockElement: unknown }).pointerLockElement = null;
    }
  });
});

describe('aim: a toggled aim and sprinting', () => {
  it('Shift (or a controller\'s L3) lets a toggled aim go so you sprint; not with a scope or optic, where it holds your breath; held aim still wins', async () => {
    const { InputState } = await import('../src/game/input.ts');
    const canvas = new EventTarget() as unknown as HTMLCanvasElement;
    (document as unknown as { pointerLockElement: unknown }).pointerLockElement = canvas;
    const input = new InputState(canvas);
    const mouse = (type: string, buttons: number) => window.dispatchEvent(Object.assign(new Event(type), { pointerType: 'mouse', buttons }));
    const key = (type: string, code: string) => window.dispatchEvent(Object.assign(new Event(type), { code, repeat: false }));
    try {
      saveCombatPrefs({ aim: 'toggle' });
      // Iron sights: aim, then Shift: the aim lets go and you sprint (forward held).
      key('keydown', 'KeyW');
      mouse('pointerdown', 2);
      mouse('pointerup', 0);
      expect(input.sample().buttons & BUTTON_ZOOM).toBeTruthy();
      key('keydown', 'ShiftLeft');
      let b = input.sample().buttons;
      expect(b & BUTTON_ZOOM).toBeFalsy();
      expect(b & BUTTON_SPRINT).toBeTruthy();
      key('keyup', 'ShiftLeft');
      // A press of aim while sprinting aims again (and stops the sprint).
      mouse('pointerdown', 2);
      mouse('pointerup', 0);
      key('keydown', 'ShiftLeft');
      // Shift was pressed after the aim: it lets go again.
      expect(input.sample().buttons & BUTTON_ZOOM).toBeFalsy();
      key('keyup', 'ShiftLeft');
      // A scope or optic in hand: Shift holds your breath, the aim stays.
      input.breathScope = true;
      mouse('pointerdown', 2);
      mouse('pointerup', 0);
      key('keydown', 'ShiftLeft');
      b = input.sample().buttons;
      expect(b & BUTTON_ZOOM).toBeTruthy();
      expect(b & BUTTON_SPRINT).toBeFalsy();
      expect(input.holdingBreath).toBe(true);
      key('keyup', 'ShiftLeft');
      input.cancelAim();
      input.breathScope = false;
      // Hold: Shift doesn't take the aim while the button is down.
      saveCombatPrefs({ aim: 'hold' });
      mouse('pointerdown', 2);
      key('keydown', 'ShiftLeft');
      b = input.sample().buttons;
      expect(b & BUTTON_ZOOM).toBeTruthy();
      expect(b & BUTTON_SPRINT).toBeFalsy();
      key('keyup', 'ShiftLeft');
      mouse('pointerup', 0);
      key('keyup', 'KeyW');
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

  it('every source goes through the setting: Off keeps no shake at all, Reduced about a third, Full all of it', () => {
    // The sources (cameraShake.ts): a blast, a vehicle going up, a vehicle crash, a heavy shot.
    const sources = { blast: blastShake(1, false), vehicle: blastShake(1, true), crash: crashShake(1, 1), heavyShot: shotShake(1.2) };
    for (const [name, amount] of Object.entries(sources)) {
      expect(amount, name).toBeGreaterThan(0);
      expect(addShake(0, amount, SHAKE_SCALE.off), name).toBe(0);
      expect(addShake(0, amount, SHAKE_SCALE.reduced), name).toBeCloseTo(amount * 0.35, 10);
      expect(addShake(0, amount, SHAKE_SCALE.full), name).toBeCloseTo(amount, 10);
      // Off also drops a shake still settling (the setting changed mid-shake).
      expect(addShake(0.5, amount, 0), name).toBe(0);
    }
    // Shakes add up to the setting's share, and settle to nothing over SHAKE_MS.
    expect(addShake(0.3, 0.95, SHAKE_SCALE.reduced)).toBe(0.35);
    expect(addShake(0.9, 0.95, 1)).toBe(1);
    expect(shakeLeft(0.8, SHAKE_MS / 2)).toBeCloseTo(0.4, 10);
    expect(shakeLeft(0.8, SHAKE_MS)).toBe(0);
    // The setting read now (no scale passed): Off is none.
    saveCombatPrefs({ shake: 'off' });
    expect(addShake(0, blastShake(1, true))).toBe(0);
    saveCombatPrefs({ shake: 'full' });
    expect(addShake(0, blastShake(1, true))).toBeCloseTo(0.95, 10);
  });

  it('each source\'s reach and size: far blasts and crashes, automatics and light guns shake nothing', () => {
    expect(blastShake(0, false)).toBe(0);
    expect(blastShake(-0.2, true)).toBe(0);
    expect(blastReach(4, true)).toBeGreaterThan(blastReach(4, false));
    expect(crashShake(0, 1)).toBe(0);
    expect(CRASH_REACH).toBe(12);
    expect(shotShake(0.5)).toBe(0);
    expect(shotShake(0.79)).toBe(0);
    expect(shotShake(5)).toBe(0.25);
  });

  it('the view\'s roll (leaning, a zipline) follows the setting, and none with the system\'s reduce motion', () => {
    expect(rollScale(SHAKE_SCALE.off, false)).toBe(0);
    expect(rollScale(SHAKE_SCALE.reduced, false)).toBe(0.35);
    expect(rollScale(SHAKE_SCALE.full, false)).toBe(1);
    expect(rollScale(SHAKE_SCALE.full, true)).toBe(0);
  });

  it('the game moves the camera only through these: no shake source bypasses the setting', async () => {
    const { readFileSync } = await import('node:fs');
    const src = (f: string) => readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8');
    const session = src('session.ts');
    const view = src('view.ts');
    // Every shake call in the session passes one of cameraShake.ts's amounts.
    const calls = session.match(/this\.view\.shake\(([^;]*)\);/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const c of calls) expect(c).toMatch(/view\.shake\((blastShake|crashShake|jolt)\b/);
    // The view's shake and hit kick read the setting; its camera is posed only in setCamera.
    expect(/this\.shakeAmount = addShake\(/.test(view)).toBe(true);
    expect(/addKick\(.*, amount\);/.test(view)).toBe(true);
    expect(view.match(/poseCamera\(this\.camera/g)?.length).toBe(2);
    // The lean and zipline roll are scaled.
    expect(session.match(/rollScale\(\)/g)?.length).toBe(2);
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

  it('a mocked controller: rumbles only when one is in use and the setting is on, at the player\'s strength; fails silently', () => {
    const played: { type: string; p: { duration: number; strongMagnitude: number; weakMagnitude: number } }[] = [];
    const pulses: [number, number][] = [];
    let pads: unknown[] = [];
    const nav = { getGamepads: () => pads };
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: nav });
    const dual = { connected: true, mapping: 'standard', vibrationActuator: { playEffect: (type: string, p: (typeof played)[number]['p']) => (played.push({ type, p }), Promise.resolve('complete')) } };
    try {
      pads = [dual];
      saveCombatPrefs({ vibration: true, vibrationStrength: 0.5 });
      rumble(blastRumble(1), true);
      expect(played).toHaveLength(1);
      expect(played[0]!.type).toBe('dual-rumble');
      expect(played[0]!.p.strongMagnitude).toBeCloseTo(blastRumble(1).strong * 0.5, 10);
      // No controller used this page: nothing.
      rumble(blastRumble(1), false);
      expect(played).toHaveLength(1);
      // Vibration off: nothing, for firing, hits and blasts alike.
      saveCombatPrefs({ vibration: false });
      for (const e of [fireRumble(1.2, false), hitRumble(1), blastRumble(1)]) rumble(e, true);
      expect(played).toHaveLength(1);
      saveCombatPrefs({ vibration: true });
      rumble(fireRumble(1.2, false), true);
      rumble(hitRumble(1), true);
      expect(played).toHaveLength(3);
      // The older single-motor haptics (Firefox) pulse instead.
      pads = [null, { connected: true, mapping: 'standard', hapticActuators: [{ pulse: (v: number, ms: number) => (pulses.push([v, ms]), Promise.resolve(true)) }] }];
      rumble(hitRumble(1), true);
      expect(pulses).toHaveLength(1);
      expect(pulses[0]![0]).toBeGreaterThan(0);
      // A controller that can't vibrate, one that throws or refuses, a browser with no gamepads: silent.
      pads = [{ connected: true, mapping: 'standard' }];
      expect(() => rumble(blastRumble(1), true)).not.toThrow();
      pads = [{ connected: true, mapping: 'standard', vibrationActuator: { playEffect: () => { throw new Error('no'); } } }];
      expect(() => rumble(blastRumble(1), true)).not.toThrow();
      pads = [{ connected: true, mapping: 'standard', vibrationActuator: { playEffect: () => Promise.reject(new Error('refused')) } }];
      expect(() => rumble(blastRumble(1), true)).not.toThrow();
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
      expect(() => rumble(blastRumble(1), true)).not.toThrow();
      expect(vibrationSupported()).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
  });
});
