import type { MapDocument, MapEntity } from '../map/schema.ts';
import { MAX_TERRAIN_VERTS, terrainHeightAt, type TerrainData } from '../map/terrain.ts';
import type { EditCommand } from './commands.ts';

/**
 * Terrain → Change grid (MapMaker; map format v32 raised the grid to 321 vertices a side): the terrain resampled to
 * vertices a new distance apart, finer or coarser, over the same ground. Heights, ground paint and plant cover all
 * come across; one command, one undo step.
 *
 * - **Heights.** A vertex that lands on an old one keeps its height exactly. Between them, `smooth` (the default)
 *   draws a cubic through the old heights (rolling ground stops looking faceted), held inside the old cell's lowest
 *   and highest corner, and goes over to the old surface itself (the triangles as drawn and collided) wherever the
 *   ground round it is steep: a cliff keeps its sharp foot and lip instead of rounding into a slope players could
 *   climb. `exact` takes the old surface everywhere (halving the spacing then draws and collides exactly as before).
 * - **Paint and plants** (per cell): going finer, each new cell takes the old cell it lies in; going coarser, the
 *   one most of the old cells it covers have.
 * - **Size.** The grid keeps its south-west corner; it is as many whole new cells across as fit the old width best,
 *   so a width that isn't a whole number of new cells grows or shrinks by under half a cell (the plan says so).
 */

/** The spacings Change grid offers (m). The schema allows 0.5-8. */
export const GRID_SPACINGS = [1, 1.25, 1.5, 2, 2.5, 3, 4] as const;
export type GridInterpolation = 'smooth' | 'exact';

/** Below this slope (rise over run) the cubic is used as it is; above STEEP_TO the old surface (a 30° to 45° blend). */
const STEEP_FROM = Math.tan((30 * Math.PI) / 180);
const STEEP_TO = 1;

export interface GridPlan {
  spacing: number;
  cols: number;
  rows: number;
  vertices: number;
  /** Vertices now. */
  before: number;
  /** The terrain's size after (m), and now. */
  width: number;
  depth: number;
  widthBefore: number;
  depthBefore: number;
  /** Why it can't be done, or null. */
  error: string | null;
}

/** What changing `t` to `spacing` m would make (the dialog's preview), and whether it can. */
export function planGrid(t: TerrainData, spacing: number): GridPlan {
  const widthBefore = (t.cols - 1) * t.spacing;
  const depthBefore = (t.rows - 1) * t.spacing;
  const cols = Math.max(2, Math.round(widthBefore / spacing) + 1);
  const rows = Math.max(2, Math.round(depthBefore / spacing) + 1);
  const plan: GridPlan = { spacing, cols, rows, vertices: cols * rows, before: t.cols * t.rows, width: (cols - 1) * spacing, depth: (rows - 1) * spacing, widthBefore, depthBefore, error: null };
  if (!(spacing >= 0.5 && spacing <= 8)) plan.error = 'the grid is 0.5 to 8 m';
  else if (Math.abs(spacing - t.spacing) < 1e-9) plan.error = `the terrain is already ${t.spacing} m apart`;
  else if (cols > MAX_TERRAIN_VERTS || rows > MAX_TERRAIN_VERTS) plan.error = `${cols} × ${rows} vertices: at most ${MAX_TERRAIN_VERTS} a side (a ${Math.round(Math.max(widthBefore, depthBefore))} m terrain can go down to ${minSpacing(Math.max(widthBefore, depthBefore))} m)`;
  return plan;
}

/** The finest of GRID_SPACINGS that fits `metres` within MAX_TERRAIN_VERTS. */
function minSpacing(metres: number): number {
  return GRID_SPACINGS.find((s) => Math.round(metres / s) + 1 <= MAX_TERRAIN_VERTS) ?? 4;
}

/** The terrain resampled to vertices `spacing` m apart (see the module comment). The input isn't changed. */
export function resampleTerrain(t: TerrainData, spacing: number, mode: GridInterpolation = 'smooth'): TerrainData {
  const plan = planGrid(t, spacing);
  const { cols, rows } = plan;
  const ratio = spacing / t.spacing;
  const steep = mode === 'smooth' ? cellSteepness(t) : null;
  const heights: number[] = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const fz = Math.min(t.rows - 1, r * ratio);
    for (let c = 0; c < cols; c++) {
      const fx = Math.min(t.cols - 1, c * ratio);
      heights[r * cols + c] = Math.round(Math.max(-5000, Math.min(20000, steep ? smoothAt(t, fx, fz, steep) : linearAt(t, fx, fz))));
    }
  }
  const cells = (cols - 1) * (rows - 1);
  const materials = resampleCells(t, t.materials, cols, rows, spacing, 8);
  const foliage = t.foliage.length === (t.cols - 1) * (t.rows - 1) ? resampleCells(t, t.foliage, cols, rows, spacing, 5) : [];
  return { ...t, spacing, cols, rows, heights, materials: materials.length === cells ? materials : new Array(cells).fill(0), foliage };
}

const at = (t: TerrainData, c: number, r: number): number => t.heights[Math.max(0, Math.min(t.rows - 1, r)) * t.cols + Math.max(0, Math.min(t.cols - 1, c))]!;

/** Height (cm above baseY) on the old surface at grid coordinates (fx, fz): its triangles, split as the mesh is. */
function linearAt(t: TerrainData, fx: number, fz: number): number {
  const c = Math.min(t.cols - 2, Math.floor(fx));
  const r = Math.min(t.rows - 2, Math.floor(fz));
  const u = fx - c;
  const v = fz - r;
  if (u < 1e-9 && v < 1e-9) return at(t, c, r);
  const h00 = at(t, c, r);
  const h10 = at(t, c + 1, r);
  const h01 = at(t, c, r + 1);
  const h11 = at(t, c + 1, r + 1);
  return v >= u ? h00 + (h11 - h01) * u + (h01 - h00) * v : h00 + (h10 - h00) * u + (h11 - h10) * v;
}

/** Each old cell's steepness: its highest corner less its lowest, over the spacing. */
function cellSteepness(t: TerrainData): Float32Array {
  const w = t.cols - 1;
  const out = new Float32Array(w * (t.rows - 1));
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < w; c++) {
      const a = at(t, c, r);
      const b = at(t, c + 1, r);
      const d = at(t, c, r + 1);
      const e = at(t, c + 1, r + 1);
      out[r * w + c] = (Math.max(a, b, d, e) - Math.min(a, b, d, e)) / 100 / t.spacing;
    }
  }
  return out;
}

/** Catmull-Rom weights for the four knots round a point `u` (0..1) past the second. */
function catmull(u: number, out: number[]): void {
  const u2 = u * u;
  const u3 = u2 * u;
  out[0] = (-u3 + 2 * u2 - u) / 2;
  out[1] = (3 * u3 - 5 * u2 + 2) / 2;
  out[2] = (-3 * u3 + 4 * u2 + u) / 2;
  out[3] = (u3 - u2) / 2;
}

const wx = [0, 0, 0, 0];
const wz = [0, 0, 0, 0];

/** The cubic through the old heights, kept inside the cell's corners, going over to the old surface where it is steep. */
function smoothAt(t: TerrainData, fx: number, fz: number, steep: Float32Array): number {
  const lin = linearAt(t, fx, fz);
  const c = Math.min(t.cols - 2, Math.floor(fx));
  const r = Math.min(t.rows - 2, Math.floor(fz));
  const u = fx - c;
  const v = fz - r;
  // On an old vertex, or on an old grid line the cubic and the old surface agree only at the knots: knots stay exact.
  if (u < 1e-9 && v < 1e-9) return lin;
  // The steepest old cell the cubic's 4 × 4 knots reach (the cell and its eight neighbours).
  const w = t.cols - 1;
  let s = 0;
  for (let rr = Math.max(0, r - 1); rr <= Math.min(t.rows - 2, r + 1); rr++) for (let cc = Math.max(0, c - 1); cc <= Math.min(w - 1, c + 1); cc++) s = Math.max(s, steep[rr * w + cc]!);
  const k = Math.max(0, Math.min(1, (s - STEEP_FROM) / (STEEP_TO - STEEP_FROM)));
  if (k >= 1) return lin;
  catmull(u, wx);
  catmull(v, wz);
  let cubic = 0;
  for (let j = 0; j < 4; j++) {
    let row = 0;
    for (let i = 0; i < 4; i++) row += wx[i]! * at(t, c - 1 + i, r - 1 + j);
    cubic += wz[j]! * row;
  }
  const h00 = at(t, c, r);
  const h10 = at(t, c + 1, r);
  const h01 = at(t, c, r + 1);
  const h11 = at(t, c + 1, r + 1);
  cubic = Math.max(Math.min(h00, h10, h01, h11), Math.min(Math.max(h00, h10, h01, h11), cubic));
  return cubic * (1 - k) + lin * k;
}

/** A per-cell layer (paint or plants, values 0..kinds-1) on the new grid. */
function resampleCells(t: TerrainData, values: readonly number[], cols: number, rows: number, spacing: number, kinds: number): number[] {
  const w = t.cols - 1;
  const h = t.rows - 1;
  const out: number[] = new Array((cols - 1) * (rows - 1));
  const coarser = spacing > t.spacing * 1.001;
  const count = new Array<number>(kinds).fill(0);
  const cellOf = (m: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(m / t.spacing + 1e-9)));
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      // Offsets from the grid's corner (it stays put), so the cell maths needs no origin.
      const x = (c + 0.5) * spacing;
      const z = (r + 0.5) * spacing;
      const own = values[cellOf(z, h) * w + cellOf(x, w)] ?? 0;
      if (!coarser) {
        out[r * (cols - 1) + c] = own;
        continue;
      }
      // The old cells whose middles lie in this one: the commonest wins (ties: the one under its middle).
      count.fill(0);
      const c0 = Math.max(0, Math.ceil((x - spacing / 2) / t.spacing - 0.5 - 1e-9));
      const c1 = Math.min(w - 1, Math.ceil((x + spacing / 2) / t.spacing - 0.5 - 1e-9) - 1);
      const r0 = Math.max(0, Math.ceil((z - spacing / 2) / t.spacing - 0.5 - 1e-9));
      const r1 = Math.min(h - 1, Math.ceil((z + spacing / 2) / t.spacing - 0.5 - 1e-9) - 1);
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) count[values[rr * w + cc] ?? 0]!++;
      let best = own;
      for (let k = 0; k < kinds; k++) if (count[k]! > count[best]!) best = k;
      out[r * (cols - 1) + c] = best;
    }
  }
  return out;
}

/** Things that stand on the ground and move up or down with it (as Smooth all carries them). */
const CARRIED = new Set<MapEntity['kind']>(['spawn', 'pickup', 'prop', 'mount', 'flag', 'hill']);

export interface ChangeGridResult {
  command: EditCommand;
  terrain: TerrainData;
  plan: GridPlan;
  /** Things on the ground moved up or down with it (the new surface differs a little between old vertices). */
  moved: number;
}

/**
 * The Change grid command: the terrain resampled (one `setTerrain`), and spawns, pickups, props, vehicles, flags
 * and hills that stood on the ground (within 30 cm over it or 1.5 m into it) moved with it, all one undo step.
 * Props rest on the document's own ground; the rest on the ground as shown, which MapMaker's `shownFor` gives
 * (the terrain kept under floors and with its paths laid in; default the terrain itself).
 */
export function changeGridCommand(doc: MapDocument, spacing: number, opts: { mode?: GridInterpolation; shownFor?: (t: TerrainData) => TerrainData } = {}): ChangeGridResult | { error: string } {
  const t = doc.terrain;
  if (!t) return { error: 'the map has no terrain' };
  const plan = planGrid(t, spacing);
  if (plan.error) return { error: plan.error };
  const after = resampleTerrain(t, spacing, opts.mode ?? 'smooth');
  const shown = opts.shownFor ?? ((x: TerrainData) => x);
  const shownBefore = shown(t);
  const shownAfter = shown(after);
  const before: MapEntity[] = [];
  const moves: MapEntity[] = [];
  for (const e of doc.entities) {
    if (!CARRIED.has(e.kind)) continue;
    const was = terrainHeightAt(e.kind === 'prop' ? t : shownBefore, e.position[0], e.position[2]);
    const now = terrainHeightAt(e.kind === 'prop' ? after : shownAfter, e.position[0], e.position[2]);
    if (was === null || now === null || Math.abs(now - was) < 0.005) continue;
    const above = e.position[1] - was;
    if (above > 0.3 || above < -1.5) continue;
    before.push(e);
    moves.push({ ...e, position: [e.position[0], Math.round((e.position[1] + now - was) * 1000) / 1000, e.position[2]] } as MapEntity);
  }
  const terrainCmd: EditCommand = { kind: 'setTerrain', before: t, after };
  const command: EditCommand = moves.length ? { kind: 'batch', commands: [terrainCmd, { kind: 'updateEntities', before, after: moves }] } : terrainCmd;
  return { command, terrain: after, plan, moved: moves.length };
}
