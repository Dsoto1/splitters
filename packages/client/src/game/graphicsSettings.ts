import type { Scene } from '@babylonjs/core/scene';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { isTouchDevice } from '../touchDevice.ts';

// The graphics settings and the game's tone mapping: what the menu and the Options screen need,
// without the shadow and post-process code of atmosphere.ts (which re-exports all of this).

/**
 * How good the world looks, against how hard the machine works:
 *   low     tone mapping only (cheap colour and contrast)
 *   medium  + sharp sun shadows in a box that follows you
 *   high    + shadows that reach far (cascades), ambient occlusion in corners and bloom on bright spots
 */
export type GraphicsQuality = 'low' | 'medium' | 'high';
export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['low', 'medium', 'high'];
const KEY = 'tiletrigger.graphics';

export function loadGraphicsQuality(): GraphicsQuality {
  try {
    const q = localStorage.getItem(KEY) as GraphicsQuality | null;
    if (q && GRAPHICS_QUALITIES.includes(q)) return q;
  } catch {
    // Private windows: the default.
  }
  // Phones and tablets start on Low (their GPUs and batteries); Options can raise it.
  return isTouchDevice() ? 'low' : 'medium';
}

export function saveGraphicsQuality(q: GraphicsQuality): void {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    // Lasts for this page.
  }
}

/**
 * The game's colour: ACES tone mapping with a touch more exposure and
 * contrast, and a vignette (left off where it would hide work, as in the
 * MapMaker). Matches, the menu, the MapMaker and the Character Designer use it, so a map and a
 * character look the same wherever you see them.
 */
export function applyToneMapping(scene: Scene, o: { vignette?: boolean } = {}): void {
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.15;
  ip.contrast = 1.12;
  ip.vignetteEnabled = o.vignette ?? true;
  ip.vignetteWeight = 1.2;
  ip.vignetteStretch = 0.6;
}

// ---------------------------------------------------------------- performance settings

/**
 * How many pixels to draw per CSS pixel. Retina screens have two, so drawing at
 * "native" is four times the work of "sharp"; "auto" draws 1.25 (sharp enough
 * that edges don't look soft, much cooler on laptops).
 */
export const RENDER_SCALES = ['auto', 'native', 'sharp', 'performance'] as const;
export type RenderScale = (typeof RENDER_SCALES)[number];
export const RENDER_SCALE_LABELS: Record<RenderScale, string> = {
  auto: 'Auto (crisp, cooler on Retina screens)',
  native: 'Native (full Retina, hottest)',
  sharp: 'Standard (1 pixel per point)',
  performance: 'Performance (75%)',
};
/** Frames per second at most (0: as fast as the screen refreshes, 120 on ProMotion displays). */
export const FRAME_CAPS = [60, 30, 120, 0] as const;
export type FrameCap = (typeof FRAME_CAPS)[number];

function load<T>(key: string, ok: readonly T[], fallback: T, parse: (s: string) => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && ok.includes(parse(raw))) return parse(raw);
  } catch {
    // Private windows: the default.
  }
  return fallback;
}
function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows: kept for this session only.
  }
}
/** Phones and tablets start at Performance (75%): their screens are small and dense, their GPUs run hot. */
export const loadRenderScale = (): RenderScale => load('tiletrigger.renderScale', RENDER_SCALES, isTouchDevice() ? 'performance' : 'auto', (s) => s as RenderScale);
export const saveRenderScale = (s: RenderScale): void => {
  save('tiletrigger.renderScale', s);
  // Applied at once by the app (main.ts listens).
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tiletrigger:render-scale'));
};
export const loadFrameCap = (): FrameCap => load('tiletrigger.frameCap', FRAME_CAPS, 60, (s) => Number(s) as FrameCap);
let frameCap: FrameCap | null = null;
export const saveFrameCap = (c: FrameCap): void => {
  frameCap = c;
  save('tiletrigger.frameCap', String(c));
};
/** The frame cap, read from storage once (it is checked every frame). */
export const currentFrameCap = (): FrameCap => (frameCap ??= loadFrameCap());

/** Pixels drawn per CSS pixel for a setting on this screen. */
export function renderRatio(scale: RenderScale, dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1): number {
  switch (scale) {
    case 'native':
      return dpr;
    case 'sharp':
      return 1;
    case 'performance':
      return 0.75;
    default:
      return Math.min(dpr, 1.25);
  }
}
