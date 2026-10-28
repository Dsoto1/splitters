import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  KeyedLimiter,
  MessageGuard,
  BOT_DIFFICULTIES,
  rulesForMap,
  rulesForMode,
  mapCanRun,
  MODE_LABELS,
  MAX_PLAYER_SLOTS,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_RATE,
  encodeSnapshots,
  SnapshotStream,
  initPhysics,
  loadMap,
  parseClientMessage,
  sanitizeName,
  isMapId,
  playlistNext,
  rulesForTravel,
  travelNotice,
  type BotDifficulty,
  type HostCommand,
  type CarryOver,
  type Playlist,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type GameMode,
  type ServerInfo,
  type ServerMessage,
  type ServerStats,
} from '@tiletrigger/shared';
import { AWAY, BotFiller, HostControl, Match, initNavigation, validateNavigation } from '@tiletrigger/shared/match';
import { answerDiscovery, lanAddresses } from './lan.ts';
import { StatsWindow } from './stats.ts';

export interface ServerOptions {
  /** WebSocket/HTTP port (0: any free one), or null for no listener: players arrive through `accept` (the Host Service's WebRTC links). */
  port: number | null;
  host?: string;
  /** People (not bots) who may play at once (default MAX_PLAYER_SLOTS): a home upload carries every player's stream. */
  maxPlayers?: number;
  /** Idle this many seconds and a bot plays for you until you're back (default AWAY.afkSeconds; 0: never). */
  afkSeconds?: number;
  /** Away for being idle this many minutes, still connected: removed from the match (default AWAY.kickMinutes; 0: never). */
  idleKickMinutes?: number;
  /** Map file path or an already-parsed document. */
  map: string | MapDocument;
  /** Fill the match with Player Bots up to this many total players (players joining take over bots). */
  botFill: number;
  /** When a player leaves, a bot takes over where they were (default on); off, a fresh bot spawns instead. */
  botTakeBack?: boolean;
  /** Team leaders (team modes): true, or 'vip' for the Leader variant (see MatchRules.leaders). */
  leaders?: boolean | 'vip';
  botDifficulty?: BotDifficulty['id'];
  rules?: MatchRules;
  /** Play this mode with its default rules (ignored when `rules` is given); default: the map's first mode. */
  mode?: GameMode;
  seed?: number;
  /** Hold the start until the first players have loaded, then count down (default on; tests turn it off). */
  startGate?: boolean;
  /** Called once per second with instrumentation. */
  onStats?: (line: string, stats: ServerStats) => void;
  /** Server name in LAN discovery and /info (default "<map> server"). */
  name?: string;
  /**
   * Scenario chains: play these maps in order, each once the one before is won
   * (the server starts on the playlist's first map; `map` is then ignored).
   */
  playlist?: Playlist;
  /** Our suite (where "Next map" and playlist IDs are looked up): default the repo's maps/ folder. */
  mapsDir?: string;
  /** Answer LAN discovery broadcasts (UDP, LAN_DISCOVERY_PORT unless a port is given). Off by default; main.ts turns it on. */
  lanDiscovery?: boolean | number;
  /**
   * ADMIN_TOKEN: a player who joins with it (?admin=… or pause menu → Server
   * admin) runs the match: bots, map (our suite only), restart, end. Unset: nobody can.
   */
  adminToken?: string;
  /** Who may not join (a ban list): the reason to turn them away, or null. Checked at every hello. */
  admission?: (who: PlayerIdentity) => string | null;
  /** An admin banned a player (in-game or console): the ban list's owner records it (the player is then kicked). */
  onBan?: (who: PlayerIdentity, minutes: number, reason: string, by: string) => void;
  /** Checks a hello's account ticket (tickets.ts) for this server's join code: the account (Cognito sub), or null. */
  verifyTicket?: (ticket: string) => { sub: string; name?: string } | null;
  /** Joins, leaves, kicks, bans, admin changes and match results, as lines for a server console. */
  onEvent?: (line: string) => void;
}

/** What a server knows of who a player is (for bans). Only `sub` is proof (a hub-signed ticket); `pk` and `address` are best effort. */
export interface PlayerIdentity {
  name: string;
  /** Cognito account, from a verified ticket. */
  sub?: string;
  /** The browser's random key (hello.pk). */
  pk?: string;
  /** The player's address, when the link is direct (not relayed). */
  address?: string;
}

/** One person in the match, for a console or admin page. */
export interface PlayerInfo extends PlayerIdentity {
  slot: number;
  team: string | null;
  kills: number;
  deaths: number;
  ping: number | null;
  admin: boolean;
}

/**
 * One player's connection, whatever carries it: a WebSocket (this server's own
 * listener) or a WebRTC data channel (the Host Service, packages/host). Text
 * messages in both directions; the transport handles compression and size caps.
 */
export interface PlayerConn {
  /** Send one message. Returns the bytes it put on the wire, when it knows (a compressed link), for the stats. */
  send(text: string): number | void;
  /** Close the link; a message sent just before should still arrive. */
  close(code: number, reason: string): void;
  onMessage(cb: (text: string) => void): void;
  onClose(cb: () => void): void;
  /** The player's address when known and direct (a WebSocket's peer, a WebRTC link's non-relay candidate). */
  address?(): string | undefined;
}

export interface RunningServer {
  /** The listener's port (0 without one). */
  port: number;
  /** Take a player's connection (the same join flow, limits and admin rules as the WebSocket listener's). */
  accept(conn: PlayerConn): void;
  /** The running match (a new one after a scenario chain moves on to the next map). */
  readonly match: Match;
  /** What /info and LAN discovery say about this server right now. */
  info(): ServerInfo;
  /** A line for every player's feed and a toast ("The server is shutting down"). */
  notice(text: string): void;
  /** People in the match now. */
  players(): PlayerInfo[];
  /** Run an admin command for `by` (a console, the /host page): the same commands in-game admins have. Returns the error, or null. */
  command(cmd: HostCommand, by: string): string | null;
  /** A new ADMIN_TOKEN from now on (undefined: nobody new can log in). */
  setAdminToken(token: string | undefined): void;
  close(): Promise<void>;
}

interface Client {
  conn: PlayerConn;
  slot: number | null;
  /** Delta snapshots: what this connection was last sent of each player (net/interest.ts). */
  stream: SnapshotStream;
  bytesOut: number;
  /** Logged in with the server's ADMIN_TOKEN: may run the match (HostCommand). */
  admin: boolean;
  /** Wrong admin tokens so far (the connection closes after a few). */
  badTokens: number;
  /** The round trip the client last reported (ms), for everyone's scoreboard. */
  rtt?: number;
  /** Message budget (MESSAGE_RATE): over it, messages are dropped; well over it, the client is disconnected. */
  guard: MessageGuard;
  who?: PlayerIdentity;
  /** When this connection last sent anything (ms): a silent one is closed (SILENT_MS). */
  heardAt: number;
  /** Kicked or banned: their place isn't kept for them. */
  gone?: boolean;
}

/**
 * A connection that sends nothing this long is closed (a phone that went to
 * sleep, a dead network): the player's place is kept for them (AWAY.holdSeconds)
 * and their next connection takes it back. A playing client sends inputs every
 * frame and pings every second.
 */
const SILENT_MS = 20_000;

/**
 * Limits on who can come in (on top of the hub's: broker sockets and joins per
 * address, relay credentials; MULTIPLAYER_SECURITY.md): one network or one
 * browser can't fill a server, and a burst of joins is refused.
 */
export const JOIN_LIMITS = {
  /** People playing from one address (when the link is direct; relayed links are counted by browser instead). */
  perAddress: 4,
  /** Join attempts per address (else per browser) per minute, and in all. */
  perMinute: 10,
  totalPerMinute: 60,
  /** Connections that haven't said hello yet (each has HELLO_TIMEOUT_MS to). */
  pending: 64,
} as const;

/** Who a player is, for taking back a kept place: their account, else their browser's key. */
const awayKey = (who: PlayerIdentity | undefined): string | null => (who?.sub ? `sub:${who.sub}` : who?.pk ? `pk:${who.pk}` : null);

/** Wrong admin tokens a connection may send before it is closed. */
const MAX_BAD_TOKENS = 5;
/** Ticks between a host's map change and the travel (time for the notice to reach everyone). */
const HOST_TRAVEL_TICKS = 45;

const HELLO_TIMEOUT_MS = 5000;

/**
 * Dedicated authoritative game server: owns the Match, accepts WebSocket
 * clients, applies their inputs, and broadcasts snapshots. Production online
 * play never trusts a browser as host (MASTER_SPEC_V2 §3.3).
 */
export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  await Promise.all([initPhysics(), initNavigation()]);

  const mapsDir = opts.mapsDir ?? fileURLToPath(new URL('../../../maps/', import.meta.url));
  /** A map of our suite by ID, or null: only files in the suite folder, never a path. */
  const suiteMap = (id: string): MapDocument | null => {
    const file = join(mapsDir, `${id}.json`);
    if (!isMapId(id) || !existsSync(file)) return null;
    try {
      return readMapFile(file);
    } catch {
      return null;
    }
  };
  let playIndex = 0;
  const first = opts.playlist ? suiteMap(opts.playlist.maps[0]!.map) : null;
  if (opts.playlist && !first) throw new Error(`playlist ${opts.playlist.id}: map ${opts.playlist.maps[0]!.map} is not in our suite`);
  let map = first ?? (typeof opts.map === 'string' ? readMapFile(opts.map) : opts.map);
  if (opts.mode && !opts.rules && !mapCanRun(map, opts.mode)) throw new Error(`${map.metadata.name} can't host ${MODE_LABELS[opts.mode]} (it has no flag bases or hills for it)`);
  /** Rules for a chain's map: the playlist entry's mode, else co-op where the map has it, else the map's own. */
  const chainRules = (m: MapDocument, mode?: GameMode): MatchRules => {
    const want = mode ?? (mapCanRun(m, 'core.coop') ? 'core.coop' : undefined);
    return want && mapCanRun(m, want) ? rulesForMode(m, want) : rulesForMap(m);
  };
  const baseRules = first ? chainRules(first, opts.playlist!.maps[0]!.mode) : (opts.rules ?? (opts.mode ? rulesForMode(map, opts.mode) : rulesForMap(map)));
  const withLeaders = (r: MatchRules): MatchRules => (opts.leaders ? { ...r, leaders: opts.leaders } : r);
  let match = new Match(map, withLeaders(baseRules), opts.seed ?? Date.now() % 100000, { startGate: opts.startGate ?? true });
  for (const issue of validateNavigation(map, match.nav)) console.warn(`[map] ${issue.severity}: ${issue.message}`);
  const botFill = Math.min(opts.botFill, MAX_PLAYER_SLOTS);

  const clients = new Set<Client>();
  const stats = new StatsWindow();
  let pendingEvents: GameEvent[] = [];
  let bots = new BotFiller(match, BOT_DIFFICULTIES[opts.botDifficulty ?? 'normal'], { takeBack: opts.botTakeBack });
  /** Players to keep (bots included), bot skill and style: the admin can change them mid-match (HostControl). */
  let control = new HostControl(match, bots, botFill, 'Admin');
  /** Scenario chains: what each player (by name) takes into the next map, until they rejoin. */
  let carried = new Map<string, CarryOver>();
  /** A won map with somewhere to go: travel at this tick (late in the intermission). */
  let travel: { atTick: number; map: MapDocument; rules: MatchRules; index: number; carry: { score: boolean; loadout: boolean }; fill?: number } | null = null;
  /** The token compared in constant time (as hashes, so lengths don't matter). */
  let adminHash = opts.adminToken ? createHash('sha256').update(opts.adminToken).digest() : null;
  const isAdminToken = (token: string | undefined) => !!adminHash && !!token && timingSafeEqual(adminHash, createHash('sha256').update(token).digest());

  const send = (c: Client, msg: ServerMessage | string) => {
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
    c.bytesOut += c.conn.send(data) ?? data.length;
  };
  const broadcast = (msg: ServerMessage) => {
    const data = JSON.stringify(msg);
    for (const c of clients) if (c.slot !== null) send(c, data);
  };

  /** Keep humans + bots at the fill target: bots leave when humans join and return when they go. */
  bots.rebalance(control.fill);
  const hostState = (c: Client) => send(c, { t: 'host', state: control.state() });
  const notice = (text: string) => {
    console.log(`[admin] ${text}`);
    broadcast({ t: 'notice', text });
  };
  const event = (line: string) => opts.onEvent?.(line);
  const clientAt = (slot: number) => [...clients].find((c) => c.slot === slot);
  /** Remove a player: they are told why, their place goes back to a bot. */
  const kick = (target: Client, reason: string) => {
    target.gone = true;
    send(target, { t: 'reject', reason });
    target.conn.close(4003, 'kicked');
  };
  /** Any admin's command (in-game, console, /host): run it and tell everyone what changed. Returns the error, or null. */
  const runCommand = (cmd: HostCommand, by: string): string | null => {
    if (cmd.c === 'map') {
      const m = suiteMap(cmd.map);
      if (!m) return `"${cmd.map}" is not a map of our suite`;
      if (travel) return 'Already changing map';
      const next = rulesForTravel(match.rules, m, control.fill, cmd.mode, control.state().teamSize);
      travel = { atTick: match.tick + HOST_TRAVEL_TICKS, map: m, rules: next.rules, index: playIndex, carry: { score: false, loadout: false }, fill: next.fill };
      notice(travelNotice(m.metadata.name, next.rules.mode));
      return null;
    }
    if (cmd.c === 'kick' || cmd.c === 'ban') {
      const target = clientAt(cmd.slot);
      if (!target?.who) return 'No such player (bots come and go by themselves: change the players instead)';
      const why = cmd.reason ? `: ${cmd.reason}` : '';
      if (cmd.c === 'ban') {
        opts.onBan?.(target.who, cmd.minutes ?? 0, cmd.reason ?? '', by);
        event(`${by} banned ${target.who.name}${cmd.minutes ? ` for ${cmd.minutes} min` : ''}${why}`);
        kick(target, `You were banned from this server${why}`);
      } else {
        event(`${by} kicked ${target.who.name}${why}`);
        kick(target, `You were kicked by the admin${why}`);
      }
      notice(`${target.who.name} was ${cmd.c === 'ban' ? 'banned' : 'kicked'}`);
      return null;
    }
    const r = control.apply(cmd);
    if (r.error) return r.error;
    if (r.notice) notice(r.notice);
    broadcast({ t: 'roster', players: match.roster() });
    for (const c of clients) if (c.admin && c.slot !== null) hostState(c);
    return null;
  };
  /** An in-game admin's command. */
  const hostCommand = (client: Client, cmd: HostCommand) => {
    if (!client.admin) return send(client, { t: 'host', state: null, error: adminHash ? 'Only the server admin can change the match (pause menu → Server admin)' : 'This server has no admin (ADMIN_TOKEN is not set)' });
    if ((cmd.c === 'kick' || cmd.c === 'ban') && cmd.slot === client.slot) return send(client, { t: 'host', state: control.state(), error: "You can't kick yourself" });
    const error = runCommand(cmd, `Admin ${client.who?.name ?? ''}`.trim());
    if (error) return send(client, { t: 'host', state: control.state(), error });
  };

  let stopped = false;
  /** Humans playing now (not bots). */
  const humans = () => [...clients].filter((c) => c.slot !== null).length;
  const joinsBy = new KeyedLimiter({ perMinute: JOIN_LIMITS.perMinute, burst: JOIN_LIMITS.perMinute });
  const joinsAll = new KeyedLimiter({ perMinute: JOIN_LIMITS.totalPerMinute, burst: JOIN_LIMITS.totalPerMinute });
  const maxPlayers = Math.max(1, Math.min(opts.maxPlayers ?? MAX_PLAYER_SLOTS, MAX_PLAYER_SLOTS));

  /** A player's connection, from the WebSocket listener or the Host Service's WebRTC links: hello, then play. */
  function accept(conn: PlayerConn): void {
    if (stopped) return conn.close(1001, 'server stopping');
    if ([...clients].filter((c) => c.slot === null).length >= JOIN_LIMITS.pending) return conn.close(4005, 'busy');
    const client: Client = { conn, slot: null, stream: new SnapshotStream(), bytesOut: 0, admin: false, badTokens: 0, guard: new MessageGuard(), heardAt: Date.now() };
    clients.add(client);
    const helloTimer = setTimeout(() => conn.close(4000, 'hello timeout'), HELLO_TIMEOUT_MS);

    conn.onMessage((text) => {
      if (!clients.has(client)) return;
      client.heardAt = Date.now();
      // A flood (a ping or input spam) is dropped, and a client that keeps it up is disconnected.
      const verdict = client.guard.check();
      if (verdict === 'kick') return void conn.close(4008, 'too many messages');
      if (verdict === 'drop') return;
      const msg = parseClientMessage(text);
      if (!msg) return;
      if (msg.t === 'hello') {
        if (client.slot !== null) return;
        clearTimeout(helloTimer);
        if (msg.protocol !== PROTOCOL_VERSION) {
          send(client, { t: 'reject', reason: `protocol ${msg.protocol} unsupported (server speaks ${PROTOCOL_VERSION})` });
          conn.close(4001, 'protocol');
          return;
        }
        // The host's own cap on people (its upload carries every player's stream); bots fill the rest.
        if (humans() >= maxPlayers) {
          send(client, { t: 'reject', reason: `server full (${maxPlayers} players)` });
          conn.close(4002, 'full');
          return;
        }
        // Signed in with a username: that's their name here, as a verified account. Everyone else plays as a guest under the name they typed.
        const proof = msg.ticket ? (opts.verifyTicket?.(msg.ticket) ?? null) : null;
        const sub = proof?.sub;
        const name = proof?.name ?? sanitizeName(msg.name);
        const address = conn.address?.();
        const who: PlayerIdentity = { name, ...(sub ? { sub } : {}), ...(msg.pk ? { pk: msg.pk } : {}), ...(address ? { address } : {}) };
        // One network, one browser: a few joins a minute, a few people at once; and not too many joins in all.
        // This computer (tests, players on the server's own machine) isn't a network to limit.
        const own = !!address && /^(127\.|::1$|::ffff:127\.)/.test(address);
        const by = address && !own ? address : msg.pk ? `pk:${msg.pk}` : null;
        const refuse = (reason: string, code: number) => {
          event(`refused ${name}: ${reason}`);
          send(client, { t: 'reject', reason });
          conn.close(code, 'limit');
        };
        if (!joinsAll.allow('all') || (by !== null && !joinsBy.allow(by))) return refuse('Too many people are joining right now: try again in a minute', 4011);
        if (address && !own && [...clients].filter((c) => c !== client && c.slot !== null && c.who?.address === address).length >= JOIN_LIMITS.perAddress) {
          return refuse(`At most ${JOIN_LIMITS.perAddress} players from one network`, 4012);
        }
        // The same browser (or account) again: this connection replaces the old one (a reconnect after a drop the server
        // hasn't noticed yet), so one browser never holds two places; the old place is kept for this connection to take back.
        const key0 = awayKey(who);
        const old = key0 ? [...clients].find((c) => c !== client && c.slot !== null && awayKey(c.who) === key0) : undefined;
        if (old) {
          clients.delete(old);
          bots.hold(old.slot!, 'dropped', key0, control.fill);
          old.conn.close(4010, 'replaced by a new connection');
        }
        const banned = opts.admission?.(who);
        if (banned) {
          event(`refused ${name}${sub ? ' (signed in)' : ''}: ${banned}`);
          send(client, { t: 'reject', reason: banned });
          conn.close(4004, 'banned');
          return;
        }
        // Back after a dropped connection: their kept place (a bot was playing it). Else take over a bot
        // where it stands (team that needs a player), or a free slot.
        const key = awayKey(who);
        const back = key ? bots.reclaim(key, name) : null;
        const player = back ?? bots.join(name, msg.look, control.fill);
        if (!player) {
          send(client, { t: 'reject', reason: 'server full' });
          conn.close(4002, 'full');
          return;
        }
        client.slot = player.slot;
        client.who = who;
        player.account = !!proof?.name;
        event(`${name} ${back ? 'is back' : 'joined'} (${sub ? 'signed in' : 'guest'}${address ? `, ${address}` : ''}) as slot ${player.slot}`);
        if (back) notice(`${name} is back`);
        // Back from a map change: pick up your score and weapons.
        const carry = back ? undefined : carried.get(player.name);
        if (carry) {
          match.applyCarry(player, carry);
          carried.delete(player.name);
        }
        send(client, {
          t: 'welcome',
          protocol: PROTOCOL_VERSION,
          slot: player.slot,
          maxSlots: MAX_PLAYER_SLOTS,
          tickRate: TICK_RATE,
          snapshotInterval: SNAPSHOT_INTERVAL_TICKS,
          map,
          rules: match.rules,
          sc: match.scenario.fullState(),
          dedicated: true,
          ...(lan.length ? { lan } : {}),
        });
        broadcast({ t: 'roster', players: match.roster() });
        client.admin = isAdminToken(msg.admin);
        if (client.admin) hostState(client);
      } else if (msg.t === 'admin' && client.slot !== null) {
        if (isAdminToken(msg.token)) {
          client.admin = true;
          hostState(client);
        } else {
          send(client, { t: 'host', state: null, error: 'Wrong admin token' });
          if (++client.badTokens >= MAX_BAD_TOKENS) conn.close(4006, 'admin');
        }
      } else if (msg.t === 'host' && client.slot !== null) {
        hostCommand(client, msg.cmd);
      } else if (msg.t === 'input' && client.slot !== null) {
        // An idle player's place goes back to them the moment they play.
        if (bots.input(client.slot, msg.inputs)) {
          notice(`${client.who?.name ?? 'A player'} is back`);
          broadcast({ t: 'roster', players: match.roster() });
        }
      } else if (msg.t === 'ready' && client.slot !== null) {
        match.ready(client.slot);
      } else if (msg.t === 'ping') {
        if (msg.rtt !== undefined) client.rtt = msg.rtt;
        send(client, { t: 'pong', id: msg.id, ct: msg.ct });
      }
    });

    conn.onClose(() => {
      clearTimeout(helloTimer);
      if (!clients.delete(client)) return;
      if (client.slot !== null && !stopped) {
        // Dropped (not kicked): a bot plays their place, kept for them a while (their next connection takes it back).
        const kept = client.gone ? (bots.leave(client.slot, control.fill), false) : bots.hold(client.slot, 'dropped', awayKey(client.who), control.fill);
        event(`${client.who?.name ?? 'a player'} ${kept ? `dropped: their place is kept ${AWAY.holdSeconds} s` : 'left'}`);
        // Otherwise a bot takes the leaver's place where they were (unless botTakeBack is off).
        broadcast({ t: 'roster', players: match.roster() });
      }
    });
  }

  const listener =opts.port === null ? null : await listen(opts.port, opts.host, () => info(), accept);
  const port = listener?.port ?? 0;
  const lan = listener ? lanAddresses(port) : [];
  function info(): ServerInfo {
    const all = match.combatants();
    return {
      game: 'tiletrigger',
      version: PROTOCOL_VERSION,
      name: opts.name ?? `${map.metadata.name} server`,
      map: map.metadata.name,
      mode: match.rules.mode,
      players: all.filter((c) => c.kind === 'human').length,
      bots: all.filter((c) => c.kind === 'bot').length,
      max: MAX_PLAYER_SLOTS,
      addresses: lan.length ? lan : listener ? [`ws://localhost:${port}`] : [],
    };
  }
  const discovery = opts.lanDiscovery ? await answerDiscovery(info, typeof opts.lanDiscovery === 'number' ? opts.lanDiscovery : undefined).catch((e: Error) => (console.warn(`[lan] no LAN discovery: ${e.message}`), null)) : null;

  const sendSnapshots = () => {
    const ev = pendingEvents;
    pendingEvents = [];
    // Everything but the per-recipient ack, private state and (in big matches) far players is shared:
    // encodeSnapshots serialises the pieces once and gives each client its own copy.
    const body = match.snapshot(ev);
    const to = [...clients].filter((c): c is Client & { slot: number } => c.slot !== null);
    const texts = encodeSnapshots(body, to.map((c) => ({ slot: c.slot, ack: match.slots[c.slot]?.lastSeq ?? 0, me: match.privateState(c.slot), stream: c.stream })));
    let total = 0;
    let n = 0;
    to.forEach((c, i) => {
      send(c, texts[i]!);
      total += texts[i]!.length;
      n++;
    });
    if (n) stats.recordSnapshot(total / n);
  };

  // Fixed-rate loop that catches up after hiccups instead of drifting.
  const tickMs = 1000 / TICK_RATE;
  let nextTickAt = performance.now();
  let lastStatsAt = performance.now();
  let pingRounds = 0;
  let timer: NodeJS.Timeout;

  /** A won co-op map moves on: the "Next map" it named (checked against our suite), else the playlist's next. */
  const planTravel = (next: string | undefined) => {
    const list = opts.playlist;
    const at = list ? playlistNext(list, playIndex) : null;
    const id = next ?? (list && at !== null ? list.maps[at]!.map : null);
    if (!id) return;
    const m = suiteMap(id);
    if (!m) return void console.warn(`[chain] "${id}" is not a map of our suite: staying on ${map.metadata.name}`);
    const entry = list && at !== null && list.maps[at]!.map === id ? list.maps[at]! : null;
    travel = {
      atTick: match.tick + Math.max(30, match.rules.intermissionTicks - 30),
      map: m,
      rules: chainRules(m, entry?.mode),
      index: entry ? at! : playIndex,
      carry: list?.carry ?? { score: true, loadout: true },
    };
  };
  /** Change map: everyone gets `travel` and reconnects to the new match, keeping what the chain carries. */
  const doTravel = () => {
    const t = travel!;
    travel = null;
    carried = new Map();
    for (const c of match.combatants()) {
      if (c.kind !== 'human') continue;
      const all = match.carryOf(c);
      carried.set(c.name, { ...(t.carry.score ? { kills: all.kills, deaths: all.deaths } : {}), ...(t.carry.loadout ? { weapons: all.weapons } : {}) });
    }
    for (const c of clients) {
      if (c.slot !== null) send(c, { t: 'travel', map: t.map.metadata.name });
      c.slot = null;
      c.conn.close(4005, 'travel');
    }
    pendingEvents = [];
    match.destroy();
    map = t.map;
    playIndex = t.index;
    match = new Match(map, withLeaders(t.rules), opts.seed ?? Date.now() % 100000, { startGate: opts.startGate ?? true });
    bots = new BotFiller(match, bots.skill, { takeBack: opts.botTakeBack });
    control = new HostControl(match, bots, t.fill ?? control.fill, 'Admin');
    bots.rebalance(control.fill);
    console.log(`[chain] now playing ${map.metadata.name}`);
  };

  const loop = () => {
    if (stopped) return;
    const now = performance.now();
    let ran = 0;
    while (now >= nextTickAt && ran < 5) {
      const t0 = performance.now();
      const events = match.step();
      pendingEvents.push(...events);
      for (const ev of events) {
        if (ev.e !== 'round_end') continue;
        if (ev.outcome === 'victory') planTravel(ev.next);
        const top = [...match.combatants()].filter((c) => c.kind !== 'npc').sort((a, b) => b.kills - a.kills)[0];
        event(`match over on ${map.metadata.name}: ${ev.team ? `team ${ev.team} wins` : ev.winner !== null ? `${match.slots[ev.winner]?.name ?? 'someone'} wins` : 'a draw'}${top ? ` (top: ${top.name}, ${top.kills} kills)` : ''}`);
      }
      if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) sendSnapshots();
      if (travel && match.tick >= travel.atTick) doTravel();
      stats.recordTick(performance.now() - t0, match.lastAiMs);
      nextTickAt += tickMs;
      ran++;
    }
    if (ran > 1) stats.recordLate(ran - 1);
    // Too far behind: drop the backlog rather than spiralling.
    if (now - nextTickAt > tickMs * 10) nextTickAt = now;

    if (now - lastStatsAt >= 1000) {
      const elapsed = (now - lastStatsAt) / 1000;
      lastStatsAt = now;
      const connected = [...clients].filter((c) => c.slot !== null);
      const bytes = connected.reduce((s, c) => s + c.bytesOut, 0);
      for (const c of clients) c.bytesOut = 0;
      const all = match.combatants();
      const summary = stats.flush({
        bytesPerSecPerClient: connected.length ? bytes / connected.length / elapsed : 0,
        humans: all.filter((c) => c.kind === 'human').length,
        bots: all.filter((c) => c.kind === 'bot').length,
      });
      broadcast({ t: 'stats', ...summary });
      opts.onStats?.(StatsWindow.format(summary), summary);
      // Away players: warn the idle, hand idle places to bots, end holds that ran out; close silent connections.
      const away = bots.watch(control.fill, new Set(connected.map((c) => c.slot!)), opts.afkSeconds ?? AWAY.afkSeconds, opts.idleKickMinutes ?? AWAY.kickMinutes);
      for (const slot of away.warn) {
        const c = clientAt(slot);
        if (c) send(c, { t: 'notice', text: `You're idle: move or a bot plays for you in ${AWAY.warnSeconds} s` });
      }
      for (const slot of away.away) {
        const c = clientAt(slot);
        event(`${c?.who?.name ?? 'a player'} is idle: a bot plays for them`);
        notice(`${c?.who?.name ?? 'A player'} is away: a bot plays for them`);
      }
      for (const name of away.released) event(`${name} didn't come back: their place goes to a bot`);
      for (const slot of away.kick) {
        const c = clientAt(slot);
        if (!c) continue;
        event(`${c.who?.name ?? 'a player'} removed: idle for ${opts.idleKickMinutes ?? AWAY.kickMinutes} min`);
        kick(c, `Removed for being idle (${opts.idleKickMinutes ?? AWAY.kickMinutes} minutes)`);
      }
      if (away.away.length || away.released.length) broadcast({ t: 'roster', players: match.roster() });
      const nowMs = Date.now();
      for (const c of clients) if (c.slot !== null && nowMs - c.heardAt > SILENT_MS) c.conn.close(4009, 'no answer');
      // Every other second: each human's ping, for the scoreboard.
      if (++pingRounds % 2 === 0) {
        const p = connected.flatMap((c) => (c.rtt !== undefined ? [c.slot!, c.rtt] : []));
        if (p.length) broadcast({ t: 'pings', p });
      }
    }
    timer = setTimeout(loop, Math.max(0, nextTickAt - performance.now()));
  };
  loop();

  return {
    port,
    accept,
    get match() {
      return match;
    },
    info,
    notice: (text: string) => broadcast({ t: 'notice', text }),
    command: runCommand,
    setAdminToken: (token) => {
      adminHash = token ? createHash('sha256').update(token).digest() : null;
      // Admins logged in with the old token stay admin until they leave.
    },
    players: () =>
      [...clients].flatMap((c) => {
        const p = c.slot === null ? undefined : match.slots[c.slot];
        if (c.slot === null || !c.who) return [];
        return [{ ...c.who, slot: c.slot, team: match.teams && p ? (p.faction ?? null) : null, kills: p?.kills ?? 0, deaths: p?.deaths ?? 0, ping: c.rtt ?? null, admin: c.admin }];
      }),
    close: async () => {
      stopped = true;
      clearTimeout(timer);
      discovery?.close();
      for (const c of clients) c.conn.close(1001, 'server stopping');
      await listener?.close();
      match.destroy();
    },
  };
}

/**
 * The dedicated server's own listener: WebSocket play and plain HTTP GET /info
 * (so browsers on the LAN can find the game) on one port.
 */
async function listen(port: number, host: string | undefined, info: () => ServerInfo, accept: (conn: PlayerConn) => void): Promise<{ port: number; close(): Promise<void> }> {
  const http = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://server').pathname;
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Chrome asks before a public page may reach a private address (Private Network Access).
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    if (req.method === 'GET' && path === '/info') {
      res.setHeader('Content-Type', 'application/json');
      return void res.end(JSON.stringify(info()));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Tile Trigger game server: join with the game (Online → Server), or GET /info.');
  });
  // Snapshots are JSON with lots of repetition: compressing them cuts the traffic several times over
  // (browsers decompress on their own). Small messages aren't worth it.
  const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024, perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 }, serverNoContextTakeover: false, clientNoContextTakeover: true } });
  wss.on('connection', (ws, req) => accept(wsConn(ws, req.socket.remoteAddress)));
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, host, () => resolve());
  });
  return {
    port: (http.address() as AddressInfo).port,
    close: async () => {
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

/** A WebSocket as a PlayerConn (text frames only; binary ones are ignored). */
function wsConn(ws: WebSocket, address?: string): PlayerConn {
  return {
    address: () => address,
    send: (text) => ws.send(text),
    close: (code, reason) => ws.close(code, reason),
    onMessage: (cb) => ws.on('message', (data, isBinary) => void (!isBinary && cb(data.toString()))),
    onClose: (cb) => ws.on('close', cb),
  };
}

function readMapFile(path: string): MapDocument {
  const result = loadMap(readFileSync(path, 'utf8'));
  for (const issue of result.issues) console.warn(`[map] ${issue.severity}: ${issue.message}`);
  if (!result.ok) throw new Error(`map ${path} failed validation`);
  return result.map;
}
