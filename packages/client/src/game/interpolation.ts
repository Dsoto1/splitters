import { TICK_RATE, angleDelta, type PlayerSnapshot } from '@tiletrigger/shared';

/** Remote actors render this far behind the newest snapshot so there are always two to blend between. */
const INTERP_DELAY_TICKS = 6; // 100 ms at 60 Hz
const BUFFER_TICKS = TICK_RATE * 2;

interface Frame {
  tick: number;
  players: Map<number, PlayerSnapshot>;
  /** Projectile id -> [x, y, z, look]. */
  projectiles: Map<number, [number, number, number, number]>;
  /** Players still in the match but left out of this snapshot (far away, big matches). */
  hold?: Set<number>;
}

export interface RemotePose {
  slot: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  alive: boolean;
  /** Standing on the ground (players report it; NPCs are assumed grounded). */
  grounded: boolean;
  weapon: number;
  powerups: number;
  /** Status effect bits (STATUS_*). */
  status: number;
  state?: string;
  /** Crouching (1) or prone (2). */
  stance?: number;
  /** Dancing (emote). */
  emote?: boolean;
  sprinting?: boolean;
}

/** Snapshot interpolation for remote players, driven by an estimate of the server clock. */
export class Interpolator {
  private frames: Frame[] = [];
  private latestTick = 0;
  private latestAt = 0;

  /** `hold`: slots left out of this snapshot to save bandwidth; they are drawn from the frames that had them. */
  push(tick: number, players: PlayerSnapshot[], projectiles: [number, number, number, number, number][] = [], hold?: readonly number[]): void {
    if (tick <= this.latestTick && this.frames.length) return;
    this.frames.push({ tick, players: new Map(players.map((p) => [p.s, p])), projectiles: new Map(projectiles.map(([id, x, y, z, v]) => [id, [x, y, z, v ?? 0]])), ...(hold?.length ? { hold: new Set(hold) } : {}) });
    this.latestTick = tick;
    this.latestAt = performance.now();
    while (this.frames.length > 2 && this.frames[0]!.tick < tick - BUFFER_TICKS) this.frames.shift();
  }

  /** The (fractional) server tick remote players are currently drawn at. Sent with inputs for lag compensation. */
  renderTick(now: number = performance.now()): number {
    if (!this.frames.length) return 0;
    const estServerTick = this.latestTick + ((now - this.latestAt) / 1000) * TICK_RATE;
    return Math.min(estServerTick - INTERP_DELAY_TICKS, this.latestTick);
  }

  /** The two buffered frames around `renderTick` and the blend factor between them. */
  private bracket(renderTick: number): { a: Frame; b: Frame; t: number } {
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
    return { a, b, t: span > 0 ? Math.max(0, Math.min(1, (renderTick - a.tick) / span)) : 1 };
  }

  /** Interpolated projectile positions by ID. */
  sampleProjectiles(now: number = performance.now()): Map<number, [number, number, number, number]> {
    const out = new Map<number, [number, number, number, number]>();
    if (!this.frames.length) return out;
    const { a, b, t } = this.bracket(this.renderTick(now));
    for (const [id, pb] of b.projectiles) {
      const pa = a.projectiles.get(id) ?? pb;
      out.set(id, [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t, pb[3]]);
    }
    return out;
  }

  sample(now: number = performance.now()): RemotePose[] {
    if (!this.frames.length) return [];
    const renderTick = this.renderTick(now);
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
    const last = this.frames[this.frames.length - 1]!;
    // Big matches: players far away come in some snapshots only. Blend each between the frames that have them.
    const held = last.hold || b.hold ? [...last.players.keys(), ...(last.hold ?? [])].filter((slot) => !b.players.has(slot)) : [];
    const pairs: [number, PlayerSnapshot | undefined, PlayerSnapshot, number][] = [...b.players].map(([slot, pb]) => [slot, a.players.get(slot), pb, t]);
    for (const slot of held) {
      let fa: Frame | undefined;
      let fb: Frame | undefined;
      for (const f of this.frames) {
        if (!f.players.has(slot)) continue;
        if (f.tick <= renderTick) fa = f;
        else {
          fb = f;
          break;
        }
      }
      const pa = (fa ?? fb)?.players.get(slot);
      const pb = (fb ?? fa)?.players.get(slot);
      if (!pa || !pb) continue;
      const span = fa && fb ? fb.tick - fa.tick : 0;
      pairs.push([slot, pa, pb, span > 0 ? Math.max(0, Math.min(1, (renderTick - fa!.tick) / span)) : 1]);
    }
    for (const [slot, pa, pb, t] of pairs) {
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
        grounded: pb.g === 1,
        ...(pb.sn ? { stance: pb.sn } : {}),
        ...(pb.sr ? { sprinting: true } : {}),
        ...(pb.em ? { emote: true } : {}),
        weapon: pb.w,
        powerups: pb.pu,
        status: pb.fx ?? 0,
        state: pb.st,
      });
    }
    return out;
  }
}
