import { Deflate, Inflate, constants as zlib } from 'pako';

/** Data channels cap message size (~256 KB in Chrome): long texts (the map in the welcome) go in pieces. */
export const CHUNK = 60_000;

/**
 * Host → friend traffic is compressed as one stream for the whole connection
 * (like the dedicated server's WebSocket compression): each message is
 * deflated and flushed, so it can be read on arrival, while repeating
 * snapshot fields compress against the earlier messages. Messages travel as
 * binary pieces of at most CHUNK bytes, the first byte saying whether more
 * of the same message follow (0) or it's the last (1).
 */
type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const ZIP_LEVEL: ZipLevel = 6;

export class Zipper {
  private readonly deflate: Deflate;
  private out: Uint8Array[] = [];
  private readonly enc = new TextEncoder();

  constructor(level: ZipLevel = ZIP_LEVEL) {
    this.deflate = new Deflate({ raw: true, level });
    this.deflate.onData = (c) => this.out.push(c as Uint8Array);
  }

  pieces(text: string, chunk = CHUNK): Uint8Array[] {
    this.out = [];
    this.deflate.push(this.enc.encode(text), zlib.Z_SYNC_FLUSH);
    const body = concat(this.out);
    const list: Uint8Array[] = [];
    for (let at = 0; at < body.length || !list.length; at += chunk) {
      const part = body.subarray(at, at + chunk);
      const piece = new Uint8Array(part.length + 1);
      piece[0] = at + chunk >= body.length ? 1 : 0;
      piece.set(part, 1);
      list.push(piece);
    }
    return list;
  }
}

/**
 * A whole message sent as plain UTF-8 on a compressed link (first byte PLAIN_PIECE): what the
 * host's page says itself (`travel` as the match stops) while the match host owns the deflate
 * stream. It may only come between compressed messages, never inside one.
 */
export const PLAIN_PIECE = 2;
export function plainPiece(text: string): Uint8Array {
  const body = new TextEncoder().encode(text);
  const piece = new Uint8Array(body.length + 1);
  piece[0] = PLAIN_PIECE;
  piece.set(body, 1);
  return piece;
}

/**
 * The most one message may inflate to: the welcome carries the whole map
 * (at most MAP_MAX_BYTES, 2 MiB) plus rules and scenario state. A stream
 * that inflates past it (a "zip bomb", or a broken host) is refused before
 * it can fill the tab's memory.
 */
export const MAX_INFLATED_MESSAGE = 4 * 1024 * 1024;

export class Unzipper {
  private readonly inflate = new Inflate({ raw: true });
  private got: Uint8Array[] = [];
  private size = 0;
  private broken: string | null = null;
  private readonly dec = new TextDecoder();

  constructor(private readonly maxOutput = MAX_INFLATED_MESSAGE) {
    // Throwing here stops pako in the middle of a push, so a bomb never inflates past the cap.
    this.inflate.onData = (c) => this.take((c as Uint8Array).slice());
  }

  private take(c: Uint8Array): void {
    this.size += c.length;
    if (this.size > this.maxOutput) throw new Error(`message inflates past ${this.maxOutput} bytes`);
    this.got.push(c);
  }

  /** A piece in; the whole message out once its last piece has arrived. Throws on bad or oversized data (the stream is then unusable). */
  piece(data: Uint8Array): string | null {
    if (this.broken) throw new Error(this.broken);
    if (data[0] === PLAIN_PIECE) {
      if (this.got.length) throw new Error((this.broken = 'plain message inside a compressed one'));
      if (data.length - 1 > this.maxOutput) throw new Error((this.broken = `message over ${this.maxOutput} bytes`));
      return this.dec.decode(data.subarray(1));
    }
    try {
      this.inflate.push(data.subarray(1), zlib.Z_SYNC_FLUSH);
      // pako hands output over only when its buffer fills: take what a flushed message left in it.
      const st = (this.inflate as unknown as { strm: { output: Uint8Array; next_out: number; avail_out: number } }).strm;
      if (st.next_out) {
        const rest = st.output.slice(0, st.next_out);
        st.next_out = 0;
        st.avail_out = st.output.length;
        this.take(rest);
      }
      if (this.inflate.err) throw new Error(`bad compressed data (${this.inflate.msg})`);
    } catch (e) {
      this.broken = (e as Error).message;
      this.got = [];
      throw e;
    }
    if (data[0] !== 1) return null;
    const text = this.dec.decode(concat(this.got));
    this.got = [];
    this.size = 0;
    return text;
  }
}

/** Limits on putting chunked text messages back together (see Reassembler). */
export interface ReassemblyLimits {
  /** Most pieces one message may claim to have. */
  maxChunks: number;
  /** Most characters one message may add up to. */
  maxBytes: number;
  /** Most messages half-received at once. */
  maxPartials: number;
  /** A half-received message older than this is dropped. */
  timeoutMs: number;
}

/**
 * What a host accepts from a friend: game messages are small (inputs ≤ 32 a
 * message, like the dedicated server's 64 KiB WebSocket frames), so a guest
 * can never make the host hold more than 4 × 64 KiB of partial messages.
 */
export const GUEST_TO_HOST_LIMITS: ReassemblyLimits = { maxChunks: 4, maxBytes: 64 * 1024, maxPartials: 4, timeoutMs: 10_000 };
/** What a friend accepts from the host (the welcome carries the map; uncompressed links only). */
export const HOST_TO_GUEST_LIMITS: ReassemblyLimits = { maxChunks: Math.ceil(MAX_INFLATED_MESSAGE / CHUNK), maxBytes: MAX_INFLATED_MESSAGE, maxPartials: 4, timeoutMs: 60_000 };

/**
 * Puts chunked text messages ("\u0001id|i|n|body") back together, trusting
 * nothing the sender says: the piece count, the total size and the number of
 * half-finished messages are capped, and stale halves expire. Throws when the
 * sender breaks a limit (the caller closes the link).
 */
export class Reassembler {
  private readonly parts = new Map<string, { list: (string | undefined)[]; got: number; size: number; at: number }>();

  constructor(
    private readonly limits: ReassemblyLimits,
    private readonly now: () => number = Date.now,
  ) {}

  /** A whole message, or null while pieces are missing. */
  add(text: string): string | null {
    if (!text.startsWith('\u0001')) {
      if (text.length > this.limits.maxBytes) throw new Error(`message of ${text.length} characters is over ${this.limits.maxBytes}`);
      return text;
    }
    const m = /^\u0001(\d{1,10})\|(\d{1,6})\|(\d{1,6})\|/.exec(text);
    if (!m) throw new Error('malformed message piece');
    const [head, id, si, sn] = m as unknown as [string, string, string, string];
    const i = Number(si);
    const n = Number(sn);
    if (n < 1 || n > this.limits.maxChunks || i >= n) throw new Error(`message piece ${i}/${n} out of range`);
    const body = text.slice(head.length);
    const t = this.now();
    for (const [k, p] of this.parts) if (t - p.at > this.limits.timeoutMs) this.parts.delete(k);
    let p = this.parts.get(id);
    if (!p) {
      if (this.parts.size >= this.limits.maxPartials) throw new Error('too many half-sent messages');
      p = { list: new Array<string | undefined>(n), got: 0, size: 0, at: t };
      this.parts.set(id, p);
    }
    if (p.list.length !== n) throw new Error('message pieces disagree on their count');
    if (p.list[i] !== undefined) throw new Error('message piece sent twice');
    p.size += body.length;
    if (p.size > this.limits.maxBytes) throw new Error(`message over ${this.limits.maxBytes} characters`);
    p.list[i] = body;
    p.got++;
    if (p.got < n) return null;
    this.parts.delete(id);
    return p.list.join('');
  }

  /** Messages half-received right now. */
  get pending(): number {
    return this.parts.size;
  }
}

function concat(list: Uint8Array[]): Uint8Array {
  if (list.length === 1) return list[0]!;
  const out = new Uint8Array(list.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of list) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
