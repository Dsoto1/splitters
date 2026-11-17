import { BUTTON_JUMP, BUTTON_STEER_LOOK, TICK_DT, cloneRigid, lookSteer, rigidFromWire, rigidSpeeds, rigidWireRapier, rotate, stepRigid, yawPitchRoll, type ChassisBody, type ChassisWorld, type MountDef, type PhysicsWorld, type PlayerInput, type RigidSetup, type RigidState, type Vec3 } from '@tiletrigger/shared';

type Collider = ReturnType<PhysicsWorld['createBox']>;
type Quat = RigidState['q'];

/** Prediction of your own rigid vehicle is on unless the page says `?vehiclepredict=0` (to compare, and for tests). */
export function predictVehicles(): boolean {
  try {
    return new URLSearchParams((globalThis as { location?: { search: string } }).location?.search ?? '').get('vehiclepredict') !== '0';
  } catch {
    return true;
  }
}

/** How fast a correction's leftover is drawn away (1/s): about a tenth of a second to fade. */
const CORRECTION_FADE = 10;
/** A correction this large (m) or larger is snapped to, not smoothed (a respawn, a teleport). */
const SNAP = 6;

const slerp = (a: Quat, b: Quat, k: number): Quat => {
  let d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const s = d < 0 ? -1 : 1;
  d *= s;
  // Close enough for a normalised lerp (corrections are small).
  const q = { x: a.x + (s * b.x - a.x) * k, y: a.y + (s * b.y - a.y) * k, z: a.z + (s * b.z - a.z) * k, w: a.w + (s * b.w - a.w) * k };
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
};

/** The pose to draw: the body's origin, its yaw, pitch and roll (as the snapshot's `ms` carries them), steering, springs. */
export interface PredictedPose {
  pos: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  steer: number;
  comp: number[];
  speed: number;
}

/**
 * The driver's own rigid vehicle, predicted (docs/DRIVING_PHYSICS_PLAN.md, "Netcode"): each input steps it here at
 * once, through the same wheelPhysics.ts step the host runs, against the prediction physics; each snapshot's
 * PrivateState.vp (the host's state after the last input it has seen) replaces it, and the inputs the host hasn't
 * seen yet are stepped again on top. Whatever that moved the vehicle by is drawn away over a tenth of a second
 * instead of jumping. Everyone else's vehicles stay as the snapshots draw them.
 */
export class VehiclePrediction {
  state: RigidState;
  /** The state a tick before, to draw between the two. */
  private prev: RigidState;
  /** The drawn correction still to fade: position (m) and orientation (what the drawn one is turned from the true). */
  private errPos: Vec3 = { x: 0, y: 0, z: 0 };
  private errRot: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly world: ChassisWorld;
  /** The hull: a Rapier body (driving physics 4, as the host's), or the capsule the step sweeps (`?drive=own` hosts). */
  private readonly probe: Collider | null;
  private readonly chassis: ChassisBody | null;
  /** Corrections taken (count, and the largest and last in metres), for the net lab and browser tests. */
  corrections = 0;
  lastCorrection = 0;
  worstCorrection = 0;

  constructor(
    readonly mount: number,
    readonly def: MountDef,
    readonly setup: RigidSetup,
    private readonly physics: PhysicsWorld,
    /** The vehicle's own box in the prediction physics (MountState): its rays and sweep leave it out. */
    body: Collider,
    wire: readonly number[],
  ) {
    // As the host solves it (the wire says).
    const rapier = rigidWireRapier(wire);
    this.probe = rapier ? null : physics.createChassisProbe(setup.probeR, setup.probeHalf);
    this.chassis = rapier ? physics.createChassisBody(setup.hullPoints, setup.hullBorder, setup.com, [1 / setup.invI[0], 1 / setup.invI[1], 1 / setup.invI[2]], setup.hullFriction) : null;
    this.world = physics.chassisWorld(this.probe, body, this.chassis ?? undefined);
    this.state = rigidFromWire(setup, wire)!;
    this.prev = cloneRigid(this.state);
  }

  dispose(): void {
    if (this.probe) this.physics.removeCollider(this.probe);
    if (this.chassis) this.physics.removeChassisBody(this.chassis);
  }

  /** One predicted tick with this input (as the host turns it into the drive: Match.applyInputs). */
  step(input: PlayerInput): void {
    this.prev = cloneRigid(this.state);
    this.advance(this.state, input);
  }

  private advance(s: RigidState, input: PlayerInput): void {
    const yaw = yawPitchRoll(s.q).yaw;
    const right = input.buttons & BUTTON_STEER_LOOK ? lookSteer(input.right, input.yaw, yaw, rigidSpeeds(s).forward) : input.right;
    stepRigid(s, this.setup, this.world, { forward: input.forward, right, brake: !!(input.buttons & BUTTON_JUMP), piloted: true }, TICK_DT);
  }

  /** The host's state (PrivateState.vp), with the inputs it hasn't seen yet stepped again on top. */
  reconcile(wire: readonly number[], pending: readonly PlayerInput[]): void {
    const fresh = rigidFromWire(this.setup, wire);
    if (!fresh) return;
    const before = this.state;
    let prev = cloneRigid(fresh);
    for (const input of pending) {
      prev = cloneRigid(fresh);
      this.advance(fresh, input);
    }
    const d = { x: before.pos.x - fresh.pos.x, y: before.pos.y - fresh.pos.y, z: before.pos.z - fresh.pos.z };
    const err = Math.hypot(d.x, d.y, d.z);
    this.state = fresh;
    this.prev = pending.length ? prev : cloneRigid(fresh);
    if (err > SNAP) {
      this.errPos = { x: 0, y: 0, z: 0 };
      this.errRot = { x: 0, y: 0, z: 0, w: 1 };
      return;
    }
    // Keep drawing where it was: the difference joins the correction still fading.
    this.errPos = { x: this.errPos.x + d.x, y: this.errPos.y + d.y, z: this.errPos.z + d.z };
    // errRot such that errRot * fresh.q = errRot_old * before.q.
    const b = mul(this.errRot, before.q);
    this.errRot = mul(b, conj(fresh.q));
    if (err > 0.01) {
      this.corrections++;
      this.lastCorrection = err;
      this.worstCorrection = Math.max(this.worstCorrection, err);
    }
  }

  /** Let the correction fade by `dt` seconds (once a frame). */
  fade(dt: number): void {
    const k = Math.exp(-CORRECTION_FADE * dt);
    this.errPos = { x: this.errPos.x * k, y: this.errPos.y * k, z: this.errPos.z * k };
    this.errRot = slerp({ x: 0, y: 0, z: 0, w: 1 }, this.errRot, k);
  }

  /** The pose to draw, `alpha` of the way from the last tick to this one, the fading correction on top. */
  pose(alpha: number): PredictedPose {
    const a = Math.max(0, Math.min(1, alpha));
    const p = this.prev;
    const s = this.state;
    const pos = { x: p.pos.x + (s.pos.x - p.pos.x) * a + this.errPos.x, y: p.pos.y + (s.pos.y - p.pos.y) * a + this.errPos.y, z: p.pos.z + (s.pos.z - p.pos.z) * a + this.errPos.z };
    const q = mul(this.errRot, slerp(p.q, s.q, a));
    const { yaw, pitch, roll } = yawPitchRoll(q);
    return { pos, yaw, pitch, roll, steer: s.steer, comp: s.comp.map((c, i) => (p.comp[i] ?? c) + (c - (p.comp[i] ?? c)) * a), speed: rigidSpeeds(s).forward };
  }

  /** Where a point of the vehicle (its frame) is in the predicted state now. */
  point(o: readonly [number, number, number]): Vec3 {
    const d = rotate(this.state.q, { x: o[0], y: o[1], z: o[2] });
    return { x: this.state.pos.x + d.x, y: this.state.pos.y + d.y, z: this.state.pos.z + d.z };
  }
}

function mul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function conj(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}
