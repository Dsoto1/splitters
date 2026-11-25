import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CrashReport } from '@tiletrigger/shared/crashReport';
import { TokenError, type VerifiedUser } from '../src/auth.ts';
import { ReportStore, reportsHandler, reportsText } from '../src/reports.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup.splice(0)) f();
});
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'tt-reports-'));
  cleanup.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
};
const report = (o: Partial<CrashReport> = {}): CrashReport => ({
  v: 1,
  kind: 'error',
  sig: 'ffffffff',
  message: 'TypeError: x is undefined',
  stack: 'at frame (main-abc123.js:10:5)',
  version: '0.42.0',
  sha: 'abcdef01',
  map: 'sandgate',
  mode: 'core.tdm',
  screen: 'game',
  quality: 'high',
  browser: 'Chrome 131',
  os: 'Windows',
  at: '2026-11-24T10:15Z',
  ...o,
});

async function serve(dir = temp(), perDay?: number) {
  const store = new ReportStore(dir, perDay ? { perDay } : {});
  const verify = async (token: string): Promise<VerifiedUser> => {
    if (token === 'bad') throw new TokenError('token expired');
    return { sub: token, tokenUse: 'access', exp: 0 };
  };
  const handler = reportsHandler(store, { owners: new Set(['owner-sub']), verify, trustProxy: false });
  const http: Server = createServer((req, res) => void handler(req, res, () => ((res.statusCode = 404), res.end('next'))));
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  cleanup.push(() => http.close());
  return { dir, url: `http://127.0.0.1:${(http.address() as AddressInfo).port}/api/v1/reports` };
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('crash reports on the hub', () => {
  it('keeps a valid report, scrubbed, without anything about the sender', async () => {
    const { dir, url } = await serve();
    const res = await post(url, report({ message: 'Error: from https://x.example/a/b/c.js:1:2 (me@x.com)' }));
    expect(res.status).toBe(200);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d\d-\d\d\.jsonl$/);
    const text = readFileSync(join(dir, files[0]!), 'utf8');
    const kept = JSON.parse(text.trim());
    expect(kept.message).toBe('Error: from c.js:1:2 ([email])');
    expect(kept.sig).toMatch(/^[0-9a-f]{8}$/);
    expect(kept.received).toMatch(/Z$/);
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('me@x.com');
  });

  it('refuses bad bodies, big bodies and other methods', async () => {
    const { url } = await serve();
    expect((await post(url, 'not json')).status).toBe(400);
    expect((await post(url, { ...report(), kind: 'nope' })).status).toBe(400);
    expect(((await (await post(url, { ...report(), map: 'A Name' })).json()) as { error: string }).error).toBe('bad map or mode');
    // Too large (a fresh hub: this address has used its 3 a minute): refused before it is read (or the connection is cut).
    const big = await post((await serve()).url, { ...report(), stack: 'x'.repeat(20_000) }).catch(() => null);
    expect(big === null || big.status === 413).toBe(true);
    expect((await fetch(url, { method: 'DELETE' })).status).toBe(405);
    expect((await fetch(url.replace('reports', 'reportsx'))).status).toBe(404);
  });

  it('rate-limits each address (3 a minute)', async () => {
    const { url } = await serve();
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await post(url, report({ message: `Error ${i}` }))).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });

  it('stops at the daily cap', async () => {
    const { url } = await serve(temp(), 2);
    expect((await post(url, report())).status).toBe(200);
    expect((await post(url, report())).status).toBe(200);
    expect((await post(url, report())).status).toBe(503);
  });

  it('lets only the owner read, grouped by signature', async () => {
    const { url } = await serve();
    await post(url, report());
    await post(url, report({ map: 'canyon', browser: 'Firefox 133' }));
    await post(url, report({ message: 'RangeError: other', kind: 'rejection' }));
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { Authorization: 'Bearer bad' } })).status).toBe(401);
    expect((await fetch(url, { headers: { Authorization: 'Bearer someone' } })).status).toBe(403);
    const s = (await (await fetch(`${url}?days=7`, { headers: { Authorization: 'Bearer owner-sub' } })).json()) as { total: number; groups: { count: number; maps: string[]; browsers: string[] }[] };
    expect(s.total).toBe(3);
    expect(s.groups.map((g) => g.count)).toEqual([2, 1]);
    expect(s.groups[0]!.maps).toEqual(['sandgate', 'canyon']);
    expect(s.groups[0]!.browsers).toEqual(['Chrome 131', 'Firefox 133']);
    const text = await (await fetch(`${url}?format=text`, { headers: { Authorization: 'Bearer owner-sub' } })).text();
    expect(text).toContain('2 × error: TypeError: x is undefined');
  });

  it('deletes files past the keep time and reads nothing from a missing folder', () => {
    const dir = temp();
    writeFileSync(join(dir, '2020-01-01.jsonl'), `${JSON.stringify(report())}\n`);
    const store = new ReportStore(dir, { keepDays: 30 }, () => Date.parse('2026-11-24T12:00:00Z'));
    expect(store.summary(30000).total).toBe(1);
    expect(store.add(report())).toBe(true);
    expect(readdirSync(dir)).toEqual(['2026-11-24.jsonl']);
    expect(new ReportStore(join(dir, 'missing')).summary().total).toBe(0);
    expect(reportsText(store.summary())).toContain('1 in 1 kinds');
  });
});
