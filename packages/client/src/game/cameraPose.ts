import type { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/**
 * The game's view camera, posed from yaw, pitch and a roll (shake) each frame.
 *
 * Babylon's target camera re-derives its up vector from the full rotation only
 * on frames where rotation.z changes, and keeps the old one otherwise. After a
 * shake (explosions, vehicle crashes, heavy recoil) the last frame sets roll
 * back to 0, which leaves the up vector tilted by that frame's pitch and yaw.
 * Every later turn then rolled the view (and the gun and arms hanging from
 * it), until another shake happened to end at zero pitch. Deriving the up
 * vector from the rotation every frame keeps a level view level.
 */
export function createViewCamera(name: string, scene: Scene): FreeCamera {
  const camera = new FreeCamera(name, new Vector3(0, 10, -10), scene);
  camera.updateUpVectorFromRotation = true;
  return camera;
}

/** Point the camera (Babylon: rotation.y is yaw, 0 = +Z; positive rotation.x looks down). */
export function poseCamera(camera: FreeCamera, yaw: number, pitch: number, roll = 0): void {
  camera.rotation.set(-pitch, yaw, roll);
}
