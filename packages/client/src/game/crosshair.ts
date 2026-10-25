/** Crosshair styles and colours (Options), applied to the HUD crosshair through data attributes and a CSS variable. */
export const CROSSHAIR_STYLES = ['cross', 'dot', 'circle', 'chevron', 'gap'] as const;
export type CrosshairStyle = (typeof CROSSHAIR_STYLES)[number];
export const CROSSHAIR_COLOURS = ['#e6f0ff', '#00d1ff', '#2ecc71', '#ffb347', '#ff5ea8'] as const;

export interface CrosshairSetting {
  style: CrosshairStyle;
  colour: string;
}

const KEY = 'cs.crosshair';

export function crosshairSetting(): CrosshairSetting {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CrosshairSetting> | null;
    const style = CROSSHAIR_STYLES.find((s) => s === raw?.style) ?? 'cross';
    const colour = CROSSHAIR_COLOURS.find((c) => c === raw?.colour) ?? CROSSHAIR_COLOURS[0];
    return { style, colour };
  } catch {
    return { style: 'cross', colour: CROSSHAIR_COLOURS[0] };
  }
}

export function saveCrosshair(setting: CrosshairSetting): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(setting));
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
  applyCrosshair(setting);
}

/** Style the HUD crosshair element. */
export function applyCrosshair(setting: CrosshairSetting = crosshairSetting()): void {
  const el = document.getElementById('crosshair');
  if (!el) return;
  el.dataset.style = setting.style;
  el.style.setProperty('--xh', setting.colour);
}

/** Hit-marker styles (Options): the classic diamond, Infinite-Warfare-style ticks that pop, or none. */
export const HITMARKER_STYLES = ['ticks', 'diamond', 'off'] as const;
export type HitmarkerStyle = (typeof HITMARKER_STYLES)[number];
const HIT_KEY = 'cs.hitmarker';

export function hitmarkerSetting(): HitmarkerStyle {
  try {
    return HITMARKER_STYLES.find((s) => s === localStorage.getItem(HIT_KEY)) ?? 'ticks';
  } catch {
    return 'ticks';
  }
}

export function saveHitmarker(style: HitmarkerStyle): void {
  try {
    localStorage.setItem(HIT_KEY, style);
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
  applyHitmarker(style);
}

export function applyHitmarker(style: HitmarkerStyle = hitmarkerSetting()): void {
  const el = document.getElementById('hitmarker');
  if (el) el.dataset.style = style;
}

/** Markers over players' heads (Options): allies in a chosen colour, enemies optionally in red. */
export interface MarkerSetting {
  /** 'team' uses your team's own colour. */
  ally: 'team' | string;
  /** null hides enemy markers. */
  enemy: string | null;
}
export const ALLY_MARKER_COLOURS = ['team', '#3ad1ff', '#2ecc71', '#ffffff'] as const;
export const ENEMY_MARKER_COLOURS = ['#ff3b3b', null] as const;
const MARKER_KEY = 'cs.markers';

export function markerSetting(): MarkerSetting {
  try {
    const raw = JSON.parse(localStorage.getItem(MARKER_KEY) ?? 'null') as Partial<MarkerSetting> | null;
    const ally = ALLY_MARKER_COLOURS.find((c) => c === raw?.ally) ?? '#3ad1ff';
    const enemy = raw && 'enemy' in raw ? (ENEMY_MARKER_COLOURS.find((c) => c === raw.enemy) ?? null) : '#ff3b3b';
    return { ally, enemy };
  } catch {
    return { ally: '#3ad1ff', enemy: '#ff3b3b' };
  }
}

export function saveMarkers(setting: MarkerSetting): void {
  try {
    localStorage.setItem(MARKER_KEY, JSON.stringify(setting));
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
}
