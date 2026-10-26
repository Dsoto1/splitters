import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import {
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
  initPhysics,
  loadMap,
  parseClientMessage,
  sanitizeName,
  type BotDifficulty,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type GameMode,
  type ServerInfo,
  type ServerMessage,
} from '@tiletrigger/shared';
import { BotFiller, Match, initNavigation, validateNavigation } from '@tiletrigger/shared/match';
import { answerDiscovery, lanAddresses } from './lan.ts';
import { StatsWindow } from './stats.ts';

export interface ServerOptions {
  port: number;
  host?: string;
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
  onStats?: (line: string) => void;
  /** Server name in LAN discovery and /info (default "<map> server"). */
  name?: string;
  /** Answer LAN discovery broadcasts (UDP, LAN_DISCOVERY_PORT unless a port is given). Off by default; main.ts turns it on. */
  lanDiscovery?: boolean | number;
}

export interface RunningServer {
  port: number;
  match: Match;
  /** What /info and LAN discovery say about this server right now. */
  info(): ServerInfo;
  close(): Promise<void>;
}

interface Client {
  ws: WebSocket;
  slot: number | null;
  bytesOut: number;
}

const HELLO_TIMEOUT_MS = 5000;

/**
 * Dedicated authoritative game server: owns the Match, accepts WebSocket
 * clients, applies their inputs, and broadcasts snapshots. Production online
 * play never trusts a browser as host (MASTER_SPEC_V2 §3.3).
 */
export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  await Promise.all([initPhysics(), initNavigation()]);

  const map = typeof opts.map === 'string' ? readMapFile(opts.map) : opts.map;
  if (opts.mode && !opts.rules && !mapCanRun(map, opts.mode)) throw new Error(`${map.metadata.name} can't host ${MODE_LABELS[opts.mode]} (it has no flag bases or hills for it)`);
  const baseRules = opts.rules ?? (opts.mode ? rulesForMode(map, opts.mode) : rulesForMap(map));
  const match = new Match(map, opts.leaders ? { ...baseRules, leaders: opts.leaders } : baseRules, opts.seed ?? Date.now() % 100000, { startGate: opts.startGate ?? true });
  for (const issue of validateNavigation(map, match.nav)) console.warn(`[map] ${issue.severity}: ${issue.message}`);
  const difficulty = BOT_DIFFICULTIES[opts.botDifficulty ?? 'normal'];
  const botFill = Math.min(opts.botFill, MAX_PLAYER_SLOTS);

  const clients = new Set<Client>();
  const stats = new StatsWindow();
  let pendingEvents: GameEvent[] = [];
  const bots = new BotFiller(match, difficulty, { takeBack: opts.botTakeBack });

  const send = (c: Client, msg: ServerMessage | string) => {
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
    c.bytesOut += data.length;
    c.ws.send(data);
  };
  const broadcast = (msg: ServerMessage) => {
    const data = JSON.stringify(msg);
    for (const c of clients) if (c.slot !== null) send(c, data);
  };

  /** Keep humans + bots at the fill target: bots leave when humans join and return when they go. */
  const rebalanceBots = () => bots.rebalance(botFill);
  rebalanceBots();

  // Snapshots are JSON with lots of repetition: compressing them cuts the traffic several times over
  // (browsers decompress on their own). Small messages aren't worth it.
  // One port for both: WebSocket play, and plain HTTP GET /info so browsers on the LAN can find the game.
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
  const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024, perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 }, serverNoContextTakeover: false, clientNoContextTakeover: true } });

  wss.on('connection', (ws) => {
    const client: Client = { ws, slot: null, bytesOut: 0 };
    clients.add(client);
    const helloTimer = setTimeout(() => ws.close(4000, 'hello timeout'), HELLO_TIMEOUT_MS);

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const msg = parseClientMessage(data.toString());
      if (!msg) return;
      if (msg.t === 'hello') {
        if (client.slot !== null) return;
        clearTimeout(helloTimer);
        if (msg.protocol !== PROTOCOL_VERSION) {
          send(client, { t: 'reject', reason: `protocol ${msg.protocol} unsupported (server speaks ${PROTOCOL_VERSION})` });
          ws.close(4001, 'protocol');
          return;
        }
        // Take over a bot where it stands (team that needs a player), or a free slot.
        const player = bots.join(sanitizeName(msg.name), msg.look, botFill);
        if (!player) {
          send(client, { t: 'reject', reason: 'server full' });
          ws.close(4002, 'full');
          return;
        }
        client.slot = player.slot;
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
          ...(lan.length ? { lan } : {}),
        });
        broadcast({ t: 'roster', players: match.roster() });
      } else if (msg.t === 'input' && client.slot !== null) {
        match.queueInputs(client.slot, msg.inputs);
      } else if (msg.t === 'ready' && client.slot !== null) {
        match.ready(client.slot);
      } else if (msg.t === 'ping') {
        send(client, { t: 'pong', id: msg.id, ct: msg.ct });
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      clients.delete(client);
      if (client.slot !== null) {
        // A bot takes the leaver's place where they were (unless botTakeBack is off).
        bots.leave(client.slot, botFill);
        broadcast({ t: 'roster', players: match.roster() });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(opts.port, opts.host, () => resolve());
  });
  const port = (http.address() as AddressInfo).port;
  const lan = lanAddresses(port);
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
      addresses: lan.length ? lan : [`ws://localhost:${port}`],
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
    const texts = encodeSnapshots(body, to.map((c) => ({ slot: c.slot, ack: match.slots[c.slot]?.lastSeq ?? 0, me: match.privateState(c.slot) })));
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
  let stopped = false;
  let timer: NodeJS.Timeout;

  const loop = () => {
    if (stopped) return;
    const now = performance.now();
    let ran = 0;
    while (now >= nextTickAt && ran < 5) {
      const t0 = performance.now();
      pendingEvents.push(...match.step());
      if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) sendSnapshots();
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
      opts.onStats?.(StatsWindow.format(summary));
    }
    timer = setTimeout(loop, Math.max(0, nextTickAt - performance.now()));
  };
  loop();

  return {
    port,
    match,
    info,
    close: async () => {
      stopped = true;
      clearTimeout(timer);
      discovery?.close();
      for (const c of clients) c.ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
      match.destroy();
    },
  };
}

function readMapFile(path: string): MapDocument {
  const result = loadMap(readFileSync(path, 'utf8'));
  for (const issue of result.issues) console.warn(`[map] ${issue.severity}: ${issue.message}`);
  if (!result.ok) throw new Error(`map ${path} failed validation`);
  return result.map;
}
