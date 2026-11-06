import { getNavMeshPositionsAndIndices, init as initRecast, NavMeshQuery, QueryFilter, type NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';
import { boxesToTriangles, type WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import type { ValidationIssue } from '../map/validate.ts';
import type { Vec3 } from '../math.ts';
import { LIFT_FLAG, OPENING_BITS, PLAYER } from '../sim/constants.ts';
import { trackGeometry } from '../map/track.ts';
import { mapPortals, portalEntry, PORTAL_EXIT } from '../sim/portals.ts';
import { mapZiplines, ziplineClearanceIssues, ziplineLinks } from '../sim/zipline.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import type { Aabb } from '../sim/scenarioDefs.ts';
import { simProfile } from '../sim/profile.ts';
import { hypot } from '../math.ts';

let initPromise: Promise<void> | undefined;

/** Load the Recast WASM module once. Safe to call repeatedly. */
export function initNavigation(): Promise<void> {
  initPromise ??= initRecast();
  return initPromise;
}

const CELL = 0.2;
const CELL_HEIGHT = 0.05;
/** Spacing of NavWorld.places(). */
const PLACE_CELL = 7;
/**
 * Search nodes per path query. Detour's default (2048) runs out on long routes
 * over big maps (round the lake and over the bridge on Norman Shores), and an
 * exhausted search returns a partial path, which bots took as "no way there".
 * 65535 is Detour's limit (16-bit node indices).
 */
const MAX_NODES = 65535;
/** Polygons a route may cross, and corners its straight path may have. */
const MAX_PATH_POLYS = 8192;
const MAX_CORNERS = 1024;
/** How far round a cut-off bot to look for walkable places that do route to its goal (m). */
const ESCAPE_REACH = 14;
/**
 * The longest straight crossing off a cut-off patch (m): the patch's edge to a place sampled every 7 m, so a
 * crossing of a couple of metres (out of a reflecting pool over its rim) can measure 6 m or so.
 */
const ESCAPE_GAP = 8;

/** A way off a cut-off patch of navmesh (NavWorld.escapes): where to cross from (null: from where you stand) and the place across. */
export interface NavEscape {
  edge: Vec3 | null;
  across: Vec3;
}
const NO_ESCAPE: readonly NavEscape[] = [];

/**
 * Navigation mesh generated from map geometry, so bots work on any Classic
 * Grid layout without authored waypoints (MASTER_SPEC_V2 §7, MULTIPLAYER_AI_SCALE).
 */
export class NavWorld {
  private constructor(
    readonly navMesh: NavMesh,
    private readonly query: NavMeshQuery,
  ) {}

  /** `extra` adds triangle geometry (terrain) to the boxes; `links` are one-way jumps (jump pads) bots can take. */
  static build(boxes: readonly WorldBox[], extra: { positions: Float32Array; indices: Uint32Array } | null = null, links: readonly { start: Vec3; end: Vec3; reach?: Vec3 }[] = [], snapped = false): NavWorld {
    // The ground round a built map is for players to stand on, not somewhere bots go.
    const box = boxesToTriangles(boxes.filter((b) => b.sourceId !== 'ground'));
    let positions = box.positions;
    let indices = box.indices;
    if (extra) {
      positions = new Float32Array(box.positions.length + extra.positions.length);
      positions.set(box.positions);
      positions.set(extra.positions, box.positions.length);
      indices = new Uint32Array(box.indices.length + extra.indices.length);
      indices.set(box.indices);
      const offset = box.positions.length / 3;
      for (let i = 0; i < extra.indices.length; i++) indices[box.indices.length + i] = extra.indices[i]! + offset;
    }
    const result = generateSoloNavMesh(positions, indices, {
      cs: CELL,
      ch: CELL_HEIGHT,
      walkableSlopeAngle: PLAYER.maxSlopeDegrees,
      walkableHeight: Math.ceil(PLAYER.height / CELL_HEIGHT),
      // Round, not floor: 0.3 / 0.05 is 5.999… in floating point, which would reject 0.25 m steps at some heights.
      walkableClimb: Math.round(PLAYER.maxStepHeight / CELL_HEIGHT),
      // Extra clearance beyond the capsule radius so corner-cutting bots do not snag door frames.
      walkableRadius: Math.ceil((PLAYER.radius + 0.2) / CELL),
      maxEdgeLen: 12 / CELL,
      maxSimplificationError: 1.3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
      offMeshConnections: (snapped ? links : []).map((l) => ({ startPosition: l.start, endPosition: l.end, radius: 0.8, bidirectional: false })),
    });
    if (!result.success) throw new Error(`navmesh generation failed: ${result.error}`);
    const world = new NavWorld(result.navMesh, new NavMeshQuery(result.navMesh, { maxNodes: MAX_NODES }));
    if (!links.length || snapped) return world;
    // Jump links must start and end on the mesh: snap them to it, then build again with the links in.
    const onMesh = links.flatMap((l) => {
      // Lift links say how far to look (level with the platform's stop, so the far end isn't snapped back onto the platform below).
      const start = world.closestPoint(l.start, l.reach ?? { x: 1.5, y: 2, z: 1.5 });
      const end = world.closestPoint(l.end, l.reach ?? { x: 2.5, y: 3, z: 2.5 });
      return start && end ? [{ start, end }] : [];
    });
    world.destroy();
    return NavWorld.build(boxes, extra, onMesh, true);
  }

  /** Nearest point on the navmesh, or null if nothing walkable is close. */
  closestPoint(p: Vec3, halfExtents: Vec3 = { x: 2, y: 3, z: 2 }): Vec3 | null {
    const r = this.query.findClosestPoint(p, { halfExtents });
    return r.success && r.polyRef !== 0 ? { ...r.point } : null;
  }

  /**
   * Straight-path corners from a to b, or null if b is unreachable from a. `shut`: openings (markOpenings' flag
   * bits) the route must keep out of, such as doors shut to the bot's team that no button opens for it.
   */
  findPath(a: Vec3, b: Vec3, shut = 0): Vec3[] | null {
    if (!simProfile.on) return this.findPathNow(a, b, shut);
    const t0 = performance.now();
    const r = this.findPathNow(a, b, shut);
    simProfile.add('nav', performance.now() - t0);
    simProfile.count('nav');
    if (!r) simProfile.count('navFail');
    return r;
  }

  /**
   * Routes that don't exist, by start and end polygon: asked again, the answer
   * is a lookup instead of a search of everything reachable. (The navmesh
   * never changes under a NavWorld.) Found routes aren't shared: the tail of
   * another bot's corridor is shortest from where that bot entered a polygon,
   * not from where this one stands, and on open ground the difference showed
   * (Fort Wars bots stopped reaching the flag).
   */
  private readonly noRoute = new Set<string>();

  private findPathNow(a: Vec3, b: Vec3, shut = 0): Vec3[] | null {
    const ext = { x: 2, y: 3, z: 2 };
    const s = this.query.findNearestPoly(a, { halfExtents: ext });
    const e = this.query.findNearestPoly(b, { halfExtents: ext });
    if (!s.success || !e.success || !s.nearestRef || !e.nearestRef) return null;
    const start = s.nearestPoint;
    const end = e.nearestPoint;
    // On parts of the navmesh nothing joins: no route, and no search of everything reachable to find that out.
    if (this.part(s.nearestRef) !== this.part(e.nearestRef)) {
      if (simProfile.on) simProfile.count('navSearchFail');
      return null;
    }
    const failKey = `${s.nearestRef}:${e.nearestRef}:${shut}`;
    if (this.noRoute.has(failKey)) return null;
    const r = this.query.findPath(s.nearestRef, e.nearestRef, start, end, shut ? { maxPathPolys: MAX_PATH_POLYS, filter: this.filterFor(shut) } : { maxPathPolys: MAX_PATH_POLYS });
    const n = r.polys.size;
    // A partial path (destination unreachable, or the search ran out of nodes) ends short of the goal.
    const whole = r.success && n > 0 && r.polys.get(n - 1) === e.nearestRef;
    if (simProfile.on) simProfile.count(whole ? 'navSearch' : 'navSearchFail');
    if (!whole) {
      r.polys.destroy();
      if (this.noRoute.size >= 4096) this.noRoute.clear();
      this.noRoute.add(failKey);
      return null;
    }
    const sp = this.query.findStraightPath(start, end, r.polys, { maxStraightPathPoints: MAX_CORNERS });
    r.polys.destroy();
    const out: Vec3[] = [];
    if (sp.success) {
      const v = sp.straightPath;
      for (let i = 0; i < sp.straightPathCount; i++) out.push({ x: v.get(i * 3), y: v.get(i * 3 + 1), z: v.get(i * 3 + 2) });
    }
    sp.straightPath.destroy();
    sp.straightPathFlags.destroy();
    sp.straightPathRefs.destroy();
    const last = out[out.length - 1];
    if (!last || hypot(last.x - end.x, last.z - end.z) > 0.5 || Math.abs(last.y - end.y) > 1) return null;
    return out;
  }

  private placeCache: Vec3[] | null = null;

  /**
   * Walkable sample points spread over the whole navmesh (about one per
   * `PLACE_CELL` metres on every floor), for bots choosing where to go and
   * which way round. Built once, deterministic.
   */
  places(): readonly Vec3[] {
    if (this.placeCache) return this.placeCache;
    const [pos, idx] = getNavMeshPositionsAndIndices(this.navMesh);
    const best = new Map<number, { p: Vec3; d: number }>();
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t]! * 3;
      const b = idx[t + 1]! * 3;
      const c = idx[t + 2]! * 3;
      const centre = { x: (pos[a]! + pos[b]! + pos[c]!) / 3, y: (pos[a + 1]! + pos[b + 1]! + pos[c + 1]!) / 3, z: (pos[a + 2]! + pos[b + 2]! + pos[c + 2]!) / 3 };
      // Big triangles (box maps) span several cells: sample toward their corners too.
      const big = Math.max(Math.abs(pos[a]! - pos[b]!), Math.abs(pos[a + 2]! - pos[b + 2]!), Math.abs(pos[a]! - pos[c]!), Math.abs(pos[a + 2]! - pos[c + 2]!)) > PLACE_CELL;
      for (const v of big ? [-1, a, b, c] : [-1]) {
        const p = v < 0 ? centre : { x: centre.x + (pos[v]! - centre.x) * 0.7, y: centre.y + (pos[v + 1]! - centre.y) * 0.7, z: centre.z + (pos[v + 2]! - centre.z) * 0.7 };
        const cx = Math.floor(p.x / PLACE_CELL);
        const cz = Math.floor(p.z / PLACE_CELL);
        const key = ((cx + 2048) * 4096 + (cz + 2048)) * 256 + (Math.floor(p.y / 2.5) + 128);
        // Keep the sample nearest the cell's centre.
        const d = hypot(p.x - (cx + 0.5) * PLACE_CELL, p.z - (cz + 0.5) * PLACE_CELL);
        const prev = best.get(key);
        if (!prev || d < prev.d) best.set(key, { p, d });
      }
    }
    this.placeCache = [...best.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v.p);
    // The navmesh's parts and the places' parts too: worked out here, at setup (the match asks for the places
    // when bots join), rather than in a tick (about 15 ms and 10–30 ms on a big map).
    this.partsNow();
    this.placePartsNow();
    return this.placeCache;
  }

  /**
   * The navmesh's connected parts: which part each polygon is in (links, off-mesh ones included, taken both
   * ways) and each part's size in polygons. Worked out once, on first use (about 15 ms for a big map). Points on
   * different parts have no route between them, whatever a search would say.
   */
  private parts: { of: Int32Array; size: number[]; base: number } | null = null;

  private partsNow(): { of: Int32Array; size: number[]; base: number } {
    if (this.parts) return this.parts;
    const mesh = this.navMesh;
    // One tile (generateSoloNavMesh); anything else: one part for everything (no early answers).
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const n = tile?.header()?.polyCount() ?? 0;
    if (!tile || !n) return (this.parts = { of: new Int32Array(0), size: [], base: 0 });
    const base = mesh.getPolyRefBase(tile);
    const next: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      // DT_NULL_LINK ends a polygon's links (bounded, in case of a bad list).
      for (let l = tile.polys(i).firstLink(), k = 0; l !== 0xffffffff && l >= 0 && k < 64; k++) {
        const link = tile.links(l);
        const j = link.ref() - base;
        if (j >= 0 && j < n && j !== i) {
          next[i]!.push(j);
          next[j]!.push(i);
        }
        l = link.next();
      }
    }
    const of = new Int32Array(n).fill(-1);
    const size: number[] = [];
    const stack: number[] = [];
    for (let i = 0; i < n; i++) {
      if (of[i]! >= 0) continue;
      const id = size.length;
      let count = 0;
      of[i] = id;
      stack.push(i);
      while (stack.length) {
        const k = stack.pop()!;
        count++;
        for (const j of next[k]!) {
          if (of[j]! < 0) {
            of[j] = id;
            stack.push(j);
          }
        }
      }
      size.push(count);
    }
    return (this.parts = { of, size, base });
  }

  /** Route filters that keep out of shut openings, by mask (a few per match: doors open and shut). */
  private readonly filters = new Map<number, QueryFilter>();

  private filterFor(shut: number): QueryFilter {
    let f = this.filters.get(shut);
    if (!f) {
      f = new QueryFilter();
      f.includeFlags = 0xffff;
      f.excludeFlags = shut;
      if (this.filters.size >= 64) this.filters.clear();
      this.filters.set(shut, f);
    }
    return f;
  }

  /**
   * Openings (doors, walls that block paths until broken: Scenario.openings) as navmesh flags: the polygons
   * under the first OPENING_BITS of them get bit k + 1 each, so findPath's `shut` can keep a route out of the
   * ones shut to a bot. Sampled every 0.25 m over each opening's footprint, keeping only polygons the samples
   * stand over (not ones that merely come near). Once, at match start (and when the navmesh is rebuilt).
   */
  markOpenings(boxes: readonly Aabb[]): void {
    const half = { x: 0.15, y: 0.9, z: 0.15 };
    boxes.slice(0, OPENING_BITS).forEach((b, k) => {
      const bit = 1 << (k + 1);
      const marked = new Set<number>();
      for (let x = b.min.x; x <= b.max.x + 1e-6; x += 0.25) {
        for (let z = b.min.z; z <= b.max.z + 1e-6; z += 0.25) {
          const r = this.query.findNearestPoly({ x, y: b.min.y + 0.3, z }, { halfExtents: half });
          if (!r.success || !r.nearestRef || !r.isOverPoly || marked.has(r.nearestRef)) continue;
          marked.add(r.nearestRef);
          const f = this.navMesh.getPolyFlags(r.nearestRef);
          this.navMesh.setPolyFlags(r.nearestRef, (f.flags || 1) | bit);
        }
      }
    });
    // Routes found before are still right for the routes that don't keep out of anything; failures with a mask are new.
    this.noRoute.clear();
  }

  /**
   * Lift rides as navmesh flags: the off-mesh links whose ends are a lift's two stops (Match: liftLinks) get
   * LIFT_FLAG, so a route can be asked to keep off lifts. Once, at match start.
   */
  markLifts(lifts: readonly { start: Vec3; end: Vec3 }[]): void {
    if (!lifts.length) return;
    const mesh = this.navMesh;
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const header = tile?.header();
    if (!tile || !header) return;
    const base = mesh.getPolyRefBase(tile);
    const near = (x: number, y: number, z: number, p: Vec3) => hypot(x - p.x, z - p.z) < 3 && Math.abs(y - p.y) < 1.5;
    for (let i = 0; i < header.offMeshConCount(); i++) {
      const con = tile.offMeshCons(i);
      const a = [con.pos(0), con.pos(1), con.pos(2)] as const;
      const b = [con.pos(3), con.pos(4), con.pos(5)] as const;
      if (!lifts.some((l) => near(a[0], a[1], a[2], l.start) && near(b[0], b[1], b[2], l.end))) continue;
      const ref = base + con.poly();
      const f = mesh.getPolyFlags(ref);
      mesh.setPolyFlags(ref, (f.flags || 1) | LIFT_FLAG);
    }
    this.noRoute.clear();
  }

  /** The part of the navmesh a polygon is in (-1 when unknown: then every polygon counts as one part). */
  private part(ref: number): number {
    const p = this.partsNow();
    const i = ref - p.base;
    return i >= 0 && i < p.of.length ? p.of[i]! : -1;
  }

  /** The part of the navmesh under `p` (within the reach routes search from), and its size in polygons; null off the navmesh. */
  partAt(p: Vec3): { id: number; size: number } | null {
    const r = this.query.findNearestPoly(p, { halfExtents: { x: 2, y: 3, z: 2 } });
    if (!r.success || !r.nearestRef) return null;
    const id = this.part(r.nearestRef);
    return { id, size: id >= 0 ? this.partsNow().size[id]! : 0 };
  }

  /** The part each of places() is on (-1: none). */
  private placeParts: Int32Array | null = null;

  private placePartsNow(): Int32Array {
    if (this.placeParts) return this.placeParts;
    const places = this.placeCache ?? this.places();
    const parts = new Int32Array(places.length);
    places.forEach((p, i) => {
      const r = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      parts[i] = r.success && r.nearestRef ? this.part(r.nearestRef) : -1;
    });
    return (this.placeParts = parts);
  }

  private readonly escapeCache = new Map<string, readonly NavEscape[]>();

  /**
   * Ways off a patch of navmesh cut off from `goal` (docs/BOTS.md, "Cut off"). The navmesh is more cautious
   * than legs are: it keeps 0.2 m further from walls than a body needs, and a step under a low roof, a narrow
   * gap or a slab edge a hair over the step height can leave a patch players walk off with no route out of it
   * (Diamond Park's dugouts, with three of each team's spawn points in each). For a point on a smaller part of
   * the navmesh than the goal's (or off it altogether), up to three places close by on the goal's part that are
   * a short step or hop across from the point's patch, nearest first: where to cross from (on the patch; null
   * when the point is off the navmesh) and the place across. `clear`: a body gets straight across from one to
   * the other (nothing in the way). Empty when nothing is near enough, or the point isn't cut off (a goal on a
   * smaller part than the point's is what can't be reached). Cached per polygon and part.
   */
  escapes(from: Vec3, goal: Vec3, clear: (a: Vec3, b: Vec3) => boolean): readonly NavEscape[] {
    const ext = { x: 2, y: 3, z: 2 };
    const e = this.query.findNearestPoly(goal, { halfExtents: ext });
    if (!e.success || !e.nearestRef) return NO_ESCAPE;
    const target = this.part(e.nearestRef);
    if (target < 0) return NO_ESCAPE;
    const s = this.query.findNearestPoly(from, { halfExtents: ext });
    const on = s.success && !!s.nearestRef;
    const sizes = this.partsNow().size;
    if (on) {
      const mine = this.part(s.nearestRef);
      if (mine === target || mine < 0 || sizes[mine]! >= sizes[target]!) return NO_ESCAPE;
    }
    const key = on ? `${s.nearestRef}>${target}` : `${Math.round(from.x)},${Math.round(from.y)},${Math.round(from.z)}>${target}`;
    const known = this.escapeCache.get(key);
    if (known) return known;
    const places = this.places();
    const placeParts = this.placePartsNow();
    const near: { p: Vec3; d: number }[] = [];
    for (let i = 0; i < places.length; i++) {
      const p = places[i]!;
      if (placeParts[i] !== target || Math.abs(p.y - from.y) > 5) continue;
      const d = hypot(p.x - from.x, p.z - from.z);
      if (d < ESCAPE_REACH) near.push({ p, d });
    }
    near.sort((a, b) => a.d - b.d);
    const out: NavEscape[] = [];
    for (const { p } of near.slice(0, 12)) {
      // Where the patch comes nearest it (a route that can't get there ends at the closest point it can reach).
      const edge = on ? this.nearestReach(s.nearestRef, s.nearestPoint, p) : null;
      if (on && !edge) continue;
      const at = edge ?? from;
      const rise = p.y - at.y;
      if (hypot(p.x - at.x, p.z - at.z) > ESCAPE_GAP || rise > 1.1 || rise < -4 || !clear(at, p)) continue;
      out.push({ edge, across: { ...p } });
      if (out.length >= 3) break;
    }
    if (this.escapeCache.size >= 2048) this.escapeCache.clear();
    this.escapeCache.set(key, out);
    return out;
  }

  private readonly reachCache = new Map<string, Vec3 | null>();

  /**
   * The nearest point to `b` that a route from `a` gets to, when `b` itself can't be reached (a flag dropped into
   * a pit, a goal on a roof): Detour's partial route ends at the polygon nearest it. The same for every start on
   * one part of the navmesh, so cached per part and goal polygon: one search however many bots ask.
   */
  reachToward(a: Vec3, b: Vec3): Vec3 | null {
    const ext = { x: 2, y: 3, z: 2 };
    const s = this.query.findNearestPoly(a, { halfExtents: ext });
    const e = this.query.findNearestPoly(b, { halfExtents: { x: 4, y: 8, z: 4 } });
    if (!s.success || !s.nearestRef || !e.success || !e.nearestRef) return null;
    const key = `${this.part(s.nearestRef)}>${e.nearestRef}`;
    if (this.reachCache.has(key)) return this.reachCache.get(key)!;
    const p = this.nearestReach(s.nearestRef, s.nearestPoint, b, { x: 4, y: 8, z: 4 });
    if (this.reachCache.size >= 1024) this.reachCache.clear();
    this.reachCache.set(key, p);
    return p;
  }

  /** The point of the start polygon's patch nearest `to` (on another part: Detour's partial route ends at the polygon nearest it). */
  private nearestReach(startRef: number, start: Vec3, to: Vec3, reach: Vec3 = { x: 1, y: 2, z: 1 }): Vec3 | null {
    const e = this.query.findNearestPoly(to, { halfExtents: reach });
    if (!e.success || !e.nearestRef) return null;
    const r = this.query.findPath(startRef, e.nearestRef, start, e.nearestPoint, { maxPathPolys: MAX_PATH_POLYS });
    const n = r.polys.size;
    const last = r.success && n > 0 ? r.polys.get(n - 1) : 0;
    r.polys.destroy();
    if (!last) return null;
    const c = this.query.closestPointOnPoly(last, to);
    return c.success ? { ...c.closestPoint } : null;
  }

  destroy(): void {
    for (const f of this.filters.values()) (f as unknown as { raw?: { __destroy__?: () => void } }).raw?.__destroy__?.();
    this.filters.clear();
    this.query.destroy();
    this.navMesh.destroy();
  }
}

/**
 * Navigation checks for the validator: every spawn must be on the navmesh and
 * all spawns must reach each other, otherwise bots (and players) get stranded.
 */
/**
 * With `physics` (the level's colliders) ziplines are checked too: cable and riders clear of the level, ground to grab
 * them from and to land on, and both ends on ground the navmesh reaches.
 */
export function validateNavigation(map: MapDocument, nav: NavWorld, physics?: PhysicsWorld): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const spawns = map.entities.filter((e) => e.kind === 'spawn');
  const onMesh = spawns.filter((s) => {
    const p = { x: s.position[0], y: s.position[1], z: s.position[2] };
    if (!nav.closestPoint(p, { x: 1, y: 1, z: 1 })) {
      issues.push({ severity: 'warning', code: 'nav.spawn_off_mesh', message: `spawn ${s.id} is not on walkable ground`, targetId: s.id });
      return false;
    }
    return true;
  });
  const [first, ...rest] = onMesh;
  if (first) {
    const from = { x: first.position[0], y: first.position[1], z: first.position[2] };
    for (const s of rest) {
      if (!nav.findPath(from, { x: s.position[0], y: s.position[1], z: s.position[2] })) {
        issues.push({ severity: 'warning', code: 'nav.disconnected', message: `spawn ${s.id} cannot be reached from spawn ${first.id}`, targetId: s.id });
      }
    }
    // Pickups bots and players can't walk (or pad) to are wasted; objectives (flag bases, hills, bomb sites,
    // hostages and rescue zones) must be reachable to be played.
    const what: Partial<Record<MapDocument['entities'][number]['kind'], string>> = { pickup: 'pickup', flag: 'flag base', hill: 'hill', bombsite: 'bomb site', hostage: 'hostage', rescue: 'rescue zone' };
    for (const p of map.entities) {
      if (!what[p.kind]) continue;
      const to = { x: p.position[0], y: p.position[1], z: p.position[2] };
      const path = nav.findPath(from, to);
      const end = path?.[path.length - 1];
      if (!end || hypot(end.x - to.x, end.z - to.z) > 1.5 || Math.abs(end.y - to.y) > 2) {
        issues.push({ severity: 'warning', code: `nav.${p.kind}_unreachable`, message: `${what[p.kind]} ${p.id} cannot be reached on foot from spawn ${first.id}`, targetId: p.id });
      }
    }
  }
  // Portals: bots and players must be able to stand where they step in and where they come out.
  for (const p of mapPortals(map.entities)) {
    if (p.link < 0) continue;
    for (const [what, at] of [['in front of', portalEntry(p, 0.9)], ['out of', portalEntry(p, PORTAL_EXIT + 0.6)]] as const) {
      if (!nav.closestPoint(at, { x: 1.2, y: 1.5, z: 1.2 })) {
        issues.push({ severity: 'warning', code: 'nav.portal_blocked', message: `the ground ${what} portal ${p.id} is not walkable (nothing to stand on, or something in the way)`, targetId: p.id });
        break;
      }
    }
  }
  if (physics) {
    issues.push(...ziplineClearanceIssues(map.entities, physics));
    // Ziplines: where you grab one and where it drops you must be walkable ground (players and bots get there and away).
    const zips = mapZiplines(map.entities);
    for (const z of zips) {
      for (const l of ziplineLinks([z], physics)) {
        for (const [what, at] of [['where riders grab it', l.start], ['where it drops riders off', l.end]] as const) {
          if (!nav.closestPoint(at, { x: 1.5, y: 1.5, z: 1.5 })) issues.push({ severity: 'warning', code: 'nav.zipline_end', message: `zipline ${z.id}: the ground ${what} is not walkable (nothing to stand on, or something in the way)`, targetId: z.id });
        }
      }
    }
  }
  issues.push(...validateTrackNavigation(map, nav));
  return issues;
}

/**
 * Race tracks: every checkpoint must be on drivable ground and reachable from
 * the one before (vehicles and racing bots follow the same ground the navmesh
 * covers), and every start-grid place must be on it.
 */
export function validateTrackNavigation(map: MapDocument, nav: NavWorld): ValidationIssue[] {
  const g = trackGeometry(map);
  if (!g) return [];
  const issues: ValidationIssue[] = [];
  const reach = { x: g.width / 2, y: 4, z: g.width / 2 };
  const spots = g.gates.map((gate) => nav.closestPoint({ x: gate.x, y: gate.y, z: gate.z }, reach));
  spots.forEach((p, i) => {
    if (!p) issues.push({ severity: 'warning', code: 'nav.checkpoint_off_mesh', message: `checkpoint ${i + 1} is not on drivable ground` });
  });
  const legs = g.loop ? spots.length : spots.length - 1;
  for (let i = 0; i < legs; i++) {
    const a = spots[i];
    const b = spots[(i + 1) % spots.length];
    if (a && b && !nav.findPath(a, b)) issues.push({ severity: 'warning', code: 'nav.checkpoint_unreachable', message: `checkpoint ${((i + 1) % spots.length) + 1} cannot be reached from checkpoint ${i + 1}` });
  }
  const off = g.grid().filter((p) => !nav.closestPoint(p, { x: 2, y: 4, z: 2 })).length;
  if (off) issues.push({ severity: 'warning', code: 'nav.grid_off_mesh', message: `${off} start-grid place${off > 1 ? 's are' : ' is'} not on drivable ground` });
  return issues;
}
