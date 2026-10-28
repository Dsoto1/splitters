import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { KeyedLimiter, isRegion, usernameKey, usernameProblem, type Profile, type Region } from '@tiletrigger/shared';
import { clientIp } from './clientIp.ts';
import type { VerifiedUser } from './auth.ts';

/**
 * Player profiles (shared/net/profile.ts): a signed-in player's username,
 * unique in Tile Trigger whatever the case, and region, by Cognito account.
 * Kept in PROFILES_DIR/profiles.json (one small file: written whole, in one
 * step, on each change). The name and email of the player's Google account are
 * never stored or shown. Account tickets (tickets.ts) carry the username, so a
 * host shows it as a verified account.
 */
export class ProfileStore {
  private bySub = new Map<string, { username: string | null; region: Region | null; at: number }>();
  private byName = new Map<string, string>();
  private readonly file: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'profiles.json');
    if (existsSync(this.file)) {
      const all = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, { username: string | null; region: Region | null; at: number }>;
      for (const [sub, p] of Object.entries(all)) {
        this.bySub.set(sub, p);
        if (p.username) this.byName.set(usernameKey(p.username), sub);
      }
    }
  }

  get(sub: string): Profile {
    const p = this.bySub.get(sub);
    return { username: p?.username ?? null, region: p?.region ?? null };
  }

  /** The username of this account, if it has one. */
  username(sub: string): string | null {
    return this.bySub.get(sub)?.username ?? null;
  }

  /** Why `name` can't be this account's username (taken, or not allowed), or null. */
  problem(sub: string, name: string): string | null {
    const bad = usernameProblem(name);
    if (bad) return bad;
    const owner = this.byName.get(usernameKey(name));
    return owner && owner !== sub ? 'that name is taken' : null;
  }

  /** Change what's given (`username`, `region`); throws with a message for the page. */
  update(sub: string, patch: { username?: unknown; region?: unknown }): Profile {
    const cur = this.bySub.get(sub) ?? { username: null, region: null, at: 0 };
    const next = { ...cur, at: Date.now() };
    if (patch.username !== undefined) {
      if (typeof patch.username !== 'string') throw new Error('username must be text');
      const name = patch.username.trim();
      const why = this.problem(sub, name);
      if (why) throw new Error(why);
      next.username = name;
    }
    if (patch.region !== undefined) {
      if (patch.region !== null && !isRegion(patch.region)) throw new Error('unknown region');
      next.region = patch.region;
    }
    if (cur.username && cur.username !== next.username) this.byName.delete(usernameKey(cur.username));
    if (next.username) this.byName.set(usernameKey(next.username), sub);
    this.bySub.set(sub, next);
    this.save();
    return this.get(sub);
  }

  private save(): void {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.bySub)));
    renameSync(tmp, this.file);
  }
}

/**
 * /api/v1/profile (signed in):
 *   GET  /api/v1/profile                 { username, region }
 *   PUT  /api/v1/profile                 { username?, region? } → the profile, or { error }
 *   GET  /api/v1/profile/check?name=…    { ok, problem? }: whether this account could take the name
 */
export function profileHandler(store: ProfileStore, o: { verify: ((token: string) => Promise<VerifiedUser>) | null; trustProxy: boolean }) {
  const reads = new KeyedLimiter({ perMinute: 120, burst: 40 });
  const writes = new KeyedLimiter({ perMinute: 10, burst: 5 });
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://hub');
    const path = url.pathname.replace(/\/+$/, '');
    if (path !== '/api/v1/profile' && path !== '/api/v1/profile/check') return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return void ((res.statusCode = 204), res.end());
    const ip = clientIp(req, o.trustProxy);
    const writing = req.method === 'PUT';
    if (!(writing ? writes : reads).allow(ip)) return send(429, { error: 'slow down' });
    if (!o.verify) return send(404, { error: 'sign-in is not set up on this hub' });
    const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(String(req.headers.authorization ?? ''));
    if (!m) return send(401, { error: 'sign in first' });
    let user: VerifiedUser;
    try {
      user = await o.verify(m[1]!);
    } catch (e) {
      return send(401, { error: (e as Error).message || 'sign-in could not be checked' });
    }
    if (path === '/api/v1/profile/check' && req.method === 'GET') {
      const problem = store.problem(user.sub, (url.searchParams.get('name') ?? '').trim());
      return send(200, problem ? { ok: false, problem } : { ok: true });
    }
    if (path !== '/api/v1/profile') return send(404, { error: 'not found' });
    if (req.method === 'GET') return send(200, store.get(user.sub));
    if (!writing) return send(405, { error: 'method not allowed' });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 2048) return send(413, { error: 'too large' });
      chunks.push(c as Buffer);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return send(400, { error: 'send JSON' });
    }
    if (typeof body !== 'object' || body === null) return send(400, { error: 'send a JSON object' });
    try {
      return send(200, store.update(user.sub, body as { username?: unknown; region?: unknown }));
    } catch (e) {
      return send(400, { error: (e as Error).message });
    }
  };
}
