// The repeat probe for the worn-down tab (docs/PERF_MAPMAKER_TRACE_2026-11-15.md, fix 3b): what a long session leaves
// behind. In one page: MapMaker on a big map, then rounds of a small edit → Test with bots for a while → Back to
// MapMaker; then plain matches back to back from the menu. After each round it collects garbage and reads the page's
// numbers (the memory readout, `window.__memory`, and Chrome's own counts: script heap, DOM nodes, event listeners,
// documents), so what grows round on round shows.
//
//   node tools/perf/memory-probe.mjs                      (after `pnpm build`; serves the build on PROBE_PORT)
//   PROBE_MAP="Iron Maw"      the map as the Open dialog lists it (its remix is opened)
//   PROBE_ROUNDS=10           Test rounds;  PROBE_MATCHES=10  plain matches (0: none)
//   PROBE_TEST_S=20           seconds in each Test or match;  PROBE_BOTS=15
//   PROBE_JSON=<file>         every reading as JSON
//   PROBE_HEAP=<dir>          a heap snapshot after the first and the last round (open in DevTools → Memory)
//   PROBE_URL=<url>           a client already being served;  CHROMIUM=<path>  another Chromium
//   PROBE_SAMPLE_S=0          also read every this many seconds while a Test plays (collected first): what a Test
//                             itself leaves (the owner's trace of 2026-11-24 rose in a Test; docs/PERF_EDITOR_IDLE_2026-11-24.md)
//   PROBE_QUERY=<query>       more of the page's query (`&perfoff=…`)
//   PROBE_CHECK=<MB>,<nodes>,<listeners>   fail (exit 1) if, from the second round back in MapMaker to the last, the
//                             script heap grew more than <MB>, or DOM nodes or listeners more than those counts
//
// Software rendering here: frame rate says nothing, memory does.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = process.env.PROBE_PORT ?? '5003';
const CLIENT = process.env.PROBE_URL ?? `http://localhost:${PORT}`;
const MAP = process.env.PROBE_MAP ?? 'Iron Maw';
const ARCADE_MAP = process.env.PROBE_ARCADE_MAP ?? 'iron_maw';
const ROUNDS = Number(process.env.PROBE_ROUNDS ?? 10);
const MATCHES = Number(process.env.PROBE_MATCHES ?? 10);
const PLAY_S = Number(process.env.PROBE_TEST_S ?? 20);
const BOTS = Number(process.env.PROBE_BOTS ?? 15);
const HEAP = process.env.PROBE_HEAP;
const SAMPLE_S = Number(process.env.PROBE_SAMPLE_S ?? 0);
const QUERY = process.env.PROBE_QUERY ?? '';
const CHECK = process.env.PROBE_CHECK ? process.env.PROBE_CHECK.split(',').map(Number) : null;
if (HEAP) mkdirSync(HEAP, { recursive: true });

const server = process.env.PROBE_URL ? { pid: 0 } : spawn('pnpm', ['--filter', '@tiletrigger/client', 'exec', 'vite', 'preview', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
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

/**
 * Every object of a kind still in the heap after collection, the disposed ones counted apart: a disposed scene, node or
 * geometry that is still reachable is a leak (something holds it), whatever the scenes' own lists say.
 */
async function heapObjects(cdp) {
  const proto = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr })).result.objectId;
  const kinds = {
    scenes: [`Object.getPrototypeOf(window.__editor.view.scene)`, `function () { return [this.length, this.filter((s) => s.isDisposed).length]; }`],
    nodes: [`(() => { let p = Object.getPrototypeOf(window.__editor.view.scene.meshes[0]); while (Object.getPrototypeOf(p) !== Object.prototype) p = Object.getPrototypeOf(p); return p; })()`, `function () { let d = 0; for (const n of this) { try { if (n.isDisposed()) d++; } catch {} } return [this.length, d]; }`],
    geometries: [`Object.getPrototypeOf(window.__editor.view.scene.geometries[0])`, `function () { return [this.length, this.filter((g) => !g.getScene || !g.getScene() || g.getScene().isDisposed).length]; }`],
    gpuTextures: [`Object.getPrototypeOf(window.__editor.view.scene.getEngine().getLoadedTexturesCache()[0])`, `function () { const live = new Set(window.__editor.view.scene.getEngine().getLoadedTexturesCache()); return [this.length, this.filter((t) => !live.has(t)).length]; }`],
    materials: [`(() => { let p = Object.getPrototypeOf(window.__editor.view.scene.materials[0]); while (Object.getPrototypeOf(p) !== Object.prototype) p = Object.getPrototypeOf(p); return p; })()`, `function () { return [this.length, this.filter((m) => !m.getScene() || m.getScene().isDisposed).length]; }`],
    // Every element in the heap, and those not in the page (detached: held by something, or garbage the collection missed).
    elements: ['Element.prototype', `function () { return [this.length, this.filter((e) => !e.isConnected).length]; }`],
    // Web Audio nodes: all, and those of a closed context.
    audioNodes: ['AudioNode.prototype', `function () { return [this.length, this.filter((n) => n.context?.state === 'closed').length]; }`],
    // Babylon's observers: all, and those whose observable's owner is gone (an observer left on a disposed thing is a leak).
    observers: [`Object.getPrototypeOf(window.__editor.view.scene.onBeforeRenderObservable.observers[0] ?? window.__editor.view.scene.onDisposeObservable.add(() => {}))`, `function () { return [this.length, this.filter((o) => o._willBeUnregistered).length]; }`],
  };
  const out = {};
  for (const [k, [expr, count]] of Object.entries(kinds)) {
    try {
      const id = await proto(expr);
      const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: id });
      const r = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: count, returnByValue: true });
      out[k] = r.result.value;
      await cdp.send('Runtime.releaseObject', { objectId: objects.objectId });
    } catch (e) {
      out[k] = String(e.message ?? e).slice(0, 60);
    }
  }
  return out;
}

const readings = [];
let base = null;

/** Collect garbage (twice: what a first collection frees can free more), then read everything. */
async function read(page, cdp, label) {
  await sleep(1500);
  for (let i = 0; i < 2; i++) await cdp.send('HeapProfiler.collectGarbage');
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const m = await page.evaluate(() => window.__memory.sample());
  const dom = await cdp.send('Memory.getDOMCounters').catch(() => null);
  // Observers on the scenes' own observables (onBeforeRender and the rest), all scenes.
  const sceneObservers = await page.evaluate(() => {
    let n = 0;
    for (const sc of window.__editor.view.scene.getEngine().scenes) for (const v of Object.values(sc)) if (v && typeof v === 'object' && Array.isArray(v._observers)) n += v._observers.length;
    return n;
  });
  const r = {
    label,
    heapMB: Math.round((metrics.JSHeapUsedSize / 1048576) * 10) / 10,
    listeners: metrics.JSEventListeners,
    nodes: metrics.Nodes,
    documents: metrics.Documents,
    domCounterNodes: dom?.nodes,
    sceneObservers,
    frames: metrics.Frames,
    ...Object.fromEntries(['scenes', 'meshes', 'materials', 'geometries', 'textures', 'gpuTextures', 'gpuTextureMB', 'renderTargets', 'skeletons', 'animationGroups', 'transformNodes', 'domNodes', 'workers'].map((k) => [k, m[k]])),
  };
  r.heap = await heapObjects(cdp);
  readings.push(r);
  base ??= r;
  const d = (k) => {
    const x = r[k] - base[k];
    return `${r[k]}${x ? ` (${x > 0 ? '+' : ''}${Math.round(x * 10) / 10})` : ''}`;
  };
  console.log(`${label.padEnd(26)} heap ${d('heapMB')} MB · listeners ${d('listeners')} · DOM ${d('nodes')} · docs ${d('documents')} · scenes ${d('scenes')} · meshes ${d('meshes')} · materials ${d('materials')} · geometries ${d('geometries')} · textures ${d('textures')} · GPU textures ${d('gpuTextures')} (${d('gpuTextureMB')} MB, ${d('renderTargets')} targets) · skeletons ${d('skeletons')} · anim groups ${d('animationGroups')} · nodes ${d('transformNodes')} · scene observers ${d('sceneObservers')} · workers ${d('workers')}\n${''.padEnd(27)}in the heap (all / disposed or off-scene): ${Object.entries(r.heap).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' / ') : v}`).join(' · ')}`);
  return r;
}

async function heapSnapshot(cdp, name) {
  if (!HEAP) return;
  const out = createWriteStream(`${HEAP}/${name}.heapsnapshot`);
  const onChunk = (e) => out.write(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await new Promise((r) => out.end(r));
}

/** A match running (Test or plain): you are in, past the countdown. */
const inMatch = (page) => page.waitForFunction(() => !!window.__cs?.local && !document.getElementById('editor')?.offsetParent, null, { timeout: 240000 });

async function leave(page) {
  await page.evaluate(() => document.getElementById('exitmatch').click());
}

async function main() {
  await waitForHttp(CLIENT);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
  page.on('crash', () => console.log('  PAGE CRASHED'));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');

  // MapMaker on the map's remix.
  await page.goto(`${CLIENT}/?mode=editor&test=1${QUERY}`);
  await page.waitForFunction(() => !!(window.__editor && window.__memory), null, { timeout: 120000 });
  await read(page, cdp, 'MapMaker, blank');
  await page.click('#ed-open');
  const rowSel = `#ed-library li:has-text(${JSON.stringify(MAP)})`;
  await page.waitForSelector(rowSel, { timeout: 30000 });
  const before = await page.evaluate(() => window.__editor.doc.metadata.id);
  await page.locator(rowSel).first().locator('button').first().click();
  await page.waitForFunction((b) => window.__editor.doc.metadata.id !== b, before, { timeout: 180000 });
  console.log(`opened ${await page.evaluate(() => `${window.__editor.doc.metadata.name}: ${window.__editor.doc.entities.length} things`)}`);
  // Every Test takes BOTS bots, whatever the map's team sizes.
  await page.evaluate((bots) => {
    const host = window.__editor.host;
    const start = host.startTest.bind(host);
    host.startTest = (req) => start({ ...req, botFill: bots + 1 });
  }, BOTS);
  await sleep(5000);
  await read(page, cdp, 'MapMaker, map open');

  for (let i = 1; i <= ROUNDS; i++) {
    // A small edit: a prop moves 1 m (and back next round).
    await page.evaluate((i) => {
      const ed = window.__editor;
      const e = ed.doc.entities.find((x) => x.kind === 'prop');
      if (e) ed.run('Move', { kind: 'updateEntities', before: [e], after: [{ ...e, position: [e.position[0] + (i % 2 ? 1 : -1), e.position[1], e.position[2]] }] });
    }, i);
    await page.waitForFunction(() => window.__editor.renderedRevision === window.__editor.history.revision, null, { timeout: 60000 }).catch(() => {});
    await sleep(1000);
    await page.evaluate(() => window.__editor.test());
    await inMatch(page);
    if (SAMPLE_S > 0) {
      for (let t = SAMPLE_S; t <= PLAY_S; t += SAMPLE_S) {
        await sleep(SAMPLE_S * 1000);
        await read(page, cdp, `test ${i}, ${t} s in`);
      }
    } else {
      await sleep(PLAY_S * 1000);
      if (i === 1 || i === ROUNDS) await read(page, cdp, `test ${i}, playing`);
    }
    await leave(page);
    await page.waitForFunction(() => !document.getElementById('editor').hidden, null, { timeout: 60000 });
    await sleep(3000);
    await read(page, cdp, `round ${i}, back in MapMaker`);
    if (i === 1) await heapSnapshot(cdp, 'after-round-1');
  }
  if (ROUNDS) await heapSnapshot(cdp, `after-round-${ROUNDS}`);

  if (MATCHES) {
    // Plain matches: to the menu, then Play → Start, back to back.
    await page.evaluate(() => window.__editor.host.goHome());
    await page.waitForFunction(() => !!window.__front && !document.getElementById('menu').hidden, null, { timeout: 60000 });
    await page.evaluate((m) => localStorage.setItem('cs.arcade', JSON.stringify({ map: m.map, mode: 'core.tdm', bots: m.bots, skill: 'normal', scoreLimit: 999, minutes: 20 })), { map: ARCADE_MAP, bots: BOTS });
    await read(page, cdp, 'menu');
    for (let i = 1; i <= MATCHES; i++) {
      await page.evaluate(() => document.getElementById('nav-play').click());
      // (Every wait returns a boolean: a handle to a page object would keep it, and what it holds, alive.)
      await page.waitForFunction(() => !!document.getElementById('arcade-start'), null, { timeout: 30000 });
      await page.evaluate(() => document.getElementById('arcade-start').click());
      await inMatch(page);
      await sleep(PLAY_S * 1000);
      await leave(page);
      await page.waitForFunction(() => !!window.__front && !document.getElementById('menu').hidden, null, { timeout: 60000 });
      await sleep(3000);
      await read(page, cdp, `match ${i}, back at the menu`);
      if (i === 1) await heapSnapshot(cdp, 'after-match-1');
    }
    await heapSnapshot(cdp, `after-match-${MATCHES}`);
  }
  await browser.close();
  if (process.env.PROBE_JSON) writeFileSync(process.env.PROBE_JSON, JSON.stringify(readings, null, 1));
  // The rounds back in MapMaker, from the second (the first round fills caches) to the last.
  const back = readings.filter((r) => /back in MapMaker/.test(r.label));
  if (back.length >= 3) {
    const [a, b] = [back[1], back[back.length - 1]];
    const grew = { heapMB: Math.round((b.heapMB - a.heapMB) * 10) / 10, nodes: b.nodes - a.nodes, listeners: b.listeners - a.listeners };
    console.log(`round 2 → ${back.length} back in MapMaker: heap ${grew.heapMB >= 0 ? '+' : ''}${grew.heapMB} MB, DOM ${grew.nodes >= 0 ? '+' : ''}${grew.nodes}, listeners ${grew.listeners >= 0 ? '+' : ''}${grew.listeners}`);
    if (CHECK && (grew.heapMB > CHECK[0] || grew.nodes > CHECK[1] || grew.listeners > CHECK[2])) {
      console.log(`FAIL: over the margin (${CHECK.join(', ')})`);
      process.exitCode = 1;
    }
  }
}

try {
  await main();
} finally {
  stop();
}
