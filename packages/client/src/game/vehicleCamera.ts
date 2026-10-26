import { viewDirection, type MountDef, type Vec3 } from '@tiletrigger/shared';

/**
 * The camera while you ride something: a cockpit view (the default) or a
 * chase camera for drivers and pilots, picked per vehicle class with H and
 * remembered between sessions. Gunners and passengers always look from
 * their seat; the transport plane always watches from behind.
 *
 * Pure maths over plain numbers (no Babylon), so it can be tested without
 * a scene: the session hands it the drawn pose of the ride and a ray test,
 * and poses the real camera with what comes back (see cameraPose.ts).
 */

export type VehicleClass = 'ground' | 'air';
export type VehicleView = 'cockpit' | 'chase';
export type VehicleViews = Record<VehicleClass, VehicleView>;

const PREF_KEY = 'tiletrigger.vehicleCamera';
const DEFAULT_VIEWS: VehicleViews = { ground: 'cockpit', air: 'cockpit' };

/** How far a driver can look round from the nose in the cockpit (radians each way). */
export const DRIVER_LOOK_LIMIT = 2.3;
/** The server's pitch limits for anyone seated (looking down, looking up). */
export const SEAT_PITCH_MIN = -0.5;
export const SEAT_PITCH_MAX = 0.75;
/** Chase camera: seconds without mouse look before it swings back behind the vehicle. */
export const CHASE_RECENTRE_DELAY = 1.1;

/** Ground vehicles drive; flyers (and the transport plane) are air. */
export function vehicleClass(def: MountDef): VehicleClass {
  return def.vehicle?.fly || def.airplane ? 'air' : 'ground';
}

export function loadVehicleViews(): VehicleViews {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as Partial<Record<VehicleClass, unknown>>;
    const pick = (v: unknown, d: VehicleView): VehicleView => (v === 'cockpit' || v === 'chase' ? v : d);
    return { ground: pick(p.ground, DEFAULT_VIEWS.ground), air: pick(p.air, DEFAULT_VIEWS.air) };
  } catch {
    return { ...DEFAULT_VIEWS };
  }
}

export function saveVehicleViews(v: VehicleViews): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(v));
  } catch {
    // Private windows and blocked storage: the choice lasts for this session.
  }
}

/** The ride as drawn this frame. */
export interface RideFrame {
  def: MountDef;
  /** Mount entity index and your seat in it. */
  index: number;
  seat: number;
  /** Smoothed position (footprint centre on the ground), facing and velocity. */
  pos: Vec3;
  yaw: number;
  vel: Vec3;
  /** The model's drawn tilt (Babylon rotation.x: + is nose down; rotation.z: roll). */
  tilt: { pitch: number; roll: number };
  /** The driver's cockpit eye, carried by the drawn model (tilt, springs and all). */
  cockpitEye: Vec3;
  /** Where a gunner or passenger's eye is: the seat plus standing eye height (where their rounds leave from). */
  seatEye: Vec3;
}

/** What the session looks at: the player's own look angles (InputState), which this adjusts. */
export interface Look {
  yaw: number;
  pitch: number;
}

export interface CameraPose {
  pos: Vec3;
  yaw: number;
  /** Positive looks up. */
  pitch: number;
  roll: number;
  fov: number;
  mode: 'cockpit' | 'chase' | 'seat';
}

/** Distance along a unit ray to the first solid thing (not the ride itself), or null. */
export type RayCast = (from: Vec3, dir: Vec3, maxDist: number) => number | null;

/**
 * Where a ray leaves an upright box turned by `yaw` (the mounts' collision
 * boxes), measured from `from`; null when it misses. Lets the chase camera's
 * ray pass through its own vehicle.
 */
export function rayBoxExit(from: Vec3, dir: Vec3, center: Vec3, half: readonly [number, number, number], yaw: number): number | null {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const d = { x: from.x - center.x, y: from.y - center.y, z: from.z - center.z };
  // Into the box's frame: +X its right (cos, -sin), +Z its forward (sin, cos).
  const o = [d.x * c - d.z * s, d.y, d.x * s + d.z * c];
  const v = [dir.x * c - dir.z * s, dir.y, dir.x * s + dir.z * c];
  let near = -Infinity;
  let far = Infinity;
  for (let i = 0; i < 3; i++) {
    const h = half[i]!;
    if (Math.abs(v[i]!) < 1e-9) {
      if (Math.abs(o[i]!) > h) return null;
      continue;
    }
    const t1 = (-h - o[i]!) / v[i]!;
    const t2 = (h - o[i]!) / v[i]!;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
  }
  return near <= far && far >= 0 ? far : null;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (dt: number, rate: number) => Math.min(1, dt * rate);

export class VehicleCamera {
  views: VehicleViews = loadVehicleViews();
  /** The ride (index and seat) the state below belongs to. */
  private key: string | null = null;
  private lastYaw = 0;
  private leftYaw = 0;
  private leftPitch = 0;
  private idle = 0;
  private tiltX = 0;
  private tiltZ = 0;
  private orbitYaw = 0;
  private dist = 0;
  private reach: number | null = null;
  private fov = 0;

  /** The view a driver of `def` gets now. */
  viewFor(def: MountDef): VehicleView {
    return this.views[vehicleClass(def)];
  }

  /** H while driving: switch this class of vehicle between cockpit and chase, and remember it. */
  toggle(def: MountDef): VehicleView {
    const cls = vehicleClass(def);
    this.views = { ...this.views, [cls]: this.views[cls] === 'cockpit' ? 'chase' : 'cockpit' };
    saveVehicleViews(this.views);
    this.reach = null;
    return this.views[cls];
  }

  /** Out of the ride: the next one starts fresh (and the on-foot view never sees any of this). */
  reset(): void {
    this.key = null;
  }

  /** Whether the seat's view is the driver's choice (cockpit or chase) rather than a fixed seat view. */
  static drives(def: MountDef, seat: number): boolean {
    return def.seats[seat]?.role === 'driver' && def.kind === 'vehicle' && !def.airplane;
  }

  update(dt: number, r: RideFrame, look: Look, cast: RayCast, baseFov: number): CameraPose {
    const seat = r.def.seats[r.seat];
    const role = seat?.role ?? 'passenger';
    const driver = VehicleCamera.drives(r.def, r.seat);
    const key = `${r.index}:${r.seat}`;
    if (key !== this.key) {
      this.key = key;
      this.lastYaw = r.yaw;
      // Taking the wheel: face where the vehicle points.
      if (driver) look.yaw = r.yaw;
      this.leftYaw = look.yaw;
      this.leftPitch = look.pitch;
      this.idle = 0;
      this.tiltX = this.tiltZ = 0;
      this.orbitYaw = look.yaw;
      this.dist = 0;
      this.reach = null;
      this.fov = baseFov;
    }
    // Mouse look since the last frame (before the vehicle's turn is added).
    const looked = Math.abs(wrap(look.yaw - this.leftYaw)) > 1e-5 || Math.abs(look.pitch - this.leftPitch) > 1e-5;
    this.idle = looked ? 0 : this.idle + dt;
    // Drivers and riders turn with the vehicle; gun seats stay on target (a stabilised mount) within their arc.
    const turn = wrap(r.yaw - this.lastYaw);
    this.lastYaw = r.yaw;
    if (role !== 'gunner') look.yaw += turn;
    let rel = wrap(look.yaw - r.yaw);
    let want = rel;
    if (seat?.arc !== undefined && role === 'gunner') {
      const off = seat.facing ?? 0;
      want = off + clamp(wrap(rel - off), -seat.arc, seat.arc);
    } else if (driver) want = clamp(rel, -DRIVER_LOOK_LIMIT, DRIVER_LOOK_LIMIT);
    look.pitch = clamp(look.pitch, SEAT_PITCH_MIN, SEAT_PITCH_MAX);
    const mode: CameraPose['mode'] = r.def.airplane ? 'chase' : driver ? this.viewFor(r.def) : 'seat';
    // The chase camera swings back behind the vehicle once you stop looking about.
    if (mode === 'chase' && driver && this.idle > CHASE_RECENTRE_DELAY) {
      want *= 1 - ease(dt, 2.5);
      look.pitch *= 1 - ease(dt, 2.5);
    }
    look.yaw += wrap(want - rel);
    rel = want;
    this.leftYaw = look.yaw;
    this.leftPitch = look.pitch;

    const air = vehicleClass(r.def) === 'air';
    if (mode !== 'chase') {
      this.reach = null;
      this.fov = baseFov;
      // The view leans with the vehicle only gently (damped and clamped); guns stay level so the reticle is true.
      const follow = role === 'gunner' ? 0 : air ? 0.6 : 0.35;
      const maxX = air ? 0.35 : 0.1;
      const maxZ = air ? 0.35 : 0.07;
      this.tiltX += (clamp(r.tilt.pitch * follow, -maxX, maxX) - this.tiltX) * ease(dt, 3);
      this.tiltZ += (clamp(r.tilt.roll * follow, -maxZ, maxZ) - this.tiltZ) * ease(dt, 3);
      // The vehicle's tilt as seen looking `rel` off its nose: its pitch turns into roll as you look to the side.
      const c = Math.cos(rel);
      const s = Math.sin(rel);
      const rx = this.tiltX * c - this.tiltZ * s;
      const rz = this.tiltX * s + this.tiltZ * c;
      this.orbitYaw = look.yaw;
      return { pos: driver ? r.cockpitEye : r.seatEye, yaw: look.yaw, pitch: look.pitch - rx, roll: rz, fov: baseFov, mode };
    }

    // Chase: a spring on the orbit (not on the world position), so the vehicle stays steady on screen at any speed.
    this.tiltX = this.tiltZ = 0;
    const [, hy, hz] = r.def.half;
    const pivot = { x: r.pos.x, y: r.pos.y + hy * 2 + 0.5, z: r.pos.z };
    const speed = Math.hypot(r.vel.x, air ? r.vel.y : 0, r.vel.z);
    const frac = clamp(speed / (r.def.vehicle?.maxSpeed ?? 20), 0, 1);
    this.orbitYaw += wrap(look.yaw - this.orbitYaw) * ease(dt, 5);
    const orbitPitch = clamp(look.pitch * 0.7 - 0.24, -1.1, 0.5);
    const wantDist = r.def.airplane ? 10 + hz * 1.5 : 3.2 + hz * 1.6 + hy + frac * (2 + hz * 0.6);
    this.dist = this.dist ? this.dist + (wantDist - this.dist) * ease(dt, 2) : wantDist;
    const fwd = viewDirection(this.orbitYaw, orbitPitch);
    const back = { x: -fwd.x, y: -fwd.y, z: -fwd.z };
    // Pull in where a wall or the ground is in the way; ease back out.
    const hit = cast(pivot, back, this.dist + 0.4);
    const allowed = hit === null ? this.dist : Math.max(0.5, hit - 0.4);
    this.reach = this.reach === null || allowed < this.reach ? allowed : this.reach + (allowed - this.reach) * ease(dt, 3);
    this.fov += (baseFov * (1 + 0.14 * frac) - this.fov) * ease(dt, 3);
    const d = this.reach;
    return { pos: { x: pivot.x + back.x * d, y: pivot.y + back.y * d, z: pivot.z + back.z * d }, yaw: this.orbitYaw, pitch: orbitPitch + 0.08, roll: 0, fov: this.fov, mode };
  }
}
