// A terrain finer than 2 m (map format v32) is drawn at half its resolution on Low graphics; collision keeps every vertex.
import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { mapTerrainMesh, newMapDocument, newTerrain, resampleTerrain, terrainHeightAt, type MapDocument } from '@tiletrigger/shared';
import { MapStyler } from '../src/mapMeshes.ts';

function doc(spacing: number): MapDocument {
  const t = newTerrain(40, 2, [0, 0], 'grass', 30);
  t.heights = t.heights.map((_, i) => Math.round(200 * Math.sin((i % t.cols) * 0.5) + 100 * Math.cos(Math.floor(i / t.cols) * 0.4)));
  // Half the cells sand, so there are two materials (two meshes).
  t.materials = t.materials.map((_, i) => (i % 2 ? 3 : 0));
  return { ...newMapDocument('Draw test'), terrain: spacing === 2 ? t : resampleTerrain(t, spacing, 'exact') };
}

function drawn(d: MapDocument, step: number): { vertices: number; ys: Float32Array[] } {
  const scene = new Scene(new NullEngine());
  const styler = new MapStyler(scene);
  styler.terrainDrawStep = step;
  styler.buildTerrain(d, 't');
  const meshes = scene.meshes.filter((m) => m.name.startsWith('t_terrain_'));
  return { vertices: meshes.reduce((n, m) => n + m.getTotalVertices(), 0), ys: meshes.map((m) => m.getVerticesData('position') as Float32Array) };
}

describe('drawing a fine terrain', () => {
  it('Low graphics draws a 1 m terrain at every other vertex, on the surface it collides with', () => {
    const fine = doc(1);
    const t = fine.terrain!;
    const full = drawn(fine, 1);
    const low = drawn(fine, 2);
    expect(full.vertices).toBe((t.cols - 1) * (t.rows - 1) * 4);
    expect(low.vertices).toBe(full.vertices / 4);
    // Every drawn vertex is a terrain vertex (collision keeps them all: mapTerrainMesh is unchanged).
    for (const p of low.ys) for (let i = 0; i < p.length; i += 3) expect(p[i + 1]).toBeCloseTo(terrainHeightAt(t, p[i]!, p[i + 2]!)!, 3);
    expect(mapTerrainMesh(fine)!.positions.length / 3).toBe(t.cols * t.rows);
    // A grid of 2 m or more is drawn whole whatever the setting.
    const coarse = doc(2);
    expect(drawn(coarse, 2).vertices).toBe(drawn(coarse, 1).vertices);
  });

  it('an odd number of fine cells still reaches the far edge', () => {
    const odd = doc(1.25); // 40 m / 1.25 = 32 cells, 30 / 1.25 = 24; then 1.5 m: 27 × 20 cells
    const d = { ...odd, terrain: resampleTerrain(doc(2).terrain!, 1.5, 'exact') };
    const t = d.terrain!;
    const low = drawn(d, 2);
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const p of low.ys) for (let i = 0; i < p.length; i += 3) {
      maxX = Math.max(maxX, p[i]!);
      maxZ = Math.max(maxZ, p[i + 2]!);
    }
    expect(maxX).toBeCloseTo(t.origin[0] + (t.cols - 1) * t.spacing, 5);
    expect(maxZ).toBeCloseTo(t.origin[1] + (t.rows - 1) * t.spacing, 5);
  });
});
