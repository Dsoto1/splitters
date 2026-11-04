import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { loadGraphicsQuality } from '../game/graphicsSettings.ts';
import { versioned } from '../assetUrl.ts';

/**
 * Real surfaces on man-made kit props (tools/content/surfaces.mjs). The build gives each part of a Kenney prop a
 * surface: its roughness and metalness (already in the model), box-projected coordinates in metres (the second UV
 * set) and material extras naming the surface, its tile size and how strongly its detail shows. Here those extras
 * become a Babylon detail map from the shared picture of that surface (public/surfaces/<id>.webp, one texture per
 * scene for every prop that uses it): grain and grime on top of the part's own colour, relief in its normals,
 * variation in its roughness. Same draws as before; on low graphics the detail is left off.
 */
interface SurfaceExtras {
  surface?: string;
  /** Metres per repeat. */
  tile?: number;
  /** Metres per unit of the coordinates (they are stored as whole centimetres). */
  uv?: number;
  /** How strongly the detail changes the colour, the roughness and the normals (0-1). */
  detail?: [number, number, number];
}

const textures = new WeakMap<Scene, Map<string, Texture>>();

function surfaceTexture(scene: Scene, id: string, repeat: number): Texture {
  let byId = textures.get(scene);
  if (!byId) textures.set(scene, (byId = new Map()));
  let tex = byId.get(id);
  if (!tex) {
    tex = new Texture(versioned(`${import.meta.env.BASE_URL}surfaces/${id}.webp`), scene, false, false);
    // Data, not colour: read as stored.
    tex.gammaSpace = false;
    tex.coordinatesIndex = 1;
    tex.uScale = tex.vScale = repeat;
    tex.anisotropicFilteringLevel = 4;
    byId.set(id, tex);
  }
  return tex;
}

const whites = new WeakMap<Scene, RawTexture>();
function white(scene: Scene): RawTexture {
  let tex = whites.get(scene);
  if (!tex) {
    tex = RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene, false, false);
    tex.coordinatesIndex = 1;
    whites.set(scene, tex);
  }
  return tex;
}

/** Give a loaded prop's surfaced materials their detail maps (no-op for models without surfaces, or on low). */
export function applyPropSurfaces(container: AssetContainer, scene: Scene): void {
  let low: boolean | null = null;
  for (const mat of container.materials) {
    if (!(mat instanceof PBRMaterial)) continue;
    const extras = (mat.metadata as { gltf?: { extras?: SurfaceExtras } } | null)?.gltf?.extras;
    if (!extras?.surface || !extras.tile || !extras.detail) continue;
    low ??= loadGraphicsQuality() === 'low';
    if (low) return;
    const [albedo, roughness, bump] = extras.detail;
    // Repeats per coordinate unit: the same for every prop with this surface, so one texture serves them all.
    mat.detailMap.texture = surfaceTexture(scene, extras.surface, (extras.uv ?? 1) / extras.tile);
    mat.detailMap.diffuseBlendLevel = albedo;
    mat.detailMap.roughnessBlendLevel = roughness;
    mat.detailMap.bumpLevel = bump;
    mat.detailMap.isEnabled = true;
    // Babylon works out which texture coordinates a mesh feeds before the detail map asks for them, so a material
    // with no texture of its own (the flat-colour kits) would draw its detail from nowhere. A shared 1x1 white colour
    // map on the same coordinates makes the material ask for them first (and changes no colour).
    if (!mat.albedoTexture) mat.albedoTexture = white(scene);
  }
}
