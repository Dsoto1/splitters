import { describe, expect, it } from 'vitest';
import { applyCommand, invertCommand, layPathsIntoTerrain, loadMap, newMapDocument, newTerrain, serializeMap, terrainHeightAt, withPathsLaid, type MapDocument, type MapPath } from '../src/index.ts';

/** A map on a slope (rising 1 m every 4 m east) with one dirt path across it, west to east. */
function sloped(path: Partial<MapPath> = {}): MapDocument {
  const doc = newMapDocument('Paths');
  const t = newTerrain(40);
  for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) t.heights[r * t.cols + c] = Math.round(((t.origin[0] + c * t.spacing) / 4) * 100) + (r % 2 ? 60 : 0);
  return { ...doc, terrain: t, paths: [{ id: 'path_a', style: 'dirt', width: 4, points: [[-12, 0, 0], [12, 0, 0]], loop: false, lay: true, ...path }] };
}

describe('paths', () => {
  it('lay into the ground: level across, painted, and only near the path', () => {
    const doc = sloped();
    const t = layPathsIntoTerrain(doc.terrain!, doc.paths!);
    // Across the path the ground is level (the bumps every other row are gone under it).
    const across = [-1.5, 0, 1.5].map((z) => terrainHeightAt(t, 4, z)!);
    expect(Math.max(...across) - Math.min(...across)).toBeLessThan(0.05);
    // Far away it is untouched.
    expect(terrainHeightAt(t, 4, 16)).toBeCloseTo(terrainHeightAt(doc.terrain!, 4, 16)!, 5);
    // Painted dirt under it.
    const cell = (x: number, z: number) => Math.floor((z - t.origin[1]) / t.spacing) * (t.cols - 1) + Math.floor((x - t.origin[0]) / t.spacing);
    expect(t.materials[cell(0, 0.5)]).not.toBe(doc.terrain!.materials[cell(0, 0.5)]);
  });

  it('load lays them once, and a loaded map loads the same again', () => {
    const r1 = loadMap(serializeMap(sloped()));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.map.paths![0]!.lay).toBe(false);
    const r2 = loadMap(serializeMap(r1.map));
    expect(r2.ok && r2.map.terrain!.heights).toEqual(r1.map.terrain!.heights);
    // MapMaker keeps them apart.
    const ed = loadMap(serializeMap(sloped()), undefined, { forEditing: true });
    expect(ed.ok && ed.map.terrain!.heights).toEqual(sloped().terrain!.heights);
    expect(withPathsLaid(r1.map)).toBe(r1.map);
  });

  it('setPaths is one undoable step', () => {
    const doc = { ...sloped(), paths: undefined };
    const p = sloped().paths!;
    const cmd = { kind: 'setPaths' as const, before: null, after: p };
    const after = applyCommand(doc, cmd);
    expect(after.paths).toEqual(p);
    expect(applyCommand(after, invertCommand(cmd)).paths).toBeUndefined();
  });
});
