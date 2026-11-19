import type { MatchPhase, PlayerSnapshot, ServerMessage } from '../protocol.ts';

/**
 * The binary snapshot message (docs/MULTIPLAYER_PROTOCOL.md, "Binary snapshots"): one snapshot in an
 * ArrayBuffer, for a channel that can hand a buffer over without copying it. Today that is the local match:
 * the sim worker encodes, transfers the buffer to the page, and the page decodes into objects it reuses
 * (docs/PERF_FLAVIUS_MEMORY_2026-11-16.md, "Snapshot format"). Networked play keeps its own format (delta JSON,
 * deflated: net/interest.ts, net/peerZip.ts), which is already several times smaller on the wire.
 *
 * Every message carries itself whole (no state between messages), starts with a magic number and a version,
 * and loses nothing: numbers travel as 64-bit floats or as integers the encoder has checked fit their field.
 * A snapshot the encoder can't carry exactly (a field the format doesn't know, a value out of a field's range)
 * isn't encoded at all: the sender falls back to the object message.
 */
export type SnapshotMessage = Extract<ServerMessage, { t: 'snapshot' }>;

/** The first four bytes, "TTSN" (little-endian u32). */
export const SNAPSHOT_BINARY_MAGIC = 0x4e535454;
/** The layout's version: a reader takes only the versions it knows (today, this one). */
export const SNAPSHOT_BINARY_VERSION = 1;
/** The most one message may be: a reader refuses anything longer before reading it, a writer doesn't make one. */
export const SNAPSHOT_BINARY_MAX_BYTES = 4 * 1024 * 1024;

const HEADER_BYTES = 32;
/** Header flag: the snapshot has `hold` (interest management): its players are read into objects of their own, never reused ones. */
const FLAG_HOLD = 1;
const PHASES: readonly MatchPhase[] = ['waiting', 'countdown', 'playing', 'intermission'];

// Every key of the snapshot message, by how it travels. A new key in the type must be put in one of these lists
// (the check below fails to compile until it is); at run time a key in none of them still travels, in `other`.
/** In the header. */
export const SNAPSHOT_HEADER_KEYS = ['t', 'ack', 'tick', 'phase', 'timeLeft'] as const;
/**
 * Lists of number rows, each row its length and then 64-bit floats: [key, fewest numbers a row has, most].
 * `pr` and `np` change every snapshot and are read into reused rows; the rest mostly stand still, and a row
 * that didn't change is the same array as last time.
 */
export const SNAPSHOT_ROW_KEYS = [
  ['pr', 5, 6],
  ['np', 11, 12],
  ['mt', 9, 255],
  ['ms', 5, 255],
  ['zn', 6, 6],
  ['cv', 6, 6],
  ['ab', 8, 255],
  ['fs', 10, 255],
] as const;
/**
 * As JSON text (UTF-8): [key, 'a' an array or 'o' an object, kept: a value whose text didn't change is the same
 * object as last time]. Events, private state, scenario and mode state are parsed afresh every time.
 */
export const SNAPSHOT_JSON_KEYS = [
  ['score', 'a', true],
  ['ev', 'a', false],
  ['pk', 'a', true],
  ['pw', 'a', true],
  ['dw', 'a', true],
  ['me', 'o', false],
  ['sc', 'o', false],
  ['md', 'o', false],
  ['hold', 'a', true],
  ['ld', 'a', true],
  ['rl', 'a', false],
] as const;
/** A player's fields, all of them (the record's layout is in the protocol document). */
export const SNAPSHOT_PLAYER_KEYS = ['s', 'p', 'vy', 'g', 'yaw', 'pitch', 'hp', 'ar', 'alive', 'w', 'pu', 'vx', 'vz', 'fx', 'st', 'sn', 'em', 'sr', 'cl', 'ch', 'dr', 'zl'] as const;

type RowKey = (typeof SNAPSHOT_ROW_KEYS)[number][0];
type JsonKey = (typeof SNAPSHOT_JSON_KEYS)[number][0];
type Covered = (typeof SNAPSHOT_HEADER_KEYS)[number] | 'players' | RowKey | JsonKey;
type Exhaustive<Missing> = [Missing] extends [never] ? true : { 'not in the binary snapshot format yet': Missing };
/** Fails to compile when the snapshot message, or a player's entry, has a field the lists above don't. */
export const SNAPSHOT_KEYS_COVERED: Exhaustive<Exclude<keyof SnapshotMessage, Covered>> = true;
export const SNAPSHOT_PLAYER_KEYS_COVERED: Exhaustive<Exclude<keyof PlayerSnapshot, (typeof SNAPSHOT_PLAYER_KEYS)[number]>> = true;

const ROW_ABSENT = 0xffff;
const JSON_OTHER = 255;
/** JSON key → its index (the id on the wire). */
const JSON_ID = new Map<string, number>(SNAPSHOT_JSON_KEYS.map(([k], i) => [k, i]));
const ROW_ID = new Map<string, number>(SNAPSHOT_ROW_KEYS.map(([k], i) => [k, i]));
const KNOWN = new Set<string>([...SNAPSHOT_HEADER_KEYS, 'players', ...ROW_ID.keys(), ...JSON_ID.keys()]);
/** Rows read into reused arrays (they change every snapshot); the others keep the arrays that didn't change. */
const POOLED_ROWS = new Set<string>(['pr', 'np']);

// A player's record: slot u8, bits u8, mask u16, x y z vy yaw pitch (f64), hp ar (i16), weapon u16, powerups u8,
// a zero byte; then the optional fields the mask names, in this order.
const PLAYER_FIXED_BYTES = 60;
const BIT_GROUNDED = 1;
const BIT_ALIVE = 2;
const BIT_EMOTE = 4;
const BIT_SPRINT = 8;
const BIT_DROP = 16;
const BITS_KNOWN = 31;
const HAS_VX = 1;
const HAS_VZ = 2;
const HAS_FX = 4;
const HAS_ST = 8;
const HAS_SN = 16;
const HAS_CL = 32;
const HAS_CH = 64;
const HAS_ZL = 128;
const MASK_KNOWN = 255;

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v: unknown): v is number => typeof v === 'number';

class Unfit extends Error {}

/**
 * Writes snapshots into ArrayBuffers. `encode` returns the buffer (often longer than the message: the header says
 * how long that is), to be handed over whole; `recycle` takes one back once the reader is done with it.
 */
export class SnapshotBinaryEncoder {
  /** Why encoding stopped (a snapshot this format can't carry exactly): `encode` answers null from then on. */
  failed: string | null = null;
  private readonly pool: ArrayBuffer[] = [];
  private capacity = 16 * 1024;
  private buf!: ArrayBuffer;
  private dv!: DataView;
  private u8!: Uint8Array;
  private at = 0;
  private readonly text = new TextEncoder();
  private readonly strings = new Map<string, number>();

  /** A buffer the reader has finished with (it must hold no view of it): written again by a later `encode`. */
  recycle(buf: ArrayBuffer): void {
    if (buf.byteLength >= this.capacity && buf.byteLength <= SNAPSHOT_BINARY_MAX_BYTES && this.pool.length < 8) this.pool.push(buf);
  }

  encode(msg: SnapshotMessage): ArrayBuffer | null {
    if (this.failed !== null) return null;
    this.use(this.pool.pop() ?? new ArrayBuffer(this.capacity));
    try {
      this.write(msg);
      return this.buf;
    } catch (e) {
      this.failed = e instanceof Error ? e.message : String(e);
      return null;
    }
  }

  private use(buf: ArrayBuffer): void {
    this.buf = buf;
    this.dv = new DataView(buf);
    this.u8 = new Uint8Array(buf);
    this.at = 0;
  }

  /** Room for `n` more bytes (a longer buffer, with what is written so far, when there isn't). */
  private need(n: number): void {
    const want = this.at + n;
    if (want <= this.buf.byteLength) return;
    if (want > SNAPSHOT_BINARY_MAX_BYTES) throw new Unfit('the snapshot is longer than a binary message may be');
    let size = this.buf.byteLength * 2;
    while (size < want) size *= 2;
    size = Math.min(size, SNAPSHOT_BINARY_MAX_BYTES);
    const old = this.u8;
    const at = this.at;
    this.use(new ArrayBuffer(size));
    this.u8.set(old.subarray(0, at));
    this.at = at;
    // New buffers come this size from now on (smaller ones handed back are let go).
    this.capacity = size;
    this.pool.length = 0;
  }

  private write(msg: SnapshotMessage): void {
    if (msg.t !== 'snapshot' || !isInt(msg.tick, 0, 0xffffffff) || !isInt(msg.ack, 0, 0xffffffff) || !isNum(msg.timeLeft)) throw new Unfit('header values out of range');
    const phase = PHASES.indexOf(msg.phase);
    if (phase < 0) throw new Unfit(`unknown phase ${String(msg.phase)}`);
    if (!Array.isArray(msg.players) || !Array.isArray(msg.pr) || !Array.isArray(msg.np) || !Array.isArray(msg.score) || !Array.isArray(msg.ev) || !Array.isArray(msg.pk)) throw new Unfit('a required list is missing');
    const dv = this.dv;
    dv.setUint32(0, SNAPSHOT_BINARY_MAGIC, true);
    dv.setUint16(4, SNAPSHOT_BINARY_VERSION, true);
    dv.setUint16(6, msg.hold !== undefined ? FLAG_HOLD : 0, true);
    dv.setUint32(12, msg.tick, true);
    dv.setUint32(16, msg.ack, true);
    dv.setFloat64(20, msg.timeLeft, true);
    dv.setUint32(28, phase, true);
    this.at = HEADER_BYTES;
    this.writePlayers(msg.players);
    const rec = msg as unknown as Record<string, unknown>;
    for (const [key, min, max] of SNAPSHOT_ROW_KEYS) this.writeRows(key, rec[key], min, max);
    // The JSON fields in their fixed order, then anything this version has no place for, as one object.
    let other: Record<string, unknown> | null = null;
    for (const k in rec) if (!KNOWN.has(k) && rec[k] !== undefined) (other ??= {})[k] = rec[k];
    this.need(1);
    const countAt = this.at++;
    let count = 0;
    for (let id = 0; id < SNAPSHOT_JSON_KEYS.length; id++) {
      const v = rec[SNAPSHOT_JSON_KEYS[id]![0]];
      if (v === undefined) continue;
      this.writeJson(id, v);
      count++;
    }
    if (other) {
      this.writeJson(JSON_OTHER, other);
      count++;
    }
    this.u8[countAt] = count;
    this.dv.setUint32(8, this.at, true);
  }

  private writePlayers(players: readonly PlayerSnapshot[]): void {
    if (players.length > 0xffff) throw new Unfit('too many players');
    // The bot states' strings, each once, ahead of the players that name them.
    const strings = this.strings;
    strings.clear();
    for (const p of players) if (p.st !== undefined && !strings.has(p.st)) strings.set(p.st, strings.size);
    if (strings.size > 0xffff) throw new Unfit('too many strings');
    this.need(2);
    this.dv.setUint16(this.at, strings.size, true);
    this.at += 2;
    for (const s of strings.keys()) {
      if (typeof s !== 'string') throw new Unfit('a bot state is not a string');
      this.need(1 + s.length * 3);
      const n = this.text.encodeInto(s, this.u8.subarray(this.at + 1)).written;
      if (n > 255) throw new Unfit('a bot state is too long');
      this.u8[this.at] = n;
      this.at += 1 + n;
    }
    this.need(2 + players.length * (PLAYER_FIXED_BYTES + 52));
    const dv = this.dv;
    let at = this.at;
    dv.setUint16(at, players.length, true);
    at += 2;
    for (const p of players) {
      // Every field the entry has must be one written below: `fields` counts them.
      let fields = 11;
      const pos = p.p;
      if (!isInt(p.s, 0, 255) || !Array.isArray(pos) || pos.length !== 3 || !isNum(pos[0]) || !isNum(pos[1]) || !isNum(pos[2]) || !isNum(p.vy) || !isNum(p.yaw) || !isNum(p.pitch)) throw new Unfit('a player entry is out of range');
      if ((p.g !== 0 && p.g !== 1) || (p.alive !== 0 && p.alive !== 1) || !isInt(p.hp, -32768, 32767) || !isInt(p.ar, -32768, 32767) || !isInt(p.w, 0, 0xffff) || !isInt(p.pu, 0, 255)) throw new Unfit('a player entry is out of range');
      let bits = (p.g ? BIT_GROUNDED : 0) | (p.alive ? BIT_ALIVE : 0);
      if (p.em !== undefined) {
        if (p.em !== 1) throw new Unfit('em out of range');
        bits |= BIT_EMOTE;
        fields++;
      }
      if (p.sr !== undefined) {
        if (p.sr !== 1) throw new Unfit('sr out of range');
        bits |= BIT_SPRINT;
        fields++;
      }
      if (p.dr !== undefined) {
        if (p.dr !== 1) throw new Unfit('dr out of range');
        bits |= BIT_DROP;
        fields++;
      }
      const maskAt = at + 2;
      dv.setUint8(at, p.s);
      dv.setUint8(at + 1, bits);
      dv.setFloat64(at + 4, pos[0], true);
      dv.setFloat64(at + 12, pos[1], true);
      dv.setFloat64(at + 20, pos[2], true);
      dv.setFloat64(at + 28, p.vy, true);
      dv.setFloat64(at + 36, p.yaw, true);
      dv.setFloat64(at + 44, p.pitch, true);
      dv.setInt16(at + 52, p.hp, true);
      dv.setInt16(at + 54, p.ar, true);
      dv.setUint16(at + 56, p.w, true);
      dv.setUint8(at + 58, p.pu);
      dv.setUint8(at + 59, 0);
      at += PLAYER_FIXED_BYTES;
      let mask = 0;
      if (p.vx !== undefined) {
        if (!isNum(p.vx)) throw new Unfit('vx out of range');
        mask |= HAS_VX;
        dv.setFloat64(at, p.vx, true);
        at += 8;
      }
      if (p.vz !== undefined) {
        if (!isNum(p.vz)) throw new Unfit('vz out of range');
        mask |= HAS_VZ;
        dv.setFloat64(at, p.vz, true);
        at += 8;
      }
      if (p.fx !== undefined) {
        if (!isInt(p.fx, 0, 0xffffffff)) throw new Unfit('fx out of range');
        mask |= HAS_FX;
        dv.setUint32(at, p.fx, true);
        at += 4;
      }
      if (p.st !== undefined) {
        mask |= HAS_ST;
        dv.setUint16(at, strings.get(p.st)!, true);
        at += 2;
      }
      if (p.sn !== undefined) {
        if (p.sn !== 1 && p.sn !== 2) throw new Unfit('sn out of range');
        mask |= HAS_SN;
        dv.setUint8(at++, p.sn);
      }
      if (p.cl !== undefined) {
        if (!isInt(p.cl, 0, 255)) throw new Unfit('cl out of range');
        mask |= HAS_CL;
        dv.setUint8(at++, p.cl);
      }
      if (p.ch !== undefined) {
        if (p.ch !== 1 && p.ch !== 2) throw new Unfit('ch out of range');
        mask |= HAS_CH;
        dv.setUint8(at++, p.ch);
      }
      if (p.zl !== undefined) {
        const zl = p.zl;
        if (!Array.isArray(zl) || zl.length !== 3 || !isNum(zl[0]) || !isNum(zl[1]) || !isNum(zl[2])) throw new Unfit('zl out of range');
        mask |= HAS_ZL;
        dv.setFloat64(at, zl[0], true);
        dv.setFloat64(at + 8, zl[1], true);
        dv.setFloat64(at + 16, zl[2], true);
        at += 24;
      }
      dv.setUint16(maskAt, mask, true);
      for (let m = mask; m; m &= m - 1) fields++;
      let have = 0;
      for (const k in p) if ((p as unknown as Record<string, unknown>)[k] !== undefined) have++;
      if (have !== fields) throw new Unfit('a player entry has a field the binary format does not know');
    }
    this.at = at;
  }

  private writeRows(key: string, rows: unknown, min: number, max: number): void {
    this.need(2);
    if (rows === undefined) {
      this.dv.setUint16(this.at, ROW_ABSENT, true);
      this.at += 2;
      return;
    }
    if (!Array.isArray(rows) || rows.length >= ROW_ABSENT) throw new Unfit(`${key} is not a list of rows`);
    this.dv.setUint16(this.at, rows.length, true);
    this.at += 2;
    for (const row of rows as unknown[]) {
      if (!Array.isArray(row) || row.length < min || row.length > max) throw new Unfit(`a row of ${key} has a length the binary format does not know`);
      const n = row.length;
      this.need(1 + n * 8);
      const dv = this.dv;
      let at = this.at;
      dv.setUint8(at++, n);
      for (let i = 0; i < n; i++) {
        const v: unknown = row[i];
        if (typeof v !== 'number') throw new Unfit(`a row of ${key} holds something that is not a number`);
        dv.setFloat64(at, v, true);
        at += 8;
      }
      this.at = at;
    }
  }

  private writeJson(id: number, value: unknown): void {
    const json = JSON.stringify(value);
    this.need(5 + json.length * 3);
    const n = this.text.encodeInto(json, this.u8.subarray(this.at + 5)).written;
    this.u8[this.at] = id;
    this.dv.setUint32(this.at + 1, n, true);
    this.at += 5 + n;
  }
}

/** The version of a binary snapshot message (whatever this reader makes of it), or null when it isn't one. */
export function snapshotBinaryVersion(data: ArrayBuffer | Uint8Array): number | null {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (u8.length < 6 || u8[0] !== 0x54 || u8[1] !== 0x54 || u8[2] !== 0x53 || u8[3] !== 0x4e) return null;
  return u8[4]! | (u8[5]! << 8);
}

/** The objects one decoded snapshot's players and fast-changing rows live in (reused when the decoder has a ring). */
interface Shell {
  players: PlayerSnapshot[];
  made: PlayerSnapshot[];
  rows: Map<string, { out: number[][]; made: number[][] }>;
}

const newShell = (): Shell => ({ players: [], made: [], rows: new Map() });

/**
 * A player entry with every field in place (absent ones undefined): entries are refilled in place, and one
 * shape for all of them keeps the readers' property reads fast.
 */
const blankPlayer = (): PlayerSnapshot => ({ s: 0, p: [0.5, 0.5, 0.5], vy: 0.5, g: 0, yaw: 0.5, pitch: 0.5, hp: 0, ar: 0, alive: 0, w: 0, pu: 0, vx: undefined, vz: undefined, fx: undefined, st: undefined, sn: undefined, em: undefined, sr: undefined, cl: undefined, ch: undefined, dr: undefined, zl: undefined }) as unknown as PlayerSnapshot;

export interface SnapshotBinaryDecoderOptions {
  /**
   * Reuse the players' objects and the projectile and NPC rows: a ring of this many snapshots' worth. A decoded
   * snapshot's players and rows are valid until `ring` more snapshots have been handed on (`commit`), so it must be
   * more than the longest anything keeps them (the client's interpolation buffer: two seconds of snapshots).
   * 0 (the default): every snapshot gets objects of its own.
   */
  ring?: number;
}

/**
 * Reads binary snapshots back into snapshot messages. Nothing a buffer says is trusted: every length and count is
 * checked against the bytes that are there before anything is read or made, and anything wrong (truncated, a
 * version this reader doesn't know, a count past the end, bad JSON) gives null, with `error` saying why.
 * `decode` never throws.
 */
export class SnapshotBinaryDecoder {
  /** Why the last `decode` gave null. */
  error: string | null = null;
  private readonly ring: Shell[] = [];
  private readonly ringSize: number;
  private slot = 0;
  private dirty = false;
  private dv!: DataView;
  private u8!: Uint8Array;
  private at = 0;
  private end = 0;
  private readonly text = new TextDecoder('utf-8', { fatal: true });
  private readonly strings: string[] = [];
  private readonly interned = new Map<number, { bytes: Uint8Array; s: string }[]>();
  private internedCount = 0;
  /** Rows that mostly stand still, as last read: an unchanged row (or list) is handed out again. */
  private readonly keptRows = new Map<string, number[][]>();
  /** Kept JSON fields: the text's bytes last read and its value. */
  private readonly keptJson = new Map<number, { bytes: Uint8Array; value: unknown }>();
  private readonly scratch = new Float64Array(255);

  constructor(opts: SnapshotBinaryDecoderOptions = {}) {
    this.ringSize = Math.max(0, Math.floor(opts.ring ?? 0));
  }

  /**
   * The snapshot last decoded was handed on to something that may keep it: the next `decode` fills the next
   * objects of the ring. Without it the next one overwrites the same objects (a snapshot merged into a newer
   * one before anyone saw it costs nothing).
   */
  commit(): void {
    if (!this.dirty) return;
    this.dirty = false;
    if (this.ringSize) this.slot = (this.slot + 1) % this.ringSize;
  }

  decode(data: ArrayBuffer | Uint8Array): SnapshotMessage | null {
    try {
      this.error = null;
      return this.read(data);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return null;
    }
  }

  private bad(why: string): never {
    throw new Unfit(why);
  }

  private take(n: number): number {
    const at = this.at;
    if (n < 0 || at + n > this.end) this.bad('truncated');
    this.at = at + n;
    return at;
  }

  private read(data: ArrayBuffer | Uint8Array): SnapshotMessage {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.byteLength < HEADER_BYTES) this.bad('truncated header');
    if (dv.getUint32(0, true) !== SNAPSHOT_BINARY_MAGIC) this.bad('not a binary snapshot');
    const version = dv.getUint16(4, true);
    if (version !== SNAPSHOT_BINARY_VERSION) this.bad(`binary snapshot version ${version} (this reads ${SNAPSHOT_BINARY_VERSION})`);
    const flags = dv.getUint16(6, true);
    const length = dv.getUint32(8, true);
    if (length < HEADER_BYTES || length > u8.byteLength || length > SNAPSHOT_BINARY_MAX_BYTES) this.bad('bad length');
    const phase = PHASES[dv.getUint32(28, true)];
    if (phase === undefined) this.bad('bad phase');
    this.dv = dv;
    this.u8 = u8;
    this.at = HEADER_BYTES;
    this.end = length;
    // Reused objects only for a snapshot that carries everyone (see FLAG_HOLD).
    const pooled = this.ringSize > 0 && !(flags & FLAG_HOLD);
    const shell = pooled ? (this.ring[this.slot] ??= newShell()) : newShell();
    const players = this.readPlayers(shell);
    const msg: SnapshotMessage = { t: 'snapshot', ack: dv.getUint32(16, true), tick: dv.getUint32(12, true), phase, timeLeft: dv.getFloat64(20, true), players, score: [], ev: [], pr: [], pk: [], np: [] };
    const rec = msg as unknown as Record<string, unknown>;
    for (const [key, min, max] of SNAPSHOT_ROW_KEYS) {
      const rows = this.readRows(key, min, max, shell);
      if (rows) rec[key] = rows;
      else if (key === 'pr' || key === 'np') this.bad(`${key} is missing`);
    }
    const count = this.u8[this.take(1)]!;
    let seen = 0;
    let last = -1;
    for (let i = 0; i < count; i++) {
      const head = this.take(5);
      const id = this.u8[head]!;
      const n = dv.getUint32(head + 1, true);
      const from = this.take(n);
      if (id === JSON_OTHER) {
        if (i !== count - 1) this.bad('fields out of order');
        const other = this.parse(from, n) as Record<string, unknown> | null;
        if (typeof other !== 'object' || other === null || Array.isArray(other)) this.bad('bad extra fields');
        for (const k of Object.keys(other)) if (!KNOWN.has(k) && k !== '__proto__') rec[k] = other[k];
        continue;
      }
      const spec = SNAPSHOT_JSON_KEYS[id];
      if (!spec || id <= last) this.bad('fields out of order');
      last = id;
      const value = spec[2] ? this.kept(id, from, n) : this.parse(from, n);
      if (typeof value !== 'object' || value === null || Array.isArray(value) !== (spec[1] === 'a')) this.bad(`bad ${spec[0]}`);
      rec[spec[0]] = value;
      if (id < 3) seen |= 1 << id;
    }
    // score, ev and pk (ids 0 to 2) are in every snapshot.
    if (seen !== 7) this.bad('a required list is missing');
    if (this.at !== length) this.bad('bytes left over');
    if (((flags & FLAG_HOLD) !== 0) !== (msg.hold !== undefined)) this.bad('bad flags');
    if (pooled) this.dirty = true;
    return msg;
  }

  private readPlayers(shell: Shell): PlayerSnapshot[] {
    const dv = this.dv;
    const u8 = this.u8;
    const nStrings = dv.getUint16(this.take(2), true);
    if (nStrings > this.end - this.at) this.bad('truncated');
    const strings = this.strings;
    for (let i = 0; i < nStrings; i++) {
      const n = u8[this.take(1)]!;
      strings[i] = this.intern(this.take(n), n);
    }
    strings.length = nStrings;
    const count = dv.getUint16(this.take(2), true);
    if (count * PLAYER_FIXED_BYTES > this.end - this.at) this.bad('truncated');
    const out = shell.players;
    const made = shell.made;
    out.length = count;
    for (let i = 0; i < count; i++) {
      let at = this.take(PLAYER_FIXED_BYTES);
      const p = (made[i] ??= blankPlayer());
      const bits = u8[at + 1]!;
      const mask = dv.getUint16(at + 2, true);
      if (bits & ~BITS_KNOWN || mask & ~MASK_KNOWN) this.bad('unknown player fields');
      p.s = u8[at]!;
      p.g = bits & BIT_GROUNDED ? 1 : 0;
      p.alive = bits & BIT_ALIVE ? 1 : 0;
      p.em = bits & BIT_EMOTE ? 1 : undefined;
      p.sr = bits & BIT_SPRINT ? 1 : undefined;
      p.dr = bits & BIT_DROP ? 1 : undefined;
      const pos = p.p;
      pos[0] = dv.getFloat64(at + 4, true);
      pos[1] = dv.getFloat64(at + 12, true);
      pos[2] = dv.getFloat64(at + 20, true);
      p.vy = dv.getFloat64(at + 28, true);
      p.yaw = dv.getFloat64(at + 36, true);
      p.pitch = dv.getFloat64(at + 44, true);
      p.hp = dv.getInt16(at + 52, true);
      p.ar = dv.getInt16(at + 54, true);
      p.w = dv.getUint16(at + 56, true);
      p.pu = u8[at + 58]!;
      if (mask & HAS_VX) p.vx = dv.getFloat64(this.take(8), true);
      else p.vx = undefined;
      if (mask & HAS_VZ) p.vz = dv.getFloat64(this.take(8), true);
      else p.vz = undefined;
      if (mask & HAS_FX) p.fx = dv.getUint32(this.take(4), true);
      else p.fx = undefined;
      if (mask & HAS_ST) {
        const st = strings[dv.getUint16(this.take(2), true)];
        if (st === undefined) this.bad('bad string index');
        p.st = st;
      } else p.st = undefined;
      if (mask & HAS_SN) {
        const sn = u8[this.take(1)]!;
        if (sn !== 1 && sn !== 2) this.bad('bad stance');
        p.sn = sn;
      } else p.sn = undefined;
      if (mask & HAS_CL) p.cl = u8[this.take(1)]!;
      else p.cl = undefined;
      if (mask & HAS_CH) {
        const ch = u8[this.take(1)]!;
        if (ch !== 1 && ch !== 2) this.bad('bad canopy');
        p.ch = ch;
      } else p.ch = undefined;
      if (mask & HAS_ZL) {
        at = this.take(24);
        // (Its own array: a zipline ride is rare, and readers may keep it.)
        p.zl = [dv.getFloat64(at, true), dv.getFloat64(at + 8, true), dv.getFloat64(at + 16, true)];
      } else p.zl = undefined;
      out[i] = p;
    }
    return out;
  }

  private readRows(key: string, min: number, max: number, shell: Shell): number[][] | null {
    const dv = this.dv;
    const count = dv.getUint16(this.take(2), true);
    if (count === ROW_ABSENT) return null;
    if (count * (1 + min * 8) > this.end - this.at) this.bad('truncated');
    if (POOLED_ROWS.has(key)) {
      let pool = shell.rows.get(key);
      if (!pool) shell.rows.set(key, (pool = { out: [], made: [] }));
      const out = pool.out;
      out.length = count;
      for (let i = 0; i < count; i++) {
        const n = this.u8[this.take(1)]!;
        if (n < min || n > max) this.bad(`bad ${key} row`);
        let at = this.take(n * 8);
        const row = (pool.made[i] ??= []);
        if (row.length !== n) row.length = n;
        for (let j = 0; j < n; j++, at += 8) row[j] = dv.getFloat64(at, true);
        out[i] = row;
      }
      return out;
    }
    const prev = this.keptRows.get(key);
    const scratch = this.scratch;
    let out: number[][] | null = prev && prev.length === count ? prev : null;
    let fresh: number[][] | null = null;
    for (let i = 0; i < count; i++) {
      const n = this.u8[this.take(1)]!;
      if (n < min || n > max) this.bad(`bad ${key} row`);
      let at = this.take(n * 8);
      const old = prev?.[i];
      let same = old !== undefined && old.length === n;
      for (let j = 0; j < n; j++, at += 8) {
        const v = dv.getFloat64(at, true);
        scratch[j] = v;
        // (Exactly the same: a -0 is not a 0.)
        if (same && !Object.is(old![j], v)) same = false;
      }
      if (same && !fresh) continue;
      // The first row that changed: a new list from here on (the rows before it are the old ones).
      if (!fresh) {
        fresh = prev ? prev.slice(0, i) : [];
        out = null;
      }
      if (same) fresh.push(old!);
      else {
        const row = new Array<number>(n);
        for (let j = 0; j < n; j++) row[j] = scratch[j]!;
        fresh.push(row);
      }
    }
    // (Fewer rows than last time and none changed: the old ones, cut short.)
    const rows = fresh ?? out ?? (prev ? prev.slice(0, count) : []);
    this.keptRows.set(key, rows);
    return rows;
  }

  /** A short string of the table (a bot state), the same string object for the same bytes. */
  private intern(from: number, n: number): string {
    const u8 = this.u8;
    let h = 2166136261;
    for (let i = 0; i < n; i++) h = Math.imul(h ^ u8[from + i]!, 16777619);
    const list = this.interned.get(h);
    if (list) {
      for (const e of list) {
        if (e.bytes.length !== n) continue;
        let i = 0;
        while (i < n && e.bytes[i] === u8[from + i]) i++;
        if (i === n) return e.s;
      }
    }
    const s = this.text.decode(u8.subarray(from, from + n));
    // (A bounded cache: past it, strings are simply decoded each time.)
    if (this.internedCount < 1024) {
      this.internedCount++;
      const e = { bytes: u8.slice(from, from + n), s };
      if (list) list.push(e);
      else this.interned.set(h, [e]);
    }
    return s;
  }

  private parse(from: number, n: number): unknown {
    const u8 = this.u8;
    // The usual case for events and scenario changes: nothing.
    if (n === 2 && u8[from] === 0x5b && u8[from + 1] === 0x5d) return [];
    if (n === 2 && u8[from] === 0x7b && u8[from + 1] === 0x7d) return {};
    return JSON.parse(this.text.decode(u8.subarray(from, from + n))) as unknown;
  }

  /** A kept JSON field: the value read last time when its text is the same, byte for byte. */
  private kept(id: number, from: number, n: number): unknown {
    const u8 = this.u8;
    const had = this.keptJson.get(id);
    if (had && had.bytes.length === n) {
      const b = had.bytes;
      let i = 0;
      while (i < n && b[i] === u8[from + i]) i++;
      if (i === n) return had.value;
    }
    const value = this.parse(from, n);
    this.keptJson.set(id, { bytes: u8.slice(from, from + n), value });
    return value;
  }
}
