import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';
import type { Scene } from '@babylonjs/core/scene';
import { isTouchDevice } from '../touchDevice.ts';

/**
 * Map lights' tile mask, sized to the map (docs/MOBILE_AUDIT.md, "Dark blocks on lit walls", proposal 1).
 *
 * Babylon's clustered lights mark which lamps reach each of 64 × 64 screen tiles by adding one bit per lamp
 * (1, 2, 4 … 128) into a float render target, eight lamps to a layer on phones, the layers stacked in one texture
 * (64 tiles tall each). Some phone GPUs report a 32-bit float target and make a less precise one (Babylon's own note
 * names Samsung Galaxy): the sums lose bits and whole screen tiles drop a lamp, a dark block square to the screen on
 * a lit wall.
 *
 * On phones each lamp gets a layer of its own, so a tile's value is exactly 0 or 1, which any render target holds.
 * The layers then stack one per lamp, so the mask's height is tiles × lamps: Flatpack Depot's 138 lamps at 64 tiles
 * were 8,832 texels, past the texture limit (often 4,096 on phones), and every lamp went out (the first try,
 * reverted). So the mask gets fewer rows of tiles where it must, to fit the device's limit: 138 lamps at 4,096 are 29
 * rows (a tile a little taller, still exact). Only a map with more lamps than the limit allows at MIN_TILES rows
 * (512 at 4,096; the biggest map has about 200) shares layers again, as few lamps to a layer as fit.
 * Desktops keep Babylon's batches (their masks only ever shrink to fit, which none of our maps needs).
 */
export const MASK_TILES = 64;
/** The fewest rows of tiles a mask gets before lamps share layers. */
export const MIN_TILES = 8;

export interface LightMaskPlan {
  /** Lamps to a layer of the mask (Babylon's batch). */
  perLayer: number;
  /** Rows of screen tiles (Babylon's verticalTiles). */
  verticalTiles: number;
}

/**
 * How the mask is laid out for `lamps` lamps on a device whose largest render texture is `maxTexture` texels a side.
 * `babylonBatch`: the lamps to a layer Babylon picks (0: no clustered lights); `exact`: one lamp to a layer where it
 * fits (phones).
 */
export function lightMaskPlan(lamps: number, maxTexture: number, babylonBatch: number, exact: boolean): LightMaskPlan {
  if (babylonBatch <= 0) return { perLayer: 0, verticalTiles: MASK_TILES };
  const n = Math.max(1, lamps);
  let perLayer = babylonBatch;
  if (exact) {
    perLayer = 1;
    while (perLayer < babylonBatch && Math.ceil(n / perLayer) * MIN_TILES > maxTexture) perLayer++;
  }
  return { perLayer, verticalTiles: maskRows(n, perLayer, maxTexture) };
}

/** Rows of tiles for `lamps` lamps at `perLayer` to a layer, within `maxTexture` (at most MASK_TILES, at least 1). */
export function maskRows(lamps: number, perLayer: number, maxTexture: number): number {
  const layers = Math.max(1, Math.ceil(Math.max(1, lamps) / Math.max(1, perLayer)));
  return Math.max(1, Math.min(MASK_TILES, Math.floor(maxTexture / layers)));
}

type BatchEngine = { isWebGPU?: boolean; version?: number; hostInformation?: { isMobile?: boolean }; getCaps(): { maxTextureSize?: number; maxRenderTextureSize?: number } };
type BatchSizer = { _GetEngineBatchSize(engine: BatchEngine): number };

/** A phone or tablet drawing with WebGL 2 (its mask is the float target; WebGPU writes it with exact integer atomics). */
export function phoneMask(scene: Scene): boolean {
  const engine = scene.getEngine() as unknown as BatchEngine;
  return !engine.isWebGPU && (engine.version ?? 1) > 1 && (!!engine.hostInformation?.isMobile || isTouchDevice());
}

const param = (k: string) => (typeof window !== 'undefined' ? new URLSearchParams(window.location?.search ?? '').get(k) : null);

/**
 * Phones on Low graphics draw no lamp light at all (the fixtures glow; indoorFill.ts lights rooms brighter instead):
 * one lamp to a layer is exact, but a pixel then reads a layer for every lamp near its depth (Flatpack Depot's 138
 * lamps: 4-5 times the frame time of Babylon's 8 to a layer in a software renderer), too much for Low. Medium and
 * High keep the exact lamps. `?lamps=1` (or `?lampbatch=8`) keeps them on Low (to compare on the owner's phone).
 */
export function dropLamps(scene: Scene, quality: string, lamps: number): boolean {
  return lamps > 0 && quality === 'low' && phoneMask(scene) && param('lamps') !== '1' && param('lampbatch') !== '8';
}

/**
 * A clustered container for a map of `lamps` lamps, laid out by lightMaskPlan (null: no clustered lights here).
 * `?lampbatch=8` keeps Babylon's batches on a phone (to compare on the owner's phone).
 */
export function makeLightContainer(scene: Scene, lamps: number): { container: ClusteredLightContainer; plan: LightMaskPlan; maxTexture: number } | null {
  const sizer = ClusteredLightContainer as unknown as BatchSizer;
  const engine = scene.getEngine() as unknown as BatchEngine;
  const babylon = sizer._GetEngineBatchSize.bind(sizer);
  const batch = babylon(engine);
  const caps = engine.getCaps();
  const maxTexture = Math.min(caps.maxTextureSize || 4096, caps.maxRenderTextureSize || caps.maxTextureSize || 4096);
  // Phones (and tablets) on WebGL 2: the float mask (WebGPU writes it with exact integer atomics).
  const phone = phoneMask(scene) && param('lampbatch') !== '8';
  const plan = lightMaskPlan(lamps, maxTexture, batch, phone);
  sizer._GetEngineBatchSize = (e) => {
    const size = babylon(e);
    return size > 0 && plan.perLayer > 0 ? Math.min(size, plan.perLayer) : size;
  };
  let c: ClusteredLightContainer;
  try {
    c = new ClusteredLightContainer('map_lights', [], scene);
  } finally {
    sizer._GetEngineBatchSize = babylon;
  }
  if (!c.isSupported) {
    c.dispose();
    return null;
  }
  c.verticalTiles = plan.verticalTiles;
  return { container: c, plan, maxTexture };
}
