// A match's memory and frame time, measured in one page (docs/PERF_FLAVIUS_MEMORY_2026-11-16.md): an offline bot match
// on a map, then in turn
//   1. the frame split for PROF_SECONDS (the game's own probe: characters, clips, skinning, effects, render parts and
//      the counts, per frame),
//   2. a CPU profile for PROF_SECONDS (the top functions by self time, and the garbage collector's share),
//   3. an allocation profile for PROF_SECONDS (V8's sampling heap profiler, garbage included: MB a second, and the top
//      allocating functions),
//   0. (before them) what the heap holds by where it was allocated: V8's sampling heap profiler from the page's load to
//      the end of the warm-up, live objects only, summed by the allocating function and by the first of our own
//      functions on its stack (a full heap snapshot of a 1 GB heap crashed the renderer here),
//   (census) the distances of the characters in view, four times a second for PROF_SECONDS, and from them the character
//      evaluations a second the animation LOD makes at 39 and 60 fps with and without the crowd rule
//      (tools/perf/anim-census.mjs: counted, not timed, so SwiftShader's frame rate doesn't matter),
//   (bodies) the body pool over the measured steps (game/bodyPool.ts): avatars' bodies built and taken from the pool,
//      bodies put in it, let go when it was full, and its size (PROF_POOL=<n> sets the size, for comparing sizes),
//   4. the heap: before and after a full collection, and the engine's counts (window.__memory, and the CPU-side copies
//      of geometry and textures it keeps).
//
//   node tools/perf/match-profile.mjs                (after `pnpm build`; serves the build on PROF_PORT, default 4881)
//   PROF_MAP=sandfall_colosseum   PROF_BOTS=64   PROF_MODE=core.tdm   PROF_GRAPHICS=medium
//   PROF_SIZE=480x270 (the viewport: SwiftShader draws every pixel on the CPU)   PROF_WARM=25 (seconds before measuring)   PROF_SECONDS=15   PROF_QUERY=perfoff=animcrowd (more URL parameters)
//   PROF_STEPS=live,census,split,cpu,alloc,heap (which steps)   PROF_JSON=<file> (results)
//   PROF_RAW=<prefix>  also the raw profiles (<prefix>.cpuprofile, -alloc/-live.heapprofile, for DevTools)
//   PROF_POOL=24  the body pool's size in all (game/bodyPool.ts; PROF_QUERY=perfoff=bodypool for the old 16)
//   PROF_DIST=dist-prof   the build to serve (names read better from `vite build --minify false --outDir dist-prof`)
//   PROF_URL=<url> a client already being served;   CHROMIUM=<path> another Chromium
//
// Software rendering (SwiftShader) here: render times are the CPU drawing pixels, so lean on the script's own parts,
// allocation, heap and GC time.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = process.env.PROF_PORT ?? '4881';
const CLIENT = process.env.PROF_URL ?? `http://localhost:${PORT}`;
const MAP = process.env.PROF_MAP ?? 'sandfall_colosseum';
const BOTS = Number(process.env.PROF_BOTS ?? 64);
const MODE = process.env.PROF_MODE ?? 'core.tdm';
const GRAPHICS = process.env.PROF_GRAPHICS ?? 'medium';
const WARM = Number(process.env.PROF_WARM ?? 25);
const SECONDS = Number(process.env.PROF_SECONDS ?? 15);
const QUERY = process.env.PROF_QUERY ? `&${process.env.PROF_QUERY}` : '';
const STEPS = new Set((process.env.PROF_STEPS ?? 'live,census,split,cpu,alloc,heap').split(','));
const DIST = process.env.PROF_DIST ?? 'dist';
const POOL = Number(process.env.PROF_POOL ?? 0);
/** PROF_RAW=<file prefix>: the raw profiles too (open a .heapprofile or .cpuprofile in DevTools). */
const RAW = process.env.PROF_RAW;
const out = { map: MAP, bots: BOTS, graphics: GRAPHICS, query: QUERY };

const server = process.env.PROF_URL ? { pid: 0 } : spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--outDir', DIST, '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => {
  try {
    if (server.pid) process.kill(-server.pid);
  } catch {}
};
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

async function waitForHttp(url) {
  for (let i = 0; i < 120; i++) {
    if (await fetch(url).then((r) => r.ok, () => false)) return;
    await sleep(250);
  }
  throw new Error(`${url} did not come up`);
}

const mb = (b) => Math.round((b / 1048576) * 10) / 10;
const where = (cf) => `${cf.functionName || '(anonymous)'} ${(cf.url || '').split('/').pop()}:${cf.lineNumber + 1}`;

/** The frame split: the game's own probe over `seconds`. */
async function split(page, seconds) {
  return page.evaluate(async (s) => {
    const p = window.__perf;
    p.keep = 0;
    p.use('profile', true);
    p.reset();
    await new Promise((r) => setTimeout(r, s * 1000));
    const f = p.frames.slice();
    p.use('profile', false);
    const avg = (get) => f.reduce((a, x) => a + get(x), 0) / Math.max(1, f.length);
    const sys = ['avatars', 'anim', 'skin', 'fx', 'ragdoll', 'flames', 'hud', 'shadow', 'post', 'cull'];
    const counts = ['animated', 'skinned', 'ragdolls', 'lasting', 'effects', 'built'];
    const dts = f.map((x) => x.dt).sort((a, b) => a - b);
    return {
      frames: f.length,
      frameMs: avg((x) => x.dt),
      frameP95: dts[Math.floor(dts.length * 0.95)] ?? 0,
      js: avg((x) => x.js),
      render: avg((x) => x.render),
      msg: avg((x) => x.msg),
      sim: avg((x) => x.sim),
      sys: Object.fromEntries(sys.map((k, i) => [k, avg((x) => x.sys[i])])),
      n: Object.fromEntries(counts.map((k, i) => [k, avg((x) => x.n[i])])),
      characters: window.__cs.view.avatars?.size ?? null,
    };
  }, seconds);
}

/** A CPU profile: the top functions by self time, and the collector's share. */
async function cpu(cdp, seconds) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  await sleep(seconds * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  if (RAW) writeFileSync(`${RAW}.cpuprofile`, JSON.stringify(profile));
  const dt = new Map();
  for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
  const self = new Map();
  let total = 0;
  for (const n of profile.nodes) {
    const t = (dt.get(n.id) ?? 0) / 1000;
    total += t;
    const k = where(n.callFrame);
    self.set(k, (self.get(k) ?? 0) + t);
  }
  const ms = (k) => [...self].filter(([n]) => n.startsWith(k)).reduce((a, [, t]) => a + t, 0);
  return {
    seconds: total / 1000,
    gcMsPerS: ms('(garbage collector)') / (total / 1000),
    idleMsPerS: ms('(idle)') / (total / 1000),
    programMsPerS: ms('(program)') / (total / 1000),
    top: [...self].filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, t]) => [k, Math.round((t / (total / 1000)) * 100) / 100]),
  };
}

/** Our own code (not Babylon, Rapier or another package): the chunk a frame's script came from. */
const ours = (cf) => !!cf.url && !/(babylon|rapier|vendor|peerjs|recast|node_modules)/i.test(cf.url.split('/').pop()) && !/^(\(|$)/.test(cf.functionName);

/** A sampling heap profile summed by the allocating function, by it and its caller, and by the first of our functions on its stack. */
function sumSampling(profile, seconds) {
  const self = new Map();
  const withCaller = new Map();
  const byOurs = new Map();
  /** Self function → (first of our functions → bytes), to tell which of ours a Babylon allocation serves. */
  const pairs = new Map();
  /** And the other way: first of our functions → (allocating function → bytes). */
  const reverse = new Map();
  let total = 0;
  const add = (m, k, b) => m.set(k, (m.get(k) ?? 0) + b);
  const walk = (n, stack) => {
    total += n.selfSize;
    if (n.selfSize) {
      const k = where(n.callFrame);
      add(self, k, n.selfSize);
      const parent = stack[stack.length - 1];
      add(withCaller, `${k}  <  ${parent ? where(parent.callFrame) : '-'}`, n.selfSize);
      const own = [...stack, n].reverse().find((f) => ours(f.callFrame));
      const ok = own ? where(own.callFrame) : '(no frame of ours)';
      add(byOurs, ok, n.selfSize);
      let pm = pairs.get(k);
      if (!pm) pairs.set(k, (pm = new Map()));
      add(pm, ok, n.selfSize);
      let rm = reverse.get(ok);
      if (!rm) reverse.set(ok, (rm = new Map()));
      add(rm, k, n.selfSize);
    }
    stack.push(n);
    for (const c of n.children) walk(c, stack);
    stack.pop();
  };
  walk(profile.head, []);
  const scale = (b) => (seconds ? mb(b / seconds) : mb(b));
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, b]) => [name, scale(b)]);
  const split = top(self, 12).map(([k]) => [k, top(pairs.get(k), 5)]);
  const ourSplit = top(byOurs, 12).map(([k]) => [k, top(reverse.get(k), 8)]);
  return { totalMB: mb(total), ...(seconds ? { mbPerS: scale(total) } : {}), top: top(self, 40), topWithCaller: top(withCaller, 30), byOurFunction: top(byOurs, 40), topByOurs: split, oursBySelf: ourSplit };
}

/** An allocation profile (garbage included): MB a second and the top allocating functions. */
async function alloc(cdp, seconds) {
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  await sleep(seconds * 1000);
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  if (RAW) writeFileSync(`${RAW}-alloc.heapprofile`, JSON.stringify(profile));
  return sumSampling(profile, seconds);
}

async function heap(page, cdp) {
  const before = await page.evaluate(() => ({ used: performance.memory?.usedJSHeapSize ?? -1, total: performance.memory?.totalJSHeapSize ?? -1 }));
  for (let i = 0; i < 2; i++) await cdp.send('HeapProfiler.collectGarbage');
  const after = await page.evaluate(() => ({ used: performance.memory?.usedJSHeapSize ?? -1, total: performance.memory?.totalJSHeapSize ?? -1 }));
  const engine = await page.evaluate(() => {
    const m = window.__memory?.sample?.() ?? {};
    const scene = window.__cs.view.scene;
    // CPU-side copies the engine keeps: vertex data of geometries, and textures' kept buffers.
    let vertexBytes = 0;
    let indexBytes = 0;
    let numberArrays = 0;
    const seen = new Set();
    /** Number-array vertex data by the name of the first mesh using it (digits as #). */
    const byOwner = new Map();
    for (const g of scene.geometries) {
      for (const vb of Object.values(g._vertexBuffers ?? {})) {
        const d = vb?._buffer?._data ?? vb?.getData?.();
        if (!d || seen.has(d)) continue;
        seen.add(d);
        if (Array.isArray(d)) {
          numberArrays += d.length * 8;
          const owner = (g.meshes?.[0]?.name ?? '(no mesh)').replace(/[0-9]+/g, '#').slice(0, 40);
          byOwner.set(owner, (byOwner.get(owner) ?? 0) + d.length * 8);
        }
        else vertexBytes += d.byteLength ?? 0;
      }
      const ix = g._indices;
      if (ix && !seen.has(ix)) {
        seen.add(ix);
        if (Array.isArray(ix)) numberArrays += ix.length * 8;
        else indexBytes += ix.byteLength ?? 0;
      }
    }
    let texBuffers = 0;
    for (const t of scene.getEngine().getLoadedTexturesCache()) {
      const b = t._buffer;
      if (b) texBuffers += b.byteLength ?? b.length ?? 0;
    }
    return { ...m, geometryVertexMB: vertexBytes / 1048576, geometryIndexMB: indexBytes / 1048576, geometryNumberArrayMB: numberArrays / 1048576, numberArraysByMesh: [...byOwner].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, b]) => [k, Math.round(b / 104857.6) / 10]), textureBufferMB: texBuffers / 1048576 };
  });
  const r = { usedBeforeGcMB: mb(before.used), usedAfterGcMB: mb(after.used), totalMB: mb(after.total), engine };
  return r;
}

async function main() {
  await waitForHttp(CLIENT);
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'];
  const browser = await chromium.launch({ args, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const [vw, vh] = (process.env.PROF_SIZE ?? '480x270').split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  await ctx.addInitScript((g) => {
    try {
      localStorage.setItem('tiletrigger.graphics', g);
      localStorage.setItem('cs.mapVote', '0');
      localStorage.setItem('tiletrigger.frameCap', '0');
    } catch {}
  }, GRAPHICS);
  if (POOL > 0) await ctx.addInitScript((n) => (globalThis.__bodyPoolTotal = n), POOL);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
  page.on('crash', () => {
    console.log('  PAGE CRASHED');
    stop();
    process.exit(3);
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(`${CLIENT}/?offline=${MAP}&gamemode=${MODE}&bots=${BOTS}${QUERY}`);
  // What the heap holds, by where it was allocated: sampled from here to the end of the warm-up, live objects only.
  if (STEPS.has('live')) {
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768 });
  }
  await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing', null, { timeout: 600000, polling: 1000 });
  // Kept alive, turning a quarter turn a second (the crowd comes and goes from view, as in play).
  await page.evaluate(() => {
    const me = window.__match?.slots[window.__cs.slot];
    if (me) setInterval(() => (me.health = 100), 50);
    const t0 = performance.now();
    setInterval(() => {
      if (window.__cs.local?.state) window.__cs.input.yaw = ((performance.now() - t0) / 1000) * (Math.PI / 2);
    }, 16);
  });
  await sleep(WARM * 1000);
  if (STEPS.has('live')) {
    await cdp.send('HeapProfiler.collectGarbage');
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    if (RAW) writeFileSync(`${RAW}-live.heapprofile`, JSON.stringify(profile));
    out.live = sumSampling(profile, 0);
  }
  out.players = await page.evaluate(() => window.__match?.combatants().length ?? 0);
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const t0 = Date.now();
  const pool = () => page.evaluate(() => ({ ...(window.__bodyPool ?? {}), corpses: window.__cs?.view?.corpses?.length ?? -1, pooled: window.__cs?.view?.pooled?.size ?? -1 }));
  const b0 = await pool();
  if (STEPS.has('census')) {
    const samples = [];
    const end = Date.now() + SECONDS * 1000;
    while (Date.now() < end) {
      samples.push(
        await page.evaluate(() => {
          const v = window.__cs.view;
          const eye = v.scene.activeCamera?.globalPosition;
          const d = [];
          if (eye) for (const [slot, a] of v.avatars) if (a.anim && !a.culled && !a.hiddenSelf && a.wasAlive) d.push({ slot, dist: Math.hypot(a.root.position.x - eye.x, a.root.position.z - eye.z) });
          return { dt: 250, fov: v.scene.activeCamera?.fov ?? 1.35, d };
        }),
      );
      await sleep(250);
    }
    const file = `${process.env.TMPDIR ?? '/tmp'}/anim-census-${process.pid}.json`;
    writeFileSync(file, JSON.stringify({ samples }));
    const script = new URL('./anim-census.mjs', import.meta.url).pathname;
    out.census = JSON.parse(execFileSync(process.execPath, ['--experimental-transform-types', '--no-warnings', script, file], { encoding: 'utf8' }));
  }
  if (STEPS.has('split')) out.split = await split(page, SECONDS);
  if (STEPS.has('cpu')) out.cpu = await cpu(cdp, SECONDS);
  if (STEPS.has('alloc')) out.alloc = await alloc(cdp, SECONDS);
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const wall = (Date.now() - t0) / 1000;
  const b1 = await pool();
  const d = (k) => (b1[k] ?? 0) - (b0[k] ?? 0);
  const respawns = d('built') + d('reused');
  out.bodies = { seconds: Math.round(wall), built: d('built'), reused: d('reused'), kept: d('kept'), evicted: d('evicted'), refused: d('refused'), reuseShare: respawns ? Math.round((d('reused') / respawns) * 100) / 100 : null, size: b1.size, pooledAtEnd: b1.pooled, corpsesAtEnd: b1.corpses };
  out.metrics = { scriptMsPerS: ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / wall, taskMsPerS: ((m1.TaskDuration - m0.TaskDuration) * 1000) / wall, heapUsedMB: mb(m1.JSHeapUsedSize), heapTotalMB: mb(m1.JSHeapTotalSize) };
  if (STEPS.has('heap')) out.heap = await heap(page, cdp);
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  if (process.env.PROF_JSON) writeFileSync(process.env.PROF_JSON, JSON.stringify(out, null, 1));
}

try {
  await main();
} finally {
  stop();
}
