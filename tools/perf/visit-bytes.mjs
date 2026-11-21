// What a visit downloads: a first visit (empty cache) and a return visit (same browser, cache kept), each
// loading the main menu and then one match (Play → Start), served the way the hub serves the build
// (packages/server/src/site.ts). Sums the bytes on the wire per visit, split into hashed files (/assets/),
// other static files (models, textures, sounds: un-hashed names), HTML and the rest. docs/HOSTING.md has the numbers.
// Usage: pnpm build && node tools/perf/visit-bytes.mjs [dist dir]   (CHROMIUM=<path> for another browser)
//   VISIT_PORT=4297, VISIT_SITE=<site.ts>, VISIT_STALE=1: the return visit as if more than an hour had passed (every un-hashed file
//   past its max-age: revalidated with If-None-Match, or downloaded again without validators).
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// VISIT_SITE=<path to a site.ts>: measure another version of the hub's file serving (e.g. before a change).
const { siteHandler } = await import(process.env.VISIT_SITE ? resolve(process.env.VISIT_SITE) : '../../packages/server/src/site.ts');

const dir = resolve(process.argv[2] ?? 'packages/client/dist');
const PORT = Number(process.env.VISIT_PORT ?? 4297);
const STALE = process.env.VISIT_STALE === '1';
const handle = siteHandler(dir);
const server = createServer((req, res) => {
  // Stale: un-hashed files are sent as no-cache on both visits, so on the return visit the browser treats them
  // as expired (as after an hour away): it revalidates them (a 304 with an ETag) or downloads them again.
  if (STALE) {
    const end = res.setHeader.bind(res);
    res.setHeader = (k, v) => end(k, String(k).toLowerCase() === 'cache-control' && !/\/assets\//.test(req.url ?? '') ? 'no-cache' : v);
  }
  void handle(req, res, () => ((res.statusCode = 404), res.end()));
});
await new Promise((ok) => server.listen(PORT, ok));
const executablePath = process.env.CHROMIUM || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });

const kind = (url) => {
  const p = new URL(url).pathname;
  if (p.startsWith('/assets/')) return 'hashed';
  if (p === '/' || p.endsWith('.html')) return 'html';
  return 'static';
};

async function visit(label, stale) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const urls = new Map();
  const status = new Map();
  const rows = [];
  cdp.on('Network.responseReceived', (e) => (urls.set(e.requestId, e.response.url), status.set(e.requestId, e.response.status)));
  cdp.on('Network.requestServedFromCache', (e) => status.set(e.requestId, 'cache'));
  cdp.on('Network.responseReceivedExtraInfo', (e) => e.statusCode === 304 && status.set(e.requestId + ':304', true));
  cdp.on('Network.loadingFinished', (e) => {
    const url = urls.get(e.requestId);
    if (url && url.startsWith('http')) rows.push({ url, bytes: e.encodedDataLength, status: status.get(e.requestId), notModified: status.has(e.requestId + ':304') });
  });
  await page.goto(`http://127.0.0.1:${PORT}/?test=1&name=Tester`);
  await page.waitForFunction(() => window.__front && !document.getElementById('menu').hidden, null, { timeout: 300000 });
  await page.click('#nav-play', { timeout: 300000 });
  await page.waitForSelector('#arcade-start', { timeout: 300000 });
  const map = await page.evaluate(() => document.querySelector('#arcade-map-pick b')?.textContent ?? '');
  await page.click('#arcade-start', { timeout: 300000 });
  await page.waitForFunction(() => window.__cs && document.getElementById('loading-screen').hidden && !document.getElementById('hud').hidden, null, { timeout: 600000 });
  // Let late loads (sounds, far looks) finish: wait until the network is quiet for 3 s.
  let last = rows.length;
  for (let quiet = 0; quiet < 3; ) {
    await new Promise((r) => setTimeout(r, 1000));
    quiet = rows.length === last ? quiet + 1 : 0;
    last = rows.length;
  }
  await page.close();
  const sum = {};
  for (const r of rows) {
    const k = kind(r.url);
    sum[k] ??= { requests: 0, bytes: 0, fromCache: 0, notModified: 0 };
    sum[k].requests++;
    sum[k].bytes += r.bytes;
    if (r.status === 'cache') sum[k].fromCache++;
    if (r.notModified) sum[k].notModified++;
  }
  const total = rows.reduce((a, r) => a + r.bytes, 0);
  console.log(`\n${label}${stale ? ' (more than an hour later)' : ''}${map ? `, map: ${map}` : ''}: ${(total / 1e6).toFixed(2)} MB over the wire, ${rows.length} requests`);
  for (const [k, v] of Object.entries(sum)) console.log(`  ${k.padEnd(7)} ${String(v.requests).padStart(4)} requests  ${(v.bytes / 1e6).toFixed(2).padStart(8)} MB  (from cache ${v.fromCache}, 304 ${v.notModified})`);
  return total;
}

await visit('first');
await visit('return', STALE);
await browser.close();
server.close();
