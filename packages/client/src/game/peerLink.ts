import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { BROWSER_HOST_MAX_GUESTS, MessageGuard, PROTOCOL_VERSION, SnapshotDecoder, isJoinCode, parseCheckpoint, sanitizeName, type ClientMessage, type MatchCheckpoint, type PlayerInput, type ServerMessage } from '@tiletrigger/shared';
import type { HostLink, RemoteLink, Signaling, Transport } from './transport.ts';
import { CHUNK, GUEST_TO_HOST_LIMITS, HOST_TO_GUEST_LIMITS, Reassembler, Unzipper, plainPiece, type ReassemblyLimits } from '@tiletrigger/shared/peerZip';
import { hubAddress, hubSetting } from './hub.ts';
import { baseIceServers, loadRelay, sessionIce } from './relay.ts';
import { makeJoinCode } from './joinCode.ts';
import { netProbe } from './perfProbe.ts';
import { playerKey } from './playerKey.ts';
import { SnapshotCoalescer } from './snapshotMerge.ts';
import { adminToken, rememberAdminToken } from './netTransport.ts';
import { accessToken } from '../account.ts';

/**
 * Host game / Join by code over PeerJS: friends connect straight to the
 * host's browser over WebRTC data channels (the host runs the match, as in
 * offline play). The community hub's broker (or PeerJS's public one) only
 * introduces the two browsers; set your own with `?peer=host:port` (a `peer`
 * server, e.g. `npx peer --port 9000`). This is the only file that imports
 * PeerJS: the game uses it through the Signaling interface (transport.ts).
 */
const PREFIX = 'tiletrigger-';
/** A friend's browser host that sends nothing for this long has dropped (it streams snapshots all the time). */
const HOST_SILENT_MS = 20_000;
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

/** Pieces of a compressed stream (the match host compressed them: matchHost.ts sinkTo), as they are. */
function sendPieces(conn: DataConnection, pieces: Uint8Array[]): void {
  if (!conn.open) return;
  const t0 = netProbe.on ? performance.now() : 0;
  for (const piece of pieces) conn.send(piece);
  if (netProbe.on) {
    netProbe.sent++;
    for (const piece of pieces) netProbe.sentBytes += piece.length;
    netProbe.sendMs += performance.now() - t0;
  }
}

function sendText(conn: DataConnection, text: string): void {
  if (!conn.open) return;
  if (text.length <= CHUNK) return void conn.send(text);
  const id = ++chunkIds;
  const n = Math.ceil(text.length / CHUNK);
  for (let i = 0; i < n; i++) conn.send(`\u0001${id}|${i}|${n}|${text.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

/**
 * Calls `cb` with whole texts, putting chunked ones back together (and unzipping compressed ones). `wire` counts bytes received.
 * Nothing the other side sends is trusted: pieces and inflated output are capped (`limits`, shared/net/peerZip.ts), and with a
 * `guard` (the host, for each friend) messages past the rate budget are dropped. A link that breaks a limit is closed.
 */
function onText(conn: DataConnection, cb: (text: string) => void, o: { limits: ReassemblyLimits; guard?: MessageGuard; wire?: (bytes: number) => void }): void {
  conn.on('data', textHandler(conn, cb, o));
}

/** onText's handler for one link's data, for links that deliver it themselves (linkFor keeps what came early). */
function textHandler(conn: DataConnection, cb: (text: string) => void, o: { limits: ReassemblyLimits; guard?: MessageGuard; wire?: (bytes: number) => void }): (data: unknown) => void {
  const parts = new Reassembler(o.limits);
  let unzip: Unzipper | null = null;
  const abuse = (why: string) => {
    console.warn(`closing a connection: ${why}`);
    conn.close();
  };
  return (data) => {
    if (!conn.open) return;
    const verdict = o.guard?.check() ?? 'ok';
    if (verdict === 'kick') return abuse('too many messages');
    if (verdict === 'drop') return;
    try {
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        o.wire?.(bytes.length);
        const t0 = netProbe.on ? performance.now() : 0;
        const text = (unzip ??= new Unzipper(o.limits.maxBytes)).piece(bytes);
        if (netProbe.on) {
          netProbe.inflateMs += performance.now() - t0;
          netProbe.recvBytes += bytes.length;
          if (text !== null) netProbe.recvChars += text.length;
        }
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
  };
}

/** A friend's link holds this many messages that come before the match listens (a successor's code, before it hosts). */
const EARLY_MESSAGES = 32;

function linkFor(conn: DataConnection): RemoteLink {
  // Friends that ask for it (every current client) get the compressed stream: the match host compresses it
  // (in its worker) and hands over pieces; what the page says itself goes as a plain piece between them.
  const zip = (conn.metadata as { z?: number } | undefined)?.z === 1;
  // What the friend says before anyone listens (a standby code holding links until its match starts) waits for the listener.
  let deliver: ((data: unknown) => void) | null = null;
  const early: unknown[] = [];
  conn.on('data', (data) => (deliver ? deliver(data) : early.length < EARLY_MESSAGES && early.push(data)));
  return {
    zip,
    send: (text) => (zip ? sendPieces(conn, [plainPiece(text)]) : sendText(conn, text)),
    sendPieces: (pieces) => sendPieces(conn, pieces),
    // A friend's messages are small and rate-limited (the same budget as the dedicated server's clients).
    onMessage: (cb) => {
      deliver = textHandler(conn, cb, { limits: GUEST_TO_HOST_LIMITS, guard: new MessageGuard() });
      for (const data of early.splice(0)) deliver(data);
    },
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

  /** Friends' links that came while nothing took them (a successor's standby code before its match runs). */
  private held: RemoteLink[] = [];
  private admitTo: ((link: RemoteLink) => void) | null;

  /**
   * `admit`: where friends' connections go; a map change points it at the next match (same code, friends rejoin).
   * Null: hold them until it's set (a successor's standby code, opened before there's a match to let them into).
   */
  constructor(admit: ((link: RemoteLink) => void) | null) {
    this.admitTo = admit;
  }

  get admit(): (link: RemoteLink) => void {
    return (link) => {
      if (this.admitTo) return this.admitTo(link);
      if (this.held.length < BROWSER_HOST_MAX_GUESTS) this.held.push(link);
      else link.close();
    };
  }

  set admit(f: (link: RemoteLink) => void) {
    this.admitTo = f;
    for (const link of this.held.splice(0)) f(link);
  }

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
    for (const link of this.held.splice(0)) link.close();
    this.peer?.destroy();
    this.peer = undefined;
  }
}

/** What a friend knows when its host goes: who was named to take over, and (the successor itself) its code and checkpoint. */
export interface Handoff {
  /** The successor the host named last: the join code it hosts on, its place and name. */
  successor: { code: string; slot: number | null; name: string } | null;
  /** This browser is the successor: its standby code (open, holding friends' links until the match runs here)… */
  standby: HostLink | null;
  /** …and the latest checkpoint, with when it came (performance.now()). */
  checkpoint: { cp: MatchCheckpoint; at: number } | null;
}

/** The friend's side: a Transport to the host's browser, like the WebSocket one to a server. */
export class PeerTransport implements Transport {
  private peer?: Peer;
  private conn?: DataConnection;
  private pingTimer?: number;
  private closedByUs = false;
  rttMs = 0;
  bytesIn = 0;
  /**
   * How the host went, once the link to it closed after we were in: `left` (it said `bye`: on purpose) or
   * `dropped` (the link just died: maybe a blip). Null while the host is there, or when we never got in.
   */
  hostGone: 'left' | 'dropped' | null = null;
  /** Host handoff (net/handoff.ts): the successor the host named, and, asked to stand by, our standby code and checkpoint. */
  private handoff: Handoff = { successor: null, standby: null, checkpoint: null };
  private standbyOpening = false;
  /** The host is a dedicated one (a Host Service: it keeps places and comes back), not a player's browser. */
  dedicated = false;
  /** The host let us in (its welcome came), even if the match is still loading here. */
  welcomed = false;
  /** Our link to the host is open (it may still be starting its match: a successor taking over). */
  linked = false;
  private saidBye = false;

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
    // The hub's relay credentials for this game (none if the hub doesn't know the code: the broker then says why),
    // and, signed in, the hub's account ticket for it (a host then knows the account without seeing the sign-in).
    void Promise.all([sessionIce(this.code, 'guest'), accountTicket(this.code)]).then(([ice, ticket]) => {
      this.relay = ice.relay;
      this.ticket = ticket;
      if (!this.closedByUs) this.open(onMessage, onClose, [...baseIceServers(), ...ice.servers]);
    });
  }

  private ticket: string | null = null;

  private open(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void, iceServers: RTCIceServer[]): void {
    const peer = new Peer(peerOptions({ iceServers }));
    this.peer = peer;
    // A page that falls behind (a long frame, a slow machine with 96 players in view) handles the snapshots waiting for it as one.
    const snapshots = (this.snapshots = new SnapshotCoalescer((m) => !this.closedByUs && onMessage(m)));
    const players = new SnapshotDecoder();
    let opened = false;
    let brokered = false;
    /** When the host last sent anything: a host that goes silent (its machine slept, its tab was killed) has dropped. */
    let heardAt = 0;
    const fail = (reason: string) => {
      if (this.closedByUs) return;
      this.closedByUs = true;
      snapshots.clear();
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
        this.linked = true;
        clearTimeout(timeout);
        const admin = adminToken(`code:${this.code}`);
        this.send({ t: 'hello', protocol: PROTOCOL_VERSION, name: this.name, look: this.look, pk: playerKey(), ...(this.ticket ? { ticket: this.ticket } : {}), ...(admin ? { admin } : {}) });
        heardAt = performance.now();
        let tickAt = heardAt;
        this.pingTimer = window.setInterval(() => {
          const now = performance.now();
          // This page stalled (a long frame, a sleeping tab): the silence was ours, not the host's.
          if (now - tickAt > 3000) heardAt = now;
          tickAt = now;
          // A player's browser host streams 20 snapshots a second and answers every ping: silence this long is a dropped host.
          if (!this.dedicated && now - heardAt > HOST_SILENT_MS) return hostLost('silent');
          this.send({ t: 'ping', id: 0, ct: performance.now(), ...(this.rttMs ? { rtt: Math.round(this.rttMs) } : {}) });
        }, 1000);
      });
      const hostLost = (why: string) => {
        if (opened && !this.closedByUs) {
          this.hostGone = this.saidBye ? 'left' : 'dropped';
          console.warn(`the host's link went (${why}${this.saidBye ? ', after its goodbye' : ''})`);
        }
        fail(!opened ? noDirect : this.saidBye ? 'the host left the game' : 'lost the connection to the host');
      };
      onText(
        conn,
        (text) => {
          const t0 = performance.now();
          heardAt = t0;
          const msg = JSON.parse(text) as ServerMessage;
          if (netProbe.on) {
            const t1 = performance.now();
            netProbe.parseMs += t1 - t0;
            if (msg.t === 'snapshot') {
              netProbe.arrivals.push(t1);
              netProbe.ticks.push(msg.tick);
            }
          }
          if (msg.t === 'pong') {
            const sample = performance.now() - msg.ct;
            this.rttMs = this.rttMs ? this.rttMs * 0.8 + sample * 0.2 : sample;
            return;
          }
          if (msg.t === 'bye') {
            // The link closes next; if that close never comes, don't wait for it.
            this.saidBye = true;
            return void window.setTimeout(() => hostLost('goodbye'), 1500);
          }
          if (msg.t === 'welcome') {
            this.dedicated = !!msg.dedicated;
            this.welcomed = true;
          }
          if (msg.t === 'standby' || msg.t === 'successor' || msg.t === 'checkpoint') return this.onHandoff(msg);
          if (msg.t === 'snapshot') players.snapshot(msg);
          snapshots.push(msg);
        },
        { limits: HOST_TO_GUEST_LIMITS, wire: (bytes) => (this.bytesIn += bytes) },
      );
      conn.on('close', () => hostLost('closed'));
    });
  }

  /** Host handoff messages: only what the host says over its own link counts (nobody else can name a successor). */
  private onHandoff(msg: Extract<ServerMessage, { t: 'standby' | 'successor' | 'checkpoint' }>): void {
    if (this.dedicated || this.closedByUs) return;
    const h = this.handoff;
    if (msg.t === 'standby') {
      // Asked to stand by: open a join code of our own (it holds links until there's a match) and tell the host.
      if (h.standby) return this.send({ t: 'standby', code: h.standby.code });
      if (this.standbyOpening) return;
      this.standbyOpening = true;
      const host = new PeerHost(null);
      void host.start().then(
        (code) => {
          this.standbyOpening = false;
          // Gone, or someone else was named meanwhile (we took too long): not needed after all.
          if (this.closedByUs || h.successor) return host.close();
          h.standby = host;
          this.send({ t: 'standby', code });
        },
        () => (this.standbyOpening = false),
      );
      return;
    }
    if (msg.t === 'successor') {
      h.successor = isJoinCode(msg.code) ? { code: msg.code, slot: typeof msg.slot === 'number' ? msg.slot : null, name: typeof msg.name === 'string' ? sanitizeName(msg.name) : 'A player' } : null;
      // Someone else (or nobody) takes over now: our standby code and checkpoint are no longer needed.
      if (h.standby && h.successor?.code !== h.standby.code) {
        h.standby.close();
        h.standby = null;
        h.checkpoint = null;
      }
      return;
    }
    // A checkpoint is only for the successor (we opened a standby code when asked).
    if (!h.standby) return;
    const cp = parseCheckpoint(msg.cp);
    if (cp) h.checkpoint = { cp, at: performance.now() };
  }

  /** The host has gone: what we know for a handoff. The standby code (if any) is now the caller's to host on, or close. */
  takeHandoff(): Handoff {
    const h = this.handoff;
    this.handoff = { successor: null, standby: null, checkpoint: null };
    return h;
  }

  private snapshots?: SnapshotCoalescer;

  flush(): void {
    this.snapshots?.flush();
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.send({ t: 'input', inputs });
  }

  sendReady(): void {
    this.send({ t: 'ready' });
  }

  /** Admin login and commands: a dedicated host (Host Service) runs them for its admin; a browser host refuses them. */
  sendCommand(msg: Extract<ClientMessage, { t: 'host' | 'admin' }>): void {
    if (msg.t === 'admin') rememberAdminToken(`code:${this.code}`, msg.token);
    this.send(msg);
  }

  close(): void {
    this.closedByUs = true;
    // Leaving on our own: a standby code we opened isn't needed. After the host went, it waits for takeHandoff.
    if (!this.hostGone) {
      this.handoff.standby?.close();
      this.handoff.standby = null;
    }
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

/** The hub's account ticket for joining `code` (signed-in players only), or null. */
async function accountTicket(code: string): Promise<string | null> {
  const token = accessToken();
  const hub = hubAddress();
  if (!token || !hub) return null;
  try {
    const res = await fetch(`${hub.secure ? 'https' : 'http'}://${hub.host}:${hub.port}${hub.path}api/v1/ticket?code=${code}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    return res.ok ? (((await res.json()) as { ticket?: string }).ticket ?? null) : null;
  } catch {
    return null;
  }
}
