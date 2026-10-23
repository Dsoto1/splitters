import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { getProp, type PropEntity } from '@chronosplit/shared';
import type { ModelLibrary } from '../content/models.ts';

/**
 * A placed prop: its model (loaded in the background) under a root that takes
 * the entity's position, turn and scale. Tinted props get their own copies of
 * the materials; untinted ones share them. Props never move, so their world
 * matrices are frozen once the model is in. In the game (`instanced`)
 * untinted props are GPU instances, so big maps stay cheap to draw.
 */
export function createPropNode(scene: Scene, models: ModelLibrary, e: PropEntity, name: string, frozen = true, instanced = false): TransformNode {
  const root = new TransformNode(name, scene);
  root.position.set(e.position[0], e.position[1], e.position[2]);
  root.rotation.y = e.yaw;
  root.scaling.setAll(e.scale);
  const def = getProp(e.model);
  if (!def) return root;
  // Untinted copies of the same prop share one draw call; tinted ones need their own materials.
  void models.instantiate(def.file, `${name}_model`, instanced && !e.tint).then((node) => {
    if (root.isDisposed()) return node.dispose();
    node.parent = root;
    for (const m of node.getChildMeshes()) {
      if (e.tint && m.material) {
        const mat = m.material.clone(`${m.material.name}_${e.tint}`) as PBRMaterial | StandardMaterial | null;
        if (mat && 'albedoColor' in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(Color3.FromHexString(e.tint));
        else if (mat && 'diffuseColor' in mat) mat.diffuseColor = mat.diffuseColor.multiply(Color3.FromHexString(e.tint));
        if (mat) m.material = mat;
      }
      if (frozen) m.freezeWorldMatrix();
    }
  });
  return root;
}
