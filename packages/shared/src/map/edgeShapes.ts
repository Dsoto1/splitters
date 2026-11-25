/**
 * Edge styles as pieces (content/tiles/edges.json via edgeStyles.generated.ts): the collision segments and the trim of
 * one style along a side `half` long each way from its middle. Map geometry builds them on every cell side
 * (map/geometry.ts, which re-exports these), and the kit's `wallRun` part (map/catalog.ts) along any segment. This
 * module imports no map code, so the catalog can build kit tiles from it while it loads.
 */

import { EDGE_SHAPES } from '../content/edgeStyles.generated.ts';
import type { EdgeArch, EdgeRepeat, EdgeShape, EdgeStyle, EdgeValue } from './tileOptions.ts';

/** The kit's wall thickness (TILE_DIMENSIONS.wallThickness in map/catalog.ts; a kit test keeps them equal). */
export const WALL_THICKNESS = 0.5;

/**
 * What gets built on one side of one cell: `none` (no wall: open ground, the
 * inside of a multi-cell tile, or a side left open), or one of the edge styles.
 */
export type ResolvedEdge = Exclude<EdgeStyle, 'auto' | 'open'> | 'none';

/** The shape of a built edge style (content/tiles/edges.json); none for `none`. */
export const shapeOf = (style: ResolvedEdge): EdgeShape | undefined => (style === 'none' ? undefined : EDGE_SHAPES[style]);

/** The surface a style's segments and trim are drawn in instead of the walls' and trim's: `metal` (bars, gates, railings). */
export const edgePaint = (style: ResolvedEdge): 'metal' | undefined => shapeOf(style)?.paint;

/** Thinner than this (m) across its face or in height, a see-through style's piece is a bar, a post or a rail. */
const LATTICE_PIECE = 0.25;

/**
 * Whether a collision segment of `style` is part of a lattice you see and shoot between: a bar, post or rail of a
 * see-through style (bars, the tall fence: `dressing` see-through) or a barred one (`paint` metal: bars, barred gates).
 * Such a piece still stops bodies and the rounds that strike it, but not sight lines (PhysicsWorld: GROUP_LATTICE), so
 * bots see, and fire at, someone through the gaps as a player does (owner, 2026-11-16: "bots wont target me or others
 * when on other side of a fence or bars/door with bars"). A railing's solid 1 m panel is not a lattice.
 */
export function edgeLattice(style: ResolvedEdge, seg: readonly [number, number, number, number, number]): boolean {
  const shape = shapeOf(style);
  if (!shape || !(shape.paint === 'metal' || shape.dressing?.kind === 'see-through')) return false;
  return seg[1] - seg[0] <= LATTICE_PIECE || seg[3] - seg[2] <= LATTICE_PIECE;
}

/** An edge value along a side `half` long each way from its middle, on a level `height` high. */
function edgeValue(v: EdgeValue, half: number, height: number): number {
  if (typeof v === 'number') return v;
  if ('upTo' in v) return Math.min(v.upTo, height);
  const [x, k] = 'half' in v ? [half, v.half] : [height, v.height];
  const base = k === 1 ? x : k === -1 ? -x : x * k;
  return v.add === undefined ? base : base + v.add;
}

/** Each position of a repeat along a side. */
function repeatAlong(r: EdgeRepeat, half: number, height: number, at: (u: number) => void): void {
  const from = edgeValue(r.from, half, height);
  const to = edgeValue(r.to, half, height);
  if (r.through) for (let u = from; u <= to + 1e-6; u += r.step) at(u);
  else for (let u = from; u < to; u += r.step) at(u);
}

/**
 * Wall pieces of an edge style along one side: [u0, u1, y0, y1, thickness] with u along the side (-half..half).
 * `wall`: the thickness of a piece that gives none (a tile's side: the kit's 0.5 m; a free block's doorway: the block's).
 */
export function edgeSegments(style: ResolvedEdge, half: number, height: number, wall = WALL_THICKNESS): [number, number, number, number, number][] {
  const out: [number, number, number, number, number][] = [];
  const v = (x: EdgeValue) => edgeValue(x, half, height);
  for (const s of shapeOf(style)?.segments ?? []) {
    const t = s.t ?? wall;
    const r = s.repeat;
    if (r) {
      const [o0, o1] = s.u as readonly [number, number];
      repeatAlong(r, half, height, (u) => out.push([r.clamp ? Math.max(-half, u + o0) : u + o0, r.clamp ? Math.min(half, u + o1) : u + o1, v(s.y[0]), v(s.y[1]), t]));
    } else out.push([v(s.u[0]), v(s.u[1]), v(s.y[0]), v(s.y[1]), t]);
  }
  return out;
}

/**
 * One trim box of a side, in the side's own frame: u along it, y up, v in from the cell's boundary (v0 < v1: the wall
 * itself spans v 0 to its thickness), turned `tilt` radians in the wall's plane about its middle (the +u end rises).
 */
export interface SideTrim {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  v0: number;
  v1: number;
  tilt?: number;
  /** On the wall's inner face: how far it stands off it (v1 - v0, as the style gives it). */
  depth?: number;
  /** A library material of its own (the style's `surface`), instead of the tile's trim surface. */
  surface?: { material: string; tint: string | null };
}

/** How thick a segmental arch's soffit is (from the curve up into the wall: it covers the stepped collision above it). */
const ARCH_SOFFIT = 0.2;
/** The joint between two voussoirs, along the curve. */
const ARCH_JOINT = 0.025;

/**
 * A segmental arch's dressing on one face: its voussoirs (the keystone `key` m taller in the middle of an odd count)
 * on the circle through the springing points and the crown, each standing off the face from `v0` by its depth (the
 * keystone `keyDepth` more, 0.04 m unless the style says), and (`soffit`) the arch's underside through the wall's
 * thickness `t`, tangent to the curve; all of `surface`, when the style gives the arch a material of its own.
 */
function archTrim(a: EdgeArch, v0: number, outward: boolean, soffit: number, surface: Pick<SideTrim, 'surface'> = {}): SideTrim[] {
  const [u0, u1] = a.u;
  const [spring, crown] = a.y;
  const c = (u1 - u0) / 2;
  const rise = crown - spring;
  if (!(c > 0 && rise > 0 && a.count >= 1)) return [];
  const mid = (u0 + u1) / 2;
  const r = (c * c + rise * rise) / (2 * rise);
  const centre = crown - r;
  const sweep = Math.asin(Math.min(1, c / r));
  const step = (2 * sweep) / a.count;
  const halfLen = r * Math.tan(step / 2);
  const depth = a.depth ?? 0.06;
  const out: SideTrim[] = [];
  const piece = (at: number, radius: number, along: number, band: number, va: number, vb: number, depth?: number) => {
    const u = mid + (radius + band / 2) * Math.sin(at);
    const y = centre + (radius + band / 2) * Math.cos(at);
    out.push({ u0: u - along, u1: u + along, y0: y - band / 2, y1: y + band / 2, v0: va, v1: vb, ...(at ? { tilt: -at } : {}), ...(depth !== undefined ? { depth } : {}), ...surface });
  };
  for (let i = 0; i < a.count; i++) {
    const at = -sweep + (i + 0.5) * step;
    const key = a.count % 2 === 1 && i === (a.count - 1) / 2;
    const band = a.band + (key ? (a.key ?? 0) : 0);
    const d = key ? depth + (a.keyDepth ?? 0.04) : depth;
    piece(at, r, halfLen - ARCH_JOINT / 2, band, outward ? v0 - d : v0, outward ? v0 : v0 + d, outward ? undefined : d);
    if (soffit > 0) piece(at, r, halfLen, ARCH_SOFFIT, 0, soffit);
  }
  return out;
}

/** How edgeTrimBoxes dresses a side beyond the style itself. */
export interface EdgeTrimOptions {
  /** The thickness of a piece that gives none (edgeSegments' `wall`): a free block's doorway is as thick as the block. */
  wall?: number;
  /** No baseboards or cornices (a doorway cut in a free block: the block has neither). */
  bare?: boolean;
  /** Door frames marked `outside` dress the outer face too (with `outer`); false where a facade frames the openings. */
  frames?: boolean;
}

/**
 * Every trim box of an edge style on one side (map/geometry.ts draws them; they never collide): the pieces on the
 * wall's inner face, standing off it from `from` (the style's trimFrom, else its thickest piece's thickness); an arch's soffit
 * through the wall; and with `outer`, the pieces marked `outside` once more on the wall's outer face (the cell's
 * boundary), for a side nothing is built beyond.
 */
export function edgeTrimBoxes(style: ResolvedEdge, half: number, height: number, outer = false, sash: 'all' | 'only' | 'without' = 'all', opts: EdgeTrimOptions = {}): SideTrim[] {
  const shape = shapeOf(style);
  const wall = opts.wall ?? WALL_THICKNESS;
  // The wall's own face: a style with thicker piers (the Grand arch's 0.8 m, the Gate arch's 1.2 m) dresses that face,
  // not one buried inside it, and its arch's soffit runs through the whole thickness (owner, 2026-11-16: the Grand
  // arch's curve showed as a coarse staircase of its collision steps).
  const thickest = Math.max(wall, ...(shape?.segments ?? []).map((g) => g.t ?? wall));
  const from = shape?.trimFrom ?? thickest;
  const out: SideTrim[] = [];
  const own = (p: { surface?: { material: string; tint?: string } }) => (p.surface ? { surface: { material: p.surface.material, tint: p.surface.tint ?? null } } : {});
  const at = (u0: number, u1: number, y0: number, y1: number, depth: number, surface: Pick<SideTrim, 'surface'> = {}) => out.push({ u0, u1, y0, y1, v0: from, v1: from + depth, depth, ...surface });
  const v = (x: EdgeValue) => edgeValue(x, half, height);
  for (const p of shape?.trim ?? []) {
    // `sash`: the pieces set in the wall by the glass (`v`: a sash's inner frame, meeting rail and centre bars), which
    // a glazed window's pane carries (sim/glass.ts windowPanes): only those, or all but those (map/geometry.ts).
    if (sash === 'only' && !('v' in p)) continue;
    if ('base' in p) {
      if (!opts.bare) at(v(p.base[0]), v(p.base[1]), 0, 0.16, 0.04);
    } else if ('cornice' in p) {
      if (height >= 3 && !opts.bare) at(v(p.cornice[0]), v(p.cornice[1]), height - 0.2, height, 0.07);
    } else if ('frame' in p) {
      const { half: d, top: h } = p.frame;
      if (height > h + 0.2) {
        const pieces: [number, number, number, number][] = [[-d - 0.16, -d, 0, h], [d, d + 0.16, 0, h], [-d - 0.16, d + 0.16, h, h + 0.16]];
        for (const [u0, u1, y0, y1] of pieces) at(u0, u1, y0, y1, 0.06, own(p));
        // The same frame on the outer face (doors that fit themselves: framed inside and out).
        if (outer && p.outside && opts.frames !== false) for (const [u0, u1, y0, y1] of pieces) out.push({ u0, u1, y0, y1, v0: -0.06, v1: 0, ...own(p) });
      }
    } else if ('window' in p) {
      const [u0, u1] = p.window.u;
      const [y0, y1] = p.window.y;
      at(u0 - 0.08, u1 + 0.08, y0 - 0.08, y0, 0.12);
      at(u0 - 0.1, u1 + 0.1, y1, y1 + 0.12, 0.05);
      at(u0 - 0.1, u0, y0, y1, 0.05);
      at(u1, u1 + 0.1, y0, y1, 0.05);
    } else if ('arch' in p) {
      out.push(...archTrim(p.arch, from, false, Math.min(from, thickest), own(p)));
      if (outer && p.outside) out.push(...archTrim(p.arch, 0, true, 0, own(p)));
    } else if ('v' in p) {
      // Set in the wall itself (a sash's bars by the glass): no face to stand off, so no `depth`.
      if (sash !== 'without') out.push({ u0: v(p.u[0]), u1: v(p.u[1]), y0: v(p.y[0]), y1: v(p.y[1]), v0: p.v[0], v1: p.v[1], ...own(p) });
    } else {
      const pieces: [number, number][] = [];
      if (p.repeat) {
        const [o0, o1] = p.u as readonly [number, number];
        repeatAlong(p.repeat, half, height, (u) => pieces.push([u + o0, u + o1]));
      } else pieces.push([v(p.u[0]), v(p.u[1])]);
      for (const [u0, u1] of pieces) {
        at(u0, u1, v(p.y[0]), v(p.y[1]), p.depth, own(p));
        if (outer && p.outside) out.push({ u0, u1, y0: v(p.y[0]), y1: v(p.y[1]), v0: -p.depth, v1: 0, ...own(p) });
      }
    }
  }
  return out;
}
