/**
 * Fullscreen for the whole app (menus, MapMaker and matches). Entered from the
 * pause menu, Options, or F11 / Alt+Enter. While fullscreen, Esc is held by the
 * page (Keyboard Lock, where the browser has it) so a quick Esc pauses the game
 * instead of dropping out of fullscreen; holding Esc still leaves.
 */
type KeyboardLock = { lock?: (codes?: string[]) => Promise<void>; unlock?: () => void };

const keyboard = (): KeyboardLock | undefined => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;

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
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await keyboard()?.lock?.(['Escape']);
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

/** F11 and Alt+Enter toggle fullscreen anywhere in the app. */
export function installFullscreenKeys(): void {
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
