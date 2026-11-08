import { coreCatalog, type LocalBox, type Side, type TileCatalog, type TileDefinition } from '../map/catalog.ts';
import { rotateSide, rotateXZ } from '../map/geometry.ts';
import { SET_PIECE_GRID, mirrorWidth, piecesFor, setPieceFootprint, setPieceMirrorProblem, tileMirrorAxis, type SetPieceLibrary } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import type { MapDocument, MapEntity, Rotation, SetPieceDefinition, SetPiecePlacement, TilePlacement } from '../map/schema.ts';
import { mapTeams } from '../sim/npc.ts';
import { applyCommand, type EditCommand } from './commands.ts';
import { freshCopies, type MapItems } from './copyItems.ts';
import { addGroupsCommand, copiedGroups } from './groups.ts';
import { checkLayout, normalizeYaw, placementCells, type Selection } from './operations.ts';

/**
 * Mirroring (docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 3 item 6, and a group's mirror, item 3): the selection, or half the
 * map, mirrored across a line or through a point, as one command and one undo step.
 *
 * - **Across a line** (`eastWest`: a north–south line at x = `at[0]`, east and west swap; `northSouth`: an east–west
 *   line at z = `at[1]`): tiles stay the same tile when they are their own mirror image (tileMirrorAxis, as for set
 *   pieces), turned the other way with their walls, glass and upper floors mirrored; a tile that isn't (stairs drawn
 *   from a model, …) is refused, saying which. Set pieces flip their `mirror` (refused for one that can't be).
 * - **Through a point** (`point`, at [x, z]): a half turn about it. Anything goes, nothing is refused for its shape.
 * - Things: positions mirrored, facings turned to match (yaw −yaw across a north–south line, π − yaw across an
 *   east–west one, yaw + π through a point), offsets (mover points, plane routes, a zipline's far end) mirrored, a
 *   block's roll negated by a line. Props are mirrored in place and facing, not in shape (as in set pieces).
 * - The line or point sits where cells land on cells: on a cell's middle or its edge (snapMirrorAt).
 * - **Team things swap sides** in a mirrored copy (`swapTeams`): spawns, flags (the bases), team-only zones, doors,
 *   buttons and ziplines, and team vehicles and turrets of the map's first two teams trade teams. Breakthrough's
 *   attack and defend spawn groups keep their side (the sectors run one way).
 * - Terrain, paths and the map's boundary aren't mirrored.
 */
export type MirrorAcross = 'eastWest' | 'northSouth' | 'point';
export interface MirrorPlane {
  across: MirrorAcross;
  /** World metres: [x of the line, z of the line] (eastWest reads x, northSouth z), or the point. */
  at: [number, number];
}

/** A half of the map, the side of the line it lies on. */
export type MapHalf = 'west' | 'east' | 'south' | 'north';

export const MIRROR_LABELS: Record<MirrorAcross, string> = { eastWest: 'East ↔ west (across a north–south line)', northSouth: 'North ↔ south (across an east–west line)', point: 'Through a point (a half turn)' };

/** The line or point moved to the nearest place where cells land on cells: a multiple of half a cell. */
export function snapMirrorAt(at: readonly [number, number], cellSize: number): [number, number] {
  const half = cellSize / 2;
  return [Math.round(at[0] / half) * half + 0, Math.round(at[1] / half) * half + 0];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const flipsX = (m: MirrorPlane) => m.across !== 'northSouth';
const flipsZ = (m: MirrorPlane) => m.across !== 'eastWest';

/** A world point mirrored. */
export function mirrorPoint(p: readonly [number, number, number], m: MirrorPlane): [number, number, number] {
  return [r3(flipsX(m) ? 2 * m.at[0] - p[0] : p[0]), p[1], r3(flipsZ(m) ? 2 * m.at[1] - p[2] : p[2])];
}

/** A facing mirrored (yaw 0 along +Z, facing (sin yaw, cos yaw)). */
export function mirrorYaw(yaw: number, m: MirrorPlane): number {
  return normalizeYaw(m.across === 'eastWest' ? -yaw : m.across === 'northSouth' ? Math.PI - yaw : yaw + Math.PI);
}

const MIRROR_SIDE: Record<Side, Side> = { N: 'N', E: 'W', S: 'S', W: 'E' };

/**
 * How a tile looks in a mirror: as itself turned `k` quarter turns and moved `o` cells (its own frame), or null when no
 * turn of it matches (a tile drawn from a model, a room with cover on one side only…). A corridor with cover on its
 * west side is itself turned half round; a corner is itself turned a quarter; a room is itself (k 0, as
 * tileMirrorAxis). Cells, ports, default walls and its solid and floor boxes must all match.
 */
export interface MirrorTwin {
  k: number;
  o: [number, number];
}
const twins = new WeakMap<TileDefinition, MirrorTwin | null>();
const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
const QUARTER = Math.PI / 2;
const wrap = (a: number, p: number) => r4((((a % p) + p) % p) % (p - 1e-9));
/** A box as a comparable key, the same box written any of its ways giving the same key. */
function boxKey(b: LocalBox): string {
  const tail = `${b.kind ?? 'solid'} ${b.surface ? `${b.surface.material}|${b.surface.tint ?? '-'}` : '-'} ${r4(b.min[1])} ${r4(b.max[1])}`;
  if (!b.yaw && !b.pitch && !b.roll) return `${r4(b.min[0])},${r4(b.min[2])},${r4(b.max[0])},${r4(b.max[2])} ${tail}`;
  const cx = r4((b.min[0] + b.max[0]) / 2);
  const cz = r4((b.min[2] + b.max[2]) / 2);
  let hx = r4((b.max[0] - b.min[0]) / 2);
  let hz = r4((b.max[2] - b.min[2]) / 2);
  if (b.pitch || b.roll) return `${cx},${cz} ${hx},${hz} ${wrap(b.yaw ?? 0, 2 * Math.PI)} ${r4(b.pitch ?? 0)} ${r4(b.roll ?? 0)} ${tail}`;
  // A flat box turned half round is the same box; a quarter turn is the same with its sides swapped.
  let yaw = wrap(b.yaw ?? 0, Math.PI);
  if (yaw >= QUARTER - 1e-6) [yaw, hx, hz] = [r4(yaw - QUARTER), hz, hx];
  return yaw < 1e-6 ? `${r4(cx - hx)},${r4(cz - hz)},${r4(cx + hx)},${r4(cz + hz)} ${tail}` : `${cx},${cz} ${hx},${hz} ${yaw} ${tail}`;
}
/** A box turned k quarter turns about the tile's origin (as geometry.ts turns a tile's boxes). */
function turnBox(b: LocalBox, k: number): LocalBox {
  if (b.yaw || b.pitch || b.roll) {
    const hx = (b.max[0] - b.min[0]) / 2;
    const hz = (b.max[2] - b.min[2]) / 2;
    const [mx, mz] = rotateXZ((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2, k);
    return { ...b, min: [mx - hx, b.min[1], mz - hz], max: [mx + hx, b.max[1], mz + hz], yaw: (b.yaw ?? 0) + k * QUARTER };
  }
  const [ax, az] = rotateXZ(b.min[0], b.min[2], k);
  const [bx, bz] = rotateXZ(b.max[0], b.max[2], k);
  return { ...b, min: [Math.min(ax, bx), b.min[1], Math.min(az, bz)], max: [Math.max(ax, bx), b.max[1], Math.max(az, bz)] };
}
/** A box mirrored east ↔ west about x = 0, then moved (ox, oz) metres. */
const mirrorBox = (b: LocalBox, ox: number, oz: number): LocalBox => ({
  ...b,
  min: [-b.max[0] - ox, b.min[1], b.min[2] - oz],
  max: [-b.min[0] - ox, b.max[1], b.max[2] - oz],
  ...(b.yaw ? { yaw: -b.yaw } : {}),
  ...(b.roll ? { roll: -b.roll } : {}),
});
const sameBag = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

export function tileMirrorTwin(def: TileDefinition): MirrorTwin | null {
  const known = twins.get(def);
  if (known !== undefined) return known;
  const result = ((): MirrorTwin | null => {
    if (def.model) return null;
    const a2 = tileMirrorAxis(def);
    if (a2 !== null) return { k: 0, o: [-a2, 0] };
    const cs = SET_PIECE_GRID.cellSize;
    const cell = (x: number, y: number, z: number) => `${x + 0},${y + 0},${z}`;
    for (let k = 1; k < 4; k++) {
      // M0 G = o + R(k) G: the cells pin o down.
      const turned = def.cells.map(([x, y, z]) => [...rotateXZ(x, y, k), z] as [number, number, number]);
      const ox = Math.min(...def.cells.map((c) => -c[0])) - Math.min(...turned.map((c) => c[0]));
      const oy = Math.min(...def.cells.map((c) => c[1])) - Math.min(...turned.map((c) => c[1]));
      if (!sameBag(def.cells.map(([x, y, z]) => cell(-x, y, z)), turned.map(([x, y, z]) => cell(x + ox, y + oy, z)))) continue;
      const port = (side: Side, level: number, c: readonly number[]) => `${side} ${level} ${c[0]! + 0},${c[1]! + 0}`;
      const mine = def.ports.map((p) => {
        const [cx, cy] = p.cell ?? [0, 0];
        return port(MIRROR_SIDE[p.side], p.level, [-cx, cy]);
      });
      const theirs = def.ports.map((p) => {
        const [cx, cy] = rotateXZ(...((p.cell ?? [0, 0]) as [number, number]), k);
        return port(rotateSide(p.side, k), p.level, [cx + ox, cy + oy]);
      });
      if (!sameBag(mine, theirs)) continue;
      const edges = Object.entries(def.edgeDefaults ?? {});
      const edgeKey = (k0: string, m: boolean) => {
        const [c, s] = k0.split(':') as [string, Side];
        const [x, y, z] = c.split(',').map(Number) as [number, number, number];
        if (m) return `${cell(-x, y, z)}:${MIRROR_SIDE[s]}`;
        const [tx, ty] = rotateXZ(x, y, k);
        return `${cell(tx + ox, ty + oy, z)}:${rotateSide(s, k)}`;
      };
      if (!sameBag(edges.map(([e, v]) => `${edgeKey(e, true)}=${v}`), edges.map(([e, v]) => `${edgeKey(e, false)}=${v}`))) continue;
      let boxes = true;
      for (const list of [def.solids ?? [], def.extraFloors ?? []]) {
        // M0 b = o + R(k) b, i.e. M0 b − o (metres) against R(k) b.
        if (!sameBag(list.map((b) => boxKey(mirrorBox(b, ox * cs, oy * cs))), list.map((b) => boxKey(turnBox(b, k))))) boxes = false;
      }
      if (boxes) return { k, o: [ox, oy] };
    }
    return null;
  })();
  twins.set(def, result);
  return result;
}

const sortKeys = <V>(o: Record<string, V>): Record<string, V> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/**
 * A tile mirrored east ↔ west across x = w / 2 cells (w an integer), or why it can't be. With its twin (k, o): the
 * mirrored tile is the same tile turned k − r with its anchor at (w − x, y) + R(−r) o; a key κ of its own frame (a
 * wall, glass, an upper floor) becomes R(−k)(M0 κ − o).
 */
function tileEastWest(t: TilePlacement, w: number, catalog: TileCatalog): TilePlacement | { error: string } {
  const def = catalog.get(t.tile);
  if (!def) return { error: `unknown tile ${t.tile}` };
  const twin = tileMirrorTwin(def);
  if (!twin) return { error: `the ${def.displayName} has no mirror image among its turns, so it can't be mirrored across a line (mirror through a point, or turn it by hand)` };
  const back = (4 - t.rotation) % 4;
  const [sx, sy] = rotateXZ(twin.o[0], twin.o[1], back);
  const out: TilePlacement = { ...t, x: w - t.x + sx, y: t.y + sy, rotation: ((twin.k - t.rotation + 4) % 4) as Rotation };
  const unturn = (4 - twin.k) % 4;
  const key = (k0: string) => {
    const [c, s] = k0.split(':') as [string, Side | undefined];
    const [x, y, z] = c.split(',').map(Number) as [number, number, number];
    const [kx, ky] = rotateXZ(-x - twin.o[0], y - twin.o[1], unturn);
    const at = `${kx + 0},${ky + 0},${z}`;
    return s ? `${at}:${rotateSide(MIRROR_SIDE[s], unturn)}` : at;
  };
  if (t.edges) out.edges = sortKeys(Object.fromEntries(Object.entries(t.edges).map(([k0, v]) => [key(k0), v]))) as TilePlacement['edges'];
  if (t.glass) out.glass = sortKeys(Object.fromEntries(Object.entries(t.glass).map(([k0, v]) => [key(k0), v]))) as TilePlacement['glass'];
  if (t.upperFloors) out.upperFloors = t.upperFloors.map(key).sort();
  return out;
}

/** A tile turned half round the point (cx2 / 2, cy2 / 2) cells. */
const tileHalfTurn = (t: TilePlacement, cx2: number, cy2: number): TilePlacement => ({ ...t, x: cx2 - t.x, y: cy2 - t.y, rotation: ((t.rotation + 2) % 4) as Rotation });

/** Doubled cell coordinates of the line or point (integers once snapped). */
function doubled(m: MirrorPlane, cellSize: number): [number, number] {
  return [Math.round((2 * m.at[0]) / cellSize), Math.round((2 * m.at[1]) / cellSize)];
}

/** A tile mirrored, or why it can't be. */
export function mirrorTile(t: TilePlacement, m: MirrorPlane, cellSize: number, catalog: TileCatalog = coreCatalog): TilePlacement | { error: string } {
  const [x2, z2] = doubled(m, cellSize);
  if (m.across === 'point') return tileHalfTurn(t, x2, z2);
  if (m.across === 'eastWest') return tileEastWest(t, x2, catalog);
  // North ↔ south: east ↔ west about x = 0, then half a turn about (0, z).
  const ew = tileEastWest(t, 0, catalog);
  return 'error' in ew ? ew : tileHalfTurn(ew, 0, z2);
}

type Pose = Pick<SetPiecePlacement, 'x' | 'y' | 'rotation' | 'mirror'>;
const pieceHalfTurn = <P extends Pose>(p: P, cx2: number, cy2: number): P => ({ ...p, x: cx2 - p.x, y: cy2 - p.y, rotation: ((p.rotation + 2) % 4) as Rotation });
/** East ↔ west across x = w / 2 cells: the mirror flag flips, the turn goes the other way, the anchor moves so the footprint lands mirrored. */
function pieceEastWest<P extends Pose>(p: P, wp: number, w: number): P {
  const rotation = ((4 - p.rotation) % 4) as Rotation;
  const [sx, sy] = rotateXZ(wp, 0, rotation);
  return { ...p, x: w - p.x - sx, y: p.y - sy, rotation, mirror: !p.mirror };
}

/** A set-piece placement mirrored, or why it can't be. */
export function mirrorSetPiece(p: SetPiecePlacement, m: MirrorPlane, cellSize: number, pieces: ReadonlyMap<string, SetPieceDefinition>, catalog: TileCatalog = coreCatalog): SetPiecePlacement | { error: string } {
  const def = pieces.get(p.piece);
  if (!def) return { error: `unknown set piece ${p.piece}` };
  const [x2, z2] = doubled(m, cellSize);
  if (m.across === 'point') return pieceHalfTurn(p, x2, z2);
  const problem = def.mirror === 'none' ? 'it says it has no mirror image' : setPieceMirrorProblem(def, catalog);
  if (problem) return { error: `the ${def.displayName} set piece can't be mirrored across a line (${problem}): mirror through a point instead` };
  const wp = mirrorWidth(def);
  if (m.across === 'eastWest') return pieceEastWest(p, wp, x2);
  return pieceHalfTurn(pieceEastWest(p, wp, 0), 0, z2);
}

/** The map's first two teams swapped (anything else as it is): the team of a mirrored copy. */
export function teamSwap(doc: MapDocument): (team: string) => string {
  const [a, b] = mapTeams(doc).map((t) => t.id);
  return (team) => (team === a ? b! : team === b ? a! : team);
}

/** A thing mirrored; `swap` (a mirrored copy's teams) trades the team of anything that has one. */
export function mirrorEntity(e: MapEntity, m: MirrorPlane, swap?: (team: string) => string): MapEntity {
  const out = { ...e, position: mirrorPoint(e.position, m) } as MapEntity;
  const vx = (v: number) => r3(flipsX(m) ? -v : v);
  const vz = (v: number) => r3(flipsZ(m) ? -v : v);
  if ('yaw' in out && typeof out.yaw === 'number') (out as { yaw: number }).yaw = mirrorYaw(out.yaw, m);
  if (out.kind === 'block' && out.roll && m.across !== 'point') out.roll = -out.roll;
  if (out.kind === 'mover') out.points = out.points.map(([x, y, z]): [number, number, number] => [vx(x), y, vz(z)]);
  if (out.kind === 'airplane') out.route = out.route.map(([x, z]): [number, number] => [vx(x), vz(z)]);
  if (out.kind === 'zipline') out.end = [vx(out.end[0]), out.end[1], vz(out.end[2])];
  if (swap) {
    if (out.kind === 'spawn' && out.faction) out.faction = swap(out.faction);
    if (out.kind === 'flag') out.team = swap(out.team);
    if (out.kind === 'mount' && out.faction) out.faction = swap(out.faction);
    if ((out.kind === 'zone' || out.kind === 'door' || out.kind === 'button' || out.kind === 'zipline') && out.team) out.team = swap(out.team);
  }
  return out;
}

/** Whether mirroring with a team swap changes this thing's team. */
export function swapsTeam(e: MapEntity, swap: (team: string) => string): boolean {
  const team = e.kind === 'spawn' || e.kind === 'mount' ? e.faction : e.kind === 'flag' || e.kind === 'zone' || e.kind === 'door' || e.kind === 'button' || e.kind === 'zipline' ? e.team : null;
  return !!team && swap(team) !== team;
}

function itemsOf(doc: MapDocument, sel: Selection): MapItems {
  const t = new Set(sel.tiles);
  const e = new Set(sel.entities);
  const p = new Set(sel.setPieces ?? []);
  return { tiles: doc.classicStructure.tiles.filter((x) => t.has(x.id)), entities: doc.entities.filter((x) => e.has(x.id)), setPieces: (doc.setPieces ?? []).filter((x) => p.has(x.id)) };
}

/** What mirroring did: the command, what to select after it, and how many things changed team. */
export interface MirrorResult {
  command: EditCommand;
  selection: Selection;
  swapped: number;
}

/**
 * Mirror the selection (one command, one undo step). `copy`: a mirrored copy is added and the originals stay (team
 * things in the copy swap sides with `swapTeams`); otherwise the selection itself is flipped over.
 */
export function mirrorCommand(
  doc: MapDocument,
  sel: Selection,
  plane: MirrorPlane,
  opts: { copy: boolean; swapTeams?: boolean },
  catalog: TileCatalog = coreCatalog,
  library: SetPieceLibrary = builtInSetPieces(),
): MirrorResult | { error: string } {
  const items = itemsOf(doc, sel);
  if (!items.tiles.length && !items.entities.length && !items.setPieces.length) return { error: 'nothing selected' };
  const { cellSize } = doc.classicStructure;
  // Tiles and set pieces need the line where cells land on cells; things alone mirror about any line.
  const m: MirrorPlane = { across: plane.across, at: items.tiles.length || items.setPieces.length ? snapMirrorAt(plane.at, cellSize) : plane.at };
  const pieces = piecesFor(doc, library);
  const tiles: TilePlacement[] = [];
  for (const t of items.tiles) {
    const r = mirrorTile(t, m, cellSize, catalog);
    if ('error' in r) return r;
    tiles.push(r);
  }
  const setPieces: SetPiecePlacement[] = [];
  for (const p of items.setPieces) {
    const r = mirrorSetPiece(p, m, cellSize, pieces, catalog);
    if ('error' in r) return r;
    setPieces.push(r);
  }
  const swap = opts.copy && opts.swapTeams ? teamSwap(doc) : undefined;
  const entities = items.entities.map((e) => mirrorEntity(e, m, swap));
  const swapped = swap ? items.entities.filter((e) => swapsTeam(e, swap)).length : 0;
  if (!opts.copy) {
    const check = checkLayout(doc, { tiles, setPieces }, [], catalog, library);
    if (!check.ok) return { error: check.reason };
    return {
      command: {
        kind: 'batch',
        commands: [
          { kind: 'updateTiles', before: items.tiles, after: tiles },
          { kind: 'updateEntities', before: items.entities, after: entities },
          { kind: 'updateSetPieces', before: items.setPieces, after: setPieces },
        ],
      },
      selection: sel,
      swapped,
    };
  }
  const copies = freshCopies({ tiles, entities, setPieces });
  const check = checkLayout(doc, { tiles: copies.tiles, setPieces: copies.setPieces }, [], catalog, library);
  if (!check.ok) return { error: `the mirrored copy ${check.reason}` };
  const add: EditCommand = { kind: 'batch', commands: [{ kind: 'addTiles', tiles: copies.tiles }, { kind: 'addEntities', entities: copies.entities }, { kind: 'addSetPieces', setPieces: copies.setPieces }] };
  const groups = addGroupsCommand(applyCommand(doc, add), copiedGroups(doc.groups, copies.idMap));
  return {
    command: groups ? { kind: 'batch', commands: [add, groups] } : add,
    selection: { tiles: copies.tiles.map((t) => t.id), entities: copies.entities.map((e) => e.id), ...(copies.setPieces.length ? { setPieces: copies.setPieces.map((p) => p.id) } : {}) },
    swapped,
  };
}

/** The selection's middle line: where flipping it in place mirrors it onto its own cells (tiles, set pieces), or its things' middle. */
export function selectionMiddle(doc: MapDocument, sel: Selection, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): [number, number] | null {
  const items = itemsOf(doc, sel);
  const { cellSize } = doc.classicStructure;
  const cells: [number, number][] = [];
  for (const t of items.tiles) for (const c of placementCells(t, catalog) ?? []) cells.push([c[0], c[1]]);
  const pieces = piecesFor(doc, library);
  for (const p of items.setPieces) {
    const def = pieces.get(p.piece);
    if (def) for (const c of setPieceFootprint(p, def)) cells.push([c[0], c[1]]);
  }
  // The extent of everything: a cell's whole width, a thing's position; the middle of that (mirrorCommand snaps it).
  const half = cellSize / 2;
  const xs = [...cells.flatMap((c) => [c[0] * cellSize - half, c[0] * cellSize + half]), ...items.entities.map((e) => e.position[0])];
  const zs = [...cells.flatMap((c) => [c[1] * cellSize - half, c[1] * cellSize + half]), ...items.entities.map((e) => e.position[2])];
  if (!xs.length) return null;
  const mid = (vs: number[]) => r3((Math.min(...vs) + Math.max(...vs)) / 2);
  return [mid(xs), mid(zs)];
}

/**
 * Flip the selection over in place (M on a group or a mixed selection): east ↔ west across its own middle, as one.
 * Teams stay as they are.
 */
export function flipCommand(doc: MapDocument, sel: Selection, across: Exclude<MirrorAcross, 'point'> = 'eastWest', catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): MirrorResult | { error: string } {
  const mid = selectionMiddle(doc, sel, catalog, library);
  if (!mid) return { error: 'nothing selected' };
  return mirrorCommand(doc, sel, { across, at: mid }, { copy: false }, catalog, library);
}

/** Which side of the plane a world point is on: -1 (west or south), 1 (east or north), 0 on the line. */
function sideOf(x: number, z: number, m: MirrorPlane, half: MapHalf): -1 | 0 | 1 {
  const byX = half === 'west' || half === 'east';
  const d = byX ? x - m.at[0] : z - m.at[1];
  return Math.abs(d) < 1e-6 ? 0 : d < 0 ? -1 : 1;
}

/** The halves a mirror can copy from: across a line, the two sides of it; through a point, any of the four. */
export function mirrorHalves(across: MirrorAcross): MapHalf[] {
  return across === 'eastWest' ? ['west', 'east'] : across === 'northSouth' ? ['south', 'north'] : ['west', 'east', 'south', 'north'];
}

const HALF_SIGN: Record<MapHalf, -1 | 1> = { west: -1, south: -1, east: 1, north: 1 };
const OTHER_HALF: Record<MapHalf, MapHalf> = { west: 'east', east: 'west', south: 'north', north: 'south' };

/**
 * Half the map, split by the plane: what lies wholly on `half`'s side (tiles and set pieces by their cells, things
 * by their position), what lies across or on the line (left as it is), and what is on the other side already.
 */
export function mapHalf(doc: MapDocument, plane: MirrorPlane, half: MapHalf, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): { from: Selection; onLine: number; other: number } {
  const { cellSize } = doc.classicStructure;
  const m: MirrorPlane = { across: plane.across, at: snapMirrorAt(plane.at, cellSize) };
  const want = HALF_SIGN[half];
  const sides = (pts: [number, number][]) => new Set(pts.map(([x, z]) => sideOf(x, z, m, half)));
  const where = (s: Set<number>): 'from' | 'other' | 'line' => (s.size === 1 && s.has(want) ? 'from' : s.size === 1 && s.has(-want) ? 'other' : 'line');
  const out: Selection = { tiles: [], entities: [] };
  const pieceIds: string[] = [];
  let onLine = 0;
  let other = 0;
  const tally = (w: 'from' | 'other' | 'line', push: () => void) => (w === 'from' ? push() : w === 'other' ? other++ : onLine++);
  for (const t of doc.classicStructure.tiles) tally(where(sides((placementCells(t, catalog) ?? []).map((c) => [c[0] * cellSize, c[1] * cellSize]))), () => out.tiles.push(t.id));
  const pieces = piecesFor(doc, library);
  for (const p of doc.setPieces ?? []) {
    const def = pieces.get(p.piece);
    if (def) tally(where(sides(setPieceFootprint(p, def).map((c) => [c[0] * cellSize, c[1] * cellSize]))), () => pieceIds.push(p.id));
  }
  for (const e of doc.entities) tally(where(sides([[e.position[0], e.position[2]]])), () => out.entities.push(e.id));
  return { from: pieceIds.length ? { ...out, setPieces: pieceIds } : out, onLine, other };
}

/**
 * Mirror half the map onto the other half (team things swapping sides): one command. Refused while the other half
 * has anything on it (delete it first, or mirror a selection), so nothing is built twice.
 */
export function mirrorHalfCommand(
  doc: MapDocument,
  plane: MirrorPlane,
  half: MapHalf,
  opts: { swapTeams?: boolean } = {},
  catalog: TileCatalog = coreCatalog,
  library: SetPieceLibrary = builtInSetPieces(),
): (MirrorResult & { onLine: number }) | { error: string } {
  if (!mirrorHalves(plane.across).includes(half)) return { error: `a mirror ${plane.across === 'eastWest' ? 'east ↔ west copies the west or the east half' : 'north ↔ south copies the south or the north half'}` };
  const { from, onLine, other } = mapHalf(doc, plane, half, catalog, library);
  if (other) return { error: `the ${OTHER_HALF[half]} half has ${other} thing${other === 1 ? '' : 's'} on it already: delete ${other === 1 ? 'it' : 'them'} first, or select what to mirror and mirror the selection` };
  const r = mirrorCommand(doc, from, plane, { copy: true, swapTeams: opts.swapTeams ?? true }, catalog, library);
  return 'error' in r ? (r.error === 'nothing selected' ? { error: `the ${half} half is empty: nothing to mirror` } : r) : { ...r, onLine };
}
