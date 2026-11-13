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
 * half walls or no wall at all. The styles, their labels and shapes are data:
 * content/tiles/edges.json (tools/content/tiles.mjs).
 */
import { EDGE_STYLES, EDGE_STYLE_LABELS } from '../content/edgeStyles.generated.ts';

export { EDGE_STYLES, EDGE_STYLE_LABELS };
export type EdgeStyle = (typeof EDGE_STYLES)[number];

/** Metres, or `half` (half the side) / `height` (the level height) times a factor plus metres, or the height capped at `upTo`. */
export type EdgeValue = number | { half: number; add?: number } | { height: number; add?: number } | { upTo: number };
/** Repeat a piece along the side, from `from` to `to` (inclusive with `through`) every `step` m; its u is then offsets. */
export interface EdgeRepeat {
  from: EdgeValue;
  to: EdgeValue;
  through?: boolean;
  step: number;
  /** Keep each piece within the side. */
  clamp?: boolean;
}
/** A colliding piece of a side: u along it, y up, `t` thick (default the wall thickness). */
export interface EdgeSegment {
  u: readonly [EdgeValue, EdgeValue];
  y: readonly [EdgeValue, EdgeValue];
  t?: number;
  repeat?: EdgeRepeat;
}
/**
 * A segmental arch's dressing: `count` voussoirs (an odd count has a keystone `key` m taller in the middle) on the
 * circle through the springing points (u[0] and u[1] at height y[0]) and the crown (y[1] over the middle), each
 * `band` m deep and standing `depth` off the wall, and a soffit under the curve through the wall's thickness.
 */
export interface EdgeArch {
  u: readonly [number, number];
  y: readonly [number, number];
  count: number;
  band: number;
  key?: number;
  depth?: number;
}
/**
 * Trim on a side's inner face: a baseboard, a cornice (levels 3 m or more), a door frame (when the level is 0.2 m
 * over its top), a window surround, an arch's voussoirs and soffit, or a box standing `depth` off the wall.
 * `outside`: drawn on the wall's outer face too, where nothing is built beyond the side (an arch seen from the street).
 */
export type EdgeTrim =
  | { base: readonly [EdgeValue, EdgeValue] }
  | { cornice: readonly [EdgeValue, EdgeValue] }
  | { frame: { half: number; top: number } }
  | { window: { u: readonly [number, number]; y: readonly [number, number] } }
  | { arch: EdgeArch; outside?: boolean }
  | { u: readonly [EdgeValue, EdgeValue]; y: readonly [EdgeValue, EdgeValue]; depth: number; repeat?: EdgeRepeat; outside?: boolean };
/** What a built edge style is made of (content/tiles/edges.json). */
export interface EdgeShape {
  segments: readonly EdgeSegment[];
  trim: readonly EdgeTrim[];
  /** How far the trim's face stands off (default the wall thickness). */
  trimFrom?: number;
  /** Doorway and window openings [u0, u1, y0, y1]: framed under a facade, glazed on glass styles. */
  openings?: readonly (readonly [number, number, number, number])[];
  /** As a tile's default edge it counts as open: ports meeting there build no doorway (railings). */
  openDefault?: boolean;
  /** How room dressing reads it: a way in, a window gap, or see-through (default: wall to stand things against). */
  dressing?: { kind: 'door' | 'window'; span: number } | { kind: 'see-through' };
}

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

/**
 * `vault` (v27): a shallow segmental barrel vault under the ceiling, along the room's long way (a carriageway's
 * passage, a cloister), with a beam under its springing wherever a side has no wall to carry it; a roof over it where
 * nothing is built above, as `roof`.
 */
export const CEILINGS = ['open', 'roof', 'skylight', 'beams', 'vault'] as const;
export type Ceiling = (typeof CEILINGS)[number];
export const CEILING_LABELS: Record<Ceiling, string> = {
  open: 'Open (no roof)',
  roof: 'Roof',
  skylight: 'Roof with skylight',
  beams: 'Beamed roof',
  vault: 'Vaulted ceiling',
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
export const FACADES = ['none', 'brick', 'storefront', 'plaster', 'hull', 'glass', 'neon', 'concrete', 'corrugated', 'false_front', 'adobe', 'gothic_stone', 'collegiate_stone', 'manor_brick', 'temple', 'overgrown', 'clapboard', 'suburban_brick', 'roman', 'egyptian', 'timber_frame', 'village_plaster', 'prefab', 'snow_bunker', 'desert_ashlar', 'desert_plaster', 'harbour_render', 'tarred_timber'] as const;
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
  collegiate_stone: 'Collegiate stone',
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
export const TILE_CATEGORIES = ['Rooms', 'Large', 'Buildings', 'Curves', 'Corridors', 'Tunnels', 'Vertical', 'Open', 'Special'] as const;
export type TileCategory = (typeof TILE_CATEGORIES)[number];

