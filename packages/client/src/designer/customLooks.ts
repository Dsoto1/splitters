import { decodeLook } from '@chronosplit/shared';

/** A look made in the Character Designer, saved in this browser. */
export interface SavedLook {
  /** Custom look ID (encodeLook). */
  id: string;
  name: string;
}

const KEY = 'cs.customLooks';
const MAX_SAVED = 24;

export function listCustomLooks(): SavedLook[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is SavedLook => typeof x?.id === 'string' && typeof x?.name === 'string' && decodeLook(x.id) !== null).slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function write(list: SavedLook[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
  } catch {
    // Storage unavailable (private mode): the look is still used for this session.
  }
}

/** Save (or rename) a look; the newest comes first. */
export function saveCustomLook(look: SavedLook): void {
  write([look, ...listCustomLooks().filter((s) => s.id !== look.id)]);
}

export function deleteCustomLook(id: string): void {
  write(listCustomLooks().filter((s) => s.id !== id));
}
