import { PLAYER } from '../sim/constants.ts';
import { SIDES, SIDE_DIRS, TILE_DIMENSIONS, coreCatalog, floorInsertBoxes, footprintSize, roomLayoutBoxes, type Corner, type EdgeStyle, type LocalBox, type Side, type TileCatalog, type TileDefinition } from './catalog.ts';
import type { MapDocument, MapEntity, TilePlacement } from './schema.ts';
import { getProp } from '../content/props.ts';
import { terrainBoundary, terrainTriangles } from './terrain.ts';
import { resolveBackdrop } from './backdrop.ts';

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
  /** Material for every face (free blocks), instead of the theme's. */
  surface?: { material: string; tint: string | null };
}

/** Turn an (x, z) offset by `yaw` about +Y (right-handed, the same as physics and the renderer). */
export function yawXZ(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

/** A box's 8 corners in world space; corner i has bit0 → max x, bit1 → max y, bit2 → max z (in the box's own frame). */
export function boxCorners(b: Pick<WorldBox, 'min' | 'max' | 'yaw'>): [number, number, number][] {
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const out: [number, number, number][] = [];
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
export function boxFootprint(b: Pick<WorldBox, 'min' | 'max' | 'yaw'>): [number, number][] {
  const c = boxCorners(b);
  return [c[0]!, c[1]!, c[5]!, c[4]!].map((p) => [p[0], p[2]] as [number, number]);
}

/** World-axis bounds of a (possibly turned) box. */
export function boxBounds(b: Pick<WorldBox, 'min' | 'max' | 'yaw'>): { min: [number, number, number]; max: [number, number, number] } {
  if (!b.yaw) return { min: [...b.min], max: [...b.max] };
  const f = boxFootprint(b);
  const xs = f.map((p) => p[0]);
  const zs = f.map((p) => p[1]);
  return { min: [Math.min(...xs), b.min[1], Math.min(...zs)], max: [Math.max(...xs), b.max[1], Math.max(...zs)] };
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

/** Whether a cell has walkable floor of its own (a full slab or partial floors). */
export function cellHasFloor(occ: CellOccupant): boolean {
  return occ.def.floors.includes(occ.level) || !!occ.def.extraFloors?.length;
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
  const choice = (occ: CellOccupant | undefined, s: Side) => occ?.placement.edges?.[edgeKey(occ.local, localSide(s, occ.placement.rotation))];
  const picked = choice(here, side) ?? choice(there, OPPOSITE[side]);
  const fallback = here.def.edgeDefaults?.[edgeKey(here.local, localSide(side, here.placement.rotation))] ?? here.def.edgeDefault ?? 'wall';
  const openish = fallback === 'open' || fallback === 'railing';
  let style: EdgeStyle = picked ?? 'auto';
  if (style === 'auto') {
    // Ports meeting: nothing between open ground, no frame of its own on a platform or bridge, else a doorway.
    if (isOpenEdge(cells, x, y, z, side)) style = (here.def.open && there?.def.open) || openish ? 'open' : 'door';
    else style = fallback;
  }
  return style === 'open' || style === 'auto' ? 'none' : style;
}

/** Wall pieces of an edge style along one side: [u0, u1, y0, y1, thickness] with u along the side (-half..half). */
export function edgeSegments(style: ResolvedEdge, half: number, height: number): [number, number, number, number, number][] {
  const t = TILE_DIMENSIONS.wallThickness;
  const top = (h: number) => Math.min(h, height);
  switch (style) {
    case 'none':
      return [];
    case 'wall':
      return [[-half, half, 0, height, t]];
    case 'door': {
      const d = TILE_DIMENSIONS.doorWidth / 2;
      return [[-half, -d, 0, height, t], [d, half, 0, height, t], [-d, d, top(TILE_DIMENSIONS.doorHeight), height, t]];
    }
    case 'wide':
      return [[-half, -2.5, 0, height, t], [2.5, half, 0, height, t], [-2.5, 2.5, top(3.5), height, t]];
    case 'arch':
      return [[-half, -half + 0.75, 0, height, t], [half - 0.75, half, 0, height, t], [-half + 0.75, half - 0.75, top(3.4), height, t]];
    case 'window':
      // Sill 0.9 m, opening 1.6 m: jump and crouch (legs tucked) to climb through.
      return [[-half, -1.3, 0, height, t], [1.3, half, 0, height, t], [-1.3, 1.3, 0, 0.9, t], [-1.3, 1.3, top(2.5), height, t]];
    case 'windows':
      return [[-half, -2.7, 0, height, t], [-0.8, 0.8, 0, height, t], [2.7, half, 0, height, t], [-2.7, -0.8, 0, 0.9, t], [0.8, 2.7, 0, 0.9, t], [-2.7, -0.8, top(2.5), height, t], [0.8, 2.7, top(2.5), height, t]];
    case 'slit':
      return [[-half, -1.5, 0, height, t], [1.5, half, 0, height, t], [-1.5, 1.5, 0, 1.25, t], [-1.5, 1.5, top(1.6), height, t]];
    case 'half':
      return [[-half, half, 0, 1.1, t]];
    case 'railing':
      return [[-half, half, 0, 1, 0.12]];
    case 'high':
      return [[-half, half, 0, height * 2, t]];
    case 'tower':
      return [[-half, half, 0, height * 4, t]];
    case 'fence': {
      // Posts every metre and three rails: 3 m high, see-through, stops players and blocks most shots' paths only at the bars.
      const out: [number, number, number, number, number][] = [];
      for (let u = -half; u <= half + 1e-6; u += 1) out.push([Math.max(-half, u - 0.06), Math.min(half, u + 0.06), 0, 3, 0.12]);
      out.push([-half, half, 0.05, 0.2, 0.1], [-half, half, 1.45, 1.6, 0.1], [-half, half, 2.85, 3, 0.1]);
      return out;
    }
    case 'broken':
      // A ragged hole knocked through, a heap of masonry on one side of it.
      return [[-half, -2.2, 0, height, t], [1.4, half, 0, height, t], [-2.2, -0.6, top(2.7), height, t], [-0.6, 1.4, top(3.2), height, t], [-2.2, -1.3, 0, 0.45, t]];
    case 'bars': {
      // Floor-to-ceiling bars 0.3 m apart: see and shoot through, nobody squeezes through.
      const out: [number, number, number, number, number][] = [];
      for (let u = -half + 0.15; u < half - 0.1; u += 0.3) out.push([u - 0.03, u + 0.03, 0, height, 0.1]);
      out.push([-half, half, 0, 0.12, 0.12], [-half, half, height - 0.15, height, 0.12]);
      return out;
    }
    case 'shutter':
      // A wide opening with its roller shutter stuck 1.35 m up: crouch under it.
      return [[-half, -2.5, 0, height, t], [2.5, half, 0, height, t], [-2.5, 2.5, top(3.5), height, t], [-2.5, 2.5, 1.35, top(3.5), 0.12]];
  }
}

/** Visual trim for an edge (inner face only): [u0, u1, y0, y1, depth] standing off the wall face. */
function edgeTrim(style: ResolvedEdge, half: number, height: number): [number, number, number, number, number][] {
  const out: [number, number, number, number, number][] = [];
  const base = (u0: number, u1: number) => out.push([u0, u1, 0, 0.16, 0.04]);
  const cornice = (u0: number, u1: number) => height >= 3 && out.push([u0, u1, height - 0.2, height, 0.07]);
  const frame = (d: number, h: number) => out.push([-d - 0.16, -d, 0, h, 0.06], [d, d + 0.16, 0, h, 0.06], [-d - 0.16, d + 0.16, h, h + 0.16, 0.06]);
  const window = (u0: number, u1: number, y0: number, y1: number) => out.push([u0 - 0.08, u1 + 0.08, y0 - 0.08, y0, 0.12], [u0 - 0.1, u1 + 0.1, y1, y1 + 0.12, 0.05], [u0 - 0.1, u0, y0, y1, 0.05], [u1, u1 + 0.1, y0, y1, 0.05]);
  switch (style) {
    case 'none':
      return out;
    case 'wall':
      base(-half, half);
      cornice(-half, half);
      return out;
    case 'door':
    case 'wide': {
      const d = style === 'door' ? TILE_DIMENSIONS.doorWidth / 2 : 2.5;
      base(-half, -d - 0.16);
      base(d + 0.16, half);
      cornice(-half, half);
      if (height > (style === 'door' ? TILE_DIMENSIONS.doorHeight : 3.5) + 0.2) frame(d, style === 'door' ? TILE_DIMENSIONS.doorHeight : 3.5);
      return out;
    }
    case 'arch':
      base(-half, -half + 0.75);
      base(half - 0.75, half);
      cornice(-half, half);
      out.push([-half + 0.75, half - 0.75, 3.25, 3.4, 0.08]);
      return out;
    case 'window':
      base(-half, half);
      cornice(-half, half);
      window(-1.3, 1.3, 0.9, 2.5);
      return out;
    case 'windows':
      base(-half, half);
      cornice(-half, half);
      window(-2.7, -0.8, 0.9, 2.5);
      window(0.8, 2.7, 0.9, 2.5);
      return out;
    case 'slit':
      base(-half, half);
      cornice(-half, half);
      window(-1.5, 1.5, 1.25, 1.6);
      return out;
    case 'half':
      base(-half, half);
      out.push([-half, half, 1.1, 1.18, 0.04]);
      return out;
    case 'high':
    case 'tower':
      base(-half, half);
      out.push([-half, half, height * (style === 'high' ? 2 : 4) - 0.2, height * (style === 'high' ? 2 : 4), 0.07]);
      return out;
    case 'fence':
    case 'bars':
      return out;
    case 'broken':
      base(-half, -2.2);
      base(1.4, half);
      cornice(-half, half);
      return out;
    case 'shutter':
      base(-half, -2.66);
      base(2.66, half);
      cornice(-half, half);
      if (height > 3.7) frame(2.5, 3.5);
      return out;
    case 'railing':
      // Posts every 2 m and a top rail.
      for (let u = -half + 0.1; u <= half - 0.1 + 1e-6; u += 2) out.push([u - 0.06, u + 0.06, 0, 1.08, 0.04]);
      out.push([-half, half, 0.95, 1.08, 0.05]);
      return out;
  }
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
  for (const e of map.entities) {
    // Breakable props are not static: the scenario runtime owns their colliders (ask for them with `breakable`).
    if (e.kind !== 'prop' || !e.solid || isBreakableProp(e) !== breakable) continue;
    const def = getProp(e.model);
    if (!def?.collision) continue;
    const [x, y, z] = e.position;
    const c = Math.cos(e.yaw);
    const s = Math.sin(e.yaw);
    if (def.boxes) {
      // Each part box turned with the prop (exact at right angles, its bounds otherwise).
      for (const [x0, y0, z0, x1, y1, z1] of def.boxes) {
        const cx = ((x0 + x1) / 2) * e.scale;
        const cz = ((z0 + z1) / 2) * e.scale;
        const hw = ((x1 - x0) / 2) * e.scale;
        const hd = ((z1 - z0) / 2) * e.scale;
        // Turned the way a mesh is by rotation.y = yaw: local +Z goes to (sin, cos).
        const px = x + cx * c + cz * s;
        const pz = z - cx * s + cz * c;
        const hx = hw * Math.abs(c) + hd * Math.abs(s);
        const hz = hw * Math.abs(s) + hd * Math.abs(c);
        out.push({ min: [px - hx, y + y0 * e.scale, pz - hz], max: [px + hx, y + y1 * e.scale, pz + hz], kind: 'prop', sourceId: e.id });
      }
      continue;
    }
    const [w, h, d] = def.collision.map((v) => v * e.scale) as [number, number, number];
    const hx = (w * Math.abs(c) + d * Math.abs(s)) / 2;
    const hz = (w * Math.abs(s) + d * Math.abs(c)) / 2;
    if (isRock(def) && h > PLAYER.maxStepHeight) {
      // Rocks are round, not crates: a wide low tier you can hop onto and a narrower top,
      // so big rocks can be climbed over and their corners don't snag you.
      const low = Math.min(h * 0.5, 0.7);
      out.push({ min: [x - hx * 0.85, y, z - hz * 0.85], max: [x + hx * 0.85, y + low, z + hz * 0.85], kind: 'prop', sourceId: e.id });
      out.push({ min: [x - hx * 0.55, y + low, z - hz * 0.55], max: [x + hx * 0.55, y + h * 0.92, z + hz * 0.55], kind: 'prop', sourceId: e.id });
      continue;
    }
    if (isRock(def)) continue; // pebbles: walk straight over them
    out.push({ min: [x - hx, y, z - hz], max: [x + hx, y + h, z + hz], kind: 'prop', sourceId: e.id });
  }
  return out;
}

/**
 * Free blocks as world boxes. Solid blocks are level geometry; the others
 * (breakable, crumble, trapdoor) belong to the scenario runtime, which turns
 * their colliders on and off (ask for them with `dynamic`).
 */
export function blockBoxes(map: MapDocument, dynamic = false): WorldBox[] {
  const out: WorldBox[] = [];
  for (const e of map.entities) {
    if (e.kind !== 'block' || (e.behaviour !== 'solid') !== dynamic) continue;
    out.push(blockBox(e));
  }
  return out;
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

    if (!decor && occ.def.floors.includes(occ.level) && !(occ.level === 0 && rooms.noSlabs.has(id))) {
      boxes.push({ min: [cx - half, baseY - floorThickness, cz - half], max: [cx + half, baseY, cz + half], kind: 'floor', sourceId: id });
    }

    for (const side of SIDES) {
      const style = resolveEdge(cells, gx, gy, gz, side);
      if (decor) {
        const t = style === 'railing' ? 0.12 : TILE_DIMENSIONS.wallThickness;
        for (const [u0, u1, y0, y1, depth] of edgeTrim(style, half, levelHeight)) {
          boxes.push(sideBox(side, cx, cz, half, u0, u1, baseY + y0, baseY + y1, t, t + depth, id, 'trim'));
        }
      } else {
        for (const [u0, u1, y0, y1, t] of edgeSegments(style, half, levelHeight)) {
          boxes.push(sideBox(side, cx, cz, half, u0, u1, baseY + y0, baseY + y1, 0, t, id, 'wall'));
        }
      }
    }
  }

  if (decor) {
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
const CORNER_WALLS = new Set<ResolvedEdge>(['wall', 'door', 'wide', 'window', 'windows', 'slit', 'high', 'tower', 'shutter']);

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
        const roof = (x0: number, z0: number, x1: number, z1: number) => out.push({ min: [cx + x0, top - TILE_DIMENSIONS.floorThickness, cz + z0], max: [cx + x1, top, cz + z1], kind: 'floor', sourceId: placement.id });
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

function rotateLocalBox(box: LocalBox, rotation: number, cx: number, baseY: number, cz: number, sourceId: string, kind: BoxKind): WorldBox {
  if (box.yaw) {
    // Turned boxes keep their size; the centre turns with the tile and the yaw adds the tile's quarter turns.
    const hx = (box.max[0] - box.min[0]) / 2;
    const hz = (box.max[2] - box.min[2]) / 2;
    const [mx, mz] = rotateXZ((box.min[0] + box.max[0]) / 2, (box.min[2] + box.max[2]) / 2, rotation);
    return { min: [cx + mx - hx, baseY + box.min[1], cz + mz - hz], max: [cx + mx + hx, baseY + box.max[1], cz + mz + hz], kind, sourceId, yaw: box.yaw + (rotation % 4) * (Math.PI / 2) };
  }
  const [ax, az] = rotateXZ(box.min[0], box.min[2], rotation);
  const [bx, bz] = rotateXZ(box.max[0], box.max[2], rotation);
  return {
    min: [cx + Math.min(ax, bx), baseY + box.min[1], cz + Math.min(az, bz)],
    max: [cx + Math.max(ax, bx), baseY + box.max[1], cz + Math.max(az, bz)],
    kind,
    sourceId,
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
