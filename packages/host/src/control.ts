import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { GAME_MODES, KeyedLimiter, MAX_PLAYER_SLOTS, isMapId } from '@tiletrigger/shared';
import { ConfigError, parseConfig, type HostConfig } from './config.ts';
import type { BanList } from './bans.ts';
import type { Supervisor } from './supervisor.ts';

/**
 * The Host Service's control API, for the site's /host page: on 127.0.0.1
 * only (never a public interface: nothing on the internet can reach it, and
 * no port forwarding is involved), and only for the owner's own pages:
 *  - an Origin allow-list (https://trigger.toshiroplay.com, plus localhost
 *    pages for development); CORS answers name that origin, never "*";
 *  - the Host header must be the loopback address (no DNS rebinding);
 *  - every command needs the pairing token, a random secret made on first
 *    run and kept in this computer's user profile (state.ts). The service
 *    opens /host with it in the address's #fragment (never sent to any
 *    server), and the page keeps it in its own storage.
 * The command set is closed (MULTIPLAYER_SECURITY.md SEC-HOST-002): status,
 * start with a validated config, stop, restart, quit. No paths, URLs or
 * shell text: a map is one of our suite's IDs, the hub is the service's own.
 */

export const DEFAULT_CONTROL_PORT = 7797;
export const SERVICE_ID = 'tiletrigger-host';
export const DEFAULT_ALLOWED_ORIGINS = ['https://trigger.toshiroplay.com'];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;
const MAX_BODY = 4096;

export interface ControlOptions {
  port: number;
  token: string;
  supervisor: Supervisor;
  /** The service's settings: what a start request may change is applied on top (the hub never changes). */
  base: HostConfig;
  /** Our suite (map IDs a start request may name). */
  suite: ReadonlySet<string>;
  /** Extra page origins allowed (HOST_ALLOWED_ORIGINS), besides the official site and localhost. */
  origins?: readonly string[];
  version: string;
  /** Remember the settings and whether it runs (state.ts), so a relaunch restores it. */
  persist(config: HostConfig | null, running: boolean): void;
  quit(): void;
  log?: (line: string) => void;
  /** The ban list (shown on /host; unban from there). */
  bans?: BanList;
}

/** Whether a page at `origin` may use the API (no Origin header: not a browser page, e.g. curl with the token). */
export function originAllowed(origin: string | undefined, extra: readonly string[] = []): boolean {
  if (origin === undefined) return true;
  return DEFAULT_ALLOWED_ORIGINS.includes(origin) || extra.includes(origin) || LOCAL_ORIGIN.test(origin);
}

const tokenMatches = (a: string, b: string) => {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
};

/** What a start request may set (all checked; anything else in the body is refused). */
const START_KEYS = new Set(['map', 'mode', 'botFill', 'maxPlayers', 'botDifficulty', 'name', 'hostName', 'visibility', 'adminToken', 'joinCode', 'leaders', 'botTakeBack']);

/** A start request's settings on top of the service's own (throws ConfigError with a message for the page). */
export function startConfig(body: unknown, base: HostConfig, suite: ReadonlySet<string>): HostConfig {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new ConfigError('send the settings as a JSON object');
  const o = body as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!START_KEYS.has(k)) throw new ConfigError(`unknown setting "${k}"`);
  // A suite map by ID only: never a file path from a page.
  if (o.map !== undefined && !(typeof o.map === 'string' && isMapId(o.map) && suite.has(o.map))) throw new ConfigError('map must be one of the game\'s maps');
  if (o.mode !== undefined && !(typeof o.mode === 'string' && (GAME_MODES as readonly string[]).includes(o.mode))) throw new ConfigError('unknown mode');
  for (const k of ['name', 'hostName', 'adminToken', 'joinCode']) if (o[k] !== undefined && (typeof o[k] !== 'string' || (o[k] as string).length > 64)) throw new ConfigError(`${k} must be text (at most 64 characters)`);
  for (const k of ['botFill', 'maxPlayers']) if (o[k] !== undefined && typeof o[k] !== 'number') throw new ConfigError(`${k} must be a number`);
  const merged: Record<string, unknown> = { ...base, playlist: undefined, ...o };
  // Empty strings clear a setting (no admin token, a random join code).
  for (const k of ['adminToken', 'joinCode', 'mode']) if (merged[k] === '') delete merged[k];
  if (merged.leaders === true) merged.leaders = 'on';
  const c = parseConfig(merged);
  if (c.botFill > MAX_PLAYER_SLOTS) throw new ConfigError('too many players');
  return { ...c, hub: base.hub, map: (o.map as string | undefined) ?? (isMapId(base.map) ? base.map : 'frost_basin') };
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new ConfigError('request too large'));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => {
      try {
        resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {});
      } catch {
        reject(new ConfigError('send JSON'));
      }
    });
    req.on('error', reject);
  });
}

export async function startControl(o: ControlOptions): Promise<{ port: number; server: Server; close(): Promise<void> }> {
  const limiter = new KeyedLimiter({ perMinute: 240, burst: 60 });
  const commands = new KeyedLimiter({ perMinute: 20, burst: 10 });
  const badTokens = new KeyedLimiter({ perMinute: 10, burst: 10 });
  let port = o.port;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    const send = (status: number, body?: unknown) => {
      res.statusCode = status;
      res.setHeader('Cache-Control', 'no-store');
      if (body === undefined) return void res.end();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    // Only this computer's loopback name (a page on another site that resolves its own name to 127.0.0.1 is refused).
    const host = String(req.headers.host ?? '');
    if (!new RegExp(`^(127\\.0\\.0\\.1|localhost|\\[::1\\]):${port}$`).test(host)) return send(421, { error: 'wrong host' });
    if (!originAllowed(origin, o.origins)) return send(403, { error: 'this page may not control the Host Service' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      // Chrome asks before a public page reaches this computer (Private Network Access).
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return send(204);
    if (!limiter.allow('all')) return send(429, { error: 'slow down' });
    const path = new URL(req.url ?? '/', 'http://local').pathname;
    const auth = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const paired = !!auth && tokenMatches(auth, o.token);
    // Discovery: that the service runs, and whether this page holds the pairing token. Nothing else without it.
    if (path === '/api/ping' && req.method === 'GET') return send(200, { service: SERVICE_ID, version: o.version, paired });
    if (!paired) {
      if (auth && !badTokens.allow('all')) return send(429, { error: 'too many wrong tokens' });
      return send(401, { error: 'not paired: open /host from the link the Host Service shows (it carries the pairing token)' });
    }
    const sup = o.supervisor;
    if (path === '/api/status' && req.method === 'GET') {
      const s = sup.status();
      const { adminToken: _a, ...config } = s.config ?? ({} as HostConfig);
      return send(200, { ...s, config: s.config ? { ...config, adminTokenSet: !!s.config.adminToken } : null, version: o.version, bans: o.bans?.list().map((b) => ({ id: b.id, name: b.name, account: !!b.sub, until: b.until, reason: b.reason })) ?? [] });
    }
    if (req.method !== 'POST') return send(404, { error: 'not found' });
    if (!commands.allow('all')) return send(429, { error: 'slow down' });
    void (async () => {
      try {
        if (path === '/api/start') {
          const config = startConfig(await readJson(req), o.base, o.suite);
          await sup.start(config);
          o.persist(config, true);
          o.log?.(`start from /host: ${config.map}, ${config.botFill} players and bots`);
          return send(202, { ok: true });
        }
        if (path === '/api/stop') {
          await sup.stop();
          o.persist(sup.config, false);
          return send(200, { ok: true });
        }
        if (path === '/api/restart') {
          await sup.restart();
          o.persist(sup.config, true);
          return send(202, { ok: true });
        }
        if (path === '/api/kick' || path === '/api/ban') {
          const b = (await readJson(req)) as { slot?: unknown; minutes?: unknown; reason?: unknown };
          if (!(typeof b.slot === 'number' && Number.isInteger(b.slot) && b.slot >= 0 && b.slot < 1000)) throw new ConfigError('slot must be a player id');
          const minutes = typeof b.minutes === 'number' && Number.isInteger(b.minutes) && b.minutes > 0 && b.minutes <= 525_600 ? b.minutes : 0;
          const reason = typeof b.reason === 'string' ? b.reason.replace(/[\u0000-\u001f]/g, '').slice(0, 80) : '';
          const args = [`#${b.slot}`, ...(path === '/api/ban' && minutes ? [`${minutes}m`] : []), ...(reason ? [reason] : [])];
          const text = await sup.command(path === '/api/kick' ? 'kick' : 'ban', args, args.join(' '));
          o.log?.(`/host: ${text}`);
          return send(/^(kicked|banned)/.test(text) ? 200 : 400, { ok: /^(kicked|banned)/.test(text), text });
        }
        if (path === '/api/unban') {
          const b = (await readJson(req)) as { id?: unknown };
          if (typeof b.id !== 'string' || !/^[a-f0-9]{6}$/.test(b.id)) throw new ConfigError('id must be a ban id');
          return send(200, { ok: true, removed: o.bans?.remove(b.id) ?? 0 });
        }
        if (path === '/api/quit') {
          send(200, { ok: true });
          return o.quit();
        }
        send(404, { error: 'not found' });
      } catch (e) {
        send(e instanceof ConfigError ? 400 : 500, { error: (e as Error).message.slice(0, 200) });
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    // Loopback only, never 0.0.0.0.
    server.listen(o.port, '127.0.0.1', () => resolve());
  });
  port = (server.address() as AddressInfo).port;
  return { port, server, close: () => new Promise<void>((r) => server.close(() => r())) };
}
