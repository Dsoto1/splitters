import { angleDelta, type Vec3, hypot } from '../math.ts';
import type { TrackGeometry, TrackGate } from '../map/track.ts';
import type { GameEvent, RaceSnapshot } from '../protocol.ts';
import { BUTTON_FIRE } from './movement.ts';
import { TICK_RATE } from './constants.ts';

/**
 * Race mode: everyone starts on the grid in a vehicle; after the countdown
 * they drive the track's checkpoints in order, lap after lap. First over the
 * line after the last lap wins; the rest get a little longer to finish.
 * Wrecked, stranded, stuck or lost racers come back at the last checkpoint
 * they passed, in a fresh vehicle. The match owns the vehicles and players;
 * this director owns the race and talks to the match through RaceHost.
 */

/** A racer as the director sees them. */
export interface RacerView {
  slot: number;
  alive: boolean;
  pos: Vec3;
  /** The mount they sit in (match mount index) and whether they drive it, or null on foot. */
  mount: number | null;
  driving: boolean;
}

/** A vehicle as the director and racing bots see it. */
export interface RaceVehicleView {
  alive: boolean;
  pos: Vec3;
  yaw: number;
  /** Signed speed along its heading (m/s). */
  speed: number;
  maxSpeed: number;
}

export interface RaceHost {
  readonly tick: number;
  /** Players and Player Bots, alive or not. */
  racers(): readonly RacerView[];
  /** The start-grid vehicles (match mount indices), in grid order. */
  readonly gridMounts: readonly number[];
  vehicle(mount: number): RaceVehicleView | null;
  /** A fresh vehicle at `pos` facing `yaw`, with the racer (brought back to life if need be) at the wheel. */
  placeRacer(slot: number, mount: number, pos: Vec3, yaw: number): void;
  /** Take an unused grid vehicle out of play. */
  park(mount: number): void;
  emit(ev: GameEvent): void;
  /** The race is over: `winner` takes the round. */
  endRace(winner: number | null): void;
}

/** Countdown on the grid before the start (when the match hasn't counted down already). */
export const RACE_COUNTDOWN_SECONDS = 3;
/** After the winner crosses the line, the others have this long to finish. */
export const RACE_FINISH_GRACE_SECONDS = 30;
/** Out of the vehicle (thrown out, got out) this long: back at the last checkpoint. */
const OUT_TICKS = Math.round(TICK_RATE * 1.5);
/** Under 1 m/s this long while racing: stuck, back at the last checkpoint. */
const STUCK_TICKS = TICK_RATE * 5;
/** Further than this off the road this long: lost, back at the last checkpoint. */
const LOST_METRES = 30;
const LOST_TICKS = TICK_RATE * 3;
/** Driving against the track this long shows the wrong-way warning. */
const WRONG_TICKS = Math.round(TICK_RATE * 0.75);

interface Racer {
  slot: number;
  /** Index into the grid (and gridMounts); -1 when the grid is full. */
  grid: number;
  /** Laps started (crossings of the start line; 0 still on the grid). */
  lap: number;
  /** Next checkpoint index, and checkpoints passed in all. */
  next: number;
  passed: number;
  /** Checkpoint passed last (-1: none yet, back to the grid). */
  last: number;
  lapStart: number;
  best: number | null;
  finish: number | null;
  prev: Vec3 | null;
  wrong: number;
  slow: number;
  out: number;
  lost: number;
}

const ms = (ticks: number) => Math.round((ticks * 1000) / TICK_RATE);

export class RaceDirector {
  /** 0 countdown, 1 racing, 2 finishing (the winner is in). */
  state: 0 | 1 | 2 = 0;
  private startAt: number;
  private endAt = Infinity;
  private readonly racers = new Map<number, Racer>();
  private finishers = 0;

  constructor(
    private readonly host: RaceHost,
    readonly track: TrackGeometry,
    readonly laps: number,
    readonly combat: boolean,
    countdown = true,
  ) {
    this.startAt = host.tick + (countdown ? RACE_COUNTDOWN_SECONDS * TICK_RATE : 0);
  }

  /** Vehicles held on the grid (inputs ignored) during the countdown. */
  get holding(): boolean {
    return this.state === 0;
  }

  /** Ticks since the start (0 on the grid). */
  get elapsed(): number {
    return this.state === 0 ? 0 : this.host.tick - this.startAt;
  }

  get gates(): readonly TrackGate[] {
    return this.track.gates;
  }

  /** A new race: everyone back to the grid. `countdown`: count down here (false when the match just did). */
  reset(countdown = true): void {
    this.state = 0;
    this.startAt = this.host.tick + (countdown ? RACE_COUNTDOWN_SECONDS * TICK_RATE : 0);
    this.endAt = Infinity;
    this.finishers = 0;
    for (const r of this.racers.values()) Object.assign(r, fresh(r.slot, r.grid));
    for (const v of this.host.racers()) this.place(this.racer(v.slot));
    this.parkUnused();
  }

  /** A racer (re)spawned: put them in their vehicle, on the grid or at their last checkpoint. */
  onSpawn(slot: number): void {
    this.place(this.racer(slot));
    this.parkUnused();
  }

  step(): void {
    const host = this.host;
    const views = host.racers();
    // Racers who left free their grid place.
    for (const slot of [...this.racers.keys()]) {
      if (!views.some((v) => v.slot === slot)) {
        const r = this.racers.get(slot)!;
        this.racers.delete(slot);
        const m = host.gridMounts[r.grid];
        if (m !== undefined) host.park(m);
      }
    }
    if (this.state === 0) {
      if (host.tick < this.startAt) return;
      this.state = 1;
      for (const r of this.racers.values()) r.lapStart = host.tick;
      host.emit({ e: 'race', a: 'go', s: -1, n: 0 });
    }
    for (const v of views) {
      const r = this.racer(v.slot);
      this.track1(r, v);
    }
    const all = [...this.racers.values()];
    if (this.state === 2 && (host.tick >= this.endAt || all.every((r) => r.finish !== null))) {
      this.state = 0;
      host.endRace(this.order()[0]?.slot ?? null);
    }
  }

  private track1(r: Racer, v: RacerView): void {
    const host = this.host;
    const g = this.track;
    if (!v.alive) {
      r.prev = null;
      return;
    }
    const pos = v.pos;
    // Checkpoints in order (finished racers just drive on).
    if (r.finish === null && r.prev) {
      const gate = g.gates[r.next]!;
      if (g.crossed(gate, r.prev, pos)) this.pass(r);
    }
    // Wrong way and lost: compare the motion with the road under it.
    const near = g.nearest(pos.x, pos.z, 200);
    if (r.prev && near) {
      const mx = pos.x - r.prev.x;
      const mz = pos.z - r.prev.z;
      const speed = hypot(mx, mz) * TICK_RATE;
      const along = (mx * near.sample.dx + mz * near.sample.dz) * TICK_RATE;
      r.wrong = speed > 2 && along < -0.5 * speed ? r.wrong + 1 : Math.max(0, r.wrong - 3);
    }
    r.lost = !near || near.dist > g.width / 2 + LOST_METRES ? r.lost + 1 : 0;
    r.prev = { ...pos };
    if (r.finish !== null) return;
    const vehicle = v.mount === null ? null : host.vehicle(v.mount);
    r.out = v.mount === null || !v.driving ? r.out + 1 : 0;
    r.slow = vehicle && Math.abs(vehicle.speed) < 1 ? r.slow + 1 : 0;
    if (r.out > OUT_TICKS || r.slow > STUCK_TICKS || r.lost > LOST_TICKS) this.place(r);
  }

  /** Through the next checkpoint: the start line opens a lap (or ends the race), the rest just count. */
  private pass(r: Racer): void {
    const host = this.host;
    const n = this.gates.length;
    const gate = r.next;
    r.last = gate;
    r.passed++;
    r.next = (gate + 1) % n;
    const finishLine = this.track.loop ? gate === 0 : gate === n - 1;
    if (gate === 0 && r.lap === 0) {
      // Over the start line from the grid: lap 1 (timed from the green light).
      r.lap = 1;
      host.emit({ e: 'race', a: 'lap', s: r.slot, n: 1 });
      if (!(finishLine && !this.track.loop)) return;
    }
    if (!finishLine) {
      host.emit({ e: 'race', a: 'gate', s: r.slot, n: gate });
      return;
    }
    const lapTicks = host.tick - r.lapStart;
    if (r.best === null || lapTicks < r.best) {
      r.best = lapTicks;
      host.emit({ e: 'race', a: 'best', s: r.slot, n: r.lap, t: ms(lapTicks) });
    }
    if (r.lap >= this.laps || !this.track.loop) {
      r.finish = host.tick;
      this.finishers++;
      host.emit({ e: 'race', a: 'finish', s: r.slot, n: this.finishers, t: ms(host.tick - this.startAt) });
      if (this.state === 1) {
        this.state = 2;
        this.endAt = host.tick + RACE_FINISH_GRACE_SECONDS * TICK_RATE;
      }
      return;
    }
    r.lap++;
    r.lapStart = host.tick;
    host.emit({ e: 'race', a: 'lap', s: r.slot, n: r.lap });
  }

  private racer(slot: number): Racer {
    let r = this.racers.get(slot);
    if (!r) {
      const taken = new Set([...this.racers.values()].map((x) => x.grid));
      let grid = -1;
      for (let i = 0; i < this.host.gridMounts.length; i++) {
        if (!taken.has(i)) {
          grid = i;
          break;
        }
      }
      r = fresh(slot, grid);
      this.racers.set(slot, r);
    }
    return r;
  }

  /** Into a fresh vehicle on the grid (nothing passed yet) or just past the last checkpoint. */
  private place(r: Racer): void {
    const mount = this.host.gridMounts[r.grid];
    r.out = r.slow = r.lost = r.wrong = 0;
    if (mount === undefined) return;
    let pos: Vec3;
    let yaw: number;
    if (r.last < 0) {
      const slot = this.track.grid(this.host.gridMounts.length)[r.grid]!;
      pos = { x: slot.x, y: slot.y, z: slot.z };
      yaw = slot.yaw;
    } else {
      const gate = this.gates[r.last]!;
      const p = this.track.at(gate.s + 3);
      // Spread out across the road so two racers back at once don't land on each other.
      const off = (((r.slot % 3) - 1) * this.track.width) / 4;
      pos = { x: p.x + p.dz * off, y: p.y, z: p.z - p.dx * off };
      yaw = Math.atan2(p.dx, p.dz);
    }
    this.host.placeRacer(r.slot, mount, pos, yaw);
    r.prev = { ...pos };
  }

  /** Grid vehicles nobody races in leave the track. */
  private parkUnused(): void {
    const used = new Set([...this.racers.values()].map((r) => r.grid));
    this.host.gridMounts.forEach((m, i) => {
      if (!used.has(i)) this.host.park(m);
    });
  }

  /** Race order: finishers by finish time, then by checkpoints passed, then by distance to the next one. */
  order(): { slot: number; finish: number | null }[] {
    const g = this.track;
    const views = new Map(this.host.racers().map((v) => [v.slot, v]));
    const left = (r: Racer) => {
      const v = views.get(r.slot);
      const gate = g.gates[r.next]!;
      return v ? hypot(v.pos.x - gate.x, v.pos.z - gate.z) : Infinity;
    };
    return [...this.racers.values()]
      .sort((a, b) => {
        if (a.finish !== null || b.finish !== null) return (a.finish ?? Infinity) - (b.finish ?? Infinity);
        return b.passed - a.passed || left(a) - left(b) || a.slot - b.slot;
      })
      .map((r) => ({ slot: r.slot, finish: r.finish }));
  }

  /** Where a racer is in the race (for bots and tests). */
  status(slot: number): { lap: number; next: number; passed: number; last: number; finish: number | null; best: number | null } | null {
    const r = this.racers.get(slot);
    return r ? { lap: r.lap, next: r.next, passed: r.passed, last: r.last, finish: r.finish, best: r.best } : null;
  }

  snapshot(): RaceSnapshot {
    const host = this.host;
    const racing = this.state === 0 ? 0 : host.tick - this.startAt;
    return {
      st: this.state,
      cd: this.state === 0 ? Math.max(0, Math.ceil((this.startAt - host.tick) / TICK_RATE)) : 0,
      t: ms(Math.max(0, racing)),
      laps: this.track.loop ? this.laps : 1,
      combat: this.combat ? 1 : 0,
      r: this.order().map(({ slot }) => {
        const r = this.racers.get(slot)!;
        return [slot, Math.max(1, Math.min(this.laps, r.lap)), r.next, r.finish === null ? -1 : ms(r.finish - this.startAt), r.best === null ? -1 : ms(r.best), this.state === 1 || this.state === 2 ? ms(Math.max(0, host.tick - r.lapStart)) : 0, r.wrong > WRONG_TICKS ? 1 : 0, r.out > 0 || r.slow > STUCK_TICKS / 2 ? 1 : 0];
      }),
    };
  }
}

function fresh(slot: number, grid: number): Racer {
  return { slot, grid, lap: 0, next: 0, passed: 0, last: -1, lapStart: 0, best: null, finish: null, prev: null, wrong: 0, slow: 0, out: 0, lost: 0 };
}

// ---------------------------------------------------------------- handling and bots (driving itself: trackDriver.ts)

/** Tyre grip on the road and top speed off it (multiples), for wheeled vehicles on a map with a track. Hovercraft don't care. */
export function roadHandling(track: TrackGeometry | null, pos: Vec3, hover: boolean): { grip: number; speed: number } {
  if (!track || hover) return { grip: 1, speed: 1 };
  return track.onRoad(pos.x, pos.y, pos.z) ? { grip: 1.7, speed: 1 } : { grip: 1, speed: 0.85 };
}

/**
 * Combat races: the bot's forward gun (a pilot's blasters) fires at the
 * nearest rival inside its arc and in range it can see. Returns the aim and
 * the trigger, or null for nobody to shoot.
 */
export function raceShot(v: RaceVehicleView, arc: number, range: number, rivals: readonly Vec3[], sees: (a: Vec3, b: Vec3) => boolean): { yaw: number; pitch: number; buttons: number } | null {
  let best: Vec3 | null = null;
  let bestD = range;
  // Sight from above the bot's own vehicle (its box would block a line from inside it).
  const eye = { x: v.pos.x, y: v.pos.y + 2.2, z: v.pos.z };
  for (const p of rivals) {
    const d = hypot(p.x - v.pos.x, p.z - v.pos.z);
    if (d >= bestD || d < 2) continue;
    if (Math.abs(angleDelta(v.yaw, Math.atan2(p.x - v.pos.x, p.z - v.pos.z))) > arc) continue;
    if (!sees(eye, { x: p.x, y: p.y + 1, z: p.z })) continue;
    best = p;
    bestD = d;
  }
  if (!best) return null;
  const yaw = Math.atan2(best.x - v.pos.x, best.z - v.pos.z);
  const pitch = Math.atan2(best.y + 0.8 - eye.y, bestD);
  return { yaw, pitch, buttons: BUTTON_FIRE };
}
