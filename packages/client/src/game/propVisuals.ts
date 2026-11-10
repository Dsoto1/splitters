import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Material } from '@babylonjs/core/Materials/material';
import { envModelFile, getProp, kitModelFile, groundNormal, propTilts, terrainHeightAt, type PropEntity, type TerrainData } from '@tiletrigger/shared';
import type { ModelLibrary } from '../content/models.ts';
import type { PropBatches } from './propBatches.ts';

/**
 * A placed prop: its model (loaded in the background) under a root that takes
 * the entity's position, turn and scale. Tinted props get their own copies of
 * the materials; untinted ones share them. Props never move, so their world
 * matrices are frozen once the model is in. In the game (`instanced`)
 * untinted props are GPU instances of their model merged per material, so big
 * maps stay cheap to draw; with `batches`, static ones are thin instances in their square's batch instead (the
 * root stays, with no meshes under it). Take one down with `disposePropNode`.
 */
export function createPropNode(scene: Scene, models: ModelLibrary, e: PropEntity, name: string, frozen = true, instanced = false, terrain: TerrainData | null = null, batches: PropBatches | null = null): TransformNode {
  const root = new TransformNode(name, scene);
  root.position.set(e.position[0], e.position[1], e.position[2]);
  root.scaling.setAll(e.scale);
  orientProp(root, e, terrain);
  const def = getProp(e.model);
  if (!def) return root;
  const small = isSmallProp(def.size, !!def.collision, e.scale);
  // Untinted copies of the same prop share one draw call per material (their parts merged); tinted ones need their own materials.
  // An environment species draws its variant's file (summer, autumn, snow…), a kit family its variant's (content/kitProps.ts).
  const file = kitModelFile(e.model, e.variant) ?? envModelFile(e.model, e.variant) ?? def.file;
  // The game's static props (not breakable, not carried): copies in their square's batch (propBatches.ts), tint and all.
  const batched = batches && frozen && !def.breakable ? batches.add(file, root, small, e.tint ?? null) : Promise.resolve(false);
  const model = batched.then((ok) => (ok ? null : instanced && !e.tint ? models.instantiateStatic(file, `${name}_model`) : models.instantiate(file, `${name}_model`, false)));
  void model.then((node) => {
    if (!node) return;
    if (root.isDisposed()) return node.dispose();
    node.parent = root;
    for (const m of node.getChildMeshes()) {
      if (e.tint && m.material) {
        const mat = m.material.clone(`${m.material.name}_${e.tint}`) as PBRMaterial | StandardMaterial | null;
        if (mat && 'albedoColor' in mat) mat.albedoColor = (mat.albedoColor ?? Color3.White()).multiply(Color3.FromHexString(e.tint));
        else if (mat && 'diffuseColor' in mat) mat.diffuseColor = mat.diffuseColor.multiply(Color3.FromHexString(e.tint));
        if (mat) {
          m.material = mat;
          owned(root).push(mat);
        }
      }
      if (frozen) m.freezeWorldMatrix();
      // Small clutter casts its shadow only near the camera (Atmosphere, SMALL_CASTER_REACH).
      if (small) m.metadata = { ...(m.metadata as object | null), smallCaster: true };
    }
  });
  return root;
}

/**
 * Small clutter: a prop under 0.75 m tall, or a plant (nothing to collide with) under 1.2 m (grass, wheat, flowers,
 * small rocks and crates). Its shadow is a speck past a few metres: drawn only near the camera.
 */
export function isSmallProp(size: readonly number[], collides: boolean, scale: number): boolean {
  const h = (size[1] ?? 0) * scale;
  return h < 0.75 || (!collides && h < 1.2);
}

/** The materials a prop made for itself (its tinted copies); every other material belongs to the model library. */
const ownMaterials = new WeakMap<TransformNode, Material[]>();
function owned(root: TransformNode): Material[] {
  let list = ownMaterials.get(root);
  if (!list) ownMaterials.set(root, (list = []));
  return list;
}

/**
 * Take a prop down with only the materials it made for itself. Untinted
 * props draw with the model library's materials, shared by every copy of
 * the model in the scene (and by copies made later): disposing those
 * (`dispose(false, true)`) strips them from every other copy, which then
 * draws in the default white.
 */
export function disposePropNode(root: TransformNode): void {
  const mats = ownMaterials.get(root) ?? [];
  ownMaterials.delete(root);
  root.dispose(false, false);
  for (const m of mats) m.dispose();
}

/**
 * Turn a prop to its facing and, for rocks, logs, stumps and plants standing
 * on the terrain, lean it with the slope (up to MAX_PROP_TILT). Trees,
 * buildings and furniture stay upright. Drawn only: collision stays upright.
 */
export function orientProp(root: TransformNode, e: PropEntity, terrain: TerrainData | null): void {
  const yaw = Quaternion.RotationAxis(Vector3.Up(), e.yaw);
  const ground = terrain ? terrainHeightAt(terrain, e.position[0], e.position[2]) : null;
  const onGround = ground !== null && Math.abs(e.position[1] - ground) < 0.6;
  const n = terrain && onGround && propTilts(e.model) ? groundNormal(terrain, e.position[0], e.position[2], Math.max(0.4, (getProp(e.model)?.size[0] ?? 1) * e.scale * 0.5)) : null;
  if (n && n.y < 0.9995) {
    const lean = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), new Vector3(n.x, n.y, n.z), lean);
    root.rotationQuaternion = lean.multiply(yaw);
  } else root.rotationQuaternion = yaw;
}
