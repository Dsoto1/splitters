import { BROWSER_MAX_PLAYERS } from '@tiletrigger/shared';

/**
 * Phones and tablets: a coarse pointer with no hover (a finger), or touch
 * points and no mouse. They get the on-screen controls (game/touchControls.ts),
 * bigger tap targets, no pointer lock, and on phones lighter defaults (low graphics, a
 * lower render scale, fewer players when hosting). `?touch=1` / `?touch=0`
 * force it either way (tests, and a laptop with a touch screen).
 */
let cached: boolean | null = null;

export function isTouchDevice(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return (cached = false);
  const force = new URLSearchParams(window.location?.search ?? '').get('touch');
  if (force === '1' || force === '0') return (cached = force === '1');
  const media = (q: string) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  // A touch laptop has a fine pointer that hovers (its trackpad): it plays with the mouse.
  cached = media('(pointer: coarse)') && !media('(any-pointer: fine)') ? true : media('(hover: none)') && (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
  return cached;
}

/**
 * A tablet: a touch device whose screen's short side is at least 600 CSS px (an iPad, a large
 * Android tablet). Tablets draw a sharp picture well, so they start on Medium graphics and the
 * Auto render scale; phones keep Low and 75 % (owner, 2026-11-28, on an iPad: "medium with
 * auto looks and plays much better" than High at 75 %). `?tablet=1` / `?tablet=0` force it.
 */
export function isTablet(): boolean {
  if (!isTouchDevice()) return false;
  if (typeof window === 'undefined') return false;
  const force = new URLSearchParams(window.location?.search ?? '').get('tablet');
  if (force === '1' || force === '0') return force === '1';
  const sc = window.screen;
  const short = sc ? Math.min(sc.width, sc.height) : Math.min(window.innerWidth, window.innerHeight);
  return short >= 600;
}

/** Most players a match hosted in this browser may hold: a phone hosts a smaller game (its CPU runs the bots and the sim). */
export const PHONE_MAX_PLAYERS = 16;
export function deviceMaxPlayers(): number {
  return isTouchDevice() ? PHONE_MAX_PLAYERS : BROWSER_MAX_PLAYERS;
}

/** Marks the page (`html.touch`) so the stylesheet can size things for fingers. */
export function markTouchDevice(): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('touch', isTouchDevice());
}
