import { coreMaterials, type PatternId } from './materials.ts';
import { TERRAIN_MATERIALS, TERRAIN_SURFACES, type TerrainMaterial } from './terrain.ts';

/** Photo grounds with no terrain layer of their own, and the layer that reads closest. */
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
 * The terrain layer a surface material paints as. The terrain blends eight ground layers (TERRAIN_MATERIALS);
 * Paint's ground swatches include the style packs' own grounds (Packed Snow, Lake Ice, Shingle…), which the terrain
 * can't draw as such: each takes the layer that reads closest (its pattern, else its colour). Null: not a ground
 * Paint knows (the Terrain tab's ground is used).
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
