/**
 * Where MapMaker's side panels stand (MapMaker UI spec Phase 1): the right dock's three states and width, and whether
 * the asset browser is open beside the left rail. Editor-only preferences, kept in this browser (never in the map),
 * read back safely. The DOM side is rightDock.ts and leftRail.ts; this module has none, so it is tested headless.
 */

/** The right dock: Outliner, Properties and Validation (expanded), the minimap only (compact), or gone (hidden). */
export type DockState = 'expanded' | 'compact' | 'hidden';

export interface DockPrefs {
  right: DockState;
  /** The expanded dock's width (px) once someone has dragged it; absent: the layout's own width for the window. */
  width?: number;
  /** The asset browser beside the rail, or only the rail. */
  left: 'open' | 'rail';
}

export const DOCK_KEY = 'tiletrigger.editor.dock';
/** The two edge tabs' fold before Phase 1 (`{ pal?: boolean, right?: boolean }`), read once to carry it over. */
export const LEGACY_SIDEBARS_KEY = 'tiletrigger.editor.sidebars';

export const DOCK_STATES: readonly DockState[] = ['expanded', 'compact', 'hidden'];
/** The expanded dock's narrowest and widest (px); never more than this share of the window. */
export const DOCK_MIN_W = 220;
export const DOCK_MAX_W = 520;
export const DOCK_MAX_SHARE = 0.45;
/** Under this window width the dock starts compact (owner's answer 7): the view keeps most of a small window. */
export const NARROW_WINDOW = 900;

export const DEFAULT_DOCK: DockPrefs = { right: 'expanded', left: 'open' };

const isState = (v: unknown): v is DockState => typeof v === 'string' && (DOCK_STATES as readonly string[]).includes(v);

/**
 * The stored preferences, or the old edge tabs' fold carried over (folded side panel: hidden; folded palette: rail),
 * or the defaults. Anything unreadable gives the defaults.
 */
export function parseDockPrefs(raw: string | null, legacy: string | null = null): DockPrefs {
  try {
    if (raw) {
      const v = JSON.parse(raw) as Record<string, unknown>;
      if (v && typeof v === 'object') {
        const width = typeof v.width === 'number' && Number.isFinite(v.width) ? Math.round(v.width) : undefined;
        return { right: isState(v.right) ? v.right : 'expanded', left: v.left === 'rail' ? 'rail' : 'open', ...(width ? { width } : {}) };
      }
    }
  } catch {
    // Fall through to the old key, then the defaults.
  }
  try {
    if (legacy) {
      const v = JSON.parse(legacy) as { pal?: unknown; right?: unknown };
      if (v && typeof v === 'object') return { right: v.right === true ? 'hidden' : 'expanded', left: v.pal === true ? 'rail' : 'open' };
    }
  } catch {
    // Defaults.
  }
  return { ...DEFAULT_DOCK };
}

/** As stored: the same state always writes the same text. */
export function serializeDockPrefs(p: DockPrefs): string {
  return JSON.stringify({ left: p.left, right: p.right, ...(p.width ? { width: Math.round(p.width) } : {}) });
}

/** Shift+\: expanded, then compact, then hidden, then expanded again. */
export function nextDockState(s: DockState): DockState {
  return DOCK_STATES[(DOCK_STATES.indexOf(s) + 1) % DOCK_STATES.length]!;
}

/** The state the dock opens in: as left, except that a window under 900 px starts compact rather than expanded. */
export function startingDockState(saved: DockState, windowWidth: number): DockState {
  return saved === 'expanded' && windowWidth < NARROW_WINDOW ? 'compact' : saved;
}

/** A dragged width kept within the dock's limits for this window. */
export function clampDockWidth(w: number, windowWidth: number): number {
  const max = Math.max(DOCK_MIN_W, Math.min(DOCK_MAX_W, Math.floor(windowWidth * DOCK_MAX_SHARE)));
  return Math.round(Math.max(DOCK_MIN_W, Math.min(max, w)));
}
