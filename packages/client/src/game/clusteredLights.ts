import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';

/**
 * Map lights on phones (docs/MOBILE_AUDIT.md, "Dark blocks on lit walls").
 *
 * Babylon's clustered lights mark which lights reach each of 64 × 64 screen tiles by adding one bit per light
 * (1, 2, 4 … 128) into a float render target, eight lights to a layer on phones. Some phone GPUs report a 32-bit
 * float target and make a less precise one (Babylon's own note names Samsung Galaxy): the sums lose bits, and
 * whole screen tiles drop a lamp. On an Android phone in Bottling Plant that drew a dark, stair-edged block on
 * a lit tiled wall, square to the screen while the wall ran off at an angle.
 *
 * On a mobile WebGL 2 engine each light gets a layer of its own: the tile's value is then exactly 0 or 1, which
 * any render target holds. A pixel reads only the layers of the lights in its depth slices, so a room's few
 * lamps cost a few texture reads. Desktops and WebGPU keep Babylon's batches.
 */
export const MOBILE_LIGHTS_PER_LAYER = 1;

type BatchEngine = { isWebGPU?: boolean; version?: number; hostInformation?: { isMobile?: boolean } };
type BatchSizer = { _GetEngineBatchSize(engine: BatchEngine): number };

let installed = false;

/** Install once, before the first container is made (ScenarioVisuals does). */
export function installPhoneLightMasks(target: BatchSizer = ClusteredLightContainer as unknown as BatchSizer): void {
  if (target === (ClusteredLightContainer as unknown as BatchSizer)) {
    if (installed) return;
    installed = true;
  }
  const babylon = target._GetEngineBatchSize.bind(target);
  target._GetEngineBatchSize = (engine) => {
    const size = babylon(engine);
    if (size > 0 && !engine.isWebGPU && (engine.version ?? 1) > 1 && engine.hostInformation?.isMobile) return Math.min(size, MOBILE_LIGHTS_PER_LAYER);
    return size;
  };
}
