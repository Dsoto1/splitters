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
  /** Host commands and admin logins (dedicated servers; the host's own browser match runs them directly). */
  sendCommand?(msg: Extract<ClientMessage, { t: 'host' | 'admin' }>): void;
  close(): void;
}
