/**
 * Hand-made surface material library and themes (PLAYER_EXPRESSION.md §1).
 *
 * Materials are data: a procedural pattern drawn by our own client code plus
 * colours, scale and finish. Players pick a material and an optional tint for
 * each surface slot of each tile; themes are just default palettes.
 */

/** Paintable surface groups of a Classic Grid tile. */
export const SURFACE_SLOTS = ['floor', 'walls', 'solids', 'underside'] as const;
export type SurfaceSlot = (typeof SURFACE_SLOTS)[number];

export const SURFACE_SLOT_LABELS: Record<SurfaceSlot, string> = {
  floor: 'Floor',
  walls: 'Walls',
  solids: 'Pillars, cover & steps',
  underside: 'Underside (ceiling below)',
};

export type PatternId =
  | 'grid'
  | 'plain'
  | 'noise'
  | 'bricks'
  | 'blocks'
  | 'planks'
  | 'tiles'
  | 'checker'
  | 'plates'
  | 'grate'
  | 'panels'
  | 'stripes'
  | 'hex'
  | 'marble'
  | 'weave';

export type MaterialCategory = 'Prototype' | 'Stone' | 'Brick' | 'Wood' | 'Metal' | 'Tile' | 'Fabric' | 'Tech' | 'Paint';

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
}

const m = (id: string, displayName: string, category: MaterialCategory, pattern: PatternId, base: string, accent: string, scale: number, shine = 0.05, emissive = false): MaterialDefinition => ({
  id: `core.${id}`,
  displayName,
  category,
  pattern,
  base,
  accent,
  scale,
  shine,
  ...(emissive ? { emissive } : {}),
});

export const CORE_MATERIALS: readonly MaterialDefinition[] = [
  m('proto_floor', 'Prototype Grid', 'Prototype', 'grid', '#9aa0a8', '#7e848c', 2),
  m('proto_wall', 'Prototype Wall', 'Prototype', 'grid', '#d9d6cf', '#bdbab3', 2),
  m('proto_solid', 'Prototype Orange', 'Prototype', 'grid', '#d98b3a', '#bf7630', 2),
  m('concrete', 'Concrete', 'Stone', 'noise', '#9c9a95', '#86847f', 4),
  m('sandstone', 'Sandstone Blocks', 'Stone', 'blocks', '#cdb27c', '#a88f5e', 3),
  m('cobble', 'Grey Stone Blocks', 'Stone', 'blocks', '#8a8d91', '#6c6f73', 2.5),
  m('marble', 'Marble', 'Stone', 'marble', '#e8e4dc', '#b9b2a6', 4, 0.5),
  m('red_brick', 'Red Brick', 'Brick', 'bricks', '#9c4a36', '#c9bfb0', 2),
  m('dark_brick', 'Soot Brick', 'Brick', 'bricks', '#4a4440', '#2c2826', 2),
  m('oak_planks', 'Oak Planks', 'Wood', 'planks', '#a2763f', '#7d5a2e', 2),
  m('dark_wood', 'Dark Wood Panels', 'Wood', 'panels', '#5a3a24', '#3f2918', 2),
  m('steel_plate', 'Steel Plate', 'Metal', 'plates', '#8f989f', '#6f777e', 2, 0.6),
  m('rusty_metal', 'Rusted Metal', 'Metal', 'noise', '#8a5a3c', '#5e3b26', 3, 0.2),
  m('grate', 'Floor Grate', 'Metal', 'grate', '#5e6469', '#2a2d30', 1, 0.5),
  m('hazard', 'Hazard Stripes', 'Metal', 'stripes', '#e8b520', '#1e1e1e', 1.5, 0.3),
  m('white_tiles', 'White Tiles', 'Tile', 'tiles', '#eceae4', '#b6b3ab', 1, 0.6),
  m('checker', 'Checker Floor', 'Tile', 'checker', '#1d1d1f', '#e9e6df', 2, 0.6),
  m('hex_tiles', 'Hex Tiles', 'Tile', 'hex', '#4a8c8c', '#2f5c5c', 1.5, 0.4),
  m('carpet', 'Carpet', 'Fabric', 'weave', '#7a2430', '#5e1b25', 1.5),
  m('canvas', 'Canvas', 'Fabric', 'weave', '#b7aa8a', '#9a8f72', 1),
  m('scifi_panel', 'Sci-Fi Panels', 'Tech', 'panels', '#c9d2d9', '#8b98a3', 2, 0.5),
  m('circuit', 'Dark Tech', 'Tech', 'plates', '#23282e', '#3a8fb7', 2, 0.6),
  m('light_strip', 'Light Panel', 'Tech', 'stripes', '#bfe8ff', '#5ab4e6', 2, 0.2, true),
  m('paint_matte', 'Painted (Matte)', 'Paint', 'plain', '#ffffff', '#f2f2f2', 4),
  m('paint_gloss', 'Painted (Gloss)', 'Paint', 'plain', '#ffffff', '#f2f2f2', 4, 0.8),
];

export interface SurfaceStyleDef {
  material: string;
  /** Multiplies the material colours; null/absent = no tint. */
  tint?: string | null;
}

export interface ThemeDefinition {
  id: string;
  displayName: string;
  /** Default style for each slot when a tile does not override it. */
  slots: Record<SurfaceSlot, SurfaceStyleDef>;
  sky: string;
}

export const CORE_THEMES: readonly ThemeDefinition[] = [
  {
    id: 'core.prototype',
    displayName: 'Prototype',
    slots: { floor: { material: 'core.proto_floor' }, walls: { material: 'core.proto_wall' }, solids: { material: 'core.proto_solid' }, underside: { material: 'core.proto_wall' } },
    sky: '#85a0b8',
  },
  {
    id: 'core.tomb',
    displayName: 'Desert Tomb',
    slots: { floor: { material: 'core.sandstone' }, walls: { material: 'core.sandstone', tint: '#e8d9b8' }, solids: { material: 'core.marble', tint: '#e0c890' }, underside: { material: 'core.sandstone', tint: '#a08a66' } },
    sky: '#e3c48f',
  },
  {
    id: 'core.factory',
    displayName: 'Factory',
    slots: { floor: { material: 'core.grate' }, walls: { material: 'core.red_brick' }, solids: { material: 'core.hazard' }, underside: { material: 'core.rusty_metal' } },
    sky: '#6f6a64',
  },
  {
    id: 'core.lab',
    displayName: 'Research Lab',
    slots: { floor: { material: 'core.white_tiles' }, walls: { material: 'core.scifi_panel' }, solids: { material: 'core.circuit' }, underside: { material: 'core.light_strip' } },
    sky: '#1b2633',
  },
  {
    id: 'core.manor',
    displayName: 'Gothic Manor',
    slots: { floor: { material: 'core.carpet' }, walls: { material: 'core.dark_wood' }, solids: { material: 'core.cobble' }, underside: { material: 'core.dark_brick' } },
    sky: '#2a2433',
  },
];

/** Curated tint swatches offered first in the UI; any #rrggbb is also allowed. */
export const TINT_SWATCHES: readonly string[] = [
  '#ffffff', '#d8d8d8', '#a8a8a8', '#707070', '#3c3c3c', '#1a1a1a',
  '#ff6b6b', '#d62828', '#8c1c13', '#ffb4a2', '#f77f00', '#a35200',
  '#ffe066', '#fcbf49', '#b08900', '#c7f9cc', '#57cc99', '#1b7a43',
  '#a0e7e5', '#4cc9f0', '#1d6fb8', '#1b2a6b', '#b8b8ff', '#7b2cbf',
  '#f4a6d7', '#c9184a', '#e9d8a6', '#b5838d', '#6d4c41', '#3e2723',
];

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
