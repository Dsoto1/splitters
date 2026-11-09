import { parseClipboard, type MapClipboard } from '@tiletrigger/shared';

/**
 * MapMaker's clipboard in this browser's local storage (MapMaker overhaul Phase 3 item 4; the copy and paste
 * themselves: shared editor/clipboard.ts). Local storage, like saved maps: nothing is uploaded, and another tab or
 * another map in this browser pastes the same copy.
 */
const KEY = 'tiletrigger.editor.clipboard';

/** Keep a copy; false when storage is full or blocked. */
export function writeClipboard(c: MapClipboard): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

/** The copy kept in this browser, or null (none, or not one this build reads). */
export function readClipboard(): MapClipboard | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseClipboard(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
