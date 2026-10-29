import { horizontalDistance, type Vec3 } from '../math.ts';
import type { MapPath } from '../map/schema.ts';
import { pathGeometry, pathUses, type TrackGeometry } from '../map/track.ts';

/**
 * Guide lines for bots driving vehicles: the map's routes and roads (paths
 * used as `route` or `road`, the race track included). A driving bot whose
 * trip runs the way a guide line goes drives along it instead of straight
 * down its navmesh route: it steers at a point ahead on the line (further
 * the faster it goes), keeps to the right-hand half of a two-way road, never
 * drives a one-way path backwards and keeps under the path's speed hint.
 * Everything here is pure: the brain asks, the match hands over the lines.
 */

/** One line a vehicle can follow. */
export interface Guide {
  readonly line: TrackGeometry;
  readonly oneWay: boolean;
  /** Speed hint (m/s), or null for none. */
  readonly speed: number | null;
  /** Half the width of the road (0 for a route): a two-way road is driven on its right-hand half. */
  readonly half: number;
}

/** Roads narrower than this are footpaths and walkways: vehicles don't follow them (routes they always do). */
const MIN_ROAD_WIDTH = 4;
/** How far off a line (m, past its edge) a vehicle may be and still take it. */
const JOIN = 8;
/** Near the goal (m) the bot leaves the line and drives straight there. */
const ARRIVE = 30;

/** The map's guide lines for driving bots (built once per match). */
export function vehicleGuides(paths: readonly MapPath[] | undefined): Guide[] {
  const out: Guide[] = [];
  for (const p of paths ?? []) {
    if (p.points.length < 2) continue;
    const route = pathUses(p, 'route');
    if (!route && !(pathUses(p, 'road') && p.width >= MIN_ROAD_WIDTH)) continue;
    out.push({ line: pathGeometry(p), oneWay: !!p.oneWay, speed: p.speed ?? null, half: route && !pathUses(p, 'road') ? 0 : p.width / 2 });
  }
  return out;
}

/**
 * Where a vehicle at `pos` facing `yaw` and going `speed` m/s should steer
 * to follow a guide line toward `goal`, and the line's speed hint; null when
 * no line is near, none runs its way (a line is taken only if driving along
 * it brings the goal clearly closer), or the goal is close enough to drive
 * straight to.
 */
export function followGuide(guides: readonly Guide[], pos: Vec3, yaw: number, goal: Vec3, speed: number): { aim: Vec3; speed: number | null } | null {
  const left = horizontalDistance(pos, goal);
  if (left < ARRIVE || !guides.length) return null;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const look = 10 + Math.max(0, speed) * 0.6;
  let best: { aim: Vec3; speed: number | null } | null = null;
  let bestScore = -Infinity;
  for (const g of guides) {
    const reach = g.half + JOIN;
    const near = g.line.nearest(pos.x, pos.z, reach);
    if (!near || near.dist > reach || Math.abs(near.sample.y - pos.y) > 4) continue;
    for (const dir of g.oneWay ? [1] : [1, -1]) {
      const ahead = g.line.at(near.sample.s + dir * look);
      // Driving along it must bring the goal clearly closer (heading its way), not just wander.
      const gain = left - horizontalDistance(ahead, goal);
      if (gain < look * 0.35) continue;
      const along = (ahead.dx * fx + ahead.dz * fz) * dir;
      const score = gain / look + 0.3 * along - (0.3 * near.dist) / reach;
      if (score <= bestScore) continue;
      bestScore = score;
      // Two-way roads: keep to the right-hand half (right of the way we're going).
      const lane = g.oneWay || g.half < 3 ? 0 : g.half / 2;
      best = { aim: { x: ahead.x + ahead.dz * dir * lane, y: ahead.y, z: ahead.z - ahead.dx * dir * lane }, speed: g.speed };
    }
  }
  return best;
}
