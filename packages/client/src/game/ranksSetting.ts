/**
 * Ranks & badges (Options and the pause menu's Settings; owner, 2026-11-18): off by default. Off, names are plain and
 * the marker over a head is the arrow, as before 11-18 (an Army bot's "Sgt. Dunmore" shows as "Dunmore"). On, every
 * player and bot wears a rank, its title before the name and its group's badge (shared content/ranks.ts,
 * game/rankBook.ts). Tiny, so the menu may read it; the ranks themselves load with the match.
 */
const KEY = 'tiletrigger.ranks';
/** Fired on window when the setting changes (Options and the pause menu show it; a running match applies it at once). */
export const RANKS_EVENT = 'tiletrigger:ranks';

let current: boolean | null = null;

/** Whether ranks and badges are shown (off unless switched on). */
export function ranksOn(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(KEY) === '1';
    } catch {
      current = false;
    }
  }
  return current;
}

export function saveRanksOn(on: boolean): void {
  current = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: this page only.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RANKS_EVENT));
}

/** Tests: forget the value read. */
export function resetRanksCache(): void {
  current = null;
}
