import type { WorldBox } from './geometry.ts';
import type { Vec3 } from '../math.ts';
import { hypot } from '../math.ts';

/**
 * Outdoor terrain: a heightmap grid with a ground material per cell (grass,
 * dirt, stone…). Heights are stored in centimetres above `baseY` so the map
 * file stays compact and exact. It collides as a triangle mesh, is part of the
 * bots' navmesh, and is sculpted in MapMaker with brushes.
 */
export const TERRAIN_MATERIALS = ['grass', 'dirt', 'stone', 'sand', 'gravel', 'snow', 'moss', 'mud'] as const;
export type TerrainMaterial = (typeof TERRAIN_MATERIALS)[number];

export const TERRAIN_MATERIAL_LABELS: Record<TerrainMaterial, string> = {
  grass: 'Grass',
  dirt: 'Dirt',
  stone: 'Stone',
  sand: 'Sand',
  gravel: 'Gravel',
  snow: 'Snow',
  moss: 'Moss',
  mud: 'Dark earth',
};

/** Surface material (see materials.ts) drawn for each terrain material. */
export const TERRAIN_SURFACES: Record<TerrainMaterial, string> = {
  grass: 'core.pbr_grass',
  dirt: 'core.pbr_forest',
  stone: 'core.pbr_rock',
  sand: 'core.pbr_sand',
  gravel: 'core.pbr_gravel',
  snow: 'core.pbr_snow',
  moss: 'core.pbr_moss',
  mud: 'core.pbr_hex_paving',
};

export const MAX_TERRAIN_VERTS = 161;

/** Terrain as stored in the map (validated by the schema in schema.ts). */
export interface TerrainData {
  /** World X/Z of vertex (0, 0). Vertex (c, r) is at origin + (c, r) × spacing. */
  origin: [number, number];
  /** Metres between neighbouring vertices. */
  spacing: number;
  /** Vertices along X and along Z. */
  cols: number;
  rows: number;
  baseY: number;
  /** cols × rows heights in centimetres above baseY, row by row (Z), X fastest. */
  heights: number[];
  /** (cols − 1) × (rows − 1) cell materials (indices into TERRAIN_MATERIALS). */
  materials: number[];
  /** Invisible walls round the edge keep players and grenades in. */
  boundary: boolean;
  /** Plant cover per cell, 0–4 (see FOLIAGE_LEVELS); empty = from each cell's material. */
  foliage: number[];
}

/** Plant cover levels painted with MapMaker's foliage brush. Drawn only: plants never block movement or shots. */
export const FOLIAGE_LEVELS = ['Bare', 'Sparse', 'Grassy', 'Lush', 'Overgrown'] as const;

/** Cover a cell gets when the map hasn't painted any. */
const MATERIAL_FOLIAGE: Record<TerrainMaterial, number> = { grass: 2, moss: 1, dirt: 0, mud: 0, sand: 0, gravel: 0, stone: 0, snow: 0 };

/** Plant cover (0–4) of terrain cell `i`. */
export function cellFoliage(t: TerrainData, i: number): number {
  if (t.foliage.length) return t.foliage[i] ?? 0;
  return MATERIAL_FOLIAGE[TERRAIN_MATERIALS[t.materials[i] ?? 0] ?? 'grass'];
}

export function newTerrain(sizeMetres: number, spacing = 2, centre: [number, number] = [0, 0], material: TerrainMaterial = 'grass'): TerrainData {
  const n = Math.min(MAX_TERRAIN_VERTS, Math.round(sizeMetres / spacing) + 1);
  return {
    origin: [centre[0] - ((n - 1) * spacing) / 2, centre[1] - ((n - 1) * spacing) / 2],
    spacing,
    cols: n,
    rows: n,
    baseY: 0,
    heights: new Array(n * n).fill(0),
    materials: new Array((n - 1) * (n - 1)).fill(TERRAIN_MATERIALS.indexOf(material)),
    boundary: true,
    foliage: [],
  };
}

/** Height (world Y) of vertex (c, r). */
export const vertexY = (t: TerrainData, c: number, r: number): number => t.baseY + (t.heights[r * t.cols + c] ?? 0) / 100;

/** Ground height at a world X/Z (on the triangle surface), or null off the terrain. */
export function terrainHeightAt(t: TerrainData, x: number, z: number): number | null {
  const fx = (x - t.origin[0]) / t.spacing;
  const fz = (z - t.origin[1]) / t.spacing;
  if (fx < 0 || fz < 0 || fx > t.cols - 1 || fz > t.rows - 1) return null;
  const c = Math.min(t.cols - 2, Math.floor(fx));
  const r = Math.min(t.rows - 2, Math.floor(fz));
  const u = fx - c;
  const v = fz - r;
  const h00 = vertexY(t, c, r);
  const h10 = vertexY(t, c + 1, r);
  const h01 = vertexY(t, c, r + 1);
  const h11 = vertexY(t, c + 1, r + 1);
  // Same split as the mesh: triangles (00, 01, 11) and (00, 11, 10).
  return v >= u ? h00 + (h11 - h01) * u + (h01 - h00) * v : h00 + (h10 - h00) * u + (h11 - h10) * v;
}

/** Triangle mesh of the terrain surface (physics and navigation). */
export function terrainTriangles(t: TerrainData): { positions: Float32Array; indices: Uint32Array } {
  const positions = new Float32Array(t.cols * t.rows * 3);
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const i = (r * t.cols + c) * 3;
      positions[i] = t.origin[0] + c * t.spacing;
      positions[i + 1] = vertexY(t, c, r);
      positions[i + 2] = t.origin[1] + r * t.spacing;
    }
  }
  const indices = new Uint32Array((t.cols - 1) * (t.rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      const a = r * t.cols + c;
      const b = a + 1;
      const d = a + t.cols;
      const e = d + 1;
      // Counter-clockwise seen from above (Recast's up-facing convention).
      indices.set([a, d, e, a, e, b], k);
      k += 6;
    }
  }
  return { positions, indices };
}

/** Invisible boundary walls round the terrain (physics and navigation only). */
export function terrainBoundary(t: TerrainData, height = 40): WorldBox[] {
  if (!t.boundary) return [];
  let low = Infinity;
  let high = -Infinity;
  for (const h of t.heights) {
    low = Math.min(low, h);
    high = Math.max(high, h);
  }
  const y0 = t.baseY + low / 100 - 2;
  const y1 = t.baseY + high / 100 + height;
  const [x0, z0] = t.origin;
  const x1 = x0 + (t.cols - 1) * t.spacing;
  const z1 = z0 + (t.rows - 1) * t.spacing;
  const w = 1;
  const box = (min: [number, number, number], max: [number, number, number]): WorldBox => ({ min, max, kind: 'barrier', sourceId: 'terrain' });
  return [box([x0 - w, y0, z0 - w], [x1 + w, y1, z0]), box([x0 - w, y0, z1], [x1 + w, y1, z1 + w]), box([x0 - w, y0, z0], [x0, y1, z1]), box([x1, y0, z0], [x1 + w, y1, z1])];
}

const heightRange = new WeakMap<TerrainData['heights'], { low: number; high: number }>();

/** The lowest and highest ground (m), cached per heights array. */
function terrainHeightRange(t: TerrainData): { low: number; high: number } {
  let r = heightRange.get(t.heights);
  if (!r) {
    let low = Infinity;
    let high = -Infinity;
    for (const h of t.heights) {
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    r = { low: t.baseY + low / 100, high: t.baseY + high / 100 };
    heightRange.set(t.heights, r);
  }
  return r;
}

/**
 * First point where a ray meets the terrain surface (for MapMaker brushes and
 * picks), or null. Only the stretch of the ray over the terrain, between its
 * lowest and highest ground, is marched, so a camera far out (zoomed right
 * back) finds the ground as surely as one close in.
 */
export function terrainRaycast(t: TerrainData, origin: Vec3, dir: Vec3, maxDist = 5000): Vec3 | null {
  const above = (p: Vec3) => {
    const h = terrainHeightAt(t, p.x, p.z);
    return h === null ? null : p.y - h;
  };
  const at = (d: number): Vec3 => ({ x: origin.x + dir.x * d, y: origin.y + dir.y * d, z: origin.z + dir.z * d });
  // Clip the ray to the box the ground lies in.
  const { low, high } = terrainHeightRange(t);
  const lo3 = [t.origin[0], low - 0.01, t.origin[1]];
  const hi3 = [t.origin[0] + (t.cols - 1) * t.spacing, high + 0.01, t.origin[1] + (t.rows - 1) * t.spacing];
  const o3 = [origin.x, origin.y, origin.z];
  const d3 = [dir.x, dir.y, dir.z];
  let enter = 0;
  let exit = maxDist;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d3[i]!) < 1e-12) {
      if (o3[i]! < lo3[i]! || o3[i]! > hi3[i]!) return null;
      continue;
    }
    let a = (lo3[i]! - o3[i]!) / d3[i]!;
    let b = (hi3[i]! - o3[i]!) / d3[i]!;
    if (a > b) [a, b] = [b, a];
    enter = Math.max(enter, a);
    exit = Math.min(exit, b);
  }
  if (enter > exit) return null;
  const step = Math.max(0.25, t.spacing / 4);
  let prev = enter;
  let prevAbove = above(at(enter));
  for (let d = enter + step; d <= exit + step; d += step) {
    const a = above(at(d));
    if (a !== null && prevAbove !== null && prevAbove > 0 && a <= 0) {
      // Refine between the last point above and the first below.
      let lo = prev;
      let hi = d;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const m = above(at(mid));
        if (m !== null && m > 0) lo = mid;
        else hi = mid;
      }
      return at(hi);
    }
    prev = d;
    prevAbove = a ?? (prevAbove !== null && prevAbove > 0 ? prevAbove : null);
  }
  return null;
}

export const TERRAIN_BRUSHES = ['raise', 'lower', 'smooth', 'flatten', 'roughen', 'paint', 'foliage'] as const;
export type TerrainBrush = (typeof TERRAIN_BRUSHES)[number];

export interface BrushStroke {
  brush: TerrainBrush;
  x: number;
  z: number;
  radius: number;
  /** Metres per application at the centre (raise/lower/roughen), or 0..1 blend (smooth/flatten). */
  strength: number;
  /** Flatten: the world height to level to. */
  target?: number;
  /** Paint: the material to lay. */
  material?: TerrainMaterial;
  /** Foliage: the plant cover to lay (0 bare … 4 overgrown). */
  level?: number;
  /** Roughen: seed for the noise. */
  seed?: number;
}

/**
 * One application of a brush, returning a new terrain (the input is not
 * changed). Falloff is a smooth bump: full strength at the centre, none at the
 * radius.
 */
export function applyBrush(t: TerrainData, s: BrushStroke): TerrainData {
  const heights = t.heights.slice();
  const materials = t.materials.slice();
  const c0 = Math.max(0, Math.floor((s.x - s.radius - t.origin[0]) / t.spacing));
  const c1 = Math.min(t.cols - 1, Math.ceil((s.x + s.radius - t.origin[0]) / t.spacing));
  const r0 = Math.max(0, Math.floor((s.z - s.radius - t.origin[1]) / t.spacing));
  const r1 = Math.min(t.rows - 1, Math.ceil((s.z + s.radius - t.origin[1]) / t.spacing));
  const weight = (x: number, z: number) => {
    const d = hypot(x - s.x, z - s.z) / s.radius;
    return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d);
  };
  const clampCm = (v: number) => Math.round(Math.max(-5000, Math.min(20000, v)));
  if (s.brush === 'paint') {
    const m = TERRAIN_MATERIALS.indexOf(s.material ?? 'grass');
    for (let r = r0; r < Math.min(r1, t.rows - 1); r++) {
      for (let c = c0; c < Math.min(c1, t.cols - 1); c++) {
        const x = t.origin[0] + (c + 0.5) * t.spacing;
        const z = t.origin[1] + (r + 0.5) * t.spacing;
        if (hypot(x - s.x, z - s.z) <= s.radius) materials[r * (t.cols - 1) + c] = m;
      }
    }
    return { ...t, materials };
  }
  if (s.brush === 'foliage') {
    // The first stroke turns the automatic cover (from each cell's material) into a painted layer.
    const foliage = t.foliage.length ? t.foliage.slice() : t.materials.map((_, i) => cellFoliage(t, i));
    const level = Math.max(0, Math.min(4, Math.round(s.level ?? 2)));
    for (let r = r0; r < Math.min(r1, t.rows - 1); r++) {
      for (let c = c0; c < Math.min(c1, t.cols - 1); c++) {
        const x = t.origin[0] + (c + 0.5) * t.spacing;
        const z = t.origin[1] + (r + 0.5) * t.spacing;
        if (hypot(x - s.x, z - s.z) <= s.radius) foliage[r * (t.cols - 1) + c] = level;
      }
    }
    return { ...t, foliage };
  }
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = t.origin[0] + c * t.spacing;
      const z = t.origin[1] + r * t.spacing;
      const w = weight(x, z);
      if (w <= 0) continue;
      const i = r * t.cols + c;
      const h = t.heights[i]!;
      switch (s.brush) {
        case 'raise':
          heights[i] = clampCm(h + s.strength * 100 * w);
          break;
        case 'lower':
          heights[i] = clampCm(h - s.strength * 100 * w);
          break;
        case 'flatten': {
          const target = ((s.target ?? t.baseY) - t.baseY) * 100;
          heights[i] = clampCm(h + (target - h) * Math.min(1, s.strength) * w);
          break;
        }
        case 'smooth': {
          let sum = 0;
          let n = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const cc = c + dc;
              const rr = r + dr;
              if (cc < 0 || rr < 0 || cc >= t.cols || rr >= t.rows) continue;
              sum += t.heights[rr * t.cols + cc]!;
              n++;
            }
          }
          heights[i] = clampCm(h + (sum / n - h) * Math.min(1, s.strength) * w);
          break;
        }
        case 'roughen': {
          // Deterministic hash noise, so the same stroke gives the same bumps.
          let k = (Math.imul(c, 73856093) ^ Math.imul(r, 19349663) ^ Math.imul(s.seed ?? 1, 83492791)) >>> 0;
          k = Math.imul(k ^ (k >>> 13), 0x5bd1e995) >>> 0;
          const n = ((k ^ (k >>> 15)) >>> 0) / 4294967296 - 0.5;
          heights[i] = clampCm(h + n * 2 * s.strength * 100 * w);
          break;
        }
      }
    }
  }
  return { ...t, heights };
}

/** Lay stone on every cell steeper than `degrees` (cliffs), keeping other cells' materials. */
export function paintSlopes(t: TerrainData, degrees = 35, material: TerrainMaterial = 'stone'): TerrainData {
  const materials = t.materials.slice();
  const limit = Math.tan((degrees * Math.PI) / 180);
  const m = TERRAIN_MATERIALS.indexOf(material);
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      const hs = [vertexY(t, c, r), vertexY(t, c + 1, r), vertexY(t, c, r + 1), vertexY(t, c + 1, r + 1)];
      const rise = Math.max(...hs) - Math.min(...hs);
      if (rise / t.spacing > limit) materials[r * (t.cols - 1) + c] = m;
    }
  }
  return { ...t, materials };
}

/**
 * Gaussian smoothing of a grid of heights (row-major, `cols` fast), `sigma` in
 * cells. A low-pass: bumps and pits a few cells across go, while a slope keeps
 * its gradient (a ramp averages to itself) and a hill or bluff wider than a
 * few sigma keeps its shape; only its crest and foot round over about sigma.
 * Missing values (NaN) are left out of the averages and stay missing; the
 * edges average what is there (no padding). `hold` marks values that keep
 * their height (they still pull their neighbours towards them, so the
 * smoothed ground meets them without a step).
 */
export function smoothGrid(values: ArrayLike<number>, cols: number, rows: number, sigma: number, hold?: ArrayLike<number>): Float64Array {
  const out = Float64Array.from(values);
  if (!(sigma > 0)) return out;
  const reach = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float64Array(reach * 2 + 1);
  for (let k = -reach; k <= reach; k++) kernel[k + reach] = Math.exp(-0.5 * (k / sigma) ** 2);
  // Separable: along each row, then along each column.
  const pass = (src: Float64Array, alongRows: boolean): Float64Array => {
    const dst = new Float64Array(src.length);
    const n = alongRows ? rows : cols;
    const m = alongRows ? cols : rows;
    const stride = alongRows ? 1 : cols;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < m; b++) {
        const i = alongRows ? a * cols + b : b * cols + a;
        if (Number.isNaN(src[i]!)) {
          dst[i] = NaN;
          continue;
        }
        let sum = 0;
        let w = 0;
        for (let k = Math.max(-reach, -b); k <= Math.min(reach, m - 1 - b); k++) {
          const v = src[i + k * stride]!;
          if (Number.isNaN(v)) continue;
          const kw = kernel[k + reach]!;
          sum += v * kw;
          w += kw;
        }
        dst[i] = sum / w;
      }
    }
    return dst;
  };
  const smoothed = pass(pass(out, true), false);
  for (let i = 0; i < smoothed.length; i++) if (!hold?.[i]) out[i] = smoothed[i]!;
  return out;
}

/**
 * The whole terrain smoothed (MapMaker → Terrain → Smooth all): a Gaussian of
 * `sigma` metres over every height (see smoothGrid), except the vertices
 * `hold` marks (say the ground levelled under buildings: terrainHoldMask).
 */
export function smoothTerrain(t: TerrainData, sigma: number, hold?: ArrayLike<number>): TerrainData {
  const h = smoothGrid(t.heights, t.cols, t.rows, sigma / t.spacing, hold);
  const heights = Array.from(h, (v, i) => (hold?.[i] ? t.heights[i]! : Math.round(Math.max(-5000, Math.min(20000, v)))));
  return { ...t, heights };
}

/**
 * Vertices of `t` inside any of the footprints (X/Z polygons, say those of the
 * blocks standing on the ground) or within `margin` metres of one: 1 held,
 * 0 free (for smoothTerrain).
 */
export function terrainHoldMask(t: TerrainData, footprints: readonly (readonly (readonly [number, number])[])[], margin = 0): Uint8Array {
  const mask = new Uint8Array(t.cols * t.rows);
  for (const poly of footprints) {
    if (poly.length < 3) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, z] of poly) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    const c0 = Math.max(0, Math.floor((x0 - margin - t.origin[0]) / t.spacing));
    const c1 = Math.min(t.cols - 1, Math.ceil((x1 + margin - t.origin[0]) / t.spacing));
    const r0 = Math.max(0, Math.floor((z0 - margin - t.origin[1]) / t.spacing));
    const r1 = Math.min(t.rows - 1, Math.ceil((z1 + margin - t.origin[1]) / t.spacing));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * t.cols + c;
        if (!mask[i] && nearPolygon(poly, t.origin[0] + c * t.spacing, t.origin[1] + r * t.spacing, margin)) mask[i] = 1;
      }
    }
  }
  return mask;
}

/** Inside the polygon, or within `margin` of its outline. */
function nearPolygon(poly: readonly (readonly [number, number])[], x: number, z: number, margin: number): boolean {
  let inside = false;
  let near = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    const dx = xj - xi;
    const dz = zj - zi;
    const len2 = dx * dx + dz * dz;
    const u = len2 > 0 ? Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / len2)) : 0;
    near = Math.min(near, Math.hypot(x - (xi + u * dx), z - (zi + u * dz)));
  }
  return inside || near <= margin + 1e-9;
}
