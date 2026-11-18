import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { CLASS_IDS, KeyedLimiter, addMatch, careerProblem, cleanSummary, emptyCareer, isRegion, matchProblem, readCareer, usernameKey, usernameProblem, type Career, type MatchSummary, type Profile, type Region } from '@tiletrigger/shared';
import { clientIp } from './clientIp.ts';
import type { VerifiedUser } from './auth.ts';

/** What the file keeps per account (missing fields: older files, read as empty). */
interface Stored {
  username: string | null;
  region: Region | null;
  at: number;
  favClass?: string | null;
  career?: Career;
}

/**
 * Player profiles (shared/net/profile.ts): a signed-in player's username,
 * unique in Tile Trigger whatever the case, region, favourite class and career
 * stats (shared/net/career.ts), by Cognito account. Kept in
 * PROFILES_DIR/profiles.json (one small file: written whole, in one step; a
 * username or region at once, a match within a couple of seconds, so a busy
 * evening's match ends write it once). The name and email of the player's Google account are
 * never stored or shown. Account tickets (tickets.ts) carry the username, so a
 * host shows it as a verified account.
 */
export class ProfileStore {
  private bySub = new Map<string, Stored>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private byName = new Map<string, string>();
  private readonly file: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'profiles.json');
    if (existsSync(this.file)) {
      const all = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, Stored>;
      for (const [sub, p] of Object.entries(all)) {
        this.bySub.set(sub, p);
        if (p.username) this.byName.set(usernameKey(p.username), sub);
      }
    }
  }

  get(sub: string): Profile {
    const p = this.bySub.get(sub);
    return { username: p?.username ?? null, region: p?.region ?? null, favClass: p?.favClass ?? null, career: readCareer(p?.career) ?? emptyCareer() };
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

  /** Change what's given (`username`, `region`, `favClass`); throws with a message for the page. */
  update(sub: string, patch: { username?: unknown; region?: unknown; favClass?: unknown }): Profile {
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
    if (patch.favClass !== undefined) {
      if (patch.favClass !== null && !(CLASS_IDS as readonly unknown[]).includes(patch.favClass)) throw new Error('unknown class');
      next.favClass = patch.favClass as string | null;
    }
    if (cur.username && cur.username !== next.username) this.byName.delete(usernameKey(cur.username));
    if (next.username) this.byName.set(usernameKey(next.username), sub);
    this.bySub.set(sub, next);
    this.save();
    return this.get(sub);
  }

  /**
   * One match more on this account's career (shared/net/career.ts); throws with a message when the summary is
   * out of bounds. (How often an account may send one is the handler's: a few a minute.)
   */
  addMatch(sub: string, summary: unknown): Career {
    const why = matchProblem(summary);
    if (why) throw new Error(why);
    const cur = this.bySub.get(sub) ?? { username: null, region: null, at: 0 };
    const career = addMatch(readCareer(cur.career) ?? emptyCareer(), cleanSummary(summary as MatchSummary));
    this.bySub.set(sub, { ...cur, career, at: Date.now() });
    this.save(true);
    return career;
  }

  /**
   * The one-time move of a guest's career (kept in their browser) onto this account, at their first sign-in: only
   * while the account has no matches of its own, and only totals real matches could make (careerProblem).
   */
  importCareer(sub: string, career: unknown): Career {
    const why = careerProblem(career);
    if (why) throw new Error(why);
    const cur = this.bySub.get(sub) ?? { username: null, region: null, at: 0 };
    if ((readCareer(cur.career)?.matches ?? 0) > 0) throw new Error('this account has a career already');
    const next = readCareer(career)!;
    this.bySub.set(sub, { ...cur, career: next, at: Date.now() });
    this.save(true);
    return next;
  }

  /** Write anything waiting now (a match's write waits a moment; a shutdown or a test calls this). */
  flush(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.write();
  }

  private save(soon = false): void {
    if (!soon) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = null;
      return this.write();
    }
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.write();
    }, 2000);
    this.saveTimer.unref?.();
  }

  private write(): void {
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
 *   PUT  /api/v1/profile                 also { favClass } (a class id, or null)
 *   POST /api/v1/profile/match           a match summary (shared/net/career.ts) → { career }, or { error }
 *   POST /api/v1/profile/career          a guest's career, moved once onto an account with none → { career }, or { error }
 */
export function profileHandler(store: ProfileStore, o: { verify: ((token: string) => Promise<VerifiedUser>) | null; trustProxy: boolean }) {
  const reads = new KeyedLimiter({ perMinute: 120, burst: 40 });
  const writes = new KeyedLimiter({ perMinute: 10, burst: 5 });
  // Match summaries by account: a match lasts minutes, so a few a minute (a browser sending the ones it held while the hub was away).
  const matches = new KeyedLimiter({ perMinute: 3, burst: 6 });
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://hub');
    const path = url.pathname.replace(/\/+$/, '');
    const routes = ['/api/v1/profile', '/api/v1/profile/check', '/api/v1/profile/match', '/api/v1/profile/career'];
    if (!routes.includes(path)) return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return void ((res.statusCode = 204), res.end());
    const ip = clientIp(req, o.trustProxy);
    const writing = req.method === 'PUT' || req.method === 'POST';
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
    if (path === '/api/v1/profile/check') return send(405, { error: 'method not allowed' });
    const posting = path === '/api/v1/profile/match' || path === '/api/v1/profile/career';
    if (path === '/api/v1/profile' && req.method === 'GET') return send(200, store.get(user.sub));
    if (req.method !== (posting ? 'POST' : 'PUT')) return send(405, { error: 'method not allowed' });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 4096) return send(413, { error: 'too large' });
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
      if (path === '/api/v1/profile/match') return matches.allow(user.sub) ? send(200, { career: store.addMatch(user.sub, body) }) : send(429, { error: 'slow down' });
      if (path === '/api/v1/profile/career') return send(200, { career: store.importCareer(user.sub, body) });
      return send(200, store.update(user.sub, body as { username?: unknown; region?: unknown; favClass?: unknown }));
    } catch (e) {
      return send(400, { error: (e as Error).message });
    }
  };
}
