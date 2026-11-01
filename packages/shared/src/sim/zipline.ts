import type { Vec3 } from '../math.ts';
import { hypot } from '../math.ts';
import { PLAYER, STANCES, quantize } from './constants.ts';
import type { PhysicsWorld } from './physics.ts';
import type { MoveState } from './movement.ts';
import type { WeaponDefinition } from './weapons.ts';

/**
 * Ziplines (map entity `zipline`, format v25): a cable between two posts.
 * Press E near an end, or under the cable anywhere along it, to grab it; you
 * hang below it and ride toward the far end (a one-way line only from its
 * start to its end; a two-way line toward the end you grabbed away from, or
 * mid-cable the way you face). A trolley motor holds the line's set speed
 * (uphill too); downhill gravity speeds you up to ZIP.topSpeed × it. Jump or E
 * lets go and keeps your momentum; reaching the far end drops you off just
 * before its post. A heavy hit knocks you off (Match.damage).
 *
 * The rider's state is three numbers on MoveState: the line (`zip`, its index
 * in mapZiplines), how far along it from the start (`zs`, metres) and the
 * signed speed along it (`zv`, + toward the end), all quantised, so the
 * server, client prediction and replays from a snapshot agree exactly. Run
 * inside stepMovement; one headroom query a tick per rider.
 */
export const ZIP = {
  /** Gap (m) between your head and the cable while hanging (hands, trolley). */
  handGap: 0.25,
  /** Grab window: within this far (m, across the ground) of the cable, which is this far above your feet. */
  reachSide: 1.5,
  reachLow: 0.9,
  reachHigh: 4.2,
  /** Riders get off this far (m, along the cable) before each post. */
  margin: 1,
  /** Within this far (m) of an end, a two-way line takes you toward the other end whichever way you face. */
  endZone: 3,
  /** The trolley's push (m/s²) up to the set speed, and how much of gravity's pull along the cable speeds you downhill. */
  motor: 9,
  slope: 0.6,
  /** Top speed downhill: the line's speed × this. */
  topSpeed: 1.6,
  /** Grabbing starts you at this share of the set speed (or what you were already carrying along it). */
  startShare: 0.5,
  /** Jumping off throws you up this much (m/s) on top of the ride's own velocity. */
  jumpOff: 3.5,
  /** A hit this hard (or harder) knocks a rider off. */
  knockDamage: 30,
  /** Length (m) and steepness limits (rise over run) a line must keep to. */
  minLength: 6,
  maxLength: 160,
  maxSlope: 0.7,
} as const;

/** A zipline as movement sees it. */
export interface Zipline {
  /** Entity index (and ID) in the map. */
  i: number;
  id: string;
  /** Cable ends: the start post's top and the far post's top. */
  a: Vec3;
  b: Vec3;
  /** Unit direction a → b, and the cable's length. */
  dir: Vec3;
  len: number;
  speed: number;
  twoWay: boolean;
  /** How far (m) the cable droops at its middle: riders hang from the drooping cable as drawn. */
  droop: number;
  /** Only this team can ride it (absent: everyone). */
  team?: string;
}

type ZiplineLike = { kind: string; id: string; position: [number, number, number]; end?: unknown; height?: number; speed?: number; twoWay?: boolean; team?: string; sag?: number };

/** The ziplines of a map, in entity order (shared by the server, client prediction and the bots' navigation). */
export function mapZiplines(entities: readonly ZiplineLike[]): Zipline[] {
  const out: Zipline[] = [];
  entities.forEach((e, i) => {
    if (e.kind !== 'zipline' || !Array.isArray(e.end)) return;
    const [ex, ey, ez] = e.end as [number, number, number];
    const h = e.height ?? 3.6;
    const a = { x: e.position[0], y: e.position[1] + h, z: e.position[2] };
    const b = { x: a.x + ex, y: a.y + ey, z: a.z + ez };
    const len = Math.hypot(ex, ey, ez);
    if (len < 1e-3) return;
    out.push({ i, id: e.id, a, b, dir: { x: ex / len, y: ey / len, z: ez / len }, len, speed: e.speed ?? 12, twoWay: !!e.twoWay, droop: (e.sag ?? 0.03) * len, ...(e.team ? { team: e.team } : {}) });
  });
  return out;
}

/** How far below the cable a rider's feet hang (body size `scale`). */
export const hangDepth = (scale = 1): number => STANCES[0].height * scale + ZIP.handGap;

/** The point `s` metres along the cable. */
export function cablePoint(z: Zipline, s: number): Vec3 {
  // A parabola through both ends, `droop` down at the middle (speeds follow the straight chord; only the height sags).
  const t = Math.max(0, Math.min(1, s / z.len));
  return { x: z.a.x + z.dir.x * s, y: z.a.y + z.dir.y * s - z.droop * 4 * t * (1 - t), z: z.a.z + z.dir.z * s };
}

/** Where a rider `s` metres along hangs (feet). */
export function hangFeet(z: Zipline, s: number, scale = 1): Vec3 {
  const p = cablePoint(z, s);
  p.y -= hangDepth(scale);
  return p;
}

/** May a body of `team` ride this line? */
export const zipAllows = (z: Zipline, team: string | null | undefined): boolean => !z.team || z.team === team;

/**
 * The line a player standing at `feet` can grab (E), with where along it and
 * which way they'd ride: the nearest cable within reach overhead. Null when
 * none is (or the only one is a one-way line's far end).
 */
export function grabZipline(zips: readonly Zipline[], feet: Vec3, yaw: number, team: string | null | undefined): { zip: number; s: number; sign: 1 | -1 } | null {
  let best: { zip: number; s: number; sign: 1 | -1 } | null = null;
  let bestD: number = ZIP.reachSide;
  for (let k = 0; k < zips.length; k++) {
    const z = zips[k]!;
    if (!zipAllows(z, team) || z.len < ZIP.margin * 2 + 1) continue;
    const hx = z.b.x - z.a.x;
    const hz = z.b.z - z.a.z;
    const h2 = hx * hx + hz * hz;
    const t = h2 > 1e-6 ? Math.max(0, Math.min(1, ((feet.x - z.a.x) * hx + (feet.z - z.a.z) * hz) / h2)) : 0;
    const s = Math.max(ZIP.margin, Math.min(z.len - ZIP.margin, t * z.len));
    const c = cablePoint(z, s);
    const d = hypot(c.x - feet.x, c.z - feet.z);
    const up = c.y - feet.y;
    if (d > bestD || up < ZIP.reachLow || up > ZIP.reachHigh) continue;
    let sign: 1 | -1 = 1;
    if (z.twoWay) {
      if (s <= ZIP.margin + ZIP.endZone) sign = 1;
      else if (s >= z.len - ZIP.margin - ZIP.endZone) sign = -1;
      else sign = Math.sin(yaw) * z.dir.x + Math.cos(yaw) * z.dir.z >= 0 ? 1 : -1;
    } else if (s >= z.len - ZIP.margin - ZIP.endZone) continue;
    bestD = d;
    best = { zip: k, s, sign };
  }
  return best;
}

/** Stamina and its timers carry through a ride unchanged. */
function carry(out: MoveState, state: MoveState): MoveState {
  if (state.stamina !== undefined) out.stamina = state.stamina;
  if (state.rest) out.rest = state.rest;
  if (state.winded) out.winded = state.winded;
  return out;
}

/** Start riding: hang from the line at the grab point, moving off at part of its speed (more if you were already moving along it). */
export function startRide(zips: readonly Zipline[], state: MoveState, grab: { zip: number; s: number; sign: 1 | -1 }): MoveState {
  const z = zips[grab.zip]!;
  const along = ((state.vx ?? 0) * z.dir.x + (state.vz ?? 0) * z.dir.z) * grab.sign;
  const v = Math.max(z.speed * ZIP.startShare, Math.min(z.speed * ZIP.topSpeed, along));
  return carry({ pos: state.pos, velY: 0, grounded: false, zip: grab.zip, zs: quantize(grab.s), zv: quantize(v * grab.sign) }, state);
}

/**
 * Let go: you keep the ride's velocity (as push velocity, which fades in the
 * air like any other), plus a hop when you jumped off. `keep` scales the
 * momentum (0: drop straight down, at the end of the line).
 */
export function leaveZipline(zips: readonly Zipline[], state: MoveState, jump = false, keep = 1): MoveState {
  const z = state.zip !== undefined ? zips[state.zip] : undefined;
  const v = (state.zv ?? 0) * keep;
  const out: MoveState = { pos: state.pos, velY: quantize((z ? z.dir.y * v : 0) + (jump ? ZIP.jumpOff : 0)), grounded: false };
  const vx = z ? quantize(z.dir.x * v) : 0;
  const vz = z ? quantize(z.dir.z * v) : 0;
  if (vx || vz) {
    out.vx = vx;
    out.vz = vz;
  }
  return carry(out, state);
}

/**
 * One tick on the line. Jump or E (`letGo`) lets go; otherwise the trolley
 * runs on, and at the far end (or bumping into something) drops you off.
 */
export function rideZipline(physics: PhysicsWorld, zips: readonly Zipline[], state: MoveState, letGo: boolean, jump: boolean, dt: number, scale = 1, gravity = 1): MoveState {
  const z = state.zip !== undefined ? zips[state.zip] : undefined;
  if (!z) return leaveZipline(zips, state);
  if (letGo) return leaveZipline(zips, state, jump);
  const sign = (state.zv ?? 0) < 0 ? -1 : 1;
  let v = Math.abs(state.zv ?? 0);
  // Downhill (sinking along the way you ride): gravity pulls you faster; uphill the motor holds the set speed.
  const down = -z.dir.y * sign;
  if (down > 0) v += PLAYER.gravity * gravity * down * ZIP.slope * dt;
  else if (v > z.speed) v = Math.max(z.speed, v + PLAYER.gravity * gravity * down * dt);
  if (v < z.speed) v = Math.min(z.speed, v + ZIP.motor * dt);
  v = Math.min(v, z.speed * ZIP.topSpeed);
  let s = (state.zs ?? 0) + sign * v * dt;
  const arrive = sign > 0 ? s >= z.len - ZIP.margin : s <= ZIP.margin;
  if (arrive) s = sign > 0 ? z.len - ZIP.margin : ZIP.margin;
  const feet = hangFeet(z, s, scale);
  const pos = { x: quantize(feet.x), y: quantize(feet.y), z: quantize(feet.z) };
  // Something in the way of your body (a ledge the line runs too close to): you're knocked off where you were.
  if (!physics.headroom(pos, STANCES[0].height * scale, PLAYER.radius * scale)) return leaveZipline(zips, state, false, 0);
  const next = carry({ pos, velY: quantize(z.dir.y * sign * v), grounded: false, zip: state.zip, zs: quantize(s), zv: quantize(sign * v) }, state);
  // At the end: off at the post, dropping onto the ground or platform under it.
  return arrive ? leaveZipline(zips, next, false, 0) : next;
}

/**
 * Navmesh links for bots: from the ground where you grab a line near its
 * start to where it drops you at the end (and back, for a two-way line).
 * Lines whose ends have no ground within reach below are left out.
 */
export function ziplineLinks(zips: readonly Zipline[], physics: PhysicsWorld): { start: Vec3; end: Vec3 }[] {
  const out: { start: Vec3; end: Vec3 }[] = [];
  const ground = (z: Zipline, s: number, maxDrop: number): Vec3 | null => {
    const c = cablePoint(z, s);
    const d = physics.raycastWorld({ x: c.x, y: c.y - 0.3, z: c.z }, { x: 0, y: -1, z: 0 }, maxDrop);
    return d === null ? null : { x: c.x, y: c.y - 0.3 - d, z: c.z };
  };
  for (const z of zips) {
    if (z.len < ZIP.margin * 2 + 1) continue;
    const near = ZIP.margin + 0.6;
    const legs: [number, number][] = [[near, z.len - ZIP.margin]];
    if (z.twoWay) legs.push([z.len - near, ZIP.margin]);
    for (const [from, to] of legs) {
      // Where to stand to grab it: the cable must be within reach overhead.
      const start = ground(z, from, ZIP.reachHigh - 0.3);
      const end = ground(z, to, 12);
      if (start && end && cablePoint(z, from).y - start.y >= ZIP.reachLow) out.push({ start, end });
    }
  }
  return out;
}

/** A zipline problem for the map validator (ValidationIssue's shape). */
export interface ZiplineIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  targetId: string;
}

/** Shape rules that need no physics: length and steepness. */
export function ziplineShapeIssues(entities: readonly ZiplineLike[]): ZiplineIssue[] {
  const out: ZiplineIssue[] = [];
  for (const e of entities) {
    if (e.kind !== 'zipline' || !Array.isArray(e.end)) continue;
    const [ex, ey, ez] = e.end as [number, number, number];
    const run = Math.hypot(ex, ez);
    const len = Math.hypot(ex, ey, ez);
    if (len < ZIP.minLength) out.push({ severity: 'error', code: 'zipline.short', message: `zipline ${e.id} is ${len.toFixed(1)} m long: make it at least ${ZIP.minLength} m (drag its far end further out)`, targetId: e.id });
    else if (len > ZIP.maxLength) out.push({ severity: 'error', code: 'zipline.long', message: `zipline ${e.id} is ${Math.round(len)} m long: at most ${ZIP.maxLength} m`, targetId: e.id });
    if (len >= ZIP.minLength && Math.abs(ey) > run * ZIP.maxSlope) {
      out.push({ severity: 'error', code: 'zipline.steep', message: `zipline ${e.id} is too steep (${Math.round((Math.atan2(Math.abs(ey), run) * 180) / Math.PI)}°): keep it under ${Math.round((Math.atan(ZIP.maxSlope) * 180) / Math.PI)}° (move one end up or down, or further away)`, targetId: e.id });
    }
  }
  return out;
}

/**
 * Checks that need the level: the cable and the hanging rider's body clear of
 * solid geometry all the way along (segment raycasts), and ground under both
 * ends to grab it from and to land on.
 */
export function ziplineClearanceIssues(entities: readonly ZiplineLike[], physics: PhysicsWorld): ZiplineIssue[] {
  const out: ZiplineIssue[] = [];
  for (const z of mapZiplines(entities)) {
    if (z.len < ZIP.minLength) continue;
    const s0 = ZIP.margin;
    const s1 = z.len - ZIP.margin;
    const hang = hangDepth();
    // The cable (just under it, so a post's own platform edge doesn't count), and the rider's head, middle and feet.
    const lines = [0.1, ZIP.handGap + 0.1, hang / 2, hang - 0.15];
    // Along the drooping cable in short straight pieces.
    const pieces = Math.max(2, Math.ceil((s1 - s0) / 4));
    const blocked = lines.some((drop) => {
      for (let k = 0; k < pieces; k++) {
        const p = cablePoint(z, s0 + ((s1 - s0) * k) / pieces);
        const q = cablePoint(z, s0 + ((s1 - s0) * (k + 1)) / pieces);
        if (!physics.lineOfSight({ x: p.x, y: p.y - drop, z: p.z }, { x: q.x, y: q.y - drop, z: q.z })) return true;
      }
      return false;
    });
    if (blocked) out.push({ severity: 'error', code: 'zipline.blocked', message: `zipline ${z.id}: something solid is in the way of the cable or of riders hanging under it (raise the posts or move them)`, targetId: z.id });
    const below = (s: number, max: number) => {
      const c = cablePoint(z, s);
      const d = physics.raycastWorld({ x: c.x, y: c.y - 0.3, z: c.z }, { x: 0, y: -1, z: 0 }, max);
      return d === null ? null : d + 0.3;
    };
    const ends: [string, number][] = z.twoWay ? [['start', s0 + 0.6], ['end', s1 - 0.6]] : [['start', s0 + 0.6]];
    for (const [which, s] of ends) {
      const d = below(s, 12);
      if (d === null || d > ZIP.reachHigh) out.push({ severity: 'warning', code: 'zipline.out_of_reach', message: `zipline ${z.id}: at its ${which} the cable is ${d === null ? 'not over any ground' : `${d.toFixed(1)} m up`}, out of reach (players grab it from at most ${ZIP.reachHigh} m below)`, targetId: z.id });
    }
    const landings: [string, number][] = z.twoWay ? [['end', s1], ['start', s0]] : [['end', s1]];
    for (const [which, s] of landings) {
      const d = below(s, 12);
      if (d === null || d - hang > 4) out.push({ severity: 'warning', code: 'zipline.no_landing', message: `zipline ${z.id}: riders drop off at its ${which} ${d === null ? 'over nothing' : `${(d - hang).toFixed(1)} m above the ground`} (put the post on ground or a platform)`, targetId: z.id });
    }
  }
  return out;
}

/**
 * Weapons you can use while hanging from a line by one hand: sidearms and
 * melee weapons (held pistol style or as a blade). Two-handed guns stay
 * slung until you let go.
 */
export function oneHanded(def: Pick<WeaponDefinition, 'category' | 'view'>): boolean {
  const style = def.view.hold?.style;
  return style ? style !== 'long' : def.category === 'pistol' || def.category === 'melee';
}
