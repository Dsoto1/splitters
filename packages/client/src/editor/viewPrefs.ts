/**
 * How MapMaker's view was left (UI Phase 5, "user preference persistence"): View → Grid and Full grid, and the top
 * bar's Snap. Editor-only, kept in this browser (never in the map), read back safely; the defaults (grid on, full
 * grid off, snap 50 cm) are written as nothing. Not kept, on purpose: Overlaps and the map layers (they hide or mark
 * things for one task, and coming back to a map with props hidden reads as props lost), and the plan view.
 */
export type SnapMode = 'fine' | 'normal' | 'coarse' | 'off';

export interface ViewPrefs {
  grid: boolean;
  gridFull: boolean;
  snap: SnapMode;
}

export const VIEW_KEY = 'tiletrigger.editor.view';
export const DEFAULT_VIEW: ViewPrefs = { grid: true, gridFull: false, snap: 'normal' };
const SNAPS: readonly SnapMode[] = ['fine', 'normal', 'coarse', 'off'];

/** The stored view, or the defaults for anything missing or unreadable. Full grid needs the grid. */
export function parseViewPrefs(raw: string | null): ViewPrefs {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    if (v && typeof v === 'object') {
      const grid = v.grid !== false;
      return { grid, gridFull: grid && v.gridFull === true, snap: SNAPS.includes(v.snap as SnapMode) ? (v.snap as SnapMode) : 'normal' };
    }
  } catch {
    // Defaults.
  }
  return { ...DEFAULT_VIEW };
}

/** As stored: only what differs from the defaults (null: nothing to keep). */
export function serializeViewPrefs(p: ViewPrefs): string | null {
  const out: Record<string, unknown> = {};
  if (!p.grid) out.grid = false;
  if (p.grid && p.gridFull) out.gridFull = true;
  if (p.snap !== 'normal') out.snap = p.snap;
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

export function readViewPrefs(): ViewPrefs {
  try {
    return parseViewPrefs(localStorage.getItem(VIEW_KEY));
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

/** Keep one change (the rest as stored). */
export function keepViewPref(change: Partial<ViewPrefs>): void {
  try {
    const text = serializeViewPrefs({ ...readViewPrefs(), ...change });
    if (text) localStorage.setItem(VIEW_KEY, text);
    else localStorage.removeItem(VIEW_KEY);
  } catch {
    // Not kept (storage blocked).
  }
}
