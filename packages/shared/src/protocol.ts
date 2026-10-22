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
  /** Armor points. */
  ar: number;
  alive: 0 | 1;
  /** Held weapon slot (for third-person models and HUD). */
  w: number;
  /** Active powerups: bit 1 speed, bit 2 damage. */
  pu: number;
  /** Bot AI state for the debug overlay; absent for humans. */
  st?: string;
}

/** State only the owning player receives: inventory and timers for HUD and prediction. */
export interface PrivateState {
  /** Owned weapons as [slot, magazine, reserve]. */
  inv: [number, number, number][];
  /** Ticks left on reload / weapon raise (0 = ready). */
  rl: number;
  rs: number;
  /** Remaining inputs of speed / damage boost. */
  sp: number;
  dm: number;
}

export const POWERUP_SPEED_BIT = 1;
export const POWERUP_DAMAGE_BIT = 2;

export type GameEvent =
  /** One trigger pull: `to`/`hit` hold one entry per pellet (one for most weapons). */
  | { e: 'shot'; s: number; w: string; from: Tuple3; to: Tuple3[]; hit: (number | null)[] }
  | { e: 'melee'; s: number; hit: number | null }
  | { e: 'explode'; s: number; p: Tuple3; r: number }
  | { e: 'pickup'; s: number; id: string; item: string }
  | { e: 'kill'; killer: number | null; victim: number; weapon: string }
  | { e: 'spawn'; s: number }
  /** `outcome` is set when a co-op mission ends (victory or defeat). */
  | { e: 'round_end'; winner: number | null; outcome?: 'victory' | 'defeat' }
  | { e: 'round_start' }
  // Scenario events. `i` is the entity's index in map.entities (or the objective's index in map.logic.objectives).
  /** Creator message from a logic rule. */
  | { e: 'msg'; text: string; secs: number }
  /** Sound cue from a logic rule (alarm, chime, buzzer, boom); positionless. */
  | { e: 'cue'; cue: string }
  /** Objective changed state (index into OBJECTIVE_STATES). */
  | { e: 'obj'; i: number; st: number }
  /** A trap fired (or a proximity trap started its warning when `warn` is set). */
  | { e: 'trap'; i: number; warn?: 1 }
  | { e: 'door'; i: number; open: 0 | 1 }
  /** A destructible broke. */
  | { e: 'broken'; i: number }
  /** A player pressed a button, or was refused (locked door, disabled button). */
  | { e: 'use'; s: number; i: number; ok: 0 | 1 };

/**
 * Scenario state. Sent as a delta (only what changed since the previous
 * snapshot) plus a full keyframe every couple of seconds; the welcome message
 * carries a full copy.
 */
export interface ScenarioSnapshot {
  /** Entity states as [entity index, a, b]. door: open 0..100, locked; button: enabled, lit; destructible: health %, 0;
   *  zone: enabled, players inside; trap: flags (TRAP_* bits), 0. */
  es?: [number, number, number][];
  /** Every objective's state (index into OBJECTIVE_STATES), when any changed. */
  ob?: number[];
  /** Visible running timers as [timer index, seconds left], when the list changed. */
  tm?: [number, number][];
}

/**
 * One NPC: [actor id, x, y, z, yaw, pitch, health %, role (index into NPC_ROLES),
 * faction (index into the map's factions), alive 0/1, held weapon slot].
 */
export type NpcSnapshot = [number, number, number, number, number, number, number, number, number, 0 | 1, number];

export const TRAP_ENABLED = 1;
export const TRAP_ACTIVE = 2;
export const TRAP_WARNING = 4;
/** A mine that has gone off and not rearmed yet. */
export const TRAP_SPENT = 8;

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
      /** Full scenario state at join time. */
      sc?: ScenarioSnapshot;
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
      /** Live projectiles as [id, x, y, z]. */
      pr: [number, number, number, number][];
      /** IDs of pickups currently taken (waiting to respawn). */
      pk: string[];
      /** Receiving player's private state (absent while not in the match). */
      me?: PrivateState;
      /** Scenario state changes (absent when nothing changed). */
      sc?: ScenarioSnapshot;
      /** NPCs (living and recently dead). */
      np: NpcSnapshot[];
    }
  | { t: 'pong'; id: number; ct: number }
  | ({ t: 'stats' } & ServerStats);
