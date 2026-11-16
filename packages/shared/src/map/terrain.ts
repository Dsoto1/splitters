import type { WorldBox } from './geometry.ts';
import type { Vec3 } from '../math.ts';
import { hypot } from '../math.ts';
import { coreMaterials, coreThemes, groundThemes, type GroundThemeDefinition, type PatternId } from './materials.ts';
import type { ResolvedStyle } from './surfaces.ts';

/**
 * Outdoor terrain: a heightmap grid with a ground per cell. Heights are stored in centimetres above `baseY` so the
 * map file stays compact and exact. It collides as a triangle mesh, is part of the bots' navmesh, and is sculpted in
 * MapMaker with brushes.
 *
 * The ground (map format v45, docs/MAPMAKER_PAINTING_PLAN.md "Format change A"): a cell is 0, **the base** (it
 * follows the map's Ground theme, `groundTheme`: content/materials.json groundThemes), or k, **painted** with the
 * map's own ground `grounds[k − 1]` (a ground material: the Ground category, or one of the old layers below). Any
 * ground draws as itself; nothing is swapped for a look-alike.
 *
 * The eight kinds below were the terrain's only grounds before v45 (a cell stored its kind's index). They stay as
 * what a ground **behaves** like (groundKind): the plants it grows (cellFoliage), what the Environment brush grows on,
 * the ground past the border, a path's ground, a height-grid import's plants. Never how it looks.
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

/** The material each kind was drawn in before v45 (the v45 migration's `grounds`, in this order). */
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

/**
 * The most vertices a terrain has along a side (map format v32; it was 161): 321, so a 380 m map can be 1.25 m apart
 * (MapMaker → Terrain → Change grid). A new terrain is still made within DEFAULT_TERRAIN_VERTS (2 to 4 m apart); a
 * finer grid is a choice, four times the triangles to collide, navigate and draw.
 */
export const MAX_TERRAIN_VERTS = 321;
/** The most vertices a side a new terrain (and a height-grid import) gets: the grid all maps had before v32. */
export const DEFAULT_TERRAIN_VERTS = 161;

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
  /** (cols − 1) × (rows − 1) cells: 0 the base (the Ground theme's), k painted with `grounds[k − 1]` (map format v45). */
  materials: number[];
  /** The Ground theme (a `ground.*` id): what every unpainted cell shows. Absent or unknown: DEFAULT_GROUND_THEME. */
  groundTheme?: string;
  /** The map's own grounds (ground material ids, at most MAX_GROUNDS) that painted cells name. Absent: none. */
  grounds?: string[];
  /** Invisible walls round the edge keep players and grenades in. */
  boundary: boolean;
  /** Plant cover per cell, 0–4 (see FOLIAGE_LEVELS); empty = from each cell's material. */
  foliage: number[];
}

/** Plant cover levels painted with MapMaker's foliage brush. Drawn only: plants never block movement or shots. */
export const FOLIAGE_LEVELS = ['Bare', 'Sparse', 'Grassy', 'Lush', 'Overgrown'] as const;

/**
 * The share of a cell's plant cover a terrain grows (the foliage brush's amounts are per cell). A grid finer than the
 * default 2 m (map format v32, Terrain → Change grid) grows in proportion to its cells' area, as many plants to the
 * square metre as a 2.5 m grid (owner, 2026-11-09: a fine grid is usually a 2.5 m map made finer, and keeps its look);
 * grids of 2 m and coarser grow as they always have.
 */
export const FINE_GRID_PLANTS_AS = 2.5;
export function plantShare(spacing: number): number {
  return spacing < 2 ? (spacing / FINE_GRID_PLANTS_AS) ** 2 : 1;
}

/** Cover a cell gets when the map hasn't painted any. */
const MATERIAL_FOLIAGE: Record<TerrainMaterial, number> = { grass: 2, moss: 1, dirt: 0, mud: 0, sand: 0, gravel: 0, stone: 0, snow: 0 };

/** Plant cover (0–4) of terrain cell `i`. */
export function cellFoliage(t: TerrainData, i: number): number {
  if (t.foliage.length) return t.foliage[i] ?? 0;
  return MATERIAL_FOLIAGE[cellKind(t, i)];
}

// ---------------------------------------------------------------- the ground: Ground themes and painted grounds

/** A map's terrain with no Ground theme (and a new map's on the Prototype theme): grass. */
export const DEFAULT_GROUND_THEME = 'ground.meadow';
/** The most grounds a terrain's own list holds (`grounds`): a cell is 0..MAX_GROUNDS. */
export const MAX_GROUNDS = 16;

const OLD_LAYERS = new Set<string>(Object.values(TERRAIN_SURFACES));

/** A ground material: the Ground category, or a terrain layer of before v45 (Mossy Rock, Hex Paving). Never anything else. */
export function isGroundMaterial(id: string): boolean {
  return OLD_LAYERS.has(id) || coreMaterials.get(id)?.category === 'Ground';
}

/** Every ground material, in MapMaker's palette order (Ground paint's list). */
export const GROUND_MATERIALS: readonly string[] = coreMaterials.all().filter((m) => isGroundMaterial(m.id)).map((m) => m.id);

/** A Ground theme by id; an unknown or absent one is DEFAULT_GROUND_THEME. */
export function groundThemeDef(id: string | undefined): GroundThemeDefinition {
  return (id ? groundThemes.get(id) : undefined) ?? groundThemes.get(DEFAULT_GROUND_THEME)!;
}

/** The terrain's Ground theme. */
export const terrainGroundTheme = (t: Pick<TerrainData, 'groundTheme'>): GroundThemeDefinition => groundThemeDef(t.groundTheme);

/** The base ground (a material id) every unpainted cell shows. */
export const groundBase = (t: Pick<TerrainData, 'groundTheme'>): string => terrainGroundTheme(t).base;

/** A Structure theme's matching Ground theme (content/materials.json: the theme's `ground`). */
export function matchingGroundTheme(structureTheme: string): string {
  const g = coreThemes.get(structureTheme)?.ground;
  return g && groundThemes.get(g) ? g : DEFAULT_GROUND_THEME;
}

/** The ground (a material id) cell `i` shows: the base, or the painted ground. */
export function cellGround(t: Pick<TerrainData, 'materials' | 'groundTheme' | 'grounds'>, i: number): string {
  const m = t.materials[i] ?? 0;
  return (m > 0 ? t.grounds?.[m - 1] : undefined) ?? groundBase(t);
}

/** Whether cell `i` is painted (not the base). A cell painted the base's own ground is painted: it stays when the theme changes. */
export const cellPainted = (t: Pick<TerrainData, 'materials' | 'grounds'>, i: number): boolean => (t.materials[i] ?? 0) > 0 && !!t.grounds?.[(t.materials[i] ?? 0) - 1];

/** Grounds drawn with a tint of their own: Gravel's photo is near white in daylight, so it is darkened to read as ground, not snow. */
export const GROUND_TINTS: Readonly<Record<string, string>> = { 'core.pbr_gravel': '#8f877b' };

/** How a ground material is drawn on the terrain (and past the border): the material and its ground tint. */
export function groundStyle(id: string): ResolvedStyle {
  const def = coreMaterials.get(id) ?? coreMaterials.get('core.proto_floor')!;
  return { material: def, tint: GROUND_TINTS[def.id] ?? null };
}

/** The kind a ground behaves as (plants, the Environment brush, the border's ground, the plan's colour): never its look. */
export function groundKind(id: string): TerrainMaterial {
  return terrainMaterialFor(id) ?? 'grass';
}

/** The kind cell `i` behaves as. */
export const cellKind = (t: Pick<TerrainData, 'materials' | 'groundTheme' | 'grounds'>, i: number): TerrainMaterial => groundKind(cellGround(t, i));

/** How many cells use each ground index (0 the base, k grounds[k − 1]). */
export function groundCounts(t: Pick<TerrainData, 'materials'>): Map<number, number> {
  const out = new Map<number, number>();
  for (const m of t.materials) out.set(m, (out.get(m) ?? 0) + 1);
  return out;
}

/**
 * The cell value that paints `ground` (a ground material id; null: the base), with the terrain's list grown to hold it.
 * A ground already in the list keeps its index. A full list (MAX_GROUNDS) first drops the grounds no cell uses any more
 * (cells renumbered, the look unchanged). Null when the list is full of grounds in use: Ground paint says so; it never
 * substitutes another ground.
 */
export function groundIndex(t: TerrainData, ground: string | null): { terrain: TerrainData; value: number } | null {
  if (ground === null) return { terrain: t, value: 0 };
  const grounds = t.grounds ?? [];
  const at = grounds.indexOf(ground);
  if (at >= 0) return { terrain: t, value: at + 1 };
  if (grounds.length < MAX_GROUNDS) return { terrain: { ...t, grounds: [...grounds, ground] }, value: grounds.length + 1 };
  const compact = compactGrounds(t);
  const list = compact.grounds ?? [];
  if (list.length >= MAX_GROUNDS) return null;
  return { terrain: { ...compact, grounds: [...list, ground] }, value: list.length + 1 };
}

/** The terrain with the grounds no cell uses dropped from its list (and the same ground listed twice merged), cells renumbered: it looks the same. */
export function compactGrounds(t: TerrainData): TerrainData {
  const grounds = t.grounds ?? [];
  const used = groundCounts(t);
  const next: string[] = [];
  const map = new Map<number, number>([[0, 0]]);
  grounds.forEach((g, k) => {
    if (!used.has(k + 1)) return;
    const was = next.indexOf(g);
    if (was >= 0) map.set(k + 1, was + 1);
    else {
      next.push(g);
      map.set(k + 1, next.length);
    }
  });
  if (next.length === grounds.length) return t;
  return { ...t, grounds: next, materials: t.materials.map((m) => map.get(m) ?? 0) };
}

/** Photo grounds with no old layer of their own, and the kind that behaves closest. */
const NEAREST: Readonly<Record<string, TerrainMaterial>> = {
  'core.pbr_ice': 'snow',
  'core.pbr_asphalt': 'stone',
  'core.pbr_wet_asphalt': 'stone',
  'core.pbr_lava': 'stone',
  'core.pbr_dusty_road': 'dirt',
};

/** Patterns that say what a ground is, whatever its colour. */
const BY_PATTERN: Partial<Record<PatternId, TerrainMaterial>> = {
  snow: 'snow',
  snowcrete: 'snow',
  ice: 'snow',
  frostrock: 'snow',
  pebbles: 'gravel',
  roots: 'dirt',
  cobbles: 'stone',
  setts: 'stone',
  flags: 'stone',
  slabs: 'stone',
  ashlar: 'stone',
  sandstone_ashlar: 'sand',
  blocks: 'stone',
  hex: 'mud',
};

/** HSL of a #rrggbb colour (h in degrees, s and l 0..1). */
function hsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/**
 * The kind a material behaves as on the ground (its old layer, else the one closest by pattern, else by colour):
 * plants, the Environment brush's filters, the ground past the border. Since v45 it never decides how a ground
 * looks: every ground draws as itself. Null: not a material.
 */
export function terrainMaterialFor(materialId: string): TerrainMaterial | null {
  const exact = TERRAIN_MATERIALS.find((m) => TERRAIN_SURFACES[m] === materialId);
  if (exact) return exact;
  if (NEAREST[materialId]) return NEAREST[materialId]!;
  const def = coreMaterials.get(materialId);
  if (!def) return null;
  const byPattern = BY_PATTERN[def.pattern];
  if (byPattern) return byPattern;
  const { h, s, l } = hsl(def.base);
  if (l > 0.8 && s < 0.35) return 'snow';
  if (s < 0.15) return l > 0.45 ? 'stone' : 'gravel';
  if (h >= 70 && h <= 170) return l > 0.3 ? 'grass' : 'moss';
  if (h >= 35 && h < 70 && l > 0.45) return 'sand';
  return 'dirt';
}

/**
 * The grid a new terrain `width` × `depth` metres gets: 2 m apart, or the next of 2.5, 3 and 4 m that keeps both sides
 * within DEFAULT_TERRAIN_VERTS vertices (a 400 × 320 m terrain is 2.5 m apart, 161 × 129 vertices). Finer: Change grid.
 */
export function terrainSpacingFor(width: number, depth = width): number {
  const longest = Math.max(width, depth);
  return [2, 2.5, 3, 4].find((s) => Math.round(longest / s) + 1 <= DEFAULT_TERRAIN_VERTS) ?? 4;
}

/**
 * A flat terrain `sizeMetres` across (east-west) and `depthMetres` (north-south, default the same) round `centre`,
 * vertices `spacing` m apart (at most MAX_TERRAIN_VERTS a side), every cell the base of `groundTheme`.
 */
export function newTerrain(sizeMetres: number, spacing = 2, centre: [number, number] = [0, 0], groundTheme = DEFAULT_GROUND_THEME, depthMetres = sizeMetres): TerrainData {
  const cols = Math.min(MAX_TERRAIN_VERTS, Math.round(sizeMetres / spacing) + 1);
  const rows = Math.min(MAX_TERRAIN_VERTS, Math.round(depthMetres / spacing) + 1);
  return {
    origin: [centre[0] - ((cols - 1) * spacing) / 2, centre[1] - ((rows - 1) * spacing) / 2],
    spacing,
    cols,
    rows,
    baseY: 0,
    heights: new Array(cols * rows).fill(0),
    materials: new Array((cols - 1) * (rows - 1)).fill(0),
    groundTheme,
    grounds: [],
    boundary: true,
    foliage: [],
  };
}

/** Height (world Y) of vertex (c, r). */
export const vertexY = (t: TerrainData, c: number, r: number): number => t.baseY + (t.heights[r * t.cols + c] ?? 0) / 100;

/**
 * The terrain's lowest ground (world y; Infinity with no heights). A loop, not `Math.min(...heights)`: a fine grid has tens of thousands of
 * heights (Iron Coast's 1.25 m grid: 78,385), and spreading that many arguments overflows the stack in a browser.
 */
export function terrainLowest(t: Pick<TerrainData, 'baseY' | 'heights'>): number {
  let low = Infinity;
  for (const h of t.heights) if (h < low) low = h;
  return t.baseY + low / 100;
}

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
  /** Paint: the ground material to lay (painted: it stays when the Ground theme changes); null or absent: back to the base. */
  ground?: string | null;
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
    if (s.ground && !isGroundMaterial(s.ground)) return t;
    const slot = groundIndex(t, s.ground ?? null);
    if (!slot) return t;
    t = slot.terrain;
    const m = slot.value;
    const materials = t.materials.slice();
    let changed = false;
    for (let r = r0; r < Math.min(r1, t.rows - 1); r++) {
      for (let c = c0; c < Math.min(c1, t.cols - 1); c++) {
        const x = t.origin[0] + (c + 0.5) * t.spacing;
        const z = t.origin[1] + (r + 0.5) * t.spacing;
        const i = r * (t.cols - 1) + c;
        if (hypot(x - s.x, z - s.z) <= s.radius && materials[i] !== m) {
          materials[i] = m;
          changed = true;
        }
      }
    }
    return changed ? { ...t, materials } : t;
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

/** Paint `ground` (Mossy Rock) on every cell steeper than `degrees` (cliffs), keeping other cells' grounds. */
export function paintSlopes(t: TerrainData, degrees = 35, ground = TERRAIN_SURFACES.stone): TerrainData {
  const slot = groundIndex(t, ground);
  if (!slot) return t;
  t = slot.terrain;
  const materials = t.materials.slice();
  const limit = Math.tan((degrees * Math.PI) / 180);
  const m = slot.value;
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
