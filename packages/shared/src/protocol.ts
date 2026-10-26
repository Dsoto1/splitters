import type { MapDocument } from './map/schema.ts';
import type { PlayerInput } from './sim/movement.ts';
import type { MatchRules } from './sim/rules.ts';

/**
 * Wire protocol, version 1. JSON over WebSocket for Phase 0; the message shapes
 * are kept compact so a binary encoding can replace JSON after measurement
 * without changing gameplay code.
 */
export const PROTOCOL_VERSION = 2;

export type Tuple3 = [number, number, number];

export type ClientMessage =
  | { t: 'hello'; protocol: number; name: string; look?: string }
  | { t: 'input'; inputs: PlayerInput[] }
  | { t: 'ping'; id: number; ct: number }
  /** The client has loaded the map, everyone's characters and the weapons: it can start. */
  | { t: 'ready' };

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
  /** Held weapon code (see weaponCode; for third-person models and HUD). */
  w: number;
  /** Active powerups: bit 1 speed, bit 2 damage. */
  pu: number;
  /** Knockback / slide velocity (m/s), when non-zero. */
  vx?: number;
  vz?: number;
  /** Status effects (STATUS_* bits), when any. */
  fx?: number;
  /** Bot AI state for the debug overlay; absent for humans. */
  st?: string;
  /** Crouching (1) or prone (2); absent when standing. */
  sn?: 1 | 2;
  /** Dancing (emote). */
  em?: 1;
  /** Sprinting this tick. */
  sr?: 1;
  /** Classes: the player's class (index into CLASS_IDS). */
  cl?: number;
}

/** State only the owning player receives: inventory and timers for HUD and prediction. */
export interface PrivateState {
  /** Owned weapons as [weapon code, magazine, reserve, second-trigger rounds, heat % (heat weapons; 100+ = overheated)]. */
  inv: [number, number, number, number, number?][];
  /** Movement multiplier from status effects (slow, chill, frozen) ×1000, when not 1000. */
  ms?: number;
  /** Seated in a mount: [map entity index, seat, mounted gun heat %]. */
  mo?: [number, number, number];
  /** Carried grenades or mines as [index into THROWABLES, count]; absent = none. */
  gr?: [number, number];
  /** Ticks left on reload / weapon raise (0 = ready). */
  rl: number;
  rs: number;
  /** Remaining inputs of speed / damage boost. */
  sp: number;
  dm: number;
  /** Jetpack fuel units (see JET); absent without a jetpack. */
  jp?: number;
  /** Seconds of UAV sweep left for your side (enemies on the minimap). */
  uv?: number;
  /** Seconds your minimap stays jammed by an enemy Counter-UAV. */
  jm?: number;
  /** Your kill streak (kills since you last died), when above zero. */
  ks?: number;
  /** Stamina for sprinting, when not full: [stamina ×1000, rest ticks, winded 0/1]. */
  sta?: [number, number, number];
  /**
   * Classes: [class (index into CLASS_IDS), class asked for at the next spawn, ability 0-100 (charge, energy
   * or readiness), ability active 0/1, air jumps used + 4 while jump is held (for predicting double jumps)].
   */
  cl?: [number, number, number, number, number];
  /** Disc Arena: the power disc you hold (index into DISC_POWERS) and throws left. */
  dp?: [number, number];
}

export const STATUS_BURN = 1;
export const STATUS_POISON = 2;
export const STATUS_SLOW = 4;
export const STATUS_FROZEN = 8;
export const STATUS_CHILL = 16;
/** Not statuses, but carried in the same bits for drawing: jetpack firing, swimming. */
export const FX_JET = 32;
export const FX_SWIM = 64;
/** Classes: cloaked (drawn nearly invisible to enemies). */
export const FX_CLOAK = 128;
/** Classes: overcharged (can't be hurt for a few seconds). */
export const FX_OVERCHARGE = 256;

/**
 * A turret, sentry or vehicle: [map entity index, x, y, z, yaw, aim yaw, aim
 * pitch, health %, state bits (MOUNT_FLAG_ALIVE, MOUNT_FLAG_WRECK,
 * MOUNT_FLAG_BURNING; 0 = gone), ...occupant slot per seat (-1 = empty)]. A
 * sentry a player built (Classes) has index BUILT_MOUNT_BASE + their slot.
 */
export type MountSnapshot = number[];
/** Deployed cover (sandbags): [id, x, y (ground), z, yaw, health %]. */
export type CoverSnapshot = [number, number, number, number, number, number];

/** A ground hazard or field: [index into ZONE_KINDS, x, y, z, radius, seconds left]. */
export type ZoneSnapshot = [number, number, number, number, number, number];

export const POWERUP_SPEED_BIT = 1;
export const POWERUP_DAMAGE_BIT = 2;

export type GameEvent =
  /** One trigger pull: `to`/`hit` hold one entry per pellet (one for most weapons). */
  | { e: 'shot'; s: number; w: string; from: Tuple3; to: Tuple3[]; hit: (number | null)[]; /** Body zone per hit (0 body, 1 head, 2 legs), parallel to `hit`. */ z?: number[]; /** Second trigger. */ alt?: 1 }
  /** Chain lightning: the points it jumped through, from the muzzle on. */
  | { e: 'arc'; s: number; pts: Tuple3[] }
  /** Someone got into a seat (seat ≥ 0) or out of one (seat -1); `m` is the mount's map entity index. */
  | { e: 'mount'; s: number; m: number; seat: number }
  /** Someone threw a grenade or mine. */
  | { e: 'throw'; s: number }
  | { e: 'melee'; s: number; hit: number | null }
  /** `m`: a mount (map entity index) blowing up, drawn as a bigger, layered vehicle explosion. */
  | { e: 'explode'; s: number; p: Tuple3; r: number; m?: number }
  /** A vehicle hit something hard (another vehicle, a wreck, a turret, a person): `n` 0..1 how hard. */
  | { e: 'crash'; p: Tuple3; n: number }
  /** Disc Arena: `s`'s disc struck `t` and knocked them about (no damage). */
  | { e: 'knock'; s: number; t: number }
  | { e: 'pickup'; s: number; id: string; item: string }
  | { e: 'kill'; killer: number | null; victim: number; weapon: string; /** The killing blow was a head hit. */ hs?: 1 }
  | { e: 'spawn'; s: number }
  /** `outcome` is set when a co-op mission ends (victory or defeat). */
  | { e: 'round_end'; winner: number | null; outcome?: 'victory' | 'defeat'; /** Winning team (faction ID) in Team Deathmatch; null for a draw. */ team?: string | null }
  | { e: 'round_start' }
  // Objective modes. `team` is a team (faction) ID.
  /** Capture the Flag: `team`'s flag was taken, dropped, returned home or captured; `s` is who did it (null: it went home on its own). */
  | { e: 'flag'; a: FlagAction; team: string; s: number | null }
  /** King of the Hill: the hill moved to entity `i`, or `team` took it (null: nobody holds it, or it is contested). */
  | { e: 'hill'; a: 'move' | 'hold'; i: number; team: string | null }
  /** Elimination: `team` won round `round` (null: a draw), or round `round` started. */
  | { e: 'elim'; a: 'win' | 'start'; round: number; team: string | null }
  /** Bomb mode: picked up, dropped, planted (at site entity `i`), defused or exploded; `s` who did it (null: nobody). */
  /** Hostage Rescue: hostage `i` (index in ModeSnapshot.hg) started following `s`, was left behind, or was rescued. */
  | { e: 'hostage'; a: 'follow' | 'stop' | 'rescue'; i: number; s: number | null }
  | { e: 'bomb'; a: 'pickup' | 'drop' | 'plant' | 'defuse' | 'explode'; s: number | null; i?: number; p?: Tuple3 }
  // Scenario events. `i` is the entity's index in map.entities (or the objective's index in map.logic.objectives).
  /** Creator message from a logic rule. */
  | { e: 'msg'; text: string; secs: number }
  /** A medkit use: `s` healed `t` (maybe themselves) by `n`. */
  | { e: 'heal'; s: number; t: number; n: number }
  /** A quick message (QUICK_MESSAGES index + 1) from player `s`; team modes send it to their team only (`team`). */
  | { e: 'say'; s: number; m: number; team?: string }
  /** A ping from `s` at `p` (an enemy when `t` is set); team modes send it to their team only (`team`). */
  | { e: 'ping'; s: number; p: Tuple3; t?: number; team?: string }
  /** A kill-streak reward: `s` earned `r` (index into STREAK_REWARDS). */
  | { e: 'streak'; s: number; r: number }
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
 * faction (index into the map's factions), alive 0/1, held weapon code, body size (only when not 1)].
 */
export type NpcSnapshot = [number, number, number, number, number, number, number, number, number, 0 | 1, number, number?];

export const TRAP_ENABLED = 1;
export const TRAP_ACTIVE = 2;
export const TRAP_WARNING = 4;
/** A mine that has gone off and not rearmed yet. */
export const TRAP_SPENT = 8;

export interface ScoreEntry {
  s: number;
  k: number;
  d: number;
  /** Suicides (already taken off `k`); they don't count against the team. */
  x?: number;
}

export interface RosterEntry {
  slot: number;
  name: string;
  bot: boolean;
  /** Character look ID (CORE_LOOKS). */
  look: string;
  /** Team (faction ID) in Team Deathmatch; null otherwise. */
  team: string | null;
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

/**
 * `waiting`: the match is up but its players are still loading (see Match `startGate`);
 * `countdown`: everyone stands frozen at their spawn for a few seconds; then `playing`.
 */
export type MatchPhase = 'waiting' | 'countdown' | 'playing' | 'intermission';

export type FlagAction = 'take' | 'drop' | 'return' | 'capture';
export const FLAG_HOME = 0;
export const FLAG_CARRIED = 1;
export const FLAG_DROPPED = 2;

/**
 * State of an objective mode (Capture the Flag, King of the Hill,
 * Elimination). Team indices follow the match's team list (mapTeams).
 */
export interface ModeSnapshot {
  /** Team scores in team order: captures, hill seconds or rounds won. */
  ts: number[];
  /** Flags as [team index, state (FLAG_*), x, y, z, carrier slot (-1 none), seconds until it goes home (dropped)]. */
  fl?: [number, number, number, number, number, number, number][];
  /** The hill: [entity index, holder team index (-1 nobody, -2 contested), seconds until it moves]. */
  hl?: [number, number, number];
  /** Elimination: [round, seconds until the next round starts (0 while in play), ...players alive per team]. */
  el?: number[];
  /** Zombies: [wave, zombies left this wave, seconds until the next wave (0 during one), best wave]. */
  zb?: [number, number, number, number];
  /**
   * Bomb: [state (BOMB_*), x, y, z, carrier slot (-1 none), seconds left on the fuse (planted),
   * plant/defuse progress 0-100 (-1 none), who is planting/defusing (-1 none), site entity index (-1 none)].
   */
  bm?: [number, number, number, number, number, number, number, number, number];
  /** Hostage Rescue: per hostage [x, y, z, yaw, state (HOSTAGE_*), following slot (-1 none)]. */
  hg?: [number, number, number, number, number, number][];
  /**
   * Fort Wars: [phase (FORT_BUILD / FORT_COMBAT), seconds left in it, cycle (1-based), cycles,
   * points left per team (2), pieces per team (2), budget per team].
   */
  fo?: [number, number, number, number, number, number, number, number, number];
  /**
   * Fort Wars pieces as [id, kind (FORT_PIECE_KINDS index), team index, x, y, z (footprint centre, bottom), quarter turns, health %].
   * Sent when the pieces change (and every few seconds); absent means unchanged.
   */
  fp?: [number, number, number, number, number, number, number, number][];
}

export const HOSTAGE_WAITING = 0;
export const HOSTAGE_FOLLOWING = 1;
export const HOSTAGE_RESCUED = 2;

/** Bomb states in ModeSnapshot.bm. */
export const BOMB_CARRIED = 0;
export const BOMB_DROPPED = 1;
export const BOMB_PLANTED = 2;
export const BOMB_DEFUSED = 3;
export const BOMB_EXPLODED = 4;

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
      /** Live projectiles as [id, x, y, z, look (index into PROJECTILE_VISUALS)]. */
      pr: [number, number, number, number, number][];
      /** IDs of pickups currently taken (waiting to respawn). */
      pk: string[];
      /** Ground hazards and fields (oil, fire, toxic clouds, goo, singularities), when any. */
      zn?: ZoneSnapshot[];
      /** Turrets, sentries and vehicles, when the map has any. */
      mt?: MountSnapshot[];
      /** Deployed cover walls, when any stand (absent means none). */
      cv?: CoverSnapshot[];
      /** Receiving player's private state (absent while not in the match). */
      me?: PrivateState;
      /** Scenario state changes (absent when nothing changed). */
      sc?: ScenarioSnapshot;
      /** NPCs (living and recently dead). */
      np: NpcSnapshot[];
      /** Objective mode state (CTF, KOTH, Elimination). */
      md?: ModeSnapshot;
    }
  | { t: 'pong'; id: number; ct: number }
  | ({ t: 'stats' } & ServerStats);
