import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs';
import type { ServerStats } from '@tiletrigger/shared';

/**
 * One-second rolling window of server instrumentation (MULTIPLAYER_AI_SCALE "Test telemetry"; docs/PERF_TOOLS.md
 * "On the host"). Besides the tick's total it keeps where the tick's time went (`absorb`: the sim's own
 * sections and bot AI parts from simProfile, plus snapshot building) and the snapshot bytes per client.
 */
export class StatsWindow {
  private ticks = 0;
  private tickTotal = 0;
  private tickMax = 0;
  private aiTotal = 0;
  private snapshots = 0;
  private snapshotTotal = 0;
  private snapshotMax = 0;
  private late = 0;
  private spikes = 0;
  private readonly sections = new Map<string, number>();

  recordTick(ms: number, aiMs: number): void {
    this.ticks++;
    this.tickTotal += ms;
    this.tickMax = Math.max(this.tickMax, ms);
    this.aiTotal += aiMs;
  }

  /** Bytes each client got for one snapshot round: the average and the largest. */
  recordSnapshot(bytes: number, maxBytes = bytes): void {
    this.snapshots++;
    this.snapshotTotal += bytes;
    this.snapshotMax = Math.max(this.snapshotMax, maxBytes);
  }

  recordLate(ticks: number): void {
    this.late += ticks;
  }

  recordSpike(): void {
    this.spikes++;
  }

  /** One tick's sections (ms by name): summed into the second ("… slowest" keys keep their largest). */
  absorb(ms: ReadonlyMap<string, number>): void {
    for (const [k, v] of ms) this.sections.set(k, k.endsWith('slowest') ? Math.max(this.sections.get(k) ?? 0, v) : (this.sections.get(k) ?? 0) + v);
  }

  flush(extra: Pick<ServerStats, 'bytesPerSecPerClient' | 'humans' | 'bots'>): ServerStats {
    const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
    const split: Record<string, number> = {};
    for (const [k, v] of this.sections) split[k] = round(k.endsWith('slowest') ? v : this.ticks ? v / this.ticks : 0);
    const s: ServerStats = {
      tickMsAvg: round(this.ticks ? this.tickTotal / this.ticks : 0),
      tickMsMax: round(this.tickMax),
      aiMsAvg: round(this.ticks ? this.aiTotal / this.ticks : 0),
      snapshotBytes: Math.round(this.snapshots ? this.snapshotTotal / this.snapshots : 0),
      bytesPerSecPerClient: Math.round(extra.bytesPerSecPerClient),
      humans: extra.humans,
      bots: extra.bots,
      lateTicks: this.late,
      ...(this.sections.size ? { split } : {}),
      snapshotBytesMax: this.snapshotMax,
      spikes: this.spikes,
    };
    this.ticks = this.tickTotal = this.tickMax = this.aiTotal = this.snapshots = this.snapshotTotal = this.snapshotMax = this.late = this.spikes = 0;
    this.sections.clear();
    return s;
  }

  static format(s: ServerStats): string {
    const sp = s.split;
    const part = (k: string) => (sp?.[k] !== undefined ? sp[k]!.toFixed(2) : '-');
    return (
      `tick avg ${s.tickMsAvg.toFixed(2)}ms max ${s.tickMsMax.toFixed(2)}ms | ai ${s.aiMsAvg.toFixed(2)}ms` +
      (sp ? ` (think ${part('botThink')} perceive ${part('botPerceive')} path ${part('botPath')} aim ${part('botAim')}) | sim players ${part('players')} mounts ${part('mounts')} projectiles ${part('projectiles')} | snapshots ${part('snapshot')}ms` : '') +
      ` | snapshot ${s.snapshotBytes}B (max ${s.snapshotBytesMax ?? s.snapshotBytes}B) | ${(s.bytesPerSecPerClient / 1024).toFixed(1)} KiB/s/client | ` +
      `${s.humans} humans ${s.bots} bots | late ${s.lateTicks}${s.spikes ? ` | spikes ${s.spikes}` : ''}`
    );
  }
}

/**
 * Ticks over budget, one JSON line each, in a rolling file (`maxBytes`, then renamed `.1` and started again:
 * at most twice that on disk). At most `perSecond` lines a second; the rest are counted in the next line.
 */
export class SpikeLog {
  private size = 0;
  private second = 0;
  private inSecond = 0;
  private dropped = 0;
  constructor(
    readonly file: string,
    private readonly maxBytes = 2 * 1024 * 1024,
    private readonly perSecond = 5,
  ) {
    try {
      this.size = existsSync(file) ? statSync(file).size : 0;
    } catch {
      this.size = 0;
    }
  }

  write(entry: Record<string, unknown>): void {
    const s = Math.floor(Date.now() / 1000);
    if (s !== this.second) {
      this.second = s;
      this.inSecond = 0;
    }
    if (++this.inSecond > this.perSecond) {
      this.dropped++;
      return;
    }
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry, ...(this.dropped ? { droppedBefore: this.dropped } : {}) })}\n`;
    this.dropped = 0;
    try {
      if (this.size + line.length > this.maxBytes && existsSync(this.file)) {
        renameSync(this.file, this.file.replace(/(\.log)?$/, '.1.log'));
        this.size = 0;
      }
      appendFileSync(this.file, line);
      this.size += line.length;
    } catch {
      // A full disk or a read-only folder mustn't stop the server.
    }
  }
}
