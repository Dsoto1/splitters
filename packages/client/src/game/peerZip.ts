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
export class Zipper {
  private readonly deflate = new Deflate({ raw: true, level: 6 });
  private out: Uint8Array[] = [];
  private readonly enc = new TextEncoder();

  constructor() {
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

export class Unzipper {
  private readonly inflate = new Inflate({ raw: true });
  private got: Uint8Array[] = [];
  private readonly dec = new TextDecoder();

  constructor() {
    this.inflate.onData = (c) => this.got.push((c as Uint8Array).slice());
  }

  /** A piece in; the whole message out once its last piece has arrived. */
  piece(data: Uint8Array): string | null {
    this.inflate.push(data.subarray(1), zlib.Z_SYNC_FLUSH);
    // pako hands output over only when its buffer fills: take what a flushed message left in it.
    const st = (this.inflate as unknown as { strm: { output: Uint8Array; next_out: number; avail_out: number } }).strm;
    if (st.next_out) {
      this.got.push(st.output.slice(0, st.next_out));
      st.next_out = 0;
      st.avail_out = st.output.length;
    }
    if (this.inflate.err) throw new Error(`bad compressed data (${this.inflate.msg})`);
    if (data[0] !== 1) return null;
    const text = this.dec.decode(concat(this.got));
    this.got = [];
    return text;
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
