import { boxQuat, quatRotate, type BoxKind, type Rot, type WorldBox } from './geometry.ts';

/**
 * Drawn faces of the level's boxes, worked out once at build time so no two faces ever share a
 * plane on screen (z-fighting: the texture flicker the owner saw at grazing angles and range).
 *
 * Boxes that share a rotation (every axis-aligned box, every box turned by the same yaw, every
 * box tilted the same way) are compared in that rotation's frame, where they are all
 * axis-aligned. For each face, the parts that cannot be seen or would fight are cut away:
 * - inside another box (a wall running through the floor slab above it);
 * - against another box's face, back to back (a wall standing on a floor, two halves of a
 *   shared wall, trim against its wall): neither is ever seen;
 * - in the same plane as another box's face, facing the same way (floors over floors, wall-run
 *   ends at corners, trim and facades flush with walls, pack pieces over core pieces): only one
 *   draws, by a fixed priority (`outranks`).
 * Boxes wholly inside another (the shared wall of two neighbouring rooms) draw nothing.
 *
 * Rendering only: physics, navigation and every other user of the boxes is untouched.
 */

type Vec3 = [number, number, number];

/** One face (or the part of a face) to draw. */
export interface RenderFace {
  /** Index of the box in the list given. */
  box: number;
  /** Corners in world space, clockwise seen from outside (Babylon's front face). */
  corners: Vec3[];
  /** Outward normal in world space. */
  normal: Vec3;
  /** The same corners before the box's turn and tilt: texture coordinates are laid out on these. */
  flat: Vec3[];
  /** The normal before the turn (always along an axis). */
  flatNormal: Vec3;
}

/** One place where two boxes' faces lie in the same plane, facing the same way, and overlap. */
export interface CoplanarOverlap {
  /** The two boxes (indices into the list given). */
  a: number;
  b: number;
  /** Overlapping area, m². */
  area: number;
  /** Middle of the overlap, world space. */
  center: Vec3;
  /** The overlap's four corners, world space (for an overlay). */
  corners: Vec3[];
  /** The way both faces face, world space. */
  normal: Vec3;
}

const EPS = 1e-4;
/**
 * How far a cut face still reaches under the face that won (0.5 mm): far below a pixel beyond arm's
 * length, so the sliver where both draw never shows, but it covers the joins. Overlaps thinner
 * than SLIVER are not counted as coplanar overlaps.
 */
const SEAM = 5e-4;
export const SLIVER = 1e-3;
const QUARTER = Math.PI / 2;

/** Rendered as level geometry (props draw their model, barriers are invisible). */
export const isDrawnBox = (b: Pick<WorldBox, 'kind'>): boolean => b.kind !== 'prop' && b.kind !== 'barrier';

/**
 * Which box's face draws where two faces share a plane and facing. Tops: floors (and free blocks)
 * over pack and tile solids over walls over trim, so a floor always shows over the wall tops
 * under it. Everything else: trim (frames, cornices, facades) over solids over walls over
 * floors, so dressing shows over what it dresses. Then a box with its own material (style pack
 * pieces, painted blocks) over one in the theme's, then the later box (placed on top).
 */
const TOP_RANK: Record<BoxKind, number> = { floor: 4, solid: 3, wall: 2, trim: 1, prop: 0, barrier: 0 };
const SIDE_RANK: Record<BoxKind, number> = { trim: 4, solid: 3, wall: 2, floor: 1, prop: 0, barrier: 0 };

export function outranks(boxes: readonly WorldBox[], b: number, a: number, top: boolean): boolean {
  const rank = top ? TOP_RANK : SIDE_RANK;
  const rb = rank[boxes[b]!.kind];
  const ra = rank[boxes[a]!.kind];
  if (rb !== ra) return rb > ra;
  const sb = boxes[b]!.surface ? 1 : 0;
  const sa = boxes[a]!.surface ? 1 : 0;
  if (sb !== sa) return sb > sa;
  return b > a;
}

/** The six faces of an axis-aligned box: corners (clockwise from outside) and outward normal, in the order +x, -x, +y, -y, +z, -z. */
export function axisFaces(min: readonly number[], max: readonly number[]): [Vec3[], Vec3][] {
  const [x0, y0, z0] = min as Vec3;
  const [x1, y1, z1] = max as Vec3;
  return [
    [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
    [[[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]],
    [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]],
    [[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]],
    [[[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]],
    [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]],
  ];
}

const conj = (q: Rot): Rot => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const rot = (q: Rot, p: readonly number[]): Vec3 => quatRotate(q, p[0]!, p[1]!, p[2]!);
const centre = (b: WorldBox): Vec3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const isIdentity = (q: Rot): boolean => q.x === 0 && q.y === 0 && q.z === 0;

/** A box in its group's frame. */
interface FrameBox {
  i: number;
  min: Vec3;
  max: Vec3;
}

interface Group {
  /** The frame's rotation (world = q · frame). */
  q: Rot;
  members: FrameBox[];
}

/** Split the drawn boxes into groups sharing a frame, each box as an axis-aligned box in its frame. */
function frameGroups(boxes: readonly WorldBox[], drawn: (b: WorldBox) => boolean): Group[] {
  const groups = new Map<string, Group>();
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    if (!drawn(b)) continue;
    let key: string;
    let q: Rot;
    let swap = false;
    if (b.pitch || b.roll) {
      // Tilted: only boxes turned and tilted exactly the same way share a frame.
      key = `t${Math.round((b.yaw ?? 0) * 1e6)},${Math.round(b.pitch! * 1e6 || 0)},${Math.round(b.roll! * 1e6 || 0)}`;
      q = boxQuat(b.yaw, b.pitch, b.roll);
    } else {
      // Turned: a quarter turn more or less is the same frame with x and z swapped.
      const yaw = b.yaw ?? 0;
      let t = ((yaw % QUARTER) + QUARTER) % QUARTER;
      if (t < 1e-7 || QUARTER - t < 1e-7) t = 0;
      const k = (((Math.round((yaw - t) / QUARTER) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
      swap = k % 2 === 1;
      key = `y${Math.round(t * 1e6)}`;
      q = boxQuat(t);
    }
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { q, members: [] }));
    const c = centre(b);
    const fc = isIdentity(g.q) ? c : rot(conj(g.q), c);
    const h: Vec3 = [(b.max[0] - b.min[0]) / 2, (b.max[1] - b.min[1]) / 2, (b.max[2] - b.min[2]) / 2];
    if (swap) [h[0], h[2]] = [h[2], h[0]];
    // Unturned boxes keep their exact numbers (no rounding through the centre).
    const exact = !b.yaw && !b.pitch && !b.roll;
    g.members.push({ i, min: exact ? [...b.min] : [fc[0] - h[0], fc[1] - h[1], fc[2] - h[2]], max: exact ? [...b.max] : [fc[0] + h[0], fc[1] + h[1], fc[2] + h[2]] });
  }
  return [...groups.values()];
}

/** Boxes of one frame bucketed on a grid over x and z, to find neighbours quickly. */
class Grid {
  private readonly cells = new Map<number, number[]>();
  private readonly big: number[] = [];
  private readonly seen: Int32Array;
  private stamp = 0;
  private static readonly SIZE = 8;

  constructor(private readonly members: readonly FrameBox[]) {
    this.seen = new Int32Array(members.length);
    members.forEach((m, j) => {
      const [x0, x1, z0, z1] = this.range(m.min, m.max);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 1024) this.big.push(j);
      else for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.bucket(x, z).push(j);
    });
  }

  private range(min: readonly number[], max: readonly number[]): [number, number, number, number] {
    const s = Grid.SIZE;
    return [Math.floor((min[0]! - EPS) / s), Math.floor((max[0]! + EPS) / s), Math.floor((min[2]! - EPS) / s), Math.floor((max[2]! + EPS) / s)];
  }

  private bucket(x: number, z: number): number[] {
    const key = (x + 32768) * 65536 + (z + 32768);
    let list = this.cells.get(key);
    if (!list) this.cells.set(key, (list = []));
    return list;
  }

  /** Members whose x/z extent touches the given box's (each once). */
  near(min: readonly number[], max: readonly number[], visit: (j: number) => void): void {
    this.stamp++;
    const [x0, x1, z0, z1] = this.range(min, max);
    const go = (j: number) => {
      if (this.seen[j] === this.stamp) return;
      this.seen[j] = this.stamp;
      visit(j);
    };
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096) {
      for (let j = 0; j < this.members.length; j++) go(j);
      return;
    }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const j of this.cells.get((x + 32768) * 65536 + (z + 32768)) ?? []) go(j);
    for (const j of this.big) go(j);
  }
}

/** A rectangle on a face: [u0, v0, u1, v1] over the face's two in-plane axes. */
type Rect = [number, number, number, number];

/** `rects` minus `cut`, as rectangles (each piece cut into at most four). */
function subtract(rects: Rect[], cut: Rect): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    if (cut[0] >= r[2] - EPS || cut[2] <= r[0] + EPS || cut[1] >= r[3] - EPS || cut[3] <= r[1] + EPS) {
      out.push(r);
      continue;
    }
    // Slivers thinner than EPS are dropped, and the pieces then reach the edge they would have left.
    const v0 = cut[1] - r[1] > EPS ? cut[1] : r[1];
    const v1 = r[3] - cut[3] > EPS ? cut[3] : r[3];
    if (v0 > r[1]) out.push([r[0], r[1], r[2], v0]);
    if (v1 < r[3]) out.push([r[0], v1, r[2], r[3]]);
    if (cut[0] - r[0] > EPS) out.push([r[0], v0, cut[0], v1]);
    if (r[2] - cut[2] > EPS) out.push([cut[2], v0, r[2], v1]);
  }
  return out;
}

/** Join pieces that share a whole edge back into one (cutting leaves a face in more pieces than it needs). */
function merge(rects: Rect[]): Rect[] {
  if (rects.length < 2) return rects;
  const same = (a: number, b: number) => Math.abs(a - b) <= EPS;
  let joined = true;
  while (joined) {
    joined = false;
    for (let a = 0; a < rects.length && !joined; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        const p = rects[a]!;
        const q = rects[b]!;
        let r: Rect | null = null;
        if (same(p[1], q[1]) && same(p[3], q[3]) && (same(p[2], q[0]) || same(q[2], p[0]))) r = [Math.min(p[0], q[0]), p[1], Math.max(p[2], q[2]), p[3]];
        else if (same(p[0], q[0]) && same(p[2], q[2]) && (same(p[3], q[1]) || same(q[3], p[1]))) r = [p[0], Math.min(p[1], q[1]), p[2], Math.max(p[3], q[3])];
        if (r) {
          rects[a] = r;
          rects.splice(b, 1);
          joined = true;
          break;
        }
      }
    }
  }
  return rects;
}

/** The in-plane axes of a face along `axis`. */
const PLANE_AXES: Record<number, [number, number]> = { 0: [1, 2], 1: [0, 2], 2: [0, 1] };

const solid = (m: FrameBox): boolean => m.max[0] - m.min[0] > EPS && m.max[1] - m.min[1] > EPS && m.max[2] - m.min[2] > EPS;

/** Boxes of a group lying wholly inside another (of exact duplicates, the first is kept). */
function containedIn(g: Group, grid: Grid): Set<number> {
  const out = new Set<number>();
  const inside = (p: FrameBox, q: FrameBox) => p.min.every((v, k) => v >= q.min[k]! - EPS) && p.max.every((v, k) => v <= q.max[k]! + EPS);
  g.members.forEach((m, a) => {
    grid.near(m.min, m.max, (b) => {
      if (b <= a) return;
      const o = g.members[b]!;
      if (inside(o, m) && !out.has(a)) out.add(b);
      else if (inside(m, o) && !out.has(b)) out.add(a);
    });
  });
  return out;
}

interface Fragment {
  /** Member index in the group. */
  m: number;
  face: number;
  plane: number;
  rect: Rect;
}

/** The parts of every face of a group that draw. `draw`: which members' faces are wanted (all of them occlude). */
function clipGroup(boxes: readonly WorldBox[], g: Group, draw: (i: number) => boolean): Fragment[] {
  const grid = new Grid(g.members);
  const gone = containedIn(g, grid);
  const out: Fragment[] = [];
  g.members.forEach((m, a) => {
    if (gone.has(a) || !draw(m.i)) return;
    for (let face = 0; face < 6; face++) {
      const axis = face >> 1;
      const up = face & 1 ? -1 : 1;
      const plane = up > 0 ? m.max[axis]! : m.min[axis]!;
      const [ua, va] = PLANE_AXES[axis]!;
      const rect: Rect = [m.min[ua]!, m.min[va]!, m.max[ua]!, m.max[va]!];
      if (rect[2] - rect[0] <= EPS || rect[3] - rect[1] <= EPS) continue;
      let rects: Rect[] = [rect];
      // Probe only the face's own slab, so far-off boxes in the same grid cell are skipped early.
      const lo: Vec3 = [m.min[0], m.min[1], m.min[2]];
      const hi: Vec3 = [m.max[0], m.max[1], m.max[2]];
      lo[axis] = hi[axis] = plane;
      grid.near(lo, hi, (b) => {
        if (b === a || gone.has(b) || !rects.length) return;
        const o = g.members[b]!;
        if (!solid(o)) return;
        const lo2 = o.min[axis]!;
        const hi2 = o.max[axis]!;
        if (plane < lo2 - EPS || plane > hi2 + EPS) return;
        const cut: Rect = [Math.max(rect[0], o.min[ua]!), Math.max(rect[1], o.min[va]!), Math.min(rect[2], o.max[ua]!), Math.min(rect[3], o.max[va]!)];
        if (cut[2] - cut[0] <= EPS || cut[3] - cut[1] <= EPS) return;
        const inside = plane > lo2 + EPS && plane < hi2 - EPS;
        const same = Math.abs(plane - (up > 0 ? hi2 : lo2)) <= EPS;
        // Inside the other box, or back to back with its face (both hidden), or the same plane and facing where it outranks this.
        if (!(inside || !same || outranks(boxes, o.i, m.i, face === 2))) return;
        // Where the cut's edge runs across this face, stop SEAM short of it: this face then reaches just under
        // the other one's edge, so no pixel crack opens along the join (pieces meet in T-junctions there).
        if (cut[0] > rect[0] + EPS) cut[0] += SEAM;
        if (cut[1] > rect[1] + EPS) cut[1] += SEAM;
        if (cut[2] < rect[2] - EPS) cut[2] -= SEAM;
        if (cut[3] < rect[3] - EPS) cut[3] -= SEAM;
        if (cut[2] - cut[0] > EPS && cut[3] - cut[1] > EPS) rects = subtract(rects, cut);
      });
      for (const r of merge(rects)) out.push({ m: a, face, plane, rect: r });
    }
  });
  return out;
}

/** A fragment as the frame-space box it is a face of (the face's own axis spanning the member's). */
function fragmentBox(m: FrameBox, f: Fragment): { min: Vec3; max: Vec3 } {
  const axis = f.face >> 1;
  const [ua, va] = PLANE_AXES[axis]!;
  const min: Vec3 = [...m.min];
  const max: Vec3 = [...m.max];
  min[ua] = f.rect[0];
  min[va] = f.rect[1];
  max[ua] = f.rect[2];
  max[va] = f.rect[3];
  return { min, max };
}

/**
 * The faces to draw for these boxes (props and barriers draw nothing). `draw`, when given, picks
 * the boxes whose faces are wanted; every drawn box still hides and outranks (MapMaker draws one
 * level at a time but the levels still meet).
 */
export function visibleFaces(boxes: readonly WorldBox[], draw: (i: number) => boolean = () => true): RenderFace[] {
  const out: RenderFace[] = [];
  for (const g of frameGroups(boxes, isDrawnBox)) {
    const ident = isIdentity(g.q);
    for (const f of clipGroup(boxes, g, draw)) {
      const m = g.members[f.m]!;
      const b = boxes[m.i]!;
      const fb = fragmentBox(m, f);
      const [corners, n] = axisFaces(fb.min, fb.max)[f.face]!;
      if (ident && !b.yaw && !b.pitch && !b.roll) {
        out.push({ box: m.i, corners, normal: n, flat: corners, flatNormal: n });
        continue;
      }
      // Back to world, and into the box's own unturned frame for the texture.
      const world = ident ? corners : corners.map((p) => rot(g.q, p));
      const normal = ident ? n : rot(g.q, n);
      const own = conj(boxQuat(b.yaw, b.pitch, b.roll));
      const c = centre(b);
      const flat = world.map((p) => {
        const d = rot(own, [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
        return [c[0] + d[0], c[1] + d[1], c[2] + d[2]] as Vec3;
      });
      const fn = rot(own, normal).map((v) => Math.round(v) + 0) as Vec3;
      out.push({ box: m.i, corners: world, normal, flat, flatNormal: fn });
    }
  }
  return out;
}

/**
 * Coplanar overlaps: places where two drawn boxes' faces lie in the same plane, face the same
 * way and overlap (each pair of faces once). With `faces` (from visibleFaces), the overlaps left
 * among those faces instead: what still draws twice. Smaller than `minArea` (m²) is ignored.
 */
export function coplanarOverlaps(boxes: readonly WorldBox[], o: { faces?: readonly RenderFace[]; minArea?: number } = {}): CoplanarOverlap[] {
  const minArea = o.minArea ?? 1e-6;
  const out: CoplanarOverlap[] = [];
  for (const g of frameGroups(boxes, isDrawnBox)) {
    // Every face (or drawn fragment) in this frame, bucketed by facing and plane.
    const planes = new Map<string, { i: number; rect: Rect; face: number; plane: number }[]>();
    const add = (i: number, face: number, plane: number, rect: Rect) => {
      const key = `${face}:${Math.round(plane / EPS)}`;
      let list = planes.get(key);
      if (!list) planes.set(key, (list = []));
      // Neighbouring buckets catch planes that straddle a rounding edge.
      list.push({ i, rect, face, plane });
    };
    if (o.faces) {
      const inGroup = new Map(g.members.map((m) => [m.i, m]));
      const qi = conj(g.q);
      const ident = isIdentity(g.q);
      for (const f of o.faces) {
        if (!inGroup.has(f.box)) continue;
        const cs = ident ? f.corners : f.corners.map((p) => rot(qi, p));
        const n = (ident ? f.normal : rot(qi, f.normal)).map((v) => Math.round(v));
        const axis = n[0] ? 0 : n[1] ? 1 : 2;
        const face = axis * 2 + (n[axis]! > 0 ? 0 : 1);
        const [ua, va] = PLANE_AXES[axis]!;
        const us = cs.map((p) => p[ua]!);
        const vs = cs.map((p) => p[va]!);
        add(f.box, face, cs[0]![axis]!, [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)]);
      }
    } else {
      for (const m of g.members) {
        for (let face = 0; face < 6; face++) {
          const axis = face >> 1;
          const [ua, va] = PLANE_AXES[axis]!;
          add(m.i, face, face & 1 ? m.min[axis]! : m.max[axis]!, [m.min[ua]!, m.min[va]!, m.max[ua]!, m.max[va]!]);
        }
      }
    }
    for (const [key, list] of planes) {
      const [faceS, planeS] = key.split(':');
      const face = Number(faceS);
      const neighbour = planes.get(`${face}:${Number(planeS) + 1}`) ?? [];
      const axis = face >> 1;
      const [ua, va] = PLANE_AXES[axis]!;
      const check = (p: (typeof list)[number], q: (typeof list)[number]) => {
        if (p.i === q.i || Math.abs(p.plane - q.plane) > EPS) return;
        const r: Rect = [Math.max(p.rect[0], q.rect[0]), Math.max(p.rect[1], q.rect[1]), Math.min(p.rect[2], q.rect[2]), Math.min(p.rect[3], q.rect[3])];
        const w = r[2] - r[0];
        const h = r[3] - r[1];
        if (w <= SLIVER || h <= SLIVER || w * h < minArea) return;
        const lo: Vec3 = [0, 0, 0];
        const hi: Vec3 = [0, 0, 0];
        lo[axis] = hi[axis] = p.plane;
        lo[ua] = r[0];
        lo[va] = r[1];
        hi[ua] = r[2];
        hi[va] = r[3];
        const [cs, n] = axisFaces(lo, hi)[face]!;
        const world = isIdentity(g.q) ? cs : cs.map((c) => rot(g.q, c));
        const mid: Vec3 = [0, 1, 2].map((k) => world.reduce((s, c) => s + c[k]!, 0) / 4) as Vec3;
        out.push({ a: Math.min(p.i, q.i), b: Math.max(p.i, q.i), area: w * h, center: mid, corners: world, normal: isIdentity(g.q) ? n : rot(g.q, n) });
      };
      // Sweep along u so only faces overlapping in u are compared.
      const sorted = [...list].sort((x, y) => x.rect[0] - y.rect[0]);
      for (let x = 0; x < sorted.length; x++) {
        for (let y = x + 1; y < sorted.length; y++) {
          if (sorted[y]!.rect[0] >= sorted[x]!.rect[2] - EPS) break;
          check(sorted[x]!, sorted[y]!);
        }
      }
      for (const p of list) for (const q of neighbour) check(p, q);
    }
  }
  return out;
}
