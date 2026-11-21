import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { Scene } from '@babylonjs/core/scene';

/**
 * For a model file that finished loading after its scene was disposed (a Test left, or a match ended, while files were
 * still coming in): the container subscribed to the scene's dispose too late to be disposed with it, so its textures
 * stayed in the engine's cache, on the graphics card, for the rest of the tab's life (the memory probe, fix 3c: a
 * gun's and a character's maps after each short Test). Dispose it at once; callers already build nothing into a
 * scene that went.
 */
export function freeIfSceneGone(scene: Scene): <T extends AssetContainer | null>(c: T) => T {
  return <T extends AssetContainer | null>(c: T): T => {
    if (c && scene.isDisposed) c.dispose();
    return c;
  };
}
