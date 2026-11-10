import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  CONTENT_HASH_RE,
  DEFAULT_THRESHOLDS,
  EARLY_QUIT_MINUTES,
  HOST_MATCH_INTERVAL_MINUTES,
  MAX_REPORTED_PLAYERS,
  blockedWord,
  missingForPick,
  reportsHide,
  type CommunityPick,
  type CommunityStatus,
  type LobbyAdvert,
  type PlayReport,
  type PlayTally,
  type PromotionThresholds,
  KeyedLimiter,
} from '@tiletrigger/shared';
import type { VerifiedUser } from './auth.ts';
import { clientIp } from './clientIp.ts';
import { MAX_PICK_BYTES } from './communityCheck.ts';
import { PublishError, type PublishedMaps } from './publish.ts';

/**
 * Community maps on the hub (docs/COMMUNITY_MAPS.md): play statistics per map version, automatic promotion to
 * Community Picks, the picks' files, reports and auto-hide, creators withdrawing their maps, and the owner's summary.
 *
 * Kept in COMMUNITY_DIR:
 *   community.json        every map version's numbers and state, the creators by map ID, the hosts' last counted match
 *   picks/<hex>.json      a Community Pick's file, as a client sent it (checked against its content hash)
 * Accounts are never kept in the clear: each is a short salted hash (`pid`), the salt made once per hub. A version's
 * entry is a few hundred bytes (its players' pids, its hosts', its days, its reporters').
 *
 * Who counts (the counting rules):
 * - signed-in accounts only, each once per map version: a host names accounts, and the hub counts only those it gave
 *   an account ticket for that listing's join code (so a host can't make players up);
 * - bots never count (they have no account);
 * - the creator's own plays don't count, and the creator hosting doesn't count as one of the hosts;
 * - each host contributes at most one match per HOST_MATCH_INTERVAL_MINUTES.
 */

/** How long a community listing's join code is remembered after its last check-in (a report comes at the match's end). */
const CODE_MEMORY_MS = 6 * 3600_000;
/** Accounts remembered per join code (tickets given), and join codes remembered in all. */
const MAX_TICKETS_PER_CODE = 200;
const MAX_CODES = 20_000;

export interface VersionRecord {
  mapId: string;
  versionId: string;
  name: string;
  status: CommunityStatus;
  /** First and last time it was listed or played (ms). */
  firstAt: number;
  lastAt: number;
  /** Counted players: pid → 1 while every counted play of theirs was an early quit, 0 once one wasn't. */
  players: Record<string, 0 | 1>;
  hosts: string[];
  /** UTC day numbers with counted plays. */
  days: number[];
  minutes: number;
  matches: number;
  /** Accounts (pids) that reported it. */
  reporters: string[];
  /** Reports the owner has looked at (restored it after). */
  reviewed: number;
  /** Why the hub's check turned its file down ('failed'), or why it is in its state. */
  reason?: string;
  /** The state before an auto-hide (restored to it). */
  before?: CommunityStatus;
  pickedAt?: number;
  /** From its file, once kept (the picks list). */
  description?: string;
  modes?: string[];
  recommendedPlayers?: { min: number; max: number };
}

interface MapRecord {
  /** The creator's pid, and their username when they listed it. */
  creator: string;
  creatorName: string;
  at: number;
  withdrawn?: number;
}

interface Saved {
  salt: string;
  versions: Record<string, VersionRecord>;
  maps: Record<string, MapRecord>;
  hostLast: Record<string, number>;
}

/** The hub's check of a map file sent for a pick (communityCheck.ts): its details, or why it failed. */
export type PickCheck = { ok: true; name: string; description: string; modes: string[]; recommendedPlayers: { min: number; max: number } } | { ok: false; reason: string };

export class CommunityError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const hexOf = (hash: string) => hash.replace(/^sha256:/, '');
const dayOf = (ms: number) => Math.floor(ms / 86_400_000);

export class CommunityStore {
  private data: Saved;
  private readonly file: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Live and recent community listings by join code (for the hosts' reports). */
  private readonly codes = new Map<string, { hash: string; mapId: string; at: number }>();
  /** Accounts the hub gave a ticket for each join code. */
  private readonly tickets = new Map<string, { subs: Set<string>; at: number }>();
  private readonly checking = new Set<string>();

  constructor(
    readonly dir: string,
    readonly thresholds: PromotionThresholds = DEFAULT_THRESHOLDS,
    readonly blockedWords: readonly string[] = [],
    private readonly now: () => number = Date.now,
  ) {
    mkdirSync(join(dir, 'picks'), { recursive: true });
    this.file = join(dir, 'community.json');
    const loaded = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Saved>) : {};
    this.data = { salt: loaded.salt || randomBytes(16).toString('hex'), versions: loaded.versions ?? {}, maps: loaded.maps ?? {}, hostLast: loaded.hostLast ?? {} };
    if (!loaded.salt) this.saveNow();
  }

  /** An account's short salted hash. */
  pid(sub: string): string {
    return createHash('sha256').update(`${this.data.salt}:${sub}`).digest('base64url').slice(0, 12);
  }

  // ---------------------------------------------------------------- listings (lobby.ts)

  /** Why this listing can't go up (a word in its text, a map that is hidden, taken down or withdrawn), or null. */
  listingProblem(a: Pick<LobbyAdvert, 'name' | 'host' | 'map' | 'community' | 'mapId' | 'contentHash'>): string | null {
    for (const t of [a.name, a.host, a.map]) if (blockedWord(t, this.blockedWords)) return "a word in the listing's name or its map's name isn't allowed: pick another";
    if (!a.community) return null;
    if (a.mapId && this.data.maps[a.mapId]?.withdrawn) return 'its creator withdrew this map';
    const v = a.contentHash ? this.data.versions[a.contentHash] : undefined;
    if (v?.status === 'hidden') return 'this map is hidden after reports, until the game\'s owner looks at it';
    if (v?.status === 'removed') return "this map was taken down by the game's owner";
    return null;
  }

  /**
   * A community listing went up or checked in: remember its join code (for the host's report), and the map's creator
   * the first time a signed-in account lists its map ID.
   */
  listed(a: LobbyAdvert, sub: string | null, username: string | null): void {
    if (!a.community || !a.contentHash || !a.mapId || !a.versionId) return;
    const t = this.now();
    this.codes.set(a.code, { hash: a.contentHash, mapId: a.mapId, at: t });
    if (this.codes.size > MAX_CODES) this.pruneCodes();
    let changed = false;
    const v = this.data.versions[a.contentHash];
    if (!v) {
      this.data.versions[a.contentHash] = { mapId: a.mapId, versionId: a.versionId, name: a.map, status: 'open', firstAt: t, lastAt: t, players: {}, hosts: [], days: [], minutes: 0, matches: 0, reporters: [], reviewed: 0 };
      changed = true;
    } else if (t - v.lastAt > 3600_000) {
      v.lastAt = t;
      changed = true;
    }
    const m = this.data.maps[a.mapId];
    if (sub && !m) {
      this.data.maps[a.mapId] = { creator: this.pid(sub), creatorName: username ?? '', at: t };
      changed = true;
    } else if (sub && m && m.creator === this.pid(sub) && username && m.creatorName !== username) {
      m.creatorName = username;
      changed = true;
    }
    if (changed) this.save();
  }

  /** What the game browser adds to a community listing: its creator and whether it is a pick. */
  decorate(contentHash: string | undefined, mapId: string | undefined): { creator?: string; pick?: boolean } {
    const creator = mapId ? this.data.maps[mapId]?.creatorName : undefined;
    const pick = contentHash ? this.data.versions[contentHash]?.status === 'pick' : false;
    return { ...(creator ? { creator } : {}), ...(pick ? { pick } : {}) };
  }

  /** The hub gave this account a ticket to join this code (auth.ts). */
  ticketIssued(code: string, sub: string): void {
    const t = this.now();
    let e = this.tickets.get(code);
    if (!e) {
      e = { subs: new Set(), at: t };
      this.tickets.set(code, e);
      if (this.tickets.size > MAX_CODES) this.pruneCodes();
    }
    e.at = t;
    if (e.subs.size < MAX_TICKETS_PER_CODE) e.subs.add(sub);
  }

  private pruneCodes(): void {
    const cutoff = this.now() - CODE_MEMORY_MS;
    for (const [k, v] of this.codes) if (v.at < cutoff) this.codes.delete(k);
    for (const [k, v] of this.tickets) if (v.at < cutoff) this.tickets.delete(k);
  }

  // ---------------------------------------------------------------- play statistics

  /**
   * A host's end-of-match report. Returns what counted, and whether the hub wants the map's file (a version that
   * just cleared the thresholds: the host sends it once, PUT /api/v1/community/maps/<hex>/file).
   */
  report(hostSub: string, r: PlayReport): { counted: number; reason?: string; wantFile: boolean } {
    this.pruneCodes();
    const t = this.now();
    const listing = this.codes.get(r.code);
    if (!listing || listing.hash !== r.contentHash) throw new CommunityError('no community listing with that join code and map', 404);
    const v = this.data.versions[r.contentHash];
    if (!v) throw new CommunityError('no such map version', 404);
    const wantFile = v.status === 'wanted';
    if (v.status !== 'open' && v.status !== 'wanted' && v.status !== 'pick') return { counted: 0, reason: `the map is ${v.status}`, wantFile };
    const host = this.pid(hostSub);
    const last = this.data.hostLast[host] ?? 0;
    if (t - last < HOST_MATCH_INTERVAL_MINUTES * 60_000) return { counted: 0, reason: 'this host had a match counted within the hour', wantFile };
    const creator = this.data.maps[v.mapId]?.creator;
    const proven = this.tickets.get(r.code)?.subs ?? new Set<string>();
    const seen = new Set<string>();
    let counted = 0;
    let minutes = 0;
    for (const p of r.players.slice(0, MAX_REPORTED_PLAYERS)) {
      if (typeof p?.sub !== 'string' || seen.has(p.sub)) continue;
      seen.add(p.sub);
      // The host's own account is proven by its sign-in; everyone else by the ticket the hub gave them for this code.
      if (p.sub !== hostSub && !proven.has(p.sub)) continue;
      const pid = this.pid(p.sub);
      if (pid === creator) continue;
      const mins = Math.max(0, Math.min(24 * 60, Number(p.minutes) || 0));
      const early = !!p.early && mins < EARLY_QUIT_MINUTES;
      const before = v.players[pid];
      v.players[pid] = before === undefined ? (early ? 1 : 0) : before === 1 && early ? 1 : 0;
      minutes += mins;
      counted++;
    }
    if (!counted) return { counted: 0, reason: 'no signed-in players to count', wantFile };
    this.data.hostLast[host] = t;
    for (const [k, at] of Object.entries(this.data.hostLast)) if (t - at > HOST_MATCH_INTERVAL_MINUTES * 60_000) delete this.data.hostLast[k];
    this.data.hostLast[host] = t;
    if (host !== creator && !v.hosts.includes(host)) v.hosts.push(host);
    const day = dayOf(t);
    if (!v.days.includes(day)) v.days.push(day);
    v.minutes += Math.round(minutes);
    v.matches++;
    v.lastAt = t;
    if (v.status === 'open' && missingForPick(this.tally(v), this.thresholds).length === 0) v.status = 'wanted';
    this.save();
    return { counted, wantFile: v.status === 'wanted' };
  }

  tally(v: VersionRecord): PlayTally {
    return { players: Object.keys(v.players).length, earlyQuits: Object.values(v.players).filter((x) => x === 1).length, hosts: v.hosts.length, days: v.days.length, reports: v.reporters.length, reviewedReports: v.reviewed };
  }

  // ---------------------------------------------------------------- picks: the one-time map file

  /** Whether the hub wants this version's file now (it cleared the thresholds and has none yet). */
  wantsFile(contentHash: string): boolean {
    return this.data.versions[contentHash]?.status === 'wanted' && !this.checking.has(contentHash);
  }

  /**
   * A client sent the file of a version the hub wants. `check` is the hub's own check (communityCheck.ts: it loads,
   * validates with MapMaker's budgets, its content hash is this one, spawns reachable, no logic loops, the word filter).
   * Passed, it becomes a Community Pick and its file is kept.
   */
  async receiveFile(contentHash: string, text: string, check: (text: string, hash: string) => Promise<PickCheck>): Promise<CommunityStatus> {
    if (!CONTENT_HASH_RE.test(contentHash)) throw new CommunityError('bad content hash');
    if (!this.wantsFile(contentHash)) throw new CommunityError('the hub is not asking for this map', 409);
    this.checking.add(contentHash);
    try {
      const r = await check(text, contentHash);
      const v = this.data.versions[contentHash];
      if (!v || v.status !== 'wanted') return v?.status ?? 'removed';
      if (!r.ok) {
        // A file that doesn't hash to this version proves nothing about it: ask the next client instead.
        if (/content hash/.test(r.reason)) throw new CommunityError(r.reason, 400);
        v.status = 'failed';
        v.reason = r.reason;
      } else {
        writeFileSync(join(this.dir, 'picks', `${hexOf(contentHash)}.json`), text);
        Object.assign(v, { status: 'pick' as const, pickedAt: this.now(), name: r.name, description: r.description, modes: r.modes, recommendedPlayers: r.recommendedPlayers });
        delete v.reason;
      }
      this.save();
      return v.status;
    } finally {
      this.checking.delete(contentHash);
    }
  }

  /** Every Community Pick (not hidden, withdrawn or taken down), most played first. */
  picks(): CommunityPick[] {
    return Object.entries(this.data.versions)
      .filter(([, v]) => v.status === 'pick' && !this.data.maps[v.mapId]?.withdrawn)
      .map(([contentHash, v]) => ({
        contentHash,
        mapId: v.mapId,
        versionId: v.versionId,
        name: v.name,
        description: v.description ?? '',
        creator: this.data.maps[v.mapId]?.creatorName ?? '',
        modes: v.modes ?? [],
        recommendedPlayers: v.recommendedPlayers ?? { min: 2, max: 8 },
        players: Object.keys(v.players).length,
        pickedAt: v.pickedAt ?? 0,
      }))
      .sort((a, b) => b.players - a.players || a.name.localeCompare(b.name));
  }

  /** A kept pick's file (also an Official one's, for the owner), or null. */
  pickFile(contentHash: string, owner = false): string | null {
    const v = this.data.versions[contentHash];
    if (!v || !(v.status === 'pick' || (owner && (v.status === 'hidden' || v.status === 'official'))) || this.data.maps[v.mapId]?.withdrawn) return null;
    try {
      return readFileSync(join(this.dir, 'picks', `${hexOf(contentHash)}.json`), 'utf8');
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- safety

  /** A signed-in player reports a community map version (once per account). Past the threshold it hides. */
  reportMap(sub: string, contentHash: string): { reports: number; hidden: boolean } {
    const v = this.data.versions[contentHash];
    if (!v) throw new CommunityError('no such community map', 404);
    const pid = this.pid(sub);
    if (pid !== this.data.maps[v.mapId]?.creator && !v.reporters.includes(pid)) {
      v.reporters.push(pid);
      if (v.status !== 'hidden' && v.status !== 'removed' && v.status !== 'official' && reportsHide(this.tally(v), this.thresholds)) {
        v.before = v.status;
        v.status = 'hidden';
        v.reason = `${v.reporters.length} reports`;
        console.log(`[community] ${v.name} (${contentHash.slice(7, 19)}) hidden after ${v.reporters.length} reports`);
      }
      this.save();
    }
    return { reports: v.reporters.length, hidden: v.status === 'hidden' };
  }

  /** The creator withdraws their map (every version): unlisted, out of the picks, its kept files deleted. */
  withdraw(sub: string, mapId: string): void {
    const m = this.data.maps[mapId];
    if (!m) throw new CommunityError('no such community map', 404);
    if (m.creator !== this.pid(sub)) throw new CommunityError("only the map's creator can withdraw it", 403);
    m.withdrawn = this.now();
    for (const [hash, v] of Object.entries(this.data.versions)) if (v.mapId === mapId) rmSync(join(this.dir, 'picks', `${hexOf(hash)}.json`), { force: true });
    this.save();
  }

  /** A creator's own maps (by their sign-in), newest first: each version's numbers and state. */
  mine(sub: string): { mapId: string; withdrawn: boolean; versions: (ReturnType<CommunityStore['row']>)[] }[] {
    const me = this.pid(sub);
    return Object.entries(this.data.maps)
      .filter(([, m]) => m.creator === me)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([mapId, m]) => ({ mapId, withdrawn: !!m.withdrawn, versions: Object.entries(this.data.versions).filter(([, v]) => v.mapId === mapId).map(([h, v]) => this.row(h, v)) }));
  }

  // ---------------------------------------------------------------- the owner

  /** One version as the owner's summary and the creator's list show it. */
  row(contentHash: string, v: VersionRecord) {
    const t = this.tally(v);
    return {
      contentHash,
      mapId: v.mapId,
      versionId: v.versionId,
      name: v.name,
      creator: this.data.maps[v.mapId]?.creatorName ?? '',
      withdrawn: !!this.data.maps[v.mapId]?.withdrawn,
      status: v.status,
      ...(v.reason ? { reason: v.reason } : {}),
      players: t.players,
      earlyQuits: t.earlyQuits,
      hosts: t.hosts,
      days: t.days,
      reports: t.reports,
      minutes: v.minutes,
      matches: v.matches,
      firstAt: v.firstAt,
      lastAt: v.lastAt,
      ...(v.pickedAt ? { pickedAt: v.pickedAt } : {}),
      missing: v.status === 'open' ? missingForPick(t, this.thresholds) : [],
    };
  }

  /**
   * The owner's weekly summary (GET /api/v1/community/summary; `pnpm --filter @tiletrigger/server community-summary`):
   * new picks, maps waiting for the owner (hidden after reports, failed the check), and the most played with what each
   * still lacks.
   */
  summary(days = 7) {
    const since = this.now() - days * 86_400_000;
    const rows = Object.entries(this.data.versions).map(([h, v]) => this.row(h, v));
    const active = rows.filter((r) => r.lastAt >= since);
    return {
      since,
      days,
      thresholds: this.thresholds,
      totals: { versions: rows.length, picks: rows.filter((r) => r.status === 'pick').length, official: rows.filter((r) => r.status === 'official').length, hidden: rows.filter((r) => r.status === 'hidden').length, active: active.length },
      newPicks: rows.filter((r) => (r.pickedAt ?? 0) >= since).sort((a, b) => b.players - a.players),
      hidden: rows.filter((r) => r.status === 'hidden').sort((a, b) => b.reports - a.reports),
      failed: rows.filter((r) => r.status === 'failed' && r.lastAt >= since),
      wanted: rows.filter((r) => r.status === 'wanted'),
      mostPlayed: active.filter((r) => r.status === 'open' || r.status === 'pick').sort((a, b) => b.players - a.players || b.minutes - a.minutes).slice(0, 20),
    };
  }

  /** The owner looked at a hidden map and lets it back (its reports so far no longer count toward hiding it). */
  restore(contentHash: string): VersionRecord {
    const v = this.need(contentHash);
    if (v.status !== 'hidden') throw new CommunityError('the map is not hidden', 409);
    v.status = v.before ?? 'open';
    v.reviewed = v.reporters.length;
    delete v.before;
    delete v.reason;
    this.save();
    return v;
  }

  /** The owner takes a version down: never listed again, out of the picks, its file deleted. */
  takeDown(contentHash: string): VersionRecord {
    const v = this.need(contentHash);
    v.status = 'removed';
    v.reason = "taken down by the game's owner";
    rmSync(join(this.dir, 'picks', `${hexOf(contentHash)}.json`), { force: true });
    this.save();
    return v;
  }

  /** The owner made a pick Official (publish.ts published its file): it leaves the picks. */
  markOfficial(contentHash: string): VersionRecord {
    const v = this.need(contentHash);
    v.status = 'official';
    this.save();
    return v;
  }

  private need(contentHash: string): VersionRecord {
    const v = this.data.versions[contentHash];
    if (!v) throw new CommunityError('no such community map', 404);
    return v;
  }

  /** Written a moment after a change (many reports in a burst write once). */
  private save(): void {
    this.saveTimer ??= setTimeout(() => this.saveNow(), 2000);
    this.saveTimer.unref?.();
  }

  /** Write now (tests; the hub on exit). */
  saveNow(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const tmp = `${this.file}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(this.data));
      renameSync(tmp, this.file);
    } catch (e) {
      // A full disk or a missing folder mustn't stop the hub: the numbers stay in memory and the next change tries again.
      console.warn(`[community] couldn't save ${this.file}: ${(e as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------- HTTP

export interface CommunityOptions {
  /** Checks a sign-in token (auth.ts); null when sign-in isn't set up (then nothing is counted or reported). */
  verify: ((token: string) => Promise<VerifiedUser>) | null;
  /** Owner accounts (OWNER_SUBS): the summary, Official, take down, restore. */
  owners: ReadonlySet<string>;
  trustProxy: boolean;
  /** The hub's check of a map file for a pick (communityCheck.ts checkInWorker). */
  check: (text: string, hash: string) => Promise<PickCheck>;
  /** The owner's published maps (publish.ts), for Official; null when publishing is off. */
  published: PublishedMaps | null;
}

/** Largest request body: a report (96 players) is a few KB; a map file up to MAX_PICK_BYTES, gzipped. */
const MAX_JSON_BODY = 16 * 1024;
const MAX_FILE_BODY = 2 * 1024 * 1024;

function body(req: IncomingMessage, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new CommunityError('request too large', 413));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

const HEX_RE = /^[0-9a-f]{64}$/;

/**
 * /api/v1/community (docs/COMMUNITY_MAPS.md):
 *   GET  /api/v1/community/picks                    the Community Picks (CommunityPick[])
 *   GET  /api/v1/community/picks/<hex>              a pick's map file
 *   GET  /api/v1/community/wants/<hex>              { want }: whether the hub asks for this version's file
 *   PUT  /api/v1/community/maps/<hex>/file          the file the hub asked for (JSON, optionally gzipped); checked
 *   POST /api/v1/community/plays                    signed in (the host): the end-of-match report (PlayReport)
 *   POST /api/v1/community/maps/<hex>/report        signed in: report a community map (once per account)
 *   GET  /api/v1/community/mine                     signed in: your maps (as their creator), with their numbers
 *   POST /api/v1/community/withdraw/<mapId>         signed in, the creator: withdraw the map (every version)
 *   GET  /api/v1/community/summary?days=7[&format=text]   owner: the weekly summary
 *   GET  /api/v1/community/maps/<hex>/file          owner: a kept file (a pick, hidden or Official)
 *   POST /api/v1/community/maps/<hex>/official      owner: publish the pick as an Official map (publish.ts)
 *   POST /api/v1/community/maps/<hex>/takedown      owner: take it down for good
 *   POST /api/v1/community/maps/<hex>/restore       owner: let a hidden map back
 */
export function communityHandler(store: CommunityStore, o: CommunityOptions) {
  const reads = new KeyedLimiter({ perMinute: 240, burst: 120 });
  const writes = new KeyedLimiter({ perMinute: 30, burst: 15 });
  const uploads = new KeyedLimiter({ perMinute: 4, burst: 2 });
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://hub');
    const path = url.pathname.replace(/\/+$/, '');
    if (path !== '/api/v1/community' && !path.startsWith('/api/v1/community/')) return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Encoding');
    res.setHeader('Access-Control-Max-Age', '600');
    const send = (status: number, data: unknown, cache = 'no-store', type = 'application/json; charset=utf-8') => {
      res.statusCode = status;
      res.setHeader('Cache-Control', cache);
      res.setHeader('Content-Type', type);
      res.end(typeof data === 'string' ? data : JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') return void ((res.statusCode = 204), res.end());
    const ip = clientIp(req, o.trustProxy);
    const parts = path.split('/').slice(4); // [section, a, b]
    const [section, a, b] = parts;
    const signedIn = async (): Promise<VerifiedUser> => {
      if (!o.verify) throw new CommunityError('sign-in is not set up on this hub', 404);
      const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(String(req.headers.authorization ?? ''));
      if (!m) throw new CommunityError('sign in first', 401);
      try {
        return await o.verify(m[1]!);
      } catch (e) {
        throw new CommunityError((e as Error).message || 'sign-in could not be checked', 401);
      }
    };
    const owner = async () => {
      const u = await signedIn();
      if (!o.owners.has(u.sub)) throw new CommunityError("only the game's owner can do that", 403);
      return u;
    };
    const hashOf = (hex: string | undefined) => {
      if (!hex || !HEX_RE.test(hex)) throw new CommunityError('bad content hash');
      return `sha256:${hex}`;
    };
    try {
      if (req.method === 'GET' && (section === 'picks' || section === 'wants')) {
        if (!reads.allow(ip)) return send(429, { error: 'slow down' });
        if (section === 'wants') return send(200, { want: store.wantsFile(hashOf(a)) });
        if (!a) return send(200, { picks: store.picks() }, 'public, max-age=30');
        const text = store.pickFile(hashOf(a));
        return text ? send(200, text, 'public, max-age=3600') : send(404, { error: 'not a Community Pick' });
      }
      if (section === 'maps' && b === 'file' && req.method === 'PUT') {
        if (!uploads.allow(ip)) return send(429, { error: 'slow down' });
        const hash = hashOf(a);
        if (!store.wantsFile(hash)) return send(409, { error: 'the hub is not asking for this map' });
        let buf = await body(req, MAX_FILE_BODY);
        if (String(req.headers['content-encoding'] ?? '').toLowerCase() === 'gzip') {
          try {
            buf = gunzipSync(buf, { maxOutputLength: MAX_PICK_BYTES });
          } catch {
            throw new CommunityError('the map is too large or not gzip');
          }
        }
        const status = await store.receiveFile(hash, buf.toString('utf8'), o.check);
        console.log(`[community] ${hash.slice(7, 19)}: file received, ${status}`);
        return send(200, { status });
      }
      if (!writes.allow(ip)) return send(429, { error: 'slow down' });
      if (section === 'plays' && req.method === 'POST') {
        const user = await signedIn();
        let r: PlayReport;
        try {
          r = JSON.parse((await body(req, MAX_JSON_BODY)).toString('utf8')) as PlayReport;
        } catch {
          throw new CommunityError('send JSON');
        }
        if (!r || typeof r.code !== 'string' || typeof r.contentHash !== 'string' || !Array.isArray(r.players)) throw new CommunityError('bad report');
        return send(200, store.report(user.sub, r));
      }
      if (section === 'maps' && b === 'report' && req.method === 'POST') return send(200, store.reportMap((await signedIn()).sub, hashOf(a)));
      if (section === 'mine' && req.method === 'GET') return send(200, { maps: store.mine((await signedIn()).sub) });
      if (section === 'withdraw' && req.method === 'POST') {
        const user = await signedIn();
        if (!a || !/^[A-Za-z0-9_-]{2,64}$/.test(a)) throw new CommunityError('bad map ID');
        store.withdraw(user.sub, a);
        console.log(`[community] ${a} withdrawn by its creator`);
        return send(200, { ok: true });
      }
      // The owner's.
      if (section === 'summary' && req.method === 'GET') {
        await owner();
        const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 7) || 7));
        const s = store.summary(days);
        return url.searchParams.get('format') === 'text' ? send(200, summaryText(s), 'no-store', 'text/plain; charset=utf-8') : send(200, s);
      }
      if (section === 'maps' && b === 'file' && req.method === 'GET') {
        await owner();
        const text = store.pickFile(hashOf(a), true);
        return text ? send(200, text) : send(404, { error: 'no file kept for that map' });
      }
      if (section === 'maps' && req.method === 'POST' && (b === 'official' || b === 'takedown' || b === 'restore')) {
        const user = await owner();
        const hash = hashOf(a);
        if (b === 'takedown') return send(200, { status: store.takeDown(hash).status });
        if (b === 'restore') return send(200, { status: store.restore(hash).status });
        if (!o.published) throw new CommunityError('publishing is off on this hub (PUBLISHED_MAPS_DIR)', 404);
        const text = store.pickFile(hash, true);
        if (!text) throw new CommunityError('no file kept for that map: only a Community Pick can be made Official', 404);
        try {
          const entry = o.published.publish(text, user);
          store.markOfficial(hash);
          console.log(`[community] ${hash.slice(7, 19)} made Official as ${entry.id} by ${user.sub}`);
          return send(200, entry);
        } catch (e) {
          if (e instanceof PublishError) throw new CommunityError(e.message, e.status);
          throw e;
        }
      }
      return send(404, { error: 'not found' });
    } catch (e) {
      if (e instanceof CommunityError) return send(e.status, { error: e.message });
      console.error('[community]', e);
      return send(500, { error: 'something went wrong' });
    }
  };
}

/** The weekly summary as plain text (the owner reads it in a browser tab or a terminal). */
export function summaryText(s: ReturnType<CommunityStore['summary']>): string {
  const when = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const line = (r: ReturnType<CommunityStore['row']>) =>
    `  ${r.name} (by ${r.creator || 'unknown'}; ${r.contentHash.slice(7, 19)}) ${r.players} players, ${r.hosts} hosts, ${r.days} days, ${r.minutes} min, ${r.earlyQuits} early quits, ${r.reports} reports${r.missing.length ? `; needs ${r.missing.join(', ')}` : ''}${r.reason ? `; ${r.reason}` : ''}`;
  const part = (title: string, rows: ReturnType<CommunityStore['row']>[], how = '') => [`${title} (${rows.length})${how}`, ...(rows.length ? rows.map(line) : ['  none'])];
  return [
    `Community maps, the ${s.days} days since ${when(s.since)}`,
    `${s.totals.versions} map versions, ${s.totals.picks} Community Picks, ${s.totals.official} made Official, ${s.totals.hidden} hidden; ${s.totals.active} played or listed this week.`,
    `Thresholds: ${s.thresholds.players} players, ${s.thresholds.hosts} hosts, ${s.thresholds.days} days, early quits under ${Math.round(s.thresholds.earlyQuitRate * 100)}%, under ${s.thresholds.reportsPer100} reports per 100 players; hides at ${s.thresholds.hideReports} reports and ${s.thresholds.hidePer100} per 100.`,
    '',
    ...part('New Community Picks', s.newPicks, ': make one Official from your Profile, or POST /api/v1/community/maps/<hash>/official'),
    '',
    ...part('Hidden after reports, waiting for you', s.hidden, ': restore or take down'),
    '',
    ...part('Failed the hub check', s.failed),
    '',
    ...part('Cleared the thresholds, waiting for a file', s.wanted, ': a host sends it at its next match'),
    '',
    ...part('Most played', s.mostPlayed),
    '',
  ].join('\n');
}
