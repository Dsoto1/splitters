import { MAX_TERRAIN_VERTS, TERRAIN_MATERIALS, smoothGrid, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';

/**
 * Terrain heights from a height grid file (MapMaker → Terrain, owner only):
 * an ESRI ASCII grid (`.asc`, the plain-text format GDAL, QGIS and most GIS
 * tools write) of ground heights in metres, laid out in map metres: its
 * x is the map's x (east), its y the map's z (north). A real place's
 * elevation (say USGS 3DEP, cut out and reprojected to metres round the spot
 * the map is centred on) becomes the map's ground in one undoable step; the
 * owner then edits it like any terrain. Only the heights are read; nothing in
 * the file is kept in the map.
 */
export interface HeightGrid {
  cols: number;
  rows: number;
  /** Map x / z of the centre of the south-west cell. */
  x0: number;
  z0: number;
  /** Cell size (m). */
  cell: number;
  /** Row-major from the south row up; NaN where the file has no data. */
  values: Float64Array;
}

/** The largest file read (a 2,000 × 2,000 grid is about 20 MB of text). */
export const MAX_HEIGHT_GRID_BYTES = 32 * 1024 * 1024;

/** Read an ESRI ASCII grid. Rows run north to south in the file; `values` runs south to north. */
export function parseAsciiGrid(text: string): HeightGrid | { error: string } {
  const header: Record<string, number> = {};
  let pos = 0;
  // Header lines are "key value"; the numbers start at the first line that begins with a number.
  for (;;) {
    const end = text.indexOf('\n', pos);
    const line = text.slice(pos, end < 0 ? text.length : end).trim();
    const m = /^([a-z_]+)\s+(\S+)$/i.exec(line);
    if (!m) break;
    const v = Number(m[2]);
    if (!Number.isFinite(v)) return { error: `the header's ${m[1]} is not a number` };
    header[m[1]!.toLowerCase()] = v;
    if (end < 0) return { error: 'the file has a header but no heights' };
    pos = end + 1;
  }
  const cols = header.ncols;
  const rows = header.nrows;
  const cell = header.cellsize;
  if (!cols || !rows || !Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2) return { error: 'not an ESRI ASCII grid (ncols and nrows of 2 or more)' };
  if (!cell || cell <= 0) return { error: 'not an ESRI ASCII grid (no cellsize)' };
  if (cols * rows > 16_000_000) return { error: 'the grid is too big (16 million heights at most)' };
  const xll = header.xllcenter ?? (header.xllcorner !== undefined ? header.xllcorner + cell / 2 : undefined);
  const yll = header.yllcenter ?? (header.yllcorner !== undefined ? header.yllcorner + cell / 2 : undefined);
  if (xll === undefined || yll === undefined) return { error: 'the header needs xllcorner/yllcorner (or xllcenter/yllcenter)' };
  const nodata = header.nodata_value;
  const values = new Float64Array(cols * rows);
  const nums = text.slice(pos).split(/\s+/);
  let k = 0;
  for (const s of nums) {
    if (!s) continue;
    if (k >= cols * rows) return { error: `more heights than ${cols} × ${rows}` };
    const v = Number(s);
    if (!Number.isFinite(v)) return { error: `"${s.slice(0, 20)}" is not a height` };
    const r = rows - 1 - Math.floor(k / cols);
    values[r * cols + (k % cols)] = nodata !== undefined && v === nodata ? NaN : v;
    k++;
  }
  if (k < cols * rows) return { error: `${k} heights where ${cols} × ${rows} = ${cols * rows} were expected` };
  return { cols, rows, x0: xll, z0: yll, cell, values };
}

/** Height of the grid at map (x, z), bilinear between cell centres (clamped to the edge); null outside or over missing data. */
export function gridHeightAt(g: HeightGrid, x: number, z: number): number | null {
  const fx = (x - g.x0) / g.cell;
  const fz = (z - g.z0) / g.cell;
  const eps = 1e-6;
  if (fx < -eps || fz < -eps || fx > g.cols - 1 + eps || fz > g.rows - 1 + eps) return null;
  const c = Math.max(0, Math.min(g.cols - 2, Math.floor(fx)));
  const r = Math.max(0, Math.min(g.rows - 2, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - c));
  const v = Math.max(0, Math.min(1, fz - r));
  const at = (cc: number, rr: number) => g.values[rr * g.cols + cc]!;
  const h = at(c, r) * (1 - u) * (1 - v) + at(c + 1, r) * u * (1 - v) + at(c, r + 1) * (1 - u) * v + at(c + 1, r + 1) * u * v;
  return Number.isFinite(h) ? h : null;
}

export interface HeightGridTerrain {
  terrain: TerrainData;
  /** The file height put at y 0 (m). */
  datum: number;
  /** The grid was coarser than the file (the file had more than MAX_TERRAIN_VERTS heights along a side). */
  resampled: boolean;
}

/** The Smoothing choices of the height-grid import (Gaussian sigma, metres). */
export const HEIGHT_GRID_SMOOTHING = [
  { label: 'Off', sigma: 0 },
  { label: 'Light (1 m)', sigma: 1 },
  { label: 'Medium (2 m)', sigma: 2 },
  { label: 'Strong (3.5 m)', sigma: 3.5 },
] as const;
/** The import's default: Medium (lidar's small bumps go, banks and knolls stay). */
export const DEFAULT_HEIGHT_GRID_SMOOTHING = 2;

/**
 * Height at map (x, z) averaged over the square of half-width `reach` round it
 * (a tent: the file's heights weighted 1 at the point, 0 at `reach`), skipping
 * missing data; null with none. Used when the terrain is coarser than the
 * file: a point sample would pick up whatever bump sits on each vertex
 * (lidar carries curbs, hedges and building edges a metre across), and at
 * 2.5 m those alias into a jagged surface; the average is the ground round it.
 */
export function gridAreaHeightAt(g: HeightGrid, x: number, z: number, reach: number): number | null {
  const fx = (x - g.x0) / g.cell;
  const fz = (z - g.z0) / g.cell;
  const rc = reach / g.cell;
  let sum = 0;
  let w = 0;
  for (let r = Math.max(0, Math.ceil(fz - rc)); r <= Math.min(g.rows - 1, Math.floor(fz + rc)); r++) {
    const wz = 1 - Math.abs(r - fz) / rc;
    if (wz <= 0) continue;
    for (let c = Math.max(0, Math.ceil(fx - rc)); c <= Math.min(g.cols - 1, Math.floor(fx + rc)); c++) {
      const wx = 1 - Math.abs(c - fx) / rc;
      const v = g.values[r * g.cols + c]!;
      if (wx <= 0 || Number.isNaN(v)) continue;
      sum += v * wx * wz;
      w += wx * wz;
    }
  }
  return w > 0 ? sum / w : null;
}

/**
 * A terrain covering the grid: vertices at the file's cell size (coarser when
 * the file is more than MAX_TERRAIN_VERTS heights along a side: each vertex
 * then takes the average of the file round it, gridAreaHeightAt), heights =
 * file height − `datum` (default: the file's height at the map's centre point
 * (0, 0), else its lowest), with the ground 15 cm under level 0 like a new
 * terrain. `smoothing` (metres, default none) runs a Gaussian of that sigma
 * over the file first (smoothGrid: small bumps go, slopes keep their
 * gradient). Ground paint and plants are kept from `current` where it
 * reaches, the rest is `ground`. Missing data takes the nearest height there is.
 */
export function terrainFromHeightGrid(g: HeightGrid, opts: { current?: TerrainData | null; ground?: TerrainMaterial; datum?: number | null; smoothing?: number } = {}): HeightGridTerrain {
  if (opts.smoothing && opts.smoothing > 0) g = { ...g, values: smoothGrid(g.values, g.cols, g.rows, opts.smoothing / g.cell) };
  const w = (g.cols - 1) * g.cell;
  const d = (g.rows - 1) * g.cell;
  const spacing = Math.max(g.cell, w / (MAX_TERRAIN_VERTS - 1), d / (MAX_TERRAIN_VERTS - 1));
  // Two decimals, so the grid stays tidy in the file; never over the vertex limit.
  const sp = Math.ceil(spacing * 100 - 1e-6) / 100;
  const cols = Math.min(MAX_TERRAIN_VERTS, Math.floor(w / sp + 1e-6) + 1);
  const rows = Math.min(MAX_TERRAIN_VERTS, Math.floor(d / sp + 1e-6) + 1);
  let low = Infinity;
  for (const v of g.values) if (Number.isFinite(v)) low = Math.min(low, v);
  if (!Number.isFinite(low)) low = 0;
  const datum = opts.datum ?? gridHeightAt(g, 0, 0) ?? low;
  const baseY = -0.15;
  const heights: number[] = new Array(cols * rows);
  const thinned = sp > g.cell + 1e-6;
  let missing = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = g.x0 + c * sp;
      const z = g.z0 + r * sp;
      const h = thinned ? gridAreaHeightAt(g, x, z, sp) : gridHeightAt(g, x, z);
      if (h === null) missing = true;
      heights[r * cols + c] = h === null ? NaN : Math.max(-5000, Math.min(20000, Math.round((h - datum) * 100)));
    }
  }
  if (missing) fillMissing(heights, cols, rows, Math.round((low - datum) * 100));
  const ground = TERRAIN_MATERIALS.indexOf(opts.ground ?? 'grass');
  const cur = opts.current ?? null;
  const cells = (cols - 1) * (rows - 1);
  const materials: number[] = new Array(cells).fill(ground);
  const foliage: number[] = cur?.foliage.length ? new Array(cells).fill(-1) : [];
  if (cur) {
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const cc = Math.floor((g.x0 + (c + 0.5) * sp - cur.origin[0]) / cur.spacing);
        const rr = Math.floor((g.z0 + (r + 0.5) * sp - cur.origin[1]) / cur.spacing);
        if (cc < 0 || rr < 0 || cc >= cur.cols - 1 || rr >= cur.rows - 1) continue;
        const j = rr * (cur.cols - 1) + cc;
        materials[r * (cols - 1) + c] = cur.materials[j]!;
        if (foliage.length) foliage[r * (cols - 1) + c] = cur.foliage[j]!;
      }
    }
  }
  // Cells the old terrain didn't reach: plants follow their ground (grass grows on grass and moss).
  for (let i = 0; i < foliage.length; i++) if (foliage[i]! < 0) foliage[i] = materials[i] === 0 || materials[i] === TERRAIN_MATERIALS.indexOf('moss') ? 2 : 0;
  return {
    terrain: { origin: [round2(g.x0), round2(g.z0)], spacing: sp, cols, rows, baseY, heights, materials, boundary: cur?.boundary ?? true, foliage },
    datum,
    resampled: thinned,
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Give each missing height (NaN) the last known one before it along its row (else after it; then the same down its column), else `fallback`. */
function fillMissing(h: number[], cols: number, rows: number, fallback: number): void {
  for (let pass = 0; pass < 2; pass++) {
    const [n, m, at] = pass === 0 ? [rows, cols, (a: number, b: number) => a * cols + b] : [cols, rows, (a: number, b: number) => b * cols + a];
    for (let a = 0; a < n; a++) {
      let last = NaN;
      const fwd: number[] = new Array(m);
      for (let b = 0; b < m; b++) {
        const v = h[at(a, b)]!;
        if (Number.isFinite(v)) last = v;
        fwd[b] = last;
      }
      last = NaN;
      for (let b = m - 1; b >= 0; b--) {
        const i = at(a, b);
        const v = h[i]!;
        if (Number.isFinite(v)) {
          last = v;
          continue;
        }
        const f = fwd[b]!;
        h[i] = Number.isFinite(f) ? f : last;
      }
    }
  }
  for (let i = 0; i < h.length; i++) if (!Number.isFinite(h[i]!)) h[i] = fallback;
}
