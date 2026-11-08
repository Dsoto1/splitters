import type { Vec3 } from '@tiletrigger/shared';
import type { RemotePose } from './interpolation.ts';

/** A rider's seat: the mount (index) and the seat's offset in the mount's frame (feet, m). */
export interface RiderSeat {
  mount: number;
  offset: readonly [number, number, number];
}

/** Seconds a rider takes to ease onto the seat when getting in, and off it when getting out. */
export const RIDER_BLEND_SECONDS = 0.25;

const smooth = (w: number) => w * w * (3 - 2 * w);

/**
 * Where seated riders are drawn (owner, 2026-11-08: passengers drifted back at speed and slid back into their seats
 * as the vehicle slowed). A rider's own pose is snapshot-interpolated, a little behind the server's clock, while the
 * vehicle is drawn on its own clock (its latest state carried on by its motion, mountState.smooth) and with its
 * suspension; at 20 m/s the two were a couple of metres apart. So every frame a rider is put on the seat point of the
 * vehicle as drawn this frame (`seatPoint`), the same transform the vehicle's model has; getting in and out eases
 * between the rider's own pose and the seat over RIDER_BLEND_SECONDS.
 */
export class RiderPlacement {
  private readonly blend = new Map<number, { w: number; seat: RiderSeat }>();
  /** Slots placed on (or easing on or off) a seat by the last `place`: no footsteps for them. */
  readonly placed = new Set<number>();

  /**
   * Move the poses of riders (`riders`: slot → seat, from the latest snapshot) onto their seats, in place.
   * `seatPoint(mount, offset)`: that point of the mount as drawn now, or null (the mount is gone).
   */
  place(poses: RemotePose[], riders: ReadonlyMap<number, RiderSeat>, seatPoint: (mount: number, offset: RiderSeat['offset']) => Vec3 | null, dt: number): void {
    this.placed.clear();
    const step = Math.max(0, dt) / RIDER_BLEND_SECONDS;
    const seen = new Set<number>();
    for (const p of poses) {
      seen.add(p.slot);
      const seat = p.alive ? riders.get(p.slot) : undefined;
      let st = this.blend.get(p.slot);
      if (!p.alive) {
        this.blend.delete(p.slot);
        continue;
      }
      if (seat) {
        if (!st) this.blend.set(p.slot, (st = { w: 0, seat }));
        st.seat = seat;
        st.w = Math.min(1, st.w + step);
      } else if (st) {
        st.w -= step;
        if (st.w <= 0) {
          this.blend.delete(p.slot);
          continue;
        }
      } else continue;
      const at = seatPoint(st.seat.mount, st.seat.offset);
      if (!at) {
        this.blend.delete(p.slot);
        continue;
      }
      const k = smooth(st.w);
      p.x += (at.x - p.x) * k;
      p.y += (at.y - p.y) * k;
      p.z += (at.z - p.z) * k;
      p.grounded = true;
      this.placed.add(p.slot);
    }
    for (const slot of this.blend.keys()) if (!seen.has(slot)) this.blend.delete(slot);
  }
}
