import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { PROTOCOL_VERSION, type ClientMessage, type PlayerInput, type ServerMessage } from '@chronosplit/shared';
import type { RemoteLink } from './localTransport.ts';
import type { Transport } from './transport.ts';

/**
 * Host game / Join by code: friends connect straight to the host's browser
 * over WebRTC data channels (the host runs the match, as in offline play).
 * PeerJS's free broker only introduces the two browsers; set your own with
 * `?peer=host:port` (a `peer` server, e.g. `npx peer --port 9000`).
 */
const PREFIX = 'chronosplit-';
/** Codes skip look-alike letters (no I, L, O, 0, 1). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeJoinCode = (): string => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanJoinCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function peerOptions(): PeerOptions {
  const custom = new URLSearchParams(location.search).get('peer');
  const base: PeerOptions = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }, debug: 0 };
  if (!custom) return base;
  const m = /^(?:(wss?|https?):\/\/)?([^:/]+)(?::(\d+))?(\/.*)?$/.exec(custom);
  if (!m) return base;
  const secure = m[1] === 'wss' || m[1] === 'https';
  return { ...base, host: m[2]!, port: Number(m[3] ?? (secure ? 443 : 80)), path: m[4] ?? '/', secure };
}

/** Data channels cap message size (~256 KB in Chrome): long texts (the map in the welcome) go in pieces. */
const CHUNK = 60_000;
let chunkIds = 0;

function sendText(conn: DataConnection, text: string): void {
  if (!conn.open) return;
  if (text.length <= CHUNK) return void conn.send(text);
  const id = ++chunkIds;
  const n = Math.ceil(text.length / CHUNK);
  for (let i = 0; i < n; i++) conn.send(`\u0001${id}|${i}|${n}|${text.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

/** Calls `cb` with whole texts, putting chunked ones back together. */
function onText(conn: DataConnection, cb: (text: string) => void): void {
  const parts = new Map<string, string[]>();
  conn.on('data', (data) => {
    const text = String(data);
    if (!text.startsWith('\u0001')) return cb(text);
    const [id, i, n] = text.slice(1).split('|', 3) as [string, string, string];
    const body = text.slice(1 + id.length + i.length + n.length + 3);
    const list = parts.get(id) ?? new Array<string>(Number(n));
    list[Number(i)] = body;
    parts.set(id, list);
    if (list.filter((x) => x !== undefined).length === Number(n)) {
      parts.delete(id);
      cb(list.join(''));
    }
  });
}

function linkFor(conn: DataConnection): RemoteLink {
  return {
    send: (text) => sendText(conn, text),
    onMessage: (cb) => onText(conn, cb),
    onClose: (cb) => {
      conn.on('close', cb);
      conn.on('error', cb);
    },
    close: () => conn.close(),
  };
}

/** The host side: registers a join code and hands each friend's connection to the match. */
export class PeerHost {
  private peer?: Peer;
  code = '';

  constructor(private readonly admit: (link: RemoteLink) => void) {}

  /** Resolves with the join code once the broker has registered it. */
  start(): Promise<string> {
    return new Promise((resolve, reject) => {
      const tryCode = (attempt: number) => {
        const code = makeJoinCode();
        const peer = new Peer(PREFIX + code, peerOptions());
        peer.on('open', () => {
          this.peer = peer;
          this.code = code;
          resolve(code);
        });
        peer.on('connection', (conn) => conn.on('open', () => this.admit(linkFor(conn))));
        peer.on('error', (e) => {
          // Taken already (unlikely): try another code.
          if ((e as { type?: string }).type === 'unavailable-id' && attempt < 4) {
            peer.destroy();
            tryCode(attempt + 1);
          } else if (!this.peer) reject(new Error(`could not open a join code (${(e as { type?: string }).type ?? e.message})`));
        });
      };
      tryCode(0);
    });
  }

  close(): void {
    this.peer?.destroy();
    this.peer = undefined;
  }
}

/** The friend's side: a Transport to the host's browser, like the WebSocket one to a server. */
export class PeerTransport implements Transport {
  private peer?: Peer;
  private conn?: DataConnection;
  private pingTimer?: number;
  private closedByUs = false;
  rttMs = 0;
  bytesIn = 0;

  constructor(
    private readonly code: string,
    private readonly name: string,
    private readonly look?: string,
  ) {}

  get label(): string {
    return `code ${this.code}`;
  }

  start(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void): void {
    const peer = new Peer(peerOptions());
    this.peer = peer;
    let opened = false;
    const fail = (reason: string) => {
      if (this.closedByUs) return;
      this.closedByUs = true;
      clearInterval(this.pingTimer);
      peer.destroy();
      onClose(reason);
    };
    const timeout = window.setTimeout(() => !opened && fail(`no game found for code ${this.code}`), 15000);
    peer.on('error', (e) => fail((e as { type?: string }).type === 'peer-unavailable' ? `no game found for code ${this.code}` : `connection failed (${(e as { type?: string }).type ?? e.message})`));
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + this.code, { reliable: true, serialization: 'raw' });
      this.conn = conn;
      conn.on('open', () => {
        opened = true;
        clearTimeout(timeout);
        this.send({ t: 'hello', protocol: PROTOCOL_VERSION, name: this.name, look: this.look });
        this.pingTimer = window.setInterval(() => this.send({ t: 'ping', id: 0, ct: performance.now() }), 1000);
      });
      onText(conn, (text) => {
        this.bytesIn += text.length;
        const msg = JSON.parse(text) as ServerMessage;
        if (msg.t === 'pong') {
          const sample = performance.now() - msg.ct;
          this.rttMs = this.rttMs ? this.rttMs * 0.8 + sample * 0.2 : sample;
          return;
        }
        onMessage(msg);
      });
      conn.on('close', () => fail('the host left the game'));
    });
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.send({ t: 'input', inputs });
  }

  close(): void {
    this.closedByUs = true;
    clearInterval(this.pingTimer);
    this.conn?.close();
    this.peer?.destroy();
  }

  private send(m: ClientMessage): void {
    if (this.conn) sendText(this.conn, JSON.stringify(m));
  }
}
