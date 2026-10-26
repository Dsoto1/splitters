import type { WorldBox } from './geometry.ts';
import type { MapDocument, MapEntity } from './schema.ts';
import { terrainHeightAt } from './terrain.ts';

/**
 * Borders that blend in (Sprint 6d): what stands just outside the map's
 * boundary so its edge reads as a place, not a wall in the air. Set on the
 * backdrop (`backdrop.border`, optionally per side in `backdrop.borderSides`)
 * and laid along the boundary rectangle (the map's bounds, or its terrain's
 * edge when it has no bounds):
 *
 * - cliffs: towering rock walls and mountains with ragged crests
 * - skyline: rows of city blocks, taller further out, windows lit at night
 * - fence: a park-style electric fence that hums, zaps and throws you back
 * - forest: a dense wall of trees with undergrowth in front
 * - water: a beach running down into open sea
 *
 * Unlike the rest of the backdrop a border is solid: this module gives the
 * collision (barrier boxes, so they are never drawn by the tile styler) and
 * the fence's shock lines; the client draws the rest from the same layout.
 */
export const BORDER_STYLES = ['none', 'cliffs', 'skyline', 'fence', 'forest', 'water'] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];

export const BORDER_LABELS: Record<BorderStyle, string> = {
  none: 'None (open edge)',
  cliffs: 'Cliffs & mountains',
  skyline: 'City blocks',
  fence: 'Electric fence',
  forest: 'Forest wall',
  water: 'Shoreline & sea',
};

/** Sides of the boundary rectangle: north is its +Z edge, east its +X edge. */
export const BORDER_SIDES = ['north', 'east', 'south', 'west'] as const;
export type BorderSide = (typeof BORDER_SIDES)[number];
export type BorderSides = Partial<Record<BorderSide, BorderStyle>>;

/** The electric fence (border style and the placeable "Electric Fence" trap). */
export const ELECTRIC_FENCE = {
  /** Post height above the ground (m). */
  height: 3.2,
  /** Posts at most this far apart (m). */
  postSpacing: 4,
  /** Heights of the live wires above the ground (m). */
  wires: [0.45, 1.05, 1.65, 2.25, 2.85] as readonly number[],
  /** The border fence stands this far inside the boundary line (m). */
  inset: 0.35,
  /** Touching distance from the wire line (m): the player's radius plus a little. */
  reach: 0.75,
  /** Damage per zap and how often one person can be zapped (seconds). */
  damage: 12,
  interval: 0.5,
  /** Push back (m/s) away from the wires. */
  knockback: 9,
  /** Default length of a placed fence run (m). */
  defaultLength: 12,
} as const;

export interface BorderEdge {
  side: BorderSide;
  style: Exclude<BorderStyle, 'none'>;
  /** The edge's two ends (world X, Z), running anticlockwise seen from above. */
  a: [number, number];
  b: [number, number];
  /** Unit vector pointing out of the play area. */
  out: [number, number];
  length: number;
}

type MapLike = Pick<MapDocument, 'bounds' | 'terrain' | 'backdrop'>;

/** The rectangle a border lines: the map's bounds, or its terrain's edge (when that is walled). */
export function borderRect(map: Pick<MapDocument, 'bounds' | 'terrain'>): { min: [number, number]; max: [number, number] } | null {
  if (map.bounds) return { min: [...map.bounds.min], max: [...map.bounds.max] };
  const t = map.terrain;
  if (t && t.boundary) return { min: [t.origin[0], t.origin[1]], max: [t.origin[0] + (t.cols - 1) * t.spacing, t.origin[1] + (t.rows - 1) * t.spacing] };
  return null;
}

/** Each side's border style (the map's style, overridden per side). */
export function borderStyles(map: Pick<MapDocument, 'backdrop'>): Record<BorderSide, BorderStyle> {
  const b = map.backdrop;
  const all = b?.border ?? 'none';
  const sides = b?.borderSides ?? {};
  return { north: sides.north ?? all, east: sides.east ?? all, south: sides.south ?? all, west: sides.west ?? all };
}

/** Whether any side has a border. */
export function hasBorder(map: Pick<MapDocument, 'backdrop'>): boolean {
  return Object.values(borderStyles(map)).some((s) => s !== 'none');
}

/** The bordered edges (sides with a style other than none) of the boundary rectangle. */
export function borderEdges(map: MapLike): BorderEdge[] {
  const rect = borderRect(map);
  if (!rect) return [];
  const styles = borderStyles(map);
  const [x0, z0] = rect.min;
  const [x1, z1] = rect.max;
  const raw: [BorderSide, [number, number], [number, number], [number, number]][] = [
    ['north', [x1, z1], [x0, z1], [0, 1]],
    ['west', [x0, z1], [x0, z0], [-1, 0]],
    ['south', [x0, z0], [x1, z0], [0, -1]],
    ['east', [x1, z0], [x1, z1], [1, 0]],
  ];
  const out: BorderEdge[] = [];
  for (const [side, a, b, o] of raw) {
    const style = styles[side];
    if (style === 'none') continue;
    out.push({ side, style, a, b, out: o, length: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  return out;
}

/**
 * Which side's style a point beyond the boundary belongs to (the side it lies
 * furthest past), or none inside the rectangle or without a border. The
 * backdrop uses it to keep its belt of props and its rolling ground out of a
 * border's way.
 */
export function borderStyleAt(map: MapLike, x: number, z: number): BorderStyle {
  const rect = borderRect(map);
  if (!rect) return 'none';
  const past: [BorderSide, number][] = [
    ['east', x - rect.max[0]],
    ['west', rect.min[0] - x],
    ['north', z - rect.max[1]],
    ['south', rect.min[1] - z],
  ];
  past.sort((p, q) => q[1] - p[1]);
  if (past[0]![1] < -1) return 'none';
  return borderStyles(map)[past[0]![0]];
}

/**
 * Ground height at a point by the boundary: the terrain (clamped to its edge
 * when the point lies past it), or `floorY` without terrain.
 */
export function borderGround(map: Pick<MapDocument, 'terrain'>, x: number, z: number, floorY: number): number {
  const t = map.terrain;
  if (!t) return floorY;
  const cx = Math.min(Math.max(x, t.origin[0]), t.origin[0] + (t.cols - 1) * t.spacing);
  const cz = Math.min(Math.max(z, t.origin[1]), t.origin[1] + (t.rows - 1) * t.spacing);
  return terrainHeightAt(t, cx, cz) ?? floorY;
}

/** Lowest point anything stands on: the terrain's lowest height or the lowest floor in `boxes`. */
export function borderFloor(map: Pick<MapDocument, 'terrain'>, boxes: readonly WorldBox[]): number {
  let floorY = Infinity;
  for (const b of boxes) if (b.kind === 'floor') floorY = Math.min(floorY, b.max[1]);
  if (map.terrain) floorY = Math.min(floorY, map.terrain.baseY + Math.min(...map.terrain.heights) / 100);
  return Number.isFinite(floorY) ? floorY : 0;
}

/** How high each style's solid wall reaches above the ground at the line (the bounds' own barrier carries on above). */
const SOLID_HEIGHT: Record<Exclude<BorderStyle, 'none'>, number> = { cliffs: 24, skyline: 20, forest: 12, fence: ELECTRIC_FENCE.height, water: 0 };
/** Collision is laid in pieces this long along an edge, each as high as its highest ground. */
const SOLID_STEP = 12;

/**
 * Collision for a map's border: a solid band just outside the line along every
 * bordered side (cliffs, city blocks and trees are as solid as they look,
 * whatever the bounds' own style), and the electric fence's mesh just inside
 * it. All barrier boxes: they stop players, bots and shots but are drawn by the
 * border's own visuals, not as theme walls.
 */
export function borderBoxes(map: MapLike, floorY: number): WorldBox[] {
  const out: WorldBox[] = [];
  const id = '__border';
  for (const e of borderEdges(map)) {
    const h = SOLID_HEIGHT[e.style];
    if (!h) continue;
    const n = Math.max(1, Math.ceil(e.length / SOLID_STEP));
    const [dx, dz] = [(e.b[0] - e.a[0]) / e.length, (e.b[1] - e.a[1]) / e.length];
    const fence = e.style === 'fence';
    // The fence stands just inside the line; everything else fills a band just outside it.
    const v0 = fence ? -ELECTRIC_FENCE.inset - 0.08 : 0;
    const v1 = fence ? -ELECTRIC_FENCE.inset + 0.08 : 3;
    // Run past the ends so corners close.
    const ext = fence ? 0 : 3;
    for (let i = 0; i < n; i++) {
      const u0 = (e.length * i) / n - (i === 0 ? ext : 0);
      const u1 = (e.length * (i + 1)) / n + (i === n - 1 ? ext : 0);
      let ground = -Infinity;
      for (const u of [u0, (u0 + u1) / 2, u1]) ground = Math.max(ground, borderGround(map, e.a[0] + dx * u, e.a[1] + dz * u, floorY));
      const pts = [
        [e.a[0] + dx * u0 + e.out[0] * v0, e.a[1] + dz * u0 + e.out[1] * v0],
        [e.a[0] + dx * u1 + e.out[0] * v1, e.a[1] + dz * u1 + e.out[1] * v1],
      ] as const;
      out.push({
        min: [Math.min(pts[0][0], pts[1][0]), Math.min(floorY - 20, ground - 2), Math.min(pts[0][1], pts[1][1])],
        max: [Math.max(pts[0][0], pts[1][0]), ground + h, Math.max(pts[0][1], pts[1][1])],
        kind: 'barrier',
        sourceId: id,
      });
    }
  }
  return out;
}

/** A live wire run: shocks anyone within ELECTRIC_FENCE.reach of the segment a–b, from `y0` up to `y0 + height`. */
export interface ShockLine {
  a: [number, number];
  b: [number, number];
  /** Ground under the run (lowest end); without terrain, the floor. */
  y0: number;
  height: number;
  /** Which way a victim is thrown: towards the play area for the border; away from the side they touched for a placed fence (null). */
  push: [number, number] | null;
  /** Map entity index of a placed fence (null: the border). */
  entity: number | null;
}

/** Where a placed electric fence's run starts and ends (its position is the middle; it runs along its local X). */
export function fenceRun(e: Extract<MapEntity, { kind: 'trap' }>): { a: [number, number]; b: [number, number]; length: number } {
  const length = e.length ?? ELECTRIC_FENCE.defaultLength;
  const c = Math.cos(e.yaw);
  const s = Math.sin(e.yaw);
  const [x, , z] = e.position;
  return { a: [x - (c * length) / 2, z + (s * length) / 2], b: [x + (c * length) / 2, z - (s * length) / 2], length };
}

/** The border's electric fence as shock lines (pieces as long as the posts are apart, so they follow the ground). */
export function borderShockLines(map: MapLike, floorY: number): ShockLine[] {
  const out: ShockLine[] = [];
  for (const e of borderEdges(map)) {
    if (e.style !== 'fence') continue;
    const n = Math.max(1, Math.ceil(e.length / (ELECTRIC_FENCE.postSpacing * 3)));
    const [dx, dz] = [(e.b[0] - e.a[0]) / e.length, (e.b[1] - e.a[1]) / e.length];
    const inset = ELECTRIC_FENCE.inset;
    for (let i = 0; i < n; i++) {
      const p = (u: number): [number, number] => [e.a[0] + dx * u - e.out[0] * inset, e.a[1] + dz * u - e.out[1] * inset];
      const a = p((e.length * i) / n);
      const b = p((e.length * (i + 1)) / n);
      const y0 = Math.min(borderGround(map, a[0], a[1], floorY), borderGround(map, b[0], b[1], floorY));
      out.push({ a, b, y0, height: ELECTRIC_FENCE.height + Math.abs(borderGround(map, a[0], a[1], floorY) - borderGround(map, b[0], b[1], floorY)), push: [-e.out[0], -e.out[1]], entity: null });
    }
  }
  return out;
}

/** Collision for placed electric fences: a thin solid panel along each run (barrier: the fence draws itself). */
export function electricFenceBoxes(map: Pick<MapDocument, 'entities'>): WorldBox[] {
  const out: WorldBox[] = [];
  for (const e of map.entities) {
    if (e.kind !== 'trap' || e.trap !== 'shock') continue;
    const length = e.length ?? ELECTRIC_FENCE.defaultLength;
    const [x, y, z] = e.position;
    out.push({ min: [x - length / 2 - 0.08, y - 0.3, z - 0.08], max: [x + length / 2 + 0.08, y + ELECTRIC_FENCE.height, z + 0.08], kind: 'barrier', sourceId: e.id, ...(e.yaw ? { yaw: e.yaw } : {}) });
  }
  return out;
}

/**
 * Nearest point on a shock line to `p` (horizontal), its distance, and the
 * side of the line `p` is on (+1 / -1, along the line's left normal).
 */
export function shockLineNearest(l: Pick<ShockLine, 'a' | 'b'>, x: number, z: number): { x: number; z: number; dist: number; side: number } {
  const [ax, az] = l.a;
  const [bx, bz] = l.b;
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2));
  const px = ax + vx * t;
  const pz = az + vz * t;
  const cross = vx * (z - az) - vz * (x - ax);
  return { x: px, z: pz, dist: Math.hypot(x - px, z - pz), side: cross >= 0 ? 1 : -1 };
}

/** Small deterministic hash-noise in [0, 1) for border layouts (same on every machine). */
export function borderNoise(seed: number, i: number): number {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(i, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A seed from text (the map ID), so every machine lays the same border. */
export function borderSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
