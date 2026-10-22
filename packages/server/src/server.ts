import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  BOT_DIFFICULTIES,
  DEFAULT_DEATHMATCH_RULES,
  MAX_PLAYER_SLOTS,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_RATE,
  initPhysics,
  loadMap,
  type BotDifficulty,
  type ClientMessage,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
  type ServerMessage,
} from '@chronosplit/shared';
import { BotFiller, Match, initNavigation, validateNavigation } from '@chronosplit/shared/match';
import { StatsWindow } from './stats.ts';

export interface ServerOptions {
  port: number;
  host?: string;
  /** Map file path or an already-parsed document. */
  map: string | MapDocument;
  /** Fill the match with Player Bots up to this many total players. */
  botFill: number;
  botDifficulty?: BotDifficulty['id'];
  rules?: MatchRules;
  seed?: number;
  /** Called once per second with instrumentation. */
  onStats?: (line: string) => void;
}

export interface RunningServer {
  port: number;
  match: Match;
  close(): Promise<void>;
}

interface Client {
  ws: WebSocket;
  slot: number | null;
  bytesOut: number;
}

const MAX_INPUTS_PER_MESSAGE = 32;
const HELLO_TIMEOUT_MS = 5000;

/**
 * Dedicated authoritative game server: owns the Match, accepts WebSocket
 * clients, applies their inputs, and broadcasts snapshots. Production online
 * play never trusts a browser as host (MASTER_SPEC_V2 §3.3).
 */
export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  await Promise.all([initPhysics(), initNavigation()]);

  const map = typeof opts.map === 'string' ? readMapFile(opts.map) : opts.map;
  const match = new Match(map, opts.rules ?? DEFAULT_DEATHMATCH_RULES, opts.seed ?? Date.now() % 100000);
  for (const issue of validateNavigation(map, match.nav)) console.warn(`[map] ${issue.severity}: ${issue.message}`);
  const difficulty = BOT_DIFFICULTIES[opts.botDifficulty ?? 'normal'];
  const botFill = Math.min(opts.botFill, MAX_PLAYER_SLOTS);

  const clients = new Set<Client>();
  const stats = new StatsWindow();
  let pendingEvents: GameEvent[] = [];
  const bots = new BotFiller(match, difficulty);

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

  const wss = new WebSocketServer({ port: opts.port, host: opts.host, maxPayload: 64 * 1024 });

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
        // Make room by dropping a bot if the server is full of them.
        const bot = match.combatants().find((c) => c.kind === 'bot');
        if (match.combatants().length >= MAX_PLAYER_SLOTS && bot) match.remove(bot.slot);
        const player = match.addHuman(sanitizeName(msg.name));
        if (!player) {
          send(client, { t: 'reject', reason: 'server full' });
          ws.close(4002, 'full');
          return;
        }
        client.slot = player.slot;
        rebalanceBots();
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
        });
        broadcast({ t: 'roster', players: match.roster() });
      } else if (msg.t === 'input' && client.slot !== null) {
        match.queueInputs(client.slot, msg.inputs);
      } else if (msg.t === 'ping') {
        send(client, { t: 'pong', id: msg.id, ct: msg.ct });
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      clients.delete(client);
      if (client.slot !== null) {
        match.remove(client.slot);
        rebalanceBots();
        broadcast({ t: 'roster', players: match.roster() });
      }
    });
  });

  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
  const port = (wss.address() as AddressInfo).port;

  const sendSnapshots = () => {
    const ev = pendingEvents;
    pendingEvents = [];
    // Everything but the per-recipient ack is shared, so serialise it once.
    const body = JSON.stringify(match.snapshot(ev));
    let total = 0;
    let n = 0;
    for (const c of clients) {
      if (c.slot === null) continue;
      const ack = match.slots[c.slot]?.lastSeq ?? 0;
      const me = match.privateState(c.slot);
      const data = `{"t":"snapshot","ack":${ack},${me ? `"me":${JSON.stringify(me)},` : ''}${body.slice(1)}`;
      send(c, data);
      total += data.length;
      n++;
    }
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
    close: async () => {
      stopped = true;
      clearTimeout(timer);
      for (const c of clients) c.ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
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

function sanitizeName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  return clean || 'Player';
}

/** Structural validation of untrusted client JSON. Values are clamped later by the simulation. */
export function parseClientMessage(text: string): ClientMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null) return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case 'hello':
      return typeof o.protocol === 'number' && typeof o.name === 'string' ? { t: 'hello', protocol: o.protocol, name: o.name } : null;
    case 'ping':
      return typeof o.id === 'number' && typeof o.ct === 'number' ? { t: 'ping', id: o.id, ct: o.ct } : null;
    case 'input': {
      if (!Array.isArray(o.inputs) || o.inputs.length > MAX_INPUTS_PER_MESSAGE) return null;
      const inputs: PlayerInput[] = [];
      for (const raw of o.inputs) {
        if (typeof raw !== 'object' || raw === null) return null;
        const r = raw as Record<string, unknown>;
        const fields = ['seq', 'forward', 'right', 'yaw', 'pitch', 'buttons'] as const;
        if (!fields.every((f) => typeof r[f] === 'number')) return null;
        const input: PlayerInput = { seq: r.seq as number, forward: r.forward as number, right: r.right as number, yaw: r.yaw as number, pitch: r.pitch as number, buttons: r.buttons as number };
        // Optional fields: weapon selection and the tick the player was viewing (lag compensation).
        if (typeof r.weapon === 'number') input.weapon = r.weapon;
        if (typeof r.viewTick === 'number') input.viewTick = r.viewTick;
        inputs.push(input);
      }
      return { t: 'input', inputs };
    }
    default:
      return null;
  }
}
