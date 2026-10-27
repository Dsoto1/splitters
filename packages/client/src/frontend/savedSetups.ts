import type { MatchSetup } from '@tiletrigger/shared';

/**
 * Named match setups kept in this browser (Play → match setup → Saved
 * setups). The setup in use is remembered on its own (`cs.arcade`); this is
 * the list the player saved by name, and which one they loaded last.
 */
const KEY = 'cs.setups';
const LAST = 'cs.setups.last';
/** Most setups kept (the oldest go first). */
const MAX_SAVED = 40;

export interface SavedSetup {
  name: string;
  setup: MatchSetup;
  savedAt: string;
}

function read(): SavedSetup[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is SavedSetup => typeof x === 'object' && x !== null && typeof (x as SavedSetup).name === 'string' && typeof (x as SavedSetup).setup === 'object') : [];
  } catch {
    return [];
  }
}

function write(list: SavedSetup[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_SAVED)));
    return true;
  } catch {
    return false;
  }
}

export const listSetups = (): SavedSetup[] => read();

/** Save (or overwrite) a setup by name; false when storage is unavailable or full. */
export function saveSetupAs(name: string, setup: MatchSetup): boolean {
  const clean = name.trim().slice(0, 40);
  if (!clean) return false;
  const list = read().filter((s) => s.name !== clean);
  list.push({ name: clean, setup: JSON.parse(JSON.stringify(setup)) as MatchSetup, savedAt: new Date().toISOString() });
  const ok = write(list);
  if (ok) setLastSetup(clean);
  return ok;
}

export function deleteSetup(name: string): void {
  write(read().filter((s) => s.name !== name));
  if (lastSetup() === name) setLastSetup(null);
}

/** The saved setup loaded or saved last (null: none, or the setup has changed since). */
export function lastSetup(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

export function setLastSetup(name: string | null): void {
  try {
    if (name) localStorage.setItem(LAST, name);
    else localStorage.removeItem(LAST);
  } catch {
    // No storage: nothing to remember.
  }
}
