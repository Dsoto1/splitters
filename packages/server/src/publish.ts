import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { KeyedLimiter, isMapId, isRetiredMap, loadMap, mapContentHash, playableModes, serializeMap, validateMap, type MapDocument } from '@tiletrigger/shared';
import { clientIp } from './clientIp.ts';
import type { VerifiedUser } from './auth.ts';

/**
 * Maps the owner publishes from MapMaker (docs/HOSTING.md, "Publishing maps").
 * Every map is made and edited in MapMaker; the official ones are its files in
 * maps/ as built into the site, unless the owner has published a newer
 * version here, which then wins everywhere: the site's map list, matches,
 * MapMaker and Host Services all ask the hub for it. A published map with a
 * new ID is a new official map (a community map promoted, say).
 *
 * Only owner accounts publish (OWNER_SUBS: Cognito user IDs, checked against
 * a verified sign-in token, never a setting in the page). The hub checks a map
 * itself before keeping it: it must load and have no validation errors.
 * Every earlier version is kept (the last KEEP of each), so a publish can be
 * rolled back. Maps are declarative data: nothing in one runs.
 *
 * Folder (PUBLISHED_MAPS_DIR):
 *   <id>.json                 the published version
 *   history/<id>/<ms>.json    every version published, newest last
 *   history/<id>/log.jsonl    who published what when ({ at, sub, name, hash })
 */

/** Versions kept per map. */
export const KEEP_VERSIONS = 50;
/** Largest map accepted (uncompressed); our biggest is about 2 MB. */
export const MAX_MAP_BYTES = 8 * 1024 * 1024;
/** Largest request body (the page sends it gzipped). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface PublishedEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  recommendedPlayers: { min: number; max: number };
  modes: string[];
  /** When it was published (ms) and the map's content hash. */
  at: number;
  hash: string;
  /** Not one of the maps built into the site: an official map added by publishing. */
  added: boolean;
}

export interface PublishedVersion {
  at: number;
  name: string;
  hash: string;
  /** The current one. */
  current: boolean;
}

export class PublishError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export class PublishedMaps {
  private entries = new Map<string, PublishedEntry>();

  /**
   * `builtIn`: the maps built into the site (maps/). `suite` is the hub's set
   * of official map IDs (the game browser's listing rules): published new
   * maps are added to it.
   */
  constructor(
    readonly dir: string,
    private readonly builtIn: ReadonlySet<string>,
    private readonly suite?: Set<string>,
    private readonly now: () => number = Date.now,
  ) {
    mkdirSync(join(dir, 'history'), { recursive: true });
    for (const f of readdirSync(dir)) {
      const id = f.replace(/\.json$/, '');
      if (!f.endsWith('.json') || !isMapId(id)) continue;
      try {
        const map = this.check(readFileSync(join(dir, f), 'utf8'), id);
        const last = this.versions(id).at(-1);
        this.remember(map, last?.at ?? 0);
      } catch {
        // A file that no longer passes (an older format the game dropped) is left out, not served.
      }
    }
  }

  /** Every published map, by name. */
  list(): PublishedEntry[] {
    return [...this.entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** A published map's file, or null. */
  get(id: string): string | null {
    if (!isMapId(id) || !this.entries.has(id)) return null;
    try {
      return readFileSync(join(this.dir, `${id}.json`), 'utf8');
    } catch {
      return null;
    }
  }

  /** Every kept version of a map, oldest first. */
  versions(id: string): PublishedVersion[] {
    const log = join(this.dir, 'history', id, 'log.jsonl');
    if (!isMapId(id) || !existsSync(log)) return [];
    const rows = readFileSync(log, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as { at: number; name: string; hash: string };
        } catch {
          return null;
        }
      })
      .filter((r): r is { at: number; name: string; hash: string } => !!r && existsSync(join(this.dir, 'history', id, `${r.at}.json`)));
    const cur = this.entries.get(id)?.hash;
    return rows.map((r, i) => ({ at: r.at, name: r.name, hash: r.hash, current: i === rows.length - 1 && r.hash === cur }));
  }

  /** Check a map's text: it loads, has an allowed ID (`id` if given), and no validation errors. */
  check(text: string, id?: string): MapDocument {
    if (Buffer.byteLength(text) > MAX_MAP_BYTES) throw new PublishError('the map is too large');
    // Kept as made (paths not laid into the ground): hosts and MapMaker load it from here.
    const r = loadMap(text, undefined, { forEditing: true });
    if (!r.ok) throw new PublishError(`the map doesn't load: ${r.issues.find((i) => i.severity === 'error')?.message ?? 'invalid'}`);
    const map = r.map;
    if (!isMapId(map.metadata.id)) throw new PublishError('the map ID must be 2–48 characters of a–z, 0–9 and _');
    if (id !== undefined && map.metadata.id !== id) throw new PublishError(`the map's ID is ${map.metadata.id}, not ${id}`);
    if (isRetiredMap(map.metadata.id)) throw new PublishError('that map ID is retired');
    const errors = validateMap(map).filter((i) => i.severity === 'error');
    if (errors.length) throw new PublishError(`fix ${errors.length} error${errors.length > 1 ? 's' : ''} first: ${errors[0]!.message}`);
    if (!playableModes(map).length) throw new PublishError('no mode can run on this map');
    return map;
  }

  /** Publish a map (already checked by the caller or not: it is checked again). */
  publish(text: string, by: { sub: string }): PublishedEntry {
    const map = this.check(text);
    const id = map.metadata.id;
    const body = serializeMap(map);
    const at = Math.max(this.now(), (this.versions(id).at(-1)?.at ?? 0) + 1);
    const hist = join(this.dir, 'history', id);
    mkdirSync(hist, { recursive: true });
    writeFileSync(join(hist, `${at}.json`), body);
    writeFileSync(join(hist, 'log.jsonl'), `${JSON.stringify({ at, sub: by.sub, name: map.metadata.name, hash: mapContentHash(map) })}\n`, { flag: 'a' });
    // The published file is replaced in one step: a reader never sees half a map.
    const tmp = join(this.dir, `.${id}.${at}.tmp`);
    writeFileSync(tmp, body);
    renameSync(tmp, join(this.dir, `${id}.json`));
    this.prune(id);
    return this.remember(map, at);
  }

  /** Publish an earlier version again (by its time). */
  rollback(id: string, at: number, by: { sub: string }): PublishedEntry {
    const file = join(this.dir, 'history', id, `${at}.json`);
    if (!isMapId(id) || !Number.isInteger(at) || !existsSync(file)) throw new PublishError('no such version', 404);
    return this.publish(readFileSync(file, 'utf8'), by);
  }

  /** Take a published version down: the map built into the site is used again (a map added by publishing is gone). */
  unpublish(id: string): boolean {
    if (!isMapId(id) || !this.entries.has(id)) return false;
    rmSync(join(this.dir, `${id}.json`), { force: true });
    const e = this.entries.get(id)!;
    this.entries.delete(id);
    if (e.added) this.suite?.delete(id);
    return true;
  }

  private remember(map: MapDocument, at: number): PublishedEntry {
    const id = map.metadata.id;
    const m = map.metadata;
    const entry: PublishedEntry = { id, name: m.name, description: m.description, author: m.author, recommendedPlayers: m.recommendedPlayers, modes: playableModes(map), at, hash: mapContentHash(map), added: !this.builtIn.has(id) };
    this.entries.set(id, entry);
    this.suite?.add(id);
    return entry;
  }

  private prune(id: string): void {
    const hist = join(this.dir, 'history', id);
    const files = readdirSync(hist)
      .filter((f) => /^\d+\.json$/.test(f))
      .map((f) => Number(f.slice(0, -5)))
      .sort((a, b) => a - b);
    for (const at of files.slice(0, Math.max(0, files.length - KEEP_VERSIONS))) rmSync(join(hist, `${at}.json`), { force: true });
  }
}

export interface PublishOptions {
  /** Owner accounts (Cognito `sub`s) that may publish. Empty: nobody can. */
  owners: ReadonlySet<string>;
  /** Checks a sign-in token (auth.ts verifyCognitoToken with the hub's pool); null when sign-in isn't set up. */
  verify: ((token: string) => Promise<VerifiedUser>) | null;
  trustProxy: boolean;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new PublishError('the map is too large', 413));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

/**
 * /api/v1/maps: the published maps for everyone to read, and publishing for owners.
 *   GET    /api/v1/maps                         the list (PublishedEntry[])
 *   GET    /api/v1/maps/<id>                    a published map's file
 *   GET    /api/v1/maps/<id>/versions           owner: its kept versions
 *   PUT    /api/v1/maps/<id>                    owner: publish (body: the map, JSON, optionally gzipped)
 *   POST   /api/v1/maps/<id>/rollback?at=<ms>   owner: publish an earlier version again
 *   DELETE /api/v1/maps/<id>                    owner: take it down (the built-in map is used again)
 *   GET    /api/v1/owner                        whether this signed-in account may publish ({ owner, sub })
 */
export function publishHandler(store: PublishedMaps, o: PublishOptions) {
  const reads = new KeyedLimiter({ perMinute: 240, burst: 120 });
  const writes = new KeyedLimiter({ perMinute: 20, burst: 10 });
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://hub');
    const path = url.pathname.replace(/\/+$/, '');
    const ownerPath = path === '/api/v1/owner';
    if (!ownerPath && path !== '/api/v1/maps' && !path.startsWith('/api/v1/maps/')) return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Encoding');
    res.setHeader('Access-Control-Max-Age', '600');
    const send = (status: number, body: unknown, cache = 'no-store') => {
      res.statusCode = status;
      res.setHeader('Cache-Control', cache);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return void ((res.statusCode = 204), res.end());
    const ip = clientIp(req, o.trustProxy);
    const [, , , , id, action] = path.split('/');
    // Reading is open to everyone (the site, MapMaker, Host Services).
    if (req.method === 'GET' && !ownerPath && action === undefined) {
      if (!reads.allow(ip)) return send(429, { error: 'slow down' });
      if (!id) return send(200, { maps: store.list() }, 'public, max-age=30');
      const text = store.get(id);
      return text ? send(200, text, 'public, max-age=30') : send(404, { error: 'not published' });
    }
    // Everything else is the owner's.
    if (!writes.allow(ip)) return send(429, { error: 'slow down' });
    const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(String(req.headers.authorization ?? ''));
    if (!o.verify) return send(404, { error: 'sign-in is not set up on this hub' });
    if (!m) return send(401, { error: 'sign in first' });
    let user: VerifiedUser;
    try {
      user = await o.verify(m[1]!);
    } catch (e) {
      return send(401, { error: (e as Error).message || 'sign-in could not be checked' });
    }
    const owner = o.owners.has(user.sub);
    if (ownerPath && req.method === 'GET') return send(200, { owner, sub: user.sub });
    if (!owner) return send(403, { error: 'only the owner publishes maps' });
    if (!id || !isMapId(id)) return send(400, { error: 'bad map ID' });
    try {
      if (req.method === 'GET' && action === 'versions') return send(200, { versions: store.versions(id) });
      if (req.method === 'POST' && action === 'rollback') {
        const entry = store.rollback(id, Number(url.searchParams.get('at')), user);
        console.log(`[publish] ${user.sub} rolled ${id} back to ${url.searchParams.get('at')}`);
        return send(200, entry);
      }
      if (req.method === 'DELETE' && action === undefined) {
        const gone = store.unpublish(id);
        if (gone) console.log(`[publish] ${user.sub} took ${id} down`);
        return send(gone ? 200 : 404, gone ? { ok: true } : { error: 'not published' });
      }
      if (req.method === 'PUT' && action === undefined) {
        let body = await readBody(req);
        if (String(req.headers['content-encoding'] ?? '').toLowerCase() === 'gzip') {
          try {
            body = gunzipSync(body, { maxOutputLength: MAX_MAP_BYTES });
          } catch {
            throw new PublishError('the map is too large or not gzip');
          }
        }
        const text = body.toString('utf8');
        store.check(text, id);
        const entry = store.publish(text, user);
        console.log(`[publish] ${user.sub} published ${id} (${entry.name}, ${entry.hash.slice(0, 12)})`);
        return send(200, entry);
      }
      return send(405, { error: 'method not allowed' });
    } catch (e) {
      if (e instanceof PublishError) return send(e.status, { error: e.message });
      console.error('[publish]', e);
      return send(500, { error: 'publishing failed' });
    }
  };
}
