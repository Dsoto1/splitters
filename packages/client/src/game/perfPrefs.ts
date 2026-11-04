/** The performance overlay's switch (F3, Options → Display), on its own so the menu doesn't load the overlay. */
const PREF = 'tiletrigger.perfOverlay';

export function loadPerfOverlay(): boolean {
  try {
    return localStorage.getItem(PREF) === '1';
  } catch {
    return false;
  }
}

export function savePerfOverlay(on: boolean): void {
  try {
    localStorage.setItem(PREF, on ? '1' : '0');
  } catch {
    // Private mode: it just isn't remembered.
  }
}
