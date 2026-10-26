import type { AirplaneEntity, MapDocument } from '../map/schema.ts';
import { horizontalDistance, type Vec3 } from '../math.ts';
import { TICK_RATE } from './constants.ts';

/**
 * The transport plane set piece (map entity `airplane`): it flies a fixed
 * route over the map at a set altitude, once round every `loopSeconds`.
 * Players ride it as passengers (spawned aboard by the air drop setting, or
 * never), and jump out with E or jump to parachute down (parachute.ts).
 * Where the plane is depends only on the tick, so server and clients agree
 * without sending anything but the usual mount snapshot.
 */
export interface AirRoute {
  /** World points (x, z) in flying order. */
  points: { x: number; z: number }[];
  /** World height it flies at. */
  y: number;
  loopSeconds: number;
  closed: boolean;
  /** Cumulative length at each point, and the whole route's. */
  at: number[];
  length: number;
}

/** The route of an airplane entity in world space. */
export function airRoute(e: Pick<AirplaneEntity, 'position' | 'route' | 'altitude' | 'loopSeconds' | 'closed'>): AirRoute {
  const points = e.route.map(([dx, dz]) => ({ x: e.position[0] + dx, z: e.position[2] + dz }));
  const legs = e.closed ? points.length : points.length - 1;
  const at = [0];
  let length = 0;
  for (let i = 0; i < legs; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    length += Math.hypot(b.x - a.x, b.z - a.z);
    at.push(length);
  }
  return { points, y: e.position[1] + e.altitude, loopSeconds: e.loopSeconds, closed: e.closed, at, length: Math.max(length, 1e-6) };
}

/** Airspeed (m/s) along the route. */
export const routeSpeed = (r: AirRoute): number => r.length / r.loopSeconds;

/** How far round its loop (0..1) the plane is at `tick`. */
export const routePhase = (r: AirRoute, tick: number): number => ((tick / TICK_RATE) % r.loopSeconds) / r.loopSeconds;

/**
 * Where the plane is at a tick: position (its centre, at altitude), heading
 * (yaw as in viewDirection, eased round corners), velocity and the share of
 * the loop flown (an open route starts over at 1).
 */
export function routePose(r: AirRoute, tick: number): { pos: Vec3; yaw: number; vel: { x: number; z: number }; phase: number } {
  const phase = routePhase(r, tick);
  const d = phase * r.length;
  let i = 0;
  while (i < r.at.length - 2 && r.at[i + 1]! < d) i++;
  const a = r.points[i]!;
  const b = r.points[(i + 1) % r.points.length]!;
  const leg = Math.max(1e-6, r.at[i + 1]! - r.at[i]!);
  const t = Math.min(1, (d - r.at[i]!) / leg);
  const pos = { x: a.x + (b.x - a.x) * t, y: r.y, z: a.z + (b.z - a.z) * t };
  let yaw = Math.atan2(b.x - a.x, b.z - a.z);
  // Bank round the corner over the last few metres of a leg (closed routes, and every corner of open ones).
  const turnIn = Math.min(12, leg / 3);
  const left = leg - (d - r.at[i]!);
  const next = r.points[(i + 2) % r.points.length]!;
  if (left < turnIn && (r.closed || i + 2 < r.points.length)) {
    const yaw2 = Math.atan2(next.x - b.x, next.z - b.z);
    const k = (1 - left / turnIn) * 0.5;
    yaw += Math.atan2(Math.sin(yaw2 - yaw), Math.cos(yaw2 - yaw)) * k;
  }
  const speed = routeSpeed(r);
  return { pos, yaw, vel: { x: Math.sin(yaw) * speed, z: Math.cos(yaw) * speed }, phase };
}

/** Ticks left before an open route ends (and the plane starts over); Infinity for a closed loop. */
export function ticksToRouteEnd(r: AirRoute, tick: number): number {
  if (r.closed) return Infinity;
  return Math.round((1 - routePhase(r, tick)) * r.loopSeconds * TICK_RATE);
}

/** The map's transport planes (index into map.entities and the entity). */
export function mapAirplanes(map: MapDocument): { index: number; entity: AirplaneEntity }[] {
  const out: { index: number; entity: AirplaneEntity }[] = [];
  map.entities.forEach((e, index) => {
    if (e.kind === 'airplane') out.push({ index, entity: e });
  });
  return out;
}

/**
 * Where a bot riding the plane wants to come down: the mode's objective (the
 * enemy flag in Capture the Flag, a hill, a bomb site), else one of its
 * team's spawns (its base), else any spawn. `pick` (0..1) chooses among
 * equal options.
 */
export function dropTarget(map: MapDocument, team: string | null, pick: number, mode = ''): Vec3 {
  const p = (e: { position: [number, number, number] }): Vec3 => ({ x: e.position[0], y: e.position[1], z: e.position[2] });
  const objectives = map.entities.filter((e) => (mode === 'core.ctf' && e.kind === 'flag' && e.team !== team) || (mode === 'core.koth' && e.kind === 'hill') || (mode === 'core.bomb' && e.kind === 'bombsite'));
  if (objectives.length) return p(objectives[Math.floor(pick * objectives.length) % objectives.length]!);
  const spawns = map.entities.filter((e) => e.kind === 'spawn');
  const own = spawns.filter((e) => e.kind === 'spawn' && team !== null && e.faction === team);
  const from = own.length ? own : spawns;
  if (from.length) return p(from[Math.floor(pick * from.length) % from.length]!);
  return { x: 0, y: 0, z: 0 };
}

/**
 * Should a bot jump now? When the plane is close over its target, or has
 * passed its closest point (getting further again) within reach of a
 * glide, or the route is about to end. `prev` is last tick's distance.
 */
export function shouldJump(planePos: Vec3, target: Vec3, prev: number | undefined, ticksLeft: number): { jump: boolean; dist: number } {
  const dist = horizontalDistance(planePos, target);
  const passing = prev !== undefined && dist > prev + 0.01 && dist < 60;
  return { jump: dist < 18 || passing || ticksLeft < TICK_RATE * 2, dist };
}

/** A creator-facing problem with a transport plane (map/validate.ts turns these into issues). */
export interface AirplaneIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  targetId: string;
}

/**
 * Checks for transport planes: a route with real legs, a sensible airspeed,
 * flying clear of the ground (terrain, and the top of any tile level under
 * it) along the whole route, and not wandering far outside the map's
 * boundary. `groundAt` gives the terrain height at (x, z), or null.
 */
export function airplaneIssues(map: MapDocument, groundAt: (x: number, z: number) => number | null): AirplaneIssue[] {
  const out: AirplaneIssue[] = [];
  const { cellSize, levelHeight } = map.classicStructure;
  const roofs = new Map<string, number>();
  for (const t of map.classicStructure.tiles) {
    const k = `${t.x},${t.y}`;
    roofs.set(k, Math.max(roofs.get(k) ?? -Infinity, (t.z + 1) * levelHeight));
  }
  const builtAt = (x: number, z: number) => roofs.get(`${Math.round(x / cellSize)},${Math.round(z / cellSize)}`) ?? -Infinity;
  for (const { entity: e } of mapAirplanes(map)) {
    const r = airRoute(e);
    const legs = r.at.slice(1).map((d, i) => d - r.at[i]!);
    if (legs.some((l) => l < 10)) {
      out.push({ severity: 'error', code: 'airplane.route', message: `transport plane ${e.id}: route points closer than 10 m (each leg needs room to fly)`, targetId: e.id });
      continue;
    }
    const speed = routeSpeed(r);
    if (speed < 8 || speed > 90) out.push({ severity: 'warning', code: 'airplane.speed', message: `transport plane ${e.id} flies at ${Math.round(speed)} m/s (keep it 8-90: change the lap time)`, targetId: e.id });
    let lowest = Infinity;
    for (let i = 0; i < r.points.length - (r.closed ? 0 : 1); i++) {
      const a = r.points[i]!;
      const b = r.points[(i + 1) % r.points.length]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 8));
      for (let k = 0; k <= steps; k++) {
        const x = a.x + ((b.x - a.x) * k) / steps;
        const z = a.z + ((b.z - a.z) * k) / steps;
        lowest = Math.min(lowest, r.y - Math.max(groundAt(x, z) ?? -Infinity, builtAt(x, z), e.position[1]));
      }
    }
    if (lowest < 12) out.push({ severity: 'warning', code: 'airplane.low', message: `transport plane ${e.id} passes ${Math.max(0, Math.round(lowest))} m over the ground or buildings (fly it at least 12 m up, 40+ for a parachute drop)`, targetId: e.id });
    const b = map.bounds;
    if (b && r.points.some((p) => p.x < b.min[0] - 60 || p.x > b.max[0] + 60 || p.z < b.min[1] - 60 || p.z > b.max[1] + 60)) {
      out.push({ severity: 'warning', code: 'airplane.bounds', message: `transport plane ${e.id} flies more than 60 m outside the map's boundary: riders who jump there can't get back in`, targetId: e.id });
    }
  }
  return out;
}
