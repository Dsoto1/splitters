// Hosted 96-player match: a browser hosts a 48 v 48 bot match (Host game) and 1-3 friends join it over the
// real WebRTC path (PeerJS through a local community hub's broker, as e2e hostgame does). For two scenarios
// (bots spread over the map as they play; everyone teleported into one 40 m square every 2 s) it measures:
//   host:   the match worker's tick time (p50/p95), catch-up batch and dropped ticks; the page's frames and its
//           main-thread busy time (long tasks); what it sends each friend (messages, characters before and bytes
//           after compression) and the page's time compressing and sending it;
//   friend: snapshots a second and their arrival jitter, bytes in, inflate/parse/apply time, frames drawn past
//           the newest snapshot (extrapolating), far players frozen, clock resyncs, input → acknowledged
//           latency, frame time and draw calls.
// Usage: pnpm build && node tools/perf/host96.mjs [map ...]
//   HOST96_GUESTS=1 (friends, 1-3), PERF_GRAPHICS=low (one level for every page), PERF_SECONDS=10 per scenario,
//   PERF_PORT=4396, HOST96_HUB_PORT=4397, PERF_JSON=file (raw results), PERF_DIST=dir (serve another build),
//   PERF_GPU=1 (the machine's GPU instead of SwiftShader), HOST96_SCENARIOS=spread,clump,
//   HOST96_HOST_RENDER=0 (the host's page stops drawing once friends are in: a host with a GPU far ahead of
//   SwiftShader, so what's left on its page is serving friends and the network path can be read on its own),
//   HOST96_MAX_KBPS=n / HOST96_MAX_SEND_MS=n (exit 1 when a friend's compressed stream averages more than n KB/s,
//   or the host page spends more than n ms a second compressing and sending: a budget check for network changes).
// Every page renders on the same CPU here (SwiftShader), so frame times are far above real machines': read the
// network columns, the worker's tick and the per-message costs as the portable part.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const maps = process.argv.slice(2).length ? process.argv.slice(2) : ['norman_shores', 'frost_basin'];
const PORT = process.env.PERF_PORT ?? '4396';
const HUB_PORT = process.env.HOST96_HUB_PORT ?? '4397';
const GRAPHICS = process.env.PERF_GRAPHICS ?? 'low';
const SECONDS = Number(process.env.PERF_SECONDS ?? 10);
const GUESTS = Math.max(1, Math.min(3, Number(process.env.HOST96_GUESTS ?? 1)));
const SCENARIOS = (process.env.HOST96_SCENARIOS ?? 'spread,clump').split(',');
const CLIENT = `http://localhost:${PORT}`;
const HUB = `127.0.0.1:${HUB_PORT}`;

const procs = [];
const run = (cmd, args, env = {}) => procs.push(spawn(cmd, args, { stdio: 'ignore', detached: true, env: { ...process.env, ...env } }));
const stop = () => {
  for (const p of procs) {
    try {
      process.kill(-p.pid, 'SIGTERM');
    } catch {}
  }
};
process.on('exit', stop);
run('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort', ...(process.env.PERF_DIST ? ['--outDir', process.env.PERF_DIST] : [])]);
run('pnpm', ['--filter', '@tiletrigger/server', 'hub'], { PORT: HUB_PORT, HOST: '127.0.0.1' });
for (const url of [CLIENT, `http://${HUB}/lobby/health`]) {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await sleep(200);
  }
}

const args = process.env.PERF_GPU ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
// One browser per page: each has its own GPU process (SwiftShader renders there), as separate computers would.
const browsers = [];
const T = 600000;

/** Runs inside the match: every human kept alive (their positions and inputs are what's measured, not their deaths). */
const GOD = `(m) => { globalThis.__god ??= setInterval(() => { for (const c of m.combatants()) if (c.kind === 'human') c.health = Math.max(c.health, 100); }, 50); return m.combatants().length; }`;
/** Runs inside the match: every player into one 40 m square around the middle of the fighting. */
const CLUMP = `(m, me, seed) => {
  const all = m.combatants().filter((c) => c.alive);
  const cx = all.reduce((s, c) => s + c.move.pos.x, 0) / all.length;
  const cz = all.reduce((s, c) => s + c.move.pos.z, 0) / all.length;
  const cy = all.reduce((s, c) => s + c.move.pos.y, 0) / all.length;
  const centre = m.nav.closestPoint({ x: cx, y: cy, z: cz }, { x: 40, y: 60, z: 40 }) ?? me.move.pos;
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  let placed = 0;
  for (const c of all) {
    if (c.mount) continue;
    const want = { x: centre.x + rand() * 40 - 20, y: centre.y, z: centre.z + rand() * 40 - 20 };
    const p = m.nav.closestPoint(want, { x: 6, y: 20, z: 6 });
    if (!p) continue;
    c.move = { ...c.move, pos: { x: p.x, y: p.y + 0.05, z: p.z }, velY: 0, grounded: true };
    placed++;
  }
  return placed;
}`;
/** Runs inside the match: the sim loop's ticks since the last call. */
const WAKE = `() => {
  const w = globalThis.__simWake;
  const t = [...w.tickMs].sort((a, b) => a - b);
  const q = (p) => (t.length ? +t[Math.min(t.length - 1, Math.floor(p * t.length))].toFixed(2) : 0);
  const now = performance.now();
  const out = { wall: (now - (globalThis.__wakeT0 ?? now)) / 1000, ticks: w.ticks, tickP50: q(0.5), tickP95: q(0.95), maxBatch: w.maxBatch, dropped: w.dropped, zipMs: w.zipMs ?? 0, zipChars: w.zipChars ?? 0 };
  w.reset();
  globalThis.__wakeT0 = now;
  return out;
}`;

/** Page side: start measuring (frames, network, long tasks). */
const begin = () => {
  window.__perf.reset();
  window.__perf.on = true;
  window.__net.reset();
  window.__net.on = true;
  window.__long = 0;
  window.__t0 = performance.now();
  if (!window.__longObs) {
    window.__longObs = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__long += e.duration;
    });
    window.__longObs.observe({ entryTypes: ['longtask'] });
  }
};
/** Page side: what was measured since begin(), and two seconds of draw calls. */
const end = async () => {
  const wall = (performance.now() - window.__t0) / 1000;
  const frames = window.__perf.frames;
  window.__perf.on = false;
  const n = window.__net;
  n.on = false;
  const net = { sent: n.sent, sentChars: n.sentChars, sentBytes: n.sentBytes, sendMs: n.sendMs, recvBytes: n.recvBytes, recvChars: n.recvChars, inflateMs: n.inflateMs, parseMs: n.parseMs, arrivals: n.arrivals, ticks: n.ticks, ackMs: n.ackMs, extrapolated: n.extrapolated, sampled: n.sampled, resyncs: n.resyncs, frozen: n.frozen };
  const sc = window.__cs.view.scene;
  const counter = sc.getEngine()._drawCalls;
  const add = counter?.addCount;
  let frameDraws = 0;
  const draws = [];
  if (counter && add) counter.addCount = (k, f) => ((frameDraws += k), add.call(counter, k, f));
  const before = sc.onBeforeRenderObservable.add(() => (frameDraws = 0));
  const after = sc.onAfterRenderObservable.add(() => draws.push(frameDraws));
  await new Promise((r) => setTimeout(r, 2000));
  sc.onBeforeRenderObservable.remove(before);
  sc.onAfterRenderObservable.remove(after);
  if (counter && add) counter.addCount = add;
  return { wall, frames, net, long: window.__long, draws: draws.length ? Math.round(draws.reduce((a, b) => a + b, 0) / draws.length) : 0 };
};

const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};
const sum = (a) => a.reduce((x, y) => x + y, 0);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');

function frameStats(frames, wall) {
  const dt = frames.map((f) => f.dt);
  return { fps: frames.length / wall, p50: q(dt, 0.5), p95: q(dt, 0.95), msgPerS: sum(frames.map((f) => f.msg)) / wall, jsPerS: sum(frames.map((f) => f.js)) / wall, renderPerS: sum(frames.map((f) => f.render)) / wall };
}

function guestStats(m) {
  const wall = m.wall;
  const n = m.net;
  const gaps = n.arrivals.slice(1).map((t, i) => t - n.arrivals[i]);
  // Jitter: how far each arrival is from where the server's tick says it should be (best-fit offset), p95 of |error|.
  const off = n.arrivals.map((t, i) => t - (n.ticks[i] * 1000) / 60);
  const mid = q(off, 0.5);
  const err = off.map((o) => Math.abs(o - mid));
  return {
    ...frameStats(m.frames, wall),
    draws: m.draws,
    snapsPerS: n.arrivals.length / wall,
    gapP50: q(gaps, 0.5),
    gapP95: q(gaps, 0.95),
    gapMax: gaps.length ? Math.max(...gaps) : 0,
    jitterP95: q(err, 0.95),
    kbIn: n.recvBytes / wall / 1024,
    kbRaw: n.recvChars / wall / 1024,
    inflatePerS: n.inflateMs / wall,
    parsePerS: n.parseMs / wall,
    ackP50: q(n.ackMs, 0.5),
    ackP95: q(n.ackMs, 0.95),
    extrapolatedPct: n.sampled ? (100 * n.extrapolated) / n.sampled : 0,
    frozenPerFrame: n.sampled ? n.frozen / n.sampled : 0,
    resyncs: n.resyncs,
    longPerS: m.long / wall,
  };
}

const results = [];
const ready = () => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && !!window.__cs.view;
for (const id of maps) {
  const contexts = [];
  const page = async () => {
    const b = await chromium.launch({ args });
    browsers.push(b);
    const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
    contexts.push(ctx);
    await ctx.addInitScript((g) => {
      try {
        localStorage.setItem('tiletrigger.graphics', g);
        localStorage.setItem('tiletrigger.frameCap', '0');
      } catch {}
    }, GRAPHICS);
    return ctx.newPage();
  };
  const errors = [];
  try {
    const host = await page();
    host.on('pageerror', (e) => errors.push(`host: ${e.message}`));
    await host.goto(`${CLIENT}/?offline=${id}&gamemode=core.tdm&bots=96&hub=${HUB}`, { timeout: T });
    const log = (s) => process.env.HOST96_VERBOSE && console.log(`  [${new Date().toISOString().slice(11, 19)}] ${s}`);
    log('host loading');
    await host.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && window.__sim, null, { timeout: T });
    const sim = (src, arg) => host.evaluate(([s, a]) => window.__sim.eval(s, a), [src, arg]);
    const hasCode = () => /[A-Z0-9]{6}/.test(document.querySelector('#host-info .host-code b')?.textContent ?? '');
    for (let i = 0; i < 3; i++) {
      await host.evaluate(() => document.getElementById('host-game').click());
      if (await host.waitForFunction(hasCode, null, { timeout: 60000 }).then(() => true, () => false)) break;
    }
    const code = await host.evaluate(() => document.querySelector('#host-info .host-code b').textContent);
    log(`hosting ${code}`);
    const guests = [];
    for (let g = 0; g < GUESTS; g++) {
      const p = await page();
      p.on('pageerror', (e) => errors.push(`guest${g + 1}: ${e.message}`));
      await p.addInitScript((n) => localStorage.setItem('cs.name', n), `Friend${g + 1}`);
      await p.goto(`${CLIENT}/?join=${code}&hub=${HUB}`, { timeout: T });
      guests.push(p);
    }
    for (const p of guests) await p.waitForFunction(ready, null, { timeout: T });
    log('friends in');
    const players = await sim(GOD);
    if (process.env.HOST96_HOST_RENDER === '0') await host.evaluate(() => window.__cs.view.scene.getEngine().stopRenderLoop());
    // Friends walk about (forward, turning now and then), so their inputs and prediction are exercised.
    for (const p of guests) await p.evaluate(() => {
      window.__autoInput = { forward: 1 };
      setInterval(() => (window.__cs.input.yaw += 0.7), 1500);
    });
    // Streaming props, textures and shaders settle; the bots spread out.
    await sleep(5000);
    const row = { map: id, graphics: GRAPHICS, guests: GUESTS, players, load: loadavg()[0] };
    for (const scenario of SCENARIOS) {
      if (scenario === 'clump') await sim(CLUMP, 7);
      await sim(WAKE);
      for (const p of [host, ...guests]) await p.evaluate(begin);
      // HOST96_PROFILE=dir: a CPU profile of the host's and the first friend's page for this window (.cpuprofile, Chrome DevTools).
      const profiled = process.env.HOST96_PROFILE ? await Promise.all([host, guests[0]].map(async (p) => {
        const cdp = await p.context().newCDPSession(p);
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
        await cdp.send('Profiler.start');
        return cdp;
      })) : [];
      const t0 = Date.now();
      while (Date.now() - t0 < SECONDS * 1000) {
        await sleep(2000);
        if (scenario === 'clump') await sim(CLUMP, Date.now() % 1000);
      }
      for (const [i, cdp] of profiled.entries()) {
        const { profile } = await cdp.send('Profiler.stop');
        writeFileSync(`${process.env.HOST96_PROFILE}/${id}-${scenario}-${i ? 'friend' : 'host'}.cpuprofile`, JSON.stringify(profile));
        // Self time by function, the top 25.
        const self = new Map();
        const dt = profile.timeDeltas;
        const byId = new Map(profile.nodes.map((n) => [n.id, n]));
        profile.samples.forEach((sid, k) => {
          const n = byId.get(sid);
          const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
          self.set(key, (self.get(key) ?? 0) + (dt[k] ?? 0) / 1000);
        });
        const total = [...self.values()].reduce((a, b) => a + b, 0);
        console.log(`  ${i ? 'friend' : 'host'} profile (self ms of ${total.toFixed(0)}): ${[...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | ')}`);
      }
      const wake = await sim(WAKE);
      const [h, ...gs] = await Promise.all([host, ...guests].map((p) => p.evaluate(end)));
      const wall = h.wall;
      const hs = {
        ...frameStats(h.frames, wall),
        draws: h.draws,
        tickRate: wake.ticks / wake.wall,
        tickP50: wake.tickP50,
        tickP95: wake.tickP95,
        maxBatch: wake.maxBatch,
        droppedPerS: wake.dropped / wake.wall,
        workerZipPerS: wake.zipMs / wake.wall,
        sentPerS: h.net.sent / wall,
        kbRawPerGuest: (h.net.sentChars ? h.net.sentChars / wall : wake.zipChars / wake.wall) / 1024 / GUESTS,
        kbWirePerGuest: h.net.sentBytes / wall / 1024 / GUESTS,
        sendPerS: h.net.sendMs / wall,
        longPerS: h.long / wall,
      };
      const g = gs.map((m) => guestStats(m));
      row[scenario] = { wall, host: hs, guests: g };
      console.log(
        `${id} ${scenario} (${GUESTS} friend${GUESTS > 1 ? 's' : ''}, ${GRAPHICS}, load ${loadavg()[0].toFixed(1)})\n` +
          `  host:   worker ${f1(hs.tickRate)} ticks/s, tick p50 ${hs.tickP50} p95 ${hs.tickP95} ms, batch ${hs.maxBatch}, dropped ${f1(hs.droppedPerS)}/s | page ${f1(hs.fps)} fps (p50 ${f1(hs.p50)} p95 ${f1(hs.p95)} ms), long tasks ${f1(hs.longPerS)} ms/s, msg ${f1(hs.msgPerS)} js ${f1(hs.jsPerS)} render ${f1(hs.renderPerS)} ms/s, draws ${hs.draws}\n` +
          `          per friend ${f1(hs.sentPerS / GUESTS)} msgs/s, ${f1(hs.kbRawPerGuest)} KB/s raw → ${f1(hs.kbWirePerGuest)} KB/s on the wire; page compress+send ${f1(hs.sendPerS)} ms/s, worker ${f1(hs.workerZipPerS)} ms/s`,
      );
      g.forEach((s, i) =>
        console.log(
          `  friend${i + 1}: ${f1(s.snapsPerS)} snaps/s (gap p50 ${f1(s.gapP50)} p95 ${f1(s.gapP95)} max ${f1(s.gapMax)} ms, jitter p95 ${f1(s.jitterP95)} ms), in ${f1(s.kbIn)} KB/s (${f1(s.kbRaw)} raw), inflate ${f1(s.inflatePerS)} parse ${f1(s.parsePerS)} apply ${f1(s.msgPerS)} ms/s | ` +
            `extrapolating ${f1(s.extrapolatedPct)}% of frames, frozen far players ${f1(s.frozenPerFrame)}/frame, resyncs ${s.resyncs}, input→ack p50 ${f1(s.ackP50)} p95 ${f1(s.ackP95)} ms | ${f1(s.fps)} fps (p50 ${f1(s.p50)} p95 ${f1(s.p95)} ms), js ${f1(s.jsPerS)} render ${f1(s.renderPerS)} ms/s, long tasks ${f1(s.longPerS)} ms/s, draws ${s.draws}`,
        ),
      );
    }
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join('; ')}`);
    results.push(row);
  } catch (e) {
    console.log(`${id}: ${e.message.split('\n')[0]} ${errors.slice(0, 3).join('; ')}`);
    results.push({ map: id, failed: e.message.split('\n')[0] });
  }
  for (const ctx of contexts) await Promise.race([ctx.close(), sleep(10000)]);
  for (const b of browsers.splice(0)) await Promise.race([b.close(), sleep(10000)]);
}
if (process.env.PERF_JSON) writeFileSync(process.env.PERF_JSON, JSON.stringify(results, null, 2));
stop();
const maxKb = Number(process.env.HOST96_MAX_KBPS ?? 0);
const maxSend = Number(process.env.HOST96_MAX_SEND_MS ?? 0);
const over = [];
for (const r of results) {
  if (r.failed) over.push(`${r.map}: not measured (${r.failed})`);
  for (const s of SCENARIOS) {
    const x = r[s];
    if (!x) continue;
    if (maxKb && x.host.kbWirePerGuest > maxKb) over.push(`${r.map} ${s}: ${x.host.kbWirePerGuest.toFixed(1)} KB/s a friend > ${maxKb}`);
    if (maxSend && x.host.sendPerS > maxSend) over.push(`${r.map} ${s}: host page compress+send ${x.host.sendPerS.toFixed(1)} ms/s > ${maxSend}`);
  }
}
for (const o of over) console.log(`OVER BUDGET: ${o}`);
process.exit((maxKb || maxSend) && over.length ? 1 : 0);
