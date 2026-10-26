import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { getMountDef } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';

/**
 * A turret, sentry or vehicle: its model (loaded in the background) under a
 * root at the mount's footprint centre. Built models are centred on their
 * bounds, so the model is lifted to sit on the ground. Turrets and sentries
 * have a `gun` child the game turns to follow the gunner's aim. `tint`
 * paints it (a skin or its team's colour, see mountTint): the model gets
 * its own copies of its materials, multiplied by the colour.
 */
export function createMountNode(scene: Scene, models: ModelLibrary, model: string, name: string, tint: string | null = null): TransformNode {
  const root = new TransformNode(name, scene);
  const def = getMountDef(model);
  if (!def) return root;
  const body = new TransformNode(`${name}_gun`, scene);
  body.parent = root;
  void models.instantiate(def.model, `${name}_model`).then((node) => {
    if (root.isDisposed()) return node.dispose();
    node.parent = body;
    const { min } = node.getHierarchyBoundingVectors(true);
    const ride = def.rideHeight ?? (def.vehicle?.hover ? 0.35 : 0);
    node.position.y -= min.y - root.position.y - ride;
    for (const m of node.getChildMeshes()) {
      m.isPickable = false;
      if (tint) paint(m, tint);
    }
  });
  return root;
}

/** Give a mesh its own copy of its material, tinted (pale skins also glow a little, so snow paint reads white). */
function paint(mesh: { material: PBRMaterial | StandardMaterial | null | unknown }, tint: string): void {
  const src = mesh.material as PBRMaterial | StandardMaterial | null;
  if (!src) return;
  const c = Color3.FromHexString(tint);
  const mat = src.clone(`${src.name}_${tint}`) as PBRMaterial | StandardMaterial | null;
  if (!mat) return;
  if ('albedoColor' in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(c);
  else if ('diffuseColor' in mat) mat.diffuseColor = mat.diffuseColor.multiply(c);
  if (c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.85) mat.emissiveColor = c.scale(0.18);
  mesh.material = mat;
}

/** The part of a mount that turns with the gunner's aim (turrets), or null. */
export const mountGun = (root: TransformNode): TransformNode | null => root.getChildren((n) => n.name.endsWith('_gun'), true)[0] as TransformNode | undefined ?? null;
