import type { AirplaneEntity, MapDocument } from '../map/schema.ts';
import { horizontalDistance, type Vec3, hypot } from '../math.ts';
import { TICK_RATE } from './constants.ts';

/**
 * The transport plane set piece (map entity `airplane`; a dropship when its
 * `craft` says so): it flies a fixed
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
    length += hypot(b.x - a.x, b.z - a.z);
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

/** How far along the route (m from its first point) the craft is at `tick`. */
export const routeDistance = (r: AirRoute, tick: number): number => routePhase(r, tick) * r.length;

/** The route's point `d` metres along it (wrapping round a closed loop). */
export function routePointAt(r: AirRoute, d: number): { x: number; z: number } {
  const t = ((d % r.length) + r.length) % r.length;
  let i = 0;
  while (i < r.at.length - 2 && r.at[i + 1]! < t) i++;
  const a = r.points[i]!;
  const b = r.points[(i + 1) % r.points.length]!;
  const k = Math.min(1, Math.max(0, (t - r.at[i]!) / Math.max(1e-6, r.at[i + 1]! - r.at[i]!)));
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}

/**
 * Where riders may jump out along a drop route. The route is cut into
 * samples `step` metres apart; `ok[i]` says whether sample i (the stretch
 * from i·step) is over ground a parachutist can land on (inside the map's
 * play area, over a floor or terrain, not lava, acid or the void), `bot[i]`
 * whether bots may pick it (that ground is on their navmesh too). `any`:
 * some sample is good. A route with no good sample at all (a map whose drop
 * area can't be worked out) lets riders jump anywhere, as before.
 */
export interface DropPlan {
  step: number;
  ok: boolean[];
  bot: boolean[];
  any: boolean;
}

/** Metres between drop samples: a sample lasts at least ~1.5 ticks at the craft's speed, so none is skipped. */
export const dropStep = (r: AirRoute): number => Math.max(4, (routeSpeed(r) / TICK_RATE) * 1.5);

/**
 * Where, along the route from the craft, a rider who jumps comes out and
 * comes down: out of the tail ramp (`exit`, behind the craft: its half
 * length and a metre) and, carried on by half the craft's speed until the
 * canopy opens (about JUMP_CARRY_SECONDS), roughly where they land. Both
 * must be over good ground for a jump there to be allowed.
 */
export const JUMP_CARRY_SECONDS = 2.5;
export function dropOffsets(r: AirRoute, halfLength: number): number[] {
  const exit = -(halfLength + 1);
  return [exit, Math.max(exit, exit + routeSpeed(r) * 0.5 * JUMP_CARRY_SECONDS)];
}

/**
 * Work out a route's drop plan from `land` (can a rider land under (x, z)?)
 * and `reach` (can a bot walk on from there?), checked `offsets` metres
 * along the route from each sample (dropOffsets; the last one is where they
 * land, which is where bots need to be able to walk from).
 */
export function dropPlan(r: AirRoute, land: (x: number, z: number) => boolean, reach: (x: number, z: number) => boolean = () => true, offsets: readonly number[] = [0]): DropPlan {
  const step = dropStep(r);
  const n = Math.max(1, Math.ceil(r.length / step));
  const ok: boolean[] = [];
  const bot: boolean[] = [];
  // Off the ends of an open route there is nothing to fly over: a point there is taken at the route's end.
  const at = (d: number) => routePointAt(r, r.closed ? d : Math.max(0, Math.min(r.length, d)));
  for (let i = 0; i < n; i++) {
    const d = Math.min(r.length, (i + 0.5) * step);
    const good = offsets.every((o) => {
      const p = at(d + o);
      return land(p.x, p.z);
    });
    ok.push(good);
    const p = at(d + offsets[offsets.length - 1]!);
    bot.push(good && reach(p.x, p.z));
  }
  return { step, ok, bot, any: ok.some(Boolean) };
}

/** The drop sample the craft is over at `tick`. */
export const dropIndex = (plan: DropPlan, r: AirRoute, tick: number): number => Math.min(plan.ok.length - 1, Math.floor(routeDistance(r, tick) / plan.step));

/** Whether a rider may jump out at `tick` (always, on a route with no good sample at all). */
export const canDrop = (plan: DropPlan, r: AirRoute, tick: number): boolean => !plan.any || plan.ok[dropIndex(plan, r, tick)]!;

/**
 * Whether `tick` is the last one over a good stretch: the craft is over
 * good ground now and won't be next tick (or an open route ends). Anyone
 * still aboard is dropped then, at the stretch's last good point.
 */
export function dropStretchEnds(plan: DropPlan, r: AirRoute, tick: number): boolean {
  if (!plan.any || !canDrop(plan, r, tick)) return false;
  if (ticksToRouteEnd(r, tick) <= 1) return true;
  return !canDrop(plan, r, tick + 1);
}

/**
 * The sample a bot aiming for `target` jumps at: one of the bot-good samples
 * whose landing point (`landOffset` m on along the route) is within `spread`
 * metres of the nearest one to the target, chosen by `pick` (0..1), so a
 * planeload aiming for one place doesn't all jump at once (-1: none; a bot
 * then jumps at the first good moment its target is passing, as shouldJump
 * decides).
 */
export function botDropIndex(plan: DropPlan, r: AirRoute, target: Vec3, landOffset = 0, pick = 0, spread = 12): number {
  const dist: { i: number; d: number }[] = [];
  plan.bot.forEach((good, i) => {
    if (!good) return;
    const along = Math.min(r.length, (i + 0.5) * plan.step) + landOffset;
    const p = routePointAt(r, r.closed ? along : Math.max(0, Math.min(r.length, along)));
    dist.push({ i, d: hypot(p.x - target.x, p.z - target.z) });
  });
  if (!dist.length) return -1;
  const best = Math.min(...dist.map((x) => x.d));
  const near = dist.filter((x) => x.d <= best + spread);
  return near[Math.min(near.length - 1, Math.floor(pick * near.length))]!.i;
}

/** The ground riders may come down on: the map's boundary (or, without one, what's built and its terrain), `margin` m in from the edge. */
export function dropArea(map: MapDocument, margin = DROP_MARGIN): { x0: number; z0: number; x1: number; z1: number } | null {
  let a: { x0: number; z0: number; x1: number; z1: number } | null = null;
  if (map.bounds) a = { x0: map.bounds.min[0], z0: map.bounds.min[1], x1: map.bounds.max[0], z1: map.bounds.max[1] };
  else {
    const { cellSize } = map.classicStructure;
    const grow = (x0: number, z0: number, x1: number, z1: number) => {
      a = a ? { x0: Math.min(a.x0, x0), z0: Math.min(a.z0, z0), x1: Math.max(a.x1, x1), z1: Math.max(a.z1, z1) } : { x0, z0, x1, z1 };
    };
    for (const t of map.classicStructure.tiles) grow(t.x * cellSize - cellSize / 2, t.y * cellSize - cellSize / 2, t.x * cellSize + cellSize / 2, t.y * cellSize + cellSize / 2);
    const t = map.terrain;
    if (t) grow(t.origin[0], t.origin[1], t.origin[0] + (t.cols - 1) * t.spacing, t.origin[1] + (t.rows - 1) * t.spacing);
  }
  if (!a) return null;
  const r = a as { x0: number; z0: number; x1: number; z1: number };
  // A small area keeps at least its middle.
  const mx = Math.min(margin, (r.x1 - r.x0) / 4);
  const mz = Math.min(margin, (r.z1 - r.z0) / 4);
  return { x0: r.x0 + mx, z0: r.z0 + mz, x1: r.x1 - mx, z1: r.z1 - mz };
}

/** How far in from the play area's edge a jump must be (a parachute drifts; the boundary walls stop you landing past them anyway). */
export const DROP_MARGIN = 3;

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
      const steps = Math.max(1, Math.ceil(hypot(b.x - a.x, b.z - a.z) / 8));
      for (let k = 0; k <= steps; k++) {
        const x = a.x + ((b.x - a.x) * k) / steps;
        const z = a.z + ((b.z - a.z) * k) / steps;
        lowest = Math.min(lowest, r.y - Math.max(groundAt(x, z) ?? -Infinity, builtAt(x, z), e.position[1]));
      }
    }
    if (lowest < 12) out.push({ severity: 'warning', code: 'airplane.low', message: `transport plane ${e.id} passes ${Math.max(0, Math.round(lowest))} m over the ground or buildings (fly it at least 12 m up, 40+ for a parachute drop)`, targetId: e.id });
    // The route may run outside the boundary (riders can only jump over the play area), but some of it must be over it.
    const area = dropArea(map);
    if (area && e.airdrop !== 'off') {
      const plan = dropPlan(r, (x, z) => x >= area.x0 && x <= area.x1 && z >= area.z0 && z <= area.z1);
      if (!plan.any) out.push({ severity: 'warning', code: 'airplane.nodrop', message: `${e.craft === 'dropship' ? 'dropship' : 'transport plane'} ${e.id} never flies over the play area: its riders can't jump out anywhere (draw some of its route over the map)`, targetId: e.id });
    }
  }
  return out;
}
