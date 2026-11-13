import { coreCatalog, type TileCatalog } from '../map/catalog.ts';
import { boxFootprint, buildMapGeometry, type WorldBox } from '../map/geometry.ts';
import { expandSetPieces, setPiecePartId, type SetPieceLibrary } from '../map/setPieces.ts';
import { builtInSetPieces } from '../map/setPieceLibrary.ts';
import type { MapDocument, MapPath } from '../map/schema.ts';
import { terrainHeightAt, type TerrainData } from '../map/terrain.ts';
import { pathGeometry, pathUses, trackPointAt } from '../map/track.ts';
import type { EditCommand } from './commands.ts';
import { moveCommand, moveEntitiesCommand, type Selection } from './operations.ts';

/**
 * Fit the ground to a build, and the reverse (MapMaker's selection menu and Paths pane; docs/BUILDING_KIT.md "Ground
 * and floors"). Owner, 2026-11-12: foundations hung over slopes, and raising the ground to them by brush was slow.
 *
 * Fit: the ground as made (the stored heights; what a tunnel or a floor does to the ground as played is worked out
 * from them, not stored) is brought to the build's base under its footprint and a cell round it, and from there eased
 * back into the ground about over `blend` metres (further where the ground is far above or below, so the bank stays
 * walkable). It raises and lowers. One undo step.
 * Settle: the build is moved down or up onto the ground instead; the ground stays.
 */

/** How far from the footprint the ground is eased back into the ground about (m), unless told otherwise. */
export const GROUND_FIT_BLEND = 6;
export const GROUND_FIT_BLEND_RANGE = { min: 0, max: 40 } as const;
/** The bank left where the ground is far from the build's height: this many metres out for every metre up or down. */
const BANK = 2;
/** A floor box this thin is a slab the ground comes up to the top of; anything taller stands on the ground with its bottom. */
const SLAB = 1;
/** Parts of a build this far above its base (m) are not what stands on the ground (upper floors, roofs, overhangs). */
const GROUNDED = 1;

/** Where the ground should be at a point: `d` metres outside what it is fitted to (0: under it), and the height there. */
type Want = (x: number, z: number) => { d: number; y: number } | null;

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Distance from a point to a convex outline (0 inside). */
function outlineDistance(corners: readonly (readonly [number, number])[], x: number, z: number): number {
  let inside = true;
  let sign = 0;
  let best = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const px = x - a[0];
    const pz = z - a[1];
    const cross = ex * pz - ez * px;
    if (Math.abs(cross) > 1e-9) {
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) inside = false;
    }
    const l2 = ex * ex + ez * ez;
    const u = l2 > 1e-12 ? Math.max(0, Math.min(1, (px * ex + pz * ez) / l2)) : 0;
    best = Math.min(best, Math.hypot(px - ex * u, pz - ez * u));
  }
  return inside ? 0 : best;
}

/**
 * The stored heights with the ground brought to `want` and eased out over `blend` metres. Under the thing and for a
 * cell round it (`grow`, so every cell it touches lies wholly at its height) the ground is at the height wanted.
 */
export function fitGround(t: TerrainData, want: Want, blend: number, bounds: { min: [number, number]; max: [number, number] }): { heights: number[]; raised: number; lowered: number; most: number } | null {
  const s = t.spacing;
  const grow = s;
  const reach = grow + (blend > 0 ? GROUND_FIT_BLEND_RANGE.max : 0);
  const c0 = Math.max(0, Math.floor((bounds.min[0] - reach - t.origin[0]) / s));
  const c1 = Math.min(t.cols - 1, Math.ceil((bounds.max[0] + reach - t.origin[0]) / s));
  const r0 = Math.max(0, Math.floor((bounds.min[1] - reach - t.origin[1]) / s));
  const r1 = Math.min(t.rows - 1, Math.ceil((bounds.max[1] + reach - t.origin[1]) / s));
  let heights: number[] | null = null;
  let raised = 0;
  let lowered = 0;
  let most = 0;
  let under = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const w = want(t.origin[0] + c * s, t.origin[1] + r * s);
      if (!w) continue;
      const out = Math.max(0, w.d - grow);
      if (out > 0 && blend <= 0) continue;
      const i = r * t.cols + c;
      const h = t.heights[i]!;
      // Eased over the blend distance, or further where the ground is far above or below the build: the bank it
      // leaves stays walkable (two metres out for every metre of height, about 35° at its steepest).
      const over = Math.min(GROUND_FIT_BLEND_RANGE.max, Math.max(blend, BANK * Math.abs(w.y - t.baseY - h / 100)));
      if (out > over) continue;
      const k = out <= 0 ? 1 : smooth(1 - out / over);
      const to = Math.max(-5000, Math.min(20000, Math.round(h + ((w.y - t.baseY) * 100 - h) * k)));
      if (to === h) continue;
      heights ??= [...t.heights];
      heights[i] = to;
      if (out <= 0) under++;
      if (to > h) raised++;
      else lowered++;
      most = Math.max(most, Math.abs(to - h) / 100);
    }
  }
  // Nothing moved under it or in the cell round it: the ground meets it already (the easing alone, done again, would
  // only creep further out each time).
  return heights && under ? { heights, raised, lowered, most: Math.round(most * 100) / 100 } : null;
}

/** What of a selection stands on the ground: its boxes near its base, and the base (the lowest slab's top, or the lowest bottom). */
function groundedBoxes(doc: MapDocument, sel: Selection, catalog: TileCatalog, library: SetPieceLibrary): { boxes: WorldBox[]; base: number } | { error: string } {
  const ids = new Set([...sel.tiles, ...sel.entities]);
  const pieces = sel.setPieces ?? [];
  if (!ids.size && !pieces.length) return { error: 'nothing selected' };
  const mine = (id: string) => ids.has(id) || pieces.some((p) => id.startsWith(setPiecePartId(p, 0).slice(0, -1)));
  const all = buildMapGeometry(expandSetPieces(doc, library, catalog).map, catalog).filter((b) => b.kind !== 'barrier' && b.kind !== 'trim' && mine(b.sourceId));
  if (!all.length) return { error: 'the selection has nothing that stands on the ground (select tiles, a set piece, blocks or props)' };
  const baseOf = (b: WorldBox) => (b.kind === 'floor' && b.max[1] - b.min[1] <= SLAB ? b.max[1] : b.min[1]);
  const base = Math.min(...all.map(baseOf));
  return { boxes: all.filter((b) => baseOf(b) <= base + GROUNDED), base };
}

function outlineBounds(outlines: readonly (readonly (readonly [number, number])[])[]): { min: [number, number]; max: [number, number] } {
  const xs = outlines.flatMap((o) => o.map((p) => p[0]));
  const zs = outlines.flatMap((o) => o.map((p) => p[1]));
  return { min: [Math.min(...xs), Math.min(...zs)], max: [Math.max(...xs), Math.max(...zs)] };
}

export interface GroundFitResult {
  command: EditCommand;
  /** Terrain points raised and lowered, and the most any moved (m). */
  raised: number;
  lowered: number;
  most: number;
}

/** Fit the ground to the selection: tiles, set pieces, blocks and props (their parts that stand on the ground). */
export function fitGroundToSelectionCommand(doc: MapDocument, sel: Selection, blend = GROUND_FIT_BLEND, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): GroundFitResult | { error: string } {
  const t = doc.terrain;
  if (!t) return { error: 'this map has no terrain' };
  const g = groundedBoxes(doc, sel, catalog, library);
  if ('error' in g) return g;
  const outlines = g.boxes.map((b) => boxFootprint(b));
  const want: Want = (x, z) => {
    let d = Infinity;
    for (const o of outlines) {
      d = Math.min(d, outlineDistance(o, x, z));
      if (d === 0) break;
    }
    return { d, y: g.base };
  };
  const fit = fitGround(t, want, blend, outlineBounds(outlines));
  if (!fit) return { error: 'the ground already meets it (for another blend: undo, then fit again)' };
  return { command: { kind: 'setTerrain', before: t, after: { ...t, heights: fit.heights } }, raised: fit.raised, lowered: fit.lowered, most: fit.most };
}

/**
 * Settle the selection onto the ground as made: blocks, props and other free things go straight down (or up) until
 * their base is on the lowest ground under them, so nothing hangs; a selection with tiles or set pieces moves by whole
 * levels to the level nearest the ground under it. The ground stays as it is (Fit ground then closes what is left).
 */
export function settleSelectionOnGroundCommand(doc: MapDocument, sel: Selection, catalog: TileCatalog = coreCatalog, library: SetPieceLibrary = builtInSetPieces()): { command: EditCommand; by: number } | { error: string } {
  const t = doc.terrain;
  if (!t) return { error: 'this map has no terrain' };
  const g = groundedBoxes(doc, sel, catalog, library);
  if ('error' in g) return g;
  // The ground under it: at its corners, and at every terrain point and a grid of its own under its footprint.
  const ground: number[] = [];
  const at = (x: number, z: number) => {
    const h = terrainHeightAt(t, x, z);
    if (h !== null) ground.push(h);
  };
  for (const b of g.boxes) {
    const o = boxFootprint(b);
    for (const p of o) at(p[0], p[1]);
    const n = 4;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const u = i / n;
      const v = j / n;
      at((o[0]![0] * (1 - u) + o[1]![0] * u) * (1 - v) + (o[3]![0] * (1 - u) + o[2]![0] * u) * v, (o[0]![1] * (1 - u) + o[1]![1] * u) * (1 - v) + (o[3]![1] * (1 - u) + o[2]![1] * u) * v);
    }
  }
  if (!ground.length) return { error: 'it is not over the terrain' };
  const gridded = sel.tiles.length > 0 || (sel.setPieces ?? []).length > 0;
  const { levelHeight } = doc.classicStructure;
  if (gridded) {
    const mean = ground.reduce((a, b) => a + b, 0) / ground.length;
    const levels = Math.round((mean - g.base) / levelHeight);
    if (!levels) return { error: `it is on the level nearest the ground already (tiles and set pieces move by whole levels of ${levelHeight} m): Fit ground brings the ground to it` };
    const cmd = moveCommand(doc, sel, 0, 0, levels, catalog, library);
    if ('error' in cmd) return cmd;
    return { command: cmd, by: levels * levelHeight };
  }
  const by = Math.round((Math.min(...ground) - g.base) * 100) / 100;
  if (Math.abs(by) < 0.01) return { error: 'it is on the ground already' };
  return { command: moveEntitiesCommand(doc, sel.entities, 0, by, 0), by };
}

/** Fit the ground to a path: to its line's height across its width, eased out over `blend` metres either side and past its ends. */
export function fitGroundToPathCommand(doc: MapDocument, pathId: string, blend = GROUND_FIT_BLEND): GroundFitResult | { error: string } {
  const t = doc.terrain;
  if (!t) return { error: 'this map has no terrain' };
  const path = (doc.paths ?? []).find((p) => p.id === pathId);
  if (!path || path.points.length < 2) return { error: 'no such path' };
  const geo = pathGeometry(path);
  const half = pathUses(path, 'road') ? path.width / 2 : 1;
  const reach = half + t.spacing + (blend > 0 ? GROUND_FIT_BLEND_RANGE.max : 0) + 1;
  const want: Want = (x, z) => {
    const near = geo.nearest(x, z, reach);
    if (!near) return null;
    // Past an open path's end the distance is to the end itself, not to the line carried on.
    return { d: Math.max(0, Math.hypot(x - near.sample.x, z - near.sample.z) - half), y: near.sample.y };
  };
  const xs = path.points.map((p) => p[0]);
  const zs = path.points.map((p) => p[2]);
  // (A curve may swing a little outside its points.)
  const pad = half + 4;
  const fit = fitGround(t, want, blend, { min: [Math.min(...xs) - pad, Math.min(...zs) - pad], max: [Math.max(...xs) + pad, Math.max(...zs) + pad] });
  if (!fit) return { error: 'the ground already meets it (for another blend: undo, then fit again)' };
  return { command: { kind: 'setTerrain', before: t, after: { ...t, heights: fit.heights } }, raised: fit.raised, lowered: fit.lowered, most: fit.most };
}

/** Settle a path onto the ground as made: each of its points at the ground's height there. */
export function settlePathOnGroundCommand(doc: MapDocument, pathId: string): { command: EditCommand; moved: number; most: number } | { error: string } {
  const t = doc.terrain;
  if (!t) return { error: 'this map has no terrain' };
  const paths = doc.paths ?? [];
  const path = paths.find((p) => p.id === pathId);
  if (!path) return { error: 'no such path' };
  let moved = 0;
  let most = 0;
  const points = path.points.map((p): [number, number, number] => {
    const q = trackPointAt(t, p[0], p[1], p[2]);
    if (Math.abs(q[1] - p[1]) >= 0.01) {
      moved++;
      most = Math.max(most, Math.abs(q[1] - p[1]));
    }
    return [p[0], q[1], p[2]];
  });
  if (!moved) return { error: 'its points are on the ground already' };
  const after: MapPath[] = paths.map((p) => (p.id === pathId ? { ...p, points } : p));
  return { command: { kind: 'setPaths', before: paths, after }, moved, most: Math.round(most * 100) / 100 };
}
