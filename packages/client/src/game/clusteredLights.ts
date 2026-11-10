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
 * Phones get fewer lamps to a layer (PHONE_LAMPS_PER_LAYER, 4): a tile's sum is then at most 15, exact in any float
 * target down to the 10-bit floats (8 lamps' 255 needs 8 bits of mantissa, more than an 11- or 10-bit float has).
 * One lamp to a layer would be exact even in an 8-bit target, but a pixel reads a layer for every lamp near its depth:
 * on Flatpack Depot's 138 lamps that was 4-10 times the frame time of 8 to a layer in a software renderer, so it's only
 * `?lampbatch=1` (to try on the owner's phone; `?lampbatch=8` is Babylon's own).
 *
 * More layers stack a taller mask (tiles × layers): one lamp a layer on Flatpack Depot at 64 tiles was 8,832 texels,
 * past the texture limit (often 4,096 on phones), and every lamp went out (the first try, reverted). So the mask gets
 * fewer rows of tiles where it must, to fit the device's limit (a tile a little taller, still exact); only past
 * MIN_TILES rows do more lamps share a layer, as few as fit. Desktops keep Babylon's batches (their masks only ever
 * shrink to fit, which none of our maps needs). Phones on Low draw no lamp light at all (dropLamps).
 */
export const MASK_TILES = 64;
/** The fewest rows of tiles a mask gets before more lamps share a layer. */
export const MIN_TILES = 8;
/** Lamps to a mask layer on a phone (see above). */
export const PHONE_LAMPS_PER_LAYER = 4;

export interface LightMaskPlan {
  /** Lamps to a layer of the mask (Babylon's batch). */
  perLayer: number;
  /** Rows of screen tiles (Babylon's verticalTiles). */
  verticalTiles: number;
}

/**
 * How the mask is laid out for `lamps` lamps on a device whose largest render texture is `maxTexture` texels a side.
 * `babylonBatch`: the lamps to a layer Babylon picks (0: no clustered lights); `phoneLayer`: the fewest lamps to a
 * layer wanted (phones; 0 keeps Babylon's).
 */
export function lightMaskPlan(lamps: number, maxTexture: number, babylonBatch: number, phoneLayer: number): LightMaskPlan {
  if (babylonBatch <= 0) return { perLayer: 0, verticalTiles: MASK_TILES };
  const n = Math.max(1, lamps);
  let perLayer = babylonBatch;
  if (phoneLayer > 0) {
    perLayer = Math.min(phoneLayer, babylonBatch);
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
 * no mask that can lose a lamp, and half the frame time of Babylon's lamps in a software renderer. Medium and High
 * keep the lamps (4 to a layer). `?lamps=1` (or any `?lampbatch=`) keeps them on Low, to compare on the owner's phone.
 */
export function dropLamps(scene: Scene, quality: string, lamps: number): boolean {
  return lamps > 0 && quality === 'low' && phoneMask(scene) && param('lamps') !== '1' && !param('lampbatch');
}

/** Lamps to a layer wanted on this device: PHONE_LAMPS_PER_LAYER on a phone, `?lampbatch=N` to try another, 0: Babylon's. */
export function phoneLayer(scene: Scene): number {
  const forced = Number(param('lampbatch'));
  if (forced >= 1 && forced <= 32) return Math.floor(forced);
  return phoneMask(scene) ? PHONE_LAMPS_PER_LAYER : 0;
}

/** A clustered container for a map of `lamps` lamps, laid out by lightMaskPlan (null: no clustered lights here). */
export function makeLightContainer(scene: Scene, lamps: number): { container: ClusteredLightContainer; plan: LightMaskPlan; maxTexture: number } | null {
  const sizer = ClusteredLightContainer as unknown as BatchSizer;
  const engine = scene.getEngine() as unknown as BatchEngine;
  const babylon = sizer._GetEngineBatchSize.bind(sizer);
  const batch = babylon(engine);
  const caps = engine.getCaps();
  const maxTexture = Math.min(caps.maxTextureSize || 4096, caps.maxRenderTextureSize || caps.maxTextureSize || 4096);
  const plan = lightMaskPlan(lamps, maxTexture, batch, phoneLayer(scene));
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
