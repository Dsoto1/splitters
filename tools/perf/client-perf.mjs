// Client render profile: plays a map offline in headless Chromium and reports
// frame rate, draw calls, active meshes, triangles, lights, shadow casters and
// materials while the match runs (the player is kept alive and turns slowly).
// Usage: pnpm build && node tools/perf/client-perf.mjs [map ...]
//   PERF_BOTS=96 (players in all, split over two teams), PERF_MODE=core.tdm,
//   PERF_GRAPHICS=low|medium|high (default medium), PERF_SECONDS=10,
//   PERF_PORT=4295, PERF_GPU=1 (use the machine's GPU instead of SwiftShader).
// SwiftShader renders on the CPU, so its frame rate is far below a real GPU's;
// compare runs on the same machine, and lean on draw calls, meshes and triangles.
import { spawn } from 'node:child_process';
import { loadavg } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const maps = process.argv.slice(2).length ? process.argv.slice(2) : ['norman_shores', 'apex_ring'];
const PORT = process.env.PERF_PORT ?? '4295';
const BOTS = Number(process.env.PERF_BOTS ?? 96);
const MODE = process.env.PERF_MODE ?? 'core.tdm';
const GRAPHICS = process.env.PERF_GRAPHICS ?? 'medium';
const SECONDS = Number(process.env.PERF_SECONDS ?? 10);
const CLIENT = `http://localhost:${PORT}`;

const preview = spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
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
const rows = [];
for (const id of maps) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript((g) => {
    try {
      localStorage.setItem('tiletrigger.graphics', g);
      localStorage.setItem('tiletrigger.frameCap', '0');
      localStorage.setItem('tiletrigger.renderScale', 'sharp');
    } catch {}
  }, GRAPHICS);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${CLIENT}/?offline=${id}&gamemode=${MODE}&bots=${BOTS}`);
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) {
    ok = await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing', null, { timeout: 10000 }).then(() => true, () => false);
    if (!ok && process.env.PERF_DEBUG) console.log(`${id}: waiting (${await page.evaluate(() => `${window.__cs ? window.__cs.phase() : 'no session'}, ${window.__match?.combatants().length ?? 0} players`)})`);
  }
  if (!ok) {
    await page.screenshot({ path: `perf-${id}.png` }).catch(() => {});
    console.log(`${id}: match did not start ${errors.join('; ')}`);
    await ctx.close();
    continue;
  }
  const stats = await page.evaluate(async (seconds) => {
    const me = window.__match?.slots[window.__cs.slot];
    if (me) setInterval(() => (me.health = 100), 50);
    const scene = window.__cs.view.scene;
    const engine = scene.getEngine();
    // Let streaming props, textures and shaders settle.
    await new Promise((r) => setTimeout(r, 4000));
    let frames = 0;
    let draws = 0;
    let frameDraws = 0;
    const counter = engine._drawCalls;
    const add = counter?.addCount?.bind(counter);
    if (counter && add) counter.addCount = (n, f) => ((frameDraws += n), add(n, f));
    const samples = { draws: [], meshes: [], tris: [] };
    const before = scene.onBeforeRenderObservable.add(() => (frameDraws = 0));
    const after = scene.onAfterRenderObservable.add(() => {
      frames++;
      draws += frameDraws;
      samples.draws.push(frameDraws);
      samples.meshes.push(scene.getActiveMeshes().length);
      samples.tris.push(scene.getActiveIndices() / 3);
    });
    // Look around: a quarter turn a second.
    const t0 = performance.now();
    const spin = setInterval(() => {
      if (window.__cs.local?.state) window.__cs.input.yaw = ((performance.now() - t0) / 1000) * (Math.PI / 2);
    }, 16);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    clearInterval(spin);
    scene.onBeforeRenderObservable.remove(before);
    scene.onAfterRenderObservable.remove(after);
    const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    // Where the triangles go: active meshes grouped by name (digits stripped), biggest first.
    const groups = new Map();
    const active = scene.getActiveMeshes();
    for (let i = 0; i < active.length; i++) {
      const m = active.data[i];
      const key = m.name.replace(/[0-9]+/g, '#').slice(0, 40);
      const tris = (m.getTotalIndices?.() ?? 0) / 3 * Math.max(1, m.thinInstanceCount || 0);
      const g = groups.get(key) ?? { n: 0, tris: 0 };
      g.n++;
      g.tris += tris;
      groups.set(key, g);
    }
    const top = [...groups].sort((a, b) => b[1].tris - a[1].tris).slice(0, 12).map(([k, g]) => `${k} x${g.n} ${(g.tris / 1000).toFixed(0)}k`);
    // Terrain plants (foliage.ts): meshes drawn, instances and triangles in view.
    const plants = { meshes: 0, instances: 0, tris: 0 };
    for (let i = 0; i < active.length; i++) {
      const m = active.data[i];
      if (!m.name.startsWith('foliage')) continue;
      const n = m.thinInstanceCount || 1;
      plants.meshes++;
      plants.instances += n;
      plants.tris += ((m.getTotalIndices?.() ?? 0) / 3) * n;
    }
    let casters = 0;
    for (const l of scene.lights) {
      const sm = l.getShadowGenerator?.()?.getShadowMap();
      const list = sm?.renderList ?? [];
      // What the shadow map really draws (a custom list filters it), else its whole list.
      casters += (sm?.getCustomRenderList ? sm.getCustomRenderList(0, list, list.length)?.length : undefined) ?? list.length;
    }
    const clustered = scene.lights.reduce((s, l) => s + (l.lights?.length ?? 0), 0);
    return {
      fps: frames / seconds,
      draws: avg(samples.draws),
      activeMeshes: avg(samples.meshes),
      triangles: avg(samples.tris),
      meshes: scene.meshes.length,
      lights: scene.lights.length,
      clustered,
      casters,
      materials: scene.materials.length,
      textures: scene.textures.length,
      bots: window.__match?.combatants().length ?? 0,
      top,
      plants,
    };
  }, SECONDS);
  const row = `| ${id} | ${GRAPHICS} | ${stats.bots} | ${stats.fps.toFixed(1)} | ${stats.draws.toFixed(0)} | ${stats.activeMeshes.toFixed(0)} / ${stats.meshes} | ${(stats.triangles / 1e6).toFixed(2)} M | ${stats.lights} (+${stats.clustered} clustered) | ${stats.casters} | ${stats.materials} | ${loadavg()[0].toFixed(1)} |`;
  console.log(row, errors.length ? `errors: ${errors.join('; ')}` : '');
  console.log(`  plants: ${stats.plants.meshes} draw calls, ${stats.plants.instances} instances, ${(stats.plants.tris / 1e6).toFixed(2)} M triangles in view`);
  if (process.env.PERF_DEBUG) console.log(`  biggest: ${stats.top.join(' | ')}`);
  rows.push(row);
  await ctx.close();
}
console.log('\n| Map | Graphics | Players | fps | Draw calls | Active / all meshes | Triangles drawn | Lights | Shadow casters | Materials | Load |\n|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
await browser.close();
stop();
process.exit(0);
