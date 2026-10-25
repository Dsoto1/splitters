import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LOBBY_EXPIRY_SECONDS, parseAdvert, type LobbyAdvert, type LobbyListing } from '@tiletrigger/shared';
import type { IceConfig } from './ice.ts';

interface Entry {
  listing: LobbyAdvert & { id: string };
  secret: string;
  ip: string;
  seen: number;
}

/** Limits that keep one address (or a flood) from filling the list. */
const PER_IP = 3;
const TOTAL = 500;
const CREATES_PER_MINUTE = 10;

/**
 * The game browser's list: hosts add their game, check in every
 * LOBBY_HEARTBEAT_SECONDS with fresh player counts, and remove it when they
 * stop. A listing that stops checking in expires. Each listing can be
 * changed only with the secret its host got when adding it.
 */
export class LobbyStore {
  private readonly entries = new Map<string, Entry>();
  private readonly creates = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  private prune(): void {
    const cutoff = this.now() - LOBBY_EXPIRY_SECONDS * 1000;
    for (const [id, e] of this.entries) if (e.seen < cutoff) this.entries.delete(id);
  }

  add(body: unknown, ip: string): { id: string; secret: string } | { error: string; status: number } {
    this.prune();
    const advert = parseAdvert(body);
    if (!advert) return { error: 'bad listing', status: 400 };
    const t = this.now();
    const recent = (this.creates.get(ip) ?? []).filter((x) => x > t - 60_000);
    if (recent.length >= CREATES_PER_MINUTE) return { error: 'too many listings, slow down', status: 429 };
    this.creates.set(ip, [...recent, t]);
    // Re-listing the same join code replaces the old entry (a host refreshing the page).
    for (const [id, e] of this.entries) if (e.listing.code === advert.code && e.ip === ip) this.entries.delete(id);
    if ([...this.entries.values()].filter((e) => e.ip === ip).length >= PER_IP) return { error: 'too many games listed from your address', status: 429 };
    if (this.entries.size >= TOTAL) return { error: 'the game browser is full', status: 503 };
    const id = randomBytes(6).toString('hex');
    const secret = randomBytes(16).toString('hex');
    this.entries.set(id, { listing: { ...advert, id }, secret, ip, seen: t });
    return { id, secret };
  }

  update(id: string, secret: string, body: unknown): number {
    this.prune();
    const e = this.entries.get(id);
    if (!e) return 404;
    if (e.secret !== secret) return 403;
    const advert = parseAdvert(body);
    if (!advert || advert.code !== e.listing.code) return 400;
    e.listing = { ...advert, id };
    e.seen = this.now();
    return 204;
  }

  remove(id: string, secret: string): number {
    const e = this.entries.get(id);
    if (!e) return 404;
    if (e.secret !== secret) return 403;
    this.entries.delete(id);
    return 204;
  }

  /** Listings for players on `version` (all when undefined), fullest first. */
  list(version?: number): LobbyListing[] {
    this.prune();
    const t = this.now();
    return [...this.entries.values()]
      .filter((e) => version === undefined || e.listing.version === version)
      .map((e) => ({ ...e.listing, age: Math.round((t - e.seen) / 1000) }))
      .sort((a, b) => b.players - a.players || a.name.localeCompare(b.name));
  }

  get size(): number {
    return this.entries.size;
  }
}

const MAX_BODY = 4096;

const iceAsks = new Map<string, number[]>();
function iceLimit(ip: string, now = Date.now()): boolean {
  const recent = (iceAsks.get(ip) ?? []).filter((t) => t > now - 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  iceAsks.set(ip, recent);
  if (iceAsks.size > 10_000) iceAsks.clear();
  return true;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) req.destroy();
      else parts.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

/**
 * HTTP for the store, under /lobby:
 *   GET    /lobby/games?v=<protocol>  → { games }
 *   POST   /lobby/games               → { id, secret }
 *   PUT    /lobby/games/<id>          (header X-Lobby-Secret) → 204
 *   DELETE /lobby/games/<id>          (header X-Lobby-Secret) → 204
 *   GET    /lobby/ice                 → { iceServers, relay } (short-lived relay credentials, see ice.ts)
 * Open to any origin: the game's pages can be served from anywhere.
 * `trustProxy`: take the client address from X-Forwarded-For (behind a proxy).
 */
export function lobbyHandler(store: LobbyStore, trustProxy = false, ice?: IceConfig) {
  return async (req: IncomingMessage & { originalUrl?: string }, res: ServerResponse, next?: () => void): Promise<void> => {
    const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://hub');
    const path = url.pathname.replace(/\/+$/, '');
    if (!path.startsWith('/lobby')) return next?.();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Lobby-Secret');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status: number, body?: unknown) => {
      if (body === undefined) {
        res.statusCode = status;
        return void res.end();
      }
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204);
    const forwarded = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() : '';
    const ip = forwarded || req.socket.remoteAddress || 'unknown';
    const secret = String(req.headers['x-lobby-secret'] ?? '');
    if (path === '/lobby/health') return send(200, { ok: true, games: store.size, relay: ice?.provider ?? null });
    if (path === '/lobby/ice' && req.method === 'GET') {
      // Relay credentials cost bandwidth: a few per address per minute is plenty for joining games.
      if (!iceLimit(ip)) return send(429, { error: 'slow down' });
      try {
        const iceServers = (await ice?.get()) ?? [];
        return send(200, { iceServers, relay: !!ice?.provider });
      } catch (e) {
        return send(502, { error: (e as Error).message });
      }
    }
    if (path === '/lobby/games') {
      if (req.method === 'GET') {
        const v = url.searchParams.get('v');
        return send(200, { games: store.list(v === null ? undefined : Number(v)) });
      }
      if (req.method === 'POST') {
        const r = store.add(await readBody(req), ip);
        return 'error' in r ? send(r.status, { error: r.error }) : send(201, r);
      }
    }
    const m = /^\/lobby\/games\/([0-9a-f]{12})$/.exec(path);
    if (m && req.method === 'PUT') return send(store.update(m[1]!, secret, await readBody(req)));
    if (m && req.method === 'DELETE') return send(store.remove(m[1]!, secret));
    send(404, { error: 'not found' });
  };
}
