/**
 * The Classic Grid's small, fixed vocabulary: sides, edge styles, room
 * layouts, floor inserts, ceilings, corners, facades and palette groups, with
 * their labels. Map documents (schema.ts) and the menu need only these; the
 * tile tables themselves (catalog.ts and the Style Pack pieces in
 * packTiles*.ts) load with a match or MapMaker (docs/LOADING.md). catalog.ts
 * re-exports everything here.
 */

/** Sides in clockwise order; rotating a tile by k quarter turns maps side i to (i + k) % 4. */
export const SIDES = ['N', 'E', 'S', 'W'] as const;
export type Side = (typeof SIDES)[number];

/** Grid direction for each side. Grid +Y is world +Z (north), grid +X is world +X (east). */
export const SIDE_DIRS: Record<Side, readonly [number, number]> = {
  N: [0, 1],
  E: [1, 0],
  S: [0, -1],
  W: [-1, 0],
};

export interface TilePort {
  side: Side;
  /** Which of the tile's occupied levels (local dz) this port sits on. */
  level: number;
  /** Which cell (local [dx, dy]) of a multi-cell tile; default [0, 0]. */
  cell?: readonly [number, number];
}

/**
 * How one side of one cell is built. `auto` is the classic rule (doorway where
 * two ports meet, otherwise the tile's default edge). The others are chosen by
 * creators per side in MapMaker, so the same room can have windows, arches,
 * half walls or no wall at all.
 */
export const EDGE_STYLES = ['auto', 'wall', 'door', 'wide', 'arch', 'window', 'windows', 'slit', 'half', 'railing', 'high', 'tower', 'fence', 'broken', 'bars', 'shutter', 'open'] as const;
export type EdgeStyle = (typeof EDGE_STYLES)[number];

export const EDGE_STYLE_LABELS: Record<EdgeStyle, string> = {
  auto: 'Auto',
  wall: 'Solid wall',
  door: 'Doorway',
  wide: 'Wide doorway',
  arch: 'Archway',
  window: 'Window',
  windows: 'Twin windows',
  slit: 'Firing slit',
  half: 'Half wall',
  railing: 'Railing',
  high: 'High wall (2 storeys)',
  tower: 'Towering wall (4 storeys)',
  fence: 'Tall fence',
  broken: 'Broken wall',
  bars: 'Bars',
  shutter: 'Shutter (crouch under)',
  open: 'No wall',
};

// ---------------------------------------------------------------- room options

/**
 * Settings on a placed room (Room, the large rooms, Courtyard, Plaza) that
 * change what is built in it without changing its footprint: an interior
 * layout, a floor insert, a ceiling and corner pieces. They are sized to the
 * whole footprint, so "Four Pillars" in a Great Hall is four big pillars, not
 * four per cell.
 */
export const ROOM_LAYOUTS = ['empty', 'pillar', 'four_pillars', 'column_rows', 'low_cover', 'high_cover', 'dais', 'platform', 'rubble'] as const;
export type RoomLayout = (typeof ROOM_LAYOUTS)[number];
export const ROOM_LAYOUT_LABELS: Record<RoomLayout, string> = {
  empty: 'Empty',
  pillar: 'Central pillar',
  four_pillars: 'Four pillars',
  column_rows: 'Column rows',
  low_cover: 'Low cover',
  high_cover: 'High cover',
  dais: 'Dais',
  platform: 'Central platform',
  rubble: 'Rubble',
};

export const FLOOR_INSERTS = ['standard', 'raised', 'sunken'] as const;
export type FloorInsert = (typeof FLOOR_INSERTS)[number];
export const FLOOR_INSERT_LABELS: Record<FloorInsert, string> = {
  standard: 'Standard',
  raised: 'Raised centre',
  sunken: 'Sunken centre (nothing below)',
};

export const CEILINGS = ['open', 'roof', 'skylight', 'beams'] as const;
export type Ceiling = (typeof CEILINGS)[number];
export const CEILING_LABELS: Record<Ceiling, string> = {
  open: 'Open (no roof)',
  roof: 'Roof',
  skylight: 'Roof with skylight',
  beams: 'Beamed roof',
};

export const CORNERS = ['square', 'posts', 'columns', 'chamfered', 'rounded'] as const;
export type Corner = (typeof CORNERS)[number];
/**
 * Facades: the outside of a room's walls dressed, purely visual (doorways and
 * windows stay our own openings). City facades (Quaternius' Downtown City
 * MegaKit at 4/3 scale): brick, a shopfront ground floor or painted plaster,
 * with a cornice along the top and columns on the outer corners. The Style
 * Packs add their own: white station hull with round viewports (Orbital
 * Station), a glass curtain wall and a neon-lit block (Neon Megacity), drawn
 * from models; and boxes in library materials: bunker concrete or corrugated
 * sheet (01 Military Compound), a plank false front with an awning and
 * boardwalk, or adobe with roof beams (02 Frontier Dust); gothic stone with
 * buttresses and pinnacles or Victorian brick with quoins (05 Gothic Estate);
 * temple stone with a glyph frieze or overgrown rock hung with vines (06
 * Jungle Ruins); clapboard siding or brick with shutters (08 Suburban Chaos); dressed
 * limestone with pilasters and a cornice (03 Imperial Arena), or sandstone
 * with a painted hieroglyph band under a gilded cavetto cornice (09 Sands
 * of Egypt); half-timbering over a stone ground storey, or whitewash with
 * oak quoins and shutters (10 Medieval Village); sandstone ashlar with a carved band, lattice
 * screens and a stepped parapet, or weathered plaster with stone quoins and cedar beam ends
 * (09 Desert City); painted render with blue
 * window frames, or tarred lap boards (11 Coastal Harbor); insulated steel panels, or
 * snow-capped concrete (12 Snow Outpost).
 */
export const FACADES = ['none', 'brick', 'storefront', 'plaster', 'hull', 'glass', 'neon', 'concrete', 'corrugated', 'false_front', 'adobe', 'gothic_stone', 'manor_brick', 'temple', 'overgrown', 'clapboard', 'suburban_brick', 'roman', 'egyptian', 'timber_frame', 'village_plaster', 'prefab', 'snow_bunker', 'desert_ashlar', 'desert_plaster', 'harbour_render', 'tarred_timber'] as const;
export type Facade = (typeof FACADES)[number];
export const FACADE_LABELS: Record<Facade, string> = {
  none: 'None',
  brick: 'City brick',
  storefront: 'Shopfront and brick',
  plaster: 'Painted plaster',
  // Style Packs (pieces we model ourselves, packages/client/public/packs).
  hull: 'Station hull (viewports)',
  glass: 'Glass tower',
  neon: 'Neon block',
  concrete: 'Bunker concrete',
  corrugated: 'Corrugated sheet',
  false_front: 'Frontier false front',
  adobe: 'Adobe',
  gothic_stone: 'Gothic stone',
  manor_brick: 'Victorian brick',
  temple: 'Temple stone',
  overgrown: 'Overgrown rock',
  clapboard: 'Clapboard siding',
  suburban_brick: 'Suburban brick',
  roman: 'Roman limestone',
  egyptian: 'Egyptian temple',
  timber_frame: 'Half-timbered',
  village_plaster: 'Village whitewash',
  harbour_render: 'Harbour render',
  tarred_timber: 'Tarred timber',
  prefab: 'Prefab panels',
  snow_bunker: 'Snowy concrete',
  desert_ashlar: 'Desert ashlar',
  desert_plaster: 'Desert plaster',
};
/** Facades drawn from models: the city kit's, and the Orbital and Neon packs' own pieces (the rest are boxes drawn with the level). */
export const MODEL_FACADES: ReadonlySet<Facade> = new Set(['brick', 'storefront', 'plaster', 'hull', 'glass', 'neon']);

export const CORNER_LABELS: Record<Corner, string> = {
  square: 'Square',
  posts: 'Posts',
  columns: 'Columns',
  chamfered: 'Chamfered',
  rounded: 'Rounded',
};

/** Palette groups in MapMaker (after the reference board's tile browser). */
export const TILE_CATEGORIES = ['Rooms', 'Large', 'Buildings', 'Curves', 'Corridors', 'Vertical', 'Open', 'Special'] as const;
export type TileCategory = (typeof TILE_CATEGORIES)[number];

