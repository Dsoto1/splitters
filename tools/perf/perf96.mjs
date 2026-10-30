// 96-player frame budget: plays a map offline with 96 players in headless Chromium and
// splits each rendered frame into simulation (on the page's thread), message handling,
// the game frame's JS, scene.render and the rest, for two scenarios: bots spread over the
// map as they play, and every player teleported into one 40 m square mid-fight.
// Per tick it also reports bot thinking, player movement (physics) and the rest (simProfile).
// Usage: pnpm build && node tools/perf/perf96.mjs [map ...]
//   PERF_GRAPHICS=medium,low (each is measured), PERF_SIM=worker|main (where the offline
//   match runs; default: the game's own choice), PERF_SECONDS=8 per scenario, PERF_PORT=4296,
//   PERF_GPU=1 (the machine's GPU instead of SwiftShader), PERF_JSON=file (raw results),
//   PERF_DIST=dir (serve that build instead of packages/client/dist), PERF_MAX_DRAWS=n (exit 1 when a
//   clumped frame averages more draw calls than n: a budget check for render changes),
//   PERF_STALL_S=300 (a page that doesn't answer for this long ends that map's run, reported as stalled),
//   PERF_MAX_CASTERS=n (exit 1 when a clumped frame averages more shadow casters than n), PERF_MAX_FX_MS=n
//   (exit 1 when starting an effect takes longer: an explosion, a hit, a muzzle flash of each kind, each
//   built while the match loads rather than mid-fight). Effects in the shadow pass always fail a budget run.
//   PERF_BOTS=96 (players in the match), PERF_SCENARIOS=spread,clump (add `mass`: a mass casualty, one blast
//   killing PERF_MASS_KILLS=20 bots 12 m in front of the camera; its frames are timed for 4 s after),
//   PERF_MAX_MASS_MS=n (exit 1 when the worst frame's game JS after the blast takes longer: the deaths' own cost,
//   which CPU rendering doesn't inflate),
//   PERF_MAX_MASS_DRAWS=n (exit 1 when frames after the blast average more draws), PERF_MAX_MASS_BODIES=n
//   (exit 1 when more ragdoll bodies are awake at once than n).
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
const BOTS = Number(process.env.PERF_BOTS ?? 96);
const SCENARIOS = (process.env.PERF_SCENARIOS ?? 'spread,clump').split(',');
const MASS_KILLS = Number(process.env.PERF_MASS_KILLS ?? 20);
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
/**
 * Runs inside the match: a mass casualty. Puts n living bots (either side) within 3 m of a point
 * 12 m in front of the player, then sets off one blast there that kills them (their armour and health don't matter).
 */
const MASS = `(m, me, n) => {
  const d = { x: Math.sin(me.yaw), z: Math.cos(me.yaw) };
  const want = { x: me.move.pos.x + d.x * 12, y: me.move.pos.y, z: me.move.pos.z + d.z * 12 };
  const at = m.nav.closestPoint(want, { x: 6, y: 10, z: 6 }) ?? want;
  const victims = m.combatants().filter((c) => c.alive && c !== me && !c.mount).slice(0, n);
  let i = 0;
  for (const c of victims) {
    const a = (i++ / victims.length) * Math.PI * 2;
    const p = m.nav.closestPoint({ x: at.x + Math.cos(a) * 2.5, y: at.y, z: at.z + Math.sin(a) * 2.5 }, { x: 3, y: 6, z: 3 }) ?? at;
    c.move = { ...c.move, pos: { x: p.x, y: p.y + 0.05, z: p.z }, velY: 0, grounded: true };
    c.armor = 0;
    c.health = 1;
  }
  const centre = { x: at.x, y: at.y + 0.5, z: at.z };
  m.pendingEvents.push({ e: 'explode', s: -1, p: [centre.x, centre.y, centre.z], r: 6 });
  m.splash(centre, 6, 500, 400, null, 'core.rockets', 1, 12);
  // Anyone the blast didn't reach (a wall in the way) dies with it all the same.
  for (const c of victims) if (c.alive) m.kill(c, null, 'core.rockets');
  return victims.filter((c) => !c.alive).length;
}`;
/** Runs inside the match: per-tick sections since the last call (simProfile), and ticks run. */
const PROFILE = `(m, me, on, mod) => {
  const p = mod.simProfile;
  const w = globalThis.__simWake;
  const t = w ? [...w.tickMs].sort((a, b) => a - b) : [];
  const q = (p) => (t.length ? +t[Math.min(t.length - 1, Math.floor(p * t.length))].toFixed(2) : 0);
  const wake = w ? { tickP50: q(0.5), tickP95: q(0.95), wakes: w.wakes, ticks: w.ticks, maxBatch: w.maxBatch, dropped: w.dropped, msPerWake: w.wakes ? +(w.ms / w.wakes).toFixed(2) : 0, maxWakeMs: +w.maxWakeMs.toFixed(1) } : null;
  const out = { ticks: m.tick - (globalThis.__perfTick0 ?? m.tick), ms: Object.fromEntries(p.ms), n: Object.fromEntries(p.n), wake };
  p.reset();
  p.on = on;
  globalThis.__perfTick0 = m.tick;
  w?.reset();
  return out;
}`;

/**
 * The mass casualty: frames are recorded from just before the blast for 4 s: their times, the JS part, draw calls,
 * and (when the view reports them) the ragdolls by tier and the most ragdoll bodies awake at once.
 */
async function measureMass(page, sim) {
  await page.evaluate(() => {
    const sc = window.__cs.view.scene;
    const engine = sc.getEngine();
    const counter = engine._drawCalls;
    const add = counter?.addCount;
    const s = (window.__mass = { draws: [], bodies: 0, tiers: null, frameDraws: 0 });
    if (counter && add) counter.addCount = (n, f) => ((s.frameDraws += n), add.call(counter, n, f));
    s.undo = () => {
      if (counter && add) counter.addCount = add;
      sc.onBeforeRenderObservable.remove(s.before);
      sc.onAfterRenderObservable.remove(s.after);
    };
    s.before = sc.onBeforeRenderObservable.add(() => (s.frameDraws = 0));
    s.after = sc.onAfterRenderObservable.add(() => {
      s.draws.push(s.frameDraws);
      const st = window.__cs.view.ragdollStats?.();
      if (st) {
        s.bodies = Math.max(s.bodies, st.awakeBodies);
        s.tiers = st;
      }
    });
    window.__perf.reset();
    window.__perf.on = true;
  });
  const killed = await sim(MASS, MASS_KILLS);
  await sleep(4000);
  // A CPU-rendered page under load can draw only a frame or two in 4 s: wait for at least 12 (up to 60 s more).
  for (let waited = 0; waited < 60000 && (await page.evaluate(() => window.__perf.frames.length)) < 12; waited += 1000) await sleep(1000);
  const out = await page.evaluate(() => {
    window.__perf.on = false;
    const s = window.__mass;
    s.undo();
    const frames = window.__perf.frames;
    const avg = (a) => Math.round(a.reduce((x, v) => x + v, 0) / Math.max(1, a.length));
    return { frames, draws: avg(s.draws), bodies: s.bodies, tiers: s.tiers };
  });
  const sorted = out.frames.map((f) => f.dt).sort((a, b) => a - b);
  const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    killed,
    frames: out.frames.length,
    p50: pct(0.5),
    p95: pct(0.95),
    max: sorted[sorted.length - 1] ?? 0,
    jsMax: Math.max(0, ...out.frames.map((f) => f.js)),
    jsP95: (() => {
      const js = out.frames.map((f) => f.js).sort((a, b) => a - b);
      return js[Math.min(js.length - 1, Math.floor(0.95 * js.length))] ?? 0;
    })(),
    draws: out.draws,
    ragdolls: out.tiers ? { ...out.tiers, mostAwakeBodies: out.bodies } : 'not reported',
  };
}

/** A page that didn't answer for PERF_STALL_S seconds. */
class Stalled extends Error {}
const STALL_S = Number(process.env.PERF_STALL_S ?? 300);
/** Probes the page every few seconds; `stalled` rejects when one goes unanswered for STALL_S. */
function watch(page) {
  let on = true;
  const stalled = (async () => {
    while (on) {
      const t = Date.now();
      const ok = await Promise.race([page.evaluate(() => 1).then(() => true, () => true), sleep(STALL_S * 1000).then(() => false)]);
      if (!ok && on) throw new Stalled(`the page did not answer for ${STALL_S} s (${((Date.now() - t) / 1000).toFixed(0)} s), a stalled CPU-rendered page; see PERF_96.md "Warm-up hang"`);
      await sleep(3000);
    }
  })();
  stalled.catch(() => undefined);
  return { stalled, stop: () => (on = false) };
}

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
    await page.goto(`${CLIENT}/?offline=${id}&gamemode=core.tdm&bots=${BOTS}`);
    const ok = await page.waitForFunction(() => window.__cs?.local?.inventory?.size > 0 && window.__cs.phase() === 'playing' && window.__sim, null, { timeout: 600000 }).then(() => true, () => false);
    if (!ok) {
      console.log(`${id}/${graphics}: match did not start ${errors.join('; ')}`);
      await ctx.close();
      continue;
    }
    // A watchdog for the page: a CPU-rendered page can stall for minutes (PERF_96.md, "Warm-up hang"), and its
    // calls would wait for ever. One that doesn't answer for PERF_STALL_S seconds ends this map's run.
    const watchdog = watch(page);
    try {
      await Promise.race([
        (async () => {
          const sim = (src, arg) => page.evaluate(([s, a]) => window.__sim.eval(s, a), [src, arg]);
          const players = await sim(GOD);
          const mode = await page.evaluate(() => window.__sim.mode ?? 'main');
          // Let streaming props, textures and shaders settle, and the bots spread out.
          await sleep(5000);
          const row = { map: id, graphics, players, sim: mode, load: loadavg()[0] };
          for (const scenario of SCENARIOS) {
            if (scenario === 'mass') {
              row.mass = await measureMass(page, sim);
              const r = row.mass;
              console.log(`${id} ${graphics} ${mode} mass casualty: ${r.killed} killed by one blast; frames after it: ${r.frames}, p50 ${r.p50.toFixed(1)} ms, p95 ${r.p95.toFixed(1)}, worst ${r.max.toFixed(0)} ms; game JS worst ${r.jsMax.toFixed(1)} ms, p95 ${r.jsP95.toFixed(1)} ms, draws ${r.draws} avg; ragdolls ${JSON.stringify(r.ragdolls)}`);
              continue;
            }
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
            // What rendering draws now (2 s of frames): draw calls, active meshes, triangles, skinned characters, particles.
            const scene = await page.evaluate(async () => {
              const sc = window.__cs.view.scene;
              const engine = sc.getEngine();
              const counter = engine._drawCalls;
              const add = counter?.addCount;
              let frameDraws = 0;
              const s = { draws: [], meshes: [], tris: [], skinned: [], casters: [] };
              if (counter && add) counter.addCount = (n, f) => ((frameDraws += n), add.call(counter, n, f));
              const before = sc.onBeforeRenderObservable.add(() => (frameDraws = 0));
              const after = sc.onAfterRenderObservable.add(() => {
                const active = sc.getActiveMeshes();
                let skinned = 0;
                for (let i = 0; i < active.length; i++) if (active.data[i].skeleton) skinned++;
                s.draws.push(frameDraws);
                s.meshes.push(active.length);
                s.tris.push(sc.getActiveIndices() / 3);
                s.skinned.push(skinned);
                s.casters.push(window.__cs.view.atmosphere?.casterCount ?? 0);
              });
              await new Promise((r) => setTimeout(r, 2000));
              // A CPU-rendered page (CI) can draw fewer than one frame in 2 s: wait for one, up to 30 s more.
              for (let waited = 0; s.draws.length === 0 && waited < 30000; waited += 250) await new Promise((r) => setTimeout(r, 250));
              sc.onBeforeRenderObservable.remove(before);
              sc.onAfterRenderObservable.remove(after);
              if (counter && add) counter.addCount = add;
              const avg = (a) => Math.round(a.reduce((x, v) => x + v, 0) / Math.max(1, a.length));
              // Characters drawn (in view) now, for draws per character.
              const shown = [...window.__cs.view.avatars.values()].filter((a) => a.anim && !a.culled).length;
              // Effects (flashes, hits, explosions) never belong in the shadow pass: a second draw each, for a wrong shadow.
              const effectCasters = sc.lights.flatMap((l) => l.getShadowGenerator?.()?.getShadowMap()?.renderList ?? []).filter((m) => m.metadata?.effect).length;
              return { frames: s.draws.length, draws: avg(s.draws), meshes: avg(s.meshes), tris: avg(s.tris), skinned: avg(s.skinned), casters: avg(s.casters), effectCasters, shown, skeletons: sc.skeletons.length, particles: sc.particleSystems.length, lights: sc.lights.length };
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
              scene,
            };
            const r = row[scenario];
            console.log(
              `${id} ${graphics} ${mode} ${scenario}: ${r.fps.toFixed(1)} fps, frame ${r.dt.toFixed(1)} ms (p50 ${r.p50.toFixed(1)}, p95 ${r.p95.toFixed(1)}, max ${r.max.toFixed(0)}) = sim ${r.sim.toFixed(1)} (${r.ticksPerFrame.toFixed(2)} ticks, max ${r.maxBatch}; ${r.simShare.toFixed(0)} ms/s) + msg ${r.msg.toFixed(1)} (${r.msgShare.toFixed(0)} ms/s) + js ${r.js.toFixed(1)} + render ${r.render.toFixed(1)} + other ${r.other.toFixed(1)} | ${r.tickRate.toFixed(1)} ticks/s, tick ${r.tick.total.toFixed(2)} ms = bots ${r.tick.bots.toFixed(2)} + physics ${r.tick.physics.toFixed(2)} + rest ${r.tick.rest.toFixed(2)}${prof.wake ? ` | worker wakes: ${JSON.stringify(prof.wake)}` : ''}${scenario === 'clump' ? ` | ${row.placed} placed` : ''} | scene ${JSON.stringify(scene)}`,
            );
          }
          // What starting each effect costs now, mid-fight: an explosion, both hits, a muzzle flash of every kind
          // (on a fresh rig, as a player's first shot builds one). Each was built while the match loaded.
          row.fx = await page.evaluate(async () => {
            const v = window.__cs.view;
            const ray = v.scene.activeCamera.getForwardRay(6);
            const at = ray.origin.add(ray.direction.scale(6));
            const p = { x: at.x, y: at.y, z: at.z };
            const times = {};
            const time = (k, f) => {
              const t0 = performance.now();
              f();
              times[k] = Math.round((performance.now() - t0) * 10) / 10;
            };
            time('explosion', () => v.explosion(p, 4));
            time('hit heavy', () => v.hitFx(p, 'heavy'));
            time('hit melee', () => v.hitFx(p, 'melee'));
            const pack = await fetch(new URL('vfx/muzzle_flash.json', document.baseURI)).then((r) => r.json(), () => null);
            // Three fresh rigs per flash, the median kept: the page shares 4 cores with 96 bots and a CPU renderer,
            // so one sample can be a lost time slice rather than the code.
            const Rig = v.flashRig.constructor;
            for (const id of Object.keys(pack?.effects ?? {})) {
              const ms = [0, 1, 2].map((i) => {
                const rig = new Rig(v.scene, `perfRig_${id}_${i}`);
                const t0 = performance.now();
                rig.fire(id, 0.2);
                const took = performance.now() - t0;
                rig.dispose();
                return took;
              });
              times[`flash ${id}`] = Math.round(ms.sort((x, y) => x - y)[1] * 10) / 10;
            }
            return times;
          });
          const slowest = Object.entries(row.fx).sort((a, b) => b[1] - a[1])[0];
          console.log(`  effects: slowest start ${slowest ? `${slowest[0]} ${slowest[1]} ms` : '-'} (${JSON.stringify(row.fx)})`);
          if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join('; ')}`);
          results.push(row);
        })(),
        watchdog.stalled,
      ]);
    } catch (e) {
      if (!(e instanceof Stalled)) throw e;
      console.log(`${id}/${graphics}: ${e.message}`);
      results.push({ map: id, graphics, stalled: e.message });
    } finally {
      watchdog.stop();
    }
    await Promise.race([ctx.close(), sleep(10000)]);
  }
}
if (process.env.PERF_JSON) writeFileSync(process.env.PERF_JSON, JSON.stringify(results, null, 2));
await Promise.race([browser.close(), sleep(10000)]);
stop();
const budget = Number(process.env.PERF_MAX_DRAWS ?? 0);
const over = budget ? results.filter((r) => (r.clump?.scene.draws ?? 0) > budget) : [];
for (const r of over) console.log(`OVER BUDGET: ${r.map} ${r.graphics} clumped draws ${r.clump.scene.draws} > ${budget}`);
// A budget check needs something measured: a map that never started, or no frame drawn in the window, fails it.
const unmeasured = budget ? maps.flatMap((id) => GRAPHICS.filter((g) => !results.some((r) => r.map === id && r.graphics === g && (r.stalled || r.clump?.scene.frames > 0))).map((g) => `${id}/${g}`)) : [];
for (const u of unmeasured) console.log(`NOT MEASURED: ${u} (the match didn't start or no clumped frame was drawn)`);
const stalled = results.filter((r) => r.stalled);
// Shadow casters (clumped frames), effects in the shadow pass, and what starting an effect costs.
const casterBudget = Number(process.env.PERF_MAX_CASTERS ?? 0);
const fxBudget = Number(process.env.PERF_MAX_FX_MS ?? 0);
const checking = budget || casterBudget || fxBudget;
const fails = [];
for (const r of results.filter((x) => !x.stalled)) {
  if (casterBudget && (r.clump?.scene.casters ?? 0) > casterBudget) fails.push(`${r.map} ${r.graphics}: clumped frames average ${r.clump.scene.casters} shadow casters > ${casterBudget} (${r.clump.scene.shown} characters in view)`);
  for (const sc of ['spread', 'clump']) if (checking && r[sc]?.scene.effectCasters) fails.push(`${r.map} ${r.graphics} ${sc}: ${r[sc].scene.effectCasters} effect meshes in the shadow pass`);
  for (const [k, ms] of Object.entries(r.fx ?? {})) if (fxBudget && ms > fxBudget) fails.push(`${r.map} ${r.graphics}: starting ${k} took ${ms} ms > ${fxBudget}`);
}
// Mass casualty: the worst frame after the blast, its draws, and ragdoll bodies awake at once.
const massMs = Number(process.env.PERF_MAX_MASS_MS ?? 0);
const massDraws = Number(process.env.PERF_MAX_MASS_DRAWS ?? 0);
const massBodies = Number(process.env.PERF_MAX_MASS_BODIES ?? 0);
for (const r of results.filter((x) => !x.stalled)) {
  if (!SCENARIOS.includes('mass')) break;
  if (!r.mass || r.mass.frames === 0) {
    if (massMs || massDraws || massBodies) fails.push(`${r.map} ${r.graphics}: mass casualty not measured`);
    continue;
  }
  if (r.mass.killed < MASS_KILLS / 2 && (massMs || massDraws || massBodies)) fails.push(`${r.map} ${r.graphics}: the mass-casualty blast killed only ${r.mass.killed}`);
  if (massMs && r.mass.jsMax > massMs) fails.push(`${r.map} ${r.graphics}: worst frame's game JS after the mass-casualty blast ${r.mass.jsMax.toFixed(1)} ms > ${massMs}`);
  if (massDraws && r.mass.draws > massDraws) fails.push(`${r.map} ${r.graphics}: frames after the mass-casualty blast average ${r.mass.draws} draws > ${massDraws}`);
  if (massBodies && typeof r.mass.ragdolls === 'object' && r.mass.ragdolls.mostAwakeBodies > massBodies) fails.push(`${r.map} ${r.graphics}: ${r.mass.ragdolls.mostAwakeBodies} ragdoll bodies awake at once > ${massBodies}`);
}
if ((massMs || massDraws || massBodies) && SCENARIOS.includes('mass')) console.log(`mass casualty: ${results.filter((r) => r.mass).map((r) => `${r.map} ${r.graphics} ${r.mass.killed} killed, worst game JS ${r.mass.jsMax.toFixed(1)} ms, ${r.mass.draws} draws`).join('; ')}`);
for (const f of fails) console.log(`OVER BUDGET: ${f}`);
if (checking && !fails.length && results.some((r) => r.clump)) console.log(`shadow and effects budget: ${results.filter((r) => r.clump).map((r) => `${r.map} ${r.graphics} ${r.clump.scene.casters} casters, slowest effect ${Math.max(0, ...Object.values(r.fx ?? {}))} ms`).join('; ')}`);
if (budget && !over.length && !unmeasured.length && !stalled.length) console.log(`draw budget: every clumped frame within ${budget} draws (${results.map((r) => `${r.map} ${r.graphics} ${r.clump.scene.draws}`).join(', ')})`);
// On GitHub, each failure is also an annotation, readable through the API without the log.
if (process.env.GITHUB_ACTIONS) {
  for (const r of over) console.log(`::error title=perf over budget::${r.map} ${r.graphics} clumped draws ${r.clump.scene.draws} > ${budget}`);
  for (const u of unmeasured) console.log(`::error title=perf not measured::${u}`);
  for (const r of stalled) console.log(`::error title=perf stalled::${r.map} ${r.graphics}: ${String(r.stalled).slice(0, 300)}`);
  for (const f of fails) console.log(`::error title=perf over budget::${f}`);
}
process.exit(over.length || stalled.length || unmeasured.length || fails.length ? 1 : 0);
