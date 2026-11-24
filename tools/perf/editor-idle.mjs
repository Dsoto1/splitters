// MapMaker at rest: how busy the page is while nobody touches it, and whether what it shows after the common actions
// is what a fresh frame would show (docs/PERF_EDITOR_IDLE_2026-11-24.md).
//
//   node tools/perf/editor-idle.mjs [map name as the Open dialog lists it]      (after `pnpm build`)
//   IDLE_URL=<url>      a client already being served (the dev server works)
//   IDLE_QUERY=<query>  more of the page's query (`&perfoff=editoridle`: every frame drawn, as before)
//   IDLE_SECONDS=10     how long each rest is measured
//   IDLE_VIEW=1280x720  the window (a small one keeps a software GPU from limiting the frame rate)
//   IDLE_SHOTS=<dir>    pictures after each action (deviceScaleFactor 2), each with the same view drawn afresh
//   IDLE_JSON=<file>    the numbers as JSON
//   CHROMIUM=<path>     another Chromium than Playwright's own
//
// Busy is Chrome's own TaskDuration over the wall clock (the main thread's share); frames drawn are the scene's renders,
// counted on Babylon's onAfterRenderObservable, beside the display's refreshes (requestAnimationFrame).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const PORT = process.env.IDLE_PORT ?? '4193';
const CLIENT = process.env.IDLE_URL ?? `http://localhost:${PORT}`;
const MAP = process.argv[2] ?? 'Iron Maw';
const QUERY = process.env.IDLE_QUERY ?? '';
const SECONDS = Number(process.env.IDLE_SECONDS ?? 10);
const SHOTS = process.env.IDLE_SHOTS;
/** The window's size: a small one keeps a software GPU from being what limits the frame rate (CSS pixels). */
const [VIEW_W, VIEW_H] = (process.env.IDLE_VIEW ?? '1280x720').split('x').map(Number);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = process.env.IDLE_URL ? { pid: 0 } : spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
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

/** The page's main-thread share, frames drawn and display refreshes over `seconds` of rest. */
async function rest(page, cdp, seconds) {
  await page.evaluate(() => {
    const s = window.__editor.view.scene;
    const t = (window.__idle = { renders: 0, rafs: 0, on: true, ms: 0, frozenMs: 0, frozenRenders: 0, render: s.render });
    window.__idleObs = s.onAfterRenderObservable.add(() => t.renders++);
    // The main thread's time in each frame drawn (the scene's own work and its WebGL calls), frozen or not.
    s.render = function (...a) {
      const t0 = performance.now();
      try {
        return t.render.apply(this, a);
      } finally {
        const dt = performance.now() - t0;
        t.ms += dt;
        if (s._activeMeshesFrozen) {
          t.frozenMs += dt;
          t.frozenRenders++;
        }
      }
    };
    const tick = () => {
      if (!t.on) return;
      t.rafs++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const t0 = Date.now();
  await sleep(seconds * 1000);
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const wall = (Date.now() - t0) / 1000;
  const counts = await page.evaluate(() => {
    const t = window.__idle;
    t.on = false;
    const s = window.__editor.view.scene;
    s.onAfterRenderObservable.remove(window.__idleObs);
    s.render = t.render;
    return { renders: t.renders, rafs: t.rafs, ms: t.ms, frozenMs: t.frozenMs, frozenRenders: t.frozenRenders, frozen: s._activeMeshesFrozen === true };
  });
  return {
    busyPct: Math.round(((m1.TaskDuration - m0.TaskDuration) / wall) * 1000) / 10,
    scriptPct: Math.round(((m1.ScriptDuration - m0.ScriptDuration) / wall) * 1000) / 10,
    rendersPerS: Math.round((counts.renders / wall) * 10) / 10,
    rafsPerS: Math.round((counts.rafs / wall) * 10) / 10,
    renderMsPerS: Math.round(counts.ms / wall),
    msPerFrame: Math.round((counts.ms / Math.max(1, counts.renders)) * 10) / 10,
    msPerFrozenFrame: counts.frozenRenders ? Math.round((counts.frozenMs / counts.frozenRenders) * 10) / 10 : null,
    frozen: counts.frozen,
  };
}

/** Share of pixels that differ by more than a little in any channel. */
function diffShare(a, b) {
  const pa = PNG.sync.read(readFileSync(a));
  const pb = PNG.sync.read(readFileSync(b));
  if (pa.width !== pb.width || pa.height !== pb.height) return 1;
  let n = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    if (Math.abs(pa.data[i] - pb.data[i]) > 24 || Math.abs(pa.data[i + 1] - pb.data[i + 1]) > 24 || Math.abs(pa.data[i + 2] - pb.data[i + 2]) > 24) n++;
  }
  return Math.round((n / (pa.width * pa.height)) * 10000) / 100;
}

async function main() {
  await waitForHttp(CLIENT);
  const browser = await chromium.launch({ args: ['--use-gl=angle', `--use-angle=${process.env.IDLE_ANGLE ?? 'swiftshader'}`, '--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(`${CLIENT}/?mode=editor&test=1&name=Tester${QUERY}`);
  await page.waitForFunction(() => window.__editor && !document.getElementById('editor').hidden, null, { timeout: 120000 });
  await page.click('#ed-open');
  const rowSel = `#ed-library li:has-text(${JSON.stringify(MAP)})`;
  await page.waitForSelector(rowSel, { timeout: 30000 });
  const before = await page.evaluate(() => window.__editor.doc.metadata.id);
  await page.locator(rowSel).first().locator('button').first().click();
  await page.waitForFunction((b) => window.__editor.doc.metadata.id !== b, before, { timeout: 180000 });
  console.log(`opened ${await page.evaluate(() => `${window.__editor.doc.metadata.name}: ${window.__editor.doc.entities.length} things`)}${QUERY ? ` (${QUERY})` : ''}`);
  // Models and textures keep arriving for a while after a map opens: rest is measured once the scene stops growing.
  for (let same = 0, last = '', i = 0; same < 5 && i < 120; i++) {
    await sleep(1000);
    const now = await page.evaluate(() => {
      const s = window.__editor.view.scene;
      return `${s.meshes.length}/${s.materials.length}/${s.textures.length}/${s.getWaitingItemsCount()}`;
    });
    same = now === last ? same + 1 : 0;
    last = now;
  }
  const out = { map: MAP, query: QUERY, rests: [], shots: [] };
  const measure = async (label) => {
    const r = await rest(page, cdp, SECONDS);
    out.rests.push({ label, ...r });
    console.log(`${label.padEnd(24)} busy ${r.busyPct}% (script ${r.scriptPct}%) · ${r.rendersPerS} frames drawn/s · ${r.rafsPerS} refreshes/s · drawing ${r.renderMsPerS} ms/s, ${r.msPerFrame} ms a frame (${r.msPerFrozenFrame ?? '-'} frozen) · active meshes frozen now: ${r.frozen}`);
  };
  await measure('rest, map open');

  const canvas = await page.evaluate(() => {
    const r = window.__editor.host.canvas.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  // After each action: rest a moment, take the picture as shown, then draw the same view afresh and take it again.
  const shot = async (name) => {
    await page.mouse.move(canvas.x + 1, canvas.y + 1).catch(() => {});
    await sleep(1500);
    if (!SHOTS) return;
    const shown = `${SHOTS}/${name}.png`;
    const fresh = `${SHOTS}/${name}-fresh.png`;
    await page.screenshot({ path: shown, timeout: 180000 });
    await page.evaluate(() => {
      const s = window.__editor.view.scene;
      s.unfreezeActiveMeshes();
      window.__editor.view.render();
    });
    await page.screenshot({ path: fresh, timeout: 180000 });
    const d = diffShare(shown, fresh);
    out.shots.push({ name, staleShare: d });
    console.log(`  ${name.padEnd(14)} shown vs drawn afresh: ${d}% of pixels differ`);
  };
  await shot('open');
  // Move the camera: fly forward and turn with the right button.
  await page.mouse.move(canvas.x, canvas.y);
  await page.keyboard.down('KeyW');
  await sleep(600);
  await page.keyboard.up('KeyW');
  await shot('camera');
  // Select what is under the middle of the view.
  await page.keyboard.press('KeyV');
  await page.mouse.click(canvas.x, canvas.y);
  await shot('select');
  // Drag it (the selection's handle, or the thing itself).
  await page.mouse.move(canvas.x, canvas.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(canvas.x + i * 12, canvas.y + i * 4);
  await page.mouse.up();
  await shot('drag');
  await page.keyboard.press('Escape');
  // Place a Pistol pickup (hover shows its ghost first).
  await page.evaluate(() => {
    const el = document.querySelector('[data-tool="pickup:core.weapon_pistol"]');
    const pane = el?.closest('.ed-pane');
    if (pane) document.querySelector(`#ed-pal-tabs [data-pane="${pane.dataset.pane}"]`)?.click();
    const group = el?.closest('.ed-group');
    if (group && !group.classList.contains('open')) group.querySelector('.ed-group-head')?.click();
  });
  await page.click('[data-tool="pickup:core.weapon_pistol"]').catch((e) => console.log(`  no pistol card: ${e.message.slice(0, 80)}`));
  await page.mouse.move(canvas.x - 80, canvas.y + 40);
  await page.mouse.move(canvas.x - 60, canvas.y + 40);
  await shot('place-ghost');
  await page.mouse.click(canvas.x - 60, canvas.y + 40);
  await shot('place');
  await page.keyboard.press('Escape');
  // Structure paint: hover (the brush shows), then a click.
  await page.keyboard.press('KeyB');
  await page.mouse.move(canvas.x + 40, canvas.y - 20);
  await shot('paint-hover');
  await page.mouse.click(canvas.x + 40, canvas.y - 20);
  await shot('paint');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyV');
  // Plan view and back.
  await page.keyboard.press('KeyK');
  await shot('plan');
  await page.keyboard.press('KeyK');
  await shot('back-from-plan');
  await measure('rest, after the actions');
  await browser.close();
  if (process.env.IDLE_JSON) writeFileSync(process.env.IDLE_JSON, JSON.stringify(out, null, 1));
}

try {
  await main();
} finally {
  stop();
}
