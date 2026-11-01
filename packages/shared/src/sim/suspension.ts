import type { MountDef } from './mounts.ts';

/**
 * Raycast suspension for wheeled light vehicles (the Warthog feel, step 1):
 * one ray per wheel finds the ground under it, a spring and a damper per
 * wheel push on a sprung body, and the four pushes set the body's height,
 * pitch and roll. The chassis itself still moves as before (the vehicle
 * probe carries it over the ground, PhysicsWorld.moveVehicle); the sprung
 * body rides on top of it: it bounces over bumps, leans out of turns, dives
 * under braking and squats under power, tumbles a little in the air and
 * lands bouncing. Pure maths over numbers (the match samples the ground),
 * so it is deterministic and runs the same on any host.
 *
 * Model: unit mass shared over the wheels (so heave, pitch and roll all
 * ring at the tuning's `freq`), linear around the rest pose (a wheel
 * hanging off the ground pulls like gravity would). Small angles.
 *
 * Frame: +Z forward, +X right (the mount's). `p` > 0 is nose up, `r` > 0
 * leans right (the right side lower), `h` > 0 lifts the body. A wheel's
 * `wheel` offset is how far its hub sits above its rest place on the body
 * (+ compressed, - hanging).
 */
export interface SuspensionTuning {
  /** Wheel contact points (x, z) in the mount's frame. Default: the def's drawn `wheels`. */
  wheels?: [number, number][];
  /** Hub height over the ground at rest (the tyre radius). Default: the drawn wheels' height, else 0.4. */
  hub?: number;
  /** How far a wheel can hang below its rest place (m), and how far it compresses before the bump stop. */
  travel: number;
  bump: number;
  /** Ring frequency (Hz) and damping (share of critical): low and soft is floaty and bouncy. */
  freq: number;
  damping: number;
  /** Steady pitch (rad) per m/s² of forward acceleration (squat under power, dive under brakes). */
  squat: number;
  /** Steady roll (rad) per m/s² of sideways acceleration (leaning out of a turn). */
  lean: number;
  /** In the air: nose-down pitch acceleration (rad/s²), the little tumble. */
  tumble: number;
  /** Share of the landing speed (m/s down) the springs take: the bounce. */
  land: number;
  /** Most the body tilts (rad). */
  maxTilt: number;
  /** The front wheels' drawn steering lock (rad). */
  steer: number;
}

export interface SuspensionState {
  h: number;
  hv: number;
  p: number;
  pv: number;
  r: number;
  rv: number;
  /** Per wheel: hub offset from rest (m, + compressed). */
  wheel: number[];
  /** Per wheel: ground height under it relative to the vehicle's feet (null: nothing in reach), last sampled. */
  ground: (number | null)[];
  /** Wheels touching the ground. */
  contact: number;
  /** The front wheels' steering (-1..1, eased). */
  steer: number;
  /** Nothing moving: a parked vehicle can skip it. */
  settled: boolean;
}

/** A tuning with its wheels resolved. */
export interface SuspensionSetup extends SuspensionTuning {
  points: [number, number][];
  hubY: number;
}

const setups = new WeakMap<MountDef, SuspensionSetup | null>();

/** The def's suspension with its wheels resolved, or null (no raycast suspension: the older drawn-only kind). */
export function suspensionOf(def: MountDef): SuspensionSetup | null {
  let s = setups.get(def);
  if (s !== undefined) return s;
  const t = def.vehicle?.suspension;
  if (!t) s = null;
  else {
    const drawn = def.wheels?.at;
    const points = t.wheels ?? drawn?.map(([x, , z]): [number, number] => [x, z]) ?? [];
    s = points.length >= 3 ? { ...t, points, hubY: t.hub ?? drawn?.[0]?.[1] ?? 0.4 } : null;
  }
  setups.set(def, s);
  return s;
}

export function newSuspension(setup: SuspensionSetup): SuspensionState {
  const n = setup.points.length;
  return { h: 0, hv: 0, p: 0, pv: 0, r: 0, rv: 0, wheel: new Array<number>(n).fill(0), ground: new Array<number | null>(n).fill(0), contact: n, steer: 0, settled: true };
}

/** What the chassis did this step. */
export interface SuspensionInput {
  /** The vehicle probe is on the ground. */
  grounded: boolean;
  /** Forward and rightward acceleration of the chassis (m/s²). */
  aLong: number;
  aLat: number;
  /** Speed (m/s, down) it just landed at, 0 when it didn't. */
  landing: number;
  /** Steering input (-1..1). */
  steer: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Advance the sprung body by `dt` over the ground in `s.ground` (the match samples it first). */
export function stepSuspension(s: SuspensionState, t: SuspensionSetup, dt: number, input: SuspensionInput): void {
  const w = 2 * Math.PI * t.freq;
  const k = w * w;
  const c = 2 * t.damping * w;
  const n = t.points.length;
  if (input.landing > 0) s.hv -= input.landing * t.land;
  let hAcc: number;
  let pAcc: number;
  let rAcc: number;
  let contact = 0;
  if (!input.grounded) {
    // In the air the whole thing falls as one: the body comes back to its rest height on the hubs, the wheels hang,
    // and it keeps the spin it left the ground with, the nose dropping a little (a soft hand keeps it from flipping).
    hAcc = -k * s.h - c * s.hv;
    pAcc = (s.p > -t.maxTilt * 0.7 ? -t.tumble : 0) - s.pv * 0.6;
    rAcc = -s.r * k * 0.08 - s.rv * 0.6;
    for (let i = 0; i < n; i++) s.wheel[i] = -t.travel;
  } else {
    let f = 0;
    let fp = 0;
    let fr = 0;
    let zz = 0;
    let xx = 0;
    for (let i = 0; i < n; i++) {
      const [x, z] = t.points[i]!;
      zz += z * z;
      xx += x * x;
      const g = s.ground[i];
      // Spring extension past rest: the body's hub place over the ground under the wheel.
      const ext = g === null || g === undefined ? Infinity : s.h + z * s.p - x * s.r - g;
      let fi: number;
      if (ext < t.travel) {
        contact++;
        fi = -k * ext - c * (s.hv + z * s.pv - x * s.rv);
        // Past the bump stop: much stiffer, so a hard landing thumps rather than bottoming through.
        if (-ext > t.bump) fi += 8 * k * (-ext - t.bump) - c * 2 * Math.min(0, s.hv + z * s.pv - x * s.rv);
        s.wheel[i] = clamp(-ext, -t.travel, t.bump);
      } else {
        // Hanging: it pulls the body down as its weight would.
        fi = -k * t.travel;
        s.wheel[i] = -t.travel;
      }
      f += fi;
      fp += fi * z;
      fr -= fi * x;
    }
    hAcc = f / n;
    pAcc = fp / Math.max(1e-3, zz) + t.squat * k * input.aLong;
    rAcc = fr / Math.max(1e-3, xx) - t.lean * k * input.aLat;
  }
  s.contact = contact;
  // Semi-implicit Euler: stable at 60 Hz for these stiffnesses.
  s.hv = clamp(s.hv + hAcc * dt, -8, 8);
  s.pv = clamp(s.pv + pAcc * dt, -4, 4);
  s.rv = clamp(s.rv + rAcc * dt, -4, 4);
  s.h += s.hv * dt;
  s.p += s.pv * dt;
  s.r += s.rv * dt;
  const hLo = -t.bump - 0.12;
  const hHi = t.travel + 0.25;
  if (s.h < hLo || s.h > hHi) {
    s.h = clamp(s.h, hLo, hHi);
    s.hv = 0;
  }
  if (Math.abs(s.p) > t.maxTilt) {
    s.p = clamp(s.p, -t.maxTilt, t.maxTilt);
    if (s.p * s.pv > 0) s.pv = 0;
  }
  if (Math.abs(s.r) > t.maxTilt) {
    s.r = clamp(s.r, -t.maxTilt, t.maxTilt);
    if (s.r * s.rv > 0) s.rv = 0;
  }
  s.steer += (input.steer - s.steer) * Math.min(1, dt * 10);
  if (Math.abs(s.steer) < 1e-3) s.steer = 0;
  s.settled = input.grounded && Math.abs(s.hv) + Math.abs(s.pv) + Math.abs(s.rv) < 0.01 && Math.abs(input.aLong) + Math.abs(input.aLat) < 0.05 && s.steer === 0;
}

/**
 * The snapshot entry of a vehicle with suspension (`ms`): [mount index, height (cm), pitch (mrad, + nose up), roll
 * (mrad, + leaning right), steering (-100..100), ...each wheel's hub offset (cm, + compressed)].
 */
export function suspensionSnapshot(index: number, s: SuspensionState): number[] {
  const out = [index, Math.round(s.h * 100), Math.round(s.p * 1000), Math.round(s.r * 1000), Math.round(s.steer * 100)];
  for (const w of s.wheel) out.push(Math.round(w * 100));
  return out;
}
