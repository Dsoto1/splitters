import type { Vec3 } from '../math.ts';
import type { MountDef } from './mounts.ts';
import { PLAYER } from './constants.ts';

/**
 * Rigid vehicles (docs/DRIVING_PHYSICS_PLAN.md, step 1): a chassis that is a real body (position, velocity,
 * orientation, spin) on sprung raycast wheels, with tyres whose grip can fail.
 *
 * - **Wheels.** One ray per wheel along the chassis' own down finds the ground and its slope. A preloaded spring and
 *   a damper per wheel push along the chassis' up at the hub: the body bounces, squats, dives, leans and lands on
 *   its springs, and the push is off the centre of mass, so it pitches and rolls for real (and can roll over).
 * - **Tyres.** At each contact patch the tyre pushes along the ground (drive, brakes) and across it (cornering,
 *   killing the sideways slip), but never more than the friction it has: `grip` times the load on that wheel. Past
 *   it the tyre slides and keeps only `slide` of that (kinetic friction), so a slope steeper than the grip holds
 *   slides back down, a hard turn flat out drifts, and the handbrake locks the rear wheels.
 * - **Hull.** The box's corners are contact points too (penalty springs with friction, only cast for when it leans
 *   or leaves the ground), so it lands on its nose, tips onto its side and slides on its roof. A capsule sweep
 *   (PhysicsWorld.sweepChassis) keeps the hull out of walls and floors whatever the springs do.
 * - **Air.** Gravity and momentum; the driver can pitch (W/S) and roll (A/D) a little to land it.
 * - **Self-righting.** On its side or roof and stopped for a moment, it rolls itself back onto its wheels.
 *
 * Pure maths over the queries in `ChassisWorld`, so the match (host) and the driver's own prediction (client) run
 * the same steps from the same state. Unit mass: forces are accelerations (m/s²), inertia is the box's per kilogram.
 * Frame: +X right, +Y up, +Z forward (a mount's frame); the state's `pos` is the body's origin (the middle of its
 * footprint at the bottom of its box, where a classic vehicle's feet are).
 */
export interface RigidTuning {
  /** Centre of mass over the feet (m): higher tips easier. */
  com: number;
  /** Peak tyre friction (share of the wheel's load) and the share kept while sliding. */
  grip: number;
  slide: number;
  /** How hard a tyre fights its sideways slip (1/s): higher is crisper, lower is looser. Front, rear. */
  corner: [number, number];
  /** Rotational inertia: multiplies the box's (lower spins and flips sooner). */
  inertia: number;
  /** In the air the nose follows its arc and rolls ease level at this rate (rad/s² per rad off). */
  airLevel: number;
  /** Air control (rad/s²): W/S pitch, A/D roll. */
  airPitch: number;
  airRoll: number;
  /** Seconds tipped over and stopped before it rights itself, with a driver and without. */
  rightAfter: [number, number];
  /** The rear wheels' steering against the front's at a standstill (a share, fading out by top speed). */
  rearSteer: number;
  /** Low-speed drive boost: the engine's push at a standstill, as a multiple of `accel` (falls to 1 by half speed). */
  launch: number;
}

/** A rigid vehicle's state: what the host keeps, and what the driver's prediction starts from (PrivateState.vp). */
export interface RigidState {
  pos: Vec3;
  /** Orientation (world from body), a unit quaternion. */
  q: { x: number; y: number; z: number; w: number };
  vel: Vec3;
  /** Spin (rad/s, world axes). */
  spin: Vec3;
  /** The front wheels' steering (-1..1, eased). */
  steer: number;
  /** Ticks tipped over and stopped; ticks left of righting itself (0: not). */
  tipped: number;
  righting: number;
  /** Ticks with no wheel on the ground, and the throttle and steering it left the ground with (air control's neutral). */
  air: number;
  airIn: [number, number];
  /** Per wheel: compression from rest (m, + compressed) and whether it touches; for drawing and grip. */
  comp: number[];
  contact: number;
  /** Wheels sliding (past their grip) last tick. */
  sliding: number;
  /** The hull touched something last tick (its corner rays stay on for the next). */
  hull: boolean;
  /** Ticks resting with nobody at the wheel: past REST_TICKS it sleeps (looked at now and then). */
  rest: number;
}

/** A rigid vehicle's numbers, resolved from its def (rigidOf). */
export interface RigidSetup extends RigidTuning {
  points: [number, number][];
  /** Hub height over the feet at rest, tyre radius, travel, bump stop. */
  hubY: number;
  radius: number;
  travel: number;
  bump: number;
  /** Spring stiffness and damping per wheel (per kg of the whole vehicle). */
  k: number;
  c: number;
  /** The front wheels' steering lock (rad). */
  lock: number;
  half: [number, number, number];
  /** Inverse inertia about the body's x, y and z (per kg). */
  invI: [number, number, number];
  maxSpeed: number;
  reverseSpeed: number;
  accel: number;
  idleBrake: number;
  drift: number;
  /** The hull sweep's capsule: radius and half length (between its end caps). */
  probeR: number;
  probeHalf: number;
  /** The capsule's middle over the feet, and the hull's underside (its bottom corners: the model's ride height). */
  probeY: number;
  belly: number;
}

/** What the chassis asks of the world (PhysicsWorld.chassisWorld on the host, the same over the prediction physics). */
export interface ChassisWorld {
  /** First hit along `dir` (unit) within `len`: distance and the surface normal there. */
  ray(origin: Vec3, dir: Vec3, len: number): { dist: number; normal: Vec3 } | null;
  /** Move the hull's capsule (its middle at `centre`, turned by `q`) by `delta`: what it got and the normals it met. */
  sweep(centre: Vec3, q: RigidState['q'], delta: Vec3): { moved: Vec3; normals: Vec3[] };
}

/** The driver's controls for one tick. */
export interface RigidInput {
  forward: number;
  right: number;
  brake: boolean;
  /** Somebody at the wheel (else it brakes to a stop at idleBrake and never uses air control). */
  piloted: boolean;
  /** Tyre grip and top speed multipliers (a track's road; water). Default 1. */
  grip?: number;
  speed?: number;
}

/** What happened in a step, for the match (damage, crashes, events). */
export interface RigidStepResult {
  /** Speed (m/s, down) it landed at after a while in the air, else 0. */
  landing: number;
  /** Share of the asked movement the hull sweep didn't get (0 free, 1 stopped dead), and the speed lost to it. */
  blocked: number;
  impact: number;
}

const SUBSTEPS = 2;
const GRAVITY = PLAYER.gravity;
const REST_TICKS = 30;
/** Most spin (rad/s) and speed (m/s): a guard against a bad contact flinging it. */
const MAX_SPIN = 14;
const MAX_SPEED = 60;
/** How fast (m/s) a hard contact pushes a corner or a bottomed-out wheel back out of what it is in. */
const CONTACT_PUSH = 2.5;
const HULL_FRICTION = 0.55;
/** How much of the speed into a wall or floor the hull sweep gives back. */
const HULL_BOUNCE = 0.15;
/** Wheels count only on ground facing at least this much along the chassis' up (else the hull's corners do). */
const WHEEL_FACING = 0.35;

const setups = new WeakMap<MountDef, RigidSetup | null>();

/** The def's rigid driving resolved, or null (it drives the classic way: Match.driveVehicle). */
export function rigidOf(def: MountDef): RigidSetup | null {
  let s = setups.get(def);
  if (s !== undefined) return s;
  const v = def.vehicle;
  const t = v?.rigid;
  const susp = v?.suspension;
  if (!v || !t || !susp || v.hover || v.fly) s = null;
  else {
    const points = susp.wheels ?? def.wheels?.at.map(([x, , z]): [number, number] => [x, z]) ?? [];
    const n = points.length;
    const hubY = susp.hub ?? def.wheels?.at[0]?.[1] ?? 0.4;
    const w = 2 * Math.PI * susp.freq;
    const [hx, hy, hz] = def.half;
    // A box's inertia per kg: (b² + c²) / 12 over its full sides, times the tuning's share.
    const ix = (((2 * hy) ** 2 + (2 * hz) ** 2) / 12) * t.inertia;
    const iy = (((2 * hx) ** 2 + (2 * hz) ** 2) / 12) * t.inertia;
    const iz = (((2 * hx) ** 2 + (2 * hy) ** 2) / 12) * t.inertia;
    // The sweep's capsule sits high in the hull and ends short of its nose and tail, clear of the ground the wheels
    // ride over (a ramp's foot, a kerb): the hull's corner rays and the wheels do the touching, it only stops it in walls.
    const probeR = Math.min(hx * 0.8, hy * 0.6);
    s =
      n >= 3
        ? {
            ...t,
            points,
            hubY,
            radius: def.wheels?.radius ?? hubY,
            travel: susp.travel,
            bump: susp.bump,
            k: (w * w) / n,
            c: (2 * susp.damping * w) / n,
            lock: susp.steer,
            half: def.half,
            invI: [1 / ix, 1 / iy, 1 / iz],
            maxSpeed: v.maxSpeed,
            reverseSpeed: v.reverseSpeed,
            accel: v.accel,
            idleBrake: v.idleBrake ?? 10,
            drift: v.drift ?? 0,
            probeR,
            probeHalf: Math.max(0.05, hz - probeR - 0.1),
            probeY: hy + 0.05,
            belly: Math.max(0.05, def.rideHeight ?? 0.05),
          }
        : null;
  }
  setups.set(def, s);
  return s;
}

// ---------------------------------------------------------------- small vector and quaternion maths

type Q = RigidState['q'];
const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a: Vec3): number => Math.sqrt(dot(a, a));
const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : v3(0, 0, 0);
};
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** `v` turned by `q`. */
export function rotate(q: Q, v: Vec3): Vec3 {
  // v + 2w (u × v) + 2 u × (u × v), u the quaternion's vector part.
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return v3(v.x + q.w * tx + (q.y * tz - q.z * ty), v.y + q.w * ty + (q.z * tx - q.x * tz), v.z + q.w * tz + (q.x * ty - q.y * tx));
}

/** `v` (world) in the body's frame. */
function unrotate(q: Q, v: Vec3): Vec3 {
  return rotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, v);
}

/** Upright, facing `yaw` (forward (sin yaw, cos yaw), as mounts.ts mountToWorld). */
export function yawQuat(yaw: number): Q {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

/**
 * Yaw, pitch (+ nose up) and roll (+ leaning right: the right side lower) of an orientation, in the order the client
 * draws them (Babylon's rotation y = yaw, x = -pitch, z = -roll: roll first, then pitch, then yaw), so the snapshot's
 * yaw and the suspension entry's pitch and roll (`ms`) draw it exactly, upside down included.
 */
export function yawPitchRoll(q: Q): { yaw: number; pitch: number; roll: number } {
  const f = rotate(q, v3(0, 0, 1));
  const r = rotate(q, v3(1, 0, 0));
  const u = rotate(q, v3(0, 1, 0));
  return { yaw: Math.atan2(f.x, f.z), pitch: Math.asin(clamp(f.y, -1, 1)), roll: -Math.atan2(r.y, u.y) };
}

export function newRigid(setup: RigidSetup, pos: Vec3, yaw: number): RigidState {
  return { pos: { ...pos }, q: yawQuat(yaw), vel: v3(0, 0, 0), spin: v3(0, 0, 0), steer: 0, tipped: 0, righting: 0, air: 0, airIn: [0, 0], comp: setup.points.map(() => 0), contact: setup.points.length, sliding: 0, hull: false, rest: 0 };
}

/** Its up axis's height share (1 upright, 0 on its side, -1 on its roof). */
export function uprightness(s: RigidState): number {
  return rotate(s.q, v3(0, 1, 0)).y;
}

/** Forward and rightward speed (m/s) along its heading on the level (the classic `speed` and `slide`). */
export function rigidSpeeds(s: RigidState): { forward: number; side: number } {
  const f = rotate(s.q, v3(0, 0, 1));
  const h = Math.hypot(f.x, f.z) || 1;
  const fx = f.x / h;
  const fz = f.z / h;
  return { forward: s.vel.x * fx + s.vel.z * fz, side: s.vel.x * fz - s.vel.z * fx };
}

// ---------------------------------------------------------------- the step

interface WheelHit {
  /** A point on the ground and its normal. */
  p: Vec3;
  n: Vec3;
}

interface HullHit {
  /** The corner in the body's frame, how deep it is in and the normal pushing it out. */
  corner: Vec3;
  depth: number;
  n: Vec3;
  /** Where the corner was when the ray found it. */
  at: Vec3;
}

/** The body's inverse inertia applied to a world vector. */
function invInertia(s: RigidState, t: RigidSetup, v: Vec3): Vec3 {
  const b = unrotate(s.q, v);
  return rotate(s.q, v3(b.x * t.invI[0], b.y * t.invI[1], b.z * t.invI[2]));
}

/**
 * Hard contacts as impulses (a few sequential passes): each stops the point going further in, pushes it back out at
 * a capped speed (no spring to store a landing and throw it back up), and with `friction` scrubs it along the surface.
 */
function solveContacts(s: RigidState, t: RigidSetup, com: Vec3, stops: { at: Vec3; n: Vec3; depth: number; friction: number }[]): void {
  const total = stops.map(() => 0);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < stops.length; i++) {
      const c = stops[i]!;
      const r = sub(c.at, com);
      const vel = add(s.vel, cross(s.spin, r));
      const vn = dot(vel, c.n);
      const out = c.depth > 0.01 ? Math.min(CONTACT_PUSH, (c.depth - 0.01) * 10) : 0;
      const rn = cross(r, c.n);
      const k = 1 + dot(c.n, cross(invInertia(s, t, rn), r));
      const j = Math.max(-total[i]!, (out - vn) / k);
      if (j === 0) continue;
      total[i]! += j;
      s.vel = add(s.vel, scale(c.n, j));
      s.spin = add(s.spin, invInertia(s, t, scale(rn, j)));
      if (!c.friction || total[i]! <= 0) continue;
      // Friction along the surface, up to `friction` of the push.
      const v2 = add(s.vel, cross(s.spin, r));
      const vt = sub(v2, scale(c.n, dot(v2, c.n)));
      const vtl = len(vt);
      if (vtl < 1e-5) continue;
      const dir = scale(vt, 1 / vtl);
      const rt = cross(r, dir);
      const kt = 1 + dot(dir, cross(invInertia(s, t, rt), r));
      const jt = Math.min(vtl / kt, c.friction * j);
      s.vel = sub(s.vel, scale(dir, jt));
      s.spin = sub(s.spin, invInertia(s, t, scale(rt, jt)));
    }
  }
}

/** The hull's contact points in the body's frame: its eight corners, the long sides a touch inside the tyres. */
function hullCorners(t: RigidSetup): Vec3[] {
  const [hx, hy, hz] = t.half;
  const out: Vec3[] = [];
  for (const y of [t.belly, hy * 2]) for (const x of [-hx * 0.9, hx * 0.9]) for (const z of [-hz, hz]) out.push(v3(x, y, z));
  return out;
}
const cornerCache = new WeakMap<RigidSetup, Vec3[]>();

/**
 * Advance a rigid vehicle one tick (`dt`, the sim's TICK_DT). Casts its wheel rays (and its hull's, when it leans,
 * flies or touched last tick), runs SUBSTEPS of forces and integration over what they found, then sweeps the hull.
 */
export function stepRigid(s: RigidState, t: RigidSetup, world: ChassisWorld, input: RigidInput, dt: number): RigidStepResult {
  const n = t.points.length;
  const gripMul = input.grip ?? 1;
  const speedMul = input.speed ?? 1;
  const out: RigidStepResult = { landing: 0, blocked: 0, impact: 0 };
  // Asleep: parked, settled, nobody aboard; a look every REST_TICKS in case the ground went.
  if (!input.piloted && s.rest > REST_TICKS && s.rest % REST_TICKS !== 0) {
    s.rest++;
    return out;
  }
  const fallSpeed = -s.vel.y;
  // ---- rays, once a tick
  const up0 = rotate(s.q, v3(0, 1, 0));
  const down0 = scale(up0, -1);
  const start = t.bump + 0.15;
  const reach = start + t.radius + t.travel + 0.05;
  const hits: (WheelHit | null)[] = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = t.points[i]!;
    const a = add(s.pos, rotate(s.q, v3(x, t.hubY + start, z)));
    const h = world.ray(a, down0, reach);
    hits.push(h && dot(h.normal, up0) > WHEEL_FACING ? { p: add(a, scale(down0, h.dist)), n: h.normal } : null);
  }
  const hullHits: HullHit[] = [];
  const looks = up0.y < 0.9 || s.contact < n || s.hull || s.comp.some((c) => c > t.bump * 0.8);
  if (looks) {
    let corners = cornerCache.get(t);
    if (!corners) cornerCache.set(t, (corners = hullCorners(t)));
    const mid = v3(0, t.half[1], 0);
    const o = add(s.pos, rotate(s.q, mid));
    for (const c of corners) {
      const d = rotate(s.q, sub(c, mid));
      const l = len(d);
      const h = world.ray(o, scale(d, 1 / l), l);
      if (!h) continue;
      // How deep the corner is past the surface, along that surface's normal.
      const depth = (l - h.dist) * Math.max(0.2, -dot(scale(d, 1 / l), h.normal));
      hullHits.push({ corner: c, depth, n: h.normal, at: add(o, d) });
    }
  }
  s.hull = hullHits.length > 0;

  const h = dt / SUBSTEPS;
  const comAt = v3(0, t.com, 0);
  const startPos = { ...s.pos };
  const startCom = add(s.pos, rotate(s.q, comAt));
  let com = { ...startCom };
  let contact = 0;
  let sliding = 0;
  // Steering eases toward the wheel (quicker back to straight); less lock at speed.
  const speed0 = rigidSpeeds(s).forward;
  const frac = Math.min(1, Math.abs(speed0) / t.maxSpeed);
  s.steer += clamp(input.right - s.steer, -dt * 6, dt * 6);
  if (Math.abs(s.steer) < 1e-3) s.steer = 0;
  // The front pair steers; the rear pair a little the other way at low speed (`rearSteer`, gone by top speed), so it
  // turns tight and quick in close quarters and stays steady flat out.
  const delta = s.steer * t.lock * (1 - 0.7 * frac);
  const cd = Math.cos(delta);
  const sd = Math.sin(delta);
  const back = -delta * t.rearSteer * (1 - frac);
  const cb = Math.cos(back);
  const sb = Math.sin(back);
  const target = (input.forward > 0 ? t.maxSpeed * input.forward : input.forward < 0 ? -t.reverseSpeed * -input.forward : 0) * speedMul;
  // Loose at speed (drift): the rear tyres corner less, with the square of speed.
  const rearCorner = t.corner[1] * (1 - t.drift * 0.6 * frac * frac);

  // Air control works on what changed since take-off: throttle and steering held over the lip are neutral (holding W
  // through a jump doesn't dive the nose); pressing W noses down, S (or letting go of W) lifts it, A/D roll.
  const airF = clamp(input.forward - s.airIn[0], -1, 1);
  const airR = clamp(input.right - s.airIn[1], -1, 1);

  for (let sub_ = 0; sub_ < SUBSTEPS; sub_++) {
    const up = rotate(s.q, v3(0, 1, 0));
    const fwd = rotate(s.q, v3(0, 0, 1));
    const rgt = rotate(s.q, v3(1, 0, 0));
    let force = v3(0, -GRAVITY, 0);
    let torque = v3(0, 0, 0);
    const vf = dot(s.vel, fwd);
    // Hard contacts this substep (bump stops, the hull's corners): solved as impulses after the forces.
    const stops: { at: Vec3; n: Vec3; depth: number; friction: number }[] = [];
    contact = 0;
    sliding = 0;
    for (let i = 0; i < n; i++) {
      const hit = hits[i];
      const [x, z] = t.points[i]!;
      const a = add(s.pos, rotate(s.q, v3(x, t.hubY, z)));
      const un = hit ? dot(up, hit.n) : 0;
      // Hub to the ground's plane, along the chassis' down; the tyre's rest is its radius.
      const d = hit && un > WHEEL_FACING ? dot(sub(a, hit.p), hit.n) / un : Infinity;
      const x_ = t.radius - d;
      if (!hit || x_ <= -t.travel) {
        s.comp[i] = -t.travel;
        continue;
      }
      contact++;
      const nrm = hit.n;
      const cp = sub(a, scale(up, d));
      const arm = sub(cp, com);
      const va = add(s.vel, cross(s.spin, sub(a, com)));
      const xdot = -dot(va, nrm) / un;
      // Past the bump stop the spring stays at its stop's force; the stop itself is a hard contact (below).
      let fs = GRAVITY / n + t.k * Math.min(x_, t.bump) + t.c * xdot;
      if (x_ > t.bump) stops.push({ at: cp, n: nrm, depth: (x_ - t.bump) * un, friction: 0 });
      fs = Math.max(0, fs);
      s.comp[i] = clamp(x_, -t.travel, t.bump);
      const load = fs * un;
      // The tyre's own axes on the ground: the front pair steered.
      const front = z > 0;
      const c_ = front ? cd : cb;
      const s_ = front ? sd : sb;
      const fw = add(scale(fwd, c_), scale(rgt, s_));
      const rw = sub(scale(rgt, c_), scale(fwd, s_));
      const ft = norm(sub(fw, scale(nrm, dot(fw, nrm))));
      const st = norm(sub(rw, scale(nrm, dot(rw, nrm))));
      const vc = add(s.vel, cross(s.spin, arm));
      const vl = dot(vc, ft);
      const vs = dot(vc, st);
      const share = 1 / n;
      const rear = !front;
      const locked = input.brake && rear;
      // Along the ground: drive, brakes, the engine holding it.
      let fl: number;
      if (locked) fl = -Math.sign(vl) * Math.min(t.grip * t.slide * load, (share * Math.abs(vl)) / h);
      else if (target !== 0 && (Math.sign(target) === Math.sign(vf) || Math.abs(vf) < 0.5)) {
        const boost = 1 + (t.launch - 1) * Math.max(0, 1 - Math.abs(vf) / (t.maxSpeed * 0.5));
        fl = share * t.accel * boost * clamp((target - vf) / Math.max(2, Math.abs(target) * 0.15), -1, 1);
      } else {
        const decel = target !== 0 ? t.accel * 1.8 : input.piloted ? t.accel * 0.8 : t.idleBrake;
        fl = -Math.sign(vl) * Math.min(share * decel, (share * Math.abs(vl)) / h);
      }
      // Across it: kill the slip, crisper at the front; the rear lets go under the handbrake.
      const corner = (front ? t.corner[0] : rearCorner) * (locked ? 0.35 : 1);
      let fy = -vs * share * Math.min(corner, 0.9 / h);
      // The friction it has: past it the tyre slides, keeping only `slide` of it.
      const most = t.grip * gripMul * load;
      const want = Math.hypot(fl, fy);
      if (want > most) {
        // Past the peak the grip falls off toward `slide` as the slip grows (a locked wheel slides outright).
        const kept = locked ? 1 : 1 - (1 - t.slide) * Math.min(1, (want / most - 1) / 3);
        const k = (most * kept) / want;
        fl *= k;
        fy *= k;
        sliding++;
      }
      const f = add(add(scale(up, fs), scale(ft, fl)), scale(st, fy));
      force = add(force, f);
      torque = add(torque, cross(arm, f));
    }
    // The hull's corners: how deep each is now (the surface it met, as a plane, against where the corner has gone).
    for (const hh of hullHits) {
      const q = add(s.pos, rotate(s.q, hh.corner));
      const depth = hh.depth - dot(sub(q, hh.at), hh.n);
      if (depth > -0.02) stops.push({ at: q, n: hh.n, depth, friction: HULL_FRICTION });
    }
    // Angular acceleration: the torque in the body's frame over its inertia, back to the world.
    const tb = unrotate(s.q, torque);
    let alpha = rotate(s.q, v3(tb.x * t.invI[0], tb.y * t.invI[1], tb.z * t.invI[2]));
    const flying = contact === 0 && hullHits.length === 0;
    if (flying) {
      // An arcade flight: the spin it left the lip with dies away and the nose follows its arc (`airLevel`), rolls ease
      // back level, so a jump taken straight lands on its wheels; the driver's air control works on top.
      const pitchNow = Math.asin(clamp(fwd.y, -1, 1));
      const dir = dot(s.vel, fwd) >= 0 ? 1 : -1;
      const vh = Math.hypot(s.vel.x, s.vel.z);
      if (up.y > 0.3 && vh > 2) {
        const arc = Math.atan2(dir * s.vel.y, vh);
        const roll = -Math.atan2(rgt.y, up.y);
        // Half way to the arc (so a straight jump lands nearly flat), and only on an axis the driver leaves alone.
        const ownPitch = input.piloted && airF !== 0;
        const ownRoll = input.piloted && airR !== 0;
        alpha = add(alpha, add(scale(rgt, ownPitch ? 0 : (pitchNow - arc * 0.5) * t.airLevel), scale(fwd, ownRoll ? 0 : roll * t.airLevel * 0.7)));
      }
      const sx = dot(s.spin, rgt);
      const sz = dot(s.spin, fwd);
      alpha = sub(alpha, add(scale(rgt, sx * 2.5), scale(fwd, sz * 2.5)));
    }
    if (flying && input.piloted) {
      // Air control: W noses down, S up; A/D roll it (a right roll: the right side down).
      alpha = add(alpha, rotate(s.q, v3(airF * t.airPitch, 0, -airR * t.airRoll)));
    }
    if (s.righting > 0) {
      // Rolling itself back onto its wheels: spin up toward upright about the axis that gets there, lifted a little.
      const axis0 = cross(up, v3(0, 1, 0));
      const axis = len(axis0) > 0.05 ? norm(axis0) : fwd;
      const want = scale(axis, 3.2);
      alpha = add(alpha, scale(sub(want, s.spin), 8));
      if (up.y < 0.6) force = add(force, v3(0, GRAVITY * 0.75, 0));
    }
    s.vel = add(s.vel, scale(force, h));
    s.spin = add(s.spin, scale(alpha, h));
    // A little rotational drag (more on the ground: the tyres scrub).
    s.spin = scale(s.spin, 1 - h * (flying ? 0.15 : 0.6));
    const spin = len(s.spin);
    if (spin > MAX_SPIN) s.spin = scale(s.spin, MAX_SPIN / spin);
    const sp = len(s.vel);
    if (sp > MAX_SPEED) s.vel = scale(s.vel, MAX_SPEED / sp);
    if (stops.length) solveContacts(s, t, com, stops);
    // The centre of mass moves; the body turns about it.
    com = add(com, scale(s.vel, h));
    const w = s.spin;
    const q = s.q;
    const nq = {
      x: q.x + 0.5 * h * (w.x * q.w + w.y * q.z - w.z * q.y),
      y: q.y + 0.5 * h * (w.y * q.w + w.z * q.x - w.x * q.z),
      z: q.z + 0.5 * h * (w.z * q.w + w.x * q.y - w.y * q.x),
      w: q.w - 0.5 * h * (w.x * q.x + w.y * q.y + w.z * q.z),
    };
    const ql = Math.hypot(nq.x, nq.y, nq.z, nq.w);
    s.q = { x: nq.x / ql, y: nq.y / ql, z: nq.z / ql, w: nq.w / ql };
    s.pos = sub(com, rotate(s.q, comAt));
  }

  // ---- the hull sweep: from where the hull was by what the tick asked (its turn already applied).
  const mid = v3(0, t.probeY, 0);
  const midBefore = add(startPos, rotate(s.q, mid));
  const wanted = sub(s.pos, startPos);
  const swept = world.sweep(midBefore, s.q, wanted);
  const got = swept.moved;
  const wl = len(wanted);
  if (wl > 1e-6 && len(sub(got, wanted)) > 1e-4) {
    out.blocked = clamp(1 - len(got) / wl, 0, 1);
    s.pos = add(startPos, got);
    // Speed into what it met is lost (a little comes back), and it scrubs along it.
    for (const nn of swept.normals) {
      const vn = dot(s.vel, nn);
      if (vn >= 0) continue;
      out.impact = Math.max(out.impact, -vn);
      s.vel = sub(s.vel, scale(nn, vn * (1 + HULL_BOUNCE)));
      s.vel = scale(s.vel, 0.97);
      s.spin = scale(s.spin, 0.8);
    }
  }

  // ---- bookkeeping: air time, landings, tipping over and righting.
  s.contact = contact;
  s.sliding = sliding;
  if (contact === 0 && !s.hull) {
    if (s.air === 0) s.airIn = [input.forward, input.right];
    s.air++;
  } else {
    if (s.air >= 6 && fallSpeed > 0) out.landing = fallSpeed;
    s.air = 0;
  }
  const upY = uprightness(s);
  if (s.righting > 0) {
    s.righting--;
    if (upY > 0.92 && s.righting > 0) s.righting = Math.min(s.righting, 6);
  } else if (upY < 0.45 && contact < 2 && len(s.vel) < 2.5 && !(contact === 0 && !s.hull)) {
    s.tipped++;
    const after = Math.round(t.rightAfter[input.piloted ? 0 : 1] / dt);
    if (s.tipped >= after) {
      s.tipped = 0;
      s.righting = Math.round(1.4 / dt);
    }
  } else s.tipped = 0;
  // Resting: nobody aboard, on its wheels and still.
  if (!input.piloted && contact === n && len(s.vel) < 0.08 && len(s.spin) < 0.08 && input.forward === 0 && s.righting === 0) s.rest++;
  else s.rest = 0;
  return out;
}

/**
 * The driver's prediction state on the wire (PrivateState.vp): [mount index, x, y, z, qx, qy, qz, qw, vx, vy, vz,
 * spin x, y, z, steer, tipped, righting, air, flags (hull 1, + resting ticks × 2), take-off throttle, take-off steering],
 * rounded.
 */
export function rigidWire(index: number, s: RigidState): number[] {
  const r = (v: number, k: number) => Math.round(v * k) / k;
  return [index, r(s.pos.x, 1e4), r(s.pos.y, 1e4), r(s.pos.z, 1e4), r(s.q.x, 1e6), r(s.q.y, 1e6), r(s.q.z, 1e6), r(s.q.w, 1e6), r(s.vel.x, 1e4), r(s.vel.y, 1e4), r(s.vel.z, 1e4), r(s.spin.x, 1e4), r(s.spin.y, 1e4), r(s.spin.z, 1e4), r(s.steer, 1e4), s.tipped, s.righting, s.air, (s.hull ? 1 : 0) + Math.min(1000, s.rest) * 2, r(s.airIn[0], 1e4), r(s.airIn[1], 1e4)];
}

/** A RigidState from rigidWire's numbers (null: not one). */
export function rigidFromWire(setup: RigidSetup, w: readonly number[]): RigidState | null {
  if (w.length < 21) return null;
  const q = { x: w[4]!, y: w[5]!, z: w[6]!, w: w[7]! };
  const ql = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return {
    pos: v3(w[1]!, w[2]!, w[3]!),
    q: { x: q.x / ql, y: q.y / ql, z: q.z / ql, w: q.w / ql },
    vel: v3(w[8]!, w[9]!, w[10]!),
    spin: v3(w[11]!, w[12]!, w[13]!),
    steer: w[14]!,
    tipped: w[15]!,
    righting: w[16]!,
    air: w[17]!,
    airIn: [w[19]!, w[20]!],
    comp: setup.points.map(() => 0),
    contact: setup.points.length,
    sliding: 0,
    hull: (w[18]! & 1) === 1,
    rest: Math.floor(w[18]! / 2),
  };
}

/** A copy (the prediction keeps the last two ticks' to draw between them). */
export function cloneRigid(s: RigidState): RigidState {
  return { ...s, pos: { ...s.pos }, q: { ...s.q }, vel: { ...s.vel }, spin: { ...s.spin }, comp: [...s.comp], airIn: [s.airIn[0], s.airIn[1]] };
}
