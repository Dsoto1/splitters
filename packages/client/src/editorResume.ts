/**
 * Back to MapMaker after a reload (QUEUE bug, owner 2026-11-15). A long session can wear the tab down until a reload
 * (or Chrome's "Aw, Snap!") is the way out, and that used to land on the main menu. While MapMaker is open (its Test
 * included) this tab's session storage names the map being made; a reload of the tab opens MapMaker on it again: its
 * unsaved draft when it has one (mapSaving.ts keeps it), else the saved copy, the official map or the template it
 * was remixed from. Session storage is this tab's own (it outlives a reload and a crashed page, not the tab), so a new
 * tab, a link or the menu still start as they always did; leaving MapMaker for the menu forgets it.
 */

const KEY = 'tiletrigger.editorResume';

export interface EditorResume {
  /** The map's id (its draft, its saved copy, or the official map with that id). */
  id: string;
  name: string;
  /** The template a remix came from (a remix not yet edited has no draft or saved copy). */
  parentId?: string;
}

export function rememberEditorMap(r: EditorResume): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // No storage: a reload goes to the menu, as before.
  }
}

export function forgetEditorMap(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}

/** This page load is a reload of a tab that had MapMaker open: the map to reopen, else null. */
export function editorResumeOnReload(): EditorResume | null {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== 'reload') return null;
    const r = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as EditorResume | null;
    return r && typeof r.id === 'string' ? r : null;
  } catch {
    return null;
  }
}
