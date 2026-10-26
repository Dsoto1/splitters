import { angleDelta, clamp, type Vec3 } from '../math.ts';
import type { TrackGeometry } from '../map/track.ts';
import { TICK_RATE } from './constants.ts';

/**
 * A driver that takes any vehicle round a map's track: racing Player Bots
 * use it, and so do the ambient (NPC-driven) cars that lap a track in any
 * mode. It is not tied to a player: give it the vehicle's state and the
 * other vehicles about, and it returns throttle, steering and handbrake.
 *
 * - Look-ahead steering at a point on the centre line further ahead the
 *   faster it goes, in its own lane.
 * - Brakes for the bends it sees coming (how far the road turns ahead).
 * - Overtakes: a slower car in its lane ahead makes it pull out to the other
 *   side for a few seconds; one right on its nose with no way past, it brakes.
 * - Recovers: stuck against something, it backs out; facing the wrong way
 *   (spun, just respawned), it turns before it goes.
 */

/** A vehicle as the driver sees it. */
export interface DrivenVehicle {
  pos: Vec3;
  yaw: number;
  /** Signed speed along the heading (m/s). */
  speed: number;
  maxSpeed: number;
}

export interface DriveCommand {
  forward: number;
  right: number;
  /** Handbrake (jump): for sharp turns at speed. */
  brake: boolean;
}

export class TrackDriver {
  private slow = 0;
  private reverseUntil = 0;
  /** Overtaking: lane offset (-1 left edge .. 1 right edge) to hold until `passUntil`. */
  private pass = 0;
  private passUntil = 0;

  /**
   * `lane`: where on the road it likes to drive (-1 left edge .. 1 right edge).
   * `pace`: 0.85–1, how hard it pushes in the bends.
   */
  constructor(
    readonly lane = 0,
    readonly pace = 1,
  ) {}

  drive(track: TrackGeometry, v: DrivenVehicle, tick: number, others: readonly DrivenVehicle[] = []): DriveCommand {
    const near = track.nearest(v.pos.x, v.pos.z, 400);
    if (!near) return { forward: 0, right: 0, brake: false };
    const speed = Math.max(0, v.speed);
    const s = near.sample.s;
    const fwd = { x: Math.sin(v.yaw), z: Math.cos(v.yaw) };
    // Traffic ahead in our path: pull out to pass it, or brake if it's right on our nose.
    let ahead: { dist: number; car: DrivenVehicle; side: number } | null = null;
    for (const o of others) {
      const rx = o.pos.x - v.pos.x;
      const rz = o.pos.z - v.pos.z;
      const along = rx * fwd.x + rz * fwd.z;
      const side = rx * fwd.z - rz * fwd.x;
      if (along < 1 || along > 10 + speed * 1.2 || Math.abs(side) > 2.8 || Math.abs(o.pos.y - v.pos.y) > 3) continue;
      if (!ahead || along < ahead.dist) ahead = { dist: along, car: o, side };
    }
    let lane = tick < this.passUntil ? this.pass : this.lane;
    let limit = Infinity;
    if (ahead && ahead.car.speed < speed + 1) {
      // Go round the side it isn't on (judged across the road, so we pass on the roomier side).
      const theirs = track.nearest(ahead.car.pos.x, ahead.car.pos.z, track.width)?.lateral ?? ahead.side;
      this.pass = theirs > 0 ? -0.65 : 0.65;
      this.passUntil = tick + TICK_RATE * 2;
      lane = this.pass;
      // Too close to get round: match its speed.
      if (ahead.dist < 7) limit = Math.max(0, ahead.car.speed - 1);
    }
    const look = track.at(s + 7 + speed * 0.7);
    const off = clamp(lane, -1, 1) * (track.width / 2 - 2);
    const aim = { x: look.x + look.dz * off, z: look.z - look.dx * off };
    const err = angleDelta(v.yaw, Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z));
    if (tick < this.reverseUntil) return { forward: -1, right: clamp(-err * 2, -1, 1), brake: false };
    // Stuck against something while trying to go: back out for a second.
    this.slow = Math.abs(v.speed) < 0.8 ? this.slow + 1 : 0;
    if (this.slow > TICK_RATE * 1.5) {
      this.slow = 0;
      this.reverseUntil = tick + TICK_RATE;
      return { forward: -1, right: clamp(-err * 2, -1, 1), brake: false };
    }
    // The bend ahead: how far the road turns between here and a little past the look-ahead point.
    const bendAt = track.at(s + 20 + speed * 1.1);
    const bend = Math.abs(angleDelta(Math.atan2(near.sample.dx, near.sample.dz), Math.atan2(bendAt.dx, bendAt.dz)));
    const corner = bend > 1.4 ? 0.42 : bend > 0.9 ? 0.55 : bend > 0.5 ? 0.72 : bend > 0.25 ? 0.88 : 1;
    const want = Math.min(limit, v.maxSpeed * Math.min(1, corner * (0.88 + 0.12 * this.pace)));
    let forward = speed > want + 3 ? -1 : speed > want ? 0 : 1;
    // Facing well off the road's way (just respawned, spun round): turn first.
    if (Math.abs(err) > 1.6) forward = Math.min(forward, 0.4);
    return { forward, right: clamp(err * 2.4, -1, 1), brake: Math.abs(err) > 0.9 && speed > 10 };
  }
}
