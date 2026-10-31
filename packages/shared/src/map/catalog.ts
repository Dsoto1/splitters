/**
 * Classic Grid tile catalog (graybox "core" pack).
 *
 * Tiles are data: occupied cells, connection ports, and extra solids, all in
 * the tile's local frame before rotation. Walls and floors are derived by the
 * geometry builder, which keeps tile definitions small and lets unconnected
 * ports auto-cap into solid walls.
 */

import { boxPackTiles } from './packTiles.ts';
import { boxPackTiles2 } from './packTiles2.ts';
import { ancientPackTiles } from './packTilesAncient.ts';
import { medievalPackTiles } from './packTilesMedieval.ts';

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
 * oak quoins and shutters (10 Medieval Village).
 */
export const FACADES = ['none', 'brick', 'storefront', 'plaster', 'hull', 'glass', 'neon', 'concrete', 'corrugated', 'false_front', 'adobe', 'gothic_stone', 'manor_brick', 'temple', 'overgrown', 'clapboard', 'suburban_brick', 'roman', 'egyptian', 'timber_frame', 'village_plaster'] as const;
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

/** Axis-aligned box in tile-local metres: X/Z relative to the cell centre, Y relative to the tile's base floor. */
export interface LocalBox {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  /** Turn about the box's vertical centre line (radians, like `WorldBox.yaw`). */
  yaw?: number;
  /** Tilt (like a pitched free block): pitch lifts the box's +Z end, roll its +X side, before the yaw. Pitched roofs, ramps. */
  pitch?: number;
  roll?: number;
  /** What the box is built as (default `solid`; curved walls use `wall` so they take the walls' paint, `trim` is visual only). */
  kind?: 'solid' | 'wall' | 'floor' | 'trim' | 'prop';
  /**
   * A library material (and tint) on every face instead of the theme's paint:
   * Style Pack pieces whose sandbags, corrugated roofs or rails should look
   * the part in any theme.
   */
  surface?: { material: string; tint?: string | null };
}

export interface TileDefinition {
  id: string;
  displayName: string;
  /** Occupied cells relative to the placement, local frame: [dx, dy, dz]. */
  cells: readonly (readonly [number, number, number])[];
  /** Local dz levels that get a floor slab. */
  floors: readonly number[];
  ports: readonly TilePort[];
  solids?: readonly LocalBox[];
  /**
   * Open ground: where two open tiles meet there is no wall at all, so a group
   * of them makes one big courtyard or street (other edges still get doorways
   * or walls as usual).
   */
  open?: boolean;
  category: TileCategory;
  /**
   * What an `auto` side without a connection becomes (default: a solid wall).
   * Platforms and bridges use `open` (you can fall off), balconies `railing`.
   * Tiles with an open or railing default never build a doorway frame of
   * their own: the neighbour's doorway is the opening.
   */
  edgeDefault?: EdgeStyle;
  /** Per-side defaults that override `edgeDefault`, keyed like placement edges ("dx,dy,dz:S", local frame). */
  edgeDefaults?: Readonly<Record<string, EdgeStyle>>;
  /** Partial floors (balconies, ledges, bridge decks), painted like floors. Local frame, like solids. */
  extraFloors?: readonly LocalBox[];
  /** One line for the MapMaker tooltip. */
  blurb?: string;
  /** Takes room options (layout, floor, ceiling, corners) in MapMaker. */
  configurable?: boolean;
  /**
   * Drawn with a model (city buildings and streets) centred on the tile's
   * footprint and turned with it; collision comes from `solids` (`prop` boxes
   * are invisible) and the floor slabs as usual.
   */
  model?: { file: string; lift?: number };
}

/** Shared tile dimensions (metres). Tiles assume the default 8 m cell / 4 m level. */
export const TILE_DIMENSIONS = {
  wallThickness: 0.5,
  floorThickness: 0.5,
  doorWidth: 3,
  doorHeight: 3,
} as const;

function stairSteps(): LocalBox[] {
  // 16 steps of 0.25 m rise and 0.5 m run climb one 4 m level across one 8 m cell,
  // rising from the local west (low) side to the local east (high) side.
  const steps: LocalBox[] = [];
  const inner = 4 - TILE_DIMENSIONS.wallThickness;
  for (let i = 0; i < 16; i++) {
    steps.push({ min: [-4 + i * 0.5, 0, -inner], max: [-4 + (i + 1) * 0.5, (i + 1) * 0.25, inner] });
  }
  return steps;
}

const ALL_SIDES: TilePort[] = SIDES.map((side) => ({ side, level: 0 }));

/** Every outward side of a w × d footprint (cells [0..w-1] × [0..d-1]) on the given levels. */
function perimeterPorts(w: number, d: number, levels: readonly number[] = [0]): TilePort[] {
  const ports: TilePort[] = [];
  for (const level of levels) {
    for (let x = 0; x < w; x++) {
      ports.push({ side: 'S', level, cell: [x, 0] }, { side: 'N', level, cell: [x, d - 1] });
    }
    for (let y = 0; y < d; y++) {
      ports.push({ side: 'W', level, cell: [0, y] }, { side: 'E', level, cell: [w - 1, y] });
    }
  }
  return ports;
}

function footprint(w: number, d: number, h = 1, z0 = 0): [number, number, number][] {
  const cells: [number, number, number][] = [];
  for (let z = z0; z < z0 + h; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) cells.push([x, y, z]);
  return cells;
}

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): LocalBox => ({ min: [x0, y0, z0], max: [x1, y1, z1] });

/**
 * A straight flight of solid steps (0.25 m rise each) from `base` up to
 * `base + n * 0.25`, climbing along +x or +z (or back along -x / -z) from
 * `from`, between `a0` and `a1` across. Each step is a block down to `floor`.
 */
function flight(axis: 'x' | 'z', dir: 1 | -1, from: number, a0: number, a1: number, n: number, base = 0, run = 0.5, floor = 0): LocalBox[] {
  const out: LocalBox[] = [];
  for (let i = 0; i < n; i++) {
    const u0 = from + dir * i * run;
    const u1 = from + dir * (i + 1) * run;
    const top = base + (i + 1) * 0.25;
    out.push(axis === 'x' ? box(Math.min(u0, u1), floor, a0, Math.max(u0, u1), top, a1) : box(a0, floor, Math.min(u0, u1), a1, top, Math.max(u0, u1)));
  }
  return out;
}

/**
 * Steps down from the edge of a raised block at local z = `edge` (heading -z),
 * between x0 and x1: the first step `top` high, each next one 0.25 m lower,
 * standing on `floor`.
 */
function descending(edge: number, x0: number, x1: number, n: number, top: number, floor = 0): LocalBox[] {
  return Array.from({ length: n }, (_, i) => box(x0, floor, edge - (i + 1) * 0.5, x1, top - i * 0.25, edge - i * 0.5));
}

/** A thin rail (1 m high) along a line at height `y`. */
function rail(x0: number, z0: number, x1: number, z1: number, y = 0): LocalBox {
  const t = 0.06;
  return x0 === x1 ? box(x0 - t, y, Math.min(z0, z1), x0 + t, y + 1, Math.max(z0, z1)) : box(Math.min(x0, x1), y, z0 - t, Math.max(x0, x1), y + 1, z0 + t);
}

// ---------------------------------------------------------------- room options

/** Room options stored on a placement (all optional: absent = the tile as designed). */
export interface RoomOptions {
  layout?: RoomLayout;
  floor?: FloorInsert;
  ceiling?: Ceiling;
  corners?: Corner;
  facade?: Facade;
}

/** Width and depth in cells of a tile's ground floor. */
export function footprintSize(def: TileDefinition): [number, number] {
  let w = 1;
  let d = 1;
  for (const [dx, dy, dz] of def.cells) {
    if (dz !== 0) continue;
    w = Math.max(w, dx + 1);
    d = Math.max(d, dy + 1);
  }
  return [w, d];
}

/** A small deterministic random sequence from a string (a tile's ID), so seeded layouts look the same everywhere. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Steps round all four sides of a raised block: `n` rings, each 0.25 m lower and `run` wider, standing on y0. */
function stepRings(x0: number, z0: number, x1: number, z1: number, top: number, n: number, run = 0.5, y0 = 0): LocalBox[] {
  const out: LocalBox[] = [];
  for (let i = 0; i <= n; i++) out.push(box(x0 - i * run, y0, z0 - i * run, x1 + i * run, top - i * 0.25, z1 + i * run));
  return out;
}

/**
 * Interior layout for a w × d room, in the tile's local frame (cells centred
 * on multiples of 8 m, the first at the origin). Sized to the whole room.
 */
export function roomLayoutBoxes(layout: RoomLayout, w: number, d: number, seed: string, height = 4): LocalBox[] {
  const x0 = -4;
  const z0 = -4;
  const X = w * 8;
  const Z = d * 8;
  const at = (fx: number, fz: number): [number, number] => [x0 + X * fx, z0 + Z * fz];
  const square = (cx: number, cz: number, half: number, top: number) => box(cx - half, 0, cz - half, cx + half, top, cz + half);
  const m = Math.min(w, d);
  switch (layout) {
    case 'empty':
      return [];
    case 'pillar': {
      const [cx, cz] = at(0.5, 0.5);
      return [square(cx, cz, 0.6 + 0.3 * m, height)];
    }
    case 'four_pillars':
      return [at(0.25, 0.25), at(0.75, 0.25), at(0.25, 0.75), at(0.75, 0.75)].map(([cx, cz]) => square(cx, cz, 0.35 + 0.15 * m, height));
    case 'column_rows': {
      // Two rows along the long side, a column every 4 m, 2 m clear of the ends.
      const along = X >= Z ? 'x' : 'z';
      const len = Math.max(X, Z);
      const out: LocalBox[] = [];
      const n = Math.max(2, Math.floor((len - 4) / 4) + 1);
      const step = (len - 4) / (n - 1);
      for (const f of [0.28, 0.72]) {
        for (let i = 0; i < n; i++) {
          const u = 2 + i * step;
          const [cx, cz] = along === 'x' ? [x0 + u, z0 + Z * f] : [x0 + X * f, z0 + u];
          out.push(square(cx, cz, 0.35, height));
        }
      }
      return out;
    }
    case 'low_cover':
    case 'high_cover': {
      // Per cell, a few blocks turned a different way in each cell so a big room doesn't repeat.
      const top = layout === 'low_cover' ? 1.1 : 2.1;
      const out: LocalBox[] = [];
      // Blocks keep 2 m clear of the walls: narrower gaps drop out of the bots' navmesh and seal off corners.
      const pattern: [number, number, number, number][] = [
        [-1.5, -0.4, -0.3, 0.4],
        [0.5, 0.9, 1.5, 1.5],
        [0.3, -1.5, 1.5, -0.9],
      ];
      for (let cx = 0; cx < w; cx++) {
        for (let cy = 0; cy < d; cy++) {
          const r = (cx * 3 + cy * 5) % 4;
          for (const [a0, b0, a1, b1] of pattern) {
            const [p0, q0] = rotateQuarter(a0, b0, r);
            const [p1, q1] = rotateQuarter(a1, b1, r);
            out.push(box(cx * 8 + Math.min(p0, p1), 0, cy * 8 + Math.min(q0, q1), cx * 8 + Math.max(p0, p1), top, cy * 8 + Math.max(q0, q1)));
          }
        }
      }
      return out;
    }
    case 'dais': {
      const [cx, cz] = at(0.5, 0.5);
      const hx = Math.max(1, X * 0.18);
      const hz = Math.max(1, Z * 0.18);
      return stepRings(cx - hx, cz - hz, cx + hx, cz + hz, 0.75, 2);
    }
    case 'platform': {
      // A 1.5 m platform set back from the middle, one flight up its front (local south) side.
      const [cx, mz] = at(0.5, 0.5);
      const hx = Math.max(1.2, X * 0.15);
      // Leaves 2 m behind it so bots can get round (the steps nearly reach the front wall in one room).
      const hz = Math.max(0.7, Z * 0.1);
      const cz = mz + 0.5;
      return [box(cx - hx, 0, cz - hz, cx + hx, 1.5, cz + hz), ...flight('z', 1, cz - hz - 3, cx - 1, cx + 1, 6)];
    }
    case 'rubble': {
      // Fallen masonry heaped in the corners (and round the inner cell corners of a big room),
      // never in front of a doorway or across the middle where it could cut a room in two.
      const rnd = seededRandom(seed);
      const out: LocalBox[] = [];
      const heap = (px: number, pz: number, ix: number, iz: number, n: number) => {
        for (let i = 0; i < n; i++) {
          const cx = px + ix * (0.2 + rnd() * 1.0);
          const cz = pz + iz * (0.2 + rnd() * 1.0);
          const sx = 0.4 + rnd() * 0.7;
          const sz = 0.3 + rnd() * 0.5;
          out.push({ min: [cx - sx / 2, 0, cz - sz / 2], max: [cx + sx / 2, 0.25 + rnd() * 0.6, cz + sz / 2], yaw: rnd() * Math.PI });
        }
      };
      const inner = 4 - TILE_DIMENSIONS.wallThickness;
      heap(-inner, -inner, 1, 1, 3);
      heap(-4 + X - (4 - inner), -inner, -1, 1, 2);
      heap(-inner, -4 + Z - (4 - inner), 1, -1, 2);
      heap(-4 + X - (4 - inner), -4 + Z - (4 - inner), -1, -1, 3);
      for (let gx = 1; gx < w; gx++) for (let gz = 1; gz < d; gz++) heap(-4 + gx * 8, -4 + gz * 8, rnd() < 0.5 ? 1 : -1, rnd() < 0.5 ? 1 : -1, 2);
      return out;
    }
  }
}

/** Quarter-turn a local point (x, z) by r quarter turns about the cell centre. */
function rotateQuarter(x: number, z: number, r: number): [number, number] {
  let a = x;
  let b = z;
  for (let i = 0; i < r; i++) [a, b] = [b, -a];
  return [a, b];
}

/**
 * A floor insert for a w × d room: boxes to add (raised centre), or, for a
 * sunken centre, the floor to build instead of the slabs (a walkway round a
 * pit 0.5 m deep with a step down).
 */
export function floorInsertBoxes(insert: FloorInsert, w: number, d: number): { boxes: LocalBox[]; replacesSlabs: boolean; area?: { x0: number; z0: number; x1: number; z1: number; dy: number } } {
  const X = w * 8;
  const Z = d * 8;
  const ring = Math.min(2.5, Math.min(X, Z) * 0.3);
  switch (insert) {
    case 'standard':
      return { boxes: [], replacesSlabs: false };
    case 'raised':
      return { boxes: stepRings(-4 + ring + 0.5, -4 + ring + 0.5, -4 + X - ring - 0.5, -4 + Z - ring - 0.5, 0.5, 1), replacesSlabs: false, area: { x0: -4 + ring + 0.5, z0: -4 + ring + 0.5, x1: -4 + X - ring - 0.5, z1: -4 + Z - ring - 0.5, dy: 0.5 } };
    case 'sunken': {
      const a0 = -4 + ring;
      const b0 = -4 + ring;
      const a1 = -4 + X - ring;
      const b1 = -4 + Z - ring;
      const t = TILE_DIMENSIONS.floorThickness;
      return {
        replacesSlabs: true,
        area: { x0: a0, z0: b0, x1: a1, z1: b1, dy: -0.5 },
        boxes: [
          // Walkway round the edge.
          { ...box(-4, -t, -4, -4 + X, 0, b0), kind: 'floor' },
          { ...box(-4, -t, b1, -4 + X, 0, -4 + Z), kind: 'floor' },
          { ...box(-4, -t, b0, a0, 0, b1), kind: 'floor' },
          { ...box(a1, -t, b0, -4 + X, 0, b1), kind: 'floor' },
          // Pit floor and one step down all round.
          { ...box(a0, -0.5 - t, b0, a1, -0.5, b1), kind: 'floor' },
          box(a0, -0.5, b0, a1, -0.25, b0 + 0.5),
          box(a0, -0.5, b1 - 0.5, a1, -0.25, b1),
          box(a0, -0.5, b0 + 0.5, a0 + 0.5, -0.25, b1 - 0.5),
          box(a1 - 0.5, -0.5, b0 + 0.5, a1, -0.25, b1 - 0.5),
        ],
      };
    }
  }
}

// ---------------------------------------------------------------- curves

/**
 * A curved wall as a run of short turned boxes: centre (cx, cz), radius to the
 * middle of the wall, from angle a0 to a1 (radians; 0 = +x/east, π/2 = +z/north),
 * in `n` pieces from y0 to y1. Each piece overlaps its neighbours slightly so
 * the curve has no cracks.
 */
function arc(cx: number, cz: number, r: number, a0: number, a1: number, n: number, y0: number, y1: number, t: number = TILE_DIMENSIONS.wallThickness, kind: LocalBox['kind'] = 'wall'): LocalBox[] {
  const out: LocalBox[] = [];
  const step = (a1 - a0) / n;
  const len = 2 * r * Math.sin(Math.abs(step) / 2) + Math.min(0.08, t * 0.3);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + 0.5) * step;
    const mx = cx + r * Math.cos(a);
    const mz = cz + r * Math.sin(a);
    out.push({ min: [mx - len / 2, y0, mz - t / 2], max: [mx + len / 2, y1, mz + t / 2], yaw: -(a + Math.PI / 2), kind });
  }
  return out;
}

/** Pieces per radian for curves: about one every 1.2 m along the wall. */
const pieces = (r: number, sweep: number) => Math.max(4, Math.round((r * Math.abs(sweep)) / 1.2));

/**
 * Baseboard and cornice trim along both faces of a curved wall, matching the
 * trim on straight walls so curves and straight pieces read as one building.
 */
function arcTrim(cx: number, cz: number, r: number, a0: number, a1: number, height = 4): LocalBox[] {
  const t = TILE_DIMENSIONS.wallThickness;
  const n = pieces(r, a1 - a0);
  return [-1, 1].flatMap((side) => [
    ...arc(cx, cz, r + side * (t / 2 + 0.02), a0, a1, n, 0, 0.16, 0.04, 'trim'),
    ...arc(cx, cz, r + side * (t / 2 + 0.035), a0, a1, n, height - 0.2, height, 0.07, 'trim'),
  ]);
}

/**
 * A curved arcade: pillars with arched openings between them (3.2 m high,
 * lintel above), `bays` openings along the arc.
 */
function arcade(cx: number, cz: number, r: number, a0: number, a1: number, bays: number, height = 4): LocalBox[] {
  const out: LocalBox[] = [];
  const pillar = 0.9 / r; // 0.9 m of arc per pillar
  const bay = (a1 - a0 - pillar * (bays + 1)) / bays;
  let a = a0;
  for (let i = 0; i <= bays; i++) {
    out.push(...arc(cx, cz, r, a, a + pillar, 1, 0, height, 0.6));
    a += pillar;
    if (i === bays) break;
    const n = pieces(r, bay);
    out.push(...arc(cx, cz, r, a, a + bay, n, 3.2, height));
    // A shallow curve under the lintel: two steps of trim make the opening read as an arch.
    out.push(...arc(cx, cz, r, a, a + bay * 0.18, 1, 2.85, 3.2, 0.5, 'trim'), ...arc(cx, cz, r, a + bay * 0.82, a + bay, 1, 2.85, 3.2, 0.5, 'trim'));
    out.push(...arc(cx, cz, r, a + bay * 0.18, a + bay * 0.32, 1, 3.05, 3.2, 0.5, 'trim'), ...arc(cx, cz, r, a + bay * 0.68, a + bay * 0.82, 1, 3.05, 3.2, 0.5, 'trim'));
    a += bay;
  }
  return out;
}

const HALF_PI = Math.PI / 2;

/** Outer sides of an n × n corner piece left open (north row and east column), so the curve is the only wall. */
function openNorthEast(n: number): Record<string, EdgeStyle> {
  const out: Record<string, EdgeStyle> = {};
  for (let i = 0; i < n; i++) {
    out[`${i},${n - 1},0:N`] = 'open';
    out[`${n - 1},${i},0:E`] = 'open';
  }
  return out;
}

/** Ports on the south row and west column of an n × n corner piece: where it joins the rest of the building. */
function southWestPorts(n: number): TilePort[] {
  const out: TilePort[] = [];
  for (let i = 0; i < n; i++) out.push({ side: 'S', level: 0, cell: [i, 0] }, { side: 'W', level: 0, cell: [0, i] });
  return out;
}

/**
 * Rounded corners, small (1 cell), medium (2 × 2) and large (3 × 3): a
 * quarter-circle wall from the south-east corner to the north-west corner,
 * centred on the south-west corner. Inside it is a room with a rounded
 * corner; from outside it is a building's rounded corner. The ends meet the
 * straight walls of neighbouring rooms exactly.
 */
function roundCorners(): TileDefinition[] {
  const sizes = [
    ['s', 'Small', 1],
    ['m', 'Medium', 2],
    ['l', 'Large', 3],
  ] as const;
  return sizes.flatMap(([key, label, n]) => {
    const r = n * 8 - TILE_DIMENSIONS.wallThickness / 2;
    const common = {
      category: 'Curves' as const,
      cells: footprint(n, n),
      floors: [0],
      ports: southWestPorts(n),
      edgeDefaults: openNorthEast(n),
    };
    return [
      {
        ...common,
        id: `core.round_corner_${key}`,
        displayName: `Round Corner (${label})`,
        blurb: 'A curved wall turning the corner: a rounded room inside, a rounded building outside',
        solids: [...arc(-4, -4, r, 0, HALF_PI, pieces(r, HALF_PI), 0, 4), ...arcTrim(-4, -4, r, 0, HALF_PI)],
      },
      {
        ...common,
        id: `core.round_arcade_${key}`,
        displayName: `Round Arcade (${label})`,
        blurb: 'A curved colonnade of arches: a cloister inside, a portico outside',
        solids: arcade(-4, -4, r, 0, HALF_PI, n * 2 + 1),
      },
      {
        ...common,
        id: `core.round_half_${key}`,
        displayName: `Round Low Wall (${label})`,
        blurb: 'A curved waist-high wall: cover, a garden edge or a balcony parapet',
        solids: [...arc(-4, -4, r, 0, HALF_PI, pieces(r, HALF_PI), 0, 1.1), ...arc(-4, -4, r, 0, HALF_PI, pieces(r, HALF_PI), 1.1, 1.18, 0.6, 'trim')],
      },
    ];
  });
}

/** A round tower room: a full circle of wall in a 2 × 2 footprint, a doorway south and windows round it. */
function roundTower(): TileDefinition {
  const r = 7.5;
  const door = 1.6 / r; // half the doorway angle
  const win = 0.75 / r;
  const south = -HALF_PI;
  const solids: LocalBox[] = [];
  // Wall runs between the doorway (south) and three windows (east, north, west).
  const openings = [south, 0, HALF_PI, Math.PI];
  for (let i = 0; i < 4; i++) {
    const a = openings[i]! + (i === 0 ? door : win);
    const b = (i === 3 ? south + 2 * Math.PI : openings[i + 1]!) - (i === 3 ? door : win);
    solids.push(...arc(4, 4, r, a, b, pieces(r, b - a), 0, 4), ...arcTrim(4, 4, r, a, b));
  }
  solids.push(...arc(4, 4, r, south - door, south + door, 3, 3.2, 4));
  for (const a of [0, HALF_PI, Math.PI]) solids.push(...arc(4, 4, r, a - win, a + win, 2, 0, 1), ...arc(4, 4, r, a - win, a + win, 2, 2.4, 4));
  return {
    id: 'core.round_tower',
    category: 'Curves',
    displayName: 'Round Tower',
    blurb: '2 × 2 open ground with a round room in the middle: doorway south, windows round it',
    cells: footprint(2, 2),
    floors: [0],
    ports: perimeterPorts(2, 2),
    open: true,
    edgeDefault: 'open',
    solids,
  };
}

/** A quarter-circle corridor from the south doorway round to the west doorway. */
function curvedCorridor(): TileDefinition {
  const solids = [
    ...arc(-4, -4, 2.25, 0, HALF_PI, 4, 0, 4),
    ...arc(-4, -4, 5.75, 0, HALF_PI, 8, 0, 4),
    ...arcTrim(-4, -4, 2.25, 0, HALF_PI),
    ...arcTrim(-4, -4, 5.75, 0, HALF_PI),
  ];
  return {
    id: 'core.corridor_curve',
    category: 'Curves',
    displayName: 'Curved Corridor',
    blurb: 'A corridor sweeping round the corner from the south doorway to the west one',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [{ side: 'S', level: 0 }, { side: 'W', level: 0 }],
    solids,
  };
}

/** Balconies jutting out from an upper doorway (on their south side) over the open air. */
function balconies(): TileDefinition[] {
  const rails = [rail(-3.94, -1.5, 3.94, -1.5), rail(-3.94, -4, -3.94, -1.5), rail(3.94, -4, 3.94, -1.5)];
  // Round balcony: a half-disc floor (in strips under the rail) and a curved railing.
  const R = 3.5;
  const strips: LocalBox[] = [];
  for (let j = 0; j < 7; j++) {
    const z0 = -4 + j * 0.5;
    const w = Math.sqrt(Math.max(0, R * R - (z0 + 4) * (z0 + 4)));
    strips.push(box(-w, -0.3, z0, w, 0, z0 + 0.5));
  }
  return [
    {
      id: 'core.balcony',
      category: 'Curves',
      displayName: 'Balcony',
      blurb: 'A railed ledge 2.5 m deep off an upper doorway (on its south side); place it on the level above the ground',
      cells: [[0, 0, 0]],
      floors: [],
      ports: [{ side: 'S', level: 0 }],
      edgeDefault: 'open',
      extraFloors: [box(-4, -0.3, -4, 4, 0, -1.5)],
      solids: rails,
    },
    {
      id: 'core.balcony_round',
      category: 'Curves',
      displayName: 'Round Balcony',
      blurb: 'A half-round railed balcony off an upper doorway (on its south side)',
      cells: [[0, 0, 0]],
      floors: [],
      ports: [{ side: 'S', level: 0 }],
      edgeDefault: 'open',
      extraFloors: strips,
      solids: [...arc(0, -4, R - 0.1, 0, Math.PI, 10, 0, 1.05, 0.12, 'solid'), ...arc(0, -4, R - 0.1, 0, Math.PI, 10, 0.95, 1.08, 0.16, 'trim')],
    },
  ];
}

export const CORE_TILES: readonly TileDefinition[] = [
  { id: 'core.room', category: 'Rooms', displayName: 'Room', cells: [[0, 0, 0]], floors: [0], ports: ALL_SIDES, configurable: true },
  {
    id: 'core.room_pillar', configurable: true, category: 'Rooms',
    displayName: 'Room (Pillar)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    solids: [{ min: [-1, 0, -1], max: [1, 4, 1] }],
  },
  {
    id: 'core.corridor', category: 'Corridors',
    displayName: 'Corridor',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'N', level: 0 },
      { side: 'S', level: 0 },
    ],
    // Low cover block off-centre so corridors are not pure sightlines.
    solids: [{ min: [-3.5, 0, -0.75], max: [-1.5, 1.1, 0.75] }],
  },
  {
    id: 'core.corner', category: 'Corridors',
    displayName: 'Corner',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'N', level: 0 },
      { side: 'E', level: 0 },
    ],
  },
  {
    id: 'core.junction_t', category: 'Corridors',
    displayName: 'T-Junction',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'N', level: 0 },
      { side: 'E', level: 0 },
      { side: 'W', level: 0 },
    ],
  },
  {
    id: 'core.dead_end', category: 'Corridors',
    displayName: 'Dead End',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [{ side: 'N', level: 0 }],
    solids: [{ min: [-1.5, 0, -3.5], max: [1.5, 1.1, -2.5] }],
  },
  {
    id: 'core.junction_x', category: 'Corridors',
    displayName: 'Crossroads',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    // Corner pillars narrow the sightlines through the crossing.
    solids: [
      { min: [-3.5, 0, -3.5], max: [-2.5, 4, -2.5] },
      { min: [2.5, 0, -3.5], max: [3.5, 4, -2.5] },
      { min: [-3.5, 0, 2.5], max: [-2.5, 4, 3.5] },
      { min: [2.5, 0, 2.5], max: [3.5, 4, 3.5] },
    ],
  },
  {
    id: 'core.room_columns', configurable: true, category: 'Rooms',
    displayName: 'Room (Columns)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    solids: [
      { min: [-2.4, 0, -2.4], max: [-1.6, 4, -1.6] },
      { min: [1.6, 0, -2.4], max: [2.4, 4, -1.6] },
      { min: [-2.4, 0, 1.6], max: [-1.6, 4, 2.4] },
      { min: [1.6, 0, 1.6], max: [2.4, 4, 2.4] },
    ],
  },
  {
    id: 'core.room_cover', configurable: true, category: 'Rooms',
    displayName: 'Room (Low Cover)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    solids: [
      { min: [-2.5, 0, -0.5], max: [-0.5, 1.1, 0.5] },
      { min: [0.5, 0, 1.5], max: [1.5, 1.1, 3] },
      { min: [1, 0, -2.5], max: [2.5, 1.1, -1.5] },
    ],
  },
  {
    id: 'core.room_dais', configurable: true, category: 'Rooms',
    displayName: 'Room (Dais)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    // Raised 0.75 m platform with three 0.25 m steps on its south side.
    solids: [
      { min: [-2, 0, -1], max: [2, 0.75, 2] },
      { min: [-1, 0, -1.5], max: [1, 0.5, -1] },
      { min: [-1, 0, -2], max: [1, 0.25, -1.5] },
    ],
  },
  // City streets (Downtown City MegaKit at 4/3): walked at floor height, the kerbs are only a few centimetres.
  {
    id: 'city.street', category: 'Open',
    displayName: 'City Street',
    blurb: 'A two-lane road with pavements: 1 cell along the road, 2 across',
    cells: footprint(1, 2),
    floors: [0],
    ports: perimeterPorts(1, 2),
    open: true,
    edgeDefault: 'open',
    model: { file: 'city/street.glb', lift: 0.02 },
  },
  {
    id: 'city.crossroads', category: 'Open',
    displayName: 'City Crossroads',
    blurb: '4 × 4 cells: two streets crossing, with crossings and corner pavements',
    cells: footprint(4, 4),
    floors: [0],
    ports: perimeterPorts(4, 4),
    open: true,
    edgeDefault: 'open',
    model: { file: 'city/crossroads.glb', lift: 0.02 },
  },
  { id: 'core.yard', category: 'Open', displayName: 'Courtyard', cells: [[0, 0, 0]], floors: [0], ports: ALL_SIDES, open: true, configurable: true },
  {
    id: 'core.yard_crates', category: 'Open',
    displayName: 'Courtyard (Crates)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    open: true,
    // A two-high stack with a single crate beside it to climb on.
    solids: [
      { min: [0.8, 0, 0.8], max: [2.2, 2, 2.2] },
      { min: [2.2, 0, 1], max: [3.2, 1, 2] },
    ],
  },
  {
    id: 'core.yard_wall', category: 'Open',
    displayName: 'Courtyard (Low Wall)',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    open: true,
    // Waist-high wall across the middle with a gap to walk through.
    solids: [
      { min: [-4, 0, -0.25], max: [-0.9, 1.1, 0.25] },
      { min: [0.9, 0, -0.25], max: [4, 1.1, 0.25] },
    ],
  },
  {
    id: 'core.stairs', category: 'Vertical',
    displayName: 'Stairs',
    cells: [
      [0, 0, 0],
      [0, 0, 1],
    ],
    floors: [0],
    ports: [
      { side: 'W', level: 0 },
      { side: 'E', level: 1 },
    ],
    solids: stairSteps(),
  },  // ---------------------------------------------------------------- rooms with elevation
  {
    id: 'core.room_ledge',
    category: 'Rooms',
    displayName: 'Room (Raised Ledge)',
    blurb: 'A 1.5 m ledge along the back wall with steps up the middle',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'E', level: 0 },
      { side: 'S', level: 0 },
      { side: 'W', level: 0 },
    ],
    solids: [box(-3.5, 0, 1.25, 3.5, 1.5, 3.5), ...descending(1.25, -1.25, 1.25, 5, 1.25)],
  },
  {
    id: 'core.room_split',
    category: 'Rooms',
    displayName: 'Split-Level Room',
    blurb: 'The back half 1 m higher, steps at both sides',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    solids: [box(-3.5, 0, 1.5, 3.5, 1, 3.5), ...descending(1.5, -3.5, -1.5, 3, 0.75), ...descending(1.5, 1.5, 3.5, 3, 0.75)],
  },
  {
    id: 'core.room_sunken',
    category: 'Rooms',
    displayName: 'Sunken Room',
    blurb: 'The front of the room drops 1.5 m into a pit, with steps down; enter from the back',
    cells: [
      [0, 0, -1],
      [0, 0, 0],
    ],
    floors: [],
    ports: [{ side: 'N', level: 0 }],
    extraFloors: [
      // Pit floor, and the walkway behind it as a solid block down to the pit.
      box(-4, -2, -4, 4, -1.5, 4),
      box(-4, -1.5, 1, 4, 0, 4),
    ],
    solids: flight('z', -1, 1, -3.5, -1.5, 5, -1.5, 0.45, -1.5).map((b, i) => box(b.min[0], -1.5, b.min[2], b.max[0], -0.25 * (i + 1), b.max[2])),
  },
  {
    id: 'core.room_tall',
    category: 'Rooms',
    displayName: 'Tall Room',
    blurb: 'Two storeys high; doorways on either level',
    cells: [
      [0, 0, 0],
      [0, 0, 1],
    ],
    floors: [0],
    ports: [...ALL_SIDES, ...SIDES.map((side) => ({ side, level: 1 }))],
    solids: [box(-0.75, 0, -0.75, 0.75, 8, 0.75)],
  },
  // ---------------------------------------------------------------- large pieces
  {
    id: 'core.room_long', configurable: true,
    category: 'Large',
    displayName: 'Long Room',
    blurb: '1 × 2 cells with cover at both ends',
    cells: footprint(1, 2),
    floors: [0],
    ports: perimeterPorts(1, 2),
    solids: [box(-2, 0, 1, 2, 1.1, 2), box(-2, 0, 6, 2, 1.1, 7), box(-0.6, 0, 3.4, 0.6, 4, 4.6)],
  },
  {
    id: 'core.room_large', configurable: true,
    category: 'Large',
    displayName: 'Large Room',
    blurb: '2 × 2 cells, open floor with four columns',
    cells: footprint(2, 2),
    floors: [0],
    ports: perimeterPorts(2, 2),
    solids: [box(0.8, 0, 0.8, 1.6, 4, 1.6), box(6.4, 0, 0.8, 7.2, 4, 1.6), box(0.8, 0, 6.4, 1.6, 4, 7.2), box(6.4, 0, 6.4, 7.2, 4, 7.2)],
  },
  // Whole city buildings (not enterable): solid blocks you can stand on, their street face toward local +z (north at rotation 0).
  {
    id: 'city.brownstone', category: 'Buildings',
    displayName: 'Brownstone',
    blurb: '2 × 2 cells, five storeys of pale brick with a stoop (solid; climb the roof)',
    cells: footprint(2, 2, 6),
    floors: [0],
    ports: [],
    edgeDefault: 'open',
    solids: [{ min: [-4, 0, -4], max: [12, 22.7, 12], kind: 'prop' }],
    model: { file: 'city/brownstone.glb' },
  },
  {
    id: 'city.midrise', category: 'Buildings',
    displayName: 'Midrise',
    blurb: '2 × 2 cells, seven storeys with a green shopfront (solid)',
    cells: footprint(2, 2, 8),
    floors: [0],
    ports: [],
    edgeDefault: 'open',
    solids: [{ min: [-4, 0, -1.7], max: [12, 28.6, 12], kind: 'prop' }],
    model: { file: 'city/midrise.glb' },
  },
  {
    id: 'city.highrise', category: 'Buildings',
    displayName: 'Office Block',
    blurb: '3 × 3 cells, eight storeys of glass and brick (solid)',
    cells: footprint(3, 3, 9),
    floors: [0],
    ports: [],
    edgeDefault: 'open',
    solids: [{ min: [-4, 0, 0.8], max: [20, 33.6, 20], kind: 'prop' }],
    model: { file: 'city/highrise.glb' },
  },
  {
    id: 'core.hall', configurable: true,
    category: 'Large',
    displayName: 'Great Hall',
    blurb: '3 × 3 cells with colonnades and a central dais',
    cells: footprint(3, 3),
    floors: [0],
    ports: perimeterPorts(3, 3),
    solids: [...[2, 6, 10, 14].flatMap((x) => [box(x - 0.5, 0, 1.5, x + 0.5, 4, 2.5), box(x - 0.5, 0, 13.5, x + 0.5, 4, 14.5)]), box(5, 0, 5, 11, 0.5, 11), box(6, 0, 6, 10, 1, 10)],
  },
  {
    id: 'core.atrium',
    category: 'Large',
    displayName: 'Atrium',
    blurb: '2 × 2 cells, two storeys, a balcony all round and stairs up',
    cells: footprint(2, 2, 2),
    floors: [0],
    ports: perimeterPorts(2, 2, [0, 1]),
    extraFloors: [box(-4, 3.5, 9.5, 12, 4, 12), box(-4, 3.5, -4, 12, 4, -1.5), box(-4, 3.5, -1.5, -1.5, 4, 9.5), box(9.5, 3.5, -1.5, 12, 4, 9.5)],
    solids: [...flight('x', 1, 1.5, -1.5, 0.75, 16), rail(-1.5, 9.5, 9.5, 9.5, 4), rail(-1.5, -1.5, -1.5, 9.5, 4), rail(9.5, 0.75, 9.5, 9.5, 4), rail(-1.5, -1.5, 9.5, -1.5, 4)],
  },
  {
    id: 'core.plaza', configurable: true,
    category: 'Large',
    displayName: 'Plaza',
    blurb: '2 × 2 cells of open ground round a raised fountain',
    cells: footprint(2, 2),
    floors: [0],
    ports: perimeterPorts(2, 2),
    open: true,
    solids: [box(1.5, 0, 1.5, 6.5, 0.6, 6.5), box(3, 0, 3, 5, 1.6, 5)],
  },
  // ---------------------------------------------------------------- corridors and bridges
  { id: 'core.corridor_clear', category: 'Corridors', displayName: 'Corridor (Clear)', cells: [[0, 0, 0]], floors: [0], ports: [{ side: 'N', level: 0 }, { side: 'S', level: 0 }] },
  {
    id: 'core.corridor_windows',
    category: 'Corridors',
    displayName: 'Corridor (Windowed)',
    blurb: 'Its closed sides are windows unless you change them',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [{ side: 'N', level: 0 }, { side: 'S', level: 0 }],
    edgeDefault: 'windows',
  },
  {
    id: 'core.corridor_long',
    category: 'Corridors',
    displayName: 'Long Corridor',
    blurb: 'Two cells long, with low cover halfway',
    cells: footprint(1, 2),
    floors: [0],
    ports: [{ side: 'S', level: 0, cell: [0, 0] }, { side: 'N', level: 0, cell: [0, 1] }],
    solids: [box(1.5, 0, 3.4, 3.5, 1.1, 4.6)],
  },
  {
    id: 'core.bridge',
    category: 'Corridors',
    displayName: 'Bridge',
    blurb: 'A 3 m deck with railings and nothing underneath',
    cells: [[0, 0, 0]],
    floors: [],
    ports: [{ side: 'N', level: 0 }, { side: 'S', level: 0 }],
    edgeDefault: 'open',
    extraFloors: [box(-1.5, -0.5, -4, 1.5, 0, 4)],
    solids: [rail(-1.5, -4, -1.5, 4), rail(1.5, -4, 1.5, 4)],
  },
  {
    id: 'core.catwalk',
    category: 'Corridors',
    displayName: 'Catwalk Corner',
    blurb: 'A narrow walkway turning a corner over the drop',
    cells: [[0, 0, 0]],
    floors: [],
    ports: [{ side: 'N', level: 0 }, { side: 'E', level: 0 }],
    edgeDefault: 'open',
    extraFloors: [box(-1, -0.3, -1, 1, 0, 4), box(1, -0.3, -1, 4, 0, 1)],
    solids: [rail(-1, -1, -1, 4), rail(-1, -1, 4, -1)],
  },
  // ---------------------------------------------------------------- vertical
  {
    id: 'core.stairwell',
    category: 'Vertical',
    displayName: 'Stairwell',
    blurb: 'Switchback stairs up one level; doorways west on both floors',
    cells: [
      [0, 0, 0],
      [0, 0, 1],
    ],
    floors: [0],
    ports: [
      { side: 'W', level: 0 },
      { side: 'W', level: 1 },
    ],
    // Two flights side by side (no stairwell gap), joined by a landing at 2 m.
    extraFloors: [box(-4, 3.5, -1.5, -1.9, 4, 4)],
    solids: [...flight('x', 1, -1.9, -3.5, 0, 8, 0, 0.45), box(1.7, 0, -3.5, 3.5, 2, 3.5), ...flight('x', -1, 1.7, 0, 3.5, 8, 2, 0.45)],
  },
  {
    id: 'core.ramp',
    category: 'Vertical',
    displayName: 'Long Ramp',
    blurb: 'A gentle climb of one level over two cells',
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
    ],
    floors: [0],
    ports: [
      { side: 'W', level: 0, cell: [0, 0] },
      { side: 'E', level: 1, cell: [1, 0] },
    ],
    solids: flight('x', 1, -4, -3.5, 3.5, 16, 0, 1),
  },
  {
    id: 'core.stairs_open',
    category: 'Vertical',
    displayName: 'Open Stairs',
    blurb: 'Outdoor steps up one level, no walls',
    cells: [
      [0, 0, 0],
      [0, 0, 1],
    ],
    floors: [0],
    ports: [
      { side: 'W', level: 0 },
      { side: 'E', level: 1 },
    ],
    open: true,
    edgeDefault: 'open',
    solids: flight('x', 1, -4, -2, 2, 16),
  },
  {
    id: 'core.tower',
    category: 'Vertical',
    displayName: 'Watchtower',
    blurb: 'Open ground with a 1.5 m lookout along one side and steps up',
    cells: [
      [0, 0, 0],
      [0, 0, 1],
    ],
    floors: [0],
    ports: ALL_SIDES,
    open: true,
    // A lookout along the east side, reached by steps along the south wall.
    extraFloors: [box(1.3, 1.1, -3.5, 3.5, 1.5, 3.5)],
    solids: [
      box(1.3, 0, 3.1, 1.7, 1.1, 3.5),
      box(1.3, 0, -1.2, 1.7, 1.1, -0.8),
      ...flight('x', 1, -1.4, -3.5, -1.2, 6, 0, 0.45),
      rail(1.3, -1.2, 1.3, 3.5, 1.5),
      rail(1.3, 3.5, 3.5, 3.5, 1.5),
      rail(3.5, -3.5, 3.5, 3.5, 1.5),
    ],
  },
  // ---------------------------------------------------------------- open ground
  { id: 'core.platform', category: 'Open', displayName: 'Platform', blurb: 'Floor only: no walls, mind the edge', cells: [[0, 0, 0]], floors: [0], ports: ALL_SIDES, open: true, edgeDefault: 'open' },
  {
    id: 'core.platform_rail',
    category: 'Open',
    displayName: 'Platform (Railing)',
    blurb: 'Floor with railings on the unconnected sides',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    open: true,
    edgeDefault: 'railing',
  },
  {
    id: 'core.terrace',
    category: 'Open',
    displayName: 'Terrace',
    blurb: 'Open ground with a 1 m step-up across the back',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    open: true,
    solids: [box(-4, 0, 1, 4, 1, 4), ...descending(1, -1.5, 1.5, 3, 0.75)],
  },
  {
    id: 'core.yard_ruins',
    category: 'Open',
    displayName: 'Courtyard (Ruins)',
    blurb: 'Broken columns and a fallen block',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL_SIDES,
    open: true,
    solids: [box(-3, 0, 2, -2, 3.2, 3), box(2, 0, 2, 3, 1.4, 3), box(-3, 0, -3, -2, 0.8, -2), box(0.5, 0, -2.5, 3.2, 0.9, -1.4)],
  },
  ...buildings(),
  ...roundCorners(),
  roundTower(),
  curvedCorridor(),
  ...balconies(),
  ...stylePackTiles(),
  // ---------------------------------------------------------------- special
  {
    id: 'core.pit',
    category: 'Special',
    displayName: 'Pit',
    blurb: 'A 4 × 4 m hole with a walkway round it: falls to the level below, or to your doom',
    cells: [[0, 0, 0]],
    floors: [],
    ports: ALL_SIDES,
    extraFloors: [box(-4, -0.5, 2, 4, 0, 4), box(-4, -0.5, -4, 4, 0, -2), box(-4, -0.5, -2, -2, 0, 2), box(2, -0.5, -2, 4, 0, 2)],
  },
  {
    id: 'core.drop',
    category: 'Special',
    displayName: 'Drop Shaft',
    blurb: 'Most of the floor gone: a quick way down to the level below',
    cells: [[0, 0, 0]],
    floors: [],
    ports: ALL_SIDES,
    extraFloors: [box(-4, -0.5, 1.5, 4, 0, 4)],
    solids: [rail(-4, 1.5, -1.6, 1.5), rail(1.6, 1.5, 4, 1.5)],
  },
  // Style Pack pieces (01 Military Compound, 02 Frontier Dust): see packTiles.ts and editor/stylePacks.ts.
  ...boxPackTiles(),
  // Style Pack pieces (05 Gothic Estate, 06 Jungle Ruins, 08 Suburban Chaos): see packTiles2.ts.
  ...boxPackTiles2(),
  // Style Pack pieces (03 Imperial Arena, 09 Sands of Egypt): see packTilesAncient.ts.
  ...ancientPackTiles(),
  // Style Pack pieces (10 Medieval Village): see packTilesMedieval.ts.
  ...medievalPackTiles(),
];

// ---------------------------------------------------------------- buildings

/** A thin interior wall (wall paint) along x or z, from a0 to a1, with openings [g0, g1] left out. */
function partition(axis: 'x' | 'z', at: number, a0: number, a1: number, gaps: readonly (readonly [number, number])[] = [], y0 = 0, y1 = 3.5, t = 0.12): LocalBox[] {
  const out: LocalBox[] = [];
  let from = a0;
  for (const [g0, g1] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (g0 > from) out.push(axis === 'x' ? box(from, y0, at - t, g0, y1, at + t) : box(at - t, y0, from, at + t, y1, g0));
    from = g1;
  }
  if (a1 > from) out.push(axis === 'x' ? box(from, y0, at - t, a1, y1, at + t) : box(at - t, y0, from, at + t, y1, a1));
  return out.map((b) => ({ ...b, kind: 'wall' as const }));
}

/** Decorative only (the theme's trim paint): frames, beams, lines. */
function trim(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): LocalBox {
  return { min: [x0, y0, z0], max: [x1, y1, z1], kind: 'trim' };
}

/** A street lamp: a pole with an arm reaching over the road (`dir` +1 east, -1 west). */
function lamp(x: number, z: number, dir: 1 | -1): LocalBox[] {
  return [box(x - 0.1, 0, z - 0.1, x + 0.1, 4.6, z + 0.1), trim(Math.min(x, x + dir * 1.4), 4.4, z - 0.06, Math.max(x, x + dir * 1.4), 4.55, z + 0.06), trim(x + dir * 1.2 - 0.25, 4.2, z - 0.18, x + dir * 1.2 + 0.25, 4.4, z + 0.18)];
}

/**
 * Whole buildings as single pieces, with their insides laid out: rooms,
 * stairs, counters and shelving as solid blocks, interior walls in the wall
 * paint and frames and beams in the trim paint, so they take any theme.
 */
function buildings(): TileDefinition[] {
  return [
    {
      id: 'core.house',
      category: 'Buildings',
      displayName: 'House',
      blurb: '2 × 2 cells, two storeys: living room, kitchen, stair hall, two rooms upstairs, windows all round',
      cells: footprint(2, 2, 2),
      floors: [0],
      ports: [
        { side: 'S', level: 0, cell: [0, 0] },
        { side: 'E', level: 0, cell: [1, 0] },
        { side: 'N', level: 0, cell: [1, 1] },
      ],
      edgeDefault: 'window',
      // The upper floor, open over the stairs (x -1..7 along the north wall, with room to walk on at the foot).
      extraFloors: [box(-4, 3.5, -4, 12, 4, 8.5), box(7, 3.5, 8.5, 12, 4, 12)],
      solids: [
        ...flight('x', 1, -1, 8.6, 11.6, 16),
        rail(-1, 8.5, 7, 8.5, 4),
        // Ground floor: living room (south-west), kitchen (south-east), stair hall (north).
        ...partition('x', 4, -4, 12, [[0.5, 2.5], [8.5, 10.5]]),
        ...partition('z', 4, -4, 4, [[-1, 1]]),
        box(9, 0, -3.7, 11.7, 0.95, -0.8),
        box(6, 0, 0.6, 8, 0.95, 2),
        box(-3.6, 0, -3.7, -0.4, 0.75, -2.7),
        // Upstairs: two rooms either side of a landing.
        ...partition('z', 4, -4, 8.5, [[2.5, 4.5]], 4, 7.5),
        box(-3.6, 4, -3.7, -1, 4.5, -1.6),
        box(9.6, 4, -3.7, 11.7, 4.5, -1),
        // A flat roof with a parapet, and trim at the eaves and between the floors.
        box(-4, 8, -4, 12, 8.35, 12),
        trim(-4, 8.35, -4, 12, 8.8, -3.7),
        trim(-4, 8.35, 11.7, 12, 8.8, 12),
        trim(-4, 8.35, -3.7, -3.7, 8.8, 11.7),
        trim(11.7, 8.35, -3.7, 12, 8.8, 11.7),
        trim(-3.75, 3.75, -3.75, 11.75, 3.95, -3.6),
        trim(-3.75, 3.75, 11.6, 11.75, 3.95, 11.75),
      ],
    },
    {
      id: 'core.warehouse',
      category: 'Buildings',
      displayName: 'Warehouse',
      blurb: '3 × 2 cells, double height: pallet stacks on the floor, a mezzanine along the back reached by stairs',
      cells: footprint(3, 2, 2),
      floors: [0],
      ports: [
        { side: 'S', level: 0, cell: [0, 0] },
        { side: 'S', level: 0, cell: [2, 0] },
        { side: 'W', level: 0, cell: [0, 1] },
        { side: 'E', level: 0, cell: [2, 0] },
        { side: 'N', level: 1, cell: [1, 1] },
      ],
      edgeDefaults: { '0,0,1:S': 'windows', '1,0,1:S': 'windows', '2,0,1:S': 'windows', '0,1,1:W': 'windows', '2,1,1:E': 'windows' },
      // The mezzanine (north half, 4 m up), with a landing at the top of the stairs.
      extraFloors: [box(-4, 3.5, 6, 20, 4, 12), box(16, 3.5, 3, 20, 4, 6)],
      solids: [
        ...flight('x', 1, 8, 3, 5.4, 16),
        rail(-4, 6, 11, 6, 4),
        // Columns under the mezzanine and pallet stacks out on the floor.
        box(3.8, 0, 5.8, 4.2, 3.5, 6.2),
        box(7.8, 0, 5.8, 8.2, 3.5, 6.2),
        box(0, 0, -2.5, 2.2, 1.2, -0.5),
        box(0.2, 1.2, -2.3, 2, 2.3, -0.7),
        box(6, 0, -3, 8.4, 2.4, -1),
        box(14, 0, 0.5, 16.2, 1.2, 2.5),
        box(16.6, 0, -3.5, 19.6, 1.2, -1.5),
        box(-3.6, 4, 8.5, -1, 5.2, 11.6),
        // A roof over the trusses.
        box(-4, 8, -4, 20, 8.35, 12),
        trim(-4, 8.35, -4, 20, 8.6, -3.7),
        // Roof trusses.
        ...[0, 8, 16].map((x) => trim(x - 0.15, 7.4, -4, x + 0.15, 7.8, 12)),
        trim(-4, 7.6, 3.85, 20, 7.8, 4.15),
      ],
    },
    {
      id: 'core.bunker',
      category: 'Buildings',
      displayName: 'Bunker',
      blurb: '2 × 1 cells of thick concrete: firing slits, a centre pillar, sandbag cover at the doors',
      cells: footprint(2, 1),
      floors: [0],
      ports: [
        { side: 'W', level: 0 },
        { side: 'E', level: 0, cell: [1, 0] },
        { side: 'S', level: 0 },
      ],
      edgeDefault: 'slit',
      solids: [
        box(3.4, 0, -0.6, 4.6, 4, 0.6),
        // Sandbag cover inside each door, leaving a way round.
        box(-1.6, 0, -2.4, -1, 1.1, -0.6),
        box(9, 0, 0.6, 9.6, 1.1, 2.4),
        box(-2.6, 0, -1.4, -0.6, 1.1, -0.8),
        box(6, 0, 2.6, 9.5, 0.9, 3.6),
        // A thick roof slab with a lip.
        box(-4, 4, -4, 12, 4.9, 4),
        trim(-4, 4.9, -4, 12, 5.05, -3.6),
        trim(-4, 4.9, 3.6, 12, 5.05, 4),
      ],
    },
    {
      id: 'core.shop',
      category: 'Buildings',
      displayName: 'Shop',
      blurb: '2 × 1 cells: a glass shopfront, shelving aisles and a counter, a stock room behind',
      cells: footprint(2, 1),
      floors: [0],
      ports: [
        { side: 'S', level: 0 },
        { side: 'N', level: 0, cell: [1, 0] },
      ],
      edgeDefaults: { '1,0,0:S': 'windows', '0,0,0:N': 'window', '0,0,0:W': 'window' },
      solids: [
        box(-2.8, 0, -1.2, 2.2, 1.8, -0.6),
        box(-2.8, 0, 1, 2.2, 1.8, 1.6),
        box(-3.7, 0, 3, 2.2, 2, 3.7),
        box(5, 0, -3.2, 6, 1.05, 0.5),
        ...partition('z', 8, -4, 4, [[-1.4, 1.4]]),
        box(9, 0, 2.2, 11.6, 1.6, 3.7),
        box(10.4, 0, -3.7, 11.7, 2.2, -1.2),
        // Pelmet over the shopfront, inside.
        trim(-3.75, 3, -3.75, 11.75, 3.4, -3.5),
        // Flat roof with a parapet.
        box(-4, 4, -4, 12, 4.35, 4),
        trim(-4, 4.35, -4, 12, 4.8, -3.8),
        trim(-4, 4.35, 3.8, 12, 4.8, 4),
      ],
    },
    {
      id: 'core.gas_station',
      category: 'Buildings',
      displayName: 'Gas Station',
      blurb: '2 × 2 cells of forecourt: a canopy on pillars over two pump islands, and a kiosk at the back',
      cells: footprint(2, 2),
      floors: [0],
      ports: perimeterPorts(2, 2),
      open: true,
      solids: [
        // Canopy (you can stand on it) on four pillars.
        ...[[-1.5, -1.5], [9.5, -1.5], [-1.5, 5.5], [9.5, 5.5]].map(([x, z]) => box(x! - 0.3, 0, z! - 0.3, x! + 0.3, 5, z! + 0.3)),
        box(-2.5, 5, -2.5, 10.5, 5.4, 6.5),
        trim(-2.6, 5.4, -2.6, 10.6, 5.7, 6.6),
        // Pump islands.
        box(0.5, 0, 0.5, 7.5, 0.2, 1.7),
        box(1.5, 0.2, 0.75, 2.3, 1.7, 1.45),
        box(5.7, 0.2, 0.75, 6.5, 1.7, 1.45),
        box(0.5, 0, 3.3, 7.5, 0.2, 4.5),
        box(1.5, 0.2, 3.55, 2.3, 1.7, 4.25),
        box(5.7, 0.2, 3.55, 6.5, 1.7, 4.25),
        // Kiosk: a small room with a counter, door and window to the forecourt.
        ...partition('x', 7.6, 2, 9, [[4, 6.6]], 0, 3.2, 0.15),
        ...partition('x', 11.6, 2, 9, [], 0, 3.2, 0.15),
        ...partition('z', 2, 7.6, 11.6, [], 0, 3.2, 0.15),
        ...partition('z', 9, 7.6, 11.6, [[8.2, 10.8]], 0, 3.2, 0.15),
        box(1.8, 3.2, 7.4, 9.2, 3.5, 11.8),
        box(2.6, 0, 10.6, 6.4, 1.05, 11.4),
      ],
    },
    {
      id: 'core.street',
      category: 'Buildings',
      displayName: 'Street',
      blurb: 'A road north–south with raised sidewalks, a centre line and a street lamp',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL_SIDES,
      open: true,
      solids: [box(-4, 0, -4, -2.6, 0.15, 4), box(2.6, 0, -4, 4, 0.15, 4), trim(-0.08, 0, -3.2, 0.08, 0.02, -0.8), trim(-0.08, 0, 0.8, 0.08, 0.02, 3.2), ...lamp(-3.3, 3.4, 1)],
    },
    {
      id: 'core.intersection',
      category: 'Buildings',
      displayName: 'Intersection',
      blurb: 'Where two streets cross: sidewalk corners and crosswalks',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL_SIDES,
      open: true,
      solids: [
        ...[[-4, -4], [2.6, -4], [-4, 2.6], [2.6, 2.6]].map(([x, z]) => box(x!, 0, z!, x! + 1.4, 0.15, z! + 1.4)),
        ...[-2, -1, 0, 1].flatMap((i) => [trim(i * 0.9 - 0.3, 0, -2.5, i * 0.9 + 0.15, 0.02, -1.9), trim(i * 0.9 - 0.3, 0, 1.9, i * 0.9 + 0.15, 0.02, 2.5), trim(-2.5, 0, i * 0.9 - 0.3, -1.9, 0.02, i * 0.9 + 0.15), trim(1.9, 0, i * 0.9 - 0.3, 2.5, 0.02, i * 0.9 + 0.15)]),
        ...lamp(3.3, 3.3, -1),
      ],
    },
  ];
}

// ---------------------------------------------------------------- Style Packs (Set 1)

/**
 * Tiles of the MapMaker Style Packs (see editor/stylePacks.ts): 04 Orbital
 * Station's hangar and reactor hall (our own geometry, painted by the theme)
 * and 07 Neon Megacity's towers (Kenney's City Kit (Commercial), CC0, fitted
 * to whole cells by tools/content/prepare-packs.mjs). Towers are solid blocks
 * as tall as their roofs (measured by the script), so rooftops are walkable;
 * rooftop clutter above that is walk-through, as for the city buildings.
 */
function stylePackTiles(): TileDefinition[] {
  /** A model-backed tower w × d cells, `across` metres wide (centred on its cells), its roof `roof` metres up. */
  const tower = (id: string, displayName: string, blurb: string, w: number, d: number, across: number, roof: number): TileDefinition => {
    const cx = ((w - 1) * 8) / 2;
    const cz = ((d - 1) * 8) / 2;
    const h = across / 2;
    return {
      id,
      category: 'Buildings',
      displayName,
      blurb,
      cells: footprint(w, d, Math.ceil(roof / 4)),
      floors: [0],
      ports: [],
      edgeDefault: 'open',
      solids: [{ min: [cx - h, 0, cz - h], max: [cx + h, roof, cz + h], kind: 'prop' }],
      model: { file: `packs/${id.replace('neon.', 'neon_')}.glb` },
    };
  };
  return [
    {
      id: 'orbital.hangar',
      category: 'Large',
      displayName: 'Hangar Bay',
      blurb: '3 × 3 cells, two storeys: a landing pad under a gantry along the back wall, stairs up the west side (open the front onto space and seal it with a force field)',
      cells: footprint(3, 3, 2),
      floors: [0],
      ports: [...perimeterPorts(3, 3, [0]), ...[0, 1, 2].map((x) => ({ side: 'N' as const, level: 1, cell: [x, 2] as const }))],
      extraFloors: [box(-4, 3.5, 16.5, 20, 4, 20), box(-4, 3.5, 8.5, -0.5, 4, 16.5)],
      solids: [
        ...flight('z', 1, 0.5, -3.5, -1, 16),
        rail(-0.5, 16.5, 20, 16.5, 4),
        rail(-0.5, 8.5, -0.5, 16.5, 4),
        // The landing pad: a low deck with glowing marks round it (trim).
        box(3, 0, 3, 13, 0.2, 13),
        trim(2.8, 0, 2.8, 13.2, 0.22, 3),
        trim(2.8, 0, 13, 13.2, 0.22, 13.2),
        trim(2.8, 0, 3, 3, 0.22, 13),
        trim(13, 0, 3, 13.2, 0.22, 13),
      ],
    },
    {
      id: 'orbital.reactor_hall',
      category: 'Large',
      displayName: 'Reactor Hall',
      blurb: '2 × 2 cells, two storeys: a catwalk all round under glowing edge lights, stairs up, and room in the middle for the Reactor Core prop. Pair it with a Low-Gravity Zone and float up to the catwalk',
      cells: footprint(2, 2, 2),
      floors: [0],
      ports: perimeterPorts(2, 2, [0, 1]),
      extraFloors: [box(-4, 3.5, 9.5, 12, 4, 12), box(-4, 3.5, -4, 12, 4, -1.5), box(-4, 3.5, -1.5, -1.5, 4, 9.5), box(9.5, 3.5, -1.5, 12, 4, 9.5)],
      solids: [
        ...flight('x', 1, 1.5, -1.5, 0.75, 16),
        // Glowing strips along the catwalk's inner edge (trim: paint them with Glow Trim).
        trim(-1.5, 3.5, 9.4, 9.5, 4.02, 9.5),
        trim(-1.5, 3.5, -1.5, -1.4, 4.02, 9.5),
        trim(9.4, 3.5, 0.75, 9.5, 4.02, 9.5),
        // Coolant pylons in the corners.
        box(-3.6, 0, -3.6, -2.6, 3.5, -2.6),
        box(10.6, 0, 10.6, 11.6, 3.5, 11.6),
        box(-3.6, 0, 10.6, -2.6, 3.5, 11.6),
      ],
    },
    tower('neon.tower_a', 'Glass Tower', '2 × 2 cells, a 31 m glass office tower (solid; elevators and pads up to its roof)', 2, 2, 15.2, 31.29),
    tower('neon.tower_b', 'Spire Tower', '2 × 2 cells, a 49 m glass spire (solid; a skyline piece)', 2, 2, 15.2, 49.18),
    tower('neon.tower_c', 'Stepped Tower', '2 × 2 cells, a 39 m tower with a stepped crown (solid)', 2, 2, 15.2, 39.43),
    tower('neon.tower_e', 'Twin-Block Tower', '2 × 2 cells, a 47 m tower (solid; a skyline piece)', 2, 2, 15.2, 46.95),
    tower('neon.shop_a', 'Corner Shop Block', '1 cell, three storeys of flats over a shop (solid; climb the roof)', 1, 1, 7.4, 9.45),
    tower('neon.block_n', 'Apartment Block', '2 × 2 cells, a 13 m apartment block with a roof terrace (solid)', 2, 2, 15.2, 13.1),
  ];
}

export class TileCatalog {
  private readonly byId = new Map<string, TileDefinition>();

  constructor(tiles: readonly TileDefinition[] = CORE_TILES) {
    for (const t of tiles) {
      if (this.byId.has(t.id)) throw new Error(`duplicate tile id ${t.id}`);
      this.byId.set(t.id, t);
    }
  }

  get(id: string): TileDefinition | undefined {
    return this.byId.get(id);
  }

  all(): TileDefinition[] {
    return [...this.byId.values()];
  }
}

export const coreCatalog = new TileCatalog();
