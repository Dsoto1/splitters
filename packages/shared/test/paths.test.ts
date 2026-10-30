import { describe, expect, it } from 'vitest';
import { applyCommand, buildMapGeometry, invertCommand, layPathsIntoTerrain, pathGeometry, pathsExtent, terrainRaycast, loadMap, newMapDocument, newTerrain, serializeMap, terrainHeightAt, withPathsLaid, type MapDocument, type MapPath } from '../src/index.ts';

/** A map on a slope (rising 1 m every 4 m east) with one dirt path across it, west to east. */
function sloped(path: Partial<MapPath> = {}): MapDocument {
  const doc = newMapDocument('Paths');
  const t = newTerrain(40);
  for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) t.heights[r * t.cols + c] = Math.round(((t.origin[0] + c * t.spacing) / 4) * 100) + (r % 2 ? 60 : 0);
  return { ...doc, terrain: t, paths: [{ id: 'path_a', style: 'dirt', width: 4, points: [[-12, 0, 0], [12, 0, 0]], closed: false, uses: ['road'], lay: true, ...path }] };
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
    // Painted dirt only where a whole cell is under it: a 4 m path on a 2 m grid covers no whole cell, so no
    // squares of paint stick out past its edges.
    const cell = (x: number, z: number) => Math.floor((z - t.origin[1]) / t.spacing) * (t.cols - 1) + Math.floor((x - t.origin[0]) / t.spacing);
    expect(t.materials).toEqual(doc.terrain!.materials);
    const wide = sloped({ width: 8 });
    const tw = layPathsIntoTerrain(wide.terrain!, wide.paths!);
    expect(tw.materials[cell(0, 0.5)]).not.toBe(wide.terrain!.materials[cell(0, 0.5)]);
    expect(tw.materials[cell(0, 3.5)]).toBe(wide.terrain!.materials[cell(0, 3.5)]);
  });

  it('load lays them once, and a loaded map loads the same again', () => {
    const r1 = loadMap(serializeMap(sloped()));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.map.paths![0]!.lay).toBe(false);
    const r2 = loadMap(serializeMap(r1.map));
    expect(r2.ok && r2.map.terrain!.heights).toEqual(r1.map.terrain!.heights);
    // MapMaker keeps them apart: the ground is as it would be with no paths (only lowered under floors).
    const ed = loadMap(serializeMap(sloped()), undefined, { forEditing: true });
    const none = loadMap(serializeMap({ ...sloped(), paths: undefined }), undefined, { forEditing: true });
    expect(ed.ok && ed.map.paths![0]!.lay).toBe(true);
    expect(ed.ok && ed.map.terrain!.heights).toEqual(none.ok && none.map.terrain!.heights);
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

  it('the curve passes through every point and never doubles back, even at sharp, uneven corners', () => {
    // A long stretch, then a short hook and a hairpin: uniform Catmull-Rom overshoots and loops here.
    const p: MapPath = { id: 'path_z', style: 'dirt', width: 6, points: [[-30, 0, 0], [0, 0, 0], [1, 0, 2], [-20, 0, 3], [-20, 0, 20]], closed: false, uses: ['road'], lay: false };
    const g = pathGeometry(p);
    for (const q of p.points) {
      const near = g.nearest(q[0], q[2], 5)!;
      expect(near.dist).toBeLessThan(0.05);
    }
    // Consecutive samples go forwards along their own tangent, about a metre apart.
    for (let i = 1; i < g.samples.length; i++) {
      const a = g.samples[i - 1]!;
      const b = g.samples[i]!;
      expect((b.x - a.x) * a.dx + (b.z - a.z) * a.dz).toBeGreaterThan(0);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1.6);
    }
  });

  it('a map with no terrain has ground under its paths, past the buildings', () => {
    const doc = { ...newMapDocument('Road'), paths: [{ id: 'path_r', style: 'dirt' as const, width: 4, points: [[0, 0, 10], [0, 0, 60]] as [number, number, number][], closed: false, uses: ['road' as const], lay: true }] };
    expect(pathsExtent(doc.paths)!.max[1]).toBeGreaterThanOrEqual(62);
    const slab = buildMapGeometry(doc).find((b) => b.kind === 'barrier' && b.sourceId === 'ground' && b.max[1] - b.min[1] < 3)!;
    expect(slab.max[2]).toBeGreaterThan(62);
    // The fence round that ground stands past the road's end.
    expect(buildMapGeometry({ ...doc, paths: undefined }).find((b) => b.sourceId === 'ground')!.max[2]).toBeLessThan(40);
  });

  it('MapMaker finds the ground from far out (the camera zoomed right back)', () => {
    const doc = sloped();
    const hit = terrainRaycast(doc.terrain!, { x: 0, y: 250, z: -700 }, (() => {
      const d = { x: 0, y: -250, z: 700 };
      const l = Math.hypot(d.x, d.y, d.z);
      return { x: d.x / l, y: d.y / l, z: d.z / l };
    })());
    expect(hit).not.toBeNull();
    expect(Math.abs(hit!.y - terrainHeightAt(doc.terrain!, hit!.x, hit!.z)!)).toBeLessThan(0.05);
  });
});
