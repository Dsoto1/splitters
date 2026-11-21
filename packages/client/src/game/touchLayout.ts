/**
 * The touch controls' layout (Options → Controls → Touch, on a phone or tablet; docs/MOBILE_AUDIT.md, proposal 3):
 * - **Button size**: Small, Medium (the default) or Large: the pad and the buttons together, scaled from their
 *   corners. Large is held back on short screens, so the buttons never reach the kill feed or the minimap.
 * - **Opacity**: how solid the pad and buttons are drawn, 30-100 % (a pressed button shows at full strength).
 * - **Left-handed**: the pad on the right, the buttons (and the ammo panel above them) on the left, and look on the
 *   left half.
 * Aim (hold or toggle) is the combat setting (combatPrefs.ts), offered beside these too. Saved in this browser; a
 * running match applies a change at once (TOUCH_LAYOUT_EVENT).
 */

export const TOUCH_SIZES = ['small', 'medium', 'large'] as const;
export type TouchSize = (typeof TOUCH_SIZES)[number];

export interface TouchLayout {
  size: TouchSize;
  /** 0.3..1 */
  opacity: number;
  leftHanded: boolean;
}

export const DEFAULT_TOUCH_LAYOUT: Readonly<TouchLayout> = { size: 'medium', opacity: 1, leftHanded: false };
export const TOUCH_SIZE_LABELS: Readonly<Record<TouchSize, string>> = { small: 'Small', medium: 'Medium', large: 'Large' };
/** Each size's scale of the controls as laid out (Medium). */
export const TOUCH_SIZE_SCALE: Readonly<Record<TouchSize, number>> = { small: 0.85, medium: 1, large: 1.2 };
export const MIN_TOUCH_OPACITY = 0.3;

const KEY = 'tiletrigger.touchLayout';
/** Fired on window when the layout changes (Options, and a match in play applies it). */
export const TOUCH_LAYOUT_EVENT = 'tiletrigger:touch-layout';

const clampOpacity = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_TOUCH_LAYOUT.opacity;
  return Math.round(Math.max(MIN_TOUCH_OPACITY, Math.min(1, n)) * 100) / 100;
};

/** A stored value read back: anything unknown or missing is the default. */
export function parseTouchLayout(raw: string | null): TouchLayout {
  let o: Partial<Record<keyof TouchLayout, unknown>> = {};
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (v && typeof v === 'object') o = v as typeof o;
  } catch {
    // A damaged value: the defaults.
  }
  return {
    size: TOUCH_SIZES.find((s) => s === o.size) ?? DEFAULT_TOUCH_LAYOUT.size,
    opacity: clampOpacity(o.opacity),
    leftHanded: typeof o.leftHanded === 'boolean' ? o.leftHanded : DEFAULT_TOUCH_LAYOUT.leftHanded,
  };
}

let current: TouchLayout | null = null;

export function touchLayout(): Readonly<TouchLayout> {
  if (current) return current;
  try {
    current = parseTouchLayout(localStorage.getItem(KEY));
  } catch {
    current = { ...DEFAULT_TOUCH_LAYOUT };
  }
  return current;
}

/** Change some of the layout, save it and tell the page. */
export function saveTouchLayout(change: Partial<TouchLayout>): void {
  const next = parseTouchLayout(JSON.stringify({ ...touchLayout(), ...change }));
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Lasts for this page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOUCH_LAYOUT_EVENT));
}

/** Tests: forget the value read. */
export function resetTouchLayoutCache(): void {
  current = null;
}

/**
 * The scale the controls are drawn at in a window `height` px tall. The right-hand cluster is about 230 px tall at
 * Medium (Weapons' top) with the ammo panel over it; a size above Medium is held back where that would leave less
 * than 90 px above it (the kill feed and the minimap live there). Never below Small, never above the size chosen.
 */
export function touchScale(size: TouchSize, height: number): number {
  const want = TOUCH_SIZE_SCALE[size];
  if (want <= 1) return want;
  const room = (height - 90) / 230;
  return Math.round(Math.max(1, Math.min(want, room)) * 100) / 100;
}

/**
 * Put a layout on the page: `--tc-scale` and `--tc-opacity` on the root (the HUD's ammo panel follows the scale) and
 * `tc-left` on it for left-handed.
 */
export function applyTouchLayout(root: HTMLElement, layout: Readonly<TouchLayout>, height: number): void {
  root.style.setProperty('--tc-scale', String(touchScale(layout.size, height)));
  root.style.setProperty('--tc-opacity', String(layout.opacity));
  root.classList.toggle('tc-left', layout.leftHanded);
}
