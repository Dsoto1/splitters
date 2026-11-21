/**
 * Where MapMaker's side panels stand (MapMaker UI spec Phase 1): the right dock's three states and width, and whether
 * the asset browser is open beside the left rail. Editor-only preferences, kept in this browser (never in the map),
 * read back safely. The DOM side is rightDock.ts and leftRail.ts; this module has none, so it is tested headless.
 */

/** The right dock: Minimap | Outliner, Properties and Validation (expanded), the minimap only (compact), or gone (hidden). */
export type DockState = 'expanded' | 'compact' | 'hidden';

export interface DockPrefs {
  right: DockState;
  /** The expanded dock's width (px) once someone has dragged it; absent: the layout's own width for the window. */
  width?: number;
  /** The asset browser beside the rail, or only the rail. */
  left: 'open' | 'rail';
  /** The expanded dock's top tab (UI spec Phase 3): absent, the Outliner. */
  tab?: DockTab;
  /** The minimap's zoom (1: the whole level; minimapModel.ts); absent, 1. */
  minimapZoom?: number;
  /** Tile View's snap step in cm (UI spec Phase 4a: 1, 5, 10 or 50); absent, 10. */
  tileSnap?: number;
  /** Tile View's coordinates: absent, local (tile-relative); 'world'. */
  tileFrame?: 'world';
}

/** Tile View's snap steps (cm) and the one it starts with. */
export const TILE_SNAP_STEPS = [1, 5, 10, 50] as const;
export const DEFAULT_TILE_SNAP = 10;

/** The expanded dock's tabs above Properties: the minimap or the outliner. */
export type DockTab = 'minimap' | 'outliner';

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
        const zoom = typeof v.minimapZoom === 'number' && Number.isFinite(v.minimapZoom) && v.minimapZoom > 1 ? Math.min(16, Math.round(v.minimapZoom * 100) / 100) : undefined;
        const snap = (TILE_SNAP_STEPS as readonly unknown[]).includes(v.tileSnap) && v.tileSnap !== DEFAULT_TILE_SNAP ? (v.tileSnap as number) : undefined;
        return { right: isState(v.right) ? v.right : 'expanded', left: v.left === 'rail' ? 'rail' : 'open', ...(width ? { width } : {}), ...(v.tab === 'minimap' ? { tab: 'minimap' as const } : {}), ...(zoom ? { minimapZoom: zoom } : {}), ...(snap ? { tileSnap: snap } : {}), ...(v.tileFrame === 'world' ? { tileFrame: 'world' as const } : {}) };
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
  const zoom = p.minimapZoom && p.minimapZoom > 1 ? Math.min(16, Math.round(p.minimapZoom * 100) / 100) : 0;
  const snap = p.tileSnap && (TILE_SNAP_STEPS as readonly number[]).includes(p.tileSnap) && p.tileSnap !== DEFAULT_TILE_SNAP ? p.tileSnap : 0;
  return JSON.stringify({ left: p.left, right: p.right, ...(p.width ? { width: Math.round(p.width) } : {}), ...(p.tab === 'minimap' ? { tab: 'minimap' } : {}), ...(zoom ? { minimapZoom: zoom } : {}), ...(snap ? { tileSnap: snap } : {}), ...(p.tileFrame === 'world' ? { tileFrame: 'world' } : {}) });
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
  const max = dockMaxWidth(windowWidth);
  return Math.round(Math.max(DOCK_MIN_W, Math.min(max, w)));
}

/**
 * The dock's state after the window is resized (UI Phase 5): narrowed past 900 px, an expanded dock folds to compact,
 * as it would start (owner's answer 7); widened back past it, the dock as it was left comes back. Neither is kept: the
 * saved choice is only what someone picked. Any other resize leaves the dock as it is.
 */
export function resizedDockState(current: DockState, saved: DockState, before: number, after: number): DockState {
  if (current === 'expanded' && before >= NARROW_WINDOW && after < NARROW_WINDOW) return 'compact';
  if (current === 'compact' && saved === 'expanded' && before < NARROW_WINDOW && after >= NARROW_WINDOW) return 'expanded';
  return current;
}

/** The widest the dock may be in this window (the grip's aria-valuemax). */
export function dockMaxWidth(windowWidth: number): number {
  return Math.max(DOCK_MIN_W, Math.min(DOCK_MAX_W, Math.floor(windowWidth * DOCK_MAX_SHARE)));
}
