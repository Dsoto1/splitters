import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { BoxKind, WorldBox } from '@chronosplit/shared';

const TINTS: Record<BoxKind, string> = { floor: '#9aa0a8', wall: '#d9d6cf', solid: '#d98b3a' };

/** Prototype-theme materials, one per box kind, shared by the game view and the editor. */
export function createMapMaterials(scene: Scene): Record<BoxKind, StandardMaterial> {
  const grid = gridTexture(scene);
  const make = (kind: BoxKind) => {
    const mat = new StandardMaterial(`map_${kind}_mat`, scene);
    mat.diffuseTexture = grid;
    mat.diffuseColor = Color3.FromHexString(TINTS[kind]);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    return mat;
  };
  return { floor: make('floor'), wall: make('wall'), solid: make('solid') };
}

/** One merged mesh per box kind: three draw calls for the whole layout. */
export function buildMapMeshes(scene: Scene, boxes: readonly WorldBox[], materials: Record<BoxKind, StandardMaterial>, name = 'map'): Mesh[] {
  const meshes: Mesh[] = [];
  for (const kind of ['floor', 'wall', 'solid'] as const) {
    const ofKind = boxes.filter((b) => b.kind === kind);
    if (!ofKind.length) continue;
    const mesh = new Mesh(`${name}_${kind}`, scene);
    boxVertexData(ofKind).applyToMesh(mesh);
    mesh.material = materials[kind];
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    meshes.push(mesh);
  }
  return meshes;
}

/**
 * Grid texture (the classic "dev theme" look that makes scale readable). Built
 * from raw pixels rather than a canvas so WebGPU uploads it with a plain
 * buffer write instead of an external-image copy.
 */
function gridTexture(scene: Scene): RawTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = x < 2 || y < 2 || x >= size - 1 || y >= size - 1;
      const mid = Math.abs(x - size / 2) < 1 || Math.abs(y - size / 2) < 1;
      const v = edge ? 205 : mid ? 236 : 255;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

/** Box faces with flat normals and UVs in world metres (1 texture repeat per 2 m). */
export function boxVertexData(boxes: readonly WorldBox[]): VertexData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const uvScale = 0.5;
  for (const b of boxes) {
    const [x0, y0, z0] = b.min;
    const [x1, y1, z1] = b.max;
    // Each face: 4 corners and the outward normal. Babylon treats clockwise-from-outside as front-facing.
    const faces: [number[][], number[]][] = [
      [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
      [[[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]],
      [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]],
      [[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]],
      [[[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]],
      [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]],
    ];
    for (const [corners, n] of faces) {
      const base = positions.length / 3;
      for (const c of corners) {
        positions.push(c[0]!, c[1]!, c[2]!);
        normals.push(n[0]!, n[1]!, n[2]!);
        // Project onto the two axes perpendicular to the normal.
        const u = n[0] !== 0 ? c[2]! : c[0]!;
        const v = n[1] !== 0 ? c[2]! : c[1]!;
        uvs.push(u * uvScale, v * uvScale);
      }
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.indices = indices;
  return vd;
}
