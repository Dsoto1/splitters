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

  /** `extra` adds triangle geometry (terrain) to the boxes; `links` are one-way jumps (jump pads) bots can take. */
  static build(boxes: readonly WorldBox[], extra: { positions: Float32Array; indices: Uint32Array } | null = null, links: readonly { start: Vec3; end: Vec3 }[] = [], snapped = false): NavWorld {
    const box = boxesToTriangles(boxes);
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
    const world = new NavWorld(result.navMesh, new NavMeshQuery(result.navMesh));
    if (!links.length || snapped) return world;
    // Jump links must start and end on the mesh: snap them to it, then build again with the links in.
    const onMesh = links.flatMap((l) => {
      const start = world.closestPoint(l.start, { x: 1.5, y: 2, z: 1.5 });
      const end = world.closestPoint(l.end, { x: 2.5, y: 3, z: 2.5 });
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
    // Pickups bots and players can't walk (or pad) to are wasted; flag bases and hills must be reachable to be played.
    for (const p of map.entities) {
      if (p.kind !== 'pickup' && p.kind !== 'flag' && p.kind !== 'hill') continue;
      const to = { x: p.position[0], y: p.position[1], z: p.position[2] };
      const path = nav.findPath(from, to);
      const end = path?.[path.length - 1];
      if (!end || Math.hypot(end.x - to.x, end.z - to.z) > 1.5 || Math.abs(end.y - to.y) > 2) {
        const what = p.kind === 'pickup' ? 'pickup' : p.kind === 'flag' ? 'flag base' : 'hill';
        issues.push({ severity: 'warning', code: `nav.${p.kind}_unreachable`, message: `${what} ${p.id} cannot be reached on foot from spawn ${first.id}`, targetId: p.id });
      }
    }
  }
  return issues;
}
