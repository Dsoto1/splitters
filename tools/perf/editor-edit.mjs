// MapMaker's cost per edit on big maps: what the page spends in script on a click to select, a move and an undo.
//
//   node tools/perf/editor-edit.mjs [map names as the Open dialog lists them…]      (after `pnpm build`)
//   EDIT_PROFILE=<dir>  also writes a CPU profile per step (open in Chrome DevTools, Performance → Load profile)
//   EDIT_JSON=<file>    the numbers as JSON
//   EDIT_URL=<url>     a client already being served (the dev server: readable names in the profile)
//   CHROMIUM=<path>     another Chromium than Playwright's own
//
// Software rendering is slow here, so frame rate says nothing: each step reports the page's script time (Chrome's
// ScriptDuration) with the time spent drawing frames (`view.render`) taken off, the longest single stretch of the
// editor's own work, and where it went (the editor's parts, timed by wrapping them).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = process.env.EDIT_PORT ?? '4191';
const CLIENT = process.env.EDIT_URL ?? `http://localhost:${PORT}`;
const MAPS = process.argv.slice(2).length ? process.argv.slice(2) : ["St. John's", 'Iron Maw'];
const PROFILE = process.env.EDIT_PROFILE;
if (PROFILE) mkdirSync(PROFILE, { recursive: true });

const server = process.env.EDIT_URL ? { pid: 0 } : spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
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

/** Wrap the editor's parts so each call adds to a table of time by name (inclusive), and frames are timed apart. */
function instrument() {
  const ed = window.__editor;
  const t = (window.__edit = { parts: {}, render: 0, longest: 0, depth: 0 });
  const wrap = (obj, name, label, top = false) => {
    const fn = obj?.[name];
    if (typeof fn !== 'function') return;
    obj[name] = function (...args) {
      const t0 = performance.now();
      try {
        return fn.apply(this, args);
      } finally {
        const dt = performance.now() - t0;
        const p = (t.parts[label] ??= { ms: 0, calls: 0 });
        p.ms += dt;
        p.calls++;
        if (top) t.longest = Math.max(t.longest, dt);
      }
    };
  };
  const render = ed.view.render;
  ed.view.render = function () {
    const t0 = performance.now();
    try {
      return render.apply(this);
    } finally {
      t.render += performance.now() - t0;
    }
  };
  wrap(ed, 'refresh', 'refresh (all)', true);
  wrap(ed, 'setSelection', 'setSelection (all)', true);
  wrap(ed, 'updateSelectionVisuals', 'selection visuals');
  wrap(ed.view, 'setMap', 'view.setMap');
  wrap(ed.view, 'setEntities', 'view.setEntities');
  wrap(ed.view, 'setOutlines', 'view.setOutlines');
  // (Private parts of the view, by name: a part that is renamed drops out of the table, nothing else.)
  wrap(ed.view.styler, 'buildBoxes', 'view: level meshes');
  wrap(ed.view.dimStyler, 'buildBoxes', 'view: level meshes');
  wrap(ed.view.styler, 'buildTerrain', 'view: terrain mesh');
  wrap(ed.view.backdrop, 'build', 'view: backdrop');
  wrap(ed.view.border, 'update', 'view: border');
  wrap(ed.view.city, 'setMap', 'view: city');
  wrap(ed.view.foliage, 'grow', 'view: foliage');
  wrap(ed.view.area, 'setMap', 'view: build area');
  wrap(ed.view.scenario?.glass, 'build', 'view: glass');
  wrap(ed.view, 'flushLifts', 'view: flush lifts');
  wrap(ed.view, 'placeEntityNode', 'view: place entity');
  wrap(ed.view, 'entityNode', 'view: make entity');
  wrap(ed.view, 'showWeather', 'view: weather');
  wrap(ed.view, 'setGizmo', 'view.setGizmo');
  wrap(ed.view, 'setPickHighlight', 'view.setPickHighlight');
  wrap(ed.ring, 'redraw', 'ring');
  wrap(ed.view, 'pickEntities', 'view.pickEntities');
  wrap(ed.hover, 'pick', 'hover.pick');
  wrap(ed.hover, 'updateHover', 'hover.updateHover');
  wrap(ed.outliner, 'update', 'outliner.update');
  wrap(ed.outliner, 'draw', 'outliner.draw');
  wrap(ed.checks, 'validate', 'checks.validate');
  wrap(ed.checks, 'renderIssues', 'checks.renderIssues');
  wrap(ed.checks, 'settle', 'checks.settle (on the page)');
  wrap(ed.checks, 'sendCheck', 'checks: to the worker', true);
  wrap(ed.checks, 'checked', 'checks: answer', true);
  wrap(ed.checks, 'checkHere', 'checks: on the page', true);
  wrap(ed.checks, 'scheduleOverlaps', 'checks.overlaps (schedule)');
  wrap(ed.checks, 'checkNavigation', 'checks.navigation (send)', true);
  wrap(ed.inspector, 'renderInspector', 'inspector');
  wrap(ed.topBar, 'updateCounts', 'topBar.counts');
  wrap(ed.topBar, 'updateTopBar', 'topBar.update');
  wrap(ed.topBar, 'syncToolbar', 'topBar.sync');
  wrap(ed.budgetBar, 'update', 'budgetBar');
  wrap(ed.pieces, 'renderMyPieces', 'myPieces');
  wrap(ed.logic, 'render', 'logic');
  wrap(ed.paths, 'refresh', 'paths.refresh');
  wrap(ed.paths, 'renderPane', 'paths.pane');
  wrap(ed.routes, 'refresh', 'routes.refresh');
  wrap(ed.env, 'refresh', 'env.refresh');
  wrap(ed.env, 'updateStatus', 'env.status');
  wrap(ed.terrain, 'syncTerrainUi', 'terrain.ui');
  wrap(ed.saving, 'scheduleAutosave', 'autosave (schedule)');
  wrap(ed.saving, 'flushDraft', 'autosave (write)', true);
  wrap(ed, 'renderLevels', 'levels');
  wrap(ed, 'mapBoxes', 'mapBoxes');
  wrap(ed.history, 'execute', 'history.execute');
  wrap(ed.history, 'undo', 'history.undo');
}

const reset = (page) => page.evaluate(() => Object.assign(window.__edit, { parts: {}, render: 0, longest: 0 }));

async function measure(page, cdp, name, act, first = false) {
  // Quiet first: nothing left over from the step before (the delayed checks, the autosave).
  await sleep(4000);
  await reset(page);
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  if (PROFILE) await cdp.send('Profiler.start');
  const before = await metric();
  await act();
  // The work an edit leaves for later (overlaps, the draft) is part of its cost: wait it out.
  await sleep(4000);
  const after = await metric();
  if (PROFILE) writeFileSync(`${PROFILE}/${name.replace(/[^a-z0-9]+/gi, '-')}.cpuprofile`, JSON.stringify((await cdp.send('Profiler.stop')).profile));
  const t = await page.evaluate(() => window.__edit);
  // Shaders compiled for the step (each one is a hitch on any GPU): the engine's table of compiled effects, before and after.
  const shaders = await page.evaluate(() => {
    const table = window.__editor.view.scene.getEngine()._compiledEffects ?? {};
    const seen = (window.__edit.effects ??= new Set());
    const fresh = Object.keys(table).filter((k) => !seen.has(k));
    for (const k of fresh) seen.add(k);
    return fresh.map((k) => `${table[k]?.name?.vertex ?? table[k]?.name ?? '?'} [${(table[k]?.defines ?? '').split('\n').filter((d) => /INSTANCES|THIN|VERTEXCOLOR|ALPHA|DIFFUSE\b|BUMP|SHADOW0|FOG|NUM_BONE|EMISSIVE\b|CLIPPLANE/.test(d)).map((d) => d.replace('#define ', '')).join(' ')}]`);
  });
  const script = (after.ScriptDuration - before.ScriptDuration) * 1000;
  const parts = Object.entries(t.parts)
    .map(([k, v]) => [k, Math.round(v.ms * 10) / 10, v.calls])
    .filter((p) => p[1] >= 0.5)
    .sort((a, b) => b[1] - a[1]);
  const row = { step: name, scriptMs: Math.round(script - t.render), renderMs: Math.round(t.render), longestMs: Math.round(t.longest), shaders: first ? 0 : shaders.length, parts };
  console.log(`  ${name}: script ${row.scriptMs} ms (frames, apart: ${row.renderMs} ms) · longest stretch ${row.longestMs} ms`);
  if (!first && shaders.length) console.log(`      ${shaders.length} shader${shaders.length > 1 ? 's' : ''} compiled: ${shaders.join(' · ').slice(0, 1500)}`);
  for (const [k, ms, calls] of parts.slice(0, 14)) console.log(`      ${String(ms).padStart(8)} ms  ${k} ×${calls}`);
  return row;
}

async function run(browser, mapName) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
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
  const size = await page.evaluate(() => {
    const d = window.__editor.doc;
    return { name: d.metadata.name, tiles: d.classicStructure.tiles.length, entities: d.entities.length, drawn: window.__editor.viewDoc.entities.length, pieces: (d.setPieces ?? []).length, terrain: d.terrain ? d.terrain.heights.length : 0 };
  });
  console.log(`\n${size.name}: ${size.tiles} tiles, ${size.entities} entities (${size.drawn} as drawn), ${size.pieces} set pieces, ${size.terrain} terrain heights`);
  // A prop of the document's own (not a set piece's part), not grouped, near the middle: look at it from close by.
  const target = await page.evaluate(() => {
    const ed = window.__editor;
    const grouped = new Set((ed.doc.groups ?? []).flatMap((g) => g.members ?? []));
    const props = ed.doc.entities.filter((e) => e.kind === 'prop' && !grouped.has(e.id));
    props.sort((a, b) => Math.hypot(a.position[0], a.position[2]) - Math.hypot(b.position[0], b.position[2]));
    const e = props[0];
    if (!e) return null;
    ed.setTool({ kind: 'select' });
    ed.setShowAll?.(true, true);
    ed.view.focus({ x: e.position[0], y: e.position[1], z: e.position[2] });
    return { id: e.id, at: e.position };
  });
  if (!target) throw new Error(`${mapName}: no prop to click`);
  // The view eases to where it is sent: wait until the prop's point on screen stops moving.
  const project = () => page.evaluate((p) => window.__editor.view.project({ x: p[0], y: p[1] + 0.3, z: p[2] }), target.at);
  let at = await project();
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const now = await project();
    const still = Math.hypot(now.x - at.x, now.y - at.y) < 0.5;
    at = now;
    if (still && i > 2) break;
  }
  await page.evaluate(instrument);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (PROFILE) await cdp.send('Profiler.enable');
  const tag = size.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const rows = [];
  const selected = () => page.evaluate(() => [...window.__editor.selection.entities, ...window.__editor.selection.tiles, ...(window.__editor.selection.setPieces ?? [])]);
  rows.push(await measure(page, cdp, `${tag} idle 4 s`, async () => {}, true));
  rows.push(
    await measure(page, cdp, `${tag} click to select`, async () => {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForFunction(() => window.__editor.selection.entities.length + window.__editor.selection.tiles.length + (window.__editor.selection.setPieces ?? []).length > 0, null, { timeout: 60000 }).catch(() => console.log('  nothing was selected by the click'));
    })
  );
  const picked = await selected();
  if (!picked.includes(target.id)) {
    console.log(`  the click picked ${JSON.stringify(picked)}, not the prop: selecting it directly for the move`);
    await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }, true), target.id);
  }
  rows.push(
    await measure(page, cdp, `${tag} deselect (Esc)`, async () => {
      await page.keyboard.press('Escape');
    })
  );
  await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }, true), target.id);
  const rev = () => page.evaluate(() => window.__editor.history.revision);
  const r0 = await rev();
  rows.push(
    await measure(page, cdp, `${tag} move (drag, 8 steps)`, async () => {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(at.x + i * 6, at.y + i * 2);
      await page.mouse.up();
      await page.waitForFunction((r) => window.__editor.history.revision !== r && window.__editor.renderedRevision === window.__editor.history.revision, r0, { timeout: 60000 }).catch(() => console.log('  the drag did not move anything'));
    })
  );
  const r1 = await rev();
  rows.push(
    await measure(page, cdp, `${tag} undo`, async () => {
      await page.keyboard.press('Control+z');
      await page.waitForFunction((r) => window.__editor.history.revision !== r && window.__editor.renderedRevision === window.__editor.history.revision, r1, { timeout: 60000 }).catch(() => console.log('  undo changed nothing'));
    })
  );
  // The same on a free block (what a big map is built of: its faces are clipped against its neighbours').
  const block = await page.evaluate((near) => {
    const ed = window.__editor;
    const blocks = ed.doc.entities.filter((e) => e.kind === 'block' && !e.pitch && !e.roll);
    blocks.sort((a, b) => Math.hypot(a.position[0] - near[0], a.position[2] - near[2]) - Math.hypot(b.position[0] - near[0], b.position[2] - near[2]));
    return blocks[0] ? { id: blocks[0].id } : null;
  }, target.at);
  if (block) {
    await page.evaluate((id) => window.__editor.setSelection({ tiles: [], entities: [id] }, true), block.id);
    const r2 = await rev();
    rows.push(
      await measure(page, cdp, `${tag} move a block (1 m, one edit)`, async () => {
        await page.evaluate((id) => {
          const ed = window.__editor;
          const e = ed.doc.entities.find((x) => x.id === id);
          ed.run('Move', { kind: 'updateEntities', before: [e], after: [{ ...e, position: [e.position[0] + 1, e.position[1], e.position[2]] }] });
        }, block.id);
        await page.waitForFunction((r) => window.__editor.history.revision !== r && window.__editor.renderedRevision === window.__editor.history.revision, r2, { timeout: 60000 }).catch(() => console.log('  the block did not move'));
      })
    );
    const r3 = await rev();
    rows.push(
      await measure(page, cdp, `${tag} undo the block's move`, async () => {
        await page.keyboard.press('Control+z');
        await page.waitForFunction((r) => window.__editor.history.revision !== r && window.__editor.renderedRevision === window.__editor.history.revision, r3, { timeout: 60000 }).catch(() => console.log('  undo changed nothing'));
      })
    );
  }
  await context.close();
  return { map: size, rows };
}

try {
  await waitForHttp(CLIENT);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const out = [];
  for (const m of MAPS) out.push(await run(browser, m));
  await browser.close();
  if (process.env.EDIT_JSON) writeFileSync(process.env.EDIT_JSON, JSON.stringify(out, null, 1));
} finally {
  stop();
}
