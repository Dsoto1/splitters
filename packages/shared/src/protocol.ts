import type { MapDocument } from './map/schema.ts';
import type { PlayerInput } from './sim/movement.ts';
import type { GameMode, MatchRules } from './sim/rules.ts';
import type { MatchCheckpoint } from './net/handoff.ts';

/**
 * Wire protocol, version 1. JSON over WebSocket for Phase 0; the message shapes
 * are kept compact so a binary encoding can replace JSON after measurement
 * without changing gameplay code.
 */
export const PROTOCOL_VERSION = 4;

export type Tuple3 = [number, number, number];

export type ClientMessage =
  /** `admin`: a dedicated server's ADMIN_TOKEN (?admin=… in the page address): this player may run the match (HostCommand). */
  /**
   * `pk`: a random key per browser ("p_…", kept in its storage): not proof of anything, only what a guest
   * ban can hold on to. `ticket`: the hub's signed account ticket for this join code (signed-in players;
   * server/src/tickets.ts), so a host knows the account without seeing the player's sign-in token.
   */
  | { t: 'hello'; protocol: number; name: string; look?: string; admin?: string; pk?: string; ticket?: string }
  | { t: 'input'; inputs: PlayerInput[] }
  /** `rtt`: the sender's measured round trip (ms), shown on everyone's scoreboard. */
  | { t: 'ping'; id: number; ct: number; rtt?: number }
  /** The client has loaded the map, everyone's characters and the weapons: it can start. */
  | { t: 'ready' }
  /** Log in as the dedicated server's admin mid-match (pause menu → Server admin). */
  | { t: 'admin'; token: string }
  /** Run the match: only the host (offline, Host game) or a dedicated server's admin; anyone else gets an error. */
  | { t: 'host'; cmd: HostCommand }
  /** Host handoff: the friend the host asked to stand by has opened `code`, where it would host the match if the host went. */
  | { t: 'standby'; code: string };

/** Bot skills and styles a host can switch to mid-match. */
export const HOST_BOT_SKILLS = ['easy', 'normal', 'hard'] as const;
export const HOST_BOT_STYLES = ['mixed', 'arena', 'tactical'] as const;

/**
 * What whoever runs the match can do mid-match (pause menu → Match):
 * `bots` sets the players (free-for-all and co-op: everyone, you included;
 * team modes: per team), bot skill and style, live; `map` travels to another
 * map (servers and Host game: a map of our suite, by ID) in `mode`
 * (default: the current one, else the map's own); `restart` starts the match
 * over; `end` ends it now, to the scoreboard.
 */
export type HostCommand =
  /** `teamSizes`: every team's own size (uneven teams); `teamSize`: every team the same size. */
  | { c: 'bots'; fill?: number; teamSize?: number; teamSizes?: number[]; skill?: (typeof HOST_BOT_SKILLS)[number]; style?: (typeof HOST_BOT_STYLES)[number] }
  /** Rules that take effect when the match restarts (Restart match applies them). */
  | { c: 'rules'; rules: HostRulesPatch }
  | { c: 'map'; map: string; mode?: GameMode }
  | { c: 'restart' }
  | { c: 'end' }
  /** Remove a player (not a bot) from the match; they may rejoin. */
  | { c: 'kick'; slot: number; reason?: string }
  /** Remove a player and keep them out: their account when signed in, else their browser key and address (weak). `minutes`: 0 or absent, for good. */
  | { c: 'ban'; slot: number; minutes?: number; reason?: string };

/** Commands about one player (kick, ban): the host's connections handle them, not the match. */
export type PlayerCommand = Extract<HostCommand, { c: 'kick' | 'ban' }>;
/** Commands the match itself runs (HostControl). */
export type MatchCommand = Exclude<HostCommand, { c: 'map' } | PlayerCommand>;

/** Rules a host can change mid-match; they wait for the next restart. */
export interface HostRulesPatch {
  scoreLimit?: number;
  timeLimitSeconds?: number;
  friendlyFire?: 'off' | 'half' | 'on';
  respawnDelayTicks?: number;
}

/** The match's host settings, for the pause menu of whoever runs it. */
export interface HostState {
  /** Team modes: every team's size, name and colour, in team order (empty otherwise). */
  sizes?: number[];
  teamNames?: string[];
  teamColors?: string[];
  /** The restart-only rules as they play now, and any change waiting for the restart. */
  rules?: Required<HostRulesPatch>;
  pending?: HostRulesPatch;
  /** Players to keep, bots included (team modes: teams × teamSize). */
  fill: number;
  /** Team modes: players per team (the largest team, when they differ); null otherwise. */
  teamSize: number | null;
  /** Teams in play (0 outside team modes). */
  teams: number;
  /** Most players the match can hold. */
  max: number;
  skill: (typeof HOST_BOT_SKILLS)[number];
  style: (typeof HOST_BOT_STYLES)[number];
  /** The current map (ID) and mode. */
  map: string;
  mode: GameMode;
}

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
  /** Under an open canopy: parachute (1) or glider (2). */
  ch?: 1 | 2;
  /** The parachute's automatic opener is armed (jumped out of the plane or a flyer). */
  dr?: 1;
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
  /** The reload in progress: [kind (RELOAD_KINDS index), inputs into it, total, stage reached], for prediction. */
  rd?: [number, number, number, number];
  /** Weapon codes with a magazine in but no round chambered (an empty reload stopped early). */
  uc?: number[];
  /** Remaining inputs of speed / damage boost. */
  sp: number;
  dm: number;
  /** Jetpack fuel units (see JET); absent without a jetpack. */
  jp?: number;
  /** Carrying a glider (canopies open as gliders). */
  gl?: 1;
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
  | {
      e: 'shot'; s: number; w: string; from: Tuple3; to: Tuple3[]; hit: (number | null)[]; /** Body zone per hit (0 body, 1 head, 2 legs), parallel to `hit`. */ z?: number[]; /** Second trigger. */ alt?: 1;
      /** Ballistic bullets: muzzle speed (m/s) and gravity (m/s²) they fly with, for client tracers. */ v?: number; g?: number;
      /** Pellet indices still in flight (their `to` is where they were when this was sent; an `impact` event follows). */ fl?: number[];
      /** A hit landed on armor. */ ar?: 1;
      /** Surfaces rounds went through or glanced off (drawn as impacts). */ pn?: Tuple3[];
    }
  /** A bullet that was in flight landed: on a player (`hit`), a surface, or nowhere (`gone`, out of range). */
  | { e: 'impact'; s: number; w: string; from: Tuple3; to: Tuple3; hit: number | null; z?: number; ar?: 1; pn?: Tuple3[]; gone?: 1 }
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
  | { e: 'round_end'; winner: number | null; outcome?: 'victory' | 'defeat'; /** Winning team (faction ID) in Team Deathmatch; null for a draw. */ team?: string | null; /** "Next map" logic: the suite map ID everyone goes on to. */ next?: string }
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
  /** Race: `s` passed checkpoint `n`, started lap `n`, finished in place `n` (`t` race time in ms), set a best lap (`t` ms), or the start was given (`s` -1). */
  | { e: 'race'; a: 'gate' | 'lap' | 'finish' | 'best' | 'go'; s: number; n: number; t?: number }
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
  /** Bulletproof glass at scenario index `i` took a hit and cracked further (sim/glass.ts). */
  | { e: 'crack'; i: number }
  /** A player pressed a button, or was refused (locked door, disabled button). */
  | { e: 'use'; s: number; i: number; ok: 0 | 1 }
  /** Team leaders: `s` now leads `team` ('lead'), or `team`'s leader went down ('down'; Leader variant: `n` points to the killer's side). */
  | { e: 'leader'; a: 'lead' | 'down'; s: number; team: string; n?: number }
  /** A player `to` joined mid-match in slot `s`, replacing the bot `from` (removed to make room; the player spawns normally); or, with `bot`, the bot `to` took over for `from`, a player who left, where they stood. */
  | { e: 'takeover'; s: number; from: string; to: string; bot?: 1 };

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
  /** Objective plays: flag captures, bomb plants and defuses, hostage rescues (only when > 0). */
  o?: number;
}

export interface RosterEntry {
  slot: number;
  name: string;
  bot: boolean;
  /** Character look ID (CORE_LOOKS). */
  look: string;
  /** Team (faction ID) in Team Deathmatch; null otherwise. */
  team: string | null;
  /** A signed-in player whose name is their username (checked by the host: account ticket). Other people are guests. */
  acct?: 1;
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
  /** Race (see RaceSnapshot). */
  rc?: RaceSnapshot;
}

/**
 * Race state: `st` 0 on the grid (countdown), 1 racing, 2 the leader has
 * finished (the rest have a little longer); `cd` seconds of countdown left;
 * `t` race time in ms; `laps` to run; `combat` 1 when weapons are on. Per
 * racer (in race order): [slot, lap (1-based), next checkpoint, finish time
 * ms (-1 still racing), best lap ms (-1 none yet), current lap time ms,
 * going the wrong way (0/1), respawning (0/1)].
 */
export interface RaceSnapshot {
  st: number;
  cd: number;
  t: number;
  laps: number;
  combat: number;
  r: [number, number, number, number, number, number, number, number][];
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
      /** Dedicated servers: their LAN join addresses (ws://192.168.…:7777), for the pause menu to share. */
      lan?: string[];
      /**
       * A dedicated server or Host Service (not a player's browser): it may have an admin
       * (ADMIN_TOKEN), so the pause menu offers the Server admin login, also to players who joined by code.
       */
      dedicated?: boolean;
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
      /**
       * Players. On the wire (protocol 4) others may come as changes since the copy last sent on this
       * connection (PlayerDelta, net/interest.ts); the receiving transport rebuilds them (SnapshotDecoder)
       * before anything reads the snapshot.
       */
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
      /**
       * Interest management (big matches): players left out of this snapshot
       * because they are far from the receiver. They are still in the match:
       * keep drawing them from the snapshots that had them (see net/interest.ts).
       */
      hold?: number[];
      /** Team leaders (rules.leaders): each team's leader slot, in team order (-1: none). */
      ld?: number[];
    }
  | { t: 'pong'; id: number; ct: number }
  /** Online: each human's round trip for the scoreboard, as flat [slot, ms, slot, ms, …] (every couple of seconds). */
  | { t: 'pings'; p: number[] }
  /** The server is changing map (a scenario chain, or its host changed it): reconnect in a moment to play `map` (its display name). */
  | { t: 'travel'; map: string }
  /** You run this match (HostCommand): its settings now (`state`), or why a command was refused (`error`; `state` null when you may not run it). */
  | { t: 'host'; state: HostState | null; error?: string }
  /** A line for everyone's feed and a toast: what the host changed ("Host set teams to 8v8"). */
  | { t: 'notice'; text: string }
  /**
   * A browser host is leaving on purpose (left the match, closed the tab): the link closes next. Friends
   * know it wasn't a network drop, so they don't wait to reconnect (MULTIPLAYER_PROTOCOL.md, "Host leaves").
   */
  | { t: 'bye' }
  /** Host handoff (browser hosts, net/handoff.ts): you are asked to stand by as successor: open a join code and answer with it (ClientMessage standby). */
  | { t: 'standby' }
  /**
   * Host handoff: who takes the match over if the host goes, and the join code they'll host it on (to everyone,
   * whenever it changes; `code` '' when there's no successor). Only a code named here is ever followed.
   */
  | { t: 'successor'; code: string; slot?: number; name?: string }
  /** Host handoff: the match as it stands, to the successor only, every few seconds. */
  | { t: 'checkpoint'; cp: MatchCheckpoint }
  | ({ t: 'stats' } & ServerStats);
