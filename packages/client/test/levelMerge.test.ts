import { describe, expect, it } from 'vitest';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MERGE_CHUNK, levelMipBias, mergeGeometry, planLayers, type MergeSource } from '../src/levelMerge.ts';

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

describe('level draw merging on a built level', () => {
  it("keeps every triangle of the level's styles, upper-storey floors (format v26) included", async () => {
    const { NullEngine } = await import('@babylonjs/core/Engines/nullEngine');
    const { Scene } = await import('@babylonjs/core/scene');
    const { MapStyler } = await import('../src/mapMeshes.ts');
    const { buildMapGeometry } = await import('@tiletrigger/shared');
    const { makeMap } = await import('../../shared/test/helpers.ts');
    const scene = new Scene(new NullEngine());
    const arch = { id: 't_arch', tile: 'imperial.triumphal_arch', x: 2, y: 3, z: 0, rotation: 0 as const };
    const plain = makeMap([arch], [[16, 4, 24]]);
    const floored = makeMap([{ ...arch, upperFloors: ['0,0,1'] }], [[16, 4, 24]]);
    const tris = (doc: typeof plain) => {
      const styler = new MapStyler(scene);
      styler.build(doc, buildMapGeometry(doc));
      const sources = styler.mergeSources();
      const before = sources.reduce((n, s) => n + s.mesh.getTotalIndices() / 3, 0);
      let after = 0;
      for (const group of planLayers(sources).values()) {
        const chunks = mergeGeometry(group, (m) => ({ positions: m.getVerticesData('position')!, normals: m.getVerticesData('normal')!, uvs: m.getVerticesData('uv')!, indices: m.getIndices()! }));
        for (const c of chunks.values()) after += c.indices.length / 3;
      }
      return { before, after, sources: sources.length };
    };
    const a = tris(plain);
    const b = tris(floored);
    expect(a.sources).toBeGreaterThan(0);
    expect(a.after).toBe(a.before);
    expect(b.after).toBe(b.before);
    // The added floor's slab is in the merge.
    expect(b.before).toBeGreaterThan(a.before);
    scene.dispose();
  });
});

describe('level depth bias (docs/LOOK.md, "No flicker: props")', () => {
  it('draws every level material a hair behind what lies in its planes (props flush on floors and walls win)', async () => {
    const { NullEngine } = await import('@babylonjs/core/Engines/nullEngine');
    const { Scene } = await import('@babylonjs/core/scene');
    const { MapStyler } = await import('../src/mapMeshes.ts');
    const { LEVEL_DEPTH_BIAS, buildMapGeometry } = await import('@tiletrigger/shared');
    const { makeMap } = await import('../../shared/test/helpers.ts');
    const scene = new Scene(new NullEngine());
    const doc = makeMap([{ id: 't_arch', tile: 'imperial.triumphal_arch', x: 2, y: 3, z: 0, rotation: 0 as const }], [[16, 4, 24]]);
    const styler = new MapStyler(scene);
    styler.build(doc, buildMapGeometry(doc));
    const sources = styler.mergeSources();
    expect(sources.length).toBeGreaterThan(0);
    expect(LEVEL_DEPTH_BIAS.factor).toBeGreaterThan(0);
    expect(LEVEL_DEPTH_BIAS.units).toBeGreaterThan(0);
    for (const s of sources) {
      expect(s.mesh.material?.zOffset).toBe(LEVEL_DEPTH_BIAS.factor);
      expect(s.mesh.material?.zOffsetUnits).toBe(LEVEL_DEPTH_BIAS.units);
    }
    expect(styler.surfaceMaterial(doc, 'core.concrete', null).zOffset).toBe(LEVEL_DEPTH_BIAS.factor);
    scene.dispose();
  });
});

describe('level mip bias (docs/LOOK.md, "No flicker: texture shimmer")', () => {
  it('none on a desktop at its usual scale, some on a phone drawing small, never past one level', () => {
    expect(levelMipBias(1, 1)).toBe(0);
    expect(levelMipBias(2, 1.25)).toBeLessThan(0.15);
    expect(levelMipBias(2.6, 0.75)).toBe(1);
    expect(levelMipBias(2, 1)).toBeCloseTo(0.42, 2);
    expect(levelMipBias(4, 0.25)).toBe(1);
  });
});
