/** The Show hitboxes switch (a dev and test setting; game/hitboxOverlay.ts), on its own so the menu doesn't load the overlay. */
import { allowedHere } from '../testMode.ts';

const PREF = 'tiletrigger.hitboxes';

/** Whether this page may show the overlay at all (a dev server, a test build or a page served from this machine). */
export const hitboxOverlayAllowed = (): boolean => allowedHere();

export function loadHitboxOverlay(): boolean {
  if (!allowedHere()) return false;
  try {
    if (new URLSearchParams(location.search).get('hitboxes') === '1') return true;
    return localStorage.getItem(PREF) === '1';
  } catch {
    return false;
  }
}

export function saveHitboxOverlay(on: boolean): void {
  try {
    localStorage.setItem(PREF, on ? '1' : '0');
  } catch {
    // Private mode: it just isn't remembered.
  }
}

