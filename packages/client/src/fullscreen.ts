/**
 * Fullscreen for the whole app (menus, MapMaker and matches). Entered from the
 * pause menu, Options, or F11 / Alt+Enter. While fullscreen, Esc is held by the
 * page (Keyboard Lock, where the browser has it) so a quick Esc pauses the game
 * instead of dropping out of fullscreen; holding Esc still leaves.
 */
type KeyboardLock = { lock?: (codes?: string[]) => Promise<void>; unlock?: () => void };

const keyboard = (): KeyboardLock | undefined => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;

/** Esc is held by the page (Chrome's Keyboard Lock in fullscreen), so the game must release the mouse itself. */
let escapeHeld = false;
export const pageHoldsEscape = (): boolean => escapeHeld && isFullscreen();

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

export function fullscreenSupported(): boolean {
  return document.fullscreenEnabled === true;
}

/** Toggle fullscreen; must be called from a click or key press. */
export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) {
      keyboard()?.unlock?.();
      escapeHeld = false;
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      const lock = keyboard()?.lock;
      if (lock) {
        await lock.call(keyboard(), ['Escape']);
        escapeHeld = true;
      }
    }
  } catch {
    // Refused (not from a gesture, or blocked by the page's host): nothing to do.
  }
}

/** Buttons that read "Fullscreen" / "Exit fullscreen" as the state changes. */
export function bindFullscreenButton(button: HTMLButtonElement, signal?: AbortSignal): void {
  const label = () => (button.textContent = isFullscreen() ? 'Exit fullscreen' : 'Fullscreen');
  label();
  button.hidden = !fullscreenSupported();
  button.addEventListener('click', () => void toggleFullscreen(), { signal });
  // Buttons on rebuilt screens just disappear, so the listener drops itself once its button is gone.
  const onChange = () => (button.isConnected || signal ? label() : document.removeEventListener('fullscreenchange', onChange));
  document.addEventListener('fullscreenchange', onChange, { signal });
}

/** When fullscreen last ended and when the mouse was last released (performance.now()), for `browserTookEscape`. */
let fullscreenEndedAt = -1e9;
let unlockedAt = -1e9;
/** The page let the mouse go itself (releasePointer): that release is no Esc the browser took. */
let pageReleased = false;
/** Bumped whenever the page lets the mouse go: a request for it made before is stale (pointerWanted). */
let pointerEpoch = 0;

/**
 * The page lets the mouse go itself (a window over the pause menu needs it): any request for the mouse still under
 * way is dropped (pointerWanted), and the release doesn't count as an Esc the browser took (`browserTookEscape`), so
 * the next Esc acts on the menu.
 */
export function releasePointer(): void {
  pointerEpoch++;
  if (!document.pointerLockElement) return;
  pageReleased = true;
  document.exitPointerLock();
}

/** The current request for the mouse, for `pointerWanted`: taken when the page asks for it. */
export const pointerAsk = (): number => pointerEpoch;
/** Whether a request for the mouse (its `pointerAsk`) still stands: the page hasn't let the mouse go since. */
export const pointerWanted = (ask: number): boolean => ask === pointerEpoch;

/** The canvas's pointer-lock call: the raw-mouse form, or the plain one (a promise in today's browsers, nothing in old ones). */
type LockTarget = { requestPointerLock(o?: { unadjustedMovement?: boolean }): Promise<void> | void };

/**
 * Asks for the mouse on `canvas`: raw movement (no OS acceleration) where the browser has it; Safari and older ones
 * refuse the option, so ask again plainly, unless the page has let the mouse go since (a window opened over the
 * pause menu: a late lock would hide the menu under it, the hostcontrols flake), or the refusal was a
 * WrongDocumentError (the canvas's page isn't active: a click as the tab or window lost focus, or the canvas left the
 * page; a plain retry is refused the same way, and the next click asks again). The plain retry's own refusal is caught
 * too: a failed lock is no error (crash report 1d50cff7, an unhandled WrongDocumentError).
 */
export function requestMouse(canvas: LockTarget): void {
  const ask = pointerAsk();
  let raw: Promise<void> | void;
  try {
    raw = canvas.requestPointerLock({ unadjustedMovement: true });
  } catch {
    return;
  }
  if (!(raw instanceof Promise)) return;
  raw.catch((e: unknown) => {
    if ((e as { name?: string } | null)?.name === 'WrongDocumentError' || !pointerWanted(ask)) return;
    try {
      const plain = canvas.requestPointerLock();
      if (plain instanceof Promise) plain.catch(() => undefined);
    } catch {
      // An old browser that throws: the next click asks again.
    }
  });
}

/**
 * This Esc press isn't the page's to act on: the browser leaves fullscreen with it (fullscreen without
 * Keyboard Lock, e.g. Safari) or just did, the browser released the mouse with it a moment ago, or it is a
 * held Esc repeating (Chrome leaves fullscreen when Esc is held). Menus go back one level per press, so they
 * skip these: one Esc never both leaves fullscreen and moves the menu, nor jumps several levels.
 */
export function browserTookEscape(e: KeyboardEvent): boolean {
  if (e.key !== 'Escape' && e.code !== 'Escape') return false;
  if (e.repeat) return true;
  if (isFullscreen() && !pageHoldsEscape()) return true;
  const t = performance.now();
  return t - fullscreenEndedAt < 500 || t - unlockedAt < 250;
}

/** F11 and Alt+Enter toggle fullscreen anywhere in the app. */
export function installFullscreenKeys(): void {
  document.addEventListener('fullscreenchange', () => {
    if (isFullscreen()) return;
    fullscreenEndedAt = performance.now();
    escapeHeld = false;
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) return;
    if (!pageReleased) unlockedAt = performance.now();
    pageReleased = false;
  });
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) {
        e.preventDefault();
        void toggleFullscreen();
      }
    },
    { capture: true },
  );
}
