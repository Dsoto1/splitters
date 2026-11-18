// Client render profile: plays a map offline in headless Chromium and reports
// frame rate, draw calls, active meshes, triangles, lights, shadow casters and
// materials while the match runs (the player is kept alive and turns slowly).
// Usage: pnpm build && node tools/perf/client-perf.mjs [map ...]
//   PERF_BOTS=96 (players in all, split over two teams), PERF_MODE=core.tdm,
//   PERF_GRAPHICS=low|medium|high (default medium), PERF_SECONDS=10,
//   CHROMIUM=<browser binary>, PERF_PORT=4295, PERF_GPU=1 (use the machine's GPU instead of SwiftShader),
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
// PERF_STILL_EXTRA adds views (JSON, see stillViews; a view may set its own `fov`, radians). PERF_DSF=2 renders at that
// device scale factor and PERF_SIZE=1280x720 sets the viewport (pictures for the owner); PERF_NOGUN=1 hides the
// first-person weapon and arms (their draws then leave the counts too). PERF_BREAKDOWN=1 also prints each view's draws by pass (main view,
// shadow map, sun shafts, reflections) and by the mesh drawing them (names, digits stripped; PERF_BREAKDOWN_TOP=40), and the
// shadow casters the column counts, by name. PERF_SPLIT=1 prints each view's frame split (render, shadow pass, mesh
// evaluation, game JS; ms on this machine) and the shadow pass's own draws over 40 frames; PERF_WALK=<m> then walks the
// camera that far ahead and prints the same over the walk (static shadow cache redraws, levels of detail changing).
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
  // PERF_STILL_EXTRA: more views for one map, as JSON: [{ "name", "spawn" (index) or "eye" [x, y, z], and "target"
  // [x, y, z], "toSpawn" (index) or "look" [dx, dy, dz] from the eye }] (e.g. a view into the sun for its shafts).
  // PERF_STILL_EXTRA_ONLY=1: those views alone (pictures of chosen spots).
  if (process.env.PERF_STILL_EXTRA) views.push(...JSON.parse(process.env.PERF_STILL_EXTRA));
  return process.env.PERF_STILL_EXTRA_ONLY === '1' ? views.slice(views.length - JSON.parse(process.env.PERF_STILL_EXTRA ?? '[]').length) : views;
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
  await page.evaluate(([fx, bdOn, gunOff]) => {
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
    // PERF_BREAKDOWN=1: each draw put down to its pass (the main view, a shadow map, a reflection) and to the mesh
    // drawing it (by name, digits stripped), so a view's draws can be traced to what makes them.
    const bd = bdOn ? { pass: '', mesh: null, frame: new Map(), last: new Map() } : null;
    still.bd = bd;
    if (counter && add) counter.addCount = (n, f) => {
      still.draws += n;
      if (bd) {
        const k = `${bd.pass || 'main'}|${bd.mesh ? bd.mesh.name.replace(/[0-9]+/g, '#').slice(0, 48) : '(no mesh: post, sprites, layers)'}`;
        bd.frame.set(k, (bd.frame.get(k) ?? 0) + n);
      }
      return add(n, f);
    };
    if (bd) {
      const own = (o, key) => {
        for (let p = Object.getPrototypeOf(o); p; p = Object.getPrototypeOf(p)) if (Object.prototype.hasOwnProperty.call(p, key)) return p;
        return null;
      };
      // A mesh's draws all go through _processRendering: the main view's (render) and each pass's own (shadow maps,
      // the sun's rays) that skip render.
      const meshProto = own(scene.meshes.find((m) => typeof m._processRendering === 'function' && !m.isAnInstance), '_processRendering');
      const draw = meshProto._processRendering;
      meshProto._processRendering = function (...a) {
        const was = bd.mesh;
        bd.mesh = a[0]?.getClassName ? a[0] : this;
        try {
          return draw.apply(this, a);
        } finally {
          bd.mesh = was;
        }
      };
      const rtts = [];
      for (const l of scene.lights) { const sm = l.getShadowGenerator?.()?.getShadowMap(); if (sm) rtts.push(sm); }
      const rttProto = rtts.length ? own(rtts[0], 'render') : null;
      if (rttProto) {
        const render = rttProto.render;
        rttProto.render = function (...a) {
          const was = bd.pass;
          bd.pass = this.name.replace(/[0-9]+/g, '#').slice(0, 32);
          try {
            return render.apply(this, a);
          } finally {
            bd.pass = was;
          }
        };
      }
    }
    const setCamera = view.setCamera.bind(view);
    view.setCamera = (eye, yaw, pitch, fov, roll) => (still.pose ? setCamera(still.pose.eye, still.pose.yaw, still.pose.pitch, still.pose.fov, 0) : setCamera(eye, yaw, pitch, fov, roll));
    // Effects animate (a fire's flame sprites, particle bursts), so their draws never stop changing: left out, unless
    // PERF_STILL_FX=1 asks for them (the rows then read the middle of what was seen, a few percent apart run to run).
    const noFx = !fx;
    const noGun = gunOff;
    if (noFx) scene.particlesEnabled = false;
    scene.onBeforeRenderObservable.add(() => {
      // Before every frame: a mode that starts a new round brings its players back.
      clear();
      if (noGun) for (const mesh of scene.meshes) if (mesh.renderingGroupId === 1 && mesh.isEnabled(false)) mesh.setEnabled(false);
      if (noFx) for (const mesh of scene.meshes) if (mesh.isEnabled(false) && /^(gv_|sc_flame)/.test(mesh.name)) mesh.setEnabled(false);
      still.draws = 0;
      still.shadowDraws = 0;
      if (bd) {
        if (bd.frame.size) bd.last = bd.frame;
        bd.frame = new Map();
      }
    });
    // The shadow pass's own draws a frame (every cascade), for PERF_SPLIT's line.
    for (const l of scene.lights) {
      const sm = l.getShadowGenerator?.()?.getShadowMap();
      if (!sm) continue;
      let at = 0;
      sm.onBeforeBindObservable.add(() => (at = still.draws));
      sm.onAfterUnbindObservable.add(() => (still.shadowDraws += still.draws - at));
    }
    scene.onAfterRenderObservable.add(() => {
      let casters = 0;
      for (const l of scene.lights) {
        const sm = l.getShadowGenerator?.()?.getShadowMap();
        const list = sm?.renderList ?? [];
        casters += (sm?.getCustomRenderList ? sm.getCustomRenderList(0, list, list.length)?.length : undefined) ?? list.length;
      }
      still.frames.push([still.draws, scene.getActiveMeshes().length, scene.meshes.length, scene.getActiveIndices() / 3, casters, scene.materials.length, still.shadowDraws ?? 0]);
      if (still.frames.length > 400) still.frames.splice(0, 200);
    });
  }, [process.env.PERF_STILL_FX === '1', process.env.PERF_BREAKDOWN === '1', process.env.PERF_NOGUN === '1']);
  const sums = [0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const v of stillViews(map)) {
    const pose = await page.evaluate((v) => {
      const ents = window.__match.map.entities;
      const at = (i) => ents[i].position;
      const eye = v.eye ?? [at(v.spawn)[0], at(v.spawn)[1] + 1.7, at(v.spawn)[2]];
      const t = v.look ? eye.map((x, i) => x + v.look[i]) : (v.target ?? [at(v.toSpawn)[0], at(v.toSpawn)[1] + 1.7, at(v.toSpawn)[2]]);
      const dx = t[0] - eye[0];
      const dy = t[1] - eye[1];
      const dz = t[2] - eye[2];
      const flat = Math.hypot(dx, dz);
      // Yaw 0 looks along +Z; a view straight at its own spot looks north instead.
      const pose = { eye: { x: eye[0], y: eye[1], z: eye[2] }, yaw: flat > 0.01 ? Math.atan2(dx, dz) : 0, pitch: flat > 0.01 ? Math.atan2(dy, flat) : 0, fov: v.fov ?? 1.35 };
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
    if (process.env.PERF_SHOTS) await page.screenshot({ path: `${process.env.PERF_SHOTS}/${id}-${GRAPHICS}-${v.name.replace(/[^a-z]+/gi, '_')}.png`, timeout: 180000 }).catch(() => {});
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
    if (process.env.PERF_BREAKDOWN === '1') console.log(await page.evaluate((top) => {
      const last = window.__still.bd?.last ?? new Map();
      const passes = new Map();
      for (const [k, n] of last) { const p = k.split('|')[0]; passes.set(p, (passes.get(p) ?? 0) + n); }
      const lines = [`  passes: ${[...passes].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(', ')}`];
      for (const [p] of [...passes].sort((a, b) => b[1] - a[1])) {
        const rows = [...last].filter(([k]) => k.split('|')[0] === p).sort((a, b) => b[1] - a[1]).slice(0, top);
        lines.push(`  ${p}: ${rows.map(([k, n]) => `${k.split('|')[1]} ${n}`).join(' | ')}`);
      }
      // The shadow casters the map's list holds this frame (what the Shadow casters column counts), by mesh name.
      const scene = window.__cs.view.scene;
      const names = new Map();
      for (const l of scene.lights) {
        const sm = l.getShadowGenerator?.()?.getShadowMap();
        const list = sm?.renderList ?? [];
        for (const m of (sm?.getCustomRenderList ? sm.getCustomRenderList(0, list, list.length) : null) ?? list) {
          const k = m.name.replace(/[0-9]+/g, '#').slice(0, 48);
          names.set(k, (names.get(k) ?? 0) + 1);
        }
      }
      lines.push(`  casters: ${[...names].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => `${k} ${n}`).join(' | ')}`);
      return lines.join('\n');
    }, Number(process.env.PERF_BREAKDOWN_TOP ?? 40)));
    // PERF_SPLIT=1: the page's own time a frame at this view (the frame split of docs/PERF_TOOLS.md, on this machine:
    // SwiftShader's numbers are for comparing runs, not real hardware), and the shadow pass's draws, over 40 frames.
    // PERF_WALK=<m>: then the camera walks that far ahead at 0.1 m a frame (cascades move, levels of detail change) and
    // the same is read over the walk: what a still view hides (the static shadow cache redraws as the camera moves).
    if (process.env.PERF_SPLIT === '1' || process.env.PERF_WALK) {
      const split = async (walk) => page.evaluate(async (walk) => {
        const perf = window.__perf;
        perf.use('client-perf', true);
        perf.keep = 0;
        const scene = window.__cs.view.scene;
        const pose = window.__still.pose;
        const start = { ...pose.eye };
        const frames = walk ? Math.round(walk / 0.1) : 40;
        const dir = { x: Math.sin(pose.yaw), z: Math.cos(pose.yaw) };
        const nextFrame = () => new Promise((r) => { const f = scene.getFrameId(); const t = setInterval(() => { if (scene.getFrameId() > f) { clearInterval(t); r(); } }, 5); });
        await nextFrame();
        perf.reset();
        window.__still.frames.length = 0;
        for (let i = 0; i < frames; i++) {
          if (walk) pose.eye = { x: start.x + dir.x * 0.1 * (i + 1), y: start.y, z: start.z + dir.z * 0.1 * (i + 1) };
          await nextFrame();
        }
        const f = perf.frames.slice(1);
        const rows = window.__still.frames.slice(1);
        pose.eye = start;
        perf.use('client-perf', false);
        const avg = (g) => (f.length ? f.reduce((n, x) => n + g(x), 0) / f.length : 0);
        const ravg = (j) => (rows.length ? rows.reduce((n, r) => n + r[j], 0) / rows.length : 0);
        return { n: f.length, render: avg((x) => x.render), shadow: avg((x) => x.sys[7]), cull: avg((x) => x.sys[9]), post: avg((x) => x.sys[8]), js: avg((x) => x.js), draws: ravg(0), casters: ravg(4), shadowDraws: ravg(6), shadowMax: Math.max(0, ...rows.map((r) => r[6])), tris: ravg(3) };
      }, walk);
      const say = (label, r) => console.log(`  ${label}: render ${r.render.toFixed(1)} ms (shadow ${r.shadow.toFixed(1)}, cull ${r.cull.toFixed(1)}, post ${r.post.toFixed(1)}) · game js ${r.js.toFixed(1)} ms · draws ${r.draws.toFixed(0)} · shadow draws ${r.shadowDraws.toFixed(1)} (max ${r.shadowMax}) · casters ${r.casters.toFixed(0)} · ${(r.tris / 1e6).toFixed(3)} M tris · ${r.n} frames`);
      say('still', await split(0));
      if (process.env.PERF_WALK) say(`walk ${process.env.PERF_WALK} m`, await split(Number(process.env.PERF_WALK)));
    }
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
// CHROMIUM (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH): the browser binary to launch instead of Playwright's own (as e2e/run.mjs).
const exe = process.env.CHROMIUM || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(exe ? { args, executablePath: exe } : { args });
const rows = [];
for (const id of maps) {
  const [vw, vh] = (process.env.PERF_SIZE ?? '960x540').split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.PERF_DSF ?? 1) });
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
