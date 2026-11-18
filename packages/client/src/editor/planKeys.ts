/**
 * The keys of MapMaker's two plans, Tile View and the minimap, while one has the keyboard focus (UI Phase 5: keyboard
 * use, MAPMAKER_UI_SPEC §8 and §10). Pure, so it is tested headless; the panels act on what it returns. Keys a plan
 * takes don't reach MapMaker's own (the arrows, `[`, `]` and Home mean something else there).
 * - Both: `+` / `-` zoom, Home fits, Alt+arrows pan (Shift: further).
 * - The minimap: the arrows pan too (it has nothing to nudge), Enter opens Tile View on the selection.
 * - Tile View: `]` / `[` pick the next or previous thing or wall side, Enter goes to the picked thing's fields
 *   (the arrows nudge, R turns and Esc steps back, as before).
 */
export type PlanKeyAction =
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'zoom'; k: number }
  | { kind: 'fit' }
  | { kind: 'pick'; step: 1 | -1 }
  | { kind: 'fields' }
  | { kind: 'tileView' };

export interface PlanKeyPress {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** The arrows as screen directions (x right, y down). */
const ARROWS: Readonly<Record<string, readonly [number, number]>> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
/** A pan step: an eighth of the plan (Shift: half). */
export const PAN_STEP = 0.125;
export const PAN_STEP_FAR = 0.5;
export const ZOOM_STEP = 1.25;

export function planKeyAction(e: PlanKeyPress, plan: 'tile' | 'minimap'): PlanKeyAction | null {
  if (e.ctrlKey || e.metaKey) return null;
  const arrow = ARROWS[e.key];
  if (arrow && (e.altKey || plan === 'minimap')) {
    const step = e.shiftKey ? PAN_STEP_FAR : PAN_STEP;
    return { kind: 'pan', dx: arrow[0] * step, dy: arrow[1] * step };
  }
  if (e.altKey) return null;
  if (e.key === '+' || e.key === '=') return { kind: 'zoom', k: ZOOM_STEP };
  if (e.key === '-' || e.key === '_') return { kind: 'zoom', k: 1 / ZOOM_STEP };
  if (e.key === 'Home') return { kind: 'fit' };
  if (e.key === 'Enter') return plan === 'minimap' ? { kind: 'tileView' } : { kind: 'fields' };
  if (plan === 'tile' && (e.key === ']' || e.key === '[')) return { kind: 'pick', step: e.key === ']' ? 1 : -1 };
  return null;
}
