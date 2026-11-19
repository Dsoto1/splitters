import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES, PROTOCOL_VERSION, SNAPSHOT_BINARY_VERSION, SnapshotBinaryDecoder, SnapshotBinaryEncoder, SnapshotDecoder, type PlayerSnapshot, type ServerMessage, type SnapshotMessage } from '@tiletrigger/shared';
import { makeMap } from '../../shared/test/helpers.ts';
import { Interpolator, INTERP_KEEPS_SNAPSHOTS } from '../src/game/interpolation.ts';
import { LocalTransport, SNAPSHOT_RING, type RemoteLink } from '../src/game/localTransport.ts';
import { MatchHost, dispatchToHost, sinkTo, type FromSimHost, type ToSimHost } from '../src/game/matchHost.ts';

// The local match's snapshots as binary messages (shared/net/snapshotBinary.ts): which side sends what to which,
// with the worker stood in for by FakeWorker below (the real match, the real messages, buffers really transferred).

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.window ??= globalThis;
  g.document ??= { hidden: false };
});

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};

const until = async (cond: () => boolean, ms = 20000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};

/** What a FakeWorker does differently from today's match worker. */
interface WorkerKind {
  /** A match worker from before binary snapshots: it doesn't know `start.snap`. */
  old?: boolean;
  /** A match worker that writes a version this page doesn't read. */
  otherVersion?: boolean;
}
let kind: WorkerKind = {};
/** Everything the page and the "worker" said to each other, and each snapshot as the match made it (by tick). */
let toWorker: ToSimHost[] = [];
let fromWorker: FromSimHost[] = [];
let made = new Map<number, SnapshotMessage>();
let returned: ArrayBuffer[] = [];

/** The match worker (simWorker.ts) on this thread: the same MatchHost and sink, messages copied and buffers transferred as `postMessage` does. */
class FakeWorker {
  onmessage: ((e: { data: FromSimHost }) => void) | null = null;
  onerror: unknown = null;
  private host: MatchHost | null = null;
  private dead = false;

  postMessage(m: ToSimHost, transfer: Transferable[] = []): void {
    const data = structuredClone(m, { transfer });
    toWorker.push(data);
    if (data.k === 'snapbufs') returned.push(...data.bufs);
    setTimeout(() => this.handle(data), 0);
  }

  private handle(m: ToSimHost): void {
    if (this.dead) return;
    const post = (out: FromSimHost, transfer: Transferable[] = []) => {
      if (this.dead) return;
      if (out.k === 'local' && out.msg.t === 'snapshot') made.set(out.msg.tick, structuredClone(out.msg));
      if (out.k === 'snap') {
        made.set(new DataView(out.b).getUint32(12, true), new SnapshotBinaryDecoder().decode(out.b)!);
        if (kind.otherVersion) new DataView(out.b).setUint16(4, SNAPSHOT_BINARY_VERSION + 1, true);
      }
      const data = structuredClone(out, { transfer });
      fromWorker.push(data);
      this.onmessage?.({ data });
    };
    if (m.k === 'warm') return;
    if (m.k === 'start') {
      this.host = new MatchHost(m.map, m.opts, sinkTo(post, kind.old ? {} : { snap: m.snap }));
      this.host.setHidden(m.hidden);
      void this.host.start();
      return;
    }
    if (this.host) dispatchToHost(this.host, m, post);
  }

  terminate(): void {
    this.dead = true;
    this.host?.stop();
  }
}

const open: LocalTransport[] = [];
afterEach(() => {
  open.splice(0).forEach((t) => t.close());
  vi.unstubAllGlobals();
});

const start = async (k: WorkerKind = {}) => {
  kind = k;
  toWorker = [];
  fromWorker = [];
  made = new Map();
  returned = [];
  vi.stubGlobal('Worker', FakeWorker);
  const t = new LocalTransport(yard(), { name: 'Host', botFill: 4, difficulty: 'normal', rules: { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] } });
  open.push(t);
  const got: ServerMessage[] = [];
  t.start((m) => got.push(structuredClone(m)), () => undefined);
  await until(() => got.some((m) => m.t === 'host'));
  expect(t.thread).toBe('worker');
  const snaps = () => got.filter((m): m is SnapshotMessage => m.t === 'snapshot');
  return { t, got, snaps };
};

/** A delivered snapshot against the match's own of that tick: the state exactly (events may hold several snapshots' worth, merged). */
const sameState = (got: SnapshotMessage) => {
  const want = made.get(got.tick)!;
  expect(want).toBeTruthy();
  const { ev: _a, sc: _b, ...state } = got;
  const { ev: _c, sc: _d, ...wantState } = want;
  expect(state).toEqual(JSON.parse(JSON.stringify(wantState)));
};

describe('the local match\'s snapshots, binary where both sides read it', () => {
  it('a page that reads binary and a match worker that writes it: binary snapshots, buffers transferred and handed back', async () => {
    const { t, snaps } = await start();
    expect(toWorker.find((m) => m.k === 'start')).toMatchObject({ snap: SNAPSHOT_BINARY_VERSION });
    await until(() => snaps().length >= 30);
    expect(t.binarySnapshots).toBeGreaterThanOrEqual(snaps().length);
    expect(fromWorker.some((m) => m.k === 'local' && m.msg.t === 'snapshot')).toBe(false);
    expect(snaps().length).toBeGreaterThan(0);
    for (const s of snaps()) sameState(s);
    // Ticks in order, as before.
    expect(snaps().map((s) => s.tick)).toEqual([...snaps().map((s) => s.tick)].sort((a, b) => a - b));
    // Read buffers went back to the worker (and were taken: a later snapshot arrived in one of them).
    expect(returned.length).toBeGreaterThanOrEqual(4);
    expect(toWorker.some((m) => m.k === 'snapobjects')).toBe(false);
  });

  it('a page that reads binary and an older match worker: objects, as before', async () => {
    const { t, snaps } = await start({ old: true });
    await until(() => snaps().length >= 10);
    expect(t.binarySnapshots).toBe(0);
    expect(fromWorker.some((m) => m.k === 'snap')).toBe(false);
    for (const s of snaps()) sameState(s);
  });

  it('a match worker writing a version the page does not read: the page asks for objects and the match carries on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { t, snaps } = await start({ otherVersion: true });
    await until(() => snaps().length >= 10);
    expect(t.binarySnapshots).toBe(0);
    expect(toWorker.filter((m) => m.k === 'snapobjects')).toHaveLength(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes(`version ${SNAPSHOT_BINARY_VERSION + 1}`))).toBe(true);
    // Whatever binary ones were on their way are dropped; objects follow.
    expect(fromWorker.some((m) => m.k === 'snap')).toBe(true);
    for (const s of snaps()) sameState(s);
    warn.mockRestore();
  });

  it('an older page (it says nothing about binary) or one that reads another version gets objects from today\'s match worker', () => {
    const snapshot: SnapshotMessage = { t: 'snapshot', ack: 0, tick: 2, phase: 'playing', timeLeft: 10, players: [], score: [], ev: [], pr: [], pk: [], np: [] };
    for (const opts of [undefined, {}, { snap: SNAPSHOT_BINARY_VERSION + 1 }, { snap: 0 }]) {
      const out: [FromSimHost, Transferable[] | undefined][] = [];
      sinkTo((m, transfer) => out.push([m, transfer]), opts).local(snapshot);
      expect(out).toEqual([[{ k: 'local', msg: snapshot }, undefined]]);
    }
    // And to a page that reads this version: the buffer, in the transfer list; other messages as objects.
    const out: [FromSimHost, Transferable[] | undefined][] = [];
    const sink = sinkTo((m, transfer) => out.push([m, transfer]), { snap: SNAPSHOT_BINARY_VERSION });
    sink.local(snapshot);
    sink.local({ t: 'notice', text: 'hi' });
    expect(out[0]![0].k).toBe('snap');
    expect(out[0]![1]).toEqual([(out[0]![0] as Extract<FromSimHost, { k: 'snap' }>).b]);
    expect(new SnapshotBinaryDecoder().decode((out[0]![0] as Extract<FromSimHost, { k: 'snap' }>).b)).toEqual(snapshot);
    expect(out[1]).toEqual([{ k: 'local', msg: { t: 'notice', text: 'hi' } }, undefined]);
    // Told the page can't read them: objects from then on.
    sink.objectsOnly!();
    sink.local(snapshot);
    expect(out[2]![0]).toEqual({ k: 'local', msg: snapshot });
  });

  it('a snapshot the format cannot carry falls back to objects for good (nothing is lost)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const odd = { t: 'snapshot', ack: 0, tick: 2, phase: 'playing', timeLeft: 10, players: [{ s: 0, p: [0, 0, 0], vy: 0, g: 1, yaw: 0, pitch: 0, hp: 100, ar: 0, alive: 1, w: 1, pu: 0, later: 1 }], score: [], ev: [], pr: [], pk: [], np: [] } as unknown as SnapshotMessage;
    const out: FromSimHost[] = [];
    const sink = sinkTo((m) => out.push(m), { snap: SNAPSHOT_BINARY_VERSION });
    sink.local(odd);
    sink.local({ ...odd, players: [] });
    expect(out.map((m) => m.k)).toEqual(['local', 'local']);
    expect((out[0] as Extract<FromSimHost, { k: 'local' }>).msg).toBe(odd);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('friends on a hosted match get what they always got: JSON text, deltas a client from before reads', async () => {
    const { t, snaps } = await start();
    const texts: string[] = [];
    let say: (text: string) => void = () => undefined;
    const link: RemoteLink = { send: (text) => texts.push(text), onMessage: (cb) => (say = cb), onClose: () => undefined, close: () => undefined };
    t.accept(link);
    // The hello of a client from before this change (it has no word about binary; there is none to say).
    say(JSON.stringify({ t: 'hello', protocol: PROTOCOL_VERSION, name: 'Friend' }));
    const parsed = () => texts.map((x) => JSON.parse(x) as ServerMessage);
    await until(() => parsed().filter((m) => m.t === 'snapshot').length >= 10);
    expect(parsed().find((m) => m.t === 'welcome')).toMatchObject({ protocol: PROTOCOL_VERSION });
    const decoder = new SnapshotDecoder();
    for (const m of parsed()) {
      if (m.t !== 'snapshot') continue;
      const full = decoder.snapshot(m);
      expect(full.players.length).toBe(4);
      expect(full.players.every((p) => Array.isArray(p.p) && p.p.length === 3)).toBe(true);
    }
    // The host's own page meanwhile reads binary.
    expect(t.binarySnapshots).toBeGreaterThan(0);
    expect(snaps().length).toBeGreaterThan(0);
  });
});

describe('reused player objects and the interpolation buffer', () => {
  const at = (tick: number): SnapshotMessage => ({ t: 'snapshot', ack: 0, tick, phase: 'playing', timeLeft: 0, players: [0, 1, 2].map((s): PlayerSnapshot => ({ s, p: [tick, s, 0], vy: 0, g: 1, yaw: tick / 1000, pitch: 0, hp: 100, ar: 0, alive: 1, w: 1, pu: 0 })), score: [], ev: [], pr: [[1, tick, 0, 0, 0]], pk: [], np: [] });
  type Frames = { frames: { tick: number; players: Map<number, PlayerSnapshot> }[] };

  it('the ring is longer than anything the buffer keeps: every buffered frame still has its own snapshot\'s players', () => {
    expect(SNAPSHOT_RING).toBeGreaterThan(INTERP_KEEPS_SNAPSHOTS);
    const enc = new SnapshotBinaryEncoder();
    const dec = new SnapshotBinaryDecoder({ ring: SNAPSHOT_RING });
    const interp = new Interpolator();
    let most = 0;
    for (let i = 1; i <= 400; i++) {
      const tick = i * 2;
      // Now and then a burst the page merges: decoded, never handed on.
      if (i % 7 === 0) for (let k = 0; k < 5; k++) dec.decode(enc.encode(at(tick - 1))!);
      const msg = dec.decode(enc.encode(at(tick))!)!;
      dec.commit();
      interp.push(msg.tick, msg.players, msg.pr, undefined, (tick / 60) * 1000);
      const frames = (interp as unknown as Frames).frames;
      most = Math.max(most, frames.length);
      for (const f of frames) for (const [s, p] of f.players) expect([p.p[0], p.p[1], p.yaw]).toEqual([f.tick, s, f.tick / 1000]);
    }
    expect(most).toBe(INTERP_KEEPS_SNAPSHOTS);
    // And it draws as it would from snapshots with objects of their own.
    const plain = new Interpolator();
    for (let i = 1; i <= 400; i++) plain.push(i * 2, at(i * 2).players, at(i * 2).pr, undefined, ((i * 2) / 60) * 1000);
    const now = (800 / 60) * 1000 + 5;
    expect(interp.sample(now)).toEqual(plain.sample(now));
    expect(interp.sampleProjectiles(now)).toEqual(plain.sampleProjectiles(now));
  });
});
