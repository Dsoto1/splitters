import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { MessageGuard, PROTOCOL_VERSION, type ClientMessage, type PlayerInput, type ServerMessage } from '@tiletrigger/shared';
import type { HostLink, RemoteLink, Signaling, Transport } from './transport.ts';
import { CHUNK, GUEST_TO_HOST_LIMITS, HOST_TO_GUEST_LIMITS, Reassembler, Unzipper, Zipper, type ReassemblyLimits } from './peerZip.ts';
import { hubAddress, hubSetting } from './hub.ts';
import { baseIceServers, loadRelay, sessionIce } from './relay.ts';
import { makeJoinCode } from './joinCode.ts';

/**
 * Host game / Join by code over PeerJS: friends connect straight to the
 * host's browser over WebRTC data channels (the host runs the match, as in
 * offline play). The community hub's broker (or PeerJS's public one) only
 * introduces the two browsers; set your own with `?peer=host:port` (a `peer`
 * server, e.g. `npx peer --port 9000`). This is the only file that imports
 * PeerJS: the game uses it through the Signaling interface (transport.ts).
 */
const PREFIX = 'tiletrigger-';
export { makeJoinCode };
export const cleanJoinCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function peerOptions(config: RTCConfiguration): PeerOptions {
  const custom = new URLSearchParams(location.search).get('peer');
  // PeerJS keeps this config object and reads it for every new connection: refreshed credentials go in it.
  const base: PeerOptions = { config, debug: 0 };
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

/**
 * Calls `cb` with whole texts, putting chunked ones back together (and unzipping compressed ones). `wire` counts bytes received.
 * Nothing the other side sends is trusted: pieces and inflated output are capped (`limits`, peerZip.ts), and with a
 * `guard` (the host, for each friend) messages past the rate budget are dropped. A link that breaks a limit is closed.
 */
function onText(conn: DataConnection, cb: (text: string) => void, o: { limits: ReassemblyLimits; guard?: MessageGuard; wire?: (bytes: number) => void }): void {
  const parts = new Reassembler(o.limits);
  let unzip: Unzipper | null = null;
  const abuse = (why: string) => {
    console.warn(`closing a connection: ${why}`);
    conn.close();
  };
  conn.on('data', (data) => {
    if (!conn.open) return;
    const verdict = o.guard?.check() ?? 'ok';
    if (verdict === 'kick') return abuse('too many messages');
    if (verdict === 'drop') return;
    try {
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        o.wire?.(bytes.length);
        const text = (unzip ??= new Unzipper(o.limits.maxBytes)).piece(bytes);
        if (text !== null) cb(text);
        return;
      }
      const text = String(data);
      o.wire?.(text.length);
      const whole = parts.add(text);
      if (whole !== null) cb(whole);
    } catch (e) {
      abuse((e as Error).message);
    }
  });
}

function linkFor(conn: DataConnection): RemoteLink {
  // Friends that ask for it (every current client) get the compressed stream.
  const zip = (conn.metadata as { z?: number } | undefined)?.z === 1 ? new Zipper() : undefined;
  return {
    send: (text) => sendText(conn, text, zip),
    // A friend's messages are small and rate-limited (the same budget as the dedicated server's clients).
    onMessage: (cb) => onText(conn, cb, { limits: GUEST_TO_HOST_LIMITS, guard: new MessageGuard() }),
    onClose: (cb) => {
      conn.on('close', cb);
      conn.on('error', cb);
    },
    close: () => conn.close(),
  };
}

/** The host side: registers a join code and hands each friend's connection to the match. */
export class PeerHost implements HostLink {
  private peer?: Peer;
  private readonly links = new Map<string, DataConnection>();
  private readonly config: RTCConfiguration = { iceServers: baseIceServers() };
  private refresh?: number;
  code = '';
  relay = false;

  /** `admit`: where friends' connections go; a map change points it at the next match (same code, friends rejoin). */
  constructor(public admit: (link: RemoteLink) => void) {}

  /** The hub's relay credentials for this game, renewed before they expire (new friends' connections use the latest). */
  private async fetchIce(code: string): Promise<void> {
    const got = await sessionIce(code, 'host');
    if (!got.relay && this.relay) return; // a failed renewal keeps the last ones until they lapse
    this.relay = got.relay;
    this.config.iceServers = [...baseIceServers(), ...got.servers];
    window.clearTimeout(this.refresh);
    if (got.relay && got.ttl > 0) this.refresh = window.setTimeout(() => this.peer && void this.fetchIce(code), Math.max(60, got.ttl / 2) * 1000);
  }

  /** Resolves with the join code once the broker has registered it (and the hub's relay, if any, is set up for it). */
  start(): Promise<string> {
    return new Promise((resolve, reject) => {
      const tryCode = (attempt: number) => {
        const code = makeJoinCode();
        const peer = new Peer(PREFIX + code, peerOptions(this.config));
        peer.on('open', () => {
          this.peer = peer;
          this.code = code;
          // The hub hands out relay credentials only for a game open on its broker: ask now that it is.
          void this.fetchIce(code).then(() => resolve(code));
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
    window.clearTimeout(this.refresh);
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

  private relay = false;

  start(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void): void {
    // The hub's relay credentials for this game (none if the hub doesn't know the code: the broker then says why).
    void sessionIce(this.code, 'guest').then((ice) => {
      this.relay = ice.relay;
      if (!this.closedByUs) this.open(onMessage, onClose, [...baseIceServers(), ...ice.servers]);
    });
  }

  private open(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void, iceServers: RTCIceServer[]): void {
    const peer = new Peer(peerOptions({ iceServers }));
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
    const relayHint = loadRelay() || this.relay ? 'even through the relay' : 'the host can set a relay in Options and send you a new invite link, or play on the same Wi-Fi';
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
        this.pingTimer = window.setInterval(() => this.send({ t: 'ping', id: 0, ct: performance.now(), ...(this.rttMs ? { rtt: Math.round(this.rttMs) } : {}) }), 1000);
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
        { limits: HOST_TO_GUEST_LIMITS, wire: (bytes) => (this.bytesIn += bytes) },
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

/** PeerJS behind the Signaling interface (transport.ts). */
export const peerSignaling: Signaling = {
  host: (admit) => new PeerHost(admit),
  join: (code, name, look) => new PeerTransport(cleanJoinCode(code), name, look),
};
