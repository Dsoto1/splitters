import { describe, expect, it } from 'vitest';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MERGE_CHUNK, mergeGeometry, planLayers, type MergeSource } from '../src/levelMerge.ts';

/** A quad (two triangles) at x..x+1 on the ground, as a fake mesh. */
function quad(x: number): { mesh: Mesh; geo: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } } {
  const mesh = { name: `q${x}` } as unknown as Mesh;
  return {
    mesh,
    geo: {
      positions: [x, 0, 0, x + 1, 0, 0, x + 1, 0, 1, x, 0, 1],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    },
  };
}

const px = async () => new Uint8Array(4);
const source = (mesh: Mesh, key: string, size: number, normal: boolean, tint = Color3.White()): MergeSource => ({
  mesh,
  key,
  size,
  color: px,
  normal: normal ? px : null,
  tint,
  specular: 0.3,
  power: 40,
});

describe('level draw merging', () => {
  it('groups surfaces by texture size, one layer per texture whatever its tints', () => {
    const a = quad(0);
    const b = quad(2);
    const c = quad(4);
    const d = quad(6);
    const groups = planLayers([
      source(a.mesh, 'img:Bricks', 512, true, new Color3(0.8, 0.8, 0.8)),
      source(b.mesh, 'img:Bricks', 512, true),
      source(c.mesh, 'img:Planks', 512, true),
      source(d.mesh, 'pat:core.stripes', 128, false),
    ]);
    expect([...groups.keys()].sort()).toEqual([128, 512]);
    const big = groups.get(512)!;
    expect(big.colorLayer.size).toBe(2);
    expect(big.normalLayer.size).toBe(2);
    expect(groups.get(128)!.normalLayer.size).toBe(0);
  });

  it('keeps every triangle, with its surface layers, tint and shine on each vertex, cut into chunks', () => {
    const a = quad(0);
    const far = quad(MERGE_CHUNK + 3);
    const geo = new Map([
      [a.mesh, a.geo],
      [far.mesh, far.geo],
    ]);
    const tint = new Color3(0.5, 0.25, 1);
    const group = planLayers([source(a.mesh, 'img:Bricks', 512, true, tint), source(far.mesh, 'img:Planks', 512, false)]).get(512)!;
    const chunks = mergeGeometry(group, (m) => geo.get(m) ?? null);
    expect(chunks.size).toBe(2);
    const near = chunks.get('0:0')!;
    expect(near.indices.length).toBe(6);
    expect(near.positions.length).toBe(12);
    expect(near.a.slice(0, 4)).toEqual([0.5, 0.25, 1, 0]);
    expect(near.b.slice(0, 3)).toEqual([0, 0.3, 40]);
    const other = chunks.get('1:0')!;
    // Its colour is layer 1; no normal map (-1).
    expect(other.a[3]).toBe(1);
    expect(other.b[0]).toBe(-1);
    // Triangles keep their winding.
    expect(other.indices).toEqual([0, 1, 2, 0, 2, 3]);
  });
});
