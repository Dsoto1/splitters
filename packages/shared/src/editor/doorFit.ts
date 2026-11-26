/**
 * Doors that fit themselves (owner, 2026-11-18, "1a"; map format v52): a door placed in a wall, or given another look,
 * cuts that wall's opening to match it, whatever the wall is built with, and hangs in the middle of the wall's
 * thickness. On a tile's side, the side's edge style becomes the look's doorway (schema.ts doorwayOf: the Doorway for
 * square looks, the Arched doorway for the Arched door), on both cells' records where both are built; in a wall of free
 * blocks, each block the opening crosses gets the doorway in its `doorways` (map/blockDoorways.ts builds it). The
 * doorway is the wall's: removing the door leaves it, as the empty doorway that matched the door.
 */

import type { EditCommand } from './commands.ts';
import { blockRun, blockTakesDoorways } from '../map/blockDoorways.ts';
import { WALL_THICKNESS } from '../map/edgeShapes.ts';
import { buildOccupancy, cellKey, dynamicBlockIds, resolveEdge } from '../map/geometry.ts';
import { setEdgeCommand } from './operations.ts';
import { coreCatalog, type Side, type TileCatalog } from '../map/catalog.ts';
import { doorwayOf, type DoorwayStyle, type MapDocument, type MapEntity } from '../map/schema.ts';
import { DOOR } from '../sim/scenarioDefs.ts';

type Door = Extract<MapEntity, { kind: 'door' }>;
type Block = Extract<MapEntity, { kind: 'block' }>;

/** What fitting a door does: the door as it hangs (moved into the middle of the wall), the edits to the wall, and what the wall is. */
export interface DoorFit {
  door: Door;
  commands: EditCommand[];
  /** The wall it stands in: a tile's side, free blocks, or none (a door standing on its own: nothing to cut). */
  wall: 'side' | 'blocks' | null;
  /** The doorway the wall has for it. */
  doorway: DoorwayStyle;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The door's width along its own x (the opening it needs either side of its middle). */
const HALF_OPENING = DOOR.width / 2;
/** How far off a wall's plane a door may stand and still be in it. */
const ON_WALL = 0.35;

/** Fit `door` to the wall it stands in (see the module's note). A door in no wall comes back as it was, with no edits. */
export function fitDoor(doc: MapDocument, door: Door, catalog: TileCatalog = coreCatalog): DoorFit {
  const doorway = doorwayOf(door.style);
  return fitTileSide(doc, door, doorway, catalog) ?? fitBlocks(doc, door, doorway) ?? { door, commands: [], wall: null, doorway };
}

/** The door on a cell side (a wall along x between north and south cells, or along z between east and west ones). */
function fitTileSide(doc: MapDocument, door: Door, doorway: DoorwayStyle, catalog: TileCatalog): DoorFit | null {
  const { cellSize, levelHeight } = doc.classicStructure;
  const half = cellSize / 2;
  const [x, y, z] = door.position;
  const level = Math.round(y / levelHeight);
  if (Math.abs(y - level * levelHeight) > 0.05) return null;
  const c = Math.abs(Math.cos(door.yaw));
  const s = Math.abs(Math.sin(door.yaw));
  // Spanning x: the wall runs along x, on the boundary between cell gy (its N side) and gy + 1 (its S side).
  const alongX = c > 0.999;
  if (!alongX && !(s > 0.999)) return null;
  const run = alongX ? x : z;
  const across = alongX ? z : x;
  const g = Math.round(run / cellSize);
  if (Math.abs(run - g * cellSize) > 0.3) return null;
  const k = Math.round((across - half) / cellSize);
  const boundary = k * cellSize + half;
  if (Math.abs(across - boundary) > ON_WALL) return null;
  const { cells } = buildOccupancy(doc, catalog);
  // The two cells either side: [grid x, grid y, the side facing the boundary, which way that cell lies from it].
  const sides: [number, number, Side, -1 | 1][] = alongX
    ? [
        [g, k, 'N', -1],
        [g, k + 1, 'S', 1],
      ]
    : [
        [k, g, 'E', -1],
        [k + 1, g, 'W', 1],
      ];
  const built = sides.filter(([gx, gy, side]) => cells.has(cellKey(gx, gy, level)) && resolveEdge(cells, gx, gy, level, side) !== 'none');
  if (!built.length) return null;
  // Both cells build their wall from the boundary: its middle is the boundary; one cell's alone is half a wall in.
  const shift = built.length === 2 ? 0 : (built[0]![3] * WALL_THICKNESS) / 2;
  const at = round(boundary + shift);
  const moved: Door = { ...door, position: alongX ? [x, level * levelHeight, at] : [at, level * levelHeight, z] };
  // The side becomes the doorway, as MapMaker's Walls & Openings sets it (on one cell's record; the other's own choice goes).
  const [gx, gy, side] = built[0]!;
  if (resolveEdge(cells, gx, gy, level, side) === doorway) return { door: moved, commands: [], wall: 'side', doorway };
  const set = setEdgeCommand(doc, { cell: [gx, gy, level], side }, doorway, catalog);
  if ('error' in set) return null;
  return { door: moved, commands: [set], wall: 'side', doorway };
}

/** A static block's run direction and its across direction in the world (x, z). */
function blockAxes(b: Block): { run: [number, number]; across: [number, number] } {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  // The block's own x and z turned by its yaw (geometry.ts yawXZ).
  const ox: [number, number] = [c, -s];
  const oz: [number, number] = [s, c];
  return blockRun(b).along === 'x' ? { run: ox, across: oz } : { run: oz, across: ox };
}

/** Where the door stands in a block wall: along its run from its middle, and off its middle plane; null when not in it. */
function inBlock(b: Block, door: Door): { u: number; v: number } | null {
  const { length: L, thickness: T } = blockRun(b);
  if (T > 2 || L < 1) return null;
  const { run, across } = blockAxes(b);
  // The door spans its own x: it must lie along the block's run.
  const dir: [number, number] = [Math.cos(door.yaw), -Math.sin(door.yaw)];
  if (Math.abs(dir[0] * run[0] + dir[1] * run[1]) < 0.999) return null;
  const dx = door.position[0] - b.position[0];
  const dz = door.position[2] - b.position[2];
  const u = dx * run[0] + dz * run[1];
  const v = dx * across[0] + dz * across[1];
  if (Math.abs(v) > T / 2 + ON_WALL) return null;
  if (u + HALF_OPENING <= -L / 2 + 1e-6 || u - HALF_OPENING >= L / 2 - 1e-6) return null;
  // The block stands across the door's height (not a kerb under it, nor a beam over its top).
  const y0 = b.position[1];
  const y1 = y0 + b.size[1];
  if (y1 < door.position[1] + 1 || y0 > door.position[1] + 1.5) return null;
  return { u, v };
}

/** The door in a wall of free blocks: every static block it stands in takes the doorway. */
function fitBlocks(doc: MapDocument, door: Door, doorway: DoorwayStyle): DoorFit | null {
  const dyn = dynamicBlockIds(doc);
  const hits: { b: Block; u: number; v: number }[] = [];
  for (const e of doc.entities) {
    if (e.kind !== 'block' || dyn.has(e.id) || !blockTakesDoorways(e)) continue;
    const at = inBlock(e, door);
    if (at) hits.push({ b: e, ...at });
  }
  if (!hits.length) return null;
  // The door hangs on the middle plane of the block it is nearest the middle of.
  hits.sort((a, b) => Math.abs(a.v) - Math.abs(b.v));
  const first = hits[0]!;
  const { across } = blockAxes(first.b);
  const moved: Door = { ...door, position: [round(door.position[0] - first.v * across[0]), door.position[1], round(door.position[2] - first.v * across[1])] };
  const before: Block[] = [];
  const after: Block[] = [];
  for (const { b, u } of hits) {
    const at = round(u);
    const y = round(door.position[1] - b.position[1]);
    const want = { style: doorway, at, ...(y ? { y } : {}) };
    const others = (b.doorways ?? []).filter((d) => Math.abs(d.at - at) >= DOOR.width - 1e-6);
    const same = b.doorways?.find((d) => Math.abs(d.at - at) < 1e-6 && d.style === doorway && (d.y ?? 0) === y);
    if (same && others.length === b.doorways!.length - 1) continue;
    before.push(b);
    after.push({ ...b, doorways: [...others, want].sort((p, q) => p.at - q.at) });
  }
  const commands: EditCommand[] = after.length ? [{ kind: 'updateEntities', before, after }] : [];
  return { door: moved, commands, wall: 'blocks', doorway };
}

/**
 * Where MapMaker's door tool puts a door over a wall of free blocks: on the middle plane of the static block under the
 * pointer (x, z near level `y`), along its run on a `step` grid from the block's middle, facing along it. Null when no
 * block wall is there (the door then snaps to the nearest cell side).
 */
export function snapDoorToBlockWall(doc: MapDocument, x: number, y: number, z: number, step = 0.5): { position: [number, number, number]; yaw: number } | null {
  const dyn = dynamicBlockIds(doc);
  let best: { position: [number, number, number]; yaw: number; d: number } | null = null;
  for (const b of doc.entities) {
    if (b.kind !== 'block' || dyn.has(b.id) || !blockTakesDoorways(b)) continue;
    const { length: L, thickness: T } = blockRun(b);
    if (T > 2 || L < DOOR.width) continue;
    if (b.position[1] + b.size[1] < y + 1 || b.position[1] > y + 1.5) continue;
    const { run, across } = blockAxes(b);
    const dx = x - b.position[0];
    const dz = z - b.position[2];
    const v = dx * across[0] + dz * across[1];
    let u = dx * run[0] + dz * run[1];
    if (Math.abs(v) > T / 2 + ON_WALL || Math.abs(u) > L / 2) continue;
    u = Math.round(u / step) * step;
    const d = Math.abs(v);
    if (best && best.d <= d) continue;
    best = { position: [round(b.position[0] + u * run[0]), y, round(b.position[2] + u * run[1])], yaw: round(angle(Math.atan2(-run[1], run[0]))), d };
  }
  return best && { position: best.position, yaw: best.yaw };
}
