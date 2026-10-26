/**
 * Interior dressing: furnish a room so it reads as what it is (a kitchen, an
 * office, a chapel) instead of a scatter of crates. A room type is a recipe
 * (data): wall pieces that stand with their backs to a wall facing in (beds,
 * counters, bookcases, lockers), corner pieces (plants, lamps), centre groups
 * (a table and its chairs, a sofa round a coffee table on a rug, rows of
 * desks or pews) and wall decor (shelves, banners, sword mounts).
 *
 * Placement is deterministic for a seed and works on a 0.2 m occupancy grid
 * of the room's floor:
 * - nothing stands in front of a doorway (1.5 m deep) or a window, half wall
 *   or railing (0.9 m), nor on spawns, pickups and other set pieces;
 * - pieces never overlap each other or the room's own pillars and cover;
 * - after every solid piece the room must still have a walking lane (2 m: wide enough for bots too)
 *   joining every doorway that was joined before, and keep most of its open
 *   floor, so dressing never cuts a route or fills a room;
 * - recipes mix in waist-high pieces (counters, desks, tables, crates) so a
 *   dressed room is also cover to fight round.
 *
 * `dressRoom` works on any `DressSpace` (floor rectangles, walls, openings);
 * `dressSpace` reads one from a map (a placed room's cells, its resolved
 * walls, doors and windows, and what already stands in it).
 */
import { getProp } from '../content/props.ts';
import { SIDE_DIRS, SIDES, seededRandom, type Side } from './catalog.ts';
import { boxBounds, buildMapGeometry, buildOccupancy, cellKey, edgeSegments, resolveEdge, rotateXZ, type WorldBox } from './geometry.ts';
import type { MapDocument } from './schema.ts';

// ---------------------------------------------------------------- room types

export const ROOM_TYPES = [
  'kitchen',
  'dining',
  'living',
  'bedroom',
  'bathroom',
  'office',
  'classroom',
  'library',
  'storage',
  'warehouse',
  'barracks',
  'lab',
  'bar',
  'shop',
  'workshop',
  'chapel',
  'cell',
  'armoury',
  'server',
  'lobby',
  'conference',
  // Style Packs 05 Gothic Estate and 06 Jungle Ruins.
  'parlour',
  'crypt',
  'conservatory',
  'shrine',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  kitchen: 'Kitchen',
  dining: 'Dining room',
  living: 'Living room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  office: 'Office',
  classroom: 'Classroom',
  library: 'Library',
  storage: 'Storeroom',
  warehouse: 'Warehouse',
  barracks: 'Barracks',
  lab: 'Laboratory',
  bar: 'Bar / restaurant',
  shop: 'Shop',
  workshop: 'Garage / workshop',
  chapel: 'Chapel',
  cell: 'Prison cell',
  armoury: 'Armoury',
  server: 'Server room',
  lobby: 'Lobby / reception',
  conference: 'Conference room',
  parlour: 'Victorian parlour',
  crypt: 'Crypt',
  conservatory: 'Conservatory',
  shrine: 'Temple shrine',
};

export const DRESS_DENSITIES = ['sparse', 'normal', 'full'] as const;
export type DressDensity = (typeof DRESS_DENSITIES)[number];
const DENSITY: Record<DressDensity, { count: number; open: number }> = {
  // count: multiplier on each recipe's pieces per cell of floor; open: share of the room's walkable floor that must stay open.
  sparse: { count: 0.55, open: 0.6 },
  normal: { count: 1, open: 0.45 },
  full: { count: 1.5, open: 0.35 },
};

// ---------------------------------------------------------------- the space a room offers

/** A rectangle of floor in world metres (x east, z north). */
export interface DressRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** The inside face of a wall pieces can stand against: an axis-aligned segment and its normal into the room. */
export interface DressWall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  nx: number;
  nz: number;
}

/**
 * A gap in the room's boundary, centred at (x, z) on the inside face with its
 * normal into the room: a `door` (any way in: doorway, arch, open side) is
 * kept clear and joined to the others by a walking lane; a `window` (window,
 * firing slit, half wall, railing, bars, or a drop) is kept clear.
 */
export interface DressOpening {
  x: number;
  z: number;
  nx: number;
  nz: number;
  width: number;
  kind: 'door' | 'window';
}

export interface DressSpace {
  /** Floor height. */
  y: number;
  /** The floor (their union; they may touch). */
  rects: DressRect[];
  walls: DressWall[];
  openings: DressOpening[];
  /** Footprints already taken (pillars, cover, props): nothing goes there and nobody walks there. */
  blocked?: DressRect[];
  /** Spots kept clear (spawns, pickups, objectives), radius in metres. */
  keepClear?: { x: number; z: number; r: number }[];
  /** Other ways in (the foot of a flight of stairs), kept clear within `r` and joined to the doorways' lanes. */
  entries?: { x: number; z: number; r: number }[];
}

/** One prop the dresser places: a prop entity without its ID. */
export interface DressedProp {
  kind: 'prop';
  model: string;
  position: [number, number, number];
  yaw: number;
  scale: number;
  solid: boolean;
  tint: null;
}

export interface DressOptions {
  /** Same seed, same room: same dressing. */
  seed?: string | number;
  density?: DressDensity;
  /** Most props this room may take (default 48). */
  max?: number;
  /** The map's prop models so far and its budget of different models: once at the limit, only models already in use are picked. */
  models?: { used: ReadonlySet<string>; limit: number };
}

// ---------------------------------------------------------------- recipes

interface Part {
  model: string;
  x: number;
  z: number;
  /** Height above the floor (on a table, hung from the ceiling). */
  y: number;
  yaw: number;
  solid: boolean;
  /** Flat (rugs): other pieces may stand on it. */
  flat: boolean;
}

/** A unit placed in one go, in its own frame: centred on the origin, facing +Z (its back at -d/2). */
export interface DressPiece {
  parts: Part[];
  w: number;
  d: number;
}

export type DressSlot = 'wall' | 'corner' | 'centre' | 'decor';
export interface DressItem {
  slot: DressSlot;
  /** Alternatives: one is the room's own pick, the others turn up now and then. */
  pieces: DressPiece[];
  /** How many per 49 m² (the floor of one walled 8 m cell) at normal density. */
  per: number;
  min?: number;
  max: number;
  /** Wall pieces: 'far' from the doors, 'near' them, centred on the 'front' wall (opposite the main door), or 'mid' on any wall. */
  place?: 'far' | 'near' | 'front' | 'mid';
  /** Centre groups: turned to face the front wall (in rows), along the room's long axis, or any quarter turn. */
  face?: 'front' | 'axis' | 'any';
  /** Clear space kept round the piece (m). */
  gap?: number;
  /** Decor: height of its base above the floor. */
  height?: number;
}

const PROP_FALLBACK = [0.5, 0.5, 0.5] as const;
const size = (model: string) => getProp(`prop.${model}`)?.size ?? PROP_FALLBACK;
const collides = (model: string) => !!getProp(`prop.${model}`)?.collision;

/** Half extents of a w × d footprint turned by `yaw`. */
function turnedHalf(w: number, d: number, yaw: number): [number, number] {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  return [(c * w + s * d) / 2, (s * w + c * d) / 2];
}

function part(model: string, x = 0, z = 0, o: { yaw?: number; y?: number; solid?: boolean; flat?: boolean } = {}): Part {
  const flat = o.flat ?? size(model)[1] < 0.05;
  return { model, x, z, y: o.y ?? 0, yaw: o.yaw ?? 0, solid: o.solid ?? (collides(model) && !flat), flat };
}

/** Centre the parts standing on the floor on the origin and measure them. */
function piece(parts: Part[]): DressPiece {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of parts) {
    if (p.y > 0.3) continue;
    const [w, , d] = size(p.model);
    const [hx, hz] = turnedHalf(w, d, p.yaw);
    x0 = Math.min(x0, p.x - hx);
    x1 = Math.max(x1, p.x + hx);
    z0 = Math.min(z0, p.z - hz);
    z1 = Math.max(z1, p.z + hz);
  }
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  return { parts: parts.map((p) => ({ ...p, x: p.x - cx, z: p.z - cz })), w: x1 - x0, d: z1 - z0 };
}

const Q = Math.PI / 2;
/** One prop on its own (turned within its frame by `yaw`). */
const one = (model: string, yaw = 0, o: { solid?: boolean } = {}): DressPiece => piece([part(model, 0, 0, { yaw, ...o })]);
/** Props side by side along the wall (a run of kitchen units), backs flush. */
function run(models: string[]): DressPiece {
  let x = 0;
  const depth = Math.max(...models.map((m) => size(m)[2]));
  return piece(
    models.map((m) => {
      const [w, , d] = size(m);
      const p = part(m, x + w / 2, -depth / 2 + d / 2);
      x += w;
      return p;
    }),
  );
}
/** A piece with another on each side, backs flush (a bed between nightstands). */
function flanked(main: string, side: string, sides: 1 | 2 = 2): DressPiece {
  const [w, , d] = size(main);
  const [sw, , sd] = size(side);
  const parts = [part(main)];
  for (const s of sides === 2 ? [-1, 1] : [1]) parts.push(part(side, s * (w / 2 + sw / 2 + 0.05), -d / 2 + sd / 2));
  return piece(parts);
}
/** A piece with a seat in front of it facing it (a desk against the wall and its chair). */
function seatInFront(main: string, seat: string, o: { top?: string } = {}): DressPiece {
  const [, h, d] = size(main);
  const [, , sd] = size(seat);
  const parts = [part(main), part(seat, 0, d / 2 + sd / 2 + 0.1, { yaw: Math.PI, solid: false })];
  if (o.top) parts.push(part(o.top, size(main)[0] / 4, 0, { y: h, solid: false }));
  return piece(parts);
}
/** A seat with a piece in front of it, both facing the same way (a reception desk, a pupil's desk). */
function seatBehind(main: string, seat: string, o: { top?: string; seats?: number } = {}): DressPiece {
  const [w, h, d] = size(main);
  const [, , sd] = size(seat);
  const n = o.seats ?? 1;
  const parts = [part(main)];
  for (let i = 0; i < n; i++) parts.push(part(seat, n === 1 ? 0 : (i - (n - 1) / 2) * (w / n), -(d / 2 + sd / 2 + 0.1), { solid: false }));
  if (o.top) parts.push(part(o.top, -w / 4, 0, { y: h, solid: false }));
  return piece(parts);
}
/** A piece with another standing on top. */
function onTop(main: string, top: string, o: { x?: number; turn?: number } = {}): DressPiece {
  return piece([part(main, 0, 0, { yaw: o.turn }), part(top, o.x ?? 0, 0, { y: size(main)[1], solid: false })]);
}
/** A table with chairs round it facing in: along both long sides, and at the ends too with `ends`. */
function seated(table: string, chair: string, o: { ends?: boolean; top?: string; above?: string } = {}): DressPiece {
  const [w, h, d] = size(table);
  const [cw, , cd] = size(chair);
  const parts = [part(table)];
  const long = w >= d ? 'x' : 'z';
  const len = Math.max(w, d);
  const across = Math.min(w, d);
  const n = Math.max(1, Math.min(4, Math.floor((len - 0.1) / Math.max(0.7, cw + 0.25))));
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) * (len / n);
    const v = across / 2 + cd / 2 + 0.05;
    for (const s of [-1, 1]) {
      if (long === 'x') parts.push(part(chair, u, s * v, { yaw: s > 0 ? Math.PI : 0, solid: false }));
      else parts.push(part(chair, s * v, u, { yaw: s > 0 ? -Q : Q, solid: false }));
    }
  }
  if (o.ends) {
    const v = len / 2 + cd / 2 + 0.05;
    for (const s of [-1, 1]) {
      if (long === 'x') parts.push(part(chair, s * v, 0, { yaw: s > 0 ? -Q : Q, solid: false }));
      else parts.push(part(chair, 0, s * v, { yaw: s > 0 ? Math.PI : 0, solid: false }));
    }
  }
  if (o.top) parts.push(part(o.top, 0, 0, { y: h, solid: false }));
  if (o.above) parts.push(part(o.above, 0, 0, { y: 2.9, solid: false }));
  return piece(parts);
}
/** A sofa and armchairs round a low table on a rug. */
function lounge(sofa: string, table: string, chair: string, rug: string): DressPiece {
  const [, , td] = size(table);
  const [tw] = size(table);
  const [, , sd] = size(sofa);
  const [, , cd] = size(chair);
  const [rw, , rd] = size(rug);
  return piece([
    part(rug, 0, 0, { yaw: rw < rd ? Q : 0 }),
    part(table),
    part(sofa, 0, -(td / 2 + 0.55 + sd / 2)),
    part(chair, -(tw / 2 + 0.55 + cd / 2), 0, { yaw: Q }),
    part(chair, tw / 2 + 0.55 + cd / 2, 0, { yaw: -Q }),
  ]);
}
/** A reading or waiting nook: two armchairs either side of a low table on a round rug. */
function nook(): DressPiece {
  const [tw] = size('hm_side_table');
  const [, , cd] = size('hm_armchair');
  const x = tw / 2 + 0.3 + cd / 2;
  return piece([part('rug_round'), part('hm_side_table'), part('hm_armchair', -x, 0, { yaw: Q }), part('hm_armchair', x, 0, { yaw: -Q })]);
}
/** Two pieces back to back (shelving or racks in an aisle). */
function backToBack(a: string, b = a): DressPiece {
  const [, , da] = size(a);
  const [, , db] = size(b);
  return piece([part(a, 0, da / 2 + 0.02), part(b, 0, -db / 2 - 0.02, { yaw: Math.PI })]);
}
/** A loose cluster: the first prop, the rest round it. */
function cluster(models: string[]): DressPiece {
  const spots: [number, number][] = [[0, 0], [1, 0], [0.5, 0.85], [-0.5, 0.85], [1.5, 0.85]];
  const unit = Math.max(...models.map((m) => Math.max(size(m)[0], size(m)[2]))) + 0.05;
  return piece(models.slice(0, spots.length).map((m, i) => part(m, spots[i]![0] * unit, spots[i]![1] * unit, { yaw: i * 0.7 })));
}
/** A crate with another on top (stacked stores). */
function stack(base: string, top: string, o: { turn?: number } = {}): DressPiece {
  return piece([part(base, 0, 0, { yaw: o.turn }), part(top, 0, 0, { y: size(base)[1], yaw: 0.3 })]);
}
/** Pews or benches in a row facing front, turned so their long side runs across the room. */
const pew = (model: string): DressPiece => (size(model)[2] > size(model)[0] ? one(model, Q) : one(model));

const wall = (pieces: DressPiece[], per: number, max: number, o: Partial<DressItem> = {}): DressItem => ({ slot: 'wall', pieces, per, max, ...o });
const corner = (pieces: DressPiece[], per: number, max: number, o: Partial<DressItem> = {}): DressItem => ({ slot: 'corner', pieces, per, max, ...o });
const centre = (pieces: DressPiece[], per: number, max: number, o: Partial<DressItem> = {}): DressItem => ({ slot: 'centre', pieces, per, max, ...o });
const decor = (pieces: DressPiece[], per: number, max: number, height: number): DressItem => ({ slot: 'decor', pieces, per, max, height });
const ones = (models: string[]) => models.map((m) => one(m));

/**
 * The recipes, most important piece first (placing stops at a room's budget).
 * Model IDs are props without their `prop.` prefix.
 */
export const DRESS_RECIPES: Record<RoomType, DressItem[]> = {
  kitchen: [
    wall([run(['hm_kitchen_counter_long', 'hm_oven', 'hm_kitchen_sink', 'hm_kitchen_counter_long', 'hm_kitchen_counter_long']), run(['kitchen_cabinet', 'stove', 'kitchen_cabinet', 'kitchen_cabinet'])], 1, 2, { min: 1, place: 'mid' }),
    wall([one('hm_fridge'), one('fridge')], 0.8, 1, { min: 1 }),
    centre([seated('dg_table_small', 'hm_stool'), seated('table', 'chair')], 0.8, 1, { face: 'axis' }),
    wall([one('hm_kitchen_cabinet'), one('hm_shelf_large')], 0.6, 2),
    wall([one('washer'), one('hm_washer')], 0.3, 1),
    corner(ones(['hm_bin_large', 'trashcan', 'hm_houseplant_tall']), 1, 2),
    decor([one('hm_wall_shelf')], 1, 2, 1.6),
  ],
  dining: [
    centre([seated('dg_table_long', 'hm_chair_wood', { above: 'hm_chandelier' }), seated('table', 'chair_cushion', { ends: true }), seated('hm_table_round', 'hm_chair_wood')], 0.9, 2, { min: 1, face: 'axis', gap: 0.7 }),
    wall(ones(['hm_dresser', 'kitchen_cabinet', 'hm_chest_drawers']), 0.8, 2, { place: 'mid' }),
    wall([one('hm_fireplace')], 0.4, 1, { place: 'far' }),
    corner(ones(['hm_houseplant_tall', 'hm_floor_lamp', 'rn_urn']), 1.5, 4),
    decor([one('hm_wall_shelf')], 0.6, 2, 1.6),
  ],
  living: [
    centre([lounge('hm_couch', 'hm_side_table', 'hm_armchair', 'hm_rug'), lounge('sofa', 'side_table', 'armchair', 'rug')], 0.8, 1, { min: 1, face: 'axis', gap: 0.5 }),
    wall([onTop('tv_cabinet', 'tv'), one('hm_fireplace')], 0.8, 1, { place: 'mid' }),
    wall(ones(['hm_bookshelf', 'bookcase', 'hm_shelf_large']), 1.2, 3),
    wall(ones(['hm_couch_large', 'sofa']), 0.4, 1),
    corner(ones(['hm_floor_lamp', 'hm_houseplant_tall', 'hm_potted_palm', 'floor_lamp']), 2, 4),
    decor([one('hm_wall_shelf')], 0.6, 2, 1.6),
  ],
  bedroom: [
    wall([flanked('hm_bed_king', 'hm_nightstand'), flanked('hm_bed_single', 'hm_nightstand', 1), flanked('bed', 'side_table', 1)], 0.9, 2, { min: 1, place: 'far' }),
    wall(ones(['hm_dresser', 'hm_shelf_large', 'bookcase']), 0.8, 2),
    wall([seatInFront('desk', 'hm_chair_wood', { top: 'hm_desk_lamp' })], 0.3, 1),
    centre(ones(['hm_rug', 'rug']), 0.5, 1, { face: 'axis', gap: 0.2 }),
    corner(ones(['hm_floor_lamp', 'hm_houseplant', 'coat_rack']), 1.2, 3),
    decor([one('hm_wall_shelf')], 0.6, 2, 1.5),
  ],
  bathroom: [
    wall([one('hm_bathtub', Q), one('hm_shower'), one('bathtub')], 0.9, 1, { min: 1, place: 'far' }),
    wall(ones(['hm_toilet', 'toilet']), 1, 2, { min: 1 }),
    wall([one('hm_bathroom_sink')], 1, 2, { min: 1 }),
    wall(ones(['hm_washer', 'washer']), 0.4, 1),
    corner(ones(['hm_bin_large', 'trashcan', 'plant_small']), 0.8, 2),
    centre([one('hm_rug')], 0.3, 1, { face: 'axis', gap: 0.2 }),
  ],
  office: [
    centre([seatBehind('desk', 'hm_chair_office', { top: 'hm_desk_lamp' }), seatBehind('desk', 'office_chair')], 1.4, 6, { min: 1, face: 'axis', gap: 0.8 }),
    wall(ones(['bookcase', 'bookcase_wide', 'hm_shelf_large', 'hm_bookshelf']), 1.2, 4),
    wall([seatInFront('desk', 'hm_chair_office')], 0.5, 2),
    wall([one('sf_computer'), one('shelf_boxes')], 0.3, 1),
    corner(ones(['potted_plant', 'hm_houseplant_tall', 'trashcan', 'hm_floor_lamp', 'coat_rack']), 2, 4),
    decor([one('hm_wall_shelf')], 0.5, 2, 1.6),
  ],
  classroom: [
    wall([seatInFront('desk', 'hm_chair_office', { top: 'hm_desk_lamp' })], 1, 1, { min: 1, place: 'front' }),
    centre([seatBehind('desk', 'hm_chair_wood', { seats: 2 })], 3, 12, { min: 2, face: 'front', gap: 0.5 }),
    wall(ones(['bookcase', 'hm_bookshelf', 'hm_shelf_large']), 1, 3),
    corner(ones(['potted_plant', 'trashcan', 'coat_rack']), 1, 2),
    decor([one('hm_wall_shelf')], 0.6, 3, 1.6),
  ],
  library: [
    wall(ones(['rn_bookcase', 'hm_bookshelf', 'bookcase_wide', 'bookcase']), 3, 10, { min: 2 }),
    centre([seated('dg_table_long', 'hm_chair_wood', { top: 'hm_desk_lamp' }), seated('table', 'chair', { top: 'hm_desk_lamp' })], 0.8, 2, { min: 1, face: 'axis', gap: 0.7 }),
    centre([nook()], 0.4, 1, { face: 'axis' }),
    corner(ones(['hm_floor_lamp', 'hm_armchair', 'hm_houseplant_tall']), 1.5, 4),
  ],
  storage: [
    wall([one('shelf_boxes'), one('shelf_bags'), one('crate_large', Q), one('metal_crate'), stack('crate_large', 'crate_small', { turn: Q })], 2.5, 8, { min: 1 }),
    centre([stack('crate_large', 'crate_small'), cluster(['barrel', 'barrel', 'barrel_open']), cluster(['crate_small', 'crate_open', 'crate_small']), stack('metal_crate', 'cardboard_box')], 1, 3, { face: 'any', gap: 0.9 }),
    corner(ones(['barrel', 'cardboard_box', 'crate_small', 'container']), 2, 4),
  ],
  warehouse: [
    wall([one('shelf_boxes'), one('shelf_bags'), one('cargo_crate'), one('container_tall'), stack('crate_large', 'crate_small', { turn: Q })], 2.5, 12, { min: 2 }),
    centre([one('factory_box'), stack('cargo_crate', 'crate_small'), backToBack('shelf_boxes', 'shelf_bags'), cluster(['barrel', 'barrel', 'barrel', 'barrel_open']), one('skip')], 1.2, 6, { min: 1, face: 'axis', gap: 1.1 }),
    corner(ones(['barrel', 'cardboard_box', 'container', 'cone']), 2, 4),
  ],
  barracks: [
    wall([flanked('bunk_bed', 'metal_crate', 1), flanked('hm_bunk_bed', 'sf_chest', 1), one('bunk_bed')], 2.5, 8, { min: 2 }),
    wall(ones(['shelf_bags', 'metal_crate', 'sf_chest']), 0.8, 2),
    centre([seated('dg_table_small', 'dungeon_chair'), seated('table', 'chair')], 0.5, 1, { face: 'axis', gap: 0.7 }),
    corner(ones(['barrel', 'sv_backpack', 'crate_small', 'sv_trashcan_metal']), 1.2, 3),
  ],
  lab: [
    wall(ones(['computer_wide', 'sf_computer', 'screen_panel', 'machine_window']), 2, 5, { min: 1 }),
    centre([one('holo_table'), one('display_table'), seated('space_table', 'space_chair')], 0.9, 2, { min: 1, face: 'axis', gap: 0.8 }),
    wall(ones(['pipe_glass', 'sf_chest']), 0.4, 1),
    corner(ones(['sf_barrel', 'sf_crate', 'potted_plant']), 1.5, 4),
  ],
  bar: [
    wall([piece([...run(['hm_kitchen_counter_long', 'hm_kitchen_counter_long', 'hm_kitchen_sink', 'hm_kitchen_counter_long', 'hm_kitchen_counter_long']).parts, ...[-1.2, -0.4, 0.4, 1.2].map((x) => part('bar_stool', x, 0.85, { yaw: Math.PI }))])], 1, 1, { min: 1, place: 'far' }),
    centre([seated('table_round', 'chair'), seated('hm_table_round', 'hm_chair_wood'), seated('dg_table_small', 'dungeon_chair')], 1.5, 5, { min: 1, face: 'any', gap: 0.7 }),
    wall(ones(['crate_bottles', 'barrel', 'dungeon_barrel', 'kitchen_cabinet']), 1, 3),
    corner(ones(['speaker', 'potted_plant', 'barrel']), 1.5, 4),
  ],
  shop: [
    wall(ones(['shelf_boxes', 'shelf_bags', 'freezers_upright', 'bottle_return', 'bread_display']), 2.5, 8, { min: 2 }),
    centre([one('checkout')], 0.5, 1, { min: 1, face: 'axis', gap: 0.9 }),
    centre([backToBack('shelf_end', 'shelf_end'), backToBack('shelf_boxes', 'shelf_bags'), one('fruit_display'), one('freezer')], 1, 4, { face: 'axis', gap: 1.0 }),
    corner(ones(['shopping_cart', 'cardboard_box', 'potted_plant']), 1, 3),
  ],
  workshop: [
    wall(ones(['workbench', 'shelf_boxes', 'metal_crate', 'machine', 'pipe_valve']), 2, 6, { min: 1 }),
    centre([piece([part('workbench', -0.6), part('workbench', 0.6)]), cluster(['sv_propane', 'barrel']), one('factory_box_long')], 0.7, 2, { face: 'axis', gap: 0.9 }),
    corner(ones(['sv_gas_can', 'sv_propane', 'barrel', 'cone', 'sv_trashcan_metal']), 2, 4),
  ],
  chapel: [
    wall([piece([part('altar'), part('candles', -0.6, 0, { y: size('altar')[1] }), part('candles', 0.6, 0, { y: size('altar')[1] })])], 1, 1, { min: 1, place: 'front' }),
    centre([pew('stall_bench'), pew('graveyard_bench')], 3, 10, { min: 2, face: 'front', gap: 0.5 }),
    wall(ones(['rn_statue_fox', 'rn_statue_stag', 'urn']), 0.4, 2),
    corner(ones(['rn_urn', 'candles', 'rn_candles', 'pillar']), 2, 4),
    decor([one('dg_banner')], 1, 4, 1.2),
  ],
  cell: [
    wall(ones(['hm_bed_single', 'bed']), 1, 1, { min: 1, place: 'far' }),
    wall(ones(['hm_toilet', 'toilet']), 1, 1, { min: 1 }),
    corner(ones(['dg_bucket', 'bucket']), 1, 1),
    corner(ones(['dg_skull', 'debris']), 0.5, 1),
  ],
  armoury: [
    wall(ones(['shelf_bags', 'sf_chest', 'dg_chest', 'metal_crate', 'crate_large']), 2, 6, { min: 1 }),
    centre([one('dg_table_long'), one('workbench'), stack('crate_large', 'sv_medkit_case')], 0.6, 1, { face: 'axis', gap: 0.9 }),
    corner(ones(['powder_keg', 'barrel', 'sv_gas_can', 'dg_barrel']), 1.5, 4),
    decor(ones(['dg_sword_mount', 'shield']), 1.5, 4, 1.4),
  ],
  server: [
    wall(ones(['computer_bank', 'computer_wide', 'sf_computer']), 2.5, 8, { min: 2 }),
    centre([piece([...[-0.7, 0, 0.7].map((x) => part('sf_computer', x, 0.32)), ...[-0.7, 0, 0.7].map((x) => part('sf_computer', x, -0.32, { yaw: Math.PI }))]), one('computer_wide')], 1.2, 4, { min: 1, face: 'axis', gap: 1.0 }),
    corner(ones(['sf_barrel', 'sf_crate']), 1, 3),
  ],
  lobby: [
    wall([seatBehind('desk_corner', 'hm_chair_office'), seatBehind('desk', 'hm_chair_office', { top: 'hm_desk_lamp' })], 1, 1, { min: 1, place: 'far' }),
    wall(ones(['hm_couch_large', 'sofa_long', 'sofa']), 1, 3),
    centre([nook()], 0.5, 1, { face: 'axis' }),
    corner(ones(['hm_potted_palm', 'hm_houseplant_tall', 'coat_rack', 'potted_plant']), 2.5, 4),
  ],
  conference: [
    centre([seated('dg_table_long', 'hm_chair_office', { ends: true }), seated('space_table', 'space_chair'), seated('table', 'office_chair', { ends: true })], 0.9, 1, { min: 1, face: 'axis', gap: 0.6 }),
    wall([onTop('tv_cabinet', 'tv')], 1, 1, { place: 'front' }),
    wall(ones(['hm_shelf_large', 'bookcase']), 0.6, 2),
    corner(ones(['potted_plant', 'hm_houseplant_tall', 'speaker']), 1.5, 4),
  ],
  parlour: [
    centre([lounge('hm_couch', 'hm_side_table', 'ge_wingback_chair', 'hm_rug'), nook()], 0.8, 1, { min: 1, face: 'axis', gap: 0.5 }),
    wall([one('hm_fireplace'), one('ge_grand_piano')], 0.6, 1, { place: 'mid' }),
    wall(ones(['ge_grandfather_clock', 'ge_bookcase_tall', 'ge_writing_desk']), 1, 3),
    corner(ones(['ge_candelabra', 'hm_floor_lamp', 'ge_suit_of_armour']), 1.5, 4),
    decor([one('ge_portrait')], 1, 3, 1.5),
  ],
  crypt: [
    centre([one('ge_sarcophagus'), one('coffin')], 0.8, 2, { min: 1, face: 'axis', gap: 0.9 }),
    wall(ones(['coffin', 'coffin_old', 'ge_headstone_tall']), 1.5, 5, { min: 1 }),
    corner(ones(['candles', 'rn_candles', 'urn', 'dg_skull']), 2, 4),
  ],
  conservatory: [
    centre([seated('hm_table_round', 'hm_chair_wood'), nook()], 0.6, 1, { min: 1, face: 'axis', gap: 0.6 }),
    wall(ones(['hm_potted_palm', 'jg_monstera', 'hm_houseplant_tall', 'ge_topiary']), 2.5, 8, { min: 2 }),
    corner(ones(['jg_banana_plant', 'jg_giant_fern', 'hm_potted_palm']), 2, 4),
  ],
  shrine: [
    wall([one('jg_altar_stone'), one('jg_stone_idol')], 1, 1, { min: 1, place: 'front' }),
    centre([one('jg_rubble_blocks'), one('jg_altar_stone')], 0.6, 2, { min: 1, face: 'axis', gap: 0.9 }),
    wall(ones(['jg_stele', 'jg_carved_pillar', 'jg_serpent_statue']), 1, 3),
    corner(ones(['jg_brazier', 'rn_urn', 'rn_urn_broken']), 2, 4),
  ],
};

/** Every prop a room type's recipe can place (`prop.` ids). */
export function recipeModels(type: RoomType): string[] {
  const out = new Set<string>();
  for (const item of DRESS_RECIPES[type]) for (const p of item.pieces) for (const q of p.parts) out.add(`prop.${q.model}`);
  return [...out];
}

// ---------------------------------------------------------------- the occupancy grid

const RES = 0.2;
/**
 * Lane: a cell is on it when its centre is at least this many cells from anything you can't walk through:
 * 1 m either side, a 2 m lane. Players need 1 m; bots' navmesh keeps 0.8 m off every obstacle and
 * rounds to its 0.2 m voxels, so a lane the validator's reachability check (and the bots) can follow is wider.
 */
const LANE_CELLS = 5.5;
const FREE = 0;
const USED = 1;
const RESERVED = 2;

class Grid {
  readonly nx: number;
  readonly nz: number;
  readonly floor: Uint8Array;
  readonly use: Uint8Array;
  readonly block: Uint8Array;
  readonly top: Float32Array;
  readonly decor: Uint8Array;

  constructor(
    readonly x0: number,
    readonly z0: number,
    x1: number,
    z1: number,
  ) {
    this.nx = Math.max(1, Math.ceil((x1 - x0) / RES));
    this.nz = Math.max(1, Math.ceil((z1 - z0) / RES));
    const n = this.nx * this.nz;
    this.floor = new Uint8Array(n);
    this.use = new Uint8Array(n);
    this.block = new Uint8Array(n);
    this.top = new Float32Array(n);
    this.decor = new Uint8Array(n);
  }

  /** Cells whose centres lie in the rectangle. */
  cells(x0: number, z0: number, x1: number, z1: number): number[] {
    const out: number[] = [];
    const i0 = Math.max(0, Math.ceil((x0 - this.x0) / RES - 0.5));
    const i1 = Math.min(this.nx - 1, Math.floor((x1 - this.x0) / RES - 0.5));
    const j0 = Math.max(0, Math.ceil((z0 - this.z0) / RES - 0.5));
    const j1 = Math.min(this.nz - 1, Math.floor((z1 - this.z0) / RES - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(i + j * this.nx);
    return out;
  }

  /** Whether the whole rectangle lies inside the grid. */
  inside(x0: number, z0: number, x1: number, z1: number): boolean {
    return x0 >= this.x0 - 1e-6 && z0 >= this.z0 - 1e-6 && x1 <= this.x0 + this.nx * RES + 1e-6 && z1 <= this.z0 + this.nz * RES + 1e-6;
  }

  centre(i: number): [number, number] {
    return [this.x0 + ((i % this.nx) + 0.5) * RES, this.z0 + (Math.floor(i / this.nx) + 0.5) * RES];
  }

  /** Chamfer distance (in cells) from each cell to the nearest cell nobody can stand in. */
  clearance(): Float32Array {
    const { nx, nz } = this;
    const d = new Float32Array(nx * nz);
    for (let i = 0; i < d.length; i++) d[i] = this.floor[i] && !this.block[i] ? 1e6 : 0;
    const D = Math.SQRT2;
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= nx || j >= nz ? 0 : d[i + j * nx]!);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = i + j * nx;
        if (!d[k]) continue;
        d[k] = Math.min(d[k]!, at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + D, at(i + 1, j - 1) + D);
      }
    for (let j = nz - 1; j >= 0; j--)
      for (let i = nx - 1; i >= 0; i--) {
        const k = i + j * nx;
        if (!d[k]) continue;
        d[k] = Math.min(d[k]!, at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + D, at(i - 1, j + 1) + D);
      }
    return d;
  }

  /** Lane cells labelled by connected component (0 = not on a lane). */
  lanes(): { label: Int32Array; sizes: number[] } {
    const d = this.clearance();
    const { nx, nz } = this;
    const label = new Int32Array(nx * nz);
    const sizes = [0];
    const stack: number[] = [];
    for (let s = 0; s < label.length; s++) {
      if (label[s] || d[s]! < LANE_CELLS) continue;
      const id = sizes.length;
      let n = 0;
      label[s] = id;
      stack.push(s);
      while (stack.length) {
        const k = stack.pop()!;
        n++;
        const i = k % nx;
        const j = (k - i) / nx;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
          const q = a + b * nx;
          if (label[q] || d[q]! < LANE_CELLS) continue;
          label[q] = id;
          stack.push(q);
        }
      }
      sizes.push(n);
    }
    return { label, sizes };
  }
}

/** What the lane check compares against: which doorways share a lane, and how much floor the lanes reach. */
interface LaneState {
  /** Per door: its lane component (0 = none). */
  doors: number[];
  reach: number;
  /** Pockets: stretches of lane cut off from every doorway. */
  pockets: number;
}

/** Smallest stretch of lane that counts as a pocket when it is cut off (0.24 m²). */
const POCKET_CELLS = 6;

function laneState(grid: Grid, entries: number[][]): LaneState {
  const { label, sizes } = grid.lanes();
  const doors = entries.map((cells) => {
    for (const c of cells) if (label[c]) return label[c]!;
    return 0;
  });
  const reached = new Set(doors.filter((x) => x));
  if (!reached.size && sizes.length > 1) reached.add(sizes.indexOf(Math.max(...sizes.slice(1))));
  let reach = 0;
  let pockets = 0;
  for (let id = 1; id < sizes.length; id++) {
    if (reached.has(id)) reach += sizes[id]!;
    else if (sizes[id]! >= POCKET_CELLS) pockets++;
  }
  return { doors, reach, pockets };
}

/**
 * Still fine: every doorway on a lane before still is, doorways that shared a
 * lane still do, no new pocket of floor is cut off from the doorways (bots
 * could not reach a pickup or a spawn put there later), and enough floor
 * stays reachable.
 */
function lanesHold(base: LaneState, now: LaneState, open: number): boolean {
  for (let a = 0; a < base.doors.length; a++) {
    if (!base.doors[a]) continue;
    if (!now.doors[a]) return false;
    for (let b = a + 1; b < base.doors.length; b++) if (base.doors[a] === base.doors[b] && now.doors[a] !== now.doors[b]) return false;
  }
  return now.pockets <= base.pockets && now.reach >= base.reach * open;
}

// ---------------------------------------------------------------- placing

interface Placed {
  model: string;
  x: number;
  z: number;
  y: number;
  yaw: number;
  solid: boolean;
}

const round = (n: number, d = 2) => +n.toFixed(d) + 0;

function hashSeed(seed: string | number | undefined): string {
  return seed === undefined ? 'dress' : String(seed);
}

/**
 * Dress a room: the props for a room of `type` in `space`, deterministic for
 * the seed. Nothing is placed where it would block a doorway, a window or a
 * walking lane between the doorways.
 */
export function dressRoom(space: DressSpace, type: RoomType, o: DressOptions = {}): DressedProp[] {
  const recipe = DRESS_RECIPES[type];
  if (!recipe || !space.rects.length) return [];
  const density = DENSITY[o.density ?? 'normal'];
  const rand = seededRandom(`${hashSeed(o.seed)}|${type}|${o.density ?? 'normal'}`);
  const max = o.max ?? 48;
  const y = space.y;

  // The grid over the floor.
  const bx0 = Math.min(...space.rects.map((r) => r.x0));
  const bz0 = Math.min(...space.rects.map((r) => r.z0));
  const bx1 = Math.max(...space.rects.map((r) => r.x1));
  const bz1 = Math.max(...space.rects.map((r) => r.z1));
  const grid = new Grid(bx0, bz0, bx1, bz1);
  for (const r of space.rects) for (const c of grid.cells(r.x0, r.z0, r.x1, r.z1)) grid.floor[c] = 1;
  for (const b of space.blocked ?? []) {
    for (const c of grid.cells(b.x0, b.z0, b.x1, b.z1)) {
      grid.use[c] = USED;
      grid.block[c] = 1;
      grid.top[c] = 9;
    }
  }
  // Doorways and windows: kept clear in front; doorways are where lanes start.
  const entries: number[][] = [];
  const doors = space.openings.filter((p) => p.kind === 'door');
  for (const p of space.openings) {
    const depth = p.kind === 'door' ? 1.5 : 0.9;
    const half = p.width / 2 + (p.kind === 'door' ? 0.3 : 0.15);
    for (const c of grid.cells(...zone(p, half, 0, depth))) if (grid.use[c] === FREE) grid.use[c] = RESERVED;
  }
  for (const p of doors) entries.push(grid.cells(...zone(p, Math.max(0.2, p.width / 2 - 0.3), 0.3, 1.2)));
  const disc = (x: number, z: number, r: number) => grid.cells(x - r, z - r, x + r, z + r).filter((c) => Math.hypot(grid.centre(c)[0] - x, grid.centre(c)[1] - z) <= r);
  for (const k of [...(space.keepClear ?? []), ...(space.entries ?? [])]) for (const c of disc(k.x, k.z, k.r)) if (grid.use[c] === FREE) grid.use[c] = RESERVED;
  for (const k of space.entries ?? []) entries.push(disc(k.x, k.z, k.r + 1));
  const base = laneState(grid, entries);
  let floorCells = 0;
  for (let i = 0; i < grid.floor.length; i++) floorCells += grid.floor[i]!;
  const area = floorCells * RES * RES;

  // Room geometry the slots use.
  const front = frontWall(space);
  const longX = bx1 - bx0 >= bz1 - bz0;
  const centroid = rectCentroid(space.rects);
  const corners = concaveCorners(space.walls);

  const used = new Set(o.models?.used ?? []);
  const limit = o.models?.limit ?? Infinity;
  const out: Placed[] = [];
  /** Centre items: their turn and the lattice their first piece set. */
  const rows = new Map<DressItem, { yaw: number; at: [number, number] | null }>();

  /** Try to put a piece with its centre at (cx, cz) turned by `yaw`; commits and returns true if it fits. */
  const tryPlace = (pc: DressPiece, cx: number, cz: number, yaw: number, gap: number, decorAt?: number): boolean => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const parts = pc.parts.map((p) => {
      const x = cx + p.x * c + p.z * s;
      const z = cz - p.x * s + p.z * c;
      const [w, h, d] = size(p.model);
      const [hx, hz] = turnedHalf(w, d, yaw + p.yaw);
      return { p, x, z, hx, hz, h, yaw: yaw + p.yaw };
    });
    if (out.length + parts.length > max) return false;
    if (decorAt !== undefined) {
      // On the wall: nothing tall in front of it, no other decor beside it.
      for (const q of parts) {
        if (!grid.inside(q.x - q.hx, q.z - q.hz, q.x + q.hx, q.z + q.hz)) return false;
        const cells = grid.cells(q.x - q.hx - 0.3, q.z - q.hz - 0.3, q.x + q.hx + 0.3, q.z + q.hz + 0.3);
        if (!cells.length || cells.some((k) => grid.decor[k] || grid.top[k]! > decorAt - 0.05)) return false;
      }
      for (const q of parts) for (const k of grid.cells(q.x - q.hx, q.z - q.hz, q.x + q.hx, q.z + q.hz)) grid.decor[k] = 1;
      commit(parts.map((q) => ({ model: q.p.model, x: q.x, z: q.z, y: y + decorAt + q.p.y, yaw: q.yaw, solid: false })));
      return true;
    }
    const floorParts = parts.filter((q) => q.p.y <= 0.3);
    for (const q of floorParts) {
      const inner = grid.cells(q.x - q.hx + 0.02, q.z - q.hz + 0.02, q.x + q.hx - 0.02, q.z + q.hz - 0.02);
      if (!inner.length || !grid.inside(q.x - q.hx, q.z - q.hz, q.x + q.hx, q.z + q.hz)) return false;
      if (inner.some((k) => !grid.floor[k] || grid.use[k] === RESERVED)) return false;
      if (q.p.flat) continue;
      if (inner.some((k) => grid.use[k] !== FREE)) return false;
      if (gap > 0 && grid.cells(q.x - q.hx - gap, q.z - q.hz - gap, q.x + q.hx + gap, q.z + q.hz + gap).some((k) => grid.use[k] === USED)) return false;
    }
    // Parts standing on others may not overlap each other's footprint checks; mark what is solid and check the lanes.
    const blocks = floorParts.filter((q) => q.p.solid && q.h > 0.3).flatMap((q) => grid.cells(q.x - q.hx, q.z - q.hz, q.x + q.hx, q.z + q.hz));
    const was = blocks.map((k) => grid.block[k]!);
    for (const k of blocks) grid.block[k] = 1;
    if (blocks.length && !lanesHold(base, laneState(grid, entries), density.open)) {
      blocks.forEach((k, i) => (grid.block[k] = was[i]!));
      return false;
    }
    for (const q of floorParts) {
      for (const k of grid.cells(q.x - q.hx, q.z - q.hz, q.x + q.hx, q.z + q.hz)) {
        if (!q.p.flat) grid.use[k] = USED;
        grid.top[k] = Math.max(grid.top[k]!, q.h);
      }
    }
    commit(parts.map((q) => ({ model: q.p.model, x: q.x, z: q.z, y: y + q.p.y, yaw: q.yaw, solid: q.p.solid })));
    return true;
  };
  const commit = (ps: Placed[]) => {
    for (const p of ps) {
      out.push(p);
      used.add(`prop.${p.model}`);
    }
  };
  /** Whether a piece may go in without breaking the model budget. */
  const affordable = (pc: DressPiece) => {
    const fresh = new Set(pc.parts.map((p) => `prop.${p.model}`).filter((m) => !used.has(m)));
    return used.size + fresh.size <= limit;
  };

  for (const item of recipe) {
    const want = Math.min(Math.ceil(item.max * Math.max(1, density.count)), Math.max(item.min ?? 0, Math.floor(item.per * (area / 49) * density.count + rand())));
    if (!want) continue;
    const pieces = item.pieces.filter(affordable);
    if (!pieces.length) continue;
    const own = pieces[Math.floor(rand() * pieces.length)]!;
    const pick = () => (pieces.length > 1 && rand() < 0.25 ? pieces[Math.floor(rand() * pieces.length)]! : own);
    let placed = 0;
    let misses = 0;
    while (placed < want && misses < 3) {
      const pc = pick();
      if (!affordable(pc)) break;
      if (placeOne(item, pc)) placed++;
      else misses++;
    }
  }

  function placeOne(item: DressItem, pc: DressPiece): boolean {
    const gap = item.gap ?? (item.slot === 'centre' ? 0.6 : 0.05);
    if (item.slot === 'wall' || item.slot === 'decor') {
      for (const [w, t] of wallSpots(item, pc.w)) {
        const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
        const ux = (w.x1 - w.x0) / len;
        const uz = (w.z1 - w.z0) / len;
        const off = item.slot === 'decor' ? pc.d / 2 + 0.03 : pc.d / 2 + 0.04;
        const cx = w.x0 + ux * t + w.nx * off;
        const cz = w.z0 + uz * t + w.nz * off;
        if (tryPlace(pc, cx, cz, Math.atan2(w.nx, w.nz), item.slot === 'decor' ? 0 : gap, item.slot === 'decor' ? (item.height ?? 1.5) : undefined)) return true;
      }
      return false;
    }
    if (item.slot === 'corner') {
      for (const k of shuffle(corners.map((_, i) => i))) {
        const cn = corners[k]!;
        const yaw = Math.atan2(cn.nx, cn.nz) + (rand() - 0.5) * 0.4;
        const [hx, hz] = turnedHalf(pc.w, pc.d, yaw);
        if (tryPlace(pc, cn.x + Math.sign(cn.nx) * (hx + 0.05), cn.z + Math.sign(cn.nz) * (hz + 0.05), yaw, gap)) return true;
      }
      return false;
    }
    // Centre: the item's pieces share one turn and one lattice (tidy rows of desks), nearest the middle first,
    // or in rows from the front for pieces facing it; any free spot once the lattice is full.
    let st = rows.get(item);
    if (!st) {
      let turn: number;
      if (item.face === 'front' && front) turn = Math.atan2(-front.nx, -front.nz);
      else if (item.face === 'any') turn = Math.floor(rand() * 4) * Q;
      else turn = (pc.w >= pc.d) === longX ? 0 : Q;
      if (item.face !== 'front' && rand() < 0.5) turn += Math.PI;
      st = { yaw: turn, at: null };
      rows.set(item, st);
    }
    const yaw = st.yaw;
    const [hx, hz] = turnedHalf(pc.w, pc.d, yaw);
    const px = 2 * hx + gap + 0.3;
    const pz = 2 * hz + gap + 0.3;
    const score = (x: number, z: number) => {
      if (item.face === 'front' && front) {
        // Rows: from the front (leaving room to stand there) back, the middle of each row first.
        const along = Math.abs((x - front.mx) * front.nz - (z - front.mz) * front.nx);
        const back = (x - front.mx) * front.nx + (z - front.mz) * front.nz;
        return (back < 2 ? 1e3 : 0) + back * 2 + along * 0.5 + rand() * 0.2;
      }
      return Math.hypot(x - centroid[0], z - centroid[1]) + rand() * 0.8;
    };
    const lattice: [number, number, number][] = [];
    const origins: [number, number][] = st.at ? [st.at] : [centroid, [centroid[0] + px / 2, centroid[1]], [centroid[0], centroid[1] + pz / 2], [centroid[0] + px / 2, centroid[1] + pz / 2]];
    for (const [ox, oz] of origins) {
      for (let i = Math.floor((bx0 - ox) / px); ox + i * px <= bx1; i++) {
        for (let j = Math.floor((bz0 - oz) / pz); oz + j * pz <= bz1; j++) {
          const x = ox + i * px;
          const z = oz + j * pz;
          if (x - hx >= bx0 && x + hx <= bx1 && z - hz >= bz0 && z + hz <= bz1) lattice.push([x, z, score(x, z)]);
        }
      }
    }
    const loose: [number, number, number][] = [];
    for (let x = bx0 + hx; x <= bx1 - hx + 1e-6; x += 0.4) for (let z = bz0 + hz; z <= bz1 - hz + 1e-6; z += 0.4) loose.push([x, z, score(x, z)]);
    lattice.sort((a, b) => a[2] - b[2]);
    loose.sort((a, b) => a[2] - b[2]);
    for (const [x, z] of [...lattice.slice(0, 200), ...loose.slice(0, 300)]) {
      if (tryPlace(pc, x, z, yaw, gap)) {
        st.at ??= [x, z];
        return true;
      }
    }
    return false;
  }

  /** Where along which wall a piece `w` wide may go, best first. */
  function wallSpots(item: DressItem, w: number): [DressWall, number][] {
    const spots: [DressWall, number, number][] = [];
    for (const wl of space.walls) {
      const len = Math.hypot(wl.x1 - wl.x0, wl.z1 - wl.z0);
      if (len < w + 0.1) continue;
      const onFront = !!front && Math.abs(wl.nx - front.nx) < 0.01 && Math.abs(wl.nz - front.nz) < 0.01;
      for (let t = w / 2 + 0.05; t <= len - w / 2 - 0.05 + 1e-6; t += 0.2) {
        const px = wl.x0 + ((wl.x1 - wl.x0) * t) / len;
        const pz = wl.z0 + ((wl.z1 - wl.z0) * t) / len;
        const near = doors.length ? Math.min(...doors.map((d) => Math.hypot(d.x - px, d.z - pz))) : 10;
        let score = rand();
        if (item.place === 'far') score = -near + rand() * 1.5;
        else if (item.place === 'near') score = near + rand() * 1.5;
        else if (item.place === 'front') score = (onFront ? 0 : 100) + Math.abs(t - len / 2) + rand() * 0.3;
        else if (item.place === 'mid') score = Math.abs(t - len / 2) * 0.5 + rand() * 2;
        spots.push([wl, t, score]);
      }
    }
    spots.sort((a, b) => a[2] - b[2]);
    return spots.slice(0, 300).map(([wl, t]) => [wl, t]);
  }

  function shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [xs[i], xs[j]] = [xs[j]!, xs[i]!];
    }
    return xs;
  }

  return out.map((p) => ({ kind: 'prop', model: `prop.${p.model}`, position: [round(p.x), round(p.y), round(p.z)], yaw: round(normalise(p.yaw), 4), scale: 1, solid: p.solid, tint: null }));
}

const normalise = (a: number) => {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
};

/** The floor in front of an opening: `half` either side of its centre, from `d0` to `d1` m in. */
function zone(p: DressOpening, half: number, d0: number, d1: number): [number, number, number, number] {
  // Along the wall is perpendicular to the normal.
  const ax = Math.abs(p.nz) > 0.5 ? half : 0;
  const az = Math.abs(p.nx) > 0.5 ? half : 0;
  const xa = p.x + p.nx * d0;
  const za = p.z + p.nz * d0;
  const xb = p.x + p.nx * d1;
  const zb = p.z + p.nz * d1;
  return [Math.min(xa, xb) - ax, Math.min(za, zb) - az, Math.max(xa, xb) + ax, Math.max(za, zb) + az];
}

function rectCentroid(rects: DressRect[]): [number, number] {
  let a = 0;
  let x = 0;
  let z = 0;
  for (const r of rects) {
    const s = (r.x1 - r.x0) * (r.z1 - r.z0);
    a += s;
    x += ((r.x0 + r.x1) / 2) * s;
    z += ((r.z0 + r.z1) / 2) * s;
  }
  return a ? [x / a, z / a] : [0, 0];
}

/** The wall opposite the main (widest) doorway, or the longest wall: where an altar, a teacher's desk or a screen goes. */
function frontWall(space: DressSpace): { nx: number; nz: number; mx: number; mz: number } | null {
  const doors = space.openings.filter((p) => p.kind === 'door').sort((a, b) => b.width - a.width);
  const len = (w: DressWall) => Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  let pick: DressWall | undefined;
  const main = doors[0];
  if (main) {
    const facing = space.walls.filter((w) => Math.abs(w.nx + main.nx) < 0.01 && Math.abs(w.nz + main.nz) < 0.01);
    pick = facing.sort((a, b) => len(b) - len(a))[0];
    if (!pick) return { nx: -main.nx, nz: -main.nz, mx: main.x - main.nx * 1e3, mz: main.z - main.nz * 1e3 };
  }
  pick ??= [...space.walls].sort((a, b) => len(b) - len(a))[0];
  if (!pick) return null;
  // The front line: the wall's own line, centred on the room across it.
  const [cx, cz] = rectCentroid(space.rects);
  return Math.abs(pick.nx) > 0.5 ? { nx: pick.nx, nz: pick.nz, mx: pick.x0, mz: cz } : { nx: pick.nx, nz: pick.nz, mx: cx, mz: pick.z0 };
}

/** Inside corners where two walls meet: the point and the diagonal into the room. */
function concaveCorners(walls: DressWall[]): { x: number; z: number; nx: number; nz: number }[] {
  const out: { x: number; z: number; nx: number; nz: number }[] = [];
  const ends = (w: DressWall): [number, number, number, number][] => {
    // Each end, and the direction the wall runs away from it.
    const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0) || 1;
    const ux = (w.x1 - w.x0) / len;
    const uz = (w.z1 - w.z0) / len;
    return [
      [w.x0, w.z0, ux, uz],
      [w.x1, w.z1, -ux, -uz],
    ];
  };
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i]!;
      const b = walls[j]!;
      if (Math.abs(a.nx * b.nx + a.nz * b.nz) > 0.01) continue;
      for (const [ax, az, aux, auz] of ends(a)) {
        for (const [bx, bz, bux, buz] of ends(b)) {
          if (Math.hypot(ax - bx, az - bz) > 0.15) continue;
          // Inside corner: each wall's normal runs along the other wall.
          if (a.nx * bux + a.nz * buz < 0.9 || b.nx * aux + b.nz * auz < 0.9) continue;
          out.push({ x: (ax + bx) / 2, z: (az + bz) / 2, nx: a.nx + b.nx, nz: a.nz + b.nz });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- reading a room from a map

/** How each edge style is read: a way in, a gap to keep clear, or wall to stand things against. */
const OPENING_SPAN: Partial<Record<string, { kind: 'door' | 'window'; span: number }>> = {
  door: { kind: 'door', span: 3 },
  wide: { kind: 'door', span: 5 },
  arch: { kind: 'door', span: 6.5 },
  broken: { kind: 'door', span: 4.4 },
  shutter: { kind: 'door', span: 5 },
  window: { kind: 'window', span: 2.6 },
  windows: { kind: 'window', span: 5.4 },
  slit: { kind: 'window', span: 3 },
};
const SEE_THROUGH = new Set(['half', 'railing', 'fence', 'bars']);
const SOLID = new Set(['wall', 'high', 'tower']);
/** Entities with an area of their own (kept clear only at their centre). */
const KEEP_CLEAR_RADIUS = 1.2;

/** The cells (on level z) of the placement covering cell (x, y, z): one room, however many cells it spans. */
export function roomCells(map: MapDocument, x: number, y: number, z: number): [number, number, number][] {
  const { cells } = buildOccupancy(map);
  const here = cells.get(cellKey(x, y, z));
  if (!here) return [];
  const out: [number, number, number][] = [];
  for (const [key, occ] of cells) {
    if (occ.placement !== here.placement) continue;
    const [cx, cy, cz] = key.split(',').map(Number) as [number, number, number];
    if (cz === z) out.push([cx, cy, cz]);
  }
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/**
 * The space a room offers for dressing: the floor of `cells` (all on one
 * level) inside their walls, the walls to stand against, the doorways and
 * windows from the resolved edges, and what already stands there (pillars,
 * cover, props, spawns, pickups). Sides between two of the cells are open
 * floor; walls built between them count as obstacles.
 */
export function dressSpace(map: MapDocument, cellList: readonly (readonly [number, number, number])[], geometry?: readonly WorldBox[]): DressSpace {
  const { cellSize, levelHeight } = map.classicStructure;
  const half = cellSize / 2;
  const { cells } = buildOccupancy(map);
  const inSet = new Set(cellList.map(([x, y, z]) => cellKey(x, y, z)));
  const z = cellList[0]?.[2] ?? 0;
  const y = z * levelHeight;
  const rects: DressRect[] = [];
  const walls: DressWall[] = [];
  const openings: DressOpening[] = [];
  for (const [gx, gy, gz] of cellList) {
    if (!cells.has(cellKey(gx, gy, gz))) continue;
    const cx = gx * cellSize;
    const cz = gy * cellSize;
    const styles = {} as Record<Side, string>;
    const inset = {} as Record<Side, number>;
    for (const side of SIDES) {
      const [dx, dy] = SIDE_DIRS[side];
      if (inSet.has(cellKey(gx + dx, gy + dy, gz))) {
        styles[side] = 'inside';
        inset[side] = 0;
        continue;
      }
      const style = resolveEdge(cells, gx, gy, gz, side);
      styles[side] = style === 'none' && !cells.has(cellKey(gx + dx, gy + dy, gz)) ? 'drop' : style;
      inset[side] = Math.max(0, ...edgeSegments(style, half, levelHeight).map((s) => s[4]));
    }
    const r: DressRect = { x0: cx - half + inset.W, x1: cx + half - inset.E, z0: cz - half + inset.S, z1: cz + half - inset.N };
    const occ = cells.get(cellKey(gx, gy, gz))!;
    if (occ.def.floors.includes(occ.level)) rects.push(r);
    else {
      // Upper storeys of buildings stand on partial floors (round a stair hole, a mezzanine): only those count.
      const p = occ.placement;
      for (const f of occ.def.extraFloors ?? []) {
        if (Math.abs(p.z * levelHeight + f.max[1] - y) > 0.3) continue;
        const [ax, az] = rotateXZ(f.min[0], f.min[2], p.rotation);
        const [bx, bz] = rotateXZ(f.max[0], f.max[2], p.rotation);
        const q = { x0: Math.max(r.x0, p.x * cellSize + Math.min(ax, bx)), x1: Math.min(r.x1, p.x * cellSize + Math.max(ax, bx)), z0: Math.max(r.z0, p.y * cellSize + Math.min(az, bz)), z1: Math.min(r.z1, p.y * cellSize + Math.max(az, bz)) };
        if (q.x1 - q.x0 <= 0.5 || q.z1 - q.z0 <= 0.5) continue;
        rects.push(q);
        // Its edges over the hole are ways in (the stairs come up there): kept clear like doorways.
        const zm = (q.z0 + q.z1) / 2;
        const xm = (q.x0 + q.x1) / 2;
        if (q.x0 > r.x0 + 0.01) openings.push({ x: q.x0, z: zm, nx: 1, nz: 0, width: q.z1 - q.z0, kind: 'door' });
        if (q.x1 < r.x1 - 0.01) openings.push({ x: q.x1, z: zm, nx: -1, nz: 0, width: q.z1 - q.z0, kind: 'door' });
        if (q.z0 > r.z0 + 0.01) openings.push({ x: xm, z: q.z0, nx: 0, nz: 1, width: q.x1 - q.x0, kind: 'door' });
        if (q.z1 < r.z1 - 0.01) openings.push({ x: xm, z: q.z1, nx: 0, nz: -1, width: q.x1 - q.x0, kind: 'door' });
      }
    }
    for (const side of SIDES) {
      const style = styles[side];
      if (style === 'inside') continue;
      const [dx, dy] = SIDE_DIRS[side];
      const nx = -dx;
      const nz = -dy;
      // The inside face, and the run along it (west to east, south to north).
      const line = side === 'N' ? r.z1 : side === 'S' ? r.z0 : side === 'E' ? r.x1 : r.x0;
      const [a0, a1, mid] = dx === 0 ? [r.x0, r.x1, cx] : [r.z0, r.z1, cz];
      const seg = (u0: number, u1: number) => {
        if (u1 - u0 < 0.3) return;
        walls.push(dx === 0 ? { x0: u0, z0: line, x1: u1, z1: line, nx, nz } : { x0: line, z0: u0, x1: line, z1: u1, nx, nz });
      };
      const open = (kind: 'door' | 'window', width: number) => openings.push(dx === 0 ? { x: mid, z: line, nx, nz, width, kind } : { x: line, z: mid, nx, nz, width, kind });
      if (SOLID.has(style)) seg(a0, a1);
      else if (style === 'none') open('door', a1 - a0);
      else if (style === 'drop' || SEE_THROUGH.has(style)) open('window', a1 - a0);
      else {
        const o = OPENING_SPAN[style];
        if (!o) {
          seg(a0, a1);
          continue;
        }
        open(o.kind, o.span);
        seg(a0, mid - o.span / 2 - 0.15);
        seg(mid + o.span / 2 + 0.15, a1);
      }
    }
  }
  // What already stands on this floor.
  const blocked: DressRect[] = [];
  const keepClear: { x: number; z: number; r: number }[] = [];
  const within = (x: number, zz: number, pad = 0) => rects.some((r) => x >= r.x0 - pad && x <= r.x1 + pad && zz >= r.z0 - pad && zz <= r.z1 + pad);
  const overlaps = (b: { min: number[]; max: number[] }) => rects.some((r) => b.max[0]! > r.x0 + 0.02 && b.min[0]! < r.x1 - 0.02 && b.max[2]! > r.z0 + 0.02 && b.min[2]! < r.z1 - 0.02);
  const entries: { x: number; z: number; r: number }[] = [];
  for (const box of geometry ?? buildMapGeometry(map)) {
    if (box.kind === 'trim') continue;
    const b = boxBounds(box);
    if (b.min[1] >= y + 2 || !overlaps(b)) continue;
    // The first step of a flight (or of a dais): the foot of the stairs stays clear and on the lanes.
    if (b.max[1] > y + 0.1 && b.max[1] <= y + 0.3 && box.kind !== 'floor') entries.push({ x: (b.min[0] + b.max[0]) / 2, z: (b.min[2] + b.max[2]) / 2, r: 1.2 });
    if (b.max[1] <= y + 0.3) continue;
    blocked.push({ x0: b.min[0], z0: b.min[2], x1: b.max[0], z1: b.max[2] });
  }
  for (const e of map.entities) {
    if (Math.abs(e.position[1] - y) > 2) continue;
    if (e.kind === 'prop') {
      const def = getProp(e.model);
      if (!def || !within(e.position[0], e.position[2], 2)) continue;
      const [hx, hz] = turnedHalf(def.size[0] * e.scale, def.size[2] * e.scale, e.yaw);
      if (def.size[1] < 0.05) continue; // rugs and decals
      blocked.push({ x0: e.position[0] - hx, z0: e.position[2] - hz, x1: e.position[0] + hx, z1: e.position[2] + hz });
    } else if (e.kind === 'block') {
      const [hx, hz] = turnedHalf(e.size[0], e.size[2], e.yaw ?? 0);
      if (e.position[1] + e.size[1] <= y + 0.3) continue;
      blocked.push({ x0: e.position[0] - hx, z0: e.position[2] - hz, x1: e.position[0] + hx, z1: e.position[2] + hz });
    } else if (e.kind !== 'light' && e.kind !== 'water') {
      // Objectives with an area (hills, bomb sites, rescue points, zones): the middle of it stays open floor, and on the lanes.
      const area = e.kind === 'zone' || e.kind === 'hill' || e.kind === 'rescue' || e.kind === 'bombsite';
      const r = area ? 2.5 : KEEP_CLEAR_RADIUS;
      if (!within(e.position[0], e.position[2], r)) continue;
      keepClear.push({ x: e.position[0], z: e.position[2], r });
      if (area) entries.push({ x: e.position[0], z: e.position[2], r });
    }
  }
  return { y, rects, walls: mergeWalls(walls), openings, blocked, keepClear, entries };
}

/** Join wall segments that run on along the same line (a wall across several cells). */
function mergeWalls(walls: DressWall[]): DressWall[] {
  const key = (w: DressWall) => `${w.nx},${w.nz},${(Math.abs(w.nx) > 0.5 ? w.x0 : w.z0).toFixed(3)}`;
  const groups = new Map<string, DressWall[]>();
  for (const w of walls) groups.set(key(w), [...(groups.get(key(w)) ?? []), w]);
  const out: DressWall[] = [];
  for (const g of groups.values()) {
    const alongX = Math.abs(g[0]!.nz) > 0.5;
    const span = (w: DressWall): [number, number] => (alongX ? [w.x0, w.x1] : [w.z0, w.z1]);
    g.sort((a, b) => span(a)[0] - span(b)[0]);
    let cur = { ...g[0]! };
    for (const w of g.slice(1)) {
      if (span(w)[0] <= span(cur)[1] + 0.01) {
        if (alongX) cur.x1 = Math.max(cur.x1, w.x1);
        else cur.z1 = Math.max(cur.z1, w.z1);
      } else {
        out.push(cur);
        cur = { ...w };
      }
    }
    out.push(cur);
  }
  return out;
}

/** Dress the room covering cell (x, y, z) of a map (every cell of its placement on that level). */
export function dressMapRoom(map: MapDocument, cell: readonly [number, number, number], type: RoomType, o: DressOptions = {}, geometry?: readonly WorldBox[]): DressedProp[] {
  const cellsHere = roomCells(map, cell[0], cell[1], cell[2]);
  if (!cellsHere.length) return [];
  return dressRoom(dressSpace(map, cellsHere, geometry), type, o);
}

/** The map's prop models so far and the budget of different models (MAP_BUDGETS.md), for `DressOptions.models`. */
export function modelBudget(map: MapDocument, limit = 80): { used: Set<string>; limit: number } {
  return { used: new Set(map.entities.flatMap((e) => (e.kind === 'prop' ? [e.model] : []))), limit };
}

// ---------------------------------------------------------------- guessing a room's type

/** Room types that suit a theme family, by room size (small, medium, large, huge). */
const GUESS: Record<'home' | 'office' | 'military' | 'tavern' | 'industry', [RoomType[], RoomType[], RoomType[], RoomType[]]> = {
  home: [['bathroom', 'bedroom', 'kitchen'], ['bedroom', 'kitchen', 'living', 'dining', 'office'], ['living', 'dining', 'library'], ['lobby', 'dining', 'chapel']],
  office: [['bathroom', 'storage', 'server'], ['office', 'lab', 'server', 'kitchen'], ['conference', 'office', 'lab', 'classroom'], ['lobby', 'warehouse', 'classroom']],
  military: [['cell', 'storage', 'bathroom'], ['barracks', 'armoury', 'storage', 'kitchen'], ['barracks', 'armoury', 'dining'], ['warehouse', 'barracks']],
  tavern: [['cell', 'storage', 'bedroom'], ['bar', 'bedroom', 'storage', 'kitchen'], ['bar', 'dining', 'library', 'chapel'], ['chapel', 'dining', 'warehouse']],
  industry: [['storage', 'bathroom', 'office'], ['workshop', 'storage', 'office', 'kitchen'], ['workshop', 'warehouse', 'storage'], ['warehouse', 'workshop']],
};
const THEME_FAMILY: Record<string, keyof typeof GUESS> = {
  city: 'home', manor: 'home', saloon: 'home', garden: 'home', harbour: 'home',
  lab: 'office', station: 'office', neon: 'office',
  bunker: 'military', arctic: 'military', canyon: 'military', forest: 'military',
  castle: 'tavern', desert: 'tavern', tomb: 'tavern', ruins: 'tavern', temple: 'tavern',
  factory: 'industry', prototype: 'industry', volcano: 'industry',
  gothic_estate: 'home', suburban: 'home', jungle_temple: 'tavern',
};

/** A plausible room type for a room of this size in this theme (`pick` 0..1 chooses among the candidates). */
export function guessRoomType(space: DressSpace, theme: string, pick = 0): RoomType {
  const area = space.rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  const family = GUESS[THEME_FAMILY[theme.replace(/^core\./, '')] ?? 'industry'];
  const band = area < 36 ? 0 : area < 80 ? 1 : area < 260 ? 2 : 3;
  const list = family[band];
  return list[Math.min(list.length - 1, Math.floor(pick * list.length))]!;
}
