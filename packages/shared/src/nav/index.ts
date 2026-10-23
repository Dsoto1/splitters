import { init as initRecast, NavMeshQuery, type NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';
import { boxesToTriangles, type WorldBox } from '../map/geometry.ts';
import type { MapDocument } from '../map/schema.ts';
import type { ValidationIssue } from '../map/validate.ts';
import type { Vec3 } from '../math.ts';
import { PLAYER } from '../sim/constants.ts';

let initPromise: Promise<void> | undefined;

/** Load the Recast WASM module once. Safe to call repeatedly. */
export function initNavigation(): Promise<void> {
  initPromise ??= initRecast();
  return initPromise;
}

const CELL = 0.2;
const CELL_HEIGHT = 0.05;

/**
 * Navigation mesh generated from map geometry, so bots work on any Classic
 * Grid layout without authored waypoints (MASTER_SPEC_V2 §7, MULTIPLAYER_AI_SCALE).
 */
export class NavWorld {
  private constructor(
    readonly navMesh: NavMesh,
    private readonly query: NavMeshQuery,
  ) {}

  static build(boxes: readonly WorldBox[]): NavWorld {
    const { positions, indices } = boxesToTriangles(boxes);
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
    });
    if (!result.success) throw new Error(`navmesh generation failed: ${result.error}`);
    return new NavWorld(result.navMesh, new NavMeshQuery(result.navMesh));
  }

  /** Nearest point on the navmesh, or null if nothing walkable is close. */
  closestPoint(p: Vec3, halfExtents: Vec3 = { x: 2, y: 3, z: 2 }): Vec3 | null {
    const r = this.query.findClosestPoint(p, { halfExtents });
    return r.success && r.polyRef !== 0 ? { ...r.point } : null;
  }

  /** Straight-path corners from a to b, or null if b is unreachable from a. */
  findPath(a: Vec3, b: Vec3): Vec3[] | null {
    const start = this.closestPoint(a);
    const end = this.closestPoint(b);
    if (!start || !end) return null;
    const r = this.query.computePath(start, end, { halfExtents: { x: 0.5, y: 1, z: 0.5 }, maxPathPolys: 512 });
    if (!r.success || r.path.length === 0) return null;
    const last = r.path[r.path.length - 1]!;
    // A partial path (destination polygon unreachable) ends short of the goal.
    if (Math.hypot(last.x - end.x, last.z - end.z) > 0.5 || Math.abs(last.y - end.y) > 1) return null;
    return r.path.map((p) => ({ x: p.x, y: p.y, z: p.z }));
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
  }
  return issues;
}
