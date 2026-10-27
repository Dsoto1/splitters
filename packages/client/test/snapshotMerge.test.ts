import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent, PlayerSnapshot, ServerMessage } from '@tiletrigger/shared';
import { LATE_SNAPSHOTS, SnapshotCoalescer, mergeSnapshots } from '../src/game/snapshotMerge.ts';

type Snapshot = Extract<ServerMessage, { t: 'snapshot' }>;

const player = (s: number, x: number): PlayerSnapshot => ({ s, p: [x, 0, 0], yaw: 0, pitch: 0, hp: 100, ar: 0, alive: 1, w: 1, vy: 0, g: 1 }) as unknown as PlayerSnapshot;

const snap = (tick: number, extra: Partial<Snapshot> = {}): Snapshot => ({
  t: 'snapshot',
  ack: tick,
  tick,
  phase: 'playing',
  timeLeft: 0,
  players: [player(0, tick)],
  score: [],
  ev: [{ e: 'spawn', s: tick } as unknown as GameEvent],
  pr: [],
  pk: [],
  np: [],
  ...extra,
});

afterEach(() => vi.restoreAllMocks());

describe('merging snapshots the page fell behind on', () => {
  it('keeps every event in order and every scenario change, and takes full state from the newer one', () => {
    const a = snap(10, { sc: { es: [[3, 100, 0], [5, 0, 1]], ob: [1, 0], tm: [[0, 30]] }, md: { ts: [1, 2], fp: [[1, 0, 0, 0, 0, 0, 0, 100]] } });
    const b = snap(12, { sc: { es: [[5, 50, 0], [7, 0, 0]] }, md: { ts: [3, 2] } });
    const m = mergeSnapshots(a, b);
    expect(m.tick).toBe(12);
    expect(m.ack).toBe(12);
    expect(m.players).toEqual(b.players);
    expect(m.ev).toEqual([...a.ev, ...b.ev]);
    // Door 3 from the older, door 5 as the newer left it, door 7 new; objectives and timers unchanged since the older.
    expect(m.sc).toEqual({ es: [[3, 100, 0], [5, 50, 0], [7, 0, 0]], ob: [1, 0], tm: [[0, 30]] });
    // Fort pieces aren't resent when unchanged: kept from the older one; the team scores are the newer.
    expect(m.md).toEqual({ ts: [3, 2], fp: [[1, 0, 0, 0, 0, 0, 0, 100]] });
  });

  it('keeps players the newer snapshot held back (interest management) from the older one', () => {
    const a = snap(10, { players: [player(0, 1), player(4, 9)] });
    const b = snap(12, { players: [player(0, 2)], hold: [4, 6] });
    const m = mergeSnapshots(a, b);
    expect(m.players.map((p) => [p.s, p.p[0]])).toEqual([
      [0, 2],
      [4, 9],
    ]);
    expect(m.hold).toEqual([6]);
  });
});

describe('a page that falls behind its match (the 96-player warm-up stall)', () => {
  /** The page's task queue, run by hand: `later` callbacks queue behind the messages already waiting. */
  const harness = () => {
    const got: ServerMessage[] = [];
    const tasks: (() => void)[] = [];
    const q = new SnapshotCoalescer(
      (m) => got.push(m),
      (fn) => tasks.push(fn),
    );
    const runTasks = () => {
      while (tasks.length) tasks.shift()!();
    };
    return { got, q, runTasks };
  };

  it('a snapshot that finds nothing waiting goes straight through', () => {
    const { got, q, runTasks } = harness();
    q.push(snap(2));
    expect(got.map((m) => (m as Snapshot).tick)).toEqual([2]);
    runTasks();
    q.push(snap(4));
    runTasks();
    expect(got.map((m) => (m as Snapshot).tick)).toEqual([2, 4]);
    expect(q.backlog).toEqual({ merged: 0, most: 0, late: 0 });
  });

  it('twenty seconds of snapshots queued behind a long frame cost two deliveries, with nothing lost', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { got, q, runTasks } = harness();
    // The page was busy for 20 s (a frame while models and shaders load): 600 snapshots are waiting.
    // Each opens or closes a door, and carries an event.
    const queued = Array.from({ length: 600 }, (_, i) => snap(2 * (i + 1), { sc: { es: [[i % 7, i % 2 ? 100 : 0, 0]] } }));
    for (const m of queued) q.push(m);
    runTasks();
    // Before: 600 full snapshot handlings (scenario colliders, vehicles, prediction replay each), while
    // the match sent 30 more a second: the page never caught up. Now: the first, then the rest as one.
    expect(got).toHaveLength(2);
    const last = got[1] as Snapshot;
    expect(last.tick).toBe(1200);
    expect(last.ack).toBe(1200);
    expect([...(got[0] as Snapshot).ev, ...last.ev]).toEqual(queued.flatMap((m) => m.ev));
    // Every door ends as the last snapshot that mentioned it left it.
    for (let d = 0; d < 7; d++) {
      const lastFor = queued.filter((m) => m.sc!.es![0]![0] === d).pop()!;
      expect(last.sc!.es!.find((e) => e[0] === d)).toEqual(lastFor.sc!.es![0]);
    }
    expect(q.backlog).toEqual({ merged: 599, most: 599, late: 1 });
    // Logged once, not per backlog.
    expect(warn).toHaveBeenCalledTimes(1);
    for (const m of queued) q.push(m);
    runTasks();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(q.backlog.late).toBe(2);
  });

  it('other messages keep their place: what is waiting goes first', () => {
    const { got, q, runTasks } = harness();
    q.push(snap(2));
    q.push(snap(4));
    q.push(snap(6));
    q.push({ t: 'roster', players: [] });
    q.push(snap(8));
    runTasks();
    expect(got.map((m) => (m.t === 'snapshot' ? m.tick : m.t))).toEqual([2, 6, 'roster', 8]);
    expect((got[1] as Snapshot).ev).toHaveLength(2);
  });
});

it('the late threshold is a second of snapshots', () => {
  expect(LATE_SNAPSHOTS).toBe(30);
});
