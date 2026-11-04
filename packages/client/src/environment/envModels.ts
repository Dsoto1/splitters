import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '../content/gltf.ts';
import { GLB, versioned } from '../assetUrl.ts';
import { ENV_WIND_KIND, type EnvMaterials } from './envMaterials.ts';

/** One part of a level of detail: its geometry in the species' own (game) space, wind weights and material. */
export interface EnvPart {
  material: string;
  data: VertexData;
  wind: Float32Array | null;
  sideOrientation: number;
  /** The GLB's own picture (the crossed-card stand-in's). */
  texture: BaseTexture | null;
}

/** A species variant's levels of detail, nearest first: where each starts (m) and its parts. */
export interface EnvModel {
  levels: { distance: number; crossed: boolean; parts: EnvPart[] }[];
  triangles: number[];
}

/**
 * Read a generated environment model (tools/content/environment.mjs): level 0 is the plain node, lighter levels
 * carry glTF extras { lod, distance } and the far stand-in { crossed }. Geometry is taken out in the model's space
 * (the importer's mirror baked in, so it is game space: what the collision shapes use).
 */
export async function loadEnvModel(scene: Scene, file: string): Promise<EnvModel> {
  const container: AssetContainer = await LoadAssetContainerAsync(versioned(`${import.meta.env.BASE_URL}${file}`), scene, GLB);
  const byLevel = new Map<number, { distance: number; crossed: boolean; parts: EnvPart[] }>();
  for (const m of container.meshes) {
    if (!(m instanceof Mesh) || !m.getTotalVertices()) continue;
    const extras = (m.metadata?.gltf?.extras ?? m.parent?.metadata?.gltf?.extras) as { lod?: number; distance?: number; crossed?: boolean } | undefined;
    const lod = extras?.lod ?? 0;
    let level = byLevel.get(lod);
    if (!level) byLevel.set(lod, (level = { distance: extras?.distance ?? 0, crossed: !!extras?.crossed, parts: [] }));
    m.computeWorldMatrix(true);
    const data = VertexData.ExtractFromMesh(m, true, true);
    data.transform(m.getWorldMatrix());
    const uv2 = m.getVerticesData(VertexBuffer.UV2Kind);
    const material = m.material?.name ?? 'env.bark';
    const tex = (m.material as { albedoTexture?: BaseTexture | null } | null)?.albedoTexture ?? null;
    level.parts.push({ material, data, wind: uv2 ? Float32Array.from(uv2) : null, sideOrientation: m.sideOrientation, texture: tex });
  }
  // The container's own meshes are no longer needed (its textures are, for the stand-in).
  for (const m of [...container.meshes]) m.dispose(false, false);
  const levels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
  return { levels, triangles: levels.map((l) => l.parts.reduce((n, p) => n + (p.data.indices?.length ?? 0) / 3, 0)) };
}

/** A hidden template mesh for one part, with its material and wind weights, ready to clone per batch. */
export function partMesh(scene: Scene, name: string, part: EnvPart, materials: EnvMaterials): Mesh {
  const mesh = new Mesh(name, scene);
  part.data.applyToMesh(mesh, false);
  if (part.wind) mesh.setVerticesData(ENV_WIND_KIND, part.wind, false, 2);
  mesh.sideOrientation = part.sideOrientation;
  mesh.material = materials.get(part.material, part.texture);
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}
