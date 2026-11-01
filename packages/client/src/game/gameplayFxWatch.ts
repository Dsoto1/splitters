import type { JumpPad, Portal, Vec3 } from '@tiletrigger/shared';
import { PAD_RADIUS } from '@tiletrigger/shared';

/** What the watcher needs of a player each frame (remote poses and the local player alike). */
export interface WatchedPose {
  slot: number;
  x: number;
  y: number;
  z: number;
  alive: boolean;
  grounded: boolean;
  zip?: number;
}

interface Seen {
  x: number;
  y: number;
  z: number;
  alive: boolean;
  grounded: boolean;
  zip: number | undefined;
  /** performance.now() of this player's last pad effect. */
  pad: number;
}

/** A player within this of a portal's mouth who then jumps further than TELEPORT in one frame went through it. */
const PORTAL_NEAR = 2.5;
const TELEPORT = 3;
const PAD_COOLDOWN_MS = 900;

/**
 * Moments of play read off players' movement, for their effects (content/vfx.json map.gameplay):
 * coming back to life (`spawn`), stepping through a portal (`portal`, at both ends), being thrown by a
 * jump pad (`pad`) and grabbing a zipline (`zipline`). The game sends no event for these, and everyone's
 * movement is already here, so they show for every player at no network cost.
 */
export class GameplayFxWatch {
  private readonly seen = new Map<number, Seen>();

  constructor(
    private readonly pads: readonly JumpPad[],
    private readonly portals: readonly Portal[],
    private readonly play: (key: string, at: Vec3) => void,
  ) {}

  update(poses: Iterable<WatchedPose>, now = performance.now()): void {
    for (const p of poses) {
      const s = this.seen.get(p.slot);
      if (!s) {
        this.seen.set(p.slot, { x: p.x, y: p.y, z: p.z, alive: p.alive, grounded: p.grounded, zip: p.zip, pad: -Infinity });
        continue;
      }
      if (p.alive && !s.alive) this.play('spawn', { x: p.x, y: p.y + 0.1, z: p.z });
      else if (p.alive) {
        const jump = Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z);
        if (jump > TELEPORT && this.portals.some((q) => Math.hypot(q.pos.x - s.x, q.pos.z - s.z) < PORTAL_NEAR)) {
          this.play('portal', { x: s.x, y: s.y + 1, z: s.z });
          this.play('portal', { x: p.x, y: p.y + 1, z: p.z });
        }
        if (s.grounded && !p.grounded && p.y >= s.y && now - s.pad > PAD_COOLDOWN_MS) {
          const pad = this.pads.find((q) => Math.hypot(q.pos.x - s.x, q.pos.z - s.z) <= PAD_RADIUS && Math.abs(q.pos.y - s.y) < 0.8);
          if (pad) {
            s.pad = now;
            this.play('pad', { x: pad.pos.x, y: pad.pos.y + 0.1, z: pad.pos.z });
          }
        }
        if (p.zip !== undefined && s.zip === undefined) this.play('zipline', { x: p.x, y: p.y + 2.1, z: p.z });
      }
      s.x = p.x;
      s.y = p.y;
      s.z = p.z;
      s.alive = p.alive;
      s.grounded = p.grounded;
      s.zip = p.zip;
    }
  }

  forget(slot: number): void {
    this.seen.delete(slot);
  }
}
