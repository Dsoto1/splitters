import { SIDES, TILE_DIMENSIONS, coreCatalog, type TileCatalog } from '../map/catalog.ts';
import { buildOccupancy, edgeKey, localSide, resolveEdge, type ResolvedEdge } from '../map/geometry.ts';
import type { GlassKind, MapDocument, MapEntity } from '../map/schema.ts';
import type { Vec3 } from '../math.ts';
import type { OBox } from './scenarioDefs.ts';

/**
 * Glass panes: real glass in window edges (a tile placement's `glass` per
 * side) and glass blocks (a block's `glass`). Panes stop players but never
 * sight; breakable panes let shots through and shatter on the way, reinforced
 * (bulletproof) panes stop shots and crack. The server, every predicting
 * client and the renderer build the same list from the map, in the same order,
 * so a pane is known everywhere by its place in it.
 */

export const GLASS = {
  /** Pane thickness (m): thin, but thick enough for the character controller. */
  thickness: 0.06,
  /** Breakable glass breaks at the first hit. */
  breakableHealth: 1,
  /** Reinforced glass soaks this much before it is fully cracked (it never breaks). */
  reinforcedHealth: 600,
  /** Share of its damage a round keeps for each breakable pane it shatters on the way (glass slows it a little). */
  passDamage: 0.8,
  /** Default tint (a slight sea-green, like float glass seen edge on). */
  tint: '#bfe3e8',
} as const;

/** Edge styles that have a window opening glass can fill. */
export const GLASS_EDGES: ReadonlySet<ResolvedEdge> = new Set<ResolvedEdge>(['window', 'windows', 'slit']);

/**
 * The window openings of an edge style along one side: [u0, u1, y0, y1], u
 * along the side (-half..half), y above the floor. Matches edgeSegments.
 */
export function windowOpenings(style: ResolvedEdge, height: number): [number, number, number, number][] {
  const top = (h: number) => Math.min(h, height);
  switch (style) {
    case 'window':
      return [[-1.3, 1.3, 0.9, top(2.5)]];
    case 'windows':
      return [
        [-2.7, -0.8, 0.9, top(2.5)],
        [0.8, 2.7, 0.9, top(2.5)],
      ];
    case 'slit':
      return [[-1.5, 1.5, 1.25, top(1.6)]];
    default:
      return [];
  }
}

export interface GlassPane {
  /** Stable name: `<placement id>:<edge key>[:n]` for windows, the block's ID for glass blocks. */
  id: string;
  box: OBox;
  kind: GlassKind;
  /** The block entity's index for glass blocks (they live at their entity index in the scenario); absent for window panes. */
  entity?: number;
  /** Tint of a glass block (hex), when it has one. */
  tint?: string;
}

/** A block's world box (centre, half size, turn), as blockOBox in scenarioDefs. Kept here so this file has no runtime import of it. */
function blockBox(e: Extract<MapEntity, { kind: 'block' }>): OBox {
  const [w, h, d] = e.size;
  return { center: { x: e.position[0], y: e.position[1] + h / 2, z: e.position[2] }, half: { x: w / 2, y: h / 2, z: d / 2 }, yaw: e.yaw };
}

/** Is this block a glass block (solid behaviour with glass)? */
export const isGlassBlock = (e: MapEntity): e is Extract<MapEntity, { kind: 'block' }> & { glass: GlassKind } => e.kind === 'block' && !!e.glass && e.behaviour === 'solid' && !e.field;

/** Window panes from tile edges, in a fixed order (tiles, then cells, then sides N E S W, then openings). */
export function windowPanes(map: MapDocument, catalog: TileCatalog = coreCatalog): GlassPane[] {
  if (!map.classicStructure.tiles.some((t) => t.glass && Object.keys(t.glass).length)) return [];
  const { cellSize, levelHeight } = map.classicStructure;
  const half = cellSize / 2;
  const v = TILE_DIMENSIONS.wallThickness / 2;
  const { cells } = buildOccupancy(map, catalog);
  const out: GlassPane[] = [];
  for (const [key, occ] of cells) {
    const glass = occ.placement.glass;
    if (!glass) continue;
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    for (const side of SIDES) {
      const ek = edgeKey(occ.local, localSide(side, occ.placement.rotation));
      const kind = glass[ek];
      if (!kind) continue;
      const style = resolveEdge(cells, gx, gy, gz, side);
      if (!GLASS_EDGES.has(style)) continue;
      const cx = gx * cellSize;
      const cz = gy * cellSize;
      const baseY = gz * levelHeight;
      windowOpenings(style, levelHeight).forEach(([u0, u1, y0, y1], n) => {
        const u = (u0 + u1) / 2;
        const hu = (u1 - u0) / 2;
        const hy = (y1 - y0) / 2;
        const t = GLASS.thickness / 2;
        const y = baseY + y0 + hy;
        const center: Vec3 = side === 'N' ? { x: cx + u, y, z: cz + half - v } : side === 'S' ? { x: cx + u, y, z: cz - half + v } : side === 'E' ? { x: cx + half - v, y, z: cz + u } : { x: cx - half + v, y, z: cz + u };
        const halfBox = side === 'N' || side === 'S' ? { x: hu, y: hy, z: t } : { x: t, y: hy, z: hu };
        out.push({ id: `${occ.placement.id}:${ek}${n ? `:${n}` : ''}`, box: { center, half: halfBox, yaw: 0 }, kind });
      });
    }
  }
  return out;
}

/** Glass blocks, by entity index. */
export function glassBlocks(map: MapDocument): GlassPane[] {
  const out: GlassPane[] = [];
  map.entities.forEach((e, i) => {
    if (isGlassBlock(e)) out.push({ id: e.id, box: blockBox(e), kind: e.glass, entity: i, ...(e.tint ? { tint: e.tint } : {}) });
  });
  return out;
}

/**
 * Where a ray enters an upright (yaw-only) box, as a distance along the
 * normalised `dir`, or null when it misses within maxDist. Tilted boxes are
 * treated as level.
 */
export function rayOBox(origin: Vec3, dir: Vec3, maxDist: number, b: OBox): number | null {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  // Into the box's frame (the inverse of localToWorld's turn).
  const ox = origin.x - b.center.x;
  const oz = origin.z - b.center.z;
  const o = { x: ox * c - oz * s, y: origin.y - b.center.y, z: ox * s + oz * c };
  const d = { x: dir.x * c - dir.z * s, y: dir.y, z: dir.x * s + dir.z * c };
  let t0 = 0;
  let t1 = maxDist;
  for (const k of ['x', 'y', 'z'] as const) {
    const h = b.half[k];
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < -h || o[k] > h) return null;
      continue;
    }
    let u = (-h - o[k]) / d[k];
    let w = (h - o[k]) / d[k];
    if (u > w) [u, w] = [w, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, w);
    if (t0 > t1) return null;
  }
  return t0;
}

/** Crack level (0 clean .. 1 fully cracked) of a pane from its replicated health percentage. */
export const glassCracks = (healthPct: number): number => Math.max(0, Math.min(1, 1 - healthPct / 100));

const paneCache = new WeakMap<MapDocument, GlassPane[]>();

/** windowPanes, worked out once per map document (documents are replaced, not changed, when edited). */
export function cachedWindowPanes(map: MapDocument): GlassPane[] {
  let panes = paneCache.get(map);
  if (!panes) paneCache.set(map, (panes = windowPanes(map)));
  return panes;
}

/** The glass at a scenario index: a window pane (past the entities) or a glass block; null for anything else. */
export function glassAt(map: MapDocument, i: number): GlassPane | null {
  if (i >= map.entities.length) return cachedWindowPanes(map)[i - map.entities.length] ?? null;
  const e = map.entities[i];
  return e && isGlassBlock(e) ? { id: e.id, box: blockBox(e), kind: e.glass, entity: i, ...(e.tint ? { tint: e.tint } : {}) } : null;
}
