import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TERRAIN_MATERIALS, TERRAIN_SURFACES, buildMapDecor, coreMaterials, coreThemes, vertexY, yawXZ, faceSlot, resolveSurface, styleKey, type MapDocument, type MaterialDefinition, type ResolvedStyle, type TerrainMaterial, type TilePlacement, type WorldBox } from '@chronosplit/shared';
import { materialPixels } from './materials/patterns.ts';
import { versioned } from './assetUrl.ts';

/**
 * Faces of a box: corners (clockwise from outside, Babylon's front face),
 * outward normal, and the corners before any turn (texture coordinates are
 * laid out on those, so a turned wall's bricks run along it).
 */
type Face = [corners: number[][], normal: [number, number, number], flat: number[][], flatNormal: [number, number, number]];
function boxFaces(b: WorldBox): Face[] {
  const faces = axisFaces(b);
  if (!b.yaw) return faces.map(([c, n]) => [c, n, c, n]);
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const turn = (p: number[]) => {
    const [x, z] = yawXZ(p[0]! - cx, p[2]! - cz, b.yaw!);
    return [cx + x, p[1]!, cz + z];
  };
  return faces.map(([c, n]) => {
    const [nx, nz] = yawXZ(n[0], n[2], b.yaw!);
    return [c.map(turn), [nx, n[1], nz], c, n];
  });
}

function axisFaces(b: WorldBox): [number[][], [number, number, number]][] {
  const [x0, y0, z0] = b.min;
  const [x1, y1, z1] = b.max;
  return [
    [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
    [[[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]],
    [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]],
    [[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]],
    [[[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]],
    [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]],
  ];
}

class FaceBuffer {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];

  /** Add one face with UVs in world metres divided by the material's repeat size. */
  /** `flat`/`fn`: the face before any turn, whose two axes perpendicular to the normal lay out the texture. */
  add(corners: number[][], n: readonly [number, number, number], uvScale: number, flat: number[][] = corners, fn: readonly [number, number, number] = n): void {
    const base = this.positions.length / 3;
    corners.forEach((c, i) => {
      const f = flat[i]!;
      this.positions.push(c[0]!, c[1]!, c[2]!);
      this.normals.push(n[0], n[1], n[2]);
      const u = fn[0] !== 0 ? f[2]! : f[0]!;
      const v = fn[1] !== 0 ? f[2]! : f[1]!;
      this.uvs.push(u * uvScale, v * uvScale);
    });
    this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  toVertexData(): VertexData {
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.normals = this.normals;
    vd.uvs = this.uvs;
    vd.indices = this.indices;
    return vd;
  }
}

/** Plain vertex data for a set of boxes (ghost previews, outlines). */
export function boxVertexData(boxes: readonly WorldBox[]): VertexData {
  const buf = new FaceBuffer();
  for (const b of boxes) for (const [corners, n, flat, fn] of boxFaces(b)) buf.add(corners, n, 0.5, flat, fn);
  return buf.toVertexData();
}

/**
 * Builds painted map meshes: every box face is assigned its tile's surface
 * style (override or theme default), and faces sharing a style merge into one
 * mesh, so draw calls scale with the number of distinct looks, not tiles.
 * Textures and materials are cached per scene.
 */
function terrainStyle(material: TerrainMaterial): ResolvedStyle {
  const def = coreMaterials.get(TERRAIN_SURFACES[material]) ?? coreMaterials.get('core.proto_floor')!;
  // Gravel's photo texture is near white in daylight; darken it so it reads as ground, not snow.
  return { material: def, tint: material === 'gravel' ? '#8f877b' : null };
}

export class MapStyler {
  private readonly textures: Map<string, RawTexture>;
  private readonly materials: Map<string, StandardMaterial>;
  private readonly images: Map<string, Texture>;
  private meshes: Mesh[] = [];
  private terrainMeshes: Mesh[] = [];

  /** `share`: reuse another styler's textures and materials (a second mesh set in the same scene, e.g. MapMaker's ghosted levels). */
  constructor(
    private readonly scene: Scene,
    share?: MapStyler,
  ) {
    this.textures = share?.textures ?? new Map();
    this.materials = share?.materials ?? new Map();
    this.images = share?.images ?? new Map();
  }

  build(doc: MapDocument, boxes: readonly WorldBox[], name = 'map'): Mesh[] {
    // Trim (baseboards, cornices, frames) is drawn with the structure but never collides.
    this.buildBoxes(doc, [...boxes, ...buildMapDecor(doc)], name);
    this.buildTerrain(doc, name);
    return this.meshes;
  }

  /** Style exactly these boxes (no trim, no terrain), replacing this styler's previous box meshes. */
  buildBoxes(doc: MapDocument, boxes: readonly WorldBox[], name = 'map'): Mesh[] {
    for (const m of this.meshes) m.dispose();
    const tiles = new Map<string, TilePlacement>(doc.classicStructure.tiles.map((t) => [t.id, t]));
    const groups = new Map<string, { style: ResolvedStyle; buf: FaceBuffer }>();
    const hidden = containedBoxes(boxes);
    for (let i = 0; i < boxes.length; i++) {
      const raw = boxes[i]!;
      if (raw.kind === 'prop' || raw.kind === 'barrier') continue; // drawn by the prop's model / invisible
      // A box wholly inside another (the shared wall of two neighbouring rooms) is never seen,
      // and its faces would sit exactly on the outer box's and flicker.
      if (hidden.has(i)) continue;
      // Partly overlapping pieces would still put faces in the same plane: grow each box by its
      // own small amount (2-14 mm, far enough apart for the depth buffer at range) so one wins.
      const g = 0.002 * (1 + (Math.imul(i + 1, 2654435761) >>> 0) % 7);
      const b: WorldBox = { ...raw, min: [raw.min[0] - g, raw.min[1] - g, raw.min[2] - g], max: [raw.max[0] + g, raw.max[1] + g, raw.max[2] + g] };
      const tile = tiles.get(b.sourceId);
      // Free blocks carry their own material on every face.
      const own = b.surface ? { material: coreMaterials.get(b.surface.material), tint: b.surface.tint } : null;
      for (const [corners, n, flat, fn] of boxFaces(b)) {
        const style = own?.material ? (own as ResolvedStyle) : resolveSurface(doc, tile, faceSlot(b, n));
        const key = styleKey(style);
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { style, buf: new FaceBuffer() }));
        g.buf.add(corners, n, 1 / style.material.scale, flat, fn);
      }
    }
    this.meshes = [...groups.entries()].map(([key, g]) => {
      const mesh = new Mesh(`${name}_${key}`, this.scene);
      g.buf.toVertexData().applyToMesh(mesh);
      mesh.material = this.material(g.style);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      return mesh;
    });
    return this.meshes;
  }

  /**
   * Terrain: one mesh per ground material holding that material's cells, with
   * normals taken from the height grid so lighting runs smoothly across
   * material borders. Rebuilt on its own while MapMaker brushes are dragged.
   */
  buildTerrain(doc: MapDocument, name = 'map'): void {
    for (const m of this.terrainMeshes) m.dispose();
    this.terrainMeshes = [];
    const t = doc.terrain;
    if (!t) return;
    const s = t.spacing;
    const y = (c: number, r: number) => vertexY(t, Math.max(0, Math.min(t.cols - 1, c)), Math.max(0, Math.min(t.rows - 1, r)));
    const normal = (c: number, r: number): [number, number, number] => {
      const nx = -(y(c + 1, r) - y(c - 1, r)) / (2 * s);
      const nz = -(y(c, r + 1) - y(c, r - 1)) / (2 * s);
      const l = Math.hypot(nx, 1, nz);
      return [nx / l, 1 / l, nz / l];
    };
    const byMaterial = new Map<number, number[]>();
    t.materials.forEach((m, i) => {
      let list = byMaterial.get(m);
      if (!list) byMaterial.set(m, (list = []));
      list.push(i);
    });
    for (const [m, cells] of byMaterial) {
      const material = TERRAIN_MATERIALS[m] ?? 'grass';
      const style = terrainStyle(material);
      const def = style.material;
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (const i of cells) {
        const c = i % (t.cols - 1);
        const r = Math.floor(i / (t.cols - 1));
        const base = positions.length / 3;
        for (const [dc, dr] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
          const x = t.origin[0] + (c + dc) * s;
          const z = t.origin[1] + (r + dr) * s;
          positions.push(x, y(c + dc, r + dr), z);
          normals.push(...normal(c + dc, r + dr));
          uvs.push(x / def.scale, z / def.scale);
        }
        // Same diagonal as the collision mesh (00-11), wound so the faces point up.
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const vd = new VertexData();
      vd.positions = positions;
      vd.normals = normals;
      vd.uvs = uvs;
      vd.indices = indices;
      const mesh = new Mesh(`${name}_terrain_${material}`, this.scene);
      vd.applyToMesh(mesh);
      mesh.material = this.material(style);
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      this.terrainMeshes.push(mesh);
    }
  }

  /** A library material with a tint (null: the theme's solids), for blocks drawn outside the level mesh. */
  surfaceMaterial(doc: MapDocument, material: string | null, tint: string | null): StandardMaterial {
    const def = material ? coreMaterials.get(material) : undefined;
    return this.material(def ? { material: def, tint } : resolveSurface(doc, undefined, 'solids'));
  }

  /** The material terrain of this kind is drawn in (the backdrop's ground uses it too). */
  groundMaterial(material: TerrainMaterial): StandardMaterial {
    return this.material(terrainStyle(material));
  }

  /** Metres per repeat of that ground's texture. */
  groundScale(material: TerrainMaterial): number {
    return terrainStyle(material).material.scale;
  }

  /** Sky colour of the map's theme. */
  static skyColor(doc: MapDocument): Color3 {
    return Color3.FromHexString(coreThemes.get(doc.classicStructure.theme)?.sky ?? '#85a0b8');
  }

  private texture(def: MaterialDefinition): RawTexture {
    let tex = this.textures.get(def.id);
    if (!tex) {
      // Raw pixel upload (no canvas) keeps WebGPU on a plain buffer write.
      tex = RawTexture.CreateRGBATexture(materialPixels(def), 128, 128, this.scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
      tex.wrapU = Texture.WRAP_ADDRESSMODE;
      tex.wrapV = Texture.WRAP_ADDRESSMODE;
      tex.anisotropicFilteringLevel = 8;
      this.textures.set(def.id, tex);
    }
    return tex;
  }

  /** A scanned texture map (shared JPEG), cached per scene. */
  private image(id: string, map: 'color' | 'normal' | 'emission'): Texture {
    const key = `${id}_${map}`;
    let tex = this.images.get(key);
    if (!tex) {
      tex = new Texture(versioned(`${import.meta.env.BASE_URL}textures/${key}.jpg`), this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
      tex.anisotropicFilteringLevel = 8;
      this.images.set(key, tex);
    }
    return tex;
  }

  private material(style: ResolvedStyle): StandardMaterial {
    const key = styleKey(style);
    let mat = this.materials.get(key);
    if (!mat) {
      const def = style.material;
      mat = new StandardMaterial(`mat_${key}`, this.scene);
      if (def.texture) {
        mat.diffuseTexture = this.image(def.texture, 'color');
        mat.bumpTexture = this.image(def.texture, 'normal');
        // OpenGL-convention normal maps in Babylon's left-handed space.
        mat.invertNormalMapY = true;
      } else mat.diffuseTexture = this.texture(def);
      mat.diffuseColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      mat.specularColor = new Color3(def.shine * 0.6, def.shine * 0.6, def.shine * 0.6);
      mat.specularPower = 16 + def.shine * 96;
      if (def.emissive && def.texture) {
        mat.emissiveTexture = this.image(def.texture, 'emission');
        mat.emissiveColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      } else if (def.emissive) {
        mat.emissiveTexture = this.texture(def);
        mat.emissiveColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      }
      this.materials.set(key, mat);
    }
    return mat;
  }
}

/**
 * Indices of axis-aligned boxes that lie wholly inside another (exact duplicates keep
 * the first). Neighbouring rooms each build their shared wall, giving identical boxes.
 */
export function containedBoxes(boxes: readonly WorldBox[]): Set<number> {
  const out = new Set<number>();
  const eps = 1e-4;
  // Sort by x extent so only boxes overlapping in x are compared.
  const order = boxes.map((_, i) => i).filter((i) => !boxes[i]!.yaw && boxes[i]!.kind !== 'prop' && boxes[i]!.kind !== 'barrier').sort((a, b) => boxes[a]!.min[0] - boxes[b]!.min[0]);
  for (let a = 0; a < order.length; a++) {
    const i = order[a]!;
    const bi = boxes[i]!;
    for (let c = a + 1; c < order.length; c++) {
      const j = order[c]!;
      const bj = boxes[j]!;
      if (bj.min[0] > bi.max[0] + eps) break;
      const inside = (p: WorldBox, q: WorldBox) => p.min.every((v, k) => v >= q.min[k]! - eps) && p.max.every((v, k) => v <= q.max[k]! + eps);
      if (inside(bj, bi) && !out.has(i)) out.add(j);
      else if (inside(bi, bj) && !out.has(j)) out.add(i);
    }
  }
  return out;
}
