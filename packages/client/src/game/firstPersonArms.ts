import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PLAYER } from '@tiletrigger/shared';
import type { CharacterInstance } from '../content/characters.ts';

/**
 * Hang a look's first-person arms under `parent` (the camera, or a node on it):
 * the same size as the full character (fitted to the player height: the head
 * joint sits about 0.2 m below the top of the head), placed so the eyes are at
 * the camera and a little forward of them, so the support hand reaches long
 * guns (the shoulders are never in view). The game's view and the grip sheet
 * (tools/gripSheet.ts) both place them here.
 */
export function fitFirstPersonArms(ch: CharacterInstance, parent: TransformNode): void {
  const head = ch.joints.get('Head');
  head?.computeWorldMatrix(true);
  const headY = head ? head.getAbsolutePosition().y : PLAYER.eyeHeight;
  const scale = PLAYER.height / (headY + 0.2);
  ch.root.parent = parent;
  ch.root.scaling.setAll(scale);
  ch.root.position.set(0, -(headY + 0.07) * scale, 0.2);
}
