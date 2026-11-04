import type { Scene } from '@babylonjs/core/scene';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves';
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
 * The menu's colour: ACES tone mapping with a touch more exposure and
 * contrast, and a vignette. The main menu's lineup and the Character
 * Designer use it: characters shown on their own stay bright and saturated.
 * The world (matches, MapMaker) uses `applyWorldGrade` instead.
 */
export function applyToneMapping(scene: Scene, o: { vignette?: boolean } = {}): void {
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.15;
  ip.contrast = 1.12;
  ip.colorCurvesEnabled = false;
  ip.vignetteEnabled = o.vignette ?? true;
  ip.vignetteWeight = 1.2;
  ip.vignetteStretch = 0.6;
}

/**
 * The world's grade (docs/LOOK.md): filmic ACES a little below the menu's exposure (whites roll off instead of
 * glowing), firm contrast, and colour curves that take the edge off saturated paint, most in the highlights, so
 * props and tiles read as materials, not toys. Hues are kept (no tint), so every part stays recognisable. Applied
 * per scene through Babylon's image processing (the materials' own shaders, or the post-process on high): no
 * extra pass, the same on WebGPU and WebGL2. HTML (HUD, menus) and the portrait scenes don't go through it.
 */
export const WORLD_GRADE = {
  exposure: 1.05,
  contrast: 1.15,
  /** -100..100: the whole picture, then highlights on top of it. */
  saturation: -12,
  highlightsSaturation: -20,
  vignetteWeight: 1.0,
} as const;

export function applyWorldGrade(scene: Scene, o: { vignette?: boolean } = {}): void {
  const g = WORLD_GRADE;
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = g.exposure;
  ip.contrast = g.contrast;
  const c = new ColorCurves();
  c.globalSaturation = g.saturation;
  c.highlightsSaturation = g.highlightsSaturation;
  ip.colorCurves = c;
  ip.colorCurvesEnabled = true;
  ip.vignetteEnabled = o.vignette ?? true;
  ip.vignetteWeight = g.vignetteWeight;
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

/**
 * First person: your whole character seen from its eyes (look down and see your body and feet), or only arms
 * holding the gun (the view before full body). Either way the gun is placed the same (bob, recoil, ADS).
 */
export const FIRST_PERSON_MODES = ['body', 'arms'] as const;
export type FirstPersonMode = (typeof FIRST_PERSON_MODES)[number];
export const FIRST_PERSON_LABELS: Record<FirstPersonMode, string> = { body: 'Full body', arms: 'Arms only' };
export const loadFirstPersonMode = (): FirstPersonMode => load('tiletrigger.firstPerson', FIRST_PERSON_MODES, 'body', (s) => s as FirstPersonMode);
export const saveFirstPersonMode = (m: FirstPersonMode): void => {
  save('tiletrigger.firstPerson', m);
  // Applied at once in a match (session.ts listens).
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tiletrigger:first-person'));
};

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
