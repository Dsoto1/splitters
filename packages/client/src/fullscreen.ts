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
    if (!document.pointerLockElement) unlockedAt = performance.now();
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
