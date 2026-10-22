import type { MapDocument } from './map/schema.ts';
import type { PlayerInput } from './sim/movement.ts';
import type { MatchRules } from './sim/rules.ts';

/**
 * Wire protocol, version 1. JSON over WebSocket for Phase 0; the message shapes
 * are kept compact so a binary encoding can replace JSON after measurement
 * without changing gameplay code.
 */
export const PROTOCOL_VERSION = 1;

export type Tuple3 = [number, number, number];

export type ClientMessage =
  | { t: 'hello'; protocol: number; name: string }
  | { t: 'input'; inputs: PlayerInput[] }
  | { t: 'ping'; id: number; ct: number };

export interface PlayerSnapshot {
  /** Slot index, 0..MAX_PLAYER_SLOTS-1. */
  s: number;
  p: Tuple3;
  vy: number;
  g: 0 | 1;
  yaw: number;
  pitch: number;
  hp: number;
  alive: 0 | 1;
  /** Bot AI state for the debug overlay; absent for humans. */
  st?: string;
}

export type GameEvent =
  | { e: 'shot'; s: number; from: Tuple3; to: Tuple3; hit: number | null }
  | { e: 'kill'; killer: number | null; victim: number; weapon: string }
  | { e: 'spawn'; s: number }
  | { e: 'round_end'; winner: number | null }
  | { e: 'round_start' };

export interface ScoreEntry {
  s: number;
  k: number;
  d: number;
}

export interface RosterEntry {
  slot: number;
  name: string;
  bot: boolean;
}

export interface ServerStats {
  /** Simulation tick cost over the last second. */
  tickMsAvg: number;
  tickMsMax: number;
  /** Portion of tick time spent in bot AI. */
  aiMsAvg: number;
  /** Mean serialised snapshot size. */
  snapshotBytes: number;
  /** Outbound bytes per second, averaged over connected clients. */
  bytesPerSecPerClient: number;
  humans: number;
  bots: number;
  /** Ticks the server fell behind schedule in the last second. */
  lateTicks: number;
}

export type MatchPhase = 'playing' | 'intermission';

export type ServerMessage =
  | {
      t: 'welcome';
      protocol: number;
      slot: number;
      maxSlots: number;
      tickRate: number;
      snapshotInterval: number;
      map: MapDocument;
      rules: MatchRules;
    }
  | { t: 'reject'; reason: string }
  | { t: 'roster'; players: RosterEntry[] }
  | {
      t: 'snapshot';
      /** Last input sequence the server applied for the receiving player. */
      ack: number;
      tick: number;
      phase: MatchPhase;
      /** Seconds left in the round (0 when untimed). */
      timeLeft: number;
      players: PlayerSnapshot[];
      score: ScoreEntry[];
      ev: GameEvent[];
    }
  | { t: 'pong'; id: number; ct: number }
  | ({ t: 'stats' } & ServerStats);
