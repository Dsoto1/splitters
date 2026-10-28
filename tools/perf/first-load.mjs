// First visit: how long a fresh browser takes to show the main menu, what it downloads on the way, and how long
// Play then takes to put you in a match, on a throttled network. The build is served the way the hub serves it
// (packages/server/src/site.ts: gzip, hashed assets cached). docs/LOADING.md has the numbers.
// Usage: pnpm build && node tools/perf/first-load.mjs [dist dir ...]
//   LOAD_MBPS=10 (download and upload, Mbit/s), LOAD_RTT=40 (ms added to every request), LOAD_RUNS=3,
//   LOAD_IDLE=3 (seconds on the menu before Play: the idle prefetch's chance), LOAD_PORT=4296,
//   LOAD_GPU=1 (the machine's GPU instead of SwiftShader).
// Several dist dirs (e.g. a build of main and one of a branch) are measured in turn, alternating runs.
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { siteHandler } from '../../packages/server/src/site.ts';

const dists = (process.argv.slice(2).length ? process.argv.slice(2) : ['packages/client/dist']).map((d) => resolve(d));
const MBPS = Number(process.env.LOAD_MBPS ?? 10);
const RTT = Number(process.env.LOAD_RTT ?? 40);
const RUNS = Number(process.env.LOAD_RUNS ?? 3);
const IDLE = Number(process.env.LOAD_IDLE ?? 3);
const PORT = Number(process.env.LOAD_PORT ?? 4296);

const servers = await Promise.all(
  dists.map(
    (dir, i) =>
      new Promise((ok) => {
        const handle = siteHandler(dir);
        const s = createServer((req, res) => void handle(req, res, () => ((res.statusCode = 404), res.end())));
        s.listen(PORT + i, () => ok(s));
      }),
  ),
);

const args = process.env.LOAD_GPU ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args });

/** The menu is up: the same test as the visual check's (e2e/run.mjs), fonts in, pictures in, the 3D view faded in. */
const menuShown = () =>
  new Promise((done) => {
    const check = () => {
      const ok = window.__front && document.fonts.status === 'loaded' && [...document.images].every((i) => i.complete) && !document.getElementById('menu').hidden && !document.getElementById('view').classList.contains('veiled');
      if (ok) done(performance.now());
      else requestAnimationFrame(check);
    };
    check();
  });

async function run(dir, port) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: (MBPS * 1e6) / 8, uploadThroughput: (MBPS * 1e6) / 8 });
  const types = new Map();
  const loaded = [];
  let navAt = null;
  cdp.on('Network.requestWillBeSent', (e) => (navAt ??= e.timestamp));
  cdp.on('Network.responseReceived', (e) => types.set(e.requestId, { type: e.type, url: e.response.url }));
  cdp.on('Network.loadingFinished', (e) => loaded.push({ ...types.get(e.requestId), bytes: e.encodedDataLength, at: e.timestamp }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const start = Date.now();
  await page.goto(`http://localhost:${port}/?test=1&name=Tester`, { waitUntil: 'commit' });
  const menuMs = await page.evaluate(menuShown);
  // Everything that finished loading by the time the menu was up (CDP timestamps: seconds, from the page's first request).
  const before = loaded.filter((l) => l.at - navAt <= menuMs / 1000 + 0.05);
  const js = before.filter((l) => l.type === 'Script');
  const sum = (xs) => xs.reduce((a, l) => a + (l.bytes ?? 0), 0);
  // Play: a few seconds on the menu (the idle prefetch's chance), then Play → Start, until the match is on screen.
  await page.waitForTimeout(IDLE * 1000); // wait-ok: the player reading the menu, what the prefetch is for
  const jsAtPlay = sum(loaded.filter((l) => l.type === 'Script'));
  await page.click('#nav-play', { timeout: 180000 });
  await page.waitForSelector('#arcade-start', { timeout: 180000 });
  const t0 = await page.evaluate(() => performance.now());
  await page.click('#arcade-start', { timeout: 180000 });
  const t1 = await page.evaluate(
    () =>
      new Promise((done) => {
        const check = () => (window.__cs && document.getElementById('loading-screen').hidden && !document.getElementById('hud').hidden ? done(performance.now()) : requestAnimationFrame(check));
        check();
      }),
  );
  const total = sum(loaded);
  if (process.env.LOAD_LIST) for (const l of before.filter((x) => x.type === 'Script')) console.log(`  ${(l.bytes / 1e3).toFixed(1).padStart(8)} kB  ${l.url.replace(/^.*\//, '')}`);
  await ctx.close();
  return { dir, menuMs, jsBytes: sum(js), jsFiles: js.length, allBytes: sum(before), jsAtPlay, playMs: t1 - t0, totalBytes: total, wallMs: Date.now() - start, errors };
}

const results = new Map(dists.map((d) => [d, []]));
for (let i = 0; i < RUNS; i++) {
  for (const [j, dir] of dists.entries()) {
    const r = await run(dir, PORT + j);
    results.get(dir).push(r);
    console.log(`${dir}: menu ${(r.menuMs / 1000).toFixed(2)} s, JS before menu ${(r.jsBytes / 1e6).toFixed(2)} MB in ${r.jsFiles} files (all ${(r.allBytes / 1e6).toFixed(2)} MB), JS by Play ${(r.jsAtPlay / 1e6).toFixed(2)} MB, Play → match ${(r.playMs / 1000).toFixed(2)} s${r.errors.length ? `, errors: ${r.errors.join('; ')}` : ''}`);
  }
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`\nMedians (${RUNS} runs, ${MBPS} Mbit/s, ${RTT} ms RTT, ${IDLE} s on the menu before Play):`);
for (const [dir, rs] of results) {
  console.log(`${dir}\n  time to menu ${(median(rs.map((r) => r.menuMs)) / 1000).toFixed(2)} s · JS before menu ${(median(rs.map((r) => r.jsBytes)) / 1e6).toFixed(2)} MB (transferred) · Play → in match ${(median(rs.map((r) => r.playMs)) / 1000).toFixed(2)} s`);
}
await browser.close();
for (const s of servers) s.close();
