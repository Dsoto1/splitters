// Ticks maps' categories in MapMaker (map format v50; Map properties → Categories), the way a map maker does, and saves
// what MapMaker exports back into maps/<id>.json. The ticks come from a step list (docs/map-briefs/categories/steps.json):
// data, not code, so the owner can change a map's tags there and replay, or tick them in MapMaker by hand.
//
// Run against a built client being served (pnpm build, then vite preview: a dev server reloads the page as maps/ changes):
//   pnpm --filter @tiletrigger/client exec vite preview --port 4799 --host 127.0.0.1
//   node tools/maps/mapmaker-categories.mjs http://127.0.0.1:4799 [map ids…]
// CHROMIUM=<path> launches that browser. A map whose ticks already match is left as it is.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const only = process.argv.slice(3);
const steps = JSON.parse(readFileSync(join(ROOT, 'docs/map-briefs/categories/steps.json'), 'utf8'));
const ids = Object.keys(steps.maps).filter((id) => !only.length || only.includes(id));
const key = (p) => `${p.category}:${p.tag}`;

const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// One MapMaker for every map (Import replaces the map open): starting MapMaker afresh for each was minutes a map.
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.goto(`${base}/?mode=editor&test=1`);
await page.waitForFunction(() => window.__editor, null, { timeout: 180000 });
let changed = 0;
for (const id of ids) {
  const want = steps.maps[id];
  const file = join(ROOT, 'maps', `${id}.json`);
  const before = JSON.parse(readFileSync(file, 'utf8'));
  const has = (before.metadata.categories ?? []).map(key).sort().join();
  if (has === want.map(key).sort().join()) {
    console.log(`${id}: already tagged`);
    continue;
  }
  const t0 = Date.now();
  // A slow machine can time a step out: MapMaker is opened afresh and the map tried again (twice at most).
  for (let attempt = 1; ; attempt++) {
    try {
      await tagOne(id, file, want);
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log(`${id}: ${e.message.split('\n')[0]}; again`);
      await page.goto(`${base}/?mode=editor&test=1`, { timeout: 180000 });
      await page.waitForFunction(() => window.__editor, null, { timeout: 180000 });
    }
  }
  changed++;
  console.log(`${id}: ${want.map(key).join(', ')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
console.log(`${changed} map${changed === 1 ? '' : 's'} tagged and exported`);

async function tagOne(id, file, want) {
  await page.setInputFiles('#ed-import-file', file, { timeout: 180000 });
  await page.waitForFunction((i) => window.__editor.doc.metadata.id === i, id, { timeout: 180000 });
  // Map settings: the top bar's title opens them in the right dock.
  // (Clicked in the page: right after an import a software-drawn frame can keep Playwright's own click waiting.)
  await page.evaluate(() => document.getElementById('ed-map-settings')?.hidden !== false && document.getElementById('ed-title').click());
  await page.waitForSelector('#ed-prop-categories', { state: 'attached', timeout: 180000 });
  // Untick what shouldn't be there, then tick what should (one undoable step each, as by hand).
  const wanted = new Set(want.map(key));
  for (const sel of await page.$$eval('#ed-prop-categories input[type=checkbox]', (bs) => bs.map((b) => ({ id: b.id, k: `${b.dataset.category}:${b.dataset.tag}`, on: b.checked })))) {
    if (sel.on === wanted.has(sel.k)) continue;
    await page.evaluate((i) => {
      const b = document.getElementById(i);
      b.scrollIntoView({ block: 'center' });
      b.click();
    }, sel.id);
    await page.waitForFunction(([i, on]) => document.getElementById(i)?.checked === on, [sel.id, !sel.on], { timeout: 120000 });
  }
  const now = await page.evaluate(() => (window.__editor.doc.metadata.categories ?? []).map((p) => `${p.category}:${p.tag}`).sort().join());
  if (now !== [...wanted].sort().join()) throw new Error(`${id}: MapMaker holds ${now}, wanted ${[...wanted].sort().join()}`);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.evaluate(() => document.getElementById('ed-export').click())]);
  writeFileSync(file, readFileSync(await download.path(), 'utf8'));
}
