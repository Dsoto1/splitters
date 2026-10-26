import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { PROTOCOL_VERSION, type ClientMessage, type PlayerInput, type ServerMessage } from '@tiletrigger/shared';
import type { RemoteLink } from './localTransport.ts';
import type { Transport } from './transport.ts';
import { CHUNK, Unzipper, Zipper } from './peerZip.ts';
import { fetchIce, hubAddress, hubSetting } from './hub.ts';

/**
 * Host game / Join by code: friends connect straight to the host's browser
 * over WebRTC data channels (the host runs the match, as in offline play).
 * PeerJS's free broker only introduces the two browsers; set your own with
 * `?peer=host:port` (a `peer` server, e.g. `npx peer --port 9000`).
 */
const PREFIX = 'tiletrigger-';
/** Codes skip look-alike letters (no I, L, O, 0, 1). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeJoinCode = (): string => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanJoinCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

/**
 * A TURN relay for players whose networks block direct connections (strict
 * NATs, campus or mobile networks): traffic goes through the relay instead.
 * Set in Options (kept in this browser) or carried in an invite link.
 */
export interface RelayPrefs {
  /** e.g. `turn:global.relay.metered.ca:80` (several separated by spaces or commas). */
  url: string;
  user: string;
  pass: string;
}

const RELAY_KEY = 'tiletrigger.relay';

export function loadRelay(): RelayPrefs | null {
  const q = new URLSearchParams(location.search);
  if (q.get('relay')) return { url: q.get('relay')!, user: q.get('ru') ?? '', pass: q.get('rp') ?? '' };
  try {
    const r = JSON.parse(localStorage.getItem(RELAY_KEY) ?? 'null') as RelayPrefs | null;
    return r?.url ? r : null;
  } catch {
    return null;
  }
}

export function saveRelay(r: RelayPrefs | null): void {
  try {
    if (r?.url.trim()) localStorage.setItem(RELAY_KEY, JSON.stringify({ ...r, url: r.url.trim() }));
    else localStorage.removeItem(RELAY_KEY);
  } catch {
    // Private windows: lasts for this page.
  }
}

/** The relay as invite-link parameters, so a friend uses it too. */
export function relayParams(): string {
  const r = loadRelay();
  if (!r) return '';
  const q = new URLSearchParams({ relay: r.url });
  if (r.user) q.set('ru', r.user);
  if (r.pass) q.set('rp', r.pass);
  return `&${q}`;
}

function iceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const r = loadRelay();
  if (r) {
    const urls = r.url.split(/[\s,]+/).filter(Boolean).map((u) => (/^turns?:/.test(u) ? u : `turn:${u}`));
    if (urls.length) list.push({ urls, username: r.user, credential: r.pass });
  }
  return list;
}

/** Relay credentials from the community hub (fetched before connecting), and whether it has a relay at all. */
let hubIce: RTCIceServer[] = [];
let hubIceAt = 0;
export let hubRelay = false;

/** Ask the hub for relay credentials (shared, renewed every 30 minutes). Never fails: without them, direct connections only. */
export async function prepareIce(): Promise<void> {
  if (Date.now() - hubIceAt < 30 * 60_000) return;
  const got = await fetchIce();
  hubIce = got?.iceServers ?? [];
  hubRelay = !!got?.relay;
  hubIceAt = got ? Date.now() : 0;
}

function peerOptions(): PeerOptions {
  const custom = new URLSearchParams(location.search).get('peer');
  const base: PeerOptions = { config: { iceServers: [...iceServers(), ...hubIce] }, debug: 0 };
  // No broker named: the community hub's, when there is one; otherwise PeerJS's public one.
  if (!custom) {
    const hub = hubAddress();
    return hub ? { ...base, host: hub.host, port: hub.port, path: `${hub.path}broker`, secure: hub.secure } : base;
  }
  const m = /^(?:(wss?|https?):\/\/)?([^:/]+)(?::(\d+))?(\/.*)?$/.exec(custom);
  if (!m) return base;
  const secure = m[1] === 'wss' || m[1] === 'https';
  return { ...base, host: m[2]!, port: Number(m[3] ?? (secure ? 443 : 80)), path: m[4] ?? '/', secure };
}

let chunkIds = 0;

function sendText(conn: DataConnection, text: string, zip?: Zipper): void {
  if (!conn.open) return;
  if (zip) {
    for (const piece of zip.pieces(text)) conn.send(piece);
    return;
  }
  if (text.length <= CHUNK) return void conn.send(text);
  const id = ++chunkIds;
  const n = Math.ceil(text.length / CHUNK);
  for (let i = 0; i < n; i++) conn.send(`\u0001${id}|${i}|${n}|${text.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

/** Calls `cb` with whole texts, putting chunked ones back together (and unzipping compressed ones). `wire` counts bytes received. */
function onText(conn: DataConnection, cb: (text: string) => void, wire?: (bytes: number) => void): void {
  const parts = new Map<string, string[]>();
  let unzip: Unzipper | null = null;
  conn.on('data', (data) => {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      wire?.(bytes.length);
      const text = (unzip ??= new Unzipper()).piece(bytes);
      if (text !== null) cb(text);
      return;
    }
    const text = String(data);
    wire?.(text.length);
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
  // Friends that ask for it (every current client) get the compressed stream.
  const zip = (conn.metadata as { z?: number } | undefined)?.z === 1 ? new Zipper() : undefined;
  return {
    send: (text) => sendText(conn, text, zip),
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
  private readonly links = new Map<string, DataConnection>();
  code = '';

  /** `admit`: where friends' connections go; a map change points it at the next match (same code, friends rejoin). */
  constructor(public admit: (link: RemoteLink) => void) {}

  /** Resolves with the join code once the broker has registered it. */
  async start(): Promise<string> {
    await prepareIce();
    return new Promise((resolve, reject) => {
      const tryCode = (attempt: number) => {
        const code = makeJoinCode();
        const peer = new Peer(PREFIX + code, peerOptions());
        peer.on('open', () => {
          this.peer = peer;
          this.code = code;
          resolve(code);
        });
        peer.on('connection', (conn) =>
          conn.on('open', () => {
            // One player per friend's browser: a second connection from it replaces the first.
            this.links.get(conn.peer)?.close();
            this.links.set(conn.peer, conn);
            conn.on('close', () => this.links.get(conn.peer) === conn && this.links.delete(conn.peer));
            this.admit(linkFor(conn));
          }),
        );
        // Lost touch with the broker (Wi-Fi blip, a sleeping tab): rejoin it under the same code, or
        // friends can no longer find the game. Games already joined carry on regardless.
        peer.on('disconnected', () => {
          if (this.peer === peer && !peer.destroyed) window.setTimeout(() => !peer.destroyed && peer.disconnected && peer.reconnect(), 1000);
        });
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
    void prepareIce().then(() => !this.closedByUs && this.open(onMessage, onClose));
  }

  private open(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void): void {
    const peer = new Peer(peerOptions());
    this.peer = peer;
    let opened = false;
    let brokered = false;
    const fail = (reason: string) => {
      if (this.closedByUs) return;
      this.closedByUs = true;
      clearInterval(this.pingTimer);
      clearTimeout(timeout);
      peer.destroy();
      onClose(reason);
    };
    // Name the broker: a "localhost" hub from someone else's invite link points at this computer, not theirs.
    const unreachable = () => {
      const hub = new URLSearchParams(location.search).get('peer') ?? hubSetting();
      if (!hub) return "couldn't reach the matchmaking service — check your internet connection";
      const local = /^(localhost|127\.|\[::1\])/.test(hub.replace(/^\w+:\/\//, ''));
      return `couldn't reach the matchmaking service at ${hub}${local ? ' — that address means "this computer", so it only works on the host\'s own machine: ask them to host without a localhost hub' : ' — check the address and that the hub is running'}`;
    };
    const relayHint = loadRelay() || hubRelay ? 'even through the relay' : 'the host can set a relay in Options and send you a new invite link, or play on the same Wi-Fi';
    const noDirect = `found the game but couldn't connect to it — your networks block direct connections: ${relayHint}`;
    // 20 s to reach the broker; once it has found the game, a fresh 30 s to connect (slow machines are still loading).
    const giveUp = () => {
      if (opened) return;
      fail(brokered ? noDirect : unreachable());
    };
    let timeout = window.setTimeout(giveUp, 20000);
    peer.on('error', (e) => {
      const type = (e as { type?: string }).type;
      if (type === 'peer-unavailable') fail(`no game open with code ${this.code} — check the code, and that the host still has the match open (Esc → Host game)`);
      else if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
        if (!brokered) fail(unreachable());
      } else if (type === 'webrtc' || type === 'negotiation-failed') fail(noDirect);
      else fail(`connection failed (${type ?? e.message})`);
    });
    peer.on('open', () => {
      brokered = true;
      clearTimeout(timeout);
      timeout = window.setTimeout(giveUp, 30000);
      const conn = peer.connect(PREFIX + this.code, { reliable: true, serialization: 'raw', metadata: { z: 1 } });
      this.conn = conn;
      conn.on('iceStateChanged', (state) => {
        if (state === 'failed' && !opened) fail(noDirect);
      });
      conn.on('open', () => {
        opened = true;
        clearTimeout(timeout);
        this.send({ t: 'hello', protocol: PROTOCOL_VERSION, name: this.name, look: this.look });
        this.pingTimer = window.setInterval(() => this.send({ t: 'ping', id: 0, ct: performance.now() }), 1000);
      });
      onText(
        conn,
        (text) => {
          const msg = JSON.parse(text) as ServerMessage;
          if (msg.t === 'pong') {
            const sample = performance.now() - msg.ct;
            this.rttMs = this.rttMs ? this.rttMs * 0.8 + sample * 0.2 : sample;
            return;
          }
          onMessage(msg);
        },
        (bytes) => (this.bytesIn += bytes),
      );
      conn.on('close', () => fail(opened ? 'the host left the game' : noDirect));
    });
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.send({ t: 'input', inputs });
  }

  sendReady(): void {
    this.send({ t: 'ready' });
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
