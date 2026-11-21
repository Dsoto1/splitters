/**
 * A rank badge as the marker over a head (Options → Ranks & badges) (game/view.ts setTag; shapes in shared content/insignia.ts):
 * a flat mesh in the marker's colour (its material's emissive), with a thin dark rim behind it so it reads against a
 * bright sky or snow. One mesh per badge and colour, so a crowd's markers stay thin instances of it.
 */
import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { INSIGNIA_CUTS, INSIGNIA_SHAPES, type InsigniaId, type InsigniaPolygon } from '@tiletrigger/shared';

/** Half the badge's size, m (the arrow it replaces is about 0.12). */
export const INSIGNIA_HALF = 0.16;
/** The dark rim's width, in the shape's own units (its box is -1 to 1). */
const RIM = 0.1;
const RIM_COLOUR = [0.03, 0.04, 0.06, 1] as const;

/** The badge's triangles: the rim (the shape nudged eight ways, a little behind), then the shape, then its cuts in front. */
export function insigniaGeometry(id: InsigniaId, half = INSIGNIA_HALF): { positions: number[]; indices: number[]; colors: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const add = (dx: number, dy: number, z: number, c: readonly number[], list: readonly InsigniaPolygon[] = INSIGNIA_SHAPES[id]) => {
    for (const poly of list) {
      // Fanned from the centroid: every polygon is star-shaped about it (insignia.ts).
      let cx = 0, cy = 0;
      for (const [x, y] of poly) {
        cx += x;
        cy += y;
      }
      cx /= poly.length;
      cy /= poly.length;
      const base = positions.length / 3;
      positions.push((cx + dx) * half, (cy + dy) * half, z);
      colors.push(...c);
      for (const [x, y] of poly) {
        positions.push((x + dx) * half, (y + dy) * half, z);
        colors.push(...c);
      }
      for (let i = 0; i < poly.length; i++) indices.push(base, base + 1 + i, base + 1 + ((i + 1) % poly.length));
    }
  };
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    add(Math.cos(a) * RIM, Math.sin(a) * RIM, 0.004, RIM_COLOUR);
  }
  add(0, 0, 0, [1, 1, 1, 1]);
  // Cuts (a skull's eyes, a gear's hole) in the rim's colour, a little in front.
  add(0, 0, -0.003, RIM_COLOUR, INSIGNIA_CUTS[id]);
  return { positions, indices, colors };
}

/** The badge as a mesh, lit by nothing but its colour (as the arrow is); both faces drawn. */
export function createInsigniaMesh(name: string, id: InsigniaId, color: string, scene: Scene): Mesh {
  const mesh = new Mesh(name, scene);
  const g = insigniaGeometry(id);
  const vd = new VertexData();
  vd.positions = g.positions;
  vd.indices = g.indices;
  vd.colors = g.colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(g.positions, g.indices, normals);
  vd.normals = normals;
  vd.applyToMesh(mesh);
  const mat = new StandardMaterial(`${name}mat`, scene);
  mat.emissiveColor = Color3.FromHexString(color);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mesh.material = mat;
  return mesh;
}
