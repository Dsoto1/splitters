import { SNAPSHOT_INTERVAL_TICKS, TICK_RATE, angleDelta, type PlayerSnapshot } from '@tiletrigger/shared';
import { perfOn } from './perfSwitches.ts';
import { netProbe } from './netProbe.ts';

/** Remote actors render this far behind the newest snapshot so there are always two to blend between. */
const INTERP_DELAY_TICKS = 6; // 100 ms at 60 Hz
const BUFFER_TICKS = TICK_RATE * 2;
/**
 * The most snapshots the buffer keeps at once (their players' objects with them): the newest and those of the
 * BUFFER_TICKS before it. A transport that hands out reused player objects (localTransport.ts) must leave a
 * snapshot's alone until more than this many newer ones have been delivered.
 */
export const INTERP_KEEPS_SNAPSHOTS = Math.ceil(BUFFER_TICKS / SNAPSHOT_INTERVAL_TICKS) + 1;
/**
 * The server clock is estimated from snapshot arrivals. Each arrival only
 * nudges the estimate (by this share of its error): snapshots reach us a few
 * milliseconds early or late (network, or a busy main thread), and setting the
 * clock from every one moved remote players in little jerks at the snapshot
 * rate, which also made their running animation's speed flicker.
 */
const CLOCK_GAIN = 0.05;
/** An estimate this far out (ticks) is reset instead (a stall, a hidden tab). */
const CLOCK_RESYNC_TICKS = 6;
/**
 * A snapshot running late (a busy sim worker or network) would freeze remote
 * players on the newest one and then jump them on: for up to this many ticks
 * past it they carry on along their last motion instead. Lag compensation
 * still uses the clamped renderTick.
 */
const EXTRAPOLATE_TICKS = 5;
/** This many snapshots in a row far later than expected (about 0.4 s) and the clock estimate moves to them. */
const LATE_RUN_RESYNC = 12;

/** A projectile as drawn: [x, y, z, look (PROJECTILE_VISUALS index), shooter's slot (a stream's own shots) or -1]. */
export type ProjectileSample = [number, number, number, number, number];

interface Frame {
  tick: number;
  players: Map<number, PlayerSnapshot>;
  /** Projectile id -> [x, y, z, look, shooter (a stream's own shots: STREAM_VISUALS) or -1]. */
  projectiles: Map<number, ProjectileSample>;
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
  /** Sliding (PlayerSnapshot.sd). */
  sliding?: boolean;
  /** A dodge-step (1) or combat roll (2) under way, and its ticks so far, blended between snapshots (PlayerSnapshot.dg). */
  dodge?: 1 | 2;
  dodgeTicks?: number;
  /** Leaning (peek), in steps, blended between snapshots (PlayerSnapshot.ln; + right, sim/moves.ts LEAN.steps full). */
  lean?: number;
  /** Aiming through a magnified optic, as the host says (PlayerSnapshot.zm; hosts older than the field never say it). */
  scoped?: boolean;
  /** Under a parachute (1) or glider (2). */
  chute?: number;
  /** Riding a zipline: the line (index in mapZiplines) and the speed along it (m/s). */
  zip?: number;
  zipSpeed?: number;
  /**
   * Your own body in third person: how far (radians, + to the right) the gun turns from the body's yaw to point at
   * what the crosshair is on (shared/sim/thirdPerson.ts thirdPersonAim; `pitch` is that aim's pitch then).
   */
  aimYaw?: number;
  /** Holding a pair (dual wielding: PlayerSnapshot.dw; your own from prediction): a gun in each hand. */
  pair?: boolean;
  /** Your own pair in third person: how far into its reload dip each gun is (right, left; 0..1; pairView.ts reloadDipAmount). */
  pairDip?: readonly [number, number];
}

/** Snapshot interpolation for remote players, driven by an estimate of the server clock. */
export class Interpolator {
  private frames: Frame[] = [];
  private latestTick = 0;
  /** Smoothed server tick minus local time in ticks (null before the first snapshot). */
  private clockOffset: number | null = null;
  /** Snapshots in a row that came far later than the estimate. */
  private lateRun = 0;

  /** `hold`: slots left out of this snapshot to save bandwidth; they are drawn from the frames that had them. */
  push(tick: number, players: PlayerSnapshot[], projectiles: readonly (readonly number[])[] = [], hold?: readonly number[], now: number = performance.now()): void {
    if (tick <= this.latestTick && this.frames.length) return;
    if (perfOn('netgarbage')) {
      // Filled in place: the map-of-pairs form made a two-element array per player and per projectile, every snapshot
      // (Flavius Rule's allocation profile, docs/PERF_FLAVIUS_MEMORY_2026-11-16.md; `?perfoff=netgarbage`).
      const byslot = new Map<number, PlayerSnapshot>();
      for (const p of players) byslot.set(p.s, p);
      const shots = new Map<number, ProjectileSample>();
      for (const q of projectiles) shots.set(q[0]!, [q[1]!, q[2]!, q[3]!, q[4] ?? 0, q[5] ?? -1]);
      const frame: Frame = { tick, players: byslot, projectiles: shots };
      if (hold?.length) frame.hold = new Set(hold);
      this.frames.push(frame);
    } else this.frames.push({ tick, players: new Map(players.map((p) => [p.s, p])), projectiles: new Map(projectiles.map(([id, x, y, z, v, owner]) => [id!, [x!, y!, z!, v ?? 0, owner ?? -1]])), ...(hold?.length ? { hold: new Set(hold) } : {}) });
    this.latestTick = tick;
    const offset = tick - (now / 1000) * TICK_RATE;
    // Far ahead of the estimate: we fell behind (a stall here), catch up at once. Far behind it: one
    // late snapshot or burst is waited out (drawing carries on), but a run of them means the server
    // clock really slipped (it dropped a backlog) and the estimate moves to it.
    const late = this.clockOffset !== null && offset < this.clockOffset - CLOCK_RESYNC_TICKS;
    this.lateRun = late ? this.lateRun + 1 : 0;
    if (this.clockOffset === null || offset > this.clockOffset + CLOCK_RESYNC_TICKS || this.lateRun > LATE_RUN_RESYNC) {
      if (netProbe.on && this.clockOffset !== null) netProbe.resyncs++;
      this.clockOffset = offset;
      this.lateRun = 0;
    } else if (!late) this.clockOffset += (offset - this.clockOffset) * CLOCK_GAIN;
    while (this.frames.length > 2 && this.frames[0]!.tick < tick - BUFFER_TICKS) this.frames.shift();
  }

  /** The (fractional) server tick remote players are currently drawn at. Sent with inputs for lag compensation. */
  renderTick(now: number = performance.now()): number {
    if (!this.frames.length) return 0;
    return Math.min(this.drawTick(now), this.latestTick);
  }

  /** The tick players are drawn at: renderTick, but allowed a little past the newest snapshot. */
  private drawTick(now: number): number {
    const estServerTick = (now / 1000) * TICK_RATE + (this.clockOffset ?? this.latestTick);
    const tick = Math.min(estServerTick - INTERP_DELAY_TICKS, this.latestTick + EXTRAPOLATE_TICKS);
    // Never backwards (after the clock estimate moves back to a slipped server): wait for it instead.
    if (now >= this.lastDraw.at) this.lastDraw = { at: now, tick: Math.max(tick, this.lastDraw.tick) };
    return Math.min(this.lastDraw.tick, this.latestTick + EXTRAPOLATE_TICKS);
  }

  private lastDraw = { at: -Infinity, tick: -Infinity };

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
  sampleProjectiles(now: number = performance.now()): Map<number, ProjectileSample> {
    const out = new Map<number, ProjectileSample>();
    if (!this.frames.length) return out;
    const { a, b, t } = this.bracket(this.renderTick(now));
    for (const [id, pb] of b.projectiles) {
      const pa = a.projectiles.get(id) ?? pb;
      out.set(id, [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t, pb[3], pb[4]]);
    }
    return out;
  }

  sample(now: number = performance.now()): RemotePose[] {
    if (!this.frames.length) return [];
    const drawTick = this.drawTick(now);
    const renderTick = Math.min(drawTick, this.latestTick);
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
    // Past the newest snapshot: carry on along the last two (t above 1 extrapolates).
    const n = this.frames.length;
    if (netProbe.on) {
      netProbe.sampled++;
      if (drawTick > this.latestTick) netProbe.extrapolated++;
    }
    if (drawTick > this.latestTick && n > 1) {
      a = this.frames[n - 2]!;
      b = this.frames[n - 1]!;
    }
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.max(0, Math.min(1 + EXTRAPOLATE_TICKS / span, (drawTick - a.tick) / span)) : 1;
    const out: RemotePose[] = [];
    const last = this.frames[this.frames.length - 1]!;
    // Big matches: players far away come in some snapshots only. Blend each between the frames that have them.
    const held = last.hold || b.hold ? [...last.players.keys(), ...(last.hold ?? [])].filter((slot) => !b.players.has(slot)) : [];
    const pairs: [number, PlayerSnapshot | undefined, PlayerSnapshot, number][] = [];
    for (const [slot, pb] of b.players) {
      // In b but held back from a (far away): blend between the frames that have them, like the rest held back.
      if (a !== b && a.hold?.has(slot)) held.push(slot);
      else pairs.push([slot, a.players.get(slot), pb, t]);
    }
    for (const slot of held) {
      let f0: Frame | undefined;
      let fa: Frame | undefined;
      let fb: Frame | undefined;
      for (const f of this.frames) {
        if (!f.players.has(slot)) continue;
        if (f.tick <= renderTick) {
          f0 = fa;
          fa = f;
        } else {
          fb = f;
          break;
        }
      }
      // Far players come every fourth snapshot (133 ms), more than the 100 ms we draw behind: the next one
      // isn't here yet. Carry them on along their last move (at most one gap's worth) instead of stopping
      // them until it comes and then jumping them on.
      if (!fb && fa && f0) {
        const gap = fa.tick - f0.tick;
        pairs.push([slot, f0.players.get(slot), fa.players.get(slot)!, gap > 0 ? Math.min(2, (renderTick - f0.tick) / gap) : 1]);
        continue;
      }
      if (netProbe.on && !fb) netProbe.frozen++;
      const pa = (fa ?? fb)?.players.get(slot);
      const pb = (fb ?? fa)?.players.get(slot);
      if (!pa || !pb) continue;
      const span = fa && fb ? fb.tick - fa.tick : 0;
      pairs.push([slot, pa, pb, span > 0 ? Math.max(0, Math.min(1, (renderTick - fa!.tick) / span)) : 1]);
    }
    for (const [slot, pa, pb, t] of pairs) {
      // Do not blend across a respawn or a portal (a jump no one could run between two snapshots).
      const jumped = pa ? Math.hypot(pb.p[0] - pa.p[0], pb.p[1] - pa.p[1], pb.p[2] - pa.p[2]) > 6 : false;
      const blend = pa && pa.alive === pb.alive && !jumped ? t : 1;
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
        ...(pb.sd ? { sliding: true } : {}),
        ...(pb.dg ? { dodge: pb.dg[0] === 2 ? 2 : 1, dodgeTicks: from.dg && from.dg[0] === pb.dg[0] && from.dg[1] <= pb.dg[1] ? from.dg[1] + (pb.dg[1] - from.dg[1]) * blend : pb.dg[1] * blend } : {}),
        ...((from.ln ?? 0) || pb.ln ? { lean: (from.ln ?? 0) + ((pb.ln ?? 0) - (from.ln ?? 0)) * blend } : {}),
        ...(pb.zm ? { scoped: true } : {}),
        ...(pb.dw ? { pair: true } : {}),
        ...(pb.em ? { emote: true } : {}),
        ...(pb.ch ? { chute: pb.ch } : {}),
        ...(pb.zl ? { zip: pb.zl[0], zipSpeed: Math.abs(pb.zl[2]) } : {}),
        weapon: pb.w,
        powerups: pb.pu,
        status: pb.fx ?? 0,
        state: pb.st,
      });
    }
    return out;
  }
}
