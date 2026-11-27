// The touch controls' layout (game/touchLayout.ts; docs/MOBILE_AUDIT.md, proposal 3): button size, opacity,
// left-handed; and a phone's Aim default (combatPrefs.ts: Toggle on touch).
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TOUCH_LAYOUT, TOUCH_LAYOUT_EVENT, defaultTouchSize, applyTouchLayout, parseTouchLayout, resetTouchLayoutCache, saveTouchLayout, touchLayout, touchScale } from '../src/game/touchLayout.ts';
import { DEFAULT_COMBAT_PREFS, TOUCH_COMBAT_DEFAULTS, parseCombatPrefs } from '../src/game/combatPrefs.ts';

const store = new Map<string, string>();
let fired = 0;
beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= new EventTarget();
  window.addEventListener(TOUCH_LAYOUT_EVENT, () => fired++);
});
beforeEach(() => {
  store.clear();
  fired = 0;
  resetTouchLayoutCache();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
});

describe('touch layout', () => {
  it('defaults to Medium (no screen to go by), fully drawn, right-handed', () => {
    expect(touchLayout()).toEqual(DEFAULT_TOUCH_LAYOUT);
    expect(DEFAULT_TOUCH_LAYOUT).toEqual({ size: 'medium', sizeChosen: false, opacity: 1, leftHanded: false });
  });

  it('picks Small on a phone and Medium on a tablet by the screen\'s short side, until the player picks', () => {
    // iPhone SE, iPhone 13/14, Pixel 7, an iPhone Pro Max, either way up; then an iPad mini and a big tablet.
    for (const [w, h] of [[375, 667], [390, 844], [844, 390], [412, 915], [430, 932]] as const) expect(defaultTouchSize(w, h)).toBe('small');
    for (const [w, h] of [[744, 1133], [1024, 1366], [1366, 1024]] as const) expect(defaultTouchSize(w, h)).toBe('medium');
    expect(parseTouchLayout(null, 'small')).toEqual({ ...DEFAULT_TOUCH_LAYOUT, size: 'small' });
    // A saved pick wins over the screen's.
    expect(parseTouchLayout('{"size":"large"}', 'small')).toMatchObject({ size: 'large', sizeChosen: true });
  });

  it('saves a change, keeps the rest, and tells the page', () => {
    saveTouchLayout({ size: 'large' });
    saveTouchLayout({ leftHanded: true, opacity: 0.55 });
    expect(touchLayout()).toEqual({ size: 'large', sizeChosen: true, opacity: 0.55, leftHanded: true });
    expect(fired).toBe(2);
    resetTouchLayoutCache();
    expect(touchLayout()).toEqual({ size: 'large', sizeChosen: true, opacity: 0.55, leftHanded: true });
  });

  it('saves no size until one is picked: the opacity alone leaves it following the screen', () => {
    saveTouchLayout({ opacity: 0.7 });
    expect(JSON.parse(store.get('tiletrigger.touchLayout')!)).toEqual({ opacity: 0.7, leftHanded: false });
    expect(touchLayout()).toMatchObject({ sizeChosen: false, opacity: 0.7 });
  });

  it('reads damaged or unknown values as the defaults, and keeps opacity within 30-100 %', () => {
    expect(parseTouchLayout('{nope')).toEqual(DEFAULT_TOUCH_LAYOUT);
    expect(parseTouchLayout('{"size":"huge","opacity":"x","leftHanded":1}')).toEqual(DEFAULT_TOUCH_LAYOUT);
    expect(parseTouchLayout('{"opacity":0.01}').opacity).toBe(0.3);
    expect(parseTouchLayout('{"opacity":7}').opacity).toBe(1);
  });

  it('scales Small and Medium as chosen; holds Large back on short screens, never under Medium', () => {
    for (const h of [320, 360, 412, 915]) {
      expect(touchScale('small', h)).toBe(0.85);
      expect(touchScale('medium', h)).toBe(1);
    }
    expect(touchScale('large', 412)).toBe(1.2);
    expect(touchScale('large', 360)).toBeLessThan(1.2);
    expect(touchScale('large', 360)).toBeGreaterThan(1);
    expect(touchScale('large', 320)).toBe(1);
    // The cluster (230 px at Medium) leaves 90 px above it.
    for (const h of [320, 340, 360, 384, 412]) expect(230 * touchScale('large', h)).toBeLessThanOrEqual(Math.max(230, h - 90) + 2.5);
  });

  it('puts the scale, opacity and side on the page root', () => {
    const props = new Map<string, string>();
    const classes = new Set<string>();
    const root = {
      style: { setProperty: (k: string, v: string) => void props.set(k, v) },
      classList: { toggle: (c: string, on: boolean) => void (on ? classes.add(c) : classes.delete(c)) },
    } as unknown as HTMLElement;
    applyTouchLayout(root, { size: 'small', sizeChosen: true, opacity: 0.6, leftHanded: true }, 412);
    expect(props.get('--tc-scale')).toBe('0.85');
    expect(props.get('--tc-opacity')).toBe('0.6');
    expect(classes.has('tc-left')).toBe(true);
    applyTouchLayout(root, DEFAULT_TOUCH_LAYOUT, 412);
    expect(classes.has('tc-left')).toBe(false);
  });
});

describe("a phone's Aim", () => {
  it('toggles by default on touch, holds elsewhere; a saved choice wins either way', () => {
    expect(TOUCH_COMBAT_DEFAULTS.aim).toBe('toggle');
    expect(DEFAULT_COMBAT_PREFS.aim).toBe('hold');
    expect(parseCombatPrefs(null, TOUCH_COMBAT_DEFAULTS).aim).toBe('toggle');
    expect(parseCombatPrefs('{"aim":"hold"}', TOUCH_COMBAT_DEFAULTS).aim).toBe('hold');
    expect(parseCombatPrefs(null).aim).toBe('hold');
  });
});
