import { getNavMeshPositionsAndIndices, init as initRecast, NavMeshQuery, UnsignedIntArray, type NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';
import { boxesToTriangles, type WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import type { ValidationIssue } from '../map/validate.ts';
import type { Vec3 } from '../math.ts';
import { PLAYER } from '../sim/constants.ts';
import { trackGeometry } from '../map/track.ts';
import { mapPortals, portalEntry, PORTAL_EXIT } from '../sim/portals.ts';
import { simProfile } from '../sim/profile.ts';

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
/** Corridors kept for reuse (NavWorld.findPath) before the cache starts over. */
const MAX_CORRIDORS = 512;

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

  /** Straight-path corners from a to b, or null if b is unreachable from a. */
  findPath(a: Vec3, b: Vec3): Vec3[] | null {
    if (!simProfile.on) return this.findPathNow(a, b);
    const t0 = performance.now();
    const r = this.findPathNow(a, b);
    simProfile.add('nav', performance.now() - t0);
    simProfile.count('nav');
    if (!r) simProfile.count('navFail');
    return r;
  }

  /**
   * Polygon corridors found lately, by destination polygon: a bot whose start
   * polygon lies on one takes its tail (the rest of a shortest path is the
   * shortest path from there), so a team heading for the same place shares
   * one search. Routes that don't exist are remembered by start and end
   * polygon. The navmesh never changes under a NavWorld, so both stay right.
   */
  private readonly corridors = new Map<number, { polys: Uint32Array; at: Map<number, number> }[]>();
  private corridorCount = 0;
  private readonly noRoute = new Set<string>();

  private findPathNow(a: Vec3, b: Vec3): Vec3[] | null {
    const ext = { x: 2, y: 3, z: 2 };
    const s = this.query.findNearestPoly(a, { halfExtents: ext });
    const e = this.query.findNearestPoly(b, { halfExtents: ext });
    if (!s.success || !e.success || !s.nearestRef || !e.nearestRef) return null;
    const start = s.nearestPoint;
    const end = e.nearestPoint;
    const failKey = `${s.nearestRef}:${e.nearestRef}`;
    if (this.noRoute.has(failKey)) return null;
    let polys = this.cachedCorridor(s.nearestRef, e.nearestRef);
    if (!polys) {
      const r = this.query.findPath(s.nearestRef, e.nearestRef, start, end, { maxPathPolys: MAX_PATH_POLYS });
      const n = r.polys.size;
      // A partial path (destination unreachable, or the search ran out of nodes) ends short of the goal.
      polys = r.success && n > 0 && r.polys.get(n - 1) === e.nearestRef ? r.polys.toTypedArray().slice(0, n) : null;
      r.polys.destroy();
      if (simProfile.on) simProfile.count(polys ? 'navSearch' : 'navSearchFail');
      if (!polys) {
        if (this.noRoute.size >= 4096) this.noRoute.clear();
        this.noRoute.add(failKey);
        return null;
      }
      this.remember(e.nearestRef, polys);
    }
    const corridor = new UnsignedIntArray();
    corridor.copy(polys);
    const sp = this.query.findStraightPath(start, end, corridor, { maxStraightPathPoints: MAX_CORNERS });
    corridor.destroy();
    const out: Vec3[] = [];
    if (sp.success) {
      const v = sp.straightPath;
      for (let i = 0; i < sp.straightPathCount; i++) out.push({ x: v.get(i * 3), y: v.get(i * 3 + 1), z: v.get(i * 3 + 2) });
    }
    sp.straightPath.destroy();
    sp.straightPathFlags.destroy();
    sp.straightPathRefs.destroy();
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - end.x, last.z - end.z) > 0.5 || Math.abs(last.y - end.y) > 1) return null;
    return out;
  }

  /** The tail of a remembered corridor to `endRef` that passes through `startRef`. */
  private cachedCorridor(startRef: number, endRef: number): Uint32Array | null {
    const list = this.corridors.get(endRef);
    if (!list) return null;
    for (const c of list) {
      const i = c.at.get(startRef);
      if (i !== undefined) return c.polys.subarray(i);
    }
    return null;
  }

  private remember(endRef: number, polys: Uint32Array): void {
    // Short hops are cheap to search again.
    if (polys.length < 8) return;
    if (this.corridorCount >= MAX_CORRIDORS) {
      this.corridors.clear();
      this.corridorCount = 0;
    }
    let list = this.corridors.get(endRef);
    if (!list) this.corridors.set(endRef, (list = []));
    const at = new Map<number, number>();
    polys.forEach((p, i) => {
      if (!at.has(p)) at.set(p, i);
    });
    list.push({ polys, at });
    this.corridorCount++;
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
        const d = Math.hypot(p.x - (cx + 0.5) * PLACE_CELL, p.z - (cz + 0.5) * PLACE_CELL);
        const prev = best.get(key);
        if (!prev || d < prev.d) best.set(key, { p, d });
      }
    }
    this.placeCache = [...best.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v.p);
    return this.placeCache;
  }

  destroy(): void {
    this.query.destroy();
    this.navMesh.destroy();
  }
}

/**
 * Navigation checks for the validator: every spawn must be on the navmesh and
 * all spawns must reach each other, otherwise bots (and players) get stranded.
 */
export function validateNavigation(map: MapDocument, nav: NavWorld): ValidationIssue[] {
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
      if (!end || Math.hypot(end.x - to.x, end.z - to.z) > 1.5 || Math.abs(end.y - to.y) > 2) {
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
