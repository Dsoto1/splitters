import type { Color3 } from '@babylonjs/core/Maths/math.color';
import { perfOn } from './perfSwitches.ts';

/** Materials whose glow colour is their own (set once through the property): later glows change it in place. */
const ownGlow = new WeakSet<object>();

/**
 * A material's glow, set only when it differs. Setting a PBR material's colour makes Babylon look through every mesh of
 * the scene for the material's users (`_markAllSubMeshesAsDirty`: thousands in a big match, about 1 ms a respawn with
 * the spawn shimmer easing in tenths; PERF_STJOHNS_2026-11-14), though the glow is only a uniform (no shader define
 * reads it). So the colour is set through the property once, giving the material a Color3 of its own, and changed
 * in place after that (read at the next draw). Several of a character's meshes share a material, too.
 */
export function setGlow(mat: { emissiveColor: Color3 }, color: Color3): void {
  if (mat.emissiveColor.equals(color)) return;
  if (ownGlow.has(mat) && perfOn('glowinplace')) mat.emissiveColor.copyFrom(color);
  else {
    mat.emissiveColor = color.clone();
    ownGlow.add(mat);
  }
}
