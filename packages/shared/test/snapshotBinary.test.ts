import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  CORE_BOT_PROFILES,
  SNAPSHOT_BINARY_MAX_BYTES,
  SNAPSHOT_BINARY_VERSION,
  SNAPSHOT_HEADER_KEYS,
  SNAPSHOT_INTERVAL_TICKS,
  SNAPSHOT_JSON_KEYS,
  SNAPSHOT_KEYS_COVERED,
  SNAPSHOT_PLAYER_KEYS,
  SNAPSHOT_PLAYER_KEYS_COVERED,
  SNAPSHOT_ROW_KEYS,
  SnapshotBinaryDecoder,
  SnapshotBinaryEncoder,
  initPhysics,
  loadMap,
  rulesForMode,
  snapshotBinaryVersion,
  type GameEvent,
  type GameMode,
  type MatchRules,
  type PlayerSnapshot,
  type SnapshotMessage,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const JSON_KEYS = SNAPSHOT_JSON_KEYS.map(([k]) => k as string);
const ROW_KEYS = SNAPSHOT_ROW_KEYS.map(([k]) => k as string);
const TOP_KEYS = [...SNAPSHOT_HEADER_KEYS, 'players', ...ROW_KEYS, ...JSON_KEYS];

/**
 * What a decoded snapshot must equal: the original, with the fields that travel as JSON text as JSON carries them
 * (-0 reads back 0, as on every networked player's link). Everything else is exact.
 */
function expected(msg: SnapshotMessage): SnapshotMessage {
  const out = { ...msg } as unknown as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    // (A field set to undefined, as the scenario's when nothing changed, is a field that isn't there.)
    if (out[k] === undefined) delete out[k];
    else if (JSON_KEYS.includes(k) || !TOP_KEYS.includes(k)) out[k] = JSON.parse(JSON.stringify(out[k]));
  }
  return out as unknown as SnapshotMessage;
}

/** Real snapshots: `ticks` of `mode` on a map with bots, each with a player's private state (the players in turn). */
function play(mapId: string, mode: GameMode, ticks: number, extra: Partial<MatchRules> = {}, bots = 12): SnapshotMessage[] {
  const loaded = loadMap(readFileSync(new URL(`../../../maps/${mapId}.json`, import.meta.url), 'utf8'));
  if (!loaded.ok) throw new Error(`${mapId} failed to load`);
  const match = new Match(loaded.map, { ...rulesForMode(loaded.map, mode), ...extra }, 7);
  for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.hard);
  const out: SnapshotMessage[] = [];
  let pending: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    pending.push(...match.step());
    if (match.tick % SNAPSHOT_INTERVAL_TICKS) continue;
    const slot = out.length % bots;
    const me = match.privateState(slot);
    out.push({ t: 'snapshot', ack: out.length, ...(me ? { me } : {}), ...match.snapshot(pending) });
    pending = [];
  }
  match.destroy();
  return out;
}

const player = (s: number, more: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({ s, p: [s * 1.25, 0.1 + s, -3.7], vy: -0.3, g: 1, yaw: 1.234, pitch: -0.2, hp: 100, ar: 25, alive: 1, w: 3, pu: 0, ...more });
const snapshot = (more: Partial<SnapshotMessage> = {}): SnapshotMessage => ({ t: 'snapshot', ack: 7, tick: 120, phase: 'playing', timeLeft: 291.5, players: [player(0), player(1, { st: 'attack' })], score: [{ s: 0, k: 1, d: 0 }], ev: [], pr: [], pk: [], np: [], ...more });

/** Every field the format has a place for, with the rare ones a short bot match doesn't reach. */
const everything = (): SnapshotMessage =>
  snapshot({
    players: [
      player(0, { vx: 1.5, vz: -2.25, fx: 1024 + 128, st: 'patrol', sn: 2, em: 1, sr: 1, cl: 3, ch: 2, dr: 1, zl: [2, 14.5, -6], zm: 1, dw: 1, sd: 1, ln: -7, dg: [2, 12] }),
      player(1, { g: 0, alive: 0, hp: -12, ar: 0, st: 'attack', sn: 1, ch: 1 }),
      player(127, { st: 'patrol', p: [-0, 1e-9, 123456.789] }),
    ],
    score: [{ s: 0, k: 3, d: 1, x: 1, o: 2, p: 40 }],
    ev: [{ e: 'shot', s: 0, w: 'core.rifle', from: [0, 1.6, 0], to: [[5, 1.5, 9]], hit: [null] }, { e: 'kill', killer: 0, victim: 1, weapon: 'core.rifle', hs: 1 }],
    pr: [[1, 2.5, 3, 4, 0], [2, 5, 6, 7, 3, 12]],
    pk: ['pickup_1', 'ammo_2'],
    pw: [['pickup_1', 'core.shotgun']],
    dw: [[4, 'core.rifle', 1, 0, 2, 0.5]],
    zn: [[0, 1, 0, 2, 3.5, 4.2]],
    mt: [[3, 1, 0, 2, 0.1, 0.2, -0.1, 80, 1, 0, -1]],
    ms: [[3, 40, -12, 8, 50, 2, 3, 1, 0]],
    cv: [[1, 4, 0, 5, 1.57, 60]],
    ic: [[1, 3, 4, 0, 5, 0.55, 1.05]],
    ab: [[1, 2, 0, 3, 0, 100, 4, 1]],
    me: { inv: [[3, 30, 90, 0], [5, 1, 4, 0, 40]], rl: 12, rs: 0, sp: 0, dm: 0, mo: [3, 0, 10], vp: [3, 1.5, 2.5], dd: [[120, 34, 1, 5, 1, 9]] },
    sc: { es: [[4, 100, 0]], ob: [0, 1], tm: [[0, 12]] },
    np: [[1000, 1, 0, 2, 0.5, 0, 100, 0, 1, 1, 3], [1001, 4, 0, 5, 0.5, 0, 0, 1, 1, 0, 3, 1.4]],
    md: { ts: [1, 0], fl: [[0, 1, 2, 3, 4, 5, 0]] },
    hold: [9, 12],
    ld: [0, -1],
    fs: [[1, 0, 0, 2, 1, 0, 1, 120, -45, 30, 0, 1]],
    rl: [1, 4.5, 60, 20],
  });

const roundTrip = (msg: SnapshotMessage, dec = new SnapshotBinaryDecoder()): SnapshotMessage | null => {
  const enc = new SnapshotBinaryEncoder();
  const buf = enc.encode(msg);
  expect(enc.failed).toBeNull();
  return dec.decode(buf!);
};

describe('the binary snapshot message', () => {
  it('names every field of the snapshot and of a player entry (a new field must be given a place)', () => {
    // The lists against the types: these two constants only compile while the lists cover every key.
    expect(SNAPSHOT_KEYS_COVERED).toBe(true);
    expect(SNAPSHOT_PLAYER_KEYS_COVERED).toBe(true);
    expect(new Set(TOP_KEYS).size).toBe(TOP_KEYS.length);
    expect(new Set(SNAPSHOT_PLAYER_KEYS).size).toBe(SNAPSHOT_PLAYER_KEYS.length);
  });

  // Maps and modes that between them fill most of the snapshot: vehicles and their suspension, NPCs, ammo boxes,
  // flags, hostages, sectors, forts' pieces, squads and leaders, zones, dropped weapons, mixed pickups, canopies.
  const cases: [string, GameMode, Partial<MatchRules>][] = [
    ['test_coverage', 'core.ctf', { fireteams: 4, leaders: true }],
    ['test_coverage', 'core.hostage', {}],
    ['test_coverage', 'core.breakthrough', { dropWeapons: true }],
    ['frost_basin', 'core.deathmatch', {}],
    ['iron_coast', 'core.roulette', { dropWeapons: true }],
    ['phase0_arena', 'core.deathmatch', { dropWeapons: true }],
    ['sandfall_colosseum', 'core.forts', {}],
  ];
  const seenTop = new Set<string>();
  const seenPlayer = new Set<string>();

  it.each(cases)('carries every snapshot of a bot match exactly: %s, %s', { timeout: 180_000 }, (mapId, mode, extra) => {
    const snaps = play(mapId, mode, 480, extra);
    expect(snaps.length).toBe(240);
    const enc = new SnapshotBinaryEncoder();
    const fresh = new SnapshotBinaryDecoder();
    const pooled = new SnapshotBinaryDecoder({ ring: 3 });
    for (const snap of snaps) {
      for (const [k, v] of Object.entries(snap)) if (v !== undefined && (!Array.isArray(v) || v.length)) seenTop.add(k);
      for (const p of snap.players) for (const k of Object.keys(p)) seenPlayer.add(k);
      const buf = enc.encode(snap);
      expect(enc.failed).toBeNull();
      expect(snapshotBinaryVersion(buf!)).toBe(SNAPSHOT_BINARY_VERSION);
      const want = expected(snap);
      const a = fresh.decode(buf!);
      expect(fresh.error).toBeNull();
      expect(a).toEqual(want);
      // The same keys, not only the same values: nothing the original has is missing, nothing is made up.
      expect(Object.keys(a!).sort()).toEqual(Object.keys(want).sort());
      const b = pooled.decode(buf!);
      expect(b).toEqual(want);
      pooled.commit();
      enc.recycle(buf!);
    }
  });

  it('has been through every field: the matches above and one snapshot with the rare ones', () => {
    const all = everything();
    const got = roundTrip(all);
    expect(got).toEqual(expected(all));
    for (const k of Object.keys(all)) seenTop.add(k);
    for (const p of all.players) for (const k of Object.keys(p)) seenPlayer.add(k);
    expect([...seenTop].sort()).toEqual([...TOP_KEYS].sort());
    expect([...seenPlayer].sort()).toEqual([...SNAPSHOT_PLAYER_KEYS].sort());
    // What the bot matches reached by themselves (so most of the format is checked against the real sim).
    for (const k of ['mt', 'ms', 'np', 'ab', 'fs', 'ld', 'md', 'pr', 'pw', 'dw', 'zn', 'me', 'sc', 'pk']) expect(seenTop.has(k), k).toBe(true);
  });

  it('version 4: a dodge (dg, mask 512: kind and ticks), as a version 3 record otherwise', () => {
    expect(SNAPSHOT_BINARY_VERSION).toBe(4);
    const buf = (more: Partial<PlayerSnapshot>) => new Uint8Array(new SnapshotBinaryEncoder().encode(snapshot({ players: [player(0, more)] }))!);
    const at = 32 + 2 + 2;
    const mask = (b: Uint8Array) => b[at + 2]! | (b[at + 3]! << 8);
    expect(mask(buf({ dg: [1, 3] })) & 512).toBe(512);
    expect(mask(buf({})) & 512).toBe(0);
    const pooled = new SnapshotBinaryDecoder({ ring: 2 });
    for (const more of [{ dg: [1, 1] }, { dg: [2, 33], ln: 4 }, {}, { dg: [2, 200], sd: 1 }, {}] as Partial<PlayerSnapshot>[]) {
      const msg = snapshot({ players: [player(0, more), player(1, { st: 'attack', sr: 1 })] });
      expect(roundTrip(msg)).toEqual(msg);
      const again = pooled.decode(new SnapshotBinaryEncoder().encode(msg)!)!;
      expect(again.players[0]!.dg).toEqual(more.dg);
      pooled.commit();
    }
    for (const bad of [{ dg: [3, 1] }, { dg: [1, 256] }, { dg: [1] }, { dg: [1, 0.5] }]) expect(new SnapshotBinaryEncoder().encode(snapshot({ players: [player(0, bad as Partial<PlayerSnapshot>)] }))).toBeNull();
  });

  it('version 3 kept: a slide bit (sd, 128) and a lean byte (ln, mask 256), as a version 2 record otherwise', () => {
    const buf = (more: Partial<PlayerSnapshot>) => new Uint8Array(new SnapshotBinaryEncoder().encode(snapshot({ players: [player(0, more)] }))!);
    const at = 32 + 2 + 2;
    expect(buf({ sd: 1 })[at + 1]! & 128).toBe(128);
    expect(buf({})[at + 1]! & 128).toBe(0);
    const mask = (b: Uint8Array) => b[at + 2]! | (b[at + 3]! << 8);
    expect(mask(buf({ ln: 10 })) & 256).toBe(256);
    expect(mask(buf({})) & 256).toBe(0);
    const pooled = new SnapshotBinaryDecoder({ ring: 2 });
    for (const more of [{ sd: 1 }, { ln: -10 }, { ln: 3, sd: 1 }, {}, { ln: 10 }, {}] as Partial<PlayerSnapshot>[]) {
      const msg = snapshot({ players: [player(0, more), player(1, { st: 'attack', sr: 1 })] });
      expect(roundTrip(msg)).toEqual(msg);
      const again = pooled.decode(new SnapshotBinaryEncoder().encode(msg)!)!;
      expect(again.players[0]!.sd).toBe(more.sd);
      expect(again.players[0]!.ln).toBe(more.ln);
      pooled.commit();
    }
    for (const bad of [{ sd: 2 }, { ln: 1.5 }, { ln: 200 }]) {
      const enc = new SnapshotBinaryEncoder();
      expect(enc.encode(snapshot({ players: [player(0, bad as Partial<PlayerSnapshot>)] }))).toBeNull();
    }
  });

  it('version 2 bits kept: the scoped bit (zm, 32) and the pair bit (dw, 64), each alone, both and neither', () => {
    const bitsOf = (more: Partial<PlayerSnapshot>) => {
      const buf = new SnapshotBinaryEncoder().encode(snapshot({ players: [player(0, more)] }))!;
      // The players start after the header (32 bytes), the strings' count (no bot state here: 2 bytes) and their own count (2).
      return new Uint8Array(buf)[32 + 2 + 2 + 1]!;
    };
    const base = bitsOf({});
    expect(base & (32 | 64)).toBe(0);
    expect(bitsOf({ zm: 1 })).toBe(base | 32);
    expect(bitsOf({ dw: 1 })).toBe(base | 64);
    expect(bitsOf({ zm: 1, dw: 1 })).toBe(base | 96);
    const pooled = new SnapshotBinaryDecoder({ ring: 2 });
    for (const more of [{ zm: 1 }, { dw: 1 }, { zm: 1, dw: 1 }, {}, { zm: 1 }, {}] as Partial<PlayerSnapshot>[]) {
      const msg = snapshot({ players: [player(0, more), player(1, { st: 'attack', sr: 1 })] });
      const got = roundTrip(msg)!;
      expect(got).toEqual(msg);
      expect(got.players[0]!.zm).toBe(more.zm);
      expect(got.players[0]!.dw).toBe(more.dw);
      expect(got.players[1]!.zm).toBeUndefined();
      // Reused player objects are refilled: a bit set in the last snapshot does not linger.
      const again = pooled.decode(new SnapshotBinaryEncoder().encode(msg)!)!;
      expect(again.players[0]!.zm).toBe(more.zm);
      expect(again.players[0]!.dw).toBe(more.dw);
      expect(JSON.parse(JSON.stringify(again.players[0]))).toEqual(player(0, more));
      pooled.commit();
    }
    // The bits cost no bytes: a scoped player's record is as long as an unscoped one's.
    const len = (m: SnapshotMessage) => new DataView(new SnapshotBinaryEncoder().encode(m)!).getUint32(8, true);
    expect(len(snapshot({ players: [player(0, { zm: 1, dw: 1 })] }))).toBe(len(snapshot({ players: [player(0)] })));
    // Out of range: refused, not approximated.
    for (const bad of [{ zm: 0 }, { zm: 2 }, { dw: true }]) {
      const enc = new SnapshotBinaryEncoder();
      expect(enc.encode(snapshot({ players: [{ ...player(0), ...bad } as unknown as PlayerSnapshot] }))).toBeNull();
    }
  });

  it('an old-shape snapshot (no zm, no dw) round-trips, and decodes to entries without them', () => {
    const old = snapshot({ players: [player(0, { vx: 1.5, vz: -2.25, fx: 4, sn: 2, em: 1, sr: 1, cl: 3, ch: 2, dr: 1, zl: [2, 14.5, -6] }), player(1, { st: 'attack' })] });
    const got = roundTrip(old)!;
    expect(got).toEqual(old);
    for (const p of got.players) {
      expect(p.zm).toBeUndefined();
      expect(p.dw).toBeUndefined();
      // (Decoded entries hold every field as an own property, absent ones undefined: as JSON they have no such key.)
      const json = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
      expect('zm' in json || 'dw' in json).toBe(false);
    }
  });

  it('keeps numbers exactly: positions, speeds and angles are the sim\'s own 64-bit values', () => {
    const p = player(5, { p: [1 / 3, -0, 1e-300], vy: Math.PI, yaw: -1e15 / 7, pitch: Number.MIN_VALUE, vx: 0.1 + 0.2, vz: -1 / 3 });
    const got = roundTrip(snapshot({ players: [p], pr: [[1, 0.1, 0.2, 0.3, 2]], timeLeft: 1 / 7 }))!;
    const q = got.players[0]!;
    expect(Object.is(q.p[0], 1 / 3) && Object.is(q.p[1], -0) && Object.is(q.p[2], 1e-300)).toBe(true);
    expect([q.vy, q.yaw, q.pitch, q.vx, q.vz]).toEqual([Math.PI, -1e15 / 7, Number.MIN_VALUE, 0.1 + 0.2, -1 / 3]);
    expect(got.pr[0]).toEqual([1, 0.1, 0.2, 0.3, 2]);
    expect(got.timeLeft).toBe(1 / 7);
  });

  it('a field this version has no place for still travels (as an extra), and cannot overwrite a known one', () => {
    const msg = { ...snapshot(), future: { a: [1, 2] }, later: 5 } as unknown as SnapshotMessage;
    expect(roundTrip(msg)).toEqual(msg);
  });

  it('refuses to encode what it cannot carry exactly, and stays off (the sender falls back to objects)', () => {
    const odd = [
      snapshot({ players: [{ ...player(0), extra: 1 } as unknown as PlayerSnapshot] }),
      snapshot({ players: [player(0, { hp: 100000 })] }),
      snapshot({ players: [player(300)] }),
      snapshot({ players: [player(0, { hp: 99.5 })] }),
      snapshot({ pr: [[1, 2, 3]] as unknown as SnapshotMessage['pr'] }),
      snapshot({ mt: [[1, 2, 3, 4, 5, 6, 7, 8, 'x']] as unknown as SnapshotMessage['mt'] }),
      snapshot({ phase: 'paused' as unknown as SnapshotMessage['phase'] }),
      snapshot({ tick: -1 }),
    ];
    for (const msg of odd) {
      const enc = new SnapshotBinaryEncoder();
      expect(enc.encode(msg)).toBeNull();
      expect(enc.failed).toBeTruthy();
      // Off for good: even a fine snapshot isn't encoded after that.
      expect(enc.encode(snapshot())).toBeNull();
    }
  });

  it('reuses buffers handed back, and grows them for a longer snapshot', () => {
    const enc = new SnapshotBinaryEncoder();
    const a = enc.encode(snapshot())!;
    enc.recycle(a);
    expect(enc.encode(snapshot())).toBe(a);
    const big = snapshot({ ev: Array.from({ length: 2000 }, (_, i) => ({ e: 'msg' as const, text: `line ${i} ${'x'.repeat(40)}`, secs: 3 })) });
    const b = enc.encode(big)!;
    expect(b.byteLength).toBeGreaterThan(a.byteLength);
    expect(new SnapshotBinaryDecoder().decode(b)).toEqual(big);
    // The short buffer is let go now; the long one is taken back.
    enc.recycle(a);
    enc.recycle(b);
    expect(enc.encode(snapshot())).toBe(b);
  });
});

describe('reading binary snapshots', () => {
  const valid = (): Uint8Array => new Uint8Array(new SnapshotBinaryEncoder().encode(everything())!);
  const length = (u8: Uint8Array) => new DataView(u8.buffer).getUint32(8, true);

  it('reads a message in a longer buffer (a pooled one), and one given as a view', () => {
    const u8 = valid();
    expect(u8.byteLength).toBeGreaterThan(length(u8));
    const exact = u8.slice(0, length(u8));
    const padded = new Uint8Array(exact.length + 64);
    padded.set(exact, 32);
    expect(new SnapshotBinaryDecoder().decode(padded.subarray(32, 32 + exact.length))).toEqual(expected(everything()));
  });

  it('takes only its own version (4), and no player field it does not know', () => {
    const dec = new SnapshotBinaryDecoder();
    // Versions 1, 2 (before sd and ln) and 3 (before dg) and a later one: refused before another byte is read.
    for (const v of [1, 2, 3, 5]) {
      const other = valid();
      new DataView(other.buffer).setUint16(4, v, true);
      expect(dec.decode(other)).toBeNull();
      expect(dec.error).toBe(`binary snapshot version ${v} (this reads 4)`);
    }
    const u8 = new Uint8Array(new SnapshotBinaryEncoder().encode(snapshot({ players: [player(0)] }))!);
    const bitsAt = 32 + 2 + 2 + 1;
    expect(dec.decode(u8)).not.toBeNull();
    u8[bitsAt] = u8[bitsAt]! | 32 | 64 | 128;
    expect(dec.decode(u8)!.players[0]).toMatchObject({ zm: 1, dw: 1, sd: 1 });
    // A mask bit past the dodge (1024): unknown, refused.
    u8[bitsAt + 2] = u8[bitsAt + 2]! | 4;
    expect(dec.decode(u8)).toBeNull();
    expect(dec.error).toBe('unknown player fields');
  });

  it('fails cleanly on another version or another kind of message, never misreads it', () => {
    const dec = new SnapshotBinaryDecoder();
    const u8 = valid();
    const other = u8.slice();
    new DataView(other.buffer).setUint16(4, SNAPSHOT_BINARY_VERSION + 1, true);
    expect(dec.decode(other)).toBeNull();
    expect(dec.error).toContain(`version ${SNAPSHOT_BINARY_VERSION + 1}`);
    expect(snapshotBinaryVersion(other)).toBe(SNAPSHOT_BINARY_VERSION + 1);
    const json = new TextEncoder().encode(JSON.stringify(everything()));
    expect(snapshotBinaryVersion(json)).toBeNull();
    expect(dec.decode(json)).toBeNull();
    expect(dec.error).toBe('not a binary snapshot');
    expect(dec.decode(new ArrayBuffer(0))).toBeNull();
    // And the reader is fine afterwards.
    expect(dec.decode(u8)).toEqual(expected(everything()));
    expect(dec.error).toBeNull();
  });

  it('refuses a message longer than a snapshot may be, or longer than its buffer', () => {
    const dec = new SnapshotBinaryDecoder();
    const u8 = valid();
    const long = u8.slice();
    new DataView(long.buffer).setUint32(8, SNAPSHOT_BINARY_MAX_BYTES + 1, true);
    expect(dec.decode(long)).toBeNull();
    const past = u8.slice();
    new DataView(past.buffer).setUint32(8, past.byteLength + 1, true);
    expect(dec.decode(past)).toBeNull();
    expect(dec.error).toBe('bad length');
  });

  it('rejects every truncation of a real message', () => {
    const dec = new SnapshotBinaryDecoder();
    const u8 = valid();
    const n = length(u8);
    for (let cut = 0; cut < n; cut++) {
      // Cut short in the buffer, and cut short by its own length field.
      expect(dec.decode(u8.slice(0, cut)), `cut at ${cut}`).toBeNull();
      if (cut >= 12) {
        const lied = u8.slice();
        new DataView(lied.buffer).setUint32(8, cut, true);
        expect(dec.decode(lied), `length ${cut}`).toBeNull();
      }
    }
  });

  it('counts and lengths that point past the end are refused before anything is made', () => {
    const dec = new SnapshotBinaryDecoder();
    const u8 = new Uint8Array(new SnapshotBinaryEncoder().encode(snapshot({ players: [] }))!).slice();
    const dv = new DataView(u8.buffer);
    // No strings, no players: the string count, then the player count, right after the header.
    expect(dv.getUint16(32, true)).toBe(0);
    for (const at of [32, 34, 36]) {
      const bad = u8.slice();
      new DataView(bad.buffer).setUint16(at, 0xfffe, true);
      const t0 = performance.now();
      expect(dec.decode(bad)).toBeNull();
      expect(performance.now() - t0).toBeLessThan(50);
    }
  });

  it('random bytes, and real messages with bytes changed, never throw and never hang', { timeout: 120_000 }, () => {
    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const dec = new SnapshotBinaryDecoder({ ring: 2 });
    const u8 = valid();
    const n = length(u8);
    const shaped = (m: SnapshotMessage | null) => m === null || (m.t === 'snapshot' && Array.isArray(m.players) && Array.isArray(m.ev) && Array.isArray(m.score) && Array.isArray(m.pr) && Array.isArray(m.np) && Array.isArray(m.pk));
    const t0 = performance.now();
    let read = 0;
    // Pure noise, with and without a good header in front.
    for (let i = 0; i < 4000; i++) {
      const noise = new Uint8Array(Math.floor(rnd() * 600));
      for (let j = 0; j < noise.length; j++) noise[j] = Math.floor(rnd() * 256);
      if (i % 2 && noise.length >= 32) {
        noise.set(u8.subarray(0, 12));
        new DataView(noise.buffer).setUint32(8, noise.length, true);
        noise[28] = i % 4;
        noise[29] = noise[30] = noise[31] = 0;
      }
      const m = dec.decode(noise);
      expect(shaped(m)).toBe(true);
      if (m) read++;
      dec.commit();
    }
    // Every byte of a real message changed in turn (to a few values), and a few bytes at once.
    for (let at = 0; at < n; at++) {
      for (const v of [0, 1, 0x7f, 0xff, Math.floor(rnd() * 256)]) {
        const bad = u8.slice(0, n);
        bad[at] = v;
        expect(shaped(dec.decode(bad))).toBe(true);
      }
    }
    for (let i = 0; i < 4000; i++) {
      const bad = u8.slice(0, n);
      for (let k = 1 + Math.floor(rnd() * 6); k > 0; k--) bad[Math.floor(rnd() * n)] = Math.floor(rnd() * 256);
      expect(shaped(dec.decode(bad))).toBe(true);
    }
    // The reader still works after all that.
    expect(dec.decode(u8)).toEqual(expected(everything()));
    // (Noise almost never happens to be a message.)
    expect(read).toBeLessThan(40);
    expect(performance.now() - t0).toBeLessThan(60_000);
  });
});

describe('reading into reused objects', () => {
  const moving = (i: number): SnapshotMessage => snapshot({ tick: i * 2, players: [player(0, { p: [i, 0, 0] }), player(1, { p: [0, 0, i], st: i % 2 ? 'attack' : 'patrol' })], pr: [[1, i, 0, 0, 0]], mt: [[3, 1, 0, 2, 0, 0, 0, 100, 1, -1], [4, i, 0, 0, 0, 0, 0, 100, 1, -1]], score: [{ s: 0, k: Math.floor(i / 4), d: 0 }], pk: ['a'] });

  it('a ring of N: a snapshot handed on keeps its players and rows until N more have been', () => {
    const enc = new SnapshotBinaryEncoder();
    const dec = new SnapshotBinaryDecoder({ ring: 4 });
    const got: SnapshotMessage[] = [];
    for (let i = 0; i < 12; i++) {
      got.push(dec.decode(enc.encode(moving(i))!)!);
      dec.commit();
      // The last four handed on are intact.
      for (let k = Math.max(0, i - 3); k <= i; k++) {
        expect(got[k]!.players[0]!.p[0]).toBe(k);
        expect(got[k]!.pr[0]![1]).toBe(k);
      }
    }
    // After the ring has gone round, the same objects come back (nothing new is made for players and projectiles).
    expect(got[11]!.players[0]).toBe(got[7]!.players[0]);
    expect(got[11]!.players[0]!.p).toBe(got[7]!.players[0]!.p);
    expect(got[11]!.pr[0]).toBe(got[7]!.pr[0]);
    expect(got[11]!.players[0]).not.toBe(got[10]!.players[0]);
  });

  it('a snapshot not handed on (merged away) is overwritten by the next: no ring place is used', () => {
    const enc = new SnapshotBinaryEncoder();
    const dec = new SnapshotBinaryDecoder({ ring: 3 });
    const kept = dec.decode(enc.encode(moving(1))!)!;
    dec.commit();
    let last: SnapshotMessage | null = null;
    for (let i = 2; i < 40; i++) last = dec.decode(enc.encode(moving(i))!)!;
    expect(kept.players[0]!.p[0]).toBe(1);
    expect(last!.players[0]!.p[0]).toBe(39);
  });

  it('rows and lists that did not change are the same objects as last time; changed ones are new', () => {
    const enc = new SnapshotBinaryEncoder();
    const dec = new SnapshotBinaryDecoder({ ring: 4 });
    const a = dec.decode(enc.encode(moving(4))!)!;
    dec.commit();
    const b = dec.decode(enc.encode(moving(5))!)!;
    dec.commit();
    // The parked vehicle's row is kept; the moving one's is new, and the old snapshot still has its own.
    expect(b.mt![0]).toBe(a.mt![0]);
    expect(b.mt![1]).not.toBe(a.mt![1]);
    expect(a.mt![1]![1]).toBe(4);
    expect(b.mt![1]![1]).toBe(5);
    expect(b.score).toBe(a.score);
    expect(b.pk).toBe(a.pk);
    // Events are never shared.
    expect(b.ev).not.toBe(a.ev);
    const c = dec.decode(enc.encode(moving(8))!)!;
    expect(c.score).not.toBe(a.score);
    expect(a.score[0]!.k).toBe(1);
    expect(c.score[0]!.k).toBe(2);
    // A list that got shorter without changing.
    const d = dec.decode(enc.encode({ ...moving(8), mt: [[3, 1, 0, 2, 0, 0, 0, 100, 1, -1]] })!)!;
    expect(d.mt).toEqual([[3, 1, 0, 2, 0, 0, 0, 100, 1, -1]]);
    expect(dec.decode(enc.encode({ ...moving(8), mt: [] })!)!.mt).toEqual([]);
  });

  it('a snapshot with players held back (interest management) never reads into reused objects', () => {
    const enc = new SnapshotBinaryEncoder();
    const dec = new SnapshotBinaryDecoder({ ring: 2 });
    const a = dec.decode(enc.encode({ ...moving(1), hold: [5] })!)!;
    const b = dec.decode(enc.encode({ ...moving(2), hold: [5] })!)!;
    expect(a.players[0]!.p[0]).toBe(1);
    expect(b.players[0]!.p[0]).toBe(2);
    expect(a.hold).toEqual([5]);
  });
});
