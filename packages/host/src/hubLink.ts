import { randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DataConnection, Peer as PeerT, PeerOptions } from 'peerjs';
import type { Fetch } from './advertiser.ts';

/**
 * The Host Service's side of the hub's PeerJS broker: registers the join code
 * as a host exactly as a browser host does (code `tiletrigger-<CODE>`), takes
 * friends' WebRTC data channels, and asks the hub for this game's relay (TURN)
 * credentials, renewed before they lapse. WebRTC comes from node-datachannel
 * (libdatachannel, prebuilt for Linux, macOS and Windows) through its
 * standard-API polyfill, so PeerJS runs unchanged: browsers can't tell this
 * host from a browser one. Nothing listens on this computer: the broker
 * socket is outbound, and players reach it by ICE (direct, or the hub's relay).
 *
 * Losing the hub (network down, hub restarting) doesn't end the match:
 * players already in keep playing over their own connections, and the link
 * reconnects with backoff under the same code (and broker token) when it can.
 */

export const PEER_PREFIX = 'tiletrigger-';
/** Join codes: 6 characters without look-alikes (as the client's joinCode.ts). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeJoinCode = (): string => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** An ICE server as WebRTC takes it. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Public STUN, as browsers use (client relay.ts), until the hub's answer replaces it. */
export const BASE_ICE: IceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

/** Reconnect backoff: 1 s doubling to 30 s, with jitter. */
export const RECONNECT = { firstMs: 1000, maxMs: 30_000 } as const;
/** A friend's connection that hasn't opened by then is dropped (it holds a peer connection). */
const OPEN_TIMEOUT_MS = 30_000;

/**
 * libdatachannel takes TURN servers as `turn:user:pass@host:port` and decodes
 * percent-escapes in the user and password; the hub's coturn usernames carry
 * ':' (`<expiry>:s_<CODE>.host`) and passwords are base64 ('+', '/', '='), so
 * they go in escaped. (The polyfill builds that string from these fields.)
 */
export function iceForLibdatachannel(servers: readonly IceServer[]): IceServer[] {
  return servers.map((s) => (s.username && s.credential ? { urls: s.urls, username: encodeURIComponent(s.username), credential: encodeURIComponent(String(s.credential)) } : { urls: s.urls }));
}

let peerModule: typeof import('peerjs') | null = null;
/** PeerJS on node-datachannel's WebRTC: the polyfill's classes become the globals PeerJS looks for. */
export async function loadPeer(): Promise<typeof import('peerjs')> {
  if (peerModule) return peerModule;
  const poly = await import('node-datachannel/polyfill');
  const g = globalThis as Record<string, unknown>;
  g.RTCPeerConnection ??= poly.RTCPeerConnection;
  g.RTCSessionDescription ??= poly.RTCSessionDescription;
  g.RTCIceCandidate ??= poly.RTCIceCandidate;
  // The `ws` package, not Node's own WebSocket: Node's fires no "close" when a connection can't be made
  // (the hub is down), and PeerJS only learns it lost the hub from "close", so it would never retry.
  const { WebSocket: Ws } = await import('ws');
  g.WebSocket = class extends Ws {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols);
      // A failed connection is an "error" event first: without a listener Node would throw it. "close" follows.
      this.on('error', () => undefined);
    }
  };
  // PeerJS ships CommonJS for Node; its ESM entry is for bundlers.
  peerModule = createRequire(import.meta.url)('peerjs') as typeof import('peerjs');
  return peerModule;
}

export interface HubLinkOptions {
  /** The hub's origin (https://trigger.toshiroplay.com). */
  hub: string;
  /** Register this code (from config, or the one a restarted service had). */
  code?: string;
  /** The code is the owner's choice: wait for it to be free rather than pick another. */
  fixedCode?: boolean;
  /** The broker token that registered `code` before (a restarted service takes its code straight back). */
  token?: string;
  /** A friend's data channel opened. */
  admit(conn: DataConnection): void;
  log(line: string): void;
  fetcher?: Fetch;
}

export class HubLink {
  private peer?: PeerT;
  private readonly config: { iceServers: IceServer[] } = { iceServers: iceForLibdatachannel(BASE_ICE) };
  private reconnectTimer?: NodeJS.Timeout;
  private iceTimer?: NodeJS.Timeout;
  private attempts = 0;
  private closed = false;
  private everOpen = false;
  code: string;
  readonly token: string;
  /** Registered on the broker right now (new players can find the game). */
  online = false;
  /** The hub gave this game relay credentials. */
  relay = false;
  /** Times the link came back after losing the hub. */
  reconnects = 0;

  constructor(private readonly o: HubLinkOptions) {
    this.code = o.code ?? makeJoinCode();
    // PeerJS's own token format (alphanumeric); kept so a restart reclaims the code at once.
    this.token = o.token && /^[a-z0-9]{6,32}$/.test(o.token) ? o.token : Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  }

  private peerOptions(): PeerOptions {
    const u = new URL(this.o.hub);
    const secure = u.protocol === 'https:';
    const path = `${u.pathname.replace(/\/+$/, '')}/broker`;
    return { host: u.hostname, port: Number(u.port || (secure ? 443 : 80)), path, secure, config: this.config as PeerOptions["config"], token: this.token, debug: 0, pingInterval: 5000 };
  }

  /** Resolves with the join code once the broker has registered it; keeps trying while the hub is unreachable. */
  start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.onFirstOpen = resolve;
      this.onFatal = reject;
      void this.create();
    });
  }

  private onFirstOpen?: (code: string) => void;
  private onFatal?: (e: Error) => void;

  private async create(): Promise<void> {
    if (this.closed) return;
    const { Peer } = await loadPeer();
    const peer = new Peer(PEER_PREFIX + this.code, this.peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      if (this.peer !== peer) return;
      this.online = true;
      if (this.everOpen) {
        this.reconnects++;
        this.o.log(`back on the hub (join code ${this.code})`);
      }
      this.attempts = 0;
      void this.fetchIce().finally(() => {
        if (!this.everOpen) {
          this.everOpen = true;
          this.onFirstOpen?.(this.code);
        }
      });
    });
    peer.on('connection', (conn) => {
      const timer = setTimeout(() => !conn.open && conn.close(), OPEN_TIMEOUT_MS);
      timer.unref?.();
      // A candidate that can't be used (another network's address) is reported here; the link goes on with the others.
      conn.on('error', () => undefined);
      conn.on('open', () => {
        clearTimeout(timer);
        this.o.admit(conn);
      });
    });
    peer.on('disconnected', () => {
      if (this.peer !== peer || this.closed) return;
      if (this.online) this.o.log("lost the hub: players in the match carry on; reconnecting…");
      this.online = false;
      this.scheduleReconnect();
    });
    peer.on('error', (e) => {
      if (this.peer !== peer || this.closed) return;
      const type = (e as { type?: string }).type ?? '';
      if (type === 'unavailable-id') {
        // Someone holds the code: our own previous registration the broker hasn't noticed is gone yet, or another game.
        if (!this.o.fixedCode && !this.everOpen && this.attempts < 4) {
          this.code = makeJoinCode();
          this.attempts++;
          peer.destroy();
          return void this.create();
        }
        this.o.log(`join code ${this.code} is taken on the hub right now; trying again shortly`);
        peer.destroy();
        this.online = false;
        return this.scheduleReconnect();
      }
      if (type === 'invalid-id' || type === 'invalid-key' || type === 'browser-incompatible' || type === 'ssl-unavailable') {
        const err = new Error(`the hub refused this host (${type}: ${e.message})`);
        if (!this.everOpen) return this.onFatal?.(err);
        this.o.log(err.message);
      }
      // network, socket-error, socket-closed, server-error: 'disconnected' follows, or the peer was destroyed (the first try).
      if (peer.destroyed) {
        this.online = false;
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const ms = Math.min(RECONNECT.maxMs, RECONNECT.firstMs * 2 ** this.attempts) * (0.5 + Math.random() / 2);
    this.attempts = Math.min(this.attempts + 1, 10);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      const peer = this.peer;
      if (this.closed) return;
      if (!peer || peer.destroyed) return void this.create();
      if (peer.disconnected) {
        try {
          peer.reconnect();
        } catch {
          peer.destroy();
          void this.create();
        }
      }
    }, ms);
  }

  /** The hub's ICE servers for this game (relay credentials when it has a relay), renewed at half their life. */
  private async fetchIce(): Promise<void> {
    clearTimeout(this.iceTimer);
    const fetcher = this.o.fetcher ?? fetch;
    let ttl = 0;
    let ok = false;
    try {
      const res = await fetcher(`${this.o.hub}/lobby/ice?${new URLSearchParams({ session: this.code, role: 'host' })}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const got = (await res.json()) as { iceServers?: IceServer[]; relay?: boolean; ttl?: number };
        const servers = Array.isArray(got.iceServers) ? got.iceServers.filter((s) => s && typeof s === 'object' && 'urls' in s) : [];
        // PeerJS reads this config for every new connection: new players get the fresh credentials.
        this.config.iceServers = iceForLibdatachannel([...BASE_ICE, ...servers]);
        this.relay = !!got.relay;
        ttl = Number(got.ttl) || 0;
        ok = true;
      } else this.o.log(`the hub gave no relay credentials (${res.status}): players on strict networks may not connect`);
    } catch (e) {
      this.o.log(`couldn't ask the hub for relay credentials (${(e as Error).message})`);
    }
    // Renew at half life (at least a minute apart); retry in a minute after a failure; a hub without a relay: now and then.
    const next = !ok ? 60 : this.relay && ttl > 0 ? Math.max(60, ttl / 2) : 900;
    this.iceTimer = setTimeout(() => this.online && void this.fetchIce(), next * 1000);
    this.iceTimer.unref?.();
  }

  close(): void {
    this.closed = true;
    this.online = false;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.iceTimer);
    this.peer?.destroy();
    this.peer = undefined;
  }
}
