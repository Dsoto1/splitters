import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { buildMapDecor, coreThemes, faceSlot, resolveSurface, styleKey, type MapDocument, type MaterialDefinition, type ResolvedStyle, type TilePlacement, type WorldBox } from '@chronosplit/shared';
import { materialPixels } from './materials/patterns.ts';

/** Faces of an axis-aligned box: corners (clockwise from outside, Babylon's front face) and outward normal. */
function boxFaces(b: WorldBox): [number[][], [number, number, number]][] {
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
  add(corners: number[][], n: readonly [number, number, number], uvScale: number): void {
    const base = this.positions.length / 3;
    for (const c of corners) {
      this.positions.push(c[0]!, c[1]!, c[2]!);
      this.normals.push(n[0], n[1], n[2]);
      // Project onto the two axes perpendicular to the normal.
      const u = n[0] !== 0 ? c[2]! : c[0]!;
      const v = n[1] !== 0 ? c[2]! : c[1]!;
      this.uvs.push(u * uvScale, v * uvScale);
    }
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
  for (const b of boxes) for (const [corners, n] of boxFaces(b)) buf.add(corners, n, 0.5);
  return buf.toVertexData();
}

/**
 * Builds painted map meshes: every box face is assigned its tile's surface
 * style (override or theme default), and faces sharing a style merge into one
 * mesh, so draw calls scale with the number of distinct looks, not tiles.
 * Textures and materials are cached per scene.
 */
export class MapStyler {
  private readonly textures = new Map<string, RawTexture>();
  private readonly materials = new Map<string, StandardMaterial>();
  private meshes: Mesh[] = [];

  constructor(private readonly scene: Scene) {}

  build(doc: MapDocument, boxes: readonly WorldBox[], name = 'map'): Mesh[] {
    for (const m of this.meshes) m.dispose();
    const tiles = new Map<string, TilePlacement>(doc.classicStructure.tiles.map((t) => [t.id, t]));
    const groups = new Map<string, { style: ResolvedStyle; buf: FaceBuffer }>();
    // Trim (baseboards, cornices, frames) is drawn with the structure but never collides.
    for (const b of [...boxes, ...buildMapDecor(doc)]) {
      const tile = tiles.get(b.sourceId);
      for (const [corners, n] of boxFaces(b)) {
        const style = resolveSurface(doc, tile, faceSlot(b, n));
        const key = styleKey(style);
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { style, buf: new FaceBuffer() }));
        g.buf.add(corners, n, 1 / style.material.scale);
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

  private material(style: ResolvedStyle): StandardMaterial {
    const key = styleKey(style);
    let mat = this.materials.get(key);
    if (!mat) {
      const def = style.material;
      mat = new StandardMaterial(`mat_${key}`, this.scene);
      mat.diffuseTexture = this.texture(def);
      mat.diffuseColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      mat.specularColor = new Color3(def.shine * 0.6, def.shine * 0.6, def.shine * 0.6);
      mat.specularPower = 16 + def.shine * 96;
      if (def.emissive) {
        mat.emissiveTexture = this.texture(def);
        mat.emissiveColor = style.tint ? Color3.FromHexString(style.tint) : Color3.White();
      }
      this.materials.set(key, mat);
    }
    return mat;
  }
}
