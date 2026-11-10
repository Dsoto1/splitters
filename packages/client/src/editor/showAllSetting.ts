/**
 * MapMaker's "Show all levels" as the player left it (owner, 2026-11-10: it was a small checkbox nobody found, and
 * off again every visit). Browser storage can be missing (private windows): then it is simply not remembered.
 */
const KEY = 'tt.editor.showAllLevels';

export function rememberedShowAll(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberShowAll(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered.
  }
}
