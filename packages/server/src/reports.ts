import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { KeyedLimiter } from '@tiletrigger/shared';
import { CRASH_REPORT_MAX_BYTES, cleanCrashReport, type CrashReport } from '@tiletrigger/shared/crashReport';
import type { VerifiedUser } from './auth.ts';
import { clientIp } from './clientIp.ts';

/**
 * Crash and error reports (docs/CRASH_REPORTS.md): a player whose game broke pressed Send. The hub checks the report
 * (shared/net/crashReport.ts: known fields only, scrubbed again), keeps it in REPORTS_DIR as one JSON line in that
 * day's file, and the owner reads them grouped by signature (GET /api/v1/reports, or the `crash-reports` command on
 * the box). Nothing about the sender is kept: no address (the rate limit's keys live in memory only), no account.
 * Bounded: at most `perDay` reports a day (later ones are refused) and files older than `keepDays` are deleted.
 */
export class ReportStore {
  private day = '';
  private today = 0;

  constructor(
    readonly dir: string,
    readonly o: { perDay?: number; keepDays?: number } = {},
    private readonly now: () => number = Date.now,
  ) {}

  get perDay(): number {
    return this.o.perDay ?? 300;
  }

  /** Keep one report. False when today's cap is reached. */
  add(r: CrashReport): boolean {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (day !== this.day) {
      // Made on the first report (not on start: the owner's command, run as root, must not make it root's).
      mkdirSync(this.dir, { recursive: true });
      this.day = day;
      this.today = this.count(day);
      this.prune();
    }
    if (this.today >= this.perDay) return false;
    const received = new Date(this.now()).toISOString().slice(0, 16) + 'Z';
    appendFileSync(join(this.dir, `${day}.jsonl`), `${JSON.stringify({ ...r, received })}\n`);
    this.today++;
    return true;
  }

  private count(day: string): number {
    const f = join(this.dir, `${day}.jsonl`);
    return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0;
  }

  private files(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir).filter((f) => /^\d{4}-\d\d-\d\d\.jsonl$/.test(f)).sort();
  }

  private prune(): void {
    const oldest = new Date(this.now() - (this.o.keepDays ?? 30) * 86_400_000).toISOString().slice(0, 10);
    for (const f of this.files()) if (f.slice(0, 10) < oldest) rmSync(join(this.dir, f), { force: true });
  }

  /** The last `days` days' reports, grouped by signature, most frequent first. */
  summary(days = 7): ReportSummary {
    const since = new Date(this.now() - days * 86_400_000).toISOString().slice(0, 10);
    const groups = new Map<string, ReportGroup>();
    let total = 0;
    for (const f of this.files()) {
      if (f.slice(0, 10) < since) continue;
      for (const line of readFileSync(join(this.dir, f), 'utf8').split('\n')) {
        if (!line) continue;
        let r: CrashReport & { received?: string };
        try {
          r = JSON.parse(line) as CrashReport & { received?: string };
        } catch {
          continue;
        }
        total++;
        const when = r.received ?? r.at;
        const g = groups.get(r.sig);
        if (!g) {
          groups.set(r.sig, { sig: r.sig, count: 1, first: when, last: when, versions: [r.version], maps: r.map ? [r.map] : [], browsers: [r.browser], sample: r });
          continue;
        }
        g.count++;
        if (when < g.first) g.first = when;
        if (when >= g.last) {
          g.last = when;
          g.sample = r;
        }
        for (const [list, v] of [[g.versions, r.version], [g.maps, r.map], [g.browsers, r.browser]] as const) if (v && !list.includes(v) && list.length < 8) list.push(v);
      }
    }
    return { days, total, groups: [...groups.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1)) };
  }
}

export interface ReportGroup {
  sig: string;
  count: number;
  first: string;
  last: string;
  versions: string[];
  maps: string[];
  browsers: string[];
  /** The newest report of the group. */
  sample: CrashReport;
}

export interface ReportSummary {
  days: number;
  total: number;
  groups: ReportGroup[];
}

/** The summary as plain text (the command's output, `?format=text`). */
export function reportsText(s: ReportSummary): string {
  const out = [`Crash and error reports, the last ${s.days} days: ${s.total} in ${s.groups.length} kinds`];
  for (const g of s.groups) {
    const r = g.sample;
    out.push(
      '',
      `${g.count} × ${r.kind}: ${r.message}`,
      `  ${g.sig} · ${g.first} → ${g.last} · builds ${g.versions.join(', ')} · ${g.maps.length ? `maps ${g.maps.join(', ')}` : 'no map'} · ${g.browsers.join(', ')}`,
      `  newest: ${r.version} (${r.sha.slice(0, 8) || 'no sha'}), ${r.screen}${r.mode ? ` ${r.mode}` : ''}${r.map ? ` on ${r.map}` : ''}, quality ${r.quality ?? '?'}, ${r.browser} on ${r.os}`,
      ...r.stack.split('\n').slice(0, 8).map((l) => `    ${l.trim()}`),
    );
  }
  return out.join('\n');
}

export interface ReportsOptions {
  /** Owner accounts (Cognito `sub`s) that may read reports. */
  owners: ReadonlySet<string>;
  verify: ((token: string) => Promise<VerifiedUser>) | null;
  trustProxy: boolean;
}

/**
 * /api/v1/reports:
 *   POST /api/v1/reports                       anyone: one report (JSON, at most CRASH_REPORT_MAX_BYTES); 3 a minute per address
 *   GET  /api/v1/reports?days=7[&format=text]  owner: the summary
 */
export function reportsHandler(store: ReportStore, o: ReportsOptions) {
  const posts = new KeyedLimiter({ perMinute: 3, burst: 3 });
  const reads = new KeyedLimiter({ perMinute: 20, burst: 10 });
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://hub');
    if (url.pathname.replace(/\/+$/, '') !== '/api/v1/reports') return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return void ((res.statusCode = 204), res.end());
    const ip = clientIp(req, o.trustProxy);
    if (req.method === 'POST') {
      if (!posts.allow(ip)) {
        req.resume();
        return send(429, { error: 'slow down' });
      }
      if (Number(req.headers['content-length'] ?? 0) > CRASH_REPORT_MAX_BYTES) {
        req.resume();
        return send(413, { error: 'too large' });
      }
      let body: string;
      try {
        body = await readSmall(req, CRASH_REPORT_MAX_BYTES);
      } catch {
        return send(413, { error: 'too large' });
      }
      let raw: unknown;
      try {
        raw = JSON.parse(body);
      } catch {
        return send(400, { error: 'not JSON' });
      }
      const r = cleanCrashReport(raw);
      if (typeof r === 'string') return send(400, { error: r });
      if (!store.add(r)) return send(503, { error: 'enough reports for today' });
      return send(200, { ok: true });
    }
    if (req.method !== 'GET') return send(405, { error: 'method not allowed' });
    if (!reads.allow(ip)) return send(429, { error: 'slow down' });
    if (!o.verify) return send(404, { error: 'sign-in is not set up on this hub' });
    const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(String(req.headers.authorization ?? ''));
    if (!m) return send(401, { error: 'sign in first' });
    let user: VerifiedUser;
    try {
      user = await o.verify(m[1]!);
    } catch (e) {
      return send(401, { error: (e as Error).message || 'sign-in could not be checked' });
    }
    if (!o.owners.has(user.sub)) return send(403, { error: "only the game's owner reads reports" });
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get('days') ?? 7) || 7));
    const s = store.summary(days);
    return send(200, url.searchParams.get('format') === 'text' ? reportsText(s) : s);
  };
}

/** A request body of at most `max` bytes (rejects past it, and stops reading). */
function readSmall(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new Error('too large'));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
