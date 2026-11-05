import { getProp } from '../content/props.ts';
import { isEnvModel } from '../content/environment.ts';
import { SLIVER, planeGeometry, type RenderFace } from './faces.ts';
import type { WorldBox } from './geometry.ts';
import type { MapDocument, PropEntity } from './schema.ts';
import { hungPropLift, propTilts } from './settle.ts';

/**
 * Props and z-fighting (docs/LOOK.md, "No flicker: props"). A prop's model often has flat faces in the planes of its
 * bounding box: a rug's cloth lying on its base, the bottom board of open shelving, a crate's base, a cabinet's back.
 * Placed flush on a floor, against a wall or on another prop, such a face shares a plane with the face under it; where
 * both can be seen from the same side they fight (the texture flicker), at any range on a phone's depth buffer and at a
 * distance on any.
 *
 * - Props against the level: the level is drawn a hair behind everything placed on it (LEVEL_DEPTH_BIAS, a depth
 *   bias on the level's materials in the client), so a prop's face in the plane of a floor or wall always wins.
 * - Props against props: the later prop of a flush pair is drawn moved FLUSH_LIFT away from the other
 *   (`propFlushLifts`, drawn only: collision, the map and the server never see it).
 *
 * Contact faces come from the built models (tools/content/prop-contacts.mjs, PROP_CONTACTS): loaded on demand
 * (`@tiletrigger/shared/propContacts`), so these take the table as an argument.
 */

type Vec3 = [number, number, number];

/**
 * A prop's flat faces in one plane of its bounding box: [axis (0 x, 1 y, 2 z), side (-1 the box's min plane, 1 its
 * max), facing (1 the faces face +axis, -1 face -axis, 0 both: a double-sided material), area (m²), then their bounds
 * x0, y0, z0, x1, y1, z1] in the prop's own space as drawn (metres at scale 1).
 */
export type PropContact = readonly [axis: number, side: number, facing: number, area: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number];
export type PropContactTable = Readonly<Record<string, readonly PropContact[]>>;

/**
 * The level's depth bias (the client's level materials: polygon offset factor and units, Babylon's zOffset and
 * zOffsetUnits): it is drawn this much behind what lies in its planes. Depth-buffer steps, so it holds at any range
 * and on any depth buffer (a phone's 16-bit one too); a slope factor of 1 is about one pixel's depth at a grazing
 * angle, far too little to show anything through a wall.
 */
export const LEVEL_DEPTH_BIAS = { factor: 1, units: 2 } as const;
/** A prop's face this close to another's plane (m) counts as in it: it would fight on a phone's depth buffer at a few metres. */
export const PROP_FLUSH = 0.002;
/**
 * How far the later prop of a flush pair is drawn moved apart (m): two depth steps of a desktop GPU's 24-bit depth
 * buffer at 80 m (docs/LOOK.md, "Depth buffer"), and far too little to see.
 */
export const FLUSH_LIFT = 0.004;
/** Overlaps smaller than this (m²) are specks: not counted. */
const MIN_AREA = 1e-4;

/** A prop's contact faces placed in the world: a rectangle in a plane, and which way its faces face. */
export interface PropPatch {
  /** Index of the prop in map.entities. */
  entity: number;
  id: string;
  /** The model's +axis in the world (unit). */
  axis: Vec3;
  /** The patch's outward normal: the side of the prop it is on (`axis` times its side). */
  out: Vec3;
  /** 1: its faces face `axis`; -1: they face away from it; 0: both. */
  facing: number;
  corners: Vec3[];
}

/** One place where a prop's faces share a plane with the level's or another prop's, both seen from the same side. */
export interface PropOverlap {
  /** The prop (entity id). */
  a: string;
  /** The other prop (entity id), or the level box (index into the boxes given). */
  b: string | number;
  area: number;
  center: Vec3;
  /** The side both are seen from. */
  normal: Vec3;
  /** Between props: the outward normals of the two props' faces there (a's, b's). */
  outs?: [Vec3, Vec3];
}

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** Whether a patch's faces can be seen from direction `n` (a unit normal along its axis). */
const seenFrom = (p: PropPatch, n: readonly number[]) => p.facing === 0 || dot(p.axis, n) * p.facing > 0.5;

/** Props drawn where they stand: not riding a mover, not leaning with terrain, not drawn by the environment renderer. */
function steadyProps(map: MapDocument): { e: PropEntity; i: number }[] {
  const carried = new Set(map.entities.flatMap((e) => (e.kind === 'mover' ? (e.props ?? []) : [])));
  const out: { e: PropEntity; i: number }[] = [];
  map.entities.forEach((e, i) => {
    if (e.kind !== 'prop' || carried.has(e.id) || isEnvModel(e.model)) return;
    if (map.terrain && propTilts(e.model)) return;
    out.push({ e, i });
  });
  return out;
}

/**
 * The contact faces of the map's props where the game draws them (hung props raised to their ceiling, plus `lifts`
 * by entity id). Props without contact faces, riding movers or leaning on terrain are left out.
 */
export function propPatches(map: MapDocument, table: PropContactTable, boxes: readonly WorldBox[], lifts: ReadonlyMap<string, Vec3> = new Map()): PropPatch[] {
  const out: PropPatch[] = [];
  for (const { e, i } of steadyProps(map)) {
    const groups = table[e.model];
    if (!groups?.length || !getProp(e.model)) continue;
    const c = Math.cos(e.yaw);
    const s = Math.sin(e.yaw);
    const lift = lifts.get(e.id) ?? [0, 0, 0];
    const pos: Vec3 = [e.position[0] + lift[0], e.position[1] + hungPropLift(boxes, e) + lift[1], e.position[2] + lift[2]];
    // Model space to world: scale, turn about y (local +Z goes to (sin, cos)), move.
    const world = (p: readonly number[]): Vec3 => {
      const x = p[0]! * e.scale;
      const z = p[2]! * e.scale;
      return [pos[0] + x * c + z * s, pos[1] + p[1]! * e.scale, pos[2] - x * s + z * c];
    };
    const dir = (k: number): Vec3 => (k === 1 ? [0, 1, 0] : k === 0 ? [c, 0, -s] : [s, 0, c]);
    for (const g of groups) {
      const [k, side, facing, , x0, y0, z0, x1, y1, z1] = g;
      const lo = [x0, y0, z0];
      const hi = [x1, y1, z1];
      const [u, v] = k === 0 ? [1, 2] : k === 1 ? [0, 2] : [0, 1];
      const corner = (a: number[], b: number[], ua: boolean, vb: boolean) => {
        const p = [...a];
        p[u] = ua ? b[u]! : a[u]!;
        p[v] = vb ? b[v]! : a[v]!;
        return world(p);
      };
      const axis = dir(k);
      out.push({ entity: i, id: e.id, axis, out: [axis[0] * side, axis[1] * side, axis[2] * side], facing, corners: [corner(lo, hi, false, false), corner(lo, hi, true, false), corner(lo, hi, true, true), corner(lo, hi, false, true)] });
    }
  }
  return out;
}

/** A plane bucket for one normal direction (either sign) and offset. */
function bucketKey(n: readonly number[], d: number, shift = 0): string {
  // One key for a normal and its opposite: faces on either side of a plane meet in it.
  const flip = n[0]! < -1e-9 || (Math.abs(n[0]!) <= 1e-9 && (n[1]! < -1e-9 || (Math.abs(n[1]!) <= 1e-9 && n[2]! < 0)));
  const m = flip ? n.map((x) => -x) : n;
  const dd = flip ? -d : d;
  return `${Math.round(m[0]! * 1e4)},${Math.round(m[1]! * 1e4)},${Math.round(m[2]! * 1e4)}:${Math.round(dd / PROP_FLUSH) + shift}`;
}

interface Item {
  poly3: Vec3[];
  n: Vec3;
  d: number;
  /** World bounds (min x, y, z, max x, y, z): a quick test before the polygons are cut. */
  bb: number[];
}

const boundsOf = (pts: readonly (readonly number[])[]): number[] => {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) {
    b[k] = Math.min(b[k]!, p[k]!);
    b[k + 3] = Math.max(b[k + 3]!, p[k]!);
  }
  return b;
};
const apart = (a: readonly number[], b: readonly number[]) => [0, 1, 2].some((k) => a[k]! > b[k + 3]! + PROP_FLUSH || b[k]! > a[k + 3]! + PROP_FLUSH);

/** Overlap of two convex polygons near one plane (normal `n` through `at`): area and middle, or null when less than a speck. */
function overlap(n: Vec3, at: readonly number[], a: readonly Vec3[], b: readonly Vec3[]): { area: number; center: Vec3 } | null {
  const { planeOf, to2, to3, intersect, area2, width } = planeGeometry;
  const pl = planeOf(n, at);
  const hit = intersect(a.map((p) => to2(pl, p)), b.map((p) => to2(pl, p)));
  if (hit.length < 3) return null;
  const area = Math.abs(area2(hit));
  if (area < MIN_AREA || width(hit) <= SLIVER) return null;
  const corners = hit.map((q) => to3(pl, q));
  return { area, center: [0, 1, 2].map((k) => corners.reduce((s, q) => s + q[k]!, 0) / corners.length) as Vec3 };
}

/**
 * Coplanar overlaps between the props and the level (`faces`: what visibleFaces draws of `boxes`) and between props:
 * a prop's contact faces in the plane of a level face (within PROP_FLUSH) and seen from that face's side, or two props'
 * contact faces in one plane both seen from one side. The level ones are drawn right by the level's depth bias; the
 * prop ones by `propFlushLifts`.
 */
export function propCoplanar(map: MapDocument, table: PropContactTable, boxes: readonly WorldBox[], faces: readonly RenderFace[], lifts: ReadonlyMap<string, Vec3> = new Map()): { level: PropOverlap[]; props: PropOverlap[] } {
  const patches = propPatches(map, table, boxes, lifts);
  const byPlane = new Map<string, { p: PropPatch; it: Item }[]>();
  for (const p of patches) {
    const it: Item = { poly3: p.corners, n: p.axis, d: dot(p.axis, p.corners[0]!), bb: boundsOf(p.corners) };
    const key = bucketKey(p.axis, it.d);
    let l = byPlane.get(key);
    if (!l) byPlane.set(key, (l = []));
    l.push({ p, it });
  }
  const near = (n: readonly number[], d: number) => [-1, 0, 1].flatMap((s) => byPlane.get(bucketKey(n, d, s)) ?? []);
  const level: PropOverlap[] = [];
  for (const f of faces) {
    const n = f.normal;
    const d = dot(n, f.corners[0]!);
    const candidates = near(n, d);
    if (!candidates.length) continue;
    const fb = boundsOf(f.corners);
    for (const { p, it } of candidates) {
      if (apart(fb, it.bb)) continue;
      const along = dot(p.axis, n);
      if (Math.abs(Math.abs(along) - 1) > 1e-6 || Math.abs(it.d * Math.sign(along) - d) > PROP_FLUSH || !seenFrom(p, n)) continue;
      const o = overlap(n, f.corners[0]!, f.corners, p.corners);
      if (o) level.push({ a: p.id, b: f.box, ...o, normal: n });
    }
  }
  const props: PropOverlap[] = [];
  const seen = new Set<string>();
  const pair = (x: { p: PropPatch; it: Item }, y: { p: PropPatch; it: Item }) => {
    const [{ p, it }, { p: q, it: jt }] = x.p.entity < y.p.entity ? [x, y] : [y, x];
    if (q.entity === p.entity || apart(it.bb, jt.bb)) return;
    const along = dot(p.axis, q.axis);
    if (Math.abs(Math.abs(along) - 1) > 1e-6 || Math.abs(jt.d * Math.sign(along) - it.d) > PROP_FLUSH) return;
    const n = [p.axis, p.axis.map((v) => -v) as Vec3].find((m) => seenFrom(p, m) && seenFrom(q, m));
    if (!n) return;
    const o = overlap(n, p.corners[0]!, p.corners, q.corners);
    if (!o) return;
    const key = `${p.id}|${q.id}|${n.join(',')}|${o.center.map((v) => v.toFixed(3)).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    props.push({ a: p.id, b: q.id, ...o, normal: n, outs: [p.out, q.out] });
  };
  for (const [key, own] of byPlane) {
    // This plane's patches and the next bucket's (planes straddling a rounding edge), swept along x.
    const [nk, dk] = key.split(':');
    const list = [...own, ...(byPlane.get(`${nk}:${Number(dk) + 1}`) ?? [])].sort((a, b) => a.it.bb[0]! - b.it.bb[0]!);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[j]!.it.bb[0]! > list[i]!.it.bb[3]! + PROP_FLUSH) break;
        pair(list[i]!, list[j]!);
      }
    }
  }
  return { level, props };
}

/**
 * How far each prop is drawn moved so that no two props' contact faces fight (entity id → offset). Props are taken in
 * map order; each one flush with props before it moves FLUSH_LIFT (or a few times that, past a neighbour that moved)
 * along the shared plane's normal, away from the other: a prop on a crate is drawn a hair higher, one of two
 * overlapping pieces (rail lengths laid end over end) a hair lower. A pair flush on several planes (one prop inside
 * another) gets a step on each axis, one a round. Run at load (the game and MapMaker views), drawn only.
 */
export function propFlushLifts(map: MapDocument, table: PropContactTable, boxes: readonly WorldBox[]): Map<string, Vec3> {
  const lifts = new Map<string, Vec3>();
  const index = new Map(map.entities.map((e, i) => [e.id, i]));
  const off = (id: string): Vec3 => lifts.get(id) ?? [0, 0, 0];
  for (let round = 0; round < 3; round++) {
    const { props } = propCoplanar(map, table, boxes, [], lifts);
    if (!props.length) break;
    // Each pair once, as (earlier, later), with the way the later one moves off the earlier.
    const pairs = new Map<string, { earlier: string; n: Vec3; away: Vec3 }[]>();
    for (const o of props) {
      const b = o.b as string;
      const aFirst = index.get(o.a)! < index.get(b)!;
      const [earlier, later] = aFirst ? [o.a, b] : [b, o.a];
      // Back into its own body: off a prop it stands on (their faces face each other), or under one it overlaps.
      const away = (aFirst ? o.outs![1] : o.outs![0]).map((x) => -x) as Vec3;
      let l = pairs.get(later);
      if (!l) pairs.set(later, (l = []));
      l.push({ earlier, n: o.normal, away });
    }
    for (const later of [...pairs.keys()].sort((x, y) => index.get(x)! - index.get(y)!)) {
      const list = pairs.get(later)!;
      const dir = list[0]!.away;
      // The pairs along this direction; the rest wait for another round.
      const along = list.filter((p) => Math.abs(Math.abs(dot(p.n, dir)) - 1) < 1e-6);
      const base = off(later);
      const sep = (k: number) => along.every((p) => Math.abs(dot(p.n, [base[0] + dir[0] * k * FLUSH_LIFT - off(p.earlier)[0], base[1] + dir[1] * k * FLUSH_LIFT - off(p.earlier)[1], base[2] + dir[2] * k * FLUSH_LIFT - off(p.earlier)[2]])) > PROP_FLUSH * 1.5);
      const k = [1, 2, 3, 4].find(sep);
      if (k === undefined) continue;
      lifts.set(later, [base[0] + dir[0] * k * FLUSH_LIFT, base[1] + dir[1] * k * FLUSH_LIFT, base[2] + dir[2] * k * FLUSH_LIFT]);
    }
  }
  return lifts;
}
