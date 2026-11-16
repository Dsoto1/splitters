import { planArea, planFrame, planToScreen, type MapDocument, type MapEntity, type PlanArea, type PlanFrame, type Selection } from '@tiletrigger/shared';

/**
 * MapMaker's live minimap (MapMaker UI spec Phase 3, §4.1; docs/MAPMAKER_UI_AUDIT.md §7): its maths, kept apart from
 * the drawing (minimapPanel.ts) so it is tested headless. The projection is the plan view's (shared
 * editor/planView.ts: north, +Z, up; east to the right); this adds the minimap's zoom about the camera, the camera's
 * marker, the selection's marks and what a click on it picks. Nothing here is stored in the map: the zoom and the
 * dock's tab are this browser's (dockPrefs.ts).
 */

/** The minimap zooms from the whole level (1) in to this many times closer. */
export const MINIMAP_ZOOM_MIN = 1;
export const MINIMAP_ZOOM_MAX = 16;

/**
 * The ground the minimap frames: the playable boundary, else everything built and placed (the plan view's area, props
 * too: on the minimap nothing placed is out of reach). Terrain beyond is left out (a map's ground can run far past
 * its play area).
 */
export function minimapArea(doc: MapDocument): PlanArea {
  const a = planArea(doc);
  if (doc.bounds) return a;
  let { x0, z0, x1, z1 } = a;
  for (const e of doc.entities) {
    if (e.kind !== 'prop') continue;
    x0 = Math.min(x0, e.position[0] - 3);
    z0 = Math.min(z0, e.position[2] - 3);
    x1 = Math.max(x1, e.position[0] + 3);
    z1 = Math.max(z1, e.position[2] + 3);
  }
  return { x0, z0, x1, z1 };
}

/** The minimap's picture: the framed area and room round it (a third of its size, at least 16 m), for a frame wider or taller than the area. */
export function pictureArea(a: PlanArea): PlanArea {
  const mx = Math.max(16, (a.x1 - a.x0) / 3);
  const mz = Math.max(16, (a.z1 - a.z0) / 3);
  return { x0: a.x0 - mx, z0: a.z0 - mz, x1: a.x1 + mx, z1: a.z1 + mz };
}

/** A zoom kept within the minimap's range (anything unreadable: the whole level). */
export function clampMinimapZoom(z: unknown): number {
  return typeof z === 'number' && Number.isFinite(z) ? Math.max(MINIMAP_ZOOM_MIN, Math.min(MINIMAP_ZOOM_MAX, z)) : MINIMAP_ZOOM_MIN;
}

/**
 * What the minimap frames on a w × h canvas: the level's whole area at zoom 1; closer in about `centre` (the camera,
 * or where it was panned to), held inside the area so the minimap never shows only the space round it.
 */
export function minimapFrame(area: PlanArea, w: number, h: number, zoom = 1, centre: { x: number; z: number } | null = null): PlanFrame {
  const fit = planFrame(area, Math.max(1, w) / Math.max(1, h), 2);
  const z = clampMinimapZoom(zoom);
  if (z <= 1 || !centre) return z <= 1 ? fit : { ...fit, halfW: fit.halfW / z, halfH: fit.halfH / z };
  const halfW = fit.halfW / z;
  const halfH = fit.halfH / z;
  const hold = (v: number, mid: number, room: number) => Math.max(mid - room, Math.min(mid + room, v));
  return { cx: hold(centre.x, fit.cx, fit.halfW - halfW), cz: hold(centre.z, fit.cz, fit.halfH - halfH), halfW, halfH };
}

/** The camera's horizontal half field of view (radians) from its vertical one and the view's aspect (width / height). */
export function horizontalHalfFov(verticalFov: number, aspect: number): number {
  return Math.atan(Math.tan(verticalFov / 2) * Math.max(0.01, aspect));
}

/** The camera on the minimap: where it stands, which way it looks, and the two edges of what it sees. */
export interface CameraMarker {
  x: number;
  y: number;
  /** Unit direction it faces on screen (y down). */
  dx: number;
  dy: number;
  /** The view's left and right edges `reach` pixels out. */
  left: { x: number; y: number };
  right: { x: number; y: number };
}

/**
 * The camera's marker on a w × h minimap: `yaw` as MapMaker's camera (0 looks north, up the minimap; a positive turn
 * looks east, to the right), the wedge `halfFov` either side, `reach` pixels long.
 */
export function cameraMarker(f: PlanFrame, w: number, h: number, cam: { x: number; z: number; yaw: number }, halfFov: number, reach: number): CameraMarker {
  const p = planToScreen(f, w, h, cam.x, cam.z);
  const dir = (a: number) => ({ x: Math.sin(a), y: -Math.cos(a) });
  const d = dir(cam.yaw);
  const l = dir(cam.yaw - halfFov);
  const r = dir(cam.yaw + halfFov);
  return { x: p.x, y: p.y, dx: d.x, dy: d.y, left: { x: p.x + l.x * reach, y: p.y + l.y * reach }, right: { x: p.x + r.x * reach, y: p.y + r.y * reach } };
}

/** How the minimap reads the map's pieces (MapMaker's own answers: the catalogue's cells, a set piece's footprint, an entity's level). */
export interface MinimapReader {
  /** A tile placement's grid cells [x, y, level], or null. */
  tileCells(t: MapDocument['classicStructure']['tiles'][number]): readonly (readonly [number, number, number])[] | null;
  /** A set-piece placement's grid cells (its footprint on each of its levels), or null (its definition is gone). */
  pieceCells(id: string): readonly (readonly [number, number, number])[] | null;
  /** The level an entity stands on; null: on the open ground, seen from every level. */
  entityLevel(e: MapEntity): number | null;
}

/** One selected thing's mark: a rectangle round a tile's or set piece's cells, or a point for an entity. */
export interface SelectionMark {
  id: string;
  kind: 'tile' | 'setpiece' | 'entity';
  /** World metres; a point has x0 = x1, z0 = z1. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** On the level shown (drawn solid), or only on others (drawn dashed: "N selected on other levels"). */
  current: boolean;
}

/** A rectangle round cells (on `level` where it has any there, else all of them). */
function cellsRect(cells: readonly (readonly [number, number, number])[], cell: number, level: number): { x0: number; z0: number; x1: number; z1: number; current: boolean } | null {
  if (!cells.length) return null;
  const here = cells.filter((c) => c[2] === level);
  const use = here.length ? here : cells;
  let r = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const [x, y] of use) r = { x0: Math.min(r.x0, x * cell - cell / 2), z0: Math.min(r.z0, y * cell - cell / 2), x1: Math.max(r.x1, x * cell + cell / 2), z1: Math.max(r.z1, y * cell + cell / 2) };
  return { ...r, current: here.length > 0 };
}

/** The selection's marks on a minimap of `level`, worked out once per selection, document and level (not per frame). */
export function selectionMarks(doc: MapDocument, sel: Selection, level: number, read: MinimapReader): SelectionMark[] {
  const out: SelectionMark[] = [];
  const cell = doc.classicStructure.cellSize;
  if (sel.tiles.length) {
    const want = new Set(sel.tiles);
    for (const t of doc.classicStructure.tiles) {
      if (!want.has(t.id)) continue;
      const r = cellsRect(read.tileCells(t) ?? [[t.x, t.y, t.z]], cell, level);
      if (r) out.push({ id: t.id, kind: 'tile', ...r });
    }
  }
  for (const id of sel.setPieces ?? []) {
    const r = cellsRect(read.pieceCells(id) ?? [], cell, level);
    if (r) out.push({ id, kind: 'setpiece', ...r });
  }
  if (sel.entities.length) {
    const want = new Set(sel.entities);
    for (const e of doc.entities) {
      if (!want.has(e.id)) continue;
      const lv = read.entityLevel(e);
      const [x, , z] = e.position;
      out.push({ id: e.id, kind: 'entity', x0: x, z0: z, x1: x, z1: z, current: lv === null || lv === level });
    }
  }
  return out;
}

/** What a click on the minimap can't pick: the outliner's locked and hidden things, and the map layers switched off. */
export interface MinimapPickFilter {
  skip?: (id: string) => boolean;
  /** Map layers off (EditorView.hiddenLayers: 'tile', 'prop', 'pickup', 'logic', 'spawn'). */
  hiddenLayers?: ReadonlySet<string>;
}

/** The map layer an entity is drawn in (as EditorView: props and mounts, spawns, pickups, everything else logic). */
export function entityLayer(e: Pick<MapEntity, 'kind'>): string {
  return e.kind === 'prop' || e.kind === 'spawn' || e.kind === 'pickup' ? e.kind : e.kind === 'mount' ? 'prop' : 'logic';
}

/**
 * What a click at world (x, z) on a minimap of `level` picks: the nearest entity on that level within `reach` metres
 * (a marker's size on screen), else the set piece, else the tile, with a cell there on that level. Null: open ground
 * (the click moves the camera there instead).
 */
export function minimapPick(doc: MapDocument, level: number, x: number, z: number, reach: number, read: MinimapReader, filter: MinimapPickFilter = {}): Selection | null {
  const skip = filter.skip ?? (() => false);
  const layers = filter.hiddenLayers;
  let best: { id: string; d: number } | null = null;
  for (const e of doc.entities) {
    if (layers?.has(entityLayer(e)) || skip(e.id)) continue;
    const d = Math.hypot(e.position[0] - x, e.position[2] - z);
    if (d > reach || (best && d >= best.d)) continue;
    const lv = read.entityLevel(e);
    if (lv !== null && lv !== level) continue;
    best = { id: e.id, d };
  }
  if (best) return { tiles: [], entities: [best.id] };
  const cell = doc.classicStructure.cellSize;
  const cx = Math.round(x / cell);
  const cy = Math.round(z / cell);
  const has = (cells: readonly (readonly [number, number, number])[] | null) => !!cells?.some((c) => c[0] === cx && c[1] === cy && c[2] === level);
  for (const p of doc.setPieces ?? []) if (!skip(p.id) && has(read.pieceCells(p.id))) return { tiles: [], entities: [], setPieces: [p.id] };
  if (!layers?.has('tile')) for (const t of doc.classicStructure.tiles) if (!skip(t.id) && has(read.tileCells(t) ?? [[t.x, t.y, t.z]])) return { tiles: [t.id], entities: [] };
  return null;
}

/** The level a box belongs to on the minimap: a floor by its top (what you stand on), anything else by its foot. */
export function boxLevel(b: { kind: string; min: readonly number[]; max: readonly number[] }, levelHeight: number): number {
  const y = b.kind === 'floor' ? b.max[1]! : b.min[1]!;
  return Math.floor((y + 0.5) / levelHeight);
}

/** Pixels per metre for the minimap's baked picture of an area: about 3, never over `maxPx` on its longer side. */
export function bakeScale(area: PlanArea, maxPx = 1600, want = 3): number {
  const span = Math.max(1, area.x1 - area.x0, area.z1 - area.z0);
  return Math.max(0.25, Math.min(want, maxPx / span));
}

/**
 * When the minimap's picture is made again (per revision, never per pointer move): at once for a new level, map or
 * layer filter; a moment after the last edit (`idleMs`), but at most `maxWaitMs` after the first one of a burst, so a
 * long run of edits still shows; never during a drag. Returns ms to wait, or null for "not now".
 */
export function bakeDelay(o: { edited: boolean; firstEditAgo: number; dragging: boolean; idleMs?: number; maxWaitMs?: number }): number | null {
  if (o.dragging) return null;
  if (!o.edited) return 0;
  const idle = o.idleMs ?? 350;
  const max = o.maxWaitMs ?? 1500;
  return Math.max(0, Math.min(idle, max - o.firstEditAgo));
}
