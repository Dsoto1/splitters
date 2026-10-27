/**
 * Opt-in frame timing for performance runs (tools/perf96.mjs): where each
 * rendered frame's time went. Off by default; when off every probe is one
 * boolean check. Turned on from the page with `window.__perf.on = true`.
 */
export interface FrameSample {
  /** Time since the previous frame started (ms). */
  dt: number;
  /** Simulation run on this thread since the previous frame (ms): Match.step, snapshots, encoding for friends. */
  sim: number;
  /** Ticks the simulation ran on this thread since the previous frame. */
  ticks: number;
  /** Largest number of ticks one wake of the sim loop ran since the previous frame (catch-up). */
  batch: number;
  /** Handling server messages (snapshots, events) since the previous frame (ms). */
  msg: number;
  /** The game frame's own JS: prediction, interpolation, visuals, HUD (ms), not counting render. */
  js: number;
  /** scene.render() (ms). */
  render: number;
}

export const perfProbe = {
  on: false,
  frames: [] as FrameSample[],
  /** Accumulated since the last frame. */
  sim: 0,
  ticks: 0,
  batch: 0,
  msg: 0,
  lastFrame: 0,
  /** Start of the frame being measured, and its render time. */
  frameStart: 0,
  render: 0,
  /** The sim loop ran `ticks` ticks taking `ms` (this thread). */
  addSim(ms: number, ticks: number): void {
    this.sim += ms;
    this.ticks += ticks;
    this.batch = Math.max(this.batch, ticks);
  },
  beginFrame(now: number): void {
    this.frameStart = now;
    this.render = 0;
  },
  endFrame(end: number): void {
    const dt = this.lastFrame ? this.frameStart - this.lastFrame : 0;
    this.lastFrame = this.frameStart;
    const total = end - this.frameStart;
    if (dt > 0) this.frames.push({ dt, sim: this.sim, ticks: this.ticks, batch: this.batch, msg: this.msg, js: Math.max(0, total - this.render), render: this.render });
    this.sim = this.ticks = this.batch = this.msg = 0;
  },
  reset(): void {
    this.frames = [];
    this.sim = this.ticks = this.batch = this.msg = 0;
    this.lastFrame = 0;
  },
};

(globalThis as unknown as { __perf: typeof perfProbe }).__perf = perfProbe;

/**
 * Opt-in network timing for hosted-match perf runs (tools/perf/host96.mjs): what the host's page spends
 * sending friends their snapshots, and what a friend's page spends receiving and applying them. Off by
 * default (one boolean check per message); `window.__net.on = true` turns it on.
 */
export const netProbe = {
  on: false,
  /** Host: messages, characters before compression, bytes on the wire, and the page's time compressing and sending them (ms). */
  sent: 0,
  sentChars: 0,
  sentBytes: 0,
  sendMs: 0,
  /** Friend: bytes off the wire, characters after inflating, time inflating and parsing (ms). */
  recvBytes: 0,
  recvChars: 0,
  inflateMs: 0,
  parseMs: 0,
  /** Friend: when each snapshot arrived (performance.now) and its tick, for jitter. */
  arrivals: [] as number[],
  ticks: [] as number[],
  /** Friend: input sent → acknowledged in a snapshot (ms), per snapshot that acked something new. */
  ackMs: [] as number[],
  inputAt: new Map<number, number>(),
  /** Friend: frames drawn past the newest snapshot (extrapolating) out of frames sampled, and clock resyncs. */
  extrapolated: 0,
  sampled: 0,
  resyncs: 0,
  /** Friend: far players frozen in a frame (no later snapshot had them yet), summed over frames. */
  frozen: 0,
  reset(): void {
    this.sent = this.sentChars = this.sentBytes = this.sendMs = 0;
    this.recvBytes = this.recvChars = this.inflateMs = this.parseMs = 0;
    this.arrivals = [];
    this.ticks = [];
    this.ackMs = [];
    this.inputAt.clear();
    this.extrapolated = this.sampled = this.resyncs = this.frozen = 0;
  },
};

(globalThis as unknown as { __net: typeof netProbe }).__net = netProbe;
