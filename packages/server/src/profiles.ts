import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { CLASS_IDS, HISTORY_AGE_DAYS, keysShape, opticShape, addVouched, readVouched, vouchProblem, type VouchReport, type Vouched, KeyedLimiter, addMatch, cleanEmblemCode, hasTitle, isTitleId, careerProblem, cleanSummary, emptyCareer, isRegion, matchProblem, readCareer, usernameKey, usernameProblem, type Career, type MatchSummary, type Profile, type PublicCard, type Region } from '@tiletrigger/shared';
import { clientIp } from './clientIp.ts';
import type { VerifiedUser } from './auth.ts';

/** What the file keeps per account (missing fields: older files, read as empty). */
interface Stored {
  username: string | null;
  region: Region | null;
  at: number;
  favClass?: string | null;
  career?: Career;
  /** Phase 2: the emblem ("<id>.<colour>") and the title the player wears. */
  emblem?: string | null;
  title?: string | null;
  /** Phase 4: what other people's hosts counted (net/vouch.ts). */
  vouched?: Vouched;
  /** Optic picks per gun (the same list as hello.op; its shape checked here, which optic fits which gun the match checks). */
  optics?: Record<string, string>;
  /** Key bindings (client keyBindings.ts: action → "key,alt", changes from the defaults only; shape checked here). */
  keys?: Record<string, string>;
}

/** How long the hub remembers the tickets it gave for a join code (a host's report comes at a match's end). */
const TICKET_MEMORY_MS = 6 * 3600_000;
const MAX_TICKET_CODES = 5000;
const MAX_TICKETS_PER_CODE = 128;

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
  /** Phase 4: the tickets given, by join code: account → when (vouch() keeps lines only for these). */
  private readonly tickets = new Map<string, { at: number; subs: Map<string, number> }>();
  /** Phase 4: when a host last vouched for an account in a game (`code|sub`), so lines come no faster than play. */
  private readonly lastVouch = new Map<string, number>();
  /** The clock (tests move it). */
  now: () => number = Date.now;

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
    return { username: p?.username ?? null, region: p?.region ?? null, favClass: p?.favClass ?? null, career: readCareer(p?.career) ?? emptyCareer(), emblem: cleanEmblemCode(p?.emblem), title: p?.title && isTitleId(p.title) ? p.title : null, vouched: readVouched(p?.vouched), optics: opticShape(p?.optics, true) ?? {}, keys: keysShape(p?.keys) ?? {} };
  }

  /** A player's public card by username (any case), or null when no account has that name. */
  card(name: string): PublicCard | null {
    const sub = this.byName.get(usernameKey(name.trim()));
    const p = sub ? this.get(sub) : null;
    if (!p?.username) return null;
    return { username: p.username, emblem: p.emblem, title: p.title, favClass: p.favClass, career: p.career, vouched: p.vouched };
  }

  /** The hub gave this account a ticket to join this code (auth.ts): a host's report may vouch for it there. */
  ticketIssued(code: string, sub: string): void {
    const t = this.now();
    let e = this.tickets.get(code);
    if (!e) {
      if (this.tickets.size >= MAX_TICKET_CODES) this.prune(t);
      if (this.tickets.size >= MAX_TICKET_CODES) this.tickets.delete(this.tickets.keys().next().value!);
      this.tickets.set(code, (e = { at: t, subs: new Map() }));
    }
    e.at = t;
    if (e.subs.has(sub) || e.subs.size < MAX_TICKETS_PER_CODE) e.subs.set(sub, e.subs.get(sub) ?? t);
  }

  private prune(t: number): void {
    for (const [k, v] of this.tickets) if (t - v.at > TICKET_MEMORY_MS) this.tickets.delete(k);
    for (const [k, at] of this.lastVouch) if (t - at > TICKET_MEMORY_MS) this.lastVouch.delete(k);
  }

  /**
   * A host's end-of-match standings (net/vouch.ts, Phase 4): each line counts for its account when the hub gave that
   * account a ticket for this code in the last few hours, it isn't the host's own account, and the time it claims
   * fits since the ticket and since the last line for that account in this game. Returns how many counted.
   */
  vouch(hostSub: string, report: unknown): { counted: number } {
    const why = vouchProblem(report);
    if (why) throw new Error(why);
    const r = report as VouchReport;
    const t = this.now();
    this.prune(t);
    const given = this.tickets.get(r.code);
    let counted = 0;
    const seen = new Set<string>();
    for (const l of r.lines) {
      if (l.sub === hostSub || seen.has(l.sub)) continue;
      seen.add(l.sub);
      const since = given?.subs.get(l.sub);
      if (since === undefined) continue;
      const key = `${r.code}|${l.sub}`;
      const from = Math.max(since, this.lastVouch.get(key) ?? 0);
      // (A minute's grace: the ticket comes a moment before the player is in.)
      if (l.seconds * 1000 > t - from + 60_000) continue;
      this.lastVouch.set(key, t);
      const cur = this.bySub.get(l.sub) ?? { username: null, region: null, at: 0 };
      this.bySub.set(l.sub, { ...cur, vouched: addVouched(readVouched(cur.vouched), l), at: t });
      counted++;
    }
    if (counted) this.save(true);
    return { counted };
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
  update(sub: string, patch: { username?: unknown; region?: unknown; favClass?: unknown; emblem?: unknown; title?: unknown; optics?: unknown; keys?: unknown }): Profile {
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
    if (patch.emblem !== undefined) {
      if (patch.emblem !== null && !cleanEmblemCode(patch.emblem)) throw new Error('unknown emblem');
      next.emblem = patch.emblem === null ? null : cleanEmblemCode(patch.emblem);
    }
    if (patch.optics !== undefined) {
      const op = opticShape(patch.optics, true);
      if (!op) throw new Error('bad optic picks');
      next.optics = op;
    }
    if (patch.keys !== undefined) {
      const k = keysShape(patch.keys);
      if (!k) throw new Error('bad key bindings');
      next.keys = k;
    }
    if (patch.title !== undefined) {
      if (patch.title !== null && !isTitleId(patch.title)) throw new Error('unknown title');
      if (patch.title !== null && !hasTitle(readCareer(cur.career) ?? emptyCareer(), patch.title)) throw new Error('that title is not earned yet');
      next.title = patch.title as string | null;
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
    // Its history line's time: the browser's own (a match that waited for the hub ended earlier), within the last
    // HISTORY_AGE_DAYS and not ahead of the hub's clock; else now.
    const now = Math.floor(Date.now() / 1000);
    const said = (summary as MatchSummary).at;
    const at = typeof said === 'number' && said <= now + 60 && said >= now - HISTORY_AGE_DAYS * 86_400 ? Math.min(said, now) : now;
    const career = addMatch(readCareer(cur.career) ?? emptyCareer(), cleanSummary(summary as MatchSummary), at);
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
 *   PUT  /api/v1/profile                 also { emblem } ("<id>.<colour>", or null) and { title } (an earned title id, or null)
 *   GET  /api/v1/profile/card?u=<name>   anyone: that player's public card (PublicCard), or 404
 *   POST /api/v1/profile/vouch           signed in (a host): its end-of-match standings (net/vouch.ts) → { counted }
 */
export function profileHandler(store: ProfileStore, o: { verify: ((token: string) => Promise<VerifiedUser>) | null; trustProxy: boolean }) {
  const reads = new KeyedLimiter({ perMinute: 120, burst: 40 });
  const writes = new KeyedLimiter({ perMinute: 10, burst: 5 });
  // Match summaries by account: a match lasts minutes, so a few a minute (a browser sending the ones it held while the hub was away).
  const matches = new KeyedLimiter({ perMinute: 3, burst: 6 });
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://hub');
    const path = url.pathname.replace(/\/+$/, '');
    const routes = ['/api/v1/profile', '/api/v1/profile/check', '/api/v1/profile/match', '/api/v1/profile/career', '/api/v1/profile/card', '/api/v1/profile/vouch'];
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
    // Another player's card: public fields, no sign-in (a scoreboard row's card; the roster's ✓ proved the name).
    if (path === '/api/v1/profile/card') {
      if (req.method !== 'GET') return send(405, { error: 'method not allowed' });
      const card = store.card(url.searchParams.get('u') ?? '');
      return card ? send(200, card) : send(404, { error: 'no such player' });
    }
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
    const posting = path === '/api/v1/profile/match' || path === '/api/v1/profile/career' || path === '/api/v1/profile/vouch';
    if (path === '/api/v1/profile' && req.method === 'GET') return send(200, store.get(user.sub));
    if (req.method !== (posting ? 'POST' : 'PUT')) return send(405, { error: 'method not allowed' });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      // A guest's career moving onto an account carries its modes, guns and history (Phase 3): a few KB more.
      if (size > (path === '/api/v1/profile/career' || path === '/api/v1/profile/vouch' ? 16_384 : 4096)) return send(413, { error: 'too large' });
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
      if (path === '/api/v1/profile/vouch') return matches.allow(`v:${user.sub}`) ? send(200, store.vouch(user.sub, body)) : send(429, { error: 'slow down' });
      return send(200, store.update(user.sub, body as Record<string, unknown>));
    } catch (e) {
      return send(400, { error: (e as Error).message });
    }
  };
}
