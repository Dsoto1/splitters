// Client render profile: plays a map offline in headless Chromium and reports
// frame rate, draw calls, active meshes, triangles, lights, shadow casters and
// materials while the match runs (the player is kept alive and turns slowly).
// Usage: pnpm build && node tools/perf/client-perf.mjs [map ...]
//   PERF_BOTS=96 (players in all, split over two teams), PERF_MODE=core.tdm,
//   PERF_GRAPHICS=low|medium|high (default medium), PERF_SECONDS=10,
//   PERF_PORT=4295, PERF_GPU=1 (use the machine's GPU instead of SwiftShader),
//   PERF_QUERY=env=1 (more URL parameters, e.g. the procedural environment renderer).
//
// PERF_STILL=1: a repeatable measurement instead (fixed cameras, no bots). The live sample above reads a
// bot match from wherever the player happens to be, so its counts swing by half between runs of an unchanged
// map. This mode starts the deterministic match (?test=1) on the page's own thread, takes every other
// player out, and holds the game's own camera at four viewpoints in turn, worked out from the map file
// alone (no per-map table): two overviews from opposite corners of the play area looking at its middle,
// and two at eye height, from the spawn nearest the middle looking at the farthest spawn and from the
// farthest spawn looking at the middle. At each it gives the view's models and textures up to 20 s to
// arrive, then waits until draw calls, active and total meshes,
// triangles, shadow casters and materials have stopped changing: the middle reading of the last
// PERF_STILL_FRAMES frames (default 8) agrees with that of the frames before them, within 1% (at most
// PERF_STILL_WAIT seconds, default 90, then the row says "no"), and prints one row a view (that middle
// reading, with the range of the frames when they differed) plus the map's mean. No frame rate: nothing is
// timed. PERF_BOTS, PERF_SECONDS and PERF_MODE are not used (the map's own mode runs).
// Effects are left out (flame sprites and particle bursts animate, so their draws never stop changing):
// PERF_STILL_FX=1 keeps them. PERF_SHOTS=<folder> also saves a picture of each view (to check what a camera sees).
//
// SwiftShader renders on the CPU, so its frame rate is far below a real GPU's;
// compare runs on the same machine, and lean on draw calls, meshes and triangles.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const QUERY = process.env.PERF_QUERY ? `&${process.env.PERF_QUERY}` : '';
const STILL = process.env.PERF_STILL === '1';
const STILL_FRAMES = Math.max(2, Number(process.env.PERF_STILL_FRAMES ?? 8));
const STILL_WAIT = Number(process.env.PERF_STILL_WAIT ?? 90);

/**
 * The still mode's viewpoints, from the map file alone: the play area is the map's boundary, else what its
 * tiles and spawns cover. Eye-height views name a spawn by its index; its position is read in the page from
 * the loaded map (spawns are laid on the ground there).
 */
function stillViews(map) {
  const cell = map.classicStructure?.cellSize ?? 8;
  const spawns = map.entities.map((e, index) => ({ e, index })).filter(({ e }) => e.kind === 'spawn');
  let a = map.bounds ? { x0: map.bounds.min[0], z0: map.bounds.min[1], x1: map.bounds.max[0], z1: map.bounds.max[1] } : null;
  if (!a) {
    a = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
    const grow = (x, z, r) => (a = { x0: Math.min(a.x0, x - r), z0: Math.min(a.z0, z - r), x1: Math.max(a.x1, x + r), z1: Math.max(a.z1, z + r) });
    for (const t of map.classicStructure?.tiles ?? []) grow(t.x * cell, t.y * cell, cell / 2);
    for (const { e } of spawns) grow(e.position[0], e.position[2], 4);
    if (!Number.isFinite(a.x0)) a = { x0: -20, z0: -20, x1: 20, z1: 20 };
  }
  const cx = (a.x0 + a.x1) / 2;
  const cz = (a.z0 + a.z1) / 2;
  const diag = Math.hypot(a.x1 - a.x0, a.z1 - a.z0);
  const ys = spawns.map(({ e }) => e.position[1]);
  const top = ys.length ? Math.max(...ys) : 0;
  const mid = ys.length ? [...ys].sort((p, q) => p - q)[Math.floor(ys.length / 2)] : 0;
  // Overviews: a tenth of the way in from a corner, a quarter of the diagonal up (12 to 60 m) above the highest spawn.
  const up = top + Math.max(12, Math.min(60, diag * 0.25));
  const corner = (fx, fz) => ({ eye: [a.x0 + (a.x1 - a.x0) * fx, up, a.z0 + (a.z1 - a.z0) * fz], target: [cx, mid, cz] });
  const views = [
    { name: 'overview SW', ...corner(0.1, 0.1) },
    { name: 'overview NE', ...corner(0.9, 0.9) },
  ];
  if (spawns.length) {
    const d = ({ e }) => Math.hypot(e.position[0] - cx, e.position[2] - cz);
    // Ties go to the earlier spawn, so the choice never depends on sort order.
    const pick = (better) => spawns.reduce((b, s) => (better(d(s), d(b)) ? s : b));
    const near = pick((p, q) => p < q);
    const far = pick((p, q) => p > q);
    views.push({ name: 'eye, middle spawn', spawn: near.index, toSpawn: far.index });
    views.push({ name: 'eye, far spawn', spawn: far.index, target: [cx, mid + 1.7, cz] });
  }
  return views;
}

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

/** PERF_STILL=1: one map from its fixed cameras, with nobody else in it. */
async function measureStill(id, ctx, page, errors) {
  const map = JSON.parse(readFileSync(new URL(`../../maps/${id}.json`, import.meta.url), 'utf8'));
  // The match on the page's own thread, so the other players can be taken out (window.__match).
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tiletrigger.sim', 'main');
    } catch {}
  });
  await page.goto(`${CLIENT}/?offline=${id}&test=1&god=1${QUERY}`);
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) ok = await page.waitForFunction(() => window.__match && window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing', null, { timeout: 10000 }).then(() => true, () => false);
  if (!ok) return void console.log(`${id}: match did not start ${errors.join('; ')}`);
  // Pictures of the views (PERF_SHOTS=<folder>) without the menus over them.
  if (process.env.PERF_SHOTS) await page.addStyleTag({ content: '#hud, #pause, #crosshair, #countdown, #loading-screen, #toast, .toast { display: none !important; }' });
  await page.evaluate((fx) => {
    const m = window.__match;
    const view = window.__cs.view;
    const me = m.slots[window.__cs.slot];
    // Nobody else, for good; and nothing ends the player's life or the match's view of it.
    const clear = () => {
      for (const c of m.slots) if (c && c.slot !== window.__cs.slot && c.alive) Object.assign(c, { alive: false, respawnTick: 1e12 });
      if (me) me.health = 100;
      for (const [slot, a] of view.avatars ?? []) {
        if (slot === window.__cs.slot) continue;
        a.root?.setEnabled(false);
        a.placeholder?.setEnabled(false);
        a.ragdoll?.root?.setEnabled?.(false);
      }
      view.clearCorpses?.();
    };
    clear();
    // Per-frame counts, and the game's own camera held where the measurement wants it: the game still places
    // it every frame (plants, the environment renderer, shadows and prop flames all follow it), only the pose is ours.
    const scene = view.scene;
    const engine = scene.getEngine();
    const still = (window.__still = { pose: null, frames: [], draws: 0 });
    const counter = engine._drawCalls;
    const add = counter?.addCount?.bind(counter);
    if (counter && add) counter.addCount = (n, f) => ((still.draws += n), add(n, f));
    const setCamera = view.setCamera.bind(view);
    view.setCamera = (eye, yaw, pitch, fov, roll) => (still.pose ? setCamera(still.pose.eye, still.pose.yaw, still.pose.pitch, still.pose.fov, 0) : setCamera(eye, yaw, pitch, fov, roll));
    // Effects animate (a fire's flame sprites, particle bursts), so their draws never stop changing: left out, unless
    // PERF_STILL_FX=1 asks for them (the rows then read the middle of what was seen, a few percent apart run to run).
    const noFx = !fx;
    if (noFx) scene.particlesEnabled = false;
    scene.onBeforeRenderObservable.add(() => {
      // Before every frame: a mode that starts a new round brings its players back.
      clear();
      if (noFx) for (const mesh of scene.meshes) if (mesh.isEnabled(false) && /^(gv_|sc_flame)/.test(mesh.name)) mesh.setEnabled(false);
      still.draws = 0;
    });
    scene.onAfterRenderObservable.add(() => {
      let casters = 0;
      for (const l of scene.lights) {
        const sm = l.getShadowGenerator?.()?.getShadowMap();
        const list = sm?.renderList ?? [];
        casters += (sm?.getCustomRenderList ? sm.getCustomRenderList(0, list, list.length)?.length : undefined) ?? list.length;
      }
      still.frames.push([still.draws, scene.getActiveMeshes().length, scene.meshes.length, scene.getActiveIndices() / 3, casters, scene.materials.length]);
      if (still.frames.length > 400) still.frames.splice(0, 200);
    });
  }, process.env.PERF_STILL_FX === '1');
  const sums = [0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const v of stillViews(map)) {
    const pose = await page.evaluate((v) => {
      const ents = window.__match.map.entities;
      const at = (i) => ents[i].position;
      const eye = v.eye ?? [at(v.spawn)[0], at(v.spawn)[1] + 1.7, at(v.spawn)[2]];
      const t = v.target ?? [at(v.toSpawn)[0], at(v.toSpawn)[1] + 1.7, at(v.toSpawn)[2]];
      const dx = t[0] - eye[0];
      const dy = t[1] - eye[1];
      const dz = t[2] - eye[2];
      const flat = Math.hypot(dx, dz);
      // Yaw 0 looks along +Z; a view straight at its own spot looks north instead.
      const pose = { eye: { x: eye[0], y: eye[1], z: eye[2] }, yaw: flat > 0.01 ? Math.atan2(dx, dz) : 0, pitch: flat > 0.01 ? Math.atan2(dy, flat) : 0, fov: 1.35 };
      window.__still.pose = pose;
      window.__still.frames.length = 0;
      return pose;
    }, v);
    // Models and textures the view asks for first (a prop's full detail comes in after its stand-in): up to 20 s.
    await page.waitForFunction(() => window.__still.frames.length >= 2 && window.__cs.view.scene.isReady() && !window.__cs.view.scene.isLoading, null, { timeout: 20000, polling: 250 }).catch(() => {});
    await page.evaluate(() => (window.__still.frames.length = 0));
    // Settled: the middle reading of the last PERF_STILL_FRAMES frames agrees with that of the frames before them, on
    // every count (within 1%, or 2 of anything). Middle readings, because some things never hold still: the shadow
    // map draws a changing share of its casters on some maps, and a frame now and then has 10% more draws than its
    // neighbours.
    const settled = await page.waitForFunction((k) => {
      const f = window.__still.frames;
      if (f.length < 2 * k) return false;
      const mid = (rows, j) => rows.map((r) => r[j]).sort((p, q) => p - q)[Math.floor(rows.length / 2)];
      const now = f.slice(-k);
      const before = f.slice(-2 * k, -k);
      for (let j = 0; j < 6; j++) {
        const a = mid(now, j);
        const b = mid(before, j);
        if (Math.abs(a - b) > Math.max(2, 0.01 * Math.max(a, b))) return false;
      }
      return true;
    }, STILL_FRAMES, { timeout: STILL_WAIT * 1000, polling: 250 }).then(() => true, () => false);
    const { last, lo, hi } = await page.evaluate((k) => {
      const f = window.__still.frames.slice(-k);
      const col = (j) => f.map((r) => r[j]).sort((p, q) => p - q);
      // The middle reading of the last frames (the same as every one of them when settled).
      return { last: f[0].map((_, j) => col(j)[Math.floor(f.length / 2)]), lo: f[0].map((_, j) => col(j)[0]), hi: f[0].map((_, j) => col(j)[f.length - 1]) };
    }, STILL_FRAMES);
    if (process.env.PERF_SHOTS) await page.screenshot({ path: `${process.env.PERF_SHOTS}/${id}-${GRAPHICS}-${v.name.replace(/[^a-z]+/gi, '_')}.png` }).catch(() => {});
    const span = lo[0] === hi[0] && lo[1] === hi[1] && lo[4] === hi[4] ? '' : ` (draws ${lo[0]} to ${hi[0]}, meshes ${lo[1]} to ${hi[1]}, casters ${lo[4]} to ${hi[4]})`;
    const range = `${settled ? 'yes' : 'no'}${span}`;
    // PERF_DEBUG: what came and went between the last two frames (by mesh name, digits stripped).
    if (process.env.PERF_DEBUG && span) console.log(`  varies: ${await page.evaluate(async () => {
      const scene = window.__cs.view.scene;
      const names = () => {
        const a = scene.getActiveMeshes();
        const m = new Map();
        for (let i = 0; i < a.length; i++) { const k = a.data[i].name.replace(/[0-9]+/g, '#').slice(0, 40); m.set(k, (m.get(k) ?? 0) + 1); }
        return m;
      };
      const seen = new Map();
      for (let n = 0; n < 6; n++) {
        for (const [k, c] of names()) { const s = seen.get(k) ?? [Infinity, -Infinity]; seen.set(k, [Math.min(s[0], c), Math.max(s[1], c)]); }
        const f = scene.getFrameId();
        await new Promise((r) => { const t = setInterval(() => { if (scene.getFrameId() > f) { clearInterval(t); r(); } }, 50); });
        for (const k of seen.keys()) if (!names().has(k)) seen.set(k, [0, seen.get(k)[1]]);
      }
      return [...seen].filter(([, [a, b]]) => a !== b).map(([k, [a, b]]) => `${k} ${a}-${b}`).join(', ') || 'no mesh (draws only)';
    })}`);
    const row = `| ${id} | ${GRAPHICS} | ${v.name} | ${last[0]} | ${last[1]} / ${last[2]} | ${(last[3] / 1e6).toFixed(3)} M | ${last[4]} | ${last[5]} | ${range} |`;
    console.log(row, process.env.PERF_DEBUG ? JSON.stringify(pose) : '');
    rows.push(row);
    last.forEach((x, j) => (sums[j] += x));
    n++;
  }
  if (n) {
    const m = sums.map((x) => x / n);
    rows.push(`| ${id} | ${GRAPHICS} | **mean of ${n}** | ${m[0].toFixed(0)} | ${m[1].toFixed(0)} / ${m[2].toFixed(0)} | ${(m[3] / 1e6).toFixed(3)} M | ${m[4].toFixed(0)} | ${m[5].toFixed(0)} | |`);
    console.log(rows[rows.length - 1], errors.length ? `errors: ${errors.join('; ')}` : '');
  }
}

const args = process.env.PERF_GPU ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args });
const rows = [];
for (const id of maps) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript((g) => {
    try {
      localStorage.setItem('tiletrigger.graphics', g);
          // One map measured: the match replays when it ends (no vote that travels to another map and a fresh worker).
          localStorage.setItem('cs.mapVote', '0');
      localStorage.setItem('tiletrigger.frameCap', '0');
      localStorage.setItem('tiletrigger.renderScale', 'sharp');
    } catch {}
  }, GRAPHICS);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (STILL) {
    await measureStill(id, ctx, page, errors);
    await ctx.close();
    continue;
  }
  await page.goto(`${CLIENT}/?offline=${id}&gamemode=${MODE}&bots=${BOTS}${QUERY}`);
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
      // The procedural environment renderer (?env=1): its copies, batches and levels of detail at the end.
      env: window.__cs.view.environment?.stats() ?? null,
    };
  }, SECONDS);
  const row = `| ${id} | ${GRAPHICS} | ${stats.bots} | ${stats.fps.toFixed(1)} | ${stats.draws.toFixed(0)} | ${stats.activeMeshes.toFixed(0)} / ${stats.meshes} | ${(stats.triangles / 1e6).toFixed(2)} M | ${stats.lights} (+${stats.clustered} clustered) | ${stats.casters} | ${stats.materials} | ${loadavg()[0].toFixed(1)} |`;
  console.log(row, errors.length ? `errors: ${errors.join('; ')}` : '');
  console.log(`  plants: ${stats.plants.meshes} draw calls, ${stats.plants.instances} instances, ${(stats.plants.tris / 1e6).toFixed(2)} M triangles in view`);
  if (stats.env) console.log(`  environment: ${stats.env.copies} copies, ${stats.env.drawnBatches} of ${stats.env.batches} batches drawn, per level ${stats.env.perLevel.join(' / ')}`);
  if (process.env.PERF_DEBUG) console.log(`  biggest: ${stats.top.join(' | ')}`);
  rows.push(row);
  await ctx.close();
}
if (STILL) {
  console.log('\n| Map | Graphics | View | Draw calls | Active / all meshes | Triangles drawn | Shadow casters | Materials | Settled |\n|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(r);
  await browser.close();
  stop();
  process.exit(0);
}
console.log('\n| Map | Graphics | Players | fps | Draw calls | Active / all meshes | Triangles drawn | Lights | Shadow casters | Materials | Load |\n|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
await browser.close();
stop();
process.exit(0);
