import { createNavMeshData, freeCompactHeightfield, freeContourSet, freeHeightfield, freePolyMesh, freePolyMeshDetail, getNavMeshPositionsAndIndices, init as initRecast, NavMesh, NavMeshCreateParams, NavMeshQuery, QueryFilter } from 'recast-navigation';
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
import { auditNavigation, polyShapes, reachSet, routeComponents, trapExits, type AuditOptions, type FallOptions } from './audit.ts';

/** Ledge-drop links at build (NavWorld.build `drops`): the level to trace falls against, and the spawn points that say where the main area is. */
export interface DropOptions extends FallOptions {
  physics: PhysicsWorld;
  spawns: readonly Vec3[];
}

let initPromise: Promise<void> | undefined;

/** Load the Recast WASM module once. Safe to call repeatedly. */
export function initNavigation(): Promise<void> {
  initPromise ??= initRecast();
  return initPromise;
}

const CELL = 0.2;
const CELL_HEIGHT = 0.05;
/** The navmesh's clearance from walls and edges, in cells: the body's radius and 0.2 m (corner-cutting bots don't snag door frames). */
export const NAV_RADIUS_CELLS = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.NAV_RADIUS_CELLS ?? Math.round((PLAYER.radius + 0.2) / CELL));
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

/**
 * The navmesh as a graph (NavWorld.graph): polygons by index (Detour's ref = base + index), ground ones (type 0) and
 * off-mesh links (type 1, two corners: start and end).
 */
export interface NavGraph {
  count: number;
  base: number;
  type: Uint8Array;
  /** Polygon i's corners are vxyz[vstart[i] * 3 …] up to vstart[i + 1] (a convex polygon; for a link, its start and end). */
  vstart: Int32Array;
  vxyz: Float32Array;
  /** Bit j: polygon i's edge from corner j to j + 1 has no neighbour (the walkable ground ends there). */
  open: Uint8Array;
  /** Detour's links, one way: polygon i's go to links[linkStart[i] … linkStart[i + 1]]. */
  linkStart: Int32Array;
  links: Int32Array;
  /** Each polygon's flags (openings, lifts: markOpenings, markLifts). */
  flags: Uint16Array;
}

/** Recast's settings for the bots' navmesh (NavWorld.build). */
const RECAST_CONFIG = {
  cs: CELL,
  ch: CELL_HEIGHT,
  walkableSlopeAngle: PLAYER.maxSlopeDegrees,
  walkableHeight: Math.ceil(PLAYER.height / CELL_HEIGHT),
  // Round, not floor: 0.3 / 0.05 is 5.999… in floating point, which would reject 0.25 m steps at some heights.
  walkableClimb: Math.round(PLAYER.maxStepHeight / CELL_HEIGHT),
  // Extra clearance beyond the capsule radius so corner-cutting bots do not snag door frames.
  // 0.6 m, three cells. (Math.ceil gave four, 0.8 m: (0.4 + 0.2) / 0.2 is 3.0000000000000004 in floating point.
  // That closed doorways and stairwells under 1.6 m wide to bots, and left a metre-wide strip by every wall.)
  walkableRadius: NAV_RADIUS_CELLS,
  maxEdgeLen: 12 / CELL,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
} as const;

const offMesh = (l: { start: Vec3; end: Vec3 }) => ({ startPosition: l.start, endPosition: l.end, radius: 0.8, bidirectional: false });

type Intermediates = ReturnType<typeof generateSoloNavMesh>['intermediates'];

/**
 * A navmesh of the first build's polygons with `links` in: Detour's tile data made again from Recast's polygon and
 * detail meshes, as generateSoloNavMesh's last step makes it (its polygons' areas and flags are already set).
 */
function withLinks(inter: Intermediates, links: readonly { start: Vec3; end: Vec3 }[]): NavMesh {
  const polyMesh = inter.polyMesh;
  const detail = inter.polyMeshDetail;
  if (!polyMesh || !detail) throw new Error('navmesh generation kept no polygon mesh');
  const params = new NavMeshCreateParams();
  params.setPolyMeshCreateParams(polyMesh);
  params.setPolyMeshDetailCreateParams(detail);
  params.setWalkableHeight(RECAST_CONFIG.walkableHeight * CELL_HEIGHT);
  params.setWalkableRadius(RECAST_CONFIG.walkableRadius * CELL);
  params.setWalkableClimb(RECAST_CONFIG.walkableClimb * CELL_HEIGHT);
  params.setCellSize(CELL);
  params.setCellHeight(CELL_HEIGHT);
  params.setBuildBvTree(true);
  params.setOffMeshConnections(links.map(offMesh));
  const data = createNavMeshData(params);
  if (!data.success) throw new Error('navmesh generation failed: Detour data with the links');
  const navMesh = new NavMesh();
  if (!navMesh.initSolo(data.navMeshData)) throw new Error('navmesh generation failed: Detour navmesh with the links');
  return navMesh;
}

function freeIntermediates(inter: Intermediates): void {
  if (inter.heightfield) freeHeightfield(inter.heightfield);
  if (inter.compactHeightfield) freeCompactHeightfield(inter.compactHeightfield);
  if (inter.contourSet) freeContourSet(inter.contourSet);
  if (inter.polyMesh) freePolyMesh(inter.polyMesh);
  if (inter.polyMeshDetail) freePolyMeshDetail(inter.polyMeshDetail);
}

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

  /**
   * `extra` adds triangle geometry (terrain) to the boxes; `links` are one-way jumps (jump pads) bots can take.
   * `drops`: one-way ledge-drop links off the patches of navmesh that have no route to the main area (a ledge, a
   * scaffold, a roof bots land on), as many as they need (audit.ts trapExits; a map without such patches gets none,
   * and its navmesh is the same as without).
   */
  static build(boxes: readonly WorldBox[], extra: { positions: Float32Array; indices: Uint32Array } | null = null, links: readonly { start: Vec3; end: Vec3; reach?: Vec3 }[] = [], snapped = false, drops: DropOptions | null = null): NavWorld {
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
    // Links go in only after the navmesh is first built (they are snapped to it), so a build with links keeps Recast's
    // polygon mesh and makes only Detour's tile data again with them (the same polygons: no second voxelisation, which
    // took as long again as the first).
    const relink = !snapped && (links.length > 0 || !!drops);
    const result = generateSoloNavMesh(positions, indices, { ...RECAST_CONFIG, offMeshConnections: (snapped ? links : []).map(offMesh) }, relink);
    if (!result.success) throw new Error(`navmesh generation failed: ${result.error}`);
    const inter = result.intermediates;
    try {
      const world = new NavWorld(result.navMesh, new NavMeshQuery(result.navMesh, { maxNodes: MAX_NODES }));
      if (drops) {
        world.spawnSeeds = drops.spawns;
        world.disableInsideSolid(drops.physics, drops.solids);
      }
      if (!relink) return world;
      // Jump links must start and end on the mesh: snap them to it, then build again with the links in.
      const onMesh = links.flatMap((l) => {
        // Lift links say how far to look (level with the platform's stop, so the far end isn't snapped back onto the platform below).
        const start = world.closestPoint(l.start, l.reach ?? { x: 1.5, y: 2, z: 1.5 });
        const end = world.closestPoint(l.end, l.reach ?? { x: 2.5, y: 3, z: 2.5 });
        return start && end ? [{ start, end }] : [];
      });
      // Ways down off patches that have none (on the mesh already: an edge of the patch, a polygon below).
      const exits = drops ? trapExits(world, drops.physics, drops.spawns, onMesh, drops) : [];
      if (!onMesh.length && !exits.length) return world;
      const all = [...onMesh, ...exits];
      const navMesh = withLinks(inter, all);
      world.destroy();
      const built = new NavWorld(navMesh, new NavMeshQuery(navMesh, { maxNodes: MAX_NODES }));
      if (drops) {
        built.spawnSeeds = drops.spawns;
        built.disableInsideSolid(drops.physics, drops.solids);
      }
      built.drops = exits.length;
      return built;
    } finally {
      if (relink) freeIntermediates(inter);
    }
  }

  /** Ledge-drop links the build added (NavWorld.build `drops`). */
  drops = 0;
  /** Polygons the build found inside something solid and left out (disableInsideSolid). */
  insideSolid = 0;

  /**
   * Recast rasterizes surfaces, not volumes: inside a closed box at least a body's height tall (a stack of 2 m rock
   * blocks, a thick wall) the floor reads as open ground, and the navmesh gets patches inside solid rock (Eagle
   * Spires' spires: one at every block, 2 m apart, 7,000 m² in all). Falls and goals snapped onto them, and the audit
   * saw traps there. Each ground polygon with no room to stand at its middle (the level, or one of `solids`, in the
   * way) gets flags 0, which every route search and nearest-polygon lookup leaves out. At build, before anything else
   * reads the navmesh.
   */
  disableInsideSolid(physics: PhysicsWorld, solids: readonly WorldBox[] = []): number {
    const g = this.graph();
    const { centre } = polyShapes(g);
    let n = 0;
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0) continue;
      const c = { x: centre[i * 3]!, y: centre[i * 3 + 1]! + 1, z: centre[i * 3 + 2]! };
      const half = { x: 0.2, y: 0.6, z: 0.2 };
      const solid = !physics.boxClear(c, half) || solids.some((b) => !b.yaw && c.x + half.x > b.min[0] && c.x - half.x < b.max[0] && c.y + half.y > b.min[1] && c.y - half.y < b.max[1] && c.z + half.z > b.min[2] && c.z - half.z < b.max[2]);
      if (!solid) continue;
      this.navMesh.setPolyFlags(g.base + i, 0);
      g.flags[i] = 0;
      n++;
    }
    this.insideSolid = n;
    return n;
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
  findPath(a: Vec3, b: Vec3, shut = 0, partial = false): Vec3[] | null {
    if (!simProfile.on) return this.findPathNow(a, b, shut, partial);
    const t0 = performance.now();
    const r = this.findPathNow(a, b, shut, partial);
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

  /**
   * `partial`: a route that exists but that the search ran out of nodes on (a very long way over a big map) comes
   * back as far as the search got, Detour's partial route: walk it, and ask again from its end.
   */
  private findPathNow(a: Vec3, b: Vec3, shut = 0, partial = false): Vec3[] | null {
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
    // One part, and still no route (one-way links: down off a ledge by its drop link, never back up): no search either.
    const base = this.graph().base;
    if (!this.routable(s.nearestRef - base, e.nearestRef - base)) {
      if (simProfile.on) simProfile.count('navSearchFail');
      return null;
    }
    const failKey = `${s.nearestRef}:${e.nearestRef}:${shut}`;
    if (!partial && this.noRoute.has(failKey)) return null;
    const r = this.query.findPath(s.nearestRef, e.nearestRef, start, end, shut ? { maxPathPolys: MAX_PATH_POLYS, filter: this.filterFor(shut) } : { maxPathPolys: MAX_PATH_POLYS });
    const n = r.polys.size;
    // A partial path (destination unreachable, or the search ran out of nodes) ends short of the goal.
    const whole = r.success && n > 0 && r.polys.get(n - 1) === e.nearestRef;
    if (simProfile.on) simProfile.count(whole ? 'navSearch' : 'navSearchFail');
    if (!whole && partial && r.success && n > 1) {
      // The corridor as far as it got: routable (above) and no doors kept out, the search ran out of nodes; with doors
      // kept out (`shut`), the way to as near the goal as it gets this side of them.
      const c = this.query.closestPointOnPoly(r.polys.get(n - 1), end);
      const sp = c.success ? this.query.findStraightPath(start, c.closestPoint, r.polys, { maxStraightPathPoints: MAX_CORNERS }) : null;
      r.polys.destroy();
      const out: Vec3[] = [];
      if (sp?.success) for (let i = 0; i < sp.straightPathCount; i++) out.push({ x: sp.straightPath.get(i * 3), y: sp.straightPath.get(i * 3 + 1), z: sp.straightPath.get(i * 3 + 2) });
      if (sp) {
        sp.straightPath.destroy();
        sp.straightPathFlags.destroy();
        sp.straightPathRefs.destroy();
      }
      return out.length > 1 ? out : null;
    }
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
    // (Not on polygons left out as inside something solid: disableInsideSolid.)
    if (this.insideSolid) this.placeCache = this.placeCache.filter((p) => !!this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } }).nearestRef);
    // The navmesh's parts and the places' parts too: worked out here, at setup (the match asks for the places
    // when bots join), rather than in a tick (about 15 ms and 10–30 ms on a big map).
    this.partsNow();
    this.placePartsNow();
    // Route reachability too (routable, standIn: the graph and its components, a few ms).
    this.routesNow();
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
          // (Never one left out as inside something solid: flags 0, disableInsideSolid.)
          if (this.insideSolid && f.flags === 0) continue;
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

  private graphCache: NavGraph | null = null;

  /**
   * The navmesh as a graph (the navigation audit, nav/audit.ts; drop links at build): every polygon's corners, its
   * edges with no neighbour (where the walkable ground ends: a wall, a ledge, a step too high), and Detour's own
   * links between polygons, one way (an off-mesh link is a polygon of its own, entered from its start's polygon
   * and left to its end's). Read once, on first use, from the navmesh's single tile (empty for any other).
   */
  graph(): NavGraph {
    if (this.graphCache) return this.graphCache;
    const mesh = this.navMesh;
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const header = tile?.header();
    const n = header?.polyCount() ?? 0;
    const empty: NavGraph = { count: 0, base: 0, type: new Uint8Array(0), vstart: new Int32Array(1), vxyz: new Float32Array(0), open: new Uint8Array(0), linkStart: new Int32Array(1), links: new Int32Array(0), flags: new Uint16Array(0) };
    if (!tile || !header || !n) return (this.graphCache = empty);
    const base = mesh.getPolyRefBase(tile);
    const tileVerts = header.vertCount();
    const tv = new Float32Array(tileVerts * 3);
    for (let i = 0; i < tv.length; i++) tv[i] = tile.verts(i);
    const type = new Uint8Array(n);
    const flags = new Uint16Array(n);
    const vstart = new Int32Array(n + 1);
    const open = new Uint8Array(n);
    const coords: number[] = [];
    const linkStart = new Int32Array(n + 1);
    const links: number[] = [];
    for (let i = 0; i < n; i++) {
      const poly = tile.polys(i);
      type[i] = poly.getType();
      flags[i] = poly.flags();
      const vc = poly.vertCount();
      vstart[i] = coords.length / 3;
      let bits = 0;
      for (let j = 0; j < vc; j++) {
        const v = poly.verts(j) * 3;
        coords.push(tv[v]!, tv[v + 1]!, tv[v + 2]!);
        if (type[i] === 0 && poly.neis(j) === 0) bits |= 1 << j;
      }
      open[i] = bits;
      linkStart[i] = links.length;
      // DT_NULL_LINK ends a polygon's links (bounded, in case of a bad list).
      for (let l = poly.firstLink(), k = 0; l !== 0xffffffff && l >= 0 && k < 64; k++) {
        const link = tile.links(l);
        const j = link.ref() - base;
        if (j >= 0 && j < n && j !== i) links.push(j);
        l = link.next();
      }
    }
    vstart[n] = coords.length / 3;
    linkStart[n] = links.length;
    return (this.graphCache = { count: n, base, type, vstart, vxyz: Float32Array.from(coords), open, linkStart, links: Int32Array.from(links), flags });
  }

  /**
   * Route reachability, exact (one-way links count one way): each polygon's component of routes (polygons that all
   * route to each other), the biggest one, and what routes from it reach. Worked out once, on first use (a few ms).
   */
  private routesCache: { comp: Int32Array; main: number; fromMain: Uint8Array; start: Int32Array; to: Int32Array } | null = null;
  /** What routes reach from each component asked about (by component; the main one is routesCache.fromMain). */
  private readonly reachFrom = new Map<number, Uint8Array>();

  private routesNow(): { comp: Int32Array; main: number; fromMain: Uint8Array; start: Int32Array; to: Int32Array } {
    if (this.routesCache) return this.routesCache;
    const g = this.graph();
    const seeds = this.spawnSeeds.flatMap((p) => {
      const r = this.query.findNearestPoly(p, { halfExtents: { x: 1, y: 1, z: 1 } });
      return r.success && r.nearestRef ? [r.nearestRef - g.base] : [];
    });
    const r = routeComponents(g, seeds);
    return (this.routesCache = r);
  }

  /** Spawn points (the build's `drops.spawns`): they say which component of routes is the main area. */
  spawnSeeds: readonly Vec3[] = [];

  private mainPlacesCache: Vec3[] | null = null;

  /**
   * places() in the main area: those routes from it reach and that route back to it (not a roof nobody gets onto,
   * a pit nobody gets out of): where bots pick goals, squads regions, campers and snipers their spots.
   */
  mainPlaces(): readonly Vec3[] {
    if (this.mainPlacesCache) return this.mainPlacesCache;
    const places = this.places();
    const r = this.routesNow();
    if (r.main < 0) return (this.mainPlacesCache = [...places]);
    const toMain = this.toMainNow();
    const out: Vec3[] = [];
    for (const p of places) {
      const hit = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      const i = hit.success && hit.nearestRef ? hit.nearestRef - this.graph().base : -1;
      if (i >= 0 && r.fromMain[i] && toMain[i]) out.push(p);
    }
    // (A navmesh with no main area to speak of: every place.)
    return (this.mainPlacesCache = out.length ? out : [...places]);
  }

  private toMainCache: Uint8Array | null = null;

  /** Polygons that route to the main area. */
  private toMainNow(): Uint8Array {
    if (this.toMainCache) return this.toMainCache;
    const r = this.routesNow();
    const n = r.comp.length;
    // Reverse the edges once.
    const deg = new Int32Array(n + 1);
    for (let k = 0; k < r.to.length; k++) deg[r.to[k]! + 1]!++;
    for (let i = 0; i < n; i++) deg[i + 1]! += deg[i]!;
    const fill = deg.slice(0, n);
    const to = new Int32Array(r.to.length);
    for (let a = 0; a < n; a++) for (let k = r.start[a]!; k < r.start[a + 1]!; k++) to[fill[r.to[k]!]!++] = a;
    const seeds: number[] = [];
    for (let i = 0; i < n; i++) if (r.comp[i] === r.main) seeds.push(i);
    return (this.toMainCache = reachSet(deg, to, n, seeds));
  }

  /** Whether `p` (on or near the navmesh) routes to the main area and is routed to from it. */
  inMain(p: Vec3): boolean {
    const s = this.nearestPoly(p);
    if (!s) return false;
    const r = this.routesNow();
    return r.fromMain[s.index] === 1 && this.toMainNow()[s.index] === 1;
  }

  /** What routes from polygon `i`'s component reach (cached per component; at most 256 kept). */
  private reachOf(i: number): Uint8Array {
    const r = this.routesNow();
    const c = r.comp[i]!;
    if (c === r.main) return r.fromMain;
    let seen = this.reachFrom.get(c);
    if (seen) return seen;
    seen = reachSet(r.start, r.to, r.comp.length, [i]);
    if (this.reachFrom.size >= 256) this.reachFrom.clear();
    this.reachFrom.set(c, seen);
    return seen;
  }

  /** Whether a route can exist from polygon `a` to polygon `b` (graph indices): no search, a lookup. */
  routable(a: number, b: number): boolean {
    const r = this.routesNow();
    if (a < 0 || b < 0 || a >= r.comp.length || b >= r.comp.length) return false;
    return r.comp[a] === r.comp[b] || this.reachOf(a)[b] === 1;
  }

  /** Whether a route can exist from `a` to `b` (each on or near the navmesh; false off it). */
  reachable(a: Vec3, b: Vec3): boolean {
    const s = this.nearestPoly(a);
    const e = this.nearestPoly(b);
    return !!s && !!e && this.routable(s.index, e.index);
  }

  private readonly standInCache = new Map<string, Vec3 | null>();

  /**
   * Where to head for `goal` from `from`: the goal itself when a route reaches it (exact), else the place nearest it
   * that a route from `from` does reach (a flag on a ledge: below it; a pickup on a crate: beside it; a goal on a
   * roof: under it), remembered per component of routes and goal polygon for the match (no search for it ever
   * again). Null when `from` is off the navmesh, or nothing routes anywhere from there.
   */
  standIn(from: Vec3, goal: Vec3): { pos: Vec3; exact: boolean } | null {
    const s = this.nearestPoly(from);
    if (!s) return null;
    const e = this.nearestPoly(goal);
    if (e && this.routable(s.index, e.index)) return { pos: goal, exact: true };
    const r = this.routesNow();
    const key = `${r.comp[s.index]}>${e ? e.index : `${Math.round(goal.x)},${Math.round(goal.y)},${Math.round(goal.z)}`}`;
    let pos = this.standInCache.get(key);
    if (pos === undefined) {
      pos = this.nearestRoutable(s.index, goal);
      if (this.standInCache.size >= 2048) this.standInCache.clear();
      this.standInCache.set(key, pos);
    }
    return pos ? { pos, exact: false } : null;
  }

  /** The point nearest `goal` (height counts double) on a polygon routes from polygon `from` reach. */
  private nearestRoutable(from: number, goal: Vec3): Vec3 | null {
    const g = this.graph();
    const seen = this.reachOf(from);
    const comp = this.routesNow().comp;
    const { centre } = polyShapes(g);
    // The few nearest by their middles, then the nearest point on each of those.
    const best: { i: number; d: number }[] = [];
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0 || !(seen[i] || comp[i] === comp[from])) continue;
      const d = hypot(centre[i * 3]! - goal.x, centre[i * 3 + 2]! - goal.z) + Math.abs(centre[i * 3 + 1]! - goal.y) * 2;
      if (best.length < 6 || d < best[best.length - 1]!.d) {
        best.push({ i, d });
        best.sort((a, b) => a.d - b.d || a.i - b.i);
        if (best.length > 6) best.pop();
      }
    }
    let out: Vec3 | null = null;
    let outD = Infinity;
    for (const { i } of best) {
      const c = this.query.closestPointOnPoly(g.base + i, goal);
      if (!c.success) continue;
      const p = c.closestPoint;
      const d = hypot(p.x - goal.x, p.z - goal.z) + Math.abs(p.y - goal.y) * 2;
      if (d < outD) {
        outD = d;
        out = { x: p.x, y: p.y, z: p.z };
      }
    }
    return out;
  }

  /**
   * Off the navmesh (pushed or fallen onto ground it doesn't cover, a narrow ledge, spawned badly): the nearest place
   * on it to walk to, level or below (a body can step or drop down, not climb), within a few metres; null when
   * `p` is on the navmesh (or nothing is near).
   */
  wayOnto(p: Vec3): Vec3 | null {
    if (this.query.findNearestPoly(p, { halfExtents: { x: 2, y: 3, z: 2 } }).nearestRef) return null;
    // Close by first; then further and further down (a cliff face or a ledge high over the ground: off it, down).
    for (const [r, down] of [
      [6, 6],
      [12, 30],
      [24, 60],
    ] as const) {
      const hit = this.query.findNearestPoly({ x: p.x, y: p.y - down / 2 + 0.3, z: p.z }, { halfExtents: { x: r, y: down / 2 + 0.3, z: r } });
      if (hit.success && hit.nearestRef && hit.nearestPoint.y < p.y + 0.6) return { ...hit.nearestPoint };
    }
    return null;
  }

  /** The polygon (index into graph()) nearest `p` within `halfExtents`, and the nearest point on it; null off the navmesh. */
  nearestPoly(p: Vec3, halfExtents: Vec3 = { x: 2, y: 3, z: 2 }): { index: number; point: Vec3; over: boolean } | null {
    const r = this.query.findNearestPoly(p, { halfExtents });
    if (!r.success || !r.nearestRef) return null;
    const index = r.nearestRef - this.graph().base;
    return { index, point: { ...r.nearestPoint }, over: r.isOverPoly };
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
   * than legs are: it keeps 0.8 m from walls where a body needs 0.4, and a step under a low roof, a narrow
   * gap or a slab edge a hair over the step height can leave a patch players walk off with no route out of it
   * (Capitol Mall's reflecting pool; Diamond Park's dugouts, three spawn points each, until their roofs were
   * raised in the map). For a point on a smaller part of
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
 *
 * With `physics` (the level's colliders) ziplines are checked too: cable and riders clear of the level, ground to grab
 * them from and to land on, and both ends on ground the navmesh reaches; and spawn points inside something solid.
 * With `audit` (the map's fall rules: sim/mapNav.ts dropOptions) the navigation audit (audit.ts) replaces the
 * reachability checks from the first spawn: traps, spawn points, objectives and pickups cut off, from every polygon.
 * `official` (maps/: validate-map, the all-maps test) makes its findings and blocked spawn points errors; creators in
 * MapMaker get warnings.
 */
export function validateNavigation(map: MapDocument, nav: NavWorld, physics?: PhysicsWorld, audit?: AuditOptions): ValidationIssue[] {
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
  if (physics && audit) issues.push(...(audit.done ?? auditNavigation(map, nav, physics, audit)).issues);
  else if (first) {
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
    // A spawn point inside something solid (a tile's stairs, a wall, a prop): whoever spawns there can't move. (Sandfall
    // Colosseum's spawn_269 stood in the stand's steps: a bot spawned there stood all match.)
    for (const s of spawns) {
      if (!physics.boxClear({ x: s.position[0], y: s.position[1] + 1, z: s.position[2] }, { x: 0.25, y: 0.5, z: 0.25 })) {
        issues.push({ severity: audit?.official ? 'error' : 'warning', code: 'spawn.blocked', message: `spawn ${s.id} is inside something solid: whoever spawns there can't move`, targetId: s.id });
      }
    }
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
