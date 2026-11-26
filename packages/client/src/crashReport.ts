import { testMode } from './testMode.ts';

/**
 * Crash and error reports (docs/CRASH_REPORTS.md): when the game breaks (an uncaught error or rejection, a lost
 * graphics context that doesn't come back), a small panel offers
 * "Send report / Dismiss". Nothing is sent unless the player presses Send. This part is in the menu's first JS, so it
 * only listens (kept tiny: the menu bundle's budget); the panel, the filtering and the scrubbing load on the first
 * break (crashPanel.ts).
 *
 * Off in browser tests (?test=1) unless asked for with &crashpanel=1, so a test's own failures stay its own.
 */
export type CrashScreen = 'menu' | 'game' | 'editor' | 'other';
export type BreakKind = 'error' | 'rejection' | 'webgl' | 'freeze';
export interface CrashContext {
  /** The last match's map (a suite map's ID or "custom") and mode: reported only while `screen` is 'game'. */
  map: string | null;
  mode: string | null;
  screen: CrashScreen;
}

export const crashContext: CrashContext = { map: null, mode: null, screen: 'menu' };

let on = false;

/**
 * Offer a report of a break: `what` is the ErrorEvent, the rejection's reason, or for 'webgl' the seconds it lasted.
 * The panel decides whether it is one (crashPanel.ts breakOf) and whether it was offered already. ('freeze', the
 * game not drawing for a long time while on screen, is understood by the panel but not watched for yet: the menu
 * bundle had no room for the watch.)
 */
export function reportBreak(kind: BreakKind, what: unknown): void {
  if (on) import('./crashPanel.ts').then((m) => m.offerBreak(kind, what), () => 0);
}

export function installCrashReports(): void {
  on = !testMode() || location.search.includes('crashpanel=1');
  if (!on) return;
  addEventListener('error', (e) => reportBreak('error', e));
  addEventListener('unhandledrejection', (e) => reportBreak('rejection', e.reason));
}

/** A lost WebGL context that hasn't come back after 20 s (on screen) is a break; one that comes back isn't. */
export function watchGlContext(canvas: HTMLCanvasElement): void {
  let timer = 0;
  canvas.addEventListener('webglcontextlost', () => {
    clearTimeout(timer);
    timer = setTimeout(() => document.hidden || reportBreak('webgl', 20), 20_000) as unknown as number;
  });
  canvas.addEventListener('webglcontextrestored', () => clearTimeout(timer));
}
