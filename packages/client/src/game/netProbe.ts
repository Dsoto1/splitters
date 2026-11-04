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
