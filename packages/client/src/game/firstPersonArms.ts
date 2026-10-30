import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PLAYER } from '@tiletrigger/shared';
import type { CharacterInstance } from '../content/characters.ts';

/**
 * How far (m) the body under the first-person arms sits behind the eyes: far enough that the shoulders' own
 * geometry (a sleeve's cut edge, a pauldron) stays out of view. The shoulder joints themselves are placed from
 * the view each frame (CharacterAnimator.gripExternal), not from here.
 */
const FIT_Z = -0.08;

/**
 * Hang a look's first-person arms under `parent` (the camera, or a node on it):
 * the same size as the full character (fitted to the player height: the head
 * joint sits about 0.2 m below the top of the head), with the eyes at the
 * camera and the body a little behind it. While they hold a gun, the shoulder
 * joints are set beside and below the eye and brought forward as far as the
 * arm needs to reach (see CharacterAnimator.gripPlaced), whatever the
 * character's build. The game's view and the grip sheet (tools/gripSheet.ts)
 * both place them here.
 */
export function fitFirstPersonArms(ch: CharacterInstance, parent: TransformNode): void {
  const head = ch.joints.get('Head');
  head?.computeWorldMatrix(true);
  const headY = head ? head.getAbsolutePosition().y : PLAYER.eyeHeight;
  const scale = PLAYER.height / (headY + 0.2);
  ch.root.parent = parent;
  ch.root.scaling.setAll(scale);
  ch.root.position.set(0, -(headY + 0.07) * scale, FIT_Z);
}
