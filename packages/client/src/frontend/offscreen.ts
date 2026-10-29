import type { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
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

/**
 * A fixed projection for an offscreen camera (frozen, so the screen's aspect ratio never leaks in). The engine
 * draws with a reversed depth buffer (engine.ts), which a hand-made standard projection doesn't match: the
 * farthest surface won, so portraits showed the inside of helmets and hoods (and the back of the hair) through
 * the front.
 */
export function offscreenProjection(engine: AbstractEngine, fov: number, aspect: number, near: number, far: number): Matrix {
  // As Babylon's own cameras do it (Camera.getProjectionMatrix): near and far swapped, in reverse-depth mode.
  const reverse = engine.useReverseDepthBuffer;
  return Matrix.PerspectiveFovLHToRef(fov, aspect, reverse ? far : near, reverse ? near : far, new Matrix(), true, engine.isNDCHalfZRange, 0, reverse);
}
