import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyCommand, buildMapGeometry, invertCommand, layPathsIntoTerrain, pathDrawLevels, pathDrawRanks, pathIsRoad, pathGeometry, pathsExtent, terrainRaycast, loadMap, newMapDocument, newTerrain, serializeMap, terrainHeightAt, withPathsLaid, type MapDocument, type MapPath } from '../src/index.ts';

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

describe('pathDrawRanks', () => {
  const road = (id: string, points: [number, number, number][], extra: Partial<MapPath> = {}): MapPath => ({ id, points, closed: false, uses: ['road'], width: 10, style: 'dirt', lay: false, ...extra });

  it('puts a later overlapping path on top, so overlapping ribbons never share a height (Iron Maw crusher apron over its haul road)', () => {
    // A concrete apron that starts and ends on a haul road and runs along it in between.
    const haul = road('haul', [[-60, 0, 130], [0, 0, 145], [30, 0, 132]], { width: 13 });
    const apron = road('apron', [[-50, 0, 130], [-30, 0, 115], [0, 0, 117], [19, 0, 134]], { width: 12, style: 'concrete' });
    const far = road('far', [[-60, 0, -100], [30, 0, -100]]);
    const route = { ...road('route', [[-60, 0, 130], [30, 0, 132]]), uses: ['route' as const] };
    const ranks = pathDrawRanks([haul, route, apron, far]);
    expect(ranks.get('haul')).toBe(0);
    expect(ranks.get('apron')).toBe(1);
    // Paths that overlap nothing drawn before them stay as they were; routes aren't drawn at all.
    expect(ranks.get('far')).toBe(0);
    expect(ranks.has('route')).toBe(false);
    // A third path over both goes above the highest of them.
    expect(pathDrawRanks([haul, apron, road('spur', [[-40, 0, 120], [-40, 0, 160]])]).get('spur')).toBe(2);
  });

  it('puts the shipped Iron Maw\'s concrete crusher apron over the rim haul road it overlaps', () => {
    const loaded = loadMap(readFileSync(new URL('../../../maps/iron_maw.json', import.meta.url), 'utf8'));
    if (!loaded.ok) throw new Error('Iron Maw does not load');
    const ranks = pathDrawRanks(loaded.map.paths);
    expect(ranks.get('rim_haul_road')).toBe(0);
    expect(ranks.get('crusher_apron')).toBeGreaterThan(ranks.get('rim_haul_road')!);
  });

  it('draws a road over a footpath or trail that runs into it, whatever the list order (owner, 2026-11-13)', () => {
    const street = road('street', [[-40, 0, 0], [40, 0, 0]], { width: 7, style: 'asphalt' });
    // A cobbled footpath placed after the street, ending on it; a boardwalk (drawn a little proud of the ground) too.
    const walk = road('walk', [[0, 0, 30], [0, 0, 1]], { width: 3, style: 'cobble' });
    const boards = road('boards', [[20, 0, 30], [20, 0, 0]], { width: 2.5, style: 'planks' });
    expect(pathIsRoad(street)).toBe(true);
    expect(pathIsRoad(walk)).toBe(false);
    for (const list of [[street, walk, boards], [walk, boards, street]]) {
      const lv = pathDrawLevels(list);
      for (const id of ['walk', 'boards']) {
        // Lower in the depth bias (rank) and in height (lift): the road surface wins where they overlap.
        expect(lv.get(id)!.rank).toBeLessThan(lv.get('street')!.rank);
        expect(lv.get(id)!.lift).toBeLessThan(lv.get('street')!.lift);
      }
    }
    // Two footpaths keep the list order between them; so do two roads (the Iron Maw apron test above).
    const walk2 = road('walk2', [[-5, 0, 20], [5, 0, 20]], { width: 3, style: 'gravel' });
    expect(pathDrawRanks([walk, walk2]).get('walk2')).toBe(1);
    // A gravel track 5 m wide is a road; a 3 m dirt trail onto it goes under (Backwoods).
    expect(pathIsRoad(road('track', [[0, 0, 0], [1, 0, 0]], { width: 5, style: 'gravel' }))).toBe(true);
  });

  it('puts St. John\'s cobbled paths under the streets they join', () => {
    const loaded = loadMap(readFileSync(new URL('../../../maps/st_johns.json', import.meta.url), 'utf8'));
    if (!loaded.ok) throw new Error("St. John's does not load");
    const paths = loaded.map.paths ?? [];
    const lv = pathDrawLevels(paths);
    const roads = paths.filter((p) => lv.has(p.id) && pathIsRoad(p));
    const walks = paths.filter((p) => lv.has(p.id) && !pathIsRoad(p));
    expect(walks.length).toBeGreaterThan(0);
    let joins = 0;
    for (const w of walks) {
      for (const r of roads) {
        // Do these two overlap? (On their own, the second goes a rank up only if they do.)
        if (pathDrawLevels([w, r]).get(r.id)!.rank === 0) continue;
        joins++;
        expect(lv.get(w.id)!.rank, `${w.id} under ${r.id}`).toBeLessThan(lv.get(r.id)!.rank);
        expect(lv.get(w.id)!.lift, `${w.id} under ${r.id}`).toBeLessThan(lv.get(r.id)!.lift);
      }
    }
    // The owner's cobbled paths do join the streets and the concrete ways.
    expect(joins).toBeGreaterThan(3);
  });
});
