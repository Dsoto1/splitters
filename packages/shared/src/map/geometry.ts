import { PLAYER } from '../sim/constants.ts';
import { MODEL_FACADES, SIDES, SIDE_DIRS, TILE_DIMENSIONS, coreCatalog, floorInsertBoxes, footprintSize, roomLayoutBoxes, seededRandom, vault, type Corner, type EdgeArch, type EdgeRepeat, type EdgeShape, type EdgeStyle, type EdgeValue, type Facade, type LocalBox, type Side, type TileCatalog, type TileDefinition } from './catalog.ts';
import type { MapDocument, MapEntity, TilePlacement } from './schema.ts';
import { logicTargets } from './logic.ts';
import { getProp } from '../content/props.ts';
import { terrainBoundary, terrainTriangles } from './terrain.ts';
import { resolveBackdrop } from './backdrop.ts';
import { borderBoxes, borderFloor, electricFenceBoxes, hasBorder } from './border.ts';
import { pathsExtent } from './paths.ts';
import { CORNER_EDGE_STYLES, EDGE_SHAPES, FACADE_EDGE_STYLES, STREET_EDGE_STYLES } from '../content/edgeStyles.generated.ts';

/**
 * `trim` boxes are visual only (baseboards, cornices, frames): never in physics
 * or navigation. `prop` boxes are the collision of placed props: physics and
 * navigation only, the prop's model is drawn instead. `barrier` boxes are
 * invisible walls (round terrain): physics and navigation only.
 */
export type BoxKind = 'floor' | 'wall' | 'solid' | 'trim' | 'prop' | 'barrier';

/** World-space axis-aligned box. Shared by physics, navigation and rendering. */
export interface WorldBox {
  min: [number, number, number];
  max: [number, number, number];
  kind: BoxKind;
  /** Placement that produced this box, for editor focus and debugging. */
  sourceId: string;
  /**
   * Turn about the vertical axis through the box centre (radians; see
   * `yawXZ`). min/max then give the box's size and centre before turning.
   * Curved walls, arches and balconies are built from turned boxes.
   */
  yaw?: number;
  /**
   * Tilt of pitched free blocks (v20), applied before the yaw: pitch about the
   * box's own X axis (+Z end rises), roll about its own Z axis (+X end rises).
   */
  pitch?: number;
  roll?: number;
  /** Material for every face (free blocks), instead of the theme's. */
  surface?: { material: string; tint: string | null };
  /** A room's roof slab (room option Ceiling): its top is painted as the tile's `roof` surface. */
  roof?: true;
}

/** Turn an (x, z) offset by `yaw` about +Y (right-handed, the same as physics and the renderer). */
export function yawXZ(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

export interface Rot {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Rotation of a turned and tilted box: yaw (about +Y) after pitch (about X) after roll (about Z). Same in physics and rendering. */
export function boxQuat(yaw = 0, pitch = 0, roll = 0): Rot {
  const sy = Math.sin(yaw / 2);
  const cy = Math.cos(yaw / 2);
  // Positive pitch lifts the +Z end (a standard turn about +X would lower it).
  const sp = Math.sin(-pitch / 2);
  const cp = Math.cos(pitch / 2);
  const sr = Math.sin(roll / 2);
  const cr = Math.cos(roll / 2);
  // qY * qX
  const a = { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp };
  // (qY * qX) * qZ
  return { x: a.x * cr + a.y * sr, y: a.y * cr - a.x * sr, z: a.w * sr + a.z * cr, w: a.w * cr - a.z * sr };
}

export function quatMul(a: Rot, b: Rot): Rot {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** Rotate the vector (x, y, z) by a unit quaternion. */
export function quatRotate(q: Rot, x: number, y: number, z: number): [number, number, number] {
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (q.y * z - q.z * y);
  const ty = 2 * (q.z * x - q.x * z);
  const tz = 2 * (q.x * y - q.y * x);
  return [x + q.w * tx + (q.y * tz - q.z * ty), y + q.w * ty + (q.z * tx - q.x * tz), z + q.w * tz + (q.x * ty - q.y * tx)];
}

/** Whether a box is tilted (pitched or rolled), not just turned. */
export const isTilted = (b: Pick<WorldBox, 'pitch' | 'roll'>): boolean => !!(b.pitch || b.roll);

/** A box's 8 corners in world space; corner i has bit0 → max x, bit1 → max y, bit2 → max z (in the box's own frame). */
export function boxCorners(b: Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll'>): [number, number, number][] {
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const out: [number, number, number][] = [];
  if (isTilted(b)) {
    const cy = (b.min[1] + b.max[1]) / 2;
    const q = boxQuat(b.yaw, b.pitch, b.roll);
    for (let i = 0; i < 8; i++) {
      const [x, y, z] = quatRotate(q, (i & 1 ? b.max[0] : b.min[0]) - cx, (i & 2 ? b.max[1] : b.min[1]) - cy, (i & 4 ? b.max[2] : b.min[2]) - cz);
      out.push([cx + x, cy + y, cz + z]);
    }
    return out;
  }
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? b.max[0] : b.min[0];
    const y = i & 2 ? b.max[1] : b.min[1];
    const z = i & 4 ? b.max[2] : b.min[2];
    if (!b.yaw) out.push([x, y, z]);
    else {
      const [rx, rz] = yawXZ(x - cx, z - cz, b.yaw);
      out.push([cx + rx, y, cz + rz]);
    }
  }
  return out;
}

/** A box's outline seen from above, as four (x, z) corners in order round the edge. */
export function boxFootprint(b: Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll'>): [number, number][] {
  const c = boxCorners(b);
  return [c[0]!, c[1]!, c[5]!, c[4]!].map((p) => [p[0], p[2]] as [number, number]);
}

/** World-axis bounds of a (possibly turned) box. */
export function boxBounds(b: Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll'>): { min: [number, number, number]; max: [number, number, number] } {
  if (isTilted(b)) {
    const c = boxCorners(b);
    const axis = (k: 0 | 1 | 2) => c.map((p) => p[k]);
    return { min: [Math.min(...axis(0)), Math.min(...axis(1)), Math.min(...axis(2))], max: [Math.max(...axis(0)), Math.max(...axis(1)), Math.max(...axis(2))] };
  }
  if (!b.yaw) return { min: [...b.min], max: [...b.max] };
  const f = boxFootprint(b);
  const xs = f.map((p) => p[0]);
  const zs = f.map((p) => p[1]);
  return { min: [Math.min(...xs), b.min[1], Math.min(...zs)], max: [Math.max(...xs), b.max[1], Math.max(...zs)] };
}

type XYZ = { x: number; y: number; z: number };

/** World-axis bounds of each box of a list (min xyz, max xyz), worked out once per list. */
const boundsOf = new WeakMap<readonly WorldBox[], Float64Array>();
function listBounds(boxes: readonly WorldBox[]): Float64Array {
  let out = boundsOf.get(boxes);
  if (out) return out;
  out = new Float64Array(boxes.length * 6);
  boxes.forEach((b, i) => {
    const { min, max } = b.yaw || b.pitch || b.roll ? boxBounds(b) : b;
    out!.set([min[0], min[1], min[2], max[0], max[1], max[2]], i * 6);
  });
  boundsOf.set(boxes, out);
  return out;
}

/**
 * Distance along a normalised ray to the first of `boxes` it enters from outside (a turned or tilted box counts as
 * its world-axis bounds), or null within maxDist. For solids a PhysicsWorld doesn't hold when the navmesh is built:
 * the scenario's breakable props and moving or breaking blocks (the navigation audit's falls and drop links, jump
 * pads' landings).
 */
export function boxesRay(boxes: readonly WorldBox[], o: XYZ, d: XYZ, maxDist: number): number | null {
  if (!boxes.length) return null;
  const bb = listBounds(boxes);
  let best: number | null = null;
  for (let i = 0; i < boxes.length; i++) {
    let t0 = 0;
    let t1 = best ?? maxDist;
    let hit = true;
    for (let a = 0; a < 3 && hit; a++) {
      const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
      const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
      const lo = bb[i * 6 + a]!;
      const hi = bb[i * 6 + 3 + a]!;
      if (Math.abs(da) < 1e-9) {
        if (oa < lo || oa > hi) hit = false;
        continue;
      }
      let ta = (lo - oa) / da;
      let tb = (hi - oa) / da;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) hit = false;
    }
    if (hit && (best === null || t0 < best)) best = t0;
  }
  return best;
}

/** Whether any of `boxes` (a turned or tilted one as its world-axis bounds) overlaps the upright box at `c` with half-size `half`. */
export function boxesOverlap(boxes: readonly WorldBox[], c: XYZ, half: XYZ): boolean {
  if (!boxes.length) return false;
  const bb = listBounds(boxes);
  for (let i = 0; i < boxes.length; i++) {
    const k = i * 6;
    if (c.x + half.x > bb[k]! && c.x - half.x < bb[k + 3]! && c.y + half.y > bb[k + 1]! && c.y - half.y < bb[k + 4]! && c.z + half.z > bb[k + 2]! && c.z - half.z < bb[k + 5]!) return true;
  }
  return false;
}

export interface CellOccupant {
  placement: TilePlacement;
  def: TileDefinition;
  /** Local dz of the tile cell occupying this grid cell. */
  level: number;
  /** The tile cell (local [dx, dy, dz]) occupying this grid cell. */
  local: readonly [number, number, number];
}

export const cellKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export function rotateSide(side: Side, rotation: number): Side {
  return SIDES[(SIDES.indexOf(side) + rotation) % 4]!;
}

/** Rotate a local (x, z) offset clockwise by `rotation` quarter turns. */
export function rotateXZ(x: number, z: number, rotation: number): [number, number] {
  let rx = x;
  let rz = z;
  for (let i = 0; i < rotation % 4; i++) [rx, rz] = [rz, -rx];
  // Normalise -0 so cell keys stay stable.
  return [rx + 0, rz + 0];
}

const OPPOSITE: Record<Side, Side> = { N: 'S', E: 'W', S: 'N', W: 'E' };

/** Build the grid occupancy map. Overlapping cells are returned separately for validation. */
export function buildOccupancy(
  map: MapDocument,
  catalog: TileCatalog = coreCatalog,
): { cells: Map<string, CellOccupant>; overlaps: { key: string; ids: [string, string] }[]; unknownTiles: TilePlacement[] } {
  const cells = new Map<string, CellOccupant>();
  const overlaps: { key: string; ids: [string, string] }[] = [];
  const unknownTiles: TilePlacement[] = [];
  for (const placement of map.classicStructure.tiles) {
    const def = catalog.get(placement.tile);
    if (!def) {
      unknownTiles.push(placement);
      continue;
    }
    for (const [dx, dy, dz] of def.cells) {
      const [rx, ry] = rotateXZ(dx, dy, placement.rotation);
      const key = cellKey(placement.x + rx, placement.y + ry, placement.z + dz);
      const existing = cells.get(key);
      if (existing) {
        overlaps.push({ key, ids: [existing.placement.id, placement.id] });
        continue;
      }
      cells.set(key, { placement, def, level: dz, local: [dx, dy, dz] });
    }
  }
  return { cells, overlaps, unknownTiles };
}

function hasPort(occ: CellOccupant, worldSide: Side): boolean {
  const [cx, cy] = occ.local;
  return occ.def.ports.some((p) => p.level === occ.level && (p.cell?.[0] ?? 0) === cx && (p.cell?.[1] ?? 0) === cy && rotateSide(p.side, occ.placement.rotation) === worldSide);
}

/** Key of one side of one tile cell in a placement's `edges`, in the tile's own (unrotated) frame. */
export const edgeKey = (local: readonly [number, number, number], localSide: Side): string => `${local[0]},${local[1]},${local[2]}:${localSide}`;

/** The tile-local side that faces `worldSide` after the placement's rotation. */
export const localSide = (worldSide: Side, rotation: number): Side => SIDES[(SIDES.indexOf(worldSide) - (rotation % 4) + 4) % 4]!;

/** A cell's four sides as [tile-local edge key, world side]. */
export const cellSides = (occ: CellOccupant): [string, Side][] => SIDES.map((side) => [edgeKey(occ.local, localSide(side, occ.placement.rotation)), side]);

/** A tile cell's key in the piece's own frame ("dx,dy,dz"), as `upperFloors` stores it. */
export const localCellKey = (local: readonly number[]): string => `${local[0]},${local[1]},${local[2]}`;

/**
 * Whether a piece can take a floor of its own in one of its cells (MapMaker's "Floor on Level N", `upperFloors`):
 * an upper storey the piece leaves without a full floor. Not the bottom storey (pits, bridges and sunken rooms are
 * floorless on purpose), not stairs, ramps, towers or lifts (their upper storey is the way up), and not buildings
 * drawn from a model (their storeys are in the model).
 */
export function canAddFloor(def: TileDefinition, local: readonly number[]): boolean {
  if (def.model || def.category === 'Vertical') return false;
  const bottom = Math.min(...def.cells.map((c) => c[2]));
  return local[2]! > bottom && !def.floors.includes(local[2]!) && def.cells.some((c) => c[0] === local[0] && c[1] === local[1] && c[2] === local[2]);
}

/** Whether a cell gets a full floor slab: one its piece came with, or one added in MapMaker. */
export function cellSlab(occ: CellOccupant): boolean {
  if (occ.def.floors.includes(occ.level)) return true;
  const added = occ.placement.upperFloors;
  return !!added?.length && added.includes(localCellKey(occ.local)) && canAddFloor(occ.def, occ.local);
}

/** Whether a cell has walkable floor of its own (a full slab or partial floors). */
export function cellHasFloor(occ: CellOccupant): boolean {
  return cellSlab(occ) || !!occ.def.extraFloors?.length;
}

/**
 * What gets built on one side of one cell: `none` (no wall: open ground, the
 * inside of a multi-cell tile, or a side left open), or one of the edge styles.
 */
export type ResolvedEdge = Exclude<EdgeStyle, 'auto' | 'open'> | 'none';

/**
 * Resolve a cell side: the cell's own choice for that side, else the
 * neighbour's choice for the shared side, else the classic rule (doorway where
 * ports meet, nothing between open tiles, otherwise the tile's default edge).
 */
export function resolveEdge(cells: Map<string, CellOccupant>, x: number, y: number, z: number, side: Side): ResolvedEdge {
  const here = cells.get(cellKey(x, y, z));
  if (!here) return 'none';
  const [dx, dy] = SIDE_DIRS[side];
  const there = cells.get(cellKey(x + dx, y + dy, z));
  if (there && there.placement === here.placement) return 'none';
  // Nothing is built against a whole city building (a solid model with no doorways).
  if (here.def.model && !here.def.ports.length) return 'none';
  if (there?.def.model && !there.def.ports.length) return 'none';
  const choice = (occ: CellOccupant | undefined, s: Side) => occ?.placement.edges?.[edgeKey(occ.local, localSide(s, occ.placement.rotation))];
  const picked = choice(here, side) ?? choice(there, OPPOSITE[side]);
  const fallback = here.def.edgeDefaults?.[edgeKey(here.local, localSide(side, here.placement.rotation))] ?? here.def.edgeDefault ?? 'wall';
  const openish = fallback === 'open' || !!(fallback !== 'auto' && EDGE_SHAPES[fallback]?.openDefault);
  let style: EdgeStyle = picked ?? 'auto';
  if (style === 'auto') {
    // Ports meeting: nothing between open ground, no frame of its own on a platform or bridge, else a doorway.
    if (isOpenEdge(cells, x, y, z, side)) style = (here.def.open && there?.def.open) || openish ? 'open' : 'door';
    else style = fallback;
  }
  return style === 'open' || style === 'auto' ? 'none' : style;
}

/** The shape of a built edge style (content/tiles/edges.json); none for `none`. */
const shapeOf = (style: ResolvedEdge): EdgeShape | undefined => (style === 'none' ? undefined : EDGE_SHAPES[style]);

/** An edge value along a side `half` long each way from its middle, on a level `height` high. */
function edgeValue(v: EdgeValue, half: number, height: number): number {
  if (typeof v === 'number') return v;
  if ('upTo' in v) return Math.min(v.upTo, height);
  const [x, k] = 'half' in v ? [half, v.half] : [height, v.height];
  const base = k === 1 ? x : k === -1 ? -x : x * k;
  return v.add === undefined ? base : base + v.add;
}

/** Each position of a repeat along a side. */
function repeatAlong(r: EdgeRepeat, half: number, height: number, at: (u: number) => void): void {
  const from = edgeValue(r.from, half, height);
  const to = edgeValue(r.to, half, height);
  if (r.through) for (let u = from; u <= to + 1e-6; u += r.step) at(u);
  else for (let u = from; u < to; u += r.step) at(u);
}

/** Wall pieces of an edge style along one side: [u0, u1, y0, y1, thickness] with u along the side (-half..half). */
export function edgeSegments(style: ResolvedEdge, half: number, height: number): [number, number, number, number, number][] {
  const out: [number, number, number, number, number][] = [];
  const v = (x: EdgeValue) => edgeValue(x, half, height);
  for (const s of shapeOf(style)?.segments ?? []) {
    const t = s.t ?? TILE_DIMENSIONS.wallThickness;
    const r = s.repeat;
    if (r) {
      const [o0, o1] = s.u as readonly [number, number];
      repeatAlong(r, half, height, (u) => out.push([r.clamp ? Math.max(-half, u + o0) : u + o0, r.clamp ? Math.min(half, u + o1) : u + o1, v(s.y[0]), v(s.y[1]), t]));
    } else out.push([v(s.u[0]), v(s.u[1]), v(s.y[0]), v(s.y[1]), t]);
  }
  return out;
}

/**
 * One trim box of a side, in the side's own frame: u along it, y up, v in from the cell's boundary (v0 < v1: the wall
 * itself spans v 0 to its thickness), turned `tilt` radians in the wall's plane about its middle (the +u end rises).
 */
export interface SideTrim {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  v0: number;
  v1: number;
  tilt?: number;
  /** On the wall's inner face: how far it stands off it (v1 - v0, as the style gives it). */
  depth?: number;
}

/** How thick a segmental arch's soffit is (from the curve up into the wall: it covers the stepped collision above it). */
const ARCH_SOFFIT = 0.2;
/** The joint between two voussoirs, along the curve. */
const ARCH_JOINT = 0.025;

/**
 * A segmental arch's dressing on one face: its voussoirs (the keystone `key` m taller in the middle of an odd count)
 * on the circle through the springing points and the crown, each standing off the face from `v0` by its depth, and
 * (`soffit`) the arch's underside through the wall's thickness `t`, tangent to the curve.
 */
function archTrim(a: EdgeArch, v0: number, outward: boolean, soffit: number): SideTrim[] {
  const [u0, u1] = a.u;
  const [spring, crown] = a.y;
  const c = (u1 - u0) / 2;
  const rise = crown - spring;
  if (!(c > 0 && rise > 0 && a.count >= 1)) return [];
  const mid = (u0 + u1) / 2;
  const r = (c * c + rise * rise) / (2 * rise);
  const centre = crown - r;
  const sweep = Math.asin(Math.min(1, c / r));
  const step = (2 * sweep) / a.count;
  const halfLen = r * Math.tan(step / 2);
  const depth = a.depth ?? 0.06;
  const out: SideTrim[] = [];
  const piece = (at: number, radius: number, along: number, band: number, va: number, vb: number, depth?: number) => {
    const u = mid + (radius + band / 2) * Math.sin(at);
    const y = centre + (radius + band / 2) * Math.cos(at);
    out.push({ u0: u - along, u1: u + along, y0: y - band / 2, y1: y + band / 2, v0: va, v1: vb, ...(at ? { tilt: -at } : {}), ...(depth !== undefined ? { depth } : {}) });
  };
  for (let i = 0; i < a.count; i++) {
    const at = -sweep + (i + 0.5) * step;
    const key = a.count % 2 === 1 && i === (a.count - 1) / 2;
    const band = a.band + (key ? (a.key ?? 0) : 0);
    const d = key ? depth + 0.04 : depth;
    piece(at, r, halfLen - ARCH_JOINT / 2, band, outward ? v0 - d : v0, outward ? v0 : v0 + d, outward ? undefined : d);
    if (soffit > 0) piece(at, r, halfLen, ARCH_SOFFIT, 0, soffit);
  }
  return out;
}

/**
 * Every trim box of an edge style on one side (map/geometry.ts draws them; they never collide): the pieces on the
 * wall's inner face, standing off it from `from` (the style's trimFrom, else the wall thickness); an arch's soffit
 * through the wall; and with `outer`, the pieces marked `outside` once more on the wall's outer face (the cell's
 * boundary), for a side nothing is built beyond.
 */
export function edgeTrimBoxes(style: ResolvedEdge, half: number, height: number, outer = false): SideTrim[] {
  const shape = shapeOf(style);
  const from = shape?.trimFrom ?? TILE_DIMENSIONS.wallThickness;
  const out: SideTrim[] = [];
  const at = (u0: number, u1: number, y0: number, y1: number, depth: number) => out.push({ u0, u1, y0, y1, v0: from, v1: from + depth, depth });
  const v = (x: EdgeValue) => edgeValue(x, half, height);
  for (const p of shape?.trim ?? []) {
    if ('base' in p) at(v(p.base[0]), v(p.base[1]), 0, 0.16, 0.04);
    else if ('cornice' in p) {
      if (height >= 3) at(v(p.cornice[0]), v(p.cornice[1]), height - 0.2, height, 0.07);
    } else if ('frame' in p) {
      const { half: d, top: h } = p.frame;
      if (height > h + 0.2) {
        at(-d - 0.16, -d, 0, h, 0.06);
        at(d, d + 0.16, 0, h, 0.06);
        at(-d - 0.16, d + 0.16, h, h + 0.16, 0.06);
      }
    } else if ('window' in p) {
      const [u0, u1] = p.window.u;
      const [y0, y1] = p.window.y;
      at(u0 - 0.08, u1 + 0.08, y0 - 0.08, y0, 0.12);
      at(u0 - 0.1, u1 + 0.1, y1, y1 + 0.12, 0.05);
      at(u0 - 0.1, u0, y0, y1, 0.05);
      at(u1, u1 + 0.1, y0, y1, 0.05);
    } else if ('arch' in p) {
      out.push(...archTrim(p.arch, from, false, Math.min(from, TILE_DIMENSIONS.wallThickness)));
      if (outer && p.outside) out.push(...archTrim(p.arch, 0, true, 0));
    } else {
      const pieces: [number, number][] = [];
      if (p.repeat) {
        const [o0, o1] = p.u as readonly [number, number];
        repeatAlong(p.repeat, half, height, (u) => pieces.push([u + o0, u + o1]));
      } else pieces.push([v(p.u[0]), v(p.u[1])]);
      for (const [u0, u1] of pieces) {
        at(u0, u1, v(p.y[0]), v(p.y[1]), p.depth);
        if (outer && p.outside) out.push({ u0, u1, y0: v(p.y[0]), y1: v(p.y[1]), v0: -p.depth, v1: 0 });
      }
    }
  }
  return out;
}

/**
 * Visual trim for an edge on its inner face: [u0, u1, y0, y1, depth] standing off the wall face, and a sixth number,
 * the turn in the wall's plane, for the tilted pieces (an arch's voussoirs). edgeTrimBoxes has every piece.
 */
export function edgeTrim(style: ResolvedEdge, half: number, height: number): ([number, number, number, number, number] | [number, number, number, number, number, number])[] {
  return edgeTrimBoxes(style, half, height)
    .filter((p) => p.depth !== undefined)
    .map((p) => (p.tilt ? [p.u0, p.u1, p.y0, p.y1, p.depth!, p.tilt] : [p.u0, p.u1, p.y0, p.y1, p.depth!]));
}

/** True when both cells on either side of this edge expose a port toward each other. */
export function isOpenEdge(cells: Map<string, CellOccupant>, x: number, y: number, z: number, side: Side): boolean {
  const here = cells.get(cellKey(x, y, z));
  const [dx, dy] = SIDE_DIRS[side];
  const there = cells.get(cellKey(x + dx, y + dy, z));
  return !!here && !!there && hasPort(here, side) && hasPort(there, OPPOSITE[side]);
}

/**
 * Convert the Classic Grid layout into world boxes. Unconnected ports become
 * solid walls (auto-cap) unless the tile or the creator says otherwise, so
 * ordinary layouts stay enclosed and bots cannot walk off into the void.
 */
export function buildMapGeometry(map: MapDocument, catalog: TileCatalog = coreCatalog): WorldBox[] {
  return buildBoxes(map, catalog, false);
}

/** Visual-only trim (baseboards, cornices, door and window frames, railing posts) for the renderer. */
export function buildMapDecor(map: MapDocument, catalog: TileCatalog = coreCatalog): WorldBox[] {
  return buildBoxes(map, catalog, true);
}

/** A solid prop that can be shot apart (its catalogue entry has health). */
export function isBreakableProp(e: MapEntity): boolean {
  if (e.kind !== 'prop' || !e.solid) return false;
  const def = getProp(e.model);
  return !!def?.breakable && !!def.collision;
}

/** Collision of solid props: the prop's box, scaled and turned (as its axis-aligned bounds). */
/** Natural rocks and boulders (not logs or stumps), which collide as rounded tiers. */
const isRock = (def: { id: string; category: string }): boolean => def.category === 'Rocks & Wood' && /rock|boulder|stone|cliff/.test(def.id);

export function propBoxes(map: MapDocument, breakable = false): WorldBox[] {
  const out: WorldBox[] = [];
  // Props riding a mover are drawn only (its blocks collide).
  const carried = new Set(map.entities.flatMap((e) => (e.kind === 'mover' ? (e.props ?? []) : [])));
  for (const e of map.entities) {
    // Breakable props are not static: the scenario runtime owns their colliders (ask for them with `breakable`).
    if (e.kind !== 'prop' || !e.solid || isBreakableProp(e) !== breakable || carried.has(e.id)) continue;
    const def = getProp(e.model);
    if (!def?.collision) continue;
    const [x, y, z] = e.position;
    const c = Math.cos(e.yaw);
    const s = Math.sin(e.yaw);
    // Boxes turn with the prop (yaw like a mesh's rotation.y: local +Z goes to (sin, cos)), so a prop
    // turned at an angle collides with its own shape, not the much bigger square round it.
    const turned = (px: number, pz: number, hw: number, hd: number, y0: number, y1: number): WorldBox =>
      e.yaw ? { min: [px - hw, y0, pz - hd], max: [px + hw, y1, pz + hd], kind: 'prop', sourceId: e.id, yaw: e.yaw } : { min: [px - hw, y0, pz - hd], max: [px + hw, y1, pz + hd], kind: 'prop', sourceId: e.id };
    if (def.boxes) {
      for (const [x0, y0, z0, x1, y1, z1] of def.boxes) {
        const cx = ((x0 + x1) / 2) * e.scale;
        const cz = ((z0 + z1) / 2) * e.scale;
        out.push(turned(x + cx * c + cz * s, z - cx * s + cz * c, ((x1 - x0) / 2) * e.scale, ((z1 - z0) / 2) * e.scale, y + y0 * e.scale, y + y1 * e.scale));
      }
      continue;
    }
    const [w, h, d] = def.collision.map((v) => v * e.scale) as [number, number, number];
    if (isRock(def) && h > PLAYER.maxStepHeight) {
      // Rocks are round, not crates: a wide low tier you can hop onto and a narrower top,
      // so big rocks can be climbed over and their corners don't snag you.
      const low = Math.min(h * 0.5, 0.7);
      out.push(turned(x, z, (w / 2) * 0.85, (d / 2) * 0.85, y, y + low));
      out.push(turned(x, z, (w / 2) * 0.55, (d / 2) * 0.55, y + low, y + h * 0.92));
      continue;
    }
    if (isRock(def)) continue; // pebbles: walk straight over them
    out.push(turned(x, z, w / 2, d / 2, y, y + h));
  }
  return out;
}

/**
 * Blocks the scenario runtime owns (v20): breakable, crumbling and trapdoor
 * blocks, plus solid blocks that logic targets, that start hidden or that a
 * mover carries, force fields (they stop movement only, so they are
 * never level geometry) and glass blocks (sim/glass.ts). Everything else is static level geometry.
 */
export function dynamicBlockIds(map: MapDocument): Set<string> {
  const out = new Set<string>();
  const targets = logicTargets(map.logic);
  const carried = new Set(map.entities.flatMap((e) => (e.kind === 'mover' ? e.blocks : [])));
  for (const e of map.entities) {
    if (e.kind !== 'block') continue;
    if (e.behaviour !== 'solid' || e.startHidden || e.field || e.glass || targets.has(e.id) || carried.has(e.id)) out.add(e.id);
  }
  return out;
}

/**
 * Free blocks as world boxes. Static solid blocks are level geometry; the
 * dynamic ones (see dynamicBlockIds) belong to the scenario runtime, which
 * moves them and turns their colliders on and off (ask for them with
 * `dynamic`: you get them in their idle state, as navigation and the
 * validator see them: present unless they start hidden, movers' blocks at
 * their first point).
 */
export function blockBoxes(map: MapDocument, dynamic = false): WorldBox[] {
  const out: WorldBox[] = [];
  const dyn = dynamicBlockIds(map);
  const starts = dynamic ? moverStarts(map) : null;
  for (const e of map.entities) {
    if (e.kind !== 'block' || dyn.has(e.id) !== dynamic) continue;
    if (dynamic && e.startHidden) continue;
    const start = starts?.get(e.id);
    out.push(start ? carriedBox(e, start) : blockBox(e));
  }
  return out;
}

interface MoverStart {
  pivot: [number, number, number];
  offset: [number, number, number];
  angle: number;
  yaw: number;
}

/** Where each mover-carried block starts: its mover's first point and angle. */
function moverStarts(map: MapDocument): Map<string, MoverStart> {
  const out = new Map<string, MoverStart>();
  for (const m of map.entities) {
    if (m.kind !== 'mover') continue;
    const start = { pivot: m.position, offset: m.points[0]!, angle: m.angles?.[0] ?? 0, yaw: m.yaw };
    for (const id of m.blocks) if (!out.has(id)) out.set(id, start);
  }
  return out;
}

/** A carried block's box at its mover's first point (the hinge turn tilts it when it faces the mover's way). */
function carriedBox(e: Extract<MapEntity, { kind: 'block' }>, s: MoverStart): WorldBox {
  const b = blockBox(e);
  const h = e.size[1] / 2;
  let c: [number, number, number] = [e.position[0] - s.pivot[0], e.position[1] + h - s.pivot[1], e.position[2] - s.pivot[2]];
  let pitch = e.pitch ?? 0;
  if (s.angle) {
    const turn = boxQuat(s.yaw);
    const back = { x: -turn.x, y: -turn.y, z: -turn.z, w: turn.w };
    const hinge = quatMul(quatMul(turn, boxQuat(0, s.angle)), back);
    c = quatRotate(hinge, c[0], c[1], c[2]);
    const dy = Math.atan2(Math.sin(e.yaw - s.yaw), Math.cos(e.yaw - s.yaw));
    if (Math.abs(dy) < 1e-6 && !e.roll) pitch += s.angle;
  }
  const cx = s.pivot[0] + s.offset[0] + c[0];
  const cy = s.pivot[1] + s.offset[1] + c[1];
  const cz = s.pivot[2] + s.offset[2] + c[2];
  const [w, , d] = e.size;
  const { pitch: _p, ...rest } = b;
  void _p;
  return { ...rest, min: [cx - w / 2, cy - h, cz - d / 2], max: [cx + w / 2, cy + h, cz + d / 2], ...(pitch ? { pitch } : {}) };
}

export function blockBox(e: Extract<MapEntity, { kind: 'block' }>): WorldBox {
  const [x, y, z] = e.position;
  const [w, h, d] = e.size;
  return {
    min: [x - w / 2, y, z - d / 2],
    max: [x + w / 2, y + h, z + d / 2],
    kind: 'floor',
    sourceId: e.id,
    ...(e.yaw ? { yaw: e.yaw } : {}),
    ...(e.pitch ? { pitch: e.pitch } : {}),
    ...(e.roll ? { roll: e.roll } : {}),
    ...(e.material ? { surface: { material: e.material, tint: e.tint } } : {}),
  };
}

/** The terrain's collision mesh, if the map has terrain. */
export function mapTerrainMesh(map: MapDocument): { positions: Float32Array; indices: Uint32Array } | null {
  return map.terrain ? terrainTriangles(map.terrain) : null;
}

/** Lowest point anyone can stand on, minus a margin: falling past it kills. */
export function mapKillY(boxes: readonly WorldBox[], map?: MapDocument): number {
  let low = Infinity;
  for (const b of boxes) if (b.kind === 'floor') low = Math.min(low, b.max[1]);
  if (map?.terrain) low = Math.min(low, map.terrain.baseY + Math.min(...map.terrain.heights) / 100);
  return Number.isFinite(low) ? low - 14 : -40;
}

function buildBoxes(map: MapDocument, catalog: TileCatalog, decor: boolean): WorldBox[] {
  const { cellSize, levelHeight } = map.classicStructure;
  const { floorThickness } = TILE_DIMENSIONS;
  const { cells } = buildOccupancy(map, catalog);
  const boxes: WorldBox[] = [];
  const half = cellSize / 2;
  const rooms = roomOptionBoxes(map, catalog, cells, decor);
  boxes.push(...rooms.boxes);

  for (const [key, occ] of cells) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const cx = gx * cellSize;
    const cz = gy * cellSize;
    const baseY = gz * levelHeight;
    const id = occ.placement.id;

    if (!decor && cellSlab(occ) && !(occ.level === 0 && rooms.noSlabs.has(id))) {
      boxes.push({ min: [cx - half, baseY - floorThickness, cz - half], max: [cx + half, baseY, cz + half], kind: 'floor', sourceId: id });
    }

    for (const side of SIDES) {
      const style = resolveEdge(cells, gx, gy, gz, side);
      if (decor) {
        // Trim marked `outside` dresses the wall's outer face too where nothing is built beyond (an arch from the street).
        const [dx, dy] = SIDE_DIRS[side];
        const outer = !cells.has(cellKey(gx + dx, gy + dy, gz));
        for (const p of edgeTrimBoxes(style, half, levelHeight, outer)) boxes.push(sideTrimBox(side, cx, cz, half, baseY, p, id));
      } else {
        for (const [u0, u1, y0, y1, t] of edgeSegments(style, half, levelHeight)) {
          boxes.push(sideBox(side, cx, cz, half, u0, u1, baseY + y0, baseY + y1, 0, t, id, 'wall'));
        }
      }
    }
  }

  if (decor) {
    boxes.push(...facadeFrames(map, cells));
    boxes.push(...packFacadeBoxes(map, cells));
    // Trim on curved pieces (it never collides).
    for (const placement of map.classicStructure.tiles) {
      const def = catalog.get(placement.tile);
      for (const solid of def?.solids ?? []) {
        if (solid.kind === 'trim') boxes.push(rotateLocalBox(solid, placement.rotation, placement.x * cellSize, placement.z * levelHeight, placement.y * cellSize, placement.id, 'trim'));
      }
    }
    return boxes;
  }
  boxes.push(...propBoxes(map));
  boxes.push(...blockBoxes(map));
  if (map.terrain) boxes.push(...terrainBoundary(map.terrain));
  if (map.bounds) {
    let floorY = Infinity;
    for (const b of boxes) if (b.kind === 'floor') floorY = Math.min(floorY, b.max[1]);
    if (map.terrain) floorY = Math.min(floorY, map.terrain.baseY + Math.min(...map.terrain.heights) / 100);
    boxes.push(...boundaryBoxes(map.bounds, Number.isFinite(floorY) ? floorY : 0));
  }
  // Borders (cliffs, city blocks, fences…) are solid, and so are placed electric fences.
  if (hasBorder(map)) boxes.push(...borderBoxes(map, borderFloor(map, boxes)));
  boxes.push(...electricFenceBoxes(map));
  for (const placement of map.classicStructure.tiles) {
    const def = catalog.get(placement.tile);
    if (!def) continue;
    const cx = placement.x * cellSize;
    const cz = placement.y * cellSize;
    const baseY = placement.z * levelHeight;
    for (const f of def.extraFloors ?? []) boxes.push(rotateLocalBox(f, placement.rotation, cx, baseY, cz, placement.id, 'floor'));
    if (rooms.ownLayout.has(placement.id)) continue;
    for (const solid of def.solids ?? []) if (solid.kind !== 'trim') boxes.push(rotateLocalBox(solid, placement.rotation, cx, baseY, cz, placement.id, solid.kind ?? 'solid'));
  }
  if (!decor) boxes.push(...groundBoxes(map, boxes));
  return boxes;
}

/** Wall styles a corner piece can stand against (solid enough at the corner itself). */
const CORNER_WALLS = new Set<ResolvedEdge>(CORNER_EDGE_STYLES);

/** The two sides meeting at each corner of a cell, and which way that corner lies from the centre. */
const CELL_CORNERS: [Side, Side, number, number][] = [
  ['N', 'E', 1, 1],
  ['E', 'S', 1, -1],
  ['S', 'W', -1, -1],
  ['W', 'N', -1, 1],
];

/**
 * What room options (layout, floor insert, ceiling, corners) add to the map,
 * which placements' floor slabs a sunken centre replaces, and which placements'
 * own furniture a chosen layout replaces.
 */
function roomOptionBoxes(map: MapDocument, catalog: TileCatalog, cells: Map<string, CellOccupant>, decor: boolean): { boxes: WorldBox[]; noSlabs: Set<string>; ownLayout: Set<string> } {
  const { cellSize, levelHeight } = map.classicStructure;
  const half = cellSize / 2;
  const t = TILE_DIMENSIONS.wallThickness;
  const out: WorldBox[] = [];
  const noSlabs = new Set<string>();
  const ownLayout = new Set<string>();
  for (const placement of map.classicStructure.tiles) {
    const o = placement.options;
    const def = catalog.get(placement.tile);
    if (!o || !def?.configurable) continue;
    const [w, d] = footprintSize(def);
    const px = placement.x * cellSize;
    const pz = placement.y * cellSize;
    const baseY = placement.z * levelHeight;
    const local = (b: LocalBox, kind: BoxKind = b.kind ?? 'solid') => out.push(rotateLocalBox(b, placement.rotation, px, baseY, pz, placement.id, kind));
    const mine = [...cells.entries()].filter(([, occ]) => occ.placement === placement).map(([key]) => key.split(',').map(Number) as [number, number, number]);

    let area: ReturnType<typeof floorInsertBoxes>['area'];
    if (o.floor && o.floor !== 'standard') {
      const ground = mine.filter(([, , z]) => z === placement.z);
      // A pit needs room under it: nothing built below, and no terrain to fill it.
      const sinkable = o.floor !== 'sunken' || (ground.every(([x, y, z]) => !cells.has(cellKey(x, y, z - 1))) && !(map.terrain && placement.z <= 0));
      if (sinkable) {
        const insert = floorInsertBoxes(o.floor, w, d);
        area = insert.area;
        if (insert.replacesSlabs) noSlabs.add(placement.id);
        if (!decor) for (const b of insert.boxes) local(b);
      }
    }
    if (o.layout) {
      ownLayout.add(placement.id);
      if (!decor) {
        for (const b of roomLayoutBoxes(o.layout, w, d, placement.id, levelHeight)) {
          // Pieces standing in a raised or sunken centre stand on its floor (tall ones still reach the ceiling).
          const mx = (b.min[0] + b.max[0]) / 2;
          const mz = (b.min[2] + b.max[2]) / 2;
          const inArea = area && mx > area.x0 && mx < area.x1 && mz > area.z0 && mz < area.z1;
          const dy = inArea ? area!.dy : 0;
          const full = b.max[1] >= levelHeight - 1e-6;
          local(dy ? { ...b, min: [b.min[0], b.min[1] + dy, b.min[2]], max: [b.max[0], full ? b.max[1] : b.max[1] + dy, b.max[2]] } : b);
        }
      }
    }
    for (const [x, y, z] of mine) {
      const cx = x * cellSize;
      const cz = y * cellSize;
      const top = z * levelHeight + levelHeight;
      if (o.ceiling && o.ceiling !== 'open' && !cells.has(cellKey(x, y, z + 1))) {
        const roof = (x0: number, z0: number, x1: number, z1: number) => out.push({ min: [cx + x0, top - TILE_DIMENSIONS.floorThickness, cz + z0], max: [cx + x1, top, cz + z1], kind: 'floor', sourceId: placement.id, roof: true });
        if (decor) {
          if (o.ceiling === 'beams') {
            // Three beams under the roof, across the room's short way in its own frame.
            const alongX = placement.rotation % 2 === 0;
            for (const u of [-half / 2, 0, half / 2]) {
              const y0 = top - TILE_DIMENSIONS.floorThickness - 0.45;
              const y1 = top - TILE_DIMENSIONS.floorThickness;
              out.push(alongX ? { min: [cx - half, y0, cz + u - 0.18], max: [cx + half, y1, cz + u + 0.18], kind: 'trim', sourceId: placement.id } : { min: [cx + u - 0.18, y0, cz - half], max: [cx + u + 0.18, y1, cz + half], kind: 'trim', sourceId: placement.id });
            }
          }
        } else if (o.ceiling === 'skylight') {
          const h = 1.5;
          roof(-half, -half, half, -h);
          roof(-half, h, half, half);
          roof(-half, -h, -h, h);
          roof(h, -h, half, h);
        } else roof(-half, -half, half, half);
      }
      if (o.ceiling === 'vault') out.push(...(decor ? vaultRibs : vaultBoxes)(cells, x, y, z, def, placement, cellSize, levelHeight));
      if (o.corners && o.corners !== 'square') {
        const y0 = z * levelHeight;
        for (const [a, b, sx, sz] of CELL_CORNERS) {
          if (!CORNER_WALLS.has(resolveEdge(cells, x, y, z, a)) || !CORNER_WALLS.has(resolveEdge(cells, x, y, z, b))) continue;
          // The inside corner where the two wall faces meet.
          const ix = cx + sx * (half - t);
          const iz = cz + sz * (half - t);
          out.push(...cornerPiece(o.corners, ix, iz, sx, sz, y0, y0 + levelHeight, placement.id, decor));
        }
      }
    }
  }
  return { boxes: out, noSlabs, ownLayout };
}

/** A vaulted ceiling's strips: 0.2 m thick, their tops at the underside of the floor or roof above. */
const VAULT_T = 0.2;
/**
 * Where a vault springs from its side walls: just over a doorway's head (3 m), so the doors and windows in those walls
 * stay whole (shots and players pass their whole opening; packages/shared/test/setPiecePlay.test.ts).
 */
const VAULT_SPRING = 3.02;

/** Where one cell's vault runs (vaultBoxes): along world z or x, across `span` and along `along`, springing and crown heights. */
function vaultFrame(cells: Map<string, CellOccupant>, gx: number, gy: number, gz: number, def: TileDefinition, placement: TilePlacement, cellSize: number, levelHeight: number) {
  const half = cellSize / 2;
  const t = TILE_DIMENSIONS.wallThickness;
  const [w, d] = footprintSize(def);
  // Along the room's long way, in the world: local y is world z unless the room is turned a quarter (or three).
  const alongZ = (d >= w) === (placement.rotation % 2 === 0);
  const sides: [Side, Side, Side, Side] = alongZ ? ['W', 'E', 'S', 'N'] : ['S', 'N', 'W', 'E'];
  const segs = (side: Side) => edgeSegments(resolveEdge(cells, gx, gy, gz, side), half, levelHeight);
  const inset = (side: Side) => Math.max(0, ...segs(side).map((g) => g[4]));
  const top = levelHeight - TILE_DIMENSIONS.floorThickness;
  const crown = top - VAULT_T - 0.01;
  const spring = Math.min(VAULT_SPRING, crown - 0.1);
  // Across the vault (x for a vault along z), and along it between the walls at its ends.
  const [a0, a1] = alongZ ? [gx * cellSize, gy * cellSize] : [gy * cellSize, gx * cellSize];
  const span: [number, number] = [a0 - half + t, a0 + half - t];
  const along: [number, number] = [a1 - half + inset(sides[2]), a1 + half - inset(sides[3])];
  return { half, t, alongZ, sides, segs, top, crown, spring, a0, a1, span, along, baseY: gz * levelHeight };
}

/** A vault's local boxes (map/catalog.ts vault) as one placement's world boxes. */
const vaultWorld = (boxes: readonly LocalBox[], kind: BoxKind, sourceId: string): WorldBox[] =>
  boxes.map((b) => ({ min: [...b.min], max: [...b.max], kind, sourceId, ...(b.pitch ? { pitch: b.pitch } : {}), ...(b.roll ? { roll: b.roll } : {}) }));

/**
 * The vaulted ceiling (room option `vault`) of one cell of a room: a shallow segmental barrel vault along the room's
 * long way (local y when it is at least as deep as wide), springing 0.5 m in from each side just over the doorways'
 * heads (3.02 m) and rising to 3.29 m on a 4 m level, its strips' tops just under the floor or roof above. It stops at the walls across its ends
 * and runs on through a side with none (into the next vaulted cell). A side that can't carry its springing (no wall,
 * or one lower or thinner than a standard wall: railings, half walls, fences, bars) gets a beam under it, 0.5 m wide
 * and 0.45 m deep; two vaulted cells side by side share theirs. Its ribs are trim (vaultRibs).
 */
function vaultBoxes(cells: Map<string, CellOccupant>, gx: number, gy: number, gz: number, def: TileDefinition, placement: TilePlacement, cellSize: number, levelHeight: number): WorldBox[] {
  const f = vaultFrame(cells, gx, gy, gz, def, placement, cellSize, levelHeight);
  const { half, t, alongZ, a0, along, baseY } = f;
  const id = placement.id;
  const out = vaultWorld(vault(alongZ ? 'z' : 'x', f.span, along, baseY + f.spring, baseY + f.crown, 12, VAULT_T, 'wall'), 'wall', id);
  for (const [side, sign] of [[f.sides[0], -1], [f.sides[1], 1]] as const) {
    // Carried by a standard wall at least as high as the springing (a doorway's piers and lintel count).
    if (f.segs(side).some((g) => g[4] >= t - 0.05 && g[3] >= f.spring)) continue;
    const across: [number, number] = sign < 0 ? [a0 - half, a0 - half + t] : [a0 + half - t, a0 + half];
    const y0 = baseY + f.spring - 0.45;
    const y1 = baseY + f.top;
    out.push(alongZ ? { min: [across[0], y0, along[0]], max: [across[1], y1, along[1]], kind: 'wall', sourceId: id } : { min: [along[0], y0, across[0]], max: [along[1], y1, across[1]], kind: 'wall', sourceId: id });
  }
  return out;
}

/** A vault rib: how wide (along the vault), how deep under it, and how far it sinks into it (no face shared with it). */
const VAULT_RIB = { width: 0.3, depth: 0.1, sink: 0.02 } as const;

/**
 * The ribs under one cell's vaulted ceiling (trim: drawn, never colliding): two arches of dressed stone across the vault
 * at the cell's quarter points, following its curve from side to side, so the shallow vault reads as one from any
 * angle. Each is the vault's own curve lowered by its depth, sunk a little into the vault (no two faces in one plane).
 */
function vaultRibs(cells: Map<string, CellOccupant>, gx: number, gy: number, gz: number, def: TileDefinition, placement: TilePlacement, cellSize: number, levelHeight: number): WorldBox[] {
  const f = vaultFrame(cells, gx, gy, gz, def, placement, cellSize, levelHeight);
  const { width, depth, sink } = VAULT_RIB;
  const out: WorldBox[] = [];
  for (const at of [f.a1 - f.half / 2, f.a1 + f.half / 2]) {
    if (at - width / 2 < f.along[0] || at + width / 2 > f.along[1]) continue;
    out.push(...vaultWorld(vault(f.alongZ ? 'z' : 'x', f.span, [at - width / 2, at + width / 2], f.baseY + f.spring - depth, f.baseY + f.crown - depth, 12, depth + sink, 'trim'), 'trim', placement.id));
  }
  return out;
}

/** One corner treatment at an inside corner (ix, iz), the room lying toward (-sx, -sz). */
function cornerPiece(style: Corner, ix: number, iz: number, sx: number, sz: number, y0: number, y1: number, sourceId: string, decor: boolean): WorldBox[] {
  const sq = (s: number, a: number, b: number, kind: BoxKind): WorldBox => ({ min: [Math.min(ix, ix - sx * s), a, Math.min(iz, iz - sz * s)], max: [Math.max(ix, ix - sx * s), b, Math.max(iz, iz - sz * s)], kind, sourceId });
  const diagonal = (dist: number, len: number, thick: number, kind: BoxKind): WorldBox => {
    // A box across the corner at 45°, its centre `dist` in from the corner along the diagonal.
    const mx = ix - sx * dist;
    const mz = iz - sz * dist;
    return { min: [mx - len / 2, y0, mz - thick / 2], max: [mx + len / 2, y1, mz + thick / 2], yaw: sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4, kind, sourceId };
  };
  switch (style) {
    case 'square':
      return [];
    case 'posts':
      return decor ? [] : [sq(0.7, y0, y1, 'wall')];
    case 'columns':
      return decor ? [sq(0.8, y0, y0 + 0.3, 'trim'), sq(0.8, y1 - 0.35, y1, 'trim')] : [sq(0.6, y0, y1, 'wall')];
    case 'chamfered':
      return decor ? [] : [diagonal(0.45, 1.8, 0.6, 'wall')];
    case 'rounded': {
      if (decor) return [];
      // Three short faces round the corner, like a fillet of radius ~1.4 m.
      const out: WorldBox[] = [];
      const r = 1.4;
      const ox = ix - sx * r;
      const oz = iz - sz * r;
      for (let i = 0; i < 3; i++) {
        const a = ((i + 0.5) / 3) * (Math.PI / 2);
        const px = ox + sx * Math.cos(a) * (r + 0.25);
        const pz = oz + sz * Math.sin(a) * (r + 0.25);
        const len = 2 * (r + 0.25) * Math.sin(Math.PI / 12) + 0.06;
        // Face perpendicular to the radius.
        const ang = Math.atan2(sz * Math.sin(a), sx * Math.cos(a));
        out.push({ min: [px - len / 2, y0, pz - 0.25], max: [px + len / 2, y1, pz + 0.25], yaw: -(ang + Math.PI / 2), kind: 'wall', sourceId });
      }
      return [...out, sq(0.45, y0, y1, 'wall')];
    }
  }
}

/** How far the walkable ground runs past the map's footprint. */
const GROUND_MARGIN = 12;

/**
 * Ground you can stand on under and round a built map (no terrain) whose
 * backdrop draws land there: a slab at the same height the ground is drawn
 * (just under the lowest floor), reaching GROUND_MARGIN past the footprint,
 * fenced in by invisible walls so nobody walks off its edge into the void.
 * Collision only (barrier boxes), so it changes nothing on screen. Maps over
 * water, in space or with terrain get none.
 */
export function groundBoxes(map: MapDocument, boxes: readonly WorldBox[]): WorldBox[] {
  if (map.terrain) return [];
  const ground = resolveBackdrop(map).ground;
  if (ground === 'none' || ground === 'water') return [];
  let [x0, z0, x1, z1, floor] = [Infinity, Infinity, -Infinity, -Infinity, Infinity];
  for (const b of boxes) {
    if (b.kind === 'barrier') continue;
    const bb = boxBounds(b);
    x0 = Math.min(x0, bb.min[0]);
    z0 = Math.min(z0, bb.min[2]);
    x1 = Math.max(x1, bb.max[0]);
    z1 = Math.max(z1, bb.max[2]);
    // The same lowest-floor rule the backdrop draws its ground with.
    floor = Math.min(floor, bb.max[1] < 0.5 ? bb.max[1] : bb.min[1]);
  }
  if (!Number.isFinite(floor)) return [];
  if (map.bounds) {
    x0 = Math.min(x0, map.bounds.min[0]);
    z0 = Math.min(z0, map.bounds.min[1]);
    x1 = Math.max(x1, map.bounds.max[0]);
    z1 = Math.max(z1, map.bounds.max[1]);
  }
  // Roads and trails drawn past the buildings have ground under them too (the backdrop draws it level there).
  const roads = pathsExtent(map.paths);
  if (roads) {
    x0 = Math.min(x0, roads.min[0]);
    z0 = Math.min(z0, roads.min[1]);
    x1 = Math.max(x1, roads.max[0]);
    z1 = Math.max(z1, roads.max[1]);
  }
  [x0, z0, x1, z1] = [x0 - GROUND_MARGIN, z0 - GROUND_MARGIN, x1 + GROUND_MARGIN, z1 + GROUND_MARGIN];
  const top = Math.round(floor * 100) / 100 - 0.05;
  const wall = (min: [number, number, number], max: [number, number, number]): WorldBox => ({ min, max, kind: 'barrier', sourceId: 'ground' });
  return [
    wall([x0, top - 2, z0], [x1, top, z1]),
    wall([x0 - 1, top - 2, z0 - 1], [x0, top + 60, z1 + 1]),
    wall([x1, top - 2, z0 - 1], [x1 + 1, top + 60, z1 + 1]),
    wall([x0, top - 2, z0 - 1], [x1, top + 60, z0]),
    wall([x0, top - 2, z1], [x1, top + 60, z1 + 1]),
  ];
}

/**
 * Walls round the map boundary. Visible walls and fences stand just inside the
 * rectangle; above them (and for invisible boundaries, all the way) an
 * invisible barrier reaches 60 m up so nothing is thrown or jumped out.
 */
export function boundaryBoxes(bounds: NonNullable<MapDocument['bounds']>, floorY = 0): WorldBox[] {
  const [x0, z0] = bounds.min;
  const [x1, z1] = bounds.max;
  const out: WorldBox[] = [];
  const id = '__bounds';
  const t = TILE_DIMENSIONS.wallThickness;
  const visible = bounds.style === 'invisible' ? 0 : bounds.height;
  const y0 = floorY - 20;
  // Invisible barrier outside the line, from deep below to high above.
  out.push(
    { min: [x0 - 1, y0, z0 - 1], max: [x0, floorY + 60, z1 + 1], kind: 'barrier', sourceId: id },
    { min: [x1, y0, z0 - 1], max: [x1 + 1, floorY + 60, z1 + 1], kind: 'barrier', sourceId: id },
    { min: [x0, y0, z0 - 1], max: [x1, floorY + 60, z0], kind: 'barrier', sourceId: id },
    { min: [x0, y0, z1], max: [x1, floorY + 60, z1 + 1], kind: 'barrier', sourceId: id },
  );
  if (!visible) return out;
  const top = floorY + visible;
  if (bounds.style === 'wall') {
    out.push(
      { min: [x0, floorY - 2, z0], max: [x0 + t, top, z1], kind: 'wall', sourceId: id },
      { min: [x1 - t, floorY - 2, z0], max: [x1, top, z1], kind: 'wall', sourceId: id },
      { min: [x0 + t, floorY - 2, z0], max: [x1 - t, top, z0 + t], kind: 'wall', sourceId: id },
      { min: [x0 + t, floorY - 2, z1 - t], max: [x1 - t, top, z1], kind: 'wall', sourceId: id },
    );
    return out;
  }
  // Fence: posts every 2 m and three rails along each side.
  const sides: [number, number, number, number][] = [
    [x0, z0, x1, z0],
    [x0, z1, x1, z1],
    [x0, z0, x0, z1],
    [x1, z0, x1, z1],
  ];
  for (const [ax, az, bx, bz] of sides) {
    const alongX = az === bz;
    const len = alongX ? bx - ax : bz - az;
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const u = (alongX ? ax : az) + (len * i) / n;
      out.push(alongX ? { min: [u - 0.08, floorY - 0.5, az - 0.08], max: [u + 0.08, top, az + 0.08], kind: 'wall', sourceId: id } : { min: [ax - 0.08, floorY - 0.5, u - 0.08], max: [ax + 0.08, top, u + 0.08], kind: 'wall', sourceId: id });
    }
    for (const y of [0.15, visible / 2, visible - 0.15]) {
      out.push(alongX ? { min: [ax, floorY + y - 0.07, az - 0.05], max: [bx, floorY + y + 0.07, az + 0.05], kind: 'wall', sourceId: id } : { min: [ax - 0.05, floorY + y - 0.07, az], max: [ax + 0.05, floorY + y + 0.07, bz], kind: 'wall', sourceId: id });
    }
  }
  return out;
}

/** A rectangle round everything built (tiles, entities and terrain), `margin` metres out: the "fit to map" boundary. */
export function fitBounds(map: MapDocument, margin = 4, catalog: TileCatalog = coreCatalog): { min: [number, number]; max: [number, number] } | null {
  let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (x: number, z: number) => {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  };
  for (const b of buildBoxes({ ...map, bounds: null }, catalog, false)) {
    if (b.kind === 'barrier') continue;
    const { min, max } = boxBounds(b);
    grow(min[0], min[2]);
    grow(max[0], max[2]);
  }
  for (const e of map.entities) grow(e.position[0], e.position[2]);
  if (map.terrain) {
    const t = map.terrain;
    grow(t.origin[0], t.origin[1]);
    grow(t.origin[0] + (t.cols - 1) * t.spacing, t.origin[1] + (t.rows - 1) * t.spacing);
  }
  if (!Number.isFinite(x0)) return null;
  const snap = (v: number) => Math.round(v * 2) / 2;
  return { min: [snap(x0 - margin), snap(z0 - margin)], max: [snap(x1 + margin), snap(z1 + margin)] };
}

/**
 * A box along one side of a cell: u runs along the side, v is the distance in
 * from the cell boundary (wall slabs span v 0..thickness; trim stands off the
 * inner face).
 */
function sideBox(side: Side, cx: number, cz: number, half: number, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, sourceId: string, kind: BoxKind): WorldBox {
  switch (side) {
    case 'N':
      return { min: [cx + u0, y0, cz + half - v1], max: [cx + u1, y1, cz + half - v0], kind, sourceId };
    case 'S':
      return { min: [cx + u0, y0, cz - half + v0], max: [cx + u1, y1, cz - half + v1], kind, sourceId };
    case 'E':
      return { min: [cx + half - v1, y0, cz + u0], max: [cx + half - v0, y1, cz + u1], kind, sourceId };
    case 'W':
      return { min: [cx - half + v0, y0, cz + u0], max: [cx - half + v1, y1, cz + u1], kind, sourceId };
  }
}

/** A trim box on one side of a cell (edgeTrimBoxes): tilted in the wall's plane, it is rolled on a north or south side (u runs along x) and pitched on an east or west one (u along z). */
function sideTrimBox(side: Side, cx: number, cz: number, half: number, baseY: number, p: SideTrim, sourceId: string): WorldBox {
  const b = sideBox(side, cx, cz, half, p.u0, p.u1, baseY + p.y0, baseY + p.y1, p.v0, p.v1, sourceId, 'trim');
  if (!p.tilt) return b;
  return side === 'N' || side === 'S' ? { ...b, roll: p.tilt } : { ...b, pitch: p.tilt };
}

function rotateLocalBox(box: LocalBox, rotation: number, cx: number, baseY: number, cz: number, sourceId: string, kind: BoxKind): WorldBox {
  // Style Pack pieces keep their own material in any theme.
  const surface = box.surface ? { surface: { material: box.surface.material, tint: box.surface.tint ?? null } } : {};
  if (box.yaw || box.pitch || box.roll) {
    // Turned (and tilted) boxes keep their size; the centre turns with the tile and the yaw adds the tile's quarter turns.
    const hx = (box.max[0] - box.min[0]) / 2;
    const hz = (box.max[2] - box.min[2]) / 2;
    const [mx, mz] = rotateXZ((box.min[0] + box.max[0]) / 2, (box.min[2] + box.max[2]) / 2, rotation);
    const yaw = (box.yaw ?? 0) + (rotation % 4) * (Math.PI / 2);
    return { min: [cx + mx - hx, baseY + box.min[1], cz + mz - hz], max: [cx + mx + hx, baseY + box.max[1], cz + mz + hz], kind, sourceId, ...(yaw ? { yaw } : {}), ...(box.pitch ? { pitch: box.pitch } : {}), ...(box.roll ? { roll: box.roll } : {}), ...surface };
  }
  const [ax, az] = rotateXZ(box.min[0], box.min[2], rotation);
  const [bx, bz] = rotateXZ(box.max[0], box.max[2], rotation);
  return {
    min: [cx + Math.min(ax, bx), baseY + box.min[1], cz + Math.min(az, bz)],
    max: [cx + Math.max(ax, bx), baseY + box.max[1], cz + Math.max(az, bz)],
    kind,
    sourceId,
    ...surface,
  };
}

/** Triangulate boxes into an indexed mesh (for navmesh generation). */
export function boxesToTriangles(boxes: readonly WorldBox[]): { positions: Float32Array; indices: Uint32Array } {
  const positions = new Float32Array(boxes.length * 8 * 3);
  const indices = new Uint32Array(boxes.length * 36);
  // Corner i has bit0 -> max x, bit1 -> max y, bit2 -> max z.
  // Faces wound counter-clockwise when viewed from outside (Recast expects CCW-up floors).
  const faces = [
    [0, 4, 6, 2], // -x
    [1, 3, 7, 5], // +x
    [0, 1, 5, 4], // -y
    [2, 6, 7, 3], // +y
    [0, 2, 3, 1], // -z
    [4, 5, 7, 6], // +z
  ];
  boxes.forEach((b, i) => {
    boxCorners(b).forEach((p, c) => positions.set(p, (i * 8 + c) * 3));
    faces.forEach((f, fi) => {
      const o = i * 36 + fi * 6;
      const base = i * 8;
      indices.set([base + f[0]!, base + f[1]!, base + f[2]!, base + f[0]!, base + f[2]!, base + f[3]!], o);
    });
  });
  return { positions, indices };
}

// ---------------------------------------------------------------- city facades and tile models

/** One facade piece (a node in city/facades.glb): its bottom centre on the street face, turned to face out, stretched by sx / sy. */
export interface FacadePiece {
  piece: string;
  /** The GLB holding the piece (a node of that name). */
  file: string;
  at: [number, number, number];
  yaw: number;
  sx: number;
  sy: number;
}

/** Facade kit pieces at 4/3 scale: every wall piece is 2.667 m wide and 4 m (bands and cornices 1.333 m) tall. */
const BAY = 8 / 3;
const BAND = 4 / 3;
/** Facades stand this far out from our walls: the kit's windows sit up to 0.3 m back from their face. */
const FACADE_OUT = 0.32;
/** Frames round the openings of walls that wear a facade (trim, never collides): the reveal between the facade and our wall. */
function facadeFrames(map: MapDocument, cells: Map<string, CellOccupant>): WorldBox[] {
  const { cellSize, levelHeight } = map.classicStructure;
  const half = cellSize / 2;
  const out: WorldBox[] = [];
  const f = 0.15;
  for (const [key, occ] of cells) {
    const facade = occ.placement.options?.facade;
    if (!facade || facade === 'none') continue;
    const depth = MODEL_FACADES.has(facade) ? FACADE_OUT : PACK_FACADES[facade as PackFacade].depth;
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    for (const side of SIDES) {
      const style = resolveEdge(cells, gx, gy, gz, side);
      const [dx, dy] = SIDE_DIRS[side];
      const there = cells.get(cellKey(gx + dx, gy + dy, gz));
      if (there && !there.def.open) continue;
      // Open ground next door builds its own wall on this side: the facade stands outside that one.
      const base = there && resolveEdge(cells, gx + dx, gy + dy, gz, OPPOSITE[side]) !== 'none' ? TILE_DIMENSIONS.wallThickness : 0;
      // The style's openings (doorways, windows: content/tiles/edges.json).
      for (const [u0, u1, y0, y1] of shapeOf(style)?.openings ?? []) {
        const top = Math.min(y1, levelHeight);
        const pieces: [number, number, number, number][] = [[u0 - f, u0, y0, top + f], [u1, u1 + f, y0, top + f], [u0, u1, top, top + f]];
        if (y0 > 0) pieces.push([u0, u1, y0 - f, y0]);
        for (const [a, b, c, d] of pieces) out.push(sideBox(side, gx * cellSize, gy * cellSize, half, a, b, gz * levelHeight + c, gz * levelHeight + d, -base - depth - 0.02, -base, occ.placement.id, 'trim'));
      }
    }
  }
  return out;
}
const CITY_FACADE_FILE = 'city/facades.glb';
/** Facades drawn from models (the city kit, and the Orbital and Neon packs' own pieces); the box-built Style Pack facades are packFacadeBoxes. */
const FACADE_SETS: Partial<Record<Facade, { ground: string[]; upper: string[]; band: string; cornice: string; column: string; file: string }>> = {
  brick: { ground: ['Brick_Window_Trim_Single', 'Brick_BottomTrim'], upper: ['Brick_Window_Trim_Single', 'Brick_Plain_3'], band: 'Brick_Plain_1', cornice: 'Cornice_Brick_Center', column: 'Trim_Column_Center', file: CITY_FACADE_FILE },
  storefront: { ground: ['Metal_FullWindow', 'Metal_FirstFloor_Window'], upper: ['Brick_Window_Square_Single', 'Brick_Plain_3'], band: 'Metal_Plain_1', cornice: 'Cornice_Metal_Center', column: 'Metal_Column_Center', file: CITY_FACADE_FILE },
  plaster: { ground: ['Trim_FirstFloor_Window_001', 'Trim_FirstFloor_Wall'], upper: ['Trim_Window', 'Trim_Plain_3'], band: 'Brick_Plain_1', cornice: 'Cornice_Trim_Center', column: 'Trim_Column_Center', file: CITY_FACADE_FILE },
  // Style Packs: our own pieces (tools/content/prepare-packs.mjs), on the same 8/3 m bays and 4 m storeys.
  hull: { ground: ['Hull_Viewport', 'Hull_Panel'], upper: ['Hull_Viewport', 'Hull_Panel'], band: 'Hull_Band', cornice: 'Hull_Cornice', column: 'Hull_Column', file: 'packs/facades_orbital.glb' },
  glass: { ground: ['Glass_Lobby', 'Glass_Pane'], upper: ['Glass_Lit', 'Glass_Pane'], band: 'Glass_Band', cornice: 'Glass_Cornice', column: 'Glass_Column', file: 'packs/facades_neon.glb' },
  neon: { ground: ['Neon_Shop', 'Neon_ShopWall'], upper: ['Neon_Window', 'Neon_Wall'], band: 'Neon_Band', cornice: 'Neon_Cornice', column: 'Neon_Column', file: 'packs/facades_neon.glb' },
};
type FacadeSet = NonNullable<(typeof FACADE_SETS)[Facade]>;
const piecesOf = (f: FacadeSet) => [...f.ground, ...f.upper, f.band, f.cornice, f.column];
/** Every facade piece name in each facade file (a GLB holding a node per piece). */
export const FACADE_FILES: Readonly<Record<string, readonly string[]>> = (Object.values(FACADE_SETS) as FacadeSet[]).reduce<Record<string, string[]>>((acc, f) => {
  acc[f.file] = [...new Set([...(acc[f.file] ?? []), ...piecesOf(f)])];
  return acc;
}, {});
/** Every city facade piece name (city/facades.glb holds exactly these). */
export const FACADE_PIECES: readonly string[] = FACADE_FILES[CITY_FACADE_FILE]!;

/** Edges that get a facade on their outside (solid enough to dress). */
const FACADE_WALLS = new Set<ResolvedEdge>(FACADE_EDGE_STYLES);

/**
 * The city facade pieces for every room with a `facade` option: each outside
 * wall (nothing beyond it, or open ground) is split into bays: windows and
 * plain wall in turn on the upper floors, a shopfront or base on the ground
 * floor, bands over doorways and under windows, a cornice along the top where
 * nothing is built above, and a column on each outer corner. Openings are left
 * as they are, so what you see matches what you can walk and shoot through.
 */
export function buildFacades(map: MapDocument, catalog: TileCatalog = coreCatalog): FacadePiece[] {
  const { cellSize, levelHeight } = map.classicStructure;
  const { cells } = buildOccupancy(map, catalog);
  const half = cellSize / 2;
  const out: FacadePiece[] = [];
  const outward: Record<Side, [number, number, number]> = { N: [0, 1, 0], S: [0, -1, Math.PI], E: [1, 0, Math.PI / 2], W: [-1, 0, -Math.PI / 2] };
  const exterior = (gx: number, gy: number, gz: number, side: Side) => {
    const [dx, dy] = SIDE_DIRS[side];
    const there = cells.get(`${gx + dx},${gy + dy},${gz}`);
    return !there || !!there.def.open;
  };
  /** How far out from the cell edge the facade's face stands: past the neighbour's own wall, if open ground next door builds one. */
  const standOff = (gx: number, gy: number, gz: number, side: Side) => {
    const [dx, dy] = SIDE_DIRS[side];
    const walled = cells.has(`${gx + dx},${gy + dy},${gz}`) && resolveEdge(cells, gx + dx, gy + dy, gz, OPPOSITE[side]) !== 'none';
    return (walled ? TILE_DIMENSIONS.wallThickness : 0) + FACADE_OUT;
  };
  for (const [key, occ] of cells) {
    const facade = occ.placement.options?.facade;
    if (!facade || facade === 'none') continue;
    const set = FACADE_SETS[facade];
    // Style Pack facades are boxes drawn with the level (packFacadeBoxes), not kit models.
    if (!set) continue;
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const cx = gx * cellSize;
    const cz = gy * cellSize;
    const baseY = gz * levelHeight;
    const ground = !cells.has(`${gx},${gy},${gz - 1}`);
    const roofed = cells.has(`${gx},${gy},${gz + 1}`);
    const sides = new Map<Side, ResolvedEdge>();
    for (const side of SIDES) {
      const style = resolveEdge(cells, gx, gy, gz, side);
      if (!FACADE_WALLS.has(style) || !exterior(gx, gy, gz, side)) continue;
      sides.set(side, style);
      const [ox, oz, yaw] = outward[side];
      const off = standOff(gx, gy, gz, side);
      const at = (u: number, y: number): [number, number, number] => (ox !== 0 ? [cx + ox * (half + off), y, cz + u] : [cx + u, y, cz + oz * (half + off)]);
      for (const [u0, u1, y0, y1, t] of edgeSegments(style, half, levelHeight)) {
        if (t < 0.3) continue;
        const n = Math.max(1, Math.round((u1 - u0) / BAY));
        const w = (u1 - u0) / n;
        for (let i = 0; i < n; i++) {
          const u = u0 + w * (i + 0.5);
          if (y0 === 0 && y1 - y0 >= levelHeight - 1e-6) {
            // Full-height bays, a storey (4 m) at a time (high walls stack).
            for (let y = 0; y < y1 - 1e-6; y += levelHeight) {
              const first = ground && y === 0;
              const kinds = first ? set.ground : set.upper;
              // Windows on alternate bays of a full wall, and on a pier beside an opening when it is wide enough.
              const piece = (n >= 3 ? i % 2 === 0 : n === 1 && w >= 2.2) ? kinds[0]! : kinds[kinds.length - 1]!;
              out.push({ piece, file: set.file, at: at(u, baseY + y), yaw, sx: w / BAY, sy: Math.min(levelHeight, y1 - y) / 4 });
            }
          } else {
            out.push({ piece: set.band, file: set.file, at: at(u, baseY + y0), yaw, sx: w / BAY, sy: (y1 - y0) / BAND });
          }
          if (!roofed && y1 >= levelHeight - 1e-6 && (y0 > 0 || y1 - y0 >= levelHeight - 1e-6)) out.push({ piece: set.cornice, file: set.file, at: at(u, baseY + y1), yaw, sx: w / BAY, sy: 1 });
        }
      }
    }
    // Columns on outer corners (both sides dressed and solid at the corner).
    for (const [a, b, sx, sz] of [['N', 'E', 1, 1], ['E', 'S', 1, -1], ['S', 'W', -1, -1], ['W', 'N', -1, 1]] as const) {
      if (!sides.has(a) || !sides.has(b)) continue;
      const top = Math.max(...[sides.get(a)!, sides.get(b)!].map((st) => Math.max(...edgeSegments(st, half, levelHeight).map((g) => g[3]))));
      const ca = standOff(gx, gy, gz, sx > 0 ? 'E' : 'W') - FACADE_OUT / 2;
      const cb = standOff(gx, gy, gz, sz > 0 ? 'N' : 'S') - FACADE_OUT / 2;
      for (let y = 0; y < top - 1e-6; y += levelHeight) out.push({ piece: set.column, file: set.file, at: [cx + sx * (half + ca), baseY + y, cz + sz * (half + cb)], yaw: 0, sx: 1, sy: Math.min(levelHeight, top - y) / 4 });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Style Pack facades

type PackFacade = 'concrete' | 'corrugated' | 'false_front' | 'adobe' | 'gothic_stone' | 'collegiate_stone' | 'manor_brick' | 'temple' | 'overgrown' | 'clapboard' | 'suburban_brick' | 'roman' | 'egyptian' | 'timber_frame' | 'village_plaster' | 'prefab' | 'snow_bunker' | 'desert_ashlar' | 'desert_plaster' | 'harbour_render' | 'tarred_timber';
/**
 * Style Pack facades, built from boxes in library materials: the cladding
 * (`skin`) on every outside wall, `depth` proud of it, and what each adds:
 * a plinth and cap (concrete), flashing (corrugated), a plank false front
 * over the street door with an awning and boardwalk (false front), or roof
 * beams poking through a rounded parapet (adobe).
 */
const PACK_FACADES: Record<PackFacade, { skin: string; tint: string | null; depth: number }> = {
  concrete: { skin: 'core.pbr_bunker_panels', tint: null, depth: 0.12 },
  corrugated: { skin: 'core.pbr_grey_corrugated', tint: null, depth: 0.08 },
  false_front: { skin: 'core.pbr_weathered_siding', tint: null, depth: 0.08 },
  adobe: { skin: 'core.pbr_adobe', tint: null, depth: 0.16 },
  // 05 Gothic Estate, 06 Jungle Ruins, 08 Suburban Chaos.
  gothic_stone: { skin: 'core.pbr_castle_stone', tint: '#9a9aa4', depth: 0.14 },
  // Collegiate Gothic (the set pieces' look for St. John's): grey lannonstone laid as rubble ashlar, dressed limestone.
  collegiate_stone: { skin: 'core.cobble', tint: '#d9d5cb', depth: 0.14 },
  manor_brick: { skin: 'core.pbr_brick_red', tint: '#a07c70', depth: 0.1 },
  temple: { skin: 'core.pbr_castle_stone', tint: '#d8d8b8', depth: 0.16 },
  overgrown: { skin: 'core.pbr_jungle_rock', tint: null, depth: 0.16 },
  clapboard: { skin: 'core.pbr_clapboard', tint: null, depth: 0.08 },
  suburban_brick: { skin: 'core.pbr_brick_red', tint: null, depth: 0.1 },
  roman: { skin: 'core.pbr_limestone', tint: null, depth: 0.1 },
  egyptian: { skin: 'core.pbr_sandstone_blocks', tint: null, depth: 0.12 },
  // 10 Medieval Village.
  timber_frame: { skin: 'core.timber_frame', tint: null, depth: 0.1 },
  village_plaster: { skin: 'core.whitewash', tint: null, depth: 0.1 },
  // 12 Snow Outpost.
  prefab: { skin: 'core.prefab_red', tint: null, depth: 0.08 },
  snow_bunker: { skin: 'core.snowy_concrete', tint: null, depth: 0.15 },
  // 11 Coastal Harbor.
  harbour_render: { skin: 'core.harbour_render', tint: null, depth: 0.1 },
  tarred_timber: { skin: 'core.tarred_boards', tint: null, depth: 0.08 },
  // 09 Desert City.
  desert_ashlar: { skin: 'core.ashlar', tint: null, depth: 0.1 },
  desert_plaster: { skin: 'core.stucco', tint: null, depth: 0.08 },
};
/** Openings in a dressed wall (from its segments): `top` is the lintel, `sill` the sill (0 for a doorway). */
function facadeOpenings(segs: readonly [number, number, number, number, number][]): { u0: number; u1: number; sill: number; top: number }[] {
  const out: { u0: number; u1: number; sill: number; top: number }[] = [];
  for (const [u0, u1, y0] of segs) {
    if (y0 <= 0.01) continue;
    const sill = segs.find((g) => Math.abs(g[0] - u0) < 1e-6 && Math.abs(g[1] - u1) < 1e-6 && g[2] <= 0.01 && g[3] < y0);
    out.push({ u0, u1, sill: sill ? sill[3] : 0, top: y0 });
  }
  return out;
}
/** Walls whose street face gets a frontier false front, awning and boardwalk. */
const STREET_FACES = new Set<ResolvedEdge>(STREET_EDGE_STYLES);

/** The boxes of every Style Pack facade (visual only: trim with its own material). */
function packFacadeBoxes(map: MapDocument, cells: Map<string, CellOccupant>): WorldBox[] {
  const { cellSize, levelHeight } = map.classicStructure;
  const half = cellSize / 2;
  const out: WorldBox[] = [];
  for (const [key, occ] of cells) {
    const facade = occ.placement.options?.facade;
    if (!facade || facade === 'none' || MODEL_FACADES.has(facade)) continue;
    const look = PACK_FACADES[facade as PackFacade];
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const cx = gx * cellSize;
    const cz = gy * cellSize;
    const baseY = gz * levelHeight;
    const ground = !cells.has(`${gx},${gy},${gz - 1}`);
    const roofed = cells.has(`${gx},${gy},${gz + 1}`);
    const id = occ.placement.id;
    const add = (side: Side, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, material: string, tint: string | null = null) => {
      out.push({ ...sideBox(side, cx, cz, half, u0, u1, baseY + y0, baseY + y1, v0, v1, id, 'trim'), surface: { material, tint } });
    };
    const dressed = new Set<Side>();
    for (const side of SIDES) {
      const style = resolveEdge(cells, gx, gy, gz, side);
      if (!FACADE_WALLS.has(style)) continue;
      const [dx, dy] = SIDE_DIRS[side];
      const there = cells.get(`${gx + dx},${gy + dy},${gz}`);
      if (there && !there.def.open) continue;
      dressed.add(side);
      const base = there && resolveEdge(cells, gx + dx, gy + dy, gz, OPPOSITE[side]) !== 'none' ? TILE_DIMENSIONS.wallThickness : 0;
      const out0 = -base - look.depth;
      const segs = edgeSegments(style, half, levelHeight).filter((g) => g[4] >= 0.3);
      for (const [u0, u1, y0, y1] of segs) add(side, u0, u1, y0, y1, out0, -base, look.skin, look.tint);
      const top = Math.max(0, ...segs.map((g) => g[3]));
      const full = top >= levelHeight - 1e-6;
      switch (facade) {
        case 'concrete':
          if (ground) add(side, -half, half, 0, 0.45, out0 - 0.08, -base, 'core.pbr_concrete_dark');
          if (!roofed && full) add(side, -half, half, top, top + 0.3, out0 - 0.12, TILE_DIMENSIONS.wallThickness, 'core.pbr_concrete');
          break;
        case 'corrugated':
          if (!roofed && full) add(side, -half, half, top - 0.05, top + 0.15, out0 - 0.06, TILE_DIMENSIONS.wallThickness, 'core.pbr_steel');
          if (ground) add(side, -half, half, 0, 0.2, out0 - 0.03, -base, 'core.pbr_concrete');
          break;
        case 'false_front':
          if (STREET_FACES.has(style)) {
            // A tall plank front over the roofline, stepped up in the middle.
            if (!roofed && full) {
              add(side, -half, half, top, top + 1.4, out0 - 0.02, -base + 0.1, 'core.pbr_weathered_planks');
              add(side, -half / 2, half / 2, top + 1.4, top + 2.0, out0 - 0.02, -base + 0.1, 'core.pbr_weathered_planks');
              add(side, -half - 0.05, half + 0.05, top + 1.4, top + 1.52, out0 - 0.1, -base + 0.1, 'core.pbr_charred_wood');
              add(side, -half / 2 - 0.05, half / 2 + 0.05, top + 2.0, top + 2.12, out0 - 0.1, -base + 0.1, 'core.pbr_charred_wood');
            }
            if (ground) {
              // An awning over the street and a boardwalk under it.
              add(side, -half, half, 3.05, 3.17, out0 - 1.8, out0, 'core.pbr_weathered_planks', '#b8a080');
              for (const u of [-half + 0.2, half - 0.2]) add(side, u - 0.06, u + 0.06, 2.5, 3.05, out0 - 0.6, out0, 'core.pbr_charred_wood');
              add(side, -half, half, 0, 0.06, out0 - 1.8, out0, 'core.pbr_weathered_planks');
            }
          } else if (!roofed && full) add(side, -half, half, top, top + 0.2, out0 - 0.06, TILE_DIMENSIONS.wallThickness, 'core.pbr_charred_wood');
          break;
        case 'gothic_stone':
        case 'collegiate_stone': {
          // A stone plinth, buttresses at the ends of each wall, a string course, hood moulds over the openings and a
          // battlemented parapet with pinnacles over the buttresses: dark flagstone dressing on Gothic stone, dressed
          // limestone on Collegiate stone.
          const [dressing, plinthTint, courseTint] = facade === 'collegiate_stone' ? ['core.stone_trim', '#c4bfb2', '#d8d3c6'] : ['core.pbr_flagstone', '#8a8a90', '#a0a0a8'];
          if (ground) add(side, -half, half, 0, 0.6, out0 - 0.1, -base, dressing, plinthTint);
          if (full) for (const u of [-half + 0.45, half - 0.45]) {
            add(side, u - 0.32, u + 0.32, 0, levelHeight * 0.6, out0 - 0.55, out0, look.skin, look.tint);
            add(side, u - 0.26, u + 0.26, levelHeight * 0.6, levelHeight, out0 - 0.3, out0, look.skin, look.tint);
          }
          if (full) add(side, -half, half, levelHeight - 0.62, levelHeight - 0.5, out0 - 0.1, out0, dressing, courseTint);
          for (const o of facadeOpenings(segs)) if (o.top < levelHeight - 0.4) add(side, o.u0 - 0.2, o.u1 + 0.2, o.top, o.top + 0.16, out0 - 0.12, out0, dressing, courseTint);
          if (!roofed && full) {
            add(side, -half, half, top, top + 0.3, out0 - 0.08, TILE_DIMENSIONS.wallThickness, look.skin, look.tint);
            for (let u = -half + 1.2; u < half - 0.9; u += 1.2) add(side, u - 0.3, u + 0.3, top + 0.3, top + 0.75, out0 - 0.08, 0, look.skin, look.tint);
            for (const u of [-half + 0.45, half - 0.45]) {
              add(side, u - 0.22, u + 0.22, top, top + 1.3, out0 - 0.3, out0, look.skin, look.tint);
              add(side, u - 0.12, u + 0.12, top + 1.3, top + 1.7, out0 - 0.2, out0 - 0.1, dressing, courseTint);
            }
          }
          break;
        }
        case 'manor_brick': {
          // Victorian brick: a stone plinth, stone quoins up the corners, stone sills and lintels, a bracketed cornice.
          if (ground) add(side, -half, half, 0, 0.5, out0 - 0.08, -base, 'core.pbr_concrete', '#b8b0a4');
          if (full) for (let y = 0.5, i = 0; y < levelHeight - 0.1; y += 0.35, i++) for (const sgn of [-1, 1]) {
            const w = i % 2 ? 0.35 : 0.55;
            const u = sgn * half;
            add(side, sgn < 0 ? u : u - w, sgn < 0 ? u + w : u, y, y + 0.3, out0 - 0.05, out0, 'core.pbr_concrete', '#c8c0b4');
          }
          for (const o of facadeOpenings(segs)) {
            if (o.top < levelHeight - 0.3) add(side, o.u0 - 0.12, o.u1 + 0.12, o.top, o.top + 0.24, out0 - 0.06, out0, 'core.pbr_concrete', '#c8c0b4');
            if (o.sill > 0.3) add(side, o.u0 - 0.1, o.u1 + 0.1, o.sill - 0.08, o.sill, out0 - 0.12, out0, 'core.pbr_concrete', '#c8c0b4');
          }
          if (!roofed && full) {
            add(side, -half, half, top - 0.1, top + 0.25, out0 - 0.35, TILE_DIMENSIONS.wallThickness, 'core.dark_wood');
            for (let u = -half + 0.5; u < half - 0.3; u += 1) add(side, u - 0.07, u + 0.07, top - 0.4, top - 0.1, out0 - 0.28, out0, 'core.dark_wood');
          }
          break;
        }
        case 'temple': {
          // A stepped base (talud), a carved frieze of glyph blocks and stepped merlons along the top.
          if (ground) {
            add(side, -half, half, 0, 0.5, out0 - 0.5, -base, look.skin, '#b8b8a0');
            add(side, -half, half, 0.5, 0.9, out0 - 0.25, -base, look.skin, '#b8b8a0');
          }
          if (full) {
            add(side, -half, half, levelHeight - 0.9, levelHeight - 0.25, out0 - 0.12, out0, 'core.pbr_travertine', '#a8b090');
            for (let u = -half + 0.5; u < half - 0.2; u += 1) add(side, u - 0.22, u + 0.22, levelHeight - 0.8, levelHeight - 0.35, out0 - 0.2, out0 - 0.12, 'core.pbr_jungle_rock');
          }
          if (!roofed && full) for (let u = -half + 0.5; u < half - 0.2; u += 1.33) {
            add(side, u - 0.4, u + 0.4, top, top + 0.35, out0 - 0.06, 0, look.skin, look.tint);
            add(side, u - 0.22, u + 0.22, top + 0.35, top + 0.7, out0 - 0.06, -0.1, look.skin, look.tint);
          }
          break;
        }
        case 'overgrown': {
          // Old rock walls swallowed by the jungle: moss along the foot and the top, vines hanging down the face.
          const rnd = seededRandom(`${id}:${key}:${side}`);
          if (ground) add(side, -half, half, 0, 0.35, out0 - 0.25, -base, 'core.pbr_moss');
          if (!roofed && full) add(side, -half, half, top - 0.25, top + 0.2, out0 - 0.2, TILE_DIMENSIONS.wallThickness, 'core.pbr_moss');
          const openings = facadeOpenings(segs);
          for (let i = 0; i < 6; i++) {
            const u = -half + 0.4 + rnd() * (2 * half - 0.8);
            const hang = 0.8 + rnd() * (levelHeight - 1.2);
            // Keep vines out of doorways and windows.
            if (openings.some((o) => u > o.u0 - 0.2 && u < o.u1 + 0.2 && levelHeight - hang < o.top)) continue;
            add(side, u - 0.06 - rnd() * 0.1, u + 0.06 + rnd() * 0.1, levelHeight - hang, levelHeight, out0 - 0.05, out0, 'core.pbr_moss', '#6a8a40');
          }
          break;
        }
        case 'clapboard':
        case 'suburban_brick': {
          // Painted trim: corner boards, a block or brick plinth, window shutters and sills, a fascia under the roof.
          const white = 'core.paint_matte';
          const trimTint = '#f2f0ea';
          if (ground) add(side, -half, half, 0, 0.45, out0 - 0.05, -base, facade === 'clapboard' ? 'core.pbr_brick_red' : 'core.pbr_concrete', facade === 'clapboard' ? '#b08070' : '#c8c4bc');
          if (facade === 'clapboard' && full) for (const u of [-half, half - 0.22]) add(side, u, u + 0.22, 0, levelHeight, out0 - 0.04, out0, white, trimTint);
          const shutter = facade === 'clapboard' ? '#2e4a6a' : '#3a5a3a';
          for (const o of facadeOpenings(segs)) {
            if (o.sill > 0.3) {
              for (const [a, b] of [[o.u0 - 0.6, o.u0 - 0.08], [o.u1 + 0.08, o.u1 + 0.6]] as const) if (a > -half + 0.2 && b < half - 0.2) add(side, a, b, o.sill, o.top, out0 - 0.06, out0, 'core.paint_matte', shutter);
              add(side, o.u0 - 0.1, o.u1 + 0.1, o.sill - 0.06, o.sill, out0 - 0.1, out0, white, trimTint);
            }
            if (o.top < levelHeight - 0.2) add(side, o.u0 - 0.1, o.u1 + 0.1, o.top, o.top + 0.14, out0 - 0.05, out0, white, trimTint);
          }
          if (!roofed && full) add(side, -half, half, top - 0.3, top, out0 - 0.08, out0, white, trimTint);
          break;
        }
        case 'roman':
          // A plinth, pilasters at the ends of each wall, a marble cornice along the top.
          if (ground) add(side, -half, half, 0, 0.5, out0 - 0.1, -base, 'core.pbr_travertine');
          for (const u of [-half + 0.35, half - 0.35]) add(side, u - 0.3, u + 0.3, ground ? 0.5 : 0, Math.min(top, levelHeight), out0 - 0.14, out0, 'core.pbr_white_marble');
          if (!roofed && full) add(side, -half, half, top - 0.1, top + 0.35, out0 - 0.2, TILE_DIMENSIONS.wallThickness, 'core.pbr_white_marble');
          break;
        case 'egyptian':
          // A painted band of hieroglyphs under a gilded roll and a cavetto cornice; a sandstone plinth.
          if (ground) add(side, -half, half, 0, 0.4, out0 - 0.08, -base, 'core.pbr_rough_sandstone');
          if (full) add(side, -half, half, levelHeight - 1.5, levelHeight - 0.45, out0 - 0.01, out0, 'core.hieroglyphs_painted');
          if (!roofed && full) {
            add(side, -half, half, top - 0.45, top - 0.3, out0 - 0.08, out0, 'core.gold_leaf');
            add(side, -half, half, top - 0.3, top + 0.45, out0 - 0.35, TILE_DIMENSIONS.wallThickness, 'core.pbr_sandstone_blocks');
          }
          break;
        case 'timber_frame':
        case 'village_plaster': {
          // Medieval Village: a stone ground storey under the half-timbering (or whitewash), a jetty beam
          // at each floor, oak corner posts, shutters beside the windows and an oak eaves board.
          const oakBeam = 'core.oak_beam';
          if (ground && facade === 'timber_frame') add(side, -half, half, 0, Math.min(top, levelHeight), out0 - 0.04, out0, 'core.pbr_castle_stone', '#c8c2b0');
          else if (ground) add(side, -half, half, 0, 0.45, out0 - 0.08, -base, 'core.pbr_castle_stone', '#a8a090');
          if (full) add(side, -half, half, levelHeight - 0.2, levelHeight + 0.05, out0 - 0.14, out0, oakBeam);
          if (facade === 'village_plaster' && full) for (const u of [-half, half - 0.25]) add(side, u, u + 0.25, 0, levelHeight, out0 - 0.06, out0, oakBeam);
          for (const o of facadeOpenings(segs)) {
            if (o.sill > 0.3) {
              for (const [a, b] of [[o.u0 - 0.55, o.u0 - 0.05], [o.u1 + 0.05, o.u1 + 0.55]] as const) if (a > -half + 0.2 && b < half - 0.2) add(side, a, b, o.sill, o.top, out0 - 0.06, out0, 'core.oak_beam', '#6a4a30');
              add(side, o.u0 - 0.1, o.u1 + 0.1, o.sill - 0.08, o.sill, out0 - 0.12, out0, oakBeam);
            }
            if (o.top < levelHeight - 0.3) add(side, o.u0 - 0.15, o.u1 + 0.15, o.top, o.top + 0.18, out0 - 0.08, out0, oakBeam);
          }
          if (!roofed && full) add(side, -half, half, top - 0.05, top + 0.3, out0 - 0.3, TILE_DIMENSIONS.wallThickness, 'core.roof_tiles_red');
          break;
        }
        case 'prefab':
        case 'snow_bunker': {
          // Snow Outpost: white corner posts and a steel plinth (prefab), or a snow berm (bunker); steel hoods over
          // the openings with snow on them; a snow cap along the top.
          const snow = 'core.drift_snow';
          if (facade === 'prefab') {
            if (ground) add(side, -half, half, 0, 0.35, out0 - 0.06, -base, 'core.pbr_steel', '#8a9098');
            if (full) for (const u of [-half, half - 0.2]) add(side, u, u + 0.2, 0, levelHeight, out0 - 0.04, out0, 'core.prefab_white');
          } else if (ground) add(side, -half, half, 0, 0.6, out0 - 0.3, -base, snow);
          for (const o of facadeOpenings(segs)) {
            add(side, o.u0 - 0.15, o.u1 + 0.15, o.top, o.top + 0.12, out0 - 0.25, out0, 'core.pbr_steel', '#a8b0b8');
            add(side, o.u0 - 0.15, o.u1 + 0.15, o.top + 0.12, o.top + 0.2, out0 - 0.25, out0, snow);
          }
          if (!roofed && full) add(side, -half, half, top - 0.05, top + 0.2, out0 - 0.15, TILE_DIMENSIONS.wallThickness, snow);
          break;
        }
        case 'harbour_render':
        case 'tarred_timber': {
          // Coastal Harbor: a granite plinth, frames and sills round the windows (harbour blue on the render,
          // white on the tarred boards) and a slate drip course under the eaves.
          const frame = facade === 'harbour_render' ? 'core.harbour_paint' : 'core.paint_matte';
          if (ground) add(side, -half, half, 0, 0.5, out0 - 0.08, -base, 'core.quay_granite');
          for (const o of facadeOpenings(segs)) {
            if (o.sill > 0.3) add(side, o.u0 - 0.1, o.u1 + 0.1, o.sill - 0.1, o.sill, out0 - 0.12, out0, frame);
            if (o.top < levelHeight - 0.3) add(side, o.u0 - 0.1, o.u1 + 0.1, o.top, o.top + 0.14, out0 - 0.08, out0, frame);
            for (const u of [o.u0 - 0.1, o.u1]) add(side, u, u + 0.1, o.sill, o.top, out0 - 0.06, out0, frame);
          }
          if (!roofed && full) add(side, -half, half, top - 0.05, top + 0.2, out0 - 0.25, TILE_DIMENSIONS.wallThickness, 'core.pbr_slate_roof');
          break;
        }
        case 'desert_ashlar':
        case 'desert_plaster': {
          // Desert City: a sandstone plinth, a carved band (or stone quoins on plaster), lattice screens
          // and cedar lintels at the windows, a stepped parapet over a cornice (cedar beam ends on plaster).
          const stone = 'core.ashlar';
          if (ground) add(side, -half, half, 0, 0.5, out0 - 0.08, -base, stone, '#c8a878');
          if (facade === 'desert_ashlar' && full) add(side, -half, half, levelHeight - 0.75, levelHeight - 0.45, out0 - 0.06, out0, 'core.zellige');
          if (facade === 'desert_plaster' && full) for (const u of [-half, half - 0.5]) for (let y = 0; y < levelHeight - 0.2; y += 0.8) add(side, u + (y % 1.6 ? 0.1 : 0), u + 0.5, y, y + 0.4, out0 - 0.04, out0, stone);
          for (const o of facadeOpenings(segs)) {
            if (o.sill > 0.3) {
              add(side, o.u0, o.u1, o.sill, o.top, out0 + 0.02, out0 + 0.06, 'core.mashrabiya');
              add(side, o.u0 - 0.1, o.u1 + 0.1, o.sill - 0.1, o.sill, out0 - 0.12, out0, stone, '#b89868');
            }
            if (o.top < levelHeight - 0.3) add(side, o.u0 - 0.2, o.u1 + 0.2, o.top, o.top + 0.2, out0 - 0.1, out0, 'core.cedar');
          }
          if (!roofed && full) {
            add(side, -half, half, top - 0.1, top + 0.15, out0 - 0.2, TILE_DIMENSIONS.wallThickness, stone, '#c0a070');
            add(side, -half, half, top + 0.15, top + 0.6, out0 - 0.05, TILE_DIMENSIONS.wallThickness, look.skin, look.tint);
            for (let u = -half + 0.7; u < half - 0.6; u += 1.4) add(side, u - 0.3, u + 0.3, top + 0.6, top + 0.95, out0 - 0.05, 0.1, look.skin, look.tint);
            if (facade === 'desert_plaster') for (let u = -half + 0.9; u < half - 0.5; u += 1.8) add(side, u - 0.1, u + 0.1, top - 0.6, top - 0.4, out0 - 0.45, out0, 'core.cedar');
          }
          break;
        }
        case 'adobe':
          if (!roofed && full) {
            add(side, -half, half, top, top + 0.4, out0, TILE_DIMENSIONS.wallThickness, look.skin);
            // Vigas: roof beams poking out below the parapet.
            for (let u = -half + 0.8; u < half - 0.4; u += 1.6) add(side, u - 0.11, u + 0.11, top - 0.75, top - 0.53, out0 - 0.55, out0, 'core.pbr_walnut', '#8a6a4a');
          }
          break;
      }
    }
    // Fill the outer corners where two dressed sides meet.
    for (const [a, c, sx, sz] of CELL_CORNERS) {
      if (!dressed.has(a) || !dressed.has(c)) continue;
      const d = look.depth;
      const x0 = sx > 0 ? cx + half : cx - half - d;
      const z0 = sz > 0 ? cz + half : cz - half - d;
      out.push({ min: [x0, baseY, z0], max: [x0 + d, baseY + levelHeight, z0 + d], kind: 'trim', sourceId: id, surface: { material: look.skin, tint: look.tint } });
    }
  }
  return out;
}

/** Tiles drawn with a model (city buildings and streets): the model, where its centre goes and how it is turned. */
export function tileModels(map: MapDocument, catalog: TileCatalog = coreCatalog): { id: string; file: string; at: [number, number, number]; yaw: number }[] {
  const { cellSize, levelHeight } = map.classicStructure;
  const out: { id: string; file: string; at: [number, number, number]; yaw: number }[] = [];
  for (const placement of map.classicStructure.tiles) {
    const def = catalog.get(placement.tile);
    if (!def?.model) continue;
    const [w, d] = footprintSize(def);
    const [mx, mz] = rotateXZ(((w - 1) * cellSize) / 2, ((d - 1) * cellSize) / 2, placement.rotation);
    out.push({ id: placement.id, file: def.model.file, at: [placement.x * cellSize + mx, placement.z * levelHeight + (def.model.lift ?? 0), placement.y * cellSize + mz], yaw: (placement.rotation % 4) * (Math.PI / 2) });
  }
  return out;
}
