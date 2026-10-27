import type { PlayerSnapshot, PrivateState, ServerMessage, Tuple3 } from '../protocol.ts';
import { SNAPSHOT_INTERVAL_TICKS } from '../sim/constants.ts';

/** The shared part of a snapshot (everything but the receiver's ack and private state). */
export type SnapshotBody = Omit<Extract<ServerMessage, { t: 'snapshot' }>, 't' | 'ack' | 'me'>;

export interface SnapshotViewer {
  slot: number;
  ack: number;
  me?: PrivateState;
  /**
   * The receiver's delta memory (one per connection, made when it joins). With it, other players
   * go as changes since the copy last sent to this receiver (see SnapshotStream); without, in full.
   */
  stream?: SnapshotStream;
}

/** Optional player fields: a delta entry names one that went away with null. */
const OPTIONAL_KEYS = ['vx', 'vz', 'fx', 'st', 'sn', 'em', 'sr', 'cl', 'ch', 'dr'] as const;
/** Fields a delta entry repeats only when they changed (position goes as `d`). */
const FIELD_KEYS = ['vy', 'g', 'yaw', 'pitch', 'hp', 'ar', 'alive', 'w', 'pu', ...OPTIONAL_KEYS] as const;

/** A player entry sent as a change: `d` is the move since the last copy in centimetres, the rest only what changed (null: gone). */
export type PlayerDelta = { s: number; d?: [number, number, number] } & { [K in (typeof FIELD_KEYS)[number]]?: PlayerSnapshot[K] | null };

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Another player's entry as it goes on the wire: position to the centimetre, speeds to 1 cm/s. */
function quantize(p: PlayerSnapshot): { q: PlayerSnapshot; cm: [number, number, number] } {
  const cm: [number, number, number] = [Math.round(p.p[0] * 100), Math.round(p.p[1] * 100), Math.round(p.p[2] * 100)];
  const q: PlayerSnapshot = { ...p, p: [cm[0] / 100, cm[1] / 100, cm[2] / 100], vy: r2(p.vy) };
  if (q.vx !== undefined) q.vx = r2(q.vx);
  if (q.vz !== undefined) q.vz = r2(q.vz);
  return { q, cm };
}

/**
 * Delta snapshots (protocol 4). The host's channel to each receiver is
 * reliable and ordered (a WebRTC data channel, a WebSocket), so every
 * snapshot can be written against the previous one sent on it: a player
 * already sent goes as `{ s, d: [dx, dy, dz] (cm), ...fields that changed }`
 * instead of in full (a third of the bytes, and less to compress and parse).
 * The receiver's own entry always goes in full and exact (prediction
 * reconciles against it). A player who left (in neither `players` nor
 * `hold`) is forgotten on both sides, so whoever takes the slot next goes in
 * full. One stream per connection: a reconnect starts a new one.
 */
export class SnapshotStream {
  /** Slot → the quantised entry last sent, and its position in cm. */
  readonly sent = new Map<number, { q: PlayerSnapshot; cm: [number, number, number] }>();
  /** REPEATABLE fields as last sent (their JSON). */
  readonly fields = new Map<string, string>();
}

/**
 * Snapshot fields that mostly stay the same from one snapshot to the next
 * (the scoreboard, vehicles standing about, taken pickups): a receiver with
 * a stream is sent them only when they changed, and the snapshot lists the
 * ones it repeats in `same` (the receiver fills them in from its last copy).
 */
export const REPEATABLE = ['score', 'mt', 'pk', 'cv', 'ld'] as const;

type WireSnapshot = Omit<Extract<ServerMessage, { t: 'snapshot' }>, 'players'> & { players: (PlayerSnapshot | PlayerDelta)[]; same?: string[] };

/** The receiver's side of a SnapshotStream: turns a snapshot as sent back into a full one. */
export class SnapshotDecoder {
  private readonly last = new Map<number, { p: PlayerSnapshot; cm: [number, number, number] }>();
  private readonly fields = new Map<string, unknown>();

  /** Rebuild a snapshot as sent, in place: players from their deltas, repeated fields (`same`) from the last copy. */
  snapshot(msg: Extract<ServerMessage, { t: 'snapshot' }>): Extract<ServerMessage, { t: 'snapshot' }> {
    const m = msg as unknown as WireSnapshot & Record<string, unknown>;
    msg.players = this.decode(m.players, msg.hold);
    if (m.same) {
      for (const k of m.same) if (this.fields.has(k)) m[k] = this.fields.get(k);
      delete m.same;
    }
    for (const k of REPEATABLE) {
      if (m[k] === undefined) this.fields.delete(k);
      else this.fields.set(k, m[k]);
    }
    return msg;
  }

  /** Rebuild `players` of a snapshot as sent (entries without `p` are deltas). Throws on a delta for a player it never had. */
  decode(players: (PlayerSnapshot | PlayerDelta)[], hold?: readonly number[]): PlayerSnapshot[] {
    const out = players.map((e): PlayerSnapshot => {
      if ('p' in e && e.p) {
        const full = e as PlayerSnapshot;
        this.last.set(full.s, { p: full, cm: [Math.round(full.p[0] * 100), Math.round(full.p[1] * 100), Math.round(full.p[2] * 100)] });
        return full;
      }
      const d = e as PlayerDelta;
      const prev = this.last.get(d.s);
      if (!prev) throw new Error(`snapshot delta for player ${d.s} without a base`);
      const cm: [number, number, number] = d.d ? [prev.cm[0] + d.d[0], prev.cm[1] + d.d[1], prev.cm[2] + d.d[2]] : prev.cm;
      const p: PlayerSnapshot = { ...prev.p, p: d.d ? ([cm[0] / 100, cm[1] / 100, cm[2] / 100] as Tuple3) : prev.p.p };
      const rec = p as unknown as Record<string, unknown>;
      for (const k of FIELD_KEYS) {
        const v = d[k];
        if (v === undefined) continue;
        if (v === null) delete rec[k];
        else rec[k] = v;
      }
      this.last.set(d.s, { p, cm });
      return p;
    });
    // Players in neither list have left: whoever takes the slot comes in full.
    const keep = new Set(hold);
    for (const p of out) keep.add(p.s);
    for (const s of this.last.keys()) if (!keep.has(s)) this.last.delete(s);
    return out;
  }
}

/**
 * One player's entry for a receiver with a stream: in full the first time, else what changed since the last copy.
 * `memo` keeps this snapshot's deltas by the copy they were written against: receivers last sent the same copy
 * (most of them, most of the time) share one string.
 */
function deltaJson(stream: SnapshotStream, cur: { q: PlayerSnapshot; cm: [number, number, number] }, fullJson: string, memo: Map<object, string>): string {
  const prev = stream.sent.get(cur.q.s);
  stream.sent.set(cur.q.s, cur);
  if (!prev) return fullJson;
  const known = memo.get(prev);
  if (known !== undefined) return known;
  const out = writeDelta(prev, cur);
  memo.set(prev, out);
  return out;
}

function writeDelta(prev: { q: PlayerSnapshot; cm: [number, number, number] }, cur: { q: PlayerSnapshot; cm: [number, number, number] }): string {
  const a = prev.q as unknown as Record<string, unknown>;
  const b = cur.q as unknown as Record<string, unknown>;
  let out = `{"s":${cur.q.s}`;
  const dx = cur.cm[0] - prev.cm[0];
  const dy = cur.cm[1] - prev.cm[1];
  const dz = cur.cm[2] - prev.cm[2];
  if (dx || dy || dz) out += `,"d":[${dx},${dy},${dz}]`;
  for (const k of FIELD_KEYS) {
    const v = b[k];
    if (v === a[k]) continue;
    out += `,"${k}":${v === undefined ? 'null' : JSON.stringify(v)}`;
  }
  return out + '}';
}

/**
 * Interest management for big matches. Up to INTEREST_MIN_PLAYERS players
 * everyone gets everyone in every snapshot (30 Hz). Past that, each receiver
 * gets players near them in every snapshot, players at middle distance in
 * every other one (15 Hz) and far ones in every fourth (7.5 Hz); the ones
 * left out are listed in `hold` and the client keeps drawing them from the
 * snapshots that had them. You always get yourself, and a receiver who is
 * dead (spectating, or waiting to respawn) gets everyone.
 */
export const INTEREST_MIN_PLAYERS = 32;
export const INTEREST_NEAR = 60;
export const INTEREST_MID = 150;

/** How often (in snapshots) a player `d` metres away is sent: 1, 2 or 4. */
export function interestEvery(d: number): number {
  return d < INTEREST_NEAR ? 1 : d < INTEREST_MID ? 2 : 4;
}

/**
 * Which players go in `viewer`'s copy of this snapshot: the indexes into
 * body.players to send, and the slots held back. Spreads each tier over the
 * snapshots by slot, so the far players don't all arrive together.
 */
export function interestFor(body: SnapshotBody, viewer: number): { send: number[]; hold: number[] } {
  const players = body.players;
  const all = players.map((_, i) => i);
  if (players.length <= INTEREST_MIN_PLAYERS) return { send: all, hold: [] };
  const me = players.find((p) => p.s === viewer);
  if (!me || !me.alive) return { send: all, hold: [] };
  const n = Math.floor(body.tick / SNAPSHOT_INTERVAL_TICKS);
  const send: number[] = [];
  const hold: number[] = [];
  players.forEach((p, i) => {
    const d = Math.hypot(p.p[0] - me.p[0], p.p[2] - me.p[2]);
    const every = p === me ? 1 : interestEvery(d);
    if ((n + p.s) % every === 0) send.push(i);
    else hold.push(p.s);
  });
  return { send, hold };
}

/**
 * Serialises one snapshot for many receivers cheaply: each player entry and
 * the rest of the body are turned to JSON once, then every receiver's copy
 * is put together from those pieces (its ack, private state and players).
 */
export function encodeSnapshots(body: SnapshotBody, viewers: readonly SnapshotViewer[]): string[] {
  const { players, ...rest } = body;
  const restJson = JSON.stringify(rest).slice(1);
  // Receivers with a stream: the repeatable fields apart, each sent only when it changed.
  let lean: { rest: string; fields: [string, string][] } | null = null;
  const leanRest = () => {
    if (lean) return lean;
    const r: Record<string, unknown> = { ...rest };
    const fields: [string, string][] = [];
    for (const k of REPEATABLE) {
      if (r[k] === undefined) continue;
      fields.push([k, JSON.stringify(r[k])]);
      delete r[k];
    }
    return (lean = { rest: JSON.stringify(r).slice(1), fields });
  };
  const playerJson = players.map((p: PlayerSnapshot) => JSON.stringify(p));
  const big = players.length > INTEREST_MIN_PLAYERS;
  const full = big ? null : `"players":[${playerJson.join(',')}],`;
  // Receivers with a stream: everyone else's entry quantised once, and its JSON once.
  let quant: { q: PlayerSnapshot; cm: [number, number, number] }[] | null = null;
  let quantJson: string[] | null = null;
  let here: Set<number> | null = null;
  let memos: Map<object, string>[] | null = null;
  return viewers.map((v) => {
    let list = full;
    const { send, hold } = big ? interestFor(body, v.slot) : { send: null, hold: [] as number[] };
    if (v.stream) {
      quant ??= players.map(quantize);
      quantJson ??= quant.map((x) => JSON.stringify(x.q));
      memos ??= players.map(() => new Map());
      const stream = v.stream;
      const entries: string[] = [];
      const one = (i: number) => {
        const p = players[i]!;
        entries.push(p.s === v.slot ? playerJson[i]! : deltaJson(stream, quant![i]!, quantJson![i]!, memos![i]!));
      };
      if (send) send.forEach(one);
      else for (let i = 0; i < players.length; i++) one(i);
      // Players gone from the match are forgotten (the receiver does the same).
      here ??= new Set(players.map((p) => p.s));
      for (const s of stream.sent.keys()) if (!here.has(s)) stream.sent.delete(s);
      list = `"players":[${entries.join(',')}],${hold.length ? `"hold":${JSON.stringify(hold)},` : ''}`;
      const l = leanRest();
      const same: string[] = [];
      let fields = '';
      for (const [k, json] of l.fields) {
        if (stream.fields.get(k) === json) same.push(k);
        else {
          stream.fields.set(k, json);
          fields += `"${k}":${json},`;
        }
      }
      // Fields this snapshot doesn't have at all are forgotten (the receiver does the same).
      if (stream.fields.size > l.fields.length) for (const k of stream.fields.keys()) if (!l.fields.some(([f]) => f === k)) stream.fields.delete(k);
      return `{"t":"snapshot","ack":${v.ack},${v.me ? `"me":${JSON.stringify(v.me)},` : ''}${list}${fields}${same.length ? `"same":${JSON.stringify(same)},` : ''}${l.rest}`;
    } else if (list === null) list = `"players":[${send!.map((i) => playerJson[i]).join(',')}],${hold.length ? `"hold":${JSON.stringify(hold)},` : ''}`;
    return `{"t":"snapshot","ack":${v.ack},${v.me ? `"me":${JSON.stringify(v.me)},` : ''}${list}${restJson}`;
  });
}
