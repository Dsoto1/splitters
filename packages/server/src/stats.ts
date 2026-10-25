import type { ServerStats } from '@tiletrigger/shared';

/** One-second rolling window of server instrumentation (MULTIPLAYER_AI_SCALE "Test telemetry"). */
export class StatsWindow {
  private ticks = 0;
  private tickTotal = 0;
  private tickMax = 0;
  private aiTotal = 0;
  private snapshots = 0;
  private snapshotTotal = 0;
  private late = 0;

  recordTick(ms: number, aiMs: number): void {
    this.ticks++;
    this.tickTotal += ms;
    this.tickMax = Math.max(this.tickMax, ms);
    this.aiTotal += aiMs;
  }

  recordSnapshot(bytes: number): void {
    this.snapshots++;
    this.snapshotTotal += bytes;
  }

  recordLate(ticks: number): void {
    this.late += ticks;
  }

  flush(extra: Pick<ServerStats, 'bytesPerSecPerClient' | 'humans' | 'bots'>): ServerStats {
    const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
    const s: ServerStats = {
      tickMsAvg: round(this.ticks ? this.tickTotal / this.ticks : 0),
      tickMsMax: round(this.tickMax),
      aiMsAvg: round(this.ticks ? this.aiTotal / this.ticks : 0),
      snapshotBytes: Math.round(this.snapshots ? this.snapshotTotal / this.snapshots : 0),
      bytesPerSecPerClient: Math.round(extra.bytesPerSecPerClient),
      humans: extra.humans,
      bots: extra.bots,
      lateTicks: this.late,
    };
    this.ticks = this.tickTotal = this.tickMax = this.aiTotal = this.snapshots = this.snapshotTotal = this.late = 0;
    return s;
  }

  static format(s: ServerStats): string {
    return (
      `tick avg ${s.tickMsAvg.toFixed(2)}ms max ${s.tickMsMax.toFixed(2)}ms | ai ${s.aiMsAvg.toFixed(2)}ms | ` +
      `snapshot ${s.snapshotBytes}B | ${(s.bytesPerSecPerClient / 1024).toFixed(1)} KiB/s/client | ` +
      `${s.humans} humans ${s.bots} bots | late ${s.lateTicks}`
    );
  }
}
