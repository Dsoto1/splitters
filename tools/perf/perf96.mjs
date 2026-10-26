// 96-player frame budget: plays a map offline with 96 players in headless Chromium and
// splits each rendered frame into simulation (on the page's thread), message handling,
// the game frame's JS, scene.render and the rest, for two scenarios: bots spread over the
// map as they play, and every player teleported into one 40 m square mid-fight.
// Per tick it also reports bot thinking, player movement (physics) and the rest (simProfile).
// Usage: pnpm build && node tools/perf/perf96.mjs [map ...]
//   PERF_GRAPHICS=medium,low (each is measured), PERF_SIM=worker|main (where the offline
//   match runs; default: the game's own choice), PERF_SECONDS=8 per scenario, PERF_PORT=4296,
//   PERF_GPU=1 (the machine's GPU instead of SwiftShader), PERF_JSON=file (raw results),
//   PERF_DIST=dir (serve that build instead of packages/client/dist).
// SwiftShader renders on the CPU, so render times are far above a real GPU's: compare runs
// on the same machine, and read the sim and JS columns as the portable part.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const maps = process.argv.slice(2).length ? process.argv.slice(2) : ['norman_shores', 'frost_basin'];
const PORT = process.env.PERF_PORT ?? '4296';
const GRAPHICS = (process.env.PERF_GRAPHICS ?? 'medium,low').split(',');
const SECONDS = Number(process.env.PERF_SECONDS ?? 8);
const SIM = process.env.PERF_SIM ?? '';
const CLIENT = `http://localhost:${PORT}`;

// PERF_DIST=dir serves another build (say, one saved from before a change) for a before/after.
const preview = spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort', ...(process.env.PERF_DIST ? ['--outDir', process.env.PERF_DIST] : [])], { stdio: 'ignore', detached: true });
const stop = () => {
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {}
};
process.on('exit', stop);
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(CLIENT)).ok) break;
  } catch {}
  await sleep(200);
}

const args = process.env.PERF_GPU ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args });

/** Runs inside the match (page or worker): keep the player alive. */
const GOD = `(m, me) => { setInterval(() => { me.health = Math.max(me.health, 100); }, 50); return m.combatants().length; }`;
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
/** Runs inside the match: per-tick sections since the last call (simProfile), and ticks run. */
const PROFILE = `(m, me, on, mod) => {
  const p = mod.simProfile;
  const w = globalThis.__simWake;
  const wake = w ? { wakes: w.wakes, ticks: w.ticks, maxBatch: w.maxBatch, dropped: w.dropped, msPerWake: w.wakes ? +(w.ms / w.wakes).toFixed(2) : 0, maxWakeMs: +w.maxWakeMs.toFixed(1) } : null;
  const out = { ticks: m.tick - (globalThis.__perfTick0 ?? m.tick), ms: Object.fromEntries(p.ms), n: Object.fromEntries(p.n), wake };
  p.reset();
  p.on = on;
  globalThis.__perfTick0 = m.tick;
  w?.reset();
  return out;
}`;

const results = [];
for (const id of maps) {
  for (const graphics of GRAPHICS) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.addInitScript(
      ([g, sim]) => {
        try {
          localStorage.setItem('tiletrigger.graphics', g);
          localStorage.setItem('tiletrigger.frameCap', '0');
          if (sim) localStorage.setItem('tiletrigger.sim', sim);
        } catch {}
      },
      [graphics, SIM],
    );
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${CLIENT}/?offline=${id}&gamemode=core.tdm&bots=96`);
    const ok = await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && window.__sim, null, { timeout: 600000 }).then(() => true, () => false);
    if (!ok) {
      console.log(`${id}/${graphics}: match did not start ${errors.join('; ')}`);
      await ctx.close();
      continue;
    }
    const sim = (src, arg) => page.evaluate(([s, a]) => window.__sim.eval(s, a), [src, arg]);
    const players = await sim(GOD);
    const mode = await page.evaluate(() => window.__sim.mode ?? 'main');
    // Let streaming props, textures and shaders settle, and the bots spread out.
    await sleep(5000);
    const row = { map: id, graphics, players, sim: mode, load: loadavg()[0] };
    for (const scenario of ['spread', 'clump']) {
      if (scenario === 'clump') row.placed = await sim(CLUMP, 7);
      await sim(PROFILE, true);
      await page.evaluate(() => {
        window.__perf.reset();
        window.__perf.on = true;
      });
      const t0 = Date.now();
      // Clumped: put everyone back together every 2 s (they scatter as they fight).
      while (Date.now() - t0 < SECONDS * 1000) {
        await sleep(2000);
        if (scenario === 'clump') await sim(CLUMP, Date.now() % 1000);
      }
      const frames = await page.evaluate(() => {
        window.__perf.on = false;
        return window.__perf.frames;
      });
      const prof = await sim(PROFILE, false);
      const wall = (Date.now() - t0) / 1000;
      const avg = (k) => frames.reduce((s, f) => s + f[k], 0) / Math.max(1, frames.length);
      const sorted = frames.map((f) => f.dt).sort((a, b) => a - b);
      const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
      const ticks = Math.max(1, prof.ticks);
      const per = (k) => (prof.ms[k] ?? 0) / ticks;
      const physics = per('players') + per('mounts');
      const total = Object.values(prof.ms).reduce((s, v) => s + v, 0) - (prof.ms.move ?? 0) - (prof.ms.nav ?? 0) - (prof.ms.commit ?? 0);
      row[scenario] = {
        frames: frames.length,
        fps: frames.length / wall,
        dt: avg('dt'),
        p50: pct(0.5),
        p95: pct(0.95),
        max: sorted[sorted.length - 1] ?? 0,
        sim: avg('sim'),
        ticksPerFrame: avg('ticks'),
        maxBatch: Math.max(0, ...frames.map((f) => f.batch)),
        msg: avg('msg'),
        js: avg('js'),
        render: avg('render'),
        other: Math.max(0, avg('dt') - avg('sim') - avg('msg') - avg('js') - avg('render')),
        tickRate: prof.ticks / wall,
        // Share of the page's thread (ms per second) taken by the simulation and by handling its messages.
        simShare: frames.reduce((a, f) => a + f.sim, 0) / wall,
        msgShare: frames.reduce((a, f) => a + f.msg, 0) / wall,
        tick: { bots: per('bots'), physics, nav: per('nav'), move: per('move'), rest: total / ticks - per('bots') - physics, total: total / ticks },
        wake: prof.wake,
      };
      const r = row[scenario];
      console.log(
        `${id} ${graphics} ${mode} ${scenario}: ${r.fps.toFixed(1)} fps, frame ${r.dt.toFixed(1)} ms (p50 ${r.p50.toFixed(1)}, p95 ${r.p95.toFixed(1)}, max ${r.max.toFixed(0)}) = sim ${r.sim.toFixed(1)} (${r.ticksPerFrame.toFixed(2)} ticks, max ${r.maxBatch}; ${r.simShare.toFixed(0)} ms/s) + msg ${r.msg.toFixed(1)} (${r.msgShare.toFixed(0)} ms/s) + js ${r.js.toFixed(1)} + render ${r.render.toFixed(1)} + other ${r.other.toFixed(1)} | ${r.tickRate.toFixed(1)} ticks/s, tick ${r.tick.total.toFixed(2)} ms = bots ${r.tick.bots.toFixed(2)} + physics ${r.tick.physics.toFixed(2)} + rest ${r.tick.rest.toFixed(2)}${prof.wake ? ` | worker wakes: ${JSON.stringify(prof.wake)}` : ''}${scenario === 'clump' ? ` | ${row.placed} placed` : ''}`,
      );
    }
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join('; ')}`);
    results.push(row);
    await ctx.close();
  }
}
if (process.env.PERF_JSON) writeFileSync(process.env.PERF_JSON, JSON.stringify(results, null, 2));
await browser.close();
stop();
process.exit(0);
