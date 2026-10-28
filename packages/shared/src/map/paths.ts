import { TrackGeometry } from './track.ts';
import { TERRAIN_MATERIALS, terrainHeightAt, type TerrainData, type TerrainMaterial } from './terrain.ts';
import { Track, type MapDocument, type MapPath, type PathStyle } from './schema.ts';

/**
 * Paths: roads, streets, trails and walkways drawn in MapMaker. Each is a
 * smooth curve through its points (the race track's own centre-line code),
 * `width` wide. A path that `lay`s levels the ground under it to the curve,
 * blends its edges back into the hills, paints the cells under it and clears
 * their plants. That is worked out when a map is loaded for play
 * (layPathsIntoTerrain, from loadMap), never stored, so MapMaker can move a
 * path and the ground follows. Paths are drawn only; nothing collides with
 * one, the ground under it is what you walk and drive on.
 */

/** Per style: the surface drawn (materials.ts), the ground painted under it, and edge lines. */
export const PATH_LOOKS: Record<PathStyle, { label: string; surface: string; tint: string | null; ground: TerrainMaterial; lines: boolean }> = {
  asphalt: { label: 'Asphalt road', surface: 'core.pbr_asphalt', tint: null, ground: 'gravel', lines: true },
  concrete: { label: 'Concrete', surface: 'core.pbr_concrete', tint: null, ground: 'gravel', lines: false },
  cobble: { label: 'Cobbles', surface: 'core.pbr_mossy_cobble', tint: null, ground: 'gravel', lines: false },
  flagstone: { label: 'Flagstones', surface: 'core.pbr_flagstone', tint: null, ground: 'stone', lines: false },
  gravel: { label: 'Gravel', surface: 'core.pbr_gravel', tint: null, ground: 'gravel', lines: false },
  dirt: { label: 'Dirt trail', surface: 'core.pbr_dusty_road', tint: null, ground: 'dirt', lines: false },
  sand: { label: 'Sand', surface: 'core.pbr_sand', tint: null, ground: 'sand', lines: false },
  planks: { label: 'Boardwalk', surface: 'core.pbr_weathered_planks', tint: null, ground: 'dirt', lines: false },
};

const geometry = new WeakMap<MapPath, TrackGeometry>();
/** The path's centre line (cached per path object). */
export function pathGeometry(p: MapPath): TrackGeometry {
  let g = geometry.get(p);
  if (!g) {
    // The race track's centre-line code, with only what a path has.
    const shape = Track.parse({ points: p.points, width: Math.max(5, p.width), loop: p.loop });
    g = new TrackGeometry({ ...shape, width: p.width });
    geometry.set(p, g);
  }
  return g;
}

const smooth = (v: number): number => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};

/**
 * The terrain with every laid path in it: under a path the ground is the
 * path's height, flat across; over `shoulder` metres either side it blends
 * back; the cells under it are painted the path's ground and lose their
 * plants. Returns the same terrain when no path lays.
 */
export function layPathsIntoTerrain(t: TerrainData, paths: readonly MapPath[]): TerrainData {
  const laid = paths.filter((p) => p.lay && p.points.length >= 2);
  if (!laid.length) return t;
  const heights = t.heights.slice();
  const materials = t.materials.slice();
  const foliage = t.foliage.length ? t.foliage.slice() : [];
  for (const p of laid) {
    const g = pathGeometry(p);
    const half = p.width / 2;
    const shoulder = Math.min(4, Math.max(1, p.width * 0.6));
    // Only the terrain round the path: its bounding box plus the shoulders.
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const s of g.samples) {
      x0 = Math.min(x0, s.x);
      x1 = Math.max(x1, s.x);
      z0 = Math.min(z0, s.z);
      z1 = Math.max(z1, s.z);
    }
    // The path's height: the ground along it, smoothed (an average over ~12 m), so it follows the hills
    // instead of cutting straight between its points, and stays level across.
    const ground = g.samples.map((q) => terrainHeightAt(t, q.x, q.z) ?? q.y);
    const target = ground.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let k = -3; k <= 3; k++) {
        const j = g.loop ? (i + k + ground.length) % ground.length : i + k;
        const v = ground[j];
        if (v === undefined) continue;
        sum += v;
        n++;
      }
      return sum / n;
    });
    const reach = half + shoulder + 1;
    const c0 = Math.max(0, Math.floor((x0 - reach - t.origin[0]) / t.spacing));
    const c1 = Math.min(t.cols - 1, Math.ceil((x1 + reach - t.origin[0]) / t.spacing));
    const r0 = Math.max(0, Math.floor((z0 - reach - t.origin[1]) / t.spacing));
    const r1 = Math.min(t.rows - 1, Math.ceil((z1 + reach - t.origin[1]) / t.spacing));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = t.origin[0] + c * t.spacing;
        const z = t.origin[1] + r * t.spacing;
        const near = g.nearest(x, z, reach + 1);
        if (!near) continue;
        const d = Math.abs(near.lateral);
        if (d > half + shoulder || near.dist > reach) continue;
        const i = r * t.cols + c;
        const want = Math.round((target[near.index]! - t.baseY) * 100);
        const k = d <= half + 0.5 ? 1 : 1 - smooth((d - half - 0.5) / shoulder);
        heights[i] = Math.round(heights[i]! + (want - heights[i]!) * k);
      }
    }
    const paint = TERRAIN_MATERIALS.indexOf(PATH_LOOKS[p.style].ground);
    for (let r = r0; r < Math.min(r1, t.rows - 1); r++) {
      for (let c = c0; c < Math.min(c1, t.cols - 1); c++) {
        const x = t.origin[0] + (c + 0.5) * t.spacing;
        const z = t.origin[1] + (r + 0.5) * t.spacing;
        const near = g.nearest(x, z, half + 2);
        if (!near || Math.abs(near.lateral) > half + t.spacing * 0.35) continue;
        const i = r * (t.cols - 1) + c;
        if (paint >= 0) materials[i] = paint;
        if (foliage.length) foliage[i] = 0;
      }
    }
  }
  return { ...t, heights, materials, foliage };
}

/**
 * The map as played: its terrain with the paths laid in, and each path
 * marked as laid (`lay: false`), so laying again (a host's map loaded by its
 * players) changes nothing. loadMap does this; MapMaker shows it without storing it.
 */
export function withPathsLaid(map: MapDocument): MapDocument {
  if (!map.terrain || !map.paths?.some((p) => p.lay)) return map;
  return { ...map, terrain: layPathsIntoTerrain(map.terrain, map.paths), paths: map.paths.map((p) => (p.lay ? { ...p, lay: false } : p)) };
}
