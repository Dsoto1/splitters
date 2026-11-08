import { createNavMeshData, freeCompactHeightfield, freeContourSet, freeHeightfield, freePolyMesh, freePolyMeshDetail, getNavMeshPositionsAndIndices, init as initRecast, NavMesh, NavMeshCreateParams, NavMeshQuery, QueryFilter } from 'recast-navigation';
import { boxesToTriangles, type WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import type { ValidationIssue } from '../map/validate.ts';
import type { Vec3 } from '../math.ts';
import { BODY_SIZES, LIFT_FLAG, OPENING_BITS, PLAYER } from '../sim/constants.ts';
import { trackGeometry } from '../map/track.ts';
import { mapPortals, portalEntry, PORTAL_EXIT } from '../sim/portals.ts';
import { mapZiplines, ziplineClearanceIssues, ziplineLinks } from '../sim/zipline.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import type { Aabb, OBox } from '../sim/scenarioDefs.ts';
import { simProfile } from '../sim/profile.ts';
import { hypot } from '../math.ts';
import { auditNavigation, edgesOf, polyShapes, reachSet, routeComponents, trapExits, type AuditOptions, type FallOptions } from './audit.ts';
import { PARKOUR_AREA, parkourLinks, type ParkourLink } from './parkour.ts';
import { generateSolo, LOW_AREA, type LowHeadroom, type SoloIntermediates } from './solo.ts';

export { LOW_AREA } from './solo.ts';

/** Ledge-drop links at build (NavWorld.build `drops`): the level to trace falls against, and the spawn points that say where the main area is. */
export interface DropOptions extends FallOptions {
  physics: PhysicsWorld;
  spawns: readonly Vec3[];
  /** The match's gravity (a multiple), for parkour links played through stepMovement; 1 when absent. */
  gravity?: number;
  /** No parkour links (nav/parkour.ts): the build as before them. */
  noParkour?: boolean;
  /**
   * What the scenario adds to the level after the navmesh that a body can't pass while it stands (window panes, door
   * panels, breakable walls and boards): parkour links are played through with them in the way.
   */
  blockers?: readonly OBox[];
}

let initPromise: Promise<void> | undefined;

/** Load the Recast WASM module once. Safe to call repeatedly. */
export function initNavigation(): Promise<void> {
  initPromise ??= initRecast();
  return initPromise;
}

const CELL = 0.2;
const CELL_HEIGHT = 0.05;
/**
 * The navmesh's clearance from walls and edges, in cells: 0.8 m, the body's radius and 0.4 m (corner-cutting bots don't
 * snag door frames). The code once meant 0.6 m (the radius and 0.2: Math.ceil((0.4 + 0.2) / 0.2) is four cells, as
 * (0.4 + 0.2) / 0.2 is 3.0000000000000004 in floating point), but every tile's stairs, towers and doorways were built
 * and tested against 0.8, and 0.6 is worse there: Recast splits the narrow switchback flights of the watch towers (Desert,
 * Jungle, Medieval, Snow) and the Desert outside stair into scraps it drops, so their lookouts (sniper perches on Qasr
 * Medina, Market Town, Whiteout Station, Vinefall Sanctum) were cut off (the tile packs' reach tests, nine of them, and
 * the navigation audit); the CTF suite's scorecard was mixed (docs/BOTS.md, "Navmesh clearance").
 */
const NAV_RADIUS_CELLS = 4;
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
 * The highest ledge a crossing off a cut-off patch goes up (m): a jump clears about 1.1 m, a jump with the legs tucked
 * up in the air (crouch while airborne, as players do; brain.ts tuckHop) about 1.5 (Undergate Transit's track beds,
 * 1.4 m down).
 */
export const ESCAPE_RISE = 1.4;

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

/**
 * Open ground (NavWorld.markExposure): its navmesh area, how far (m) round a polygon's middle cover must be for it not
 * to count, and what crossing it costs a route by how much the bot prefers cover (findPath `open`: 0 Arena, 1 Mixed,
 * 2 Tactical).
 */
export const OPEN_AREA = 1;
const EXPOSED_REACH = 3;
const OPEN_COST = [1, 1.2, 1.45];
/**
 * A parkour link's cost (nav/parkour.ts, area PARKOUR_AREA) a metre, over walking's: bots walk unless the move saves
 * a real walk; agile ones (findPath `agile`: flankers, snipers, the Arena style) take it at walking's cost.
 */
const PARKOUR_COST = 1.6;
/**
 * Low headroom (nav/solo.ts LOW_AREA): ground with less room over it than a large body stands in (1.18 × 1.8 m, and
 * 5 cm), and a large body's radius round it. A tall body's route (findPath `tall`) prices it at LOW_COST a metre:
 * any way round that isn't hundreds of times longer is taken first, so a tall bot goes under a low roof only where
 * nothing else gets there (then it crouches through: brain.ts lowRoute).
 */
const LOW_HEADROOM: LowHeadroom = { height: BODY_SIZES.large.scale * PLAYER.height + 0.05, reach: 0.4 };
const LOW_COST = 1000;
/** Bodies taller than the navmesh's (size over this multiple of the 1.8 m standard) route as tall (findPath `tall`). */
export const TALL_SIZE = 1.02;
const FOUR = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

/** Recast's settings for the bots' navmesh (NavWorld.build). */
const RECAST_CONFIG = {
  cs: CELL,
  ch: CELL_HEIGHT,
  walkableSlopeAngle: PLAYER.maxSlopeDegrees,
  walkableHeight: Math.ceil(PLAYER.height / CELL_HEIGHT),
  // Round, not floor: 0.3 / 0.05 is 5.999… in floating point, which would reject 0.25 m steps at some heights.
  walkableClimb: Math.round(PLAYER.maxStepHeight / CELL_HEIGHT),
  // Clearance beyond the capsule radius so corner-cutting bots do not snag door frames (NAV_RADIUS_CELLS: 0.8 m).
  walkableRadius: NAV_RADIUS_CELLS,
  maxEdgeLen: 12 / CELL,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
} as const;

const offMesh = (l: { start: Vec3; end: Vec3; area?: number }) => ({ startPosition: l.start, endPosition: l.end, radius: 0.8, bidirectional: false, area: l.area ?? 0 });

type Intermediates = SoloIntermediates;

/**
 * A navmesh of the first build's polygons with `links` in: Detour's tile data made again from Recast's polygon and
 * detail meshes, as generateSoloNavMesh's last step makes it (its polygons' areas and flags are already set).
 */
function withLinks(inter: Intermediates, links: readonly { start: Vec3; end: Vec3; area?: number }[]): NavMesh {
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
    const result = generateSolo(positions, indices, { ...RECAST_CONFIG, offMeshConnections: (snapped ? links : []).map(offMesh) }, relink, LOW_HEADROOM);
    if (!result.success) throw new Error(`navmesh generation failed: ${result.error}`);
    const lowSpans = result.low;
    const inter = result.intermediates;
    try {
      const world = new NavWorld(result.navMesh, new NavMeshQuery(result.navMesh, { maxNodes: MAX_NODES }));
      if (drops) {
        world.spawnSeeds = drops.spawns;
        world.disableInsideSolid(drops.physics, drops.solids);
      }
      // (Exposed ground on the world returned only: the first is rebuilt with its links when it has any.)
      const done = (w: NavWorld) => {
        w.lowSpans = lowSpans;
        if (drops) w.markExposure(drops.physics);
        return w;
      };
      if (!relink) return done(world);
      // Jump links must start and end on the mesh: snap them to it, then build again with the links in.
      const onMesh = links.flatMap((l) => {
        // Lift links say how far to look (level with the platform's stop, so the far end isn't snapped back onto the platform below).
        const start = world.closestPoint(l.start, l.reach ?? { x: 1.5, y: 2, z: 1.5 });
        const end = world.closestPoint(l.end, l.reach ?? { x: 2.5, y: 3, z: 2.5 });
        return start && end ? [{ start, end }] : [];
      });
      // Parkour (nav/parkour.ts): drops, gap jumps and jumps up a player makes, played through the movement code.
      const parkour = drops && !drops.noParkour ? parkourLinks(world, drops.physics, drops, drops.gravity ?? 1, linkPairs(world, onMesh), drops.spawns) : [];
      // Ways down off patches that have none (on the mesh already: an edge of the patch, a polygon below).
      const exits = drops ? trapExits(world, drops.physics, drops.spawns, [...onMesh, ...parkour], drops) : [];
      if (!onMesh.length && !exits.length && !parkour.length) return done(world);
      const all = [...onMesh, ...parkour.map((l) => ({ start: l.start, end: l.end, area: PARKOUR_AREA })), ...exits];
      const walkOnly = parkour.length ? world.walkOnlyFromMain(drops!.spawns, onMesh) : null;
      const navMesh = withLinks(inter, all);
      world.destroy();
      const built = new NavWorld(navMesh, new NavMeshQuery(navMesh, { maxNodes: MAX_NODES }));
      if (drops) {
        built.spawnSeeds = drops.spawns;
        built.disableInsideSolid(drops.physics, drops.solids);
      }
      built.drops = exits.length;
      built.setParkour(parkour, walkOnly);
      return done(built);
    } finally {
      if (relink) freeIntermediates(inter);
    }
  }

  /** Ledge-drop links the build added (NavWorld.build `drops`). */
  drops = 0;

  /** Walkable cells of low headroom the build marked (nav/solo.ts LOW_AREA; 0: no polygon is low). */
  lowSpans = 0;
  private lowCache: Uint8Array | null = null;

  /** Ground polygons under low headroom (LOW_AREA), by graph index. */
  private lowPolys(): Uint8Array {
    if (this.lowCache) return this.lowCache;
    const g = this.graph();
    const out = new Uint8Array(g.count);
    if (this.lowSpans) for (let i = 0; i < g.count; i++) if (g.type[i] === 0 && this.navMesh.getPolyArea(g.base + i).area === LOW_AREA) out[i] = 1;
    return (this.lowCache = out);
  }

  /** Whether ground polygon `i` (graph index) is under low headroom. */
  lowAt(i: number): boolean {
    return this.lowSpans > 0 && this.lowPolys()[i] === 1;
  }

  /** Low ground polygons, how many (and their area, m²). */
  lowCount(): { polys: number; area: number } {
    const low = this.lowPolys();
    const { area } = polyShapes(this.graph());
    let n = 0;
    let m2 = 0;
    for (let i = 0; i < low.length; i++) {
      if (!low[i]) continue;
      n++;
      m2 += area[i] ?? 0;
    }
    return { polys: n, area: m2 };
  }

  /**
   * Whether the last route findPath found for a tall body (`tall`) goes under low headroom: no way round it (or it
   * starts or ends there). The bot crouches through those polygons (brain.ts lowRoute).
   */
  lastLow = false;
  /** Tall routes that had to go under low headroom (lastLow), and tall routes asked for, in the match (measuring). */
  lowRoutes = 0;
  tallRoutes = 0;
  /** Start and end polygons whose tall route went under low headroom: asked again, the plain search at once. */
  private readonly lowForced = new Set<string>();

  /** Parkour links the build added (nav/parkour.ts), and a lookup of them by where they start (2 m cells). */
  parkour: readonly ParkourLink[] = [];
  private readonly parkourCells = new Map<number, ParkourLink[]>();
  /** Ground polygons walking (and the map's own links) reach from the spawns without parkour; null without parkour. */
  private walkReach: Uint8Array | null = null;

  /** At build: the parkour links, and what walking reaches without them. */
  setParkour(links: readonly ParkourLink[], walkReach: Uint8Array | null): void {
    this.parkour = links;
    this.walkReach = walkReach;
    this.parkourCells.clear();
    for (const l of links) {
      const k = cellKey(Math.floor(l.start.x / 2), Math.floor(l.start.z / 2));
      (this.parkourCells.get(k) ?? this.parkourCells.set(k, []).get(k)!).push(l);
    }
  }

  /** Times bots missed each parkour link (landed somewhere else: knocked off it, short). */
  private readonly linkMisses = new Map<ParkourLink, number>();
  /** Parkour links switched off in the match (linkFailed). */
  linksOff = 0;

  /**
   * A bot gave up on a parkour link (it couldn't start or finish it: something the build didn't have in the way), or
   * missed it (`gaveUp` false). Given up on, or missed three times, the link is switched off for everyone for the match:
   * its navmesh polygon's flags to 0 (no route takes it), out of the lookup, and bots plan their routes again.
   */
  linkFailed(l: ParkourLink, gaveUp: boolean): void {
    const misses = (this.linkMisses.get(l) ?? 0) + 1;
    this.linkMisses.set(l, misses);
    if (!gaveUp && misses < 3) return;
    const list = this.parkourCells.get(cellKey(Math.floor(l.start.x / 2), Math.floor(l.start.z / 2)));
    const at = list?.indexOf(l) ?? -1;
    if (at < 0) return;
    list!.splice(at, 1);
    const mesh = this.navMesh;
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const header = tile?.header();
    if (!tile || !header) return;
    const base = mesh.getPolyRefBase(tile);
    for (let i = 0; i < header.offMeshConCount(); i++) {
      const con = tile.offMeshCons(i);
      if (hypot(con.pos(0) - l.start.x, con.pos(2) - l.start.z) > 0.35 || Math.abs(con.pos(1) - l.start.y) > 0.5) continue;
      if (hypot(con.pos(3) - l.end.x, con.pos(5) - l.end.z) > 0.35 || Math.abs(con.pos(4) - l.end.y) > 0.5) continue;
      mesh.setPolyFlags(base + con.poly(), 0);
    }
    this.linksOff++;
    this.noRoute.clear();
    this.goneVersion++;
  }

  /** The parkour link a route's leg from `a` to `b` takes (its corners at the link's start and end), or null. */
  parkourAt(a: Vec3, b: Vec3): ParkourLink | null {
    if (!this.parkour.length) return null;
    const cx = Math.floor(a.x / 2);
    const cz = Math.floor(a.z / 2);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.parkourCells.get(cellKey(cx + dx, cz + dz));
        if (!list) continue;
        for (const l of list) if (hypot(l.start.x - a.x, l.start.z - a.z) < 0.35 && Math.abs(l.start.y - a.y) < 0.5 && hypot(l.end.x - b.x, l.end.z - b.z) < 0.35 && Math.abs(l.end.y - b.y) < 0.5) return l;
      }
    }
    return null;
  }

  /**
   * Walking (and the map's own links, `links`) from the spawn points, before any parkour link goes in: what each ground
   * polygon of this (first) build is reached by. The rebuilt navmesh keeps the same ground polygons, in the same order.
   */
  walkOnlyFromMain(spawns: readonly Vec3[], links: readonly { start: Vec3; end: Vec3 }[]): Uint8Array {
    const g = this.graph();
    const seeds = spawns.flatMap((p) => {
      const h = this.nearestPoly(p, { x: 1, y: 1, z: 1 });
      return h ? [h.index] : [];
    });
    const e = edgesOf(g, linkPairs(this, links));
    return reachSet(e.start, e.to, g.count, seeds);
  }

  private parkourPlaceCache: Vec3[] | null = null;

  /**
   * mainPlaces() only parkour gets to (roofs and ledges a jump up or across reaches, that walking and the map's own
   * links don't): where snipers look for spots others don't go (bots/vantage.ts).
   */
  parkourPlaces(): readonly Vec3[] {
    if (this.parkourPlaceCache) return this.parkourPlaceCache;
    const walk = this.walkReach;
    if (!walk) return (this.parkourPlaceCache = []);
    const out: Vec3[] = [];
    const base = this.graph().base;
    for (const p of this.mainPlaces()) {
      const h = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      const i = h.success && h.nearestRef ? h.nearestRef - base : -1;
      if (i >= 0 && i < walk.length && !walk[i]) out.push(p);
    }
    return (this.parkourPlaceCache = out);
  }
  /** Polygons the build found inside something solid and left out (disableInsideSolid). */
  insideSolid = 0;
  /** Ground polygons in the open (markExposure), and their area. */
  exposed = 0;
  exposedArea = 0;

  /**
   * Route costs that prefer cover (BOT_AI_PLAN.md Phase B item 6): each ground polygon with nothing within EXPOSED_REACH
   * m of its middle at chest height in any of four directions (open ground: a field, a square) gets area OPEN_AREA,
   * which a route asked for with `open` costs more to cross (findPath; Tactical bots most, Arena bots not at all). Four
   * rays a polygon, at build.
   */
  markExposure(physics: PhysicsWorld): number {
    const g = this.graph();
    const { centre, area } = polyShapes(g);
    let n = 0;
    let m2 = 0;
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0 || g.flags[i] === 0) continue;
      // (Not ground under a low roof: it has a roof, and keeps its area for tall bodies' routes.)
      if (this.lowAt(i)) continue;
      const o = { x: centre[i * 3]!, y: centre[i * 3 + 1]! + 1, z: centre[i * 3 + 2]! };
      let hit = false;
      for (const d of FOUR) {
        if (physics.raycastWorld(o, d, EXPOSED_REACH) !== null) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
      this.navMesh.setPolyArea(g.base + i, OPEN_AREA);
      n++;
      m2 += area[i] ?? 0;
    }
    this.exposed = n;
    this.exposedArea = m2;
    return n;
  }

  /**
   * Recast rasterizes surfaces, not volumes: inside a closed box at least a body's height tall (a stack of 2 m rock
   * blocks, a thick wall) the floor reads as open ground, and the navmesh gets patches inside solid rock (Eagle
   * Spires' spires: one at every block, 2 m apart, 7,000 m² in all). Falls and goals snapped onto them, and the audit
   * saw traps there. Each ground polygon with no room to stand over its surface at its middle and at most of the
   * points part way to its corners (the level, or one of `solids`, in the way) gets flags 0, which every route search
   * and nearest-polygon lookup leaves out. The surface is the detail mesh's (Detour's height on the polygon), not its
   * corners' average: on terrain that is often half a metre or more off (a hollow, a rise), and the check found
   * thousands of square metres of open hillside "inside" the ground (Frost Basin 17,000 m², Iron Maw 14,000 m²).
   * At build, before anything else reads the navmesh.
   */
  disableInsideSolid(physics: PhysicsWorld, solids: readonly WorldBox[] = []): number {
    const g = this.graph();
    const { centre } = polyShapes(g);
    const half = { x: 0.2, y: 0.6, z: 0.2 };
    // No room to stand at a point of polygon i (its surface there, then a body's height up from a step over it). The
    // detail mesh's height, unless it is off the polygon's own corners' range (a sliver's: Whiteout Station's tower
    // landing read 1.7 m under itself), then the corners' average.
    const blocked = (i: number, x: number, z: number): boolean => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = g.vstart[i]!; k < g.vstart[i + 1]!; k++) {
        lo = Math.min(lo, g.vxyz[k * 3 + 1]!);
        hi = Math.max(hi, g.vxyz[k * 3 + 1]!);
      }
      const h = this.query.getPolyHeight(g.base + i, { x, y: centre[i * 3 + 1]!, z });
      const y = h.success && h.height > lo - 0.6 && h.height < hi + 0.6 ? h.height : centre[i * 3 + 1]!;
      const c = { x, y: y + 1, z };
      return !physics.boxClear(c, half) || solids.some((b) => !b.yaw && c.x + half.x > b.min[0] && c.x - half.x < b.max[0] && c.y + half.y > b.min[1] && c.y - half.y < b.max[1] && c.z + half.z > b.min[2] && c.z - half.z < b.max[2]);
    };
    let n = 0;
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0) continue;
      const cx = centre[i * 3]!;
      const cz = centre[i * 3 + 2]!;
      if (!blocked(i, cx, cz)) continue;
      // Inside something, not just a post at its middle: most points part way to its corners blocked too.
      let inner = 0;
      let out = 0;
      for (let k = g.vstart[i]!; k < g.vstart[i + 1]!; k++) {
        if (blocked(i, cx + (g.vxyz[k * 3]! - cx) * 0.6, cz + (g.vxyz[k * 3 + 2]! - cz) * 0.6)) out++;
        inner++;
      }
      if (out * 2 <= inner) continue;
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
   * bits) the route must keep out of, such as doors shut to the bot's team that no button opens for it. `agile`:
   * parkour links at walking's cost (PARKOUR_COST otherwise). `tall`: a body taller than the navmesh's (a large look):
   * ground under low headroom costs LOW_COST a metre, so the route goes round it wherever a way round exists; one that
   * still goes under (no way round, or it starts or ends there) sets lastLow.
   */
  findPath(a: Vec3, b: Vec3, shut = 0, partial = false, open = 0, agile = false, tall = false): Vec3[] | null {
    if (!simProfile.on) return this.findPathNow(a, b, shut, partial, open, agile, tall);
    const t0 = performance.now();
    const r = this.findPathNow(a, b, shut, partial, open, agile, tall);
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
  private findPathNow(a: Vec3, b: Vec3, shut = 0, partial = false, open = 0, agile = false, tall = false): Vec3[] | null {
    this.lastLow = false;
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
    // (Off the polygons of surfaces that are gone, whatever else the route keeps out of; not the ones it starts or ends on:
    // a bot riding a button-called lift, or going for someone on one, stands on ground that's "gone" from where it was.)
    if (this.gone) shut |= this.gone & ~this.navMesh.getPolyFlags(s.nearestRef).flags & ~this.navMesh.getPolyFlags(e.nearestRef).flags;
    const failKey = `${s.nearestRef}:${e.nearestRef}:${shut}`;
    // A tall body, with low headroom on the map: round it, unless the route starts or ends under it (getting out from
    // under, or a goal there: crouching is the only way), or this start and end went under it before (no way round:
    // the plain search, not the costly one that explores everything cheaper than going under).
    let heavy = false;
    if (tall && this.lowSpans) {
      this.tallRoutes++;
      const lowKey = `${s.nearestRef}:${e.nearestRef}`;
      heavy = !this.lowAt(s.nearestRef - base) && !this.lowAt(e.nearestRef - base) && !this.lowForced.has(lowKey);
    }
    // (Every search with a filter once there are parkour links: their area costs more than walking.)
    const filtered = shut || open || heavy || (this.parkour.length && !agile);
    if (!partial && this.noRoute.has(failKey)) return null;
    const r = this.query.findPath(s.nearestRef, e.nearestRef, start, end, filtered ? { maxPathPolys: MAX_PATH_POLYS, filter: this.filterFor(shut, open, agile, heavy) } : { maxPathPolys: MAX_PATH_POLYS });
    const n = r.polys.size;
    if (tall && this.lowSpans && r.success) {
      for (let i = 0; i < n; i++) {
        if (!this.lowAt(r.polys.get(i) - base)) continue;
        this.lastLow = true;
        break;
      }
      if (this.lastLow) {
        this.lowRoutes++;
        if (heavy) {
          if (this.lowForced.size >= 4096) this.lowForced.clear();
          this.lowForced.add(`${s.nearestRef}:${e.nearestRef}`);
        }
      }
    }
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

  /**
   * A route that keeps to a corridor (nav/corridors.ts: its polygons, start to goal) the rest of the way to `to` (its
   * goal's end): from `from` onto the corridor polygon nearest it ahead (one short search), then along the corridor's
   * own polygons, the straight path through them all (BOT_AI_PLAN.md Phase C item 4: a group's bots keep to its lane,
   * where a route with the corridor's via went back to the shortest way by the trip's middle). Null when it can't: the
   * corridor shut or gone on the way (a door, a fallen bridge: `shut`), `to` off its last polygon, or no way onto it.
   */
  pathAlong(from: Vec3, polys: readonly number[], to: Vec3, shut = 0, tall = false): Vec3[] | null {
    const g = this.graph();
    if (polys.length < 2) return null;
    const ext = { x: 2, y: 3, z: 2 };
    const s = this.query.findNearestPoly(from, { halfExtents: ext });
    const e = this.query.findNearestPoly(to, { halfExtents: ext });
    if (!s.success || !s.nearestRef || !e.success || !e.nearestRef || e.nearestRef - g.base !== polys[polys.length - 1]) return null;
    const mask = shut | this.gone;
    // The corridor polygon nearest `from` (later ones win ties: ahead, not back the way it came).
    const { centre } = polyShapes(g);
    let k = -1;
    let best = Infinity;
    for (let i = 0; i < polys.length; i++) {
      const p = polys[i]!;
      const d = hypot(centre[p * 3]! - from.x, centre[p * 3 + 2]! - from.z) + Math.abs(centre[p * 3 + 1]! - from.y) * 2;
      if (d <= best) {
        best = d;
        k = i;
      }
    }
    if (k < 0 || best > 30) return null;
    for (let i = k; i < polys.length; i++) if (mask && g.flags[polys[i]!]! & mask) return null;
    // (A tall body: not along a corridor under low headroom; its own route goes round.)
    if (tall && this.lowSpans) for (let i = k; i < polys.length; i++) if (this.lowAt(polys[i]!)) return null;
    // From here onto it: Detour's own route to that polygon (a few polygons, usually).
    const head: number[] = [];
    if (s.nearestRef - g.base !== polys[k]) {
      const target = this.query.closestPointOnPoly(g.base + polys[k]!, from);
      if (!target.success) return null;
      const r = this.query.findPath(s.nearestRef, g.base + polys[k]!, s.nearestPoint, target.closestPoint, { maxPathPolys: MAX_PATH_POLYS, filter: this.filterFor(shut | this.gone, 0) });
      const n = r.polys.size;
      const whole = r.success && n > 0 && r.polys.get(n - 1) === g.base + polys[k]!;
      for (let i = 0; whole && i < n - 1; i++) head.push(r.polys.get(i));
      r.polys.destroy();
      if (!whole) return null;
    }
    const refs = [...head];
    for (let i = k; i < polys.length; i++) refs.push(g.base + polys[i]!);
    const sp = this.query.findStraightPath(s.nearestPoint, e.nearestPoint, refs, { maxStraightPathPoints: MAX_CORNERS });
    const out: Vec3[] = [];
    if (sp.success) for (let i = 0; i < sp.straightPathCount; i++) out.push({ x: sp.straightPath.get(i * 3), y: sp.straightPath.get(i * 3 + 1), z: sp.straightPath.get(i * 3 + 2) });
    sp.straightPath.destroy();
    sp.straightPathFlags.destroy();
    sp.straightPathRefs.destroy();
    const last = out[out.length - 1];
    if (!last || hypot(last.x - e.nearestPoint.x, last.z - e.nearestPoint.z) > 0.5) return null;
    if (simProfile.on) simProfile.count('navAlong');
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
    // The navmesh's parts and the places' polygons too: worked out here, at setup (the match asks for the places
    // when bots join), rather than in a tick (about 15 ms and 10–30 ms on a big map).
    this.partsNow();
    this.placePolysNow();
    // Route reachability too (routable, standIn, escapes: the graph, its components and what routes to the main
    // area, a few ms).
    this.routesNow();
    this.toMainNow();
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

  private filterFor(shut: number, open = 0, agile = false, tall = false): QueryFilter {
    const key = ((shut * 4 + open) * 2 + (agile ? 1 : 0)) * 2 + (tall ? 1 : 0);
    let f = this.filters.get(key);
    if (!f) {
      f = new QueryFilter();
      f.includeFlags = 0xffff;
      f.excludeFlags = shut;
      f.setAreaCost(OPEN_AREA, OPEN_COST[open] ?? 1);
      f.setAreaCost(PARKOUR_AREA, agile ? 1 : PARKOUR_COST);
      f.setAreaCost(LOW_AREA, tall ? LOW_COST : 1);
      if (this.filters.size >= 64) this.filters.clear();
      this.filters.set(key, f);
    }
    return f;
  }

  /**
   * Openings (doors, walls that block paths until broken: Scenario.openings) as navmesh flags: the polygons
   * under the first OPENING_BITS of them get bit k + 1 each, so findPath's `shut` can keep a route out of the
   * ones shut to a bot. Sampled every 0.25 m over each opening's footprint, keeping only polygons the samples
   * stand over (not ones that merely come near). Once, at match start (and when the navmesh is rebuilt).
   */
  markOpenings(boxes: readonly Aabb[], surfacesFrom = Infinity): void {
    const half = { x: 0.15, y: 0.9, z: 0.15 };
    const g = this.graph();
    const { centre } = polyShapes(g);
    boxes.slice(0, OPENING_BITS).forEach((b, k) => {
      const bit = 1 << (k + 1);
      const marked = new Set<number>();
      // A surface (Scenario.surfaces: a bridge, a trapdoor): the polygons on its top, whose middles are over it (not the
      // floor round a trapdoor that Recast merged it into); an opening: those its footprint stands over at its foot.
      const surface = k >= surfacesFrom;
      const y = surface ? b.max.y : b.min.y + 0.3;
      for (let x = b.min.x; x <= b.max.x + 1e-6; x += 0.25) {
        for (let z = b.min.z; z <= b.max.z + 1e-6; z += 0.25) {
          const r = this.query.findNearestPoly({ x, y, z }, { halfExtents: surface ? { x: 0.15, y: 0.4, z: 0.15 } : half });
          if (!r.success || !r.nearestRef || !r.isOverPoly || marked.has(r.nearestRef)) continue;
          marked.add(r.nearestRef);
          if (surface) {
            const i = r.nearestRef - g.base;
            const cx = centre[i * 3]!;
            const cz = centre[i * 3 + 2]!;
            if (cx < b.min.x - 0.3 || cx > b.max.x + 0.3 || cz < b.min.z - 0.3 || cz > b.max.z + 0.3) continue;
            // (And at its top: not the floor beside a low one, sandbags or a charge's target, which goes on being floor.)
            if (Math.abs(centre[i * 3 + 1]! - b.max.y) > 0.25) continue;
          }
          const f = this.navMesh.getPolyFlags(r.nearestRef);
          // (Never one left out as inside something solid: flags 0, disableInsideSolid.)
          if (this.insideSolid && f.flags === 0) continue;
          this.navMesh.setPolyFlags(r.nearestRef, (f.flags || 1) | bit);
          this.usedBits |= bit;
          // (The graph's copy too: pathAlong reads a corridor's flags from it.)
          const gi = r.nearestRef - g.base;
          if (gi >= 0 && gi < g.count) g.flags[gi] = (f.flags || 1) | bit;
        }
      }
    });
    // Routes found before are still right for the routes that don't keep out of anything; failures with a mask are new.
    this.noRoute.clear();
  }

  /**
   * The per-tick search budget (BOT_AI_PLAN.md Phase C item 4: big matches, huge maps): route searches bots may start
   * this tick before the rest wait for the next (a bot with a route keeps to it meanwhile). Infinite until the match
   * sets one (beginTick).
   */
  private searchesLeft = Infinity;
  /** Searches put off by the budget (measuring). */
  searchesPutOff = 0;

  /** The match, each tick: `budget` route searches for bots this tick. */
  beginTick(budget: number): void {
    this.searchesLeft = budget;
  }

  /** A bot that would plan its route again now: whether the tick's budget has a search for it (one is used). */
  takeSearch(): boolean {
    if (this.searchesLeft <= 0) {
      this.searchesPutOff++;
      return false;
    }
    this.searchesLeft--;
    return true;
  }

  /** Surfaces gone now (Scenario.surfacesGone: flag bits every route keeps off), and a count of changes to them. */
  private gone = 0;
  goneVersion = 0;
  /** Opening bits markOpenings gave to at least one polygon (a surface that flagged none changes no route). */
  private usedBits = 0;

  /** The match, when what's gone changes: every route search from now on keeps off those polygons. */
  setGone(mask: number): void {
    // (Only surfaces with ground on the navmesh: a breakable prop's top bots never stood on changes nobody's route, and
    // bots needn't all plan again each time one breaks.)
    mask &= this.usedBits;
    if (mask === this.gone) return;
    this.gone = mask;
    this.goneVersion++;
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
  private reverseCache: { start: Int32Array; to: Int32Array } | null = null;
  private readonly reachTo = new Map<number, Uint8Array>();

  /** The routes' edges reversed (CSR), made once. */
  private reverseNow(): { start: Int32Array; to: Int32Array } {
    if (this.reverseCache) return this.reverseCache;
    const r = this.routesNow();
    const n = r.comp.length;
    const deg = new Int32Array(n + 1);
    for (let k = 0; k < r.to.length; k++) deg[r.to[k]! + 1]!++;
    for (let i = 0; i < n; i++) deg[i + 1]! += deg[i]!;
    const fill = deg.slice(0, n);
    const to = new Int32Array(r.to.length);
    for (let a = 0; a < n; a++) for (let k = r.start[a]!; k < r.start[a + 1]!; k++) to[fill[r.to[k]!]!++] = a;
    return (this.reverseCache = { start: deg, to });
  }

  /** Polygons that route to the main area. */
  private toMainNow(): Uint8Array {
    if (this.toMainCache) return this.toMainCache;
    const r = this.routesNow();
    const n = r.comp.length;
    const seeds: number[] = [];
    for (let i = 0; i < n; i++) if (r.comp[i] === r.main) seeds.push(i);
    const back = this.reverseNow();
    return (this.toMainCache = reachSet(back.start, back.to, n, seeds));
  }

  /** Polygons that route to polygon `i` (to its component; cached per component, at most 256 kept). */
  private routesTo(i: number): Uint8Array {
    const r = this.routesNow();
    const c = r.comp[i]!;
    if (c === r.main) return this.toMainNow();
    let seen = this.reachTo.get(c);
    if (seen) return seen;
    const back = this.reverseNow();
    seen = reachSet(back.start, back.to, r.comp.length, [i]);
    if (this.reachTo.size >= 256) this.reachTo.clear();
    this.reachTo.set(c, seen);
    return seen;
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
  wayOnto(p: Vec3, clear?: (a: Vec3, b: Vec3) => boolean): Vec3 | null {
    const near = this.query.findNearestPoly(p, { halfExtents: { x: 2, y: 3, z: 2 } });
    if (near.nearestRef) {
      // On it, or beside it with nothing in the way. A nearest point behind a wall is not a way on (a bot on a sill
      // outside a building's wall, Capitol Mall's offices: its routes went through the wall, and it stood against it).
      const q = near.nearestPoint;
      if (!clear || hypot(q.x - p.x, q.z - p.z) < 0.6 || clear(p, q)) return null;
    }
    // Close by first; then further and further down (a cliff face or a ledge high over the ground: off it, down).
    for (const [r, down] of [
      [6, 6],
      [12, 30],
      [24, 60],
    ] as const) {
      if (!clear) {
        const hit = this.query.findNearestPoly({ x: p.x, y: p.y - down / 2 + 0.3, z: p.z }, { halfExtents: { x: r, y: down / 2 + 0.3, z: r } });
        if (hit.success && hit.nearestRef && hit.nearestPoint.y < p.y + 0.6) return { ...hit.nearestPoint };
        continue;
      }
      // Of the polygons there, the nearest point a body gets to in a straight line (walking, or off an edge and down).
      const q = this.query.queryPolygons({ x: p.x, y: p.y - down / 2 + 0.3, z: p.z }, { x: r, y: down / 2 + 0.3, z: r }, { maxPolys: 256 });
      const pts: { q: Vec3; d: number }[] = [];
      for (const ref of q.success ? q.polyRefs : []) {
        if (this.insideSolid && this.navMesh.getPolyFlags(ref).flags === 0) continue;
        const c = this.query.closestPointOnPoly(ref, p);
        if (!c.success || c.closestPoint.y >= p.y + 0.6) continue;
        const pt = { x: c.closestPoint.x, y: c.closestPoint.y, z: c.closestPoint.z };
        pts.push({ q: pt, d: hypot(pt.x - p.x, pt.z - p.z) + (p.y - pt.y) * 0.5 });
      }
      pts.sort((a, b) => a.d - b.d || a.q.x - b.q.x || a.q.z - b.q.z);
      for (const { q: pt } of pts.slice(0, 12)) if (clear(p, pt)) return pt;
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

  /** The polygon (graph index) each of places() is on (-1: none). */
  private placePolys: Int32Array | null = null;

  private placePolysNow(): Int32Array {
    if (this.placePolys) return this.placePolys;
    const places = this.placeCache ?? this.places();
    const base = this.graph().base;
    const polys = new Int32Array(places.length);
    places.forEach((p, i) => {
      const r = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      polys[i] = r.success && r.nearestRef ? r.nearestRef - base : -1;
    });
    return (this.placePolys = polys);
  }

  private readonly escapeCache = new Map<string, readonly NavEscape[]>();

  /**
   * Ways off a patch of navmesh cut off from `goal` (docs/BOTS.md, "Cut off"). The navmesh is more cautious
   * than legs are: it keeps 0.8 m from walls where a body needs 0.4, and a step under a low roof, a narrow
   * gap or a slab edge a hair over the step height can leave a patch players walk off with no route out of it
   * (Capitol Mall's reflecting pool; Diamond Park's dugouts, three spawn points each, until their roofs were
   * raised in the map). For a point no route from which reaches the goal (or off the navmesh altogether), up to
   * three places close by that do route to it and are a short step or hop across (up to ESCAPE_RISE up, 8 m
   * across) from where the point's routes get, nearest first: where to cross from (null when the point is off the
   * navmesh) and the place across. From ground that routes to the main area, only onto ground that routes back to
   * it too (onto a dais the navmesh doesn't climb, never down into a pit). `clear`: a body gets straight across
   * from one to the other (nothing in the way). Empty when nothing is near enough, or a route reaches the goal.
   * Cached per polygon and the goal's component of routes.
   */
  escapes(from: Vec3, goal: Vec3, clear: (a: Vec3, b: Vec3) => boolean): readonly NavEscape[] {
    const ext = { x: 2, y: 3, z: 2 };
    const e = this.query.findNearestPoly(goal, { halfExtents: ext });
    if (!e.success || !e.nearestRef) return NO_ESCAPE;
    if (this.part(e.nearestRef) < 0) return NO_ESCAPE;
    const s = this.query.findNearestPoly(from, { halfExtents: ext });
    const on = s.success && !!s.nearestRef;
    const base = this.graph().base;
    const goalIdx = e.nearestRef - base;
    // Ground that routes to the goal (routes go one way: falls, ledge drops and one-way links count as they go).
    const toGoal = this.routesTo(goalIdx);
    const toMain = this.toMainNow();
    // Where a hop may land: ground that routes to the goal; for a bot that routes to the main area (on it, or on ground
    // that leads back to it), only such ground that routes back to the main area too: across a gap the navmesh is too
    // cautious for, onto a dais or a step too high to walk up (M4 Outpost's uplink dais, 1.5 m from the gate's wall),
    // never down into a pit after a goal. Off a patch that doesn't route to the main area (a pit, a court a curb too
    // high for the navmesh shuts in: St John's), onto any ground that routes to the goal.
    let safe = false;
    if (on) {
      const i = s.nearestRef - base;
      // A route there: nothing to escape.
      if (toGoal[i]) return NO_ESCAPE;
      safe = toMain[i] === 1;
    }
    const landing = (poly: number) => poly >= 0 && toGoal[poly] === 1 && (!safe || toMain[poly] === 1);
    const goalComp = this.routesNow().comp[goalIdx]!;
    const key = on ? `${s.nearestRef}>${goalComp}` : `${Math.round(from.x)},${Math.round(from.y)},${Math.round(from.z)}>${goalComp}`;
    const known = this.escapeCache.get(key);
    if (known) return known;
    const places = this.places();
    const placePolys = this.placePolysNow();
    const near: { p: Vec3; d: number }[] = [];
    for (let i = 0; i < places.length; i++) {
      const p = places[i]!;
      if (!landing(placePolys[i]!) || Math.abs(p.y - from.y) > 5) continue;
      const d = hypot(p.x - from.x, p.z - from.z);
      if (d < ESCAPE_REACH) near.push({ p, d });
    }
    near.sort((a, b) => a.d - b.d);
    const out: NavEscape[] = [];
    // The nearest dozen places (a metre or more apart) first.
    const tried: Vec3[] = [];
    const tryAcross = (p: Vec3): void => {
      if (tried.some((t) => hypot(t.x - p.x, t.z - p.z) < 1 && Math.abs(t.y - p.y) < 1)) return;
      tried.push(p);
      // Where the patch comes nearest it (a route that can't get there ends at the closest point it can reach).
      const edge = on ? this.nearestReach(s.nearestRef, s.nearestPoint, p) : null;
      if (on && !edge) return;
      const at = edge ?? from;
      const rise = p.y - at.y;
      if (hypot(p.x - at.x, p.z - at.z) > ESCAPE_GAP || rise > ESCAPE_RISE || rise < -4 || !clear(at, p)) return;
      out.push({ edge, across: { ...p } });
    };
    // Places routes from the goal's own ground lead back to first (both ways joined: not a ledge whose way on is a drop
    // link far off; Capitol Mall's pool's rim walkway goes to its far end), then the rest.
    const routes = this.routesNow();
    const joined = (p: Vec3) => {
      const h = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      return h.success && !!h.nearestRef && routes.comp[h.nearestRef - base] === goalComp;
    };
    for (const pass of [true, false]) {
      for (const { p } of near) {
        if (out.length >= 3 || tried.length >= 12) break;
        if (pass === joined(p)) tryAcross(p);
      }
    }
    // None of them: the goal's part's own ground nearest the point. The places are 7 m apart, and the step or lip out
    // of a sunken sliver can be a couple of metres from ground none of them is on (Underdrain's sump, Fogbound's gullies).
    if (!out.length) {
      const q = this.query.queryPolygons(from, { x: ESCAPE_REACH, y: 5, z: ESCAPE_REACH }, { maxPolys: 512 });
      const ground: { p: Vec3; d: number }[] = [];
      for (const ref of q.success ? q.polyRefs : []) {
        if (!landing(ref - base)) continue;
        const c = this.query.closestPointOnPoly(ref, from);
        if (!c.success || Math.abs(c.closestPoint.y - from.y) > 5) continue;
        const p = { x: c.closestPoint.x, y: c.closestPoint.y, z: c.closestPoint.z };
        const d = hypot(p.x - from.x, p.z - from.z);
        if (d < ESCAPE_REACH) ground.push({ p, d });
      }
      ground.sort((a, b) => a.d - b.d || a.p.x - b.p.x || a.p.z - b.p.z);
      for (const { p } of ground) {
        if (out.length >= 3 || tried.length >= 24) break;
        tryAcross(p);
      }
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

/** A 2 m cell's key (parkour links by where they start). */
const cellKey = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);

/** Links as [from, to] ground polygons of `nav` (their ends within half a metre of a polygon). */
function linkPairs(nav: NavWorld, links: readonly { start: Vec3; end: Vec3 }[]): [number, number][] {
  const out: [number, number][] = [];
  for (const l of links) {
    const a = nav.nearestPoly(l.start, { x: 0.5, y: 1, z: 0.5 });
    const b = nav.nearestPoly(l.end, { x: 0.5, y: 1, z: 0.5 });
    if (a && b && a.index !== b.index) out.push([a.index, b.index]);
  }
  return out;
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
    const what: Partial<Record<MapDocument['entities'][number]['kind'], string>> = { pickup: 'pickup', flag: 'flag base', hill: 'hill', bombsite: 'bomb site', hostage: 'hostage', rescue: 'rescue zone', objective: 'Breakthrough objective' };
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
