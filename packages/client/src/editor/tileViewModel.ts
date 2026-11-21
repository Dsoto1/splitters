import { buildOccupancy, cellKey, coreCatalog, GLASS_EDGES, placementCells, resolveEdge, selectionGroup, SIDE_DIRS, SIDES, type EdgeTarget, type MapDocument, type MapEntity, type PlanArea, type Selection, type Side, type TileCatalog } from '@tiletrigger/shared';

/**
 * MapMaker's Tile View (MapMaker UI spec Phase 4a, §4.2; docs/MAPMAKER_UI_AUDIT.md §6): the maths, kept apart from the
 * drawing (tileViewPanel.ts) so it is tested headless. Nothing here is stored in the map: Tile View only reads the
 * document and makes the same commands as the rest of MapMaker (the shared transform command, setEdge).
 *
 * - The **focus** is what Tile View looks into: a tile, a set piece or a group (owner answer 8), else a box of cells
 *   round the selection (the fallback for maps built of blocks).
 * - **Local** coordinates are tile-relative: from the tile's (or set piece's) anchor cell, turned with it by its
 *   quarter turns (tiles have no scale); a group's or area's local frame starts at its south-west corner, unturned.
 * - **Children**: the things standing in the focus (props, blocks, lights, doors…; editable), the cell sides of its
 *   tiles (doors and windows are edge styles: changed, never dragged), and set-piece parts (generated: read-only).
 */

export type FocusKind = 'tile' | 'setpiece' | 'group' | 'region';

export interface TileFocus {
  kind: FocusKind;
  /** The tile's, set piece's or group's id; null for an area. */
  id: string | null;
  /** What the breadcrumbs call it ("Small Room", "Market Hall", "West base", "Area"). */
  name: string;
  /** The level shown. */
  level: number;
  /** Its grid cells on that level ([x, y]); a group or area: the cells its tiles and set pieces hold there (may be none). */
  cells: [number, number][];
  /** What it covers on that level, world metres (a group: its members too; an area: its cells). */
  rect: PlanArea;
  /** The local frame's origin (world metres) and its quarter turns (a tile's or set piece's rotation; else 0). */
  anchor: { x: number; z: number };
  rotation: number;
}

/** How Tile View reads the map's pieces (MapMaker's own answers, as the minimap's reader). */
export interface TileViewReader {
  /** A set-piece placement's grid cells, or null (its definition is gone). */
  pieceCells(id: string): readonly (readonly [number, number, number])[] | null;
  /** A set piece's display name. */
  pieceName(id: string): string;
  /** The level an entity stands on; null: on the open ground, seen from every level. */
  entityLevel(e: MapEntity): number | null;
}

/** What a request for Tile View names: a tile, set piece or group by id, or an area of cells. */
export type FocusRef = { kind: 'tile' | 'setpiece' | 'group'; id: string } | { kind: 'region'; cells: { x0: number; y0: number; x1: number; y1: number } };

const QUARTER = Math.PI / 2;

/** (x, z) turned by `q` quarter turns, as tiles turn (shared geometry's rotateXZ: east becomes south). */
export function turnQuarter(x: number, z: number, q: number): [number, number] {
  let rx = x;
  let rz = z;
  for (let i = 0; i < ((q % 4) + 4) % 4; i++) [rx, rz] = [rz, -rx];
  return [rx + 0, rz + 0];
}

const mm = (v: number) => Math.round(v * 1000) / 1000 + 0;

/** A world point in the focus's local frame (metres, to the millimetre). */
export function toLocal(f: Pick<TileFocus, 'anchor' | 'rotation'>, x: number, z: number): [number, number] {
  const [lx, lz] = turnQuarter(x - f.anchor.x, z - f.anchor.z, 4 - (f.rotation % 4));
  return [mm(lx), mm(lz)];
}

/** A local point back in the world. */
export function toWorld(f: Pick<TileFocus, 'anchor' | 'rotation'>, lx: number, lz: number): [number, number] {
  const [x, z] = turnQuarter(lx, lz, f.rotation);
  return [mm(x + f.anchor.x), mm(z + f.anchor.z)];
}

/** A local direction (no origin) in the world: a nudge along the tile's own axes. */
export function localDirToWorld(f: Pick<TileFocus, 'rotation'>, dx: number, dz: number): [number, number] {
  return turnQuarter(dx, dz, f.rotation);
}

/** A facing in (-180, 180] degrees. */
export function normDeg(d: number): number {
  let v = ((d % 360) + 360) % 360;
  if (v > 180) v -= 360;
  return Math.round(v * 100) / 100 + 0;
}

/** A thing's facing (yaw, radians) in the focus's frame, as degrees: the tile's turn taken off. */
export function localFacingDeg(f: Pick<TileFocus, 'rotation'>, yaw: number): number {
  return normDeg(((yaw - f.rotation * QUARTER) * 180) / Math.PI);
}

/** A local facing (degrees) as the world's (degrees), for the shared transform's `face`. */
export function worldFacingDeg(f: Pick<TileFocus, 'rotation'>, localDeg: number): number {
  return normDeg(localDeg + f.rotation * 90);
}

/** A value on the snap step (metres); `free` (a held modifier): the millimetre. */
export function snapTo(v: number, stepM: number, free = false): number {
  if (free || stepM <= 0) return mm(v);
  return mm(Math.round(v / stepM) * stepM);
}

/**
 * Where a dragged thing lands: its local position plus the pointer's travel (local metres), on the snap step of the
 * frame shown (local or world), as a world move [dx, 0, dz] for the shared transform (one command on release).
 */
export function dragMove(f: Pick<TileFocus, 'anchor' | 'rotation'>, from: readonly [number, number], travelWorld: readonly [number, number], stepM: number, frame: 'local' | 'world', free = false): [number, number, number] {
  const wx = from[0] + travelWorld[0];
  const wz = from[1] + travelWorld[1];
  let to: [number, number];
  if (frame === 'world') to = [snapTo(wx, stepM, free), snapTo(wz, stepM, free)];
  else {
    const [lx, lz] = toLocal(f, wx, wz);
    to = toWorld(f, snapTo(lx, stepM, free), snapTo(lz, stepM, free));
  }
  return [mm(to[0] - from[0]), 0, mm(to[1] - from[1])];
}

const rectOfCells = (cells: readonly (readonly [number, number])[], cell: number): PlanArea => {
  let r = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const [x, y] of cells) r = { x0: Math.min(r.x0, x * cell - cell / 2), z0: Math.min(r.z0, y * cell - cell / 2), x1: Math.max(r.x1, x * cell + cell / 2), z1: Math.max(r.z1, y * cell + cell / 2) };
  return r;
};

/** Cells on the wanted level if any are there, else on the lowest level the piece has. */
function cellsOnLevel(cells: readonly (readonly [number, number, number])[], want: number): { level: number; cells: [number, number][] } {
  const levels = [...new Set(cells.map((c) => c[2]))].sort((a, b) => a - b);
  const level = levels.includes(want) ? want : (levels[0] ?? want);
  return { level, cells: cells.filter((c) => c[2] === level).map((c) => [c[0], c[1]]) };
}

/**
 * Tile View's focus for `ref` on the level wanted (`level`; a tile or set piece with no cells there shows its lowest
 * level), or null when it is no longer in the map.
 */
export function buildFocus(doc: MapDocument, ref: FocusRef, level: number, read: TileViewReader, catalog: TileCatalog = coreCatalog): TileFocus | null {
  const cell = doc.classicStructure.cellSize;
  if (ref.kind === 'tile') {
    const t = doc.classicStructure.tiles.find((x) => x.id === ref.id);
    if (!t) return null;
    const on = cellsOnLevel(placementCells(t, catalog) ?? [[t.x, t.y, t.z]], level);
    return { kind: 'tile', id: t.id, name: catalog.get(t.tile)?.displayName ?? t.tile, level: on.level, cells: on.cells, rect: rectOfCells(on.cells, cell), anchor: { x: t.x * cell, z: t.y * cell }, rotation: t.rotation };
  }
  if (ref.kind === 'setpiece') {
    const p = (doc.setPieces ?? []).find((x) => x.id === ref.id);
    const all = p && read.pieceCells(p.id);
    if (!p || !all?.length) return null;
    const on = cellsOnLevel(all, level);
    return { kind: 'setpiece', id: p.id, name: read.pieceName(p.id), level: on.level, cells: on.cells, rect: rectOfCells(on.cells, cell), anchor: { x: p.x * cell, z: p.y * cell }, rotation: p.rotation };
  }
  if (ref.kind === 'group') {
    const g = (doc.groups ?? []).find((x) => x.id === ref.id);
    if (!g) return null;
    const members = new Set(g.members);
    const cells: [number, number][] = [];
    const all: (readonly [number, number, number])[] = [];
    for (const t of doc.classicStructure.tiles) if (members.has(t.id)) all.push(...(placementCells(t, catalog) ?? [[t.x, t.y, t.z]]));
    for (const p of doc.setPieces ?? []) if (members.has(p.id)) all.push(...(read.pieceCells(p.id) ?? []));
    const things = doc.entities.filter((e) => members.has(e.id));
    // The level: the one wanted if anything of it is there, else its lowest.
    const levels = new Set<number>([...all.map((c) => c[2]), ...things.map((e) => read.entityLevel(e) ?? level)]);
    const lv = levels.has(level) ? level : Math.min(...levels);
    for (const c of all) if (c[2] === lv) cells.push([c[0], c[1]]);
    let r = cells.length ? rectOfCells(cells, cell) : { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
    for (const e of things) {
      const el = read.entityLevel(e);
      if (el !== null && el !== lv) continue;
      r = { x0: Math.min(r.x0, e.position[0] - 1), z0: Math.min(r.z0, e.position[2] - 1), x1: Math.max(r.x1, e.position[0] + 1), z1: Math.max(r.z1, e.position[2] + 1) };
    }
    if (!Number.isFinite(r.x0)) return null;
    const rect = { x0: mm(r.x0), z0: mm(r.z0), x1: mm(r.x1), z1: mm(r.z1) };
    return { kind: 'group', id: g.id, name: g.name ?? 'Group', level: lv, cells, rect, anchor: { x: rect.x0, z: rect.z0 }, rotation: 0 };
  }
  if (ref.kind !== 'region') return null;
  const { x0, y0, x1, y1 } = ref.cells;
  const cells: [number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.push([x, y]);
  const rect = rectOfCells(cells, cell);
  return { kind: 'region', id: null, name: 'Area', level, cells, rect, anchor: { x: rect.x0, z: rect.z0 }, rotation: 0 };
}

/** The cells (inclusive) covering world points, at least one cell. */
export function regionCells(points: readonly (readonly [number, number])[], cell: number): { x0: number; y0: number; x1: number; y1: number } {
  const cx = points.map((p) => Math.round(p[0] / cell));
  const cy = points.map((p) => Math.round(p[1] / cell));
  return { x0: Math.min(...cx), y0: Math.min(...cy), x1: Math.max(...cx), y1: Math.max(...cy) };
}

/**
 * What Tile View opens on for a selection: the one group it is, else its one set piece or tile, else its first tile or
 * set piece, else an area round the things selected (owner answer 8). Null: nothing selected.
 */
export function focusRefFor(doc: MapDocument, sel: Selection): FocusRef | null {
  const g = selectionGroup(doc, sel);
  if (g) return { kind: 'group', id: g.id };
  const pieces = sel.setPieces ?? [];
  if (sel.tiles.length) return { kind: 'tile', id: sel.tiles[0]! };
  if (pieces.length) return { kind: 'setpiece', id: pieces[0]! };
  if (!sel.entities.length) return null;
  const want = new Set(sel.entities);
  const pts = doc.entities.filter((e) => want.has(e.id)).map((e) => [e.position[0], e.position[2]] as const);
  if (!pts.length) return null;
  return { kind: 'region', cells: regionCells(pts, doc.classicStructure.cellSize) };
}

/** What Tile View opens on at a world point (the minimap's double-click): the tile or set piece with a cell there on that level, else that cell. */
export function focusRefAt(doc: MapDocument, level: number, x: number, z: number, read: Pick<TileViewReader, 'pieceCells'>, catalog: TileCatalog = coreCatalog): FocusRef {
  const cell = doc.classicStructure.cellSize;
  const cx = Math.round(x / cell);
  const cy = Math.round(z / cell);
  const has = (cells: readonly (readonly [number, number, number])[] | null) => !!cells?.some((c) => c[0] === cx && c[1] === cy && c[2] === level);
  for (const p of doc.setPieces ?? []) if (has(read.pieceCells(p.id))) return { kind: 'setpiece', id: p.id };
  for (const t of doc.classicStructure.tiles) if (has(placementCells(t, catalog))) return { kind: 'tile', id: t.id };
  return { kind: 'region', cells: { x0: cx, y0: cy, x1: cx, y1: cy } };
}

/** Whether a world point is in the focus: in one of its cells (a tile or set piece), else in its rectangle. */
export function inFocus(f: TileFocus, x: number, z: number, cell: number): boolean {
  if (f.kind === 'tile' || f.kind === 'setpiece') {
    const cx = Math.round(x / cell);
    const cy = Math.round(z / cell);
    return f.cells.some((c) => c[0] === cx && c[1] === cy);
  }
  return x >= f.rect.x0 - 1e-6 && x <= f.rect.x1 + 1e-6 && z >= f.rect.z0 - 1e-6 && z <= f.rect.z1 + 1e-6;
}

/** One thing in the focus: the map's own (editable), or a set piece's generated part (read-only). */
export interface FocusChild {
  id: string;
  x: number;
  z: number;
  yaw: number | null;
  /** The set piece it is generated from, for a part (read-only). */
  partOf: string | null;
  /** Its footprint's half size (m) for drawing, when it has one. */
  half: [number, number] | null;
}

/**
 * The things standing in the focus on its level, from the map as drawn (`viewDoc`: set pieces as their parts): the
 * map's own (in `doc`) are editable, parts are listed with the set piece they come from.
 */
export function focusChildren(doc: MapDocument, viewDoc: MapDocument, f: TileFocus, read: Pick<TileViewReader, 'entityLevel'>, partOf: ReadonlyMap<string, string>): FocusChild[] {
  const own = new Set(doc.entities.map((e) => e.id));
  const cell = doc.classicStructure.cellSize;
  const out: FocusChild[] = [];
  for (const e of viewDoc.entities) {
    const [x, , z] = e.position;
    if (!inFocus(f, x, z, cell)) continue;
    const lv = read.entityLevel(e);
    if (lv !== null && lv !== f.level) continue;
    const piece = own.has(e.id) ? null : (partOf.get(e.id) ?? 'unknown');
    const size = 'size' in e && Array.isArray(e.size) ? (e.size as number[]) : null;
    out.push({ id: e.id, x, z, yaw: 'yaw' in e && typeof e.yaw === 'number' ? e.yaw : null, partOf: piece, half: size ? [size[0]! / 2, size[2]! / 2] : null });
  }
  return out;
}

/** One cell side of a tile in the focus: where it is, what it is built as, and the target the Walls tool uses. */
export interface FocusEdge {
  target: EdgeTarget;
  tileId: string;
  /** World metres, the side's two ends. */
  a: [number, number];
  b: [number, number];
  /** What stands there as built ('none': open, or nothing between two tiles' ports). */
  style: string;
}

/**
 * The cell sides of the focus's tiles on its level (a tile: its own; a group: its tiles'; an area: the tiles with a
 * cell in it), except sides inside one piece. Set pieces' insides are generated, so their sides aren't listed.
 */
export function focusEdges(doc: MapDocument, f: TileFocus, catalog: TileCatalog = coreCatalog): FocusEdge[] {
  if (f.kind === 'setpiece') return [];
  const { cellSize } = doc.classicStructure;
  const members = f.kind === 'group' ? new Set((doc.groups ?? []).find((g) => g.id === f.id)?.members ?? []) : null;
  const { cells } = buildOccupancy(doc, catalog);
  const out: FocusEdge[] = [];
  const half = cellSize / 2;
  for (const t of doc.classicStructure.tiles) {
    if (f.kind === 'tile' && t.id !== f.id) continue;
    if (members && !members.has(t.id)) continue;
    for (const [x, y, lv] of placementCells(t, catalog) ?? []) {
      if (lv !== f.level) continue;
      if (f.kind === 'region' && !inFocus(f, x * cellSize, y * cellSize, cellSize)) continue;
      const here = cells.get(cellKey(x, y, lv));
      if (!here || here.placement.id !== t.id) continue;
      for (const side of SIDES as readonly Side[]) {
        const [dx, dy] = SIDE_DIRS[side];
        if (cells.get(cellKey(x + dx, y + dy, lv))?.placement === here.placement) continue;
        const mx = x * cellSize + dx * half;
        const mz = y * cellSize + dy * half;
        const a: [number, number] = dx ? [mx, mz - half] : [mx - half, mz];
        const b: [number, number] = dx ? [mx, mz + half] : [mx + half, mz];
        out.push({ target: { cell: [x, y, lv], side }, tileId: t.id, a, b, style: resolveEdge(cells, x, y, lv, side) });
      }
    }
  }
  return out;
}

/** How an edge style reads on the plan: an opening you walk through, a window, a wall, or nothing. */
export function edgeClass(style: string): 'door' | 'window' | 'wall' | 'open' {
  if (style === 'none' || style === 'open') return 'open';
  if (GLASS_EDGES.has(style as never) || style === 'embrasure') return 'window';
  if (/door|wide|arch|gate|broken|shopfront/.test(style)) return 'door';
  return 'wall';
}

/** What a click in Tile View picks. */
export type TileViewPick = { kind: 'child'; id: string; part: string | null } | { kind: 'edge'; edge: FocusEdge } | null;

function segDist(px: number, pz: number, a: readonly [number, number], b: readonly [number, number]): number {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const len2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / len2));
  return Math.hypot(px - (a[0] + t * vx), pz - (a[1] + t * vz));
}

/**
 * A click at world (x, z): the nearest thing within `reach` metres (the map's own before a set piece's part at the
 * same spot), else the nearest cell side within `reach`, else nothing (the click selects the focus itself).
 * `skip`: locked or hidden things (the outliner's), never picked.
 */
export function tileViewPick(children: readonly FocusChild[], edges: readonly FocusEdge[], x: number, z: number, reach: number, skip: (id: string) => boolean = () => false): TileViewPick {
  let best: { c: FocusChild; d: number } | null = null;
  for (const c of children) {
    if (skip(c.id) || (c.partOf && skip(c.partOf))) continue;
    // Inside a footprint counts as on it; else the distance to its middle.
    const inside = c.half && Math.abs(x - c.x) <= c.half[0] && Math.abs(z - c.z) <= c.half[1];
    const d = inside ? 0 : Math.hypot(c.x - x, c.z - z);
    if (d > reach) continue;
    // Ties go to the map's own over a part.
    if (!best || d < best.d - 1e-6 || (Math.abs(d - best.d) <= 1e-6 && best.c.partOf && !c.partOf)) best = { c, d };
  }
  if (best) return { kind: 'child', id: best.c.id, part: best.c.partOf };
  let edge: { e: FocusEdge; d: number } | null = null;
  for (const e of edges) {
    const d = segDist(x, z, e.a, e.b);
    if (d <= reach && (!edge || d < edge.d)) edge = { e, d };
  }
  return edge ? { kind: 'edge', edge: edge.e } : null;
}

/** A cell side's name in the breadcrumbs: "North side of cell 3, −2". */
export function edgeName(t: EdgeTarget): string {
  return `${{ N: 'North', E: 'East', S: 'South', W: 'West' }[t.side]} side of cell ${t.cell[0]}, ${t.cell[1]}`;
}

/** The breadcrumbs: Map › the focus › the child picked in it. */
export function breadcrumbs(f: Pick<TileFocus, 'name'>, child: string | null): string[] {
  return child ? ['Map', f.name, child] : ['Map', f.name];
}

/**
 * The next (or previous) thing to pick from the keyboard (UI Phase 5: `]` and `[` in Tile View): the map's own
 * things north to south, west to east, then the cell sides, then the set pieces' parts (read-only, to read about);
 * locked and hidden ones left out, as a click leaves them. From nothing picked, `]` takes the first and `[` the last.
 */
export function cyclePick(children: readonly FocusChild[], edges: readonly FocusEdge[], current: TileViewPick, step: 1 | -1, skip: (id: string) => boolean = () => false): TileViewPick {
  const order = (a: { x: number; z: number }, b: { x: number; z: number }) => b.z - a.z || a.x - b.x;
  const own = children.filter((c) => !c.partOf && !skip(c.id)).sort(order);
  const parts = children.filter((c) => c.partOf && !skip(c.id) && !skip(c.partOf)).sort(order);
  const list: NonNullable<TileViewPick>[] = [
    ...own.map((c) => ({ kind: 'child' as const, id: c.id, part: null })),
    ...edges.map((e) => ({ kind: 'edge' as const, edge: e })),
    ...parts.map((c) => ({ kind: 'child' as const, id: c.id, part: c.partOf })),
  ];
  if (!list.length) return null;
  const key = (p: TileViewPick) => (!p ? '' : p.kind === 'edge' ? `e:${edgeName(p.edge.target)}` : `c:${p.id}`);
  const at = current ? list.findIndex((p) => key(p) === key(current)) : -1;
  if (at < 0) return list[step > 0 ? 0 : list.length - 1]!;
  return list[(at + step + list.length) % list.length]!;
}
