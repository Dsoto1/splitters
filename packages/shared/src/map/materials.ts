/**
 * Hand-made surface material library and themes (PLAYER_EXPRESSION.md §1).
 *
 * Materials are data: a procedural pattern drawn by our own client code plus
 * colours, scale and finish. Players pick a material and an optional tint for
 * each surface slot of each tile; themes are just default palettes.
 */

/** Paintable surface groups of a Classic Grid tile. */
export const SURFACE_SLOTS = ['floor', 'walls', 'solids', 'underside', 'trim'] as const;
export type SurfaceSlot = (typeof SURFACE_SLOTS)[number];

export const SURFACE_SLOT_LABELS: Record<SurfaceSlot, string> = {
  floor: 'Floor',
  walls: 'Walls',
  solids: 'Pillars, cover & steps',
  underside: 'Underside (ceiling below)',
  trim: 'Trim & frames',
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
  | 'weave'
  /** Style Pack 09: columns of carved hieroglyphs between register lines (accent cut into the base). */
  | 'glyphs'
  /** Style Pack 09: hieroglyphs painted in ochre, turquoise and the accent on the base. */
  | 'glyphs_painted'
  /** Style Pack 03: small tesserae with a key-pattern border (Roman floor mosaic). */
  | 'mosaic'
  /** Style Pack 10: rounded cobblestones of uneven size set in mortar. */
  | 'cobbles'
  /** Style Pack 10: rectangular granite setts in running bond (a paved road). */
  | 'setts'
  /** Style Pack 10: square tiles laid on the diagonal in two colours (a market floor). */
  | 'diamonds'
  /** Style Pack 10: rows of curved clay roof tiles (pantiles), each row lapping the one below. */
  | 'pantiles'
  /** Style Pack 10: half-timbering: dark oak posts, rails and braces with plaster panels between (repeats every storey). */
  | 'timber'
  /** Style Pack 12: wind-packed snow, soft ripples of drift and a glint of frost. */
  | 'snow'
  /** Style Pack 12: clear ice over dark water, white cracks running through it and trapped bubbles. */
  | 'ice'
  /** Style Pack 12: insulated sandwich panels: vertical seams, a rib down each panel, rivets top and bottom (one storey a repeat). */
  | 'prefab'
  /** Style Pack 12: concrete with snow lodged in its pores and drifted in patches. */
  | 'snowcrete'
  /** Style Pack 12: dark layered rock rimed with frost on its ledges. */
  | 'frostrock';

export type MaterialCategory = 'Prototype' | 'Stone' | 'Brick' | 'Wood' | 'Metal' | 'Tile' | 'Fabric' | 'Ground' | 'Tech' | 'Paint';

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
  m('sand', 'Packed Sand', 'Stone', 'noise', '#d6bc84', '#c2a46c', 5),
  m('plaster', 'Sun Plaster', 'Stone', 'noise', '#e6d4aa', '#d2bd90', 3),
  m('marble', 'Marble', 'Stone', 'marble', '#e8e4dc', '#b9b2a6', 4, 0.5),
  m('red_brick', 'Red Brick', 'Brick', 'bricks', '#9c4a36', '#c9bfb0', 2),
  m('dark_brick', 'Soot Brick', 'Brick', 'bricks', '#4a4440', '#2c2826', 2),
  m('oak_planks', 'Oak Planks', 'Wood', 'planks', '#a2763f', '#7d5a2e', 2),
  m('dark_wood', 'Dark Wood Panels', 'Wood', 'panels', '#5a3a24', '#3f2918', 2),
  m('crate_wood', 'Crate Boards', 'Wood', 'planks', '#a8783f', '#7a5428', 1),
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
  m('proto_trim', 'Prototype Trim', 'Prototype', 'plain', '#5d636b', '#555b63', 4),
  m('brass', 'Brass', 'Metal', 'plain', '#b08d3a', '#9a7a30', 4, 0.7),
  m('stone_trim', 'Dressed Stone', 'Stone', 'noise', '#cfc8ba', '#b9b2a4', 2),
  // Style Packs: 04 Orbital Station (white panels, glowing trim) and 07 Neon Megacity (neon tubes, wet asphalt).
  m('orbital_panel', 'Station Panels', 'Tech', 'panels', '#eef1f4', '#c4ccd4', 2, 0.55),
  m('glow_trim', 'Glow Trim', 'Tech', 'plain', '#7fe6ff', '#7fe6ff', 1, 0.3, true),
  m('neon_tube', 'Neon Tube', 'Tech', 'plain', '#ff4fd8', '#ff4fd8', 1, 0.3, true),
  // Style Packs 03 Imperial Arena and 09 Sands of Egypt: our own procedural paint.
  m('hieroglyphs', 'Carved Hieroglyphs', 'Stone', 'glyphs', '#d8bf8c', '#7a5a34', 2.4),
  m('hieroglyphs_painted', 'Painted Hieroglyphs', 'Stone', 'glyphs_painted', '#e2cb98', '#2a3a8a', 2.4),
  m('mosaic', 'Roman Mosaic', 'Tile', 'mosaic', '#e8dcc0', '#8a2a1e', 2, 0.2),
  m('gold_leaf', 'Gold Leaf', 'Metal', 'plain', '#d8a83a', '#c89830', 4, 0.8),
  m('lapis', 'Lapis Paint', 'Paint', 'noise', '#2a4aa0', '#1e3478', 2, 0.3),
  // Style Pack 10 Medieval Village: our own procedural paint (half-timbering repeats every 4 m storey).
  m('cobblestones', 'Cobblestones', 'Stone', 'cobbles', '#8c8478', '#4e4a44', 2.5),
  m('road_setts', 'Granite Setts', 'Stone', 'setts', '#7e7a74', '#46423e', 2.5),
  m('market_tiles', 'Market Tiles', 'Tile', 'diamonds', '#b8694a', '#d9c7a2', 2, 0.15),
  m('roof_tiles_red', 'Red Roof Tiles', 'Tile', 'pantiles', '#a84a30', '#5e2618', 1.6),
  m('timber_frame', 'Timber and Plaster', 'Wood', 'timber', '#e6dcc4', '#3e2a1c', 4),
  m('wattle', 'Wattle', 'Wood', 'weave', '#8a6a44', '#5a4228', 2),
  m('packed_dirt', 'Packed Dirt', 'Ground', 'noise', '#7a6448', '#635038', 3),
  m('whitewash', 'Whitewash', 'Stone', 'noise', '#ece6d6', '#d8d0bc', 2.5),
  m('oak_beam', 'Oak Beam', 'Wood', 'planks', '#4a3220', '#30200f', 1.5),
  // Style Pack 12 Snow Outpost: our own procedural paint (prefab panels repeat every 4 m storey).
  m('packed_snow', 'Packed Snow', 'Ground', 'snow', '#e4eaf0', '#bccad8', 4, 0.15),
  m('drift_snow', 'Snow Drift', 'Ground', 'snow', '#f4f7fa', '#d0dce8', 3, 0.2),
  m('lake_ice', 'Lake Ice', 'Ground', 'ice', '#4f8eaa', '#e6f4fc', 5, 0.85),
  m('glacier_ice', 'Glacier Ice', 'Stone', 'ice', '#9cd2e8', '#f2fbff', 3, 0.7),
  m('prefab_red', 'Red Prefab Panels', 'Metal', 'prefab', '#b4402e', '#e8e4dc', 4, 0.35),
  m('prefab_white', 'White Prefab Panels', 'Metal', 'prefab', '#e2e6e8', '#8e989e', 4, 0.35),
  m('snowy_concrete', 'Snowy Concrete', 'Stone', 'snowcrete', '#8c9094', '#eef2f6', 4),
  m('frozen_rock', 'Frozen Rock', 'Stone', 'frostrock', '#565c64', '#dce6ee', 5),
  m('steel_grating', 'Steel Grating', 'Metal', 'grate', '#6e767c', '#202428', 1, 0.5),
  m('beacon_red', 'Red Beacon', 'Tech', 'plain', '#ff3a2a', '#ff3a2a', 1, 0.3, true),
  // Photographed and scanned sets from ambientCG (CC0, see content/textures.json).
  t('pbr_concrete', 'Smooth Concrete', 'Stone', 'Concrete034', '#a8a6a2', 4),
  t('pbr_concrete_dark', 'Dark Concrete', 'Stone', 'Concrete042A', '#6c6964', 4),
  t('pbr_plaster', 'Rough Plaster', 'Stone', 'Plaster001', '#d8d4cc', 3),
  t('pbr_plaster_white', 'White Plaster', 'Stone', 'PaintedPlaster017', '#d2d0cb', 3),
  t('pbr_rock', 'Mossy Rock', 'Stone', 'Rock064', '#76765a', 3),
  t('pbr_marble_black', 'Black Marble', 'Stone', 'Marble006', '#2a2826', 3, 0.6),
  t('pbr_onyx', 'Onyx Swirl', 'Stone', 'Onyx015', '#bdbab6', 3, 0.5),
  t('pbr_travertine', 'Travertine', 'Stone', 'Travertine009', '#d6c4a2', 3, 0.3),
  t('pbr_brick_red', 'Red Brick', 'Brick', 'Bricks059', '#99523e', 2.4),
  t('pbr_brick_old', 'Old Brick', 'Brick', 'Bricks090', '#a87358', 2.4),
  t('pbr_castle_stone', 'Mossy Castle Stone', 'Brick', 'Bricks076C', '#5e6248', 3),
  t('pbr_floorboards', 'Old Floorboards', 'Wood', 'WoodFloor041', '#5e4430', 2),
  t('pbr_planks', 'Barn Planks', 'Wood', 'Planks037A', '#5a4030', 2.5),
  t('pbr_walnut', 'Walnut', 'Wood', 'Wood051', '#4a3024', 2),
  t('pbr_siding', 'Wood Siding', 'Wood', 'WoodSiding008', '#4c3a2a', 3),
  t('pbr_charred_wood', 'Charred Wood', 'Wood', 'PaintedWood005', '#2c2a24', 2.5),
  t('pbr_tread_plate', 'Tread Plate', 'Metal', 'MetalPlates006', '#4a4e56', 1.5, 0.5),
  t('pbr_rusted_plate', 'Rusted Plating', 'Metal', 'MetalPlates013', '#6a5448', 2, 0.3),
  t('pbr_steel', 'Weathered Steel', 'Metal', 'Metal063', '#62666a', 3, 0.5),
  t('pbr_white_panel', 'White Panel', 'Metal', 'Metal049A', '#e8e8e6', 3, 0.5),
  t('pbr_corrugated', 'Painted Corrugated', 'Metal', 'CorrugatedSteel007A', '#8ab4c8', 2, 0.4),
  t('pbr_walkway', 'Perforated Walkway', 'Metal', 'MetalWalkway014', '#7a4a3a', 1.5, 0.4),
  t('pbr_space_metal', 'Starfield Metal', 'Tech', 'SheetMetal004', '#26262c', 2, 0.6),
  t('pbr_glass_facade', 'Glass Facade', 'Tech', 'Facade006', '#5c6e78', 4, 0.8),
  t('pbr_checker', 'Marble Checker', 'Tile', 'Tiles074', '#7a6a5a', 2, 0.6),
  t('pbr_flagstone', 'Dark Flagstone', 'Tile', 'Tiles090', '#3e3e3c', 3, 0.2),
  t('pbr_delft', 'Delft Tiles', 'Tile', 'Tiles101', '#c8ccea', 1.5, 0.6),
  t('pbr_hex_paving', 'Hex Paving', 'Tile', 'PavingStones130', '#a89480', 2),
  t('pbr_terrazzo', 'Terrazzo', 'Tile', 'Terrazzo013', '#d8ccc4', 2, 0.5),
  t('pbr_roof', 'Clay Roof Tiles', 'Tile', 'RoofingTiles008', '#7a4a32', 2),
  t('pbr_carpet', 'Navy Carpet', 'Fabric', 'Carpet012', '#2a3046', 2),
  t('pbr_canvas', 'Army Canvas', 'Fabric', 'Fabric028', '#7c7a68', 2),
  t('pbr_grass', 'Grass', 'Ground', 'Grass001', '#4a6a22', 3),
  t('pbr_moss', 'Moss', 'Ground', 'Moss002', '#4a6a1c', 3),
  t('pbr_forest', 'Forest Floor', 'Ground', 'Ground037', '#6a7034', 4),
  t('pbr_gravel', 'Gravel', 'Ground', 'Gravel023', '#c4c0bc', 3),
  t('pbr_sand', 'Desert Sand', 'Ground', 'Ground054', '#a08a64', 5),
  t('pbr_snow', 'Snowy Ground', 'Ground', 'Snow015', '#c8ccc4', 4),
  t('pbr_ice', 'Ice', 'Ground', 'Ice002', '#4a8a86', 3, 0.8),
  t('pbr_asphalt', 'Asphalt', 'Ground', 'Asphalt031', '#7a7a7a', 4),
  t('pbr_wet_asphalt', 'Wet Asphalt', 'Ground', 'Asphalt031', '#3a3a40', 4, 0.85),
  t('pbr_lava', 'Lava', 'Ground', 'Lava004', '#b4421c', 4, 0.2, true),
  // Style Pack 01 Military Compound.
  t('pbr_bunker_panels', 'Bunker Concrete', 'Stone', 'Concrete031', '#64615c', 4),
  t('pbr_olive_corrugated', 'Olive Corrugated', 'Metal', 'CorrugatedSteel006A', '#255626', 2, 0.35),
  t('pbr_grey_corrugated', 'Grey Corrugated', 'Metal', 'CorrugatedSteel009', '#818080', 2, 0.35),
  t('pbr_burlap', 'Burlap', 'Fabric', 'Fabric061', '#8d8882', 1.5),
  // Style Pack 02 Frontier Dust.
  t('pbr_weathered_planks', 'Weathered Planks', 'Wood', 'Planks039', '#b49467', 2.5),
  t('pbr_weathered_siding', 'Weathered Siding', 'Wood', 'WoodSiding013', '#665845', 2.5),
  t('pbr_adobe', 'Adobe', 'Stone', 'Clay005', '#9d785d', 3),
  t('pbr_dusty_road', 'Dusty Road', 'Ground', 'Ground109', '#7e6e54', 4),
  // Style Packs 05 Gothic Estate, 06 Jungle Ruins and 08 Suburban Chaos.
  m('wallpaper_damask', 'Damask Wallpaper', 'Paint', 'stripes', '#5a1a24', '#44121a', 0.6),
  t('pbr_slate_roof', 'Slate Shingles', 'Tile', 'RoofingTiles002', '#3e403d', 2),
  t('pbr_mossy_cobble', 'Mossy Cobbles', 'Stone', 'PavingStones138', '#97906f', 2.5),
  t('pbr_jungle_rock', 'Layered Rock', 'Stone', 'Rock051', '#767261', 4),
  t('pbr_pool_tiles', 'Pool Tiles', 'Tile', 'Tiles132A', '#3bb5d3', 1.5, 0.6),
  t('pbr_clapboard', 'Painted Clapboard', 'Wood', 'WoodSiding009', '#cac19c', 2.5),
  // Style Pack 03 Imperial Arena.
  t('pbr_limestone', 'Dressed Limestone', 'Stone', 'Tiles139', '#c9b8a2', 3),
  t('pbr_white_marble', 'White Marble', 'Stone', 'Marble012', '#c9ccd2', 3, 0.5),
  t('pbr_opus_incertum', 'Roman Rubblework', 'Brick', 'Bricks075A', '#8f8068', 2.5),
  // Style Pack 09 Sands of Egypt.
  t('pbr_sandstone_blocks', 'Sandstone Blocks', 'Stone', 'Tiles142', '#d8b88e', 3),
  t('pbr_rough_sandstone', 'Rough Sandstone', 'Brick', 'Bricks083', '#b0a27a', 2.5),
];

/** A textured material from a scanned set (see MaterialDefinition.texture). */
function t(id: string, displayName: string, category: MaterialCategory, texture: string, base: string, scale: number, shine = 0.08, emissive = false): MaterialDefinition {
  return { ...m(id, displayName, category, 'plain', base, base, scale, shine, emissive), texture };
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
  slots: Record<SurfaceSlot, SurfaceStyleDef>;
  sky: string;
}

export const CORE_THEMES: readonly ThemeDefinition[] = [
  theme('prototype', 'Prototype', '#85a0b8', 'proto_floor', 'proto_wall', 'proto_solid', 'proto_wall', 'proto_trim'),
  theme('tomb', 'Desert Tomb', '#e3c48f', 'pbr_travertine', ['sandstone', '#e8d9b8'], ['marble', '#e0c890'], ['sandstone', '#a08a66'], ['pbr_travertine', '#d8b870']),
  theme('desert', 'Desert Town', '#9cc6e8', 'pbr_sand', ['pbr_plaster', '#ead6ae'], 'pbr_planks', ['pbr_plaster', '#b89c6c'], 'pbr_charred_wood'),
  theme('factory', 'Factory', '#6f6a64', 'pbr_tread_plate', 'pbr_brick_old', 'hazard', 'pbr_rusted_plate', 'pbr_steel'),
  theme('lab', 'Research Lab', '#1b2633', 'pbr_terrazzo', 'pbr_white_panel', 'circuit', 'light_strip', 'pbr_steel'),
  theme('manor', 'Gothic Manor', '#2a2433', 'pbr_carpet', 'pbr_walnut', 'pbr_marble_black', 'pbr_floorboards', 'brass'),
  theme('castle', 'Castle Keep', '#7d93ad', 'pbr_flagstone', 'pbr_castle_stone', 'pbr_planks', 'pbr_floorboards', 'stone_trim'),
  theme('station', 'Space Station', '#05070d', 'pbr_tread_plate', 'pbr_white_panel', 'hazard', 'pbr_space_metal', ['light_strip', '#7fd8ff']),
  theme('ruins', 'Jungle Ruins', '#a8c8a0', 'pbr_moss', 'pbr_rock', ['pbr_travertine', '#c8d0b0'], 'pbr_rock', 'pbr_castle_stone'),
  theme('neon', 'Neon City', '#120b24', 'pbr_asphalt', ['pbr_brick_red', '#8a7a9a'], 'hazard', 'pbr_concrete_dark', ['light_strip', '#ff5ea8']),
  theme('arctic', 'Arctic Base', '#c8dcec', 'pbr_snow', 'pbr_corrugated', 'hazard', 'pbr_steel', 'pbr_white_panel'),
  theme('saloon', 'Frontier Saloon', '#f0c890', 'pbr_floorboards', 'pbr_siding', 'crate_wood', 'pbr_planks', 'pbr_charred_wood'),
  theme('volcano', 'Volcano Lair', '#2a0e08', ['pbr_flagstone', '#8a7a70'], ['pbr_rock', '#7a5a4a'], 'pbr_onyx', 'pbr_charred_wood', 'pbr_lava'),
  theme('city', 'Downtown', '#a8bcd0', 'pbr_asphalt', 'pbr_brick_red', 'pbr_concrete', 'pbr_concrete', 'pbr_steel'),
  theme('temple', 'Marble Temple', '#f0e2c0', 'pbr_checker', 'pbr_travertine', 'pbr_marble_black', 'pbr_onyx', 'brass'),
  theme('harbour', 'Harbour', '#9ab8cc', 'pbr_hex_paving', 'pbr_brick_old', 'pbr_planks', 'pbr_delft', 'pbr_plaster_white'),
  theme('bunker', 'Bunker', '#5c6058', 'pbr_concrete_dark', 'pbr_concrete', 'pbr_canvas', 'pbr_steel', 'hazard'),
  theme('forest', 'Forest Camp', '#8ab08a', 'pbr_forest', 'pbr_planks', 'pbr_rock', 'pbr_siding', 'pbr_walnut'),
  theme('canyon', 'Canyon Outpost', '#8fb8dc', 'pbr_tread_plate', 'pbr_concrete', 'pbr_rusted_plate', 'pbr_steel', 'hazard'),
  theme('garden', 'Walled Garden', '#b8d8f0', 'pbr_grass', 'pbr_brick_red', 'pbr_hex_paving', 'pbr_brick_old', 'stone_trim'),
  // Style Pack themes (editor/stylePacks.ts).
  theme('orbital', 'Orbital Station', '#05070d', ['grate', '#b8c2cc'], 'orbital_panel', 'pbr_white_panel', ['orbital_panel', '#c8d0d8'], 'glow_trim'),
  theme('neon_megacity', 'Neon Megacity', '#0d0820', 'pbr_wet_asphalt', ['pbr_concrete_dark', '#8a80a0'], 'pbr_glass_facade', 'pbr_concrete_dark', 'neon_tube'),
  theme('military', 'Military Compound', '#8fa0ae', ['pbr_concrete_dark', '#b4b0a6'], 'pbr_bunker_panels', ['pbr_olive_corrugated', '#d8dcc0'], 'pbr_concrete', ['pbr_steel', '#a8aca8']),
  theme('frontier', 'Frontier Dust', '#f0cc98', 'pbr_weathered_planks', 'pbr_weathered_siding', ['crate_wood', '#c8a070'], 'pbr_planks', 'pbr_charred_wood'),
  theme('imperial', 'Imperial Arena', '#9fc8ec', ['pbr_sand', '#e8d4a8'], 'pbr_limestone', 'pbr_travertine', ['pbr_opus_incertum', '#d8c8b0'], 'pbr_white_marble'),
  theme('egypt', 'Sands of Egypt', '#f2d8a0', 'pbr_sand', 'pbr_sandstone_blocks', ['pbr_rough_sandstone', '#f0dcb0'], 'lapis', ['gold_leaf', '#f0d070']),
  theme('adobe', 'Frontier Adobe', '#f4d2a0', ['pbr_floorboards', '#d8b890'], 'pbr_adobe', ['pbr_adobe', '#e8d0b0'], 'pbr_weathered_planks', 'pbr_walnut'),
  theme('gothic_estate', 'Gothic Estate', '#231d2c', 'pbr_floorboards', 'wallpaper_damask', 'pbr_walnut', 'dark_wood', 'brass'),
  theme('jungle_temple', 'Jungle Temple', '#a8c8a0', 'pbr_mossy_cobble', 'pbr_castle_stone', 'pbr_jungle_rock', 'pbr_rock', ['pbr_travertine', '#b8c0a0']),
  theme('medieval', 'Medieval Village', '#a8c8e8', 'cobblestones', 'timber_frame', ['oak_beam', '#c8a888'], 'pbr_floorboards', 'oak_beam'),
  theme('snow_outpost', 'Snow Outpost', '#c4d8ea', 'packed_snow', 'prefab_red', 'snowy_concrete', ['pbr_steel', '#b8c0c8'], 'prefab_white'),
  theme('suburban', 'Suburban', '#9cc8f0', 'oak_planks', 'pbr_plaster_white', 'pbr_clapboard', 'pbr_plaster_white', ['paint_matte', '#f4f2ec']),
];

/** Shorthand for a theme: each slot is a material name or [material, tint]. */
function theme(id: string, displayName: string, sky: string, ...slots: (string | [string, string])[]): ThemeDefinition {
  const style = (x: string | [string, string]): SurfaceStyleDef => (typeof x === 'string' ? { material: `core.${x}` } : { material: `core.${x[0]}`, tint: x[1] });
  const [floor, walls, solids, underside, trim] = slots.map(style);
  return { id: `core.${id}`, displayName, sky, slots: { floor: floor!, walls: walls!, solids: solids!, underside: underside!, trim: trim! } };
}

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
