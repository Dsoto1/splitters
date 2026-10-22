import { TICK_RATE, angleDelta, type PlayerSnapshot } from '@chronosplit/shared';

/** Remote actors render this far behind the newest snapshot so there are always two to blend between. */
const INTERP_DELAY_TICKS = 6; // 100 ms at 60 Hz
const BUFFER_TICKS = TICK_RATE * 2;

interface Frame {
  tick: number;
  players: Map<number, PlayerSnapshot>;
}

export interface RemotePose {
  slot: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  alive: boolean;
  state?: string;
}

/** Snapshot interpolation for remote players, driven by an estimate of the server clock. */
export class Interpolator {
  private frames: Frame[] = [];
  private latestTick = 0;
  private latestAt = 0;

  push(tick: number, players: PlayerSnapshot[]): void {
    if (tick <= this.latestTick && this.frames.length) return;
    this.frames.push({ tick, players: new Map(players.map((p) => [p.s, p])) });
    this.latestTick = tick;
    this.latestAt = performance.now();
    while (this.frames.length > 2 && this.frames[0]!.tick < tick - BUFFER_TICKS) this.frames.shift();
  }

  sample(now: number = performance.now()): RemotePose[] {
    if (!this.frames.length) return [];
    const estServerTick = this.latestTick + ((now - this.latestAt) / 1000) * TICK_RATE;
    const renderTick = Math.min(estServerTick - INTERP_DELAY_TICKS, this.latestTick);
    let a = this.frames[0]!;
    let b = a;
    for (const f of this.frames) {
      if (f.tick <= renderTick) a = f;
      if (f.tick >= renderTick) {
        b = f;
        break;
      }
      b = f;
    }
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.max(0, Math.min(1, (renderTick - a.tick) / span)) : 1;
    const out: RemotePose[] = [];
    for (const [slot, pb] of b.players) {
      const pa = a.players.get(slot);
      // Do not blend across a respawn teleport.
      const blend = pa && pa.alive === pb.alive ? t : 1;
      const from = blend === 1 || !pa ? pb : pa;
      out.push({
        slot,
        x: from.p[0] + (pb.p[0] - from.p[0]) * blend,
        y: from.p[1] + (pb.p[1] - from.p[1]) * blend,
        z: from.p[2] + (pb.p[2] - from.p[2]) * blend,
        yaw: from.yaw + angleDelta(from.yaw, pb.yaw) * blend,
        pitch: from.pitch + (pb.pitch - from.pitch) * blend,
        alive: pb.alive === 1,
        state: pb.st,
      });
    }
    return out;
  }
}
