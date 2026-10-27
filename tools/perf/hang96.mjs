// Warm-up stall check (PERF_96.md, "Warm-up hang"): opens a 96-player offline match on a map
// again and again and watches the page from the start of loading through WARM_S seconds of
// play, probing it every second. A probe unanswered for HANG_S seconds counts as a hang (what
// perf96.mjs, which waits without a limit, saw as "never returns"): the page's JS stack, paused
// through the debugger, is printed. Per run it reports the slowest answer, the stalls (answers
// over STALL_S), when the match was playing, and how many snapshots the page merged to catch up.
// Usage: pnpm build && node tools/perf/hang96.mjs [runs=5] [map=norman_shores]
//   HANG_S=120, STALL_S=10, WARM_S=20, HANG_PORT=4297, HANG_DIST=dir (serve that build instead
//   of packages/client/dist), HANG_DIAG=1 (every 5 s: the page's time in worker messages and
//   animation frames, and tasks over 2 s)
// Exits 1 when any run hung. SwiftShader renders on the CPU, so on a loaded box frames take
// seconds: exactly the slow page this checks the match against.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const runs = Number(process.argv[2] ?? 5);
const map = process.argv[3] ?? 'norman_shores';
const HANG_S = Number(process.env.HANG_S ?? 120);
const STALL_S = Number(process.env.STALL_S ?? 10);
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
  if (process.env.HANG_DIAG) {
    // Where the page's time goes, every 5 s: worker messages (count, ms), animation frames (count, ms), long tasks.
    await ctx.addInitScript(() => {
      const st = { msgs: 0, msgMs: 0, msgMax: 0, frames: 0, frameMs: 0, frameMax: 0, at: performance.now() };
      const d = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
      Object.defineProperty(Worker.prototype, 'onmessage', {
        set(fn) {
          d.set.call(this, (e) => {
            const t = performance.now();
            fn(e);
            const ms = performance.now() - t;
            st.msgs++;
            st.msgMs += ms;
            st.msgMax = Math.max(st.msgMax, ms);
          });
        },
        get() {
          return d.get.call(this);
        },
      });
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) =>
        raf((ts) => {
          const t = performance.now();
          cb(ts);
          const ms = performance.now() - t;
          st.frames++;
          st.frameMs += ms;
          st.frameMax = Math.max(st.frameMax, ms);
        });
      const report = () => {
        const now = performance.now();
        console.log(`DIAG ${((now - st.at) / 1000).toFixed(1)} s: msgs ${st.msgs} (${st.msgMs.toFixed(0)} ms, max ${st.msgMax.toFixed(0)}), frames ${st.frames} (${st.frameMs.toFixed(0)} ms, max ${st.frameMax.toFixed(0)}), backlog ${JSON.stringify(window.__sim?.backlog ?? null)}`);
        Object.assign(st, { msgs: 0, msgMs: 0, msgMax: 0, frames: 0, frameMs: 0, frameMax: 0, at: now });
      };
      setInterval(report, 5000);
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (e.duration > 2000) console.log(`DIAG long task ${e.duration.toFixed(0)} ms`);
        }).observe({ type: 'longtask', buffered: false });
      } catch {}
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  if (process.env.HANG_DIAG) page.on('console', (m) => m.text().startsWith('DIAG') && console.log(`  ${m.text()}`));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=${map}&gamemode=core.tdm&bots=96`);
  const t0 = Date.now();
  let warmAt = 0;
  let slowest = 0;
  const stalls = [];
  let last = null;
  const secs = () => ((Date.now() - t0) / 1000).toFixed(0);
  for (;;) {
    const asked = Date.now();
    const probe = page.evaluate(() => ({ phase: window.__cs?.phase?.() ?? null, ready: (window.__cs?.local?.inventory?.size ?? 0) > 0, backlog: window.__sim?.backlog ?? null }));
    const ok = await within(
      probe.then((a) => (last = a)),
      HANG_S * 1000,
    );
    const waited = Date.now() - asked;
    slowest = Math.max(slowest, waited);
    if (waited > STALL_S * 1000) stalls.push(`${(waited / 1000).toFixed(0)} s at ${((asked - t0) / 1000).toFixed(0)} s`);
    if (!ok) {
      hung++;
      console.log(`run ${run}: HUNG (${warmAt ? 'warm-up' : 'loading'}, no answer for ${HANG_S} s at ${secs()} s; stalls before: ${stalls.slice(0, -1).join(', ') || 'none'})\n${await stackOf(page)}`);
      break;
    }
    if (!warmAt && last?.phase === 'playing' && last.ready) warmAt = Date.now();
    if (warmAt && Date.now() - warmAt > WARM_S * 1000) {
      console.log(`run ${run}: ok in ${secs()} s (playing at ${((warmAt - t0) / 1000).toFixed(0)} s), slowest answer ${(slowest / 1000).toFixed(1)} s, stalls over ${STALL_S} s: ${stalls.join(', ') || 'none'}, catch-up ${JSON.stringify(last?.backlog)}${errors.length ? `, errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      break;
    }
    if (Date.now() - t0 > 600000) {
      hung++;
      console.log(`run ${run}: did not start in 10 min (slowest answer ${(slowest / 1000).toFixed(1)} s, stalls: ${stalls.join(', ') || 'none'})`);
      break;
    }
    await sleep(1000);
  }
  await within(ctx.close(), 10000);
}
console.log(`${runs} runs on ${map}: ${hung} hung`);
await within(browser.close(), 10000);
process.exit(hung ? 1 : 0);
