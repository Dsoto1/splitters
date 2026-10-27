// Warm-up stall check (PERF_96.md, "Warm-up hang"): opens a 96-player offline match on a map
// again and again and watches the page from the start of loading through WARM_S seconds of
// play. The page must answer a probe within HANG_S seconds every time; a page that doesn't
// counts as hung, and its JS stack (paused through the debugger) is printed. Per run it also
// reports the slowest probe answer and how many snapshots the page merged to catch up.
// Usage: pnpm build && node tools/perf/hang96.mjs [runs=5] [map=norman_shores]
//   HANG_S=30, WARM_S=20, HANG_PORT=4297, HANG_WAIT=s (after a miss, wait this much longer
//   to tell a stall from a hang), HANG_DIST=dir (serve that build instead of packages/client/dist)
// Exits 1 when any run hung. SwiftShader renders on the CPU, so on a loaded box frames take
// seconds: exactly the slow page this checks the match against.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const runs = Number(process.argv[2] ?? 5);
const map = process.argv[3] ?? 'norman_shores';
const HANG_S = Number(process.env.HANG_S ?? 30);
const WARM_S = Number(process.env.WARM_S ?? 20);
const PORT = process.env.HANG_PORT ?? '4297';
const CLIENT = `http://localhost:${PORT}`;

const preview = spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort', ...(process.env.HANG_DIST ? ['--outDir', process.env.HANG_DIST] : [])], { stdio: 'ignore', detached: true });
const stop = () => {
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {}
};
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(CLIENT)).ok) break;
  } catch {}
  await sleep(200);
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const within = (p, ms) => Promise.race([p.then(() => true, () => true), sleep(ms).then(() => false)]);

/** The page's JS stack, paused through the debugger. */
async function stackOf(page) {
  const cdp = await page.context().newCDPSession(page);
  const paused = new Promise((resolve) => cdp.once('Debugger.paused', resolve));
  await cdp.send('Debugger.enable');
  await cdp.send('Debugger.pause');
  const ev = await Promise.race([paused, sleep(10000).then(() => null)]);
  if (!ev) return '  (the debugger could not pause the page)';
  return ev.callFrames.map((f) => `  ${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.location.lineNumber + 1}`).join('\n');
}

let hung = 0;
for (let run = 1; run <= runs; run++) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tiletrigger.graphics', 'low');
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=${map}&gamemode=core.tdm&bots=96`);
  const t0 = Date.now();
  let warmAt = 0;
  let slowest = 0;
  let last = null;
  const secs = () => ((Date.now() - t0) / 1000).toFixed(0);
  for (;;) {
    const asked = Date.now();
    const probe = page.evaluate(() => ({ phase: window.__cs?.phase?.() ?? null, ready: (window.__cs?.local?.inventory?.size ?? 0) > 0, backlog: window.__sim?.backlog ?? null }));
    let ok = await within(
      probe.then((a) => (last = a)),
      HANG_S * 1000,
    );
    if (!ok && process.env.HANG_WAIT) {
      // A stall or a hang? Give it HANG_WAIT seconds more.
      ok = await within(probe, Number(process.env.HANG_WAIT) * 1000);
      console.log(`run ${run}: no answer for ${HANG_S} s at ${secs()} s; ${ok ? 'answered' : 'still stuck'} within ${process.env.HANG_WAIT} s more`);
    }
    slowest = Math.max(slowest, Date.now() - asked);
    if (!ok) {
      hung++;
      console.log(`run ${run}: HUNG (${warmAt ? 'warm-up' : 'loading'}, ${secs()} s in)\n${await stackOf(page)}`);
      break;
    }
    if (!warmAt && last?.phase === 'playing' && last.ready) warmAt = Date.now();
    if (warmAt && Date.now() - warmAt > WARM_S * 1000) {
      console.log(`run ${run}: ok in ${secs()} s, slowest answer ${(slowest / 1000).toFixed(1)} s, catch-up ${JSON.stringify(last?.backlog)}${errors.length ? `, errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      break;
    }
    if (Date.now() - t0 > 600000) {
      hung++;
      console.log(`run ${run}: did not start in 10 min (slowest answer ${(slowest / 1000).toFixed(1)} s)`);
      break;
    }
    await sleep(1000);
  }
  await within(ctx.close(), 10000);
}
console.log(`${runs} runs on ${map}: ${hung} hung`);
await within(browser.close(), 10000);
process.exit(hung ? 1 : 0);
