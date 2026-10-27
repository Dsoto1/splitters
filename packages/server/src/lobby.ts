import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { KeyedLimiter, LOBBY_EXPIRY_SECONDS, LOBBY_STALE_SECONDS, parseAdvert, type LobbyAdvert, type LobbyListing, type ServerInfo } from '@tiletrigger/shared';
import type { IceConfig } from './ice.ts';
import { clientIp } from './clientIp.ts';

interface Entry {
  listing: LobbyAdvert & { id: string };
  secret: string;
  ip: string;
  seen: number;
}

/** Limits that keep one address (or a flood) from filling the list or busying the hub. */
export const LOBBY_LIMITS = {
  /** Listings live at once from one address, and in all. */
  perIp: 3,
  total: 500,
  /** New listings per address per minute. */
  createsPerMinute: 10,
  /** GET /lobby/games per address per minute (the game browser refreshes every 10 s), bursts of 60. */
  readsPerMinute: 120,
  /** POST/PUT/DELETE per address per minute (a listing checks in every 20 s), bursts of 30. */
  writesPerMinute: 60,
  /** Relay credentials per address per minute, and per game (bursts of 30, then 1 a minute). */
  icePerMinute: 12,
  icePerSessionBurst: 30,
  /** LAN discovery per address per minute. */
  lanPerMinute: 12,
  /** Request bodies (JSON), bytes. */
  maxBody: 4096,
} as const;

/** Which maps may be listed how (MULTIPLAYER_REVIEW.md 5.5). */
export interface ListingPolicy {
  /** Our suite's map IDs (maps/ less retired ones). Unset: not checked (tests, a hub without the maps). */
  suite?: ReadonlySet<string>;
}

/** Compares two secrets in constant time (also when their lengths differ). */
export function secretsMatch(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/**
 * The game browser's list: hosts add their game, check in every
 * LOBBY_HEARTBEAT_SECONDS with fresh player counts, and remove it when they
 * stop. A listing that misses a check-in is hidden (LOBBY_STALE_SECONDS) and
 * one that stops checking in expires (LOBBY_EXPIRY_SECONDS). Each listing can
 * be changed only with the secret its host got when adding it. Listings of
 * maps outside our suite must say so (community) and name the exact version;
 * official and featured games are suite-only (browser hosts are never either).
 */
export class LobbyStore {
  private readonly entries = new Map<string, Entry>();
  private readonly creates = new Map<string, number[]>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly policy: ListingPolicy = {},
  ) {}

  private prune(): void {
    const cutoff = this.now() - LOBBY_EXPIRY_SECONDS * 1000;
    for (const [id, e] of this.entries) if (e.seen < cutoff) this.entries.delete(id);
  }

  /** Why this advert's map can't be listed, or null. */
  private mapProblem(a: LobbyAdvert): string | null {
    if (a.community) return a.mapId && a.versionId && a.contentHash ? null : 'a community map listing needs its map ID, version ID and content hash';
    if (this.policy.suite && !(a.mapId && this.policy.suite.has(a.mapId))) return "that map isn't one of the game's own: list it as a community map";
    return null;
  }

  /** Whether a live listing has this join code (a game the relay may serve). */
  hasCode(code: string): boolean {
    this.prune();
    for (const e of this.entries.values()) if (e.listing.code === code) return true;
    return false;
  }

  add(body: unknown, ip: string): { id: string; secret: string } | { error: string; status: number } {
    this.prune();
    const advert = parseAdvert(body);
    if (!advert) return { error: 'bad listing', status: 400 };
    const problem = this.mapProblem(advert);
    if (problem) return { error: problem, status: 400 };
    const t = this.now();
    const recent = (this.creates.get(ip) ?? []).filter((x) => x > t - 60_000);
    if (recent.length >= LOBBY_LIMITS.createsPerMinute) return { error: 'too many listings, slow down', status: 429 };
    this.creates.set(ip, [...recent, t]);
    if (this.creates.size > 10_000) for (const [k, v] of this.creates) if (!v.some((x) => x > t - 60_000)) this.creates.delete(k);
    // Re-listing the same join code replaces the old entry (a host refreshing the page).
    for (const [id, e] of this.entries) if (e.listing.code === advert.code && e.ip === ip) this.entries.delete(id);
    if ([...this.entries.values()].filter((e) => e.ip === ip).length >= LOBBY_LIMITS.perIp) return { error: 'too many games listed from your address', status: 429 };
    if (this.entries.size >= LOBBY_LIMITS.total) return { error: 'the game browser is full', status: 503 };
    const id = randomBytes(6).toString('hex');
    const secret = randomBytes(16).toString('hex');
    this.entries.set(id, { listing: { ...advert, id }, secret, ip, seen: t });
    return { id, secret };
  }

  update(id: string, secret: string, body: unknown): number {
    this.prune();
    const e = this.entries.get(id);
    if (!e) return 404;
    if (!secretsMatch(e.secret, secret)) return 403;
    const advert = parseAdvert(body);
    if (!advert || advert.code !== e.listing.code || this.mapProblem(advert)) return 400;
    e.listing = { ...advert, id };
    e.seen = this.now();
    return 204;
  }

  remove(id: string, secret: string): number {
    const e = this.entries.get(id);
    if (!e) return 404;
    if (!secretsMatch(e.secret, secret)) return 403;
    this.entries.delete(id);
    return 204;
  }

  /** Listings for players on `version` (all when undefined), fullest first. Stale ones (a missed check-in) are hidden. */
  list(version?: number): LobbyListing[] {
    this.prune();
    const t = this.now();
    const fresh = t - LOBBY_STALE_SECONDS * 1000;
    return [...this.entries.values()]
      .filter((e) => e.seen >= fresh && (version === undefined || e.listing.version === version))
      .map((e) => ({ ...e.listing, community: !!e.listing.community, age: Math.round((t - e.seen) / 1000) }))
      .sort((a, b) => b.players - a.players || a.name.localeCompare(b.name));
  }

  get size(): number {
    return this.entries.size;
  }
}

class BodyError extends Error {
  constructor(readonly status: number) {
    super(String(status));
  }
}

/** A JSON body of at most LOBBY_LIMITS.maxBody bytes, or a BodyError (413 too big, 415 not JSON, 400 malformed). */
function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] ?? ''))) return reject(new BodyError(415));
    if (Number(req.headers['content-length'] ?? 0) > LOBBY_LIMITS.maxBody) return reject(new BodyError(413));
    let size = 0;
    let done = false;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > LOBBY_LIMITS.maxBody) {
        if (!done) reject(new BodyError(413));
        done = true;
        req.pause();
      } else parts.push(c);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      try {
        resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));
      } catch {
        reject(new BodyError(400));
      }
    });
    req.on('error', () => {
      if (!done) reject(new BodyError(400));
      done = true;
    });
  });
}

const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

export interface LobbyOptions {
  /** Take the client address from the proxy (clientIp.ts). */
  trustProxy?: boolean;
  ice?: IceConfig;
  lan?: () => Promise<{ addresses: string[]; servers: ServerInfo[] }>;
  /** Whether a game is open under this join code (on the hub's broker): relay credentials are only for live games. */
  isLive?: (code: string) => boolean;
}

/**
 * HTTP for the store, under /lobby:
 *   GET    /lobby/games?v=<protocol>  → { games }
 *   POST   /lobby/games               → { id, secret }
 *   PUT    /lobby/games/<id>          (header X-Lobby-Secret) → 204
 *   DELETE /lobby/games/<id>          (header X-Lobby-Secret) → 204
 *   GET    /lobby/ice?session=<CODE>&role=host|guest
 *                                     → { iceServers, relay, ttl }: relay credentials for that game (ice.ts);
 *                                       without a session: STUN only (relay false); no such game: 404
 *   GET    /lobby/lan                 → { addresses, servers } (the hub's own LAN addresses, and dedicated
 *                                       servers that answered a UDP discovery broadcast; see lan.ts)
 *   GET    /lobby/health              → { ok, games, relay }
 * Every route is rate-limited per address (LOBBY_LIMITS); bodies are JSON of at most 4 KB, checked by schema.
 * Open to any origin: the game's pages can be served from anywhere, and nothing here uses cookies.
 */
export function lobbyHandler(store: LobbyStore, o: LobbyOptions = {}) {
  const reads = new KeyedLimiter({ perMinute: LOBBY_LIMITS.readsPerMinute, burst: 60 });
  const writes = new KeyedLimiter({ perMinute: LOBBY_LIMITS.writesPerMinute, burst: 30 });
  const iceAsks = new KeyedLimiter({ perMinute: LOBBY_LIMITS.icePerMinute });
  const icePerSession = new KeyedLimiter({ perMinute: 1, burst: LOBBY_LIMITS.icePerSessionBurst });
  const lanAsks = new KeyedLimiter({ perMinute: LOBBY_LIMITS.lanPerMinute });
  const ice = o.ice;
  return async (req: IncomingMessage & { originalUrl?: string }, res: ServerResponse, next?: () => void): Promise<void> => {
    const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://hub');
    const path = url.pathname.replace(/\/+$/, '');
    if (path !== '/lobby' && !path.startsWith('/lobby/')) return next?.();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Lobby-Secret');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status: number, body?: unknown) => {
      res.statusCode = status;
      if (body === undefined) return void res.end();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204);
    const ip = clientIp(req, !!o.trustProxy);
    const secret = String(req.headers['x-lobby-secret'] ?? '').slice(0, 64);
    try {
      if (path === '/lobby/health' && req.method === 'GET') return send(200, { ok: true, games: store.size, relay: ice?.provider ?? null });
      if (path === '/lobby/ice' && req.method === 'GET') {
        // Relay credentials cost bandwidth: a few per address per minute, and only for a game that is open now.
        if (!iceAsks.allow(ip)) return send(429, { error: 'slow down' });
        const code = (url.searchParams.get('session') ?? '').toUpperCase();
        const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
        const stunOnly = async () => send(200, { iceServers: ((await ice?.get()) ?? []).filter((s) => !s.username), relay: false, ttl: ice?.ttl ?? 0 });
        if (!ice?.provider) return await stunOnly();
        if (!CODE_RE.test(code)) return code ? send(400, { error: 'bad session' }) : await stunOnly();
        if (!(o.isLive?.(code) || store.hasCode(code))) return send(404, { error: 'no game open with that code' });
        if (!icePerSession.allow(code)) return send(429, { error: 'this game has asked for many relay credentials: try again in a minute' });
        const peer = role === 'host' ? 'host' : `p_${randomBytes(4).toString('hex')}`;
        return send(200, { iceServers: await ice.get({ session: `s_${code}`, peer }), relay: true, ttl: ice.ttl });
      }
      if (path === '/lobby/lan' && req.method === 'GET') {
        if (!o.lan) return send(404, { error: 'no LAN discovery on this hub' });
        if (!lanAsks.allow(ip)) return send(429, { error: 'slow down' });
        return send(200, await o.lan());
      }
      if (path === '/lobby/games') {
        if (req.method === 'GET') {
          if (!reads.allow(ip)) return send(429, { error: 'slow down' });
          const v = url.searchParams.get('v');
          if (v !== null && !/^\d{1,7}$/.test(v)) return send(400, { error: 'bad version' });
          return send(200, { games: store.list(v === null ? undefined : Number(v)) });
        }
        if (req.method === 'POST') {
          if (!writes.allow(ip)) return send(429, { error: 'slow down' });
          const r = store.add(await readBody(req), ip);
          return 'error' in r ? send(r.status, { error: r.error }) : send(201, r);
        }
        return send(405, { error: 'method not allowed' });
      }
      const m = /^\/lobby\/games\/([0-9a-f]{12})$/.exec(path);
      if (m && (req.method === 'PUT' || req.method === 'DELETE')) {
        if (!writes.allow(ip)) return send(429, { error: 'slow down' });
        if (req.method === 'PUT') return send(store.update(m[1]!, secret, await readBody(req)));
        return send(store.remove(m[1]!, secret));
      }
      send(404, { error: 'not found' });
    } catch (e) {
      if (e instanceof BodyError) return send(e.status, { error: e.status === 413 ? 'request too large' : e.status === 415 ? 'send JSON' : 'bad request' });
      send(502, { error: 'relay credentials unavailable' });
    }
  };
}
