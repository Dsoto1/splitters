import type { WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import type { ValidationIssue } from '../map/validate.ts';
import { hypot, type Vec3 } from '../math.ts';
import { PLAYER } from '../sim/constants.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import type { NavGraph, NavWorld } from './index.ts';
import { knownNavIssue } from './auditKnown.ts';

/**
 * The navigation audit (docs/BOTS.md, "Navigation audit"): what bots can get to and out of, from every polygon of
 * the navmesh, not just from the first spawn point.
 *
 * - **Routes** are the navmesh's own links between polygons, one way: walking (both ways), and the off-mesh links
 *   (jump pads, ladders, portals, ziplines, lifts, ledge drops).
 * - **Falls** are where a body walks off the walkable ground and drops onto lower ground: off a ledge, a roof, a
 *   cliff, into a pit (traced against the level: nothing in the way at step, knee and head height, then down).
 *   Falls are how bots end up somewhere without a route there (pushed, knocked, a missed step); they aren't routes.
 * - **The main area**: the largest set of polygons that all route to each other and hold the most spawn points.
 * - **A trap**: a place a bot gets into from where it spawns (by falling, a one-way link, a jump pad) and can't route
 *   out of to the main area. A trap with a fall out is a ledge the navmesh has no way down from (the match's drop
 *   links fix those: NavWorld.build `drops`); one without is a pit nobody gets out of (the map's to fix).
 * - **Cut off**: a spawn point that can't route to the main area, an objective (flag base, hill, bomb site, hostage,
 *   rescue zone) some team's spawn points can't route to, a pickup no spawn point routes to.
 */

/** How far off the navmesh a bot steps straight for a goal by it (brain.ts STEP_OFF): what counts as reached. */
const STEP_OFF_REACH = 2.2;
/** Spacing of the samples along open polygon edges (m). */
const FALL_SPACING = 1.5;
/** How far out from the navmesh's edge a body is checked for a drop (m): the navmesh keeps clear of edges, and a body falls once its middle is past one. */
const FALL_REACH = [1.3, 2.2, 3.2] as const;
/** A step down this much or less is walking, not a fall (m). */
const FALL_MIN = PLAYER.maxStepHeight + 0.05;
/** Heights above the feet a walk off an edge must be clear at (m): a step, a knee, a head. */
const CLEAR_AT = [0.35, 0.9, 1.6] as const;
/** Exits made for a cut-off patch of navmesh (drop links), at most, and how far apart (m). */
const EXITS_PER_PATCH = 3;
const EXIT_SPACING = 4;
const MAX_EXITS = 400;

/** A fall off the walkable ground: from polygon `from` (a point on its open edge) a body drops `drop` m onto polygon `to` (-1: onto ground the navmesh doesn't cover). */
export interface NavFall {
  from: number;
  to: number;
  at: Vec3;
  land: Vec3;
  drop: number;
}

export interface FallOptions {
  /** Drops higher than this (m) are left out (they kill, or hurt too much). */
  maxDrop: number;
  /** Below this a fall is out of the world. */
  floorY?: number;
  /** Landings to leave out (in lava). */
  deadly?: (p: Vec3) => boolean;
  /**
   * Solid boxes `physics` doesn't hold (yet): breakable props and moving or breaking blocks, which the match's
   * scenario adds after the navmesh is built. A turned one counts as the upright box round it.
   */
  solids?: readonly WorldBox[];
  /** Ground under deep liquid (over a body's chest): a landing there is a swim, not a fall onto somewhere to walk. */
  underLiquid?: (p: Vec3) => boolean;
}

/** Distance along a normalised ray to the first of `boxes` it enters (from outside), or null within maxDist. */
function boxesRay(boxes: readonly WorldBox[], o: Vec3, d: Vec3, maxDist: number): number | null {
  let best: number | null = null;
  for (const b of boxes) {
    let lo = b.min;
    let hi = b.max;
    if (b.yaw || b.pitch || b.roll) {
      // The upright box round a turned one.
      const cx = (b.min[0] + b.max[0]) / 2;
      const cz = (b.min[2] + b.max[2]) / 2;
      const r = hypot(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2;
      const h = b.pitch || b.roll ? hypot(b.max[1] - b.min[1], r * 2) / 2 : (b.max[1] - b.min[1]) / 2;
      const cy = (b.min[1] + b.max[1]) / 2;
      lo = [cx - r, cy - h, cz - r];
      hi = [cx + r, cy + h, cz + r];
    }
    let t0 = 0;
    let t1 = maxDist;
    let hit = true;
    for (let a = 0; a < 3 && hit; a++) {
      const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
      const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
      if (Math.abs(da) < 1e-9) {
        if (oa < lo[a]! || oa > hi[a]!) hit = false;
        continue;
      }
      let ta = (lo[a]! - oa) / da;
      let tb = (hi[a]! - oa) / da;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) hit = false;
    }
    if (hit && (best === null || t0 < best)) best = t0;
  }
  return best;
}

/** The first thing a body walks into or stands on along a ray: the level (physics) or one of the extra solids. */
function moveRay(physics: PhysicsWorld, solids: readonly WorldBox[] | undefined, o: Vec3, d: Vec3, maxDist: number): number | null {
  const a = physics.moveRay(o, d, maxDist);
  if (!solids?.length) return a;
  const b = boxesRay(solids, o, d, a ?? maxDist);
  return b === null ? a : a === null ? b : Math.min(a, b);
}

/** Polygon centres (xyz) and areas (m², ground polygons only), worked out once per graph. */
const shapes = new WeakMap<NavGraph, { centre: Float32Array; area: Float32Array }>();
export function polyShapes(g: NavGraph): { centre: Float32Array; area: Float32Array } {
  let s = shapes.get(g);
  if (s) return s;
  const centre = new Float32Array(g.count * 3);
  const area = new Float32Array(g.count);
  for (let i = 0; i < g.count; i++) {
    const a = g.vstart[i]!;
    const b = g.vstart[i + 1]!;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = a; k < b; k++) {
      x += g.vxyz[k * 3]!;
      y += g.vxyz[k * 3 + 1]!;
      z += g.vxyz[k * 3 + 2]!;
    }
    const n = Math.max(1, b - a);
    centre[i * 3] = x / n;
    centre[i * 3 + 1] = y / n;
    centre[i * 3 + 2] = z / n;
    if (g.type[i] !== 0) continue;
    let s2 = 0;
    for (let k = a; k < b; k++) {
      const k2 = k + 1 < b ? k + 1 : a;
      s2 += g.vxyz[k * 3]! * g.vxyz[k2 * 3 + 2]! - g.vxyz[k2 * 3]! * g.vxyz[k * 3 + 2]!;
    }
    area[i] = Math.abs(s2) / 2;
  }
  s = { centre, area };
  shapes.set(g, s);
  return s;
}

const DOWN = { x: 0, y: -1, z: 0 };

/**
 * Where a body walking off polygon `poly`'s open edges falls (NavFall, one per sample along each open edge every
 * FALL_SPACING m that has a drop). `near`: only edge samples it says yes to (a bounds check).
 */
export function fallsFrom(nav: NavWorld, physics: PhysicsWorld, poly: number, opts: FallOptions, near?: (x: number, y: number, z: number) => boolean): NavFall[] {
  const g = nav.graph();
  const out: NavFall[] = [];
  if (g.type[poly] !== 0 || !g.open[poly] || disabled(g, poly)) return out;
  const { centre } = polyShapes(g);
  const cx = centre[poly * 3]!;
  const cz = centre[poly * 3 + 2]!;
  const a0 = g.vstart[poly]!;
  const vc = g.vstart[poly + 1]! - a0;
  const v = g.vxyz;
  for (let j = 0; j < vc; j++) {
    if (!(g.open[poly]! & (1 << j))) continue;
    const ia = (a0 + j) * 3;
    const ib = (a0 + ((j + 1) % vc)) * 3;
    const ax = v[ia]!;
    const ay = v[ia + 1]!;
    const az = v[ia + 2]!;
    const dx = v[ib]! - ax;
    const dy = v[ib + 1]! - ay;
    const dz = v[ib + 2]! - az;
    const len = hypot(dx, dz);
    if (len < 0.2) continue;
    // Outward: perpendicular to the edge, away from the polygon's middle.
    let nx = dz / len;
    let nz = -dx / len;
    if (nx * (ax + dx / 2 - cx) + nz * (az + dz / 2 - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const m = Math.max(1, Math.round(len / FALL_SPACING));
    for (let k = 0; k < m; k++) {
      const t = (k + 0.5) / m;
      const at = { x: ax + dx * t, y: ay + dy * t, z: az + dz * t };
      if (near && !near(at.x, at.y, at.z)) continue;
      const f = traceFall(physics, at, nx, nz, opts);
      if (!f) continue;
      // Onto a polygon close below where it lands (the navmesh keeps 0.8 m clear of the cliff foot it lands by).
      const hit = nav.nearestPoly({ x: f.x, y: f.y + 0.3, z: f.z }, { x: 1.6, y: 0.8, z: 1.6 });
      if (hit && hit.index === poly) continue;
      out.push({ from: poly, to: hit ? hit.index : -1, at, land: hit ? hit.point : f, drop: at.y - f.y });
    }
  }
  return out;
}

/** Walking off the edge at `at` toward (nx, nz): where the body lands (feet), or null (a wall or railing, ground at the same height, a deadly or too-high drop). */
function traceFall(physics: PhysicsWorld, at: Vec3, nx: number, nz: number, opts: FallOptions): Vec3 | null {
  const dir = { x: nx, y: 0, z: nz };
  const far: number = FALL_REACH[FALL_REACH.length - 1]!;
  let clear = far;
  for (const h of CLEAR_AT) {
    const d = moveRay(physics, opts.solids, { x: at.x, y: at.y + h, z: at.z }, dir, far);
    if (d !== null && d < clear) clear = d;
  }
  const floorY = opts.floorY ?? -60;
  for (const d of FALL_REACH) {
    // (The body's middle gets there: its radius short of anything in the way.)
    if (d > clear - PLAYER.radius) return null;
    const x = at.x + nx * d;
    const z = at.z + nz * d;
    const top = at.y + 0.5;
    const down = moveRay(physics, opts.solids, { x, y: top, z }, DOWN, top - floorY);
    if (down === null) return null; // Out of the world: a fall to death, not somewhere to be.
    const y = top - down;
    if (y > at.y - FALL_MIN) continue; // Ground at about the same height: walk on.
    if (at.y - y > opts.maxDrop) return null;
    const land = { x, y, z };
    if (opts.deadly?.(land) || opts.underLiquid?.(land)) return null;
    return land;
  }
  return null;
}

/** A ground polygon the build left out (inside something solid: NavWorld.disableInsideSolid). */
export const disabled = (g: NavGraph, i: number): boolean => g.type[i] === 0 && g.flags[i] === 0;

/** Directed edges (CSR) over the graph's polygons: its links, and `extra` [from, to] pairs (none to or from left-out polygons). */
function edgesOf(g: NavGraph, extra: readonly (readonly [number, number])[] = []): { start: Int32Array; to: Int32Array } {
  const n = g.count;
  const ok = (a: number, b: number) => !disabled(g, a) && !disabled(g, b);
  const deg = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) for (let l = g.linkStart[i]!; l < g.linkStart[i + 1]!; l++) if (ok(i, g.links[l]!)) deg[i + 1]!++;
  for (const [a, b] of extra) if (ok(a, b)) deg[a + 1]!++;
  for (let i = 0; i < n; i++) deg[i + 1]! += deg[i]!;
  const fill = deg.slice(0, n);
  const to = new Int32Array(deg[n]!);
  for (let i = 0; i < n; i++) for (let l = g.linkStart[i]!; l < g.linkStart[i + 1]!; l++) if (ok(i, g.links[l]!)) to[fill[i]!++] = g.links[l]!;
  for (const [a, b] of extra) if (ok(a, b)) to[fill[a]!++] = b;
  return { start: deg, to };
}

function reverseOf(e: { start: Int32Array; to: Int32Array }, n: number): { start: Int32Array; to: Int32Array } {
  const deg = new Int32Array(n + 1);
  for (let i = 0; i < e.to.length; i++) deg[e.to[i]! + 1]!++;
  for (let i = 0; i < n; i++) deg[i + 1]! += deg[i]!;
  const fill = deg.slice(0, n);
  const to = new Int32Array(e.to.length);
  for (let a = 0; a < n; a++) for (let k = e.start[a]!; k < e.start[a + 1]!; k++) to[fill[e.to[k]!]!++] = a;
  return { start: deg, to };
}

/** Polygons reachable from `seeds` over `e` (marks in a fresh array). */
function reach(e: { start: Int32Array; to: Int32Array }, n: number, seeds: Iterable<number>): Uint8Array {
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  for (const s of seeds) {
    if (s < 0 || s >= n || seen[s]) continue;
    seen[s] = 1;
    stack.push(s);
  }
  while (stack.length) {
    const a = stack.pop()!;
    for (let k = e.start[a]!; k < e.start[a + 1]!; k++) {
      const b = e.to[k]!;
      if (!seen[b]) {
        seen[b] = 1;
        stack.push(b);
      }
    }
  }
  return seen;
}

/** Strongly connected components (Tarjan, iterative): each polygon's component, and how many there are. */
function components(e: { start: Int32Array; to: Int32Array }, n: number): { of: Int32Array; count: number } {
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const of = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  const call: number[] = [];
  const edge: number[] = [];
  let next = 0;
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (index[s]! >= 0) continue;
    call.push(s);
    edge.push(e.start[s]!);
    index[s] = low[s] = next++;
    stack.push(s);
    onStack[s] = 1;
    while (call.length) {
      const v = call[call.length - 1]!;
      const k = edge[edge.length - 1]!;
      if (k < e.start[v + 1]!) {
        edge[edge.length - 1] = k + 1;
        const w = e.to[k]!;
        if (index[w]! < 0) {
          index[w] = low[w] = next++;
          stack.push(w);
          onStack[w] = 1;
          call.push(w);
          edge.push(e.start[w]!);
        } else if (onStack[w]) low[v] = Math.min(low[v]!, index[w]!);
        continue;
      }
      call.pop();
      edge.pop();
      if (call.length) {
        const u = call[call.length - 1]!;
        low[u] = Math.min(low[u]!, low[v]!);
      }
      if (low[v] === index[v]) {
        let w: number;
        do {
          w = stack.pop()!;
          onStack[w] = 0;
          of[w] = count;
        } while (w !== v);
        count++;
      }
    }
  }
  return { of, count };
}

/** Polygons reachable from `seeds` over the CSR edges (start, to). */
export function reachSet(start: Int32Array, to: Int32Array, n: number, seeds: Iterable<number>): Uint8Array {
  return reach({ start, to }, n, seeds);
}

/**
 * Route reachability for NavWorld (routable, standIn): the graph's links as edges, each polygon's component of
 * routes, the biggest component (by walkable area) and what routes from it reach.
 */
export function routeComponents(g: NavGraph, spawns: readonly number[] = []): { comp: Int32Array; main: number; fromMain: Uint8Array; start: Int32Array; to: Int32Array } {
  const e = edgesOf(g);
  const comps = components(e, g.count);
  const main = g.count ? mainOf(g, comps, spawns, e) : -1;
  const mainPolys: number[] = [];
  for (let i = 0; i < g.count; i++) if (comps.of[i] === main) mainPolys.push(i);
  return { comp: comps.of, main, fromMain: reach(e, g.count, mainPolys), start: e.start, to: e.to };
}

/** Spawn points' polygons (graph indices), by team ('' for spawns of no team); spawns off the navmesh are left out. */
function spawnPolys(map: MapDocument, nav: NavWorld): { all: number[]; byTeam: Map<string, number[]>; at: Map<string, number> } {
  const all: number[] = [];
  const byTeam = new Map<string, number[]>();
  const at = new Map<string, number>();
  for (const e of map.entities) {
    if (e.kind !== 'spawn') continue;
    const hit = nav.nearestPoly({ x: e.position[0], y: e.position[1], z: e.position[2] }, { x: 1, y: 1, z: 1 });
    if (!hit) continue;
    all.push(hit.index);
    at.set(e.id, hit.index);
    const team = (e as { faction?: string | null }).faction ?? '';
    (byTeam.get(team) ?? byTeam.set(team, []).get(team)!).push(hit.index);
  }
  return { all, byTeam, at };
}

/**
 * The main area's component (of routes): the one routes from the most spawn points reach (a team's spawn room with a
 * one-way way out is reached only from its own spawns; the field from everyone's), the biggest of those; without
 * spawns (`edges` or `spawns` empty) the biggest.
 */
function mainOf(g: NavGraph, comps: { of: Int32Array; count: number }, spawns: readonly number[], edges?: { start: Int32Array; to: Int32Array }): number {
  const { area } = polyShapes(g);
  const size = new Float64Array(comps.count);
  for (let i = 0; i < g.count; i++) if (!disabled(g, i)) size[comps.of[i]!]! += area[i]!;
  const score = new Float64Array(comps.count);
  if (edges && spawns.length) {
    // Spawn points by component (one search from each component's spawns), each counting for every component it reaches.
    const byComp = new Map<number, { poly: number; n: number }>();
    for (const s of spawns) {
      const c = comps.of[s]!;
      const e = byComp.get(c);
      if (e) e.n++;
      else byComp.set(c, { poly: s, n: 1 });
    }
    // Both ways: the spawn points that get to a component, and those it gets to. (One way only, a team's base that
    // bots jump-pad up into and can't route down from won over the field: Frost Basin.)
    const back = reverseOf(edges, g.count);
    const hit = new Uint8Array(comps.count);
    for (const { poly, n } of [...byComp.values()].slice(0, 64)) {
      for (const e of [edges, back]) {
        const seen = reach(e, g.count, [poly]);
        hit.fill(0);
        for (let i = 0; i < g.count; i++) if (seen[i]) hit[comps.of[i]!] = 1;
        for (let c = 0; c < comps.count; c++) if (hit[c]) score[c]! += n;
      }
    }
  }
  let best = -1;
  for (let c = 0; c < comps.count; c++) if (best < 0 || score[c]! > score[best]! || (score[c] === score[best] && size[c]! > size[best]!)) best = c;
  return best;
}

/** A patch of navmesh (polygons that join up, routes or falls) that doesn't route to the main area. */
export interface NavPatch {
  polys: number[];
  /** m² of walkable ground. */
  area: number;
  /** Middle (area-weighted) and extent. */
  centre: Vec3;
  min: Vec3;
  max: Vec3;
  /** How bots get in: falls into it from outside it, one-way links into it, spawn points on it. Empty: nobody gets there. */
  entries: { kind: 'fall' | 'link' | 'spawn'; at: Vec3; drop?: number; id?: string }[];
  /** A fall out of it onto ground that routes to the main area (players can drop out of it; the drop links do for bots). */
  dropOut: NavFall | null;
  /** Bots hop or step out of it (NavWorld.escapes): no trap. */
  hopOut?: boolean;
  /** Spawns, objectives and pickups on it (map entity ids). */
  holds: string[];
}

export interface NavAudit {
  graph: NavGraph;
  /** Each polygon's component of routes, the main one, and whether each polygon routes to it / is routed to from it / is reached from the spawns (routes and falls). */
  comp: Int32Array;
  main: number;
  toMain: Uint8Array;
  fromMain: Uint8Array;
  reached: Uint8Array;
  /** Patches that don't route to the main area: traps (bots get in) and islands (nobody gets there). */
  patches: NavPatch[];
  traps: NavPatch[];
  falls: NavFall[];
  issues: ValidationIssue[];
}

export interface AuditOptions extends FallOptions {
  /** Official maps (maps/): the audit's findings are errors; for creators in MapMaker, warnings. */
  official?: boolean;
  /** The audit already made (validateNavigation reports its issues instead of auditing again). */
  done?: NavAudit;
}

/** What an objective is called in messages. */
const OBJECTIVES: Partial<Record<string, string>> = { flag: 'flag base', hill: 'hill', bombsite: 'bomb site', hostage: 'hostage', rescue: 'rescue zone' };

/**
 * The navigation audit of a map's navmesh (built as the match builds it, links and drop links in) against its level
 * (`physics`, for the falls). Issues: nav.trap, nav.disconnected (a spawn point cut off), nav.<kind>_unreachable (an
 * objective or pickup cut off); errors on official maps unless known (auditKnown.ts), warnings otherwise.
 */
export function auditNavigation(map: MapDocument, nav: NavWorld, physics: PhysicsWorld, opts: AuditOptions): NavAudit {
  const g = nav.graph();
  const n = g.count;
  const { centre, area } = polyShapes(g);
  const routes = edgesOf(g);
  const back = reverseOf(routes, n);
  const comps = components(routes, n);
  const spawns = spawnPolys(map, nav);
  const main = n ? mainOf(g, comps, spawns.all, routes) : -1;
  const mainPolys: number[] = [];
  for (let i = 0; i < n; i++) if (comps.of[i] === main) mainPolys.push(i);
  const toMain = reach(back, n, mainPolys);
  const fromMain = reach(routes, n, mainPolys);
  // The patches that don't route to the main area, and falls into them from ground near them (only open edges within
  // reach of one are traced: a fall lands at most a few metres out from where it starts). Ground under deep water
  // (or lava) is left out: what a bot does in there is swim or drown, not walk.
  const off: number[] = [];
  const wet = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (toMain[i] || g.type[i] !== 0 || disabled(g, i)) continue;
    if (opts.underLiquid?.({ x: centre[i * 3]!, y: centre[i * 3 + 1]!, z: centre[i * 3 + 2]! })) wet[i] = 1;
    else off.push(i);
  }
  const grid = new Map<number, number[]>();
  const CELL = 8;
  const key = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);
  for (const i of off) {
    const cx = Math.floor(centre[i * 3]! / CELL);
    const cz = Math.floor(centre[i * 3 + 2]! / CELL);
    (grid.get(key(cx, cz)) ?? grid.set(key(cx, cz), []).get(key(cx, cz))!).push(i);
  }
  const isOff = new Uint8Array(n);
  for (const i of off) isOff[i] = 1;
  const nearOff = (x: number, y: number, z: number) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let ax = cx - 1; ax <= cx + 1; ax++) {
      for (let az = cz - 1; az <= cz + 1; az++) {
        for (const i of grid.get(key(ax, az)) ?? []) if (centre[i * 3 + 1]! < y && hypot(centre[i * 3]! - x, centre[i * 3 + 2]! - z) < CELL + 4) return true;
      }
    }
    return false;
  };
  const falls: NavFall[] = [];
  if (off.length) {
    for (let i = 0; i < n; i++) {
      if (g.type[i] !== 0 || !g.open[i]) continue;
      // Off patches' own edges in full (falls out of them, and on to others); everyone else's only near a patch.
      for (const f of fallsFrom(nav, physics, i, opts, isOff[i] ? undefined : nearOff)) falls.push(f);
    }
  }
  // Where bots end up from the spawn points: routes and falls.
  const withFalls = edgesOf(g, falls.filter((f) => f.to >= 0).map((f) => [f.from, f.to] as const));
  const reached = reach(withFalls, n, spawns.all);
  // Patches: off polygons joined by routes between them (either way; a fall from one onto another doesn't join them).
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]!]!;
    return a;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (const a of off) for (let k = routes.start[a]!; k < routes.start[a + 1]!; k++) if (isOff[routes.to[k]!]) join(a, routes.to[k]!);
  // (Through an off-mesh link polygon between two off polygons.)
  for (let l = 0; l < n; l++) {
    if (g.type[l] === 0 || toMain[l]) continue;
    for (let k = routes.start[l]!; k < routes.start[l + 1]!; k++) for (let k2 = back.start[l]!; k2 < back.start[l + 1]!; k2++) if (isOff[routes.to[k]!] && isOff[back.to[k2]!]) join(routes.to[k]!, back.to[k2]!);
  }
  const byRoot = new Map<number, number[]>();
  for (const i of off) (byRoot.get(find(i)) ?? byRoot.set(find(i), []).get(find(i))!).push(i);
  const patchOf = new Int32Array(n).fill(-1);
  const patches: NavPatch[] = [];
  for (const polys of byRoot.values()) {
    let a = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const i of polys) {
      const w = Math.max(1e-3, area[i]!);
      a += area[i]!;
      x += centre[i * 3]! * w;
      y += centre[i * 3 + 1]! * w;
      z += centre[i * 3 + 2]! * w;
      for (let k = g.vstart[i]!; k < g.vstart[i + 1]!; k++) {
        min.x = Math.min(min.x, g.vxyz[k * 3]!);
        min.y = Math.min(min.y, g.vxyz[k * 3 + 1]!);
        min.z = Math.min(min.z, g.vxyz[k * 3 + 2]!);
        max.x = Math.max(max.x, g.vxyz[k * 3]!);
        max.y = Math.max(max.y, g.vxyz[k * 3 + 1]!);
        max.z = Math.max(max.z, g.vxyz[k * 3 + 2]!);
      }
      patchOf[i] = patches.length;
    }
    const w = polys.reduce((s, i) => s + Math.max(1e-3, area[i]!), 0);
    patches.push({ polys, area: a, centre: { x: x / w, y: y / w, z: z / w }, min, max, entries: [], dropOut: null, holds: [] });
  }
  // Entries: falls and one-way links from outside a patch into it, spawn points on it. A way out: a fall onto ground
  // that routes to the main area.
  const at3 = (i: number): Vec3 => ({ x: centre[i * 3]!, y: centre[i * 3 + 1]!, z: centre[i * 3 + 2]! });
  for (const f of falls) {
    if (f.to < 0) continue;
    const p = patchOf[f.to]!;
    if (p >= 0 && patchOf[f.from] !== p && reached[f.from] && patches[p]!.entries.length < 24) patches[p]!.entries.push({ kind: 'fall', at: f.at, drop: Math.round(f.drop * 10) / 10 });
    const q = patchOf[f.from]!;
    if (q >= 0 && toMain[f.to] && (!patches[q]!.dropOut || f.drop < patches[q]!.dropOut!.drop)) patches[q]!.dropOut = f;
  }
  for (let l = 0; l < n; l++) {
    if (g.type[l] === 0) continue;
    for (let k = routes.start[l]!; k < routes.start[l + 1]!; k++) {
      const p = patchOf[routes.to[k]!]!;
      if (p < 0) continue;
      // From outside the patch: a polygon that leads into the link.
      for (let k2 = back.start[l]!; k2 < back.start[l + 1]!; k2++) {
        const from = back.to[k2]!;
        if (patchOf[from] !== p && reached[from] && from !== routes.to[k] && patches[p]!.entries.length < 24) patches[p]!.entries.push({ kind: 'link', at: at3(from) });
      }
    }
  }
  for (const e of map.entities) {
    const i = spawns.at.get(e.id);
    if (i === undefined) continue;
    const p = patchOf[i]!;
    if (p >= 0) patches[p]!.entries.push({ kind: 'spawn', at: { x: e.position[0], y: e.position[1], z: e.position[2] }, id: e.id });
  }
  // A patch bots hop or step out of (NavWorld.escapes, the bots' own way off a cut-off patch: a step or a hop of up to
  // 1.1 m onto main ground within 8 m, nothing in the way) is no trap: a sunken sliver, a step too high to walk.
  const clear = (a: Vec3, b: Vec3) => {
    const y = Math.max(a.y, b.y);
    return physics.lineOfSight({ x: a.x, y: y + 0.5, z: a.z }, { x: b.x, y: y + 0.5, z: b.z }) && physics.lineOfSight({ x: a.x, y: y + 1.6, z: a.z }, { x: b.x, y: y + 1.6, z: b.z });
  };
  for (const p of patches) {
    if (!p.polys.some((i) => reached[i])) continue;
    // The main area's polygon nearest the patch (its middle), as the goal to escape toward.
    let goal: Vec3 | null = null;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!toMain[i] || !fromMain[i] || g.type[i] !== 0) continue;
      const d = hypot(centre[i * 3]! - p.centre.x, centre[i * 3 + 2]! - p.centre.z) + Math.abs(centre[i * 3 + 1]! - p.centre.y);
      if (d < best) {
        best = d;
        goal = at3(i);
      }
    }
    // From each of the patch's polygons (a big patch's middle may be far from its edge), up to a dozen.
    const step = Math.max(1, Math.floor(p.polys.length / 12));
    for (let k = 0; goal && k < p.polys.length && !p.hopOut; k += step) if (nav.escapes(at3(p.polys[k]!), goal, clear).length) p.hopOut = true;
  }
  const traps = patches.filter((p) => !p.hopOut && p.polys.some((i) => reached[i]));
  const issues: ValidationIssue[] = [];
  const severity = (code: string, near: Vec3 | null, id?: string): { severity: 'error' | 'warning'; note: string } => {
    if (!opts.official) return { severity: 'warning', note: '' };
    const known = knownNavIssue(map.metadata.id, code, near, id);
    return known ? { severity: 'warning', note: ` (known: ${known})` } : { severity: 'error', note: '' };
  };
  const fmt = (p: Vec3) => `(${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)})`;
  // What's on each patch: spawns, objectives, pickups.
  const polyOf = new Map<string, number>();
  for (const e of map.entities) {
    if (e.kind !== 'pickup' && !OBJECTIVES[e.kind]) continue;
    const r = e.kind === 'hill' ? Math.max(1.5, ((e as { radius?: number }).radius ?? 3) * 0.8) : 1.6;
    const hit = nav.nearestPoly({ x: e.position[0], y: e.position[1] + 0.3, z: e.position[2] }, { x: r, y: 2, z: r });
    if (hit) polyOf.set(e.id, hit.index);
  }
  for (const [id, i] of [...spawns.at, ...polyOf]) {
    const p = patchOf[i]!;
    if (p >= 0) patches[p]!.holds.push(id);
  }
  for (const t of traps) {
    if (t.entries.every((e) => e.kind === 'spawn')) continue; // Spawn points cut off: nav.disconnected below.
    const s = severity('nav.trap', t.centre);
    const how = t.entries.filter((e) => e.kind !== 'spawn');
    const falls = how.filter((e) => e.kind === 'fall');
    const way = falls.length ? `falling from ${fmt(falls[0]!.at)} (${falls[0]!.drop} m${falls.length > 1 ? `, and ${falls.length - 1} more` : ''})` : `a one-way link from ${fmt(how[0]!.at)}`;
    const out = t.dropOut ? `; players can drop out at ${fmt(t.dropOut.at)} (${t.dropOut.drop.toFixed(1)} m), bots have no route` : '; nobody gets out';
    issues.push({ severity: s.severity, code: 'nav.trap', message: `a trap of ${t.area.toFixed(0)} m² round ${fmt(t.centre)}: bots get in by ${way} and can't walk out${out}${t.holds.length ? ` (on it: ${t.holds.join(', ')})` : ''}${s.note}` });
  }
  // Spawn points that don't route to the main area.
  for (const e of map.entities) {
    const i = spawns.at.get(e.id);
    if (i === undefined || toMain[i]) continue;
    const s = severity('nav.disconnected', null, e.id);
    issues.push({ severity: s.severity, code: 'nav.disconnected', message: `spawn ${e.id} is cut off: a bot spawning there can't walk to the rest of the map${s.note}`, targetId: e.id });
  }
  // Objectives every team's spawns must route to; pickups some spawn routes to. Reached as bots reach them: a route to
  // the place itself, or to a place within a step off the navmesh of it (a pickup on a crate, a flag on a prop: the
  // bots' stand-in and last step, NavWorld.standIn, brain.ts STEP_OFF).
  const teams = [...spawns.byTeam.keys()].filter((t) => t !== '');
  const spawnAt = (team: string | null): Vec3 | null => {
    for (const e of map.entities) {
      if (e.kind !== 'spawn' || (team !== null && ((e as { faction?: string | null }).faction ?? '') !== team)) continue;
      const i = spawns.at.get(e.id);
      if (i !== undefined && toMain[i]) return at3(i);
    }
    return null;
  };
  const reachedBy = (from: Vec3 | null, goal: Vec3): boolean => {
    if (!from) return false;
    const si = nav.standIn(from, goal);
    return !!si && (si.exact || (hypot(si.pos.x - goal.x, si.pos.z - goal.z) < STEP_OFF_REACH && Math.abs(si.pos.y - goal.y) < 1.4));
  };
  const anyFrom = spawnAt(null);
  for (const e of map.entities) {
    const what = e.kind === 'pickup' ? 'pickup' : OBJECTIVES[e.kind];
    if (!what) continue;
    const i = polyOf.get(e.id);
    const goal = { x: e.position[0], y: e.position[1], z: e.position[2] };
    let problem = '';
    if (i === undefined && !reachedBy(anyFrom, goal)) problem = 'is not on or by walkable ground';
    else if (e.kind === 'pickup' || !teams.length) {
      if (!reachedBy(anyFrom, goal)) problem = 'cannot be reached on foot from any spawn point';
    } else {
      const without = teams.filter((t) => !reachedBy(spawnAt(t) ?? anyFrom, goal));
      if (without.length) problem = `cannot be reached on foot from ${without.join(' and ')}'s spawn points`;
    }
    if (!problem && i !== undefined && !toMain[i] && !reachedBy(anyFrom, goal)) problem = "is on a patch bots can't walk out of";
    if (!problem) continue;
    const s = severity(`nav.${e.kind}_unreachable`, null, e.id);
    issues.push({ severity: s.severity, code: `nav.${e.kind}_unreachable`, message: `${what} ${e.id} ${problem}${s.note}`, targetId: e.id });
  }
  return { graph: g, comp: comps.of, main, toMain, fromMain, reached, patches, traps, falls, issues };
}

/**
 * Ways down off the patches of navmesh that don't route to the main area (one-way ledge-drop links, NavWorld.build
 * `drops`): from each patch, up to EXITS_PER_PATCH falls onto ground that does (lowest first, EXIT_SPACING m apart),
 * then again from patches those exits now lead out of (a ledge above a ledge). `links`: the build's other links
 * (snapped: start and end on the navmesh), which count as routes. Spawn points name the main area (else the biggest).
 */
export function trapExits(nav: NavWorld, physics: PhysicsWorld, spawns: readonly Vec3[], links: readonly { start: Vec3; end: Vec3 }[], opts: FallOptions): { start: Vec3; end: Vec3 }[] {
  const g = nav.graph();
  const n = g.count;
  if (!n) return [];
  const extra: [number, number][] = [];
  for (const l of links) {
    const a = nav.nearestPoly(l.start, { x: 0.5, y: 1, z: 0.5 });
    const b = nav.nearestPoly(l.end, { x: 0.5, y: 1, z: 0.5 });
    if (a && b && a.index !== b.index) extra.push([a.index, b.index]);
  }
  const seeds = spawns.flatMap((p) => {
    const hit = nav.nearestPoly(p, { x: 1, y: 1, z: 1 });
    return hit ? [hit.index] : [];
  });
  const routes = edgesOf(g, extra);
  const comps = components(routes, n);
  const main = mainOf(g, comps, seeds, routes);
  const mainPolys: number[] = [];
  for (let i = 0; i < n; i++) if (comps.of[i] === main) mainPolys.push(i);
  let toMain = reach(reverseOf(routes, n), n, mainPolys);
  const out: { start: Vec3; end: Vec3 }[] = [];
  // Each polygon's falls, traced once (a patch that gets no exit this round may get one onto a patch that did).
  const traced = new Map<number, NavFall[]>();
  for (let round = 0; round < 16 && out.length < MAX_EXITS; round++) {
    // Each patch's falls onto ground that routes to the main area, lowest first.
    const added: [number, number][] = [];
    const patchFalls = new Map<number, NavFall[]>();
    for (let i = 0; i < n; i++) {
      if (toMain[i] || g.type[i] !== 0 || !g.open[i] || disabled(g, i)) continue;
      let fs = traced.get(i);
      if (!fs) traced.set(i, (fs = fallsFrom(nav, physics, i, opts)));
      for (const f of fs) {
        if (f.to < 0 || !toMain[f.to]) continue;
        const c = comps.of[i]!;
        (patchFalls.get(c) ?? patchFalls.set(c, []).get(c)!).push(f);
      }
    }
    if (!patchFalls.size) break;
    for (const c of [...patchFalls.keys()].sort((a, b) => a - b)) {
      const fs = patchFalls.get(c)!;
      fs.sort((a, b) => a.drop - b.drop || a.at.x - b.at.x || a.at.z - b.at.z);
      const picked: NavFall[] = [];
      for (const f of fs) {
        if (picked.length >= EXITS_PER_PATCH || out.length >= MAX_EXITS) break;
        if (picked.some((p) => hypot(p.at.x - f.at.x, p.at.z - f.at.z) < EXIT_SPACING)) continue;
        picked.push(f);
        out.push({ start: { ...f.at }, end: { ...f.land } });
        added.push([f.from, f.to]);
      }
    }
    if (!added.length) break;
    extra.push(...added);
    toMain = reach(reverseOf(edgesOf(g, extra), n), n, mainPolys);
  }
  return out;
}

/** Known issues left on official maps, for the owner (auditKnown.ts). */
export { knownNavIssue } from './auditKnown.ts';
