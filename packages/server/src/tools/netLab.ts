import {
  BUTTON_AUTO_RELOAD,
  BUTTON_FIRE,
  BUTTON_JUMP,
  BULLET_SUBSTEPS,
  DEFAULT_DEATHMATCH_RULES,
  MAP_FORMAT_VERSION,
  NEAR_INSTANT_M,
  PROTOCOL_VERSION,
  PhysicsWorld,
  SNAPSHOT_INTERVAL_TICKS,
  SnapshotDecoder,
  TICK_DT,
  TICK_RATE,
  buildMapGeometry,
  bulletPhysics,
  createRng,
  environmentShapes,
  flyBullet,
  getWeapon,
  gunplayOf,
  lookAngles,
  mapTerrainMesh,
  rayBody,
  weaponCode,
  type HitBody,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
  type ServerMessage,
  type Stance,
  type Vec3,
} from '@tiletrigger/shared';
import { Unzipper } from '@tiletrigger/shared/peerZip';
import { MAX_REWIND_TICKS, type Combatant, type Match } from '@tiletrigger/shared/match';
import { Interpolator, type RemotePose } from '../../../client/src/game/interpolation.ts';
import { LocalPlayer } from '../../../client/src/game/prediction.ts';
import { SnapshotCoalescer } from '../../../client/src/game/snapshotMerge.ts';
import { peerConn, type DataLike } from '../../../host/src/peerConn.ts';
import { startServer, type RunningServer } from '../server.ts';

/**
 * Network lab (docs/GUNPLAY_AUDIT.md, "G3: the network check"): a real host (the dedicated server, server.ts, the
 * code the Host Service runs) and N players joined over the real wire path (peerConn: one deflate stream per link,
 * the same JSON messages, the snapshot deltas), each player running the browser's own netcode (client/src/game:
 * Interpolator, LocalPlayer prediction and reconciliation, SnapshotCoalescer). Only the WebRTC data channel is
 * replaced, by a link that adds latency, jitter and packet loss in each direction.
 *
 * The link: the game's channels are reliable and ordered (SCTP over UDP, peerLink.ts `reliable: true`), so a lost
 * packet is not lost to the game: it is sent again, and everything after it on that channel waits for it
 * (head-of-line blocking). A message is ceil(bytes / 1150) packets; each packet is lost with the condition's
 * chance; a lost one arrives a round trip plus three packet gaps later (SCTP's fast retransmit, which needs a few
 * later packets acknowledged first), and may be lost again. One-way delay is half the round trip plus a uniform
 * 0..jitter queueing delay. Bandwidth is not limited.
 *
 * The players: bots driving the client code as a person would through the keyboard and mouse. Each picks the
 * nearest enemy as drawn on its screen, strafes (and now and then jumps) at 8-25 m, aims at a random point on the
 * body it sees and taps the trigger. What it measures, per shot:
 * - the shot on the shooter's screen: the round's own path (the near ray, then its flight a tick at a time, as the
 *   host flies it) against the bodies as drawn at that moment and the moments after;
 * - the host's verdict (the match's own `fire`, watched in this process) and when the shooter hears of it;
 * - where the host had the target (its lag-compensated rewind) against where the screen drew it;
 * and per player: corrections to the predicted position (rubber-banding) and bytes each way.
 */

export interface NetCondition {
  /** Round trip (ms) before jitter: each direction gets half. */
  rttMs: number;
  /** Extra one-way queueing delay, uniform 0..jitterMs. */
  jitterMs: number;
  /** Chance each packet is lost (0..1), each direction. */
  loss: number;
}

export interface NetLabOptions {
  condition: NetCondition;
  clients?: number;
  /** Measured seconds (after the warm-up). */
  seconds?: number;
  warmupSeconds?: number;
  weapon?: string;
  seed?: number;
  /** The map (default: the lab deck, a flat open square with eight spawns). */
  map?: MapDocument;
  /** Bots on the host as well (default 0: the players are the whole match). */
  botFill?: number;
}

/** One shot, as the shooter saw it and as the host judged it. */
export interface ShotRecord {
  slot: number;
  seq: number;
  /** When the input carrying it was sent (ms, performance.now). */
  sentAt: number;
  /** The tick the screen drew remote players at (fractional), and the tick the input carried (viewTick). */
  drawTick: number;
  viewTick: number;
  /** The body this round met on the shooter's screen (null: a miss there), at which flight tick, and that body's drawn feet. */
  screenHit: number | null;
  screenK: number;
  screenAt: Vec3 | null;
  /** The host's own record (null: the host never fired this input's round). */
  host: HostShot | null;
  /** When the shooter got the snapshot that carried the host's verdict (ms after sentAt). */
  confirmMs: number | null;
}

interface HostShot {
  tick: number;
  viewTick: number;
  hit: (number | null)[];
  from: Vec3;
  flying: boolean;
}

interface HostPose {
  x: number;
  y: number;
  z: number;
  alive: boolean;
}

export interface NetLabResult {
  condition: NetCondition;
  clients: number;
  seconds: number;
  weapon: string;
  /** Measured round trip (pings, ms): median and p95 over all players. */
  rtt: { p50: number; p95: number };
  shots: number;
  /** Shots that hit on the shooter's screen, and of those, how many the host confirmed (same body). */
  screenHits: number;
  confirmed: number;
  /** Of the screen hits the host didn't confirm: the host had the target already dead, the rewind was clamped, a plain miss. */
  missDead: number;
  missClamped: number;
  missOther: number;
  /** Host hits on shots that missed on the screen (the shooter sees a hit marker for a miss). */
  phantomHits: number;
  /** Rounds the shooter's client fired that the host never fired, and inputs the host dropped from a backlog. */
  unfired: number;
  droppedInputs: number;
  /** Where the host rewound the target to, against where the screen drew it (cm, horizontal; screen hits only). */
  lagCompCm: { p50: number; p95: number; max: number };
  /** Shots whose view tick was further back than the host rewinds (MAX_REWIND_TICKS). */
  clampedShots: number;
  /** Trigger to hit marker (ms; confirmed hits): input sent until the snapshot with the host's verdict arrived. */
  confirmMs: { p50: number; p95: number };
  /** Predicted-position corrections (rubber-banding): a minute per player, and their size (cm). */
  correctionsPerMin: number;
  correctionCm: { p50: number; p95: number; max: number };
  /** Kills the host scored a minute (all players). */
  killsPerMin: number;
  /** Bytes a second per player (KB/s): host to player (compressed) and player to host. */
  downKBps: number;
  upKBps: number;
  /** Snapshots that arrived merged with others (a backlog after a stall) and the longest gap between snapshots (ms). */
  mergedSnapshots: number;
  snapshotGapMs: { p95: number; max: number };
  /** Packets lost (and resent) each way. */
  lostPackets: number;
  /** The host's tick time (ms, mean) and ticks it ran late. */
  hostTickMs: number;
}

const PACKET_BYTES = 1150;

/** A sorted percentile (0..1) of numbers (0 for none). */
export function pct(xs: readonly number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!;
}

/**
 * One direction of a player's link: reliable and ordered, with latency, jitter and loss (see the module comment).
 * `interval`: how often this direction normally carries a packet (ms), for the fast-retransmit wait.
 */
export class LossyLink<T> {
  private readonly queue: { at: number; data: T }[] = [];
  private last = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  lost = 0;
  bytes = 0;
  closed = false;

  constructor(
    private readonly cond: NetCondition,
    private readonly rng: () => number,
    private readonly interval: number,
    private readonly deliver: (data: T) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** When a message sent now arrives (ms on `now`'s clock), with its packets' losses drawn. */
  arrival(bytes: number, sentAt: number): number {
    const c = this.cond;
    let at = sentAt + c.rttMs / 2 + this.rng() * c.jitterMs;
    const packets = Math.max(1, Math.ceil(bytes / PACKET_BYTES));
    for (let p = 0; p < packets; p++) {
      let resent = 0;
      while (c.loss > 0 && this.rng() < c.loss && resent < 8) {
        resent++;
        this.lost++;
        at += c.rttMs + 3 * this.interval + this.rng() * c.jitterMs;
      }
    }
    // In order: nothing overtakes a message still waiting for a resend.
    at = Math.max(at, this.last);
    this.last = at;
    return at;
  }

  send(data: T, bytes: number): void {
    if (this.closed) return;
    this.bytes += bytes;
    this.queue.push({ at: this.arrival(bytes, this.now()), data });
    this.arm();
  }

  close(): void {
    this.closed = true;
    this.queue.length = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(): void {
    if (this.timer || !this.queue.length) return;
    this.timer = setTimeout(() => this.flush(), Math.max(0, this.queue[0]!.at - this.now()));
  }

  private flush(): void {
    this.timer = null;
    const now = this.now();
    while (this.queue.length && this.queue[0]!.at <= now + 0.5) this.deliver(this.queue.shift()!.data);
    this.arm();
  }
}

/** The host's end of a player's link, as the Host Service's peerConn sees a PeerJS DataConnection. */
class LabChannel implements DataLike {
  open = true;
  readonly metadata = { z: 1 };
  readonly bufferSize = 0;
  private readonly handlers = new Map<string, ((...a: unknown[]) => void)[]>();
  constructor(private readonly down: LossyLink<Uint8Array>) {}
  send(data: string | Uint8Array): void {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.down.send(bytes, bytes.length);
  }
  close(): void {
    if (!this.open) return;
    this.open = false;
    this.down.close();
    this.emit('close');
  }
  on(event: string, cb: (...args: never[]) => void): unknown {
    const list = this.handlers.get(event) ?? [];
    list.push(cb as (...a: unknown[]) => void);
    this.handlers.set(event, list);
    return this;
  }
  emit(event: string, ...args: unknown[]): void {
    for (const cb of this.handlers.get(event) ?? []) cb(...args);
  }
}

/** The lab deck: a flat open 64 m square (8 m cells) with eight spawns on a 14 m ring. */
export function labDeck(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = -4; x < 4; x++) for (let y = -4; y < 4; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 });
  const entities: MapDocument['entities'] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    entities.push({ id: `spawn_${i}`, kind: 'spawn', position: [Math.round(Math.cos(a) * 14 * 10) / 10, 0, Math.round(Math.sin(a) * 14 * 10) / 10], yaw: 0, faction: null });
  }
  return {
    format: 'tiletrigger.map',
    formatVersion: MAP_FORMAT_VERSION,
    metadata: { id: 'net_lab', name: 'Net lab', author: '', description: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', parentId: null, recommendedPlayers: { min: 2, max: 8 }, supportedModes: ['core.deathmatch'] },
    classicStructure: { cellSize: 8, levelHeight: 4, theme: 'core.prototype', tiles },
    entities,
    factions: [],
    logic: { variables: [], timers: [], objectives: [], rules: [] },
    terrain: null,
    bounds: null,
    teamSetup: null,
    backdrop: null,
    blood: null,
    physics: null,
    dependencies: [],
  };
}

/** A body as drawn, for the screen's own hit test. */
interface DrawnBody {
  slot: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  stance: Stance;
}

/** One stored snapshot frame on the client (for the screen's view of the ticks after a shot). */
interface Frame {
  tick: number;
  bodies: Map<number, DrawnBody>;
}

interface PendingShot {
  rec: ShotRecord;
  eye: Vec3;
  dir: Vec3;
  /** The bodies as drawn the moment it was fired. */
  drawn: DrawnBody[];
}

/** One player: the browser's netcode, driven by a simple bot through its inputs. */
class LabClient {
  slot = -1;
  local: LocalPlayer | null = null;
  readonly interp = new Interpolator();
  private readonly decoder = new SnapshotDecoder();
  private readonly unzip = new Unzipper();
  private readonly coalescer: SnapshotCoalescer;
  private readonly frames: Frame[] = [];
  readonly shots: PendingShot[] = [];
  readonly corrections: number[] = [];
  readonly rtts: number[] = [];
  readonly arrivals: { tick: number; at: number }[] = [];
  readonly gaps: number[] = [];
  private lastArrival = 0;
  private acc = 0;
  private lastFrame = 0;
  private pingId = 0;
  private lastPing = 0;
  private strafe = 1;
  private strafeUntil = 0;
  private nextTap = 0;
  private aimOffset = { side: 0, up: 1.2 };
  private boxFor: (slot: number) => { box: HitBody['box']; scale: number } | null = () => null;
  welcomed = false;
  measuring = false;
  closed = false;

  constructor(
    readonly name: string,
    private readonly up: LossyLink<string>,
    private readonly rng: () => number,
    private readonly weapon: number,
  ) {
    this.coalescer = new SnapshotCoalescer((m) => this.handle(m));
  }

  setBodies(fn: (slot: number) => { box: HitBody['box']; scale: number } | null): void {
    this.boxFor = fn;
  }

  /** Bytes off the wire (one compressed piece). */
  receive(bytes: Uint8Array): void {
    if (this.closed) return;
    const text = this.unzip.piece(bytes);
    if (text === null) return;
    const msg = JSON.parse(text) as ServerMessage;
    if (msg.t === 'snapshot') this.decoder.snapshot(msg);
    this.coalescer.push(msg);
  }

  send(m: unknown): void {
    if (this.closed) return;
    const text = JSON.stringify(m);
    this.up.send(text, text.length);
  }

  private handle(msg: ServerMessage): void {
    const now = performance.now();
    if (msg.t === 'welcome') {
      this.slot = msg.slot;
      const map = msg.map;
      const physics = new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map), environmentShapes(map));
      this.local = new LocalPlayer(physics);
      this.welcomed = true;
      this.send({ t: 'ready' });
      return;
    }
    if (msg.t === 'pong') {
      if (this.measuring) this.rtts.push(now - msg.ct);
      return;
    }
    if (msg.t !== 'snapshot' || !this.local) return;
    if (this.lastArrival && this.measuring) this.gaps.push(now - this.lastArrival);
    this.lastArrival = now;
    this.arrivals.push({ tick: msg.tick, at: now });
    this.interp.push(msg.tick, msg.players, msg.pr, msg.hold, now);
    const bodies = new Map<number, DrawnBody>();
    for (const p of msg.players) if (p.alive) bodies.set(p.s, { slot: p.s, x: p.p[0], y: p.p[1], z: p.p[2], yaw: p.yaw, stance: (p.sn ?? 0) as Stance });
    this.frames.push({ tick: msg.tick, bodies });
    while (this.frames.length > TICK_RATE * 4) this.frames.shift();
    const me = msg.players.find((p) => p.s === this.slot);
    if (me) {
      const before = this.local.corrections;
      this.local.reconcile(me, msg.ack, msg.me, msg.tick);
      if (this.local.corrections > before && this.measuring) this.corrections.push(this.local.lastCorrection);
    }
  }

  /** Bodies as the screen had them at a (fractional) server tick, from the frames received (between the two around it). */
  bodiesAt(tick: number): DrawnBody[] {
    let a: Frame | undefined;
    let b: Frame | undefined;
    for (const f of this.frames) {
      if (f.tick <= tick) a = f;
      if (f.tick >= tick) {
        b = f;
        break;
      }
    }
    if (!a || !b) return [];
    const t = b.tick > a.tick ? (tick - a.tick) / (b.tick - a.tick) : 0;
    const out: DrawnBody[] = [];
    for (const [slot, pb] of b.bodies) {
      const pa = a.bodies.get(slot);
      if (!pa) continue;
      out.push({ slot, x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, z: pa.z + (pb.z - pa.z) * t, yaw: pb.yaw, stance: pb.stance });
    }
    return out;
  }

  /** The first drawn body a ray meets within `len` (and before the level), or null. */
  private rayDrawn(o: Vec3, d: Vec3, len: number, bodies: readonly DrawnBody[]): { slot: number; dist: number } | null {
    let best: { slot: number; dist: number } | null = null;
    const wall = this.local!.physics.raycastHit(o, d, len)?.dist ?? Infinity;
    for (const b of bodies) {
      if (b.slot === this.slot) continue;
      const shape = this.boxFor(b.slot);
      if (!shape) continue;
      const t = rayBody(o, d, { feet: { x: b.x, y: b.y, z: b.z }, yaw: b.yaw, stance: b.stance, box: shape.box, scale: shape.scale }, Math.min(len, wall));
      if (t !== null && (!best || t < best.dist)) best = { slot: b.slot, dist: t };
    }
    return best;
  }

  /**
   * The round on the shooter's screen: the near ray against the bodies drawn when it left, then its flight a tick at
   * a time (BULLET_SUBSTEPS, as the host flies it) against the bodies the screen drew at those ticks.
   */
  judgeOnScreen(s: PendingShot, def: ReturnType<typeof getWeapon>): void {
    const gp = gunplayOf(def);
    const reach = Math.min(def.range, 120);
    if (!gp.ballistic) {
      const h = this.rayDrawn(s.eye, s.dir, reach, s.drawn);
      s.rec.screenHit = h?.slot ?? null;
      s.rec.screenK = 0;
      s.rec.screenAt = h ? bodyAt(s.drawn, h.slot) : null;
      return;
    }
    const phys = bulletPhysics(gp.ballistic);
    const near = Math.min(NEAR_INSTANT_M, reach);
    const first = this.rayDrawn(s.eye, s.dir, near, s.drawn);
    if (first) {
      s.rec.screenHit = first.slot;
      s.rec.screenK = 0;
      s.rec.screenAt = bodyAt(s.drawn, first.slot);
      return;
    }
    const b = { pos: { x: s.eye.x + s.dir.x * near, y: s.eye.y + s.dir.y * near, z: s.eye.z + s.dir.z * near }, vel: { x: s.dir.x * phys.speed, y: s.dir.y * phys.speed, z: s.dir.z * phys.speed } };
    let travelled = near;
    for (let k = 1; k <= TICK_RATE && travelled < reach; k++) {
      const bodies = this.bodiesAt(s.rec.drawTick + k);
      for (let i = 0; i < BULLET_SUBSTEPS; i++) {
        const seg = flyBullet(b, phys.gravity, phys.drag, TICK_DT / BULLET_SUBSTEPS);
        const dx = seg.to.x - seg.from.x, dy = seg.to.y - seg.from.y, dz = seg.to.z - seg.from.z;
        const len = Math.hypot(dx, dy, dz);
        const h = this.rayDrawn(seg.from, { x: dx / len, y: dy / len, z: dz / len }, len, bodies);
        if (h) {
          s.rec.screenHit = h.slot;
          s.rec.screenK = k;
          s.rec.screenAt = bodyAt(bodies, h.slot);
          return;
        }
        travelled += len;
      }
    }
    s.rec.screenHit = null;
  }

  /** One browser frame: aim, move, predict the ticks due, send their inputs, ping once a second. */
  frame(now: number): void {
    const local = this.local;
    if (!local || this.closed) return;
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : TICK_DT;
    this.lastFrame = now;
    if (now - this.lastPing >= 1000) {
      this.lastPing = now;
      this.send({ t: 'ping', id: ++this.pingId, ct: now });
    }
    const poses = this.interp.sample(now);
    const drawTick = (this.interp as unknown as { drawTick(n: number): number }).drawTick(now);
    const viewTick = Math.round(this.interp.renderTick(now));
    const me = local.state.pos;
    // The nearest enemy drawn alive.
    let target: RemotePose | null = null;
    let best = Infinity;
    for (const p of poses) {
      if (p.slot === this.slot || !p.alive || p.slot >= 1000) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < best) {
        best = d;
        target = p;
      }
    }
    let forward = 0;
    let right = 0;
    let yaw = 0;
    let pitch = 0;
    let fire = false;
    if (target && local.alive) {
      if (now >= this.strafeUntil) {
        this.strafe = this.rng() < 0.5 ? -1 : 1;
        this.strafeUntil = now + 400 + this.rng() * 1100;
      }
      const aimAt = { x: target.x, y: target.y + this.aimOffset.up, z: target.z };
      // A point on the body: across it (perpendicular to the line of fire) by the shot's offset.
      const lx = target.x - me.x, lz = target.z - me.z;
      const ll = Math.hypot(lx, lz) || 1;
      aimAt.x += (-lz / ll) * this.aimOffset.side;
      aimAt.z += (lx / ll) * this.aimOffset.side;
      const look = lookAngles(local.eye, aimAt);
      yaw = look.yaw;
      pitch = look.pitch;
      forward = best > 25 ? 1 : best < 8 ? -1 : 0;
      right = this.strafe;
      // Stay on the deck: steer back toward the middle near its edge.
      if (Math.hypot(me.x, me.z) > 24) forward = 1;
      if (Math.hypot(me.x, me.z) > 24) {
        const back = lookAngles(local.eye, { x: 0, y: local.eye.y, z: 0 });
        yaw = back.yaw;
        pitch = 0;
        right = 0;
      } else if (now >= this.nextTap) {
        fire = true;
        this.nextTap = now + 150 + this.rng() * 250;
      }
    }
    this.acc += dt;
    const outbox: PlayerInput[] = [];
    let fired = false;
    while (this.acc >= TICK_DT) {
      this.acc -= TICK_DT;
      const jump = local.alive && this.rng() < 1 / 120;
      const buttons = (fire && !fired ? BUTTON_FIRE : 0) | (jump ? BUTTON_JUMP : 0) | (local.alive ? BUTTON_AUTO_RELOAD : 0);
      const { input, shot } = local.tick({ forward, right, buttons }, yaw, pitch, this.weapon, viewTick);
      outbox.push(input);
      if (buttons & BUTTON_FIRE) fired = true;
      if (shot && shot.ends.length && !shot.alt) {
        const end = shot.ends[0]!;
        const from = local.eye;
        const dx = end.x - from.x, dy = end.y - from.y, dz = end.z - from.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        const drawn = poses.filter((p) => p.alive).map((p) => ({ slot: p.slot, x: p.x, y: p.y, z: p.z, yaw: p.yaw, stance: (p.stance ?? 0) as Stance }));
        if (this.measuring) {
          this.shots.push({
            rec: { slot: this.slot, seq: input.seq, sentAt: now, drawTick, viewTick, screenHit: null, screenK: 0, screenAt: null, host: null, confirmMs: null },
            eye: { ...from },
            dir: { x: dx / len, y: dy / len, z: dz / len },
            drawn,
          });
        }
        // The next tap aims somewhere else on the body: across it within its width, from the hips to the neck.
        this.aimOffset = { side: (this.rng() - 0.5) * 0.5, up: 0.9 + this.rng() * 0.6 };
      }
    }
    if (outbox.length) this.send({ t: 'input', inputs: outbox });
  }

  close(): void {
    this.closed = true;
    this.coalescer.clear();
  }
}

const bodyAt = (bodies: readonly DrawnBody[], slot: number): Vec3 | null => {
  const b = bodies.find((o) => o.slot === slot);
  return b ? { x: b.x, y: b.y, z: b.z } : null;
};

/** The match's private parts the lab watches (the same objects the host runs on). */
interface MatchInside {
  pendingEvents: { e: string; s?: number; hit?: (number | null)[]; from?: [number, number, number]; fl?: number[] }[];
  fire(shooter: Combatant, def: unknown, viewTick: number): void;
}

/** Run one condition: a host, N players over lossy links, `seconds` measured. */
export async function runNetLab(o: NetLabOptions): Promise<NetLabResult> {
  const n = o.clients ?? 8;
  const seconds = o.seconds ?? 30;
  const warmup = o.warmupSeconds ?? 4;
  const weaponId = o.weapon ?? 'core.rifle';
  const def = getWeapon(weaponId);
  const rng = createRng(o.seed ?? 1);
  const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, scoreLimit: 0, timeLimitSeconds: 0, startingWeapons: ['core.knife', weaponId], startingGrenades: 0, spawnProtection: 0, bodySizes: false, characterStats: false, killstreaks: false, dropWeapons: false, emotes: false };
  const server: RunningServer = await startServer({ port: null, map: o.map ?? labDeck(), botFill: o.botFill ?? 0, rules, seed: o.seed ?? 1, startGate: false, tickSplit: false, mapVote: false, afkSeconds: 0, idleKickMinutes: 0 });
  const match: Match = server.match;
  const inside = match as unknown as MatchInside;

  // The host's own record: where everyone was each tick, every round it fired, inputs it dropped.
  const poses = new Map<number, Map<number, HostPose>>();
  const hostShots = new Map<string, HostShot>();
  let measuring = false;
  let droppedInputs = 0;
  let kills = 0;
  let tickMs = 0;
  let ticks = 0;
  const step = match.step.bind(match);
  match.step = () => {
    const t0 = performance.now();
    const events = step();
    tickMs += performance.now() - t0;
    ticks++;
    const at = new Map<number, HostPose>();
    for (const c of match.combatants()) {
      at.set(c.slot, { x: c.move.pos.x, y: c.move.pos.y, z: c.move.pos.z, alive: c.alive });
      // Rounds never run out (the lab measures the network, not the ammo economy).
      for (const w of c.weapons.values()) if (w.def.magazine > 0) w.reserve = Math.max(w.reserve, w.def.magazine * 2);
    }
    poses.set(match.tick, at);
    poses.delete(match.tick - TICK_RATE * 4);
    if (measuring) for (const ev of events) if (ev.e === 'kill' && ev.killer !== null) kills++;
    return events;
  };
  const fire = inside.fire.bind(match);
  inside.fire = (shooter, d, viewTick) => {
    const before = inside.pendingEvents.length;
    fire(shooter, d, viewTick);
    if (shooter.kind !== 'human') return;
    const ev = inside.pendingEvents.slice(before).find((e) => e.e === 'shot' && e.s === shooter.slot && e.hit);
    if (!ev) return;
    hostShots.set(`${shooter.slot}:${shooter.lastSeq}`, { tick: match.tick, viewTick, hit: ev.hit!, from: { x: ev.from![0], y: ev.from![1], z: ev.from![2] }, flying: !!ev.fl?.length });
  };
  const queue = match.queueInputs.bind(match);
  match.queueInputs = (slot, inputs) => {
    const c = match.slots[slot];
    const before = c ? c.queue.length + inputs.filter((i) => i.seq > (c.queue.length ? c.queue[c.queue.length - 1]!.seq : c.lastSeq)).length : 0;
    queue(slot, inputs);
    if (c && measuring) droppedInputs += Math.max(0, before - c.queue.length);
  };

  // The players, each over its own pair of links.
  const clients: LabClient[] = [];
  const links: LossyLink<unknown>[] = [];
  for (let i = 0; i < n; i++) {
    let client: LabClient | null = null;
    let channel: LabChannel | null = null;
    const up = new LossyLink<string>(o.condition, rng, 1000 / 60, (text) => channel?.emit('data', text));
    const down = new LossyLink<Uint8Array>(o.condition, rng, (1000 / TICK_RATE) * SNAPSHOT_INTERVAL_TICKS, (bytes) => client?.receive(bytes));
    channel = new LabChannel(down);
    client = new LabClient(`Net${i + 1}`, up, rng, weaponCode(def));
    client.setBodies((slot) => {
      const c = match.slots[slot];
      return c ? { box: c.hitbox, scale: c.hitScale * c.size } : null;
    });
    server.accept(peerConn(channel));
    client.send({ t: 'hello', protocol: PROTOCOL_VERSION, name: client.name, pk: `p_netlab${String(i).padStart(4, '0')}` });
    clients.push(client);
    links.push(up as LossyLink<unknown>, down as LossyLink<unknown>);
  }
  // Browser frames, 60 a second, each player at its own phase.
  const frames = setInterval(() => {
    const now = performance.now();
    for (const c of clients) c.frame(now);
  }, 1000 / 60);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 100 && !clients.every((c) => c.welcomed); i++) await sleep(100);
  await sleep(warmup * 1000);
  const b0 = links.map((l) => l.bytes);
  const l0 = links.map((l) => l.lost);
  const tick0 = { ms: tickMs, n: ticks };
  measuring = true;
  for (const c of clients) c.measuring = true;
  await sleep(seconds * 1000);
  for (const c of clients) c.measuring = false;
  measuring = false;
  const bytes = links.map((l, i) => l.bytes - b0[i]!);
  const lost = links.reduce((s, l, i) => s + l.lost - l0[i]!, 0);
  // Let the last shots' verdicts and frames arrive.
  await sleep(Math.max(600, o.condition.rttMs * 3 + o.condition.jitterMs * 2));
  clearInterval(frames);

  const shots: ShotRecord[] = [];
  const lagCm: number[] = [];
  let clamped = 0;
  for (const c of clients) {
    for (const s of c.shots) {
      c.judgeOnScreen(s, def);
      const h = hostShots.get(`${s.rec.slot}:${s.rec.seq}`) ?? null;
      s.rec.host = h;
      if (h) {
        const got = c.arrivals.find((a) => a.tick >= h.tick);
        s.rec.confirmMs = got ? got.at - s.rec.sentAt : null;
        if (h.tick - h.viewTick > MAX_REWIND_TICKS) clamped++;
        if (s.rec.screenHit !== null && s.rec.screenAt) {
          // Where the host had that body for this round: its rewound tick, plus the ticks of flight.
          const rewound = Math.max(h.tick - MAX_REWIND_TICKS, Math.min(h.tick, h.viewTick)) + s.rec.screenK;
          const p = poses.get(rewound)?.get(s.rec.screenHit);
          if (p) lagCm.push(Math.hypot(p.x - s.rec.screenAt.x, p.z - s.rec.screenAt.z) * 100);
        }
      }
      shots.push(s.rec);
    }
  }
  const screenHits = shots.filter((s) => s.screenHit !== null && s.host);
  const confirmed = screenHits.filter((s) => s.host!.hit.includes(s.screenHit));
  const missed = screenHits.filter((s) => !s.host!.hit.includes(s.screenHit));
  const deadOnHost = (s: ShotRecord) => {
    const p = poses.get(s.host!.tick)?.get(s.screenHit!);
    return !p || !p.alive;
  };
  const missDead = missed.filter(deadOnHost).length;
  const missClamped = missed.filter((s) => !deadOnHost(s) && s.host!.tick - s.host!.viewTick > MAX_REWIND_TICKS).length;
  const phantom = shots.filter((s) => s.screenHit === null && s.host && s.host.hit.some((x) => x !== null)).length;
  const corrections = clients.flatMap((c) => c.corrections);
  const confirmTimes = confirmed.map((s) => s.confirmMs).filter((x): x is number => x !== null);
  const rtts = clients.flatMap((c) => c.rtts);
  const gaps = clients.flatMap((c) => c.gaps);
  const result: NetLabResult = {
    condition: o.condition,
    clients: n,
    seconds,
    weapon: weaponId,
    rtt: { p50: Math.round(pct(rtts, 0.5)), p95: Math.round(pct(rtts, 0.95)) },
    shots: shots.length,
    screenHits: screenHits.length,
    confirmed: confirmed.length,
    missDead,
    missClamped,
    missOther: missed.length - missDead - missClamped,
    phantomHits: phantom,
    unfired: shots.filter((s) => !s.host).length,
    droppedInputs,
    lagCompCm: { p50: Math.round(pct(lagCm, 0.5)), p95: Math.round(pct(lagCm, 0.95)), max: Math.round(pct(lagCm, 1)) },
    clampedShots: clamped,
    confirmMs: { p50: Math.round(pct(confirmTimes, 0.5)), p95: Math.round(pct(confirmTimes, 0.95)) },
    correctionsPerMin: Math.round((corrections.length / n / seconds) * 60 * 10) / 10,
    correctionCm: { p50: Math.round(pct(corrections, 0.5) * 100), p95: Math.round(pct(corrections, 0.95) * 100), max: Math.round(pct(corrections, 1) * 100) },
    killsPerMin: Math.round((kills / seconds) * 60),
    downKBps: Math.round((bytes.filter((_, i) => i % 2 === 1).reduce((s, b) => s + b, 0) / n / seconds / 1024) * 10) / 10,
    upKBps: Math.round((bytes.filter((_, i) => i % 2 === 0).reduce((s, b) => s + b, 0) / n / seconds / 1024) * 10) / 10,
    mergedSnapshots: 0,
    snapshotGapMs: { p95: Math.round(pct(gaps, 0.95)), max: Math.round(pct(gaps, 1)) },
    lostPackets: lost,
    hostTickMs: Math.round(((tickMs - tick0.ms) / Math.max(1, ticks - tick0.n)) * 100) / 100,
  };
  for (const c of clients) c.close();
  for (const l of links) l.close();
  await server.close();
  return result;
}
