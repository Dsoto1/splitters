import type { ClientMessage, PlayerInput, ServerMessage } from '@tiletrigger/shared';

/**
 * Where a game session's match lives: a dedicated server over the network, or
 * an in-browser Match (MapMaker TEST, offline play). The session code is
 * identical for both; only the transport differs.
 */
export interface Transport {
  /** Human-readable origin for the HUD ("ws://…", "local"). */
  readonly label: string;
  rttMs: number;
  bytesIn: number;
  start(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void): void;
  sendInputs(inputs: PlayerInput[]): void;
  /** Everything for the match has loaded (the start countdown waits for it). */
  sendReady(): void;
  /** Spectate by choice (on) or join play again: only when the welcome said the host supports it (`spectate`). */
  sendSpectate?(on: boolean): void;
  /** Deliver snapshots waiting merged (SnapshotCoalescer) now: the session calls it as a frame begins. */
  flush?(): void;
  /** Host commands and admin logins (dedicated servers; the host's own browser match runs them directly). */
  sendCommand?(msg: Extract<ClientMessage, { t: 'host' | 'admin' }>): void;
  close(): void;
}

/** A friend's connection to a match this browser hosts (a data channel, or anything that moves text). */
export interface RemoteLink {
  send(text: string): void;
  /** The link carries a compressed stream (shared/net/peerZip.ts): the match host compresses, and hands over pieces for sendPieces. */
  readonly zip?: boolean;
  /** Pieces of the compressed stream, in order, as they go on the wire. */
  sendPieces?(pieces: Uint8Array[]): void;
  onMessage(cb: (text: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/**
 * The host side of player hosting: opens a join code and hands each friend's
 * connection to the match. Today PeerJS (peerLink.ts, the only file that
 * imports it); later the hub's own signaling (MULTIPLAYER_PROTOCOL.md
 * section 8) behind the same interface.
 */
export interface HostLink {
  /** The join code, once start() has resolved. */
  readonly code: string;
  /** Whether the hub gave this game relay credentials (friends on strict networks can connect). */
  readonly relay: boolean;
  /** Where friends' connections go; a map change points it at the next match (same code, friends rejoin). */
  admit: (link: RemoteLink) => void;
  /** Resolves with the join code once it is open. */
  start(): Promise<string>;
  close(): void;
}

/** How browsers find each other: hosting a code, and joining one. */
export interface Signaling {
  host(admit: (link: RemoteLink) => void): HostLink;
  join(code: string, name: string, look?: string): Transport;
}

/** The signaling in use, loaded on demand (offline play never downloads it). */
export async function loadSignaling(): Promise<Signaling> {
  return (await import('./peerLink.ts')).peerSignaling;
}
