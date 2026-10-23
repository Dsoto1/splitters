import { SIDES, SIDE_DIRS, TILE_DIMENSIONS, coreCatalog, type EdgeStyle, type LocalBox, type Side, type TileCatalog, type TileDefinition } from './catalog.ts';
import type { MapDocument, TilePlacement } from './schema.ts';
import { getProp } from '../content/props.ts';

/**
 * `trim` boxes are visual only (baseboards, cornices, frames): never in physics
 * or navigation. `prop` boxes are the collision of placed props: physics and
 * navigation only, the prop's model is drawn instead.
 */
export type BoxKind = 'floor' | 'wall' | 'solid' | 'trim' | 'prop';

/** World-space axis-aligned box. Shared by physics, navigation and rendering. */
export interface WorldBox {
  min: [number, number, number];
  max: [number, number, number];
  kind: BoxKind;
  /** Placement that produced this box, for editor focus and debugging. */
  sourceId: string;
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
  const fallback = here.def.edgeDefault ?? 'wall';
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
      return [[-half, -1.3, 0, height, t], [1.3, half, 0, height, t], [-1.3, 1.3, 0, 1, t], [-1.3, 1.3, top(2.4), height, t]];
    case 'windows':
      return [[-half, -2.7, 0, height, t], [-0.8, 0.8, 0, height, t], [2.7, half, 0, height, t], [-2.7, -0.8, 0, 1, t], [0.8, 2.7, 0, 1, t], [-2.7, -0.8, top(2.4), height, t], [0.8, 2.7, top(2.4), height, t]];
    case 'slit':
      return [[-half, -1.5, 0, height, t], [1.5, half, 0, height, t], [-1.5, 1.5, 0, 1.25, t], [-1.5, 1.5, top(1.6), height, t]];
    case 'half':
      return [[-half, half, 0, 1.1, t]];
    case 'railing':
      return [[-half, half, 0, 1, 0.12]];
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
      window(-1.3, 1.3, 1, 2.4);
      return out;
    case 'windows':
      base(-half, half);
      cornice(-half, half);
      window(-2.7, -0.8, 1, 2.4);
      window(0.8, 2.7, 1, 2.4);
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

/** Collision of solid props: the prop's box, scaled and turned (as its axis-aligned bounds). */
export function propBoxes(map: MapDocument): WorldBox[] {
  const out: WorldBox[] = [];
  for (const e of map.entities) {
    if (e.kind !== 'prop' || !e.solid) continue;
    const def = getProp(e.model);
    if (!def?.collision) continue;
    const [w, h, d] = def.collision.map((v) => v * e.scale) as [number, number, number];
    const c = Math.abs(Math.cos(e.yaw));
    const s = Math.abs(Math.sin(e.yaw));
    const hx = (w * c + d * s) / 2;
    const hz = (w * s + d * c) / 2;
    const [x, y, z] = e.position;
    out.push({ min: [x - hx, y, z - hz], max: [x + hx, y + h, z + hz], kind: 'prop', sourceId: e.id });
  }
  return out;
}

/** Lowest point anyone can stand on, minus a margin: falling past it kills. */
export function mapKillY(boxes: readonly WorldBox[]): number {
  let low = Infinity;
  for (const b of boxes) if (b.kind === 'floor') low = Math.min(low, b.max[1]);
  return Number.isFinite(low) ? low - 14 : -40;
}

function buildBoxes(map: MapDocument, catalog: TileCatalog, decor: boolean): WorldBox[] {
  const { cellSize, levelHeight } = map.classicStructure;
  const { floorThickness } = TILE_DIMENSIONS;
  const { cells } = buildOccupancy(map, catalog);
  const boxes: WorldBox[] = [];
  const half = cellSize / 2;

  for (const [key, occ] of cells) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const cx = gx * cellSize;
    const cz = gy * cellSize;
    const baseY = gz * levelHeight;
    const id = occ.placement.id;

    if (!decor && occ.def.floors.includes(occ.level)) {
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

  if (decor) return boxes;
  boxes.push(...propBoxes(map));
  for (const placement of map.classicStructure.tiles) {
    const def = catalog.get(placement.tile);
    if (!def) continue;
    const cx = placement.x * cellSize;
    const cz = placement.y * cellSize;
    const baseY = placement.z * levelHeight;
    for (const f of def.extraFloors ?? []) boxes.push(rotateLocalBox(f, placement.rotation, cx, baseY, cz, placement.id, 'floor'));
    for (const solid of def.solids ?? []) boxes.push(rotateLocalBox(solid, placement.rotation, cx, baseY, cz, placement.id, 'solid'));
  }
  return boxes;
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
    for (let c = 0; c < 8; c++) {
      positions[(i * 8 + c) * 3] = c & 1 ? b.max[0] : b.min[0];
      positions[(i * 8 + c) * 3 + 1] = c & 2 ? b.max[1] : b.min[1];
      positions[(i * 8 + c) * 3 + 2] = c & 4 ? b.max[2] : b.min[2];
    }
    faces.forEach((f, fi) => {
      const o = i * 36 + fi * 6;
      const base = i * 8;
      indices.set([base + f[0]!, base + f[1]!, base + f[2]!, base + f[0]!, base + f[2]!, base + f[3]!], o);
    });
  });
  return { positions, indices };
}
