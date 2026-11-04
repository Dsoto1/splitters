import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpikeLog, StatsWindow } from '../src/stats.ts';

describe('StatsWindow', () => {
  it('averages the tick sections a tick and keeps the slowest', () => {
    const w = new StatsWindow();
    const rows: [number, number][] = [
      [2, 1],
      [4, 3],
    ];
    for (const [think, slowest] of rows) {
      w.absorb(
        new Map([
          ['botThink', think],
          ['botThink slowest', slowest],
          ['snapshot', 1],
        ]),
      );
      w.recordTick(think + 1, think);
    }
    w.recordSnapshot(1000, 1500);
    w.recordSnapshot(2000, 2500);
    w.recordSpike();
    const s = w.flush({ bytesPerSecPerClient: 0, humans: 1, bots: 2 });
    expect(s.split).toEqual({ botThink: 3, 'botThink slowest': 3, snapshot: 1 });
    expect(s.snapshotBytes).toBe(1500);
    expect(s.snapshotBytesMax).toBe(2500);
    expect(s.spikes).toBe(1);
    expect(StatsWindow.format(s)).toContain('think 3.00');
    // A new second starts empty.
    expect(w.flush({ bytesPerSecPerClient: 0, humans: 0, bots: 0 }).split).toBeUndefined();
  });
});

describe('SpikeLog', () => {
  it('writes JSON lines, at most a few a second, and rolls the file over', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'spikes-')), 'perf-spikes.log');
    const log = new SpikeLog(file, 400, 3);
    for (let i = 0; i < 5; i++) log.write({ tick: i, ms: 30 });
    const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { tick: number });
    expect(lines.map((l) => l.tick)).toEqual([0, 1, 2]);
    const big = new SpikeLog(file, 200, 100);
    for (let i = 0; i < 10; i++) big.write({ tick: i, pad: 'x'.repeat(40) });
    expect(existsSync(file.replace(/\.log$/, '.1.log'))).toBe(true);
    expect(readFileSync(file, 'utf8').length).toBeLessThanOrEqual(200);
  });
});
