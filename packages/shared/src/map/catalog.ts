/**
 * Classic Grid tile catalog (graybox "core" pack).
 *
 * Tiles are data: occupied cells, connection ports, and extra solids, all in
 * the tile's local frame before rotation. Walls and floors are derived by the
 * geometry builder, which keeps tile definitions small and lets unconnected
 * ports auto-cap into solid walls. The core kit's tiles are in
 * content/tiles/core.json (tools/content/tiles.mjs generates
 * content/kitTiles.generated.ts): each part names one of the builders here
 * (box, flight, rail, arc, partition…) and its numbers. The Style Pack tiles
 * drawn in code follow (packTiles*.ts).
 */

import { KIT_TILES } from '../content/kitTiles.generated.ts';

import { boxPackTiles } from './packTiles.ts';
import { boxPackTiles2 } from './packTiles2.ts';
import { ancientPackTiles } from './packTilesAncient.ts';
import { medievalPackTiles } from './packTilesMedieval.ts';
import { harborPackTiles } from './packTilesHarbor.ts';
import { snowPackTiles } from './packTilesSnow.ts';
import { industrialPackTiles } from './packTilesIndustrial.ts';
import { orbitalPackTiles } from './packTilesOrbital.ts';
import { desertPackTiles } from './packTilesDesert.ts';
import { junglePackTiles } from './packTilesJungle.ts';
import { edgeLattice, edgePaint, edgeSegments, edgeTrimBoxes } from './edgeShapes.ts';

export * from './tileOptions.ts';
import { SIDES, type Ceiling, type Corner, type EdgeStyle, type Facade, type FloorInsert, type RoomLayout, type TileCategory, type TilePort } from './tileOptions.ts';

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
  /**
   * A `trim` box drawn in the walls' paint, not the trim's: a plain arch's stepped spandrels (the kit's `wallRun` with
   * `plain`), which look like the wall around them but never collide.
   */
  paint?: 'walls' | 'metal';
  /** A bar, post or rail of a see-through wall run (edgeLattice): it stops bodies and shots, never sight lines. */
  lattice?: true;
  /** A step of a flight (flight, descending): MapMaker's headroom check walks these (map/headroom.ts). */
  step?: true;
}

/** MapMaker's tile options that are tiles of their own (TileDefinition.optionOf), so a map needs no new field for one. */
export const TILE_OPTIONS = ['sideWalls', 'underGround', 'gate'] as const;
export type TileOptionId = (typeof TILE_OPTIONS)[number];

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
   * This tile is another tile with one of MapMaker's tile options switched on (the Vaulted Tunnel's side walls): the
   * tile inspector's checkbox swaps between the two, and the palette shows only the plain one. Same cells and ports.
   */
  optionOf?: { tile: string; option: TileOptionId };
  /**
   * The tunnel kit (content/tiles/tunnels.json): this tile is the shape `base` (the tile MapMaker's palette shows,
   * itself in the kit's first family) in the material family `family`. Same cells, ports, collision and bore as the
   * base: only materials and drawn trim differ. A placed piece's `family` (map format v37) picks among them.
   */
  familyOf?: { base: string; family: string; label: string };
  /**
   * A piece buried in terrain (a tunnel, its portal; map/groundBore.ts): the ground's surface inside each `cut` box is
   * taken out (the hill above stays on top), and over each `open` box (a mouth; its lower y is the floor) the ground
   * comes down to the floor, with banks beyond, and on `out` (the side the mouth faces) to daylight. Boxes are [x0, y0, z0, x1, y1, z1] in the tile's frame. The piece's
   * floors don't pull the ground down (settle.ts terrainUnderFloors): its own shell meets the ground.
   */
  bore?: {
    cut?: readonly (readonly number[])[];
    open?: readonly (readonly number[])[];
    out?: TilePort['side'];
    /** Lines the ground is brought to: `line` [x0, z0, x1, z1], `y` its height at each end, and whether the ground goes up to it, down to it or both. */
    rim?: readonly { line: readonly number[]; y: readonly number[]; mode: 'both' | 'raise' | 'lower' }[];
    /** Rectangles [x0, z0, x1, z1, y] the ground is at least `y` high over (earth over the piece's cap). */
    cover?: readonly (readonly number[])[];
    /** The passage's sides as plans draw them, [x0, z0, x1, z1] at the tile's own level, for a piece of more than one cell or level (else they follow the ports of each cell). */
    plan?: readonly (readonly number[])[];
    /** Open to the sky (steps down from the surface): a way out itself, so its ports are no open ends to put a portal on. */
    sky?: boolean;
  };
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
    out.push({ ...(axis === 'x' ? box(Math.min(u0, u1), floor, a0, Math.max(u0, u1), top, a1) : box(a0, floor, Math.min(u0, u1), a1, top, Math.max(u0, u1))), step: true });
  }
  return out;
}

/**
 * A spiral stair (the kit's `spiral`; St. John's chapel, docs/map-briefs/st_johns): `n` treads round a centre (cx,
 * cz), each from radius `r0` to `r1` turned to face out from the centre, sweeping from angle `a0` by `sweep`
 * (radians; 0 = +x/east, π/2 = +z/north; negative turns clockwise seen from above), the k-th one's top `base +
 * height * k / n` high. Treads are slabs `slab` thick (so the turn below keeps its headroom), save those numbered
 * `solid[0]`..`solid[1]` (from 1), which stand on the floor. Each ring of a tread is as long as the outer arc it
 * covers, so the treads overlap a little and leave no crack;
 * each is three boxes from the newel out (a wedge, near enough).
 */
function spiral(cx: number, cz: number, r0: number, r1: number, a0: number, sweep: number, n: number, height: number, base: number, slab: number, solid: readonly [number, number] | undefined): LocalBox[] {
  const out: LocalBox[] = [];
  const d = Math.abs(sweep) / n;
  // Each tread in three rings, each as long as its own outer arc: a wedge, near enough, so a tread doesn't reach over
  // its neighbours by the newel (which would leave a jumble of ledges there that the navmesh drops).
  const rings = 3;
  for (let k = 1; k <= n; k++) {
    const a = a0 + (sweep * (k - 0.5)) / n;
    const top = base + (height * k) / n;
    const bottom = solid && k >= solid[0] && k <= solid[1] ? base : top - slab;
    for (let i = 0; i < rings; i++) {
      const ra = r0 + ((r1 - r0) * i) / rings;
      const rb = r0 + ((r1 - r0) * (i + 1)) / rings;
      const len = 2 * rb * Math.sin(d / 2) + 0.04;
      const rm = (ra + rb) / 2;
      const mx = cx + rm * Math.cos(a);
      const mz = cz + rm * Math.sin(a);
      out.push({ min: [mx - len / 2, bottom, mz - (rb - ra) / 2 - 0.01], max: [mx + len / 2, top, mz + (rb - ra) / 2 + 0.01], yaw: -(a + Math.PI / 2) });
    }
  }
  return out;
}

/**
 * Steps down from the edge of a raised block at local z = `edge` (heading -z),
 * between x0 and x1: the first step `top` high, each next one 0.25 m lower,
 * `run` deep, standing on `floor`.
 */
function descending(edge: number, x0: number, x1: number, n: number, top: number, floor = 0, run = 0.5): LocalBox[] {
  return Array.from({ length: n }, (_, i) => ({ ...box(x0, floor, edge - (i + 1) * run, x1, top - i * 0.25, edge - i * run), step: true as const }));
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

/**
 * A shallow segmental barrel vault (a passage's ceiling): `pieces` strips running along `axis` (from along[0] to
 * along[1]) side by side across it (from span[0] to span[1]), their undersides on the circle through the springing
 * line (`spring` high at both edges) and the crown (`crown` high in the middle), each `t` thick and tilted to follow it
 * (rolled for a vault along z, pitched for one along x). Each strip touches the circle at its middle and meets its
 * neighbours at its lower edge, so from below the vault is closed; only the strips collide (the space over them is
 * shut in by the floor or roof above and the walls at its ends).
 */
export function vault(axis: 'x' | 'z', span: readonly [number, number], along: readonly [number, number], spring: number, crown: number, pieces = 12, t = 0.2, kind: LocalBox['kind'] = 'wall'): LocalBox[] {
  const c = (span[1] - span[0]) / 2;
  const mid = (span[0] + span[1]) / 2;
  const rise = crown - spring;
  if (!(c > 0 && rise > 0 && pieces >= 1 && along[1] > along[0])) return [];
  const r = (c * c + rise * rise) / (2 * rise);
  const centre = crown - r;
  const sweep = Math.asin(Math.min(1, c / r));
  const step = (2 * sweep) / pieces;
  // Tangent strips: half of one is r·tan(step/2) long, so neighbours' lower edges meet at the polygon's corners.
  const halfLen = r * Math.tan(step / 2);
  const out: LocalBox[] = [];
  for (let i = 0; i < pieces; i++) {
    const a = -sweep + (i + 0.5) * step;
    const u = mid + (r + t / 2) * Math.sin(a);
    const y = centre + (r + t / 2) * Math.cos(a);
    // The +u end of the strip rises where the curve does (right of the crown it falls: a > 0, tilt < 0).
    const tilt = -a;
    out.push(
      axis === 'z'
        ? { min: [u - halfLen, y - t / 2, along[0]], max: [u + halfLen, y + t / 2, along[1]], ...(tilt ? { roll: tilt } : {}), kind }
        : { min: [along[0], y - t / 2, u - halfLen], max: [along[1], y + t / 2, u + halfLen], ...(tilt ? { pitch: tilt } : {}), kind },
    );
  }
  return out;
}

const HALF_PI = Math.PI / 2;

/**
 * A round room: a full circle of wall (radius `r` to the middle of the wall) with a doorway `door` m wide each side
 * of south and windows `win` m wide each side of east, north and west, each with its trim.
 */
function roundRoom(cx: number, cz: number, r: number, doorHalf: number, winHalf: number): LocalBox[] {
  const door = doorHalf / r; // half the doorway angle
  const win = winHalf / r;
  const south = -HALF_PI;
  const solids: LocalBox[] = [];
  // Wall runs between the doorway (south) and three windows (east, north, west).
  const openings = [south, 0, HALF_PI, Math.PI];
  for (let i = 0; i < 4; i++) {
    const a = openings[i]! + (i === 0 ? door : win);
    const b = (i === 3 ? south + 2 * Math.PI : openings[i + 1]!) - (i === 3 ? door : win);
    solids.push(...arc(cx, cz, r, a, b, pieces(r, b - a), 0, 4), ...arcTrim(cx, cz, r, a, b));
  }
  solids.push(...arc(cx, cz, r, south - door, south + door, 3, 3.2, 4));
  for (const a of [0, HALF_PI, Math.PI]) solids.push(...arc(cx, cz, r, a - win, a + win, 2, 0, 1), ...arc(cx, cz, r, a - win, a + win, 2, 2.4, 4));
  return solids;
}

// ---------------------------------------------------------------- the kit as data

type Pair = readonly [number, number];

/**
 * One part of a kit tile, as content/tiles/core.json lists it: the builder it names and that builder's numbers.
 * `kind` (which theme slot paints it), `yaw` and `surface` (a library material of its own) apply to what it builds.
 */
export type KitPart = { kind?: NonNullable<LocalBox['kind']>; yaw?: number; pitch?: number; roll?: number; surface?: LocalBox['surface'] } & (
  | { box: readonly [number, number, number, number, number, number] }
  | { flight: { axis: 'x' | 'z'; dir: 1 | -1; from: number; across: Pair; steps: number; base?: number; run?: number; floor?: number } }
  | { descending: { edge: number; across: Pair; steps: number; top: number; floor?: number; run?: number } }
  | { rail: { from: Pair; to: Pair; y?: number } }
  | { columns: { at: readonly Pair[]; half: number; y: Pair } }
  | { partition: { axis: 'x' | 'z'; at: number; from: number; to: number; gaps?: readonly Pair[]; y?: Pair; t?: number } }
  | { lamp: { at: Pair; dir: 1 | -1 } }
  | { arc: { centre: Pair; r: number; turns: Pair; pieces?: number; y: Pair; t?: number } }
  | { arcTrim: { centre: Pair; r: number; turns: Pair; height?: number } }
  | { arcade: { centre: Pair; r: number; turns: Pair; bays: number; height?: number } }
  | { roundRoom: { centre: Pair; r: number; door: number; window: number } }
  | { discStrips: { centre: Pair; r: number; strips: number; width: number; y: Pair } }
  | { spiral: { centre: Pair; r: Pair; turns: Pair; steps: number; height: number; base?: number; slab?: number; solid?: Pair } }
  | { vault: { axis: 'x' | 'z'; span: Pair; along: Pair; spring: number; crown: number; pieces?: number; t?: number } }
  | { block: { across: number; height: number } }
  | { turned: TurnedPart }
  | { wallRun: WallRunPart }
);

/**
 * A group of any parts turned about a pivot by any yaw (the kit's `turned`): flights, vaults, columns and rails at
 * 45°. Each box's centre turns about the pivot and the yaw adds to its own, so the boxes keep their size; on a whole
 * number of quarter turns a plain box stays a plain box (its corners turned), so 90° is exactly the group built that
 * way. `yaw` is in radians, or `turns` in quarter turns (0.5 = 45°), the same way as a tile's R and a box's `yaw`
 * (+x towards -z). The pivot is [x, z] in the tile's frame (default the first cell's centre).
 */
export interface TurnedPart {
  yaw?: number;
  turns?: number;
  pivot?: Pair;
  parts: readonly KitPart[];
}

/**
 * A wall built from an edge style along any segment, not only a cell's side (the kit's `wallRun`): the style's
 * collision (map/edgeShapes.ts edgeSegments) and its trim, `bays` times along the segment from `from` to `to`
 * ([x, z]; each bay a side of its own, so "half" is half a bay), from `y` up on a level `height` high (default 4).
 * The segment is the wall's outer face, its thickness on the `side` of it looking from `from` to `to` (`left`, the
 * default, as a cell's side has it with the cell on the left; `right`; or `centre`, on the line). `outer` (default
 * true) dresses the outer face too, as a side with nothing built beyond. `plain`: an arch's collision is its piers and
 * one lintel over the crown; the steps over the curve are drawn in the walls' paint but never collide (the arch looks
 * the same). Along a cell's side, at a quarter turn, it builds exactly what that side does.
 */
export interface WallRunPart {
  from: Pair;
  to: Pair;
  style: Exclude<EdgeStyle, 'auto' | 'open'>;
  bays?: number;
  y?: number;
  height?: number;
  side?: 'left' | 'right' | 'centre';
  outer?: boolean;
  plain?: boolean;
}

/** Whether a yaw is a whole number of quarter turns, and which. */
function quarterOf(yaw: number): number | null {
  const q = yaw / HALF_PI;
  const r = Math.round(q);
  return Math.abs(q - r) < 1e-9 ? ((r % 4) + 4) % 4 : null;
}

/** Tidy a coordinate: round off what turning leaves (to the micrometre) and -0, so turned copies compare exactly. */
const tidy = (v: number): number => Math.round(v * 1e6) / 1e6 + 0;

/**
 * Boxes turned by `yaw` about (px, pz): each centre turns and the yaw adds to its own (the kit's `turned`). A plain
 * box on a whole number of quarter turns stays plain, its corners turned (map/geometry.ts rotateXZ's way round).
 */
export function turnBoxes(boxes: readonly LocalBox[], yaw: number, px = 0, pz = 0): LocalBox[] {
  const q = quarterOf(yaw);
  const c = q === null ? Math.cos(yaw) : [1, 0, -1, 0][q]!;
  const s = q === null ? Math.sin(yaw) : [0, 1, 0, -1][q]!;
  // The same turn as yawXZ (map/geometry.ts): +x goes to (cos, -sin).
  const turn = (x: number, z: number): [number, number] => [px + (x - px) * c + (z - pz) * s, pz - (x - px) * s + (z - pz) * c];
  return boxes.map((b) => {
    if (q === 0) return b;
    if (q !== null && !b.yaw && !b.pitch && !b.roll) {
      const [ax, az] = turn(b.min[0], b.min[2]);
      const [bx, bz] = turn(b.max[0], b.max[2]);
      return { ...b, min: [tidy(Math.min(ax, bx)), b.min[1], tidy(Math.min(az, bz))], max: [tidy(Math.max(ax, bx)), b.max[1], tidy(Math.max(az, bz))] };
    }
    const hx = (b.max[0] - b.min[0]) / 2;
    const hz = (b.max[2] - b.min[2]) / 2;
    const [mx, mz] = turn((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
    const own = (b.yaw ?? 0) + yaw;
    const { yaw: _y, ...rest } = b;
    // A box that ends on a whole number of quarter turns (two 45° turns) is a plain box again, its sides swapped on an odd one.
    const ends = b.pitch || b.roll ? null : quarterOf(own);
    const [ex, ez] = ends !== null && ends % 2 === 1 ? [hz, hx] : [hx, hz];
    if (ends !== null) return { ...rest, min: [tidy(mx - ex), b.min[1], tidy(mz - ez)], max: [tidy(mx + ex), b.max[1], tidy(mz + ez)] };
    return { ...rest, min: [mx - hx, b.min[1], mz - hz], max: [mx + hx, b.max[1], mz + hz], yaw: own };
  });
}

/** Whether a placed tile draws anything in its `metal` surface: a side of bars or a barred gate (its own or its defaults'). */
export function tileHasMetal(def: Pick<TileDefinition, 'edgeDefault' | 'edgeDefaults'> | undefined, placement: { edges?: Readonly<Record<string, string>> | undefined }): boolean {
  const metal = (s: string | undefined) => !!s && s !== 'auto' && s !== 'open' && !!edgePaint(s as Parameters<typeof edgePaint>[0]);
  return Object.values(placement.edges ?? {}).some(metal) || metal(def?.edgeDefault) || Object.values(def?.edgeDefaults ?? {}).some(metal);
}

/**
 * The boxes of a wall run (WallRunPart) in the tile's frame: each bay built along +x with its thickness towards +z
 * (a cell's south side, the cell to the north), then mirrored for `right`, moved onto the segment and turned along it.
 */
export function wallRunBoxes(w: WallRunPart, kind: NonNullable<LocalBox['kind']> = 'wall'): LocalBox[] {
  const [x0, z0] = w.from;
  const [x1, z1] = w.to;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const bays = Math.max(1, Math.round(w.bays ?? 1));
  if (!(len > 0)) return [];
  const half = len / bays / 2;
  const height = w.height ?? 4;
  const base = w.y ?? 0;
  const segs = edgeSegments(w.style, half, height);
  const metal = edgePaint(w.style);
  const thick = Math.max(0, ...segs.map((g) => g[4]));
  // Across the wall: v in from the outer face; `right` mirrors it, `centre` puts the line through the middle.
  const across = (v0: number, v1: number): [number, number] => (w.side === 'right' ? [-v1, -v0] : w.side === 'centre' ? [v0 - thick / 2, v1 - thick / 2] : [v0, v1]);
  const bay: LocalBox[] = [];
  const raised = segs.filter((g) => g[2] > 1e-6);
  const plain = !!w.plain && raised.length > 1;
  for (const g of segs) {
    const [u0, u1, y0, y1, t] = g;
    const [v0, v1] = across(0, t);
    const b: LocalBox = { min: [u0, base + y0, v0], max: [u1, base + y1, v1] };
    // A plain arch: the steps over the curve are drawn (in the walls' paint) but never collide; one lintel does.
    bay.push(plain && y0 > 1e-6 ? { ...b, kind: 'trim', paint: 'walls' } : { ...b, kind, ...(metal ? { paint: metal } : {}), ...(edgeLattice(w.style, g) ? { lattice: true as const } : {}) });
  }
  if (plain) {
    const [v0, v1] = across(0, Math.max(...raised.map((g) => g[4])));
    const top = Math.max(...raised.map((g) => g[3]));
    const crown = Math.max(...raised.map((g) => g[2]));
    bay.push({ min: [Math.min(...raised.map((g) => g[0])), base + crown, v0], max: [Math.max(...raised.map((g) => g[1])), base + top, v1], kind });
  }
  for (const p of edgeTrimBoxes(w.style, half, height, w.outer ?? true)) {
    const [v0, v1] = across(p.v0, p.v1);
    bay.push({ min: [p.u0, base + p.y0, v0], max: [p.u1, base + p.y1, v1], kind: 'trim', ...(p.tilt ? { roll: p.tilt } : {}), ...(p.surface ? { surface: p.surface } : metal ? { paint: metal } : {}) });
  }
  // Each bay along the segment, then the whole run turned from +x onto it about its start.
  const yaw = Math.atan2(-(z1 - z0), x1 - x0);
  const out: LocalBox[] = [];
  for (let i = 0; i < bays; i++) {
    const at = x0 + (2 * i + 1) * half;
    for (const b of bay) out.push({ ...b, min: [b.min[0] + at, b.min[1], b.min[2] + z0], max: [b.max[0] + at, b.max[1], b.max[2] + z0] });
  }
  return turnBoxes(out, yaw, x0, z0);
}

/** A port, or every side of the first cell on a level, or the perimeter of a w × d footprint on some levels. */
export type PortSpec = TilePort | { allSides: number } | { perimeter: Pair; levels?: readonly number[] };

/** A kit tile as data (content/tiles/core.json, generated into content/kitTiles.generated.ts). */
export interface TileSpec extends Omit<TileDefinition, 'cells' | 'ports' | 'solids' | 'extraFloors'> {
  cells?: TileDefinition['cells'];
  /** [w, d] or [w, d, levels]: every cell of that block, instead of listing `cells`. */
  footprint?: readonly number[];
  ports: readonly PortSpec[];
  solids?: readonly KitPart[];
  extraFloors?: readonly KitPart[];
}

/** The boxes one part builds (local frame), from the shared kit's builders. */
function kitPart(p: KitPart, spec: TileSpec): LocalBox[] {
  // A part's own library material goes on every box it builds (a box, a timber flight), not only on plain boxes.
  const dressed = kitPartBoxes(p, spec);
  return p.surface && !('box' in p) ? dressed.map((b) => ({ ...b, surface: p.surface })) : dressed;
}

function kitPartBoxes(p: KitPart, spec: TileSpec): LocalBox[] {
  const turns = (t: Pair): [number, number] => [t[0] * HALF_PI, t[1] * HALF_PI];
  let out: LocalBox[];
  if ('box' in p) {
    const [x0, y0, z0, x1, y1, z1] = p.box;
    const b: LocalBox = { min: [x0, y0, z0], max: [x1, y1, z1] };
    return [{ ...b, ...(p.yaw !== undefined ? { yaw: p.yaw } : {}), ...(p.pitch !== undefined ? { pitch: p.pitch } : {}), ...(p.roll !== undefined ? { roll: p.roll } : {}), ...(p.kind ? { kind: p.kind } : {}), ...(p.surface ? { surface: p.surface } : {}) }];
  } else if ('flight' in p) {
    const f = p.flight;
    out = flight(f.axis, f.dir, f.from, f.across[0], f.across[1], f.steps, f.base ?? 0, f.run ?? 0.5, f.floor ?? 0);
  } else if ('descending' in p) {
    const d = p.descending;
    out = descending(d.edge, d.across[0], d.across[1], d.steps, d.top, d.floor ?? 0, d.run ?? 0.5);
  } else if ('rail' in p) out = [rail(p.rail.from[0], p.rail.from[1], p.rail.to[0], p.rail.to[1], p.rail.y ?? 0)];
  else if ('columns' in p) {
    const { half: h, y } = p.columns;
    out = p.columns.at.map(([x, z]) => box(x - h, y[0], z - h, x + h, y[1], z + h));
  } else if ('partition' in p) {
    const w = p.partition;
    out = partition(w.axis, w.at, w.from, w.to, w.gaps ?? [], w.y?.[0] ?? 0, w.y?.[1] ?? 3.5, w.t ?? 0.12);
  } else if ('lamp' in p) out = lamp(p.lamp.at[0], p.lamp.at[1], p.lamp.dir);
  else if ('arc' in p) {
    const a = p.arc;
    const [a0, a1] = turns(a.turns);
    // An arc is wall unless the part says otherwise.
    return arc(a.centre[0], a.centre[1], a.r, a0, a1, a.pieces ?? pieces(a.r, a1 - a0), a.y[0], a.y[1], a.t ?? TILE_DIMENSIONS.wallThickness, p.kind ?? 'wall');
  } else if ('arcTrim' in p) {
    const a = p.arcTrim;
    const [a0, a1] = turns(a.turns);
    out = arcTrim(a.centre[0], a.centre[1], a.r, a0, a1, a.height ?? 4);
  } else if ('arcade' in p) {
    const a = p.arcade;
    const [a0, a1] = turns(a.turns);
    out = arcade(a.centre[0], a.centre[1], a.r, a0, a1, a.bays, a.height ?? 4);
  } else if ('roundRoom' in p) {
    const a = p.roundRoom;
    out = roundRoom(a.centre[0], a.centre[1], a.r, a.door, a.window);
  } else if ('vault' in p) {
    const v = p.vault;
    // A vault is wall (it takes the walls' paint) unless the part says otherwise.
    return vault(v.axis, v.span, v.along, v.spring, v.crown, v.pieces ?? 12, v.t ?? 0.2, p.kind ?? 'wall');
  } else if ('turned' in p) {
    // A group turned about its pivot: the parts keep their own kinds unless this part names one (trim stays trim).
    const t = p.turned;
    const yaw = t.yaw ?? (t.turns ?? 0) * HALF_PI;
    const inner = t.parts.flatMap((q) => kitPart(q, spec));
    const turned = turnBoxes(inner, yaw, t.pivot?.[0] ?? 0, t.pivot?.[1] ?? 0);
    return p.kind ? turned.map((b) => (b.kind === 'trim' ? b : { ...b, kind: p.kind })) : turned;
  } else if ('wallRun' in p) {
    // A wall run is wall (it takes the walls' paint) unless the part says otherwise; its trim stays trim.
    return wallRunBoxes(p.wallRun, p.kind ?? 'wall');
  } else if ('spiral' in p) {
    // A spiral stair's treads; `turns` is [start, sweep] in quarter turns (a negative sweep climbs clockwise).
    const a = p.spiral;
    out = spiral(a.centre[0], a.centre[1], a.r[0], a.r[1], a.turns[0] * HALF_PI, a.turns[1] * HALF_PI, a.steps, a.height, a.base ?? 0, a.slab ?? 0.35, a.solid);
  } else if ('discStrips' in p) {
    // A half-disc floor in strips (z from the centre outward), each as wide as the circle there.
    const { centre: [cx, cz], r, strips, width, y } = p.discStrips;
    out = [];
    for (let j = 0; j < strips; j++) {
      const z0 = cz + j * width;
      const w = Math.sqrt(Math.max(0, r * r - (z0 - cz) * (z0 - cz)));
      out.push(box(cx - w, y[0], z0, cx + w, y[1], z0 + width));
    }
  } else {
    // A block centred on the tile's footprint (a model's collision).
    const [w = 1, d = 1] = spec.footprint ?? [];
    const cx = ((w - 1) * 8) / 2;
    const cz = ((d - 1) * 8) / 2;
    const h = p.block.across / 2;
    out = [{ min: [cx - h, 0, cz - h], max: [cx + h, p.block.height, cz + h] }];
  }
  return p.kind ? out.map((b) => ({ ...b, kind: p.kind })) : out;
}

/** A kit tile from its data: its cells, ports and parts built (map/catalog.ts's builders; tools/content/tiles.mjs checks the data). */
export function resolveKitTile(spec: TileSpec): TileDefinition {
  // Keys in the data's order (a palette picture's hash is the definition's JSON: tools/content/palette-items.ts).
  const def: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(spec)) {
    if (k === 'footprint') {
      const fp = v as readonly number[];
      def.cells = footprint(fp[0]!, fp[1]!, fp[2] ?? 1);
    } else if (k === 'ports') def.ports = spec.ports.flatMap((p): TilePort[] => ('allSides' in p ? SIDES.map((side) => ({ side, level: p.allSides })) : 'perimeter' in p ? perimeterPorts(p.perimeter[0], p.perimeter[1], p.levels ?? [0]) : [p]));
    else if (k === 'solids' || k === 'extraFloors') def[k] = (v as readonly KitPart[]).flatMap((p) => kitPart(p, spec));
    else def[k] = v;
  }
  return def as unknown as TileDefinition;
}

// Built in a pure call: a module that reads only catalog's helpers can drop the tables (docs/LOADING.md).
export const CORE_TILES: readonly TileDefinition[] = /* @__PURE__ */ (() => [
  // The core building kit (content/tiles/core.json): rooms, corridors, stairs, open ground, buildings, curves,
  // the city pieces and the 04 Orbital Station / 07 Neon Megacity pieces.
  ...KIT_TILES.map(resolveKitTile),
  // Style Pack pieces drawn in code (01 Military Compound, 02 Frontier Dust): see packTiles.ts and editor/stylePacks.ts.
  ...boxPackTiles(),
  // Style Pack pieces (05 Gothic Estate, 06 Jungle Ruins, 08 Suburban Chaos): see packTiles2.ts.
  ...boxPackTiles2(),
  // Style Pack pieces (03 Imperial Arena, 09 Sands of Egypt): see packTilesAncient.ts.
  ...ancientPackTiles(),
  // Style Pack pieces (10 Medieval Village): see packTilesMedieval.ts.
  ...medievalPackTiles(),
  // Style Pack pieces (11 Coastal Harbor): see packTilesHarbor.ts.
  ...harborPackTiles(),
  // Style Pack pieces (12 Snow Outpost): see packTilesSnow.ts.
  ...snowPackTiles(),
  // Style Pack pieces (09 Desert City, in Sands of Egypt's place; the Egypt tiles above stay): see packTilesDesert.ts.
  ...desertPackTiles(),
  // Style Pack pieces (the 06 Jungle Ruins refresh, Ancient Temple folded in): see packTilesJungle.ts.
  ...junglePackTiles(),
  // Style Pack pieces (13 Industrial Factory): see packTilesIndustrial.ts.
  ...industrialPackTiles(),
  // Style Pack pieces (04 Orbital Station's research base; its Hangar Bay and Reactor Hall are kit tiles in content/tiles/core.json): see packTilesOrbital.ts.
  ...orbitalPackTiles(),
])();

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

/** A street lamp: a pole with an arm reaching over the road (`dir` +1 east, -1 west); the arm and lantern are trim. */
function lamp(x: number, z: number, dir: 1 | -1): LocalBox[] {
  const trim = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): LocalBox => ({ ...box(x0, y0, z0, x1, y1, z1), kind: 'trim' });
  return [box(x - 0.1, 0, z - 0.1, x + 0.1, 4.6, z + 0.1), trim(Math.min(x, x + dir * 1.4), 4.4, z - 0.06, Math.max(x, x + dir * 1.4), 4.55, z + 0.06), trim(x + dir * 1.2 - 0.25, 4.2, z - 0.18, x + dir * 1.2 + 0.25, 4.4, z + 0.18)];
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

  private families: Map<string, TileDefinition[]> | null = null;

  /** The material families a tile comes in (the tunnel kit: the tiles sharing its shape), its own shape's first family first; empty for a tile with none. */
  familiesOf(tile: string): TileDefinition[] {
    if (!this.families) {
      this.families = new Map();
      for (const d of this.byId.values()) {
        if (!d.familyOf) continue;
        const list = this.families.get(d.familyOf.base);
        // (The shape's own first family first, whatever order the kit lists its tiles in.)
        if (list) d.id === d.familyOf.base ? list.unshift(d) : list.push(d);
        else this.families.set(d.familyOf.base, [d]);
      }
    }
    const base = this.byId.get(tile)?.familyOf?.base;
    return base ? (this.families.get(base) ?? []) : [];
  }

  /**
   * The tile a placement is drawn as: its own, or that shape in the placement's `family` (map format v37). The two
   * have the same cells, ports, collision and bore, so everything but the drawing can go by `get(placement.tile)`.
   */
  drawn(placement: { tile: string; family?: string | undefined }): TileDefinition | undefined {
    const own = this.byId.get(placement.tile);
    if (!placement.family || !own?.familyOf || own.familyOf.family === placement.family) return own;
    return this.familiesOf(placement.tile).find((d) => d.familyOf!.family === placement.family) ?? own;
  }
}

export const coreCatalog = /* @__PURE__ */ new TileCatalog();
