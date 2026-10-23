import { SIDES, SIDE_DIRS, TILE_DIMENSIONS, coreCatalog, type LocalBox, type Side, type TileCatalog, type TileDefinition } from './catalog.ts';
import type { MapDocument, TilePlacement } from './schema.ts';

export type BoxKind = 'floor' | 'wall' | 'solid';

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
      cells.set(key, { placement, def, level: dz });
    }
  }
  return { cells, overlaps, unknownTiles };
}

function hasPort(occ: CellOccupant, worldSide: Side): boolean {
  return occ.def.ports.some((p) => p.level === occ.level && rotateSide(p.side, occ.placement.rotation) === worldSide);
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
 * solid walls (auto-cap), so any layout is enclosed and bots cannot walk off
 * into the void through a dangling doorway.
 */
export function buildMapGeometry(map: MapDocument, catalog: TileCatalog = coreCatalog): WorldBox[] {
  const { cellSize, levelHeight } = map.classicStructure;
  const { wallThickness: t, floorThickness, doorWidth, doorHeight } = TILE_DIMENSIONS;
  const { cells } = buildOccupancy(map, catalog);
  const boxes: WorldBox[] = [];
  const half = cellSize / 2;

  for (const [key, occ] of cells) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const cx = gx * cellSize;
    const cz = gy * cellSize;
    const baseY = gz * levelHeight;
    const id = occ.placement.id;

    if (occ.def.floors.includes(occ.level)) {
      boxes.push({ min: [cx - half, baseY - floorThickness, cz - half], max: [cx + half, baseY, cz + half], kind: 'floor', sourceId: id });
    }

    for (const side of SIDES) {
      const open = isOpenEdge(cells, gx, gy, gz, side);
      // Wall slab along this side, described in a frame where the side is "north":
      // u runs along the wall, v is the inset toward the cell centre.
      const segments: [number, number, number, number][] = []; // [u0, u1, y0, y1]
      const [nx, ny] = SIDE_DIRS[side];
      const seamless = open && occ.def.open && cells.get(cellKey(gx + nx, gy + ny, gz))?.def.open;
      if (seamless) {
        // Open ground on both sides: no wall at all.
      } else if (open) {
        const d = doorWidth / 2;
        segments.push([-half, -d, 0, levelHeight], [d, half, 0, levelHeight], [-d, d, doorHeight, levelHeight]);
      } else {
        segments.push([-half, half, 0, levelHeight]);
      }
      for (const [u0, u1, y0, y1] of segments) {
        boxes.push(sideBox(side, cx, cz, half, t, u0, u1, baseY + y0, baseY + y1, id));
      }
    }
  }

  for (const placement of map.classicStructure.tiles) {
    const def = catalog.get(placement.tile);
    if (!def?.solids) continue;
    const cx = placement.x * cellSize;
    const cz = placement.y * cellSize;
    const baseY = placement.z * levelHeight;
    for (const solid of def.solids) {
      boxes.push(rotateLocalBox(solid, placement.rotation, cx, baseY, cz, placement.id));
    }
  }
  return boxes;
}

function sideBox(side: Side, cx: number, cz: number, half: number, t: number, u0: number, u1: number, y0: number, y1: number, sourceId: string): WorldBox {
  const kind = 'wall' as const;
  switch (side) {
    case 'N':
      return { min: [cx + u0, y0, cz + half - t], max: [cx + u1, y1, cz + half], kind, sourceId };
    case 'S':
      return { min: [cx + u0, y0, cz - half], max: [cx + u1, y1, cz - half + t], kind, sourceId };
    case 'E':
      return { min: [cx + half - t, y0, cz + u0], max: [cx + half, y1, cz + u1], kind, sourceId };
    case 'W':
      return { min: [cx - half, y0, cz + u0], max: [cx - half + t, y1, cz + u1], kind, sourceId };
  }
}

function rotateLocalBox(box: LocalBox, rotation: number, cx: number, baseY: number, cz: number, sourceId: string): WorldBox {
  const [ax, az] = rotateXZ(box.min[0], box.min[2], rotation);
  const [bx, bz] = rotateXZ(box.max[0], box.max[2], rotation);
  return {
    min: [cx + Math.min(ax, bx), baseY + box.min[1], cz + Math.min(az, bz)],
    max: [cx + Math.max(ax, bx), baseY + box.max[1], cz + Math.max(az, bz)],
    kind: 'solid',
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
