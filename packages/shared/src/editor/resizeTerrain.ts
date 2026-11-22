import type { MapBounds, MapDocument, MapEntity } from '../map/schema.ts';
import { MAX_TERRAIN_VERTS, terrainHeightAt, type TerrainData } from '../map/terrain.ts';
import type { EditCommand } from './commands.ts';

/**
 * Terrain → Resize (MapMaker; owner, 2026-11-16: "am I able to resize a map terrain without removing it first?"): the
 * terrain grown or shrunk at each edge by whole cells, at the grid it has (Change grid changes the detail; this the
 * size). Every height, painted cell and plant that stays keeps its exact place; one command, one undo step.
 *
 * - **New ground** continues the edge it grows from: `flat` carries the edge's heights straight out; `eased` eases
 *   them over the new strip to the terrain's base (0 cm: its `baseY`), so a raised edge slopes down into the new
 *   ground instead of ending in a wall. Its paint and plant cover are the edge cells' own.
 * - **Cut-off ground** goes, and with it the things standing on it (spawns, pickups, props, plants and the rest of the
 *   entities whose foot is within 1.5 m of the old ground there): the plan lists them before it runs.
 * - **The boundary** (the map's `bounds`) follows: an edge that lay on the terrain's edge moves with it; any edge left
 *   outside the new terrain comes in to it. Maps without bounds play to the terrain's edge (the boundary, backdrop and
 *   minimap all follow the terrain already).
 *
 * Edges are north (+Z), south (-Z), east (+X) and west (-X), in cells (`spacing` m): positive grows, negative shrinks.
 */
export interface TerrainEdges {
  north: number;
  south: number;
  east: number;
  west: number;
}
export type ResizeFill = 'flat' | 'eased';
export const TERRAIN_EDGES = ['north', 'south', 'east', 'west'] as const;

export interface ResizePlan {
  cols: number;
  rows: number;
  vertices: number;
  before: number;
  /** The terrain's size after (m), and now. */
  width: number;
  depth: number;
  widthBefore: number;
  depthBefore: number;
  /** Things standing on ground that is cut off (they go with it). */
  cut: MapEntity[];
  /** Why it can't be done, or null. */
  error: string | null;
}

/** Things on the ground: their foot within this of the old ground (m), above or below. */
const ON_GROUND = 1.5;

/** What resizing `doc`'s terrain by `edges` would make, and whether it can. */
export function planResize(doc: MapDocument, edges: TerrainEdges): ResizePlan {
  const t = doc.terrain!;
  const cols = t.cols + edges.east + edges.west;
  const rows = t.rows + edges.north + edges.south;
  const plan: ResizePlan = { cols, rows, vertices: cols * rows, before: t.cols * t.rows, width: (cols - 1) * t.spacing, depth: (rows - 1) * t.spacing, widthBefore: (t.cols - 1) * t.spacing, depthBefore: (t.rows - 1) * t.spacing, cut: [], error: null };
  if (TERRAIN_EDGES.some((k) => !Number.isInteger(edges[k]))) plan.error = 'edges move by whole cells';
  else if (TERRAIN_EDGES.every((k) => edges[k] === 0)) plan.error = 'no edge moves';
  else if (cols < 2 || rows < 2 || plan.width < 8 || plan.depth < 8) plan.error = 'the terrain would be too small (at least 8 m each way)';
  else if (cols > MAX_TERRAIN_VERTS || rows > MAX_TERRAIN_VERTS) plan.error = `${cols} × ${rows} vertices: at most ${MAX_TERRAIN_VERTS} a side at ${t.spacing} m (a coarser grid first: Change grid)`;
  if (plan.error) return plan;
  const x0 = t.origin[0] - edges.west * t.spacing;
  const z0 = t.origin[1] - edges.south * t.spacing;
  const x1 = x0 + plan.width;
  const z1 = z0 + plan.depth;
  for (const e of doc.entities) {
    const [x, y, z] = e.position;
    if (x >= x0 - 1e-6 && x <= x1 + 1e-6 && z >= z0 - 1e-6 && z <= z1 + 1e-6) continue;
    const g = terrainHeightAt(t, x, z);
    if (g !== null && Math.abs(y - g) <= ON_GROUND) plan.cut.push(e);
  }
  return plan;
}

/** The terrain grown or shrunk by `edges` (see the module comment). The input isn't changed. */
export function resizeTerrain(t: TerrainData, edges: TerrainEdges, fill: ResizeFill = 'flat'): TerrainData {
  const cols = t.cols + edges.east + edges.west;
  const rows = t.rows + edges.north + edges.south;
  // Old vertex (c, r) is new vertex (c + west, r + south).
  const heights: number[] = new Array(cols * rows);
  const clampC = (c: number) => Math.max(0, Math.min(t.cols - 1, c));
  const clampR = (r: number) => Math.max(0, Math.min(t.rows - 1, r));
  // How far out into new ground a vertex is (0 on old ground), against the width of the strip it is in.
  const out = (v: number, n: number, lo: number, hi: number) => (v < 0 ? -v / Math.max(1, lo) : v > n - 1 ? (v - (n - 1)) / Math.max(1, hi) : 0);
  for (let r = 0; r < rows; r++) {
    const or = r - edges.south;
    for (let c = 0; c < cols; c++) {
      const oc = c - edges.west;
      const h = t.heights[clampR(or) * t.cols + clampC(oc)]!;
      if (fill === 'flat') {
        heights[r * cols + c] = h;
        continue;
      }
      // Eased: from the edge's height to the base, a smooth step over the new strip (the further way out wins in a corner).
      const k = Math.min(1, Math.max(out(oc, t.cols, edges.west, edges.east), out(or, t.rows, edges.south, edges.north)));
      const s = k * k * (3 - 2 * k);
      heights[r * cols + c] = Math.round(h * (1 - s));
    }
  }
  const cells = (layer: readonly number[]) => {
    const w = t.cols - 1;
    const h = t.rows - 1;
    const outCells: number[] = new Array((cols - 1) * (rows - 1));
    for (let r = 0; r < rows - 1; r++) {
      const or = Math.max(0, Math.min(h - 1, r - edges.south));
      for (let c = 0; c < cols - 1; c++) outCells[r * (cols - 1) + c] = layer[or * w + Math.max(0, Math.min(w - 1, c - edges.west))] ?? 0;
    }
    return outCells;
  };
  return {
    ...t,
    origin: [t.origin[0] - edges.west * t.spacing, t.origin[1] - edges.south * t.spacing],
    cols,
    rows,
    heights,
    materials: cells(t.materials),
    foliage: t.foliage.length === (t.cols - 1) * (t.rows - 1) ? cells(t.foliage) : [],
  };
}

/** The map's boundary after the resize: edges on the old terrain's edge move with it; none is left outside the new one. */
export function resizedBounds(bounds: MapBounds, before: TerrainData, after: TerrainData): MapBounds {
  const ext = (t: TerrainData) => ({ x0: t.origin[0], z0: t.origin[1], x1: t.origin[0] + (t.cols - 1) * t.spacing, z1: t.origin[1] + (t.rows - 1) * t.spacing });
  const a = ext(before);
  const b = ext(after);
  const near = (u: number, v: number) => Math.abs(u - v) < 0.5;
  const min: [number, number] = [near(bounds.min[0], a.x0) ? b.x0 : Math.max(bounds.min[0], b.x0), near(bounds.min[1], a.z0) ? b.z0 : Math.max(bounds.min[1], b.z0)];
  const max: [number, number] = [near(bounds.max[0], a.x1) ? b.x1 : Math.min(bounds.max[0], b.x1), near(bounds.max[1], a.z1) ? b.z1 : Math.min(bounds.max[1], b.z1)];
  return { ...bounds, min, max };
}

export interface ResizeResult {
  command: EditCommand;
  terrain: TerrainData;
  plan: ResizePlan;
}

/** The Resize command: the terrain (one `setTerrain`), the things on cut-off ground removed, the boundary followed; one undo step. */
export function resizeTerrainCommand(doc: MapDocument, edges: TerrainEdges, fill: ResizeFill = 'flat'): ResizeResult | { error: string } {
  const t = doc.terrain;
  if (!t) return { error: 'the map has no terrain' };
  const plan = planResize(doc, edges);
  if (plan.error) return { error: plan.error };
  const after = resizeTerrain(t, edges, fill);
  const commands: EditCommand[] = [{ kind: 'setTerrain', before: t, after }];
  if (plan.cut.length) commands.push({ kind: 'removeEntities', entities: plan.cut });
  if (doc.bounds) {
    const b = resizedBounds(doc.bounds, t, after);
    if (b.min.some((v, i) => v !== doc.bounds!.min[i]) || b.max.some((v, i) => v !== doc.bounds!.max[i])) commands.push({ kind: 'setBounds', before: doc.bounds, after: b });
  }
  return { command: commands.length === 1 ? commands[0]! : { kind: 'batch', commands }, terrain: after, plan };
}
