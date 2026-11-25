// Tile View's cost on big maps (MapMaker UI Phase 5, "large-map performance"): what the page spends in script while
// Tile View is open on a dense room, the pointer moves over it, a thing is dragged, the plan zooms, and a step of
// edits. Software rendering is slow here, so frame rate says nothing: each step reports Tile View's own time (its
// draw and per-frame check, timed by wrapping them) and the page's script time.
//
//   node tools/perf/editor-tileview.mjs [map names as the Open dialog lists them…]      (after `pnpm build`)
//   TV_URL=<url>   a client already being served;  CHROMIUM=<path>  another Chromium than Playwright's own
//   TV_JSON=<file> the numbers as JSON
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = process.env.TV_PORT ?? '4192';
const CLIENT = process.env.TV_URL ?? `http://127.0.0.1:${PORT}`;
const MAPS = process.argv.slice(2).length ? process.argv.slice(2) : ["St. Jasper's Military Academy", 'Flavius Rule'];

const server = process.env.TV_URL ? { pid: 0 } : spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
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

function instrument() {
  const tv = window.__editor.tileView;
  const t = (window.__tv = { draw: { ms: 0, calls: 0, max: 0 }, frame: { ms: 0, calls: 0, max: 0 } });
  for (const name of ['draw', 'frame']) {
    const fn = tv[name];
    tv[name] = function (...args) {
      const t0 = performance.now();
      try {
        return fn.apply(this, args);
      } finally {
        const dt = performance.now() - t0;
        t[name].ms += dt;
        t[name].calls++;
        t[name].max = Math.max(t[name].max, dt);
      }
    };
  }
}

async function measure(page, cdp, name, act) {
  await sleep(1500);
  await page.evaluate(() => {
    for (const k of ['draw', 'frame']) Object.assign(window.__tv[k], { ms: 0, calls: 0, max: 0 });
  });
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const before = await metric();
  await act();
  await sleep(500);
  const after = await metric();
  const t = await page.evaluate(() => window.__tv);
  const row = {
    step: name,
    scriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1000),
    draws: t.draw.calls,
    drawMs: Math.round(t.draw.ms * 10) / 10,
    drawMaxMs: Math.round(t.draw.max * 10) / 10,
    frameCalls: t.frame.calls,
    frameMs: Math.round((t.frame.ms - t.draw.ms) * 10) / 10,
  };
  console.log(`  ${name}: ${row.draws} draws, ${row.drawMs} ms (longest ${row.drawMaxMs} ms) · per-frame checks ${row.frameMs} ms over ${row.frameCalls} · page script ${row.scriptMs} ms`);
  return row;
}

async function run(browser, mapName) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('tiletrigger.editor.dock', JSON.stringify({ left: 'open', right: 'expanded', tab: 'minimap' })));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
  await page.goto(`${CLIENT}/?mode=editor&test=1`);
  await page.waitForFunction(() => window.__editor, null, { timeout: 120000 });
  await page.evaluate(() => window.__editor.setOwner?.(true));
  await page.click('#ed-open');
  const rowSel = `#ed-library li:has-text(${JSON.stringify(mapName)})`;
  await page.waitForSelector(rowSel, { timeout: 30000 });
  const before = await page.evaluate(() => window.__editor.doc.metadata.id);
  await page.locator(rowSel).first().locator('button').first().click();
  await page.waitForFunction((b) => window.__editor.doc.metadata.id !== b, before, { timeout: 180000 });
  // An area of 3 × 3 cells round the densest cell on the ground level (the most things of the map's own).
  const picked = await page.evaluate(() => {
    const ed = window.__editor;
    const cell = ed.doc.classicStructure.cellSize;
    const lh = ed.doc.classicStructure.levelHeight;
    const counts = new Map();
    for (const e of ed.doc.entities) {
      if (e.position[1] > lh * 0.8) continue;
      const k = `${Math.round(e.position[0] / cell)},${Math.round(e.position[2] / cell)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best) return null;
    const [x, y] = best[0].split(',').map(Number);
    if (ed.level !== 0) ed.setLevel(0, true);
    const ref = { kind: 'region', cells: { x0: x - 1, y0: y - 1, x1: x + 1, y1: y + 1 } };
    ed.openTileView(ref);
    return ref;
  });
  if (!picked) throw new Error(`${mapName}: nothing to open`);
  await page.waitForFunction(() => window.__editor.tileView.state().visible && window.__editor.tileView.state().w > 8, null, { timeout: 30000 });
  const s = await page.evaluate(() => {
    const st = window.__editor.tileView.state();
    return { name: window.__editor.doc.metadata.name, focus: st.focus?.name, children: st.children, parts: st.parts, edges: st.edges, boxes: window.__editor.mapBoxes().length };
  });
  console.log(`\n${s.name}: Tile View on ${s.focus} (${picked.kind}): ${s.children} things, ${s.parts} parts, ${s.edges} sides; ${s.boxes} level boxes in the map`);
  await page.evaluate(instrument);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const box = await page.locator('#ed-tv-canvas').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rows = [];
  rows.push(await measure(page, cdp, 'idle 2 s', () => sleep(2000)));
  rows.push(
    await measure(page, cdp, 'pointer over the plan (60 moves)', async () => {
      for (let i = 0; i < 60; i++) {
        await page.mouse.move(cx - 100 + i * 3, cy - 40 + (i % 10) * 8);
        await sleep(16);
      }
    })
  );
  rows.push(
    await measure(page, cdp, 'wheel zoom (10 steps)', async () => {
      await page.mouse.move(cx, cy);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, i < 5 ? -120 : 120);
        await sleep(30);
      }
    })
  );
  // A thing of the map's own in the focus, picked and dragged (8 steps), then undone.
  const thing = await page.evaluate(() => {
    const ed = window.__editor;
    const st = ed.tileView.state();
    const f = st.focus;
    const r = f.rect;
    const grouped = new Set((ed.doc.groups ?? []).flatMap((g) => g.members ?? []));
    const own = ed.doc.entities.find((e) => e.kind === 'prop' && !grouped.has(e.id) && e.position[1] < 1 && e.position[0] > r.x0 + 1 && e.position[0] < r.x1 - 1 && e.position[2] > r.z0 + 1 && e.position[2] < r.z1 - 1);
    if (!own) return null;
    return { id: own.id, at: ed.tileView.clientPoint(own.position[0], own.position[2]) };
  });
  if (thing?.at) {
    const rev = await page.evaluate(() => window.__editor.history.revision);
    rows.push(
      await measure(page, cdp, 'drag a thing (12 steps)', async () => {
        await page.mouse.move(thing.at.x, thing.at.y);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(thing.at.x + i * 3, thing.at.y + i);
          await sleep(16);
        }
        await page.mouse.up();
        await page.waitForFunction((r) => window.__editor.history.revision !== r, rev, { timeout: 30000 }).catch(() => console.log('  the drag moved nothing'));
      })
    );
    rows.push(await measure(page, cdp, 'undo', () => page.keyboard.press('Control+z')));
  } else console.log('  no prop of its own in the focus: no drag');
  await context.close();
  return { map: s, rows };
}

if (!process.env.TV_URL) await waitForHttp(CLIENT);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
const out = [];
try {
  for (const m of MAPS) out.push(await run(browser, m));
} finally {
  await browser.close();
  stop();
}
if (process.env.TV_JSON) writeFileSync(process.env.TV_JSON, JSON.stringify(out, null, 2));
