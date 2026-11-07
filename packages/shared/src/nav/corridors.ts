import { hypot, type Vec3 } from '../math.ts';
import { polyShapes } from './audit.ts';
import type { NavGraph, NavWorld } from './index.ts';

/**
 * Corridors (docs/BOTS.md, "Route variety"; BOT_AI_PLAN.md Phase B item 4): two or three genuinely different ways
 * between two places on a map. Every bot taking the shortest route sends a whole team down one lane (owner,
 * 2026-11-06: "Many maps focus them into one direction or path"); with corridors, a team's groups take different ones.
 *
 * Found on the navmesh's polygon graph (NavWorld.graph, one way links one way), in JS: the shortest, then again with
 * the ground within CORRIDOR_WIDTH of the ones found made costly (×(1 + PENALTY); not near either end, where every
 * way meets), keeping a route only when most of it is away from the others (under MAX_SHARED of it within SAME_WIDTH)
 * and it isn't much longer (MAX_STRETCH × the shortest + EXTRA m). A route is the polygons' shared edges' midpoints,
 * start to goal (inside the polygons it crosses: they are convex), and waypoints along it every SPACING m.
 *
 * Bots walk a corridor by its waypoints, routing from one to the next with Detour (short searches: no cost to the
 * search budget). Worked out at match setup for the mode's common trips (base to flag, spawn to hill...), a few ms
 * each, and kept per navmesh: the next match on the map reuses them. Deterministic: the graph and the two ends decide.
 */
export interface Corridor {
  /** Waypoints, start to goal, about SPACING m apart (on the navmesh). */
  readonly points: readonly Vec3[];
  /** How far along the route each waypoint is (m). */
  readonly pointsAt: readonly number[];
  /** The route itself (shared edges' midpoints), start to goal, a point every LINE_STEP m: to measure who walks it. */
  readonly line: readonly Vec3[];
  readonly lineAt: readonly number[];
  /** Length of the route (m). */
  readonly length: number;
  /** Share of it (between the ends) within SAME_WIDTH of an earlier corridor of the trip (0 for the first). */
  readonly shared: number;
  /**
   * Where it is furthest from the trip's other corridors (between a fifth and four fifths of the way; on the navmesh):
   * going by this one point, a bot's own shortest route there and on to the goal is this corridor's way
   * (BotBrain.viaRoute). Null when the trip has only the one.
   */
  readonly via: Vec3 | null;
  /** How far the via is from the other corridors (m). */
  readonly viaApart: number;
}

/** A trip: from, to, and its corridors (the first the shortest; at least one, or none when no route exists). */
export interface Trip {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly corridors: readonly Corridor[];
}

/** Ground this close (m, across; and within FLOOR up or down) to a corridor found is costly for the next search. */
export const CORRIDOR_WIDTH = 10;
/** A route counts as on an earlier corridor where it is this close to it (m). */
const SAME_WIDTH = 7;
const FLOOR = 3;
/** Cost of costly ground: ×(1 + PENALTY). */
const PENALTY = 4;
/** A corridor shares at most this much of its length (between the ends) with the earlier ones... */
const MAX_SHARED = 0.4;
/** ...and is at most this many times as long as the shortest, plus EXTRA m. */
const MAX_STRETCH = 1.6;
const EXTRA = 30;
/** Within this of either end (m, or END_SHARE of the trip's straight distance if more) every way meets: no penalty there, and it isn't counted as shared. */
const END_ZONE = 14;
const END_SHARE = 0.15;
/** Waypoints this far apart (m), and the route's measuring points. */
export const SPACING = 12;
export const LINE_STEP = 4;
const MAX_CORRIDORS = 3;

/** The polygon graph with costs, per navmesh graph (made once). */
interface Prepared {
  g: NavGraph;
  centre: Float32Array;
  /** Usable (flags not 0: polygons inside something solid are left out). */
  ok: Uint8Array;
  /** A fingerprint of the navmesh (the cache's key). */
  key: string;
}

const prepared = new WeakMap<NavGraph, Prepared>();

function prepare(g: NavGraph): Prepared {
  let p = prepared.get(g);
  if (p) return p;
  const { centre } = polyShapes(g);
  const ok = new Uint8Array(g.count);
  let h = 2166136261;
  for (let i = 0; i < g.count; i++) {
    ok[i] = g.flags[i] !== 0 ? 1 : 0;
    if (i % 7 === 0) {
      h = Math.imul(h ^ Math.round(centre[i * 3]! * 10), 16777619);
      h = Math.imul(h ^ Math.round(centre[i * 3 + 1]! * 10), 16777619);
      h = Math.imul(h ^ Math.round(centre[i * 3 + 2]! * 10), 16777619);
    }
  }
  p = { g, centre, ok, key: `${g.count}:${g.links.length}:${h >>> 0}` };
  prepared.set(g, p);
  return p;
}

/** A binary min-heap of polygon indices by cost (typed arrays, reused). */
class Heap {
  idx: Int32Array;
  key: Float64Array;
  size = 0;
  constructor(n: number) {
    this.idx = new Int32Array(Math.max(16, n));
    this.key = new Float64Array(Math.max(16, n));
  }
  push(i: number, k: number): void {
    if (this.size >= this.idx.length) {
      const idx = new Int32Array(this.idx.length * 2);
      const key = new Float64Array(this.key.length * 2);
      idx.set(this.idx);
      key.set(this.key);
      this.idx = idx;
      this.key = key;
    }
    let c = this.size++;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.key[p]! <= k) break;
      this.idx[c] = this.idx[p]!;
      this.key[c] = this.key[p]!;
      c = p;
    }
    this.idx[c] = i;
    this.key[c] = k;
  }
  pop(): number {
    const top = this.idx[0]!;
    const last = --this.size;
    if (last > 0) {
      const i = this.idx[last]!;
      const k = this.key[last]!;
      let c = 0;
      for (;;) {
        let m = c * 2 + 1;
        if (m >= last) break;
        if (m + 1 < last && this.key[m + 1]! < this.key[m]!) m++;
        if (this.key[m]! >= k) break;
        this.idx[c] = this.idx[m]!;
        this.key[c] = this.key[m]!;
        c = m;
      }
      this.idx[c] = i;
      this.key[c] = k;
    }
    return top;
  }
}

/** A* over the polygon graph from `s` to `t`, each step costing the distance between centres × the entered polygon's `mult`. Polygon indices, or null. */
function search(p: Prepared, s: number, t: number, mult: Float32Array | null): number[] | null {
  const { g, centre, ok } = p;
  const n = g.count;
  const cost = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new Heap(256);
  const tx = centre[t * 3]!;
  const ty = centre[t * 3 + 1]!;
  const tz = centre[t * 3 + 2]!;
  const h = (i: number) => hypot(centre[i * 3]! - tx, centre[i * 3 + 1]! - ty, centre[i * 3 + 2]! - tz);
  cost[s] = 0;
  heap.push(s, h(s));
  while (heap.size) {
    const a = heap.pop();
    if (done[a]) continue;
    done[a] = 1;
    if (a === t) break;
    const ax = centre[a * 3]!;
    const ay = centre[a * 3 + 1]!;
    const az = centre[a * 3 + 2]!;
    for (let k = g.linkStart[a]!; k < g.linkStart[a + 1]!; k++) {
      const b = g.links[k]!;
      if (done[b] || !ok[b]) continue;
      const step = hypot(centre[b * 3]! - ax, centre[b * 3 + 1]! - ay, centre[b * 3 + 2]! - az) * (mult ? mult[b]! : 1);
      const c = cost[a]! + step;
      if (c < cost[b]!) {
        cost[b] = c;
        from[b] = a;
        heap.push(b, c + h(b));
      }
    }
  }
  if (!done[t]) return null;
  const out: number[] = [];
  for (let i = t; i >= 0; i = from[i]!) {
    out.push(i);
    if (i === s) break;
  }
  return out[out.length - 1] === s ? out.reverse() : null;
}

/** The point where polygon path step a → b crosses: their shared edge's midpoint (a link's end when one is a link). */
function crossing(g: NavGraph, a: number, b: number, centre: Float32Array): Vec3 {
  const v = g.vxyz;
  // Off-mesh links are polygons of two corners: start and end.
  if (g.type[b] !== 0) return { x: v[g.vstart[b]! * 3]!, y: v[g.vstart[b]! * 3 + 1]!, z: v[g.vstart[b]! * 3 + 2]! };
  if (g.type[a] !== 0) {
    const e = g.vstart[a]! + 1;
    return { x: v[e * 3]!, y: v[e * 3 + 1]!, z: v[e * 3 + 2]! };
  }
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  for (let i = g.vstart[a]!; i < g.vstart[a + 1]!; i++) {
    for (let j = g.vstart[b]!; j < g.vstart[b + 1]!; j++) {
      if (Math.abs(v[i * 3]! - v[j * 3]!) + Math.abs(v[i * 3 + 1]! - v[j * 3 + 1]!) + Math.abs(v[i * 3 + 2]! - v[j * 3 + 2]!) < 1e-3) {
        sx += v[i * 3]!;
        sy += v[i * 3 + 1]!;
        sz += v[i * 3 + 2]!;
        n++;
      }
    }
  }
  if (n) return { x: sx / n, y: sy / n, z: sz / n };
  // (No shared corner found: the middle between the two centres.)
  return { x: (centre[a * 3]! + centre[b * 3]!) / 2, y: (centre[a * 3 + 1]! + centre[b * 3 + 1]!) / 2, z: (centre[a * 3 + 2]! + centre[b * 3 + 2]!) / 2 };
}

/** The route of a polygon path: start, the crossings, goal. */
function routeOf(p: Prepared, polys: readonly number[], from: Vec3, to: Vec3): Vec3[] {
  const line: Vec3[] = [{ ...from }];
  for (let i = 1; i < polys.length; i++) line.push(crossing(p.g, polys[i - 1]!, polys[i]!, p.centre));
  line.push({ ...to });
  return line;
}

/** How far along a list of points each one is (m, across). */
function alongOf(pts: readonly Vec3[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1]! + hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
  return out;
}

function lengthOf(line: readonly Vec3[]): number {
  let len = 0;
  for (let i = 1; i < line.length; i++) len += hypot(line[i]!.x - line[i - 1]!.x, line[i]!.z - line[i - 1]!.z) + Math.abs(line[i]!.y - line[i - 1]!.y) * 0.5;
  return len;
}

/** Points along a route every `step` m (the route's own corners where it turns sharply are kept too). */
export function resample(line: readonly Vec3[], step: number): Vec3[] {
  const out: Vec3[] = [];
  if (!line.length) return out;
  out.push({ ...line[0]! });
  // How far along the route the last point put out is.
  let since = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    // A big rise or drop (a ladder, a drop link, a jump pad's flight): both ends are points of their own (the way goes
    // from the one to the other, not through the air between).
    if (Math.abs(b.y - a.y) > 2.5) {
      const last = out[out.length - 1]!;
      if (hypot(last.x - a.x, last.z - a.z) > 0.5 || Math.abs(last.y - a.y) > 0.5) out.push({ ...a });
      out.push({ ...b });
      since = 0;
      continue;
    }
    const d = hypot(b.x - a.x, b.z - a.z);
    let at = step - since;
    while (at <= d) {
      const f = d > 0 ? at / d : 0;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
      at += step;
    }
    since = d - (at - step);
  }
  const last = line[line.length - 1]!;
  const end = out[out.length - 1]!;
  if (hypot(end.x - last.x, end.z - last.z) > 1 || Math.abs(end.y - last.y) > 1) out.push({ ...last });
  return out;
}

/** A grid of points (dense samples of the corridors found), for "how near is this to them" in a few lookups. */
class PointGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly pts: number[] = [];
  constructor(private readonly cell: number) {}
  private k(x: number, z: number): number {
    return (Math.floor(x / this.cell) + 4096) * 8192 + (Math.floor(z / this.cell) + 4096);
  }
  add(p: Vec3): void {
    const i = this.pts.length / 3;
    this.pts.push(p.x, p.y, p.z);
    const k = this.k(p.x, p.z);
    const c = this.cells.get(k);
    if (c) c.push(i);
    else this.cells.set(k, [i]);
  }
  /** Whether a point lies within `r` (across) and FLOOR (up or down) of any point added. */
  near(x: number, y: number, z: number, r: number): boolean {
    const span = Math.ceil(r / this.cell);
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const c = this.cells.get((cx + dx + 4096) * 8192 + (cz + dz + 4096));
        if (!c) continue;
        for (const i of c) {
          const px = this.pts[i * 3]!;
          const py = this.pts[i * 3 + 1]!;
          const pz = this.pts[i * 3 + 2]!;
          if (Math.abs(py - y) < FLOOR && (px - x) * (px - x) + (pz - z) * (pz - z) < r * r) return true;
        }
      }
    }
    return false;
  }
}

const cache = new Map<string, Trip>();

/**
 * Up to three different corridors from `from` to `to` (each on or near the navmesh), the shortest first; cached per
 * navmesh and pair of ends. None when no route joins them.
 */
export function findCorridors(nav: NavWorld, from: Vec3, to: Vec3): Trip {
  const g = nav.graph();
  const p = prepare(g);
  const s = nav.nearestPoly(from);
  const t = nav.nearestPoly(to);
  const key = `${p.key}|${s?.index ?? -1}|${t?.index ?? -1}|${Math.round(from.x)},${Math.round(from.z)}|${Math.round(to.x)},${Math.round(to.z)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const trip: Trip = { from: { ...from }, to: { ...to }, corridors: s && t ? corridorsBetween(p, s.index, t.index, s.point, t.point) : [] };
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key, trip);
  return trip;
}

function corridorsBetween(p: Prepared, s: number, t: number, from: Vec3, to: Vec3): Corridor[] {
  const out: Corridor[] = [];
  if (s === t || !p.ok[s] || !p.ok[t]) return out;
  const straight = hypot(to.x - from.x, to.z - from.z);
  const end = Math.max(END_ZONE, straight * END_SHARE);
  const inEnd = (x: number, y: number, z: number) => (hypot(x - from.x, z - from.z) < end && Math.abs(y - from.y) < FLOOR * 2) || (hypot(x - to.x, z - to.z) < end && Math.abs(y - to.y) < FLOOR * 2);
  const found = new PointGrid(4);
  const mult = new Float32Array(p.g.count).fill(1);
  for (let k = 0; k < MAX_CORRIDORS; k++) {
    const polys = search(p, s, t, k ? mult : null);
    if (!polys) break;
    const line = routeOf(p, polys, from, to);
    const length = lengthOf(line);
    // Dense samples (every 2 m) to measure what it shares with the corridors before it, and to mark it for the next.
    const dense = resample(line, 2);
    let mid = 0;
    let shared = 0;
    for (const q of dense) {
      if (inEnd(q.x, q.y, q.z)) continue;
      mid++;
      if (k && found.near(q.x, q.y, q.z, SAME_WIDTH)) shared++;
    }
    const share = mid ? shared / mid : 1;
    if (k) {
      // Not genuinely different, or a long way round: no more corridors for this trip (the next would be worse).
      if (share > MAX_SHARED || length > out[0]!.length * MAX_STRETCH + EXTRA) break;
    }
    const points = resample(line, SPACING);
    const measure = resample(line, LINE_STEP);
    const lineAt = alongOf(measure);
    out.push({ points, pointsAt: alongOf(points), line: measure, lineAt, length, shared: k ? share : 0, via: null, viaApart: 0 });
    for (const q of dense) found.add(q);
    // The ground near it costs more for the next search (not near the ends: every way meets there).
    const c = p.centre;
    for (let i = 0; i < p.g.count; i++) {
      if (mult[i]! > 1) continue;
      const x = c[i * 3]!;
      const y = c[i * 3 + 1]!;
      const z = c[i * 3 + 2]!;
      if (!inEnd(x, y, z) && found.near(x, y, z, CORRIDOR_WIDTH)) mult[i] = 1 + PENALTY;
    }
  }
  // Each corridor's via: where it is furthest from the others (the shortest one's too: it is shortest from the trip's
  // start, a flag's base, and bots from the spawns round it often go another corridor's way by themselves).
  if (out.length < 2) return out;
  return out.map((c, k) => {
    const [via, viaApart] = furthestFrom(c.line, c.lineAt, out.filter((_, j) => j !== k));
    return { ...c, via, viaApart };
  });
}

/**
 * The point of a route (between a fifth and four fifths of the way) furthest from the earlier corridors' routes (on the
 * same floor: within FLOOR up or down; further apart counts as apart), and how far that is.
 */
function furthestFrom(line: readonly Vec3[], lineAt: readonly number[], earlier: readonly Corridor[]): [Vec3 | null, number] {
  const end = lineAt[lineAt.length - 1] ?? 0;
  let best: Vec3 | null = null;
  let bestD = -1;
  for (let i = 0; i < line.length; i++) {
    const at = lineAt[i]!;
    if (at < end * 0.2 || at > end * 0.8) continue;
    const p = line[i]!;
    let near = Infinity;
    for (const c of earlier) {
      for (const q of c.line) {
        if (Math.abs(q.y - p.y) > FLOOR) continue;
        const d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
        if (d < near) near = d;
      }
    }
    if (near > bestD) {
      bestD = near;
      best = p;
    }
  }
  return best ? [{ ...best }, Math.sqrt(bestD)] : [null, 0];
}

/**
 * Where a point is along a corridor: the index of the nearest of its dense route points (`line`), and how far off it
 * (m, across; Infinity on another floor). A few dozen distance checks.
 */
export function placeOn(c: Corridor, p: Vec3): { at: number; off: number } {
  let best = -1;
  let bestD = Infinity;
  const line = c.line;
  for (let i = 0; i < line.length; i++) {
    const q = line[i]!;
    if (Math.abs(q.y - p.y) > FLOOR * 1.5) continue;
    const d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { at: best, off: best < 0 ? Infinity : Math.sqrt(bestD) };
}
