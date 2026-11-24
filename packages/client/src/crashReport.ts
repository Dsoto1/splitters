import { testMode } from './testMode.ts';

/**
 * Crash and error reports (docs/CRASH_REPORTS.md): when the game breaks (an uncaught error or rejection, a lost
 * graphics context that doesn't come back, the game not drawing for 30 s while on screen), a small panel offers
 * "Send report / Dismiss". Nothing is sent unless the player presses Send. This part stays in the menu bundle and only
 * listens; the panel and the scrubbing load on the first break (crashPanel.ts).
 *
 * Off in browser tests (?test=1) unless asked for with &crashpanel=1, so a test's own failures stay its own.
 */
export type CrashScreen = 'menu' | 'game' | 'editor' | 'designer' | 'other';
export interface CrashContext {
  /** A suite map's ID, "custom", or null outside a match. */
  map: string | null;
  mode: string | null;
  screen: CrashScreen;
  /** Words cut out of a report wherever they appear (the player's own name). */
  privateWords: () => string[];
}

export const crashContext: CrashContext = { map: null, mode: null, screen: 'menu', privateWords: () => [] };

export function setCrashContext(c: Partial<CrashContext>): void {
  Object.assign(crashContext, c);
}

let on = false;
/** When the page last became visible or hidden (performance.now()). */
let visibilityAt = 0;

/** Offer a report of a break (the panel decides whether this one was already offered). */
export function reportBreak(kind: 'error' | 'rejection' | 'webgl' | 'freeze', err: unknown): void {
  if (!on) return;
  const e = err as { name?: unknown; message?: unknown; stack?: unknown } | null | undefined;
  const message = err instanceof Error ? `${err.name}: ${err.message}` : typeof e?.message === 'string' ? e.message : String(err);
  const stack = typeof e?.stack === 'string' ? e.stack : '';
  void import('./crashPanel.ts').then((m) => m.offerReport({ kind, message, stack }), () => undefined);
}

/** Not breaks: a resize observer's notice, another origin's script, a fetch or sound the browser stopped. */
function ignored(err: unknown, message: string): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return /ResizeObserver loop|^Script error\.?$/.test(message) || name === 'AbortError' || name === 'NotAllowedError' || name === 'TimeoutError';
}

export function installCrashReports(): void {
  on = !testMode() || new URLSearchParams(location.search).get('crashpanel') === '1';
  if (!on) return;
  window.addEventListener('error', (e) => {
    // An extension's or another site's script: not ours to report.
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    if (!ignored(e.error, e.message)) reportBreak('error', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (!ignored(e.reason, String((e.reason as { message?: unknown } | null)?.message ?? e.reason))) reportBreak('rejection', e.reason);
  });
  document.addEventListener('visibilitychange', () => (visibilityAt = performance.now()));
}

/** A lost WebGL context that hasn't come back after 20 s (on screen) is a break; one that comes back isn't. */
export function watchGlContext(canvas: HTMLCanvasElement): void {
  let timer = 0;
  canvas.addEventListener('webglcontextlost', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => document.visibilityState === 'visible' && reportBreak('webgl', new Error('WebGL context lost and not restored after 20 s')), 20_000);
  });
  canvas.addEventListener('webglcontextrestored', () => window.clearTimeout(timer));
}

/** The time between two drawn frames: 30 s or more while the page stayed on screen is a freeze. */
export function noteFrameGap(ms: number): void {
  if (ms < 30_000 || !on || document.visibilityState !== 'visible' || visibilityAt > performance.now() - ms) return;
  reportBreak('freeze', new Error(`the game stopped drawing for ${Math.round(ms / 1000)} s`));
}
