// MapMaker's Test start on a big map: from pressing Test to smooth play (docs/PERF_MAPMAKER_TRACE_2026-11-15.md).
//
//   node tools/perf/test-start.mjs [map names as the Open dialog lists them…]      (after `pnpm build`)
//   START_RUNS=<n>       runs a map and a variant (default 2; the first page load of a run pays for the cold cache)
//   START_VARIANTS=a,b   `?perfoff=` values to compare, `-` for none, `+` between switches (default: `-,navhandoff+startslices+navcache`)
//   START_PORT / START_URL / CHROMIUM   as tools/perf/editor-edit.mjs
//   START_JSON=<file>    the numbers as JSON
//
// It opens the map in MapMaker, waits for the navigation check to finish (its navmesh is what the Test may take), then
// presses Test (3 bots) and records every animation frame for 20 s. Reported: time to the match made (`TEST ready`),
// to the loading screen gone, and to the first smooth second (every frame from there for a second within twice the
// median frame of the last 5 s of play), the longest frame on the way there and how many frames took over 100 ms.
// Software rendering is slow here, so the frames' lengths are against this machine's own play, not 60 a second.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = process.env.START_PORT ?? '4991';
const CLIENT = process.env.START_URL ?? `http://localhost:${PORT}`;
const MAPS = process.argv.slice(2).length ? process.argv.slice(2) : ['Iron Maw'];
const RUNS = Number(process.env.START_RUNS ?? 2);
const VARIANTS = (process.env.START_VARIANTS ?? '-,navhandoff+startslices+navcache').split(',');
const RECORD_MS = 20000;

const server = process.env.START_URL ? { pid: 0 } : spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => {
  try {
    if (server.pid) process.kill(-server.pid);
  } catch {}
};
process.on('exit', stop);

async function waitForHttp(url) {
  for (let i = 0; i < 120; i++) {
    if (await fetch(url).then((r) => r.ok, () => false)) return;
    await sleep(250);
  }
  throw new Error(`${url} did not come up`);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

async function run(browser, mapName, variant) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/TEST ready|match made/.test(t)) logs.push(t);
  });
  page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
  const off = variant === '-' ? '' : `&perfoff=${variant.replaceAll('+', ',')}`;
  await page.goto(`${CLIENT}/?mode=editor&test=1${off}`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 120000 });
  await page.evaluate(() => window.__editor.setOwner?.(true));
  await page.click('#ed-open');
  const rowSel = `#ed-library li:has-text(${JSON.stringify(mapName)})`;
  await page.waitForSelector(rowSel, { timeout: 30000 });
  const before = await page.evaluate(() => window.__editor.doc.metadata.id);
  await page.locator(rowSel).first().locator('button').first().click();
  await page.waitForFunction((b) => window.__editor.doc.metadata.id !== b, before, { timeout: 180000 });
  // This map's navigation check answered (its navmesh with it: not the starter map's from before), none still running.
  const c0 = Date.now();
  await page.evaluate(() => (window.__editor.checks.prebuilt = null));
  await page.waitForFunction(() => window.__editor.checks.prebuilt && !window.__editor.checks.navBusy, null, { timeout: 300000, polling: 250 });
  const checkS = (Date.now() - c0) / 1000;
  await sleep(1500);
  await page.evaluate(() => {
    const f = (window.__startFrames = { t: [], loadingOff: 0 });
    const loading = document.getElementById('loading-screen');
    const tick = (now) => {
      f.t.push(now);
      if (!f.loadingOff && f.t.length > 5 && loading && loading.hidden && window.__cs) f.loadingOff = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await sleep(500);
  const t0 = await page.evaluate(() => {
    const t = performance.now();
    document.getElementById('ed-bots').value = '3';
    window.__editor.test();
    return t;
  });
  await page.waitForFunction(() => window.__testStartMs, null, { timeout: 120000 });
  await sleep(RECORD_MS);
  const f = await page.evaluate(() => ({ t: window.__startFrames.t, loadingOff: window.__startFrames.loadingOff, ready: window.__testStartMs }));
  await context.close();
  const ts = f.t.filter((t) => t >= t0);
  const gaps = ts.slice(1).map((t, i) => ({ at: ts[i] - t0, ms: t - ts[i] }));
  const end = ts[ts.length - 1] - t0;
  const steady = median(gaps.filter((g) => g.at > end - 5000).map((g) => g.ms));
  const limit = Math.max(2 * steady, 34);
  // The first frame from which a second of frames all stay within the limit (after the loading screen is gone).
  const from = f.loadingOff ? f.loadingOff - t0 : 0;
  let smooth = null;
  for (let i = 0; i < gaps.length && smooth === null; i++) {
    if (gaps[i].at < from) continue;
    let ok = true;
    for (let j = i; j < gaps.length && gaps[j].at < gaps[i].at + 1000; j++) if (gaps[j].ms > limit) ok = false;
    if (ok) smooth = gaps[i].at;
  }
  const upTo = gaps.filter((g) => g.at <= (smooth ?? end));
  const longest = upTo.reduce((m, g) => Math.max(m, g.ms), 0);
  return {
    map: mapName,
    variant,
    checkS: Math.round(checkS * 10) / 10,
    readyMs: Math.round(f.ready),
    loadingOffMs: f.loadingOff ? Math.round(f.loadingOff - t0) : null,
    smoothMs: smooth === null ? null : Math.round(smooth),
    longestMs: Math.round(longest),
    over100: upTo.filter((g) => g.ms > 100).length,
    steadyMs: Math.round(steady),
    logs,
  };
}

await (process.env.START_URL ? Promise.resolve() : waitForHttp(CLIENT));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
const rows = [];
try {
  for (const map of MAPS) {
    for (let r = 0; r < RUNS; r++) {
      for (const v of VARIANTS) {
        const row = await run(browser, map, v);
        rows.push(row);
        console.log(`${row.map} [${row.variant === '-' ? 'all on' : `off: ${row.variant}`}] run ${r + 1}: check ${row.checkS} s · match ready ${row.readyMs} ms · loading gone ${row.loadingOffMs} ms · smooth from ${row.smoothMs} ms · longest frame ${row.longestMs} ms · ${row.over100} frames over 100 ms · play ${row.steadyMs} ms a frame${row.logs.length ? ` · ${row.logs.join(' / ')}` : ''}`);
      }
    }
  }
} finally {
  await browser.close();
  stop();
}
if (process.env.START_JSON) writeFileSync(process.env.START_JSON, JSON.stringify(rows, null, 2));
