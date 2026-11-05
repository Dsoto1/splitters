import type { DepthRenderer } from '@babylonjs/core/Rendering/depthRenderer';

/**
 * A scene depth renderer is one per camera, shared by whoever asks for it: the height fog (SkyEffects, misty maps
 * on high) reads the whole view's depth, high-quality water only what lies under it (WaterVisuals trims the depth
 * map to the meshes round its bodies). The fog marks the one it uses so water leaves it whole.
 */
export function markWholeSceneDepth(depth: DepthRenderer): void {
  (depth as unknown as { ttWholeScene?: boolean }).ttWholeScene = true;
}

/** Whether something needs this depth renderer to draw the whole view (markWholeSceneDepth). */
export function wholeSceneDepth(depth: DepthRenderer): boolean {
  return (depth as unknown as { ttWholeScene?: boolean }).ttWholeScene === true;
}
