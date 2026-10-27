import type { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';

/**
 * The active camera for a scene that only renders into textures (portraits,
 * thumbnails). Those scenes render between the app's own frames; drawing
 * anything to the screen's framebuffer there, even a zero-size viewport, makes
 * the browser present a freshly cleared canvas, so the menu or MapMaker behind
 * blinks out for a frame. This camera draws into a tiny private target instead,
 * so the screen is only ever touched by the render loop.
 */
export function offscreenCamera(scene: Scene, name: string): FreeCamera {
  const camera = new FreeCamera(name, Vector3.Zero(), scene);
  camera.viewport = new Viewport(0, 0, 0.0001, 0.0001);
  camera.outputRenderTarget = new RenderTargetTexture(`${name}Sink`, 4, scene, false);
  return camera;
}
