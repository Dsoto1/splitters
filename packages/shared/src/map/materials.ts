/**
 * Hand-made surface material library and themes (PLAYER_EXPRESSION.md §1).
 *
 * Materials are data: a procedural pattern drawn by our own client code plus
 * colours, scale and finish. Players pick a material and an optional tint for
 * each surface slot of each tile; themes are just default palettes.
 *
 * The tables (materials, themes, tint swatches) live in content/materials.json
 * (docs/CONTENT_SCALABILITY.md step 6; how to add one: docs/CONTENT_PIPELINE.md,
 * "Materials and themes"); tools/content/materials.mjs checks them and writes
 * content/materials.generated.ts. The types, the pattern and category lists and
 * the lookups stay here; the painters stay in client/materials/patterns.ts.
 */
import { CORE_MATERIALS, CORE_THEMES, TINT_SWATCHES } from '../content/materials.generated.ts';

export { CORE_MATERIALS, CORE_THEMES, TINT_SWATCHES };

/**
 * Paintable surface groups of a Classic Grid tile. `roof` is the top of a room's roof (room option Ceiling: Roof,
 * skylight or beams); until it is painted it looks like the room's floor, so it has no theme default of its own.
 */
export const SURFACE_SLOTS = ['floor', 'walls', 'solids', 'underside', 'trim', 'roof'] as const;
export type SurfaceSlot = (typeof SURFACE_SLOTS)[number];
/** The slots a theme gives a default for. */
export type ThemeSlot = Exclude<SurfaceSlot, 'roof'>;

export const SURFACE_SLOT_LABELS: Record<SurfaceSlot, string> = {
  floor: 'Floor',
  walls: 'Walls',
  solids: 'Pillars, cover & steps',
  underside: 'Underside (ceiling below)',
  trim: 'Trim & frames',
  roof: 'Roof (top, outside)',
};

/** Procedural patterns a material can use; each has its painter in client code (packages/client/src/materials/patterns.ts). */
export const PATTERN_IDS = [
  'grid',
  'plain',
  'noise',
  'bricks',
  'blocks',
  'planks',
  'tiles',
  'checker',
  'plates',
  'grate',
  'panels',
  'stripes',
  'hex',
  'marble',
  'weave',
  /** Style Pack 09: columns of carved hieroglyphs between register lines (accent cut into the base). */
  'glyphs',
  /** Style Pack 09: hieroglyphs painted in ochre, turquoise and the accent on the base. */
  'glyphs_painted',
  /** Style Pack 03: small tesserae with a key-pattern border (Roman floor mosaic). */
  'mosaic',
  /** Style Pack 10: rounded cobblestones of uneven size set in mortar. */
  'cobbles',
  /** Style Pack 10: rectangular granite setts in running bond (a paved road). */
  'setts',
  /** Style Pack 10: square tiles laid on the diagonal in two colours (a market floor). */
  'diamonds',
  /** Style Pack 10: rows of curved clay roof tiles (pantiles), each row lapping the one below. */
  'pantiles',
  /** Style Pack 10: half-timbering: dark oak posts, rails and braces with plaster panels between (repeats every storey). */
  'timber',
  /** Style Pack 12: wind-packed snow, soft ripples of drift and a glint of frost. */
  'snow',
  /** Style Pack 12: clear ice over dark water, white cracks running through it and trapped bubbles. */
  'ice',
  /** Style Pack 12: insulated sandwich panels: vertical seams, a rib down each panel, rivets top and bottom (one storey a repeat). */
  'prefab',
  /** Style Pack 12: concrete with snow lodged in its pores and drifted in patches. */
  'snowcrete',
  /** Style Pack 12: dark layered rock rimed with frost on its ledges. */
  'frostrock',
  /** Style Pack 11: pier decking: weathered boards with gaps and nails over the joists. */
  'decking',
  /** Style Pack 11: big granite quay blocks in courses. */
  'ashlar',
  /** Style Pack 11: a shingle beach of small rounded pebbles. */
  'pebbles',
  /** Style Pack 11: corrugated iron sheet with rust weeping from the bolt lines. */
  'corrugated',
  /** Style Pack 11: tarred horizontal lap boards (net sheds). */
  'lapboards',
  /** Style Pack 11: two horizontal bands per repeat (lighthouse stripes). */
  'bands',
  /** Style Pack 09 Desert City: coursed sandstone ashlar, long and short blocks, fine joints, tooled faces. */
  'sandstone_ashlar',
  /** Style Pack 09 Desert City: lime plaster, sun-faded, flaked away in patches to the stone beneath (the accent). */
  'stucco',
  /** Style Pack 09 Desert City: glazed fish-scale tiles (a dome), each its own shade, a few in the accent. */
  'scales',
  /** Style Pack 09 Desert City: zellige: eight-point stars in the accent in a field of the base, crosses between, grouted. */
  'zellige',
  /** Style Pack 09 Desert City: worn flagstones: courses of uneven slabs, joints in the accent. */
  'flags',
  /** Style Pack 09 Desert City: a woven rug: borders, a lozenge medallion and small motifs in the accent and cream on the base. */
  'rug',
  /** Style Pack 09 Desert City: a mashrabiya lattice: diagonal turned-wood bars (base) with knots, the dark (accent) between. */
  'lattice',
  /** Style Pack 06: big square stone slabs, worn and chipped, moss growing in the joints. */
  'slabs',
  /** Style Pack 06: courses of temple blocks cut with a step-fret (stepped spiral) frieze. */
  'fret',
  /** Style Pack 06: carved relief panels (a masked face, a sun disc, a serpent) framed by a border, one per block. */
  'relief',
  /** Style Pack 06: square inlay tiles: a gold frame round a teal field with a gold lozenge and dots. */
  'inlay',
  /** Style Pack 06: forest floor knotted with roots over dark earth, leaf litter between. */
  'roots',
  /** Style Pack 06: palm thatch: overlapping rows of long straw strands. */
  'thatch',
] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

export const MATERIAL_CATEGORIES = ['Prototype', 'Stone', 'Brick', 'Wood', 'Metal', 'Tile', 'Fabric', 'Ground', 'Tech', 'Paint'] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export interface MaterialDefinition {
  id: string;
  displayName: string;
  category: MaterialCategory;
  pattern: PatternId;
  /** Main and secondary colours of the pattern (hex). */
  base: string;
  accent: string;
  /** Metres covered by one texture repeat. */
  scale: number;
  /** 0 = matte, 1 = glossy. */
  shine: number;
  /** Glows regardless of lighting (light strips, screens). */
  emissive?: boolean;
  /**
   * A photographed/scanned texture set (ambientCG asset ID, CC0) used instead
   * of the procedural pattern: textures/<id>_color.jpg, _normal.jpg and, for
   * glowing materials, _emission.jpg. `base` is its average colour (used for
   * minimaps and icons).
   */
  texture?: string;
}

export interface SurfaceStyleDef {
  material: string;
  /** Multiplies the material colours; null/absent = no tint. */
  tint?: string | null;
}

export interface ThemeDefinition {
  id: string;
  displayName: string;
  /** Default style for each slot when a tile does not override it. */
  slots: Record<ThemeSlot, SurfaceStyleDef>;
  sky: string;
}

class Registry<T extends { id: string }> {
  private readonly byId = new Map<string, T>();
  constructor(items: readonly T[]) {
    for (const i of items) {
      if (this.byId.has(i.id)) throw new Error(`duplicate id ${i.id}`);
      this.byId.set(i.id, i);
    }
  }
  get(id: string): T | undefined {
    return this.byId.get(id);
  }
  all(): T[] {
    return [...this.byId.values()];
  }
}

export const coreMaterials = new Registry(CORE_MATERIALS);
export const coreThemes = new Registry(CORE_THEMES);
export type MaterialCatalog = Registry<MaterialDefinition>;
export type ThemeCatalog = Registry<ThemeDefinition>;
